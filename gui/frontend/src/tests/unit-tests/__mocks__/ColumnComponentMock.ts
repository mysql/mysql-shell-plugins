/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

import { ColumnComponent, ColumnDefinition } from "tabulator-tables";
import { DBDataType, IColumnInfo } from "../../../app-logic/general-types.js";

const mockColumnsInfo: IColumnInfo = {
    title: "col1",
    field: "0",
    dataType: { type: DBDataType.Varchar },
    inPK: false,
    nullable: false,
    autoIncrement: false,
};


export class ColumnComponentMock implements ColumnComponent {
    public fieldType: string = "";

    public getElement = jest.fn();
    public getTable = jest.fn();
    public getField = jest.fn();
    public getCells = jest.fn();
    public getNextColumn = jest.fn();
    public getPrevColumn = jest.fn();
    public move = jest.fn();
    public isVisible = jest.fn();
    public show = jest.fn();
    public hide = jest.fn();
    public toggle = jest.fn();
    public delete = jest.fn();
    public scrollTo = jest.fn();
    public getSubColumns = jest.fn();
    public getParentColumn = jest.fn();
    public headerFilterFocus = jest.fn();
    public setHeaderFilterValue = jest.fn();
    public reloadHeaderFilter = jest.fn();
    public getHeaderFilterValue = jest.fn();
    public updateDefinition = jest.fn();
    public getWidth = jest.fn();
    public setWidth = jest.fn();
    public validate = jest.fn();
    public popup = jest.fn();
    public getDefinition = (): ColumnDefinition => {
        return {
            title: "",
            formatterParams: (): { info: IColumnInfo; } => {
                return {
                    info: mockColumnsInfo,
                };
            },
            field: this.fieldType,
        };
    };
}
