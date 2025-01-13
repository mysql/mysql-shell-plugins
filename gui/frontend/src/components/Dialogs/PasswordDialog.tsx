/*
 * Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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

import "./PasswordDialog.css";

import { ComponentChild, createRef } from "preact";

import { IServicePasswordRequest } from "../../app-logic/general-types.js";
import { Semaphore } from "../../supplement/Semaphore.js";
import { Button, IButtonProperties } from "../ui/Button/Button.js";
import { Codicon } from "../ui/Codicon.js";
import { ComponentBase, IComponentState } from "../ui/Component/ComponentBase.js";
import { ContentAlignment } from "../ui/Container/Container.js";
import { Dialog } from "../ui/Dialog/Dialog.js";
import { Grid } from "../ui/Grid/Grid.js";
import { GridCell } from "../ui/Grid/GridCell.js";
import { Icon } from "../ui/Icon/Icon.js";
import { IInputChangeProperties, Input } from "../ui/Input/Input.js";
import { Label } from "../ui/Label/Label.js";

interface IPasswordDialogState extends IComponentState {
    request?: IServicePasswordRequest;
    password: string;
}

export class PasswordDialog extends ComponentBase<{}, IPasswordDialogState> {

    private dialogRef = createRef<Dialog>();
    private signal?: Semaphore<string | void>;

    public constructor(props: {}) {
        super(props);

        this.state = {
            password: "",
        };
    }

    /**
     * Show the password dialog and wait until the user has entered a password or cancelled the dialog.
     *
     * @param values The details for the password dialog.
     *
     * @returns The entered password or undefined if the dialog was cancelled.
     */
    public async show(values: IServicePasswordRequest): Promise<string | undefined> {
        await this.setStatePromise({ request: values, password: "" });
        this.signal = new Semaphore();
        this.dialogRef.current?.open();

        const result = await this.signal.wait();
        this.signal = undefined;

        if (typeof result === "string") {
            return result;
        }

        return undefined;
    }

    public render(): ComponentChild {
        const { request, password } = this.state;

        if (!request) {
            return null;
        }

        const className = this.getEffectiveClassNames(["passwordDialog"]);
        const caption = request.caption ?? "Enter Password";

        const descriptionCells: ComponentChild[] = [];
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

    private handlePasswordChange = (_: InputEvent, props: IInputChangeProperties): void => {
        this.setState({ password: props.value });
    };

    private handlePasswordConfirm = (): void => {
        this.dialogRef.current?.close(false);
    };

    private handleButtonClick = (_: MouseEvent | KeyboardEvent, props: IButtonProperties): void => {
        this.dialogRef.current?.close(props.id !== "ok");
    };

    private closeDialog = (cancelled: boolean): void => {
        if (cancelled) {
            this.signal?.notify(undefined);
        } else {
            const { password } = this.state;
            this.signal?.notify(password);
        }
    };
}
