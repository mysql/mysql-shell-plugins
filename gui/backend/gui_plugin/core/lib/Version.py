# Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

import operator

class Version:
    def __init__(self, version=(0, 0, 0)):
        if isinstance(version, str):
            self._version = tuple(map(int, version.split('.')))
        else:
            self._version = tuple(map(int, version))

    def __str__(self):
        return ".".join([str(value) for value in self._version])

    def compare(self, version):
        if isinstance(version, Version):
            version = version._version

        return 1 if self._version > version \
                 else -1 if self._version < version \
                     else 0

    def __lt__(self, other):
        return self.compare(other) == -1
    def __le__(self, other):
        return self.compare(other) <= 0
    def __eq__(self, other):
        return self.compare(other) == 0
    def __ne__(self, other):
        return not self.compare(other) == 0
    def __gt__(self, other):
        return self.compare(other) == 1
    def __ge__(self, other):
        return self.compare(other) >= 0

    def __add__(self, other):
        return Version(tuple(map(operator.add, self._version, other._version)))

    def __sub__(self, other):
        return Version(tuple(map(operator.sub, self._version, other._version)))