/* eslint-disable @typescript-eslint/naming-convention */
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

import { Component, ComponentChild, createRef } from "preact";
import type { ChatApp } from "../../chatApp.mrs.sdk/chatApp";
import styles from "./ChatPage.module.css";
import { JsonObject, JsonValue, MaybeNull } from "../../chatApp.mrs.sdk/MrsBaseClasses";

interface IChatItem {
    id: number;
    prompt?: string;
    status: "NOT_SENT" | "PENDING" | "COMPLETE";
    response?: string[];
    taskId?: MaybeNull<number>;
}

interface IChatPageProps {
    showPage: (page: string, forcedUpdate?: boolean) => void;
    showError: (error: unknown) => void;
    chatApp: ChatApp;
}

interface IChatPageState {
    chatItems: IChatItem[];
    currentPromptText?: string;
    currentTaskId?: number;
    pendingInvitation: boolean;
    infoMessage?: string;
    forceNoteListDisplay?: boolean;
    currentChatOptions: MaybeNull<JsonValue>;
}

/**
 * The Chat page Component that implements the prompt request / response ping-pong
 */
export default class Chat extends Component<IChatPageProps, IChatPageState> {
    private checkChatResponseTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly chatPromptTextAreaRef = createRef();
    private readonly chatLastResponseRef = createRef();

    public constructor(props: IChatPageProps) {
        super(props);

        this.state = {
            currentChatOptions: null,
            chatItems: [{
                id: 0,
                status: "COMPLETE",
                response: ["Nice to see you!", "How can I help you?"],
            },
            {
                id: 1,
                status: "NOT_SENT",
                prompt: "",
            }],
            pendingInvitation: false,
            forceNoteListDisplay: window.innerWidth < 600 ? true : undefined,
        };

        this.checkChatResponseTimer = null;
    }

    public readonly componentWillUnmount = (): void => {
        // Clear the timers before unmounting
        if (this.checkChatResponseTimer !== null) {
            clearTimeout(this.checkChatResponseTimer);
            this.checkChatResponseTimer = null;
        }
    };

    private readonly promptInput = async (newPromptText: string): Promise<void> => {
        const { chatApp, showError } = this.props;
        const { chatItems, currentChatOptions } = this.state;

        if (newPromptText.includes("\n")) {
            // Get last chat item and send prompt to server
            const chatItem = chatItems.at(-1);
            if (chatItem) {
                chatItem.prompt = newPromptText.replaceAll("\n", "");
                chatItem.status = "PENDING";

                this.setState({ chatItems });

                try {
                    // Build chat options to send, removing all items except chat_history, model_options
                    let newChatOptions;
                    if (currentChatOptions !== undefined && currentChatOptions !== null) {
                        newChatOptions = (({ chat_history, model_options }) => {
                            return ({ chat_history, model_options });
                        })(currentChatOptions as JsonObject);
                    } else {
                        newChatOptions = null;
                    }

                    // Send prompt via chat request
                    chatItem.taskId = (await chatApp.chat.heatwaveChatAsync.call({
                        prompt: chatItem.prompt,
                        options: newChatOptions,
                    })).outParameters?.taskId;

                    // Start waiting for a chat response with the new taskId
                    if (chatItem.taskId !== undefined && chatItem.taskId != null) {
                        this.waitForChatResponse(chatItem);
                    } else {
                        throw new Error("The REST server did not return a taskId.");
                    }

                    this.setState({ chatItems, currentPromptText: undefined }, () => {
                        (this.chatLastResponseRef.current as HTMLInputElement).scrollIntoView(
                            { behavior: "smooth", block: "center", inline: "nearest" });
                    });
                } catch (e) {
                    showError(e);
                }
            }
        } else {
            this.setState({ currentPromptText: newPromptText });
        }
    };

    private readonly waitForChatResponse = (chatItem: IChatItem): void => {
        // If timer is currently running, rest it so we can restart it again
        if (this.checkChatResponseTimer !== null) {
            clearTimeout(this.checkChatResponseTimer);
        }

        // Check every 2 seconds if a response update is available
        this.checkChatResponseTimer = setTimeout(() => {
            void this.checkForChatResponse(chatItem);
        }, 2000);
    };

    private readonly checkForChatResponse = async (chatItem: IChatItem): Promise<void> => {
        const { chatApp, showError } = this.props;
        const { chatItems } = this.state;

        try {
            // Check if there is a final response available from the server
            const response = (await chatApp.chat.heatwaveChatAsyncResult.call(
                { taskId: chatItem.taskId })).outParameters;

            if (response?.response !== null && response?.response !== undefined) {
                // Update the chat item with the correct id to show the server response
                const item = chatItems.find((item) => { return item.id === chatItem.id; });
                if (item) {
                    item.response = [response.response];
                }

                // Add the next prompt so the user can enter the next question
                chatItems.push({ id: chatItems.length, status: "NOT_SENT", prompt: "" });

                // Update state and then scroll new prompt into focus
                this.setState({ chatItems, currentChatOptions: response.chatOptions }, () => {
                    (this.chatPromptTextAreaRef.current as HTMLInputElement).scrollIntoView(
                        { behavior: "smooth", block: "center", inline: "nearest" });
                    (this.chatPromptTextAreaRef.current as HTMLInputElement).focus();
                });
            } else if (response !== undefined
                && response.status !== undefined && response.status !== null && response.status === "ERROR"
                && response.response !== undefined && response.response !== null) {
                throw new Error(response.response);
            } else {
                void this.waitForChatResponse(chatItem);
            }
        } catch (e) {
            showError(e);
        }
    };

    /**
     * The component's render function
     *
     * @param props The component's properties
     * @param state The component's state
     *
     * @returns The rendered ComponentChild
     */
    public render = (props: IChatPageProps, state: IChatPageState): ComponentChild => {
        const { chatItems, currentPromptText } = state;

        return (
            <div className={styles.chat}>
                <div className={styles.chatTitle}>
                    <h1>HeatWave Chat</h1>
                    <p>With a powerful search and conversation interface, find the information you need and
                        complete tasks as easily as having a conversation.</p>
                </div>
                <div className={styles.chatBubbles}>
                    {chatItems.map((chatItem, itemIndex) => {
                        return <div className={styles.chatItem} key={itemIndex}>
                            { // Render chat prompts that have already been sent
                                chatItem.prompt !== undefined && chatItem.status !== "NOT_SENT" &&
                                <div className={styles.chatPrompt}>{chatItem.prompt}</div>
                            }
                            { // Render textarea input control for the user to type the question
                                chatItem.prompt !== undefined && chatItem.status === "NOT_SENT" &&
                                <textarea className={styles.chatPrompt} ref={this.chatPromptTextAreaRef}
                                    value={currentPromptText}
                                    onInput={(e) => { void this.promptInput((e.target as HTMLInputElement).value); }}
                                    onKeyUp={(e) => {
                                        const el = (e.target as HTMLInputElement);
                                        el.style.height = "1px";
                                        el.style.height = String(8 + el.scrollHeight) + "px";
                                    }}
                                    // eslint-disable-next-line jsx-a11y/no-autofocus
                                    autoFocus={true} />}
                            { // Render chat responses from the server
                                chatItem.response !== undefined && chatItem.response.length > 0 &&
                                <div className={styles.chatResponse}>
                                    {chatItem.response.map((chatResponseItem, chatResponseIndex) => {
                                        return <div className={styles.chatResponseItem} key={chatResponseIndex}>
                                            {chatResponseItem}</div>;
                                    })}
                                </div>}
                            { // Render pending chat response `...`
                                chatItem.response === undefined && chatItem.status === "PENDING" &&
                                <div className={styles.chatResponse} ref={this.chatLastResponseRef}>
                                    <div className={styles.chatResponseItem}>...</div>
                                </div>}
                        </div>;
                    })}
                </div>
            </div>
        );
    };
}
