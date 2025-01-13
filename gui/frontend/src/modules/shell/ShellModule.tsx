/*
 * Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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

import closeButton from "../../assets/images/close2.svg";
import shellIcon from "../../assets/images/modules/module-shell.svg";
import sessionIcon from "../../assets/images/terminal.svg";

import { ComponentChild, RefObject } from "preact";

import { IModuleInfo, IModuleProperties, IModuleState, ModuleBase } from "../ModuleBase.js";

import { ApplicationDB, StoreType } from "../../app-logic/ApplicationDB.js";
import type { ISqlUpdateResult } from "../../app-logic/general-types.js";
import { Button } from "../../components/ui/Button/Button.js";
import { CodeEditorMode, Monaco } from "../../components/ui/CodeEditor/index.js";
import { Container, Orientation } from "../../components/ui/Container/Container.js";
import { Divider } from "../../components/ui/Divider/Divider.js";
import { Dropdown } from "../../components/ui/Dropdown/Dropdown.js";
import { DropdownItem } from "../../components/ui/Dropdown/DropdownItem.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import { Label } from "../../components/ui/Label/Label.js";
import { ProgressIndicator } from "../../components/ui/ProgressIndicator/ProgressIndicator.js";
import { ITabviewPage, TabPosition, Tabview } from "../../components/ui/Tabview/Tabview.js";
import { Toolbar } from "../../components/ui/Toolbar/Toolbar.js";
import { defaultEditorOptions } from "../../components/ui/index.js";
import { parseVersion } from "../../parsing/mysql/mysql-helpers.js";
import { DynamicSymbolTable } from "../../script-execution/DynamicSymbolTable.js";
import { ExecutionContexts } from "../../script-execution/ExecutionContexts.js";
import { appParameters, requisitions } from "../../supplement/Requisitions.js";
import { Settings } from "../../supplement/Settings/Settings.js";
import { ShellInterfaceShellSession } from "../../supplement/ShellInterface/ShellInterfaceShellSession.js";
import { IShellSessionDetails } from "../../supplement/ShellInterface/index.js";
import { uuid } from "../../utilities/helpers.js";
import { ShellModuleId } from "../ModuleInfo.js";
import { ShellPromptHandler } from "../common/ShellPromptHandler.js";
import { IShellTabPersistentState, ShellTab } from "./ShellTab.js";
import { IShellEditorModel } from "./index.js";
import type { IOdmShellSessionEntry } from "../../data-models/OpenDocumentDataModel.js";
import { ui } from "../../app-logic/UILayer.js";

interface IShellTabInfo {
    details: IShellSessionDetails;
    id: string;
    caption: string;
}

type IShellModuleProperties = IModuleProperties;

interface IShellModuleState extends IModuleState {
    shellTabs: IShellTabInfo[];
    selectedTab?: string;
    showTabs: boolean;

    /** The id of a session for which a tab must be opened on component mount/update. */
    pendingSession?: string;
    pendingConnectionProgress: "inactive" | "inProgress";

    progressMessage: string;
}

export class ShellModule extends ModuleBase<IShellModuleProperties, IShellModuleState> {

    public static override get info(): IModuleInfo {
        return {
            id: ShellModuleId,
            caption: "Shell",
            icon: shellIcon,
        };
    }

    private static counter = 1;

    // The saved document state when switching tabs.
    private sessionState: Map<string, IShellTabPersistentState> = new Map();

    private pendingProgress: ReturnType<typeof setTimeout> | null = null;

    public constructor(props: IShellModuleProperties) {
        super(props);

        this.state = {
            shellTabs: [],
            showTabs: !appParameters.embedded,
            progressMessage: "",
            pendingConnectionProgress: "inactive",
        };
    }

    public static override getDerivedStateFromProps(props: IShellModuleProperties,
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

    public override componentDidMount(): void {
        requisitions.register("showPage", this.showPage);
        requisitions.register("newSession", this.newSession);
        requisitions.register("openSession", this.openSession);
        requisitions.register("removeSession", this.removeSession);
        requisitions.register("webSessionStarted", this.webSessionStarted);

        const { pendingSession } = this.state;
        if (pendingSession) {
            this.addTabForSessionId(pendingSession);
        }
    }

    public override componentWillUnmount(): void {
        requisitions.unregister("showPage", this.showPage);
        requisitions.unregister("newSession", this.newSession);
        requisitions.unregister("openSession", this.openSession);
        requisitions.unregister("removeSession", this.removeSession);
        requisitions.unregister("webSessionStarted", this.webSessionStarted);
    }

    public override componentDidUpdate(): void {
        const { pendingSession } = this.state;

        if (pendingSession) {
            this.addTabForSessionId(pendingSession);
        }
    }

    public override render(): ComponentChild {
        const { innerRef } = this.props;
        const { selectedTab, shellTabs, showTabs, progressMessage } = this.state;

        const pages: ITabviewPage[] = [];
        if (selectedTab === "waitPage") {
            const content = <>
                <ProgressIndicator
                    id="loadingProgressIndicator"
                    backgroundOpacity={0.95}
                    linear={false}
                />
                <Label
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
                content: <div />,
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
                        toolbarItemsTemplate={{
                            navigation: [],
                            execution: [],
                            editor: [],
                            auxiliary: [],
                        }}
                        onQuit={this.handleQuit}
                    />,
                    auxiliary: (
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
        let toolbarInset: ComponentChild | undefined;
        if (appParameters.embedded && selectedTab !== "waitPage") {
            const items = [
                <DropdownItem
                    id="sessions"
                    key="sessions"
                    caption="MySQL Shell Consoles"
                    picture={<Icon src={sessionIcon} />}
                />,
            ];

            shellTabs.forEach((info: IShellTabInfo) => {
                items.push(<DropdownItem
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
                    selection={selectedTab}
                    onSelect={this.handleSelectTabFromDropdown}
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
                innerRef={innerRef as RefObject<HTMLDivElement>}
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

    private showPage = (data: { module: string; page: string; }): Promise<boolean> => {
        return new Promise((resolve) => {
            if (data.module === ShellModuleId) {
                if (data.page === "sessions") {
                    this.setState({ selectedTab: data.page }, () => {
                        resolve(true);
                    });
                }

                return;
            }

            resolve(false);
        });

    };

    private newSession = async (details: IShellSessionDetails): Promise<boolean> => {
        await this.addTabForNewSession(details);

        return true;
    };

    private openSession = async (details: IShellSessionDetails): Promise<boolean> => {
        await this.addShellTab(details);

        return true;
    };

    private removeSession = async (details: IShellSessionDetails): Promise<boolean> => {
        const { shellTabs } = this.state;

        const tab = shellTabs.find((info: IShellTabInfo) => {
            return info.details.sessionId === details.sessionId;
        });

        if (tab) {
            await this.doCloseTab(tab.id);
        }

        return true;
    };

    /**
     * Called when a new web session was established. That means previous shell sessions
     * are invalid now and we have to open new sessions.
     *
     * @returns A promise which resolves after all current shell session have been restarted.
     */
    private webSessionStarted = async (): Promise<boolean> => {
        const { shellTabs } = this.state;

        for (const tab of shellTabs) {
            const state = this.sessionState.get(tab.id)!;
            if (state) {
                await this.restartShellSession(tab.id, tab.details);
            }
        }

        return true;
    };

    private addTabForSessionId(sessionId: string): void {
        const { shellTabs, pendingConnectionProgress } = this.state;

        if (pendingConnectionProgress !== "inProgress") {
            if (sessionId === "") {
                // We need a new session.
                //const session = (moduleParams?.data as IDictionary).session as IShellSessionDetails;
                //this.addTabForNewSession(session);
            } else {
                // A real session id was given. Activate the respective tab (add it, if it doesn't exist yet).
                const session = shellTabs.find((candidate) => {
                    return candidate.details.sessionId === sessionId;
                });
                if (session) {
                    void this.addShellTab(session.details);
                }
            }
        }
    }

    private async addTabForNewSession(session?: IShellSessionDetails): Promise<void> {
        const details = session ?? {
            sessionId: uuid(),
        };

        //details.sessionId = ShellModule.counter++;

        return this.addShellTab(details);
    }

    /**
     * Adds a new shell tab or activates an existing one.
     *
     * @param session The connection for which to open/activate the tab.
     */
    private addShellTab = async (session: IShellSessionDetails): Promise<void> => {
        const { shellTabs } = this.state;

        const id = `session_${session.sessionId}`;
        const existing = shellTabs.find((info) => {
            return info.details.sessionId === session.sessionId;
        });

        if (existing) {
            this.setState({ selectedTab: existing.id, pendingConnectionProgress: "inactive" });
        } else {
            this.setState({ pendingConnectionProgress: "inProgress" });

            // Create a caption suffix if the new tab connections to the same DB connection has an existing tab.
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
                caption = session.caption ?? "Untitled";
            }

            // If there's no previous editor state for this connection, create a default editor.
            const sessionState = this.sessionState.get(id);
            if (!sessionState) {
                // Create a new shell session.
                this.showProgress();
                const backend = new ShellInterfaceShellSession();

                this.setProgressMessage("Starting shell session...");
                const requestId = uuid();
                try {
                    await backend.startShellSession(id, session.dbConnectionId, undefined, requestId,
                        (response) => {
                            if (!ShellPromptHandler.handleShellPrompt(response.result, requestId, backend)) {
                                this.setProgressMessage("Loading ...");
                            }
                        });

                    // Once the connection is open we can create the editor.
                    const currentSchema = "";
                    /*if (event.data.currentSchema) {
                        currentSchema = event.data.currentSchema;
                    } else if (connection.dbType === DBType.MySQL) {
                        currentSchema = (connection.options as IMySQLConnectionOptions).schema ?? "";
                    }*/

                    // TODO: we need server information for code completion.
                    const versionString = Settings.get("editor.dbVersion", "8.0.24");
                    const serverVersion = parseVersion(versionString);
                    const serverEdition = "";
                    const sqlMode = Settings.get("editor.sqlMode", "");

                    const model = this.createEditorModel(backend, "", "msg", serverVersion, sqlMode,
                        currentSchema);

                    const sessionState: IShellTabPersistentState = {
                        dataModelEntry: {} as IOdmShellSessionEntry,
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
                } catch (reason) {
                    const message = reason instanceof Error ? reason.message : String(reason);
                    void ui.showErrorNotification("Shell Session Error: " + message);

                    this.hideProgress("sessions");
                }
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
    private restartShellSession = async (id: string, session: IShellSessionDetails): Promise<void> => {
        const state = this.sessionState.get(id)!;
        const backend = state.backend;

        this.showProgress();

        this.setProgressMessage("Starting shell session...");
        try {
            const requestId = uuid();
            await backend.startShellSession(id, session.dbConnectionId, undefined, requestId, (result) => {
                if (result && result.result) {
                    if (!ShellPromptHandler.handleShellPrompt(result.result, requestId, backend)) {
                        this.setProgressMessage("Loading ...");
                    }
                }
            });

            this.hideProgress(id);
        } catch (reason) {
            const message = reason instanceof Error ? reason.message : String(reason);
            void ui.showErrorNotification("Shell Session Error: " + message);

            this.hideProgress("sessions");
        }
    };

    private handleQuit = (id: string): void => {
        void this.doCloseTab(id);
    };

    private closeTab = (e: MouseEvent | KeyboardEvent): void => {
        e.stopPropagation();

        const id = (e.currentTarget as HTMLElement).id;
        void this.doCloseTab(id);
    };

    private doCloseTab = async (id: string): Promise<void> => {
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
                await sessionState.backend.closeShellSession();
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

    private handleSelectTabFromDropdown = (accept: boolean, ids: Set<string>): void => {
        this.setState({ selectedTab: [...ids][0] });
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
        const model: IShellEditorModel = Object.assign(Monaco.createModel(text, language), {
            executionContexts: new ExecutionContexts({
                store: StoreType.Shell,
                dbVersion: serverVersion,
                sqlMode,
                currentSchema,
                runUpdates: this.sendSqlUpdatesFromModel.bind(this, session),
            }),

            // Create a default symbol table with no DB connection. This will be replaced in ShellTab, depending
            // on the connection the user opens.
            symbols: new DynamicSymbolTable(undefined, "db symbols", { allowDuplicateSymbols: true }),
            editorMode: CodeEditorMode.Terminal,
            session,
        });


        if (model.getEndOfLineSequence() !== Monaco.EndOfLineSequence.LF) {
            model.setEOL(Monaco.EndOfLineSequence.LF);
        } else {
            model.setValue(text);
        }

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
        if (this.pendingProgress) {
            clearTimeout(this.pendingProgress);
            this.pendingProgress = null;
        }

        this.setState({ selectedTab: newTab, progressMessage: "" });
    };

    private sendSqlUpdatesFromModel = async (session: ShellInterfaceShellSession,
        updates: string[]): Promise<ISqlUpdateResult> => {
        let lastIndex = 0;
        const rowCount = 0;
        try {
            await session.execute("start transaction");
            for (; lastIndex < updates.length; ++lastIndex) {
                const update = updates[lastIndex];
                await session.execute(update);

                // TODO: we need to get the number of affected rows from the result.
                // rowCount += result?.rowsAffected ?? 0;
            }
            await session.execute("commit");

            return { affectedRows: rowCount, errors: [] };
        } catch (reason) {
            await session.execute("rollback");
            if (reason instanceof Error) {
                const errors: string[] = [];
                errors[lastIndex] = reason.message; // Set the error for the query that was last executed.

                return { affectedRows: rowCount, errors };
            }

            throw reason;
        }
    };

}
