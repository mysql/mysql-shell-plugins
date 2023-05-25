/*
 * Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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

import closeButton from "../../../assets/images/close2.svg";

import { ComponentChild, createRef } from "preact";

import { IComponentProperties, ComponentBase, IComponentSnapshot } from "../Component/ComponentBase";
import { Container, Orientation } from "../Container/Container";
import { Icon } from "../Icon/Icon";
import { IDialogActions } from "./Dialog";
import { Button } from "../Button/Button";

interface IDialogContentProperties extends IComponentProperties {
    content?: ComponentChild;
    header?: ComponentChild;
    caption?: ComponentChild;
    actions?: IDialogActions;

    onCloseClick?: () => void;
}

// This component is the separated-out content for a dialog, but can be rendered anywhere.
export class DialogContent extends ComponentBase<IDialogContentProperties> {
    #contentRef = createRef<HTMLDivElement>();

    public constructor(props: IDialogContentProperties) {
        super(props);

        this.addHandledProperties("content", "header", "caption", "actions", "onCloseClick");
    }

    public getSnapshotBeforeUpdate(): IComponentSnapshot | null {
        if (this.#contentRef.current) {
            const content = this.#contentRef.current;

            return {
                scrollPosition: content.scrollHeight - content.scrollTop,
            };
        }

        return null;
    }

    public componentDidUpdate(prevProps: IDialogContentProperties, prevState: never,
        snapshot: IComponentSnapshot | null): void {
        if (snapshot !== null && this.#contentRef.current) {
            const content = this.#contentRef.current;
            content.scrollTop = content.scrollHeight - (snapshot.scrollPosition ?? 0);
        }
    }

    public render(): ComponentChild {
        const { children, content, header, caption, actions } = this.mergedProps;
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
                            <Icon src={closeButton} />
                        </Button>
                    </div>
                    }
                    {header && <div className="header">{header}</div>}
                    {content && <div ref={this.#contentRef} className="content fixedScrollbar">{content}</div>}
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
                className={className}
                {...this.unhandledProperties}
            >
                {dialogContent}
            </div>
        );
    }

    private handleCloseClick = () => {
        const { onCloseClick } = this.props;

        onCloseClick?.();
    };
}
