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

import { IPosition } from "monaco-editor";
import ts, {
    CompletionEntryDetails, CompletionInfo, DefinitionInfo, QuickInfo, ReferenceEntry, RenameLocation,
    SignatureHelpItems, TextChange,
} from "typescript";

import {
    CompletionItem, CompletionList, Definition, DocumentHighlight, FormattingOptions, Hover, IRange,
    languages, Location, Monaco, ParameterInformation, Range, SignatureHelp, SignatureHelpResult, SignatureInformation,
    TextEdit, TypeScriptWorker, Uri, WorkspaceEdit, IWorkspaceTextEdit, CodeEditorMode,
} from "../components/ui/CodeEditor/index.js";
import { ICodeEditorModel } from "../components/ui/CodeEditor/CodeEditor.js";
import { ExecutionContext } from "./ExecutionContext.js";
import { SQLExecutionContext } from "./SQLExecutionContext.js";
import {
    DiagnosticSeverity, IDiagnosticEntry, ILanguageWorkerQueryPreprocessData, ILanguageWorkerApplySemicolonData,
    ILanguageWorkerInfoData, ILanguageWorkerParameterData, ILanguageWorkerQueryTypeData, ILanguageWorkerResultData,
    ILanguageWorkerSplitData, ILanguageWorkerValidateData, IParserErrorInfo, IStatementSpan, QueryType,
    ServiceLanguage, StatementFinishState, ILanguageWorkerTokenizeData, IPreprocessResult,
} from "../parsing/parser-common.js";

import { MySQLLanguageService } from "../parsing/mysql/MySQLLanguageService.js";
import { SQLiteLanguageService } from "../parsing/SQLite/SQLiteLanguageService.js";
import { PythonLanguageService } from "../parsing/python/PythonLanguageServices.js";

import { isWhitespaceOnly } from "../utilities/string-helpers.js";

import { LanguageWorkerPool } from "../parsing/worker/LanguageWorkerPool.js";
import { IShellEditorModel } from "../modules/shell/index.js";
import { IDictionary } from "../app-logic/general-types.js";
import { IExecutionContext } from "../supplement/index.js";
import { ITextToken } from "./index.js";

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
     * @param block Provides access to source code specific aspects.
     * @param position The caret position (line/column) in the full editor model.
     *
     * @returns A suggestion list.
     */
    public async getCodeCompletionItems(block: IExecutionContext,
        position: IPosition): Promise<CompletionList | undefined> {

        // Promote to full execution context.
        const context = block as ExecutionContext;
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
     * @param block Provides access to source code specific aspects.
     * @param item The item to finish.
     *
     * @returns The updated item.
     */
    public async resolve(block: IExecutionContext, item: CompletionItem): Promise<CompletionItem | undefined> {
        const context = block as ExecutionContext;
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
     * @param  block Provides access to source code specific aspects.
     * @param position The caret position (line/column) in the full editor model.
     *
     * @returns A hover entry with details about the symbol at the cursor position.
     */
    public async getHover(block: IExecutionContext, position: IPosition): Promise<Hover | undefined> {
        const context = block as ExecutionContext;
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
                const statement = await sqlContext.getStatementAtPosition(position);
                if (statement) {
                    const start = model.getOffsetAt({
                        lineNumber: statement.line,
                        column: statement.column,
                    });

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
     * @param block Provides access to source code specific aspects.
     * @param statement Used for SQL-like languages. It's a specific statement within the context.
     * @param callback A function to be triggered for found diagnostics. Can be called more than once.
     */
    public validate = async (block: IExecutionContext, statement: string,
        callback: (result: IDiagnosticEntry[]) => void): Promise<void> => {

        const context = block as ExecutionContext;
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
                        const filteredDiagnostics = semanticDiagnostics.filter((diagnostic) => {
                            return diagnostic.code !== 1375; // Top level await is only allowed in ES modules.
                        });

                        filteredDiagnostics.forEach((value) => {
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
     * Retrieves a list of tokens for the text in the context.
     *
     * @param block Provides access to source code specific aspects.
     *
     * @returns A promise that resolves to a list of tokens.
     */
    public tokenize = async (block: IExecutionContext): Promise<ITextToken[][]> => {
        const context = block as ExecutionContext;

        if (context.isInternal) {
            // Internal contexts always have only a single command.
            return Promise.resolve([[{
                line: 0,
                column: 0,
                length: context.code.length,
                type: "command",
            }]]);
        }

        const model = context.model;
        if (!model) {
            return Promise.resolve([]);
        }

        switch (context.language) {
            case "javascript":
            case "typescript": {
                if (model && !model.isDisposed()) {
                    const monacoTokens = Monaco.tokenize(model.getValue(), context.language);
                    const tokens: ITextToken[][] = [];

                    monacoTokens.forEach((lineEntries, lineIndex) => {
                        const lineTokens: ITextToken[] = lineEntries.map((entry, index, list) => {
                            let length;
                            if (index < list.length - 1) {
                                length = list[index + 1].offset - entry.offset;
                            } else {
                                length = model.getLineLength(lineIndex + 1) - entry.offset;
                            }

                            return {
                                line: lineIndex,
                                column: entry.offset,
                                length,
                                type: entry.type,
                            };
                        });

                        tokens.push(lineTokens);
                    });

                    return Promise.resolve(tokens);
                }

                break;
            }

            case "sql":
            case "mysql": {
                const sqlContext = context as SQLExecutionContext;
                const statements = await sqlContext.getAllStatements();

                return new Promise((resolve) => {
                    const taskData: ILanguageWorkerTokenizeData = {
                        language: context.language === "sql" ? ServiceLanguage.Sqlite : ServiceLanguage.MySQL,
                        api: "tokenize",
                        version: sqlContext.dbVersion,
                        statements,
                        sqlMode: sqlContext.sqlMode,
                    };

                    let currentLine = -1;
                    this.workerPool.runTask(taskData).then((_taskId, data): void => {
                        const result: ITextToken[][] = [];
                        if (data.tokens) {
                            let lineTokens: ITextToken[] = [];

                            // Split lines into individual token sub arrays.
                            let i = 0;
                            while (i < data.tokens.length) {
                                const token = data.tokens[i];
                                const startPosition = model.getPositionAt(token.offset);
                                if (currentLine === -1) {
                                    // Prime the current line number.
                                    currentLine = startPosition.lineNumber;
                                }

                                if (startPosition.lineNumber === currentLine) {
                                    const endPosition = model.getPositionAt(token.offset + token.length);
                                    if (startPosition.lineNumber === endPosition.lineNumber) {
                                        lineTokens.push({
                                            line: startPosition.lineNumber - 1,
                                            column: startPosition.column - 1,
                                            length: token.length,
                                            type: token.type,
                                        });
                                    } else {
                                        // The token spans multiple lines.
                                        const lineCount = endPosition.lineNumber - startPosition.lineNumber + 1;
                                        for (let i = 0; i < lineCount; ++i) {
                                            if (i === 0) {
                                                lineTokens.push({
                                                    line: startPosition.lineNumber - 1,
                                                    column: startPosition.column - 1,
                                                    length: model.getLineLength(startPosition.lineNumber) -
                                                        startPosition.column + 1,
                                                    type: token.type,
                                                });
                                            } else {
                                                // Finish the current line and start a new one.
                                                result.push(lineTokens);
                                                lineTokens = [];
                                                currentLine = startPosition.lineNumber;

                                                if (i === lineCount - 1) {
                                                    lineTokens.push({
                                                        line: endPosition.lineNumber - 1,
                                                        column: 0,
                                                        length: endPosition.column - 1,
                                                        type: token.type,
                                                    });
                                                } else {
                                                    lineTokens.push({
                                                        line: startPosition.lineNumber + i - 1,
                                                        column: 0,
                                                        length: model.getLineLength(startPosition.lineNumber + i),
                                                        type: token.type,
                                                    });
                                                }
                                            }

                                        }
                                    }
                                    ++i;
                                } else {
                                    // Store the new line of tokens and continue with the next line number.
                                    result.push(lineTokens);
                                    lineTokens = [];
                                    currentLine = startPosition.lineNumber;
                                }
                            }

                            if (lineTokens.length > 0) {
                                result.push(lineTokens);
                            }
                        }

                        resolve(result);
                    });
                });
            }

            default:
        }

        return Promise.resolve([]);
    };

    /**
     * Returns information about parameters in a function call.
     *
     * @param block The context wrapping the relevant editor part for this invocation.
     * @param position The caret position (line/column) in the full editor model.
     *
     * @returns A list of diagnostic records each describing a problem in the code (if any).
     */
    public async getSignatureHelp(block: IExecutionContext,
        position: IPosition): Promise<SignatureHelpResult | undefined> {

        const context = block as ExecutionContext;
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
     * @param block The context wrapping the relevant editor part for this invocation.
     * @param position The caret position (line/column) in the full editor model.
     *
     * @returns A list of document highlights.
     */
    public async findDocumentHighlight(block: IExecutionContext,
        position: IPosition): Promise<DocumentHighlight[] | undefined> {
        const context = block as ExecutionContext;
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

                // Careful here: we are mixing Monaco and TypeScript DocumentHighlight structures.
                const occurrences: readonly ts.DocumentHighlights[] | undefined =
                    await service.getDocumentHighlights(model.uri.toString(), offset, [model.uri.toString()]);

                const result: DocumentHighlight[] = [];
                for (const entry of occurrences || []) {
                    for (const span of entry.highlightSpans) {
                        let kind: languages.DocumentHighlightKind;
                        switch (span.kind) {
                            case ts.HighlightSpanKind.writtenReference:
                                kind = languages.DocumentHighlightKind.Write;
                                break;

                            case ts.HighlightSpanKind.reference:
                                kind = languages.DocumentHighlightKind.Read;
                                break;

                            default:
                                kind = languages.DocumentHighlightKind.Text;
                        }

                        result.push({
                            range: context.fromLocal(span.textSpan) as Range,
                            kind,
                        });
                    }
                }

                return result;
            }

            default:
        }
    }

    /**
     * Determines locations for a rename operation
     *
     * @param block The context wrapping the relevant editor part for this invocation.
     * @param position The caret position (line/column) in the full editor model.
     *
     * @param newName The new name of the entity.
     * @returns A workspace edit with a list of edits..
     */
    public async getRenameLocations(block: IExecutionContext, position: IPosition,
        newName: string): Promise<WorkspaceEdit | undefined> {
        const context = block as ExecutionContext;
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

                const edits: IWorkspaceTextEdit[] = [];
                for (const entry of locations || []) {
                    edits.push({
                        resource: model.uri,
                        versionId: model.getVersionId(),
                        textEdit: { range: context.fromLocal(entry.textSpan) as Range, text: newName },
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
     * @param block The context wrapping the relevant editor part for this invocation.
     * @param position The caret position (line/column) in the full editor model.
     *
     * @returns Definition info.
     */
    public async findDefinition(block: IExecutionContext, position: IPosition): Promise<Definition | undefined> {
        const context = block as ExecutionContext;
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
     * @param block The context wrapping the relevant editor part for this invocation.
     * @param position The caret position (line/column) in the full editor model.
     *
     * @returns Location info for references.
     */
    public async findReferences(block: IExecutionContext, position: IPosition): Promise<Location[] | undefined> {
        const context = block as ExecutionContext;
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
     * @param block The context wrapping the relevant editor part for this invocation.
     * @param range The range in which to format code.
     * @param formatParams General formatting options.
     * @param formatterSettings Any custom setting.
     *
     * @returns A list of edits.
     */
    public async format(block: IExecutionContext, range: IRange, formatParams: FormattingOptions,
        formatterSettings = {}): Promise<TextEdit[] | undefined> {
        const context = block as ExecutionContext;
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
     * @param block Provides access to source code specific aspects.
     * @param delimiter The initial delimiter to use for splitting.
     * @param callback A function to be triggered for found diagnostics. Can be called more than once.
     * @param code If provided then split this code instead of the context content.
     */
    public determineStatementRanges = (block: IExecutionContext, delimiter: string,
        callback: (result: IStatementSpan[]) => void, code?: string): void => {
        const context = block as ExecutionContext;
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
                const sqlContext = block as SQLExecutionContext;
                const sql = code ?? context.code;
                const splitData: ILanguageWorkerSplitData = {
                    language: context.language === "sql" ? ServiceLanguage.Sqlite : ServiceLanguage.MySQL,
                    api: "split",
                    sql,
                    delimiter,
                    version: sqlContext.dbVersion,
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
     * @param block Provides access to source code specific aspects.
     * @param sql The query to scan.
     *
     * @returns A promise that resolves to the type of the query.
     */
    public determineQueryType = async (block: IExecutionContext, sql: string): Promise<QueryType> => {
        return new Promise((resolve) => {
            const sqlContext = block as SQLExecutionContext;
            const queryTypeData: ILanguageWorkerQueryTypeData = {
                language: sqlContext.language === "sql" ? ServiceLanguage.Sqlite : ServiceLanguage.MySQL,
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
     * @param block Provides access to source code specific aspects.
     * @param sql The query to check and modify.
     * @param offset The limit offset to add.
     * @param count The row count value to add.
     * @param forceSecondaryEngine Add the optimizer hint.
     *
     * @returns The rewritten query if the original query is error free and contained no top-level LIMIT clause.
     *          Otherwise the original query is returned.
     */
    public preprocessStatement = async (block: IExecutionContext, sql: string, offset: number,
        count: number, forceSecondaryEngine?: boolean): Promise<IPreprocessResult> => {
        return new Promise((resolve, reject) => {
            const sqlContext = block as SQLExecutionContext;
            const applyLimitsData: ILanguageWorkerQueryPreprocessData = {
                language: sqlContext.language === "sql" ? ServiceLanguage.Sqlite : ServiceLanguage.MySQL,
                api: "preprocessStatement",
                sql,
                offset,
                count,
                forceSecondaryEngine,
                version: sqlContext.dbVersion,
                sqlMode: sqlContext.sqlMode,
            };

            this.workerPool.runTask(applyLimitsData).then((taskId: number, result: ILanguageWorkerResultData): void => {
                resolve({
                    query: result.query ?? sql,
                    changed: result.changed ?? false,
                    updatable: result.updatable ?? false,
                    fullTableName: result.fullTableName,
                });
            }).catch((taskId, reason) => {
                reject(reason);
            });
        });
    };

    /**
     * Parses the query to see if it contains a ending semicolon (keep in mind there can be a trailing comment).
     * If no semicolon exists one is added.
     *
     * @param block Provides access to source code specific aspects.
     * @param sql The query to check and modify.
     *
     * @returns The rewritten query if the original query is error free and contained no final semicolon.
     *          Otherwise the original query is returned.
     */
    public checkAndAddSemicolon = async (block: IExecutionContext, sql: string): Promise<[string, boolean]> => {
        return new Promise((resolve, reject) => {
            const sqlContext = block as SQLExecutionContext;
            const applySemicolonData: ILanguageWorkerApplySemicolonData = {
                language: sqlContext.language === "sql" ? ServiceLanguage.Sqlite : ServiceLanguage.MySQL,
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

    private computeInitialIndent(model: Monaco.ITextModel, range: IRange, options: FormattingOptions): number {
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
