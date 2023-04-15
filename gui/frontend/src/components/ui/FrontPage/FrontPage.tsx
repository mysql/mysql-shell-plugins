/*
 * Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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

import "./FrontPage.css";
import closeButton from "../../../assets/images/close2.svg";

import { ComponentChild } from "preact";

import { appParameters, IMrsDbObjectEditRequest, requisitions } from "../../../supplement/Requisitions";
import { IComponentProperties, ComponentBase } from "../Component/ComponentBase";
import { Container, Orientation, ContentAlignment, ContentWrap } from "../Container/Container";
import { Icon } from "../Icon/Icon";
import { Label, TextAlignment } from "../Label/Label";
import { Button } from "../Button/Button";
import { DBEditorModuleId } from "../../../modules/ModuleInfo";
import { ShellInterfaceSqlEditor } from "../../../supplement/ShellInterface/ShellInterfaceSqlEditor";
import { ShellInterface } from "../../../supplement/ShellInterface/ShellInterface";
import { uuid } from "../../../utilities/helpers";
import { webSession } from "../../../supplement/WebSession";

interface IFrontPageProperties extends IComponentProperties {
    showGreeting: boolean;
    caption: string;
    description: string;
    helpUrls: Map<string, string>;
    logo?: Icon;

    onCloseGreeting: () => void;
}

export class FrontPage extends ComponentBase<IFrontPageProperties> {

    public constructor(props: IFrontPageProperties) {
        super(props);

        this.state = {
            showGreeting: props.showGreeting,
        };
    }

    public render(): ComponentChild {
        const { showGreeting, caption, description, helpUrls, children, logo } = this.mergedProps;

        const className = this.getEffectiveClassNames([
            "frontPage",
            this.classFromProperty(appParameters.get("module"), "embedded"),
        ]);

        const links = [];
        for (const url of helpUrls) {
            links.push(<a
                key={url[0]}
                href={url[1]}
                tabIndex={0}
                target="_blank"
                rel="noopener noreferrer"
                onClick={this.handleHelpClick}
            >
                {url[0]}
            </a>);
        }

        return (
            <Container
                orientation={Orientation.TopDown}
                className={className}
            >
                {showGreeting &&
                    <>
                        {logo}
                        <Label
                            id="title"
                            textAlignment={TextAlignment.Center}
                        >
                            {caption}
                        </Label>
                        <Label
                            id="description"
                            textAlignment={TextAlignment.Center}
                        >
                            {description}
                        </Label>
                        <Container
                            id="linksHost"
                            orientation={Orientation.LeftToRight}
                            mainAlignment={ContentAlignment.Center}
                            wrap={ContentWrap.Wrap}
                        >
                            {links}
                        </Container>
                        <Button
                            round
                            id="closeButton"
                            data-tooltip="Close Greeting"
                            onClick={this.handleCloseClick}
                        >
                            <Icon src={closeButton} data-tooltip="inherit" />
                        </Button>
                    </>
                }

                <Container
                    orientation={Orientation.TopDown}
                >
                    {children}
                </Container>
            </Container >
        );
    }

    private handleCloseClick = (): void => {
        const { onCloseGreeting } = this.props;

        onCloseGreeting();
    };

    private handleHelpClick = (e: MouseEvent | KeyboardEvent): void => {
        //const url = (e.target as Element).attributes[0].value;
        const embedded = appParameters.get("module");
        if (embedded) {
            e.stopPropagation();
            e.preventDefault();

            // TODO: open the web page in the systems standard browser.
            // sendOutboundMessage({ source: "app", command: "openWebPage", data: url });
        } else {
            e.stopPropagation();
            e.preventDefault();

            // void this.openMrsDbObjectDlg();
        }
    };

    private openMrsDbObjectDlg = async (): Promise<void> => {
        // Get Connection list
        const connections = await ShellInterface.dbConnections.listDbConnections(webSession.currentProfileId, "");
        if (connections.length > 0) {
            // Use first connection
            const connection = connections[0];

            // Create new ShellInterfaceSqlEditor
            const backend = new ShellInterfaceSqlEditor();
            await backend.startSession(String(connection.id));

            try {
                // Open Connection
                const requestId = uuid();
                await backend.openConnection(connection.id, requestId);

                // Get first MRS DBObject
                const schemas = await backend.mrs.listSchemas();
                if (schemas.length > 0) {
                    const dbObjects = await backend.mrs.listDbObjects(schemas[0].id);
                    if (dbObjects?.length > 0) {
                        const dbObject = dbObjects[0];
                        const data: IMrsDbObjectEditRequest = {
                            dbObject: {
                                authStoredProcedure: "",
                                autoDetectMediaType: 0,
                                changedAt: "2023-04-05 17:30:15",
                                comments: "",
                                crudOperationFormat: dbObject.crudOperationFormat,
                                crudOperations: dbObject.crudOperations,
                                requiresAuth: 1,
                                rowUserOwnershipColumn: undefined,
                                rowUserOwnershipEnforced: 0,
                                dbSchemaId: dbObject.dbSchemaId,
                                enabled: 1,
                                hostCtx: dbObject.hostCtx,
                                id: dbObject.id,
                                itemsPerPage: 25,
                                mediaType: undefined,
                                name: dbObject.name,
                                objectType: dbObject.objectType,
                                options: undefined,
                                qualifiedName: dbObject.qualifiedName,
                                requestPath: dbObject.requestPath,
                                schemaRequestPath: dbObject.schemaRequestPath,
                                serviceId: dbObject.serviceId,
                            },
                            createObject: false,
                        };

                        void requisitions.execute("job", [
                            { requestType: "showModule", parameter: DBEditorModuleId },
                            {
                                requestType: "showPage",
                                parameter: { module: DBEditorModuleId, page: String(connection.id) },
                            },
                            { requestType: "showMrsDbObjectDialog", parameter: data },
                        ]);
                    }
                }

            } finally {
                await backend.closeSession();
            }
        }
    };
}
