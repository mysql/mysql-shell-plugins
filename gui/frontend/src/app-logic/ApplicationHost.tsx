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


import { ComponentChild, createElement, createRef } from "preact";

import { appParameters, requisitions } from "../supplement/Requisitions.js";
import { webSession } from "../supplement/WebSession.js";

import { SettingsEditor } from "../components/SettingsEditor/SettingsEditor.js";
import { ModuleRegistry } from "../modules/ModuleRegistry.js";
import { DialogHost } from "./DialogHost.js";

import { CommunicationDebugger } from "../components/CommunicationDebugger/CommunicationDebugger.js";
import { ComponentBase, type IComponentProperties } from "../components/ui/Component/ComponentBase.js";
import { Container, Orientation } from "../components/ui/Container/Container.js";
import { SplitContainer, type ISplitterPaneSizeInfo } from "../components/ui/SplitContainer/SplitContainer.js";
import { StatusBarAlignment, type IStatusBarItem } from "../components/ui/Statusbar/StatusBarItem.js";
import { ui } from "./UILayer.js";

interface IApplicationHostProperties extends IComponentProperties {
    toggleOptions: () => void;
}

interface IApplicationHostState {
    activeModule?: string;

    settingsVisible: boolean;
    settingsPage: string;

    debuggerVisible: boolean;
    debuggerMaximized: boolean;
}

export class ApplicationHost extends ComponentBase<IApplicationHostProperties, IApplicationHostState> {
    private lastEmbeddedDebuggerSplitPosition = 500;

    private loadedModules = new Map<string, [ComponentChild, preact.RefObject<HTMLElement>]>();

    #optionsStatusItem?: IStatusBarItem;
    #debuggerStatusItem?: IStatusBarItem;

    public constructor(props: IApplicationHostProperties) {
        super(props);

        this.state = {
            settingsVisible: false,
            settingsPage: "settings",
            debuggerVisible: false,
            debuggerMaximized: true,
        };
    }

    public override componentDidMount(): void {
        // Auto select the first module if no active module is given and we have a module to show actually.
        // XXX: rework once the modules are gone.
        const modules = ModuleRegistry.enabledModules;
        if (modules.size > 0) {
            this.setState({ activeModule: modules.keys().next().value }, () => {
                this.updateActiveHost();
            });
        }

        requisitions.register("showAbout", this.showAbout);
        requisitions.register("showPreferences", this.showPreferences);
        requisitions.register("showModule", this.showModule);
        requisitions.register("statusBarButtonClick", this.statusBarButtonClick);

        if (!appParameters.embedded) {
            this.#optionsStatusItem = ui.createStatusBarItem(StatusBarAlignment.Right, 9);
            this.#optionsStatusItem.text = "$(gear)";
            this.#optionsStatusItem.tooltip = "Toggle Preferences";
            this.#optionsStatusItem.command = "application:togglePreferences";
            this.#debuggerStatusItem = ui.createStatusBarItem(StatusBarAlignment.Right, 8);
            this.#debuggerStatusItem.text = "$(debug)";
            this.#debuggerStatusItem.tooltip = "Toggle Communication Debugger";
            this.#debuggerStatusItem.command = "application:toggleDebugger";
        }

        void requisitions.execute("applicationDidStart", undefined);
        requisitions.executeRemote("applicationDidStart", undefined);
    }

    public override componentWillUnmount(): void {
        this.#optionsStatusItem?.dispose();
        this.#debuggerStatusItem?.dispose();

        requisitions.unregister("showAbout", this.showAbout);
        requisitions.unregister("showPreferences", this.showPreferences);
        requisitions.unregister("showModule", this.showModule);
        requisitions.unregister("statusBarButtonClick", this.statusBarButtonClick);
    }

    public override componentDidUpdate(prevProps: IApplicationHostProperties, prevState: IApplicationHostState): void {
        const { activeModule } = this.state;

        if (activeModule !== prevState.activeModule) {
            this.updateActiveHost();
        }
    }

    public render(): ComponentChild {
        const { activeModule, settingsVisible, settingsPage, debuggerVisible, debuggerMaximized } = this.state;

        const pages: ComponentChild[] = [];

        // Mark an item only if the debugger or the settings are not shown full screen.
        const modules = ModuleRegistry.enabledModules;
        modules.forEach((module, id): void => {
            const isActiveModule = activeModule === id;
            const info = this.loadedModules.get(id);
            if (info) {
                pages.push(info[0]);
            } else if (isActiveModule) {
                // Create the page if it doesn't exist yet, but was made the active page.
                const innerRef = createRef<HTMLElement>();
                const element = createElement(module.moduleClass, { innerRef, key: id });
                this.loadedModules.set(id, [element, innerRef]);

                pages.push(element);
            }
        });

        if (settingsVisible) {
            pages.push(<SettingsEditor key="settingsEditor" page={settingsPage} />);
        }

        let content = pages;
        let allowDebugger = false;
        if (webSession.localUserMode && !appParameters.embedded &&
            (!appParameters.testsRunning || appParameters.launchWithDebugger)) {
            allowDebugger = true;

            content = [
                <SplitContainer
                    key="appHostSplitter"
                    id="appHostSplitter"
                    orientation={Orientation.TopDown}
                    panes={[
                        {
                            id: "appHostPane",
                            content: pages,
                            minSize: debuggerMaximized ? 0 : 500,
                            initialSize: !debuggerVisible ? undefined :
                                debuggerMaximized
                                    ? 0
                                    : this.lastEmbeddedDebuggerSplitPosition,
                            resizable: debuggerVisible && !debuggerMaximized,
                            stretch: !debuggerVisible,
                        },
                        allowDebugger && {
                            id: "debuggerPane",
                            content: <CommunicationDebugger
                                toggleDisplayMode={this.toggleDebuggerDisplayMode}
                            />,
                            minSize: debuggerVisible && !debuggerMaximized ? 200 : 0,
                            initialSize: !debuggerVisible ? 0 : undefined,
                            snap: true,
                            resizable: debuggerVisible && !debuggerMaximized,
                            stretch: debuggerVisible && debuggerMaximized,
                        },
                    ]}
                    onPaneResized={this.embeddedDebuggerSplitterResize}
                />];
        }

        return (
            <Container className="applicationHost">
                {content}
                <DialogHost />
            </Container>
        );
    }

    private showAbout = (): Promise<boolean> => {
        return new Promise((resolve) => {
            this.setState({ settingsVisible: true, settingsPage: "about" }, () => {
                this.updateActiveHost();
                resolve(true);
            });
        });
    };

    private showPreferences = (): Promise<boolean> => {
        return new Promise((resolve) => {
            this.setState({ settingsVisible: true, settingsPage: "settings" }, () => {
                this.updateActiveHost();
                resolve(true);
            });
        });
    };

    private showModule = (module: string): Promise<boolean> => {
        return new Promise((resolve) => {
            if (this.loadedModules.size === 0) {
                resolve(false);
            } else {
                this.setState({ activeModule: module }, () => { resolve(true); });
            }
        });
    };

    private statusBarButtonClick = (values: { type: string; }): Promise<boolean> => {
        switch (values.type) {
            case "application:togglePreferences": {
                const { settingsVisible } = this.state;

                this.setState({ debuggerVisible: false, settingsVisible: !settingsVisible },
                    () => { this.updateActiveHost(); });
                break;
            }

            case "application:toggleDebugger": {
                const { debuggerVisible } = this.state;

                this.setState({ debuggerVisible: !debuggerVisible, settingsVisible: false },
                    () => { this.updateActiveHost(); });

                break;
            }

            default:
        }

        return Promise.resolve(false);
    };

    /**
     * Actives the page that belongs to a specific activity item. That's not the same as activating the item itself.
     */
    private updateActiveHost(): void {
        const { activeModule, settingsVisible } = this.state;

        if (activeModule === "gui.sql_editor") { // Temporary block to allow only the DB editor module to become active.
            this.loadedModules.forEach((value, key) => {
                if (value[1].current) {
                    if (!settingsVisible && key === activeModule) {
                        value[1].current.classList.add("active");
                    } else {
                        value[1].current.classList.remove("active");
                    }
                }
            });
        }
    }

    private embeddedDebuggerSplitterResize = (info: ISplitterPaneSizeInfo[]): void => {
        info.forEach((value) => {
            if (value.id === "appHostPane") {
                this.lastEmbeddedDebuggerSplitPosition = value.currentSize;
            }
        });
    };

    private toggleDebuggerDisplayMode = (): void => {
        const { debuggerMaximized } = this.state;

        this.setState({ debuggerMaximized: !debuggerMaximized }, () => { this.updateActiveHost(); });
    };

}
