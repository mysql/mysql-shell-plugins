/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

import { IDispatchEvent, IDispatchDefaultEvent, DispatchEvents, EventType } from "../supplement/Dispatch";
import { IShellRequest } from ".";
import { IDictionary } from "../app-logic/Types";

export interface IResponseDictionary {
    [key: string]: unknown;
}

export interface IRequestState {
    type: string;
    msg: string;
}

export interface IGenericResponse extends IResponseDictionary {
    requestId?: string;          // Only set if this is a response to a client request.
    requestState: IRequestState;
}

export interface ICommShellProfile extends IDictionary {
    id: number;
    userId: number;
    name: string;
    description?: string;
    options?: { [key: string]: unknown };
    active: boolean;
}

export interface IWebSessionData extends IGenericResponse {
    sessionUuid?: string;
    localUserMode: boolean;
    activeProfile: ICommShellProfile;
}

export interface IAuthenticationData extends IGenericResponse {
    activeProfile: ICommShellProfile;
}

export interface IStartSessionData extends IGenericResponse {
    moduleSessionId: string;
}

export interface IOpenDBConnectionData extends IGenericResponse {
    currentSchema?: string;
    sqlMode?: string;
    info: {
        version?: string;
        edition?: string;
    };
}

export interface IOpenMdsConnectionData extends IGenericResponse {
    result: {
        prompt: string;
    };
}

export type IOpenConnectionData = IOpenDBConnectionData | IOpenMdsConnectionData;

export interface IAddConnectionData extends IGenericResponse {
    result: {
        dbConnectionId: number;
    };
}

export type IResultSetStateData = IGenericResponse;

export interface IResultSetData extends IGenericResponse {
    executionTime?: number;
    rows?: unknown[];
    columns?: Array<{ name: string; type: string }>;
    totalRowCount?: number;
}

export interface IProfileData extends IGenericResponse {
    result?: ICommShellProfile;
    rows?: Array<{
        id: number;
        name: string;
    }>;
}

export interface IDbTypesData extends IGenericResponse {
    dbType: string[];
}

export interface IDebuggerScriptListData extends IGenericResponse {
    scripts: string[];
}

export interface IScriptContentData extends IGenericResponse {
    script: string;
}

export interface ISimpleResultData extends IGenericResponse {
    result: number | string | string[];
}

// For meta data requests (list of schemas, tables etc.).
export interface IMetaData extends IGenericResponse {
    result: string[] | {
        name?: string;
        columns?: string[];
    };
}

export interface IShellPromptValues {
    promptDescriptor?: {
        host?: string;
        port?: number;
        schema?: string;
        isProduction?: boolean; // If true we are on a production server.
        ssl?: string;
        socket?: string;
        session?: string;       // classic or X protocol.
        mode?: string;
    };
}

export interface IShellDocumentWarning {
    level: "Note" | "Warning" | "Error";
    code: "string";
    message: string;
}

export interface IShellResultData extends IShellPromptValues {
    hasData: boolean;
    affectedRowCount?: number;
    executionTime: string;
    affectedItemsCount: number;
    warningCount: number;
    warningsCount: number;
    warnings: IShellDocumentWarning[];
    info: string;
    autoIncrementValue: number;
}

export interface IShellDocumentData extends IShellResultData {
    documents: unknown[];
}

export interface IShellRowData extends IShellResultData {
    rows: unknown[];
}

export interface IShellSimpleResult extends IShellPromptValues {
    info?: string;
    error?: string | { message: string; type: string };
    warning?: string;
    note?: string;
    status?: string;
}

export interface IShellValueResult extends IShellPromptValues {
    value: string | number;
}

export interface IShellObjectResult extends IShellPromptValues {
    class: string;
    name: string;
}

export interface IShellFeedbackRequest {
    prompt?: string;
    password?: string;
}

export type IShellResultType =
    IShellFeedbackRequest
    | IShellObjectResult
    | IShellObjectResult[]
    | IShellValueResult
    | IShellSimpleResult
    | IShellDocumentData
    | IShellRowData;

export interface IShellResponse extends IGenericResponse {
    result?: IShellResultType;
}

export interface IShellModuleDataCategoriesEntry {
    id: number;
    name: string;
    parentCategoryId?: number;
}

export interface IShellModuleDataCategoriesData {
    result: IShellModuleDataCategoriesEntry[];
}

export interface IShellModuleAddData {
    result: number;
}

export interface IShellModuleDataEntry {
    id: number;
    dataCategoryId: number;
    caption: string;
}

export interface IShellModuleData {
    result: IShellModuleDataEntry[];
}

export interface IShellModuleDataContentData {
    result: string;
}

export interface IShellCompletionData extends IGenericResponse {
    result: {
        offset: number;
        options: string[];
    };
}

export interface IMdsProfileData {
    fingerprint: string;
    keyFile: string;
    profile: string;
    region: string;
    tenancy: string;
    user: string;
    isCurrent: boolean;
}

export interface IShellMdsProfileData extends IGenericResponse {
    result: IMdsProfileData[];
}

export interface IShellBackendInformation extends IGenericResponse {
    info: {
        architecture: string;
        major: string;
        minor: string;
        patch: string;
        platform: string;
        serverDistribution: string;
        serverMajor: string;
        serverMinor: string;
        serverPatch: string;
    };
}

export interface ICompartmentTags {
    [key: string]: unknown;
}

export interface IMrsServiceData {
    enabled: number;
    hostCtx: string;
    id: number;
    isDefault: number;
    urlContextRoot: string;
    urlHostName: string;
    urlProtocol: string;
    comments: string;
}

export interface IMrsServiceResultData {
    result: IMrsServiceData[];
}

export interface IMrsSchemaData {
    comments: string;
    enabled: number;
    hostCtx: string;
    id: number;
    itemsPerPage: number;
    name: string;
    requestPath: string;
    requiresAuth: number;
    serviceId: number;
}

export interface IMrsSchemaResultData {
    result: IMrsSchemaData[];
}

export interface IMrsDbObjectData {
    changedAt?: string;
    comments: string;
    crudOperations: string[];
    dbSchemaId: number;
    enabled: boolean;
    hostCtx?: string;
    id: number;
    itemsPerPage?: number;
    name: string;
    objectType: string;
    requestPath: string;
    requiresAuth: boolean;
    rowOwnershipColumn?: string;
    rowOwnershipEnforced: boolean;
    rowOwnershipParameter?: string;
    schemaRequestPath?: string;
}

export interface IMrsDbObjectResultData {
    result: IMrsDbObjectData[];
}

export interface IModuleListData extends IGenericResponse {
    result: string[];
}

export interface IModuleAddDataCategory extends IGenericResponse {
    result: number;
}

export interface IDBDataTreeEntry {
    id: number;
    caption: string;
    parentFolderId: number;
}

export interface IDBDataTreeIdentifier {
    treeIdentifier: string;
}

export interface IDBDataTreeIdentifiers {
    result: IDBDataTreeIdentifier[];
}

export interface IDBDataTreeContent {
    result: IDBDataTreeEntry[];
}

export interface IErrorData extends IGenericResponse {
    error: string;
}

export type ICommSimpleResultEvent = IDispatchEvent<ISimpleResultData>;

export type ICommWebSessionEvent = IDispatchEvent<IWebSessionData>;
export type ICommAuthenticationEvent = IDispatchEvent<IAuthenticationData>;
export type ICommStartSessionEvent = IDispatchEvent<IStartSessionData>;
export type ICommCloseSessionEvent = IDispatchEvent<IGenericResponse>;
export type ICommAddConnectionEvent = IDispatchEvent<IAddConnectionData>;
export type ICommOpenConnectionEvent = IDispatchEvent<IOpenConnectionData>;

export type ICommResultSetStateEvent = IDispatchEvent<IResultSetStateData>;
export type ICommResultSetEvent = IDispatchEvent<IResultSetData>;
export type ICommProfileEvent = IDispatchEvent<IProfileData>;
export type ICommDbTypesEvent = IDispatchEvent<IDbTypesData>;
export type ICommDebuggerScriptsEvent = IDispatchEvent<IDebuggerScriptListData>;
export type ICommScriptContentEvent = IDispatchEvent<IScriptContentData>;
export type ICommMetaDataEvent = IDispatchEvent<IMetaData>;

export type ICommListDataCategoriesEvent = IDispatchEvent<IShellModuleDataCategoriesData>;
export type ICommModuleAddDataEvent = IDispatchEvent<IShellModuleAddData>;
export type ICommModuleDataEvent = IDispatchEvent<IShellModuleData>;
export type ICommModuleDataContentEvent = IDispatchEvent<IShellModuleDataContentData>;
export type ICommProfileTreeIdentifiersEvent = IDispatchEvent<IDBDataTreeIdentifiers>;
export type ICommDataTreeContentEvent = IDispatchEvent<IDBDataTreeContent>;

export type ICommShellEvent = IDispatchEvent<IShellResponse>;
export type ICommShellCompletionEvent = IDispatchEvent<IShellCompletionData>;

export type ICommShellInformationEvent = IDispatchEvent<IShellBackendInformation>;

export type ICommMdsConfigProfileEvent = IDispatchEvent<IShellMdsProfileData>;

export type ICommMrsServiceEvent = IDispatchEvent<IMrsServiceResultData>;
export type ICommMrsSchemaEvent = IDispatchEvent<IMrsSchemaResultData>;
export type ICommMrsDbObjectEvent = IDispatchEvent<IMrsDbObjectResultData>;

export type ICommModuleListEvent = IDispatchEvent<IModuleListData>;
export type ICommModuleAddDataCategoryEvent = IDispatchEvent<IModuleAddDataCategory>;

export type ICommErrorEvent = IDispatchEvent<IErrorData>;

/**
 * Factory to create communication event objects.
 */
export class CommunicationEvents {

    /**
     * Creates an event object for incoming web session messages, that is, messages that were sent while
     * a web session is being established. In this case the data contains a session ID, but no request ID (because it
     * wasn't sent as a response to a request).
     *
     * @param data The data from the server.
     * @returns A dispatcher event with web session data.
     */
    public static generateWebSessionEvent(data: IWebSessionData): IDispatchEvent<IWebSessionData> {
        const result = DispatchEvents.okEvent("webSession", data);
        result.message = data.requestState.msg;

        return result;
    }

    /**
     * Creates an event object for incoming response messages.
     *
     * @param messageClass A string identifying the kind of response.
     * @param data The data sent by the server.
     * @returns A dispatcher event with unspecified data.
     */
    public static generateResponseEvent(messageClass: string, data: IGenericResponse): IDispatchDefaultEvent {
        let eventType;
        switch (data.requestState.type) {
            case "ERROR": {
                eventType = EventType.ErrorResponse;
                break;
            }

            case "PENDING": { // Multi-response event.
                if (data.requestState.msg === "Execution started...") {
                    eventType = EventType.StartResponse; // Carries no result data.
                } else {
                    eventType = EventType.DataResponse;
                }
                break;
            }

            case "OK": { // Single and end of multi-response event.
                eventType = EventType.FinalResponse;
                break;
            }

            default: {
                eventType = EventType.Unknown;
                break;
            }
        }

        const result = DispatchEvents.baseEvent(eventType, data.requestId, messageClass);
        result.data = data;
        result.message = data.requestState.msg;

        return result;
    }

    /**
     * Creates an event object for data that was sent to the server. This event is usually handled only by
     * parts of the application, which need to track both received and sent messages (like the communication debugger).
     *
     * @param data The actual data to be sent to the shell.
     * @returns a default (unspecialized event).
     */
    public static generateRequestEvent(data: IShellRequest): IDispatchDefaultEvent {
        const result = DispatchEvents.baseEvent(EventType.Request, data.request_id);
        result.data = data;

        return result;
    }
}
