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

import { Monaco, Range } from "../../../components/ui/CodeEditor";
import { Divider } from "../../../components/ui";
import { PresentationInterface } from "../../../script-execution/PresentationInterface";
import { ICodeEditorModel } from "../../../components/ui/CodeEditor/CodeEditor";

/** Handling of UI related tasks in a code editor for embedded contexts. */
export class EmbeddedPresentationInterface extends PresentationInterface {

    // A list of property to copy to local models.
    private static readonly propertyList = [
        "executionContexts",
        "symbols",
        "editorMode",
        "session",
    ];

    private internalModel?: Monaco.ITextModel;
    private modelNeedsUpdate = true;

    // Each command uses 2 decorations for the prompt: the one for the first line and one for all others.
    private promptFirstDecorationID = "";
    private promptOtherDecorationID = "";

    private startLineNumber: number;
    private endLineNumber: number;

    private resizingZone = false;
    private lastMouseY = 0;

    private dividerRef = React.createRef<HTMLDivElement>();

    // Listener for content changes in the render target.
    private resizeObserver?: ResizeObserver;

    private resultInfo?: { // A set of values required to manage a result element.
        zoneId: string;
        zone: Monaco.IViewZone;
    };

    public dispose(): void {
        super.dispose();

        this.backend?.deltaDecorations([this.promptFirstDecorationID], []);
        this.backend?.deltaDecorations([this.promptOtherDecorationID], []);

        if (this.internalModel) {
            this.internalModel.dispose();
        }
    }

    /**
     * @returns A local model which contains only the text of this block. The caller must dispose of it!
     */
    public get model(): Monaco.ITextModel {
        const editorModel = super.model as ICodeEditorModel; // Model for the entire editor content.

        if (!this.internalModel || this.internalModel.isDisposed()) {
            const localModel = Monaco.createModel("", this.language) as ICodeEditorModel;
            EmbeddedPresentationInterface.propertyList.forEach((name) => {
                if (editorModel[name]) {
                    localModel[name] = editorModel[name];
                }
            });

            this.internalModel = localModel;
        }

        if (editorModel && this.modelNeedsUpdate) {
            this.modelNeedsUpdate = false;
            this.internalModel.setValue(editorModel.getValueInRange(
                {
                    startLineNumber: this.startLine,
                    startColumn: 1,
                    endLineNumber: this.endLine,
                    endColumn: editorModel.getLineMaxColumn(this.endLine),
                }, Monaco.EndOfLinePreference.LF),
            );
        }

        return this.internalModel;
    }

    public get code(): string {
        return this.model.getValue();
    }

    public get codeLength(): number {
        const model = this.model; // Full or block model.

        return model.getValueLength();
    }

    public get startLine(): number {
        return this.startLineNumber;
    }

    public set startLine(value: number) {
        this.modelNeedsUpdate = true;
        if (this.startLineNumber !== value) {
            this.startLineNumber = value;
        }
    }

    public get endLine(): number {
        return this.endLineNumber;
    }

    public set endLine(value: number) {
        this.modelNeedsUpdate = true;
        if (this.endLineNumber !== value) {
            this.endLineNumber = value;
            this.updateMarginDecorations();
        }
    }

    public get codeOffset(): number {
        const editorModel = this.backend?.getModel();
        if (editorModel) {
            return editorModel.getOffsetAt({ lineNumber: this.startLineNumber, column: 1 });
        }

        return 0;
    }

    /**
     * Updates the start and end line members only, without updating anything else (like decorations).
     * This is used after edit actions that affected a command before this one, where Monaco automatically updated
     * the decorations already. We only need to update our inner state to stay in sync.
     *
     * @param delta The number of lines we moved.
     */
    public movePosition(delta: number): void {
        this.startLineNumber += delta;
        this.endLineNumber += delta;
    }

    public updateMarginDecorations(): void {
        super.updateMarginDecorations();

        const lineCount = this.endLine - this.startLine + 1;

        const model = this.backend?.getModel();
        if (this.backend && model && model.getLineCount() >= this.endLine) {
            let sourceIDs = this.promptFirstDecorationID === "" ? [] : [this.promptFirstDecorationID];
            let ids = this.backend.deltaDecorations(sourceIDs, [{
                range: new Range(this.startLine, 1, this.startLine, model.getLineLength(this.startLine)),
                options: {
                    stickiness: Monaco.TrackedRangeStickiness.GrowsOnlyWhenTypingBefore,
                    isWholeLine: false,
                    linesDecorationsClassName: `editorPromptFirst.${this.language}.${this.loadingState}`,
                },
            }]);
            this.promptFirstDecorationID = ids[0];

            if (lineCount >= 2) {
                sourceIDs = this.promptOtherDecorationID === "" ? [] : [this.promptOtherDecorationID];
                ids = this.backend.deltaDecorations(sourceIDs, [{
                    range: new Range(
                        this.startLine + 1, 1, this.endLine, model.getLineLength(this.endLine)),
                    options: {
                        stickiness: Monaco.TrackedRangeStickiness.GrowsOnlyWhenTypingBefore,
                        isWholeLine: false,
                        linesDecorationsClassName: "editorPrompt ." + this.language,
                    },
                }]);

                this.promptOtherDecorationID = ids[0];
            } else if (lineCount === 1) {
                // No other lines in the range, so remove the other-lines decoration.
                this.backend.deltaDecorations([this.promptOtherDecorationID], []);
                this.promptOtherDecorationID = "";
            }
        }

        // If we have a result assigned, update that as well.
        if (this.resultInfo) {
            this.resultInfo.zone.afterLineNumber = this.endLine;
            this.backend?.changeViewZones((changeAccessor: Monaco.IViewZoneChangeAccessor) => {
                this.resultInfo && changeAccessor.layoutZone(this.resultInfo.zoneId);
            });
        }
    }

    protected get resultDivider(): React.ReactNode {
        return <Divider
            innerRef={this.dividerRef}
            thickness={4}
            onPointerDown={this.handleDividerPointerDown}
            onPointerUp={this.handleDividerPointerUp}
            onPointerMove={this.handleDividerPointerMove}
        />;
    }

    protected removeRenderTarget(): void {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = undefined;
        }

        this.backend?.changeViewZones((changeAccessor: Monaco.IViewZoneChangeAccessor) => {
            if (this.resultInfo) {
                changeAccessor.removeZone(this.resultInfo.zoneId);
                this.resultInfo = undefined;
            }
        });

        super.removeRenderTarget();
    }

    protected updateRenderTarget(height: number): void {
        super.updateRenderTarget(height);

        this.backend?.changeViewZones((changeAccessor: Monaco.IViewZoneChangeAccessor) => {
            if (this.resultInfo && this.renderTarget) {
                this.resultInfo.zone.heightInPx = Math.max(height, this.minHeight);
                changeAccessor.layoutZone(this.resultInfo.zoneId);
            }
        });
    }

    /**
     * For embedded result the render target is a monaco-editor view zone.
     *
     * @returns A div element which can be used to render result content into.
     */
    protected defineRenderTarget(): HTMLDivElement {
        // The zone node is positioned absolutely and hence cannot use margins to define a distance to neighbor
        // elements. That's why we need an additional element below it that acts as background and mount point.
        const zoneNode = document.createElement("div");
        zoneNode.className = "zoneHost";

        const result = document.createElement("div");
        result.className = "renderTarget";
        result.style.maxHeight = `${PresentationInterface.maxHeight}px`;
        zoneNode.appendChild(result);

        result.addEventListener("wheel", (e) => {
            if (!this.editor?.isScrolling) {
                (e.currentTarget as HTMLElement).scrollLeft += Math.sign(e.deltaX) * 2;
                (e.currentTarget as HTMLElement).scrollTop += Math.sign(e.deltaY) * 2;
                e.stopPropagation();
            }
        }, { passive: true });

        const marginNode = document.createElement("div");
        marginNode.className = "zoneMargin";

        let zoneId = "";
        const zone = {
            afterLineNumber: this.endLine,
            domNode: zoneNode,
            marginDomNode: marginNode,
            suppressMouseDown: false,
            heightInPx: this.currentHeight,
        };

        if (this.currentHeight) {
            result.style.height = `${this.currentHeight}px`;
        }

        // istanbul ignore next
        if (typeof ResizeObserver !== "undefined") {
            this.resizeObserver = new ResizeObserver((entries) => {
                const last = entries.pop();
                if (last && !this.currentHeight) {
                    const maxAutoHeight = PresentationInterface.maxAutoHeight[this.resultData?.type ?? "text"];
                    const height = Math.min(last.borderBoxSize[0].blockSize, maxAutoHeight);
                    if (result.clientHeight > maxAutoHeight) {
                        result.style.height = `${height}px`;
                    }
                    this.updateRenderTarget(height);
                }
            });
            this.resizeObserver.observe(result);
        }

        this.backend?.changeViewZones((changeAccessor: Monaco.IViewZoneChangeAccessor) => {
            zoneId = changeAccessor.addZone(zone);
        });

        this.resultInfo = {
            zoneId,
            zone,
        };

        return result;
    }

    private handleDividerPointerDown = (e: React.PointerEvent): void => {
        this.resizingZone = true;
        this.lastMouseY = e.screenY;

        e.currentTarget.setPointerCapture(e.pointerId);
    };

    private handleDividerPointerUp = (e: React.PointerEvent): void => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (this.resultInfo) {
            this.manuallyResized = true;
            this.currentHeight = this.resultInfo.zone.heightInPx;
        }

        this.resizingZone = false;
    };

    private handleDividerPointerMove = (e: React.PointerEvent): void => {
        if (this.resizingZone) {
            const delta = e.screenY - this.lastMouseY;

            if (!this.currentHeight) {
                const maxAutoHeight = PresentationInterface.maxAutoHeight[this.resultData?.type ?? "text"];
                this.currentHeight = this.renderTarget?.getBoundingClientRect().height ?? maxAutoHeight;
            }

            if (this.resultInfo) {
                this.dividerRef.current?.classList.remove("minimum");
                this.dividerRef.current?.classList.remove("maximum");

                const newHeight = (this.currentHeight ?? 0) + delta;
                const minHeight = this.minHeight ?? 0;
                if (newHeight >= minHeight && newHeight <= PresentationInterface.maxHeight) {
                    this.resultInfo.zone.heightInPx = newHeight;
                    this.renderTarget!.style.height = `${newHeight}px`;

                    // Only adjust the zone height here. The manualHeight member is updated on mouse up.
                    this.backend?.changeViewZones((changeAccessor: Monaco.IViewZoneChangeAccessor) => {
                        if (this.resultInfo) {
                            this.resultInfo.zone.heightInPx = newHeight;
                            changeAccessor.layoutZone(this.resultInfo.zoneId);
                        }
                    });
                } else if (newHeight < this.minHeight) {
                    this.dividerRef.current?.classList.add("minimum");
                } else {
                    this.dividerRef.current?.classList.add("maximum");
                }
            }
        }
    };

}

