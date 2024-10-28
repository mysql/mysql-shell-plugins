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

import "./ComponentBase.css";

import { Component, ComponentChildren } from "preact";
import cx from "classnames";

import { IDictionary } from "../../../app-logic/general-types.js";
import { CSSProperties } from "preact/compat";

/**
 * Not all components support different sizes, but many do.
 * This mostly affects text sizes and properties that depend on them (e.g. parent size).
 */
export enum ComponentSize {
    Tiny = "tiny",
    Small = "small",
    Medium = "medium",
    Big = "big",
    Huge = "huge",
}

/**
 * The component placement determines at which of the 12 places relative to a given target rectangle or position
 * a floating HTML element is located.
 *```
 *                      ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
 *                      │   Top Left    │ │  Top Center   │ │   Top Right   │
 *                      └───────────────┘ └───────────────┘ └───────────────┘
 *   ┌───────────────┐  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ┌───────────────┐
 *   │   Left Top    │  ┃                                                   ┃  │  Right Top    │
 *   └───────────────┘  ┃                                                   ┃  └───────────────┘
 *   ┌───────────────┐  ┃                                                   ┃  ┌───────────────┐
 *   │  Left Center  │  ┃                    target rect                    ┃  │  Right Center │
 *   └───────────────┘  ┃                                                   ┃  └───────────────┘
 *   ┌───────────────┐  ┃                                                   ┃  ┌───────────────┐
 *   │  Left Bottom  │  ┃                                                   ┃  │  Right Bottom │
 *   └───────────────┘  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  └───────────────┘
 *                      ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
 *                      │  Bottom Left  │ │ Bottom Center │ │ Bottom Right  │
 *                      └───────────────┘ └───────────────┘ └───────────────┘
 *```
 * Additionally, content is also aligned depending on the target place, like shown in the ASCII art. That means it is
 * not possible to get mixed positions, like content element in the bottom right corner, but with its center instead
 * of the right side.
 */
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

export enum FocusEventType {
    Focus,
    Blur,
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

// Click events can also be triggered using the keyboard.
export type ClickEventCallback = (e: MouseEvent | KeyboardEvent, props: Readonly<IComponentProperties>) => void;
export type MouseEventCallback = (e: MouseEvent, props: Readonly<IComponentProperties>) => void;
export type KeyboardEventCallback = (e: KeyboardEvent, props: Readonly<IComponentProperties>) => void;
export type PointerEventCallback = (e: PointerEvent, props: Readonly<IComponentProperties>) => void;
export type DragEventCallback = (e: DragEvent, props: Readonly<IComponentProperties>) => void;

export interface IComponentProperties {
    children?: ComponentChildren;

    /** Additional class names to apply for this component. */
    className?: string;
    id?: string;
    size?: ComponentSize;
    style?: CSSProperties;
    tabIndex?: number;
    draggable?: boolean;
    disabled?: boolean;
    role?: string;

    /** For OS style tooltips. */
    title?: string;

    /** Clicks can be triggered by both mouse and keyboard events. */
    onClick?: ClickEventCallback;
    onDoubleClick?: MouseEventCallback;
    onKeyDown?: KeyboardEventCallback;
    onKeyUp?: KeyboardEventCallback;
    onKeyPress?: KeyboardEventCallback;

    onFocus?: (e: FocusEvent, props: Readonly<IComponentProperties>) => void;
    onBlur?: (e: FocusEvent, props: Readonly<IComponentProperties>) => void;

    onMouseEnter?: MouseEventCallback;
    onMouseLeave?: MouseEventCallback;

    onMouseDown?: MouseEventCallback;
    onMouseUp?: MouseEventCallback;
    onMouseMove?: MouseEventCallback;
    onPointerDown?: PointerEventCallback;
    onPointerUp?: PointerEventCallback;
    onPointerMove?: PointerEventCallback;

    onDragStart?: DragEventCallback;
    onDragOver?: DragEventCallback;
    onDragEnter?: DragEventCallback;
    onDragLeave?: DragEventCallback;
    onDrop?: DragEventCallback;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IComponentState {
    // Nothing in this base component.
}

/** A structure to define how a component snapshot may look like. */
export interface IComponentSnapshot extends IDictionary {
    scrollPosition?: number;
}

/** The base of all our components. Provides some common functionality. */
export abstract class ComponentBase<P extends IComponentProperties = {}, S extends IComponentState = {}>
    extends Component<P, S> {

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

    /* Use to debug setState calls.
    public override setState<K extends keyof S>(
        state:
            | ((
                prevState: Readonly<S>,
                props: Readonly<P>
            ) => Pick<S, K> | Partial<S> | null)
            | (Pick<S, K> | Partial<S> | null),
        callback?: () => void,
    ): void {
        super.setState(state, callback);
    }
    //*/

    /**
     * Promisified version of `setState`.
     *
     * @param state The new state to set.
     *
     * @returns A promise which resolves when the `setState` action finished.
     */
    public setStatePromise<K extends keyof S>(
        state: ((prevState: Readonly<S>, props: Readonly<P>) => (Pick<S, K> | S | null)) | (Pick<S, K> | S | null),
    ): Promise<void> {
        return new Promise((resolve) => {
            super.setState(state, resolve);
        });
    }

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

    /**
     * Conditionally returns a CSS class name from a list of names or a single name.
     *
     * @param value A value that must be truthy to return a class name.
     * @param c A single class name or a list of class names. If the value is a boolean, the list must have two entries.
     *
     * @returns The class name or undefined, depending on the truthiness of the value.
     */
    protected classFromProperty(value: unknown, c: string | string[]): string | undefined {
        if (value == null) {
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

        for (const [key, value] of Object.entries(this.props)) {
            if (!this.handledProps.includes(key)) {
                result[key] = value;
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
    protected handleMouseEvent(type: MouseEventType, e: MouseEvent): boolean {
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
    protected handleKeyboardEvent(type: KeyboardEventType, e: KeyboardEvent): boolean {
        return true;
    }

    /**
     * A central function for focus events (in and out), which can be overridden by descendants to do custom handling.
     *
     * @param type The event type for which this method is called.
     * @param e The event that caused this call.
     *
     * @returns True if the associated callback function should be called.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected handleFocusEvent(type: FocusEventType, e: FocusEvent): boolean {
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
    protected handlePointerEvent(type: PointerEventType, e: PointerEvent): boolean {
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
    protected handleDragEvent(type: DragEventType, e: DragEvent): boolean {
        return true;
    }

    private internalHandleMouseClick = (e: MouseEvent): void => {
        if (!this.isDisabled(e) && this.handleMouseEvent(MouseEventType.Click, e)) {
            const props = this.props;
            props.onClick?.(e, props);
        }
    };

    private internalHandleMouseDoubleClick = (e: MouseEvent): void => {
        if (!this.isDisabled(e) && this.handleMouseEvent(MouseEventType.DoubleClick, e)) {
            const props = this.props;
            props.onDoubleClick?.(e, props);
        }
    };

    private internalHandleKeyDown = (e: KeyboardEvent): void => {
        if (!this.isDisabled(e) && this.handleKeyboardEvent(KeyboardEventType.Down, e)) {
            const props = this.props;
            props.onKeyDown?.(e, props);
        }
    };

    private internalHandleKeyUp = (e: KeyboardEvent): void => {
        if (!this.isDisabled(e) && this.handleKeyboardEvent(KeyboardEventType.Up, e)) {
            const props = this.props;
            props.onKeyUp?.(e, props);
        }
    };

    private internalHandleKeyPress = (e: KeyboardEvent): void => {
        if (!this.isDisabled(e) && this.handleKeyboardEvent(KeyboardEventType.Press, e)) {
            const props = this.props;
            props.onKeyPress?.(e, props);
        }
    };

    private internalHandleFocus = (e: FocusEvent): void => {
        if (!this.isDisabled(e) && this.handleFocusEvent(FocusEventType.Focus, e)) {
            const props = this.props;
            props.onFocus?.(e, props);
        }
    };

    private internalHandleBlur = (e: FocusEvent): void => {
        if (!this.isDisabled(e) && this.handleFocusEvent(FocusEventType.Blur, e)) {
            const props = this.props;
            props.onBlur?.(e, props);
        }
    };

    private internalHandleMouseEnter = (e: MouseEvent): void => {
        if (!this.isDisabled(e) && this.handleMouseEvent(MouseEventType.Enter, e)) {
            const props = this.props;
            props.onMouseEnter?.(e, props);
        }
    };

    private internalHandleMouseLeave = (e: MouseEvent): void => {
        if (!this.isDisabled(e) && this.handleMouseEvent(MouseEventType.Leave, e)) {
            const props = this.props;
            props.onMouseLeave?.(e, props);
        }
    };

    private internalHandleMouseDown = (e: MouseEvent): void => {
        if (!this.isDisabled(e) && this.handleMouseEvent(MouseEventType.Down, e)) {
            const props = this.props;
            props.onMouseDown?.(e, props);
        }
    };

    private internalHandleMouseUp = (e: MouseEvent): void => {
        if (!this.isDisabled(e) && this.handleMouseEvent(MouseEventType.Up, e)) {
            const props = this.props;
            props.onMouseUp?.(e, props);
        }
    };

    private internalHandleMouseMove = (e: MouseEvent): void => {
        if (!this.isDisabled(e) && this.handleMouseEvent(MouseEventType.Move, e)) {
            const props = this.props;
            props.onMouseMove?.(e, props);
        }
    };

    private internalHandlePointerDown = (e: PointerEvent): void => {
        if (!this.isDisabled(e) && this.handlePointerEvent(PointerEventType.Down, e)) {
            const props = this.props;
            props.onPointerDown?.(e, props);
        }
    };

    private internalHandlePointerUp = (e: PointerEvent): void => {
        if (!this.isDisabled(e) && this.handlePointerEvent(PointerEventType.Up, e)) {
            const props = this.props;
            props.onPointerUp?.(e, props);
        }
    };

    private internalHandlePointerMove = (e: PointerEvent): void => {
        if (!this.isDisabled(e) && this.handlePointerEvent(PointerEventType.Move, e)) {
            const props = this.props;
            props.onPointerMove?.(e, props);
        }
    };

    private internalHandleDragStart = (e: DragEvent): void => {
        if (!this.isDisabled(e) && this.handleDragEvent(DragEventType.Start, e)) {
            const props = this.props;
            props.onDragStart?.(e, props);
        }
    };

    private internalHandleDragOver = (e: DragEvent): void => {
        if (this.handleDragEvent(DragEventType.Over, e)) {
            const props = this.props;
            props.onDragOver?.(e, props);
        }
    };

    private internalHandleDragEnter = (e: DragEvent): void => {
        if (!this.isDisabled(e) && this.handleDragEvent(DragEventType.Enter, e)) {
            const props = this.props;
            props.onDragEnter?.(e, props);
        }
    };

    private internalHandleDragLeave = (e: DragEvent): void => {
        if (!this.isDisabled(e) && this.handleDragEvent(DragEventType.Leave, e)) {
            const props = this.props;
            props.onDragLeave?.(e, props);
        }
    };

    private internalHandleDrop = (e: DragEvent): void => {
        if (!this.isDisabled(e) && this.handleDragEvent(DragEventType.Drop, e)) {
            const props = this.props;
            props.onDrop?.(e, props);
        }
    };

    private isDisabled(e: UIEvent | MouseEvent): boolean {
        if (this.props.disabled) {
            e.preventDefault();

            return true;
        }

        return false;
    }
}
