/* Copyright (c) 2023, 2025, Oracle and/or its affiliates. */

/* eslint-disable max-len */
/* eslint-disable max-classes-per-file */
/* eslint-disable no-multiple-empty-lines */

import {
    MrsBaseService,
    MrsBaseSchema,
    JsonObject,
    JsonValue,
    MaybeNull,
    IMrsProcedureResult,
    MrsBaseObjectProcedureCall,
} from "./MrsBaseClasses";

// --- MySQL Shell for VS Code Extension Remove --- Begin
export type { IMrsAuthUser, IMrsAuthStatus } from "./MrsBaseClasses";
// --- MySQL Shell for VS Code Extension Remove --- End



/* -----------------------------------------------------------------------------
 * MRS Schema /chat
 */

export class ChatAppChatObjectRequest {
    public constructor(
        public schema: ChatAppChat) {
    }
}

/*
 * MRS Object - /chatApp/chat/heatwaveChatAsync (PROCEDURE)
 */

export class ChatAppChatHeatwaveChatAsyncParamsRequest extends ChatAppChatObjectRequest {

    static readonly #schemaRequestPath = "/chat";
    static readonly #requestPath = "/heatwaveChatAsync";








    public call = async (heatwaveChatAsyncParams?: IChatAppChatHeatwaveChatAsyncParams): Promise<IMrsProcedureResult<IChatAppChatHeatwaveChatAsyncParamsOut, IChatAppChatHeatwaveChatAsyncResultSet>> => {
        const request = new MrsBaseObjectProcedureCall<IChatAppChatHeatwaveChatAsyncParams, IChatAppChatHeatwaveChatAsyncParamsOut, IChatAppChatHeatwaveChatAsyncResultSet>(
            this.schema, ChatAppChatHeatwaveChatAsyncParamsRequest.#requestPath, heatwaveChatAsyncParams);
        const response = await request.fetch();

        return response;
    };

}

export interface IChatAppChatHeatwaveChatAsyncParams {
    prompt?: MaybeNull<string>,
    options?: MaybeNull<JsonValue>,
}

export interface IChatAppChatHeatwaveChatAsyncParamsOut {
    taskId?: MaybeNull<number>,
}

export type IChatAppChatHeatwaveChatAsyncResultSet = JsonObject;


/*
 * MRS Object - /chatApp/chat/heatwaveChatAsyncResult (PROCEDURE)
 */

export class ChatAppChatHeatwaveChatAsyncResultParamsRequest extends ChatAppChatObjectRequest {

    static readonly #schemaRequestPath = "/chat";
    static readonly #requestPath = "/heatwaveChatAsyncResult";








    public call = async (heatwaveChatAsyncResultParams?: IChatAppChatHeatwaveChatAsyncResultParams): Promise<IMrsProcedureResult<IChatAppChatHeatwaveChatAsyncResultParamsOut, IChatAppChatHeatwaveChatAsyncResultResultSet>> => {
        const request = new MrsBaseObjectProcedureCall<IChatAppChatHeatwaveChatAsyncResultParams, IChatAppChatHeatwaveChatAsyncResultParamsOut, IChatAppChatHeatwaveChatAsyncResultResultSet>(
            this.schema, ChatAppChatHeatwaveChatAsyncResultParamsRequest.#requestPath, heatwaveChatAsyncResultParams);
        const response = await request.fetch();

        return response;
    };

}

export interface IChatAppChatHeatwaveChatAsyncResultParams {
    taskId?: MaybeNull<number>,
}

export interface IChatAppChatHeatwaveChatAsyncResultParamsOut {
    status?: MaybeNull<string>,
    progress?: MaybeNull<number>,
    response?: MaybeNull<string>,
    chatOptions?: MaybeNull<JsonValue>,
}

export type IChatAppChatHeatwaveChatAsyncResultResultSet = JsonObject;


export class ChatAppChat extends MrsBaseSchema {
    #heatwaveChatAsync?: ChatAppChatHeatwaveChatAsyncParamsRequest;
    #heatwaveChatAsyncResult?: ChatAppChatHeatwaveChatAsyncResultParamsRequest;

    public get heatwaveChatAsync(): ChatAppChatHeatwaveChatAsyncParamsRequest {
        if (this.#heatwaveChatAsync === undefined) {
            this.#heatwaveChatAsync = new ChatAppChatHeatwaveChatAsyncParamsRequest(this);
        }

        return this.#heatwaveChatAsync;
    }
    public get heatwaveChatAsyncResult(): ChatAppChatHeatwaveChatAsyncResultParamsRequest {
        if (this.#heatwaveChatAsyncResult === undefined) {
            this.#heatwaveChatAsyncResult = new ChatAppChatHeatwaveChatAsyncResultParamsRequest(this);
        }

        return this.#heatwaveChatAsyncResult;
    }
}

/* =============================================================================
 * MRS Service https://localhost:8443/chatApp
 */

export class ChatApp extends MrsBaseService {
    #chat?: ChatAppChat;

    public constructor() {
        super("https://localhost:8443/chatApp", "/authentication");
    }

    public get chat(): ChatAppChat {
        if (this.#chat === undefined) {
            this.#chat = new ChatAppChat(this, "/chat");
        }

        return this.#chat;
    }

}

