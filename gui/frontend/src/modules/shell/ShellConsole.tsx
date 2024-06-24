/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

import { type IPosition } from "monaco-editor";
import { ComponentChild, createRef } from "preact";

import { CodeEditor, IEditorPersistentState } from "../../components/ui/CodeEditor/CodeEditor.js";
import { IScriptExecutionOptions } from "../../components/ui/CodeEditor/index.js";
import { ComponentBase, IComponentProperties } from "../../components/ui/Component/ComponentBase.js";
import { StatusBarAlignment, type IStatusBarItem } from "../../components/ui/Statusbar/StatusBarItem.js";
import { StatusBar } from "../../components/ui/Statusbar/Statusbar.js";
import { ExecutionContext } from "../../script-execution/ExecutionContext.js";
import { PresentationInterface } from "../../script-execution/PresentationInterface.js";
import { requisitions } from "../../supplement/Requisitions.js";
import { Settings } from "../../supplement/Settings/Settings.js";
import { EditorLanguage } from "../../supplement/index.js";
import { EmbeddedPresentationInterface } from "../db-editor/execution/EmbeddedPresentationInterface.js";

interface IShellConsoleProperties extends IComponentProperties {
    editorState: IEditorPersistentState;

    onScriptExecution?: (context: ExecutionContext, options: IScriptExecutionOptions) => Promise<boolean>;
    onHelpCommand?: (command: string, currentLanguage: EditorLanguage) => string | undefined;
}

export class ShellConsole extends ComponentBase<IShellConsoleProperties> {

    private editorRef = createRef<CodeEditor>();

    #editorLanguageSbEntry!: IStatusBarItem;
    #editorEolSbEntry!: IStatusBarItem;
    #editorIndentSbEntry!: IStatusBarItem;
    #editorPositionSbEntry!: IStatusBarItem;

    public constructor(props: IShellConsoleProperties) {
        super(props);

        this.addHandledProperties("editorState", "onScriptExecution", "onHelpCommand");
    }

    public componentDidMount(): void {
        requisitions.register("editorCaretMoved", this.handleCaretMove);

        this.#editorPositionSbEntry = StatusBar.createStatusBarItem({
            id: "editorPosition",
            text: "",
            priority: 990,
            alignment: StatusBarAlignment.Right,
        });

        this.#editorIndentSbEntry = StatusBar.createStatusBarItem({
            id: "editorIndent",
            text: "",
            priority: 985,
            alignment: StatusBarAlignment.Right,
        });

        this.#editorEolSbEntry = StatusBar.createStatusBarItem({
            id: "editorEOL",
            text: "",
            priority: 980,
            alignment: StatusBarAlignment.Right,
        });

        this.#editorLanguageSbEntry = StatusBar.createStatusBarItem({
            id: "editorLanguage",
            text: "",
            priority: 975,
            alignment: StatusBarAlignment.Right,
        });

        this.updateStatusItems();
    }

    public componentDidUpdate(): void {
        this.updateStatusItems();
    }

    public componentWillUnmount(): void {
        requisitions.unregister("editorCaretMoved", this.handleCaretMove);

        this.#editorLanguageSbEntry.dispose();
        this.#editorIndentSbEntry.dispose();
        this.#editorPositionSbEntry.dispose();
        this.#editorEolSbEntry.dispose();

    }

    public render(): ComponentChild {
        const { editorState, onScriptExecution, onHelpCommand } = this.props;

        return (
            <CodeEditor
                ref={this.editorRef}
                savedState={editorState}
                language="msg"
                allowedLanguages={["javascript", "python", "sql"]}
                startLanguage={Settings.get("shellSession.startLanguage", "javascript") as EditorLanguage}
                sqlDialect="mysql"
                className="shellConsole"
                minimap={{
                    enabled: true,
                }}
                font={{
                    fontFamily: "var(--msg-monospace-font-family)",
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
                lineNumbers={this.contextRelativeLineNumbers}
                onScriptExecution={onScriptExecution}
                onHelpCommand={onHelpCommand}
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

    private handleCaretMove = (position: IPosition): Promise<boolean> => {
        this.updateStatusItems(position);

        return Promise.resolve(true);
    };

    private handleOptionsChanged = (): void => {
        this.updateStatusItems();
    };

    private updateStatusItems = (position?: IPosition): void => {
        if (this.editorRef.current) {
            const { editorState } = this.props;
            position ??= editorState.viewState?.cursorState[0].position;
            const language = editorState.model.getLanguageId() as EditorLanguage;

            this.#editorLanguageSbEntry.text = language;
            this.#editorEolSbEntry.text = editorState.options.defaultEOL || "LF";

            if (editorState.options.insertSpaces) {
                this.#editorIndentSbEntry.text = `Spaces: ${editorState.options.indentSize ?? 4}`;
            } else {
                this.#editorIndentSbEntry.text = `Tab Size: ${editorState.options.tabSize ?? 4}`;
            }

            this.#editorPositionSbEntry.text = `Ln ${position?.lineNumber ?? 1}, Col ${position?.column ?? 1}`;
        }
    };

    private createPresentation = (editor: CodeEditor, language: EditorLanguage): PresentationInterface => {
        return new EmbeddedPresentationInterface(editor.backend, editor.isScrolling, language);
    };

    /**
     * Computes custom line numbers, which are relative to an execution context.
     *
     * @param originalLineNumber The line number from Monaco.
     *
     * @returns The computed relative line number for the context at the original linenumber position.
     */
    private contextRelativeLineNumbers = (originalLineNumber: number): string => {
        const { editorState } = this.props;
        const contexts = editorState.model.executionContexts;
        const context = contexts?.contextFromPosition({ lineNumber: originalLineNumber, column: 1 });
        if (context) {
            if (context.endLine - context.startLine > 0) {
                return (originalLineNumber - context.startLine + 1).toString();
            } else {
                return "";
            }
        }

        return originalLineNumber.toString();
    };
}
