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

import { ComponentChild, createRef } from "preact";

import { ui } from "../../app-logic/UILayer.js";
import { Button } from "../../components/ui/Button/Button.js";
import { CodeEditor } from "../../components/ui/CodeEditor/CodeEditor.js";
import type { IPosition, IScriptExecutionOptions } from "../../components/ui/CodeEditor/index.js";
import {
    ComponentBase, type IComponentProperties, type IComponentState,
} from "../../components/ui/Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../../components/ui/Container/Container.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import { SplitContainer, type ISplitterPaneSizeInfo } from "../../components/ui/SplitContainer/SplitContainer.js";
import { StatusBarAlignment, type IStatusBarItem } from "../../components/ui/Statusbar/StatusBarItem.js";
import { Toolbar } from "../../components/ui/Toolbar/Toolbar.js";
import type { ConnectionDataModelEntry } from "../../data-models/ConnectionDataModel.js";
import type { IOdmScriptEntry } from "../../data-models/OpenDocumentDataModel.js";
import type { ExecutionContext } from "../../script-execution/ExecutionContext.js";
import type { PresentationInterface } from "../../script-execution/PresentationInterface.js";
import { SQLExecutionContext } from "../../script-execution/SQLExecutionContext.js";
import { Assets } from "../../supplement/Assets.js";
import { requisitions } from "../../supplement/Requisitions.js";
import type { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import type { EditorLanguage, IScriptRequest } from "../../supplement/index.js";
import type { IOpenDocumentState, ISavedEditorState } from "./DBConnectionTab.js";
import { DBEditorToolbar } from "./DBEditorToolbar.js";
import { StandalonePresentationInterface } from "./execution/StandalonePresentationInterface.js";
import type { IToolbarItems } from "./index.js";

interface IScriptEditorProperties extends IComponentProperties {
    /** When true some adjustments are made to the UI to represent the editor in a way needed for pure notebooks. */
    standaloneMode: boolean;

    toolbarItemsTemplate: IToolbarItems;

    backend?: ShellInterfaceSqlEditor;
    savedState: ISavedEditorState;
    connectionId: number;

    /** Extra libraries for the code editor that don't change. */
    extraLibs?: Array<{ code: string, path: string; }>;

    /** Font size to use. */
    fontSize?: number;

    onScriptExecution?: (context: ExecutionContext, options: IScriptExecutionOptions) => Promise<boolean>;
    onEdit?: (id?: string) => void;
}

interface IScriptEditorState extends IComponentState {
    // The id of the currently displayed editor.
    currentId: string;

    // These two fields are set via setState in the StandalonePresentationInterface.
    showResultPane: boolean;
    maximizeResultPane: boolean;
}

export class ScriptEditor extends ComponentBase<IScriptEditorProperties, IScriptEditorState> {

    private editorRef = createRef<CodeEditor>();
    private resultRef = createRef<HTMLDivElement>();

    #presentationInterface?: StandalonePresentationInterface;

    #editorLanguageSbEntry!: IStatusBarItem;
    #editorEolSbEntry!: IStatusBarItem;
    #editorIndentSbEntry!: IStatusBarItem;
    #editorPositionSbEntry!: IStatusBarItem;

    public constructor(props: IScriptEditorProperties) {
        super(props);

        this.state = {
            currentId: "",
            showResultPane: false,
            maximizeResultPane: false,
        };

        this.addHandledProperties("standaloneMode", "toolbarItems", "extraLibs", "backend", "onScriptExecution",
            "onEdit");
    }

    public static override getDerivedStateFromProps(newProps: IScriptEditorProperties,
        oldState: IScriptEditorState): Partial<IScriptEditorState> {

        const { savedState } = newProps;
        const { currentId: lastId } = oldState;

        if (savedState.activeEntry !== lastId) {
            return {
                currentId: savedState.activeEntry,
                showResultPane: false,
                maximizeResultPane: false,
            };
        }

        return {};
    }

    public override componentDidMount(): void {
        requisitions.register("connectionItemDefaultAction", this.doConnectionEntryDefaultAction);
        requisitions.register("editorInsertText", this.doInsertText);
        requisitions.register("editorCaretMoved", this.handleCaretMove);

        this.#editorPositionSbEntry = ui.createStatusBarItem("editorPosition", StatusBarAlignment.Right, 990);
        this.#editorIndentSbEntry = ui.createStatusBarItem("editorIndent", StatusBarAlignment.Right, 985);
        this.#editorEolSbEntry = ui.createStatusBarItem("editorEOL", StatusBarAlignment.Right, 980);
        this.#editorLanguageSbEntry = ui.createStatusBarItem("editorLanguage", StatusBarAlignment.Right, 975);

        this.updateStatusItems();
        this.updatePresentationInterface();
    }

    public override componentDidUpdate(): void {
        this.updateStatusItems();
        this.updatePresentationInterface();
    }

    public override componentWillUnmount(): void {
        this.#editorLanguageSbEntry.dispose();
        this.#editorIndentSbEntry.dispose();
        this.#editorPositionSbEntry.dispose();
        this.#editorEolSbEntry.dispose();

        requisitions.unregister("connectionItemDefaultAction", this.doConnectionEntryDefaultAction);
        requisitions.unregister("editorInsertText", this.doInsertText);
        requisitions.unregister("editorCaretMoved", this.handleCaretMove);
    }

    public render(): ComponentChild {
        const { standaloneMode, savedState, toolbarItemsTemplate, backend, extraLibs, fontSize,
            onScriptExecution } = this.props;
        const { showResultPane, maximizeResultPane } = this.state;

        const className = this.getEffectiveClassNames(["standaloneScriptHost"]);
        const resultPaneHeight = this.#presentationInterface?.currentHeight ?? 300;

        const activeEditorState = this.activeEditorState;
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
                    {toolbarItemsTemplate.execution}
                    <div className="expander" />
                    <Button
                        id="normalizeResultStateButton"
                        imageOnly
                        data-tooltip="Return to embedded results"
                        onClick={this.closeEditor}
                    >
                        <Icon src={Assets.toolbar.normalizeIcon} data-tooltip="inherit" />
                    </Button>
                </Toolbar >;
            } else {
                toolbar = <Toolbar
                    id="dbEditorToolbar"
                    dropShadow={false}
                >
                    {toolbarItemsTemplate.navigation}
                    {toolbarItemsTemplate.execution}
                    {toolbarItemsTemplate.editor}
                    <div className="expander" />
                    <Button
                        id="normalizeResultStateButton"
                        imageOnly
                        data-tooltip="Normalize Result Tab"
                        onClick={this.toggleMaximizeResultPane}
                    >
                        <Icon src={Assets.toolbar.normalizeIcon} data-tooltip="inherit" />
                    </Button>
                    {toolbarItemsTemplate.auxillary}
                </Toolbar >;
            }
        } else {
            const toolbarItems = {
                navigation: toolbarItemsTemplate.navigation.slice(),
                execution: toolbarItemsTemplate.execution,
                editor: toolbarItemsTemplate.editor,
                auxillary: toolbarItemsTemplate.auxillary,
            };

            toolbarItems.navigation.push(<Button
                id="itemSaveButton"
                key="itemSaveButton"
                imageOnly={true}
                data-tooltip="Save Script To File"
                style={{ marginLeft: "4px" }}
                onClick={this.handleEditorSave}
            >
                <Icon src={Assets.toolbar.saveIcon} data-tooltip="inherit" />
            </Button>);

            toolbarItems.navigation.push(<Button
                id="itemLoadButton"
                key="itemLoadButton"
                imageOnly={true}
                data-tooltip="Load Script From File"
                onClick={this.handleEditorLoad}
            >
                <Icon src={Assets.toolbar.loadIcon} data-tooltip="inherit" />
            </Button>);

            toolbar = <DBEditorToolbar
                toolbarItems={toolbarItems}
                language={language}
                activeDocument={savedState.activeEntry}
                heatWaveEnabled={savedState.heatWaveEnabled}
                documentState={savedState.documentStates}
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

    public addOrUpdateExtraLib(content: string, filePath: string): number {
        return this.editorRef.current?.addOrUpdateExtraLib(content, filePath) ?? 0;
    }

    /**
     * Executes the given SQL, waits for the result and maximizes the result pane.
     * This is called when maximizing a result view in a notebook or when running a query from the host
     * (if there's one, e.g. VS Code).
     *
     * @param sql The SQL statement(s) to execute.
     * @param forceSecondaryEngine Tells the executor to add a hint to SELECT statements to use the secondary
     *                             engine (usually HeatWave).
     *
     * @returns A promise that resolves to true when the execution is fully triggered.
     */
    public executeWithMaximizedResult(sql: string, forceSecondaryEngine?: boolean): Promise<boolean> {
        return new Promise((resolve) => {
            if (this.editorRef.current) {
                // There's only one block in a script editor.
                const block = this.editorRef.current?.lastExecutionBlock;
                if (block instanceof SQLExecutionContext) {
                    const continueExecution = (id: string): Promise<boolean> => {
                        if (id === block.id) {
                            requisitions.unregister("editorValidationDone", continueExecution);
                            if (this.editorRef.current) {
                                const { onScriptExecution } = this.props;
                                block.showNextResultMaximized();
                                void onScriptExecution?.(block, { forceSecondaryEngine }).then(() => {
                                    resolve(true); // For the outer promise.
                                });
                            } else {
                                resolve(true);
                            }

                            return Promise.resolve(true); // For the validation promise.
                        }

                        resolve(false);

                        return Promise.resolve(false); // Ditto.
                    };

                    // Remove any text that might be in the editor.
                    this.editorRef.current.clear();

                    // Add the new text and register a validation callback, to be notified when
                    // the editor is ready to execute the script. Need to do this in a timeout,
                    // as clearing the editor also triggers a validation.
                    setTimeout(() => {
                        requisitions.register("editorValidationDone", continueExecution);
                        this.editorRef.current!.appendText(sql);
                    }, 0);
                } else {
                    resolve(false);
                }
            } else {
                resolve(false);
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

    private handleCaretMove = (position: IPosition): Promise<boolean> => {
        if (this.#editorPositionSbEntry) {
            this.#editorPositionSbEntry.text = `Ln ${position.lineNumber || 1}, Col ${position.column || 1}`;
        }

        return Promise.resolve(true);
    };

    private handleModelChange = (): void => {
        const { id, onEdit } = this.props;

        onEdit?.(id);
    };

    private doConnectionEntryDefaultAction = (entry: ConnectionDataModelEntry): Promise<boolean> => {
        this.editorRef.current?.insertText(entry.caption);
        this.editorRef.current?.focus();

        return Promise.resolve(true);
    };

    private doInsertText = (text: string): Promise<boolean> => {
        this.editorRef.current?.insertText(text);

        return Promise.resolve(true);
    };

    private updateStatusItems = (): void => {
        if (this.editorRef.current) {
            const activeEditor = this.activeEditorState;
            const editorState = activeEditor.state;
            if (editorState) {
                const position = editorState.viewState?.cursorState[0].position;
                const language = editorState.model.getLanguageId() as EditorLanguage;

                this.#editorLanguageSbEntry.text = language;
                this.#editorEolSbEntry.text = editorState.options.defaultEOL || "LF";

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
        this.#presentationInterface = new StandalonePresentationInterface(language);
        this.#presentationInterface.activate(editor.backend!);

        return this.#presentationInterface;
    };

    private handlePaneResized = (info: ISplitterPaneSizeInfo[]): void => {
        info.forEach((value) => {
            if (value.id === "resultPane" && this.#presentationInterface) {
                this.#presentationInterface.currentHeight = value.currentSize;
            }
        });

    };

    private toggleMaximizeResultPane = (): void => {
        this.#presentationInterface?.toggleResultPane();
    };

    private closeEditor = (): void => {
        const { savedState, connectionId } = this.props;
        void requisitions.execute("closeDocument",
            { connectionId, documentId: savedState.activeEntry });
    };

    /**
     * Determines the active editor state from the saved state.
     * There must always be at least a single editor. If we cannot find the given active editor then pick the first
     * one unconditionally.
     *
     * @returns The active editor state.
     */
    private get activeEditorState(): IOpenDocumentState {
        const { savedState } = this.props;

        let activeEditor = savedState.documentStates.find(
            (entry: IOpenDocumentState): boolean => {
                return entry.document.id === savedState.activeEntry;
            },
        );

        if (!activeEditor) {
            activeEditor = savedState.documentStates[0];
        }

        return activeEditor;
    }

    private handleEditorLoad = (): void => {
        const activeEditor = this.activeEditorState;
        const editorState = activeEditor.state;
        if (editorState) {
            const document = activeEditor.document as IOdmScriptEntry;
            const details: IScriptRequest = {
                id: document.id,
                caption: document.caption,
                language: editorState.model.getLanguageId() as EditorLanguage,
                content: "",
            };
            requisitions.executeRemote("editorLoadScript", details);
        }
    };

    private handleEditorSave = (): void => {
        const activeEditor = this.activeEditorState;
        const editorState = activeEditor.state;
        if (editorState) {
            const model = editorState.model;
            const content = model.getValue();
            const document = activeEditor.document as IOdmScriptEntry;
            const details: IScriptRequest = {
                id: document.id,
                caption: document.caption,
                language: model.getLanguageId() as EditorLanguage,
                content,
            };

            requisitions.executeRemote("editorSaveScript", details);
        }
    };

    private updatePresentationInterface(): void {
        const activeEditor = this.activeEditorState;
        const contexts = activeEditor.state?.model.executionContexts;
        if (contexts && contexts.count > 0) {
            // In the script editor there's always a single context.
            const context = contexts.contextAt(0);
            this.#presentationInterface = context!.presentation as StandalonePresentationInterface;
            this.#presentationInterface.onMount(this.resultRef, this);
        }
    }
}
