/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have either included with
 * the program or referenced in the documentation.
 *
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import {
    IMigrationFilters, ISchemaObjects, ISchemaSelectionOptions, ISchemaTables,
    PlanDataItemType
} from "../../communication/ProtocolMigration.js";
import { ShellInterfaceMigration } from "../../supplement/ShellInterface/ShellInterfaceMigration.js";
import { extractFirstQuotedToken, parseQuotedObjectName, quoteObjectName } from "../../utilities/string-helpers.js";

export const AllObjectTypes: Array<keyof IMigrationFilters> = [
    "tables", "views", "triggers", "routines", "libraries", "events"];

// Note: currently only exclude lists are used/supported in the frontend
interface ISchemaMigrationFilter {
    included: boolean;
    // filter for objects in this schema only
    filter: IMigrationFilters;
    // cache of list of objects in this schema
    objectCache: Partial<Record<keyof IMigrationFilters, string[]>>;
}

export class MigrationFilterInfo {
    public migrateAllObjects = true;
    public migrateAllUsers = true;

    private schemas: Partial<Record<string, ISchemaMigrationFilter>> = {};
    private options?: ISchemaSelectionOptions;

    public constructor(private migration: ShellInterfaceMigration) {
    }

    public isObjectTypeIncluded(objectType: keyof IMigrationFilters): boolean | undefined {
        if (this.options) {
            switch (objectType) {
                case "tables":
                case "views":
                    // tables and views are always included, individual selection is not supported for them
                    return undefined;
                case "triggers":
                    return this.options.migrateTriggers;
                case "routines":
                    return this.options.migrateRoutines;
                case "libraries":
                    return this.options.migrateLibraries;
                case "events":
                    return this.options.migrateEvents;
                case "users":
                    return this.options.migrateUsers;
            }
        }

        return undefined;
    }

    public setObjectTypeIncluded(objectType: keyof IMigrationFilters, included: boolean) {
        if (this.options) {
            switch (objectType) {
                case "tables":
                case "views":
                    throw new Error("Cannot set inclusion for tables or views");
                case "triggers":
                    this.options.migrateTriggers = included;
                    break;
                case "routines":
                    this.options.migrateRoutines = included;
                    break;
                case "libraries":
                    this.options.migrateLibraries = included;
                    break;
                case "events":
                    this.options.migrateEvents = included;
                    break;
                case "users":
                    this.options.migrateUsers = included;
                    break;
            }
        }
    }

    public isSchemaIncluded(schema: string): boolean {
        return !(schema in this.schemas) || this.schemas[schema]!.included;
    }

    public setSchemaIncluded(schema: string, include: boolean) {
        this.ensureSchema(schema);

        this.schemas[schema]!.included = include;
    }

    public isAccountIncluded(user: string): boolean {
        return !(this.options?.filter?.users.exclude ?? []).includes(user);
    }

    public setAccountIncluded(account: string, include: boolean) {
        if (include) {
            const index = this.options?.filter?.users.exclude.indexOf(account);
            if (index !== undefined && index >= 0) {
                this.options?.filter?.users.exclude.splice(index, 1);
            }
        } else {
            if (!this.options?.filter?.users.exclude.includes(account)) {
                this.options?.filter?.users.exclude.push(account);
            }
        }
    }

    public isObjectExcluded(schema: string, objectType: keyof IMigrationFilters, quotedObject: string) {
        const filter = this.schemas[schema]?.filter[objectType];
        if (filter) {
            return filter.exclude.includes(quotedObject);
        }

        return false;
    }

    public setObjectExcluded(schema: string, objectType: keyof IMigrationFilters,
        quotedObject: string, exclude: boolean) {
        this.ensureSchema(schema);

        const filter = this.schemas[schema]!.filter[objectType];

        if (!exclude) {
            const i = filter.exclude.indexOf(quotedObject);
            if (i >= 0) {
                filter.exclude.splice(i, 1);
            }
        } else {
            if (!filter.exclude.includes(quotedObject)) {
                filter.exclude.push(quotedObject);
            }
        }
    }

    public setExcludeList(schema: string, objectType: keyof IMigrationFilters, quotedObjects: string[]) {
        this.ensureSchema(schema);

        const filter = this.schemas[schema]!.filter[objectType];
        filter.exclude = quotedObjects;
    }

    public getExcludedObjects(schema: string, objectType: keyof IMigrationFilters): string[] {
        const filter = this.schemas[schema]?.filter[objectType];
        if (filter) {
            return filter.exclude;
        }

        return [];
    }

    public getSchemaObjects(schema: string, objectType: keyof IMigrationFilters): string[] | undefined {
        if (!(schema in this.schemas)) {
            return undefined;
        }

        return this.schemas[schema]!.objectCache[objectType];
    }

    public async fetchSchemaObjects(schema: string, what: keyof IMigrationFilters)
        : Promise<string[] | undefined> {

        const cached = this.getSchemaObjects(schema, what);
        if (cached) {
            return cached;
        }

        let type;
        switch (what) {
            case "tables":
            case "views":
                type = PlanDataItemType.SCHEMA_TABLES;
                break;
            case "routines":
                type = PlanDataItemType.SCHEMA_ROUTINES;
                break;
            case "events":
                type = PlanDataItemType.SCHEMA_EVENTS;
                break;
            case "libraries":
                type = PlanDataItemType.SCHEMA_LIBRARIES;
                break;
            case "triggers":
                type = PlanDataItemType.SCHEMA_TRIGGERS;
                break;
            default:
                throw new Error("Invalid object type " + what);
        };

        const results = await this.migration.planGetDataItem(type, schema);

        const schemaInfo = this.ensureSchema(schema);

        if (what === "tables" || what === "views") {
            const tableInfo = results as ISchemaTables;

            schemaInfo.objectCache.tables = tableInfo.tables;
            schemaInfo.objectCache.views = tableInfo.views;

            if (what === "tables") {
                return tableInfo.tables;
            } else {
                return tableInfo.views;
            }
        } else {
            const objectInfo = results as ISchemaObjects;

            schemaInfo.objectCache[what] = objectInfo.objects;

            return objectInfo.objects;
        }

    }

    public setOptions(options: ISchemaSelectionOptions) {
        this.options = options;

        const oldSchemas = this.schemas;

        this.migrateAllObjects = true;
        this.migrateAllUsers = true;

        this.schemas = {};
        if (options.filter?.schemas) {
            const schemas = options.filter.schemas;

            schemas.exclude.map((schemaName) => {
                const name = parseQuotedObjectName(schemaName)?.schema;
                if (name) {
                    this.setSchemaIncluded(name, false);
                    this.migrateAllObjects = false;
                }
            });
        }

        AllObjectTypes.map((objectType) => {
            const objectFilters = options.filter?.[objectType];
            if (objectFilters) {
                objectFilters.exclude.map((fullName) => {
                    const parsed = extractFirstQuotedToken(fullName);

                    if (parsed) {
                        this.setObjectExcluded(parsed.token, objectType, parsed.remaining.slice(1).trim(), true);
                        this.migrateAllObjects = false;
                    }
                });
            }
        });

        if (options.filter?.users && options.filter.users.exclude.length > 0) {
            this.migrateAllUsers = false;
        }

        for (const schemaName in this.schemas) {
            if (oldSchemas[schemaName]?.objectCache) {
                this.schemas[schemaName]!.objectCache = oldSchemas[schemaName].objectCache;
            }
        }
    }

    public getOptions(): ISchemaSelectionOptions {
        if (!this.options) {
            throw new Error("options not set");
        }

        const objectFilters = this.makeFilter();

        if (!this.migrateAllObjects) {
            for (const schemaName in this.schemas) {
                const schema = this.schemas[schemaName];
                const quotedSchemaName = quoteObjectName(schemaName);

                if (schema?.included) {
                    AllObjectTypes.map((objectType) => {
                        const exclude = schema.filter[objectType].exclude.map((quotedName) => {
                            return quotedSchemaName + "." + quotedName;
                        });

                        if (exclude.length > 0) {
                            objectFilters[objectType].exclude.push(...exclude);
                        }
                    });
                } else {
                    objectFilters.schemas.exclude.push(quotedSchemaName);
                }
            }
        }

        if (!this.migrateAllUsers) {
            const excludedUsers = this.options.filter?.users.exclude ?? [];
            objectFilters.users.exclude.push(...excludedUsers);
        }

        const options = {
            ...this.options,
            filter: objectFilters,
        };

        return options;
    }

    private ensureSchema(schema: string): ISchemaMigrationFilter {
        if (!(schema in this.schemas)) {
            const tmp = { included: true, size: 0, filter: this.makeFilter(), objectCache: {} };
            this.schemas[schema] = tmp;

            return tmp;
        } else {
            return this.schemas[schema]!;
        }
    }

    private makeFilter = (): IMigrationFilters => {
        return {
            schemas: { include: [], exclude: [] },
            tables: { include: [], exclude: [] },
            views: { include: [], exclude: [] },
            routines: { include: [], exclude: [] },
            events: { include: [], exclude: [] },
            libraries: { include: [], exclude: [] },
            triggers: { include: [], exclude: [] },
            users: { include: [], exclude: [] }
        };
    };
}
