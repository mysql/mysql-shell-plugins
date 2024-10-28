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

import { DialogResponseClosure, DialogType } from "../../../../app-logic/general-types.js";
import { ShellPromptResponseType } from "../../../../communication/Protocol.js";
import { ShellPromptHandler } from "../../../../modules/common/ShellPromptHandler.js";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";

describe("Shell Prompt Handler Tests", (): void => {
    it("ShellPrompt Base Test", () => {
        const handler = new ShellPromptHandler();

        // The handler only implements specific requisition handlers, no properties or similar.
        // Hence there's not much to test in this base test.
        expect(handler).toBeDefined();
    });

    it("ShellPrompt 'password' prompt", () => {
        const handler = new ShellPromptHandler();
        const backend = new ShellInterfaceSqlEditor();

        // The handler only implements specific requisition handlers, no properties or similar.
        // Hence there's not much to test in this base test.
        expect(handler).toBeDefined();

        const result: boolean = ShellPromptHandler.handleShellPrompt({
            prompt: "",
            type: "password",
            title: "<Some Title>",
            description: ["<This is a description>"],
        },
            "<requestId>", backend);

        expect(result).toBeTruthy();
    });

    it("ShellPrompt 'confirm' prompt", () => {
        const handler = new ShellPromptHandler();
        const backend = new ShellInterfaceSqlEditor();

        // The handler only implements specific requisition handlers, no properties or similar.
        // Hence there's not much to test in this base test.
        expect(handler).toBeDefined();

        const result: boolean = ShellPromptHandler.handleShellPrompt({
            prompt: "<some question>",
            type: "confirm",
            title: "<Some Title>",
            description: ["<This is a description>"],
        },
            "requestId", backend);

        expect(result).toBeTruthy();
    });

    it("ShellPrompt 'select' prompt", () => {
        const handler = new ShellPromptHandler();
        const backend = new ShellInterfaceSqlEditor();

        // The handler only implements specific requisition handlers, no properties or similar.
        // Hence there's not much to test in this base test.
        expect(handler).toBeDefined();

        const result: boolean = ShellPromptHandler.handleShellPrompt({
            prompt: "<some question>",
            type: "select",
            title: "<Some Title>",
            description: ["<This is a description>"],
            options: [],
        },
            "<requestId>", backend);

        expect(result).toBeTruthy();
    });

    it("ShellPrompt 'text' prompt", () => {
        const handler = new ShellPromptHandler();
        const backend = new ShellInterfaceSqlEditor();

        // The handler only implements specific requisition handlers, no properties or similar.
        // Hence there's not much to test in this base test.
        expect(handler).toBeDefined();

        const result: boolean = ShellPromptHandler.handleShellPrompt({
            prompt: "<some question>",
            type: "text",
            title: "<Some Title>",
            description: ["<This is a description>"],
        },
            "<requestId>", backend);

        expect(result).toBeTruthy();
    });

    it("ShellPrompt 'acceptPassword' test", async () => {
        const handler = new ShellPromptHandler();
        const backend = new ShellInterfaceSqlEditor();

        backend.sendReply = (requestId: string, type: ShellPromptResponseType, reply: string,
            moduleSessionId?: string): Promise<void> => {
            expect(requestId).toEqual("<requestId>");
            expect(type).toEqual(ShellPromptResponseType.Ok);
            expect(reply).toEqual("<password>");
            expect(moduleSessionId).toEqual("<moduleSessionId>");

            return Promise.resolve();
        };

        // The handler only implements specific requisition handlers, no properties or similar.
        // Hence there's not much to test in this base test.
        expect(handler).toBeDefined();
        let result = await ShellPromptHandler.acceptPassword({
            request: {
                requestId: "<requestId>",
                caption: "<Some Title>",
                description: ["<This is a description>"],
                service: "mysql",
                user: "root",
                payload: {
                    moduleSessionId: "<moduleSessionId>",
                },
            },
            password: "<password>",
        });

        expect(result).toBeFalsy();

        result = await ShellPromptHandler.acceptPassword({
            request: {
                requestId: "<requestId>",
                caption: "<Some Title>",
                description: ["<This is a description>"],
                service: "mysql",
                user: "root",
                payload: {
                    moduleSessionId: "<moduleSessionId>",
                    backend,
                },
            },
            password: "<password>",
        });

        expect(result).toBeTruthy();
    });

    it("ShellPrompt 'cancelPassword' test", async () => {
        const handler = new ShellPromptHandler();
        const backend = new ShellInterfaceSqlEditor();

        backend.sendReply = (requestId: string, type: ShellPromptResponseType, reply: string,
            moduleSessionId?: string): Promise<void> => {
            expect(requestId).toEqual("<requestId>");
            expect(type).toEqual(ShellPromptResponseType.Cancel);
            expect(reply).toEqual("");
            expect(moduleSessionId).toEqual("<moduleSessionId>");

            return Promise.resolve();
        };

        // The handler only implements specific requisition handlers, no properties or similar.
        // Hence there's not much to test in this base test.
        expect(handler).toBeDefined();
        let result = await ShellPromptHandler.cancelPassword({
            requestId: "<requestId>",
            caption: "<Some Title>",
            description: ["<This is a description>"],
            service: "mysql",
            user: "root",
            payload: {
                moduleSessionId: "<moduleSessionId>",
            },
        });

        expect(result).toBeFalsy();

        result = await ShellPromptHandler.cancelPassword({
            requestId: "<requestId>",
            caption: "<Some Title>",
            description: ["<This is a description>"],
            service: "mysql",
            user: "root",
            payload: {
                moduleSessionId: "<moduleSessionId>",
                backend,
            },
        });

        expect(result).toBeTruthy();
    });


    it("ShellPrompt 'handleDialogResponse' test failures", async () => {
        const handler = new ShellPromptHandler();
        const backend = new ShellInterfaceSqlEditor();

        // The handler only implements specific requisition handlers, no properties or similar.
        // Hence there's not much to test in this base test.
        expect(handler).toBeDefined();
        let result = await ShellPromptHandler.handleDialogResponse({
            id: "id",
            type: DialogType.Confirm,
            closure: DialogResponseClosure.Accept,
            values: {},
            data: {},
        });

        expect(result).toBeFalsy();

        result = await ShellPromptHandler.handleDialogResponse({
            id: "id",
            type: DialogType.Confirm,
            closure: DialogResponseClosure.Accept,
            values: {},
            data: {
                backend,
            },
        });

        expect(result).toBeFalsy();

        result = await ShellPromptHandler.handleDialogResponse({
            id: "id",
            type: DialogType.Confirm,
            closure: DialogResponseClosure.Accept,
            values: {},
            data: {
                requestId: "<requestId>",
            },
        });

        expect(result).toBeFalsy();
    });

    it("ShellPrompt 'handleDialogResponse.confirm' test", async () => {
        const handler = new ShellPromptHandler();
        const backend = new ShellInterfaceSqlEditor();
        const expectedReply = {
            type: ShellPromptResponseType.Ok,
            reply: "accept",
        };

        backend.sendReply = (requestId: string, type: ShellPromptResponseType, reply: string,
            moduleSessionId?: string): Promise<void> => {
            expect(requestId).toEqual("<requestId>");
            expect(type).toEqual(expectedReply.type);
            expect(reply).toEqual(expectedReply.reply);
            expect(moduleSessionId).toEqual("<moduleSessionId>");

            return Promise.resolve();
        };

        // The handler only implements specific requisition handlers, no properties or similar.
        // Hence there's not much to test in this base test.
        expect(handler).toBeDefined();
        let result = await ShellPromptHandler.handleDialogResponse({
            id: "shellConfirm",
            type: DialogType.Confirm,
            closure: DialogResponseClosure.Accept,
            values: {},
            data: {
                backend,
                requestId: "<requestId>",
            },
        });

        expect(result).toBeFalsy();

        result = await ShellPromptHandler.handleDialogResponse({
            id: "shellConfirm",
            type: DialogType.Confirm,
            closure: DialogResponseClosure.Accept,
            values: {},
            data: {
                backend,
                requestId: "<requestId>",
                moduleSessionId: "<moduleSessionId>",
            },
        });

        expect(result).toBeFalsy();

        result = await ShellPromptHandler.handleDialogResponse({
            id: "shellConfirm",
            type: DialogType.Confirm,
            closure: DialogResponseClosure.Accept,
            values: {},
            data: {
                backend,
                requestId: "<requestId>",
                moduleSessionId: "<moduleSessionId>",
                replies: new Map<DialogResponseClosure, string>([
                    [DialogResponseClosure.Accept, "accept"],
                ]),
            },
        });

        expect(result).toBeTruthy();

        expectedReply.type = ShellPromptResponseType.Cancel;
        expectedReply.reply = "";
        result = await ShellPromptHandler.handleDialogResponse({
            id: "shellConfirm",
            type: DialogType.Confirm,
            closure: DialogResponseClosure.Decline,
            values: {},
            data: {
                backend,
                requestId: "<requestId>",
                moduleSessionId: "<moduleSessionId>",
                replies: new Map<DialogResponseClosure, string>([
                    [DialogResponseClosure.Cancel, "cancel"],
                ]),
            },
        });

        expect(result).toBeTruthy();
    });

    it("ShellPrompt 'handleDialogResponse.select' test", async () => {
        const handler = new ShellPromptHandler();
        const backend = new ShellInterfaceSqlEditor();
        const expectedReply = {
            type: ShellPromptResponseType.Cancel,
            reply: "",
        };

        // The handler only implements specific requisition handlers, no properties or similar.
        // Hence there's not much to test in this base test.
        expect(handler).toBeDefined();

        backend.sendReply = (requestId: string, type: ShellPromptResponseType, reply: string,
            moduleSessionId?: string): Promise<void> => {
            expect(requestId).toEqual("<requestId>");
            expect(type).toEqual(expectedReply.type);
            expect(reply).toEqual(expectedReply.reply);
            expect(moduleSessionId).toEqual("<moduleSessionId>");

            return Promise.resolve();
        };

        let result = await ShellPromptHandler.handleDialogResponse({
            id: "shellConfirm",
            type: DialogType.Select,
            closure: DialogResponseClosure.Decline,
            values: {},
            data: {
                backend,
                requestId: "<requestId>",
                moduleSessionId: "<moduleSessionId>",
            },
        });

        expect(result).toBeTruthy();

        expectedReply.type = ShellPromptResponseType.Ok;
        expectedReply.reply = "<some value>";

        result = await ShellPromptHandler.handleDialogResponse({
            id: "shellConfirm",
            type: DialogType.Select,
            closure: DialogResponseClosure.Accept,
            values: {
                input: "<some value>",
            },
            data: {
                backend,
                requestId: "<requestId>",
                moduleSessionId: "<moduleSessionId>",
            },
        });

        expect(result).toBeTruthy();
    });

    it("ShellPrompt 'handleDialogResponse.prompt' test", async () => {
        const handler = new ShellPromptHandler();
        const backend = new ShellInterfaceSqlEditor();
        const expectedReply = {
            type: ShellPromptResponseType.Cancel,
            reply: "",
        };

        // The handler only implements specific requisition handlers, no properties or similar.
        // Hence there's not much to test in this base test.
        expect(handler).toBeDefined();

        backend.sendReply = (requestId: string, type: ShellPromptResponseType, reply: string,
            moduleSessionId?: string): Promise<void> => {
            expect(requestId).toEqual("<requestId>");
            expect(type).toEqual(expectedReply.type);
            expect(reply).toEqual(expectedReply.reply);
            expect(moduleSessionId).toEqual("<moduleSessionId>");

            return Promise.resolve();
        };

        let result = await ShellPromptHandler.handleDialogResponse({
            id: "shellConfirm",
            type: DialogType.Prompt,
            closure: DialogResponseClosure.Decline,
            values: {},
            data: {
                backend,
                requestId: "<requestId>",
                moduleSessionId: "<moduleSessionId>",
            },
        });

        expect(result).toBeTruthy();

        expectedReply.type = ShellPromptResponseType.Ok;
        expectedReply.reply = "<some value>";

        result = await ShellPromptHandler.handleDialogResponse({
            id: "shellConfirm",
            type: DialogType.Prompt,
            closure: DialogResponseClosure.Accept,
            values: {
                input: "<some value>",
            },
            data: {
                backend,
                requestId: "<requestId>",
                moduleSessionId: "<moduleSessionId>",
            },
        });

        expect(result).toBeTruthy();
    });
});
