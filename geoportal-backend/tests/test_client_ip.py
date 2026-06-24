from fastapi import Request

from app.core.client_ip import parse_trusted_proxy_hosts, resolve_client_ip


def build_request(
    peer_host: str,
    headers: dict[str, str] | None = None,
) -> Request:
    raw_headers = [
        (name.lower().encode('ascii'), value.encode('ascii'))
        for name, value in (headers or {}).items()
    ]
    return Request(
        {
            'type': 'http',
            'method': 'POST',
            'path': '/api/internal/auth/login',
            'headers': raw_headers,
            'client': (peer_host, 54321),
        }
    )


def test_resolve_client_ip_uses_direct_peer_without_forwarded_header() -> None:
    request = build_request('198.51.100.10')

    assert resolve_client_ip(request, '127.0.0.1,::1') == '198.51.100.10'


def test_resolve_client_ip_accepts_single_forwarded_ip_from_trusted_proxy() -> None:
    request = build_request(
        '127.0.0.1',
        {'X-Forwarded-For': '198.51.100.20'},
    )

    assert resolve_client_ip(request, '127.0.0.1,::1') == '198.51.100.20'


def test_resolve_client_ip_rejects_spoofable_multiple_forwarded_chain() -> None:
    request = build_request(
        '127.0.0.1',
        {'X-Forwarded-For': '9.9.9.9, 203.0.113.10'},
    )

    assert resolve_client_ip(request, '127.0.0.1,::1') == '127.0.0.1'


def test_resolve_client_ip_ignores_forwarded_header_from_untrusted_peer() -> None:
    request = build_request(
        '203.0.113.25',
        {'X-Forwarded-For': '198.51.100.20'},
    )

    assert resolve_client_ip(request, '127.0.0.1,::1') == '203.0.113.25'


def test_resolve_client_ip_falls_back_on_malformed_forwarded_chain() -> None:
    request = build_request(
        '127.0.0.1',
        {
            'X-Forwarded-For': 'not-an-ip, 10.0.0.10',
            'X-Real-IP': '198.51.100.30',
        },
    )

    assert resolve_client_ip(request, '127.0.0.1,::1') == '127.0.0.1'


def test_resolve_client_ip_accepts_real_ip_from_trusted_proxy() -> None:
    request = build_request('127.0.0.1', {'X-Real-IP': '198.51.100.30'})

    assert resolve_client_ip(request, '127.0.0.1,::1') == '198.51.100.30'


def test_resolve_client_ip_ignores_real_ip_from_untrusted_peer() -> None:
    request = build_request(
        '203.0.113.25',
        {'X-Real-IP': '9.9.9.9'},
    )

    assert resolve_client_ip(request, '127.0.0.1,::1') == '203.0.113.25'


def test_resolve_client_ip_rejects_multiple_values_in_real_ip() -> None:
    request = build_request(
        '127.0.0.1',
        {'X-Real-IP': '9.9.9.9, 203.0.113.10'},
    )

    assert resolve_client_ip(request, '127.0.0.1,::1') == '127.0.0.1'


def test_resolve_client_ip_supports_ipv6_loopback_proxy() -> None:
    request = build_request('::1', {'X-Forwarded-For': '2001:db8::42'})

    assert resolve_client_ip(request, '127.0.0.1,::1') == '2001:db8::42'


def test_parse_trusted_proxy_hosts_ignores_invalid_values() -> None:
    assert parse_trusted_proxy_hosts('127.0.0.1, invalid, ::1') == frozenset(
        {'127.0.0.1', '::1'}
    )
