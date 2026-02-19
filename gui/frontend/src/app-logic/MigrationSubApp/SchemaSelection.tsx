/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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

import { Component } from "preact";

import { IMigrationFilters, ISchemaSelectionData } from "../../communication/ProtocolMigration.js";
import { CheckState } from "../../components/ui/Checkbox/Checkbox.js";
import { Toggle } from "../../components/ui/Toggle/Toggle.js";
import { MigrationFilterInfo } from "./MigrationFilterInfo.js";
import { SchemaFilterGrid } from "./SchemaFilterGrid.js";
import { UserFilterGrid } from "./UserFilterGrid.js";

interface ISchemaSelectionProps {
    data: ISchemaSelectionData;
    filterInfo: MigrationFilterInfo;
}

export class SchemaSelection extends Component<ISchemaSelectionProps> {
    public render() {
        const { data, filterInfo } = this.props;

        return (
            <div>
                <p>
                    By default, all schemas and their objects will be migrated to the target MySQL HeatWave DB System,
                    except for system schemas and system user accounts.
                </p>

                <div className="option-group-vbox">
                    <div>
                        <Toggle
                            id="migrateAllObjectsToggle"
                            caption="Migrate All Objects"
                            checkState={filterInfo.migrateAllObjects ? CheckState.Checked : CheckState.Unchecked}
                            onChange={this.onMigrateAllObjectsChange} />

                        {!filterInfo.migrateAllObjects && <div>
                            <p className="comment">To exclude schemas from being migrated, uncheck them in the grid
                                below. You may also exclude all objects of a type or individual objects.</p>
                            <p>Note: excluding objects that are dependencies of objects being migrated will
                                result in a failed migration.</p>

                            <SchemaFilterGrid
                                schemas={data.contents.schemas}
                                filterInfo={filterInfo}
                                onObjectTypeToggle={this.onObjectTypeToggle}
                                onSchemaToggle={this.onSchemaToggle}
                                onFilterInfoChange={this.onFilterInfoChange} />
                        </div>}
                    </div>
                    <div>
                        <Toggle
                            id="migrateAllUsersToggle"
                            caption="Migrate All User Accounts"
                            checkState={filterInfo.migrateAllUsers ? CheckState.Checked : CheckState.Unchecked}
                            onChange={this.onMigrateAllUsersChange} />

                        {!filterInfo.migrateAllUsers && (
                            <div>
                                <UserFilterGrid
                                    accounts={data.contents.accounts.map((account) => {
                                        const isIncluded = filterInfo.isAccountIncluded(account);

                                        return {
                                            caption: account,
                                            isIncluded,
                                            onToggle: this.onAccountToggle.bind(this, account, isIncluded),
                                        };
                                    })}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    private onMigrateAllObjectsChange = (e: InputEvent, checkState: CheckState) => {
        const { filterInfo } = this.props;

        filterInfo.migrateAllObjects = !filterInfo.migrateAllObjects;

        this.onFilterInfoChange();
    };

    private onMigrateAllUsersChange = (e: InputEvent, checkState: CheckState) => {
        const { filterInfo } = this.props;

        filterInfo.migrateAllUsers = !filterInfo.migrateAllUsers;

        this.onFilterInfoChange();
    };

    private onAccountToggle = (account: string, isIncluded: boolean) => {
        const { filterInfo } = this.props;
        filterInfo.setAccountIncluded(account, !isIncluded);
        this.onFilterInfoChange();
    };

    private onObjectTypeToggle = (objectType: keyof IMigrationFilters, enable: boolean) => {
        const { filterInfo } = this.props;
        filterInfo.setObjectTypeIncluded(objectType, enable);
        this.onFilterInfoChange();
    };

    private onSchemaToggle = (schemaName: string, include: boolean) => {
        const { filterInfo } = this.props;
        filterInfo.setSchemaIncluded(schemaName, include);
        this.onFilterInfoChange();
    };

    private onFilterInfoChange = () => {
        // Force a re-render when filter info changes
        this.forceUpdate();
    };
}
