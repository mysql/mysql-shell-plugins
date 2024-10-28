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

import "./JsonView.css";

import { ComponentChild, createRef } from "preact";

import { ComponentBase, IComponentProperties } from "../Component/ComponentBase.js";
import { ThemeManager } from "../../Theming/ThemeManager.js";

export type JsonValue = string | number | boolean | null | JsonArray | JsonObject;
export type JsonArray = JsonValue[];
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type JsonObject = { [key: string]: JsonValue; };

export interface IJsonViewProps extends IComponentProperties {
    /** The data to show, either as object or stringified. */
    json: JsonValue | string;
}

/** A control to render an interactive JSON tree. */
export class JsonView extends ComponentBase<IJsonViewProps> {
    // This span serves as source for all other spans, by cloning it (which is faster than createElement).
    static readonly #span = document.createElement("span");

    // And a number of other nodes we need frequently.
    static readonly #entrySpan = JsonView.#createSpan("entry");
    static readonly #expSpan = JsonView.#createSpan("e");
    static readonly #keySpan = JsonView.#createSpan("k");
    static readonly #stringSpan = JsonView.#createSpan("s");
    static readonly #numberSpan = JsonView.#createSpan("n");

    static readonly #nullSpan = JsonView.#createSpan("nl", "null");
    static readonly #trueSpan = JsonView.#createSpan("bl", "true");
    static readonly #falseSpan = JsonView.#createSpan("bl", "false");

    static readonly #openObjectSpan = JsonView.#createSpan("o", "{");
    static readonly #closeObjectSpan = JsonView.#createSpan("o", "}");
    static readonly #openArraySpan = JsonView.#createSpan("a", "[");
    static readonly #closeArraySpan = JsonView.#createSpan("a", "]");

    static readonly #ellipsisSpan = JsonView.#createSpan("ell");
    static readonly #blockInnerSpan = JsonView.#createSpan("blockInner");

    static readonly #colonAndSpaceSpan = JsonView.#createSpan("del", ":\u00A0");
    static readonly #commaText = document.createTextNode(",");
    static readonly #doubleQuoteText = document.createTextNode('"');

    #valueNode: HTMLSpanElement;
    #viewRef = createRef<HTMLDivElement>();

    public constructor(props: IJsonViewProps) {
        super(props);

        this.addHandledProperties("json", "style");

        const value = (typeof props.json === "string" ? JSON.parse(props.json) : props.json) as JsonValue;
        this.#valueNode = this.createValueNode(value);
    }

    public override componentDidMount(): void {
        const view = this.#viewRef.current;
        if (view !== null) {
            view.appendChild(this.#valueNode);
        }
    }

    public override componentDidUpdate(previousProps: Readonly<IJsonViewProps>): void {
        if (previousProps.json !== this.props.json) {
            const { json } = this.props;

            const value = (typeof json === "string" ? JSON.parse(json) : json) as JsonValue;
            this.#valueNode = this.createValueNode(value);

            const view = this.#viewRef.current;
            if (view !== null) {
                view.innerHTML = "";
                view.appendChild(this.#valueNode);
            }
        }
    }

    public render(): ComponentChild {
        const { style } = this.props;

        const className = this.getEffectiveClassNames(["jsonView"]);
        const themeManager = ThemeManager.get;

        // Get the theme colors for JSON and store them as variables in the host CSS.
        const arrayDelimiterColor = themeManager.getTokenForegroundColor("delimiter.array.json");
        const objectDelimiterColor = themeManager.getTokenForegroundColor("delimiter.brackets.json");
        const colonDelimiterColor = themeManager.getTokenForegroundColor("delimiter.colon.json");
        const commaDelimiterColor = themeManager.getTokenForegroundColor("delimiter.comma.json");
        const keyColor = themeManager.getTokenForegroundColor("string.key.json");
        const valueColor = themeManager.getTokenForegroundColor("string.value.json");
        const keywordColor = themeManager.getTokenForegroundColor("keyword.json");

        const newStyle = {
            ...style, ...{
                /* eslint-disable @typescript-eslint/naming-convention */
                "--arrayDelimiterColor": `${(arrayDelimiterColor ?? "#FF0000")}`,
                "--objectDelimiterColor": `${(objectDelimiterColor ?? "#FF0000")}`,
                "--colonDelimiterColor": `${(colonDelimiterColor ?? "#FF0000")}`,
                "--commaDelimiterColor": `${(commaDelimiterColor ?? "#FF0000")}`,
                "--keyColor": `${(keyColor ?? "#FF0000")}`,
                "--valueColor": `${(valueColor ?? "#FF0000")}`,
                "--keywordColor": `${(keywordColor ?? "#FF0000")}`,
                /* eslint-enable @typescript-eslint/naming-convention */
            },
        };

        return (
            <div ref={this.#viewRef} className={className} style={newStyle} />
        );
    }

    private createValueNode = (value: JsonValue, keyName?: string): HTMLSpanElement => {
        const type = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;

        // Create the root node for this entry and attach a click handler for interaction.
        const entry = JsonView.#entrySpan.cloneNode(false) as HTMLSpanElement;
        entry.addEventListener("click", this.#handleEntryClick);

        // Compute and add the size information for arrays/objects.
        let collectionSize = 0;
        if (type === "object") {
            collectionSize = Object.keys(value as JsonObject).length;
        } else if (type === "array") {
            collectionSize = (value as JsonArray).length;
        }

        // Check if the collection is empty.
        let nonZeroSize = false;
        if (type === "object" || type === "array") {
            const objectValue = value as JsonObject | JsonArray;
            for (const objKey in objectValue) {
                // eslint-disable-next-line no-prototype-builtins
                if (objectValue.hasOwnProperty(objKey)) {
                    nonZeroSize = true;
                    break; // no need to keep counting; only need one
                }
            }

            if (nonZeroSize) {
                entry.appendChild(JsonView.#expSpan.cloneNode(false));
            }
        }

        // If there's a key, add that before the value.
        if (keyName !== undefined) {
            // This entry must be an object property.
            entry.classList.add("objProp");

            const keySpan = JsonView.#keySpan.cloneNode(false);

            // Escape special characters in the key name and remove quotes.
            keySpan.textContent = JSON.stringify(keyName).slice(1, -1);

            entry.appendChild(JsonView.#doubleQuoteText.cloneNode(false));
            entry.appendChild(keySpan);
            entry.appendChild(JsonView.#doubleQuoteText.cloneNode(false));
            entry.appendChild(JsonView.#colonAndSpaceSpan.cloneNode(true));
        } else {
            entry.classList.add("arrElem");
        }

        let blockInner: HTMLSpanElement;
        let childEntry: HTMLSpanElement;
        switch (type) {
            case "string": {
                // If the string is a URL, construct a link for it.
                const innerStringEl = JsonView.#stringSpan.cloneNode(false) as HTMLSpanElement;
                const stringValue = value as string;

                let escapedString = JSON.stringify(stringValue);
                escapedString = escapedString.substring(1, escapedString.length - 1); // remove outer quotes

                if (stringValue.startsWith("https://") || stringValue.startsWith("http://") || stringValue[0] === "/") {
                    const innerStringA = document.createElement("a");
                    innerStringA.href = stringValue;
                    innerStringA.innerText = escapedString;
                    innerStringEl.appendChild(innerStringA);
                } else {
                    innerStringEl.innerText = escapedString;
                }

                entry.appendChild(JsonView.#doubleQuoteText.cloneNode(false));
                entry.appendChild(innerStringEl);
                entry.appendChild(JsonView.#doubleQuoteText.cloneNode(false));

                break;
            }

            case "number": {
                const valueElement = JsonView.#numberSpan.cloneNode(false) as HTMLSpanElement;
                valueElement.innerText = String(value);
                entry.appendChild(valueElement);

                break;
            }

            case "object": {
                entry.appendChild(JsonView.#openObjectSpan.cloneNode(true));

                // Recursively add child nodes.
                if (nonZeroSize) {
                    // The ellipsis is only visible when the node is collapsed.
                    entry.appendChild(JsonView.#ellipsisSpan.cloneNode(false));

                    // The inner block is where indentation is applied on.
                    blockInner = JsonView.#blockInnerSpan.cloneNode(false) as HTMLSpanElement;

                    const objectValue = value as JsonObject;
                    let lastComma;
                    let childEntry;
                    for (const k in objectValue) {
                        childEntry = this.createValueNode(objectValue[k], k);
                        const comma = JsonView.#commaText.cloneNode();
                        childEntry.appendChild(comma);
                        blockInner.appendChild(childEntry);
                        lastComma = comma;
                    }

                    if (childEntry !== undefined && lastComma !== undefined) {
                        childEntry.removeChild(lastComma);
                    }

                    entry.appendChild(blockInner);
                }

                entry.appendChild(JsonView.#closeObjectSpan.cloneNode(true));
                entry.dataset.size = ` // ${collectionSize} ${collectionSize === 1 ? "item" : "items"}`;

                break;
            }

            case "boolean": {
                if (value) {
                    entry.appendChild(JsonView.#trueSpan.cloneNode(true));
                } else {
                    entry.appendChild(JsonView.#falseSpan.cloneNode(true));
                }

                break;
            }

            case "array": {
                const arrayValue = value as JsonArray;
                entry.appendChild(JsonView.#openArraySpan.cloneNode(true));

                // Recursively add child nodes.
                if (nonZeroSize) {
                    entry.appendChild(JsonView.#ellipsisSpan.cloneNode(false));
                    blockInner = JsonView.#blockInnerSpan.cloneNode(false) as HTMLSpanElement;

                    for (let i = 0, length = arrayValue.length, lastIndex = length - 1; i < length; i++) {
                        childEntry = this.createValueNode(arrayValue[i]);
                        if (i < lastIndex) {
                            const comma = JsonView.#commaText.cloneNode();
                            childEntry.appendChild(comma);
                        }

                        blockInner.appendChild(childEntry);
                    }

                    entry.appendChild(blockInner);
                }

                entry.appendChild(JsonView.#closeArraySpan.cloneNode(true));
                entry.dataset.size = ` // ${collectionSize} ${collectionSize === 1 ? "item" : "items"}`;

                break;
            }

            case "null": {
                // Must be null then.
                entry.appendChild(JsonView.#nullSpan.cloneNode(true));

                break;
            }

            default:
        }

        return entry;
    };

    /**
     * Creates a span element by cloning our base span and assigning a class name (and potential content).
     *
     * @param className The class name to assign to the span.
     * @param textContent The text content to assign to the span.
     *
     * @returns A new span element.
     */
    static #createSpan(className: string, textContent?: string) {
        const span = this.#span.cloneNode(false) as HTMLSpanElement;
        span.className = className;
        if (textContent) {
            span.textContent = textContent;
        }

        return span;
    }

    /**
     * Used to handle mouse clicks on the entries. If there's a selection, the click is ignored, to avoid
     * toggling the expand state when the user stops selecting text.
     *
     * @param event The mouse event.
     */
    #handleEntryClick = (event: MouseEvent) => {
        const selection = window.getSelection();
        if (selection?.type === "Range") {
            // Don't toggle if there's a selection.
            return;
        }

        let target = event.target as HTMLElement;
        if (!target.classList.contains("entry")) {
            target = target.parentElement as HTMLElement;
        }

        if (target.classList.contains("entry")) {
            // Toggle the expanded state
            target.classList.toggle("collapsed");

            if (event.altKey) {
                // Set all siblings to the same expand state.
                const siblings = target.parentElement?.children;
                if (siblings) {
                    for (const sibling of siblings) {
                        if (sibling !== target) {
                            sibling.classList.toggle("collapsed", target.classList.contains("collapsed"));
                        }
                    }
                }
            }

            event.stopPropagation();
        }
    };
}
