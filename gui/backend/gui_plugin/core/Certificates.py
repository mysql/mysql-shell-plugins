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

from mysqlsh.plugin_manager import plugin_function
import gui_plugin.core.Logger as logger
from gui_plugin.core.lib import certs
import sys


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

    check_keychain = kwargs.get("check_keychain", True)

    availability = certs.management.get_availability(check_keychain)

    error = None
    if not isinstance(availability, bool):
        logger.debug2("The certificate installation is inconsistent:")
        for a in availability:
            logger.debug2(str(a))
            if not a.valid and error is None:
                error = a.error

        raise Exception(f"The installed certificate has errors: {error}")

    return availability


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
    # Avoid the backtrace to be generated for this plugin function
    sys.tracebacklimit = 0

    replace_existing = kwargs.get("replace_existing")
    keychain = kwargs.get("keychain", True)

    availability = certs.management.get_availability(keychain)

    # If the certificate is already installed and should not be replaced,
    # return right away
    if isinstance(availability, bool):
        if availability and not replace_existing:
            return True

    # In any other case resets the deployed certificates, i.e.
    # - Replace existing was indicated
    # - Certificate is not installed
    # - Certificate is partially installed
    return certs.management.reset(keychain, replace_existing)


@plugin_function('gui.core.removeShellWebCertificate', shell=True, cli=True, web=True)
def remove_shell_web_certificate():
    """Removes the MySQL Shell GUI webserver certificate

    Returns:
       True if successfully removed
    """
    # Avoid the backtrace to be generated for this plugin function
    sys.tracebacklimit = 0

    return certs.management.remove()
