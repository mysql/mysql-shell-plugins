/*
 * Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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

import { SymbolTable } from "antlr4-c3";
import Color from "color";
import { ComponentChild, createRef } from "preact";

import "./userWorker.js";

import {
    CodeEditorMode, ICodeEditorViewState, IDisposable, ILanguageDefinition, IPosition, IProviderEditorModel,
    IScriptExecutionOptions, KeyCode, KeyMod, languages, Monaco, Range, Selection,
} from "./index.js";

import { msg } from "./languages/msg/msg.contribution.js";
import { mysql } from "./languages/mysql/mysql.contribution.js";

import { ExecutionContexts } from "../../../script-execution/ExecutionContexts.js";
import { PresentationInterface } from "../../../script-execution/PresentationInterface.js";
import { EditorLanguage, isEditorLanguage, ITextRange } from "../../../supplement/index.js";
import { appParameters, requisitions } from "../../../supplement/Requisitions.js";
import {
    IEditorCommonExecutionOptions, IEditorExtendedExecutionOptions,
} from "../../../supplement/RequisitionTypes.js";
import { Settings } from "../../../supplement/Settings/Settings.js";
import { editorRangeToTextRange } from "../../../utilities/ts-helpers.js";

import { IThemeChangeData, IThemeObject, ITokenEntry } from "../../Theming/ThemeManager.js";

import { MessageType } from "../../../app-logic/general-types.js";
import { ExecutionContext } from "../../../script-execution/ExecutionContext.js";
import { splitTextToLines } from "../../../utilities/string-helpers.js";
import { ComponentBase, IComponentProperties } from "../Component/ComponentBase.js";
import type { ICodeEditorOptions } from "../index.js";
import { CodeCompletionProvider } from "./CodeCompletionProvider.js";
import { DefinitionProvider } from "./DefinitionProvider.js";
import { DocumentHighlightProvider } from "./DocumentHighlightProvider.js";
import { FormattingProvider } from "./FormattingProvider.js";
import { HoverProvider } from "./HoverProvider.js";
import { MsgSemanticTokensProvider } from "./MsgSemanticTokensProvider.js";
import { ReferencesProvider } from "./ReferencesProvider.js";
import { RenameProvider } from "./RenameProvider.js";
import { SignatureHelpProvider } from "./SignatureHelpProvider.js";

/** Used when splitting pasted text to find the individual language blocks. */
interface ITextBlockEntry {
    language: EditorLanguage;

    /** Relative start line number of the entire block. */
    startLine: number;

    /** Relative end line number (inclusive). */
    endLine: number;

    /** If different to the startLine field denotes the start of the first non-language-switch line. */
    contentStartLine: number;
}

interface IFontSettings {
    fontFamily?: string;
    fontWeight?: string;
    fontSize?: number;
    lineHeight?: number;
    letterSpacing?: number;
}

export interface ICodeEditorModel extends IProviderEditorModel {
    /** The manager of the execution contexts in a model. Not needed for local models within an execution context. */
    executionContexts?: ExecutionContexts;

    /** Contains symbols that can be used in code assistants like code completion. */
    symbols?: SymbolTable;

    session?: unknown;
}

/** The presentation class type depends on the place where the editor is used. */
export type ResultPresentationFactory = (editor: CodeEditor, language: EditorLanguage) => PresentationInterface;

/** Contains data to restore a previous state of a code editor. */
export interface IEditorPersistentState {
    viewState: ICodeEditorViewState | null;
    model: ICodeEditorModel;
    options: ICodeEditorOptions;
}

type WordWrapType = "off" | "on" | "wordWrapColumn" | "bounded";

interface ICodeEditorProperties extends IComponentProperties {
    savedState?: IEditorPersistentState;
    initialContent?: string;
    executeInitialContent?: boolean;

    /**
     * A set of either type definitions or full library code that should be loaded when this editor is mounted.
     * (will be automatically removed when the editor is unmounted).
     *
     * These extra libs are only useful for Javascript and Typescript and allow the editor to provide additional
     * code completion and type information.
     */
    extraLibs?: Array<{ code: string, path: string; }>;

    /** The language to be used when creating a default model. If a model is given, the language is taken from that. */
    language?: EditorLanguage;

    /**
     * Limits the languages this editor instance should support. Put your main/fallback language as first entry in that
     * list (if at all given), as this is what is used by default if a language is not supported.
     */
    allowedLanguages?: EditorLanguage[];

    /** Used only for the "msg" language to specify the dialect of the SQL language supported there. */
    sqlDialect?: string;

    /**
     * Used only if "msg" is the main language and no execution context exists and when the user pastes text, which
     * is then split into language blocks.
     * It determines the language of the initial execution/language block and must not be "msg".
     */
    startLanguage?: EditorLanguage;

    readonly?: boolean;
    detectLinks?: boolean;
    useTabStops?: boolean;
    autoFocus?: boolean;
    allowSoftWrap: boolean;

    /** Min width of embedded components. */
    componentMinWidth?: number;

    /** The width of the gutter area where line decorations are shown. */
    lineDecorationsWidth?: number;

    renderLineHighlight?: "none" | "gutter" | "line" | "all";
    showIndentGuides?: boolean;
    lineNumbers?: Monaco.LineNumbersType;

    minimap?: Monaco.IEditorMinimapOptions;
    suggest?: Monaco.ISuggestOptions;
    font?: IFontSettings;
    scrollbar?: Monaco.IEditorScrollbarOptions;

    onScriptExecution?: (context: ExecutionContext, options: IScriptExecutionOptions) => Promise<boolean>;
    onHelpCommand?: (command: string, currentLanguage: EditorLanguage) => string | undefined;
    onOptionsChanged?: () => void;
    onModelChange?: () => void;
    onContextLanguageChange?: (context: ExecutionContext, language: EditorLanguage) => void;

    /** The presentation class depends on the place where the editor is used. */
    createResultPresentation?: ResultPresentationFactory;
}

interface ITemplateItem {
    code: string,
    language: EditorLanguage,
}

export class CodeEditor extends ComponentBase<ICodeEditorProperties> {

    public static override readonly defaultProps = {
        detectLinks: false,
        useTabStops: false,
        componentMinWidth: 200,
        lineNumbers: "on",
        allowSoftWrap: false,
    };

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
        ["text", "text"],
    ]);

    private static monacoConfigured = false;

    private hostRef = createRef<HTMLDivElement>();
    private editor?: Monaco.IStandaloneCodeEditor;

    // Set when a new execution context is being added. Requires special handling in the change event.
    private addingNewContext = false;
    private scrolling = false;

    private scrollingTimer: ReturnType<typeof setTimeout> | null = null;
    private keyboardTimer: ReturnType<typeof setTimeout> | null = null;

    // Automatic re-layout on host resize.
    private resizeObserver?: ResizeObserver;

    // All allocated event handlers and other Monaco resources that must be explicitly disposed off.
    private disposables: IDisposable[] = [];

    private templateCodeBlocks: ITemplateItem[] = [];
    private templatePastePosition: number | undefined;

    public constructor(props: ICodeEditorProperties) {
        super(props);

        this.addHandledProperties("initialContent", "executeInitialContent", "language", "allowedLanguages",
            "sqlDialect", "readonly", "detectLinks", "showHidden", "useTabStops", "showHidden", "autoFocus",
            "allowSoftWrap", "typeDefinitions",
            "componentMinWidth", "lineDecorationsWidth", "lineDecorationsWidth", "renderLineHighlight",
            "showIndentGuides", "lineNumbers", "minimap", "suggest", "font", "scrollbar",
            "onScriptExecution", "onHelpCommand", "onOptionsChanged", "onContextLanguageChange",
            "createResultPresentation",
        );

        // istanbul ignore next
        if (typeof ResizeObserver !== "undefined") {
            this.resizeObserver = new ResizeObserver(this.handleEditorResize);
        }
    }

    /**
     * Updates the theme used by all code editor instances.
     *
     * @param theme The theme name (DOM safe).
     * @param type The base type of the theme.
     * @param values The actual theme values.
     */
    public static updateTheme(theme: string, type: "light" | "dark", values: IThemeObject): void {
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

    /**
     * Called once to initialize various aspects of the monaco-editor subsystem (like languages, themes, options etc.)
     */
    public static configureMonaco(): void {
        if (CodeEditor.monacoConfigured) {
            return;
        }

        CodeEditor.monacoConfigured = true;

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
     * A method that can be used to determine if the editor is currently scrolling its content because of mouse wheel
     * events. This is used to correctly scroll embedded content like result panes in editor zones.
     *
     * @returns True if the editor is currently scrolling.
     */
    public isScrolling = (): boolean => {
        return this.scrolling;
    };

    public override componentDidMount(): void {
        if (!this.hostRef.current) {
            return;
        }

        const {
            language, initialContent, savedState, autoFocus, readonly, minimap, detectLinks, suggest, showIndentGuides,
            renderLineHighlight, useTabStops, font, scrollbar, lineNumbers, lineDecorationsWidth, allowSoftWrap,
            extraLibs,
        } = this.props;

        const className = this.getEffectiveClassNames([
            "codeEditor",
            `decorationSet-${Settings.get("editor.theming.decorationSet", "standard")}`,
        ]);

        const showHidden = Settings.get("editor.showHidden", false);
        const wordWrap = allowSoftWrap
            ? Settings.get("editor.wordWrap", "off") as ("on" | "off" | "wordWrapColumn" | "bounded")
            : "off";
        const wordWrapColumn = Settings.get("editor.wordWrapColumn", 120);

        const guides: Monaco.IGuidesOptions = {
            indentation: showIndentGuides,
        };

        const showMinimap = Settings.get("editor.showMinimap", true);
        const useMinimap = Settings.get("dbEditor.useMinimap", false);
        const effectiveMinimapSettings = minimap ?? {
            enabled: true,
        };
        effectiveMinimapSettings.enabled = showMinimap && useMinimap;

        let combinedLanguage;

        let model: ICodeEditorModel;
        if (savedState && !savedState.model.isDisposed()) {
            model = savedState.model;
            combinedLanguage = model.getLanguageId() === "msg";
        } else {
            combinedLanguage = language === "msg";
            model = Object.assign(Monaco.createModel(initialContent ?? "", language), {
                executionContexts: new ExecutionContexts({
                    dbVersion: Settings.get("editor.dbVersion", undefined),
                    sqlMode: Settings.get("editor.sqlMode", ""),
                }),
                symbols: new SymbolTable("default", { allowDuplicateSymbols: true }),
                editorMode: CodeEditorMode.Standard,
            });


            if (model.getEndOfLineSequence() !== Monaco.EndOfLineSequence.LF) {
                model.setEOL(Monaco.EndOfLineSequence.LF);
            } else {
                // Set content again to increase model change version, in case we don't need to set
                // the end of line sequence.
                model.setValue(initialContent ?? "");
            }
        }

        const options: Monaco.IStandaloneEditorConstructionOptions = {
            "extraEditorClassName": className,
            "rulers": [],
            "cursorSurroundingLines": 2,
            "readOnly": readonly,
            "minimap": effectiveMinimapSettings,
            "find": {
                seedSearchStringFromSelection: "selection",
                autoFindInSelection: "never",
                addExtraSpaceOnTop: false,
            },
            "cursorSmoothCaretAnimation": "off",
            "fontLigatures": true,
            wordWrap,
            wordWrapColumn,
            "wrappingIndent": "indent",
            "wrappingStrategy": "advanced",
            "hover": {
                enabled: true,
            },
            "links": detectLinks,
            "colorDecorators": true,
            "contextmenu": model?.editorMode !== CodeEditorMode.Terminal,
            "suggest": suggest ?? { preview: false },
            "inlineSuggest": { enabled: true },
            "quickSuggestions": true,
            "emptySelectionClipboard": false,
            "copyWithSyntaxHighlighting": true,
            "codeLens": !combinedLanguage,
            "folding": !combinedLanguage,
            "foldingStrategy": "auto",
            "glyphMargin": !combinedLanguage,
            "showFoldingControls": "always",
            "lightbulb": { enabled: Monaco.ShowLightbulbIconMode.Off },
            "renderWhitespace": showHidden ? "all" : "none",
            "renderControlCharacters": showHidden,
            guides,
            renderLineHighlight,
            useTabStops,
            "fontFamily": font?.fontFamily,
            "fontWeight": font?.fontWeight,
            "fontSize": font?.fontSize,
            "lineHeight": font?.lineHeight,
            "letterSpacing": font?.letterSpacing,
            "showUnused": true,
            scrollbar,
            lineNumbers,
            "scrollBeyondLastLine": false,
            "lineDecorationsWidth": lineDecorationsWidth ?? (combinedLanguage ? 49 : 20),
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "semanticHighlighting.enabled": true,

            model,
        };

        this.editor = Monaco.create(this.hostRef.current, options);

        if (model) {
            if (model.executionContexts && model.executionContexts.count > 0) {
                void model.executionContexts.activateContexts(this.editor);
            } else {
                if (model.getLanguageId() === "msg" && model.getLineCount() > 1) {
                    this.generateExecutionBlocksFromContent();
                } else {
                    this.addInitialBlock(model);
                }
            }
        }

        this.editor.layout();
        if (autoFocus) {
            this.editor.focus();
        }

        this.resizeObserver?.observe(this.hostRef.current as Element);

        this.prepareUse();

        if (languages.typescript) {
            extraLibs?.forEach((entry) => {
                this.disposables.push(languages.typescript.typescriptDefaults.addExtraLib(entry.code, entry.path));
                this.disposables.push(languages.typescript.javascriptDefaults.addExtraLib(entry.code, entry.path));
            });
        }

        Monaco.remeasureFonts();

        setTimeout(() => {
            this.resizeViewZones();
        }, 0);

        if (savedState?.viewState) {
            this.editor.restoreViewState(savedState.viewState);
        }

        /*this.backend?.getSupportedActions().forEach((value: Monaco.IEditorAction) => {
            console.log(value);
        });*/
    }

    public override componentWillUnmount(): void {
        if (this.scrollingTimer) {
            clearTimeout(this.scrollingTimer);
            this.scrollingTimer = null;
        }

        const { savedState } = this.props;

        requisitions.unregister("settingsChanged", this.handleSettingsChanged);
        requisitions.unregister("editorExecuteSelectedOrAll", this.executeSelectedOrAll);
        requisitions.unregister("editorExecute", this.executeContext);
        requisitions.unregister("editorFind", this.executeFind);
        requisitions.unregister("editorFormat", this.executeFormat);
        requisitions.unregister("editorSelectStatement", this.handleSelectStatement);

        const editor = this.backend;

        // Save the current view state also before the editor is destroyed.
        if (savedState && editor) {
            savedState.viewState = editor.saveViewState();
            savedState.model.executionContexts?.deactivateContexts();
            savedState.options = this.options;
        }

        this.disposables.forEach((d: IDisposable) => {
            return d.dispose();
        });
        this.disposables = [];

        this.resizeObserver?.unobserve(this.hostRef.current as Element);
    }

    public override componentDidUpdate(prevProps: ICodeEditorProperties): void {
        const { initialContent, language, savedState, autoFocus } = this.props;

        const editor = this.backend;
        if (editor && savedState?.model !== editor.getModel()) {
            if (prevProps.savedState && editor) {
                // Save the current state before switching to the new model.
                prevProps.savedState.viewState = editor.saveViewState();
                prevProps.savedState.model.executionContexts?.deactivateContexts();
                prevProps.savedState.options = this.options;
            }

            if (savedState) {
                if (!savedState.model.isDisposed()) {
                    editor?.setModel(savedState.model);
                }

                if (savedState.viewState) {
                    editor?.restoreViewState(savedState.viewState);
                }
                this.options = savedState.options;
            }

            const model = this.model;
            if (model) {
                if (!savedState && language) {
                    Monaco.setModelLanguage(model, language);
                }

                if (model.executionContexts && model.executionContexts.count > 0) {
                    void model.executionContexts?.activateContexts(editor);
                } else {
                    if (!savedState) {
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

    public render(): ComponentChild {
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
                model.setEOL(value.defaultEOL === "LF" ? Monaco.EndOfLineSequence.LF : Monaco.EndOfLineSequence.CRLF);
            }
        }
    }

    /**
     * This method provides a separate way to add extra libs to the editor. Usually they are set via properties.
     * Libs set here are automatically disposed when the editor is unmounted.
     * If a lib with the same path is already added, it will be replaced.
     *
     * @param code The code of the extra lib.
     * @param path A unique id or path to identify the extra lib.
     *
     * @returns The new version number of the lib
     */
    public addOrUpdateExtraLib(code: string, path: string): number {
        if (languages.typescript) {
            this.disposables.push(languages.typescript.typescriptDefaults.addExtraLib(code, path));

            // Return the new version of the extra lib
            const extraLibs = languages.typescript.typescriptDefaults.getExtraLibs();
            const lib = extraLibs[path];
            if (lib) {
                return lib.version;
            }
        }

        return 0;
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
        const { createResultPresentation } = this.props;

        const editor = this.backend;
        const model = this.model;
        if (editor && model && createResultPresentation) {
            const presentation = createResultPresentation(this, language);
            presentation.startLine = startLine;
            presentation.endLine = startLine;
            const context = model.executionContexts?.addContext(presentation);

            editor.setPosition({ lineNumber: startLine, column: 1 });
            setTimeout(() => {
                editor.setScrollPosition(
                    { scrollTop: editor.getScrollHeight()/* - editor.getLayoutInfo().height * 1.5*/ },
                    Monaco.ScrollType.Smooth);
            }, 0);

            return context;
        }

        return undefined;
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
        if (model && model.executionContexts) {
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
     * Restores the context to a previously saved state. Usually used when switching between history entries.
     *
     * @param context The context to restore.
     * @param text The text for the context.
     * @param language The language for the context.
     * @param placeCaretAtStart A flag to control where to place the caret.
     */
    public setExecutionBlockLanguageAndText(context: ExecutionContext, text: string,
        language: string, placeCaretAtStart = false): void {

        if (isEditorLanguage(language)) {
            this.switchCurrentLanguage(language, false);
        }

        const editor = this.backend;
        const model = this.model;
        if (editor && model) {
            const endColumn = this.model.getLineMaxColumn(context.endLine);

            // Replace the current ExecutionContext text
            const range = {
                startLineNumber: context.startLine,
                startColumn: 1,
                endLineNumber: context.endLine,
                endColumn,
            };

            editor.executeEdits("", [{ range, text }], () => {
                if (placeCaretAtStart) {
                    return [new Selection(context.startLine, 1, context.startLine, 1)];
                } else {
                    // Make sure to place the cursor at the new ending line number, based on the line count
                    // of the new statement
                    const numberOfLines = text.split("\n").length;
                    const endColumn = model.getLineMaxColumn(context.startLine + numberOfLines - 1);

                    return [new Selection(context.startLine + numberOfLines - 1, endColumn,
                        context.startLine + numberOfLines - 1, endColumn)];
                }
            });
        }
    }

    /**
     * @returns Returns the last execution context in the editor.
     */
    public get lastExecutionBlock(): ExecutionContext | undefined {
        const model = this.model;

        return model?.executionContexts?.last;
    }

    /**
     * @returns The index of the block under the caret or -1 if there's none.
     */
    public get currentBlockIndex(): number {
        const editor = this.backend;
        const model = this.model;
        if (editor && model && model.executionContexts) {
            return model.executionContexts.contextIndexFromPosition(editor.getPosition());
        }

        return -1;
    }

    public get currentBlock(): ExecutionContext | undefined {
        const editor = this.backend;
        const model = this.model;
        if (editor && model && model.executionContexts) {
            return model.executionContexts.contextFromPosition(editor.getPosition());
        }

        return undefined;
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
        this.doExecuteContext({ advance: true });
    }

    private handleSettingsChanged = (entry?: { key: string; value: unknown; }): Promise<boolean> => {
        if (!entry) {
            this.forceUpdate();
        } else {
            switch (entry.key) {
                case "editor.wordWrap": {
                    const { allowSoftWrap } = this.props;

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
                    const { minimap } = this.props;
                    const showMinimap = Settings.get("editor.showMinimap", true);
                    const useMinimap = Settings.get("dbEditor.useMinimap", false);
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
        const { language, allowedLanguages = [] } = this.props;
        const editor = this.backend;
        if (!editor) {
            return;
        }

        const precondition = "editorTextFocus && !suggestWidgetVisible && !renameInputVisible && !inSnippetMode " +
            "&& !quickFixWidgetVisible";

        const mixedLanguage = language === "msg";
        this.disposables.push(editor.addAction({
            id: "executeCurrentAndAdvance",
            label: mixedLanguage ? "Execute Block and Advance" : "Execute Script",
            keybindings: [KeyMod.CtrlCmd | KeyCode.Enter],
            contextMenuGroupId: "2_execution",
            contextMenuOrder: 1,
            precondition,
            run: () => {
                this.doExecuteContext({ advance: true });
            },
        }));

        this.disposables.push(editor.addAction({
            id: "executeCurrent",
            label: mixedLanguage ? "Execute Block" : "Execute Script and Move Cursor",
            keybindings: [KeyMod.Shift | KeyCode.Enter],
            contextMenuGroupId: "2_execution",
            contextMenuOrder: 2,
            precondition,
            run: () => { return this.doExecuteContext({}); },
        }));

        this.disposables.push(editor.addAction({
            id: "executeCurrentStatement",
            label: "Execute Current Statement",
            keybindings: [KeyMod.Shift | KeyMod.CtrlCmd | KeyCode.Enter],
            contextMenuGroupId: "2_execution",
            contextMenuOrder: 3,
            precondition,
            run: () => { return this.doExecuteContext({ atCaret: true }); },
        }));

        this.disposables.push(editor.addAction({
            id: "executeToText",
            label: "Execute and Print as Text",
            keybindings: [KeyMod.Alt | KeyCode.Enter],
            contextMenuGroupId: "2_execution",
            contextMenuOrder: 4,
            precondition,
            run: () => { return this.doExecuteContext({ atCaret: true, advance: true, asText: true }); },
        }));

        if (appParameters.embedded) {
            this.disposables.push(editor.addAction({
                id: "executeOnHost",
                label: "Execute on all visible DB Notebooks",
                keybindings: [KeyMod.Alt | KeyMod.CtrlCmd | KeyCode.Enter],
                contextMenuGroupId: "2_execution",
                contextMenuOrder: 5,
                precondition,
                run: () => {
                    const options = { atCaret: false, advance: true, asText: false };
                    this.executeCurrentContextOnHost(options);
                    this.doExecuteContext(options);
                },
            }));

            // In embedded mode some key combinations don't work by default. So we add handlers for them here.
            this.disposables.push(editor.addAction({
                id: "paste",
                label: "Paste",
                keybindings: [KeyMod.CtrlCmd | KeyCode.KeyV],
                run: () => {
                    editor.trigger("source", "editor.action.clipboardPasteAction", null);
                },
            }));

            this.disposables.push(editor.addAction({
                id: "copy",
                label: "Copy",
                keybindings: [KeyMod.CtrlCmd | KeyCode.KeyC],
                precondition,
                run: () => {
                    editor.trigger("source", "editor.action.clipboardCopyAction", null);
                },
            }));

            this.disposables.push(editor.addAction({
                id: "cut",
                label: "Cut",
                keybindings: [KeyMod.CtrlCmd | KeyCode.KeyX],
                precondition,
                run: () => {
                    editor.trigger("source", "editor.action.clipboardCutAction", null);
                },
            }));
        }

        if (mixedLanguage) {
            if (allowedLanguages.includes("sql")) {
                this.disposables.push(editor.addAction({
                    id: "switchToSQL",
                    label: "Switch Language of Current Block to SQL",
                    contextMenuGroupId: "3_language",
                    contextMenuOrder: 1,
                    precondition,
                    run: this.switchCurrentLanguage.bind(this, "sql", false),
                }));
            }

            if (allowedLanguages.includes("typescript")) {
                this.disposables.push(editor.addAction({
                    id: "switchToTypeScript",
                    label: "Switch Language of Current Block to TypeScript",
                    contextMenuGroupId: "3_language",
                    contextMenuOrder: 2,
                    precondition,
                    run: this.switchCurrentLanguage.bind(this, "typescript", false),
                }));
            }

            if (allowedLanguages.includes("javascript")) {
                this.disposables.push(editor.addAction({
                    id: "switchToJavaScript",
                    label: "Switch Language of Current Block to JavaScript",
                    contextMenuGroupId: "3_language",
                    contextMenuOrder: 3,
                    precondition,
                    run: this.switchCurrentLanguage.bind(this, "javascript", false),
                }));
            }

            if (appParameters.embedded) {
                this.disposables.push(editor.addAction({
                    id: "sendBlockUpdates",
                    label: "Update SQL in Original Source File",
                    keybindings: [KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyU],
                    contextMenuGroupId: "4_linked",
                    precondition,
                    run: () => { this.runContextCommand("sendBlockUpdates"); },
                }));
            }

            // Special key handling for our blocks.
            this.disposables.push(editor.addAction({
                id: "deleteBackwards",
                label: "Delete Backwards",
                keybindings: [KeyCode.Backspace],
                run: () => { this.handleBackspace(); },
                precondition,
            }));

            this.disposables.push(editor.addAction({
                id: "deleteForward",
                label: "Delete Forward",
                keybindings: [KeyCode.Delete],
                run: () => { this.handleDelete(); },
                precondition,
            }));

            this.disposables.push(editor.addAction({
                id: "jumpToBlockStart",
                label: "Move Cursor to the Start of the Current Statement Block",
                keybindings: [KeyMod.WinCtrl | KeyMod.CtrlCmd | KeyCode.UpArrow],
                contextMenuGroupId: "navigation",
                precondition,
                run: () => { this.jumpToBlockStart(); },
            }));

            this.disposables.push(editor.addAction({
                id: "jumpToBlockEnd",
                label: "Move Cursor to the End of the Current Statement Block",
                keybindings: [KeyMod.WinCtrl | KeyMod.CtrlCmd | KeyCode.DownArrow],
                contextMenuGroupId: "navigation",
                precondition,
                run: () => { this.jumpToBlockEnd(); },
            }));
        }

        this.disposables.push(editor.addAction({
            id: "selectAll",
            label: "Select All",
            contextMenuGroupId: "9_cutcopypaste",
            keybindings: [KeyMod.CtrlCmd | KeyCode.KeyA],
            run: () => {
                this.handleSelectAll();
            },
            precondition,
        }));

        this.disposables.push(editor.addAction({
            id: "saveAs",
            label: "Save As ...",
            contextMenuGroupId: "10_save",
            keybindings: [KeyMod.Shift | KeyMod.CtrlCmd | KeyCode.KeyS],
            run: () => {
                void requisitions.execute("editorSaveNotebook", undefined);
            },
            precondition,
        }));

        this.disposables.push(editor.addAction({
            id: "save",
            label: "Save",
            contextMenuGroupId: "10_save",
            keybindings: [KeyMod.CtrlCmd | KeyCode.KeyS],
            run: () => {
                void requisitions.execute("editorSaveNotebook", "viaKeyboardShortcut");
            },
            precondition,
        }));

        this.disposables.push(editor.addAction({
            id: "acceptSuggestion",
            label: "Accept Selected Suggestion",
            keybindings: [KeyMod.CtrlCmd | KeyCode.Enter],
            precondition: "suggestWidgetVisible",
            run: () => {
                editor.trigger("source", "acceptSelectedSuggestion", null);
            },
        }));

        this.disposables.push(editor.addAction({
            id: "removeAllResults",
            label: "Remove All Results",
            contextMenuGroupId: "3_results",
            contextMenuOrder: 1,
            precondition,
            run: () => { void this.removeAllResults(); },
        }));

        this.disposables.push(editor.addAction({
            id: "useNotebookAsTemplate",
            label: "Use Notebook as Template",
            contextMenuGroupId: "9_cutcopypaste",
            contextMenuOrder: 5,
            precondition,
            run: () => { this.useNotebookAsTemplate(); },
        }));

        this.disposables.push(editor.addAction({
            id: "appendFromTemplate",
            label: "Append Codeblock from Template",
            keybindings: [KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyP],
            contextMenuGroupId: "9_cutcopypaste",
            contextMenuOrder: 6,
            precondition,
            run: () => { this.appendFromTemplate(); },
        }));

        this.disposables.push(editor.addAction({
            id: "focusExecutionBlockResultAbove",
            label: "Focus Execution Block Result Above",
            keybindings: [KeyMod.Alt | KeyCode.UpArrow],
            run: () => { this.focusExecutionContextResult(true); },
            precondition,
        }));

        this.disposables.push(editor.addAction({
            id: "focusExecutionBlockResultBelow",
            label: "Focus Execution Block Result Above",
            keybindings: [KeyMod.Alt | KeyCode.DownArrow],
            run: () => { this.focusExecutionContextResult(false); },
            precondition,
        }));

        this.disposables.push(editor);
        this.disposables.push(editor.onDidChangeCursorPosition((e: Monaco.ICursorPositionChangedEvent) => {
            if (language === "msg") {
                const model = this.model;
                if (model && model.executionContexts) {
                    model.executionContexts.cursorPosition = e.position;
                }
            }

            void requisitions.execute("editorCaretMoved", e.position);
        }));

        this.disposables.push(editor.onDidChangeModelContent(this.handleModelChange));
        this.disposables.push(editor.onDidPaste(this.handlePaste));

        this.disposables.push(editor.onDidScrollChange((e) => {
            if (e.scrollTopChanged) {
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
            }

            if (e.scrollLeftChanged) {
                const viewZones = editor.getDomNode()?.getElementsByClassName("view-zones");
                if (viewZones && viewZones.length > 0) {
                    (viewZones[0] as HTMLElement).style.left = `${e.scrollLeft}px`;
                }

            }

            if (e.scrollWidthChanged) {
                // Need to delay view zone resizing, as the content width is not yet updated at this point.
                setTimeout(() => {
                    this.resizeViewZones();
                }, 0);
            }
        }));

        this.disposables.push(editor.onDidChangeModelOptions(() => {
            const { onOptionsChanged } = this.props;
            onOptionsChanged?.();
        }));

        requisitions.register("settingsChanged", this.handleSettingsChanged);
        requisitions.register("editorExecuteSelectedOrAll", this.executeSelectedOrAll);
        requisitions.register("editorExecute", this.executeContext);
        requisitions.register("editorFind", this.executeFind);
        requisitions.register("editorFormat", this.executeFormat);
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
                    const context = model.executionContexts?.contextFromPosition({
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
                    const context = model.executionContexts?.contextFromPosition({
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
                    const context = model.executionContexts?.contextFromPosition(position);
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

    private jumpToBlockStart = (): void => {
        const editor = this.backend;
        const model = this.model;
        if (editor && model) {
            const position = editor.getPosition();
            if (position) {
                const contexts = model.executionContexts;
                let context = contexts?.contextFromPosition(position);
                if (context) {
                    if (context.startLine < position.lineNumber) {
                        editor.setPosition({ lineNumber: context.startLine, column: 1 });
                    } else {
                        // Already at the beginning of the block. Jump further the previous block start.
                        context = contexts?.contextFromPosition({ lineNumber: context.startLine - 1, column: 1 });
                        if (context) {
                            editor.setPosition({ lineNumber: context.startLine, column: 1 });
                        }
                    }
                }
            }
        }
    };

    private jumpToBlockEnd = (): void => {
        const editor = this.backend;
        const model = this.model;
        if (editor && model) {
            const position = editor.getPosition();
            if (position) {
                const contexts = model.executionContexts;
                let context = contexts?.contextFromPosition(position);
                if (context) {
                    if (context.endLine > position.lineNumber) {
                        editor.setPosition({
                            lineNumber: context.endLine,
                            column: model.getLineMaxColumn(context.endLine),
                        });
                    } else {
                        // Already at the beginning of the block. Jump further the previous block start.
                        context = contexts?.contextFromPosition({ lineNumber: context.endLine + 1, column: 1 });
                        if (context) {
                            editor.setPosition({
                                lineNumber: context.endLine,
                                column: model.getLineMaxColumn(context.endLine),
                            });
                        }
                    }
                }
            }
        }
    };

    private focusExecutionContextResult = (above: boolean): void => {
        // Focus a either the Execution Context above or below, so editing can be started with the Return/Enter key
        const editor = this.backend;
        const model = this.model;
        if (editor && model) {
            const position = editor.getPosition();
            if (position) {
                const contexts = model.executionContexts;
                const index = contexts?.contextIndexFromPosition(position);
                if (index) {
                    // Find the right context, either above or current
                    const context = contexts?.contextAt(index + (above ? -1 : 0));
                    // Find the first tabulator-cell
                    const zoneEl = context?.presentation.viewZone?.domNode;
                    const el = zoneEl?.querySelector<HTMLElement>(".tabulator-cell");
                    if (el) {
                        // If found, ensure Monaco loses focus
                        if (document.activeElement instanceof HTMLElement) {
                            document.activeElement.blur();
                        }

                        // Set focus on tabulator-cell
                        el.focus();
                    }
                }
            }
        }
    };

    private handleSelectStatement = (details: { contextId: string; statementIndex: number; }): Promise<boolean> => {
        return new Promise((resolve) => {

            const model = this.model;
            if (model) {
                const contexts = model.executionContexts;
                const context = contexts?.contextWithId(details.contextId);
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
        // Let our host (if any) know that the model has changed.
        requisitions.executeRemote("editorChanged", undefined);

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
                    const context = contexts?.first;
                    context?.applyEditorChanges(e.changes);

                    break;
                }

                default: {
                    // JavaScript and TypeScript, which have their own processing.
                    break;
                }
            }

            const { onModelChange } = this.props;

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
     * @param options Options to control the execution.
     */
    private doExecuteContext(options: IEditorCommonExecutionOptions): void {
        const { onScriptExecution } = this.props;

        const editor = this.backend;
        const model = this.model;
        if (editor && model) {
            if (options.context) {
                void onScriptExecution?.(options.context as ExecutionContext, options).then(() => {
                    editor.focus();
                });

                return;
            }

            const index = this.currentBlockIndex;
            if (index > -1) {
                const context = model.executionContexts?.contextAt(index);
                if (context) {
                    void context.canClose().then((canClose) => {
                        if (canClose) {
                            // Let our host (if any) know that the results will change.
                            requisitions.executeRemote("editorChanged", undefined);

                            if (this.handleInternalCommand(index) === "unhandled") {
                                const { onScriptExecution } = this.props;

                                let position = options.atCaret
                                    ? editor.getPosition() as IPosition ?? undefined
                                    : undefined;
                                if (position) {
                                    position = context.toLocal(position);
                                }

                                const executionOptions = {
                                    forceSecondaryEngine: options.forceSecondaryEngine,
                                    source: position,
                                    asText: options.asText,
                                };

                                void onScriptExecution?.(context, executionOptions).then(() => {
                                    editor.focus();
                                });

                                if (options.advance) {
                                    this.prepareNextExecutionBlock(index);
                                }
                            }
                        }
                    });
                }
            }
        }
    }

    /**
     * Executes the context where the caret is in on all visible DB notebooks, if the app is embedded.
     *
     * @param options The options to control the execution.
     */
    private executeCurrentContextOnHost(options: IEditorCommonExecutionOptions): void {
        const editor = this.backend;
        const model = this.model;
        if (editor && model) {
            const index = this.currentBlockIndex;
            if (index > -1) {
                const block = model.executionContexts?.contextAt(index);
                if (block) {
                    const data: IEditorExtendedExecutionOptions = {
                        ...options,
                        code: block.code,
                        language: block.language,
                    };
                    void requisitions.executeRemote("editorExecuteOnHost", data);
                }
            }
        }
    }

    private runContextCommand(command: string): void {
        const model = this.model;
        if (model) {
            const index = this.currentBlockIndex;
            if (index > -1) {
                const context = model.executionContexts?.contextAt(index);
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
        if (model && model.executionContexts) {
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
                        void firsContext?.removeResult();
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
     * Checks the context that is in the given range if it contains a language switch. If that is the case
     * it is split at these switches.
     *
     * @param range The range that was changed by an edit action. It should only touch a single context.
     */
    private scanForLanguageSwitches(range: ITextRange): void {
        const model = this.model;
        if (model && model.executionContexts) {
            const contextsToUpdate = this.contextIndicesFromRange(range);

            if (contextsToUpdate.length > 0) {
                const { createResultPresentation } = this.props;

                const firstIndex = contextsToUpdate[0];
                const firstContext = model.executionContexts.contextAt(firstIndex)!;
                const blocks = this.determineTextBlocks(firstContext);

                const offset = firstContext.startLine;

                const first = blocks.shift();
                if (!first) {
                    return;
                }

                const linesToClear: number[] = []; // Lines with language switches.

                // The first context exists already (which is the one where the user pasted the text in).
                // Just need to update its language and end line and record the language switch lines.
                for (let i = 0; i < first.contentStartLine; ++i) {
                    linesToClear.push(i + offset);
                }

                firstContext.endLine = first.endLine + offset;
                model.executionContexts.switchContextLanguage(firstIndex, first.language);

                // Create new contexts for the remaining blocks.
                if (createResultPresentation) {
                    let index = firstIndex + 1;
                    blocks.forEach((block): void => {
                        for (let i = block.startLine; i < block.contentStartLine; ++i) {
                            linesToClear.push(i + offset);
                        }

                        const presentation = createResultPresentation(this, block.language);
                        const context = model.executionContexts!.insertContext(index++, presentation);
                        context.startLine = block.startLine + offset;
                        context.endLine = block.endLine + offset;
                        context.scheduleFullValidation();
                    });
                }

                // At this point all execution contexts still contain the language switches.
                // Clear these lines, but don't remove them (as this conflicts with the ongoing edit action).
                this.backend?.executeEdits("removeLanguageSwitches",
                    linesToClear.map((line): Monaco.IIdentifiedSingleEditOperation => {
                        return {
                            range: {
                                startLineNumber: line,
                                startColumn: 1,
                                endLineNumber: line,
                                endColumn: model.getLineLength(line) + 1,
                            },
                            text: null,
                        };
                    }),
                );
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
        if (model && model.executionContexts) {
            return model.executionContexts.contextIndicesFromRange(range);
        }

        return [];
    }

    /**
     * Called when a new model was set for this editor.
     * It creates the initial block list based on the found language switches in the text.
     */
    private generateExecutionBlocksFromContent = (): void => {
        const { createResultPresentation } = this.props;

        const editor = this.backend;
        const model = this.model;
        if (model && editor && model.executionContexts && createResultPresentation) {
            model.executionContexts.deactivateContexts();

            const blocks = this.determineTextBlocks(model.getValue());
            blocks.forEach((block): void => {
                const presentation = createResultPresentation(this, block.language);
                presentation.startLine = block.startLine + 1;
                presentation.endLine = block.endLine + 1;
                model.executionContexts!.addContext(presentation);
            });
        }
    };

    /**
     * Adds the initial execution block (for the combined language) or the only block (for a single language).
     *
     * @param model The model used in the editor.
     */
    private addInitialBlock(model: ICodeEditorModel): void {
        const { sqlDialect, allowedLanguages = [], startLanguage } = this.props;

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
     * @returns A list of ranges with language, start and stop line (both zero-based).
     */
    private determineTextBlocks = (startOrText: ExecutionContext | string): ITextBlockEntry[] => {
        const { language, allowedLanguages = [], startLanguage, sqlDialect } = this.props;

        // Determine a language to start with.
        let currentLanguage: EditorLanguage = "javascript";

        // Get the individual lines of the text.
        let lines: string[];
        if (typeof startOrText === "string") {
            lines = splitTextToLines(startOrText);

            currentLanguage = (language === "msg" ? startLanguage : language) ?? "javascript";
            if (currentLanguage && allowedLanguages.length > 0) {
                if (!allowedLanguages.includes(currentLanguage)) {
                    // The current language is not allowed. Pick the first one in the allowed languages list.
                    currentLanguage = allowedLanguages[0];
                }
            }
        } else {
            lines = startOrText.model?.getLinesContent() ?? [];
            currentLanguage = startOrText.language;
        }

        if (currentLanguage === "sql" && sqlDialect) {
            currentLanguage = sqlDialect as EditorLanguage;
        }

        const result: ITextBlockEntry[] = [];
        let currentEntry: ITextBlockEntry = {
            language: currentLanguage,
            startLine: 0,
            endLine: lines.length === 0 ? 0 : -1,
            contentStartLine: 0,
        };

        let haveContent = false;
        for (const line of lines) {
            let trimmed = line.trim();
            if (trimmed.length > 0 && trimmed.startsWith("\\")) {
                trimmed = trimmed.slice(1);
                let language = CodeEditor.languageMap.get(trimmed);
                if (language && allowedLanguages.includes(language)) {
                    // A language switch may introduces a new execution block, if the given language is valid
                    // and there was content in a previous block.
                    if (language === "sql" && sqlDialect) {
                        language = sqlDialect as EditorLanguage;
                    }
                    currentLanguage = language;

                    // Finish the current block and start a new one, if there was content in the current one.
                    if (haveContent) {
                        haveContent = false;

                        const newStart = currentEntry.endLine + 1;
                        result.push(currentEntry);

                        currentEntry = {
                            language: currentLanguage,
                            startLine: newStart,
                            endLine: newStart,
                            contentStartLine: newStart,
                        };
                    } else {
                        // Otherwise update the language of the current block and advance its end line.
                        currentEntry.language = currentLanguage;
                        ++currentEntry.endLine;
                    }

                    continue;
                }
            }

            ++currentEntry.endLine;
            if (!haveContent) {
                // First time found content. Update the content line number.
                currentEntry.contentStartLine = currentEntry.endLine;
            }

            haveContent = true;
        }

        // And finish the last block.
        result.push(currentEntry);

        return result;
    };

    private handleEditorResize = (entries: readonly ResizeObserverEntry[]): void => {
        if (entries.length > 0 && this.editor && this.hostRef.current) {
            setTimeout(() => { // Need to defer the re-layout to after the editor has been resized.
                const rect = entries[0].contentRect;
                this.editor!.layout({ width: rect.width, height: rect.height });
                this.resizeViewZones();
            }, 0);
        }
    };

    /**
     * Sets the width of the view zones hosting div to the content width of the editor, to avoid
     * stretching the zones if the editor scroll width gets larger, beyond the content width.
     */
    private resizeViewZones = (): void => {
        if (this.editor) {
            const viewZones = this.editor.getDomNode()?.getElementsByClassName("view-zones");
            if (viewZones && viewZones.length > 0) {
                const info = this.editor.getLayoutInfo();
                (viewZones[0] as HTMLElement).style.width = `${info.contentWidth - 1}px`;
            }
        }
    };

    /**
     * Checks if the given code is something that must be internally handled (for instance about or help commands).
     *
     * @param index The index of the block to execute.
     *
     * @returns A string indicating what to do next with that block.
     */
    private handleInternalCommand(index: number): "handled" | "ignore" | "unhandled" {
        const { allowedLanguages = [] } = this.props;

        const model = this.model;
        if (model && model.executionContexts) {
            const terminalMode = model.editorMode === CodeEditorMode.Terminal;
            const block = model.executionContexts.contextAt(index)!;
            if (block.isInternal) {
                let trimmed = block.code.trim();

                // Blocks to switch languages cannot be re-executed, as they change state and all following
                // blocks consider that state. Hence disallow such a block if this is not the last
                // one in the editor.
                if (terminalMode && index < model.executionContexts.count - 1) {
                    return "unhandled";
                }

                trimmed = trimmed.slice(1);
                if (!terminalMode) {
                    if (trimmed === "?" || trimmed === "h" || trimmed === "help") {
                        const { onHelpCommand } = this.props;
                        const helpText = onHelpCommand?.(trimmed, block.language);
                        if (helpText) {
                            void block.addResultData({
                                type: "text",
                                text: [{ type: MessageType.Info, content: helpText, language: "markdown" }],
                            }, { resultId: "0" });

                            this.prepareNextExecutionBlock(index);
                        } else {
                            void block.addResultData({
                                type: "text",
                                text: [{ type: MessageType.Error, content: "No help available" }],
                            }, { resultId: "0" });
                        }

                        return "handled";
                    } else if (trimmed === "chat") {
                        trimmed = "text";
                    }
                }

                const language = CodeEditor.languageMap.get(trimmed);
                if (language === block.language) {
                    return "ignore";
                }

                if (!language || allowedLanguages.length === 0 || !allowedLanguages.includes(language)) {
                    return "unhandled";
                }

                switch (language) {
                    case "sql": {
                        const { sqlDialect = "sql" } = this.props;

                        // In terminal mode we sent the command to the backend and must reflect this in the editor.
                        if (terminalMode) {
                            this.prepareNextExecutionBlock(index, sqlDialect as EditorLanguage);
                        } else {
                            // In editor mode we switch the language of the current block.
                            this.switchCurrentLanguage(sqlDialect as EditorLanguage, true);

                            return "handled";
                        }

                        break;
                    }

                    case "javascript": {
                        if (terminalMode) {
                            this.prepareNextExecutionBlock(index, "javascript");
                        } else {
                            this.switchCurrentLanguage("javascript", true);

                            return "handled";
                        }

                        break;
                    }

                    case "typescript": {
                        if (terminalMode) {
                            this.prepareNextExecutionBlock(index, "typescript");
                        } else {
                            this.switchCurrentLanguage("typescript", true);

                            return "handled";
                        }

                        break;
                    }

                    case "python": {
                        // Python is only available in terminal mode.
                        this.prepareNextExecutionBlock(index, "python");

                        break;
                    }

                    case "text": {
                        if (terminalMode) {
                            this.prepareNextExecutionBlock(index, "text");
                        } else {
                            this.switchCurrentLanguage("text", true);

                            return "handled";
                        }

                        break;
                    }

                    default:
                }
            }
        }

        return "unhandled";
    }

    private executeSelectedOrAll = (options: IEditorCommonExecutionOptions): Promise<boolean> => {
        const { language } = this.props;

        const editor = this.backend;
        const model = this.model;
        const terminalMode = model?.editorMode === CodeEditorMode.Terminal;

        const advance = (language === "msg") && options.advance;
        this.doExecuteContext(
            {
                advance: advance || terminalMode,
                forceSecondaryEngine: options.forceSecondaryEngine,
                asText: options.asText,
            });
        editor?.focus();

        return Promise.resolve(true);
    };

    private executeContext = (options: IEditorCommonExecutionOptions): Promise<boolean> => {
        const { language } = this.props;

        const editor = this.backend;
        const model = this.model;
        const terminalMode = model?.editorMode === CodeEditorMode.Terminal;

        const advance = (language === "msg") && options.advance;
        this.doExecuteContext(
            {
                ...options,
                atCaret: true,
                advance: advance || terminalMode,
            });
        editor?.focus();

        return Promise.resolve(true);
    };

    private executeFind = (): Promise<boolean> => {
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

    private executeFormat = (): Promise<boolean> => {
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

    /**
     * Changes the language of the current block to the given one.
     *
     * @param language The new language.
     * @param clearInput If true, the input of the current block is cleared.
     */
    private switchCurrentLanguage = (language: EditorLanguage, clearInput = false): void => {
        const { sqlDialect, onContextLanguageChange } = this.props;

        const editor = this.backend;
        const model = this.model;

        if (editor && model) {
            if (language === "sql" && sqlDialect) {
                language = sqlDialect as EditorLanguage;
            }

            model.executionContexts?.switchContextLanguage(this.currentBlockIndex, language);
            const block = model.executionContexts?.contextAt(this.currentBlockIndex);
            if (block) {
                const lineLength = model.getLineLength(block.endLine);
                const value = clearInput ? "" : model.getValueInRange({
                    startLineNumber: block.startLine,
                    startColumn: 1,
                    endLineNumber: block.endLine,
                    endColumn: lineLength + 1,
                });

                model.applyEdits([
                    {
                        range: {
                            startLineNumber: block.startLine,
                            startColumn: 1,
                            endLineNumber: block.endLine,
                            endColumn: lineLength + 1,
                        },
                        text: value,
                        forceMoveMarkers: false,
                    },
                ], false);

                onContextLanguageChange?.(block, language);
            }
        }
    };

    /**
     * Removes the result views from all execution contexts.
     */
    private async removeAllResults(): Promise<void> {
        const model = this.model;
        if (model) {
            await model.executionContexts?.removeAllResults();
        }
    }

    private useNotebookAsTemplate = (): void => {
        const model = this.model;
        if (model && model.executionContexts) {
            this.templateCodeBlocks = [];
            this.templatePastePosition = 0;
            for (let i = 0; i < model.executionContexts.count; i++) {
                const context = model.executionContexts.contextAt(i);
                this.templateCodeBlocks.push({
                    code: context?.code ?? "",
                    language: context?.language ?? "sql",
                });
            }

            this.clear();
        }
    };

    private appendFromTemplate = (): void => {
        if (this.templatePastePosition !== undefined && this.templatePastePosition < this.templateCodeBlocks.length) {
            const templateBlock = this.templateCodeBlocks[this.templatePastePosition];
            this.appendText(templateBlock.code);
            this.switchCurrentLanguage(templateBlock.language, false);

            this.templatePastePosition++;
            if (this.templatePastePosition >= this.templateCodeBlocks.length) {
                this.templatePastePosition = undefined;
                this.templateCodeBlocks = [];
            }
        }
    };

    static {
        CodeEditor.configureMonaco();

        requisitions.register("themeChanged", (data: IThemeChangeData): Promise<boolean> => {
            CodeEditor.updateTheme(data.safeName, data.type, data.values);

            return Promise.resolve(true);
        });
    }
}
