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

import "./App.css";

import { Component, createRef, VNode } from "preact";

import { ApplicationHost } from "./ApplicationHost";
import { ModuleRegistry } from "../modules/ModuleRegistry";
import { LoginPage } from "../components/Login/LoginPage";
import { ErrorBoundary } from "./ErrorBoundary";
import { TooltipProvider } from "../components/ui/Tooltip/Tooltip";
import { webSession } from "../supplement/WebSession";
import { ShellInterface } from "../supplement/ShellInterface/ShellInterface";
import { appParameters, requisitions } from "../supplement/Requisitions";
import { IThemeChangeData } from "../components/Theming/ThemeManager";
import { IEditorStatusInfo } from "../modules/db-editor";
import { ProfileSelector } from "./ProfileSelector";

import { ShellModule } from "../modules/shell/ShellModule";
import { DBEditorModule } from "../modules/db-editor/DBEditorModule";
import { InnoDBClusterModule } from "../modules/innodb-cluster/InnoDBClusterModule";
import { ApplicationDB } from "./ApplicationDB";
import { IDialogResponse } from "./Types";
import { MessageScheduler } from "../communication/MessageScheduler";
import { IShellProfile } from "../communication/ProtocolGui";
import { ColorPopup } from "../components/ui/ColorPicker/ColorPopup";
import { IComponentState } from "../components/ui/Component/ComponentBase";
import { ProgressIndicator } from "../components/ui/ProgressIndicator/ProgressIndicator";
import { IStatusbarItem, ControlType, Statusbar } from "../components/ui/Statusbar/Statusbar";
import { MessagePanel } from "../components/Dialogs/MessagePanel";

interface IAppState extends IComponentState {
    explorerIsVisible: boolean;
    loginInProgress: boolean;
    showOptions: boolean;

    authenticated: boolean;
    statusbarEntries: IStatusbarItem[];
}

export class App extends Component<{}, IAppState> {

    private actionMenuRef = createRef<ProfileSelector>();
    private defaultProfile?: IShellProfile;

    public constructor(props: {}) {
        super(props);

        this.state = {
            authenticated: false,
            explorerIsVisible: true,
            loginInProgress: true,
            showOptions: false,

            statusbarEntries: [
                {
                    id: "profileTitle",
                    type: ControlType.TextType,
                    text: "Profile:",
                    visible: false,
                },
                {
                    id: "profileChoice",
                    type: ControlType.ButtonType,
                    tooltip: "Change profile",
                    choices: [],
                    visible: false,
                    commandId: "openPopupMenu",
                },
                {
                    id: "details",
                    type: ControlType.TextType,
                    rightAlign: true,
                    standout: false,
                },
                {
                    id: "editorLanguage",
                    type: ControlType.TextType,
                    visible: false,
                    rightAlign: true,
                },
                {
                    id: "editorEOL",
                    type: ControlType.TextType,
                    visible: false,
                    rightAlign: true,
                },
                {
                    id: "editorIndent",
                    type: ControlType.TextType,
                    visible: false,
                    rightAlign: true,
                    //commandId: "scripting:editor.action.quickCommand",
                },
                {
                    id: "editorPosition",
                    type: ControlType.ButtonType,
                    visible: false,
                    rightAlign: true,
                    commandId: "scripting:editor.action.gotoLine",
                },
            ],
        };

        // Register early to ensure this handler is called last.
        requisitions.register("dialogResponse", this.dialogResponse);

        requisitions.register("webSessionStarted", (data) => {
            webSession.sessionId = data.sessionUuid;
            webSession.localUserMode = data.localUserMode ?? false;

            // TODO: remove the check for the recover message and instead handle the session user name via
            //       session storage. Requires individual solutions for both, standalone and embedded use.

            // Session recovery is not supported in tests, so remove the else branch from test coverage.
            // istanbul ignore else
            if (webSession.userName === "" && data.requestState.msg !== "Session recovered") {
                if (webSession.localUserMode) {
                    ShellInterface.users.authenticate("LocalAdministrator", "").then((profile) => {
                        if (profile) {
                            // Detour via requisitions for the rest of the profile processing as we need the same
                            // handling for authentication via the login page.
                            void requisitions.execute("userAuthenticated", profile);
                        }
                    }).catch(() => {
                        this.setState({ loginInProgress: true });
                    });
                }
            } else {
                this.defaultProfile = data.activeProfile;
                if (this.defaultProfile) {
                    webSession.loadProfile(this.defaultProfile);
                    this.enableModules(this.defaultProfile.userId);
                }
            }

            return Promise.resolve(true);
        });

        requisitions.register("userAuthenticated", (profile: IShellProfile): Promise<boolean> => {
            this.defaultProfile = profile;
            if (this.defaultProfile) {
                webSession.loadProfile(this.defaultProfile);
                this.enableModules(this.defaultProfile.userId);
            }

            return Promise.resolve(true);
        });

        // Disable the default menu on all elements.
        window.document.body.addEventListener("contextmenu", (e) => {
            e.preventDefault();
        });

        window.addEventListener("beforeunload", () => {
            void requisitions.execute("applicationWillFinish", undefined);

            MessageScheduler.get.disconnect();
            void ApplicationDB.cleanUp();

            requisitions.unregister("statusBarButtonClick", this.statusBarButtonClick);
            requisitions.unregister("editorInfoUpdated", this.editorInfoUpdated);
            requisitions.unregister("themeChanged", this.themeChanged);
            requisitions.unregister("dialogResponse", this.dialogResponse);
        });
    }

    public componentDidMount(): void {
        /* istanbul ignore next */
        if (!appParameters.testsRunning) {
            void MessageScheduler.get.connect({ url: new URL(window.location.href) });
        }

        requisitions.register("statusBarButtonClick", this.statusBarButtonClick);
        requisitions.register("editorInfoUpdated", this.editorInfoUpdated);
        requisitions.register("themeChanged", this.themeChanged);
    }

    public render(): VNode {
        const { loginInProgress, statusbarEntries } = this.state;

        let content;
        if (loginInProgress) {
            const connectionToken = appParameters.get("token") ?? "";
            if (connectionToken.length > 0) {
                content = <ProgressIndicator
                    backgroundOpacity={0}
                    indicatorWidth={100}
                    indicatorHeight={100}
                />;
            } else {
                content = <LoginPage />;
            }
        } else {
            content = <ApplicationHost toggleOptions={this.toggleOptions} />;
        }

        return (
            <ErrorBoundary>
                {content}

                <MessagePanel />
                <TooltipProvider showDelay={200} />

                {!appParameters.embedded && (
                    <>
                        <Statusbar items={statusbarEntries} />
                        <ProfileSelector ref={this.actionMenuRef}></ProfileSelector>
                        <ColorPopup />
                    </>
                )}
            </ErrorBoundary>
        );
    }

    /*private initProfileList = (profile: IShellProfile): void => {
        this.actionMenuRef.current?.initProfileList(profile);
    };*/

    private statusBarButtonClick = (values: { type: string; event: MouseEvent | KeyboardEvent; }): Promise<boolean> => {
        if (values.type === "openPopupMenu") {
            const target = values.event.target as HTMLElement;
            this.actionMenuRef.current?.open(target.getBoundingClientRect());

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

    private editorInfoUpdated = (info: IEditorStatusInfo): Promise<boolean> => {
        let text = "";
        if (info.indentSize || info.tabSize) {
            if (info.insertSpaces) {
                text = `Spaces: ${info.indentSize ?? 0}`;
            } else {
                text = `Tab Size: ${info.tabSize ?? 0}`;
            }
        }

        const statusbarArguments = [];
        if (text !== "") {
            statusbarArguments.push({
                id: "editorIndent",
                visible: true,
                text,
            });
        }

        if (info.line || info.column) {
            statusbarArguments.push({
                id: "editorPosition",
                visible: true,
                text: `Ln ${info.line ?? 1}, Col ${info.column ?? 1}`,
            });
        }

        if (info.language) {
            statusbarArguments.push({
                id: "editorLanguage",
                visible: true,
                text: info.language,
            });
        }

        if (info.eol) {
            statusbarArguments.push({
                id: "editorEOL",
                visible: true,
                text: info.eol,
            });
        }

        return requisitions.execute("updateStatusbar", statusbarArguments);

    };

    private themeChanged = (values: IThemeChangeData): Promise<boolean> => {
        requisitions.executeRemote("themeChanged", values);

        return Promise.resolve(true);
    };

    private toggleOptions = (): void => {
        const { showOptions } = this.state;
        this.setState({ showOptions: !showOptions });
    };

    /**
     * Determines which modules a user is allowed to use and enables them in the UI.
     *
     * @param userId The ID of the user for which modules must be enabled.
     */
    private enableModules(userId: number): void {
        ShellInterface.users.getGuiModuleList(userId).then((list) => {
            // Register the known modules first.
            ModuleRegistry.registerModule(DBEditorModule);
            ModuleRegistry.registerModule(ShellModule);
            ModuleRegistry.registerModule(InnoDBClusterModule);

            list.forEach((id: string) => {
                ModuleRegistry.enableModule(id);
            });

            // Now we have the login actually finished and can show the main UI.
            this.setState({ loginInProgress: false });
        }).catch( /* istanbul ignore next */(reason) => {
            void requisitions.execute("showError", [
                "Backend Error",
                `Cannot retrieve the module list: \n${String(reason)}`,
            ]);
        });
    }

    private dialogResponse = (response: IDialogResponse): Promise<boolean> => {
        if (appParameters.embedded) {
            // Forward all dialog responses.
            const result = requisitions.executeRemote("dialogResponse", response);

            return Promise.resolve(result);
        }

        return Promise.resolve(false);
    };

}
