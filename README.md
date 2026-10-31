# nana800 MCP Server

[![npm](https://img.shields.io/npm/v/nana800-mcp-server)](https://www.npmjs.com/package/nana800-mcp-server)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Model Context Protocol (MCP) server for [nana800.io](https://nana800.io/en/), a no-code platform for backend logic and workflow automation. Workflows (called schemes) are built from trigger and action blocks (called nodes) in a visual editor: webhooks, timers, HTTP requests, Telegram, Google Sheets, GPT and other integrations.

With this server an AI assistant (Claude, Cursor, VS Code and any other MCP client) works with your nana800 account through the Public API:

- 🧱 creates projects and schemes, adds trigger and action blocks, configures and connects them
- 📤 exports and imports schemes as JSON, reads the OpenAPI document of scheme webhooks
- 🔍 reads the run history of schemes and of single blocks
- 💳 reads the payment account and its transactions
- 📊 exports analytics events and users to CSV or JSON Lines files

The server runs on your machine over stdio and calls `https://api.nana800.io` and `https://api.analytics.nana800.io` with your API key. 44 tools, Node.js 18 or newer.

## 🔑 Get an API key

1. Sign in at [cloud.nana800.io](https://cloud.nana800.io)
2. Open [cloud.nana800.io/settings](https://cloud.nana800.io/settings) and create or copy an API key
3. Put it into `MCP_API_KEY` in the client config below

The key acts as your user: the tools see and change only the projects your account has access to.

## 🚀 Quick start

### Claude Desktop

Open Settings -> Developer -> Edit Config, or the file directly:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "nana800": {
      "command": "npx",
      "args": ["-y", "nana800-mcp-server"],
      "env": {
        "MCP_API_KEY": "your_api_key"
      }
    }
  }
}
```

Restart Claude Desktop after saving.

### Claude Code

```bash
claude mcp add nana800 -e MCP_API_KEY=your_api_key -- npx -y nana800-mcp-server
```

Add `--scope user` to use it in all your projects.

### Cursor

Add to `~/.cursor/mcp.json` (all projects) or `.cursor/mcp.json` (one project):

```json
{
  "mcpServers": {
    "nana800": {
      "command": "npx",
      "args": ["-y", "nana800-mcp-server"],
      "env": {
        "MCP_API_KEY": "your_api_key"
      }
    }
  }
}
```

### VS Code

Add to `.vscode/mcp.json`. VS Code asks for the key on the first start and keeps it in its secret storage:

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "nana800-api-key",
      "description": "nana800.io API key",
      "password": true
    }
  ],
  "servers": {
    "nana800": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "nana800-mcp-server"],
      "env": {
        "MCP_API_KEY": "${input:nana800-api-key}"
      }
    }
  }
}
```

### Other clients

Any MCP client that starts stdio servers works with the same command:

```bash
MCP_API_KEY=your_api_key npx -y nana800-mcp-server
```

## ⚙️ Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MCP_API_KEY` | Yes | Your nana800.io API key from [cloud.nana800.io/settings](https://cloud.nana800.io/settings). The server stops with an error without it |
| `MCP_PROJECT_ID` | No | Default project ID for tools with an optional `project_id` |
| `MCP_SCHEME_ID` | No | Default scheme ID for tools with an optional `scheme_id` or `scheme` |
| `MCP_ANALYTICS_ORG_ID` | No | Default analytics org ID for tools with an optional `org_id`. Get it with `analytics_orgs_list` or from the `org` parameter of the analytics page URL |
| `MCP_API_URL` | No | API origin, `https://api.nana800.io` by default |
| `MCP_ANALYTICS_API_URL` | No | Analytics API origin, `https://api.analytics.nana800.io` by default |

An ID passed in a tool call always wins over the default. Every API request has a 30 second timeout.

## 🧰 Tools

### Projects

| Tool | What it does |
|------|--------------|
| `project_create` | Create a project, a container for schemes |
| `project_get` | Get a project by ID |
| `project_list_by_payment_account` | List projects of a payment account |
| `project_update` | Change project name or slug |
| `project_delete` | Delete a project with all its schemes (irreversible) |

### Schemes (workflows)

| Tool | What it does |
|------|--------------|
| `scheme_create` | Create a scheme in a project |
| `scheme_get` | Get a scheme by ID |
| `scheme_list_by_project` | List schemes of a project |
| `scheme_update` | Change name and description, enable or disable a scheme |
| `scheme_get_context_type` | Get the data type of the scheme context |
| `scheme_get_swagger_json` | Get the OpenAPI 3 document of the scheme webhooks: paths, methods, fields the blocks read, answers, and webhooks that get no requests with the reason |
| `scheme_export` | Export scheme nodes and connections as JSON |
| `scheme_import` | Import nodes into a scheme from exported JSON |
| `scheme_delete` | Delete a scheme with all its nodes (irreversible) |

### Nodes (blocks)

| Tool | What it does |
|------|--------------|
| `get_nodes_info` | List available trigger and action types with their config options, call it before creating nodes |
| `node_create_trigger` | Create a trigger node (for example `WEBHOOK`, `INTERVAL`) |
| `node_create_action` | Create an action node (HTTP request, email, integrations) |
| `node_get` | Get a node by ID |
| `node_list_by_scheme` | List nodes of a scheme |
| `node_update` | Change node slug or description |
| `node_update_config` | Change node configuration |
| `node_connect` | Connect two nodes, for condition nodes `connection_index` 0 is the "true" output and 1 is the "false" output |
| `node_disconnect` | Remove a connection between two nodes |
| `node_get_scheme_edges` | List all connections of a scheme |
| `node_find_existing_buttons` | List existing outputs of a node |
| `node_copy` | Copy a node |
| `node_delete` | Delete a node (irreversible) |

### Run history

| Tool | What it does |
|------|--------------|
| `scheme_process_get` | Get one scheme run |
| `scheme_process_list_filtered` | List scheme runs by scheme or project, with status filters and pages |
| `scheme_process_delete` | Delete a scheme run record |
| `node_process_get` | Get one node run |
| `node_process_list_filtered` | List node runs by scheme, node or scheme run, with status filters and pages |
| `node_process_delete` | Delete a node run record |

### Payment account

| Tool | What it does |
|------|--------------|
| `payment_account_get_by_user` | Get the payment account of a user |
| `payment_account_get_by_project` | Get the payment account of a project |
| `payment_account_update` | Change account name and automatic balance refill |
| `payment_account_get_transactions` | Get the transaction history |
| `payment_account_remove` | Remove the payment account from a user |

### Analytics data export

| Tool | What it does |
|------|--------------|
| `analytics_orgs_list` | List analytics orgs the API key owner is a member of |
| `analytics_projects_list` | List app projects of an analytics org |
| `analytics_event_types_list` | List tracked event types of an app project, for export filters |
| `analytics_export_create` | Start an export of events (`EVENTS`), events of one user (`USER_EVENTS`) or users (`USERS`) to CSV or JSONL |
| `analytics_export_status` | Get export status (`QUEUED`, `RUNNING`, `DONE`, `FAILED`) and the download link when it is done |
| `analytics_exports_list` | List the 20 newest exports of an org |

The API key user must be a member of the analytics org. Exports run in the background and the tools return only the status and a download link, never the rows.

Export limits:

- Up to 1,000,000 rows per file, `is_truncated` is `true` when more rows matched
- One active export per org, 10 exports per org per hour, exports started with an API key: one per 10 minutes per org
- `time_from` and `time_to` are ISO 8601 date-times with a timezone, for example `2026-10-01T00:00:00.000Z`
- Poll `analytics_export_status` not more often than once per ~10 seconds
- The download link is valid for 15 minutes, call `analytics_export_status` again for a fresh one
- Files are deleted after 7 days

The file is served gzipped (`Content-Encoding: gzip`). A browser saves plain CSV or JSONL, from a shell use:

```bash
curl --compressed -o export.csv "<download_url>"
```

⚠️ Delete and remove tools can not be undone. Keep tool call confirmation on in your MCP client for them.

## 💬 Example prompts

- "List the schemes of my project and tell me which ones are disabled"
- "Create a scheme 'Lead to Telegram': a webhook trigger that sends the request body to my Telegram chat"
- "Show the nodes of scheme X and how they are connected"
- "Why did the last runs of scheme X fail? Look at the node runs"
- "Give me the OpenAPI document of scheme X and list the webhooks that get no requests"
- "Export scheme X as JSON and import its nodes into scheme Y"
- "Show the last transactions of my payment account"
- "Export all purchase events of the last week to CSV and give me the download link"

## 🔗 Links

- Website: [nana800.io](https://nana800.io/en/)
- Web app: [cloud.nana800.io](https://cloud.nana800.io)
- Documentation: [nana800.gitbook.io/doc](https://nana800.gitbook.io/doc)
- Public API reference: [api.nana800.io/public-api](https://api.nana800.io/public-api)
- Privacy policy: [nana800_privacy.pdf](https://docs.nana800.io/nana800-files/service_documents/nana800_privacy.pdf)
- Telegram: [t.me/nana800_io](https://t.me/nana800_io)

## 🇷🇺 На русском

**nana800-mcp-server** - MCP-сервер для [nana800.io](https://nana800.io), no-code платформы для серверной логики и автоматизации. Через него ИИ-ассистент (Claude, Cursor, VS Code) создаёт проекты и схемы, добавляет и связывает блоки, смотрит историю запусков, данные платёжного аккаунта и выгружает аналитику в CSV или JSON Lines.

- 🔑 Ключ API: [cloud.nana800.io/settings](https://cloud.nana800.io/settings), его нужно передать в переменной `MCP_API_KEY`
- 🚀 Запуск: `npx -y nana800-mcp-server`, готовые настройки для клиентов выше в разделе Quick start
- 🖥️ Сервер работает на вашем компьютере и ходит в API nana800 от имени владельца ключа
- ⚠️ Инструменты удаления (`project_delete`, `scheme_delete`, `node_delete` и другие) необратимы
- 📚 Документация: [nana800.gitbook.io/doc](https://nana800.gitbook.io/doc)

## License

MIT
