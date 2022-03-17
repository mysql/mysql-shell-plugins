# Copyright (c) 2020, 2022, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is also distributed with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have included with MySQL.
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

from encodings import utf_8
from mysqlsh.plugin_manager import plugin_function
import gui_plugin.core.Logger as logger
from pathlib import Path
from .lib import get_os_name, run_system_command, create_certificate_installer, create_certificate_uninstaller


@plugin_function('gui.core.isShellWebCertificateInstalled', shell=True, cli=True, web=True)
def is_shell_web_certificate_installed(**kwargs):
    """Checks if the MySQL Shell GUI webserver certificate is installed

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        check_keychain (bool): Check if not only the certificates have been
            created but also installed into the keychain

    Returns:
       True if installed
    """

    import os.path
    import mysqlsh.plugin_manager.general
    import platform

    check_keychain = kwargs.get("check_keychain", True)

    cert_path = mysqlsh.plugin_manager.general.get_shell_user_dir(
        "plugin_data", "gui_plugin", "web_certs")

    if not os.path.isdir(cert_path):
        return False

    if not os.path.isfile(os.path.join(cert_path, "rootCA.crt")):
        return False

    check_string = ''
    if check_keychain:
        os_name = get_os_name()
        if os_name == "Darwin":
            # Keychain Access.app can be used on macOS to manually check certs
            cmd = ["security", "find-certificate", "-a",
                   os.path.join(os.path.expanduser("~"),
                                "Library", "Keychains", "login.keychain-db")]
            check_string = (
                '"labl"<blob>="MySQL Shell Auto Generated CA Certificate"')
        elif os_name == "Windows":
            # cSpell:ignore certutil
            # certmgr.msc can be used on Windows to manually check certs
            cmd = ["certutil", "-verifystore", "-user", "ROOT",
                   "MySQL Shell Auto Generated CA Certificate"]
            check_string = 'CN=MySQL Shell Auto Generated CA Certificate'
        elif os_name in ["OracleLinux", "RedHat", "Fedora"]:
            cmd = ["trust", "list"]
            check_string = 'MySQL Shell Auto Generated CA Certificate'
        else:
            # Assumes the rest are linuxes that work with the certutil
            home_dir = Path.home()
            if not home_dir:
                raise Exception("No home directory set")
            cert_db_path = os.path.join(home_dir, ".pki", "nssdb")
            cmd = ["certutil", "-d", cert_db_path,
                   "-L", "-n", "MySQL Shell"]
            check_string = 'CN=MySQL Shell Auto Generated CA Certificate'
        try:
            exit_code, output = run_shell_cmd(cmd)

            # cSpell:ignore labl
            if not exit_code is None or not check_string in output:
                return False
        except Exception as e:
            logger.exception(e)
            return False

    return True


@plugin_function('gui.core.installShellWebCertificate', shell=True, cli=True, web=True)
def install_shell_web_certificate(**kwargs):
    """Installs the MySQL Shell GUI webserver certificate

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        keychain (bool): Install the cert in the users keychain
        replace_existing (bool): Whether to replace an existing certificate

    Returns:
       True if successfully installed
    """

    import mysqlsh.plugin_manager.general
    from pathlib import Path
    import os.path
    import platform

    replace_existing = kwargs.get("replace_existing")
    keychain = kwargs.get("keychain", True)

    # If the certificate is already installed and should not be replaced,
    # return right away
    if (not replace_existing and
            is_shell_web_certificate_installed(check_keychain=True)):
        return True

    cert_path = mysqlsh.plugin_manager.general.get_shell_user_dir(
        "plugin_data", "gui_plugin", "web_certs")
    Path(cert_path).mkdir(parents=True, exist_ok=True)

    ret_val = create_certificate(cert_path)

    # Install the certificate in the users keychain
    if keychain:
        system = platform.system()
        cmd = None
        if system == "Darwin":
            cmd = ["security", "add-trusted-cert", "-r", "trustRoot", "-k",
                   os.path.join(os.path.expanduser("~"),
                                "Library", "Keychains", "login.keychain-db"),
                   os.path.join(cert_path, "rootCA.crt")]
        elif system == "Windows":
            cmd = ["certutil", "-addstore", "-user", "-f", "ROOT",
                   os.path.join(cert_path, "rootCA.crt")]
        else:
            installer_path = create_certificate_installer()

            # Verifies if gnome-terminal is available
            exit_code, output = run_system_command(['which', 'gnome-terminal'])
            if exit_code == 0:
                cmd = [output, '--wait', '--', installer_path]
            else:
                exit_code, output = run_system_command(['which', 'xterm'])
                if exit_code == 0:
                    cmd = [output, '-e', installer_path]
                else:
                    raise SystemError("UNABLE to find terminal!")

        try:
            exit_code, output = run_shell_cmd(cmd)
            if not exit_code is None:
                raise SystemError(output)
        except Exception as e:
            logger.exception(e)
            ret_val = False

    return ret_val


@plugin_function('gui.core.removeShellWebCertificate', shell=True, cli=True, web=True)
def remove_shell_web_certificate():
    """Removes the MySQL Shell GUI webserver certificate

    Returns:
       True if successfully removed
    """

    import mysqlsh.plugin_manager.general
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.backends import default_backend
    import platform
    import os.path
    import shutil

    cert_path = mysqlsh.plugin_manager.general.get_shell_user_dir(
        "plugin_data", "gui_plugin", "web_certs")

    if not os.path.isdir(cert_path):
        logger.info("No certificate installed.")
        return False

    if is_shell_web_certificate_installed(check_keychain=True):
        root_ca_path = os.path.join(cert_path, "rootCA.crt")

        with open(root_ca_path, "rb") as cert_file:
            cert_file_string = cert_file.read()
        cert = x509.load_pem_x509_certificate(
            cert_file_string, backend=default_backend())

        sha1 = cert.fingerprint(hashes.SHA1()).hex()

        system = platform.system()
        cmd = None
        if system == "Darwin":
            cmd = ["security", "delete-certificate", "-Z", sha1, "-t",
                   os.path.join(os.path.expanduser("~"),
                                "Library", "Keychains", "login.keychain-db")]
        elif system == "Windows":
            cmd = ["certutil", "-delstore", "-user", "ROOT",
                   "MySQL Shell Auto Generated CA Certificate"]
        else:
            uninstaller_path = create_certificate_uninstaller()

            # Verifies if gnome-terminal is available
            exit_code, output = run_system_command(['which', 'gnome-terminal'])
            if exit_code == 0:
                cmd = [output, '--wait', '--', uninstaller_path]
            else:
                exit_code, output = run_system_command(['which', 'xterm'])
                if exit_code == 0:
                    cmd = [output, '-e', uninstaller_path]
                else:
                    raise SystemError("UNABLE to find terminal!")

        try:
            exit_code, output = run_shell_cmd(cmd)
            if not exit_code is None:
                raise SystemError(output)

            logger.info("Certificate deleted from keystore.")
        except Exception as e:
            logger.exception(e)
            return False

    # Remove cert folder
    shutil.rmtree(cert_path)
    logger.info("Certificate folder removed.")

    return True


def create_certificate(cert_path):
    """Creates a certificate and related files

    Args:
        cert_path (str): The path the certificate and related files should
            be created in

    Returns:
       The output of the process
    """

    try:
        # ----------------------------------------------------
        # Attributes to be used on the certificate generation
        # ----------------------------------------------------
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        import datetime
        import os
        import platform

        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, u"US"),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, u"Texas"),
            x509.NameAttribute(NameOID.LOCALITY_NAME, u"Austin"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, u"Oracle"),
            x509.NameAttribute(
                NameOID.ORGANIZATIONAL_UNIT_NAME, u"MySQL"),
            x509.NameAttribute(NameOID.EMAIL_ADDRESS,
                               u"support@mysql.com"),
            x509.NameAttribute(NameOID.COMMON_NAME,
                               u"MySQL Shell Auto Generated CA Certificate"),
        ])

        today = datetime.datetime.today()
        one_day = datetime.timedelta(1, 0, 0)

        # Default validity for the certificates is 10 years
        validity = one_day * 365 * 10

        # In OSX TLS server certificates must have a validity period of 825
        # days or fewer: to be set as today + validity
        if platform.system() == "Darwin":
            validity = one_day * 824

        # ---------------------------------------------
        # Generation of the Private Key for the Root CA
        # ---------------------------------------------
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.backends import default_backend

        ca_private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend())

        # --------------------------------
        # Generation of the CA certificate
        # --------------------------------
        from cryptography.hazmat.primitives import hashes

        ca_public_key = ca_private_key.public_key()
        ca_builder = x509.CertificateBuilder()
        ca_builder = ca_builder.subject_name(subject)
        ca_builder = ca_builder.issuer_name(issuer)
        ca_builder = ca_builder.not_valid_before(today - one_day)
        ca_builder = ca_builder.not_valid_after(today + validity)
        ca_builder = ca_builder.serial_number(x509.random_serial_number())
        ca_builder = ca_builder.public_key(ca_public_key)

        # CA should be True in order enable registration in Firefox
        ca_builder = ca_builder.add_extension(
            x509.BasicConstraints(ca=True, path_length=None), critical=False)

        ca_builder = ca_builder.add_extension(
            x509.SubjectAlternativeName(
                [x509.DNSName(u'localhost')]
            ),
            critical=False
        )

        # Signs the CA certificate and creates the file
        ca_cert = ca_builder.sign(
            private_key=ca_private_key, algorithm=hashes.SHA256(),
            backend=default_backend()
        )

        # Serialization of the root CA certificate
        from cryptography.hazmat.primitives import serialization
        root_ca_path = os.path.join(cert_path, "rootCA.crt")
        with open(root_ca_path, "wb") as f:
            f.write(ca_cert.public_bytes(serialization.Encoding.PEM))

        # --------------------------------
        # Server Key
        # --------------------------------
        server_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend())

        # cSpell:ignore PKCS
        # Serialization of the Private Key
        pem = server_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )

        server_key_path = os.path.join(cert_path, "server.key")
        with open(server_key_path, 'wb') as pem_out:
            pem_out.write(pem)

        # ------------------
        # Server Certificate
        # ------------------
        cert_subject = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, u"US"),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, u"Texas"),
            x509.NameAttribute(NameOID.LOCALITY_NAME, u"Austin"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, u"Oracle"),
            x509.NameAttribute(
                NameOID.ORGANIZATIONAL_UNIT_NAME, u"MySQL"),
            x509.NameAttribute(NameOID.EMAIL_ADDRESS,
                               u"support@mysql.com"),
            x509.NameAttribute(NameOID.COMMON_NAME, u"localhost"),
        ])
        server_public_key = server_key.public_key()
        builder = x509.CertificateBuilder()
        builder = builder.issuer_name(ca_cert.issuer)

        builder = builder.subject_name(cert_subject)
        builder = builder.not_valid_before(today - one_day)
        builder = builder.not_valid_after(today + validity)

        builder = builder.add_extension(
            x509.SubjectAlternativeName(
                [x509.DNSName(u'localhost')]
            ),
            critical=False
        )

        builder = builder.serial_number(x509.random_serial_number())
        builder = builder.public_key(server_public_key)
        builder = builder.add_extension(
            x509.BasicConstraints(
                ca=False, path_length=None), critical=False)

        # Sets the CA Authority for the server cert using the CA Key
        authority_key = x509.AuthorityKeyIdentifier.from_issuer_public_key(
            ca_public_key)
        builder = builder.add_extension(authority_key, critical=False)

        # Defines the use cases for the server certificate
        key_usage = x509.KeyUsage(digital_signature=True, key_encipherment=True, key_cert_sign=False,
                                  key_agreement=False, content_commitment=True, data_encipherment=True,
                                  crl_sign=False, encipher_only=False, decipher_only=False)
        builder = builder.add_extension(key_usage, critical=False)

        builder = builder.add_extension(
            x509.ExtendedKeyUsage([x509.oid.ExtendedKeyUsageOID.SERVER_AUTH]), critical=False
        )

        # Signs the server certificate using the CA private key
        certificate = builder.sign(
            private_key=ca_private_key, algorithm=hashes.SHA256(), backend=default_backend())

        # Serialization of the Server Certificate
        server_crt_path = os.path.join(cert_path, "server.crt")
        with open(server_crt_path, "wb") as f:
            f.write(certificate.public_bytes(serialization.Encoding.PEM))

    except Exception as e:
        logger.exception(e)
        return False

    return True


def run_shell_cmd(cmd):
    """Runs the given shell command

    Args:
        cmd (list): The shell command to execute with parameters

    Returns:
       A tuple containing exit code and output, if process succeeded exit code is None
    """

    stream = popen(cmd)
    output = stream.read()
    exit_code = stream.close()

    return (exit_code, output)


def popen(cmd, mode="r", buffering=-1):
    """A custom implementation of popen that redirects STDERR to STDOUT

    Args:
        cmd (str): The shell command to execute
        mode (str): The mode as in os.popen
        buffering (int): The buffering ias in os.popen

    Returns:
       The output of the process
    """

    if mode not in ("r", "w"):
        raise ValueError("invalid mode %r" % mode)
    if buffering == 0 or buffering is None:
        raise ValueError("popen() does not support unbuffered streams")
    import subprocess
    import io
    # cSpell:ignore bufsize
    if mode == "r":
        proc = subprocess.Popen(cmd,
                                text=True,
                                stdout=subprocess.PIPE,
                                stderr=subprocess.STDOUT,
                                bufsize=buffering)
        return _wrap_close(proc.stdout, proc)
    else:
        proc = subprocess.Popen(cmd,
                                text=True,
                                stdin=subprocess.PIPE,
                                stderr=subprocess.STDOUT,
                                bufsize=buffering)
        return _wrap_close(proc.stdin, proc)

# Helper for popen() -- a proxy for a file whose close waits for the process


class _wrap_close:
    def __init__(self, stream, proc):
        self._stream = stream
        self._proc = proc

    def close(self):
        self._stream.close()
        returncode = self._proc.wait()
        if returncode == 0:
            return None
        # if name == 'nt':
        #    return returncode
        else:
            return returncode << 8  # Shift left to match old behavior

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    def __getattr__(self, name):
        return getattr(self._stream, name)

    def __iter__(self):
        return iter(self._stream)
