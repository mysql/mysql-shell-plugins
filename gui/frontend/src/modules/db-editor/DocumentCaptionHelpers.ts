/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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

import { OdmEntityType } from "../../data-models/OpenDocumentDataModel.js";
import type { EditorLanguage } from "../../supplement/index.js";

interface IDocumentCaptionEntry {
    fileName?: string;
    document: {
        caption: string;
        type: OdmEntityType;
        language?: EditorLanguage;
    };
}

interface IDocumentCaptionOptions {
    connectionCaption?: string;
    pageCaption?: string;
}

const usesDocumentFileName = (entry: IDocumentCaptionEntry): boolean => {
    return entry.fileName !== undefined
        || entry.document.type === OdmEntityType.Notebook
        || entry.document.type === OdmEntityType.Script;
};

const getUntitledFileExtension = (entry: IDocumentCaptionEntry): string => {
    if (entry.document.type === OdmEntityType.Notebook) {
        return ".mysql-notebook";
    }

    if (entry.document.type === OdmEntityType.Script) {
        switch (entry.document.language) {
            case "javascript":
                return ".js";

            case "typescript":
                return ".ts";

            case "mysql":
            case "sql":
            default:
                return ".sql";
        }
    }

    return "";
};

export const getDocumentFileName = (fileName: string): string => {
    const pathParts = fileName.split(/[/\\]/);

    return pathParts[pathParts.length - 1] || fileName;
};

export const getUntitledFileIndex = (connectionCaption?: string, pageCaption?: string): number => {
    if (!connectionCaption || !pageCaption) {
        return 0;
    }

    if (!pageCaption.startsWith(`${connectionCaption} (`) || !pageCaption.endsWith(")")) {
        return 0;
    }

    const suffix = pageCaption.slice(connectionCaption.length + 2, -1);
    if (!/^\d+$/.test(suffix)) {
        return 0;
    }

    return Math.max(parseInt(suffix, 10) - 1, 0);
};

export const getDefaultDocumentFileName = (entry: IDocumentCaptionEntry, connectionCaption?: string,
    pageCaption?: string): string => {
    const untitledIndex = getUntitledFileIndex(connectionCaption, pageCaption);
    const untitledSuffix = untitledIndex > 0 ? `-${untitledIndex}` : "";
    const extension = getUntitledFileExtension(entry);

    return `Untitled${untitledSuffix}${extension}`;
};

export const getOpenDocumentDisplayCaption = (entry: IDocumentCaptionEntry,
    options: IDocumentCaptionOptions = {}): string => {
    const { connectionCaption, pageCaption } = options;

    return entry.fileName
        ? getDocumentFileName(entry.fileName)
        : usesDocumentFileName(entry)
            ? getDefaultDocumentFileName(entry, connectionCaption, pageCaption)
            : entry.document.caption;
};
