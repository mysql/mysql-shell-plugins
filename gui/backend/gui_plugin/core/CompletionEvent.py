# Copyright (c) 2023, Oracle and/or its affiliates.
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

import threading
from typing import List


class CompletionEvent(threading.Event):
    """Class implementing a completion event."""

    def __init__(self):
        super().__init__()
        self._errors = []
        self._cancelled = False

    def add_error(self, error: Exception) -> None:
        """Adds an error to the completion event for the current task.

        Args:
            error (Exception): The error
        """
        self._errors.append(error)
        self.set()

    @property
    def has_errors(self) -> bool:
        """Returns True if the completion event has any errors."""
        return len(self._errors) != 0

    def get_errors(self) -> List[Exception]:
        """Returns a list of all errors."""
        return self._errors

    def set_cancelled(self) -> None:
        """Sets the current task as cancelled."""
        self._cancelled = True
        self.set()

    @property
    def is_cancelled(self) -> bool:
        """Returns True if the current task is cancelled."""
        return self._cancelled
