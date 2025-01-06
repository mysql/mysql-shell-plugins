/*
 * Copyright (c) 2023, 2025, Oracle and/or its affiliates.
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

import { ComponentChild, createRef } from "preact";
import { DialogResponseClosure, IDictionary, IServicePasswordRequest } from "../../app-logic/general-types.js";

import {
    IMySQLConnectionOptions, MySQLConnCompression, MySQLConnectionScheme, MySQLSqlMode, MySQLSslMode,
} from "../../communication/MySQL.js";
import { IBastionSummary } from "../../communication/Oci.js";
import { IMdsProfileData } from "../../communication/ProtocolMds.js";
import { ISqliteConnectionOptions } from "../../communication/Sqlite.js";
import { ConfirmDialog } from "../../components/Dialogs/ConfirmDialog.js";
import {
    CommonDialogValueOption, DialogValueType, IDialogSection, IDialogValidations, IDialogValues, ValueEditDialog,
} from "../../components/Dialogs/ValueEditDialog.js";
import { CheckState, ICheckboxProperties } from "../../components/ui/Checkbox/Checkbox.js";

import { ComponentBase, IComponentProperties, IComponentState } from "../../components/ui/Component/ComponentBase.js";
import { Container, ContentAlignment, ContentWrap, Orientation } from "../../components/ui/Container/Container.js";
import { Grid } from "../../components/ui/Grid/Grid.js";
import { GridCell } from "../../components/ui/Grid/GridCell.js";
import { Label } from "../../components/ui/Label/Label.js";
import { ProgressIndicator } from "../../components/ui/ProgressIndicator/ProgressIndicator.js";
import type { ICdmConnectionEntry } from "../../data-models/ConnectionDataModel.js";
import { requisitions } from "../../supplement/Requisitions.js";
import { Settings } from "../../supplement/Settings/Settings.js";
import { ShellInterface } from "../../supplement/ShellInterface/ShellInterface.js";
import { ShellInterfaceShellSession } from "../../supplement/ShellInterface/ShellInterfaceShellSession.js";
import { DBConnectionEditorType, DBType, IConnectionDetails } from "../../supplement/ShellInterface/index.js";
import { basename, filterInt } from "../../utilities/string-helpers.js";
import { DBEditorContext, type DBEditorContextType } from "./index.js";
import { ui } from "../../app-logic/UILayer.js";

const editorHeading = "Database Connection Configuration";

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
    public static override contextType = DBEditorContext;

    private editorRef = createRef<ValueEditDialog>();
    private confirmClearPasswordDialogRef = createRef<ConfirmDialog>();
    private confirmNewBastionDialogRef = createRef<ConfirmDialog>();

    private knowDbTypes: string[] = [];

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

    static #mysqlSslModeMap = new Map<MySQLSslMode, string>([
        [MySQLSslMode.Disabled, "Disable"],
        [MySQLSslMode.Preferred, "Preferred"],
        [MySQLSslMode.Required, "Require"],
        [MySQLSslMode.VerifyCA, "Require and Verify CA"],
        [MySQLSslMode.VerifyIdentity, "Require and Verify Identity"],
    ]);

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
                    onValidate={this.validateConnectionValues}
                    onClose={this.handleOptionsDialogClose}
                    onSelectTab={this.handleTabSelect}
                    customFooter={customFooter}
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
     * @param details Optional connection details for existing connections.
     */
    public async show(dbTypeName: string, newConnection: boolean, details?: IConnectionDetails): Promise<void> {
        if (this.knowDbTypes.length === 0) {
            this.knowDbTypes = await ShellInterface.core.getDbTypes();
        }

        this.liveUpdateFields.bastionName.value = "";
        this.liveUpdateFields.mdsDatabaseName.value = "";
        this.liveUpdateFields.profileName = "";
        this.liveUpdateFields.bastionId.value = "";
        this.liveUpdateFields.dbSystemId = "";

        // Initializes useMDS/useSSH to have the tabs be shown or hidden based on the saved connection options.
        if (details?.dbType === DBType.MySQL) {
            const optionsMySQL = details.options as IMySQLConnectionOptions;
            details.useMHS = optionsMySQL["mysql-db-system-id"] !== undefined;
            details.useSSH = optionsMySQL.ssh !== undefined;
        }

        if (this.editorRef.current) {
            const bastionId = (details && "bastion-id" in details.options)
                ? details.options["bastion-id"] as string : undefined;
            const profileName = (details && "profile-name" in details.options)
                ? details.options["profile-name"] as string : undefined;
            const mysqlDbSystemId = (details && "mysql-db-system-id" in details.options)
                ? details.options["mysql-db-system-id"] as string : undefined;

            if (bastionId && profileName && mysqlDbSystemId) {
                // We have bastion id and mds database id.
                this.liveUpdateFields.profileName = profileName;
                this.liveUpdateFields.bastionId.value = bastionId;
                this.liveUpdateFields.dbSystemId = mysqlDbSystemId;
                this.loadMdsAdditionalDataAndShowConnectionDlg(dbTypeName, newConnection, details);
            } else if (details && !bastionId && profileName && mysqlDbSystemId) {
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
                        (details.options as IMySQLConnectionOptions)["bastion-id"] as string;
                    this.loadMdsAdditionalDataAndShowConnectionDlg(dbTypeName, newConnection, details);
                } else {
                    this.confirmBastionCreation(details);
                }
            } else {
                // A connection dialog without MySQL DB system id.
                // Activate the SSH/MDS contexts as needed
                const contexts: string[] = [dbTypeName];
                if (details?.useSSH) {
                    contexts.push("useSSH");
                }

                if (details?.useMHS) {
                    contexts.push("useMDS");
                }

                this.editorRef.current.show(
                    this.generateEditorConfig(details),
                    {
                        contexts,
                        title: editorHeading,
                    },
                    {
                        createNew: newConnection,
                        details,
                    });
            }
        }
    }

    protected validateConnectionValues = (closing: boolean, values: IDialogValues,
        data?: IDictionary): IDialogValidations => {

        const result: IDialogValidations = {
            requiredContexts: [],
            messages: {},
        };

        const generalSection = values.sections.get("general")!.values;
        const informationSection = values.sections.get("information")!.values;
        const sqliteDetailsSection = values.sections.get("sqliteDetails")!.values;

        //const sqliteAdvancedSection = values.sections.get("sqliteAdvanced")!.values;
        const mysqlDetailsSection = values.sections.get("mysqlDetails")!.values;

        //const mysqlSsSection = values.sections.get("ssl")!.values;
        const mysqlAdvancedSection = values.sections.get("mysqlAdvanced")!.values;

        //const mysqlSshSection = values.sections.get("ssh")!.values;

        /*if (mysqlDetailsSection.useMDS.value as boolean === false) {
            mysqlSshSection.sshPublicKeyFile.options = [DialogValueOption.Disabled];
            this.tmpShPublicKeyFile = mysqlSshSection.sshPublicKeyFile.value as string;
            mysqlSshSection.sshPublicKeyFile.value = "";
        } else {
            mysqlSshSection.sshPublicKeyFile.options = [DialogValueOption.Resource];
            mysqlSshSection.sshPublicKeyFile.value = this.tmpShPublicKeyFile;
        }*/

        const isSqlite = generalSection.databaseType.value === "Sqlite";
        const isMySQL = generalSection.databaseType.value === "MySQL";

        if (!isSqlite && !isMySQL) {
            result.messages.databaseType = "Select one of the database types for your connection";
        }

        if (!informationSection.caption.value) {
            if (closing) {
                result.messages.caption = "The caption cannot be empty";
            }
        } else {
            // Check duplicate captions.
            const context = this.context as DBEditorContextType;
            const connections = context.connectionsDataModel.connections;
            const entry = connections.find((element: ICdmConnectionEntry) => {
                return element.details.caption === informationSection.caption.value;
            });

            // The caption can be the same if it is the one from the connection that is currently being edited.
            if (entry && (String(entry.details.id) !== values.id || data?.createNew)) {
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
                } catch (e) {
                    result.messages.dbFilePath = "Invalid file path";
                }
            }
        } else if (isMySQL) {
            if (closing) {
                const host = mysqlDetailsSection.hostName.value as string;
                if (!host || host.length === 0) {
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

            if (typeof mysqlAdvancedSection.timeout.value === "number") {
                const timeout = this.checkValidInt(mysqlAdvancedSection.timeout.value);
                if (timeout === undefined || isNaN(timeout) || timeout < 0) {
                    result.messages.timeout = "The timeout must be a valid integer >= 0";
                }
            }
        }

        return result;
    };

    private handleOptionsDialogClose = (closure: DialogResponseClosure, values: IDialogValues,
        data?: IDictionary): void => {
        if (closure === DialogResponseClosure.Accept) {
            const generalSection = values.sections.get("general")!.values;
            const informationSection = values.sections.get("information")!.values;
            const sqliteDetailsSection = values.sections.get("sqliteDetails")!.values;
            const sqliteAdvancedSection = values.sections.get("sqliteAdvanced")!.values;
            const mysqlDetailsSection = values.sections.get("mysqlDetails")!.values;
            const mdsAdvancedSection = values.sections.get("mdsAdvanced")!.values;
            const mysqlSshSection = values.sections.get("ssh")!.values;
            const mysqlAdvancedSection = values.sections.get("mysqlAdvanced")!.values;
            const mysqlSslSection = values.sections.get("ssl")!.values;

            const isSqlite = generalSection.databaseType.value === "Sqlite";
            const isMySQL = generalSection.databaseType.value === "MySQL";

            let details: IConnectionDetails | undefined = data?.details as IConnectionDetails;
            const dbType = generalSection.databaseType.value as DBType; // value must be a string.

            if (data?.createNew) {
                details = {
                    id: 0, // Will be replaced with the ID returned from the BE call.
                    dbType,
                    caption: informationSection.caption.value as string,
                    description: informationSection.description.value as string,
                    useSSH: false,
                    useMHS: false,
                    options: {},
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
                details.dbType = dbType;
                details.useMHS = mysqlDetailsSection.useMDS.value as boolean;
                details.useSSH = mysqlDetailsSection.useSSH.value as boolean;
                details.caption = informationSection.caption.value as string;
                details.description = informationSection.description.value as string;

                // TODO: use current active nesting group, once available.
                // details.folderPath = ...

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

                    if (details.useMHS && mdsAdvancedSection.sshKeyFile.value !== "") {
                        sshKeyFile = mdsAdvancedSection.sshKeyFile.value;
                    }

                    let sshKeyFilePublic;
                    if (details.useMHS && mdsAdvancedSection.sshPublicKeyFile.value !== "") {
                        sshKeyFilePublic = mdsAdvancedSection.sshPublicKeyFile.value;
                    }

                    const useSsl = mysqlSslSection.sslMode.value !== MySQLSslMode.Disabled;
                    let mode;
                    if (useSsl) {
                        ConnectionEditor.#mysqlSslModeMap.forEach((value: string, key: MySQLSslMode) => {
                            if (value === mysqlSslSection.sslMode.value) {
                                mode = key;
                            }
                        });
                    }

                    const compressionAlgorithms = Array.isArray(mysqlAdvancedSection.compressionAlgorithms.value)
                        ? mysqlAdvancedSection.compressionAlgorithms.value.join(",")
                        : undefined;

                    details.options = {
                        /* eslint-disable @typescript-eslint/naming-convention */
                        "scheme": mysqlDetailsSection.scheme.value as MySQLConnectionScheme,
                        "host": mysqlDetailsSection.hostName.value as string,
                        "port": mysqlDetailsSection.port.value as number,
                        "user": mysqlDetailsSection.userName.value as string,
                        "schema": mysqlDetailsSection.defaultSchema.value as string,

                        // "useSSL": useSsl ? undefined : "no",
                        "ssl-mode": mode ?? undefined,
                        "ssl-ca": mysqlSslSection.sslCaFile.value as string,
                        "ssl-cert": mysqlSslSection.sslCertFile.value as string,
                        "ssl-key": mysqlSslSection.sslKeyFile.value as string,
                        "ssl-cipher": mysqlSslSection.sslCipher.value as string,
                        "compression": (mysqlAdvancedSection.compression.value !== "")
                            ? mysqlAdvancedSection.compression.value as MySQLConnCompression : undefined,
                        "compression-algorithms": compressionAlgorithms,
                        "compression-level": mysqlAdvancedSection.compressionLevel.value as number,

                        //useAnsiQuotes: section5.ansiQuotes.value,
                        //enableClearTextAuthPlugin: section5.clearTextAuth.value,
                        "connect-timeout": mysqlAdvancedSection.timeout.value,
                        //sqlMode: section5.sqlMode.value,
                        "ssh": details.useSSH ? mysqlSshSection.ssh.value as string : undefined,

                        //"ssh-password": details.useSSH ? mysqlSshSection.sshPassword.value : undefined,
                        "ssh-identity-file": sshKeyFile as string,
                        "ssh-config-file": details.useSSH
                            ? mysqlSshSection.sshConfigFilePath.value as string
                            : undefined,
                        "ssh-public-identity-file": sshKeyFilePublic as string,
                        "profile-name": details.useMHS ? mdsAdvancedSection.profileName.value as string : undefined,
                        "bastion-id": details.useMHS ? mdsAdvancedSection.bastionId.value as string : undefined,
                        "mysql-db-system-id": details.useMHS
                            ? mdsAdvancedSection.mysqlDbSystemId.value as string : undefined,
                        "disable-heat-wave-check": mysqlAdvancedSection.disableHeatwaveCheck.value as boolean,
                        /* eslint-enabled @typescript-eslint/naming-convention */
                    };

                    details.settings = {
                        defaultEditor: generalSection.defaultEditor.value as DBConnectionEditorType,
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

    /**
     * Generates the object to be used for the value editor.
     *
     * @param details The properties of an existing connection or undefined for a new one.
     *
     * @returns The necessary dialog values to edit this connection.
     */
    private generateEditorConfig = (details?: IConnectionDetails): IDialogValues => {
        const context = this.context as DBEditorContextType;
        const connections = context.connectionsDataModel.connections;

        let caption = `New Connection`;

        let index = 1;
        while (index < 1000) {
            const candidate = `New Connection ${index}`;
            if (connections.findIndex((element: ICdmConnectionEntry) => {
                return element.details.caption === candidate;
            }) === -1) {
                caption = candidate;

                break;
            }

            index++;
        }

        const description = "A new Database Connection";

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
            settings: {
                defaultEditor: Settings.get("dbEditor.defaultEditor", "notebook") === "notebook"
                    ? DBConnectionEditorType.DbNotebook
                    : DBConnectionEditorType.DbScript,
            },
        };

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

        const defaultEditor = details.settings?.defaultEditor ?? DBConnectionEditorType.DbNotebook;

        const informationSection: IDialogSection = {
            values: {
                caption: {
                    type: "text",
                    caption: "Caption:",
                    value: details.caption,
                    placeholder: "<enter a unique caption>",
                    options: [CommonDialogValueOption.AutoFocus],
                    description: "Short label for this database connection",
                    horizontalSpan: 3,
                },
                description: {
                    type: "text",
                    caption: "Description:",
                    value: details.description,
                    placeholder: "<describe the connection>",
                    description: "More detailed description of the connection",
                    horizontalSpan: 5,
                },
            },
        };

        const generalSection: IDialogSection = {
            values: {
                defaultEditor: {
                    type: "choice",
                    caption: "Default Editor:",
                    value: defaultEditor,
                    choices: [DBConnectionEditorType.DbNotebook, DBConnectionEditorType.DbScript],
                    description: "Choose between a modern notebook interface or a traditional script editor",
                    horizontalSpan: 3,
                },
                folderPath: {
                    type: "choice",
                    caption: "Folder Path:",
                    value: "/",
                    choices: ["/"],
                    description: "Path of the folder holding the connection",
                    horizontalSpan: 3,
                },
                databaseType: {
                    type: "choice",
                    caption: "Database Type:",
                    value: details.dbType,
                    choices: this.knowDbTypes,
                    onChange: (value: DialogValueType, dialog: ValueEditDialog): void => {
                        const availableNames = [...this.knowDbTypes]; // Need a copy.
                        const index = availableNames.findIndex((name) => {
                            return name === value as string;
                        });
                        availableNames.splice(index, 1);
                        dialog.updateActiveContexts({
                            add: [value as string],
                            remove: availableNames,
                        });
                    },
                    horizontalSpan: 2,
                    description: "Database connection type",
                },
            },
        };

        const sqliteDetailsSection: IDialogSection = {
            contexts: ["Sqlite"],
            caption: "Basic",
            groupName: "groupSqlite",
            values: {
                dbFilePath: {
                    type: "resource",
                    caption: "Database Path:",
                    value: optionsSqlite.dbFile,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    filters: { "SQLite 3": ["sqlite3", "sqlite"] },
                    placeholder: "<Enter the DB file location>",
                    horizontalSpan: 8,
                },
                dbName: {
                    type: "text",
                    caption: "Database Name:",
                    value: optionsSqlite.dbName,
                    placeholder: "<enter a database name>",
                },
            },
        };

        const sqliteAdvancedSection: IDialogSection = {
            contexts: ["Sqlite"],
            caption: "Advanced",
            groupName: "groupSqlite",
            values: {
                otherParameters: {
                    type: "text",
                    caption: "Other Parameters:",
                    value: optionsSqlite.otherParameters,
                    horizontalSpan: 8,
                    multiLine: true,
                },
            },
        };

        /*const detailsHeaderSection: IDialogSection = {
            caption: "Connection Details",
            values: {
            },
        };*/

        const mysqlDetailsSection: IDialogSection = {
            contexts: ["MySQL"],
            caption: "Basic",
            groupName: "group1",
            values: {
                hostName: {
                    type: "text",
                    caption: "Host Name or IP Address",
                    value: optionsMySQL.host,
                    horizontalSpan: 4,
                },
                scheme: {
                    type: "choice",
                    caption: "Protocol",
                    value: optionsMySQL.scheme,
                    choices: [MySQLConnectionScheme.MySQL, MySQLConnectionScheme.MySQLx],
                    horizontalSpan: 2,
                },
                port: {
                    type: "number",
                    caption: "Port",
                    value: optionsMySQL.port ?? 3306,
                    horizontalSpan: 2,
                },
                userName: {
                    type: "text",
                    caption: "User Name",
                    value: optionsMySQL.user,
                    horizontalSpan: 4,
                },
                storePassword: {
                    type: "button",
                    value: "Store Password",
                    onClick: this.storePassword,
                    horizontalSpan: 2,
                },
                clearPassword: {
                    type: "button",
                    value: "Clear Password",
                    onClick: this.clearPassword,
                    horizontalSpan: 2,
                },
                defaultSchema: {
                    type: "text",
                    caption: "Default Schema",
                    value: optionsMySQL.schema,
                    horizontalSpan: 4,
                },
                connectionTunnelingTitle: {
                    type: "description",
                    caption: "Tunneling Options",
                    horizontalSpan: 4,
                    options: [
                        CommonDialogValueOption.Grouped,
                        CommonDialogValueOption.NewGroup,
                    ],
                },
                useSSH: {
                    type: "boolean",
                    caption: "Connect using SSH Tunnel",
                    value: details.useSSH === true,
                    horizontalSpan: 4,
                    onChange: (value: boolean, dialog: ValueEditDialog): void => {
                        const contexts = {
                            add: value ? ["useSSH"] : [],
                            remove: value ? [] : ["useSSH"],
                        };
                        dialog.updateActiveContexts(contexts);
                    },
                    options: [
                        CommonDialogValueOption.Grouped,
                    ],
                },
                useMDS: {
                    type: "boolean",
                    caption: "Connect using OCI Bastion service",
                    value: details.useMHS === true,
                    onChange: (value: boolean, dialog: ValueEditDialog): void => {
                        // The MDS tab should be shown/hidden based on the checkbox value
                        const contexts = {
                            add: value ? ["useMDS"] : [],
                            remove: value ? [] : ["useMDS"],
                        };
                        dialog.updateActiveContexts(contexts);

                        if (value) {
                            this.shellSession.mhs.getMdsConfigProfiles().then((profiles) => {
                                this.fillProfileDropdown(profiles);
                            }).catch((reason) => {
                                const message = reason instanceof Error ? reason.message : String(reason);
                                void ui.showErrorNotification("Error while loading OCI profiles: " + message);
                            });
                        }
                    },
                    horizontalSpan: 4,
                    options: [
                        CommonDialogValueOption.Grouped,
                    ],
                },
            },
        };

        const mysqlSslSection: IDialogSection = {
            contexts: ["MySQL"],
            caption: "SSL",
            groupName: "group1",
            values: {
                sslMode: {
                    type: "choice",
                    caption: "SSL Mode",
                    value: ConnectionEditor.#mysqlSslModeMap
                        .get(optionsMySQL["ssl-mode"] ?? MySQLSslMode.Preferred),
                    choices: Array.from(ConnectionEditor.#mysqlSslModeMap.values()),
                    horizontalSpan: 3,
                },
                sslCipher: {
                    type: "text",
                    caption: "Permitted ciphers (optional, comma separated list)",
                    value: optionsMySQL["ssl-cipher"] as string,
                    horizontalSpan: 5,
                },
                sslCaFile: {
                    type: "resource",
                    caption: "Path to Certificate Authority file for SSL",
                    value: optionsMySQL["ssl-ca"],
                    horizontalSpan: 8,
                },
                sslCertFile: {
                    type: "resource",
                    caption: "Path to Client Certificate file for SSL",
                    value: optionsMySQL["ssl-cert"],
                    horizontalSpan: 8,
                },
                sslKeyFile: {
                    type: "resource",
                    caption: "Path to Client Key file for SSL",
                    value: optionsMySQL["ssl-key"],
                    horizontalSpan: 8,
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
                    caption: "SSH URI (<user>@<host>:22)",
                    value: optionsMySQL.ssh,
                    horizontalSpan: 4,
                },
                sshKeyFile: {
                    type: "resource",
                    caption: "SSH Private Key File",
                    value: optionsMySQL["ssh-identity-file"] ?? "id_rsa",
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
            caption: "Advanced",
            groupName: "group1",
            values: {

                // ansiQuotes: {
                //     caption: "Use ANSI Quotes to Quote Identifiers",
                //     value: optionsMySQL.useAnsiQuotes ?? false,
                //     options: [DialogValueOption.Grouped],
                // },
                // clearTextAuth: {
                //     caption: "Enable ClearText Authentication",
                //     value: optionsMySQL.enableClearTextAuthPlugin ?? false,
                //     options: [DialogValueOption.Grouped],
                // },
                sqlMode: {
                    type: "checkList",
                    caption: "SQL Mode",
                    value: optionsMySQL["sql-mode"],
                    checkList: Object.entries(MySQLSqlMode).map(([key, value]) => {
                        const result: ICheckboxProperties = {
                            id: key,
                            caption: value,
                            checkState: CheckState.Unchecked,
                        };

                        return { data: result };
                    }),
                    horizontalSpan: 4,
                    verticalSpan: 3,
                },
                timeout: {
                    type: "number",
                    caption: "Connection Timeout",
                    value: optionsMySQL["connect-timeout"],
                    horizontalSpan: 4,
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
                disableHeatwaveCheckTitle: {
                    type: "description",
                    caption: "Connection Startup Checks",
                    horizontalSpan: 4,
                    options: [
                        CommonDialogValueOption.Grouped,
                        CommonDialogValueOption.NewGroup,
                    ],
                },
                disableHeatwaveCheck: {
                    type: "boolean",
                    caption: "Disable HeatWave Check",
                    value: optionsMySQL["disable-heat-wave-check"] ?? false,
                    horizontalSpan: 4,
                    options: [
                        CommonDialogValueOption.Grouped,
                    ],
                },
                others: {
                    type: "matrix",
                    caption: "Other Connection Options",
                    value: this.parseConnectionAttributes(optionsMySQL["connection-attributes"] ?? {}),
                    horizontalSpan: 8,
                },
            },
        };

        this.activeOciProfileName = optionsMySQL["profile-name"];

        const mdsAdvancedSection: IDialogSection = {
            contexts: ["MySQL", "useMDS"],
            caption: "MDS/Bastion Service",
            groupName: "group1",
            values: {
                profileName: {
                    type: "choice",
                    caption: "Profile Name",
                    value: this.activeOciProfileName,
                    horizontalSpan: 4,
                    choices: this.ociProfileNames ? this.ociProfileNames.map((item) => { return item.profile; }) : [],
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
            sections: new Map<string, IDialogSection>([
                ["information", informationSection],
                ["general", generalSection],
                ["sqliteDetails", sqliteDetailsSection],
                ["sqliteAdvanced", sqliteAdvancedSection],
                ["mysqlDetails", mysqlDetailsSection],
                ["ssl", mysqlSslSection],
                ["mysqlAdvanced", mysqlAdvancedSection],
                ["ssh", mysqlSshSection],
                ["mdsAdvanced", mdsAdvancedSection],
            ]),
        };
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
            const result = filterInt(value?.toString());
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
        if (user && host) {
            const passwordRequest: IServicePasswordRequest = {
                requestId: "userInput",
                caption: "Open MySQL Connection",
                service: `${user}@${host}:${port}`,
                user,
            };
            void requisitions.execute("requestPassword", passwordRequest);
        } else {
            void ui.showErrorNotification("User, Host and port cannot be empty.");
        }
    };

    private clearPassword = (_id: string, values: IDialogValues): void => {
        const mysqlDetailsSection = values.sections.get("mysqlDetails")!.values;
        const user = mysqlDetailsSection.userName.value as string;
        const host = mysqlDetailsSection.hostName.value as string;
        const port = mysqlDetailsSection.port.value as string;
        if (user && host) {
            ShellInterface.users.clearPassword(`${user}@${host}:${port}`).then(() => {
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

                    // TODO: show message for success, once we have message toasts.
                }
            }).catch((reason) => {
                const message = reason instanceof Error ? reason.message : String(reason);
                void ui.showErrorNotification("Clear Password Error: " + message);
            });
        }
    };

    private fillProfileDropdown(profiles: IMdsProfileData[] | undefined) {
        this.ociProfileNames = profiles;
        const items = this.ociProfileNames?.map((item) => { return item.profile; }) ?? [];
        const found = this.ociProfileNames?.find((item) => { return item.isCurrent === true; });
        if (!this.activeOciProfileName) {
            this.activeOciProfileName = found?.profile;
            this.liveUpdateFields.profileName = this.activeOciProfileName ?? "";
        } else {
            const profile = items.find((item) => { return item === this.activeOciProfileName; });
            if (!profile) {
                items.unshift(this.activeOciProfileName);
            }
        }
        items.unshift(" ");
        this.editorRef.current?.updateDropdownValue(items, this.activeOciProfileName ?? "", "profileName");
    }

    private loadMdsAdditionalDataAndShowConnectionDlg = ((dbTypeName: string, newConnection: boolean,
        details?: IConnectionDetails): void => {
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
            this.generateEditorConfig(details),
            {
                contexts,
                title: editorHeading,
            },
            {
                createNew: newConnection,
                details,
            },
        );

        this.shellSession.mhs.getMdsBastion(this.liveUpdateFields.profileName, this.liveUpdateFields.bastionId.value)
            .then((summary) => {
                if (summary) {
                    this.updateInputValue(summary.name, "bastionName");
                }
            }).catch(() => {
                this.updateInputValue("<error loading bastion name data>", "bastionName");
            });

        this.shellSession.mhs.getMdsMySQLDbSystem(this.liveUpdateFields.profileName, this.liveUpdateFields.dbSystemId)
            .then((system) => {
                if (system) {
                    this.updateInputValue(system.displayName, "mysqlDbSystemName");
                }
            })
            .catch(() => {
                this.updateInputValue("<error loading database OCI name data>", "mysqlDbSystemName");
            });
    });

    private handleBastionIdChange = (value: string, _dialog: ValueEditDialog, forceUpdate = false): void => {
        if (value !== this.liveUpdateFields.bastionId.value || forceUpdate) {
            this.liveUpdateFields.bastionId.value = value;
            this.beginValueUpdating("Loading...", "bastionName");

            this.shellSession.mhs.getMdsBastion(this.liveUpdateFields.profileName, value).then((summary) => {
                if (summary) {
                    this.updateInputValue(summary.name, "bastionName");
                }
            }).catch((reason) => {
                this.updateInputValue(reason as string, "bastionName");
            });
        }
    };

    private handleDbSystemIdChange = (value: string, _dialog: ValueEditDialog, forceUpdate = false): void => {
        if (value !== this.liveUpdateFields.dbSystemId || forceUpdate) {
            this.liveUpdateFields.dbSystemId = value;
            this.beginValueUpdating("Loading...", "mysqlDbSystemName");

            this.shellSession.mhs.getMdsMySQLDbSystem(this.liveUpdateFields.profileName, value).then((system) => {
                if (system) {
                    this.updateInputValue(system.displayName, "mysqlDbSystemName");
                }
            }).catch((reason) => {
                const message = reason instanceof Error ? reason.message : String(reason);
                void ui.showErrorNotification("Get MHS Database Error: " + message);
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
            }).catch((reason) => {
                const message = reason instanceof Error ? reason.message : String(reason);
                void ui.showErrorNotification("Error when loading OCI profiles: " + message);
            });
        }
    };

    private async createBastion(): Promise<IBastionSummary | undefined> {
        try {
            const summary = await this.shellSession.mhs.createBastion(this.liveUpdateFields.profileName,
                this.liveUpdateFields.dbSystemId, true);

            return summary;
        } catch (reason) {
            const message = reason instanceof Error ? reason.message : String(reason);
            void ui.showErrorNotification("Create Bastion Error: " + message);
            this.updateInputValue("<failed to create default bastion>", "bastionName");
            this.editorRef.current?.updateInputValue("<failed to create default bastion>", "bastionId");

            throw reason;
        }
    }

    private parseConnectionAttributes(value: { [key: string]: string; }): IDictionary[] {
        return Object.entries(value).map((entry) => {
            return { key: entry[0], value: entry[1] };
        });
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

    private confirmBastionCreation = (connection?: IConnectionDetails): void => {
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
                { connection },
            );
        }

    };

    private handleCreateNewBastion = (closure: DialogResponseClosure, values?: IDictionary): void => {
        if (closure === DialogResponseClosure.Accept && values) {
            const details = values.connection as IConnectionDetails;
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
                this.generateEditorConfig(details),
                {
                    contexts,
                    title: editorHeading,
                },
                {
                    createNew: !(details.id > 0),
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
                    if (system) {
                        this.updateInputValue(system.displayName, "mysqlDbSystemName");
                    }
                })
                .catch(() => {
                    this.editorRef.current?.updateInputValue("<error loading database OCI name data>",
                        "mysqlDbSystemName");
                });
        }
    };

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
