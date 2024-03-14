/* Copyright (c) 2023, 2024, Oracle and/or its affiliates. */

/* eslint-disable max-len */
/* eslint-disable max-classes-per-file */
import {
    IMrsFetchData,
    MrsBaseService,
    MrsBaseSchema,
    MaybeNull,
    JsonValue,
    IFindAllOptions,
    IFindFirstOptions,
    IFindManyOptions,
    IFindUniqueOptions,
    MrsBaseObjectQuery,
    NotFoundError,
    ICreateOptions,
    MrsBaseObjectCreate,
    IMrsProcedureResult,
    IMrsProcedureResultList,
    MrsBaseObjectProcedureCall,
    IUpdateOptions,
    MrsBaseObjectUpdate,
    IMrsDeleteResult,
    IDeleteOptions,
    MrsBaseObjectDelete,
} from "./MrsBaseClasses";

// --- MySQL Shell for VS Code Extension Remove --- Begin
export type { IMrsAuthUser, IMrsAuthStatus } from "./MrsBaseClasses";
// --- MySQL Shell for VS Code Extension Remove --- End
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

    #hasMore = true;

    public rest = {
        post: (note: IMyServiceMrsNotesNote): MrsBaseObjectCreate<IMyServiceMrsNotesNote> => {
            return new MrsBaseObjectCreate<IMyServiceMrsNotesNote>(this.schema, MyServiceMrsNotesNoteRequest.#requestPath, note, false);
        },
        get: <K extends keyof IMyServiceMrsNotesNote>(
            ...args: K[]): MrsBaseObjectQuery<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteParams> => {
            return new MrsBaseObjectQuery<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteParams>(
                this.schema, MyServiceMrsNotesNoteRequest.#requestPath, args, undefined, undefined, false);
        },
        put: (
            note: IMyServiceMrsNotesNote,
            key?: string[]): MrsBaseObjectUpdate<IMyServiceMrsNotesNote> => {
            return new MrsBaseObjectUpdate<IMyServiceMrsNotesNote>(
                this.schema, MyServiceMrsNotesNoteRequest.#requestPath, note, key !== undefined ? key : [String(note.id)], false);
        },
        delete: (): MrsBaseObjectDelete<IMyServiceMrsNotesNoteParams> => {
            return new MrsBaseObjectDelete<IMyServiceMrsNotesNoteParams>(this.schema, MyServiceMrsNotesNoteRequest.#requestPath);
        },
    };
    public create = async (args: ICreateOptions<IMyServiceMrsNotesNote>): Promise<IMyServiceMrsNotesNote> => {
        const request = new MrsBaseObjectCreate<IMyServiceMrsNotesNote>(this.schema, MyServiceMrsNotesNoteRequest.#requestPath, args.data);
        const response = await request.fetch();

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
    public findAll = async (args?: IFindAllOptions<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteParams>): Promise<IMyServiceMrsNotesNote[]> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteParams>(
            this.schema, MyServiceMrsNotesNoteRequest.#requestPath, args?.select)
            .where(args?.where).orderBy(args?.orderBy).offset(args?.skip);
        const response = await request.fetchAll(args?.progress);

        return response.items;
    };

    public findMany = async ({ cursor, iterator = true, orderBy, select, skip, take, where }: IFindManyOptions<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteParams, IMyServiceMrsNotesNoteCursors>): Promise<IMyServiceMrsNotesNote[]> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteParams, IMyServiceMrsNotesNoteCursors>(
            this.schema, MyServiceMrsNotesNoteRequest.#requestPath, select, undefined, cursor)
            .where({ ...where }).orderBy(orderBy).limit(take).offset(skip);

        if (!this.#hasMore && iterator) {
            this.#hasMore = true;
            return [];
        }

        const response = await request.fetch();

        if (iterator) {
            this.#hasMore = response.hasMore;
        }

        return response.items;
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
        const request = new MrsBaseObjectUpdate<IMyServiceMrsNotesNote>(
            this.schema, MyServiceMrsNotesNoteRequest.#requestPath, args.data, [String(args.where.id)]);
        const response = await request.fetch();

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

export interface IMyServiceMrsNotesNote {
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

export interface IMyServiceMrsNotesNoteCursors {
    id?: number,
}


/*
 * MRS Object - /myService/mrsNotes/user (TABLE)
 */

export class MyServiceMrsNotesUserRequest extends MyServiceMrsNotesObjectRequest {

    static readonly #schemaRequestPath = "/mrsNotes";
    static readonly #requestPath = "/user";

    #hasMore = true;

    public rest = {
        post: (user: IMyServiceMrsNotesUser): MrsBaseObjectCreate<IMyServiceMrsNotesUser> => {
            return new MrsBaseObjectCreate<IMyServiceMrsNotesUser>(this.schema, MyServiceMrsNotesUserRequest.#requestPath, user, false);
        },
        get: <K extends keyof IMyServiceMrsNotesUser>(
            ...args: K[]): MrsBaseObjectQuery<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserParams> => {
            return new MrsBaseObjectQuery<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserParams>(
                this.schema, MyServiceMrsNotesUserRequest.#requestPath, args, undefined, undefined, false);
        },
        put: (
            user: IMyServiceMrsNotesUser,
            key?: string[]): MrsBaseObjectUpdate<IMyServiceMrsNotesUser> => {
            return new MrsBaseObjectUpdate<IMyServiceMrsNotesUser>(
                this.schema, MyServiceMrsNotesUserRequest.#requestPath, user, key !== undefined ? key : [String(user.id)], false);
        },
        delete: (): MrsBaseObjectDelete<IMyServiceMrsNotesUserParams> => {
            return new MrsBaseObjectDelete<IMyServiceMrsNotesUserParams>(this.schema, MyServiceMrsNotesUserRequest.#requestPath);
        },
    };
    public create = async (args: ICreateOptions<IMyServiceMrsNotesUser>): Promise<IMyServiceMrsNotesUser> => {
        const request = new MrsBaseObjectCreate<IMyServiceMrsNotesUser>(this.schema, MyServiceMrsNotesUserRequest.#requestPath, args.data);
        const response = await request.fetch();

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
    public findAll = async (args?: IFindAllOptions<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserParams>): Promise<IMyServiceMrsNotesUser[]> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserParams>(
            this.schema, MyServiceMrsNotesUserRequest.#requestPath, args?.select)
            .where(args?.where).orderBy(args?.orderBy).offset(args?.skip);
        const response = await request.fetchAll(args?.progress);

        return response.items;
    };

    public findMany = async ({ cursor, iterator = true, orderBy, select, skip, take, where }: IFindManyOptions<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserParams, IMyServiceMrsNotesUserCursors>): Promise<IMyServiceMrsNotesUser[]> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserParams, IMyServiceMrsNotesUserCursors>(
            this.schema, MyServiceMrsNotesUserRequest.#requestPath, select, undefined, cursor)
            .where({ ...where }).orderBy(orderBy).limit(take).offset(skip);

        if (!this.#hasMore && iterator) {
            this.#hasMore = true;
            return [];
        }

        const response = await request.fetch();

        if (iterator) {
            this.#hasMore = response.hasMore;
        }

        return response.items;
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
        const request = new MrsBaseObjectUpdate<IMyServiceMrsNotesUser>(
            this.schema, MyServiceMrsNotesUserRequest.#requestPath, args.data, [String(args.where.id)]);
        const response = await request.fetch();

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

export interface IMyServiceMrsNotesUser {
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

    #hasMore = true;

    public rest = {
        get: <K extends keyof IMyServiceMrsNotesUserHasNote>(
            ...args: K[]): MrsBaseObjectQuery<IMyServiceMrsNotesUserHasNote, IMyServiceMrsNotesUserHasNoteParams> => {
            return new MrsBaseObjectQuery<IMyServiceMrsNotesUserHasNote, IMyServiceMrsNotesUserHasNoteParams>(
                this.schema, MyServiceMrsNotesUserHasNoteRequest.#requestPath, args, undefined, undefined, false);
        },
    };
    public findAll = async (args?: IFindAllOptions<IMyServiceMrsNotesUserHasNote, IMyServiceMrsNotesUserHasNoteParams>): Promise<IMyServiceMrsNotesUserHasNote[]> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesUserHasNote, IMyServiceMrsNotesUserHasNoteParams>(
            this.schema, MyServiceMrsNotesUserHasNoteRequest.#requestPath, args?.select)
            .where(args?.where).orderBy(args?.orderBy).offset(args?.skip);
        const response = await request.fetchAll(args?.progress);

        return response.items;
    };

    public findMany = async ({ cursor, iterator = true, orderBy, select, skip, take, where }: IFindManyOptions<IMyServiceMrsNotesUserHasNote, IMyServiceMrsNotesUserHasNoteParams, IMyServiceMrsNotesUserHasNoteCursors>): Promise<IMyServiceMrsNotesUserHasNote[]> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesUserHasNote, IMyServiceMrsNotesUserHasNoteParams, IMyServiceMrsNotesUserHasNoteCursors>(
            this.schema, MyServiceMrsNotesUserHasNoteRequest.#requestPath, select, undefined, cursor)
            .where({ ...where }).orderBy(orderBy).limit(take).offset(skip);

        if (!this.#hasMore && iterator) {
            this.#hasMore = true;
            return [];
        }

        const response = await request.fetch();

        if (iterator) {
            this.#hasMore = response.hasMore;
        }

        return response.items;
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

export interface IMyServiceMrsNotesUserHasNote {
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

    #hasMore = true;

    public rest = {
        get: <K extends keyof IMyServiceMrsNotesNotesAll>(
            ...args: K[]): MrsBaseObjectQuery<IMyServiceMrsNotesNotesAll, IMyServiceMrsNotesNotesAllParams> => {
            return new MrsBaseObjectQuery<IMyServiceMrsNotesNotesAll, IMyServiceMrsNotesNotesAllParams>(
                this.schema, MyServiceMrsNotesNotesAllRequest.#requestPath, args, undefined, undefined, false);
        },
    };
    public findAll = async (args?: IFindAllOptions<IMyServiceMrsNotesNotesAll, IMyServiceMrsNotesNotesAllParams>): Promise<IMyServiceMrsNotesNotesAll[]> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesNotesAll, IMyServiceMrsNotesNotesAllParams>(
            this.schema, MyServiceMrsNotesNotesAllRequest.#requestPath, args?.select)
            .where(args?.where).orderBy(args?.orderBy).offset(args?.skip);
        const response = await request.fetchAll(args?.progress);

        return response.items;
    };

    public findMany = async ({ cursor, iterator = true, orderBy, select, skip, take, where }: IFindManyOptions<IMyServiceMrsNotesNotesAll, IMyServiceMrsNotesNotesAllParams, IMyServiceMrsNotesNotesAllCursors>): Promise<IMyServiceMrsNotesNotesAll[]> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesNotesAll, IMyServiceMrsNotesNotesAllParams, IMyServiceMrsNotesNotesAllCursors>(
            this.schema, MyServiceMrsNotesNotesAllRequest.#requestPath, select, undefined, cursor)
            .where({ ...where }).orderBy(orderBy).limit(take).offset(skip);

        if (!this.#hasMore && iterator) {
            this.#hasMore = true;
            return [];
        }

        const response = await request.fetch();

        if (iterator) {
            this.#hasMore = response.hasMore;
        }

        return response.items;
    };

    public findFirst = async (args?: IFindFirstOptions<IMyServiceMrsNotesNotesAll, IMyServiceMrsNotesNotesAllParams>): Promise<IMyServiceMrsNotesNotesAll | undefined> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesNotesAll, IMyServiceMrsNotesNotesAllParams>(
            this.schema, MyServiceMrsNotesNotesAllRequest.#requestPath, args?.select);
        const response = await request.where(args?.where).orderBy(args?.orderBy).limit(1).offset(args?.skip).fetchOne();

        return response;
    };

}

export interface IMyServiceMrsNotesNotesAll {
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

    #hasMore = true;

    public rest = {
        get: <K extends keyof IMyServiceMrsNotesNotesServed>(
            ...args: K[]): MrsBaseObjectQuery<IMyServiceMrsNotesNotesServed, IMyServiceMrsNotesNotesServedParams> => {
            return new MrsBaseObjectQuery<IMyServiceMrsNotesNotesServed, IMyServiceMrsNotesNotesServedParams>(
                this.schema, MyServiceMrsNotesNotesServedRequest.#requestPath, args, undefined, undefined, false);
        },
    };
    public findAll = async (args?: IFindAllOptions<IMyServiceMrsNotesNotesServed, IMyServiceMrsNotesNotesServedParams>): Promise<IMyServiceMrsNotesNotesServed[]> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesNotesServed, IMyServiceMrsNotesNotesServedParams>(
            this.schema, MyServiceMrsNotesNotesServedRequest.#requestPath, args?.select)
            .where(args?.where).orderBy(args?.orderBy).offset(args?.skip);
        const response = await request.fetchAll(args?.progress);

        return response.items;
    };

    public findMany = async ({ cursor, iterator = true, orderBy, select, skip, take, where }: IFindManyOptions<IMyServiceMrsNotesNotesServed, IMyServiceMrsNotesNotesServedParams, IMyServiceMrsNotesNotesServedCursors>): Promise<IMyServiceMrsNotesNotesServed[]> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesNotesServed, IMyServiceMrsNotesNotesServedParams, IMyServiceMrsNotesNotesServedCursors>(
            this.schema, MyServiceMrsNotesNotesServedRequest.#requestPath, select, undefined, cursor)
            .where({ ...where }).orderBy(orderBy).limit(take).offset(skip);

        if (!this.#hasMore && iterator) {
            this.#hasMore = true;
            return [];
        }

        const response = await request.fetch();

        if (iterator) {
            this.#hasMore = response.hasMore;
        }

        return response.items;
    };

    public findFirst = async (args?: IFindFirstOptions<IMyServiceMrsNotesNotesServed, IMyServiceMrsNotesNotesServedParams>): Promise<IMyServiceMrsNotesNotesServed | undefined> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesNotesServed, IMyServiceMrsNotesNotesServedParams>(
            this.schema, MyServiceMrsNotesNotesServedRequest.#requestPath, args?.select);
        const response = await request.where(args?.where).orderBy(args?.orderBy).limit(1).offset(args?.skip).fetchOne();

        return response;
    };

}

export interface IMyServiceMrsNotesNotesServed {
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

    #hasMore = true;

    public rest = {
        put: (
            noteAcceptShareParams: IMyServiceMrsNotesNoteAcceptShareParams,
        ): MrsBaseObjectProcedureCall<IMrsProcedureResult, IMyServiceMrsNotesNoteAcceptShareParams> => {
            return new MrsBaseObjectProcedureCall<IMrsProcedureResult, IMyServiceMrsNotesNoteAcceptShareParams>(
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

    #hasMore = true;

    public rest = {
        put: (
            noteDeleteParams: IMyServiceMrsNotesNoteDeleteParams,
        ): MrsBaseObjectProcedureCall<IMrsProcedureResult, IMyServiceMrsNotesNoteDeleteParams> => {
            return new MrsBaseObjectProcedureCall<IMrsProcedureResult, IMyServiceMrsNotesNoteDeleteParams>(
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

    #hasMore = true;

    public rest = {
        put: (
            noteShareParams: IMyServiceMrsNotesNoteShareParams,
        ): MrsBaseObjectProcedureCall<IMyServiceMrsNotesNoteShareMeta, IMyServiceMrsNotesNoteShareParams> => {
            return new MrsBaseObjectProcedureCall<IMyServiceMrsNotesNoteShareMeta, IMyServiceMrsNotesNoteShareParams>(
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

    #hasMore = true;

    public rest = {
        put: (
            noteUpdateParams: IMyServiceMrsNotesNoteUpdateParams,
        ): MrsBaseObjectProcedureCall<IMrsProcedureResult, IMyServiceMrsNotesNoteUpdateParams> => {
            return new MrsBaseObjectProcedureCall<IMrsProcedureResult, IMyServiceMrsNotesNoteUpdateParams>(
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
    public get note(): MyServiceMrsNotesNoteRequest {
        if (this.#note === undefined) {
            this.#note = new MyServiceMrsNotesNoteRequest(this);
        }

        return this.#note;
    }
    public get user(): MyServiceMrsNotesUserRequest {
        if (this.#user === undefined) {
            this.#user = new MyServiceMrsNotesUserRequest(this);
        }

        return this.#user;
    }
    public get userHasNote(): MyServiceMrsNotesUserHasNoteRequest {
        if (this.#userHasNote === undefined) {
            this.#userHasNote = new MyServiceMrsNotesUserHasNoteRequest(this);
        }

        return this.#userHasNote;
    }
    public get notesAll(): MyServiceMrsNotesNotesAllRequest {
        if (this.#notesAll === undefined) {
            this.#notesAll = new MyServiceMrsNotesNotesAllRequest(this);
        }

        return this.#notesAll;
    }
    public get notesServed(): MyServiceMrsNotesNotesServedRequest {
        if (this.#notesServed === undefined) {
            this.#notesServed = new MyServiceMrsNotesNotesServedRequest(this);
        }

        return this.#notesServed;
    }
    public get noteAcceptShare(): MyServiceMrsNotesNoteAcceptShareParamsRequest {
        if (this.#noteAcceptShare === undefined) {
            this.#noteAcceptShare = new MyServiceMrsNotesNoteAcceptShareParamsRequest(this);
        }

        return this.#noteAcceptShare;
    }
    public get noteDelete(): MyServiceMrsNotesNoteDeleteParamsRequest {
        if (this.#noteDelete === undefined) {
            this.#noteDelete = new MyServiceMrsNotesNoteDeleteParamsRequest(this);
        }

        return this.#noteDelete;
    }
    public get noteShare(): MyServiceMrsNotesNoteShareRequest {
        if (this.#noteShare === undefined) {
            this.#noteShare = new MyServiceMrsNotesNoteShareRequest(this);
        }

        return this.#noteShare;
    }
    public get noteUpdate(): MyServiceMrsNotesNoteUpdateParamsRequest {
        if (this.#noteUpdate === undefined) {
            this.#noteUpdate = new MyServiceMrsNotesNoteUpdateParamsRequest(this);
        }

        return this.#noteUpdate;
    }

}

/* =============================================================================
 * MRS Service https://localhost:8444/myService
 */

export class MyService extends MrsBaseService {
    #mrsNotes?: MyServiceMrsNotes;

    public constructor() {
        super("https://localhost:8444/myService", "/authentication");
    }
    public get mrsNotes(): MyServiceMrsNotes {
        if (this.#mrsNotes === undefined) {
            this.#mrsNotes = new MyServiceMrsNotes(this, "/mrsNotes");
        }

        return this.#mrsNotes;
    }

}

