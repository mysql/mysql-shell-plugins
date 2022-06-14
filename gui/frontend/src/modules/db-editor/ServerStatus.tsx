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

import serverRunningIcon from "../../assets/images/admin/admin_info_running.svg";
import serverStoppedIcon from "../../assets/images/admin/admin_info_stopped.svg";
import mysqlIcon from "../../assets/images/admin/mysql-logo.svg";

import { platform } from "os";
import React from "react";

import { ICommResultSetEvent } from "../../communication";
import {
    CheckState, Component, Container, ContentAlignment, Divider, Grid, GridCell, IComponentProperties, IComponentState,
    Icon, Label, Orientation, Toolbar,
} from "../../components/ui";
import { EventType } from "../../supplement/Dispatch";
import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface";

import { IToolbarItems } from ".";
import { StatusMark } from "../../components/ui/StatusMark/StatusMark";

type TriState = true | false | undefined;

export interface IServerStatusProperties extends IComponentProperties {
    backend: ShellInterfaceSqlEditor;

    // Top level toolbar items, to be integrated with page specific ones.
    toolbarItems?: IToolbarItems;
}

interface IServerFeatures {
    semisync?: string;
    passwordValidationValue?: string;
    auditLogValue?: string;
    performanceSchema?: TriState;
    threadPool?: TriState;
    memCachePlugin?: TriState;
    sslAvailability?: TriState;
    pamAuth?: TriState;
    passwordValidation?: TriState;
    auditLog?: TriState;
    firewall?: TriState;
    firewallTrace?: TriState;
    windowsAuth?: TriState;
}

interface IServerStatus {
    connectionName?: string;
    host?: string;
    socket?: string;
    port?: string;
    version?: string;
    compiledFor?: string;
    configFile?: string;
    runningSince?: string;
}

interface IServerDirectories {
    baseDirectory?: string;
    dataDirectory?: string;
    pluginDirectory?: string;
    tmpDirectory?: string;
    errorLog?: boolean;
    errorLogValue?: string;
    generalLog?: boolean;
    generalLogFile?: string;
    slowQueryLog?: boolean;
    slowQueryLogValue?: string;
}

interface IServerAuthentication {
    privateKeyPath?: string;
    publicKeyPath?: string;
}

interface IServerSsl {
    sslKey?: string;
    sslClrPath?: string;
    sslClr?: string;
    sslCipher?: string;
    sslCert?: string;
    sslCaPath?: string;
    sslCa?: string;
}

interface IServerFirewall {
    cachedEntries?: string;
    accessSuspicious?: string;
    accessGranted?: string;
    accessDenied?: string;
}

export interface IServerStatusState extends IComponentState {
    runStatus: string;
    dataVersion: number;
    serverFeatures: IServerFeatures;
    serverStatus: IServerStatus;
    serverDirectories: IServerDirectories;
    serverAuthentication: IServerAuthentication;
    serverSsl: IServerSsl;
    firewall: IServerFirewall;
}

export class ServerStatus extends Component<IServerStatusProperties, IServerStatusState> {
    public constructor(props: IServerStatusProperties) {
        super(props);

        this.state = {
            runStatus: "stopped",
            dataVersion: 0,
            serverStatus: {},
            serverDirectories: {},
            serverFeatures: {},
            serverAuthentication: {},
            serverSsl: {},
            firewall: {},
        };

        this.addHandledProperties("backend");
    }

    public componentDidMount(): void {
        this.updateValues();
    }

    public componentDidUpdate(prevProps: IServerStatusProperties, _prevState: IServerStatusState): void {
        const { backend } = this.props;

        // If we reopen a connection, a new backend is created and we need to refresh the page.
        if (backend !== prevProps.backend) {
            this.updateValues();
        }
    }

    public render(): React.ReactNode {
        const { toolbarItems } = this.props;

        const infoCells: React.ReactNode[] = [];

        const className = this.getEffectiveClassNames(["serverStatus"]);
        infoCells.push(this.serverStatus());
        infoCells.push(this.serverDirectories());
        infoCells.push(this.serverFeatures());
        infoCells.push(this.serverAuthentication());
        infoCells.push(this.serverSsl());
        infoCells.push(this.firewall());

        // If toolbar items are given, render a toolbar with them.
        let toolbar: React.ReactElement | undefined;
        if (toolbarItems) {
            toolbar = <Toolbar
                id="serverStatusToolbar"
                dropShadow={false}
            >
                {toolbarItems.left}
                <div className="expander" />
                {toolbarItems.right}
            </Toolbar>;
        }

        return (
            <Container
                className="serverStatusHost"
                orientation={Orientation.TopDown}
            >
                {toolbar}
                <Container
                    className={className}
                    orientation={Orientation.TopDown}
                    mainAlignment={ContentAlignment.Start}
                    crossAlignment={ContentAlignment.Center}
                >
                    <Grid columns={2} rowGap={12} columnGap={12}>
                        <GridCell key="cellLogo" className="left">
                            <Icon src={mysqlIcon} id="mysqlLogo" />
                        </GridCell>
                        <GridCell
                            orientation={Orientation.TopDown}
                            key="cellStatusIndicator"
                            className="right statusIndicator"
                        >
                            {this.serverStatusIndicator()}
                        </GridCell>
                        {infoCells}
                    </Grid>

                </Container>
            </Container>
        );
    }

    private serverStatusIndicator = (): React.ReactNode => {
        const { runStatus } = this.state;

        let control = <>
            <Icon id="serverStoppedIcon" src={serverStoppedIcon} />
            <h3>Server status:</h3>
            <h1>Stopped</h1>
        </>;

        switch (runStatus) {
            case "stopped":
                return control;
            case "running": {
                control = <>
                    <Icon id="serverRunningIcon" src={serverRunningIcon} />
                    <h3>Server status:</h3>
                    <h1>Running</h1>
                </>;

                return control;
            }

            default: {
                return null;
            }

        }
    };

    private serverStatus = (): React.ReactNode[] => {
        const { serverStatus } = this.state;

        return (
            [<GridCell key="cell1" className="heading" columnSpan={2} orientation={Orientation.TopDown} >
                <Label caption="Main settings" />
            </GridCell>,
            <GridCell
                key="cell2"
                columnSpan={2}
                orientation={Orientation.TopDown}
                crossAlignment={ContentAlignment.Center}>
                <Divider />
            </GridCell>,

            <GridCell key="cell3" className="left">Connection Name:</GridCell>,
            <GridCell key="cell4" className="right">{serverStatus.connectionName ?? "n/a"}</GridCell>,

            <GridCell key="cell5" className="left">Host:</GridCell>,
            <GridCell key="cell6" className="right">{serverStatus.host ?? "n/a"}</GridCell>,

            <GridCell key="cell7" className="left">Socket:</GridCell>,
            <GridCell key="cell8" className="right">{serverStatus.socket ?? "n/a"}</GridCell>,

            <GridCell key="cell9" className="left">Port:</GridCell>,
            <GridCell key="cell10" className="right">{serverStatus.port ?? "n/a"}</GridCell>,

            <GridCell key="cell11" className="left">Version:</GridCell>,
            <GridCell key="cell12" className="right">
                {serverStatus.version ?? "n/a"}
            </GridCell>,

            <GridCell key="cell12" className="left">Compiled For:</GridCell>,
            <GridCell key="cell13" className="right">
                {serverStatus.compiledFor ?? "n/a"}
            </GridCell>,

            <GridCell key="cell14" className="left">Configuration File:</GridCell>,
            <GridCell key="cell15" className="right">
                {serverStatus.configFile ?? "n/a"}
            </GridCell>,

            <GridCell key="cell14" className="left">Running Since:</GridCell>,
            <GridCell key="cell15" className="right">
                {serverStatus?.runningSince ?? "n/a"}
            </GridCell>,

            ]);
    };

    private serverFeatures = (): React.ReactNode[] => {
        const { serverFeatures } = this.state;

        return (
            [<GridCell key="cell16" className="heading" columnSpan={2} orientation={Orientation.TopDown} >
                <Label caption="Server Features" />
            </GridCell>,
            <GridCell
                key="cell17"
                columnSpan={2}
                orientation={Orientation.TopDown}
                crossAlignment={ContentAlignment.Center}>
                <Divider />
            </GridCell>,

            <GridCell key="cell18" className="left">Performance Schema:</GridCell>,
            <GridCell key="cell19" className="right">
                {this.drawBoolean(serverFeatures.performanceSchema)}
                {serverFeatures.performanceSchema}
            </GridCell>,

            <GridCell key="cell20" className="left">Thread Pool:</GridCell>,
            <GridCell key="cell21" className="right">
                {this.drawBoolean(serverFeatures.threadPool)}
                {serverFeatures.threadPool}
            </GridCell>,

            <GridCell key="cell22" className="left">Memcached Plugin:</GridCell>,
            <GridCell key="cell23" className="right">{serverFeatures.memCachePlugin ?? "n/a"}</GridCell>,

            <GridCell key="cell24" className="left">Semisync Replication Plugin:</GridCell>,
            <GridCell key="cell25" className="right">{serverFeatures.semisync ?? "n/a"}</GridCell>,

            <GridCell key="cell26" className="left">SSL Availability:</GridCell>,
            <GridCell key="cell27" className="right">
                {this.drawBoolean(serverFeatures.sslAvailability)}
                {this.authenticationOutput()}
            </GridCell>,

            <GridCell key="cell28" className="left">Password Validation:</GridCell>,
            <GridCell key="cell29" className="right">
                {this.drawBoolean(serverFeatures.passwordValidation)}
                {serverFeatures.passwordValidationValue}
            </GridCell>,

            <GridCell key="cell30" className="left">Audit Log:</GridCell>,
            <GridCell key="cell31" className="right">
                {this.drawBoolean(serverFeatures.auditLog)}
                {serverFeatures.auditLogValue}
            </GridCell>,

            <GridCell key="cell32" className="left">Firewall:</GridCell>,
            <GridCell key="cell33" className="right">
                {serverFeatures?.firewall ?? "n/a"}
            </GridCell>,

            <GridCell key="cell34" className="left">Firewall Trace:</GridCell>,
            <GridCell key="cell35" className="right">
                {serverFeatures?.firewallTrace ?? "n/a"}
            </GridCell>,

            ]);
    };

    private authenticationOutput = (): React.ReactNode => {
        const { serverFeatures } = this.state;

        if (platform() === "win32" && process.env.JEST_WORKER_ID === undefined) {
            return <>
                <Label caption="Windows Authentication" />
                {this.drawBoolean(serverFeatures.windowsAuth)}
            </>;
        } else {
            return <>
                <Label caption="PAM Authentication:" />
                {this.drawBoolean(serverFeatures.pamAuth)}
            </>;
        }
    };

    private serverDirectories = (): React.ReactNode => {
        const { serverDirectories } = this.state;

        return (
            [<GridCell key="cell36" className="heading" columnSpan={2} orientation={Orientation.TopDown} >
                <Label caption="Server Directories" />
            </GridCell>,
            <GridCell
                key="cell37"
                columnSpan={2}
                orientation={Orientation.TopDown}
                crossAlignment={ContentAlignment.Center}>
                <Divider />
            </GridCell>,

            <GridCell key="cell38" className="left">Base Directory:</GridCell>,
            <GridCell key="cell39" className="right">
                {serverDirectories.baseDirectory}
            </GridCell>,

            <GridCell key="cell40" className="left">Data Directory:</GridCell>,
            <GridCell key="cell41" className="right">
                {serverDirectories.dataDirectory}
            </GridCell>,

            <GridCell key="cell42" className="left">Plugins directory:</GridCell>,
            <GridCell key="cell43" className="right">
                {serverDirectories.pluginDirectory}
            </GridCell>,

            <GridCell key="cell44" className="left">Tmp Directory:</GridCell>,
            <GridCell key="cell45" className="right">
                {serverDirectories.tmpDirectory}
            </GridCell>,

            <GridCell key="cell46" className="left">Plugins directory:</GridCell>,
            <GridCell key="cell47" className="right">
                {serverDirectories.pluginDirectory}
            </GridCell>,

            <GridCell key="cell48" className="left">Error Log:</GridCell>,
            <GridCell key="cell49" className="right">
                {this.drawBoolean(serverDirectories.errorLog)}
                {serverDirectories.errorLogValue}
            </GridCell>,

            <GridCell key="cell50" className="left">General Log:</GridCell>,
            <GridCell key="cell51" className="right">
                {this.drawBoolean(serverDirectories.generalLog)}
                {serverDirectories.generalLogFile}
            </GridCell>,

            <GridCell key="cell52" className="left">Slow Query Log:</GridCell>,
            <GridCell key="cell53" className="right">
                {this.drawBoolean(serverDirectories.slowQueryLog)}
                {serverDirectories.slowQueryLogValue}
            </GridCell>,
            ]);
    };

    private serverAuthentication = (): React.ReactNode => {
        const { serverAuthentication } = this.state;

        return (
            [<GridCell key="cell54" className="heading" columnSpan={2} orientation={Orientation.TopDown} >
                <Label caption="Server Authentication" />
            </GridCell>,
            <GridCell
                key="cell55"
                columnSpan={2}
                orientation={Orientation.TopDown}
                crossAlignment={ContentAlignment.Center}>
                <Divider />
            </GridCell>,

            <GridCell key="cell56" className="left">SHA256 Password Private Key:</GridCell>,
            <GridCell key="cell57" className="right">{serverAuthentication.privateKeyPath}</GridCell>,

            <GridCell key="cell58" className="left">SHA256 Password Public Key:</GridCell>,
            <GridCell key="cell59" className="right">{serverAuthentication.publicKeyPath}</GridCell>,
            ]);
    };

    private firewall = (): React.ReactNode => {
        const { serverFeatures, firewall } = this.state;

        if (serverFeatures.firewall) {
            return (
                [<GridCell key="cell60" className="heading" columnSpan={2} orientation={Orientation.TopDown} >
                    <Label caption="Firewall" />
                </GridCell>,
                <GridCell
                    key="cell61"
                    columnSpan={2}
                    orientation={Orientation.TopDown}
                    crossAlignment={ContentAlignment.Center}>
                    <Divider />
                </GridCell>,

                <GridCell key="cell62" className="left">Access Denied:</GridCell>,
                <GridCell key="cell63" className="right">{firewall.accessDenied}</GridCell>,

                <GridCell key="cell64" className="left">Access Granted:</GridCell>,
                <GridCell key="cell65" className="right">{firewall.accessGranted}</GridCell>,

                <GridCell key="cell66" className="left">Access Suspicious:</GridCell>,
                <GridCell key="cell67" className="right">{firewall.accessSuspicious}</GridCell>,

                <GridCell key="cell68" className="left">Cached Entries:</GridCell>,
                <GridCell key="cell69" className="right">{firewall.cachedEntries}</GridCell>,
                ]);
        }
    };

    private serverSsl = (): React.ReactNode => {
        const { serverSsl } = this.state;

        return (
            [<GridCell key="cell70" className="heading" columnSpan={2} orientation={Orientation.TopDown} >
                <Label caption="Server SSL" />
            </GridCell>,
            <GridCell
                key="cell71"
                columnSpan={2}
                orientation={Orientation.TopDown}
                crossAlignment={ContentAlignment.Center}>
                <Divider />
            </GridCell>,

            <GridCell key="cell72" className="left">SSL CA:</GridCell>,
            <GridCell key="cell73" className="right">{serverSsl.sslCa}</GridCell>,

            <GridCell key="cell74" className="left">SSL CA Path:</GridCell>,
            <GridCell key="cell75" className="right">{serverSsl.sslCaPath}</GridCell>,

            <GridCell key="cell76" className="left">SSL Cert:</GridCell>,
            <GridCell key="cell77" className="right">{serverSsl.sslCert}</GridCell>,

            <GridCell key="cell78" className="left">SSL Cipher:</GridCell>,
            <GridCell key="cell79" className="right">{serverSsl.sslCipher}</GridCell>,

            <GridCell key="cell80" className="left">SSL CRL:</GridCell>,
            <GridCell key="cell81" className="right">{serverSsl.sslClr}</GridCell>,

            <GridCell key="cell82" className="left">SSL CRL Path:</GridCell>,
            <GridCell key="cell83" className="right">{serverSsl.sslClrPath}</GridCell>,

            <GridCell key="cell84" className="left">SSL Key:</GridCell>,
            <GridCell key="cell85" className="right">{serverSsl.sslKey}</GridCell>,

            ]);
    };


    private drawBoolean = (value: TriState): React.ReactNode => {
        if (value === undefined) {
            return (<StatusMark statusState={CheckState.Indeterminate} text={"n/a"} />);
        } else if (!value) {
            return (<StatusMark statusState={CheckState.Unchecked} text={"off"} />);
        } else {
            return (<StatusMark statusState={CheckState.Checked} text={"on"} />);
        }
    };

    private updateValues(): void {
        const { backend } = this.props;
        const {
            serverStatus, serverDirectories, serverFeatures, serverAuthentication,
            serverSsl, firewall,
        } = this.state;

        backend.execute("select 1").then(() => {
            this.setState({ runStatus: "running" });
        }).catch(() => {
            this.setState({ runStatus: "stopped" });
        });

        backend.execute("show variables").then((event: ICommResultSetEvent) => {
            if (event.eventType === EventType.FinalResponse) {
                const values = new Map<string, string>(event.data.rows as Array<[string, string]>);

                serverStatus.connectionName = values.get("connection") ?? "n/a";
                serverStatus.host = values.get("hostname") ?? "n/a";
                serverStatus.socket = values.get("socket") ?? "n/a";
                serverStatus.port = values.get("port") ?? "n/a";
                serverStatus.compiledFor = values.get("version_compile_os") ?? "n/a";
                serverStatus.version = `${values.get("version_comment") ?? ""} (${values.get("version") ?? ""})`;

                // server directories
                serverDirectories.baseDirectory = values.get("basedir") ?? "n/a";
                serverDirectories.dataDirectory = values.get("datadir") ?? "n/a";
                serverDirectories.tmpDirectory = values.get("tmpdir") ?? "n/a";
                serverDirectories.pluginDirectory = values.get("plugin_dir") ?? "n/a";
                const logOutput = values.get("log_output") ?? "FILE";
                serverDirectories.generalLog = values.get("general_log") !== "OFF" &&
                    logOutput !== "NONE" ? true : false;
                serverDirectories.generalLogFile = values.get("general_log") !== "OFF" &&
                    logOutput !== "NONE" ? values.get("general_log_file") ?? "n/a" : "[Stored in database]";
                serverDirectories.errorLog = values.get("log_error") !== "OFF" ? true : false;
                serverDirectories.errorLogValue = values.get("log_error") ?? "n/a";

                serverDirectories.slowQueryLog = values.get("slow_query_log") !== "OFF" &&
                    logOutput !== "NONE" ? true : false;
                serverDirectories.slowQueryLogValue = values.get("slow_query_log") !== "OFF" &&
                    logOutput !== "NONE" ? values.get("slow_query_log") ?? "n/a" : "[Stored in database]";

                // server features
                serverFeatures.performanceSchema = this.checkTriState(values.get("performance_schema"));
                serverFeatures.threadPool = this.checkTriState(
                    values.get("thread_handling"), "loaded-dynamically",
                );
                serverFeatures.auditLog = this.checkTriState(values.get("audit_log_policy"));
                serverFeatures.auditLogValue = values.get("audit_log_policy") ?? "";
                serverFeatures.firewall = this.checkTriState(values.get("mysql_firewall_mode"));
                serverFeatures.firewallTrace = this.checkTriState(values.get("mysql_firewall_trace"));
                serverFeatures.passwordValidation = this.checkTriState(values.get("mysql_firewall_mode"));
                const firewallMode = values.get("mysql_firewall_mode");
                serverFeatures.passwordValidationValue = firewallMode ? `(Policy: ${firewallMode})` : "";
                serverFeatures.sslAvailability = (values.get("have_openssl") === "YES") ||
                    (values.get("have_ssl") === "YES");

                const semiSyncMaster = this.checkTriState(values.get("rpl_semi_sync_master_enabled"));
                const semiSyncSlave = this.checkTriState(values.get("rpl_semi_sync_slave_enabled"));
                serverFeatures.semisync = "";
                if (semiSyncMaster || semiSyncSlave) {
                    const tmp = [];
                    if (values.get("rpl_semi_sync_master_enabled") === "master") {
                        tmp.push("master");
                    }
                    if (values.get("rpl_semi_sync_slave_enabled") === "slave") {
                        tmp.push("slave");
                    }
                    serverFeatures.semisync = `(${tmp.join(", ")})`;
                }

                // server authentication
                serverAuthentication.privateKeyPath = values.get("sha256_password_private_key_path") ?? "n/a";
                serverAuthentication.publicKeyPath = values.get("sha256_password_public_key_path") ?? "n/a";

                // server ssl
                serverSsl.sslCa = values.get("ssl_ca") ?? "n/a";
                serverSsl.sslCaPath = values.get("ssl_capath") ?? "n/a";
                serverSsl.sslCert = values.get("ssl_cert") ?? "n/a";
                serverSsl.sslCipher = values.get("ssl_cipher") ?? "n/a";
                serverSsl.sslClr = values.get("ssl_crl") ?? "n/a";
                serverSsl.sslClrPath = values.get("ssl_crlpath") ?? "n/a";
                serverSsl.sslKey = values.get("ssl_key") ?? "n/a";

                if (serverFeatures.firewall) {
                    firewall.accessDenied = values.get("Firewall_access_denied") ?? "n/a";
                    firewall.accessGranted = values.get("Firewall_access_granted") ?? "n/a";
                    firewall.accessSuspicious = values.get("Firewall_access_suspicious") ?? "n/a";
                    firewall.cachedEntries = values.get("Firewall_cached_entries") ?? "n/a";
                }

                this.setState({
                    serverStatus, serverDirectories,
                    serverFeatures, serverAuthentication, serverSsl, firewall,
                });
            }
        });

        backend.execute("show global status").then((event: ICommResultSetEvent) => {
            if (event.eventType === EventType.FinalResponse) {
                const values = new Map<string, string>(event.data.rows as Array<[string, string]>);
                const ut = Number(values.get("Uptime") ?? 0);
                if (ut > 0) {
                    const uptime = new Date(ut);
                    serverStatus.runningSince = `${this.formatDuration(uptime.getTime())}`;
                } else {
                    serverStatus.runningSince = "n/a";
                }
                this.setState({ serverStatus });
            }
        });

        backend.execute("show plugins").then((event: ICommResultSetEvent) => {
            if (event.eventType === EventType.FinalResponse) {
                const values = new Map<string, string>(event.data.rows as Array<[string, string]>);
                serverFeatures.memCachePlugin = this.checkTriState(values.get("daemon_memcached"), "ACTIVE");
                serverFeatures.windowsAuth = this.checkTriState(values.get("authentication_windows"), "ACTIVE");
                serverFeatures.pamAuth = this.checkTriState(values.get("authentication_pam"), "ACTIVE");
                this.setState({ serverFeatures });
            }
        });

    }

    private formatDuration = (value: number): string => {
        const minute = ((value / 60) | 0) % 60;
        const hour = ((value / 3600) | 0) % 24;
        const day = (value / (3600 * 24)) | 0;
        let formatted = `${day} day${(day > 0 ? "s" : "")}, `;
        formatted += `${hour} hours, ${minute} minutes`;

        return formatted;
    };

    private checkTriState = (value = "", trueValue?: string): TriState => {
        if (trueValue && value === trueValue) {
            return true;
        } else if (value === "OFF" || value === "NO") {
            return false;
        } else if (value.length > 0 && !trueValue) {
            return true;
        }

        return undefined;
    };
}
