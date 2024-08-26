/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

/* eslint-disable no-underscore-dangle */

import { CharStream, CommonToken, Lexer, Token } from "antlr4ng";

import { PythonLexer } from "./generated/PythonLexer.js";

export abstract class PythonLexerBase extends Lexer {
    public static tabSize = 8;

    // The amount of opened braces, brackets and parenthesis.
    private opened = 0;

    // The stack that keeps track of the indentation level.
    private indents: number[] = [];

    private buffer: Token[] = [];
    private lastToken?: Token;

    public constructor(input: CharStream) {
        super(input);
    }

    public override emit(token?: Token): Token {
        if (!token) {
            return super.emit();
        }

        this.emitToken(token);
        this.buffer.push(token);
        this.lastToken = token;

        return token;
    }

    public override nextToken(): Token {
        // Check if the end-of-file is ahead and there are still some indentations left over.
        if (this.inputStream.LA(1) === PythonLexer.EOF && this.indents.length > 0) {
            const token = this.buffer[this.buffer.length - 1];
            if (!token || token.type !== PythonLexer.LINE_BREAK) {
                // First emit an extra line break that serves as the end of the statement.
                this.emitToken(PythonLexer.LINE_BREAK);
            }

            // Now this.emit as much DEDENT tokens as needed.
            while (this.indents.length !== 0) {
                this.emitToken(PythonLexer.DEDENT);
                this.indents.pop();
            }
        }

        const candidate = this.buffer.shift();
        if (candidate) {
            return candidate;
        }

        return super.nextToken();
    }

    public override emitToken(token: Token): void;
    public override emitToken(tokenType: number, channel?: number, text?: string): void;
    public override emitToken(tokenOrTokenType: Token | number, channel?: number, text?: string): void {
        if (typeof tokenOrTokenType !== "number") {
            this.emit(tokenOrTokenType);

            return;
        }

        channel = channel ?? PythonLexerBase.DEFAULT_TOKEN_CHANNEL;
        text = text ?? "";

        const charIndex = this.tokenStartCharIndex;
        const token = CommonToken.fromSource([this, this.inputStream], tokenOrTokenType, channel,
            charIndex - text.length, charIndex);
        token.text = text;
        token.line = this.line;

        if (tokenOrTokenType !== PythonLexer.NEWLINE) {
            token.column = this.column - text.length;
        }

        this.emit(token);
    }

    protected handleNewLine(): void {
        this.emitToken(PythonLexer.NEWLINE, PythonLexerBase.HIDDEN, this.text);

        const next = String.fromCharCode(this.inputStream.LA(1));

        // Process whitespaces in HandleSpaces
        if (next !== " " && next !== "\t" && this.isNotNewLineOrComment(next)) {
            this.processNewLine(0);
        }
    }

    protected handleSpaces(): void {
        const next = String.fromCharCode(this.inputStream.LA(1));

        if ((!this.lastToken || this.lastToken.type === PythonLexer.NEWLINE)
            && this.isNotNewLineOrComment(next)) {
            // Calculates the indentation of the provided spaces, taking the
            // following rules into account:
            //
            // "Tabs are replaced (from left to right) by one to eight spaces
            //  such that the total number of characters up to and including
            //  the replacement is a multiple of eight [...]"
            //
            //  -- https://docs.python.org/3.1/reference/lexical_analysis.html#indentation

            let indent = 0;
            const text = this.text;

            for (let i = 0; i < text.length; ++i) {
                indent += text.charAt(i) === "\t" ? PythonLexerBase.tabSize - indent % PythonLexerBase.tabSize : 1;
            }

            this.processNewLine(indent);
        }

        this.emitToken(PythonLexer.WS, PythonLexerBase.HIDDEN, this.text);
    }

    protected incIndentLevel(): void {
        this.opened++;
    }

    protected decIndentLevel(): void {
        if (this.opened > 0) {
            --this.opened;
        }
    }

    private isNotNewLineOrComment(next: string): boolean {
        return this.opened === 0 && next !== "\r" && next !== "\n" && next !== "\f" && next !== "#";
    }

    private processNewLine(indent: number): void {
        this.emitToken(PythonLexer.LINE_BREAK);

        const previous = this.indents.length === 0 ? 0 : this.indents[0];

        if (indent > previous) {
            this.indents.push(indent);
            this.emitToken(PythonLexer.INDENT);
        } else {
            // Possibly emits more than 1 DEDENT token.
            while (this.indents.length !== 0 && this.indents[0] > indent) {
                this.emitToken(PythonLexer.DEDENT);
                this.indents.pop();
            }
        }
    }

}
