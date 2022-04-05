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

import { IDialogSection, IDialogValues, PasswordDialog, ValueDialogBase, ValueEditDialog } from "../components/Dialogs";
import { Component } from "../components/ui";
import { MrsSchemaDialog } from "../modules/mrs/dialogs/MrsSchemaDialog";

import { MrsServiceDialog } from "../modules/mrs/dialogs/MrsServiceDialog";
import { requisitions } from "../supplement/Requisitions";
import { DialogType, IDialogRequest, IDialogResponse, IDictionary } from "./Types";

// A component to host all application wide accessible dialogs.
export class DialogHost extends Component {

    private runningDialogs = new Set<DialogType>();
    private dialogRefs = new Map<DialogType, React.RefObject<ValueDialogBase>>();

    // The value edit dialog is special, as it uses a different approach for editing complex values.
    private promptDialogRef = React.createRef<ValueEditDialog>();

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
                caption="Feedback Requested"
                ref={this.promptDialogRef}
                onClose={this.handlePromptDialogClose}
            />,
        ];

        let ref = React.createRef<ValueDialogBase>();
        this.dialogRefs.set(DialogType.MrsService, ref);
        dialogs.push(<MrsServiceDialog
            key="mrsServiceDialog"
            ref={ref as React.RefObject<MrsServiceDialog>}
            onClose={this.handleDialogClose.bind(this, DialogType.MrsService)}
        />);

        ref = React.createRef<ValueDialogBase>();
        this.dialogRefs.set(DialogType.MrsSchema, ref);
        dialogs.push(<MrsSchemaDialog
            ref={ref as React.RefObject<MrsSchemaDialog>}
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
            this.runningDialogs.add(request.type);
            if (request.type === DialogType.Prompt) {
                this.runPromptDialog(request);

                return Promise.resolve(true);
            } else {
                const ref = this.dialogRefs.get(request.type);
                if (ref && ref.current) {
                    ref.current.show(request, request.title);

                    return Promise.resolve(true);
                }
            }
        }

        return Promise.resolve(false);
    };

    /**
     * Configures a value edit dialog with a single section to let the user input a single value.
     * Support entries in the request are:
     * - values.prompt A caption for the input field.
     * - values.payload: A value that is forwarded to the response handler.
     *
     * @param request The request with the data for the dialog.
     */
    private runPromptDialog = (request: IDialogRequest): void => {
        const promptSection: IDialogSection = {
            values: {
                input: {
                    caption: request.values?.prompt as string,
                    value: "",
                    span: 8,
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
            [],
            { backgroundOpacity: 0.1 },
            "",
            undefined,
            request.data,
        );

    };

    private handleDialogClose = (type: DialogType, accepted: boolean, values?: IDictionary): void => {
        if (this.runningDialogs.has(type)) {
            this.runningDialogs.delete(type);

            const response: IDialogResponse = {
                type,
                accepted,
                values,
            };

            void requisitions.execute("dialogResponse", response);
        }
    };

    private handlePromptDialogClose = (accepted: boolean, values: IDialogValues, data?: IDictionary): void => {
        const type = DialogType.Prompt;
        if (this.runningDialogs.has(type)) {

            this.runningDialogs.delete(type);

            const promptSection = values.sections.get("prompt");
            if (promptSection) {
                const response: IDialogResponse = {
                    type,
                    accepted,
                    values: {
                        input: promptSection.values.input.value as string,
                    },
                    data,
                };

                void requisitions.execute("dialogResponse", response);
            }
        }
    };

}
