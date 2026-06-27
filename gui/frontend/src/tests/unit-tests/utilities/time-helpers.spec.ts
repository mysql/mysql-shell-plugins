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

import { describe, expect, it } from "vitest";

import { calculateTimestampAge } from "../../../utilities/time-helpers.js";

describe("Time Helpers Tests", (): void => {
    const now = "2026-06-27T02:00:00+00:00";

    it("formats timestamp age", (): void => {
        expect(calculateTimestampAge("2026-06-27T01:59:30+00:00", now)).toBe("less than a minute");
        expect(calculateTimestampAge("2026-06-27T01:59:00+00:00", now)).toBe("1 minute");
        expect(calculateTimestampAge("2026-06-27T01:30:00+00:00", now)).toBe("30 minutes");
        expect(calculateTimestampAge("2026-06-27T01:00:00+00:00", now)).toBe("1 hour");
        expect(calculateTimestampAge("2026-06-26T00:00:00+00:00", now)).toBe("1 day");
        expect(calculateTimestampAge("2026-06-25T00:00:00+00:00", now)).toBe("2 days");
    });

    it("handles date and numeric timestamps", (): void => {
        expect(calculateTimestampAge(new Date("2026-06-27T00:00:00+00:00"), new Date(now))).toBe("2 hours");
        expect(calculateTimestampAge(Date.parse("2026-06-27T00:00:00+00:00"), Date.parse(now))).toBe("2 hours");
    });

    it("returns no age for invalid timestamps", (): void => {
        expect(calculateTimestampAge("invalid", now)).toBeUndefined();
        expect(calculateTimestampAge("2026-06-27T00:00:00+00:00", "invalid")).toBeUndefined();
    });
});
