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

import { ui } from "../../app-logic/UILayer.js";
import {
    MySQLConnCompression, MySQLConnectionScheme, MySQLSqlMode, MySQLSslMode, type IMySQLConnectionOptions,
} from "../../communication/MySQL.js";
import {
    CdmEntityType, type ConnectionDataModel, type ICdmConnectionEntry,
} from "../../data-models/ConnectionDataModel.js";
import { requisitions } from "../../supplement/Requisitions.js";
import { ShellInterface } from "../../supplement/ShellInterface/ShellInterface.js";
import { DBType, type IConnectionDetails } from "../../supplement/ShellInterface/index.js";
import { webSession } from "../../supplement/WebSession.js";
import { convertErrorToString } from "../../utilities/helpers.js";
import { SimpleXMLParser2, type ISimpleXMLTag } from "./SimpleXMLParser2.js";

/**
 * A class to handle adding new connections to the connection data model.
 * This class provides methods to import MySQL Workbench connections from an XML string
 * and to handle the addition of new connections to the data model.
 */
export class ConnectionProcessor {
    /**
     * Parses the given XML string and extracts MySQL Workbench connection details.
     * The XML string is expected to be in the format exported by MySQL Workbench.
     * The extracted connection details are then converted into the format used by the
     * connection data model and added to it.
     *
     * @param xmlString The XML string containing MySQL Workbench connection details.
     * @param dataModel The connection data model to which the extracted connections will be added.
     *
     * @returns A promise that resolves when the connections have been imported.
     */
    public static importMySQLWorkbenchConnections = async (xmlString: string,
        dataModel: ConnectionDataModel): Promise<void> => {
        const validSqlModes = Object.values(MySQLSqlMode);

        try {
            const xml = SimpleXMLParser2.parse(xmlString);

            // Validate the XML file.
            if (xml.length === 0) {
                throw new Error("No data found.");
            }

            const root = xml[0];
            if (root.type !== "tag" || root.tagName !== "data") {
                throw new Error("Invalid format.");
            }

            const topValue = root.content[0];
            if (topValue.type !== "tag"
                || topValue.attributes["content-struct-name"] !== "db.mgmt.Connection") {
                throw new Error("No data found.");
            }

            const connections: Array<IConnectionDetails<IMySQLConnectionOptions>> = [];
            const valueList = topValue.content.filter((child) => {
                return child.type === "tag" && child.tagName === "value";
            }) as ISimpleXMLTag[];

            valueList.forEach((xmlConnectionValue) => {
                const details: IConnectionDetails<IMySQLConnectionOptions> = {
                    id: -1,
                    index: -1,
                    dbType: DBType.MySQL,
                    caption: "",
                    description: "",
                    options: {
                        scheme: MySQLConnectionScheme.MySQL,
                        host: "",
                    },
                };

                // The value children of the xml element.
                const childValueList = xmlConnectionValue.content.filter((child) => {
                    return child.type === "tag" && child.tagName === "value";
                }) as ISimpleXMLTag[];

                childValueList.forEach((value) => {
                    switch (value.attributes.key) {
                        case "hostIdentifier": {
                            let description = "";
                            if (value.content.length > 0) {
                                const firstChild = value.content[0];
                                if (firstChild.type === "text") {
                                    description = firstChild.text.trim();
                                }
                            }
                            details.description = description;

                            break;
                        }

                        case "name": {
                            let caption = "";
                            if (value.content.length > 0) {
                                const firstChild = value.content[0];
                                if (firstChild.type === "text") {
                                    caption = firstChild.text.trim();
                                }
                            }
                            details.caption = caption;

                            break;
                        }

                        case "parameterValues": {
                            const parameters = value.content.filter((child) => {
                                return child.type === "tag" && child.tagName === "value";
                            }) as ISimpleXMLTag[];

                            const sshUri: string[] = [];
                            parameters.forEach((parameter) => {
                                const parameterKey = parameter.attributes.key;
                                let parameterValue = "";
                                if (parameter.content.length > 0) {
                                    const firstChild = parameter.content[0];
                                    if (firstChild.type === "text") {
                                        parameterValue = firstChild.text.trim();
                                    }
                                }

                                if (!parameterKey || !parameterValue) {
                                    return;
                                }

                                switch (parameterKey) {
                                    case "SQL_MODE": {
                                        // Extract the list of sql modes and check the individual entries
                                        // for validity.
                                        const modes = parameterValue.split(",");
                                        const validModes = modes.filter((mode) => {
                                            return validSqlModes.includes(mode as MySQLSqlMode);
                                        });

                                        details.options["sql-mode"] = validModes as MySQLSqlMode[];
                                        break;
                                    }

                                    case "hostName": {
                                        details.options.host = parameterValue;
                                        break;
                                    }

                                    case "port": {
                                        details.options.port = parseInt(parameterValue, 10);
                                        break;
                                    }

                                    case "schema": {
                                        details.options.schema = parameterValue;
                                        break;
                                    }

                                    case "serverVersion": {
                                        details.version = parseInt(parameterValue, 10);
                                        break;
                                    }

                                    case "sslCA": {
                                        details.options["ssl-ca"] = parameterValue;
                                        break;
                                    }

                                    case "sslCert": {
                                        details.options["ssl-cert"] = parameterValue;
                                        break;
                                    }

                                    case "sslKey": {
                                        details.options["ssl-key"] = parameterValue;
                                        break;
                                    }

                                    case "sslCipher": {
                                        details.options["ssl-cipher"] = parameterValue;
                                        break;
                                    }

                                    case "useSSL": {
                                        // This parameter is encoded as number which directly corresponds
                                        // to the entries in MySQLSslMode.
                                        const v = parseInt(parameterValue, 10);
                                        details.options["ssl-mode"] =
                                            Object.values(MySQLSslMode)[v] as MySQLSslMode;
                                        break;
                                    }

                                    case "userName": {
                                        details.options.user = parameterValue;
                                        break;
                                    }

                                    case "socket": {
                                        details.options.socket = parameterValue;
                                        break;
                                    }

                                    case "CLIENT_COMPRESS": {
                                        details.options.compression = parameterValue === "1"
                                            ? MySQLConnCompression.Preferred
                                            : MySQLConnCompression.Disabled;
                                        break;
                                    }

                                    case "sshHost": {
                                        sshUri.push(parameterValue);
                                        break;
                                    }

                                    case "sshKeyFile": {
                                        details.options["ssh-identity-file"] = parameterValue;
                                        break;
                                    }

                                    case "sshPassword": {
                                        details.options["ssh-password"] = parameterValue;
                                        break;
                                    }

                                    case "sshUserName": {
                                        sshUri.unshift(parameterValue, "@");
                                        break;
                                    }

                                    // TODO: LDAP and Kerberos.

                                    default:
                                }
                            });

                            if (sshUri.length > 0) {
                                details.options.ssh = sshUri.join("");
                            }

                            break;
                        }

                        default:
                    }
                });

                connections.push(details);
            });

            await this.convertWbConnectionDetails(connections, dataModel);
        } catch (e: unknown) {
            const message = convertErrorToString(e);
            void ui.showErrorMessage(`Could not parse XML file: ${message}`, {});
        }
    };

    /**
     * Takes a connection entry and adds it to the backend and the given data model.
     * If the connection already exists, an error is shown.
     *
     * @param entry The connection entry to add.
     * @param dataModel The connection data model to add the entry to.
     */
    public static async addConnection(entry: ICdmConnectionEntry, dataModel: ConnectionDataModel): Promise<void> {
        const group = await dataModel.groupFromPath(entry.details.folderPath);

        try {
            const connectionDetails = await ShellInterface.dbConnections.addDbConnection(webSession.currentProfileId,
                entry.details, group.folderPath.id);
            entry.details.id = connectionDetails[0];
            await dataModel.addConnectionEntry(entry);

            requisitions.executeRemote("connectionAdded", entry.details);
        } catch (reason) {
            const message = convertErrorToString(reason);
            void requisitions.execute("showError", "Cannot add DB connection: " + message);
        }
    }

    /**
     * Takes a list of imported Workbench connections and creates the actual group and connection entries.
     *
     * @param entries The list of connection details to convert.
     * @param dataModel The connection data model to add the entries to.
     */
    private static async convertWbConnectionDetails(entries: Array<IConnectionDetails<IMySQLConnectionOptions>>,
        dataModel: ConnectionDataModel): Promise<void> {
        // First add a new top level folder for the imported connections. Check existing top level folders to
        // find a suitable name.
        let newFolderName = "Imported Connections";
        const existingGroups = dataModel.roots.filter((entry) => {
            return entry.type === CdmEntityType.ConnectionGroup;
        });

        if (existingGroups.find((entry) => {
            return entry.caption === newFolderName;
        })) {
            // If the folder already exists, append a number to the name.
            let i = 1;
            while (i < 100) {
                const candidate = `${newFolderName} (${i})`;
                if (!existingGroups.find((entry) => {
                    return entry.caption === candidate;
                })) {
                    newFolderName = `${newFolderName} (${i})`;
                    break;
                }
                ++i;
            }
        }

        // Now go over all connection details. Imported connections may have a name with a slash, which is the way
        // they denote grouping in MySQL Workbench. We need to convert that to a folder path.
        // Only a single grouping level is supported.
        for (const details of entries) {
            const path = details.caption.split("/");
            if (path.length > 1) {
                details.folderPath = `/${newFolderName}/${path[0]}`;
                details.caption = path[1].trim();
            } else {
                details.folderPath = `/${newFolderName}`;
                details.caption = path[0].trim();
            }

            const connection = dataModel.createConnectionEntry(details);
            await this.addConnection(connection, dataModel);
        }

        const connectionString = entries.length === 1 ? "connection" : "connections";
        void ui.showInformationMessage(
            `Imported ${entries.length} ${connectionString} from MySQL Workbench.`, {});
    }

}
