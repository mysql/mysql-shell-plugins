/*
 * Copyright (c) 2022, 2024, Oracle and/or its affiliates.
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
 * WITHOUT unknown WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

/* eslint-disable max-classes-per-file */

import {
    CellComponent, ColumnComponent, PopupPosition,
    type RowComponent, type RangeComponent,
} from "tabulator-tables";
import { IMrsObjectFieldTreeItem, MrsObjectFieldTreeEntryType }
    from "../../../modules/mrs/dialogs/MrsObjectFieldEditor.js";
import { RowComponentMock } from "./RowComponentMock.js";
import { ColumnComponentMock } from "./ColumnComponentMock.js";


export class CellComponentMock implements CellComponent {
    public parent?: RowComponentMock;
    public getElement = jest.fn();
    public getTable = jest.fn();
    public getType = jest.fn();
    public checkHeight = jest.fn();
    public edit = jest.fn();
    public cancelEdit = jest.fn();
    public navigateUp = jest.fn();
    public navigateDown = jest.fn();
    public clearEdited = jest.fn();
    public clearValidation = jest.fn();
    public validate = jest.fn();

    public data: IMrsObjectFieldTreeItem;
    public fieldType: string = "json";
    public row: RowComponentMock;
    public value: unknown = "Animal";

    public constructor(data?: IMrsObjectFieldTreeItem) {
        this.data = data || {
            type: MrsObjectFieldTreeEntryType.Field,
            expanded: false,
            expandedOnce: false,
            firstItem: true,
            lastItem: true,
            unnested: undefined,
            field: {
                id: "",
                objectId: "",
                representsReferenceId: "",
                parentReferenceId: "",
                name: "",
                position: 0,
                dbColumn: undefined,
                enabled: true,
                allowFiltering: true,
                allowSorting: true,
                noCheck: true,
                noUpdate: true,
                sdkOptions: undefined,
                comments: "",
                objectReference: undefined,
                lev: 0,
                caption: "",
                storedDbColumn: undefined,
            },
        };

        this.row = new RowComponentMock({
            type: 1,
            expanded: false,
            expandedOnce: false,
            field: {
                id: "WpEezaKITIHsIVbnhP7kKA==",
                objectId: "EbIyADFqTITr774mzWjfng==",
                name: "actor",
                position: 0,
                enabled: false,
                allowFiltering: false,
                allowSorting: false,
                noCheck: false,
                noUpdate: false,
                objectReference: {
                    id: "",
                    referenceMapping: {
                        kind: "1:1",
                        constraint: "",
                        toMany: false,
                        referencedSchema: "",
                        referencedTable: "",
                        columnMapping: [],
                    },
                    unnest: false,
                    sdkOptions: undefined,
                    comments: "",
                },
            },
            firstItem: true,
            lastItem: true,
        });
    }

    public getColumn = (): ColumnComponent => {
        const result = new ColumnComponentMock();
        result.fieldType = this.fieldType;

        return result;
    };

    public getValue = (): unknown => {
        return this.value;
    };

    public getOldValue = (): unknown => {
        return this.value;
    };

    public restoreOldValue = (): unknown => {
        return this.value;
    };

    public getInitialValue = (): unknown => {
        return this.value;
    };

    public restoreInitialValue = (): unknown => {
        return this.value;
    };

    public getField = (): string => {
        return "field";
    };

    public setValue = (value: unknown, _mutate?: boolean): void => {
        this.value = value;
    };

    public navigatePrev = (): boolean => {
        return false;
    };

    public navigateNext = (): boolean => {
        return false;
    };

    public navigateLeft = (): boolean => {
        return false;
    };

    public navigateRight = (): boolean => {
        return false;
    };

    public isEdited = (): boolean => {
        return true;
    };


    public isValid = (): boolean => {
        return true;
    };

    public popup = (_contents: string, _position: PopupPosition): void => {
        //
    };

    public getRanges(): RangeComponent[] { return []; }
    public getData = (): IMrsObjectFieldTreeItem => {
        return this.data;
    };

    public getRow = (): RowComponent => {
        return this.row;
    };
}
