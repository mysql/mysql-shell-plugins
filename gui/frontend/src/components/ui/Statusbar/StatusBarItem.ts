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

/* eslint-disable jsdoc/no-undefined-types */ // Temporarily disabled. Will be fixed in a separate task.

import type { IAccessibilityInformation } from "../../../app-logic/general-types.js";
import type { ThemeColor } from "../../Theming/ThemeColor.js";

// Much of the code in this file is copied from the vscode API, to stay as close as possible to the original API.

export type UpdateFunction = (removeItem?: StatusBarItem) => void;

/** Represents the alignment of status bar items. */
export enum StatusBarAlignment {
    /** Aligned to the left side. */
    Left = 1,

    /** Aligned to the right side. */
    Right = 2
}

/**
 * A status bar item is a status bar contribution that can show text and icons and run a command on click.
 * Modelled after the VS Code StatusBarItem interface
 */
export interface IStatusBarItem extends IStatusBarItemOptions {
    /**
     * The identifier of this item.
     *
     * **Note**: if no identifier was provided by the `Statusbar.createStatusBarItem`
     * method, the identifier will be auto generated.
     */
    readonly id: string;

    /** The alignment of this item. */
    readonly alignment: StatusBarAlignment;

    /**
     * The priority of this item. Higher value means the item should be shown more to the left.
     * Items with the same priority are displayed from left to right in the order they were added.
     */
    readonly priority?: number;

    /**
     * The name of the entry, like 'Python Language Indicator', 'Git Status' etc.
     * Try to keep the length of the name short, yet descriptive enough that
     * users can understand what the status bar item is about.
     */
    name?: string;

    /**
     * The text to show for the entry. You can embed icons in the text by leveraging the syntax:
     *
     * `My text $(icon-name) contains icons like $(icon-name) this one.`
     *
     * Where the icon-name is taken from the ThemeIcon
     * [icon set](https://code.visualstudio.com/api/references/icons-in-labels#icon-listing), e.g.
     * `light-bulb` etc.
     */
    text: string;

    /** The tooltip text when you hover over this entry. */
    tooltip?: string;

    /** The foreground color for this entry. */
    color?: string | ThemeColor;

    /**
     * The background color for this entry.
     *
     * **Note**: only the following colors are supported:
     * `new ThemeColor('statusBarItem.errorBackground')`
     * `new ThemeColor('statusBarItem.warningBackground')`
     *
     * More background colors may be supported in the future.
     *
     * **Note**: when a background color is set, the statusbar may override
     * the `color` choice to ensure the entry is readable in all themes.
     */
    backgroundColor?: ThemeColor;

    /**
     *
     * {@linkcode Command} or identifier of a command to run on click.
     *
     * Note that if this is a {@linkcode Command} object, only the {@linkcode Command.command command}
     * and {@linkcode Command.arguments arguments} are used by the editor.
     */
    command?: string;

    /**
     * **Note**: This field is not used currently.
     *
     * Accessibility information used when a screen reader interacts with this StatusBar item.
     */
    accessibilityInformation?: IAccessibilityInformation;

    /** When given the item is automatically hidden after that timeout. */
    timeout?: number;

    /** Whether the entry is visible. */
    visible: boolean;

    /** Shows the entry in the status bar. */
    show(): void;

    /** Hide the entry in the status bar. */
    hide(): void;

    /** Dispose and free associated resources. */
    dispose(): void;
}

export interface IStatusBarItemOptions {
    id?: string;
    text?: string;
    tooltip?: string;
    command?: string;
    alignment?: StatusBarAlignment;
    priority?: number;
    timeout?: number;
}

export class StatusBarItem implements IStatusBarItem {
    public readonly id: string;
    public readonly alignment: StatusBarAlignment;
    public readonly priority?: number;

    public name?: string;
    public tooltip?: string;
    public color?: string | ThemeColor;
    public backgroundColor: ThemeColor | undefined;
    public command?: string;
    public accessibilityInformation?: IAccessibilityInformation;

    static #nextId = 0;

    #visible: boolean;
    #text = "";
    #timeout: number | undefined;

    public constructor(private update: UpdateFunction, options: IStatusBarItemOptions) {
        this.id = options.id ?? `statusBarItem.${StatusBarItem.#nextId++}`;
        this.text = options.text ?? "";
        this.tooltip = options.tooltip;
        this.command = options.command;
        this.alignment = options.alignment ?? StatusBarAlignment.Left;
        this.priority = options.priority;
        this.#visible = true;
        this.#timeout = options.timeout;
    }

    public get visible(): boolean {
        return this.#visible;
    }

    public get text(): string {
        return this.#text;
    }

    public set text(value: string) {
        this.#text = value;
        this.update();
    }

    public get timeout(): number | undefined {
        return this.#timeout;
    }

    public set timeout(value: number) {
        this.#timeout = value;
        this.update();
    }

    public show(): void {
        this.#visible = true;
        this.update();
    }

    public hide(): void {
        this.#visible = false;
        this.update();
    }

    public dispose(): void {
        this.update(this);
    }
}
