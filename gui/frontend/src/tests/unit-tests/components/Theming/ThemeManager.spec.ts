/*
 * Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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

import { afterAll, describe, expect, it, vi } from "vitest";

import { IThemeObject, ThemeManager } from "../../../../components/Theming/ThemeManager.js";

vi.mock("../../../../components/Theming/assets/light-modern-color-theme.json", () => {
    return {
        default: {
            name: "Light Modern",
            type: "light",
            colors: {
                "foreground": "#000",
                "textLink.foreground": "#000",
            },
            tokenColors: [{
                scope: [],
                settings: { background: "#FFF" },
            }],
        },
    };
});

describe("ThemeManager tests", () => {
    const themeManager = ThemeManager.get;

    afterAll(() => {
        vi.resetAllMocks();
    });

    it("Create instance and init", () => {

        expect(themeManager.activeTheme).toBe("Auto");
        themeManager.activeTheme = "Light Modern";
        expect(themeManager.activeTheme).toBe("Light Modern");

        themeManager.activeTheme = "Dark (user defined)";
        expect(themeManager.activeTheme).toBe("Light Modern");

        themeManager.activeTheme = "Dark Modern";
        expect(themeManager.activeTheme).toBe("Dark Modern");

    });

    it("Test stylesToString", () => {
        const result = themeManager.stylesToString({
            "activityBar.background": "#FF0000",
            "focusBorder": "rgba(0, 122, 204, 0.5)",
        });
        expect(result).toEqual(
            `\t--activityBar-background: #FF0000;
\t--focusBorder: rgba(0, 122, 204, 0.5);
` );
    });

    it("Test parseHostTheme", () => {
        const type = "light";
        const themeClass = `any-${type}`;
        const css = `

        --text-link-decoration: none; --vscode-font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        --vscode-font-weight: normal; --vscode-font-size: 13px;
        --vscode-editor-font-family: Menlo, Monaco, 'Courier New', monospace;
        --vscode-editor-font-weight: normal; --vscode-editor-font-size: 12px;
        --vscode-foreground: #cccccc; --vscode-textLink-foreground: #3794ff;

        `;
        const theme = themeManager.parseHostTheme({
            css,
            themeClass,
            themeName: "",
            themeId: "",
        });
        const expected: IThemeObject = {
            name: themeClass,
            type,
            font: {
                fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: "normal",
                fontSize: "13px",
                editorFontFamily: "Menlo, Monaco, 'Courier New', monospace",
                editorFontWeight: "normal",
                editorFontSize: "12px",
            },
            colors: {
                "foreground": "#cccccc",
                "textLink.foreground": "#3794ff",
            },
            tokenColors: [{
                scope: [],
                settings: { background: "#FFF" },
            }],
        };
        expect(theme).toEqual(expected);
    });

    describe("Test getFontVariables", () => {
        it("Provides defaults", () => {
            expect(themeManager.getFontVariables(undefined)).toEqual({
                "msg-standard-font-family": "'Helvetica Neue', Helvetica, Arial, sans-serif",
                "msg-standard-font-weight": "400",
                "msg-monospace-font-family": "'SourceCodePro+Powerline+Awesome+MySQL', monospace",
                "msg-standard-font-size": "14px",
            });
        });

        it("Sets provided values", () => {
            const fontFamily = "'Helvetica Neue'";
            const fontSize = "12px";
            const fontWeight = "bold";
            const editorFontFamily = "SourceCodePro";
            const editorFontSize = "13px";
            const editorFontWeight = "normal";

            const fontVariables = themeManager.getFontVariables({
                fontFamily,
                fontSize,
                fontWeight,
                editorFontFamily,
                editorFontSize,
                editorFontWeight,
            });

            expect(fontVariables).toEqual({
                "msg-standard-font-family": fontFamily,
                "msg-standard-font-size": fontSize,
                "msg-standard-font-weight": fontWeight,
                "msg-monospace-font-family": editorFontFamily,
                "msg-monospace-font-size": editorFontSize,
                "msg-monospace-font-weight": editorFontWeight,
            });
        });
    });

    describe("Test isValidColor", () => {
        it("Test valid colors", () => {
            const testColors = [
                "red",
                "#fff",
                "#fff1",
                "#00000080",
                "rgba(255 255 255)",
                "rgba(255,255,255,0)",
                "rgba(255 255 255 / 0.5)",
                "rgba(255,255,255 / 0.5)",
                "hsl(120deg 100% 12.34%)",
                "hsl(120deg 100% 12.34%, 0.1)",
                "hsl(0,10%,20% / 0.9)",
                "hsl(0, 10%, 20%, 0.9)",
            ];
            const validColors = testColors.map((color) => {
                return themeManager.isValidColor(color) ? color : `${color} is invalid`;
            });
            expect(validColors).toEqual(testColors);
        });

        it("Test invalid colors", () => {
            const testColors = [
                "",
                "#red",
                "none",
                "dotted",
                "sans-serif",
            ];
            const invalidColors = testColors.map((color) => {
                return !themeManager.isValidColor(color) ? color : `${color} was expected to be invalid`;
            });
            expect(invalidColors).toEqual(testColors);
        });

        it("Sets provided values", () => {
            const fontFamily = "'Helvetica Neue'";
            const fontSize = "12px";
            const fontWeight = "bold";
            const editorFontFamily = "SourceCodePro";
            const editorFontSize = "13px";
            const editorFontWeight = "normal";

            const fontVariables = themeManager.getFontVariables({
                fontFamily,
                fontSize,
                fontWeight,
                editorFontFamily,
                editorFontSize,
                editorFontWeight,
            });

            expect(fontVariables).toEqual({
                "msg-standard-font-family": fontFamily,
                "msg-standard-font-size": fontSize,
                "msg-standard-font-weight": fontWeight,
                "msg-monospace-font-family": editorFontFamily,
                "msg-monospace-font-size": editorFontSize,
                "msg-monospace-font-weight": editorFontWeight,
            });
        });
    });

    describe("Test guessThemeType", () => {
        it("Test light high contrast", () => {
            expect(themeManager.guessThemeType({
                name: "vscode-high-contrast-light",
                type: "light",
            })).toEqual("light");
        });

        it("Test dark high contrast", () => {
            expect(themeManager.guessThemeType({
                name: "vscode-high-contrast",
                type: "light",
            })).toEqual("dark");
        });

        it("Test dark", () => {
            expect(themeManager.guessThemeType({
                name: "foo",
                type: "dark",
            })).toEqual("dark");
        });

        it("Test light", () => {
            expect(themeManager.guessThemeType({
                name: "foo",
                type: "light",
            })).toEqual("light");
        });
    });

    describe("Test processThemePipeline", () => {
        it("Empty theme with default colors", () => {
            const css = themeManager.generateCssWithDefaults({ name: "test" }, "light");

            // At least one default light color
            expect(css).toEqual(expect.stringContaining(`--textLink-foreground: #000;`));

            // At least one light app colors
            expect(css).toEqual(expect.stringContaining(`--connectionTile-border: #6CB9E0;`));

            // At least one language color
            expect(css).toEqual(expect.stringContaining(`--editorPrompt-primary-sql: #db8f00;`));
        });

        it("Theme overrides default color", () => {
            const css = themeManager.generateCssWithDefaults({
                name: "test",
                colors: {
                    "textLink.foreground": "#123",
                },
            }, "light");

            expect(css).toEqual(expect.stringContaining(`--textLink-foreground: #123;`));
        });

        it("Fixed color is used if not present in the theme", () => {
            const css = themeManager.generateCssWithDefaults({
                name: "test",
                colors: {
                    "panel.background": "#234",
                },
            }, "dark");

            expect(css).toEqual(expect.stringContaining(`--dropdown-background: #313131;`));

            expect(css).toEqual(expect.stringContaining(`--panel-background: #234;`));
            expect(css).toEqual(expect.stringContaining(`--statusBar-background: #234;`));
        });

        it("Fixed color is not used when present in the theme", () => {
            const css = themeManager.generateCssWithDefaults({
                name: "test",
                colors: {
                    "panel.background": "#234",
                    "statusBar.background": "#567",
                },
            }, "dark");

            expect(css).toEqual(expect.stringContaining(`--panel-background: #234;`));

            // Not inferred from the panel.background
            expect(css).toEqual(expect.stringContaining(`--statusBar-background: #567;`));
        });

        it("Color adjustment used theme variable", () => {
            const css = themeManager.generateCssWithDefaults({
                name: "test",
                colors: {
                    "editor.selectionBackground": "#345",
                },
            }, "dark");

            expect(css).toEqual(expect.stringContaining(`--editor-selectionBackground: #345;`));
            expect(css).toEqual(expect.stringContaining(`--selection-background: #345;`));
        });

        it("Color adjustment calculated", () => {
            const css = themeManager.generateCssWithDefaults({
                name: "test",
                colors: {
                    "editor.background": "#eee",
                },
            }, "dark");

            expect(css).toEqual(expect.stringContaining(`--editor-background: #eee;`));

            // "lightness": {"absolute": -4}
            expect(css).toEqual(expect.stringContaining(`--editorZone-background: #e4e4e4;`));
        });
    });
});
