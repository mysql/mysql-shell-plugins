/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import "./FileViewer.css";

import { Component, ComponentChild, createRef } from "preact";

import { ThemeManager } from "../../Theming/ThemeManager.js";
import { Button } from "../Button/Button.js";
import { Codicon } from "../Codicon.js";
import { Icon } from "../Icon/Icon.js";
import { Search, type ISearchProperties, type ISearchValues } from "../Search/Search.js";

const maximumVisibleLogBytes = 1024 * 1024;

export interface IFileViewerReadRequest {
    maxBytes?: number;
    offset?: number;
    readMode?: "range" | "tail";
}

export interface IFileViewerReadResult {
    content?: string;
    error?: string;
    fileName?: string;
    filePath?: string;
    offset?: number;
    size?: number;
    truncated?: boolean;
}

export interface IFileViewerBridge {
    read: (request?: IFileViewerReadRequest) => Promise<IFileViewerReadResult>;
    browse: () => Promise<boolean>;
}

declare global {
    interface Window {
        fileViewer?: IFileViewerBridge;
    }
}

interface IFileViewerState {
    canLoadEarlier: boolean;
    content: string;
    isLoading: boolean;
    query: string;
    status: string;
    wrapLines: boolean;
}

export class FileViewer extends Component<{}, IFileViewerState> {

    private contentRef = createRef<HTMLTextAreaElement>();
    private fileStatus = "";
    private lastMatchIndex = -1;
    private lastReadOffset = 0;
    private lastReadSize: number | undefined;
    private readInProgress = false;

    public constructor(props: {}) {
        super(props);

        this.state = {
            canLoadEarlier: false,
            content: "",
            isLoading: false,
            query: "",
            status: "",
            wrapLines: false,
        };
    }

    public override componentDidMount(): void {
        void ThemeManager.get;

        document.body.classList.add("fileViewerBody");
        document.getElementById("root")?.classList.add("fileViewerRoot");

        void this.reload(true, {
            maxBytes: maximumVisibleLogBytes,
        });
    }

    public override componentWillUnmount(): void {
        document.body.classList.remove("fileViewerBody");
        document.getElementById("root")?.classList.remove("fileViewerRoot");
    }

    public render(): ComponentChild {
        const { canLoadEarlier, content, isLoading, query, status, wrapLines } = this.state;

        return (
            <div className="msg fileViewer">
                <div className="fileViewerToolbar">
                    <div className="fileViewerSearchControls">
                        <Search
                            className="fileViewerSearch"
                            placeholder="Search"
                            values={{ value: query }}
                            onChange={this.handleSearchChange}
                            onConfirm={this.handleSearchConfirm}
                        />
                        <Button
                            className="fileViewerIconButton"
                            imageOnly={true}
                            title="Search"
                            onClick={this.handleSearchConfirm}
                        >
                            <Icon src={Codicon.Search} />
                        </Button>
                    </div>
                    <div className="fileViewerActions">
                        <Button
                            className="fileViewerIconButton"
                            disabled={isLoading || !canLoadEarlier}
                            imageOnly={true}
                            title="Load Earlier"
                            onClick={this.handleLoadEarlier}
                        >
                            <Icon src={Codicon.ArrowUp} />
                        </Button>
                        <Button
                            className="fileViewerIconButton"
                            disabled={isLoading}
                            imageOnly={true}
                            title="Refresh"
                            onClick={this.handleRefresh}
                        >
                            <Icon src={Codicon.Refresh} />
                        </Button>
                        <Button
                            className={wrapLines
                                ? "fileViewerIconButton fileViewerIconToggle active"
                                : "fileViewerIconButton fileViewerIconToggle"}
                            imageOnly={true}
                            title="Toggle Line Wrap"
                            onClick={this.handleToggleWrap}
                        >
                            <Icon src={Codicon.WordWrap} />
                        </Button>
                        <Button
                            className="fileViewerIconButton"
                            imageOnly={true}
                            title="Show in Folder"
                            onClick={this.handleBrowse}
                        >
                            <Icon src={Codicon.GoToFile} />
                        </Button>
                    </div>
                </div>
                <textarea
                    ref={this.contentRef}
                    className={wrapLines ? "fileViewerContent fixedScrollbar wrap" : "fileViewerContent fixedScrollbar"}
                    value={content}
                    readOnly={true}
                    spellcheck={false}
                />
                <div className="fileViewerStatus">
                    {status}
                </div>
            </div>
        );
    }

    private refresh = async (): Promise<void> => {
        return this.reload(true, {
            maxBytes: maximumVisibleLogBytes,
            offset: this.lastReadSize,
        }, this.lastReadSize);
    };

    private reload = async (
        forceScrollToBottom: boolean,
        request: IFileViewerReadRequest,
        appendOffset?: number,
    ): Promise<void> => {
        if (this.readInProgress) {
            return;
        }

        this.readInProgress = true;
        this.setState({ isLoading: true, status: "Loading..." });

        const result = await this.readFile(request);
        if (result.error) {
            this.fileStatus = "";
            this.lastMatchIndex = -1;
            this.lastReadOffset = 0;
            this.lastReadSize = undefined;
            this.readInProgress = false;
            this.setState({
                canLoadEarlier: false,
                content: "",
                isLoading: false,
                status: result.error,
            });

            return;
        }

        const size = result.size ?? 0;
        const offset = result.offset ?? 0;
        const appendToCurrentContent = appendOffset !== undefined && offset === appendOffset;
        const content = appendToCurrentContent
            ? `${this.state.content}${result.content ?? ""}`
            : result.content ?? "";
        this.lastReadOffset = appendToCurrentContent ? this.lastReadOffset : offset;
        this.lastReadSize = size;
        this.fileStatus = this.formatFileStatus(size, this.lastReadOffset);
        document.title = result.fileName ?? "File Viewer";
        this.readInProgress = false;

        this.setState({
            canLoadEarlier: this.lastReadOffset > 0,
            content,
            isLoading: false,
            status: this.fileStatus,
        }, () => {
            if (forceScrollToBottom) {
                this.lastMatchIndex = -1;
                this.setState({ status: this.fileStatus });
                this.scrollToBottom();

                return;
            }

            this.selectMatch(0);
        });
    };

    private handleRefresh = (): void => {
        void this.refresh();
    };

    private handleLoadEarlier = (): void => {
        void this.loadEarlier();
    };

    private handleBrowse = (): void => {
        void window.fileViewer?.browse();
    };

    private handleToggleWrap = (): void => {
        this.setState(({ wrapLines }) => {
            return { wrapLines: !wrapLines };
        });
    };

    private loadEarlier = async (): Promise<void> => {
        if (this.readInProgress || this.lastReadOffset <= 0) {
            return;
        }

        const contentElement = this.contentRef.current;
        const previousScrollHeight = contentElement?.scrollHeight ?? 0;
        const previousScrollTop = contentElement?.scrollTop ?? 0;
        const requestedOffset = Math.max(0, this.lastReadOffset - maximumVisibleLogBytes);
        const requestedLength = this.lastReadOffset - requestedOffset;

        this.readInProgress = true;
        this.setState({ isLoading: true, status: "Loading..." });

        const result = await this.readFile({
            maxBytes: requestedLength,
            offset: requestedOffset,
            readMode: "range",
        });
        if (result.error) {
            this.readInProgress = false;
            this.setState({
                isLoading: false,
                status: result.error,
            });

            return;
        }

        this.lastMatchIndex = -1;
        if (this.lastReadSize !== undefined && (result.size ?? 0) < this.lastReadSize) {
            this.readInProgress = false;

            return this.reload(true, {
                maxBytes: maximumVisibleLogBytes,
            });
        }

        this.lastReadOffset = result.offset ?? requestedOffset;
        this.fileStatus = this.formatFileStatus(this.lastReadSize ?? 0, this.lastReadOffset);
        this.readInProgress = false;

        this.setState(({ content }) => {
            return {
                canLoadEarlier: this.lastReadOffset > 0,
                content: `${result.content ?? ""}${content}`,
                isLoading: false,
                status: this.fileStatus,
            };
        }, () => {
            if (!contentElement) {
                return;
            }

            contentElement.scrollTop = previousScrollTop
                + Math.max(0, contentElement.scrollHeight - previousScrollHeight);
        });
    };

    private readFile = async (request: IFileViewerReadRequest): Promise<IFileViewerReadResult> => {
        try {
            return await window.fileViewer?.read(request) ?? { error: "Unable to read file." };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            return { error: message || "Unable to read file." };
        }
    };

    private handleSearchChange = (
        _event: UIEvent,
        _props: ISearchProperties,
        values: ISearchValues,
    ): void => {
        this.lastMatchIndex = -1;
        this.setState({
            query: values.value ?? "",
            status: this.fileStatus,
        });
    };

    private handleSearchConfirm = (): void => {
        const { query } = this.state;
        const startIndex = this.lastMatchIndex < 0
            ? 0
            : this.lastMatchIndex + Math.max(1, query.length);
        this.selectMatch(startIndex);
    };

    private selectMatch(startIndex: number): void {
        const { content, query } = this.state;
        const contentElement = this.contentRef.current;
        if (!contentElement) {
            return;
        }

        if (!query) {
            this.lastMatchIndex = -1;
            this.setState({ status: this.fileStatus });
            this.scrollToBottom();

            return;
        }

        const haystack = content.toLocaleLowerCase();
        const needle = query.toLocaleLowerCase();
        let matchIndex = haystack.indexOf(needle, Math.max(0, startIndex));
        if (matchIndex < 0 && startIndex > 0) {
            matchIndex = haystack.indexOf(needle, 0);
        }

        if (matchIndex < 0) {
            this.lastMatchIndex = -1;
            this.setState({ status: "No matches" });

            return;
        }

        this.lastMatchIndex = matchIndex;
        this.setState({ status: `Match at character ${matchIndex + 1}` }, () => {
            contentElement.focus();
            contentElement.setSelectionRange(matchIndex, matchIndex + query.length);
            this.scrollMatchIntoView(matchIndex);
        });
    }

    private scrollMatchIntoView(matchIndex: number): void {
        const contentElement = this.contentRef.current;
        if (!contentElement) {
            return;
        }

        const lineIndex = this.state.content.slice(0, matchIndex).split("\n").length - 1;
        const computedStyle = getComputedStyle(contentElement);
        const fontSize = parseFloat(computedStyle.fontSize) || 12;
        const lineHeight = parseFloat(computedStyle.lineHeight) || fontSize * 1.45;
        contentElement.scrollTop = Math.max(0, (lineIndex - 2) * lineHeight);
    }

    private scrollToBottom(): void {
        const contentElement = this.contentRef.current;
        if (!contentElement) {
            return;
        }

        contentElement.focus();
        const endOffset = contentElement.value.length;
        contentElement.setSelectionRange(endOffset, endOffset);
        contentElement.scrollTop = contentElement.scrollHeight;
    }

    private formatBytes(bytes: number): string {
        if (bytes < 1024) {
            return `${bytes} B`;
        }
        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }

        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    private formatFileStatus(size: number, offset: number): string {
        if (offset > 0) {
            return `Showing last ${this.formatBytes(size - offset)} of ${this.formatBytes(size)}`;
        }

        return `${this.formatBytes(size)} loaded`;
    }

}
