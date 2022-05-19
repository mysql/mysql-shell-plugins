/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

import "./PasswordDialog.css";

import React from "react";

import { requisitions } from "../../supplement/Requisitions";
import {
    Button, Codicon, Component, ContentAlignment, Dialog, Grid, GridCell, IButtonProperties, IComponentState, Icon,
    IInputChangeProperties, Input, Label,
} from "../ui";
import { IServicePasswordRequest } from "../../app-logic/Types";

interface IPasswordDialogState extends IComponentState {
    request?: IServicePasswordRequest;
    password: string;
}

export class PasswordDialog extends Component<{}, IPasswordDialogState> {

    private dialogRef = React.createRef<Dialog>();

    public constructor(props: {}) {
        super(props);

        this.state = {
            password: "",
        };
    }

    public componentDidMount(): void {
        requisitions.register("requestPassword", this.requestPassword);
    }

    public componentWillUnmount(): void {
        requisitions.unregister("requestPassword", this.requestPassword);
    }

    public render(): React.ReactNode {
        const { request, password } = this.state;

        if (!request) {
            return null;
        }

        const className = this.getEffectiveClassNames(["passwordDialog"]);
        const caption = request.caption ?? "Enter Password";

        const descriptionCells: React.ReactNode[] = [];
        request.description?.forEach((value) => {
            descriptionCells.push(
                <GridCell columnSpan={2} crossAlignment={ContentAlignment.Start}>
                    <Label
                        id="caption"
                        language="ansi"
                        caption={value}
                    />
                </GridCell>,
            );
        });

        return <Dialog
            ref={this.dialogRef}
            className={className}
            onClose={this.closeDialog}
            caption={
                <>
                    <Icon src={Codicon.Lock} />
                    <Label>{caption}</Label>
                </>
            }
            content={
                <Grid columns={["30%", "auto"]} columnGap={8} rowGap={8}>
                    {descriptionCells}
                    {
                        request.service && <>
                            <GridCell className="left" crossAlignment={ContentAlignment.Center}>Service:</GridCell>
                            <GridCell className="right" crossAlignment={ContentAlignment.Center}>
                                <Label language="ansi" caption={request.service} />
                            </GridCell>
                        </>
                    }
                    {
                        request.user && <>
                            <GridCell className="left" crossAlignment={ContentAlignment.Center}>User Name:</GridCell>
                            <GridCell className="right" crossAlignment={ContentAlignment.Center}>
                                <Label language="ansi" caption={request.user} />
                            </GridCell>
                        </>
                    }
                    <GridCell className="left" crossAlignment={ContentAlignment.Center}>Password:</GridCell>
                    <GridCell className="right" crossAlignment={ContentAlignment.Center}>
                        <Input
                            autoFocus
                            password={true}
                            value={password}
                            onChange={this.handlePasswordChange}
                            onConfirm={this.handlePasswordConfirm}
                        />
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

    private handlePasswordChange = (_: React.ChangeEvent<Element>, props: IInputChangeProperties): void => {
        this.setState({ password: props.value });
    };

    private handlePasswordConfirm = (): void => {
        this.dialogRef.current?.close(false);
    };

    private requestPassword = (values: IServicePasswordRequest): Promise<boolean> => {
        return new Promise((resolve) => {
            this.setState({ request: values, password: "" }, () => {
                this.dialogRef.current?.open();
                resolve(true);
            });
        });
    };

    private handleButtonClick = (_: React.SyntheticEvent, props: IButtonProperties): void => {
        this.dialogRef.current?.close(props.id !== "ok");
    };

    private closeDialog = (cancelled: boolean): void => {
        const { request, password } = this.state;

        if (request) {
            if (cancelled) {
                void requisitions.execute("cancelPassword", request);
            } else {
                void requisitions.execute("acceptPassword", { request, password });
            }
        }
    };
}
