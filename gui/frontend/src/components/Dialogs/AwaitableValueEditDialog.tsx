/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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

import { DialogResponseClosure, IDialogRequest, IDictionary } from "../../app-logic/general-types.js";
import { Semaphore } from "../../supplement/Semaphore.js";
import { ComponentBase } from "../ui/Component/ComponentBase.js";
import { IDialogValidations, IDialogValues, IValueEditDialogShowOptions, ValueEditDialog } from "./ValueEditDialog.js";

export interface IAwaitableDialogResult {
    values: IDialogValues;
    closure: DialogResponseClosure;
}

/**
 * A dialog implementation that provides the necessary tools to allow derived dialogs to return their results to a
 * waiting customer directly. This allows to chain multiple dialogs together.
 */
export class AwaitableValueEditDialog extends ComponentBase {
    #dialogRef = createRef<ValueEditDialog>();
    #signal?: Semaphore<IAwaitableDialogResult>;

    /** @returns a unique ID for this dialog instance. */
    protected get id(): string {
        return "";
    }

    public get dialog(): ValueEditDialog | null {
        return this.#dialogRef.current;
    }

    public render(): ComponentChild {
        return (
            <ValueEditDialog
                ref={this.#dialogRef}
                id={this.id}
                onClose={this.handleCloseDialog}
                onValidate={this.validateInput}
            />
        );
    }

    /**
     * Will be overwritten by descendants.
     *
     * @param request The request to show the dialog.
     *
     * @returns A promise resolving to DialogResponseClosure.Cancel.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public show(request: IDialogRequest): Promise<IDictionary | DialogResponseClosure> {
        return Promise.resolve(DialogResponseClosure.Cancel);
    }

    protected async doShow(valueFactory: () => IDialogValues | undefined,
        options?: IValueEditDialogShowOptions): Promise<IAwaitableDialogResult> {
        this.#signal = new Semaphore();
        this.#dialogRef.current?.show(valueFactory(), options);

        const result = await this.#signal.wait();
        this.#signal = undefined;

        return result;
    }

    /**
     * Will be overwritten by descendants.
     *
     * @param closing Indicates whether the dialog is closing or not.
     * @param values The current values of the dialog.
     *
     * @returns A dictionary of validation messages.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected validateInput = (closing: boolean, values: IDialogValues): IDialogValidations => {
        return { messages: {} };
    };

    private handleCloseDialog = (closure: DialogResponseClosure, values: IDialogValues): void => {
        this.#signal?.notify({ closure, values });
    };
}
