"""Every seeded puzzle, played end to end.

For each of the eight puzzles this file plays the whole journey with the *real*
executor, the real mock provider, the real simulated toolbox and the real
fixture retrieval:

1. the committed starter workflow with its failure scenario on - it breaks (or
   ships something it should not) exactly where the puzzle says it will;
2. the repaired workflow, built here as a canvas edit, with the scenario still
   on - it recovers, and the reliability scorer agrees the puzzle is solved;
3. the scenario off - the happy path completes with valid output.

If a puzzle is not solvable in pure mock mode, one of these fails.
"""

from __future__ import annotations

import copy

import pytest
from puzzle_helpers import (
    as_workflow,
    block,
    canvas,
    error_kind,
    event_types,
    executor_for,
    failed_at,
    insert_before,
    play,
    resumed_executor,
    set_config,
    trace_fingerprint,
)

from app.engine.graph import validate_workflow
from app.engine.model import BlockType
from app.engine.run import RunStatus
from app.engine.trace import StepStatus
from app.providers.mock import MockModelProvider
from app.puzzles.models import Puzzle
from app.puzzles.registry import (
    PuzzleNotFound,
    find_puzzle,
    get_puzzle,
    list_puzzles,
    puzzle_injector,
    puzzle_ports,
    reload,
)
from app.reliability.scorer import score_run

PUZZLE_IDS = [
    "fix-the-meeting-summarizer",
    "approve-before-sending",
    "ground-the-knowledge-assistant",
    "repair-the-ticket-router",
    "survive-the-research-timeout",
    "validate-the-data-extractor",
    "activate-the-fallback",
    "resume-the-interrupted-mission",
]


# =============================================================== the catalogue


def test_all_eight_puzzles_are_seeded_in_play_order():
    summaries = list_puzzles()

    assert [item.id for item in summaries] == PUZZLE_IDS
    assert [item.order for item in summaries] == list(range(1, 9))


def test_reload_reparses_every_seed_file():
    assert sorted(reload()) == sorted(PUZZLE_IDS)


def test_unknown_puzzle_ids_are_reported_not_guessed():
    assert find_puzzle("nope") is None
    assert find_puzzle(None) is None
    with pytest.raises(PuzzleNotFound):
        get_puzzle("nope")


@pytest.mark.parametrize("puzzle_id", PUZZLE_IDS)
def test_seed_file_matches_the_strict_models(puzzle_id: str):
    puzzle = get_puzzle(puzzle_id)

    assert isinstance(puzzle, Puzzle)
    assert puzzle.title and puzzle.tagline and puzzle.objective
    assert puzzle.difficulty in {"beginner", "intermediate", "advanced"}
    assert len(puzzle.completion_criteria) == len(puzzle.completion_checks) >= 3
    assert puzzle.failure_scenarios, "every puzzle stages at least one failure"


@pytest.mark.parametrize("puzzle_id", PUZZLE_IDS)
def test_starter_workflow_is_runnable_and_placed_on_the_canvas(puzzle_id: str):
    puzzle = get_puzzle(puzzle_id)
    report = validate_workflow(puzzle.workflow())

    assert report.valid, report.errors
    assert all(node.position is not None for node in puzzle.starter_workflow.nodes)


@pytest.mark.parametrize("puzzle_id", PUZZLE_IDS)
def test_every_puzzle_has_a_meaningful_ai_step_with_a_canned_answer(puzzle_id: str):
    puzzle = get_puzzle(puzzle_id)
    provider = puzzle_ports(puzzle).model_provider()

    assert puzzle.prompt_ids, "every puzzle needs at least one ai_model step"
    for prompt_id in puzzle.prompt_ids:
        assert provider.knows(prompt_id), f"{puzzle_id}: no canned answer for {prompt_id}"


@pytest.mark.parametrize("puzzle_id", PUZZLE_IDS)
def test_available_blocks_cover_every_block_the_starter_uses(puzzle_id: str):
    puzzle = get_puzzle(puzzle_id)
    offered = set(puzzle.available_blocks)
    used = {node.type for node in puzzle.starter_workflow.nodes}

    assert used <= offered, f"{puzzle_id}: palette is missing {used - offered}"
    assert BlockType.INPUT in offered and BlockType.OUTPUT in offered


@pytest.mark.parametrize("puzzle_id", PUZZLE_IDS)
def test_public_detail_never_leaks_the_answer_key(puzzle_id: str):
    puzzle = get_puzzle(puzzle_id)
    detail = puzzle.detail()
    payload = detail.model_dump_json(by_alias=True)

    assert detail.failure_scenarios
    for scenario in detail.failure_scenarios:
        assert scenario.label and scenario.description
        assert not hasattr(scenario, "rules")
    for section in ("rules", "completion_checks", "mock_responses", "tool_fixtures"):
        assert section not in payload, f"{puzzle_id}: {section} leaked to the frontend"
    for scenario in puzzle.failure_scenarios:
        for rule in scenario.rules:
            # The author-facing half of a rule - its note and its staged error
            # message - is the answer key and must stay on the server.
            for secret in (rule.label, rule.detail.get("message")):
                assert not secret or secret not in payload


def test_puzzle_injector_honours_the_failure_toggle():
    puzzle = get_puzzle("survive-the-research-timeout")

    staged = puzzle_injector(puzzle, "slow-archive")
    assert staged.should_fail("run", "fetch_archive", 1) is not None
    assert staged.should_fail("run", "fetch_archive", 3) is None
    assert puzzle_injector(puzzle, "slow-archive", enabled=False).should_fail(
        "run", "fetch_archive", 1
    ) is None
    assert puzzle_injector(puzzle, None).should_fail("run", "fetch_archive", 1) is None


def test_fixtures_bundle_builds_every_port():
    fixtures = puzzle_ports("ground-the-knowledge-assistant")

    assert isinstance(fixtures.model_provider(), MockModelProvider)
    assert "knowledge_search" in fixtures.toolbox().tool_names
    assert fixtures.retrieval().sources == ["support_handbook"]


# ================================================ 1. fix the meeting summarizer


def summarizer():
    return get_puzzle("fix-the-meeting-summarizer")


async def test_summarizer_starter_dies_on_the_missing_owner():
    puzzle = summarizer()

    _, state = await play(puzzle, scenario_id="malformed-minutes")

    assert state.status is RunStatus.FAILED
    assert error_kind(state) == "validation_failed"
    assert failed_at(state) == "check_minutes"
    issues = state.snapshots["check_minutes"].validation.issues
    assert [issue.field for issue in issues] == ["minutes.owner"]

    report = score_run(state, puzzle, scenario_enabled=True)
    assert report.grade == "broken"
    assert report.injected_failure_handled is False
    assert not report.puzzle_solved


async def test_summarizer_repaired_with_retry_upstream_regenerates_the_minutes():
    puzzle = summarizer()
    repaired = set_config(canvas(puzzle), "check_minutes", on_fail="retry_upstream")

    _, state = await play(puzzle, repaired, scenario_id="malformed-minutes")

    assert state.status is RunStatus.COMPLETED
    assert state.result["owner"] == "Priya Raman"
    assert len(state.result["action_items"]) == 3
    assert state.snapshots["check_minutes"].status is StepStatus.RECOVERED
    assert state.attempts["summarize"] == 2

    report = score_run(state, puzzle, scenario_enabled=True)
    assert report.injected_failure_handled is True
    assert report.output_valid is True
    assert report.retries_used == 1
    assert report.puzzle_solved
    assert report.grade == "resilient"


async def test_summarizer_repaired_with_safe_default_also_survives():
    puzzle = summarizer()
    repaired = set_config(
        canvas(puzzle),
        "check_minutes",
        on_fail="safe_default",
        safe_default={"minutes": {"summary": "Unavailable", "owner": "unassigned"}},
    )

    _, state = await play(puzzle, repaired, scenario_id="malformed-minutes")

    assert state.status is RunStatus.COMPLETED
    assert state.result["owner"] == "unassigned"
    # Surviving is not solving: a placeholder owner is accepted, not repaired.
    report = score_run(state, puzzle, scenario_enabled=True)
    assert report.completion[3].met is False
    assert not report.puzzle_solved


async def test_summarizer_repaired_with_repair_sends_the_problems_back_to_the_model():
    puzzle = summarizer()
    repaired = set_config(canvas(puzzle), "check_minutes", on_fail="repair")

    _, state = await play(puzzle, repaired, scenario_id="malformed-minutes")

    assert state.status is RunStatus.COMPLETED
    assert state.result["owner"] == "Priya Raman"
    assert state.attempts["summarize"] == 2
    assert event_types(state).count("step_repairing") == 1
    repairing = next(event for event in state.trace if event.event.value == "step_repairing")
    assert repairing.node_id == "check_minutes"
    assert repairing.payload["upstream_node_id"] == "summarize"
    assert [issue["field"] for issue in repairing.payload["issues"]] == ["minutes.owner"]
    assert "owner" not in repairing.payload["previous_output"]
    # The committed repair answer (confidence 0.97) was served, not the base one.
    recovered = next(
        event
        for event in state.trace
        if event.event.value == "step_recovered" and event.node_id == "summarize"
    )
    assert recovered.payload["confidence"] == 0.97
    assert recovered.payload["recovery_action"] == "repair"
    assert state.snapshots["check_minutes"].status is StepStatus.RECOVERED

    report = score_run(state, puzzle, scenario_enabled=True)
    assert report.puzzle_solved
    assert report.grade == "resilient"
    assert report.repairs_used == 1
    assert report.retries_used == 0
    assert report.injected_failure_handled is True


async def test_summarizer_happy_path_with_failures_off():
    puzzle = summarizer()

    _, state = await play(puzzle)

    assert state.status is RunStatus.COMPLETED
    assert state.result["owner"] == "Priya Raman"
    report = score_run(state, puzzle, scenario_enabled=False)
    assert report.output_valid is True
    assert report.injected_failure_handled is None


# ==================================================== 2. approve before sending


def approver():
    return get_puzzle("approve-before-sending")


def approver_repaired(puzzle):
    return insert_before(
        canvas(puzzle),
        "send_reply",
        block(
            "approve_reply",
            "human_review",
            "Approve before sending",
            (580, 200),
            prompt="This reply is about to go to the customer. Approve, edit or reject it.",
            allowed_actions=["approve", "edit", "reject"],
        ),
    )


async def test_approver_starter_sends_without_asking_anyone():
    puzzle = approver()

    _, state = await play(puzzle, scenario_id="spicy-model")

    assert state.status is RunStatus.COMPLETED
    assert state.result["delivery"]["sent"] is True
    assert "review_requested" not in event_types(state)

    report = score_run(state, puzzle, scenario_enabled=True)
    assert report.human_review_used is False
    assert report.injected_failure_handled is False
    assert report.grade == "fragile"
    assert not report.puzzle_solved


async def test_approver_repaired_pauses_then_sends_the_approved_draft():
    puzzle = approver()
    executor = executor_for(puzzle, "spicy-model")

    paused = await executor.start_run(
        as_workflow(approver_repaired(puzzle)),
        copy.deepcopy(puzzle.sample_input),
        scenario_id="spicy-model",
    )

    assert paused.status is RunStatus.PAUSED
    assert paused.pending_review.node_id == "approve_reply"
    assert paused.pending_review.data["draft"]["tone"] == "apologetic"

    state = await executor.resume_run(paused.run_id, {"action": "approve", "note": "Ship it"})

    assert state.status is RunStatus.COMPLETED
    assert state.result["delivery"]["sent"] is True
    assert state.result["delivery"]["to"] == "maya.chen@example.test"

    report = score_run(state, puzzle, scenario_enabled=True)
    assert report.human_review_used is True
    assert report.injected_failure_handled is True
    assert report.puzzle_solved
    assert report.grade == "resilient"


async def test_approver_repaired_edits_the_draft_before_it_goes_out():
    puzzle = approver()
    executor = executor_for(puzzle, "spicy-model")
    paused = await executor.start_run(
        as_workflow(approver_repaired(puzzle)),
        copy.deepcopy(puzzle.sample_input),
        scenario_id="spicy-model",
    )
    edited = copy.deepcopy(paused.pending_review.data)
    edited["draft"]["body"] = "Hi Maya, the duplicate charge on ORD-55231 is refunded today."

    state = await executor.resume_run(paused.run_id, {"action": "edit", "edited_data": edited})

    assert state.status is RunStatus.COMPLETED
    assert "refunded today" in state.result["delivery"]["preview"]
    assert score_run(state, puzzle, scenario_enabled=True).puzzle_solved


async def test_approver_rejection_stops_safely_and_sends_nothing():
    puzzle = approver()
    executor = executor_for(puzzle, "spicy-model")
    paused = await executor.start_run(
        as_workflow(approver_repaired(puzzle)),
        copy.deepcopy(puzzle.sample_input),
        scenario_id="spicy-model",
    )

    state = await executor.resume_run(
        paused.run_id, {"action": "reject", "note": "We never promise a refund date"}
    )

    assert state.status is RunStatus.SAFELY_STOPPED
    assert "delivery" not in state.result
    report = score_run(state, puzzle, scenario_enabled=True)
    assert report.safe_stop_used is True
    assert report.puzzle_solved


async def test_approver_happy_path_with_failures_off():
    puzzle = approver()
    executor = executor_for(puzzle)
    paused = await executor.start_run(
        as_workflow(approver_repaired(puzzle)), copy.deepcopy(puzzle.sample_input)
    )
    state = await executor.resume_run(paused.run_id, {"action": "approve"})

    assert state.status is RunStatus.COMPLETED
    assert state.result["delivery"]["sent"] is True
    assert score_run(state, puzzle, scenario_enabled=False).grade == "resilient"


# ============================================ 3. ground the knowledge assistant


def assistant():
    return get_puzzle("ground-the-knowledge-assistant")


def assistant_repaired(puzzle):
    edited = copy.deepcopy(canvas(puzzle))
    edited["nodes"].append(
        block(
            "has_evidence",
            "condition",
            "Did we find anything?",
            (580, 220),
            field="documents",
            operator="not_empty",
        )
    )
    edited["nodes"].append(
        block(
            "refuse",
            "safe_stop",
            "Refuse to answer",
            (840, 360),
            message="Nothing in the handbook covers this, so I am not going to guess.",
            reason="no_evidence",
        )
    )
    edited["edges"] = [
        {"id": "e_question_search", "source": "question_in", "target": "search_kb"},
        {"id": "e_search_condition", "source": "search_kb", "target": "has_evidence"},
        {
            "id": "e_condition_answer",
            "source": "has_evidence",
            "target": "answer",
            "sourceHandle": "true",
        },
        {
            "id": "e_condition_refuse",
            "source": "has_evidence",
            "target": "refuse",
            "sourceHandle": "false",
        },
        {"id": "e_answer_out", "source": "answer", "target": "answer_out"},
    ]
    return edited


async def test_assistant_starter_answers_with_no_evidence_at_all():
    puzzle = assistant()

    _, state = await play(puzzle, scenario_id="empty-library")

    assert state.status is RunStatus.COMPLETED
    assert state.result["documents"] == []
    assert state.result["document_count"] == 0
    assert state.result["response"]["answer"]  # answered anyway - that is the bug

    report = score_run(state, puzzle, scenario_enabled=True)
    assert report.injected_failure_handled is False
    assert report.grade == "fragile"
    assert not report.puzzle_solved


async def test_assistant_repaired_refuses_when_the_library_is_empty():
    puzzle = assistant()

    _, state = await play(puzzle, assistant_repaired(puzzle), scenario_id="empty-library")

    assert state.status is RunStatus.SAFELY_STOPPED
    assert "answer" not in state.snapshots
    assert state.snapshots["refuse"].status is StepStatus.SAFELY_STOPPED

    report = score_run(state, puzzle, scenario_enabled=True)
    assert report.safe_stop_used is True
    assert report.injected_failure_handled is True
    assert report.puzzle_solved
    assert report.grade == "resilient"


async def test_assistant_repaired_answers_and_cites_when_the_handbook_has_it():
    puzzle = assistant()

    _, state = await play(puzzle, assistant_repaired(puzzle))

    assert state.status is RunStatus.COMPLETED
    assert [doc["id"] for doc in state.result["documents"]] == ["kb-114", "kb-207"]
    assert state.result["response"]["citations"] == ["kb-114", "kb-207"]
    assert state.result["response"]["grounded"] is True
    assert score_run(state, puzzle, scenario_enabled=False).grade == "resilient"


# ================================================== 4. repair the ticket router


def router():
    return get_puzzle("repair-the-ticket-router")


def router_repaired(puzzle):
    return set_config(canvas(puzzle), "check_classification", on_fail="human_review")


async def test_router_starter_kills_the_run_on_a_shaky_guess():
    puzzle = router()

    _, state = await play(puzzle, scenario_id="confused-classifier")

    assert state.status is RunStatus.FAILED
    assert error_kind(state) == "validation_failed"
    assert failed_at(state) == "check_classification"
    codes = [issue.code for issue in state.snapshots["check_classification"].validation.issues]
    assert codes == ["low_confidence"]
    assert score_run(state, puzzle, scenario_enabled=True).grade == "broken"


async def test_router_repaired_asks_a_human_who_corrects_the_category():
    puzzle = router()
    executor = executor_for(puzzle, "confused-classifier")
    paused = await executor.start_run(
        as_workflow(router_repaired(puzzle)),
        copy.deepcopy(puzzle.sample_input),
        scenario_id="confused-classifier",
    )

    assert paused.status is RunStatus.PAUSED
    assert paused.pending_review.node_id == "check_classification"
    assert paused.pending_review.validation.passed is False

    edited = copy.deepcopy(paused.pending_review.data)
    edited["classification"]["category"] = "account"
    state = await executor.resume_run(
        paused.run_id,
        {"action": "edit", "edited_data": edited, "note": "Seat count is an account issue"},
    )

    assert state.status is RunStatus.COMPLETED
    assert state.result["classification"]["category"] == "account"
    assert state.result["routing_status"] == "routed"

    report = score_run(state, puzzle, scenario_enabled=True)
    assert report.human_review_used is True
    assert report.injected_failure_handled is True
    assert report.puzzle_solved
    assert report.grade == "recovered"


async def test_router_happy_path_with_failures_off():
    puzzle = router()

    _, state = await play(puzzle, router_repaired(puzzle))

    assert state.status is RunStatus.COMPLETED
    assert state.result["classification"]["category"] == "billing"
    assert state.result["routed_by"] == "ticket-router-workflow"
    report = score_run(state, puzzle, scenario_enabled=False)
    assert report.output_valid is True
    assert report.grade == "resilient"


# =============================================== 5. survive the research timeout


def research():
    return get_puzzle("survive-the-research-timeout")


def research_repaired(puzzle):
    return insert_before(
        canvas(puzzle),
        "archive_timeout",
        block("archive_retry", "retry", "Try the archive 3 times", (420, 200), max_attempts=3),
    )


async def test_research_starter_dies_the_first_time_the_archive_hangs():
    puzzle = research()

    _, state = await play(puzzle, scenario_id="slow-archive")

    assert state.status is RunStatus.FAILED
    assert error_kind(state) == "timeout"
    assert failed_at(state) == "fetch_archive"
    assert state.snapshots["archive_timeout"].output["timed_out"] is True
    assert score_run(state, puzzle, scenario_enabled=True).grade == "broken"


async def test_research_repaired_recovers_on_the_third_attempt():
    puzzle = research()

    _, state = await play(puzzle, research_repaired(puzzle), scenario_id="slow-archive")

    assert state.status is RunStatus.COMPLETED
    assert state.snapshots["fetch_archive"].status is StepStatus.RECOVERED
    assert state.snapshots["fetch_archive"].attempts == 3
    assert state.snapshots["archive_retry"].output["attempts_used"] == 3
    assert state.result["sources"] == ["acme-status-blog", "research-archive"]

    report = score_run(state, puzzle, scenario_enabled=True)
    assert report.retries_used == 2
    assert report.injected_failure_handled is True
    assert report.puzzle_solved
    assert report.grade == "resilient"
    assert any("attempt 3" in item for item in report.strengths)


async def test_research_happy_path_with_failures_off():
    puzzle = research()

    _, state = await play(puzzle, research_repaired(puzzle))

    assert state.status is RunStatus.COMPLETED
    assert state.snapshots["fetch_archive"].attempts == 1
    assert len(state.result["key_points"]) == 3
    assert score_run(state, puzzle, scenario_enabled=False).output_valid is True


# ================================================ 6. validate the data extractor


def extractor():
    return get_puzzle("validate-the-data-extractor")


def extractor_repaired(puzzle):
    return insert_before(
        canvas(puzzle),
        "extract",
        block("extract_retry", "retry", "Try the extractor twice", (190, 200), max_attempts=2),
    )


async def test_extractor_starter_blows_up_on_unparseable_json():
    puzzle = extractor()

    _, state = await play(puzzle, scenario_id="garbled-extractor")

    assert state.status is RunStatus.FAILED
    assert error_kind(state) == "invalid_output"
    assert failed_at(state) == "extract"
    assert "check_record" not in state.snapshots  # the validator never even ran

    report = score_run(state, puzzle, scenario_enabled=True)
    assert report.unhandled_errors == ["invalid_output"]
    assert report.grade == "broken"


async def test_extractor_repaired_retries_into_a_record_the_validator_accepts():
    puzzle = extractor()

    _, state = await play(puzzle, extractor_repaired(puzzle), scenario_id="garbled-extractor")

    assert state.status is RunStatus.COMPLETED
    assert state.snapshots["extract"].status is StepStatus.RECOVERED
    assert state.result == {
        "name": "Northwind Logistics",
        "email": "accounts@northwind.test",
        "invoice_number": "NW-2291",
        "amount_due": 4820.5,
        "currency": "EUR",
        "due_date": "2026-04-15",
        "payment_terms": "net 30",
    }

    report = score_run(state, puzzle, scenario_enabled=True)
    assert report.output_valid is True
    assert report.injected_failure_handled is True
    assert report.puzzle_solved
    assert report.grade == "resilient"


async def test_extractor_validator_catches_a_record_that_breaks_the_schema():
    """The schema is real: swap the canned answer and the Validator says no."""
    puzzle = extractor()
    broken = puzzle.model_copy(
        update={
            "mock_responses": {
                "contact_extraction_v1": {
                    "confidence": 0.4,
                    "data": {
                        "name": "Northwind Logistics",
                        "email": "accounts@northwind.test",
                        "invoice_number": "NW-2291",
                        "amount_due": "four thousand",
                        "currency": "CHF",
                        "due_date": "2026-04-15",
                    },
                }
            }
        }
    )

    _, state = await play(broken)

    assert state.status is RunStatus.FAILED
    codes = {issue.code for issue in state.snapshots["check_record"].validation.issues}
    assert codes == {"wrong_type", "not_allowed"}
    # No committed repair answer, so the repair round got the same broken record.
    assert state.error["detail"]["repairs_used"] == 1


async def test_extractor_repairs_a_half_extracted_record_without_a_retry_guard():
    puzzle = extractor()

    _, state = await play(puzzle, scenario_id="half-extracted")

    assert state.status is RunStatus.COMPLETED
    assert state.attempts["extract"] == 2
    assert state.result["due_date"] == "2026-04-15"
    assert event_types(state).count("step_repairing") == 1
    repairing = next(event for event in state.trace if event.event.value == "step_repairing")
    assert repairing.node_id == "check_record"
    assert [issue["field"] for issue in repairing.payload["issues"]] == ["record.due_date"]

    report = score_run(state, puzzle, scenario_enabled=True)
    assert report.repairs_used == 1
    assert report.injected_failure_handled is True
    assert not report.puzzle_solved  # no Retry block yet, so the first criterion is unmet


async def test_extractor_repaired_canvas_also_survives_a_half_extracted_record():
    puzzle = extractor()

    _, state = await play(puzzle, extractor_repaired(puzzle), scenario_id="half-extracted")

    assert state.status is RunStatus.COMPLETED
    report = score_run(state, puzzle, scenario_enabled=True)
    assert report.puzzle_solved
    assert report.grade == "resilient"
    assert report.repairs_used == 1


@pytest.mark.parametrize("puzzle_id", ["fix-the-meeting-summarizer", "validate-the-data-extractor"])
def test_repair_puzzles_commit_a_repair_answer(puzzle_id: str):
    puzzle = get_puzzle(puzzle_id)
    provider = MockModelProvider(puzzle.mock_responses)
    prompt_ids = [
        item.config["prompt_id"]
        for item in puzzle.starter_workflow.nodes
        if item.type is BlockType.AI_MODEL
    ]

    assert prompt_ids
    for prompt_id in prompt_ids:
        assert provider.knows(f"{prompt_id}#repair")


async def test_extractor_happy_path_with_failures_off():
    puzzle = extractor()

    _, state = await play(puzzle, extractor_repaired(puzzle))

    assert state.status is RunStatus.COMPLETED
    assert state.result["invoice_number"] == "NW-2291"
    assert state.attempts["extract"] == 1
    assert score_run(state, puzzle, scenario_enabled=False).output_valid is True


# ====================================================== 7. activate the fallback


def fallback_puzzle():
    return get_puzzle("activate-the-fallback")


def fallback_repaired(puzzle):
    return insert_before(
        canvas(puzzle),
        "write_notice",
        block(
            "model_fallback",
            "fallback",
            "Fall back to the backup model",
            (540, 200),
            mode="alternate_provider",
            provider="mock-backup",
        ),
    )


async def test_fallback_starter_retries_twice_and_gives_up():
    puzzle = fallback_puzzle()

    _, state = await play(puzzle, scenario_id="primary-down")

    assert state.status is RunStatus.FAILED
    assert error_kind(state) == "model_error"
    assert failed_at(state) == "write_notice"
    assert state.attempts["write_notice"] == 2
    assert event_types(state).count("step_retrying") == 1

    report = score_run(state, puzzle, scenario_enabled=True)
    assert report.retries_used == 1
    assert report.fallback_used is False
    assert report.grade == "broken"


async def test_fallback_repaired_lets_the_backup_model_write_the_notice():
    puzzle = fallback_puzzle()

    _, state = await play(puzzle, fallback_repaired(puzzle), scenario_id="primary-down")

    assert state.status is RunStatus.COMPLETED
    assert state.attempts["write_notice"] == 3
    assert state.result["written_by"] == "backup model (mock-backup)"
    assert "backup model" in state.result["headline"]
    assert state.snapshots["model_fallback"].status is StepStatus.RECOVERED

    report = score_run(state, puzzle, scenario_enabled=True)
    assert report.fallback_used is True
    assert report.injected_failure_handled is True
    assert report.output_valid is True
    assert report.puzzle_solved
    assert report.grade == "recovered"
    assert any("mock-backup" in item for item in report.strengths)


async def test_fallback_happy_path_uses_the_primary_model():
    puzzle = fallback_puzzle()

    _, state = await play(puzzle, fallback_repaired(puzzle))

    assert state.status is RunStatus.COMPLETED
    assert state.result["written_by"] == "primary model"
    report = score_run(state, puzzle, scenario_enabled=False)
    assert report.fallback_used is False
    assert report.grade == "resilient"


# ============================================= 8. resume the interrupted mission


def mission():
    return get_puzzle("resume-the-interrupted-mission")


async def test_mission_starter_dies_at_the_dispatch_after_real_work():
    puzzle = mission()

    _, state = await play(puzzle, scenario_id="mission-interrupted")

    assert state.status is RunStatus.FAILED
    assert error_kind(state) == "tool_error"
    assert failed_at(state) == "dispatch"
    assert state.snapshots["mission_brief"].status is StepStatus.COMPLETED
    assert state.snapshots["plan_mission"].status is StepStatus.COMPLETED
    assert state.snapshots["check_plan"].validation.passed is True
    assert score_run(state, puzzle, scenario_enabled=True).grade == "broken"


async def test_mission_resumes_from_the_last_successful_step_and_finishes():
    puzzle = mission()
    executor, failed = await play(puzzle, scenario_id="mission-interrupted")

    resumed = await resumed_executor(puzzle, executor).resume_from_last_successful(
        failed.run_id
    )

    assert resumed.run_id != failed.run_id
    assert resumed.resumed_from == failed.run_id
    assert resumed.status is RunStatus.COMPLETED
    assert event_types(resumed).count("step_skipped") == 4
    assert resumed.snapshots["plan_mission"].status is StepStatus.SKIPPED
    assert resumed.result["dispatch"]["sent"] is True
    assert resumed.result["mission_status"] == "dispatched"
    assert resumed.result["plan"]["dispatch_channel"] == "#field-ops"

    report = score_run(resumed, puzzle, scenario_enabled=True)
    assert report.injected_failure_handled is True
    assert report.puzzle_solved
    assert report.grade == "recovered"
    assert any("Resumed from the last successful step" in item for item in report.strengths)


async def test_mission_happy_path_with_failures_off():
    puzzle = mission()

    _, state = await play(puzzle)

    assert state.status is RunStatus.COMPLETED
    assert [doc["id"] for doc in state.result["documents"]] == ["arch-701", "arch-733"]
    assert state.result["dispatch"]["channel"] == "#field-ops"
    assert state.result["mission_status"] == "dispatched"
    assert score_run(state, puzzle, scenario_enabled=False).output_valid is True


# =============================================== every puzzle, every scenario


@pytest.mark.parametrize("puzzle_id", PUZZLE_IDS)
async def test_every_starter_runs_to_a_definite_end_with_failures_off(puzzle_id: str):
    """No puzzle may hang, crash the engine, or need a live provider."""
    puzzle = get_puzzle(puzzle_id)
    executor = executor_for(puzzle)
    state = await executor.start_run(puzzle.workflow(), copy.deepcopy(puzzle.sample_input))

    if state.status is RunStatus.PAUSED:
        state = await executor.resume_run(state.run_id, {"action": "approve"})
    assert state.status in {RunStatus.COMPLETED, RunStatus.SAFELY_STOPPED}
    assert state.result is not None


@pytest.mark.parametrize("puzzle_id", PUZZLE_IDS)
async def test_every_scenario_changes_what_happens(puzzle_id: str):
    """A committed scenario that changes nothing is a broken puzzle."""
    puzzle = get_puzzle(puzzle_id)
    for scenario in puzzle.failure_scenarios:
        _, clean = await play(puzzle)
        _, staged = await play(puzzle, scenario_id=scenario.id)
        assert trace_fingerprint(clean) != trace_fingerprint(staged), (
            f"{puzzle_id}/{scenario.id} makes no difference"
        )


@pytest.mark.parametrize("puzzle_id", PUZZLE_IDS)
async def test_runs_are_deterministic(puzzle_id: str):
    """Same puzzle, same scenario, same trace - twice."""
    puzzle = get_puzzle(puzzle_id)
    scenario_id = puzzle.default_scenario.id

    _, first = await play(puzzle, scenario_id=scenario_id)
    _, second = await play(puzzle, scenario_id=scenario_id)

    assert first.status is second.status
    assert first.result == second.result
    assert trace_fingerprint(first) == trace_fingerprint(second)
