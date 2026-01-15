"""Client IP extraction with safe reverse-proxy support.

When running behind a reverse proxy (e.g. nginx in Docker), the peer address is
the proxy container IP, not the real end-user.

This helper only trusts forwarding headers when the immediate peer is a trusted
proxy (to avoid spoofing).
"""

from __future__ import annotations

from ipaddress import ip_address, ip_network, IPv4Address, IPv6Address, IPv4Network, IPv6Network
from typing import Iterable, Optional, Union

from starlette.requests import Request


def _parse_networks(values: Iterable[str]) -> list[Union[IPv4Network, IPv6Network]]:
    networks: list[Union[IPv4Network, IPv6Network]] = []
    for raw in values:
        value = (raw or "").strip()
        if not value:
            continue
        try:
            # Allow either CIDR networks or single IPs
            if "/" in value:
                networks.append(ip_network(value, strict=False))
            else:
                addr = ip_address(value)
                networks.append(ip_network(f"{addr}/{addr.max_prefixlen}", strict=False))
        except ValueError:
            # Ignore malformed entries (keeps startup resilient)
            continue
    return networks


def _ip_in_networks(ip: str, networks: list[Union[IPv4Network, IPv6Network]]) -> bool:
    try:
        addr: Union[IPv4Address, IPv6Address] = ip_address(ip)
        # Docker / some proxies may present IPv4 as IPv6-mapped (e.g. ::ffff:172.18.0.1).
        # Normalize so IPv4 CIDRs (like 172.16.0.0/12) correctly match.
        if isinstance(addr, IPv6Address) and addr.ipv4_mapped is not None:
            addr = addr.ipv4_mapped
    except ValueError:
        return False
    return any(addr in net for net in networks)


def _first_forwarded_for(x_forwarded_for: str) -> Optional[str]:
    # X-Forwarded-For: client, proxy1, proxy2
    for part in x_forwarded_for.split(","):
        candidate = part.strip().strip('"')
        if candidate:
            return candidate
    return None


def _forwarded_for(forwarded: str) -> Optional[str]:
    # Forwarded: for=1.2.3.4;proto=https;by=...
    # Forwarded: for="[2001:db8:cafe::17]:4711"
    lowered = forwarded
    for token in lowered.split(","):
        parts = token.split(";")
        for p in parts:
            p = p.strip()
            if not p.lower().startswith("for="):
                continue
            value = p[4:].strip().strip('"')
            # Strip port if present
            if value.startswith("[") and "]" in value:
                # IPv6 in brackets, optionally with :port
                inside = value[1:value.index("]")]
                return inside
            if ":" in value and value.count(":") == 1:
                # IPv4:port
                return value.split(":", 1)[0]
            return value
    return None


def get_client_ip(request: Request, trusted_proxy_values: Iterable[str]) -> Optional[str]:
    """Return the real client IP for a request.

    If the immediate peer is a trusted proxy, this prefers:
    - X-Forwarded-For (first value)
    - X-Real-IP
    - Forwarded (for=...)

    Otherwise returns the peer IP (request.client.host).
    """
    peer_ip = request.client.host if request.client else None
    if not peer_ip:
        return None

    trusted_networks = _parse_networks(trusted_proxy_values)
    if not trusted_networks or not _ip_in_networks(peer_ip, trusted_networks):
        return peer_ip

    xff = request.headers.get("x-forwarded-for")
    if xff:
        forwarded_ip = _first_forwarded_for(xff)
        if forwarded_ip and _is_valid_ip(forwarded_ip):
            return forwarded_ip

    x_real_ip = request.headers.get("x-real-ip")
    if x_real_ip and _is_valid_ip(x_real_ip.strip()):
        return x_real_ip.strip()

    forwarded = request.headers.get("forwarded")
    if forwarded:
        forwarded_ip = _forwarded_for(forwarded)
        if forwarded_ip and _is_valid_ip(forwarded_ip):
            return forwarded_ip

    return peer_ip


def _is_valid_ip(value: str) -> bool:
    try:
        ip_address(value)
        return True
    except ValueError:
        return False
