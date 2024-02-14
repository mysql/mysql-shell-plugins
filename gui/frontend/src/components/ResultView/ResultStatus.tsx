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

import { IExecutionInfo, MessageType } from "../../app-logic/Types.js";
import { IComponentProperties, ComponentBase } from "../ui/Component/ComponentBase.js";
import { Container, Orientation } from "../ui/Container/Container.js";
import { Label } from "../ui/Label/Label.js";
import { Message } from "../ui/Message/Message.js";

interface IResultStatusProperties extends IComponentProperties {
    executionInfo: IExecutionInfo;
}

// Implements a text output area usually used for execution results (except DB data).
export class ResultStatus extends ComponentBase<IResultStatusProperties> {

    public constructor(props: IResultStatusProperties) {
        super(props);

        this.addHandledProperties("executionInfo");
    }

    public render(): ComponentChild {
        const { executionInfo, children } = this.props;

        if (!executionInfo.text && !children) {
            return undefined;
        }

        let text;
        let messageClass = "";
        if ((executionInfo.type != null) && executionInfo.type !== MessageType.Response) {
            messageClass = "containsMessage";
            text = <Message type={executionInfo.type}>{executionInfo.text}</Message>;
        } else {
            text = <Label>{executionInfo.text}</Label>;
        }

        const className = this.getEffectiveClassNames(["resultStatus", messageClass]);

        return (
            <Container
                className={className}
                orientation={Orientation.LeftToRight}
                {...this.unhandledProperties}
            >
                {text}
                {(executionInfo.type == null) && children}
            </Container>
        );
    }

}
