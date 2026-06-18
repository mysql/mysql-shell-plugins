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
ELECTRON_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$(cd "$ELECTRON_DIR/../frontend" && pwd)"

VITE_HOST="${VITE_HOST:-127.0.0.1}"
VITE_PORT="${VITE_PORT:-5173}"
ELECTRON_RENDERER_URL="${ELECTRON_RENDERER_URL:-http://${VITE_HOST}:${VITE_PORT}/}"
MYSQLSH_USER_CONFIG_HOME="${MYSQLSH_USER_CONFIG_HOME:-$HOME/.mysqlsh}"

vite_pid=""

function cleanup() {
    if [ -n "$vite_pid" ] && kill -0 "$vite_pid" 2>/dev/null; then
        kill "$vite_pid" 2>/dev/null || true
        wait "$vite_pid" 2>/dev/null || true
    fi
}

function wait_for_vite() {
    local url="$1"

    for _attempt in $(seq 1 120); do
        if [ -n "$vite_pid" ] && ! kill -0 "$vite_pid" 2>/dev/null; then
            echo "ERROR: Vite dev server exited before Electron could start."
            return 1
        fi

        if curl --silent --fail --output /dev/null "$url"; then
            return 0
        fi

        sleep 0.5
    done

    echo "ERROR: Timed out waiting for Vite dev server at $url"
    return 1
}

trap cleanup EXIT INT TERM

cd "$FRONTEND_DIR"
npm run run-vite:dev-server -- --host "$VITE_HOST" --port "$VITE_PORT" --strictPort &
vite_pid=$!

wait_for_vite "$ELECTRON_RENDERER_URL"

cd "$ELECTRON_DIR"
ELECTRON_RENDERER_URL="$ELECTRON_RENDERER_URL" MYSQLSH_USER_CONFIG_HOME="$MYSQLSH_USER_CONFIG_HOME" ./node_modules/.bin/electron src/main.cjs "$@"
