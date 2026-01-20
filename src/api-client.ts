import type { ApiResponse } from './types.js';

const API_BASE_URL = 'https://api.nana800.io';
const API_KEY_HEADER = 'x-nana-api-key';

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

export class ApiClient {
  private apiKey: string;
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  async get<T>(path: string, queryParams?: Record<string, string | number | undefined>): Promise<ApiResponse<T>> {
    try {
      const url = new URL(`${API_BASE_URL}${path}`);
      if (queryParams) {
        Object.entries(queryParams).forEach(([key, value]) => {
          if (value !== undefined) {
            url.searchParams.append(key, String(value));
          }
        });
      }
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          [API_KEY_HEADER]: this.apiKey,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }
      const data = await response.json() as T;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  async post<T>(path: string, body?: Record<string, unknown>): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
          [API_KEY_HEADER]: this.apiKey,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }
      const data = await response.json() as T;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  async put<T>(path: string, body?: Record<string, unknown>): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'PUT',
        headers: {
          [API_KEY_HEADER]: this.apiKey,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }
      const data = await response.json() as T;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  async delete<T>(path: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'DELETE',
        headers: {
          [API_KEY_HEADER]: this.apiKey,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errorText}` };
      }
      const data = await response.json() as T;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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
