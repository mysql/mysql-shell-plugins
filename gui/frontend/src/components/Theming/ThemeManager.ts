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

import darkAppColors from "./assets/dark-app-colors.json";
import darkModern from "./assets/dark-modern-color-theme.json";
import fixedColors from "./assets/fixed-colors.json";
import languagesColors from "./assets/languages-colors.json";
import lightAppColors from "./assets/light-app-colors.json";
import lightModern from "./assets/light-modern-color-theme.json";

import darkAbyss from "./assets/themes/dark-abyss-color-theme.json";
import darkHc from "./assets/themes/dark-hc-color-theme.json";
import darkKimbie from "./assets/themes/dark-kimbie-color-theme.json";
import darkMonokai from "./assets/themes/dark-monokai-color-theme.json";
import darkMonokaiDimmed from "./assets/themes/dark-monokai-dimmed-color-theme.json";
import darkPlus from "./assets/themes/dark-plus-color-theme.json";
import darkRed from "./assets/themes/dark-red-color-theme.json";
import darkSolarized from "./assets/themes/dark-solarized-color-theme.json";
import darkTomorrowNightBlue from "./assets/themes/dark-tomorrow-night-blue-color-theme.json";
import darkVs from "./assets/themes/dark-vs-color-theme.json";
import lightHc from "./assets/themes/light-hc-color-theme.json";
import lightPlus from "./assets/themes/light-plus-color-theme.json";
import lightQuiet from "./assets/themes/light-quiet-color-theme.json";
import lightSolarized from "./assets/themes/light-solarized-color-theme.json";
import lightVs from "./assets/themes/light-vs-color-theme.json";

import Color from "color";
import { ColorManipulator } from "../../utilities/ColorManipulator.js";

import type { IHostThemeData } from "../../supplement/RequisitionTypes.js";
import { appParameters, requisitions } from "../../supplement/Requisitions.js";
import { Settings } from "../../supplement/Settings/Settings.js";

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

interface IFont {
    fontFamily?: string;
    fontSize?: string;
    fontWeight?: string;
    editorFontFamily?: string;
    editorFontSize?: string;
    editorFontWeight?: string;
}

/** This is the structure of a VS Code theme file. */
export interface IThemeObject {
    name: string;
    type?: string;
    include?: string;
    colors?: IColors;
    font?: IFont;

    /** Old style specification. */
    settings?: ITokenEntry[];

    /** This is how it should be done now. */
    tokenColors?: ITokenEntry[];
}

export type ThemeType = "dark" | "light";

/** This is how we store a theme object, loaded from a file (including our defaults). */
interface IThemeDefinition {
    type: ThemeType;
    css: string;
    json: IThemeObject;
}

export interface IThemeChangeData {
    name: string;

    /** Same as `name`, but safe as a name in the DOM. */
    safeName: string;

    type: ThemeType;
    values: IThemeObject;
}

/** A class to manage application themes. */
export class ThemeManager {

    private static instance: ThemeManager;
    private colorManipulator = new ColorManipulator();

    private themeDefinitions: Map<string, IThemeDefinition> = new Map();
    private themeStyleElement?: HTMLStyleElement;
    private currentTheme = "";
    private safeThemeName = "";

    private updating = false;

    /**
     * Set when the actual theme is determined by the host (if the app is embedded). Ignore the theme
     * from the profile in that case.
     */
    #useHostTheme = false;

    private constructor() {
        let themes = [
            darkModern,
            darkAbyss,
            darkHc,
            darkKimbie,
            darkMonokai,
            darkMonokaiDimmed,
            darkPlus,
            darkRed,
            darkSolarized,
            darkTomorrowNightBlue,
            darkVs,

            lightModern,
            lightHc,
            lightPlus,
            lightQuiet,
            lightSolarized,
            lightVs,
        ];
        if (appParameters.embedded) {
            themes = [
                darkModern,
                lightModern,
            ];
        }

        themes.forEach((th) => {
            this.loadThemeDetails(th);
        });

        // Create an HTML element to hold our current theme values.
        this.themeStyleElement = document.createElement("style");
        this.themeStyleElement.id = "theme-colors";
        document.head.prepend(this.themeStyleElement);

        if (!appParameters.embedded) {
            this.updating = true;
            this.switchTheme("Auto");
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

    public get activeThemeType(): ThemeType | undefined {
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

    public get activeThemeSafe(): string {
        return this.safeThemeName;
    }

    public get activeTheme(): string {
        return this.currentTheme;
    }

    public set activeTheme(theme: string) {
        if (this.currentTheme !== theme) {
            this.switchTheme(theme);
            this.updateSettings();
        }
    }

    /**
     * Locates the settings for the given scope in the current theme and returns the foreground color.
     *
     * @param scope A token scope, e.g. `comment`, `string`, `variable`, etc.
     *
     * @returns The foreground color for the given scope, or `undefined` if not found.
     */
    public getTokenForegroundColor(scope: string): string | undefined {
        const definitions = this.themeDefinitions.get(this.currentTheme);
        if (definitions) {
            const tokenColors = definitions.json.tokenColors || definitions.json.settings;
            if (tokenColors) {
                // Start by collecting all entries with scopes that either fully match the given scope, or
                // at are a suffix of the given scope.
                const candidates: Array<[string, string]> = [];

                for (const entry of tokenColors) {
                    const scopes = Array.isArray(entry.scope) ? entry.scope : entry.scope.split(",");
                    scopes.forEach((candidate) => {
                        if (scope.startsWith(candidate.trim()) && entry.settings.foreground) {
                            candidates.push([candidate, entry.settings.foreground]);
                        }
                    });
                }

                // Now sort the candidates by length of the scope, so that the longest match is first.
                candidates.sort((a, b) => {
                    return b[0].length - a[0].length;
                });

                // And return the first candidate.
                if (candidates.length > 0) {
                    return candidates[0][1];
                }
            }
        }

        return undefined;
    }

    public guessThemeType(values: IThemeObject): ThemeType {
        if (values.name === "vscode-high-contrast") {
            return "dark";
        }
        if (values.name === "vscode-high-contrast-light") {
            return "light";
        }

        let type: ThemeType;
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

        return type;
    }

    /**
     * Converts the given values object into a CSS theme definition and stores it for later use.
     *
     * @param values An object with theme values.
     *
     * @returns The id of the loaded theme.
     */
    public loadThemeDetails(values: IThemeObject): string {
        const type = this.guessThemeType(values);

        // Note: the term "active" means a state where the application is the current front most one.
        //       Don't confuse that with the CSS "active" notation, which is used for elements on which the mouse is
        //       currently pressed (or a tap on mobile devices). For the latter we use the term "pressed" as in
        //       "button.hoverBackground".
        // Note: settings for a tab container are held in "editorGroup.*" and "editorGroupHeader.*" values.
        //       All "tab.*" values are meant for tab items.
        // Note: Dialogs + Popups use the "window.*" settings.

        const css = this.generateCssWithDefaults(values, type);

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

            if (!values.tokenColors) {
                values.tokenColors = [];
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

    public stylesToString(styles: { [key: string]: string; }): string {
        return Object.entries(styles)
            .map(([key, value]) => {
                return `\t${this.themeValueNameToCssVariable(key)}: ${value};\n`;
            })
            .join("");
    }

    public parseHostTheme(data: IHostThemeData): IThemeObject {
        const name = data.themeClass;
        const type = this.guessThemeType({ name });
        const tokenColors = type === "dark" ? darkModern.tokenColors : lightModern.tokenColors;
        const theme: IThemeObject = {
            name,
            type,
            tokenColors,
        };
        const trim = (value: string) => {
            return value.trim();
        };

        const styles = data.css.split(";").map(trim).filter(Boolean);

        const fontProperties = [
            "font-size",
            "font-family",
            "font-weight",
        ];

        const colors: IColors = {};
        styles.forEach((style) => {
            const [property, value] = style.split(":").map(trim);
            if (!property || !value) {
                return;
            }

            let transformedKey = property.replace(/--(vscode-)?/, "");

            const isFontProperty = fontProperties.find((i) => {
                return transformedKey.includes(i);
            });
            if (isFontProperty) {
                this.setFont(theme, transformedKey, value);

                return;
            }

            transformedKey = transformedKey.replaceAll("-", ".");
            if (!this.isValidColor(value)) {
                return;
            }
            colors[transformedKey] = value;
        });

        theme.colors = colors;

        return theme;
    }

    public getFontVariables(font?: IFont): { [key: string]: string; } {
        if (!font) {
            font = {};
        }

        const fontVariables: { [key: string]: string; } = {};

        fontVariables["msg-standard-font-family"] = font.fontFamily ?? "'Helvetica Neue', Helvetica, Arial, sans-serif";
        fontVariables["msg-standard-font-weight"] = font.fontWeight ?? "400";
        fontVariables["msg-monospace-font-family"] = font.editorFontFamily
            ?? "'SourceCodePro+Powerline+Awesome+MySQL', monospace";
        fontVariables["msg-standard-font-size"] = font.fontSize ?? "14px";

        font.editorFontSize && (fontVariables["msg-monospace-font-size"] = font.editorFontSize);
        font.editorFontWeight && (fontVariables["msg-monospace-font-weight"] = font.editorFontWeight);

        return fontVariables;
    }

    public isValidColor(color: string): boolean {
        try {
            new Color(color);
        } catch (e) {
            return false;
        }

        return true;
    }

    public generateCssWithDefaults(theme: IThemeObject, type: ThemeType): string {
        const defaultColors = this.getDefaultColors(type);
        const themeColors = this.getThemeColors(defaultColors, theme.colors, type);

        const adjustedColors = this.colorManipulator.getAdjustedColors(
            themeColors, this.colorManipulator.colorAdjustments, type,
        );

        const fixedColorsComputed = this.calculateFixedColors(themeColors, type);

        theme.colors = this.combineColors(theme, defaultColors, adjustedColors, fixedColorsComputed);

        return this.getThemeCss(theme);
    }

    private setFont(theme: IThemeObject, property: string, value: string): void {
        if (!theme.font) {
            theme.font = {};
        }

        if (property.match(/^font-size$/)) {
            theme.font.fontSize = value;
        } else if (property.match(/^font-family$/)) {
            theme.font.fontFamily = value;
        } else if (property.match(/^font-weight$/)) {
            theme.font.fontWeight = value;
        } else if (property.match(/^editor-font-size$/)) {
            theme.font.editorFontSize = value;
        } else if (property.match(/^editor-font-family$/)) {
            theme.font.editorFontFamily = value;
        } else if (property.match(/^editor-font-weight$/)) {
            theme.font.editorFontWeight = value;
        }
    }

    private getThemeCss(theme: IThemeObject): string {
        let css = ":root {\n";

        const fontVariables = this.getFontVariables(theme.font);

        css += this.stylesToString(fontVariables);
        css += this.stylesToString(theme.colors!);

        css += "}\n";

        return css;
    }

    private getAppColors(type: ThemeType): IColors {
        return type === "dark" ? darkAppColors : lightAppColors;
    }

    private getThemeColors(defaultColors: IColors, themeColors: IColors | undefined, type: ThemeType): IColors {
        let allColors = { ...languagesColors, ...this.getAppColors(type), ...defaultColors };
        if (themeColors) {
            allColors = { ...allColors, ...themeColors };
        }

        return allColors;
    }

    private getDefaultColors(type: ThemeType): IColors {
        let colors: IColors;
        if (type === "dark") {
            colors = { ...darkModern.colors };
        } else {
            colors = { ...lightModern.colors };
        }

        return this.getThemeColors(colors, undefined, type);
    }

    private calculateFixedColors(themeColors: IColors, type: ThemeType): IColors {
        const colors = this.getThemeColors({}, themeColors, type);

        return this.colorManipulator.getAdjustedColors(colors, fixedColors, type);
    }

    private combineColors(theme: IThemeObject, defaultColors: IColors, adjustedColors: IColors,
        fixedColorsComputed: IColors): IColors {
        const colors = { ...defaultColors, ...fixedColorsComputed, ...adjustedColors };
        const themeHasColors = !!theme.colors;
        if (!themeHasColors) {
            return colors;
        }

        return { ...colors, ...theme.colors };
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
                safeName: this.safeThemeName,
                type: definitions.type,
                values: definitions.json,
            };

            // Delay the notification to ensure registered listeners are ready to receive it.
            // This is especially important for the app startup.
            setTimeout((): void => {
                void requisitions.execute("themeChanged", data);
            }, 0);
        }
    }

    private settingsChanged = (entry?: { key: string; value: unknown; }): Promise<boolean> => {
        if (!this.#useHostTheme) { // Ignore theme changes if the host determines the theme.
            if (!entry || entry.key === "" || entry.key.startsWith("theming.")) {
                if (!this.updating) {
                    Settings.get("theming.themes", []).forEach((definition: IThemeObject): void => {
                        this.loadThemeDetails(definition);
                    });

                    const newTheme = Settings.get("theming.currentTheme", "Auto");
                    if (this.currentTheme !== newTheme) {
                        this.switchTheme(newTheme);
                    }
                }

                return Promise.resolve(true);
            }
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
    private hostThemeChange = (data: IHostThemeData): Promise<boolean> => {
        // From now on we ignore the theme from the profile.
        this.#useHostTheme = true;

        this.themeDefinitions.delete(data.themeClass);

        const theme = this.parseHostTheme(data);
        this.loadThemeDetails(theme);
        this.switchTheme(data.themeClass);

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
                actualTheme = "Light Modern";
            } else {
                actualTheme = "Dark Modern";
            }
            this.loadTheme(actualTheme);

            this.sendChangeNotification(actualTheme);

            this.storeThemeName("Auto"); // Revert the theme name change. We still want to stay on auto.
        }
    };

    private loadTheme(name: string): void {
        const values = this.themeDefinitions.get(name);
        if (values) {
            document.body.setAttribute("theme", values.type);
            if (this.themeStyleElement) {
                this.themeStyleElement.innerHTML = values.css;
            }
            this.storeThemeName(name);
        }
    }

    private storeThemeName(name: string): void {
        this.currentTheme = name;
        this.safeThemeName = name.replace(/[^a-zA-Z]+/g, "-");
    }

    /**
     * Writes all theme definitions and the current theme back to the settings.
     */
    private updateSettings(): void {
        if (this.updating) {
            return;
        }

        this.updating = true;
        const themes: IThemeObject[] = [];
        this.themeDefinitions.forEach((definition: IThemeDefinition, key: string) => {
            if (key !== "Dark Modern" && key !== "Light Modern") {
                themes.push(definition.json);
            }
        });

        Settings.set("theming.themes", themes);
        Settings.set("theming.currentTheme", this.currentTheme);
        Settings.saveSettings();

        this.updating = false;
    }

    private switchTheme(theme: string) {
        let actualTheme = theme;
        if (theme === "Auto") { // Auto means: follow the OS, not the host (if we are embedded).
            if (window.matchMedia("(prefers-color-scheme: light)").matches) {
                actualTheme = "Light Modern";
            } else {
                actualTheme = "Dark Modern";
            }
            this.loadTheme(actualTheme);

            // loadTheme changes the current theme name, but in this case we want to keep "Auto".
            this.storeThemeName("Auto");
        } else {
            this.loadTheme(theme);
        }

        this.sendChangeNotification(actualTheme);
    }

}

// Access the static instance once for the event registration.
void ThemeManager.get;
