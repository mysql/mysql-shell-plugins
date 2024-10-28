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

import { IRequestTypeMap } from "../RequisitionTypes.js";

// Contains descriptions for all settings used in the application.
// Error handling is taken out of test coverage as errors can only be introduced by changing this file.

type SettingValueType = "string" | "boolean" | "number" | "list" | "choice" | "object" | "action";

interface ISettingParameters {
    members?: string[];
    choices?: Array<[string, string, string]>;
    range?: [number, number];
    action?: keyof IRequestTypeMap;
}

export interface ISettingValue {
    id: string;
    title: string;

    /** The part of the access path which determines this instance. */
    key: string;

    /** Settings without a description are not shown in the settings editor. */
    description: string;

    valueType: SettingValueType;
    defaultValue: unknown;

    /** Set to indicate that this value should not be shown normally (only when the user wants to see it). */
    advanced: boolean;

    parameters: ISettingParameters;
}

export interface ISettingCategory {
    id: string;
    title: string;
    key: string;
    description: string;

    values: ISettingValue[];
    children?: ISettingCategory[];
}

export const settingCategories: ISettingCategory = {
    key: "<root>",
    id: "",
    title: "<root>",
    description: "<root>",
    values: [],
    children: [],
};

/**
 * Splits the given path and traverses through the settings category tree to find the one addressed by that path.
 * If something is wrong while walking the tree, an error are raised.
 *
 * @param path The path in dot-notation for the wanted category. The last part of the path is used as identifier for a
 *             new entry and hence is not taken into account when walking the tree.
 *
 * @returns A tuple containing the last path entry and the found map entry.
 */
export const categoryFromPath = (path: string): [string, ISettingCategory] => {
    const parts = path.split(".");
    const key = parts.pop();

    /* istanbul ignore if */
    if (!key) {
        throw new Error(`The setting category path "${path}" is invalid.`);
    }

    let category = settingCategories;
    do {
        const part = parts.shift();
        if (!part) {
            break;
        }

        /* istanbul ignore if */
        if (!category.children) {
            throw new Error(`The setting category path "${path}" is invalid.`);
        }

        const entry = category.children.find((child) => {
            return child.key === part;
        });

        /* istanbul ignore if */
        if (!entry) {
            throw new Error(`The setting category path "${path}" is invalid.`);
        }

        category = entry;
    } while (true);

    return [key, category];
};

/**
 * Adds a single setting category to the internal registry used for the settings editor.
 * The registry is organized like a tree.
 *
 * @param path The id of the parent entry in the registry (can be empty for a global category).
 * @param title The title of the category to show in the settings editor.
 * @param description A human readable description to show in the settings editor.
 */
const registerSettingCategory = (path: string, title: string, description: string): void => {
    const [key, category] = categoryFromPath(path);

    /* istanbul ignore if */
    if (category.children && category.children.find((child) => {
        return child.key === key;
    })) {
        throw new Error(`Attempt to register an existing setting category (${path}).`);
    }

    if (!category.children) {
        category.children = [];
    }

    category.children.push({
        title,
        key,
        id: path,
        description,
        values: [],
    });
};

/**
 * Adds a setting value to the internal registry used for the settings editor.
 *
 * @param path A full path to address this setting (e.g. 'aaa.bb.ccc').
 * @param title A title for that setting value.
 * @param description A description for the value.
 * @param valueType Describes the value that will be stored in this setting.
 * @param defaultValue The value which is used if the setting does not exist.
 * @param advanced A flag specifying the display mode of the setting.
 * @param parameters Additional values required for a setting (object members, choices, action)
 */
const registerSetting = (path: string, title: string, description: string, valueType: SettingValueType,
    defaultValue: unknown, advanced: boolean, parameters: ISettingParameters = {}): void => {
    const [key, category] = categoryFromPath(path);

    /* istanbul ignore if */
    if (category.values.find((child) => {
        return child.key === key;
    })) {
        throw new Error(`Attempt to register an existing setting value (${path}).`);
    }

    category.values.push({
        key,
        title,
        id: path,
        description,
        valueType,
        defaultValue,
        advanced,
        parameters,
    });
};

export const registerSettings = (): void => {
    registerSettingCategory("workers", "Background Workers", "Settings related to background workers");
    registerSetting(
        "workers.minWorkerCount",
        "Minimum Background Worker Count",
        "The number of workers that are always available.",
        "number",
        3,
        true,
    );
    registerSetting(
        "workers.maxWorkerCount",
        "Maximum Background Worker Count",
        "The maximum number of workers that are active at the same time.",
        "number",
        3,
        true,
    );
    registerSetting(
        "workers.maxPendingTaskCount",
        "Maximum Number of Waiting Tasks",
        "Describes the highest number of waiting tasks for a free background worker. If this number is exceeded an " +
        "error is thrown, indicating that the worker pool is overloaded and can no longer cope with incoming work.",
        "number",
        100,
        true,
    );
    registerSetting(
        "workers.removeIdleTime",
        "Delay to Remove Inactive Workers",
        "Specifies the number of seconds that pass until the oldest inactive worker is removed. Has no effect if the " +
        "current number of active workers fall below the minimal worker count.",
        "number",
        5,
        true,
    );

    registerSettingCategory(
        "theming",
        "Theme Settings",
        "Values used to theme the application. There is a dedicated editor to change these values.",
    );
    registerSetting(
        "theming.currentTheme",
        "Current Theme",
        "Select the active theme for the current profile.",
        "choice",
        "auto",
        false,
    );
    registerSetting(
        "theming.themes",
        "Registered Themes",
        "Theme can be selected or edited directly in User Settings JSON -> workbench.colorCustomizations",
        "list",
        [],
        true,
    );

    //registerSettingCategory("general", "General", "Settings that do not fit in the more specialized sections.");

    registerSettingCategory("editor", "Code Editor", "Settings related to all code editors.");
    registerSettingCategory("editor.theming", "Theming", "Settings related to theming.");
    registerSetting(
        "editor.theming.decorationSet",
        "Decoration Set for Code Editor Gutters",
        "Select one of the sets for code-block decoration that results in mixed language code editors.",
        "choice",
        "standard",
        false,
        {
            choices: [
                ["Standard Set", "standard", "Includes only a solid marker for editor rows"],
                [
                    "Alternative Set",
                    "alternative",
                    "Uses a hatch pattern with different colors to separate editor content and result areas",
                ],
            ],
        },
    );
    registerSetting(
        "editor.wordWrap",
        "Word Wrapping",
        "Determines how long lines should be wrapped automatically by the editor.",
        "choice",
        "off",
        false,
        {
            choices: [
                ["Off", "off", "Lines never wrap"],
                ["On", "on", "Lines wrap at the viewport width"],
                ["Word Wrap Column", "wordWrapColumn", "Lines wrap at \"Code Editor: Word Wrap Column\""],
                ["Bounded", "bounded",
                    "Lines wrap at the minimum of viewport width or \"Code Editor: Word Wrap Column\""],
            ],
        },
    );
    registerSetting(
        "editor.wordWrapColumn",
        "Word Wrap Column",
        "Controls the column of the editor to wrap long lines when Code Editor: Word Wrap is `wordWrapColumn` or " +
        "`bounded`.",
        "number",
        120,
        false,
    );
    registerSetting(
        "editor.showHidden",
        "Invisible Characters",
        "When set to true, normally invisible characters (like space or tabulator) are displayed too.",
        "boolean",
        false,
        false,
    );
    registerSetting(
        "editor.dbVersion",
        "MySQL DB Version",
        "The default version to be used for MySQL language support, if no version is available.",
        "string",
        "8.0.25",
        false,
    );
    registerSetting(
        "editor.sqlMode",
        "MySQL SQL Mode",
        "The default SQL mode to be used for MySQL language support, if mode information is not available.",
        "string",
        "",
        false,
    );
    registerSetting(
        "editor.stopOnErrors",
        "Stop on Errors",
        "If this option is set, execution of scripts will be stopped if an error occurs. Otherwise, the script " +
        "execution continues with the next statement.", "boolean",
        false, false);
    registerSetting(
        "editor.showMinimap",
        "Show the Minimap",
        "Determines if code editors should show a minimap, instead of the plain scrollbar, for better navigation.",
        "boolean",
        true,
        false,
    );
    registerSetting(
        "editor.editOnDoubleClick",
        "Start Editing on Double Click",
        "When set, a double click on a result cell starts editing the cell, otherwise editing a cell is only " +
        "possible if the edit mode is activated.",
        "boolean",
        true,
        false,
    );

    registerSettingCategory("dbEditor", "DB Editor", "Settings related to a DB editor");
    registerSetting(
        "dbEditor.startLanguage",
        "Start Language",
        "Select the initial language for new DB editors.",
        "choice", "sql", false,
        {
            choices: [
                ["JavaScript", "javascript", "Supported in all code editors"],
                ["TypeScript", "typescript", "Supported only in DB editors"],
                ["Python", "python", "Supported only in shell session editors"],
                ["SQL", "sql", "Supported in all code editors"],
            ],
        });
    registerSetting(
        "dbEditor.defaultEditor",
        "Default Editor",
        "Select the type of the first editor when opening a DB connection.",
        "choice", "notebook", false,
        {
            choices: [
                ["DB Notebook", "notebook", "A multi-language editor with embedded results"],
                ["MySQL Script", "script", "A single-language script editor (MySQL)"],
            ],
        });
    registerSetting(
        "dbEditor.useMinimap",
        "Use the minimap if globally enabled",
        "Determines if notebooks in the DB editor show a minimap. Only has an effect when mini maps are globally " +
        "enabled",
        "boolean",
        false,
        false,
    );
    registerSetting(
        "dbEditor.upperCaseKeywords",
        "Use UPPER case keywords in code completion",
        "When set, keywords shown in code-completion popups appear in all uppercase letters and are inserted as such " +
        "in the SQL code editors.",
        "boolean",
        true,
        false,
    );

    registerSettingCategory("dbEditor.connectionBrowser", "Connection Browser", "Settings related to the connection " +
        "overview page in the DB Editor Module");
    registerSetting(
        "dbEditor.connectionBrowser.showGreeting",
        "Show Greeting",
        "If set, a message section is shown with some useful links.",
        "boolean",
        true,
        false,
    );

    registerSettingCategory("sql", "SQL Execution", "Settings related to how SQL queries are handled");
    registerSetting(
        "sql.limitRowCount",
        "Result Set Page Size",
        "Determines the size of one page in a result set, but has no effect if a top-level LIMIT clause is specified " +
        "in the query. Set to 0 to disable auto adding a LIMIT clause and return all records as a single page. " +
        "However, be cautious with large row counts (> 50000).",
        "number",
        1000,
        false,
        { range: [0, 10000] },
    );
    registerSetting(
        "sql.rowPacketSize",
        "Row Packet Size",
        "Determines the number of result records that are sent in a single response from the backend.",
        "number",
        1000,
        true,
    );

    registerSettingCategory("shellSession", "Shell Session", "Settings related to a shell session");
    registerSettingCategory(
        "shellSession.sessionBrowser",
        "Shell Session Browser",
        "Settings related to the shell session overview page in the Shell Session Module",
    );
    registerSetting(
        "shellSession.sessionBrowser.showGreeting",
        "Show Greeting",
        "If set, a message section is shown with some useful links.",
        "boolean",
        true,
        false,
    );
    registerSetting(
        "shellSession.startLanguage",
        "Start Language",
        "Select the initial language for a new shell session.",
        "choice",
        "javascript",
        false,
        {
            choices: [
                ["JavaScript", "javascript", "Supported in all code editors"],
                ["Python", "python", "Supported only in shell session editors"],
                ["SQL", "sql", "Supported in all code editors"],
            ],
        },
    );
};
