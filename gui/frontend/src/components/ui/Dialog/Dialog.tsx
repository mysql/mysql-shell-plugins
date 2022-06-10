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

import "./Dialog.css";

import React from "react";

import { Component, IComponentProperties, IPortalOptions, Portal } from "..";
import { DialogContent } from "./DialogContent";

// Describes a collection of react nodes that should be rendered in an action area, separated
// by their alignment.
export interface IDialogActions {
    begin?: React.ReactNode[]; // Top/Left aligned content.
    end?: React.ReactNode[];   // Ditto for right/bottom.
}

export interface IDialogProperties extends IComponentProperties {
    content?: React.ReactNode;
    header?: React.ReactNode;
    caption?: React.ReactNode;
    container?: HTMLElement; // A node where to mount the dialog to.

    actions?: IDialogActions;

    onClose?: (cancelled: boolean, props: IDialogProperties) => void;
    onOpen?: (props: IDialogProperties) => void;
}

// A modal popup component to interact with the user (e.g. in wizards or task lists).
// For value editing with input validation see ValueEditDialog instead.
export class Dialog extends Component<IDialogProperties> {

    public static defaultProps = {
        container: document.body,
    };

    private portalRef = React.createRef<Portal>();

    public constructor(props: IDialogProperties) {
        super(props);

        this.addHandledProperties("content", "header", "caption", "container", "actions");
    }

    public render(): React.ReactNode {
        const { children, caption, header, content, actions, container } = this.mergedProps;

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
        const { onClose } = this.mergedProps;

        onClose?.(cancelled, this.mergedProps);

        this.setState({ open: false });
    };

    private handleOpen = (): void => {
        const { onOpen } = this.mergedProps;

        onOpen?.(this.mergedProps);
    };

    private handleCloseClick = (): void => {
        this.close(true);
    };
}
