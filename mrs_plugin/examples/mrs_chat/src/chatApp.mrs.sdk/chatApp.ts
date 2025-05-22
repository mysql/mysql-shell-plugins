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
    IMrsLoginResult,
    IAuthenticateOptions,
    MrsBaseObjectProcedureCall,
} from "./MrsBaseClasses";

// --- MySQL Shell for VS Code Extension Remove --- Begin
export type { IMrsAuthUser, IMrsAuthStatus } from "./MrsBaseClasses";
// --- MySQL Shell for VS Code Extension Remove --- End
/*
 * MRS Object - /chatApp/chat/heatwaveChatAsync (PROCEDURE)
 */
class ChatAppChatHeatwaveChatAsyncObject extends MrsBaseObject {

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
class ChatAppChatHeatwaveChatAsyncResultObject extends MrsBaseObject {

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
    #heatwaveChatAsync?: ChatAppChatHeatwaveChatAsyncObject;
    #heatwaveChatAsyncResult?: ChatAppChatHeatwaveChatAsyncResultObject;

    public get heatwaveChatAsync(): ChatAppChatHeatwaveChatAsyncObject {
        if (this.#heatwaveChatAsync === undefined) {
            this.#heatwaveChatAsync = new ChatAppChatHeatwaveChatAsyncObject(this, "/heatwaveChatAsync");
        }

        return this.#heatwaveChatAsync;
    }
    public get heatwaveChatAsyncResult(): ChatAppChatHeatwaveChatAsyncResultObject {
        if (this.#heatwaveChatAsyncResult === undefined) {
            this.#heatwaveChatAsyncResult = new ChatAppChatHeatwaveChatAsyncResultObject(this, "/heatwaveChatAsyncResult");
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

    public async authenticate(options: IAuthenticateOptions): Promise<IMrsLoginResult> {
        const { username, password, app, vendor } = options ?? {};

        return super.authenticate({ username, password, app, vendor });
    }

    public async deauthenticate(): Promise<void> {
        await super.deauthenticate();
    }
}

