import type { ApiResponse } from './types.js';

const API_BASE_URL = (process.env.MCP_API_URL || 'https://api.nana800.io').replace(/\/+$/, '');
const API_KEY_HEADER = 'x-nana-api-key';
const REQUEST_TIMEOUT_MS = 30000;
const MAX_ERROR_TEXT_LENGTH = 2000;

const DEFAULT_PROJECT_ID = process.env.MCP_PROJECT_ID || '';
const DEFAULT_SCHEME_ID = process.env.MCP_SCHEME_ID || '';

export const getProjectId = (providedId?: string): string => {
  const id = providedId || DEFAULT_PROJECT_ID;
  if (!id) {
    throw new Error('project_id is required. Provide it as parameter or set MCP_PROJECT_ID env variable');
  }
  return id;
};

export const getSchemeId = (providedId?: string): string => {
  const id = providedId || DEFAULT_SCHEME_ID;
  if (!id) {
    throw new Error('scheme_id is required. Provide it as parameter or set MCP_SCHEME_ID env variable');
  }
  return id;
};

/**
 * Builds an API path and encodes every interpolated value as one path segment,
 * so an id like "../other" can not point the request to another endpoint
 */
export const apiPath = (strings: TemplateStringsArray, ...values: string[]): string => {
  return strings.reduce((path, part, index) => path + part + (index < values.length ? encodeURIComponent(values[index]) : ''), '');
};

type RequestOptions = {
  query?: Record<string, string | number | undefined>;
  body?: Record<string, unknown>;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.name === 'TimeoutError' || error.name === 'AbortError' ? `request timed out after ${REQUEST_TIMEOUT_MS / 1000}s` : error.message;
  }
  return 'Unknown error';
};

export class ApiClient {
  private apiKey: string;
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  get<T>(path: string, queryParams?: Record<string, string | number | undefined>): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, { query: queryParams });
  }
  post<T>(path: string, body?: Record<string, unknown>): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, { body });
  }
  put<T>(path: string, body?: Record<string, unknown>): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, { body });
  }
  delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, {});
  }
  private async request<T>(method: string, path: string, { query, body }: RequestOptions): Promise<ApiResponse<T>> {
    try {
      const url = new URL(`${API_BASE_URL}${path}`);
      if (query) {
        Object.entries(query).forEach(([key, value]) => {
          if (value !== undefined) {
            url.searchParams.append(key, String(value));
          }
        });
      }
      const response = await fetch(url.toString(), {
        method,
        headers: {
          [API_KEY_HEADER]: this.apiKey,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const text = await response.text();
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}: ${text.slice(0, MAX_ERROR_TEXT_LENGTH)}` };
      }
      if (!text) {
        return { success: true, data: null as T };
      }
      try {
        return { success: true, data: JSON.parse(text) as T };
      } catch {
        return { success: true, data: text as T };
      }
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }
}

let apiClientInstance: ApiClient | null = null;

export const getApiClient = (): ApiClient => {
  if (!apiClientInstance) {
    const apiKey = process.env.MCP_API_KEY;
    if (!apiKey) {
      throw new Error('MCP_API_KEY environment variable is not set');
    }
    apiClientInstance = new ApiClient(apiKey);
  }
  return apiClientInstance;
};
