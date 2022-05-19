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
import { DialogResponseClosure, IDictionary } from "../../app-logic/Types";

export interface IConfirmDialogButtons {
    accept?: string;      // Default: "Yes".
    refuse?: string;      // Default: "No".
    alternative?: string; // Default: nothing.
    default?: string;     // Default: nothing.
}

export interface IConfirmDialogProperties extends IComponentProperties {
    caption: string;
    onClose?: (closure: DialogResponseClosure, values?: IDictionary) => void;
}

export interface IConfirmDialogState extends IComponentState {
    message: React.ReactNode;
    buttons: IConfirmDialogButtons;
    values?: IDictionary;
    description?: string[];
}

export class ConfirmDialog extends Component<IConfirmDialogProperties, IConfirmDialogState> {

    private dialogRef = React.createRef<Dialog>();

    public constructor(props: IConfirmDialogProperties) {
        super(props);
        this.state = {
            message: "",
            buttons: {},
        };
        this.addHandledProperties("caption", "buttons", "onClose");
    }

    public show = (message: React.ReactNode, buttons: IConfirmDialogButtons, description?: string[],
        values?: IDictionary): void => {
        this.setState({ message, buttons, values, description }, () => {
            return this.dialogRef.current?.open({ closeOnEscape: true });
        });
    };

    public render(): React.ReactNode {
        const { caption } = this.props;
        const { message, buttons, description } = this.state;

        const className = this.getEffectiveClassNames(["confirmDialog"]);
        let dialogContent = null;
        if (React.isValidElement(message)) {
            dialogContent = message;
        } else {
            // If no explicit content is specified, use the description list for additional content.
            const descriptionLabels: React.ReactNode[] = [];
            description?.forEach((value) => {
                descriptionLabels.push(
                    <Container>
                        <Label
                            id="caption"
                            language="ansi"
                            caption={value}
                        />
                    </Container>,
                );
            });


            dialogContent =
                <Container orientation={Orientation.TopDown}>
                    {descriptionLabels}
                    {message && <Label id="dialogMessage" caption={message as string} />}
                </Container>;
        }

        // TODO: consider the different order of the buttons based on the OS.
        const actions: React.ReactNode[] = [];
        if (buttons.alternative) {
            actions.push(<Button
                caption={buttons.alternative.replace(/&/g, "")} // Remove hot key indicator. We cannot show them.
                id="alternative"
                key="alternative"
                isDefault={buttons.alternative === buttons.default}
                onClick={this.handleActionClick}
            />);
        }

        if (buttons.accept) {
            actions.push(<Button
                caption={buttons.accept.replace(/&/g, "")}
                id="accept"
                key="accept"
                isDefault={buttons.accept === buttons.default}
                onClick={this.handleActionClick}
            />);
        }

        if (buttons.refuse) {
            actions.push(<Button
                caption={buttons.refuse.replace(/&/g, "")}
                id="refuse"
                key="refuse"
                isDefault={buttons.refuse === buttons.default}
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
                onClose={this.handleClose}
            >
            </Dialog>
        );
    }

    private handleActionClick = (e: React.SyntheticEvent, props: Readonly<IComponentProperties>): void => {
        const { onClose } = this.props;
        const { values } = this.state;

        let closure;
        switch (props.id) {
            case "accept": {
                closure = DialogResponseClosure.Accept;
                break;
            }

            case "alternative": {
                closure = DialogResponseClosure.Alternative;
                break;
            }

            default: {
                closure = DialogResponseClosure.Decline;
                break;
            }
        }

        this.dialogRef.current?.close(closure === DialogResponseClosure.Decline);

        // Trigger onClose only if not cancelled, because we have to handle that specific situation in handleClose
        // (which is also triggered for closing via the escape key).
        if (closure !== DialogResponseClosure.Decline) {
            onClose?.(closure, values);
        }
    };

    private handleClose = (cancelled: boolean): void => {
        if (cancelled) {
            const { onClose } = this.mergedProps;
            const { values } = this.state;

            onClose?.(DialogResponseClosure.Decline, values);
        }
    };

}
