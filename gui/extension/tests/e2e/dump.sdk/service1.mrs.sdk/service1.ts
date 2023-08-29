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
import {
    IMrsBaseObject,
    IMrsFetchData,
    MaybeNull,
    MrsBaseService,
    MrsBaseSchema,
    JsonValue,
} from "./MrsBaseClasses";

/* =============================================================================
 * MRS Service https://localhost:8443/service1
 */

export class Service1 extends MrsBaseService {
    #sakila?: Service1Sakila;
    #schemaToDump?: Service1SchemaToDump;
    #worldXCst?: Service1WorldXCst;

    public constructor() {
        super("https://localhost:8443/service1", "/authentication");
    }
    public get sakila(): Service1Sakila { if (this.#sakila === undefined) { this.#sakila = new Service1Sakila(this, "/sakila"); } return this.#sakila; }
    public get schemaToDump(): Service1SchemaToDump { if (this.#schemaToDump === undefined) { this.#schemaToDump = new Service1SchemaToDump(this, "/schemaToDump"); } return this.#schemaToDump; }
    public get worldXCst(): Service1WorldXCst { if (this.#worldXCst === undefined) { this.#worldXCst = new Service1WorldXCst(this, "/world_x_cst"); } return this.#worldXCst; }
    
}
/* -----------------------------------------------------------------------------
 * MRS Schema /sakila
 */

export class Service1Sakila extends MrsBaseSchema {
    #actor?: Service1SakilaActorRequest;
    #address?: Service1SakilaAddressRequest;
    public get actor(): Service1SakilaActorRequest { if (this.#actor === undefined) { this.#actor = new Service1SakilaActorRequest(this); } return this.#actor; }
    public get address(): Service1SakilaAddressRequest { if (this.#address === undefined) { this.#address = new Service1SakilaAddressRequest(this); } return this.#address; }
}

export class Service1SakilaObjectRequest {
    public constructor(
        public schema: Service1Sakila) {
    }
}
/*
 * MRS Object - /service1/sakila/actor (TABLE)
 */

export class Service1SakilaActorRequest extends Service1SakilaObjectRequest {

    static readonly #schemaRequestPath = "/sakila";
    static readonly #requestPath = "/actor";

    public rest = {
        get: <K extends keyof IService1SakilaActor>(
            ...args: K[]): MrsBaseObjectQuery<IService1SakilaActor, IService1SakilaActorParams> => {
            return new MrsBaseObjectQuery<IService1SakilaActor, IService1SakilaActorParams>(
                this.schema, Service1SakilaActorRequest.#requestPath, args);
        },
    };
    public findMany = async (args?: IFindManyOptions<IService1SakilaActor, IService1SakilaActorParams>): Promise<IMrsResultList<IService1SakilaActor>> => {
        const request = new MrsBaseObjectQuery<IService1SakilaActor, IService1SakilaActorParams>(
            this.schema, Service1SakilaActorRequest.#requestPath, args?.select)
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

    public findFirst = async (args?: IFindFirstOptions<IService1SakilaActor, IService1SakilaActorParams>): Promise<IService1SakilaActor | undefined> => {
        const request = new MrsBaseObjectQuery<IService1SakilaActor, IService1SakilaActorParams>(
            this.schema, Service1SakilaActorRequest.#requestPath, args?.select);
        const response = await request.where(args?.where).orderBy(args?.orderBy).limit(1).offset(args?.skip).fetchOne();

        return response;
    };
    public findUnique = async (args?: IFindUniqueOptions<IService1SakilaActor, IService1SakilaActorUniqueParams>): Promise<IService1SakilaActor | undefined> => {
        const request = new MrsBaseObjectQuery<IService1SakilaActor, IService1SakilaActorUniqueParams>(
            this.schema, Service1SakilaActorRequest.#requestPath, args?.select);
        const response = await request.where(args?.where).fetchOne();

        return response;
    };
    public findUniqueOrThrow = async (args?: IFindUniqueOptions<IService1SakilaActor, IService1SakilaActorUniqueParams>): Promise<IService1SakilaActor> => {
        const response = await this.findUnique(args);

        if (response === undefined) {
            throw new NotFoundError(`Record not found.`);
        }

        return response;
    };


}

export interface IService1SakilaActor extends IMrsBaseObject {
    lastUpdate?: string,
    actorId?: number,
    lastName?: string,
    firstName?: string,
}

export interface IService1SakilaActorParams extends IMrsFetchData {
    lastUpdate?: string,
    actorId?: number,
    lastName?: string,
    firstName?: string,
}

export interface IService1SakilaActorUniqueParams {
    actorId?: number,
}


/*
 * MRS Object - /service1/sakila/address (TABLE)
 */

export class Service1SakilaAddressRequest extends Service1SakilaObjectRequest {

    static readonly #schemaRequestPath = "/sakila";
    static readonly #requestPath = "/address";

    public rest = {
        get: <K extends keyof IService1SakilaAddress>(
            ...args: K[]): MrsBaseObjectQuery<IService1SakilaAddress, IService1SakilaAddressParams> => {
            return new MrsBaseObjectQuery<IService1SakilaAddress, IService1SakilaAddressParams>(
                this.schema, Service1SakilaAddressRequest.#requestPath, args);
        },
    };
    public findMany = async (args?: IFindManyOptions<IService1SakilaAddress, IService1SakilaAddressParams>): Promise<IMrsResultList<IService1SakilaAddress>> => {
        const request = new MrsBaseObjectQuery<IService1SakilaAddress, IService1SakilaAddressParams>(
            this.schema, Service1SakilaAddressRequest.#requestPath, args?.select)
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

    public findFirst = async (args?: IFindFirstOptions<IService1SakilaAddress, IService1SakilaAddressParams>): Promise<IService1SakilaAddress | undefined> => {
        const request = new MrsBaseObjectQuery<IService1SakilaAddress, IService1SakilaAddressParams>(
            this.schema, Service1SakilaAddressRequest.#requestPath, args?.select);
        const response = await request.where(args?.where).orderBy(args?.orderBy).limit(1).offset(args?.skip).fetchOne();

        return response;
    };
    public findUnique = async (args?: IFindUniqueOptions<IService1SakilaAddress, IService1SakilaAddressUniqueParams>): Promise<IService1SakilaAddress | undefined> => {
        const request = new MrsBaseObjectQuery<IService1SakilaAddress, IService1SakilaAddressUniqueParams>(
            this.schema, Service1SakilaAddressRequest.#requestPath, args?.select);
        const response = await request.where(args?.where).fetchOne();

        return response;
    };
    public findUniqueOrThrow = async (args?: IFindUniqueOptions<IService1SakilaAddress, IService1SakilaAddressUniqueParams>): Promise<IService1SakilaAddress> => {
        const response = await this.findUnique(args);

        if (response === undefined) {
            throw new NotFoundError(`Record not found.`);
        }

        return response;
    };


}

export interface IService1SakilaAddress extends IMrsBaseObject {
    phone?: string,
    addressId?: number,
    address2?: MaybeNull<string>,
    lastUpdate?: string,
    cityId?: number,
    address?: string,
    district?: string,
    postalCode?: MaybeNull<string>,
}

export interface IService1SakilaAddressParams extends IMrsFetchData {
    phone?: string,
    addressId?: number,
    address2?: MaybeNull<string>,
    lastUpdate?: string,
    cityId?: number,
    address?: string,
    district?: string,
    postalCode?: MaybeNull<string>,
}

export interface IService1SakilaAddressUniqueParams {
    addressId?: number,
}


/* -----------------------------------------------------------------------------
 * MRS Schema /schemaToDump
 */

export class Service1SchemaToDump extends MrsBaseSchema {
}

export class Service1SchemaToDumpObjectRequest {
    public constructor(
        public schema: Service1SchemaToDump) {
    }
}
/* -----------------------------------------------------------------------------
 * MRS Schema /world_x_cst
 */

export class Service1WorldXCst extends MrsBaseSchema {
}

export class Service1WorldXCstObjectRequest {
    public constructor(
        public schema: Service1WorldXCst) {
    }
}


