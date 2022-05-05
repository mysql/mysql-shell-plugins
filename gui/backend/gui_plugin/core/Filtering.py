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

from enum import IntEnum
import json

SENSITIVE_DATA_REPLACEMENT = "****"

class FilterExpire(IntEnum):
    Never = 1
    OnUse = 2

class LogFilter():
    def __init__(self, expire_method):
        self._expired_method = expire_method
        self._expired = False

    def expired(self):
        return self._expired

    def apply(self, data):
        raise NotImplementedError()

    def _on_apply(self):
        if not self.expired() and self._expired_method == FilterExpire.OnUse:
            self._expired = True

class KeyFilter(LogFilter):
    def __init__(self, key, expire_method):
        self._key = key
        super().__init__(expire_method)

    def apply(self, data):
        try:
            json_message = json.loads(data)
            return json.dumps(self._filter_object(json_message))
        except Exception:
            return data

    def _filter_object(self, json_message):
        if self._key in json_message:
            json_message[self._key] = SENSITIVE_DATA_REPLACEMENT
            self._on_apply()
        for key, value in json_message.items():
            if isinstance(value, dict):
                json_message[key] = self._filter_object(value)
        return json_message

class SubstringFilter(LogFilter):
    def __init__(self, start, end, expire_method):
        self._start = start
        self._end = end
        super().__init__(expire_method)

    def apply(self, data):
        if isinstance(data, str):
            if self._start in data and self._end in data:
                start = data.find(self._start)+len(self._start)
                end = data.find(self._end)
                data = data[:start] + SENSITIVE_DATA_REPLACEMENT + data[end:]
                self._on_apply()
                return data