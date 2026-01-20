import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getApiClient, getProjectId, getSchemeId } from '../api-client.js';
import type { Scheme } from '../types.js';

export const registerSchemeTools = (server: McpServer) => {
  server.tool(
    'scheme_create',
    'Create a new scheme (automation workflow) within a project',
    {
      project_id: z.string().optional().describe('The project ID where the scheme will be created (uses MCP_PROJECT_ID env if not provided)'),
      scheme_name: z.string().describe('Name of the scheme'),
    },
    async ({ project_id, scheme_name }) => {
      try {
        const resolvedProjectId = getProjectId(project_id);
        const client = getApiClient();
        const result = await client.post<Scheme>('/scheme/create', { project_id: resolvedProjectId, scheme_name });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, null, 2) }],
        };
      }
    }
  );
  server.tool(
    'scheme_update',
    'Update an existing scheme properties',
    {
      scheme_id: z.string().optional().describe('The unique ID of the scheme to update (uses MCP_SCHEME_ID env if not provided)'),
      scheme_name: z.string().optional().describe('New name for the scheme'),
      scheme_description: z.string().optional().describe('New description for the scheme'),
      is_active: z.boolean().optional().describe('Enable or disable the scheme'),
    },
    async ({ scheme_id, scheme_name, scheme_description, is_active }) => {
      try {
        const resolvedSchemeId = getSchemeId(scheme_id);
        const client = getApiClient();
        const body: Record<string, unknown> = {};
        if (scheme_name !== undefined) body.scheme_name = scheme_name;
        if (scheme_description !== undefined) body.scheme_description = scheme_description;
        if (is_active !== undefined) body.is_active = is_active;
        const result = await client.put<Scheme>(`/scheme/update/${resolvedSchemeId}`, body);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, null, 2) }],
        };
      }
    }
  );
  server.tool(
    'scheme_get',
    'Get details of a specific scheme by its ID',
    {
      scheme_id: z.string().optional().describe('The unique ID of the scheme (uses MCP_SCHEME_ID env if not provided)'),
    },
    async ({ scheme_id }) => {
      try {
        const resolvedSchemeId = getSchemeId(scheme_id);
        const client = getApiClient();
        const result = await client.get<Scheme>(`/scheme/get/${resolvedSchemeId}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, null, 2) }],
        };
      }
    }
  );
  server.tool(
    'scheme_list_by_project',
    'Get list of all schemes in a project',
    {
      project_id: z.string().optional().describe('The project ID (uses MCP_PROJECT_ID env if not provided)'),
    },
    async ({ project_id }) => {
      try {
        const resolvedProjectId = getProjectId(project_id);
        const client = getApiClient();
        const result = await client.get<Scheme[]>(`/scheme/project_list/${resolvedProjectId}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, null, 2) }],
        };
      }
    }
  );
  server.tool(
    'scheme_get_context_type',
    'Get the context type of a scheme',
    {
      scheme_id: z.string().optional().describe('The unique ID of the scheme (uses MCP_SCHEME_ID env if not provided)'),
    },
    async ({ scheme_id }) => {
      try {
        const resolvedSchemeId = getSchemeId(scheme_id);
        const client = getApiClient();
        const result = await client.get(`/scheme/context_type/${resolvedSchemeId}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, null, 2) }],
        };
      }
    }
  );
  server.tool(
    'scheme_get_swagger_json',
    'Get Swagger/OpenAPI JSON specification for a scheme',
    {
      scheme_id: z.string().optional().describe('The unique ID of the scheme (uses MCP_SCHEME_ID env if not provided)'),
    },
    async ({ scheme_id }) => {
      try {
        const resolvedSchemeId = getSchemeId(scheme_id);
        const client = getApiClient();
        const result = await client.get(`/scheme/swagger_json/${resolvedSchemeId}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, null, 2) }],
        };
      }
    }
  );
  server.tool(
    'scheme_export',
    'Export a scheme configuration (nodes and connections) as JSON',
    {
      scheme_id: z.string().optional().describe('The unique ID of the scheme to export (uses MCP_SCHEME_ID env if not provided)'),
    },
    async ({ scheme_id }) => {
      try {
        const resolvedSchemeId = getSchemeId(scheme_id);
        const client = getApiClient();
        const result = await client.get(`/scheme/export/${resolvedSchemeId}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, null, 2) }],
        };
      }
    }
  );
  server.tool(
    'scheme_import',
    'Import nodes into a scheme from exported JSON data',
    {
      scheme_id: z.string().optional().describe('The unique ID of the scheme to import into (uses MCP_SCHEME_ID env if not provided)'),
      nodes_list: z.string().describe('JSON string of nodes list to import'),
    },
    async ({ scheme_id, nodes_list }) => {
      try {
        const resolvedSchemeId = getSchemeId(scheme_id);
        const client = getApiClient();
        let parsedNodes;
        try {
          parsedNodes = JSON.parse(nodes_list);
        } catch {
          return {
            content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Invalid JSON in nodes_list' }, null, 2) }],
          };
        }
        const result = await client.post(`/scheme/import/${resolvedSchemeId}`, { nodes_list: parsedNodes });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, null, 2) }],
        };
      }
    }
  );
  server.tool(
    'scheme_delete',
    'Delete a scheme and all its nodes. This action is irreversible!',
    {
      scheme_id: z.string().optional().describe('The unique ID of the scheme to delete (uses MCP_SCHEME_ID env if not provided)'),
    },
    async ({ scheme_id }) => {
      try {
        const resolvedSchemeId = getSchemeId(scheme_id);
        const client = getApiClient();
        const result = await client.delete(`/scheme/delete/${resolvedSchemeId}`);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, null, 2) }],
        };
      }
    }
  );
};
