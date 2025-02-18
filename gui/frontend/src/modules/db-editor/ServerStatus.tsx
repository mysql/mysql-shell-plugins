/*
 * Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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

import * as os from "os";

import { ComponentChild } from "preact";

import { CheckState } from "../../components/ui/Checkbox/Checkbox.js";
import { ComponentBase, IComponentProperties, IComponentState } from "../../components/ui/Component/ComponentBase.js";
import { Container, ContentAlignment, ContentWrap, Orientation } from "../../components/ui/Container/Container.js";
import { Divider } from "../../components/ui/Divider/Divider.js";
import { Grid } from "../../components/ui/Grid/Grid.js";
import { GridCell } from "../../components/ui/Grid/GridCell.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import { Label } from "../../components/ui/Label/Label.js";
import { StatusMark } from "../../components/ui/StatusMark/StatusMark.js";
import { Toolbar } from "../../components/ui/Toolbar/Toolbar.js";
import { Assets } from "../../supplement/Assets.js";
import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { IToolbarItems } from "./index.js";

type TriState = true | false | undefined;

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
    host?: string;
    socket?: string;
    port?: string;
    version?: string;
    compiledFor?: string;
    configFile?: string;
    runningSince?: string;
    shortVersion?: string;
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

interface IServerStatusProperties extends IComponentProperties {
    backend?: ShellInterfaceSqlEditor;
    rowGap?: string | number;

    /** Top level toolbar items, to be integrated with page specific ones. */
    toolbarItems: IToolbarItems;
}

interface IServerStatusState extends IComponentState {
    runStatus: string;
    dataVersion: number;
    serverFeatures: IServerFeatures;
    serverStatus: IServerStatus;
    serverDirectories: IServerDirectories;
    serverAuthentication: IServerAuthentication;
    serverSsl: IServerSsl;
    firewall: IServerFirewall;
}

export class ServerStatus extends ComponentBase<IServerStatusProperties, IServerStatusState> {

    public static override defaultProps = {
        rowGap: 3,
    };

    private showWindowsAuth = false;

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

        this.addHandledProperties("backend", "rowGap", "toolbarItems");
        this.showWindowsAuth = (typeof os.platform === "function" && os.platform() === "win32"
            && process.env.JEST_WORKER_ID === undefined);
    }

    public override componentDidMount(): void {
        void this.updateValues();
    }

    public override componentDidUpdate(prevProps: IServerStatusProperties, _prevState: IServerStatusState): void {
        const { backend } = this.props;

        // If we reopen a connection, a new backend is created and we need to refresh the page.
        if (backend !== prevProps.backend) {
            void this.updateValues();
        }
    }

    public render(): ComponentChild {
        const { toolbarItems } = this.props;
        const { serverStatus } = this.state;

        const infoCells: ComponentChild[] = [];

        const className = this.getEffectiveClassNames(["serverStatus"]);
        infoCells.push(this.serverStatus());
        infoCells.push(this.serverDirectories());
        infoCells.push(this.serverFeatures());
        infoCells.push(this.serverSsl());
        infoCells.push(this.serverAuthentication());
        infoCells.push(this.firewall());

        // If toolbar items are given, render a toolbar with them.
        const toolbar = <Toolbar id="serverStatusToolbar" dropShadow={false} >
            {toolbarItems.navigation}
            <div className="expander" />
            {toolbarItems.auxiliary}
        </Toolbar>;

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
                    <Grid columns={2} rowGap={15} columnGap={12} id="header">
                        <GridCell rowSpan={2}>
                            <Icon src={Assets.misc.mysqlLogoIcon} id="mysqlLogo" />
                        </GridCell>
                        <GridCell
                            orientation={Orientation.TopDown}
                            key="serverInfo"

                        >
                            <h1>Server status</h1>
                            <h2>{serverStatus.shortVersion}</h2>
                        </GridCell>

                    </Grid>
                    <Container
                        id="statusBoxHost"
                        orientation={Orientation.LeftToRight}
                        mainAlignment={ContentAlignment.SpaceEvenly}
                        crossAlignment={ContentAlignment.Start}
                        wrap={ContentWrap.Wrap}
                    >
                        {infoCells}
                    </Container>
                </Container>
            </Container>
        );
    }

    private serverStatus = (): ComponentChild => {
        const { rowGap } = this.props;
        const { serverStatus } = this.state;

        return (
            <Grid columns={["minmax(min-content,max-content)", "1fr"]} rowGap={rowGap} columnGap={12}>
                <GridCell key="cell1" className="heading" columnSpan={2} orientation={Orientation.TopDown} >
                    <Label caption="Main Settings" />
                </GridCell>
                <GridCell
                    key="cell2"
                    columnSpan={2}
                    orientation={Orientation.TopDown}
                    crossAlignment={ContentAlignment.Center}>
                    <Divider />
                </GridCell>

                <GridCell key="cell5" className="left">Host:</GridCell>
                <GridCell key="cell6" data-testid="host">{serverStatus.host ?? "none"}</GridCell>

                <GridCell key="cell7" className="left">Socket:</GridCell>
                <GridCell key="cell8" data-testid="socket">{serverStatus.socket ?? "none"}</GridCell>

                <GridCell key="cell9" className="left">Port:</GridCell>
                <GridCell key="cell10" data-testid="port">{serverStatus.port ?? "none"}</GridCell>

                <GridCell key="cell11" className="left">Version:</GridCell>
                <GridCell key="cell12" data-testid="version">
                    {serverStatus.version ?? "none"}
                </GridCell>
                <GridCell key="cell13" className="left">Compiled For:</GridCell>
                <GridCell key="cell14" data-testid="compiledFor">
                    {serverStatus.compiledFor ?? "none"}
                </GridCell>
                <GridCell key="cell15" className="left">Configuration File:</GridCell>
                <GridCell key="cell16" data-testid="configFile">
                    {serverStatus.configFile ?? "none"}
                </GridCell>
                <GridCell key="cell17" className="left">Running Since:</GridCell>
                <GridCell key="cell18" data-testid="runningSince">
                    {serverStatus?.runningSince ?? "none"}
                </GridCell>
            </Grid>
        );
    };

    private serverFeatures = (): ComponentChild => {
        const { rowGap } = this.props;
        const { serverFeatures } = this.state;

        return (
            <Grid columns={["minmax(min-content,max-content)", "1fr"]} rowGap={rowGap} columnGap={12}>
                <GridCell key="cell16" className="heading" columnSpan={2} orientation={Orientation.TopDown} >
                    <Label caption="Server Features" />
                </GridCell>
                <GridCell
                    key="cell17"
                    columnSpan={2}
                    orientation={Orientation.TopDown}
                    crossAlignment={ContentAlignment.Center}>
                    <Divider />
                </GridCell>

                <GridCell key="cell18" className="left">Performance Schema:</GridCell>
                <GridCell key="cell19" data-testid="performanceSchema">
                    {this.drawBoolean(serverFeatures.performanceSchema)}
                    {serverFeatures.performanceSchema}
                </GridCell>

                <GridCell key="cell20" className="left">Thread Pool:</GridCell>
                <GridCell key="cell21" data-testid="threadPool">
                    {this.drawBoolean(serverFeatures.threadPool)}
                    {serverFeatures.threadPool}
                </GridCell>

                <GridCell key="cell22" className="left">Memcached Plugin:</GridCell>
                <GridCell key="cell23" data-testid="memCached">{serverFeatures.memCachePlugin ?? "none"}</GridCell>

                <GridCell key="cell24" className="left">Semisync Replication Plugin:</GridCell>
                <GridCell key="cell25" data-testid="semiSyncPlugin">{serverFeatures.semisync ?? "none"}</GridCell>

                {this.authenticationOutput()}

                <GridCell key="cell28" className="left">Password Validation:</GridCell>
                <GridCell key="cell29" data-testid="passwordValidation">
                    {this.drawBoolean(serverFeatures.passwordValidation)}
                    {serverFeatures.passwordValidationValue}
                </GridCell>

                <GridCell key="cell30" className="left">Audit Log:</GridCell>
                <GridCell key="cell31" data-testid="auditLog">
                    {this.drawBoolean(serverFeatures.auditLog)}
                    {serverFeatures.auditLogValue}
                </GridCell>

                <GridCell key="cell32" className="left">Firewall:</GridCell>
                <GridCell key="cell33" data-testid="firewall">
                    {serverFeatures?.firewall ?? "none"}
                </GridCell>

                <GridCell key="cell34" className="left">Firewall Trace:</GridCell>
                <GridCell key="cell35" data-testid="firewallTrace">
                    {serverFeatures?.firewallTrace ?? "none"}
                </GridCell>
            </Grid>
        );
    };

    private authenticationOutput = (): ComponentChild => {
        const { serverFeatures } = this.state;

        if (this.showWindowsAuth) {
            return <>
                <GridCell key="cell90" className="left">Windows Authentication:</GridCell>
                <GridCell key="cell91" data-testid="windowsAuth">
                    {this.drawBoolean(serverFeatures.windowsAuth)}
                </GridCell>
            </>;
        } else {
            return <>
                <GridCell key="cell90" className="left">PAM Authentication:</GridCell>
                <GridCell key="cell91" data-testid="pamAuth">
                    {this.drawBoolean(serverFeatures.pamAuth)}
                </GridCell>
            </>;
        }
    };

    private serverDirectories = (): ComponentChild => {
        const { rowGap } = this.props;
        const { serverDirectories } = this.state;

        return (
            <Grid columns={["minmax(min-content,max-content)", "1fr"]} rowGap={rowGap} columnGap={12}>
                <GridCell key="cell36" className="heading" columnSpan={2} orientation={Orientation.TopDown} >
                    <Label caption="Server Directories" />
                </GridCell>
                <GridCell
                    key="cell37"
                    columnSpan={2}
                    orientation={Orientation.TopDown}
                    crossAlignment={ContentAlignment.Center}>
                    <Divider />
                </GridCell>
                <GridCell key="cell38" className="left">Base Directory:</GridCell>
                <GridCell key="cell39" data-testid="baseDir">
                    {serverDirectories.baseDirectory}
                </GridCell>
                <GridCell key="cell40" className="left">Data Directory:</GridCell>
                <GridCell key="cell41" data-testid="dataDir">
                    {serverDirectories.dataDirectory}
                </GridCell>
                <GridCell key="cell42" className="left">Plugins directory:</GridCell>
                <GridCell key="cell43" data-testid="pluginsDir">
                    {serverDirectories.pluginDirectory}
                </GridCell>
                <GridCell key="cell44" className="left">Tmp Directory:</GridCell>
                <GridCell key="cell45" data-testid="tmpDir">
                    {serverDirectories.tmpDirectory}
                </GridCell>
                <GridCell key="cell48" className="left">Error Log:</GridCell>
                <GridCell key="cell49" data-testid="errorLog">
                    {this.drawBoolean(serverDirectories.errorLog)}
                    {serverDirectories.errorLogValue}
                </GridCell>
                <GridCell key="cell50" className="left">General Log:</GridCell>
                <GridCell key="cell51" data-testid="generalLog">
                    {this.drawBoolean(serverDirectories.generalLog)}
                    {serverDirectories.generalLogFile}
                </GridCell>
                <GridCell key="cell52" className="left">Slow Query Log:</GridCell>
                <GridCell key="cell53" data-testid="slowQueryLog">
                    {this.drawBoolean(serverDirectories.slowQueryLog)}
                    {serverDirectories.slowQueryLogValue}
                </GridCell>
            </Grid >);
    };

    private serverAuthentication = (): ComponentChild => {
        const { rowGap } = this.props;
        const { serverAuthentication } = this.state;

        return (
            <Grid columns={["minmax(min-content,max-content)", "1fr"]} rowGap={rowGap} columnGap={12}>
                <GridCell key="cell54" className="heading" columnSpan={2} orientation={Orientation.TopDown} >
                    <Label caption="Server Authentication" />
                </GridCell>
                <GridCell
                    key="cell55"
                    columnSpan={2}
                    orientation={Orientation.TopDown}
                    crossAlignment={ContentAlignment.Center}>
                    <Divider />
                </GridCell>

                <GridCell key="cell56" className="left">SHA256 Private Key:</GridCell>
                <GridCell key="cell57" data-testid="privateKey">{serverAuthentication.privateKeyPath}</GridCell>

                <GridCell key="cell58" className="left">SHA256 Public Key:</GridCell>
                <GridCell key="cell59" data-testid="publicKey">{serverAuthentication.publicKeyPath}</GridCell>
            </Grid>);
    };

    private firewall = (): ComponentChild => {
        const { rowGap } = this.props;
        const { serverFeatures, firewall } = this.state;

        if (serverFeatures.firewall) {
            return (
                <Grid columns={["minmax(min-content,max-content)", "1fr"]} rowGap={rowGap} columnGap={12}>
                    <GridCell key="cell60" className="heading" columnSpan={2} orientation={Orientation.TopDown} >
                        <Label caption="Firewall" />
                    </GridCell>
                    <GridCell
                        key="cell61"
                        columnSpan={2}
                        orientation={Orientation.TopDown}
                        crossAlignment={ContentAlignment.Center}>
                        <Divider />
                    </GridCell>
                    <GridCell key="cell62" className="left">Access Denied:</GridCell>
                    <GridCell key="cell63">{firewall.accessDenied}</GridCell>
                    <GridCell key="cell64" className="left">Access Granted:</GridCell>
                    <GridCell key="cell65">{firewall.accessGranted}</GridCell>
                    <GridCell key="cell66" className="left">Access Suspicious:</GridCell>
                    <GridCell key="cell67">{firewall.accessSuspicious}</GridCell>
                    <GridCell key="cell68" className="left">Cached Entries:</GridCell>
                    <GridCell key="cell69">{firewall.cachedEntries}</GridCell>
                </Grid>
            );
        }
    };

    private serverSsl = (): ComponentChild => {
        const { rowGap } = this.props;
        const { serverSsl } = this.state;

        return (
            <Grid columns={["minmax(min-content,max-content)", "1fr"]} rowGap={rowGap} columnGap={12}>
                <GridCell key="cell70" className="heading" columnSpan={2} orientation={Orientation.TopDown} >
                    <Label caption="Server SSL" />
                </GridCell>
                <GridCell
                    key="cell71"
                    columnSpan={2}
                    orientation={Orientation.TopDown}
                    crossAlignment={ContentAlignment.Center}>
                    <Divider />
                </GridCell>
                <GridCell key="cell72" className="left">SSL CA:</GridCell>
                <GridCell key="cell73" data-testid="sslCa">{serverSsl.sslCa}</GridCell>
                <GridCell key="cell74" className="left">SSL CA Path:</GridCell>
                <GridCell key="cell75" data-testid="sslCaPath">{serverSsl.sslCaPath}</GridCell>
                <GridCell key="cell76" className="left">SSL Cert:</GridCell>
                <GridCell key="cell77" data-testid="sslCert">{serverSsl.sslCert}</GridCell>
                <GridCell key="cell78" className="left">SSL Cipher:</GridCell>
                <GridCell key="cell79" data-testid="sslCipher">{serverSsl.sslCipher}</GridCell>
                <GridCell key="cell80" className="left">SSL CRL:</GridCell>
                <GridCell key="cell81" data-testid="sslCrl">{serverSsl.sslClr}</GridCell>
                <GridCell key="cell82" className="left">SSL CRL Path:</GridCell>
                <GridCell key="cell83" data-testid="sslCrlPath">{serverSsl.sslClrPath}</GridCell>
                <GridCell key="cell84" className="left">SSL Key:</GridCell>
                <GridCell key="cell85" data-testid="sslKey">{serverSsl.sslKey}</GridCell>
            </Grid>
        );
    };


    private drawBoolean = (value: TriState): ComponentChild => {
        if (value === undefined) {
            return (<StatusMark statusState={CheckState.Indeterminate} text={"none"} />);
        } else if (!value) {
            return (<StatusMark statusState={CheckState.Unchecked} text={"off"} />);
        } else {
            return (<StatusMark statusState={CheckState.Checked} text={"on"} />);
        }
    };

    private async updateValues(): Promise<void> {
        const { backend } = this.props;
        if (!backend) {
            return;
        }

        const {
            serverStatus, serverDirectories, serverFeatures, serverAuthentication, serverSsl, firewall,
        } = this.state;

        backend.execute("select 1").then(() => {
            this.setState({ runStatus: "running" });
        }).catch(() => {
            this.setState({ runStatus: "stopped" });
        });

        try {
            let result = await backend.execute("show variables");
            if (result && result.rows) {
                const values = new Map<string, string>(result.rows as Array<[string, string]>);

                serverStatus.host = values.get("hostname") ?? "none";
                serverStatus.socket = values.get("socket") ?? "none";
                serverStatus.port = values.get("port") ?? "none";
                serverStatus.compiledFor = values.get("version_compile_os") ?? "none";
                serverStatus.version = `${values.get("version_comment") ?? "none"}` +
                    `(${values.get("version") ?? "none"})`;
                serverStatus.shortVersion = `${values.get("version_comment") ?? "none"}`;

                // server directories
                serverDirectories.baseDirectory = values.get("basedir") ?? "none";
                serverDirectories.dataDirectory = values.get("datadir") ?? "none";
                serverDirectories.tmpDirectory = values.get("tmpdir") ?? "none";
                serverDirectories.pluginDirectory = values.get("plugin_dir") ?? "none";
                const logOutput = values.get("log_output") ?? "FILE";
                serverDirectories.generalLog = values.get("general_log") !== "OFF" &&
                    logOutput !== "NONE" ? true : false;
                serverDirectories.generalLogFile = values.get("general_log") !== "OFF" &&
                    logOutput !== "NONE" ? values.get("general_log_file") ?? "none" : "[Stored in database]";
                serverDirectories.errorLog = values.get("log_error") !== "OFF" ? true : false;
                serverDirectories.errorLogValue = values.get("log_error") ?? "none";

                serverDirectories.slowQueryLog = values.get("slow_query_log") !== "OFF" &&
                    logOutput !== "NONE" ? true : false;
                serverDirectories.slowQueryLogValue = values.get("slow_query_log") !== "OFF" &&
                    logOutput !== "NONE" ? values.get("slow_query_log") ?? "none" : "[Stored in database]";

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
                serverFeatures.semisync = "none";
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
                serverAuthentication.privateKeyPath = values.get("sha256_password_private_key_path") ?? "none";
                serverAuthentication.publicKeyPath = values.get("sha256_password_public_key_path") ?? "none";

                // server ssl
                serverSsl.sslCa = values.get("ssl_ca") ?? "none";
                serverSsl.sslCaPath = values.get("ssl_capath") ?? "none";
                serverSsl.sslCert = values.get("ssl_cert") ?? "none";
                serverSsl.sslCipher = values.get("ssl_cipher") ?? "none";
                serverSsl.sslClr = values.get("ssl_crl") ?? "none";
                serverSsl.sslClrPath = values.get("ssl_crlpath") ?? "none";
                serverSsl.sslKey = values.get("ssl_key") ?? "none";

                if (serverFeatures.firewall) {
                    firewall.accessDenied = values.get("Firewall_access_denied") ?? "none";
                    firewall.accessGranted = values.get("Firewall_access_granted") ?? "none";
                    firewall.accessSuspicious = values.get("Firewall_access_suspicious") ?? "none";
                    firewall.cachedEntries = values.get("Firewall_cached_entries") ?? "none";
                }

                this.setState({
                    serverStatus, serverDirectories,
                    serverFeatures, serverAuthentication, serverSsl, firewall,
                });
            }

            result = await backend.execute("show global status");
            if (result && result.rows) {
                const values = new Map<string, string>(result.rows as Array<[string, string]>);
                const ut = Number(values.get("Uptime") ?? 0);
                if (ut > 0) {
                    const uptime = new Date(ut);
                    serverStatus.runningSince = `${this.formatDuration(uptime.getTime())}`;
                } else {
                    serverStatus.runningSince = "none";
                }
                this.setState({ serverStatus });
            }

            result = await backend.execute("show plugins");
            if (result && result.rows) {
                const values = new Map<string, string>(result.rows as Array<[string, string]>);
                serverFeatures.memCachePlugin = this.checkTriState(values.get("daemon_memcached"), "ACTIVE");
                serverFeatures.windowsAuth = this.checkTriState(values.get("authentication_windows"), "ACTIVE");
                serverFeatures.pamAuth = this.checkTriState(values.get("authentication_pam"), "ACTIVE");
                this.setState({ serverFeatures });
            }
        } catch (_) {
            this.setState({ runStatus: "stopped" });
        }
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
