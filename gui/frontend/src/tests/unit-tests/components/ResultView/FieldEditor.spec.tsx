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
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { mount } from "enzyme";
import { DBDataType, DialogResponseClosure, DialogType, IDialogRequest } from "../../../../app-logic/general-types.js";
import { IDialogSection, IDialogValidations, IDialogValues } from "../../../../components/Dialogs/ValueEditDialog.js";
import { FieldEditor, IFieldEditorData } from "../../../../components/ResultView/FieldEditor.js";
import { DialogHelper, nextProcessTick } from "../../test-helpers.js";

class TestFieldEditor extends FieldEditor {
    public testProcessResults = (dialogValues: IDialogValues): IDictionary => {
        // @ts-ignore, This is necessary to access a private method for testing purposes
        return this.processResults(dialogValues);
    };

    public testValidateInput = (closing: boolean, values: IDialogValues): IDialogValidations => {
        // @ts-ignore, This is necessary to access a private method for testing purposes
        return this.validateInput(closing, values);
    };

    public testDialogValues(request: IDialogRequest, dataType: DBDataType, data?: string | null): IDialogValues {
        // @ts-ignore, This is necessary to access a private method for testing purposes
        return this.dialogValues(request, dataType, data);
    }
}


describe("FieldEditor basic tests", () => {
    let dialogHelper: DialogHelper;

    beforeAll(() => {
        dialogHelper = new DialogHelper("fieldEditor");
    });

    it("should return the processed results when closure is Accept", async () => {
        const component = mount<FieldEditor>(
            <FieldEditor />,
        );

        const request: IDialogRequest = {
            type: DialogType.Prompt,
            id: "fieldEditor",
            parameters: {
                dataType: DBDataType.Blob,
                value: "SGVsbG8gd29ybGQ=",
            },
        };

        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const result = component.instance().show(request);
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        await dialogHelper.clickOk();

        const resolvedResult = await result;
        expect((resolvedResult as IFieldEditorData).dataType).toBe(DBDataType.Blob);

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        component.unmount();
    });

    it("should return DialogResponseClosure.Cancel when closure is not Accept", async () => {
        const component = mount<FieldEditor>(
            <FieldEditor />,
        );

        const request: IDialogRequest = {
            type: DialogType.Prompt,
            id: "fieldEditor",
            parameters: {
                dataType: DBDataType.Blob,
                value: "SGVsbG8gd29ybGQ=",
            },
        };

        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const result = component.instance().show(request);
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        await dialogHelper.clickCancel();

        const resolvedResult = await result;
        expect((resolvedResult as DialogResponseClosure)).toBe(DialogResponseClosure.Cancel);

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        component.unmount();
    });

    it("Test processResults function", () => {
        const component = mount<FieldEditor>(
            <FieldEditor />,
        );

        const dialogValues: IDialogValues = {
            sections: new Map<string, IDialogSection>([
                ["mainSection", {
                    values: {
                        dataType: { value: DBDataType.String, type: "number" },
                        value: { value: "Test", type: "text" },
                    },
                }],
            ]),
        };

        const testFieldEditor = new TestFieldEditor(component.instance().props);

        const result = testFieldEditor.testProcessResults(dialogValues);

        const expected = {
            dataType: DBDataType.String,
            value: "Test",
        };

        expect(result).toEqual(expected);

        component.unmount();
    });

    it("Test validateInput function", () => {
        const component = mount<FieldEditor>(
            <FieldEditor />,
        );

        const request: IDialogValues = {
            sections: new Map<string, IDialogSection>([
                ["mainSection", {
                    values: {
                        dataType: { value: DBDataType.String, type: "number" },
                        value: { value: "Test", type: "text" },
                    },
                }],
            ]),
        };

        const expected: IDialogValidations = {
            messages: {},
            requiredContexts: [],
        };

        const testFieldEditor = new TestFieldEditor(component.instance().props);

        let result = testFieldEditor.testValidateInput(false, request);
        expect(result).toEqual(expected);

        result = testFieldEditor.testValidateInput(true, request);
        expect(result).toEqual(expected);

        component.unmount();
    });

    it("Test dialogValues function", () => {
        const component = mount<FieldEditor>(
            <FieldEditor />,
        );

        const pngImg = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wcAAwAB/gnlZAAAAAAASUVORK5CYII="; // eslint-disable-line max-len
        const pngRequest: IDialogRequest = {
            type: DialogType.Prompt,
            id: "fieldEditor",
            parameters: {
                dataType: DBDataType.Blob,
                value: pngImg,
            },
        };

        const jsonRequest: IDialogRequest = {
            type: DialogType.Prompt,
            id: "fieldEditor",
            parameters: {
                dataType: DBDataType.Json,
                value: '{"key": "value"}',
            },
        };

        const testFieldEditor = new TestFieldEditor(component.instance().props);

        let result = testFieldEditor.testDialogValues(pngRequest, DBDataType.Blob, pngImg);

        const imageSection = result.sections.get("imageSection");
        expect(imageSection).toBeDefined();
        expect(imageSection?.caption).toBe("Image");
        expect(imageSection?.values.value).toMatchSnapshot("ImageSectionValues");

        result = testFieldEditor.testDialogValues(jsonRequest, DBDataType.Json);
        const jsonSection = result.sections.get("jsonSection");
        expect(jsonSection).toBeDefined();
        expect(jsonSection?.caption).toBe("JSON");
        expect(jsonSection?.values.value.value).toBe("");

        component.unmount();
    });

});
