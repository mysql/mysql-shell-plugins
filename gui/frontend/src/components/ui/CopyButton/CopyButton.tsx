/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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

import "./CopyButton.css";

import { ComponentChild } from "preact";

import { requisitions } from "../../../supplement/Requisitions.js";
import { Button, IButtonProperties } from "../Button/Button.js";
import { Codicon } from "../Codicon.js";
import { ComponentBase, IComponentState } from "../Component/ComponentBase.js";
import { Icon } from "../Icon/Icon.js";

export interface ICopyButtonProperties extends IButtonProperties {
    value: string | (() => string);
}

interface ICopyButtonState extends IComponentState {
    copied: boolean;
}

/** A standard icon-only button that copies a value to the system clipboard. */
export class CopyButton extends ComponentBase<ICopyButtonProperties, ICopyButtonState> {
    private feedbackTimer?: ReturnType<typeof setTimeout>;

    public constructor(props: ICopyButtonProperties) {
        super(props);

        this.state = { copied: false };
        this.addHandledProperties("value");
    }

    public override componentWillUnmount(): void {
        if (this.feedbackTimer) {
            clearTimeout(this.feedbackTimer);
        }
    }

    public render(): ComponentChild {
        const { className, value, onClick, imageOnly, children, ...buttonProps } = this.props;
        const copied = this.state.copied;
        const effectiveClassName = [...new Set([className, "copyButton", copied ? "copied" : undefined])]
            .filter(Boolean).join(" ");

        return (
            <Button
                {...buttonProps}
                className={effectiveClassName}
                imageOnly={true}
                data-tooltip={copied ? "Copied to Clipboard" : "Copy to Clipboard"}
                onClick={this.handleCopy}
            >
                <Icon src={copied ? Codicon.Check : Codicon.Copy} data-tooltip="inherit" />
            </Button>
        );
    }

    private handleCopy = (event: MouseEvent | KeyboardEvent): void => {
        const { value, onClick } = this.props;

        requisitions.writeToClipboard(typeof value === "function" ? value() : value);
        this.setState({ copied: true });
        if (this.feedbackTimer) {
            clearTimeout(this.feedbackTimer);
        }
        this.feedbackTimer = setTimeout(() => {
            this.setState({ copied: false });
            this.feedbackTimer = undefined;
        }, 2000);

        onClick?.(event, this.props);
    };
}
