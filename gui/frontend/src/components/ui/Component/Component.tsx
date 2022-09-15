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

import "./Component.css";

import React from "react";

import cx from "classnames";
import { isNil } from "lodash";
import { IDictionary } from "../../../app-logic/Types";

// Not all components support different sizes, but many do.
// This mostly affects text sizes and properties that depend on them (e.g. parent size).
export enum ComponentSize {
    Tiny = "tiny",
    Small = "small",
    Medium = "medium",
    Big = "big",
    Huge = "huge",
}

// The component placement determines at which of the 12 places relative to a given target rectangle or position
// a floating HTML element is located.
//
//                      ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
//                      │   Top Left    │ │  Top Center   │ │   Top Right   │
//                      └───────────────┘ └───────────────┘ └───────────────┘
//   ┌───────────────┐  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ┌───────────────┐
//   │   Left Top    │  ┃                                                   ┃  │  Right Top    │
//   └───────────────┘  ┃                                                   ┃  └───────────────┘
//   ┌───────────────┐  ┃                                                   ┃  ┌───────────────┐
//   │  Left Center  │  ┃                    target rect                    ┃  │  Right Center │
//   └───────────────┘  ┃                                                   ┃  └───────────────┘
//   ┌───────────────┐  ┃                                                   ┃  ┌───────────────┐
//   │  Left Bottom  │  ┃                                                   ┃  │  Right Bottom │
//   └───────────────┘  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  └───────────────┘
//                      ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
//                      │  Bottom Left  │ │ Bottom Center │ │ Bottom Right  │
//                      └───────────────┘ └───────────────┘ └───────────────┘
//
// Additionally, content is also aligned depending on the target place, like shown in the ASCII art. That means it is
// not possible to get mixed positions, like content element in the bottom right corner, but with its center instead
// of the right side.
export enum ComponentPlacement {
    TopLeft = "top-start",
    TopCenter = "top",
    TopRight = "top-end",

    RightTop = "right-start",
    RightCenter = "right",
    RightBottom = "right-end",

    BottomLeft = "bottom-start",
    BottomCenter = "bottom",
    BottomRight = "bottom-end",

    LeftTop = "left-start",
    LeftCenter = "left",
    LeftBottom = "left-end",
}

/** Specifies the type for the mouse event handler. */
export enum MouseEventType {
    Click,
    DoubleClick,
    Enter,
    Leave,
    Down,
    Up,
    Move,
}

/** Specifies the type for the keyboard event handler. */
export enum KeyboardEventType {
    Down,
    Up,
    Press,
}

/** Specifies the type for the pointer event handler. */
export enum PointerEventType {
    Down,
    Up,
    Move,
}

/** Specifies the type for the drag event handler. */
export enum DragEventType {
    Start,
    Over,
    Enter,
    Leave,
    Drop,
}

/** Item selection style in lists and similar. */
export enum SelectionType {
    /** Neither clickable, nor show any highlight on hover. */
    None,

    /** Not clickable, but show highlight on hover. */
    Highlight,

    /** Show highlight and allow to select at most one row. */
    Single,

    /** Show highlight and allow to select any number of rows. */
    Multi,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T> = new (...args: any) => T;

export interface IComponentProperties {
    children?: React.ReactNode | React.ReactNode[];

    /** Additional class names to apply for this component. */
    className?: string;
    id?: string;
    size?: ComponentSize;
    as?: Constructor<Component> | string;
    style?: React.CSSProperties;
    tabIndex?: number;
    draggable?: boolean;
    disabled?: boolean | ((props: IComponentProperties) => boolean);
    role?: string;

    /** For OS style tooltips. */
    title?: string;

    /**
     * Template handling: a template describes how a single element in a list of potentially many elements looks like.
     * The template is cloned for each list entry and gets assigned the element data for this list entry.
     * All nested components in such a cloned element receive the same element data.
     * This data is an object with fields that hold component properties. A component uses the properties for which it
     * has got a data ID. Multiple elements can use the same data ID.
     */
    dataId?: string;
    data?: { [key: string]: IComponentProperties };

    /** Clicks can be triggered by both mouse and keyboard events, hence we to use a common ancestor as event type. */
    onClick?: (e: React.SyntheticEvent, props: Readonly<IComponentProperties>) => void;
    onDoubleClick?: (e: React.MouseEvent, props: Readonly<IComponentProperties>) => void;
    onKeyDown?: (e: React.KeyboardEvent, props: Readonly<IComponentProperties>) => void;
    onKeyUp?: (e: React.KeyboardEvent, props: Readonly<IComponentProperties>) => void;
    onKeyPress?: (e: React.KeyboardEvent, props: Readonly<IComponentProperties>) => void;

    onFocus?: (e: React.SyntheticEvent, props: Readonly<IComponentProperties>) => void;
    onBlur?: (e: React.SyntheticEvent, props: Readonly<IComponentProperties>) => void;

    onMouseEnter?: (e: React.MouseEvent, props: Readonly<IComponentProperties>) => void;
    onMouseLeave?: (e: React.MouseEvent, props: Readonly<IComponentProperties>) => void;

    onMouseDown?: (e: React.MouseEvent, props: Readonly<IComponentProperties>) => void;
    onMouseUp?: (e: React.MouseEvent, props: Readonly<IComponentProperties>) => void;
    onMouseMove?: (e: React.MouseEvent, props: Readonly<IComponentProperties>) => void;
    onPointerDown?: (e: React.PointerEvent, props: Readonly<IComponentProperties>) => void;
    onPointerUp?: (e: React.PointerEvent, props: Readonly<IComponentProperties>) => void;
    onPointerMove?: (e: React.PointerEvent, props: Readonly<IComponentProperties>) => void;

    onDragStart?: (e: React.DragEvent<HTMLElement>, props: Readonly<IComponentProperties>) => void;
    onDragOver?: (e: React.DragEvent<HTMLElement>, props: Readonly<IComponentProperties>) => void;
    onDragEnter?: (e: React.DragEvent<HTMLElement>, props: Readonly<IComponentProperties>) => void;
    onDragLeave?: (e: React.DragEvent<HTMLElement>, props: Readonly<IComponentProperties>) => void;
    onDrop?: (e: React.DragEvent<HTMLElement>, props: Readonly<IComponentProperties>) => void;

}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IComponentState {
    // Nothing in this base component.
}

// The base of all our components. Provides some common functionality.
export class Component<P extends IComponentProperties = {}, S extends IComponentState = {}, SS = unknown>
    extends React.Component<P, S, SS> {

    // Properties that are implicitly handled by this class and should not be forwarded to
    // an HTML element during rendering.
    private handledProps: string[] = [];

    // A list of events that should always be connected, regardless whether there's a callback.
    // That's required for internal consumption of them.
    private forcedEvents = new Set<string>();

    public constructor(props: P) {
        super(props);

        this.addHandledProperties(
            "class",
            "className",
            "size",
            "as",
            "children",

            "onChange",
            "onConfirm",
            "onCancel",
            "onMouseEnter",
            "onMouseLeave",
            "onMouseDown",
            "onMouseUp",
            "onMouseMove",
            "onPointerDown",
            "onPointerUp",
            "onPointerMove",

            "onDragStart",
            "onDragOver",
            "onDragEnter",
            "onDragLeave",
            "onDrop",

            "onFocus",
            "onBlur",
            "onResize",
            "onClick",
            "onDoubleClick",
            "onKeyDown",
            "onKeyUp",
            "onKeyPress",
            "onAction",
            "onMount",
            "onUnmount",
            "onItemClick",
            "onOpen",
            "onClose",
            "onSelect",
        );
    }

    /**
     * Returns the properties from the component's props field, which are potentially overwritten by template data
     * (if there was something set).
     *
     * @returns Merged component properties.
     */
    public get mergedProps(): Readonly<P> {
        const { dataId, data } = this.props;

        if (dataId && data) {
            return Object.assign({}, this.props, data[dataId as string]) as P;
        }

        return this.props;
    }

    /**
     * Enabled this method if you need to find out what causes a state update for a component.
     *
     * @param state The new state to set.
     * @param callback The callback to trigger when the state update is finished.
     */
    /*
    public setState<K extends keyof S>(
        state: ((prevState: Readonly<S>, props: Readonly<P>) => (Pick<S, K> | S | null)) | (Pick<S, K> | S | null),
        callback?: () => void,
    ): void {
        super.setState(state, callback);
    }
    */

    /**
     * Constructs a CSS class name value out of the given base names, the framework class name,
     * some properties and any user supplied names.
     *
     * @param base The base names for a given component.
     *
     * @returns A string with CSS class names derived from a default and the given names.
     */
    protected getEffectiveClassNames(base: Array<string | undefined>): string {
        const { className } = this.props;

        return cx(
            "msg",
            base,
            className?.replace("msg ", ""), // Avoid duplicate msg class name in derived components.
            this.props.size,
        );
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    protected classFromProperty(value: unknown, c: string | string[]): string | undefined {
        if (isNil(value)) {
            return undefined;
        }

        if (c instanceof Array) {
            if (typeof value === "boolean") {
                return c[value ? 1 : 0];
            }

            return c[value as number];
        } else {
            if (!value) {
                return undefined;
            }
        }

        return c;
    }

    protected renderAs<T extends Component>(defaultType: Constructor<T> | string = "div"): unknown {
        return this.props.as ?? defaultType;
    }

    /**
     * Adds the names of properties to an internal list to denote that these are handled by the calling
     * component and do not have to be forwarded via `this.unhandledProperties`.
     *
     * @param properties The names that don't need forwarding.
     */
    protected addHandledProperties(...properties: string[]): void {
        this.handledProps.push(...properties);
    }

    /**
     * Events are only connected when there's a handler assigned to the associated callback. Descendants might need
     * to handle certain events internally, even if the user of the component has no callback assigned.
     * This method registers such events, to connect them unconditionally.
     *
     * @param events The names of events that must be connected, whatsoever.
     */
    protected connectEvents(...events: string[]): void {
        events.forEach((event: string) => {
            return this.forcedEvents.add(event);
        });
    }

    /**
     * Convenience method to connect drag/drop events in one call, as they usually are used together.
     */
    protected connectDragEvents(): void {
        this.forcedEvents.add("onDragStart");
        this.forcedEvents.add("onDragOver");
        this.forcedEvents.add("onDragEnter");
        this.forcedEvents.add("onDragLeave");
        this.forcedEvents.add("onDrop");
    }

    protected get unhandledProperties(): IDictionary {
        const result: IDictionary = {};

        for (const k in this.props) {
            if (!this.handledProps.includes(k)) {
                result[k] = this.props[k];
            }
        }

        // Add our custom event handlers only if we have a callback for them.
        if (this.props.onClick || this.forcedEvents.has("onClick")) {
            result.onClick = this.internalHandleMouseClick;
        }

        if (this.props.onDoubleClick || this.forcedEvents.has("onDoubleClick")) {
            result.onDoubleClick = this.internalHandleMouseDoubleClick;
        }

        if (this.props.onKeyDown || this.forcedEvents.has("onKeyDown")) {
            result.onKeyDown = this.internalHandleKeyDown;
        }

        if (this.props.onKeyUp || this.forcedEvents.has("onKeyUp")) {
            result.onKeyUp = this.internalHandleKeyUp;
        }

        if (this.props.onKeyPress || this.forcedEvents.has("onKeyPress")) {
            result.onKeyPress = this.internalHandleKeyPress;
        }

        if (this.props.onFocus || this.forcedEvents.has("onFocus")) {
            result.onFocus = this.internalHandleFocus;
        }

        if (this.props.onBlur || this.forcedEvents.has("onBlur")) {
            result.onBlur = this.internalHandleBlur;
        }

        if (this.props.onMouseEnter || this.forcedEvents.has("onMouseEnter")) {
            result.onMouseEnter = this.internalHandleMouseEnter;
        }

        if (this.props.onMouseLeave || this.forcedEvents.has("onMouseLeave")) {
            result.onMouseLeave = this.internalHandleMouseLeave;
        }

        if (this.props.onMouseDown || this.forcedEvents.has("onMouseDown")) {
            result.onMouseDown = this.internalHandleMouseDown;
        }

        if (this.props.onMouseUp || this.forcedEvents.has("onMouseUp")) {
            result.onMouseUp = this.internalHandleMouseUp;
        }

        if (this.props.onMouseMove || this.forcedEvents.has("onMouseMove")) {
            result.onMouseMove = this.internalHandleMouseMove;
        }

        if (this.props.onPointerDown || this.forcedEvents.has("onPointerDown")) {
            result.onPointerDown = this.internalHandlePointerDown;
        }

        if (this.props.onPointerUp || this.forcedEvents.has("onPointerUp")) {
            result.onPointerUp = this.internalHandlePointerUp;
        }

        if (this.props.onPointerMove || this.forcedEvents.has("onPointerMove")) {
            result.onPointerMove = this.internalHandlePointerMove;
        }

        if (this.props.onDragStart || this.forcedEvents.has("onDragStart")) {
            result.onDragStart = this.internalHandleDragStart;
        }

        if (this.props.onDragOver || this.forcedEvents.has("onDragOver")) {
            result.onDragOver = this.internalHandleDragOver;
        }

        if (this.props.onDragEnter || this.forcedEvents.has("onDragEnter")) {
            result.onDragEnter = this.internalHandleDragEnter;
        }

        if (this.props.onDragLeave || this.forcedEvents.has("onDragLeave")) {
            result.onDragLeave = this.internalHandleDragLeave;
        }

        if (this.props.onDrop || this.forcedEvents.has("onDrop")) {
            result.onDrop = this.internalHandleDrop;
        }

        return result;
    }

    /**
     * A central function for mouse events, which can be overridden by descendants to do custom handling.
     *
     * @param type The event type for which this method is called.
     * @param e The event that caused this call.
     *
     * @returns True if the associated callback function should be called.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected handleMouseEvent(type: MouseEventType, e: React.MouseEvent): boolean {
        return true;
    }

    /**
     * A central function for keyboard events, which can be overridden by descendants to do custom handling.
     *
     * @param type The event type for which this method is called.
     * @param e The event that caused this call.
     *
     * @returns True if the associated callback function should be called.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected handleKeyboardEvent(type: KeyboardEventType, e: React.KeyboardEvent): boolean {
        return true;
    }

    /**
     * A central function for pointer events, which can be overridden by descendants to do custom handling.
     *
     * @param type The event type for which this method is called.
     * @param e The event that caused this call.
     *
     * @returns True if the associated callback function should be called.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected handlePointerEvent(type: PointerEventType, e: React.PointerEvent): boolean {
        return true;
    }

    /**
     * A central function for drag/drop events, which can be overridden by descendants to do custom handling.
     *
     * @param type The event type for which this method is called.
     * @param e The event that caused this call.
     *
     * @returns True if the associated callback function should be called.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected handleDragEvent(type: DragEventType, e: React.DragEvent<HTMLElement>): boolean {
        return true;
    }

    private internalHandleMouseClick = (e: React.MouseEvent): void => {
        if (!this.isDisabled(e) && this.handleMouseEvent(MouseEventType.Click, e)) {
            const props = this.mergedProps;
            props.onClick?.(e, props);
        }
    };

    private internalHandleMouseDoubleClick = (e: React.MouseEvent): void => {
        if (!this.isDisabled(e) && this.handleMouseEvent(MouseEventType.DoubleClick, e)) {
            const props = this.mergedProps;
            props.onDoubleClick?.(e, props);
        }
    };

    private internalHandleKeyDown = (e: React.KeyboardEvent): void => {
        if (!this.isDisabled(e) && this.handleKeyboardEvent(KeyboardEventType.Down, e)) {
            const props = this.mergedProps;
            props.onKeyDown?.(e, props);
        }
    };

    private internalHandleKeyUp = (e: React.KeyboardEvent): void => {
        if (!this.isDisabled(e) && this.handleKeyboardEvent(KeyboardEventType.Up, e)) {
            const props = this.mergedProps;
            props.onKeyUp?.(e, props);
        }
    };

    private internalHandleKeyPress = (e: React.KeyboardEvent): void => {
        if (!this.isDisabled(e) && this.handleKeyboardEvent(KeyboardEventType.Press, e)) {
            const props = this.mergedProps;
            props.onKeyPress?.(e, props);
        }
    };

    private internalHandleFocus = (e: React.SyntheticEvent): void => {
        const props = this.mergedProps;
        props.onFocus?.(e, props);
    };

    private internalHandleBlur = (e: React.SyntheticEvent): void => {
        const props = this.mergedProps;
        props.onBlur?.(e, props);
    };

    private internalHandleMouseEnter = (e: React.MouseEvent): void => {
        if (!this.isDisabled(e) && this.handleMouseEvent(MouseEventType.Enter, e)) {
            const props = this.mergedProps;
            props.onMouseEnter?.(e, props);
        }
    };

    private internalHandleMouseLeave = (e: React.MouseEvent): void => {
        if (!this.isDisabled(e) && this.handleMouseEvent(MouseEventType.Leave, e)) {
            const props = this.mergedProps;
            props.onMouseLeave?.(e, props);
        }
    };

    private internalHandleMouseDown = (e: React.MouseEvent): void => {
        if (!this.isDisabled(e) && this.handleMouseEvent(MouseEventType.Down, e)) {
            const props = this.mergedProps;
            props.onMouseDown?.(e, props);
        }
    };

    private internalHandleMouseUp = (e: React.MouseEvent): void => {
        if (!this.isDisabled(e) && this.handleMouseEvent(MouseEventType.Up, e)) {
            const props = this.mergedProps;
            props.onMouseUp?.(e, props);
        }
    };

    private internalHandleMouseMove = (e: React.MouseEvent): void => {
        if (!this.isDisabled(e) && this.handleMouseEvent(MouseEventType.Move, e)) {
            const props = this.mergedProps;
            props.onMouseMove?.(e, props);
        }
    };

    private internalHandlePointerDown = (e: React.PointerEvent): void => {
        if (!this.isDisabled(e) && this.handlePointerEvent(PointerEventType.Down, e)) {
            const props = this.mergedProps;
            props.onPointerDown?.(e, props);
        }
    };

    private internalHandlePointerUp = (e: React.PointerEvent): void => {
        if (!this.isDisabled(e) && this.handlePointerEvent(PointerEventType.Up, e)) {
            const props = this.mergedProps;
            props.onPointerUp?.(e, props);
        }
    };

    private internalHandlePointerMove = (e: React.PointerEvent): void => {
        if (!this.isDisabled(e) && this.handlePointerEvent(PointerEventType.Move, e)) {
            const props = this.mergedProps;
            props.onPointerMove?.(e, props);
        }
    };

    private internalHandleDragStart = (e: React.DragEvent<HTMLElement>): void => {
        if (!this.isDisabled(e) && this.handleDragEvent(DragEventType.Start, e)) {
            const props = this.mergedProps;
            props.onDragStart?.(e, props);
        }
    };

    private internalHandleDragOver = (e: React.DragEvent<HTMLElement>): void => {
        if (this.handleDragEvent(DragEventType.Over, e)) {
            const props = this.mergedProps;
            props.onDragOver?.(e, props);
        }
    };

    private internalHandleDragEnter = (e: React.DragEvent<HTMLElement>): void => {
        if (!this.isDisabled(e) && this.handleDragEvent(DragEventType.Enter, e)) {
            const props = this.mergedProps;
            props.onDragEnter?.(e, props);
        }
    };

    private internalHandleDragLeave = (e: React.DragEvent<HTMLElement>): void => {
        if (!this.isDisabled(e) && this.handleDragEvent(DragEventType.Leave, e)) {
            const props = this.mergedProps;
            props.onDragLeave?.(e, props);
        }
    };

    private internalHandleDrop = (e: React.DragEvent<HTMLElement>): void => {
        if (!this.isDisabled(e) && this.handleDragEvent(DragEventType.Drop, e)) {
            const props = this.mergedProps;
            props.onDrop?.(e, props);
        }
    };

    private isDisabled(e: React.UIEvent | React.SyntheticEvent): boolean {
        if (this.props.disabled) {
            e.preventDefault();

            return true;
        }

        return false;
    }
}
