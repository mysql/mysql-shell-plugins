/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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
import { ICommResultSetEvent } from "../../communication";

import { Component, Grid, GridCell, IComponentProperties, IComponentState, Label } from "../../components/ui";
import { EventType } from "../../supplement/Dispatch";
import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface";

export interface IServerStatusProperties extends IComponentProperties {
    backend: ShellInterfaceSqlEditor;
}

export interface IServerStatusState extends IComponentState {
    dataVersion: number;
    performanceSchema: boolean;
}

export class ServerStatus extends Component<IServerStatusProperties, IServerStatusState> {
    public constructor(props: IServerStatusProperties) {
        super(props);

        this.state = {
            dataVersion: 0,
            performanceSchema: false,
        };
    }

    public componentDidMount(): void {
        this.updateValues();
    }

    public componentDidUpdate(prevProps: IServerStatusProperties, prevState: IServerStatusState): void {
        const { dataVersion } = this.state;
        if (dataVersion === prevState.dataVersion) {
            this.updateValues();
        }
    }

    public render(): React.ReactNode {
        const { performanceSchema } = this.state;

        return (
            <Grid columns={2}>
                <GridCell columnSpan={2}><h1>ServerStatus</h1></GridCell>
                <GridCell><Label caption="Performance Schema: " /></GridCell>
                <GridCell><Label caption={String(performanceSchema)} /></GridCell>
            </Grid>
        );
    }

    private updateValues(): void {
        const { backend } = this.props;
        const { dataVersion } = this.state;

        backend.execute("show variables").then((event: ICommResultSetEvent) => {
            if (event.eventType === EventType.FinalResponse) {
                const values = new Map<string, string>(event.data.rows as Array<[string, string]>);
                const performanceSchema = values.get("performance_schema") === "ON" ? true : false;
                this.setState({ dataVersion: dataVersion + 1, performanceSchema });
            }
        });
    }
}
