/* Copyright (c) 2023, Oracle and/or its affiliates. */

/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-classes-per-file */
/* eslint-disable padding-line-between-statements */
/* eslint-disable no-underscore-dangle */
/* eslint-disable padded-blocks */
/* eslint-disable no-trailing-spaces */
/* eslint-disable @typescript-eslint/lines-between-class-members */
/* eslint-disable @typescript-eslint/promise-function-async */
/* eslint-disable no-multiple-empty-lines */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
    Geometry,
    GeometryCollection,
    IMrsBaseObject,
    IMrsFetchData,
    JsonValue,
    LineString,
    MaybeNull,
    MrsBaseService,
    MrsBaseSchema,
    MultiLineString,
    MultiPoint,
    MultiPolygon,
    Point,
    Polygon,
    IFindFirstOptions,
    IFindManyOptions,
    IFindUniqueOptions,
    IMrsResultList,
    MrsBaseObjectQuery,
    NotFoundError,
    ICreateOptions,
    MrsBaseObjectCreate,
    IMrsProcedureResult,
    IMrsProcedureResultList,
    MrsBaseObjectCall,
    // --- importReadFunctionOnlyStart
    MrsBaseObjectFunctionCall,
    // --- importReadFunctionOnlyEnd
    IUpdateOptions,
    MrsBaseObjectUpdate,
    IMrsDeleteResult,
    IDeleteOptions,
    MrsBaseObjectDelete,
} from "./MrsBaseClasses";

export type { IMrsAuthUser, IMrsAuthStatus } from "./MrsBaseClasses";
/* -----------------------------------------------------------------------------
 * MRS Schema /mrsNotes
 */

export class MyServiceMrsNotesObjectRequest {
    public constructor(
        public schema: MyServiceMrsNotes) {
    }
}
/*
 * MRS Object - /myService/mrsNotes/note (TABLE)
 */

export class MyServiceMrsNotesNoteRequest extends MyServiceMrsNotesObjectRequest {

    static readonly #schemaRequestPath = "/mrsNotes";
    static readonly #requestPath = "/note";

    public rest = {
        post: (note: IMyServiceMrsNotesNote): MrsBaseObjectCreate<IMyServiceMrsNotesNote> => {
            return new MrsBaseObjectCreate<IMyServiceMrsNotesNote>(this.schema, MyServiceMrsNotesNoteRequest.#requestPath, note);
        },
        get: <K extends keyof IMyServiceMrsNotesNote>(
            ...args: K[]): MrsBaseObjectQuery<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteParams> => {
            return new MrsBaseObjectQuery<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteParams>(
                this.schema, MyServiceMrsNotesNoteRequest.#requestPath, args);
        },
        put: (
            note: IMyServiceMrsNotesNote,
            key?: string[]): MrsBaseObjectUpdate<IMyServiceMrsNotesNote> => {
            return new MrsBaseObjectUpdate<IMyServiceMrsNotesNote>(
                this.schema, MyServiceMrsNotesNoteRequest.#requestPath, note, key !== undefined ? key : [String(note.id)]);
        },
        delete: (): MrsBaseObjectDelete<IMyServiceMrsNotesNoteParams> => {
            return new MrsBaseObjectDelete<IMyServiceMrsNotesNoteParams>(this.schema, MyServiceMrsNotesNoteRequest.#requestPath);
        },
    };
    public create = async (args: ICreateOptions<IMyServiceMrsNotesNote>): Promise<IMyServiceMrsNotesNote> => {
        const response = await this.rest.post(args.data).fetch();

        return response;
    };

    public createMany = async (args: ICreateOptions<IMyServiceMrsNotesNote[]>): Promise<IMyServiceMrsNotesNote[]> => {
        const result: IMyServiceMrsNotesNote[] = [];

        for (const item of args.data) {
            const response = await this.create({ data: item });

            result.push(response);
        }

        return result;
    };
    public findMany = async (args?: IFindManyOptions<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteParams>): Promise<IMrsResultList<IMyServiceMrsNotesNote>> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteParams>(
            this.schema, MyServiceMrsNotesNoteRequest.#requestPath, args?.select)
            .where(args?.where).orderBy(args?.orderBy).limit(args?.take).offset(args?.skip);
        let response;
        if (args?.fetchAll !== undefined && typeof args?.fetchAll === "boolean" && args?.fetchAll) {
            response = await request.fetchAll();
        } else if (args?.fetchAll !== undefined && typeof args?.fetchAll !== "boolean") {
            response = await request.fetchAll(args?.fetchAll?.pageSize, args?.fetchAll?.progress);
        } else {
            response = await request.fetch();
        }
        return response;
    };

    public findFirst = async (args?: IFindFirstOptions<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteParams>): Promise<IMyServiceMrsNotesNote | undefined> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteParams>(
            this.schema, MyServiceMrsNotesNoteRequest.#requestPath, args?.select);
        const response = await request.where(args?.where).orderBy(args?.orderBy).limit(1).offset(args?.skip).fetchOne();

        return response;
    };
    public findUnique = async (args?: IFindUniqueOptions<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteUniqueParams>): Promise<IMyServiceMrsNotesNote | undefined> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteUniqueParams>(
            this.schema, MyServiceMrsNotesNoteRequest.#requestPath, args?.select);
        const response = await request.where(args?.where).fetchOne();

        return response;
    };
    public findUniqueOrThrow = async (args?: IFindUniqueOptions<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteUniqueParams>): Promise<IMyServiceMrsNotesNote> => {
        const response = await this.findUnique(args);

        if (response === undefined) {
            throw new NotFoundError(`Record not found.`);
        }

        return response;
    };
    public update = async (args: IUpdateOptions<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteParams, ["id"], { batch: false }>): Promise<IMyServiceMrsNotesNote> => {
        const response = await this.rest.put(args.data, [String(args.where.id)])
            .fetch();

        return response;
    };

    public updateMany = async (args: IUpdateOptions<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteParams, ["id"], { batch: true }>): Promise<IMyServiceMrsNotesNote[]> => {
        const result: IMyServiceMrsNotesNote[] = [];

        for (const { id } of args.where) {
            const response = await this.update({ ...args, where: { id } });

            result.push(response);
        }

        return result;
    };
    public delete = async (args: IDeleteOptions<IMyServiceMrsNotesNoteParams>): Promise<IMrsDeleteResult> => {
        const response = await this.rest.delete().where(args.where).fetch();

        return response;
    };

    public deleteMany = async (args: IDeleteOptions<IMyServiceMrsNotesNoteParams>): Promise<IMrsDeleteResult> => {
        const response = await this.delete(args);

        return response;
    };


}

export interface IMyServiceMrsNotesNote extends IMrsBaseObject {
    title?: string,
    id?: number,
    lastUpdate?: string,
    pinned?: boolean,
    userId?: string,
    shared?: boolean,
    tags?: MaybeNull<JsonValue>,
    createDate?: string,
    lockedDown?: boolean,
    content?: MaybeNull<string>,
}

export interface IMyServiceMrsNotesNoteParams extends IMrsFetchData {
    title?: string,
    id?: number,
    lastUpdate?: string,
    pinned?: boolean,
    userId?: string,
    shared?: boolean,
    tags?: MaybeNull<JsonValue>,
    createDate?: string,
    lockedDown?: boolean,
    content?: MaybeNull<string>,
}

export interface IMyServiceMrsNotesNoteUniqueParams {
    id?: number,
}


/*
 * MRS Object - /myService/mrsNotes/user (TABLE)
 */

export class MyServiceMrsNotesUserRequest extends MyServiceMrsNotesObjectRequest {

    static readonly #schemaRequestPath = "/mrsNotes";
    static readonly #requestPath = "/user";

    public rest = {
        post: (user: IMyServiceMrsNotesUser): MrsBaseObjectCreate<IMyServiceMrsNotesUser> => {
            return new MrsBaseObjectCreate<IMyServiceMrsNotesUser>(this.schema, MyServiceMrsNotesUserRequest.#requestPath, user);
        },
        get: <K extends keyof IMyServiceMrsNotesUser>(
            ...args: K[]): MrsBaseObjectQuery<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserParams> => {
            return new MrsBaseObjectQuery<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserParams>(
                this.schema, MyServiceMrsNotesUserRequest.#requestPath, args);
        },
        put: (
            user: IMyServiceMrsNotesUser,
            key?: string[]): MrsBaseObjectUpdate<IMyServiceMrsNotesUser> => {
            return new MrsBaseObjectUpdate<IMyServiceMrsNotesUser>(
                this.schema, MyServiceMrsNotesUserRequest.#requestPath, user, key !== undefined ? key : [String(user.id)]);
        },
        delete: (): MrsBaseObjectDelete<IMyServiceMrsNotesUserParams> => {
            return new MrsBaseObjectDelete<IMyServiceMrsNotesUserParams>(this.schema, MyServiceMrsNotesUserRequest.#requestPath);
        },
    };
    public create = async (args: ICreateOptions<IMyServiceMrsNotesUser>): Promise<IMyServiceMrsNotesUser> => {
        const response = await this.rest.post(args.data).fetch();

        return response;
    };

    public createMany = async (args: ICreateOptions<IMyServiceMrsNotesUser[]>): Promise<IMyServiceMrsNotesUser[]> => {
        const result: IMyServiceMrsNotesUser[] = [];

        for (const item of args.data) {
            const response = await this.create({ data: item });

            result.push(response);
        }

        return result;
    };
    public findMany = async (args?: IFindManyOptions<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserParams>): Promise<IMrsResultList<IMyServiceMrsNotesUser>> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserParams>(
            this.schema, MyServiceMrsNotesUserRequest.#requestPath, args?.select)
            .where(args?.where).orderBy(args?.orderBy).limit(args?.take).offset(args?.skip);
        let response;
        if (args?.fetchAll !== undefined && typeof args?.fetchAll === "boolean" && args?.fetchAll) {
            response = await request.fetchAll();
        } else if (args?.fetchAll !== undefined && typeof args?.fetchAll !== "boolean") {
            response = await request.fetchAll(args?.fetchAll?.pageSize, args?.fetchAll?.progress);
        } else {
            response = await request.fetch();
        }
        return response;
    };

    public findFirst = async (args?: IFindFirstOptions<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserParams>): Promise<IMyServiceMrsNotesUser | undefined> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserParams>(
            this.schema, MyServiceMrsNotesUserRequest.#requestPath, args?.select);
        const response = await request.where(args?.where).orderBy(args?.orderBy).limit(1).offset(args?.skip).fetchOne();

        return response;
    };
    public findUnique = async (args?: IFindUniqueOptions<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserUniqueParams>): Promise<IMyServiceMrsNotesUser | undefined> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserUniqueParams>(
            this.schema, MyServiceMrsNotesUserRequest.#requestPath, args?.select);
        const response = await request.where(args?.where).fetchOne();

        return response;
    };
    public findUniqueOrThrow = async (args?: IFindUniqueOptions<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserUniqueParams>): Promise<IMyServiceMrsNotesUser> => {
        const response = await this.findUnique(args);

        if (response === undefined) {
            throw new NotFoundError(`Record not found.`);
        }

        return response;
    };
    public update = async (args: IUpdateOptions<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserParams, ["id"], { batch: false }>): Promise<IMyServiceMrsNotesUser> => {
        const response = await this.rest.put(args.data, [String(args.where.id)])
            .fetch();

        return response;
    };

    public updateMany = async (args: IUpdateOptions<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserParams, ["id"], { batch: true }>): Promise<IMyServiceMrsNotesUser[]> => {
        const result: IMyServiceMrsNotesUser[] = [];

        for (const { id } of args.where) {
            const response = await this.update({ ...args, where: { id } });

            result.push(response);
        }

        return result;
    };
    public delete = async (args: IDeleteOptions<IMyServiceMrsNotesUserParams>): Promise<IMrsDeleteResult> => {
        const response = await this.rest.delete().where(args.where).fetch();

        return response;
    };

    public deleteMany = async (args: IDeleteOptions<IMyServiceMrsNotesUserParams>): Promise<IMrsDeleteResult> => {
        const response = await this.delete(args);

        return response;
    };


}

export interface IMyServiceMrsNotesUser extends IMrsBaseObject {
    id?: string,
    email?: MaybeNull<string>,
    nickname?: string,
}

export interface IMyServiceMrsNotesUserParams extends IMrsFetchData {
    id?: string,
    email?: MaybeNull<string>,
    nickname?: string,
}

export interface IMyServiceMrsNotesUserUniqueParams {
    id?: string,
}


/*
 * MRS Object - /myService/mrsNotes/userHasNote (TABLE)
 */

export class MyServiceMrsNotesUserHasNoteRequest extends MyServiceMrsNotesObjectRequest {

    static readonly #schemaRequestPath = "/mrsNotes";
    static readonly #requestPath = "/userHasNote";

    public rest = {
        get: <K extends keyof IMyServiceMrsNotesUserHasNote>(
            ...args: K[]): MrsBaseObjectQuery<IMyServiceMrsNotesUserHasNote, IMyServiceMrsNotesUserHasNoteParams> => {
            return new MrsBaseObjectQuery<IMyServiceMrsNotesUserHasNote, IMyServiceMrsNotesUserHasNoteParams>(
                this.schema, MyServiceMrsNotesUserHasNoteRequest.#requestPath, args);
        },
    };
    public findMany = async (args?: IFindManyOptions<IMyServiceMrsNotesUserHasNote, IMyServiceMrsNotesUserHasNoteParams>): Promise<IMrsResultList<IMyServiceMrsNotesUserHasNote>> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesUserHasNote, IMyServiceMrsNotesUserHasNoteParams>(
            this.schema, MyServiceMrsNotesUserHasNoteRequest.#requestPath, args?.select)
            .where(args?.where).orderBy(args?.orderBy).limit(args?.take).offset(args?.skip);
        let response;
        if (args?.fetchAll !== undefined && typeof args?.fetchAll === "boolean" && args?.fetchAll) {
            response = await request.fetchAll();
        } else if (args?.fetchAll !== undefined && typeof args?.fetchAll !== "boolean") {
            response = await request.fetchAll(args?.fetchAll?.pageSize, args?.fetchAll?.progress);
        } else {
            response = await request.fetch();
        }
        return response;
    };

    public findFirst = async (args?: IFindFirstOptions<IMyServiceMrsNotesUserHasNote, IMyServiceMrsNotesUserHasNoteParams>): Promise<IMyServiceMrsNotesUserHasNote | undefined> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesUserHasNote, IMyServiceMrsNotesUserHasNoteParams>(
            this.schema, MyServiceMrsNotesUserHasNoteRequest.#requestPath, args?.select);
        const response = await request.where(args?.where).orderBy(args?.orderBy).limit(1).offset(args?.skip).fetchOne();

        return response;
    };
    public findUnique = async (args?: IFindUniqueOptions<IMyServiceMrsNotesUserHasNote, IMyServiceMrsNotesUserHasNoteUniqueParams>): Promise<IMyServiceMrsNotesUserHasNote | undefined> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesUserHasNote, IMyServiceMrsNotesUserHasNoteUniqueParams>(
            this.schema, MyServiceMrsNotesUserHasNoteRequest.#requestPath, args?.select);
        const response = await request.where(args?.where).fetchOne();

        return response;
    };
    public findUniqueOrThrow = async (args?: IFindUniqueOptions<IMyServiceMrsNotesUserHasNote, IMyServiceMrsNotesUserHasNoteUniqueParams>): Promise<IMyServiceMrsNotesUserHasNote> => {
        const response = await this.findUnique(args);

        if (response === undefined) {
            throw new NotFoundError(`Record not found.`);
        }

        return response;
    };


}

export interface IMyServiceMrsNotesUserHasNote extends IMrsBaseObject {
    canShare?: boolean,
    viewOnly?: boolean,
    invitationKey?: MaybeNull<string>,
    userId?: string,
    invitationAccepted?: boolean,
    noteId?: number,
}

export interface IMyServiceMrsNotesUserHasNoteParams extends IMrsFetchData {
    canShare?: boolean,
    viewOnly?: boolean,
    invitationKey?: MaybeNull<string>,
    userId?: string,
    invitationAccepted?: boolean,
    noteId?: number,
}

export interface IMyServiceMrsNotesUserHasNoteUniqueParams {
    userId?: string,
    noteId?: number,
}


/*
 * MRS Object - /myService/mrsNotes/notesAll (VIEW)
 */

export class MyServiceMrsNotesNotesAllRequest extends MyServiceMrsNotesObjectRequest {

    static readonly #schemaRequestPath = "/mrsNotes";
    static readonly #requestPath = "/notesAll";

    public rest = {
        get: <K extends keyof IMyServiceMrsNotesNotesAll>(
            ...args: K[]): MrsBaseObjectQuery<IMyServiceMrsNotesNotesAll, IMyServiceMrsNotesNotesAllParams> => {
            return new MrsBaseObjectQuery<IMyServiceMrsNotesNotesAll, IMyServiceMrsNotesNotesAllParams>(
                this.schema, MyServiceMrsNotesNotesAllRequest.#requestPath, args);
        },
    };
    public findMany = async (args?: IFindManyOptions<IMyServiceMrsNotesNotesAll, IMyServiceMrsNotesNotesAllParams>): Promise<IMrsResultList<IMyServiceMrsNotesNotesAll>> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesNotesAll, IMyServiceMrsNotesNotesAllParams>(
            this.schema, MyServiceMrsNotesNotesAllRequest.#requestPath, args?.select)
            .where(args?.where).orderBy(args?.orderBy).limit(args?.take).offset(args?.skip);
        let response;
        if (args?.fetchAll !== undefined && typeof args?.fetchAll === "boolean" && args?.fetchAll) {
            response = await request.fetchAll();
        } else if (args?.fetchAll !== undefined && typeof args?.fetchAll !== "boolean") {
            response = await request.fetchAll(args?.fetchAll?.pageSize, args?.fetchAll?.progress);
        } else {
            response = await request.fetch();
        }
        return response;
    };

    public findFirst = async (args?: IFindFirstOptions<IMyServiceMrsNotesNotesAll, IMyServiceMrsNotesNotesAllParams>): Promise<IMyServiceMrsNotesNotesAll | undefined> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesNotesAll, IMyServiceMrsNotesNotesAllParams>(
            this.schema, MyServiceMrsNotesNotesAllRequest.#requestPath, args?.select);
        const response = await request.where(args?.where).orderBy(args?.orderBy).limit(1).offset(args?.skip).fetchOne();

        return response;
    };


}

export interface IMyServiceMrsNotesNotesAll extends IMrsBaseObject {
    lastUpdate?: string,
    createDate?: string,
    content?: MaybeNull<string>,
    contentBeginning?: MaybeNull<string>,
    ownNote?: number,
    viewOnly?: boolean,
    lockedDown?: boolean,
    id?: number,
    pinned?: boolean,
    title?: string,
    tags?: MaybeNull<JsonValue>,
    shared?: boolean,
    userId?: string,
}

export interface IMyServiceMrsNotesNotesAllParams extends IMrsFetchData {
    lastUpdate?: string,
    createDate?: string,
    content?: MaybeNull<string>,
    contentBeginning?: MaybeNull<string>,
    ownNote?: number,
    viewOnly?: boolean,
    lockedDown?: boolean,
    id?: number,
    pinned?: boolean,
    title?: string,
    tags?: MaybeNull<JsonValue>,
    shared?: boolean,
    userId?: string,
}


/*
 * MRS Object - /myService/mrsNotes/notesServed (VIEW)
 */

export class MyServiceMrsNotesNotesServedRequest extends MyServiceMrsNotesObjectRequest {

    static readonly #schemaRequestPath = "/mrsNotes";
    static readonly #requestPath = "/notesServed";

    public rest = {
        get: <K extends keyof IMyServiceMrsNotesNotesServed>(
            ...args: K[]): MrsBaseObjectQuery<IMyServiceMrsNotesNotesServed, IMyServiceMrsNotesNotesServedParams> => {
            return new MrsBaseObjectQuery<IMyServiceMrsNotesNotesServed, IMyServiceMrsNotesNotesServedParams>(
                this.schema, MyServiceMrsNotesNotesServedRequest.#requestPath, args);
        },
    };
    public findMany = async (args?: IFindManyOptions<IMyServiceMrsNotesNotesServed, IMyServiceMrsNotesNotesServedParams>): Promise<IMrsResultList<IMyServiceMrsNotesNotesServed>> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesNotesServed, IMyServiceMrsNotesNotesServedParams>(
            this.schema, MyServiceMrsNotesNotesServedRequest.#requestPath, args?.select)
            .where(args?.where).orderBy(args?.orderBy).limit(args?.take).offset(args?.skip);
        let response;
        if (args?.fetchAll !== undefined && typeof args?.fetchAll === "boolean" && args?.fetchAll) {
            response = await request.fetchAll();
        } else if (args?.fetchAll !== undefined && typeof args?.fetchAll !== "boolean") {
            response = await request.fetchAll(args?.fetchAll?.pageSize, args?.fetchAll?.progress);
        } else {
            response = await request.fetch();
        }
        return response;
    };

    public findFirst = async (args?: IFindFirstOptions<IMyServiceMrsNotesNotesServed, IMyServiceMrsNotesNotesServedParams>): Promise<IMyServiceMrsNotesNotesServed | undefined> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesNotesServed, IMyServiceMrsNotesNotesServedParams>(
            this.schema, MyServiceMrsNotesNotesServedRequest.#requestPath, args?.select);
        const response = await request.where(args?.where).orderBy(args?.orderBy).limit(1).offset(args?.skip).fetchOne();

        return response;
    };


}

export interface IMyServiceMrsNotesNotesServed extends IMrsBaseObject {
    notesServed?: MaybeNull<number>,
}

export interface IMyServiceMrsNotesNotesServedParams extends IMrsFetchData {
    notesServed?: MaybeNull<number>,
}


/*
 * MRS Object - /myService/mrsNotes/noteAcceptShare (PROCEDURE)
 */

export class MyServiceMrsNotesNoteAcceptShareParamsRequest extends MyServiceMrsNotesObjectRequest {

    static readonly #schemaRequestPath = "/mrsNotes";
    static readonly #requestPath = "/noteAcceptShare";

    public rest = {
        put: (
            noteAcceptShareParams: IMyServiceMrsNotesNoteAcceptShareParams,
        ): MrsBaseObjectCall<IMrsProcedureResult, IMyServiceMrsNotesNoteAcceptShareParams> => {
            return new MrsBaseObjectCall<IMrsProcedureResult, IMyServiceMrsNotesNoteAcceptShareParams>(
                this.schema, MyServiceMrsNotesNoteAcceptShareParamsRequest.#requestPath, noteAcceptShareParams);
        },
    };
    public call = (
        noteAcceptShareParams: IMyServiceMrsNotesNoteAcceptShareParams,
    ): Promise<IMrsProcedureResultList<IMrsProcedureResult>> => {
        return this.rest.put(noteAcceptShareParams).fetch();
    };


}

export interface IMyServiceMrsNotesNoteAcceptShareParams extends IMrsFetchData {
    userId?: string,
    invitationKey?: string,
}


/*
 * MRS Object - /myService/mrsNotes/noteDelete (PROCEDURE)
 */

export class MyServiceMrsNotesNoteDeleteParamsRequest extends MyServiceMrsNotesObjectRequest {

    static readonly #schemaRequestPath = "/mrsNotes";
    static readonly #requestPath = "/noteDelete";

    public rest = {
        put: (
            noteDeleteParams: IMyServiceMrsNotesNoteDeleteParams,
        ): MrsBaseObjectCall<IMrsProcedureResult, IMyServiceMrsNotesNoteDeleteParams> => {
            return new MrsBaseObjectCall<IMrsProcedureResult, IMyServiceMrsNotesNoteDeleteParams>(
                this.schema, MyServiceMrsNotesNoteDeleteParamsRequest.#requestPath, noteDeleteParams);
        },
    };
    public call = (
        noteDeleteParams: IMyServiceMrsNotesNoteDeleteParams,
    ): Promise<IMrsProcedureResultList<IMrsProcedureResult>> => {
        return this.rest.put(noteDeleteParams).fetch();
    };


}

export interface IMyServiceMrsNotesNoteDeleteParams extends IMrsFetchData {
    userId?: string,
    noteId?: number,
}


/*
 * MRS Object - /myService/mrsNotes/noteShare (PROCEDURE)
 */

export class MyServiceMrsNotesNoteShareRequest extends MyServiceMrsNotesObjectRequest {

    static readonly #schemaRequestPath = "/mrsNotes";
    static readonly #requestPath = "/noteShare";

    public rest = {
        put: (
            noteShareParams: IMyServiceMrsNotesNoteShareParams,
        ): MrsBaseObjectCall<IMyServiceMrsNotesNoteShareMeta, IMyServiceMrsNotesNoteShareParams> => {
            return new MrsBaseObjectCall<IMyServiceMrsNotesNoteShareMeta, IMyServiceMrsNotesNoteShareParams>(
                this.schema, MyServiceMrsNotesNoteShareRequest.#requestPath, noteShareParams);
        },
    };
    public call = (
        noteShareParams: IMyServiceMrsNotesNoteShareParams,
    ): Promise<IMrsProcedureResultList<IMyServiceMrsNotesNoteShareMeta>> => {
        return this.rest.put(noteShareParams).fetch();
    };


}

export interface IMyServiceMrsNotesNoteShareParams extends IMrsFetchData {
    viewOnly?: boolean,
    userId?: string,
    email?: string,
    noteId?: number,
    canShare?: boolean,
}

export interface IMyServiceMrsNotesNoteShareResult {
    type: "MyServiceMrsNotesNoteShare",
    items: IMyServiceMrsNotesNoteShare[],
}

export interface IMyServiceMrsNotesNoteShare {
    invitationKey?: MaybeNull<string>,
}

export type IMyServiceMrsNotesNoteShareMeta = IMyServiceMrsNotesNoteShareResult;


/*
 * MRS Object - /myService/mrsNotes/noteUpdate (PROCEDURE)
 */

export class MyServiceMrsNotesNoteUpdateParamsRequest extends MyServiceMrsNotesObjectRequest {

    static readonly #schemaRequestPath = "/mrsNotes";
    static readonly #requestPath = "/noteUpdate";

    public rest = {
        put: (
            noteUpdateParams: IMyServiceMrsNotesNoteUpdateParams,
        ): MrsBaseObjectCall<IMrsProcedureResult, IMyServiceMrsNotesNoteUpdateParams> => {
            return new MrsBaseObjectCall<IMrsProcedureResult, IMyServiceMrsNotesNoteUpdateParams>(
                this.schema, MyServiceMrsNotesNoteUpdateParamsRequest.#requestPath, noteUpdateParams);
        },
    };
    public call = (
        noteUpdateParams: IMyServiceMrsNotesNoteUpdateParams,
    ): Promise<IMrsProcedureResultList<IMrsProcedureResult>> => {
        return this.rest.put(noteUpdateParams).fetch();
    };


}

export interface IMyServiceMrsNotesNoteUpdateParams extends IMrsFetchData {
    tags?: JsonValue,
    lockedDown?: boolean,
    noteId?: number,
    title?: string,
    content?: string,
    pinned?: boolean,
    userId?: string,
}



export class MyServiceMrsNotes extends MrsBaseSchema {
    #note?: MyServiceMrsNotesNoteRequest;
    #user?: MyServiceMrsNotesUserRequest;
    #userHasNote?: MyServiceMrsNotesUserHasNoteRequest;
    #notesAll?: MyServiceMrsNotesNotesAllRequest;
    #notesServed?: MyServiceMrsNotesNotesServedRequest;
    #noteAcceptShare?: MyServiceMrsNotesNoteAcceptShareParamsRequest;
    #noteDelete?: MyServiceMrsNotesNoteDeleteParamsRequest;
    #noteShare?: MyServiceMrsNotesNoteShareRequest;
    #noteUpdate?: MyServiceMrsNotesNoteUpdateParamsRequest;
    public get note(): MyServiceMrsNotesNoteRequest { if (this.#note === undefined) { this.#note = new MyServiceMrsNotesNoteRequest(this); } return this.#note; }
    public get user(): MyServiceMrsNotesUserRequest { if (this.#user === undefined) { this.#user = new MyServiceMrsNotesUserRequest(this); } return this.#user; }
    public get userHasNote(): MyServiceMrsNotesUserHasNoteRequest { if (this.#userHasNote === undefined) { this.#userHasNote = new MyServiceMrsNotesUserHasNoteRequest(this); } return this.#userHasNote; }
    public get notesAll(): MyServiceMrsNotesNotesAllRequest { if (this.#notesAll === undefined) { this.#notesAll = new MyServiceMrsNotesNotesAllRequest(this); } return this.#notesAll; }
    public get notesServed(): MyServiceMrsNotesNotesServedRequest { if (this.#notesServed === undefined) { this.#notesServed = new MyServiceMrsNotesNotesServedRequest(this); } return this.#notesServed; }
    public get noteAcceptShare(): MyServiceMrsNotesNoteAcceptShareParamsRequest { if (this.#noteAcceptShare === undefined) { this.#noteAcceptShare = new MyServiceMrsNotesNoteAcceptShareParamsRequest(this); } return this.#noteAcceptShare; }
    public get noteDelete(): MyServiceMrsNotesNoteDeleteParamsRequest { if (this.#noteDelete === undefined) { this.#noteDelete = new MyServiceMrsNotesNoteDeleteParamsRequest(this); } return this.#noteDelete; }
    public get noteShare(): MyServiceMrsNotesNoteShareRequest { if (this.#noteShare === undefined) { this.#noteShare = new MyServiceMrsNotesNoteShareRequest(this); } return this.#noteShare; }
    public get noteUpdate(): MyServiceMrsNotesNoteUpdateParamsRequest { if (this.#noteUpdate === undefined) { this.#noteUpdate = new MyServiceMrsNotesNoteUpdateParamsRequest(this); } return this.#noteUpdate; }
    
}

/* =============================================================================
 * MRS Service https://localhost:8444/myService
 */

export class MyService extends MrsBaseService {
    #mrsNotes?: MyServiceMrsNotes;

    public constructor() {
        super("https://localhost:8444/myService", "/authentication");
    }
    public get mrsNotes(): MyServiceMrsNotes { if (this.#mrsNotes === undefined) { this.#mrsNotes = new MyServiceMrsNotes(this, "/mrsNotes"); } return this.#mrsNotes; }
    
}


