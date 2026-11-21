import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SourceQuote } from "@/components/shared/SourceQuote"

const TEXT = "The portal must support 5,000 concurrent users during renewal season."

describe("SourceQuote", () => {
  it("highlights exactly the quoted range and keeps the rest of the segment", () => {
    const quote = "support 5,000 concurrent users"
    const start = TEXT.indexOf(quote)

    const { container } = render(
      <SourceQuote text={TEXT} start={start} end={start + quote.length} />,
    )

    const marks = container.querySelectorAll("mark")
    expect(marks).toHaveLength(1)
    expect(marks[0].textContent).toBe(quote)
    expect(container.textContent).toBe(TEXT)
  })

  it("clamps offsets that fall outside the segment", () => {
    const { container } = render(<SourceQuote text={TEXT} start={-5} end={TEXT.length + 99} />)

    expect(container.querySelector("mark")?.textContent).toBe(TEXT)
  })

  it("renders no highlight for an empty range", () => {
    const { container } = render(<SourceQuote text={TEXT} start={4} end={4} />)

    expect(container.querySelector("mark")).toBeNull()
    expect(container.textContent).toBe(TEXT)
  })
})
