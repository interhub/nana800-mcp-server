import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getApiClient } from '../api-client.js';
import type { SchemeProcess } from '../types.js';

export const registerSchemeProcessTools = (server: McpServer) => {
  server.tool(
    'scheme_process_get',
    'Get details of a specific scheme process (workflow execution instance)',
    {
      scheme_process_id: z.string().describe('The unique ID of the scheme process'),
    },
    async ({ scheme_process_id }) => {
      const client = getApiClient();
      const result = await client.get<SchemeProcess>(`/scheme-process/get/${scheme_process_id}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
  server.tool(
    'scheme_process_list_filtered',
    'Get filtered list of scheme processes (workflow executions) with pagination',
    {
      project: z.string().optional().describe('Filter by project ID'),
      scheme: z.string().optional().describe('Filter by scheme ID'),
      running_trigger: z.string().optional().describe('Filter by trigger node ID'),
      running_status: z.string().optional().describe('Filter by status (e.g., running, completed, failed)'),
      completion_status: z.string().optional().describe('Filter by completion status'),
      page_index: z.number().optional().describe('Page index for pagination (0-based)'),
      page_size: z.number().optional().describe('Number of items per page'),
    },
    async ({ project, scheme, running_trigger, running_status, completion_status, page_index, page_size }) => {
      const client = getApiClient();
      const result = await client.get<SchemeProcess[]>('/scheme-process/scheme_list_filtered', {
        project,
        scheme,
        running_trigger,
        running_status,
        completion_status,
        page_index,
        page_size,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
  server.tool(
    'scheme_process_delete',
    'Delete a scheme process record',
    {
      scheme_process_id: z.string().describe('The unique ID of the scheme process to delete'),
    },
    async ({ scheme_process_id }) => {
      const client = getApiClient();
      const result = await client.delete(`/scheme-process/delete/${scheme_process_id}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
};
