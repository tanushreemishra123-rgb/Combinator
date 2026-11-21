"""Explicit failures raised by the package builder and renderers."""


class PackageError(Exception):
    """Base for every error raised while building or rendering the package."""


class OutlineError(PackageError):
    """The section outline is missing, malformed or lists an unknown section id."""


class InvalidDiagramImage(PackageError):
    """A caller-supplied diagram image is not a usable PNG."""
