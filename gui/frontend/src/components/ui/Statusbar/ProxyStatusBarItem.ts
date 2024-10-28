/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

import type { IAccessibilityInformation } from "../../../app-logic/general-types.js";
import type { IUpdateStatusBarItem } from "../../../supplement/RequisitionTypes.js";
import { requisitions } from "../../../supplement/Requisitions.js";
import type { ThemeColor } from "../../Theming/ThemeColor.js";
import { IStatusBarItem, IStatusBarItemOptions, StatusBarAlignment } from "./StatusBarItem.js";

/**
 * This class is used instead of a normal status bar item when the app is embedded. Instead of using the local
 * status bar implementation, this class is used to create a status bar item on the host and update it.
 */
export class ProxyStatusBarItem implements IStatusBarItem {

    public name?: string;
    public color?: string | ThemeColor;
    public backgroundColor: ThemeColor | undefined;
    public command?: string;
    public accessibilityInformation?: IAccessibilityInformation;

    static #nextId = 0;

    #id: string;
    #alignment: StatusBarAlignment;
    #tooltip?: string;
    #text = "";
    #visible: boolean = true;
    #priority?: number;
    #timeout?: number;

    public constructor(options: IStatusBarItemOptions) {
        this.#id = "msg." + (options.id ?? `statusBarItem.${ProxyStatusBarItem.#nextId++}`);
        this.#text = options.text ?? "";
        this.#alignment = options.alignment ?? StatusBarAlignment.Left;
        this.#priority = options.priority;
        this.#timeout = options.timeout;
        this.show();
    }

    public get id(): string {
        return this.#id;
    }

    public get alignment(): StatusBarAlignment {
        return this.#alignment;
    }

    public get visible(): boolean {
        return this.#visible;
    }

    public get priority(): number | undefined {
        return this.#priority;
    }

    public get timeout(): number | undefined {
        return this.#timeout;
    }

    public get text(): string {
        return this.#text;
    }

    public set text(value: string) {
        this.#text = value;
        const details: IUpdateStatusBarItem = {
            id: this.id,
            state: "show",
            text: this.#text,
            tooltip: this.#tooltip,
            alignment: this.alignment,
            priority: this.priority,
        };

        requisitions.executeRemote("updateStatusBarItem", details);
    }

    public show(): void {
        const details: IUpdateStatusBarItem = {
            id: this.id,
            state: "show",
            text: this.#text,
            tooltip: this.#tooltip,
            timeout: this.timeout,
            alignment: this.alignment,
            priority: this.priority,
        };

        requisitions.executeRemote("updateStatusBarItem", details);
    }

    public hide(): void {
        const details: IUpdateStatusBarItem = {
            id: this.id,
            state: "hide",
        };

        requisitions.executeRemote("updateStatusBarItem", details);
    }

    public dispose(): void {
        const details: IUpdateStatusBarItem = {
            id: this.id,
            state: "dispose",
        };

        requisitions.executeRemote("updateStatusBarItem", details);
    }
}
