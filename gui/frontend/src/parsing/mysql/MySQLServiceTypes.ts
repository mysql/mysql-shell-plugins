/*
 * Copyright (c) 2020, 2021, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as
 * published by the Free Software Foundation; version 2 of the
 * License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA
 * 02110-1301  USA
 */

// Determines the sub parts of a query that can be parsed individually.
export enum MySQLParseUnit {
    Generic,
    CreateSchema,
    CreateTable,
    CreateTrigger,
    CreateView,
    CreateFunction,
    CreateProcedure,
    CreateRoutine, // Compatibility enum for function/procedure/UDF, deprecated.
    CreateUdf,
    CreateEvent,
    CreateIndex,
    Grant,
    DataType,
    CreateLogfileGroup,
    CreateServer,
    CreateTablespace,
}
