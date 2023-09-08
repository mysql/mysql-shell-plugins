<!-- Copyright (c) 2022, 2023, Oracle and/or its affiliates.

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License, version 2.0,
as published by the Free Software Foundation.

This program is also distributed with certain software (including
but not limited to OpenSSL) that is licensed under separate terms, as
designated in a particular file or component or in included license
documentation.  The authors of MySQL hereby grant you an additional
permission to link the program and your derivative works with the
separately licensed software that they have included with MySQL.
This program is distributed in the hope that it will be useful,  but
WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
the GNU General Public License, version 2.0, for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA -->

<!-- cSpell:ignore pandoc -->

# MRS Docs

This folder contains the MRS documentation.

## Generate Distribution

The documentation is written in Markdown syntax. It is converted to HTML with the tool [pandoc](https://pandoc.org/).

### Installing pandoc 2.19.2

Download and install pandoc 2.19.2 from <https://github.com/jgm/pandoc/releases/tag/2.19.2>

### Installing pandoc-include

    pip install --user pandoc-include

### Generating the HTML file

A VS Code build tasks has been defined to build the documentation in the docs/dist folder. Press `Cmd + Shift + B` to start the build. The documentation is built using the `./scripts/generate_html_docs.sh` script.

To build the documentation manually, invoke the following command to generate the index.html page:

    pandoc index.md -f markdown -t html -s -o index.html --template=templates/mysql_docs.html --toc --toc-depth=3 --metadata title="MRS Developer's Guide" --variable=template_css:style/style.css --filter pandoc-include

The style.css file is expected to be placed in a `dist/style/` folder.
