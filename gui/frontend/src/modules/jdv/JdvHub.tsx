/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

import { ComponentChild, createRef, RefObject } from "preact";

import { DialogResponseClosure, IDialogRequest, JdvDialogType } from "../../app-logic/general-types.js";
import { ui } from "../../app-logic/UILayer.js";
import { AwaitableValueEditDialog } from "../../components/Dialogs/AwaitableValueEditDialog.js";
import { ComponentBase } from "../../components/ui/Component/ComponentBase.js";
import { requisitions } from "../../supplement/Requisitions.js";
import { IJdvEditRequest } from "../../supplement/RequisitionTypes.js";
import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { convertErrorToString, uuidBinary16Base64 } from "../../utilities/helpers.js";
import { JdvObjectDialog } from "./dialogs/JdvObjectDialog.js";

type DialogConstructor = new (props: {}) => AwaitableValueEditDialog;

interface IJdvEditObjectData extends IDictionary {
    name: string;
    schema: string;
    sql: string;
}

/** A component to host all JDV dialogs of the application and the handling of dialog results. */
export class JdvHub extends ComponentBase {
    // Lists the dialog types and their corresponding dialog components.
    // These dialogs are registered and instantiated in the render() method.
    private static readonly dialogTypes = new Map<JdvDialogType, DialogConstructor>([
        [JdvDialogType.JdvObject, JdvObjectDialog],
    ]);

    // Holds the currently running dialog type (only one of each type can run at the same time) and last
    // active HTML element, when this dialog was launched.
    private runningDialogs = new Map<JdvDialogType, Element | null>();
    private dialogRefs = new Map<JdvDialogType, RefObject<AwaitableValueEditDialog>>();

    public render(): ComponentChild {
        const dialogs: ComponentChild[] = [];

        // The name of the variable must be PascalCase for JSX.
        // eslint-disable-next-line @typescript-eslint/naming-convention
        JdvHub.dialogTypes.forEach((Dialog: DialogConstructor, type) => {
            const ref = createRef<InstanceType<typeof Dialog>>();
            this.dialogRefs.set(type, ref);

            dialogs.push(<Dialog
                key={Dialog.name}
                ref={ref}
            />);
        });

        return (
            <>
                {dialogs}
            </>
        );
    }

    /**
     * Shows a dialog to create a new or edit an existing jdv.
     *
     * @param backend The interface for sending the requests.
     * @param request Details about the jdv to edit.
     *
     * @returns A promise resolving when the dialog was closed. Always resolves to true to indicate the request
     *          was handled.
     */
    public async showJdvObjectDialog(backend: ShellInterfaceSqlEditor,
        request: IJdvEditRequest): Promise<boolean> {

        const jdvViewInfo = request.jdvViewInfo;
        const dialogRequest = {
            id: "jdvObjectDialog",
            type: JdvDialogType.JdvObject,
            title: "Json Duality View Builder",
            values: {
                id: uuidBinary16Base64(),
                name: jdvViewInfo.name,
                schemaName: jdvViewInfo.schema,
                rootTableName: jdvViewInfo.rootTableName,
                rootTableSchemaName: jdvViewInfo.rootTableSchema,
                objects: jdvViewInfo.objects,
                payload: {
                    backend,
                    jdvViewInfo,
                    createView: request.createView,
                },
            },
        };

        const result = await this.showDialog(dialogRequest);
        if (result === DialogResponseClosure.Cancel) {
            return true;
        }

        const data = result as IJdvEditObjectData;

        try {
            await backend.execute(data.sql);
            requisitions.executeRemote("refreshConnection", undefined);
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Jdv ${data.name} could not be created: ${message}`, {});

            return true;
        }

        return true;
    }

    private showDialog = (request: IDialogRequest): Promise<IDictionary | DialogResponseClosure> => {
        // Check if a dialog of the given type is already active.
        // Only one of each type can be active at any time.
        const type = request.type as JdvDialogType;
        if (!this.runningDialogs.has(type)) {
            const ref = this.dialogRefs.get(type);
            if (ref?.current) {
                this.runningDialogs.set(type, document.activeElement);
                const result = ref.current.show(request);

                const element = this.runningDialogs.get(type);
                this.runningDialogs.delete(type);

                if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
                    element.focus();
                }

                return result;
            }
        }

        return Promise.resolve(DialogResponseClosure.Cancel);
    };

}
