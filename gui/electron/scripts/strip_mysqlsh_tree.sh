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
# documentation. The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have either included with
# the program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

set -euo pipefail

APPLY_CHANGES=0
MYSQLSH_TREE=""

function usage() {
    cat <<EOF
Remove low-risk development-only content from a staged mysqlsh tree.

Usage: strip_mysqlsh_tree.sh [--apply] <mysqlsh-tree>

Examples:
  strip_mysqlsh_tree.sh ../packaging/mysql-shell-staging/darwin-arm64
  strip_mysqlsh_tree.sh --apply ../packaging/mysql-shell-staging/darwin-arm64

Behavior:
  Without --apply, the script prints what it would remove.
  With --apply, it removes conservative cleanup targets such as:
  - plugin tests/, docs/, examples/, node_modules/, .vscode/
  - run_tests.py, pytest*.ini, cspell.json, python.env
EOF
}

while [ $# -gt 0 ]; do
    argument="$1"

    case "$argument" in
        --apply)
            APPLY_CHANGES=1
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        --*)
            echo "ERROR: Unknown option '$argument'."
            usage
            exit 1
            ;;
        *)
            if [ -n "$MYSQLSH_TREE" ]; then
                echo "ERROR: Only one mysqlsh tree path can be specified."
                exit 1
            fi

            MYSQLSH_TREE="$argument"
            shift
            ;;
    esac
done

if [ -z "$MYSQLSH_TREE" ]; then
    usage
    exit 1
fi

if [ ! -d "$MYSQLSH_TREE" ]; then
    echo "ERROR: mysqlsh tree does not exist: $MYSQLSH_TREE"
    exit 1
fi

MYSQLSH_TREE="$(cd "$MYSQLSH_TREE" && pwd -P)"

for required_dir in bin lib share; do
    if [ ! -e "$MYSQLSH_TREE/$required_dir" ]; then
        echo "ERROR: Expected '$MYSQLSH_TREE/$required_dir' to exist."
        exit 1
    fi
done

PLUGIN_ROOT="$MYSQLSH_TREE/lib/mysqlsh/plugins"
if [ ! -d "$PLUGIN_ROOT" ]; then
    echo "ERROR: Plugin root does not exist: $PLUGIN_ROOT"
    exit 1
fi

declare -a removal_candidates=()

while IFS= read -r candidate; do
    removal_candidates+=("$candidate")
done < <(
    find "$PLUGIN_ROOT" \
        \( \
            -type d \( -name tests -o -name docs -o -name examples -o -name node_modules -o -name .vscode -o -name __pycache__ \) \
            -o -type f \( -name "run_tests.py" -o -name "pytest.ini" -o -name "pytest-coverage.ini" -o -name "cspell.json" -o -name "python.env" \) \
        \) \
        | sort
)

if [ ${#removal_candidates[@]} -eq 0 ]; then
    echo "No cleanup candidates found under $PLUGIN_ROOT"
    exit 0
fi

echo "mysqlsh tree: $MYSQLSH_TREE"
if [ "$APPLY_CHANGES" -eq 1 ]; then
    echo "Mode: apply"
else
    echo "Mode: dry-run"
fi
echo
echo "Cleanup candidates:"

total_bytes=0

for candidate in "${removal_candidates[@]}"; do
    if [ -d "$candidate" ]; then
        size_kb="$(du -sk "$candidate" | awk '{print $1}')"
    else
        size_kb="$(du -k "$candidate" | awk '{print $1}')"
    fi

    total_bytes=$((total_bytes + size_kb * 1024))
    printf '  %8s  %s\n' "$(du -sh "$candidate" | awk '{print $1}')" "$candidate"
done

echo
printf 'Estimated removable size: %.1f MB\n' "$(awk "BEGIN { print $total_bytes / 1024 / 1024 }")"

if [ "$APPLY_CHANGES" -ne 1 ]; then
    echo "Dry run complete. Re-run with --apply to delete these paths."
    exit 0
fi

echo
echo "Removing cleanup candidates..."
for candidate in "${removal_candidates[@]}"; do
    rm -rf "$candidate"
done

echo "Cleanup complete."
