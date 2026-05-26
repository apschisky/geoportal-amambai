import pytest

from app.services.auth_rate_limit_service import evaluate_login_rate_limit


def test_evaluate_login_rate_limit_allows_below_limit() -> None:
    decision = evaluate_login_rate_limit(
        failed_attempts=2,
        max_attempts=5,
        window_minutes=10,
    )

    assert decision.allowed is True
    assert decision.remaining_attempts == 3
    assert decision.retry_after_seconds is None


def test_evaluate_login_rate_limit_blocks_at_limit() -> None:
    decision = evaluate_login_rate_limit(
        failed_attempts=5,
        max_attempts=5,
        window_minutes=10,
    )

    assert decision.allowed is False
    assert decision.remaining_attempts == 0
    assert decision.retry_after_seconds == 600


def test_evaluate_login_rate_limit_blocks_above_limit() -> None:
    decision = evaluate_login_rate_limit(
        failed_attempts=7,
        max_attempts=5,
        window_minutes=10,
    )

    assert decision.allowed is False
    assert decision.remaining_attempts == 0
    assert decision.retry_after_seconds == 600


def test_evaluate_login_rate_limit_allows_with_one_attempt_remaining() -> None:
    decision = evaluate_login_rate_limit(
        failed_attempts=4,
        max_attempts=5,
        window_minutes=10,
    )

    assert decision.allowed is True
    assert decision.remaining_attempts == 1
    assert decision.retry_after_seconds is None


@pytest.mark.parametrize(
    ("failed_attempts", "max_attempts", "window_minutes"),
    [
        (-1, 5, 10),
        (0, 0, 10),
        (0, 5, 0),
    ],
)
def test_evaluate_login_rate_limit_rejects_invalid_parameters(
    failed_attempts: int,
    max_attempts: int,
    window_minutes: int,
) -> None:
    with pytest.raises(ValueError):
        evaluate_login_rate_limit(
            failed_attempts=failed_attempts,
            max_attempts=max_attempts,
            window_minutes=window_minutes,
        )


def test_evaluate_login_rate_limit_does_not_depend_on_user_existence() -> None:
    first_decision = evaluate_login_rate_limit(
        failed_attempts=5,
        max_attempts=5,
        window_minutes=10,
    )
    second_decision = evaluate_login_rate_limit(
        failed_attempts=5,
        max_attempts=5,
        window_minutes=10,
    )

    assert first_decision == second_decision
