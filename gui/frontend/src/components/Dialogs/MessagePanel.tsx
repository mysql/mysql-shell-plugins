/*
 * Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

import "./MessagePanel.css";

import { ComponentChild, createRef } from "preact";

import { appParameters, requisitions } from "../../supplement/Requisitions";
import { Codicon } from "../ui/Codicon";
import { IComponentState, ComponentBase } from "../ui/Component/ComponentBase";
import { Container, Orientation } from "../ui/Container/Container";
import { Dialog } from "../ui/Dialog/Dialog";
import { Icon } from "../ui/Icon/Icon";
import { Label } from "../ui/Label/Label";
import { Button } from "../ui/Button/Button";

interface IMessagePanelState extends IComponentState {
    isError: boolean;
    caption: string;
    message: string;
}

export class MessagePanel extends ComponentBase<{}, IMessagePanelState> {

    private dialogRef = createRef<Dialog>();

    public constructor(props: {}) {
        super(props);

        this.state = {
            caption: "",
            message: "",
            isError: false,
        };
    }

    public componentDidMount(): void {
        requisitions.register("showError", this.showError);
        requisitions.register("showInfo", this.showInfo);
    }

    public componentWillUnmount(): void {
        requisitions.unregister("showError", this.showError);
        requisitions.unregister("showInfo", this.showInfo);
    }

    public render(): ComponentChild {
        const { isError, caption, message } = this.state;

        const className = this.getEffectiveClassNames(["errorPanel"]);

        return (
            <Dialog
                ref={this.dialogRef}
                className={className}
                caption={
                    <>
                        <Icon src={isError ? Codicon.Error : Codicon.Info} />
                        <Label>{caption}</Label>
                    </>
                }
                content={
                    <Container orientation={Orientation.TopDown}>
                        {message && <Label
                            id={isError ? "errorMessage" : "infoMessage"}
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

    private showError = (values: string[]): Promise<boolean> => {
        return this.show(true, values);
    };

    private showInfo = (values: string[]): Promise<boolean> => {
        return this.show(false, values);
    };

    private show = (isError: boolean, values: string[]): Promise<boolean> => {
        // Forward info messages to the hosting application.
        if (!isError && appParameters.embedded) {
            const result = requisitions.executeRemote("showInfo", values);
            if (result) {
                return Promise.resolve(true);
            }
        }

        return new Promise((resolve) => {
            if (values.length > 0) {
                let caption = isError ? "Error" : "Information";
                let message = values[0];

                if (values.length > 1) {
                    caption = message;
                    message = values.slice(1).join("\n");
                }

                this.setState({ isError, caption, message }, () => {
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
