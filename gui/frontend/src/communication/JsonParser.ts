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

import type { IDictionary } from "../app-logic/general-types.js";

/** The type of a token returned from the JSON scanner. */
const enum TokenType {
    // Keywords
    Null,
    True,
    False,

    // Punctuation
    OpenBrace,
    CloseBrace,
    OpenBracket,
    CloseBracket,
    Comma,
    Colon,

    // Literals
    String,
    Number,

    Whitespace,

    // Other
    Unknown,
    EOF,
}

/**
 * A JSON string parser with support for bigint.
 * It only provides the minimal functionality needed for handling responses from the MySQL Shell.
 */
export class JsonParser {
    public tokenText: string = "";

    static readonly #singleTokenMap = new Map<string, TokenType>([
        ["{", TokenType.OpenBrace],
        ["}", TokenType.CloseBrace],
        ["[", TokenType.OpenBracket],
        ["]", TokenType.CloseBracket],
        [",", TokenType.Comma],
        [":", TokenType.Colon],
    ]);

    static readonly #keywordMap = new Map<string, TokenType>([
        ["null", TokenType.Null],
        ["true", TokenType.True],
        ["false", TokenType.False],
    ]);

    static readonly #knownContentCharacters = new Set<number>([
        0x20, // space
        0x09, // tab
        0x0A, // \n
        0x0D, // \r
        0x7B, // {
        0x7D, // }
        0x5B, // [
        0x5D, // ]
        0x22, // "
        0x3A, // :
        0x2C, // ,
        0x2F, // /
    ]);

    /** All token types that represent values. */
    static readonly #valueSet = new Set<TokenType>([
        TokenType.Null,
        TokenType.True,
        TokenType.False,
        TokenType.String,
        TokenType.Number,
    ]);

    #currentPosition = 0;
    #tokenOffset = 0;
    #input: string;

    public constructor(text: string) {
        this.#input = text;
    }

    /**
     * Takes a JSON string and converts it to a JavaScript object. It also converts numbers that are bigger than
     * Number.MAX_SAFE_INTEGER to BigInt.
     * TypeScript does not support bigint in JSON.parse yet, so we have to do it manually.
     *
     * @param json The JSON string to parse.
     *
     * @returns The parsed JavaScript object.
     */
    public static parseJson(json: string): unknown {
        const parser = new JsonParser(json);


        const token = parser.nextNonWhitespaceToken();
        const result = parser.parseJsonValue(token);
        if (parser.nextNonWhitespaceToken() !== TokenType.EOF) {
            throw new Error("Extraneous content.");
        }

        return result;
    }

    /** @returns the type of the next token in the input and extracts its text into the tokenText member. */
    private nextToken(): TokenType {
        this.tokenText = "";
        this.#tokenOffset = this.#currentPosition;

        if (this.#currentPosition >= this.#input.length) {
            this.#tokenOffset = this.#input.length;

            return TokenType.EOF;
        }

        let code = this.#input.codePointAt(this.#currentPosition)!;
        if (this.isWhiteSpace(code)) {
            do {
                ++this.#currentPosition;
                this.tokenText += String.fromCharCode(code);
                code = this.#input.codePointAt(this.#currentPosition)!;
            } while (this.isWhiteSpace(code));

            return TokenType.Whitespace;
        }

        if (this.isLineBreak(code)) {
            ++this.#currentPosition;
            this.tokenText += String.fromCharCode(code);
            if (code === 0x0D && this.#input.codePointAt(this.#currentPosition) === 0x0A) {
                ++this.#currentPosition;
                this.tokenText += "\n";
            }

            return TokenType.Whitespace;
        }

        const token = JsonParser.#singleTokenMap.get(String.fromCharCode(code));
        if (token !== undefined) {
            ++this.#currentPosition;

            return token;
        }

        switch (code) {
            case 0x22: { // "
                ++this.#currentPosition;
                this.tokenText = this.scanString(code);

                return TokenType.String;
            }

            // Possible numbers.
            case 0x2D: { // -
                this.tokenText += "-";
                ++this.#currentPosition;
                code = this.#input.codePointAt(this.#currentPosition)!;

                if (this.#currentPosition === this.#input.length || !this.isDigit(code)) {
                    return TokenType.Unknown;
                }

                code = this.#input.codePointAt(this.#currentPosition)!;

                // [fall-through]
            }

            default: {
                if (this.isDigit(code)) {
                    this.tokenText += this.scanNumber();

                    return TokenType.Number;
                }

                while (this.#currentPosition < this.#input.length && !JsonParser.#knownContentCharacters.has(code)) {
                    ++this.#currentPosition;
                    code = this.#input.codePointAt(this.#currentPosition)!;
                }

                if (this.#tokenOffset !== this.#currentPosition) {
                    this.tokenText = this.#input.substring(this.#tokenOffset, this.#currentPosition);
                    const token = JsonParser.#keywordMap.get(this.tokenText);
                    if (token !== undefined) {
                        return token;
                    }

                    return TokenType.Unknown;
                }

                this.tokenText += String.fromCharCode(code);
                ++this.#currentPosition;

                return TokenType.Unknown;
            }
        }
    }

    /** @returns the next token which is not a whitespace (space, tab, line breaks). */
    private nextNonWhitespaceToken(): TokenType {
        let token: TokenType;
        do {
            token = this.nextToken();
        } while (token === TokenType.Whitespace);

        return token;
    }

    /**
     * Helper method for collecting a number of hex digits.
     *
     * @param count Specify the number of digits to collect.
     *
     * @returns The value of the collected digits or -1 if the number of digits is less than count.
     */
    private scanHexDigits(count: number): number {
        let digits = 0;
        let value = 0;
        while (digits < count) {
            const ch = this.#input.codePointAt(this.#currentPosition)!;
            if (ch >= 0x30 && ch <= 0x39) { // 0 - 9
                value = value * 16 + ch - 0x30;
            } else if (ch >= 0x41 && ch <= 0x46) { // A - F
                value = value * 16 + ch - 0x41 + 10;
            } else if (ch >= 0x61 && ch <= 0x66) { // a - f
                value = value * 16 + ch - 0x61 + 10;
            } else {
                break;
            }

            ++this.#currentPosition;
            ++digits;
        }

        return digits < count ? -1 : value;
    }

    /**
     * Helper method for collecting a number string.
     *
     * @returns the number as a string.
     */
    private scanNumber(): string {
        const start = this.#currentPosition;
        if (this.#input.codePointAt(this.#currentPosition) === 0x30) {
            ++this.#currentPosition;
        } else {
            ++this.#currentPosition;
            while (this.#currentPosition < this.#input.length
                && this.isDigit(this.#input.codePointAt(this.#currentPosition)!)) {
                ++this.#currentPosition;
            }
        }

        if (this.#currentPosition < this.#input.length
            && this.#input.codePointAt(this.#currentPosition) === 0x2E) { // .
            ++this.#currentPosition;
            if (this.#currentPosition < this.#input.length
                && this.isDigit(this.#input.codePointAt(this.#currentPosition)!)) {
                ++this.#currentPosition;
                while (this.#currentPosition < this.#input.length
                    && this.isDigit(this.#input.codePointAt(this.#currentPosition)!)) {
                    ++this.#currentPosition;
                }
            } else {
                throw new Error("Invalid number."); // Missing digits after the decimal point.
            }
        }

        let end = this.#currentPosition;
        if (this.#currentPosition < this.#input.length && (this.#input.codePointAt(this.#currentPosition) === 0x45
            || this.#input.codePointAt(this.#currentPosition) === 0x65)) { // eE
            ++this.#currentPosition;
            if (this.#currentPosition < this.#input.length && (this.#input.codePointAt(this.#currentPosition) === 0x2B
                || this.#input.codePointAt(this.#currentPosition) === 0x2D)) { // +-
                ++this.#currentPosition;
            }

            if (this.#currentPosition < this.#input.length
                && this.isDigit(this.#input.codePointAt(this.#currentPosition)!)) {
                ++this.#currentPosition;
                while (this.#currentPosition < this.#input.length
                    && this.isDigit(this.#input.codePointAt(this.#currentPosition)!)) {
                    ++this.#currentPosition;
                }
                end = this.#currentPosition;
            } else {
                throw new Error("Invalid number.");
            }
        }

        return this.#input.substring(start, end);
    }

    /**
     * This is a helper method for collecting a string. The initial quote character is already consumed upon opening.
     *
     * @param quote The quote character that started the string.
     *
     * @returns the string.
     */
    private scanString(quote: number): string {
        let result = "";
        let start = this.#currentPosition;

        while (true) {
            if (this.#currentPosition >= this.#input.length) {
                result += this.#input.substring(start, this.#currentPosition);
                break;
            }

            const ch = this.#input.codePointAt(this.#currentPosition)!;
            if (ch === quote) {
                result += this.#input.substring(start, this.#currentPosition);
                ++this.#currentPosition;
                break;
            }

            if (ch === 0x5C) { // \
                result += this.#input.substring(start, this.#currentPosition);
                ++this.#currentPosition;
                if (this.#currentPosition >= this.#input.length) {
                    break;
                }

                const ch2 = this.#input.codePointAt(this.#currentPosition++)!;
                switch (ch2) {
                    case 0x22: { // "
                        result += '"';

                        break;
                    }

                    case 0x27: { // '
                        result += "'";

                        break;
                    }

                    case 0x5C: { // \
                        result += "\\";

                        break;
                    }

                    case 0x2F: { // /
                        result += "/";

                        break;
                    }

                    case 0x62: { // b
                        result += "\b";

                        break;
                    }

                    case 0x66: { // f
                        result += "\f";

                        break;
                    }

                    case 0x6E: { // n
                        result += "\n";

                        break;
                    }

                    case 0x72: { // r
                        result += "\r";

                        break;
                    }

                    case 0x74: {
                        result += "\t";

                        break;
                    }

                    case 0x75: { // u
                        const ch3 = this.scanHexDigits(4);
                        if (ch3 >= 0) {
                            // Note: there's no need to check for surrogate pairs. TS will handle it.
                            if (ch3 < 0x10000) {
                                result += String.fromCharCode(ch3);
                            } else {
                                result += String.fromCodePoint(ch3);
                            }
                        }

                        break;
                    }

                    default:
                }

                start = this.#currentPosition;
                continue;
            }

            if (ch >= 0 && ch <= 0x1f) {
                if (this.isLineBreak(ch)) {
                    result += this.#input.substring(start, this.#currentPosition);
                    start = this.#currentPosition;

                    break;
                }
            }
            ++this.#currentPosition;
        }

        return result;
    }

    private isWhiteSpace(ch: number): boolean {
        return ch === 0x20 || ch === 0x09 || ch === 0xA0 || ch === 0x0D;
    }

    private isLineBreak(ch: number): boolean {
        return ch === 0x0D || ch === 0x0A;
    }

    private isDigit(ch: number): boolean {
        return ch >= 0x30 && ch <= 0x39;
    }

    /**
     * Parses a single object from the JSON string. On enter the opening brace is already consumed.
     *
     * @returns The parsed object.
     */
    private parseJsonObject(): IDictionary {
        const result: IDictionary = {};

        let token = this.nextNonWhitespaceToken();
        while (token !== TokenType.CloseBrace) {
            if (token !== TokenType.String) {
                throw new Error("Expected a string key.");
            }

            const key = this.tokenText;
            token = this.nextNonWhitespaceToken();
            if (token !== TokenType.Colon) {
                throw new Error("Expected a colon.");
            }

            token = this.nextNonWhitespaceToken();
            if (token === TokenType.CloseBrace) {
                throw new Error("Missing value.");
            }

            result[key] = this.parseJsonValue(token);

            token = this.nextNonWhitespaceToken();
            if (token === TokenType.Comma) {
                token = this.nextNonWhitespaceToken();
                if (!JsonParser.#valueSet.has(token)) {
                    throw new Error("Missing next pair.");
                }
            } else if (token !== TokenType.CloseBrace) {
                throw new Error("Expected a comma or closing brace.");
            }
        }

        return result;
    }

    /**
     * Parses a single value from the JSON string.
     *
     * @param token The token that was already consumed.
     *
     * @returns The parsed value.
     */
    private parseJsonValue(token: TokenType): unknown {
        switch (token) {
            case TokenType.String: {
                return this.tokenText;
            }

            case TokenType.Number: {
                const text = this.tokenText;
                const number = Number(text);
                if (isNaN(number)) {
                    throw new Error("Invalid number.");
                }

                if (Number.isInteger(number) && !Number.isSafeInteger(number)) {
                    // BigInt cannot be created from a string with a scientific notation.
                    if (text.includes("e") || text.includes("E")) {
                        return number;
                    }

                    return BigInt(text);
                }

                return number;
            }

            case TokenType.OpenBrace: {
                return this.parseJsonObject();
            }

            case TokenType.OpenBracket: {
                return this.parseJsonArray();
            }

            case TokenType.True: {
                return true;
            }

            case TokenType.False: {
                return false;
            }

            case TokenType.Null: {
                return null;
            }

            default: {
                throw new Error("Unexpected token.");
            }
        }
    }

    /**
     * Parses a single array from the JSON string. On enter the opening bracket is already consumed.
     *
     * @returns The parsed array.
     */
    private parseJsonArray(): unknown[] {
        const result: unknown[] = [];

        let token = this.nextNonWhitespaceToken();
        while (token !== TokenType.CloseBracket) {
            result.push(this.parseJsonValue(token));

            token = this.nextNonWhitespaceToken();
            if (token === TokenType.Comma) {
                token = this.nextNonWhitespaceToken();
                if (token === TokenType.CloseBracket) {
                    throw new Error("Unexpected closing bracket.");
                }
            } else if (token !== TokenType.CloseBracket) {
                throw new Error("Expected a comma or closing bracket.");
            }
        }

        return result;
    }

}
