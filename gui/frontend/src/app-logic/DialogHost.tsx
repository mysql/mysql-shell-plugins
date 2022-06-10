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

import React from "react";

import {
    ConfirmDialog, DialogValueOption, IDialogSection, IDialogValues, PasswordDialog, ValueDialogBase, ValueEditDialog,
} from "../components/Dialogs";
import { Component } from "../components/ui";
import { MrsSchemaDialog } from "../modules/mrs/dialogs/MrsSchemaDialog";

import { MrsServiceDialog } from "../modules/mrs/dialogs/MrsServiceDialog";
import { requisitions } from "../supplement/Requisitions";
import { DialogResponseClosure, DialogType, IDialogRequest, IDialogResponse, IDictionary } from "./Types";

/**
 * A component to host certain application wide dialogs in a central place.
 * They are all accessible via requisitions.
 */
export class DialogHost extends Component {
    // Holds the currently running dialog type (only one of each type can run at the same time) and last
    // active HTML element, when this dialog was launched.
    private runningDialogs = new Map<DialogType, Element | null>();

    private dialogRefs = new Map<DialogType, React.RefObject<ValueDialogBase>>();

    // The value edit dialog is special, as it uses a different approach for editing complex values.
    private promptDialogRef = React.createRef<ValueEditDialog>();

    private confirmDialogRef = React.createRef<ConfirmDialog>();

    public constructor(props: {}) {
        super(props);

        requisitions.register("showDialog", this.showDialog);
    }

    public render(): React.ReactNode {
        const dialogs: React.ReactNode[] = [
            // The password dialog has it's own command handling. Just host it here.
            <PasswordDialog key="passwordDialog" />,

            // The value edit dialog has a different value handling, so it's not added to the dialogRefs list.
            <ValueEditDialog
                key="valueEditDialog"
                ref={this.promptDialogRef}
                onClose={this.handlePromptDialogClose}
            />,

            <ConfirmDialog
                key="confirmDialog"
                ref={this.confirmDialogRef}
                onClose={this.handleDialogClose.bind(this, DialogType.Confirm)}
            />,
        ];

        const ref1 = React.createRef<MrsServiceDialog>();
        this.dialogRefs.set(DialogType.MrsService, ref1);
        dialogs.push(<MrsServiceDialog
            key="mrsServiceDialog"
            ref={ref1}
            onClose={this.handleDialogClose.bind(this, DialogType.MrsService)}
        />);

        const ref2 = React.createRef<MrsSchemaDialog>();
        this.dialogRefs.set(DialogType.MrsSchema, ref2);
        dialogs.push(<MrsSchemaDialog
            ref={ref2}
            onClose={this.handleDialogClose.bind(this, DialogType.MrsSchema)}
        />);

        return (
            <>
                {dialogs}
            </>
        );
    }

    private showDialog = (request: IDialogRequest): Promise<boolean> => {
        // Check if a dialog of the given type is already active.
        // Only one of each type can be active at any time.
        if (!this.runningDialogs.has(request.type)) {
            switch (request.type) {
                case DialogType.Prompt: {
                    this.runPromptDialog(request);

                    return Promise.resolve(true);
                }

                case DialogType.Confirm: {
                    this.runConfirmDialog(request);

                    return Promise.resolve(true);
                }

                case DialogType.Select: {
                    this.runSelectDialog(request);

                    return Promise.resolve(true);
                }

                default: { // All dialogs with the base value editor return signature.
                    const ref = this.dialogRefs.get(request.type);
                    if (ref && ref.current) {
                        this.runningDialogs.set(request.type, document.activeElement);
                        ref.current.show(request, request.title);

                        return Promise.resolve(true);
                    }

                    break;
                }
            }
        }

        return Promise.resolve(false);
    };

    /**
     * Configures and runs a value edit dialog with a single section to let the user input a single value.
     *
     * Supported entries in the request are:
     *   - request.title The dialog's title.
     *   - request.values.prompt A caption for the input field.
     *   - request.data: A dictionary that is forwarded to the response handler.
     *
     * @param request The request with the data for the dialog.
     */
    private runPromptDialog = (request: IDialogRequest): void => {
        this.runningDialogs.set(DialogType.Prompt, document.activeElement);

        const promptSection: IDialogSection = {
            values: {
                input: {
                    caption: request.values?.prompt as string,
                    value: "",
                    span: 8,
                    options: [DialogValueOption.AutoFocus],
                },
            },
        };

        this.promptDialogRef.current?.show(
            {
                id: request.id,
                sections: new Map<string, IDialogSection>([
                    ["prompt", promptSection],
                ]),
            },
            {
                options: { backgroundOpacity: 0.5 },
                title: request.title ?? "Feedback Requested",
                description: request.description,
            },
            { ...request.data, type: request.type },
        );
    };

    /**
     * Configures and runs a confirmation dialog.
     *
     * Supported entries in the request are:
     *   - parameters.title The dialog's title.
     *   - parameters.prompt The text to show for the confirmation.
     *   - parameters.accept Optional text for the accept button (default: "OK").
     *   - parameters.refuse Optional text for the refuse button (default: "Cancel").
     *   - parameters.alternative Optional text for the accept button (no default).
     *   - parameters.default Optional text for the button that should be auto focused.
     *   - request.data: A dictionary that is forwarded to the response handler.
     *
     * @param request The request with the data for the dialog.
     */
    private runConfirmDialog = (request: IDialogRequest): void => {
        this.runningDialogs.set(DialogType.Confirm, document.activeElement);

        this.confirmDialogRef.current?.show(
            request.parameters?.prompt as string ?? "",
            {
                accept: request.parameters?.accept as string ?? "",
                refuse: request.parameters?.refuse as string ?? "",
                alternative: request.parameters?.alternative as string,
                default: request.parameters?.default as string,
            },
            request.parameters?.title as string,
            request.description,
            { ...request.data, type: request.type },
        );
    };

    /**
     * Configures and runs a selection dialog.
     *
     * Supported entries in the request are:
     *   - parameters.title The dialog's title.
     *   - parameters.prompt The text to show for the confirmation.
     *   - parameters.default Optional text for the button that should be auto focused.
     *   - parameters.options The list of values from which one must be selected.
     *   - request.data: A dictionary that is forwarded to the response handler.
     *
     * @param request The request with the data for the dialog.
     */
    private runSelectDialog = (request: IDialogRequest): void => {
        this.runningDialogs.set(DialogType.Select, document.activeElement);

        const promptSection: IDialogSection = {
            values: {},
        };

        request.description?.forEach((entry, index) => {
            promptSection.values[`description${index}`] = {
                value: entry,
                span: 8,
                options: [DialogValueOption.Description],
            };
        });

        const choices = request.parameters?.options as string[];
        const defaultValue: number | undefined = request.parameters?.default as number;
        promptSection.values.input = {
            caption: request.parameters?.prompt as string,
            value: defaultValue === undefined ? "" : choices[defaultValue - 1], // One-based value.
            span: 8,
            choices,
        };

        this.promptDialogRef.current?.show(
            {
                id: request.id,
                sections: new Map<string, IDialogSection>([
                    ["prompt", promptSection],
                ]),
            },
            {
                options: { backgroundOpacity: 0.5 },
                title: request.title ?? "Feedback Requested",
            },
            { ...request.data, type: request.type },
        );
    };

    private handleDialogClose = (type: DialogType, closure: DialogResponseClosure, data?: IDictionary): void => {
        const element = this.runningDialogs.get(type);
        this.runningDialogs.delete(type);

        const response: IDialogResponse = {
            type,
            closure,
            data,
        };

        void requisitions.execute("dialogResponse", response);

        if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
            element.focus();
        }
    };

    private handlePromptDialogClose = (closure: DialogResponseClosure, values: IDialogValues,
        data?: IDictionary): void => {

        const type = data?.type as DialogType ?? DialogType.Prompt;
        const element = this.runningDialogs.get(type);
        this.runningDialogs.delete(type);

        const promptSection = values.sections.get("prompt");
        if (promptSection) {
            let text = promptSection.values.input.value as string;
            if (type === DialogType.Select) {
                // Convert the text to an index in the choice list.
                const index = promptSection.values.input.choices?.findIndex((value) => {
                    return value === text;
                }) ?? -1;

                if (index > -1) {
                    text = String(index + 1);
                }
            }

            const response: IDialogResponse = {
                type: data?.type as DialogType,
                closure,
                values: {
                    input: text,
                },
                data,
            };

            void requisitions.execute("dialogResponse", response);
        }

        if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
            element.focus();
        }
    };

}
