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

/**
 * A class to handle base64 encoding and decoding.
 */
export class Base64Convert {
    static #chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    static #lookup: Uint8Array;

    static {
        // Use a lookup table to find the index.
        Base64Convert.#lookup = new Uint8Array(256);
        for (let i = 0; i < Base64Convert.#chars.length; i++) {
            Base64Convert.#lookup[Base64Convert.#chars.charCodeAt(i)] = i;
        }
    }

    /**
     * Converts binary data in an array buffer to a base64 string.
     *
     * @param arraybuffer The input data.
     *
     * @returns The base64 string.
     */
    public static encode(arraybuffer: ArrayBuffer): string {
        const bytes = new Uint8Array(arraybuffer);
        let i;
        const len = bytes.length;
        let base64 = "";

        for (i = 0; i < len; i += 3) {
            base64 += Base64Convert.#chars[bytes[i] >> 2];
            base64 += Base64Convert.#chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
            base64 += Base64Convert.#chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
            base64 += Base64Convert.#chars[bytes[i + 2] & 63];
        }

        if (len % 3 === 2) {
            base64 = base64.substring(0, base64.length - 1) + "=";
        } else if (len % 3 === 1) {
            base64 = base64.substring(0, base64.length - 2) + "==";
        }

        return base64;
    }

    /**
     * Converts a base64 string to binary data in an array buffer.
     *
     * @param base64 The input string.
     *
     * @returns The array buffer.
     */
    public static decode(base64?: string | null): ArrayBuffer {
        if (!base64) {
            return new ArrayBuffer(0);
        }

        let bufferLength = Math.round(base64.length * 0.75);
        const len = base64.length;
        let i;
        let p = 0;

        if (base64[base64.length - 1] === "=") {
            bufferLength--;
            if (base64[base64.length - 2] === "=") {
                bufferLength--;
            }
        }

        const buffer = new ArrayBuffer(bufferLength);
        const bytes = new Uint8Array(buffer);

        for (i = 0; i < len; i += 4) {
            const encoded1 = Base64Convert.#lookup[base64.charCodeAt(i)];
            const encoded2 = Base64Convert.#lookup[base64.charCodeAt(i + 1)];
            const encoded3 = Base64Convert.#lookup[base64.charCodeAt(i + 2)];
            const encoded4 = Base64Convert.#lookup[base64.charCodeAt(i + 3)];

            bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
            bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
            bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
        }

        return buffer;
    }
}
