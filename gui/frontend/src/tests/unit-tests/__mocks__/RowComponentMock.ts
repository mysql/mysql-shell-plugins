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
import { CellComponent, GroupComponent, RowComponent } from "tabulator-tables";
import { GroupComponentMock } from "./GroupComponentMock.js";
import { IMrsObjectFieldTreeItem } from "../../../modules/mrs/dialogs/MrsObjectFieldEditor.js";

/* eslint-disable @typescript-eslint/no-unused-vars */
export class RowComponentMock implements RowComponent {
    public element: HTMLElement;
    public row: IMrsObjectFieldTreeItem | undefined;
    public prevRow: RowComponentMock | false = false;
    public nextRow: RowComponentMock | false = false;

    public getTable = jest.fn();
    public getCells = jest.fn();
    public getCell = jest.fn();
    public select = jest.fn();
    public deselect = jest.fn();
    public toggleSelect = jest.fn();
    public normalizeHeight = jest.fn();
    public reformat = jest.fn();
    public freeze = jest.fn();
    public unfreeze = jest.fn();
    public treeExpand = jest.fn();
    public treeCollapse = jest.fn();
    public treeToggle = jest.fn();

    public constructor(row?: IMrsObjectFieldTreeItem) {
        this.row = row;
        this.element = document.createElement("div");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public getIndex: () => any = () => {
        return null;
    };

    public getPosition: (filteredPosition?: boolean) => number | false = (filteredPosition) => {
        return false;
    };

    public getGroup: () => GroupComponent = () => {
        return new GroupComponentMock();
    };

    public delete: () => Promise<void> = () => {
        return Promise.resolve();
    };

    public scrollTo: (
        position?: "top" | "center" | "bottom" | "nearest",
        scrollIfVisible?: boolean
    ) => Promise<void> = (position, scrollIfVisible) => {
        return Promise.resolve();
    };

    public pageTo: () => Promise<void> = () => {
        return Promise.resolve();
    };

    public move: (
        lookup: RowComponent | HTMLElement | number,
        belowTarget?: boolean
    ) => void = (lookup, belowTarget) => {
    };

    public update: (data: {}) => Promise<void> = (data) => {
        return Promise.resolve();
    };

    public isSelected: () => boolean = () => {
        return false;
    };

    public getTreeParent: () => RowComponent | false = () => {
        return false;
    };

    public getTreeChildren: () => RowComponent[] = () => {
        return [];
    };

    public addTreeChild: (
        rowData: {},
        position?: boolean,
        existingRow?: RowComponent
    ) => void = (rowData, position, existingRow) => {
    };

    public isTreeExpanded: () => boolean = () => {
        return false;
    };

    public validate: () => true | CellComponent[] = () => {
        return true;
    };

    public isFrozen: () => boolean = () => {
        return false;
    };

    public getData = (): IMrsObjectFieldTreeItem => { return this.row; };
    public getElement = (): HTMLElement => { return this.element; };
    public getPrevRow = (): RowComponent | false => { return this.prevRow; };
    public getNextRow = (): RowComponent | false => { return this.nextRow; };
}
