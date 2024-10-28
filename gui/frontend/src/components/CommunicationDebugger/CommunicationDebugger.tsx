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

import closeButton from "../../assets/images/close2.svg";
import connectedIcon from "../../assets/images/connected.svg";
import disconnectedIcon from "../../assets/images/disconnected.svg";
import "./CommunicationDebugger.css";

import typings from "./debugger-runtime.d.ts?raw";

import { ComponentChild, createRef, render } from "preact";
import { CellComponent } from "tabulator-tables";

import { ComponentBase, IComponentProperties, IComponentState, SelectionType } from "../ui/Component/ComponentBase.js";

import type { IDictionary } from "../../app-logic/general-types.js";
import { ExecutionContexts } from "../../script-execution/ExecutionContexts.js";
import type { IDebuggerData } from "../../supplement/RequisitionTypes.js";
import { requisitions } from "../../supplement/Requisitions.js";
import type { EditorLanguage } from "../../supplement/index.js";
import { strictEval } from "../../utilities/helpers.js";
import { CodeEditor, type ICodeEditorModel, type IEditorPersistentState } from "../ui/CodeEditor/CodeEditor.js";
import { CodeEditorMode, Monaco } from "../ui/CodeEditor/index.js";
import { CommunicationDebuggerEnvironment } from "./CommunicationDebuggerEnvironment.js";

import { MessageScheduler } from "../../communication/MessageScheduler.js";
import { ShellInterface } from "../../supplement/ShellInterface/ShellInterface.js";
import { Accordion } from "../ui/Accordion/Accordion.js";
import { Button } from "../ui/Button/Button.js";
import { CheckState, Checkbox } from "../ui/Checkbox/Checkbox.js";
import { Codicon } from "../ui/Codicon.js";
import { Container, Orientation } from "../ui/Container/Container.js";
import { Divider } from "../ui/Divider/Divider.js";
import { Icon } from "../ui/Icon/Icon.js";
import { Label } from "../ui/Label/Label.js";
import { SplitContainer, type ISplitterPane, type ISplitterPaneSizeInfo } from "../ui/SplitContainer/SplitContainer.js";
import { Tabview, type ITabviewPage } from "../ui/Tabview/Tabview.js";
import { Toolbar } from "../ui/Toolbar/Toolbar.js";
import { SetDataAction, TreeGrid, type ITreeGridOptions } from "../ui/TreeGrid/TreeGrid.js";
import { defaultEditorOptions } from "../ui/index.js";

enum ScriptTreeType {
    Folder,
    Script,
}

interface IScriptTreeEntry {
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

interface ICommunicationDebuggerProperties extends IComponentProperties {
    toggleDisplayMode: () => void;
}

interface ICommunicationDebuggerState extends IComponentState {
    /** Input area tabs. */
    activeInputTab: string;

    /** Tabs for each open test/debugger script. */
    scriptTabs: ITabviewPage[];
}

export class CommunicationDebugger
    extends ComponentBase<ICommunicationDebuggerProperties, ICommunicationDebuggerState> {

    private environment: CommunicationDebuggerEnvironment;

    private messageOutputRef = createRef<CodeEditor>();
    private inputRef = createRef<CodeEditor>();
    private scriptTreeRef = createRef<TreeGrid>();

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

        MessageScheduler.get.traceEnabled = false;
        requisitions.register("socketStateChanged", this.connectionStateChanged);
        requisitions.register("webSessionStarted", this.webSessionStarted);
        requisitions.register("debugger", this.handleTraceEvent);
        requisitions.register("message", this.logMessage);

        // In order to keep all text in the editor, even if the debugger is updated, we use 2 editor models.
        this.outputState = this.createEditorState("");
        this.inputState = this.createEditorState("");

        this.environment = new CommunicationDebuggerEnvironment(this.scriptContent);
    }

    public override componentDidMount(): void {
        if (MessageScheduler.get.isConnected) {
            this.loadScripts();
        }
    }

    public render(): ComponentChild {
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
                                    expanded: true,
                                    stretch: true,
                                    minSize: 100,
                                    content: scriptSectionContent,
                                    actions: [
                                        {
                                            icon: Codicon.Refresh,
                                            command: {
                                                tooltip: "Reload the scripts",
                                                command: "refreshScriptList",
                                                title: "Reload the scripts",
                                            },
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

    private handlePaneResized = (info: ISplitterPaneSizeInfo[]): void => {
        info.forEach((value) => {
            if (value.id === "scriptTree") {
                this.sidebarWidth = value.currentSize;
            } else if (value.id === "inputArea") {
                this.inputAreaHeight = value.currentSize;
            }
        });

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
                    <Label caption="Tools:" style={{ marginRight: "4px" }} />
                    <Checkbox
                        checkState={MessageScheduler.get.traceEnabled ? CheckState.Checked : CheckState.Unchecked}
                        onChange={this.changeTrace}
                        caption="Enable Trace"
                        data-tooltip="Enables logging all traffic" />
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
                    savedState={this.outputState}
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
        readonly: boolean): ComponentChild => {
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
                    savedState={state}
                    lineDecorationsWidth={10}
                    readonly={readonly}
                    extraLibs={[{ code: typings, path: "debugger" }]}
                />
            </Container>
        );
    };

    private scriptTreeCellFormatter = (cell: CellComponent): string | HTMLElement => {
        const data = cell.getData() as IScriptTreeEntry;
        let icon;
        switch (data.type) {
            case ScriptTreeType.Script: {
                icon = <Icon src={Codicon.FileCode} width={20} height={20} />;
                break;
            }

            case ScriptTreeType.Folder: {
                const row = cell.getRow();
                icon = <Icon
                    src={row.isTreeExpanded() ? Codicon.FolderOpened : Codicon.Folder}
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
        const model: ICodeEditorModel = Object.assign(Monaco.createModel(content, "javascript"), {
            executionContexts: new ExecutionContexts(),
            editorMode: CodeEditorMode.Standard,
        });

        const state: IEditorPersistentState = {
            model,
            viewState: null,
            options: defaultEditorOptions,
        };

        if (state.model.getEndOfLineSequence() !== Monaco.EndOfLineSequence.LF) {
            state.model.setEOL(Monaco.EndOfLineSequence.LF);
        } else {
            state.model.setValue(content);
        }

        // We don't need the execution contexts in the debugger, but they are required to make overall handling easier.
        state.model.executionContexts = new ExecutionContexts();
        state.model.editorMode = CodeEditorMode.Standard;

        return state;
    }

    private handleSectionAction = (): void => {
        this.loadScripts();
    };

    private handleScriptTreeDoubleClick = (e: Event, cell: CellComponent): void => {
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
                    auxiliary: <Button
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
                void requisitions.execute("showError", `Internal Error ${e}`);
            });
        } else {
            this.setState({ activeInputTab: name });
        }
    };

    private selectScriptTab = (id: string): void => {
        this.setState({ activeInputTab: id });
    };

    private closeScriptTab = (e: MouseEvent | KeyboardEvent, props: IComponentProperties): void => {
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
        ShellInterface.core.getDebuggerScriptNames().then((scriptNames) => {
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

            scriptNames.forEach((entry: string) => {
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

        }).catch((event) => {
            void requisitions.execute("showError", `Loading Debugger Scripts: , ${event.message}`);
        });
    }

    /**
     * Loads the content of the script given by the path, if not done before.
     *
     * @param path The path of the script to load.
     * @returns A promise fulfilled when the script text is available.
     */
    private async loadScript(path: string): Promise<string> {
        const entry = this.scriptContent.get(path);
        if (entry) {
            return entry;
        } else {
            const code = await ShellInterface.core.getDebuggerScriptContent(path);
            this.scriptContent.set(path, code);

            return code;
        }
    }

    private clearOutput = (): void => {
        if (this.messageOutputRef.current) {
            this.messageOutputRef.current.clear();
        }
    };


    private changeTrace = (checkState: CheckState): void => {
        MessageScheduler.get.traceEnabled = checkState === CheckState.Checked;

        this.forceUpdate();
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
                const editor = this.messageOutputRef.current.backend;
                /*const decorations =*/ editor?.getModel()?.deltaDecorations([], [
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

    private executeScript = (e: MouseEvent | KeyboardEvent, props: IComponentProperties): void => {
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
            void MessageScheduler.get.connect({ url: new URL(window.location.href) });
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
        // TODO: do we need to clear the context explicitly?
    };

    /**
     * Called when the connection state of the web socket changed.
     *
     * @param connected A flag indicating if the socket is connected or not.
     *
     * @returns A promise resolving to true.
     */
    private connectionStateChanged = (connected: boolean): Promise<boolean> => {
        if (connected) {
            this.printOutput("ws.isConnected = true;\n");
        } else {
            this.printOutput("ws.isConnected = false;\n");
        }

        return Promise.resolve(false);
    };

    /**
     * Called when a new web session was established, which we use as signal to (re)load our debugger scripts.
     *
     * @returns A promise resolving to true.
     */
    private webSessionStarted = (): Promise<boolean> => {
        this.loadScripts();

        return Promise.resolve(false);
    };

    /**
     * Handles all triggered events that are requests or responses, except state and error responses.
     *
     * @param data The details of the trace event.
     *
     * @returns A promise which resolves to true.
     */
    private handleTraceEvent = (data: IDebuggerData): Promise<boolean> => {
        const debuggerValidate = false; // TODO: event.context.messageClass === "debuggerValidate";

        if (data.request) {
            // A request sent to the server.
            this.printOutput(`ws.send(${JSON.stringify(data.request, undefined, 4)}); \n`, OutputType.Command);
        }

        if (data.response) {
            this.environment.lastResponse = data.response;

            const outputType = data.response.request_state.type === "ERROR"
                ? OutputType.Error
                : OutputType.Normal;

            // Don't print responses while doing a debugger validation run.
            if (!debuggerValidate) {
                this.printOutput(`ws.lastResponse = ${JSON.stringify(data.response, undefined, 4)}; `, outputType);
            }

        }

        return Promise.resolve(true);
    };

    /**
     * Log a message in the output and adds a line break.
     *
     * @param message The message to print.
     *
     * @returns A promise which resolves to true.
     */
    private logMessage = (message: string): Promise<boolean> => {
        this.printOutput((message) + "\n");

        return Promise.resolve(true);
    };

}
