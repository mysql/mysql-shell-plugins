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

import { IPosition } from "monaco-editor";
import ts, {
    CompletionEntryDetails, CompletionInfo, DefinitionInfo, QuickInfo, ReferenceEntry, RenameLocation,
    SignatureHelpItems,
    TextChange,
} from "typescript";

import {
    CompletionItem, CompletionList, Definition, DocumentHighlight, FormattingOptions, Hover, IRange,
    languages, Location, Monaco, ParameterInformation, Range, SignatureHelp,
    SignatureHelpResult, SignatureInformation, TextEdit, TypeScriptWorker, Uri, WorkspaceEdit, WorkspaceTextEdit,
} from "../components/ui/CodeEditor";
import { CodeEditorMode, ICodeEditorModel } from "../components/ui/CodeEditor/CodeEditor";
import { ExecutionContext } from "./ExecutionContext";
import { SQLExecutionContext } from "./SQLExecutionContext";
import {
    DiagnosticSeverity, IDiagnosticEntry, ILanguageWorkerQueryPreprocessData, ILanguageWorkerApplySemicolonData,
    ILanguageWorkerInfoData, ILanguageWorkerParameterData, ILanguageWorkerQueryTypeData, ILanguageWorkerResultData,
    ILanguageWorkerSplitData, ILanguageWorkerValidateData, IParserErrorInfo, IStatementSpan, QueryType,
    ServiceLanguage, StatementFinishState,
} from "../parsing/parser-common";

import { MySQLLanguageService } from "../parsing/mysql/MySQLLanguageService";
import { SQLiteLanguageService } from "../parsing/SQLite/SQLiteLanguageService";
import { PythonLanguageService } from "../parsing/python/PythonLanguageServices";

import { isWhitespaceOnly } from "../utilities/string-helpers";

import { LanguageWorkerPool } from "../parsing/worker/LanguageWorkerPool";
import { IShellEditorModel } from "../modules/shell";
import { IDictionary } from "../app-logic/Types";

/** Provides language services like code completion, by reaching out to built-in or other sources. */
export class ScriptingLanguageServices {

    private static services: ScriptingLanguageServices;

    private readonly workerPool: LanguageWorkerPool;

    private mysqlService: MySQLLanguageService;
    private sqliteService: SQLiteLanguageService;
    private pythonService: PythonLanguageService;

    // A simple cache to avoid running requests against the shell for every keypress.
    private lastShellCompletions: CompletionItem[] = [];

    /**
     * We are using a singleton pattern here, so make the constructor non-accessible.
     */
    private constructor() {
        this.workerPool = new LanguageWorkerPool();

        this.mysqlService = new MySQLLanguageService(this.workerPool);
        this.sqliteService = new SQLiteLanguageService(this.workerPool);
        this.pythonService = new PythonLanguageService(this.workerPool);
    }

    public static get instance(): ScriptingLanguageServices {
        if (!ScriptingLanguageServices.services) {
            ScriptingLanguageServices.services = new ScriptingLanguageServices();
        }

        return ScriptingLanguageServices.services;
    }

    /**
     * Returns a list of suggestion items, depending on the language of the execution block the caret is in.
     *
     * @param context Provides access to source code specific aspects.
     * @param position The caret position (line/column) in the full editor model.
     *
     * @returns A suggestion list.
     */
    public async getCodeCompletionItems(context: ExecutionContext,
        position: IPosition): Promise<CompletionList | undefined> {
        const localPosition = context.toLocal(position);
        const model = context.model as ICodeEditorModel;

        switch (context.language) {
            case "javascript":
            case "typescript": {
                const worker = await this.workerForLanguage(context.language);
                const service = await worker(model.uri);
                const offset = model.getOffsetAt(localPosition);

                const completions: CompletionInfo =
                    await service.getCompletionsAtPosition(model.uri.toString(), offset);
                const suggestions: CompletionItem[] = [];
                const info = model.getWordUntilPosition(localPosition);
                const replaceRange: IRange = {
                    startLineNumber: position.lineNumber,
                    startColumn: info.startColumn,
                    endLineNumber: position.lineNumber,
                    endColumn: info.endColumn,
                };

                if (completions) {
                    completions.entries.forEach((entry) => {
                        suggestions.push({
                            label: entry.name,
                            kind: this.convertKind(entry.kind),
                            range: replaceRange,
                            insertText: entry.insertText || entry.name,
                        });
                    });
                }

                // See if we also need additional items from the shell backend.
                if (model.editorMode === CodeEditorMode.Terminal) {
                    if (info.word.length > 1) {
                        // User typing ongoing. Use was we retrieved on last fresh word start.
                        suggestions.push(...this.lastShellCompletions);

                        return { incomplete: false, suggestions };
                    } else {
                        const session = (model as IShellEditorModel).session;
                        if (session) {
                            const content = model.getValue();

                            const shellSuggestions: CompletionItem[] = [];
                            const items = await session.getCompletionItems(content, offset);
                            items.forEach((entry) => {
                                entry.options?.forEach((option) => {
                                    let kind = languages.CompletionItemKind.Field;
                                    if (option.endsWith("()")) {
                                        kind = languages.CompletionItemKind.Function;
                                    }

                                    shellSuggestions.push({
                                        label: option,
                                        kind,
                                        range: replaceRange,
                                        insertText: option,
                                    });
                                });
                            });

                            this.lastShellCompletions = shellSuggestions;
                            suggestions.push(...shellSuggestions);

                            return { incomplete: false, suggestions };
                        }
                    }
                } else {
                    return { incomplete: false, suggestions };
                }

                break;
            }

            case "sql": {
                return this.sqliteService.getCodeCompletionItems(context as SQLExecutionContext, localPosition);
            }

            case "mysql": {
                return this.mysqlService.getCodeCompletionItems(context as SQLExecutionContext, localPosition);
            }

            default:
        }
    }

    /**
     * The second step of code completion (if completion items are not fully resolved in the first step).
     *
     * @param context Provides access to source code specific aspects.
     * @param item The item to finish.
     *
     * @returns The updated item.
     */
    public async resolve(context: ExecutionContext, item: CompletionItem): Promise<CompletionItem | undefined> {
        const model = context.model;

        switch (context.language) {
            case "javascript":
            case "typescript": {
                if (!model || model.isDisposed()) {
                    return item;
                }

                const worker = await this.workerForLanguage(context.language);
                const service = await worker(model.uri);
                const range = item.range as IRange;
                const offset = model.getOffsetAt({ lineNumber: range.endLineNumber, column: range.endColumn });
                const label = typeof item.label === "string" ? item.label : item.label.label;

                const details: CompletionEntryDetails =
                    await service.getCompletionEntryDetails(model.uri.toString(), offset, label);
                if (details) {
                    // For some unknown reason is the detail part not allowed to be a Markdown,
                    // string, but we need syntax highlighting for the code part (in displayParts).
                    // So swap the entries here (as the documentation is allowed to contain
                    // Markdown).
                    item.documentation = {
                        value: "```ts\n" + ts.displayPartsToString(details.displayParts) + "\n```",
                    };
                    item.detail = ts.displayPartsToString(details.documentation);
                }

                return item;
            }

            default: {
                return item;
            }
        }
    }

    /**
     * Returns a hover entry for the item at the current mouse position.
     *
     * @param  context Provides access to source code specific aspects.
     * @param position The caret position (line/column) in the full editor model.
     *
     * @returns A hover entry with details about the symbol at the cursor position.
     */
    public async getHover(context: ExecutionContext, position: IPosition): Promise<Hover | undefined> {
        position = context.toLocal(position);
        const model = context.model;
        if (!model || model.isDisposed()) {
            return;
        }

        switch (context.language) {
            case "javascript":
            case "typescript": {
                const worker = await this.workerForLanguage(context.language);
                const service = await worker(model.uri);
                const offset = model.getOffsetAt(position);
                const info: QuickInfo = await service.getQuickInfoAtPosition(model.uri.toString(), offset);
                if (info) {
                    return {
                        range: context.fromLocal(info.textSpan) as Range,
                        contents: [
                            { value: "```ts\n" + ts.displayPartsToString(info.displayParts) + "\n```" },
                            { value: ts.displayPartsToString(info.documentation) },
                        ],
                    };
                }

                return;
            }

            case "sql":
            case "mysql": {
                const sqlContext = context as SQLExecutionContext;
                const statement = sqlContext.getStatementAtPosition(position);
                if (statement) {
                    const start = model.getOffsetAt({ lineNumber: statement.line, column: statement.column });

                    return new Promise((resolve) => {
                        const infoData: ILanguageWorkerInfoData = {
                            language: context.language === "sql" ? ServiceLanguage.Sqlite : ServiceLanguage.MySQL,
                            api: "info",
                            version: sqlContext.dbVersion,
                            sql: statement.text,
                            offset: model.getOffsetAt(position) - start,
                        };

                        void this.workerPool.runTask(infoData)
                            .then((taskId: number, result: ILanguageWorkerResultData): void => {
                                const info = result.info;
                                if (info?.description && info?.definition) {
                                    resolve({
                                        contents: info.description.map((value: string) => {
                                            return {
                                                value, isTrusted: true, supportThemeIcons: true,
                                            };
                                        }),
                                    });
                                } else {
                                    resolve(undefined);
                                }
                            });
                    });
                }

                break;
            }

            default:
        }
    }

    /**
     * Runs syntactic and semantic checks for the text in the context.
     *
     * @param context Provides access to source code specific aspects.
     * @param statement Used for SQL-like languages. It's a specific statement within the context.
     * @param callback A function to be triggered for found diagnostics. Can be called more than once.
     */
    public validate = async (context: ExecutionContext, statement: string,
        callback: (result: IDiagnosticEntry[]) => void): Promise<void> => {

        if (context.isInternal) {
            return;
        }

        switch (context.language) {
            case "javascript":
            case "typescript": {
                const model = context.model;
                if (model && !model.isDisposed()) {
                    // Manual JS/TS validation is only necessary for a mixed language editor.
                    const worker = await this.workerForLanguage(context.language);
                    const service = await worker(model.uri);
                    if (!model.isDisposed()) {
                        const result: IDiagnosticEntry[] = [];
                        const syntaxDiagnostics = await service.getSyntacticDiagnostics(model.uri.toString());
                        syntaxDiagnostics.forEach((value) => {
                            result.push({
                                span: {
                                    start: value.start || 0,
                                    length: value.length || 0,
                                },
                                severity: value.category,
                                source: "Shell GUI",
                                message: ts.flattenDiagnosticMessageText(value.messageText, "\n"),
                            });
                        });

                        const semanticDiagnostics = await service.getSemanticDiagnostics(model.uri.toString());
                        semanticDiagnostics.forEach((value) => {
                            result.push({
                                span: {
                                    start: value.start || 0,
                                    length: value.length || 0,
                                },
                                severity: value.category,
                                source: "Shell GUI",
                                message: ts.flattenDiagnosticMessageText(value.messageText, "\n"),
                            });
                        });

                        callback(result);
                    }
                }

                break;
            }

            case "sql":
            case "mysql": {
                const sqlContext = context as SQLExecutionContext;

                const validationData: ILanguageWorkerValidateData = {
                    language: context.language === "sql" ? ServiceLanguage.Sqlite : ServiceLanguage.MySQL,
                    api: "validate",
                    version: sqlContext.dbVersion,
                    sql: statement,
                    sqlMode: sqlContext.sqlMode,
                    offset: 0,
                };

                this.workerPool.runTask(validationData)
                    .then((taskId: number, validationResult: ILanguageWorkerResultData): void => {
                        const errors = validationResult.content as IParserErrorInfo[];
                        const diagnostics: IDiagnosticEntry[] = [];

                        errors.forEach((error: IParserErrorInfo) => {
                            diagnostics.push({
                                span: {
                                    start: error.charOffset,
                                    length: error.length,
                                },
                                severity: DiagnosticSeverity.Error,
                                source: "Shell GUI",
                                message: error.message,
                            });
                        });
                        callback(diagnostics);
                    });

                break;
            }

            default:
        }
    };

    /**
     * Returns information about parameters in a function call.
     *
     * @param context The context wrapping the relevant editor part for this invocation.
     * @param position The caret position (line/column) in the full editor model.
     *
     * @returns A list of diagnostic records each describing a problem in the code (if any).
     */
    public async getSignatureHelp(context: ExecutionContext,
        position: IPosition): Promise<SignatureHelpResult | undefined> {
        position = context.toLocal(position);
        const model = context.model;
        if (!model || model.isDisposed()) {
            return;
        }

        switch (context.language) {
            case "javascript":
            case "typescript": {
                const worker = await this.workerForLanguage(context.language);
                const service = await worker(model.uri);
                const offset = model.getOffsetAt(position);
                const signHelp: SignatureHelpItems =
                    await service.getSignatureHelpItems(model.uri.toString(), offset, {});
                if (signHelp) {
                    const helpEntries: SignatureHelp = {
                        activeSignature: signHelp.selectedItemIndex,
                        activeParameter: signHelp.argumentIndex,
                        signatures: [],
                    };
                    signHelp.items.forEach((item) => {
                        const signature: SignatureInformation = {
                            label: "",
                            documentation: undefined,
                            parameters: [],
                        };

                        signature.label += ts.displayPartsToString(item.prefixDisplayParts);
                        item.parameters.forEach((parameter, index, array) => {
                            const label = ts.displayPartsToString(parameter.displayParts);
                            const info: ParameterInformation = {
                                label,
                                documentation: ts.displayPartsToString(parameter.documentation),
                            };
                            signature.label += label;
                            signature.parameters.push(info);
                            if (index < array.length - 1) {
                                signature.label +=
                                    ts.displayPartsToString(item.separatorDisplayParts);
                            }
                        });
                        signature.label += ts.displayPartsToString(item.suffixDisplayParts);
                        helpEntries.signatures.push(signature);
                    });

                    return {
                        value: helpEntries,
                        dispose: () => { /* nothing to do */ },
                    };
                }

                break;
            }

            default:
        }
    }

    /**
     * Provides a set of document highlights, like all occurrences of a variable or all exit-points of a function.
     *
     * @param context The context wrapping the relevant editor part for this invocation.
     * @param position The caret position (line/column) in the full editor model.
     *
     * @returns A list of document highlights.
     */
    public async findDocumentHighlight(context: ExecutionContext,
        position: IPosition): Promise<DocumentHighlight[] | undefined> {
        position = context.toLocal(position);
        const model = context.model;
        if (!model || model.isDisposed()) {
            return;
        }

        switch (context.language) {
            case "javascript":
            case "typescript": {
                const worker = await this.workerForLanguage(context.language);
                const service = await worker(model.uri);
                const offset = model.getOffsetAt(position);
                const occurrences: readonly ReferenceEntry[] | undefined =
                    await service.getOccurrencesAtPosition(model.uri.toString(), offset);

                const result: DocumentHighlight[] = [];
                for (const entry of occurrences || []) {
                    result.push({
                        range: context.fromLocal(entry.textSpan) as Range,
                        kind: entry.isWriteAccess
                            ? languages.DocumentHighlightKind.Write
                            : languages.DocumentHighlightKind.Read,
                    });
                }

                return result;
            }

            default:
        }
    }

    /**
     * Determines locations for a rename operation
     *
     * @param context The context wrapping the relevant editor part for this invocation.
     * @param position The caret position (line/column) in the full editor model.
     *
     * @param newName The new name of the entity.
     * @returns A workspace edit with a list of edits..
     */
    public async getRenameLocations(context: ExecutionContext, position: IPosition,
        newName: string): Promise<WorkspaceEdit | undefined> {
        position = context.toLocal(position);
        const model = context.model;
        if (!model || model.isDisposed()) {
            return;
        }

        switch (context.language) {
            case "javascript":
            case "typescript": {
                const worker = await this.workerForLanguage(context.language);
                const service = await worker(model.uri);
                const offset = model.getOffsetAt(position);
                const locations: readonly RenameLocation[] | undefined =
                    await service.findRenameLocations(model.uri.toString(), offset, false, true, false);

                const edits: WorkspaceTextEdit[] = [];
                for (const entry of locations || []) {
                    edits.push({
                        resource: model.uri,
                        modelVersionId: model.getVersionId(),
                        edit: { range: context.fromLocal(entry.textSpan) as Range, text: newName },
                    });
                }

                return { edits };
            }

            default:
        }
    }

    /**
     * Provides information for the peek definition feature.
     *
     * @param context The context wrapping the relevant editor part for this invocation.
     * @param position The caret position (line/column) in the full editor model.
     *
     * @returns Definition info.
     */
    public async findDefinition(context: ExecutionContext, position: IPosition): Promise<Definition | undefined> {
        position = context.toLocal(position);
        const model = context.model;
        if (!model || model.isDisposed()) {
            return;
        }

        switch (context.language) {
            case "javascript":
            case "typescript": {
                const worker = await this.workerForLanguage(context.language);
                const service = await worker(model.uri);
                const offset = model.getOffsetAt(position);
                const name = model.uri.toString(); // Not a filename, but close enough.
                const definition: readonly DefinitionInfo[] | undefined =
                    await service.getDefinitionAtPosition(name, offset);

                if (definition) {
                    return definition.filter((d) => {
                        return d.fileName === name;
                    }).map((d) => {
                        return { uri: model.uri, range: context.fromLocal(d.textSpan) as Range };
                    });
                }

                break;
            }

            default:
        }
    }

    /**
     * Provides information for the peek references feature.
     *
     * @param context The context wrapping the relevant editor part for this invocation.
     * @param position The caret position (line/column) in the full editor model.
     *
     * @returns Location info for references.
     */
    public async findReferences(context: ExecutionContext, position: IPosition): Promise<Location[] | undefined> {
        position = context.toLocal(position);
        const model = context.model;
        if (!model || model.isDisposed()) {
            return;
        }

        switch (context.language) {
            case "javascript":
            case "typescript": {
                const worker = await this.workerForLanguage(context.language);
                const service = await worker(model.uri);
                const offset = model.getOffsetAt(position);
                const name = model.uri.toString(); // Not a filename, but close enough.
                const references: ReferenceEntry[] | undefined =
                    await service.getReferencesAtPosition(name, offset);
                if (references) {
                    return references.filter((d) => {
                        return d.fileName === name;
                    }).map((d) => {
                        return {
                            uri: model.uri,
                            range: context.fromLocal(d.textSpan) as Range,
                        };
                    });
                }

                break;
            }

            default:
        }
    }

    /**
     * Generates a list of edit actions to format the current source code.
     *
     * @param context The context wrapping the relevant editor part for this invocation.
     * @param range The range in which to format code.
     * @param formatParams General formatting options.
     * @param formatterSettings Any custom setting.
     *
     * @returns A list of edits.
     */
    public async format(context: ExecutionContext, range: Range, formatParams: FormattingOptions,
        formatterSettings = {}): Promise<TextEdit[] | undefined> {
        const model = context.model;
        if (!model || model.isDisposed()) {
            return;
        }

        const initialIndentLevel = this.computeInitialIndent(model, range, formatParams);
        const formatSettings = this.convertOptions(formatParams, formatterSettings, initialIndentLevel);
        const start = model.getOffsetAt({ lineNumber: range.startLineNumber, column: range.startColumn });
        let end = model.getOffsetAt({ lineNumber: range.endLineNumber, column: range.endColumn });
        let lastLineRange: Range | undefined;
        if (range.endLineNumber > range.startLineNumber
            && (range.endColumn === 0
                || isWhitespaceOnly(model.getValue().substr(end - range.endColumn, range.endColumn),
                ))) {
            end -= range.endColumn;
            lastLineRange = new Range(range.endLineNumber, 0, range.endLineNumber, range.endColumn);
        }

        switch (context.language) {
            case "javascript":
            case "typescript": {
                const worker = await this.workerForLanguage(context.language);
                const service = await worker(model.uri);
                const edits: TextChange[] | undefined =
                    await service.getFormattingEditsForRange(model.uri.toString(), start, end, formatSettings);

                if (edits) {
                    const result = [];
                    for (const edit of edits) {
                        if (edit.span.start >= start && edit.span.start + edit.span.length <= end) {
                            result.push({
                                range: context.fromLocal(edit.span) as Range,
                                text: edit.newText,
                            });
                        }
                    }

                    if (lastLineRange) {
                        result.push({
                            range: lastLineRange,
                            text: this.generateIndent(initialIndentLevel, formatParams),
                        });
                    }

                    return result;
                }

                break;
            }

            default:
        }
    }

    /**
     * Some languages (namely MySQL + SQLite) require to split multi statements into single ones to execute them.
     * This method determines the ranges of all statements in a source text.
     *
     * @param context Provides access to source code specific aspects.
     * @param delimiter The initial delimiter to use for splitting.
     * @param callback A function to be triggered for found diagnostics. Can be called more than once.
     * @param code If provided then split this code instead of the context content.
     */
    public determineStatementRanges = (context: ExecutionContext, delimiter: string,
        callback: (result: IStatementSpan[]) => void, code?: string): void => {
        switch (context.language) {
            case "javascript":
            case "typescript": {
                callback([{
                    delimiter: "", // Not used actually.
                    span: {
                        start: 0,
                        length: code ? code.length : context.codeLength,
                    },
                    contentStart: 0,
                    state: StatementFinishState.Complete, // Not used either.
                }]);
                break;
            }

            case "sql":
            case "mysql": {
                const sql = code ?? context.code;
                const splitData: ILanguageWorkerSplitData = {
                    language: context.language === "sql" ? ServiceLanguage.Sqlite : ServiceLanguage.MySQL,
                    api: "split",
                    sql,
                    delimiter,
                };

                this.workerPool.runTask(splitData)
                    .then((taskId: number, splitResult: ILanguageWorkerResultData): void => {
                        callback(splitResult.content as IStatementSpan[]);
                    });

                break;
            }

            default:
        }
    };

    /**
     * Does a very quick scan of the query to identify its type.
     *
     * @param context Provides access to source code specific aspects.
     * @param sql The query to scan.
     *
     * @returns A promise that resolves to the type of the query.
     */
    public determineQueryType = async (context: ExecutionContext, sql: string): Promise<QueryType> => {
        return new Promise((resolve) => {
            const sqlContext = context as SQLExecutionContext;
            const queryTypeData: ILanguageWorkerQueryTypeData = {
                language: context.language === "sql" ? ServiceLanguage.Sqlite : ServiceLanguage.MySQL,
                api: "queryType",
                sql,
                version: sqlContext.dbVersion,
            };

            this.workerPool.runTask(queryTypeData)
                .then((taskId: number, result: ILanguageWorkerResultData): void => {
                    resolve(result.queryType || QueryType.Unknown);
                });
        });
    };

    /**
     * Parses the query to see if it is valid and applies a number of transformations, depending on the parameters:
     * - If there's no top-level limit clause, then one is added.
     * - If indicated adds an optimizer hint to use the secondary engine (usually HeatWave).
     *
     * @param context Provides access to source code specific aspects.
     * @param sql The query to check and modify.
     * @param offset The limit offset to add.
     * @param count The row count value to add.
     * @param forceSecondaryEngine Add the optimizer hint.
     *
     * @returns The rewritten query if the original query is error free and contained no top-level LIMIT clause.
     *          Otherwise the original query is returned.
     */
    public preprocessStatement = async (context: ExecutionContext, sql: string, offset: number,
        count: number, forceSecondaryEngine?: boolean): Promise<[string, boolean]> => {
        return new Promise((resolve, reject) => {
            const sqlContext = context as SQLExecutionContext;
            const applyLimitsData: ILanguageWorkerQueryPreprocessData = {
                language: context.language === "sql" ? ServiceLanguage.Sqlite : ServiceLanguage.MySQL,
                api: "preprocessStatement",
                sql,
                offset,
                count,
                forceSecondaryEngine,
                version: sqlContext.dbVersion,
                sqlMode: sqlContext.sqlMode,
            };

            this.workerPool.runTask(applyLimitsData).then((taskId: number, result: ILanguageWorkerResultData): void => {
                resolve([result.query ?? sql, result.changed ?? false]);
            }).catch((taskId, reason) => {
                reject(reason);
            });
        });
    };

    /**
     * Parses the query to see if it contains a ending semicolon (keep in mind there can be a trailing comment).
     * If no semicolon exists one is added.
     *
     * @param context Provides access to source code specific aspects.
     * @param sql The query to check and modify.
     *
     * @returns The rewritten query if the original query is error free and contained no final semicolon.
     *          Otherwise the original query is returned.
     */
    public checkAndAddSemicolon = async (context: ExecutionContext, sql: string): Promise<[string, boolean]> => {
        return new Promise((resolve, reject) => {
            const sqlContext = context as SQLExecutionContext;
            const applySemicolonData: ILanguageWorkerApplySemicolonData = {
                language: context.language === "sql" ? ServiceLanguage.Sqlite : ServiceLanguage.MySQL,
                api: "addSemicolon",
                sql,
                version: sqlContext.dbVersion,
                sqlMode: sqlContext.sqlMode,
            };

            this.workerPool.runTask(applySemicolonData)
                .then((taskId: number, result: ILanguageWorkerResultData): void => {
                    resolve([result.query ?? sql, result.changed ?? false]);
                }).catch((taskId, reason) => {
                    reject(reason);
                });
        });
    };

    /**
     * Examines the given query text if there are embedded parameters. Currently that's used only for MySQL code.
     * (like in `select * from actor where actor_id = ? /*=1* /`)
     *
     * @param sql The query to examine.
     * @param version The server version to be used for lexing.
     * @param sqlMode The SQL mode for lexing.
     *
     * @returns The list of found parameters.
     */
    public extractQueryParameters = async (sql: string, version: number,
        sqlMode: string): Promise<Array<[string, string]>> => {
        return new Promise((resolve) => {
            const queryData: ILanguageWorkerParameterData = {
                language: ServiceLanguage.MySQL,
                api: "parameters",
                version,
                sql,
                sqlMode,
            };

            this.workerPool.runTask(queryData)
                .then((taskId: number, result: ILanguageWorkerResultData): void => {
                    resolve(result.parameters || []);
                });
        });
    };

    /**
     * Converts the symbol kind returned from the TS language server to the Monaco completion item kind.
     *
     * @param kind The item kind to convert.
     *
     * @returns The Monaco completion item kind.
     */
    private convertKind(kind: string): languages.CompletionItemKind {
        switch (kind) {
            case "primitive type":
            case "keyword": {
                return languages.CompletionItemKind.Keyword;
            }

            case "var":
            case "local var": {
                return languages.CompletionItemKind.Variable;
            }

            case "property":
            case "getter":
            case "setter": {
                return languages.CompletionItemKind.Field;
            }

            case "function":
            case "method":
            case "construct":
            case "call":
            case "index": {
                return languages.CompletionItemKind.Function;
            }

            case "enum": {
                return languages.CompletionItemKind.Enum;
            }

            case "module": {
                return languages.CompletionItemKind.Module;
            }

            case "class": {
                return languages.CompletionItemKind.Class;
            }

            case "interface": {
                return languages.CompletionItemKind.Interface;
            }

            case "warning": {
                return languages.CompletionItemKind.File;
            }

            default: {
                return languages.CompletionItemKind.Property;

            }
        }
    }

    private convertOptions(options: FormattingOptions, formatSettings: IDictionary,
        initialIndentLevel: number): ts.FormatCodeOptions {
        return {
            /* eslint-disable @typescript-eslint/naming-convention */

            ConvertTabsToSpaces: options.insertSpaces,
            TabSize: options.tabSize,
            IndentSize: options.tabSize,
            IndentStyle: ts.IndentStyle.Smart,
            NewLineCharacter: "\n",
            BaseIndentSize: options.tabSize * initialIndentLevel,
            InsertSpaceAfterCommaDelimiter: Boolean(!formatSettings || formatSettings.insertSpaceAfterCommaDelimiter),
            InsertSpaceAfterSemicolonInForStatements:
                Boolean(!formatSettings || formatSettings.insertSpaceAfterSemicolonInForStatements),
            InsertSpaceBeforeAndAfterBinaryOperators:
                Boolean(!formatSettings || formatSettings.insertSpaceBeforeAndAfterBinaryOperators),
            InsertSpaceAfterKeywordsInControlFlowStatements:
                Boolean(!formatSettings || formatSettings.insertSpaceAfterKeywordsInControlFlowStatements),
            InsertSpaceAfterFunctionKeywordForAnonymousFunctions:
                Boolean(!formatSettings || formatSettings.insertSpaceAfterFunctionKeywordForAnonymousFunctions),
            InsertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis:
                Boolean(formatSettings && formatSettings.insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis),
            InsertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets:
                Boolean(formatSettings && formatSettings.insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets),
            InsertSpaceAfterOpeningAndBeforeClosingNonemptyBraces:
                Boolean(formatSettings && formatSettings.insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces),
            InsertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces:
                Boolean(formatSettings && formatSettings.insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces),
            PlaceOpenBraceOnNewLineForControlBlocks:
                Boolean(formatSettings && formatSettings.placeOpenBraceOnNewLineForFunctions),
            PlaceOpenBraceOnNewLineForFunctions:
                Boolean(formatSettings && formatSettings.placeOpenBraceOnNewLineForControlBlocks),

            /* eslint-enable @typescript-eslint/naming-convention */
        };
    }

    private computeInitialIndent(model: Monaco.ITextModel, range: Range, options: FormattingOptions): number {
        const lineStart = model.getOffsetAt({ lineNumber: range.startLineNumber, column: 0 });
        const content = model.getValue();

        let i = lineStart;
        let nChars = 0;
        const tabSize = options.tabSize || 4;
        while (i < content.length) {
            const ch = content.charAt(i);
            if (ch === " ") {
                nChars++;
            } else if (ch === "\t") {
                nChars += tabSize;
            } else {
                break;
            }
            i++;
        }

        return Math.floor(nChars / tabSize);
    }

    private generateIndent(level: number, options: FormattingOptions): string {
        if (options.insertSpaces) {
            return " ".repeat(level * options.tabSize);
        } else {
            return "\t".repeat(level);
        }
    }

    private async workerForLanguage(language: string): Promise<(...uris: Uri[]) => Promise<TypeScriptWorker>> {
        return (language === "javascript")
            ? languages.typescript.getJavaScriptWorker()
            : languages.typescript.getTypeScriptWorker();

    }
}
