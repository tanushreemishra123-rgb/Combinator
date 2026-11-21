import { z } from "zod"
import { env } from "@/lib/env"

export interface FieldError {
  field?: string
  message: string
}

// RFC 7807 problem details, as returned by the backend for every error.
const problemSchema = z.object({
  type: z.string().optional(),
  title: z.string().optional(),
  detail: z.string().optional(),
  status: z.number().optional(),
  errors: z
    .union([
      z.array(z.object({ field: z.string().optional(), message: z.string() })),
      z.record(z.string(), z.array(z.string())),
    ])
    .optional(),
})

type Problem = z.infer<typeof problemSchema>

function normalizeErrors(errors: Problem["errors"]): FieldError[] {
  if (!errors) return []
  if (Array.isArray(errors)) return errors
  return Object.entries(errors).flatMap(([field, messages]) =>
    messages.map((message) => ({ field, message })),
  )
}

export class ApiError extends Error {
  readonly status: number
  readonly title: string
  readonly detail?: string
  readonly errors: FieldError[]

  constructor(status: number, title: string, detail?: string, errors: FieldError[] = []) {
    super(detail ?? title)
    this.name = "ApiError"
    this.status = status
    this.title = title
    this.detail = detail
    this.errors = errors
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const fallbackTitle = response.statusText || `Request failed (${response.status})`
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return new ApiError(response.status, fallbackTitle)
  }
  const parsed = problemSchema.safeParse(body)
  if (!parsed.success) return new ApiError(response.status, fallbackTitle)
  const problem = parsed.data
  return new ApiError(
    problem.status ?? response.status,
    problem.title ?? fallbackTitle,
    problem.detail,
    normalizeErrors(problem.errors),
  )
}

type QueryValue = string | number | boolean | null | undefined

export interface RequestOptions {
  query?: Record<string, QueryValue>
  headers?: Record<string, string>
  signal?: AbortSignal
}

/**
 * Every request goes to the configured API origin. The path is resolved against that base
 * and must be a plain absolute path, so no caller can redirect a request to another host.
 */
export function buildUrl(path: string, query?: RequestOptions["query"]): string {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new ApiError(0, "Invalid request", `"${path}" is not a relative API path.`)
  }
  const url = new URL(`${env.VITE_API_BASE_URL}${path}`)
  if (url.origin !== new URL(env.VITE_API_BASE_URL).origin) {
    throw new ApiError(0, "Invalid request", `"${path}" would leave the configured API origin.`)
  }
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.append(key, String(value))
  }
  return url.toString()
}

// FormData bodies are sent as-is so the browser sets the multipart boundary.
function buildInit(
  method: string,
  body: unknown,
  options: RequestOptions,
  accept: string,
): RequestInit {
  const isForm = body instanceof FormData
  const hasJsonBody = body !== undefined && !isForm
  return {
    method,
    headers: {
      Accept: accept,
      ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    body: isForm ? body : hasJsonBody ? JSON.stringify(body) : undefined,
    signal: options.signal,
  }
}

async function send(
  method: string,
  path: string,
  body: unknown,
  options: RequestOptions,
  accept: string,
): Promise<Response> {
  let response: Response
  try {
    // buildUrl pins every request to the configured API origin and rejects anything that is
    // not a relative app path, so no caller can choose the host this talks to.
    // nosemgrep: gitlab.nodejs_scan.javascript-ssrf-rule-node_ssrf -- browser fetch to the app's own configured API origin, not a server-side request
    response = await fetch(buildUrl(path, options.query), buildInit(method, body, options, accept))
  } catch {
    // A network or CORS failure never reaches the server, so there is no problem document.
    throw new ApiError(0, "Network error", "The API could not be reached. Is the backend running?")
  }
  if (!response.ok) throw await toApiError(response)
  return response
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const response = await send(method, path, body, options, "application/json")
  if (response.status === 204) return undefined as T
  const text = await response.text()
  return text ? (JSON.parse(text) as T) : (undefined as T)
}

export interface DownloadedFile {
  blob: Blob
  filename: string
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (encoded) return decodeURIComponent(encoded[1])
  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain ? plain[1] : fallback
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, body, options),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, undefined, options),
  // Exports return a binary body plus a server-chosen filename.
  download: async (
    method: string,
    path: string,
    body?: unknown,
    options: RequestOptions & { fallbackFilename?: string } = {},
  ): Promise<DownloadedFile> => {
    const response = await send(method, path, body, options, "*/*")
    return {
      blob: await response.blob(),
      filename: filenameFromDisposition(
        response.headers.get("content-disposition"),
        options.fallbackFilename ?? "download",
      ),
    }
  },
}
