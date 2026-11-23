"""AI-layer errors that the core contract does not cover."""

from app.core.errors import AIStageFailed, AppError


class AiNotConfigured(AppError):
    """Live mode was asked for but provider, model or credential is missing."""

    status_code = 503
    problem_type = "https://tc-101.local/problems/ai-not-configured"
    title = "AI Provider Not Configured"


class MockResponseMissing(AppError):
    """No recorded response exists for the requested stage."""

    status_code = 503
    problem_type = "https://tc-101.local/problems/mock-response-missing"
    title = "Mock Response Missing"


class AiRequestTooLarge(AIStageFailed):
    """One request does not fit the provider's token budget; repairing it would not help."""


class AiProviderUnavailable(AIStageFailed):
    """The provider stayed rate limited or overloaded; the request itself is fine."""
