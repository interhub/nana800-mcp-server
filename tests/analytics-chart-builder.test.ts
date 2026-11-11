import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChartRequestBody,
  getChartUrl,
  getDashboardUrl,
  getPublicDashboardUrl,
  savedChartToDefinition,
  summarizeChartRender,
  validateChartDefinition,
  type ChartDefinition,
  type ChartRenderResult,
  type SavedChart,
} from '../src/analytics-chart-builder.js';

const ORG = 'org1';
const PROJECT = 'project1';

const funnelDefinition: ChartDefinition = {
  app_project_id: PROJECT,
  chart_variant: 'FUNNEL',
  series: [
    { event_type_id: 'view', title: 'Просмотр' },
    { event_type_id: 'buy', title: 'Покупка', conditions: [{ param_name: 'plan', param_values: ['pro'] }] },
  ],
  common_conditions: [{ param_name: 'location_origin', param_values: ['localhost'], condition: 'NOT_CONTAINS' }],
  period: { time_scale: 'DAILY', last_periods_count: 30 },
  funnel_conversion_window_seconds: 604800,
};

test('funnel body writes every series to the search filter and to the group rules with the same conditions', () => {
  const { body, warnings } = buildChartRequestBody(funnelDefinition, ORG, {
    view: { location_origin: 'p-view-origin' },
    buy: { location_origin: 'p-buy-origin', plan: 'p-buy-plan' },
  });
  assert.deepEqual(warnings, []);
  assert.equal(body.chart_variant, 'FUNNEL');
  assert.deepEqual(body.funnel_settings, { conversion_window_seconds: 604800 });
  assert.equal(body.retention_settings, undefined);

  const search = body.search_events_input as Record<string, any>;
  assert.equal(search.org_id, ORG);
  assert.equal(search.app_project_id, PROJECT);
  assert.equal(search.user_filter, undefined);
  assert.deepEqual(search.event_types_filter[1], {
    event_type_id: 'buy',
    event_type_name: 'Покупка',
    event_properties: [
      { param_name: 'location_origin', param_values: ['localhost'], condition: 'NOT_CONTAINS', param_prop_id: 'p-buy-origin' },
      { param_name: 'plan', param_values: ['pro'], condition: 'EQUAL', param_prop_id: 'p-buy-plan' },
    ],
  });

  const group = body.group_periods_input as Record<string, any>;
  assert.equal(group.is_fixed_time_period, false);
  assert.equal(group.slice_last_periods_count, 30);
  assert.equal(group.time_scale, 'DAILY');
  assert.equal(group.group_rules.is_event_types_groups, true);
  assert.equal(group.group_rules.uniques, 'UNIQ_USERS');
  assert.deepEqual(
    group.group_rules.event_types_group_items.map((item: any) => [item.event_type_name, item.event_property_key, item.event_properties.length]),
    [
      ['Просмотр', '', 1],
      ['Покупка', '', 2],
    ]
  );
  assert.deepEqual(group.group_rules.event_types_group_items[1].event_properties, search.event_types_filter[1].event_properties);
});

test('breakdown, user conditions and a fixed period are written where the web chart builder reads them', () => {
  const { body, warnings } = buildChartRequestBody(
    {
      app_project_id: PROJECT,
      chart_variant: 'BARS',
      series: [{ event_type_id: 'view', title: 'Посетители', breakdown_property_key: 'traffic_channel' }],
      user_conditions: [{ param_name: 'email', param_values: ['me@example.com'], condition: 'NOT_EQUAL' }],
      metric: 'TOTAL_EVENTS',
      period: { time_scale: 'WEEKLY', from_time: '2026-10-01T00:00:00.000Z', to_time: '2026-11-01T00:00:00.000Z' },
      timezone_offset_minutes: 180,
    },
    ORG,
    { view: { traffic_channel: 'p-channel' } }
  );
  assert.deepEqual(warnings, []);
  const search = body.search_events_input as Record<string, any>;
  assert.equal(search.event_types_filter[0].breakdown_property_key, 'traffic_channel');
  assert.equal(search.event_types_filter[0].breakdown_property_id, 'p-channel');
  assert.deepEqual(search.user_filter, {
    org_id: ORG,
    app_project_id: PROJECT,
    user_properties: [{ param_name: 'email', param_values: ['me@example.com'], condition: 'NOT_EQUAL' }],
  });
  const group = body.group_periods_input as Record<string, any>;
  assert.equal(group.group_rules.event_types_group_items[0].event_property_key, 'traffic_channel');
  assert.equal(group.group_rules.uniques, 'TOTAL_EVENTS');
  assert.equal(group.is_fixed_time_period, true);
  assert.equal(group.from_time, '2026-10-01T00:00:00.000Z');
  assert.equal(group.slice_last_periods_count, undefined);
  assert.equal(body.timezone_offset_minutes, 180);
  assert.equal(body.funnel_settings, undefined);
});

test('a property key the event type never had gives a warning', () => {
  const { warnings } = buildChartRequestBody(
    { app_project_id: PROJECT, chart_variant: 'LINES_CHART', series: [{ event_type_id: 'view', title: 'Views', breakdown_property_key: 'utm_sorce' }] },
    ORG,
    { view: { utm_source: 'p1' } }
  );
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /utm_sorce/);
});

test('the live period is 30 days when no period is given', () => {
  const { body } = buildChartRequestBody({ app_project_id: PROJECT, chart_variant: 'LINES_CHART', series: [{ event_type_id: 'view', title: 'Views' }] }, ORG);
  const group = body.group_periods_input as Record<string, any>;
  assert.equal(group.time_scale, 'DAILY');
  assert.equal(group.slice_last_periods_count, 30);
  assert.equal(group.is_fixed_time_period, false);
});

test('chart variant rules are checked before a request', () => {
  const base = { app_project_id: PROJECT, series: [{ event_type_id: 'a', title: 'A' }] };
  assert.match(validateChartDefinition({ ...base, chart_variant: 'RETENTION' }).join(), /exactly 2 series/);
  assert.match(validateChartDefinition({ ...base, chart_variant: 'FUNNEL' }).join(), /at least 2/);
  assert.match(
    validateChartDefinition({ ...base, chart_variant: 'FUNNEL', series: [{ event_type_id: 'a', title: 'A', breakdown_property_key: 'x' }, { event_type_id: 'b', title: 'B' }] }).join(),
    /can not split/
  );
  assert.match(validateChartDefinition({ ...base, chart_variant: 'BARS', funnel_conversion_window_seconds: 600 }).join(), /only for FUNNEL/);
  assert.match(validateChartDefinition({ ...base, chart_variant: 'BARS', period: { time_scale: 'DAILY', from_time: '2026-10-01T00:00:00Z' } }).join(), /together/);
  assert.match(
    validateChartDefinition({ ...base, chart_variant: 'BARS', period: { time_scale: 'DAILY', from_time: '2026-10-02T00:00:00Z', to_time: '2026-10-01T00:00:00Z' } }).join(),
    /after/
  );
  assert.deepEqual(validateChartDefinition(funnelDefinition), []);
});

test('a saved chart turns back into the definition the tools accept', () => {
  const { body } = buildChartRequestBody(funnelDefinition, ORG, {});
  const saved = {
    _id: 'chart1',
    chart_name: 'Воронка',
    chart_description: '',
    analytics_org: ORG,
    ...body,
    search_events_input: { ...body.search_events_input, user_filter: null },
    display_settings: { bars_mode: null, series_settings: null },
  } as unknown as SavedChart;
  const definition = savedChartToDefinition(saved);
  assert.equal(definition.chart_variant, 'FUNNEL');
  assert.equal(definition.app_project_id, PROJECT);
  assert.equal(definition.org_id, ORG);
  assert.deepEqual(definition.period, { time_scale: 'DAILY', last_periods_count: 30 });
  assert.equal(definition.funnel_conversion_window_seconds, 604800);
  assert.deepEqual(definition.series[1], {
    event_type_id: 'buy',
    title: 'Покупка',
    conditions: [
      { param_name: 'location_origin', param_values: ['localhost'], condition: 'NOT_CONTAINS' },
      { param_name: 'plan', param_values: ['pro'], condition: 'EQUAL' },
    ],
  });
  assert.equal(definition.user_conditions, undefined);
  assert.deepEqual(definition.display_settings, {});
  const rebuilt = buildChartRequestBody(definition, ORG, {});
  assert.deepEqual(rebuilt.body.group_periods_input, body.group_periods_input);
});

const group = (name: string, users: number, events: number, extra: Record<string, unknown> = {}) => ({
  group_name: name,
  group_category: 'EVENT_TYPE',
  uniq_users_count: users,
  tracked_events_count: events,
  ...extra,
});

test('the render summary gives totals and values per period of every series', () => {
  const render = {
    time_scale: 'DAILY',
    start_time: '2026-11-09T00:00:00.000Z',
    end_time: '2026-11-12T00:00:00.000Z',
    is_truncated: false,
    processed_events_count: 12,
    group_titles: ['Канал (search)', 'Канал (direct)'],
    summary_event_groups: [group('Канал (search)', 5, 9, { breakdown_value: 'search' }), group('Канал (direct)', 2, 3, { breakdown_value: 'direct' })],
    periods: [
      { period_title: '09.11', start_time: '', event_groups: [] },
      { period_title: '10.11', start_time: '', event_groups: [group('Канал (search)', 3, 6)] },
      { period_title: '11.11', start_time: '', event_groups: [group('Канал (search)', 2, 3), group('Канал (direct)', 2, 3)] },
    ],
  } as unknown as ChartRenderResult;
  const summary = summarizeChartRender(render, 'BARS', 'UNIQ_USERS') as Record<string, any>;
  assert.deepEqual(summary.series[0], { name: 'Канал (search)', uniq_users: 5, events: 9, breakdown_value: 'search' });
  assert.deepEqual(summary.values_by_period, {
    period_titles: ['09.11', '10.11', '11.11'],
    values: { 'Канал (search)': [0, 3, 2], 'Канал (direct)': [0, 0, 2] },
  });
  assert.equal(summary.hint, undefined);
  const events = summarizeChartRender(render, 'BARS', 'TOTAL_EVENTS') as Record<string, any>;
  assert.deepEqual(events.values_by_period.values['Канал (search)'], [0, 6, 3]);
});

test('the render summary of a funnel gives steps with conversion and a hint when nothing matched', () => {
  const render = {
    time_scale: 'DAILY',
    start_time: '',
    end_time: '',
    is_truncated: false,
    processed_events_count: 0,
    group_titles: [],
    summary_event_groups: [],
    periods: [],
    funnel: {
      steps: [
        { step_name: 'Просмотр', users_count: 0, conversion_from_previous_percent: 100, conversion_from_first_percent: 100, drop_off_count: 0, median_time_from_previous_ms: null },
        { step_name: 'Покупка', users_count: 0, conversion_from_previous_percent: 0, conversion_from_first_percent: 0, drop_off_count: 0, median_time_from_previous_ms: 61500 },
      ],
      overall_conversion_percent: 0,
      median_time_to_last_step_ms: null,
      conversion_window_seconds: 604800,
    },
  } as unknown as ChartRenderResult;
  const summary = summarizeChartRender(render, 'FUNNEL') as Record<string, any>;
  assert.equal(summary.funnel.steps[1].name, 'Покупка');
  assert.equal(summary.funnel.steps[1].median_time_from_previous_seconds, 62);
  assert.equal(summary.series, undefined);
  assert.match(summary.hint, /No events matched/);
});

test('web app links', () => {
  assert.equal(getChartUrl('c1', 'o1'), 'https://cloud.nana800.io/analytics/chart/c1?org=o1');
  assert.equal(getDashboardUrl('d1', 'o1'), 'https://cloud.nana800.io/analytics/dashboard/d1?org=o1');
  assert.equal(getPublicDashboardUrl('tok_en'), 'https://cloud.nana800.io/share/dashboard/tok_en');
});
