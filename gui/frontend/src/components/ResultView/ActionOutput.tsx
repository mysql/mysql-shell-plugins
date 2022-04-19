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

import React from "react";

import { Monaco } from "../ui/CodeEditor";
import { Label, Component, IComponentProperties, Orientation, Container } from "../ui";
import { ResultStatus } from ".";
import { CodeEditor } from "../ui/CodeEditor/CodeEditor";
import { ResultTextLanguage } from "./";
import { IExecutionInfo } from "../../app-logic/Types";

interface IActionOutputProperties extends IComponentProperties {
    text: string;
    language?: ResultTextLanguage;

    executionInfo?: IExecutionInfo; // The status message to show. Can also be an error messages.
}

// A component to render a given text with syntax highlighting (depending on the given language).
export class ActionOutput extends Component<IActionOutputProperties> {

    private labelRef = React.createRef<HTMLLabelElement>();

    public constructor(props: IActionOutputProperties) {
        super(props);

        this.addHandledProperties("text", "language", "isError", "executionInfo");
    }

    public componentDidMount(): void {
        this.colorize();
    }

    public componentDidUpdate(): void {
        this.colorize();
    }

    public render(): React.ReactNode {
        const { text, language, executionInfo } = this.props;
        const className = this.getEffectiveClassNames(["resultText"]);

        return (
            <Container
                orientation={Orientation.TopDown}
                className={className}
            >
                <Label
                    innerRef={this.labelRef}
                    data-lang={language}
                    caption={text}
                    data-tooltip=""
                />
                {executionInfo && <ResultStatus executionInfo={executionInfo} />}

            </Container>
        );
    }

    /**
     * Uses Monaco to convert text into colorized tokens, depending on the language property.
     */
    private colorize(): void {
        /* istanbul ignore next */
        if (!this.labelRef?.current) {
            return;
        }

        const { language } = this.props;

        if (language && language !== "ansi") {
            void Monaco.colorizeElement(this.labelRef?.current, {
                theme: CodeEditor.currentThemeId,
            });
        }
    }
}
