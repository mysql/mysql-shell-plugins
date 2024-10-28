/*
 * Copyright (c) 2022, 2024, Oracle and/or its affiliates.
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

import { DialogResponseClosure, IDialogRequest, IDictionary } from "../../../app-logic/general-types.js";
import { ValueDialogBase } from "../../../components/Dialogs/ValueDialogBase.js";
import {
    ValueEditDialog, IDialogValues, IDialogSection, CommonDialogValueOption, IDialogValidations,
} from "../../../components/Dialogs/ValueEditDialog.js";
import { appParameters } from "../../../supplement/Requisitions.js";

export class MdsEndpointDialog extends ValueDialogBase {
    private dialogRef = createRef<ValueEditDialog>();

    public override render(): ComponentChild {
        return (
            <ValueEditDialog
                ref={this.dialogRef}
                id="mdsEndpointDialog"
                onClose={this.handleCloseDialog}
                onValidate={this.validateInput}
            />
        );
    }

    public show(request: IDialogRequest, title: string): void {
        const shapes = request.parameters?.shapes as string[];

        this.dialogRef.current?.show(this.dialogValues(request, shapes),
            { title },
            { shapes });
    }

    public validateInput = (closing: boolean, values: IDialogValues): IDialogValidations => {
        const result: IDialogValidations = {
            messages: {},
            requiredContexts: [],
        };

        const mainSection = values.sections.get("mainSection");
        const featuresSection = values.sections.get("featuresSection");
        if (mainSection && featuresSection) {
            if (closing) {
                if (!mainSection.values.instanceName.value) {
                    result.messages.instanceName = "The instance name must be specified.";
                }

                const cpuCount = mainSection.values.cpuCount.value as number;
                if (cpuCount < 0 || cpuCount > 512) {
                    result.messages.cpuCount = "The number of CPUs must be between 1 and 512.";
                }

                const memorySize = mainSection.values.memorySize.value as number;
                if (memorySize < 0 || memorySize > 1024) {
                    result.messages.memorySize = "The memory size must be between 1 and 1024 GB.";
                }

                if (!mainSection.values.mysqlUserName.value) {
                    result.messages.mysqlUserName = "The MySQL user name must be specified.";
                }

                if (!mainSection.values.mysqlUserPassword.value) {
                    result.messages.mysqlUserPassword = "The MySQL password must be specified.";
                }

                if (!featuresSection.values.portForwarding.value && !featuresSection.values.mrs.value) {
                    result.messages.portForwarding = "At least one feature needs to be selected.";
                }

                if (mainSection.values.sslCertificate.value && !featuresSection.values.mrs.value) {
                    result.messages.sslCertificate = "The MRS feature needs to be enabled.";
                }

                if (!(mainSection.values.domainName.value as string).includes(".")) {
                    result.messages.domainName = "A valid domain name needs at least one dot.";
                }

                if (mainSection.values.domainName.value && !mainSection.values.publicIp.value) {
                    result.messages.domainName = "A public IP needs to be assigned.";
                }

                if (mainSection.values.sslCertificate.value && !mainSection.values.publicIp.value) {
                    result.messages.sslCertificate = "A public IP needs to be assigned.";
                }

                if (mainSection.values.sslCertificate.value && !mainSection.values.domainName.value) {
                    result.messages.sslCertificate = "A domain name needs to be assigned.";
                }

                if (mainSection.values.createDbConnection.value && !featuresSection.values.portForwarding.value) {
                    result.messages.createDbConnection = "The Port Forwarding feature needs to be enabled.";
                }
            }
        }

        return result;
    };

    private dialogValues(request: IDialogRequest, shapes: string[]): IDialogValues {

        let selectedShape = shapes.find((shape) => {
            return request.values?.shapeName === shape;
        });

        if (shapes.length > 0 && !selectedShape) {
            selectedShape = shapes[0];
        }

        const mainSection: IDialogSection = {
            caption: "",
            values: {
                instanceName: {
                    type: "text",
                    caption: "Compute Instance Name:",
                    description: "The name of the compute instance.",
                    value: request.values?.instanceName as string,
                    horizontalSpan: 3,
                    options: [CommonDialogValueOption.AutoFocus],
                },
                shapeName: {
                    type: "choice",
                    caption: "Compute Shape",
                    description: "The shape of the compute instance to use.",
                    value: selectedShape,
                    choices: shapes,
                    horizontalSpan: 3,
                },
                cpuCount: {
                    type: "number",
                    caption: "OCPUs ",
                    description: "Number of OCPUs.",
                    value: request.values?.cpuCount as number,
                    horizontalSpan: 1,
                },
                memorySize: {
                    type: "number",
                    caption: "Memory",
                    description: "Memory Size (in GB).",
                    value: request.values?.memorySize as number,
                    horizontalSpan: 1,
                },
                mysqlUserName: {
                    type: "text",
                    caption: "MySQL User Name",
                    description: "Used for bootstrapping.",
                    value: request.values?.mysqlUserName as string,
                    horizontalSpan: 3,
                },
                mysqlUserPassword: {
                    type: "text",
                    caption: "MySQL Password",
                    description: "Used for bootstrapping.",
                    value: request.values?.mysqlUserPassword as string,
                    horizontalSpan: 2,
                    obfuscated: true,
                },
                createDbConnection: {
                    type: "boolean",
                    caption: appParameters.embedded ? "MySQL Shell GUI" : "MySQL Shell Workbench",
                    label: "Create DB Connection",
                    description: "Create a DB Connection using this endpoint.",
                    value: true,
                    horizontalSpan: 3,
                },
                domainName: {
                    type: "text",
                    caption: "Domain Name",
                    description: "NOTE: The corresponding DNS A record needs to be created manually.",
                    value: "",
                    horizontalSpan: 3,
                },
                publicIp: {
                    type: "boolean",
                    caption: "Public IP",
                    label: "Assign Public IP",
                    description: "Assign a public IP Address.",
                    value: true,
                    horizontalSpan: 2,
                },
                sslCertificate: {
                    type: "boolean",
                    caption: "SSL Certificate",
                    label: "Create SSL Certificate",
                    description: "Create a SSL certificate for this instance. ",
                    value: true,
                    horizontalSpan: 3,
                },
            },
        };

        const featuresSection: IDialogSection = {
            caption: "Features",
            groupName: "features",
            values: {
                portForwarding: {
                    type: "boolean",
                    caption: "MySQL Port Forwarding",
                    description: "Enable MySQL TCP port forwarding on the public endpoint.",
                    value: true,
                    horizontalSpan: 4,
                    options: [CommonDialogValueOption.Grouped],
                },
                mrs: {
                    type: "boolean",
                    caption: "MySQL REST Service",
                    description: "Enable the MySQL REST Service and serve MRS REST endpoints.",
                    value: true,
                    horizontalSpan: 4,
                    options: [CommonDialogValueOption.Grouped],
                },
            },
        };

        const mrsSection: IDialogSection = {
            caption: "MySQL REST Service Settings",
            groupName: "features",
            values: {
                jwtSecret: {
                    type: "text",
                    caption: "MRS JWT Secret:",
                    description: "The same secret needs to be used on all instances.",
                    value: "",
                    horizontalSpan: 4,
                },
            },
        };

        return {
            id: "mainSection",
            sections: new Map<string, IDialogSection>([
                ["mainSection", mainSection],
                ["featuresSection", featuresSection],
                ["mrsSection", mrsSection],
            ]),
        };
    }

    private handleCloseDialog = (closure: DialogResponseClosure, dialogValues: IDialogValues,
        data?: IDictionary): void => {
        const { onClose } = this.props;

        if (closure === DialogResponseClosure.Accept && data) {
            const mainSection = dialogValues.sections.get("mainSection");
            const featuresSection = dialogValues.sections.get("featuresSection");
            const mrsSection = dialogValues.sections.get("mrsSection");
            if (mainSection && featuresSection && mrsSection) {
                const values: IDictionary = {};
                values.instanceName = mainSection.values.instanceName.value as string;
                values.shapeName = mainSection.values.shapeName.value as string;
                values.cpuCount = mainSection.values.cpuCount.value as number;
                values.memorySize = mainSection.values.memorySize.value as number;

                values.mysqlUserName = mainSection.values.mysqlUserName.value as string;
                values.mysqlUserPassword = mainSection.values.mysqlUserPassword.value as string;
                values.createDbConnection = mainSection.values.createDbConnection.value as boolean;

                values.publicIp = mainSection.values.publicIp.value as boolean;
                values.domainName = mainSection.values.domainName.value as string;
                values.sslCertificate = mainSection.values.sslCertificate.value as boolean;

                values.portForwarding = featuresSection.values.portForwarding.value as boolean;
                values.mrs = featuresSection.values.mrs.value as boolean;


                values.jwtSecret = mrsSection.values.jwtSecret.value as string;

                onClose(closure, values);
            }
        } else {
            onClose(closure);
        }
    };
}
