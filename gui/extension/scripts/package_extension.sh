#!/bin/bash
# Copyright (c) 2022, 2024, Oracle and/or its affiliates.

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

# Creates MySQL Shell for VS Code extension packages for the following platforms:
# darwin-arm64, darwin-x64, win32-x64
# Usage: package_extension.sh [single-platform]
#
# This script assumes you have unpacked GUI, MDS, MRS plugins into
#
#   $HOME/.mysqlsh/plugins/gui_plugin
#   $HOME/.mysqlsh/plugins/mds_plugin
#   $HOME/.mysqlsh/plugins/mrs_plugin
#
# Note that if SHELL_VERSION is set in the environment, this script is
# assumed to be run from PB2 without prompting the user to input the
# version and without downloading packages from the internet. Instead
# the PB2 script has to unpack and create
#
#    packaging/mysql-shell/darwin-arm64
#    packaging/mysql-shell/darwin-x64
#    packaging/mysql-shell/win32-x64
#    packaging/mysql-shell/linux-arm64
#    packaging/mysql-shell/linux-x64
#
# The MySQL Router is now also included in the extension package. The following
# folders need to be created in the packaging directory. When building from PB2
# the latest router version from the mysql-trunk-http-rest-preview-release PB2
# branch needs to be used.
#
#    packaging/mysql-router/darwin-arm64
#    packaging/mysql-router/darwin-x64
#    packaging/mysql-router/win32-x64
#    packaging/mysql-router/linux-arm64
#    packaging/mysql-router/linux-x64

# Simple function to check url exists
# Usage: if `validate_url $url`; then dosomething; else echo "does not exist"; fi
function validate_url(){
    curl --output /dev/null --silent --head --fail "$url"
    return $?
}

# Function that tries to download the MySQL Shell macOS package for an unknow macosVersion
# Usage: download_shell_mac_pkg 8.0.29 arm64 packaging/mysql-shell/darwin-arm64.tar.gz
function download_shell_mac_pkg(){
    if [[ $# < 4 ]]; then
        macos_ver=11
    else
        macos_ver=$4
    fi

    url="https://dev.mysql.com/get/Downloads/MySQL-Shell/mysql-shell-$1-macos$macos_ver-$2.tar.gz"
    if `validate_url $url`; then
        curl -L --output $3 $url
        if [ $? -eq 0 ]; then
            DIR="$(dirname "$3")/$(basename "$3" .tar.gz)"
            mkdir $DIR
            tar -xf $3 -C $DIR
            rm $3
            mv -v $DIR/mysql-shell-$1-macos$macos_ver-$2/* $DIR
            rmdir $DIR/mysql-shell-$1-macos$macos_ver-$2
        fi
        return 0
    else
        ((macos_ver++))
        # Check till macos15
        if (( macos_ver < 16 )); then
            download_shell_mac_pkg $1 $2 $3 $macos_ver
            return $?
        else
            return 1
        fi
    fi
}

# Function that cleans up the OCI package to include just the modules that are used
# Usage: strip_oci_package ./path/to/oci
function strip_oci_package(){
    # Collect all folders to delete, except the ones in the list
    delFolders=()
    prefix="$1/"
    for dir in $1/*; do
        if [ -d "$dir" ]; then
            case ${dir#"$prefix"} in
                "core"|"constants.py"|"version.py"|"work_requests"|"compute_instance_agent"|"request.py"|"alloy.py"|"service_endpoints.py"|"regions.py"|"circuit_breaker"|"decorators.py"|"regions_definitions.py"|"signer.py"|"util.py"|"dns"|"config.py"|"fips.py"|"load_balancer"|"object_storage"|"exceptions.py"|"retry"|"_vendor"|"waiter.py"|"response.py"|"base_client.py"|"mysql"|"pagination"|"auth"|"bastion"|"identity")
                    # do nothing
                    ;;
                *)
                    # error
                    delFolders+=("$dir")
            esac
        fi
    done

    # Delete the folders
    if [ ${#delFolders[@]} -gt 0 ]; then
        rm -rf "${delFolders[@]}"

        # Remove full import from __init__.py
        if [[ $OSTYPE == 'darwin'* ]]; then
            sed -i '' '16,$d' $1/__init__.py
        else
            sed -i '16,$d' $1/__init__.py
        fi
    else
        echo OCI cleanup failed. Folder $1 not found.
    fi
}

echo "Starting MySQL Shell for VS Code Extension packaging..."

if [ ! -d "$HOME/.mysqlsh/plugins/gui_plugin" ]; then
    echo "ERROR: The gui_plugin is missing from ~/.mysqlsh/plugins/"
    exit 1
fi
if [ ! -d "$HOME/.mysqlsh/plugins/mds_plugin" ]; then
    echo "ERROR: The mds_plugin is missing from ~/.mysqlsh/plugins/"
    exit 1
fi
if [ ! -d "$HOME/.mysqlsh/plugins/mrs_plugin" ]; then
    echo "ERROR: The mrs_plugin is missing from ~/.mysqlsh/plugins/"
    exit 1
fi

if [ -z "${SHELL_VERSION}" ] && [ ! -d "packaging" ]; then
    echo "Setting up the packaging resources..."
    mkdir -p packaging/mysql-shell

    read -p "Which version of MySQL Shell should be used [8.0.29]? " SHELL_VERSION
    SHELL_VERSION=${SHELL_VERSION:-8.0.29}

    echo "Downloading MySQL Shell $SHELL_VERSION packages..."

    echo "Downloading darwin-arm64 package..."
    download_shell_mac_pkg $SHELL_VERSION arm64 packaging/mysql-shell/darwin-arm64.tar.gz
    if [ $? -ne 0 ]; then
        echo "Failed to download package for platform darwin-arm64."
    else
        echo "Completed."
    fi

    echo "Downloading darwin-x64 package..."
    download_shell_mac_pkg $SHELL_VERSION x86-64bit packaging/mysql-shell/darwin-x64.tar.gz
    if [ $? -ne 0 ]; then
        echo "Failed to download package for platform darwin-x64."
    else
        echo "Completed."
    fi

    echo "Downloading win32-x64 package..."
    curl -L --output packaging/mysql-shell/win32-x64.zip https://dev.mysql.com/get/Downloads/MySQL-Shell/mysql-shell-$SHELL_VERSION-windows-x86-64bit.zip
    if [ $? -eq 0 ]; then
        unzip -qq packaging/mysql-shell/win32-x64.zip -d packaging/mysql-shell/win32-x64
        rm packaging/mysql-shell/win32-x64.zip
        mv -v packaging/mysql-shell/win32-x64/mysql-shell-$SHELL_VERSION-windows-x86-64bit/* packaging/mysql-shell/win32-x64/
        rmdir packaging/mysql-shell/win32-x64/mysql-shell-$SHELL_VERSION-windows-x86-64bit
        echo "Completed."
    else
        echo "Failed to download package for platform win32-x64."
    fi
fi

# Clean output and packaging/extension-packages directories
echo "Cleaning output directories..."
rm -rf output
rm -rf packaging/extension-packages

# Create the packaging/extension-packages
mkdir -p packaging/extension-packages

for d in packaging/mysql-shell/*; do
    if [ -d "$d" ]; then
        PLATFORM=$(basename -- "$d")
        if [[ $# > 0 ]]; then
            if [ "$PLATFORM" != "$1" ]; then
                continue
            fi
        fi
        echo "Packaging extension for platform $PLATFORM"

        # Remove the shell directory if it exists
        if [ -d "shell" ]; then
            rm -rf shell
        fi

        # Make shell directory where the extension will expect the shell
        mkdir shell

        echo "Copy shell binaries, lib and share"
        cp -R $d/bin shell/.
        cp -R $d/lib shell/.
        cp -R $d/libexec shell/. 2>/dev/null || :
        cp -R $d/share shell/.

        echo "Cleanup OCI SDK folder"
        OCIPATH=shell/lib/mysqlsh/lib/python3.12/site-packages/oci
        if [ "$PLATFORM" == "linux-arm64" ] || [ "$PLATFORM" == "linux-x64" ]; then
            OCIPATH=shell/lib/mysqlsh/lib/python3.12/site-packages/oci
        elif [ "$PLATFORM" == "win32-x64" ]; then
            OCIPATH=shell/lib/Python3.12/Lib/site-packages/oci
        fi
        strip_oci_package $OCIPATH

        echo "Copy plugins"
        cp -RL $HOME/.mysqlsh/plugins/gui_plugin shell/lib/mysqlsh/plugins/.
        cp -RL $HOME/.mysqlsh/plugins/mds_plugin shell/lib/mysqlsh/plugins/.
        cp -RL $HOME/.mysqlsh/plugins/mrs_plugin shell/lib/mysqlsh/plugins/.

        # Clean *.py[co] files and __pycache__ directories
        find shell/lib/mysqlsh/plugins -type f -name '*.py[co]' -delete -o -type d -name __pycache__ -delete

        # Remove wrappers
        if [ -d "shell/lib/mysqlsh/plugins/gui_plugin/wrappers" ]; then
            rm -rf shell/lib/mysqlsh/plugins/gui_plugin/wrappers
        fi

        # Remove the shell directory if it exists
        if [ -d "router" ]; then
            rm -rf router
        fi

        # Make router directory where the extension will expect the router
        if [ -d "packaging/mysql-router/$PLATFORM/bin" ]; then
            echo "Copy router binaries, lib and share for platform $PLATFORM"

            mkdir router

            cp -R packaging/mysql-router/$PLATFORM/bin router/.
            cp -R packaging/mysql-router/$PLATFORM/lib router/.
        else
            echo "MySQL Router not found, skipping MySQL Router packaging."
        fi

        echo "Create VSIX package"
        vsce package --target $PLATFORM --baseImagesUrl https://github.com/mysql/mysql-shell-plugins/raw/master/gui/extension || exit 1

        mv -f *.vsix packaging/extension-packages/.
    fi
done

# Remove the router directory if it exists
if [ -d "router" ]; then
    rm -rf router
fi

# Remove the shell directory if it exists
if [ -d "shell" ]; then
    rm -rf shell
    echo "Done"
fi
