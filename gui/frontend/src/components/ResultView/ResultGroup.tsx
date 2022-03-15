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

//import constructionIcon from "../../assets/images/under-construction.svg";

import { Component, IComponentProperties, IComponentState, ITabviewPage, TabPosition, Tabview } from "../ui";
import { ResultView } from ".";
import { IResultSet, IResultSetRows } from "../../script-execution";

export interface IResultGroupProperties extends IComponentProperties {
    resultSet: IResultSet;

    onResultPageChange?: (requestId: string, currentPage: number, sql: string) => void;
}

interface IResultGroupState extends IComponentState {
    selectedTab: string;
}

export class ResultGroup extends Component<IResultGroupProperties, IResultGroupState> {

    private resultRef = React.createRef<ResultView>();

    public constructor(props: IResultGroupProperties) {
        super(props);

        this.state = {
            selectedTab: "",
        };
    }

    public render(): React.ReactNode {
        const { resultSet, onResultPageChange } = this.props;
        const { selectedTab } = this.state;

        const pages: ITabviewPage[] = [];

        const resultView = <ResultView
            key="resultSet"
            ref={this.resultRef}
            resultSet={resultSet}
            onResultPageChange={onResultPageChange}
        />;

        pages.push({ id: "resultSet", caption: "RS", tooltip: "Result Set", content: resultView });

        // TODO: Temporarily disabled. Add a mode to the tabview where no tab is shown and tabs are switched
        // programmatically.
        /*pages.push({ id: "textResult", caption: "TX", tooltip: "Textual Output", content: icon });
        pages.push({ id: "formEditor", caption: "FE", tooltip: "Form Editor", content: icon });
        pages.push({ id: "fieldTypes", caption: "FT", tooltip: "Field Types", content: icon });
        pages.push({ id: "queryStats", caption: "QS", tooltip: "Query Statistics", content: icon });
        pages.push({ id: "executionPlan", caption: "EP", tooltip: "Execution Plan", content: icon });*/

        return (
            <Tabview
                className="resultGroup"
                stretchTabs={false}
                selectedId={selectedTab !== "" ? selectedTab : "resultSet"}
                tabPosition={TabPosition.Right}
                pages={pages}
                hideSingleTab

                onSelectTab={this.handleTabSelection}
            />
        );
    }

    public async addData(newData: IResultSetRows, replace: boolean): Promise<void> {
        if (this.resultRef.current) {
            await this.resultRef.current.addData(newData, replace);
        }
    }

    private handleTabSelection = (id: string): void => {
        this.setState({ selectedTab: id });
    };
}
