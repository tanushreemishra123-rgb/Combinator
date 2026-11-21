from app.core.ids import next_id


def test_first_id_is_padded() -> None:
    assert next_id("FR", []) == "FR_01"


def test_continues_after_highest() -> None:
    assert next_id("FR", ["FR_01", "FR_03", "FR_02"]) == "FR_04"


def test_ignores_other_prefixes_and_noise() -> None:
    assert next_id("FR", ["NFR_09", "FRX_02", "FR_", "FR_07", "free text"]) == "FR_08"


def test_grows_past_99() -> None:
    assert next_id("CAP", ["CAP_99"]) == "CAP_100"


def test_prefix_is_not_a_regex() -> None:
    assert next_id("Q", ["Q_02"]) == "Q_03"
