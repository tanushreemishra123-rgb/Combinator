"""Static workflow graph validation.

Responsibility: decide whether a canvas graph is runnable *before* a run starts and
explain every problem in structured form. The report powers the builder's
"check workflow" UX, so each issue carries a stable ``code`` and a node/edge id.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, ValidationError

from app.engine.model import (
    FALSE_HANDLE,
    GUARD_TYPES,
    TRUE_HANDLE,
    BlockType,
    WorkflowDef,
)


class GraphIssue(BaseModel):
    """One structured problem with a workflow graph."""

    code: str
    message: str
    node_id: str | None = None
    edge_id: str | None = None
    detail: dict[str, Any] = Field(default_factory=dict)


class GraphValidationReport(BaseModel):
    """The result of validating a workflow graph."""

    valid: bool
    errors: list[GraphIssue] = Field(default_factory=list)
    warnings: list[GraphIssue] = Field(default_factory=list)

    @property
    def error_codes(self) -> list[str]:
        return [issue.code for issue in self.errors]


def validate_workflow(workflow: WorkflowDef) -> GraphValidationReport:
    """Validate ``workflow`` and return every error and warning found."""
    errors: list[GraphIssue] = []
    warnings: list[GraphIssue] = []
    node_ids = {node.id for node in workflow.nodes}

    _check_ids(workflow, errors)
    _check_edges(workflow, node_ids, errors)
    input_node = _check_input(workflow, errors)
    _check_terminals(workflow, errors)
    _check_branching(workflow, errors)
    _check_guards(workflow, errors)
    _check_configs(workflow, errors)
    cycle = _find_cycle(workflow)
    if cycle is not None:
        errors.append(
            GraphIssue(
                code="cycle_detected",
                message=f"Workflow contains a cycle: {' -> '.join(cycle)}.",
                node_id=cycle[0],
                detail={"nodes": cycle},
            )
        )
    if input_node is not None and cycle is None:
        _check_reachability(workflow, input_node.id, errors, warnings)

    return GraphValidationReport(valid=not errors, errors=errors, warnings=warnings)


def raise_for_invalid(workflow: WorkflowDef) -> GraphValidationReport:
    """Validate ``workflow``, raising ``WorkflowValidationError`` when unrunnable."""
    from app.engine.errors import WorkflowValidationError

    report = validate_workflow(workflow)
    if not report.valid:
        raise WorkflowValidationError(report)
    return report


def _check_ids(workflow: WorkflowDef, errors: list[GraphIssue]) -> None:
    seen: set[str] = set()
    for node in workflow.nodes:
        if node.id in seen:
            errors.append(
                GraphIssue(
                    code="duplicate_node_id",
                    message=f"Two blocks share the id {node.id!r}.",
                    node_id=node.id,
                )
            )
        seen.add(node.id)
    if not workflow.nodes:
        errors.append(
            GraphIssue(code="empty_workflow", message="The workflow has no blocks.")
        )


def _check_edges(
    workflow: WorkflowDef, node_ids: set[str], errors: list[GraphIssue]
) -> None:
    for edge in workflow.edges:
        for endpoint, value in (("source", edge.source), ("target", edge.target)):
            if value not in node_ids:
                errors.append(
                    GraphIssue(
                        code="unknown_edge_endpoint",
                        message=(
                            f"Connection {edge.id!r} points at unknown block {value!r}."
                        ),
                        edge_id=edge.id,
                        detail={"endpoint": endpoint, "node_id": value},
                    )
                )


def _check_input(workflow: WorkflowDef, errors: list[GraphIssue]):
    inputs = workflow.input_nodes
    if not inputs:
        errors.append(
            GraphIssue(
                code="missing_input_node",
                message="The workflow needs exactly one Input block to start from.",
            )
        )
        return None
    if len(inputs) > 1:
        errors.append(
            GraphIssue(
                code="multiple_input_nodes",
                message=(
                    "The workflow has "
                    f"{len(inputs)} Input blocks; exactly one is allowed."
                ),
                detail={"node_ids": [node.id for node in inputs]},
            )
        )
    for node in inputs:
        if workflow.incoming(node.id):
            errors.append(
                GraphIssue(
                    code="input_has_incoming",
                    message="The Input block cannot have incoming connections.",
                    node_id=node.id,
                )
            )
    return inputs[0]


def _check_terminals(workflow: WorkflowDef, errors: list[GraphIssue]) -> None:
    terminals = workflow.nodes_of_type(BlockType.OUTPUT) + workflow.nodes_of_type(
        BlockType.SAFE_STOP
    )
    if not terminals:
        errors.append(
            GraphIssue(
                code="missing_terminal_node",
                message="The workflow needs an Output or Safe Stop block to finish at.",
            )
        )
    for node in terminals:
        if workflow.outgoing(node.id):
            errors.append(
                GraphIssue(
                    code="terminal_has_outgoing",
                    message=(
                        f"{node.display_label} is a final block and cannot connect "
                        "to another block."
                    ),
                    node_id=node.id,
                )
            )


def _check_branching(workflow: WorkflowDef, errors: list[GraphIssue]) -> None:
    for node in workflow.nodes:
        edges = workflow.outgoing(node.id)
        if node.type is BlockType.CONDITION:
            handles = {edge.source_handle for edge in edges}
            for handle in (TRUE_HANDLE, FALSE_HANDLE):
                if handle not in handles:
                    errors.append(
                        GraphIssue(
                            code="missing_condition_branch",
                            message=(
                                f"Condition {node.display_label!r} has no "
                                f"'{handle}' branch."
                            ),
                            node_id=node.id,
                            detail={"handle": handle},
                        )
                    )
        elif len(edges) > 1:
            errors.append(
                GraphIssue(
                    code="ambiguous_branch",
                    message=(
                        f"{node.display_label} has {len(edges)} outgoing connections; "
                        "only a Condition block may branch."
                    ),
                    node_id=node.id,
                )
            )
        elif not edges and not node.is_terminal:  # nosemgrep: python.lang.maintainability.is-function-without-parentheses.is-function-without-parentheses -- property access on NodeDef, not a missed call
            errors.append(
                GraphIssue(
                    code="dangling_node",
                    message=(
                        f"{node.display_label} does not connect to anything and is "
                        "not a final block."
                    ),
                    node_id=node.id,
                )
            )


def _check_guards(workflow: WorkflowDef, errors: list[GraphIssue]) -> None:
    for node in workflow.nodes:
        if node.type not in GUARD_TYPES:
            continue
        target_ids = [edge.target for edge in workflow.outgoing(node.id)]
        protected = None
        seen: set[str] = {node.id}
        while target_ids:
            candidate = workflow.find(target_ids[0])
            if candidate is None or candidate.id in seen:
                break
            seen.add(candidate.id)
            if candidate.type not in GUARD_TYPES:
                protected = candidate
                break
            target_ids = [edge.target for edge in workflow.outgoing(candidate.id)]
        if protected is None:
            errors.append(
                GraphIssue(
                    code="dangling_guard",
                    message=(
                        f"{node.display_label} must sit directly before the block it "
                        "protects."
                    ),
                    node_id=node.id,
                )
            )
        elif protected.is_terminal:  # nosemgrep: python.lang.maintainability.is-function-without-parentheses.is-function-without-parentheses -- property access on NodeDef, not a missed call
            errors.append(
                GraphIssue(
                    code="guard_protects_terminal",
                    message=(
                        f"{node.display_label} protects {protected.display_label}, "
                        "which does no work."
                    ),
                    node_id=node.id,
                )
            )


def _check_configs(workflow: WorkflowDef, errors: list[GraphIssue]) -> None:
    from app.blocks import get_block

    for node in workflow.nodes:
        try:
            block = get_block(node.type)
        except KeyError:
            errors.append(
                GraphIssue(
                    code="unknown_block_type",
                    message=f"Unknown block type {node.type!r}.",
                    node_id=node.id,
                )
            )
            continue
        try:
            block.parse_config(node)
        except ValidationError as exc:
            errors.append(
                GraphIssue(
                    code="invalid_config",
                    message=(
                        f"{node.display_label} is not configured correctly: "
                        f"{_first_error(exc)}"
                    ),
                    node_id=node.id,
                    detail={"errors": exc.errors(include_url=False)},
                )
            )


def _first_error(exc: ValidationError) -> str:
    errors = exc.errors(include_url=False)
    if not errors:  # pragma: no cover - pydantic always reports at least one
        return str(exc)
    first = errors[0]
    location = ".".join(str(part) for part in first.get("loc", ())) or "config"
    return f"{location}: {first.get('msg', 'invalid')}"


def _find_cycle(workflow: WorkflowDef) -> list[str] | None:
    """Return one cycle as a node-id path, or ``None`` when the graph is acyclic."""
    white, grey, black = 0, 1, 2
    colors = {node.id: white for node in workflow.nodes}
    stack: list[str] = []

    def visit(node_id: str) -> list[str] | None:
        colors[node_id] = grey
        stack.append(node_id)
        for edge in workflow.outgoing(node_id):
            if edge.target not in colors:
                continue
            if colors[edge.target] == grey:
                start = stack.index(edge.target)
                return [*stack[start:], edge.target]
            if colors[edge.target] == white:
                found = visit(edge.target)
                if found is not None:
                    return found
        stack.pop()
        colors[node_id] = black
        return None

    for node in workflow.nodes:
        if colors[node.id] == white:
            found = visit(node.id)
            if found is not None:
                return found
    return None


def _check_reachability(
    workflow: WorkflowDef,
    start_id: str,
    errors: list[GraphIssue],
    warnings: list[GraphIssue],
) -> None:
    reachable: set[str] = set()
    frontier = [start_id]
    while frontier:
        current = frontier.pop()
        if current in reachable:
            continue
        reachable.add(current)
        frontier.extend(edge.target for edge in workflow.outgoing(current))

    if not any(
        workflow.node(node_id).is_terminal  # nosemgrep: python.lang.maintainability.is-function-without-parentheses.is-function-without-parentheses -- property access on NodeDef, not a missed call
        for node_id in reachable
        if workflow.find(node_id) is not None
    ):
        errors.append(
            GraphIssue(
                code="unreachable_terminal",
                message=(
                    "No Output or Safe Stop block can be reached from the Input block."
                ),
                node_id=start_id,
            )
        )

    for node in workflow.nodes:
        if node.id in reachable:
            continue
        issue = GraphIssue(
            code="disconnected_node",
            message=f"{node.display_label} is never reached from the Input block.",
            node_id=node.id,
        )
        # A Safe Stop can legitimately be reached only through a human rejection,
        # which is a runtime route rather than an edge, so it is only a warning.
        if node.type is BlockType.SAFE_STOP:
            warnings.append(issue)
        else:
            errors.append(issue)
