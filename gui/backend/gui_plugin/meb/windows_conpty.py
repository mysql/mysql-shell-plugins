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
# This program is distributed in the hope that it will be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

from __future__ import annotations

import ctypes
import os
import subprocess
import sys
import threading
from ctypes import wintypes
from dataclasses import dataclass
from typing import Sequence


PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE = 0x00020016
EXTENDED_STARTUPINFO_PRESENT = 0x00080000
WAIT_OBJECT_0 = 0
WAIT_TIMEOUT = 258
ERROR_BROKEN_PIPE = 109
ERROR_NO_DATA = 232
MAX_INPUT_BYTES = 1024 * 1024
MAX_OUTPUT_BYTES = 1024 * 1024
CHILD_TIMEOUT_SECONDS = 15
TIMEOUT_EXIT_CODE = 124


class COORD(ctypes.Structure):
    _fields_ = [
        ("X", ctypes.c_short),
        ("Y", ctypes.c_short),
    ]


class STARTUPINFOW(ctypes.Structure):
    _fields_ = [
        ("cb", wintypes.DWORD),
        ("lpReserved", wintypes.LPWSTR),
        ("lpDesktop", wintypes.LPWSTR),
        ("lpTitle", wintypes.LPWSTR),
        ("dwX", wintypes.DWORD),
        ("dwY", wintypes.DWORD),
        ("dwXSize", wintypes.DWORD),
        ("dwYSize", wintypes.DWORD),
        ("dwXCountChars", wintypes.DWORD),
        ("dwYCountChars", wintypes.DWORD),
        ("dwFillAttribute", wintypes.DWORD),
        ("dwFlags", wintypes.DWORD),
        ("wShowWindow", wintypes.WORD),
        ("cbReserved2", wintypes.WORD),
        ("lpReserved2", ctypes.POINTER(wintypes.BYTE)),
        ("hStdInput", wintypes.HANDLE),
        ("hStdOutput", wintypes.HANDLE),
        ("hStdError", wintypes.HANDLE),
    ]


class STARTUPINFOEXW(ctypes.Structure):
    _fields_ = [
        ("StartupInfo", STARTUPINFOW),
        ("lpAttributeList", ctypes.c_void_p),
    ]


class PROCESS_INFORMATION(ctypes.Structure):
    _fields_ = [
        ("hProcess", wintypes.HANDLE),
        ("hThread", wintypes.HANDLE),
        ("dwProcessId", wintypes.DWORD),
        ("dwThreadId", wintypes.DWORD),
    ]


@dataclass
class ProcessResult:
    returncode: int
    output: bytes


class ConPtyError(RuntimeError):
    pass


def _win_error(operation: str) -> ConPtyError:
    error_code = ctypes.get_last_error()

    return ConPtyError(
        f"{operation} failed: "
        f"{ctypes.FormatError(error_code).strip()} ({error_code})"
    )


def _check_hresult(operation: str, result: int) -> None:
    if result != 0:
        unsigned_result = ctypes.c_ulong(result).value
        raise ConPtyError(
            f"{operation} failed with HRESULT 0x{unsigned_result:08X}"
        )


class Kernel32:
    def __init__(self) -> None:
        self.dll = ctypes.WinDLL("kernel32", use_last_error=True)

        self.dll.CreatePipe.argtypes = [
            ctypes.POINTER(wintypes.HANDLE),
            ctypes.POINTER(wintypes.HANDLE),
            ctypes.c_void_p,
            wintypes.DWORD,
        ]
        self.dll.CreatePipe.restype = wintypes.BOOL

        self.dll.CreatePseudoConsole.argtypes = [
            COORD,
            wintypes.HANDLE,
            wintypes.HANDLE,
            wintypes.DWORD,
            ctypes.POINTER(wintypes.HANDLE),
        ]
        self.dll.CreatePseudoConsole.restype = ctypes.c_long

        self.dll.ClosePseudoConsole.argtypes = [wintypes.HANDLE]
        self.dll.ClosePseudoConsole.restype = None

        self.dll.InitializeProcThreadAttributeList.argtypes = [
            ctypes.c_void_p,
            wintypes.DWORD,
            wintypes.DWORD,
            ctypes.POINTER(ctypes.c_size_t),
        ]
        self.dll.InitializeProcThreadAttributeList.restype = wintypes.BOOL

        self.dll.UpdateProcThreadAttribute.argtypes = [
            ctypes.c_void_p,
            wintypes.DWORD,
            ctypes.c_size_t,
            ctypes.c_void_p,
            ctypes.c_size_t,
            ctypes.c_void_p,
            ctypes.POINTER(ctypes.c_size_t),
        ]
        self.dll.UpdateProcThreadAttribute.restype = wintypes.BOOL

        self.dll.DeleteProcThreadAttributeList.argtypes = [ctypes.c_void_p]
        self.dll.DeleteProcThreadAttributeList.restype = None

        self.dll.CreateProcessW.argtypes = [
            wintypes.LPCWSTR,
            wintypes.LPWSTR,
            ctypes.c_void_p,
            ctypes.c_void_p,
            wintypes.BOOL,
            wintypes.DWORD,
            ctypes.c_void_p,
            wintypes.LPCWSTR,
            ctypes.POINTER(STARTUPINFOW),
            ctypes.POINTER(PROCESS_INFORMATION),
        ]
        self.dll.CreateProcessW.restype = wintypes.BOOL

        self.dll.ReadFile.argtypes = [
            wintypes.HANDLE,
            ctypes.c_void_p,
            wintypes.DWORD,
            ctypes.POINTER(wintypes.DWORD),
            ctypes.c_void_p,
        ]
        self.dll.ReadFile.restype = wintypes.BOOL

        self.dll.WriteFile.argtypes = [
            wintypes.HANDLE,
            ctypes.c_void_p,
            wintypes.DWORD,
            ctypes.POINTER(wintypes.DWORD),
            ctypes.c_void_p,
        ]
        self.dll.WriteFile.restype = wintypes.BOOL

        self.dll.WaitForSingleObject.argtypes = [
            wintypes.HANDLE,
            wintypes.DWORD,
        ]
        self.dll.WaitForSingleObject.restype = wintypes.DWORD

        self.dll.GetExitCodeProcess.argtypes = [
            wintypes.HANDLE,
            ctypes.POINTER(wintypes.DWORD),
        ]
        self.dll.GetExitCodeProcess.restype = wintypes.BOOL

        self.dll.TerminateProcess.argtypes = [
            wintypes.HANDLE,
            wintypes.UINT,
        ]
        self.dll.TerminateProcess.restype = wintypes.BOOL

        self.dll.CloseHandle.argtypes = [wintypes.HANDLE]
        self.dll.CloseHandle.restype = wintypes.BOOL

    def close_handle(self, handle: object) -> None:
        value = getattr(handle, "value", handle)
        if not value:
            return

        self.dll.CloseHandle(wintypes.HANDLE(value))
        if isinstance(handle, ctypes.c_void_p):
            handle.value = None


def _read_output(
    kernel32: Kernel32,
    handle: wintypes.HANDLE,
    chunks: list[bytes],
    errors: list[BaseException],
) -> None:
    try:
        total = 0

        while True:
            buffer = ctypes.create_string_buffer(4096)
            bytes_read = wintypes.DWORD()
            succeeded = kernel32.dll.ReadFile(
                handle,
                buffer,
                len(buffer),
                ctypes.byref(bytes_read),
                None,
            )
            if not succeeded:
                error_code = ctypes.get_last_error()
                if error_code in (ERROR_BROKEN_PIPE, ERROR_NO_DATA):
                    return

                raise _win_error("ReadFile")

            if bytes_read.value == 0:
                return

            remaining = MAX_OUTPUT_BYTES - total
            if remaining > 0:
                data = buffer.raw[:bytes_read.value]
                chunks.append(data[:remaining])
                total += min(len(data), remaining)
    except BaseException as error:
        errors.append(error)


def _write_input(
    kernel32: Kernel32,
    handle: wintypes.HANDLE,
    data: bytes,
    errors: list[BaseException],
) -> None:
    try:
        offset = 0

        while offset < len(data):
            pending = data[offset:]
            buffer = ctypes.create_string_buffer(pending)
            bytes_written = wintypes.DWORD()
            succeeded = kernel32.dll.WriteFile(
                handle,
                buffer,
                len(pending),
                ctypes.byref(bytes_written),
                None,
            )
            if not succeeded:
                raise _win_error("WriteFile")
            if bytes_written.value == 0:
                raise ConPtyError("WriteFile did not write any input")

            offset += bytes_written.value
    except BaseException as error:
        errors.append(error)


def _close_pseudoconsole(
    kernel32: Kernel32,
    pseudoconsole: wintypes.HANDLE,
) -> None:
    if pseudoconsole.value:
        kernel32.dll.ClosePseudoConsole(pseudoconsole)
        pseudoconsole.value = None


def run_in_pseudoconsole(
    argv: Sequence[str],
    input_data: bytes,
    timeout_seconds: int = CHILD_TIMEOUT_SECONDS,
) -> ProcessResult:
    if not argv:
        raise ValueError("command must not be empty")
    if timeout_seconds <= 0:
        raise ValueError("timeout must be positive")

    kernel32 = Kernel32()
    input_read = wintypes.HANDLE()
    input_write = wintypes.HANDLE()
    output_read = wintypes.HANDLE()
    output_write = wintypes.HANDLE()
    pseudoconsole = wintypes.HANDLE()
    process_information = PROCESS_INFORMATION()
    attribute_buffer: ctypes.Array | None = None
    attribute_list_initialized = False
    output_chunks: list[bytes] = []
    io_errors: list[BaseException] = []
    reader: threading.Thread | None = None
    writer: threading.Thread | None = None

    try:
        if not kernel32.dll.CreatePipe(
            ctypes.byref(input_read),
            ctypes.byref(input_write),
            None,
            0,
        ):
            raise _win_error("CreatePipe(input)")

        if not kernel32.dll.CreatePipe(
            ctypes.byref(output_read),
            ctypes.byref(output_write),
            None,
            0,
        ):
            raise _win_error("CreatePipe(output)")

        result = kernel32.dll.CreatePseudoConsole(
            COORD(80, 25),
            input_read,
            output_write,
            0,
            ctypes.byref(pseudoconsole),
        )
        _check_hresult("CreatePseudoConsole", result)

        reader = threading.Thread(
            target=_read_output,
            args=(kernel32, output_read, output_chunks, io_errors),
            name="conpty-output",
            daemon=True,
        )
        reader.start()

        attribute_size = ctypes.c_size_t()
        kernel32.dll.InitializeProcThreadAttributeList(
            None,
            1,
            0,
            ctypes.byref(attribute_size),
        )
        if attribute_size.value == 0:
            raise _win_error("InitializeProcThreadAttributeList(size)")

        attribute_buffer = ctypes.create_string_buffer(attribute_size.value)
        attribute_list = ctypes.cast(attribute_buffer, ctypes.c_void_p)
        if not kernel32.dll.InitializeProcThreadAttributeList(
            attribute_list,
            1,
            0,
            ctypes.byref(attribute_size),
        ):
            raise _win_error("InitializeProcThreadAttributeList")
        attribute_list_initialized = True

        if not kernel32.dll.UpdateProcThreadAttribute(
            attribute_list,
            0,
            PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE,
            pseudoconsole,
            ctypes.sizeof(pseudoconsole),
            None,
            None,
        ):
            raise _win_error("UpdateProcThreadAttribute")

        startup = STARTUPINFOEXW()
        startup.StartupInfo.cb = ctypes.sizeof(startup)
        startup.lpAttributeList = attribute_list
        command_line = ctypes.create_unicode_buffer(
            subprocess.list2cmdline(list(argv))
        )

        if not kernel32.dll.CreateProcessW(
            argv[0],
            command_line,
            None,
            None,
            False,
            EXTENDED_STARTUPINFO_PRESENT,
            None,
            None,
            ctypes.byref(startup.StartupInfo),
            ctypes.byref(process_information),
        ):
            raise _win_error("CreateProcessW")

        kernel32.close_handle(input_read)
        kernel32.close_handle(output_write)

        # Closing the ConPTY input pipe signals CTRL_CLOSE_EVENT to the child.
        # Keep it open until the child exits and the owner performs cleanup.
        writer = threading.Thread(
            target=_write_input,
            args=(kernel32, input_write, input_data, io_errors),
            name="conpty-input",
            daemon=True,
        )
        writer.start()

        wait_result = kernel32.dll.WaitForSingleObject(
            process_information.hProcess,
            timeout_seconds * 1000,
        )
        if wait_result == WAIT_TIMEOUT:
            if not kernel32.dll.TerminateProcess(
                process_information.hProcess,
                TIMEOUT_EXIT_CODE,
            ):
                raise _win_error("TerminateProcess")

            termination_result = kernel32.dll.WaitForSingleObject(
                process_information.hProcess,
                5000,
            )
            if termination_result != WAIT_OBJECT_0:
                raise ConPtyError("the timed out process did not terminate")

            returncode = TIMEOUT_EXIT_CODE
        elif wait_result == WAIT_OBJECT_0:
            exit_code = wintypes.DWORD()
            if not kernel32.dll.GetExitCodeProcess(
                process_information.hProcess,
                ctypes.byref(exit_code),
            ):
                raise _win_error("GetExitCodeProcess")

            returncode = exit_code.value
        else:
            raise _win_error("WaitForSingleObject")

        writer.join(timeout=5)
        if writer.is_alive():
            raise ConPtyError("the input writer did not stop")

        _close_pseudoconsole(kernel32, pseudoconsole)
        reader.join(timeout=5)
        if reader.is_alive():
            raise ConPtyError("the output reader did not stop")
        if io_errors:
            raise ConPtyError(str(io_errors[0]))

        return ProcessResult(
            returncode=returncode,
            output=b"".join(output_chunks),
        )
    finally:
        if attribute_list_initialized and attribute_buffer is not None:
            kernel32.dll.DeleteProcThreadAttributeList(
                ctypes.cast(attribute_buffer, ctypes.c_void_p)
            )

        kernel32.close_handle(process_information.hThread)
        kernel32.close_handle(process_information.hProcess)
        kernel32.close_handle(input_read)
        kernel32.close_handle(input_write)
        kernel32.close_handle(output_write)
        _close_pseudoconsole(kernel32, pseudoconsole)

        if writer is not None:
            writer.join(timeout=5)
        if reader is not None:
            reader.join(timeout=5)

        kernel32.close_handle(output_read)


def _parse_arguments(arguments: Sequence[str]) -> tuple[bool, list[str]]:
    values = list(arguments)
    try:
        separator = values.index("--")
    except ValueError as error:
        raise ValueError("missing '--' command separator") from error

    options = values[:separator]
    unknown_options = [option for option in options if option != "--stdin"]
    if unknown_options:
        raise ValueError(f"unknown option: {unknown_options[0]}")

    command = values[separator + 1:]
    if not command:
        raise ValueError("command must not be empty")

    return "--stdin" in options, command


def _read_input() -> bytes:
    input_data = sys.stdin.buffer.read(MAX_INPUT_BYTES + 1)
    if len(input_data) > MAX_INPUT_BYTES:
        raise ValueError(f"input exceeds {MAX_INPUT_BYTES} bytes")

    return input_data


def main(arguments: Sequence[str] | None = None) -> int:
    if os.name != "nt":
        print("ConPTY worker requires Windows", file=sys.stderr)

        return 2

    try:
        forward_stdin, command = _parse_arguments(
            sys.argv[1:] if arguments is None else arguments
        )
    except ValueError as error:
        print(
            "usage: windows_conpty.py [--stdin] -- COMMAND [ARG ...]: "
            f"{error}",
            file=sys.stderr,
        )

        return 2

    try:
        result = run_in_pseudoconsole(
            command,
            _read_input() if forward_stdin else b"",
        )
        if result.output:
            sys.stdout.write(
                result.output.decode("utf-8", errors="replace")
            )

        return result.returncode
    except (AttributeError, ConPtyError, OSError, ValueError) as error:
        print(f"ConPTY worker failed: {error}", file=sys.stderr)

        return 3


if __name__ == "__main__":
    sys.exit(main())
