"""Integrated scoping package: document model assembly, diagrams and exports."""

from app.package.builder import build_package
from app.package.diagrams import (
    ARCHITECTURE_DIAGRAM_ID,
    INTEGRATION_DIAGRAM_ID,
    architecture_mermaid,
    integration_mermaid,
)
from app.package.errors import InvalidDiagramImage, OutlineError, PackageError
from app.package.inputs import PackageArtifacts, PackageMeta
from app.package.renderers import RenderedDocument, render_docx, render_markdown, render_pdf

__all__ = [
    "ARCHITECTURE_DIAGRAM_ID",
    "INTEGRATION_DIAGRAM_ID",
    "InvalidDiagramImage",
    "OutlineError",
    "PackageArtifacts",
    "PackageError",
    "PackageMeta",
    "RenderedDocument",
    "architecture_mermaid",
    "build_package",
    "integration_mermaid",
    "render_docx",
    "render_markdown",
    "render_pdf",
]
