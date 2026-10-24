import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiPath, getApiClient } from '../api-client.js';
import type { NodeProcess } from '../types.js';

export const registerNodeProcessTools = (server: McpServer) => {
  server.tool(
    'node_process_get',
    'Get details of a specific node process execution',
    {
      node_process_id: z.string().describe('The unique ID of the node process'),
    },
    async ({ node_process_id }) => {
      const client = getApiClient();
      const result = await client.get<NodeProcess>(apiPath`/node-process/get/${node_process_id}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
  server.tool(
    'node_process_list_filtered',
    'Get filtered list of node processes with pagination. At least one of scheme, node or scheme_process is required',
    {
      scheme: z.string().optional().describe('Filter by scheme ID'),
      node: z.string().optional().describe('Filter by node ID'),
      scheme_process: z.string().optional().describe('Filter by scheme process ID'),
      running_status: z.string().optional().describe('Filter by status (e.g., running, completed, failed)'),
      node_type: z.string().optional().describe('Filter by node type'),
      page_index: z.number().optional().describe('Page index for pagination (0-based)'),
      page_size: z.number().optional().describe('Number of items per page'),
    },
    async ({ scheme, node, scheme_process, running_status, node_type, page_index, page_size }) => {
      const client = getApiClient();
      const result = await client.get<NodeProcess[]>('/node-process/scheme_list_filtered', {
        scheme,
        node,
        scheme_process,
        running_status,
        node_type,
        page_index,
        page_size,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
  server.tool(
    'node_process_delete',
    'Delete a node process record',
    {
      node_process_id: z.string().describe('The unique ID of the node process to delete'),
    },
    async ({ node_process_id }) => {
      const client = getApiClient();
      const result = await client.delete(apiPath`/node-process/delete/${node_process_id}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
};
