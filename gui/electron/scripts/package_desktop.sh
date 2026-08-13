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

SUPPORTED_PLATFORMS=(
    "darwin-arm64"
    "darwin-x64"
    "win32-x64"
    "linux-arm64"
    "linux-x64"
)

TARGET_FILTER=""
DOWNLOAD_ELECTRON=0
MYSQLSH_TREE_PATH=""
QUICK_MODE=0
STAGE_MYSQLSH_ONLY=0
DEV_MODE=0
ARTIFACT_MODE=0
ZIP_MODE=0

function usage() {
    cat <<EOF
Creates standalone Electron desktop packages for the following platforms:
darwin-arm64, darwin-x64, win32-x64, linux-arm64, linux-x64

Usage: package_desktop.sh [single-platform] [--download-electron]
                          [--mysqlsh-tree <path>]
                          [--dev]
                          [--quick]
                          [--artifacts]
                          [--zip]

Defaults:
- MySQL Shell packages: packaging/mysql-shell/<archive>
- Electron cache:    packaging/electron/<platform> when present, otherwise
                     electron-builder downloads Electron
- Plugins source:    this repository checkout

MySQL Shell tree override:
- --mysqlsh-tree <path> may point either to a single unpacked mysqlsh tree
  (requires selecting a single platform) or to a directory with per-platform
  subdirectories such as <path>/darwin-arm64, <path>/linux-x64, etc.
- When --mysqlsh-tree points to a single unpacked tree and no platform is
  selected, the script stages that tree for the host platform and stops. This
  prepares the selected base or development runtime.

Development mode:
- --dev stages the host platform directly under
  packaging/mysql-shell-dev-staging/<platform>, replaces the project plugin
  directories with symlinks, and stops without packaging Electron.

Quick update:
- --quick requires a single platform and an existing packaged desktop bundle.
- It only refreshes the app payload inside the existing package instead of
  rebuilding the full runtime bundle.

Artifacts:
- --artifacts also creates installer and package artifacts under
  packaging/desktop-artifacts/<platform>.
- --zip creates ZIP archive artifacts under packaging/desktop-artifacts/<platform>.

Environment:
- ELECTRON_VERSION
EOF
}

while [ $# -gt 0 ]; do
    argument="$1"

    case "$argument" in
        --download-electron)
            DOWNLOAD_ELECTRON=1
            shift
            ;;
        --quick)
            QUICK_MODE=1
            shift
            ;;
        --dev)
            DEV_MODE=1
            shift
            ;;
        --artifacts)
            ARTIFACT_MODE=1
            shift
            ;;
        --zip)
            ZIP_MODE=1
            shift
            ;;
        --mysqlsh-tree)
            if [ $# -lt 2 ]; then
                echo "ERROR: Missing value for --mysqlsh-tree."
                usage
                exit 1
            fi

            MYSQLSH_TREE_PATH="$2"
            shift 2
            ;;
        --mysqlsh-tree=*)
            MYSQLSH_TREE_PATH="${argument#--mysqlsh-tree=}"
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
            if [ -n "$TARGET_FILTER" ]; then
                echo "ERROR: Only one platform filter can be specified."
                exit 1
            fi

            TARGET_FILTER="$argument"
            shift
            ;;
    esac
done

function array_contains() {
    local needle="$1"
    shift

    for item in "$@"; do
        if [ "$item" = "$needle" ]; then
            return 0
        fi
    done

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
        MINGW*:x86_64|MSYS*:x86_64|CYGWIN*:x86_64)
            echo "win32-x64"
            ;;
        *)
            echo "ERROR: Unsupported host platform: $system_name $machine_name" >&2
            return 1
            ;;
    esac
}

function resolve_electron_version() {
    node -e '
const version = require("./package.json").dependencies.electron;
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    console.error(`ERROR: Expected dependencies.electron to be an exact version, got ${version}`);
    process.exit(1);
}
process.stdout.write(version);
'
}

if [ -z "$TARGET_FILTER" ] && [ -n "$MYSQLSH_TREE_PATH" ] \
    && [ -e "$MYSQLSH_TREE_PATH/bin" ] && [ -e "$MYSQLSH_TREE_PATH/lib" ] && [ -e "$MYSQLSH_TREE_PATH/share" ]; then
    TARGET_FILTER="$(resolve_host_platform)"
    STAGE_MYSQLSH_ONLY=1
fi

if [ "$DEV_MODE" -eq 1 ]; then
    if [ -z "$TARGET_FILTER" ]; then
        TARGET_FILTER="$(resolve_host_platform)"
    fi

    STAGE_MYSQLSH_ONLY=1
fi

if [ -n "$TARGET_FILTER" ] && ! array_contains "$TARGET_FILTER" "${SUPPORTED_PLATFORMS[@]}"; then
    echo "ERROR: Unsupported platform '$TARGET_FILTER'."
    usage
    exit 1
fi

if [ "$QUICK_MODE" -eq 1 ] && [ -z "$TARGET_FILTER" ]; then
    echo "ERROR: --quick requires a single platform filter."
    usage
    exit 1
fi

if [ "$QUICK_MODE" -eq 1 ] && [ "$ARTIFACT_MODE" -eq 1 ]; then
    echo "ERROR: --quick cannot be combined with --artifacts."
    usage
    exit 1
fi

if [ "$QUICK_MODE" -eq 1 ] && [ "$ZIP_MODE" -eq 1 ]; then
    echo "ERROR: --quick cannot be combined with --zip."
    usage
    exit 1
fi

if [ "$DEV_MODE" -eq 1 ] && [ "$QUICK_MODE" -eq 1 ]; then
    echo "ERROR: --dev cannot be combined with --quick."
    usage
    exit 1
fi

if [ "$DEV_MODE" -eq 1 ] && [ "$ARTIFACT_MODE" -eq 1 ]; then
    echo "ERROR: --dev cannot be combined with --artifacts."
    usage
    exit 1
fi

if [ "$DEV_MODE" -eq 1 ] && [ "$ZIP_MODE" -eq 1 ]; then
    echo "ERROR: --dev cannot be combined with --zip."
    usage
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ELECTRON_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PREPARE_MYSQLSH_TREE_SCRIPT="$SCRIPT_DIR/prepare_mysqlsh_tree.py"

cd "$ELECTRON_DIR"

MYSQL_SHELL_CACHE_ROOT="$ELECTRON_DIR/packaging/mysql-shell"
ELECTRON_CACHE_ROOT="$ELECTRON_DIR/packaging/electron"
if [ "$DEV_MODE" -eq 1 ]; then
    MYSQL_SHELL_STAGING_ROOT="$ELECTRON_DIR/packaging/mysql-shell-dev-staging"
else
    MYSQL_SHELL_STAGING_ROOT="$ELECTRON_DIR/packaging/mysql-shell-staging"
fi

if [ -n "$MYSQLSH_TREE_PATH" ]; then
    if [ ! -d "$MYSQLSH_TREE_PATH" ]; then
        echo "ERROR: --mysqlsh-tree path does not exist: $MYSQLSH_TREE_PATH"
        exit 1
    fi

    MYSQLSH_TREE_PATH="$(cd "$MYSQLSH_TREE_PATH" && pwd -P)"
fi

if [ -z "${ELECTRON_VERSION:-}" ]; then
    ELECTRON_VERSION="$(resolve_electron_version)"
    export ELECTRON_VERSION
fi

PLUGIN_PATHS=(
    "$ELECTRON_DIR/../backend/gui_plugin"
    "$ELECTRON_DIR/../../mds_plugin"
    "$ELECTRON_DIR/../../mrs_plugin"
    "$ELECTRON_DIR/../../msm_plugin"
    "$ELECTRON_DIR/../../util_plugin"
)

PLUGIN_NAMES=(
    "gui_plugin"
    "mds_plugin"
    "mrs_plugin"
    "msm_plugin"
    "util_plugin"
)

if [ "$QUICK_MODE" -ne 1 ]; then
    for plugin_path in "${PLUGIN_PATHS[@]}"; do
        if [ ! -d "$plugin_path" ]; then
            echo "ERROR: The plugin source is missing from this repo: $plugin_path"
            exit 1
        fi
    done
fi

mkdir -p "$MYSQL_SHELL_CACHE_ROOT"
mkdir -p "$ELECTRON_CACHE_ROOT"

if [ ! -f "$PREPARE_MYSQLSH_TREE_SCRIPT" ]; then
    echo "ERROR: Missing MySQL Shell preparation helper: $PREPARE_MYSQLSH_TREE_SCRIPT"
    exit 1
fi

function flatten_directory() {
    local source_dir="$1"
    local target_dir="$2"

    rm -rf "$target_dir"

    shopt -s dotglob nullglob
    local children=("$source_dir"/*)
    shopt -u nullglob

    if [ ${#children[@]} -eq 1 ] && [ -d "${children[0]}" ]; then
        mv "${children[0]}" "$target_dir"
        rmdir "$source_dir"
    else
        mkdir -p "$target_dir"
        if [ ${#children[@]} -gt 0 ]; then
            mv "$source_dir"/* "$target_dir"/
        fi
        rmdir "$source_dir" 2>/dev/null || :
    fi

    shopt -u dotglob
}

function get_file_signature() {
    local file_path="$1"

    if stat --version >/dev/null 2>&1; then
        stat -c '%Y:%s' "$file_path"
    else
        stat -f '%m:%z' "$file_path"
    fi
}

function get_archive_cache_key() {
    local archive_path="$1"
    local archive_dir
    local archive_name

    archive_dir="$(cd "$(dirname "$archive_path")" && pwd -P)"
    archive_name="$(basename "$archive_path")"

    printf '%s|%s\n' "$archive_dir/$archive_name" "$(get_file_signature "$archive_path")"
}

function get_mysql_shell_staging_marker_path() {
    local target_dir="$1"

    printf '%s\n' "$target_dir/.mysql-shell-staging-source"
}

function mysql_shell_staging_is_current() {
    local source_key="$1"
    local target_dir="$2"
    local marker_path
    local cached_key

    if [ ! -d "$target_dir" ]; then
        return 1
    fi

    for required_dir in bin lib share; do
        if [ ! -e "$target_dir/$required_dir" ]; then
            return 1
        fi
    done

    marker_path="$(get_mysql_shell_staging_marker_path "$target_dir")"
    if [ ! -f "$marker_path" ]; then
        return 1
    fi

    cached_key="$(cat "$marker_path")"

    [ "$cached_key" = "$source_key" ]
}

function write_mysql_shell_staging_marker() {
    local source_key="$1"
    local target_dir="$2"
    local marker_path

    marker_path="$(get_mysql_shell_staging_marker_path "$target_dir")"
    printf '%s\n' "$source_key" > "$marker_path"
}

function extract_archive() {
    local archive_path="$1"
    local target_dir="$2"
    local cleanup_archive="${3:-0}"
    local temp_dir="${target_dir}.tmp"

    rm -rf "$temp_dir" "$target_dir"
    mkdir -p "$temp_dir"

    case "$archive_path" in
        *.zip)
            unzip -qq "$archive_path" -d "$temp_dir"
            ;;
        *.tar.gz)
            tar -xf "$archive_path" -C "$temp_dir"
            ;;
        *)
            echo "ERROR: Unsupported archive format: $archive_path"
            exit 1
            ;;
    esac

    if [ "$cleanup_archive" = "1" ]; then
        rm -f "$archive_path"
    fi

    flatten_directory "$temp_dir" "$target_dir"
}

function extract_archive_preserving_layout() {
    local archive_path="$1"
    local target_dir="$2"
    local cleanup_archive="${3:-0}"
    local temp_dir="${target_dir}.tmp"

    rm -rf "$temp_dir" "$target_dir"
    mkdir -p "$temp_dir" "$target_dir"

    case "$archive_path" in
        *.zip)
            unzip -qq "$archive_path" -d "$temp_dir"
            ;;
        *.tar.gz)
            tar -xf "$archive_path" -C "$temp_dir"
            ;;
        *)
            echo "ERROR: Unsupported archive format: $archive_path"
            exit 1
            ;;
    esac

    if [ "$cleanup_archive" = "1" ]; then
        rm -f "$archive_path"
    fi

    shopt -s dotglob nullglob
    local children=("$temp_dir"/*)
    if [ ${#children[@]} -gt 0 ]; then
        mv "${children[@]}" "$target_dir"/
    fi
    shopt -u dotglob nullglob

    rmdir "$temp_dir" 2>/dev/null || :
}

function install_dev_plugin_links() {
    local target_dir="$1"
    local plugins_dir="$target_dir/lib/mysqlsh/plugins"

    for index in "${!PLUGIN_NAMES[@]}"; do
        local plugin_name="${PLUGIN_NAMES[$index]}"
        local plugin_path="${PLUGIN_PATHS[$index]}"
        local target_path="$plugins_dir/$plugin_name"

        rm -rf "$target_path"
        ln -s "$plugin_path" "$target_path"
    done
}

function resolve_mysqlsh_package() {
    local platform="$1"
    local -a candidates=()
    local candidate=""

    case "$platform" in
        darwin-arm64)
            candidates=(
                "$MYSQL_SHELL_CACHE_ROOT/$platform.tar.gz"
                "$MYSQL_SHELL_CACHE_ROOT/$platform.zip"
                "$MYSQL_SHELL_CACHE_ROOT"/mysql-shell-*-macos*-arm64.tar.gz
                "$MYSQL_SHELL_CACHE_ROOT"/mysql-shell-*-macos*-arm64.zip
            )
            ;;
        darwin-x64)
            candidates=(
                "$MYSQL_SHELL_CACHE_ROOT/$platform.tar.gz"
                "$MYSQL_SHELL_CACHE_ROOT/$platform.zip"
                "$MYSQL_SHELL_CACHE_ROOT"/mysql-shell-*-macos*-x86-64bit.tar.gz
                "$MYSQL_SHELL_CACHE_ROOT"/mysql-shell-*-macos*-x86-64bit.zip
            )
            ;;
        win32-x64)
            candidates=(
                "$MYSQL_SHELL_CACHE_ROOT/$platform.zip"
                "$MYSQL_SHELL_CACHE_ROOT/$platform.tar.gz"
                "$MYSQL_SHELL_CACHE_ROOT"/mysql-shell-*-windows-x86-64bit.zip
                "$MYSQL_SHELL_CACHE_ROOT"/mysql-shell-*-windows-x86-64bit.tar.gz
            )
            ;;
        linux-arm64)
            candidates=(
                "$MYSQL_SHELL_CACHE_ROOT/$platform.tar.gz"
                "$MYSQL_SHELL_CACHE_ROOT/$platform.zip"
                "$MYSQL_SHELL_CACHE_ROOT"/mysql-shell-*-linux-*-aarch64.tar.gz
                "$MYSQL_SHELL_CACHE_ROOT"/mysql-shell-*-linux-*-arm64.tar.gz
                "$MYSQL_SHELL_CACHE_ROOT"/mysql-shell-*-linux-*-aarch64.zip
                "$MYSQL_SHELL_CACHE_ROOT"/mysql-shell-*-linux-*-arm64.zip
            )
            ;;
        linux-x64)
            candidates=(
                "$MYSQL_SHELL_CACHE_ROOT/$platform.tar.gz"
                "$MYSQL_SHELL_CACHE_ROOT/$platform.zip"
                "$MYSQL_SHELL_CACHE_ROOT"/mysql-shell-*-linux-*-x86-64bit.tar.gz
                "$MYSQL_SHELL_CACHE_ROOT"/mysql-shell-*-linux-*-x86-64.tar.gz
                "$MYSQL_SHELL_CACHE_ROOT"/mysql-shell-*-linux-*-x86-64bit.zip
                "$MYSQL_SHELL_CACHE_ROOT"/mysql-shell-*-linux-*-x86-64.zip
            )
            ;;
        *)
            echo "ERROR: Unsupported MySQL Shell target '$platform'."
            exit 1
            ;;
    esac

    shopt -s nullglob
    for candidate in "${candidates[@]}"; do
        if [ -f "$candidate" ]; then
            printf '%s\n' "$candidate"
            shopt -u nullglob
            return 0
        fi
    done
    shopt -u nullglob

    return 1
}

function resolve_mysqlsh_tree() {
    local platform="$1"
    local source_dir=""

    if [ -z "$MYSQLSH_TREE_PATH" ]; then
        return 1
    fi

    if [ -e "$MYSQLSH_TREE_PATH/bin" ] && [ -e "$MYSQLSH_TREE_PATH/lib" ] && [ -e "$MYSQLSH_TREE_PATH/share" ]; then
        if [ ${#TARGETS[@]} -ne 1 ]; then
            echo "ERROR: --mysqlsh-tree points to a single mysqlsh tree, but multiple platforms were requested."
            echo "Select one platform or provide a directory with per-platform subdirectories."
            exit 1
        fi

        printf '%s\n' "$MYSQLSH_TREE_PATH"
        return 0
    fi

    source_dir="$MYSQLSH_TREE_PATH/$platform"
    if [ -e "$source_dir/bin" ] && [ -e "$source_dir/lib" ] && [ -e "$source_dir/share" ]; then
        printf '%s\n' "$source_dir"
        return 0
    fi

    echo "ERROR: Could not find a mysqlsh tree for $platform under $MYSQLSH_TREE_PATH"
    echo "Expected either $MYSQLSH_TREE_PATH itself or $MYSQLSH_TREE_PATH/$platform to contain bin/, lib/, and share/."
    exit 1
}

function download_electron_for_platform() {
    local platform="$1"
    local electron_version="$2"
    local archive_path="$ELECTRON_CACHE_ROOT/$platform.zip"
    local url="https://github.com/electron/electron/releases/download/v$electron_version/electron-v$electron_version-$platform.zip"

    echo "Downloading Electron $electron_version for $platform..."
    curl -L --output "$archive_path" "$url"
    if [[ "$platform" == darwin-* ]]; then
        extract_archive_preserving_layout "$archive_path" "$ELECTRON_CACHE_ROOT/$platform"
    else
        extract_archive "$archive_path" "$ELECTRON_CACHE_ROOT/$platform"
    fi
    echo "Completed Electron download for $platform."
}

TARGETS=()

if [ -n "$TARGET_FILTER" ]; then
    TARGETS+=("$TARGET_FILTER")
else
    TARGETS=("${SUPPORTED_PLATFORMS[@]}")
fi

echo "Preparing Electron desktop packaging inputs..."

if [ "$QUICK_MODE" -eq 1 ]; then
    TARGETS_CSV="$(IFS=,; echo "${TARGETS[*]}")"

    echo "Quick-updating Electron desktop app payload for: $TARGETS_CSV"
    node --experimental-strip-types ./scripts/package_desktop.ts --targets="$TARGETS_CSV" --quick
    exit 0
fi

for platform in "${TARGETS[@]}"; do
    shell_tree="$(resolve_mysqlsh_tree "$platform" || true)"
    shell_package=""
    shell_dir="$MYSQL_SHELL_STAGING_ROOT/$platform"
    electron_dir="$ELECTRON_CACHE_ROOT/$platform"

    echo "Preparing MySQL Shell staging for $platform..."
    if [ -n "$shell_tree" ]; then
        echo "Copying MySQL Shell tree for $platform from $shell_tree..."
        PREPARE_MYSQLSH_TREE_ARGS=(stage)
        if [ "$STAGE_MYSQLSH_ONLY" -eq 0 ]; then
            PREPARE_MYSQLSH_TREE_ARGS+=(--optimize-oci)
        fi
        PREPARE_MYSQLSH_TREE_ARGS+=("$shell_tree" "$shell_dir")
        python3 "$PREPARE_MYSQLSH_TREE_SCRIPT" \
            "${PREPARE_MYSQLSH_TREE_ARGS[@]}"
        write_mysql_shell_staging_marker "tree:$shell_tree" "$shell_dir"
        echo "Completed MySQL Shell staging for $platform."
    else
        shell_package="$(resolve_mysqlsh_package "$platform" || true)"
        if [ -z "$shell_package" ]; then
            echo "ERROR: Missing MySQL Shell archive for $platform in $MYSQL_SHELL_CACHE_ROOT"
            echo "Provide a .tar.gz or .zip package there, for example '$platform.tar.gz' or the official mysql-shell archive."
            echo "Alternatively, pass --mysqlsh-tree <path> to use an unpacked mysqlsh tree."
            exit 1
        fi

        shell_source_key="$(get_archive_cache_key "$shell_package")"
        if mysql_shell_staging_is_current "$shell_source_key" "$shell_dir"; then
            echo "Using cached MySQL Shell staging for $platform at $shell_dir"
        else
            echo "Extracting MySQL Shell archive for $platform from $shell_package..."
            extract_archive "$shell_package" "$shell_dir"
            write_mysql_shell_staging_marker "$shell_source_key" "$shell_dir"
            echo "Completed MySQL Shell staging for $platform."
        fi

        if [ "$STAGE_MYSQLSH_ONLY" -eq 0 ]; then
            rm -f "$(get_mysql_shell_staging_marker_path "$shell_dir")"
        fi
        if [ "$STAGE_MYSQLSH_ONLY" -eq 0 ]; then
            python3 "$PREPARE_MYSQLSH_TREE_SCRIPT" optimize-oci "$shell_dir"
        fi
    fi

    if [ "$DEV_MODE" -eq 1 ]; then
        install_dev_plugin_links "$shell_dir"
    fi

    if [ "$STAGE_MYSQLSH_ONLY" -eq 1 ]; then
        if [ "$DEV_MODE" -eq 1 ]; then
            echo "MySQL Shell development runtime staged for $platform at $shell_dir"
        else
            echo "MySQL Shell runtime staged for $platform at $shell_dir"
        fi
        continue
    fi

    if [ ! -d "$electron_dir" ] && [ "$DOWNLOAD_ELECTRON" -eq 1 ]; then
        download_electron_for_platform "$platform" "$ELECTRON_VERSION"
    elif [ ! -d "$electron_dir" ]; then
        echo "No cached Electron runtime for $platform at $electron_dir"
        echo "electron-builder will download Electron $ELECTRON_VERSION if needed."
    else
        echo "Using cached Electron runtime for $platform at $electron_dir"
    fi
done

if [ "$STAGE_MYSQLSH_ONLY" -eq 1 ]; then
    if [ "$DEV_MODE" -eq 1 ]; then
        echo "Completed MySQL Shell development staging."
    else
        echo "Completed MySQL Shell staging."
    fi
    exit 0
fi

TARGETS_CSV="$(IFS=,; echo "${TARGETS[*]}")"
PACKAGE_ARGS=(--targets="$TARGETS_CSV")
if [ "$ARTIFACT_MODE" -eq 1 ]; then
    PACKAGE_ARGS+=(--artifacts)
fi
if [ "$ZIP_MODE" -eq 1 ]; then
    PACKAGE_ARGS+=(--zip)
fi

echo "Packaging Electron desktop runtime for: $TARGETS_CSV"
MYSQL_SHELL_STAGING_ROOT="$MYSQL_SHELL_STAGING_ROOT" \
node --experimental-strip-types ./scripts/package_desktop.ts "${PACKAGE_ARGS[@]}"
