/*
 * Copyright (c) 2021, Oracle and/or its affiliates.
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

import { mount } from "enzyme";
import React from "react";
import { ActionOutput } from "../../../../../components/ResultView/ActionOutput";
import { MessageType } from "../../../../../app-logic/Types";
import { ResultStatus } from "../../../../../components/ResultView";
import { render } from "@testing-library/preact";

describe("Action output tests", (): void => {
    it("Action output elements", () => {
        const component = mount(
            <ActionOutput
                id="actionOutput1"
                className="actionOutput"
                text="Lorem ipsum dolor sit amet"
            />,
        );

        expect(component).toBeTruthy();
        expect(component.find("label")).toHaveLength(1);
        expect(component.find(ResultStatus)).toHaveLength(0);
    });

    it("Action output (Snapshot) 1", () => {
        const component = render(
            <ActionOutput
                id="actionOutput1"
                className="actionOutput"
                text="Lorem ipsum dolor sit amet"
            />,
        );
        expect(component).toMatchSnapshot();
    });

    it("Action output (Snapshot) 2", () => {
        const component = render(
            <ActionOutput
                id="actionOutput1"
                className="actionOutput"
                text="Lorem ipsum `dolor` sit amet"
                language={"markdown"}
            />,
        );
        expect(component).toMatchSnapshot();
    });

    it("Action output (Snapshot) 3", () => {
        const component = render(
            <ActionOutput
                id="actionOutput1"
                className="actionOutput"
                text="Lorem ipsum dolor sit amet"
                executionInfo={{
                    type: MessageType.Info,
                    text: "Info Message",
                }}
            />,
        );
        expect(component).toMatchSnapshot();
    });

});
