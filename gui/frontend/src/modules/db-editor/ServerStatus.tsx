/*
 * Copyright (c) 2022, 2026, Oracle and/or its affiliates.
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

import { ComponentBase, IComponentProperties, IComponentState } from "../../components/ui/Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../../components/ui/Container/Container.js";
import { Grid } from "../../components/ui/Grid/Grid.js";
import { GridCell } from "../../components/ui/Grid/GridCell.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import { Label } from "../../components/ui/Label/Label.js";
import { parseVersion } from "../../parsing/mysql/mysql-helpers.js";
import { appParameters } from "../../supplement/AppParameters.js";
import { Assets } from "../../supplement/Assets.js";
import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { IToolbarItems } from "./index.js";

type TriState = true | false | undefined;

interface IServerFeatures {
    semisync?: string;
    passwordValidationValue?: string;
    auditLogValue?: string;
    showSslAvailability?: boolean;
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
    adminAddress?: string;
    adminPort?: string;
    bindAddress?: string;
    binaryLogStatus?: string;
    host?: string;
    offlineModeStatus?: string;
    readOnlyStatus?: string;
    redoLogStatus?: string;
    superReadOnlyStatus?: string;
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

interface IServerSsl {
    sslKey?: string;
    sslClrPath?: string;
    sslClr?: string;
    sslCipher?: string;
    sslCert?: string;
    sslCaPath?: string;
    sslCa?: string;
    sslServerNotAfter?: string;
    sslServerNotBefore?: string;
}

interface IServerFirewall {
    cachedEntries?: string;
    accessSuspicious?: string;
    accessGranted?: string;
    accessDenied?: string;
}

interface IServerStatusProperties extends IComponentProperties {
    backend?: ShellInterfaceSqlEditor;

    /** Top level toolbar items, to be integrated with page specific ones. */
    toolbarItems: IToolbarItems;
}

interface IServerStatusState extends IComponentState {
    runStatus: string;
    dataVersion: number;
    serverFeatures: IServerFeatures;
    serverStatus: IServerStatus;
    serverDirectories: IServerDirectories;
    serverSsl: IServerSsl;
    firewall: IServerFirewall;
}

export class ServerStatus extends ComponentBase<IServerStatusProperties, IServerStatusState> {

    private showWindowsAuth = false;

    public constructor(props: IServerStatusProperties) {
        super(props);

        this.state = {
            runStatus: "stopped",
            dataVersion: 0,
            serverStatus: {},
            serverDirectories: {},
            serverFeatures: {},
            serverSsl: {},
            firewall: {},
        };

        this.addHandledProperties("backend", "toolbarItems");
        this.showWindowsAuth = (typeof os.platform === "function" && os.platform() === "win32"
            && !appParameters.testsRunning);
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
        const { runStatus, serverStatus } = this.state;

        const statusCards: ComponentChild[] = [];

        const className = this.getEffectiveClassNames(["serverStatus"]);
        statusCards.push(this.serverStatus());
        statusCards.push(this.serverModeStatus());
        statusCards.push(this.serverDirectories());
        statusCards.push(this.serverFeatures());
        statusCards.push(this.serverSsl());
        statusCards.push(this.firewall());

        const statusText = runStatus === "running" ? "Running" : "Stopped";

        return (
            <Container
                className="serverStatusHost"
                orientation={Orientation.TopDown}
            >
                <Container
                    className={className}
                    orientation={Orientation.TopDown}
                    mainAlignment={ContentAlignment.Start}
                    crossAlignment={ContentAlignment.Stretch}
                >
                    <Container
                        id="serverStatusOverview"
                        orientation={Orientation.TopDown}
                    >
                        <Container
                            id="serverStatusHeader"
                            orientation={Orientation.LeftToRight}
                            mainAlignment={ContentAlignment.SpaceBetween}
                            crossAlignment={ContentAlignment.Center}
                        >
                            <Container
                                className="serverStatusTitle"
                                orientation={Orientation.LeftToRight}
                                crossAlignment={ContentAlignment.Center}
                            >
                                <Icon src={Assets.misc.mysqlLogoIcon} id="mysqlLogo" />
                                <Container orientation={Orientation.TopDown}>
                                    <h1>Server Status</h1>
                                    <div className="serverStatusVersion" data-testid="version">
                                        {this.valueOrNone(serverStatus.version)}
                                    </div>
                                </Container>
                            </Container>
                            <div className={`serverStatusState ${runStatus}`}>
                                {statusText}
                            </div>
                        </Container>
                        <div className="serverStatusSummary">
                            {this.summaryItem("Host:Port", this.hostPort(serverStatus.host, serverStatus.port))}
                            {this.summaryItem("Uptime", this.valueOrNone(serverStatus.runningSince), "runningSince")}
                            {this.summaryItem("InnoDB Redo Log", this.redoLogSummary(),
                                "redoLogStatus")}
                            {this.summaryItem("Binary Log", this.drawStatusPill(serverStatus.binaryLogStatus),
                                "binaryLogStatus")}
                        </div>
                    </Container>
                    <div id="statusBoxHost">
                        {statusCards}
                    </div>
                </Container>
            </Container>
        );
    }

    private valueOrNone = (value?: string): string => {
        return value && value.length > 0 ? value : "none";
    };

    private valueOrBlank = (value?: string): ComponentChild => {
        return value && value !== "none" ? value : undefined;
    };

    private hostPort = (host?: string, port?: string): string => {
        const actualHost = host && host !== "none" ? host : undefined;
        const actualPort = port && port !== "none" ? port : undefined;

        if (actualHost && actualPort) {
            return `${actualHost}:${actualPort}`;
        }

        return actualHost ?? actualPort ?? "none";
    };

    private valueFrom = (values: Map<string, string>, ...names: string[]): string => {
        for (const name of names) {
            const value = values.get(name);
            if (value !== undefined) {
                return value;
            }
        }

        return "none";
    };

    private summaryItem = (label: string, value: ComponentChild, testId?: string): ComponentChild => {
        return (
            <div className="serverStatusSummaryItem" key={label}>
                <span>{label}</span>
                <div className="serverStatusSummaryValue" data-testid={testId}>
                    <strong>{value}</strong>
                </div>
            </div>
        );
    };

    private fieldRow = (id: string, label: string, value: ComponentChild): ComponentChild[] => {
        return [
            <GridCell key={`${id}Label`} className="serverStatusFieldLabel">{label}</GridCell>,
            <GridCell key={id} className="serverStatusFieldValue" data-testid={id}>{value}</GridCell>,
        ];
    };

    private statusSection = (id: string, title: string, fields: ComponentChild[]): ComponentChild => {
        return (
            <Container
                id={id}
                className="serverStatusCard"
                orientation={Orientation.TopDown}
            >
                <Container
                    className="serverStatusCardHeader"
                    orientation={Orientation.LeftToRight}
                    mainAlignment={ContentAlignment.SpaceBetween}
                    crossAlignment={ContentAlignment.Center}
                >
                    <Label caption={title} />
                </Container>
                <Grid
                    className="serverStatusFields"
                    columns={["max-content", "minmax(0, 1fr)"]}
                    rowGap={8}
                    columnGap={16}
                >
                    {fields}
                </Grid>
            </Container>
        );
    };

    private serverStatus = (): ComponentChild => {
        const { serverStatus } = this.state;

        return this.statusSection("serverSettings", "General", [
            ...this.fieldRow("host", "Host", this.valueOrBlank(serverStatus.host)),
            ...this.fieldRow("bindAddress", "Bind Address", this.valueOrBlank(serverStatus.bindAddress)),
            ...this.fieldRow("socket", "Socket", this.valueOrBlank(serverStatus.socket)),
            ...this.fieldRow("port", "Port", this.valueOrBlank(serverStatus.port)),
            ...this.fieldRow("adminAddress", "Admin Address", this.valueOrBlank(serverStatus.adminAddress)),
            ...this.fieldRow("adminPort", "Admin Port", this.valueOrBlank(serverStatus.adminPort)),
            ...this.fieldRow("compiledFor", "Compiled For", this.valueOrBlank(serverStatus.compiledFor)),
            ...this.fieldRow("configFile", "Configuration File", this.valueOrBlank(serverStatus.configFile)),
        ]);
    };

    private serverModeStatus = (): ComponentChild => {
        const { serverStatus } = this.state;

        return this.statusSection("serverModeStatus", "Status", [
            ...this.fieldRow("readOnlyStatus", "Read-only", this.drawStatusPill(serverStatus.readOnlyStatus)),
            ...this.fieldRow("superReadOnlyStatus", "Super read-only",
                this.drawStatusPill(serverStatus.superReadOnlyStatus)),
            ...this.fieldRow("offlineModeStatus", "Offline mode", this.drawStatusPill(serverStatus.offlineModeStatus)),
        ]);
    };

    private serverFeatures = (): ComponentChild => {
        const { serverFeatures } = this.state;

        const rows = [
            ...this.fieldRow("performanceSchema", "Performance Schema",
                this.drawFeatureBoolean(serverFeatures.performanceSchema)),
            ...this.fieldRow("threadPool", "Thread Pool", this.drawFeatureBoolean(serverFeatures.threadPool)),
            ...this.fieldRow("memCached", "Memcached Plugin", this.drawFeatureBoolean(serverFeatures.memCachePlugin)),
            ...this.fieldRow("semiSyncPlugin", "Semisync Replication Plugin",
                this.drawFeatureValue(serverFeatures.semisync)),
            ...this.authenticationOutput(),
            ...this.fieldRow("passwordValidation", "Password Validation",
                <>
                    {this.drawFeatureBoolean(serverFeatures.passwordValidation)}
                    <span>{serverFeatures.passwordValidationValue}</span>
                </>),
            ...this.fieldRow("auditLog", "Audit Log",
                <>
                    {this.drawFeatureBoolean(serverFeatures.auditLog)}
                    <span>{serverFeatures.auditLogValue}</span>
                </>),
            ...this.fieldRow("firewall", "Firewall", this.drawFeatureBoolean(serverFeatures.firewall)),
            ...this.fieldRow("firewallTrace", "Firewall Trace", this.drawFeatureBoolean(serverFeatures.firewallTrace)),
        ];

        if (serverFeatures.showSslAvailability) {
            rows.push(...this.fieldRow("sslAvailable", "SSL Available",
                this.drawFeatureBoolean(serverFeatures.sslAvailability)));
        }

        return this.statusSection("serverFeatures", "Server Features", rows);
    };

    private authenticationOutput = (): ComponentChild[] => {
        const { serverFeatures } = this.state;

        if (this.showWindowsAuth) {
            return this.fieldRow("windowsAuth", "Windows Authentication",
                this.drawFeatureBoolean(serverFeatures.windowsAuth));
        } else {
            return this.fieldRow("pamAuth", "PAM Authentication", this.drawFeatureBoolean(serverFeatures.pamAuth));
        }
    };

    private serverDirectories = (): ComponentChild => {
        const { serverDirectories } = this.state;

        return this.statusSection("serverDirectories", "Directories and Logs", [
            ...this.fieldRow("baseDir", "Base Directory", this.valueOrNone(serverDirectories.baseDirectory)),
            ...this.fieldRow("dataDir", "Data Directory", this.valueOrNone(serverDirectories.dataDirectory)),
            ...this.fieldRow("pluginsDir", "Plugins Directory", this.valueOrNone(serverDirectories.pluginDirectory)),
            ...this.fieldRow("tmpDir", "Temp Directory", this.valueOrNone(serverDirectories.tmpDirectory)),
            ...this.fieldRow("errorLog", "Error Log",
                <>
                    {this.drawBoolean(serverDirectories.errorLog)}
                    <span>{this.valueOrNone(serverDirectories.errorLogValue)}</span>
                </>),
            ...this.fieldRow("generalLog", "General Log",
                <>
                    {this.drawBoolean(serverDirectories.generalLog)}
                    <span>{this.valueOrNone(serverDirectories.generalLogFile)}</span>
                </>),
            ...this.fieldRow("slowQueryLog", "Slow Query Log",
                <>
                    {this.drawBoolean(serverDirectories.slowQueryLog)}
                    <span>{this.valueOrNone(serverDirectories.slowQueryLogValue)}</span>
                </>),
        ]);
    };

    private firewall = (): ComponentChild => {
        const { serverFeatures, firewall } = this.state;

        if (serverFeatures.firewall) {
            return this.statusSection("firewall", "Firewall", [
                ...this.fieldRow("firewallDenied", "Access Denied", this.valueOrNone(firewall.accessDenied)),
                ...this.fieldRow("firewallGranted", "Access Granted", this.valueOrNone(firewall.accessGranted)),
                ...this.fieldRow("firewallSuspicious", "Access Suspicious",
                    this.valueOrNone(firewall.accessSuspicious)),
                ...this.fieldRow("firewallCached", "Cached Entries", this.valueOrNone(firewall.cachedEntries)),
            ]);
        }
    };

    private serverSsl = (): ComponentChild => {
        const { serverSsl } = this.state;

        return this.statusSection("serverSsl", "TLS and Certificates", [
            ...this.fieldRow("sslCa", "SSL CA", this.valueOrBlank(serverSsl.sslCa)),
            ...this.fieldRow("sslCaPath", "SSL CA Path", this.valueOrBlank(serverSsl.sslCaPath)),
            ...this.fieldRow("sslCert", "SSL Cert", this.valueOrBlank(serverSsl.sslCert)),
            ...this.fieldRow("sslCipher", "SSL Cipher", this.valueOrBlank(serverSsl.sslCipher)),
            ...this.fieldRow("sslCrl", "SSL CRL", this.valueOrBlank(serverSsl.sslClr)),
            ...this.fieldRow("sslCrlPath", "SSL CRL Path", this.valueOrBlank(serverSsl.sslClrPath)),
            ...this.fieldRow("sslKey", "SSL Key", this.valueOrBlank(serverSsl.sslKey)),
            ...this.fieldRow("sslServerNotBefore", "SSL Server Not Before",
                this.valueOrBlank(serverSsl.sslServerNotBefore)),
            ...this.fieldRow("sslServerNotAfter", "SSL Server Not After",
                this.valueOrBlank(serverSsl.sslServerNotAfter)),
        ]);
    };

    private drawBoolean = (value: TriState): ComponentChild => {
        if (value === undefined) {
            return <span className="serverStatusBoolean none">none</span>;
        } else if (!value) {
            return <span className="serverStatusBoolean off">off</span>;
        } else {
            return <span className="serverStatusBoolean on">on</span>;
        }
    };

    private drawStatusPill = (value?: string): ComponentChild => {
        const normalized = value?.toLowerCase();
        if (!normalized || normalized === "none") {
            return undefined;
        }

        const enabled = normalized === "on" || normalized === "yes" || normalized === "1" || normalized === "enabled";
        const label = enabled ? "on" : "off";

        return <span className={`serverStatusBoolean ${label}`}>{label}</span>;
    };

    private drawRedoLogStatusPill = (): ComponentChild => {
        const { serverStatus } = this.state;
        const normalized = serverStatus.redoLogStatus?.toLowerCase();
        if (!normalized || normalized === "none") {
            return undefined;
        }

        const enabled = normalized === "on" || normalized === "yes" || normalized === "1" || normalized === "enabled";
        const label = enabled ? "on" : "off";

        return <span className={`serverStatusBoolean redoLog ${label}`}>{label}</span>;
    };

    private isStatusOff = (value?: string): boolean => {
        const normalized = value?.toLowerCase();

        return normalized === "off" || normalized === "no" || normalized === "0" || normalized === "disabled";
    };

    private redoLogSummary = (): ComponentChild => {
        const { serverStatus } = this.state;

        return (
            <>
                {this.drawRedoLogStatusPill()}
                {this.isStatusOff(serverStatus.redoLogStatus) && (
                    <span className="serverStatusWarningText">crash recovery is disabled</span>
                )}
            </>
        );
    };

    private drawFeatureBoolean = (value: TriState): ComponentChild => {
        if (value === undefined) {
            return <span className="serverStatusBoolean none">not installed</span>;
        }

        return this.drawBoolean(value);
    };

    private featureValueOrNotInstalled = (value?: string): string => {
        return value && value.length > 0 && value !== "none" ? value : "not installed";
    };

    private drawFeatureValue = (value?: string): ComponentChild => {
        const displayValue = this.featureValueOrNotInstalled(value);
        const className = displayValue === "not installed" ? "none" : "on";

        return <span className={`serverStatusBoolean ${className}`}>{displayValue}</span>;
    };

    private logTarget = (enabled: boolean, logOutput: string, fileValue?: string): string => {
        if (!enabled) {
            return "";
        }

        return logOutput.split(",").includes("TABLE") ? "[Stored in database]" : fileValue ?? "none";
    };

    private async updateValues(): Promise<void> {
        const { backend } = this.props;
        if (!backend) {
            return;
        }

        const { serverStatus, serverDirectories, serverFeatures, serverSsl, firewall } = this.state;

        backend.executeService("select 1").then(() => {
            this.setState({ runStatus: "running" });
        }).catch(() => {
            this.setState({ runStatus: "stopped" });
        });

        try {
            let result = await backend.executeService("show variables");
            if (result?.rows) {
                const values = new Map<string, string>(result.rows as Array<[string, string]>);

                serverStatus.host = values.get("hostname") ?? "none";
                serverStatus.bindAddress = this.valueFrom(values, "bind_address", "bind-address");
                serverStatus.adminAddress = this.valueFrom(values, "admin_address", "admin-address");
                serverStatus.adminPort = this.valueFrom(values, "admin_port", "admin-port");
                serverStatus.socket = values.get("socket") ?? "none";
                serverStatus.port = values.get("port") ?? "none";
                serverStatus.binaryLogStatus = values.get("log_bin") ?? "none";
                serverStatus.readOnlyStatus = values.get("read_only") ?? "none";
                serverStatus.superReadOnlyStatus = values.get("super_read_only") ?? "none";
                serverStatus.offlineModeStatus = values.get("offline_mode") ?? "none";
                serverStatus.compiledFor = values.get("version_compile_os") ?? "none";
                serverStatus.version = (values.get("version_comment") ?? "none") +
                    ` (${values.get("version") ?? "none"})`;

                // server directories
                serverDirectories.baseDirectory = values.get("basedir") ?? "none";
                serverDirectories.dataDirectory = values.get("datadir") ?? "none";
                serverDirectories.tmpDirectory = values.get("tmpdir") ?? "none";
                serverDirectories.pluginDirectory = values.get("plugin_dir") ?? "none";
                const logOutput = values.get("log_output") ?? "FILE";
                serverDirectories.generalLog = values.get("general_log") !== "OFF" &&
                    logOutput !== "NONE" ? true : false;
                serverDirectories.generalLogFile = this.logTarget(serverDirectories.generalLog, logOutput,
                    values.get("general_log_file"));
                serverDirectories.errorLog = values.get("log_error") !== "OFF" ? true : false;
                serverDirectories.errorLogValue = values.get("log_error") ?? "none";

                serverDirectories.slowQueryLog = values.get("slow_query_log") !== "OFF" &&
                    logOutput !== "NONE" ? true : false;
                serverDirectories.slowQueryLogValue = this.logTarget(serverDirectories.slowQueryLog, logOutput,
                    values.get("slow_query_log_file"));

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
                serverFeatures.showSslAvailability = parseVersion(values.get("version") ?? "") < 80400;

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
                    serverFeatures, serverSsl, firewall,
                });
            }

            result = await backend.executeService("show global status");
            if (result?.rows) {
                const values = new Map<string, string>(result.rows as Array<[string, string]>);
                const ut = Number(values.get("Uptime") ?? 0);
                if (ut > 0) {
                    const uptime = new Date(ut);
                    serverStatus.runningSince = this.formatDuration(uptime.getTime());
                } else {
                    serverStatus.runningSince = "none";
                }
                serverStatus.redoLogStatus = this.valueFrom(values, "Innodb_redo_log_enabled",
                    "innodb_redo_log_enabled");
                serverSsl.sslServerNotBefore = values.get("Ssl_server_not_before") ?? "none";
                serverSsl.sslServerNotAfter = values.get("Ssl_server_not_after") ?? "none";
                this.setState({ serverStatus, serverSsl });
            }

            result = await backend.executeService("show plugins");
            if (result?.rows) {
                const values = new Map<string, string>(result.rows as Array<[string, string]>);
                serverFeatures.memCachePlugin = this.checkTriState(values.get("daemon_memcached"), "ACTIVE");
                serverFeatures.windowsAuth = this.checkTriState(values.get("authentication_windows"), "ACTIVE");
                serverFeatures.pamAuth = this.checkTriState(values.get("authentication_pam"), "ACTIVE");
                this.setState({ serverFeatures });
            }
        } catch {
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
