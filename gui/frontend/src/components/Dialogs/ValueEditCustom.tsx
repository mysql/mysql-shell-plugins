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

import { ComponentChild } from "preact";

import { IDictionary } from "../../app-logic/general-types.js";
import { ComponentBase, IComponentProperties, IComponentState } from "../ui/Component/ComponentBase.js";

/**
 * The properties of the ValueEditCustom class used as a custom control that can be embedded into a ValueEditDialog.
 */
export interface IValueEditCustomProperties extends IComponentProperties {
    values?: IDictionary;
    onDataChange?: (data: IDictionary, callback?: () => void) => void;
}

/** The base component for content that can be embedded into a ValueEditDialog. */
export class ValueEditCustom<P extends IValueEditCustomProperties, S extends IComponentState>
    extends ComponentBase<P, S> {
    /**
     * The default render function, which returns null. Descendants must return actual content.
     *
     * @returns null
     */
    public render(): ComponentChild {
        return null;
    }
}
