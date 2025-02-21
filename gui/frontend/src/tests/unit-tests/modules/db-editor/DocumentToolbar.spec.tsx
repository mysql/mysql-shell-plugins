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

import { OdmEntityType } from "../../../../data-models/OpenDocumentDataModel.js";
import type { IOpenDocumentState } from "../../../../modules/db-editor/ConnectionTab.js";
import { DocumentToolbar } from "../../../../modules/db-editor/DocumentToolbar.js";
import { requisitions } from "../../../../supplement/Requisitions.js";
import { uuid } from "../../../../utilities/helpers.js";

describe("DocumentToolbar tests", (): void => {
    it("Test DocumentToolbar instantiation", () => {
        const component = mount<DocumentToolbar>(
            <DocumentToolbar
                language={"ts"}
                activeDocument={"document1"}
                heatWaveEnabled={false}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const props = component.props();
        expect(props.language).toEqual("ts");
        expect(props.activeDocument).toEqual("document1");
        expect(component).toMatchSnapshot();
        component.unmount();
    });

    it("Test DocumentToolbar instantiation (HeatWave)", () => {
        const component = mount<DocumentToolbar>(
            <DocumentToolbar
                language={"js"}
                activeDocument={"document1"}
                heatWaveEnabled={true}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const props = component.props();
        expect(props.language).toEqual("js");
        expect(props.activeDocument).toEqual("document1");
        expect(component).toMatchSnapshot();
        component.unmount();
    });

    it("Test DocumentToolbar instantiation language=msg", () => {
        const component = mount<DocumentToolbar>(
            <DocumentToolbar
                language={"msg"}
                activeDocument={"document1"}
                heatWaveEnabled={false}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const props = component.props();
        expect(props.language).toEqual("msg");
        expect(props.activeDocument).toEqual("document1");
        expect(component).toMatchSnapshot();
        component.unmount();
    });

    it("Test DocumentToolbar requisitions editorCaretMoved", async () => {
        const component = mount<DocumentToolbar>(
            <DocumentToolbar
                language={"msg"}
                activeDocument={"document1"}
                heatWaveEnabled={false}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await requisitions.execute("editorCaretMoved", {
            lineNumber: 1,
            column: 1,
        });


        component.unmount();
    });

    it("Test DocumentToolbar requisitions editorContextStateChanged", async () => {
        const component = mount<DocumentToolbar>(
            <DocumentToolbar
                language={"msg"}
                activeDocument={"document1"}
                heatWaveEnabled={false}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const id = component.state().currentContext?.id;
        await requisitions.execute("editorContextStateChanged", id ?? "");


        component.unmount();
    });

    it("Test DocumentToolbar requisitions editorToggleStopExecutionOnError", async () => {
        const component = mount<DocumentToolbar>(
            <DocumentToolbar
                language={"msg"}
                activeDocument={"document1"}
                heatWaveEnabled={false}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await requisitions.execute("editorToggleStopExecutionOnError", true);

        component.unmount();
    });

    it("Test DocumentToolbar requisitions settingsChanged", async () => {
        const component = mount<DocumentToolbar>(
            <DocumentToolbar
                language={"msg"}
                activeDocument={"document1"}
                heatWaveEnabled={false}
                documentState={[]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        await requisitions.execute("settingsChanged", undefined);

        component.unmount();
    });

    it("Test DocumentToolbar call componentDidUpdate", () => {
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
                caption: "document11",
            },
            currentVersion: 1,
        };

        const component = mount<DocumentToolbar>(
            <DocumentToolbar
                language={"msg"}
                activeDocument={"document11"}
                heatWaveEnabled={true}
                documentState={[testEditorState]}
                toolbarItems={{ navigation: [], execution: [], editor: [], auxiliary: [] }}
            />,
        );

        const props = component.props();
        expect(props.language).toEqual("msg");
        expect(props.activeDocument).toEqual("document11");

        component.instance().componentDidUpdate(props);

        component.unmount();
    });

});
