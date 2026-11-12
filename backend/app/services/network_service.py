import os
import socket
import subprocess
from typing import Any, Dict, List, Optional


def get_all_network_interfaces() -> List[Dict[str, Any]]:
    """
    Detect all non-loopback IPv4 addresses on active network interfaces.
    Returns list of dicts with ip, name, and is_primary flag.
    """
    interfaces: List[Dict[str, Any]] = []
    seen_ips = set()

    # 1. Determine primary outbound IP
    primary_ip = None
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.6)
        s.connect(("8.8.8.8", 80))
        primary_ip = s.getsockname()[0]
        s.close()
    except Exception:
        pass

    # 2. On Windows, use PowerShell to get friendly interface names (Wi-Fi, Ethernet, Hotspot)
    if os.name == "nt":
        try:
            cmd = [
                "powershell",
                "-NoProfile",
                "-Command",
                "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object IPAddress, InterfaceAlias | ConvertTo-Csv -NoTypeInformation",
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=3)
            if res.returncode == 0:
                lines = [line.strip().replace('"', "") for line in res.stdout.strip().splitlines() if line.strip()]
                for line in lines[1:]:  # skip header
                    parts = [p.strip() for p in line.split(",") if p.strip()]
                    if len(parts) >= 2:
                        ip, alias = parts[0], parts[1]
                        if ip and ip not in seen_ips and not ip.startswith("127.") and not ip.startswith("169.254."):
                            seen_ips.add(ip)
                            interfaces.append({
                                "name": alias,
                                "ip": ip,
                                "is_primary": (ip == primary_ip),
                            })
        except Exception:
            pass

    # 3. Fallback / supplementary socket enumeration
    try:
        hostname = socket.gethostname()
        for ip in socket.gethostbyname_ex(hostname)[2]:
            if ip not in seen_ips and not ip.startswith("127.") and not ip.startswith("169.254."):
                seen_ips.add(ip)
                interfaces.append({
                    "name": f"Interface ({ip})",
                    "ip": ip,
                    "is_primary": (ip == primary_ip),
                })
    except Exception:
        pass

    # If primary_ip was detected but not in interfaces, add it
    if primary_ip and primary_ip not in seen_ips:
        interfaces.insert(0, {
            "name": "Default Gateway Outbound",
            "ip": primary_ip,
            "is_primary": True,
        })
    elif interfaces:
        # Ensure at least one is flagged as primary
        if not any(i["is_primary"] for i in interfaces):
            interfaces[0]["is_primary"] = True

    # Ultimate fallback if no network interfaces found (e.g. offline laptop)
    if not interfaces:
        interfaces.append({
            "name": "Localhost Only (Offline)",
            "ip": "127.0.0.1",
            "is_primary": True,
        })

    return interfaces


def get_network_info(http_port: int = 8000, https_port: int = 8443) -> Dict[str, Any]:
    """Get complete network status for desktop and mobile clients."""
    interfaces = get_all_network_interfaces()
    primary = next((i for i in interfaces if i["is_primary"]), interfaces[0])
    primary_ip = primary["ip"]

    return {
        "primary_ip": primary_ip,
        "primary_interface_name": primary["name"],
        "interfaces": interfaces,
        "http_port": http_port,
        "https_port": https_port,
        "primary_https_url": f"https://{primary_ip}:{https_port}",
        "primary_http_url": f"http://{primary_ip}:{http_port}",
        "localhost_http_url": f"http://localhost:{http_port}",
        "localhost_https_url": f"https://localhost:{https_port}",
    }
