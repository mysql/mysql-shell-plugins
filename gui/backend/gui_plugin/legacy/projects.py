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

"""Import legacy Migration Assistant projects."""

import json
import os
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from gui_plugin.core.Files import ensure_private_directory
from gui_plugin.legacy.paths import (
    LegacySourceRoots,
    raise_injected_e2e_failure,
    validate_source_path,
)

MAX_DATA_JSON_BYTES = 4 * 1024 * 1024
MAX_PROJECT_ISSUES = 100
PATH_FIELDS = (
    "sshPrivateKeyFile",
    "sshSharedKeyFile",
    "sshPublicKeyFile",
    "ociConfigFile",
)
SSH_PATH_FIELDS = (
    "sshPrivateKeyFile",
    "sshSharedKeyFile",
    "sshPublicKeyFile",
)
LEGACY_OPTION_FIELDS = ("filters", "migrateData", "migrateUsers")


@dataclass(frozen=True)
class ProjectSource:
    source_id: str
    label: str
    root: Path
    approved_root: Path


@dataclass(frozen=True)
class ProjectCandidate:
    source: ProjectSource
    project_id: str
    name: str
    path: Path
    data: dict


def project_sources(source_roots: LegacySourceRoots) -> tuple[ProjectSource, ...]:
    """Return the two released legacy project locations."""
    return (
        ProjectSource(
            "workbench-wrapper",
            "MySQL Workbench",
            source_roots.workbench_projects,
            source_roots.workbench_wrapper,
        ),
        ProjectSource(
            "vscode-extension",
            "VS Code",
            source_roots.vscode_projects,
            source_roots.vscode_extension,
        ),
    )


def _copy_phase(source_id: str) -> str:
    return f"migrationAssistantProjects:{source_id}:v1"


def _target_projects(source_roots: LegacySourceRoots) -> Path:
    return (
        source_roots.target_root
        / "plugin_data"
        / "gui_plugin"
        / "migration"
    )


def _is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
    except ValueError:
        return False

    return True


def _candidate(
    source: ProjectSource,
    project_path: Path,
    target_root: Path,
) -> ProjectCandidate:
    validated_path = validate_source_path(
        project_path,
        approved_root=source.root,
        target_root=target_root,
        expect_directory=True,
    )
    for entry in validated_path.rglob("*"):
        if entry.is_symlink():
            raise ValueError("Project contains a symbolic link")

    data_path = validate_source_path(
        validated_path / "data.json",
        approved_root=validated_path,
        target_root=target_root,
        expect_directory=False,
    )
    if data_path.stat().st_size > MAX_DATA_JSON_BYTES:
        raise ValueError("Project data.json is too large")
    try:
        data = json.loads(data_path.read_text(encoding="utf8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ValueError("Project data.json is malformed") from error
    if not isinstance(data, dict):
        raise ValueError("Project data.json must contain an object")

    project_id = data.get("id")
    name = data.get("name")
    if not isinstance(project_id, str) or not project_id:
        raise ValueError("Project data.json has an invalid id")
    if project_id != validated_path.name:
        raise ValueError("Project directory name does not match its id")
    if not isinstance(name, str) or not name:
        raise ValueError("Project data.json has an invalid name")

    return ProjectCandidate(
        source=source,
        project_id=project_id,
        name=name,
        path=validated_path,
        data=data,
    )


def _inspect_source(
    source: ProjectSource,
    target_root: Path,
) -> tuple[list[ProjectCandidate], list[dict]]:
    if not source.root.exists():
        return [], []
    try:
        validated_root = validate_source_path(
            source.root,
            approved_root=source.approved_root,
            target_root=target_root,
            expect_directory=True,
        )
    except (OSError, ValueError) as error:
        return [], [{"item": source.source_id, "message": str(error)}]

    candidates = []
    issues = []
    for entry in sorted(validated_root.iterdir(), key=lambda item: item.name):
        if entry.name == "ssh" or not (entry / "data.json").exists():
            continue
        try:
            candidates.append(_candidate(source, entry, target_root))
        except (OSError, UnicodeError, ValueError) as error:
            issues.append({"item": entry.name, "message": str(error)})

    return candidates, issues[:MAX_PROJECT_ISSUES]


def _source_shared_files(
    candidate: ProjectCandidate,
    target_root: Path,
) -> list[Path]:
    shared_root = candidate.source.root / "ssh"
    resolved_shared_root = shared_root.resolve(strict=False)
    values = [candidate.data.get(field) for field in PATH_FIELDS]
    shared_key = candidate.data.get("sshSharedKeyFile")
    if isinstance(shared_key, str) and shared_key:
        values.append(f"{shared_key}.pub")

    result = set()
    for value in values:
        if not isinstance(value, str) or not value:
            continue
        path = Path(value).expanduser()
        if not path.is_absolute():
            continue
        resolved = path.resolve(strict=False)
        if not resolved.is_file() or not _is_relative_to(
            resolved,
            resolved_shared_root,
        ):
            continue
        result.add(
            validate_source_path(
                resolved,
                approved_root=shared_root,
                target_root=target_root,
                expect_directory=False,
            )
        )

    return sorted(result, key=str)


def inspect_project_sources(
    source_roots: LegacySourceRoots,
    state: dict,
) -> dict:
    """Inspect project candidates which have not already been imported."""
    sources = []
    issues = []
    shared_ssh_files = set()
    for source in project_sources(source_roots):
        if _copy_phase(source.source_id) in state["completedPhases"]:
            continue
        candidates, source_issues = _inspect_source(
            source,
            source_roots.target_root,
        )
        if not candidates and not source_issues:
            continue
        for candidate in candidates:
            try:
                shared_ssh_files.update(
                    _source_shared_files(candidate, source_roots.target_root)
                )
            except (OSError, ValueError) as error:
                source_issues.append(
                    {"item": candidate.project_id, "message": str(error)}
                )
        sources.append(
            {
                "id": source.source_id,
                "label": source.label,
                "projectCount": len(candidates),
                "copyPending": True,
                "issueCount": len(source_issues),
            }
        )
        issues.extend(
            {
                "item": f"{source.source_id}: {issue['item']}",
                "message": issue["message"],
            }
            for issue in source_issues
        )

    if not sources and not issues:
        return {}

    return {
        "projects": {
            "sources": sources,
            "sshKeyCount": len(shared_ssh_files),
            "issues": issues[:MAX_PROJECT_ISSUES],
        }
    }


def _upgrade_legacy_project_options(data: dict) -> None:
    options = data.get("options")
    if not isinstance(options, dict) or "schemaSelection" in options:
        return
    present_legacy_fields = {
        field for field in LEGACY_OPTION_FIELDS if field in options
    }
    if not present_legacy_fields:
        return
    if len(present_legacy_fields) != len(LEGACY_OPTION_FIELDS):
        raise ValueError("Legacy project selection fields are incomplete")

    converted_options = dict(options)
    legacy_filters = converted_options.pop("filters", None)
    migrate_data = converted_options.pop("migrateData", True)
    migrate_users = converted_options.pop("migrateUsers", True)
    if legacy_filters is not None and not isinstance(legacy_filters, dict):
        raise ValueError("Legacy project filters must contain an object")
    if not isinstance(migrate_data, bool) or not isinstance(
        migrate_users,
        bool,
    ):
        raise ValueError(
            "Legacy Migration Assistant project flags must be boolean"
        )

    converted_filters = {
        "_class": "MigrationFilters",
        **{
            field_name: value
            for field_name, value in (legacy_filters or {}).items()
            if not field_name.startswith("_") and value is not None
        },
    }
    converted_options["schemaSelection"] = {
        "_class": "SchemaSelectionOptions",
        "filter": converted_filters,
        "migrateData": migrate_data,
        "migrateUsers": migrate_users,
    }
    data["options"] = converted_options


def _copy_shared_file(
    source: Path,
    *,
    source_root: Path,
    target_root: Path,
) -> Path:
    source_file = validate_source_path(
        source,
        approved_root=source_root,
        target_root=target_root,
        expect_directory=False,
    )
    relative = source_file.relative_to(source_root.resolve(strict=True))
    target_file = target_root / relative
    ensure_private_directory(target_file.parent)
    if target_file.exists():
        if target_file.read_bytes() != source_file.read_bytes():
            raise ValueError(
                f"Shared key conflicts with existing target: {relative}"
            )
    else:
        shutil.copy2(source_file, target_file)
        os.chmod(target_file, 0o600)
        if target_file.read_bytes() != source_file.read_bytes():
            target_file.unlink(missing_ok=True)
            raise ValueError(f"Could not verify copied shared key: {relative}")

    return target_file


def _rewrite_project(
    candidate: ProjectCandidate,
    *,
    staged_project: Path,
    final_project: Path,
    target_shared_root: Path,
    copy_shared_files: bool,
) -> tuple[list[dict], list[Path]]:
    data = dict(candidate.data)
    _upgrade_legacy_project_options(data)
    warnings = []
    missing_ssh_paths = False
    copied_shared_files = []
    source_project = candidate.path.resolve(strict=True)
    source_shared = (candidate.source.root / "ssh").resolve(strict=False)

    for field_name in PATH_FIELDS:
        value = data.get(field_name)
        if not isinstance(value, str) or not value:
            continue
        value_path = Path(value).expanduser()
        if not value_path.is_absolute():
            continue
        resolved_value = value_path.resolve(strict=False)
        if field_name in SSH_PATH_FIELDS and not resolved_value.exists():
            data[field_name] = ""
            missing_ssh_paths = True
        elif _is_relative_to(resolved_value, source_project):
            relative = resolved_value.relative_to(source_project)
            if not (staged_project / relative).is_file():
                raise ValueError(
                    f"{field_name} does not identify a copied project file"
                )
            data[field_name] = str(final_project / relative)
        elif _is_relative_to(resolved_value, source_shared):
            if copy_shared_files:
                target_file = _copy_shared_file(
                    resolved_value,
                    source_root=candidate.source.root / "ssh",
                    target_root=target_shared_root,
                )
                data[field_name] = str(target_file)
                copied_shared_files.append(resolved_value)
        elif not resolved_value.exists():
            warnings.append(
                {
                    "item": field_name,
                    "message": f"External path does not exist: {value}",
                }
            )

    shared_key = candidate.data.get("sshSharedKeyFile")
    if copy_shared_files and isinstance(shared_key, str) and shared_key:
        public_key = Path(f"{shared_key}.pub")
        if public_key.is_file() and _is_relative_to(
            public_key.resolve(),
            source_shared,
        ):
            _copy_shared_file(
                public_key,
                source_root=candidate.source.root / "ssh",
                target_root=target_shared_root,
            )
            copied_shared_files.append(public_key.resolve())

    if missing_ssh_paths:
        warnings.append(
            {
                "item": "SSH keys",
                "message": (
                    "One or more SSH key files could not be found in the "
                    "old project and were not imported"
                ),
            }
        )

    (staged_project / "data.json").write_text(
        f"{json.dumps(data, sort_keys=True)}\n",
        encoding="utf8",
    )

    return warnings, copied_shared_files


def _same_tree(left: Path, right: Path) -> bool:
    left_files = {
        path.relative_to(left): path
        for path in left.rglob("*")
        if path.is_file()
    }
    right_files = {
        path.relative_to(right): path
        for path in right.rglob("*")
        if path.is_file()
    }
    if left_files.keys() != right_files.keys():
        return False

    return all(
        path.read_bytes() == right_files[relative].read_bytes()
        for relative, path in left_files.items()
    )


def _verify_project_copy(
    candidate: ProjectCandidate,
    staged_project: Path,
) -> None:
    source_files = {
        path.relative_to(candidate.path): path
        for path in candidate.path.rglob("*")
        if path.is_file()
        and path.relative_to(candidate.path) != Path("data.json")
    }
    staged_files = {
        path.relative_to(staged_project): path
        for path in staged_project.rglob("*")
        if path.is_file()
        and path.relative_to(staged_project) != Path("data.json")
    }
    if source_files.keys() != staged_files.keys() or any(
        path.read_bytes() != staged_files[relative].read_bytes()
        for relative, path in source_files.items()
    ):
        raise ValueError("The copied project does not match the source")

    data = json.loads(
        (staged_project / "data.json").read_text(encoding="utf8")
    )
    if (
        data.get("id") != candidate.project_id
        or data.get("name") != candidate.name
    ):
        raise ValueError("The copied project identity changed")


def _default_project_validator(project_id: str) -> None:
    from gui_plugin.migration.lib.project import Project

    Project.open(project_id).close()


def _import_candidate(
    candidate: ProjectCandidate,
    *,
    source_roots: LegacySourceRoots,
    project_validator: Callable[[str], None],
    copy_ssh_keys: bool,
) -> tuple[str, list[dict], list[Path]]:
    target_projects = _target_projects(source_roots)
    target_shared_root = target_projects / "ssh"
    ensure_private_directory(target_projects)
    staging_root = Path(
        tempfile.mkdtemp(
            prefix=".configuration-import-project-",
            dir=target_projects.parent,
        )
    )
    staged_project = staging_root / candidate.project_id
    final_project = target_projects / candidate.project_id
    try:
        shutil.copytree(candidate.path, staged_project)
        warnings, shared_files = _rewrite_project(
            candidate,
            staged_project=staged_project,
            final_project=final_project,
            target_shared_root=target_shared_root,
            copy_shared_files=copy_ssh_keys,
        )
        _verify_project_copy(candidate, staged_project)
        if final_project.exists():
            if not _same_tree(staged_project, final_project):
                raise ValueError("A different project with this id exists")
            project_validator(candidate.project_id)

            return "merged", warnings, shared_files

        raise_injected_e2e_failure(
            f"project-promote-{candidate.source.source_id}"
        )
        os.replace(staged_project, final_project)
        try:
            project_validator(candidate.project_id)
        except Exception:
            shutil.rmtree(final_project, ignore_errors=True)
            raise

        return "imported", warnings, shared_files
    finally:
        shutil.rmtree(staging_root, ignore_errors=True)


def _empty_report(source_id: str) -> dict:
    return {
        "phase": "migrationAssistantProjects",
        "sourceId": source_id,
        "imported": 0,
        "merged": 0,
        "skipped": 0,
        "warnings": [],
        "failed": [],
        "cleanup": {
            "deleted": 0,
            "retained": 0,
            "failed": [],
        },
    }


def _delete_imported_sources(
    candidates: list[ProjectCandidate],
    shared_files: list[Path],
    *,
    delete_sources: bool,
    delete_ssh_keys: bool,
) -> dict:
    cleanup = {
        "deleted": 0,
        "retained": 0,
        "failed": [],
    }
    project_paths: list[Path] = []
    if delete_sources:
        project_paths.extend(candidate.path for candidate in candidates)
    else:
        cleanup["retained"] += len(candidates)
    ssh_paths: list[Path] = []
    if delete_ssh_keys:
        ssh_paths.extend(sorted(set(shared_files), key=str))
    else:
        cleanup["retained"] += len(set(shared_files))

    for path in project_paths:
        try:
            raise_injected_e2e_failure(
                f"project-delete-{candidates[0].source.source_id}"
            )
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink(missing_ok=True)
            cleanup["deleted"] += 1
        except OSError as error:
            cleanup["failed"].append(
                {"item": path.name, "message": str(error)}
            )
            cleanup["retained"] += 1

    if delete_sources and cleanup["failed"]:
        cleanup["retained"] += len(ssh_paths)
        ssh_paths = []

    for path in ssh_paths:
        try:
            raise_injected_e2e_failure(
                f"project-delete-{candidates[0].source.source_id}"
            )
            path.unlink(missing_ok=True)
            cleanup["deleted"] += 1
        except OSError as error:
            cleanup["failed"].append(
                {"item": path.name, "message": str(error)}
            )
            cleanup["retained"] += 1

    return cleanup


def import_migration_assistant_project_sources(
    *,
    source_roots: LegacySourceRoots,
    store,
    options: dict,
    project_validator: Callable[[str], None] = _default_project_validator,
) -> list[dict]:
    """Copy, validate, and optionally remove selected legacy projects."""
    source_ids = options.get("sourceIds") if isinstance(options, dict) else None
    delete_sources = (
        options.get("deleteSources") if isinstance(options, dict) else None
    )
    copy_ssh_keys = (
        options.get("copySshKeys", True)
        if isinstance(options, dict)
        else None
    )
    delete_ssh_keys = (
        options.get("deleteSshKeys", delete_sources)
        if isinstance(options, dict)
        else None
    )
    if (
        not isinstance(source_ids, list)
        or not all(isinstance(item, str) for item in source_ids)
        or len(source_ids) != len(set(source_ids))
        or not isinstance(delete_sources, bool)
        or not isinstance(copy_ssh_keys, bool)
        or not isinstance(delete_ssh_keys, bool)
        or (delete_ssh_keys and not copy_ssh_keys)
    ):
        raise ValueError("Invalid Migration Assistant project import options")
    known_sources = {
        source.source_id: source for source in project_sources(source_roots)
    }
    if not set(source_ids).issubset(known_sources):
        raise ValueError("Unknown Migration Assistant project import source")

    reports = []
    for source_id in source_ids:
        if store.is_completed(_copy_phase(source_id)):
            continue
        source = known_sources[source_id]
        report = _empty_report(source_id)
        candidates, issues = _inspect_source(
            source,
            source_roots.target_root,
        )
        report["failed"].extend(issues)
        shared_files = []
        for candidate in candidates:
            try:
                outcome, warnings, copied_shared_files = _import_candidate(
                    candidate,
                    source_roots=source_roots,
                    project_validator=project_validator,
                    copy_ssh_keys=copy_ssh_keys,
                )
                report[outcome] += 1
                report["warnings"].extend(warnings)
                shared_files.extend(copied_shared_files)
            except Exception as error:
                report["failed"].append(
                    {"item": candidate.project_id, "message": str(error)}
                )

        if not report["failed"]:
            report["cleanup"] = _delete_imported_sources(
                candidates,
                shared_files,
                delete_sources=delete_sources,
                delete_ssh_keys=delete_ssh_keys,
            )
            store.complete_phase(_copy_phase(source_id))
        reports.append(report)

    return reports
