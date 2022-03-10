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

import "./ConfirmDialog.css";

import React from "react";

import {
    Button, Codicon, Component, Container, Dialog, IComponentProperties, IComponentState, Icon, Label, Orientation,
} from "../ui";

export interface IConfirmDialogProperties extends IComponentProperties {
    caption: string;
    onClose?: (accepted: boolean, payload?: unknown) => void;
}

export interface IConfirmDialogState extends IComponentState {
    message: React.ReactNode;
    refuseText: string;
    acceptText: string;
    payload?: unknown;
}

export class ConfirmDialog extends Component<IConfirmDialogProperties, IConfirmDialogState> {

    private dialogRef = React.createRef<Dialog>();

    public constructor(props: IConfirmDialogProperties) {
        super(props);
        this.state = {
            message: "",
            refuseText: "",
            acceptText: "",
        };
        this.addHandledProperties("caption", "onClose");
    }

    public show = (message: React.ReactNode, refuseText: string, acceptText: string, payload?: unknown): void => {
        this.setState({ message, refuseText, acceptText, payload }, () => {
            return this.dialogRef.current?.open();
        });
    };

    public render(): React.ReactNode {
        const { caption } = this.props;
        const { message, refuseText, acceptText } = this.state;

        const className = this.getEffectiveClassNames(["confirmDialog"]);
        let dialogContent = null;
        if (React.isValidElement(message)) {
            dialogContent = message;
        } else {
            dialogContent =
                <Container orientation={Orientation.TopDown}>
                    {message && <Label id="dialogMessage" caption={message as string} />}
                </Container>;
        }

        const actions: React.ReactNode[] = [];
        if (acceptText) {
            actions.push(<Button
                caption={acceptText}
                id="accept"
                key="accept"
                onClick={this.handleActionClick}
            />);
        }
        if (refuseText) {
            actions.push(<Button
                caption={refuseText}
                id="refuse"
                key="refuse"
                onClick={this.handleActionClick}
            />);
        }

        return (
            <Dialog
                ref={this.dialogRef}
                className={className}
                caption={
                    <>
                        <Icon src={Codicon.Question} />
                        <Label>{caption}</Label>
                    </>
                }
                content={dialogContent}
                actions={{
                    end: actions,
                }}
            >
            </Dialog>
        );
    }

    private handleActionClick = (e: React.SyntheticEvent, props: Readonly<IComponentProperties>): void => {
        const { onClose } = this.props;
        const { payload } = this.state;

        let accepted = false;

        if (props.id === "accept") {
            accepted = true;
        }

        this.dialogRef.current?.close(!accepted);

        onClose?.(accepted, payload);
    };

}
