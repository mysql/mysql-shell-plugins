#!/bin/bash
# Copyright (c) 2023, 2025, Oracle and/or its affiliates.

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

echo "Starting MRS parser file generation ..."

cd grammar

COPYRIGHT="# Copyright (c) 2023, 2025, Oracle and\/or its affiliates."

mkdir -p pytmp

sed -e 's/!this.isSqlModeActive(SqlMode.AnsiQuotes)/not self.isSqlModeActive("ANSI_QUOTES")/'\
     -e 's/this.isSqlModeActive(SqlMode.AnsiQuotes)/self.isSqlModeActive("ANSI_QUOTES")/'\
     MRSParser.g4 > pytmp/MRSParser.g4

sed -e 's/!this.isSqlModeActive(SqlMode.NoBackslashEscapes)/not self.isSqlModeActive("NO_BACKSLASH_ESCAPES")/'\
     -e 's/this.isSqlModeActive(SqlMode.NoBackslashEscapes)/self.isSqlModeActive("NO_BACKSLASH_ESCAPES")/'\
     MRSLexer.g4 > pytmp/MRSLexer.g4

cd pytmp
antlr4ng -Dlanguage=Python3 ./MRSLexer.g4 ./MRSParser.g4 -lib ../../../gui/frontend/src/parsing/mysql/ -o ../../lib/mrs_parser
cd ..

if [ $? -eq 0 ]; then
    if [[ $(uname -s) == "Darwin" ]]; then
        sed -i '' "1s/.*/$COPYRIGHT/" ../lib/mrs_parser/MRSParser.py
        sed -i '' "1s/.*/$COPYRIGHT/" ../lib/mrs_parser/MRSLexer.py
        sed -i '' "1s/.*/$COPYRIGHT/" ../lib/mrs_parser/MRSParserListener.py
    else
        sed -i'' -e "1s/.*/$COPYRIGHT/" ../lib/mrs_parser/MRSParser.py
        sed -i'' -e "1s/.*/$COPYRIGHT/" ../lib/mrs_parser/MRSLexer.py
        sed -i'' -e "1s/.*/$COPYRIGHT/" ../lib/mrs_parser/MRSParserListener.py
    fi

    echo "MRS parser file generation completed."
else
    echo "Failed to complete the MRS parser file generation."
    exit 1
fi
