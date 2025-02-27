/*
 * Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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

import { mount } from "enzyme";

import { ComponentChild } from "preact";
import { CellComponent, ColumnDefinition, RowComponent } from "tabulator-tables";
import { DBDataType, IColumnInfo } from "../../../../app-logic/general-types.js";
import { ClientConnections } from "../../../../modules/db-editor/ClientConnections.js";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { CellComponentMock } from "../../__mocks__/CellComponentMock.js";
import { RowComponentMock } from "../../__mocks__/RowComponentMock.js";
import { nextRunLoop } from "../../test-helpers.js";

class TestClientConnections extends ClientConnections {
    public testGetClientConnectionDetails = (): ComponentChild => {
        // @ts-ignore, This is necessary to access a private method for testing purposes
        return this.getClientConnectionDetails();
    };

    public testHandleClientConnectionTreeRowSelected = (row: RowComponent): void => {
        // @ts-ignore, This is necessary to access a private method for testing purposes
        this.handleClientConnectionTreeRowSelected(row);
    };

    public testGetClientConnectionLocks = (): ComponentChild => {
        // @ts-ignore, This is necessary to access a private method for testing purposes
        return this.getClientConnectionLocks();
    };

    public testGetClientConnectionAttributes = (): ComponentChild => {
        // @ts-ignore, This is necessary to access a private method for testing purposes
        return this.getClientConnectionAttributes();
    };

    public testGenerateColumnDefinitions = (columns: IColumnInfo[]): ColumnDefinition[] => {
        // @ts-ignore, This is necessary to access a private method for testing purposes
        return this.generateColumnDefinitions(columns);
    };

    public testStringFormatter = (cell: CellComponent): string | HTMLElement => {
        // @ts-ignore, This is necessary to access a private method for testing purposes
        return this.stringFormatter(cell);
    };

    public testShowDialog = (id: string, title: string, message: string): void => {
        // @ts-ignore, This is necessary to access a private method for testing purposes
        this.showDialog(id, title, message);
    };

    public testEscapeSqlString = (value: string): string => {
        // @ts-ignore, This is necessary to access a private method for testing purposes
        return this.escapeSqlString(value);
    };
}

describe("Client connections module tests", (): void => {

    it("Test ClientConnections instantiation", async () => {
        const backend = new ShellInterfaceSqlEditor();
        const component = mount<ClientConnections>(
            <ClientConnections
                backend={backend}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );
        // Component updates.
        component.setProps({ backend });
        await nextRunLoop();

        expect(component).toMatchSnapshot("ClientConnections1");

        backend.closeSession().catch(() => {
            throw new Error("Close session failed");
        });
        await nextRunLoop();
        expect(component).toMatchSnapshot("ClientConnections2");

        component.unmount();
    });

    it("Test ClientConnections getClientConnectionDetails function", () => {
        const backend = new ShellInterfaceSqlEditor();
        const component = mount<ClientConnections>(
            <ClientConnections
                backend={backend}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const instance = new TestClientConnections(component.instance().props);

        let result = instance.testGetClientConnectionDetails();

        expect(result).toEqual(undefined);

        instance.testHandleClientConnectionTreeRowSelected(new RowComponentMock());

        result = instance.testGetClientConnectionDetails();

        expect(result).toMatchSnapshot("ClientConnections3");

        component.unmount();
    });

    it("Test ClientConnections getClientConnectionLocks function", () => {
        const backend = new ShellInterfaceSqlEditor();
        const component = mount<ClientConnections>(
            <ClientConnections
                backend={backend}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );
        const instance = new TestClientConnections(component.instance().props);

        const result = instance.testGetClientConnectionLocks();

        expect(result).toEqual(undefined);

        component.unmount();
    });

    it("Test ClientConnections getClientConnectionAttributes function", () => {
        const backend = new ShellInterfaceSqlEditor();
        const component = mount<ClientConnections>(
            <ClientConnections
                backend={backend}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );
        const instance = new TestClientConnections(component.instance().props);

        const result = instance.testGetClientConnectionAttributes();

        expect(result).toEqual(undefined);

        component.unmount();
    });

    it("Test ClientConnections generateColumnDefinitions function", () => {
        const backend = new ShellInterfaceSqlEditor();
        const component = mount<ClientConnections>(
            <ClientConnections
                backend={backend}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );
        const instance = new TestClientConnections(component.instance().props);

        const columns = [
            {
                title: "Name",
                field: "name",
                dataType: { type: DBDataType.String },
                inPK: false,
                autoIncrement: false,
                nullable: true,
            },
            {
                title: "Age",
                field: "age",
                dataType: { type: DBDataType.Decimal },
                inPK: false,
                autoIncrement: false,
                nullable: true,
            },
            {
                title: "Date",
                field: "date",
                dataType: { type: DBDataType.Date },
                inPK: false,
                autoIncrement: false,
                nullable: true,
            },
            {
                title: "Time",
                field: "time",
                dataType: { type: DBDataType.Time },
                inPK: false,
                autoIncrement: false,
                nullable: true,
            },
            {
                title: "Year",
                field: "year",
                dataType: { type: DBDataType.Year },
                inPK: false,
                autoIncrement: false,
                nullable: true,
            },
        ];

        const expectedDefinitions = [
            {
                title: "Name",
                field: "name",
                // @ts-ignore, This is necessary to access a private method for testing purposes
                formatter: instance.stringFormatter,
                formatterParams: {},
                minWidth: 150,
                resizable: true,
            },
            {
                title: "Age",
                field: "age",
                formatter: "plaintext",
                formatterParams: {},
                minWidth: 50,
                resizable: true,
            },
            {
                title: "Date",
                field: "date",
                formatter: "datetime",
                formatterParams: {},
                minWidth: 50,
                resizable: true,
            },
            {
                field: "time",
                formatter: "datetime",
                formatterParams: {
                    outputFormat: "HH:mm:ss",
                },
                minWidth: 50,
                resizable: true,
                title: "Time",
            },
            {
                field: "year",
                formatter: "datetime",
                formatterParams: {
                    outputFormat: "YYYY",
                },
                minWidth: 50,
                resizable: true,
                title: "Year",
            },
        ];

        const definitions = instance.testGenerateColumnDefinitions(columns);

        expect(definitions).toEqual(expectedDefinitions);
        component.unmount();
    });

    it("Test ClientConnections stringFormatter function", () => {
        const backend = new ShellInterfaceSqlEditor();
        const component = mount<ClientConnections>(
            <ClientConnections
                backend={backend}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );
        const instance = new TestClientConnections(component.instance().props);

        const result = instance.testStringFormatter(new CellComponentMock());

        expect(result).toEqual("Animal");

        component.unmount();
    });

    it("Test ClientConnections showDialog function", () => {
        const backend = new ShellInterfaceSqlEditor();
        const component = mount<ClientConnections>(
            <ClientConnections
                backend={backend}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );
        const instance = new TestClientConnections(component.instance().props);

        instance.testShowDialog("1", "Title", "Test Message");

        component.unmount();
    });

    it("Test ClientConnections testEscapeSqlString function", () => {
        const backend = new ShellInterfaceSqlEditor();
        const component = mount<ClientConnections>(
            <ClientConnections
                backend={backend}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );
        const instance = new TestClientConnections(component.instance().props);

        let result = instance.testEscapeSqlString("test");
        expect(result).toEqual("test");

        result = instance.testEscapeSqlString("\x08");
        expect(result).toEqual("\\b");

        result = instance.testEscapeSqlString("prefix \0 suffix");
        expect(result).toEqual("prefix \\0 suffix");

        result = instance.testEscapeSqlString("\x09 test1 \x1a test2 \n");
        expect(result).toEqual("\\t test1 \\z test2 \\n");

        result = instance.testEscapeSqlString("\r test %s");
        expect(result).toEqual("\\r test \\%s");

        component.unmount();
    });

});
