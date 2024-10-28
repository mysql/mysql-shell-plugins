/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

import chatOptionsIcon from "../../assets/images/chatOptions.svg";
import lakehouseNavigatorIcon from "../../assets/images/lakehouseNavigator.svg";
import autoCommitActiveIcon from "../../assets/images/toolbar/toolbar-auto_commit-active.svg";
import autoCommitInactiveIcon from "../../assets/images/toolbar/toolbar-auto_commit-inactive.svg";
import commitIcon from "../../assets/images/toolbar/toolbar-commit.svg";
import executeCaretIcon from "../../assets/images/toolbar/toolbar-execute_caret.svg";
import executePrintTextIcon from "../../assets/images/toolbar/toolbar-execute_print_text.svg";

//import executeExplainIcon from "../../assets/images/toolbar/execute-explain.svg";
import executeIcon from "../../assets/images/toolbar/toolbar-execute.svg";
import executeHeatWaveCaretIcon from "../../assets/images/toolbar/toolbar-execute_caret_heatwave.svg";
import executeHeatWaveIcon from "../../assets/images/toolbar/toolbar-execute_heatwave.svg";
import rollbackIcon from "../../assets/images/toolbar/toolbar-rollback.svg";
import searchIcon from "../../assets/images/toolbar/toolbar-search.svg";
import showHiddenActiveIcon from "../../assets/images/toolbar/toolbar-show_hidden-active.svg";
import showHiddenInactiveIcon from "../../assets/images/toolbar/toolbar-show_hidden-inactive.svg";
import stopExecutionIcon from "../../assets/images/toolbar/toolbar-stop_execution.svg";
import stopOnErrorActiveIcon from "../../assets/images/toolbar/toolbar-stop_on_error-active.svg";
import stopOnErrorInactiveIcon from "../../assets/images/toolbar/toolbar-stop_on_error-inactive.svg";
import wordWrapActiveIcon from "../../assets/images/toolbar/toolbar-word_wrap-active.svg";
import wordWrapInactiveIcon from "../../assets/images/toolbar/toolbar-word_wrap-inactive.svg";

import { ComponentChild } from "preact";

import { Button } from "../../components/ui/Button/Button.js";
import type { IPosition } from "../../components/ui/CodeEditor/index.js";
import { ComponentBase, IComponentProperties, IComponentState } from "../../components/ui/Component/ComponentBase.js";
import { Divider } from "../../components/ui/Divider/Divider.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import { Toolbar } from "../../components/ui/Toolbar/Toolbar.js";
import { ExecutionContext } from "../../script-execution/ExecutionContext.js";
import { LoadingState } from "../../script-execution/index.js";
import { requisitions } from "../../supplement/Requisitions.js";
import { Settings } from "../../supplement/Settings/Settings.js";
import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { IOpenDocumentState } from "./DBConnectionTab.js";
import { IToolbarItems } from "./index.js";

interface IDBEditorToolbarProperties extends IComponentProperties {
    /**
     * Items defined by the owner(s) of this toolbar.
     * They are combined with those created here to form the actual toolbar.
     */
    toolbarItems: IToolbarItems;

    activeDocument: string;
    documentState: IOpenDocumentState[];
    heatWaveEnabled: boolean;

    /** The editor language, if the document is a notebook or script. */
    language: string;

    backend?: ShellInterfaceSqlEditor;
}

interface IDBEditorToolbarState extends IComponentState {
    editorId: string;
    currentEditor?: IOpenDocumentState;

    currentContext?: ExecutionContext;

    canExecute: boolean;
    canStop: boolean;
    canExecuteSubparts: boolean;
    autoCommit: boolean;
    contextLanguage: string;
}

export class DBEditorToolbar extends ComponentBase<IDBEditorToolbarProperties, IDBEditorToolbarState> {

    private stateChangeTimer: ReturnType<typeof setTimeout> | null = null;

    public constructor(props: IDBEditorToolbarProperties) {
        super(props);

        const currentEditor = props.documentState.find((state) => {
            return state.document.id === props.activeDocument;
        });

        this.state = {
            editorId: props.activeDocument,
            currentEditor,
            canExecute: true,
            canStop: false,
            canExecuteSubparts: false,
            autoCommit: true,
            contextLanguage: "sql",
        };

        this.addHandledProperties("toolbarItems", "activeDocument", "heatWaveEnabled", "documentState", "language",
            "backend");
    }

    public override componentDidUpdate(oldProps: IDBEditorToolbarProperties): void {
        const { activeDocument, documentState } = this.props;
        if (activeDocument !== oldProps.activeDocument) {
            const currentEditor = documentState.find((state) => {
                return state.document.id === activeDocument;
            });

            const contexts = currentEditor?.state?.model.executionContexts;
            if (contexts) {
                const context = contexts.contextFromPosition(contexts.cursorPosition) as ExecutionContext;
                if (context) {
                    this.setState({
                        currentEditor,
                        currentContext: context,
                        canExecute: context.loadingState === LoadingState.Idle,
                        canStop: context.loadingState !== LoadingState.Idle,
                        canExecuteSubparts: context.isSQLLike,
                    });
                } else {
                    this.setState({ currentEditor });
                }
            }
        }
    }

    public override componentDidMount(): void {
        const { language } = this.props;

        requisitions.register("editorCaretMoved", this.handleCaretMove);
        requisitions.register("editorContextStateChanged", this.contextStateChanged);
        requisitions.register("editorToggleStopExecutionOnError", this.toggleStopExecutionOnError);
        requisitions.register("editorToggleAutoCommit", this.toggleAutoCommit);
        requisitions.register("sqlTransactionEnded", this.transactionEnded);
        requisitions.register("settingsChanged", this.settingsChanged);

        this.setState({
            canExecuteSubparts: language === "mysql" || language === "sql",
        });
    }

    public override componentWillUnmount(): void {
        if (this.stateChangeTimer) {
            clearTimeout(this.stateChangeTimer);
            this.stateChangeTimer = null;
        }

        requisitions.unregister("editorCaretMoved", this.handleCaretMove);
        requisitions.unregister("editorContextStateChanged", this.contextStateChanged);
        requisitions.unregister("editorToggleStopExecutionOnError", this.toggleStopExecutionOnError);
        requisitions.unregister("editorToggleAutoCommit", this.toggleAutoCommit);
        requisitions.unregister("sqlTransactionEnded", this.transactionEnded);
        requisitions.unregister("settingsChanged", this.settingsChanged);
    }

    public render(): ComponentChild {
        const { toolbarItems, language, heatWaveEnabled } = this.props;
        const { autoCommit, canExecute, canStop, canExecuteSubparts } = this.state;

        const area = language === "msg" ? "block" : "script";
        const selectionText = canExecuteSubparts ? "the selection or " : "";

        const stopOnErrors = Settings.get("editor.stopOnErrors", true);
        const stopOnErrorIcon = stopOnErrors ? stopOnErrorActiveIcon : stopOnErrorInactiveIcon;

        const autoCommitIcon = autoCommit ? autoCommitActiveIcon : autoCommitInactiveIcon;

        const showHidden = Settings.get("editor.showHidden", false);
        const showHiddenIcon = showHidden ? showHiddenActiveIcon : showHiddenInactiveIcon;

        const wordWrap = Settings.get("editor.wordWrap", "off");
        const wordWrapIcon = wordWrap === "on" ? wordWrapActiveIcon : wordWrapInactiveIcon;

        const executionItems = toolbarItems.execution.slice();
        if (language === "msg") {
            executionItems.push(
                <Button
                    key="executeFullBlock"
                    data-tooltip={`Execute ${selectionText}everything in the current block and create a new block`}
                    imageOnly={true}
                    disabled={!canExecute}
                    onClick={
                        () => {
                            void requisitions.execute("editorExecuteSelectedOrAll",
                                { advance: true, forceSecondaryEngine: false, asText: false });
                        }
                    }
                >
                    <Icon src={executeIcon} data-tooltip="inherit" />
                </Button>);
        } else {
            executionItems.push(
                <Button
                    key="executeFullBlock"
                    data-tooltip={`Execute full script`}
                    imageOnly={true}
                    disabled={!canExecute}
                    onClick={
                        () => {
                            void requisitions.execute("editorExecuteSelectedOrAll",
                                { advance: false, forceSecondaryEngine: false, asText: false });
                        }
                    }
                >
                    <Icon src={executeIcon} data-tooltip="inherit" />
                </Button>);
        }

        if (canExecuteSubparts) {
            executionItems.push(
                <Button
                    key="executeFromCaret"
                    data-tooltip="Execute the statement at the caret position"
                    imageOnly={true}
                    disabled={!canExecute}
                    onClick={
                        () => {
                            void requisitions.execute("editorExecute",
                                { advance: false, forceSecondaryEngine: false, asText: false });
                        }
                    }
                >
                    <Icon src={executeCaretIcon} data-tooltip="inherit" />
                </Button>,
            );

            executionItems.push(
                <Button
                    key="executeToText"
                    data-tooltip={`Execute the ${area} and print the result as text`}
                    imageOnly={true}
                    disabled={!canExecute}
                    onClick={
                        () => {
                            void requisitions.execute("editorExecuteSelectedOrAll",
                                { advance: true, forceSecondaryEngine: false, asText: true });
                        }
                    }
                >
                    <Icon src={executePrintTextIcon} data-tooltip="inherit" />
                </Button>,
            );

            if (heatWaveEnabled) {
                executionItems.push(
                    <Button
                        key="executeFullBlockHeatWave"
                        data-tooltip={`Execute ${selectionText}full ${area} on HeatWave and create a new block`}
                        imageOnly={true}
                        disabled={!canExecute}
                        onClick={
                            () => {
                                void requisitions.execute("editorExecuteSelectedOrAll",
                                    { advance: true, forceSecondaryEngine: true, asText: false });
                            }
                        }
                    >
                        <Icon src={executeHeatWaveIcon} data-tooltip="inherit" />
                    </Button>,
                    <Button
                        key="executeFromCaretHeatWave"
                        data-tooltip={`Execute statement at current position on HeatWave`}
                        imageOnly={true}
                        disabled={!canExecute}
                        onClick={
                            () => {
                                void requisitions.execute("editorExecute",
                                    { advance: false, forceSecondaryEngine: true, asText: false });
                            }
                        }
                    >
                        <Icon src={executeHeatWaveCaretIcon} data-tooltip="inherit" />
                    </Button>,
                );
            }

            executionItems.push(
                <Button
                    key="editorStpExecutionButton"
                    data-tooltip="Stop execution of the current statement/script"
                    requestType="editorStopExecution"
                    imageOnly={true}
                    disabled={!canStop}
                >
                    <Icon src={stopExecutionIcon} data-tooltip="inherit" />
                </Button>,
                <Button
                    key="editorStpExecutionOnErrorButton"
                    data-tooltip="Stop execution of the current statement/script in case of errors"
                    imageOnly={true}
                    onClick={
                        () => { void requisitions.execute("editorToggleStopExecutionOnError", stopOnErrors); }
                    }
                >
                    <Icon src={stopOnErrorIcon} data-tooltip="inherit" />
                </Button>,
            );
        }

        if (canExecuteSubparts) {
            executionItems.push(
                <Divider key="divider2" vertical={true} thickness={1} />,
                <Button
                    key="commitButton"
                    data-tooltip="Commit DB changes"
                    requestType="editorCommit"
                    imageOnly={true}
                    disabled={autoCommit}
                >
                    <Icon src={commitIcon} data-tooltip="inherit" />
                </Button>,
                <Button
                    key="rollbackButton"
                    data-tooltip="Rollback DB changes"
                    requestType="editorRollback"
                    imageOnly={true}
                    disabled={autoCommit}
                >
                    <Icon src={rollbackIcon} data-tooltip="inherit" />
                </Button>,
                <Button
                    key="autoCommitButton"
                    data-tooltip="Auto commit DB changes"
                    requestType="editorToggleAutoCommit"
                    imageOnly={true}
                >
                    <Icon src={autoCommitIcon} data-tooltip="inherit" />
                </Button>,
            );
        }

        const editorItems = toolbarItems.editor.slice();
        editorItems.push(
            /* We have no formatting yet.
            <Button
                key="editorFormatButton"
                data-tooltip="Format current block or script"
                requestType="editorFormat"
                imageOnly={true}
            >
                <Icon src={formatIcon} data-tooltip="inherit" />
            </Button>,
            <Divider key="formatDivider" vertical={true} thickness={1} />,*/
            <Button
                key="editorFindButton"
                data-tooltip="Find"
                requestType="editorFind"
                imageOnly={true}
            >
                <Icon src={searchIcon} data-tooltip="inherit" />
            </Button>,
            <Button
                key="editorShowHiddenButton"
                data-tooltip="Show hidden characters"
                imageOnly={true}
                onClick={this.toggleHidden}
            >
                <Icon src={showHiddenIcon} data-tooltip="inherit" />
            </Button>,
            <Button
                key="editorToggleSoftWrapButton"
                data-tooltip="Soft wrap lines"
                imageOnly={true}
                onClick={() => { Settings.set("editor.wordWrap", wordWrap === "on" ? "off" : "on"); }}
            >
                <Icon src={wordWrapIcon} data-tooltip="inherit" />
            </Button>,
        );
        if (heatWaveEnabled /*&& contextLanguage === "text"*/) {
            editorItems.push(
                <Divider key="formatDividerChatOptions" vertical={true} thickness={1} />,
                <Button
                    key="editorChatOptionsButton"
                    data-tooltip="Show Chat Options"
                    imageOnly={true}
                    requestType="showChatOptions"
                >
                    <Icon src={chatOptionsIcon} id="ChatOptionsButton" data-tooltip="inherit" />
                </Button>,
                <Button
                    key="editorLakehouseNavigatorButton"
                    data-tooltip="Open Lakehouse Navigator"
                    imageOnly={true}
                    requestType="showLakehouseNavigator"
                >
                    <Icon src={lakehouseNavigatorIcon} id="lakehouseNavigatorButton" data-tooltip="inherit" />
                </Button>);
        }

        return (
            <Toolbar
                id="dbEditorToolbar"
                dropShadow={false}
            >
                {toolbarItems.navigation}
                {toolbarItems.navigation.length > 0 && <Divider vertical={true} thickness={1} />}
                {executionItems}
                {executionItems.length > 0 && <Divider vertical={true} thickness={1} />}
                {editorItems}
                <div className="expander" />
                {toolbarItems.auxillary}
            </Toolbar >
        );
    }

    private handleCaretMove = (position: IPosition): Promise<boolean> => {
        this.updateState(position);

        return Promise.resolve(true);
    };

    private toggleHidden = (): void => {
        const showHidden = Settings.get("editor.showHidden", false);
        Settings.set("editor.showHidden", !showHidden);
    };

    private settingsChanged = (entry?: { key: string; value: unknown; }): Promise<boolean> => {
        if (!entry) {
            this.forceUpdate();
        } else {
            switch (entry.key) {
                case "editor.showHidden":
                case "editor.wordWrap": {
                    this.forceUpdate();

                    break;
                }

                default: {
                    return Promise.resolve(false);
                }
            }
        }

        return Promise.resolve(true);
    };

    private contextStateChanged = (id: string): Promise<boolean> => {
        const { currentContext } = this.state;

        // Coalesce multiple state changes into one, as they can come in quickly.
        if (currentContext && id === currentContext.id) {
            if (currentContext.loadingState !== LoadingState.Idle) {
                this.setState({
                    canExecute: false,
                    canStop: true,
                });

                this.startStateChangeTimer();
            }

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

    /**
     * (Re)starts the wait timer for context state changes.
     */
    private startStateChangeTimer = (): void => {
        if (this.stateChangeTimer) {
            clearTimeout(this.stateChangeTimer);
        }

        this.stateChangeTimer = setTimeout(() => {
            const { currentContext } = this.state;

            if (currentContext?.loadingState === LoadingState.Idle) {
                this.setState({
                    canExecute: true,
                    canStop: false,
                });
                this.stateChangeTimer = null;
            } else {
                this.startStateChangeTimer();
            }
        }, 500);

    };

    private toggleStopExecutionOnError = (active: boolean): Promise<boolean> => {
        Settings.set("editor.stopOnErrors", !active);
        this.forceUpdate();

        return Promise.resolve(true);
    };

    private toggleAutoCommit = async (): Promise<boolean> => {
        const { backend } = this.props;
        const { autoCommit } = this.state;

        try {
            await backend?.setAutoCommit(!autoCommit);
            await this.queryAutoCommit();
        } catch (reason) {
            const message = reason instanceof Error ? reason.message : String(reason);
            void requisitions.execute("showError", "Cannot Switch Auto Commit Mode." + message);
        }

        this.updateState();

        return true;
    };

    private transactionEnded = async (): Promise<boolean> => {
        await this.queryAutoCommit();
        this.updateState();

        return true;
    };

    private updateState(position?: IPosition): void {
        const { currentEditor, currentContext } = this.state;

        if (currentEditor?.state?.model?.executionContexts) {
            position ??= currentEditor.state.model.executionContexts.cursorPosition;
            const context = currentEditor.state.model.executionContexts
                .contextFromPosition(position) as ExecutionContext;
            if (context) {
                if (context !== currentContext) {
                    this.setState({
                        currentContext: context,
                        canExecute: context.loadingState === LoadingState.Idle,
                        canStop: context.loadingState !== LoadingState.Idle,
                        canExecuteSubparts: context.isSQLLike,
                        contextLanguage: context.language,
                    });
                }
            }
        }
    }

    /**
     * Queries the backend for the current auto commit mode and sets the internal state according to the result.
     */
    private queryAutoCommit = (): Promise<void> => {
        return new Promise((resolve, reject) => {
            const { backend } = this.props;

            backend?.getAutoCommit().then((value): void => {
                this.setState({ autoCommit: value ?? false }, () => {
                    resolve();
                });
            }).catch((reason) => {
                reject(reason);
            });
        });
    };
}
