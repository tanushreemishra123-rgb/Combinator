/**
 * Deterministic layout and presentation constants shared by the layout engine, the SVG renderer and
 * (where noted) the React diagram view. Every size in the exported diagram is derived from these
 * values rather than measured text, which is what keeps `layoutDiagram` pure and reproducible.
 */

/** Outer margin around the whole diagram canvas. */
export const DIAGRAM_PADDING = 20;

/** Width of the left-hand column that carries each tier's band label. */
export const TIER_LABEL_GUTTER_WIDTH = 140;

/** Nodes per row before a tier wraps onto an additional row. */
export const MAX_NODES_PER_ROW = 4;

export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 70;

/** Horizontal gap between nodes in the same row. */
export const NODE_GAP_X = 24;

/** Vertical gap between wrapped rows within one tier. */
export const NODE_GAP_Y = 20;

/** Vertical padding above/below a tier's node rows, inside its band. */
export const TIER_BAND_PADDING_Y = 20;

/** Gap between one tier band and the next. */
export const TIER_BAND_GAP = 14;

/** Width of the node area: exactly enough for `MAX_NODES_PER_ROW` full-width columns. */
export const DIAGRAM_CONTENT_WIDTH = MAX_NODES_PER_ROW * NODE_WIDTH + (MAX_NODES_PER_ROW - 1) * NODE_GAP_X;

/** Fixed canvas width - content-independent so exported diagrams are byte-for-byte reproducible. */
export const DIAGRAM_WIDTH = DIAGRAM_PADDING * 2 + TIER_LABEL_GUTTER_WIDTH + DIAGRAM_CONTENT_WIDTH;

/** Extra height `svg.ts` reserves above the layout for the diagram's title bar. */
export const TITLE_BAR_HEIGHT = 36;

// --- Text budgets used by renderers to call `wrapLabel` / truncate single-line fields. ---

/** Approximate characters that fit one line inside a node box at `NODE_LABEL_FONT_SIZE`. */
export const NODE_LABEL_MAX_CHARS = 22;
export const NODE_LABEL_MAX_LINES = 2;
export const NODE_SUBLABEL_MAX_CHARS = 28;
export const NODE_REFS_MAX_CHARS = 34;
export const TIER_LABEL_MAX_CHARS = 20;
export const EDGE_LABEL_MAX_CHARS = 30;

// --- Font sizes (px) for the standalone SVG export. ---

export const TITLE_FONT_SIZE = 16;
export const TIER_LABEL_FONT_SIZE = 12;
export const NODE_LABEL_FONT_SIZE = 12;
export const NODE_LABEL_LINE_HEIGHT = 14;
export const NODE_SUBLABEL_FONT_SIZE = 10;
export const NODE_REFS_FONT_SIZE = 9;
export const EDGE_LABEL_FONT_SIZE = 10;
