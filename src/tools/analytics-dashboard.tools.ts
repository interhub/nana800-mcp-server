import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiPath, getAnalyticsApiClient, getAnalyticsOrgId } from '../api-client.js';
import { getChartUrl, getDashboardUrl, getPublicDashboardUrl, type SavedChart } from '../analytics-chart-builder.js';
import { toolError, toolResult, unwrap } from './tool-result.js';
import type { AnalyticsDashboard, AnalyticsDashboardChartRecord } from '../types.js';

const MAX_PARALLEL_CHART_REQUESTS = 8;

const LAYOUT_HINT =
  'Layout: the dashboard is a grid of 3 columns, charts go in the order of their position and wrap into rows. ' +
  'width_size 1 = a third, 2 = two thirds, 3 = a full row. Keep the sum of widths in every row equal to 3 (3, 2+1, 1+2, 1+1+1), otherwise a row has an empty hole. ' +
  'Good widths: a line or bars over time 2 or 3, a funnel 2 or 3 (up to 4 steps fit without scrolling at width 1), TOTAL bars and retention 1 or 2.';

const widthSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const sortedCharts = (dashboard: AnalyticsDashboard): AnalyticsDashboardChartRecord[] =>
  [...(dashboard.dashboard_charts_data_array || [])].sort((a, b) => (a.chart_position_data?.order_index ?? 0) - (b.chart_position_data?.order_index ?? 0));

const getDashboard = async (dashboardId: string): Promise<AnalyticsDashboard> => {
  const client = getAnalyticsApiClient();
  const dashboard = unwrap(await client.get<AnalyticsDashboard | null>(apiPath`/analytics_org_dashboards/get_dashboard_by_id/${dashboardId}`), 'Get dashboard');
  if (!dashboard?._id) {
    throw new Error(`Dashboard ${dashboardId} is not found`);
  }
  return dashboard;
};

const setChartPosition = async (dashboardId: string, chartId: string, orderIndex: number, widthSize: number) => {
  const client = getAnalyticsApiClient();
  unwrap(
    await client.put('/analytics_org_dashboards/set_chart_position_data', {
      dashboard_id: dashboardId,
      chart_id: chartId,
      chart_position_data: { order_index: orderIndex, width_size: widthSize },
    }),
    'Set chart position'
  );
};

/**
 * Writes order_index 0..n-1 in the given order and the given widths, sending only the charts whose position changed.
 * The API keeps order_index as it is sent, so a chart put in the middle needs the charts below it moved down.
 */
const applyLayout = async (dashboardId: string, current: AnalyticsDashboardChartRecord[], target: { chart_id: string; width_size: number }[]) => {
  const currentById = new Map(current.map((record) => [record.chart_id, record.chart_position_data]));
  for (const [index, item] of target.entries()) {
    const position = currentById.get(item.chart_id);
    if (position?.order_index !== index || position?.width_size !== item.width_size) {
      await setChartPosition(dashboardId, item.chart_id, index, item.width_size);
    }
  }
};

const describeLayout = (dashboard: AnalyticsDashboard) =>
  sortedCharts(dashboard).map((record) => ({
    chart_id: record.chart_id,
    position: record.chart_position_data?.order_index ?? 0,
    width_size: record.chart_position_data?.width_size ?? 1,
  }));

/**
 * Puts a chart onto a dashboard at a position (the end by default) and moves the charts below it down.
 */
export const addChartToDashboard = async (dashboardId: string, chartId: string, widthSize: number, position?: number) => {
  const client = getAnalyticsApiClient();
  const dashboard = await getDashboard(dashboardId);
  const current = sortedCharts(dashboard);
  if (current.some((record) => record.chart_id === chartId)) {
    throw new Error(`Chart ${chartId} is already on dashboard ${dashboardId}, use analytics_dashboard_set_chart_position to move it`);
  }
  const index = position === undefined ? current.length : Math.min(position, current.length);
  const orderIndex = index === current.length ? (current.length ? Math.max(...current.map((record) => record.chart_position_data?.order_index ?? 0)) + 1 : 0) : index;
  unwrap(
    await client.post(apiPath`/analytics_org_dashboards/add_chart_to_dashboard/${dashboardId}`, {
      chart_id: chartId,
      chart_position_data: { order_index: orderIndex, width_size: widthSize },
    }),
    'Add chart to dashboard'
  );
  if (index < current.length) {
    const target = current.map((record) => ({ chart_id: record.chart_id, width_size: record.chart_position_data?.width_size ?? 1 }));
    target.splice(index, 0, { chart_id: chartId, width_size: widthSize });
    const withNew = [...current, { chart_id: chartId, chart_position_data: { order_index: orderIndex, width_size: widthSize } }] as AnalyticsDashboardChartRecord[];
    await applyLayout(dashboardId, withNew, target);
  }
  const orgId = dashboard.analytics_org;
  return { dashboard_id: dashboardId, dashboard_url: getDashboardUrl(dashboardId, orgId), layout: describeLayout(await getDashboard(dashboardId)) };
};

const mapLimited = async <T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
};

export const registerAnalyticsDashboardTools = (server: McpServer) => {
  server.tool(
    'analytics_dashboards_list',
    'List dashboards of an analytics org (org_id from analytics_orgs_list or MCP_ANALYTICS_ORG_ID): dashboard_id, name, description, charts_count, dashboard_url (web app) and public_url when the public link is on',
    {
      org_id: z.string().optional().describe('The analytics org ID from analytics_orgs_list (uses MCP_ANALYTICS_ORG_ID env if not provided)'),
    },
    async ({ org_id }) => {
      try {
        const orgId = getAnalyticsOrgId(org_id);
        const client = getAnalyticsApiClient();
        const dashboards = unwrap(await client.get<AnalyticsDashboard[]>(apiPath`/analytics_org_dashboards/get_dashboards_by_org/${orgId}`), 'Get dashboards');
        return toolResult({
          success: true,
          data: (dashboards || []).map((dashboard) => ({
            dashboard_id: dashboard._id,
            dashboard_name: dashboard.dashboard_name,
            dashboard_description: dashboard.dashboard_description || '',
            charts_count: dashboard.dashboard_charts_data_array?.length || 0,
            dashboard_url: getDashboardUrl(dashboard._id, orgId),
            public_url: dashboard.share_token ? getPublicDashboardUrl(dashboard.share_token) : null,
          })),
        });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'analytics_dashboard_get',
    'Get a dashboard with its charts in order: chart_id, chart_name, chart_variant, position, width_size, chart_url. Also dashboard_url and public_url when the public link is on',
    {
      dashboard_id: z.string().describe('Dashboard ID'),
    },
    async ({ dashboard_id }) => {
      try {
        const dashboard = await getDashboard(dashboard_id);
        const orgId = dashboard.analytics_org;
        const client = getAnalyticsApiClient();
        const charts = await mapLimited(sortedCharts(dashboard), MAX_PARALLEL_CHART_REQUESTS, async (record) => {
          const response = await client.get<SavedChart | null>(apiPath`/analytics_charts/get_chart_by_id/${record.chart_id}`);
          return {
            chart_id: record.chart_id,
            chart_name: response.success ? response.data?.chart_name ?? null : null,
            chart_variant: response.success ? response.data?.chart_variant ?? null : null,
            position: record.chart_position_data?.order_index ?? 0,
            width_size: record.chart_position_data?.width_size ?? 1,
            chart_url: getChartUrl(record.chart_id, orgId),
            ...(response.success && response.data ? {} : { error: 'chart is not found or not readable' }),
          };
        });
        return toolResult({
          success: true,
          dashboard_id: dashboard._id,
          dashboard_name: dashboard.dashboard_name,
          dashboard_description: dashboard.dashboard_description || '',
          org_id: orgId,
          dashboard_url: getDashboardUrl(dashboard._id, orgId),
          public_url: dashboard.share_token ? getPublicDashboardUrl(dashboard.share_token) : null,
          charts,
        });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'analytics_dashboard_create',
    'Create an empty analytics dashboard in an org and return dashboard_id and dashboard_url. Then save charts with analytics_chart_create and add_to_dashboard, or add saved charts with analytics_dashboard_add_chart. ' +
      LAYOUT_HINT,
    {
      org_id: z.string().optional().describe('The analytics org ID from analytics_orgs_list (uses MCP_ANALYTICS_ORG_ID env if not provided)'),
      dashboard_name: z.string().min(1).max(200).describe('Dashboard name, e.g. "Сайт - метрики"'),
      dashboard_description: z.string().max(1000).optional().describe('One line about what the dashboard shows'),
    },
    async ({ org_id, dashboard_name, dashboard_description }) => {
      try {
        const orgId = getAnalyticsOrgId(org_id);
        const client = getAnalyticsApiClient();
        const dashboard = unwrap(
          await client.post<AnalyticsDashboard | null>('/analytics_org_dashboards/create_dashboard', {
            analytics_org: orgId,
            dashboard_name,
            ...(dashboard_description ? { dashboard_description } : {}),
          }),
          'Create dashboard'
        );
        if (!dashboard?._id) {
          throw new Error('Create dashboard returned no dashboard');
        }
        return toolResult({ success: true, dashboard_id: dashboard._id, dashboard_name: dashboard.dashboard_name, dashboard_url: getDashboardUrl(dashboard._id, orgId) });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'analytics_dashboard_update',
    'Rename a dashboard or change its description',
    {
      dashboard_id: z.string().describe('Dashboard ID'),
      dashboard_name: z.string().min(1).max(200).optional().describe('New name'),
      dashboard_description: z.string().max(1000).optional().describe('New description, "" to clear it'),
    },
    async ({ dashboard_id, dashboard_name, dashboard_description }) => {
      try {
        const dashboard = await getDashboard(dashboard_id);
        const client = getAnalyticsApiClient();
        unwrap(
          await client.put(apiPath`/analytics_org_dashboards/update_dashboard/${dashboard_id}`, {
            analytics_org: dashboard.analytics_org,
            dashboard_name: dashboard_name ?? dashboard.dashboard_name,
            dashboard_description: dashboard_description ?? dashboard.dashboard_description ?? '',
          }),
          'Update dashboard'
        );
        return toolResult({ success: true, dashboard_id, dashboard_url: getDashboardUrl(dashboard_id, dashboard.analytics_org) });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'analytics_dashboard_add_chart',
    'Put a saved chart onto a dashboard at a position (the end by default) with a width; charts below move down. Returns the new layout. ' + LAYOUT_HINT,
    {
      dashboard_id: z.string().describe('Dashboard ID'),
      chart_id: z.string().describe('Chart ID from analytics_chart_create or analytics_dashboard_get'),
      width_size: widthSchema.optional().describe('1 = a third of the row, 2 = two thirds, 3 = full row. Default 1'),
      position: z.number().int().min(0).optional().describe('Place counting from 0. At the end when not set'),
    },
    async ({ dashboard_id, chart_id, width_size, position }) => {
      try {
        return toolResult({ success: true, ...(await addChartToDashboard(dashboard_id, chart_id, width_size || 1, position)) });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'analytics_dashboard_set_chart_position',
    'Move a chart on a dashboard and/or change its width. position is the place counting from 0: other charts shift to keep the order. Returns the new layout. ' + LAYOUT_HINT,
    {
      dashboard_id: z.string().describe('Dashboard ID'),
      chart_id: z.string().describe('Chart ID on this dashboard'),
      position: z.number().int().min(0).optional().describe('New place counting from 0, unchanged when not set'),
      width_size: widthSchema.optional().describe('New width, unchanged when not set'),
    },
    async ({ dashboard_id, chart_id, position, width_size }) => {
      try {
        const dashboard = await getDashboard(dashboard_id);
        const current = sortedCharts(dashboard);
        const currentIndex = current.findIndex((record) => record.chart_id === chart_id);
        if (currentIndex < 0) {
          throw new Error(`Chart ${chart_id} is not on dashboard ${dashboard_id}, add it with analytics_dashboard_add_chart`);
        }
        const target = current.map((record) => ({ chart_id: record.chart_id, width_size: record.chart_position_data?.width_size ?? 1 }));
        const [moved] = target.splice(currentIndex, 1);
        if (width_size) moved.width_size = width_size;
        target.splice(position === undefined ? currentIndex : Math.min(position, target.length), 0, moved);
        await applyLayout(dashboard_id, current, target);
        return toolResult({
          success: true,
          dashboard_url: getDashboardUrl(dashboard_id, dashboard.analytics_org),
          layout: describeLayout(await getDashboard(dashboard_id)),
        });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'analytics_dashboard_remove_chart',
    'Take a chart off a dashboard. The chart itself stays saved (delete it with analytics_chart_delete)',
    {
      dashboard_id: z.string().describe('Dashboard ID'),
      chart_id: z.string().describe('Chart ID'),
    },
    async ({ dashboard_id, chart_id }) => {
      try {
        const client = getAnalyticsApiClient();
        const dashboard = unwrap(
          await client.post<AnalyticsDashboard | null>(apiPath`/analytics_org_dashboards/remove_chart_from_dashboard/${dashboard_id}/${chart_id}`),
          'Remove chart from dashboard'
        );
        return toolResult({ success: true, layout: dashboard ? describeLayout(dashboard) : [] });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'analytics_dashboard_share_link',
    'Turn the public link of a dashboard on, reissue it or turn it off. Anyone with the public link sees the dashboard charts without login (read only, they can change only the period); it works until it is turned off. ' +
      'enable keeps the current link if it is already on, reissue makes a new link and the old one stops working at once, disable turns it off. Needs the owner or editor role in the org',
    {
      dashboard_id: z.string().describe('Dashboard ID'),
      action: z.enum(['enable', 'reissue', 'disable']).describe('enable, reissue or disable the public link'),
    },
    async ({ dashboard_id, action }) => {
      try {
        const client = getAnalyticsApiClient();
        if (action === 'enable') {
          const dashboard = await getDashboard(dashboard_id);
          if (dashboard.share_token) {
            return toolResult({ success: true, public_url: getPublicDashboardUrl(dashboard.share_token), dashboard_url: getDashboardUrl(dashboard_id, dashboard.analytics_org) });
          }
        }
        const result = unwrap(
          await client.put<{ share_token: string | null }>(apiPath`/analytics_org_dashboards/set_dashboard_share_link/${dashboard_id}`, {
            is_enabled: action !== 'disable',
            ...(action === 'reissue' ? { is_new_token: true } : {}),
          }),
          'Set dashboard share link'
        );
        return toolResult({ success: true, public_url: result?.share_token ? getPublicDashboardUrl(result.share_token) : null });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.tool(
    'analytics_dashboard_delete',
    'Delete a dashboard for good. With delete_charts true its charts are deleted too, except charts that are also shown on other dashboards. Irreversible, ask the user first',
    {
      dashboard_id: z.string().describe('Dashboard ID'),
      delete_charts: z.boolean().optional().describe('Also delete the charts of the dashboard. Default false: charts stay saved'),
    },
    async ({ dashboard_id, delete_charts }) => {
      try {
        const client = getAnalyticsApiClient();
        const dashboard = await getDashboard(dashboard_id);
        const chartIds = (dashboard.dashboard_charts_data_array || []).map((record) => record.chart_id);
        const result = unwrap(await client.delete<{ success: boolean }>(apiPath`/analytics_org_dashboards/delete_dashboard/${dashboard_id}`), 'Delete dashboard');
        const deletedCharts: string[] = [];
        const keptCharts: string[] = [];
        if (delete_charts) {
          for (const chartId of chartIds) {
            const others = unwrap(
              await client.get<{ _id: string }[]>(apiPath`/analytics_org_dashboards/get_dashboard_where_chart_applied/${chartId}`),
              'Find dashboards of the chart'
            );
            if ((others || []).length) {
              keptCharts.push(chartId);
              continue;
            }
            unwrap(await client.delete(apiPath`/analytics_charts/delete_chart_by_id/${chartId}`), 'Delete chart');
            deletedCharts.push(chartId);
          }
        }
        return toolResult({
          success: !!result?.success,
          deleted_charts: deletedCharts,
          ...(keptCharts.length ? { kept_charts_used_on_other_dashboards: keptCharts } : {}),
        });
      } catch (error) {
        return toolError(error);
      }
    }
  );
};
