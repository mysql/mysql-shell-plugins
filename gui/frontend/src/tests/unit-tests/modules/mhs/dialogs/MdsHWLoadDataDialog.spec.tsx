/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
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

import { act, render } from "@testing-library/preact";
import { createRef } from "preact";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { DialogResponseClosure, IDialogRequest, MdsDialogType } from "../../../../../app-logic/general-types.js";
import { IDialogSection } from "../../../../../components/Dialogs/ValueEditDialog.js";
import { MdsHWLoadDataDialog } from "../../../../../modules/mds/dialogs/MdsHWLoadDataDialog.js";
import { DialogHelper, nextRunLoop } from "../../../test-helpers.js";

describe("MdsHWLoadDataDialog tests", () => {
    let dialogHelper: DialogHelper;

    beforeAll(() => {
        dialogHelper = new DialogHelper("mdsHWLoadDataDialog");
    });

    it("Test render MdsHWLoadDataDialog", () => {
        const { container, unmount } = render(
            <MdsHWLoadDataDialog
                onClose={vi.fn()}
            />,
        );
        expect(container).toMatchSnapshot();

        unmount();
    });

    it("Test call onClose with DialogResponseClosure.Accept", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const dialogRef = createRef<MdsHWLoadDataDialog>();
        const onClose = vi.fn();
        const { unmount } = render(
            <MdsHWLoadDataDialog
                ref={dialogRef}
                onClose={onClose}
            />,
        );

        await nextRunLoop();
        expect(dialogRef.current).toBeDefined();

        const request: IDialogRequest = {
            type: MdsDialogType.MdsHeatWaveLoadData,
            id: "mdsHWLoadDataDialog",
            values: {
                allSchemas: ["schema1", "schema2"],
                selectedSchemas: ["schema1"],
            },
        };
        const title = "Test Title";

        await act(() => {
            dialogRef.current!.show(request, title);
        });

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        await act(async () => {
            await dialogHelper.clickOk();
        });

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledWith(DialogResponseClosure.Accept, {
            disableUnsupportedColumns: true,
            enableMemoryCheck: true,
            excludeList: "",
            mode: "normal",
            optimizeLoadParallelism: true,
            output: "normal",
            schemas: [
                "schema1",
            ],
            sqlMode: "",
        });

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        unmount();
    });

    it("Test call onClose with DialogResponseClosure.Decline", async () => {
        const dialogRef = createRef<MdsHWLoadDataDialog>();
        const onClose = vi.fn();
        const { unmount } = render(
            <MdsHWLoadDataDialog
                ref={dialogRef}
                onClose={onClose}
            />,
        );

        await nextRunLoop();
        expect(dialogRef.current).toBeDefined();

        const mainSection: IDialogSection = {
            values: {
                schemas: { value: [], type: "set", tagSet: [] },
                excludeList: { value: "invalid", type: "text" },
            },
        };

        await dialogRef.current!.handleCloseDialog(DialogResponseClosure.Decline,
            { sections: new Map<string, IDialogSection>([["mainSection", mainSection]]) });
        expect(onClose).toHaveBeenCalledWith(DialogResponseClosure.Decline);

        unmount();
    });

    it("Test call onClose with DialogResponseClosure.Cancel", async () => {
        const dialogRef = createRef<MdsHWLoadDataDialog>();
        const onClose = vi.fn();
        const { unmount } = render(
            <MdsHWLoadDataDialog
                ref={dialogRef}
                onClose={onClose}
            />,
        );

        await nextRunLoop();
        expect(dialogRef.current).toBeDefined();

        const mainSection: IDialogSection = {
            values: {
                schemas: { value: [], type: "set", tagSet: [] },
                excludeList: { value: "invalid", type: "text" },
            },
        };

        await dialogRef.current!.handleCloseDialog(DialogResponseClosure.Cancel,
            { sections: new Map<string, IDialogSection>([["mainSection", mainSection]]) });
        expect(onClose).toHaveBeenCalledWith(DialogResponseClosure.Cancel);

        unmount();
    });

    it("Test validate the input", async () => {
        const request: IDialogRequest = {
            type: MdsDialogType.MdsHeatWaveLoadData,
            id: "mdsHWLoadDataDialog",
            values: {
                allSchemas: [],
                selectedSchemas: [],
            },
        };

        const title = "Test Title";
        const dialogRef = createRef<MdsHWLoadDataDialog>();
        const onClose = vi.fn();
        const { unmount } = render(
            <MdsHWLoadDataDialog
                ref={dialogRef}
                onClose={onClose}
            />,
        );

        await nextRunLoop();
        expect(dialogRef.current).toBeDefined();

        dialogRef.current!.show(request, title);

        const mainSection: IDialogSection = {
            values: {
                schemas: { value: [], type: "set", tagSet: [] },
                excludeList: { value: "invalid", type: "text" },
            },
        };

        const validations = await dialogRef.current!.validateInput(true, {
            sections: new Map<string, IDialogSection>([["mainSection", mainSection]]),
        });

        expect(validations.messages).toEqual({
            schemas: "At least one schema needs to be selected.",
            excludeList:
                "The Exclude List needs to contain a list of quoted object names, " +
                "e.g.\"mySchema.myTable\", \"myOtherSchema.myOtherTable\"",
        });

        unmount();
    });
});
