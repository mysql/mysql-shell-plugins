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
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */


import icon from "../../../../assets/images/modules/module-sql.svg";

import { createRef } from "preact";
import { mount } from "enzyme";

import { DBEditorModuleId } from "../../../../modules/ModuleInfo.js";
import { IDBEditorTabInfo, DBEditorModule } from "../../../../modules/db-editor/DBEditorModule.js";
import { appParameters } from "../../../../supplement/Requisitions.js";
import { Button } from "../../../../components/ui/Button/Button.js";
import { Divider } from "../../../../components/ui/Divider/Divider.js";
import {
    DBConnectionTab, IOpenEditorState, IDBConnectionTabPersistentState,
} from "../../../../modules/db-editor/DBConnectionTab.js";
import { EntityType } from "../../../../modules/db-editor/index.js";
import { DBType, IConnectionDetails } from "../../../../supplement/ShellInterface/index.js";
import { Dropdown } from "../../../../components/ui/Dropdown/Dropdown.js";
import { nextProcessTick, nextRunLoop } from "../../test-helpers.js";

describe("DBEditor module tests", (): void => {

    it("Test DBEditorModule instantiation", () => {
        const innerRef = createRef<HTMLButtonElement>();
        const component = mount<DBEditorModule>(
            <DBEditorModule
                innerRef={innerRef}
            />,
        );
        const props = component.props();
        expect(props.innerRef).toEqual(innerRef);
        expect(DBEditorModule.info).toStrictEqual({
            id: DBEditorModuleId,
            caption: "DB Editor",
            icon,
        });
        expect(component).toMatchSnapshot();
        component.unmount();
    });

    it("Test DBEditorModule get info", () => {
        const component = mount<DBEditorModule>(<DBEditorModule />);
        const info = DBEditorModule.info;
        expect(info.id).toBe(DBEditorModuleId);
        expect(info.caption).toBe("DB Editor");
        expect(info.icon).toBeDefined();
        component.unmount();
    });

    it("Test DBEditorModule embedded is true scenario", () => {
        const originalEmbedded = appParameters.embedded;
        appParameters.embedded = true;
        const component = mount<DBEditorModule>(<DBEditorModule />);
        expect(DBEditorModule.info).toStrictEqual({
            id: DBEditorModuleId,
            caption: "DB Editor",
            icon,
        });

        const dropDownItemList = component.find(Dropdown.Item);
        expect(dropDownItemList).toHaveLength(0);

        component.unmount();
        appParameters.embedded = originalEmbedded;
    });

    it("Test DBEditorModule selectedPage is 'connections' scenario", async () => {
        const originalEmbedded = appParameters.embedded;
        appParameters.embedded = true;
        const component = mount<DBEditorModule>(<DBEditorModule />);
        var toolbarItems = {
            navigation: [],
        };
        component.setState({ selectedPage: "connections", toolbarItems });
        await nextProcessTick();

        const button = component.find(Button).at(0);
        expect(button).toBeDefined();

        const divider = component.find(Divider);
        expect(divider).toBeDefined();

        component.unmount();
        appParameters.embedded = originalEmbedded;
    });


    it("Test DBEditorModule selectedPage is empty", async () => {
        const originalEmbedded = appParameters.embedded;
        appParameters.embedded = true;
        const component = mount<DBEditorModule>(<DBEditorModule />);
        var toolbarItems = {
            navigation: [],
        };
        component.setState({ selectedPage: "", toolbarItems });
        await nextProcessTick();

        component.unmount();
        appParameters.embedded = originalEmbedded;
    });

    it("Test DBEditorModule editorTabs are not empty scenario", () => {
        const originalEmbedded = appParameters.embedded;
        appParameters.embedded = true;

        const connection1: IConnectionDetails = {
            id: 1,
            dbType: DBType.MySQL,
            caption: "Mysql1",
            description: "",
            options: { type: "unknown" },
            useSSH: false,
            useMDS: false,
        };

        const connection2: IConnectionDetails = {
            id: 2,
            dbType: DBType.Sqlite,
            caption: "Sqlite1",
            description: "",
            options: { type: "unknown" },
            useSSH: false,
            useMDS: false,
        };

        const editorTabs: IDBEditorTabInfo[] = [
            { tabId: "tab1", caption: "Tab 1", details: connection1, suppressAbout: false },
            { tabId: "tab2", caption: "Tab 2", details: connection2, suppressAbout: false },
        ];

        const component = mount<DBEditorModule>(<DBEditorModule />);

        const instance = component.instance();
        instance.setState({ editorTabs: editorTabs, connections: [connection1, connection2] });

        component.unmount();
        appParameters.embedded = originalEmbedded;
    });
});
