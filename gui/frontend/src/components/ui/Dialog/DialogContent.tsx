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

import { Assets } from "../../../supplement/Assets.js";
import { Button } from "../Button/Button.js";
import {
    ComponentBase, IComponentProperties, IComponentSnapshot, PointerEventType,
} from "../Component/ComponentBase.js";
import { Container, Orientation } from "../Container/Container.js";
import { Icon } from "../Icon/Icon.js";
import { IDialogActions } from "./Dialog.js";

interface IDialogContentProperties extends IComponentProperties {
    content?: ComponentChild;
    header?: ComponentChild;
    caption?: ComponentChild;
    actions?: IDialogActions;

    onCloseClick?: () => void;
}

/** This component is the separated-out content for a dialog, but can be rendered anywhere. */
export class DialogContent extends ComponentBase<IDialogContentProperties> {
    private contentRef = createRef<HTMLDivElement>();
    private innerRef = createRef<HTMLDivElement>();

    private isDragging = false;
    private dragStartX = -1;
    private dragStartY = -1;
    private lastDeltaX = 0;
    private lastDeltaY = 0;

    public constructor(props: IDialogContentProperties) {
        super(props);

        this.addHandledProperties("content", "header", "caption", "actions", "onCloseClick", "draggable");

        if (props.draggable) {
            this.connectEvents("onPointerDown", "onPointerMove", "onPointerUp");
        }
    }

    public override getSnapshotBeforeUpdate(): IComponentSnapshot | null {
        if (this.contentRef.current) {
            const content = this.contentRef.current;

            return {
                scrollPosition: content.scrollHeight - content.scrollTop,
            };
        }

        return null;
    }

    public override componentDidUpdate(prevProps: IDialogContentProperties, prevState: never,
        snapshot: IComponentSnapshot | null): void {
        if (snapshot !== null && this.contentRef.current) {
            const content = this.contentRef.current;
            content.scrollTop = content.scrollHeight - (snapshot.scrollPosition ?? 0);
        }
    }

    public render(): ComponentChild {
        const { children, content, header, caption, actions } = this.props;
        const className = this.getEffectiveClassNames(["dialog", "visible"]);

        let dialogContent;
        if (children != null) {
            dialogContent = children;
        } else {
            dialogContent = (
                <>
                    {caption && <div className="title verticalCenterContent">
                        {caption}
                        <Button id="closeButton"
                            imageOnly
                            onClick={this.handleCloseClick}
                        >
                            <Icon src={Assets.misc.close2Icon} />
                        </Button>
                    </div>
                    }
                    {header && <div className="header">{header}</div>}
                    {content && <div ref={this.contentRef} className="content fixedScrollbar">{content}</div>}
                    {actions &&
                        <div className="footer verticalCenterContent">
                            <Container
                                className="leftItems"
                                orientation={Orientation.LeftToRight}
                            >
                                {actions?.begin}
                            </Container>
                            <Container
                                className="rightItems"
                                orientation={Orientation.RightToLeft}
                            >
                                {actions?.end}
                            </Container>

                        </div>}
                </>
            );
        }

        return (
            <div
                ref={this.innerRef}
                className={className}
                {...this.unhandledProperties}
            >
                {dialogContent}
            </div>
        );
    }

    protected override handlePointerEvent(type: PointerEventType, e: PointerEvent): boolean {
        const element = e.currentTarget as HTMLElement;
        switch (type) {
            case PointerEventType.Down: {
                if (element === this.innerRef.current && (e.target as HTMLElement).classList.contains("title")) {
                    this.isDragging = true;

                    this.dragStartX = e.clientX - this.lastDeltaX;
                    this.dragStartY = e.clientY - this.lastDeltaY;

                    element.setPointerCapture(e.pointerId);
                }

                return true;
            }

            case PointerEventType.Move: {
                if (this.isDragging) {
                    e.stopPropagation();

                    this.lastDeltaX = e.clientX - this.dragStartX;
                    this.lastDeltaY = e.clientY - this.dragStartY;
                    this.innerRef.current!.style.transform = `translate(calc(-50% + ${this.lastDeltaX}px), ` +
                        `calc(-50% + ${this.lastDeltaY}px))`;
                }

                return true;
            }

            case PointerEventType.Up: {
                if (this.isDragging) {
                    this.isDragging = false;
                    element.releasePointerCapture(e.pointerId);
                }

                return true;
            }

            default:
        }

        return false;
    }

    private handleCloseClick = () => {
        const { onCloseClick } = this.props;

        onCloseClick?.();
    };
}
