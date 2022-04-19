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

import React from "react";
import { isNil } from "lodash";

import { Component, Label, Container, Orientation, IComponentProperties, Message } from "../ui";
import { IExecutionInfo, MessageType } from "../../app-logic/Types";

export interface IResultStatusProperties extends IComponentProperties {
    executionInfo: IExecutionInfo;
}

// Implements a text output area usually used for execution results (except DB data).
export class ResultStatus extends Component<IResultStatusProperties> {

    public constructor(props: IResultStatusProperties) {
        super(props);

        this.addHandledProperties("executionInfo");
    }

    public render(): React.ReactNode {
        const { executionInfo, children } = this.props;

        let text;
        let messageClass = "";
        if (!isNil(executionInfo.type) && executionInfo.type !== MessageType.Response) {
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
                {isNil(executionInfo.type) && children}
            </Container>
        );
    }

}
