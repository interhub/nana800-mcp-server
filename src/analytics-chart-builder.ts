import { z } from 'zod';
import { conditionSchema, MAX_CONDITIONS_PER_FILTER, type Condition } from './analytics-schemas.js';

export const MAX_CHART_SERIES = 20;
export const MAX_RETENTION_PERIODS_COUNT = 30;
export const MIN_FUNNEL_CONVERSION_WINDOW_SECONDS = 60;
export const MAX_FUNNEL_CONVERSION_WINDOW_SECONDS = 366 * 24 * 60 * 60;
export const MAX_CHART_PERIODS = 1000;
const MAX_SUMMARY_SERIES = 30;
const MAX_SUMMARY_PERIODS = 120;
const MAX_SUMMARY_COHORTS = 30;

const CABINET_URL = (process.env.MCP_CABINET_URL || 'https://cloud.nana800.io').replace(/\/+$/, '');

export const getChartUrl = (chartId: string, orgId: string): string =>
  `${CABINET_URL}/analytics/chart/${encodeURIComponent(chartId)}?org=${encodeURIComponent(orgId)}`;

export const getDashboardUrl = (dashboardId: string, orgId: string): string =>
  `${CABINET_URL}/analytics/dashboard/${encodeURIComponent(dashboardId)}?org=${encodeURIComponent(orgId)}`;

export const getPublicDashboardUrl = (shareToken: string): string => `${CABINET_URL}/share/dashboard/${encodeURIComponent(shareToken)}`;

export const CHART_VARIANTS = ['LINES_CHART', 'BARS', 'FUNNEL', 'RETENTION'] as const;
export const TIME_SCALES = ['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY'] as const;
export const METRICS = ['UNIQ_USERS', 'TOTAL_EVENTS'] as const;

export type ChartVariant = (typeof CHART_VARIANTS)[number];
export type TimeScale = (typeof TIME_SCALES)[number];
export type Metric = (typeof METRICS)[number];

const seriesSchema = z.object({
  event_type_id: z.string().describe('Event type _id from analytics_event_types_list'),
  title: z
    .string()
    .min(1)
    .max(200)
    .describe(
      'Series label shown on the chart and in the legend, e.g. "Посетители" or "Оплатили". For a FUNNEL it is the step name. With breakdown_property_key the series names become "<title> (<value>)"'
    ),
  conditions: z
    .array(conditionSchema)
    .max(MAX_CONDITIONS_PER_FILTER)
    .optional()
    .describe('Conditions on event properties of this series only, all must match. Example: page_path EQUAL ["/pricing"] to count only views of the pricing page'),
  breakdown_property_key: z
    .string()
    .max(200)
    .optional()
    .describe(
      'LINES_CHART and BARS only: split this series by the values of an event property (key from analytics_event_properties_list), e.g. "traffic_channel", "utm_source", "device_type". Each value becomes its own series; rare values are joined into an "other" series'
    ),
});

export type ChartSeries = z.infer<typeof seriesSchema>;

const periodSchema = z
  .object({
    time_scale: z.enum(TIME_SCALES).describe('One point (or bar) per hour, day, week or month'),
    last_periods_count: z
      .number()
      .int()
      .min(1)
      .max(MAX_CHART_PERIODS)
      .optional()
      .describe(
        'Live period: the last N periods including the current one, the chart moves with time. "Last 30 days" = DAILY + 30, "last 12 weeks" = WEEKLY + 12, "last 6 months" = MONTHLY + 6. Default 30 when from_time is not given'
      ),
    from_time: z.iso
      .datetime({ offset: true })
      .optional()
      .describe('Fixed period start, ISO 8601 with a timezone. Use only when the user asks for exact dates; needs to_time too. The chart then never moves'),
    to_time: z.iso.datetime({ offset: true }).optional().describe('Fixed period end, ISO 8601 with a timezone, used together with from_time'),
  })
  .describe('Time range of the chart. Prefer a live period (last_periods_count) so the chart stays up to date on a dashboard');

export type ChartPeriod = z.infer<typeof periodSchema>;

export const chartDefinitionShape = {
  org_id: z.string().optional().describe('The analytics org ID from analytics_orgs_list (the analytics_org of the project). Required unless MCP_ANALYTICS_ORG_ID is set'),
  app_project_id: z.string().describe('The analytics app project ID from analytics_projects_list. Events are counted only in this project'),
  chart_variant: z
    .enum(CHART_VARIANTS)
    .describe(
      'LINES_CHART: trend over time. BARS: bars per period, or one total bar per series with display bars_mode TOTAL (good for "which channel / page / device is the biggest"). FUNNEL: conversion through ordered steps (series = steps, 2 to 20). RETENTION: how many users come back (exactly 2 series: the start event, then the return event)'
    ),
  series: z
    .array(seriesSchema)
    .min(1)
    .max(MAX_CHART_SERIES)
    .describe('Series of the chart in order. FUNNEL: steps from the first to the last. RETENTION: [start event, return event]. The same event type may be used several times with different conditions'),
  common_conditions: z
    .array(conditionSchema)
    .max(MAX_CONDITIONS_PER_FILTER)
    .optional()
    .describe(
      'Conditions added to every series, e.g. to drop test traffic: location_origin NOT_CONTAINS ["localhost","127.0.0.1"]. Stored inside every series, so analytics_chart_get shows them in each series'
    ),
  user_conditions: z
    .array(conditionSchema)
    .max(MAX_CONDITIONS_PER_FILTER)
    .optional()
    .describe('Conditions on user properties for the whole chart, e.g. email NOT_EQUAL ["me@example.com"] to hide the team'),
  metric: z
    .enum(METRICS)
    .optional()
    .describe('UNIQ_USERS (default): unique users per period. TOTAL_EVENTS: number of events per period. FUNNEL and RETENTION always count users'),
  period: periodSchema.optional(),
  compare_previous_period: z.boolean().optional().describe('LINES_CHART and BARS: also count the same number of periods right before the range to compare with'),
  funnel_conversion_window_seconds: z
    .number()
    .int()
    .min(MIN_FUNNEL_CONVERSION_WINDOW_SECONDS)
    .max(MAX_FUNNEL_CONVERSION_WINDOW_SECONDS)
    .optional()
    .describe('FUNNEL only: all steps must be done within this time from the first step, e.g. 86400 = 1 day, 604800 = 7 days. Not limited when not set'),
  retention_periods_count: z
    .number()
    .int()
    .min(1)
    .max(MAX_RETENTION_PERIODS_COUNT)
    .optional()
    .describe('RETENTION only: how many periods after the start period to track returns (DAILY up to 30, WEEKLY up to 26, MONTHLY up to 12). Cohorts are the periods of `period`: keep it up to 90 days, 52 weeks or 24 months'),
  timezone_offset_minutes: z
    .number()
    .int()
    .min(-840)
    .max(840)
    .optional()
    .describe('Timezone of day boundaries, minutes east of UTC: Moscow 180, Kaliningrad 120, UTC 0. UTC when not set'),
};

export const chartDefinitionSchema = z.object(chartDefinitionShape);
export type ChartDefinition = z.infer<typeof chartDefinitionSchema>;

const seriesSettingsSchema = z.object({
  series_name: z.string().max(200).describe('Series name from the preview result (series[].name), e.g. "Канал (search)"'),
  title: z.string().max(200).optional().describe('New label shown instead of the series name'),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .describe('Color as #RRGGBB'),
  metric: z.enum(METRICS).optional().describe('Metric of this series only'),
});

const formulaSchema = z.object({
  title: z.string().max(200).describe('Label of the calculated series, e.g. "Конверсия, %"'),
  operator: z.enum(['DIVIDE', 'SUBTRACT', 'ADD']).describe('DIVIDE shows A / B in percent'),
  series_a: z.string().max(200).describe('Series name A from the preview result'),
  series_b: z.string().max(200).describe('Series name B from the preview result'),
});

export const displaySettingsSchema = z
  .object({
    bars_mode: z
      .enum(['GROUPED', 'STACKED', 'TOTAL'])
      .optional()
      .describe('BARS only: GROUPED bars side by side, STACKED bars on top of each other, TOTAL one bar per series for the whole range (labels are cut to 16 characters)'),
    value_mode: z.enum(['NORMAL', 'CUMULATIVE', 'MOVING_AVERAGE']).optional().describe('LINES_CHART and BARS: values as is, running total, or moving average'),
    moving_average_window: z.union([z.literal(3), z.literal(7), z.literal(14), z.literal(28)]).optional().describe('Window of MOVING_AVERAGE in periods'),
    series_settings: z.array(seriesSettingsSchema).max(100).optional().describe('Renames or colors of series, mostly for breakdown values like "Канал (search)" -> "Поиск". Not used by FUNNEL: name the steps with series[].title'),
    formulas: z.array(formulaSchema).max(5).optional().describe('Up to 5 calculated series from two series, e.g. conversion = DIVIDE(buyers, visitors). Shown only when both series have data'),
  })
  .describe('How the chart is drawn on the page. Does not change the numbers');

export type DisplaySettings = z.infer<typeof displaySettingsSchema>;

/**
 * Property ids by property key for every event type used in the chart.
 * The chart builder of the web app needs them to show the selected properties of a saved chart.
 */
export type EventTypePropertyIds = Record<string, Record<string, string>>;

export type ChartRequestBody = {
  chart_variant: ChartVariant;
  search_events_input: Record<string, unknown>;
  group_periods_input: Record<string, unknown>;
  funnel_settings?: { conversion_window_seconds?: number };
  retention_settings?: { periods_count?: number };
  timezone_offset_minutes?: number;
};

export type ChartBuildResult = {
  body: ChartRequestBody;
  warnings: string[];
};

const DEFAULT_LAST_PERIODS_COUNT = 30;

/**
 * Checks rules of chart variants that zod alone can not express.
 * Returns the list of problems, empty when the definition is valid.
 */
export const validateChartDefinition = (definition: ChartDefinition): string[] => {
  const errors: string[] = [];
  const { chart_variant, series, period } = definition;
  if (chart_variant === 'RETENTION' && series.length !== 2) {
    errors.push('RETENTION needs exactly 2 series: the start event and the return event');
  }
  if (chart_variant === 'FUNNEL' && series.length < 2) {
    errors.push('FUNNEL needs at least 2 series (steps)');
  }
  if ((chart_variant === 'FUNNEL' || chart_variant === 'RETENTION') && series.some((item) => item.breakdown_property_key)) {
    errors.push(`${chart_variant} can not split series by a property, breakdown_property_key works only for LINES_CHART and BARS`);
  }
  if (chart_variant !== 'FUNNEL' && definition.funnel_conversion_window_seconds !== undefined) {
    errors.push('funnel_conversion_window_seconds works only for FUNNEL');
  }
  if (chart_variant !== 'RETENTION' && definition.retention_periods_count !== undefined) {
    errors.push('retention_periods_count works only for RETENTION');
  }
  if (period && !!period.from_time !== !!period.to_time) {
    errors.push('period.from_time and period.to_time must be given together');
  }
  if (period?.from_time && period.to_time && new Date(period.to_time).getTime() <= new Date(period.from_time).getTime()) {
    errors.push('period.to_time must be after period.from_time');
  }
  if (period?.from_time && period.last_periods_count !== undefined) {
    errors.push('use either period.last_periods_count (live period) or period.from_time + period.to_time (fixed dates), not both');
  }
  return errors;
};

const withPropertyId = (condition: Condition, propertyIds: Record<string, string> | undefined): Record<string, unknown> => {
  const result: Record<string, unknown> = {
    param_name: condition.param_name,
    param_values: condition.param_values,
    condition: condition.condition || 'EQUAL',
  };
  const propertyId = propertyIds?.[condition.param_name];
  if (propertyId) result.param_prop_id = propertyId;
  return result;
};

/**
 * Builds the body of render_analytics_chart_view_data / create_chart / update_chart from a chart definition.
 * Series are written twice, the same way the web chart builder saves them:
 * search_events_input.event_types_filter (events to read, the builder shows series from here)
 * and group_periods_input.group_rules.event_types_group_items (how the events are counted).
 */
export const buildChartRequestBody = (definition: ChartDefinition, orgId: string, propertyIdsByEventType: EventTypePropertyIds = {}): ChartBuildResult => {
  const warnings: string[] = [];
  const commonConditions = definition.common_conditions || [];
  const scope = { org_id: orgId, app_project_id: definition.app_project_id };

  const eventTypesFilter: Record<string, unknown>[] = [];
  const groupItems: Record<string, unknown>[] = [];
  definition.series.forEach((series) => {
    const propertyIds = propertyIdsByEventType[series.event_type_id];
    const conditions = [...commonConditions, ...(series.conditions || [])];
    const eventProperties = conditions.map((condition) => withPropertyId(condition, propertyIds));
    const breakdownKey = series.breakdown_property_key?.trim() || '';
    const breakdownPropertyId = breakdownKey ? propertyIds?.[breakdownKey] : undefined;
    if (propertyIds) {
      const unknownKeys = [...new Set([...conditions.map((condition) => condition.param_name), ...(breakdownKey ? [breakdownKey] : [])])].filter(
        (key) => !propertyIds[key]
      );
      if (unknownKeys.length) {
        warnings.push(
          `Series "${series.title}": event type ${series.event_type_id} never had the properties ${unknownKeys.join(', ')}. Check the keys with analytics_event_properties_list (NOT_EQUAL / NOT_CONTAINS on a missing property keep every event, other conditions match nothing)`
        );
      }
    }
    const filterItem: Record<string, unknown> = {
      event_type_id: series.event_type_id,
      event_type_name: series.title,
      event_properties: eventProperties,
    };
    if (breakdownKey) {
      filterItem.breakdown_property_key = breakdownKey;
      if (breakdownPropertyId) filterItem.breakdown_property_id = breakdownPropertyId;
    }
    eventTypesFilter.push(filterItem);
    groupItems.push({
      event_type_id: series.event_type_id,
      event_type_name: series.title,
      event_property_key: breakdownKey,
      event_properties: eventProperties,
    });
  });

  const searchEventsInput: Record<string, unknown> = { ...scope, event_types_filter: eventTypesFilter };
  if (definition.user_conditions?.length) {
    searchEventsInput.user_filter = {
      ...scope,
      user_properties: definition.user_conditions.map((condition) => withPropertyId(condition, undefined)),
    };
  }

  const period = definition.period;
  const timeScale: TimeScale = period?.time_scale || 'DAILY';
  const groupPeriodsInput: Record<string, unknown> = {
    time_scale: timeScale,
    group_rules: {
      is_all_events_group: false,
      is_event_types_groups: true,
      is_event_props_groups: false,
      event_types_group_items: groupItems,
      uniques: definition.metric || 'UNIQ_USERS',
    },
  };
  if (period?.from_time && period.to_time) {
    groupPeriodsInput.is_fixed_time_period = true;
    groupPeriodsInput.from_time = period.from_time;
    groupPeriodsInput.to_time = period.to_time;
  } else {
    groupPeriodsInput.is_fixed_time_period = false;
    groupPeriodsInput.slice_last_periods_count = period?.last_periods_count || DEFAULT_LAST_PERIODS_COUNT;
  }
  if (definition.compare_previous_period !== undefined) {
    groupPeriodsInput.is_compare_previous_period = definition.compare_previous_period;
  }

  const body: ChartRequestBody = {
    chart_variant: definition.chart_variant,
    search_events_input: searchEventsInput,
    group_periods_input: groupPeriodsInput,
  };
  if (definition.chart_variant === 'FUNNEL') {
    body.funnel_settings = definition.funnel_conversion_window_seconds ? { conversion_window_seconds: definition.funnel_conversion_window_seconds } : {};
  }
  if (definition.chart_variant === 'RETENTION') {
    body.retention_settings = definition.retention_periods_count ? { periods_count: definition.retention_periods_count } : {};
  }
  if (definition.timezone_offset_minutes !== undefined) {
    body.timezone_offset_minutes = definition.timezone_offset_minutes;
  }
  return { body, warnings };
};

type SavedCondition = { param_name?: string; param_values?: string[]; condition?: Condition['condition'] };
type SavedGroupItem = { event_type_id?: string; event_type_name?: string; event_property_key?: string; event_properties?: SavedCondition[] };

export type SavedChart = {
  _id: string;
  chart_name?: string;
  chart_description?: string;
  analytics_org?: string;
  chart_variant?: ChartVariant;
  search_events_input?: {
    app_project_id?: string | null;
    user_filter?: { user_properties?: SavedCondition[] | null } | null;
  } | null;
  group_periods_input?: {
    time_scale?: TimeScale;
    is_fixed_time_period?: boolean;
    slice_last_periods_count?: number | null;
    from_time?: string | null;
    to_time?: string | null;
    is_compare_previous_period?: boolean | null;
    group_rules?: { uniques?: Metric | null; event_types_group_items?: SavedGroupItem[] | null } | null;
  } | null;
  funnel_settings?: { conversion_window_seconds?: number | null } | null;
  retention_settings?: { periods_count?: number | null } | null;
  timezone_offset_minutes?: number | null;
  display_settings?: Record<string, unknown> | null;
};

const toCondition = (saved: SavedCondition): Condition => ({
  param_name: saved.param_name || '',
  param_values: saved.param_values || [],
  condition: saved.condition || 'EQUAL',
});

/**
 * Removes null values and mongo service fields, so a saved chart can be sent back to the API validation.
 */
export const compactSavedValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(compactSavedValue);
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      if (item === null || item === undefined || key === '_id' || key === '__v') return;
      result[key] = compactSavedValue(item);
    });
    return result;
  }
  return value;
};

/**
 * Converts a saved chart back into the definition the MCP tools accept, so the model can read it, change a part and send it to analytics_chart_update.
 * Conditions of common_conditions are kept inside every series (the API stores them there).
 */
export const savedChartToDefinition = (chart: SavedChart): ChartDefinition & { chart_name?: string; chart_description?: string; display_settings?: unknown } => {
  const groupPeriods = chart.group_periods_input || {};
  const groupItems = groupPeriods.group_rules?.event_types_group_items || [];
  const series: ChartSeries[] = groupItems.map((item) => {
    const result: ChartSeries = {
      event_type_id: item.event_type_id || '',
      title: item.event_type_name || '',
    };
    const conditions = (item.event_properties || []).map(toCondition);
    if (conditions.length) result.conditions = conditions;
    if (item.event_property_key) result.breakdown_property_key = item.event_property_key;
    return result;
  });
  const period: ChartPeriod = { time_scale: groupPeriods.time_scale || 'DAILY' };
  if (groupPeriods.is_fixed_time_period && groupPeriods.from_time && groupPeriods.to_time) {
    period.from_time = groupPeriods.from_time;
    period.to_time = groupPeriods.to_time;
  } else {
    period.last_periods_count = groupPeriods.slice_last_periods_count || DEFAULT_LAST_PERIODS_COUNT;
  }
  const definition: ChartDefinition & { chart_name?: string; chart_description?: string; display_settings?: unknown } = {
    chart_name: chart.chart_name,
    chart_description: chart.chart_description || undefined,
    org_id: chart.analytics_org,
    app_project_id: chart.search_events_input?.app_project_id || '',
    chart_variant: chart.chart_variant || 'LINES_CHART',
    series,
    metric: groupPeriods.group_rules?.uniques || 'UNIQ_USERS',
    period,
  };
  const userConditions = (chart.search_events_input?.user_filter?.user_properties || []).map(toCondition);
  if (userConditions.length) definition.user_conditions = userConditions;
  if (groupPeriods.is_compare_previous_period) definition.compare_previous_period = true;
  if (chart.funnel_settings?.conversion_window_seconds) definition.funnel_conversion_window_seconds = chart.funnel_settings.conversion_window_seconds;
  if (chart.retention_settings?.periods_count) definition.retention_periods_count = chart.retention_settings.periods_count;
  if (typeof chart.timezone_offset_minutes === 'number') definition.timezone_offset_minutes = chart.timezone_offset_minutes;
  if (chart.display_settings) definition.display_settings = compactSavedValue(chart.display_settings);
  return definition;
};

type RenderGroup = {
  group_name: string;
  tracked_events_count: number;
  uniq_users_count: number;
  series_index?: number;
  breakdown_value?: string | null;
  is_other_values?: boolean;
};

type RenderPeriod = { period_title: string; start_time: string; event_groups: RenderGroup[] };

export type ChartRenderResult = {
  time_scale: TimeScale;
  start_time: string;
  end_time: string;
  is_truncated: boolean;
  processed_events_count: number;
  group_titles: string[];
  summary_event_groups: RenderGroup[];
  periods: RenderPeriod[];
  previous_period?: { start_time: string; end_time: string; summary_event_groups: RenderGroup[] };
  funnel?: {
    steps: {
      step_name: string;
      users_count: number;
      conversion_from_previous_percent: number;
      conversion_from_first_percent: number;
      drop_off_count: number;
      median_time_from_previous_ms: number | null;
    }[];
    overall_conversion_percent: number;
    median_time_to_last_step_ms: number | null;
    conversion_window_seconds?: number | null;
  };
  retention?: {
    period_unit: TimeScale;
    periods_count: number;
    start_event_name: string;
    return_event_name: string;
    cohorts: { period_title: string; users_count: number; retained_percents: number[] }[];
    overall_users_counts: number[];
    overall_retained_percents: number[];
  };
};

const summarizeGroup = (group: RenderGroup) => {
  const result: Record<string, unknown> = {
    name: group.group_name,
    uniq_users: group.uniq_users_count,
    events: group.tracked_events_count,
  };
  if (group.breakdown_value !== undefined && group.breakdown_value !== null) result.breakdown_value = group.breakdown_value;
  if (group.is_other_values) result.is_other_values = true;
  return result;
};

/**
 * Turns the render result into a short answer for the model: totals of every series, values per period
 * and the funnel or retention numbers, without the repeated per period objects of the API.
 */
export const summarizeChartRender = (render: ChartRenderResult, variant: ChartVariant, metric: Metric = 'UNIQ_USERS'): Record<string, unknown> => {
  const groups = render.summary_event_groups || [];
  const shownGroups = groups.slice(0, MAX_SUMMARY_SERIES);
  const summary: Record<string, unknown> = {
    range: { time_scale: render.time_scale, start_time: render.start_time, end_time: render.end_time, periods_count: render.periods?.length || render.retention?.cohorts?.length || 0 },
    processed_events_count: render.processed_events_count,
  };
  if (render.is_truncated) summary.is_truncated = true;

  if (variant === 'FUNNEL' && render.funnel) {
    summary.funnel = {
      steps: render.funnel.steps.map((step) => ({
        name: step.step_name,
        users: step.users_count,
        conversion_from_previous_percent: step.conversion_from_previous_percent,
        conversion_from_first_percent: step.conversion_from_first_percent,
        drop_off: step.drop_off_count,
        median_time_from_previous_seconds: step.median_time_from_previous_ms === null ? null : Math.round(step.median_time_from_previous_ms / 1000),
      })),
      overall_conversion_percent: render.funnel.overall_conversion_percent,
      conversion_window_seconds: render.funnel.conversion_window_seconds ?? null,
    };
  } else if (variant === 'RETENTION' && render.retention) {
    const retention = render.retention;
    const cohorts = retention.cohorts.filter((cohort) => cohort.users_count > 0);
    summary.retention = {
      period_unit: retention.period_unit,
      start_event: retention.start_event_name,
      return_event: retention.return_event_name,
      overall_users_counts: retention.overall_users_counts,
      overall_retained_percents: retention.overall_retained_percents,
      cohorts: cohorts.slice(-MAX_SUMMARY_COHORTS).map((cohort) => ({ period: cohort.period_title, users: cohort.users_count, retained_percents: cohort.retained_percents })),
    };
  } else {
    summary.metric = metric;
    summary.series = shownGroups.map(summarizeGroup);
    if (groups.length > shownGroups.length) summary.series_not_shown_count = groups.length - shownGroups.length;
    const periods = (render.periods || []).slice(-MAX_SUMMARY_PERIODS);
    const valueKey = metric === 'TOTAL_EVENTS' ? 'tracked_events_count' : 'uniq_users_count';
    summary.values_by_period = {
      period_titles: periods.map((period) => period.period_title),
      values: Object.fromEntries(
        shownGroups.map((group) => [
          group.group_name,
          periods.map((period) => period.event_groups.find((item) => item.group_name === group.group_name)?.[valueKey] || 0),
        ])
      ),
    };
    if ((render.periods || []).length > periods.length) summary.values_by_period_note = `only the last ${periods.length} periods are shown`;
    if (render.previous_period) {
      summary.previous_period = {
        start_time: render.previous_period.start_time,
        end_time: render.previous_period.end_time,
        series: render.previous_period.summary_event_groups.slice(0, MAX_SUMMARY_SERIES).map(summarizeGroup),
      };
    }
  }

  if (!render.processed_events_count) {
    summary.hint = 'No events matched. Check app_project_id, event_type_id values (analytics_event_types_list), property keys (analytics_event_properties_list) and the period';
  }
  return summary;
};
