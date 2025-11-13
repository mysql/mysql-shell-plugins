# Copyright (c) 2025, Oracle and/or its affiliates.
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

from typing import Optional
from . import logging


class LogicError(Exception):
    pass


class BadRequest(Exception):
    """Unexpected/invalid/wrong request or request params from frontend"""

    def __init__(self, *args: object) -> None:
        super().__init__(*args)


class InvalidParameter(RuntimeError):
    def __init__(self, msg: str, input: str) -> None:
        super().__init__(msg)
        self.input = input


class BadUserInput(InvalidParameter):
    # Like InvalidParameter, but input is set in the tool
    def __init__(self, msg: str, input: str) -> None:
        super().__init__(msg, input)


class OCIError(RuntimeError):
    pass


class OCIConfigError(RuntimeError):
    pass


class OCIRuntimeError(OCIError):
    pass


class OCIAPIError(OCIError):
    pass


class OCIWorkRequestError(OCIError):
    def __init__(self, msg: str, errors: list[dict]) -> None:
        super().__init__(msg)
        self.errors = errors


class SSHError(RuntimeError):
    pass


class TimeoutError(RuntimeError):
    pass


class DumpError(RuntimeError):
    pass


class LoadError(RuntimeError):
    pass


class NetworkError(RuntimeError):
    pass


class Aborted(RuntimeError):
    pass


class RemoteHelperFailed(RuntimeError):
    "Errors from the helper itself failing (net error, bad install, corrupt etc)"
    pass


class MigrationRecoveryError(RuntimeError):
    "Can't recover/restart/resume migration project"
    pass


def format_exception(e: Exception, msg: str = "Error") -> tuple[str, str,  dict]:
    if isinstance(e, InvalidParameter):
        return (e.__class__.__name__, str(e), {"input": e.input})
    elif isinstance(e, BadUserInput):
        return (e.__class__.__name__, str(e), {"input": e.input})
    elif isinstance(e, OCIWorkRequestError):
        return (e.__class__.__name__, str(e), {"errors": e.errors})
    elif isinstance(e, Aborted):
        return (e.__class__.__name__, str(e) or "Aborted", {})

    return (e.__class__.__name__, str(e), {})
