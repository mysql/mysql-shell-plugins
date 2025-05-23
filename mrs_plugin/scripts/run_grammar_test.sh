#!/bin/bash
# Copyright (c) 2023, 2025, Oracle and/or its affiliates.

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

function check_errors() {
    grep --color=always -e ^ -e 'Syntax.*' -e 'Error:.*' -e '^ERROR.*' | while read line
    do
        echo "$line"
        if echo $line|grep '^.\[01;31m' > /dev/null; then
            sleep 5
        fi
    done
}

if test "$SLEEP_ON_ERROR" == 1; then
    color=check_errors
else
    color="grep --color=always -e ^ -e 'Syntax.*' -e 'Error:.*' -e '^ERROR.*'"
fi

mysqlsh root@localhost --sql -f "./grammar/test/grammar_test_setup.sql"
mysqlsh root@localhost --sql --interactive=full --log-level=debug3 --verbose=4 -f ./grammar/test/grammar_test.sql 2>&1 | $color

