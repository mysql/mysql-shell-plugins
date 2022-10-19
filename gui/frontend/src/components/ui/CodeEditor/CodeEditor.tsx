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

import "./CodeEditor.css";

import { SymbolTable } from "antlr4-c3";
import React from "react";
import Color from "color";

import {
    ICodeEditorViewState, IDisposable, ICodeEditorOptions, IExecutionContextState, KeyCode, KeyMod,
    languages, Monaco, Position, Range, IPosition, Selection, IScriptExecutionOptions,
} from ".";
import { Component, IComponentProperties } from "..";
import { ExecutionContext } from "../../../script-execution";
import { ExecutionContexts } from "../../../script-execution/ExecutionContexts";
import { PresentationInterface } from "../../../script-execution/PresentationInterface";
import { EditorLanguage, ITextRange } from "../../../supplement";
import { IEditorExecutionOptions, requisitions } from "../../../supplement/Requisitions";
import { settings } from "../../../supplement/Settings/Settings";
import { editorRangeToTextRange } from "../../../utilities/ts-helpers";

import { IThemeChangeData, IThemeObject, ITokenEntry } from "../../Theming/ThemeManager";

import { CodeCompletionProvider } from "./CodeCompletionProvider";
import { DefinitionProvider } from "./DefinitionProvider";
import { DocumentHighlightProvider } from "./DocumentHighlightProvider";
import { FormattingProvider } from "./FormattingProvider";
import { HoverProvider } from "./HoverProvider";
import { ILanguageDefinition, msg } from "./languages/msg/msg.contribution";
import { ReferencesProvider } from "./ReferencesProvider";
import { RenameProvider } from "./RenameProvider";
import { SignatureHelpProvider } from "./SignatureHelpProvider";
import { MessageType } from "../../../app-logic/Types";
import { mysqlKeywords, MySQLVersion } from "../../../parsing/mysql/mysql-keywords";

export interface ICommandData {
    command: string;
}

export interface IFontSettings {
    fontFamily?: string;
    fontWeight?: string;
    fontSize?: number;
    lineHeight?: number;
    letterSpacing?: number;
}

// Determines the behavior of the code editor.
export enum CodeEditorMode {
    Standard,

    // Different set of code completion values. No internal commands.
    Terminal
}

export interface ICodeEditorModel extends Monaco.ITextModel {
    [key: string]: unknown;

    executionContexts: ExecutionContexts;

    // Contains symbols that can be used in code assistants like code completion.
    symbols: SymbolTable;

    // Functionality differs depending on where the code editor is used.
    editorMode: CodeEditorMode;
}

// The presentation class type depends on the place where the editor is used.
export type ResultPresentationFactory = (editor: CodeEditor, language: EditorLanguage) => PresentationInterface;

// Contains data to restore a previous state of a code editor.
export interface IEditorPersistentState {
    viewState: ICodeEditorViewState | null;
    model: ICodeEditorModel;
    contextStates?: IExecutionContextState[]; // Serializable execution blocks.
    options: ICodeEditorOptions;
}

type WordWrapType = "off" | "on" | "wordWrapColumn" | "bounded";

interface ICodeEditorProperties extends IComponentProperties {
    state?: IEditorPersistentState;
    initialContent?: string;
    executeInitialContent?: boolean;

    // The language to be used when creating a default model. If a model is given, the language is taken from that.
    language?: EditorLanguage;

    // Limits the languages this editor instance should support. Put your main/fallback language as first entry in that
    // list (if at all given), as this is what is used by default if a language is not supported.
    allowedLanguages?: EditorLanguage[];

    // Used only for the "msg" language to specify the dialect of the SQL language supported there.
    sqlDialect?: string;

    // Used only if "msg" is the main language and no execution context exists and when the user pastes text, which
    // is then split into language blocks.
    // It determines the language of the initial execution/language block and must not be "msg".
    startLanguage?: EditorLanguage;

    readonly?: boolean;
    detectLinks?: boolean;
    useTabStops?: boolean;
    autoFocus?: boolean;
    allowSoftWrap: boolean;

    componentMinWidth?: number; // Min width of embedded components.
    lineDecorationsWidth?: number; // The width of the gutter area where line decorations are shown.

    renderLineHighlight?: "none" | "gutter" | "line" | "all";
    showIndentGuides?: boolean;
    lineNumbers?: Monaco.LineNumbersType;

    minimap?: Monaco.IEditorMinimapOptions;
    suggest?: Monaco.ISuggestOptions;
    font?: IFontSettings;
    scrollbar?: Monaco.IEditorScrollbarOptions;

    onScriptExecution?: (context: ExecutionContext, options: IScriptExecutionOptions) => Promise<boolean>;
    onHelpCommand?: (command: string, currentLanguage: EditorLanguage) => string | undefined;
    onCursorChange?: (position: Position) => void;
    onOptionsChanged?: () => void;
    onModelChange?: () => void;

    // The presentation class depends on the place where the editor is used.
    createResultPresentation?: ResultPresentationFactory;
}

export class CodeEditor extends Component<ICodeEditorProperties> {

    public static readonly defaultProps = {
        detectLinks: false,
        useTabStops: false,
        componentMinWidth: 200,
        lineNumbers: "on",
        allowSoftWrap: false,
    };

    public static currentThemeId = "";

    // Translates between language IDs and an editor language, when using the MSG language.
    private static languageMap = new Map<string, EditorLanguage>([
        ["typescript", "typescript"],
        ["ts", "typescript"],
        ["javascript", "javascript"],
        ["js", "javascript"],
        ["sql", "sql"],
        ["json", "json"],
        ["python", "python"],
        ["py", "python"],
    ]);

    private static sqlUiStringMap = new Map<string, string>([
        ["sql", "SQLite"],
        ["mysql", "MySQL"],
    ]);

    private static monacoConfigured = false;

    private hostRef = React.createRef<HTMLDivElement>();
    private editor: Monaco.IStandaloneCodeEditor | undefined;

    // Set when a new execution context is being added. Requires special handling in the change event.
    private addingNewContext = false;
    private scrolling = false;

    private scrollingTimer: ReturnType<typeof setTimeout> | null;
    private keyboardTimer: ReturnType<typeof setTimeout> | null;

    // Automatic re-layout on host resize.
    private resizeObserver?: ResizeObserver;

    // All allocated event handlers that must be explicitly disposed off.
    private disposables: IDisposable[] = [];

    public constructor(props: ICodeEditorProperties) {
        super(props);

        this.addHandledProperties("initialContent", "executeInitialContent", "language", "allowedLanguages",
            "sqlDialect", "readonly", "detectLinks", "showHidden", "useTabStops", "showHidden", "autoFocus",
            "allowSoftWrap",
            "componentMinWidth", "lineDecorationsWidth", "lineDecorationsWidth", "renderLineHighlight",
            "showIndentGuides", "lineNumbers", "minimap", "suggest", "font", "scrollbar",
            "onScriptExecution", "onHelpCommand", "onCursorChange", "onOptionsChanged", "createResultPresentation",
        );

        if (typeof ResizeObserver !== "undefined") {
            this.resizeObserver = new ResizeObserver(this.handleEditorResize);
        }

        // If Monaco wasn't initialized on load, do it now.
        CodeEditor.configureMonaco();
    }

    public static addTypings(typings: string, source: string): void {
        if (languages.typescript) {
            languages.typescript.javascriptDefaults.addExtraLib(typings, source);
            languages.typescript.typescriptDefaults.addExtraLib(typings, source);
        }
    }

    /**
     * Updates the theme used by all code editor instances.
     *
     * @param theme The theme name.
     * @param type The base type of the theme.
     * @param values The actual theme values.
     */
    public static updateTheme(theme: string, type: "light" | "dark", values: IThemeObject): void {
        Monaco.remeasureFonts();

        // Convert all color values to CSS hex form.
        const entries: { [key: string]: string } = {};
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

        CodeEditor.currentThemeId = theme.replace(/[^a-zA-Z]+/g, "-");
        Monaco.defineTheme(CodeEditor.currentThemeId, {
            base: type === "light" ? "vs" : "vs-dark",
            inherit: true,
            rules: tokenRules,
            colors: entries,
        });

        Monaco.setTheme(CodeEditor.currentThemeId);
    }

    /**
     * Called once to initialize various aspects of the monaco-editor subsystem (like languages, themes, options etc.)
     */
    public static configureMonaco(): void {
        if (CodeEditor.monacoConfigured) {
            return;
        }

        CodeEditor.monacoConfigured = true;

        const completionProvider = new CodeCompletionProvider();
        const hoverProvider = new HoverProvider();
        const signatureHelpProvider = new SignatureHelpProvider();
        const documentHighlightProvider = new DocumentHighlightProvider();
        const definitionProvider = new DefinitionProvider();
        const referenceProvider = new ReferencesProvider();
        const formattingProvider = new FormattingProvider();
        const renameProvider = new RenameProvider();

        languages.onLanguage(msg.id, () => {
            void msg.loader().then((definition: ILanguageDefinition) => {
                // TODO: no longer needed once we switch away from Monarch.
                definition.language.start = "sql";

                // Dynamically load the MySQL keywords (modifying the keyword list in the language definition).
                const keywordSet = mysqlKeywords.get(MySQLVersion.MySQL80);
                const keywords = definition.language.mysqlKeywords as string[];
                if (keywordSet && keywords) {
                    for (const entry of keywordSet.values()) {
                        // Push each keyword twice (lower and upper case), as we have to make the
                        // main language case sensitive.
                        keywords.push(entry);
                        keywords.push(entry.toLowerCase());
                    }
                }
                languages.setMonarchTokensProvider(msg.id, definition.language);
                languages.setLanguageConfiguration(msg.id, definition.languageConfiguration);
            });
        });

        for (const language of [msg.id, "mysql", "sql", "python"]) {
            languages.registerCompletionItemProvider(language, completionProvider);
            languages.registerHoverProvider(language, hoverProvider);
            languages.registerSignatureHelpProvider(language, signatureHelpProvider);
            languages.registerDocumentHighlightProvider(language, documentHighlightProvider);
            languages.registerDefinitionProvider(language, definitionProvider);
            languages.registerReferenceProvider(language, referenceProvider);
            languages.registerDocumentFormattingEditProvider(language, formattingProvider);
            languages.registerRenameProvider(language, renameProvider);
        }

        // Register our combined language and create dummy text models for JS and TS, to trigger their
        // initialization. Otherwise we will get errors when they are used by the combined language code.
        languages.register(msg);

        Monaco.createModel("", "typescript");
        Monaco.createModel("", "javascript");

        if (languages.typescript) { // This field is not set when running under Jest.
            languages.typescript.javascriptDefaults.setCompilerOptions({
                allowNonTsExtensions: true,
                target: languages.typescript.ScriptTarget.ES2017,
                lib: ["es2017"],
            });

            languages.typescript.typescriptDefaults.setCompilerOptions({
                allowNonTsExtensions: true,
                target: languages.typescript.ScriptTarget.ES2017,
                lib: ["es2017"],
            });
        }
    }

    public get isScrolling(): boolean {
        return this.scrolling;
    }

    public componentDidMount(): void {
        if (!this.hostRef.current) {
            return;
        }

        const {
            language, initialContent, state, autoFocus, createResultPresentation,
            readonly, minimap, detectLinks, suggest, showIndentGuides, renderLineHighlight, useTabStops,
            font, scrollbar, lineNumbers, lineDecorationsWidth, allowSoftWrap,
        } = this.mergedProps;

        const className = this.getEffectiveClassNames([
            "codeEditor",
            `decorationSet-${settings.get("editor.theming.decorationSet", "standard")}`,
        ]);

        const showHidden = settings.get("editor.showHidden", false);
        const wordWrap = allowSoftWrap
            ? settings.get("editor.wordWrap", "off") as ("on" | "off" | "wordWrapColumn" | "bounded")
            : "off";
        const wordWrapColumn = settings.get("editor.wordWrapColumn", 120);

        const guides: Monaco.IGuidesOptions = {
            indentation: showIndentGuides,
        };

        const showMinimap = settings.get("editor.showMinimap", true);
        const useMinimap = settings.get("dbEditor.useMinimap", false);
        const effectiveMinimapSettings = minimap ?? {
            enabled: true,
        };
        effectiveMinimapSettings.enabled = showMinimap && useMinimap;

        let combinedLanguage;

        let model: ICodeEditorModel;
        if (state && !state.model.isDisposed()) {
            model = state.model;
            combinedLanguage = model.getLanguageId() === "msg";
        } else {
            combinedLanguage = language === "msg";
            model = Monaco.createModel(initialContent ?? "", language) as ICodeEditorModel;
            model.executionContexts =
                new ExecutionContexts(undefined, settings.get("editor.dbVersion", 80024),
                    settings.get("editor.sqlMode", ""), "");
            model.symbols = new SymbolTable("default", { allowDuplicateSymbols: true });
        }

        const options: Monaco.IStandaloneEditorConstructionOptions = {
            extraEditorClassName: className,
            rulers: [],
            cursorSurroundingLines: 2,
            readOnly: readonly,
            minimap: effectiveMinimapSettings,
            find: {
                seedSearchStringFromSelection: "selection",
                autoFindInSelection: "never",
                addExtraSpaceOnTop: false,
            },
            cursorSmoothCaretAnimation: false,
            fontLigatures: true,
            wordWrap,
            wordWrapColumn,
            wrappingIndent: "indent",
            wrappingStrategy: "advanced",
            hover: {
                enabled: true,
            },
            links: detectLinks,
            colorDecorators: true,
            contextmenu: model?.editorMode !== CodeEditorMode.Terminal,
            suggest,
            emptySelectionClipboard: false,
            copyWithSyntaxHighlighting: true,
            codeLens: !combinedLanguage,
            folding: !combinedLanguage,
            foldingStrategy: "auto",
            glyphMargin: !combinedLanguage,
            showFoldingControls: "always",
            lightbulb: { enabled: false },
            renderWhitespace: showHidden ? "all" : "none",
            renderControlCharacters: showHidden,
            guides,
            renderLineHighlight,
            useTabStops,
            fontFamily: font?.fontFamily,
            fontWeight: font?.fontWeight,
            fontSize: font?.fontSize,
            lineHeight: font?.lineHeight,
            letterSpacing: font?.letterSpacing,
            showUnused: true,
            scrollbar,
            lineNumbers,
            scrollBeyondLastLine: false, //true,
            lineDecorationsWidth: lineDecorationsWidth ?? (combinedLanguage ? 49 : 20),

            model,
            //suggestFontSize: 12,
        };

        this.editor = Monaco.create(this.hostRef.current, options);

        if (state?.viewState) {
            this.editor.restoreViewState(state.viewState);
        }

        this.editor.layout();
        if (autoFocus) {
            this.editor.focus();
        }

        this.resizeObserver?.observe(this.hostRef.current as Element);

        if (model) {
            if (state && state.contextStates && state.contextStates.length > 0 && createResultPresentation) {
                model.executionContexts.restoreFromState(this, createResultPresentation, state.contextStates);
            } else {
                if (model.getLanguageId() === "msg" && model.getLineCount() > 1) {
                    this.generateExecutionBlocksFromContent();
                } else {
                    this.addInitialBlock(model);
                }
            }
        }

        this.prepareUse();
        if (state?.viewState) {
            const position = state.viewState.viewState.firstPosition.lineNumber ?? 0;
            this.editor.revealLineNearTop(position, Monaco.ScrollType.Immediate);
        }

        Monaco.remeasureFonts();

        /*this.backend?.getSupportedActions().forEach((value: Monaco.IEditorAction) => {
            console.log(value);
        });*/
    }

    public componentWillUnmount(): void {
        if (this.scrollingTimer) {
            clearTimeout(this.scrollingTimer);
            this.scrollingTimer = null;
        }

        const { state } = this.mergedProps;

        requisitions.unregister("settingsChanged", this.handleSettingsChanged);
        requisitions.unregister("editorExecuteSelectedOrAll", this.executeSelectedOrAll);
        requisitions.unregister("editorExecuteCurrent", this.executeCurrent);
        requisitions.unregister("editorFind", this.find);
        requisitions.unregister("editorFormat", this.format);
        requisitions.unregister("editorSelectStatement", this.handleSelectStatement);

        const editor = this.backend;

        // Save the current view state also before the editor is destroyed.
        if (state && editor) {
            state.viewState = editor.saveViewState();
            state.contextStates = state.model.executionContexts.cleanUpAndReturnState();
            state.options = this.options;
        }

        this.disposables.forEach((d: IDisposable) => {
            return d.dispose();
        });
        this.disposables = [];

        this.resizeObserver?.unobserve(this.hostRef.current as Element);
    }

    public componentDidUpdate(prevProps: ICodeEditorProperties): void {
        const { initialContent, state, autoFocus, createResultPresentation } = this.mergedProps;

        const editor = this.backend;
        if (state?.model !== editor?.getModel()) {
            if (prevProps.state && editor) {
                // Save the current state before switching to the new model.
                prevProps.state.viewState = editor.saveViewState();
                prevProps.state.contextStates = prevProps.state.model.executionContexts.cleanUpAndReturnState();
                prevProps.state.options = this.options;
            }

            if (state) {
                if (!state.model.isDisposed()) {
                    editor?.setModel(state.model);
                }

                if (state.viewState) {
                    editor?.restoreViewState(state.viewState);
                }
                this.options = state.options;
            }

            const model = this.model;
            if (model) {
                if (state && state.contextStates && state.contextStates.length > 0 && createResultPresentation) {
                    model.executionContexts.restoreFromState(this, createResultPresentation, state.contextStates);
                } else {
                    if (!state) {
                        model.setValue(initialContent ?? "");
                    }

                    if (model.getLanguageId() === "msg" && model.getLineCount() > 0) {
                        this.generateExecutionBlocksFromContent();
                    } else {
                        this.addInitialBlock(model);
                    }
                }
            }
        }

        this.editor?.layout();
        Monaco.remeasureFonts();

        if (autoFocus) {
            this.editor?.focus();
        }
    }

    public render(): React.ReactNode {
        return (
            <div
                className="msg editorHost"
                ref={this.hostRef}
            />
        );
    }

    public clear = (): void => {
        const model = this.model;
        if (model) {
            model.setValue("");
        }
    };

    public focus(): void {
        this.editor?.focus();
    }

    public get options(): ICodeEditorOptions {
        const options = this.model?.getOptions();
        if (options) {
            return {
                tabSize: options.tabSize,
                insertSpaces: options.insertSpaces,
                indentSize: options.indentSize,
                defaultEOL: options.defaultEOL === Monaco.DefaultEndOfLine.LF ? "LF" : "CRLF",
                trimAutoWhitespace: options.trimAutoWhitespace,
            };
        }

        return {};
    }

    public set options(value: ICodeEditorOptions) {
        const model = this.model;
        if (model) {
            model.updateOptions({
                tabSize: value.tabSize,
                insertSpaces: value.insertSpaces,
                indentSize: value.indentSize,
                trimAutoWhitespace: value.trimAutoWhitespace,
            });

            if (value.defaultEOL) {
                model.pushEOL(value.defaultEOL === "LF" ? Monaco.EndOfLineSequence.LF : Monaco.EndOfLineSequence.CRLF);
            }
        }
    }

    /**
     * Appends the given text and scrolls it into view. Selections are not overwritten, but the ranges are removed.
     *
     * @param text The text to append.
     */
    public appendText(text = ""): void {
        const model = this.model;
        const editor = this.backend;
        if (model && editor) {
            const lastLineCount = model.getLineCount();
            const lastLineLength = model.getLineMaxColumn(lastLineCount);

            const range = new Range(
                lastLineCount, lastLineLength, lastLineCount, lastLineLength,
            );

            // Add line and set cursor onto the beginning of that line.
            editor.executeEdits("", [{ range, text }], () => {
                return [new Selection(lastLineCount + 1, 1, lastLineCount + 1, 1)];
            });

            // Finally make last line visible.
            editor.setScrollPosition(
                { scrollTop: editor.getScrollHeight()/* - editor.getLayoutInfo().height * 1.5*/ },
                Monaco.ScrollType.Smooth);
        }
    }

    /**
     * Replaces the current selection with the given text or, if no selection exists, inserts the text into the
     * current position.
     *
     * @param text The text to insert.
     */
    public insertText(text = ""): void {
        const model = this.model;
        const backend = this.backend;
        if (model && backend) {
            const selection = backend.getSelection() || new Range(0, 0, 0, 0);
            const id = { major: 1, minor: 1 };
            const op = { identifier: id, range: selection, text, forceMoveMarkers: true };
            backend.executeEdits("", [op]);
        }
    }

    /**
     * Appends a new execution block to the end of the block list.
     *
     * @param startLine The line where the block starts (and also ends currently).
     * @param language The language to use for the new block. If not specified the language from the last
     *                 block is used.
     *
     * @returns The newly added execution context.
     */
    public addExecutionBlock(startLine: number, language: EditorLanguage): ExecutionContext | undefined {
        const { createResultPresentation } = this.mergedProps;

        const editor = this.backend;
        const model = this.model;
        if (editor && model && createResultPresentation) {
            const presentation = createResultPresentation(this, language);
            presentation.startLine = startLine;
            presentation.endLine = startLine;
            const context = model.executionContexts.addContext(presentation);

            editor.setPosition({ lineNumber: startLine, column: 1 });
            setImmediate(() => {
                editor.setScrollPosition(
                    { scrollTop: editor.getScrollHeight()/* - editor.getLayoutInfo().height * 1.5*/ },
                    Monaco.ScrollType.Smooth);
            });

            return context;
        }

    }

    /**
     * Called when a block was executed and the caret should move to the next block. If there's no next block then
     * a new one is added and used.
     *
     * @param index The index of the block that was last executed.
     * @param language The language to use for the new block (if required). If not given the language from the
     *                 last block is used.
     *
     * @returns The newly added execution context.
     */
    public prepareNextExecutionBlock(index = -1, language?: EditorLanguage): ExecutionContext | undefined {
        let block;

        const model = this.model;
        if (model) {
            if (index === -1 || index === model.executionContexts.count - 1) {
                this.addingNewContext = true;
                try {
                    this.appendText("\n");
                    block = this.addExecutionBlock(model.getLineCount(),
                        language ?? model.executionContexts.language ?? "typescript");
                } finally {
                    this.addingNewContext = false;
                }
            } else {
                block = model.executionContexts.contextAt(index + 1);
                const editor = this.backend;
                if (editor && block) {
                    editor.setPosition({
                        lineNumber: block.endLine,
                        column: model.getLineMaxColumn(block.endLine),
                    });

                    if (block.endLine + 1 < model.getLineCount()) {
                        editor.revealLine(block.endLine + 1, Monaco.ScrollType.Smooth);
                    } else {
                        editor.setScrollPosition(
                            { scrollTop: editor.getScrollHeight()/* - editor.getLayoutInfo().height * 1.5*/ },
                            Monaco.ScrollType.Smooth);
                    }
                }
            }
        }

        return block;
    }

    /**
     * @returns Returns the last execution context in the editor.
     */
    public get lastExecutionBlock(): ExecutionContext | undefined {
        const model = this.model;

        return model?.executionContexts.last;
    }

    /**
     * @returns The index of the block under the caret or -1 if there's none.
     */
    public get currentBlockIndex(): number {
        const editor = this.backend;
        const model = this.model;
        if (editor && model) {
            return model.executionContexts.contextIndexFromPosition(editor.getPosition());
        }

        return -1;
    }

    /**
     * @returns The underlying monaco editor interface.
     */
    public get backend(): Monaco.IStandaloneCodeEditor | undefined {
        return this.editor;
    }

    public get content(): string {
        const model = this.model;
        if (model) {
            return model.getValue();
        }

        return "";
    }

    /**
     * Executes the given text in the current block. Works best if that block has no content yet.
     *
     * @param text The text to execute.
     */
    public executeText(text: string): void {
        this.appendText(text);
        this.executeCurrentContext(false, true, false);
    }

    private handleSettingsChanged = (entry?: { key: string; value: unknown }): Promise<boolean> => {
        if (!entry) {
            this.forceUpdate();
        } else {
            switch (entry.key) {
                case "editor.wordWrap": {
                    const { allowSoftWrap } = this.mergedProps;

                    if (allowSoftWrap) {
                        const editor = this.backend;
                        editor?.updateOptions({ wordWrap: entry.value as WordWrapType });
                    }

                    break;
                }

                case "editor.showHidden": {
                    const editor = this.backend;
                    const renderWhitespace = entry.value as boolean ? "all" : "none";
                    const renderControlCharacters = entry.value as boolean;

                    editor?.updateOptions({ renderWhitespace, renderControlCharacters });

                    break;
                }

                case "editor.showMinimap":
                case "dbEditor.useMinimap": {
                    const { minimap } = this.mergedProps;
                    const showMinimap = settings.get("editor.showMinimap", true);
                    const useMinimap = settings.get("dbEditor.useMinimap", false);
                    const effectiveMinimapSettings = minimap ?? {
                        enabled: true,
                    };
                    effectiveMinimapSettings.enabled = showMinimap && useMinimap;

                    const editor = this.backend;
                    editor?.updateOptions({ minimap: effectiveMinimapSettings });

                    break;
                }

                default:
            }
        }

        return Promise.resolve(true);
    };

    /**
     * Additional setup beside the initial configuration.
     */
    private prepareUse(): void {
        const { language } = this.mergedProps;
        const editor = this.backend!;

        const precondition = "editorTextFocus && !suggestWidgetVisible && !renameInputVisible && !inSnippetMode " +
            "&& !quickFixWidgetVisible";

        const blockBased = language === "msg";
        editor.addAction({
            id: "executeCurrentAndAdvance",
            label: blockBased ? "Execute Block and Advance" : "Execute Script",
            keybindings: [KeyMod.CtrlCmd | KeyCode.Enter],
            contextMenuGroupId: "2_execution",
            precondition,
            run: () => {
                this.executeCurrentContext(false, true, false);
            },
        });

        editor.addAction({
            id: "executeCurrent",
            label: blockBased ? "Execute Block" : "Execute Script and Move Cursor",
            keybindings: [KeyMod.Shift | KeyCode.Enter],
            contextMenuGroupId: "2_execution",
            precondition,
            run: () => { return this.executeCurrentContext(false, false, false); },
        });

        editor.addAction({
            id: "executeCurrentStatement",
            label: "Execute Current Statement",
            keybindings: [KeyMod.Shift | KeyMod.CtrlCmd | KeyCode.Enter],
            contextMenuGroupId: "2_execution",
            precondition,
            run: () => { return this.executeCurrentContext(true, false, false); },
        });

        if (blockBased) {
            editor.addAction({
                id: "sendBlockUpdates",
                label: "Update SQL in Original Source File",
                keybindings: [KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyU],
                contextMenuGroupId: "3_linked",
                precondition,
                run: () => { return this.runContextCommand("sendBlockUpdates"); },
            });

        }

        // In embedded mode some key combinations don't work by default. So we add handlers for them here.
        // Doing that always doesn't harm, as we do not trigger other actions than what they do normally.
        editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyV, () => {
            editor.trigger("source", "editor.action.clipboardPasteAction", null);
        });

        editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyC, () => {
            editor.trigger("source", "editor.action.clipboardCopyAction", null);
        });

        editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyX, () => {
            editor.trigger("source", "editor.action.clipboardCutAction", null);
        });

        editor.addCommand(KeyMod.CtrlCmd | KeyCode.Enter, () => {
            editor.trigger("source", "acceptSelectedSuggestion", null);
        }, "suggestWidgetVisible");

        editor.addCommand(KeyCode.Backspace, this.handleBackspace);
        editor.addCommand(KeyCode.Delete, this.handleDelete);
        editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyA, this.handleSelectAll);

        this.disposables.push(editor);
        this.disposables.push(editor.onDidChangeCursorPosition((e: Monaco.ICursorPositionChangedEvent) => {
            if (language === "msg") {
                const model = this.model;
                if (model) {
                    model.executionContexts.cursorPosition = e.position;
                }
            }

            const { onCursorChange } = this.mergedProps;
            onCursorChange?.(e.position);
        }));

        this.disposables.push(editor.onDidChangeModelContent(this.handleModelChange));
        this.disposables.push(editor.onDidPaste(this.handlePaste));

        this.disposables.push(editor.onDidScrollChange(() => {
            this.scrolling = true;
            if (this.scrollingTimer) {
                clearTimeout(this.scrollingTimer);
            }
            this.scrollingTimer = setTimeout(() => {
                this.scrolling = false;
                if (this.scrollingTimer) {
                    clearTimeout(this.scrollingTimer);
                }

                this.scrollingTimer = null;
            }, 500);
        }));

        this.disposables.push(editor.onDidChangeModelOptions(() => {
            const { onOptionsChanged } = this.mergedProps;
            onOptionsChanged?.();
        }));

        requisitions.register("settingsChanged", this.handleSettingsChanged);
        requisitions.register("editorExecuteSelectedOrAll", this.executeSelectedOrAll);
        requisitions.register("editorExecuteCurrent", this.executeCurrent);
        requisitions.register("editorFind", this.find);
        requisitions.register("editorFormat", this.format);
        requisitions.register("editorSelectStatement", this.handleSelectStatement);
    }

    /**
     * Handles input of a single backspace keypress. This is used to block removing execution contexts when the caret
     * is at the start of the context and the user presses backspace.
     */
    private handleBackspace = (): void => {
        const editor = this.backend;
        const model = this.model;
        if (editor && model) {
            const selections = editor.getSelections();
            selections?.forEach((selection) => {
                if (!selection.isEmpty()) {
                    // Simply remove the selection, if it is not empty.
                    const op = { range: selection, text: "", forceMoveMarkers: true };
                    editor.executeEdits("delete", [op]);
                } else {
                    // No selection -> single character deletion.
                    const context = model.executionContexts.contextFromPosition({
                        lineNumber: selection.startLineNumber,
                        column: selection.startColumn,
                    });

                    if (context) { // Should always be assigned.
                        // Do nothing with this position if the user going to remove the line break that separates
                        // execution contexts.
                        if (context.startLine === selection.startLineNumber && selection.startColumn === 1) {
                            // Do nothing.
                        } else {
                            const range = {
                                startLineNumber: 0,
                                startColumn: 0,
                                endLineNumber: 0,
                                endColumn: 0,
                            };

                            if (selection.startColumn > 1) {
                                range.startLineNumber = selection.startLineNumber;
                                range.startColumn = selection.startColumn - 1;
                                range.endLineNumber = selection.startLineNumber;
                                range.endColumn = selection.startColumn;
                            } else if (selection.startLineNumber > 1) {
                                const previousColumn = model.getLineMaxColumn(selection.startLineNumber - 1);
                                range.startLineNumber = selection.startLineNumber;
                                range.startColumn = selection.startColumn;
                                range.endLineNumber = selection.startLineNumber - 1;
                                range.endColumn = previousColumn;
                            }

                            const op = { range, text: "", forceMoveMarkers: true };
                            editor.executeEdits("backspace", [op]);
                        }
                    }
                }
            });
        }
    };

    /**
     * Handles input of a single delete keypress. This is used to block removing execution contexts when the caret
     * is at the end of the context and the user presses delete.
     */
    private handleDelete = (): void => {
        const editor = this.backend;
        const model = this.model;
        if (editor && model) {
            const selections = editor.getSelections();
            selections?.forEach((selection) => {
                if (!selection.isEmpty()) {
                    // Simply remove the selection, if it is not empty.
                    const op = { range: selection, text: "", forceMoveMarkers: true };
                    editor.executeEdits("delete", [op]);
                } else {
                    // No selection -> single character deletion.
                    const context = model.executionContexts.contextFromPosition({
                        lineNumber: selection.startLineNumber,
                        column: selection.startColumn,
                    });

                    if (context) { // Should always be assigned.
                        // Do nothing with this position if the user going to remove the line break that separates
                        // execution contexts.
                        let endColumn = model.getLineMaxColumn(context.endLine ?? 0);
                        if (context.endLine === selection.startLineNumber && selection.startColumn === endColumn) {
                            // Do nothing.
                        } else {
                            const range = {
                                startLineNumber: 0,
                                startColumn: 0,
                                endLineNumber: 0,
                                endColumn: 0,
                            };

                            endColumn = model.getLineMaxColumn(selection.startLineNumber);
                            if (selection.startColumn === endColumn) {
                                // At the end of the line (but not the last line, which is checked above).
                                range.startLineNumber = selection.startLineNumber;
                                range.startColumn = endColumn;
                                range.endLineNumber = selection.startLineNumber + 1;
                                range.endColumn = 1;
                            } else {
                                // Any other position within the text.
                                range.startLineNumber = selection.startLineNumber;
                                range.startColumn = selection.startColumn;
                                range.endLineNumber = selection.startLineNumber;
                                range.endColumn = selection.startColumn + 1;
                            }

                            const op = { range, text: "", forceMoveMarkers: true };
                            editor.executeEdits("delete", [op]);
                        }
                    }
                }
            });
        }
    };

    /**
     * Handles command/control + A, to modify select-all behavior. On first key press only the current context
     * is selected. A second key press within 500ms selects all text.
     */
    private handleSelectAll = (): void => {
        const editor = this.backend;
        const model = this.model;
        if (editor && model) {
            const position = editor.getPosition();
            if (position) {
                if (!this.keyboardTimer) {
                    // This is the first key stroke. Do only a local select all and start the timer.
                    const context = model.executionContexts.contextFromPosition(position);
                    if (context) {
                        editor.setSelection({
                            startLineNumber: context.startLine,
                            startColumn: 1,
                            endLineNumber: context.endLine,
                            endColumn: model.getLineMaxColumn(context.endLine),
                        });

                        this.keyboardTimer = setTimeout(() => {
                            this.keyboardTimer = null;
                        }, 500);

                        return;
                    }
                }
            }

            const lastLine = model.getLineCount();
            editor.setSelection({
                startLineNumber: 1,
                startColumn: 1,
                endLineNumber: lastLine,
                endColumn: model.getLineMaxColumn(lastLine),
            });
        }
    };

    private handleSelectStatement = (details: { contextId: string; statementIndex: number }): Promise<boolean> => {
        return new Promise((resolve) => {

            const model = this.model;
            if (model) {
                const contexts = model.executionContexts;
                const context = contexts.contextWithId(details.contextId);
                if (context) {
                    context.selectStatement(details.statementIndex);
                    resolve(true);

                    return;
                }
            }

            resolve(false);
        });
    };

    /**
     * Called whenever the content of the editor model changes.
     *
     * @param e The event with the change information.
     */
    private handleModelChange = (e: Monaco.IModelContentChangedEvent): void => {
        const model = this.model;
        if (model) {
            const contexts = model.executionContexts;

            switch (model.getLanguageId()) {
                case "msg": {
                    this.updateExecutionContexts(e.changes);

                    break;
                }

                case "mysql":
                case "sql": {
                    const context = contexts.first;
                    context?.applyEditorChanges(e.changes);

                    break;
                }

                default: {
                    // JavaScript and TypeScript, which have their own processing.
                    break;
                }
            }

            const { onModelChange } = this.mergedProps;

            onModelChange?.();
        }
    };

    private handlePaste = (e: Monaco.IPasteEvent): void => {
        const editorRange = Range.lift(e.range);

        const range = {
            startLine: editorRange.startLineNumber,
            startColumn: editorRange.startColumn,
            endLine: editorRange.endLineNumber,
            endColumn: editorRange.endColumn,
        };
        this.scanForLanguageSwitches(range);
    };

    private get model(): ICodeEditorModel | null {
        return this.editor?.getModel() as ICodeEditorModel;
    }

    /**
     * Executes the context where the caret is in.
     *
     * @param atCaret If true then execute only the statement at the caret position. This is valid only for
     *                SQL like languages.
     * @param advance If true, move the caret to the next block. If there's no block, create a new one first.
     * @param forceSecondaryEngine Tells the executor to add a hint to SELECT statements to use the secondary
     *                             engine (usually HeatWave).
     */
    private executeCurrentContext(atCaret: boolean, advance: boolean, forceSecondaryEngine: boolean): void {
        const editor = this.backend;
        const model = this.model;
        if (editor && model) {
            const index = this.currentBlockIndex;
            if (index > -1) {
                const block = model.executionContexts.contextAt(index);
                if (block) {
                    if (this.handleInternalCommand(index) === "unhandled") {
                        const { onScriptExecution } = this.mergedProps;

                        let position: IPosition | undefined = atCaret ? editor.getPosition() ?? undefined : undefined;
                        if (position) {
                            position = block.toLocal(position);
                        }

                        void onScriptExecution?.(block, { forceSecondaryEngine, source: position }).then((executed) => {
                            editor.focus();
                            if (executed) {
                                if (advance) {
                                    this.prepareNextExecutionBlock(index);
                                } else {
                                    editor.revealLine(block.endLine + 1, Monaco.ScrollType.Smooth);
                                    if (block.endLine + 1 < model.getLineCount()) {
                                        editor.revealLine(block.endLine + 1, Monaco.ScrollType.Smooth);
                                    } else {
                                        editor.setScrollPosition({ scrollTop: editor.getScrollHeight() },
                                            Monaco.ScrollType.Smooth);
                                    }
                                }
                            }
                        });
                    }
                }
            }
        }
    }

    private runContextCommand(command: string): void {
        const model = this.model;
        if (model) {
            const index = this.currentBlockIndex;
            if (index > -1) {
                const context = model.executionContexts.contextAt(index);
                if (context) {
                    void requisitions.execute("editorRunCommand", { command, context });
                }
            }
        }
    }

    /**
     * Applies the given change to all blocks specified by the index list.
     *
     * @param changes The changes to apply, in last to first order.
     */
    private updateExecutionContexts(changes: Monaco.IModelContentChange[]): void {
        interface IChangeRecord {
            changes: Monaco.IModelContentChange[];
            changedLineCount: number;
            lastEndLine: number;
        }

        const model = this.model;
        if (model) {
            const contexts = model.executionContexts;

            // Go through each change individually and send it to the affected blocks.
            // Keep in mind that model changes are already applied in the editor. We are solely updating our own
            // structures here.

            // As there can be multiple changes for a single context and also changes can remove contexts that itself
            // have changes, collect the changes for each context individually and remove indices on the way,
            // for contexts that are removed by an edit change. That avoids unnecessary handling for obsolete contexts.
            const changesPerContext = new Map<number, IChangeRecord>();

            changes.forEach((change: Monaco.IModelContentChange) => {
                const contextsToUpdate = contexts.contextIndicesFromRange(editorRangeToTextRange(change.range));
                if (contextsToUpdate.length > 0) {
                    const contextIndex = contextsToUpdate.shift()!;
                    const firsContext = contexts.contextAt(contextIndex);

                    if (!changesPerContext.has(contextIndex)) {
                        changesPerContext.set(contextIndex, { changes: [], changedLineCount: 0, lastEndLine: 0 });
                    }
                    const record = changesPerContext.get(contextIndex)!;
                    record.changes.push(change);

                    // All touched blocks for a change are merged together into one.
                    // Compute the number of changed lines, base on removed lines (<= 0) ...
                    record.changedLineCount += change.range.startLineNumber - change.range.endLineNumber;

                    // ... and added lines.
                    for (const c of change.text) {
                        if (c === "\n") {
                            ++record.changedLineCount;
                        }
                    }

                    // Changes cannot overlap each other, but a context can receive more than one change.
                    // So, check if the current update list ends with a context that has already changes recorded and
                    // will now be removed. If that's the case add its line values to the current record and remove it.
                    if (contextsToUpdate.length > 0) {
                        // Act only if there's more than a single context in the update list.
                        const lastIndex = contextsToUpdate[contextsToUpdate.length - 1];
                        const lastRecord = changesPerContext.get(lastIndex);
                        if (lastRecord) {
                            record.changedLineCount += lastRecord.changedLineCount;
                            record.lastEndLine = lastRecord.lastEndLine;

                            changesPerContext.delete(lastIndex);
                        } else {
                            // Record the end line of the last affected context for later application.
                            record.lastEndLine = contexts.contextAt(lastIndex)?.endLine ?? 0;

                        }
                    } else {
                        // Only one block affected by the change, so only record its own current end line.
                        record.lastEndLine = firsContext?.endLine ?? 0;
                    }

                    // Remove the result from the first block if there's more than one block in the update list.
                    // In this case the first result is in the selection range that has been removed.
                    if (contextsToUpdate.length > 0) {
                        firsContext?.setResult();
                    }

                    // Remove all but the first block.
                    contexts.removeContexts(contextsToUpdate);
                }
            });

            changesPerContext.forEach((record, index) => {
                for (let i = index + 1; i < contexts.count; ++i) {
                    contexts.contextAt(i)?.movePosition(record.changedLineCount);
                }

                // Finally send the changes to the remaining block.
                const context = contexts.contextAt(index);
                if (context) {
                    if (!this.addingNewContext) {
                        context.endLine = record.lastEndLine + record.changedLineCount;
                    }
                    context.applyEditorChanges(record.changes);
                }

            });
        }
    }

    /**
     * Checks the block that is in the given range if it contains a language switch. If that is the case
     * it is split at these switches.
     *
     * @param range The range that was changed by an edit action. It should only touch a single block.
     */
    private scanForLanguageSwitches(range: ITextRange): void {
        const model = this.model;
        if (model) {
            const contextsToUpdate = this.contextIndicesFromRange(range);

            if (contextsToUpdate.length > 0) {
                const firstIndex = contextsToUpdate[0];
                const firstBlock = model.executionContexts.contextAt(firstIndex)!;
                const blocks = this.splitText(firstBlock);
                if (blocks.length > 1) {
                    const { createResultPresentation } = this.mergedProps;

                    const offset = firstBlock.startLine;

                    // The first block exists already, so remove it from the list.
                    // But we have to update its end line first.
                    firstBlock.endLine = blocks[0][2] + offset;
                    firstBlock.scheduleFullValidation();

                    blocks.shift();
                    if (createResultPresentation) {
                        blocks.forEach(
                            ([language, start, end]: [EditorLanguage, number, number], index: number): void => {
                                const presentation = createResultPresentation(this, language);
                                const context = model.executionContexts.insertContext(firstIndex + index + 1,
                                    presentation);
                                context.startLine = start + offset;
                                context.endLine = end + offset;
                                context.scheduleFullValidation();
                            });
                    }
                }
            }
        }
    }

    /**
     * Collects the indices of all blocks that overlap the given range.
     *
     * @param range The range in which to search.
     *
     * @returns A list of indices for editor blocks that at least partially touch the given range.
     *          The returned list is sorted.
     */
    private contextIndicesFromRange(range: ITextRange): number[] {
        const model = this.model;
        if (model) {
            return model.executionContexts.contextIndicesFromRange(range);
        }

        return [];
    }

    /**
     * Called when a new model was set for this editor.
     * It creates the initial block list based on the found language switches in the text.
     */
    private generateExecutionBlocksFromContent = (): void => {
        const { createResultPresentation } = this.mergedProps;

        const editor = this.backend;
        const model = this.model;
        if (model && editor && createResultPresentation) {
            model.executionContexts.cleanUpAndReturnState();

            const blocks = this.splitText(model.getValue());
            blocks.forEach(([language, start, end]: [EditorLanguage, number, number]): void => {
                const presentation = createResultPresentation(this, language);
                presentation.startLine = start + 1;
                presentation.endLine = end + 1;
                model.executionContexts.addContext(presentation);
            });
        }
    };

    /**
     * Adds the initial execution block (for the combined language) or the only block (for a single language).
     *
     * @param model The model used in the editor.
     */
    private addInitialBlock(model: ICodeEditorModel): void {
        const { sqlDialect, allowedLanguages = [], startLanguage } = this.mergedProps;

        let blockLanguage: EditorLanguage;
        if (model.getLanguageId() === "msg") {
            blockLanguage = startLanguage ?? "javascript";
            if (allowedLanguages.length > 0) {
                if (!allowedLanguages.includes(blockLanguage)) {
                    blockLanguage = allowedLanguages[0];
                }
            }

            if (blockLanguage === "sql" && sqlDialect) {
                blockLanguage = sqlDialect as EditorLanguage;
            }
        } else {
            blockLanguage = model.getLanguageId() as EditorLanguage;
        }

        this.addExecutionBlock(1, blockLanguage);
    }

    /**
     * Collects relative line numbers for block starts in the given text, by looking for language switch lines.
     *
     * @param startOrText Either the context where the new text starts or new text to add into an empty editor.
     *
     * @returns A list block entries with language, start and stop line (both zero-based).
     */
    private splitText = (startOrText: ExecutionContext | string): Array<[EditorLanguage, number, number]> => {
        const { language, allowedLanguages = [], startLanguage, sqlDialect } = this.mergedProps;

        const result: Array<[EditorLanguage, number, number]> = [];

        // Determine a language to start with.
        let currentLanguage: EditorLanguage = "javascript";
        let text = "";
        if (typeof startOrText === "string") {
            text = startOrText;
            currentLanguage = (language === "msg" ? startLanguage : language) ?? "javascript";

            if (currentLanguage && allowedLanguages.length > 0) {
                if (!allowedLanguages.includes(currentLanguage)) {
                    // The current language is not allowed. Pick the first one in the allowed languages list.
                    currentLanguage = allowedLanguages[0];
                }
            }
        } else {
            text = startOrText.code;
            currentLanguage = startOrText.language;
        }

        if (currentLanguage === "sql" && sqlDialect) {
            currentLanguage = sqlDialect as EditorLanguage;
        }

        let start = 0;
        let end = 0;
        text.split("\n").forEach((line: string) => {
            let trimmed = line.trim();
            if (trimmed.length > 0 && trimmed.startsWith("\\")) {
                trimmed = trimmed.slice(1);
                const language = CodeEditor.languageMap.get(trimmed);
                if (language && allowedLanguages.includes(language)) {
                    if (end > start) {
                        // Push the block content before the language switch, if there's any.
                        result.push([currentLanguage, start, end - 1]);
                    }

                    // Push the language switch as own block.
                    result.push([currentLanguage, end, end]);

                    start = end + 1;
                    currentLanguage = language;
                }
            }

            ++end;
        });

        if (end > start) {
            // Push the remaining content as own text block.
            result.push([currentLanguage, start, end - 1]);
        }

        return result;
    };

    private handleEditorResize = (entries: readonly ResizeObserverEntry[]): void => {
        if (entries.length > 0) {
            const rect = entries[0].contentRect;
            this.editor?.layout({ width: rect.width, height: rect.height });
        }
    };

    /**
     * Checks if the given code is something that must be internally handled (for instance language switches).
     *
     * @param index The index of the block to execute.
     *
     * @returns A string indicating what to do next with that block.
     */
    private handleInternalCommand(index: number): "handled" | "ignore" | "unhandled" {
        const { allowedLanguages = [] } = this.mergedProps;

        const model = this.model;
        if (model) {
            const terminalMode = model.editorMode === CodeEditorMode.Terminal;
            const block = model.executionContexts.contextAt(index)!;
            if (block.isInternal) {
                let trimmed = block.code.trim();

                // Blocks to switch languages cannot be re-executed, as they change state and all following
                // blocks consider that state. Hence disallow such a block if this is not the last
                // one in the editor.
                if (index < model.executionContexts.count - 1) {
                    // TODO: mark error
                    return terminalMode ? "unhandled" : "ignore";
                }

                trimmed = trimmed.slice(1);
                if (!terminalMode && (trimmed === "?" || trimmed === "h" || trimmed === "help")) {
                    const { onHelpCommand } = this.mergedProps;
                    const helpText = onHelpCommand?.(trimmed, block.language);
                    if (helpText) {
                        block.setResult({
                            type: "text",
                            text: [{ type: MessageType.Info, content: helpText, language: "markdown" }],
                        });

                        this.prepareNextExecutionBlock(index);
                    } else {
                        block.setResult({
                            type: "text",
                            text: [{ type: MessageType.Error, content: "No help available" }],
                        });
                    }

                    return "handled";
                }

                const language = CodeEditor.languageMap.get(trimmed);
                if (!language || language === block.language ||
                    allowedLanguages.length === 0 || !allowedLanguages.includes(language)) {
                    return "unhandled";
                }

                switch (language) {
                    case "sql": {
                        const { sqlDialect = "sql" } = this.mergedProps;
                        if (!terminalMode) {
                            const uiString = CodeEditor.sqlUiStringMap.get(sqlDialect) || "SQL";

                            block.setResult({
                                type: "text",
                                executionInfo: { type: MessageType.Info, text: `Switched to ${uiString} mode` },
                            });
                        }
                        this.prepareNextExecutionBlock(index, sqlDialect as EditorLanguage);

                        break;
                    }

                    case "javascript": {
                        if (!terminalMode) {
                            block.setResult({
                                type: "text",
                                executionInfo: { type: MessageType.Info, text: `Switched to JavaScript mode` },
                            });
                        }
                        this.prepareNextExecutionBlock(index, "javascript");

                        break;
                    }

                    case "typescript": {
                        if (!terminalMode) {
                            block.setResult({
                                type: "text",
                                executionInfo: { type: MessageType.Info, text: `Switched to TypeScript mode` },
                            });
                        }
                        this.prepareNextExecutionBlock(index, "typescript");

                        break;
                    }

                    case "python": {
                        if (!terminalMode) {
                            block.setResult({
                                type: "text",
                                executionInfo: { type: MessageType.Info, text: `Switched to Python mode` },
                            });
                        }
                        this.prepareNextExecutionBlock(index, "python");

                        break;
                    }

                    default: {
                        return "unhandled";
                    }
                }

                return terminalMode ? "unhandled" : "handled";
            }
        }

        return "unhandled";
    }

    private executeSelectedOrAll = (options: IEditorExecutionOptions): Promise<boolean> => {
        const { language } = this.mergedProps;

        const editor = this.backend;
        const model = this.model;
        const terminalMode = model?.editorMode === CodeEditorMode.Terminal;

        const advance = (language === "msg") && options.startNewBlock;
        this.executeCurrentContext(false, advance || terminalMode, options.forceSecondaryEngine);
        editor?.focus();

        return Promise.resolve(true);
    };

    private executeCurrent = (options: IEditorExecutionOptions): Promise<boolean> => {
        const { language } = this.mergedProps;

        const editor = this.backend;
        const model = this.model;
        const terminalMode = model?.editorMode === CodeEditorMode.Terminal;

        const advance = (language === "msg") && options.startNewBlock;
        this.executeCurrentContext(true, advance || terminalMode, options.forceSecondaryEngine);
        editor?.focus();

        return Promise.resolve(true);
    };

    private find = (): Promise<boolean> => {
        const editor = this.backend;

        // Focus the editor first or the action won't find an editor to work on.
        editor?.focus();
        const action = editor?.getAction("actions.find");

        if (action) {
            return new Promise((resolve) => {
                void action.run().then(() => { resolve(true); });
            });
        } else {
            return Promise.resolve(false);
        }
    };

    private format = (): Promise<boolean> => {
        const editor = this.backend;

        editor?.focus();
        const action = editor?.getAction("editor.action.formatDocument");

        if (action) {
            return new Promise((resolve) => {
                void action.run().then(() => { resolve(true); });
            });
        } else {
            return Promise.resolve(false);
        }
    };

}

requisitions.register("themeChanged", (data: IThemeChangeData): Promise<boolean> => {
    CodeEditor.updateTheme(data.name, data.type, data.values);

    return Promise.resolve(true);
});

setImmediate(() => {
    // Need to delay the configuration call a tad to avoid trouble with Jest tests.
    CodeEditor.configureMonaco();
});
