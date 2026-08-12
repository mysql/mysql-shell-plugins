/*
 * Copyright (c) 2023, 2026, Oracle and/or its affiliates.
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

import { ComponentChild, createRef, type JSX } from "preact";

import {
    DialogResponseClosure, IDictionary, IServicePasswordRequest, MessageType,
} from "../../app-logic/general-types.js";
import {
    IAuthenticationHints, IMySQLConnectionOptions, mysqlAuthenticationPluginChoices,
    MySQLAuthenticationPlugin, MySQLConnCompression, MySQLConnectionScheme, MySQLSslMode,
} from "../../communication/MySQL.js";
import { IBastionSummary } from "../../communication/Oci.js";
import { IMdsProfileData } from "../../communication/ProtocolMds.js";
import { ISqliteConnectionOptions } from "../../communication/Sqlite.js";
import { ConfirmDialog } from "../../components/Dialogs/ConfirmDialog.js";
import {
    CommonDialogValueOption, DialogValueType, IDialogSection, IDialogValidations, IDialogValues, ValueEditDialog,
} from "../../components/Dialogs/ValueEditDialog.js";
import { Codicon } from "../../components/ui/Codicon.js";

import { ui } from "../../app-logic/UILayer.js";
import { ComponentBase, IComponentProperties, IComponentState } from "../../components/ui/Component/ComponentBase.js";
import { Container, ContentAlignment, ContentWrap, Orientation } from "../../components/ui/Container/Container.js";
import { Grid } from "../../components/ui/Grid/Grid.js";
import { GridCell } from "../../components/ui/Grid/GridCell.js";
import { Label } from "../../components/ui/Label/Label.js";
import { ProgressIndicator } from "../../components/ui/ProgressIndicator/ProgressIndicator.js";
import { CdmEntityType } from "../../data-models/ConnectionDataModel.js";
import { requisitions } from "../../supplement/Requisitions.js";
import { ShellInterface } from "../../supplement/ShellInterface/ShellInterface.js";
import { ShellInterfaceShellSession } from "../../supplement/ShellInterface/ShellInterfaceShellSession.js";
import {
    ConnectionEditorType, DBType, IConnectionDetails, IConnectionSettings,
} from "../../supplement/ShellInterface/index.js";
import { convertErrorToString } from "../../utilities/helpers.js";
import { basename, filterInt } from "../../utilities/string-helpers.js";
import { ConnectionBadgeEditor } from "./ConnectionBadgeEditor.js";
import { ConnectionTags } from "./ConnectionTags.js";
import { DocumentContext, type DocumentContextType } from "./index.js";

const editorHeading = "Database Connection Configuration";
const globalDefaultEditor = "Default";
const mysqlSocketProtocol = "mysql (socket/pipe)";
const mysqlSshTunnelMethod = "mysql + SSH tunnel";
const mysqlBastionMethod = "mysql + OCI Bastion";
const noAuthenticationPlugin = "None";
const internalPasswordAuthenticationPlugins = new Set([
    "caching_sha2_password",
    "mysql_native_password",
    "sha256_password",
    MySQLAuthenticationPlugin.Password,
]);
// These authentication methods either have no client plugin or use client
// functionality that is built into the MySQL client library.
const authenticationPluginsWithoutSeparateClientPlugin = new Set([
    MySQLAuthenticationPlugin.Password,
    MySQLAuthenticationPlugin.AuthenticationLdapSimple,
    MySQLAuthenticationPlugin.AuthenticationPam,
    MySQLAuthenticationPlugin.AuthenticationWindows,
    MySQLAuthenticationPlugin.AuthSocket,
]);
const clearTextPasswordAuthenticationPlugins = new Set([
    MySQLAuthenticationPlugin.AuthenticationLdapSimple,
    MySQLAuthenticationPlugin.AuthenticationPam,
]);
const authenticationRequiresClearTextPassword = (factors: readonly MySQLAuthenticationPlugin[]): boolean => {
    return factors.some((plugin) => {
        return clearTextPasswordAuthenticationPlugins.has(plugin);
    });
};

const authenticationPluginInputDescription = (plugin: string): string => {
    switch (plugin as MySQLAuthenticationPlugin | typeof noAuthenticationPlugin) {
        case MySQLAuthenticationPlugin.Password:
            return "Password will be prompted";

        case MySQLAuthenticationPlugin.AuthenticationKerberos:
            return "Kerberos ticket or credentials will be required";

        case MySQLAuthenticationPlugin.AuthenticationLdapSasl:
            return "LDAP/SASL credentials will be prompted";

        case MySQLAuthenticationPlugin.AuthenticationLdapSimple:
            return "LDAP password will be prompted.\n⚠️ passwords will be sent in cleartext. " +
                "TLS encryption is required.";

        case MySQLAuthenticationPlugin.AuthenticationOci:
            return "Enter OCI config and profile below.";

        case MySQLAuthenticationPlugin.AuthenticationOpenIdConnect:
            return "OpenID Connect sign-in will be required";

        case MySQLAuthenticationPlugin.AuthenticationPam:
            return "PAM password will be prompted.\n⚠️ passwords will be sent in cleartext. " +
                "TLS encryption is required.";

        case MySQLAuthenticationPlugin.AuthenticationWebAuthn:
            return "Registered FIDO2/WebAuthn device will be required";

        case MySQLAuthenticationPlugin.AuthenticationWindows:
            return "Windows credentials will be used";

        case MySQLAuthenticationPlugin.AuthSocket:
            return "Local OS user must match the MySQL account";

        case noAuthenticationPlugin:
            return "No authentication factor configured";

        default:
            return "Plugin-specific authentication input will be required";
    }
};

interface IConnectionDiagramEndpoints {
    mysqlHost?: string;
    mysqlPort?: number;
    ssh?: string;
}

const connectionDiagramEndpoints = (values: IDialogValues): IConnectionDiagramEndpoints => {
    const mysqlDetails = values.sections.get("mysqlDetails")?.values;
    const sshDetails = values.sections.get("ssh")?.values;
    const host = mysqlDetails?.hostName;
    const port = mysqlDetails?.port;
    const ssh = sshDetails?.ssh;

    return {
        mysqlHost: host?.type === "text" ? host.value! : undefined,
        mysqlPort: port?.type === "number" ? port.value! as number : undefined,
        ssh: ssh?.type === "text" ? ssh.value! : undefined,
    };
};

const connectionMethodDiagram = (method: string, sslMode?: MySQLSslMode,
    endpoints: IConnectionDiagramEndpoints = {}): ComponentChild => {
    const mysqlProtocol = sslMode === MySQLSslMode.Preferred ? "ssl?"
        : sslMode === MySQLSslMode.Required || sslMode === MySQLSslMode.VerifyCA
            || sslMode === MySQLSslMode.VerifyIdentity ? "ssl" : "tcp";
    const defaultMySQLPort = method === String(MySQLConnectionScheme.MySQLx) ? 33060 : 3306;
    const mysqlHost = endpoints.mysqlHost?.startsWith("[") || !endpoints.mysqlHost?.includes(":")
        ? endpoints.mysqlHost
        : `[${endpoints.mysqlHost}]`;
    const mysqlEndpoint = method === mysqlSocketProtocol ? "localhost" : mysqlHost
        ? `${mysqlHost}:${endpoints.mysqlPort ?? defaultMySQLPort}`
        : undefined;
    let sshEndpoint: string | undefined;
    if (endpoints.ssh) {
        try {
            const url = new URL(endpoints.ssh.includes("://") ? endpoints.ssh : `ssh://${endpoints.ssh}`);
            const sshHost = url.hostname.startsWith("[") || !url.hostname.includes(":")
                ? url.hostname : `[${url.hostname}]`;
            sshEndpoint = `${sshHost}:${url.port || 22}`;
        } catch {
            // The SSH URI is validated before connecting.
        }
    }
    const link = (protocol: string, network = true): ComponentChild => {
        return <span className="connectionMethodLink"><span className="connectionMethodProtocol">{protocol}</span>
            <span className={"connectionMethodArrow" + (network ? " network" : "")} aria-hidden={true} />
        </span>;
    };
    const mysqlNode = <strong className="connectionMethodNode" data-endpoint={mysqlEndpoint}>MySQL</strong>;

    switch (method) {
        case String(DBType.Sqlite):
            return <><strong>Workbench</strong>{"  "}{link("local file", false)}{"  "}<strong>SQLite</strong></>;

        case mysqlSocketProtocol:
            return <><strong>Workbench</strong>{"  "}{link("socket", false)}{"  "}{mysqlNode}</>;

        case mysqlSshTunnelMethod:
            return <><strong>Workbench</strong>{"  "}{link("ssh")}{"  "}
                <strong className="connectionMethodNode" data-endpoint={sshEndpoint}>SSH Host</strong>
                {"  "}{link(mysqlProtocol)}{"  "}{mysqlNode}</>;

        case mysqlBastionMethod:
            return <><strong>Workbench</strong>{"  "}{link("ssh")}{"  "}
                <strong className="connectionMethodNode"
                    data-endpoint="assigned dynamically">Bastion</strong>
                {"  "}{link(mysqlProtocol)}{"  "}{mysqlNode}</>;

        case String(MySQLConnectionScheme.MySQLx):
            return <><strong>Workbench</strong>{"  "}{link(mysqlProtocol+"/X protocol")}{"  "}{mysqlNode}</>;

        default:
            return <><strong>Workbench</strong>{"  "}{link(mysqlProtocol)}{"  "}{mysqlNode}</>;
    }
};

interface ILiveUpdateField {
    value: string;
    loading: boolean;
}
interface IConnectionDialogLiveUpdateFields {
    bastionName: ILiveUpdateField;
    mdsDatabaseName: ILiveUpdateField;
    profileName: string;
    dbSystemId: string;
    bastionId: ILiveUpdateField;
}

export interface IConnectionEditorProperties extends IComponentProperties {
    onAddConnection: (details: IConnectionDetails) => void;
    onUpdateConnection: (details: IConnectionDetails) => void;
}

interface IConnectionEditorState extends IComponentState {
    loading: boolean;
    progressMessage: string;
}

export class ConnectionEditor extends ComponentBase<IConnectionEditorProperties, IConnectionEditorState> {
    public static override contextType = DocumentContext;

    private static readonly maxTags = 4;

    private static readonly mysqlTlsOptionKeys = [
        "ssl-mode", "tls-kex", "force-pqc", "use-pqc-sign",
    ] as const;

    private editorRef = createRef<ValueEditDialog>();
    private badgeEditorRef = createRef<ValueEditDialog>();
    private confirmClearPasswordDialogRef = createRef<ConfirmDialog>();
    private confirmNewBastionDialogRef = createRef<ConfirmDialog>();

    private knowDbTypes: string[] = [];

    private selectedTagsBeforeEdit: string[] = [];

    private liveUpdateFields: IConnectionDialogLiveUpdateFields = {
        bastionId: { value: "", loading: false },
        bastionName: { value: "", loading: false },
        mdsDatabaseName: { value: "", loading: false },
        profileName: "",
        dbSystemId: "",
    };

    private shellSession = new ShellInterfaceShellSession();
    private ociProfileNames?: IMdsProfileData[];
    private activeOciProfileName?: string;
    private connectionSettings: IConnectionSettings = {};
    private xAuthenticationMethod?: IMySQLConnectionOptions["auth-method"];
    private bundledAuthenticationPlugins = new Set<MySQLAuthenticationPlugin>();

    static #mysqlSslModeMap = new Map<MySQLSslMode, string>([
        [MySQLSslMode.Disabled, "Disable"],
        [MySQLSslMode.Preferred, "Preferred"],
        [MySQLSslMode.Required, "Require"],
        [MySQLSslMode.VerifyCA, "Require and Verify CA"],
        [MySQLSslMode.VerifyIdentity, "Require and Verify Identity"],
    ]);

    static #mysqlSslMode(value: unknown): MySQLSslMode | undefined {
        for (const [mode, label] of ConnectionEditor.#mysqlSslModeMap) {
            if (value === mode || value === label) {
                return mode;
            }
        }

        return undefined;
    }

    static #atLeastRequiredSslMode(value: unknown): MySQLSslMode {
        const mode = ConnectionEditor.#mysqlSslMode(value);

        return mode === MySQLSslMode.VerifyCA || mode === MySQLSslMode.VerifyIdentity
            ? mode
            : MySQLSslMode.Required;
    }

    public constructor(props: IConnectionEditorProperties) {
        super(props);

        this.state = {
            loading: false,
            progressMessage: "",
        };
    }

    public render(): ComponentChild {
        const { loading, progressMessage } = this.state;

        const customFooter = loading ? <>
            <Container
                id={"connectionEditorProgressContainer"}
                orientation={Orientation.LeftToRight}
                wrap={ContentWrap.NoWrap}
            >
                <ProgressIndicator
                    id="loadingProgressIndicator"
                    backgroundOpacity={0.95}
                    indicatorWidth={25}
                    indicatorHeight={25}
                    stroke={1}
                    linear={false}
                />
                <Label
                    id="progressMessageId"
                    caption={progressMessage}
                />
            </Container>
        </> : undefined;

        return (
            <>
                <ValueEditDialog
                    ref={this.editorRef}
                    id="connectionEditor"
                    className="connectionEditorDialog"
                    onValidate={this.validateConnectionValues}
                    onClose={this.handleOptionsDialogClose}
                    onSelectTab={this.handleTabSelect}
                    advancedActionCaption="Test Connection"
                    advancedAction={(values) => {
                        void this.testConnection(values);
                    }}
                    customFooter={customFooter}
                />
                <ValueEditDialog
                    ref={this.badgeEditorRef}
                    id="connectionBadgeEditor"
                    onValidate={this.validateBadgeEditorValues}
                    onClose={this.handleBadgeEditorClose}
                />
                <ConfirmDialog
                    ref={this.confirmClearPasswordDialogRef}
                    id="confirmClearPasswordDlg"
                />
                <ConfirmDialog
                    ref={this.confirmNewBastionDialogRef}
                    id="confirmNewBastionDialog"
                    onClose={this.handleCreateNewBastion}
                />
            </>
        );
    }

    /**
     * Brings up the connection editor with the values passed in here.
     *
     * @param dbTypeName The name of the database type to use.
     * @param newConnection A flag indicating if a new connection is to be created.
     * @param currentPath The current path for the connection. Only used when details are undefined.
     * @param details Optional connection details for existing connections.
     */
    public async show(dbTypeName: string, newConnection: boolean, currentPath: string,
        details?: IConnectionDetails): Promise<void> {
        if (this.knowDbTypes.length === 0) {
            this.knowDbTypes = await ShellInterface.core.getDbTypes();
        }
        this.bundledAuthenticationPlugins = new Set(
            await ShellInterface.core.getBundledAuthenticationPlugins() as MySQLAuthenticationPlugin[],
        );
        await ConnectionTags.load();

        this.liveUpdateFields.bastionName.value = "";
        this.liveUpdateFields.mdsDatabaseName.value = "";
        this.liveUpdateFields.profileName = "";
        this.liveUpdateFields.bastionId.value = "";
        this.liveUpdateFields.dbSystemId = "";

        // Initializes useMDS/useSSH to have the tabs be shown or hidden based on the saved connection options.
        const usesSocket = details?.dbType === DBType.MySQL &&
            (details.options as IMySQLConnectionOptions).socket !== undefined;
        if (details?.dbType === DBType.MySQL) {
            const optionsMySQL = details.options as IMySQLConnectionOptions;
            details.useSSH = !usesSocket && optionsMySQL.ssh !== undefined;
            details.useMHS = !usesSocket && !details.useSSH && optionsMySQL["mysql-db-system-id"] !== undefined;
        }

        if (this.editorRef.current) {
            const bastionId = (details && "bastion-id" in details.options)
                ? details.options["bastion-id"] as string : undefined;
            const profileName = (details && "profile-name" in details.options)
                ? details.options["profile-name"] as string : undefined;
            const mysqlDbSystemId = (details && "mysql-db-system-id" in details.options)
                ? details.options["mysql-db-system-id"] as string : undefined;

            if (!usesSocket && bastionId && profileName && mysqlDbSystemId) {
                // We have bastion id and mds database id.
                this.liveUpdateFields.profileName = profileName;
                this.liveUpdateFields.bastionId.value = bastionId;
                this.liveUpdateFields.dbSystemId = mysqlDbSystemId;
                this.loadMdsAdditionalDataAndShowConnectionDlg(dbTypeName, newConnection, currentPath, details);
            } else if (!usesSocket && details && !bastionId && profileName && mysqlDbSystemId) {
                let compartmentId = "";
                if ("compartment-id" in details.options) {
                    compartmentId = details.options["compartment-id"] as string;
                    delete details.options["compartment-id"];
                }

                // We have only profileName and mds database id, but no bastion id.
                this.liveUpdateFields.profileName = profileName;
                this.liveUpdateFields.dbSystemId = mysqlDbSystemId;

                // Get all available bastions that are in the same compartment as the DbSystem but ensure that
                // these bastions are valid for the specific DbSystem by having a matching target_subnet_id
                const bastions = await this.shellSession.mhs.getMdsBastions(profileName, compartmentId,
                    mysqlDbSystemId);
                if (bastions.length > 0) {
                    // If there is a bastion in the same compartment
                    (details.options as IMySQLConnectionOptions)["bastion-id"] = bastions[0].id;
                    this.liveUpdateFields.bastionId.value =
                        (details.options as IMySQLConnectionOptions)["bastion-id"]!;
                    this.loadMdsAdditionalDataAndShowConnectionDlg(dbTypeName, newConnection, currentPath, details);
                } else {
                    this.confirmBastionCreation(currentPath, details);
                }
            } else {
                // A connection dialog without MySQL DB system id.
                // Activate the SSH/MDS contexts as needed.
                const contexts: string[] = [dbTypeName];
                if (details?.useSSH) {
                    contexts.push("useSSH");
                }

                if (details?.useMHS) {
                    contexts.push("useMDS");
                }

                this.editorRef.current.show(
                    this.generateEditorConfig(currentPath, details),
                    {
                        contexts,
                        title: editorHeading,
                    },
                    {
                        createNew: newConnection,
                        currentPath,
                        details,
                    });
            }
        }
    }

    protected validateConnectionValues = (closing: boolean, values: IDialogValues,
        data?: IDictionary): Promise<IDialogValidations> => {

        const result: IDialogValidations = {
            requiredContexts: [],
            messages: {},
        };

        const connectionMethodSection = values.sections.get("connectionMethod")!.values;
        const informationSection = values.sections.get("information")!.values;
        const sqliteDetailsSection = values.sections.get("sqliteDetails")!.values;

        const mysqlDetailsSection = values.sections.get("mysqlDetails")!.values;
        const mysqlAdvancedSection = values.sections.get("mysqlAdvanced")!.values;
        const authenticationSection = values.sections.get("authentication")?.values;

        const isSqlite = connectionMethodSection.connectionMethod.value === DBType.Sqlite;
        const isMySQL = !isSqlite;

        const tags = Object.hasOwn(informationSection, "tags") ? informationSection.tags.value as string[] : [];
        if (tags.length > ConnectionEditor.maxTags) {
            result.messages.tags = `Select at most ${ConnectionEditor.maxTags} tags`;
        }

        if (!informationSection.caption.value) {
            if (closing) {
                result.messages.caption = "The caption cannot be empty";
            }
        } else {
            // Check duplicate captions.
            const context = this.context as DocumentContextType;
            const roots = context.connectionsDataModel.roots;
            const entry = roots.find((element) => {
                if (element.type === CdmEntityType.Connection) {
                    return element.details.caption === informationSection.caption.value;
                }

                return undefined;
            });

            // The caption can be the same if it is the one from the connection that is currently being edited.
            if (entry?.type === CdmEntityType.Connection
                && (String(entry.details.id) !== values.id || data?.createNew)) {
                result.messages.caption = "A connection with that caption exists already";
            }
        }

        if (isSqlite) {
            if (closing && !sqliteDetailsSection.dbFilePath.value) {
                result.messages.dbFilePath = "Specify the path to an existing Sqlite DB file";
            } else if (sqliteDetailsSection.dbFilePath.value) {
                // See if we have a valid file name.
                const fileName = sqliteDetailsSection.dbFilePath.value as string;
                try {
                    new URL("file:///" + fileName); // Can throw.
                } catch {
                    result.messages.dbFilePath = "Invalid file path";
                }
            }
        } else if (isMySQL) {
            Object.assign(result.messages, this.validateTlsOptions(values));

            const isSocketConnection = connectionMethodSection.connectionMethod.value === mysqlSocketProtocol;
            if (closing) {
                const host = mysqlDetailsSection.hostName.value as string;
                if (!isSocketConnection && (!host || host.length === 0)) {
                    result.messages.hostName = "Specify a valid host name or IP address";
                }

                const user = mysqlDetailsSection.userName.value as string;
                if (!user || user.length === 0) {
                    result.messages.userName = "The user name must not be empty";
                }
            }

            if (typeof mysqlDetailsSection.port.value === "number") {
                const port = this.checkValidInt(mysqlDetailsSection.port.value);
                if (port === undefined || isNaN(port) || port < 0) {
                    result.messages.timeout = "The port must be a valid integer >= 0";
                }
            }

            if (mysqlAdvancedSection.timeout.value !== undefined &&
                typeof mysqlAdvancedSection.timeout.value === "number") {
                const timeout = this.checkValidInt(mysqlAdvancedSection.timeout.value);
                if (timeout === undefined || isNaN(timeout) || timeout < 0) {
                    result.messages.timeout = "The timeout must be a valid integer >= 0";
                }
            }

            if (authenticationSection && closing) {
                const authenticationHints = this.getAuthenticationHints(values);
                if (authenticationHints.factors.includes(MySQLAuthenticationPlugin.AuthenticationOci)) {
                    const authenticationValues = values.sections.get("authentication")!.values;
                    if (!authenticationValues.ociConfigFile.value) {
                        result.messages.ociConfigFile = "Specify the OCI config file used for authentication";
                    }
                    if (!authenticationValues.ociConfigProfile.value) {
                        result.messages.ociConfigProfile = "Specify the OCI config profile used for authentication";
                    }
                }
            }
        }

        return Promise.resolve(result);
    };

    private pqcBooleanValue(value: unknown): boolean | string | undefined {
        if (value === undefined) {
            return undefined;
        }

        if (typeof value === "boolean") {
            return value;
        }

        const text = String(value);
        switch (text.toLowerCase()) {
            case "true":
            case "1":
                return true;

            case "false":
            case "0":
                return false;

            default:
                return text;
        }
    }

    private mysqlTlsOptions(values: IDialogValues): Pick<IMySQLConnectionOptions,
        typeof ConnectionEditor.mysqlTlsOptionKeys[number]> {
        const ssl = values.sections.get("ssl")!.values;
        const selectedMode = ConnectionEditor.#mysqlSslMode(ssl.sslMode.value);
        const mode = selectedMode !== undefined
            && authenticationRequiresClearTextPassword(this.getAuthenticationHints(values).factors)
            ? ConnectionEditor.#atLeastRequiredSslMode(selectedMode)
            : selectedMode;
        if (mode === MySQLSslMode.Disabled) {
            return {
                "ssl-mode": mode,
                "tls-kex": undefined,
                "force-pqc": undefined,
                "use-pqc-sign": undefined,
            };
        }

        const forcePqc = this.pqcBooleanValue(ssl.forcePqc.value);
        const usePqcSign = this.pqcBooleanValue(ssl.usePqcSign.value);

        return {
            "ssl-mode": mode,
            "tls-kex": ssl.tlsKex.value as string || undefined,
            "force-pqc": typeof forcePqc === "boolean" ? forcePqc : undefined,
            "use-pqc-sign": typeof usePqcSign === "boolean" ? usePqcSign : undefined,
        };
    }

    private handleTlsOptionsChange = (_value: string | boolean, dialog: ValueEditDialog): void => {
        const values = dialog.getDialogValues();
        const ssl = values.sections.get("ssl")!.values;
        const connectionMethod = values.sections.get("connectionMethod")?.values.connectionMethod;
        const options = this.mysqlTlsOptions(values);
        if (options["ssl-mode"] !== undefined) {
            ssl.sslMode.value = ConnectionEditor.#mysqlSslModeMap.get(options["ssl-mode"]);
        }
        if (connectionMethod?.type === "choice") {
            connectionMethod.trailingDescription = connectionMethodDiagram(
                connectionMethod.value!, options["ssl-mode"], connectionDiagramEndpoints(values),
            );
        }

        for (const key of ["tlsKex", "forcePqc", "usePqcSign"]) {
            const field = ssl[key];
            field.options = field.options?.filter((option) => {
                return option !== CommonDialogValueOption.Disabled;
            }) ?? [];

            if (options["ssl-mode"] === MySQLSslMode.Disabled) {
                field.options.push(CommonDialogValueOption.Disabled);
            }
        }

        const showWarning = options["force-pqc"] === true && options["ssl-mode"] === MySQLSslMode.Preferred;
        ssl.forcePqcWarning.options = [CommonDialogValueOption.Grouped];

        if (!showWarning) {
            ssl.forcePqcWarning.options.push(CommonDialogValueOption.Hidden);
        }

        dialog.setDialogValues(values);
    };

    private updateConnectionMethodDiagram = (_value: string | number | bigint, dialog: ValueEditDialog): void => {
        const values = dialog.getDialogValues();
        const connectionMethod = values.sections.get("connectionMethod")?.values.connectionMethod;
        const sslMode = values.sections.get("ssl")?.values.sslMode;
        if (connectionMethod?.type === "choice") {
            connectionMethod.trailingDescription = connectionMethodDiagram(connectionMethod.value!,
                ConnectionEditor.#mysqlSslMode(sslMode?.value), connectionDiagramEndpoints(values));
            dialog.setDialogValues(values);
        }
    };

    private validateTlsOptions(values: IDialogValues): Record<string, string> {
        const ssl = values.sections.get("ssl")!.values;
        const messages: Record<string, string> = {};
        const options = this.mysqlTlsOptions(values);

        if (options["ssl-mode"] === undefined) {
            messages.sslMode = "Select a valid SSL mode.";
        }

        if (options["ssl-mode"] !== MySQLSslMode.Disabled) {
            const forcePqc = this.pqcBooleanValue(ssl.forcePqc.value);
            const usePqcSign = this.pqcBooleanValue(ssl.usePqcSign.value);

            if (typeof forcePqc === "string") {
                messages.forcePqc = "Enter true, false, 1 or 0.";
            }

            if (typeof usePqcSign === "string") {
                messages.usePqcSign = "Enter true, false, 1 or 0.";
            }
        }

        const extra = values.sections.get("mysqlAdvanced")!.values.extraOptions.value;
        if (extra && typeof extra === "object") {
            const duplicates = Object.keys(extra).filter((key) => {
                return ConnectionEditor.mysqlTlsOptionKeys.some((option) => {
                    return option === key.toLowerCase();
                });
            });

            if (duplicates.length > 0) {
                messages.extraOptions = `Configure ${duplicates.join(", ")} in the TLS tab instead.`;
            }
        }

        return messages;
    }

    private getAuthenticationHints = (values: IDialogValues): IAuthenticationHints => {
        if (this.isMySQLXConnection(values)) {
            return { factors: [MySQLAuthenticationPlugin.Password] };
        }

        const authenticationValues = values.sections.get("authentication")?.values;
        const factors = ["factor1", "factor2", "factor3"].reduce<MySQLAuthenticationPlugin[]>((result, key) => {
            const plugin = authenticationValues?.[key]?.value;
            if (typeof plugin === "string" && plugin !== noAuthenticationPlugin) {
                result.push(plugin as MySQLAuthenticationPlugin);
            }

            return result;
        }, []);

        return {
            factors,
            pluginDir: authenticationValues?.pluginDir.value as string | undefined,
        };
    };

    private getAuthenticationConnectionOptions = (values: IDialogValues): Partial<IMySQLConnectionOptions> => {
        const authenticationValues = this.isMySQLXConnection(values)
            ? undefined
            : values.sections.get("authentication")?.values;
        const authenticationFactors = this.getAuthenticationHints(values).factors;
        const usesWebAuthn = authenticationFactors.includes(
            MySQLAuthenticationPlugin.AuthenticationWebAuthn,
        );

        return {
            "auth-method": this.isMySQLXConnection(values) ? this.xAuthenticationMethod
                : authenticationRequiresClearTextPassword(authenticationFactors)
                    ? "mysql_clear_password" : undefined,
            "plugin-authentication-kerberos-client-mode": authenticationValues?.kerberosClientMode.value as
                "SSPI" | "GSSAPI" | undefined,
            ...(usesWebAuthn ? {
                "plugin-authentication-webauthn-device": authenticationValues?.webauthnDevice.value as number,
                "plugin-authentication-webauthn-client-preserve-privacy":
                    authenticationValues?.webauthnPreservePrivacy.value as boolean,
            } : {}),
            "oci-config-file": authenticationValues?.ociConfigFile.value as string | undefined,
            "authentication-oci-client-config-profile": authenticationValues?.ociConfigProfile.value as
                string | undefined,
            "authentication-openid-connect-client-id-token-file": authenticationValues?.openidConnectClientIdTokenFile
                .value as string | undefined,
        };
    };

    private isMySQLXConnection = (values: IDialogValues): boolean => {
        return values.sections.get("connectionMethod")?.values.connectionMethod.value === MySQLConnectionScheme.MySQLx;
    };

    private handleOptionsDialogClose = (closure: DialogResponseClosure, values: IDialogValues,
        data?: IDictionary): void => {
        if (closure === DialogResponseClosure.Accept) {
            const connectionMethodSection = values.sections.get("connectionMethod")!.values;
            const informationSection = values.sections.get("information")!.values;
            const sqliteDetailsSection = values.sections.get("sqliteDetails")!.values;
            const sqliteAdvancedSection = values.sections.get("sqliteAdvanced")!.values;
            const mysqlDetailsSection = values.sections.get("mysqlDetails")!.values;
            const mdsBastionSection = values.sections.get("mdsBastion")!.values;
            const mysqlSshSection = values.sections.get("ssh")!.values;
            const mysqlAdvancedSection = values.sections.get("mysqlAdvanced")!.values;
            const mysqlSslSection = values.sections.get("ssl")!.values;
            const authenticationHints = this.getAuthenticationHints(values);
            const currentPath = data?.currentPath as string | undefined ?? "";

            const isSqlite = connectionMethodSection.connectionMethod.value === DBType.Sqlite;
            const isMySQL = !isSqlite;
            if (isMySQL && Object.keys(this.validateTlsOptions(values)).length > 0) {
                return;
            }

            const mysqlConnectionMethod = connectionMethodSection.connectionMethod.value as string;
            const isSocketConnection = isMySQL && mysqlConnectionMethod === mysqlSocketProtocol;
            const useSSH = isMySQL && mysqlConnectionMethod === mysqlSshTunnelMethod;
            const useMHS = isMySQL && mysqlConnectionMethod === mysqlBastionMethod;

            let details: IConnectionDetails | undefined = data?.details as IConnectionDetails | undefined;
            const dbType = isSqlite ? DBType.Sqlite : DBType.MySQL;
            const authenticationConnectionOptions = this.getAuthenticationConnectionOptions(values);

            if (data?.createNew) {
                details = {
                    id: 0, // Will be replaced with the ID returned from the BE call.
                    dbType,
                    caption: informationSection.caption.value as string,
                    description: informationSection.description.value as string,
                    useSSH: false,
                    useMHS: false,
                    options: {},
                    folderPath: details?.folderPath ?? currentPath,
                    index: -1,
                };

                if (isSqlite) {
                    details.options = {
                        dbFile: "",
                        otherParameters: sqliteAdvancedSection.otherParameters.value as string,
                    } as ISqliteConnectionOptions;
                } else if (isMySQL) {
                    details.options = {
                        scheme: MySQLConnectionScheme.MySQL,
                        host: "localhost",
                    } as IMySQLConnectionOptions;
                }
            }

            if (details) {
                const existingMySQLConnection = details.dbType === DBType.MySQL;
                details.dbType = dbType;
                details.useMHS = useMHS;
                details.useSSH = useSSH;
                details.caption = informationSection.caption.value as string;
                details.description = informationSection.description.value as string;

                if (isSqlite) {
                    details.options = {
                        dbFile: sqliteDetailsSection.dbFilePath.value as string,

                        // Not "as string", to allow undefined too.
                        otherParameters: sqliteAdvancedSection.otherParameters.value,
                    } as ISqliteConnectionOptions;
                } else if (isMySQL) {
                    let sshKeyFile;
                    if (details.useSSH && mysqlSshSection.sshKeyFile.value !== "") {
                        sshKeyFile = mysqlSshSection.sshKeyFile.value;
                    }

                    if (details.useMHS && mdsBastionSection.sshKeyFile.value !== "") {
                        sshKeyFile = mdsBastionSection.sshKeyFile.value;
                    }

                    let sshKeyFilePublic;
                    if (details.useMHS && mdsBastionSection.sshPublicKeyFile.value !== "") {
                        sshKeyFilePublic = mdsBastionSection.sshPublicKeyFile.value;
                    }

                    const compressionAlgorithms = Array.isArray(mysqlAdvancedSection.compressionAlgorithms.value)
                        ? mysqlAdvancedSection.compressionAlgorithms.value.join(",")
                        : undefined;
                    const existingOptions = existingMySQLConnection
                        ? { ...details.options } as IMySQLConnectionOptions & Record<string, unknown>
                        : {} as IMySQLConnectionOptions & Record<string, unknown>;
                    delete existingOptions["auth-method"];
                    delete existingOptions["plugin-authentication-webauthn-device"];
                    delete existingOptions["plugin-authentication-webauthn-client-preserve-privacy"];
                    details.options = {
                        ...existingOptions,
                        "scheme": isSocketConnection || useSSH || useMHS ? MySQLConnectionScheme.MySQL
                            : mysqlConnectionMethod as MySQLConnectionScheme,
                        "host": mysqlDetailsSection.hostName.value as string,
                        "port": isSocketConnection ? undefined : mysqlDetailsSection.port.value as number,
                        "socket": isSocketConnection ? mysqlDetailsSection.port.value as string || undefined
                            : undefined,
                        "user": mysqlDetailsSection.userName.value as string,
                        "schema": mysqlDetailsSection.defaultSchema.value as string,

                        ...this.mysqlTlsOptions(values),
                        "ssl-ca": mysqlSslSection.sslCaFile.value as string,
                        "ssl-cert": mysqlSslSection.sslCertFile.value as string,
                        "ssl-key": mysqlSslSection.sslKeyFile.value as string,
                        "ssl-cipher": mysqlSslSection.sslCipher.value as string,
                        "compression": (mysqlAdvancedSection.compression.value !== "")
                            ? mysqlAdvancedSection.compression.value as MySQLConnCompression : undefined,
                        "compression-algorithms": compressionAlgorithms,
                        "compression-level": mysqlAdvancedSection.compressionLevel.value as number,

                        ...authenticationConnectionOptions,
                        "connect-timeout": mysqlAdvancedSection.timeout.value ?? 0,
                        "sql-mode": mysqlAdvancedSection.sqlMode.value
                            ? [mysqlAdvancedSection.sqlMode.value as string] : undefined,
                        "ssh": details.useSSH ? mysqlSshSection.ssh.value as string : undefined,

                        //"ssh-password": details.useSSH ? mysqlSshSection.sshPassword.value : undefined,
                        "ssh-identity-file": sshKeyFile as string,
                        "ssh-config-file": details.useSSH
                            ? mysqlSshSection.sshConfigFilePath.value as string
                            : undefined,
                        "ssh-public-identity-file": sshKeyFilePublic as string,
                        "profile-name": details.useMHS ? mdsBastionSection.profileName.value as string : undefined,
                        "bastion-id": details.useMHS ? mdsBastionSection.bastionId.value as string : undefined,
                        "mysql-db-system-id": details.useMHS
                            ? mdsBastionSection.mysqlDbSystemId.value as string : undefined,
                        "extra-options": mysqlAdvancedSection.extraOptions.value as Record<string, string>,
                        /* eslint-enabled @typescript-eslint/naming-convention */
                    };

                }

                const tags = informationSection.tags.value as string[];
                const settings = { ...details.settings };
                delete settings.badge;
                if (this.isMySQLXConnection(values)) {
                    delete settings.authenticationHints;
                } else {
                    settings.authenticationHints = authenticationHints;
                }
                details.tags = tags;
                const defaultEditor = (isSqlite ? sqliteAdvancedSection : mysqlAdvancedSection).defaultEditor.value;
                if (defaultEditor === globalDefaultEditor) {
                    delete settings.defaultEditor;
                    details.settings = settings;
                } else {
                    details.settings = {
                        ...settings,
                        defaultEditor: defaultEditor as ConnectionEditorType,
                    };
                }

                if (data?.createNew) {
                    const { onAddConnection } = this.props;
                    onAddConnection(details);
                } else {
                    const { onUpdateConnection } = this.props;
                    onUpdateConnection(details);
                }
            }
        }
    };

    private testConnection = async (values: IDialogValues, registerFactor?: 2 | 3): Promise<void> => {
        const connectionMethodSection = values.sections.get("connectionMethod")!.values;
        const informationSection = values.sections.get("information")!.values;
        const sqliteDetailsSection = values.sections.get("sqliteDetails")!.values;
        const sqliteAdvancedSection = values.sections.get("sqliteAdvanced")!.values;
        const mysqlDetailsSection = values.sections.get("mysqlDetails")!.values;
        const mdsBastionSection = values.sections.get("mdsBastion")!.values;
        const mysqlSshSection = values.sections.get("ssh")!.values;
        const mysqlAdvancedSection = values.sections.get("mysqlAdvanced")!.values;
        const mysqlSslSection = values.sections.get("ssl")!.values;
        const dbType = connectionMethodSection.connectionMethod.value === DBType.Sqlite
            ? DBType.Sqlite : DBType.MySQL;
        const mysqlConnectionMethod = connectionMethodSection.connectionMethod.value as string;
        const isSocketConnection = mysqlConnectionMethod === mysqlSocketProtocol;
        const useSSH = mysqlConnectionMethod === mysqlSshTunnelMethod;
        const useMHS = mysqlConnectionMethod === mysqlBastionMethod;

        if (dbType === DBType.MySQL) {
            const tlsErrors = this.validateTlsOptions(values);
            if (Object.keys(tlsErrors).length > 0) {
                void ui.showErrorMessage(Object.values(tlsErrors).join("\n"), {});

                return;
            }

            const user = mysqlDetailsSection.userName.value as string;
            const host = mysqlDetailsSection.hostName.value as string;
            if (!user || (!isSocketConnection && !host)) {
                void ui.showErrorMessage("User and connection endpoint are required.", {});

                return;
            }

            if (useSSH && !mysqlSshSection.ssh.value) {
                void ui.showErrorMessage("SSH URI is required.", {});

                return;
            }
        }

        let options: IMySQLConnectionOptions | ISqliteConnectionOptions;
        let authenticationHintsForSettings: IAuthenticationHints | undefined;
        if (dbType === DBType.Sqlite) {
            options = {
                dbFile: sqliteDetailsSection.dbFilePath.value as string,
                dbName: "",
                otherParameters: sqliteAdvancedSection.otherParameters.value,
            } as ISqliteConnectionOptions;
        } else {
            const authenticationHints = this.getAuthenticationHints(values);
            const sshKeyFile = useMHS
                ? mdsBastionSection.sshKeyFile.value
                : (useSSH ? mysqlSshSection.sshKeyFile.value : undefined);
            const compressionAlgorithms = Array.isArray(mysqlAdvancedSection.compressionAlgorithms.value)
                ? mysqlAdvancedSection.compressionAlgorithms.value.join(",")
                : undefined;
            authenticationHintsForSettings = this.isMySQLXConnection(values) ? undefined : authenticationHints;
            const authenticationConnectionOptions = this.getAuthenticationConnectionOptions(values);
            options = {
                scheme: isSocketConnection || useSSH || useMHS ? MySQLConnectionScheme.MySQL
                    : mysqlConnectionMethod as MySQLConnectionScheme,
                host: mysqlDetailsSection.hostName.value as string,
                port: isSocketConnection ? undefined : mysqlDetailsSection.port.value as number,
                socket: isSocketConnection ? mysqlDetailsSection.port.value as string || undefined : undefined,
                user: mysqlDetailsSection.userName.value as string,
                schema: mysqlDetailsSection.defaultSchema.value as string,
                ...this.mysqlTlsOptions(values),
                "ssl-ca": mysqlSslSection.sslCaFile.value as string,
                "ssl-cert": mysqlSslSection.sslCertFile.value as string,
                "ssl-key": mysqlSslSection.sslKeyFile.value as string,
                "ssl-cipher": mysqlSslSection.sslCipher.value as string,
                compression: mysqlAdvancedSection.compression.value !== ""
                    ? mysqlAdvancedSection.compression.value as MySQLConnCompression : undefined,
                "compression-algorithms": compressionAlgorithms,
                "compression-level": mysqlAdvancedSection.compressionLevel.value as number,
                ...authenticationConnectionOptions,
                "register-factor": registerFactor === undefined ? undefined : String(registerFactor) as "2" | "3",
                "connect-timeout": mysqlAdvancedSection.timeout.value as number,
                ssh: useSSH ? mysqlSshSection.ssh.value as string : undefined,
                "ssh-identity-file": sshKeyFile as string,
                "ssh-config-file": useSSH ? mysqlSshSection.sshConfigFilePath.value as string : undefined,
                "ssh-public-identity-file": useMHS
                    ? mdsBastionSection.sshPublicKeyFile.value as string : undefined,
                "profile-name": useMHS ? mdsBastionSection.profileName.value as string : undefined,
                "bastion-id": useMHS ? mdsBastionSection.bastionId.value as string : undefined,
                "mysql-db-system-id": useMHS ? mdsBastionSection.mysqlDbSystemId.value as string : undefined,
                "extra-options": mysqlAdvancedSection.extraOptions.value as Record<string, string>,
            };
        }

        const details: IConnectionDetails = {
            id: 0,
            dbType,
            caption: informationSection.caption.value as string,
            description: informationSection.description.value as string,
            useSSH,
            useMHS,
            options,
            settings: authenticationHintsForSettings
                ? { authenticationHints: authenticationHintsForSettings } : undefined,
            index: -1,
        };

        if (dbType === DBType.Sqlite) {
            try {
                await ShellInterface.dbConnections.testConnection(details);
                void ui.showInformationMessage("Connection test succeeded.", {});
            } catch (reason) {
                void ui.showErrorMessage(`Connection Error: ${convertErrorToString(reason)}`, {});
            }

            return;
        }

        try {
            await ShellInterface.dbConnections.testConnection(details);
            void ui.showInformationMessage(registerFactor === undefined
                ? "Connection test succeeded."
                : `WebAuthn factor ${registerFactor} registration succeeded.`, {});
        } catch (reason) {
            const operation = registerFactor === undefined ? "Connection" : "WebAuthn factor registration";
            void ui.showErrorMessage(`${operation} Error: ${convertErrorToString(reason)}`, {});
        }
    };

    private registerWebAuthnFactor = (values: IDialogValues): void => {
        const webauthnFactor = this.getAuthenticationHints(values).factors.indexOf(
            MySQLAuthenticationPlugin.AuthenticationWebAuthn,
        );
        if (webauthnFactor < 0) {
            return;
        }

        // Passwordless WebAuthn accounts use the initial password as factor 1 while registering the device.
        const registerFactor = webauthnFactor === 0 ? 2 : (webauthnFactor + 1) as 2 | 3;
        void this.testConnection(values, registerFactor);
    };

    /**
     * Generates the object to be used for the value editor.
     *
     * @param currentPath Specifies the current path for the connection. Only used when details are undefined.
     * @param details The properties of an existing connection or undefined for a new one.
     *
     * @returns The necessary dialog values to edit this connection.
     */
    private generateEditorConfig = (currentPath: string, details?: IConnectionDetails): IDialogValues => {
        const context = this.context as DocumentContextType;
        const connections = context.connectionsDataModel.roots;

        let caption = `New Connection`;

        let index = 1;
        while (index < 1000) {
            const candidate = `New Connection ${index}`;
            if (connections.findIndex((element) => {
                return element.type === CdmEntityType.Connection && element.details.caption === candidate;
            }) === -1) {
                caption = candidate;

                break;
            }

            index++;
        }

        const description = "A new Database Connection";

        let defaultEditor = globalDefaultEditor;
        if (details?.settings?.defaultEditor) {
            defaultEditor = details.settings.defaultEditor;
        }

        const badges = this.connectionBadges;
        const badgeNames = Object.keys(badges);
        const selectedTags = (details?.tags ?? (details?.settings?.badge ? [details.settings.badge] : []))
            .filter((tag) => {
                return badgeNames.includes(tag);
            });

        details = details ?? { // Default for new connections is MySQL.
            id: -1,
            dbType: DBType.MySQL,
            caption,
            description,
            useSSH: false,
            useMHS: false,
            options: {
                host: "localhost",
                port: 3306,
                scheme: MySQLConnectionScheme.MySQL,
            },
            settings: {},
            folderPath: currentPath,
            index: -1,
        };
        this.connectionSettings = { ...details.settings };

        // In the dialog config we have to provide values for each DB type, because the user can switch the type.
        // However the specific option object for the not-used DB type is initialized to default values only.
        const isSqlite = details.dbType === DBType.Sqlite;
        const isMySQL = details.dbType === DBType.MySQL;

        let optionsMySQL: IMySQLConnectionOptions;
        let optionsSqlite: ISqliteConnectionOptions;
        if (isSqlite) {
            optionsSqlite = details.options as ISqliteConnectionOptions;
            if (!optionsSqlite.dbName || optionsSqlite.dbName.trim() === "") {
                if (optionsSqlite.dbFile.endsWith(".sqlite3")) {
                    optionsSqlite.dbName = basename(optionsSqlite.dbFile, ".sqlite3");
                } else {
                    optionsSqlite.dbName = basename(optionsSqlite.dbFile, ".sqlite");
                }
            }

            optionsMySQL = {
                scheme: MySQLConnectionScheme.MySQL,
                host: "localhost",
            };
        } else if (isMySQL) {
            optionsSqlite = {
                dbFile: "",
                dbName: "",
            };
            optionsMySQL = details.options as IMySQLConnectionOptions;
            details.useMHS = optionsMySQL["mysql-db-system-id"] !== undefined;
            details.useSSH = optionsMySQL.ssh !== undefined;
        } else {
            optionsSqlite = {
                dbFile: "",
                dbName: "",
            };
            optionsMySQL = {
                scheme: MySQLConnectionScheme.MySQL,
                host: "localhost",
            };
        }

        this.xAuthenticationMethod = optionsMySQL.scheme === MySQLConnectionScheme.MySQLx
            ? optionsMySQL["auth-method"] : undefined;
        const selectedMySQLMethod = optionsMySQL.socket !== undefined
            ? mysqlSocketProtocol
            : details.useSSH ? mysqlSshTunnelMethod
                : details.useMHS ? mysqlBastionMethod
                    : optionsMySQL.scheme;
        const usesMySQLSocket = selectedMySQLMethod === mysqlSocketProtocol;
        const mysqlEndpointValue = usesMySQLSocket ? {
            type: "text" as const,
            caption: "Socket Path",
            value: optionsMySQL.socket,
            placeholder: "Default",
            horizontalSpan: 5,
            onFocusLost: this.updateConnectionMethodDiagram,
        } : {
            type: "number" as const,
            caption: "Port",
            value: optionsMySQL.port ?? (optionsMySQL.scheme === MySQLConnectionScheme.MySQLx ? 33060 : 3306),
            horizontalSpan: 1,
            onFocusLost: this.updateConnectionMethodDiagram,
        };

        const informationSection: IDialogSection = {
            values: {
                caption: {
                    type: "text",
                    caption: "Caption",
                    value: details.caption,
                    placeholder: "<enter a unique caption>",
                    options: [CommonDialogValueOption.AutoFocus],
                    description: "Short label for this database connection",
                    horizontalSpan: 2,
                },
                description: {
                    type: "text",
                    caption: "Description",
                    value: details.description,
                    placeholder: "<describe the connection>",
                    description: "More detailed description of the connection",
                    horizontalSpan: 3,
                },
                tags: {
                    type: "set",
                    caption: "Tags",
                    value: selectedTags,
                    tagSet: badgeNames,
                    tagStyles: this.connectionBadgeTagStyles(badges),
                    horizontalSpan: 4,
                    description: `Select up to ${ConnectionEditor.maxTags} tags to display with the connection.`,
                    onChange: this.handleTagsChange,
                    captionAction: {
                        icon: Codicon.Edit,
                        tooltip: "Edit tags",
                        onClick: this.openBadgeEditor,
                    },
                },
            },
        };

        const connectionMethodSection: IDialogSection = {
            values: {
                connectionMethod: {
                    type: "choice",
                    caption: "Connection Method",
                    value: isSqlite ? DBType.Sqlite : selectedMySQLMethod,
                    trailingDescription: connectionMethodDiagram(isSqlite ? DBType.Sqlite : selectedMySQLMethod,
                        optionsMySQL["ssl-mode"] ?? MySQLSslMode.Preferred, {
                            mysqlHost: optionsMySQL.host,
                            mysqlPort: optionsMySQL.port,
                            ssh: optionsMySQL.ssh,
                        }),
                    trailingDescriptionClassName: "connectionMethodDiagram",
                    choices: [
                        MySQLConnectionScheme.MySQL,
                        mysqlSocketProtocol,
                        mysqlSshTunnelMethod,
                        mysqlBastionMethod,
                        MySQLConnectionScheme.MySQLx,
                        DBType.Sqlite,
                    ],
                    onChange: (method: DialogValueType, dialog: ValueEditDialog): void => {
                        const values = dialog.getDialogValues();
                        const mysqlMethod = values.sections.get("mysqlDetails")?.values.scheme;
                        const connectionMethod = values.sections.get("connectionMethod")?.values.connectionMethod;
                        if (mysqlMethod?.type !== "choice" || connectionMethod?.type !== "choice") {
                            return;
                        }

                        if (method === DBType.Sqlite) {
                            connectionMethod.trailingDescription = connectionMethodDiagram(method as string);
                            dialog.updateActiveContexts({
                                add: [DBType.Sqlite],
                                remove: [DBType.MySQL, "useSSH", "useMDS"],
                            });
                            dialog.setDialogValues(values);

                            return;
                        }

                        const mysqlMethodValue = method as string;
                        mysqlMethod.value = mysqlMethodValue;
                        dialog.updateActiveContexts({
                            add: [DBType.MySQL],
                            remove: [DBType.Sqlite],
                        });
                        mysqlMethod.onChange?.(mysqlMethodValue, dialog);
                        const sslMode = values.sections.get("ssl")?.values.sslMode;
                        connectionMethod.trailingDescription = connectionMethodDiagram(mysqlMethodValue,
                            ConnectionEditor.#mysqlSslMode(sslMode?.value), connectionDiagramEndpoints(values));
                    },
                    horizontalSpan: 8,
                },
            },
        };

        const sqliteDetailsSection: IDialogSection = {
            contexts: ["Sqlite"],
            values: {
                dbFilePath: {
                    type: "resource",
                    caption: "Database Path",
                    value: optionsSqlite.dbFile,

                    filters: { "SQLite 3": ["sqlite3", "sqlite"] },
                    placeholder: "<Enter the DB file location>",
                    horizontalSpan: 7,
                },
                dbName: {
                    type: "text",
                    caption: "Database Name",
                    value: optionsSqlite.dbName,
                    placeholder: "<enter a database name>",
                    horizontalSpan: 2,
                },
            },
        };

        const sqliteAdvancedSection: IDialogSection = {
            contexts: ["Sqlite"],
            caption: "Options",
            groupName: "groupSqlite",
            values: {
                defaultEditorSeparator: {
                    type: "separator",
                    horizontalSpan: 8,
                },
                defaultEditor: {
                    type: "choice",
                    caption: "Default Editor",
                    value: defaultEditor,
                    choices: [globalDefaultEditor, ConnectionEditorType.DbNotebook, ConnectionEditorType.DbScript],
                    description: "Choose the global default or override it for this connection",
                    horizontalSpan: 3,
                },
                otherParameters: {
                    type: "text",
                    caption: "Other Parameters",
                    value: optionsSqlite.otherParameters,
                    horizontalSpan: 8,
                    multiLine: true,
                },
            },
        };

        const mysqlDetailsSection: IDialogSection = {
            contexts: ["MySQL"],
            values: {
                scheme: {
                    type: "choice",
                    caption: "Connection Method",
                    value: selectedMySQLMethod,
                    trailingDescription: connectionMethodDiagram(selectedMySQLMethod,
                        optionsMySQL["ssl-mode"] ?? MySQLSslMode.Preferred, {
                            mysqlHost: optionsMySQL.host,
                            mysqlPort: optionsMySQL.port,
                            ssh: optionsMySQL.ssh,
                        }),
                    trailingDescriptionClassName: "connectionMethodDiagram",
                    choices: [
                        MySQLConnectionScheme.MySQL,
                        mysqlSocketProtocol,
                        mysqlSshTunnelMethod,
                        mysqlBastionMethod,
                        MySQLConnectionScheme.MySQLx,
                    ],
                    options: [CommonDialogValueOption.Hidden],
                    onChange: (method: string, dialog: ValueEditDialog): void => {
                        const selectedScheme = method as MySQLConnectionScheme;
                        const values = dialog.getDialogValues();
                        const mysqlDetails = values.sections.get("mysqlDetails");
                        const connectionMethod = mysqlDetails?.values.scheme;
                        const endpoint = mysqlDetails?.values.port;
                        const hostName = mysqlDetails?.values.hostName;
                        if (!mysqlDetails || connectionMethod?.type !== "choice" || !endpoint ||
                            hostName?.type !== "text") {
                            return;
                        }

                        const sslMode = values.sections.get("ssl")?.values.sslMode;
                        connectionMethod.trailingDescription = connectionMethodDiagram(method,
                            ConnectionEditor.#mysqlSslMode(sslMode?.value), connectionDiagramEndpoints(values));

                        const socketConnection = method === mysqlSocketProtocol;
                        hostName.options = socketConnection ? [CommonDialogValueOption.Hidden] : undefined;
                        if (socketConnection) {
                            mysqlDetails.values.port = {
                                type: "text",
                                caption: "Path",
                                placeholder: "Default",
                                horizontalSpan: 5,
                                onFocusLost: this.updateConnectionMethodDiagram,
                            };
                        } else {
                            const currentPort = endpoint.type === "number" ? endpoint.value : undefined;
                            const defaultPort = selectedScheme === MySQLConnectionScheme.MySQLx ? 33060 : 3306;
                            mysqlDetails.values.port = {
                                type: "number",
                                caption: "Port",
                                value: currentPort === 3306 && defaultPort === 33060 ? 33060
                                    : currentPort === 33060 && defaultPort === 3306 ? 3306
                                        : currentPort ?? defaultPort,
                                horizontalSpan: 1,
                                onFocusLost: this.updateConnectionMethodDiagram,
                            };
                        }

                        const authenticationValues = values.sections.get("authentication")?.values;
                        if (authenticationValues?.factor1.type === "choice"
                            && authenticationValues.factor2.type === "choice"
                            && authenticationValues.factor3.type === "choice") {
                            const usesMySQLX = selectedScheme === MySQLConnectionScheme.MySQLx;
                            authenticationValues.factor1.caption = usesMySQLX ? undefined : "Factor 1";
                            authenticationValues.factor1.choices = usesMySQLX
                                ? [MySQLAuthenticationPlugin.Password]
                                : authenticationPluginChoices;
                            authenticationValues.factor2.choices = usesMySQLX
                                ? [noAuthenticationPlugin]
                                : additionalAuthenticationPluginChoices;
                            authenticationValues.factor3.choices = authenticationValues.factor2.choices;
                            const additionalFactorOptions = usesMySQLX
                                ? [CommonDialogValueOption.Hidden]
                                : [];
                            authenticationValues.factor2Separator.options = additionalFactorOptions;
                            authenticationValues.factor2.options = additionalFactorOptions;
                            authenticationValues.factor3Separator.options = additionalFactorOptions;
                            authenticationValues.factor3.options = additionalFactorOptions;
                            if (usesMySQLX) {
                                authenticationValues.factor1.value = MySQLAuthenticationPlugin.Password;
                                authenticationValues.factor2.value = noAuthenticationPlugin;
                                authenticationValues.factor3.value = noAuthenticationPlugin;
                            }
                            updateAuthenticationFactorDescription(
                                "factor1", authenticationValues.factor1.value!, dialog,
                            );
                        }

                        dialog.updateActiveContexts({
                            add: [
                                ...(method === mysqlSshTunnelMethod ? ["useSSH"] : []),
                                ...(method === mysqlBastionMethod ? ["useMDS"] : []),
                            ],
                            remove: [
                                ...(method === mysqlSshTunnelMethod ? ["useMDS"] : []),
                                ...(method === mysqlBastionMethod ? ["useSSH"] : []),
                                ...(method !== mysqlSshTunnelMethod && method !== mysqlBastionMethod
                                    ? ["useSSH", "useMDS"] : []),
                            ],
                        });
                        if (method === mysqlBastionMethod) {
                            this.shellSession.mhs.getMdsConfigProfiles().then((profiles) => {
                                this.fillProfileDropdown(profiles);
                            }).catch((reason: unknown) => {
                                const message = convertErrorToString(reason);
                                void ui.showErrorMessage("Error while loading OCI profiles: " + message, {});
                            });
                        }

                        dialog.setDialogValues(values);
                    },
                    horizontalSpan: 8,
                },
                userName: {
                    type: "text",
                    caption: "User Name",
                    value: optionsMySQL.user,
                    horizontalSpan: 2,
                },
                hostName: {
                    type: "text",
                    caption: "Host Name or IP Address",
                    value: optionsMySQL.host,
                    horizontalSpan: 4,
                    options: usesMySQLSocket ? [CommonDialogValueOption.Hidden] : undefined,
                    onFocusLost: this.updateConnectionMethodDiagram,
                },
                port: mysqlEndpointValue,
                defaultSchema: {
                    type: "text",
                    caption: "Default Schema",
                    value: optionsMySQL.schema,
                    horizontalSpan: 2,
                },
            },
        };

        const usesMySQLX = selectedMySQLMethod === MySQLConnectionScheme.MySQLx;
        const authenticationHints = usesMySQLX ? undefined : details.settings?.authenticationHints;
        const authenticationFactors = (usesMySQLX
            ? [MySQLAuthenticationPlugin.Password]
            : authenticationHints?.factors ?? [])
            .map((plugin) => {
                return internalPasswordAuthenticationPlugins.has(plugin)
                    ? MySQLAuthenticationPlugin.Password
                    : plugin;
            });
        const authenticationPluginChoices = [
            ...mysqlAuthenticationPluginChoices.filter((plugin) => {
                return this.bundledAuthenticationPlugins.has(plugin) ||
                    authenticationPluginsWithoutSeparateClientPlugin.has(plugin);
            }),
            ...authenticationFactors,
        ].filter((plugin, index, choices) => {
            return choices.indexOf(plugin) === index;
        });
        const optionalAuthenticationPluginChoices = [
            noAuthenticationPlugin,
            ...authenticationPluginChoices,
        ];
        const additionalAuthenticationPluginChoices = optionalAuthenticationPluginChoices.filter((plugin) => {
            return !internalPasswordAuthenticationPlugins.has(plugin);
        });
        const authenticationUsesPassword = authenticationFactors.length === 0
            || authenticationFactors.includes(MySQLAuthenticationPlugin.Password);
        const authenticationUsesClientPlugin = authenticationFactors.some((plugin) => {
            return [
                MySQLAuthenticationPlugin.AuthenticationKerberos,
                MySQLAuthenticationPlugin.AuthenticationLdapSasl,
                MySQLAuthenticationPlugin.AuthenticationLdapSimple,
            ].includes(plugin);
        });
        const authenticationUsesKerberos = authenticationFactors.includes(
            MySQLAuthenticationPlugin.AuthenticationKerberos,
        );
        const authenticationUsesWebAuthn = authenticationFactors.includes(
            MySQLAuthenticationPlugin.AuthenticationWebAuthn,
        );
        const authenticationUsesOpenIdConnect = authenticationFactors.includes(
            MySQLAuthenticationPlugin.AuthenticationOpenIdConnect,
        );
        const authenticationUsesOci = authenticationFactors.includes(MySQLAuthenticationPlugin.AuthenticationOci);

        const moveAuthenticationOptionsAfterFactor = (section: IDialogSection): void => {
            const ociConfigFile = section.values.ociConfigFile;
            const ociConfigProfile = section.values.ociConfigProfile;
            const storePassword = section.values.storePassword;
            const clearPassword = section.values.clearPassword;
            const passwordButtonsEndOfRow = section.values.passwordButtonsEndOfRow;
            const pluginDir = section.values.pluginDir;
            const kerberosClientMode = section.values.kerberosClientMode;
            const webauthnDevice = section.values.webauthnDevice;
            const webauthnPreservePrivacy = section.values.webauthnPreservePrivacy;
            const registerWebAuthnFactor = section.values.registerWebAuthnFactor;
            const openidConnectClientIdTokenFile = section.values.openidConnectClientIdTokenFile;

            const ociFactor = ["factor1", "factor2", "factor3"].find((factor) => {
                return section.values[factor].value === MySQLAuthenticationPlugin.AuthenticationOci;
            });
            const passwordFactor = ["factor1", "factor2", "factor3"].find((factor) => {
                return section.values[factor].value === MySQLAuthenticationPlugin.Password;
            });
            const clientPluginFactor = ["factor1", "factor2", "factor3"].find((factor) => {
                const plugin = section.values[factor].value;

                return [
                    MySQLAuthenticationPlugin.AuthenticationKerberos,
                    MySQLAuthenticationPlugin.AuthenticationLdapSasl,
                    MySQLAuthenticationPlugin.AuthenticationLdapSimple,
                ].includes(plugin as MySQLAuthenticationPlugin);
            });
            const kerberosFactor = ["factor1", "factor2", "factor3"].find((factor) => {
                return section.values[factor].value === MySQLAuthenticationPlugin.AuthenticationKerberos;
            });
            const webauthnFactor = ["factor1", "factor2", "factor3"].find((factor) => {
                return section.values[factor].value === MySQLAuthenticationPlugin.AuthenticationWebAuthn;
            });
            const openidConnectFactor = ["factor1", "factor2", "factor3"].find((factor) => {
                return section.values[factor].value === MySQLAuthenticationPlugin.AuthenticationOpenIdConnect;
            });
            const reorderedValues: IDialogSection["values"] = {};
            for (const [key, value] of Object.entries(section.values)) {
                if (key === "ociConfigFile" || key === "ociConfigProfile" || key === "storePassword" ||
                    key === "clearPassword" || key === "passwordButtonsEndOfRow" || key === "pluginDir" ||
                    key === "kerberosClientMode" || key === "webauthnDevice" || key === "webauthnPreservePrivacy" ||
                    key === "registerWebAuthnFactor" || key === "openidConnectClientIdTokenFile") {
                    continue;
                }

                reorderedValues[key] = value;
                if (key === ociFactor) {
                    reorderedValues.ociConfigFile = ociConfigFile;
                    reorderedValues.ociConfigProfile = ociConfigProfile;
                }
                if (key === passwordFactor) {
                    reorderedValues.storePassword = storePassword;
                    reorderedValues.clearPassword = clearPassword;
                    reorderedValues.passwordButtonsEndOfRow = passwordButtonsEndOfRow;
                }
                if (key === clientPluginFactor) {
                    reorderedValues.pluginDir = pluginDir;
                }
                if (key === kerberosFactor) {
                    reorderedValues.kerberosClientMode = kerberosClientMode;
                }
                if (key === webauthnFactor) {
                    reorderedValues.webauthnDevice = webauthnDevice;
                    reorderedValues.webauthnPreservePrivacy = webauthnPreservePrivacy;
                    reorderedValues.registerWebAuthnFactor = registerWebAuthnFactor;
                }
                if (key === openidConnectFactor) {
                    reorderedValues.openidConnectClientIdTokenFile = openidConnectClientIdTokenFile;
                }
            }

            if (!ociFactor) {
                reorderedValues.ociConfigFile = ociConfigFile;
                reorderedValues.ociConfigProfile = ociConfigProfile;
            }
            if (!passwordFactor) {
                reorderedValues.storePassword = storePassword;
                reorderedValues.clearPassword = clearPassword;
                reorderedValues.passwordButtonsEndOfRow = passwordButtonsEndOfRow;
            }
            if (!clientPluginFactor) {
                reorderedValues.pluginDir = pluginDir;
            }
            if (!kerberosFactor) {
                reorderedValues.kerberosClientMode = kerberosClientMode;
            }
            if (!webauthnFactor) {
                reorderedValues.webauthnDevice = webauthnDevice;
                reorderedValues.webauthnPreservePrivacy = webauthnPreservePrivacy;
                reorderedValues.registerWebAuthnFactor = registerWebAuthnFactor;
            }
            if (!openidConnectFactor) {
                reorderedValues.openidConnectClientIdTokenFile = openidConnectClientIdTokenFile;
            }
            section.values = reorderedValues;
        };
        const updateAuthenticationFactorDescription = (
            factor: string, plugin: string, dialog: ValueEditDialog,
        ): void => {
            const values = dialog.getDialogValues();
            const authenticationValues = values.sections.get("authentication")?.values;
            const field = authenticationValues?.[factor];
            if (field?.type === "choice") {
                field.trailingDescription = authenticationPluginInputDescription(plugin);
            }
            if (authenticationValues) {
                const secondFactor = authenticationValues.factor2;
                const thirdFactor = authenticationValues.factor3;
                if (!this.isMySQLXConnection(values) && secondFactor.type === "choice"
                    && thirdFactor.type === "choice" && secondFactor.value === noAuthenticationPlugin) {
                    const thirdFactorPlugin = thirdFactor.value;
                    if (typeof thirdFactorPlugin === "string" && thirdFactorPlugin !== noAuthenticationPlugin) {
                        secondFactor.value = thirdFactorPlugin;
                        secondFactor.trailingDescription = authenticationPluginInputDescription(
                            thirdFactorPlugin,
                        );
                    }
                    thirdFactor.value = noAuthenticationPlugin;
                    thirdFactor.options = secondFactor.value === noAuthenticationPlugin
                        ? [CommonDialogValueOption.Disabled] : [];
                } else if (!this.isMySQLXConnection(values)) {
                    thirdFactor.options = [];
                }
                const factors = this.getAuthenticationHints(values).factors;
                if (authenticationRequiresClearTextPassword(factors)) {
                    const sslMode = values.sections.get("ssl")?.values.sslMode;
                    if (sslMode) {
                        const mode = ConnectionEditor.#atLeastRequiredSslMode(sslMode.value);
                        sslMode.value = ConnectionEditor.#mysqlSslModeMap.get(mode);
                    }
                }
                const usesClientPlugin = factors.some((selectedPlugin) => {
                    return [
                        MySQLAuthenticationPlugin.AuthenticationKerberos,
                        MySQLAuthenticationPlugin.AuthenticationLdapSasl,
                        MySQLAuthenticationPlugin.AuthenticationLdapSimple,
                    ].includes(selectedPlugin);
                });
                const usesOci = factors.includes(MySQLAuthenticationPlugin.AuthenticationOci);
                const usesPassword = factors.includes(MySQLAuthenticationPlugin.Password);
                const usesKerberos = factors.includes(MySQLAuthenticationPlugin.AuthenticationKerberos);
                const usesWebAuthn = factors.includes(MySQLAuthenticationPlugin.AuthenticationWebAuthn);
                const usesOpenIdConnect = factors.includes(MySQLAuthenticationPlugin.AuthenticationOpenIdConnect);
                authenticationValues.storePassword.options = usesPassword
                    ? [] : [CommonDialogValueOption.Hidden];
                authenticationValues.clearPassword.options = usesPassword
                    ? [] : [CommonDialogValueOption.Hidden];
                authenticationValues.pluginDir.options = usesClientPlugin
                    ? [] : [CommonDialogValueOption.Hidden];
                authenticationValues.ociConfigFile.options = usesOci
                    ? [] : [CommonDialogValueOption.Hidden];
                authenticationValues.ociConfigProfile.options = usesOci
                    ? [] : [CommonDialogValueOption.Hidden];
                authenticationValues.kerberosClientMode.options = usesKerberos
                    ? [] : [CommonDialogValueOption.Hidden];
                authenticationValues.webauthnDevice.options = usesWebAuthn
                    ? [] : [CommonDialogValueOption.Hidden];
                authenticationValues.webauthnPreservePrivacy.options = !usesWebAuthn
                    ? [CommonDialogValueOption.Hidden] : [];
                authenticationValues.registerWebAuthnFactor.options = usesWebAuthn
                    ? [] : [CommonDialogValueOption.Hidden];
                authenticationValues.openidConnectClientIdTokenFile.options = usesOpenIdConnect
                    ? [] : [CommonDialogValueOption.Hidden];
                moveAuthenticationOptionsAfterFactor(values.sections.get("authentication")!);
            }
            this.handleTlsOptionsChange(plugin, dialog);
        };

        const authenticationSection: IDialogSection = {
            contexts: ["MySQL"],
            caption: "Authentication",
            groupName: "group1",
            values: {
                factor1: {
                    type: "choice",
                    caption: usesMySQLX ? undefined : "Factor 1",
                    value: authenticationFactors[0] ?? MySQLAuthenticationPlugin.Password,
                    choices: usesMySQLX ? [MySQLAuthenticationPlugin.Password] : authenticationPluginChoices,
                    trailingDescription: authenticationPluginInputDescription(
                        authenticationFactors[0] ?? MySQLAuthenticationPlugin.Password,
                    ),
                    trailingDescriptionClassName: "authenticationFactorDescription",
                    horizontalSpan: 8,
                    onChange: (plugin, dialog): void => {
                        updateAuthenticationFactorDescription("factor1", plugin, dialog);
                    },
                },
                factor2Separator: {
                    type: "separator",
                    options: usesMySQLX ? [CommonDialogValueOption.Hidden] : [],
                    horizontalSpan: 8,
                },
                factor2: {
                    type: "choice",
                    caption: "Factor 2",
                    value: authenticationFactors[1] ?? noAuthenticationPlugin,
                    choices: usesMySQLX ? [noAuthenticationPlugin] : additionalAuthenticationPluginChoices,
                    trailingDescription: authenticationPluginInputDescription(
                        authenticationFactors[1] ?? noAuthenticationPlugin,
                    ),
                    trailingDescriptionClassName: "authenticationFactorDescription",
                    horizontalSpan: 8,
                    options: usesMySQLX
                        ? [CommonDialogValueOption.Hidden]
                        : [],
                    onChange: (plugin, dialog): void => {
                        updateAuthenticationFactorDescription("factor2", plugin, dialog);
                    },
                },
                factor3Separator: {
                    type: "separator",
                    options: usesMySQLX ? [CommonDialogValueOption.Hidden] : [],
                    horizontalSpan: 8,
                },
                factor3: {
                    type: "choice",
                    caption: "Factor 3",
                    value: authenticationFactors[2] ?? noAuthenticationPlugin,
                    choices: usesMySQLX ? [noAuthenticationPlugin] : additionalAuthenticationPluginChoices,
                    trailingDescription: authenticationPluginInputDescription(
                        authenticationFactors[2] ?? noAuthenticationPlugin,
                    ),
                    trailingDescriptionClassName: "authenticationFactorDescription",
                    horizontalSpan: 8,
                    options: usesMySQLX ? [CommonDialogValueOption.Hidden] : [],
                    onChange: (plugin, dialog): void => {
                        updateAuthenticationFactorDescription("factor3", plugin, dialog);
                    },
                },
                ociConfigFile: {
                    type: "resource",
                    caption: "OCI Config File",
                    value: optionsMySQL["oci-config-file"],
                    description: "The file must contain a fingerprint and key_file, or security_token_file.",
                    canSelectFiles: true,
                    canSelectFolders: false,
                    horizontalSpan: 4,
                    options: authenticationUsesOci ? [] : [CommonDialogValueOption.Hidden],
                },
                ociConfigProfile: {
                    type: "text",
                    caption: "OCI Config Profile",
                    value: optionsMySQL["authentication-oci-client-config-profile"],
                    placeholder: "DEFAULT",
                    description: "The profile in the OCI config file to use for authentication.",
                    horizontalSpan: 4,
                    options: authenticationUsesOci ? [] : [CommonDialogValueOption.Hidden],
                },
                storePassword: {
                    type: "button",
                    value: "Store Password",
                    onClick: this.storePassword,
                    horizontalSpan: 2,
                    options: authenticationUsesPassword
                        ? [] : [CommonDialogValueOption.Hidden],
                },
                clearPassword: {
                    type: "button",
                    value: "Clear Password",
                    onClick: this.clearPassword,
                    horizontalSpan: 2,
                    options: authenticationUsesPassword
                        ? [] : [CommonDialogValueOption.Hidden],
                },
                passwordButtonsEndOfRow: {
                    type: "separator",
                    endOfRow: true,
                },
                kerberosClientMode: {
                    type: "choice",
                    caption: "Kerberos Client Mode",
                    value: optionsMySQL["plugin-authentication-kerberos-client-mode"],
                    choices: ["SSPI", "GSSAPI"],
                    horizontalSpan: 8,
                    options: authenticationUsesKerberos ? [] : [CommonDialogValueOption.Hidden],
                },
                pluginDir: {
                    type: "resource",
                    caption: "Client Authentication Plugin Directory",
                    value: authenticationHints?.pluginDir,
                    canSelectFiles: false,
                    canSelectFolders: true,
                    horizontalSpan: 8,
                    options: authenticationUsesClientPlugin ? [] : [CommonDialogValueOption.Hidden],
                },
                webauthnDevice: {
                    type: "number",
                    caption: "WebAuthn Device",
                    value: optionsMySQL["plugin-authentication-webauthn-device"] ?? 0,
                    min: 0,
                    horizontalSpan: 2,
                    options: authenticationUsesWebAuthn ? [] : [CommonDialogValueOption.Hidden],
                },
                webauthnPreservePrivacy: {
                    type: "boolean",
                    caption: "Preserve WebAuthn Privacy",
                    tooltip: "When multiple discoverable credentials exist, prompt to select one credential instead " +
                        "of sending assertions for all of them.",
                    value: optionsMySQL["plugin-authentication-webauthn-client-preserve-privacy"] ?? false,
                    horizontalSpan: 3,
                    options: !authenticationUsesWebAuthn
                        ? [CommonDialogValueOption.Hidden] : [],
                },
                registerWebAuthnFactor: {
                    type: "button",
                    caption: "Register Factor",
                    tooltip: "Register a WebAuthn device for this authentication factor.",
                    horizontalSpan: 3,
                    options: !authenticationUsesWebAuthn
                        ? [CommonDialogValueOption.Hidden] : [],
                    onClick: (_id, values): void => {
                        this.registerWebAuthnFactor(values);
                    },
                },
                openidConnectClientIdTokenFile: {
                    type: "resource",
                    caption: "OpenID Connect Token File",
                    value: optionsMySQL["authentication-openid-connect-client-id-token-file"],
                    canSelectFiles: true,
                    canSelectFolders: false,
                    horizontalSpan: 8,
                    options: authenticationUsesOpenIdConnect ? [] : [CommonDialogValueOption.Hidden],
                },
            },
        };
        moveAuthenticationOptionsAfterFactor(authenticationSection);

        const savedSslMode = String(optionsMySQL["ssl-mode"] ?? MySQLSslMode.Preferred).toUpperCase() as MySQLSslMode;
        const sslMode = authenticationRequiresClearTextPassword(authenticationFactors)
            ? ConnectionEditor.#atLeastRequiredSslMode(savedSslMode) : savedSslMode;
        const sslModeCaption = ConnectionEditor.#mysqlSslModeMap.get(sslMode) ?? String(optionsMySQL["ssl-mode"]);
        const sslModeChoices = Array.from(ConnectionEditor.#mysqlSslModeMap.values());
        if (!sslModeChoices.includes(sslModeCaption)) {
            sslModeChoices.push(sslModeCaption);
        }

        const forcePqc = this.pqcBooleanValue(optionsMySQL["force-pqc"]);
        const usePqcSign = this.pqcBooleanValue(optionsMySQL["use-pqc-sign"]);
        const tlsControlOptions = sslMode === MySQLSslMode.Disabled ? [CommonDialogValueOption.Disabled] : [];

        const mysqlSslSection: IDialogSection = {
            contexts: ["MySQL"],
            caption: "TLS",
            groupName: "group1",
            values: {
                sslMode: {
                    type: "choice",
                    caption: "TLS Mode",
                    value: sslModeCaption,
                    choices: sslModeChoices,
                    onChange: this.handleTlsOptionsChange,
                    horizontalSpan: 3,
                },
                sslCipher: {
                    type: "text",
                    caption: "Permitted ciphers (optional, comma separated list)",
                    tooltip: "Comma-separated list of TLS cipher suites permitted for this connection.",
                    value: optionsMySQL["ssl-cipher"]!,
                    horizontalSpan: 6,
                },
                sslCaFile: {
                    type: "resource",
                    caption: "CA Certificate Path",
                    tooltip: "Path to the CA certificate used to validate the server certificate.",
                    value: optionsMySQL["ssl-ca"],
                    horizontalSpan: 3,
                },
                sslCertFile: {
                    type: "resource",
                    caption: "Client Certificate Path",
                    tooltip: "Path to the client certificate presented to the server.",
                    value: optionsMySQL["ssl-cert"],
                    horizontalSpan: 3,
                },
                sslKeyFile: {
                    type: "resource",
                    caption: "Client Key Path",
                    tooltip: "Path to the private key for the client certificate.",
                    value: optionsMySQL["ssl-key"],
                    horizontalSpan: 3,
                },
                pqcTitle: {
                    type: "description",
                    caption: "Post-Quantum Cryptography",
                    framed: true,
                    horizontalSpan: 8,
                    options: [CommonDialogValueOption.NewGroup, CommonDialogValueOption.Grouped],
                },
                tlsKex: {
                    type: "text",
                    label: "TLS key-exchange groups",
                    value: optionsMySQL["tls-kex"],
                    placeholder: "Client default",
                    tooltip: "Optional, case-sensitive, colon-separated names, e.g. X25519MLKEM768:X25519. "
                        + "PQC and classical groups are supported; availability depends on the client and server.",
                    horizontalSpan: 8,
                    options: [CommonDialogValueOption.Grouped, ...tlsControlOptions],
                },
                forcePqc: {
                    ...(typeof forcePqc === "string"
                        ? { type: "text", value: forcePqc } as const
                        : { type: "boolean", value: forcePqc } as const),
                    label: "Require PQC key exchange",
                    tooltip: "When TLS is used, this option enforces TLSv1.3 and PQC key exchange automatically. "
                        + "Select a TLS Mode that requires encryption to prevent unencrypted connections.",
                    onChange: this.handleTlsOptionsChange,
                    horizontalSpan: 4,
                    options: [CommonDialogValueOption.Grouped, ...tlsControlOptions],
                },
                forcePqcWarning: {
                    type: "description",
                    messageType: MessageType.Warning,
                    value: "TLS Mode Preferred may allow an unencrypted connection. "
                        + "Select a TLS Mode that requires encryption to guarantee PQC protection.",
                    horizontalSpan: 8,
                    options: [CommonDialogValueOption.Grouped,
                        ...((forcePqc === true && sslMode === MySQLSslMode.Preferred)
                            ? [] : [CommonDialogValueOption.Hidden])],
                },
                usePqcSign: {
                    ...(typeof usePqcSign === "string"
                        ? { type: "text", value: usePqcSign } as const
                        : { type: "boolean", value: usePqcSign } as const),
                    label: "Allow PQC handshake signatures",
                    tooltip: "Allows PQC signatures to be advertised; "
                        + "a classical signature may still be selected.",
                    horizontalSpan: 4,
                    options: [CommonDialogValueOption.Grouped, ...tlsControlOptions],
                },
            },
        };
        const mysqlSshSection: IDialogSection = {
            contexts: ["MySQL", "useSSH"],
            caption: "SSH Tunnel",
            groupName: "group1",
            values: {
                ssh: {
                    type: "text",
                    caption: "SSH URI",
                    value: optionsMySQL.ssh,
                    placeholder: "user@host:22",
                    horizontalSpan: 4,
                    onFocusLost: this.updateConnectionMethodDiagram,
                },
                sshKeyFile: {
                    type: "resource",
                    caption: "SSH Private Key File",
                    value: optionsMySQL["ssh-identity-file"] ?? "",
                    horizontalSpan: 4,
                },
                sshConfigFilePath: {
                    type: "resource",
                    caption: "Custom Path for the SSH Configuration File",
                    value: optionsMySQL["ssh-config-file"],
                    horizontalSpan: 8,
                },
            },
        };

        const mysqlAdvancedSection: IDialogSection = {
            contexts: ["MySQL"],
            caption: "Options",
            groupName: "group1",
            values: {
                defaultEditor: {
                    type: "choice",
                    caption: "Default Editor",
                    value: defaultEditor,
                    choices: [globalDefaultEditor, ConnectionEditorType.DbNotebook, ConnectionEditorType.DbScript],
                    description: "Choose the global default or override it for this connection",
                    horizontalSpan: 3,
                },
                defaultEditorSeparator: {
                    type: "separator",
                    horizontalSpan: 8,
                },
                sqlMode: {
                    type: "text",
                    caption: "SQL Mode",
                    value: optionsMySQL["sql-mode"]?.join(","),
                    horizontalSpan: 5,
                },
                timeout: {
                    type: "number",
                    caption: "Connection Timeout",
                    value: optionsMySQL["connect-timeout"] ?? 15000,
                    placeholder: 0,
                    horizontalSpan: 3,
                },
                compression: {
                    type: "choice",
                    caption: "Compression",
                    value: optionsMySQL.compression,
                    choices: Object.keys(MySQLConnCompression),
                    horizontalSpan: 2,
                    optional: true,
                },
                compressionLevel: {
                    type: "number",
                    caption: "Compression Level",
                    value: optionsMySQL["compression-level"] ?? 3,
                    horizontalSpan: 2,
                },
                compressionAlgorithms: {
                    type: "set",
                    caption: "Compression Algorithms",
                    value: optionsMySQL["compression-algorithms"]?.split(","),
                    tagSet: ["zstd", "zlib", "lz4", "uncompressed"],
                    horizontalSpan: 4,
                },
                extraOptions: {
                    type: "matrix",
                    caption: "Other Connection Options",
                    value: optionsMySQL["extra-options"],
                    horizontalSpan: 8,
                },
            },
        };

        this.activeOciProfileName = optionsMySQL["profile-name"];

        const mdsBastionSection: IDialogSection = {
            contexts: ["MySQL", "useMDS"],
            caption: "OCI Bastion Service",
            groupName: "group1",
            values: {
                profileName: {
                    type: "choice",
                    caption: "OCI Profile Name",
                    value: this.activeOciProfileName,
                    horizontalSpan: 4,
                    choices: this.ociProfileNames ? this.ociProfileNames.map((item) => {
                        return item.profile;
                    }) : [],
                    onChange: this.handleProfileNameChange,
                },
                databaseTypeDescription: {
                    type: "description",
                    value: "",
                },
                sshKeyFile: {
                    type: "resource",
                    caption: "SSH Private Key File",
                    value: optionsMySQL["ssh-identity-file"] ?? "id_rsa_mysql_shell",
                    horizontalSpan: 4,
                },
                sshPublicKeyFile: {
                    type: "resource",
                    caption: "SSH Public Key File",
                    value: details.useMHS ? optionsMySQL["ssh-public-identity-file"] ?? "id_rsa_mysql_shell.pub" : "",
                    horizontalSpan: 4,
                    options: !details.useMHS ? [CommonDialogValueOption.Disabled] : [],
                },
                mysqlDbSystemId: {
                    type: "text",
                    caption: "MySQL DB System OCID",
                    value: optionsMySQL["mysql-db-system-id"],
                    horizontalSpan: 8,
                    onFocusLost: this.handleDbSystemIdChange,
                },
                bastionId: {
                    type: "text",
                    caption: "Bastion OCID",
                    value: this.liveUpdateFields.bastionId.value,
                    horizontalSpan: 8,
                    showLoading: this.liveUpdateFields.bastionId.loading,
                    onFocusLost: this.handleBastionIdChange,
                },
                mysqlDbSystemName: {
                    type: "text",
                    caption: "MySQL DB System Name",
                    value: this.liveUpdateFields.mdsDatabaseName.value,
                    showLoading: this.liveUpdateFields.mdsDatabaseName.loading,
                    options: [CommonDialogValueOption.Disabled],
                    horizontalSpan: 4,
                },
                bastionName: {
                    type: "text",
                    caption: "Bastion Name",
                    value: this.liveUpdateFields.bastionName.value,
                    showLoading: this.liveUpdateFields.mdsDatabaseName.loading,
                    options: [CommonDialogValueOption.Disabled],
                    horizontalSpan: 4,
                },
            },
        };

        return {
            id: String(details.id),
            columns: 9,
            sections: new Map<string, IDialogSection>([
                ["information", informationSection],
                ["connectionMethod", connectionMethodSection],
                ["sqliteDetails", sqliteDetailsSection],
                ["sqliteAdvanced", sqliteAdvancedSection],
                ["mysqlDetails", mysqlDetailsSection],
                ["authentication", authenticationSection],
                ["ssh", mysqlSshSection],
                ["mdsBastion", mdsBastionSection],
                ["ssl", mysqlSslSection],
                ["mysqlAdvanced", mysqlAdvancedSection],
            ]),
        };
    };

    private get connectionBadges(): IDictionary {
        const badges = ConnectionTags.getCached();
        const result: IDictionary = {};

        Object.entries(badges).forEach(([text, color]) => {
            const badgeText = text.trim();
            if (badgeText.length > 0 && typeof color === "string" && color.trim().length > 0) {
                result[badgeText] = color.trim();
            }
        });

        return result;
    }

    private connectionBadgeTagStyles(badges: IDictionary): Record<string, JSX.CSSProperties> {
        const styles: Record<string, JSX.CSSProperties> = {};
        Object.entries(badges).forEach(([text, color]) => {
            styles[text] = {
                backgroundColor: String(color),
                color: this.connectionBadgeForeground(String(color)),
            };
        });

        return styles;
    }

    private connectionBadgeForeground(color: string): string {
        return ConnectionTags.foreground(color);
    }

    private handleTagsChange = (tags: string[], dialog: ValueEditDialog): void => {
        if (tags.length <= ConnectionEditor.maxTags) {
            return;
        }

        const badges = this.connectionBadges;
        dialog.updateSetValue(
            Object.keys(badges),
            tags.slice(0, ConnectionEditor.maxTags),
            "tags",
            this.connectionBadgeTagStyles(badges),
        );
    };

    private openBadgeEditor = (_id: string, values: IDialogValues): void => {
        this.selectedTagsBeforeEdit =
            values.sections.get("information")?.values.tags.value as string[] | undefined ?? [];
        this.badgeEditorRef.current?.show(this.generateBadgeEditorConfig(), {
            title: "Connection Tags",
            autoMinWidth: true,
        });
    };

    private generateBadgeEditorConfig = (): IDialogValues => {
        return {
            id: "connectionBadgeEditor",
            sections: new Map([
                ["badges", {
                    values: {
                        badges: {
                            type: "custom",
                            caption: "Tags",
                            value: { badges: this.connectionBadges },
                            component: <ConnectionBadgeEditor />,
                            horizontalSpan: 8,
                        },
                    },
                }],
            ]),
        };
    };

    private validateBadgeEditorValues = (_closing: boolean, values: IDialogValues): Promise<IDialogValidations> => {
        const badgeEditorValues = values.sections.get("badges")?.values.badges.value as IDictionary | undefined;
        const badges = badgeEditorValues?.badges as IDictionary | undefined;
        const messages: Record<string, string> = {};
        const normalizedTexts = new Set<string>();

        Object.entries(badges ?? {}).some(([text, color]) => {
            const badgeText = text.trim();
            const badgeColor = String(color).trim();
            if (badgeText.length === 0 || badgeText.length > 16) {
                messages.badges = "Badge text must be between 1 and 16 characters.";

                return true;
            }

            const normalizedText = badgeText.toLocaleLowerCase();
            if (normalizedTexts.has(normalizedText)) {
                messages.badges = "Badge text must be unique.";

                return true;
            }
            normalizedTexts.add(normalizedText);

            if (badgeColor.length === 0) {
                messages.badges = "Badge color must not be empty.";

                return true;
            }

            return false;
        });

        return Promise.resolve({ messages });
    };

    private handleBadgeEditorClose = (closure: DialogResponseClosure, values: IDialogValues): void => {
        if (closure !== DialogResponseClosure.Accept) {
            return;
        }

        const badgeEditorValues = values.sections.get("badges")?.values.badges.value as IDictionary | undefined;
        const badges = badgeEditorValues?.badges as IDictionary | undefined;
        const sanitizedBadges: IDictionary = {};
        Object.entries(badges ?? {}).forEach(([text, color]) => {
            const badgeText = text.trim();
            if (badgeText.length > 0) {
                sanitizedBadges[badgeText] = String(color).trim();
            }
        });

        void ConnectionTags.set(sanitizedBadges);

        const badgeNames = Object.keys(sanitizedBadges);
        const selectedTags = this.selectedTagsBeforeEdit.filter((tag) => {
            return badgeNames.includes(tag);
        });
        this.editorRef.current?.updateSetValue(
            badgeNames,
            selectedTags,
            "tags",
            this.connectionBadgeTagStyles(sanitizedBadges),
        );
    };

    /**
     * Helper function to check if a dialog value is actually an integer number.
     *
     * @param value The value to check.
     *
     * @returns The value as number, if
     */
    private checkValidInt(value: DialogValueType): number | undefined {
        if (typeof value === "number") {
            if (Math.trunc(value) !== value) {
                return undefined;
            }
        } else {
            const result = filterInt(value.toString());
            if (isNaN(result) || result < 0) {
                return undefined;
            }
        }

        return value as number;
    }

    private storePassword = (_id: string, values: IDialogValues): void => {
        const mysqlDetailsSection = values.sections.get("mysqlDetails")!.values;
        const user = mysqlDetailsSection.userName.value as string;
        const host = mysqlDetailsSection.hostName.value as string;
        const port = mysqlDetailsSection.port.value as string;
        const connectionMethod = values.sections.get("connectionMethod")!.values.connectionMethod.value;
        const connectionTarget = connectionMethod === mysqlSocketProtocol
            ? mysqlDetailsSection.port.value as string || "localhost"
            : `${host}:${port}`;
        if (user && host) {
            const passwordRequest: IServicePasswordRequest = {
                requestId: "userInput",
                caption: "Open MySQL Connection",
                service: `${user}@${connectionTarget}`,
                user,
            };
            void ui.requestPassword(passwordRequest).then((password) => {
                if (password !== undefined) {
                    void ShellInterface.users.storePassword(`${user}@${connectionTarget}`, password);
                }
            });
        } else {
            void ui.showErrorMessage("User, Host and port cannot be empty.", {});
        }
    };

    private clearPassword = (_id: string, values: IDialogValues): void => {
        const mysqlDetailsSection = values.sections.get("mysqlDetails")!.values;
        const user = mysqlDetailsSection.userName.value as string;
        const host = mysqlDetailsSection.hostName.value as string;
        const port = mysqlDetailsSection.port.value as string;
        const connectionMethod = values.sections.get("connectionMethod")!.values.connectionMethod.value;
        const connectionTarget = connectionMethod === mysqlSocketProtocol
            ? mysqlDetailsSection.port.value as string || "localhost"
            : `${host}:${port}`;
        if (user && host) {
            ShellInterface.users.clearPassword(`${user}@${connectionTarget}`).then(() => {
                if (this.confirmClearPasswordDialogRef.current) {
                    this.confirmClearPasswordDialogRef.current.show(
                        (<Container orientation={Orientation.TopDown}>
                            <Grid columns={["auto"]} columnGap={5}>
                                <GridCell crossAlignment={ContentAlignment.Stretch}>
                                    Password was cleared.
                                </GridCell>
                            </Grid>
                        </Container>),
                        { accept: "OK" },
                        "Password Cleared",
                    );

                    ui.showInformationMessage("Password cleared successfully.", {});
                }
            }).catch((reason: unknown) => {
                const message = convertErrorToString(reason);
                void ui.showErrorMessage(`Clear Password Error: ${message}`, {});
            });
        }
    };

    private fillProfileDropdown(profiles: IMdsProfileData[] | undefined) {
        this.ociProfileNames = profiles;
        const items = this.ociProfileNames?.map((item) => {
            return item.profile;
        }) ?? [];
        const found = this.ociProfileNames?.find((item) => {
            return item.isCurrent;
        });
        if (!this.activeOciProfileName) {
            this.activeOciProfileName = found?.profile;
            this.liveUpdateFields.profileName = this.activeOciProfileName ?? "";
        } else {
            const profile = items.find((item) => {
                return item === this.activeOciProfileName;
            });
            if (!profile) {
                items.unshift(this.activeOciProfileName);
            }
        }
        items.unshift(" ");
        this.editorRef.current?.updateDropdownValue(items, this.activeOciProfileName ?? "", "profileName");
    }

    private loadMdsAdditionalDataAndShowConnectionDlg(dbTypeName: string, newConnection: boolean,
        currentPath: string, details?: IConnectionDetails): void {
        const contexts: string[] = [dbTypeName];
        if (details?.useMHS) {
            contexts.push("useMDS");
        }

        if (details?.useSSH) {
            contexts.push("useSSH");
        }

        this.beginValueUpdating("Loading...", "bastionName");
        this.beginValueUpdating("Loading...", "mysqlDbSystemName");
        this.editorRef.current?.show(
            this.generateEditorConfig(currentPath, details),
            {
                contexts,
                title: editorHeading,
            },
            {
                createNew: newConnection,
                currentPath,
                details,
            },
        );

        this.shellSession.mhs.getMdsBastion(this.liveUpdateFields.profileName, this.liveUpdateFields.bastionId.value)
            .then((summary) => {
                this.updateInputValue(summary.name, "bastionName");
            }).catch(() => {
                this.updateInputValue("<error loading bastion name data>", "bastionName");
            });

        this.shellSession.mhs.getMdsMySQLDbSystem(this.liveUpdateFields.profileName, this.liveUpdateFields.dbSystemId)
            .then((system) => {
                this.updateInputValue(system.displayName, "mysqlDbSystemName");
            })
            .catch(() => {
                this.updateInputValue("<error loading database OCI name data>", "mysqlDbSystemName");
            });
    }

    private handleBastionIdChange = (value: string, _dialog: ValueEditDialog, forceUpdate = false): void => {
        if (value !== this.liveUpdateFields.bastionId.value || forceUpdate) {
            this.liveUpdateFields.bastionId.value = value;
            this.beginValueUpdating("Loading...", "bastionName");

            this.shellSession.mhs.getMdsBastion(this.liveUpdateFields.profileName, value).then((summary) => {
                this.updateInputValue(summary.name, "bastionName");
            }).catch((reason: unknown) => {
                const message = convertErrorToString(reason);
                this.updateInputValue(message, "bastionName");
            });
        }
    };

    private handleDbSystemIdChange = (value: string, _dialog: ValueEditDialog, forceUpdate = false): void => {
        if (value !== this.liveUpdateFields.dbSystemId || forceUpdate) {
            this.liveUpdateFields.dbSystemId = value;
            this.beginValueUpdating("Loading...", "mysqlDbSystemName");

            this.shellSession.mhs.getMdsMySQLDbSystem(this.liveUpdateFields.profileName, value).then((system) => {
                this.updateInputValue(system.displayName, "mysqlDbSystemName");
            }).catch((reason: unknown) => {
                const message = convertErrorToString(reason);
                void ui.showErrorMessage(`Get MHS Database Error: ${message}`, {});
                this.updateInputValue("<error loading mds database info>", "mysqlDbSystemName");
            });
        }
    };

    private handleProfileNameChange = (value: DialogValueType, dialog: ValueEditDialog): void => {
        const entry = value as string;
        if (this.liveUpdateFields.profileName !== entry) {
            this.liveUpdateFields.profileName = entry;
            this.handleBastionIdChange(this.liveUpdateFields.bastionId.value, dialog, true);
            this.handleDbSystemIdChange(this.liveUpdateFields.dbSystemId, dialog, true);
        }
    };

    private handleTabSelect = (id: string): void => {
        if (id === "MDS/Bastion Service") {
            this.shellSession.mhs.getMdsConfigProfiles().then((profiles) => {
                this.fillProfileDropdown(profiles);
            }).catch((reason: unknown) => {
                const message = convertErrorToString(reason);
                void ui.showErrorMessage(`Error when loading OCI profiles: ${message}`, {});
            });
        }
    };

    private async createBastion(): Promise<IBastionSummary | undefined> {
        try {
            const summary = await this.shellSession.mhs.createBastion(this.liveUpdateFields.profileName,
                this.liveUpdateFields.dbSystemId, true);

            return summary;
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Create Bastion Error: "${message}`, {});
            this.updateInputValue("<failed to create default bastion>", "bastionName");
            this.editorRef.current?.updateInputValue("<failed to create default bastion>", "bastionId");

            throw reason;
        }
    }

    private beginValueUpdating = (value: string, valueId: string): void => {
        switch (valueId) {
            case "bastionName": {
                this.liveUpdateFields.bastionName.loading = true;
                this.liveUpdateFields.bastionName.value = value;
                break;
            }

            case "bastionId": {
                this.liveUpdateFields.bastionId.loading = true;
                this.liveUpdateFields.bastionId.value = value;
                break;
            }

            case "mysqlDbSystemName": {
                this.liveUpdateFields.mdsDatabaseName.loading = true;
                this.liveUpdateFields.mdsDatabaseName.value = value;
                break;
            }

            default:
        }
        this.editorRef.current?.beginValueUpdating(value, valueId);
    };

    private updateInputValue = (value: string, valueId: string): void => {
        switch (valueId) {
            case "bastionName": {
                this.liveUpdateFields.bastionName.loading = false;
                this.liveUpdateFields.bastionName.value = value;
                break;
            }
            case "bastionId": {
                this.liveUpdateFields.bastionId.loading = false;
                this.liveUpdateFields.bastionId.value = value;
                break;
            }
            case "mysqlDbSystemName": {
                this.liveUpdateFields.mdsDatabaseName.loading = false;
                this.liveUpdateFields.mdsDatabaseName.value = value;
                break;
            }
            default: {
                break;
            }
        }
        this.editorRef.current?.updateInputValue(value, valueId);
    };

    private confirmBastionCreation = (currentPath: string, connection?: IConnectionDetails): void => {
        if (this.confirmNewBastionDialogRef.current) {
            this.confirmNewBastionDialogRef.current.show(
                (<Container orientation={Orientation.TopDown}>
                    <Grid columns={["auto"]} columnGap={5}>
                        <GridCell crossAlignment={ContentAlignment.Stretch}>
                            There is no Bastion in the compartment of this MySQL DB System that can be used.<br /><br />
                        </GridCell>
                        <GridCell className="right" crossAlignment={ContentAlignment.Stretch}>
                            Do you want to create a new Bastion in the compartment of the MySQL DB System?
                        </GridCell>
                    </Grid>
                </Container>),
                {
                    refuse: "Cancel",
                    accept: "Create New Bastion",
                },
                "Create New Bastion",
                undefined,
                { currentPath, connection },
            );
        }

    };

    private handleCreateNewBastion = ((closure: DialogResponseClosure, values?: IDictionary): void => {
        if (closure === DialogResponseClosure.Accept && values) {
            const details = values.connection as IConnectionDetails;
            const currentPath = values.currentPath as string | undefined ?? "/";
            const contexts: string[] = [DBType.MySQL];
            if (details.useSSH) {
                contexts.push("useSSH");
            }

            // Push useMDS to display the MDS tab
            contexts.push("useMDS");

            this.beginValueUpdating("Loading...", "bastionName");
            this.beginValueUpdating("Loading...", "mysqlDbSystemName");
            this.beginValueUpdating("Loading...", "bastionId");

            this.editorRef.current?.show(
                this.generateEditorConfig(currentPath, details),
                {
                    contexts,
                    title: editorHeading,
                },
                {
                    createNew: !(details.id > 0),
                    currentPath,
                    details,
                });
            this.editorRef.current?.preventConfirm(true);

            this.setProgressMessage("Waiting up to 5 minutes for the bastion to be created.");
            this.showProgress();
            setTimeout(() => {
                // Update the OCI tree to show the bastion that is created.
                requisitions.executeRemote("refreshOciTree", undefined);
            }, 8000);

            this.createBastion().then((summary) => {
                if (summary) {
                    requisitions.executeRemote("refreshOciTree", undefined);
                    this.updateInputValue(summary.id, "bastionId");
                    this.updateInputValue(summary.name, "bastionName");
                    this.hideProgress();
                    this.editorRef.current?.preventConfirm(false);
                }
            }).catch(() => {
                requisitions.executeRemote("refreshOciTree", undefined);
                this.updateInputValue("<error loading bastion name data>", "bastionName");
                this.hideProgress();
                this.editorRef.current?.preventConfirm(true);
            });

            this.shellSession.mhs.getMdsMySQLDbSystem(this.liveUpdateFields.profileName,
                this.liveUpdateFields.dbSystemId)
                .then((system) => {
                    this.updateInputValue(system.displayName, "mysqlDbSystemName");
                })
                .catch(() => {
                    this.editorRef.current?.updateInputValue("<error loading database OCI name data>",
                        "mysqlDbSystemName");
                });
        }
    });

    private setProgressMessage = (message: string): void => {
        this.setState({ progressMessage: message });
    };

    private showProgress = (): void => {
        this.setState({ loading: true });
    };

    private hideProgress = (): void => {
        this.setState({ loading: false, progressMessage: "" });
    };
}
