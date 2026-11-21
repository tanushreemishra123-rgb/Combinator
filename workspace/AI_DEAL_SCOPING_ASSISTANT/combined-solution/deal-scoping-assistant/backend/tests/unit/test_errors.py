import json

from app.core.errors import AIStageFailed, Conflict, NotFound, ValidationFailed, problem_response


def test_error_statuses() -> None:
    assert NotFound("x").status_code == 404
    assert Conflict("x").status_code == 409
    assert ValidationFailed("x").status_code == 422
    assert AIStageFailed("x").status_code == 422


def test_problem_response_is_rfc7807() -> None:
    error = NotFound("Session s1 does not exist", errors=["session_id: unknown"])
    response = problem_response(
        error.status_code, error.title, error.detail, error.problem_type, error.errors
    )
    assert response.status_code == 404
    assert response.media_type == "application/problem+json"
    body = json.loads(response.body)
    assert body["title"] == "Not Found"
    assert body["status"] == 404
    assert body["detail"] == "Session s1 does not exist"
    assert body["type"].endswith("/not-found")
    assert body["errors"] == ["session_id: unknown"]
