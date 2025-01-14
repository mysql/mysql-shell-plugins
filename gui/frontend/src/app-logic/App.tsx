/*
 * Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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

import "./App.css";

import { Component, VNode, createRef } from "preact";

import { LoginPage } from "../components/Login/LoginPage.js";
import { IThemeChangeData } from "../components/Theming/ThemeManager.js";
import { TooltipProvider } from "../components/ui/Tooltip/Tooltip.js";
import { ModuleRegistry } from "../modules/ModuleRegistry.js";
import { appParameters, requisitions } from "../supplement/Requisitions.js";
import { ShellInterface } from "../supplement/ShellInterface/ShellInterface.js";
import { webSession } from "../supplement/WebSession.js";
import { ApplicationHost } from "./ApplicationHost.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import { ProfileSelector } from "./ProfileSelector.js";

import type { IDisposable } from "monaco-editor";
import { StandaloneServices } from "monaco-editor/esm/vs/editor/standalone/browser/standaloneServices.js";
import { IStandaloneThemeService } from "monaco-editor/esm/vs/editor/standalone/common/standaloneTheme.js";
import { MessageScheduler } from "../communication/MessageScheduler.js";
import { IShellProfile } from "../communication/ProtocolGui.js";
import { PasswordDialog } from "../components/Dialogs/PasswordDialog.js";
import { ColorPopup } from "../components/ui/ColorPicker/ColorPopup.js";
import { IComponentState } from "../components/ui/Component/ComponentBase.js";
import { NotificationCenter, NotificationType } from "../components/ui/NotificationCenter/NotificationCenter.js";
import { ProgressIndicator } from "../components/ui/ProgressIndicator/ProgressIndicator.js";
import type {
    IStatusBarItem, IStatusBarItemOptions, StatusBarAlignment,
} from "../components/ui/Statusbar/StatusBarItem.js";
import { StatusBar, renderStatusBar } from "../components/ui/Statusbar/Statusbar.js";
import { DBEditorModule } from "../modules/db-editor/DBEditorModule.js";
import { InnoDBClusterModule } from "../modules/innodb-cluster/InnoDBClusterModule.js";
import { ShellModule } from "../modules/shell/ShellModule.js";
import { versionMatchesExpected } from "../utilities/helpers.js";
import { ApplicationDB } from "./ApplicationDB.js";
import { registerUiLayer, ui } from "./UILayer.js";
import { IDialogResponse, minimumShellVersion, type IServicePasswordRequest } from "./general-types.js";

interface IAppState extends IComponentState {
    explorerIsVisible: boolean;
    loginInProgress: boolean;
    showOptions: boolean;

    authenticated: boolean;
}

export class App extends Component<{}, IAppState> {

    private actionMenuRef = createRef<ProfileSelector>();
    private passwordDialogRef = createRef<PasswordDialog>();

    private defaultProfile?: IShellProfile;

    #notificationCenterRef = createRef<NotificationCenter>();

    public constructor(props: {}) {
        super(props);

        registerUiLayer(this);

        this.state = {
            authenticated: false,
            explorerIsVisible: true,
            loginInProgress: true,
            showOptions: false,
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

        requisitions.register("userAuthenticated", async (profile: IShellProfile): Promise<boolean> => {
            // Check if the connected shell has the minimum required version.
            const info = await ShellInterface.core.backendInformation ?? { major: 0, minor: 0, patch: 0 };
            if (!versionMatchesExpected([info.major, info.minor, info.patch], minimumShellVersion)) {
                void ui.showErrorNotification(`The connected shell has an unsupported version: ` +
                    `${info.major}.${info.minor}.${info.patch}`);

                return Promise.resolve(false);
            }

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
            requisitions.unregister("themeChanged", this.themeChanged);
            requisitions.unregister("dialogResponse", this.dialogResponse);
        });

        // The Monaco Editor includes a font (codicon.ttf).
        // However, its associated CSS, such as .codicon-chevron-down:before { content: '\eb09'; },
        // is dynamically injected into the document by JavaScript via a style.monaco-colors element.
        // This injection only occurs if an Editor instance is created.
        // We require the icons to be available on pages even without an editor instance.
        // The only reason why it works in standalone is that CommunicationDebugger renders CodeEditor.
        const themeService = StandaloneServices.get(IStandaloneThemeService);
        themeService.registerEditorContainer(document.createElement("div"));
    }

    public override componentDidMount(): void {
        /* istanbul ignore next */
        if (!appParameters.testsRunning) {
            void MessageScheduler.get.connect({ url: new URL(window.location.href) });
        }

        // Set the default font size by either using the default of 14px or the app parameter fontSize
        let fontSize = "14px";
        if (appParameters.fontSize) {
            fontSize = `${appParameters.fontSize}px`;
        }
        window.document.documentElement.style.fontSize = fontSize;

        // Set the default editor font size by either using the default of 14px or the app parameter fontSize
        let editorFontSize = fontSize;
        if (appParameters.editorFontSize) {
            editorFontSize = `${appParameters.editorFontSize}px`;
        }
        const style = document.createElement("style");
        style.innerHTML = `.msg.codeEditor .zoneHost { font-size: ${editorFontSize}; } ` +
            `.msg.resultHost .resultView .tabulator { font-size: ${editorFontSize}; }`;
        document.head.appendChild(style);

        requisitions.register("statusBarButtonClick", this.statusBarButtonClick);
        requisitions.register("themeChanged", this.themeChanged);
    }

    public render(): VNode {
        const { loginInProgress } = this.state;

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

                <TooltipProvider showDelay={200} />
                <NotificationCenter ref={this.#notificationCenterRef} />
                <PasswordDialog ref={this.passwordDialogRef} />

                {!appParameters.embedded && (
                    <>
                        {renderStatusBar()}
                        <ProfileSelector ref={this.actionMenuRef}></ProfileSelector>
                        <ColorPopup />
                    </>
                )}
            </ErrorBoundary>
        );
    }

    // IUILayer interface implementation

    public showInformationNotification = async (message: string, timeout?: number): Promise<string | undefined> => {
        // Forward info messages to the hosting application.
        if (appParameters.embedded) {
            const result = requisitions.executeRemote("showInfo", message);
            if (result) {
                return;
            }
        }

        if (this.#notificationCenterRef.current) {
            return this.#notificationCenterRef.current.showNotification({
                type: NotificationType.Information,
                text: message,
                timeout,
            });
        }
    };

    public showWarningNotification = async (message: string): Promise<string | undefined> => {
        if (appParameters.embedded) {
            const result = requisitions.executeRemote("showWarning", message);
            if (result) {
                return;
            }
        }

        if (this.#notificationCenterRef.current) {
            return this.#notificationCenterRef.current.showNotification({
                type: NotificationType.Warning,
                text: message,
            });
        }
    };

    public showErrorNotification = async (message: string): Promise<string | undefined> => {
        if (appParameters.embedded) {
            const result = requisitions.executeRemote("showError", message);
            if (result) {
                return;
            }
        }

        if (this.#notificationCenterRef.current) {
            return this.#notificationCenterRef.current.showNotification({
                type: NotificationType.Error,
                text: message,
            });
        }
    };

    public createStatusBarItem(alignment?: StatusBarAlignment, priority?: number): IStatusBarItem;
    public createStatusBarItem(id: string, alignment?: StatusBarAlignment, priority?: number): IStatusBarItem;
    public createStatusBarItem(...args: unknown[]): IStatusBarItem {
        let options: IStatusBarItemOptions;
        if (args.length > 0 && typeof args[0] === "string") {
            options = {
                id: args[0],
                alignment: args[1] as StatusBarAlignment,
                priority: args[2] as number,
            };
        } else {
            options = {
                alignment: args.length > 0 ? args[0] as StatusBarAlignment : undefined,
                priority: args.length > 1 ? args[1] as number : undefined,
            };
        }

        return StatusBar.createStatusBarItem(options);
    }


    public setStatusBarMessage = (message: string, timeout?: number): IDisposable => {
        return StatusBar.setStatusBarMessage(message, timeout);
    };

    public confirm = (message: string, yes: string, no: string): Promise<string | undefined> => {
        return Promise.resolve(window.confirm(message) ? yes : no);
    };

    public requestPassword = (values: IServicePasswordRequest): Promise<string | undefined> => {
        if (this.passwordDialogRef.current) {
            return this.passwordDialogRef.current.show(values);
        }

        return Promise.resolve(undefined);
    };

    // End of UILayer interface implementation

    private statusBarButtonClick = (values: { type: string; event: MouseEvent | KeyboardEvent; }): Promise<boolean> => {
        if (values.type === "openPopupMenu") {
            const target = values.event.target as HTMLElement;
            this.actionMenuRef.current?.open(target.getBoundingClientRect());

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
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
            const message = reason instanceof Error ? reason.message : String(reason);
            void ui.showErrorNotification(`Cannot retrieve the module list: ${message}`);
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
