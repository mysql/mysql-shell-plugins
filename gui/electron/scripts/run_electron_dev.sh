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
REPO_DIR="$(cd "$ELECTRON_DIR/../.." && pwd)"

VITE_HOST="${VITE_HOST:-127.0.0.1}"
VITE_PORT="${VITE_PORT:-5173}"
ELECTRON_RENDERER_URL="${ELECTRON_RENDERER_URL:-}"
ELECTRON_MYSQLSH_PLATFORM="${ELECTRON_MYSQLSH_PLATFORM:-}"
ELECTRON_MYSQLSH_RUNTIME_DIR="${ELECTRON_MYSQLSH_RUNTIME_DIR:-}"
USE_VITE=1
ELECTRON_ARGS=()

vite_pid=""

for argument in "$@"; do
    case "$argument" in
        --built-renderer)
            USE_VITE=0
            ;;
        *)
            ELECTRON_ARGS+=("$argument")
            ;;
    esac
done

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

function resolve_host_platform() {
    local system_name
    local machine_name

    system_name="$(uname -s)"
    machine_name="$(uname -m)"

    case "$system_name:$machine_name" in
        Darwin:arm64)
            echo "darwin-arm64"
            ;;
        Darwin:x86_64)
            echo "darwin-x64"
            ;;
        Linux:aarch64|Linux:arm64)
            echo "linux-arm64"
            ;;
        Linux:x86_64|Linux:amd64)
            echo "linux-x64"
            ;;
        *)
            echo "ERROR: Unsupported host platform: $system_name $machine_name" >&2
            return 1
            ;;
    esac
}

function resolve_mysqlsh_runtime_dir() {
    if [ -n "$ELECTRON_MYSQLSH_RUNTIME_DIR" ]; then
        echo "$ELECTRON_MYSQLSH_RUNTIME_DIR"
        return 0
    fi

    if [ -z "$ELECTRON_MYSQLSH_PLATFORM" ]; then
        ELECTRON_MYSQLSH_PLATFORM="$(resolve_host_platform)"
    fi

    echo "$ELECTRON_DIR/packaging/mysql-shell-staging/$ELECTRON_MYSQLSH_PLATFORM"
}

function validate_mysqlsh_runtime_dir() {
    local runtime_dir="$1"
    local mysqlsh_binary="$runtime_dir/bin/mysqlsh"
    local plugins_dir="$runtime_dir/lib/mysqlsh/plugins"

    if [ ! -x "$mysqlsh_binary" ]; then
        echo "ERROR: Missing mysqlsh binary: $mysqlsh_binary"
        echo "Run package_desktop.sh once for this platform, or set ELECTRON_MYSQLSH_RUNTIME_DIR to a staged MySQL Shell tree."
        return 1
    fi

    if [ ! -d "$plugins_dir" ]; then
        echo "ERROR: Missing MySQL Shell builtin plugin directory: $plugins_dir"
        return 1
    fi
}

function install_plugin_link() {
    local plugin_name="$1"
    local source_dir="$2"
    local plugins_dir="$3"
    local target_dir="$plugins_dir/$plugin_name"

    if [ ! -d "$source_dir" ]; then
        echo "ERROR: Missing plugin source directory: $source_dir"
        return 1
    fi

    if [ -L "$target_dir" ]; then
        local link_target
        link_target="$(readlink "$target_dir")"
        if [ "$link_target" = "$source_dir" ]; then
            return 0
        fi
    fi

    rm -rf "$target_dir"
    ln -s "$source_dir" "$target_dir"
}

function install_plugin_links() {
    local runtime_dir="$1"
    local plugins_dir="$runtime_dir/lib/mysqlsh/plugins"

    install_plugin_link "gui_plugin" "$REPO_DIR/gui/backend/gui_plugin" "$plugins_dir"
    install_plugin_link "mds_plugin" "$REPO_DIR/mds_plugin" "$plugins_dir"
    install_plugin_link "mrs_plugin" "$REPO_DIR/mrs_plugin" "$plugins_dir"
    install_plugin_link "msm_plugin" "$REPO_DIR/msm_plugin" "$plugins_dir"
    install_plugin_link "util_plugin" "$REPO_DIR/util_plugin" "$plugins_dir"
    install_plugin_link "migration_plugin" "$REPO_DIR/migration_plugin" "$plugins_dir"
}

trap cleanup EXIT INT TERM

ELECTRON_MYSQLSH_RUNTIME_DIR="$(resolve_mysqlsh_runtime_dir)"
echo "Using MySQL Shell runtime: $ELECTRON_MYSQLSH_RUNTIME_DIR"
validate_mysqlsh_runtime_dir "$ELECTRON_MYSQLSH_RUNTIME_DIR"
install_plugin_links "$ELECTRON_MYSQLSH_RUNTIME_DIR"

if [ "$USE_VITE" -eq 1 ]; then
    ELECTRON_RENDERER_URL="${ELECTRON_RENDERER_URL:-http://${VITE_HOST}:${VITE_PORT}/}"

    cd "$FRONTEND_DIR"
    npm run run-vite:dev-server -- --host "$VITE_HOST" --port "$VITE_PORT" --strictPort --clearScreen false &
    vite_pid=$!

    wait_for_vite "$ELECTRON_RENDERER_URL"
fi

cd "$ELECTRON_DIR"
if [ "$USE_VITE" -eq 1 ] && [ "${#ELECTRON_ARGS[@]}" -gt 0 ]; then
    ELECTRON_RENDERER_URL="$ELECTRON_RENDERER_URL" ELECTRON_MYSQLSH_RUNTIME_DIR="$ELECTRON_MYSQLSH_RUNTIME_DIR" \
        ./node_modules/.bin/electron src/main.cjs "${ELECTRON_ARGS[@]}"
elif [ "$USE_VITE" -eq 1 ]; then
    ELECTRON_RENDERER_URL="$ELECTRON_RENDERER_URL" ELECTRON_MYSQLSH_RUNTIME_DIR="$ELECTRON_MYSQLSH_RUNTIME_DIR" \
        ./node_modules/.bin/electron src/main.cjs
elif [ "${#ELECTRON_ARGS[@]}" -gt 0 ]; then
    ELECTRON_MYSQLSH_RUNTIME_DIR="$ELECTRON_MYSQLSH_RUNTIME_DIR" \
        ./node_modules/.bin/electron src/main.cjs "${ELECTRON_ARGS[@]}"
else
    ELECTRON_MYSQLSH_RUNTIME_DIR="$ELECTRON_MYSQLSH_RUNTIME_DIR" \
        ./node_modules/.bin/electron src/main.cjs
fi
