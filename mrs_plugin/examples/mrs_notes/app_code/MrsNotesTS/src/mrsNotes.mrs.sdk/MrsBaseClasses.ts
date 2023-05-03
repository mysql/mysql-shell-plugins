/*
 * Copyright (c) 2023, Oracle and/or its affiliates.
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

/* eslint-disable max-classes-per-file */

export interface IMrsFetchData {
    [key: string]: unknown,
}

export interface IMrsFetchInput {
    errorMsg?: string;
    method?: string;
    body?: object | IMrsFetchData;
    input: string;
    timeout?: number;
}

interface IAuthChallenge {
    nonce: string;
    iterations: number;
    salt: Uint8Array;
    session?: string;
}

interface IMrsLoginState {
    userName?: string;
    password?: string;
    clientFirst?: string;
    clientFinal?: string;
    serverFirst?: string;
    challenge?: IAuthChallenge;
    loginError?: string;
}

export interface IMrsLoginResult {
    authApp?: string;
    jwt?: string;
    errorCode?: number;
    errorMessage?: string;
}

// --- MySQL Shell for VS Code Extension Remove --- Begin
declare const mrsLoginResult: IMrsLoginResult | undefined;
// --- MySQL Shell for VS Code Extension Remove --- End

/**
 * Implements a session that is used by a MrsService to perform fetch() calls.
 *
 * The session also supports authentication via MRS AuthApps.
 */
export class MrsBaseSession {
    public accessToken?: string;
    public authApp?: string;

    protected loginState: IMrsLoginState = {};

    public constructor(
        protected serviceUrl: string,
        protected authPath = "/authentication",
        protected defaultTimeout = 8000) {
        // --- MySQL Shell for VS Code Extension Only --- Begin
        try {
            // Try to get global mrsLoginResult values when already authenticated in the DB NoteBook
            this.accessToken = mrsLoginResult?.jwt;
            this.authApp = mrsLoginResult?.authApp;
        } catch (_e) {
            // Ignore
        }
        // --- MySQL Shell for VS Code Extension Only --- End
    }

    /**
     * A small wrapper around fetch() that uses the active JWT accessToken to the MRS and throws
     * an exception if the response was not OK
     *
     * @param input The RequestInfo, either a URL string or a JSON object with named parameters
     * @param errorMsg The error message to include in the exception if the fetch is not successful
     * @param method The HTTP method to use with GET being the default
     * @param body The request body as object
     * @param autoResponseCheck Set to false if the error checking should not be performed
     * @param timeout The timeout for this fetch call. If not specified, the default timeout of the session is used.
     *
     * @returns The response object
     */
    public doFetch = async (input: string | IMrsFetchInput, errorMsg?: string,
        method?: string, body?: object | IMrsFetchData, autoResponseCheck = true,
        timeout?: number): Promise<Response> => {
        // Check if parameters are passed as named parameters and if so, assign them
        if (typeof input === "object" && input !== null) {
            errorMsg = input?.errorMsg ?? "Failed to fetch data.";
            method = input?.method ?? "GET";
            body = input?.body;
            timeout = input?.timeout;
            input = input?.input;
        } else {
            errorMsg = errorMsg ?? "Failed to fetch data.";
            method = method ?? "GET";
        }

        const controller = new AbortController();
        const timeoutTimer = setTimeout(() => { controller.abort(); }, timeout ?? this.defaultTimeout);
        let response;

        try {
            response = await fetch(`${this.serviceUrl ?? ""}${input}`, {
                method,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                headers: (this.accessToken !== undefined) ? { Authorization: "Bearer " + this.accessToken } : undefined,
                body: (body !== undefined) ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
        } catch (e) {
            throw new Error(`${errorMsg}\n\nPlease check if MySQL Router is running and the REST endpoint ` +
                `${this.serviceUrl ?? ""}${input} does exist.`);
        } finally {
            clearTimeout(timeoutTimer);
        }

        if (!response.ok && autoResponseCheck) {
            // Check if the current session has expired
            if (response.status === 401) {
                /* this.setState({ restarting: true });
                window.alert("Your current session expired. You will be logged in again.");

                void this.startLogin(authApp); */
                throw new Error(`Not authenticated. Please authenticate first before accessing the ` +
                    `path ${this.serviceUrl ?? ""}${input}.`);
            } else {
                let errorInfo = null;
                try {
                    errorInfo = await response.json();
                } catch (e) {
                    // Ignore the exception
                }
                throw new Error(`${response.status}. ${errorMsg} (${response.statusText})` +
                    `${(errorInfo !== undefined) ? ("\n\n" + JSON.stringify(errorInfo, null, 4) + "\n") : ""}`);
            }
        }

        return response;
    };

    public readonly verifyUserName = async (authApp: string, userName: string): Promise<void> => {
        this.authApp = authApp;

        const nonce = this.hex(crypto.getRandomValues(new Uint8Array(10)));

        const challenge: IAuthChallenge = await (await this.doFetch({
            input: `${this.authPath}/login?app=${authApp}`,
            method: "POST",
            body: {
                user: userName,
                nonce,
            },
        })).json();

        // Convert the salt to and Uint8Array
        challenge.salt = new Uint8Array(challenge.salt);

        this.loginState = {
            clientFirst: `n=${userName},r=${nonce}`,
            clientFinal: `r=${challenge.nonce}`,
            serverFirst: this.buildServerFirst(challenge),
            challenge,
            loginError: undefined,
        };
    };

    public readonly verifyPassword = async (password: string): Promise<IMrsLoginResult> => {
        const { challenge, clientFirst, serverFirst, clientFinal } = this.loginState;

        if (password !== undefined && password !== "" && this.authApp !== undefined &&
            clientFirst !== undefined && serverFirst !== undefined && challenge !== undefined &&
            clientFinal !== undefined) {
            const te = new TextEncoder();
            const authMessage = `${clientFirst},${serverFirst},${clientFinal}`;
            const clientProof = Array.from(await this.calculateClientProof(
                password, challenge.salt, challenge.iterations, te.encode(authMessage)));

            try {
                const response = await this.doFetch({
                    input: `${this.authPath}/login?app=${this.authApp}&sessionType=bearer` +
                        (challenge.session !== undefined ? "&session=" + challenge.session : ""),
                    method: "POST",
                    body: {
                        clientProof,
                        nonce: challenge.nonce,
                        state: "response",
                    },
                }, undefined, undefined, undefined, false);

                if (!response.ok) {
                    return {
                        authApp: this.authApp,
                        errorCode: response.status,
                        errorMessage: (response.status === 401)
                            ? "The sign in failed. Please check your username and password."
                            : `The sign in failed. Error code: ${String(response.status)}`,
                    };
                } else {
                    const result = await response.json();

                    return {
                        authApp: this.authApp,
                        jwt: String(result.accessToken),
                    };
                }
            } catch (e) {
                return {
                    authApp: this.authApp,
                    errorCode: 2,
                    errorMessage: `The sign in failed. Server Error: ${String(e)}`,
                };
            }
        } else {
            return {
                authApp: this.authApp,
                errorCode: 1,
                errorMessage: `No password given.`,
            };
        }
    };

    private readonly hex = (arrayBuffer: Uint8Array): string => {
        return Array.from(new Uint8Array(arrayBuffer))
            .map((n) => { return n.toString(16).padStart(2, "0"); })
            .join("");
    };

    private readonly buildServerFirst = (challenge: IAuthChallenge): string => {
        const b64Salt = window.btoa(String.fromCharCode.apply(null, Array.from(challenge.salt)));

        return `r=${challenge.nonce},s=${b64Salt},i=${String(challenge.iterations)}`;
    };

    private readonly calculatePbkdf2 = async (password: BufferSource, salt: Uint8Array,
        iterations: number): Promise<Uint8Array> => {
        const ck1 = await crypto.subtle.importKey(
            "raw", password, { name: "PBKDF2" }, false, ["deriveKey", "deriveBits"]);
        const result = new Uint8Array(await crypto.subtle.deriveBits(
            { name: "PBKDF2", hash: "SHA-256", salt, iterations }, ck1, 256));

        return result;
    };

    private readonly calculateSha256 = async (data: BufferSource): Promise<Uint8Array> => {
        return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
    };

    private readonly calculateHmac = async (secret: BufferSource, data: BufferSource): Promise<Uint8Array> => {
        const key = await window.crypto.subtle.importKey(
            "raw", secret, { name: "HMAC", hash: { name: "SHA-256" } }, true, ["sign", "verify"]);
        const signature = await window.crypto.subtle.sign("HMAC", key, data);

        return new Uint8Array(signature);
    };

    private readonly calculateXor = (a1: Uint8Array, a2: Uint8Array): Uint8Array => {
        const l1 = a1.length;
        const l2 = a2.length;
        // cSpell:ignore amax
        let amax;
        let amin;
        let loop;

        if (l1 > l2) {
            amax = new Uint8Array(a1);
            amin = a2;
            loop = l2;
        } else {
            amax = new Uint8Array(a2);
            amin = a1;
            loop = l1;
        }

        for (let i = 0; i < loop; ++i) {
            amax[i] ^= amin[i];
        }

        return amax;
    };

    private readonly calculateClientProof = async (password: string, salt: Uint8Array, iterations: number,
        authMessage: Uint8Array): Promise<Uint8Array> => {
        const te = new TextEncoder();
        const saltedPassword = await this.calculatePbkdf2(te.encode(password), salt, iterations);
        const clientKey = await this.calculateHmac(saltedPassword, te.encode("Client Key"));
        const storedKey = await this.calculateSha256(clientKey);
        const clientSignature = await this.calculateHmac(storedKey, authMessage);
        const clientProof = this.calculateXor(clientSignature, clientKey);

        return clientProof;
    };
}

export interface IMrsAuthApp {
    name: string;
    vendorId: string;
}

/**
 * Represents a MRS Service base class.
 *
 * MRS Service classes derive from this base class and add public MRS Schema objects that allow the user to work with
 * the MRS Service's MRS Schemas.
 *
 * Each services uses its own MrsBaseSession session to perform all fetch operations.
 */
export class MrsBaseService {
    public session: MrsBaseSession;

    public constructor(
        protected readonly serviceUrl: string,
        protected readonly authPath = "/authentication",
        protected readonly defaultTimeout = 8000) {
        this.session = new MrsBaseSession(serviceUrl, authPath, defaultTimeout);
    }

    public readonly getAuthApps = async (): Promise<IMrsAuthApp[] | undefined> => {
        const response = await this.session.doFetch({
            input: `${this.authPath}/authApps`,
            timeout: 3000,
            errorMsg: "Failed to fetch Authentication Apps.",
        });

        if (response.ok) {
            const result = await response.json();

            return result as IMrsAuthApp[];
        } else {
            let errorInfo = null;
            try {
                errorInfo = await response.json();
            } catch (e) {
                // Ignore the exception
            }
            const errorDesc = "Failed to fetch Authentication Apps.\n\n" +
                "Please ensure MySQL Router is running and the REST endpoint " +
                `${String(this.serviceUrl)}${this.authPath}/authApps is accessible. `;

            throw new Error(errorDesc + `(${response.status}:${response.statusText})` +
                `${(errorInfo !== undefined) ? ("\n\n" + JSON.stringify(errorInfo, null, 4) + "\n") : ""}`);
        }
    };
}

/**
 * Represents a MRS Schema base class.
 *
 * All MRS Schema classes derive from this class.
 */
export class MrsBaseSchema {
    public constructor(
        public service: MrsBaseService,
        public requestPath: string) {
    }
}

export interface IMrsLink {
    rel: string,
    href: string,
}

export interface IMrsBaseObject {
    links?: IMrsLink[];
}

export interface IMrsOperator {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "=": "$eq",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "!=": "$ne",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "<": "$lt",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "<=": "$lte",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ">": "$gt",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ">=": "$gte",
    "like": "$like",
    "null": "$null",
    "notNull": "$notnull",
    "between": "$between",
}

export interface IMrsMetadata {
    etag: string;
}

export interface IMrsResultList<C> {
    items: C[],
    limit: number,
    offset?: number,
    hasMore: boolean,
    count: number,
    links?: IMrsLink[],
    _metadata?: IMrsMetadata,
}

export interface IMrsProcedureResult<C> {
    mrsInterface: string,
    items: C[],
}

export interface IMrsProcedureResultList<C> {
    results: Array<IMrsProcedureResult<C>>,
}

export interface IMrsDeleteResult {
    itemsDeleted: number
}

export type DataFilter<Type> = DelegationFilter<Type> | HighOrderFilter<Type>;

export type DelegationFilter<Type> = {
    [Key in keyof Type]?: DataFilterField<Type, Type[Key]> | Type[Key] | Array<ComparisonOpExpr<Type[Key]>>
};

export type PureFilter<Type> = {
    [Key in keyof Type]: ComparisonOpExpr<Type[Key]> | Type[Key]
};

export type HighOrderFilter<Type> = {
    [Key in BinaryOperator]?: Array<PureFilter<Type>>
};

export type ComparisonOpExpr<Type> = {
    [Operator in keyof ISimpleOperatorProperty]?: Type & ISimpleOperatorProperty[Operator]
} & {
    [Operator in "$notnull" | "$null"]?: null
} & {
    [Operator in "$between"]?: [Type & BetweenRegular | null, Type & BetweenRegular | null]
};

export type BetweenRegular = string | number | Date;

// cspell: ignore ninstr
export interface ISimpleOperatorProperty {
    "$eq": string | number | Date
    "$gt": number | Date
    "$instr": string
    "$gte": number | Date
    "$lt": number | Date
    "$lte": number | Date
    "$like": string
    "$ne": string | number | Date
    "$ninstr": string
}

export type BinaryOpExpr<ParentType, Type> = {
    [Operator in BinaryOperator]?: Array<BinaryOperatorParam<ParentType, Type>>
};

export type DataFilterField<ParentType, Type> = ComparisonOpExpr<Type> | BinaryOpExpr<ParentType, Type>;

export type BinaryOperatorParam<ParentType, Type> = ComparisonOpExpr<Type> | DelegationFilter<ParentType>;

export type BinaryOperator = "$and" | "$or";

export type ColumnOrder<Type> = {
    [Key in keyof Type]?: "ASC" | "DESC" | 1 | -1
};

// Prisma-like API type definitions.

export interface ICreateOptions<T> {
    data: T
}

export interface IFilterOptions<T> {
    where: DataFilter<T>
}

export interface IFindAllOptions<C> {
    pageSize?: number,
    progress?: (items: IMrsResultList<C>) => Promise<void>
}

export interface IFindOptions<C, T> extends Partial<IFilterOptions<T>> {
    orderBy?: ColumnOrder<T>,
    select?: ResultFields<C> | ColumnNames<C>,
    skip?: number,
    take?: number,
    fetchAll?: IFindAllOptions<C> | boolean,
}

export type ResultFields<T> = {
    [Key in keyof T]?: boolean
};

export type ColumnNames<T> = Array<keyof T>;

export type IDeleteOptions<T> = IFilterOptions<T>;

export interface IUpdateConfig {
    batch: true
}

export interface IUpdateOptions<T, Keys extends Array<string & keyof T>, Multi> extends ICreateOptions<T> {
    where: Multi extends IUpdateConfig ? Array<UpdateMatch<T, Keys>> : UpdateMatch<T, Keys>
}

export type UpdateMatch<T, Keys extends Array<string & keyof T>> = {
    [K in keyof Pick<T, Keys[number]>]-?: T[K]
};

export class MrsBaseObjectQuery<C, P> {
    // This needs to be extended in order to hold AND, OR, etc. based on the actual grammar
    protected whereCondition?: string;
    protected offsetCondition?: number;
    protected limitCondition?: number;
    protected pageSizeCondition = 25;

    public constructor(
        private readonly schema: MrsBaseSchema,
        private readonly requestPath: string,
        private readonly fieldsToGet?: string[] | ResultFields<C> | ColumnNames<C>,
        private readonly fieldsToOmit?: string[]) {
    }

    // where() proposal
    public where = (filter?: DataFilter<C>): this => {
        if (typeof filter === "undefined") {
            return this;
        }

        this.whereCondition = JSON.stringify(filter);

        return this;
    };

    public whereOld = <K extends keyof P>(param: K, op: keyof IMrsOperator, value?: string): this => {
        const ops: IMrsOperator = {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "=": "$eq",
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "!=": "$ne",
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "<": "$lt",
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "<=": "$lte",
            // eslint-disable-next-line @typescript-eslint/naming-convention
            ">": "$gt",
            // eslint-disable-next-line @typescript-eslint/naming-convention
            ">=": "$gte",
            "like": "$like",
            "null": "$null",
            // cSpell:ignore notnull
            "notNull": "$notnull",
            "between": "$between",
        };
        // Example: GET http://localhost:8080/mrs/sakila/actor/?q={"last_name":{"$like":"WAW%"}}
        value = (value === undefined || value === null) ? "null" : `"${value}"`;

        this.whereCondition = `{"${String(param)}":{"${ops[op]}":${value}}}`;

        return this;
    };

    // overrides top-level $or
    public or = (filter?: DataFilter<C>): this => {
        if (typeof filter === "undefined") {
            return this;
        }

        const currentFilter = JSON.parse(this.whereCondition ?? "");
        const topLevelOr: object[] = currentFilter.$or ?? [];

        if (topLevelOr.length === 0) {
            this.whereCondition = JSON.stringify({ $or: [currentFilter, filter] });
        } else {
            topLevelOr.push(filter);
            this.whereCondition = JSON.stringify({ ...currentFilter, $or: topLevelOr });
        }

        return this;
    };

    // orderBy proposal
    public orderBy = (columnOrder?: ColumnOrder<C>): this => {
        if (typeof columnOrder === "undefined") {
            return this;
        }

        // we should only stringify "whereCondition" when the request is sent
        this.whereCondition = JSON.stringify({ $orderby: columnOrder, ...JSON.parse(this.whereCondition ?? "") });

        return this;
    };

    public offset = (offset?: number): this => {
        if (typeof offset === "undefined") {
            return this;
        }

        this.offsetCondition = offset;

        return this;
    };

    public limit = (limit?: number): this => {
        if (typeof limit === "undefined") {
            return this;
        }

        this.limitCondition = limit;

        return this;
    };

    public pageSize = (pageSize: number): this => {
        this.pageSizeCondition = pageSize;

        return this;
    };

    public fetch = async (): Promise<IMrsResultList<C>> => {
        let inputStr = `${this.schema.requestPath}${this.requestPath}?`;

        const fields = this.fieldsToGet ?? {};

        const fieldsToGet = Array.isArray(fields)
            ? fields
            : Object.keys(fields as ResultFields<C>)
                .filter((column) => {
                    return fields[column as keyof typeof fields] === true;
                })
                .map((column) => {
                    return column as keyof C;
                });

        const fieldsToOmit = Array.isArray(fields)
            ? this.fieldsToOmit
            : Object.keys(fields as ResultFields<C>)
                .filter((column) => {
                    return fields[column as keyof typeof fields] === false;
                })
                .map((column) => {
                    return column as keyof C;
                });

        if (fieldsToOmit !== undefined && fieldsToOmit.length > 0) {
            inputStr += `f=!${fieldsToOmit.join(",")}&`;
        } else if (fieldsToGet !== undefined && fieldsToGet.length > 0) {
            inputStr += `f=${fieldsToGet.join(",")}&`;
        }
        if (this.whereCondition !== undefined) {
            inputStr += `q=${this.whereCondition}&`;
        }
        if (this.offsetCondition !== undefined) {
            inputStr += `offset=${this.offsetCondition}&`;
        }
        if (this.limitCondition !== undefined) {
            inputStr += `limit=${this.limitCondition}&`;
        }

        const res = await this.schema.service.session.doFetch({
            /*input: `/mrsNotes/notesAll?f=!content&offset=${offset}&limit=10${q}`,*/
            input: inputStr.slice(0, -1),
            errorMsg: "Failed to fetch items.",
        });

        const responseBody = await res.json();

        return responseBody as IMrsResultList<C>;
    };

    /**
     * Fetches all items that match an optional where condition.
     *
     * Items are fetched in pages with the size of pageSize or with the size parameter specified with a call to the
     * this.pageSize() function. An optional progress callback can be specified that is called with the data of each
     * page.
     *
     * @param pageSize The optional number of items that should be fetched for each page. Default is 25 items per page.
     * @param progress An optional callback function that is called for each page that is fetched.
     * @returns A list of typed IMrsBaseObjects
     */
    public fetchAll = async (
        pageSize?: number,
        progress?: (items: IMrsResultList<C>) => Promise<void>): Promise<IMrsResultList<C>> => {
        const resultList: IMrsResultList<C> = {
            items: [],
            limit: this.pageSizeCondition,
            offset: 0,
            hasMore: true,
            count: 0,
        };
        this.pageSizeCondition = pageSize ?? this.pageSizeCondition;

        // Initialize offsetCondition and limitCondition
        this.offsetCondition = 0;
        this.limitCondition = this.pageSizeCondition;

        // Fetch pages of the size of this.pageSizeCondition until all items have been fetched
        while (resultList.hasMore) {
            const res = await this.fetch();

            // Add items to the newNotes list
            resultList.items.push(...res.items);

            // Update count and limit
            resultList.count += res.items.length;
            resultList.limit += this.pageSizeCondition;

            // Check if there is more to fetch
            resultList.hasMore = res.hasMore;

            if (progress !== undefined) {
                await progress(res);
            }

            this.offsetCondition += this.pageSizeCondition;
        }

        return resultList;
    };

    public fetchOne = async (): Promise<C | undefined> => {
        const resultList = await this.fetch();

        if (resultList.items.length >= 1) {
            return resultList.items[0];
        } else {
            return undefined;
        }
    };
}

export class MrsBaseObjectCreate<T> {
    public constructor(
        protected schema: MrsBaseSchema,
        protected requestPath: string,
        protected item: T) {
    }

    public fetch = async (): Promise<T> => {
        const input = `${this.schema.requestPath}${this.requestPath}`;
        const body = this.item as IMrsFetchData;

        const res = await this.schema.service.session.doFetch({
            input,
            method: "POST",
            body,
            errorMsg: "Failed to create item.",
        });

        const responseBody = await res.json();

        return responseBody as T;
    };
}

export class MrsBaseObjectDelete<T> {
    protected whereCondition?: string;

    public constructor(
        protected schema: MrsBaseSchema,
        protected requestPath: string) {
    }

    public where = (filter: DataFilter<T>): this => {
        this.whereCondition = JSON.stringify(filter);

        return this;
    };

    public fetch = async (): Promise<IMrsDeleteResult> => {
        let inputStr = `${this.schema.requestPath}${this.requestPath}`;

        if (this.whereCondition !== undefined) {
            inputStr += `?q=${this.whereCondition}&`;
        }

        const res = await this.schema.service.session.doFetch({
            input: inputStr.slice(0, -1),
            method: "DELETE",
            errorMsg: "Failed to delete items.",
        });

        const responseBody = await res.json();

        return responseBody as IMrsDeleteResult;
    };
}

export class MrsBaseObjectUpdate<T extends object | undefined> {
    public constructor(
        protected schema: MrsBaseSchema,
        protected requestPath: string,
        protected fieldsToSet: T,
        protected keys: string[]) {
    }

    public whereKey = (key: string | number): this => {
        this.keys = [String(key)];

        return this;
    };

    public whereKeys = (keys: string[] | number[]): this => {
        this.keys = keys.map((k) => {
            return String(k);
        });

        return this;
    };

    public fetch = async (): Promise<IMrsResultList<T>> => {
        const input = `${this.schema.requestPath}${this.requestPath}/${this.keys.join(",")}`;

        const res = await this.schema.service.session.doFetch({
            input,
            method: "PUT",
            body: this.fieldsToSet,
            errorMsg: "Failed to update item.",
        });

        const responseBody = await res.json();

        return responseBody as IMrsResultList<T>;
    };
}

export class MrsBaseObjectCall<I, P extends IMrsFetchData> {
    public constructor(
        protected schema: MrsBaseSchema,
        protected requestPath: string,
        protected params: P) {
    }

    public fetch = async (): Promise<IMrsProcedureResultList<I>> => {
        const input = `${this.schema.requestPath}${this.requestPath}`;

        const res = await this.schema.service.session.doFetch({
            input,
            method: "PUT",
            body: this.params,
            errorMsg: "Failed to call item.",
        });

        const responseBody = await res.json();

        return responseBody as IMrsProcedureResultList<I>;
    };
}
