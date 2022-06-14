/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

import autoCommitActiveIcon from "../../assets/images/toolbar/auto-commit-active.svg";
import autoCommitInactiveIcon from "../../assets/images/toolbar/auto-commit-inactive.svg";
import commitIcon from "../../assets/images/toolbar/commit.svg";
import executeCaretIcon from "../../assets/images/toolbar/execute-caret.svg";
import executeExplainIcon from "../../assets/images/toolbar/execute-explain.svg";
import executeNewCommandIcon from "../../assets/images/toolbar/execute-new-cmd.svg";
import executeIcon from "../../assets/images/toolbar/execute.svg";
import formatIcon from "../../assets/images/toolbar/format.svg";
import rollbackIcon from "../../assets/images/toolbar/rollback.svg";
import searchIcon from "../../assets/images/toolbar/search.svg";
import showHiddenActiveIcon from "../../assets/images/toolbar/show-hidden-active.svg";
import showHiddenInactiveIcon from "../../assets/images/toolbar/show-hidden-inactive.svg";
import stopExecutionIcon from "../../assets/images/toolbar/stop-execution.svg";
import stopOnErrorActiveIcon from "../../assets/images/toolbar/stop-on-error-active.svg";
import stopOnErrorInactiveIcon from "../../assets/images/toolbar/stop-on-error-inactive.svg";
import wordWrapActiveIcon from "../../assets/images/toolbar/word-wrap-active.svg";
import wordWrapInactiveIcon from "../../assets/images/toolbar/word-wrap-inactive.svg";

import React from "react";

import {
    Button, Component, Divider, IComponentProperties, IComponentState, Icon, Toolbar,
} from "../../components/ui";
import { settings } from "../../supplement/Settings/Settings";
import { IOpenEditorState } from "./DBConnectionTab";
import { requisitions } from "../../supplement/Requisitions";
import { ExecutionContext, LoadingState } from "../../script-execution";
import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface";
import { IToolbarItems } from ".";

export interface IDBEditorToolbarProperties extends IComponentProperties {
    // Items defined by the owner(s) of this toolbar.
    // They are combined with those created here to form the actual toolbar.
    toolbarItems?: IToolbarItems;

    activeEditor: string;
    editors: IOpenEditorState[];
    language: string;            // The main language of the editor.

    backend?: ShellInterfaceSqlEditor;

    onSelectEditor?: (editorId: string) => void;
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

export class DBEditorToolbar extends Component<IDBEditorToolbarProperties, IDBEditorToolbarState> {

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
    }

    public static getDerivedStateFromProps(props: IDBEditorToolbarProperties): Partial<IDBEditorToolbarState> {
        const currentEditor = props.editors.find((state) => {
            return state.id === props.activeEditor;
        });

        if (currentEditor?.state) {
            const context = currentEditor.state.model.executionContexts
                .contextFromPosition(currentEditor.state.model.executionContexts.cursorPosition);
            if (context) {
                return {
                    currentEditor,
                    currentContext: context,
                    canExecute: context.loadingState === LoadingState.Idle,
                    canStop: context.loadingState !== LoadingState.Idle,
                    canExecuteSubparts: context.isSQLLike,
                };
            }
        }

        return {
            currentEditor,
        };
    }

    public componentDidMount(): void {
        requisitions.register("editorInfoUpdated", this.editorInfoUpdated);
        requisitions.register("editorStopExecution", this.stopExecution);
        requisitions.register("editorToggleStopExecutionOnError", this.toggleStopExecutionOnError);
        requisitions.register("editorToggleAutoCommit", this.toggleAutoCommit);
        requisitions.register("editorToggleSoftWrap", this.toggleSoftWrap);
        requisitions.register("sqlTransactionEnded", this.transactionEnded);
        requisitions.register("settingsChanged", this.settingsChanged);
    }

    public componentWillUnmount(): void {
        requisitions.unregister("editorInfoUpdated", this.editorInfoUpdated);
        requisitions.unregister("editorStopExecution", this.stopExecution);
        requisitions.unregister("editorToggleStopExecutionOnError", this.toggleStopExecutionOnError);
        requisitions.unregister("editorToggleAutoCommit", this.toggleAutoCommit);
        requisitions.unregister("editorToggleSoftWrap", this.toggleSoftWrap);
        requisitions.unregister("sqlTransactionEnded", this.transactionEnded);
        requisitions.unregister("settingsChanged", this.settingsChanged);
    }

    public render(): React.ReactNode {
        const { toolbarItems, language } = this.props;
        const { autoCommit, canExecute, canStop, canExecuteSubparts } = this.state;

        const area = language === "msg" ? "block" : "script";
        const selectionText = canExecuteSubparts ? "selection or " : "";

        const stopOnErrors = settings.get("editor.stopOnErrors", true);
        const stopOnErrorIcon = stopOnErrors ? stopOnErrorActiveIcon : stopOnErrorInactiveIcon;

        const autoCommitIcon = autoCommit ? autoCommitActiveIcon : autoCommitInactiveIcon;

        const showHidden = settings.get("editor.showHidden", false);
        const showHiddenIcon = showHidden ? showHiddenActiveIcon : showHiddenInactiveIcon;

        const wordWrap = settings.get("editor.wordWrap", "off");
        const wordWrapIcon = wordWrap === "on" ? wordWrapActiveIcon : wordWrapInactiveIcon;

        const leftItems = [...toolbarItems?.left ?? []];
        leftItems.push(
            <Button
                key="executeFullButton"
                data-tooltip={`Execute ${selectionText}full ${area}`}
                imageOnly={true}
                disabled={!canExecute}
                onClick={
                    () => { void requisitions.execute("editorExecuteSelectedOrAll", false); }
                }
            >
                <Icon src={executeIcon} data-tooltip="inherit" />
            </Button>);

        if (language === "msg") {
            leftItems.push(
                <Button
                    data-tooltip={`Execute ${selectionText}full block and create a new block`}
                    imageOnly={true}
                    disabled={!canExecute}
                    onClick={
                        () => { void requisitions.execute("editorExecuteSelectedOrAll", true); }
                    }
                >
                    <Icon src={executeNewCommandIcon} data-tooltip="inherit" />
                </Button>);
        }

        if (canExecuteSubparts) {
            leftItems.push(
                <Button
                    data-tooltip="Execute the statement at the caret position"
                    imageOnly={true}
                    disabled={!canExecute}
                    onClick={
                        () => { void requisitions.execute("editorExecuteCurrent", false); }
                    }
                >
                    <Icon src={executeCaretIcon} data-tooltip="inherit" />
                </Button>,
                <Button
                    data-tooltip="Execute Explain for the statement at the caret position"
                    requestType="editorExecuteExplain"
                    imageOnly={true}
                    disabled
                >
                    <Icon src={executeExplainIcon} data-tooltip="inherit" />
                </Button>,
                <Button
                    data-tooltip="Stop execution of the current statement/script"
                    requestType="editorStopExecution"
                    imageOnly={true}
                    disabled={!canStop}
                >
                    <Icon src={stopExecutionIcon} data-tooltip="inherit" />
                </Button>,
                <Button
                    data-tooltip="Stop execution of the current statement/script in case of errors"
                    imageOnly={true}
                    onClick={
                        () => { void requisitions.execute("editorToggleStopExecutionOnError", stopOnErrors); }
                    }
                >
                    <Icon src={stopOnErrorIcon} data-tooltip="inherit" />
                </Button>);
        }

        leftItems.push(<Divider vertical={true} thickness={1} />);

        if (canExecuteSubparts) {
            leftItems.push(
                <Button
                    data-tooltip="Commit DB changes"
                    requestType="editorCommit"
                    imageOnly={true}
                    disabled={autoCommit}
                >
                    <Icon src={commitIcon} data-tooltip="inherit" />
                </Button>,
                <Button
                    data-tooltip="Rollback DB changes"
                    requestType="editorRollback"
                    imageOnly={true}
                    disabled={autoCommit}
                >
                    <Icon src={rollbackIcon} data-tooltip="inherit" />
                </Button>,
                <Button
                    data-tooltip="Auto commit DB changes"
                    imageOnly={true}
                    onClick={
                        () => { void requisitions.execute("editorToggleAutoCommit", autoCommit); }
                    }
                >
                    <Icon src={autoCommitIcon} data-tooltip="inherit" />
                </Button>,
                <Divider vertical={true} thickness={1} />);
        }

        leftItems.push(
            <Button
                data-tooltip="Format current block or script"
                requestType="editorFormat"
                imageOnly={true}
            >
                <Icon src={formatIcon} data-tooltip="inherit" />
            </Button>,
            <Divider vertical={true} thickness={1} />,
            <Button
                data-tooltip="Find"
                requestType="editorFind"
                imageOnly={true}
            >
                <Icon src={searchIcon} data-tooltip="inherit" />
            </Button>,
            <Button
                data-tooltip="Show hidden characters"
                imageOnly={true}
                onClick={this.toggleHidden}
            >
                <Icon src={showHiddenIcon} data-tooltip="inherit" />
            </Button>,
            <Button
                data-tooltip="Soft wrap lines "
                imageOnly={true}
                onClick={
                    () => { void requisitions.execute("editorToggleSoftWrap", wordWrap === "on"); }
                }
            >
                <Icon src={wordWrapIcon} data-tooltip="inherit" />
            </Button>,
        );

        const rightItems = [...toolbarItems?.right ?? []];

        return (
            <Toolbar
                id="dbEditorToolbar"
                dropShadow={false}
            >
                {leftItems}
                <div className="expander" />
                {rightItems}


            </Toolbar >
        );
    }

    private editorInfoUpdated = (): Promise<boolean> => {
        this.updateState();

        // Allow other subscribers to get this event too.
        return Promise.resolve(false);
    };

    private toggleHidden = (): void => {
        const showHidden = settings.get("editor.showHidden", false);
        settings.set("editor.showHidden", !showHidden);
    };

    private settingsChanged = (entry?: { key: string; value: unknown }): Promise<boolean> => {
        if (entry?.key === "editor.showHidden") {
            this.forceUpdate();

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

    private stopExecution = (): Promise<boolean> => {
        // TODO: implement

        this.updateState();

        return Promise.resolve(true);
    };

    private toggleStopExecutionOnError = (active: boolean): Promise<boolean> => {
        settings.set("editor.stopOnErrors", !active);
        this.updateState();

        return Promise.resolve(true);
    };

    private toggleAutoCommit = async (active: boolean): Promise<boolean> => {
        const { backend } = this.props;

        try {
            await backend?.setAutoCommit(!active);
            await this.queryAutoCommit();
        } catch (reason) {
            void requisitions.execute("showError",
                ["Execution Error", "Cannot Switch Auto Commit Mode.", String(reason)]);
        }

        this.updateState();

        return Promise.resolve(true);
    };

    private toggleSoftWrap = (active: boolean): Promise<boolean> => {
        settings.set("editor.wordWrap", active ? "off" : "on");
        this.forceUpdate();

        return Promise.resolve(true);
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
                .contextFromPosition(currentEditor.state.model.executionContexts.cursorPosition);
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

            backend?.getAutoCommit().then((value: boolean): void => {
                this.setState({ autoCommit: value }, () => {
                    resolve();
                });
            }).catch((reason) => {
                reject(reason);
            });
        });
    };
}
