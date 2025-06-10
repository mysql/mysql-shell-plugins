/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

export interface ISimpleXMLEntry {
    type: string;
}

export interface ISimpleXMLTag extends ISimpleXMLEntry {
    type: "tag";
    tagName: string;
    attributes: Record<string, string>;
    content: Array<ISimpleXMLTag | ISimpleXMLContent>;
}

export interface ISimpleXMLContent extends ISimpleXMLEntry {
    type: "text";
    text: string;
}

/**
 * A class to parse simple XML strings, like those used for connection storage in MySQL Workbench.
 * It does not use DOMParser or any other complex XML parsing libraries.
 * It is designed to handle simple XML structures and is not suitable for complex XML documents.
 */
export class SimpleXMLParser {
    /**
     * Parses a simple XML string and returns an object representation.
     * @param xmlString - The XML string to parse.
     * @returns An object representing the XML structure.
     */
    public static parse(xmlString: string): Array<ISimpleXMLTag | ISimpleXMLContent> {
        const tokens = this.tokenizeXML(xmlString);

        // Convert the simple list into a nested structure.
        const result: Array<ISimpleXMLTag | ISimpleXMLContent> = [];
        const stack: ISimpleXMLTag[] = [];
        for (const token of tokens) {
            // Handle processing instructiions, e.g. <?xml version="1.0" encoding="UTF-8"?>
            if (token.startsWith("<?") && token.endsWith("?>")) {
                // We can ignore these for our purposes.
                continue;
            }

            if (token.startsWith("</")) {
                // Closing tag.
                const tagName = token.slice(2, -1).trim();

                if (stack.length === 0 || stack[stack.length - 1].tagName !== tagName) {
                    throw new Error(`Mismatched closing tag: ${tagName}`);
                }

                stack.pop()!;
            } else if (token.startsWith("<")) {
                // Opening tag.
                const firstWhiteSpaceIndex = token.indexOf(" ");
                const tagName = token.slice(1, firstWhiteSpaceIndex).trim();
                const tag: ISimpleXMLTag = {
                    type: "tag",
                    tagName,
                    attributes: {},
                    content: [],
                };

                const attrMatch = token.slice(1, -1).match(/(\w+(-\w+)*)="([^"]*)"/g);
                if (attrMatch) {
                    tag.attributes = {};
                    for (const attr of attrMatch) {
                        const [key, value] = attr.split("=");
                        tag.attributes[key.trim()] = value.replace(/"/g, "").trim();
                    }
                }

                if (stack.length > 0) {
                    // If there's an open tag, add this tag as a child.
                    const openTag = stack[stack.length - 1];
                    openTag.content.push(tag);
                } else {
                    // If there's no open tag, just add it to the result.
                    result.push(tag);
                }

                // Make this tag the current open tag, if it is not self-closing.
                if (!token.endsWith("/>")) {
                    stack.push(tag);
                }
            } else {
                // Content
                const content: ISimpleXMLContent = {
                    type: "text",
                    text: token.trim(),
                };

                if (stack.length > 0) {
                    // If there's an open tag, add the content to it.
                    const openTag = stack[stack.length - 1];
                    openTag.content.push(content);
                } else {
                    // If there's no open tag, just add the content to the result.
                    result.push(content);
                }
            }
        }

        return result;
    }

    /**
     * Separates XML tags from the text.
     *
     * @param text The XML text to tokenize.
     *
     * @returns An array of strings (tokens), each representing a tag (open or close) or content.
     */
    private static tokenizeXML(text: string): string[] {
        const tokens: string[] = [];

        let currentIndex = 0;
        while (currentIndex < text.length) {
            // Find the next opening tag.
            const openTagStart = text.indexOf("<", currentIndex);
            if (openTagStart === -1) {
                // No more tags.
                currentIndex = text.length;

                break;
            }

            if (openTagStart > currentIndex) {
                // Add the text before the tag as a token
                const part = text.substring(currentIndex, openTagStart).trim();
                if (part) {
                    tokens.push(part);
                }
            }

            // Find the closing '>' of the tag.
            let openTagEnd = text.indexOf(">", openTagStart);
            if (openTagEnd === -1) {
                throw new Error(`Malformed XML: No closing '>' found for tag starting at index ${openTagStart}`);
            }

            // Extract the tag.
            ++openTagEnd;
            const tag = text.substring(openTagStart, openTagEnd).trim();
            tokens.push(tag);

            currentIndex = openTagEnd;
        }

        // If there's any remaining text after the last tag, add it as a token.
        if (currentIndex < text.length) {
            tokens.push(text.substring(currentIndex).trim());
        }

        return tokens;
    }
}
