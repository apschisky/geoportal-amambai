import time

_RATE_LIMIT_STATE: dict[str, list[float]] = {}


def check_rate_limit(
    key: str,
    max_requests: int,
    window_seconds: int,
) -> bool:
    now = time.monotonic()
    window_start = now - window_seconds

    attempts = [
        attempt
        for attempt in _RATE_LIMIT_STATE.get(key, [])
        if attempt > window_start
    ]

    if len(attempts) >= max_requests:
        _RATE_LIMIT_STATE[key] = attempts
        return False

    attempts.append(now)
    _RATE_LIMIT_STATE[key] = attempts
    return True


def reset_rate_limit_state() -> None:
    _RATE_LIMIT_STATE.clear()
