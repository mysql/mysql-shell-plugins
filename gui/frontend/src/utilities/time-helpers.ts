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

export const calculateTimestampAge = (timestamp: string | number | Date, now: string | number | Date = Date.now()):
    string | undefined => {
    const timestampMs = typeof timestamp === "number"
        ? timestamp
        : timestamp instanceof Date ? timestamp.getTime() : Date.parse(timestamp);
    const nowMs = typeof now === "number" ? now : now instanceof Date ? now.getTime() : Date.parse(now);

    if (!Number.isFinite(timestampMs) || !Number.isFinite(nowMs)) {
        return undefined;
    }

    const ageSeconds = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));
    if (ageSeconds < 60) {
        return "less than a minute";
    }

    const ageMinutes = Math.floor(ageSeconds / 60);
    if (ageMinutes < 60) {
        return `${ageMinutes} minute${ageMinutes === 1 ? "" : "s"}`;
    }

    const ageHours = Math.floor(ageMinutes / 60);
    if (ageHours < 24) {
        return `${ageHours} hour${ageHours === 1 ? "" : "s"}`;
    }

    const ageDays = Math.floor(ageHours / 24);

    return `${ageDays} day${ageDays === 1 ? "" : "s"}`;
};
