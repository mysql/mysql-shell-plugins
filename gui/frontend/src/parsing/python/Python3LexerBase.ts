/*
 * Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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
 * WITHOUT unknown WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

// Parts of this file are based on the Python3LexerBase class from the ANTLR4 grammar directory.

import { CommonToken, Lexer, Token } from "antlr4ng";

import { Python3Lexer } from "./generated/Python3Lexer.js";

export abstract class Python3LexerBase extends Lexer {
    // A queue where extra tokens are pushed on (see the NEWLINE lexer rule).
    private tokens: Token[] = [];

    // The stack that keeps track of the indentation level.
    private indents: number[] = [];

    private opened = 0;

    public override reset(): void {
        this.tokens = [];
        this.indents = [];
        this.opened = 0;

        super.reset();
    }

    public override emitToken(token: Token): void {
        super.emitToken(token);
        this.tokens.push(token);
    }

    public override nextToken(): Token {
        // Check if the end-of-file is ahead and there are still some DEDENTS expected.
        if (this.inputStream.LA(1) === Python3LexerBase.EOF && this.indents.length) {
            // Remove unknown trailing EOF tokens from our buffer.
            this.tokens = this.tokens.filter((val) => {
                return val.type !== Python3LexerBase.EOF;
            });

            // First emit an extra line break that serves as the end of the statement.
            this.emitToken(this.commonToken(Python3Lexer.NEWLINE, "\n"));

            // Now emit as much DEDENT tokens as needed.
            while (this.indents.length) {
                this.emitToken(this.createDedent());
                this.indents.pop();
            }

            // Put the EOF back on the token stream.
            this.emitToken(this.commonToken(Python3Lexer.EOF, "<EOF>"));
        }
        const next = super.nextToken();

        return this.tokens.shift() ?? next;
    }

    public override getCharIndex(): number {
        return this.inputStream.index;
    }

    protected atStartOfInput(): boolean {
        return this.getCharIndex() === 0;
    }

    protected openBrace(): void {
        this.opened++;
    }

    protected closeBrace(): void {
        this.opened--;
    }

    protected onNewLine(): void {
        const newLine = this.text.replace(/[^\r\n]+/g, "");
        const spaces = this.text.replace(/[\r\n]+/g, "");

        // Strip newlines inside open clauses except if we are near EOF. We keep NEWLINEs near EOF to
        // satisfy the final newline needed by the single_put rule used by the REPL.
        const next = this.inputStream.LA(1);
        const nextnext = this.inputStream.LA(2);
        if (this.opened > 0
            || (nextnext !== -1 /* EOF */
                && (next === 13 /* '\r' */ || next === 10 /* '\n' */ || next === 35 /* '#' */)
            )
        ) {
            // If we're inside a list or on a blank line, ignore all indents,
            // dedents and line breaks.
            this.skip();
        } else {
            this.emitToken(this.commonToken(Python3Lexer.NEWLINE, newLine));

            const indent = this.getIndentationCount(spaces);
            const previous = this.indents.length ? this.indents[this.indents.length - 1] : 0;

            if (indent === previous) {
                // skip indents of the same size as the present indent-size
                this.skip();
            } else if (indent > previous) {
                this.indents.push(indent);
                this.emitToken(this.commonToken(Python3Lexer.INDENT, spaces));
            } else {
                // Possibly emit more than 1 DEDENT token.
                while (this.indents.length && this.indents[this.indents.length - 1] > indent) {
                    this.emitToken(this.createDedent());
                    this.indents.pop();
                }
            }
        }
    }

    private createDedent() {
        return this.commonToken(Python3Lexer.DEDENT, "");
    }

    private commonToken(type: number, text: string): CommonToken {
        const stop = this.getCharIndex() - 1;
        const start = text.length ? stop - text.length + 1 : stop;

        return CommonToken.fromSource([this, this.inputStream], type, 0, start, stop);
    }

    private getIndentationCount(whitespace: string): number {
        let count = 0;
        for (const char of whitespace) {
            if (char === "\t") {
                count += 8 - count % 8;
            } else {
                count++;
            }
        }

        return count;
    }
}
