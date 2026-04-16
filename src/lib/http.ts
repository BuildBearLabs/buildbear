import { getApiKey } from './config.js';

export const API_BASE = 'https://api.buildbear.io';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean; // default: true
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {}, auth = true } = options;

  const reqHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...headers,
  };

  if (auth) {
    reqHeaders['Authorization'] = `Bearer ${getApiKey()}`;
  }

  if (body !== undefined) {
    reqHeaders['Content-Type'] = 'application/json';
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: reqHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new Error('Request timed out. Check your connection.');
    }
    throw new Error(`Network error: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!response.ok) {
    let message: string;
    try {
      const errBody = await response.json() as { message?: string; error?: string };
      message = errBody.message ?? errBody.error ?? response.statusText;
    } catch {
      message = response.statusText;
    }

    if (response.status === 401) {
      throw new ApiError(401, `Authentication failed (401). Run 'buildbear auth setup' to reconfigure.`);
    }
    if (response.status === 404) {
      throw new ApiError(404, `Not found (404): ${message}`);
    }
    throw new ApiError(response.status, `Request failed (${response.status}): ${message}`);
  }

  // Some endpoints return plain text (e.g. "Node deleted successfully")
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    return text as unknown as T;
  }

  return response.json() as Promise<T>;
}

export async function rpcRequest<T>(
  rpcUrl: string,
  method: string,
  params: unknown[] = []
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new Error('Request timed out. Check your connection.');
    }
    throw new Error(`Network error: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!response.ok) {
    throw new ApiError(response.status, `RPC request failed (${response.status}): ${response.statusText}`);
  }

  const result = await response.json() as { result?: T; error?: { message: string } };

  if (result.error) {
    throw new Error(`RPC error: ${result.error.message}`);
  }

  return result.result as T;
}
