# nana800 MCP Server

MCP (Model Context Protocol) server for [nana800.io](https://nana800.io) Public API. This server enables AI-powered IDEs like Cursor, Claude Desktop, and VS Code to interact with your no-code automation projects.

## Installation

```bash
npm install -g nana800-mcp-server
# or
npx nana800-mcp-server
```

## Getting API Key

1. Go to [https://cloud.nana800.io/settings](https://cloud.nana800.io/settings)
2. Create or copy your API key
3. Use it in the configuration below

## Configuration

### Cursor IDE

Add to your `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "nana800": {
      "command": "npx",
      "args": ["nana800-mcp-server"],
      "env": {
        "MCP_API_KEY": "your_api_key_here",
        "MCP_PROJECT_ID": "your_default_project_id",
        "MCP_SCHEME_ID": "your_default_scheme_id",
        "MCP_ANALYTICS_ORG_ID": "your_default_analytics_org_id"
      }
    }
  }
}
```

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "nana800": {
      "command": "npx",
      "args": ["nana800-mcp-server"],
      "env": {
        "MCP_API_KEY": "your_api_key_here",
        "MCP_PROJECT_ID": "your_default_project_id",
        "MCP_SCHEME_ID": "your_default_scheme_id",
        "MCP_ANALYTICS_ORG_ID": "your_default_analytics_org_id"
      }
    }
  }
}
```

### VS Code with Cline/Continue

Add to your extension settings:

```json
{
  "mcpServers": {
    "nana800": {
      "command": "npx",
      "args": ["nana800-mcp-server"],
      "env": {
        "MCP_API_KEY": "your_api_key_here",
        "MCP_PROJECT_ID": "your_default_project_id",
        "MCP_SCHEME_ID": "your_default_scheme_id",
        "MCP_ANALYTICS_ORG_ID": "your_default_analytics_org_id"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MCP_API_KEY` | Yes | Your nana800.io API key |
| `MCP_PROJECT_ID` | No | Default project ID (can be overridden per tool call) |
| `MCP_SCHEME_ID` | No | Default scheme ID (can be overridden per tool call) |
| `MCP_API_URL` | No | API origin, `https://api.nana800.io` by default |
| `MCP_ANALYTICS_ORG_ID` | No | Default analytics org ID (can be overridden per tool call) |
| `MCP_ANALYTICS_API_URL` | No | Analytics API origin, `https://api.analytics.nana800.io` by default |

Every API request has a 30 second timeout. Requires Node.js 18 or newer.

## Available Tools

### Project Management

| Tool | Description |
|------|-------------|
| `project_create` | Create a new project |
| `project_get` | Get project details by ID |
| `project_list_by_payment_account` | List projects by payment account |
| `project_update` | Update project properties |
| `project_delete` | Delete a project |

### Scheme Management

| Tool | Description |
|------|-------------|
| `scheme_create` | Create a new scheme (workflow) |
| `scheme_get` | Get scheme details |
| `scheme_list_by_project` | List all schemes in a project |
| `scheme_update` | Update scheme name, description and enable or disable it |
| `scheme_delete` | Delete a scheme |
| `scheme_export` | Export scheme as JSON |
| `scheme_import` | Import nodes into a scheme |
| `scheme_get_context_type` | Get scheme context type |
| `scheme_get_swagger_json` | Get OpenAPI spec for scheme |

### Node Management

| Tool | Description |
|------|-------------|
| `get_nodes_info` | List available trigger and action types with their configuration |
| `node_create_trigger` | Create a trigger node |
| `node_create_action` | Create an action node |
| `node_get` | Get node details |
| `node_list_by_scheme` | List all nodes in a scheme |
| `node_update` | Update node properties |
| `node_update_config` | Update node configuration |
| `node_delete` | Delete a node |
| `node_connect` | Connect two nodes (for condition nodes `connection_index` 0 is the "true" output, 1 is the "false" output) |
| `node_disconnect` | Disconnect two nodes |
| `node_copy` | Copy a node |
| `node_get_scheme_edges` | Get all connections in a scheme |
| `node_find_existing_buttons` | Find node output buttons |

### Node Process Management

| Tool | Description |
|------|-------------|
| `node_process_get` | Get node process details |
| `node_process_list_filtered` | List node processes, filter by scheme, node or scheme process is required |
| `node_process_delete` | Delete a node process record |

### Scheme Process Management

| Tool | Description |
|------|-------------|
| `scheme_process_get` | Get scheme process details |
| `scheme_process_list_filtered` | List scheme processes, filter by scheme or project is required |
| `scheme_process_delete` | Delete a scheme process record |

### Payment Account Management

| Tool | Description |
|------|-------------|
| `payment_account_get_by_user` | Get payment account by user ID |
| `payment_account_get_by_project` | Get payment account by project ID |
| `payment_account_update` | Update payment account name and automatic balance refill |
| `payment_account_remove` | Remove payment account |
| `payment_account_get_transactions` | Get transaction history |

### Analytics Data Export

The API key user must be a member of the analytics org. Exports run in the background and the tools return only the status and a download link, never the rows.

| Tool | Description |
|------|-------------|
| `analytics_projects_list` | List app projects of an analytics org |
| `analytics_event_types_list` | List tracked event types of an app project, for export filters |
| `analytics_export_create` | Start an export of events (`EVENTS`), events of one user (`USER_EVENTS`) or users (`USERS`) to CSV or JSONL |
| `analytics_export_status` | Get export status (`QUEUED`, `RUNNING`, `DONE`, `FAILED`) and the download link when it is done |
| `analytics_exports_list` | List the 20 newest exports of an org |

Export limits:

- Up to 1,000,000 rows per file, `is_truncated` is `true` when more rows matched
- One active export per org, 10 exports per org per hour, exports started with an API key: one per 10 minutes per org
- Poll `analytics_export_status` not more often than once per ~10 seconds
- The download link is valid for 15 minutes, call `analytics_export_status` again for a fresh one
- Files are deleted after 7 days

The file is served gzipped (`Content-Encoding: gzip`). A browser saves plain CSV or JSONL, from a shell use:

```bash
curl --compressed -o export.csv "<download_url>"
```

## Usage Examples

Once configured, you can ask your AI assistant things like:

- "List all my projects"
- "Create a new scheme called 'Email Notifications' in project X"
- "Show me all nodes in scheme Y"
- "Connect the webhook trigger to the email action"
- "Export the scheme configuration"
- "What processes are currently running?"
- "Export all purchase events of the last week to CSV and give me the download link"

## API Documentation

Full API documentation available at: [https://api.nana800.io/public-api](https://api.nana800.io/public-api)

## License

MIT
