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

import shellIcon from "../../assets/images/modules/module-shell.svg";
import sessionIcon from "../../assets/images/file-icons/shell.svg";
import closeButton from "../../assets/images/close2.svg";

import React from "react";

import { ModuleBase, IModuleInfo, IModuleState, IModuleProperties } from "../ModuleBase";

import { SessionBrowser } from "./SessionBrowser";
import {
    ITabviewPage, Tabview, TabPosition, Button, Icon, defaultEditorOptions, Dropdown, Label, Divider, Toolbar,
    Container, Orientation, ProgressIndicator,
} from "../../components/ui";
import { appParameters, requisitions } from "../../supplement/Requisitions";
import { IShellSessionDetails } from "../../supplement/ShellInterface";
import { IShellTabPersistentState, ShellTab } from "./ShellTab";
import { ShellInterfaceShellSession } from "../../supplement/ShellInterface/ShellInterfaceShellSession";
import {
    ICommErrorEvent, ICommShellEvent,
} from "../../communication";
import { settings } from "../../supplement/Settings/Settings";
import { CodeEditorMode } from "../../components/ui/CodeEditor/CodeEditor";
import { Monaco } from "../../components/ui/CodeEditor";
import { ExecutionContexts } from "../../script-execution/ExecutionContexts";
import { DynamicSymbolTable } from "../../script-execution/DynamicSymbolTable";
import { ShellModuleId } from "../ModuleInfo";
import { ApplicationDB, StoreType } from "../../app-logic/ApplicationDB";
import { IShellEditorModel } from ".";
import { EventType, ListenerEntry } from "../../supplement/Dispatch";
import { ShellPromptHandler } from "../common/ShellPromptHandler";

interface IShellTabInfo {
    details: IShellSessionDetails;
    id: string;
    caption: string;
}

export type IShellModuleProperties = IModuleProperties;

interface IShellModuleState extends IModuleState {
    shellTabs: IShellTabInfo[];
    selectedTab?: string;
    showTabs: boolean;

    pendingSession?: number; // The id of a session for which a tab must be opened on component mount/update.
    pendingConnectionProgress: "inactive" | "inProgress";

    progressMessage: string;
}

export class ShellModule extends ModuleBase<IShellModuleProperties, IShellModuleState> {

    public static get info(): IModuleInfo {
        return {
            id: ShellModuleId,
            caption: "Shell",
            icon: shellIcon,
        };
    }

    private static counter = 1;

    // The saved document state when switching tabs.
    private sessionState: Map<string, IShellTabPersistentState> = new Map();

    private pendingProgress: ReturnType<typeof setTimeout>;

    public constructor(props: IShellModuleProperties) {
        super(props);

        this.state = {
            shellTabs: [],
            showTabs: !appParameters.embedded,
            progressMessage: "",
            pendingConnectionProgress: "inactive",
        };

        ListenerEntry.createByClass("webSession", { persistent: true }).then(() => {
            // A new web session was established while the module is active. That means previous shell sessions
            // are invalid now and we have to reopen new sessions.
            const { shellTabs } = this.state;

            shellTabs.forEach((tab) => {
                const state = this.sessionState.get(tab.id)!;
                if (state) {
                    this.restartShellSession(tab.id, tab.details);
                }
            });
        });
    }

    public static getDerivedStateFromProps(props: IShellModuleProperties,
        state: IShellModuleState): Partial<IShellModuleState> {

        const { selectedTab, pendingConnectionProgress } = state;

        let newTab = selectedTab;
        if (!newTab) {
            if (pendingConnectionProgress === "inactive" && !appParameters.embedded) {
                newTab = "sessions";
            } else {
                newTab = "waitPage";
            }
        }

        const newState = {
            selectedTab: newTab,
        };

        return newState;
    }

    public componentDidMount(): void {
        requisitions.register("showPage", this.showPage);
        requisitions.register("newSession", this.newSession);
        requisitions.register("openSession", this.openSession);
        requisitions.register("removeSession", this.removeSession);

        const { pendingSession } = this.state;
        if (pendingSession) {
            this.addTabForSessionId(pendingSession);
        }
    }

    public componentWillUnmount(): void {
        requisitions.unregister("showPage", this.showPage);
        requisitions.unregister("newSession", this.newSession);
        requisitions.unregister("openSession", this.openSession);
        requisitions.unregister("removeSession", this.removeSession);
    }

    public componentDidUpdate(): void {
        const { pendingSession } = this.state;

        if (pendingSession) {
            this.addTabForSessionId(pendingSession);
        }
    }

    public render(): React.ReactNode {
        const { innerRef } = this.props;
        const { selectedTab, shellTabs, showTabs, progressMessage } = this.state;

        const sessions = shellTabs.map((tabInfo) => {
            return tabInfo.details;
        });

        const pages: ITabviewPage[] = [];
        if (selectedTab === "waitPage") {
            const content = <>
                <ProgressIndicator
                    id="loadingProgressIndicator"
                    backgroundOpacity={0.95}
                    linear={false}
                />
                <Label
                    as="h4"
                    id="progressMessageId"
                    caption={progressMessage}
                />
            </>;

            pages.push({
                caption: "In Progress...",
                id: "waitPage",
                content,
            });
        } else {
            pages.push({
                icon: shellIcon,
                caption: "GUI Console",
                id: "sessions",
                content: <SessionBrowser
                    openSessions={sessions}
                />,
            });

            shellTabs.forEach((info: IShellTabInfo) => {
                const state = this.sessionState.get(info.id)!;

                pages.push({
                    icon: sessionIcon,
                    caption: info.caption,
                    id: info.id,
                    content: <ShellTab
                        id={info.id}
                        savedState={state}
                        onQuit={this.handleQuit}
                    />,
                    auxillary: (
                        <Button
                            id={info.id}
                            className="closeButton"
                            round={true}
                            onClick={this.closeTab}>
                            <Icon src={closeButton} />
                        </Button>
                    ),
                });
            });
        }

        // Add a toolbar with a drop down to switch pages in embedded mode.
        let toolbarInset: React.ReactElement | undefined;
        if (appParameters.embedded) {
            const items: Array<React.ReactElement<typeof Dropdown.Item>> = [
                <Dropdown.Item
                    id="sessions"
                    key="sessions"
                    caption="MySQL Shell Consoles"
                    picture={<Icon src={sessionIcon} />}
                />,
            ];

            shellTabs.forEach((info: IShellTabInfo) => {
                items.push(<Dropdown.Item
                    id={info.id}
                    key={info.id}
                    caption={info.caption}
                    picture={<Icon src={sessionIcon} />}
                />);
            });

            toolbarInset = <>
                <Label style={{ paddingRight: "8px" }}>GUI Console:</Label>
                <Dropdown
                    id="sessionSelector"
                    initialSelection={selectedTab}
                    onSelect={this.handleSelectTab}
                >
                    {items}
                </Dropdown>
                <Divider vertical={true} thickness={1} />
            </>;

        }

        return (
            <Container
                id="shellModuleHost"
                className="msg moduleHost"
                innerRef={innerRef}
                orientation={Orientation.TopDown}
            >
                {
                    toolbarInset && <Toolbar
                        id="embeddedSessionToolbar"
                        dropShadow={false}
                    >
                        {toolbarInset}
                    </Toolbar>
                }
                <Tabview
                    id="shellModuleTabview"
                    tabPosition={TabPosition.Top}
                    selectedId={selectedTab}
                    stretchTabs={false}
                    showTabs={showTabs && selectedTab !== "waitPage"}
                    canReorderTabs
                    pages={pages}
                    onSelectTab={this.handleSelectTab}
                />
            </Container>
        );
    }

    private showPage = (data: { module: string; page: string }): Promise<boolean> => {
        return new Promise((resolve) => {
            if (data.module === ShellModuleId) {
                if (data.page === "sessions") {
                    this.setState({ selectedTab: data.page }, () => {
                        resolve(true);

                        return;
                    });

                }
            }

            resolve(false);
        });

    };

    private newSession = (details: IShellSessionDetails): Promise<boolean> => {
        this.addTabForNewSession(details);

        return Promise.resolve(true);
    };

    private openSession = (details: IShellSessionDetails): Promise<boolean> => {
        this.addShellTab(details);

        return Promise.resolve(true);
    };

    private removeSession = (details: IShellSessionDetails): Promise<boolean> => {
        const { shellTabs } = this.state;

        const tab = shellTabs.find((info: IShellTabInfo) => {
            return info.details.sessionId === details.sessionId;
        });

        if (tab) {
            this.doCloseTab(tab.id);
        }

        return Promise.resolve(true);
    };

    private addTabForSessionId(sessionId: number): void {
        const { shellTabs, pendingConnectionProgress } = this.state;

        if (pendingConnectionProgress !== "inProgress") {
            if (sessionId === -1) {
                // We need a new session.
                //const session = (moduleParams?.data as IDictionary).session as IShellSessionDetails;
                //this.addTabForNewSession(session);
            } else {
                // A real session id was given. Activate the respective tab (add it, if it doesn't exist yet).
                const session = shellTabs.find((candidate) => { return candidate.details.sessionId === sessionId; });
                if (session) {
                    this.addShellTab(session.details);
                }
            }
        }
    }

    private addTabForNewSession(session?: IShellSessionDetails): void {
        const details = session ?? {
            sessionId: -1,
        };

        details.sessionId = ShellModule.counter++;
        if (!details.caption) {
            details.caption = `Session ${details.sessionId}`;
        }

        this.addShellTab(details);
    }

    /**
     * Adds a new shell tab or activates an existing one.
     *
     * @param session The connection for which to open/activate the tab.
     */
    private addShellTab = (session: IShellSessionDetails): void => {
        const { shellTabs } = this.state;

        const id = `session_${session.sessionId}`;
        const existing = shellTabs.find((info) => {
            return info.details.sessionId === session.sessionId;
        });

        if (existing) {
            this.setState({
                selectedTab: existing.id,
                pendingConnectionProgress: "inactive",
            });
        } else {
            this.setState({ pendingConnectionProgress: "inProgress" });

            // Create a caption suffix if the new tab connections to the same DB connection as an existing tab.
            let counter = 1;
            if (session.dbConnectionId) {
                shellTabs.forEach((tab) => {
                    if (tab.details.dbConnectionId === session.dbConnectionId) {
                        ++counter;
                    }
                });
            }

            let caption: string;
            if (counter > 1) {
                caption = `${session.caption as string} (${counter})`;

                // Modify the original caption to include the counter too (need to show this in tiles).
                session.caption = caption;
            } else {
                caption = session.caption ?? "<untitled>";
            }

            // If there's no previous editor state for this connection, create a default editor.
            const sessionState = this.sessionState.get(id);
            if (!sessionState) {
                // Create a new shell session.
                this.showProgress();
                const backend = new ShellInterfaceShellSession();

                this.setProgressMessage("Starting shell session...");
                backend.startShellSession(id, session.dbConnectionId).then((event: ICommShellEvent) => {
                    if (!event.data) {
                        return;
                    }

                    switch (event.eventType) {
                        case EventType.StartResponse: {
                            this.setProgressMessage("Session created, opening new connection...");
                            break;
                        }

                        case EventType.DataResponse: {
                            const data = event.data;
                            if (!ShellPromptHandler.handleShellPrompt(data.result!, data.requestId!, backend)) {
                                this.setProgressMessage(event.message ?? "Loading ...");
                            }

                            break;
                        }

                        case EventType.FinalResponse: {
                            // Once the connection is open we can create the editor.
                            const currentSchema = "";
                            /*if (event.data.currentSchema) {
                                currentSchema = event.data.currentSchema;
                            } else if (connection.dbType === DBType.MySQL) {
                                currentSchema = (connection.options as IMySQLConnectionOptions).schema ?? "";
                            }*/

                            // TODO: we need server information for code completion.
                            const serverVersion = settings.get("editor.dbVersion", 80024);
                            const serverEdition = "";
                            const sqlMode = settings.get("editor.sqlMode", "");

                            const model = this.createEditorModel(backend, "", "msg", serverVersion, sqlMode,
                                currentSchema);

                            const sessionState: IShellTabPersistentState = {
                                state: {
                                    model,
                                    viewState: null,
                                    options: defaultEditorOptions,
                                },
                                backend,
                                serverVersion,
                                serverEdition,
                                sqlMode,
                            };

                            this.sessionState.set(id, sessionState);
                            shellTabs.push({ details: session, id, caption });
                            this.setState({
                                shellTabs,
                                pendingConnectionProgress: "inactive",
                            });

                            requisitions.executeRemote("sessionAdded", session);
                            this.hideProgress(id);

                            break;
                        }

                        default: {
                            break;
                        }
                    }
                }).catch((errorEvent: ICommErrorEvent) => {
                    void requisitions.execute("showError", ["Shell Session Error", String(errorEvent.message)]);

                    this.hideProgress("sessions");
                });
            } else {
                shellTabs.push({
                    details: session,
                    id,
                    caption: session.caption ?? "Shell",
                });

                this.setState({
                    shellTabs,
                    selectedTab: id,
                    pendingConnectionProgress: "inactive",
                });
            }
        }
    };

    /**
     * Starts a new BE shell session for an existing FE shell session, which lost connection previously.
     *
     * @param id The ID of the tab the must be re-activated.
     * @param session The session to re-open
     */
    private restartShellSession = (id: string, session: IShellSessionDetails): void => {
        const state = this.sessionState.get(id)!;
        const backend = state.backend;

        this.showProgress();

        this.setProgressMessage("Starting shell session...");
        backend.startShellSession(id, session.dbConnectionId).then((event: ICommShellEvent) => {
            if (!event.data || !event.data.result) {
                return;
            }

            switch (event.eventType) {
                case EventType.StartResponse: {
                    this.setProgressMessage("Session created, opening new connection...");
                    break;
                }

                case EventType.DataResponse: {
                    if (!ShellPromptHandler.handleShellPrompt(event.data.result, event.data.requestId!, backend)) {
                        this.setProgressMessage(event.message ?? "Loading ...");
                    }

                    break;
                }

                case EventType.FinalResponse: {
                    this.hideProgress(id);

                    break;
                }

                default: {
                    break;
                }
            }
        }).catch((errorEvent: ICommErrorEvent) => {
            void requisitions.execute("showError", ["Shell Session Error", String(errorEvent.message)]);

            this.hideProgress("sessions");
        });
    };

    private handleQuit = (id: string): void => {
        this.doCloseTab(id);
    };

    private closeTab = (e: React.SyntheticEvent): void => {
        e.stopPropagation();

        const id = (e.currentTarget as HTMLElement).id;
        this.doCloseTab(id);
    };

    private doCloseTab = (id: string): void => {
        const { selectedTab, shellTabs } = this.state;

        // Remove all result data from the application DB.
        void ApplicationDB.removeDataByTabId(StoreType.Shell, id);

        const index = shellTabs.findIndex((info: IShellTabInfo) => {
            return info.id === id;
        });

        if (index > -1) {
            const sessionState = this.sessionState.get(id);
            if (sessionState) {
                this.sessionState.delete(id);
                sessionState.backend.closeShellSession();
            }

            const tabs = shellTabs.splice(index, 1);

            requisitions.executeRemote("sessionRemoved", tabs[0].details);

            let newSelection = selectedTab;

            if (id === newSelection) {
                if (index > 0) {
                    newSelection = shellTabs[index - 1].id;
                } else {
                    if (index >= shellTabs.length - 1) {
                        newSelection = "sessions"; // The overview page cannot be closed.
                    } else {
                        newSelection = shellTabs[index + 1].id;
                    }
                }
            }

            this.setState({ selectedTab: newSelection, shellTabs });
        }
    };

    private handleSelectTab = (id: string): void => {
        this.setState({ selectedTab: id });
    };

    /**
     * Creates the standard model used by DB code editors. Each editor has an own model, which carries additional
     * information required by the editors.
     *
     * @param session The interface to interact with the shell (e.g. for code completion).
     * @param text The initial content of the model.
     * @param language The code language used in the model.
     * @param serverVersion The version of the connected server (relevant only for SQL languages).
     * @param sqlMode The current SQL mode of the server (relevant only for MySQL).
     * @param currentSchema The current default schema.
     *
     * @returns The new model.
     */
    private createEditorModel(session: ShellInterfaceShellSession, text: string, language: string,
        serverVersion: number, sqlMode: string, currentSchema: string): IShellEditorModel {
        const model = Monaco.createModel(text, language) as IShellEditorModel;
        model.executionContexts = new ExecutionContexts(StoreType.Shell, serverVersion, sqlMode, currentSchema);

        model.editorMode = CodeEditorMode.Terminal;
        model.session = session;

        // Create a default symbol table with no DB connection. This will be replaced in ShellTab, depending
        // on the connection the user opens.
        model.symbols = new DynamicSymbolTable(undefined, "db symbols", { allowDuplicateSymbols: true });

        return model;
    }

    private setProgressMessage = (message: string): void => {
        this.setState({ progressMessage: message });
    };

    private showProgress = (): void => {
        this.pendingProgress = setTimeout(() => {
            this.setState({ selectedTab: "waitPage" });
        }, 250);
    };

    private hideProgress = (newTab: string): void => {
        clearTimeout(this.pendingProgress);

        this.setState({ selectedTab: newTab, progressMessage: "" });
    };
}
