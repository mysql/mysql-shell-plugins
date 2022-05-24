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
from gui_plugin.core.lib import SystemUtils
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


class Cert_requirement:
    def __init__(self, desc, parent=None):
        self._desc = desc
        self.error = ""
        self._parent = parent
        self._met = self._verify() if self._parent is None or self._parent.met else False

    @property
    def met(self):
        return self._met

    @property
    def desc(self):
        return self._desc

    def _verify(self):
        raise NotImplementedError()

    def is_scripted(self):
        raise NotImplementedError()

    def get_script(self, padding=0):
        raise NotImplementedError()

    def get_install_command(self):
        raise NotImplementedError()


class Cert_location:
    def __init__(self, id, desc, scripted, deprecated=False, requirements=None):
        self._id = id
        self._desc = desc
        self._scripted = scripted
        self._deprecated = deprecated

        self._valid = None
        self._error = None
        self._sha1 = None
        self._installed = None
        self._requirements = requirements
        self._met_requirements = None

    def _check_requirements(self):
        if not self._requirements is None:
            for req in self._requirements:
                if not req.met:
                    self._met_requirements = False
                    self._error = f"Unable to verify certificate at {self.desc}: {req.error}"

                    # For now, assuming a script is required if the requirements were not met
                    self._scripted = req.is_scripted()
                    break

    def __str__(self) -> str:
        invalid_reason = ''
        if self._error is not None:
            invalid_reason = f', Reason: {self._error}'
        label = ""
        if self.deprecated:
            label = "(deprecated)"
        return f"{self.id.name}{label}: {self.desc}, [Installed: {str(self.installed)}, Valid: {str(self.valid)}{invalid_reason}]"

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
    def deprecated(self):
        return self._deprecated

    @property
    def valid(self):
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
        self._check_requirements()
        if self._met_requirements is False:
            return False

        if self._installed is None:
            self._installed = self._is_installed()
            if not self._installed:
                self.error = f"The certificate is not installed at {self.desc}"

        return self._installed

    @ property
    def requirements(self):
        return self._requirements

    def install(self):
        self._do_install()
        # Updates the installed flag accordingly
        self._installed = self._is_installed()

    def uninstall(self):
        self._do_uninstall()
        # Verifies if the certificate was really uninstalled, required to
        # properly handle duplicate certificates
        self._installed = self._is_installed()

    def _do_uninstall(self):
        raise NotImplementedError()

    def _get_requirement_script(self, padding=0):
        script = ""
        if not self._requirements is None:
            for req in self._requirements:
                if not req.met:
                    script += req.get_script(padding=padding)
                    script == "\n"
        return script

    def get_install_script(self, padding=0):
        script = self._get_requirement_script(padding=padding)
        script += self._get_cert_install_script(padding=padding)
        return script

    def _get_cert_install_script(self, padding=0):
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

    def _do_install(self):
        cert_path = os.path.dirname(self.desc)
        Path(cert_path).mkdir(parents=True, exist_ok=True)
        return management.create_certificate(cert_path)

    def _do_uninstall(self):
        cert_path = os.path.dirname(self.desc)
        Path(cert_path).mkdir(parents=True, exist_ok=True)
        return management.delete_certificate(cert_path)

    def _get_cert_install_script(self, padding=0):
        # No install script, this location is installed via install()
        return ""

    def get_uninstall_script(self, padding=0):
        s = ' ' * padding
        return f"""
{s}# Removing the certificate from {self.desc}
{s}echo -e "{BOLD}Removing the certificate from {self.desc}{BOLD}"
{s}rm {self.desc}
{s}if [ "$?" != "0" ]; then
{s}    echo "Failed removing the certificate"
{s}    read -r -p "Press any key to continue..." response
{s}    exit 1
{s}fi
"""


class Dependent_cert(Cert_location):
    def __init__(self, id, desc, scripted, parent_cert, deprecated=False, requirements=None):
        super().__init__(id, desc, scripted, deprecated=deprecated, requirements=requirements)
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

# TODO(rennox): to be deleted once the certificate install is considered complete with the NSS user database


class Ca_cert_folder(Dependent_cert):
    def __init__(self, parent_cert, deprecated=False):
        super().__init__(Type.CA_CERTS_FOLDER,
                         "/usr/local/share/ca-certificates/rootCA.crt", True, parent_cert, deprecated=deprecated)

    def _is_installed(self):
        return os.path.isfile(self.desc)

    def _get_sha1(self):
        return get_cert_sha1(self.desc) if self.installed else None

    def _get_cert_install_script(self, padding=0):
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

# TODO(rennox): to be deleted once the certificate install is considered complete with the NSS user database


class Ssl_cert_folder(Dependent_cert):
    def __init__(self, parent_cert, deprecated=False):
        super().__init__(Type.SSL_CERTS, "/etc/ssl/certs/rootCA.pem",
                         True, parent_cert, deprecated=deprecated)

    def _is_installed(self):
        return os.path.islink(self.desc) or os.path.exists(self.desc)

    def _get_sha1(self):
        return None

    def _matches_parent(self):
        if os.path.realpath(self.desc) != self.parent_cert.desc:
            self.error = f"Certificate does not link to {self.parent_cert.desc}"
            return False
        return True

    def _get_cert_install_script(self, padding=0):
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
    def __init__(self, type, description, scripted, parent_cert, deprecated=False, requirements=None):
        super().__init__(type, description, scripted,
                         parent_cert, deprecated=deprecated, requirements=requirements)
        self._installed_certs = []

    def get_cwd(self):
        return None

    def _is_installed(self):
        self._installed_certs = self._get_installed_certs()
        return len(self._installed_certs) > 0

    def _get_sha1(self):
        return self._installed_certs[0] if self.installed and self.unique else None

    def _is_unique(self):
        return len(self._installed_certs) == 1

    def _get_installed_certs(self):
        raise NotImplementedError()

    def _do_install(self):
        commands = self._get_install_commands()

        for cmd in commands:
            try:
                exit_code, output = lib.run_shell_cmd(cmd, cwd=self.get_cwd())

                if not exit_code is None:
                    raise SystemError(output)
            except Exception as e:
                logger.exception(e)
                return False
        return True

    def _get_install_commands(self):
        commands = []
        if not self._requirements is None:
            for req in self._requirements:
                if not req.met and not req.is_scripted():
                    commands.append(req.get_install_command())

        commands.append(self._get_install_command())

        return commands

    def _get_install_command(self):
        raise NotImplementedError()

    def _do_uninstall(self):
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


class Linux_certutil(Cert_requirement):
    def __init__(self):
        super().__init__("certutil")

    def _verify(self):
        if not lib.certs.management.linux_has_certutil():
            self.error = f"Missing {self._desc}"
            return False
        return True

    def is_scripted(self):
        return True

    def get_script(self, padding=0):
        os_type = SystemUtils.get_os_type()

        cert_util_package = "unknown"
        if os_type == "debian":
            cert_util_package = "libnss3-tools"
        elif os_type == "suse opensuse":
            cert_util_package = "mozilla-nss-tools"
        elif os_type == "fedora":
            cert_util_package = "nss-tools"

        s = ' ' * padding
        script = f"""
{s}# The certutil is required to install the UI certificate
{s}echo "Installing the certificate management utility: {cert_util_package}"
"""
        if os_type == "debian":
            script += f"""{s}sudo apt install -y {cert_util_package}
{s}rc=$?
{s}if [ "$rc" = "100" ]; then
{s}    echo "Package was not found, updating packages..."
{s}    sudo apt update
{s}    rc=$?
{s}    if [ "$rc" = "0" ]; then
{s}       sudo apt install -y {cert_util_package}
{s}       rc=$?
{s}    fi
{s}fi
"""
        elif os_type == "suse opensuse":
            script += f"""{s}sudo zypper install -y {cert_util_package}
{s}rc=$?"""

        elif os_type == "fedora":
            script += f"""{s}sudo yum install -y {cert_util_package}
{s}rc=$?"""

        script += f"""
{s}if [ "$rc" != "0" ]; then
{s}    echo "Failed installing {cert_util_package}"
{s}    read -r -p "Press any key to continue..." response
{s}    exit 1
{s}fi
"""
        return script


class Nss_user_database(Cert_requirement):
    def __init__(self, path, parent):
        self._db_path = path
        super().__init__("NSS User Database", parent=parent)

    def _verify(self):
        ret_val = True
        cmd = ["certutil", "-d", "sql:" + self._db_path, "-L"]

        try:
            exit_code, output = lib.run_shell_cmd(cmd)
            if exit_code is not None:
                self.error = output
                ret_val = False
        except Exception as e:
            self.error = str(e)
            ret_val = False

        return ret_val

    def is_scripted(self):
        # Parent is Linux_certutil, it if is installed this does not need to be scripted
        return self._parent.met is False

    def get_script(self, padding=0):
        s = ' ' * padding
        script = f"""
{s}# Verifying the user certificate database...
{s}echo "Verifying existence of the NSS database..."
{s}certutil -d {self._db_path} -L &> /dev/null
{s}if [ "$?" != "0" ]; then
{s}    echo "The NSS database does not exist, creating it..."

{s}    mkdir -p {self._db_path}
{s}    certutil -d sql:{self._db_path} -N --empty-password

{s}    if [ "$?" != "0" ]; then
{s}        echo "Failed initializing the NSS database"
{s}        read -r -p "Press any key to continue..." response
{s}        exit 1
{s}    fi
{s}fi
"""
        return script

    def get_install_command(self):
        return ["certutil", "-d", "sql:" + self._db_path, "-N", "--empty-password"]


class Nss_db_cert(Store_cert):
    def __init__(self, parent_cert):
        certutil_req = Linux_certutil()
        super().__init__(Type.NSS_DB, "NSS User Database",
                         False, parent_cert, requirements=[certutil_req, Nss_user_database(self._get_nss_db_path(False), certutil_req)])

    def _get_nss_db_path(self, prefixed=True):
        home_dir = Path.home()
        if not home_dir:
            raise Exception("No home directory set")

        if prefixed:
            return "sql:" + os.path.join(home_dir, ".pki", "nssdb")
        else:
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

    def _do_install(self):
        if not self._scripted:
            Path(self._get_nss_db_path(False)).mkdir(
                parents=True, exist_ok=True)
        return super()._do_install()

    def _get_install_command(self):
        return ["certutil", "-d", f"{self._get_nss_db_path()}", "-A", "-t", "C,,", "-n", "MySQL Shell", "-i", self.parent_cert.desc]

    def _get_uninstall_command(self):
        return ["certutil", "-d", self._get_nss_db_path(), "-D", "-n", "MySQL Shell"]

    def _get_cert_install_script(self, padding=0):
        s = ' ' * padding
        return f"""
{s}certutil -d {self._get_nss_db_path()} -A -t "C,," -n "MySQL Shell" -i {self.parent_cert.desc}

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
    def get_cwd(self):
        return os.path.dirname(self.parent_cert.desc)

    def __init__(self, parent_cert, scripted=False):
        super().__init__(Type.WIN, "WIN Certificate Store", scripted, parent_cert)

    def _matches_parent(self):
        return self._installed_certs[0] == get_cert_sha1(self.parent_cert.desc)

    def _get_installed_certs(self):
        cmd = ["certutil.exe", "-verifystore", "-user", "ROOT",
               "MySQL Shell Auto Generated CA Certificate"]
        installed = []

        try:
            exit_code, output = lib.run_shell_cmd(cmd)

            if exit_code is None:
                for line in output.split("\n"):
                    line = line.strip()
                    try:
                        index = line.index("(sha1): ")
                        installed.append(line[index+8:].lower())
                    except:
                        pass
        except Exception as e:
            logger.exception(e)

        return installed

    def _get_install_command(self):
        return ["certutil.exe", "-addstore", "-user", "-f", "ROOT",
                self.parent_cert.desc]

    def _get_uninstall_command(self):
        return ["certutil.exe", "-delstore", "-user", "ROOT",
                "MySQL Shell Auto Generated CA Certificate"]

# TODO(rennox): to be deleted once the certificate install is considered complete with the NSS user database


class Trust(Store_cert):
    def __init__(self, parent_cert, deprecated=False):
        super().__init__(Type.TRUST, "Trust Policy Store",
                         True, parent_cert, deprecated=deprecated)

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

    def _get_cert_install_script(self, padding=0):
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
