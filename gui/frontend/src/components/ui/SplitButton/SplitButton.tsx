/*
 * Copyright (c) 2020, 2026, Oracle and/or its affiliates.
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

import "./SplitButton.css";

import { cloneElement, ComponentChild, createRef, type VNode } from "preact";

import { requisitions } from "../../../supplement/Requisitions.js";
import type { IRequestTypeMap } from "../../../supplement/RequisitionTypes.js";
import { KeyboardKeys } from "../../../utilities/helpers.js";
import { Codicon } from "../Codicon.js";
import { ComponentBase, ComponentPlacement, type IComponentProperties } from "../Component/ComponentBase.js";
import { Icon } from "../Icon/Icon.js";
import { Menu, type IMenuProperties } from "../Menu/Menu.js";

export interface ISplitButtonProperties extends IComponentProperties {
    innerRef?: preact.RefObject<HTMLDivElement>;

    caption?: string;

    /** If set this button gets a different background. */
    isDefault?: boolean;

    /** Buttons can automatically trigger requests, if no parameter is required. */
    requestType?: keyof IRequestTypeMap;

    focusOnClick?: boolean;

    menu: VNode<IMenuProperties>;
}

export class SplitButton extends ComponentBase<ISplitButtonProperties> {
    private readonly containerRef: preact.RefObject<HTMLDivElement>;
    private readonly primaryRef = createRef<HTMLDivElement>();
    private readonly triggerRef = createRef<HTMLDivElement>();
    private readonly menuRef = createRef<Menu>();

    public constructor(props: ISplitButtonProperties) {
        super(props);

        this.addHandledProperties("caption", "menu", "innerRef", "requestType", "focusOnClick", "isDefault",
            "disabled", "tabIndex");

        this.containerRef = props.innerRef ?? createRef<HTMLDivElement>();
    }

    public render(): ComponentChild {
        const { children, caption, disabled, isDefault, menu } = this.props;

        const className = this.getEffectiveClassNames([
            "splitButton",
            this.classFromProperty(disabled, "disabled"),
            this.classFromProperty(isDefault, "default"),
        ]);

        const content = children ?? caption;
        const outerProps = { ...this.unhandledProperties };
        delete outerProps.onBlur;
        delete outerProps.onClick;
        delete outerProps.onDoubleClick;
        delete outerProps.onDragEnter;
        delete outerProps.onDragLeave;
        delete outerProps.onDragOver;
        delete outerProps.onDragStart;
        delete outerProps.onDrop;
        delete outerProps.onFocus;
        delete outerProps.onKeyDown;
        delete outerProps.onKeyPress;
        delete outerProps.onKeyUp;
        delete outerProps.onMouseDown;
        delete outerProps.onMouseEnter;
        delete outerProps.onMouseLeave;
        delete outerProps.onMouseMove;
        delete outerProps.onMouseUp;
        delete outerProps.onPointerDown;
        delete outerProps.onPointerMove;
        delete outerProps.onPointerUp;

        const renderedMenu = cloneElement(menu, {
            ref: this.menuRef,
            placement: menu.props.placement ?? ComponentPlacement.BottomRight,
        });

        return (
            <>
                <div
                    ref={this.containerRef}
                    className={className}
                    {...outerProps}
                >
                    <div
                        ref={this.primaryRef}
                        className="splitButtonPrimary"
                        tabIndex={0}
                        role="button"
                        onMouseDown={this.handlePrimaryMouseDown}
                        onClick={this.handlePrimaryClick}
                        onKeyDown={this.handlePrimaryKeyDown}
                    >
                        {content}
                    </div>
                    <div
                        ref={this.triggerRef}
                        className="splitButtonTrigger"
                        tabIndex={0}
                        role="button"
                        aria-haspopup="menu"
                        onMouseDown={this.handleTriggerMouseDown}
                        onClick={this.handleTriggerClick}
                        onKeyDown={this.handleTriggerKeyDown}
                    >
                        <Icon src={Codicon.ChevronDown} />
                    </div>
                </div>
                {renderedMenu}
            </>
        );
    }

    private focusSegment = (segment: preact.RefObject<HTMLDivElement>, e: MouseEvent): void => {
        if (this.props.disabled) {
            return;
        }

        const { focusOnClick } = this.props;
        if (focusOnClick) {
            segment.current?.focus();
        } else {
            e.preventDefault();
        }
    };

    private runPrimaryAction = (e: MouseEvent | KeyboardEvent): void => {
        if (this.props.disabled) {
            return;
        }

        const { onClick, requestType } = this.props;
        e.stopPropagation();

        if (requestType) {
            void requisitions.execute(requestType, undefined);

            return;
        }

        onClick?.(e, this.props);
    };

    private openMenu = (activateFirstEntry: boolean, e: MouseEvent | KeyboardEvent): void => {
        if (this.props.disabled) {
            return;
        }

        e.stopPropagation();

        const targetRect = this.menuRef.current?.props.useNativeMenu === false || e instanceof KeyboardEvent
            ? this.triggerRef.current?.getBoundingClientRect()
                ?? this.containerRef.current?.getBoundingClientRect()
            : this.menuAnchorRect(e.clientX, e.clientY);
        if (!targetRect) {
            return;
        }

        this.menuRef.current?.close();
        this.menuRef.current?.open(targetRect, activateFirstEntry);
    };

    private menuAnchorRect = (x: number, y: number, width = 2, height = 2): DOMRect => {
        return {
            x,
            y,
            width,
            height,
            left: x,
            top: y,
            right: x + width,
            bottom: y + height,
            toJSON: () => {
                return { x, y, width, height };
            },
        } as DOMRect;
    };

    private handlePrimaryMouseDown = (e: MouseEvent): void => {
        this.focusSegment(this.primaryRef, e);
    };

    private handlePrimaryClick = (e: MouseEvent): void => {
        this.runPrimaryAction(e);
    };

    private handlePrimaryKeyDown = (e: KeyboardEvent): void => {
        switch (e.key) {
            case KeyboardKeys.Enter:
            case KeyboardKeys.Space: {
                e.preventDefault();
                this.runPrimaryAction(e);

                break;
            }

            default:
        }
    };

    private handleTriggerMouseDown = (e: MouseEvent): void => {
        this.focusSegment(this.triggerRef, e);
    };

    private handleTriggerClick = (e: MouseEvent): void => {
        this.openMenu(false, e);
    };

    private handleTriggerKeyDown = (e: KeyboardEvent): void => {
        switch (e.key) {
            case KeyboardKeys.ArrowDown:
            case KeyboardKeys.Enter:
            case KeyboardKeys.Space: {
                e.preventDefault();
                this.openMenu(true, e);

                break;
            }

            default:
        }
    };
}
