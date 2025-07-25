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

echo "Starting the fix of Railroad Diagram height issues ..."

cd docs/images/sql

sed -i '' 's/147"/177"/g' showRestViewsStatement.svg

sed -i '' 's/163"/183"/g' showCreateRestSchemaStatement.svg

sed -i '' 's/147"/177"/g' showCreateRestViewStatement.svg

sed -i '' 's/131"/151"/g' showCreateRestProcedureStatement.svg

sed -i '' 's/147"/177"/g' showCreateRestAuthAppStatement.svg

sed -i '' 's/147"/177"/g' showCreateRestContentSetStatement.svg

sed -i '' 's/131"/177"/g' showRestGrantsStatement.svg

sed -i '' 's/147"/177"/g' dumpRestProjectService.svg

echo "SVG files have been patched."
