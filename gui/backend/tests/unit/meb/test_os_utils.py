# Copyright (c) 2026, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.

from __future__ import annotations

import importlib.util
import os
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock


MEB_ROOT = Path(__file__).resolve().parents[3] / "gui_plugin" / "meb"
OS_UTILS_PATH = Path(os.environ.get(
    "MEB_OS_UTILS_PATH",
    MEB_ROOT / "os_utils.py",
))


def load_os_utils() -> types.ModuleType:
    spec = importlib.util.spec_from_file_location("meb_os_utils", OS_UTILS_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    return module


os_utils = load_os_utils()


class WindowsAsciiDirectoryPathTests(unittest.TestCase):
    def test_ascii_directory_does_not_require_conversion(self) -> None:
        with mock.patch.object(os_utils, "windows_short_path") as short_path:
            result = os_utils.windows_ascii_directory_path(r"C:\backup-home")

        self.assertEqual(result, r"C:\backup-home")
        short_path.assert_not_called()

    def test_non_ascii_short_path_is_rejected(self) -> None:
        with mock.patch.object(
            os_utils,
            "windows_short_path",
            return_value=r"C:\backup-home\テスト",
        ):
            with self.assertRaisesRegex(OSError, "ASCII short path"):
                os_utils.windows_ascii_directory_path(r"C:\backup-home\テスト")


@unittest.skipUnless(os.name == "nt", "Windows API test")
class WindowsShortPathTests(unittest.TestCase):
    def test_unicode_directory_has_ascii_short_path(self) -> None:
        scratch_root = os.environ.get("MEB_TEST_TEMP_ROOT")
        with tempfile.TemporaryDirectory(dir=scratch_root) as temporary:
            directory = Path(temporary) / "テスト"
            directory.mkdir()

            short_path = os_utils.windows_ascii_directory_path(directory.as_posix())

            self.assertTrue(short_path.isascii())
            self.assertTrue(os.path.samefile(directory, short_path))

    def test_missing_unicode_directory_raises_os_error(self) -> None:
        scratch_root = os.environ.get("MEB_TEST_TEMP_ROOT")
        with tempfile.TemporaryDirectory(dir=scratch_root) as temporary:
            missing = Path(temporary) / "missing-テスト"

            with self.assertRaises(OSError):
                os_utils.windows_short_path(missing.as_posix())


if __name__ == "__main__":
    unittest.main()
