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

import json
import shutil
from pathlib import Path

import pytest

import gui_plugin.legacy.projects as projects_module
from gui_plugin.legacy.paths import LegacySourceRoots
from gui_plugin.legacy.projects import (
    inspect_project_sources,
    import_migration_assistant_project_sources,
)
from gui_plugin.legacy.state import empty_state
from gui_plugin.migration.lib import core as migration_core
from gui_plugin.migration.lib.backend import model as migration_model
from gui_plugin.migration.lib.project import Project


PROJECT_FIXTURES = Path(__file__).parent / "fixtures" / "projects"


class FakeStore:
    def __init__(self):
        self.manifest = empty_state()

    def is_completed(self, phase_name):
        return phase_name in self.manifest["completedPhases"]

    def complete_phase(self, phase_name):
        if phase_name not in self.manifest["completedPhases"]:
            self.manifest["completedPhases"].append(phase_name)


def roots(tmp_path: Path) -> LegacySourceRoots:
    return LegacySourceRoots(
        workbench_connections=(),
        workbench_wrapper=tmp_path / "workbench",
        vscode_extension=tmp_path / "vscode",
        target_root=tmp_path / "electron",
    )


def create_project(
    project_root: Path,
    project_id: str,
    *,
    name: str = "Migration Assistant project",
    extra_data: dict | None = None,
) -> Path:
    project = project_root / project_id
    nested = project / "nested"
    nested.mkdir(parents=True)
    (nested / "state.txt").write_text("state", encoding="utf8")
    (project / "data.json").write_text(
        json.dumps(
            {
                "id": project_id,
                "name": name,
                **(extra_data or {}),
            }
        ),
        encoding="utf8",
    )

    return project


def configure_project_validator(
    monkeypatch: pytest.MonkeyPatch,
    source_roots: LegacySourceRoots,
) -> None:
    target_projects = (
        source_roots.target_root
        / "plugin_data"
        / "gui_plugin"
        / "migration"
    )
    monkeypatch.setattr(
        migration_core,
        "default_projects_directory",
        lambda create: str(target_projects),
    )
    monkeypatch.setattr(
        migration_core,
        "default_shared_ssh_key_directory",
        lambda create: str(target_projects / "ssh"),
    )
    monkeypatch.setattr(
        migration_core,
        "default_oci_config_file",
        lambda: str(source_roots.target_root / "missing-oci-config"),
    )
    monkeypatch.setattr(migration_core, "default_oci_profile", lambda: "DEFAULT")


@pytest.mark.parametrize(
    ("source_id", "root_property"),
    (
        ("workbench-wrapper", "workbench_projects"),
        ("vscode-extension", "vscode_projects"),
    ),
)
@pytest.mark.parametrize(
    ("fixture_name", "project_id"),
    (
        ("1.20.0-filters", "released-filters-project"),
        ("2026.5.0-schema-selection", "released-schema-project"),
    ),
)
def test_released_project_formats_import_through_production_validator(
    tmp_path,
    monkeypatch,
    source_id,
    root_property,
    fixture_name,
    project_id,
):
    source_roots = roots(tmp_path)
    project_root = getattr(source_roots, root_property)
    project_root.mkdir(parents=True)
    shutil.copytree(
        PROJECT_FIXTURES / fixture_name,
        project_root / project_id,
    )
    configure_project_validator(monkeypatch, source_roots)

    reports = import_migration_assistant_project_sources(
        source_roots=source_roots,
        store=FakeStore(),
        options={
            "sourceIds": [source_id],
            "deleteSources": False,
        },
    )

    assert reports[0]["failed"] == []
    assert reports[0]["imported"] == 1
    project = Project.open(project_id)
    try:
        assert project.options.schemaSelection is not None
    finally:
        project.close()


def test_project_missing_a_released_required_field_is_retained(
    tmp_path,
    monkeypatch,
):
    source_roots = roots(tmp_path)
    project_root = source_roots.vscode_projects
    project_root.mkdir(parents=True)
    project_id = "unsupported-project"
    source = project_root / project_id
    shutil.copytree(
        PROJECT_FIXTURES / "2026.5.0-schema-selection",
        source,
    )
    data_path = source / "data.json"
    data = json.loads(data_path.read_text(encoding="utf8"))
    data["id"] = project_id
    del data["sshPublicKeyFile"]
    data_path.write_text(json.dumps(data), encoding="utf8")
    configure_project_validator(monkeypatch, source_roots)

    reports = import_migration_assistant_project_sources(
        source_roots=source_roots,
        store=FakeStore(),
        options={
            "sourceIds": ["vscode-extension"],
            "deleteSources": True,
        },
    )

    assert reports[0]["imported"] == 0
    assert reports[0]["failed"][0]["item"] == project_id
    assert source.exists()
    assert not (
        source_roots.target_root
        / "plugin_data/gui_plugin/migration"
        / project_id
    ).exists()


@pytest.mark.parametrize(
    "missing_field",
    ("filters", "migrateData", "migrateUsers"),
)
def test_partial_released_legacy_selection_is_retained(
    tmp_path,
    monkeypatch,
    missing_field,
):
    source_roots = roots(tmp_path)
    project_root = source_roots.vscode_projects
    project_root.mkdir(parents=True)
    project_id = f"partial-{missing_field}"
    source = project_root / project_id
    shutil.copytree(PROJECT_FIXTURES / "1.20.0-filters", source)
    data_path = source / "data.json"
    data = json.loads(data_path.read_text(encoding="utf8"))
    data["id"] = project_id
    del data["options"][missing_field]
    data_path.write_text(json.dumps(data), encoding="utf8")
    configure_project_validator(monkeypatch, source_roots)

    reports = import_migration_assistant_project_sources(
        source_roots=source_roots,
        store=FakeStore(),
        options={
            "sourceIds": ["vscode-extension"],
            "deleteSources": True,
        },
    )

    assert reports[0]["imported"] == 0
    assert reports[0]["failed"][0]["item"] == project_id
    assert source.exists()


def test_copy_preserves_nested_files_and_retains_source_by_choice(tmp_path):
    source_roots = roots(tmp_path)
    source = create_project(source_roots.workbench_projects, "nested-project")
    store = FakeStore()

    reports = import_migration_assistant_project_sources(
        source_roots=source_roots,
        store=store,
        options={
            "sourceIds": ["workbench-wrapper"],
            "deleteSources": False,
        },
        project_validator=lambda _project_id: None,
    )

    target = (
        source_roots.target_root
        / "plugin_data/gui_plugin/migration/nested-project"
    )
    assert reports[0]["failed"] == []
    assert reports[0]["cleanup"] == {
        "deleted": 0,
        "retained": 1,
        "failed": [],
    }
    assert (target / "nested/state.txt").read_text(encoding="utf8") == "state"
    assert source.exists()
    assert store.is_completed(
        "migrationAssistantProjects:workbench-wrapper:v1"
    )
    assert not (
        source_roots.target_root / "legacy_configuration_import_staging"
    ).exists()


def test_rewrites_project_and_shared_key_paths_then_deletes_sources(tmp_path):
    source_roots = roots(tmp_path)
    project = create_project(source_roots.workbench_projects, "keys-project")
    local_key = project / "local-key"
    local_key.write_text("local", encoding="utf8")
    shared_root = source_roots.workbench_projects / "ssh"
    shared_root.mkdir()
    shared_key = shared_root / "shared-key"
    shared_key.write_text("shared", encoding="utf8")
    data_path = project / "data.json"
    data = json.loads(data_path.read_text(encoding="utf8"))
    data.update(
        {
            "sshPrivateKeyFile": str(local_key),
            "sshSharedKeyFile": str(shared_key),
            "sshPublicKeyFile": "",
            "ociConfigFile": "/external/oci/config",
        }
    )
    data_path.write_text(json.dumps(data), encoding="utf8")

    reports = import_migration_assistant_project_sources(
        source_roots=source_roots,
        store=FakeStore(),
        options={
            "sourceIds": ["workbench-wrapper"],
            "deleteSources": True,
        },
        project_validator=lambda _project_id: None,
    )

    target_root = source_roots.target_root / "plugin_data/gui_plugin/migration"
    imported_data = json.loads(
        (target_root / "keys-project/data.json").read_text(encoding="utf8")
    )
    assert reports[0]["failed"] == []
    assert imported_data["sshPrivateKeyFile"] == str(
        target_root / "keys-project/local-key"
    )
    assert imported_data["sshSharedKeyFile"] == str(
        target_root / "ssh/shared-key"
    )
    assert imported_data["ociConfigFile"] == "/external/oci/config"
    assert not project.exists()
    assert not shared_key.exists()


def test_upgrades_released_legacy_selection_fields(tmp_path):
    source_roots = roots(tmp_path)
    create_project(
        source_roots.vscode_projects,
        "legacy-options-project",
        extra_data={
            "options": {
                "_class": "MigrationOptions",
                "migrateData": False,
                "migrateUsers": False,
                "filters": {
                    "_class": "MigrationFilters",
                    "schemas": {
                        "_class": "IncludeList",
                        "include": [],
                        "exclude": ["`excluded_schema`"],
                    },
                },
            },
        },
    )

    reports = import_migration_assistant_project_sources(
        source_roots=source_roots,
        store=FakeStore(),
        options={
            "sourceIds": ["vscode-extension"],
            "deleteSources": False,
        },
        project_validator=lambda _project_id: None,
    )
    target_data = json.loads(
        (
            source_roots.target_root
            / "plugin_data/gui_plugin/migration"
            / "legacy-options-project/data.json"
        ).read_text(encoding="utf8")
    )
    converted_options = target_data["options"]
    parsed_options = migration_model.parse(converted_options)

    assert reports[0]["failed"] == []
    assert "filters" not in converted_options
    assert "migrateData" not in converted_options
    assert "migrateUsers" not in converted_options
    assert parsed_options.schemaSelection.migrateData is False
    assert parsed_options.schemaSelection.migrateUsers is False
    assert parsed_options.schemaSelection.filter.schemas.exclude == [
        "`excluded_schema`"
    ]


def test_missing_project_ssh_keys_are_cleared_with_one_warning(tmp_path):
    source_roots = roots(tmp_path)
    project = create_project(
        source_roots.vscode_projects,
        "missing-key-project",
    )
    data_path = project / "data.json"
    data = json.loads(data_path.read_text(encoding="utf8"))
    data.update(
        {
            "sshPrivateKeyFile": str(project / "missing-private-key"),
            "sshSharedKeyFile": "",
            "sshPublicKeyFile": str(project / "missing-public-key"),
        }
    )
    data_path.write_text(json.dumps(data), encoding="utf8")

    reports = import_migration_assistant_project_sources(
        source_roots=source_roots,
        store=FakeStore(),
        options={
            "sourceIds": ["vscode-extension"],
            "deleteSources": False,
        },
        project_validator=lambda _project_id: None,
    )
    target_data = json.loads(
        (
            source_roots.target_root
            / "plugin_data/gui_plugin/migration"
            / "missing-key-project/data.json"
        ).read_text(encoding="utf8")
    )

    assert reports[0]["failed"] == []
    assert reports[0]["warnings"][0]["item"] == "SSH keys"
    assert len(reports[0]["warnings"]) == 1
    assert target_data["sshPrivateKeyFile"] == ""
    assert target_data["sshPublicKeyFile"] == ""


def test_retry_accepts_a_project_copied_before_another_project_failed(tmp_path):
    source_roots = roots(tmp_path)
    first = create_project(source_roots.vscode_projects, "first-project")
    second = create_project(source_roots.vscode_projects, "second-project")
    store = FakeStore()

    def fail_second(project_id):
        if project_id == second.name:
            raise ValueError("injected validation failure")

    first_reports = import_migration_assistant_project_sources(
        source_roots=source_roots,
        store=store,
        options={
            "sourceIds": ["vscode-extension"],
            "deleteSources": True,
        },
        project_validator=fail_second,
    )
    retry_reports = import_migration_assistant_project_sources(
        source_roots=source_roots,
        store=store,
        options={
            "sourceIds": ["vscode-extension"],
            "deleteSources": True,
        },
        project_validator=lambda _project_id: None,
    )

    assert first_reports[0]["imported"] == 1
    assert len(first_reports[0]["failed"]) == 1
    assert retry_reports[0]["merged"] == 1
    assert retry_reports[0]["imported"] == 1
    assert not first.exists()
    assert not second.exists()


def test_source_deletion_waits_until_every_project_was_copied(tmp_path):
    source_roots = roots(tmp_path)
    valid = create_project(source_roots.workbench_projects, "valid-project")
    invalid = create_project(source_roots.workbench_projects, "invalid-project")
    (invalid / "data.json").write_text("not-json", encoding="utf8")

    reports = import_migration_assistant_project_sources(
        source_roots=source_roots,
        store=FakeStore(),
        options={
            "sourceIds": ["workbench-wrapper"],
            "deleteSources": True,
        },
        project_validator=lambda _project_id: None,
    )

    assert reports[0]["imported"] == 1
    assert len(reports[0]["failed"]) == 1
    assert valid.exists()
    assert invalid.exists()


def test_source_is_retained_when_the_project_copy_does_not_match(
    tmp_path,
    monkeypatch,
):
    source_roots = roots(tmp_path)
    source = create_project(
        source_roots.workbench_projects,
        "corrupted-copy-project",
    )
    original_rewrite = projects_module._rewrite_project

    def rewrite_with_corruption(*args, **kwargs):
        result = original_rewrite(*args, **kwargs)
        (kwargs["staged_project"] / "nested/state.txt").write_text(
            "corrupted",
            encoding="utf8",
        )

        return result

    monkeypatch.setattr(
        projects_module,
        "_rewrite_project",
        rewrite_with_corruption,
    )
    reports = import_migration_assistant_project_sources(
        source_roots=source_roots,
        store=FakeStore(),
        options={
            "sourceIds": ["workbench-wrapper"],
            "deleteSources": True,
        },
        project_validator=lambda _project_id: None,
    )

    assert reports[0]["imported"] == 0
    assert reports[0]["failed"][0]["item"] == source.name
    assert source.exists()


def test_shared_key_choices_are_independent_and_safe(tmp_path):
    source_roots = roots(tmp_path)
    project = create_project(source_roots.vscode_projects, "shared-key-project")
    shared_root = source_roots.vscode_projects / "ssh"
    shared_root.mkdir()
    shared_key = shared_root / "shared-key"
    shared_key.write_text("private", encoding="utf8")
    data_path = project / "data.json"
    data = json.loads(data_path.read_text(encoding="utf8"))
    data["sshSharedKeyFile"] = str(shared_key)
    data_path.write_text(json.dumps(data), encoding="utf8")

    reports = import_migration_assistant_project_sources(
        source_roots=source_roots,
        store=FakeStore(),
        options={
            "sourceIds": ["vscode-extension"],
            "deleteSources": True,
            "copySshKeys": True,
            "deleteSshKeys": False,
        },
        project_validator=lambda _project_id: None,
    )

    assert reports[0]["failed"] == []
    assert shared_key.exists()
    assert (
        source_roots.target_root
        / "plugin_data/gui_plugin/migration/ssh/shared-key"
    ).exists()

    with pytest.raises(ValueError):
        import_migration_assistant_project_sources(
            source_roots=source_roots,
            store=FakeStore(),
            options={
                "sourceIds": ["vscode-extension"],
                "deleteSources": False,
                "copySshKeys": False,
                "deleteSshKeys": True,
            },
            project_validator=lambda _project_id: None,
        )


def test_shared_keys_are_retained_when_project_deletion_fails(
    tmp_path,
    monkeypatch,
):
    source_roots = roots(tmp_path)
    project = create_project(source_roots.workbench_projects, "project")
    shared_root = source_roots.workbench_projects / "ssh"
    shared_root.mkdir()
    shared_key = shared_root / "shared-key"
    shared_key.write_text("private", encoding="utf8")
    data = json.loads((project / "data.json").read_text(encoding="utf8"))
    data["sshSharedKeyFile"] = str(shared_key)
    (project / "data.json").write_text(json.dumps(data), encoding="utf8")

    def fail_project_deletion(name):
        if name.startswith("project-delete-"):
            raise OSError("injected deletion failure")

    monkeypatch.setattr(
        projects_module,
        "raise_injected_e2e_failure",
        fail_project_deletion,
    )
    reports = import_migration_assistant_project_sources(
        source_roots=source_roots,
        store=FakeStore(),
        options={
            "sourceIds": ["workbench-wrapper"],
            "deleteSources": True,
            "copySshKeys": True,
            "deleteSshKeys": True,
        },
        project_validator=lambda _project_id: None,
    )

    assert reports[0]["cleanup"]["failed"]
    assert project.exists()
    assert shared_key.exists()


def test_discovery_counts_shared_keys_and_hides_completed_sources(tmp_path):
    source_roots = roots(tmp_path)
    project = create_project(source_roots.workbench_projects, "project")
    shared_root = source_roots.workbench_projects / "ssh"
    shared_root.mkdir()
    shared_key = shared_root / "shared-key"
    shared_key.write_text("private", encoding="utf8")
    data = json.loads((project / "data.json").read_text(encoding="utf8"))
    data["sshSharedKeyFile"] = str(shared_key)
    (project / "data.json").write_text(json.dumps(data), encoding="utf8")
    state = empty_state()

    discovery = inspect_project_sources(source_roots, state)
    assert discovery["projects"]["sshKeyCount"] == 1

    state["completedPhases"].append(
        "migrationAssistantProjects:workbench-wrapper:v1"
    )
    assert inspect_project_sources(source_roots, state) == {}
