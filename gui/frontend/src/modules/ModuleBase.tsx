/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

// Note: we are not using our own Component from UI, by intention.
import React, { Component } from "react";

import { IDictionary } from "../app-logic/Types";

export interface IModuleInfo {
    id: string;
    caption: string;
    icon: string;
}

export interface IModuleProperties {
    // The reference of the host HTML element for this module.
    innerRef?: React.RefObject<HTMLElement>;
}

export type IModuleState = IDictionary;

/** The base class for registerable modules. */
export class ModuleBase<P extends IModuleProperties, S extends IModuleState = {}, SS = unknown>
    extends Component<P, S, SS> {

    public static get info(): IModuleInfo { // Will be overridden by custom modules.
        return {
            id: "base-module",
            caption: "Base Module",
            icon: "",
        };
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
