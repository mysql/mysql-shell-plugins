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

import { SignatureHelpProvider } from "../../../../../components/ui/CodeEditor/SignatureHelpProvider";
import { ExecutionContext, PresentationInterface } from "../../../../../script-execution";
import { ScriptingLanguageServices } from "../../../../../script-execution/ScriptingLanguageServices";
import { models, position } from "../../../__mocks__/CodeEditorMocks";

jest.mock("../../../../../script-execution/PresentationInterface");

describe("RenameProvider tests", () => {

    it("Create instance and init", () => {
        const shp = new SignatureHelpProvider();
        expect(shp).not.toBeNull();

        let result = shp.provideSignatureHelp(models, position);
        expect(result).toBe(undefined);

        const pi = new (PresentationInterface as unknown as jest.Mock<PresentationInterface>)();
        expect(pi).toBeDefined();

        const execContext = new ExecutionContext(pi);
        models.executionContexts.contextFromPosition = jest.fn().mockReturnValue(
            execContext,
        );
        jest.spyOn(execContext, "isInternal", "get").mockReturnValue(true);
        result = shp.provideSignatureHelp(models, position);
        expect(result).toBe(undefined);

        const services = ScriptingLanguageServices.instance;
        services.findReferences = jest.fn().mockReturnValue({
            uri: "",
            range: null,
        });

        jest.spyOn(execContext, "isInternal", "get").mockReturnValue(false);
        const getSignatureHelp = jest.spyOn(services, "getSignatureHelp");
        void shp.provideSignatureHelp(models, position);
        expect(getSignatureHelp).toBeCalled();
    });
});
