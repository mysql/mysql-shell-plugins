/*
 * Copyright (c) 2020, 2021, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import React from "react";
import { Component, GridCell, Label, Grid, Orientation } from "../../ui";

export class SymbolGrid extends Component {

    private static iconNames = [
        "array",
        "boolean",
        "class",
        "color",
        "constant",
        "constructor",
        "enum",
        "enum-member",
        "event",
        "field",
        "file",
        "folder",
        "function",
        "interface",
        "key",
        "keyword",
        "method",
        "module",
        "namespace",
        "null",
        "number",
        "object",
        "operator",
        "package",
        "property",
        "reference",
        "snippet",
        "string",
        "struct",
        "text",
        "parameter",
        "unit",
        "variable",
    ];

    public render(): React.ReactNode {
        const content = SymbolGrid.iconNames.map((name: string, index: number) => {
            let symbolName = name;
            if (name === "parameter") {
                symbolName = "type-parameter";
            }

            return (
                <GridCell
                    className="symbol"
                    key={`symbol${index}`}
                    orientation={Orientation.LeftToRight}
                >
                    <span className={"codicon codicon-symbol-" + symbolName} />
                    <Label as="span">{name}</Label>
                </GridCell>
            );
        });

        return (
            <Grid
                id="symbols"
                columns={5}
                rowGap={10}
                columnGap={10}
            >
                {content}
            </Grid>
        );
    }
}
