/*
 * Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

import autoCommitActiveIcon from "../../assets/images/toolbar/toolbar-auto_commit-active.svg";
import autoCommitInactiveIcon from "../../assets/images/toolbar/toolbar-auto_commit-inactive.svg";
import commitIcon from "../../assets/images/toolbar/toolbar-commit.svg";
import executeCaretIcon from "../../assets/images/toolbar/toolbar-execute_caret.svg";
import executePrintTextIcon from "../../assets/images/toolbar/toolbar-execute_print_text.svg";
//import executeExplainIcon from "../../assets/images/toolbar/execute-explain.svg";
import executeHeatWaveIcon from "../../assets/images/toolbar/toolbar-execute_heatwave.svg";
import executeHeatWaveCaretIcon from "../../assets/images/toolbar/toolbar-execute_caret_heatwave.svg";
import executeIcon from "../../assets/images/toolbar/toolbar-execute.svg";
import formatIcon from "../../assets/images/toolbar/toolbar-format.svg";
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

import { Settings } from "../../supplement/Settings/Settings";
import { IOpenEditorState } from "./DBConnectionTab";
import { requisitions } from "../../supplement/Requisitions";
import { LoadingState } from "../../script-execution";
import { IToolbarItems } from ".";
import { IComponentProperties, IComponentState, ComponentBase } from "../../components/ui/Component/ComponentBase";
import { Divider } from "../../components/ui/Divider/Divider";
import { Icon } from "../../components/ui/Icon/Icon";
import { Toolbar } from "../../components/ui/Toolbar/Toolbar";
import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor";
import { Button } from "../../components/ui/Button/Button";
import { ExecutionContext } from "../../script-execution/ExecutionContext";

interface IDBEditorToolbarProperties extends IComponentProperties {
    /**
     * Items defined by the owner(s) of this toolbar.
     * They are combined with those created here to form the actual toolbar.
     */
    toolbarItems: IToolbarItems;

    activeEditor: string;
    heatWaveEnabled: boolean;
    editors: IOpenEditorState[];

    /** The main language of the editor. */
    language: string;

    backend?: ShellInterfaceSqlEditor;
}

interface IDBEditorToolbarState extends IComponentState {
    editorId: string;
    currentEditor?: IOpenEditorState;

    currentContext?: ExecutionContext;

    canExecute: boolean;
    canStop: boolean;
    canExecuteSubparts: boolean;
    autoCommit: boolean;
}

export class DBEditorToolbar extends ComponentBase<IDBEditorToolbarProperties, IDBEditorToolbarState> {

    private stateChangeTimer: ReturnType<typeof setTimeout> | null;

    public constructor(props: IDBEditorToolbarProperties) {
        super(props);

        const currentEditor = props.editors.find((state) => {
            return state.id === props.activeEditor;
        });

        this.state = {
            editorId: props.activeEditor,
            currentEditor,
            canExecute: true,
            canStop: false,
            canExecuteSubparts: false,
            autoCommit: true,
        };

        this.addHandledProperties("toolbarItems", "activeEditor", "heatWaveEnabled", "editors", "language", "backend");
    }

    public componentDidUpdate(oldProps: IDBEditorToolbarProperties): void {
        const { activeEditor, editors } = this.props;
        if (activeEditor !== oldProps.activeEditor) {
            const currentEditor = editors.find((state) => {
                return state.id === activeEditor;
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

    public componentDidMount(): void {
        requisitions.register("editorInfoUpdated", this.editorInfoUpdated);
        requisitions.register("editorContextStateChanged", this.contextStateChanged);
        requisitions.register("editorToggleStopExecutionOnError", this.toggleStopExecutionOnError);
        requisitions.register("editorToggleAutoCommit", this.toggleAutoCommit);
        requisitions.register("sqlTransactionEnded", this.transactionEnded);
        requisitions.register("settingsChanged", this.settingsChanged);
    }

    public componentWillUnmount(): void {
        if (this.stateChangeTimer) {
            clearTimeout(this.stateChangeTimer);
            this.stateChangeTimer = null;
        }

        requisitions.unregister("editorInfoUpdated", this.editorInfoUpdated);
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
                                { startNewBlock: true, forceSecondaryEngine: false, asText: false });
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
                                { startNewBlock: false, forceSecondaryEngine: false, asText: false });
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
                            void requisitions.execute("editorExecuteCurrent",
                                { startNewBlock: false, forceSecondaryEngine: false, asText: false });
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
                            void requisitions.execute("editorExecuteCurrent",
                                { startNewBlock: true, forceSecondaryEngine: false, asText: true });
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
                                    { startNewBlock: true, forceSecondaryEngine: true, asText: false });
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
                                void requisitions.execute("editorExecuteCurrent",
                                    { startNewBlock: false, forceSecondaryEngine: true, asText: false });
                            }
                        }
                    >
                        <Icon src={executeHeatWaveCaretIcon} data-tooltip="inherit" />
                    </Button>,
                );
            }

            executionItems.push(
                /*<Button
                    key="editorExplainButton"
                    data-tooltip="Execute Explain for the statement at the caret position"
                    requestType="editorExecuteExplain"
                    imageOnly={true}
                    disabled
                >
                    <Icon src={executeExplainIcon} data-tooltip="inherit" />
                </Button>,*/
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
            <Button
                key="editorFormatButton"
                data-tooltip="Format current block or script"
                requestType="editorFormat"
                imageOnly={true}
            >
                <Icon src={formatIcon} data-tooltip="inherit" />
            </Button>,
            <Divider key="formatDivider" vertical={true} thickness={1} />,
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

    private editorInfoUpdated = (): Promise<boolean> => {
        setTimeout(() => {
            this.updateState();
        }, 0);

        // Allow other subscribers to get this event too, by returning false.
        return Promise.resolve(false);
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
            void requisitions.execute("showError",
                ["Execution Error", "Cannot Switch Auto Commit Mode.", String(reason)]);
        }

        this.updateState();

        return true;
    };

    private transactionEnded = async (): Promise<boolean> => {
        await this.queryAutoCommit();
        this.updateState();

        return true;
    };

    private updateState(): void {
        const { currentEditor, currentContext } = this.state;

        if (currentEditor?.state) {
            const context = currentEditor.state.model.executionContexts
                .contextFromPosition(currentEditor.state.model.executionContexts.cursorPosition) as ExecutionContext;
            if (context) {
                if (context !== currentContext) {
                    this.setState({
                        currentContext: context,
                        canExecute: context.loadingState === LoadingState.Idle,
                        canStop: context.loadingState !== LoadingState.Idle,
                        canExecuteSubparts: context.isSQLLike,
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
