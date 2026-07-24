# Copyright (c) 2025, 2026, Oracle and/or its affiliates.
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

import json
import ipaddress
import queue
import re
import threading
import subprocess
import sys
import os
import stat
import getpass
import urllib.request
import ssl
import certifi
import time
from functools import cache
from typing import Optional

from . import logging


def sanitize_par_uri(par: str) -> str:
    return re.sub(r"(https://[^/]*)/p/([^/]*)/", r"\1/p/<redacted>/", par)


def sanitize_par_uri_in_list(l: list[str]) -> list[str]:
    return [sanitize_par_uri(i) for i in l]


k_san_dict_par = {"access_uri": sanitize_par_uri, "full_path": sanitize_par_uri}
k_san_dict_connection = {"password": lambda s: "****"}

k_sensitive_fields = [
    "password",
    "adminPassword",
    "adminPasswordConfirm",
    "pass_phrase",
]


def sanitize_dict(d: dict, f: dict) -> dict:
    """
    Sanitize dict d by applying functions in dict f corresponding to each key.
    Example:
        print(sanitize_dict(connection_options, k_san_dict_connection))
    """
    return {k: f.get(k, lambda s: s)(v) for k, v in d.items()}


def sanitize_connection_dict(d: dict) -> dict:
    return sanitize_dict(d, k_san_dict_connection)


def sanitize_dict_any_pass(d: Optional[dict], delete: bool = False) -> Optional[dict]:
    """
    Recursively sanitize any field that contains "password" in its key.
    """
    if not d:
        return d

    out = {}
    for k, v in d.items():
        if k in k_sensitive_fields or "password" in k.lower():
            if not delete:
                out[k] = "****"
        elif isinstance(v, dict):
            out[k] = sanitize_dict_any_pass(v)
        elif isinstance(v, list):
            outl = []
            for i in v:
                if isinstance(i, dict):
                    outl.append(sanitize_dict_any_pass(i))
                else:
                    outl.append(i)
            out[k] = outl
        else:
            out[k] = v
    return out


def is_windows():
    return sys.platform == "win32" or sys.platform == "cygwin"


def get_user_domain():
    if is_windows():
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

    if is_windows():
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


g_ssl_context = ssl.create_default_context(cafile=certifi.where())


DEFAULT_PUBLIC_IP_URLS = tuple(
    url
    for url in (
        os.getenv("PUBLIC_IP_URL"),
        "https://api.ipify.org?format=json",
        "https://4.ident.me/",
        "https://cloudflare.com/cdn-cgi/trace",
        "https://ifconfig.co/json",
    )
    if url
)


def _validate_public_ipv4(ip: str) -> str:
    ip = ip.strip()
    try:
        ipaddress.IPv4Address(ip)
    except ValueError as exc:
        raise ValueError("response did not contain a valid IPv4 address") from exc
    return ip


def _extract_ip(url: str, body: str) -> str:
    body = body.strip()

    if body.startswith("{"):
        data = json.loads(body)
        ip = data.get("ip")
        if isinstance(ip, str):
            return _validate_public_ipv4(ip)
        raise ValueError("JSON response did not contain an ip field")

    for line in body.splitlines():
        if line.startswith("ip="):
            return _validate_public_ipv4(line[3:])

    return _validate_public_ipv4(body)


def _read_public_ip(url: str) -> str:
    with urllib.request.urlopen(url, context=g_ssl_context, timeout=5) as response:
        body = response.read().decode("utf-8", "strict").strip()
    return _extract_ip(url, body)


class _PublicIPv4LookupUnavailable(Exception):
    pass


def _lookup_my_public_ip() -> str:
    urls = DEFAULT_PUBLIC_IP_URLS
    if not urls:
        logging.warning(
            "Could not determine public IPv4 address: no public-IP endpoints configured"
        )
        raise _PublicIPv4LookupUnavailable

    result_queue = queue.Queue()
    stop_event = threading.Event()

    def lookup(index: int, url: str) -> None:
        try:
            ip = _read_public_ip(url)
            if not stop_event.is_set():
                result_queue.put((index, url, ip, None))
        except Exception as exc:
            if not stop_event.is_set():
                result_queue.put((index, url, None, exc))

    for index, url in enumerate(urls):
        thread = threading.Thread(
            target=lookup,
            args=(index, url),
            daemon=True,
        )
        thread.start()

    errors = {}
    for _ in urls:
        index, url, ip, exc = result_queue.get()
        if exc is None:
            stop_event.set()
            return ip

        errors[index] = f"{url}: {exc}"

    logging.warning(
        "Could not determine public IPv4 address from configured endpoints: "
        + "; ".join(errors[index] for index in range(len(urls)))
    )
    raise _PublicIPv4LookupUnavailable


@cache
def _get_my_public_ip_cached() -> str:
    return _lookup_my_public_ip()


def get_my_public_ip() -> str:
    try:
        return _get_my_public_ip_cached()
    except _PublicIPv4LookupUnavailable:
        return ""


def _clear_public_ip_cache() -> None:
    _get_my_public_ip_cached.cache_clear()


def interruptible_sleep(duration, interrupt_callback=None, poll_interval=0.1):
    """
    Sleep for a specified duration, optionally interrupting if a callback returns True.

    :param duration: The total duration to sleep in seconds.
    :param callback: An optional callback function that takes no arguments and
                     returns a boolean. If the callback returns True, the
                     sleep is interrupted.
    :param poll_interval: The interval at which the callback is checked.
    """
    end_time = time.time() + duration
    while (now := time.time()) < end_time:
        if interrupt_callback is not None and interrupt_callback():
            return False
        time.sleep(min(poll_interval, end_time - now))
    return True
