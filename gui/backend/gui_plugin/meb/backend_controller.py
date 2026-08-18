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
# separately licensed software that they have either included with the
# program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

from __future__ import annotations

import os
import select
import shlex
import shutil
import subprocess
import tempfile
import time
from typing import Any, Callable, Sequence

import gui_plugin.core.Logger as logger

from .os_utils import get_path_owner, write_text_private
from .target import BackupTarget


class Users(object):
    ADMIN = "root"
    CURRENT = ""


class InvalidPasswordError(RuntimeError):
    pass


class PermissionDeniedError(RuntimeError):
    pass


class MebControllerBackend(object):
    """Facade for backend services used by the MEB backend."""

    def __init__(
        self,
        server_helper: Any,
    ) -> None:
        self._server_helper: Any = server_helper

    def execute_command(
        self,
        command: str,
        as_user: str | None = None,
        user_password: str | None = None,
        output_handler: Callable[[str], Any] | None = None,
        options: dict[str, Any] | None = None,
    ) -> Any:
        return self._server_helper.execute_command(
            command,
            as_user=as_user,
            user_password=user_password,
            output_handler=output_handler,
            options=options,
        )

    def execute_command_with_input(
        self,
        command: str,
        input_text: str,
        as_user: str | None = None,
        user_password: str | None = None,
        output_handler: Callable[[str], Any] | None = None,
    ) -> Any:
        return self._server_helper.execute_command_with_input(
            command,
            input_text,
            as_user,
            user_password,
            output_handler,
        )

    def execute_argv_with_input(
        self,
        command: Sequence[str],
        input_text: str,
        output_handler: Callable[[str], Any] | None = None,
        env: dict[str, str] | None = None,
        timeout: float | None = None,
    ) -> int:
        return self._server_helper.execute_argv_with_input(
            command,
            input_text,
            output_handler,
            env,
            timeout,
        )

    def get_file_content(
        self,
        path: str,
        as_user: str | None = None,
        user_password: str | None = None,
        skip_lines: int = 0,
    ) -> Any:
        return self._server_helper.get_file_content(path, as_user, user_password, skip_lines)

    def set_file_content(
        self,
        path: str,
        content: str,
        as_user: str | None = None,
        user_password: str | None = None,
        mode: str | None = None,
    ) -> Any:
        if mode is None:
            return self._server_helper.set_file_content(path, content, as_user, user_password)

        return self._server_helper.set_file_content(path, content, as_user, user_password, mode)

    def delete_file(self, path: str, as_user: str | None = None, user_password: str | None = None) -> Any:
        return self._server_helper.delete_file(path, as_user, user_password)

    def listdir(self, path: str, as_user: str | None = None, user_password: str | None = None) -> list[str]:
        return self._server_helper.listdir(path, as_user, user_password)

    def check_dir_writable(self, path: str, as_user: str | None = None, user_password: str | None = None) -> bool:
        return self._server_helper.check_dir_writable(path, as_user, user_password)

    def file_exists(self, path: str, as_user: str | None = None, user_password: str | None = None) -> bool:
        return self._server_helper.file_exists(path, as_user, user_password)

    def create_directory(
        self,
        path: str,
        as_user: str | None = None,
        user_password: str | None = None,
        with_owner: str | None = None,
    ) -> Any:
        return self._server_helper.create_directory(path, as_user, user_password, with_owner=with_owner)

    def create_directory_recursive(
        self,
        path: str,
        as_user: str | None = None,
        user_password: str | None = None,
        with_owner: str | None = None,
    ) -> Any:
        return self._server_helper.create_directory_recursive(path, as_user, user_password, with_owner=with_owner)

    def get_file_owner(self, path: str) -> str:
        return self._server_helper.get_file_owner(path)

    def list2cmdline(self, command: Sequence[str]) -> str:
        return self._server_helper.list2cmdline(command)

class LocalMebServerHelper(object):
    """Local file and process helper for MEB management.

    This keeps the same narrow method names that the MEB backend used from
    Workbench's ServerManagementHelper, but only implements local execution.
    Remote management can be added later by providing another helper to
    MebControllerBackend.
    """

    def __init__(self, target: BackupTarget) -> None:
        self.target: BackupTarget = target
        self._is_windows: bool = target.is_windows
        self._sudo_prompt: str = "EnterPasswordHere"

    def execute_command(
        self,
        command: str,
        as_user: str | None = Users.CURRENT,
        user_password: str | None = None,
        output_handler: Callable[[str], Any] | None = None,
        options: dict[str, Any] | None = None,
    ) -> int:
        del options
        if self._is_windows:
            return self._execute_windows_command(command, as_user, user_password, output_handler)

        return self._execute_linux_command(command, as_user, user_password, output_handler)

    def _execute_simple_windows_command(self, command: str, output_handler: Callable[[str], Any] | None) -> int:
        logger.debug3("Executing local command %s\n" % command)
        process = subprocess.Popen(
            ["cmd.exe", "/S", "/C", command],
            shell=False,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        output, _ = process.communicate()
        if output_handler and output:
            output_handler(output)

        return process.returncode

    def _execute_windows_command(
        self,
        command: str,
        as_user: str | None,
        user_password: str | None,
        output_handler: Callable[[str], Any] | None,
    ) -> int:
        if as_user in (None, Users.CURRENT):
            return self._execute_simple_windows_command(command, output_handler)

        if as_user != Users.ADMIN:
            raise PermissionDeniedError("Running commands as a specific Windows user is not supported")

        return self._execute_windows_elevated_command(command, output_handler)

    def _execute_windows_elevated_command(
        self,
        command: str,
        output_handler: Callable[[str], Any] | None,
    ) -> int:
        if output_handler:
            raise PermissionDeniedError("Capturing elevated Windows command output is not supported")

        return self._run_windows_elevated_command(command)

    def _run_windows_elevated_command(self, command: str) -> int:
        import ctypes
        from ctypes import wintypes

        class ShellExecuteInfo(ctypes.Structure):
            _fields_ = [
                ("cbSize", wintypes.DWORD),
                ("fMask", ctypes.c_ulong),
                ("hwnd", wintypes.HWND),
                ("lpVerb", wintypes.LPCWSTR),
                ("lpFile", wintypes.LPCWSTR),
                ("lpParameters", wintypes.LPCWSTR),
                ("lpDirectory", wintypes.LPCWSTR),
                ("nShow", ctypes.c_int),
                ("hInstApp", ctypes.c_void_p),
                ("lpIDList", ctypes.c_void_p),
                ("lpClass", wintypes.LPCWSTR),
                ("hkeyClass", ctypes.c_void_p),
                ("dwHotKey", wintypes.DWORD),
                ("hIcon", ctypes.c_void_p),
                ("hProcess", ctypes.c_void_p),
            ]

        see_mask_no_close_process = 0x00000040
        infinite = 0xFFFFFFFF
        error_cancelled = 1223

        shell32 = ctypes.WinDLL("shell32", use_last_error=True)
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        shell32.ShellExecuteExW.argtypes = [ctypes.POINTER(ShellExecuteInfo)]
        shell32.ShellExecuteExW.restype = wintypes.BOOL

        execute_info = ShellExecuteInfo()
        execute_info.cbSize = ctypes.sizeof(ShellExecuteInfo)
        execute_info.fMask = see_mask_no_close_process
        execute_info.lpVerb = "runas"
        execute_info.lpFile = "cmd.exe"
        execute_info.lpParameters = subprocess.list2cmdline(["/S", "/C", command])
        execute_info.nShow = 0

        logger.debug3("Executing elevated Windows command %s\n" % command)
        if not shell32.ShellExecuteExW(ctypes.byref(execute_info)):
            error = ctypes.get_last_error()
            if error in (5, error_cancelled):
                raise PermissionDeniedError("User did not accept privilege elevation")
            raise ctypes.WinError(error)

        try:
            kernel32.WaitForSingleObject(execute_info.hProcess, infinite)
            exit_code = wintypes.DWORD()
            if not kernel32.GetExitCodeProcess(execute_info.hProcess, ctypes.byref(exit_code)):
                raise ctypes.WinError(ctypes.get_last_error())
            return int(exit_code.value)
        finally:
            if execute_info.hProcess:
                kernel32.CloseHandle(execute_info.hProcess)

    def _start_linux_process(
        self,
        command: str,
        as_user: str | None,
        user_password: str | None,
        authenticate_user: bool,
    ) -> Any | None:
        script = command.strip(" ")
        if not script:
            return None

        if self._needs_elevation(as_user):
            if authenticate_user:
                self._authenticate_linux_user(as_user, user_password)
                script = self._wrap_command_for_user_without_password(script, as_user)
            else:
                script = self._wrap_command_for_user(script, as_user)

        script_to_log = script
        script = "cd; " + script + " ; exit $?"
        environment = os.environ.copy()
        environment["LANG"] = "C"

        logger.debug3("Executing local command %s\n" % script_to_log)
        return subprocess.Popen(
            ["/bin/sh", "-c", script],
            bufsize=0,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            close_fds=True,
            env=environment,
        )

    def _execute_linux_command(
        self,
        command: str,
        as_user: str | None,
        user_password: str | None,
        output_handler: Callable[[str], Any] | None,
        output_timeout: int = 15,
    ) -> int:
        process = self._start_linux_process(command, as_user, user_password, authenticate_user=False)
        if process is None:
            return 0

        expect_sudo_failure = False
        if self._needs_elevation(as_user):
            expect_sudo_failure = self._handle_sudo_prompt(process, user_password, output_handler, output_timeout)

        read_size = 40
        return_on_newline = True
        while process.poll() is None:
            current_text = self._read_nonblocking(process.stdout, read_size, output_timeout, return_on_newline)
            return_on_newline = False
            read_size = 1024

            if current_text:
                if expect_sudo_failure and self._is_sudo_auth_failure(current_text):
                    process.terminate()
                    raise InvalidPasswordError("Incorrect password for sudo")

                expect_sudo_failure = False
                if output_handler:
                    output_handler(current_text)

        try:
            remaining_output, _ = process.communicate()
            current_text = self._to_text(remaining_output)
            if expect_sudo_failure and self._is_sudo_auth_failure(current_text):
                raise InvalidPasswordError("Incorrect password for sudo")
            if current_text and output_handler:
                output_handler(current_text)
        except InvalidPasswordError:
            raise
        except Exception as e:
            logger.error("local command: error reading from child process: %s\n" % str(e))

        return process.returncode

    def _execute_linux_command_with_input(
        self,
        command: str,
        input_text: str,
        as_user: str | None = Users.CURRENT,
        user_password: str | None = None,
        output_handler: Callable[[str], Any] | None = None,
    ) -> int:
        process = self._start_linux_process(command, as_user, user_password, authenticate_user=True)
        if process is None:
            return 0

        output, _ = process.communicate(input=input_text.encode("utf-8"))
        current_text = self._to_text(output)
        if current_text and output_handler:
            output_handler(current_text)

        return process.returncode

    def execute_command_with_input(
        self,
        command: str,
        input_text: str,
        as_user: str | None = Users.CURRENT,
        user_password: str | None = None,
        output_handler: Callable[[str], Any] | None = None,
    ) -> int:
        if self._is_windows:
            return self._execute_windows_command_with_input(
                command,
                input_text,
                as_user,
                output_handler,
            )

        return self._execute_linux_command_with_input(
            command,
            input_text,
            as_user,
            user_password,
            output_handler,
        )

    def _execute_windows_command_with_input(
        self,
        command: str,
        input_text: str,
        as_user: str | None,
        output_handler: Callable[[str], Any] | None,
    ) -> int:
        if self._needs_elevation(as_user):
            raise PermissionDeniedError("Running input commands as a specific Windows user is not supported")

        process = subprocess.Popen(
            ["cmd.exe", "/S", "/C", command],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        output, _ = process.communicate(input=input_text)
        if output_handler and output:
            output_handler(output)

        return process.returncode

    def execute_argv_with_input(
        self,
        command: Sequence[str],
        input_text: str,
        output_handler: Callable[[str], Any] | None = None,
        env: dict[str, str] | None = None,
        timeout: float | None = None,
    ) -> int:
        process = subprocess.Popen(
            list(command),
            shell=False,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=env,
        )
        try:
            output, _ = process.communicate(input=input_text, timeout=timeout)
        except subprocess.TimeoutExpired:
            process.kill()
            output, _ = process.communicate()
            if output_handler and output:
                output_handler(output)
            if output_handler:
                output_handler(f"Command timed out after {timeout:g} seconds.")

            return 124

        if output_handler and output:
            output_handler(output)

        return process.returncode

    def _authenticate_linux_user(self, as_user: str | None, user_password: str | None) -> None:
        rc = self._execute_linux_command("true", as_user, user_password, None)
        if rc != 0:
            raise PermissionDeniedError("Could not authenticate as user '%s'" % (as_user or Users.CURRENT))

    def _handle_sudo_prompt(
        self,
        process: Any,
        user_password: str | None,
        output_handler: Callable[[str], Any] | None,
        output_timeout: int,
    ) -> bool:
        data = self._read_nonblocking_until_text_or_newline(
            process,
            process.stdout,
            self._sudo_prompt,
            output_timeout,
        )
        if data.endswith(self._sudo_prompt):
            self._write_sudo_password(process, user_password)
            return True

        buffered_output = [data] if data else []
        start_time = time.time()
        while process.poll() is None:
            data = self._read_nonblocking_until_text_or_newline(process, process.stdout, self._sudo_prompt, 1)
            if data.endswith(self._sudo_prompt):
                self._write_sudo_password(process, user_password)
                return True

            if data:
                buffered_output.append(data)

            if len(buffered_output) > 10 or time.time() - start_time >= 1:
                break

        if output_handler:
            for output in buffered_output:
                output_handler(output)

        return False

    def _write_sudo_password(self, process: Any, user_password: str | None) -> None:
        if not user_password:
            process.terminate()
            raise InvalidPasswordError("Incorrect password for sudo")

        if process.stdin is not None:
            process.stdin.write(("%s\n" % user_password).encode("utf-8"))
            process.stdin.flush()

    def _read_nonblocking(
        self,
        fd: Any,
        size: int,
        timeout: float = 0,
        return_on_newline: bool = False,
    ) -> str:
        data: list[str] = []
        start_time = time.time()
        while len(data) < size:
            remaining_timeout = timeout - (time.time() - start_time)
            if remaining_timeout < 0:
                break

            try:
                readable, _, _ = select.select([fd], [], [], remaining_timeout)
            except OSError as e:
                if getattr(e, "errno", None) == 4:
                    continue
                raise

            if not readable:
                break

            value = fd.read(1)
            if not value:
                break

            data.append(self._to_text(value))
            if return_on_newline and data[-1] == "\n":
                break

        return "".join(data)

    def _read_nonblocking_until_text_or_newline(
        self,
        process: Any,
        fd: Any,
        text: str,
        timeout: float = 0,
    ) -> str:
        data = ""
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                readable, _, _ = select.select([fd], [], [], timeout - (time.time() - start_time))
            except OSError as e:
                if getattr(e, "errno", None) == 4:
                    continue
                raise

            if not readable:
                break

            value = fd.read(1)
            if value:
                data += self._to_text(value)
                if data.endswith(text) or "\n" in data:
                    break
            elif process.poll() is not None:
                break

        return data

    def _to_text(self, value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, bytes):
            return value.decode("utf-8", errors="replace")
        return str(value)

    def _is_sudo_auth_failure(self, output: str) -> bool:
        return (
            self._sudo_prompt in output
            or "Sorry, try again" in output
            or "incorrect password" in output
        )

    def get_file_content(
        self,
        path: str,
        as_user: str | None = Users.CURRENT,
        user_password: str | None = None,
        skip_lines: int = 0,
    ) -> str:
        if self._needs_elevation(as_user) and self._is_windows:
            raise PermissionDeniedError("Reading files with Windows elevation is not supported")

        if self._needs_elevation(as_user) and not self._is_windows:
            output: list[str] = []
            if skip_lines:
                command = "tail -n +%d %s" % (skip_lines + 1, shlex.quote(path))
            else:
                command = "cat %s" % shlex.quote(path)
            rc = self.execute_command(command, as_user, user_password, output.append)
            if rc != 0:
                raise OSError(rc, "Could not read file '%s'" % path)
            return "".join(output)

        with open(path, "r", encoding="utf-8", errors="replace") as file:
            if skip_lines:
                return "".join(file.readlines()[skip_lines:])
            return file.read()

    def set_file_content(
        self,
        path: str,
        content: str,
        as_user: str | None = Users.CURRENT,
        user_password: str | None = None,
        mode: str | None = None,
    ) -> None:
        if self._needs_elevation(as_user) and self._is_windows:
            raise PermissionDeniedError("Writing files with Windows elevation is not supported")
        elif self._needs_elevation(as_user) and not self._is_windows:
            self._authenticate_linux_user(as_user, user_password)
            command = self._wrap_command_for_user_without_password(
                "umask 077; cat > %s && chmod 600 %s" % (shlex.quote(path), shlex.quote(path)),
                as_user,
            )
            output: list[str] = []
            rc = self._execute_linux_command_with_input(command, content, output_handler=output.append)
            if rc != 0:
                detail = "".join(output).strip()
                message = "Could not write file '%s'" % path
                if detail:
                    message = "%s: %s" % (message, detail)
                raise OSError(rc, message)
        else:
            self._write_file_content_private(path, content)

        if mode == "u+x":
            self._chmod_user_executable(path, as_user, user_password)

    def delete_file(
        self,
        path: str,
        as_user: str | None = Users.CURRENT,
        user_password: str | None = None,
    ) -> None:
        if self._needs_elevation(as_user) and self._is_windows:
            command = self._windows_powershell_command(
                "Remove-Item -LiteralPath %s -Force" % self._windows_powershell_literal(path)
            )
            rc = self.execute_command(command, as_user, user_password)
            if rc != 0:
                raise OSError(rc, "Could not delete file '%s'" % path)
            return

        if self._needs_elevation(as_user) and not self._is_windows:
            rc = self.execute_command("rm -f %s" % shlex.quote(path), as_user, user_password)
            if rc != 0:
                raise OSError(rc, "Could not delete file '%s'" % path)
            return

        os.remove(path)

    def listdir(
        self,
        path: str,
        as_user: str | None = Users.CURRENT,
        user_password: str | None = None,
        include_size: bool = False,
    ) -> list[str]:
        if self._needs_elevation(as_user) and self._is_windows:
            raise PermissionDeniedError("Listing directories with Windows elevation is not supported")

        if self._needs_elevation(as_user) and not self._is_windows:
            output: list[str] = []
            rc = self.execute_command("ls -1p %s" % shlex.quote(path), as_user, user_password, output.append)
            if rc != 0:
                raise OSError(rc, "Could not list directory '%s'" % path)
            return [entry for entry in "".join(output).splitlines() if entry]

        entries: list[str] = []
        for name in sorted(os.listdir(path)):
            entry_path = os.path.join(path, name)
            display_name = name + os.sep if os.path.isdir(entry_path) else name
            if include_size:
                entries.append("%s %s" % (display_name, os.path.getsize(entry_path)))
            else:
                entries.append(display_name)

        return entries

    def check_dir_writable(
        self,
        path: str,
        as_user: str | None = Users.CURRENT,
        user_password: str | None = None,
    ) -> bool:
        if self._needs_elevation(as_user) and self._is_windows:
            command = self._windows_powershell_command(
                (
                    "$path = %s; "
                    "if (-not (Test-Path -LiteralPath $path -PathType Container)) { exit 1 }; "
                    "$test = Join-Path $path '.meb_write_test'; "
                    "try { Set-Content -LiteralPath $test -Value '' -NoNewline; "
                    "Remove-Item -LiteralPath $test -Force; exit 0 } catch { exit 1 }"
                )
                % self._windows_powershell_literal(path)
            )
            return self.execute_command(command, as_user, user_password) == 0

        if self._needs_elevation(as_user) and not self._is_windows:
            command = "test -d %s -a -w %s" % (shlex.quote(path), shlex.quote(path))
            return self.execute_command(command, as_user, user_password) == 0

        if not os.path.isdir(path):
            return False

        try:
            fd, temp_path = tempfile.mkstemp(dir=path)
            os.close(fd)
            os.unlink(temp_path)
            return True
        except OSError:
            return False

    def file_exists(self, path: str, as_user: str | None = Users.CURRENT, user_password: str | None = None) -> bool:
        if self._needs_elevation(as_user) and self._is_windows:
            command = self._windows_powershell_command(
                "if (Test-Path -LiteralPath %s) { exit 0 } else { exit 1 }"
                % self._windows_powershell_literal(path)
            )
            return self.execute_command(command, as_user, user_password) == 0

        if self._needs_elevation(as_user) and not self._is_windows:
            return self.execute_command("test -e %s" % shlex.quote(path), as_user, user_password) == 0

        return os.path.exists(path)

    def create_directory(
        self,
        path: str,
        as_user: str | None = Users.CURRENT,
        user_password: str | None = None,
        with_owner: str | None = None,
    ) -> None:
        self.create_directory_recursive(path, as_user, user_password, with_owner)

    def create_directory_recursive(
        self,
        path: str,
        as_user: str | None = Users.CURRENT,
        user_password: str | None = None,
        with_owner: str | None = None,
    ) -> None:
        if self._is_windows and with_owner:
            raise PermissionDeniedError("Changing owner of directory is not supported on Windows")

        if self._needs_elevation(as_user) and self._is_windows:
            command = self._windows_powershell_command(
                "New-Item -ItemType Directory -Force -LiteralPath %s | Out-Null"
                % self._windows_powershell_literal(path)
            )
            rc = self.execute_command(command, as_user, user_password)
            if rc != 0:
                raise OSError(rc, "Could not create directory '%s'" % path)
            return

        if self._needs_elevation(as_user) and not self._is_windows:
            command = "mkdir -p %s" % shlex.quote(path)
            rc = self.execute_command(command, as_user, user_password)
            if rc != 0:
                raise OSError(rc, "Could not create directory '%s'" % path)
        else:
            os.makedirs(path, exist_ok=True)

        if with_owner and not self._is_windows:
            try:
                shutil.chown(path, user=with_owner)
            except PermissionError:
                rc = self.execute_command(
                    "chown %s %s" % (shlex.quote(with_owner), shlex.quote(path)),
                    Users.ADMIN,
                    user_password,
                )
                if rc != 0:
                    raise

    def get_file_owner(self, path: str) -> str:
        owner = get_path_owner(path)
        if owner is None:
            raise OSError(f"Could not determine the owner of '{path}'")

        return owner

    def list2cmdline(self, command: Sequence[str]) -> str:
        if self._is_windows:
            return subprocess.list2cmdline(command)

        return " ".join(shlex.quote(part) for part in command)

    def _write_file_content_private(self, path: str, content: str) -> None:
        write_text_private(path, content)

    def _windows_powershell_literal(self, value: str) -> str:
        return "'%s'" % value.replace("'", "''")

    def _windows_powershell_command(self, script: str) -> str:
        return "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command %s" % (
            subprocess.list2cmdline([script])
        )

    def _chmod_user_executable(
        self,
        path: str,
        as_user: str | None,
        user_password: str | None,
    ) -> None:
        if self._is_windows:
            return

        if self._needs_elevation(as_user) and not self._is_windows:
            rc = self.execute_command("chmod u+x %s" % shlex.quote(path), as_user, user_password)
            if rc != 0:
                raise OSError(rc, "Could not chmod file '%s'" % path)
            return

        current_mode = os.stat(path).st_mode
        os.chmod(path, current_mode | 0o100)

    def _needs_elevation(self, as_user: str | None) -> bool:
        return as_user not in (None, Users.CURRENT)

    def _wrap_command_for_user(self, command: str, as_user: str | None) -> str:
        if self._is_windows or not self._needs_elevation(as_user):
            return command

        sudo_parts = ["sudo", "-k", "-S", "-p", self._sudo_prompt]
        if as_user != Users.ADMIN:
            sudo_parts.extend(["-u", str(as_user)])
        sudo_parts.extend(["/bin/bash", "-c", command])
        return " ".join(shlex.quote(part) for part in sudo_parts)

    def _wrap_command_for_user_without_password(self, command: str, as_user: str | None) -> str:
        if self._is_windows or not self._needs_elevation(as_user):
            return command

        sudo_parts = ["sudo", "-n"]
        if as_user != Users.ADMIN:
            sudo_parts.extend(["-u", str(as_user)])
        sudo_parts.extend(["/bin/bash", "-c", command])
        return " ".join(shlex.quote(part) for part in sudo_parts)
