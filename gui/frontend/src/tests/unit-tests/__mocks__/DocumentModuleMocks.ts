/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
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

import {
    OdmEntityType, type IOdmConnectionPageEntry, type IOdmNotebookEntry, type IOdmScriptEntry,
} from "../../../data-models/OpenDocumentDataModel.js";
import { DBType, type IConnectionDetails } from "../../../supplement/ShellInterface/index.js";

export const connectionDetailsMock: IConnectionDetails = {
    id: 123,
    dbType: DBType.MySQL,
    caption: "details1",
    description: "description1",
    options: {},
};

export const connectionPageMock: IOdmConnectionPageEntry = {
    type: OdmEntityType.ConnectionPage,
    id: "pageId1",
    caption: "page1",
    state: {
        isLeaf: true,
        initialized: true,
        expanded: true,
        expandedOnce: true,
    },
    details: connectionDetailsMock,

    documents: [],
    getChildren: () => { return connectionPageMock.documents; },
};

export const notebookDocumentMock: IOdmNotebookEntry = {
    type: OdmEntityType.Notebook,
    parent: connectionPageMock,
    id: "id",
    state: {
        isLeaf: true,
        initialized: true,
        expanded: true,
        expandedOnce: true,
    },
    caption: "notebook1",
    alternativeCaption: "notebook1",
};
connectionPageMock.documents.push(notebookDocumentMock);

export const scriptDocumentMock: IOdmScriptEntry = {
    type: OdmEntityType.Script,
    parent: connectionPageMock,
    id: "id",
    state: {
        isLeaf: true,
        initialized: true,
        expanded: true,
        expandedOnce: true,
    },
    caption: "script1",
    alternativeCaption: "script1",
    language: "sql",
};
connectionPageMock.documents.push(scriptDocumentMock);
