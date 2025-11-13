/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

import "./MigrationOverview.css";

import { Component, VNode } from "preact";

import { CloudConnectivity } from "../../communication/ProtocolMigration.js";

import { Accordion } from "./Accordion.js";
import { ArrowDottedAnimated } from "./ArrowDottedAnimated.js";
import { Assets } from "../../supplement/Assets.js";
import { HostCard } from "./HostCard.js";
import { Container, Orientation } from "../../components/ui/Container/Container.js";
import { ResourceCard } from "./ResourceCard.js";

interface IMigrationOverviewProps {
    overviewCollapsed?: boolean;

    type: CloudConnectivity;

    region: string;
    connectionCaption: string;
    sourceIp: string;
    sourceVersion: string;
    remoteIp: string;
    heatwaveName: string;
    heatwaveVersion: string;
    compartmentName: string;

    exportInProgress: boolean;
    importInProgress: boolean;
    replicationInProgress: boolean;
}

interface IMigrationOverviewState {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

type StateCoordinates = Pick<IMigrationOverviewState, "x1" | "y1" | "x2" | "y2">;

type DefaultProps = Pick<IMigrationOverviewProps, "remoteIp" | "heatwaveVersion">;

export class MigrationOverview extends Component<IMigrationOverviewProps, IMigrationOverviewState> {
    public static override defaultProps: DefaultProps = {
        remoteIp: "",
        heatwaveVersion: "",
    };

    public constructor(props: IMigrationOverviewProps) {
        super(props);

        this.state = {
            x1: 56,
            y1: 118,
            x2: 56,
            y2: 141,
        };
    }

    public override render(): VNode {
        const content = this.renderDiagram(this.props.type);

        return (
            <div className="database-diagram">
                {/* {<div style={{ position: "absolute", left: 300, bottom: 0 }}>
                    {this.renderInput("x1")}
                    {this.renderInput("y1")}
                    {this.renderInput("x2")}
                    {this.renderInput("y2")}
                </div>} */}
                <Accordion
                    id="overview"
                    sections={[{
                        key: "overview",
                        expanded: true,
                        caption: (
                            <div className="overview">
                                Overview
                            </div>
                        ),
                        content: content
                    }]}
                />
            </div>
        );
    }

    private renderDiagram(channelType: CloudConnectivity): VNode {
        const { heatwaveName, sourceIp, sourceVersion, remoteIp, compartmentName, connectionCaption, region,
            heatwaveVersion, exportInProgress, importInProgress, replicationInProgress } = this.props;

        const coordinates: Record<string, StateCoordinates> = {
            "compute-to-dbsystem": {
                x1: 110,
                y1: 102,
                x2: 110,
                y2: 78
            },
            "compute-to-bucket": {
                x1: 90,
                y1: 135,
                x2: 52,
                y2: 135
            },
            "migration-to-source": {
                x1: 52,
                y1: 35,
                x2: 88,
                y2: 35
            },
            "migration-to-compute": {
                x1: 46,
                y1: 260,
                x2: 100,
                y2: 166
            },
            "migration-to-bucket": {
                x1: 32,
                y1: 254,
                x2: 32,
                y2: 165
            },
            "tunneled-replication": {
                x1: 260,
                y1: 76,
                x2: 260,
                y2: 246
            },
            "direct-replication": {
                x1: 290,
                y1: 76,
                x2: 290,
                y2: 246
            },
            "connectivity-down": {
                x1: 159,
                y1: 38,
                x2: 159,
                y2: 53
            },
            "connectivity-up": {
                x1: 159,
                y1: 12,
                x2: 159,
                y2: 2
            }
        };

        let replicationCoords;
        let replicationCurve;
        let connectivityIcon;
        let connectivityLabel;
        switch (channelType) {
            case CloudConnectivity.LOCAL_SSH_TUNNEL:
            case CloudConnectivity.SSH_TUNNEL:
                replicationCoords = coordinates["tunneled-replication"];
                replicationCurve = 1;
                connectivityIcon = Assets.ociArchitecture.encryptionIcon;
                connectivityLabel = "SSH tunnel";
                break;

            case CloudConnectivity.SITE_TO_SITE:
                replicationCoords = coordinates["direct-replication"];
                replicationCurve = 50;
                connectivityIcon = Assets.ociArchitecture.siteToSiteVPNIcon;
                connectivityLabel = "Site-to-Site VPN";
                break;
        }

        return (

            <>
                <div className="oci-compartment">
                    <p className="location-name">OCI {region}</p>
                    <div className="compartment-header">
                        <span className="compartment-label">Compartment: {compartmentName}</span>
                    </div>

                    <Container orientation={Orientation.LeftToRight} className="production">

                        <ResourceCard
                            className="resource-card-bucket"
                            icon={Assets.ociArchitecture.bucketIcon}
                            title="Object Storage"
                        />

                        <Container orientation={Orientation.TopDown} className="production-column">
                            <HostCard className="production-db-cloud"
                                icon={Assets.ociArchitecture.mysqlDbSystemIcon}
                                title={heatwaveName || "TBD"}
                                version={`MySQL HeatWave ${heatwaveVersion}`}
                                address={remoteIp || "..."}
                            />
                            <div className="arrow">
                                <ArrowDottedAnimated
                                    {...coordinates["compute-to-dbsystem"]}
                                    animateDirection="backward"
                                    arrowSize={3}
                                    animated={importInProgress ? true : false}
                                    variant={importInProgress ? "dotted" : "solid"}
                                    color="#49688cff"
                                />
                            </div>

                            <HostCard className="jump-host"
                                icon={Assets.ociArchitecture.computeIcon}
                                title="Jump Host"
                                version=""
                                address={remoteIp || "..."}
                            />
                        </Container>

                        <div className="arrow">
                            <ArrowDottedAnimated
                                {...coordinates["compute-to-bucket"]}
                                animateDirection="forward"
                                arrowSize={3}
                                animated={importInProgress ? true : false}
                                variant={importInProgress ? "dotted" : "solid"}
                                color="#767676"
                            />
                        </div>

                        <div className="arrow">
                            <ArrowDottedAnimated
                                {...coordinates["migration-to-compute"]}
                                animateDirection="backward"
                                arrowSize={3}
                                animated={importInProgress ? true : false}
                                variant={importInProgress ? "dotted" : "solid"}
                                color="#498c68ff"
                            />
                        </div>

                        <div className="arrow">
                            <ArrowDottedAnimated
                                {...coordinates["migration-to-bucket"]}
                                animateDirection="backward"
                                arrowSize={3}
                                animated={exportInProgress ? true : false}
                                variant={exportInProgress ? "dotted" : "solid"}
                                color="#767676"
                            />
                        </div>

                        {(replicationCoords && replicationCurve) &&
                            <div className="arrow">
                                <ArrowDottedAnimated
                                    {...replicationCoords}
                                    animateDirection="backward"
                                    arrowSize={3}
                                    curve={-replicationCurve}
                                    animated={replicationInProgress ? true : false}
                                    variant={replicationInProgress ? "dotted" : "solid"}
                                    color="#767676"
                                    className="replication-arrow"
                                />
                            </div>}
                    </Container>

                    {
                        (connectivityLabel && connectivityIcon) &&
                        <div className="connectivity-type">
                            <div className="arrow">
                                <ArrowDottedAnimated
                                    {...coordinates["connectivity-up"]}
                                    animateDirection="backward"
                                    arrowSize={6}
                                    strokeWidth={1}
                                    animated={replicationInProgress ? true : false}
                                    variant={replicationInProgress ? "dotted" : "solid"}
                                    color="#312D2A"
                                    className="connectivity-arrow-up"
                                />
                                <ArrowDottedAnimated
                                    {...coordinates["connectivity-down"]}
                                    animateDirection="backward"
                                    arrowSize={6}
                                    strokeWidth={1}
                                    animated={replicationInProgress ? true : false}
                                    variant={replicationInProgress ? "dotted" : "solid"}
                                    color="#312D2A"
                                    className="connectivity-arrow-down"
                                />
                            </div>
                            <ResourceCard icon={connectivityIcon} title={connectivityLabel}
                                width={14} height={14} />
                        </div>
                    }
                </div>

                <div className="on-premises">
                    <div className="section-header">On Premises</div>

                    <Container orientation={Orientation.LeftToRight}
                        className="on-premises-inner">
                        <ResourceCard
                            icon={Assets.modules.moduleShellIcon}
                            title="Migration Assistant"
                        />
                        <HostCard className="production-db-local"
                            icon={Assets.ociArchitecture.databaseIcon}
                            title={connectionCaption}
                            version={`MySQL ${sourceVersion}`}
                            address={sourceIp || "..."}
                        />

                        <div className="arrow">
                            <ArrowDottedAnimated
                                {...coordinates["migration-to-source"]}
                                animateDirection="forward"
                                arrowSize={3}
                                animated={exportInProgress ? true : false}
                                variant={exportInProgress ? "dotted" : "solid"}
                                color="#49688cff"
                            />
                        </div>
                    </Container>
                </div>
            </>
        );
    }
}
