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

import { Component, ComponentChildren, VNode } from "preact";
import { requisitions } from "../../supplement/Requisitions.js";
import "./LogBox.css";

interface ILogBoxProps {
    height: string | number;
    title: string;
    collapsedText: string;
}

interface ILogBoxState {
    isExpanded: boolean;
    copyCaption: string;
}

export class LogBox extends Component<ILogBoxProps, ILogBoxState> {
    public constructor(props: ILogBoxProps) {
        super(props);
        this.state = { isExpanded: false, copyCaption: "Copy" };
    }

    public override render(): VNode {
        const { height, children, title, collapsedText } = this.props;
        const { isExpanded, copyCaption } = this.state;

        return (
            <div className="log-box-container">
                <div className="log-box-header">
                    <button
                        className="log-box-toggle"
                        onClick={this.toggleExpand.bind(this)}
                        aria-expanded={isExpanded}
                        aria-controls="log-box-content"
                    >
                        <span className={`codicon codicon-chevron-${isExpanded ? "down" : "right"}`} aria-hidden="true">
                        </span>
                        <span className="log-box-caption">{title}</span>
                    </button>
                    <button
                        className="log-box-copy-btn"
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering toggleExpand
                            this.copyToClipboard();
                        }}
                        title="Copy log content to clipboard"
                    >
                        <span aria-hidden="true">{copyCaption}</span>
                    </button>
                </div>
                <div
                    id="log-box-content"
                    className={`log-box ${isExpanded ? "" : "collapsed"}`}
                    style={{
                        height: isExpanded
                            ? typeof height === "number"
                                ? `${height}px`
                                : height
                            : "20px",
                    }}
                >
                    {isExpanded ? this.processContent(children) : collapsedText}
                </div>
            </div>
        );
    }

    private processContent(children: ComponentChildren): ComponentChildren {
        if (typeof children === "string") {
            const lines = children.split("\n");
            const processedLines = lines.map((line, index) => {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith("ERROR")) {
                    return <div key={index} className="log-entry" dangerouslySetInnerHTML={{
                        __html: line.replace(/^ERROR/, "<span class=\"log-error\">ERROR</span>")
                    }} />;
                } else if (trimmedLine.startsWith("WARNING")) {
                    return <div key={index} className="log-entry" dangerouslySetInnerHTML={{
                        __html: line.replace(/^WARNING/, "<span class=\"log-warning\">WARNING</span>")
                    }} />;
                } else if (trimmedLine.startsWith("NOTE")) {
                    return <div key={index} className="log-entry" dangerouslySetInnerHTML={{
                        __html: line.replace(/^NOTE/, "<span class=\"log-note\">NOTE</span>")
                    }} />;
                }

                return <div key={index} className="log-entry">{line}</div>;
            });

            return processedLines;
        } else if (Array.isArray(children)) {
            return children.map(child => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                return this.processContent(child);
            }) as VNode[];
        }

        return children;
    }

    private toggleExpand() {
        this.setState({ isExpanded: !this.state.isExpanded });
    }

    private copyToClipboard() {
        const baseElement = this.base as HTMLElement | null;
        const logContentElement = baseElement?.querySelector("#log-box-content") as HTMLElement | null;
        const logContent = logContentElement?.textContent ?? "";

        try {
            requisitions.writeToClipboard(logContent);

            this.setState({ copyCaption: "Copied" });
            setTimeout(() => {
                this.setState({ copyCaption: "Copy" });
            }, 2000); // Reset after 2 seconds
        } catch {
            this.setState({ copyCaption: "Failed to copy" });
            setTimeout(() => {
                this.setState({ copyCaption: "Copy" });
            }, 2000);

        }
    }
}

