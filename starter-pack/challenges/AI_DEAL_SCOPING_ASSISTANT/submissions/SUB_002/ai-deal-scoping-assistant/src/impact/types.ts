/** Internal and public types of the change-impact module. */
import type {
  ArchitectureArea,
  ChangeDescriptor,
  DriverType,
  ImpactEntry,
  OutputSectionId,
  ScopeItem,
  SessionOutputs,
  UnaffectedEntry,
} from '../domain';

/** Result of the rule-based analysis: what must be refreshed and what is provably preserved. */
export interface ImpactAnalysis {
  affected: ImpactEntry[];
  unaffected: UnaffectedEntry[];
}

/**
 * Facets let the rule table address groups of generated elements without naming ids:
 * a component's architecture area or logical catalog key, a driver's type, a data topic.
 */
export type ElementFacet = `area:${ArchitectureArea}` | `logical:${string}` | `driver:${DriverType}` | `topic:${string}` | `phase:${string}`;

/** One generated element of an output section together with the ids it cites. */
export interface SectionElement {
  section: OutputSectionId;
  id: string;
  /** How the element is named in a reason sentence (its id, or a quoted title when it has no id). */
  display: string;
  /** Scope-item ids and, for estimate drivers, ids of other generated elements. */
  refs: readonly string[];
  facets: readonly ElementFacet[];
}

/** How an area rule finds the concrete elements that depend on the changed value. */
export type ElementSelector =
  /** Everything in the section is derived from the changed value. */
  | { type: 'whole-section' }
  /** Elements that cite the changed scope item, directly or (estimate only) one hop further. */
  | { type: 'trace' }
  /** Elements that cite reviewed requirements carrying one of these signals. */
  | { type: 'cites-signals'; signals: readonly string[]; targetPhrase: string }
  /** The reviewed requirements carrying one of these signals (reported so they are re-validated). */
  | { type: 'requirements-with-signals'; signals: readonly string[]; targetPhrase: string }
  /** Elements tagged with one of these facets. */
  | { type: 'facets'; facets: readonly ElementFacet[]; facetNoun: string }
  /** The estimate driver named by the change and the workstream that contains it. */
  | { type: 'target-driver' };

export interface AreaRule {
  section: OutputSectionId;
  /** Human-readable area in the spec's wording, e.g. 'Scalability architecture'. */
  area: string;
  action: ImpactEntry['action'];
  selector: ElementSelector;
  /** Why this area depends on the changed value; completes the evidence sentence of the reason. */
  because: string;
}

/** An area the change provably does not touch, with the dependency rule that says so. */
export type PreservedArea = UnaffectedEntry;

export interface ImpactRule {
  areas: readonly AreaRule[];
  preserved: readonly PreservedArea[];
}

/** Everything a selector needs, computed once per analysis. */
export interface AnalysisContext {
  change: ChangeDescriptor;
  elements: readonly SectionElement[];
  generated: ReadonlySet<OutputSectionId>;
  /** Active (not rejected) items of the reviewed scope model. */
  items: readonly ScopeItem[];
  /** The changed scope item, when the change targets one that still exists. */
  target: ScopeItem | undefined;
  /** Ids whose citations are followed: the target plus, for assumptions and questions, linked items. */
  rootIds: readonly string[];
  /** Ids of every generated element that cites a root id directly (the hop origin for estimate drivers). */
  directIds: ReadonlySet<string>;
}

export type SelectorResolution =
  | { matched: true; elementIds: string[]; evidence: string }
  | { matched: false; reason: string };

/** What the UI offers for a stale stage: re-run the AI stage or only the deterministic engine. */
export interface PendingAction {
  stageId: keyof SessionOutputs;
  label: string;
  action: ImpactEntry['action'];
  sections: OutputSectionId[];
  reasons: string[];
}
