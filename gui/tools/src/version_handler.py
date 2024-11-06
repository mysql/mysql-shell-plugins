# Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA"""

from pathlib import Path
import json
import os

ROOT_PATH = Path(f"{os.path.dirname(__file__)}/../../../").resolve().as_posix()

VSCODE_EXTENSION_README_PATH = os.path.join(
    ROOT_PATH, 'gui', 'extension', 'README.md')
VSCODE_EXTENSION_CHANGELOG_PATH = os.path.join(
    ROOT_PATH, 'gui', 'extension', 'CHANGELOG.md')
VSCODE_EXTENSION_PACKAGE_PATH = os.path.join(
    ROOT_PATH, 'gui', 'extension', 'package.json')
GUI_EXTENSION_PACKAGE_PATH = os.path.join(
    ROOT_PATH, 'gui', 'frontend', 'package.json')
GUI_PLUGIN_GENERAL_PY_PATH = os.path.join(
    ROOT_PATH, 'gui', 'backend', 'gui_plugin', 'general.py')
MDS_PLUGIN_GENERAL_PY_PATH = os.path.join(
    ROOT_PATH, 'mds_plugin', 'general.py')
MRS_PLUGIN_GENERAL_PY_PATH = os.path.join(
    ROOT_PATH, 'mrs_plugin', 'lib', 'general.py')
REPO_VERSION = os.path.join(ROOT_PATH, 'VERSION')


def get_current_version(path, line_index=0):
    """
    Gets the current extension and shell version tuple from a file
    at line being the version in the format of <ext-version>+<shell-version>
    """
    data = None
    with open(path) as file:
        index = 0
        while True:
            version_line = file.readline()
            index = index+1
            if index >= line_index:
                break

        tokens = version_line.split("+")
        return tokens[0].split()[-1], tokens[1].split()[0]


def update_package_version(path, version):
    """
    Updates the version in s package.json file
    """
    data = None
    with open(path) as file:
        data = json.load(file)

    data["version"] = version

    with open(path, "w") as file:
        json.dump(data, file, indent=4)
        file.write("\n")


def update_plugin_version(path, version):
    """
    Updates the VERSION variable in the given path
    """
    lines = []
    with open(path) as file:
        lines = file.readlines()

    for index in range(len(lines)):
        if lines[index].startswith("VERSION"):
            lines[index] = f'VERSION = "{version}"\n'
            break

    with (open(path, 'w')) as file:
        file.write(''.join(lines))


def update_readme_version(e_version, s_version):
    """
    Updates the version in the VSCode Extension README file
    """
    lines = []
    with open(VSCODE_EXTENSION_README_PATH) as file:
        lines = file.readlines()

    lines[0] = f'# MySQL Shell for VS Code {e_version}+{s_version}\n'

    with (open(VSCODE_EXTENSION_README_PATH, 'w')) as file:
        file.write(''.join(lines))


def update_changelog_version(e_version, s_version):
    """
    Inserts a new entry in the CHANGELOG using the provided versions
    """
    lines = []
    with open(VSCODE_EXTENSION_CHANGELOG_PATH) as file:
        lines = file.readlines()

    new_lines = [
        f'## Changes in {target_e_version}+{target_s_version}\n',
        '\n',
        '### Additions\n',
        '\n',
        '- \n',
        '\n',
        '### Fixes\n',
        '\n',
        '- \n',
        '\n'
    ]

    new_lines.reverse()
    for line in new_lines:
        lines.insert(2, line)

    with (open(VSCODE_EXTENSION_CHANGELOG_PATH, 'w')) as file:
        file.write(''.join(lines))


def get_next_version(caption, current_version):
    target_version = input(f'{caption} [{current_version}] : ')
    if target_version == "":
        target_version = current_version
    return target_version


# Uses the version in the README file as the base version
current_e_version, current_s_version = current_version = get_current_version(
    VSCODE_EXTENSION_README_PATH)

# Allows the user providing new values for the extension and shell versions
target_e_version = get_next_version("New extension version", current_e_version)
target_s_version = get_next_version("New shell version", current_s_version)

# Updates the extension package.json only if needed
if current_e_version != target_e_version or current_s_version != target_s_version:
    update_package_version(VSCODE_EXTENSION_PACKAGE_PATH, target_e_version)
    update_readme_version(target_e_version, target_s_version)

# Synchronizes the version in the GUI and the BE plugins
update_package_version(GUI_EXTENSION_PACKAGE_PATH, target_e_version)

update_plugin_version(GUI_PLUGIN_GENERAL_PY_PATH, target_e_version)

update_plugin_version(MDS_PLUGIN_GENERAL_PY_PATH, target_e_version)

update_plugin_version(MRS_PLUGIN_GENERAL_PY_PATH, target_e_version)

# Adds a new entry on the CHANGE lgo for the new versions if needed
cl_e_version, cl_s_version = get_current_version(
    VSCODE_EXTENSION_CHANGELOG_PATH, 3)

print(cl_e_version, cl_s_version)

if cl_e_version != target_e_version or cl_s_version != target_s_version:
    update_changelog_version(target_e_version, target_s_version)

# Finall updates the repo VERSION file
with open(REPO_VERSION, "w") as file:
    file.write(f"VERSION={target_e_version}\n")
