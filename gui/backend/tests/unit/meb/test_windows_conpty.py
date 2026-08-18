# Copyright (c) 2026, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.

from __future__ import annotations

import importlib.util
import io
import sys
import types
import unittest
from pathlib import Path
from unittest import mock


MEB_ROOT = Path(__file__).resolve().parents[3] / "gui_plugin" / "meb"
WORKER_PATH = MEB_ROOT / "windows_conpty.py"


def load_worker() -> types.ModuleType:
    if not WORKER_PATH.is_file():
        raise AssertionError("windows_conpty.py is missing")

    module_name = "gui_plugin.meb.windows_conpty"
    spec = importlib.util.spec_from_file_location(module_name, WORKER_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)

    return module


class WindowsConPtyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.worker = load_worker()

    def test_main_forwards_command_arguments_input_and_environment(self) -> None:
        stdin = types.SimpleNamespace(buffer=io.BytesIO(b"terminal input\r"))
        stdout = io.StringIO()
        environment = {"MYSQL_TEST_LOGIN_FILE": r"C:\backup\.mylogin.cnf"}
        result = self.worker.ProcessResult(7, b"child output")

        with mock.patch.object(self.worker.os, "name", "nt"), mock.patch.object(
            self.worker.os,
            "environ",
            environment,
        ), mock.patch.object(
            self.worker.sys,
            "stdin",
            stdin,
        ), mock.patch.object(
            self.worker.sys,
            "stdout",
            stdout,
        ), mock.patch.object(
            self.worker,
            "run_in_pseudoconsole",
            return_value=result,
        ) as run:
            returncode = self.worker.main([
                "--stdin",
                "--",
                r"C:\MySQL\bin\mysql_config_editor.exe",
                "set",
                "--login-path=backup-login",
                "--password",
            ])

        self.assertEqual(returncode, 7)
        self.assertEqual(stdout.getvalue(), "child output")
        self.assertEqual(environment, {
            "MYSQL_TEST_LOGIN_FILE": r"C:\backup\.mylogin.cnf",
        })
        run.assert_called_once_with(
            [
                r"C:\MySQL\bin\mysql_config_editor.exe",
                "set",
                "--login-path=backup-login",
                "--password",
            ],
            b"terminal input\r",
        )

    def test_main_requires_a_command(self) -> None:
        stderr = io.StringIO()

        with mock.patch.object(self.worker.os, "name", "nt"), mock.patch.object(
            self.worker.sys,
            "stderr",
            stderr,
        ):
            returncode = self.worker.main(["--stdin", "--"])

        self.assertEqual(returncode, 2)
        self.assertIn("COMMAND [ARG ...]", stderr.getvalue())

    def test_main_does_not_read_stdin_without_option(self) -> None:
        stdin = types.SimpleNamespace(buffer=mock.Mock())

        with mock.patch.object(self.worker.os, "name", "nt"), mock.patch.object(
            self.worker.sys,
            "stdin",
            stdin,
        ), mock.patch.object(
            self.worker,
            "run_in_pseudoconsole",
            return_value=self.worker.ProcessResult(0, b""),
        ) as run:
            returncode = self.worker.main(["--", "child.exe"])

        self.assertEqual(returncode, 0)
        stdin.buffer.read.assert_not_called()
        run.assert_called_once_with(["child.exe"], b"")


if __name__ == "__main__":
    unittest.main()
