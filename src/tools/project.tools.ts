import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getApiClient, getProjectId } from '../api-client.js';
import type { Project } from '../types.js';

export const registerProjectTools = (server: McpServer) => {
  server.tool(
    'project_create',
    'Create a new project in your account. Projects are containers for schemes (automation workflows).',
    {
      project_name: z.string().describe('Name of the project'),
      project_slug: z.string().describe('URL-friendly slug for the project (lowercase, no spaces)'),
      user_id: z.string().describe('User ID who owns the project'),
    },
    async ({ project_name, project_slug, user_id }) => {
      const client = getApiClient();
      const result = await client.post<Project>('/project/create', { project_name, project_slug, user_id });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
  server.tool(
    'project_get',
    'Get details of a specific project by its ID',
    {
      project_id: z.string().optional().describe('The unique ID of the project (uses MCP_PROJECT_ID env if not provided)'),
    },
    async ({ project_id }) => {
      try {
        const resolvedProjectId = getProjectId(project_id);
        const client = getApiClient();
        const result = await client.get<Project>(`/project/get/${resolvedProjectId}`);
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
    'project_list_by_payment_account',
    'Get list of all projects associated with a payment account',
    {
      payment_account_id: z.string().describe('The payment account ID'),
    },
    async ({ payment_account_id }) => {
      const client = getApiClient();
      const result = await client.get<Project[]>(`/project/get_list_by_payment_account/${payment_account_id}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
  server.tool(
    'project_update',
    'Update an existing project properties',
    {
      project_id: z.string().optional().describe('The unique ID of the project to update (uses MCP_PROJECT_ID env if not provided)'),
      project_name: z.string().optional().describe('New name for the project'),
      project_slug: z.string().optional().describe('New slug for the project'),
    },
    async ({ project_id, project_name, project_slug }) => {
      try {
        const resolvedProjectId = getProjectId(project_id);
        const client = getApiClient();
        const body: Record<string, unknown> = {};
        if (project_name) body.project_name = project_name;
        if (project_slug) body.project_slug = project_slug;
        const result = await client.put<Project>(`/project/update/${resolvedProjectId}`, body);
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
    'project_delete',
    'Delete a project and all its associated schemes. This action is irreversible!',
    {
      project_id: z.string().optional().describe('The unique ID of the project to delete (uses MCP_PROJECT_ID env if not provided)'),
    },
    async ({ project_id }) => {
      try {
        const resolvedProjectId = getProjectId(project_id);
        const client = getApiClient();
        const result = await client.delete(`/project/delete/${resolvedProjectId}`);
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
