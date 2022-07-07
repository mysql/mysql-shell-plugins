/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

import Enzyme from "enzyme";
import Adapter from "enzyme-adapter-preact-pure";

import "fake-indexeddb/auto";
import "jest-canvas-mock";

jest.setTimeout(10000);

Enzyme.configure({ adapter: new Adapter() });
jest.setTimeout(10000);

Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query: unknown) => {
        return {
            matches: false,
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        };
    }),
});

Object.defineProperty(window, "location", {
    get: () => {
        return {
            host: "localhost",
            protocol: "http:",
            search: "", // "?token=123", TODO: simulate various app parameters.
        };
    },
});

Object.defineProperty(global.self, "DOMPoint", {
    writable: true,
    value: jest.fn().mockImplementation((x?: number, y?: number, z?: number, w?: number) => {
        return {
            x: x ?? 0,
            y: y ?? 0,
            z: z ?? 0,
            w: w ?? 0,
            matrixTransform: jest.fn(),
            toJSON: jest.fn(),
        } as DOMPoint;
    }),
});

Object.defineProperty(global.self, "DOMRect", {
    writable: true,
    value: jest.fn().mockImplementation((x?: number, y?: number, width?: number, height?: number) => {
        return {
            x: x ?? 0,
            y: y ?? 0,
            width: width ?? 0,
            height: height ?? 0,
            top: y ?? 0,
            right: (x ?? 0) + (width ?? 0),
            bottom: (y ?? 0) + (height ?? 0),
            left: x ?? 0,
        } as DOMRect;
    }),
});

let originalDir: string;

beforeAll(() => {
    // Keep the current dir to restore it on exit.
    originalDir = process.cwd();
    process.chdir("./src/tests/unit-tests");
});

afterAll(() => {
    process.chdir(originalDir);
});
