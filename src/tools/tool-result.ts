import type { ApiResponse } from '../types.js';

export const toolResult = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data) }],
});

export const toolError = (error: unknown) =>
  toolResult({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });

/**
 * Returns the data of a successful API response or throws with the API error, so a tool can stop at the first failed request.
 */
export const unwrap = <T>(response: ApiResponse<T>, action: string): T => {
  if (!response.success) {
    throw new Error(`${action} failed: ${response.error || 'unknown error'}`);
  }
  return response.data as T;
};
