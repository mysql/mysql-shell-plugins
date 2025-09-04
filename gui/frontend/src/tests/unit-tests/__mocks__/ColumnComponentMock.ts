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
 * WITHOUT unknown WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

/* eslint-disable max-classes-per-file */

import { vi } from "vitest";
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
    public fieldType = "";

    public getElement = vi.fn();
    public getTable = vi.fn();
    public getField = vi.fn();
    public getCells = vi.fn();
    public getNextColumn = vi.fn();
    public getPrevColumn = vi.fn();
    public move = vi.fn();
    public isVisible = vi.fn();
    public show = vi.fn();
    public hide = vi.fn();
    public toggle = vi.fn();
    public delete = vi.fn();
    public scrollTo = vi.fn();
    public getSubColumns = vi.fn();
    public getParentColumn = vi.fn();
    public headerFilterFocus = vi.fn();
    public setHeaderFilterValue = vi.fn();
    public reloadHeaderFilter = vi.fn();
    public getHeaderFilterValue = vi.fn();
    public updateDefinition = vi.fn();
    public getWidth = vi.fn();
    public setWidth = vi.fn();
    public validate = vi.fn();
    public popup = vi.fn();
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
