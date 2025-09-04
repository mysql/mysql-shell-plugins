/*
 * Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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

import "fake-indexeddb/auto";
import { vi } from "vitest";
import "vitest-canvas-mock";

import "./loadTestConfiguration.js";

import { ignoreSnapshotFieldContent } from "./unit-tests/test-helpers.js";

ignoreSnapshotFieldContent([
    /^[a-f0-9-]{36}$/, // UUIDs
    /^translate/, // translate values
    /^[0-9]{2}(.[0-9]{2}| (AM|PM))$/, // time values
]);

vi.setSystemTime(new Date("2100-10-12T09:09:09Z"));

Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: unknown) => {
        return {
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        };
    }),
});

/*
Object.defineProperty(window, "location", {
    get: () => {
        return {
            host: "localhost",
            protocol: "http:",
            search: "", // "?token=123", TODO: simulate various app parameters.
        };
    },
});
*/
Object.defineProperty(window.webkitURL, "createObjectURL", {
    writable: true,
    value: vi.fn().mockImplementation((query: unknown) => {
        return {
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        };
    }),
});

Object.defineProperty(window.webkitURL, "revokeObjectURL", {
    writable: true,
    value: vi.fn().mockImplementation((query: unknown) => {
        return {
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        };
    }),
});

Object.defineProperty(global.self, "DOMPoint", {
    writable: true,
    enumerable: true,
    value: vi.fn().mockImplementation((x?: number, y?: number, z?: number, w?: number) => {
        return {
            x: x ?? 0,
            y: y ?? 0,
            z: z ?? 0,
            w: w ?? 0,
            matrixTransform: vi.fn(),
            toJSON: vi.fn(),
        };
    }),
});

Object.defineProperty(global.self, "DOMRect", {
    writable: true,
    enumerable: true,
    value: vi.fn().mockImplementation((x?: number, y?: number, width?: number, height?: number) => {
        return {
            x: x ?? 0,
            y: y ?? 0,
            width: width ?? 0,
            height: height ?? 0,
            top: y ?? 0,
            right: (x ?? 0) + (width ?? 0),
            bottom: (y ?? 0) + (height ?? 0),
            left: x ?? 0,
        };
    }),
});

Object.defineProperty(HTMLElement.prototype, "innerText", {
    get() {
        return (this as HTMLElement).textContent ?? "";
    },

    set(value: string) {
        (this as HTMLElement).textContent = value;
    },
});
