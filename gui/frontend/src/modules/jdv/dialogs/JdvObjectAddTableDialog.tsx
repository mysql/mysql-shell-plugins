/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have either included with
 * the program or referenced in the documentation.
 *
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import "./JdvDialog.css";

import { ComponentChild, createRef } from "preact";
import { Button, IButtonProperties } from "../../../components/ui/Button/Button.js";
import { Codicon } from "../../../components/ui/Codicon.js";
import {
    ComponentBase, IComponentProperties, IComponentState,
} from "../../../components/ui/Component/ComponentBase.js";
import { ContentAlignment } from "../../../components/ui/Container/Container.js";
import { Dialog } from "../../../components/ui/Dialog/Dialog.js";
import { Dropdown } from "../../../components/ui/Dropdown/Dropdown.js";
import { DropdownItem } from "../../../components/ui/Dropdown/DropdownItem.js";
import { Grid } from "../../../components/ui/Grid/Grid.js";
import { GridCell } from "../../../components/ui/Grid/GridCell.js";
import { Icon } from "../../../components/ui/Icon/Icon.js";
import { Label } from "../../../components/ui/Label/Label.js";
import { Semaphore } from "../../../supplement/Semaphore.js";

interface IJdvAddTableDialogProperties extends IComponentProperties {
    schemasWithTables: Record<string, string[]>;
}

export interface IJdvAddTableDialogState extends IComponentState {
    tableSchema: string;
    tableName: string;
}

export class JdvObjectAddTableDialog extends ComponentBase<IJdvAddTableDialogProperties, IJdvAddTableDialogState> {

    private dialogRef = createRef<Dialog>();
    private signal?: Semaphore<IJdvAddTableDialogState | void>;

    public constructor(props: IJdvAddTableDialogProperties) {
        super(props);

        this.state = {
            tableSchema: "",
            tableName: "",
        };
    }

    /**
     * Show the add table dialog and wait until the user selects the table schema and name or cancelled the dialog.
     *
     * @returns The entered password or undefined if the dialog was cancelled.
     */
    public async show(): Promise<IJdvAddTableDialogState | undefined> {
        this.setState({ tableSchema: "", tableName: "" });
        this.signal = new Semaphore();
        this.dialogRef.current?.open();

        const result = await this.signal.wait();
        this.signal = undefined;

        if (result) {
            return result;
        }

        return undefined;
    }

    public render(): ComponentChild {
        const { tableSchema, tableName } = this.state;
        const { schemasWithTables } = this.props;

        const dbSchemas = Object.keys(schemasWithTables);
        const schemaTables = schemasWithTables[tableSchema] ?? [];

        const className = this.getEffectiveClassNames(["jdvObjectAddTableDialog"]);

        return <Dialog
            ref={this.dialogRef}
            className={className}
            onClose={this.closeDialog}
            caption={
                <>
                    <Icon src={Codicon.Add} />
                    <Label>{"Add Child Table"}</Label>
                </>
            }
            content={
                <Grid columns={["20px", "110px", "auto", "20px"]} columnGap={5} rowGap={5}>
                    <GridCell rowSpan={2}></GridCell> {/* To maintain a gap at the beginning*/}
                    <GridCell className="left" crossAlignment={ContentAlignment.Center}>
                        Table Schema:
                    </GridCell>
                    <GridCell className="right" crossAlignment={ContentAlignment.Center}>
                        <Dropdown
                            id={"tableSchema"}
                            placeholder={tableSchema}
                            selection={tableSchema}
                            onSelect={this.handleTableSchemaSelected}
                        >
                            {dbSchemas.map((schema) => {
                                return <DropdownItem
                                    caption={schema}
                                    id={schema}
                                />;
                            })}
                        </Dropdown>
                    </GridCell>

                    <GridCell rowSpan={2}></GridCell> {/* To maintain a gap at the end*/}
                    <GridCell className="left" crossAlignment={ContentAlignment.Center}>
                        Table Name:
                    </GridCell>
                    <GridCell className="right" crossAlignment={ContentAlignment.Center}>
                        <Dropdown
                            id={"tableName"}
                            placeholder={tableName}
                            selection={tableName}
                            onSelect={this.handleTableNameSelected}
                        >
                            {schemaTables.map((table) => {
                                return <DropdownItem
                                    caption={table}
                                    id={table}
                                />;
                            })}
                        </Dropdown>
                    </GridCell>
                </Grid>
            }
            actions={{
                end: [
                    <Button
                        id="ok"
                        key="ok"
                        caption="OK"
                        onClick={this.handleButtonClick}
                    />,
                    <Button
                        id="cancel"
                        key="cancel"
                        caption="Cancel"
                        onClick={this.handleButtonClick}
                    />,
                ],
            }}
        />;
    }

    private handleTableSchemaSelected = (accept: boolean, selection: Set<string>): void => {
        this.setState({ tableSchema: [...selection][0], tableName: "" });
    };

    private handleTableNameSelected = (accept: boolean, selection: Set<string>): void => {
        this.setState({ tableName: [...selection][0] });
    };

    private handleButtonClick = (e: MouseEvent | KeyboardEvent, props: IButtonProperties): void => {
        this.dialogRef.current?.close(props.id !== "ok");
    };

    private closeDialog = (cancelled: boolean): void => {
        if (cancelled) {
            this.signal?.notify(undefined);
        } else {
            this.signal?.notify(this.state);
        }
    };
}
