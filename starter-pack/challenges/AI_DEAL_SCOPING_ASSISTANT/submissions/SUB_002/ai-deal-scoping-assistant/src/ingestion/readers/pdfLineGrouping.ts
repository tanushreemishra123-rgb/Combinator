/**
 * Pure line-reconstruction logic for extracted PDF text items, kept separate from `pdfReader.ts`
 * so it can be unit-tested with hand-built items instead of a real PDF.
 */
export interface PositionedTextItem {
  text: string;
  /** Horizontal position in PDF user space (points from the page's left edge). */
  x: number;
  /** Vertical position in PDF user space (points from the page's bottom edge - larger is higher up). */
  y: number;
}

/** Items within this many points of vertical distance are treated as the same visual line. */
const Y_COORDINATE_TOLERANCE = 2;

interface LineGroup {
  y: number;
  items: PositionedTextItem[];
}

/**
 * Reconstructs reading-order lines from a page's positioned text items: top-to-bottom by `y`,
 * left-to-right by `x` within each line band.
 */
export function groupTextItemsIntoLines(items: readonly PositionedTextItem[]): string[] {
  if (items.length === 0) {
    return [];
  }
  const sorted = [...items].sort((a, b) => (a.y === b.y ? a.x - b.x : b.y - a.y));
  const groups: LineGroup[] = [];
  for (const item of sorted) {
    const current = groups.at(-1);
    if (current !== undefined && Math.abs(current.y - item.y) <= Y_COORDINATE_TOLERANCE) {
      current.items.push(item);
    } else {
      groups.push({ y: item.y, items: [item] });
    }
  }
  return groups.map((group) =>
    group.items
      .sort((a, b) => a.x - b.x)
      .map((item) => item.text)
      .join('')
      .trimEnd(),
  );
}
