/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation. The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { ErrorNode, ParserRuleContext, ParseTree, TerminalNode, Token, Vocabulary } from "antlr4ng";

import { MySQLMRSParser, TextLiteralContext } from "./generated/MySQLMRSParser.js";
import { reservedMySQLKeywords, mysqlKeywords, MySQLVersion } from "./mysql-keywords.js";

/** This interface describes functionality found in both, lexer and parser classes. */
export interface IMySQLRecognizerCommon {
    /** The server version to use for lexing/parsing. */
    serverVersion: number;

    /** SQL modes to use for lexing/parsing. */
    sqlModes: Set<SqlMode>;

    /** @returns true if the given mode (one of the enums above) is set. */
    isSqlModeActive(mode: number): boolean;

    /** Parses the given mode string and keeps all found SQL mode in a private member. Only used for lexers. */
    sqlModeFromString?: (modes: string) => void;
}

/** SQL modes that control parsing behavior. */
export enum SqlMode {
    NoMode,
    AnsiQuotes,
    HighNotPrecedence,
    PipesAsConcat,
    IgnoreSpace,
    NoBackslashEscapes,
}

/**
 * Determines if a given string represents a reserved keyword.
 *
 * @param identifier The string to check.
 * @param version The MySQL version for which to check.
 *
 * @returns A flag which indicates if the identifier is a reserved MySQL keyword.
 */
export const isReservedKeyword = (identifier: string, version: MySQLVersion): boolean => {
    const reserved = reservedMySQLKeywords.get(version);

    return reserved?.has(identifier.toUpperCase()) ?? false;
};

/**
 * Determines if a given string represents a keyword.
 *
 * @param identifier The string to check.
 * @param version The MySQL version for which to check.
 *
 * @returns A flag which indicates if the identifier is a MySQL keyword.
 */
export const isKeyword = (identifier: string, version: MySQLVersion): boolean => {
    const map = mysqlKeywords.get(version);

    return map?.has(identifier.toUpperCase()) ?? false;
};

/**
 * Converts a MySQL version number given as an integer number to a version enum.
 *
 * @param version The version to convert.
 *
 * @returns The determined MySQL version enum.
 */
export const numberToVersion = (version: number): MySQLVersion => {
    if (version < 100) {
        version *= 10000;
    } else if (version < 10000) {
        version *= 100;
    }

    // const build = version % 100;
    const minor = Math.floor(version / 100) % 100;
    const major = Math.floor(version / 10000);

    if (major >= 8) {
        switch (minor) {
            case 1: {
                return MySQLVersion.MySQL81;
            }

            case 2: {
                return MySQLVersion.MySQL82;
            }

            case 3: {
                return MySQLVersion.MySQL83;
            }

            case 4: {
                return MySQLVersion.MySQL84;
            }

            default: {
                return MySQLVersion.MySQL80;
            }
        }
    }

    return MySQLVersion.Unknown;
};

/**
 * Returns the text which the given context matched.
 *
 * @param context The parser context for which to return the text. If that is a text literal, some special
 *                processing takes place to replace escape sequences, double quotes etc.
 *
 * @param convertEscapes Indicates if escape sequences should be handled for text literals.
 *
 * @returns The text for the context.
 */
export const getText = (context: ParserRuleContext, convertEscapes: boolean): string => {
    if (context instanceof TextLiteralContext) {
        // TODO: take the optional repertoire prefix into account.
        let result = "";

        for (let index = 0; index < context.getChildCount(); ++index) {
            const child = context.textStringLiteral(index)!;
            // eslint-disable-next-line no-underscore-dangle
            const token = child._value;
            if (token?.type === MySQLMRSParser.DOUBLE_QUOTED_TEXT
                || token?.type === MySQLMRSParser.SINGLE_QUOTED_TEXT) {
                let text = token.text || "''";
                const quoteChar = text[0];
                const doubledQuoteChar = quoteChar.repeat(2);
                text = text.substring(1, text.length - 1); // Remove outer quotes.
                text = text.replace(doubledQuoteChar, quoteChar); // Add replace double quote chars.

                result += text;

                break;
            }
        }

        if (convertEscapes) {
            const temp = result;
            result = "";

            let pendingEscape = false;
            for (let c of temp) {
                if (pendingEscape) {
                    pendingEscape = false;
                    switch (c) {
                        case "n": {
                            c = "\n";
                            break;
                        }
                        case "t": {
                            c = "\t";
                            break;
                        }
                        case "r": {
                            c = "\r";
                            break;
                        }
                        case "b": {
                            c = "\b";
                            break;
                        }
                        case "0": {
                            c = "\0";
                            break; // ASCII null
                        }
                        case "Z": {
                            c = "\u0032";
                            break; // Win32 end of file
                        }

                        default: {
                            break;
                        }
                    }
                } else if (c === "\\") {
                    pendingEscape = true;
                    continue;
                }
                result += c;
            }

            if (pendingEscape) {
                result += "\\";
            }
        }

        return result;
    }

    return context.getText(); // In all other cases return the text unprocessed.
};

/**
 * Dumps the content of the given context into a string for debugging purposes.
 *
 * @param context The context to dump.
 * @param vocabulary A vocabulary with lexer symbol names.
 * @param indentation The amount of indentation to apply for this dump (increase during nesting).
 *
 * @returns The dumped context.
 */
export const dumpTree = (context: ParserRuleContext, vocabulary: Vocabulary, indentation: string): string => {
    let result = "";

    for (const child of context.children ?? []) {
        if (child instanceof ParserRuleContext) {
            if (child instanceof TextLiteralContext) {
                const interval = child.getSourceInterval();
                const childText = getText(child, true);
                result += `${indentation} (index range: ${interval.start}..${interval.stop}, string literal) ` +
                    `${childText}\n`;
            } else {
                result += dumpTree(child, vocabulary, indentation.length < 100 ? indentation + " " : indentation);
            }
        } else if (child instanceof TerminalNode) {
            // A terminal node.
            result += indentation;

            if (child instanceof ErrorNode) {
                result += "Syntax Error: ";
            }

            const token = child.symbol;

            const type = token.type;
            const tokenName = type === Token.EOF ? "<EOF>" : (vocabulary.getSymbolicName(token.type) ?? "<not found>");
            result += `(line: ${token.line}, offset: ${token.column}, index: ${token.tokenIndex}, ` +
                `${tokenName} [${token.type}]) ${token.text ?? ""}\n`;
        }
    }

    return result;
};

/**
 * Retrieves the original source text, including all whitespaces and comments, for a range enclosed by two nodes.
 *
 * @param start The start token or parse tree that contain the start character index.
 * @param stop Ditto for the stop character index. Start and stop form the range to retrieve.
 * @param keepQuotes If true leaves eventual outer quotes untouched. Otherwise they are removed.
 *
 * @returns The text from the given range.
 */
export const sourceTextForRange = (start: Token | ParseTree, stop: Token | ParseTree | undefined,
    keepQuotes: boolean): string => {

    const isToken = (start as Token).type !== undefined;

    let startToken = start as Token;
    if (!isToken) {
        startToken = (start instanceof TerminalNode) ? start.symbol : (start as ParserRuleContext).start!;
    }

    let stopToken = stop as Token;
    if (!isToken) { // start + stop must either both Token or ParseTree instances.
        stopToken = (stop instanceof TerminalNode) ? stop.symbol : (stop as ParserRuleContext).start!;
    }

    const stream = startToken.tokenSource?.inputStream;
    const stopIndex = stop ? stopToken.stop : 1e100;
    let result = stream?.getTextFromRange(startToken.start, stopIndex) ?? "";
    if (keepQuotes || result.length < 2) {
        return result;
    }

    const quoteChar = result[0];
    if ((quoteChar === '"' || quoteChar === "`" || quoteChar === "'") && quoteChar === result[result.length - 1]) {
        if (quoteChar === '"' || quoteChar === "'") {
            // Replace any double occurrence of the quote char by a single one.
            result = result.replace(quoteChar.repeat(2), quoteChar);
        }

        return result.substring(1, result.length - 1);
    }

    return result;
};

/**
 * Returns the original source text, including all whitespaces and comments, for the given context.
 *
 * @param ctx The context to return text for.
 * @param keepQuotes Flag to indicate if quotes around text shall be left in or not.
 *
 * @returns The original source text.
 */
export const sourceTextForContext = (ctx: ParserRuleContext, keepQuotes: boolean): string => {
    return sourceTextForRange(ctx.start!, ctx.stop!, keepQuotes);
};

/**
 * Returns the previous sibling of the given tree, which could be a non-terminal. Requires that `tree` has
 * a valid parent.
 *
 * @param tree The tree node to start walking from.
 *
 * @returns The node preceding the given node in the same parent or undefined if the given node is the first child.
 */
export const getPreviousSibling = (tree: ParserRuleContext): ParserRuleContext | null => {
    const parent = tree.parent;
    if (!parent) {
        return null;
    }

    // Get the index of the given tree in the child list of its parent.
    // No need to check if the index is always valid, since will always find the tree.
    let index = 0;
    while (parent.getChild(index) !== tree) {
        ++index;
    }

    return index > 0 ? parent.getChild(index - 1) as ParserRuleContext : null;
};

/**
 * Returns the node that appears before the given node, when searching in a depth-first manner.
 *
 * @param tree The tree node to start walking from.
 *
 * @returns The node that immediately precedes the given node or nothing if there's none anymore.
 */
export const getPrevious = (tree: ParserRuleContext): ParserRuleContext | null => {
    let walker: ParserRuleContext | null;

    do {
        const sibling = getPreviousSibling(tree);
        if (sibling) {
            if (sibling instanceof TerminalNode) { // Terminal nodes cannot have children by definition.
                return sibling;
            }

            walker = sibling;
            while (walker.getChildCount() > 0) { // Walk down to the last child node.
                walker = walker.getChild(walker.getChildCount() - 1) as ParserRuleContext;
            }

            if (walker instanceof TerminalNode) {
                return walker;
            }
        } else {
            walker = walker!.parent;
        }
    } while (walker);

    return null;

};

/**
 * Returns the next sibling of the given tree, which could be a non-terminal.
 * Requires that tree has a valid parent.
 *
 * @param tree The tree node to start walking from.
 *
 * @returns The node following the given node in the same parent or undefined if the given node is the last child.
 */
export const getNextSibling = (tree: ParserRuleContext): ParserRuleContext | null => {
    const parent = tree.parent;
    if (!parent) {
        return null;
    }

    // Get the index of the given tree in the child list of its parent.
    // No need to check if the index is always valid, since will always find the tree.
    let index = 0;
    while (parent.getChild(index) !== tree) {
        ++index;
    }

    return index < parent.getChildCount() - 1 ? parent.getChild(index + 1) as ParserRuleContext : null;
};

/**
 * Returns the terminal node right after the given position.
 *
 * @param tree Can be a terminal or non-terminal node.
 *
 * @returns The next terminal if there's any.
 */
export const getNext = (tree: ParserRuleContext): ParserRuleContext | null => {
    // If we have children then return the first one.
    if (tree.getChildCount() > 0) {
        do {
            tree = tree.getChild(0)! as ParserRuleContext;
        } while (tree.getChildCount() > 0);

        return tree;
    }

    // No children, so try our next sibling (or that of our parent(s)).
    let run: ParserRuleContext | null = tree;
    do {
        const sibling = getNextSibling(run);
        if (sibling) {
            if (sibling instanceof TerminalNode) {
                return sibling;
            }

            return getNext(sibling);
        }
        run = run.parent;
    } while (run);

    return null;
};

/**
 * Returns the terminal node at the given position. If there is no terminal node at that position (or if it is EOF)
 * then the previous terminal node is returned instead. If there is none then the one after the position is returned
 * instead (which could also be EOF).
 * Note: the line is one-based.
 *
 * @param root The tree root to start searching from.
 * @param column The column index to search for.
 * @param line The line number to search for.
 *
 * @returns The found terminal node or undefined if nothing could be found.
 */
export const terminalFromPosition = (root: ParserRuleContext, column: number,
    line: number): ParserRuleContext | null => {
    let run: ParserRuleContext | null = root;
    do {
        run = getNext(run);
        if (run instanceof TerminalNode) {
            const token = run.symbol;
            if (token.type === Token.EOF) {
                return getPrevious(run);
            }

            // If we reached a position after the given one then we found a situation
            // where that position is between two terminals. Return the previous one in this case.
            if (line < token.line) {
                return getPrevious(run);
            }

            if (line === token.line && column < token.column) {
                return getPrevious(run);
            }

            const length = token.stop - token.start + 1;
            if (line === token.line && (column < token.column + length)) {
                return run;
            }
        }
    } while (run);

    return null;
};

/**
 * Checks if the given node contains the given position.
 *
 * @param node The node to check.
 * @param position A character index.
 *
 * @returns True if the parse tree spans an input range that includes the position, otherwise false.
 */
const treeContainsPosition = (node: ParseTree, position: number): boolean => {
    if (node instanceof TerminalNode) {
        return node.symbol.start <= position && position <= node.symbol.stop;
    }

    if (node instanceof ParserRuleContext && node.stop) {
        return node.start!.start <= position && position <= node.stop.stop;
    }

    return false;
};

/**
 * Returns the parse tree at the given character index position or undefined if there's none.
 *
 * @param root The node to search through.
 * @param position The character index we look for.
 *
 * @returns The parse tree if there's one containing the given position or undefined.
 */
export const contextFromPosition = (root: ParserRuleContext, position: number): ParserRuleContext | null => {
    if (!treeContainsPosition(root, position)) {
        return null;
    }

    if (root.children) {
        for (const child of root.children) {
            const result = contextFromPosition(child as ParserRuleContext, position);
            if (result) {
                return result;
            }
        }
    }

    // No child contains the given position, so it must be in whitespaces between them.
    // Return the root for that case.
    return root;
};
