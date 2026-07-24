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

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from gui_plugin.migration.lib import dbsession
from gui_plugin.migration.lib.backend import model, target_config


class FakeCompartment:

    def __init__(self, config, *args, **kwargs):
        self._config = config
        self.id = config["tenancy"]

    def list_availability_domains(self):
        return [SimpleNamespace(name=f'{self._config["region"]}-ad-1')]

    def list_db_versions(self):
        return [SimpleNamespace(version_family="8.4", versions=[])]

    def list_db_shapes(self, availability_domain=None):
        return [SimpleNamespace(name=f"{availability_domain}-shape")]


class EmptyCatalogCompartment(FakeCompartment):

    def list_db_versions(self) -> list[SimpleNamespace]:
        return []

    def list_db_shapes(
        self, availability_domain: str | None = None
    ) -> list[SimpleNamespace]:
        return [SimpleNamespace(name="MySQL.2")]


class TestConfigureTargetDBSystem:

    def test_region_specific_shape_cache_is_not_shared_between_instances(self):
        server_info = MagicMock()
        find_shared_ssh_key_cb = MagicMock()

        with patch(
            "gui_plugin.migration.lib.backend.target_config.oci_utils.Compartment",
            FakeCompartment,
        ):
            ashburn = target_config.ConfigureTargetDBSystem(
                {
                    "tenancy": "ocid1.tenancy.oc1..exampleuniqueID",
                    "region": "us-ashburn-1",
                },
                find_shared_ssh_key_cb,
                server_info,
            )
            frankfurt = target_config.ConfigureTargetDBSystem(
                {
                    "tenancy": "ocid1.tenancy.oc1..exampleuniqueID",
                    "region": "eu-frankfurt-1",
                },
                find_shared_ssh_key_cb,
                server_info,
            )

            ashburn._load_compartment_capabilities()
            frankfurt._load_compartment_capabilities()

        assert list(ashburn.shapes) == ["us-ashburn-1-ad-1"]
        assert list(frankfurt.shapes) == ["eu-frankfurt-1-ad-1"]

    def test_empty_version_catalog_reaches_controlled_validation(self) -> None:
        with patch(
            "gui_plugin.migration.lib.backend.target_config.oci_utils.Compartment",
            EmptyCatalogCompartment,
        ):
            configurator = target_config.ConfigureTargetDBSystem(
                {
                    "tenancy": "ocid1.tenancy.oc1..exampleuniqueID",
                    "region": "us-ashburn-1",
                },
                lambda _instance_id=None: None,
                _mysql_server_info("28.7.0"),
            )
            configurator._load_compartment_capabilities()

        issues = configurator.validate_target_mysql_options(
            _db_system_options(), None
        )

        version_issues = [
            issue for issue in issues if issue.info["input"] == "database.mysqlVersion"
        ]
        assert len(version_issues) == 1
        assert version_issues[0].type == "BadUserInput"
        assert version_issues[0].message.endswith("Available OCI versions: none")


def _version_summary(*versions: str | None) -> SimpleNamespace:
    return SimpleNamespace(
        versions=[
            SimpleNamespace(version=version) if version is not None else SimpleNamespace()
            for version in versions
        ]
    )


def _configurator(
    server_info: model.ServerInfo, versions: list[SimpleNamespace]
) -> target_config.ConfigureTargetDBSystem:
    with patch(
        "gui_plugin.migration.lib.backend.target_config.oci_utils.Compartment",
        return_value=MagicMock(),
    ):
        configurator = target_config.ConfigureTargetDBSystem(
            {}, lambda _instance_id=None: None, server_info
        )
    configurator.versions = versions
    return configurator


def _db_system_options(
    mysql_version: str = "", shape_name: str = "MySQL.2"
) -> model.DBSystemOptions:
    return model.DBSystemOptions(
        adminUsername="admin",
        adminPassword="ValidPassword1!",
        adminPasswordConfirm="ValidPassword1!",
        mysqlVersion=mysql_version,
        name="target",
        shapeName=shape_name,
        storageSizeGB=50,
    )


def _mysql_server_info(
    version: str, server_type: model.ServerType = model.ServerType.MySQL
) -> model.ServerInfo:
    return model.ServerInfo(version=version, serverType=server_type)


class TestReleaseSeries:

    def test_calendar_release_series_boundaries(self):
        assert dbsession.version_to_release_series("9.7.2") == 9
        assert dbsession.version_to_release_series("26.7.0") == 10
        assert dbsession.version_to_release_series("28.4.0-cloud") == 10
        assert dbsession.version_to_release_series("28.7") == 11
        assert dbsession.version_to_release_series("30.4.0") == 11

    @pytest.mark.parametrize(
        ("version", "release_series"),
        [("26.8.0", 10), ("29.2.0", 11)],
    )
    def test_accepts_unexpected_calendar_release_month(
        self, version, release_series
    ):
        assert dbsession.version_to_release_series(version) == release_series

    @pytest.mark.parametrize(
        "version",
        ["10.4.0", "25.10.0", "26.4.0", "26.6.0", "not-a-version"],
    )
    def test_rejects_invalid_calendar_release_series(self, version):
        with pytest.raises(ValueError):
            dbsession.version_to_release_series(version)


class TestVersionRecommendation:

    def test_appends_mock_catalog_version_and_recommends_it(self, monkeypatch):
        monkeypatch.setenv("MYSQLSH_GUI_ENABLE_PLUGIN_MOCKS", "1")
        monkeypatch.setenv(
            "MIGRATION_TEST_OCI_MYSQL_VERSIONS", "26.7.0-commercial"
        )
        configurator = _configurator(
            _mysql_server_info("26.7.0-commercial"),
            [_version_summary("9.4.0")],
        )

        catalog_versions = configurator._get_catalog_versions(configurator.versions)

        assert [version.original for version in catalog_versions] == [
            "9.4.0",
            "26.7.0-commercial",
        ]
        assert (
            configurator.recommend_version(
                configurator._server_info, configurator.versions
            )
            == "26.7.0-commercial"
        )

    def test_does_not_duplicate_existing_mock_catalog_version(self, monkeypatch):
        monkeypatch.setenv("MYSQLSH_GUI_ENABLE_PLUGIN_MOCKS", "1")
        monkeypatch.setenv("MIGRATION_TEST_OCI_MYSQL_VERSIONS", "26.7.0")
        configurator = _configurator(
            _mysql_server_info("26.7.0"),
            [_version_summary("26.7.0", "26.7.0")],
        )

        catalog_versions = configurator._get_catalog_versions(configurator.versions)

        assert [version.original for version in catalog_versions] == ["26.7.0"]

    def test_rejects_mock_catalog_version_when_plugin_mocks_are_disabled(
        self, monkeypatch
    ):
        monkeypatch.delenv("MYSQLSH_GUI_ENABLE_PLUGIN_MOCKS", raising=False)
        monkeypatch.setenv("MIGRATION_TEST_OCI_MYSQL_VERSIONS", "26.7.0")
        configurator = _configurator(
            _mysql_server_info("26.7.0"), [_version_summary("9.4.0")]
        )

        with pytest.raises(RuntimeError, match="MYSQLSH_GUI_ENABLE_PLUGIN_MOCKS"):
            configurator._get_catalog_versions(configurator.versions)

    @pytest.mark.parametrize("mock_version", ["", "not-a-version"])
    def test_rejects_invalid_mock_catalog_version(self, monkeypatch, mock_version):
        monkeypatch.setenv("MYSQLSH_GUI_ENABLE_PLUGIN_MOCKS", "1")
        monkeypatch.setenv("MIGRATION_TEST_OCI_MYSQL_VERSIONS", mock_version)
        configurator = _configurator(
            _mysql_server_info("26.7.0"), [_version_summary("9.4.0")]
        )

        with pytest.raises(
            ValueError, match="MIGRATION_TEST_OCI_MYSQL_VERSIONS"
        ):
            configurator._get_catalog_versions(configurator.versions)

    def test_leaves_catalog_unchanged_without_mock_version(self, monkeypatch):
        monkeypatch.delenv("MYSQLSH_GUI_ENABLE_PLUGIN_MOCKS", raising=False)
        monkeypatch.delenv("MIGRATION_TEST_OCI_MYSQL_VERSIONS", raising=False)
        configurator = _configurator(
            _mysql_server_info("28.1.0"),
            [_version_summary("28.4.0", "26.7.0")],
        )

        catalog_versions = configurator._get_catalog_versions(configurator.versions)

        assert [version.original for version in catalog_versions] == [
            "26.7.0",
            "28.4.0",
        ]

    def test_recommendation_helper_returns_catalog_metadata(self):
        configurator = _configurator(
            _mysql_server_info("28.1.0"), [_version_summary("28.4.0")]
        )

        recommendation = configurator._recommend_version(
            configurator._parse_source_mysql_version(configurator._server_info),
            configurator._get_catalog_versions(configurator.versions),
            is_free=False,
            server_type=model.ServerType.MySQL,
        )

        assert recommendation
        assert recommendation.original == "28.4.0"
        assert recommendation.nversion == 280400
        assert recommendation.release_series == 10

    def test_uses_unordered_valid_catalog_versions_and_same_calendar_series(self):
        configurator = _configurator(
            _mysql_server_info("28.1.0"),
            [
                _version_summary("28.7.0", "malformed", "28.4.0", "28.4.0"),
                _version_summary(None, "26.7.0"),
            ],
        )

        assert configurator.recommend_version(
            configurator._server_info, configurator.versions
        ) == "28.4.0"

    def test_rejects_older_calendar_patch_before_recommending(self):
        configurator = _configurator(
            _mysql_server_info("26.7.3"),
            [_version_summary("26.7.2", "26.7.4")],
        )

        assert configurator.recommend_version(
            configurator._server_info, configurator.versions
        ) == "26.7.4"

    def test_uses_newest_84_version_without_downgrading_mysql_source(self):
        configurator = _configurator(
            _mysql_server_info("8.4.10"),
            [_version_summary("8.3.99", "8.4.9", "8.4.11", "8.4.10")],
        )

        assert configurator.recommend_version(
            configurator._server_info, configurator.versions
        ) == "8.4.11"

    def test_uses_newest_84_version_for_mariadb_without_numeric_comparison(self):
        configurator = _configurator(
            _mysql_server_info("10.11.0", model.ServerType.MariaDB),
            [_version_summary("8.4.9", "8.4.11")],
        )

        assert configurator.recommend_version(
            configurator._server_info, configurator.versions
        ) == "8.4.11"

    def test_does_not_recommend_an_older_calendar_version(self):
        configurator = _configurator(
            _mysql_server_info("27.1.0"),
            [_version_summary("26.7.0", "26.10.0")],
        )

        assert (
            configurator.recommend_version(
                configurator._server_info, configurator.versions
            )
            is None
        )

    def test_does_not_recommend_an_older_legacy_version(self):
        configurator = _configurator(
            _mysql_server_info("9.7.1"), [_version_summary("9.7.0")]
        )

        assert (
            configurator.recommend_version(
                configurator._server_info, configurator.versions
            )
            is None
        )

    def test_does_not_recommend_a_later_calendar_series(self):
        configurator = _configurator(
            _mysql_server_info("28.4.0"), [_version_summary("28.7.0")]
        )

        assert (
            configurator.recommend_version(
                configurator._server_info, configurator.versions
            )
            is None
        )

    def test_malformed_source_version_raises_value_error(self):
        configurator = _configurator(
            _mysql_server_info("not-a-version"), [_version_summary("28.4.0")]
        )

        with pytest.raises(ValueError, match="not-a-version"):
            configurator.recommend_version(configurator._server_info, configurator.versions)


class TestTargetVersionValidation:

    def test_reports_no_candidate_without_secondary_version_exception(self):
        configurator = _configurator(
            _mysql_server_info("28.7.0"), [_version_summary("28.4.0")]
        )
        options = _db_system_options()

        issues = configurator.validate_target_mysql_options(options, None)

        assert options.mysqlVersion == ""
        version_issues = [
            issue for issue in issues if issue.info["input"] == "database.mysqlVersion"
        ]
        assert len(version_issues) == 1
        assert "28.7.0" in version_issues[0].message
        assert "28.4.0" in version_issues[0].message

    def test_preserves_source_and_catalog_versions_in_no_candidate_error(
        self,
    ) -> None:
        configurator = _configurator(
            _mysql_server_info("28.7.0<img src=x onerror=alert(1)>"),
            [_version_summary("28.4.0<script>alert(2)</script>")],
        )
        options = _db_system_options()

        issues = configurator.validate_target_mysql_options(options, None)

        version_issues = [
            issue for issue in issues if issue.info["input"] == "database.mysqlVersion"
        ]
        assert len(version_issues) == 1
        message = version_issues[0].message
        assert "28.7.0<img src=x onerror=alert(1)>" in message
        assert "28.4.0<script>alert(2)</script>" in message

    @pytest.mark.parametrize(("has_mrs", "enable_ha"), [(True, False), (False, True)])
    def test_disables_rest_service_without_a_target_version(
        self, has_mrs, enable_ha
    ):
        server_info = _mysql_server_info("28.7.0")
        server_info.hasMRS = has_mrs
        configurator = _configurator(server_info, [_version_summary("28.4.0")])
        options = _db_system_options()
        options.enableHA = enable_ha
        options.enableRestService = True

        configurator.validate_target_mysql_options(options, None)

        assert options.mysqlVersion == ""
        assert not options.enableRestService

    def test_rejects_persisted_regular_shape_version_from_another_series(self):
        configurator = _configurator(
            _mysql_server_info("28.7.0"),
            [_version_summary("28.4.0", "28.7.0")],
        )
        options = _db_system_options("28.4.0")

        issues = configurator.validate_target_mysql_options(options, None)

        version_issues = [
            issue for issue in issues if issue.info["input"] == "database.mysqlVersion"
        ]
        assert len(version_issues) == 1
        assert "not compatible" in version_issues[0].message

    def test_free_tier_does_not_select_a_downgrade(self):
        configurator = _configurator(
            _mysql_server_info("30.4.0"),
            [_version_summary("30.1.0", "26.7.0")],
        )
        options = _db_system_options(shape_name="MySQL.Free")

        issues = configurator.validate_target_mysql_options(options, None)

        assert options.mysqlVersion == ""
        assert [
            issue for issue in issues if issue.info["input"] == "database.mysqlVersion"
        ]

    def test_rejects_persisted_free_tier_downgrade(self):
        configurator = _configurator(
            _mysql_server_info("28.7.0"),
            [_version_summary("28.4.0", "28.7.0")],
        )
        options = _db_system_options("28.4.0", "MySQL.Free")

        issues = configurator.validate_target_mysql_options(options, None)

        version_issues = [
            issue for issue in issues if issue.info["input"] == "database.mysqlVersion"
        ]
        assert len(version_issues) == 1
        assert "not compatible" in version_issues[0].message

    def test_rejects_stale_persisted_free_tier_mysql_version(self):
        configurator = _configurator(
            _mysql_server_info("28.4.0"),
            [_version_summary("28.4.0", "28.7.0")],
        )

        issues = configurator.validate_target_mysql_options(
            _db_system_options("28.4.0", "MySQL.Free"), None
        )

        version_issues = [
            issue for issue in issues if issue.info["input"] == "database.mysqlVersion"
        ]
        assert len(version_issues) == 1
        assert "not compatible" in version_issues[0].message

    def test_rejects_stale_persisted_free_tier_mariadb_version(self):
        configurator = _configurator(
            _mysql_server_info("10.11.0", model.ServerType.MariaDB),
            [_version_summary("8.4.10", "8.4.11")],
        )

        issues = configurator.validate_target_mysql_options(
            _db_system_options("8.4.10", "MySQL.Free"), None
        )

        version_issues = [
            issue for issue in issues if issue.info["input"] == "database.mysqlVersion"
        ]
        assert len(version_issues) == 1
        assert "not compatible" in version_issues[0].message

    def test_malformed_persisted_version_keeps_unrelated_validation_and_disables_rest(
        self,
    ):
        server_info = _mysql_server_info("28.7.0")
        server_info.hasMRS = True
        configurator = _configurator(server_info, [_version_summary("28.7.0")])
        options = _db_system_options("not-a-version")
        options.contactEmails = "invalid"
        options.enableRestService = True

        issues = configurator.validate_target_mysql_options(options, None)

        version_issues = [
            issue for issue in issues if issue.info["input"] == "database.mysqlVersion"
        ]
        assert len(version_issues) == 1
        assert "not a valid" in version_issues[0].message
        assert "not supported" not in version_issues[0].message
        assert [
            issue for issue in issues if issue.info["input"] == "database.contactEmails"
        ]
        assert not options.enableRestService

    def test_version_validator_rejects_malformed_persisted_version_once(self):
        configurator = _configurator(
            _mysql_server_info("28.7.0"), [_version_summary("28.7.0")]
        )

        issues = configurator.validate_target_mysql_version(
            _db_system_options("not-a-version")
        )

        assert len(issues) == 1
        assert "not-a-version" in issues[0].message
        assert "not a valid" in issues[0].message
        assert "not supported" not in issues[0].message

    def test_version_validator_returns_target_version_metadata(self):
        configurator = _configurator(
            _mysql_server_info("28.7.0"), [_version_summary("28.7.0")]
        )

        issues, target_version = configurator._validate_target_mysql_version(
            _db_system_options()
        )

        assert not issues
        assert target_version
        assert target_version.original == "28.7.0"
        assert target_version.nversion == 280700
        assert target_version.release_series == 11

    @pytest.mark.parametrize(
        "server_type", [model.ServerType.MySQL, model.ServerType.Percona]
    )
    def test_version_validator_rejects_malformed_mysql_family_source(
        self, server_type: model.ServerType
    ) -> None:
        configurator = _configurator(
            _mysql_server_info("not-a-version", server_type),
            [_version_summary("28.4.0")],
        )

        issues = configurator.validate_target_mysql_version(
            _db_system_options("28.4.0")
        )

        assert len(issues) == 1
        assert "not-a-version" in issues[0].message
        assert "source" in issues[0].message
        assert "available" not in issues[0].message
        assert "compatible" not in issues[0].message

    def test_version_validator_rejects_malformed_mariadb_source(self) -> None:
        configurator = _configurator(
            _mysql_server_info("not-a-version", model.ServerType.MariaDB),
            [_version_summary("8.4.11")],
        )

        issues = configurator.validate_target_mysql_version(
            _db_system_options("8.4.11")
        )

        assert len(issues) == 1
        assert "not-a-version" in issues[0].message
        assert "source" in issues[0].message
        assert "compatible" not in issues[0].message

    @pytest.mark.parametrize(
        ("source_version", "catalog_version", "persisted_version", "message_values"),
        [
            (
                "28.7.0",
                "28.7.0",
                "not-a-version<img src=x onerror=alert(1)>",
                ["not-a-version<img src=x onerror=alert(1)>"],
            ),
            (
                "28.7.0<img src=x onerror=alert(1)>",
                "28.4.0<script>alert(2)</script>",
                "28.4.0<script>alert(2)</script>",
                [
                    "28.4.0<script>alert(2)</script>",
                    "28.7.0<img src=x onerror=alert(1)>",
                ],
            ),
        ],
    )
    def test_preserves_persisted_version_error_values(
        self,
        source_version: str,
        catalog_version: str,
        persisted_version: str,
        message_values: list[str],
    ) -> None:
        configurator = _configurator(
            _mysql_server_info(source_version), [_version_summary(catalog_version)]
        )
        options = _db_system_options(persisted_version)

        issues = configurator.validate_target_mysql_options(options, None)

        version_issues = [
            issue for issue in issues if issue.info["input"] == "database.mysqlVersion"
        ]
        assert len(version_issues) == 1
        message = version_issues[0].message
        assert all(value in message for value in message_values)

    def test_free_tier_accepts_unexpected_calendar_catalog_months(self):
        configurator = _configurator(
            _mysql_server_info("27.1.0"),
            [_version_summary("26.7.0", "28.7.0", "29.2.0")],
        )
        options = _db_system_options(shape_name="MySQL.Free")

        assert not configurator.validate_target_mysql_options(options, None)
        assert options.mysqlVersion == "29.2.0"

    def test_free_tier_can_select_a_later_calendar_series(self):
        configurator = _configurator(
            _mysql_server_info("27.1.0"),
            [_version_summary("26.7.0", "28.7.0")],
        )
        options = _db_system_options(shape_name="MySQL.Free")

        assert not configurator.validate_target_mysql_options(options, None)
        assert options.mysqlVersion == "28.7.0"

    def test_reports_none_when_no_catalog_versions_are_valid(self):
        configurator = _configurator(
            _mysql_server_info("27.1.0"),
            [_version_summary(None, "malformed", "also-malformed")],
        )
        options = _db_system_options()

        issues = configurator.validate_target_mysql_options(options, None)

        version_issues = [
            issue for issue in issues if issue.info["input"] == "database.mysqlVersion"
        ]
        assert len(version_issues) == 1
        assert version_issues[0].message.endswith("Available OCI versions: none")

    def test_regular_auto_validation_warns_once_for_malformed_catalog_entry(
        self,
    ) -> None:
        configurator = _configurator(
            _mysql_server_info("28.1.0"),
            [_version_summary("malformed", "28.4.0")],
        )
        options = _db_system_options()

        with patch.object(target_config.logging, "warning") as warning:
            issues = configurator.validate_target_mysql_options(options, None)

        assert not issues
        assert options.mysqlVersion == "28.4.0"
        assert warning.call_count == 1
