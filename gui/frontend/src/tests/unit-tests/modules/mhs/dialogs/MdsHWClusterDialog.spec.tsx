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

import { render } from "@testing-library/preact";
import { createRef } from "preact";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { DialogResponseClosure, IDialogRequest, MdsDialogType } from "../../../../../app-logic/general-types.js";
import { IDialogSection, IDialogValues } from "../../../../../components/Dialogs/ValueEditDialog.js";
import { MdsHWClusterDialog } from "../../../../../modules/mds/dialogs/MdsHWClusterDialog.js";
import { sleep } from "../../../../../utilities/helpers.js";
import { DialogHelper, nextProcessTick, nextRunLoop } from "../../../test-helpers.js";

describe("MdsHWClusterDialog tests", () => {
    let dialogHelper: DialogHelper;

    beforeAll(() => {
        dialogHelper = new DialogHelper("mdsHWClusterDialog");
    });

    it("Test render MdsHWClusterDialog", () => {
        const { container, unmount } = render(
            <MdsHWClusterDialog
                onClose={vi.fn()}
            />,
        );
        expect(container).toMatchSnapshot();

        unmount();
    });

    it("Test call onClose with DialogResponseClosure.Accept", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const dialogRef = createRef<MdsHWClusterDialog>();
        const onCloseMock = vi.fn();
        const { unmount } = render(
            <MdsHWClusterDialog
                ref={dialogRef}
                onClose={onCloseMock}
            />,
        );

        await nextRunLoop();
        expect(dialogRef.current).toBeDefined();

        const request: IDialogRequest = {
            type: MdsDialogType.MdsHeatWaveCluster,
            id: "mdsHWClusterDialog",
            parameters: {
                shapes: [
                    { name: "shape1" },
                    { name: "shape2" },
                ],
            },
            values: {
                shapeName: "shape1",
                clusterSize: 4,
            },
        };
        const title = "Test Title";

        dialogRef.current!.show(request, title);

        await nextProcessTick();
        await sleep(500);

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        await dialogHelper.clickOk();

        expect(onCloseMock).toHaveBeenCalledTimes(1);
        expect(onCloseMock).toHaveBeenCalledWith(DialogResponseClosure.Accept, {
            clusterSize: 4,
            shapeName: "shape1",
        });

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        unmount();
    });

    it("Test call close dialog that not set shape default with Ok button", async () => {
        let portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(0);

        const dialogRef = createRef<MdsHWClusterDialog>();
        const { unmount } = render(
            <MdsHWClusterDialog
                ref={dialogRef}
                onClose={vi.fn()}
            />,
        );

        await nextRunLoop();
        expect(dialogRef.current).toBeDefined();

        const request: IDialogRequest = {
            type: MdsDialogType.MdsHeatWaveCluster,
            id: "mdsHWClusterDialog",
            parameters: {
                shapes: [
                    { name: "shape1" },
                    { name: "shape2" },
                ],
            },
            values: {
            },
        };
        const title = "Test Title";

        dialogRef.current!.show(request, title);

        await nextProcessTick();
        await sleep(500);

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        await dialogHelper.clickOk();

        portals = document.getElementsByClassName("portal");
        expect(portals.length).toBe(1);

        unmount();
    });

    it("Test call onClose with DialogResponseClosure.Decline", async () => {
        const onClose = vi.fn();

        const dialogRef = createRef<MdsHWClusterDialog>();
        const { unmount } = render(
            <MdsHWClusterDialog
                ref={dialogRef}
                onClose={onClose}
            />,
        );

        await nextRunLoop();
        expect(dialogRef.current).toBeDefined();

        const values: IDialogValues = {
            sections: new Map<string, IDialogSection>([
                [
                    "mainSection",
                    {
                        values: {
                            clusterSize: { value: 4, type: "number" },
                            shapeName: { value: "shape1", type: "text" },
                        },
                    },
                ],
            ]),
        };
        await dialogRef.current!.handleCloseDialog(DialogResponseClosure.Decline, values);

        expect(onClose).toHaveBeenCalledWith(DialogResponseClosure.Decline);

        unmount();
    });

    it("Test call onClose with DialogResponseClosure.Cancel", async () => {
        const onClose = vi.fn();

        const dialogRef = createRef<MdsHWClusterDialog>();
        const { unmount } = render(
            <MdsHWClusterDialog
                ref={dialogRef}
                onClose={onClose}
            />,
        );

        await nextRunLoop();
        expect(dialogRef.current).toBeDefined();

        const values: IDialogValues = {
            sections: new Map<string, IDialogSection>([
                [
                    "mainSection",
                    {
                        values: {
                            clusterSize: { value: 4, type: "number" },
                            shapeName: { value: "shape1", type: "text" },
                        },
                    },
                ],
            ]),
        };

        await dialogRef.current!.handleCloseDialog(DialogResponseClosure.Cancel, values);

        expect(onClose).toHaveBeenCalledWith(DialogResponseClosure.Cancel);

        unmount();
    });

    it("Test return validation messages", async () => {
        const values: IDialogValues = {
            sections: new Map<string, IDialogSection>([
                [
                    "mainSection",
                    {
                        values: {
                            clusterSize: { value: undefined, type: "number" },
                        },
                    },
                ],
            ]),
        };

        const dialogRef = createRef<MdsHWClusterDialog>();
        const { unmount } = render(
            <MdsHWClusterDialog
                ref={dialogRef}
                onClose={vi.fn()}
            />,
        );

        await nextRunLoop();
        expect(dialogRef.current).toBeDefined();

        const result = await dialogRef.current!.validateInput(true, values);

        expect(result.messages).toEqual({ name: "The cluster size must be specified." });
        expect(result.requiredContexts).toEqual([]);

        unmount();
    });

    it("Test return empty validation messages", async () => {
        const values: IDialogValues = {
            sections: new Map<string, IDialogSection>([
                [
                    "mainSection",
                    {
                        values: {
                            clusterSize: { value: 4, type: "number" },
                        },
                    },
                ],
            ]),
        };

        const dialogRef = createRef<MdsHWClusterDialog>();
        const { unmount } = render(
            <MdsHWClusterDialog
                ref={dialogRef}
                onClose={vi.fn()}
            />,
        );

        await nextRunLoop();
        expect(dialogRef.current).toBeDefined();

        const result = await dialogRef.current!.validateInput(true, values);

        expect(result.messages).toEqual({});
        expect(result.requiredContexts).toEqual([]);

        unmount();
    });
});
