# MySQL REST Service (MRS) Grammar

The MRS grammar is written using ANTLR.

It is recommended to use the `ANTLR4 grammar syntax support` VS Code extension to write and debug the grammar.

## ANTLR Version

The MySQL Shell includes a specific version of the ANTLR Python runtime, e.g. 4.13.0. It is important to use that very same version of ANTLR to generate the Python files found in the ../mrs_parser folder.

Please check the version of the ANTLR Python runtime before generating the lexer/parser files.

## File Generation

To generate the required Python lexer/parser files, run the npm script `update-mrs-parser`.

Copyright (c) 2023, Oracle and/or its affiliates.
