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
import os

import gui_plugin.core.Logger as logger

# This structure should define the terminal/arguments required to execute a
# command in linux assuming a last parameter with a script path will be
# provided, the following requirements should be met by any terminal added
# into the list:
# - New window opened: executing <terminal> [options] <script> should open a
#   new terminal window
# - Blocking call: the [options] should ensure the caller terminal/process waits
#   for the opened terminal to complete
# - Exit Code Bubbled Up: the exit code of the executed script should be made
#   available on the caller terminal/process
linux_terminals = {
    'gnome-terminal': ['--wait', '--'],
    'xterm': ['-e'],
}


def get_terminal_command():
    command = None
    for terminal, options in linux_terminals.items():
        exit_code, output = run_system_command(['which', terminal])
        if exit_code == 0:
            command = [output] + options
            break

    if command is None:
        terminals = []
        for terminal in linux_terminals:
            terminals.append(terminal)

        raise Exception(
            f"Unable to locate supported terminal, tried: {', '.join(terminals)}.")

    return command


def run_system_command(command):
    try:
        logger.debug3(f"Executing System Command: {' '.join(command)}")
        output = subprocess.check_output(
            command, stderr=subprocess.STDOUT).decode("utf8").strip()
        logger.debug3(f"---\n{output}\n---")
        return (0, output)
    except subprocess.CalledProcessError as e:
        logger.debug3(f"---\n{e.output}\n---")
        return (e.returncode, e.output)


def get_os_release_key(key):
    """Returns the the value of the key in /etc/os-release"""
    if os.path.exists("/etc/os-release"):
        with open("/etc/os-release") as f:
            for line in f.readlines():
                if line.startswith(key):
                    # NOTE: Returns the value unquoted, this is important as some
                    # platforms have the values quoted in /etc/os-release
                    # i.e. OpenSUSE
                    return line[len(key) + 1:].strip().strip("'").strip('"')
    return None


# This function will return the system type as follows:
# - OSX: darwin
# - Windows: windows
# - Linux: the value of ID_LIKE with fallback to ID on the
#   /etc/os-release file, being the values as follows:
# OS            ID            ID_LIKE
# UWSL          ubuntu        debian
# Ubuntu        ubuntu        debian
# Kubuntu       ubuntu        debian
# EL8           ol            fedora
# EL7           ol            fedora
# RHEL          rhel          fedora
# Fedora35      fedora        ------
# Fedora36      fedora        ------
# Debian        debian        ------
# OpenSUSE-Leap opensuse-leap suse opensuse
# Sles          sles          ------
# Solaris       solaris       ------
def get_os_type():
    """Returns the specific name for the current OS"""
    type = platform.system()
    if type == "Linux":
        # In case of Linux, attempts to identify the specific OS
        type = get_os_release_key('ID_LIKE')
        if type is None:
            type = get_os_release_key("ID")

        return type

    # By default returns the platform
    return type.lower()


def is_wsl():
    release = platform.uname().release.lower()
    return "wsl2" in release or "microsoft" in release


def in_vs_code():
    # Shortcut for dev environments
    if "IN_VS_CODE" in os.environ:
        return True

    # Otherwise determine it based on this file location
    vscode_paths = []
    vscode_paths.append(os.path.join(".vscode", "extensions"))
    vscode_paths.append(os.path.join(".vscode-server", "extensions"))

    this_file_path = os.path.dirname(__file__)

    for p in vscode_paths:
        if p in this_file_path:
            return True

    return False


def run_shell_cmd(cmd, cwd=None):
    """Runs the given shell command

    Args:
        cmd (list): The shell command to execute with parameters

    Returns:
       A tuple containing exit code and output, if process succeeded exit code is None
    """

    logger.debug3(f"Executing Shell Command: {' '.join(cmd)}")

    stream = popen(cmd, cwd=cwd)
    output = stream.read()
    exit_code = stream.close()

    logger.debug3(f"---\n{output}\n---")

    return (exit_code, output)


def popen(cmd, mode="r", buffering=-1, cwd=None):
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
                                bufsize=buffering,
                                cwd=cwd)
        return _wrap_close(proc.stdout, proc)
    else:
        proc = subprocess.Popen(cmd,
                                text=True,
                                stdin=subprocess.PIPE,
                                stderr=subprocess.STDOUT,
                                bufsize=buffering,
                                cwd=cwd)
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
