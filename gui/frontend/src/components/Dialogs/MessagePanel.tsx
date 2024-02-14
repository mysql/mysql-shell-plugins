/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

import "./MessagePanel.css";

import { ComponentChild, createRef } from "preact";

import { appParameters, requisitions } from "../../supplement/Requisitions.js";
import { Codicon } from "../ui/Codicon.js";
import { IComponentState, ComponentBase } from "../ui/Component/ComponentBase.js";
import { Container, Orientation } from "../ui/Container/Container.js";
import { Dialog } from "../ui/Dialog/Dialog.js";
import { Icon } from "../ui/Icon/Icon.js";
import { Label } from "../ui/Label/Label.js";
import { Button } from "../ui/Button/Button.js";
import { Semaphore } from "../../supplement/Semaphore.js";

interface IMessagePanelState extends IComponentState {
    isError: boolean;
    caption: string;
    message: string;
}

export class MessagePanel extends ComponentBase<{}, IMessagePanelState> {

    #dialogRef = createRef<Dialog>();
    #signal: Semaphore<boolean> | undefined;

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
                ref={this.#dialogRef}
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
                            onClick={this.handleActionClick}
                        />,
                    ],
                }}
                onClose={this.closePanel}
            >
            </Dialog>
        );
    }

    private showError = (values: string[]): Promise<boolean> => {
        if (this.#signal) {
            throw new Error("Only one message can be shown at a time.");
        }

        this.show(true, values);
        if (!this.#signal) {
            return Promise.resolve(true);
        }

        // Need the cast to avoid TS + eslint errors about a `never` type being used here.
        // Seems they do not count the creation of the semaphore in the `show` method.
        return (this.#signal as Semaphore<boolean>).wait();
    };

    private showInfo = (values: string[]): Promise<boolean> => {
        if (this.#signal) {
            throw new Error("Only one message can be shown at a time.");
        }

        this.show(false, values);
        if (!this.#signal) {
            return Promise.resolve(true);
        }

        return (this.#signal as Semaphore<boolean>).wait();
    };

    private show = (isError: boolean, values: string[]): void => {
        // Forward info messages to the hosting application.
        if (!isError && appParameters.embedded) {
            const result = requisitions.executeRemote("showInfo", values);
            if (result) {
                return;
            }
        }

        if (values.length > 0) {
            this.#signal = new Semaphore<boolean>();

            let caption = isError ? "Error" : "Information";
            let message = values[0];

            if (values.length > 1) {
                caption = message;
                message = values.slice(1).join("\n");
            }

            this.setState({ isError, caption, message }, () => {
                this.#dialogRef.current?.open();
            });
        }
    };

    private handleActionClick = (): void => {
        this.#dialogRef.current?.close(false);
    };

    private closePanel = (cancelled?: boolean): void => {
        if (cancelled) {
            this.#dialogRef.current?.close(false);
        }

        this.#signal?.notifyAll(true);
        this.#signal = undefined;
    };

}
