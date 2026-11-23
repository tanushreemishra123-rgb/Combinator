"""Application errors and RFC 7807 problem responses."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

PROBLEM_MEDIA_TYPE = "application/problem+json"


class AppError(Exception):
    """Base for expected failures; carries the HTTP status and a problem type."""

    status_code = 500
    problem_type = "about:blank"
    title = "Internal Server Error"

    def __init__(self, detail: str, errors: list[str] | None = None) -> None:
        super().__init__(detail)
        self.detail = detail
        self.errors = errors or []


class NotFound(AppError):
    status_code = 404
    problem_type = "https://tc-101.local/problems/not-found"
    title = "Not Found"


class Conflict(AppError):
    status_code = 409
    problem_type = "https://tc-101.local/problems/conflict"
    title = "Conflict"


class ValidationFailed(AppError):
    status_code = 422
    problem_type = "https://tc-101.local/problems/validation-failed"
    title = "Validation Failed"


class AIStageFailed(AppError):
    status_code = 422
    problem_type = "https://tc-101.local/problems/ai-stage-failed"
    title = "AI Stage Failed"


def problem_response(
    status: int, title: str, detail: str, problem_type: str, errors: list[str] | None = None
) -> JSONResponse:
    body: dict[str, object] = {
        "type": problem_type,
        "title": title,
        "status": status,
        "detail": detail,
    }
    if errors:
        body["errors"] = errors
    return JSONResponse(status_code=status, content=body, media_type=PROBLEM_MEDIA_TYPE)


async def app_error_handler(_: Request, exc: Exception) -> JSONResponse:
    error = exc if isinstance(exc, AppError) else AppError(str(exc))
    return problem_response(
        error.status_code, error.title, error.detail, error.problem_type, error.errors
    )


async def request_validation_handler(_: Request, exc: Exception) -> JSONResponse:
    errors = []
    if isinstance(exc, RequestValidationError):
        errors = [f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors()]
    return problem_response(
        422,
        ValidationFailed.title,
        "The request body or parameters are invalid.",
        ValidationFailed.problem_type,
        errors,
    )


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, request_validation_handler)
