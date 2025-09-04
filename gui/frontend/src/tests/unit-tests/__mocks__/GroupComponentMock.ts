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

import { GroupComponent, PopupPosition, RowComponent, Tabulator } from "tabulator-tables";
import { vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */
export class GroupComponentMock implements GroupComponent {
    public getElement: () => HTMLElement = vi.fn();
    public getTable: () => Tabulator = vi.fn();
    public getKey: () => any = vi.fn();
    public getField: () => string = vi.fn();
    public getRows: () => RowComponent[] = vi.fn();
    public getSubGroups: () => GroupComponent[] = vi.fn();
    public getParentGroup: () => GroupComponent | false = vi.fn();
    public isVisible: () => boolean = vi.fn();
    public show: () => void = vi.fn();
    public hide: () => void = vi.fn();
    public toggle: () => void = vi.fn();
    public popup: (contents: string, position: PopupPosition) => void = vi.fn();
    public scrollTo: (
        position?: "top" | "center" | "bottom" | "nearest",
        scrollIfVisible?: boolean
    ) => Promise<void> = vi.fn();
}
