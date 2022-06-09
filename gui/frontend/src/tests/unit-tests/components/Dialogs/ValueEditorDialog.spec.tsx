/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import React from "react";
import { mount } from "enzyme";
import keyboardKey from "keyboard-key";

import {
    DialogValueOption, IDialogSection, IDialogValidations, IDialogValues, ValueEditDialog,
} from "../../../../components/Dialogs/ValueEditDialog";
import {
    changeInputValue, nextProcessTick, sendBlurEvent, sendKeyPress, snapshotFromWrapper,
} from "../../test-helpers";
import { CheckState, ICheckboxProperties, Label } from "../../../../components/ui";
import { IDictionary } from "../../../../app-logic/Types";

describe("Value Edit Dialog Tests", (): void => {
    const clickButton = jest.fn((_id: string, _values: IDialogValues): void => {
        // no-op
    });

    const dropDownChange = jest.fn((): void => {
        // no-op
    });

    const close = jest.fn((): void => {
        // no-op
    });

    const focusLost = jest.fn((): void => {
        // no-op
    });

    // A simple dialog section.
    const nameSection: IDialogSection = {
        values: {
            input: {
                caption: "input",
                value: "",
                span: 8,
            },
        },
    };

    // A section with all data types.
    const fullSection: IDialogSection = {
        caption: "Full Section",
        contexts: ["myContext"],
        values: {
            title: { // A simple description label.
                caption: "A caption for the section",
                options: [DialogValueOption.Description],
            },
            yesNo: { // A checkbox.
                caption: "Activate this",
                value: false,
            },
            file: { // A file selector.
                caption: "Pick File",
                options: [DialogValueOption.Resource],
                value: "../relative/path",
                filters: {
                    image: ["svg", "png"],
                    audio: ["mp3", "m4a"],
                },
            },
            selectOne: { // A dropdown.
                caption: "Select One",
                value: "One",
                choices: ["One", "Two", "Three"],
                onChange: dropDownChange,
            },
            clickMe: { // A simple button with click handler (there's another type with a command).
                caption: "Do it!",
                onClick: clickButton,
            },
            listMe: { // A dynamic list (here with checkboxes).
                list: ["Option 1", "Option 2", "Option 3"].map((k, index) => {
                    const result: ICheckboxProperties = {
                        id: index === 0 ? undefined : k, // No ID for the first entry (to test early exit handling).
                        caption: k,
                        checkState: CheckState.Unchecked,
                    };

                    return { data: result };
                }),
            },
            matrix: { // A grid with a name and a value column.
                matrix: [
                    ["Option 11", 1],
                    ["Option 22", 2],
                ],
            },
            upDown: { // A number UpDown component.
                value: 12345,
            },
            input: { // A simple text input field.
                caption: "Give Me Text",
                value: "",
                span: 8,
                onFocusLost: focusLost,
            },
            loadingInput: { // A text input field with a progress indicator.
                caption: "Wait For Me",
                value: "loading",
                span: 8,
                options: [DialogValueOption.ShowLoading],
            },
        },
    };

    it("Render with Defaults Test", () => {
        const component = mount<ValueEditDialog>(
            <ValueEditDialog />,
        );
        expect(snapshotFromWrapper(component)).toMatchSnapshot();

        component.unmount();
    });

    it("Simple Dialog", async () => {
        const component = mount<ValueEditDialog>(
            <ValueEditDialog />,
        );

        const nameSection: IDialogSection = {
            values: {
                input: {
                    caption: "input",
                    value: "",
                    span: 8,
                },
            },
        };

        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        component.instance().show(
            {
                id: "testDialog",
                sections: new Map<string, IDialogSection>([
                    ["name", nameSection],
                ]),
            },
            { title: "Enter a name for the new theme" },
        );
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        expect(portals[0]).toMatchSnapshot();

        sendKeyPress(keyboardKey.Escape);
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        component.unmount();
    });

    it("Show Dialog with Advanced Field", async () => {
        const component = mount<ValueEditDialog>(
            <ValueEditDialog
                advancedActionCaption="More..."
            />,
        );

        expect(component.state().activeContexts).not.toContain("advanced");

        component.instance().show(
            {
                id: "testDialog",
                sections: new Map<string, IDialogSection>([
                    ["name", nameSection],
                ]),
            },
            { contexts: ["advanced"], title: "Select Value" },
        );
        await nextProcessTick();
        expect(component.state().activeContexts).toContain("advanced");

        // Cancel the dialog and launch it again. This time without the advanced context in the show call.
        sendKeyPress(keyboardKey.Escape);
        await nextProcessTick();

        component.instance().show(
            {
                id: "testDialog",
                sections: new Map<string, IDialogSection>([
                    ["name", nameSection],
                ]),
            },
            { title: "Select Value" },
        );
        await nextProcessTick();

        // The advanced context should still be set.
        expect(component.state().activeContexts).toContain("advanced");

        const portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        sendKeyPress(keyboardKey.Escape);
        await nextProcessTick();

        component.unmount();
    });

    it("Advanced Actions", async () => {
        const onToggleAdvanced = jest.fn((_value: boolean) => {
            // no-op
        });

        let component = mount<ValueEditDialog>(
            <ValueEditDialog
                advancedActionCaption="More..."
                onToggleAdvanced={onToggleAdvanced}
            />,
        );

        component.instance().show(
            {
                id: "testDialog",
                sections: new Map<string, IDialogSection>([
                    ["name", nameSection],
                ]),
            },
            { contexts: ["myContext"], title: "Select Value" },
        );
        await nextProcessTick();

        const portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);

        let advancedButton = document.getElementById("advanced-btn");
        expect(advancedButton).toBeNull();
        let showAdvancedCheckbox = document.getElementById("show-advanced");
        expect(showAdvancedCheckbox).toBeDefined();

        expect(component.state().activeContexts).toStrictEqual(new Set(["myContext"]));
        (showAdvancedCheckbox as HTMLInputElement).click();
        expect(component.state().activeContexts).toStrictEqual(new Set(["myContext", "advanced"]));
        (showAdvancedCheckbox as HTMLInputElement).click();
        expect(component.state().activeContexts).toStrictEqual(new Set(["myContext"]));

        component.unmount();

        const advancedAction = jest.fn((): void => {
            // no-op
        });

        component = mount<ValueEditDialog>(
            <ValueEditDialog
                advancedActionCaption="More..."
                advancedAction={advancedAction}
            />,
        );

        component.instance().show(
            {
                id: "testDialog",
                sections: new Map<string, IDialogSection>([
                    ["name", nameSection],
                ]),
            },
            { contexts: ["myContext"], title: "Select Value" },
        );
        await nextProcessTick();

        advancedButton = document.getElementById("advanced-btn");
        expect(advancedButton).toBeDefined();
        showAdvancedCheckbox = document.getElementById("show-advanced");
        expect(showAdvancedCheckbox).toBeNull();

        expect(advancedAction).toBeCalledTimes(0);
        advancedButton?.click();
        expect(advancedAction).toBeCalledTimes(1);

        component.unmount();
    });

    it("Update Contexts", async () => {
        const component = mount<ValueEditDialog>(
            <ValueEditDialog />,
        );

        expect(component.state().activeContexts).not.toContain("myContext");

        component.instance().show(
            {
                id: "testDialog",
                sections: new Map<string, IDialogSection>([
                    ["name", nameSection],
                    ["full", fullSection],
                ]),
            },
            { title: "Select Value" },
        );
        await nextProcessTick();

        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);
        expect(portals[0]).toMatchSnapshot(); // Smaller snapshot as we don't show the full section at this point.

        expect(component.state().activeContexts).not.toContain("myContext");

        component.instance().updateActiveContexts({ add: ["A", "B", "A", "C"] });
        await nextProcessTick();
        expect(component.state().activeContexts).not.toContain("myContext");
        expect(component.state().activeContexts).toStrictEqual(new Set(["A", "B", "C"]));

        component.instance().updateActiveContexts({ add: ["myContext"], remove: ["A", "B"] });
        await nextProcessTick();
        expect(component.state().activeContexts).toContain("myContext");

        component.unmount();

        // Unmounting the dialog also closes its portal. Check this.
        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        // Show again, but with the full section visible.
        component.mount();
        component.instance().show(
            {
                id: "testDialog",
                sections: new Map<string, IDialogSection>([
                    ["name", nameSection],
                    ["full", fullSection],
                ]),
            },
            { contexts: ["myContext"], title: "Select Value" },
        );
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);
        expect(portals[0]).toMatchSnapshot();

        component.unmount();
    });

    it("Updating Dialog Values", async () => {
        const component = mount<ValueEditDialog>(
            <ValueEditDialog />,
        );

        component.instance().show(
            {
                id: "testDialog",
                sections: new Map<string, IDialogSection>([
                    ["simple", nameSection],
                    ["full", fullSection],
                ]),
            },
            { contexts: ["myContext"], title: "Select Value" },
        );
        await nextProcessTick();

        const portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);
        expect(portals[0]).toMatchSnapshot();

        const state = component.state();
        expect(state).toMatchObject({
            description: undefined,
            heading: undefined,
            preventConfirm: false,
            validations: { messages: {} },
        });

        expect(state.values.sections.size).toBe(2);

        const section = state.values.sections.get("full");
        expect(section).toBeDefined();
        if (section) { // Always true after the previous check.
            expect(section.values.clickMe).toBeDefined();
            expect(section.values.file).toBeDefined();
            expect(section.values.input).toBeDefined();
            expect(section.values.listMe).toBeDefined();
            expect(section.values.loadingInput).toBeDefined();
            expect(section.values.matrix).toBeDefined();
            expect(section.values.selectOne).toBeDefined();
            expect(section.values.title).toBeDefined();
            expect(section.values.upDown).toBeDefined();

            expect(section.values.yesNo).toBeDefined();
            expect(section.values.yesNo.value).toBeFalsy();
            const checkboxes = portals[0].getElementsByClassName("checkbox");

            // There should be 4 checkboxes, as we have a dynamic list with 3 entries, but for some reasons they
            // don't show up. This is because the total height of the portal is 0 and the tabulator component
            // doesn't render the entries if there's no room for them.
            expect(checkboxes).toHaveLength(1);

            expect(section.values.selectOne.value).toBe("One");
            component.instance().updateInputValue("Two", "selectOne");
            expect(section.values.selectOne.value).toBe("Two");

            expect(section.values.loadingInput.value).toBe("loading");
            expect(section.values.loadingInput.options).toContain(DialogValueOption.ShowLoading);
            component.instance().updateInputValue("Done", "loadingInput");
            expect(section.values.loadingInput.value).toBe("Done");
            expect(section.values.loadingInput.options).not.toContain(DialogValueOption.ShowLoading);

            component.instance().beginValueUpdating("Driving", "loadingInput");
            expect(section.values.loadingInput.value).toBe("Driving");
            expect(section.values.loadingInput.options).toContain(DialogValueOption.ShowLoading);

            // Reset to the original value for further tests.
            component.instance().updateInputValue("loading", "loadingInput");

            // Make the standard input loading too.
            component.instance().beginValueUpdating("Flying", "input");
            expect(section.values.input.value).toBe("Flying");
            expect(section.values.input.options).toContain(DialogValueOption.ShowLoading);
            component.instance().updateInputValue("", "input");

            expect(section.values.selectOne.value).toBe("Two");
            component.instance().updateDropdownValue(["Tesla", "BMW", "Audi", "Mercedes"], "Tesla", "selectOne");
            expect(section.values.selectOne.value).toBe("Tesla");
            expect(section.values.selectOne.choices).toContain("Tesla");

            // Reset to the original value for further tests.
            component.instance().updateDropdownValue(["One", "Two", "Three"], "One", "selectOne");
        }

        component.instance().changeAdvActionText("Getting Closer");
        await nextProcessTick();
        expect(component.state()).toMatchObject({
            description: undefined,
            heading: undefined,
            preventConfirm: false,
            validations: { messages: {} },
            actionText: "Getting Closer",
        });

        component.instance().preventConfirm(true);
        expect(component.state().preventConfirm).toBeTruthy();

        component.unmount();
    });

    it("Validation", async () => {
        const onValidate = jest.fn((_closing: boolean, _values: IDialogValues,
            _data?: IDictionary): IDialogValidations => {
            return {
                requiredContexts: [
                    "context 1",
                    "context 2",
                ],
                messages: {
                    yesNo: "Say yes or no, not maybe",
                    listMe: "One of a kind",
                },
            };
        });

        const component = mount<ValueEditDialog>(
            <ValueEditDialog
                onValidate={onValidate}
            />,
        );

        component.instance().show(
            {
                id: "testDialog",
                sections: new Map<string, IDialogSection>([
                    ["simple", nameSection],
                    ["full", fullSection],
                ]),
            },
            { contexts: ["myContext", "context 2"], title: "Select Value" },
        );
        await nextProcessTick();

        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);
        const buttons = portals[0].getElementsByTagName("button");
        expect(buttons.length).toBe(8);
        expect(buttons[6].id).toBe("ok");
        buttons[6].click();
        await nextProcessTick();

        // Because we return error messages during validation, the dialog must not be closed.
        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);

        expect(onValidate.mock.calls).toHaveLength(1);
        expect(component.state().validations).toStrictEqual({
            requiredContexts: undefined, // No value because on next render the contexts are merged to the main list.
            messages: {
                yesNo: "Say yes or no, not maybe",
                listMe: "One of a kind",
            },
        });

        const values = onValidate.mock.calls[0][1];
        const section = values.sections.get("full");
        expect(section).toBeDefined();
        if (section) {
            expect(section.values.loadingInput.value).toBe("loading");
            component.instance().updateInputValue("Done", "loadingInput"); // Triggers validation.

            expect(onValidate.mock.calls).toHaveLength(2);
            expect(section.values.loadingInput.value).toBe("Done"); // Values are passed by reference.

            // Reset to the original value for further tests.
            component.instance().updateInputValue("loading", "loadingInput");
        }

        // Pressing escape cancels the dialog regardless of its validation status.
        sendKeyPress(keyboardKey.Escape);
        await nextProcessTick();
        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        component.unmount();
    });

    it("Footer, Heading, Description and Payload", async () => {
        const component = mount<ValueEditDialog>(
            <ValueEditDialog
                customFooter={<Label caption="Custom Footer" />}
            />,
        );

        component.instance().show(
            {
                id: "testDialog",
                sections: new Map<string, IDialogSection>([
                    ["simple", nameSection],
                ]),
            },
            {
                contexts: ["myContext", "context 2"],
                title: "Select Value",
                description: [
                    "Lorem Ipsum Dolor Sit Amet",
                    "Show this dialog to show a dialog",
                ],
            },
            { world: "earth" },
        );
        await nextProcessTick();

        const portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);
        expect(portals[0]).toMatchSnapshot();

        component.unmount();
    });

    it("Grouped Sections", async () => {
        const section1: IDialogSection = {
            groupName: "group1",
            caption: "My First Section",
            values: {
                input: {
                    caption: "input",
                    value: "",
                    span: 8,
                },
            },
        };

        const section2: IDialogSection = {
            groupName: "group1",
            caption: "My Second Section",
            active: true,
            values: {
                input: {
                    caption: "output",
                    value: "",
                    span: 8,
                },
            },
        };

        const section3: IDialogSection = {
            groupName: "group1",
            caption: "My Third Section",
            active: false,
            values: {
                input: {
                    caption: "error",
                    value: "",
                    span: 8,
                },
            },
        };

        const section4: IDialogSection = {
            groupName: "group2",
            caption: "My Fourth Section",
            active: true,
            values: {
                input: {
                    caption: "something else",
                    value: "",
                    span: 8,
                },
            },
        };

        const onSelectTab = jest.fn((_id: string): void => {
            // no-op
        });

        const component = mount<ValueEditDialog>(
            <ValueEditDialog
                customFooter={<Label caption="Custom Footer" />}
                onSelectTab={onSelectTab}
            />,
        );

        component.instance().show(
            {
                id: "testDialog",
                sections: new Map<string, IDialogSection>([
                    ["one", section1],
                    ["two", section2],
                    ["three", section3],
                    ["four", section4],
                ]),
            },
            { contexts: ["myContext", "context 2"], title: "Select Value" },
        );
        await nextProcessTick();

        const portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);
        expect(portals[0]).toMatchSnapshot();

        const items = portals[0].getElementsByClassName("selectorItem");
        expect(items).toHaveLength(5); // 3 pages and the 2 up/down paging items.
        expect(items[2].id).toBe("page1");

        // The items are actually not buttons, but simple div elements. However, they support the click event.
        (items[2] as HTMLButtonElement).click();
        expect(portals[0]).toMatchSnapshot();
        expect(onSelectTab).toBeCalledWith("My Second Section");

        component.unmount();
    });

    it("Grouped Values", async () => {
        const simpleSection: IDialogSection = {
            values: {
                input: {
                    caption: "Give Input",
                    value: "",
                    span: 3,
                    options: [DialogValueOption.Grouped],
                },
                output: {
                    caption: "Print Output",
                    value: "",
                    span: 4,
                    options: [DialogValueOption.Grouped],
                },
                help: {
                    caption: "Print Help",
                    value: "",
                    span: 5,
                    options: [DialogValueOption.Description, DialogValueOption.NewGroup],
                },
                title: {
                    caption: "Helpers",
                    value: "",
                    options: [DialogValueOption.Description, DialogValueOption.Grouped],
                },
                note: {
                    caption: "Print Note",
                    value: "",
                    options: [DialogValueOption.Grouped],
                },
                debug: {
                    caption: "Print Debug",
                    value: "",
                    options: [DialogValueOption.Grouped],
                },
            },
        };

        const component = mount<ValueEditDialog>(
            <ValueEditDialog />,
        );

        component.instance().show(
            {
                id: "testDialog",
                sections: new Map<string, IDialogSection>([
                    ["simple", simpleSection],
                ]),
            },
            { contexts: ["myContext", "context 2"], title: "Select Value" },
        );
        await nextProcessTick();

        const portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);
        expect(portals[0]).toMatchSnapshot();

        component.unmount();
    });

    it("Interaction", async () => {
        const component = mount<ValueEditDialog>(
            <ValueEditDialog
                onClose={close}
            />,
        );

        const stateSpy = jest.spyOn(component.instance(), "setState");

        component.instance().show(
            {
                id: "testDialog",
                sections: new Map<string, IDialogSection>([
                    ["name", nameSection],
                    ["full", fullSection],
                ]),
            },
            { contexts: ["myContext"], title: "Select Value" },
        );
        await nextProcessTick();

        let portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);

        // Show add property dialog, which opens a second portal.
        let button = document.getElementById("buttonAddEntry");
        expect(button).toBeDefined();
        button?.click();
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(2);

        sendKeyPress(keyboardKey.Escape);
        await nextProcessTick();

        button = document.getElementById("buttonRemoveEntry");
        expect(button).toBeDefined();
        button?.click(); // Doesn't do anything yet.
        await nextProcessTick();

        // Cancel the dialog.
        button = document.getElementById("cancel");
        expect(button).toBeDefined();
        button?.click();
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        component.instance().show(
            {
                id: "testDialog",
                sections: new Map<string, IDialogSection>([
                    ["name", nameSection],
                    ["full", fullSection],
                ]),
            },
            { contexts: ["myContext"], title: "Select Value" },
        );
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);

        // Confirm the dialog.
        button = document.getElementById("ok");
        expect(button).toBeDefined();
        button?.click();
        await nextProcessTick();

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(0);

        component.instance().show(
            {
                id: "testDialog",
                sections: new Map<string, IDialogSection>([
                    ["name", nameSection],
                    ["full", fullSection],
                ]),
            },
            { contexts: ["myContext"], title: "Select Value" },
        );
        await nextProcessTick();

        expect(stateSpy).toBeCalledTimes(4);

        portals = document.getElementsByClassName("portal");
        expect(portals).toHaveLength(1);

        const inputs = portals[0].getElementsByClassName("input");
        expect(inputs).toHaveLength(5);

        const nameInput = inputs[0] as HTMLInputElement;
        expect(nameInput.value).toBe("");
        changeInputValue(nameInput, "Mike");

        expect(stateSpy).toBeCalledTimes(6);
        changeInputValue(nameInput, "");

        const fileSelector = inputs[1] as HTMLInputElement;
        expect(fileSelector.value).toBe("../relative/path");
        changeInputValue(fileSelector, "/absolutePath");

        expect(stateSpy).toBeCalledTimes(9);

        const checkboxes = portals[0].getElementsByClassName("checkbox");
        expect(checkboxes).toHaveLength(1);
        (checkboxes[0] as HTMLInputElement).click();

        expect(stateSpy).toBeCalledTimes(10);

        const state = component.state();
        const section = state.values.sections.get("full");
        expect(section).toBeDefined();
        if (section) { // Always true after the previous check.
            let buttons = portals[0].getElementsByClassName("valueEditor button");
            expect(buttons).toHaveLength(1);
            (buttons[0] as HTMLButtonElement).click();
            expect(clickButton).toBeCalledTimes(1);

            expect(section.values.upDown.value).toBe(12345);

            let elements = portals[0].getElementsByClassName("valueEditor upDown");
            expect(elements).toHaveLength(1);
            buttons = elements[0].getElementsByClassName("button");
            expect(buttons).toHaveLength(2);
            expect(buttons[0].id).toBe("up");
            expect(buttons[1].id).toBe("down");

            (buttons[0] as HTMLButtonElement).click();
            await nextProcessTick();
            (buttons[0] as HTMLButtonElement).click();
            await nextProcessTick();
            (buttons[1] as HTMLButtonElement).click();
            await nextProcessTick();
            expect(section.values.upDown.value).toBe(12346);

            elements = portals[0].getElementsByClassName("valueEditor dropdown");
            expect(elements).toHaveLength(1);
            (elements[0] as HTMLButtonElement).click(); // Open the dropdown portal.
            await nextProcessTick();

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(2);

            expect(dropDownChange).toBeCalledTimes(0);
            elements = portals[1].getElementsByClassName("dropdownItem");
            expect(elements).toHaveLength(3);
            (elements[1] as HTMLButtonElement).click(); // Select the second item, which closes the dropdown portal.
            await nextProcessTick();

            portals = document.getElementsByClassName("portal");
            expect(portals).toHaveLength(1);
            expect(dropDownChange).toBeCalledTimes(1);
            expect(dropDownChange).toBeCalledWith("Two");

            elements = portals[0].getElementsByClassName("valueEditor fileSelector");
            expect(elements).toHaveLength(1);
            elements = elements[0].getElementsByClassName("input");
            expect(elements).toHaveLength(1);

            let count = close.mock.calls.length;
            sendKeyPress(keyboardKey.Enter, elements[0]);
            expect(close).toHaveBeenCalledTimes(count + 1);

            elements = portals[0].getElementsByClassName("valueEditor input");
            expect(elements).toHaveLength(3);
            expect((elements[0] as HTMLInputElement).value).toBe("");
            (elements[0] as HTMLInputElement).focus();

            count = focusLost.mock.calls.length;
            sendBlurEvent();
            expect(focusLost).toBeCalledTimes(count + 1);
        }

        component.unmount();
    });

});
