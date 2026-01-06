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
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

# full end-to-end tests where all OCI resources are created from scratch

from unittest import mock
import pytest
from migration_plugin.lib.backend import model
from migration_plugin.lib.backend.sync_stages import CreateChannel

from .mock_helpers import make_stage_for_test, make_test_project, mock_get_db_system, mock_mds_plugin


def test_create_channel_filtering(mocker):
    """
    Ensure that replication filtering options are properly generated for
    schema, user and object filters.
    """

    mock_mds_plugin(mocker)

    project = make_test_project(mocker=mocker)
    stage = make_stage_for_test(CreateChannel, project)

    def test_one(filters, wild_ignore_tables=[]):
        project.options.migrationType = model.MigrationType.HOT
        project.options.schemaSelection.filter = filters

        mock_create_channel = mocker.patch(
            "migration_plugin.lib.oci_utils.DBSystem.create_channel")

        mock_get_db_system(mocker)

        stage.ensure_channel()

        mock_create_channel.assert_called_once()
        args, kwargs = mock_create_channel.call_args

        def fixup(s):
            return s.replace("`", "")

        assert set(
            kwargs["replicate_ignore_db"]) == set(
            [fixup(s) for s in filters.schemas.exclude])
        assert set(
            kwargs["replicate_ignore_table"]) == set(
            [fixup(t) for t in filters.tables.exclude])
        assert set(kwargs["replicate_wild_ignore_table"]
                   ) == set(wild_ignore_tables)

    test_one(model.MigrationFilters(
        schemas=model.IncludeList(
            include=[],
            exclude=[],
        ),
        tables=model.IncludeList(
            include=[],
            exclude=[],
        ),
        users=model.IncludeList(
            include=["ignore"],
            exclude=["ignore"],
        ),
        views=model.IncludeList(
            include=["ignore"],
            exclude=["ignore"],
        ),
        routines=model.IncludeList(
            include=["ignore"],
            exclude=["ignore"],
        ),
        events=model.IncludeList(
            include=["ignore"],
            exclude=["ignore"],
        ),
        libraries=model.IncludeList(
            include=["ignore"],
            exclude=["ignore"],
        ),
        triggers=model.IncludeList(
            include=["ignore"],
            exclude=["ignore"],
        ),
    ))

    test_one(model.MigrationFilters(
        schemas=model.IncludeList(
            include=[],
            exclude=["mydb1", "mydb2"],
        ),
        tables=model.IncludeList(
            include=[],
            exclude=["`db1`.`table1`", "`db2`.`table2`"],
        ),
        users=model.IncludeList(
            include=["ignore"],
            exclude=["ignore"],
        ),
        views=model.IncludeList(
            include=["ignore"],
            exclude=["ignore"],
        ),
        routines=model.IncludeList(
            include=["ignore"],
            exclude=["ignore"],
        ),
        events=model.IncludeList(
            include=["ignore"],
            exclude=["ignore"],
        ),
        libraries=model.IncludeList(
            include=["ignore"],
            exclude=["ignore"],
        ),
        triggers=model.IncludeList(
            include=["ignore"],
            exclude=["ignore"],
        ),
    ))

    test_one(model.MigrationFilters(
        schemas=model.IncludeList(
            include=[],
            exclude=[],
        ),
        tables=model.IncludeList(
            include=[],
            exclude=["`db1`.`table1`", "`db2`.`table2`"],
        )
    ))

    test_one(model.MigrationFilters(
        schemas=model.IncludeList(
            include=[],
            exclude=["mydb1", "mydb2"],
        ),
        tables=model.IncludeList(
            include=[],
            exclude=[],
        )
    ))

    project._source_info.serverType = model.ServerType.RDS
    test_one(model.MigrationFilters(
        schemas=model.IncludeList(
            include=[],
            exclude=[],
        ),
        tables=model.IncludeList(
            include=[],
            exclude=[],
        )
    ), wild_ignore_tables=["mysql.rds%"])

    test_one(model.MigrationFilters(
        schemas=model.IncludeList(
            include=[],
            exclude=["mydb1", "mydb2"],
        ),
        tables=model.IncludeList(
            include=[],
            exclude=[],
        )
    ), wild_ignore_tables=["mysql.rds%"])

    project._source_info.serverType = model.ServerType.Aurora
    test_one(model.MigrationFilters(
        schemas=model.IncludeList(
            include=[],
            exclude=["mydb1", "mydb2"],
        ),
        tables=model.IncludeList(
            include=[],
            exclude=[],
        )
    ), wild_ignore_tables=["mysql.rds%", "mysql.aurora%"])
