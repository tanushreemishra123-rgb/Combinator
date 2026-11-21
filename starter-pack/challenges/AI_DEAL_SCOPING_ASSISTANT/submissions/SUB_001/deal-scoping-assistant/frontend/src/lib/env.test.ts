import { describe, expect, it } from "vitest"
import { parseEnv } from "@/lib/env"

describe("parseEnv", () => {
  it("explains what is wrong when the base URL is not a URL", () => {
    expect(() => parseEnv({ VITE_API_BASE_URL: "localhost:8000" })).toThrow(
      /VITE_API_BASE_URL must be an absolute http\(s\) URL/,
    )
  })

  it("explains what is wrong when the base URL is missing", () => {
    expect(() => parseEnv({})).toThrow(/Invalid frontend environment/)
  })

  it("drops the trailing slash so request paths can start with a slash", () => {
    expect(parseEnv({ VITE_API_BASE_URL: "http://localhost:8000/" })).toEqual({
      VITE_API_BASE_URL: "http://localhost:8000",
    })
  })
})
