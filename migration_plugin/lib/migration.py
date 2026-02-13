# Copyright (c) 2025, 2026 Oracle and/or its affiliates.
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
import os
import pathlib
import random
import mysqlsh
from typing import Optional
import migration_plugin.lib as lib
from . import logging
from .backend import model
from migration_plugin.lib.project import Project
from migration_plugin.plan_step import MigrationPlanStep
from migration_plugin.work_step import MigrationWorkStep


class ProjectContext:
    project: Optional[Project] = None
    plan_step: MigrationPlanStep
    work_step: MigrationWorkStep

    def close(self):
        if self.project:
            self.project.close()

    def data(self) -> model.ProjectData:
        project_data = model.ProjectData()
        if not self.project:
            return project_data
        project_data.id = self.project.id
        project_data.name = self.project.name
        project_data.path = str(self.project.path)
        project_data.source = f"{self.project.source_connection_options['host']}:{self.project.source_connection_options['port']}"
        project_data.modifyTime = self.project.modifyTime
        project_data.dataMigrationDidFinish = self.project._data_migration_did_finish
        return project_data


g_open_projects: dict[str, ProjectContext] = {}


def get_project(id: str = "") -> ProjectContext:
    # shortcut since we only support one open project at a time atm
    if not id and len(g_open_projects) == 1:
        return list(g_open_projects.values())[0]

    if not g_open_projects:
        raise ValueError("You must open a migration project first")
    if id not in g_open_projects:
        raise ValueError("Given project is not open")

    return g_open_projects[id]


def close_all_projects():
    for proj_id in list(g_open_projects.keys()):
        close_project(proj_id)


def new_project(name: str, source_url: str) -> ProjectContext:
    """Creates a migration plan for a new migration project.

    Projects are created in the mysqlsh
    <plugin_data_dir>/migration-assistant directory

    Currently, only a single migration project may be open at a time, so any
    other open projects will be closed.

    Args:
        name (str): The name of the migration project.
        source_url (str): Source DB URL

    Returns:
        A project context object.
    """

    # if there's already a migration project open, close it first
    close_all_projects()

    if name == "":
        raise ValueError("The given project name must not be empty.")

    if source_url == "":
        raise ValueError("The given source url must not be empty.")

    if source_url:
        source = mysqlsh.globals.shell.parse_uri(source_url)
    else:
        source = None

    context = ProjectContext()
    context.project = Project.create(name=name)
    if source:
        logging.info(f"Project created with source={source}")
        context.project.set_source(source)
    context.plan_step = MigrationPlanStep(context.project)
    context.work_step = MigrationWorkStep(context.project)

    g_open_projects[context.project.id] = context

    return context


def open_project(id: str) -> ProjectContext:
    """Opens a previously created migration project.

    The project id can be obtained from list_projects().

    Currently, only a single migration project may be open at a time, so any
    other open projects will be closed.

    Args:
        id (str): The id of the migration project to be opened. If id is ""
        or an already open project, the current project is returned.

    Returns:
        A project context object.
    """

    context = None
    if g_open_projects and id in g_open_projects:
        context = g_open_projects[id]

    if not context and g_open_projects and (not id or id in g_open_projects):
        context = get_project(id)

    if context and context.project and context.project.is_valid():
        return context

    if not id:
        return ProjectContext()

    # if there's already a different migration project open, close it first
    close_all_projects()

    context = ProjectContext()
    context.project = Project.open(id=id)
    context.plan_step = MigrationPlanStep(context.project)
    context.work_step = MigrationWorkStep(context.project)

    g_open_projects[context.project.id] = context

    return context


def close_project(id: str):
    if id in g_open_projects:
        g_open_projects[id].close()
        del g_open_projects[id]


def delete_project(id: str):
    pass


def list_projects() -> list[model.ProjectData]:
    proj_dir = lib.core.default_projects_directory(create=False)
    if not os.path.exists(proj_dir):
        return []

    projects = []
    try:
        for proj in os.listdir(proj_dir):
            path = os.path.join(proj_dir, proj, "data.json")
            if os.path.exists(path):
                try:
                    with open(path) as f:
                        data = json.load(f)
                    p = model.ProjectData()
                    p.id = data["id"]
                    p.name = data["name"]
                    p.path = os.path.join(proj_dir, proj)
                    p.modifyTime = data["modifyTime"]
                    projects.append(p)
                except Exception as e:
                    logging.warning(
                        f"Error parsing presumed migration project data from {path}: {e}")
        projects.sort(key=lambda p: p["path"], reverse=True)
    except Exception as e:
        logging.warning(
            f"Error looking for migration projects in {proj_dir}: {e}")

    return projects
