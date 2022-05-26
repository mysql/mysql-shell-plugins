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

import { IDispatchEvent, DispatchEvents, EventType } from "../supplement/Dispatch";
import { IShellDictionary, IShellRequest } from ".";
import { IDictionary } from "../app-logic/Types";

export interface IRequestState {
    type: string;
    msg: string;
}

export interface IGenericResponse {
    /** Only set if this is a response to a client request. */
    requestId?: string;
    requestState: IRequestState;
}

/**
 * This interface contains the combined fields from the separate profile add/update APIs, plus the userId field
 *  which we need internally. The userId is never sent as part of a profile record to the backend.
 */
export interface ICommShellProfile {
    id: number;
    userId: number;
    name: string;
    description: string;
    options: IShellDictionary;
}

/** A special data interface for sent requests. Used only for the communication debugger. */
export interface ISentShellRequestData extends IGenericResponse {
    request: IShellRequest;
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
    result: {
        moduleSessionId: string;
    };
}

export interface IOpenConnectionData extends IGenericResponse {
    currentSchema?: string;
    info: {
        sqlMode?: string;
        version?: string;
        edition?: string;
        heatWaveAvailable?: boolean;
    };
    result: IShellResultType;
}

export interface IAddConnectionData extends IGenericResponse {
    result: {
        dbConnectionId: number;
    };
}

export type IResultSetStateData = IGenericResponse;

export interface IResultSetData extends IGenericResponse {
    result: {
        executionTime?: number;
        rows?: unknown[];
        columns?: Array<{ name: string; type: string; length: number }>;
        totalRowCount?: number;
    };
}

export interface IProfileListData extends IGenericResponse {
    result: Array<{
        id: number;
        name: string;
    }>;
}

export interface IProfileData extends IGenericResponse {
    result: ICommShellProfile;
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

export interface ISimpleRowData extends IGenericResponse {
    rows: unknown[];
}

export interface IShellPromptValues {
    promptDescriptor?: {
        user?: string;
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
    code: number;
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

// The members of this record come with pascal case naming, which is not processed by our snake-to-camel
// case processing. So for now we define this with the original names here, until this is fixed.
/* eslint-disable @typescript-eslint/naming-convention */
export interface IShellColumnMetadataEntry {
    Name: string;
    OrgName: string;
    Catalog: string;
    Database: string;
    Table: string;
    OrgTable: string;
    Type: string;
    DbType: string;
    Collation: string;
    Length: number;
    Decimals: number;
    Flags: string;
}
/* eslint-enable @typescript-eslint/naming-convention */

export interface IShellColumnsMetaData {
    [key: string]: IShellColumnMetadataEntry;
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

/**
 * Defines the common fields for all shell prompt requests.
 */
export interface IShellBaseFeedbackRequest {
    /** The request text to show. This is usually the question the user answers. */
    prompt: string;

    /** A custom title for the request dialog. */
    title?: string;

    /** Defines some context for the actual feedback request. It is a string list where every item is a paragraph. */
    description?: string[];
}

/**
 * Defines a simple text feedback request.
 */
export interface IShellTextFeedbackRequest extends IShellBaseFeedbackRequest {
    type: "text";
}

/**
 * Defines a confirmation feedback request. Used for simple yes/no/alt questions.
 * Note: the yes/no/alt fields may contain shortcut markup (by prefixing a letter with &).
 */
export interface IShellConfirmFeedbackRequest extends IShellBaseFeedbackRequest {
    type: "confirm";

    /** If given this defines the text for the accept option. Use "Yes" otherwise. */
    yes?: string;

    /** If given this defines the text for the deny option. Use "No" otherwise. */
    no?: string;

    /** If given this defines the text for an alternative option. Otherwise show nothing for this field. */
    alt?: string;

    /**
     * Defines which of the values above is to be marked as default and can also be selected using the <enter> key.
     */
    defaultValue?: string;
}

/**
 * Defines a selection feedback request, which allows the user to pick one option from a list.
 */
export interface IShellSelectFeedbackRequest extends IShellBaseFeedbackRequest {
    type: "select";

    /** The elements of the selection list. */
    options: string[];

    /**
     * Defines the index of the option in the list above, which should be marked as the default and
     * represents the initial value to be shown in the UI, so it can be taken over with a single click/<enter>.
     */
    defaultValue?: number;
}

export interface IShellDirectoryFeedbackRequest extends IShellBaseFeedbackRequest {
    type: "directory";

    defaultValue?: string;
}

// cspell: ignore filesave, fileopen

export interface IShellFileSaveFeedbackRequest extends IShellBaseFeedbackRequest {
    type: "filesave";

    defaultValue?: string;
}

export interface IShellFileOpenFeedbackRequest extends IShellBaseFeedbackRequest {
    type: "fileopen";

    defaultValue?: string;
}

export interface IShellPasswordFeedbackRequest extends IShellBaseFeedbackRequest {
    type: "password";
}

/**
 * This interface represents input requests from the BE.
 */
export type IShellFeedbackRequest =
    IShellTextFeedbackRequest
    | IShellConfirmFeedbackRequest
    | IShellSelectFeedbackRequest
    | IShellDirectoryFeedbackRequest
    | IShellFileSaveFeedbackRequest
    | IShellFileOpenFeedbackRequest
    | IShellPasswordFeedbackRequest;

export type IShellResultType =
    IShellFeedbackRequest
    | IShellObjectResult
    | IShellObjectResult[]
    | IShellValueResult
    | IShellSimpleResult
    | IShellDocumentData
    | IShellRowData
    | IShellColumnsMetaData
    | IDictionary; // Any other structured data.

export interface IShellResponse extends IGenericResponse {
    result?: IShellResultType;
}

export interface IShellModuleDataCategoriesEntry {
    id: number;
    name: string;
    parentCategoryId?: number;
}

export interface IShellDbDataCategoriesData extends IGenericResponse {
    result: IShellModuleDataCategoriesEntry[];
}

export interface IShellModuleAddData extends IGenericResponse {
    result: number;
}

export interface IShellModuleDataEntry {
    id: number;
    dataCategoryId: number;
    caption: string;
}

export interface IShellModuleData extends IGenericResponse {
    result: IShellModuleDataEntry[];
}

export interface IShellDbDataContentData extends IGenericResponse {
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

export interface IMdsBastionData {
    id: string;
}

export interface IShellMdsProfileData extends IGenericResponse {
    result: IMdsProfileData[];
}

export interface IShellMdsBastionsData extends IGenericResponse {
    result: IMdsBastionData[];
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

export interface IMrsServiceResultData extends IGenericResponse {
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

export interface IMrsSchemaResultData extends IGenericResponse {
    result: IMrsSchemaData[];
}

export interface IMrsDbObjectData {
    changedAt?: string;
    comments: string;
    crudOperations: string[];
    dbSchemaId: number;
    enabled: number;
    hostCtx?: string;
    id: number;
    itemsPerPage?: number;
    name: string;
    objectType: string;
    requestPath: string;
    requiresAuth: number;
    rowUserOwnershipColumn?: string;
    rowUserOwnershipEnforced: number;
    schemaRequestPath?: string;
    qualifiedName: string;
    serviceId: number;
}

export interface IMrsDbObjectResultData extends IGenericResponse {
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

export interface IDBDataTreeIdentifiers extends IGenericResponse {
    result: IDBDataTreeIdentifier[];
}

export interface IDBDataTreeContent extends IGenericResponse {
    result: IDBDataTreeEntry[];
}

export interface IObjectNamesData extends IGenericResponse {
    result?: string[];
}

export interface IErrorData extends IGenericResponse {
    result: {
        requestState: {
            type: "ERROR";

            /** The server error code. */
            code: number;

            /** Mostly a duplicate of the generic response message field (without MySQL error code). */
            msg: string;

            /** A value indicating what caused the error. */
            source: string;

            sqlstate: unknown;
        };
    };
}

export type ICommGenericEvent = IDispatchEvent<IGenericResponse>;
export type ICommSimpleResultEvent = IDispatchEvent<ISimpleResultData>;

// This is a temporary definition for responses that do not use the `result` field for data.
export type ICommSimpleRowEvent = IDispatchEvent<ISimpleRowData>;

export type ICommWebSessionEvent = IDispatchEvent<IWebSessionData>;
export type ICommAuthenticationEvent = IDispatchEvent<IAuthenticationData>;
export type ICommStartSessionEvent = IDispatchEvent<IStartSessionData>;
export type ICommCloseSessionEvent = IDispatchEvent<IGenericResponse>;
export type ICommAddConnectionEvent = IDispatchEvent<IAddConnectionData>;
export type ICommOpenConnectionEvent = IDispatchEvent<IOpenConnectionData>;

export type ICommResultSetStateEvent = IDispatchEvent<IResultSetStateData>;
export type ICommResultSetEvent = IDispatchEvent<IResultSetData>;
export type ICommListProfilesEvent = IDispatchEvent<IProfileListData>;
export type ICommProfileEvent = IDispatchEvent<IProfileData>;
export type ICommDbTypesEvent = IDispatchEvent<IDbTypesData>;
export type ICommDebuggerScriptsEvent = IDispatchEvent<IDebuggerScriptListData>;
export type ICommScriptContentEvent = IDispatchEvent<IScriptContentData>;
export type ICommObjectNamesEvent = IDispatchEvent<IObjectNamesData>;

export type ICommListDataCategoriesEvent = IDispatchEvent<IShellDbDataCategoriesData>;
export type ICommModuleAddDataEvent = IDispatchEvent<IShellModuleAddData>;
export type ICommModuleDataEvent = IDispatchEvent<IShellModuleData>;
export type ICommDbDataContentEvent = IDispatchEvent<IShellDbDataContentData>;
export type ICommProfileTreeIdentifiersEvent = IDispatchEvent<IDBDataTreeIdentifiers>;
export type ICommDataTreeContentEvent = IDispatchEvent<IDBDataTreeContent>;

export type ICommShellEvent = IDispatchEvent<IShellResponse>;
export type ICommShellCompletionEvent = IDispatchEvent<IShellCompletionData>;

export type ICommShellInformationEvent = IDispatchEvent<IShellBackendInformation>;

export type ICommMdsConfigProfileEvent = IDispatchEvent<IShellMdsProfileData>;

export type ICommMdsGetBastionsEvent = IDispatchEvent<IShellMdsBastionsData>;

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
        const result = DispatchEvents.okEvent(data, "webSession");
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
    public static generateResponseEvent(messageClass: string, data: IGenericResponse): IDispatchEvent {
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

        const result = DispatchEvents.baseEvent(eventType, data, data.requestId, messageClass);
        result.message = data.requestState.msg;

        return result;
    }

    /**
     * Creates an event object for data that was sent to the server. This event is usually handled only by
     * parts of the application, which need to track sent messages (like the communication debugger).
     *
     * @param data The actual data to be sent to the shell.
     *
     * @returns The constructed event for the shell request.
     */
    public static generateRequestEvent(data: IShellRequest): IDispatchEvent<ISentShellRequestData> {
        const eventData: ISentShellRequestData = {
            request: data,
            requestState: { type: "", msg: "" },
        };

        return DispatchEvents.baseEvent(EventType.Request, eventData, data.request_id);

    }
}
