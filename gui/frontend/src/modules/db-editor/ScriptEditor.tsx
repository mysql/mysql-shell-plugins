/*
 * Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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

import normalizeIcon from "../../assets/images/toolbar/toolbar-normalize.svg";

import { ComponentChild, createRef } from "preact";
import { Position } from "monaco-editor";

import { IEditorStatusInfo, ISchemaTreeEntry, IToolbarItems } from ".";
import { StandalonePresentationInterface } from "./execution/StandalonePresentationInterface";
import { requisitions } from "../../supplement/Requisitions";
import { CodeEditor } from "../../components/ui/CodeEditor/CodeEditor";
import { EditorLanguage } from "../../supplement";
import { IScriptExecutionOptions } from "../../components/ui/CodeEditor";
import { IComponentProperties, IComponentState, ComponentBase } from "../../components/ui/Component/ComponentBase";
import { Orientation, Container, ContentAlignment } from "../../components/ui/Container/Container";
import { SplitContainer, ISplitterPaneSizeInfo } from "../../components/ui/SplitContainer/SplitContainer";
import { ExecutionContext } from "../../script-execution/ExecutionContext";
import { PresentationInterface } from "../../script-execution/PresentationInterface";
import { DBEditorToolbar } from "./DBEditorToolbar";
import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor";
import { IOpenEditorState, ISavedEditorState } from "./DBConnectionTab";
import { Toolbar } from "../../components/ui/Toolbar/Toolbar";
import { SQLExecutionContext } from "../../script-execution/SQLExecutionContext";
import { Button } from "../../components/ui/Button/Button";
import { Icon } from "../../components/ui/Icon/Icon";

interface IScriptEditorProperties extends IComponentProperties {
    /** When true some adjustments are made to the UI to represent the editor in a way needed for pure notebooks. */
    standaloneMode: boolean;

    toolbarItems: IToolbarItems;

    backend?: ShellInterfaceSqlEditor;
    savedState: ISavedEditorState;

    /** Extra libraries for the code editor that don't change. */
    extraLibs?: Array<{ code: string, path: string; }>;

    onScriptExecution?: (context: ExecutionContext, options: IScriptExecutionOptions) => Promise<boolean>;
    onEdit?: (id?: string) => void;
}

interface IScriptEditorState extends IComponentState {
    // The id of the currently displayed editor.
    lastId: string;

    // These two fields are set via setState in the StandalonePresentationInterface.
    showResultPane: boolean;
    maximizeResultPane: boolean;
}

export class ScriptEditor extends ComponentBase<IScriptEditorProperties, IScriptEditorState> {

    private editorRef = createRef<CodeEditor>();
    private resultRef = createRef<HTMLDivElement>();

    private presentationInterface?: PresentationInterface;

    public constructor(props: IScriptEditorProperties) {
        super(props);

        this.state = {
            lastId: "",
            showResultPane: false,
            maximizeResultPane: false,
        };

        this.addHandledProperties("standaloneMode", "toolbarItems", "extraLibs", "backend", "onScriptExecution",
            "onEdit");
    }

    public static getDerivedStateFromProps(newProps: IScriptEditorProperties,
        oldState: IScriptEditorState): Partial<IScriptEditorState> {

        const { savedState } = newProps;
        const { lastId } = oldState;

        if (savedState.activeEntry !== lastId) {
            return {
                lastId: savedState.activeEntry,
                showResultPane: false,
                maximizeResultPane: false,
            };
        }

        return {};
    }

    public componentDidMount(): void {
        requisitions.register("explorerDoubleClick", this.handleExplorerDoubleClick);

        this.sendStatusInfo();
    }

    public componentDidUpdate(): void {
        this.sendStatusInfo();
    }

    public componentWillUnmount(): void {
        void requisitions.execute("updateStatusbar", [
            { id: "editorLanguage", visible: false },
            { id: "editorIndent", visible: false },
            { id: "editorPosition", visible: false },
            { id: "editorEOL", visible: false },
        ]);

        requisitions.unregister("explorerDoubleClick", this.handleExplorerDoubleClick);
    }

    public render(): ComponentChild {
        const { standaloneMode, savedState, toolbarItems, backend, extraLibs, onScriptExecution } = this.props;
        const { showResultPane, maximizeResultPane } = this.state;

        const className = this.getEffectiveClassNames(["standaloneScriptHost"]);
        const resultPaneHeight = this.presentationInterface?.currentHeight ?? 300;

        const activeEditorState = this.getActiveEditorState();
        const language = activeEditorState.state?.model.getLanguageId() ?? "";

        let toolbar;
        if (maximizeResultPane) {
            // There are two variations in maximized result pane mode. In standalone mode the toolbar shows only
            // a small set of buttons, namely buttons for execution and a close button (shown as normalize button).
            // In normal mode the toolbar shows all parts and the normalize button acts as such.
            if (standaloneMode) {
                toolbar = <Toolbar
                    id="dbEditorToolbar"
                    dropShadow={false}
                >
                    {toolbarItems.execution}
                    <div className="expander" />
                    <Button
                        id="normalizeResultStateButton"
                        imageOnly
                        data-tooltip="Return to embedded results"
                        onClick={this.closeEditor}
                    >
                        <Icon src={normalizeIcon} data-tooltip="inherit" />
                    </Button>
                </Toolbar >;
            } else {
                toolbar = <Toolbar
                    id="dbEditorToolbar"
                    dropShadow={false}
                >
                    {toolbarItems.navigation}
                    {toolbarItems.execution}
                    {toolbarItems.editor}
                    <div className="expander" />
                    <Button
                        id="normalizeResultStateButton"
                        imageOnly
                        data-tooltip="Normalize Result Tab"
                        onClick={this.toggleMaximizeResultPane}
                    >
                        <Icon src={normalizeIcon} data-tooltip="inherit" />
                    </Button>
                    {toolbarItems.auxillary}
                </Toolbar >;
            }
        } else {
            toolbar = <DBEditorToolbar
                toolbarItems={toolbarItems}
                language={language}
                activeEditor={savedState.activeEntry}
                heatWaveEnabled={savedState.heatWaveEnabled}
                editors={savedState.editors}
                backend={backend}
            />;
        }

        return (
            <Container
                orientation={Orientation.TopDown}
                style={{
                    flex: "1 1 auto",
                }}
                mainAlignment={ContentAlignment.Stretch}
            >
                {toolbar}
                <SplitContainer
                    orientation={Orientation.TopDown}
                    className={className}
                    panes={[
                        {
                            id: "editorPane",
                            minSize: maximizeResultPane ? 0 : 200,
                            initialSize: maximizeResultPane ? 0 : undefined,
                            stretch: !maximizeResultPane,
                            resizable: showResultPane && !maximizeResultPane,
                            content: <CodeEditor
                                ref={this.editorRef}
                                savedState={activeEditorState.state}
                                extraLibs={extraLibs}
                                minimap={{
                                    enabled: true,
                                }}
                                allowSoftWrap={true}
                                autoFocus={true}
                                font={{
                                    fontFamily: "SourceCodePro+Powerline+Awesome+MySQL",
                                    fontSize: 15,
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
                                onCursorChange={this.handleCursorChange}
                                onScriptExecution={onScriptExecution}
                                onModelChange={this.handleModelChange}
                                createResultPresentation={this.createPresentation}
                            />,
                        },
                        {
                            id: "resultPane",
                            minSize: showResultPane ? 200 : 0,
                            initialSize: showResultPane ? resultPaneHeight : 0,
                            stretch: maximizeResultPane,
                            content: <Container
                                innerRef={this.resultRef}
                                className="renderTarget"
                                orientation={Orientation.TopDown}
                            />,
                        },
                    ]}
                    onPaneResized={this.handlePaneResized}
                />
            </Container>
        );
    }

    public addOrUpdateExtraLib(content: string, filePath: string): void {
        this.editorRef.current?.addOrUpdateExtraLib(content, filePath);
    }

    /**
     * Executes the given SQL statement(s), without waiting for the result.
     *
     * @param sql The SQL statement(s) to execute.
     */
    public executeQuery(sql: string): void {
        this.editorRef.current?.appendText(sql);
        const block = this.editorRef.current?.lastExecutionBlock;

        if (block) {
            setTimeout(() => {
                const { onScriptExecution } = this.props;
                void onScriptExecution?.(block, {}).then((executed) => {
                    if (executed) {
                        setTimeout(() => {
                            this.toggleMaximizeResultPane();
                        }, 100);
                    }
                });
            }, 100);
        }
    }

    /**
     * A variant of executeQuery that waits for the result and maximizes the result pane.
     * This is called when maximizing a result view in a notebook or when running a query from the host
     * (if there's one, e.g. VS Code).
     *
     * @param sql The SQL statement(s) to execute.
     * @param forceSecondaryEngine Tells the executor to add a hint to SELECT statements to use the secondary
     *                             engine (usually HeatWave).
     *
     * @returns A promise that resolves to true when the execution is fully triggered.
     */
    public executeScript(sql: string, forceSecondaryEngine?: boolean): Promise<boolean> {
        return new Promise((resolve) => {
            if (this.editorRef.current) {
                // There's only one block in a script editor.
                const block = this.editorRef.current?.lastExecutionBlock;
                if (block instanceof SQLExecutionContext) {
                    const continueExecution = (id: string): Promise<boolean> => {
                        if (this.editorRef.current && id === block.id) {
                            requisitions.unregister("editorValidationDone", continueExecution);

                            const { onScriptExecution } = this.props;
                            void onScriptExecution?.(block, { forceSecondaryEngine }).then(() => {
                                setTimeout(() => {
                                    this.toggleMaximizeResultPane();
                                }, 100);

                                resolve(true); // For the outer promise.
                            });

                            return Promise.resolve(true);
                        }

                        resolve(false);

                        return Promise.resolve(false);
                    };

                    this.editorRef.current.clear();
                    requisitions.register("editorValidationDone", continueExecution);
                    this.editorRef.current.appendText(sql);
                }
            }
        });
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

    private handleCursorChange = (position: Position): void => {
        void requisitions.execute("updateStatusbar", [
            {
                id: "editorPosition",
                visible: true,
                text: `Ln ${position.lineNumber || 1}, Col ${position.column || 1}`,
            },
        ]);
    };

    private handleModelChange = (): void => {
        const { id, onEdit } = this.props;

        onEdit?.(id);
    };

    private handleExplorerDoubleClick = (entry: ISchemaTreeEntry): Promise<boolean> => {
        this.editorRef.current?.insertText(entry.caption);
        this.editorRef.current?.focus();

        return Promise.resolve(true);
    };

    private sendStatusInfo = (): void => {
        if (this.editorRef.current) {
            const activeEditor = this.getActiveEditorState();
            const editorState = activeEditor.state;
            if (editorState) {
                const position = editorState.viewState?.cursorState[0].position;
                const language = editorState.model.getLanguageId() as EditorLanguage;

                const info: IEditorStatusInfo = {
                    insertSpaces: editorState.options.insertSpaces,
                    indentSize: editorState.options.indentSize ?? 4,
                    tabSize: editorState.options.tabSize ?? 4,
                    line: position?.lineNumber ?? 1,
                    column: position?.column ?? 1,
                    language,
                    eol: editorState.options.defaultEOL || "LF",
                };

                void requisitions.execute("editorInfoUpdated", info);
            }
        }
    };

    private createPresentation = (editor: CodeEditor, language: EditorLanguage): PresentationInterface => {
        this.presentationInterface = new StandalonePresentationInterface(this, editor, language, this.resultRef);

        return this.presentationInterface;
    };

    private handlePaneResized = (info: ISplitterPaneSizeInfo[]): void => {
        info.forEach((value) => {
            if (value.id === "resultPane" && this.presentationInterface) {
                this.presentationInterface.currentHeight = value.currentSize;
            }
        });

    };

    private toggleMaximizeResultPane = (): void => {
        this.presentationInterface?.toggleResultPane();
    };

    private closeEditor = (): void => {
        const { savedState } = this.props;
        void requisitions.execute("editorClose",
            { connectionId: savedState.connectionId, editorId: savedState.activeEntry });
    };

    /**
     * Determines the active editor state from the saved state.
     * There must always be at least a single editor. If we cannot find the given active editor then pick the first
     * one unconditionally.
     *
     * @returns The active editor state.
     */
    private getActiveEditorState(): IOpenEditorState {
        const { savedState } = this.props;

        let activeEditor = savedState.editors.find(
            (entry: IOpenEditorState): boolean => {
                return entry.id === savedState.activeEntry;
            },
        );

        if (!activeEditor) {
            activeEditor = savedState.editors[0];
        }

        return activeEditor;
    }
}
