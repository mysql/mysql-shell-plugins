#!/bin/bash
# Copyright (c) 2023, Oracle and/or its affiliates.

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

echo "Starting MRS parser file generation ..."

cd grammar

COPYRIGHT="# Copyright (c) 2023, Oracle and\/or its affiliates."
ANTLR_JAR=./antlr-4.13.0-complete.jar
ANTLR_JAR_DOWNLOAD_URL=https://www.antlr.org/download/antlr-4.13.0-complete.jar

if [ ! -f "$ANTLR_JAR" ]; then
    echo "Downloading ANTLR jar file..."
    curl -L --output $ANTLR_JAR $ANTLR_JAR_DOWNLOAD_URL
    if [ $? -eq 0 ]; then
        echo "Download completed."
    else
        echo "Failed to download the ANTLR jar file from $ANTLR_JAR_DOWNLOAD_URL"
        exit 1
    fi
fi

java -jar $ANTLR_JAR -Dlanguage=Python3 ./MRS.g4 -o ../lib/mrs_parser
if [ $? -eq 0 ]; then
    sed -i '' "1s/.*/$COPYRIGHT/" ../lib/mrs_parser/MRSParser.py
    sed -i '' "1s/.*/$COPYRIGHT/" ../lib/mrs_parser/MRSLexer.py
    sed -i '' "1s/.*/$COPYRIGHT/" ../lib/mrs_parser/MRSListener.py

    echo "MRS parser file generation completed."
else
    echo "Failed to complete the MRS parser file generation."
    exit 1
fi