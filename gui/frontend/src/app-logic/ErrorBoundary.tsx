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

import { ComponentChild } from "preact";

import { IComponentProperties, ComponentBase } from "../components/ui/Component/ComponentBase.js";
import { Container, Orientation } from "../components/ui/Container/Container.js";
import { Label } from "../components/ui/Label/Label.js";
import { Message } from "../components/ui/Message/Message.js";

import { MessageType } from "./general-types.js";

type IErrorBoundaryProperties = IComponentProperties;

interface IErrorBoundaryState {
    error: string;
    stack: string;
}

/**
 * A component to handle unhandled exceptions in any of the components.
 * Because it catches all errors that aren't handled anywhere else, it's tricky to test.
 * So for now we don't include the error branches in the coverage summary.
 */
export class ErrorBoundary extends ComponentBase<IErrorBoundaryProperties, IErrorBoundaryState> {

    public constructor(props: {}) {
        super(props);

        this.state = {
            error: "",
            stack: "",
        };
    }

    /* istanbul ignore next */
    public static override getDerivedStateFromError(error: Error): object {
        // Update state so the next render will show the fallback UI.
        return {
            error: error.message,
            stack: error.stack,
        };
    }

    /* istanbul ignore next */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public override componentDidCatch(error: Error, errorInfo: unknown): void {
        // log the error errorInfo.componentStack;
    }

    public render(): ComponentChild {
        const { children } = this.props;
        const { error } = this.state;

        /* istanbul ignore next */
        if (error.length > 0) {
            return (
                <Container className="errorBoundary" style={{ padding: "30px" }} orientation={Orientation.TopDown}>
                    <Label className="heading">An unexpected error occurred:</Label><br />
                    <Message type={MessageType.Error}>{this.state.error}</Message><br />
                    <Message className="stack" type={MessageType.Info}>{this.state.stack}</Message><br />
                    <span>
                        If you think this is a bug in the application then please file a bug report at
                        &nbsp;<a href="https://bugs.mysql.com">https://bugs.mysql.com</a>.
                    </span>
                </Container>
            );
        }

        return children;
    }

}
