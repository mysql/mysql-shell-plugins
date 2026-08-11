/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { createRef } from "preact";

import { describe, expect, it, vi } from "vitest";

import { CdmEntityType, type ICdmRoutineEntry } from "../../../../data-models/ConnectionDataModel.js";
import { SidebarCommandHandler } from "../../../../modules/db-editor/SidebarCommandHandler.js";

interface RoutineStatementHandler {
    getRoutineInvocationStatement(entry: ICdmRoutineEntry): Promise<string>;
}

const createHandler = (): RoutineStatementHandler => {
    const handler = new SidebarCommandHandler({} as never, createRef(), createRef(), createRef());

    return handler as unknown as RoutineStatementHandler;
};

const createRoutine = (type: CdmEntityType.StoredProcedure | CdmEntityType.StoredFunction,
    rows: unknown[] = []): { entry: ICdmRoutineEntry; executeService: ReturnType<typeof vi.fn>; } => {
    const executeService = vi.fn().mockResolvedValue({ rows });

    return {
        entry: {
            caption: "process`order",
            schema: "app`data",
            type,
            connection: { backend: { executeService } },
        } as unknown as ICdmRoutineEntry,
        executeService,
    };
};

describe("SidebarCommandHandler routine invocation statements", () => {
    it("creates a CALL template with input markers and output variables in declaration order", async () => {
        const { entry, executeService } = createRoutine(CdmEntityType.StoredProcedure, [
            ["order_id", "IN"], ["status", "OUT"], ["total", "INOUT"],
        ]);

        await expect(createHandler().getRoutineInvocationStatement(entry))
            .resolves.toBe("CALL `app``data`.`process``order`(<order_id>, @status, @total);");
        expect(executeService).toHaveBeenCalledWith(expect.stringContaining("ORDINAL_POSITION > 0"), [
            "app`data", "process`order", "PROCEDURE",
        ]);
    });

    it("creates a function-call template with no parameters", async () => {
        const { entry } = createRoutine(CdmEntityType.StoredFunction);

        await expect(createHandler().getRoutineInvocationStatement(entry))
            .resolves.toBe("`app``data`.`process``order`();");
    });

    it("creates a function-call template with a single parameter marker", async () => {
        const { entry, executeService } = createRoutine(CdmEntityType.StoredFunction, [["customer_id"]]);

        await expect(createHandler().getRoutineInvocationStatement(entry))
            .resolves.toBe("`app``data`.`process``order`(<customer_id>);");
        expect(executeService).toHaveBeenCalledWith(expect.stringContaining("ORDINAL_POSITION > 0"), [
            "app`data", "process`order", "FUNCTION",
        ]);
    });
});
