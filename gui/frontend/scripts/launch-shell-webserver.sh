#!/bin/bash

# Copyright (c) 2022, 2025, Oracle and/or its affiliates.

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

# Retrieve the single parameter (either a token, a URL, or none)
PARAM=$1

# Validate the input: ensure at most one parameter is provided
if [[ $# -gt 1 ]]; then
    echo "Error: You must specify at most one parameter, either a token or a URL."
    exit 1
fi

# Determine if the parameter is a token, a URL, or empty
if [[ -n "$PARAM" ]]; then
    if [[ "$PARAM" =~ ^[0-9a-zA-Z_-]+$ ]]; then
        # Assume it's a token (simple alphanumeric string with optional dashes/underscores)
        OPTIONAL_PART=", single_instance_token='$PARAM'"
    elif [[ "$PARAM" =~ ^([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+|localhost):[0-9]+$ ]]; then
        # Assume it's a URL (IP:port or localhost:port format)
        OPTIONAL_PART=", single_server='$PARAM'"
    else
        echo "Error: Invalid parameter. Provide either a valid token or a URL in the format 'IP:port' or 'localhost:port'."
        exit 1
    fi
else
    # No parameter provided, optional part is empty
    OPTIONAL_PART=""
fi

# Set log level and execute the command
LOG_LEVEL=DEBUG2 mysqlsh --py -e "gui.start.web_server(port=8000,accept_remote_connections=True$OPTIONAL_PART)"
