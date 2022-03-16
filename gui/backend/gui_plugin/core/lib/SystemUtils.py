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
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
import subprocess
import platform


def run_system_command(command):
    try:
        return (0, subprocess.check_output(command, stderr=subprocess.STDOUT).decode("utf8").strip())
    except subprocess.CalledProcessError as e:
        return (e.returncode, e.output)


def get_linux_pretty_name():
    """Returns the the value of the PRETTY_NAME key in /etc/os-release"""
    exit_code, output = run_system_command(['cat', '/etc/os-release'])
    if exit_code == 0:
        for line in output.split("\n"):
            if line.startswith('PRETTY_NAME'):
                return line[12:].lower()
    return ""


def get_os_name():
    """Returns the specific name for the current OS"""
    system = platform.system()
    if system == "Linux":
        # In case of Linux, attempts to identify the specific OS
        pretty_name = get_linux_pretty_name()
        if "ubuntu" in pretty_name:
            return "Ubuntu"
        elif "oracle linux" in pretty_name:
            return "OracleLinux"
        elif "red hat" in pretty_name:
            return "RedHat"
        elif "fedora" in pretty_name:
            return "Fedora"
        elif "debian" in pretty_name:
            return "Debian"
        elif "opensuse" in pretty_name:
            return "openSUSE"

    # By default returns the platform
    return system
