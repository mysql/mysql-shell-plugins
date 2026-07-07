# Copyright (c) 2026, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.

from __future__ import annotations

import unittest
from pathlib import Path


if __name__ == "__main__":
    root = Path(__file__).resolve().parent
    suite = unittest.defaultTestLoader.discover((root / "tests").as_posix())
    raise SystemExit(0 if unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful() else 1)
