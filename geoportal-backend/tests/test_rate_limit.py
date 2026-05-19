from app.core import rate_limit


def test_check_rate_limit_allows_until_limit() -> None:
    rate_limit.reset_rate_limit_state()

    assert rate_limit.check_rate_limit("ip-teste", max_requests=2, window_seconds=600)
    assert rate_limit.check_rate_limit("ip-teste", max_requests=2, window_seconds=600)


def test_check_rate_limit_blocks_after_limit() -> None:
    rate_limit.reset_rate_limit_state()

    assert rate_limit.check_rate_limit("ip-teste", max_requests=1, window_seconds=600)
    assert not rate_limit.check_rate_limit(
        "ip-teste",
        max_requests=1,
        window_seconds=600,
    )


def test_check_rate_limit_allows_after_window_expires(monkeypatch) -> None:
    rate_limit.reset_rate_limit_state()
    current_time = 1000.0

    monkeypatch.setattr(rate_limit.time, "monotonic", lambda: current_time)
    assert rate_limit.check_rate_limit("ip-teste", max_requests=1, window_seconds=10)

    current_time = 1011.0
    assert rate_limit.check_rate_limit("ip-teste", max_requests=1, window_seconds=10)


def test_reset_rate_limit_state_clears_attempts() -> None:
    rate_limit.reset_rate_limit_state()

    assert rate_limit.check_rate_limit("ip-teste", max_requests=1, window_seconds=600)
    assert not rate_limit.check_rate_limit(
        "ip-teste",
        max_requests=1,
        window_seconds=600,
    )

    rate_limit.reset_rate_limit_state()

    assert rate_limit.check_rate_limit("ip-teste", max_requests=1, window_seconds=600)
