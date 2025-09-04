/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

/* eslint-disable dot-notation */

import { render } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CellComponent } from "tabulator-tables";

import { createRef } from "preact";
import { IMdsChatData, IMdsChatTable } from "../../../../communication/ProtocolMds.js";
import {
    ChatOptionAction, ChatOptions, IChatOptionsProperties, IChatOptionsState,
} from "../../../../components/Chat/ChatOptions.js";
import { IAccordionProperties } from "../../../../components/ui/Accordion/Accordion.js";
import { IInputChangeProperties } from "../../../../components/ui/Input/Input.js";
import { nextRunLoop } from "../../test-helpers.js";

describe("ChatOptions", () => {
    it("Standard Rendering (snapshot)", () => {
        const { container, unmount } = render(
            <ChatOptions
                savedState={{
                    chatOptionsExpanded: true,
                    chatOptionsWidth: 300,
                    options: {} as IMdsChatData,
                }}
                onAction={vi.fn()}
                onChatOptionsStateChange={vi.fn()}
            />,
        );

        expect(container).toMatchSnapshot();
        unmount();
    });

    describe("getDerivedStateFromProps", () => {
        const mockOnAction = vi.fn();
        const mockOnChatOptionsStateChange = vi.fn();

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should return savedState when chatOptionsExpanded is undefined", () => {
            const props = {
                savedState: {
                    chatOptionsExpanded: true,
                    chatOptionsWidth: 300,
                    options: {} as IMdsChatData,
                },
                onAction: mockOnAction,
                onChatOptionsStateChange: mockOnChatOptionsStateChange,
            };

            const state = {
                chatOptionsExpanded: undefined,
                chatOptionsWidth: 0,
            } as unknown as IChatOptionsState;

            const result = ChatOptions.getDerivedStateFromProps(props, state);
            expect(result).toBe(props.savedState);
        });

        it("should return empty object when chatOptionsExpanded is defined", () => {
            const props = {
                savedState: {
                    chatOptionsExpanded: true,
                    chatOptionsWidth: 300,
                    options: {} as IMdsChatData,
                },
                onAction: mockOnAction,
                onChatOptionsStateChange: mockOnChatOptionsStateChange,
            };

            const state = {
                chatOptionsExpanded: false,
                chatOptionsWidth: 200,
            } as unknown as IChatOptionsState;

            const result = ChatOptions.getDerivedStateFromProps(props, state);
            expect(result).toEqual({});
        });

        it("should handle undefined savedState", () => {
            const props = {
                savedState: undefined,
                onAction: mockOnAction,
                onChatOptionsStateChange: mockOnChatOptionsStateChange,
            };

            const state = {
                chatOptionsExpanded: undefined,
                chatOptionsWidth: 0,
            } as unknown as IChatOptionsState;

            const result = ChatOptions.getDerivedStateFromProps(
                props as unknown as IChatOptionsProperties,
                state,
            );
            expect(result).toBeUndefined();
        });
    });

    describe("handleSectionExpand", () => {
        const mockOnAction = vi.fn();
        const mockOnChatOptionsStateChange = vi.fn();

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should update section state when expanding a section", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleSectionExpand"]({} as IAccordionProperties, "testSection", true);

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                sectionStates: new Map([["testSection", { expanded: true }]]),
            });

            unmount();
        });

        it("should update existing section state", async () => {
            const initialSectionStates = new Map([
                ["existingSection", { expanded: false, size: 100 }],
            ]);

            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: initialSectionStates,
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleSectionExpand"]({} as IAccordionProperties, "existingSection", true);

            const expectedMap = new Map([
                ["existingSection", { expanded: true, size: 100 }],
            ]);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                sectionStates: expectedMap,
            });

            unmount();
        });

        it("should set returnPrompt to true when expanding promptSection", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {
                            returnPrompt: false,
                        },
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleSectionExpand"]({} as IAccordionProperties, "promptSection", true);

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(2);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    returnPrompt: true,
                },
            });
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                sectionStates: new Map([["promptSection", { expanded: true }]]),
            });

            unmount();
        });

        it("should not set returnPrompt when expanding promptSection if already true", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {
                            returnPrompt: true,
                        },
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleSectionExpand"]({} as IAccordionProperties, "promptSection", true);

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                sectionStates: new Map([["promptSection", { expanded: true }]]),
            });

            unmount();
        });
    });

    describe("handleStartNewChatClick", () => {
        const mockOnAction = vi.fn();
        const mockOnChatOptionsStateChange = vi.fn();

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should trigger StartNewChat action", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleStartNewChatClick"]({} as MouseEvent, {});

            expect(mockOnAction).toHaveBeenCalledTimes(1);
            expect(mockOnAction).toHaveBeenCalledWith(ChatOptionAction.StartNewChat);

            unmount();
        });

        it("should handle keyboard event", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleStartNewChatClick"]({} as KeyboardEvent, {});

            expect(mockOnAction).toHaveBeenCalledTimes(1);
            expect(mockOnAction).toHaveBeenCalledWith(ChatOptionAction.StartNewChat);

            unmount();
        });
    });

    describe("handleSaveOptionsBtnClick", () => {
        const mockOnAction = vi.fn();
        const mockOnChatOptionsStateChange = vi.fn();

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should trigger SaveChatOptions action", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleSaveOptionsBtnClick"]({} as MouseEvent, {});

            expect(mockOnAction).toHaveBeenCalledTimes(1);
            expect(mockOnAction).toHaveBeenCalledWith(ChatOptionAction.SaveChatOptions);

            unmount();
        });

        it("should handle keyboard event", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleSaveOptionsBtnClick"]({} as KeyboardEvent, {});

            expect(mockOnAction).toHaveBeenCalledTimes(1);
            expect(mockOnAction).toHaveBeenCalledWith(ChatOptionAction.SaveChatOptions);

            unmount();
        });
    });

    describe("handleLoadOptionsBtnClick", () => {
        const mockOnAction = vi.fn();
        const mockOnChatOptionsStateChange = vi.fn();

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should trigger LoadChatOptions action", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleLoadOptionsBtnClick"]({} as MouseEvent, {});

            expect(mockOnAction).toHaveBeenCalledTimes(1);
            expect(mockOnAction).toHaveBeenCalledWith(ChatOptionAction.LoadChatOptions);

            unmount();
        });

        it("should handle keyboard event", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleLoadOptionsBtnClick"]({} as KeyboardEvent, {});

            expect(mockOnAction).toHaveBeenCalledTimes(1);
            expect(mockOnAction).toHaveBeenCalledWith(ChatOptionAction.LoadChatOptions);

            unmount();
        });
    });

    describe("handleSchemaChange", () => {
        const mockOnAction = vi.fn();
        const mockOnChatOptionsStateChange = vi.fn();

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should update schema name when selecting a specific schema", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {
                            schemaName: "oldSchema",
                        },
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleSchemaChange"](true, new Set(["newSchema"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    schemaName: "newSchema",
                },
            });

            unmount();
        });

        it("should set schema name to undefined when selecting 'All Schemas'", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {
                            schemaName: "oldSchema",
                        },
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleSchemaChange"](true, new Set(["schemaDropdownAllSchemas"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    schemaName: undefined,
                },
            });

            unmount();
        });

        it("should preserve other options when updating schema", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {
                            schemaName: "oldSchema",
                            returnPrompt: true,
                            lockTableList: false,
                        },
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleSchemaChange"](true, new Set(["newSchema"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    schemaName: "newSchema",
                    returnPrompt: true,
                    lockTableList: false,
                },
            });

            unmount();
        });
    });

    describe("handleModelIdChange", () => {
        const mockOnAction = vi.fn();
        const mockOnChatOptionsStateChange = vi.fn();

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should update modelId when modelOptions exist", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {
                            modelOptions: {
                                modelId: "oldModel",
                                temperature: 0.7,
                            },
                        },
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleModelIdChange"](true, new Set(["newModel"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    modelOptions: {
                        modelId: "newModel",
                        temperature: 0.7,
                    },
                },
            });

            unmount();
        });

        it("should create modelOptions when they don't exist", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {},
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleModelIdChange"](true, new Set(["newModel"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    modelOptions: {
                        modelId: "newModel",
                    },
                },
            });

            unmount();
        });

        it("should preserve other options when updating modelId", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {
                            returnPrompt: true,
                            modelOptions: {
                                modelId: "oldModel",
                                temperature: 0.7,
                                maxTokens: 100,
                            },
                        },
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleModelIdChange"](true, new Set(["newModel"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    returnPrompt: true,
                    modelOptions: {
                        modelId: "newModel",
                        temperature: 0.7,
                        maxTokens: 100,
                    },
                },
            });

            unmount();
        });
    });

    describe("handleModelLanguageChange", () => {
        const mockOnAction = vi.fn();
        const mockOnChatOptionsStateChange = vi.fn();

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should update model language when modelOptions exist", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {
                            modelOptions: {
                                modelId: "model1",
                                language: "fr",
                            },
                        },
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleModelLanguageChange"](true, new Set(["en"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    modelOptions: {
                        modelId: "model1",
                        language: "en",
                    },
                },
            });

            unmount();
        });

        it("should create modelOptions when they don't exist", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {},
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleModelLanguageChange"](true, new Set(["es"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    modelOptions: {
                        language: "es",
                    },
                },
            });

            unmount();
        });

        it("should clear languageOptions.language when setting non-English model language", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {
                            modelOptions: {
                                modelId: "model1",
                                language: "en",
                            },
                            languageOptions: {
                                language: "fr",
                                modelId: "translator1",
                            },
                        },
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleModelLanguageChange"](true, new Set(["es"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    modelOptions: {
                        modelId: "model1",
                        language: "es",
                    },
                    languageOptions: {
                        language: undefined,
                        modelId: "translator1",
                    },
                },
            });

            unmount();
        });

        it("should preserve languageOptions.language when setting English model language", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {
                            modelOptions: {
                                modelId: "model1",
                                language: "es",
                            },
                            languageOptions: {
                                language: "fr",
                                modelId: "translator1",
                            },
                        },
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleModelLanguageChange"](true, new Set(["en"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    modelOptions: {
                        modelId: "model1",
                        language: "en",
                    },
                    languageOptions: {
                        language: "fr",
                        modelId: "translator1",
                    },
                },
            });

            unmount();
        });
    });

    describe("handleLanguageModelIdChange", () => {
        const mockOnAction = vi.fn();
        const mockOnChatOptionsStateChange = vi.fn();

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should update modelId when languageOptions exist", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {
                            languageOptions: {
                                modelId: "oldTranslator",
                                language: "fr",
                            },
                        },
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleLanguageModelIdChange"](true, new Set(["newTranslator"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    languageOptions: {
                        modelId: "newTranslator",
                        language: "fr",
                    },
                },
            });

            unmount();
        });

        it("should create languageOptions when they don't exist", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {},
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleLanguageModelIdChange"](true, new Set(["newTranslator"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    languageOptions: {
                        modelId: "newTranslator",
                    },
                },
            });

            unmount();
        });

        it("should preserve other options when updating language modelId", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {
                            returnPrompt: true,
                            modelOptions: {
                                modelId: "model1",
                                language: "en",
                            },
                            languageOptions: {
                                modelId: "oldTranslator",
                                language: "fr",
                                translateUserPrompt: true,
                            },
                        },
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleLanguageModelIdChange"](true, new Set(["newTranslator"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    returnPrompt: true,
                    modelOptions: {
                        modelId: "model1",
                        language: "en",
                    },
                    languageOptions: {
                        modelId: "newTranslator",
                        language: "fr",
                        translateUserPrompt: true,
                    },
                },
            });

            unmount();
        });
    });

    describe("handlePreambleChange", () => {
        const mockOnAction = vi.fn();
        const mockOnChatOptionsStateChange = vi.fn();

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should update preamble when options exist", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {
                            preamble: "old preamble",
                        },
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            const mockEvent = {
                target: {
                    value: "new preamble",
                },
            } as unknown as InputEvent;

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handlePreambleChange"](mockEvent, {} as IInputChangeProperties);

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    preamble: "new preamble",
                },
            });

            unmount();
        });

        it("should create options with preamble when options don't exist", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            const mockEvent = {
                target: {
                    value: "new preamble",
                },
            } as unknown as InputEvent;

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handlePreambleChange"](mockEvent, {} as IInputChangeProperties);

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    preamble: "new preamble",
                },
            });

            unmount();
        });

        it("should preserve other options when updating preamble", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {
                            preamble: "old preamble",
                            returnPrompt: true,
                            modelOptions: {
                                modelId: "model1",
                                language: "en",
                            },
                        },
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            const mockEvent = {
                target: {
                    value: "new preamble",
                },
            } as unknown as InputEvent;

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handlePreambleChange"](mockEvent, {} as IInputChangeProperties);

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    preamble: "new preamble",
                    returnPrompt: true,
                    modelOptions: {
                        modelId: "model1",
                        language: "en",
                    },
                },
            });

            unmount();
        });

        it("should handle empty preamble value", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {
                            preamble: "old preamble",
                        },
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            const mockEvent = {
                target: {
                    value: "",
                },
            } as unknown as InputEvent;

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handlePreambleChange"](mockEvent, {} as IInputChangeProperties);

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    preamble: "",
                },
            });

            unmount();
        });
    });

    describe("handleTranslationLanguageChange", () => {
        const mockOnAction = vi.fn();
        const mockOnChatOptionsStateChange = vi.fn();

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should update translation language when languageOptions exist", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {
                            languageOptions: {
                                language: "es",
                                modelId: "translator1",
                            },
                        },
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleTranslationLanguageChange"](true, new Set(["fr"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    languageOptions: {
                        language: "fr",
                        modelId: "translator1",
                    },
                },
            });

            unmount();
        });

        it("should create languageOptions when they don't exist", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {},
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleTranslationLanguageChange"](true, new Set(["fr"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    languageOptions: {
                        language: "fr",
                    },
                },
            });

            unmount();
        });

        it("should set language to undefined when selecting 'noTranslation'", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {
                            languageOptions: {
                                language: "fr",
                                modelId: "translator1",
                            },
                        },
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleTranslationLanguageChange"](true, new Set(["noTranslation"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    languageOptions: {
                        language: undefined,
                        modelId: "translator1",
                    },
                },
            });

            unmount();
        });

        it("should preserve other options when updating translation language", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {
                            returnPrompt: true,
                            modelOptions: {
                                modelId: "model1",
                                language: "en",
                            },
                            languageOptions: {
                                language: "es",
                                modelId: "translator1",
                                translateUserPrompt: true,
                            },
                        },
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleTranslationLanguageChange"](true, new Set(["fr"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    returnPrompt: true,
                    modelOptions: {
                        modelId: "model1",
                        language: "en",
                    },
                    languageOptions: {
                        language: "fr",
                        modelId: "translator1",
                        translateUserPrompt: true,
                    },
                },
            });

            unmount();
        });
    });

    describe("handleModelOptionChange", () => {
        const mockOnAction = vi.fn();
        const mockOnChatOptionsStateChange = vi.fn();

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should update model option when modelOptions exist", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {
                            modelOptions: {
                                modelId: "model1",
                                temperature: 0.7,
                            },
                        },
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            const e: FocusEvent = {
                target: {
                    id: "temperature",
                    value: "0.9",
                },
            } as unknown as FocusEvent;

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleModelOptionChange"](e, {});

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    modelOptions: {
                        modelId: "model1",
                        temperature: 0.9,
                    },
                },
            });

            unmount();
        });

        it("should create modelOptions when they don't exist", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {},
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            const e: FocusEvent = {
                target: {
                    id: "temperature",
                    value: "0.9",
                },
            } as unknown as FocusEvent;

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleModelOptionChange"](e, {});

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    modelOptions: {
                        temperature: 0.9,
                    },
                },
            });

            unmount();
        });

        it("should preserve other options when updating model option", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {
                            returnPrompt: true,
                            modelOptions: {
                                modelId: "model1",
                                temperature: 0.7,
                                maxTokens: 1000,
                            },
                            languageOptions: {
                                language: "fr",
                                modelId: "translator1",
                            },
                        },
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            const e: FocusEvent = {
                target: {
                    id: "temperature",
                    value: "0.9",
                },
            } as unknown as FocusEvent;

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["handleModelOptionChange"](e, {});

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    returnPrompt: true,
                    modelOptions: {
                        modelId: "model1",
                        temperature: 0.9,
                        maxTokens: 1000,
                    },
                    languageOptions: {
                        language: "fr",
                        modelId: "translator1",
                    },
                },
            });

            unmount();
        });
    });

    describe("removeVectorTable", () => {
        const mockOnAction = vi.fn();
        const mockOnChatOptionsStateChange = vi.fn();

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should remove vector table from vectorTables array", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {
                            tables: [
                                { tableName: "table1", schemaName: "schema1" } as IMdsChatTable,
                                { tableName: "table2", schemaName: "schema2" } as IMdsChatTable,
                                { tableName: "table3", schemaName: "schema3" } as IMdsChatTable,
                            ],
                        },
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["removeVectorTable"]("schema1.table1", {});

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    tables: [
                        { tableName: "table2", schemaName: "schema2" },
                        { tableName: "table3", schemaName: "schema3" },
                    ],
                },
            });

            unmount();
        });

        it("should handle removing the last vector table", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {
                            tables: [{ tableName: "table1", schemaName: "schema1" } as IMdsChatTable],
                        },
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["removeVectorTable"]("schema1.table1", {});

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    tables: [],
                },
            });

            unmount();
        });

        it("should handle case when vectorTables is undefined", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                        options: {},
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            chatOptionsRef.current!["removeVectorTable"]("schema1.table1", {});

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    tables: undefined,
                },
            });

            unmount();
        });
    });

    describe("historyMessageColumnFormatter", () => {
        const mockOnAction = vi.fn();
        const mockOnChatOptionsStateChange = vi.fn();

        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("should format message without truncation", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            const message = {
                getValue: vi.fn().mockReturnValue("Hello, this is a test message"),
            } as unknown as CellComponent;

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            const result = chatOptionsRef.current!["historyMessageColumnFormatter"](message);

            expect(result).toMatchSnapshot();

            unmount();
        });

        it("should handle empty message", async () => {
            const chatOptionsRef = createRef<ChatOptions>();
            const { unmount } = render(
                <ChatOptions
                    ref={chatOptionsRef}
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            const message = {
                getValue: vi.fn().mockReturnValue(""),
            } as unknown as CellComponent;

            await nextRunLoop();
            expect(chatOptionsRef.current).toBeDefined();

            const result = chatOptionsRef.current!["historyMessageColumnFormatter"](message);

            expect(result).toMatchSnapshot();

            unmount();
        });
    });
});
