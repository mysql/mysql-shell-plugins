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

import settingIcon from "../assets/images/settings.svg";
import debuggerIcon from "../assets/images/debugger.svg";

import { ComponentChild, createElement, createRef } from "preact";

import { webSession } from "../supplement/WebSession";
import { appParameters, requisitions } from "../supplement/Requisitions";

import { ModuleRegistry } from "../modules/ModuleRegistry";
import { SettingsEditor } from "../components/SettingsEditor/SettingsEditor";
import { DialogHost } from "./DialogHost";

import { CommunicationDebugger } from "../components/CommunicationDebugger/CommunicationDebugger";
import { ActivityBar } from "../components/ui/ActivityBar/ActivityBar";
import { ActivityBarItem, IActivityBarItemProperties } from "../components/ui/ActivityBar/ActivityBarItem";
import { IComponentProperties, ComponentBase } from "../components/ui/Component/ComponentBase";
import { Orientation, Container } from "../components/ui/Container/Container";
import { SplitContainer, ISplitterPaneSizeInfo } from "../components/ui/SplitContainer/SplitContainer";

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

    public constructor(props: IApplicationHostProperties) {
        super(props);

        this.state = {
            settingsVisible: false,
            settingsPage: "settings",
            debuggerVisible: false,
            debuggerMaximized: true,
        };

        requisitions.register("showAbout", this.showAbout);
        requisitions.register("showPreferences", this.showPreferences);
        requisitions.register("showModule", this.showModule);
    }

    public componentDidMount(): void {
        // Auto select the first module if no active module is given and we have a module to show actually.
        const modules = ModuleRegistry.enabledModules;
        if (modules.size > 0) {
            this.setState({ activeModule: modules.keys().next().value }, () => {
                this.updateActiveHost();
            });
        }

        void requisitions.execute("applicationDidStart", undefined);
        requisitions.executeRemote("applicationDidStart", undefined);
    }

    public componentWillUnmount(): void {
        requisitions.unregister("showAbout", this.showAbout);
        requisitions.unregister("showPreferences", this.showPreferences);
        requisitions.unregister("showModule", this.showModule);
    }

    public componentDidUpdate(prevProps: IApplicationHostProperties, prevState: IApplicationHostState): void {
        const { activeModule } = this.state;

        if (activeModule !== prevState.activeModule) {
            this.updateActiveHost();
        }
    }

    public render(): ComponentChild {
        const { activeModule, settingsVisible, settingsPage, debuggerVisible, debuggerMaximized } = this.state;

        const activityBarEntries: unknown[] = [];
        const pages: ComponentChild[] = [];

        // Mark an item only if the debugger or the settings are not shown full screen.
        const markModuleItem = !settingsVisible && (!debuggerVisible || !debuggerMaximized);
        const modules = ModuleRegistry.enabledModules;
        modules.forEach((module, id): void => {
            const isActiveModule = activeModule === id;
            activityBarEntries.push(
                <ActivityBarItem
                    key={id}
                    id={id}
                    active={markModuleItem && isActiveModule}
                    onClick={this.handleActivityItemClick}
                    //caption={module.moduleClass.info.title}
                    image={module.moduleClass.info.icon}
                    expand={false}
                />,
            );

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
                {!appParameters.embedded &&
                    <ActivityBar id="mainActivityBar">
                        <>
                            {activityBarEntries}
                            {allowDebugger && <ActivityBarItem
                                key="debugger"
                                id="debugger"
                                active={debuggerVisible && debuggerMaximized}
                                image={debuggerIcon}
                                expand={true}
                                onClick={this.handleActivityItemClick}
                            />}
                            <ActivityBarItem
                                key="settings"
                                id="settings"
                                active={settingsVisible}
                                image={settingIcon}
                                expand={!allowDebugger}
                                onClick={this.handleActivityItemClick}
                            />
                        </>
                    </ActivityBar>
                }

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

    private handleActivityItemClick = (e: unknown, props: IActivityBarItemProperties): void => {
        switch (props.id) {
            case "settings": {
                const { settingsVisible } = this.state;

                this.setState({ debuggerVisible: false, settingsVisible: !settingsVisible },
                    () => { this.updateActiveHost(); });
                break;
            }

            case "debugger": {
                const { debuggerVisible } = this.state;

                this.setState({ debuggerVisible: !debuggerVisible, settingsVisible: false },
                    () => { this.updateActiveHost(); });

                break;
            }

            default: {
                const { activeModule, debuggerVisible, debuggerMaximized } = this.state;

                this.setState({
                    activeModule: props.id || "",
                    debuggerVisible: debuggerVisible && !debuggerMaximized,
                    settingsVisible: false,
                }, () => { this.updateActiveHost(); });

                if (props.id && activeModule === props.id) {
                    // The same activity item was clicked. We use that as a signal to toggle things in modules
                    // (e.g. sidebars).
                    void requisitions.execute("moduleToggle", props.id);
                }

                break;
            }
        }
    };

    /**
     * Actives the page that belongs to a specific activity item. That's not the same as activating the item itself.
     */
    private updateActiveHost(): void {
        const { activeModule, settingsVisible } = this.state;

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
