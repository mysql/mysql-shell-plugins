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

import { Component, IComponentProperties, IComponentState, ITabviewPage, TabPosition, Tabview } from "../ui";
import { IResultSet, IResultSetRows, IResultSets } from "../../script-execution";
import { ResultGroup } from ".";
import { IColumnInfo } from "../../app-logic/Types";

export interface IResultTabViewProperties extends IComponentProperties {
    resultSets: IResultSets;

    onResultPageChange?: (requestId: string, currentPage: number, sql: string) => void;
}

interface IResultTabViewState extends IComponentState {
    selectedTab: string;

    // React refs to the used ResultGroup instances, keyed by the request ID for the result set.
    groupRefs: Map<string, React.RefObject<ResultGroup>>;

    // Result IDs that are marked for purge.
    purgePending: Set<string>;
}

// Holds a collection of result views and other output in a tabbed interface.
export class ResultTabView extends Component<IResultTabViewProperties, IResultTabViewState> {

    public constructor(props: IResultTabViewProperties) {
        super(props);

        this.state = {
            selectedTab: "",
            groupRefs: new Map(),
            purgePending: new Set(),
        };
    }

    public render(): React.ReactNode {
        const { resultSets, onResultPageChange } = this.props;
        const { selectedTab, groupRefs } = this.state;

        const pages = resultSets.sets.map((resultSet: IResultSet, index: number): ITabviewPage => {
            const ref = React.createRef<ResultGroup>();
            groupRefs.set(resultSet.head.requestId, ref);

            return {
                id: `resultGroup${index}`,
                caption: `Result ${index + 1}`,
                content: (
                    <ResultGroup
                        ref={ref}
                        resultSet={resultSet}

                        onResultPageChange={onResultPageChange}
                    />
                ),
            };
        });

        return (
            <Tabview
                className="resultHost"
                stretchTabs={false}
                hideSingleTab={true}
                selectedId={selectedTab !== "" ? selectedTab : "resultGroup0"}
                tabPosition={TabPosition.Top}
                pages={pages}

                onSelectTab={this.handleTabSelection}
            />
        );
    }

    /**
     * Triggers a column update in the group which belongs to the given request id.
     *
     * @param requestId The actual request ID which identifies a specific result group.
     * @param columns The columns to set.
     */
    public async updateColumns(requestId: string, columns: IColumnInfo[]): Promise<void> {
        const { groupRefs } = this.state;

        const groupRef = groupRefs.get(requestId);
        if (groupRef && groupRef.current) {
            await groupRef.current.updateColumns(columns);
        }
    }

    /**
     * In order to update large result sets without re-rendering everything we use direct methods
     * to add new data.
     *
     * @param newData The data to add.
     *
     * @returns A promise the resolves when the operation is complete.
     */
    public async addData(newData: IResultSetRows): Promise<void> {
        const { groupRefs, purgePending } = this.state;

        const needPurge = purgePending.delete(newData.requestId);
        const groupRef = groupRefs.get(newData.requestId);
        if (groupRef && groupRef.current) {
            await groupRef.current.addData(newData, needPurge);
        }
    }

    /**
     * Moves existing data for the old request ID to a new ID and sends the underlying group a call to
     * note that next incoming data has to replace existing data.
     * We don't remove existing data here, to avoid flickering.
     *
     * @param oldRequestId The ID under which an existing group is registered.
     * @param newRequestId The ID under which this group is accessible after return.
     */
    public reassignData(oldRequestId: string, newRequestId: string): void {
        const { groupRefs, purgePending } = this.state;

        const groupRef = groupRefs.get(oldRequestId);
        if (groupRef && groupRef.current) {
            groupRefs.delete(oldRequestId);
            groupRefs.set(newRequestId, groupRef);

            purgePending.add(newRequestId);
        }
    }

    public markPendingReplace(requestId: string): void {
        const { purgePending } = this.state;

        purgePending.add(requestId);
    }

    private handleTabSelection = (id: string): void => {
        this.setState({ selectedTab: id });
    };

}
