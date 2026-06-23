#!/bin/bash
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
# separately licensed software that they have either included with
# the program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ELECTRON_DIR="$(cd "$FRONTEND_DIR/../electron" && pwd)"

setup_started=0
teardown_done=0

export DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:-Sakila1!}"

function teardown() {
    if [ "$setup_started" -eq 1 ] && [ "$teardown_done" -eq 0 ]; then
        teardown_done=1
        cd "$ELECTRON_DIR"
        npm run e2e-tests-teardown
    fi
}

function cleanup() {
    teardown || true
}

trap cleanup EXIT INT TERM

cd "$ELECTRON_DIR"
setup_started=1
npm run e2e-tests-setup

test_status=0
cd "$FRONTEND_DIR"
./node_modules/.bin/vitest run --no-watch --no-coverage "$@" || test_status=$?

teardown_status=0
teardown || teardown_status=$?

if [ "$test_status" -ne 0 ]; then
    exit "$test_status"
fi

exit "$teardown_status"
