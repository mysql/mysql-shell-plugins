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


def is_wsl2():
    return "WSL2" in platform.uname().release


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
