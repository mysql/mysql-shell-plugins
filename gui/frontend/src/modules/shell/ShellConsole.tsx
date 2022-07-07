/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

import { Component, IComponentProperties } from "../../components/ui";
import { CodeEditor, IEditorPersistentState } from "../../components/ui/CodeEditor/CodeEditor";
import { ExecutionContext, PresentationInterface } from "../../script-execution";
import { requisitions } from "../../supplement/Requisitions";
import { IEditorStatusInfo } from "../db-editor";
import { EmbeddedPresentationInterface } from "../db-editor/execution/EmbeddedPresentationInterface";
import { EditorLanguage } from "../../supplement";
import { settings } from "../../supplement/Settings/Settings";

export interface IShellConsoleProperties extends IComponentProperties {
    editorState: IEditorPersistentState;

    onScriptExecution?: (context: ExecutionContext, params?: Array<[string, string]>,
        position?: IPosition) => Promise<boolean>;
    onHelpCommand?: (command: string, currentLanguage: EditorLanguage) => string | undefined;
}

export class ShellConsole extends Component<IShellConsoleProperties> {

    private editorRef = React.createRef<CodeEditor>();

    public constructor(props: IShellConsoleProperties) {
        super(props);

        this.addHandledProperties("editorState", "onScriptExecution", "onHelpCommand");
    }

    public componentDidMount(): void {
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
    }

    public render(): React.ReactNode {
        const { editorState, onScriptExecution, onHelpCommand } = this.props;

        return (
            <CodeEditor
                ref={this.editorRef}
                state={editorState}
                language="msg"
                allowedLanguages={["javascript", "python", "sql"]}
                startLanguage={settings.get("shellSession.startLanguage", "javascript") as EditorLanguage}
                sqlDialect="mysql"
                className="shellConsole"
                minimap={{
                    enabled: true,
                }}
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
                lineNumbers="off"
                onScriptExecution={onScriptExecution}
                onHelpCommand={onHelpCommand}
                onCursorChange={this.handleCursorChange}
                onOptionsChanged={this.handleOptionsChanged}
                createResultPresentation={this.createPresentation}

                autoFocus
            />);
    }

    /**
     * Allows to send the given text through the code execution pipeline.
     *
     * @param text The content to execute.
     */
    public executeCommand = (text: string): void => {
        this.editorRef.current?.executeText(text);
    };

    private handleCursorChange = (position: Position): void => {
        const info: IEditorStatusInfo = {
            line: position.lineNumber,
            column: position.column,
        };

        void requisitions.execute("editorInfoUpdated", info);

    };

    private handleOptionsChanged = (): void => {
        if (this.editorRef.current) {
            const options = this.editorRef.current.options;
            const info: IEditorStatusInfo = {
                insertSpaces: options.insertSpaces,
                indentSize: options.indentSize ?? 4,
                tabSize: options.tabSize ?? 4,
            };

            void requisitions.execute("editorInfoUpdated", info);
        }
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
        return new EmbeddedPresentationInterface(editor, language);
    };
}
