<!-- Copyright (c) 2022, 2025, Oracle and/or its affiliates.

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

<!-- cSpell:ignore pandoc -->

# MRS Docs

This folder contains the MRS documentation.

## Generating Railroad Diagrams

- The ANTLR4 VS Code extension needs to be installed and patched.
- Configure the extension as follows:
    "antlr4.rrd.stripNamePart": "_SYMBOL|_OPERATOR",
    "antlr4.rrd.wrapAfter": 50,
    "antlr4.rrd.saveDir": "<path>/shell-plugins/mrs_plugin/docs/images/sql",
- Then the SVG images can be exported to the ./images/sql folder.
- The fix-rrd-svg-files NPM script needs to be executed to patch selected SVG images.

### Patching ANTLR4

### Patch Style Sheet

- Open /Users/mzinner/.vscode/extensions/mike-lischke.vscode-antlr4-2.4.3/misc/light.css
- Replace the RRD section between `/* Railroad diagrams */` and `/* Call graphs */` with the following CSS definitions.`

svg.railroad-diagram path { stroke-width: 2; stroke: darkgray; fill: rgba(0, 0, 0, 0); }
svg.railroad-diagram text { font: bold 12px Hack, "Source Code Pro", monospace; text-anchor: middle; fill: #404040; }
svg.railroad-diagram text.comment { font: italic 10px Hack, "Source Code Pro", monospace; fill: #404040; }
svg.railroad-diagram g.terminal rect { stroke-width: 2; stroke: #404040; fill: rgba(200, 200, 200, 0.8); }
svg.railroad-diagram g.non-terminal rect { stroke-width: 2; stroke: #404040; fill: rgba(255, 255, 255, 1); }
svg.railroad-diagram text.diagram-text { font-size: 12px Hack, "Source Code Pro", monospace; fill: red; }
svg.railroad-diagram path.diagram-text { stroke-width: 1; stroke: red; fill: red; cursor: help; }
svg.railroad-diagram g.diagram-text:hover path.diagram-text { fill: #f00; }

### Patch Code

- Open /Users/mzinner/.vscode/extensions/mike-lischke.vscode-antlr4-2.4.3/out/main.cjs
- Do the following replacements (near `new Terminal('${content}')`) (3 lines affected)

- `const content = this.escapeTerminal(node).replace(this.#stripPattern, "");` needs to be replaced with
- `const content = this.escapeTerminal(node).replace(this.#stripPattern, "").replace("DATABASE", "SCHEMA");`

- `const content = node.getText().replace(this.#stripPattern, "");` needs to be replaced with
- `const content = node.getText().replace(this.#stripPattern, "").replace("DATABASE", "SCHEMA");`

## Generate Distribution

The documentation is written in Markdown syntax. It is converted to HTML with the tool [pandoc](https://pandoc.org/).

### Installing pandoc 2.19.2

Download and install pandoc 2.19.2 from <https://github.com/jgm/pandoc/releases/tag/2.19.2>

### Installing pandoc-include

    pip install --user pandoc-include

### Generating the HTML file

A VS Code build tasks has been defined to build the documentation in the docs/dist folder. Press `Cmd + Shift + B` to start the build. The documentation is built using the `./scripts/generate_html_docs.sh` script.

Alternatively, the `update-html-docs` NPM script can be run.

To build the documentation manually, invoke the following command to generate the index.html page from `mrs_plugin/docs`:

    pandoc index.md -f markdown -t html -s -o index.html --template=templates/mysql_docs.html --toc --toc-depth=2 --metadata title="MRS Developer's Guide" --variable=template_css:style/style.css --filter pandoc-include --number-sections

    pandoc restApi.md -f markdown -t html -s -o restApi.html --template=templates/mysql_docs.html --toc --toc-depth=2 --metadata title="MRS Core REST APIs" --variable=template_css:style/style.css --filter pandoc-include --number-sections

    pandoc sdk.md -f markdown -t html -s -o sdk.html --template=templates/mysql_docs.html --toc --toc-depth=2 --metadata title="MRS SDK Reference" --variable=template_css:style/style.css --filter pandoc-include --number-sections

    pandoc sql.md -f markdown -t html -s -o sql.html --template=templates/mysql_docs.html --toc --toc-depth=2 --metadata title="MRS SQL Reference" --variable=template_css:style/style.css --filter pandoc-include --number-sections

The style.css file is expected to be placed in a `dist/style/` folder.
