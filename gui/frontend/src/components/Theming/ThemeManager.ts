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

import colorDescriptions from "./assets/color-descriptions.json";
import defaultDark from "./assets/default-dark-color-theme.json";
import defaultLight from "./assets/default-light-color-theme.json";

import Color from "color";

import { settings } from "../../supplement/Settings/Settings";
import { appParameters, requisitions } from "../../supplement/Requisitions";
import { IDictionary } from "../../app-logic/Types";

export interface IColors {
    [key: string]: string;
}

export interface ITokenEntry {
    name?: string;
    scope: string[] | string;
    settings: {
        foreground?: string;
        background?: string;
        fontStyle?: string;
    };
}

/** This is the structure of a VS Code theme file. */
export interface IThemeObject {
    name: string;
    type?: string;
    include?: string;
    colors?: IColors;

    /** Old style specification. */
    settings?: ITokenEntry[];

    /** This is how it should be done now. */
    tokenColors?: ITokenEntry[];
}

/** This is how we store a theme object, loaded from a file (including our defaults). */
interface IThemeDefinition {
    type: "dark" | "light";
    css: string;
    json: IThemeObject;
}

export interface IThemeChangeData {
    name: string;
    type: "dark" | "light";
    values: IThemeObject;
}

/** A class to manage application themes. */
export class ThemeManager {

    private static instance: ThemeManager;

    private themeDefinitions: Map<string, IThemeDefinition> = new Map();
    private themeStyleElement?: HTMLStyleElement;
    private currentTheme = "";

    private updating = false;

    private constructor() {
        this.loadThemeDetails(defaultDark);
        this.loadThemeDetails(defaultLight);

        // Create an HTML element to hold our current theme values.
        this.themeStyleElement = document.createElement("style");
        this.themeStyleElement.id = "theme-colors";
        document.head.prepend(this.themeStyleElement);

        if (!appParameters.embedded) {
            this.updating = true;
            this.activeTheme = "Auto";
            this.updating = false;
        }

        if (!appParameters.embedded) {
            window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", this.handleOSThemeChange);
        }

        requisitions.register("settingsChanged", this.settingsChanged);
        requisitions.register("hostThemeChange", this.hostThemeChange);
    }

    public static get get(): ThemeManager {
        if (!ThemeManager.instance) {
            ThemeManager.instance = new ThemeManager();
        }

        return ThemeManager.instance;
    }

    /**
     * @returns The theme values as an object, which corresponds to the entries in `colorDescriptions`.
     */
    public get activeThemeValues(): IThemeObject | undefined {
        return this.themeDefinitions.get(this.currentTheme)?.json;
    }

    public get activeThemeType(): "dark" | "light" | undefined {
        const definitions = this.themeDefinitions.get(this.currentTheme);
        if (definitions) {
            return definitions.type;
        }

        return undefined;
    }

    public get installedThemes(): string[] {
        return Array.from(this.themeDefinitions.keys());
    }

    /**
     * @returns the DOM node used for the theme variables.
     * This can be used to directly manipulate the values. Useful mostly for the theme editor.
     */
    public get themeStyleNode(): CSSStyleDeclaration {
        return ((this.themeStyleElement?.sheet as CSSStyleSheet).cssRules[0] as CSSStyleRule).style;
    }

    public get currentThemeAsText(): string {
        return JSON.stringify(this.themeDefinitions.get(this.currentTheme)?.json, undefined, 4);
    }

    public get activeTheme(): string {
        return this.currentTheme;
    }

    public set activeTheme(theme: string) {
        if (this.currentTheme !== theme) {

            let actualTheme = theme;
            if (theme === "Auto") { // Auto means: follow the OS, not the host (if we are embedded).
                if (window.matchMedia("(prefers-color-scheme: light)").matches) {
                    actualTheme = "Default Light";
                } else {
                    actualTheme = "Default Dark";
                }
                this.loadTheme(actualTheme);

                // loadTheme changes the current theme name, but in this case we want to keep "Auto".
                this.currentTheme = "Auto";
            } else {
                this.loadTheme(theme);
            }

            this.updateSettings();
            this.sendChangeNotification(actualTheme);
        }
    }

    /**
     * Reads out the current value from our theme variables and stores them in the theme definition.
     */
    public saveTheme(): void {
        const styleNode = this.themeStyleNode;
        const definitions = this.themeDefinitions.get(this.currentTheme);
        if (definitions) {
            const colors = definitions.json.colors || {};

            this.iterateColorDescription(colorDescriptions, (key: string, value: string): void => {
                if (key === "name" && !value.startsWith("#")) {
                    const variable = this.themeValueNameToCssVariable(value);
                    const color = new Color(styleNode.getPropertyValue(variable).trim());
                    colors[value] = color.hexa();
                }
            });

            // Finally re-create the CSS definition for this theme.
            this.loadThemeDetails(definitions.json);

            definitions.json.colors = colors;
        }

        this.updateSettings();
        this.sendChangeNotification(this.currentTheme);
    }

    /**
     * Converts the given values object into a CSS theme definition and stores it for later use.
     *
     * @param values An object with theme values.
     * @param consolidate If true then set default values for missing entries (used when loading a theme from disk).
     *
     * @returns The id of the loaded theme.
     */
    public loadThemeDetails(values: IThemeObject, consolidate = false): string {
        let type: "dark" | "light";
        if (values.type) {
            type = values.type === "dark" ? "dark" : "light";
        } else {
            // Usually there's no type given. See if the name has a hint.
            if (values.name.toLowerCase().includes("dark")) {
                type = "dark";
            } else {
                type = "light";
            }
        }

        // Note: the term "active" means a state where the application is the current front most one.
        //       Don't confuse that with the CSS "active" notation, which is used for elements on which the mouse is
        //       currently pressed (or a tap on mobile devices). For the latter we use the term "pressed" as in
        //       "button.pressedBackground".
        // Note: settings for a tab container are held in "editorGroup.*" and "editorGroupHeader.*" values.
        //       All "tab.*" values are meant for tab items.
        // Note: Dialogs + Popups use the "window.*" settings.
        let css = ":root {\n";
        if (!values.colors) {
            // If no component colors are defined then copy over the ones from the default.
            // This is independent of the consolidation flag, as it ensure we have a `colors` at all.
            if (type === "dark") {
                values.colors = { ...defaultDark.colors };
            } else {
                values.colors = { ...defaultLight.colors };
            }
        }

        Object.keys(values.colors).forEach((key: string): void => {
            css += "\t" + this.themeValueNameToCssVariable(key) + ": " + values.colors![key] + ";\n";
        });

        css += "}\n";

        const definition = this.themeDefinitions.get(values.name);
        if (definition) {
            // If we already have a definition for this theme then update only the CSS values.
            // There's no need to do another sanity check on the values and the type can never change.
            definition.css = css;
        } else {
            // Old themes use the settings member to define colors. Copy member to the tokenColors in such a case.
            if (!values.tokenColors && values.settings) {
                values.tokenColors = values.settings;
                delete values.settings;
            }

            // Theme files can have file references (e.g. the include member or a string instead of an object for
            // tokenColors). However, we cannot load local files without user intervention, so we just fail the load
            // instead.
            if (values.include || typeof values.tokenColors === "string") {
                throw new Error("This theme contains references to local files, which cannot be loaded automatically.");
            }

            if (consolidate) {
                this.uiColorSanityCheck(values.colors);
            }

            if (!values.tokenColors) {
                values.tokenColors = [];
            }

            if (consolidate) {
                this.tokenColorSanityCheck(values.tokenColors);
            }

            this.themeDefinitions.set(values.name, { type, css, json: values });
        }

        return values.name;
    }

    /**
     * Converts the name of a theme setting to a form that is usable as CSS variable.
     *
     * @param name The value to convert.
     *
     * @returns The name transformed in a way that it is acceptable as CSS variable name.
     */
    public themeValueNameToCssVariable(name: string): string {
        return "--" + name.replace(/\./g, "-");
    }

    public duplicateCurrentTheme(newName: string): boolean {
        const data = this.themeDefinitions.get(this.currentTheme);
        if (data) {
            data.json.name = newName;
            this.themeDefinitions.set(newName, { ...data });
        }

        this.updateSettings();

        return false;
    }

    public removeCurrentTheme(): void {
        this.themeDefinitions.delete(this.currentTheme);
        if (this.themeDefinitions.size > 0) {
            this.updating = true;
            this.activeTheme = this.themeDefinitions.keys().next().value;
            this.updating = false;
        }

        this.updateSettings();
    }

    /**
     * Sends a notification to the application, when a theme was made active or was changed.
     *
     * @param theme The name of the theme that was activated/changed.
     */
    private sendChangeNotification(theme: string): void {
        const definitions = this.themeDefinitions.get(theme);
        if (definitions) {
            const data: IThemeChangeData = {
                name: this.currentTheme,
                type: definitions.type,
                values: definitions.json,
            };
            void requisitions.execute("themeChanged", data);
        }
    }

    private settingsChanged = (entry?: { key: string; value: unknown }): Promise<boolean> => {
        if (!entry || entry.key === "" || entry.key.startsWith("theming.")) {
            settings.get("theming.themes", []).forEach((definition: IThemeObject): void => {
                this.loadThemeDetails(definition);
            });

            this.activeTheme = settings.get("theming.currentTheme", "Auto");

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

    /**
     * Handles theme changes in the host (if the app is embedded).
     *
     * @param data The new theme data.
     * @param data.css A set of CSS variables with individual theme data.
     * @param data.themeClass The name of the main theme type. The exact name depends on the host.
     *
     * @returns A promise that always resolve to true.
     */
    private hostThemeChange = (data: { css: string; themeClass: string }): Promise<boolean> => {
        // For the time being we load our light or dark default themes for host theme changes.
        // TODO: enable host theme values here.

        switch (data.themeClass) {
            case "vscode-dark": {
                document.body.setAttribute("theme", "dark");
                this.loadTheme("Default Dark");
                this.currentTheme = "Default Dark";
                this.sendChangeNotification(this.currentTheme);

                break;
            }

            case "vscode-light": {
                document.body.setAttribute("theme", "light");
                this.loadTheme("Default Light");
                this.currentTheme = "Default Light";
                this.sendChangeNotification(this.currentTheme);

                break;
            }

            default: {
                this.currentTheme = "Auto";

                break;
            }
        }

        return Promise.resolve(true);
    };

    /**
     * Triggered only if the auto theme is currently active.
     *
     * @param event The media query list event we subscribed to.
     */
    private handleOSThemeChange = (event: MediaQueryListEvent): void => {
        if (this.currentTheme === "Auto") {
            let actualTheme = "";
            if (event.matches) {
                actualTheme = "Default Light";
            } else {
                actualTheme = "Default Dark";
            }
            this.loadTheme(actualTheme);

            this.sendChangeNotification(actualTheme);

            this.currentTheme = "Auto"; // Revert the theme name change. We still want to stay on auto.
        }
    };

    private loadTheme(name: string): void {
        const values = this.themeDefinitions.get(name);
        if (values) {
            document.body.setAttribute("theme", values.type);
            if (this.themeStyleElement) {
                this.themeStyleElement.innerHTML = values.css;
            }
            this.currentTheme = name;
        }
    }

    /**
     * Checks all given colors for validity and assigns a signal color to those that are not.
     * For background, foreground and border colors we try to find a useful value if they have not been assigned.
     * Finally we also assign meaningful default colors for entries that don't exist in VS Code color themes,
     * but are used by us.
     *
     * @param colors A list of colors to check.
     */
    private uiColorSanityCheck(colors: IColors): void {
        // 1. Step: add empty entries which don't exist but are in the color definitions.
        this.iterateColorDescription(colorDescriptions, (key: string, value: string): void => {
            if (key === "name" && !value.startsWith("#") && !colors[value]) {
                colors[value] = "";
            }
        });

        // 2. Step: color validation.
        for (const [key, value] of Object.entries(colors)) {
            colors[key] = this.checkColor(value);
        }

        // 3. Step: try to fill empty values with useful defaults.
        // First some individual values, then all the rest.
        this.setDefaultValue(colors, "background", "button.background");
        this.setDefaultValue(colors, "list.gridColor", "list.hoverForeground");
        this.setDefaultValue(colors, "list.columnResizerForeground", "list.hoverForeground");

        this.matchAndAssignDefault(/.*background$/i, colors, colors.background);
        this.matchAndAssignDefault(/.*foreground$/i, colors, colors.foreground);
        this.matchAndAssignDefault(/.*border$/i, colors, colors["button.border"]);

        // 4. Step: assign a signal color to all still empty values.
        for (const [key, value] of Object.entries(colors)) {
            if (value.length === 0) {
                // cSpell: disable-next-line
                colors[key] = "orangered";
            }
        }

        // 5. Step: assign initial values for non - VS Code colors we use and don't match any of the above patterns.
        if (!colors["list.gridColor"]) {
            colors["list.gridColor"] = colors["tree.indentGuidesStroke"];
        }
    }

    /**
     * Does a similar check like `uiColorSanityCheck`, but for token colors in a theme (and much simpler).
     * We don't fill in any empty values, however, and we cannot check that specific values exist.
     * But at least a token entry array is created if none exists.
     *
     * @param entries A list of token entries for which the color values are to be checked.
     */
    private tokenColorSanityCheck(entries: ITokenEntry[]): void {
        entries.forEach((value) => {
            if (value.settings.foreground) {
                value.settings.foreground = this.checkColor(value.settings.foreground);
            }

            if (value.settings.background) {
                value.settings.background = this.checkColor(value.settings.background);
            }
        });
    }

    /**
     * Checks if the given color string is a valid CSS color and returns it if so.
     * If not a default, signal color is returned instead.
     *
     * @param color The color to check.
     *
     * @returns The same color string (but trimmed) or a signal color, if the given color could not be parsed.
     */
    private checkColor(color: string): string {
        let colorString = color.trim();
        if (colorString.length > 0) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const t = new Color(colorString);
            } catch (e) {
                // cSpell: disable-next-line
                colorString = "orangered";
            }
        }

        return colorString;
    }

    private matchAndAssignDefault(pattern: RegExp, colors: IColors, defaultValue: string): void {
        if (!defaultValue || defaultValue.length === 0) {
            // The preferred default value is empty, so search one that is not.
            // Use the color descriptions to find a default value, as they are sorted by importance.
            defaultValue = "";
            this.iterateColorDescription(colorDescriptions, (key: string, value: string): void => {
                if (key === "name" && defaultValue.length === 0 && key.match(pattern) && colors[value].length > 0) {
                    defaultValue = colors[value];
                }
            });
        }

        if (defaultValue.length > 0) {
            for (const [key, value] of Object.entries(colors)) {
                if (key.match(pattern) && value.length === 0) {
                    colors[key] = defaultValue;
                }
            }
        }
    }

    private setDefaultValue(colors: IColors, target: string, defaultEntry: string): void {
        if (!colors[target]) {
            colors[target] = colors[defaultEntry];
        }
    }

    private iterateColorDescription = (source: IDictionary[] | IDictionary, callback: (key: string,
        value: string) => void): void => {
        if (Array.isArray(source)) {
            source.forEach((element): void => {
                this.iterateColorDescription(element, callback);
            });
        } else if (typeof source === "object") {
            for (const [key, value] of Object.entries(source as object)) {
                if (typeof value === "string") {
                    callback(key, value);
                } else {
                    this.iterateColorDescription(value as IDictionary[], callback);
                }
            }
        }
    };

    /**
     * Writes all theme definitions and the current theme back to the settings.
     */
    private updateSettings(): void {
        if (this.updating) {
            return;
        }

        settings.set("theming.currentTheme", this.currentTheme);

        const themes: IThemeObject[] = [];

        this.themeDefinitions.forEach((definition: IThemeDefinition, key: string) => {
            if (key !== "Default Dark" && key !== "Default Light") {
                themes.push(definition.json);
            }
        });

        settings.set("theming.themes", themes);
        settings.saveSettings();
    }

}

// Access the static instance once for the event registration.
void ThemeManager.get;
