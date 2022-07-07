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

import React from "react";
import { IPosition, Position } from "monaco-editor";

import {
    Component, Container, IComponentProperties, IComponentState, ISplitterPaneSizeInfo, Orientation, SplitContainer,
} from "../../components/ui";
import { IEditorStatusInfo, ISchemaTreeEntry } from ".";
import { ExecutionContext, PresentationInterface } from "../../script-execution";
import { StandalonePresentationInterface } from "./execution/StandalonePresentationInterface";
import { requisitions } from "../../supplement/Requisitions";
import { CodeEditor, IEditorPersistentState } from "../../components/ui/CodeEditor/CodeEditor";
import { EditorLanguage } from "../../supplement";

export interface IScriptEditorProperties extends IComponentProperties {
    editorState: IEditorPersistentState;

    onScriptExecution?: (context: ExecutionContext, params?: Array<[string, string]>,
        position?: IPosition) => Promise<boolean>;
    onEdit?: (id?: string) => void;
}

interface IScriptEditorState extends IComponentState {
    // These two fields are set via setState in the StandalonePresentationInterface.
    showResultPane: boolean;
    maximizeResultPane: boolean;
}

export class ScriptEditor extends Component<IScriptEditorProperties, IScriptEditorState> {

    private editorRef = React.createRef<CodeEditor>();
    private resultRef = React.createRef<HTMLDivElement>();

    private presentationInterface?: PresentationInterface;

    public constructor(props: IScriptEditorProperties) {
        super(props);

        this.state = {
            showResultPane: false,
            maximizeResultPane: false,
        };

        this.addHandledProperties("editorState", "onScriptExecution", "onEdit");
    }

    public componentDidMount(): void {
        requisitions.register("explorerDoubleClick", this.handleExplorerDoubleClick);

        this.sendStatusInfo();
    }

    public componentDidUpdate(): void {
        this.sendStatusInfo();
    }

    public componentWillUnmount(): void {
        void requisitions.execute("updateStatusbar", [
            { id: "editorLanguage", visible: false },
            { id: "editorIndent", visible: false },
            { id: "editorPosition", visible: false },
            { id: "editorEOL", visible: false },
        ]);

        requisitions.unregister("explorerDoubleClick", this.handleExplorerDoubleClick);
    }

    public render(): React.ReactNode {
        const { editorState, onScriptExecution } = this.props;
        const { showResultPane, maximizeResultPane } = this.state;

        const className = this.getEffectiveClassNames(["standaloneScriptHost"]);
        const resultPaneHeight = this.presentationInterface?.currentHeight ?? 300;

        return (
            <SplitContainer
                orientation={Orientation.TopDown}
                className={className}
                panes={[
                    {
                        id: "editorPane",
                        minSize: maximizeResultPane ? 0 : 200,
                        initialSize: maximizeResultPane ? 0 : undefined,
                        stretch: !maximizeResultPane,
                        resizable: showResultPane && !maximizeResultPane,
                        content: <CodeEditor
                            ref={this.editorRef}
                            state={editorState}
                            minimap={{
                                enabled: true,
                            }}
                            allowSoftWrap={true}
                            font={{
                                fontFamily: "SourceCodePro+Powerline+Awesome+MySQL",
                                fontSize: 15,
                                lineHeight: 24,
                            }}
                            scrollbar={{
                                useShadows: true,
                                verticalHasArrows: false,
                                horizontalHasArrows: false,
                                vertical: "auto",
                                horizontal: "auto",

                                verticalScrollbarSize: 16,
                                horizontalScrollbarSize: 16,
                            }}
                            onCursorChange={this.handleCursorChange}
                            onScriptExecution={onScriptExecution}
                            onModelChange={this.handleModelChange}
                            createResultPresentation={this.createPresentation}
                        />,
                    },
                    {
                        id: "resultPane",
                        minSize: showResultPane ? 200 : 0,
                        initialSize: showResultPane ? resultPaneHeight : 0,
                        stretch: maximizeResultPane,
                        content: <Container
                            innerRef={this.resultRef}
                            className="renderTarget"
                            orientation={Orientation.TopDown}
                        />,
                    },
                ]}
                onPaneResized={this.handlePaneResized}
            />
        );
    }

    public executeQuery(sql: string): void {
        this.editorRef.current?.appendText(sql);
    }

    /**
     * Inserts the given script into the current editor block, if that has the same language as that of the script
     * and if that block is empty.
     *
     * @param language The language of the script text.
     * @param script The text to insert.
     */
    public insertScriptText(language: EditorLanguage, script: string): void {
        if (this.editorRef.current) {
            const lastBlock = this.editorRef.current.lastExecutionBlock;
            if (!lastBlock || lastBlock.codeLength > 0 || lastBlock.language !== language) {
                this.editorRef.current.prepareNextExecutionBlock(-1, language);
            }

            this.editorRef.current.appendText(script);
            this.editorRef.current.focus();
        }
    }

    private handleCursorChange = (position: Position): void => {
        void requisitions.execute("updateStatusbar", [
            {
                id: "editorPosition",
                visible: true,
                text: `Ln ${position.lineNumber || 1}, Col ${position.column || 1}`,
            },
        ]);
    };

    private handleModelChange = (): void => {
        const { id, onEdit } = this.props;

        onEdit?.(id);
    };

    private handleExplorerDoubleClick = (entry: ISchemaTreeEntry): Promise<boolean> => {
        this.editorRef.current?.insertText(entry.caption);
        this.editorRef.current?.focus();

        return Promise.resolve(true);
    };

    private sendStatusInfo = (): void => {
        if (this.editorRef.current) {
            const { editorState } = this.props;
            const position = editorState.viewState?.cursorState[0].position;
            const language = editorState.model.getLanguageId() as EditorLanguage;

            const info: IEditorStatusInfo = {
                insertSpaces: editorState.options.insertSpaces,
                indentSize: editorState.options.indentSize ?? 4,
                tabSize: editorState.options.tabSize ?? 4,
                line: position?.lineNumber ?? 1,
                column: position?.column ?? 1,
                language,
                eol: editorState.options.defaultEOL || "LF",
            };

            void requisitions.execute("editorInfoUpdated", info);
        }
    };

    private createPresentation = (editor: CodeEditor, language: EditorLanguage): PresentationInterface => {
        this.presentationInterface = new StandalonePresentationInterface(this, editor, language, this.resultRef);

        return this.presentationInterface;
    };

    private handlePaneResized = (_first: ISplitterPaneSizeInfo, second: ISplitterPaneSizeInfo): void => {
        if (second.paneId === "resultPane" && this.presentationInterface) {
            this.presentationInterface.currentHeight = second.size;
        }
    };
}
