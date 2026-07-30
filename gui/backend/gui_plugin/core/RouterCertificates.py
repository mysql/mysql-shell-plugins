# Copyright (c) 2026, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is designed to work with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have either included with
# the program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

"""Private TLS material used only by Workbench-managed local MRS Routers."""

import datetime
import os

from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

from gui_plugin.core.Files import ensure_private_directory, ensure_private_file, get_plugin_data_path


def _subject(common_name):
    return x509.Name(
        [
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Oracle"),
            x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, "MySQL Workbench"),
            x509.NameAttribute(NameOID.COMMON_NAME, common_name),
        ]
    )


def ensure_router_certificate():
    """Create the private localhost certificate needed by local MRS Router instances."""

    cert_dir = get_plugin_data_path("mrs_plugin", "router_certs")
    cert_path = os.path.join(cert_dir, "server.crt")
    key_path = os.path.join(cert_dir, "server.key")
    if os.path.isfile(cert_path) and os.path.isfile(key_path):
        return True

    try:
        ensure_private_directory(cert_dir)
        now = datetime.datetime.now(datetime.timezone.utc)
        validity = datetime.timedelta(days=824)
        ca_key = rsa.generate_private_key(public_exponent=65537, key_size=2048, backend=default_backend())
        ca_subject = _subject("MySQL Workbench Local MRS Router CA")
        ca_cert = (
            x509.CertificateBuilder()
            .subject_name(ca_subject)
            .issuer_name(ca_subject)
            .public_key(ca_key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now - datetime.timedelta(days=1))
            .not_valid_after(now + validity)
            .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
            .sign(ca_key, hashes.SHA256(), default_backend())
        )
        server_key = rsa.generate_private_key(public_exponent=65537, key_size=2048, backend=default_backend())
        server_cert = (
            x509.CertificateBuilder()
            .subject_name(_subject("localhost"))
            .issuer_name(ca_cert.subject)
            .public_key(server_key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now - datetime.timedelta(days=1))
            .not_valid_after(now + validity)
            .add_extension(x509.SubjectAlternativeName([x509.DNSName("localhost")]), critical=False)
            .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
            .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
            .sign(ca_key, hashes.SHA256(), default_backend())
        )
        ensure_private_file(cert_path)
        with open(cert_path, "wb") as file:
            file.write(server_cert.public_bytes(serialization.Encoding.PEM))
        ensure_private_file(key_path)
        with open(key_path, "wb") as file:
            file.write(
                server_key.private_bytes(
                    serialization.Encoding.PEM,
                    serialization.PrivateFormat.PKCS8,
                    serialization.NoEncryption(),
                )
            )
    except Exception:
        return False

    return True
