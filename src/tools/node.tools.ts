import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getApiClient, getSchemeId } from '../api-client.js';
import type { Node } from '../types.js';

export const registerNodeTools = (server: McpServer) => {
  server.tool(
    'get_nodes_info',
    'Get information about available node types (trigger_types, action_types) and their configuration options. Call this first to see available types before creating nodes.',
    {},
    async () => {
      const client = getApiClient();
      const result = await client.get('/info/nodes_info');
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
  server.tool(
    'node_create_trigger',
    'Create a new trigger node in a scheme. Triggers start the execution of automation workflows. Call get_nodes_info first to see available types.',
    {
      scheme: z.string().optional().describe('The scheme ID where the trigger will be created (uses MCP_SCHEME_ID env if not provided)'),
      trigger_type: z.string().describe('Type of trigger (e.g., WEBHOOK, INTERVAL, CODE_ACTION)'),
      slug: z.string().optional().describe('URL-friendly identifier for the trigger'),
      description: z.string().optional().describe('Description of what this trigger does'),
    },
    async ({ scheme, trigger_type, slug, description }) => {
      try {
        const resolvedSchemeId = getSchemeId(scheme);
        const client = getApiClient();
        const body: Record<string, unknown> = { scheme: resolvedSchemeId, trigger_type };
        if (slug) body.slug = slug;
        if (description) body.description = description;
        const result = await client.post<Node>('/node/create/trigger', body);
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
    'node_create_action',
    'Create a new action node in a scheme. Actions perform operations like sending emails, making HTTP requests, etc. Call get_nodes_info first to see available types.',
    {
      scheme: z.string().optional().describe('The scheme ID where the action will be created (uses MCP_SCHEME_ID env if not provided)'),
      action_type: z.string().describe('Type of action (e.g., REQUEST, CONDITION, TG_BOT_MESSAGE_SEND, SET_CONTEXT_PARAM_DATA)'),
      slug: z.string().optional().describe('URL-friendly identifier for the action'),
      description: z.string().optional().describe('Description of what this action does'),
    },
    async ({ scheme, action_type, slug, description }) => {
      try {
        const resolvedSchemeId = getSchemeId(scheme);
        const client = getApiClient();
        const body: Record<string, unknown> = { scheme: resolvedSchemeId, action_type };
        if (slug) body.slug = slug;
        if (description) body.description = description;
        const result = await client.post<Node>('/node/create/action', body);
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
    'node_update',
    'Update an existing node properties',
    {
      node_id: z.string().describe('The unique ID of the node to update'),
      slug: z.string().optional().describe('New slug/identifier for the node'),
      description: z.string().optional().describe('New description'),
    },
    async ({ node_id, slug, description }) => {
      const client = getApiClient();
      const body: Record<string, unknown> = {};
      if (slug !== undefined) body.slug = slug;
      if (description !== undefined) body.description = description;
      const result = await client.put<Node>(`/node/update/${node_id}`, body);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
  server.tool(
    'node_connect',
    'Connect two nodes together to create an execution flow',
    {
      node_from: z.string().describe('The source node ID (execution flows from this node)'),
      node_to: z.string().describe('The target node ID (execution flows to this node)'),
      button_type: z.string().optional().describe('For condition nodes: specify which output to connect (e.g., "true", "false")'),
    },
    async ({ node_from, node_to, button_type }) => {
      const client = getApiClient();
      const body: Record<string, unknown> = { node_from, node_to };
      if (button_type) body.button_type = button_type;
      const result = await client.put('/node/connect_nodes', body);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
  server.tool(
    'node_disconnect',
    'Disconnect two nodes',
    {
      node_from: z.string().describe('The source node ID'),
      node_to: z.string().describe('The target node ID'),
    },
    async ({ node_from, node_to }) => {
      const client = getApiClient();
      const result = await client.put('/node/disconnect_nodes', { node_from, node_to });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
  server.tool(
    'node_find_existing_buttons',
    'Find existing output buttons/connections from a node',
    {
      node_id: z.string().describe('The node ID to find buttons for'),
    },
    async ({ node_id }) => {
      const client = getApiClient();
      const result = await client.get(`/node/find_existing_button_from/${node_id}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
  server.tool(
    'node_copy',
    'Create a copy of an existing node',
    {
      node_id: z.string().describe('The node ID to copy'),
    },
    async ({ node_id }) => {
      const client = getApiClient();
      const result = await client.post<Node>(`/node/copy_node_create/${node_id}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
  server.tool(
    'node_get_scheme_edges',
    'Get all connections (edges) between nodes in a scheme',
    {
      scheme_id: z.string().optional().describe('The scheme ID (uses MCP_SCHEME_ID env if not provided)'),
    },
    async ({ scheme_id }) => {
      try {
        const resolvedSchemeId = getSchemeId(scheme_id);
        const client = getApiClient();
        const result = await client.get(`/node/scheme_node_edges_list/${resolvedSchemeId}`);
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
    'node_get',
    'Get details of a specific node by its ID',
    {
      node_id: z.string().describe('The unique ID of the node'),
    },
    async ({ node_id }) => {
      const client = getApiClient();
      const result = await client.get<Node>(`/node/get/${node_id}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
  server.tool(
    'node_update_config',
    'Update the configuration of a node (e.g., email templates, HTTP request settings)',
    {
      node_id: z.string().describe('The unique ID of the node'),
      config: z.string().describe('JSON string of the new configuration object'),
    },
    async ({ node_id, config }) => {
      const client = getApiClient();
      let parsedConfig;
      try {
        parsedConfig = JSON.parse(config);
      } catch {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Invalid JSON in config' }, null, 2) }],
        };
      }
      const result = await client.put<Node>(`/node/update_config/${node_id}`, parsedConfig);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
  server.tool(
    'node_list_by_scheme',
    'Get list of all nodes in a scheme',
    {
      scheme_id: z.string().optional().describe('The scheme ID (uses MCP_SCHEME_ID env if not provided)'),
    },
    async ({ scheme_id }) => {
      try {
        const resolvedSchemeId = getSchemeId(scheme_id);
        const client = getApiClient();
        const result = await client.get<Node[]>(`/node/scheme_list/${resolvedSchemeId}`);
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
    'node_delete',
    'Delete a node from a scheme. This action is irreversible!',
    {
      node_id: z.string().describe('The unique ID of the node to delete'),
    },
    async ({ node_id }) => {
      const client = getApiClient();
      const result = await client.delete(`/node/delete/${node_id}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
};
