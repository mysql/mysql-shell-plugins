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

import "./SplitContainer.css";

import { ComponentChild, createRef } from "preact";

import { ComponentBase, IComponentProperties } from "../Component/ComponentBase.js";
import { Divider } from "../Divider/Divider.js";
import { Container, ContentAlignment, Orientation } from "../Container/Container.js";
import { convertPropValue } from "../../../utilities/string-helpers.js";

/** A record for each pane with dynamic size and behavior information. */
interface IPanePositionData {
    id: string;

    minSize: number;
    maxSize: number;

    /** The size to compute changes against when the user resizes a pane. */
    startSize: number;

    /** The current size of the pane. Can be clipped at min and max values. */
    currentSize: number;

    /** If specified then the pane uses this size initially, instead of a computed size. */
    initialSize?: number;

    /** Collapse a pane if its size is forced below half of the min size. */
    snap: boolean;

    /** Determines if a pane can be resized (by mouse or layout). */
    resizable: boolean;

    /** Determines if a pane always takes any remaining space in the split container. */
    stretch: boolean;

    /** Set to a specific CSS class if min or max are reached. */
    className: string;
}

export interface ISplitterPane {
    id?: string;
    content: ComponentChild;

    minSize?: number;
    maxSize?: number;
    initialSize?: number;
    snap?: boolean;
    resizable?: boolean;
    stretch?: boolean;

    /** If true the pane size is initially set to 0. */
    collapsed?: boolean;
}

/** Record for pane resizes. */
export type ISplitterPaneSizeInfo = Pick<IPanePositionData, "id" | "currentSize">;

interface ISplitContainerProperties extends IComponentProperties {
    panes: ISplitterPane[];

    orientation?: Orientation;

    /** The thickness of the splitter (separator). */
    splitterSize?: number;

    innerRef?: preact.RefObject<HTMLElement>;

    onPaneResized?: (info: ISplitterPaneSizeInfo[]) => void;
}

export class SplitContainer extends ComponentBase<ISplitContainerProperties> {

    public static override defaultProps = {
        orientation: Orientation.LeftToRight,
        splitterSize: 4,
    };

    private sashContainerRef = createRef<HTMLDivElement>();
    private contentContainerRef = createRef<HTMLDivElement>();

    private paneData: IPanePositionData[] = [];
    private currentSashIndex = -1; // The index of the sash currently being dragged (or -1 if no dragging is going on).
    private stretchCount = 0;      // The number of pane that can automatically be stretched to consume remaining space.

    private resizeObserver?: ResizeObserver; // Not available in Safari (macOS, iOS).
    private lastMouseX = 0; // Last mouse position when starting resize with a sash.
    private lastMouseY = 0;

    private containerRef: preact.RefObject<HTMLElement>;
    private resizeTimer: ReturnType<typeof setTimeout> | null = null;

    public constructor(props: ISplitContainerProperties) {
        super(props);

        this.containerRef = props.innerRef ?? createRef<HTMLElement>();

        // Initial pane layout.
        this.updatePaneData();

        // istanbul ignore next
        if (typeof ResizeObserver !== "undefined") {
            this.resizeObserver = new ResizeObserver(this.handleTargetResize);
        }

        this.addHandledProperties("panes", "orientation", "splitterSize", "firstPanelDetails", "secondPanelDetails",
            "collapse", "onCollapseChange", "innerRef", "onPaneResized");
    }

    public override componentDidUpdate(): void {
        this.updatePaneData();
        this.computeLayout();
    }

    public override componentDidMount(): void {
        // Prevent any animation of the splitter panes for a short moment until the UI has settled.
        this.markResizing();

        document.addEventListener("pointerup", this.handleSplitterPointerUp);

        if (this.sashContainerRef.current && this.contentContainerRef.current) {
            this.computeLayout();

            const sashes = this.sashContainerRef.current.childNodes;
            sashes.forEach((node: ChildNode) => {
                const sash = node as HTMLElement;
                sash.addEventListener("pointerdown", this.handleSplitterPointerDown);
                sash.addEventListener("pointerup", this.handleSplitterPointerUp);
                sash.addEventListener("pointermove", this.handleSplitterPointerMove);
            });

            this.lastMouseX = this.contentContainerRef.current.clientWidth;
            this.lastMouseY = this.contentContainerRef.current.clientHeight;
            this.resizeObserver?.observe(this.contentContainerRef.current);
        }
    }

    public override componentWillUnmount(): void {
        if (this.resizeTimer) {
            clearTimeout(this.resizeTimer);
        }

        if (this.sashContainerRef.current && this.contentContainerRef.current) {
            const sashes = this.sashContainerRef.current.childNodes;
            sashes.forEach((node: ChildNode): void => {
                const sash = node as HTMLElement;
                sash.removeEventListener("pointerdown", this.handleSplitterPointerDown);
                sash.removeEventListener("pointerup", this.handleSplitterPointerUp);
                sash.removeEventListener("pointermove", this.handleSplitterPointerMove);
            });
        }

        document.removeEventListener("pointerup", this.handleSplitterPointerUp);

        if (this.contentContainerRef.current) {
            this.resizeObserver?.unobserve(this.contentContainerRef.current);
        }
    }

    public render(): ComponentChild {
        const { panes, orientation, splitterSize } = this.props;

        const className = this.getEffectiveClassNames(["splitContainer"]);

        // The sash container keeps all splitters independently of the panes they act on.
        const sashes: ComponentChild[] = [];

        const content = panes.map((pane: ISplitterPane, index: number) => {
            const baseId = pane.id ?? `pane${index}`;
            if (index < panes.length - 1) {
                sashes.push(<Divider
                    key={baseId + "Sash"}
                    id={baseId + "Sash"}
                    className={"sash" + (pane.resizable ? "" : " disabled")}
                    vertical={this.isHorizontal}
                    thickness={splitterSize}
                />);
            }

            return (
                <Container
                    key={baseId + "Host"}
                    id={baseId + "Host"}
                    className={"splitHost" + (pane.stretch ? " stretch" : "")}
                    orientation={orientation}
                    mainAlignment={ContentAlignment.Stretch}
                >
                    {pane.content}
                </Container>
            );
        });

        return (
            <div
                ref={this.containerRef as preact.RefObject<HTMLDivElement>}
                className={className}
                {...this.unhandledProperties}
            >
                <div
                    ref={this.sashContainerRef}
                    className="sashContainer"
                >
                    {sashes}
                </div>
                <div
                    ref={this.contentContainerRef}
                    className="splitContentContainer"
                >
                    {content}
                </div>
            </div>
        );
    }

    public getPaneSize(id?: string): number | undefined {
        const pane = this.paneData.find((entry: IPanePositionData) => {
            return entry.id === id;
        });

        return pane?.currentSize;
    }

    private get isHorizontal(): boolean {
        const { orientation } = this.props;

        return orientation === Orientation.LeftToRight || orientation === Orientation.RightToLeft;
    }

    private handleSplitterPointerDown = (e: PointerEvent): void => {
        if (this.sashContainerRef.current) {
            const sashes = this.sashContainerRef.current.childNodes;
            sashes.forEach((node: ChildNode, index: number): void => {
                const sash = node as HTMLElement;
                if (node === e.target) {
                    this.currentSashIndex = index;
                    this.lastMouseX = e.x;
                    this.lastMouseY = e.y;

                    sash.setPointerCapture(e.pointerId);
                }
            });
        }

        // Handle mouse release outside of the browser window.
        document.addEventListener("pointerup", this.handleSplitterPointerUp);
    };

    private handleSplitterPointerUp = (e: PointerEvent): void => {
        if (this.sashContainerRef.current && this.currentSashIndex > -1) {
            const sashes = this.sashContainerRef.current.childNodes;
            const sash = sashes[this.currentSashIndex] as HTMLElement;
            sash.releasePointerCapture(e.pointerId);

            this.paneData.forEach((paneData: IPanePositionData) => {
                paneData.startSize = paneData.currentSize;
            });

            const { onPaneResized } = this.props;
            onPaneResized?.(this.paneData);
        }

        this.currentSashIndex = -1;

        document.removeEventListener("pointerup", this.handleSplitterPointerUp);
    };

    private handleSplitterPointerMove = (e: PointerEvent): void => {
        if (this.currentSashIndex > -1 && this.sashContainerRef.current && this.contentContainerRef.current) {
            this.markResizing();

            const delta = this.isHorizontal ? e.x - this.lastMouseX : e.y - this.lastMouseY;
            this.runChangeDistribution(this.currentSashIndex, delta);
        }
    };

    /**
     * Distributes the given delta over the pane at the given index and, if required, all the ones before it.
     *
     * @param index The index of the pane to start with.
     * @param delta The amount to distribute.
     * @param testFlight If true then don't apply change, but instead determine how much of the delta can actually
     *                   be consumed, given the pane's constraints.
     *
     * @returns The amount of space that can actually be consumed.
     */
    private distributeChangeBefore = (index: number, delta: number, testFlight: boolean): number => {
        // Allow a zero delta here to support big jumps from a saturated pane to a non-saturated one, in which
        // case we have to take out all the distributed amount, which we applied before.
        const paneData = this.paneData[index];
        let consumed = delta;
        let remaining = 0;

        const newSize = paneData.startSize + delta;
        if (newSize >= paneData.minSize && newSize <= paneData.maxSize) {
            if (!testFlight) {
                paneData.currentSize = newSize;

                if (newSize === paneData.minSize) {
                    paneData.className = "minimum";
                } else if (newSize === paneData.maxSize) {
                    paneData.className = "maximum";
                } else {
                    paneData.className = "";
                }

                if (index > 0) {
                    this.distributeChangeBefore(index - 1, remaining, testFlight);
                }
            }
        } else {
            if (newSize < paneData.minSize) {
                consumed = paneData.minSize - paneData.startSize;
                remaining = delta - consumed;
                if (!testFlight) {
                    paneData.currentSize = paneData.minSize;
                    paneData.className = "minimum";
                }
            } else {
                consumed = paneData.maxSize - paneData.startSize;
                remaining = delta - consumed;
                if (!testFlight) {
                    paneData.currentSize = paneData.maxSize;
                    paneData.className = "maximum";
                }
            }

            if (index > 0) {
                consumed += this.distributeChangeBefore(index - 1, remaining, testFlight);
            }
        }

        return consumed;
    };

    /**
     * Distributes the given delta over the pane at the given index and, if required, all the ones after it.
     *
     * @param index The index of the pane to start with.
     * @param delta The amount to distribute.
     * @param testFlight If true then don't apply change, but instead determine how much of the delta can actually
     *                   be consumed, given the pane's constraints.
     *
     * @returns The amount of space that can actually be consumed.
     */
    private distributeChangeAfter = (index: number, delta: number, testFlight: boolean): number => {
        const paneData = this.paneData[index];
        let consumed = delta;
        let remaining = 0;

        // Need to subtract delta here as this is the part which gets larger the smaller the size delta becomes.
        const newSize = paneData.startSize - delta;
        if (newSize >= paneData.minSize && newSize <= paneData.maxSize) {
            if (!testFlight) {
                paneData.currentSize = newSize;

                if (newSize === paneData.minSize) {
                    paneData.className = "minimum";
                } else if (newSize === paneData.maxSize) {
                    paneData.className = "maximum";
                } else {
                    paneData.className = "";
                }

                if (index < this.paneData.length - 1) {
                    this.distributeChangeAfter(index + 1, remaining, testFlight);
                }
            }
        } else {
            if (newSize < paneData.minSize) {
                consumed = paneData.startSize - paneData.minSize;
                remaining = delta - consumed;
                if (!testFlight) {
                    paneData.currentSize = paneData.minSize;
                    paneData.className = "minimum";
                }
            } else {
                consumed = paneData.startSize - paneData.maxSize;
                remaining = delta - consumed;
                if (!testFlight) {
                    paneData.currentSize = paneData.maxSize;
                    paneData.className = "maximum";
                }
            }

            if (index < this.paneData.length - 1) {
                consumed += this.distributeChangeAfter(index + 1, remaining, testFlight);
            }
        }

        return consumed;
    };

    private handleTargetResize = (): void => {
        this.markResizing();
        this.computeLayout();
    };

    private runChangeDistribution = (index: number, delta: number): void => {
        // Do a test flight first to see what amount of delta all panes can accept (due to constraints).
        // Use the lower of the two results as actual amount for the real distribution.
        const firstDelta = this.distributeChangeBefore(index, delta, true);

        if (index < this.paneData.length - 1) {
            const secondDelta = this.distributeChangeAfter(index + 1, delta, true);

            if (Math.abs(firstDelta) < Math.abs(secondDelta)) {
                delta = firstDelta;
            } else {
                delta = secondDelta;
            }
        } else {
            delta = firstDelta;
        }

        this.distributeChangeBefore(index, delta, false);
        if (index < this.paneData.length - 1) {
            this.distributeChangeAfter(index + 1, delta, false);
        }

        this.applyLayout();
    };

    private computeLayout = (): void => {
        if (this.contentContainerRef.current) {
            const totalSize = this.isHorizontal
                ? this.contentContainerRef.current.clientWidth
                : this.contentContainerRef.current.clientHeight;

            const computedSizes: number[] = [];
            if (this.stretchCount > 0) {
                let totalPaneSize = 0;
                this.paneData.forEach((entry: IPanePositionData): void => {
                    let actualSize = entry.currentSize;

                    if (entry.startSize === -1) {
                        // No initial size was set so far.
                        // Use the given size (if there's one) or determine a default one.
                        if (entry.initialSize != null) {
                            actualSize = Math.max(Math.min(entry.initialSize, entry.maxSize ?? 1e100),
                                entry.minSize ?? 0);
                        } else {
                            actualSize = Math.max(Math.min(200, entry.maxSize ?? 1e100), entry.minSize ?? 0);
                        }
                    } else {
                        if (entry.initialSize != null) {
                            // The initial size can be anything, even outside of min/max range.
                            actualSize = entry.initialSize;
                        }

                        // Once applied we don't need the initial size anymore.
                        // In fact it would prevent certain automatic layout.
                        entry.initialSize = undefined;
                    }
                    entry.startSize = actualSize;
                    entry.currentSize = actualSize;

                    totalPaneSize += actualSize;
                    computedSizes.push(actualSize);
                });

                // Distribute remaining space over stretchable panes.
                // Consider max sizes in this process.
                let remainingSpace = totalSize - totalPaneSize;
                let remainingStretchCount = this.stretchCount;

                // We cannot simply apply a single value to all stretchable panes, as some might not
                // allow to grow as large as we computed (because of max size setting). If we see such
                // a case then we apply only as much as is possible and decrease the pool size only by that,
                // trying so to apply more space to other panes, where possible.
                let availableStretchCount = 0;
                while (remainingSpace !== 0 && remainingStretchCount > 0) {
                    // Go over the list as many times as necessary to find a place that can take all
                    // remaining space.
                    let index = 0;
                    while (index < this.paneData.length && remainingStretchCount > 0) {
                        const part = remainingSpace / remainingStretchCount;
                        const paneData = this.paneData[index];
                        if (paneData.stretch) {
                            const newSize = computedSizes[index] + part;
                            if (part < 0) {
                                // Make pane smaller.
                                if (computedSizes[index] > paneData.minSize) {
                                    if (newSize < paneData.minSize) {
                                        remainingSpace -= paneData.minSize - computedSizes[index];
                                        computedSizes[index] = paneData.minSize;
                                    } else {
                                        computedSizes[index] = newSize;
                                        remainingSpace -= part;
                                        ++availableStretchCount; // This pane could take more, if required.
                                    }
                                }
                            } else {
                                // Make pane larger.
                                if (computedSizes[index] < paneData.maxSize) {
                                    if (newSize > paneData.maxSize) {
                                        remainingSpace -= paneData.maxSize - computedSizes[index];
                                        computedSizes[index] = paneData.maxSize;
                                    } else {
                                        computedSizes[index] = newSize;
                                        remainingSpace -= part;
                                        ++availableStretchCount; // This pane could take more, if required.
                                    }
                                }
                            }
                            --remainingStretchCount;
                        }

                        ++index;
                    }

                    // Start over with those panes that can still take more space (if any remained at this point).
                    remainingStretchCount = availableStretchCount;
                    availableStretchCount = 0;
                }
            } else {
                // There's no pane that can automatically stretch to fill the space.
                // In this case resize all panes to their initial size and distribute the remaining space
                // over all those panes without an initial size.
                let totalPaneSize = 0;
                let assignableCount = 0;
                this.paneData.forEach((entry: IPanePositionData): void => {
                    if (entry.startSize === -1) {
                        let size = 0;
                        if (entry.initialSize) {
                            size = Math.max(Math.min(entry.initialSize, entry.maxSize ?? 1e100), entry.minSize ?? 0);
                            entry.startSize = size;
                            entry.currentSize = size;

                            entry.initialSize = undefined;
                        } else {
                            ++assignableCount;
                        }
                        totalPaneSize += entry.startSize > -1 ? entry.startSize : 0;
                    }

                    computedSizes.push(entry.startSize);
                });

                // Distribute remaining space over panes without an initial size.
                // Consider max sizes in this process.
                let remainingSpace = totalSize - totalPaneSize;
                let remainingAssignableCount = assignableCount;

                let availableAssignableCount = 0;
                while (remainingSpace !== 0 && remainingAssignableCount > 0) {
                    let index = 0;
                    while (index < this.paneData.length) {
                        const part = remainingSpace / remainingAssignableCount;
                        const paneData = this.paneData[index];
                        if (computedSizes[index] === -1) {
                            const newSize = computedSizes[index] = part;
                            if (part < 0) {
                                // Make pane smaller.
                                if (newSize < paneData.minSize) {
                                    remainingSpace -= paneData.minSize - computedSizes[index];
                                    computedSizes[index] = paneData.minSize;
                                } else {
                                    computedSizes[index] = newSize;
                                    remainingSpace -= part;
                                    ++availableAssignableCount;
                                }
                            } else {
                                // Make pane larger.
                                if (newSize > paneData.maxSize) {
                                    remainingSpace -= paneData.maxSize - computedSizes[index];
                                    computedSizes[index] = paneData.maxSize;
                                } else {
                                    computedSizes[index] = newSize;
                                    remainingSpace -= part;
                                    ++availableAssignableCount;
                                }
                            }
                            --remainingAssignableCount;
                        }

                        ++index;
                    }
                    remainingAssignableCount = availableAssignableCount;
                    availableAssignableCount = 0;

                }
            }

            // Copy over the final sizes to our layout info.
            computedSizes.forEach((value: number, index: number) => {
                this.paneData[index].currentSize = value;
                this.paneData[index].startSize = value;
            });

            this.applyLayout();
        }
    };

    private applyLayout = (): void => {
        if (this.sashContainerRef.current && this.contentContainerRef.current) {
            const sashes = this.sashContainerRef.current.childNodes;
            const panes = this.contentContainerRef.current.childNodes;

            let currentPosition = 0;
            panes.forEach((node: ChildNode, index: number): void => {
                let sash: HTMLElement | undefined;
                if (index < sashes.length) {
                    sash = sashes[index] as HTMLElement;
                }

                const pane = node as HTMLElement;

                const paneData = this.paneData[index];
                if (sash) {
                    sash.classList.remove("minimum");
                    sash.classList.remove("maximum");
                    if (paneData.className.length > 0) {
                        sash.classList.add(paneData.className);
                    }
                }

                if (this.isHorizontal) {
                    pane.style.width = convertPropValue(paneData.currentSize)!;
                    pane.style.left = convertPropValue(currentPosition)!;
                    currentPosition += paneData.currentSize;

                    if (sash) {
                        sash.style.left = convertPropValue(currentPosition - 3)!;
                    }
                } else {
                    pane.style.height = convertPropValue(paneData.currentSize)!;
                    pane.style.top = convertPropValue(currentPosition)!;
                    currentPosition += paneData.currentSize;

                    if (sash) {
                        sash.style.top = convertPropValue(currentPosition - 3)!;
                    }
                }
            });
        }
    };

    private updatePaneData = (): void => {
        const { panes } = this.props;

        this.paneData = [];
        this.stretchCount = 0;
        panes.forEach((pane: ISplitterPane) => {
            const minSize = pane.minSize ?? 0;
            const maxSize = pane.maxSize ?? 10e100;
            const startSize = Math.max(Math.min(0, maxSize), minSize);

            this.paneData.push({
                id: pane.id ?? "",
                minSize,
                maxSize,
                startSize: pane.collapsed ? startSize : -1,
                currentSize: -1,
                initialSize: pane.initialSize,

                snap: pane.snap ?? false,
                resizable: pane.resizable ?? false,
                stretch: pane.stretch ?? false,

                className: "",
            });

            if (pane.stretch) {
                ++this.stretchCount;
            }
        });

    };

    private markResizing = (): void => {
        if (this.containerRef.current) {
            this.containerRef.current.classList.add("resizing");

            if (this.resizeTimer) {
                clearTimeout(this.resizeTimer);
            }

            this.resizeTimer = setTimeout((): void => {
                if (this.containerRef.current) {
                    this.containerRef.current.classList.remove("resizing");
                }
            }, 500);
        }
    };
}
