/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

import type { ShellTask } from "../shell-tasks/ShellTask.js";

/**
 * This file contains all interfaces which comprise the data model for the shell tasks list.
 *
 * Each interface has a `type` member, which serves as a discriminator for the type of the entry.
 *
 * The prefix means: StDm = Shell Task Data Model
 */

/** The types of entries we can have in the model. */
export enum StDmEntityType {
    ShellTask,
}

export interface IStDmBaseEntry {
    type: StDmEntityType;
}

export interface IStDmShellTaskEntry extends IStDmBaseEntry {
    type: StDmEntityType.ShellTask;
    task: ShellTask;
}

export type StDmEntry = IStDmShellTaskEntry;

export class ShellTaskDataModel {
    /** A list of previously or currently running shell tasks. */
    public readonly entries: StDmEntry[] = [];
}
