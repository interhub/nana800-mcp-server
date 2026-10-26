import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiPath, getAnalyticsApiClient, getAnalyticsOrgId } from '../api-client.js';
import type { AnalyticsAppProject, AnalyticsEventType, AnalyticsExportJob, AnalyticsExportWithDownloadUrl } from '../types.js';

const MAX_EVENT_TYPE_FILTERS = 20;
const MAX_CONDITIONS_PER_FILTER = 20;
const MAX_CONDITION_VALUES = 50;
const MAX_CONDITION_VALUE_LENGTH = 200;

const EXPORT_FLOW_HINT =
  'The export runs in the background: export_status goes QUEUED -> RUNNING -> DONE or FAILED. ' +
  'Poll analytics_export_status until DONE or FAILED, not more often than once per ~10 seconds. ' +
  'When DONE, download_url is a direct link valid for 15 minutes (call analytics_export_status again for a fresh one). ' +
  'The file is served gzipped with Content-Encoding: gzip: a browser saves plain CSV or JSONL, from a shell use curl --compressed -o file.csv "<download_url>". ' +
  'Files are deleted 7 days after creation. No rows are returned through MCP, only the status and the link.';

const conditionSchema = z.object({
  param_name: z.string().max(MAX_CONDITION_VALUE_LENGTH).describe('Property name'),
  param_values: z
    .array(z.string().max(MAX_CONDITION_VALUE_LENGTH))
    .max(MAX_CONDITION_VALUES)
    .describe('Values to compare with. EQUAL and CONTAINS match any of the values, NOT_EQUAL and NOT_CONTAINS match none of them, GREATER_THAN and LESS_THAN use the first value as a number, IS_SET and IS_NOT_SET ignore the values (pass [])'),
  condition: z
    .enum(['EQUAL', 'NOT_EQUAL', 'CONTAINS', 'NOT_CONTAINS', 'GREATER_THAN', 'LESS_THAN', 'IS_SET', 'IS_NOT_SET'])
    .optional()
    .describe('Comparison, EQUAL by default'),
});

const eventTypeFilterSchema = z.object({
  event_type_id: z.string().describe('Event type ID from analytics_event_types_list'),
  event_properties: z.array(conditionSchema).max(MAX_CONDITIONS_PER_FILTER).optional().describe('Conditions on event properties, all of them must match'),
});

const userFilterSchema = z.object({
  analytics_user_ids: z.array(z.string()).optional().describe('Analytics user IDs (_id or custom_user_id)'),
  user_properties: z.array(conditionSchema).max(MAX_CONDITIONS_PER_FILTER).optional().describe('Conditions on user properties, all of them must match'),
  user_performed_event_filters: z
    .array(eventTypeFilterSchema)
    .max(MAX_EVENT_TYPE_FILTERS)
    .optional()
    .describe('Only users who performed any of these events'),
});

type UserFilter = z.infer<typeof userFilterSchema>;

const pickUserFilter = (userFilter: UserFilter): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  if (userFilter.analytics_user_ids !== undefined) result.analytics_user_ids = userFilter.analytics_user_ids;
  if (userFilter.user_properties !== undefined) result.user_properties = userFilter.user_properties;
  if (userFilter.user_performed_event_filters !== undefined) result.user_performed_event_filters = userFilter.user_performed_event_filters;
  return result;
};

export const registerAnalyticsExportTools = (server: McpServer) => {
  server.tool(
    'analytics_projects_list',
    'List app projects of an analytics org. Use the project _id as app_project_id in analytics_event_types_list and analytics_export_create',
    {
      org_id: z.string().optional().describe('The analytics org ID (uses MCP_ANALYTICS_ORG_ID env if not provided)'),
    },
    async ({ org_id }) => {
      try {
        const resolvedOrgId = getAnalyticsOrgId(org_id);
        const client = getAnalyticsApiClient();
        const result = await client.get<AnalyticsAppProject[]>(apiPath`/analytics_app_projects/get_projects_by_org/${resolvedOrgId}`);
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
    'analytics_event_types_list',
    'List tracked event types of an analytics app project. Use the event type _id as event_type_id in analytics_export_create filters',
    {
      app_project_id: z.string().describe('The analytics app project ID from analytics_projects_list'),
    },
    async ({ app_project_id }) => {
      const client = getAnalyticsApiClient();
      const result = await client.get<AnalyticsEventType[]>(apiPath`/analytics_event_types/get_event_types_by_app_project/${app_project_id}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
  server.tool(
    'analytics_export_create',
    'Start a file export of analytics data: EVENTS (events of the org or project), USER_EVENTS (events of one user, user_filter.analytics_user_ids must have exactly one ID) or USERS (users with their properties). ' +
      'Up to 1,000,000 rows per file, is_truncated is true when more rows matched. ' +
      'Limits per org: one active export at a time (HTTP 409 analytics_export_already_running), 10 exports per hour (HTTP 429 analytics_export_hourly_limit), exports started with an API key: one per 10 minutes (HTTP 429 analytics_export_api_key_interval). ' +
      'HTTP 400 analytics_export_invalid_filter means the filter does not fit the export kind, HTTP 403 means the API key user is not a member of the org. ' +
      EXPORT_FLOW_HINT,
    {
      org_id: z.string().optional().describe('The analytics org ID (uses MCP_ANALYTICS_ORG_ID env if not provided)'),
      app_project_id: z.string().optional().describe('The analytics app project ID, all projects of the org if not provided'),
      export_kind: z.enum(['EVENTS', 'USER_EVENTS', 'USERS']).describe('What to export'),
      file_format: z.enum(['CSV', 'JSONL']).optional().describe('File format, CSV by default. JSONL is one JSON object per line'),
      csv_delimiter: z.enum([',', ';']).optional().describe('CSV column delimiter, comma by default'),
      time_from: z.string().optional().describe('EVENTS and USER_EVENTS only: events from this time, ISO 8601 (e.g. 2026-10-01T00:00:00.000Z)'),
      time_to: z.string().optional().describe('EVENTS and USER_EVENTS only: events up to this time, ISO 8601'),
      event_types_filter: z
        .array(eventTypeFilterSchema)
        .max(MAX_EVENT_TYPE_FILTERS)
        .optional()
        .describe('EVENTS and USER_EVENTS only: events of any of these types, each type with its own property conditions. All event types if not provided'),
      user_filter: userFilterSchema
        .optional()
        .describe('For EVENTS: only events of the matching users. For USER_EVENTS: required, analytics_user_ids with exactly one user ID. For USERS: which users to export, all users if not provided'),
    },
    async ({ org_id, app_project_id, export_kind, file_format, csv_delimiter, time_from, time_to, event_types_filter, user_filter }) => {
      try {
        const resolvedOrgId = getAnalyticsOrgId(org_id);
        if (export_kind === 'USERS' && (time_from || time_to || event_types_filter)) {
          throw new Error('time_from, time_to and event_types_filter work only for EVENTS and USER_EVENTS exports. For USERS use user_filter.user_performed_event_filters');
        }
        if (export_kind === 'USER_EVENTS' && user_filter?.analytics_user_ids?.length !== 1) {
          throw new Error('USER_EVENTS export needs user_filter.analytics_user_ids with exactly one user ID');
        }
        const scope: Record<string, unknown> = { org_id: resolvedOrgId };
        if (app_project_id) scope.app_project_id = app_project_id;
        const body: Record<string, unknown> = { ...scope, export_kind };
        if (file_format) body.file_format = file_format;
        if (csv_delimiter) body.csv_delimiter = csv_delimiter;
        if (export_kind === 'USERS') {
          body.users_filter = { ...scope, ...(user_filter ? pickUserFilter(user_filter) : {}) };
        } else {
          const eventsFilter: Record<string, unknown> = { ...scope };
          if (time_from) eventsFilter.time_from = time_from;
          if (time_to) eventsFilter.time_to = time_to;
          if (event_types_filter) eventsFilter.event_types_filter = event_types_filter;
          if (user_filter) eventsFilter.user_filter = { org_id: resolvedOrgId, ...pickUserFilter(user_filter) };
          body.events_filter = eventsFilter;
        }
        const client = getAnalyticsApiClient();
        const result = await client.post<AnalyticsExportJob>('/analytics_exports/create_export', body);
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
    'analytics_export_status',
    'Get the status of an analytics export and its download link. Returns export_job (export_status, rows_count, is_truncated, file_name, file_size_bytes, error_text, expires_time), download_url and download_url_expires_time. download_url is null until export_status is DONE. ' +
      EXPORT_FLOW_HINT,
    {
      export_id: z.string().describe('The export ID (_id returned by analytics_export_create)'),
    },
    async ({ export_id }) => {
      const client = getAnalyticsApiClient();
      const result = await client.get<AnalyticsExportWithDownloadUrl>(apiPath`/analytics_exports/get_export/${export_id}`);
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
  server.tool(
    'analytics_exports_list',
    'List the 20 newest analytics exports of an org, newest first, without download links. Call analytics_export_status with an export _id to get its download link',
    {
      org_id: z.string().optional().describe('The analytics org ID (uses MCP_ANALYTICS_ORG_ID env if not provided)'),
      app_project_id: z.string().optional().describe('Only exports of this analytics app project'),
    },
    async ({ org_id, app_project_id }) => {
      try {
        const resolvedOrgId = getAnalyticsOrgId(org_id);
        const client = getAnalyticsApiClient();
        const result = await client.get<AnalyticsExportJob[]>(apiPath`/analytics_exports/get_exports_list/${resolvedOrgId}`, { app_project_id });
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
