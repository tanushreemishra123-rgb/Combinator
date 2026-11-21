import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ScopeItemSheet } from "@/components/requirements/ScopeItemSheet"
import { makeScopeItem, makeScopeView, makeSourceRef } from "@/test/factories"
import { TestProviders } from "@/test/TestProviders"
import type { SourceDocument } from "@/api/types"

const NORMALIZED = "Policy overview.\nCustomers must renew a policy online without calling us.\n"
const SEGMENT_TEXT = "Customers must renew a policy online without calling us."
const SEGMENT_START = NORMALIZED.indexOf(SEGMENT_TEXT)
const QUOTE = "renew a policy online"

const document: SourceDocument = {
  id: "doc-1",
  session_id: "session-1",
  name: "Discovery notes",
  kind: "pasted",
  format: "md",
  normalized_text: NORMALIZED,
  segments: [
    {
      segment_id: "D1.S2",
      kind: "paragraph",
      index: 1,
      page: null,
      heading: "Policy overview",
      text: SEGMENT_TEXT,
      start: SEGMENT_START,
      end: SEGMENT_START + SEGMENT_TEXT.length,
    },
  ],
  created_at: "2026-09-17T10:00:00Z",
}

vi.mock("@/api/hooks/documents", () => ({
  useDocument: () => ({ data: document, isPending: false, isError: false, error: null }),
}))

vi.mock("@/api/hooks/scope", () => ({
  useDeleteScopeItem: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateScopeItem: () => ({ mutateAsync: vi.fn(), isError: false, error: null }),
}))

const quoteStart = NORMALIZED.indexOf(QUOTE)

function renderSheet(verified: boolean) {
  const item = makeScopeItem({
    id: "FR_01",
    title: "Self-service renewals",
    source_refs: [
      makeSourceRef({
        quote: QUOTE,
        start: quoteStart,
        end: quoteStart + QUOTE.length,
        verified,
      }),
    ],
  })
  return render(
    <ScopeItemSheet
      sessionId="session-1"
      item={item}
      scope={makeScopeView([item])}
      readOnly={false}
      onOpenChange={vi.fn()}
    />,
    { wrapper: TestProviders },
  )
}

describe("ScopeItemSheet", () => {
  it("highlights exactly the quoted range inside the segment", () => {
    renderSheet(true)

    const marks = screen.getAllByText(QUOTE, { selector: "mark" })
    expect(marks).toHaveLength(1)
    expect(marks[0].parentElement).toHaveTextContent(SEGMENT_TEXT)
    expect(screen.getByLabelText("Quote verified against the source text")).toBeInTheDocument()
  })

  it("flags a quote that was not matched against the source", () => {
    renderSheet(false)

    expect(screen.getByLabelText("Quote not verified against the source text")).toBeInTheDocument()
    expect(screen.getByText("Unverified quote")).toBeInTheDocument()
  })
})
