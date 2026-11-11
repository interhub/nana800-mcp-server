import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiPath, getAnalyticsApiClient, getAnalyticsOrgId } from '../api-client.js';
import {
  buildChartRequestBody,
  chartDefinitionShape,
  compactSavedValue,
  displaySettingsSchema,
  getChartUrl,
  savedChartToDefinition,
  summarizeChartRender,
  validateChartDefinition,
  type ChartDefinition,
  type ChartRenderResult,
  type EventTypePropertyIds,
  type Metric,
  type SavedChart,
} from '../analytics-chart-builder.js';
import { toolError, toolResult, unwrap } from './tool-result.js';
import { addChartToDashboard } from './analytics-dashboard.tools.js';
import type { AnalyticsPropertyRecord } from '../types.js';

const CHART_FLOW_HINT =
  'How to build a chart from a request in words: 1) analytics_orgs_list and analytics_projects_list to get org_id and app_project_id; ' +
  '2) analytics_event_types_list to find event types by name (page_viewed, purchase_completed...); ' +
  '3) analytics_event_properties_list for property keys used in conditions and breakdowns; ' +
  '4) analytics_chart_preview to check the numbers; 5) analytics_chart_create to save it (optionally straight onto a dashboard). ' +
  'Event type ids and property keys must come from those tools, never guess them.';

const FUNNEL_EXAMPLE =
  'Example, "build a funnel from a view to a purchase for the last 30 days": chart_variant "FUNNEL", ' +
  'series [{event_type_id: "<id of page_viewed>", title: "Просмотр"}, {event_type_id: "<id of checkout_started>", title: "Начал оплату"}, {event_type_id: "<id of purchase_completed>", title: "Покупка"}], ' +
  'period {time_scale: "DAILY", last_periods_count: 30}, funnel_conversion_window_seconds 604800 (steps within 7 days). ' +
  'Example of a split: chart_variant "BARS", series [{event_type_id: "<id of page_viewed>", title: "Посетители", breakdown_property_key: "traffic_channel"}], display_settings {bars_mode: "TOTAL"}.';

const savedChartFields = ['chart_variant', 'search_events_input', 'group_periods_input', 'funnel_settings', 'retention_settings', 'timezone_offset_minutes'] as const;

const definitionUpdateKeys = [
  'app_project_id',
  'chart_variant',
  'series',
  'common_conditions',
  'user_conditions',
  'metric',
  'period',
  'compare_previous_period',
  'funnel_conversion_window_seconds',
  'retention_periods_count',
  'timezone_offset_minutes',
] as const;

/**
 * Property ids by key of every event type of the chart. A failed request of one event type is skipped: the ids only help the web chart builder.
 */
const getPropertyIdsByEventType = async (eventTypeIds: string[]): Promise<EventTypePropertyIds> => {
  const client = getAnalyticsApiClient();
  const uniqueIds = [...new Set(eventTypeIds)];
  const responses = await Promise.all(
    uniqueIds.map((id) => client.get<AnalyticsPropertyRecord[]>(apiPath`/analytics_property_records/get_properties_by_event_type/${id}`))
  );
  const result: EventTypePropertyIds = {};
  responses.forEach((response, index) => {
    if (!response.success || !Array.isArray(response.data)) return;
    result[uniqueIds[index]] = Object.fromEntries(response.data.map((property) => [property.property_key, property._id]));
  });
  return result;
};

const buildBody = async (definition: ChartDefinition, orgId: string) => {
  const errors = validateChartDefinition(definition);
  if (errors.length) {
    throw new Error(errors.join('; '));
  }
  const propertyIds = await getPropertyIdsByEventType(definition.series.map((series) => series.event_type_id));
  return buildChartRequestBody(definition, orgId, propertyIds);
};

const renderChart = async (body: Record<string, unknown>) => {
  const client = getAnalyticsApiClient();
  return unwrap(await client.put<ChartRenderResult>('/analytics_charts/render_analytics_chart_view_data', body), 'Chart render');
};

const getSavedChart = async (chartId: string) => {
  const client = getAnalyticsApiClient();
  const chart = unwrap(await client.get<SavedChart | null>(apiPath`/analytics_charts/get_chart_by_id/${chartId}`), 'Get chart');
  if (!chart?._id) {
    throw new Error(`Chart ${chartId} is not found`);
  }
  return chart;
};

const getSavedChartBody = (chart: SavedChart): Record<string, unknown> => {
  const body: Record<string, unknown> = {};
  savedChartFields.forEach((field) => {
    const value = chart[field];
    if (value !== null && value !== undefined) body[field] = compactSavedValue(value);
  });
  return body;
};

const addToDashboardSchema = z
  .object({
    dashboard_id: z.string().describe('Dashboard ID from analytics_dashboards_list or analytics_dashboard_create'),
    width_size: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional().describe('Width in a row of 3 columns: 1 = third, 2 = two thirds, 3 = full row. Default 1'),
    position: z.number().int().min(0).optional().describe('Place on the dashboard counting from 0, other charts move down. At the end when not set'),
  })
  .describe('Put the saved chart onto a dashboard right away');

export const registerAnalyticsChartTools = (server: McpServer) => {
  server.tool(
    'analytics_event_properties_list',
    'List property keys ever sent with an event type (property_key, seen_count, last_seen_time), the most used first. Use the keys in series conditions, common_conditions and breakdown_property_key of chart tools. ' +
      'To see the values of a property, preview a BARS chart with breakdown_property_key set to it',
    {
      event_type_id: z.string().describe('Event type ID from analytics_event_types_list'),
    },
    async ({ event_type_id }) => {
      try {
        const client = getAnalyticsApiClient();
        const properties = unwrap(
          await client.get<AnalyticsPropertyRecord[]>(apiPath`/analytics_property_records/get_properties_by_event_type/${event_type_id}`),
          'Get properties'
        );
        const list = (properties || [])
          .map((property) => ({
            property_key: property.property_key,
            seen_count: property.seen_count ?? null,
            last_seen_time: property.last_seen_time ?? null,
          }))
          .sort((a, b) => (b.seen_count || 0) - (a.seen_count || 0));
        return toolResult({ success: true, data: list });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'analytics_chart_preview',
    'Calculate a chart without saving it and return its numbers: totals of every series, values per period, funnel steps with conversion, or retention by period. ' +
      'Pass a chart definition (the same fields as analytics_chart_create) or chart_id of a saved chart. Use it before analytics_chart_create to check that the chart has data and the series names for display_settings. ' +
      CHART_FLOW_HINT,
    {
      chart_id: z.string().optional().describe('Saved chart ID to calculate as it is saved. When set, the other fields are ignored'),
      ...Object.fromEntries(Object.entries(chartDefinitionShape).map(([key, schema]) => [key, schema.optional()])),
    } as Record<string, z.ZodType>,
    async (input: Record<string, unknown>) => {
      try {
        if (typeof input.chart_id === 'string' && input.chart_id) {
          const chart = await getSavedChart(input.chart_id);
          const render = await renderChart(getSavedChartBody(chart));
          const metric = (chart.group_periods_input?.group_rules?.uniques || 'UNIQ_USERS') as Metric;
          return toolResult({ success: true, chart_name: chart.chart_name, data: summarizeChartRender(render, chart.chart_variant || 'LINES_CHART', metric) });
        }
        const definition = z.object(chartDefinitionShape).parse(input);
        const orgId = getAnalyticsOrgId(definition.org_id);
        const { body, warnings } = await buildBody(definition, orgId);
        const render = await renderChart(body);
        return toolResult({
          success: true,
          ...(warnings.length ? { warnings } : {}),
          data: summarizeChartRender(render, definition.chart_variant, definition.metric),
        });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'analytics_chart_create',
    'Save a new analytics chart: a line, bars, a funnel or retention, with conditions, a split by a property and display settings. Returns chart_id and chart_url (the chart in the web app). ' +
      'Set add_to_dashboard to put it onto a dashboard in the same call. A chart counts a live period by default (last 30 days) and stays up to date. ' +
      CHART_FLOW_HINT +
      ' ' +
      FUNNEL_EXAMPLE,
    {
      chart_name: z.string().min(1).max(200).describe('Chart name shown on the dashboard, short, e.g. "Воронка: просмотр → покупка"'),
      chart_description: z.string().max(1000).optional().describe('One line under the name: what the chart counts'),
      ...chartDefinitionShape,
      display_settings: displaySettingsSchema.optional(),
      add_to_dashboard: addToDashboardSchema.optional(),
    },
    async ({ chart_name, chart_description, display_settings, add_to_dashboard, ...definition }) => {
      try {
        const orgId = getAnalyticsOrgId(definition.org_id);
        const { body, warnings } = await buildBody(definition, orgId);
        const client = getAnalyticsApiClient();
        const chart = unwrap(
          await client.post<SavedChart | null>('/analytics_charts/create_chart', {
            ...body,
            chart_name,
            ...(chart_description ? { chart_description } : {}),
            analytics_org: orgId,
            ...(display_settings ? { display_settings } : {}),
          }),
          'Create chart'
        );
        if (!chart?._id) {
          throw new Error('Create chart returned no chart');
        }
        const result: Record<string, unknown> = {
          success: true,
          chart_id: chart._id,
          chart_name: chart.chart_name,
          chart_variant: chart.chart_variant,
          chart_url: getChartUrl(chart._id, orgId),
        };
        if (warnings.length) result.warnings = warnings;
        if (add_to_dashboard) {
          result.dashboard = await addChartToDashboard(add_to_dashboard.dashboard_id, chart._id, add_to_dashboard.width_size || 1, add_to_dashboard.position);
        }
        return toolResult(result);
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'analytics_chart_get',
    'Get a saved chart as a chart definition (the fields of analytics_chart_create: series with their conditions, period, metric, display_settings) and its chart_url. ' +
      'Read it before analytics_chart_update to change one part and send the rest back',
    {
      chart_id: z.string().describe('Chart ID'),
    },
    async ({ chart_id }) => {
      try {
        const chart = await getSavedChart(chart_id);
        const orgId = chart.analytics_org || '';
        return toolResult({ success: true, chart_id: chart._id, chart_url: getChartUrl(chart._id, orgId), definition: savedChartToDefinition(chart) });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'analytics_chart_update',
    'Change a saved chart. Pass only what changes: the name, the description, display_settings (replaced as a whole), the period, the metric or the chart type; the rest stays as saved. ' +
      'series replaces all series; common_conditions and user_conditions need series in the same call (take them from analytics_chart_get). Dashboards with the chart show the change at once',
    {
      chart_id: z.string().describe('Chart ID'),
      chart_name: z.string().min(1).max(200).optional().describe('New chart name'),
      chart_description: z.string().max(1000).optional().describe('New description, "" to clear it'),
      ...Object.fromEntries(
        Object.entries(chartDefinitionShape)
          .filter(([key]) => key !== 'org_id')
          .map(([key, schema]) => [key, schema.optional()])
      ),
      display_settings: displaySettingsSchema.optional(),
    } as Record<string, z.ZodType>,
    async (input: Record<string, unknown>) => {
      try {
        const chartId = String(input.chart_id || '');
        const chart = await getSavedChart(chartId);
        const orgId = chart.analytics_org || '';
        const changedKeys = definitionUpdateKeys.filter((key) => input[key] !== undefined);
        if ((input.common_conditions !== undefined || input.user_conditions !== undefined) && input.series === undefined) {
          throw new Error('common_conditions and user_conditions are stored inside the series: pass series too (take them from analytics_chart_get)');
        }
        let body: Record<string, unknown>;
        let warnings: string[] = [];
        if (changedKeys.length) {
          const saved = savedChartToDefinition(chart);
          const merged: Record<string, unknown> = {
            app_project_id: saved.app_project_id,
            chart_variant: saved.chart_variant,
            series: saved.series,
            metric: saved.metric,
            period: saved.period,
            compare_previous_period: saved.compare_previous_period,
            funnel_conversion_window_seconds: saved.funnel_conversion_window_seconds,
            retention_periods_count: saved.retention_periods_count,
            timezone_offset_minutes: saved.timezone_offset_minutes,
            user_conditions: saved.user_conditions,
          };
          changedKeys.forEach((key) => {
            merged[key] = input[key];
          });
          if (merged.chart_variant !== 'FUNNEL') delete merged.funnel_conversion_window_seconds;
          if (merged.chart_variant !== 'RETENTION') delete merged.retention_periods_count;
          const definition = z.object(chartDefinitionShape).parse(merged);
          const built = await buildBody(definition, orgId);
          body = { ...built.body };
          warnings = built.warnings;
        } else {
          body = getSavedChartBody(chart);
        }
        const displaySettings = input.display_settings ?? (chart.display_settings ? compactSavedValue(chart.display_settings) : undefined);
        const description = input.chart_description !== undefined ? input.chart_description : chart.chart_description;
        const client = getAnalyticsApiClient();
        const updated = unwrap(
          await client.post<SavedChart | null>(apiPath`/analytics_charts/update_chart/${chartId}`, {
            ...body,
            chart_name: input.chart_name ?? chart.chart_name,
            ...(typeof description === 'string' ? { chart_description: description } : {}),
            analytics_org: orgId,
            ...(displaySettings ? { display_settings: displaySettings } : {}),
          }),
          'Update chart'
        );
        return toolResult({
          success: true,
          chart_id: chartId,
          chart_name: updated?.chart_name,
          chart_url: getChartUrl(chartId, orgId),
          ...(warnings.length ? { warnings } : {}),
        });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'analytics_chart_delete',
    'Delete a saved chart for good and remove it from every dashboard where it is shown. Irreversible, ask the user first',
    {
      chart_id: z.string().describe('Chart ID'),
    },
    async ({ chart_id }) => {
      try {
        const client = getAnalyticsApiClient();
        const dashboards = unwrap(
          await client.get<{ _id: string }[]>(apiPath`/analytics_org_dashboards/get_dashboard_where_chart_applied/${chart_id}`),
          'Find dashboards of the chart'
        );
        for (const dashboard of dashboards || []) {
          unwrap(await client.post(apiPath`/analytics_org_dashboards/remove_chart_from_dashboard/${dashboard._id}/${chart_id}`), 'Remove chart from dashboard');
        }
        const result = unwrap(await client.delete<{ success: boolean }>(apiPath`/analytics_charts/delete_chart_by_id/${chart_id}`), 'Delete chart');
        return toolResult({ success: !!result?.success, removed_from_dashboards: (dashboards || []).map((dashboard) => dashboard._id) });
      } catch (error) {
        return toolError(error);
      }
    }
  );
};
