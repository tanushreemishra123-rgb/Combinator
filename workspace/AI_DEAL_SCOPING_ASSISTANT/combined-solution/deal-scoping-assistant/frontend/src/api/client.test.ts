import { afterEach, describe, expect, it, vi } from "vitest"
import { ApiError, api, buildUrl } from "@/api/client"

afterEach(() => {
  vi.unstubAllGlobals()
})

function respondWith(body: unknown, status: number, statusText: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        statusText,
        headers: { "content-type": "application/problem+json" },
      }),
    ),
  )
}

describe("api error handling", () => {
  it("builds an ApiError from an RFC 7807 problem document", async () => {
    respondWith(
      {
        type: "https://example.com/problems/validation",
        title: "Validation failed",
        detail: "The scope item could not be saved.",
        status: 422,
        errors: [{ field: "priority", message: "must be one of must, high, medium, low" }],
      },
      422,
      "Unprocessable Entity",
    )

    const error = await api.post("/sessions/1/scope/items", { title: "x" }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    const apiError = error as ApiError
    expect(apiError.status).toBe(422)
    expect(apiError.title).toBe("Validation failed")
    expect(apiError.detail).toBe("The scope item could not be saved.")
    expect(apiError.errors).toEqual([
      { field: "priority", message: "must be one of must, high, medium, low" },
    ])
    expect(apiError.message).toBe("The scope item could not be saved.")
  })

  it("normalizes a field-keyed errors object", async () => {
    respondWith({ title: "Bad request", errors: { name: ["is required"] } }, 400, "Bad Request")

    const apiError = (await api.get("/sessions").catch((e: unknown) => e)) as ApiError

    expect(apiError.errors).toEqual([{ field: "name", message: "is required" }])
  })

  it("falls back to the status text when the body is not a problem document", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("boom", { status: 500, statusText: "Server Error" })),
    )

    const apiError = (await api.get("/sessions").catch((e: unknown) => e)) as ApiError

    expect(apiError.status).toBe(500)
    expect(apiError.title).toBe("Server Error")
  })
})

describe("buildUrl", () => {
  it("resolves an app path against the configured API origin", () => {
    expect(buildUrl("/api/v1/sessions")).toBe("http://localhost:8000/api/v1/sessions")
  })

  it("appends the query and skips empty values", () => {
    expect(buildUrl("/api/v1/sessions", { limit: 10, cursor: null, open: true })).toBe(
      "http://localhost:8000/api/v1/sessions?limit=10&open=true",
    )
  })

  it.each(["https://evil.example/steal", "//evil.example/steal", "api/v1/sessions"])(
    "refuses %s, which is not a relative API path",
    (path) => {
      expect(() => buildUrl(path)).toThrow(ApiError)
      expect(() => buildUrl(path)).toThrow(/not a relative API path/)
    },
  )

  it("keeps a traversal attempt inside the configured origin", () => {
    expect(buildUrl("/../api/v1/health")).toBe("http://localhost:8000/api/v1/health")
  })
})
