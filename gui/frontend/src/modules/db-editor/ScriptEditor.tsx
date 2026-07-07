/*
 * Copyright (c) 2020, 2026, Oracle and/or its affiliates.
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
import { CodeEditor } from "../../components/ui/CodeEditor/CodeEditor.js";
import type { IPosition, IScriptExecutionOptions } from "../../components/ui/CodeEditor/index.js";
import {
    ComponentBase, type IComponentProperties, type IComponentState,
} from "../../components/ui/Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../../components/ui/Container/Container.js";
import { ResultTabView } from "../../components/ResultView/ResultTabView.js";
import { SplitContainer, type ISplitterPaneSizeInfo } from "../../components/ui/SplitContainer/SplitContainer.js";
import { StatusBarAlignment, type IStatusBarItem } from "../../components/ui/Statusbar/StatusBarItem.js";
import { MessageType } from "../../app-logic/general-types.js";
import type { ConnectionDataModelEntry } from "../../data-models/ConnectionDataModel.js";
import type { IOdmScriptEntry } from "../../data-models/OpenDocumentDataModel.js";
import { QueryType } from "../../parsing/parser-common.js";
import type { ExecutionContext } from "../../script-execution/ExecutionContext.js";
import type { PresentationInterface } from "../../script-execution/PresentationInterface.js";
import { SQLExecutionContext } from "../../script-execution/SQLExecutionContext.js";
import { type IResultSets, LoadingState } from "../../script-execution/index.js";
import { desktopCommandRegistry } from "../../supplement/DesktopCommandRegistry.js";
import { requisitions } from "../../supplement/Requisitions.js";
import type { ISqlTransactionChangeDetails } from "../../supplement/RequisitionTypes.js";
import { Settings } from "../../supplement/Settings/Settings.js";
import type { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { convertErrorToString } from "../../utilities/helpers.js";
import type { EditorLanguage, IScriptRequest } from "../../supplement/index.js";
import type { IOpenDocumentState, ISavedEditorState } from "./ConnectionWorkspace.js";
import type { IDesktopRunState } from "./DocumentToolbar.js";
import { StandalonePresentationInterface } from "./execution/StandalonePresentationInterface.js";
import type { IToolbarItems } from "./index.js";
import { getNextTransactionOpenState } from "./transactionState.js";

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

    defaultSaveCaption?: string;

    onScriptExecution?: (context: ExecutionContext, options: IScriptExecutionOptions) => Promise<boolean>;
    onEdit?: (id?: string) => void;
    onExplainError?: (context: ExecutionContext, options: IScriptExecutionOptions) => Promise<boolean>;
    onDesktopRunStateChanged?: () => void;
}

interface IScriptEditorState extends IComponentState {
    // The id of the currently displayed editor.
    currentId: string;

    // These two fields are set via setState in the StandalonePresentationInterface.
    showResultPane: boolean;
    maximizeResultPane: boolean;
    hasResultContent: boolean;
    autoCommit: boolean;
    transactionOpen: boolean;
    cursorPositionText: string;
}

export class ScriptEditor extends ComponentBase<IScriptEditorProperties, IScriptEditorState> {

    private editorRef = createRef<CodeEditor>();
    private resultRef = createRef<HTMLDivElement>();

    private presentationInterface?: StandalonePresentationInterface;
    private stateChangeTimer: ReturnType<typeof setTimeout> | null = null;

    private editorLanguageSbEntry!: IStatusBarItem;
    private editorEolSbEntry!: IStatusBarItem;
    private editorIndentSbEntry!: IStatusBarItem;
    private editorPositionSbEntry!: IStatusBarItem;

    public constructor(props: IScriptEditorProperties) {
        super(props);

        const initialPresentationState = ScriptEditor.getPresentationState(props.savedState);

        this.state = {
            currentId: props.savedState.activeEntry,
            showResultPane: true,
            maximizeResultPane: initialPresentationState.maximizeResultPane,
            hasResultContent: initialPresentationState.hasResultContent,
            autoCommit: true,
            transactionOpen: false,
            cursorPositionText: "Ln 1, Col 1",
        };

        this.addHandledProperties("standaloneMode", "toolbarItemsTemplate", "extraLibs", "backend",
            "onScriptExecution",
            "onEdit", "onExplainError", "defaultSaveCaption", "onDesktopRunStateChanged");
    }

    public static override getDerivedStateFromProps(newProps: IScriptEditorProperties,
        oldState: IScriptEditorState): Partial<IScriptEditorState> {

        const { savedState } = newProps;
        const { currentId: lastId } = oldState;

        if (savedState.activeEntry !== lastId) {
            const presentationState = ScriptEditor.getPresentationState(savedState);

            return {
                currentId: savedState.activeEntry,
                showResultPane: true,
                maximizeResultPane: presentationState.maximizeResultPane,
                hasResultContent: presentationState.hasResultContent,
                cursorPositionText: "Ln 1, Col 1",
            };
        }

        return {};
    }

    public override componentDidMount(): void {
        requisitions.register("connectionItemDefaultAction", this.doConnectionEntryDefaultAction);
        requisitions.register("editorInsertText", this.doInsertText);
        requisitions.register("editorCaretMoved", this.handleCaretMove);
        requisitions.register("editorContextStateChanged", this.handleContextStateChanged);
        requisitions.register("editorToggleStopExecutionOnError", this.toggleStopExecutionOnError);
        requisitions.register("editorToggleAutoCommit", this.toggleAutoCommit);
        requisitions.register("sqlTransactionChanged", this.transactionChanged);
        requisitions.register("sqlTransactionEnded", this.transactionEnded);
        requisitions.register("settingsChanged", this.settingsChanged);

        this.editorPositionSbEntry = ui.createStatusBarItem("editorPosition", StatusBarAlignment.Right, 990);
        this.editorIndentSbEntry = ui.createStatusBarItem("editorIndent", StatusBarAlignment.Right, 985);
        this.editorEolSbEntry = ui.createStatusBarItem("editorEOL", StatusBarAlignment.Right, 980);
        this.editorLanguageSbEntry = ui.createStatusBarItem("editorLanguage", StatusBarAlignment.Right, 975);

        this.updateStatusItems();
        this.updatePresentationInterface(true);
        void this.queryAutoCommit();
        desktopCommandRegistry.notifyHostStateChanged();
        this.props.onDesktopRunStateChanged?.();
    }

    public override componentDidUpdate(
        prevProps: IScriptEditorProperties,
        prevState: IScriptEditorState,
    ): void {
        const activeEntryChanged = prevProps.savedState.activeEntry !== this.props.savedState.activeEntry;

        this.updateStatusItems();
        this.updatePresentationInterface(activeEntryChanged);

        if (activeEntryChanged
            || this.state.autoCommit !== prevState.autoCommit
            || this.state.transactionOpen !== prevState.transactionOpen) {
            desktopCommandRegistry.notifyHostStateChanged();
            this.props.onDesktopRunStateChanged?.();
        }
    }

    public override componentWillUnmount(): void {
        if (this.stateChangeTimer) {
            clearTimeout(this.stateChangeTimer);
            this.stateChangeTimer = null;
        }

        this.editorLanguageSbEntry.dispose();
        this.editorIndentSbEntry.dispose();
        this.editorPositionSbEntry.dispose();
        this.editorEolSbEntry.dispose();

        requisitions.unregister("connectionItemDefaultAction", this.doConnectionEntryDefaultAction);
        requisitions.unregister("editorInsertText", this.doInsertText);
        requisitions.unregister("editorCaretMoved", this.handleCaretMove);
        requisitions.unregister("editorContextStateChanged", this.handleContextStateChanged);
        requisitions.unregister("editorToggleStopExecutionOnError", this.toggleStopExecutionOnError);
        requisitions.unregister("editorToggleAutoCommit", this.toggleAutoCommit);
        requisitions.unregister("sqlTransactionChanged", this.transactionChanged);
        requisitions.unregister("sqlTransactionEnded", this.transactionEnded);
        requisitions.unregister("settingsChanged", this.settingsChanged);
    }

    public render(): ComponentChild {
        const { savedState, extraLibs, fontSize, onScriptExecution, onExplainError } = this.props;
        const { showResultPane, maximizeResultPane, hasResultContent } = this.state;

        const className = this.getEffectiveClassNames(["standaloneScriptHost"]);
        const resultPaneHeight = this.presentationInterface?.currentHeight ?? 300;

        const activeEditorState = this.activeEditorState;

        return (
            <Container
                className="standaloneScriptEditorRoot"
                orientation={Orientation.TopDown}
                style={{
                    flex: "1 1 auto",
                    minWidth: 0,
                    minHeight: 0,
                    overflow: "hidden",
                }}
                mainAlignment={ContentAlignment.Stretch}
            >
                <SplitContainer
                    orientation={Orientation.TopDown}
                    className={className}
                    splitterSize={24}
                    panes={[
                        {
                            id: "editorPane",
                            minSize: maximizeResultPane ? 0 : 200,
                            initialSize: maximizeResultPane ? 0 : undefined,
                            stretch: !maximizeResultPane,
                            resizable: showResultPane && !maximizeResultPane,
                            splitterClassName: "scriptEditorStatusbarSash",
                            splitterPlacement: "before",
                            splitterContent: this.renderEmbeddedStatusbar(),
                            content: <CodeEditor
                                key={savedState.activeEntry}
                                ref={this.editorRef}
                                savedState={activeEditorState.state}
                                extraLibs={extraLibs}
                                onSave={this.saveActiveScript}
                                minimap={{
                                    enabled: true,
                                }}
                                allowSoftWrap={true}
                                autoFocus={true}
                                font={{
                                    fontFamily: "var(--msg-monospace-font-family)",
                                    fontSize: fontSize ?? 12,
                                    lineHeight: 18,
                                }}
                                scrollbar={{
                                    useShadows: true,
                                    verticalHasArrows: false,
                                    horizontalHasArrows: false,
                                    vertical: "auto",
                                    horizontal: "auto",

                                    verticalScrollbarSize: 12,
                                    horizontalScrollbarSize: 12,
                                }}
                                onScriptExecution={onScriptExecution}
                                onExplainError={onExplainError}
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
                                className="scriptEditorResultPane"
                                orientation={Orientation.TopDown}
                            >
                                {!hasResultContent && this.renderEmptyResultPane()}
                                <Container
                                    innerRef={this.resultRef}
                                    className="renderTarget"
                                    orientation={Orientation.TopDown}
                                    style={{ display: hasResultContent ? "flex" : "none" }}
                                />
                            </Container>,
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

    public getDesktopRunState = (): IDesktopRunState | undefined => {
        const executionContext = this.getCurrentExecutionContext();
        if (!executionContext) {
            return undefined;
        }

        return {
            canExecute: executionContext.loadingState === LoadingState.Idle,
            canExecuteSubparts: executionContext.isSQLLike,
            canStop: executionContext.loadingState !== LoadingState.Idle,
            autoCommit: this.state.autoCommit,
            transactionOpen: this.state.transactionOpen,
            stopOnErrors: Settings.get("editor.stopOnErrors", true),
        };
    };

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
                const block = this.editorRef.current.lastExecutionBlock;
                if (block instanceof SQLExecutionContext) {
                    const continueExecution = (id: string): Promise<boolean> => {
                        if (id === block.id) {
                            requisitions.unregister("editorValidationDone", continueExecution);
                            if (this.editorRef.current) {
                                const { onScriptExecution } = this.props;
                                block.showNextResultMaximized = true;
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
        const cursorPositionText = `Ln ${position.lineNumber || 1}, Col ${position.column || 1}`;
        this.editorPositionSbEntry.text = cursorPositionText;
        if (this.state.cursorPositionText !== cursorPositionText) {
            this.setState({ cursorPositionText });
        }

        return Promise.resolve(true);
    };

    private handleContextStateChanged = (id: string): Promise<boolean> => {
        const currentContext = this.getCurrentExecutionContext();
        if (currentContext?.id !== id) {
            return Promise.resolve(false);
        }

        desktopCommandRegistry.notifyHostStateChanged();
        this.props.onDesktopRunStateChanged?.();

        if (currentContext.loadingState !== LoadingState.Idle) {
            this.startStateChangeTimer();
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

    private startStateChangeTimer = (): void => {
        if (this.stateChangeTimer) {
            clearTimeout(this.stateChangeTimer);
        }

        this.stateChangeTimer = setTimeout(() => {
            const currentContext = this.getCurrentExecutionContext();
            if (currentContext?.loadingState === LoadingState.Idle) {
                desktopCommandRegistry.notifyHostStateChanged();
                this.props.onDesktopRunStateChanged?.();
                this.stateChangeTimer = null;
            } else {
                this.startStateChangeTimer();
            }
        }, 500);
    };

    private toggleStopExecutionOnError = (active: boolean): Promise<boolean> => {
        Settings.set("editor.stopOnErrors", !active);
        desktopCommandRegistry.notifyHostStateChanged();
        this.props.onDesktopRunStateChanged?.();

        return Promise.resolve(true);
    };

    private toggleAutoCommit = async (): Promise<boolean> => {
        const { backend } = this.props;
        const { autoCommit } = this.state;

        try {
            await backend?.setAutoCommit(!autoCommit);
            await this.queryAutoCommit();
            await requisitions.execute("sqlTransactionChanged", { queryType: QueryType.SetAutoCommit });
        } catch (reason) {
            void ui.showErrorMessage(`Cannot Switch Auto Commit Mode.${convertErrorToString(reason)}`, {});
        }

        desktopCommandRegistry.notifyHostStateChanged();
        this.props.onDesktopRunStateChanged?.();

        return true;
    };

    private transactionChanged = async (details?: ISqlTransactionChangeDetails): Promise<boolean> => {
        const autoCommit = await this.queryAutoCommit();
        await new Promise<void>((resolve) => {
            this.setState((prevState) => {
                return {
                    transactionOpen: getNextTransactionOpenState(
                        prevState.transactionOpen,
                        autoCommit,
                        details,
                    ),
                };
            }, resolve);
        });
        desktopCommandRegistry.notifyHostStateChanged();
        this.props.onDesktopRunStateChanged?.();

        return true;
    };

    private transactionEnded = async (details?: ISqlTransactionChangeDetails): Promise<boolean> => {
        return this.transactionChanged(details);
    };

    private settingsChanged = (entry?: { key: string; value: unknown; }): Promise<boolean> => {
        if (!entry || entry.key === "editor.stopOnErrors") {
            desktopCommandRegistry.notifyHostStateChanged();
            this.props.onDesktopRunStateChanged?.();

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

    private updateStatusItems = (): void => {
        if (this.editorRef.current) {
            const activeEditor = this.activeEditorState;
            const editorState = activeEditor.state;
            if (editorState) {
                const position = editorState.viewState?.cursorState[0].position;
                const language = editorState.model.getLanguageId() as EditorLanguage;

                this.editorLanguageSbEntry.text = language;
                this.editorEolSbEntry.text = editorState.options.defaultEOL ?? "LF";

                if (editorState.options.insertSpaces) {
                    this.editorIndentSbEntry.text = `Spaces: ${editorState.options.indentSize ?? 4}`;
                } else {
                    this.editorIndentSbEntry.text = `Tab Size: ${editorState.options.tabSize ?? 4}`;
                }

                const cursorPositionText = `Ln ${position?.lineNumber ?? 1}, Col ${position?.column ?? 1}`;
                this.editorPositionSbEntry.text = cursorPositionText;
                if (this.state.cursorPositionText !== cursorPositionText) {
                    this.setState({ cursorPositionText });
                }
            }
        }
    };

    private createPresentation = (editor: CodeEditor, language: EditorLanguage): PresentationInterface => {
        this.presentationInterface = new StandalonePresentationInterface(language);
        this.presentationInterface.activate(editor.backend!);

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
        const { savedState, connectionId } = this.props;
        void requisitions.execute("closeDocument",
            { connectionId, documentId: savedState.activeEntry });
    };

    private renderEmptyResultPane = (): ComponentChild => {
        const emptyResultSets: IResultSets = {
            type: "resultSets",
            output: [{
                type: MessageType.Text,
                content: "",
            }],
            sets: [],
        };

        return (
            <ResultTabView
                resultSets={emptyResultSets}
                contextId={this.state.currentId}
                currentSet={0}
                hideTabs="never"
                upperCaseKeywords={Settings.get("dbEditor.upperCaseKeywords", true)}
            />
        );
    };

    private renderEmbeddedStatusbar = (): ComponentChild => {
        return (
            <Container
                id="scriptEditorEmbeddedStatusbar"
                className="statusbar"
                orientation={Orientation.LeftToRight}
            >
                <Container className="leftItems" orientation={Orientation.LeftToRight} />
                <Container className="rightItems" orientation={Orientation.LeftToRight}>
                    <div className="statusbarItem">{this.currentCursorPositionText}</div>
                </Container>
            </Container>
        );
    };

    private get currentCursorPositionText(): string {
        const position = this.editorRef.current?.backend?.getPosition();
        if (position) {
            return `Ln ${position.lineNumber || 1}, Col ${position.column || 1}`;
        }

        return this.state.cursorPositionText;
    }

    private static getPresentationState(savedState: ISavedEditorState): Pick<IScriptEditorState,
        "hasResultContent" | "maximizeResultPane"> {
        const activeEditor = savedState.documentStates.find((entry) => {
            return entry.document.id === savedState.activeEntry;
        }) ?? savedState.documentStates[0];
        const executionContexts = activeEditor?.state?.model.executionContexts;
        const presentation = executionContexts && executionContexts.count > 0
            ? executionContexts.contextAt(0)?.presentation
            : undefined;

        return {
            hasResultContent: ScriptEditor.hasPresentationResultContent(presentation),
            maximizeResultPane: presentation?.maximizedResult ?? false,
        };
    }

    private static hasPresentationResultContent(presentation?: PresentationInterface): boolean {
        const resultData = presentation?.resultData;
        if (!resultData) {
            return false;
        }

        switch (resultData.type) {
            case "text": {
                return (resultData.text?.length ?? 0) > 0;
            }

            case "resultSets": {
                return resultData.sets.length > 0 || (resultData.output?.length ?? 0) > 0;
            }

            default: {
                return true;
            }
        }
    }

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

        activeEditor ??= savedState.documentStates[0];

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
                fileName: activeEditor.fileName,
                language: editorState.model.getLanguageId() as EditorLanguage,
                content: "",
                openFromFile: true,
            };
            void requisitions.execute("editorLoadScript", details);
        }
    };

    private handleEditorSave = (): void => {
        this.saveActiveScript(false);
    };

    public saveActiveScript = (saveAs = false): void => {
        const activeEditor = this.activeEditorState;
        const editorState = activeEditor.state;
        if (!editorState) {
            return;
        }

        const model = editorState.model;
        const document = activeEditor.document as IOdmScriptEntry;
        const details: IScriptRequest = {
            id: document.id,
            caption: this.props.defaultSaveCaption ?? document.caption,
            fileName: activeEditor.fileName,
            language: model.getLanguageId() as EditorLanguage,
            content: model.getValue(),
            saveAs,
        };

        requisitions.executeRemote("editorSaveScript", details);
    };

    public openIntoActiveScript = (): void => {
        this.handleEditorLoad();
    };

    private updatePresentationInterface(restoreExistingResult = false): void {
        const activeEditor = this.activeEditorState;
        const contexts = activeEditor.state?.model.executionContexts;
        if (contexts && contexts.count > 0) {
            // In the script editor there's always a single context.
            const context = contexts.contextAt(0);
            this.presentationInterface = context!.presentation as StandalonePresentationInterface;
            this.presentationInterface.onMount(this.resultRef, this);
            this.syncPresentationState(this.presentationInterface);

            if (restoreExistingResult && ScriptEditor.hasPresentationResultContent(this.presentationInterface)
                && this.presentationInterface.resultData) {
                this.presentationInterface.setResult(this.presentationInterface.resultData, {
                    currentSet: this.presentationInterface.currentSet,
                    manualHeight: this.presentationInterface.currentHeight,
                    maximized: this.presentationInterface.maximizedResult,
                });
            }
        } else {
            this.presentationInterface = undefined;
            this.syncPresentationState(undefined);
        }
    }

    private syncPresentationState(presentation?: PresentationInterface): void {
        const nextState = {
            showResultPane: true,
            hasResultContent: ScriptEditor.hasPresentationResultContent(presentation),
            maximizeResultPane: presentation?.maximizedResult ?? false,
        };

        if (this.state.showResultPane !== nextState.showResultPane
            || this.state.hasResultContent !== nextState.hasResultContent
            || this.state.maximizeResultPane !== nextState.maximizeResultPane) {
            this.setState(nextState);
        }
    }

    private getCurrentExecutionContext = (): ExecutionContext | undefined => {
        const contexts = this.activeEditorState.state?.model.executionContexts;
        if (!contexts) {
            return undefined;
        }

        return contexts.contextFromPosition(contexts.cursorPosition);
    };

    private queryAutoCommit = async (): Promise<boolean> => {
        const value = await this.props.backend?.getAutoCommit?.();
        const autoCommit = value === true;
        await new Promise<void>((resolve) => {
            this.setState({ autoCommit }, resolve);
        });

        return autoCommit;
    };
}
