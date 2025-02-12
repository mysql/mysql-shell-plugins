/*
 * Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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

import { ComponentChild, createRef } from "preact";

import { CodeEditorMode, Monaco, Range } from "../../../components/ui/CodeEditor/index.js";
import { PresentationInterface } from "../../../script-execution/PresentationInterface.js";
import { ICodeEditorModel } from "../../../components/ui/CodeEditor/CodeEditor.js";
import { Divider } from "../../../components/ui/Divider/Divider.js";
import { EditorLanguage } from "../../../supplement/index.js";
import { KeyboardKeys } from "../../../utilities/helpers.js";

/** Handling of UI related tasks in a code editor for embedded contexts. */
export class EmbeddedPresentationInterface extends PresentationInterface {

    private internalModel?: Monaco.ITextModel;
    private modelNeedsUpdate = true;

    // Each command uses 2 decorations for the prompt: the one for the first line and one for all others.
    private promptFirstDecorationID = "";
    private promptOtherDecorationID = "";

    private startLineNumber = -1;
    private endLineNumber = -1;

    private resizingZone = false;
    private lastMouseY = 0;

    private dividerRef = createRef<HTMLDivElement>();

    // Listener for content changes in the render target.
    private resizeObserver?: ResizeObserver;

    public constructor(language: EditorLanguage) {
        super(language);
    }

    public override dispose(): void {
        // Need to get the outer model here, as the super.dispose() call will nullify the backend/model.
        const editorModel = super.model;

        super.dispose();

        if (editorModel) {
            editorModel.deltaDecorations([this.promptFirstDecorationID], []);
            editorModel.deltaDecorations([this.promptOtherDecorationID], []);
        }

        if (this.internalModel) {
            this.internalModel.dispose();
            this.internalModel = undefined;
            this.modelNeedsUpdate = true;
        }
    }

    public override activate(editor: Monaco.IStandaloneCodeEditor, cachedHeight?: number): void {
        super.activate(editor, cachedHeight);

        this.updateMarginDecorations();
        if (cachedHeight) {
            this.backend?.changeViewZones!((changeAccessor: Monaco.IViewZoneChangeAccessor) => {
                if (this.zoneInfo) {
                    this.zoneInfo.zone.heightInPx = cachedHeight;
                    this.zoneInfo.zoneId = changeAccessor.addZone(this.zoneInfo.zone);
                }
            });
        }
    }

    /**
     * @returns A local model which contains only the text of this block.
     */
    public override get model(): Monaco.ITextModel {
        const editorModel = super.model as ICodeEditorModel | null; // Model for the entire editor content.

        if (!this.internalModel || this.internalModel.isDisposed()) {
            const localModel: ICodeEditorModel = Object.assign(Monaco.createModel("", this.language), {
                // This local model has no execution blocks.
                symbols: editorModel?.symbols,
                editorMode: CodeEditorMode.Standard,
            });

            if (editorModel && "session" in editorModel) {
                localModel.session = editorModel.session;
            }

            if (localModel.getEndOfLineSequence() !== Monaco.EndOfLineSequence.LF) {
                localModel.setEOL(Monaco.EndOfLineSequence.LF);
            } else {
                // Setting EOL increases the model version, so we need to mirror that if the EOL is already LF.
                localModel.setValue("");
            }

            this.internalModel = localModel;
        }

        if (editorModel && this.modelNeedsUpdate) {
            this.modelNeedsUpdate = false;
            const value = editorModel.getValueInRange(
                {
                    startLineNumber: this.startLine,
                    startColumn: 1,
                    endLineNumber: this.endLine,
                    endColumn: editorModel.getLineMaxColumn(this.endLine),
                }, Monaco.EndOfLinePreference.LF);

            this.internalModel.setValue(value);
        }

        return this.internalModel;
    }

    public override get startLine(): number {
        return this.startLineNumber;
    }

    public override set startLine(value: number) {
        this.modelNeedsUpdate = true;
        if (this.startLineNumber !== value) {
            this.startLineNumber = value;
        }
    }

    public override get endLine(): number {
        return this.endLineNumber;
    }

    public override set endLine(value: number) {
        this.modelNeedsUpdate = true;
        if (this.endLineNumber !== value) {
            this.endLineNumber = value;
            this.updateMarginDecorations();
        }
    }

    public override get codeOffset(): number {
        const editorModel = super.model;
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
    public override movePosition(delta: number): void {
        this.startLineNumber += delta;
        this.endLineNumber += delta;

        // If we have a result assigned, update that as well.
        if (this.zoneInfo) {
            this.zoneInfo.zone.afterLineNumber = this.endLineNumber;
            this.backend?.changeViewZones?.((changeAccessor: Monaco.IViewZoneChangeAccessor) => {
                this.zoneInfo && changeAccessor.layoutZone(this.zoneInfo.zoneId);
            });
        }
    }

    public override updateMarginDecorations(): void {
        super.updateMarginDecorations();

        const lineCount = this.endLine - this.startLine + 1;

        const editorModel = this.backend?.getModel?.();
        if (this.backend && editorModel && editorModel.getLineCount() >= this.endLine) {
            let sourceIDs = this.promptFirstDecorationID === "" ? [] : [this.promptFirstDecorationID];
            let ids = editorModel.deltaDecorations?.(sourceIDs, [{
                range: new Range(this.startLine, 1, this.startLine, 2),
                options: {
                    stickiness: Monaco.TrackedRangeStickiness.GrowsOnlyWhenTypingBefore,
                    isWholeLine: false,
                    linesDecorationsClassName: `editorPromptFirst.${this.language}.${this.loadingState}`,
                },
            }]) ?? [];
            this.promptFirstDecorationID = ids[0];

            if (lineCount >= 2) {
                sourceIDs = this.promptOtherDecorationID === "" ? [] : [this.promptOtherDecorationID];
                ids = editorModel.deltaDecorations?.(sourceIDs, [{
                    range: new Range(
                        this.startLine + 1, 1, this.endLine, editorModel.getLineLength(this.endLine)),
                    options: {
                        stickiness: Monaco.TrackedRangeStickiness.GrowsOnlyWhenTypingBefore,
                        isWholeLine: false,
                        linesDecorationsClassName: "editorPrompt ." + this.language,
                    },
                }]) ?? [];

                this.promptOtherDecorationID = ids[0];
            } else if (lineCount === 1) {
                // No other lines in the range, so remove the other-lines decoration.
                editorModel.deltaDecorations?.([this.promptOtherDecorationID], []);
                this.promptOtherDecorationID = "";
            }
        }

        // If we have a result assigned, update that as well.
        if (this.zoneInfo && this.zoneInfo.zone.afterLineNumber !== this.endLineNumber) {
            this.zoneInfo.zone.afterLineNumber = this.endLineNumber;
            this.backend?.changeViewZones?.((changeAccessor: Monaco.IViewZoneChangeAccessor) => {
                this.zoneInfo && changeAccessor.layoutZone(this.zoneInfo.zoneId);
            });
        }
    }

    protected override get resultDivider(): ComponentChild {
        return <Divider
            innerRef={this.dividerRef}
            thickness={4}
            onPointerDown={this.handleDividerPointerDown}
            onPointerUp={this.handleDividerPointerUp}
            onPointerMove={this.handleDividerPointerMove}
        />;
    }

    protected override removeRenderTarget(): void {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = undefined;
        }

        this.backend?.changeViewZones!((changeAccessor: Monaco.IViewZoneChangeAccessor) => {
            if (this.zoneInfo) {
                changeAccessor.removeZone(this.zoneInfo.zoneId);
                this.zoneInfo = undefined;
            }
        });

        super.removeRenderTarget();
    }

    protected override updateRenderTarget(height?: number): void {
        super.updateRenderTarget(height);

        if (height !== undefined) {
            this.backend?.changeViewZones?.((changeAccessor: Monaco.IViewZoneChangeAccessor) => {
                if (this.zoneInfo && this.renderTarget) {
                    this.zoneInfo.zone.heightInPx = Math.max(height, this.minHeight);
                    changeAccessor.layoutZone(this.zoneInfo.zoneId);
                }
            });
        }
    }

    /**
     * For embedded result the render target is a monaco-editor view zone.
     *
     * @returns A div element which can be used to render result content into.
     */
    protected override defineRenderTarget(): HTMLDivElement {
        // istanbul ignore next
        if (!this.zoneInfo) {
            // The zone info is created when the presentation is created. So, this call will probably never be needed.
            this.prepareRenderTarget();
        }
        const renderTarget = this.zoneInfo!.zone.domNode.firstChild as HTMLDivElement;

        renderTarget.addEventListener("wheel", (e) => {
            e.stopPropagation();
        }, { passive: true });

        renderTarget.addEventListener("keydown", (e) => {
            if (e.altKey && e.key === KeyboardKeys.ArrowUp) {
                this.backend?.setPosition?.({ lineNumber: this.startLine, column: 1 });
                this.backend?.focus?.();

                e.stopPropagation();
            } else if (e.altKey && e.key === KeyboardKeys.ArrowDown) {
                this.backend?.setPosition?.({ lineNumber: this.endLine + 1, column: 1 });
                this.backend?.focus?.();

                e.stopPropagation();
            }
        });

        if (this.zoneInfo?.zoneId === "") {
            this.backend?.changeViewZones?.((changeAccessor: Monaco.IViewZoneChangeAccessor) => {
                this.zoneInfo!.zoneId = changeAccessor.addZone(this.zoneInfo!.zone);
            });
        }

        if (this.currentHeight) {
            renderTarget.style.height = `${this.currentHeight}px`;
        }

        // istanbul ignore next
        if (typeof ResizeObserver !== "undefined") {
            this.resizeObserver = new ResizeObserver((entries) => {
                const last = entries.pop();
                if (last && !this.currentHeight) {
                    const maxAutoHeight = PresentationInterface.maxAutoHeight[this.resultData?.type ?? "text"];
                    const height = Math.min(last.borderBoxSize[0].blockSize, maxAutoHeight);
                    if (renderTarget.clientHeight > maxAutoHeight) {
                        renderTarget.style.height = `${height}px`;
                    }

                    if (this.zoneInfo && this.zoneInfo.zone.heightInPx !== height) {
                        this.updateRenderTarget(height);
                    }
                }
            });
            this.resizeObserver.observe(renderTarget);
        }

        return renderTarget;
    }

    protected override showMaximizeButton(): "never" | "tab" | "statusBar" {
        return "statusBar";
    }

    /**
     * Creates the minimal zone info required to add the zone to the editor. Everything else is added later
     * in defineRenderTarget.
     */
    protected override prepareRenderTarget(): void {
        // The zone node is positioned absolutely and hence cannot use margins to define a distance to neighbor
        // elements. That's why we need an additional element below it that acts as background and mount point.
        const zoneHost = document.createElement("div");
        zoneHost.className = "zoneHost";

        const renderTarget = document.createElement("div");
        renderTarget.className = "renderTarget";
        renderTarget.style.maxHeight = `${PresentationInterface.maxHeight}px`;
        zoneHost.appendChild(renderTarget);

        const marginNode = document.createElement("div");

        marginNode.className = "zoneMargin";

        this.zoneInfo = {
            zoneId: "",
            zone: {
                afterLineNumber: this.endLine,
                domNode: zoneHost,
                marginDomNode: marginNode,
                suppressMouseDown: false,
                heightInPx: this.currentHeight,
            },
        };
    }

    private handleDividerPointerDown = (e: PointerEvent): void => {
        this.resizingZone = true;
        this.lastMouseY = e.screenY;

        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

    private handleDividerPointerUp = (e: PointerEvent): void => {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        if (this.zoneInfo) {
            this.manuallyResized = true;
            this.currentHeight = this.zoneInfo.zone.heightInPx;
        }

        this.resizingZone = false;
    };

    private handleDividerPointerMove = (e: PointerEvent): void => {
        if (this.resizingZone) {
            const delta = e.screenY - this.lastMouseY;

            if (!this.currentHeight) {
                const maxAutoHeight = PresentationInterface.maxAutoHeight[this.resultData?.type ?? "text"];
                this.currentHeight = this.renderTarget?.getBoundingClientRect().height ?? maxAutoHeight;
            }

            if (this.zoneInfo) {
                this.dividerRef.current?.classList.remove("minimum");
                this.dividerRef.current?.classList.remove("maximum");

                const newHeight = (this.currentHeight ?? 0) + delta;
                const minHeight = this.minHeight ?? 0;
                if (newHeight >= minHeight && newHeight <= PresentationInterface.maxHeight) {
                    this.zoneInfo.zone.heightInPx = newHeight;
                    this.renderTarget!.style.height = `${newHeight}px`;

                    // Only adjust the zone height here. The manualHeight member is updated on mouse up.
                    this.backend?.changeViewZones?.((changeAccessor: Monaco.IViewZoneChangeAccessor) => {
                        if (this.zoneInfo) {
                            this.zoneInfo.zone.heightInPx = newHeight;
                            changeAccessor.layoutZone(this.zoneInfo.zoneId);
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
