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

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

import pytest

INIT_PATH = Path(__file__).parents[2] / "gui_plugin" / "init.py"
GUI_SUBMODULES = {
    "cluster",
    "core",
    "db_connections",
    "mds",
    "modeler",
    "shell",
    "sql_editor",
    "users",
    "start",
    "modules",
    "db",
    "general",
    "debugger",
    "migration",
}


class RecordingGuiPluginPackage(ModuleType):
    def __init__(self) -> None:
        super().__init__("gui_plugin")
        self.loaded_submodules: list[str] = []
        self.registered_submodules: list[str] = []

    def __getattr__(self, name: str) -> ModuleType:
        if name not in GUI_SUBMODULES:
            raise AttributeError(name)

        self.loaded_submodules.append(name)
        module = ModuleType(f"gui_plugin.{name}")
        if name == "migration":
            module.register = lambda: self.registered_submodules.append(name)
        setattr(self, name, module)
        return module


def _load_init(
    monkeypatch: pytest.MonkeyPatch,
    debug_mode: str,
) -> tuple[ModuleType, RecordingGuiPluginPackage]:
    monkeypatch.setenv("MYSQL_SHELL_GUI_DEBUG_MODE", debug_mode)

    gui_plugin = RecordingGuiPluginPackage()
    monkeypatch.setitem(sys.modules, "gui_plugin", gui_plugin)

    plugin_manager = ModuleType("mysqlsh.plugin_manager")

    def plugin(plugin_class: type) -> type:
        plugin_class()
        return plugin_class

    plugin_manager.plugin = plugin

    mysqlsh = ModuleType("mysqlsh")
    mysqlsh.__path__ = []
    mysqlsh.plugin_manager = plugin_manager

    monkeypatch.setitem(sys.modules, "mysqlsh", mysqlsh)
    monkeypatch.setitem(sys.modules, "mysqlsh.plugin_manager", plugin_manager)

    module_name = f"gui_plugin_init_test_{debug_mode}"
    spec = importlib.util.spec_from_file_location(module_name, INIT_PATH)
    assert spec is not None
    assert spec.loader is not None

    module = importlib.util.module_from_spec(spec)
    monkeypatch.setitem(sys.modules, module_name, module)
    spec.loader.exec_module(module)

    return module, gui_plugin


def test_debugger_is_loaded_in_debug_mode(monkeypatch: pytest.MonkeyPatch) -> None:
    module, gui_plugin = _load_init(monkeypatch, "1")

    assert module.DEBUG_MODE == 1
    assert hasattr(module.gui, "debugger")
    assert "debugger" in gui_plugin.loaded_submodules


def test_debugger_is_not_loaded_without_debug_mode(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module, gui_plugin = _load_init(monkeypatch, "0")

    assert module.DEBUG_MODE == 0
    assert not hasattr(module.gui, "debugger")
    assert "debugger" not in gui_plugin.loaded_submodules


def test_migration_is_loaded_as_gui_module(monkeypatch: pytest.MonkeyPatch) -> None:
    module, gui_plugin = _load_init(monkeypatch, "0")

    assert hasattr(module.gui, "migration")
    assert "migration" in gui_plugin.loaded_submodules
    assert "migration" in gui_plugin.registered_submodules
