/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

// cspell: disable

import { loremIpsum } from "../test-helpers.js";

import { Base64Convert } from "../../../utilities/Base64Convert.js";

describe("Base64Convert", () => {
    const loremIpsumBase64 = "TG9yZW0gaXBzdW0gZG9sb3Igc2l0IGFtZXQsIGNvbnNlY3RldHVyIGFkaXBpc2NpIGVsaXQsIHNlZCBlaXVz" +
        "bW9kIHRlbXBvciBpbmNpZHVudCB1dCBsYWJvcmUgZXQgZG9sb3JlIG1hZ25hIGFsaXF1YS4=";

    it("Encode binary data to base64 string", () => {
        const arraybuffer = new Uint8Array([72, 101, 108, 108, 111]).buffer;
        const expectedBase64 = "SGVsbG8=";

        let result = Base64Convert.encode(arraybuffer);
        expect(result).toEqual(expectedBase64);

        const encoder = new TextEncoder();
        const array = encoder.encode(loremIpsum);

        result = Base64Convert.encode(array);
        expect(result).toEqual(loremIpsumBase64);

    });

    it("Decode base64 string to binary data", () => {
        const base64 = "SGVsbG8=";
        const expectedArraybuffer = new Uint8Array([72, 101, 108, 108, 111]).buffer;

        let result = Base64Convert.decode(base64);
        expect(result).toEqual(expectedArraybuffer);

        result = Base64Convert.decode(loremIpsumBase64);

        const decoder = new TextDecoder();
        const expectedString = decoder.decode(result);
        expect(expectedString).toEqual(loremIpsum);
    });
});
