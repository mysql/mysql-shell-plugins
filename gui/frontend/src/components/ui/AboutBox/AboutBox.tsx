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

import "./AboutBox.css";
import logo from "../../../assets/images/modules/module-shell.svg";

import React from "react";

import {
    Component, IComponentState, Container, Icon, Label, Orientation, ContentAlignment, ContentWrap, Grid, GridCell,
} from "../";
import { ShellInterface } from "../../../supplement/ShellInterface/ShellInterface";
import { Divider } from "../Divider/Divider";
import { requisitions } from "../../../supplement/Requisitions";
import { IBackendInformation } from "../../../supplement/ShellInterface";

interface IAboutBoxState extends IComponentState {
    data?: IBackendInformation;
}

export class AboutBox extends Component<{}, IAboutBoxState> {

    public constructor(props: {}) {
        super(props);

        this.state = {
        };

        ShellInterface.core.backendInformation.then((data) => {
            this.setState({ data });
        }).catch((reason) => {
            void requisitions.execute("showError", ["Backend Error", String(reason)]);
        });
    }

    public render(): React.ReactNode {
        const { data } = this.state;

        const className = this.getEffectiveClassNames(["aboutBox"]);

        const linkMap = new Map<string, string>();
        linkMap.set("Learn More >", "http://localhost:3001/#");
        linkMap.set("Browse Tutorial >", "http://localhost:3001/#");
        linkMap.set("Read Docs >", "http://localhost:3001/#");

        const links = [];
        for (const url of linkMap) {
            links.push(
                <a key={url[0]} href={url[1]}>
                    {url[0]}
                </a>,
            );
        }

        // The version + build numbers will be injected by webpack (see also config-overrides.js).
        const versionParts: string[] = process.env.versionNumber?.split(".") || ["1", "0", "0"];
        if (versionParts.length === 0) {
            versionParts.push("1");
        }

        if (versionParts.length === 1) {
            versionParts.push("0");
        }

        const infoCells: React.ReactNode[] = [];

        if (data) {
            infoCells.push(
                <GridCell key="cell5" className="heading" columnSpan={2} orientation={Orientation.TopDown} >
                    <Label caption="Shell Build Information" />
                </GridCell>,
                <GridCell
                    key="cell6"
                    columnSpan={2}
                    orientation={Orientation.TopDown}
                    crossAlignment={ContentAlignment.Center}>
                    <Divider />
                </GridCell>,

                <GridCell key="cell7" className="left">Version:</GridCell>,
                <GridCell key="cell8" className="right">{`${data.major}.${data.minor}.${data.patch}`}</GridCell>,

                <GridCell key="cell9" className="left">Architecture:</GridCell>,
                <GridCell key="cell10" className="right">{data.architecture}</GridCell>,

                <GridCell key="cell11" className="left">Platform:</GridCell>,
                <GridCell key="cell12" className="right">{data.platform}</GridCell>,

                <GridCell key="cell13" className="left">Server Distribution:</GridCell>,
                <GridCell key="cell14" className="right">{data.serverDistribution}</GridCell>,

                <GridCell key="cell15" className="left">Server Version:</GridCell>,
                <GridCell key="cell16" className="right">
                    {`${data.serverMajor}.${data.serverMinor}.${data.serverPatch}`}
                </GridCell>,
                <GridCell key="cell1" className="heading" columnSpan={2} orientation={Orientation.TopDown} >
                    <Label caption="Frontend Information" />
                </GridCell>,

                <GridCell
                    key="cell2"
                    columnSpan={2}
                    orientation={Orientation.TopDown}
                    crossAlignment={ContentAlignment.Center}>
                    <Divider />
                </GridCell>,
                <GridCell key="cell3" className="left">Version:</GridCell>,
                <GridCell key="cell4" className="right">
                    {`${process.env.versionNumber ?? "0.0.0"} (${process.env.buildNumber!})`}
                </GridCell>,
            );
        }

        return (
            <Container
                className={className}
                orientation={Orientation.TopDown}
                mainAlignment={ContentAlignment.Center}
                crossAlignment={ContentAlignment.Center}
            >
                <Icon src={logo} id="sakilaLogo" />
                <Container id="heading" orientation={Orientation.TopDown}>
                    <Label id="headingLabel" as="h2">
                        About MySQL Shell
                    </Label>
                </Container>
                <Container
                    id="aboutBoxLinks"
                    orientation={Orientation.LeftToRight}
                    mainAlignment={ContentAlignment.Center}
                    wrap={ContentWrap.Wrap}
                >
                    {links}
                </Container>

                <Grid columns={2} rowGap={12} columnGap={12}>
                    {infoCells}
                </Grid>

                <div className="copyright" />
            </Container>
        );
    }
}

