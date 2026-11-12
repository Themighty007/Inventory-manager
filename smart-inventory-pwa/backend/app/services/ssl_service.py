import datetime
import ipaddress
import socket
from pathlib import Path
from typing import List, Optional

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID


def ensure_ssl_certificates(
    cert_path: Path,
    key_path: Path,
    additional_ips: Optional[List[str]] = None,
    force_regenerate: bool = False,
) -> bool:
    """
    Ensure valid SSL certificate exists with Subject Alternative Names (SANs)
    covering localhost, 127.0.0.1, hostname, and all active LAN IP addresses.
    """
    cert_path = Path(cert_path)
    key_path = Path(key_path)

    # Check if existing certificate already has the needed SANs
    if cert_path.exists() and key_path.exists() and not force_regenerate:
        try:
            cert_bytes = cert_path.read_bytes()
            existing_cert = x509.load_pem_x509_certificate(cert_bytes)
            # Check expiration (needs at least 30 days left)
            now = datetime.datetime.now(datetime.timezone.utc)
            if existing_cert.not_valid_after_utc > now + datetime.timedelta(days=30):
                # Check SAN extension contains all requested IPs
                try:
                    san_ext = existing_cert.extensions.get_extension_for_oid(x509.OID_SUBJECT_ALTERNATIVE_NAME)
                    san_ips = {str(item.value) for item in san_ext.value if isinstance(item, x509.IPAddress)}
                    needed_ips = set(additional_ips or [])
                    # If all needed IPs are present in the certificate, keep it
                    if needed_ips.issubset(san_ips):
                        return True
                except Exception:
                    pass
        except Exception:
            pass  # Corrupted or unreadable, regenerate

    # Generate new RSA private key (2048-bit)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    # Compile SAN list
    san_list: List[x509.GeneralName] = [
        x509.DNSName("localhost"),
        x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
    ]

    try:
        host = socket.gethostname()
        if host:
            san_list.append(x509.DNSName(host))
    except Exception:
        pass

    seen_ips = {"127.0.0.1"}
    if additional_ips:
        for ip_str in additional_ips:
            if ip_str and ip_str not in seen_ips:
                try:
                    ip_obj = ipaddress.IPv4Address(ip_str)
                    if not ip_obj.is_loopback:
                        san_list.append(x509.IPAddress(ip_obj))
                        seen_ips.add(ip_str)
                except Exception:
                    pass

    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, "SKR Tech Inventory System"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "SKR Tek Hardware Innovations"),
        x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, "Electronics Lab"),
        x509.NameAttribute(NameOID.COUNTRY_NAME, "IN"),
    ])

    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=1825))  # 5 years
        .add_extension(x509.SubjectAlternativeName(san_list), critical=False)
        .add_extension(
            x509.BasicConstraints(ca=False, path_length=None),
            critical=True,
        )
        .sign(key, hashes.SHA256())
    )

    cert_path.parent.mkdir(parents=True, exist_ok=True)
    key_path.write_bytes(
        key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    return True
