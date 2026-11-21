"""Workflow definition model.

Responsibility: describe the *shape* of a workflow (nodes + edges) exactly as the
React Flow canvas serialises it, with cheap graph lookups used by the executor and
the graph validator. Contains no execution logic and no puzzle/business content.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class BlockType(StrEnum):
    """Every block kind the canvas can place on a workflow."""

    INPUT = "input"
    AI_MODEL = "ai_model"
    TOOL = "tool"
    RETRIEVAL = "retrieval"
    CONDITION = "condition"
    TRANSFORM = "transform"
    VALIDATOR = "validator"
    HUMAN_REVIEW = "human_review"
    SAFE_STOP = "safe_stop"
    OUTPUT = "output"
    # Guard blocks: they wrap the next non-guard block rather than executing work.
    RETRY = "retry"
    TIMEOUT = "timeout"
    FALLBACK = "fallback"


GUARD_TYPES: frozenset[BlockType] = frozenset(
    {BlockType.RETRY, BlockType.TIMEOUT, BlockType.FALLBACK}
)
"""Guard blocks fold into a policy applied to the next non-guard block."""

TERMINAL_TYPES: frozenset[BlockType] = frozenset(
    {BlockType.OUTPUT, BlockType.SAFE_STOP}
)
"""Blocks that end a run when reached."""

TRUE_HANDLE = "true"
FALSE_HANDLE = "false"


class NodeDef(BaseModel):
    """A single block placed on the canvas."""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    type: BlockType
    label: str = ""
    config: dict[str, Any] = Field(default_factory=dict)

    @property
    def display_label(self) -> str:
        """Human-facing name, falling back to the block type."""
        return self.label or self.type.value

    @property
    def is_guard(self) -> bool:
        return self.type in GUARD_TYPES

    @property
    def is_terminal(self) -> bool:
        return self.type in TERMINAL_TYPES


class EdgeDef(BaseModel):
    """A directed connection between two blocks.

    ``source_handle`` is only meaningful for Condition blocks, where it is
    ``"true"`` or ``"false"``. The ``sourceHandle`` alias lets React Flow JSON be
    parsed directly.
    """

    model_config = ConfigDict(populate_by_name=True)

    id: str
    source: str
    target: str
    source_handle: str | None = Field(default=None, alias="sourceHandle")


class WorkflowDef(BaseModel):
    """A complete workflow graph."""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str = ""
    nodes: list[NodeDef] = Field(default_factory=list)
    edges: list[EdgeDef] = Field(default_factory=list)

    def node(self, node_id: str) -> NodeDef:
        """Return the node with ``node_id`` or raise ``KeyError``."""
        for node in self.nodes:
            if node.id == node_id:
                return node
        raise KeyError(f"unknown node id: {node_id!r}")

    def find(self, node_id: str) -> NodeDef | None:
        """Return the node with ``node_id`` or ``None``."""
        try:
            return self.node(node_id)
        except KeyError:
            return None

    def nodes_of_type(self, block_type: BlockType) -> list[NodeDef]:
        return [node for node in self.nodes if node.type is block_type]

    def outgoing(self, node_id: str, handle: str | None = None) -> list[EdgeDef]:
        """Edges leaving ``node_id``, optionally filtered by branch handle.

        When ``handle`` is given, edges with no handle are treated as matching
        only if no handled edge exists, so simple single-branch graphs keep working.
        """
        edges = [edge for edge in self.edges if edge.source == node_id]
        if handle is None:
            return edges
        exact = [edge for edge in edges if edge.source_handle == handle]
        if exact:
            return exact
        return [edge for edge in edges if edge.source_handle is None]

    def incoming(self, node_id: str) -> list[EdgeDef]:
        return [edge for edge in self.edges if edge.target == node_id]

    @property
    def input_nodes(self) -> list[NodeDef]:
        return self.nodes_of_type(BlockType.INPUT)
