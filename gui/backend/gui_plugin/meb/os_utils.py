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
import stat
import subprocess
from typing import Callable, Optional


def get_current_os_user() -> Optional[str]:
    try:
        import getpass

        return getpass.getuser()
    except Exception:
        return None


def _get_unix_owner(path: str) -> Optional[str]:
    import pwd

    return pwd.getpwuid(os.stat(path).st_uid).pw_name


def _get_unix_group(path: str) -> Optional[str]:
    import grp

    return grp.getgrgid(os.stat(path).st_gid).gr_name


def _get_path_identity(
    path: Optional[str],
    windows_property: str,
    windows_fallback: Callable[[], Optional[str]],
    unix_lookup: Callable[[str], Optional[str]],
) -> Optional[str]:
    if not path or not os.path.exists(path):
        return None

    if os.name == "nt":
        try:
            result = subprocess.run(
                [
                    "powershell.exe",
                    "-NoProfile",
                    "-NonInteractive",
                    "-Command",
                    f"(Get-Acl -LiteralPath $args[0]).{windows_property}",
                    path,
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=10,
            )
        except (OSError, subprocess.TimeoutExpired):
            return windows_fallback()

        return result.stdout.strip() or windows_fallback()

    try:
        return unix_lookup(path)
    except (ImportError, KeyError, OSError):
        return None


def get_path_owner(path: Optional[str]) -> Optional[str]:
    return _get_path_identity(path, "Owner", get_current_os_user, _get_unix_owner)


def get_path_group(path: Optional[str]) -> Optional[str]:
    return _get_path_identity(path, "Group", lambda: None, _get_unix_group)


def _set_windows_private_dacl(path: str, subject: str) -> None:
    username = os.environ.get("USERNAME")
    if not username:
        raise OSError(f"Unable to determine the Windows user for {subject}")

    user_domain = os.environ.get("USERDOMAIN") or os.environ.get("UserDomain")
    principals = [f"{user_domain}\\{username}"] if user_domain else []
    principals.append(username)

    for principal in principals:
        command = [
            "icacls",
            path,
            "/inheritance:r",
            "/grant:r",
            f"{principal}:(F)",
            "/grant:r",
            "*S-1-5-32-544:(F)",
            "/grant:r",
            "*S-1-5-18:(F)",
        ]
        result = subprocess.run(
            command,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            check=False,
        )
        if result.returncode == 0:
            return

    raise OSError(f"Unable to restrict permissions for {subject}")


def _open_private(path: str, subject: str, mode: int) -> int:
    if os.path.islink(path):
        raise ValueError(f"{subject} cannot be a symbolic link")

    flags = os.O_WRONLY | os.O_CREAT
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW

    fd = os.open(path, flags, mode)
    try:
        file_stat = os.fstat(fd)
        if not stat.S_ISREG(file_stat.st_mode):
            raise ValueError(f"{subject} must be a regular file")
        if getattr(file_stat, "st_nlink", 1) > 1:
            raise ValueError(f"{subject} cannot be a hard link")

        if os.name == "nt":
            _set_windows_private_dacl(path, subject)
        elif hasattr(os, "fchmod"):
            os.fchmod(fd, mode)
        else:
            os.chmod(path, mode)
        os.ftruncate(fd, 0)
    except Exception:
        os.close(fd)
        raise

    return fd


def write_text_private(
    path: str,
    content: str,
    subject: str = "File content target",
    mode: int = 0o600,
) -> None:
    fd = _open_private(path, subject, mode)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as file:
            fd = -1
            file.write(content)
    finally:
        if fd >= 0:
            os.close(fd)
