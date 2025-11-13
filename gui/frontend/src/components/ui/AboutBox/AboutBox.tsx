/*
 * Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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

import "./AboutBox.css";

import { createRef, ComponentChild } from "preact";

import { ui } from "../../../app-logic/UILayer.js";
import { Assets } from "../../../supplement/Assets.js";
import { ShellInterface } from "../../../supplement/ShellInterface/ShellInterface.js";
import { IBackendInformation } from "../../../supplement/ShellInterface/index.js";
import { helpUrlMap } from "../../../supplement/index.js";
import { convertErrorToString } from "../../../utilities/helpers.js";
import { ComponentBase, IComponentProperties, IComponentState } from "../Component/ComponentBase.js";
import { Container, ContentAlignment, ContentWrap, Orientation } from "../Container/Container.js";
import { Divider } from "../Divider/Divider.js";
import { Grid } from "../Grid/Grid.js";
import { GridCell } from "../Grid/GridCell.js";
import { HelpLinkList } from "../HelpLinkList/HelpLinkList.js";
import { Icon } from "../Icon/Icon.js";
import { Label } from "../Label/Label.js";
import { Dialog } from "../Dialog/Dialog.js";
import { Button } from "../Button/Button.js";

interface IAboutBoxState extends IComponentState {
    data?: IBackendInformation;
}

interface IAboutBoxProperties extends IComponentProperties {
    onClose?: () => void;
    additionalInfo?: [string, string][];
    title?: string;
    showLinks?: boolean;
}

export class AboutBox extends ComponentBase<IAboutBoxProperties, IAboutBoxState> {

    private dialogRef = createRef<Dialog>();

    public constructor(props: {}) {
        super(props);

        this.state = {
        };

        ShellInterface.core.backendInformation.then((data) => {
            this.setState({ data });
        }).catch((reason: unknown) => {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage("Backend Error: " + message, {});
        });
    }

    public async show(): Promise<void> {
        this.dialogRef.current?.open();
    }

    public render(): ComponentChild {
        const { data } = this.state;
        const { onClose, additionalInfo, title, showLinks } = this.props;

        const className = this.getEffectiveClassNames(["aboutBox"]);

        // The version is injected by the vite config.
        const versionParts: string[] = globalThis.MSG_VERSION_NUMBER?.split(".") ?? [];
        if (versionParts.length === 0) {
            versionParts.push("1", "0", "0");
        }

        if (versionParts.length === 1) {
            versionParts.push("0");
        }

        const infoCells: ComponentChild[] = [];

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

                <GridCell key="cell7" className="left title">Version:</GridCell>,
                <GridCell key="cell8" className="right">{`${data.major}.${data.minor}.${data.patch}`}</GridCell>,

                <GridCell key="cell9" className="left title">Platform/Architecture:</GridCell>,
                <GridCell key="cell10" className="right">{data.platform}/{data.architecture}</GridCell>,

                <GridCell key="cell13" className="left title">Server Distribution:</GridCell>,
                <GridCell key="cell14" className="right">{data.serverDistribution}</GridCell>,

                <GridCell key="cell15" className="left title">Server Version:</GridCell>,
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
                <GridCell key="cell3" className="left title">Version:</GridCell>,
                <GridCell key="cell4" className="right">
                    {`${versionParts.join(".")} (${globalThis.MSG_BUILD_NUMBER ?? "unknown"})`}
                </GridCell>,
            );
        }

        const additionalInfoCells: ComponentChild[] = [];

        if (additionalInfo && additionalInfo.length > 0 ) {
            additionalInfoCells.push(
                <GridCell key="additionalInfoHeading" className="heading" columnSpan={5} orientation={Orientation.TopDown} >
                    <Label caption="Additional Product Information" />
                </GridCell>,
                <GridCell
                    key="additionalInfoDivider"
                    columnSpan={5}  
                    orientation={Orientation.TopDown}
                    crossAlignment={ContentAlignment.Center}>
                    <Divider />
                </GridCell>,
            );

            additionalInfo.forEach(([key, value], index) => {
                additionalInfoCells.push(
                    <GridCell key={`additionalInfoCell${index * 2}`} className="right title small">{key}</GridCell>,
                    <GridCell key={`additionalInfoCell${index * 2 + 1}`} columnSpan={4} className="right selectable small">{value}</GridCell>,
                );
            });
        }        

        return (
            <Dialog
                ref={this.dialogRef}
                caption= {title ?? "About MySQL Shell"}
                onClose={(cancelled) => {
                    onClose?.()
                }}
            >
            <Container
                className={className}
                orientation={Orientation.TopDown}
                mainAlignment={ContentAlignment.Center}
                crossAlignment={ContentAlignment.Center}
            >
                <Icon src={Assets.modules.moduleShellIcon} id="sakilaLogo" />
                <Container id="heading" orientation={Orientation.TopDown}>
                    <Label id="headingLabel">
                        {title ?? "About MySQL Shell"}
                    </Label>
                </Container>

                {(showLinks ?? true) && (
                <Container
                    id="aboutBoxLinks"
                    orientation={Orientation.LeftToRight}
                    mainAlignment={ContentAlignment.Center}
                    wrap={ContentWrap.Wrap}
                >
                    <HelpLinkList helpUrlMap={helpUrlMap} />
                </Container>
                )}

                <Grid columns={2} rowGap={12} columnGap={12}>
                    {infoCells}
                </Grid>

                <Grid columns={5} rowGap={12} columnGap={12}  style={{ width: "90%" }}>
                    {additionalInfo && additionalInfo.length > 0 && additionalInfoCells}
                </Grid>

                <Container orientation={Orientation.LeftToRight} mainAlignment={ContentAlignment.End} style={{ marginTop: 32 }}>
                    <Button
                        caption="Close"
                        onClick={() => {
                            onClose?.()
                        }}
                    />
                </Container>                

                <div className="copyright" />
            </Container>
            </Dialog>
        );
    }
}
