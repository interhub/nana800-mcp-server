import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerProjectTools } from './tools/project.tools.js';
import { registerSchemeTools } from './tools/scheme.tools.js';
import { registerNodeTools } from './tools/node.tools.js';
import { registerNodeProcessTools } from './tools/node-process.tools.js';
import { registerSchemeProcessTools } from './tools/scheme-process.tools.js';
import { registerPaymentAccountTools } from './tools/payment-account.tools.js';
import { registerAnalyticsExportTools } from './tools/analytics-export.tools.js';
import { registerAnalyticsChartTools } from './tools/analytics-chart.tools.js';
import { registerAnalyticsDashboardTools } from './tools/analytics-dashboard.tools.js';

declare const __PACKAGE_VERSION__: string;

const SERVER_NAME = 'nana800-mcp-server';
const SERVER_VERSION = __PACKAGE_VERSION__;

const main = async () => {
  const apiKey = process.env.MCP_API_KEY;
  if (!apiKey) {
    console.error('Error: MCP_API_KEY environment variable is required');
    console.error('Get your API key at: https://cloud.nana800.io/settings');
    process.exit(1);
  }
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });
  registerProjectTools(server);
  registerSchemeTools(server);
  registerNodeTools(server);
  registerNodeProcessTools(server);
  registerSchemeProcessTools(server);
  registerPaymentAccountTools(server);
  registerAnalyticsExportTools(server);
  registerAnalyticsChartTools(server);
  registerAnalyticsDashboardTools(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
};

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
