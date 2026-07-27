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
import { describe, expect, it } from "vitest";

import {
    AdministrationPageBody,
    AdministrationPageFrame,
    AdministrationPageHeading,
} from "../../../../modules/db-editor/AdministrationPageFrame.js";

describe("Administration page frame", (): void => {
    it("renders heading slots and page content", (): void => {
        const { getByTestId, getByText } = render(
            <AdministrationPageFrame>
                <AdministrationPageHeading
                    heading="Client Connections"
                    icon={<span data-testid="pageIcon">icon</span>}
                    subtitle="MySQL 9.6"
                    status={<span data-testid="pageStatus">running</span>}
                    actions={<button type="button">Configure</button>}
                />
                <AdministrationPageBody>
                    <div data-testid="pageContent">Connection metrics</div>
                </AdministrationPageBody>
            </AdministrationPageFrame>,
        );

        expect(getByText("Client Connections").tagName).toBe("H1");
        expect(getByTestId("pageIcon").textContent).toBe("icon");
        expect(getByText("MySQL 9.6").textContent).toBe("MySQL 9.6");
        expect(getByTestId("pageStatus").textContent).toBe("running");
        expect(getByText("Configure").tagName).toBe("BUTTON");
        expect(getByTestId("pageContent").textContent).toBe("Connection metrics");
    });
});
