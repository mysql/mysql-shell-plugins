/* Copyright (c) 2023, 2025, Oracle and/or its affiliates. */

/* eslint-disable max-len */
/* eslint-disable max-classes-per-file */
/* eslint-disable no-multiple-empty-lines */

import {
    MrsBaseService,
    MrsBaseSchema,
    MrsBaseObject,
    IMrsProcedureResult,
    JsonObject,
    JsonValue,
    MaybeNull,
    MrsBaseObjectProcedureCall,
} from "./MrsBaseClasses";

// --- MySQL Shell for VS Code Extension Remove --- Begin
export type { IMrsAuthUser, IMrsAuthStatus } from "./MrsBaseClasses";
// --- MySQL Shell for VS Code Extension Remove --- End
/*
 * MRS Object - /chatApp/chat/heatwaveChatAsync (PROCEDURE)
 */
class ChatAppChatHeatwaveChatAsyncParamsObject extends MrsBaseObject {

    public call = async (heatwaveChatAsyncParams?: IChatAppChatHeatwaveChatAsyncParams): Promise<IMrsProcedureResult<IChatAppChatHeatwaveChatAsyncParamsOut, IChatAppChatHeatwaveChatAsyncResultSet>> => {
        const request = new MrsBaseObjectProcedureCall<IChatAppChatHeatwaveChatAsyncParams, IChatAppChatHeatwaveChatAsyncParamsOut, IChatAppChatHeatwaveChatAsyncResultSet>(
            this.schema, this.requestPath, heatwaveChatAsyncParams);
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
class ChatAppChatHeatwaveChatAsyncResultParamsObject extends MrsBaseObject {

    public call = async (heatwaveChatAsyncResultParams?: IChatAppChatHeatwaveChatAsyncResultParams): Promise<IMrsProcedureResult<IChatAppChatHeatwaveChatAsyncResultParamsOut, IChatAppChatHeatwaveChatAsyncResultResultSet>> => {
        const request = new MrsBaseObjectProcedureCall<IChatAppChatHeatwaveChatAsyncResultParams, IChatAppChatHeatwaveChatAsyncResultParamsOut, IChatAppChatHeatwaveChatAsyncResultResultSet>(
            this.schema, this.requestPath, heatwaveChatAsyncResultParams);
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


class ChatAppChat extends MrsBaseSchema {
    #heatwaveChatAsync?: ChatAppChatHeatwaveChatAsyncParamsObject;
    #heatwaveChatAsyncResult?: ChatAppChatHeatwaveChatAsyncResultParamsObject;

    public get heatwaveChatAsync(): ChatAppChatHeatwaveChatAsyncParamsObject {
        if (this.#heatwaveChatAsync === undefined) {
            this.#heatwaveChatAsync = new ChatAppChatHeatwaveChatAsyncParamsObject(this, "/heatwaveChatAsync");
        }

        return this.#heatwaveChatAsync;
    }
    public get heatwaveChatAsyncResult(): ChatAppChatHeatwaveChatAsyncResultParamsObject {
        if (this.#heatwaveChatAsyncResult === undefined) {
            this.#heatwaveChatAsyncResult = new ChatAppChatHeatwaveChatAsyncResultParamsObject(this, "/heatwaveChatAsyncResult");
        }

        return this.#heatwaveChatAsyncResult;
    }
}

/* =============================================================================
 * MRS Service https://localhost:8443/chatApp
 */
export class ChatApp extends MrsBaseService {
    #chat?: ChatAppChat;

    public constructor(baseUrl: string = "https://localhost:8443/chatApp") {
        super(baseUrl, "/authentication");
    }

    public get chat(): ChatAppChat {
        if (this.#chat === undefined) {
            this.#chat = new ChatAppChat(this, "/chat");
        }

        return this.#chat;
    }

}

