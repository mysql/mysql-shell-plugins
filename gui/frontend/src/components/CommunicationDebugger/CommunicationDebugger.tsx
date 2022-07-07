/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

import "./CommunicationDebugger.css";
import closeButton from "../../assets/images/close2.svg";
import connectedIcon from "../../assets/images/connected.svg";
import disconnectedIcon from "../../assets/images/disconnected.svg";

import React from "react";
import { render } from "preact";

import { Component, IComponentProperties, IComponentState, SelectionType } from "../ui/Component/Component";
import {
    Container, Accordion, SplitContainer, Orientation, Toolbar, Label, Button, Divider, ISplitterPane, Tabview,
    ITabviewPage, Icon, Codicon, TreeGrid, ITreeGridOptions, ISplitterPaneSizeInfo, Tabulator, SetDataAction,
} from "../ui";

import { ListenerEntry, EventType, IDispatchEvent } from "../../supplement/Dispatch";
import { ICommScriptContentEvent, ICommDebuggerScriptsEvent, ProtocolGui, MessageScheduler } from "../../communication";
import { ICodeEditorOptions, Monaco } from "../ui/CodeEditor";
import { ExecutionContexts } from "../../script-execution/ExecutionContexts";
import { convertCamelToSnakeCase, sleep, strictEval } from "../../utilities/helpers";
import { requisitions } from "../../supplement/Requisitions";
import { CodeEditor, CodeEditorMode, ICodeEditorModel, IEditorPersistentState } from "../ui/CodeEditor/CodeEditor";
import { IDictionary } from "../../app-logic/Types";
import { EditorLanguage } from "../../supplement";
import { CommunicationDebuggerEnvironment } from "./CommunicationDebuggerEnvironment";

/* eslint import/no-webpack-loader-syntax: off */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const typings = require("!!raw-loader?esModule=false!./debugger-runtime.d.ts");

const defaultEditorOptions: ICodeEditorOptions = {
    tabSize: 4,
    indentSize: 4,
    insertSpaces: true,

    defaultEOL: "LF",
    trimAutoWhitespace: true,
};

export enum ScriptTreeType {
    Folder,
    Script,
}

export interface IScriptTreeEntry {
    type: ScriptTreeType;
    language?: EditorLanguage; // Not set if type is a folder.

    id: string;
    name: string;
    fullPath?: string;
    children?: IScriptTreeEntry[];
}

enum OutputType {
    Normal,
    Command,
    Error,
}

export interface ICommunicationDebuggerProperties extends IComponentProperties {
    toggleDisplayMode: () => void;
}

interface ICommunicationDebuggerState extends IComponentState {
    // Input area tabs.
    activeInputTab: string;
    scriptTabs: ITabviewPage[];      // Tabs for each open test/debugger script.
}

export class CommunicationDebugger extends Component<ICommunicationDebuggerProperties, ICommunicationDebuggerState> {

    private environment: CommunicationDebuggerEnvironment;

    private messageOutputRef = React.createRef<CodeEditor>();
    private inputRef = React.createRef<CodeEditor>();
    private scriptTreeRef = React.createRef<TreeGrid>();

    private outputState: IEditorPersistentState;
    private inputState: IEditorPersistentState;

    // Contains a mapping of the full path of a script to its content.
    private scriptContent = new Map<string, string>();

    private sidebarWidth = 250;
    private inputAreaHeight = 400;

    public constructor(props: ICommunicationDebuggerProperties) {
        super(props);

        this.state = {
            activeInputTab: "interactiveTab",
            scriptTabs: [],
        };

        CodeEditor.addTypings(typings as string, "debugger");

        ListenerEntry.create({ persistent: true }).then((event: IDispatchEvent) => {
            this.handleEvent(event);
        }).catch((event: IDispatchEvent) => {
            this.printOutput("ws.lastResponse = " +
                JSON.stringify(convertCamelToSnakeCase(event.data as object), undefined, 4) + ";\n", OutputType.Error);
        });

        // In order to keep all text in the editor, even if the debugger is updated, we use 2 editor models.
        this.outputState = this.createEditorState("");
        this.inputState = this.createEditorState("");

        this.environment = new CommunicationDebuggerEnvironment(this.scriptContent);
    }

    public componentDidMount(): void {
        if (MessageScheduler.get.isConnected) {
            this.loadScripts();
        }
    }

    public render(): React.ReactNode {
        const className = this.getEffectiveClassNames(["debugger"]);

        const scriptTreeOptions: ITreeGridOptions = {
            treeColumn: "name",
            selectionType: SelectionType.Single,
            showHeader: false,
            layout: "fitColumns",
            expandedLevels: [true, false, true],
        };

        const scriptSectionContent = <TreeGrid
            className="scriptTree"
            ref={this.scriptTreeRef}
            options={scriptTreeOptions}
        />;

        return (
            <SplitContainer
                className={className}
                orientation={Orientation.LeftToRight}
                panes={[
                    {
                        id: "scriptTree",
                        content: <Accordion
                            className="stretch"
                            sections={[
                                {
                                    id: "scriptSection",
                                    caption: "SCRIPTS",
                                    //dimmed: !isNil(editing),
                                    expanded: true,
                                    stretch: true,
                                    minSize: 100,
                                    content: scriptSectionContent,
                                    actions: [
                                        {
                                            icon: Codicon.Refresh,
                                            tooltip: "Reload the scripts",
                                            id: "refreshScriptList",
                                        },
                                    ],
                                },
                            ]}
                            onSectionAction={this.handleSectionAction}
                        />,
                        minSize: 200,
                        maxSize: 600,
                        initialSize: this.sidebarWidth,
                        snap: true,
                        resizable: true,
                        stretch: false,
                    },
                    {
                        id: "outputPane",
                        content: <SplitContainer
                            id="debuggerContent"
                            className="stretch"
                            orientation={Orientation.TopDown}
                            panes={[
                                this.outputPane,
                                this.inputPane,
                            ]}
                            onPaneResized={this.handlePaneResized}
                        />,
                        minSize: 500,
                        snap: false,
                        resizable: true,
                        stretch: true,
                    },
                ]}
                onPaneResized={this.handlePaneResized}
            />
        );
    }

    private handlePaneResized = (first: ISplitterPaneSizeInfo, second: ISplitterPaneSizeInfo): void => {
        if (first.paneId === "scriptTree") {
            this.sidebarWidth = first.size;
        } else if (second.paneId === "inputArea") {
            this.inputAreaHeight = second.size;
        }
    };

    private get outputPane(): ISplitterPane {
        const { toggleDisplayMode } = this.props;

        return {
            id: "messageOutput",
            content: <Container
                className="stretch"
                orientation={Orientation.TopDown}
            >
                <Toolbar>
                    <Icon src={Codicon.ListSelection} data-tooltip="Messages from shell backend and validation" />
                    <Label caption="Message" />
                    <Divider vertical={true} />
                    <Label caption="Tools:" />
                    <Button onClick={this.clearOutput}>
                        <Icon src={Codicon.ClearAll} />
                        <Label caption="Clear Output" />
                    </Button>
                    <Button
                        className="rightAlign"
                        imageOnly
                        data-tooltip="Toggle maximized/embedded mode"
                        onClick={toggleDisplayMode}
                    >
                        <Icon src={Codicon.ChromeRestore} data-tooltip="inherit" />
                    </Button>
                </Toolbar>
                <CodeEditor
                    ref={this.messageOutputRef}
                    state={this.outputState}
                    language="typescript"
                    lineNumbers="off"
                    lineDecorationsWidth={10}
                />
            </Container>,
            minSize: 200,
            resizable: true,
            stretch: true,
        };
    }

    private get inputPane(): ISplitterPane {
        const { activeInputTab, scriptTabs } = this.state;

        const pages = [
            {
                id: "interactiveTab",
                caption: "INPUT CONSOLE",
                tooltip: "REPL tab",

                content: this.renderInputScriptTab(this.inputState, true, false),
            },
            ...scriptTabs,
        ];

        return {
            id: "inputArea",
            content: <Tabview
                pages={pages}
                selectedId={activeInputTab}
                stretchTabs={false}
                onSelectTab={this.selectScriptTab}
            />,
            minSize: 200,
            initialSize: this.inputAreaHeight,
            resizable: true,
            stretch: false,
        };
    }

    private renderInputScriptTab = (state: IEditorPersistentState, addClearScriptButton: boolean,
        readonly: boolean): React.ReactNode => {
        return (
            <Container
                className="stretch"
                orientation={Orientation.TopDown}
            >
                <Toolbar>
                    <Button id={state.model.id} onClick={this.executeScript}>
                        <Icon src={Codicon.SymbolEvent} />
                        <Label caption="Execute Script" />
                    </Button>

                    {addClearScriptButton &&
                        <Button id={state.model.id} onClick={this.clearScript}>
                            <Icon src={Codicon.ClearAll} />
                            <Label caption="Clear Script" />
                        </Button>
                    }

                    <Button className="rightAlign" onClick={this.connect}>
                        <Icon src={connectedIcon} data-tooltip="inherit" />
                        <Label caption="Connect" />
                    </Button>
                    <Button onClick={this.disconnect}>
                        <Icon src={disconnectedIcon} data-tooltip="inherit" />
                        <Label caption="Disconnect" />
                    </Button>
                    <Button onClick={this.clearContext}>
                        <Icon src={Codicon.Debug} data-tooltip="inherit" />
                        <Label caption="Clear Context" />
                    </Button>
                </Toolbar>
                <CodeEditor
                    ref={this.inputRef}
                    state={state}
                    lineDecorationsWidth={10}
                    readonly={readonly}
                />
            </Container>
        );
    };

    private scriptTreeCellFormatter = (cell: Tabulator.CellComponent): string | HTMLElement => {
        const data = cell.getData() as IScriptTreeEntry;
        let icon;
        switch (data.type) {
            case ScriptTreeType.Script: {
                icon = <Icon src={Codicon.FileCode} width={20} height={20} />;
                break;
            }

            case ScriptTreeType.Folder: {
                // HACK: tabulator-tables provides no API to determine if a row is expanded, so we use internal
                // structures here, to get this information.
                const row = cell.getRow();
                // eslint-disable-next-line no-underscore-dangle, @typescript-eslint/no-explicit-any
                const treeInfo = (row as any)._row.modules.dataTree;
                icon = <Icon
                    src={treeInfo.open ? Codicon.FolderOpened : Codicon.Folder}
                    width={20}
                    height={20}
                />;

                break;
            }

            default: {
                icon = "";
                break;
            }
        }

        const host = document.createElement("span");
        host.className = "scriptTreeEntry";
        const content = <>
            {icon}
            <Label caption={data.name} />
        </>;

        render(content, host);

        return host;
    };

    private createEditorState(content: string): IEditorPersistentState {
        const state: IEditorPersistentState = {
            model: Monaco.createModel(content, "javascript") as ICodeEditorModel,
            viewState: null,
            options: defaultEditorOptions,
        };

        // We don't need the execution contexts in the debugger, but they are required to make overall handling easier.
        state.model.executionContexts = new ExecutionContexts(undefined, 80024, "", "");
        state.model.editorMode = CodeEditorMode.Standard;

        return state;
    }

    private handleSectionAction = (): void => {
        this.loadScripts();
    };

    private handleScriptTreeDoubleClick = (e: Event, cell: Tabulator.CellComponent): void => {
        const scriptEntry = cell.getData() as IScriptTreeEntry;
        if (!scriptEntry.fullPath) {
            // Double click on a folder -> ignore.
            return;
        }

        const { scriptTabs } = this.state;

        const name = scriptEntry.name;
        const tab = scriptTabs.find((candidate) => {
            return candidate.id === name;
        });

        if (!tab) {
            this.loadScript(scriptEntry.fullPath).then((script) => {
                const state = this.createEditorState(script);

                scriptTabs.push({
                    id: name,
                    caption: name,
                    tooltip: scriptEntry.fullPath,
                    auxillary: <Button
                        id={name}
                        className="closeButton"
                        round={true}
                        onClick={this.closeScriptTab}>
                        <Icon src={closeButton} />
                    </Button>,

                    content: this.renderInputScriptTab(state, false, true),
                });

                this.setState({ activeInputTab: name, scriptTabs });
            }).catch((e) => {
                void requisitions.execute("showError", ["Internal Error", String(e)]);
            });
        } else {
            this.setState({ activeInputTab: name });
        }
    };

    private selectScriptTab = (id: string): void => {
        this.setState({ activeInputTab: id });
    };

    private closeScriptTab = (e: React.SyntheticEvent, props: IComponentProperties): void => {
        e.stopPropagation();
        e.preventDefault();

        const { scriptTabs, activeInputTab } = this.state;

        let index = scriptTabs.findIndex((candidate) => { return candidate.id === props.id; });
        if (index > -1) {
            scriptTabs.splice(index, 1);

            // Select the tab which is located left to the one being closed, if the current one is being closed.
            let newSelection = activeInputTab;
            if (activeInputTab === props.id) {
                newSelection = "interactiveTab";
                if (--index > -1) {
                    newSelection = scriptTabs[index].id;
                }
            }
            this.setState({ scriptTabs, activeInputTab: newSelection });
        }
    };

    private loadScripts(): void {
        MessageScheduler.get.sendRequest(ProtocolGui.getRequestDebuggerGetScripts(), { messageClass: "getScripts" })
            .then((event: ICommDebuggerScriptsEvent) => {
                const scripts: IScriptTreeEntry[] = [];

                const recursivelyAddScript = (parts: string[], fullPath: string, parent: IScriptTreeEntry[]): void => {
                    const top = parts.shift();

                    if (top) {
                        let entry = parent.find((candidate) => { return candidate.name === top; });
                        if (!entry) {
                            const isScript = parts.length === 0;
                            entry = {
                                type: isScript ? ScriptTreeType.Script : ScriptTreeType.Folder,
                                id: top,
                                name: top,
                                fullPath: isScript ? fullPath : undefined,
                                children: [],
                            };
                            parent.push(entry);
                        }

                        if (parts.length > 0) {
                            recursivelyAddScript(parts, fullPath, entry.children!);
                        } else {
                            delete entry.children;
                        }
                    }
                };

                event.data?.scripts.forEach((entry: string) => {
                    const parts = entry.split("/");
                    if (parts.length > 0) {
                        recursivelyAddScript(parts, entry, scripts);
                    }
                });

                void this.scriptTreeRef.current?.setColumns([{
                    title: "",
                    field: "name",
                    resizable: false,
                    hozAlign: "left",
                    cellDblClick: this.handleScriptTreeDoubleClick,
                    formatter: this.scriptTreeCellFormatter,
                }]).then(() => {
                    void this.scriptTreeRef.current?.setData(scripts, SetDataAction.Set);
                });

            })
            .catch((event) => {
                void requisitions.execute("showError", ["Loading Debugger Scripts", String(event.message)]);
            });
    }

    /**
     * Loads the content of the script given by the path, if not done before.
     *
     * @param path The path of the script to load.
     * @returns A promise fulfilled when the script text is available.
     */
    private async loadScript(path: string): Promise<string> {
        return new Promise((resolve, reject) => {
            void (async (): Promise<void> => {
                const entry = this.scriptContent.get(path);
                if (entry) {
                    resolve(entry);
                } else {
                    let code;
                    MessageScheduler.get.sendRequest(ProtocolGui.getRequestDebuggerGetScriptContent(path),
                        { messageClass: "" })
                        .then((event: ICommScriptContentEvent) => {
                            code = event.data?.script;
                        });

                    let attempt = 0;
                    while (attempt++ < 10 && !code) {
                        await sleep(300);
                    }

                    if (code) {
                        this.scriptContent.set(path, code);
                        resolve(code);
                    } else {
                        reject("Couldn't retrieve script code within 3 seconds.");
                    }
                }
            })();
        });
    }

    private clearOutput = (): void => {
        if (this.messageOutputRef.current) {
            this.messageOutputRef.current.clear();
        }
    };


    private printOutput = (data: string, type = OutputType.Normal): void => {
        if (this.messageOutputRef.current) {
            const lastLineCount = this.outputState.model.getLineCount();

            this.messageOutputRef.current.appendText(data + "\n");

            let lineDecorationClass = "";
            let marginDecorationClass = "";
            switch (type) {
                case OutputType.Error: {
                    lineDecorationClass = "debuggerErrorOutput";
                    marginDecorationClass = "debuggerErrorMargin";
                    break;
                }

                case OutputType.Command: {
                    lineDecorationClass = "debuggerCommandOutput";
                    marginDecorationClass = "debuggerCommandMargin";

                    break;
                }

                default: {
                    break;
                }
            }

            if (lineDecorationClass.length > 0) {
                const editor = this.messageOutputRef.current.backend!;
                /*const decorations =*/ editor.deltaDecorations([], [
                    {
                        range: {
                            startLineNumber: lastLineCount,
                            startColumn: 1,
                            endLineNumber: this.outputState.model.getLineCount() - 2,
                            endColumn: 1,
                        },
                        options: {
                            isWholeLine: true,
                            className: lineDecorationClass,
                            glyphMarginClassName: marginDecorationClass,
                        },
                    },
                ]);

            }
        }
    };

    private executeScript = (e: React.SyntheticEvent, props: IComponentProperties): void => {
        const models = Monaco.getModels();
        const model = models.find((candidate) => { return candidate.id === props.id; });

        if (model) {
            // Temporarily make the environment known globally.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).ws = this.environment;

            const code = model.getValue();
            void this.loadReferencedScripts(code, new Set<string>()).then(() => {
                this.printOutput(code + "\n", OutputType.Command);

                try {
                    // TODO: investigate if we really need an async wrapper around the code.
                    strictEval("(async () => {" + code + "})()");
                } catch (error) {
                    if ((error as IDictionary).message) {
                        this.printOutput(`/* ERROR: ${(error as IDictionary).message as string} */\n`,
                            OutputType.Error);
                    } else {
                        this.printOutput(`/* ERROR: ${JSON.stringify(e, undefined, 4)} */\n`, OutputType.Error);
                    }
                } finally {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (window as any).ws = undefined;
                }
            });

        }
    };

    /**
     * Scans the given code to find `ws.execute` calls. For each found location the script content is loaded
     * and added to the internal script mapping, which has been set for the current connection, so it can
     * run the scripts when it encounters the execution calls.
     *
     * @param code The code to scan.
     * @param seen A set of script that have been parsed already.
     */
    private loadReferencedScripts = async (code: string, seen: Set<string>): Promise<void> => {
        const matches = code.matchAll(/ws\.execute\("(.+)"\)/g);
        for (const match of matches) {
            if (!seen.has(match[1])) {
                seen.add(match[1]);

                const script = await this.loadScript(match[1]);
                await this.loadReferencedScripts(script, seen);
            }
        }
    };

    private clearScript = (): void => {
        if (this.inputRef.current) {
            this.inputRef.current.clear();
        }
    };

    private connect = (): void => {
        if (MessageScheduler.get.isConnected) {
            this.printOutput("/* ERROR: You are already connected */\n\n", OutputType.Error);
        } else {
            void MessageScheduler.get.connect(new URL(window.location.href), "");
        }
    };

    private disconnect = (): void => {
        if (MessageScheduler.get.isConnected) {
            MessageScheduler.get.disconnect();
        } else {
            this.printOutput("/* ERROR: There's no connection open */\n\n", OutputType.Error);
        }
    };

    private clearContext = (): void => {
        MessageScheduler.get.clearState();
    };

    /**
     * Handles all triggered events that are requests or responses, except state and error responses.
     *
     * @param event The event that was triggered.
     */
    private handleEvent = (event: IDispatchEvent): void => {
        const debuggerValidate = event.context.messageClass === "debuggerValidate";

        switch (event.eventType) {
            case EventType.Request: {
                // A request sent to the server.
                const converted = convertCamelToSnakeCase(event.data as object);
                this.printOutput("ws.send(" + JSON.stringify(converted, undefined, 4) + ");\n", OutputType.Command);

                break;
            }

            default: {
                switch (event.context.messageClass) {
                    case "socketOpened": {
                        this.printOutput("ws.isConnected = true;\n");
                        break;
                    }

                    case "socketClosed": {
                        this.printOutput("ws.isConnected = false;\n");
                        break;
                    }

                    default: {
                        if (event.context.messageClass === "webSession") {
                            // "webSession" events are sent for each server response with a valid session UUID.
                            // So, technically they are sent many times. However, the message class is replaced by
                            // the one that was registered for a specific request sent to the server.
                            // That causes the "webSession" event class to appear only once (when a web session
                            // is established after authentication), not frequently.
                            this.loadScripts();
                        }

                        if (!debuggerValidate) {
                            // Don't print responses while doing a debugger validation run.
                            const converted = convertCamelToSnakeCase(event.data as object);
                            if (event.data.output) {
                                this.printOutput((event.data.output as string) + "\n");
                            } else {
                                this.printOutput("ws.lastResponse = " +
                                    JSON.stringify(converted, undefined, 4) + ";\n");
                            }
                        }

                        break;
                    }
                }

                break;
            }
        }
    };

}
