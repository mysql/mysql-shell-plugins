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


import { ComponentChild } from "preact";
import { lazy, Suspense } from "preact/compat";

import { SettingsEditor } from "../components/SettingsEditor/SettingsEditor.js";
import { AboutBox } from "../components/ui/AboutBox/AboutBox.js";
import { ComponentBase, type IComponentProperties } from "../components/ui/Component/ComponentBase.js";
import { Container, Orientation } from "../components/ui/Container/Container.js";
import { ISplitterPane, SplitContainer,
    type ISplitterPaneSizeInfo } from "../components/ui/SplitContainer/SplitContainer.js";
import { StatusBarAlignment, type IStatusBarItem } from "../components/ui/Statusbar/StatusBarItem.js";
import { DocumentModule } from "../modules/db-editor/DocumentModule.js";
import { appParameters } from "../supplement/AppParameters.js";
import { requisitions } from "../supplement/Requisitions.js";
import { RunMode, webSession } from "../supplement/WebSession.js";
import { LoadingIndicator } from "./LazyAppRouter.js";
import { ui } from "./UILayer.js";

// eslint-disable-next-line @typescript-eslint/naming-convention
const CommunicationDebugger = lazy(async () => {
    return import("../components/CommunicationDebugger/CommunicationDebugger.js");
});

interface IApplicationHostProperties extends IComponentProperties {}

interface IApplicationHostState {
    settingsVisible: boolean;
    aboutVisible: boolean;
    debuggerVisible: boolean;
    debuggerMaximized: boolean;
    debuggerEnabledInBackground: boolean;
}

export default class ApplicationHost extends ComponentBase<IApplicationHostProperties, IApplicationHostState> {
    private lastEmbeddedDebuggerSplitPosition = 500;

    private optionsStatusItem?: IStatusBarItem;
    private aboutStatusItem?: IStatusBarItem;
    private debuggerStatusItem?: IStatusBarItem;

    private editorHost = <DocumentModule />;

    public constructor(props: IApplicationHostProperties) {
        super(props);

        this.state = {
            settingsVisible: false,
            aboutVisible: false,
            debuggerVisible: false,
            debuggerMaximized: true,
            debuggerEnabledInBackground: false,
        };
    }

    public override componentDidMount(): void {
        requisitions.register("showAbout", this.showAbout);
        requisitions.register("showPreferences", this.showPreferences);
        requisitions.register("statusBarButtonClick", this.statusBarButtonClick);

        if (!appParameters.embedded) {
            this.optionsStatusItem = ui.createStatusBarItem(StatusBarAlignment.Right, 9);
            this.optionsStatusItem.text = "$(gear)";
            this.optionsStatusItem.tooltip = "Toggle Preferences";
            this.optionsStatusItem.command = "application:togglePreferences";

            this.aboutStatusItem = ui.createStatusBarItem(StatusBarAlignment.Right, 9);
            this.aboutStatusItem.text = "$(info)";
            this.aboutStatusItem.tooltip = "Show About";
            this.aboutStatusItem.command = "application:toggleAbout";

            if (webSession.runMode === RunMode.LocalUser && !appParameters.embedded) {
                this.debuggerStatusItem = ui.createStatusBarItem(StatusBarAlignment.Right, 8);
                this.debuggerStatusItem.text = "$(debug)";
                this.debuggerStatusItem.tooltip = "Toggle Communication Debugger";
                this.debuggerStatusItem.command = "application:toggleDebugger";
            }
        }

        void requisitions.execute("applicationDidStart", undefined);
        requisitions.executeRemote("applicationDidStart", undefined);
    }

    public override componentWillUnmount(): void {
        this.optionsStatusItem?.dispose();
        this.debuggerStatusItem?.dispose();

        requisitions.unregister("showAbout", this.showAbout);
        requisitions.unregister("showPreferences", this.showPreferences);
        requisitions.unregister("statusBarButtonClick", this.statusBarButtonClick);
    }

    public render(): ComponentChild {
        const { settingsVisible, aboutVisible, debuggerVisible, debuggerEnabledInBackground,
            debuggerMaximized } = this.state;

        const pages: ComponentChild[] = [this.editorHost];

        if (settingsVisible) {
            pages.push(<SettingsEditor key="settingsEditor" />);
        } else if (aboutVisible) {
            pages.push(<AboutBox />);
        }

        let content = pages;
        if (webSession.runMode === RunMode.LocalUser && !appParameters.embedded &&
            (!appParameters.testsRunning || appParameters.launchWithDebugger)) {

            const panes: ISplitterPane[] = [{
                id: "appHostPane",
                content: pages,
                minSize: debuggerMaximized ? 0 : 500,
                initialSize: !debuggerVisible ? undefined :
                    debuggerMaximized
                        ? 0
                        : this.lastEmbeddedDebuggerSplitPosition,
                resizable: debuggerVisible && !debuggerMaximized,
                stretch: !debuggerVisible,
            }];

            if (debuggerEnabledInBackground) {
                panes.push({
                    id: "debuggerPane",
                    content: (
                        <Suspense fallback={LoadingIndicator}>
                            <CommunicationDebugger
                                toggleDisplayMode={this.toggleDebuggerDisplayMode}
                            />
                        </Suspense>
                    ),
                    minSize: debuggerVisible && !debuggerMaximized ? 200 : 0,
                    initialSize: !debuggerVisible ? 0 : undefined,
                    snap: true,
                    resizable: debuggerVisible && !debuggerMaximized,
                    stretch: debuggerVisible && debuggerMaximized,
                });
            }

            content = [
                <SplitContainer
                    key="appHostSplitter"
                    id="appHostSplitter"
                    orientation={Orientation.TopDown}
                    panes={panes}
                    onPaneResized={this.embeddedDebuggerSplitterResize}
                />];
        }

        return (
            <Container className="applicationHost" orientation={Orientation.TopDown}>
                {content}
            </Container>
        );
    }

    private showAbout = (): Promise<boolean> => {
        return new Promise((resolve) => {
            this.setState({ aboutVisible: true, settingsVisible: false, debuggerVisible: false }, () => {
                resolve(true);
            });
        });
    };

    private showPreferences = (): Promise<boolean> => {
        return new Promise((resolve) => {
            this.setState({ settingsVisible: true, aboutVisible: false, debuggerVisible: false }, () => {
                resolve(true);
            });
        });
    };

    private statusBarButtonClick = (values: { type: string; }): Promise<boolean> => {
        switch (values.type) {
            case "application:toggleAbout": {
                const { aboutVisible } = this.state;

                this.setState({ debuggerVisible: false, aboutVisible: !aboutVisible, settingsVisible: false });
                break;
            }

            case "application:togglePreferences": {
                const { settingsVisible } = this.state;

                this.setState({ debuggerVisible: false, settingsVisible: !settingsVisible, aboutVisible: false });
                break;
            }

            case "application:toggleDebugger": {
                const { debuggerVisible } = this.state;

                this.setState({
                    debuggerVisible: !debuggerVisible,
                    debuggerEnabledInBackground: true,
                    settingsVisible: false,
                    aboutVisible: false,
                });

                break;
            }

            default:
        }

        return Promise.resolve(false);
    };

    private embeddedDebuggerSplitterResize = (info: ISplitterPaneSizeInfo[]): void => {
        info.forEach((value) => {
            if (value.id === "appHostPane") {
                this.lastEmbeddedDebuggerSplitPosition = value.currentSize;
            }
        });
    };

    private toggleDebuggerDisplayMode = (): void => {
        const { debuggerMaximized } = this.state;

        this.setState({ debuggerMaximized: !debuggerMaximized });
    };

}
