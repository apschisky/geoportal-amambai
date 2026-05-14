import pytest

from app.services.protocol_service import generate_protocol


def test_generate_protocol_formats_expected_value() -> None:
    assert generate_protocol(prefix="IP", year=2026, sequence=1) == "IP-2026-000001"


def test_generate_protocol_uppercases_prefix() -> None:
    assert generate_protocol(prefix="ip", year=2026, sequence=1) == "IP-2026-000001"


def test_generate_protocol_formats_sequence_with_six_digits() -> None:
    assert generate_protocol(prefix="IP", year=2026, sequence=25) == "IP-2026-000025"


def test_generate_protocol_rejects_empty_prefix() -> None:
    with pytest.raises(ValueError):
        generate_protocol(prefix="   ", year=2026, sequence=1)


@pytest.mark.parametrize("year", [999, 10000])
def test_generate_protocol_rejects_invalid_year(year: int) -> None:
    with pytest.raises(ValueError):
        generate_protocol(prefix="IP", year=year, sequence=1)


@pytest.mark.parametrize("sequence", [0, -1])
def test_generate_protocol_rejects_invalid_sequence(sequence: int) -> None:
    with pytest.raises(ValueError):
        generate_protocol(prefix="IP", year=2026, sequence=sequence)
