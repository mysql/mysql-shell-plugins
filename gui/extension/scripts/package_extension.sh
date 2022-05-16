#!/bin/bash
# Copyright (c) 2022, Oracle and/or its affiliates.

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

# Creates MySQL Shell for VSCode extension packages for the following platforms:
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

# Simple function to check url exists
# Usage: if `validate_url $url`; then dosomething; else echo "does not exist"; fi
function validate_url(){
    curl --output /dev/null --silent --head --fail "$url"
    return $?
}

# Function that tries to download the MySQL Shell macOS package for an unknow macosVersion
# Usage: download_shell_mac_pkg 8.0.28 arm64 packaging/mysql-shell/darwin-arm64.tar.gz
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

echo "Starting MySQL Shell for VSCode Extension packaging..."

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

    read -p "Which version of MySQL Shell should be used [8.0.28]? " SHELL_VERSION
    SHELL_VERSION=${SHELL_VERSION:-8.0.28}

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
        cp -R $d/libexec shell/.
        cp -R $d/share shell/.


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

        echo "Create VSIX package"
        vsce package --target $PLATFORM --baseImagesUrl https://github.com/mysql/mysql-shell-plugins/raw/master/gui/extension || exit 1

        mv -f *.vsix packaging/extension-packages/.
    fi
done

# Remove the shell directory if it exists
if [ -d "shell" ]; then
    rm -rf shell
    echo "Done"
fi
