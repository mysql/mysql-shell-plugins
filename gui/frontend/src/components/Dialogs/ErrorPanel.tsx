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

import "./ErrorPanel.css";

import React from "react";

import {
    Button, Codicon, Component, Container, Dialog, IComponentState, Icon, Label, Orientation,
} from "../ui";
import { requisitions } from "../../supplement/Requisitions";

export interface IErrorPanelState extends IComponentState {
    caption: string;
    message: string;
}

export class ErrorPanel extends Component<{}, IErrorPanelState> {

    private dialogRef = React.createRef<Dialog>();

    public constructor(props: {}) {
        super(props);

        this.state = {
            caption: "",
            message: "",
        };
    }

    public componentDidMount(): void {
        requisitions.register("showError", this.show);
    }

    public componentWillUnmount(): void {
        requisitions.unregister("showError", this.show);
    }

    public render(): React.ReactNode {
        const { caption, message } = this.state;

        const className = this.getEffectiveClassNames(["errorPanel"]);

        return (
            <Dialog
                ref={this.dialogRef}
                className={className}
                caption={
                    <>
                        <Icon src={Codicon.Error} />
                        <Label>{caption}</Label>
                    </>
                }
                content={
                    <Container orientation={Orientation.TopDown}>
                        {message && <Label
                            id="errorMessage"
                            caption={message}
                            style={{ whiteSpace: "pre-line" }}
                        />}
                    </Container>
                }
                actions={{
                    end: [
                        <Button
                            key="close"
                            caption="Close"
                            onClick={this.closePanel}
                        />,
                    ],
                }}
            >
            </Dialog>
        );
    }

    private show = (values: string[]): Promise<boolean> => {
        return new Promise((resolve) => {
            if (values.length > 0) {
                let caption = "Error";
                let message = values[0];

                if (values.length > 1) {
                    caption = message;
                    message = values.slice(1).join("\n");
                }

                this.setState({ caption, message }, () => {
                    this.dialogRef.current?.open();
                    resolve(true);
                });
            } else {
                resolve(true);
            }
        });
    };

    private closePanel = (): void => {
        this.dialogRef.current?.close(false);
    };

}
