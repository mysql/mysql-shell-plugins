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

import { Component, createRef, VNode } from "preact";

import type { IDisposable } from "monaco-editor";
import { StandaloneServices } from "monaco-editor/esm/vs/editor/standalone/browser/standaloneServices.js";
import { IStandaloneThemeService } from "monaco-editor/esm/vs/editor/standalone/common/standaloneTheme.js";

import { MessageScheduler } from "../communication/MessageScheduler.js";
import { IShellProfile } from "../communication/ProtocolGui.js";
import { PasswordDialog } from "../components/Dialogs/PasswordDialog.js";
import { LoginPage } from "../components/Login/LoginPage.js";
import { IThemeChangeData, ThemeManager } from "../components/Theming/ThemeManager.js";
import { CodeEditorSetup } from "../components/ui/CodeEditor/CodeEditorSetup.js";
import { IComponentState } from "../components/ui/Component/ComponentBase.js";
import { NotificationCenter, NotificationType } from "../components/ui/NotificationCenter/NotificationCenter.js";
import { renderStatusBar, StatusBar } from "../components/ui/Statusbar/Statusbar.js";
import type {
    IStatusBarItem, IStatusBarItemOptions,
    StatusBarAlignment,
} from "../components/ui/Statusbar/StatusBarItem.js";
import { TooltipProvider } from "../components/ui/Tooltip/Tooltip.js";
import { appParameters } from "../supplement/AppParameters.js";
import { requisitions } from "../supplement/Requisitions.js";
import { Settings } from "../supplement/Settings/Settings.js";
import { ShellInterface } from "../supplement/ShellInterface/ShellInterface.js";
import { RunMode, webSession } from "../supplement/WebSession.js";
import { versionMatchesExpected } from "../utilities/helpers.js";
import { ApplicationDB } from "./ApplicationDB.js";
import { DialogHost } from "./DialogHost.js";
import { ErrorBoundary } from "./ErrorBoundary.js";
import {
    DialogResponseClosure, DialogType, IDialogResponse, minimumShellVersion, type IDialogRequest,
    type IServicePasswordRequest,
} from "./general-types.js";
import { LazyAppRouter, LoadingIndicator } from "./LazyAppRouter.js";
import { registerUiLayer, ui, type MessageOptions, type Thenable } from "./UILayer.js";

void CodeEditorSetup.init();

interface IAppState extends IComponentState {
    explorerIsVisible: boolean;
    loginInProgress: boolean;
    showOptions: boolean;

    authenticated: boolean;
}

export class App extends Component<{}, IAppState> {

    private passwordDialogRef = createRef<PasswordDialog>();

    private defaultProfile?: IShellProfile;
    private themeManager = ThemeManager.get;

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
        requisitions.register("hostThemeChange", this.themeManager.hostThemeChange);

        // Register early to ensure this handler is called last.
        requisitions.register("dialogResponse", this.dialogResponse);

        requisitions.register("webSessionStarted", (data) => {
            webSession.sessionId = data.sessionUuid;
            webSession.runMode = data.localUserMode ? RunMode.LocalUser : RunMode.Normal;
            if (data.singleServerMode) {
                webSession.runMode = RunMode.SingleServer;
            }

            // TODO: remove the check for the recover message and instead handle the session user name via
            //       session storage. Requires individual solutions for both, standalone and embedded use.

            // Session recovery is not supported in tests, so remove the else branch from test coverage.
            // istanbul ignore else
            if (webSession.userName === "" && data.requestState.msg !== "Session recovered") {
                if (webSession.runMode === RunMode.LocalUser) {
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
                    this.setState({ loginInProgress: false });
                }
            }

            return Promise.resolve(true);
        });

        requisitions.register("userAuthenticated", async (profile: IShellProfile): Promise<boolean> => {
            // Check if the connected shell has the minimum required version.
            const info = await ShellInterface.core.backendInformation ?? { major: 0, minor: 0, patch: 0 };
            if (!versionMatchesExpected([info.major, info.minor, info.patch], minimumShellVersion)) {
                void ui.showErrorMessage(`The connected shell has an unsupported version: ` +
                    `${info.major}.${info.minor}.${info.patch}`, {});

                return Promise.resolve(false);
            }

            this.defaultProfile = profile;
            if (this.defaultProfile) {
                webSession.loadProfile(this.defaultProfile);
                this.setState({ loginInProgress: false });
            }

            return Promise.resolve(true);
        });

        requisitions.register("userLoggedOut", async (): Promise<boolean> => {
            void ShellInterface.users.logout();

            this.defaultProfile = undefined;
            webSession.clearSessionData();
            this.setState({ loginInProgress: true });

            return Promise.resolve(true);
        });

        // Disable the default menu on all elements.
        window.document.body.addEventListener("contextmenu", (e) => {
            e.preventDefault();
        });

        // We want the browser to ask the user if they want to leave the page, e.g. when closing a tab or navigating
        // away from the page. This is to ensure that the user is aware that they are leaving the application.
        // However, as long as the user hasn't interacted with the page, no prompt will be shown. So we need to
        // simulate an interaction to trigger the prompt.
        window.onload = () => {
            setTimeout(() => {
                window.history.forward();
            }, 100);
        };

        window.addEventListener("beforeunload", (e: Event) => {
            // Always ask the user if they want to leave the page (if enabled).
            const ask = Settings.get("general.closeConfirmation", true);
            if (ask) {
                e.preventDefault();
            }
        });

        window.addEventListener("unload", () => {
            void requisitions.execute("applicationWillFinish", undefined);

            MessageScheduler.get.disconnect();
            void ApplicationDB.cleanUp();

            requisitions.unregister("themeChanged", this.themeChanged);
            requisitions.unregister("dialogResponse", this.dialogResponse);
            requisitions.unregister("hostThemeChange", this.themeManager.hostThemeChange);
        });

        // The Monaco Editor includes a font (codicon.ttf).
        // However, its associated CSS, such as .codicon-chevron-down:before { content: '\eb09'; },
        // is dynamically injected into the document by JavaScript via a style.monaco-colors element.
        // This injection only occurs if an Editor instance is created.
        // We require the icons to be available on pages even without an editor instance.
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

        requisitions.register("themeChanged", this.themeChanged);
    }

    public render(): VNode {
        const { loginInProgress } = this.state;

        let content;
        if (loginInProgress) {
            const connectionToken = appParameters.get("token") ?? "";
            if (connectionToken.length > 0) {
                content = LoadingIndicator;
            } else {
                content = <LoginPage />;
            }
        } else {
            content = <LazyAppRouter />;
        }

        return (
            <ErrorBoundary>
                {content}

                <TooltipProvider showDelay={200} />
                <NotificationCenter ref={this.#notificationCenterRef} />
                <PasswordDialog ref={this.passwordDialogRef} />
                <DialogHost />

                {!appParameters.hideStatusBar && (
                    <>
                        {renderStatusBar()}
                    </>
                )}
            </ErrorBoundary>
        );
    }

    // IUILayer interface implementation

    public showInformationMessage = <T extends string>(message: string, options: MessageOptions,
        ...items: T[]): Thenable<string | undefined> => {
        // Forward info messages to the hosting application.
        if (appParameters.embedded) {
            const result = requisitions.executeRemote("showInfo", message);
            if (result) {
                return Promise.resolve(undefined);
            }
        }

        const accept = items.shift();
        const refuse = items.shift();
        const alternative = items.shift();
        if (options?.modal) {
            const request: IDialogRequest = {
                id: "uiInformationMessage",
                type: DialogType.Confirm,
                description: options?.detail ? [options.detail] : undefined,
                parameters: {
                    title: options?.title ?? "Information",
                    prompt: message,
                    accept,
                    refuse,
                    alternative,
                },
            };

            void requisitions.execute("showDialog", request);
        } else {
            if (this.#notificationCenterRef.current) {
                return this.#notificationCenterRef.current.showNotification({
                    type: NotificationType.Information,
                    text: message,
                });
            }
        }

        return Promise.resolve(undefined);
    };

    public showWarningMessage = <T extends string>(message: string, _options: MessageOptions,
        ..._items: T[]): Thenable<string | undefined> => {
        if (appParameters.embedded) {
            const result = requisitions.executeRemote("showWarning", message);
            if (result) {
                return Promise.resolve(undefined);
            }
        }

        if (this.#notificationCenterRef.current) {
            return this.#notificationCenterRef.current.showNotification({
                type: NotificationType.Warning,
                text: message,
            });
        }

        return Promise.resolve(undefined);
    };

    public showErrorMessage = <T extends string>(message: string, _options: MessageOptions,
        ..._items: T[]): Thenable<string | undefined> => {
        if (appParameters.embedded) {
            const result = requisitions.executeRemote("showError", message);
            if (result) {
                return Promise.resolve(undefined);
            }
        }

        if (this.#notificationCenterRef.current) {
            return this.#notificationCenterRef.current.showNotification({
                type: NotificationType.Error,
                text: message,
            });
        }

        return Promise.resolve(undefined);
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

    public confirm = async (message: string, yes: string, no: string, extra?: string): Promise<string | undefined> => {
        const response = await DialogHost.showDialog({
            id: "msg.general.confirm",
            type: DialogType.Confirm,
            parameters: {
                title: "Confirmation",
                prompt: message,
                accept: yes,
                refuse: no,
                alternative: extra,
                default: "No",
            },
        });

        if (response.closure === DialogResponseClosure.Accept) {
            return yes;
        }

        if (response.closure === DialogResponseClosure.Cancel) {
            return no;
        }

        if (extra !== undefined && response.closure === DialogResponseClosure.Alternative) {
            return extra;
        }

        return undefined;
    };

    public requestPassword = (values: IServicePasswordRequest): Promise<string | undefined> => {
        if (this.passwordDialogRef.current) {
            return this.passwordDialogRef.current.show(values);
        }

        return Promise.resolve(undefined);
    };

    // End of UILayer interface implementation

    private themeChanged = (values: IThemeChangeData): Promise<boolean> => {
        requisitions.executeRemote("themeChanged", values);

        return Promise.resolve(true);
    };

    private dialogResponse = (response: IDialogResponse): Promise<boolean> => {
        if (appParameters.embedded) {
            // Forward all dialog responses.
            const result = requisitions.executeRemote("dialogResponse", response);

            return Promise.resolve(result);
        }

        return Promise.resolve(false);
    };
}
