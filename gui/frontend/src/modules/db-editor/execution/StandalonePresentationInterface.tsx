/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

import { CodeEditor } from "../../../components/ui/CodeEditor/CodeEditor";
import { PresentationInterface } from "../../../script-execution/PresentationInterface";
import { EditorLanguage } from "../../../supplement";
import { StandaloneScriptEditor } from "../StandaloneScriptEditor";

// Handling of UI related tasks in a code editor for standalone contexts.
export class StandalonePresentationInterface extends PresentationInterface {

    public constructor(
        private host: StandaloneScriptEditor,
        editor: CodeEditor,
        language: EditorLanguage,
        private target: React.RefObject<HTMLDivElement>) {
        super(editor, language);
    }

    protected get resultDivider(): React.ReactNode {
        return undefined;
    }

    protected removeRenderTarget(): void {
        this.host.setState({ showResultPane: false });
    }

    protected updateRenderTarget(): void {
        this.host.setState({
            showResultPane: true,
            maximizeResultPane: this.maximizedResult ?? false,
        });
    }

    protected defineRenderTarget(): HTMLDivElement {
        this.host.setState({
            showResultPane: true,
            maximizeResultPane: this.maximizedResult ?? false,
        });

        return this.target.current!;
    }
}

