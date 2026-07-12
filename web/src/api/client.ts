/**
 * Shared API client primitives for Portfolium backend.
 */

// Use /api prefix so requests go through proxy (both dev and production)
// Vite dev proxy and nginx will forward /api/* to the backend
export const API_BASE_URL = '/api'

interface ApiError {
  detail: string | { errors: string[]; imported: number }
}

/** Error thrown for non-2xx API responses; carries the HTTP status so callers
 * can distinguish auth rejections from transient network failures. */
export class ApiRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

export function shouldInvalidateSession(error: unknown): boolean {
  return error instanceof ApiRequestError && (error.status === 401 || error.status === 403)
}

export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function getLanguageHeaders(): Record<string, string> {
  const language = localStorage.getItem('portfolium-language')
  return language ? { 'Accept-Language': language } : {}
}

export async function request<T>(
  endpoint: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...getLanguageHeaders(),
    ...options.headers,
  }

  const { timeout, signal: externalSignal, ...fetchOptions } = options
  const controller = new AbortController()
  let didTimeout = false
  const timeoutId = timeout
    ? setTimeout(() => {
        didTimeout = true
        controller.abort()
      }, timeout)
    : null
  const handleExternalAbort = () => controller.abort()

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort()
    } else {
      externalSignal.addEventListener('abort', handleExternalAbort, { once: true })
    }
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    })

    if (timeoutId) clearTimeout(timeoutId)

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        detail: 'An error occurred',
      }))
      throw new ApiRequestError(
        typeof error.detail === 'string'
          ? error.detail
          : JSON.stringify(error.detail),
        response.status
      )
    }

    // Handle 204 No Content responses (like DELETE operations)
    if (response.status === 204) {
      return undefined as T
    }

    return response.json()
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      if (didTimeout) {
        throw new Error('Request timeout - the operation took too long')
      }
      throw err
    }
    throw err
  } finally {
    externalSignal?.removeEventListener('abort', handleExternalAbort)
  }
}
