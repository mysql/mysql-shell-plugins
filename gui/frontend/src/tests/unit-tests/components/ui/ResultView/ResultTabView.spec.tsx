/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

import { render } from "@testing-library/preact";
import { mount } from "enzyme";
import React from "react";
import { IResultTabViewProperties, ResultTabView } from "../../../../../components/ResultView";

describe("Result tabview tests", (): void => {

    it("Result tabview elements", () => {
        const component = mount<IResultTabViewProperties>(
            <ResultTabView
                resultSets={{
                    type: "resultSets",
                    sets: [{
                        head: {
                            sql: "select 1",
                            requestId: "123",
                        },
                        data: {
                            requestId: "123",
                            columns: [],
                            rows: [],
                            currentPage: 0,
                        },
                    }, {
                        head: {
                            sql: "select 2",
                            requestId: "456",
                        },
                        data: {
                            requestId: "456",
                            columns: [],
                            rows: [],
                            currentPage: 10,
                        },
                    }],
                }}
            />,
        );

        const props = component.props();
        expect(props.resultSets.sets.length).toEqual(2);

        component.unmount();
    });

    it("Result tabview (Snapshot) 1", () => {
        const component = render(
            <ResultTabView
                resultSets={{
                    type: "resultSets",
                    sets: [{
                        head: {
                            sql: "select 1",
                            requestId: "123",
                        },
                        data: {
                            requestId: "123",
                            columns: [],
                            rows: [],
                            currentPage: 0,
                        },
                    }, {
                        head: {
                            sql: "select 2",
                            requestId: "456",
                        },
                        data: {
                            requestId: "456",
                            columns: [],
                            rows: [],
                            currentPage: 10,
                        },
                    }],
                }}
            />,
        );
        expect(component).toMatchSnapshot();
    });

});
