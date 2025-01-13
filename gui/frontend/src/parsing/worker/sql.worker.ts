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

/* eslint-disable no-restricted-globals */

import { ILanguageWorkerResultData, ILanguageWorkerTaskData, ServiceLanguage } from "../parser-common.js";

import { MySQLParseUnit } from "../mysql/MySQLServiceTypes.js";

import { MySQLParsingServices } from "../mysql/MySQLParsingServices.js";
import { SQLiteParsingServices } from "../SQLite/SQLiteParsingServices.js";
import { PrivateWorker } from "../../modules/db-editor/console.worker-types.js";

const worker = self as unknown as PrivateWorker;

const mySqlServices = MySQLParsingServices.instance;
const sqliteServices = SQLiteParsingServices.instance;

const postResultMessage = (taskId: number, data: ILanguageWorkerResultData): void => {
    worker.postMessage?.({
        taskId,
        data,
    });
};
worker.pendingRequests = new Map<string, (res: unknown) => void>();

worker.addEventListener?.("message", (event: MessageEvent) => {
    const { taskId, data }: { taskId: number; data: ILanguageWorkerTaskData; } = event.data;

    let services;
    switch (data.language) {
        case ServiceLanguage.Sqlite: {
            services = sqliteServices;
            break;
        }

        default: {
            services = mySqlServices;
            break;
        }
    }

    switch (data.api) {
        case "queryType": {
            postResultMessage(taskId, {
                queryType: services.determineQueryType(data.sql, data.version),
                final: true,
            });

            break;
        }

        case "split": {
            postResultMessage(taskId, {
                content: services.determineStatementRanges(data.sql, data.delimiter, data.version),
                final: true,
            });

            break;
        }

        case "validate": {
            services.errorCheck(data.sql, MySQLParseUnit.Generic, data.version, data.sqlMode);
            postResultMessage(taskId, {
                content: services.errorsWithOffset(data.offset),
                final: true,
            });

            break;
        }

        case "info": {
            void services.getQuickInfo(data.sql, data.offset, data.version).then((info) => {
                postResultMessage(taskId, {
                    info,
                    final: true,
                });
            });

            break;
        }

        case "suggestion": {
            postResultMessage(taskId, {
                completions: services.getCompletionsAtPosition(
                    data.sql, data.offset, data.line, data.column, data.currentSchema, data.version,
                ),
                final: true,
            });


            break;
        }

        case "preprocessStatement": {
            const result = services.preprocessStatement(data.sql, data.version, data.sqlMode, data.offset, data.count,
                data.forceSecondaryEngine);
            postResultMessage(taskId, {
                ...result,
                final: true,
            });


            break;
        }

        case "addSemicolon": {
            const result = services.checkAndAddSemicolon(data.sql, data.version, data.sqlMode);
            postResultMessage(taskId, {
                query: result[0],
                changed: result[1],
                final: true,
            });


            break;
        }

        case "parameters": {
            postResultMessage(taskId, {
                parameters: services.extractQueryParameters(data.sql, data.version, data.sqlMode),
                final: true,
            });


            break;
        }

        case "tokenize": {
            void services.tokenize(data.statements, data.version, data.sqlMode).then((result) => {
                postResultMessage(taskId, {
                    tokens: result,
                    final: true,
                });
            });


            break;
        }

        case "cleanup": {
            break;
        }

        default:
    }
});
