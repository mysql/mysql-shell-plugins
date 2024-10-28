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

import { mount } from "enzyme";

import { OdmEntityType } from "../../../../data-models/OpenDocumentDataModel.js";
import type { IOpenDocumentState } from "../../../../modules/db-editor/DBConnectionTab.js";
import { DBEditorToolbar } from "../../../../modules/db-editor/DBEditorToolbar.js";
import { requisitions } from "../../../../supplement/Requisitions.js";
import { uuid } from "../../../../utilities/helpers.js";

describe("DBEditorToolbar tests", (): void => {
    it("Test DBEditorToolbar instantiation", () => {
        const component = mount<DBEditorToolbar>(
            <DBEditorToolbar
                language={"ts"}
                activeDocument={"DbEditor"}
                heatWaveEnabled={false}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxillary: [] }}
            />,
        );

        const props = component.props();
        expect(props.language).toEqual("ts");
        expect(props.activeDocument).toEqual("DbEditor");
        expect(component).toMatchSnapshot();
        component.unmount();
    });

    it("Test DBEditorToolbar instantiation (HeatWave)", () => {
        const component = mount<DBEditorToolbar>(
            <DBEditorToolbar
                language={"js"}
                activeDocument={"DbEditor"}
                heatWaveEnabled={true}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxillary: [] }}
            />,
        );

        const props = component.props();
        expect(props.language).toEqual("js");
        expect(props.activeDocument).toEqual("DbEditor");
        expect(component).toMatchSnapshot();
        component.unmount();
    });

    it("Test DBEditorToolbar instantiation language=msg", () => {
        const component = mount<DBEditorToolbar>(
            <DBEditorToolbar
                language={"msg"}
                activeDocument={"DbEditor"}
                heatWaveEnabled={false}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxillary: [] }}
            />,
        );

        const props = component.props();
        expect(props.language).toEqual("msg");
        expect(props.activeDocument).toEqual("DbEditor");
        expect(component).toMatchSnapshot();
        component.unmount();
    });

    it("Test DBEditorToolbar requisitions editorCaretMoved", async () => {
        const component = mount<DBEditorToolbar>(
            <DBEditorToolbar
                language={"msg"}
                activeDocument={"DbEditor"}
                heatWaveEnabled={false}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxillary: [] }}
            />,
        );

        await requisitions.execute("editorCaretMoved", {
            lineNumber: 1,
            column: 1,
        });


        component.unmount();
    });

    it("Test DBEditorToolbar requisitions editorContextStateChanged", async () => {
        const component = mount<DBEditorToolbar>(
            <DBEditorToolbar
                language={"msg"}
                activeDocument={"DbEditor"}
                heatWaveEnabled={false}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxillary: [] }}
            />,
        );

        const id = component.state().currentContext?.id;
        await requisitions.execute("editorContextStateChanged", id ?? "");


        component.unmount();
    });

    it("Test DBEditorToolbar requisitions editorToggleStopExecutionOnError", async () => {
        const component = mount<DBEditorToolbar>(
            <DBEditorToolbar
                language={"msg"}
                activeDocument={"DbEditor"}
                heatWaveEnabled={false}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxillary: [] }}
            />,
        );

        await requisitions.execute("editorToggleStopExecutionOnError", true);

        component.unmount();
    });

    it("Test DBEditorToolbar requisitions settingsChanged", async () => {
        const component = mount<DBEditorToolbar>(
            <DBEditorToolbar
                language={"msg"}
                activeDocument={"DbEditor"}
                heatWaveEnabled={false}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxillary: [] }}
            />,
        );

        await requisitions.execute("settingsChanged", undefined);

        component.unmount();
    });

    it("Test DBEditorToolbar call componentDidUpdate", () => {
        const testEditorState: IOpenDocumentState = {
            document: {
                type: OdmEntityType.Notebook,
                id: uuid(),
                state: {
                    isLeaf: true,
                    initialized: true,
                    expanded: true,
                    expandedOnce: true,
                },
                caption: "DbEditor1",
            },
            currentVersion: 1,
        };

        const component = mount<DBEditorToolbar>(
            <DBEditorToolbar
                language={"msg"}
                activeDocument={"DbEditor1"}
                heatWaveEnabled={true}
                documentState={[testEditorState]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxillary: [] }}
            />,
        );

        const props = component.props();
        expect(props.language).toEqual("msg");
        expect(props.activeDocument).toEqual("DbEditor1");

        component.instance().componentDidUpdate(props);

        component.unmount();
    });

});
