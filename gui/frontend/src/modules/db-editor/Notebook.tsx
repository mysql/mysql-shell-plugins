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

import loadNotebookIcon from "../../assets/images/toolbar/toolbar-load-editor.svg";
import saveNotebookIcon from "../../assets/images/toolbar/toolbar-save-editor.svg";

import { type IPosition } from "monaco-editor";
import { ComponentChild, createRef } from "preact";

import { Button } from "../../components/ui/Button/Button.js";
import { CodeEditor, IEditorPersistentState } from "../../components/ui/CodeEditor/CodeEditor.js";
import { ICodeEditorViewState, IScriptExecutionOptions } from "../../components/ui/CodeEditor/index.js";
import { ComponentBase, IComponentProperties } from "../../components/ui/Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../../components/ui/Container/Container.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import { StatusBarAlignment, type IStatusBarItem } from "../../components/ui/Statusbar/StatusBarItem.js";
import { StatusBar } from "../../components/ui/Statusbar/Statusbar.js";
import { ExecutionContext } from "../../script-execution/ExecutionContext.js";
import { PresentationInterface } from "../../script-execution/PresentationInterface.js";
import { SQLExecutionContext } from "../../script-execution/SQLExecutionContext.js";
import { INotebookFileFormat } from "../../script-execution/index.js";
import { requisitions } from "../../supplement/Requisitions.js";
import { Settings } from "../../supplement/Settings/Settings.js";
import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { DBType } from "../../supplement/ShellInterface/index.js";
import { EditorLanguage } from "../../supplement/index.js";
import { IOpenEditorState, ISavedEditorState } from "./DBConnectionTab.js";
import { DBEditorToolbar } from "./DBEditorToolbar.js";
import { EmbeddedPresentationInterface } from "./execution/EmbeddedPresentationInterface.js";
import { ISchemaTreeEntry, IToolbarItems } from "./index.js";

interface INotebookProperties extends IComponentProperties {
    standaloneMode: boolean;
    toolbarItemsTemplate: IToolbarItems;

    savedState: ISavedEditorState;
    backend?: ShellInterfaceSqlEditor;

    dbType: DBType;
    readOnly?: boolean;

    /** If true then show the about info text on first mount. */
    showAbout: boolean;

    /** Extra libraries for the code editor that don't change. */
    extraLibs?: Array<{ code: string, path: string; }>;

    /** Font size to use. */
    fontSize?: number;

    onScriptExecution?: (context: ExecutionContext, options: IScriptExecutionOptions) => Promise<boolean>;
    onHelpCommand?: (command: string, currentLanguage: EditorLanguage) => string | undefined;
    onContextLanguageChange?: (context: ExecutionContext, language: EditorLanguage) => void;
}

export class Notebook extends ComponentBase<INotebookProperties> {

    private editorRef = createRef<CodeEditor>();

    #editorLanguageSbEntry!: IStatusBarItem;
    #editorEolSbEntry!: IStatusBarItem;
    #editorIndentSbEntry!: IStatusBarItem;
    #editorPositionSbEntry!: IStatusBarItem;

    public constructor(props: INotebookProperties) {
        super(props);

        this.addHandledProperties("standaloneMode", "toolbarItemsTemplate", "savedState", "backend", "dbType",
            "readOnly", "showAbout", "extraLibs", "onScriptExecution", "onHelpCommand", "onContextLanguageChange");
    }

    public override componentDidMount(): void {
        requisitions.register("explorerDoubleClick", this.explorerDoubleClick);
        requisitions.register("editorCaretMoved", this.handleCaretMove);

        this.#editorPositionSbEntry = StatusBar.createStatusBarItem({
            id: "editorPosition",
            text: "",
            priority: 990,
            alignment: StatusBarAlignment.Right,
        });

        this.#editorIndentSbEntry = StatusBar.createStatusBarItem({
            id: "editorIndent",
            text: "",
            priority: 985,
            alignment: StatusBarAlignment.Right,
        });

        this.#editorEolSbEntry = StatusBar.createStatusBarItem({
            id: "editorEOL",
            text: "",
            priority: 980,
            alignment: StatusBarAlignment.Right,
        });

        this.#editorLanguageSbEntry = StatusBar.createStatusBarItem({
            id: "editorLanguage",
            text: "",
            priority: 975,
            alignment: StatusBarAlignment.Right,
        });

        this.initialSetup();
        this.updateStatusItems();
    }

    public override componentDidUpdate(): void {
        this.initialSetup();
        this.updateStatusItems();
    }

    public override componentWillUnmount(): void {
        this.#editorLanguageSbEntry.dispose();
        this.#editorIndentSbEntry.dispose();
        this.#editorPositionSbEntry.dispose();
        this.#editorEolSbEntry.dispose();

        requisitions.unregister("explorerDoubleClick", this.explorerDoubleClick);
        requisitions.unregister("editorCaretMoved", this.handleCaretMove);
    }

    public render(): ComponentChild {
        const {
            standaloneMode, toolbarItemsTemplate, savedState, backend, dbType, readOnly, extraLibs, fontSize,
            onScriptExecution, onHelpCommand,
        } = this.mergedProps;

        const dialect = this.dialectFromDbType(dbType);

        // Determine the editor to show from the editor state. There must always be at least a single editor.
        // If we cannot find the given active editor then pick the first one unconditionally.
        let activeEditor = savedState.editors.find(
            (entry: IOpenEditorState): boolean => {
                return entry.id === savedState.activeEntry;
            },
        );

        if (!activeEditor) {
            activeEditor = savedState.editors[0];
        }

        // Create a copy of the toolbar items from the template to allow for modifications.
        const toolbarItems: IToolbarItems = {
            navigation: toolbarItemsTemplate.navigation.slice(),
            execution: toolbarItemsTemplate.execution,
            editor: toolbarItemsTemplate.editor,
            auxillary: toolbarItemsTemplate.auxillary.slice(),
        };

        if (standaloneMode) {
            toolbarItems.navigation = [];
        }

        toolbarItems.navigation.push(
            <Button
                key="editorSaveNotebookButton"
                data-tooltip="Save this Notebook"
                requestType="editorSaveNotebook"
                imageOnly={true}
                style={{ marginLeft: "4px" }}
            >
                <Icon src={saveNotebookIcon} data-tooltip="inherit" />
            </Button>,
            <Button
                key="editorLoadNotebookButton"
                data-tooltip="Replace this Notebook With Content from a file"
                requestType="editorLoadNotebook"
                imageOnly={true}
            >
                <Icon src={loadNotebookIcon} data-tooltip="inherit" />
            </Button>,
        );

        if (standaloneMode) {
            toolbarItems.auxillary = [];
        }

        return (
            <Container
                orientation={Orientation.TopDown}
                style={{
                    flex: "1 1 auto",
                }}
                mainAlignment={ContentAlignment.Stretch}
                {...this.unhandledProperties}
            >
                <DBEditorToolbar
                    toolbarItems={toolbarItems}
                    language="msg"
                    activeEditor={savedState.activeEntry}
                    heatWaveEnabled={savedState.heatWaveEnabled}
                    editors={savedState.editors}
                    backend={backend}
                />

                <CodeEditor
                    ref={this.editorRef}
                    savedState={activeEditor.state}
                    extraLibs={extraLibs}
                    language="msg"
                    allowedLanguages={["javascript", "typescript", "sql", "text"]}
                    sqlDialect={dialect}
                    startLanguage={Settings.get("dbEditor.startLanguage", "sql") as EditorLanguage}
                    readonly={readOnly}
                    allowSoftWrap={true}
                    autoFocus={true}
                    className="scriptingConsole"
                    minimap={{
                        enabled: true,
                    }}
                    font={{
                        fontFamily: "var(--msg-monospace-font-family)",
                        fontSize: fontSize ?? 15,
                        lineHeight: 24,
                    }}
                    scrollbar={{
                        useShadows: true,
                        verticalHasArrows: false,
                        horizontalHasArrows: false,
                        vertical: "auto",
                        horizontal: "auto",

                        verticalScrollbarSize: 16,
                        horizontalScrollbarSize: 16,
                    }}
                    lineNumbers={this.contextRelativeLineNumbers}
                    onScriptExecution={onScriptExecution}
                    onHelpCommand={onHelpCommand}
                    onOptionsChanged={this.handleOptionsChanged}
                    onContextLanguageChange={this.handleContextLanguageChange}
                    createResultPresentation={this.createPresentation}
                />
            </Container>
        );
    }

    /**
     * @returns true if this notebook can be deactivated/closed, false if not.
     */
    public canClose(): Promise<boolean> {
        // Ask all contexts if they can be closed.
        const editorState = this.getActiveEditorState();
        if (editorState?.model.executionContexts) {
            return editorState.model.executionContexts.canClose();
        }

        return Promise.resolve(true);
    }

    public addOrUpdateExtraLib(content: string, filePath: string): number {
        return this.editorRef.current?.addOrUpdateExtraLib(content, filePath) ?? 0;
    }

    public focus(): void {
        this.editorRef.current?.focus();
    }

    /**
     * Executes a single query with optional parameters and a link ID for external editors (like text editors
     * in VS code).
     *
     * @param options Content and details for script execution.
     * @param sql The SQL queries to execute.
     * @param linkId The link ID, to connect the new execution context with the original text.
     */
    public async executeQueries(options: IScriptExecutionOptions, sql: string, linkId?: number): Promise<void> {
        if (this.editorRef.current) {
            const { dbType } = this.props;

            const lastBlock = this.editorRef.current.lastExecutionBlock;
            let currentBlock;
            if (!lastBlock || lastBlock.codeLength > 0 || !lastBlock.isSQLLike) {
                currentBlock = this.editorRef.current.prepareNextExecutionBlock(-1,
                    dbType === DBType.MySQL ? "mysql" : "sql");
            } else {
                currentBlock = lastBlock;
            }

            if (currentBlock instanceof SQLExecutionContext) {
                this.editorRef.current.appendText(sql);
                currentBlock.linkId = linkId;

                await currentBlock.splittingDone();

                const { onScriptExecution } = this.props;
                void onScriptExecution?.(currentBlock, options).then((executed) => {
                    if (executed && this.editorRef.current) {
                        this.editorRef.current.prepareNextExecutionBlock(-1, lastBlock?.language);
                        this.editorRef.current.focus();
                    }
                });
            }
        }
    }

    /**
     * Inserts the given script into the current editor block, if that has the same language as that of the script
     * and if that block is empty.
     *
     * @param language The language of the script text.
     * @param script The text to insert.
     */
    public insertScriptText(language: EditorLanguage, script: string): void {
        if (this.editorRef.current) {
            const lastBlock = this.editorRef.current.lastExecutionBlock;
            if (!lastBlock || lastBlock.codeLength > 0 || lastBlock.language !== language) {
                this.editorRef.current.prepareNextExecutionBlock(-1, language);
            }

            this.editorRef.current.appendText(script);
            this.editorRef.current.focus();
        }
    }

    /** @returns the current view state of the underlying code editor to the caller. */
    public getViewState(): ICodeEditorViewState | null {
        if (this.editorRef.current) {
            return this.editorRef.current.backend?.saveViewState() ?? null;
        }

        return null;
    }

    /**
     * Filters the context entries out from the notebook content and recreates the execution contexts in this notebook.
     * This will remove all existing execution contexts.
     *
     * @param content The notebook content to restore.
     */
    public restoreNotebook(content: INotebookFileFormat): void {
        if (this.editorRef.current) {
            // At this point the result view data must be in the application DB.
            const editorState = this.getActiveEditorState();
            if (editorState?.model.executionContexts) {
                void editorState.model.executionContexts.restoreFromStates(this.editorRef.current,
                    this.createPresentation, content.contexts);
            }

            this.editorRef.current.backend?.restoreViewState(content.viewState);
        }
    }

    private handleCaretMove = (position: { lineNumber: number; column: number; }): Promise<boolean> => {
        this.updateStatusItems(position);

        return Promise.resolve(true);
    };

    private explorerDoubleClick = (entry: ISchemaTreeEntry): Promise<boolean> => {
        this.editorRef.current?.insertText(entry.caption);
        this.editorRef.current?.focus();

        return Promise.resolve(true);
    };

    private handleOptionsChanged = (): void => {
        this.updateStatusItems();
    };

    private handleContextLanguageChange = (context: ExecutionContext, language: EditorLanguage): void => {
        const { onContextLanguageChange } = this.mergedProps;

        if (onContextLanguageChange) {
            onContextLanguageChange(context, language);
        }

        this.#editorLanguageSbEntry.text = "mixed/" + language;
    };

    private updateStatusItems = (position?: IPosition): void => {
        if (this.editorRef.current) {
            const { dbType } = this.props;
            const editorState = this.getActiveEditorState();
            if (editorState) {
                position ??= editorState.viewState?.cursorState[0].position;
                const context = editorState.model.executionContexts?.contextFromPosition(position);
                const language = `mixed/${context?.language ?? this.dialectFromDbType(dbType)}`;
                this.#editorLanguageSbEntry.text = language;
                this.#editorEolSbEntry.text = editorState.options.defaultEOL ?? "LF";

                if (editorState.options.insertSpaces) {
                    this.#editorIndentSbEntry.text = `Spaces: ${editorState.options.indentSize ?? 4}`;
                } else {
                    this.#editorIndentSbEntry.text = `Tab Size: ${editorState.options.tabSize ?? 4}`;
                }

                this.#editorPositionSbEntry.text = `Ln ${position?.lineNumber ?? 1}, Col ${position?.column ?? 1}`;
            }
        }
    };

    private createPresentation = (editor: CodeEditor, language: EditorLanguage): PresentationInterface => {
        return new EmbeddedPresentationInterface(editor.backend, editor.isScrolling, language);
    };

    private initialSetup(): void {
        const { showAbout } = this.props;
        const editorState = this.getActiveEditorState();
        if (editorState) {
            const version = editorState.model.getVersionId();
            if (version === 2 && showAbout) {
                // If there was never a change in the editor so far it means that this is the first time it is shown.
                // In this case we can run our one-time initialization.
                this.editorRef.current?.executeText("\\about");
            }
        }
    }

    private dialectFromDbType(type: DBType): EditorLanguage {
        let dialect: EditorLanguage = "sql";
        switch (type) {
            case DBType.MySQL: {
                dialect = "mysql";
                break;
            }

            case DBType.Sqlite: {
                dialect = "sql";
                break;
            }

            default: {
                break;
            }
        }

        return dialect;
    }

    /**
     * Computes custom line numbers, which are relative to an execution context.
     *
     * @param originalLineNumber The line number from Monaco.
     *
     * @returns The computed relative line number for the context at the original linenumber position.
     */
    private contextRelativeLineNumbers = (originalLineNumber: number): string => {
        const editorState = this.getActiveEditorState();
        if (editorState) {
            const contexts = editorState.model.executionContexts;
            const context = contexts?.contextFromPosition({ lineNumber: originalLineNumber, column: 1 });
            if (context) {
                if (context.endLine - context.startLine > 0) {
                    return (originalLineNumber - context.startLine + 1).toString();
                } else {
                    return "";
                }
            }

            return originalLineNumber.toString();
        }

        return "";
    };

    /**
     * Determines the active editor state from the saved state.
     *
     * @returns The active editor state.
     */
    private getActiveEditorState(): IEditorPersistentState | undefined {
        const { savedState } = this.props;

        let activeEditor = savedState.editors.find(
            (entry: IOpenEditorState): boolean => {
                return entry.id === savedState.activeEntry;
            },
        );

        if (!activeEditor) {
            activeEditor = savedState.editors[0];
        }

        return activeEditor.state;
    }
}
