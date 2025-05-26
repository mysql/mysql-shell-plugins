/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

import "./CodeEditor.css";

import Color from "color";

import "./userWorker.js";

import { ILanguageDefinition, languages, Monaco } from "./index.js";

import { msg } from "./languages/msg/msg.contribution.js";
import { mysql } from "./languages/mysql/mysql.contribution.js";

import { IThemeChangeData, IThemeObject, ITokenEntry } from "../../Theming/ThemeManager.js";

import { requisitions } from "../../../supplement/Requisitions.js";
import { CodeCompletionProvider } from "./CodeCompletionProvider.js";
import { DefinitionProvider } from "./DefinitionProvider.js";
import { DocumentHighlightProvider } from "./DocumentHighlightProvider.js";
import { FormattingProvider } from "./FormattingProvider.js";
import { HoverProvider } from "./HoverProvider.js";
import { MsgSemanticTokensProvider } from "./MsgSemanticTokensProvider.js";
import { ReferencesProvider } from "./ReferencesProvider.js";
import { RenameProvider } from "./RenameProvider.js";
import { SignatureHelpProvider } from "./SignatureHelpProvider.js";

export class CodeEditorSetup {
    private static monacoConfigured = false;

    public static init(): void {
        CodeEditorSetup.configureMonaco();

        requisitions.register("themeChanged", (data: IThemeChangeData): Promise<boolean> => {
            CodeEditorSetup.updateTheme(data.safeName, data.type, data.values);

            return Promise.resolve(true);
        });
    }

    /**
     * Called once to initialize various aspects of the monaco-editor subsystem (like languages, themes, options etc.)
     */
    private static configureMonaco(): void {
        if (CodeEditorSetup.monacoConfigured) {
            return;
        }

        CodeEditorSetup.monacoConfigured = true;

        languages.onLanguage(msg.id, () => {
            void msg.loader().then((definition: ILanguageDefinition) => {
                languages.setMonarchTokensProvider(msg.id, definition.language);
                languages.setLanguageConfiguration(msg.id, definition.languageConfiguration);
            });
        });

        languages.onLanguage("mysql", () => {
            void mysql.loader().then((definition: ILanguageDefinition) => {
                languages.setMonarchTokensProvider("mysql", definition.language);
                languages.setLanguageConfiguration("mysql", definition.languageConfiguration);
            });
        });

        const editorLanguages = ["msg", "javascript", "typescript", "mysql", "python"];
        languages.registerDocumentSemanticTokensProvider(editorLanguages, new MsgSemanticTokensProvider());
        languages.registerCompletionItemProvider(editorLanguages, new CodeCompletionProvider());
        languages.registerHoverProvider(editorLanguages, new HoverProvider());
        languages.registerSignatureHelpProvider(editorLanguages, new SignatureHelpProvider());
        languages.registerDocumentHighlightProvider(editorLanguages, new DocumentHighlightProvider());
        languages.registerDefinitionProvider(editorLanguages, new DefinitionProvider());
        languages.registerReferenceProvider(editorLanguages, new ReferencesProvider());
        languages.registerDocumentFormattingEditProvider(editorLanguages, new FormattingProvider());
        languages.registerRenameProvider(editorLanguages, new RenameProvider());

        // Register our combined language and create dummy text models for some languages, to trigger their
        // initialization. Otherwise we will get errors when they are used by the combined language code.
        languages.register(msg);

        Monaco.createModel("", "typescript").dispose();
        Monaco.createModel("", "javascript").dispose();
        Monaco.createModel("", "json").dispose();

        if (languages.typescript) { // This field is not set when running under Jest.
            const compilerOptions: languages.typescript.CompilerOptions = {
                allowNonTsExtensions: true,
                target: languages.typescript.ScriptTarget.ESNext,
                module: languages.typescript.ModuleKind.ESNext,
                strictNullChecks: true,
            };

            languages.typescript.javascriptDefaults.setCompilerOptions(compilerOptions);
            languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);

            // Disable the error about "top level await" for standalone editors.
            languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                diagnosticCodesToIgnore: [1375],
            });
            languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                diagnosticCodesToIgnore: [1375],
            });
        }
    }

    /**
     * Updates the theme used by all code editor instances.
     *
     * @param theme The theme name (DOM safe).
     * @param type The base type of the theme.
     * @param values The actual theme values.
     */
    private static updateTheme(theme: string, type: "light" | "dark", values: IThemeObject): void {
        Monaco.remeasureFonts();

        // Convert all color values to CSS hex form.
        const entries: { [key: string]: string; } = {};
        for (const [key, value] of Object.entries(values.colors || {})) {
            entries[key] = (new Color(value)).hexa();
        }

        const tokenRules: Monaco.ITokenThemeRule[] = [];
        (values.tokenColors || []).forEach((value: ITokenEntry): void => {
            const scopeValue = value.scope || [];
            const scopes = Array.isArray(scopeValue) ? scopeValue : scopeValue.split(",");
            scopes.forEach((scope: string): void => {
                tokenRules.push({
                    token: scope,
                    foreground: (new Color(value.settings.foreground)).hexa(),
                    background: (new Color(value.settings.background)).hexa(),
                    fontStyle: value.settings.fontStyle,
                });
            });
        });

        Monaco.defineTheme(theme, {
            base: type === "light" ? "vs" : "vs-dark",
            inherit: false,
            rules: tokenRules,
            colors: entries,
        });

        Monaco.setTheme(theme);
    }
}
