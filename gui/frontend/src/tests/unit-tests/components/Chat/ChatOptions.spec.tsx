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

import { mount } from "enzyme";
import { CellComponent } from "tabulator-tables";
import { IMdsChatData, IMdsChatTable } from "../../../../communication/ProtocolMds.js";
import {
    ChatOptionAction, ChatOptions, IChatOptionsProperties, IChatOptionsState,
} from "../../../../components/Chat/ChatOptions.js";
import { IAccordionProperties } from "../../../../components/ui/Accordion/Accordion.js";
import { IInputChangeProperties } from "../../../../components/ui/Input/Input.js";

describe("ChatOptions", () => {
    it("Standard Rendering (snapshot)", () => {
        const component = mount<ChatOptions>(
            <ChatOptions
                savedState={{
                    chatOptionsExpanded: true,
                    chatOptionsWidth: 300,
                    options: {} as IMdsChatData,
                }}
                onAction={jest.fn()}
                onChatOptionsStateChange={jest.fn()}
            />,
        );
        expect(component).toMatchSnapshot();
    });

    describe("getDerivedStateFromProps", () => {
        const mockOnAction = jest.fn();
        const mockOnChatOptionsStateChange = jest.fn();

        beforeEach(() => {
            jest.clearAllMocks();
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
        const mockOnAction = jest.fn();
        const mockOnChatOptionsStateChange = jest.fn();

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should update section state when expanding a section", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            component.instance()["handleSectionExpand"]({} as IAccordionProperties, "testSection", true);

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                sectionStates: new Map([["testSection", { expanded: true }]]),
            });
        });

        it("should update existing section state", () => {
            const initialSectionStates = new Map([
                ["existingSection", { expanded: false, size: 100 }],
            ]);

            const component = mount<ChatOptions>(
                <ChatOptions
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: initialSectionStates,
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            component.instance()["handleSectionExpand"]({} as IAccordionProperties, "existingSection", true);

            const expectedMap = new Map([
                ["existingSection", { expanded: true, size: 100 }],
            ]);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                sectionStates: expectedMap,
            });
        });

        it("should set returnPrompt to true when expanding promptSection", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["handleSectionExpand"]({} as IAccordionProperties, "promptSection", true);

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(2);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    returnPrompt: true,
                },
            });
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                sectionStates: new Map([["promptSection", { expanded: true }]]),
            });
        });

        it("should not set returnPrompt when expanding promptSection if already true", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["handleSectionExpand"]({} as IAccordionProperties, "promptSection", true);

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                sectionStates: new Map([["promptSection", { expanded: true }]]),
            });
        });
    });

    describe("handleStartNewChatClick", () => {
        const mockOnAction = jest.fn();
        const mockOnChatOptionsStateChange = jest.fn();

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should trigger StartNewChat action", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            component.instance()["handleStartNewChatClick"]({} as MouseEvent, {});

            expect(mockOnAction).toHaveBeenCalledTimes(1);
            expect(mockOnAction).toHaveBeenCalledWith(ChatOptionAction.StartNewChat);
        });

        it("should handle keyboard event", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            component.instance()["handleStartNewChatClick"]({} as KeyboardEvent, {});

            expect(mockOnAction).toHaveBeenCalledTimes(1);
            expect(mockOnAction).toHaveBeenCalledWith(ChatOptionAction.StartNewChat);
        });
    });

    describe("handleSaveOptionsBtnClick", () => {
        const mockOnAction = jest.fn();
        const mockOnChatOptionsStateChange = jest.fn();

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should trigger SaveChatOptions action", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            component.instance()["handleSaveOptionsBtnClick"]({} as MouseEvent, {});

            expect(mockOnAction).toHaveBeenCalledTimes(1);
            expect(mockOnAction).toHaveBeenCalledWith(ChatOptionAction.SaveChatOptions);
        });

        it("should handle keyboard event", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            component.instance()["handleSaveOptionsBtnClick"]({} as KeyboardEvent, {});

            expect(mockOnAction).toHaveBeenCalledTimes(1);
            expect(mockOnAction).toHaveBeenCalledWith(ChatOptionAction.SaveChatOptions);
        });
    });

    describe("handleLoadOptionsBtnClick", () => {
        const mockOnAction = jest.fn();
        const mockOnChatOptionsStateChange = jest.fn();

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should trigger LoadChatOptions action", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            component.instance()["handleLoadOptionsBtnClick"]({} as MouseEvent, {});

            expect(mockOnAction).toHaveBeenCalledTimes(1);
            expect(mockOnAction).toHaveBeenCalledWith(ChatOptionAction.LoadChatOptions);
        });

        it("should handle keyboard event", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
                    savedState={{
                        chatOptionsExpanded: true,
                        chatOptionsWidth: 300,
                        sectionStates: new Map(),
                    }}
                    onAction={mockOnAction}
                    onChatOptionsStateChange={mockOnChatOptionsStateChange}
                />,
            );

            component.instance()["handleLoadOptionsBtnClick"]( {} as KeyboardEvent, {});

            expect(mockOnAction).toHaveBeenCalledTimes(1);
            expect(mockOnAction).toHaveBeenCalledWith(ChatOptionAction.LoadChatOptions);
        });
    });

    describe("handleSchemaChange", () => {
        const mockOnAction = jest.fn();
        const mockOnChatOptionsStateChange = jest.fn();

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should update schema name when selecting a specific schema", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["handleSchemaChange"](true, new Set(["newSchema"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    schemaName: "newSchema",
                },
            });
        });

        it("should set schema name to undefined when selecting 'All Schemas'", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["handleSchemaChange"](true, new Set(["schemaDropdownAllSchemas"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    schemaName: undefined,
                },
            });
        });

        it("should preserve other options when updating schema", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["handleSchemaChange"](true, new Set(["newSchema"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    schemaName: "newSchema",
                    returnPrompt: true,
                    lockTableList: false,
                },
            });
        });
    });

    describe("handleModelIdChange", () => {
        const mockOnAction = jest.fn();
        const mockOnChatOptionsStateChange = jest.fn();

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should update modelId when modelOptions exist", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["handleModelIdChange"](true, new Set(["newModel"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    modelOptions: {
                        modelId: "newModel",
                        temperature: 0.7,
                    },
                },
            });
        });

        it("should create modelOptions when they don't exist", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["handleModelIdChange"](true, new Set(["newModel"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    modelOptions: {
                        modelId: "newModel",
                    },
                },
            });
        });

        it("should preserve other options when updating modelId", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["handleModelIdChange"](true, new Set(["newModel"]));

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
        });
    });

    describe("handleModelLanguageChange", () => {
        const mockOnAction = jest.fn();
        const mockOnChatOptionsStateChange = jest.fn();

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should update model language when modelOptions exist", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["handleModelLanguageChange"](true, new Set(["en"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    modelOptions: {
                        modelId: "model1",
                        language: "en",
                    },
                },
            });
        });

        it("should create modelOptions when they don't exist", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["handleModelLanguageChange"](true, new Set(["es"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    modelOptions: {
                        language: "es",
                    },
                },
            });
        });

        it("should clear languageOptions.language when setting non-English model language", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["handleModelLanguageChange"](true, new Set(["es"]));

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
        });

        it("should preserve languageOptions.language when setting English model language", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["handleModelLanguageChange"](true, new Set(["en"]));

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
        });
    });

    describe("handleLanguageModelIdChange", () => {
        const mockOnAction = jest.fn();
        const mockOnChatOptionsStateChange = jest.fn();

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should update modelId when languageOptions exist", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["handleLanguageModelIdChange"](true, new Set(["newTranslator"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    languageOptions: {
                        modelId: "newTranslator",
                        language: "fr",
                    },
                },
            });
        });

        it("should create languageOptions when they don't exist", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["handleLanguageModelIdChange"](true, new Set(["newTranslator"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    languageOptions: {
                        modelId: "newTranslator",
                    },
                },
            });
        });

        it("should preserve other options when updating language modelId", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["handleLanguageModelIdChange"](true, new Set(["newTranslator"]));

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
        });
    });

    describe("handlePreambleChange", () => {
        const mockOnAction = jest.fn();
        const mockOnChatOptionsStateChange = jest.fn();

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should update preamble when options exist", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["handlePreambleChange"](mockEvent, {} as IInputChangeProperties );

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    preamble: "new preamble",
                },
            });
        });

        it("should create options with preamble when options don't exist", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["handlePreambleChange"](mockEvent, {} as IInputChangeProperties );

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    preamble: "new preamble",
                },
            });
        });

        it("should preserve other options when updating preamble", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["handlePreambleChange"](mockEvent, {} as IInputChangeProperties );

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
        });

        it("should handle empty preamble value", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["handlePreambleChange"](mockEvent, {} as IInputChangeProperties );

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    preamble: "",
                },
            });
        });
    });

    describe("handleTranslationLanguageChange", () => {
        const mockOnAction = jest.fn();
        const mockOnChatOptionsStateChange = jest.fn();

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should update translation language when languageOptions exist", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["handleTranslationLanguageChange"](true, new Set(["fr"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    languageOptions: {
                        language: "fr",
                        modelId: "translator1",
                    },
                },
            });
        });

        it("should create languageOptions when they don't exist", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["handleTranslationLanguageChange"](true, new Set(["fr"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    languageOptions: {
                        language: "fr",
                    },
                },
            });
        });

        it("should set language to undefined when selecting 'noTranslation'", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["handleTranslationLanguageChange"](true, new Set(["noTranslation"]));

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    languageOptions: {
                        language: undefined,
                        modelId: "translator1",
                    },
                },
            });
        });

        it("should preserve other options when updating translation language", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["handleTranslationLanguageChange"](true, new Set(["fr"]));

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
        });
    });

    describe("handleModelOptionChange", () => {
        const mockOnAction = jest.fn();
        const mockOnChatOptionsStateChange = jest.fn();

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should update model option when modelOptions exist", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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
            component.instance()["handleModelOptionChange"](e, {});

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    modelOptions: {
                        modelId: "model1",
                        temperature: 0.9,
                    },
                },
            });
        });

        it("should create modelOptions when they don't exist", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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
            component.instance()["handleModelOptionChange"](e, {});

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    modelOptions: {
                        temperature: 0.9,
                    },
                },
            });
        });

        it("should preserve other options when updating model option", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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
            component.instance()["handleModelOptionChange"](e, {});

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
        });
    });

    describe("removeVectorTable", () => {
        const mockOnAction = jest.fn();
        const mockOnChatOptionsStateChange = jest.fn();

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should remove vector table from vectorTables array", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["removeVectorTable"]("schema1.table1", {});

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    tables: [
                        { tableName: "table2", schemaName: "schema2" },
                        { tableName: "table3", schemaName: "schema3" },
                    ],
                },
            });
        });

        it("should handle removing the last vector table", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["removeVectorTable"]("schema1.table1", {});

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    tables: [],
                },
            });
        });

        it("should handle case when vectorTables is undefined", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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

            component.instance()["removeVectorTable"]("schema1.table1", {});

            expect(mockOnChatOptionsStateChange).toHaveBeenCalledTimes(1);
            expect(mockOnChatOptionsStateChange).toHaveBeenCalledWith({
                options: {
                    tables: undefined,
                },
            });
        });
    });

    describe("historyMessageColumnFormatter", () => {
        const mockOnAction = jest.fn();
        const mockOnChatOptionsStateChange = jest.fn();

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it("should format message without truncation", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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
                getValue: jest.fn().mockReturnValue("Hello, this is a test message"),
            } as unknown as CellComponent;
            const result = component.instance()["historyMessageColumnFormatter"](message);

            expect(result).toMatchSnapshot();
        });

        it("should handle empty message", () => {
            const component = mount<ChatOptions>(
                <ChatOptions
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
                getValue: jest.fn().mockReturnValue(""),
            } as unknown as CellComponent;
            const result = component.instance()["historyMessageColumnFormatter"](message);

            expect(result).toMatchSnapshot();
        });
    });
});
