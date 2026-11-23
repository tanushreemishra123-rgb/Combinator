import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { FormGrid } from "@/components/shared/FormGrid"
import { FormSection } from "@/components/shared/FormSection"

describe("FormGrid", () => {
  it.each([
    [2, ["grid-cols-1", "sm:grid-cols-2"], ["lg:grid-cols-3", "lg:grid-cols-4"]],
    [3, ["grid-cols-1", "sm:grid-cols-2", "lg:grid-cols-3"], ["lg:grid-cols-4"]],
    [4, ["grid-cols-1", "sm:grid-cols-2", "lg:grid-cols-4"], ["lg:grid-cols-3"]],
  ] as const)("stacks on a phone and opens to %i columns", (columns, present, absent) => {
    const { container } = render(
      <FormGrid columns={columns}>
        <span>field</span>
      </FormGrid>,
    )
    const grid = container.firstElementChild

    for (const className of present) expect(grid).toHaveClass(className)
    for (const className of absent) expect(grid).not.toHaveClass(className)
    expect(grid).toHaveClass("gap-4")
  })

  it("lets a long field opt out of the column width", () => {
    const { container } = render(
      <FormGrid columns={3} className="mt-2">
        <span className="sm:col-span-2">wide</span>
      </FormGrid>,
    )

    expect(container.firstElementChild).toHaveClass("mt-2")
    expect(screen.getByText("wide")).toHaveClass("sm:col-span-2")
  })
})

describe("FormSection", () => {
  it("groups its fields under a legend", () => {
    render(
      <FormSection title="Commercials" hint="Quoted in USD.">
        <span>field</span>
      </FormSection>,
    )

    expect(screen.getByRole("group", { name: /commercials/i })).toBeInTheDocument()
    expect(screen.getByText("Quoted in USD.")).toBeInTheDocument()
  })
})
