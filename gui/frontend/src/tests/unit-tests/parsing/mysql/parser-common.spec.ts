/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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

import { CharStreams, CommonTokenStream, Token } from "antlr4ng";

import { MySQLMRSLexer } from "../../../../parsing/mysql/generated/MySQLMRSLexer.js";
import { Scanner, tokenFromPosition } from "../../../../parsing/parser-common.js";

describe("Parser Common", () => {
    it("Getting token from position", () => {
        const input = CharStreams.fromString("SELECT * \n  /* comment */ FROM sakila.actor");
        const lexer = new MySQLMRSLexer(input);
        const stream = new CommonTokenStream(lexer);
        stream.fill();

        let token = tokenFromPosition(stream, 0);
        expect(token).toBeDefined();
        expect(token?.tokenIndex).toBe(0);
        expect(token?.line).toBe(1);
        expect(token?.column).toBe(0);
        expect(token?.channel).toBe(0);
        expect(token?.text).toBe("SELECT");

        token = tokenFromPosition(stream, 15);
        expect(token).toBeDefined();
        expect(token?.tokenIndex).toBe(4);
        expect(token?.line).toBe(2);
        expect(token?.column).toBe(2);
        expect(token?.channel).toBe(Token.HIDDEN_CHANNEL);
        expect(token?.text).toBe("/* comment */");

        token = tokenFromPosition(stream, -1);
        expect(token).toBeDefined();
        expect(token?.text).toBe("SELECT");

        token = tokenFromPosition(stream, 1000);
        expect(token).toBeDefined();
        expect(token?.text).toBe("actor");

        token = tokenFromPosition(stream, NaN);
        expect(token).toBeDefined();
        expect(token?.text).toBe("actor");

        token = tokenFromPosition(stream, 31);
        expect(token).toBeDefined();
        expect(token?.text).toBe("sakila");
    });

    it("Getting token from position (empty input)", () => {
        const input = CharStreams.fromString("");
        const lexer = new MySQLMRSLexer(input);
        const stream = new CommonTokenStream(lexer);
        stream.fill();

        let token = tokenFromPosition(stream, 0);
        expect(token).toBeUndefined();
        token = tokenFromPosition(stream, -100);
        expect(token).toBeUndefined();
        token = tokenFromPosition(stream, 100);
        expect(token).toBeUndefined();
    });

    it("Scanner functions (normal)", () => {
        const input = CharStreams.fromString("SELECT * \n  /* comment */ FROM \nsakila\n.actor");
        const lexer = new MySQLMRSLexer(input);
        const stream = new CommonTokenStream(lexer);
        const scanner = new Scanner(stream);

        expect(scanner.advanceToPosition(4, 0)).toBe(true);
        expect(scanner.tokenText).toBe(".");

        expect(scanner.advanceToPosition(2, 1)).toBe(true); // Starts on line 1, but ends on 2.
        expect(scanner.tokenText).toBe(" \n  ");

        expect(scanner.next(false)).toBe(true);
        expect(scanner.tokenText).toBe("/* comment */");

        expect(scanner.previous(false)).toBe(true);
        expect(scanner.tokenText).toBe(" \n  ");

        expect(scanner.previous(false)).toBe(true);
        expect(scanner.tokenText).toBe("*");

        expect(scanner.next(true)).toBe(true);
        expect(scanner.tokenText).toBe("FROM");

        expect(scanner.advanceToType(MySQLMRSLexer.DOT_SYMBOL)).toBe(true);
        expect(scanner.tokenText).toBe(".");

        expect(scanner.advanceToType(MySQLMRSLexer.DOT_SYMBOL)).toBe(false); // No more dots.
        expect(scanner.tokenText).toBe(".");

        scanner.reset();
        expect(scanner.advanceToType(MySQLMRSLexer.DOT_SYMBOL)).toBe(true);
        expect(scanner.tokenText).toBe(".");

        scanner.reset();
        expect(scanner.skipTokenSequence(MySQLMRSLexer.SELECT_SYMBOL, MySQLMRSLexer.MULT_OPERATOR)).toBe(true);
        expect(scanner.tokenText).toBe("FROM");
        expect(scanner.lookAhead()).toBe(MySQLMRSLexer.IDENTIFIER);
        expect(scanner.lookBack(true)).toBe(MySQLMRSLexer.MULT_OPERATOR);
        expect(scanner.lookBack(false)).toBe(MySQLMRSLexer.WHITESPACE);

        scanner.seek(4); // Seek to the comment.
        expect(scanner.lookBack(true)).toBe(MySQLMRSLexer.MULT_OPERATOR);
        expect(scanner.lookBack(false)).toBe(MySQLMRSLexer.WHITESPACE);

        scanner.seek(1);
        expect(scanner.skipTokenSequence(MySQLMRSLexer.SELECT_SYMBOL, MySQLMRSLexer.MULT_OPERATOR)).toBe(false);
        scanner.seek(1);
        expect(scanner.skipTokenSequence(MySQLMRSLexer.MULT_OPERATOR)).toBe(false);
        scanner.seek(2);
        expect(scanner.skipTokenSequence(MySQLMRSLexer.MULT_OPERATOR)).toBe(true);

        scanner.seek(0);
        expect(scanner.skipTokenSequence(MySQLMRSLexer.SELECT_SYMBOL, MySQLMRSLexer.FROM_SYMBOL)).toBe(false);

        scanner.seek(10);
        expect(scanner.skipTokenSequence(MySQLMRSLexer.DOT_SYMBOL, MySQLMRSLexer.IDENTIFIER)).toBe(true);

        scanner.seek(10);
        expect(scanner.skipTokenSequence(MySQLMRSLexer.DOT_SYMBOL, MySQLMRSLexer.IDENTIFIER, MySQLMRSLexer.EOF))
            .toBe(false);
    });

    it("Scanner functions (token details)", () => {
        const input = CharStreams.fromString("create procedure \n\ntest.Test() begin end");
        const lexer = new MySQLMRSLexer(input);
        const stream = new CommonTokenStream(lexer);
        const scanner = new Scanner(stream);

        scanner.seek(7);
        expect(scanner.is(MySQLMRSLexer.OPEN_PAR_SYMBOL)).toBe(true);
        expect(scanner.tokenChannel).toBe(0);
        expect(scanner.tokenIndex).toBe(7);
        expect(scanner.tokenType).toBe(MySQLMRSLexer.OPEN_PAR_SYMBOL);
        expect(scanner.tokenText).toBe("(");
        expect(scanner.tokenLine).toBe(3);
        expect(scanner.tokenStart).toBe(9);
        expect(scanner.tokenOffset).toBe(28);
        expect(scanner.tokenLength).toBe(1);
        expect(scanner.tokenSubText).toBe("() begin end");
    });

    it("Scanner functions (edge cases)", () => {
        let input = CharStreams.fromString("SELECT * \n  /* comment */ FROM \nsakila\n.actor");
        const lexer = new MySQLMRSLexer(input);
        const stream = new CommonTokenStream(lexer);
        const scanner = new Scanner(stream);

        expect(scanner.advanceToPosition(-10, -10)).toBe(false);
        expect(scanner.tokenText).toBe("SELECT"); // Should not have moved.
        expect(scanner.previous()).toBe(false);

        expect(scanner.advanceToPosition(10, -10)).toBe(true);
        expect(scanner.tokenText).toBe("<EOF>");

        input = CharStreams.fromString("");
        lexer.inputStream = input;
        stream.setTokenSource(lexer);
        scanner.reset(true);
        expect(scanner.advanceToPosition(-10, -10)).toBe(false);
        expect(scanner.tokenText).toBe("<EOF>");

    });

    it("Scanner stack", () => {
        const input = CharStreams.fromString("SELECT * \n  /* comment */ FROM \nsakila\n.actor");
        const lexer = new MySQLMRSLexer(input);
        const stream = new CommonTokenStream(lexer);
        const scanner = new Scanner(stream);

        expect(scanner.pop()).toBe(false); // Stack is empty.
        scanner.push();
        scanner.next(true);
        scanner.push();
        expect(scanner.tokenText).toBe("*");
        scanner.next(true);
        expect(scanner.tokenText).toBe("FROM");

        expect(scanner.pop()).toBe(true);
        expect(scanner.tokenText).toBe("*");
        expect(scanner.pop()).toBe(true);
        expect(scanner.tokenText).toBe("SELECT");

        scanner.skipTokenSequence(MySQLMRSLexer.SELECT_SYMBOL, MySQLMRSLexer.MULT_OPERATOR, MySQLMRSLexer.FROM_SYMBOL);
        expect(scanner.tokenText).toBe("sakila");
        scanner.push();
        scanner.reset();
        expect(scanner.tokenText).toBe("SELECT");
        expect(scanner.pop()).toBe(false); // The stack is cleared by reset.

        scanner.skipTokenSequence(MySQLMRSLexer.SELECT_SYMBOL, MySQLMRSLexer.MULT_OPERATOR, MySQLMRSLexer.FROM_SYMBOL);
        scanner.push();
        scanner.next(true);
        expect(scanner.tokenText).toBe(".");
        scanner.push();
        scanner.seek(0);

        expect(scanner.tokenText).toBe("SELECT");
        scanner.removeTos();
        scanner.pop();
        expect(scanner.tokenText).toBe("sakila"); // The dot position was removed.
    });

    it("Scanner and MLE", () => {
        const input = CharStreams.fromString("create procedure Test() as $abc$ something not SQL $abc$");
        const lexer = new MySQLMRSLexer(input);
        lexer.supportMle = true;
        const stream = new CommonTokenStream(lexer);
        const scanner = new Scanner(stream);

        scanner.seek(8);
        expect(scanner.is(MySQLMRSLexer.AS_SYMBOL)).toBe(true);
        scanner.next(true);
        expect(scanner.is(MySQLMRSLexer.DOLLAR_QUOTED_STRING_TEXT)).toBe(true);
        expect(scanner.tokenText).toBe("$abc$ something not SQL $abc$");
    });
});
