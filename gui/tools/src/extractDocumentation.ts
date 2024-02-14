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

/* eslint-disable no-underscore-dangle */

import convert from "xml-js";
import fs from "fs-extra";

// This file contains code that is used for preparing data, for use in this app.
// The file should not be included in the production build and uses Node.js functionality!

interface IVariableInfo {
    isDynamic: boolean;
    hintable: boolean;
    scope: string;

    minVersion: number;
    maxVersion: number;
}

interface IValueInfo {
    type: string;
    defaultValue: string;
    minValue: string;
    maxValue: string;
    valueList: string[];

    minVersion: number;
    maxVersion: number;
}

interface IArgument {
    name: string;
    type: string;
    description: string;
}

interface ICallSignature {
    signature: string;
    arguments: IArgument[];
}

/**
 * Searches all children recursively to find a section with the given id/name.
 *
 * @param entry The object to search through.
 * @param name The name/id of the section to find.
 *
 * @returns The found object or undefined.
 */
const findSection = (entry: any, name: string): object | undefined => {
    if (entry.name === "section" && entry.attributes.id === name) {
        return entry;
    }

    if (Array.isArray(entry.children)) {
        for (const child of entry.children) {
            const result = findSection(child, name);
            if (result) {
                return result;
            }
        }
    }

    return undefined;
};

/**
 * Combines all string entries into one. We have to apply some heuristics to know when to add a space char between
 * two items and when not. The whitespace information got lost during the xml -> json conversion.
 *
 * @param strings The list of strings to combine.
 *
 * @result The combined string.
 */
const concatStrings = (strings: string[]): string => {
    let result = strings[0].trim();

    for (let i = 1; i < strings.length; ++i) {
        const next = strings[i].trim();
        if (next.length > 0) {
            const lastChar = result.length > 0 ? result[result.length - 1] : "";

            // Not all char combinations require a space char between them.
            if (lastChar.match(/\w|[!%&=?`´'*+-/.:,;)]/) && next[0].match(/\w|[\[(§$%&=`´*+'#-]/)) {
                result += " ";
            } else {
                result = result.trimRight();
            }
            result += next;
        }
    }

    return result;
};

/**
 * Processing of arrays to find simple entries that can be concatenated to a single string and similar things.
 *
 * @param array The array to process.
 *
 * @returns Either the processed array or a simplified object derived from it.
 */
const sanitizeArray = (array: any[]): any => {
    // First process sub items of each array entry.
    const result = array.map((entry: any): any => {
        if (Array.isArray(entry)) {
            return sanitizeArray(entry);
        } else if (typeof entry === "object") {
            return sanitizeObject(entry);
        }

        return entry;
    }).filter((value: any) => value !== undefined);

    // Replace arrays which entirely consist of strings by a single string combining all children.
    const onlyStrings = result.every((entry: any) => typeof entry === "string");
    if (onlyStrings) {
        return concatStrings(result);
    }

    return result;
};

/**
 * Processing of objects to simplify certain structures, up to replacing a multi-child subtree into a single string.
 *
 * @param entry The object to process.
 *
 * @returns The entry with simplified content or a replacement derived from it.
 */
const sanitizeObject = (entry: any): any => {
    // Again, first process sub items.
    Object.keys(entry).forEach((key: string) => {
        if (Array.isArray(entry[key])) {
            entry[key] = sanitizeArray(entry[key]);
        } else if (typeof entry[key] === "object") {
            entry[key] = sanitizeObject(entry[key]);
        }
    });

    switch (entry.type) {
        case "text": {
            // Replace objects that only consist of a single text entry by this text.
            return entry.text;
        }
        case "element": {
            // Elements whose children property contains only text can be further merged up
            // to an object that has a single property with that text.
            if (typeof entry.children === "string") {
                // ... unless this object was created from text markup, in which case we convert
                // the object to a Markdown string. Text markup uses certain names we can
                // check here.
                const text = entry.children;
                switch (entry.name) {
                    case "literal": {
                        if (entry.attributes?.role) {
                            return { role: entry.attributes?.role, text: "`" + text + "`" };
                        }

                        return "`" + text + "`";
                    }

                    case "emphasis": {
                        return `**${text}**`;
                    }

                    case "command": {
                        return `*${text}*`;
                    }

                    case "function":
                    case "filename":
                    case "option":
                    case "remark":
                    case "userinput": {
                        return "`" + text + "`";
                    }

                    case "quote": {
                        return `"${text}"`;
                    }

                    case "programlisting": {
                        let language = entry.attributes.language;
                        if (language === "none") {
                            language = "mysql";
                        } else if (language === "terminal") {
                            language = "sh";
                        }

                        return "\n\`\`\`" + language + "\n" + text + "\n\`\`\`\n";
                    }

                    case "replaceable": {
                        return text;
                    }

                    case "ulink": {
                        const target = entry.attributes.url;

                        return "[" + text + "](" + target + ")";
                    }

                    case "link": {
                        const target = entry.attributes.linkend;

                        // TODO: the target link is probably not correct.
                        return "[" + text + "](https://dev.mysql.com/doc/refman/8.0/en/" + target + ".html)";
                    }

                    default: {
                        if (!entry.attributes) {
                            return { [entry.name]: text };
                        }

                        return entry;
                    }
                }
            } else {
                // All other elements with more complex children.
                switch (entry.name) {
                    case "listitem": {
                        if (Array.isArray(entry.children)) {
                            return entry.children;
                        }

                        // List items with only a single child can be made more compact by replacing
                        // the entire list item with that single child.
                        if (Object.keys(entry.children).length === 1) {
                            const name = Object.keys(entry.children)[0];

                            return { [name]: entry.children[name] };
                        }

                        break;
                    }

                    case "xref": {
                        // A link to an external resource.
                        const target = entry.attributes.linkend;

                        return "[" + target + "](https://dev.mysql.com/doc/refman/8.0/en/" + target + ".html)";
                    }

                    case "section": {
                        const id = entry.attributes.id;

                        return { section: id, children: entry.children };
                    }

                    case "indexterm": {
                        // An entry for indexing web content. Not relevant here, so remove it.
                        return undefined;
                    }

                    case "para": { // Paragraph entries that were not simplified due to additional role entries.
                        if (!entry.children) {
                            // This is an entry used to generate output. Not relevant here, so remove it.
                            return undefined;
                        }
                        return { para: entry.children };
                    }

                    case "ulink": {
                        return entry.attributes.url;
                    }

                    default: {
                        return entry;
                    }
                }
            }

            return entry;
        }

        default: {
            return entry;
        }
    }
};

/**
 * Converts a list of paragraphs and/or text entries to combined paragraph.
 *
 * @param list The list to convert.
 *
 * @returns A list of strings.
 */
const convertListToMarkdown = (list: any[]): any => {
    let result: any[] = [];
    for (const child of list) {
        let paragraphs;
        if (Array.isArray(child)) {
            paragraphs = convertListToMarkdown(child);
        } else {
            paragraphs = convertToMarkdown(child);
        }

        if (Array.isArray(paragraphs)) {
            result.push(paragraphs[0]);
            for (let i = 1; i < paragraphs.length; ++i) {
                result.push(paragraphs[i]);
            }
        } else {
            result.push(paragraphs);
        }
    }

    return result;
};

/**
 * Converts a list of paragraphs to a list of strings. The first entry gets the markdown list entry dash marker,
 * while all other entries are indented to line up with that first entry.
 *
 * @param list The list to convert.
 *
 * @returns A list of strings.
 */
const convertItemListToMarkdown = (list: any[]): string[] => {
    let result: string[] = [];
    for (const child of list) {
        let paragraphs;
        if (Array.isArray(child)) {
            paragraphs = convertListToMarkdown(child);
        } else {
            paragraphs = convertToMarkdown(child);
        }

        if (Array.isArray(paragraphs)) {
            result.push("- " + paragraphs[0]);
            for (let i = 1; i < paragraphs.length; ++i) {
                result.push("  " + paragraphs[i]);
            }
        } else {
            result.push("- " + paragraphs);
        }
    }

    return result;
};

/**
 * Converts an object to a markdown string, if possible.
 *
 * @param object The object to convert.
 *
 * @returns The markdown string.
 */
const convertToMarkdown = (object: any): any => {
    if (typeof object === "string") {
        return object;
    }

    if (typeof object.text === "string") {
        return object.text;
    }

    if (typeof object.para === "string") { // A contracted paragraph.
        return object.para;
    }

    if (Array.isArray(object.para)) {
        return concatStrings(convertListToMarkdown(object.para));
    }

    if (object.superscript) {
        return "^" + object.superscript;
    }


    switch (object.name) {
        case "informaltable": {
            return ""; // TODO: might be useful to turn this into a markdown table.
        }

        case "quote": {
            return "\"" + concatStrings(convertListToMarkdown(object.children)) + "\"";
        }

        case "table": {
            const result: string[] = [""];
            let i = 0; // Some parts are optional.
            if (object.children[i].caption) {
                result.push("**" + escapeText(object.children[i++].caption) + "**\n\n");
            }

            while (i < object.children.length) { // Jump over column definitions.
                if (object.children[i].name !== "col") {
                    break;
                }
                ++i;
            }

            if (object.children[i].name === "thead") {
                const cells = object.children[i++].children[0].children;
                let header = "|";
                let separator = "|"; // The line that separates the header from content.
                for (const cell of cells) {
                    header += cell.th + "|";
                    separator += "---|"; // We don't have a notion of data types, so we cannot use alignment here.
                }

                result.push(header),
                    result.push(separator);
            }

            if (object.children[i].name === "tbody") {
                const rows = object.children[i++].children;

                for (const row of rows) {
                    let line = "|";
                    for (const cell of row.children) {
                        line += cell.td + "|";
                    }

                    result.push(line);
                }
            }
            result.push("");

            return result;
        }

        case "note":
        case "warning":
        case "caution":
        case "important": {
            let type = object.name;
            type = type[0].toUpperCase() + type.substr(1);
            const result: any[] = ["", "##" + type, ""];
            result.push(convertListToMarkdown(object.children));

            return result.map((value: any) => "> " + value);
        }

        case "itemizedlist": {
            return convertItemListToMarkdown(object.children);
        }

        case "listitem": {
            const result: any[] = [];
            for (const child of object.children) {
                result.push(convertToMarkdown(child));
            }

            return result;
        }

        default: {
            return JSON.stringify(object); // Should never happen.
        }
    }
};

/**
 * Removes any single, double or backtick quotes from the input.
 *
 * @param text The input to clean up.
 *
 * @returns The input without outer whitespaces and quotes.
 */
const unquote = (text: string): string => {
    let result = text.trim();
    if (result.length > 2) {
        const first = result[0];
        const last = result[result.length - 1];

        if (first === last && (first === "\"" || first === "'" || first === "`")) {
            result = result.substr(1, result.length - 2);
        }
    }

    return result;
};

/**
 * Escape markdown specific characters to avoid rendering them styled (for instance: underscores in var names).
 *
 * @param text The text to convert.
 *
 * @returns The text with escaped characters (if any).
 */
const escapeText = (text: string): string => {
    const result = text.replace(/[*`_]/g, (match: string): string => "\\" + match);

    return result;
};

/**
 * Write the given object out to the file system as a JSON file.
 *
 * @param object The object to stream out.
 * @param fileName The target file name for it.
 */
const writeObject = (object: any, fileName: string): void => {
    let text = JSON.stringify(object, undefined, "    ");
    text = text.replace(/\\n +/g, " ");

    fs.writeFileSync(fileName, text, { encoding: "utf-8" });
};

/**
 * Converts the given text (which must be XML) to a JS object, using a specific set of options.
 *
 * @param text The text to convert.
 *
 * @returns The converted object.
 */
const convertXML = (text: string): any => {
    return convert.xml2js(text, {
        compact: false,
        trim: true,
        nativeType: false,
        ignoreDeclaration: true,
        ignoreInstruction: true,
        ignoreAttributes: false,
        ignoreComment: true,
        ignoreCdata: false,
        ignoreDoctype: true,
        ignoreText: false,
        alwaysChildren: false,
        elementsKey: "children",
        //captureSpacesBetweenElements: true, Doesn't hold what it promises.
    });
};

/**
 * Extract specific informations from the given file and converts that to a JSON string.
 *
 * @param text The text from the file to process.
 *
 * @returns The extracted data as JSON.
 */
const processFile = (text: string, entities: Map<string, string>): any => {

    // Before parsing replace all custom entities.
    entities.forEach((value: string, key: string) => {
        const regex = new RegExp("&" + key + ";", "g");
        text = text.replace(regex, value);
    });

    const data = convertXML(text);
    writeObject(data, "/Users/Mike/Downloads/raw.json");

    return data;
};

/**
 * Converts the given version string into its numeric form ("5.7.22" -> 50722).
 *
 * @param version The version to convert.
 *
 * @returns The numeric version.
 */
function convertVersion(version: string | undefined): number {
    if (!version) {
        return 0;
    }

    const parts = version.split(".");
    if (parts.length !== 3) {
        return 0;
    }

    let result = parseInt(parts[0], 10);
    result = result * 100 + parseInt(parts[1], 10);
    result = result * 100 + parseInt(parts[2], 10);

    return result;
}

function runConversion() {
    fs.removeSync("./conversions");
    fs.mkdirSync("./conversions");

    // We cannot load and parse all used entities in the documentation, but at least the product names
    // and some others can be used.
    const content = fs.readFileSync("../../../../documentation/mvl-shared/en/entities/mysql/product-names.ent", {
        encoding: "utf-8"
    });

    // The entities file is also an xml file, but the xml-json conversion leaves the <!ENTITY> entries out, which
    // we need here to replace values in the main xml.
    const lines = content.split("\n");
    const entities: Map<string, string> = new Map([
        ["current-series", "8.0"],
        ["previous-series", "5.7"],
        ["current-version", "8.0.22"],
        ["base-url-downloads", "/downloads"],
        ["base-url-internals", "/base"],
    ]);
    const entityRegEx = /<!ENTITY\s+(\w+)\s+(".+"|'.+')>/;
    lines.forEach((line: string) => {
        const match = line.match(entityRegEx);
        if (match) {
            entities.set(match[1], unquote(match[2]));
        }
    });

    // 1) System variables - full documentation
    let text = fs.readFileSync("../../../../documentation/refman-8.0/dba-mysqld-server-core.xml", {
        encoding: "utf-8"
    });
    let result: any = processFile(text, entities);

    // 1.1) Server system variables. Extract specific sub objects for isolated lists.
    let variableSection = findSection(result, "server-system-variables");
    if (variableSection) {
        result = sanitizeObject(variableSection);
        writeObject(result, "/Users/Mike/Downloads/server-system-variables.json");
    } else {
        throw new Error("Couldn't find section 'server-system-variables' in this file.");
    }

    // Find the item list with the variable names, by looking for an itemized list containing children having
    // a sysvar role in the first subpart (which is then also used to get the name of the variable).
    let foundVariables = false;
    for (const child of result.children) {
        if (child.name === "itemizedlist") {
            const content = child.children;
            if (content.length > 0 && content[0].length > 0) {
                const firstEntry = content[0][0]; // Take the first sub entry of the first child.
                if (firstEntry.para?.length > 0 && firstEntry.para[0].role === "sysvar") {
                    foundVariables = true;
                    const variables: any = {};
                    for (const varChild of content) {
                        // The first entry is used to get the variable name.
                        // The rest is used to collect a full description.
                        const description: string[] = [];
                        for (let i = 1; i < varChild.length; ++i) {
                            const entry = convertToMarkdown(varChild[i]);
                            if (Array.isArray(entry)) {
                                description.push(...entry);
                            }
                            else {
                                description.push(entry);
                            }
                        }

                        if (Array.isArray(varChild[0].para)) {
                            variables[unquote(varChild[0].para[0].text)] = description;
                        }
                    }
                    writeObject(variables, "./conversions/server-system-variables.json");
                }
            }
        }
    }

    if (!foundVariables) {
        console.warn("Could not find variables list in dba-mysqld-server-core.xml.");
    }

    // 1.2) InnoDB system variables - full documentation
    text = fs.readFileSync("../../../../documentation/refman-8.0/se-innodb-core.xml", {
        encoding: "utf-8"
    });
    result = processFile(text, entities);

    variableSection = findSection(result, "innodb-parameters");
    if (variableSection) {
        result = sanitizeObject(variableSection);
        writeObject(result, "/Users/Mike/Downloads/innodb-variables.json");
    } else {
        throw new Error("Couldn't find section 'innodb-parameters' in se-innodb-core.xml.");
    }

    foundVariables = false;
    for (let i = 0; i < result.children.length - 1; ++i) {
        let child = result.children[i];
        if (child.bridgehead === "InnoDB System Variables" && i < result.children.length - 1) {
            child = result.children[i + 1]; // The actual list is the next sibling of the title child.
            const content = child.children;

            // In opposition to the server variables xmls there's no "sysvar" role set for variable name entries.
            // So, we assume the title is good enough to locate the list.
            foundVariables = true;
            const variables: any = {};
            for (const varChild of content) {
                // The first entry is used to get the variable name.
                // The rest is used to collect a full description.
                const description: string[] = [];
                for (let i = 1; i < varChild.length; ++i) {
                    const entry = convertToMarkdown(varChild[i]);
                    if (Array.isArray(entry)) {
                        description.push(...entry);
                    }
                    else {
                        description.push(entry);
                    }
                }

                if (Array.isArray(varChild[0].para)) {
                    variables[unquote(varChild[0].para[0].text)] = description;
                } else {
                    variables[unquote(varChild[0].para)] = description;
                }
            }
            writeObject(variables, "./conversions/innodb-system-variables.json");
        }
    }

    if (!foundVariables) {
        console.warn("Could not find variables list in se-innodb-core.xml.");
    }

    // 3) The short variables description file.
    text = fs.readFileSync("../../../../documentation/dynamic-docs/optvar/mysqld.xml", {
        encoding: "utf-8"
    });
    result = processFile(text, entities);

    const options = result.children[0];
    if (!options || options.name !== "mysqloptions") {
        throw new Error("Couldn't find the 'mysqloptions' list in mysqld.xml.");
    }

    result = sanitizeObject(options);
    writeObject(result, "/Users/Mike/Downloads/mysqld-options.json");

    const variables: any = {};
    for (const entry of result.children) {
        if (entry.name === "mysqloption") {
            let xrefto = "";
            let name = "";
            let description = "";
            let footnote = "";

            let introduced = "";
            let deprecated = "";
            let removed = "";

            let system: IVariableInfo[] = [];
            let values: IValueInfo[] = [];

            for (const child of entry.children) {
                if (child.description) {
                    description = child.description;
                } else if (child.footnote) {
                    footnote = child.footnote;
                } else if (child.name) {
                    switch (child.name) {
                        case "xrefto": {
                            xrefto = child.attributes.id;
                            break;
                        }

                        case "seealso": {
                            // An additional external reference, which we don't use.

                            break;
                        }

                        case "description": {
                            // Appears if additional content exists for the description
                            // and hence it has not been condensed into a single "description" field.
                            description = child.children;
                            break;
                        }

                        case "types": {
                            for (const subChild of child.children) {
                                if (subChild.name === "system") {
                                    system.push({
                                        isDynamic: subChild.attributes.isdynamic === "yes",
                                        hintable: subChild.attributes.hintable === "yes",
                                        scope: subChild.attributes.scope,
                                        minVersion: convertVersion(subChild.attributes.inversion),
                                        maxVersion: convertVersion(subChild.attributes.outversion),
                                    });
                                }
                            }

                            break;
                        }

                        case "values": {
                            const type = child.attributes.vartype;
                            let defaultValue = "";
                            let minValue = "";
                            let maxValue = "";
                            const valueList: string[] = [];

                            if (child.children) {
                                for (const subChild of child.children) {
                                    if (subChild.name === "value") {
                                        if (subChild.attributes.default) {
                                            defaultValue = subChild.attributes.default;
                                        } else if (subChild.attributes.minimum) {
                                            minValue = subChild.attributes.minimum;
                                        } else if (subChild.attributes.maximum) {
                                            maxValue = subChild.attributes.maximum;
                                        }
                                    } else if (subChild.name === "choice") {
                                        valueList.push("- `" + subChild.attributes.value + "`");
                                    }
                                }
                            }

                            values.push({
                                type,
                                defaultValue,
                                minValue,
                                maxValue,
                                valueList,

                                minVersion: convertVersion(child.attributes.inversion),
                                maxVersion: convertVersion(child.attributes.outversion),
                            });

                            break;
                        }

                        case "versions": {
                            for (const subChild of child.children) {
                                if (subChild.name === "introduced") {
                                    introduced = subChild.attributes.version;
                                }

                                if (subChild.name === "deprecated") {
                                    deprecated = subChild.attributes.version;
                                }

                                if (subChild.name === "removed") {
                                    removed = subChild.attributes.version;
                                }
                            }

                            break;
                        }

                        default: {
                            name = child.name;
                            break;
                        }
                    }
                }
            }

            if (name !== "") {
                // There can be multiple values sets per variable (each with an own version range).
                // We use the highest version here.
                let value: IValueInfo = {
                    type: "",
                    defaultValue: "",
                    minValue: "",
                    maxValue: "",
                    valueList: [],

                    minVersion: 0,
                    maxVersion: 0,
                };
                if (values.length > 0) {
                    if (values.length > 1) {
                        values = values.sort((a: IValueInfo, b: IValueInfo) => a.minVersion - b.minVersion);
                    }
                    value = values[values.length - 1];
                }


                let part1 = "```mysql\ndeclare @@" + name + " " + value.type + "\n```";
                let parts = "";

                let part2 = "_**System Variable**_";
                parts = "";
                if (introduced !== "") {
                    parts += "⊕ " + introduced;
                }

                if (deprecated !== "") {
                    if (parts !== "") {
                        parts += ", ";
                    }
                    parts += "⊘ " + deprecated;
                }

                if (removed !== "") {
                    if (parts !== "") {
                        parts += ", ";
                    }
                    parts += "⊗ " + removed;
                }

                if (parts !== "") {
                    part2 += " (" + parts + ")";
                }

                part2 += "\n\n";

                parts = "";
                if (value.defaultValue !== "") {
                    parts += "default: `" + value.defaultValue + "`";
                }

                if (value.minValue !== "") {
                    if (parts !== "") {
                        parts += ", ";
                    }
                    parts += "min: `" + value.minValue + "`";
                }

                if (value.maxValue !== "") {
                    if (parts !== "") {
                        parts += ", ";
                    }
                    parts += "max: `" + value.maxValue + "`";
                }

                if (value.valueList.length > 0) {
                    if (parts !== "") {
                        parts += ", ";
                    }
                    parts += "valid values:\n\n" + value.valueList.join("\n");
                }

                if (parts !== "") {
                    part2 += parts + "\n\n";
                }

                let systemInfo = { isDynamic: false, hintable: false, scope: "", minVersion: 0, maxVersion: 0 };
                if (system.length > 0) {
                    if (system.length > 1) {
                        system = system.sort((a: IVariableInfo, b: IVariableInfo) => a.minVersion - b.minVersion);
                    }
                    systemInfo = system[system.length - 1];
                }

                if (systemInfo.scope === "both") {
                    systemInfo.scope = "global, session";
                }

                part2 += "dynamic: " + (systemInfo.isDynamic ? "yes" : "no");
                part2 += ", scope: " + systemInfo.scope;
                part2 += ", [SET_VAR hint](https://dev.mysql.com/doc/refman/8.0/en/optimizer-hints.html#" +
                    "optimizer-hints-set-var) " + (systemInfo.hintable ? "supported" : "not supported");

                let part3 = description + " [[online documentation](https://dev.mysql.com/" +
                    "doc/refman/8.0/en/server-system-variables.html#" + xrefto + ")].";
                if (footnote !== "") {
                    part3 += "\n\n> " + footnote;
                }

                variables[name] = [
                    part1,
                    part2,
                    part3
                ];
            }
        }
    }

    writeObject(variables, "./conversions/system-variables.json");

    // 4) System functions - short version.
    text = fs.readFileSync("../../../../documentation/dynamic-docs/opfunc/sql.xml", {
        encoding: "utf-8"
    });

    result = processFile(text, entities);

    const functionList = result.children[0];
    if (!functionList || functionList.name !== "opfunctions") {
        throw new Error("Couldn't find the 'opfunctions' list in mysqld.xml.");
    }

    result = sanitizeObject(functionList);
    writeObject(result, "/Users/Mike/Downloads/mysqld-functions.json");

    const functions: any = {};
    for (const entry of result.children) {
        if (entry.name === "opfunction" && entry.attributes.type === "function") {
            let name = "";

            let description = "";
            let introduced = "";
            let deprecated = "";
            let removed = "";
            let signatures = [];
            let returnValue = "";

            for (const child of entry.children) {
                if (child.description) {
                    description = child.description;
                } else if (child.display) {
                    name = child.display;
                    if (name.endsWith("()")) {
                        name = name.substr(0, name.length - 2);
                    }
                } else if (child.name) {
                    switch (child.name) {
                        case "versions": {
                            for (const subChild of child.children) {
                                if (subChild.name === "introduced") {
                                    introduced = subChild.attributes.version;
                                }

                                if (subChild.name === "deprecated") {
                                    deprecated = subChild.attributes.version;
                                }

                                if (subChild.name === "removed") {
                                    removed = subChild.attributes.version;
                                }
                            }

                            break;
                        }

                        case "arguments": {
                            // One possible call signature. Can appear multiple times.
                            const callSignature: ICallSignature = {
                                signature: "",
                                arguments: [],
                            };

                            for (const subChild of child.children) {
                                if (subChild.name === "format" && subChild.children?.length > 0) {
                                    // This string is text with embeded HTML tags, which contains often additional
                                    // information. Thus, instead of creating our own parameter string, we re-use
                                    // the one from the "format" child node.
                                    // In some cases this string can be parsed as XML, but not in all.
                                    // So we do some manual handling here by replacing known tags with text
                                    // markup.
                                    let signature: string = subChild.children[0].cdata;
                                    if (signature) {
                                        // Since this is CDATA text, it can contain unnecessary whitespaces.
                                        signature = signature.replace(/\s+/g, " ");
                                        signature = signature.replace(/<replaceable>(\w+)<\/replaceable>/g,
                                            (_: string, group: string) => "`" + group + "`");
                                        signature = signature.replace(/<literal>(\w+)<\/literal>/g,
                                            (_: string, group: string) => group);

                                        callSignature.signature = signature;
                                    }

                                }

                                if (subChild.name === "argument") {
                                    callSignature.arguments.push({
                                        name: subChild.attributes.name,
                                        type: subChild.attributes.type,
                                        description: subChild.children,
                                    });
                                }
                            }
                            signatures.push(callSignature);

                            break;
                        }

                        case "return": {
                            returnValue = child.attributes.type;

                            break;
                        }

                        default: {
                            break;
                        }
                    }
                }
            }

            if (name !== "") {
                let parts: string[] = [];
                for (const signature of signatures) {
                    parts.push("**" + name + "**(" + signature.signature + ")");

                    for (const argument of signature.arguments) {
                        parts.push("- `" + argument.name + "` (" + argument.type + ") => " + argument.description);
                    }
                    parts.push("");
                }
                parts.push("returns: " + returnValue);

                let part1 = parts.join("\n");

                parts = [];
                if (introduced !== "") {
                    parts.push("⊕ " + introduced);
                }

                if (deprecated !== "") {
                    parts.push("⊘ " + deprecated);
                }

                if (removed !== "") {
                    parts.push("⊗ " + removed);
                }

                const part2 = "_**System Function**_" + (parts.length > 0 ? " (" + parts.join(", ") + ")" : "") +
                    "\n\n" + description;

                functions[name] = [
                    part1,
                    part2,
                ];
            }
        }
    }

    writeObject(functions, "./conversions/system-functions.json");
}

// Starting point for conversions. In order for the paths to work you have to put the docs repository side-by-side
// to the ngshell repo.
console.log("Starting conversion");
runConversion();
console.log("done");
