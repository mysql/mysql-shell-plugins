/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

import "./Label.css";

import React from "react";
import Ansi from "ansi-to-react";

import { IComponentProperties, Component } from "../Component/Component";
import { Container, Orientation } from "..";
import { EditorLanguage } from "../../../supplement";
import { Monaco } from "../CodeEditor";
import { CodeEditor } from "../CodeEditor/CodeEditor";
import { MessageType } from "../../../app-logic/Types";

// Semantically the same as ContentAlignment, but needs different values.
export enum TextAlignment {
    Start = "start",
    Center = "center",
    End = "end",
}

export interface ILabelProperties extends IComponentProperties {
    caption?: string;
    textAlignment?: TextAlignment;
    quoted?: boolean;
    code?: boolean;
    heading?: boolean; // When set renders the text with larger font and the caption color.

    language?: EditorLanguage | "ansi";
    type?: MessageType;

    innerRef?: React.RefObject<HTMLLabelElement>;
}

export class Label extends Component<ILabelProperties> {

    private labelRef: React.RefObject<HTMLLabelElement>;

    public constructor(props: ILabelProperties) {
        super(props);

        this.labelRef = props.innerRef ?? React.createRef<HTMLLabelElement>();

        this.addHandledProperties("caption", "textAlignment", "quoted", "code", "heading", "innerRef", "dataId");
    }

    public componentDidMount(): void {
        this.colorizeText();
    }

    public componentDidUpdate(): void {
        this.colorizeText();
    }

    public render(): React.ReactNode {
        const { children, caption, textAlignment, quoted, code, heading, language, type } = this.mergedProps;

        const content = caption || children;
        if (language === "ansi") {
            const className = this.getEffectiveClassNames([
                "resultText",
                this.classFromProperty(type, ["error", "warning", "info", "interactive", "response"]),
            ]);

            return (
                <Container
                    orientation={Orientation.TopDown}
                    className={className}
                    {...this.unhandledProperties}
                >
                    <Ansi useClasses>{caption}</Ansi>
                </Container >
            );
        } else {
            const className = this.getEffectiveClassNames([
                "label",
                this.classFromProperty(quoted, "quote"),
                this.classFromProperty(code, "code"),
                this.classFromProperty(heading, "heading"),
            ]);
            // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-explicit-any
            const ElementType: any = this.renderAs("label");

            return (
                <ElementType
                    ref={this.labelRef}
                    className={className}
                    data-tooltip="expand"
                    data-lang={language}
                    style={{ textAlign: textAlignment }}
                    {...this.unhandledProperties}
                >
                    {content}
                </ElementType>
            );
        }
    }

    private colorizeText() {
        const { language } = this.props;

        if (language && language !== "ansi" && language !== "text" && this.labelRef.current) {
            void Monaco.colorizeElement(this.labelRef.current as HTMLElement, {
                theme: CodeEditor.currentThemeId,
                tabSize: 4,
            });
        }
    }

}
