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

import "./Dialog.css";

import { ComponentChild, createRef } from "preact";

import { ComponentBase, IComponentProperties } from "../Component/ComponentBase.js";
import { IPortalOptions, Portal } from "../Portal/Portal.js";
import { DialogContent } from "./DialogContent.js";

// Describes a collection of react nodes that should be rendered in an action area, separated
// by their alignment.
export interface IDialogActions {
    begin?: ComponentChild[]; // Top/Left aligned content.
    end?: ComponentChild[];   // Ditto for right/bottom.
}

interface IDialogProperties extends IComponentProperties {
    content?: ComponentChild;
    header?: ComponentChild;
    caption?: ComponentChild;
    container?: HTMLElement; // A node where to mount the dialog to.

    actions?: IDialogActions;

    onClose?: (cancelled: boolean, props: IDialogProperties) => void;
    onOpen?: (props: IDialogProperties) => void;
}

// A modal popup component to interact with the user (e.g. in wizards or task lists).
// For value editing with input validation see ValueEditDialog instead.
export class Dialog extends ComponentBase<IDialogProperties> {

    public static override defaultProps = {
        container: document.body,
    };

    private portalRef = createRef<Portal>();

    public constructor(props: IDialogProperties) {
        super(props);

        this.addHandledProperties("content", "header", "caption", "container", "actions");
    }

    public render(): ComponentChild {
        const { children, caption, header, content, actions, container } = this.props;

        const className = this.getEffectiveClassNames([]); // Dialog class name is handled in the DialogContent class.

        return (
            <Portal
                ref={this.portalRef}
                container={container}

                onClose={this.handleClose}
                onOpen={this.handleOpen}

                {...this.unhandledProperties}
            >
                <DialogContent
                    className={className}
                    caption={caption}
                    header={header}
                    content={content}
                    actions={actions}
                    draggable
                    onCloseClick={this.handleCloseClick}
                >
                    {children}
                </DialogContent>
            </Portal>
        );
    }

    public open(options?: IPortalOptions): void {
        this.portalRef.current?.open({
            backgroundOpacity: 0.5,
            ...options,
        });
    }

    public close(cancelled: boolean): void {
        this.portalRef.current?.close(cancelled);
    }

    private handleClose = (cancelled: boolean): void => {
        const { onClose } = this.props;

        onClose?.(cancelled, this.props);

        this.setState({ open: false });
    };

    private handleOpen = (): void => {
        const { onOpen } = this.props;

        onOpen?.(this.props);
    };

    private handleCloseClick = (): void => {
        this.close(true);
    };
}
