# Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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
from typing import Union

from gui_plugin.core.CompletionEvent import CompletionEvent


def get_context() -> Union[threading.local, None]:
    """Getting context of the current thread.

    Returns:
        threading.local | None: context of the current thread or None if no context
    """

    current_thread = threading.current_thread()
    if hasattr(current_thread, "get_context"):
        return current_thread.get_context()

    return None


def set_completion_event() -> Union[CompletionEvent, None]:
    """Creates and adds CompletionEvent to the current thread context.

    Returns:
        CompletionEvent | None: The created CompletionEvent or None if no context
    """
    context = get_context()
    if context:
        context.completion_event = CompletionEvent()
        return context.completion_event

    return None
