/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
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

/// <reference types="./../mrs.d.ts" />

export enum MrsScriptFunctionType {
    BeforeCreate = "BeforeCreate",
    BeforeRead = "BeforeRead",
    BeforeUpdate = "BeforeUpdate",
    BeforeDelete = "BeforeDelete",
    AfterCreate = "AfterCreate",
    AfterRead = "AfterRead",
    AfterUpdate = "AfterUpdate",
    AfterDelete = "AfterDelete",
}

export type IMrsSchemaType = "DATABASE_SCHEMA" | "SCRIPT_MODULE";

export type IMrsScriptResponseFormat = "FEED" | "ITEM" | "MEDIA";

export type IMrsGrantPrivilegeType = "ALTER" | "ALTER ROUTINE" | "CREATE" | "CREATE ROUTINE"
    | "CREATE TEMPORARY TABLES" | "CREATE VIEW" | "DELETE" | "DROP" | "EVENT" | "EXECUTE" | "INDEX" | "INSERT"
    | "LOCK TABLES" | "REFERENCES" | "SELECT" | "SHOW DATABASES" | "SHOW VIEW" | "TRIGGER" | "UPDATE" | "USAGE";

export type IMrsGrantObjectType = "TABLE" | "FUNCTION" | "PROCEDURE";

export interface IMrsGrantPrivilege {
    privilege: IMrsGrantPrivilegeType;
    columnList?: string[];
}

export interface IMrsGrant {
    privileges?: IMrsGrantPrivilegeType | IMrsGrantPrivilegeType[] | IMrsGrantPrivilege[],
    objectType?: IMrsGrantObjectType,
    schema: string,
    object: string,
}

export interface IMrsSchemaProperties {
    className?: string;
    name?: string;
    comments?: string;
    requestPath?: string;
    enabled?: boolean;
    internal?: boolean;
    requiresAuth?: boolean;
    options?: IDictionary;
    metadata?: IDictionary;
    type?: IMrsSchemaType;
    outputFilePath?: string;
    grants?: IMrsGrant | IMrsGrant[];
}

export interface IMrsMethodProperties {
    className?: string;
    methodName?: string;
    name?: string;
    enabled?: boolean;
    rowOwnershipParameter?: string;
    options?: IDictionary;
    comments?: string;
    grants?: IMrsGrant | IMrsGrant[];
}

export interface IMrsScriptProperties extends IMrsMethodProperties {
    requestPath?: string;
    requiresAuth?: boolean;
    internal?: boolean;
    format?: IMrsScriptResponseFormat;
    mediaType?: string;
    metadata?: IDictionary;
}

export interface IMrsTriggerProperties extends IMrsMethodProperties {
    dbObjectName: string;
    triggerType: MrsScriptFunctionType;
    priority?: number;
}

type Constructor<T = {}> = new (...args: any[]) => T;

export class Mrs {
    public static schema(properties?: IMrsSchemaProperties) {
        return function registerSchema<Class extends Constructor>(
            Value: Class,
            context: ClassDecoratorContext<Class>
        ) {
            const className = String(context.name);

            // Set property defaults
            if (!properties) { properties = {}; }
            properties = {
                ...properties,
                className,
                name: properties.name ?? className,
                enabled: properties.enabled ?? true,
                internal: properties.internal ?? false,
                requiresAuth: properties.requiresAuth ?? false,
                type: properties.type ?? "DATABASE_SCHEMA",
            }

            // print(`### MRS Schema Class ${context.name}`);
            // print(`  Properties: ${JSON.stringify(properties, undefined, 4)}`);

            if ("mrsScripts" in context.metadata) {
                const mrsScripts = context.metadata["mrsScripts"] as IMrsScriptProperties[];
                mrsScripts.forEach((script) => {
                    script.className = className;
                });

                // print(`    ### mrsScripts: ${JSON.stringify(mrsScripts, undefined, 4)}`);
            }
            if ("mrsTriggers" in context.metadata) {
                const mrsTriggers = context.metadata["mrsTriggers"] as IMrsTriggerProperties[];
                mrsTriggers.forEach((trigger) => {
                    trigger.className = className;
                });

                // print(`    ### All mrsTriggers: ${JSON.stringify(mrsTriggers, undefined, 4)}`);
            }
            // print("################################")

            return class extends Value {
                constructor(...args: any[]) {
                    super(...args);
                }
            };
        };
    };

    public static module(properties?: IMrsSchemaProperties) {
        // Set property defaults
        if (!properties) { properties = {}; }
        properties = {
            ...properties,
            type: properties.type ?? "SCRIPT_MODULE",
        }

        return Mrs.schema(properties);
    }

    public static script(properties?: IMrsScriptProperties) {
        return function registerScript<This, Args extends any[], Return>(
            target: (this: This, ...args: Args) => Return,
            context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>
        ) {
            const methodName = String(context.name);
            if (!context.static || context.kind !== "method") {
                throw Error(`${methodName} is not defined as a static class method. ` +
                    "Only static class methods may be decorated with Mrs.script.");
            }

            // Set property defaults
            if (!properties) { properties = {}; }
            properties = {
                ...properties,
                methodName,
                name: properties.name ?? methodName,
                enabled: properties.enabled ?? true,
                internal: properties.internal ?? true,
                requestPath: properties.requestPath ?? `/${methodName}`,
                requiresAuth: properties.requiresAuth ?? true,
            }

            const metadata: any = context.metadata;
            if (!metadata["mrsScripts"]) metadata["mrsScripts"] = [];
            metadata["mrsScripts"].push(properties);

            /*function replacementMethod(this: This, ...args: Args): Return {
                print(`LOG: Entering method '${methodName}'.`)
                const result = target.call(this, ...args);
                print(`LOG: Exiting method '${methodName}'.`)
                return result;
            }

            return replacementMethod;*/
            return target;
        }
    }

    public static trigger(properties: IMrsTriggerProperties) {
        return function registerTrigger<This, Args extends any[], Return>(
            target: (this: This, ...args: Args) => Return,
            context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>
        ) {
            const methodName = String(context.name);
            if (!context.static || context.kind !== "method") {
                throw Error(`${methodName} is not defined as a static class method. ` +
                    "Only static class methods may be decorated with Mrs.trigger.");
            }

            // Set property defaults
            properties = {
                ...properties,
                methodName,
                name: properties.name ?? methodName,
                enabled: properties.enabled ?? true,
            }

            const metadata: any = context.metadata;
            if (!metadata["mrsTriggers"]) metadata["mrsTriggers"] = [];
            metadata["mrsTriggers"].push(properties);

            /*function replacementMethod(this: This, ...args: Args): Return {
                print(`LOG: Entering method '${methodName}'.`)
                const result = target.call(this, ...args);
                print(`LOG: Exiting method '${methodName}'.`)
                return result;
            }

            return replacementMethod;*/
            return target;
        }
    }
}
