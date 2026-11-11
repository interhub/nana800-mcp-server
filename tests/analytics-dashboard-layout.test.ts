import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.MCP_API_KEY = 'test-key';

type Record_ = { chart_id: string; chart_position_data: { order_index: number; width_size: number } };

const dashboard = { _id: 'd1', analytics_org: 'o1', dashboard_name: 'Test', dashboard_charts_data_array: [] as Record_[] };
const requests: { method: string; path: string; body?: any }[] = [];

globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  const method = init?.method || 'GET';
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  requests.push({ method, path: url.pathname, body });
  let data: unknown = null;
  if (url.pathname === '/analytics_org_dashboards/get_dashboard_by_id/d1') {
    data = dashboard;
  } else if (url.pathname === '/analytics_org_dashboards/add_chart_to_dashboard/d1') {
    dashboard.dashboard_charts_data_array.push({ chart_id: body.chart_id, chart_position_data: body.chart_position_data });
    data = dashboard;
  } else if (url.pathname === '/analytics_org_dashboards/set_chart_position_data') {
    const record = dashboard.dashboard_charts_data_array.find((item) => item.chart_id === body.chart_id);
    if (record) record.chart_position_data = body.chart_position_data;
    data = dashboard;
  }
  return new Response(JSON.stringify(data), { status: 200 });
}) as typeof fetch;

const { addChartToDashboard } = await import('../src/tools/analytics-dashboard.tools.js');

const order = () =>
  [...dashboard.dashboard_charts_data_array]
    .sort((a, b) => a.chart_position_data.order_index - b.chart_position_data.order_index)
    .map((item) => `${item.chart_id}:${item.chart_position_data.width_size}`);

test('charts are added at the end after the largest order_index', async () => {
  dashboard.dashboard_charts_data_array = [
    { chart_id: 'a', chart_position_data: { order_index: 0, width_size: 2 } },
    { chart_id: 'b', chart_position_data: { order_index: 5, width_size: 1 } },
  ];
  requests.length = 0;
  const result = await addChartToDashboard('d1', 'c', 3);
  const add = requests.find((request) => request.path.startsWith('/analytics_org_dashboards/add_chart_to_dashboard'));
  assert.deepEqual(add?.body, { chart_id: 'c', chart_position_data: { order_index: 6, width_size: 3 } });
  assert.equal(requests.filter((request) => request.path === '/analytics_org_dashboards/set_chart_position_data').length, 0);
  assert.deepEqual(order(), ['a:2', 'b:1', 'c:3']);
  assert.equal(result.dashboard_url, 'https://cloud.nana800.io/analytics/dashboard/d1?org=o1');
});

test('a chart put in the middle moves the charts below it down', async () => {
  dashboard.dashboard_charts_data_array = [
    { chart_id: 'a', chart_position_data: { order_index: 0, width_size: 2 } },
    { chart_id: 'b', chart_position_data: { order_index: 1, width_size: 1 } },
    { chart_id: 'c', chart_position_data: { order_index: 2, width_size: 3 } },
  ];
  requests.length = 0;
  const result = await addChartToDashboard('d1', 'x', 1, 1);
  assert.deepEqual(order(), ['a:2', 'x:1', 'b:1', 'c:3']);
  assert.deepEqual(
    result.layout.map((item: { chart_id: string; position: number }) => `${item.chart_id}@${item.position}`),
    ['a@0', 'x@1', 'b@2', 'c@3']
  );
  const moved = requests.filter((request) => request.path === '/analytics_org_dashboards/set_chart_position_data').map((request) => request.body.chart_id);
  assert.deepEqual(moved, ['b', 'c']);
});

test('the same chart can not be added twice', async () => {
  dashboard.dashboard_charts_data_array = [{ chart_id: 'a', chart_position_data: { order_index: 0, width_size: 1 } }];
  await assert.rejects(addChartToDashboard('d1', 'a', 1), /already on dashboard/);
});
