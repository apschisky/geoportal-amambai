from collections.abc import Iterable
from ipaddress import ip_address

from fastapi import Request


UNKNOWN_CLIENT_HOST = 'unknown'


def _normalize_ip(value: str | None) -> str | None:
    if value is None:
        return None

    candidate = value.strip()
    if not candidate:
        return None

    try:
        return str(ip_address(candidate))
    except ValueError:
        return None


def parse_trusted_proxy_hosts(value: str | Iterable[str]) -> frozenset[str]:
    raw_hosts = value.split(',') if isinstance(value, str) else value
    return frozenset(
        normalized
        for host in raw_hosts
        if (normalized := _normalize_ip(host)) is not None
    )


def _single_forwarded_client_ip(header_value: str | None) -> str | None:
    if header_value is None:
        return None

    forwarded_chain = [part.strip() for part in header_value.split(',')]
    if len(forwarded_chain) != 1:
        return None

    return _normalize_ip(forwarded_chain[0])


def resolve_client_ip(
    request: Request,
    trusted_proxy_hosts: str | Iterable[str],
) -> str:
    peer_host = request.client.host if request.client else None
    normalized_peer = _normalize_ip(peer_host)
    if normalized_peer is None:
        return peer_host.strip() if peer_host and peer_host.strip() else UNKNOWN_CLIENT_HOST

    trusted_hosts = parse_trusted_proxy_hosts(trusted_proxy_hosts)
    if normalized_peer not in trusted_hosts:
        return normalized_peer

    forwarded_header = request.headers.get('x-forwarded-for')
    if forwarded_header is not None:
        forwarded_ip = _single_forwarded_client_ip(forwarded_header)
        return forwarded_ip if forwarded_ip is not None else normalized_peer

    real_ip = _normalize_ip(request.headers.get('x-real-ip'))
    if real_ip is not None:
        return real_ip

    return normalized_peer
