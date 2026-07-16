# Copyright (c) 2020, 2026, Oracle and/or its affiliates.
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
# separately licensed software that they have either included with
# the program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

import socket
import sqlite3
import subprocess
import sys
import os
import stat
import getpass
import errno
from pathlib import Path, PurePath
from typing import Optional, Tuple, Union

import mysqlsh  # type: ignore
from mysqlsh.plugin_manager import plugin_function  # type: ignore

import gui_plugin.core.Error as Error
from gui_plugin.core.Error import MSGException


PathLike = Union[str, os.PathLike]
PRIVATE_DIRECTORY_MODE = stat.S_IRWXU
PRIVATE_FILE_MODE = stat.S_IRUSR | stat.S_IWUSR
PRIVATE_EXECUTABLE_MODE = stat.S_IRWXU


def get_plugin_data_path(plugin_name: str, *path_parts: str) -> str:
    """Return an absolute path below a plugin's private data directory."""
    import mysqlsh

    return os.path.abspath(
        mysqlsh.plugin_manager.general.get_shell_user_dir(
            "plugin_data", plugin_name, *path_parts
        )
    )


def ensure_plugin_data_path(plugin_name: str, *path_parts: str) -> str:
    """Return and create a plugin data directory with user-only access."""
    plugin_data_path = get_plugin_data_path(plugin_name, *path_parts)
    ensure_private_directory(plugin_data_path)
    return plugin_data_path


def _is_windows():
    return sys.platform == "win32" or sys.platform == "cygwin"


def get_user_domain():
    if _is_windows():
        # Try Windows environment variable first
        domain = os.environ.get("USERDOMAIN")
        if domain:
            return domain
        # Fallback: Use windows API
        try:
            import ctypes

            name = ctypes.create_unicode_buffer(256)
            size = ctypes.pointer(ctypes.c_ulong(256))
            # NameSamCompatible
            windll = ctypes.windll  # type: ignore
            if windll.secur32.GetUserNameExW(2, name, size):
                return name.value.split("\\")[0]
        except Exception:
            pass
    # For non-Windows platforms, no true domain concept exists.
    return None


def apply_user_only_access_permissions(path):
    if not os.path.exists(path):
        raise RuntimeError(
            "Failed attempting to set permissions on path that does not exist: {}".format(
                path
            )
        )

    if _is_windows():
        # General permissions strategy is:
        #   - if we create a new folder (e.g. C:\Users\opc\.oci), set access to allow full control for current user and no access for anyone else
        #   - if we create a new file, set access to allow full control for current user and no access for anyone else
        #   - thus if the user elects to place a new file (config or key) in an existing directory, we will not change the
        #     permissions of that directory but will explicitly set the permissions on that file
        username = getpass.getuser()
        userdomain = get_user_domain()
        userWithDomain = username
        if userdomain:
            userWithDomain = userdomain + "\\" + username
        admin_grp = "*S-1-5-32-544"
        system_usr = "*S-1-5-18"
        try:
            if os.path.isfile(path):
                subprocess.check_output(
                    'icacls "{path}" /reset'.format(path=path), stderr=subprocess.STDOUT
                )
                try:
                    subprocess.check_output(
                        'icacls "{path}" /inheritance:r /grant:r "{username}:F" /grant {admin_grp}:F /grant {system_usr}:F'.format(
                            path=path,
                            username=userWithDomain,
                            admin_grp=admin_grp,
                            system_usr=system_usr,
                        ),
                        stderr=subprocess.STDOUT,
                    )
                except subprocess.CalledProcessError:
                    subprocess.check_output(
                        'icacls "{path}" /inheritance:r /grant:r "{username}:F" /grant {admin_grp}:F /grant {system_usr}:F'.format(
                            path=path,
                            username=username,
                            admin_grp=admin_grp,
                            system_usr=system_usr,
                        ),
                        stderr=subprocess.STDOUT,
                    )
            else:
                if os.listdir(path):
                    # safety check to make sure we aren't changing permissions of existing files
                    raise RuntimeError(
                        "Failed attempting to set permissions on existing folder that is not empty."
                    )
                subprocess.check_output(
                    'icacls "{path}" /reset'.format(path=path), stderr=subprocess.STDOUT
                )
                try:
                    subprocess.check_output(
                        'icacls "{path}" /inheritance:r /grant:r "{username}:(OI)(CI)F"  /grant:r {admin_grp}:(OI)(CI)F /grant:r {system_usr}:(OI)(CI)F'.format(
                            path=path,
                            username=userWithDomain,
                            admin_grp=admin_grp,
                            system_usr=system_usr,
                        ),
                        stderr=subprocess.STDOUT,
                    )
                except subprocess.CalledProcessError:
                    subprocess.check_output(
                        'icacls "{path}" /inheritance:r /grant:r "{username}:(OI)(CI)F"  /grant:r {admin_grp}:(OI)(CI)F /grant:r {system_usr}:(OI)(CI)F'.format(
                            path=path,
                            username=username,
                            admin_grp=admin_grp,
                            system_usr=system_usr,
                        ),
                        stderr=subprocess.STDOUT,
                    )
        except subprocess.CalledProcessError as exc_info:
            print(
                "Error occurred while attempting to set permissions for {path}: {exception}".format(
                    path=path, exception=str(exc_info)
                )
            )
            sys.exit(exc_info.returncode)
    else:
        if os.path.isfile(path):
            os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)
        else:
            # For directories, we need to apply S_IXUSER otherwise it looks like on Linux/Unix/macOS if we create the directory then
            # it won't behave like a directory and let files be put into it
            os.chmod(path, stat.S_IRUSR | stat.S_IWUSR | stat.S_IXUSR)


def _directory_open_flags(no_follow: bool = False) -> int:
    if no_follow and not hasattr(os, "O_NOFOLLOW"):
        raise OSError(errno.ENOTSUP, "Symlink-safe directory access is unavailable")

    flags = os.O_RDONLY
    if hasattr(os, "O_DIRECTORY"):
        flags |= os.O_DIRECTORY
    if no_follow:
        flags |= os.O_NOFOLLOW
    return flags


def _open_directory_component(
    component: str, parent_fd: int, no_follow: bool = False
) -> int:
    try:
        return os.open(
            component, _directory_open_flags(no_follow), dir_fd=parent_fd
        )
    except OSError as exc:
        if no_follow and exc.errno == errno.ELOOP:
            raise ValueError(f"Symlink path component is not allowed: {component}")
        if no_follow and exc.errno == errno.ENOTDIR:
            try:
                component_mode = os.lstat(component, dir_fd=parent_fd).st_mode
            except FileNotFoundError:
                raise exc
            if stat.S_ISLNK(component_mode):
                raise ValueError(
                    f"Symlink path component is not allowed: {component}"
                )
        raise


def _ensure_private_directory_posix(directory_path: str) -> bool:
    """Create a directory tree without following a final symlink."""
    absolute_path = os.path.abspath(directory_path)
    components = [component for component in absolute_path.split(os.sep) if component]
    parent_fd = os.open(os.sep, _directory_open_flags())
    directory_created = False

    try:
        for index, component in enumerate(components):
            is_final_component = index == len(components) - 1
            component_created = False
            try:
                child_fd = _open_directory_component(
                    component, parent_fd, no_follow=is_final_component
                )
            except FileNotFoundError:
                try:
                    os.mkdir(component, PRIVATE_DIRECTORY_MODE, dir_fd=parent_fd)
                except FileExistsError:
                    pass
                else:
                    component_created = True
                child_fd = _open_directory_component(
                    component, parent_fd, no_follow=is_final_component
                )

            if component_created:
                os.fchmod(child_fd, PRIVATE_DIRECTORY_MODE)
                if component == components[-1]:
                    directory_created = True

            os.close(parent_fd)
            parent_fd = child_fd
    finally:
        os.close(parent_fd)

    return directory_created


def _open_existing_directory_posix(directory_path: str) -> int:
    absolute_path = os.path.abspath(directory_path)
    components = [component for component in absolute_path.split(os.sep) if component]
    parent_fd = os.open(os.sep, _directory_open_flags())

    try:
        for component in components:
            child_fd = _open_directory_component(component, parent_fd)
            os.close(parent_fd)
            parent_fd = child_fd
    except Exception:
        os.close(parent_fd)
        raise

    return parent_fd


def ensure_private_directory(directory: PathLike) -> bool:
    """Create a directory with access restricted to the current user."""
    directory_path = os.fspath(directory)
    if not _is_windows():
        if os.path.lexists(directory_path) and os.path.islink(directory_path):
            raise ValueError(f"Symlink directory is not allowed: {directory_path}")
        return _ensure_private_directory_posix(directory_path)

    if os.path.lexists(directory_path):
        if os.path.islink(directory_path) or not os.path.isdir(directory_path):
            raise ValueError(f"Expected a regular directory: {directory_path}")
        return False

    created_directories = []
    current_path = directory_path
    while not os.path.lexists(current_path):
        created_directories.append(current_path)
        parent_path = os.path.dirname(current_path)
        if parent_path == current_path:
            break
        current_path = parent_path

    directory_created = False
    for created_directory in reversed(created_directories):
        try:
            os.mkdir(created_directory, PRIVATE_DIRECTORY_MODE)
        except FileExistsError:
            continue

        if created_directory == directory_path:
            directory_created = True
        apply_user_only_access_permissions(created_directory)

    return directory_created


def ensure_private_file(file_path: PathLike) -> bool:
    """Create a file with access restricted to the current user."""
    file_name = os.fspath(file_path)
    if not _is_windows():
        if os.path.lexists(file_name) and os.path.islink(file_name):
            raise ValueError(f"Symlink file is not allowed: {file_name}")
        parent_path = os.path.dirname(os.path.abspath(file_name))
        parent_fd = _open_existing_directory_posix(parent_path)
        try:
            flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY
            if hasattr(os, "O_NOFOLLOW"):
                flags |= os.O_NOFOLLOW

            try:
                file_descriptor = os.open(
                    os.path.basename(file_name),
                    flags,
                    PRIVATE_FILE_MODE,
                    dir_fd=parent_fd,
                )
            except FileExistsError:
                try:
                    file_mode = os.lstat(
                        os.path.basename(file_name), dir_fd=parent_fd
                    ).st_mode
                except FileNotFoundError:
                    return False
                if stat.S_ISLNK(file_mode):
                    raise ValueError(f"Symlink file is not allowed: {file_name}")
                if not stat.S_ISREG(file_mode):
                    raise ValueError(f"Expected a regular file: {file_name}")
                return False

            try:
                os.fchmod(file_descriptor, PRIVATE_FILE_MODE)
            finally:
                os.close(file_descriptor)
            return True
        finally:
            os.close(parent_fd)

    if os.path.lexists(file_name):
        if os.path.islink(file_name) or not os.path.isfile(file_name):
            raise ValueError(f"Expected a regular file: {file_name}")
        apply_user_only_access_permissions(file_name)
        return False

    flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY
    try:
        file_descriptor = os.open(file_name, flags, PRIVATE_FILE_MODE)
    except FileExistsError:
        if os.path.islink(file_name) or not os.path.isfile(file_name):
            raise ValueError(f"Expected a regular file: {file_name}")
        return False
    else:
        os.close(file_descriptor)
        apply_user_only_access_permissions(file_name)
        return True


def secure_existing_file(file_path: PathLike) -> None:
    """Restrict an existing regular file to the current user."""
    file_name = os.fspath(file_path)
    if not _is_windows():
        if os.path.lexists(file_name) and os.path.islink(file_name):
            raise ValueError(f"Symlink file is not allowed: {file_name}")
        parent_path = os.path.dirname(os.path.abspath(file_name))
        try:
            parent_fd = _open_existing_directory_posix(parent_path)
        except FileNotFoundError:
            return

        try:
            try:
                file_descriptor = os.open(
                    os.path.basename(file_name),
                    os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0),
                    dir_fd=parent_fd,
                )
            except OSError as exc:
                if exc.errno == errno.ELOOP:
                    raise ValueError(f"Symlink file is not allowed: {file_name}")
                raise
            try:
                if not stat.S_ISREG(os.fstat(file_descriptor).st_mode):
                    raise ValueError(f"Expected a regular file: {file_name}")
                os.fchmod(file_descriptor, PRIVATE_FILE_MODE)
            finally:
                os.close(file_descriptor)
        except FileNotFoundError:
            return
        finally:
            os.close(parent_fd)
        return

    if not os.path.exists(file_name):
        return
    if os.path.islink(file_name) or not os.path.isfile(file_name):
        raise ValueError(f"Expected a regular file: {file_name}")
    apply_user_only_access_permissions(file_name)


def resolve_path(path: str, _user_id: Optional[int]) -> Tuple[str, str]:
    "This function returns a tuple (full path, relative path) with the resolved paths"
    if PurePath(Path(path).name.split(",")[0]).is_reserved():
        raise MSGException(
            Error.CORE_RESERVED_NOT_ALLOWED, "Reserved paths are not allowed."
        )

    if _user_id is None:
        # This is a local connection
        if os.path.isabs(path):
            return (
                Path(os.path.abspath(path)).as_posix(),
                Path(os.path.abspath(path)).as_posix(),
            )
        return (
            Path(os.path.abspath(os.path.join(str(Path.home()), path))).as_posix(),
            Path(str(Path.home())).as_posix(),
        )

    # This is a remote (non-local) connection
    if os.path.isabs(path):
        raise MSGException(
            Error.CORE_ABSPATH_NOT_ALLOWED, "Absolute paths are not allowed."
        )

    user_space = ensure_plugin_data_path("gui_plugin", f"user_{_user_id}")
    full_path = os.path.abspath(os.path.join(user_space, path))

    if not full_path.startswith(user_space):
        raise MSGException(
            Error.CORE_ACCESS_OUTSIDE_USERSPACE,
            "Trying to access outside the user directory.",
        )

    # +1 to remove the leading / since it's a relative path
    return Path(full_path).as_posix(), Path(full_path[len(user_space) + 1 :]).as_posix()


@plugin_function("gui.core.listFiles", shell=False, web=True)
def list_files(path: str = "", _user_id: Optional[int] = None) -> list[str]:
    """Returns the contents of a directory.

    It gets the contents of the specified directory and returns them.
    If running in multi-user mode, the directory is relative to the user space and requests
    outside the user space will result in error.
    If running in single-user mode, absolute paths area allowed, but if a relative path is
    supplied, then it will be relative to the system user home directory.
    If the path is empty, "." or "./" it will be resolved as the root to the relative
    path in the running mode.

    Args:
        path (str): The path to get the contents from
        _user_id (int): The id of the user.

    Returns:
        list: a list of files that exist in the requested directory
    """

    # the rel_path is the full_path on local sessions
    full_path, rel_path = resolve_path(path, _user_id)

    if not os.path.exists(full_path):
        raise MSGException(
            Error.CORE_PATH_NOT_EXIST, "The supplied path does not exist."
        )

    if not os.path.isdir(full_path):
        raise MSGException(
            Error.CORE_NOT_DIRECTORY, "The supplied path is not a directory."
        )

    if not os.access(full_path, os.R_OK):
        raise MSGException(
            Error.CORE_PERMISSION_DENIED, "No permissions to access the directory."
        )

    list_of_files = []
    for item in os.listdir(full_path):
        p = Path(os.path.join(rel_path, item))
        list_of_files.append(p.as_posix())

    return list_of_files


@plugin_function("gui.core.createFile", shell=False, web=True)
def create_file(path: str, _user_id: Optional[int] = None) -> str:
    """Creates a new file specified by the path.

    If running in multi-user mode, the directory is relative to the user space and requests
    outside the user space will result in error.
    If running in single-user mode, absolute paths area allowed, but if a relative path is
    supplied, then it will be relative to the system user home directory.
    If the path starts with "." or "./" it will be resolved as the root to the relative
    path in the running mode.

    The file type to be created is determined by the file extension.
    The supported file types are as follows:
        - SQLITE (use the .sqlite or .sqlite3 extensions)

    Args:
        path (str): The path and file name relative to the user space
        _user_id (int): The id of the user.

    Returns:
        str: the path to the created file on success.
    """

    if path == "":
        raise MSGException(Error.CORE_PATH_NOT_SUPPLIED, "The supplied path is empty.")

    # the rel_path is the full_path on local sessions
    full_path, rel_path = resolve_path(path, _user_id)

    if os.path.isdir(full_path):
        raise MSGException(Error.CORE_NOT_FILE, "The supplied path is not a file.")

    if not os.access(os.path.dirname(full_path), os.W_OK):
        raise MSGException(
            Error.CORE_PERMISSION_DENIED, "No permissions to access the directory."
        )

    if os.path.exists(full_path):
        raise MSGException(
            Error.CORE_PATH_ALREADY_EXISTS, "The supplied file already exists."
        )

    if full_path.endswith(".sqlite") or full_path.endswith(".sqlite3"):
        if _user_id is not None:
            ensure_private_file(full_path)
        conn = sqlite3.connect(full_path)
        conn.close()
    else:
        raise MSGException(
            Error.CORE_INVALID_EXTENSION, "The file does not have a valid extension."
        )

    return rel_path


@plugin_function("gui.core.validatePath", shell=False, web=True)
def validate_path(path: str, _user_id: Optional[int] = None) -> str:
    """Validates the specified path.

    If running in multi-user mode, the directory is relative to the user space and requests
    outside the user space will result in error.
    If running in single-user mode, absolute paths area allowed, but if a relative path is
    supplied, then it will be relative to the system user home directory.
    If the path is empty, "." or "./" it will be resolved as the root to the relative
    path in the running mode.

    Args:
        path (str): The path to a directory or file
        _user_id (int): The id of the user.

    Returns:
        str: The path to the created file on success.
    """

    # the rel_path is the full_path on local sessions
    full_path, rel_path = resolve_path(path, _user_id)
    return_path = full_path if _user_id is None else rel_path

    if not os.path.exists(full_path):
        raise MSGException(
            Error.CORE_PATH_NOT_EXIST, "The supplied path does not exist."
        )

    if not os.access(full_path, os.R_OK):
        raise MSGException(
            Error.CORE_PERMISSION_DENIED,
            "No permissions to read from the supplied path.",
        )

    if not os.access(full_path, os.W_OK):
        raise MSGException(
            Error.CORE_PERMISSION_DENIED,
            "No permissions to write in the supplied path.",
        )

    return return_path


@plugin_function("gui.core.probeLocalConnectionEndpoint", shell=False, web=True)
def probe_local_connection_endpoint(
    kind: str, target: str, port: Optional[int] = None
) -> dict:
    """Checks if a local database endpoint appears to be available.

    Args:
        kind (str): The endpoint kind. Valid values are "tcp", "socket", and "pipe".
        target (str): The hostname or path to probe.
        port (int): The TCP port to probe.

    Returns:
        dict: The advisory probe result.
    """

    if kind == "tcp":
        if port is None:
            return {
                "kind": kind,
                "status": "unknown",
                "target": target,
                "message": "TCP probe requires a port.",
            }

        try:
            with socket.create_connection((target, port), timeout=0.5):
                return {
                    "kind": kind,
                    "status": "available",
                    "target": f"{target}:{port}",
                }
        except (ConnectionRefusedError, TimeoutError, OSError) as reason:
            return {
                "kind": kind,
                "status": "unavailable",
                "target": f"{target}:{port}",
                "message": str(reason),
            }
        except Exception as reason:  # pylint: disable=broad-except
            return {
                "kind": kind,
                "status": "unknown",
                "target": f"{target}:{port}",
                "message": str(reason),
            }

    if kind in ("socket", "pipe"):
        try:
            if os.path.exists(target) and os.access(target, os.R_OK):
                return {"kind": kind, "status": "available", "target": target}

            return {"kind": kind, "status": "unavailable", "target": target}
        except OSError as reason:
            return {
                "kind": kind,
                "status": "unavailable",
                "target": target,
                "message": str(reason),
            }
        except Exception as reason:  # pylint: disable=broad-except
            return {
                "kind": kind,
                "status": "unknown",
                "target": target,
                "message": str(reason),
            }

    return {
        "kind": kind,
        "status": "unknown",
        "target": target,
        "message": f"Unsupported endpoint kind: {kind}.",
    }


@plugin_function("gui.core.deleteFile", shell=False, web=True)
def delete_file(path: str, _user_id: Optional[int] = None) -> None:
    """Deletes a file specified by the path.

    Args:
        path (str): The path and file name relative to the user space
        _user_id (int): The id of the user.

    Returns:
        None
    """

    if path == "":
        raise MSGException(Error.CORE_PATH_NOT_SUPPLIED, "The supplied path is empty.")

    # the rel_path is the full_path on local sessions
    full_path, _ = resolve_path(path, _user_id)

    if os.path.isdir(full_path):
        raise MSGException(Error.CORE_NOT_FILE, "The supplied path is not a file.")

    if not os.access(os.path.dirname(full_path), os.W_OK):
        raise MSGException(
            Error.CORE_PERMISSION_DENIED, "No permissions to access the directory."
        )

    if os.path.exists(full_path):
        os.remove(full_path)
