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
    IExhaustedList,
    IFindFirstOptions,
    IFindManyOptions,
    IFindUniqueOptions,
    INotExhaustedList,
    PaginatedList,
    MrsBaseObjectQuery,
    NotFoundError,
    ICreateOptions,
    MrsBaseObjectCreate,
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
/*
 * MRS Object - /myService/mrsNotes/note (TABLE)
 */
class MyServiceMrsNotesNoteObject extends MrsBaseObject {

    public create = async (args: ICreateOptions<INewMyServiceMrsNotesNote>): Promise<IMyServiceMrsNotesNote> => {
        const request = new MrsBaseObjectCreate<INewMyServiceMrsNotesNote, IMyServiceMrsNotesNote, ["id"]>(this.schema, this.requestPath, args, ["id"]);
        const response = await request.fetch();

        return response;
    };

    public createMany = async (args: ICreateOptions<INewMyServiceMrsNotesNote[]>): Promise<IMyServiceMrsNotesNote[]> => {
        const result: IMyServiceMrsNotesNote[] = [];

        for (const item of args.data) {
            const response = await this.create({ data: item });

            result.push(response);
        }

        return result;
    };
    public async find(args?: IFindManyOptions<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteFilterable, IMyServiceMrsNotesNoteCursors>): Promise<PaginatedList<IMyServiceMrsNotesNote>> {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteFilterable, IMyServiceMrsNotesNoteCursors, ["id"]>(
            this.schema, this.requestPath, args, ["id"]);
        const response = await request.fetch();
        const docs: IMyServiceMrsNotesNote[] = response.items;

        if (!response.hasMore) {
            const paginatedList = docs as IExhaustedList<IMyServiceMrsNotesNote>;

            return paginatedList;
        }

        const paginatedList = docs as INotExhaustedList<IMyServiceMrsNotesNote>;
        paginatedList.hasMore = true;
        paginatedList.next = async () => {
            return this.find({ ...args, skip: response.limit + response.offset });
        };

        return paginatedList;
    }

    public async findFirst(args?: IFindFirstOptions<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteFilterable, IMyServiceMrsNotesNoteCursors>): Promise<IMyServiceMrsNotesNote | undefined> {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteFilterable, IMyServiceMrsNotesNoteCursors, ["id"]>(
            this.schema, this.requestPath, { ...args, take: 1 }, ["id"]);
        const response = await request.fetchOne();

        return response;
    }

    public async findFirstOrThrow(args?: IFindFirstOptions<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteFilterable, IMyServiceMrsNotesNoteCursors>): Promise<IMyServiceMrsNotesNote> {
        const response = await this.findFirst(args);

        if (response === undefined) {
            throw new NotFoundError(`Document not found.`);
        }

        return response;
    }
    public findUnique = async (args?: IFindUniqueOptions<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteUniqueFilterable>): Promise<IMyServiceMrsNotesNote | undefined> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteUniqueFilterable, never, ["id"]>(
            this.schema, this.requestPath, { ...args, take: 1 }, ["id"]);
        const response = await request.fetchOne();

        return response;
    };

    public findUniqueOrThrow = async (args?: IFindUniqueOptions<IMyServiceMrsNotesNote, IMyServiceMrsNotesNoteUniqueFilterable>): Promise<IMyServiceMrsNotesNote> => {
        const response = await this.findUnique(args);

        if (response === undefined) {
            throw new NotFoundError("Document not found.");
        }

        return response;
    };
    public update = async (args: IUpdateOptions<IUpdateMyServiceMrsNotesNote>): Promise<IMyServiceMrsNotesNote> => {
        const request = new MrsBaseObjectUpdate<IUpdateMyServiceMrsNotesNote, ["id"], IMyServiceMrsNotesNote>(
            this.schema, this.requestPath, args, ["id"]);
        const response = await request.fetch();

        return response;
    };

    public updateMany = async (args: IUpdateOptions<IUpdateMyServiceMrsNotesNote[]>): Promise<IMyServiceMrsNotesNote[]> => {
        const result: IMyServiceMrsNotesNote[] = [];

        for (const item of args.data) {
            const response = await this.update({ data: item });

            result.push(response);
        }

        return result;
    };
    public delete = async (args: IDeleteOptions<IMyServiceMrsNotesNoteUniqueFilterable, { many: false }>): Promise<IMrsDeleteResult> => {
        return this.deleteMany(args as IDeleteOptions<IMyServiceMrsNotesNoteFilterable>);
    };
    public deleteMany = async (args: IDeleteOptions<IMyServiceMrsNotesNoteFilterable>): Promise<IMrsDeleteResult> => {
        const request = new MrsBaseObjectDelete<IMyServiceMrsNotesNoteFilterable>(this.schema, this.requestPath, args);
        const response = await request.fetch();

        return response;
    };

}

export interface INewMyServiceMrsNotesNote {
    title: string,
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

export interface IUpdateMyServiceMrsNotesNote {
    title: string,
    id: number,
    lastUpdate: string,
    pinned: boolean,
    userId?: string,
    shared: boolean,
    tags?: MaybeNull<JsonValue>,
    createDate: string,
    lockedDown: boolean,
    content?: MaybeNull<string>,
}

export interface IMyServiceMrsNotesNote {
    title?: string,
    readonly id?: number,
    lastUpdate?: string,
    pinned?: boolean,
    userId?: string,
    shared?: boolean,
    tags?: MaybeNull<JsonValue>,
    createDate?: string,
    lockedDown?: boolean,
    content?: MaybeNull<string>,
    update(): Promise<IMyServiceMrsNotesNote>,
    delete(): Promise<void>,
}

export interface IMyServiceMrsNotesNoteFilterable {
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

export interface IMyServiceMrsNotesNoteUniqueFilterable {
    id?: number,
}

export interface IMyServiceMrsNotesNoteCursors {
    id?: number,
}


/*
 * MRS Object - /myService/mrsNotes/user (TABLE)
 */
class MyServiceMrsNotesUserObject extends MrsBaseObject {

    public create = async (args: ICreateOptions<INewMyServiceMrsNotesUser>): Promise<IMyServiceMrsNotesUser> => {
        const request = new MrsBaseObjectCreate<INewMyServiceMrsNotesUser, IMyServiceMrsNotesUser, ["id"]>(this.schema, this.requestPath, args, ["id"]);
        const response = await request.fetch();

        return response;
    };

    public createMany = async (args: ICreateOptions<INewMyServiceMrsNotesUser[]>): Promise<IMyServiceMrsNotesUser[]> => {
        const result: IMyServiceMrsNotesUser[] = [];

        for (const item of args.data) {
            const response = await this.create({ data: item });

            result.push(response);
        }

        return result;
    };
    public async find(args?: IFindManyOptions<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserFilterable, IMyServiceMrsNotesUserCursors>): Promise<PaginatedList<IMyServiceMrsNotesUser>> {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserFilterable, IMyServiceMrsNotesUserCursors, ["id"]>(
            this.schema, this.requestPath, args, ["id"]);
        const response = await request.fetch();
        const docs: IMyServiceMrsNotesUser[] = response.items;

        if (!response.hasMore) {
            const paginatedList = docs as IExhaustedList<IMyServiceMrsNotesUser>;

            return paginatedList;
        }

        const paginatedList = docs as INotExhaustedList<IMyServiceMrsNotesUser>;
        paginatedList.hasMore = true;
        paginatedList.next = async () => {
            return this.find({ ...args, skip: response.limit + response.offset });
        };

        return paginatedList;
    }

    public async findFirst(args?: IFindFirstOptions<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserFilterable, IMyServiceMrsNotesUserCursors>): Promise<IMyServiceMrsNotesUser | undefined> {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserFilterable, IMyServiceMrsNotesUserCursors, ["id"]>(
            this.schema, this.requestPath, { ...args, take: 1 }, ["id"]);
        const response = await request.fetchOne();

        return response;
    }

    public async findFirstOrThrow(args?: IFindFirstOptions<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserFilterable, IMyServiceMrsNotesUserCursors>): Promise<IMyServiceMrsNotesUser> {
        const response = await this.findFirst(args);

        if (response === undefined) {
            throw new NotFoundError(`Document not found.`);
        }

        return response;
    }
    public findUnique = async (args?: IFindUniqueOptions<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserUniqueFilterable>): Promise<IMyServiceMrsNotesUser | undefined> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserUniqueFilterable, never, ["id"]>(
            this.schema, this.requestPath, { ...args, take: 1 }, ["id"]);
        const response = await request.fetchOne();

        return response;
    };

    public findUniqueOrThrow = async (args?: IFindUniqueOptions<IMyServiceMrsNotesUser, IMyServiceMrsNotesUserUniqueFilterable>): Promise<IMyServiceMrsNotesUser> => {
        const response = await this.findUnique(args);

        if (response === undefined) {
            throw new NotFoundError("Document not found.");
        }

        return response;
    };
    public update = async (args: IUpdateOptions<IUpdateMyServiceMrsNotesUser>): Promise<IMyServiceMrsNotesUser> => {
        const request = new MrsBaseObjectUpdate<IUpdateMyServiceMrsNotesUser, ["id"], IMyServiceMrsNotesUser>(
            this.schema, this.requestPath, args, ["id"]);
        const response = await request.fetch();

        return response;
    };

    public updateMany = async (args: IUpdateOptions<IUpdateMyServiceMrsNotesUser[]>): Promise<IMyServiceMrsNotesUser[]> => {
        const result: IMyServiceMrsNotesUser[] = [];

        for (const item of args.data) {
            const response = await this.update({ data: item });

            result.push(response);
        }

        return result;
    };
    public delete = async (args: IDeleteOptions<IMyServiceMrsNotesUserUniqueFilterable, { many: false }>): Promise<IMrsDeleteResult> => {
        return this.deleteMany(args as IDeleteOptions<IMyServiceMrsNotesUserFilterable>);
    };
    public deleteMany = async (args: IDeleteOptions<IMyServiceMrsNotesUserFilterable>): Promise<IMrsDeleteResult> => {
        const request = new MrsBaseObjectDelete<IMyServiceMrsNotesUserFilterable>(this.schema, this.requestPath, args);
        const response = await request.fetch();

        return response;
    };

}

export interface INewMyServiceMrsNotesUser {
    id?: string,
    email?: MaybeNull<string>,
    nickname: string,
}

export interface IUpdateMyServiceMrsNotesUser {
    id?: string,
    email?: MaybeNull<string>,
    nickname: string,
}

export interface IMyServiceMrsNotesUser {
    readonly id?: string,
    email?: MaybeNull<string>,
    nickname?: string,
    update(): Promise<IMyServiceMrsNotesUser>,
    delete(): Promise<void>,
}

export interface IMyServiceMrsNotesUserFilterable {
    id?: string,
    email?: MaybeNull<string>,
    nickname?: string,
}

export interface IMyServiceMrsNotesUserUniqueFilterable {
    id?: string,
}

type IMyServiceMrsNotesUserCursors = never;


/*
 * MRS Object - /myService/mrsNotes/userHasNote (TABLE)
 */
class MyServiceMrsNotesUserHasNoteObject extends MrsBaseObject {

    public async find(args?: IFindManyOptions<IMyServiceMrsNotesUserHasNote, IMyServiceMrsNotesUserHasNoteFilterable, IMyServiceMrsNotesUserHasNoteCursors>): Promise<PaginatedList<IMyServiceMrsNotesUserHasNote>> {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesUserHasNote, IMyServiceMrsNotesUserHasNoteFilterable, IMyServiceMrsNotesUserHasNoteCursors, []>(
            this.schema, this.requestPath, args, []);
        const response = await request.fetch();
        const docs: IMyServiceMrsNotesUserHasNote[] = response.items;

        if (!response.hasMore) {
            const paginatedList = docs as IExhaustedList<IMyServiceMrsNotesUserHasNote>;

            return paginatedList;
        }

        const paginatedList = docs as INotExhaustedList<IMyServiceMrsNotesUserHasNote>;
        paginatedList.hasMore = true;
        paginatedList.next = async () => {
            return this.find({ ...args, skip: response.limit + response.offset });
        };

        return paginatedList;
    }

    public async findFirst(args?: IFindFirstOptions<IMyServiceMrsNotesUserHasNote, IMyServiceMrsNotesUserHasNoteFilterable, IMyServiceMrsNotesUserHasNoteCursors>): Promise<IMyServiceMrsNotesUserHasNote | undefined> {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesUserHasNote, IMyServiceMrsNotesUserHasNoteFilterable, IMyServiceMrsNotesUserHasNoteCursors, []>(
            this.schema, this.requestPath, { ...args, take: 1 }, []);
        const response = await request.fetchOne();

        return response;
    }

    public async findFirstOrThrow(args?: IFindFirstOptions<IMyServiceMrsNotesUserHasNote, IMyServiceMrsNotesUserHasNoteFilterable, IMyServiceMrsNotesUserHasNoteCursors>): Promise<IMyServiceMrsNotesUserHasNote> {
        const response = await this.findFirst(args);

        if (response === undefined) {
            throw new NotFoundError(`Document not found.`);
        }

        return response;
    }
    public findUnique = async (args?: IFindUniqueOptions<IMyServiceMrsNotesUserHasNote, IMyServiceMrsNotesUserHasNoteUniqueFilterable>): Promise<IMyServiceMrsNotesUserHasNote | undefined> => {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesUserHasNote, IMyServiceMrsNotesUserHasNoteUniqueFilterable, never, []>(
            this.schema, this.requestPath, { ...args, take: 1 }, []);
        const response = await request.fetchOne();

        return response;
    };

    public findUniqueOrThrow = async (args?: IFindUniqueOptions<IMyServiceMrsNotesUserHasNote, IMyServiceMrsNotesUserHasNoteUniqueFilterable>): Promise<IMyServiceMrsNotesUserHasNote> => {
        const response = await this.findUnique(args);

        if (response === undefined) {
            throw new NotFoundError("Document not found.");
        }

        return response;
    };

}

export interface IMyServiceMrsNotesUserHasNote {
    canShare?: boolean,
    viewOnly?: boolean,
    invitationKey?: MaybeNull<string>,
    readonly userId?: string,
    invitationAccepted?: boolean,
    readonly noteId?: number,
}

export interface IMyServiceMrsNotesUserHasNoteFilterable {
    canShare?: boolean,
    viewOnly?: boolean,
    invitationKey?: MaybeNull<string>,
    userId?: string,
    invitationAccepted?: boolean,
    noteId?: number,
}

export interface IMyServiceMrsNotesUserHasNoteUniqueFilterable {
    userId?: string,
    noteId?: number,
}

type IMyServiceMrsNotesUserHasNoteCursors = never;


/*
 * MRS Object - /myService/mrsNotes/notesAll (VIEW)
 */
class MyServiceMrsNotesNotesAllObject extends MrsBaseObject {

    public async find(args?: IFindManyOptions<IMyServiceMrsNotesNotesAll, IMyServiceMrsNotesNotesAllFilterable, IMyServiceMrsNotesNotesAllCursors>): Promise<PaginatedList<IMyServiceMrsNotesNotesAll>> {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesNotesAll, IMyServiceMrsNotesNotesAllFilterable, IMyServiceMrsNotesNotesAllCursors, []>(
            this.schema, this.requestPath, args, []);
        const response = await request.fetch();
        const docs: IMyServiceMrsNotesNotesAll[] = response.items;

        if (!response.hasMore) {
            const paginatedList = docs as IExhaustedList<IMyServiceMrsNotesNotesAll>;

            return paginatedList;
        }

        const paginatedList = docs as INotExhaustedList<IMyServiceMrsNotesNotesAll>;
        paginatedList.hasMore = true;
        paginatedList.next = async () => {
            return this.find({ ...args, skip: response.limit + response.offset });
        };

        return paginatedList;
    }

    public async findFirst(args?: IFindFirstOptions<IMyServiceMrsNotesNotesAll, IMyServiceMrsNotesNotesAllFilterable, IMyServiceMrsNotesNotesAllCursors>): Promise<IMyServiceMrsNotesNotesAll | undefined> {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesNotesAll, IMyServiceMrsNotesNotesAllFilterable, IMyServiceMrsNotesNotesAllCursors, []>(
            this.schema, this.requestPath, { ...args, take: 1 }, []);
        const response = await request.fetchOne();

        return response;
    }

    public async findFirstOrThrow(args?: IFindFirstOptions<IMyServiceMrsNotesNotesAll, IMyServiceMrsNotesNotesAllFilterable, IMyServiceMrsNotesNotesAllCursors>): Promise<IMyServiceMrsNotesNotesAll> {
        const response = await this.findFirst(args);

        if (response === undefined) {
            throw new NotFoundError(`Document not found.`);
        }

        return response;
    }

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

export interface IMyServiceMrsNotesNotesAllFilterable {
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

type IMyServiceMrsNotesNotesAllCursors = never;


/*
 * MRS Object - /myService/mrsNotes/notesServed (VIEW)
 */
class MyServiceMrsNotesNotesServedObject extends MrsBaseObject {

    public async find(args?: IFindManyOptions<IMyServiceMrsNotesNotesServed, IMyServiceMrsNotesNotesServedFilterable, IMyServiceMrsNotesNotesServedCursors>): Promise<PaginatedList<IMyServiceMrsNotesNotesServed>> {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesNotesServed, IMyServiceMrsNotesNotesServedFilterable, IMyServiceMrsNotesNotesServedCursors, []>(
            this.schema, this.requestPath, args, []);
        const response = await request.fetch();
        const docs: IMyServiceMrsNotesNotesServed[] = response.items;

        if (!response.hasMore) {
            const paginatedList = docs as IExhaustedList<IMyServiceMrsNotesNotesServed>;

            return paginatedList;
        }

        const paginatedList = docs as INotExhaustedList<IMyServiceMrsNotesNotesServed>;
        paginatedList.hasMore = true;
        paginatedList.next = async () => {
            return this.find({ ...args, skip: response.limit + response.offset });
        };

        return paginatedList;
    }

    public async findFirst(args?: IFindFirstOptions<IMyServiceMrsNotesNotesServed, IMyServiceMrsNotesNotesServedFilterable, IMyServiceMrsNotesNotesServedCursors>): Promise<IMyServiceMrsNotesNotesServed | undefined> {
        const request = new MrsBaseObjectQuery<IMyServiceMrsNotesNotesServed, IMyServiceMrsNotesNotesServedFilterable, IMyServiceMrsNotesNotesServedCursors, []>(
            this.schema, this.requestPath, { ...args, take: 1 }, []);
        const response = await request.fetchOne();

        return response;
    }

    public async findFirstOrThrow(args?: IFindFirstOptions<IMyServiceMrsNotesNotesServed, IMyServiceMrsNotesNotesServedFilterable, IMyServiceMrsNotesNotesServedCursors>): Promise<IMyServiceMrsNotesNotesServed> {
        const response = await this.findFirst(args);

        if (response === undefined) {
            throw new NotFoundError(`Document not found.`);
        }

        return response;
    }

}

export interface IMyServiceMrsNotesNotesServed {
    notesServed?: MaybeNull<number>,
}

export interface IMyServiceMrsNotesNotesServedFilterable {
    notesServed?: MaybeNull<number>,
}

type IMyServiceMrsNotesNotesServedCursors = never;


/*
 * MRS Object - /myService/mrsNotes/noteAcceptShare (PROCEDURE)
 */
class MyServiceMrsNotesNoteAcceptShareObject extends MrsBaseObject {

    public call = async (noteAcceptShareParams?: IMyServiceMrsNotesNoteAcceptShareParams): Promise<IMrsProcedureResult<IMyServiceMrsNotesNoteAcceptShareParamsOut, IMyServiceMrsNotesNoteAcceptShareResultSet>> => {
        const request = new MrsBaseObjectProcedureCall<IMyServiceMrsNotesNoteAcceptShareParams, IMyServiceMrsNotesNoteAcceptShareParamsOut, IMyServiceMrsNotesNoteAcceptShareResultSet>(
            this.schema, this.requestPath, noteAcceptShareParams);
        const response = await request.fetch();

        return response;
    };

}

export interface IMyServiceMrsNotesNoteAcceptShareParams {
    userId?: MaybeNull<string>,
    invitationKey?: MaybeNull<string>,
}

type IMyServiceMrsNotesNoteAcceptShareParamsOut = never;

export type IMyServiceMrsNotesNoteAcceptShareResultSet = JsonObject;


/*
 * MRS Object - /myService/mrsNotes/noteDelete (PROCEDURE)
 */
class MyServiceMrsNotesNoteDeleteObject extends MrsBaseObject {

    public call = async (noteDeleteParams?: IMyServiceMrsNotesNoteDeleteParams): Promise<IMrsProcedureResult<IMyServiceMrsNotesNoteDeleteParamsOut, IMyServiceMrsNotesNoteDeleteResultSet>> => {
        const request = new MrsBaseObjectProcedureCall<IMyServiceMrsNotesNoteDeleteParams, IMyServiceMrsNotesNoteDeleteParamsOut, IMyServiceMrsNotesNoteDeleteResultSet>(
            this.schema, this.requestPath, noteDeleteParams);
        const response = await request.fetch();

        return response;
    };

}

export interface IMyServiceMrsNotesNoteDeleteParams {
    userId?: MaybeNull<string>,
    noteId?: MaybeNull<number>,
}

type IMyServiceMrsNotesNoteDeleteParamsOut = never;

export type IMyServiceMrsNotesNoteDeleteResultSet = JsonObject;


/*
 * MRS Object - /myService/mrsNotes/noteShare (PROCEDURE)
 */
class MyServiceMrsNotesNoteShareObject extends MrsBaseObject {

    public call = async (noteShareParams?: IMyServiceMrsNotesNoteShareParams): Promise<IMrsProcedureResult<IMyServiceMrsNotesNoteShareParamsOut, IMyServiceMrsNotesNoteShareResultSet>> => {
        const request = new MrsBaseObjectProcedureCall<IMyServiceMrsNotesNoteShareParams, IMyServiceMrsNotesNoteShareParamsOut, IMyServiceMrsNotesNoteShareResultSet>(
            this.schema, this.requestPath, noteShareParams);
        const response = await request.fetch();

        return response;
    };

}

export interface IMyServiceMrsNotesNoteShare {
    invitationKey?: MaybeNull<string>,
}

export type ITaggedMyServiceMrsNotesNoteShare = {
    type: "MyServiceMrsNotesNoteShare",
    items: IMyServiceMrsNotesNoteShare[],
} & JsonObject;

export interface IMyServiceMrsNotesNoteShareParams {
    viewOnly?: MaybeNull<boolean>,
    userId?: MaybeNull<string>,
    email?: MaybeNull<string>,
    noteId?: MaybeNull<number>,
    canShare?: MaybeNull<boolean>,
}

type IMyServiceMrsNotesNoteShareParamsOut = never;

export type IMyServiceMrsNotesNoteShareResultSet = ITaggedMyServiceMrsNotesNoteShare;


/*
 * MRS Object - /myService/mrsNotes/noteUpdate (PROCEDURE)
 */
class MyServiceMrsNotesNoteUpdateObject extends MrsBaseObject {

    public call = async (noteUpdateParams?: IMyServiceMrsNotesNoteUpdateParams): Promise<IMrsProcedureResult<IMyServiceMrsNotesNoteUpdateParamsOut, IMyServiceMrsNotesNoteUpdateResultSet>> => {
        const request = new MrsBaseObjectProcedureCall<IMyServiceMrsNotesNoteUpdateParams, IMyServiceMrsNotesNoteUpdateParamsOut, IMyServiceMrsNotesNoteUpdateResultSet>(
            this.schema, this.requestPath, noteUpdateParams);
        const response = await request.fetch();

        return response;
    };

}

export interface IMyServiceMrsNotesNoteUpdateParams {
    tags?: MaybeNull<JsonValue>,
    lockedDown?: MaybeNull<boolean>,
    noteId?: MaybeNull<number>,
    title?: MaybeNull<string>,
    content?: MaybeNull<string>,
    pinned?: MaybeNull<boolean>,
    userId?: MaybeNull<string>,
}

type IMyServiceMrsNotesNoteUpdateParamsOut = never;

export type IMyServiceMrsNotesNoteUpdateResultSet = JsonObject;


class MyServiceMrsNotes extends MrsBaseSchema {
    #note?: MyServiceMrsNotesNoteObject;
    #user?: MyServiceMrsNotesUserObject;
    #userHasNote?: MyServiceMrsNotesUserHasNoteObject;
    #notesAll?: MyServiceMrsNotesNotesAllObject;
    #notesServed?: MyServiceMrsNotesNotesServedObject;
    #noteAcceptShare?: MyServiceMrsNotesNoteAcceptShareObject;
    #noteDelete?: MyServiceMrsNotesNoteDeleteObject;
    #noteShare?: MyServiceMrsNotesNoteShareObject;
    #noteUpdate?: MyServiceMrsNotesNoteUpdateObject;

    public get note(): MyServiceMrsNotesNoteObject {
        if (this.#note === undefined) {
            this.#note = new MyServiceMrsNotesNoteObject(this, "/note");
        }

        return this.#note;
    }
    public get user(): MyServiceMrsNotesUserObject {
        if (this.#user === undefined) {
            this.#user = new MyServiceMrsNotesUserObject(this, "/user");
        }

        return this.#user;
    }
    public get userHasNote(): MyServiceMrsNotesUserHasNoteObject {
        if (this.#userHasNote === undefined) {
            this.#userHasNote = new MyServiceMrsNotesUserHasNoteObject(this, "/userHasNote");
        }

        return this.#userHasNote;
    }
    public get notesAll(): MyServiceMrsNotesNotesAllObject {
        if (this.#notesAll === undefined) {
            this.#notesAll = new MyServiceMrsNotesNotesAllObject(this, "/notesAll");
        }

        return this.#notesAll;
    }
    public get notesServed(): MyServiceMrsNotesNotesServedObject {
        if (this.#notesServed === undefined) {
            this.#notesServed = new MyServiceMrsNotesNotesServedObject(this, "/notesServed");
        }

        return this.#notesServed;
    }
    public get noteAcceptShare(): MyServiceMrsNotesNoteAcceptShareObject {
        if (this.#noteAcceptShare === undefined) {
            this.#noteAcceptShare = new MyServiceMrsNotesNoteAcceptShareObject(this, "/noteAcceptShare");
        }

        return this.#noteAcceptShare;
    }
    public get noteDelete(): MyServiceMrsNotesNoteDeleteObject {
        if (this.#noteDelete === undefined) {
            this.#noteDelete = new MyServiceMrsNotesNoteDeleteObject(this, "/noteDelete");
        }

        return this.#noteDelete;
    }
    public get noteShare(): MyServiceMrsNotesNoteShareObject {
        if (this.#noteShare === undefined) {
            this.#noteShare = new MyServiceMrsNotesNoteShareObject(this, "/noteShare");
        }

        return this.#noteShare;
    }
    public get noteUpdate(): MyServiceMrsNotesNoteUpdateObject {
        if (this.#noteUpdate === undefined) {
            this.#noteUpdate = new MyServiceMrsNotesNoteUpdateObject(this, "/noteUpdate");
        }

        return this.#noteUpdate;
    }
}

/* =============================================================================
 * MRS Service https://localhost:8443/myService
 */
export class MyService extends MrsBaseService {
    #mrsNotes?: MyServiceMrsNotes;

    public constructor(baseUrl: string = "https://localhost:8443/myService") {
        super(baseUrl, "/authentication");
    }

    public get mrsNotes(): MyServiceMrsNotes {
        if (this.#mrsNotes === undefined) {
            this.#mrsNotes = new MyServiceMrsNotes(this, "/mrsNotes");
        }

        return this.#mrsNotes;
    }

    public async authenticate(options: IAuthenticateOptions): Promise<IMrsLoginResult> {
        const { username, password, app, vendor } = options ?? {};

        return super.authenticate({ username, password, app, vendor });
    }

    public async deauthenticate(): Promise<void> {
        await super.deauthenticate();
    }
}

