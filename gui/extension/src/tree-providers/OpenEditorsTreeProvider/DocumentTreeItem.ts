/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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

import {
    OdmEntityType, type LeafDocumentEntry,
} from "../../../../frontend/src/data-models/OpenDocumentDataModel.js";
import { DocumentTreeBaseItem } from "./DocumentTreeBaseItem.js";

export class DocumentTreeItem<T extends LeafDocumentEntry> extends DocumentTreeBaseItem<T> {

    public override contextValue = "editorItem";

    public constructor(dataModelEntry: T) {
        let iconName = "default";

        switch (dataModelEntry.type) {
            case OdmEntityType.Notebook: {
                iconName = "notebook";

                break;
            }

            case OdmEntityType.Script: {
                switch (dataModelEntry.language) {
                    case "sql": {
                        iconName = "scriptSqlite";
                        break;
                    }

                    case "mysql": {
                        iconName = "scriptMysql";
                        break;
                    }

                    case "javascript": {
                        iconName = "scriptJs";
                        break;
                    }

                    case "typescript": {
                        iconName = "scriptTs";
                        break;
                    }

                    case "python": {
                        iconName = "scriptPy";
                        break;
                    }

                    default:
                }

                break;
            }

            case OdmEntityType.AdminPage: {
                switch (dataModelEntry.pageType) {
                    case "serverStatus": {
                        iconName = "adminServerStatus";
                        break;
                    }

                    case "clientConnections": {
                        iconName = "clientConnections";
                        break;
                    }

                    case "performanceDashboard": {
                        iconName = "adminPerformanceDashboard";
                        break;
                    }

                    case "lakehouseNavigator": {
                        iconName = "lakehouseNavigator";

                        break;
                    }

                    default:
                }

                break;
            }

            default:
        }

        super(dataModelEntry, iconName + ".svg", false);

    }

    public updateLabel(simpleView: boolean): void {
        switch (this.dataModelEntry.type) {
            case OdmEntityType.Notebook:
            case OdmEntityType.Script: {
                this.label = simpleView ? this.dataModelEntry.alternativeCaption : this.dataModelEntry.caption;

                break;
            }

            default:
        }
    }
}
