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
    languages, Location, Monaco, ParameterInformation, ProviderResult, Range, SignatureHelp,
    SignatureHelpResult, SignatureInformation, TextEdit, TypescriptWorker, Uri, WorkspaceEdit, WorkspaceTextEdit,
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
import { ICommShellCompletionEvent } from "../communication";
import { EventType } from "../supplement/Dispatch";
import { IDictionary } from "../app-logic/Types";

/** Provides language services like code completion, by reaching out to built-in or other sources. */
export class CodeEditorLanguageServices {

    private static services: CodeEditorLanguageServices;

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

    public static get instance(): CodeEditorLanguageServices {
        if (!CodeEditorLanguageServices.services) {
            CodeEditorLanguageServices.services = new CodeEditorLanguageServices();
        }

        return CodeEditorLanguageServices.services;
    }

    /**
     * Returns a list of suggestion items, depending on the language of the execution block the caret is in.
     *
     * @param context Provides access to source code specific aspects.
     * @param position The caret position (line/column) in the full editor model.
     *
     * @returns A suggestion list.
     */
    public getCodeCompletionItems(context: ExecutionContext, position: IPosition): ProviderResult<CompletionList> {
        const localPosition = context.toLocal(position);
        const model = context.model as ICodeEditorModel;

        switch (context.language) {
            case "javascript":
            case "typescript": {
                return new Promise((resolve) => {
                    const workerPromise = (context.language === "javascript")
                        ? languages.typescript.getJavaScriptWorker()
                        : languages.typescript.getTypeScriptWorker();
                    void workerPromise.then((worker: (...uris: Uri[]) => Promise<TypescriptWorker>) => {
                        void worker(model.uri).then((service) => {
                            const offset = model.getOffsetAt(localPosition);
                            const promise = service.getCompletionsAtPosition(model.uri.toString(), offset);

                            void promise.then((completions?: CompletionInfo) => {
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
                                        resolve({ incomplete: false, suggestions });
                                    } else {
                                        const session = (model as IShellEditorModel).session;
                                        if (session) {
                                            const content = model.getValue();

                                            const shellSuggestions: CompletionItem[] = [];
                                            session.getCompletionItems(content, offset)
                                                .then((event: ICommShellCompletionEvent) => {
                                                    if (!event.data) {
                                                        return;
                                                    }

                                                    switch (event.eventType) {
                                                        case EventType.DataResponse: {
                                                            event.data.result.options.forEach((option) => {
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

                                                            break;
                                                        }

                                                        case EventType.FinalResponse: {
                                                            this.lastShellCompletions = shellSuggestions;
                                                            suggestions.push(...shellSuggestions);
                                                            resolve({ incomplete: false, suggestions });

                                                            break;
                                                        }

                                                        default: {
                                                            break;
                                                        }
                                                    }
                                                });
                                        }
                                    }
                                } else {
                                    resolve({ incomplete: false, suggestions });
                                }
                            });
                        });
                    });
                });
            }

            case "sql": {
                return this.sqliteService.getCodeCompletionItems(context as SQLExecutionContext, localPosition);
            }

            case "mysql": {
                return this.mysqlService.getCodeCompletionItems(context as SQLExecutionContext, localPosition);
            }

            default: {
                break;
            }
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
    public resolve(context: ExecutionContext, item: CompletionItem): ProviderResult<CompletionItem> {
        const model = context.model;

        switch (context.language) {
            case "javascript":
            case "typescript": {
                if (!model || model.isDisposed()) {
                    return item;
                }

                return new Promise((resolve) => {
                    const workerPromise = (context.language === "javascript")
                        ? languages.typescript.getJavaScriptWorker()
                        : languages.typescript.getTypeScriptWorker();

                    void workerPromise.then((worker: (...uris: Uri[]) => Promise<TypescriptWorker>) => {
                        void worker(model.uri).then((service) => {
                            const range = (item.range as IRange);
                            const position = { lineNumber: range.endLineNumber, column: range.endColumn };
                            const offset = model.getOffsetAt(position);
                            const label = typeof item.label === "string" ? item.label : item.label.label;

                            void service.getCompletionEntryDetails(model.uri.toString(), offset, label)
                                .then((details?: CompletionEntryDetails) => {
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

                                    resolve(item);

                                });
                        });
                    });
                });
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
    public getHover(context: ExecutionContext, position: IPosition): ProviderResult<Hover> {
        position = context.toLocal(position);
        const model = context.model;
        if (!model || model.isDisposed()) {
            return null;
        }

        switch (context.language) {
            case "javascript":
            case "typescript": {
                return new Promise((resolve) => {
                    const workerPromise = (context.language === "javascript")
                        ? languages.typescript.getJavaScriptWorker()
                        : languages.typescript.getTypeScriptWorker();
                    void workerPromise.then((worker: (...uris: Uri[]) => Promise<TypescriptWorker>) => {
                        void worker(model.uri).then((service) => {
                            const offset = model.getOffsetAt(position);
                            void service.getQuickInfoAtPosition(model.uri.toString(), offset)
                                .then((info?: QuickInfo) => {
                                    if (info) {
                                        resolve({
                                            range: context.fromLocal(info.textSpan) as Range,
                                            contents: [
                                                {
                                                    value: "```ts\n" +
                                                        ts.displayPartsToString(info.displayParts) + "\n```",
                                                },
                                                { value: ts.displayPartsToString(info.documentation) },
                                            ],
                                        });
                                    } else {
                                        resolve(null);
                                    }
                                });
                        });
                    });
                });
            }

            case "sql":
            case "mysql": {
                const sqlContext = context as SQLExecutionContext;
                const statement = sqlContext.getStatementAtPosition(position);
                if (statement) {
                    const start = model.getOffsetAt(
                        { lineNumber: statement.line, column: statement.column });

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
                                    resolve(null);
                                }
                            });
                    });
                }

                break;
            }

            default: {
                break;
            }
        }
    }

    /**
     * Runs syntactic and semantic checks for the text in the context.
     *
     * @param context Provides access to source code specific aspects.
     * @param statement Used for SQL-like languages. It's a specific statement within the context.
     * @param callback A function to be triggered for found diagnostics. Can be called more than once.
     */
    public validate = (context: ExecutionContext, statement: string,
        callback: (result: IDiagnosticEntry[]) => void): void => {

        if (context.isInternal) {
            return;
        }

        switch (context.language) {
            case "javascript":
            case "typescript": {
                // Manual JS/TS validation is only necessary for a mixed language editor.
                const workerPromise = (context.language === "javascript")
                    ? languages.typescript.getJavaScriptWorker()
                    : languages.typescript.getTypeScriptWorker();
                void workerPromise.then((worker: (...uris: Uri[]) => Promise<TypescriptWorker>) => {
                    const model = context.model;
                    if (model && !model.isDisposed()) {
                        void worker(model.uri).then((service: TypescriptWorker) => {
                            if (!model.isDisposed()) {
                                const result: IDiagnosticEntry[] = [];
                                const syntaxPromise = service.getSyntacticDiagnostics(model.uri.toString());
                                const semanticPromise = service.getSemanticDiagnostics(model.uri.toString());
                                void Promise.all([syntaxPromise, semanticPromise]).then((values) => {
                                    values[0].forEach((value) => {
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
                                    values[1].forEach((value) => {
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
                                });
                            }
                        });
                    }
                });

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

            default: {
                break;
            }
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
    public getSignatureHelp(context: ExecutionContext, position: IPosition): ProviderResult<SignatureHelpResult> {
        position = context.toLocal(position);
        const model = context.model;
        if (!model || model.isDisposed()) {
            return null;
        }

        switch (context.language) {
            case "javascript":
            case "typescript": {
                return new Promise((resolve) => {
                    const workerPromise = (context.language === "javascript")
                        ? languages.typescript.getJavaScriptWorker()
                        : languages.typescript.getTypeScriptWorker();
                    void workerPromise.then((worker: (...uris: Uri[]) => Promise<TypescriptWorker>) => {
                        void worker(model.uri).then((service) => {
                            const offset = model.getOffsetAt(position);
                            void service.getSignatureHelpItems(model.uri.toString(), offset, {})
                                .then((signHelp?: SignatureHelpItems) => {
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

                                        resolve({
                                            value: helpEntries,
                                            dispose: () => { /* nothing to do */ },
                                        });
                                    } else {
                                        resolve(null);
                                    }
                                });
                        });
                    });
                });
            }

            default: {
                break;
            }
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
    public findDocumentHighlight(context: ExecutionContext, position: IPosition): ProviderResult<DocumentHighlight[]> {
        position = context.toLocal(position);
        const model = context.model;
        if (!model || model.isDisposed()) {
            return null;
        }

        switch (context.language) {
            case "javascript":
            case "typescript": {
                return new Promise((resolve) => {
                    const workerPromise = (context.language === "javascript")
                        ? languages.typescript.getJavaScriptWorker()
                        : languages.typescript.getTypeScriptWorker();
                    void workerPromise.then((worker: (...uris: Uri[]) => Promise<TypescriptWorker>) => {
                        void worker(model.uri).then((service) => {
                            const offset = model.getOffsetAt(position);
                            void service.getOccurrencesAtPosition(model.uri.toString(), offset)
                                .then((occurrences?: readonly ReferenceEntry[]) => {
                                    const result: DocumentHighlight[] = [];
                                    for (const entry of occurrences || []) {
                                        result.push({
                                            range: context.fromLocal(entry.textSpan) as Range,
                                            kind: entry.isWriteAccess
                                                ? languages.DocumentHighlightKind.Write
                                                : languages.DocumentHighlightKind.Read,
                                        });
                                    }
                                    resolve(result);
                                });
                        });
                    });
                });
            }

            default: {
                break;
            }
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
    public getRenameLocations(context: ExecutionContext, position: IPosition,
        newName: string): ProviderResult<WorkspaceEdit> {
        position = context.toLocal(position);
        const model = context.model;
        if (!model || model.isDisposed()) {
            return null;
        }

        switch (context.language) {
            case "javascript":
            case "typescript": {
                return new Promise((resolve) => {
                    const workerPromise = (context.language === "javascript")
                        ? languages.typescript.getJavaScriptWorker()
                        : languages.typescript.getTypeScriptWorker();
                    void workerPromise.then((worker: (...uris: Uri[]) => Promise<TypescriptWorker>) => {
                        void worker(model.uri).then((service) => {
                            const offset = model.getOffsetAt(position);
                            void service.findRenameLocations(model.uri.toString(), offset, false, true, false)
                                .then((locations?: readonly RenameLocation[]) => {
                                    const edits: WorkspaceTextEdit[] = [];
                                    for (const entry of locations || []) {
                                        edits.push({
                                            resource: model.uri,
                                            modelVersionId: model.getVersionId(),
                                            edit: {
                                                range: context.fromLocal(entry.textSpan) as Range,
                                                text: newName,
                                            },
                                        });
                                    }
                                    resolve({ edits });
                                });
                        });
                    });
                });
            }

            default: {
                break;
            }
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
    public findDefinition(context: ExecutionContext, position: IPosition): ProviderResult<Definition> {
        position = context.toLocal(position);
        const model = context.model;
        if (!model || model.isDisposed()) {
            return null;
        }

        switch (context.language) {
            case "javascript":
            case "typescript": {
                return new Promise((resolve) => {
                    const workerPromise = (context.language === "javascript")
                        ? languages.typescript.getJavaScriptWorker()
                        : languages.typescript.getTypeScriptWorker();
                    void workerPromise.then((worker: (...uris: Uri[]) => Promise<TypescriptWorker>) => {
                        void worker(model.uri).then((service) => {
                            const offset = model.getOffsetAt(position);
                            const name = model.uri.toString(); // Not a filename, but close enough.
                            void service.getDefinitionAtPosition(name, offset)
                                .then((definition?: readonly DefinitionInfo[]) => {
                                    if (definition) {
                                        resolve(definition.filter((d) => {
                                            return d.fileName === name;
                                        }).map((d) => {
                                            return {
                                                uri: model.uri,
                                                range: context.fromLocal(d.textSpan) as Range,
                                            };
                                        }));
                                    } else {
                                        resolve(null);
                                    }
                                });
                        });
                    });
                });
            }

            default: {
                break;
            }
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
    public findReferences(context: ExecutionContext, position: IPosition): ProviderResult<Location[]> {
        position = context.toLocal(position);
        const model = context.model;
        if (!model || model.isDisposed()) {
            return null;
        }

        switch (context.language) {
            case "javascript":
            case "typescript": {
                return new Promise((resolve) => {
                    const workerPromise = (context.language === "javascript")
                        ? languages.typescript.getJavaScriptWorker()
                        : languages.typescript.getTypeScriptWorker();
                    void workerPromise.then((worker: (...uris: Uri[]) => Promise<TypescriptWorker>) => {
                        void worker(model.uri).then((service) => {
                            const offset = model.getOffsetAt(position);
                            const name = model.uri.toString(); // Not a filename, but close enough.
                            void service.getReferencesAtPosition(name, offset).then((references?: ReferenceEntry[]) => {
                                if (references) {
                                    resolve(references.filter((d) => {
                                        return d.fileName === name;
                                    }).map((d) => {
                                        return {
                                            uri: model.uri,
                                            range: context.fromLocal(d.textSpan) as Range,
                                        };
                                    }));
                                } else {
                                    resolve(null);
                                }
                            });
                        });
                    });
                });
            }

            default: {
                break;
            }
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
    public format(context: ExecutionContext, range: Range, formatParams: FormattingOptions,
        formatterSettings = {}): ProviderResult<TextEdit[]> {
        const model = context.model;
        if (!model || model.isDisposed()) {
            return null;
        }

        const initialIndentLevel = this.computeInitialIndent(model, range, formatParams);
        const formatSettings = this.convertOptions(formatParams, formatterSettings, initialIndentLevel);
        const start = model.getOffsetAt({ lineNumber: range.startLineNumber, column: range.startColumn });
        let end = model.getOffsetAt({ lineNumber: range.endLineNumber, column: range.endColumn });
        let lastLineRange: Range;
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
                return new Promise((resolve) => {
                    const workerPromise = (context.language === "javascript")
                        ? languages.typescript.getJavaScriptWorker()
                        : languages.typescript.getTypeScriptWorker();
                    void workerPromise.then((worker: (...uris: Uri[]) => Promise<TypescriptWorker>) => {
                        void worker(model.uri).then((service) => {
                            void service.getFormattingEditsForRange(model.uri.toString(), start, end, formatSettings)
                                .then((edits: TextChange[]) => {
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

                                        resolve(result);
                                    } else {
                                        resolve(null);
                                    }
                                });
                        });
                    });
                });
            }

            default: {
                break;
            }
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

            default: {
                break;
            }
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
    public determineQueryType = (context: ExecutionContext, sql: string): Promise<QueryType> => {
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
    public preprocessStatement = (context: ExecutionContext, sql: string, offset: number,
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
    public checkAndAddSemicolon = (context: ExecutionContext, sql: string): Promise<[string, boolean]> => {
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
    public extractQueryParameters = (sql: string, version: number,
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
}
