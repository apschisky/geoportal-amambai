from dataclasses import dataclass


@dataclass(frozen=True)
class LoginRateLimitDecision:
    allowed: bool
    remaining_attempts: int
    retry_after_seconds: int | None


def evaluate_login_rate_limit(
    failed_attempts: int,
    max_attempts: int,
    window_minutes: int,
) -> LoginRateLimitDecision:
    if failed_attempts < 0:
        raise ValueError("failed_attempts must not be negative")
    if max_attempts <= 0:
        raise ValueError("max_attempts must be greater than zero")
    if window_minutes <= 0:
        raise ValueError("window_minutes must be greater than zero")

    remaining_attempts = max(max_attempts - failed_attempts, 0)
    if failed_attempts >= max_attempts:
        return LoginRateLimitDecision(
            allowed=False,
            remaining_attempts=0,
            retry_after_seconds=window_minutes * 60,
        )

    return LoginRateLimitDecision(
        allowed=True,
        remaining_attempts=remaining_attempts,
        retry_after_seconds=None,
    )
