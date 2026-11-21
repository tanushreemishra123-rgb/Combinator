"""The reverse index over artifact contents."""

import pytest

from app.domain.artifacts import ArtifactKind
from app.traceability.index import (
    REGISTRY,
    ElementSpec,
    UnknownArtifactPath,
    build_index,
    iter_elements,
    string_list,
)
from tests.unit import _fixtures as fx


def _index():
    return build_index(fx.artifact_contents())


def test_requirement_is_indexed_across_every_artifact_that_cites_it():
    refs = _index().references("FR_01")
    found = {(ref.artifact, ref.element_id, ref.field) for ref in refs}
    assert (ArtifactKind.PRD, "FR_01", "req_id") in found
    assert (ArtifactKind.FUNCTIONAL_SCOPE, "CAP_01", "included_req_ids") in found
    assert (ArtifactKind.ARCHITECTURE, "ARC_02", "supported_ids") in found
    assert (ArtifactKind.ESTIMATE_DRIVERS, "WS_01", "req_ids") in found
    assert (ArtifactKind.ESTIMATE, "WS_01", "req_ids") in found


def test_narrative_sections_are_indexed_under_their_section_name():
    refs = _index().references("SEC_01")
    found = {(ref.artifact, ref.element_id) for ref in refs}
    assert (ArtifactKind.ARCHITECTURE, "security_controls") in found
    assert (ArtifactKind.DATA_STRATEGY, "privacy_security") in found


def test_arc_ids_are_indexed_so_platform_changes_can_find_dependants():
    refs = _index().references("ARC_04")
    assert {ref.artifact for ref in refs} == {
        ArtifactKind.ARCHITECTURE,
        ArtifactKind.DATA_STRATEGY,
        ArtifactKind.ESTIMATE_DRIVERS,
    }


def test_element_ids_and_referenced_ids():
    index = _index()
    assert index.element_ids(ArtifactKind.ARCHITECTURE, "components") == tuple(
        f"ARC_{number:02d}" for number in range(1, 9)
    )
    referenced = index.referenced_ids(ArtifactKind.FUNCTIONAL_SCOPE, "CAP_01")
    assert set(referenced) == {"FR_01", "INT_01", "WS_01", "DP_01"}


def test_artifacts_referencing_an_id():
    # The AI use case itself is not a reference; the delivery plan pointing at it is.
    assert _index().artifacts_referencing("AI_01") == {ArtifactKind.ESTIMATE_DRIVERS}


def test_unknown_id_has_no_references():
    assert _index().references("FR_99") == ()


def test_a_new_id_field_is_picked_up_by_adding_one_registry_entry(monkeypatch):
    contents = {ArtifactKind.PRD: {"widgets": [{"id": "W_01", "owner_ids": ["FR_01"]}]}}
    spec = ElementSpec("widgets", id_fields=("id",), list_fields=("owner_ids",))
    monkeypatch.setitem(REGISTRY, ArtifactKind.PRD, (spec,))
    refs = build_index(contents).references("FR_01")
    assert [(ref.element_id, ref.field) for ref in refs] == [("W_01", "owner_ids")]


def test_iter_elements_rejects_a_path_that_is_not_registered():
    with pytest.raises(UnknownArtifactPath):
        iter_elements(fx.artifact_contents(), ArtifactKind.PRD, "not_a_field")


def test_iter_elements_returns_nothing_for_a_missing_artifact():
    assert iter_elements({}, ArtifactKind.ARCHITECTURE, "components") == []


def test_string_list_ignores_anything_that_is_not_a_non_empty_string():
    assert string_list(["FR_01", "", 7, None]) == ["FR_01"]
    assert string_list("FR_01") == []
