# Copyright (c) 2022, 2026, Oracle and/or its affiliates.
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

"""Shared asynchronous callback helpers for backend unit tests."""

import threading
import types
import uuid

from tests.tests_timeouts import server_timeout


def backend_callback(expected_response_count=2, options=None):
    def decorator(function):
        def reset(self):
            self.current_response = 0
            self.total_responses = 0
            self.responses = []
            self.request_id = str(uuid.uuid1())
            self.finished = threading.Event()
            self.options = options if options is not None else {"row_packet_size": 25}

        def join(self, timeout=server_timeout()):
            if not self.finished.wait(timeout):
                raise Exception("Timeout waiting for operation to finish")

        def join_and_validate(self, timeout=server_timeout()):
            self.join(timeout)

            self.current_response = 0
            for response in self.responses:
                assert response["request_id"] == wrapper.request_id  # pylint: disable=no-member

                function(
                    response["state"],
                    response["message"],
                    response["request_id"],
                    response["values"],
                )
                self.current_response += 1

        def wrapper(state, message, request_id, values):
            wrapper.responses.append(  # pylint: disable=no-member
                {
                    "state": state,
                    "message": message,
                    "request_id": request_id,
                    "values": values,
                }
            )
            wrapper.total_responses += 1  # pylint: disable=no-member
            if wrapper.total_responses == expected_response_count:  # pylint: disable=no-member
                wrapper.finished.set()  # pylint: disable=no-member

        wrapper.reset = types.MethodType(reset, wrapper)
        wrapper.join = types.MethodType(join, wrapper)
        wrapper.join_and_validate = types.MethodType(join_and_validate, wrapper)
        wrapper.reset()  # pylint: disable=not-callable

        return wrapper

    return decorator


def backend_callback_with_pending(expected_response_count=1, options=None):
    def decorator(function):
        wrapper = backend_callback(expected_response_count + 1, options)(function)

        def join_and_validate(self, timeout=5):
            self.join(timeout)

            assert self.responses[0]["request_id"] == wrapper.request_id  # pylint: disable=no-member
            assert self.responses[0]["state"] == "PENDING"
            assert self.responses[0]["message"] == "Execution started..."
            assert self.responses[0]["values"] is None

            self.current_response = 1
            for response in self.responses[1:]:
                assert response["request_id"] == wrapper.request_id  # pylint: disable=no-member
                function(
                    response["state"],
                    response["message"],
                    response["request_id"],
                    response["values"],
                )
                self.current_response += 1

        wrapper.join_and_validate = types.MethodType(join_and_validate, wrapper)
        return wrapper

    return decorator


class ScopedCallback:
    def __init__(self, callback, *args, **kwargs):
        self.callback = callback
        self.args = args
        self.kwargs = kwargs

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.callback(*self.args, **self.kwargs)
