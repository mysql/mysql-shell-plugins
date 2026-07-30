<!-- Copyright (c) 2022, 2026, Oracle and/or its affiliates.

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License, version 2.0,
as published by the Free Software Foundation.

This program is designed to work with certain software (including
but not limited to OpenSSL) that is licensed under separate terms, as
designated in a particular file or component or in included license
documentation.  The authors of MySQL hereby grant you an additional
permission to link the program and your derivative works with the
separately licensed software that they have either included with
the program or referenced in the documentation.

This program is distributed in the hope that it will be useful,  but
WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
the GNU General Public License, version 2.0, for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA -->

# MySQL Workbench Frontend

This is the Preact renderer used by the MySQL Workbench Electron application. It communicates with its embedded MySQL Shell exclusively through the desktop stdio bridge. MySQL Router is controlled by the Electron main process, so Router binaries and credentials never enter the renderer process.

## Development

Install frontend dependencies from this directory:

```bash
npm install
```

Run the Electron development workflow described in [the Electron developer guide](../electron/developer.md). Development can use an installed MySQL Shell and MySQL Router; production packages bundle both runtimes.

## Build and test

```bash
npm run build
npm run unit-tests
```

End-to-end coverage belongs to `gui/electron/tests/e2e`. In particular, MRS and Router scenarios must be exercised through the Workbench Electron application, not through a browser harness.
