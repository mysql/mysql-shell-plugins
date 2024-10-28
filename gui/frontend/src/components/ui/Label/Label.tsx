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

import "./Label.css";

import { ComponentChild, ComponentChildren, createRef } from "preact";
import { CSSProperties } from "preact/compat";

import Anser from "anser";
import { editor as Monaco } from "monaco-editor/esm/vs/editor/editor.api.js";

import { IComponentProperties, ComponentBase, IComponentState } from "../Component/ComponentBase.js";
import { EditorLanguage } from "../../../supplement/index.js";
import { MessageType } from "../../../app-logic/general-types.js";
import { ThemeManager } from "../../Theming/ThemeManager.js";

/** Semantically the same as ContentAlignment, but needs different values. */
export enum TextAlignment {
    Start = "start",
    Center = "center",
    End = "end",
}

export interface ILabelProperties extends IComponentProperties {
    /** The content of the label. Can alternatively be set via the children. This property takes precedence, though. */
    caption?: string;

    /** Determines the normal HTML alignment of the text content. Not used for `ansi`. */
    textAlignment?: TextAlignment;

    /** When set this formats the text into a emphasized block, which stands out in normal text flow. */
    quoted?: boolean;

    /**
     * When set to true then the text is rendered like a block of code (fixed width font with the theme code
     * text colors).
     */
    code?: boolean;

    /** When set renders the text with larger font and the caption color. */
    heading?: boolean;

    /** Any language supported by Monaco (which is used to colorize the text) or `ansi` for special output. */
    language?: EditorLanguage | "ansi";

    /** When set applies special colors to the text. This should be used only with plain text. */
    type?: MessageType;

    /** When set to true the text will wrap. */
    wrap?: boolean;

    /** An optional reference object to hold the ref to the generated HTML element. */
    innerRef?: preact.RefObject<HTMLLabelElement>;
}

interface ILabelState extends IComponentState {
    labelEntries?: ComponentChildren;
}

export class Label extends ComponentBase<ILabelProperties, ILabelState> {

    private labelRef: preact.RefObject<HTMLLabelElement>;

    public constructor(props: ILabelProperties) {
        super(props);

        this.state = {};
        this.labelRef = props.innerRef ?? createRef<HTMLLabelElement>();
        this.addHandledProperties("caption", "textAlignment", "quoted", "code", "heading", "language", "type", "wrap",
            "innerRef");
    }

    public override componentDidMount(): void {
        this.updateComputedOutput();
    }

    public override componentDidUpdate(prevProps: ILabelProperties): void {
        const { caption, children } = this.props;
        if (caption !== prevProps.caption || children !== prevProps.children) {
            this.updateComputedOutput();
        }
    }

    public render(): ComponentChild {
        const {
            children, caption, textAlignment, quoted, code, heading, language, type, style, wrap,
        } = this.props;
        const { labelEntries } = this.state;

        const actualStyle = { ...style };
        if (textAlignment) {
            actualStyle.textAlign = textAlignment;
        }

        const content = caption || children;
        if (language === "ansi" && labelEntries) {
            const className = this.getEffectiveClassNames([
                "resultText",
                this.classFromProperty(type, ["error", "warning", "info", "text", "response", "success"]),
                this.classFromProperty(quoted, "quote"),
                this.classFromProperty(code, "code"),
                this.classFromProperty(heading, "heading"),
                this.classFromProperty(wrap, "wrap"),
            ]);

            return (
                <label
                    ref={this.labelRef}
                    className={className}
                    data-tooltip="expand"
                    style={actualStyle}
                    {...this.unhandledProperties}
                >
                    {labelEntries}
                </label>
            );
        } else {
            const className = this.getEffectiveClassNames([
                "label",
                this.classFromProperty(type, ["error", "warning", "info", "text", "response"]),
                this.classFromProperty(quoted, "quote"),
                this.classFromProperty(code, "code"),
                this.classFromProperty(heading, "heading"),
                this.classFromProperty(wrap, "wrap"),
            ]);

            return (
                <label
                    ref={this.labelRef}
                    className={className}
                    data-tooltip="expand"
                    data-lang={language}
                    style={actualStyle}
                    {...this.unhandledProperties}
                >
                    {content}
                </label>
            );
        }
    }

    /**
     * Applies styling to the content of this label, by converting it to a set of sub entries, each with its own
     * style. This feature depends on the set language of the label. If no language is set or the language is set
     * to "text" then no styling is applied.
     */
    private updateComputedOutput() {
        const { caption, children, language } = this.props;

        if (language === "ansi") {
            const content = caption || children;

            const list = Anser.ansiToJson(String(content));
            const labelEntries = list.map((value, index) => {
                const style: CSSProperties = {
                    color: value.fg ? `rgba(${value.fg})` : undefined,
                    backgroundColor: value.bg ? `rgba(${value.bg})` : undefined,
                };

                const fontStyles = new Set<string>();
                const decorations = new Set<string>();
                const classNames = new Set<string>();
                value.decorations.forEach((decoration) => {
                    switch (decoration) {
                        case "bold": {
                            style.fontWeight = "bold";
                            classNames.add("ansi-bold");
                            break;
                        }

                        case "italic": {
                            fontStyles.add("italic");
                            break;
                        }

                        case "underline": {
                            decorations.add("underline");
                            break;
                        }

                        case "hidden": {
                            style.display = "none";
                            break;
                        }

                        case "strikethrough": {
                            decorations.add("line-through");

                            break;
                        }

                        case "reverse": {
                            const temp = style.color;
                            style.color = style.backgroundColor;
                            style.backgroundColor = temp;
                            break;
                        }

                        case "blink": {
                            classNames.add("blink");
                            break;
                        }

                        default:
                    }
                });

                if (fontStyles.size > 0) {
                    style.fontStyle = [...fontStyles].join(" ");
                }

                if (decorations.size > 0) {
                    style.textDecoration = [...decorations].join(" ");
                }

                let className = "";
                if (classNames.size > 0) {
                    className = [...classNames].join(" ");
                }

                return (
                    <span
                        key={index}
                        className={className ? className : undefined}
                        style={style}
                    >
                        {value.content}
                    </span >
                );
            });
            this.setState({ labelEntries });
        } else if (language && language !== "text" && this.labelRef.current) {
            void Monaco.colorizeElement(this.labelRef.current, {
                theme: ThemeManager.get.activeThemeSafe,
                tabSize: 4,
            }).then(() => {
                const lastChild = this.labelRef.current?.lastChild;
                if (lastChild instanceof HTMLElement && lastChild.tagName === "BR") {
                    lastChild.remove();
                }
            });
        }
    }

}
