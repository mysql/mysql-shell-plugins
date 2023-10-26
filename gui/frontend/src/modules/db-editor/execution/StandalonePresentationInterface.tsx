/*
 * Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

import { ComponentChild } from "preact";

import { PresentationInterface } from "../../../script-execution/PresentationInterface.js";
import { EditorLanguage } from "../../../supplement/index.js";
import { ScriptEditor } from "../ScriptEditor.js";
import { Monaco } from "../../../components/ui/CodeEditor/index.js";

/** Handling of UI related tasks in a code editor for standalone contexts. */
export class StandalonePresentationInterface extends PresentationInterface {

    private resizeObserver?: ResizeObserver;

    public constructor(
        private host: ScriptEditor,
        editor: Partial<Monaco.IStandaloneCodeEditor>,
        language: EditorLanguage,
        private target: preact.RefObject<HTMLDivElement>) {
        super(editor, language);

        this.alwaysShowTab = true;
    }

    protected get resultDivider(): ComponentChild {
        return undefined;
    }

    protected removeRenderTarget(): void {
        super.removeRenderTarget();
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = undefined;
        }

        this.host.setState({ showResultPane: false });
    }

    protected updateRenderTarget(height?: number): void {
        super.updateRenderTarget(height);

        if (height !== undefined) {
            this.currentHeight = height;
        }

        this.host.setState({
            showResultPane: true,
            maximizeResultPane: this.maximizedResult ?? false,
        });
    }

    protected defineRenderTarget(): HTMLDivElement {
        const target = this.target.current;
        if (!target) {
            return document.createElement("div");
        }

        // istanbul ignore next
        if (typeof ResizeObserver !== "undefined") {
            this.resizeObserver = new ResizeObserver((entries) => {
                const last = entries.pop();
                if (last && !this.currentHeight) {
                    const maxAutoHeight = PresentationInterface.maxAutoHeight[this.resultData?.type ?? "text"];
                    const height = Math.min(last.borderBoxSize[0].blockSize, maxAutoHeight);
                    if (target.clientHeight > maxAutoHeight) {
                        target.style.height = `${height}px`;
                    }
                    this.currentHeight = height;
                }
            });
            this.resizeObserver.observe(target);
        }

        this.host.setState({
            showResultPane: true,
            maximizeResultPane: this.maximizedResult ?? false,
        });

        return this.target.current!;
    }

    protected override get hideTabs(): "always" | "single" | "never" {
        return this.maximizedResult ? "always" : "never";
    }
}
