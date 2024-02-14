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

import "./Selector.css";

import { cloneElement, ComponentChild, createRef, VNode } from "preact";

import {
    ComponentBase, IComponentProperties, DragEventType, ClickEventCallback, DragEventCallback,
} from "../Component/ComponentBase.js";

import { ISelectorItemProperties, SelectorItem } from "./SelectorItem.js";
import { Codicon } from "../Codicon.js";
import { collectVNodes } from "../../../utilities/preact-helpers.js";
import { Orientation, Container } from "../Container/Container.js";

export interface ISelectorDef {
    id?: string;

    icon?: string | Codicon;
    caption?: string;
    tooltip?: string;
    canReorder?: boolean;        // Can items be reordered using drag and drop?

    auxillary?: ComponentChild;
}

interface ISelectorProperties extends IComponentProperties {
    orientation?: Orientation;
    entryOrientation?: Orientation;
    smoothScroll?: boolean;
    wrapNavigation?: boolean; // If false, it will hide the nav button when reaching one end.

    activeItemId?: string;
    items?: ISelectorDef[];

    onSelect?: (id: string) => void;
}

/**
 * A selector is a collection of button-like elements, of which only one can be active.
 * Typical use of this component includes activity bars and tabview switchers.
 */
export class Selector extends ComponentBase<ISelectorProperties> {
    public static defaultProps = {
        orientation: Orientation.LeftToRight,
        entryOrientation: Orientation.TopDown,
        smoothScroll: false,
        wrapNavigation: true,
        activeItemId: "",
    };

    private containerRef = createRef<HTMLDivElement>();
    private stepUpRef = createRef<HTMLDivElement>();
    private stepDownRef = createRef<HTMLDivElement>();
    private activeItemRef = createRef<HTMLDivElement>();

    private dragInsideCounter = 0;

    public constructor(props: ISelectorProperties) {
        super(props);

        this.addHandledProperties("orientation", "entryOrientation", "items", "smoothScroll", "wrapNavigation",
            "activeItemId");
        this.connectDragEvents();
    }

    public componentDidMount(): void {
        this.handleResize();
    }

    public componentDidUpdate(): void {
        this.scrollActiveItemIntoView();
        this.autoHideNavButtons();
    }

    public render(): ComponentChild {
        const { id, children, smoothScroll, items, orientation, entryOrientation, activeItemId } = this.mergedProps;

        const className = this.getEffectiveClassNames([
            "selector",
            this.classFromProperty(this.isHorizontal, ["vertical", "horizontal"]),
            this.classFromProperty(smoothScroll, "smoothScroll"),
        ]);

        const baseId = (id ?? "selector") + "Item";

        let content = children;
        if (content == null) {
            content = items?.map((item: ISelectorDef, index: number): ComponentChild => {
                const selectorId = item.id ?? `${baseId}${index}`;
                const active = activeItemId === selectorId;

                return (
                    <SelectorItem
                        innerRef={active ? this.activeItemRef : undefined}
                        id={selectorId}
                        key={selectorId}
                        caption={item.caption}
                        tooltip={item.tooltip}
                        image={item.icon}
                        auxillary={item.auxillary}
                        selected={active}
                        orientation={entryOrientation}
                        draggable={item.canReorder}
                        onClick={this.handleItemClick.bind(this, undefined)}
                        onDrop={this.handleItemDrop.bind(this, undefined)}
                    />
                );
            });
        } else {
            const elements = collectVNodes<IComponentProperties>(children);
            content = elements.map((item: VNode<IComponentProperties>, index: number): ComponentChild => {
                const {
                    id: childId = `${baseId}${index}`, onClick: childOnClick, onDrop: childOnDrop,
                } = item.props;

                return cloneElement(item, {
                    id: childId,
                    key: childId,
                    onClick: this.handleItemClick.bind(this, childOnClick),
                    onDrop: this.handleItemDrop.bind(this, childOnDrop),
                });
            });
        }

        return (
            <Container
                innerRef={this.containerRef}
                orientation={orientation}
                className={className}
                {...this.unhandledProperties}
            >
                <SelectorItem
                    innerRef={this.stepDownRef}
                    id={baseId + "stepDown"}
                    type="stepDown"
                    onClick={this.handleNavigationClick}
                />
                {content}
                <SelectorItem
                    innerRef={this.stepUpRef}
                    id={baseId + "stepUp"}
                    type="stepUp"
                    onClick={this.handleNavigationClick}
                />
            </Container>
        );
    }

    protected handleDragEvent(type: DragEventType, e: DragEvent): boolean {
        const element = e.currentTarget as HTMLElement;
        switch (type) {
            case DragEventType.Over: {
                e.preventDefault(); // Required or we get no drop event.
                break;
            }

            case DragEventType.Enter: {
                if (this.dragInsideCounter === 0) {
                    element.classList.add("dropTarget");
                }
                ++this.dragInsideCounter;
                e.stopPropagation(); // Required or parent elements will also get the drag events.

                break;
            }

            case DragEventType.Leave: {
                --this.dragInsideCounter;
                if (this.dragInsideCounter === 0) {
                    element.classList.remove("dropTarget");
                }
                e.stopPropagation();

                break;
            }

            case DragEventType.Drop: {
                this.dragInsideCounter = 0;
                element.classList.remove("dropTarget");
                e.preventDefault();

                break;
            }

            default:
        }

        return true;
    }

    private handleItemClick = (childOnClick: ClickEventCallback | undefined, e: MouseEvent | KeyboardEvent,
        props: Readonly<IComponentProperties>): void => {
        const { onSelect } = this.mergedProps;
        onSelect?.(props.id ?? "");

        childOnClick?.(e, props);
    };

    private handleItemDrop = (childOnDrop: DragEventCallback | undefined, e: DragEvent,
        props: IComponentProperties): void => {
        const { onDrop } = this.mergedProps;
        onDrop?.(e, props);

        childOnDrop?.(e, props);
    };

    private handleNavigationClick = (e: MouseEvent | KeyboardEvent, props: Readonly<IComponentProperties>): void => {
        const { wrapNavigation, onSelect } = this.mergedProps;

        let element: HTMLElement | undefined | null = e.currentTarget as HTMLElement;

        const selectorProps = props as Readonly<ISelectorItemProperties>;
        if (selectorProps.type === "stepDown") {
            if (!this.activeItemRef.current || (this.firstItemActive && wrapNavigation)) {
                // Nothing selected yet or at the beginning of the item list.
                // Select last item in this case.
                element = element.parentElement?.lastElementChild?.previousElementSibling as HTMLElement;
            } else {
                element = this.activeItemRef.current.previousElementSibling as HTMLElement;
            }
        } else {
            if (!this.activeItemRef.current || (this.lastItemActive && wrapNavigation)) {
                element = element.parentElement?.firstElementChild?.nextElementSibling as HTMLElement;
            } else {
                element = this.activeItemRef.current.nextElementSibling as HTMLElement;
            }
        }

        if (element !== e.currentTarget) {
            this.setState({ activeItem: element });
            onSelect?.(element?.id);
        }
    };

    // XXX: implement resize handling
    private handleResize = (): void => {
        this.scrollActiveItemIntoView();
        this.autoHideNavButtons();
    };

    private get isHorizontal(): boolean {
        const { orientation } = this.mergedProps;

        return orientation === Orientation.LeftToRight || orientation === Orientation.RightToLeft;
    }

    private get requiresScrolling(): boolean {
        if (!this.containerRef.current || this.containerRef.current.children.length < 3) {
            return false;
        }

        return this.isHorizontal
            ? this.containerRef.current.scrollWidth > this.containerRef.current.clientWidth
            : this.containerRef.current.scrollHeight > this.containerRef.current.clientHeight;
    }

    /**
     *  Scrolls the given element into view, but does it more intelligently than `Element.scrollIntoView`.
     */
    private scrollActiveItemIntoView(): void {
        if (!this.requiresScrolling || !this.containerRef.current || !this.activeItemRef.current) {
            return;
        }

        // At least one of the steppers must be visible. We assume here both have the same dimensions.
        const stepper = this.stepUpRef.current?.style.display !== "none"
            ? this.stepUpRef.current
            : this.stepDownRef.current;
        const stepperSize = this.isHorizontal ? stepper?.clientWidth : stepper?.clientHeight;

        const element = this.activeItemRef.current;
        const parent = element.parentElement;

        if (parent && stepperSize) {
            if (this.isHorizontal) {
                const oL = element?.offsetLeft;
                const sL = parent.scrollLeft;
                if (oL - sL < stepperSize) {
                    parent.scrollLeft += oL - sL - stepperSize;
                }

                const right = oL + element.clientWidth - sL;
                const cW = parent.clientWidth;
                if (right > cW - stepperSize) {
                    parent.scrollLeft += right - (cW - stepperSize);
                }
            } else {
                const oT = element?.offsetTop;
                const sT = parent.scrollTop;

                if (oT - sT < stepperSize) {
                    parent.scrollTop += oT - sT - stepperSize;
                }

                const bottom = oT + element.clientHeight - sT;
                const cH = parent.clientHeight;
                if (bottom > cH - stepperSize) {
                    parent.scrollTop += bottom - (cH - stepperSize);
                }
            }
        }
    }

    private get firstItemActive(): boolean {
        if (!this.stepDownRef.current) {
            return false;
        }

        const firstItem = this.stepDownRef.current?.nextElementSibling;

        return this.activeItemRef.current === firstItem;
    }

    private get lastItemActive(): boolean {
        if (!this.stepUpRef.current) {
            return false;
        }

        const lastItem = this.stepUpRef.current?.previousElementSibling;

        return this.activeItemRef.current === lastItem;
    }

    private autoHideNavButtons(): void {
        if (!this.stepDownRef.current || !this.stepUpRef.current) {
            return;
        }

        const { wrapNavigation } = this.mergedProps;

        if (!this.requiresScrolling) {
            this.stepDownRef.current.style.display = "none";
            this.stepUpRef.current.style.display = "none";
        } else if (!wrapNavigation) {
            const parent = this.stepDownRef.current.parentElement;
            const firstElement = this.stepDownRef.current?.nextElementSibling as HTMLElement;
            const lastElement = this.stepUpRef.current?.previousElementSibling as HTMLElement;

            if (parent) {
                if (this.isHorizontal) {
                    const scrollOffset = parent.scrollLeft;
                    let offsetLeft = firstElement.offsetLeft;
                    this.stepDownRef.current.style.display = (offsetLeft - scrollOffset) >= 0 ? "none" : "inherit";

                    const width = parent.offsetWidth;
                    offsetLeft = lastElement.offsetLeft;
                    const offsetWidth = lastElement.offsetWidth;
                    this.stepUpRef.current.style.display =
                        (offsetLeft + offsetWidth - scrollOffset) <= width ? "none" : "inherit";
                } else {
                    const scrollOffset = parent.scrollTop;
                    let offsetTop = firstElement.offsetTop;
                    this.stepDownRef.current.style.display = (offsetTop - scrollOffset) >= 0 ? "none" : "inherit";

                    const height = parent.offsetHeight;
                    offsetTop = lastElement.offsetTop;
                    const offsetHeight = lastElement.offsetHeight;
                    this.stepUpRef.current.style.display =
                        (offsetTop + offsetHeight - scrollOffset) <= height ? "none" : "inherit";
                }
            }
        }
    }

}
