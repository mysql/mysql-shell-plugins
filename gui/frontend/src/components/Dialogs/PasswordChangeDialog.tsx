/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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
import { ComponentBase, IComponentProperties, IComponentState } from "../ui/Component/ComponentBase.js";
import { ContentAlignment } from "../ui/Container/Container.js";
import { Dialog } from "../ui/Dialog/Dialog.js";
import { Grid } from "../ui/Grid/Grid.js";
import { GridCell } from "../ui/Grid/GridCell.js";
import { Icon } from "../ui/Icon/Icon.js";
import { IInputChangeProperties, Input } from "../ui/Input/Input.js";
import { Label } from "../ui/Label/Label.js";

export interface IPasswordChangeValues {
    password: string;
    currentPassword?: string;
}

export interface IPasswordChangeRequest extends IServicePasswordRequest {
    account?: string;
    requireCurrentPassword?: boolean;
    onAccept?: (values: IPasswordChangeValues) => void | string | Promise<void | string>;
}

interface IPasswordChangeDialogState extends IComponentState {
    request?: IPasswordChangeRequest;
    currentPassword: string;
    password: string;
    passwordConfirmation: string;
    error?: string;
    accepting: boolean;
}

export class PasswordChangeDialog extends ComponentBase<IComponentProperties, IPasswordChangeDialogState> {

    private dialogRef = createRef<Dialog>();
    private signal?: Semaphore<IPasswordChangeValues | void>;
    private accepting = false;

    public constructor(props: IComponentProperties) {
        super(props);

        this.state = {
            currentPassword: "",
            password: "",
            passwordConfirmation: "",
            accepting: false,
        };
    }

    /**
     * Shows the password-change dialog and waits until it is accepted or cancelled.
     *
     * @param request The password-change request and optional accept callback.
     * @returns The entered values, or undefined if the dialog was cancelled.
     */
    public async show(request: IPasswordChangeRequest): Promise<IPasswordChangeValues | undefined> {
        await this.setStatePromise({
            request,
            currentPassword: "",
            password: "",
            passwordConfirmation: "",
            error: undefined,
            accepting: false,
        });
        this.signal = new Semaphore();
        this.dialogRef.current?.open();

        const result = await this.signal.wait();
        this.signal = undefined;
        await this.setStatePromise({
            request: undefined,
            currentPassword: "",
            password: "",
            passwordConfirmation: "",
            error: undefined,
            accepting: false,
        });

        return Promise.resolve(result!);
    }

    public render(): ComponentChild {
        const { request, currentPassword, password, passwordConfirmation, error, accepting } = this.state;
        if (!request) {
            return null;
        }

        const className = this.getEffectiveClassNames(["passwordDialog", "passwordChangeDialog"]);
        const caption = request.caption ?? "Change Password";
        const descriptionCells: ComponentChild[] = [];
        request.description?.forEach((value) => {
            descriptionCells.push(
                <GridCell columnSpan={2} crossAlignment={ContentAlignment.Start}>
                    <Label id="caption" language="ansi" caption={value} />
                </GridCell>,
            );
        });

        return <Dialog
            ref={this.dialogRef}
            id={this.props.id}
            className={className}
            onClose={this.closeDialog}
            caption={<><Icon src={Codicon.Lock} /><Label>{caption}</Label></>}
            content={
                <Grid columns={["30%", "auto"]} columnGap={8} rowGap={8}>
                    {descriptionCells}
                    {request.service && <>
                        <GridCell className="left" crossAlignment={ContentAlignment.Center}>Service:</GridCell>
                        <GridCell className="right" crossAlignment={ContentAlignment.Center}>
                            <Label language="ansi" caption={request.service} />
                        </GridCell>
                    </>}
                    {request.user && <>
                        <GridCell className="left" crossAlignment={ContentAlignment.Center}>User Name:</GridCell>
                        <GridCell className="right" crossAlignment={ContentAlignment.Center}>
                            <Label language="ansi" caption={request.user} />
                        </GridCell>
                    </>}
                    {request.account && <>
                        <GridCell className="left" crossAlignment={ContentAlignment.Center}>Account:</GridCell>
                        <GridCell className="right" crossAlignment={ContentAlignment.Center}>
                            <Label language="ansi" caption={request.account} />
                        </GridCell>
                    </>}
                    {request.requireCurrentPassword && <>
                        <GridCell className="left" crossAlignment={ContentAlignment.Center}>Current Password:</GridCell>
                        <GridCell className="right" crossAlignment={ContentAlignment.Center}>
                            <Input
                                id="currentPassword"
                                password
                                value={currentPassword}
                                onChange={this.handleCurrentPasswordChange}
                                onConfirm={this.handlePasswordConfirm}
                            />
                        </GridCell>
                    </>}
                    <GridCell className="left" crossAlignment={ContentAlignment.Center}>Enter New Password:</GridCell>
                    <GridCell className="right" crossAlignment={ContentAlignment.Center}>
                        <Input
                            id="newPassword"
                            autoFocus={!request.requireCurrentPassword}
                            password
                            value={password}
                            onChange={this.handlePasswordChange}
                            onConfirm={this.handlePasswordConfirm}
                        />
                    </GridCell>
                    <GridCell className="left" crossAlignment={ContentAlignment.Center}>Confirm Password:</GridCell>
                    <GridCell className="right" crossAlignment={ContentAlignment.Center}>
                        <Input
                            id="passwordConfirmation"
                            autoFocus={request.requireCurrentPassword}
                            password
                            value={passwordConfirmation}
                            onChange={this.handlePasswordConfirmationChange}
                            onConfirm={this.handlePasswordConfirm}
                        />
                    </GridCell>
                    {error && <GridCell columnSpan={2}><Label className="error" caption={error} /></GridCell>}
                </Grid>
            }
            actions={{
                end: [
                    <Button id="ok" key="ok" caption="OK" disabled={accepting} onClick={this.handleButtonClick} />,
                    <Button id="cancel" key="cancel" caption="Cancel" onClick={this.handleButtonClick} />,
                ],
            }}
        />;
    }

    private handleCurrentPasswordChange = (_: InputEvent, props: IInputChangeProperties): void => {
        this.setState({ currentPassword: props.value, error: undefined });
    };

    private handlePasswordChange = (_: InputEvent, props: IInputChangeProperties): void => {
        this.setState({ password: props.value, error: undefined });
    };

    private handlePasswordConfirmationChange = (_: InputEvent, props: IInputChangeProperties): void => {
        this.setState({ passwordConfirmation: props.value, error: undefined });
    };

    private handlePasswordConfirm = (): void => {
        void this.acceptDialog();
    };

    private handleButtonClick = (_: MouseEvent | KeyboardEvent, props: IButtonProperties): void => {
        if (props.id === "ok") {
            void this.acceptDialog();
        } else {
            this.dialogRef.current?.close(true);
        }
    };

    private acceptDialog = async (): Promise<void> => {
        if (this.accepting) {
            return;
        }

        const { request, currentPassword, password, passwordConfirmation } = this.state;
        if (password.length === 0) {
            this.setState({ error: "Enter a password." });

            return;
        }
        if (password !== passwordConfirmation) {
            this.setState({ error: "The password confirmation does not match." });

            return;
        }
        if (currentPassword.length > 0 && currentPassword === password) {
            this.setState({ error: "The new password must differ from the current password." });

            return;
        }

        const values: IPasswordChangeValues = { password };
        if (request?.requireCurrentPassword) {
            values.currentPassword = currentPassword;
        }
        let error: string | void;
        this.accepting = true;
        this.setState({ accepting: true });
        try {
            error = await request?.onAccept?.(values);
        } catch (reason) {
            error = reason instanceof Error ? reason.message : String(reason);
        } finally {
            this.accepting = false;
            this.setState({ accepting: false });
        }
        if (error) {
            this.setState({ error });

            return;
        }

        this.dialogRef.current?.close(false);
    };

    private closeDialog = (cancelled: boolean): void => {
        if (cancelled) {
            this.signal?.notify(undefined);

            return;
        }

        const { request, currentPassword, password } = this.state;
        const values: IPasswordChangeValues = { password };
        if (request?.requireCurrentPassword) {
            values.currentPassword = currentPassword;
        }
        this.signal?.notify(values);
    };
}
