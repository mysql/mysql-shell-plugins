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

import { ComponentChild, createRef } from "preact";

import { ComponentBase } from "../components/ui/Component/ComponentBase.js";
import { requisitions } from "../supplement/Requisitions.js";
import {
    DialogResponseClosure, DialogType, IDialogRequest, IDialogResponse, IDictionary, MdsDialogType,
} from "./general-types.js";
import { ConfirmDialog } from "../components/Dialogs/ConfirmDialog.js";
import { PasswordDialog } from "../components/Dialogs/PasswordDialog.js";
import { MrsAuthDialog } from "../modules/mrs/dialogs/MrsAuthDialog.js";
import {
    ValueEditDialog, IDialogSection, CommonDialogValueOption, IDialogValues, IChoiceDialogValue,
} from "../components/Dialogs/ValueEditDialog.js";
import { Semaphore } from "../supplement/Semaphore.js";
import { MdsHWClusterDialog } from "../modules/mds/dialogs/MdsHWClusterDialog.js";
import { MdsHWLoadDataDialog } from "../modules/mds/dialogs/MdsHWLoadDataDialog.js";
import { MdsEndpointDialog } from "../modules/mds/dialogs/MdsEndpointDialog.js";

/**
 * A component to host certain application wide common dialogs in a central place.
 * They are all accessible via requisitions.
 */
export class DialogHost extends ComponentBase {
    static #instance: DialogHost;

    // Used like stack. Last element is the element which was focused before the dialog was opened.
    #focusedElements: Array<Element | null> = [];

    #promptDialogRef = createRef<ValueEditDialog>();

    // Tri-state: undefined = not active, null = active (use requisitions, assigned = active (use this)).
    #promptDialogSignal: Semaphore<IDialogResponse> | undefined | null;

    #confirmDialogRef = createRef<ConfirmDialog>();
    #confirmDialogSignal: Semaphore<IDialogResponse> | undefined | null;

    #mdsClusterDialogRef = createRef<MdsHWClusterDialog>();
    #mdsLoadDataDialogRef = createRef<MdsHWLoadDataDialog>();
    #mdsEndpointDialogRef = createRef<MdsEndpointDialog>();

    public constructor(props: {}) {
        // Make the DialogHost a singleton and allow access to it via class methods.
        if (DialogHost.#instance) {
            return DialogHost.#instance;
        }

        super(props);
        DialogHost.#instance = this;

        requisitions.register("showDialog", this.showDialogNoWait);
    }

    /**
     * Directly shows one of the standard dialog and allows to wait for the user's response.
     *
     * @param request The request with the data for the dialog.
     *
     * @returns A promise which resolves to the user's response.
     */
    public static showDialog = async (request: IDialogRequest): Promise<IDialogResponse> => {
        switch (request.type) {
            case DialogType.Prompt: {
                if (this.#instance.#promptDialogSignal !== undefined) {
                    throw new Error("Prompt dialog already active.");
                }

                this.#instance.#promptDialogSignal = new Semaphore<IDialogResponse>();
                this.#instance.runPromptDialog(request);

                return this.#instance.#promptDialogSignal.wait();
            }

            case DialogType.Confirm: {
                if (this.#instance.#confirmDialogSignal !== undefined) {
                    throw new Error("Confirm dialog already active.");
                }

                this.#instance.#confirmDialogSignal = new Semaphore<IDialogResponse>();
                this.#instance.runConfirmDialog(request);

                return this.#instance.#confirmDialogSignal.wait();
            }

            case DialogType.Select: {
                // Both selection and prompt dialogs use the signal.
                if (this.#instance.#promptDialogSignal !== undefined) {
                    throw new Error("Select dialog already active.");
                }

                this.#instance.#promptDialogSignal = new Semaphore<IDialogResponse>();
                this.#instance.runSelectDialog(request);

                return this.#instance.#promptDialogSignal.wait();
            }

            default: {
                throw new Error(`Unknown dialog type: ${request.type}`);
            }
        }
    };

    public render(): ComponentChild {
        const dialogs: ComponentChild[] = [
            // The password dialog has it's own command handling. Just host it here.
            <PasswordDialog key="passwordDialog" />,

            // The MRS auth dialog has it's own command handling. Just host it here.
            <MrsAuthDialog key="mrsAuthDialog" />,

            <ValueEditDialog
                key="promptDialog"
                ref={this.#promptDialogRef}
                onClose={this.handlePromptDialogClose}
            />,

            <ConfirmDialog
                key="confirmDialog"
                ref={this.#confirmDialogRef}
                onClose={this.handleConfirmDialogClose.bind(this, DialogType.Confirm)}
            />,
        ];

        this.#mdsClusterDialogRef = createRef<MdsHWClusterDialog>();
        dialogs.push(<MdsHWClusterDialog
            ref={this.#mdsClusterDialogRef}
            onClose={this.handleDialogClose.bind(this, MdsDialogType.MdsHeatWaveCluster)}
        />);

        this.#mdsLoadDataDialogRef = createRef<MdsHWLoadDataDialog>();
        dialogs.push(<MdsHWLoadDataDialog
            ref={this.#mdsLoadDataDialogRef}
            onClose={this.handleDialogClose.bind(this, MdsDialogType.MdsHeatWaveLoadData)}
        />);

        this.#mdsEndpointDialogRef = createRef<MdsEndpointDialog>();
        dialogs.push(<MdsEndpointDialog
            ref={this.#mdsEndpointDialogRef}
            onClose={this.handleDialogClose.bind(this, MdsDialogType.MdsEndpoint)}
        />);

        return (
            <>
                {dialogs}
            </>
        );
    }

    /**
     * Triggered by the `showDialog` requisition. It shows a dialog without waiting for a response. Instead the response
     * is posted by the `handlePromptDialogClose` method, in form of another requisition call.
     *
     * @param request The request with the data for the dialog.
     *
     * @returns A promise which resolves to `true` if the dialog was shown, or `false` if a dialog of the given type
     *         is already active or no dialog exists for the given request type.
     */
    private showDialogNoWait = (request: IDialogRequest): Promise<boolean> => {
        switch (request.type) {
            case DialogType.Prompt: {
                if (this.#promptDialogSignal === undefined) {
                    this.#promptDialogSignal = null;
                    this.runPromptDialog(request);

                    return Promise.resolve(true);
                }

                break;
            }

            case DialogType.Confirm: {
                if (this.#confirmDialogSignal === undefined) {
                    this.#confirmDialogSignal = null;
                    this.runConfirmDialog(request);

                    return Promise.resolve(true);
                }

                break;
            }

            case DialogType.Select: {
                if (this.#promptDialogSignal === undefined) {
                    this.#promptDialogSignal = null;
                    this.runSelectDialog(request);

                    return Promise.resolve(true);
                }

                break;
            }

            case MdsDialogType.MdsHeatWaveCluster: {
                this.#focusedElements.push(document.activeElement);

                if (this.#mdsClusterDialogRef.current) {
                    void this.#mdsClusterDialogRef.current.show(request, request.title ?? "");

                    return Promise.resolve(true);
                }
                break;
            }


            case MdsDialogType.MdsHeatWaveLoadData: {
                this.#focusedElements.push(document.activeElement);

                if (this.#mdsLoadDataDialogRef.current) {
                    void this.#mdsLoadDataDialogRef.current.show(request, request.title ?? "");

                    return Promise.resolve(true);
                }
                break;
            }

            case MdsDialogType.MdsEndpoint: {
                this.#focusedElements.push(document.activeElement);

                if (this.#mdsEndpointDialogRef.current) {
                    void this.#mdsEndpointDialogRef.current.show(request, request.title ?? "");

                    return Promise.resolve(true);
                }
                break;
            }

            default:
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
        this.#focusedElements.push(document.activeElement);

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

        this.#promptDialogRef.current?.show(
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
        this.#focusedElements.push(document.activeElement);

        this.#confirmDialogRef.current?.show(
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
        this.#focusedElements.push(document.activeElement);

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

        this.#promptDialogRef.current?.show(
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

    private handleConfirmDialogClose = (type: DialogType, closure: DialogResponseClosure,
        data?: IDictionary): void => {
        const element = this.#focusedElements.pop();

        const response: IDialogResponse = {
            id: data?.id as string ?? "",
            type,
            closure,
            data,
        };

        if (this.#confirmDialogSignal) {
            this.#confirmDialogSignal.notifyAll(response);
        } else {
            void requisitions.execute("dialogResponse", response);
        }
        this.#confirmDialogSignal = undefined;

        if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
            element.focus();
        }
    };

    private handlePromptDialogClose = (closure: DialogResponseClosure, values: IDialogValues,
        data?: IDictionary): void => {

        const type = data?.type as DialogType ?? DialogType.Prompt;
        const element = this.#focusedElements.pop();

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

            if (this.#promptDialogSignal) {
                this.#promptDialogSignal.notifyAll(response);
            } else {
                void requisitions.execute("dialogResponse", response);
            }
            this.#promptDialogSignal = undefined;
        }

        if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
            element.focus();
        }
    };

    private handleDialogClose = (type: MdsDialogType, closure: DialogResponseClosure, data?: IDictionary): void => {
        const element = this.#focusedElements.pop();

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
}
