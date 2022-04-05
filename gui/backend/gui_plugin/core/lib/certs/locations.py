# Copyright (c) 2022, Oracle and/or its affiliates.
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
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USAfrom gettext import install
import shutil
from mysqlsh.plugin_manager import general
from gui_plugin.core import lib
import gui_plugin.core.Logger as logger
import os
import filecmp
from pathlib import Path
import enum
from gui_plugin.core.lib.certs import management
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat import backends
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives.asymmetric import rsa
import tempfile

BOLD = "\\033[1m"
NOBOLD = "\\033[0m"


class Type(enum.Enum):
    USER_HOME = 0
    CA_CERTS_FOLDER = 1
    SSL_CERTS = 2
    NSS_DB = 3
    TRUST = 4
    MACOS = 5
    WIN = 6


def get_cert_sha1(cert_path):
    with open(cert_path, "rb") as cert_file:
        cert_file_string = cert_file.read()
    cert = x509.load_pem_x509_certificate(
        cert_file_string, backend=backends.default_backend())

    return cert.fingerprint(hashes.SHA1()).hex()


class Cert_location:
    def __init__(self, id, desc, scripted):
        self._id = id
        self._desc = desc
        self._scripted = scripted

        self._valid = None
        self._error = None
        self._sha1 = None

    def __str__(self) -> str:
        invalid_reason = ''
        if self.valid is False and self._error is not None:
            invalid_reason = f', Reason: {self._error}'
        return f"{self.id.name}: {self.desc}, [Installed: {str(self.installed)}, Valid: {str(self.valid)}{invalid_reason}]"

    def _is_installed(self):
        raise NotImplementedError()

    def _get_sha1(self):
        raise NotImplementedError()

    def _is_valid(self):
        return self.installed and self.unique

    def _is_unique(self):
        return True

    @property
    def id(self):
        return self._id

    @property
    def desc(self):
        return self._desc

    @property
    def sha1(self):
        if self._sha1 is None:
            self._sha1 = self._get_sha1()
        return self._sha1

    @property
    def scripted(self):
        return self._scripted

    @property
    def valid(self):
        self._error = None
        self._valid = self._is_valid()

        # This is to honor when the certificate was intentionally invalidated from the outside
        return self._valid

    @valid.setter
    def valid(self, value):
        if not value:
            self.error = None
            self.error = "The certificate was invalidated"
        self._valid = value

    @property
    def error(self):
        return self._error

    @error.setter
    def error(self, value):
        # Prevents overwriting the error but allows resetting
        if self._error is None or value is None:
            self._error = value

    @property
    def unique(self):
        if not self._is_unique():
            self.error = f"Multiple certificates installed at {self.desc}"
        return self._is_unique()

    @ property
    def installed(self):
        if not self._is_installed():
            self.error = f"The certificate is not installed at {self.desc}"
            return False
        return True

    def install(self):
        raise NotImplementedError()

    def uninstall(self):
        raise NotImplementedError()

    def get_install_script(self, padding=0):
        raise NotImplementedError()

    def get_uninstall_script(self, padding=0):
        raise NotImplementedError()


class User_home(Cert_location):
    def __init__(self):
        super().__init__(Type.USER_HOME, general.get_shell_user_dir(
            "plugin_data", "gui_plugin", "web_certs", "rootCA.crt"), False)

    def _is_installed(self):
        return os.path.isfile(self.desc)

    def _get_sha1(self):
        return get_cert_sha1(self.desc) if self.installed else None

    def install(self):
        cert_path = os.path.dirname(self.desc)
        Path(cert_path).mkdir(parents=True, exist_ok=True)
        return management.create_certificate(cert_path)

    def uninstall(self):
        os.remove(self.desc)
        return True


class Dependent_cert(Cert_location):
    def __init__(self, id, desc, scripted, parent_cert):
        super().__init__(id, desc, scripted)
        self.parent_cert = parent_cert

    def _parent_invalidates(self):
        return True

    def _is_valid(self):
        ret_val = super()._is_valid()

        if ret_val and not self.parent_cert.valid:
            self.error = f"Certificate at {self.parent_cert.desc} is invalid"
            ret_val = False

        if ret_val and not self._matches_parent():
            self.error = f"Certificate at {self.desc} does not match the certificate at {self.parent_cert.desc}"
            ret_val = False

        return ret_val

    def _matches_parent(self):
        return self.sha1 == self.parent_cert.sha1


class Ca_cert_folder(Dependent_cert):
    def __init__(self, parent_cert):
        super().__init__(Type.CA_CERTS_FOLDER,
                         "/usr/local/share/ca-certificates/rootCA.crt", True, parent_cert)

    def _is_installed(self):
        return os.path.isfile(self.desc)

    def _get_sha1(self):
        return get_cert_sha1(self.desc) if self.installed else None

    def get_install_script(self, padding=0):
        s = ' ' * padding
        return f"""
{s}# Install the UI certificate on the system
{s}echo -e "{BOLD}Copying the certificate to: {self.desc}{NOBOLD}"
{s}sudo cp {self.parent_cert.desc} {self.desc}
{s}if [ "$?" != "0" ]; then
{s}    echo "Failed copying the certificate..."
{s}    read -r -p "Press any key to continue..." response
{s}    exit 1
{s}fi

"""

    def get_uninstall_script(self, padding=0):
        s = ' ' * padding
        return f"""
{s}# Removing the certificate copy from {self.desc}
{s}echo -e "{BOLD}Removing the certificate copy at {self.desc}{BOLD}"
{s}sudo rm {self.desc}
{s}if [ "$?" != "0" ]; then
{s}    echo "Failed removing the certificate from the system"
{s}    read -r -p "Press any key to continue..." response
{s}    exit 1
{s}fi

"""


class Ssl_cert_folder(Dependent_cert):
    def __init__(self, parent_cert):
        super().__init__(Type.SSL_CERTS, "/etc/ssl/certs/rootCA.pem", True, parent_cert)

    def _is_installed(self):
        return os.path.islink(self.desc) or os.path.exists(self.desc)

    def _get_sha1(self):
        return None

    def _matches_parent(self):
        if os.path.realpath(self.desc) != self.parent_cert.desc:
            self.error = f"Certificate does not link to {self.parent_cert.desc}"
            return False
        return True

    def get_install_script(self, padding=0):
        s = ' ' * padding
        return f"""
{s}echo -e "{BOLD}Updating the system certificates...{NOBOLD}"
{s}sudo update-ca-certificates
{s}if [ "$?" != "0" ]; then
{s}    echo "Failed updating the system certificates"
{s}    read -r -p "Press any key to continue..." response
{s}    exit 1
{s}fi

"""

    def get_uninstall_script(self, padding=0):
        s = ' ' * padding
        return f"""
{s}# Removing the certificate link at {self.desc}
{s}sudo rm {self.desc}
{s}if [ "$?" != "0" ]; then
{s}    echo "Failed removing the certificate link at {self.desc}"
{s}    read -r -p "Press any key to continue..." response
{s}    exit 1
{s}fi

{s}echo -e "{BOLD}Updating the system certificates...{NOBOLD}"
{s}sudo update-ca-certificates
{s}if [ "$?" != "0" ]; then
{s}    echo "Failed updating the system certificates"
{s}    read -r -p "Press any key to continue..." response
{s}    exit 1
{s}fi

"""


class Store_cert(Dependent_cert):
    def __init__(self, type, description, scripted, parent_cert):
        super().__init__(type, description, scripted, parent_cert)
        self._installed_certs = []

    def _is_installed(self):
        self._installed_certs = self._get_installed_certs()
        return len(self._installed_certs) > 0

    def _get_sha1(self):
        return self._installed_certs[0] if self.installed and self.unique else None

    def _is_unique(self):
        return len(self._installed_certs) == 1

    def _get_installed_certs(self):
        raise NotImplementedError()

    def install(self):
        cmd = self._get_install_command()
        try:
            exit_code, output = lib.run_shell_cmd(cmd)

            if not exit_code is None:
                raise SystemError(output)
        except Exception as e:
            logger.exception(e)
            return False
        return True

    def _get_install_command(self):
        raise NotImplementedError()

    def uninstall(self):
        cmd = self._get_uninstall_command()
        try:
            exit_code, output = lib.run_shell_cmd(cmd)

            if not exit_code is None:
                raise SystemError(output)
        except Exception as e:
            logger.exception(e)
            return False
        return True

    def _get_uninstall_command(self):
        raise NotImplementedError()


class Nss_db(Store_cert):
    def __init__(self, parent_cert):
        super().__init__(Type.NSS_DB, "User NSS Database",
                         lib.certs.management.linux_has_certutil() is False, parent_cert)

    def _get_nss_db_path(self):
        home_dir = Path.home()
        if not home_dir:
            raise Exception("No home directory set")

        return os.path.join(home_dir, ".pki", "nssdb")

    def _get_installed_certs(self):
        cmd = ["certutil", "-d", self._get_nss_db_path(), "-L", "-n",
               "MySQL Shell"]
        installed = []

        try:
            exit_code, output = lib.run_shell_cmd(cmd)
            if exit_code is None:
                next_is_sha1 = False
                for line in output.split("\n"):
                    line = line.strip()

                    if next_is_sha1:
                        installed.append(line.replace(":", "").lower())
                        next_is_sha1 = False
                    elif line.startswith("Fingerprint (SHA1):"):
                        next_is_sha1 = True

        except Exception as e:
            logger.exception(e)

        return installed

    def _get_install_command(self):
        return ["certutil", "-d", f"sql:{self._get_nss_db_path()}", "-A", "-t", "C,,", "-n", "MySQL Shell", "-i", self.parent_cert.desc]

    def _get_uninstall_command(self):
        return ["certutil", "-d", self._get_nss_db_path(), "-D", "-n", "MySQL Shell"]

    def get_install_script(self, padding=0):
        s = ' ' * padding
        return f"""
{s}certutil -d sql:{self._get_nss_db_path()} -A -t "C,," -n "MySQL Shell" -i {self.parent_cert.desc}

{s}if [ "$?" != "0" ]; then
{s}    echo "Failed registering the certificate on the NSS database"
{s}    read -r -p "Press any key to continue..." response
{s}    exit 1
{s}fi

"""

    def get_uninstall_script(self, padding=0):
        s = ' ' * padding
        return f"""
{s}# Removing the certificate(s) from the the {self.desc}
{s}certutil -d {self._get_nss_db_path()} -L -n "MySQL Shell" &> /dev/null
{s}while [ "$?" == "0" ]; do
{s}    echo -e "{BOLD}Removing the certificate from the {self.desc}{NOBOLD}"
{s}    certutil -d sql:{self._get_nss_db_path()} -D -n "MySQL Shell"

{s}    if [ "$?" != "0" ]; then
{s}        echo "Failed removing the certificate from the {self.desc}"
{s}        read -r -p "Press any key to continue..." response
{s}        exit 1
{s}    fi
{s}    certutil -d {self._get_nss_db_path()} -L -n "MySQL Shell" &> /dev/null
{s}done

"""


class Macos(Store_cert):
    def __init__(self, parent_cert):
        super().__init__(Type.MACOS, "macOS Certificate Store", False, parent_cert)

    def _get_installed_certs(self):
        cmd = ['security', 'find-certificate', '-Z', '-a', os.path.join(
            os.path.expanduser('~'), 'Library', 'Keychains', 'login.keychain-db')]
        vstring = '"labl"<blob>="MySQL Shell Auto Generated CA Certificate"'
        installed = []

        try:
            exit_code, output = lib.run_shell_cmd(cmd)
            cert = None
            if exit_code is None:
                for line in output.split("\n"):
                    line = line.strip()

                    if line.startswith("SHA-1 hash: "):
                        cert = line[12:]
                    elif vstring in line and cert is not None:
                        installed.append(cert.lower())
                        cert = None

        except Exception as e:
            logger.exception(e)

        return installed

    def _get_install_command(self):
        return ["security", "add-trusted-cert", "-r", "trustRoot", "-k",
                os.path.join(os.path.expanduser("~"),
                             "Library", "Keychains", "login.keychain-db"),
                self.parent_cert.desc]

    def _get_uninstall_command(self):
        cmd = []
        installed = self._get_installed_certs()
        if len(installed) > 0:
            cmd = ["security", "delete-certificate", "-Z", installed[0], "-t",
                   os.path.join(os.path.expanduser("~"),
                                "Library", "Keychains", "login.keychain-db")]

        return cmd


class Win(Store_cert):
    def __init__(self, parent_cert, scripted=False):
        super().__init__(Type.WIN, "WIN Certificate Store", scripted, parent_cert)

    def _matches_parent(self):
        return self._installed_certs[0] == get_cert_sha1(self.parent_cert.desc)

    def _get_installed_certs(self, serials=False):
        cmd = ["certutil.exe", "-verifystore", "-user", "ROOT",
               "MySQL Shell Auto Generated CA Certificate"]
        installed = []

        try:
            exit_code, output = lib.run_shell_cmd(cmd)

            if exit_code is None:
                current_cert = ""
                for line in output.split("\n"):
                    line = line.strip()

                    if line.startswith("================ Certificate"):
                        current_cert = line
                    elif serials and len(current_cert) and line.startswith("Serial Number: "):
                        installed.append(line[15:])
                        current_cert = ""
                    elif len(current_cert) and line.startswith("Cert Hash(sha1): "):
                        installed.append(line[17:].lower())
                        current_cert = ""
        except Exception as e:
            logger.exception(e)

        return installed

    def _get_install_command(self):
        return ["certutil.exe", "-addstore", "-user", "-f", "ROOT",
                self.parent_cert.desc]

    def _get_uninstall_command(self):
        return ["certutil.exe", "-delstore", "-user", "ROOT",
                "MySQL Shell Auto Generated CA Certificate"]


class Win_wsl2(Win):
    def __init__(self, parent_cert):
        super().__init__(parent_cert, True)

    def get_install_script(self, padding=0):
        s = ' ' * padding
        return f"""
{s}# Install the certificate
{s}(
{s}    cd {os.path.dirname(self.parent_cert.desc)}
{s}    certutil.exe -addstore -user -f ROOT {os.path.basename(self.parent_cert.desc)}

{s}    if [ "$?" != "0" ]; then
{s}        echo "Failed installing the certificate"
{s}        read -r -p "Press any key to continue..." response
{s}        exit 1
{s}    fi
{s})

"""

    def get_uninstall_script(self, padding=0):
        # The certificate uninstall process is done based on the installed shell certificates
        certs = " ".join(self._get_installed_certs(True))
        s = ' ' * padding
        return f"""
{s}# Removing the certificate(s) from the {self.desc}
{s}certs="{certs}"

{s}for cert in $certs
{s}do
{s}    certutil.exe -delstore -user ROOT $cert

{s}    if [ "$?" != "0" ]; then
{s}        echo "Failed removing the certificate"
{s}        read -r -p "Press any key to continue..." response
{s}        exit 1
{s}    fi
{s}done

"""


class Trust(Store_cert):
    def __init__(self, parent_cert):
        super().__init__(Type.TRUST, "Trust Policy Store", True, parent_cert)

    def _get_sha1(self):
        ret_val = None
        try:
            # Create a temporary copy of the installed certificate
            tmp_file_name = tempfile.NamedTemporaryFile().name
            exit_code, output = lib.run_shell_cmd(
                ['trust', 'extract', '--format=pem-bundle', '--filter', self._installed_certs[0], "--overwrite", tmp_file_name])

            if not exit_code is None:
                raise SystemError(output)

            # Compare it to the certificate in USER_HOME
            ret_val = get_cert_sha1(tmp_file_name)

            os.remove(tmp_file_name)

        except Exception as e:
            logger.exception(e)

        return ret_val

    def _get_installed_certs(self):
        cmd = ["trust", "list"]
        vstring = 'MySQL Shell Auto Generated CA Certificate'
        installed = []

        try:
            exit_code, output = lib.run_shell_cmd(cmd)

            if exit_code is None:
                current_pkcs_uri = ""
                for line in output.split("\n"):
                    line = line.strip()

                    if line.startswith("pkcs11:id"):
                        current_pkcs_uri = line
                    elif len(current_pkcs_uri) and line.startswith("label:") and line[7:] == vstring:
                        installed.append(current_pkcs_uri)
                        current_pkcs_uri = ""
        except Exception as e:
            logger.exception(e)

        return installed

    def get_install_script(self, padding=0):
        s = ' ' * padding
        return f"""
{s}# Install the certificate
{s}sudo trust anchor {self.parent_cert.desc}

{s}if [ "$?" != "0" ]; then
{s}    echo "Failed installing the certificate"
{s}    read -r -p "Press any key to continue..." response
{s}    exit 1
{s}fi

"""

    def get_uninstall_script(self, padding=0):
        # The certificate uninstall process is done based on the installed shell certificates
        certs = " ".join(self._get_installed_certs())
        s = ' ' * padding
        return f"""
{s}# Removing the certificate(s) from the {self.desc}
{s}certs="{certs}"

{s}for cert in $certs
{s}do
{s}    sudo trust anchor --remove $cert

{s}    if [ "$?" != "0" ]; then
{s}        echo "Failed removing the certificate"
{s}        read -r -p "Press any key to continue..." response
{s}        exit 1
{s}    fi
{s}done

"""
