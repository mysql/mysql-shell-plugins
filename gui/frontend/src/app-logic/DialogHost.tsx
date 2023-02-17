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

import { ComponentChild, createRef, RefObject } from "preact";

import { ComponentBase } from "../components/ui/Component/ComponentBase";
import { MdsHWClusterDialog } from "../modules/mds/dialogs/MdsHWClusterDialog";
import { MdsHWLoadDataDialog } from "../modules/mds/dialogs/MdsHWLoadDataDialog";
import { MrsDbObjectDialog } from "../modules/mrs/dialogs/MrsDbObjectDialog";
import { MrsSchemaDialog } from "../modules/mrs/dialogs/MrsSchemaDialog";
import { MrsServiceDialog } from "../modules/mrs/dialogs/MrsServiceDialog";
import { MrsContentSetDialog } from "../modules/mrs/dialogs/MrsContentSetDialog";
import { MrsAuthenticationAppDialog } from "../modules/mrs/dialogs/MrsAuthenticationAppDialog";
import { MrsUserDialog } from "../modules/mrs/dialogs/MrsUserDialog";
import { requisitions } from "../supplement/Requisitions";
import { DialogResponseClosure, DialogType, IDialogRequest, IDialogResponse, IDictionary } from "./Types";
import { ConfirmDialog } from "../components/Dialogs/ConfirmDialog";
import { PasswordDialog } from "../components/Dialogs/PasswordDialog";
import { ValueDialogBase } from "../components/Dialogs/ValueDialogBase";
import {
    ValueEditDialog, IDialogSection, CommonDialogValueOption, IDialogValues, IChoiceDialogValue,
} from "../components/Dialogs/ValueEditDialog";

/**
 * A component to host certain application wide dialogs in a central place.
 * They are all accessible via requisitions.
 */
export class DialogHost extends ComponentBase {
    // Holds the currently running dialog type (only one of each type can run at the same time) and last
    // active HTML element, when this dialog was launched.
    private runningDialogs = new Map<DialogType, Element | null>();

    private dialogRefs = new Map<DialogType, RefObject<ValueDialogBase>>();

    // The value edit dialog is special, as it uses a different approach for editing complex values.
    private promptDialogRef = createRef<ValueEditDialog>();

    private confirmDialogRef = createRef<ConfirmDialog>();

    public constructor(props: {}) {
        super(props);

        requisitions.register("showDialog", this.showDialog);
    }

    public render(): ComponentChild {
        const dialogs: ComponentChild[] = [
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

        const refMrs1 = createRef<MrsServiceDialog>();
        this.dialogRefs.set(DialogType.MrsService, refMrs1);
        dialogs.push(<MrsServiceDialog
            key="mrsServiceDialog"
            ref={refMrs1}
            onClose={this.handleDialogClose.bind(this, DialogType.MrsService)}
        />);

        const refMrs2 = createRef<MrsSchemaDialog>();
        this.dialogRefs.set(DialogType.MrsSchema, refMrs2);
        dialogs.push(<MrsSchemaDialog
            key="mrsSchemaDialog"
            ref={refMrs2}
            onClose={this.handleDialogClose.bind(this, DialogType.MrsSchema)}
        />);

        const refMrs3 = createRef<MrsDbObjectDialog>();
        this.dialogRefs.set(DialogType.MrsDbObject, refMrs3);
        dialogs.push(<MrsDbObjectDialog
            key="mrsDbObjectDialog"
            ref={refMrs3}
            onClose={this.handleDialogClose.bind(this, DialogType.MrsDbObject)}
        />);

        const refMrs4 = createRef<MrsContentSetDialog>();
        this.dialogRefs.set(DialogType.MrsContentSet, refMrs4);
        dialogs.push(<MrsContentSetDialog
            key="mrsContentSetDialog"
            ref={refMrs4}
            onClose={this.handleDialogClose.bind(this, DialogType.MrsContentSet)}
        />);

        const refMrs5 = createRef<MrsAuthenticationAppDialog>();
        this.dialogRefs.set(DialogType.MrsAuthenticationApp, refMrs5);
        dialogs.push(<MrsAuthenticationAppDialog
            key="mrsAuthenticationAppDialog"
            ref={refMrs5}
            onClose={this.handleDialogClose.bind(this, DialogType.MrsAuthenticationApp)}
        />);

        const refMrs6 = createRef<MrsUserDialog>();
        this.dialogRefs.set(DialogType.MrsUser, refMrs6);
        dialogs.push(<MrsUserDialog
            key="mrsUserDialog"
            ref={refMrs6}
            onClose={this.handleDialogClose.bind(this, DialogType.MrsUser)}
        />);

        const refMds1 = createRef<MdsHWClusterDialog>();
        this.dialogRefs.set(DialogType.MdsHeatWaveCluster, refMds1);
        dialogs.push(<MdsHWClusterDialog
            ref={refMds1}
            onClose={this.handleDialogClose.bind(this, DialogType.MdsHeatWaveCluster)}
        />);

        const refMds2 = createRef<MdsHWLoadDataDialog>();
        this.dialogRefs.set(DialogType.MdsHeatWaveLoadData, refMds2);
        dialogs.push(<MdsHWLoadDataDialog
            ref={refMds2}
            onClose={this.handleDialogClose.bind(this, DialogType.MdsHeatWaveLoadData)}
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
                    type: "text",
                    caption: request.values?.prompt as string,
                    value: "",
                    horizontalSpan: 8,
                    options: [CommonDialogValueOption.AutoFocus],
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
            { id: request.id, ...request.data, type: request.type },
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
            { id: request.id, ...request.data, type: request.type },
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
                type: "description",
                value: entry,
                horizontalSpan: 8,
            };
        });

        const choices = request.parameters?.options as string[];
        const defaultValue: number | undefined = request.parameters?.default as number;
        promptSection.values.input = {
            type: "choice",
            caption: request.parameters?.prompt as string,
            value: defaultValue === undefined ? "" : choices[defaultValue - 1], // One-based value.
            horizontalSpan: 8,
            choices,
            options: [CommonDialogValueOption.AutoFocus],
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
            { id: request.id, ...request.data, type: request.type },
        );
    };

    private handleDialogClose = (type: DialogType, closure: DialogResponseClosure, data?: IDictionary): void => {
        const element = this.runningDialogs.get(type);
        this.runningDialogs.delete(type);

        const response: IDialogResponse = {
            id: data?.id as string ?? "",
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
            const value = promptSection.values.input as IChoiceDialogValue;
            let text = promptSection.values.input.value as string;
            if (type === DialogType.Select) {
                // Convert the text to an index in the choice list.
                const index = value.choices?.findIndex((value) => {
                    return value === text;
                }) ?? -1;

                if (index > -1) {
                    text = String(index + 1);
                }
            }

            const response: IDialogResponse = {
                type: data?.type as DialogType,
                id: data?.id as string ?? "",
                closure,
                values: {
                    input: value.value,
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
