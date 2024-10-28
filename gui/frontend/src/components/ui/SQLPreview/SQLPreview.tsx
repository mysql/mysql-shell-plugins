/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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

import "./SQLPreview.css";

import { ComponentChild } from "preact";

import { ComponentBase, IComponentProperties } from "../Component/ComponentBase.js";
import { Label } from "../Label/Label.js";
import { Container, Orientation } from "../Container/Container.js";
import { MessageType } from "../../../app-logic/general-types.js";

export interface ISQLPreviewProperties extends IComponentProperties {
    /** The SQL statements to preview. This is a list of tuples: [statement-id, statement]. */
    statements: Array<[number, string]>;

    errors?: string[];

    onStatementClick?: (index: number) => void;
}

export class SQLPreview extends ComponentBase<ISQLPreviewProperties> {
    public constructor(props: ISQLPreviewProperties) {
        super(props);
    }

    public render(): ComponentChild {
        const { statements, errors = [] } = this.props;

        // Create a list of labels from the statements.
        const labels = statements.map((statement, index) => {
            if (errors && errors[index]) {
                return (
                    <Container
                        orientation={Orientation.TopDown}
                    >
                        <Label
                            key={index}
                            className="sqlPreviewItem"
                            id={String(statement[0])}
                            language="mysql"
                            onClick={this.handleMouseClick}
                        >
                            {`${statement[1]};`}
                        </Label>
                        {errors && errors[index] && <Label type={MessageType.Error}>{errors[index]}</Label>}
                    </Container>
                );
            } else {
                return (
                    <Label
                        key={index}
                        id={String(statement[0])}
                        language="mysql"
                        className="sqlPreviewItem"
                        onClick={this.handleMouseClick}
                    >
                        {`${statement[1]};`}
                    </Label>
                );
            }
        });

        return (
            <Container className="sqlPreviewHost" orientation={Orientation.TopDown} >
                <Label className="sqlPreviewTitle">SQL Preview</Label>
                {labels.length === 0 &&
                    <Label className="error">{"<No Changes>"}</Label>
                }
                {labels}
            </Container >
        );
    }

    private handleMouseClick = (event: MouseEvent | KeyboardEvent) => {
        event.stopPropagation();
        if (event.target instanceof HTMLElement) {
            const label = event.target.closest(".sqlPreviewItem");
            if (label) {
                const { onStatementClick } = this.props;

                onStatementClick?.(parseInt(label.id, 10));
            }
        }
    };
}
