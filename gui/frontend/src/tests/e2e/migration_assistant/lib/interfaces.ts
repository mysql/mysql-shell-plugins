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
 * separately licensed software that they have included with
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

import { Locator } from "@playwright/test";
import * as types from "./types.js";

export interface ISourceInfo {
    connectionName: string | undefined;
    server: string | undefined;
    schemas: number | undefined;
    uri: string | undefined;
    replicationInfo: string | undefined;
    size: string | undefined;
}

export interface ITile {
    name?: string | null;
    active?: boolean | undefined;
    subSteps?: ITileSubStep[] | undefined;
}

export interface ITileSubStep {
    name: string | undefined | null;
    status: types.TileStepStatus;
}

export interface ICompatibilityIssue {
    name: string | undefined | null;
    type: types.CompatibilityIssue;
    details: {
        description: string | undefined | null;
        defaultResolution: string | undefined | null;
    }
}

export interface IStep {
    caption: string | null;
    isExpanded: boolean;
    toggle?: Locator;
    status?: types.StepStatus | undefined;
    description?: string | null;
}

export interface IDatabaseReady {
    isExpanded: boolean;
    toggle?: Locator;
    status?: types.StepStatus | undefined;
    explanation: {
        title: string | null;
        details: string;
    },
    dbSystem: {
        ip: string | null;
        copyButton: Locator;
    },
    jumpHost: {
        command: string | null;
        copyButton: Locator;
    },
    mysqlShell: {
        command: string | null;
        copyButton: Locator
    }
}

export interface INotification {
    type: string | undefined;
    message: string | undefined | null;
    close: Locator | undefined;
}

export const isIStep = (obj: unknown): obj is IStep => {
    return "caption" in (obj as object);
};

export const isIDatabaseReady = (obj: unknown): obj is IDatabaseReady => {
    return "explanation" in (obj as object);
};

export interface IMock {
    name: string;
    data: Record<string, string>;
}