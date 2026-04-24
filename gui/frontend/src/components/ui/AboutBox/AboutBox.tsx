/*
 * Copyright (c) 2021, 2026, Oracle and/or its affiliates.
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

import { ComponentChild, createRef } from "preact";

import { ui } from "../../../app-logic/UILayer.js";
import { Assets } from "../../../supplement/Assets.js";
import { ShellInterface } from "../../../supplement/ShellInterface/ShellInterface.js";
import { IBackendInformation } from "../../../supplement/ShellInterface/index.js";
import { helpUrlMap } from "../../../supplement/index.js";
import { convertErrorToString } from "../../../utilities/helpers.js";
import { Button } from "../Button/Button.js";
import { ComponentBase, IComponentProperties, IComponentState } from "../Component/ComponentBase.js";
import { Container, ContentAlignment, ContentWrap, Orientation } from "../Container/Container.js";
import { Dialog } from "../Dialog/Dialog.js";
import { Divider } from "../Divider/Divider.js";
import { Grid } from "../Grid/Grid.js";
import { GridCell } from "../Grid/GridCell.js";
import { HelpLinkList } from "../HelpLinkList/HelpLinkList.js";
import { Icon } from "../Icon/Icon.js";
import { Image } from "../Image/Image.js";
import { Label } from "../Label/Label.js";
import { isStandalone } from "../../../utilities/helpers.js";
import { hasElectronHostBridge } from "../../../supplement/ElectronDesktop.js";

interface IAboutBoxState extends IComponentState {
    data?: IBackendInformation;
}

interface IAboutBoxProperties extends IComponentProperties {
    onClose?: () => void;
    additionalInfo?: Array<[string, string]>;
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

    public show(): void {
        this.dialogRef.current?.open();
    }

    public render(): ComponentChild {
        const { data } = this.state;
        const { onClose, additionalInfo, title, showLinks } = this.props;

        const className = this.getEffectiveClassNames(["aboutBox"]);
        const showWorkbenchBranding = !title && (hasElectronHostBridge() || isStandalone());
        const headingTitle = showWorkbenchBranding ? "MySQL Workbench 10" : (title ?? "About MySQL Shell");

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
                <GridCell key="cell3" className="left title">Version:</GridCell>,
                <GridCell key="cell4" className="right">
                    {versionParts.join(".")}
                    <span className="buildHash">
                        {` (${globalThis.MSG_BUILD_NUMBER ?? "unknown"})`}
                    </span>
                </GridCell>,

                <GridCell key="cell5" className="heading shellBuildHeading" columnSpan={2}
                    orientation={Orientation.TopDown} >
                    <Label caption="Shell Build Information" />
                </GridCell>,
                <GridCell
                    key="cell6"
                    columnSpan={2}
                    orientation={Orientation.TopDown}
                    crossAlignment={ContentAlignment.Center}>
                    <Divider />
                </GridCell>,

                <GridCell key="cell7" className="left title shellBuildInfo">MySQL Shell Version:</GridCell>,
                <GridCell key="cell8" className="right shellBuildInfo">
                    {`${data.major}.${data.minor}.${data.patch}`}
                </GridCell>,

                <GridCell key="cell9" className="left title shellBuildInfo">Platform/Architecture:</GridCell>,
                <GridCell key="cell10" className="right shellBuildInfo">{data.platform}/{data.architecture}</GridCell>,

                <GridCell key="cell13" className="left title shellBuildInfo">Server Distribution:</GridCell>,
                <GridCell key="cell14" className="right shellBuildInfo">{data.serverDistribution}</GridCell>,

                <GridCell key="cell15" className="left title shellBuildInfo">libmysqlclient:</GridCell>,
                <GridCell key="cell16" className="right shellBuildInfo">
                    {`${data.serverMajor}.${data.serverMinor}.${data.serverPatch}`}
                </GridCell>,
            );
        }

        const additionalInfoCells: ComponentChild[] = [];

        if (additionalInfo && additionalInfo.length > 0) {
            additionalInfoCells.push(
                <GridCell
                    key="additionalInfoHeading"
                    className="heading"
                    columnSpan={5}
                    orientation={Orientation.TopDown}
                >
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
                    <GridCell
                        key={`additionalInfoCell${(index * 2) + 1}`}
                        columnSpan={4}
                        className="right selectable small">{value}
                    </GridCell>,
                );
            });
        }

        return (
            <Dialog
                ref={this.dialogRef}
                caption={headingTitle}
                onClose={(cancelled) => {
                    onClose?.();
                }}
            >
                <Container
                    className={className}
                    orientation={Orientation.TopDown}
                    mainAlignment={ContentAlignment.Center}
                    crossAlignment={ContentAlignment.Center}
                >
                    <Button
                        id="closeButton"
                        imageOnly
                        data-tooltip="Close"
                        onClick={() => {
                            onClose?.();
                        }}
                    >
                        <Icon src={Assets.misc.close2Icon} data-tooltip="inherit" />
                    </Button>

                    <Image src={Assets.modules.appIcon} id="sakilaLogo" alt="MySQL Workbench 10" />
                    <Container id="heading" orientation={Orientation.TopDown}>
                        <Label id="headingLabel">
                            {headingTitle}
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

                    <Grid className="versionGrid" columns={2} rowGap={10} columnGap={12}>
                        {infoCells}
                    </Grid>

                    <Grid className="additionalInfoGrid" columns={5} rowGap={10} columnGap={12}>
                        {additionalInfo && additionalInfo.length > 0 && additionalInfoCells}
                    </Grid>

                    <div className="copyright" />
                </Container>
            </Dialog>
        );
    }
}
