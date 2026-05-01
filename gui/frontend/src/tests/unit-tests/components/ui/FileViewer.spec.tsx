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

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    FileViewer, type IFileViewerReadRequest, type IFileViewerReadResult,
} from "../../../../components/ui/FileViewer/FileViewer.js";

const maximumVisibleLogBytes = 1024 * 1024;

const queryElement = <T extends Element>(container: Element, selector: string): T => {
    const element = container.querySelector<T>(selector);
    expect(element).not.toBeNull();

    return element!;
};

const renderFileViewer = () => {
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);

    return {
        root,
        ...render(<FileViewer />, { container: root }),
    };
};

describe("FileViewer component tests", () => {
    afterEach(() => {
        cleanup();
        delete window.fileViewer;
        document.body.className = "";
        document.body.innerHTML = "";
        document.title = "";
    });

    it("loads file content and supports the toolbar actions", async () => {
        const firstContent = "alpha\nbeta alpha";
        const read = vi.fn()
            .mockResolvedValueOnce({
                content: firstContent,
                fileName: "mysqlsh.log",
                offset: 0,
                size: firstContent.length,
            })
            .mockResolvedValueOnce({
                content: "\ngamma",
                fileName: "mysqlsh.log",
                offset: firstContent.length,
                size: firstContent.length + 6,
            });
        const browse = vi.fn().mockResolvedValue(true);
        window.fileViewer = { browse, read };

        const { container, root } = renderFileViewer();
        const content = queryElement<HTMLTextAreaElement>(container, ".fileViewerContent");
        const status = queryElement<HTMLDivElement>(container, ".fileViewerStatus");

        await waitFor(() => {
            expect(content.value).toBe(firstContent);
        });
        expect(read).toHaveBeenNthCalledWith(1, { maxBytes: maximumVisibleLogBytes });
        expect(status.textContent?.trim()).toBe(`${firstContent.length} B loaded`);
        expect(document.title).toBe("mysqlsh.log");
        expect(document.body.classList.contains("fileViewerBody")).toBe(true);
        expect(root.classList.contains("fileViewerRoot")).toBe(true);

        const search = screen.getByPlaceholderText("Search");
        fireEvent.input(search, { target: { value: "alpha" } });
        expect(status.textContent?.trim()).toBe(`${firstContent.length} B loaded`);

        fireEvent.keyDown(search, { key: "Enter" });
        await waitFor(() => {
            expect(status.textContent?.trim()).toBe("Match at character 1");
        });
        expect(content.selectionStart).toBe(0);
        expect(content.selectionEnd).toBe(5);

        fireEvent.click(container.querySelector("[title='Search']")!);
        await waitFor(() => {
            expect(status.textContent?.trim()).toBe("Match at character 12");
        });
        expect(content.selectionStart).toBe(11);
        expect(content.selectionEnd).toBe(16);

        fireEvent.keyDown(search, { key: "Enter" });
        await waitFor(() => {
            expect(status.textContent?.trim()).toBe("Match at character 1");
        });
        expect(content.selectionStart).toBe(0);
        expect(content.selectionEnd).toBe(5);

        fireEvent.input(search, { target: { value: "missing" } });
        expect(status.textContent?.trim()).toBe(`${firstContent.length} B loaded`);

        fireEvent.click(container.querySelector("[title='Search']")!);
        await waitFor(() => {
            expect(status.textContent?.trim()).toBe("No matches");
        });

        fireEvent.click(container.querySelector("[title='Toggle Line Wrap']")!);
        await waitFor(() => {
            expect(content.classList.contains("wrap")).toBe(true);
        });

        fireEvent.click(container.querySelector("[title='Show in Folder']")!);
        expect(browse).toHaveBeenCalledOnce();

        fireEvent.click(container.querySelector("[title='Refresh']")!);
        await waitFor(() => {
            expect(content.value).toBe(`${firstContent}\ngamma`);
        });
        expect(read).toHaveBeenNthCalledWith(2, {
            maxBytes: maximumVisibleLogBytes,
            offset: firstContent.length,
        });
    });

    it("replaces content on refresh when the file was truncated or rotated", async () => {
        const read = vi.fn()
            .mockResolvedValueOnce({
                content: "old tail",
                fileName: "mysqlsh.log",
                offset: 100,
                size: 108,
            })
            .mockResolvedValueOnce({
                content: "new file",
                fileName: "mysqlsh.log",
                offset: 0,
                size: 8,
            });
        window.fileViewer = {
            browse: vi.fn().mockResolvedValue(false),
            read,
        };

        const { container } = renderFileViewer();
        const content = queryElement<HTMLTextAreaElement>(container, ".fileViewerContent");

        await waitFor(() => {
            expect(content.value).toBe("old tail");
        });

        fireEvent.click(container.querySelector("[title='Refresh']")!);

        await waitFor(() => {
            expect(content.value).toBe("new file");
        });
        expect(read).toHaveBeenNthCalledWith(2, {
            maxBytes: maximumVisibleLogBytes,
            offset: 108,
        });
    });

    it("loads missing earlier log bytes without duplicating the tail", async () => {
        const fullContent = "headtail";
        let readCount = 0;
        const read = vi.fn((request?: IFileViewerReadRequest): Promise<IFileViewerReadResult> => {
            readCount++;
            if (readCount === 1) {
                return Promise.resolve({
                    content: "tail",
                    fileName: "mysqlsh.log",
                    offset: 4,
                    size: fullContent.length,
                });
            }

            const offset = request?.offset ?? 0;
            const maxBytes = request?.maxBytes ?? maximumVisibleLogBytes;

            return Promise.resolve({
                content: fullContent.slice(offset, offset + maxBytes),
                fileName: "mysqlsh.log",
                offset,
                size: fullContent.length,
            });
        });
        window.fileViewer = {
            browse: vi.fn().mockResolvedValue(false),
            read,
        };

        const { container } = renderFileViewer();
        const content = queryElement<HTMLTextAreaElement>(container, ".fileViewerContent");
        const status = queryElement<HTMLDivElement>(container, ".fileViewerStatus");
        const loadEarlier = queryElement<HTMLElement>(container, "[title='Load Earlier']");

        await waitFor(() => {
            expect(content.value).toBe("tail");
        });
        expect(status.textContent?.trim()).toBe("Showing last 4 B of 8 B");
        expect(loadEarlier.classList.contains("disabled")).toBe(false);

        fireEvent.click(loadEarlier);

        await waitFor(() => {
            expect(content.value).toBe(fullContent);
        });
        expect(read).toHaveBeenNthCalledWith(2, {
            maxBytes: 4,
            offset: 0,
            readMode: "range",
        });
        expect(status.textContent?.trim()).toBe("8 B loaded");
        expect(loadEarlier.classList.contains("disabled")).toBe(true);
    });

    it("keeps the refresh offset when the log grows while loading earlier content", async () => {
        const read = vi.fn()
            .mockResolvedValueOnce({
                content: "tail",
                fileName: "mysqlsh.log",
                offset: 4,
                size: 8,
            })
            .mockResolvedValueOnce({
                content: "head",
                fileName: "mysqlsh.log",
                offset: 0,
                size: 11,
            })
            .mockImplementationOnce((request?: IFileViewerReadRequest) => {
                return Promise.resolve({
                    content: request?.offset === 8 ? "NEW" : "",
                    fileName: "mysqlsh.log",
                    offset: request?.offset,
                    size: 11,
                });
            });
        window.fileViewer = {
            browse: vi.fn().mockResolvedValue(false),
            read,
        };

        const { container } = renderFileViewer();
        const content = queryElement<HTMLTextAreaElement>(container, ".fileViewerContent");

        await waitFor(() => {
            expect(content.value).toBe("tail");
        });

        fireEvent.click(container.querySelector("[title='Load Earlier']")!);
        await waitFor(() => {
            expect(content.value).toBe("headtail");
        });

        fireEvent.click(container.querySelector("[title='Refresh']")!);
        await waitFor(() => {
            expect(content.value).toBe("headtailNEW");
        });
        expect(read).toHaveBeenNthCalledWith(3, {
            maxBytes: maximumVisibleLogBytes,
            offset: 8,
        });
    });

    it("ignores read actions while another read is pending", async () => {
        let resolveEarlier!: (result: IFileViewerReadResult) => void;
        const pendingEarlier = new Promise<IFileViewerReadResult>((resolve) => {
            resolveEarlier = resolve;
        });
        const read = vi.fn()
            .mockResolvedValueOnce({
                content: "tail",
                fileName: "mysqlsh.log",
                offset: 4,
                size: 8,
            })
            .mockReturnValue(pendingEarlier);
        window.fileViewer = {
            browse: vi.fn().mockResolvedValue(false),
            read,
        };

        const { container } = renderFileViewer();
        const content = queryElement<HTMLTextAreaElement>(container, ".fileViewerContent");
        const loadEarlier = queryElement<HTMLElement>(container, "[title='Load Earlier']");
        const refresh = queryElement<HTMLElement>(container, "[title='Refresh']");

        await waitFor(() => {
            expect(content.value).toBe("tail");
        });

        fireEvent.click(loadEarlier);
        fireEvent.click(loadEarlier);
        fireEvent.click(refresh);

        expect(read).toHaveBeenCalledTimes(2);

        resolveEarlier({
            content: "head",
            fileName: "mysqlsh.log",
            offset: 0,
            size: 8,
        });
        await waitFor(() => {
            expect(content.value).toBe("headtail");
        });
    });

    it("reloads the tail when the file is rotated while loading earlier content", async () => {
        const read = vi.fn()
            .mockResolvedValueOnce({
                content: "oldtail",
                fileName: "mysqlsh.log",
                offset: 4,
                size: 11,
            })
            .mockResolvedValueOnce({
                content: "",
                fileName: "mysqlsh.log",
                offset: 0,
                size: 3,
            })
            .mockResolvedValueOnce({
                content: "new",
                fileName: "mysqlsh.log",
                offset: 0,
                size: 3,
            });
        window.fileViewer = {
            browse: vi.fn().mockResolvedValue(false),
            read,
        };

        const { container } = renderFileViewer();
        const content = queryElement<HTMLTextAreaElement>(container, ".fileViewerContent");
        const status = queryElement<HTMLDivElement>(container, ".fileViewerStatus");

        await waitFor(() => {
            expect(content.value).toBe("oldtail");
        });

        fireEvent.click(container.querySelector("[title='Load Earlier']")!);

        await waitFor(() => {
            expect(content.value).toBe("new");
        });
        expect(status.textContent?.trim()).toBe("3 B loaded");
        expect(read).toHaveBeenNthCalledWith(2, {
            maxBytes: 4,
            offset: 0,
            readMode: "range",
        });
        expect(read).toHaveBeenNthCalledWith(3, {
            maxBytes: maximumVisibleLogBytes,
        });
    });

    it("continues reading after the host rejects a read request", async () => {
        const read = vi.fn()
            .mockResolvedValueOnce({
                content: "tail",
                fileName: "mysqlsh.log",
                offset: 0,
                size: 4,
            })
            .mockRejectedValueOnce(new Error("ipc failed"))
            .mockResolvedValueOnce({
                content: "new tail",
                fileName: "mysqlsh.log",
                offset: 0,
                size: 8,
            });
        window.fileViewer = {
            browse: vi.fn().mockResolvedValue(false),
            read,
        };

        const { container } = renderFileViewer();
        const content = queryElement<HTMLTextAreaElement>(container, ".fileViewerContent");
        const status = queryElement<HTMLDivElement>(container, ".fileViewerStatus");
        const refresh = queryElement<HTMLElement>(container, "[title='Refresh']");

        await waitFor(() => {
            expect(content.value).toBe("tail");
        });

        fireEvent.click(refresh);
        await waitFor(() => {
            expect(status.textContent?.trim()).toBe("ipc failed");
        });

        fireEvent.click(refresh);
        await waitFor(() => {
            expect(content.value).toBe("new tail");
        });
        expect(read).toHaveBeenCalledTimes(3);
    });

    it("scrolls the selected search match into view", async () => {
        const firstContent = `${"line\n".repeat(20)}target value\n`;
        const read = vi.fn().mockResolvedValue({
            content: firstContent,
            fileName: "mysqlsh.log",
            offset: 0,
            size: firstContent.length,
        });
        window.fileViewer = {
            browse: vi.fn().mockResolvedValue(false),
            read,
        };

        const { container } = renderFileViewer();
        const content = queryElement<HTMLTextAreaElement>(container, ".fileViewerContent");
        const status = queryElement<HTMLDivElement>(container, ".fileViewerStatus");

        await waitFor(() => {
            expect(content.value).toBe(firstContent);
        });
        Object.defineProperty(content, "scrollHeight", {
            configurable: true,
            value: 1200,
        });
        content.scrollTop = 1000;

        fireEvent.input(screen.getByPlaceholderText("Search"), { target: { value: "target" } });
        fireEvent.keyDown(screen.getByPlaceholderText("Search"), { key: "Enter" });

        await waitFor(() => {
            expect(status.textContent?.trim()).toBe("Match at character 101");
        });
        expect(content.selectionStart).toBe(100);
        expect(content.scrollTop).toBeLessThan(1000);
    });

    it("shows a read error when the host cannot provide file content", async () => {
        const read = vi.fn().mockResolvedValue({ error: "permission denied" });
        window.fileViewer = {
            browse: vi.fn().mockResolvedValue(false),
            read,
        };

        const { container } = renderFileViewer();
        const content = queryElement<HTMLTextAreaElement>(container, ".fileViewerContent");
        const status = queryElement<HTMLDivElement>(container, ".fileViewerStatus");

        await waitFor(() => {
            expect(status.textContent?.trim()).toBe("permission denied");
        });
        expect(content.value).toBe("");
        expect(read).toHaveBeenCalledOnce();
    });
});
