/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

import { Component, ComponentChild, ComponentChildren, Ref } from "preact";


export interface IModuleInfo {
    id: string;
    caption: string;
    icon: string;
}

export interface IModuleProperties {
    children?: ComponentChildren;
    ref?: Ref<HTMLDivElement>;

    // The reference of the host HTML element for this module.
    innerRef?: preact.RefObject<HTMLElement>;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IModuleState { }

/** The base class for registerable modules. */
export class ModuleBase<P extends IModuleProperties = IModuleProperties,
    S extends IModuleState = IModuleState> extends Component<P, S> {

    public static get info(): IModuleInfo { // Will be overridden by custom modules.
        return {
            id: "base-module",
            caption: "Base Module",
            icon: "",
        };
    }

    public render(): ComponentChild {
        return null;
    }

    /**
     * Promisified version of `setState`. This is the same code as in our own `Component` implementation.
     *
     * @param state The new state to set.
     *
     * @returns A promise which resolves when the `setState` action finished.
     */
    public setStatePromise<K extends keyof S>(
        state: ((prevState: Readonly<S>, props: Readonly<P>) => (Pick<S, K> | S | null)) | (Pick<S, K> | S | null),
    ): Promise<void> {
        return new Promise((resolve) => {
            super.setState(state, () => {
                resolve();
            });
        });
    }

}
