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

import { IPosition, Position } from "monaco-editor";
import React from "react";

import { IDBDataEntry, IEditorStatusInfo, ISchemaTreeEntry, SchemaTreeType } from ".";
import { Component, IComponentProperties } from "../../components/ui";
import { CodeEditor, IEditorPersistentState } from "../../components/ui/CodeEditor/CodeEditor";
import { ExecutionContext, PresentationInterface, SQLExecutionContext } from "../../script-execution";
import { EditorLanguage } from "../../supplement";
import { requisitions } from "../../supplement/Requisitions";
import { settings } from "../../supplement/Settings/Settings";
import { DBType } from "../../supplement/ShellInterface";
import { quote } from "../../utilities/string-helpers";
import { EmbeddedPresentationInterface } from "./execution/EmbeddedPresentationInterface";

export interface INotebookProperties extends IComponentProperties {
    editorState: IEditorPersistentState;
    dbType: DBType;
    readOnly?: boolean;
    showAbout: boolean; // If true then show the about info text on first mount.

    onScriptExecution?: (context: ExecutionContext, params?: Array<[string, string]>,
        source?: IPosition | string) => Promise<boolean>;
    onHelpCommand?: (command: string, currentLanguage: EditorLanguage) => string | undefined;
}

export class Notebook extends Component<INotebookProperties> {

    private editorRef = React.createRef<CodeEditor>();

    public constructor(props: INotebookProperties) {
        super(props);

        this.addHandledProperties("editorState", "dbType", "readOnly", "showAbout", "onScriptExecution",
            "onHelpCommand");
    }

    public componentDidMount(): void {
        requisitions.register("explorerDoubleClick", this.explorerDoubleClick);
        requisitions.register("explorerShowRows", this.explorerShowRows);

        this.initialSetup();
        this.sendStatusInfo();
    }

    public componentDidUpdate(): void {
        this.initialSetup();
        this.sendStatusInfo();
    }

    public componentWillUnmount(): void {
        void requisitions.execute("updateStatusbar", [
            { id: "editorLanguage", visible: false },
            { id: "editorIndent", visible: false },
            { id: "editorPosition", visible: false },
            { id: "editorEOL", visible: false },
        ]);

        requisitions.unregister("explorerDoubleClick", this.explorerDoubleClick);
        requisitions.unregister("explorerShowRows", this.explorerShowRows);
    }

    public render(): React.ReactNode {
        const { editorState, dbType, readOnly, onScriptExecution, onHelpCommand } = this.props;

        let dialect;
        switch (dbType) {
            case DBType.MySQL: {
                dialect = "mysql";
                break;
            }

            case DBType.Sqlite: {
                dialect = "sql";
                break;
            }

            default: {
                break;
            }
        }

        return (
            <CodeEditor
                ref={this.editorRef}
                state={editorState}
                language="msg"
                allowedLanguages={["javascript", "typescript", "sql"]}
                sqlDialect={dialect}
                startLanguage={settings.get("dbEditor.startLanguage", "sql") as EditorLanguage}
                readonly={readOnly}
                allowSoftWrap={true}
                className="scriptingConsole"
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
            />);
    }

    public focus(): void {
        this.editorRef.current?.focus();
    }

    /**
     * Executes a single query with optional parameters and a link ID for external editors (like text editors
     * in VS code).
     *
     * @param sql The statement to execute.
     * @param params The parameters for that statement.
     * @param linkId The link ID, to connect the new execution context with the original text.
     */
    public executeQuery(sql: string, params?: Array<[string, string]>, linkId?: number): void {
        if (this.editorRef.current) {
            const { dbType } = this.props;

            const lastBlock = this.editorRef.current.lastExecutionBlock;
            let currentBlock;
            if (!lastBlock || lastBlock.codeLength > 0 || !lastBlock.isSQLLike) {
                currentBlock = this.editorRef.current.prepareNextExecutionBlock(-1,
                    dbType === DBType.MySQL ? "mysql" : "sql");
            } else {
                currentBlock = lastBlock;
            }

            if (currentBlock) {
                this.editorRef.current.appendText(sql);
                currentBlock.linkId = linkId;

                const { onScriptExecution } = this.props;
                void onScriptExecution?.(currentBlock, params, sql).then((executed) => {
                    if (executed && this.editorRef.current) {
                        this.editorRef.current.prepareNextExecutionBlock(-1, lastBlock?.language);
                        this.editorRef.current.focus();
                    }
                });

            }
        }
    }

    /**
     * Executes an entire script (possible multiple statements).
     *
     * @param script The script
     *
     * @returns A promise that resolves to true when the execution is fully triggered.
     */
    public executeScript(script: string): Promise<boolean> {
        return new Promise((resolve) => {
            if (this.editorRef.current) {
                const { dbType } = this.props;

                const lastBlock = this.editorRef.current.lastExecutionBlock;
                let currentBlock: ExecutionContext | undefined;
                if (!lastBlock || lastBlock.codeLength > 0 || !lastBlock.isSQLLike) {
                    currentBlock = this.editorRef.current.prepareNextExecutionBlock(-1,
                        dbType === DBType.MySQL ? "mysql" : "sql");
                } else {
                    currentBlock = lastBlock;
                }

                if (currentBlock instanceof SQLExecutionContext) {
                    const continueExecution = (id: string): Promise<boolean> => {
                        if (currentBlock && this.editorRef.current && id === currentBlock.id) {
                            requisitions.unregister("editorValidationDone", continueExecution);


                            const { onScriptExecution } = this.props;
                            void onScriptExecution?.(currentBlock).then(() => {
                                this.editorRef.current?.prepareNextExecutionBlock(-1, lastBlock?.language);
                                this.editorRef.current?.focus();

                                resolve(true); // For the outer promise, which is a pending requisition call.
                            });

                            return Promise.resolve(true);
                        }

                        resolve(false);

                        return Promise.resolve(false);
                    };

                    requisitions.register("editorValidationDone", continueExecution);
                    this.editorRef.current.appendText(script);
                }
            }
        });
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
        const info: IEditorStatusInfo = {
            line: position.lineNumber,
            column: position.column,
        };

        void requisitions.execute("editorInfoUpdated", info);

    };

    private explorerDoubleClick = (entry: ISchemaTreeEntry): Promise<boolean> => {
        this.editorRef.current?.insertText(entry.caption);
        this.editorRef.current?.focus();

        return Promise.resolve(true);
    };

    private explorerShowRows = (entry: ISchemaTreeEntry | IDBDataEntry): Promise<boolean> => {
        if ("qualifiedName" in entry) {
            const schema = entry.qualifiedName.schema;
            const table = entry.qualifiedName.table;

            let sql;

            const tableName = `${quote(schema)}.${quote(table ?? "")}`;
            const uppercaseKeywords = settings.get("dbEditor.upperCaseKeywords", true);
            const select = uppercaseKeywords ? "SELECT" : "select";
            const from = uppercaseKeywords ? "FROM" : "from";
            if (entry.type === SchemaTreeType.Column) {
                sql = `${select} ${tableName}.${quote(entry.qualifiedName.name ?? "")} ${from} ${tableName}`;
            } else {
                sql = `${select} * ${from} ${tableName}`;
            }

            this.executeQuery(sql);

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
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

    private initialSetup(): void {
        const { editorState, showAbout } = this.props;
        const version = editorState.model.getVersionId();
        if (version === 1 && showAbout) {
            // If there was never a change in the editor so far it means that this is the first time it is shown.
            // In this case we can run our one-time initialization.
            this.editorRef.current?.executeText("\\about");
        }
    }
}
