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

import { ComponentChild, createRef, render } from "preact";
import { CellComponent, ColumnDefinition, RowComponent } from "tabulator-tables";
import {
    ComponentBase, ComponentPlacement, IComponentProperties, IComponentState, SelectionType,
} from "../../components/ui/Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../../components/ui/Container/Container.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import { Button } from "../../components/ui/Button/Button.js";
import { Codicon } from "../../components/ui/Codicon.js";
import { Toolbar } from "../../components/ui/Toolbar/Toolbar.js";
import { Label } from "../../components/ui/Label/Label.js";
import { Menu } from "../../components/ui/Menu/Menu.js";
import { IMenuItemProperties, MenuItem } from "../../components/ui/Menu/MenuItem.js";
import { Input, type IInputChangeProperties } from "../../components/ui/Input/Input.js";
import { Dialog } from "../../components/ui/Dialog/Dialog.js";
import { ISearchValues, Search } from "../../components/ui/Search/Search.js";
import { ITreeGridOptions, SetDataAction, TreeGrid } from "../../components/ui/TreeGrid/TreeGrid.js";
import { IValueEditCustomProperties, ValueEditCustom } from "../../components/Dialogs/ValueEditCustom.js";
import {
    CommonDialogValueOption,
    IDialogSection,
    IDialogValidations,
    IDialogValues,
    ValueEditDialog
} from "../../components/Dialogs/ValueEditDialog.js";
import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { Assets } from "../../supplement/Assets.js";
import { requisitions } from "../../supplement/Requisitions.js";
import { IToolbarItems } from "./index.js";
import {
    IMySQLGlobalPrivilegeCatalogItem,
    IMySQLObjectPrivilegeSchemaTarget,
    IObjectPrivilegeTarget,
    IMySQLUser,
    IMySQLDefaultUserOptions,
    IMySQLUserListItem,
} from "../../communication/ProtocolGui.js";
import { convertErrorToString } from "../../utilities/helpers.js";
import { ui } from "../../app-logic/UILayer.js";
import { DialogHost } from "../../app-logic/DialogHost.js";
import { DialogResponseClosure, DialogType, IDictionary } from "../../app-logic/general-types.js";
import { PasswordChangeDialog } from "../../components/Dialogs/PasswordChangeDialog.js";
import { CreateUserDialog } from "./CreateUserDialog.js";
import type { Command } from "../../data-models/data-model-types.js";

type UserAccountSorter = Exclude<ColumnDefinition["sorter"], string | undefined>;
type UserAccountTlsMode = "None" | "Required" | "Require Certificate";

interface IUserAccountDialogGeneralSection {
    userName: { value?: string; options?: CommonDialogValueOption[] };
    hostName: { value?: string };
    lockAccount: { value?: boolean };
    comment: { value?: string };
}

interface IUserAccountDialogAuthenticationSection {
    authenticationPlugin: { value?: string; choices?: string[]; options?: CommonDialogValueOption[] };
    passwordExpire: { value?: boolean };
    randomPassword: { value?: boolean };
    password: { value?: string };
    passwordConfirmation: { value?: string };
    passwordExpiration: { value?: number };
    passwordHistory: { value?: number };
    passwordReuseInterval: { value?: number };
    failedPasswordAttempts: { value?: number };
    passwordLockTime: { value?: number };
    lockAccount: { value?: boolean };
}

interface IUserAccountDialogTlsSection {
    tlsMode: { value?: { tlsMode?: UserAccountTlsMode } };
    tlsCipher: { value?: string };
    tlsIssuer: { value?: string };
    tlsSubject: { value?: string };
}

interface IUserAccountDialogResourceLimitsSection {
    maxQueriesPerHour: { value?: number };
    maxConnectionsPerHour: { value?: number };
    maxUpdatesPerHour: { value?: number };
    maxUserConnections: { value?: number };
}

interface IRoleAssignmentEditorData extends IDictionary {
    availableRoles: string[];
    selectedRoles: string[];
    defaultRoles: string[];
}

interface IUserAccountRolesDialogSection {
    roles: { value?: IRoleAssignmentEditorData };
}

interface IGlobalPrivilegeEditorData extends IDictionary {
    catalog: IMySQLGlobalPrivilegeCatalogItem[];
    selectedPrivileges: string[];
    inheritedPrivileges: string[];
}

interface IUserAccountGlobalPrivilegesDialogSection {
    privileges: { value?: IGlobalPrivilegeEditorData };
}

interface IUserAccountObjectPrivilegesDialogSection {
    privileges: { value?: IObjectPrivilegeEditorData };
}

type ObjectPrivilegeTargetKind = "schema" | "table" | "routine" | "column";

const objectPrivilegeSystemSchemas = new Set(["information_schema", "mysql", "performance_schema", "sys"]);

interface IObjectPrivilegeEditorTarget extends IDictionary {
    id: string;
    kind: ObjectPrivilegeTargetKind;
    schema: string;
    table?: string;
    routine?: string;
    routineType?: "FUNCTION" | "PROCEDURE";
    column?: string;
    label: string;
    available: boolean;
    hasChildren?: boolean;
}

type IObjectPrivilegeMaps = Record<ObjectPrivilegeTargetKind, Record<string, string[]>>;

interface IObjectPrivilegeState {
    direct: IObjectPrivilegeMaps;
    inherited: IObjectPrivilegeMaps;
    roleInherited: IObjectPrivilegeMaps;
    restricted: IObjectPrivilegeMaps;
    readonly: IObjectPrivilegeMaps;
    effective: IObjectPrivilegeMaps;
}

type IUserAccountRow = IMySQLUserListItem & {
    objectPrivilegeState?: IObjectPrivilegeState;
};

interface IObjectPrivilegeCatalogs extends Record<ObjectPrivilegeTargetKind, IMySQLGlobalPrivilegeCatalogItem[]> {
    schema: IMySQLGlobalPrivilegeCatalogItem[];
    table: IMySQLGlobalPrivilegeCatalogItem[];
    routine: IMySQLGlobalPrivilegeCatalogItem[];
    column: IMySQLGlobalPrivilegeCatalogItem[];
}

interface IObjectPrivilegeEditorData extends IDictionary {
    catalogs: IObjectPrivilegeCatalogs;
    schemas: string[];
    targets: IObjectPrivilegeEditorTarget[];
    privileges: IObjectPrivilegeMaps;
    originalPrivileges: IObjectPrivilegeMaps;
    directPrivileges: IObjectPrivilegeMaps;
    inheritedPrivileges: IObjectPrivilegeMaps;
    roleInheritedPrivileges: IObjectPrivilegeMaps;
    restrictedPrivileges: IObjectPrivilegeMaps;
    partialRevokePrivileges?: IObjectPrivilegeMaps;
    originalPartialRevokePrivileges?: IObjectPrivilegeMaps;
    readonlyPrivileges: IObjectPrivilegeMaps;
    partialRevokesEnabled: boolean;
    selectedTargetId: string;
    loadSchemaTargets?: (schema: string) => Promise<IObjectPrivilegeTargetLoadResult>;
    loadTableColumns?: (schema: string, table: string) => Promise<IObjectPrivilegeTargetLoadResult>;
}

interface IObjectPrivilegeTargetLoadResult {
    targets: IObjectPrivilegeEditorTarget[];
    privilegeState: IObjectPrivilegeState;
}

interface IUserAccountsProperties extends IComponentProperties {
    backend?: ShellInterfaceSqlEditor;

    /** Top level toolbar items, to be integrated with page specific ones. */
    toolbarItems: IToolbarItems;
}

export interface IUserAccountsState extends IComponentState {
    rows: IMySQLUserListItem[];
    editingAccount: { user: string; host: string; comment?: string | null } | null;
    searchValues: ISearchValues;
    passwordValidationInstalled: boolean;
    partialRevokesEnabled: boolean;
    authenticationPlugins: string[];
    generatedPassword: string;
    generatedPasswordVisible: boolean;
}

interface IDialogSections {
    generalSection?: IUserAccountDialogGeneralSection;
    authenticationSection?: IUserAccountDialogAuthenticationSection;
    tlsSection?: IUserAccountDialogTlsSection;
    resourceLimitsSection?: IUserAccountDialogResourceLimitsSection;
}

interface IManageRolesAndPrivilegesDialogData extends IDictionary {
    user: string;
    host: string;
    initialRoles: string[];
    initialDefaultRoles: string[];
    initialGlobalPrivileges: string[];
}

type ManageRolesAndPrivilegesTab = "roles" | "globalPrivileges" | "objectPrivileges";

interface IUserAccountSummary {
    total: number;
    expiredPasswords: number;
}

type UserAccountSearchCategory = "user" | "host" | "auth" | "role" | "privilege" | "all";

interface IUserAccountSearchTerm {
    category: UserAccountSearchCategory;
    value: string;
}

type UserAccountScopedPrivileges = Record<string, string[]>;

interface IUserAccountScopedPrivilegeSortValue {
    count: number;
    text: string;
}

interface IRoleAssignmentEditorState extends IComponentState {
    query: string;
    sortDirection: "ascending" | "descending";
}

interface IGlobalPrivilegeEditorState extends IComponentState {
    query: string;
    sortColumn: "privilege" | "category";
    sortDirection: "ascending" | "descending";
}

interface IObjectPrivilegeEditorState extends IComponentState {
    privilegeQuery: string;
    privilegeSortDirection: "ascending" | "descending";
    expanded: Record<string, boolean>;
    loadedTargetIds: Record<string, boolean>;
    loadingTargetIds: Record<string, boolean>;
}

interface IUserAccountSqlViewerData {
    statements: string;
}

class UserAccountSqlViewer extends ValueEditCustom<IValueEditCustomProperties, IComponentState> {
    public override render(): ComponentChild {
        const { statements = "" } = this.props.values as unknown as Partial<IUserAccountSqlViewerData>;

        return (
            <Container
                className="userAccountSqlViewer"
                orientation={Orientation.TopDown}
                crossAlignment={ContentAlignment.Stretch}
            >
                <Button
                    id="userAccountSqlCopyButton"
                    className="userAccountSqlCopyButton"
                    data-tooltip="Copy SQL to Clipboard"
                    imageOnly={true}
                    onClick={this.copyStatements}
                >
                    <Icon src={Codicon.Copy} data-tooltip="inherit" />
                </Button>
                <Input
                    id="userAccountSqlOutput"
                    value={statements}
                    multiLine={true}
                    multiLineCount={16}
                    readOnly={true}
                    spellCheck={false}
                    data-tooltip="Copy SQL to Clipboard"
                />
            </Container>
        );
    }

    private copyStatements = (): void => {
        const { statements = "" } = this.props.values as unknown as Partial<IUserAccountSqlViewerData>;
        requisitions.writeToClipboard(statements);
    };
}

class RoleAssignmentEditor extends ValueEditCustom<IValueEditCustomProperties, IRoleAssignmentEditorState> {
    public constructor(props: IValueEditCustomProperties) {
        super(props);

        this.state = {
            query: "",
            sortDirection: "ascending",
        };
    }

    public override render(): ComponentChild {
        const data = this.roleData();
        const selectedRoleSet = new Set(data.selectedRoles);
        const defaultRoleSet = new Set(data.defaultRoles);
        const query = this.state.query.trim().toLocaleLowerCase();
        const availableRoles = data.availableRoles.filter((role) => {
            return !selectedRoleSet.has(role) && (query.length === 0 || role.toLocaleLowerCase().includes(query));
        }).sort((left, right) => {
            const result = left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });

            return this.state.sortDirection === "ascending" ? result : -result;
        });

        return (
            <div className="userAccountRoleEditor">
                <div className="userAccountRoleEditorSection">
                    <Label caption="Assigned roles" />
                    <span className="userAccountRoleDescription">
                        {defaultRoleSet.size} default role{defaultRoleSet.size === 1 ? "" : "s"} will be automatically
                        activated at login.
                    </span>
                    <div className="userAccountAssignedRoles">
                        {data.selectedRoles.length === 0
                            ? <span className="userAccountRoleEmpty">No roles assigned</span>
                            : data.selectedRoles.map((role) => {
                                const isDefaultRole = defaultRoleSet.has(role);

                                return (
                                    <span
                                        className={`userAccountRoleChip${isDefaultRole ? " defaultRole" : ""}`}
                                        key={role}
                                    >
                                        <Button
                                            className="userAccountRoleDefaultToggle"
                                            data-tooltip={`${isDefaultRole ? "Unset" : "Set"} ${role} as default role`}
                                            onClick={() => {
                                                this.toggleDefaultRole(role);
                                            }}
                                        >
                                            <span>{role}</span>
                                        </Button>
                                        <Button
                                            className="userAccountRoleRemoveButton"
                                            data-tooltip={`Remove ${role}`}
                                            imageOnly={true}
                                            onClick={() => {
                                                this.removeRole(role);
                                            }}
                                        >
                                            <Icon src={Codicon.Close} data-tooltip="inherit" />
                                        </Button>
                                    </span>
                                );
                            })}
                    </div>
                    <span className="userAccountRoleDescription">
                        Select assigned roles to set them as default roles for this account.
                    </span>
                </div>
                <div className="userAccountRoleEditorSection">
                    <Label caption="Available roles" />
                    <Input
                        className="userAccountRoleFilter"
                        placeholder="Filter roles"
                        value={this.state.query}
                        onChange={this.handleSearchChange}
                    />
                    <div className="userAccountPrivilegeTable userAccountRoleTable">
                        <div className="userAccountPrivilegeRow header">
                            {this.renderSortHeader()}
                            <span />
                        </div>
                        {availableRoles.length === 0
                            ? <span className="userAccountRoleEmpty">No matching roles</span>
                            : availableRoles.map((role) => {
                                return (
                                    <Button
                                        className="userAccountPrivilegeRow userAccountRoleResult"
                                        data-tooltip={`Add ${role}`}
                                        key={role}
                                        onClick={() => {
                                            this.addRole(role);
                                        }}
                                    >
                                        <span>{role}</span>
                                        <Icon src={Codicon.Add} data-tooltip="inherit" />
                                    </Button>
                                );
                            })}
                    </div>
                </div>
            </div>
        );
    }

    private roleData(): IRoleAssignmentEditorData {
        const data = this.props.values as Partial<IRoleAssignmentEditorData> | undefined;

        return {
            availableRoles: data?.availableRoles ?? [],
            selectedRoles: data?.selectedRoles ?? [],
            defaultRoles: data?.defaultRoles ?? [],
        };
    }

    private handleSearchChange = (_e: InputEvent, props: IInputChangeProperties): void => {
        this.setState({ query: props.value });
    };

    private renderSortHeader(): ComponentChild {
        const ascending = this.state.sortDirection === "ascending";

        return (
            <span className="userAccountPrivilegeSortHeader">
                <Button
                    className="userAccountPrivilegeSortButton active"
                    data-tooltip={`Sort roles ${ascending ? "descending" : "ascending"}`}
                    onClick={() => {
                        this.setState({ sortDirection: ascending ? "descending" : "ascending" });
                    }}
                >
                    <span>Roles</span>
                    <Icon
                        className="userAccountPrivilegeSortIcon"
                        src={ascending ? Codicon.ArrowUp : Codicon.ArrowDown}
                        data-tooltip="inherit"
                    />
                </Button>
            </span>
        );
    }

    private addRole(role: string): void {
        const data = this.roleData();
        const selectedRoles = [...new Set([...data.selectedRoles, role])].sort((left, right) => {
            return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
        });

        this.props.onDataChange?.({ ...data, selectedRoles });
    }

    private removeRole(role: string): void {
        const data = this.roleData();
        const selectedRoles = data.selectedRoles.filter((currentRole) => {
            return currentRole !== role;
        });
        const defaultRoles = data.defaultRoles.filter((currentRole) => {
            return currentRole !== role;
        });

        this.props.onDataChange?.({ ...data, selectedRoles, defaultRoles });
    }

    private toggleDefaultRole(role: string): void {
        const data = this.roleData();
        const defaultRoleSet = new Set(data.defaultRoles);

        if (defaultRoleSet.has(role)) {
            defaultRoleSet.delete(role);
        } else {
            defaultRoleSet.add(role);
        }

        const selectedRoleSet = new Set(data.selectedRoles);
        const defaultRoles = [...defaultRoleSet].filter((currentRole) => {
            return selectedRoleSet.has(currentRole);
        }).sort((left, right) => {
            return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
        });

        this.props.onDataChange?.({ ...data, defaultRoles });
    }
}

class GlobalPrivilegeEditor extends ValueEditCustom<IValueEditCustomProperties, IGlobalPrivilegeEditorState> {
    public constructor(props: IValueEditCustomProperties) {
        super(props);

        this.state = {
            query: "",
            sortColumn: "privilege",
            sortDirection: "ascending",
        };
    }

    public override render(): ComponentChild {
        const data = this.privilegeData();
        const inheritedPrivilegeSet = new Set(data.inheritedPrivileges);
        const availablePrivileges = this.availablePrivileges();

        return (
            <div className="userAccountPrivilegeEditor">
                <div className="userAccountPrivilegeEditorSection">
                    <Label caption="Assigned privileges" />
                    <div className="userAccountAssignedPrivileges">
                        {data.selectedPrivileges.length === 0
                            ? <span className="userAccountPrivilegeEmpty">No privileges assigned</span>
                            : data.selectedPrivileges.map((privilege) => {
                                return (
                                    <span className="userAccountPrivilegeChip" key={privilege}>
                                        <span className="userAccountPrivilegeName">
                                            <span>{privilege}</span>
                                        </span>
                                        <Button
                                            className="userAccountPrivilegeRemoveButton"
                                            data-tooltip={`Remove ${privilege}`}
                                            imageOnly={true}
                                            onClick={() => {
                                                this.removePrivilege(privilege);
                                            }}
                                        >
                                            <Icon src={Codicon.Close} data-tooltip="inherit" />
                                        </Button>
                                    </span>
                                );
                            })}
                    </div>
                </div>
                <div className="userAccountPrivilegeEditorSection">
                    <Label caption="Available privileges" />
                    <Input
                        className="userAccountPrivilegeFilter"
                        placeholder="Filter privileges"
                        value={this.state.query}
                        onChange={this.handleSearchChange}
                    />
                    <div className="userAccountPrivilegeTable userAccountGlobalPrivilegeTable">
                        <div className="userAccountPrivilegeRow header">
                            {this.renderSortHeader("Privilege", "privilege")}
                            {this.renderSortHeader("Category", "category")}
                            <span />
                        </div>
                        {availablePrivileges.length === 0
                            ? <div className="userAccountPrivilegeEmpty">No matching privileges</div>
                            : availablePrivileges.map((entry) => {
                                return (
                                    <Button
                                        className="userAccountPrivilegeRow userAccountPrivilegeResult"
                                        data-tooltip={`Add ${entry.privilege}`}
                                        key={entry.privilege}
                                        onClick={() => {
                                            this.addPrivilege(entry.privilege);
                                        }}
                                    >
                                        <span className="userAccountPrivilegeName">
                                            <span>{entry.privilege}</span>
                                            {inheritedPrivilegeSet.has(entry.privilege) &&
                                                <span className="userAccountPrivilegeInheritedPill">INHERITED</span>}
                                        </span>
                                        <span>{this.formatCategory(entry.category)}</span>
                                        <Icon src={Codicon.Add} data-tooltip="inherit" />
                                    </Button>
                                );
                            })}
                    </div>
                </div>
            </div>
        );
    }

    private privilegeData(): IGlobalPrivilegeEditorData {
        return (this.props.values as IGlobalPrivilegeEditorData | undefined) ?? {
            catalog: [],
            selectedPrivileges: [],
            inheritedPrivileges: [],
        };
    }

    private availablePrivileges(): IMySQLGlobalPrivilegeCatalogItem[] {
        const query = this.state.query.trim().toLocaleLowerCase();
        const data = this.privilegeData();
        const selectedPrivilegeSet = new Set(data.selectedPrivileges);

        return data.catalog.filter((entry) => {
            return !selectedPrivilegeSet.has(entry.privilege)
                && (query.length === 0 || entry.privilege.toLocaleLowerCase().includes(query));
        }).sort((left, right) => {
            const leftValue = this.state.sortColumn === "privilege"
                ? left.privilege
                : this.formatCategory(left.category);
            const rightValue = this.state.sortColumn === "privilege"
                ? right.privilege
                : this.formatCategory(right.category);
            const result = leftValue.localeCompare(rightValue, undefined, { sensitivity: "base", numeric: true });

            return this.state.sortDirection === "ascending" ? result : -result;
        });
    }

    private handleSearchChange = (_e: InputEvent, props: IInputChangeProperties): void => {
        this.setState({ query: props.value });
    };

    private renderSortHeader(label: string, sortColumn: IGlobalPrivilegeEditorState["sortColumn"]): ComponentChild {
        const active = this.state.sortColumn === sortColumn;
        const ascending = this.state.sortDirection === "ascending";

        return (
            <span className="userAccountPrivilegeSortHeader">
                <Button
                    className={`userAccountPrivilegeSortButton${active ? " active" : ""}`}
                    data-tooltip={`Sort by ${label.toLocaleLowerCase()} ${active && ascending
                        ? "descending"
                        : "ascending"}`}
                    onClick={() => {
                        this.toggleSort(sortColumn);
                    }}
                >
                    <span>{label}</span>
                    <Icon
                        className="userAccountPrivilegeSortIcon"
                        src={active && !ascending ? Codicon.ArrowDown : Codicon.ArrowUp}
                        data-tooltip="inherit"
                    />
                </Button>
            </span>
        );
    }

    private formatCategory(category: string): string {
        return category.split(",").map((item) => {
            return item.trim();
        }).join(", ");
    }

    private toggleSort(sortColumn: IGlobalPrivilegeEditorState["sortColumn"]): void {
        this.setState((state) => {
            return {
                sortColumn,
                sortDirection: state.sortColumn === sortColumn && state.sortDirection === "ascending"
                    ? "descending"
                    : "ascending",
            };
        });
    }

    private addPrivilege(privilege: string): void {
        this.updateSelectedPrivileges((selectedPrivilegeSet) => {
            selectedPrivilegeSet.add(privilege);
        });
    }

    private removePrivilege(privilege: string): void {
        this.updateSelectedPrivileges((selectedPrivilegeSet) => {
            selectedPrivilegeSet.delete(privilege);
        });
    };

    private updateSelectedPrivileges(update: (selectedPrivilegeSet: Set<string>) => void): void {
        const data = this.privilegeData();
        const selectedPrivilegeSet = new Set(data.selectedPrivileges);
        update(selectedPrivilegeSet);
        const selectedPrivileges = [...selectedPrivilegeSet].sort((left, right) => {
            return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
        });

        this.props.onDataChange?.({ ...data, selectedPrivileges });
    }

}

class ObjectPrivilegeEditor extends ValueEditCustom<IValueEditCustomProperties, IObjectPrivilegeEditorState> {
    public constructor(props: IValueEditCustomProperties) {
        super(props);

        this.state = {
            privilegeQuery: "",
            privilegeSortDirection: "ascending",
            expanded: {},
            loadedTargetIds: {},
            loadingTargetIds: {},
        };
    }

    public override render(): ComponentChild {
        const data = this.privilegeData();
        const selectedTarget = this.selectedTarget(data);
        const selectedPrivileges = selectedTarget ? this.targetPrivileges(data, selectedTarget) : [];
        const inheritedPrivilegeSet = selectedTarget
            ? new Set(this.inheritedPrivileges(data, selectedTarget))
            : new Set();
        const partialRevokePrivilegeSet = selectedTarget
            ? new Set(this.partialRevokePrivileges(data, selectedTarget))
            : new Set();
        const readonlyPrivilegeSet = selectedTarget ?
            new Set(this.readonlyPrivileges(data, selectedTarget)) : new Set();
        const availablePrivileges = this.availablePrivileges(data, selectedTarget);

        if (data.schemas.length === 0) {
            return (
                <div className="userAccountPrivilegeEditor">
                    <div className="userAccountPrivilegeEmpty">No schemas available</div>
                </div>
            );
        }

        return (
            <div className="userAccountObjectPrivilegeEditor">
                <span className="userAccountPrivilegeCount">
                    {this.objectSummary(data.privileges)}
                </span>
                <div className="userAccountObjectPrivilegeBody">
                    <div className="userAccountObjectTree">
                        {this.renderObjectTree(data)}
                    </div>
                    <div className="userAccountObjectPrivilegePanel">
                        <div className="userAccountObjectPrivilegeHeader">
                            <div className="userAccountObjectPrivilegeTitle">
                                {selectedTarget &&
                                    <Icon
                                        className="userAccountObjectPrivilegeTitleIcon"
                                        src={this.objectTargetIcon(selectedTarget)}
                                        color="currentColor"
                                        data-tooltip="inherit"
                                    />}
                                <div className="userAccountObjectPrivilegeTitleText">
                                    <Label caption={selectedTarget?.label ?? "No object selected"} />
                                    {selectedTarget && !selectedTarget.available &&
                                        <span className="userAccountObjectUnavailable">
                                            Currently granted, unavailable
                                        </span>}
                                </div>
                            </div>
                        </div>
                        <div className="userAccountPrivilegeEditorSection">
                            <Label caption="Assigned privileges" />
                            <div className="userAccountAssignedPrivileges">
                                {!selectedTarget
                                    ? <span className="userAccountPrivilegeEmpty">Select an object</span>
                                    : selectedPrivileges.length === 0
                                        ? <span className="userAccountPrivilegeEmpty">No privileges assigned</span>
                                        : selectedPrivileges.map((privilege) => {
                                            const readonly = readonlyPrivilegeSet.has(privilege);

                                            return (
                                                <span className="userAccountPrivilegeChip" key={privilege}>
                                                    <span className="userAccountPrivilegeName">
                                                        <span>{privilege}</span>
                                                    </span>
                                                    <Button
                                                        className="userAccountPrivilegeRemoveButton"
                                                        data-tooltip={readonly
                                                            ? "Inherited global privileges can be restricted only at" +
                                                                " schema scope." : `Remove ${privilege}`}
                                                        disabled={readonly}
                                                        imageOnly={true}
                                                        onClick={() => {
                                                            this.removePrivilege(privilege);
                                                        }}
                                                    >
                                                        <Icon src={Codicon.Close} data-tooltip="inherit" />
                                                    </Button>
                                                </span>
                                            );
                                        })}
                            </div>
                        </div>
                        <div className="userAccountPrivilegeEditorSection">
                            <Label caption="Available privileges" />
                            <Input
                                className="userAccountPrivilegeFilter"
                                placeholder="Filter privileges"
                                value={this.state.privilegeQuery}
                                onChange={this.handlePrivilegeSearchChange}
                            />
                            {data.partialRevokesEnabled &&
                                <span className="userAccountPartialRevokeDescription">
                                    Inherited global privileges can be partially revoked.
                                </span>}
                            <div className="userAccountPrivilegeTable userAccountObjectPrivilegeTable">
                                <div className="userAccountPrivilegeRow header">
                                    {this.renderPrivilegeSortHeader()}
                                    <span />
                                </div>
                                {!selectedTarget
                                    ? <div className="userAccountPrivilegeEmpty">Select an object</div>
                                    : availablePrivileges.length === 0
                                        ? <div className="userAccountPrivilegeEmpty">No matching privileges</div>
                                        : availablePrivileges.map((entry) => {
                                            const editable = selectedTarget.available;

                                            return (
                                                <Button
                                                    className="userAccountPrivilegeRow userAccountPrivilegeResult"
                                                    data-tooltip={!editable
                                                        ? "This unavailable object cannot be granted new privileges."
                                                        : `Add ${entry.privilege}`}
                                                    disabled={!editable}
                                                    key={entry.privilege}
                                                    onClick={() => {
                                                        this.addPrivilege(entry.privilege);
                                                    }}
                                                >
                                                    <span className="userAccountPrivilegeName">
                                                        <span>{entry.privilege}</span>
                                                        {inheritedPrivilegeSet.has(entry.privilege) &&
                                                            <span className="userAccountPrivilegeInheritedPill">
                                                                <span>INHERITED</span>
                                                                {data.partialRevokesEnabled
                                                                    && selectedTarget.kind === "schema"
                                                                    && partialRevokePrivilegeSet.has(entry.privilege) &&
                                                                    <Button
                                                                        className="userAccountInheritedRemoveButton"
                                                                        data-tooltip={
                                                                            `Revoke ${entry.privilege}`
                                                                        }
                                                                        imageOnly={true}
                                                                        onClick={() => {
                                                                            this.revokeInheritedPrivilege(
                                                                                entry.privilege,
                                                                            );
                                                                        }}
                                                                    >
                                                                        <Icon src={Codicon.Close}
                                                                            data-tooltip="inherit" />
                                                                    </Button>}
                                                            </span>}
                                                    </span>
                                                    <Icon src={Codicon.Add} data-tooltip="inherit" />
                                                </Button>
                                            );
                                        })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    private privilegeData(): IObjectPrivilegeEditorData {
        const data = this.props.values as Partial<IObjectPrivilegeEditorData> | undefined;
        if (!data) {
            return {
                catalogs: {
                    schema: [],
                    table: [],
                    routine: [],
                    column: [],
                },
                schemas: [],
                targets: [],
                privileges: this.emptyPrivilegeMaps(),
                originalPrivileges: this.emptyPrivilegeMaps(),
                directPrivileges: this.emptyPrivilegeMaps(),
                inheritedPrivileges: this.emptyPrivilegeMaps(),
                roleInheritedPrivileges: this.emptyPrivilegeMaps(),
                restrictedPrivileges: this.emptyPrivilegeMaps(),
                partialRevokePrivileges: this.emptyPrivilegeMaps(),
                originalPartialRevokePrivileges: this.emptyPrivilegeMaps(),
                readonlyPrivileges: this.emptyPrivilegeMaps(),
                partialRevokesEnabled: false,
                selectedTargetId: "",
            };
        }

        return {
            catalogs: {
                schema: data.catalogs?.schema ?? [],
                table: data.catalogs?.table ?? [],
                routine: data.catalogs?.routine ?? [],
                column: data.catalogs?.column ?? [],
            },
            schemas: data.schemas ?? [],
            targets: data.targets ?? [],
            privileges: data.privileges ?? this.emptyPrivilegeMaps(),
            originalPrivileges: data.originalPrivileges ?? this.emptyPrivilegeMaps(),
            directPrivileges: data.directPrivileges ?? this.emptyPrivilegeMaps(),
            inheritedPrivileges: data.inheritedPrivileges ?? this.emptyPrivilegeMaps(),
            roleInheritedPrivileges: data.roleInheritedPrivileges ?? this.emptyPrivilegeMaps(),
            restrictedPrivileges: data.restrictedPrivileges ?? this.emptyPrivilegeMaps(),
            partialRevokePrivileges: data.partialRevokePrivileges ?? this.emptyPrivilegeMaps(),
            originalPartialRevokePrivileges: data.originalPartialRevokePrivileges ?? this.emptyPrivilegeMaps(),
            readonlyPrivileges: data.readonlyPrivileges ?? this.emptyPrivilegeMaps(),
            partialRevokesEnabled: data.partialRevokesEnabled ?? false,
            selectedTargetId: data.selectedTargetId ?? "",
            loadSchemaTargets: data.loadSchemaTargets,
            loadTableColumns: data.loadTableColumns,
        };
    }

    private emptyPrivilegeMaps(): IObjectPrivilegeMaps {
        return {
            schema: {},
            table: {},
            routine: {},
            column: {},
        };
    }

    private availablePrivileges(
        data: IObjectPrivilegeEditorData, target: IObjectPrivilegeEditorTarget | undefined,
    ): IMySQLGlobalPrivilegeCatalogItem[] {
        if (!target) {
            return [];
        }

        const query = this.state.privilegeQuery.trim().toLocaleLowerCase();
        const selectedPrivilegeSet = new Set(this.targetPrivileges(data, target));

        return data.catalogs[target.kind].filter((entry) => {
            return !selectedPrivilegeSet.has(entry.privilege)
                && (query.length === 0 || entry.privilege.toLocaleLowerCase().includes(query));
        }).sort((left, right) => {
            const result = left.privilege.localeCompare(right.privilege, undefined, {
                sensitivity: "base", numeric: true,
            });

            return this.state.privilegeSortDirection === "ascending" ? result : -result;
        });
    }

    private renderPrivilegeSortHeader(): ComponentChild {
        const ascending = this.state.privilegeSortDirection === "ascending";

        return (
            <span className="userAccountPrivilegeSortHeader">
                <Button
                    className="userAccountPrivilegeSortButton active"
                    data-tooltip={`Sort privileges ${ascending ? "descending" : "ascending"}`}
                    onClick={() => {
                        this.setState({ privilegeSortDirection: ascending ? "descending" : "ascending" });
                    }}
                >
                    <span>Privileges</span>
                    <Icon
                        className="userAccountPrivilegeSortIcon"
                        src={ascending ? Codicon.ArrowUp : Codicon.ArrowDown}
                        data-tooltip="inherit"
                    />
                </Button>
            </span>
        );
    }

    private renderObjectTree(data: IObjectPrivilegeEditorData): ComponentChild {
        const targetsBySchema = new Map<string, IObjectPrivilegeEditorTarget[]>();
        data.targets.forEach((target) => {
            const schemaTargets = targetsBySchema.get(target.schema) ?? [];
            schemaTargets.push(target);
            targetsBySchema.set(target.schema, schemaTargets);
        });

        return data.schemas.map((schema) => {
            const schemaTargets = targetsBySchema.get(schema) ?? [];
            const schemaTarget = data.targets.find((target) => {
                return target.kind === "schema" && target.schema === schema;
            });
            const children = this.isExpanded(`schema:${schema}`)
                ? this.renderSchemaTargets(data, schemaTargets, schema)
                : undefined;
            const schemaNode = !schemaTarget
                ? this.renderDisclosureNode(data, schema, `schema:${schema}`, children,
                    this.isLoading(this.schemaExpansionId(schema)))
                : schemaTarget.hasChildren !== false
                    ? this.renderTargetTreeNode(data, schemaTarget, `schema:${schema}`, children,
                        this.isLoading(this.schemaExpansionId(schema)))
                    : this.renderLeafTargetNode(data, schemaTarget);

            return (
                <div className="userAccountObjectTreeSchema" key={schema}>
                    {schemaNode}
                </div>
            );
        });
    }

    private renderSchemaTargets(
        data: IObjectPrivilegeEditorData,
        targets: IObjectPrivilegeEditorTarget[],
        schema: string,
    ): ComponentChild {
        const tableTargets = targets.filter((target) => {
            return target.kind === "table";
        });
        const routineTargets = targets.filter((target) => {
            return target.kind === "routine";
        });
        const columnTargets = targets.filter((target) => {
            return target.kind === "column";
        });

        return (
            <div className="userAccountObjectTreeChildren">
                {this.renderTableTargets(data, tableTargets, columnTargets)}
                {columnTargets.filter((target) => {
                    return !tableTargets.some((tableTarget) => {
                        return tableTarget.table === target.table;
                    });
                }).map((target) => {
                    return this.renderTargetButton(data, target);
                })}
                {routineTargets.map((target) => {
                    return this.renderTargetButton(data, target);
                })}
            </div>
        );
    }

    private renderTableTargets(
        data: IObjectPrivilegeEditorData,
        tableTargets: IObjectPrivilegeEditorTarget[],
        columnTargets: IObjectPrivilegeEditorTarget[],
    ): ComponentChild {
        return tableTargets.map((target) => {
            const columns = columnTargets.filter((columnTarget) => {
                return columnTarget.table === target.table;
            });
            const expandedId = this.childExpansionId(target);
            const children = this.isExpanded(expandedId)
                ? (
                    <div className="userAccountObjectTreeChildren">
                        {columns.map((columnTarget) => {
                            return this.renderTargetButton(data, columnTarget);
                        })}
                    </div>
                )
                : undefined;

            return (
                <div key={target.id}>
                    {target.hasChildren !== false
                        ? this.renderTargetTreeNode(data, target, expandedId, children)
                        : this.renderLeafTargetNode(data, target)}
                </div>
            );
        });
    }

    private renderTargetButton(
        data: IObjectPrivilegeEditorData, target: IObjectPrivilegeEditorTarget, loading = false,
    ): ComponentChild {
        const selected = data.selectedTargetId === target.id;
        const count = this.targetPrivileges(data, target).length;
        const hasPrivileges = this.targetOrChildrenHavePrivileges(data, target);

        return (
            <button
                className={[
                    "userAccountObjectTarget",
                    selected ? "selected" : "",
                    target.available ? "" : "unavailable",
                    hasPrivileges ? "hasPrivileges" : "",
                ].join(" ")}
                type="button"
                key={target.id}
                onClick={() => {
                    this.selectTarget(data, target);
                }}
            >
                <Icon
                    className="userAccountObjectTargetIcon"
                    src={this.objectTargetIcon(target)}
                    color="currentColor"
                    data-tooltip="inherit"
                />
                <span className="userAccountObjectTargetName">{this.objectTreeTargetName(target)}</span>
                {loading && <Icon className="userAccountObjectLoading" src={Codicon.Loading} />}
                {count > 0 && <span className="userAccountObjectGrantCount">{count}</span>}
            </button>
        );
    }

    private renderTargetTreeNode(
        data: IObjectPrivilegeEditorData,
        target: IObjectPrivilegeEditorTarget,
        expandedId: string,
        children: ComponentChild,
        loading = false,
    ): ComponentChild {
        return (
            <>
                <div className="userAccountObjectTreeNode">
                    <button
                        className="userAccountObjectTreeChevron"
                        type="button"
                        onClick={() => {
                            this.toggleTargetExpanded(data, target, expandedId);
                        }}
                    >
                        <Icon src={this.isExpanded(expandedId) ? Codicon.ChevronDown : Codicon.ChevronRight} />
                    </button>
                    {this.renderTargetButton(data, target, loading)}
                </div>
                {children}
            </>
        );
    }

    private renderLeafTargetNode(
        data: IObjectPrivilegeEditorData, target: IObjectPrivilegeEditorTarget,
    ): ComponentChild {
        return (
            <div className="userAccountObjectTreeNode">
                <span className="userAccountObjectTreeChevron userAccountObjectTreeLeaf" aria-hidden="true" />
                {this.renderTargetButton(data, target)}
            </div>
        );
    }

    private renderDisclosureNode(
        data: IObjectPrivilegeEditorData, caption: string, expandedId: string, children: ComponentChild,
        loading = false,
    ): ComponentChild {
        return (
            <>
                <button
                    className="userAccountObjectTreeDisclosure"
                    type="button"
                    onClick={() => {
                        this.toggleSchemaExpanded(data, caption, expandedId);
                    }}
                >
                    <Icon src={this.isExpanded(expandedId) ? Codicon.ChevronDown : Codicon.ChevronRight} />
                    <span>{caption}</span>
                    {loading && <Icon className="userAccountObjectLoading" src={Codicon.Loading} />}
                </button>
                {children}
            </>
        );
    }

    private childExpansionId(target: IObjectPrivilegeEditorTarget): string {
        return JSON.stringify([
            "children", target.kind, target.schema, target.table, target.routine, target.routineType,
        ]);
    }

    private handlePrivilegeSearchChange = (_e: InputEvent, props: IInputChangeProperties): void => {
        this.setState({ privilegeQuery: props.value });
    };

    private addPrivilege(privilege: string): void {
        this.updateSelectedPrivileges((selectedPrivilegeSet) => {
            selectedPrivilegeSet.add(privilege);
        });
    }

    private removePrivilege(privilege: string): void {
        this.updateSelectedPrivileges((selectedPrivilegeSet) => {
            selectedPrivilegeSet.delete(privilege);
        });
    };

    private revokeInheritedPrivilege(privilege: string): void {
        const data = this.privilegeData();
        const target = this.selectedTarget(data);
        if (!target || target.kind !== "schema") {
            return;
        }

        const key = this.targetMapKey(target);
        const inheritedPrivileges = this.inheritedPrivileges(data, target).filter((entry) => {
            return entry !== privilege;
        });
        const partialRevokePrivileges = this.partialRevokePrivileges(data, target).filter(
            (entry) => {
                return entry !== privilege;
            },
        );
        const partialRevokePrivilegeMaps = data.partialRevokePrivileges ?? this.emptyPrivilegeMaps();
        const restrictedPrivileges = [...new Set([
            ...this.restrictedPrivileges(data, target), privilege,
        ])].sort((left, right) => {
            return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
        });

        this.props.onDataChange?.({
            ...data,
            inheritedPrivileges: {
                ...data.inheritedPrivileges,
                schema: { ...data.inheritedPrivileges.schema, [key]: inheritedPrivileges },
            },
            partialRevokePrivileges: {
                ...partialRevokePrivilegeMaps,
                schema: { ...partialRevokePrivilegeMaps.schema, [key]: partialRevokePrivileges },
            },
            restrictedPrivileges: {
                ...data.restrictedPrivileges,
                schema: { ...data.restrictedPrivileges.schema, [key]: restrictedPrivileges },
            },
        });
    }

    private updateSelectedPrivileges(update: (selectedPrivilegeSet: Set<string>) => void): void {
        const data = this.privilegeData();
        const target = this.selectedTarget(data);
        if (!target) {
            return;
        }

        const selectedPrivilegeSet = new Set(this.targetPrivileges(data, target));
        update(selectedPrivilegeSet);
        const selectedPrivileges = [...selectedPrivilegeSet].sort((left, right) => {
            return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
        });
        const mapKey = this.targetMapKey(target);

        this.props.onDataChange?.({
            ...data,
            privileges: {
                ...data.privileges,
                [target.kind]: {
                    ...data.privileges[target.kind],
                    [mapKey]: selectedPrivileges,
                },
            },
            directPrivileges: {
                ...data.directPrivileges,
                [target.kind]: {
                    ...data.directPrivileges[target.kind],
                    [mapKey]: selectedPrivileges,
                },
            },
        });
    }

    private selectedTarget(data: IObjectPrivilegeEditorData): IObjectPrivilegeEditorTarget | undefined {
        return data.targets.find((target) => {
            return target.id === data.selectedTargetId;
        }) ?? data.targets[0];
    }

    private selectTarget(data: IObjectPrivilegeEditorData, target: IObjectPrivilegeEditorTarget): void {
        this.props.onDataChange?.({ ...data, selectedTargetId: target.id });
    }

    private targetPrivileges(data: IObjectPrivilegeEditorData, target: IObjectPrivilegeEditorTarget): string[] {
        return data.privileges[target.kind][this.targetMapKey(target)] ?? [];
    }

    private inheritedPrivileges(data: IObjectPrivilegeEditorData, target: IObjectPrivilegeEditorTarget): string[] {
        return data.inheritedPrivileges[target.kind][this.targetMapKey(target)] ?? [];
    }

    private roleInheritedPrivileges(data: IObjectPrivilegeEditorData, target: IObjectPrivilegeEditorTarget): string[] {
        return data.roleInheritedPrivileges[target.kind][this.targetMapKey(target)] ?? [];
    }

    private partialRevokePrivileges(data: IObjectPrivilegeEditorData, target: IObjectPrivilegeEditorTarget): string[] {
        return data.partialRevokePrivileges?.[target.kind][this.targetMapKey(target)] ?? [];
    }

    private restrictedPrivileges(data: IObjectPrivilegeEditorData, target: IObjectPrivilegeEditorTarget): string[] {
        return data.restrictedPrivileges[target.kind][this.targetMapKey(target)] ?? [];
    }

    private readonlyPrivileges(data: IObjectPrivilegeEditorData, target: IObjectPrivilegeEditorTarget): string[] {
        return data.readonlyPrivileges[target.kind][this.targetMapKey(target)] ?? [];
    }

    private targetOrChildrenHavePrivileges(
        data: IObjectPrivilegeEditorData, target: IObjectPrivilegeEditorTarget,
    ): boolean {
        return data.targets.some((candidate) => {
            return this.targetHasPrivileges(data, candidate) && this.isTargetOrDescendant(target, candidate);
        });
    }

    private targetHasPrivileges(data: IObjectPrivilegeEditorData, target: IObjectPrivilegeEditorTarget): boolean {
        return (data.directPrivileges[target.kind][this.targetMapKey(target)] ?? []).length > 0;
    }

    private isTargetOrDescendant(
        target: IObjectPrivilegeEditorTarget, candidate: IObjectPrivilegeEditorTarget,
    ): boolean {
        if (target.id === candidate.id) {
            return true;
        }

        if (target.kind === "schema") {
            return target.schema === candidate.schema;
        }

        return target.kind === "table"
            && candidate.kind === "column"
            && target.schema === candidate.schema
            && target.table === candidate.table;
    }

    private objectTargetIcon(target: IObjectPrivilegeEditorTarget): string {
        switch (target.kind) {
            case "schema": {
                return Assets.db.mysqlSchemaIcon;
            }

            case "table": {
                return Assets.db.tableIcon;
            }

            case "routine": {
                return target.routineType === "FUNCTION" ? Assets.db.functionIcon : Assets.db.procedureIcon;
            }

            case "column": {
                return Assets.db.columnNullableIcon;
            }
        }
    }

    private objectTreeTargetName(target: IObjectPrivilegeEditorTarget): string {
        switch (target.kind) {
            case "table":
                return target.table!;
            case "routine":
                return target.routine!;
            case "column":
                return target.column!;
            default:
                return target.schema;
        }
    }

    private targetMapKey(target: IObjectPrivilegeEditorTarget): string {
        if (target.kind === "schema") {
            return target.schema;
        }

        if (target.kind === "routine") {
            return JSON.stringify([target.kind, target.schema, target.routine, target.routineType]);
        }

        return JSON.stringify([target.kind, target.schema, target.table, target.routine, target.column]);
    }

    private toggleSchemaExpanded(data: IObjectPrivilegeEditorData, schema: string, id: string): void {
        const expanded = !this.isExpanded(id);
        this.setExpanded(id, expanded);
        if (expanded) {
            void this.loadSchemaTargets(data, schema, id);
        }
    }

    private toggleTargetExpanded(
        data: IObjectPrivilegeEditorData, target: IObjectPrivilegeEditorTarget, id: string,
    ): void {
        const expanded = !this.isExpanded(id);
        this.setExpanded(id, expanded);
        if (expanded && target.kind === "schema") {
            void this.loadSchemaTargets(data, target.schema, id);
        } else if (expanded && target.kind === "table") {
            void this.loadTableColumns(data, target, id);
        }
    }

    private setExpanded(id: string, expanded: boolean): void {
        this.setState({
            expanded: {
                ...this.state.expanded,
                [id]: expanded,
            },
        });
    }

    private isExpanded(id: string): boolean {
        return this.state.expanded[id] ?? false;
    }

    private schemaExpansionId(schema: string): string {
        return `schema:${schema}`;
    }

    private isLoading(id: string): boolean {
        return this.state.loadingTargetIds[id] ?? false;
    }

    private async loadSchemaTargets(data: IObjectPrivilegeEditorData, schema: string, id: string): Promise<void> {
        if (this.state.loadedTargetIds[id] || this.isLoading(id) || !data.loadSchemaTargets) {
            return;
        }

        this.setState({ loadingTargetIds: { ...this.state.loadingTargetIds, [id]: true } });
        try {
            const result = await data.loadSchemaTargets(schema);
            const schemaTarget = data.targets.find((target) => {
                return target.kind === "schema" && target.schema === schema;
            });
            this.mergeLoadedTargets(result, schemaTarget);
            this.setState({ loadedTargetIds: { ...this.state.loadedTargetIds, [id]: true } });
        } finally {
            this.setState(({ loadingTargetIds }) => {
                const nextLoading = { ...loadingTargetIds };
                delete nextLoading[id];

                return { loadingTargetIds: nextLoading };
            });
        }
    }

    private async loadTableColumns(
        data: IObjectPrivilegeEditorData, target: IObjectPrivilegeEditorTarget, id: string,
    ): Promise<void> {
        if (this.state.loadedTargetIds[id] || this.isLoading(id) || !data.loadTableColumns || !target.table) {
            return;
        }

        this.setState({ loadingTargetIds: { ...this.state.loadingTargetIds, [id]: true } });
        try {
            const result = await data.loadTableColumns(target.schema, target.table);
            this.mergeLoadedTargets(result, target);
            this.setState({ loadedTargetIds: { ...this.state.loadedTargetIds, [id]: true } });
        } finally {
            this.setState(({ loadingTargetIds }) => {
                const nextLoading = { ...loadingTargetIds };
                delete nextLoading[id];

                return { loadingTargetIds: nextLoading };
            });
        }
    }

    private mergeLoadedTargets(
        result: IObjectPrivilegeTargetLoadResult, parent?: IObjectPrivilegeEditorTarget,
    ): void {
        const data = this.privilegeData();
        const targetsById = new Map(data.targets.map((target) => {
            return [target.id, target];
        }));
        result.targets.forEach((target) => {
            targetsById.set(target.id, target);
        });
        if (parent) {
            const hasChildren = [...targetsById.values()].some((target) => {
                return parent.kind === "schema"
                    ? target.kind !== "schema" && target.schema === parent.schema
                    : target.kind === "column" && target.schema === parent.schema && target.table === parent.table;
            });
            targetsById.set(parent.id, { ...parent, hasChildren });
        }
        this.props.onDataChange?.({
            ...data,
            targets: [...targetsById.values()],
            inheritedPrivileges: this.mergePrivilegeMaps(data.inheritedPrivileges, result.privilegeState.inherited),
            roleInheritedPrivileges: this.mergePrivilegeMaps(
                data.roleInheritedPrivileges, result.privilegeState.roleInherited,
            ),
            restrictedPrivileges: this.mergePrivilegeMaps(data.restrictedPrivileges, result.privilegeState.restricted),
            readonlyPrivileges: this.mergePrivilegeMaps(data.readonlyPrivileges, result.privilegeState.readonly),
        });
    }

    private mergePrivilegeMaps(left: IObjectPrivilegeMaps, right: IObjectPrivilegeMaps): IObjectPrivilegeMaps {
        return {
            schema: { ...left.schema, ...right.schema },
            table: { ...left.table, ...right.table },
            routine: { ...left.routine, ...right.routine },
            column: { ...left.column, ...right.column },
        };
    }

    private objectSummary(privileges: IObjectPrivilegeMaps): string {
        const schemaCount = this.grantedTargetCount(privileges.schema);
        const tableCount = this.grantedTargetCount(privileges.table);
        const routineCount = this.grantedTargetCount(privileges.routine);
        const columnCount = this.grantedTargetCount(privileges.column);
        const total = schemaCount + tableCount + routineCount + columnCount;

        return `${total} target${total === 1 ? "" : "s"} with grants`;
    }

    private grantedTargetCount(privileges: Record<string, string[]>): number {
        return Object.values(privileges).filter((targetPrivileges) => {
            return targetPrivileges.length > 0;
        }).length;
    }

}

/**
 * A simple admin page to manage MySQL user accounts.
 */
export class UserAccounts extends ComponentBase<IUserAccountsProperties, IUserAccountsState> {
    private static readonly tooltipItemLimit = 15;

    private createUserDialogRef = createRef<ValueEditDialog>();
    private userAccountsGridRef = createRef<TreeGrid>();
    private generatedPasswordDialogRef = createRef<Dialog>();
    private manageRolesAndPrivilegesDialogRef = createRef<ValueEditDialog>();
    private passwordChangeDialogRef = createRef<PasswordChangeDialog>();
    private viewAccountSqlDialogRef = createRef<ValueEditDialog>();
    private userAccountContextMenuRef = createRef<Menu>();
    private userAccountColumns?: ColumnDefinition[];
    private ignoreEmptyPasswordConfirmationForSession = false;
    private editingAccountDetails?: IMySQLUser;
    private editingAccountRow?: RowComponent;

    public constructor(props: IUserAccountsProperties) {
        super(props);

        // Initial empty state; content will be loaded from backend.
        this.state = {
            rows: [],
            editingAccount: null,
            searchValues: {},
            passwordValidationInstalled: false,
            partialRevokesEnabled: false,
            authenticationPlugins: [],
            generatedPassword: "",
            generatedPasswordVisible: false,
        };

        this.addHandledProperties("backend", "toolbarItems");
    }

    public override componentDidMount(): void {
        void this.loadUsers();
    }

    public override componentDidUpdate(prevProps: IUserAccountsProperties): void {
        const { backend } = this.props;
        if (backend !== prevProps.backend) {
            void this.loadUsers();
        }
    }

    public render(): ComponentChild {
        const { toolbarItems } = this.props;
        const { rows } = this.state;
        const filteredRows = this.filteredUserRows(rows);

        const navigationItems = [...toolbarItems.navigation];
        const auxiliaryItems = [...toolbarItems.auxiliary];

        const columns = this.userAccountColumns ??= [
            {
                title: "Status",
                field: "accountLocked",
                sorter: this.statusSorter,
                formatter: (cell) => {
                    return this.statusFormatter(cell);
                },
                hozAlign: "center",
                width: 124,
                widthShrink: 0,
                minWidth: 124,
                cellDblClick: this.handleUserAccountsCellDoubleClick,
            },
            {
                title: "User Name",
                field: "user",
                sorter: this.userNameSorter,
                formatter: (cell) => {
                    return this.userNameFormatter(cell);
                },
                minWidth: 90,
                widthShrink: 2,
                cellDblClick: this.handleUserAccountsCellDoubleClick,
            },
            {
                title: "Host",
                field: "host",
                sorter: this.hostMatcherSorter,
                formatter: (cell) => {
                    return this.hostMatcherFormatter(cell);
                },
                minWidth: 74,
                widthShrink: 2,
                cellDblClick: this.handleUserAccountsCellDoubleClick,
            },
            {
                title: "Type",
                field: "plugin",
                minWidth: 86,
                widthShrink: 2,
                cellDblClick: this.handleUserAccountsCellDoubleClick,
            },
            {
                title: "SSL",
                field: "sslOptions",
                sorter: this.sslSorter,
                formatter: (cell) => {
                    return this.sslFormatter(cell);
                },
                minWidth: 82,
                widthShrink: 2,
                cellDblClick: this.handleUserAccountsCellDoubleClick,
            },
            {
                title: "Roles",
                field: "roles",
                sorter: this.rolesSorter,
                formatter: (cell) => {
                    return this.rolesFormatter(cell);
                },
                width: 76,
                widthShrink: 2,
                minWidth: 56,
            },
            {
                title: "Global Privileges",
                field: "globalPrivileges",
                sorter: this.globalPrivilegesSorter,
                formatter: (cell) => {
                    return this.globalPrivilegesFormatter(cell);
                },
                minWidth: 100,
                widthShrink: 1,
            },
            {
                title: "Object Privileges",
                field: "objectPrivileges",
                sorter: this.objectPrivilegesSorter,
                formatter: (cell) => {
                    return this.objectPrivilegesFormatter(cell);
                },
                minWidth: 100,
                widthShrink: 1,
                cellDblClick: this.handleUserAccountsCellDoubleClick,
            },
        ];

        const options: ITreeGridOptions = {
            selectionType: SelectionType.Single,
            showHeader: true,
            layout: "fitColumns",
            verticalGridLines: false,
            horizontalGridLines: true,
            alternatingRowBackgrounds: true,
            rowHeight: 28,
            selectOnMouseDown: true,
            index: "id",
            preserveColumnWidthsOnDataUpdate: false,
        };

        const className = this.getEffectiveClassNames(["userAccounts"]);
        const summary = this.userAccountSummary(filteredRows);

        const toolbar = <Toolbar id="userAccountsToolbar" dropShadow={false}>
            {navigationItems}
            {this.toolbarContent()}
            <div className="expander" />
            {auxiliaryItems}
            {this.searchContent()}
        </Toolbar>;

        return (
            <Container
                className="userAccountsHost"
                orientation={Orientation.TopDown}
            >
                <CreateUserDialog
                    dialogRef={this.createUserDialogRef}
                    editing={this.state.editingAccount !== null}
                    onClose={this.handleCreateUserDialogClose}
                    onValidate={this.validateCreateUserValues}
                />
                <Dialog
                    ref={this.generatedPasswordDialogRef}
                    id="generatedPasswordDialog"
                    caption={<Label>Generated Password</Label>}
                    content={
                        <Container
                            className="generatedPasswordDialogContent"
                            orientation={Orientation.TopDown}
                            crossAlignment={ContentAlignment.Stretch}
                        >
                            <Label caption="Save this password now. It will not be shown again." />
                            <Container className="generatedPasswordInput" orientation={Orientation.TopDown}>
                                <Button
                                    id="toggleGeneratedPasswordVisibility"
                                    className="generatedPasswordVisibilityButton"
                                    data-tooltip={this.state.generatedPasswordVisible ?
                                        "Hide password" : "Show password"}
                                    imageOnly={true}
                                    onClick={this.toggleGeneratedPasswordVisibility}
                                >
                                    <Icon src={this.state.generatedPasswordVisible ? Codicon.EyeClosed : Codicon.Eye}
                                        data-tooltip="inherit" />
                                </Button>
                                <Button
                                    id="copyGeneratedPassword"
                                    className="generatedPasswordCopyButton"
                                    data-tooltip="Copy password to clipboard"
                                    imageOnly={true}
                                    onClick={this.copyGeneratedPassword}
                                >
                                    <Icon src={Codicon.Copy} data-tooltip="inherit" />
                                </Button>
                                <Input
                                    id="generatedPassword"
                                    value={this.state.generatedPassword}
                                    password={!this.state.generatedPasswordVisible}
                                    readOnly={true}
                                />
                            </Container>
                        </Container>
                    }
                    actions={{
                        end: [<Button caption="Close" onClick={this.closeGeneratedPasswordDialog} />],
                    }}
                    onClose={this.handleGeneratedPasswordDialogClose}
                />
                <ValueEditDialog
                    id="manageRolesAndPrivilegesDialog"
                    ref={this.manageRolesAndPrivilegesDialogRef}
                    confirmCaption="Apply"
                    onClose={this.handleManageRolesAndPrivilegesDialogClose}
                />
                <PasswordChangeDialog id="userAccountResetPasswordDialog" ref={this.passwordChangeDialogRef} />
                <ValueEditDialog
                    id="viewUserAccountSqlDialog"
                    ref={this.viewAccountSqlDialogRef}
                />
                <Container
                    className={className}
                    orientation={Orientation.TopDown}
                    mainAlignment={ContentAlignment.Start}
                    crossAlignment={ContentAlignment.Stretch}
                >
                    <Container
                        id="userAccountsOverview"
                        orientation={Orientation.TopDown}
                    >
                        <Container
                            id="userAccountsHeader"
                            orientation={Orientation.LeftToRight}
                            mainAlignment={ContentAlignment.SpaceBetween}
                            crossAlignment={ContentAlignment.Center}
                        >
                            <Container
                                className="userAccountsTitle"
                                orientation={Orientation.LeftToRight}
                                crossAlignment={ContentAlignment.Center}
                            >
                                <Icon src={Assets.oci.profileIcon} id="userAccountsIcon" />
                                <Container orientation={Orientation.TopDown}>
                                    <h1>User Accounts</h1>
                                    <div className="userAccountsSubtitle" data-testid="userAccountsTotal">
                                        {this.accountCountText(summary.total, rows.length)}
                                    </div>
                                </Container>
                            </Container>
                        </Container>
                        <div className="userAccountsSummary">
                            {this.summaryItem("Accounts", String(summary.total), "summaryTotal")}
                            {this.summaryItem("Expired Passwords", String(summary.expiredPasswords),
                                "summaryExpiredPasswords")}
                            {this.summaryItem("Password Validation",
                                this.state.passwordValidationInstalled ? "On" : "Off",
                                "summaryPasswordValidation")}
                        </div>
                    </Container>
                    <div id="userAccountsList" className="userAccountsCard">
                        <div id="userAccountsListHeader">
                            <Label caption="Account List" />
                            {toolbar}
                        </div>
                        <div id="userAccountsGridFrame">
                            <TreeGrid
                                id="userAccountsGrid"
                                ref={this.userAccountsGridRef}
                                options={options}
                                columns={columns}
                                tableData={filteredRows}
                                onRowContext={this.handleUserAccountsRowContext}
                                onFormatRow={this.handleFormatUserAccountRow}
                                onCellClick={this.handleUserAccountsCellClick}
                            />
                        </div>
                    </div>
                    <Menu
                        id="userAccountContextMenu"
                        ref={this.userAccountContextMenuRef}
                        placement={ComponentPlacement.BottomLeft}
                        onItemClick={this.handleUserAccountContextMenuItemClick}
                        customCommand={this.handleUserAccountContextMenuCustomCommand}
                    >
                        <MenuItem
                            id="toggleAccountLock"
                            command={{ title: "Lock Account", command: "toggleAccountLock" }}
                        />
                        <MenuItem command={{ title: "Reset Password...", command: "resetPassword" }} />
                        <MenuItem command={{ title: "-", command: "" }} disabled />
                        <MenuItem command={{ title: "View as SQL...", command: "viewAccountSql" }} />
                        <MenuItem command={{ title: "Edit Account...", command: "editAccount" }} />
                        <MenuItem command={{ title: "Manage Roles...", command: "manageRoles" }} />
                        <MenuItem command={{
                            title: "Manage Global Privileges...",
                            command: "manageGlobalPrivileges"
                        }} />
                        <MenuItem command={{
                            title: "Manage Object Privileges...",
                            command: "manageObjectPrivileges"
                        }} />
                        <MenuItem command={{ title: "-", command: "" }} disabled />
                        <MenuItem command={{ title: "Clone Account...", command: "cloneAccount" }} />
                        <MenuItem command={{ title: "Delete Account...", command: "deleteAccount" }} />
                    </Menu>
                </Container>
            </Container>
        );
    }

    private userAccountSummary = (rows: IMySQLUserListItem[]): IUserAccountSummary => {
        return rows.reduce<IUserAccountSummary>((summary, row) => {
            return {
                total: summary.total + 1,
                expiredPasswords: summary.expiredPasswords + (this.isPasswordExpired(row) ? 1 : 0),
            };
        }, {
            total: 0,
            expiredPasswords: 0,
        });
    };

    private accountCountText = (count: number, total?: number): string => {
        if (total !== undefined && total !== count) {
            return `${count} of ${total} account${total === 1 ? "" : "s"}`;
        }

        return `${count} account${count === 1 ? "" : "s"}`;
    };

    private summaryItem = (label: string, value: string, testId: string): ComponentChild => {
        return (
            <div className="userAccountsSummaryItem">
                <span>{label}</span>
                <strong data-testid={testId}>{value}</strong>
            </div>
        );
    };

    private renderStatusPill = (
        text: string, kind: "on" | "off" | "none" | "warning" | "info", icon?: Codicon, tooltip?: string,
    ): ComponentChild => {
        return (
            <span className={`userAccountPill ${kind}`} data-tooltip={tooltip}>
                {icon && <Icon src={icon} width={12} height={12} data-tooltip="inherit" />}
                <span data-tooltip="inherit">{text}</span>
            </span>
        );
    };

    private renderIntoHost = (content: ComponentChild): HTMLElement => {
        const host = document.createElement("div");
        render(content, host);

        return host;
    };

    private tooltipList = (items: string[]): string | undefined => {
        if (items.length === 0) {
            return undefined;
        }

        const tooltipItems = items.slice(0, UserAccounts.tooltipItemLimit);
        if (items.length > UserAccounts.tooltipItemLimit) {
            tooltipItems.push("...");
        }

        return tooltipItems.join("\n");
    };

    private toolbarContent = (): ComponentChild[] => {
        return [
            <Button key="refresh" data-tooltip="Refresh" imageOnly={true} onClick={this.handleRefresh}>
                <Icon src={Assets.toolbar.refreshIcon2} data-tooltip="inherit" />
            </Button>,
            <Button key="createUser" data-tooltip="Create user" imageOnly={true} onClick={this.handleCreateUser}>
                <Icon src={Assets.misc.plusIcon} width={16} height={16} data-tooltip="inherit" />
            </Button>,
        ];
    };

    private searchContent = (): ComponentChild => {
        return (
            <Search
                id="userAccountsSearch"
                placeholder="Search users, hosts, auth, roles, privileges"
                leadingIcon={Codicon.Search}
                buttons={{
                    clearAll: true,
                    clearAllIcon: Codicon.Close,
                    hideClearAllWhenEmpty: true,
                }}
                values={this.state.searchValues}
                onChange={this.handleSearchChange}
            />
        );
    };

    private handleSearchChange = (_e: UIEvent, _props: unknown, values: ISearchValues): void => {
        this.setState({ searchValues: values });
    };

    private handleUserAccountsCellClick = (event: Event, cell: CellComponent): void => {
        if (!this.isUserAccountPillClick(event)) {
            return;
        }

        const field = cell.getColumn().getField();

        if (["roles", "globalPrivileges", "objectPrivileges"].includes(field)) {
            event.preventDefault();
            event.stopPropagation();
        }

        if (field === "roles") {
            this.showManageRolesDialog(cell.getRow());
        } else if (field === "globalPrivileges") {
            void this.showManageGlobalPrivilegesDialog(cell.getRow());
        } else if (field === "objectPrivileges") {
            void this.showManageObjectPrivilegesDialog(cell.getRow());
        }
    };

    private isUserAccountPillClick(event: Event): boolean {
        return event.target instanceof Element && event.target.closest(".userAccountPill") !== null;
    }

    private handleUserAccountsCellDoubleClick = (_event: Event, cell: CellComponent): void => {
        void this.showEditUserDialog(cell.getRow());
    };

    private handleUserAccountsRowContext = (event: Event, row: RowComponent): void => {
        this.userAccountContextMenuRef.current?.close();
        this.userAccountsGridRef.current?.deselectRow();
        row.select();

        const e = event as MouseEvent;
        const targetRect = new DOMRect(e.clientX, e.clientY, 2, 2);
        this.userAccountContextMenuRef.current?.open(targetRect, false, {}, row);
    };

    private handleFormatUserAccountRow = (row: RowComponent): void => {
        const rowElement = row.getElement();
        rowElement.querySelector(".userAccountRowActions")?.remove();

        const button = document.createElement("button");
        button.type = "button";
        button.className = "userAccountRowActions";
        button.textContent = "...";
        button.setAttribute("aria-label", "More Actions");
        button.setAttribute("data-tooltip", "More Actions");
        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();

            const rect = button.getBoundingClientRect();
            this.handleUserAccountsRowContext(new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: true,
                clientX: rect.left,
                clientY: rect.bottom,
            }), row);
        });

        rowElement.appendChild(button);
    };

    private handleUserAccountContextMenuCustomCommand = (props: IMenuItemProperties,
        payload: unknown): Command | undefined => {
        if (props.id !== "toggleAccountLock") {
            return undefined;
        }

        const row = payload as RowComponent | undefined;
        const rowData = row?.getData() as IUserAccountsState["rows"][number] | undefined;

        return {
            title: rowData?.accountLocked ? "Unlock Account" : "Lock Account",
            command: props.command.command,
        };
    };

    private handleUserAccountContextMenuItemClick = (props: IMenuItemProperties, _altActive: boolean,
        payload: unknown): boolean => {
        const row = payload as RowComponent | undefined;
        if (!row) {
            return true;
        }

        const command = props.command.command;
        switch (command) {
            case "toggleAccountLock": {
                const rowData = row.getData() as IUserAccountsState["rows"][number];
                void this.setUserAccountLock(row, !rowData.accountLocked);
                break;
            }

            case "editAccount": {
                void this.showEditUserDialog(row);
                break;
            }

            case "cloneAccount": {
                void this.showEditUserDialog(row, true);
                break;
            }

            case "viewAccountSql": {
                void this.showUserAccountSqlDialog(row);
                break;
            }

            case "resetPassword": {
                void this.showResetPasswordDialog(row);
                break;
            }

            case "deleteAccount": {
                void this.confirmDeleteUserAccount(row);
                break;
            }

            case "manageRoles": {
                this.showManageRolesDialog(row);
                break;
            }

            case "manageGlobalPrivileges": {
                void this.showManageGlobalPrivilegesDialog(row);
                break;
            }

            case "manageObjectPrivileges": {
                void this.showManageObjectPrivilegesDialog(row);
                break;
            }

            default: {
                break;
            }
        }

        return true;
    };

    private showResetPasswordDialog = async (row: RowComponent): Promise<void> => {
        const rowData = row.getData() as IUserAccountsState["rows"][number];
        const { user, host } = rowData;

        const { backend } = this.props;
        if (!backend) {
            return;
        }

        await this.passwordChangeDialogRef.current?.show({
            requestId: "userAccountResetPassword",
            caption: "Reset Password",
            account: this.accountIdentifier(rowData),
            onAccept: async ({ password }): Promise<string | void> => {
                const options: IMySQLUser = {
                    user,
                    host,
                    sslType: null,
                    sslCipher: null,
                    x509Issuer: null,
                    x509Subject: null,
                    plugin: null,
                    passwordExpire: null,
                    passwordLastChanged: null,
                    passwordLifetime: null,
                    authString: password,
                    randomPassword: false,
                    maxQuestions: null,
                    maxUpdates: null,
                    maxConnections: null,
                    maxUserConnections: null,
                    passwordReuseHistory: null,
                    passwordReuseInterval: null,
                    passwordRequireCurrent: null,
                    failedLoginAttempts: null,
                    passwordLockTime: null,
                    accountLocked: null,
                    comment: null,
                };

                try {
                    await backend.updateMySQLUser(options);
                    await this.loadUsers();
                } catch (err) {
                    return "Cannot reset user account password: " + convertErrorToString(err);
                }
            },
        });
    };

    private createRoleDialogValues = (
        availableRoles: string[], selectedRoles: string[], defaultRoles: string[],
    ): IDialogValues => {
        const section: IDialogSection = {
            values: {
                roles: {
                    type: "custom",
                    component: <RoleAssignmentEditor />,
                    value: {
                        availableRoles,
                        selectedRoles,
                        defaultRoles,
                    },
                    horizontalSpan: 8,
                },
            },
        };

        return {
            id: "userAccountRoles",
            sections: new Map<string, IDialogSection>([
                ["roles", section],
            ]),
        };
    };

    private createRoleDialogValuesForRow(rowData: IUserAccountsState["rows"][number]): IDialogValues {
        const selectedRoles = rowData.roles.filter((role) => {
            return role !== this.accountIdentifier(rowData);
        }).sort((left, right) => {
            return this.compareStrings(left, right);
        });
        const defaultRoleSet = new Set(rowData.defaultRoles);
        const defaultRoles = selectedRoles.filter((role) => {
            return defaultRoleSet.has(role);
        });
        const candidates = new Set([
            ...this.state.rows.filter((account) => {
                return account.isRole && this.accountIdentifier(account) !== this.accountIdentifier(rowData);
            }).filter((account) => {
                return account.host === "%";
            }).map((account) => {
                return this.accountIdentifier(account);
            }),
            ...selectedRoles,
        ]);
        const availableRoles = [...candidates].sort((left, right) => {
            return this.compareStrings(left, right);
        });

        return this.createRoleDialogValues(availableRoles, selectedRoles, defaultRoles);
    }

    private showManageRolesDialog(row: RowComponent): void {
        void this.showManageRolesAndPrivilegesDialog(row, "roles");
    }

    private handleRoleDialogClose = async (
        closure: DialogResponseClosure, values: IDialogValues, data?: IDictionary,
    ): Promise<void> => {
        if (closure !== DialogResponseClosure.Accept) {
            return;
        }

        const { backend } = this.props;
        if (!backend) {
            return;
        }

        const roleData = data as IManageRolesAndPrivilegesDialogData | undefined;
        const roleSection = values.sections.get("roles")?.values as IUserAccountRolesDialogSection | undefined;
        if (!roleData || !roleSection) {
            return;
        }

        const roles = roleSection.roles.value?.selectedRoles ?? [];
        const defaultRoles = roleSection.roles.value?.defaultRoles ?? [];
        try {
            await backend.setMySQLUserRoles(roleData.user, roleData.host, roles, defaultRoles);
        } catch (err) {
            const message = convertErrorToString(err);
            void ui.showErrorMessage("Cannot update account roles: " + message, {});
        } finally {
            await this.loadUsers();
        }
    };

    private createGlobalPrivilegesDialogValues = (
        catalog: IMySQLGlobalPrivilegeCatalogItem[], selectedPrivileges: string[], inheritedPrivileges: string[] = [],
    ): IDialogValues => {
        const section: IDialogSection = {
            values: {
                privileges: {
                    type: "custom",
                    component: <GlobalPrivilegeEditor />,
                    value: {
                        catalog,
                        selectedPrivileges,
                        inheritedPrivileges,
                    },
                    horizontalSpan: 8,
                },
            },
        };

        return {
            id: "userAccountGlobalPrivileges",
            sections: new Map<string, IDialogSection>([
                ["privileges", section],
            ]),
        };
    };

    private async createGlobalPrivilegesDialogValuesForRow(
        backend: ShellInterfaceSqlEditor, rowData: IUserAccountsState["rows"][number],
    ): Promise<IDialogValues> {
        const selectedPrivileges = [...new Set(rowData.globalPrivileges.map((privilege) => {
            return this.normalizePrivilegeName(privilege);
        }))].sort((left, right) => {
            return this.compareStrings(left, right);
        });
        const inheritedPrivileges = this.inheritedGlobalPrivileges(rowData);
        const catalogByPrivilege = new Map<string, IMySQLGlobalPrivilegeCatalogItem>();
        (await backend.listMySQLGlobalPrivilegeCatalog() ?? []).forEach((entry) => {
            const privilege = this.normalizePrivilegeName(entry.privilege);
            catalogByPrivilege.set(privilege, {
                privilege,
                category: entry.category,
                description: entry.description,
            });
        });
        selectedPrivileges.forEach((privilege) => {
            if (!catalogByPrivilege.has(privilege)) {
                catalogByPrivilege.set(privilege, {
                    privilege,
                    category: "",
                    description: "Currently granted but not reported by SHOW PRIVILEGES.",
                });
            }
        });
        inheritedPrivileges.forEach((privilege) => {
            if (!catalogByPrivilege.has(privilege)) {
                catalogByPrivilege.set(privilege, {
                    privilege,
                    category: "",
                    description: "Currently inherited but not reported by SHOW PRIVILEGES.",
                });
            }
        });
        const catalog = [...catalogByPrivilege.values()].sort((left, right) => {
            return this.compareStrings(left.privilege, right.privilege);
        });

        return this.createGlobalPrivilegesDialogValues(catalog, selectedPrivileges, inheritedPrivileges);
    }

    private showManageGlobalPrivilegesDialog(row: RowComponent): Promise<void> {
        return this.showManageRolesAndPrivilegesDialog(row, "globalPrivileges");
    }

    private handleGlobalPrivilegesDialogClose = async (
        closure: DialogResponseClosure, values: IDialogValues, data?: IDictionary,
    ): Promise<void> => {
        if (closure !== DialogResponseClosure.Accept) {
            return;
        }

        const { backend } = this.props;
        if (!backend) {
            return;
        }

        const dialogData = data as IManageRolesAndPrivilegesDialogData | undefined;
        const privilegeSection = values.sections.get("privileges")?.values as
            IUserAccountGlobalPrivilegesDialogSection | undefined;
        if (!dialogData || !privilegeSection) {
            return;
        }

        const privileges = privilegeSection.privileges.value?.selectedPrivileges ?? [];
        try {
            await backend.setMySQLUserGlobalPrivileges(dialogData.user, dialogData.host, privileges);
        } catch (err) {
            const message = convertErrorToString(err);
            void ui.showErrorMessage("Cannot update global privileges: " + message, {});
        } finally {
            await this.loadUsers();
        }
    };

    private createObjectPrivilegesDialogValues = (data: IObjectPrivilegeEditorData): IDialogValues => {
        const section: IDialogSection = {
            values: {
                privileges: {
                    type: "custom",
                    component: <ObjectPrivilegeEditor />,
                    value: data,
                    horizontalSpan: 8,
                },
            },
        };

        return {
            id: "userAccountObjectPrivileges",
            sections: new Map<string, IDialogSection>([
                ["privileges", section],
            ]),
        };
    };

    private createManageRolesAndPrivilegesDialogValues(
        roleValues: IDialogValues,
        globalPrivilegesValues: IDialogValues,
        objectPrivilegesValues: IDialogValues,
        activeTab: ManageRolesAndPrivilegesTab,
    ): IDialogValues {
        const sections: Array<[ManageRolesAndPrivilegesTab, IDialogSection, string]> = [
            ["roles", roleValues.sections.get("roles")!, "Roles"],
            ["globalPrivileges", globalPrivilegesValues.sections.get("privileges")!, "Global Privileges"],
            ["objectPrivileges", objectPrivilegesValues.sections.get("privileges")!, "Object Privileges"],
        ];

        sections.forEach(([id, section, caption]) => {
            section.caption = caption;
            section.groupName = "rolesAndPrivileges";
            section.active = id === activeTab;
            section.expand = true;
        });

        return {
            id: "manageRolesAndPrivileges",
            sections: new Map(sections.map(([id, section]) => {
                return [id, section];
            })),
        };
    }

    private showManageObjectPrivilegesDialog(row: RowComponent): Promise<void> {
        return this.showManageRolesAndPrivilegesDialog(row, "objectPrivileges");
    }

    private async showManageRolesAndPrivilegesDialog(
        row: RowComponent, activeTab: ManageRolesAndPrivilegesTab,
    ): Promise<void> {
        const { backend } = this.props;
        if (!backend) {
            return;
        }

        const rowData = row.getData() as IUserAccountsState["rows"][number];
        const { user, host } = rowData;

        try {
            const globalPrivilegesValues = await this.createGlobalPrivilegesDialogValuesForRow(backend, rowData);
            const objectPrivilegeData = await this.createObjectPrivilegeEditorData(backend, rowData);
            const roleValues = this.createRoleDialogValuesForRow(rowData);
            const roleSection = roleValues.sections.get("roles")?.values as
                IUserAccountRolesDialogSection | undefined;
            const globalPrivilegeSection = globalPrivilegesValues.sections.get("privileges")?.values as
                IUserAccountGlobalPrivilegesDialogSection | undefined;
            const initialRoles = roleSection?.roles.value?.selectedRoles ?? [];
            const initialDefaultRoles = roleSection?.roles.value?.defaultRoles ?? [];
            const initialGlobalPrivileges = globalPrivilegeSection?.privileges.value?.selectedPrivileges ?? [];

            this.manageRolesAndPrivilegesDialogRef.current?.show(
                this.createManageRolesAndPrivilegesDialogValues(
                    roleValues,
                    globalPrivilegesValues,
                    this.createObjectPrivilegesDialogValues(objectPrivilegeData),
                    activeTab,
                ),
                {
                    title: `Roles and Privileges for ${user}@${host}`,
                },
                {
                    user,
                    host,
                    initialRoles,
                    initialDefaultRoles,
                    initialGlobalPrivileges,
                },
            );
        } catch (err) {
            const message = convertErrorToString(err);
            void ui.showErrorMessage("Cannot load roles and privileges: " + message, {});
        }
    }

    private handleObjectPrivilegesDialogClose = async (
        closure: DialogResponseClosure, values: IDialogValues, data?: IDictionary,
    ): Promise<void> => {
        if (closure !== DialogResponseClosure.Accept) {
            return;
        }

        const { backend } = this.props;
        if (!backend) {
            return;
        }

        const dialogData = data as IManageRolesAndPrivilegesDialogData | undefined;
        const privilegeSection = values.sections.get("privileges")?.values as
            IUserAccountObjectPrivilegesDialogSection | undefined;
        if (!dialogData || !privilegeSection) {
            return;
        }

        const privilegeData = privilegeSection.privileges.value;
        if (!privilegeData) {
            return;
        }

        try {
            await this.saveChangedObjectPrivileges(backend, dialogData.user, dialogData.host, privilegeData);
        } catch (err) {
            const message = convertErrorToString(err);
            void ui.showErrorMessage("Cannot update object privileges: " + message, {});
        } finally {
            await this.loadUsers();
        }
    };

    private handleManageRolesAndPrivilegesDialogClose = async (
        closure: DialogResponseClosure, values: IDialogValues, data?: IDictionary,
    ): Promise<boolean> => {
        if (closure !== DialogResponseClosure.Accept) {
            return false;
        }

        const { backend } = this.props;
        if (!backend) {
            return false;
        }

        const dialogData = data as IManageRolesAndPrivilegesDialogData | undefined;
        const roleSection = values.sections.get("roles")?.values as IUserAccountRolesDialogSection | undefined;
        const globalPrivilegeSection = values.sections.get("globalPrivileges")?.values as
            IUserAccountGlobalPrivilegesDialogSection | undefined;
        const objectPrivilegeSection = values.sections.get("objectPrivileges")?.values as
            IUserAccountObjectPrivilegesDialogSection | undefined;
        if (!dialogData || !roleSection || !globalPrivilegeSection || !objectPrivilegeSection) {
            return false;
        }

        const roles = roleSection.roles.value?.selectedRoles ?? [];
        const defaultRoles = roleSection.roles.value?.defaultRoles ?? [];
        const globalPrivileges = globalPrivilegeSection.privileges.value?.selectedPrivileges ?? [];
        const objectPrivileges = objectPrivilegeSection.privileges.value;
        if (!objectPrivileges) {
            return false;
        }

        let updatedSection = "account roles";
        try {
            if (!this.samePrivilegeList(roles, dialogData.initialRoles)
                || !this.samePrivilegeList(defaultRoles, dialogData.initialDefaultRoles)) {
                await backend.setMySQLUserRoles(dialogData.user, dialogData.host, roles, defaultRoles);
            }

            if (!this.samePrivilegeList(globalPrivileges, dialogData.initialGlobalPrivileges)) {
                updatedSection = "global privileges";
                await backend.setMySQLUserGlobalPrivileges(dialogData.user, dialogData.host, globalPrivileges);
            }

            updatedSection = "object privileges";
            await this.saveChangedObjectPrivileges(backend, dialogData.user, dialogData.host, objectPrivileges);
        } catch (err) {
            const message = convertErrorToString(err);
            void ui.showErrorMessage(`Cannot update ${updatedSection}: ${message}`, {});

            return false;
        } finally {
            await this.loadUsers();
        }

        return true;
    };

    private async createObjectPrivilegeEditorData(
        backend: ShellInterfaceSqlEditor, rowData: IUserAccountsState["rows"][number],
    ): Promise<IObjectPrivilegeEditorData> {
        const directPrivilegeState = this.objectPrivilegeState(rowData);
        const availableSchemas = new Set((await backend.getCatalogObjects("Schema")).filter((schema) => {
            return !this.isObjectPrivilegeSystemSchema(schema);
        }));
        const schemaNames = new Set(availableSchemas);
        const addSchemaName = (schema: string): void => {
            if (!this.isObjectPrivilegeSystemSchema(schema)) {
                schemaNames.add(schema);
            }
        };
        Object.keys(directPrivilegeState.direct.schema).forEach((schema) => {
            addSchemaName(schema);
        });
        Object.keys(rowData.partialRevokes).forEach((schema) => {
            addSchemaName(schema);
        });
        rowData.tablePrivileges.forEach(({ schema }) => {
            addSchemaName(schema);
        });
        rowData.routinePrivileges.forEach(({ schema }) => {
            addSchemaName(schema);
        });
        rowData.columnPrivileges.forEach(({ schema }) => {
            addSchemaName(schema);
        });

        const schemas = [...schemaNames].sort((left, right) => {
            return this.compareStrings(left, right);
        });
        const targets = schemas.map((schema) => {
            return this.schemaTarget(schema, availableSchemas.has(schema));
        });

        const catalogs = await this.objectPrivilegeCatalogs(backend, directPrivilegeState.direct);
        const privilegeState = await this.effectiveObjectPrivilegeState(
            backend, rowData, targets, catalogs, directPrivilegeState,
        );
        // The editor represents direct account grants. Keep inherited grants as metadata
        // for their indicators and restrictions, but do not preselect them as editable grants.
        const privileges = this.cloneObjectPrivilegeMaps(privilegeState.direct);
        const originalPrivileges = this.cloneObjectPrivilegeMaps(privilegeState.direct);
        const partialRevokePrivileges = this.partialRevokePrivilegesForTargets(rowData, targets, catalogs);
        const selectedTargetId = this.defaultSelectedObjectTargetId(schemas, targets, privileges);

        return {
            catalogs,
            schemas,
            targets,
            privileges,
            originalPrivileges,
            directPrivileges: this.cloneObjectPrivilegeMaps(privilegeState.direct),
            inheritedPrivileges: this.cloneObjectPrivilegeMaps(privilegeState.inherited),
            roleInheritedPrivileges: this.cloneObjectPrivilegeMaps(privilegeState.roleInherited),
            restrictedPrivileges: this.cloneObjectPrivilegeMaps(privilegeState.restricted),
            partialRevokePrivileges,
            originalPartialRevokePrivileges: this.cloneObjectPrivilegeMaps(partialRevokePrivileges),
            readonlyPrivileges: this.cloneObjectPrivilegeMaps(privilegeState.readonly),
            partialRevokesEnabled: this.state.partialRevokesEnabled,
            selectedTargetId,
            loadSchemaTargets: async (schema) => {
                return this.loadObjectPrivilegeSchemaTargets(
                    backend, rowData, schema, catalogs, directPrivilegeState,
                );
            },
            loadTableColumns: async (schema, table) => {
                return this.loadObjectPrivilegeTableColumns(
                    backend, rowData, schema, table, catalogs, directPrivilegeState,
                );
            },
        };
    }

    private async loadObjectPrivilegeSchemaTargets(
        backend: ShellInterfaceSqlEditor,
        rowData: IUserAccountsState["rows"][number],
        schema: string,
        catalogs: IObjectPrivilegeCatalogs,
        directPrivilegeState: IObjectPrivilegeState,
    ): Promise<IObjectPrivilegeTargetLoadResult> {
        const availableTargets = await this.safeListObjectPrivilegeSchemaTargets(backend, schema);
        const availableTables = new Set(availableTargets.filter((target) => {
            return target.kind === "table";
        }).map((target) => {
            return target.objectName;
        }));
        const tableNames = new Set(availableTables);
        const routineTargets = new Map<string, {
            routine: string;
            routineType: "FUNCTION" | "PROCEDURE";
            available: boolean;
        }>();
        this.grantedObjectsForSchema(rowData.tablePrivileges, schema).forEach((table) => {
            tableNames.add(table);
        });
        this.grantedColumnsForSchema(rowData.columnPrivileges, schema).forEach(({ table }) => {
            tableNames.add(table);
        });
        const tablesWithGrantedColumns = new Set(this.grantedColumnsForSchema(
            rowData.columnPrivileges, schema,
        ).map(({ table }) => {
            return table;
        }));
        availableTargets.forEach((target) => {
            if (target.kind === "routine" &&
                (target.routineType === "FUNCTION" || target.routineType === "PROCEDURE")) {
                const key = JSON.stringify([target.objectName, target.routineType]);
                routineTargets.set(key, {
                    routine: target.objectName,
                    routineType: target.routineType,
                    available: true,
                });
            }
        });
        this.grantedRoutinesForSchema(rowData.routinePrivileges, schema).forEach(({ routine, routineType }) => {
            const key = JSON.stringify([routine, routineType]);
            if (!routineTargets.has(key)) {
                routineTargets.set(key, { routine, routineType, available: false });
            }
        });
        const targets = [
            ...[...tableNames].sort((left, right) => {
                return this.compareStrings(left, right);
            }).map((table) => {
                return this.tableTarget(
                    schema,
                    table,
                    availableTables.has(table),
                    availableTables.has(table) || tablesWithGrantedColumns.has(table),
                );
            }),
            ...[...routineTargets.values()].sort((left, right) => {
                const byName = this.compareStrings(left.routine, right.routine);

                return byName === 0 ? this.compareStrings(left.routineType, right.routineType) : byName;
            }).map(({ routine, routineType, available }) => {
                return this.routineTarget(schema, routine, available, routineType);
            }),
        ];

        return {
            targets,
            privilegeState: await this.effectiveObjectPrivilegeState(
                backend, rowData, targets, catalogs, directPrivilegeState,
            ),
        };
    }

    private async loadObjectPrivilegeTableColumns(
        backend: ShellInterfaceSqlEditor,
        rowData: IUserAccountsState["rows"][number],
        schema: string,
        table: string,
        catalogs: IObjectPrivilegeCatalogs,
        directPrivilegeState: IObjectPrivilegeState,
    ): Promise<IObjectPrivilegeTargetLoadResult> {
        const availableColumns = await this.safeGetTableObjectNames(backend, schema, table, "Column");
        const columnNames = new Set(availableColumns);
        this.grantedColumnsForSchema(rowData.columnPrivileges, schema).filter((entry) => {
            return entry.table === table;
        }).forEach(({ column }) => {
            columnNames.add(column);
        });
        const targets = [...columnNames].sort((left, right) => {
            return this.compareStrings(left, right);
        }).map((column) => {
            return this.columnTarget(schema, table, column, availableColumns.includes(column));
        });

        return {
            targets,
            privilegeState: await this.effectiveObjectPrivilegeState(
                backend, rowData, targets, catalogs, directPrivilegeState,
            ),
        };
    }

    private async effectiveObjectPrivilegeState(
        backend: ShellInterfaceSqlEditor,
        rowData: IUserAccountsState["rows"][number],
        targets: IObjectPrivilegeEditorTarget[],
        catalogs: IObjectPrivilegeCatalogs,
        directPrivilegeState: IObjectPrivilegeState,
    ): Promise<IObjectPrivilegeState> {
        const roleInheritedSchemaPrivileges = this.inheritedRoleSchemaPrivileges(rowData);
        if (
            rowData.globalPrivileges.length === 0
            && this.inheritedGlobalPrivileges(rowData).length === 0
            && Object.keys(roleInheritedSchemaPrivileges).length === 0
        ) {
            return directPrivilegeState;
        }

        if (!await backend.isPartialRevokesEnabled()) {
            return directPrivilegeState;
        }

        const catalogPrivilegeSets = this.catalogPrivilegeSets(catalogs);
        if (!this.rowHasObjectApplicableGlobalPrivileges(rowData, catalogPrivilegeSets)
            && Object.keys(roleInheritedSchemaPrivileges).length === 0) {
            return directPrivilegeState;
        }

        return this.derivedObjectPrivilegeState(rowData, targets, catalogPrivilegeSets);
    }

    private async objectPrivilegeCatalogs(
        backend: ShellInterfaceSqlEditor, privileges: IObjectPrivilegeMaps,
    ): Promise<IObjectPrivilegeCatalogs> {
        const schemaCatalog = await this.safeListPrivilegeCatalog(() => {
            return backend.listMySQLSchemaPrivilegeCatalog();
        });

        return {
            schema: this.catalogWithCurrentPrivileges(this.filterPrivilegeCatalog(schemaCatalog, "schema"),
                privileges.schema),
            table: this.catalogWithCurrentPrivileges(this.filterPrivilegeCatalog(schemaCatalog, "table"),
                privileges.table),
            routine: this.catalogWithCurrentPrivileges(this.filterPrivilegeCatalog(schemaCatalog, "routine"),
                privileges.routine),
            column: this.catalogWithCurrentPrivileges(this.filterPrivilegeCatalog(schemaCatalog, "column"),
                privileges.column),
        };
    }

    private filterPrivilegeCatalog(
        catalog: IMySQLGlobalPrivilegeCatalogItem[], kind: ObjectPrivilegeTargetKind,
    ): IMySQLGlobalPrivilegeCatalogItem[] {
        return catalog.filter((entry) => {
            const contexts = new Set(entry.category.split(",").map((context) => {
                return context.trim().toLocaleLowerCase();
            }));

            switch (kind) {
                case "schema": {
                    return contexts.has("databases") || contexts.has("tables");
                }

                case "table": {
                    return contexts.has("tables");
                }

                case "routine": {
                    return contexts.has("functions") || contexts.has("procedures");
                }

                case "column": {
                    return contexts.has("tables") &&
                        ["SELECT", "INSERT", "UPDATE", "REFERENCES"].includes(entry.privilege);
                }
            }
        });
    }

    private partialRevokePrivilegesForTargets(
        row: IMySQLUserListItem,
        targets: IObjectPrivilegeEditorTarget[],
        catalogs: IObjectPrivilegeCatalogs,
    ): IObjectPrivilegeMaps {
        const privileges = this.emptyObjectPrivilegeMaps();
        const globalPrivileges = new Set([...row.globalPrivileges, ...this.inheritedGlobalPrivileges(row)].map(
            (privilege) => {
                return this.normalizePrivilegeName(privilege);
            },
        ));
        const catalogPrivileges = new Set(catalogs.schema.map((entry) => {
            return this.normalizePrivilegeName(entry.privilege);
        }));
        const partialRevokes = this.normalizedSchemaPrivileges(row.partialRevokes);

        targets.filter((target) => {
            return target.kind === "schema";
        }).forEach((target) => {
            const key = this.objectTargetMapKey(target);
            const restrictedPrivileges = new Set(partialRevokes[target.schema] ?? []);
            const inheritedGlobalPrivileges = [...globalPrivileges].filter((privilege) => {
                return catalogPrivileges.has(privilege) && !restrictedPrivileges.has(privilege);
            });
            if (inheritedGlobalPrivileges.length > 0) {
                privileges.schema[key] = inheritedGlobalPrivileges;
            }
        });

        return privileges;
    }

    private async safeListObjectPrivilegeSchemaTargets(
        backend: ShellInterfaceSqlEditor, schema: string,
    ): Promise<IMySQLObjectPrivilegeSchemaTarget[]> {
        try {
            return await backend.listMySQLObjectPrivilegeSchemaTargets(schema) ?? [];
        } catch {
            return [];
        }
    }

    private async safeGetTableObjectNames(
        backend: ShellInterfaceSqlEditor, schema: string, table: string, type: string,
    ): Promise<string[]> {
        try {
            return await backend.getTableObjectNames(schema, table, type);
        } catch {
            return [];
        }
    }

    private async safeListPrivilegeCatalog(
        listCatalog: () => Promise<IMySQLGlobalPrivilegeCatalogItem[] | undefined>,
    ): Promise<IMySQLGlobalPrivilegeCatalogItem[]> {
        try {
            return await listCatalog() ?? [];
        } catch {
            return [];
        }
    }

    private catalogWithCurrentPrivileges(
        catalog: IMySQLGlobalPrivilegeCatalogItem[], privilegeMap: Record<string, string[]>,
    ): IMySQLGlobalPrivilegeCatalogItem[] {
        const catalogByPrivilege = new Map<string, IMySQLGlobalPrivilegeCatalogItem>();
        catalog.forEach((entry) => {
            const privilege = this.normalizePrivilegeName(entry.privilege);
            catalogByPrivilege.set(privilege, {
                privilege,
                category: entry.category,
                description: entry.description,
            });
        });
        Object.values(privilegeMap).flat().forEach((privilege) => {
            if (!catalogByPrivilege.has(privilege)) {
                catalogByPrivilege.set(privilege, {
                    privilege,
                    category: "",
                    description: "Currently granted but not reported by SHOW PRIVILEGES.",
                });
            }
        });

        return [...catalogByPrivilege.values()].sort((left, right) => {
            return this.compareStrings(left.privilege, right.privilege);
        });
    }

    private async saveChangedObjectPrivileges(
        backend: ShellInterfaceSqlEditor, user: string, host: string, data: IObjectPrivilegeEditorData,
    ): Promise<void> {
        const kinds: ObjectPrivilegeTargetKind[] = ["schema", "table", "routine", "column"];
        for (const kind of kinds) {
            const changedKeys = new Set(this.changedObjectPrivilegeEntries(
                data.originalPrivileges[kind], data.privileges[kind],
            ).map(([key]) => {
                return key;
            }));
            if (kind === "schema") {
                this.changedObjectPrivilegeEntries(
                    (data.originalPartialRevokePrivileges ?? this.emptyObjectPrivilegeMaps()).schema,
                    (data.partialRevokePrivileges ?? this.emptyObjectPrivilegeMaps()).schema,
                ).forEach(([key]) => {
                    changedKeys.add(key);
                });
            }
            for (const key of changedKeys) {
                const target = this.objectPrivilegeApiTarget(data, kind, key);
                if (target) {
                    await backend.setMySQLUserObjectPrivileges(
                        user, host, target, this.objectPrivilegesForSave(
                            data, kind, key, data.privileges[kind][key] ?? [],
                        ),
                    );
                }
            }
        }
    }

    private objectPrivilegesForSave(
        data: IObjectPrivilegeEditorData,
        kind: ObjectPrivilegeTargetKind,
        key: string,
        privileges: string[],
    ): string[] {
        if (kind === "schema") {
            return [...new Set([
                ...privileges,
                ...((data.partialRevokePrivileges ?? this.emptyObjectPrivilegeMaps()).schema[key] ?? []),
            ])];
        }

        const inherited = new Set(data.inheritedPrivileges[kind][key]);

        return privileges.filter((privilege) => {
            return !inherited.has(privilege);
        });
    }

    private objectPrivilegeApiTarget(
        data: IObjectPrivilegeEditorData, kind: ObjectPrivilegeTargetKind, key: string,
    ): IObjectPrivilegeTarget | undefined {
        const target = data.targets.find((candidate) => {
            return candidate.kind === kind && this.objectTargetMapKey(candidate) === key;
        });

        if (!target) {
            return undefined;
        }

        return {
            kind,
            schema: target.schema,
            objectName: target.table ?? target.routine ?? null,
            routineType: target.routineType ?? null,
            column: target.column ?? null,
        };
    }

    private changedObjectPrivilegeEntries(
        original: Record<string, string[]>, current: Record<string, string[]>,
    ): Array<[string, string[]]> {
        const keys = new Set([...Object.keys(original), ...Object.keys(current)]);

        return [...keys].filter((key) => {
            return !this.samePrivilegeList(original[key] ?? [], current[key] ?? []);
        }).map((key) => {
            return [key, current[key] ?? []];
        });
    }

    private samePrivilegeList(left: string[], right: string[]): boolean {
        return this.compareStringLists(left, right) === 0;
    }

    private normalizedObjectPrivileges(rowData: IUserAccountsState["rows"][number]): IObjectPrivilegeMaps {
        return {
            schema: this.normalizedSchemaPrivileges(rowData.schemaPrivileges),
            table: this.normalizedStructuredPrivileges(rowData.tablePrivileges, (entry) => {
                return this.tableTarget(entry.schema, entry.table, true);
            }),
            routine: this.normalizedStructuredPrivileges(rowData.routinePrivileges, (entry) => {
                return this.routineTarget(
                    entry.schema, entry.routine, true, entry.routineType as "FUNCTION" | "PROCEDURE",
                );
            }),
            column: this.normalizedStructuredPrivileges(rowData.columnPrivileges, (entry) => {
                return this.columnTarget(entry.schema, entry.table, entry.column, true);
            }),
        };
    }

    private normalizedStructuredPrivileges<T extends { privileges: string[] }>(
        entries: T[], target: (entry: T) => IObjectPrivilegeEditorTarget,
    ): Record<string, string[]> {
        return Object.fromEntries(entries.map((entry) => {
            return [this.objectTargetMapKey(target(entry)), this.uniqueSortedPrivileges(entry.privileges)];
        }));
    }

    private objectPrivilegeState(rowData: IUserAccountsState["rows"][number]): IObjectPrivilegeState {
        const row = rowData as IUserAccountRow;

        return row.objectPrivilegeState ?? {
            direct: this.normalizedObjectPrivileges(rowData),
            inherited: this.emptyObjectPrivilegeMaps(),
            roleInherited: this.emptyObjectPrivilegeMaps(),
            restricted: this.emptyObjectPrivilegeMaps(),
            readonly: this.emptyObjectPrivilegeMaps(),
            effective: this.normalizedObjectPrivileges(rowData),
        };
    }

    private effectiveObjectPrivileges(rowData: IMySQLUserListItem): IObjectPrivilegeMaps {
        return this.objectPrivilegeState(rowData).effective;
    }

    private emptyObjectPrivilegeMaps(): IObjectPrivilegeMaps {
        return {
            schema: {},
            table: {},
            routine: {},
            column: {},
        };
    }

    private cloneObjectPrivilegeMaps(privileges: IObjectPrivilegeMaps): IObjectPrivilegeMaps {
        return {
            schema: this.clonePrivilegeMap(privileges.schema),
            table: this.clonePrivilegeMap(privileges.table),
            routine: this.clonePrivilegeMap(privileges.routine),
            column: this.clonePrivilegeMap(privileges.column),
        };
    }

    private clonePrivilegeMap(privileges: Record<string, string[]>): Record<string, string[]> {
        return Object.fromEntries(Object.entries(privileges).map(([key, value]) => {
            return [key, [...value]];
        }));
    }

    private defaultSelectedObjectTargetId(
        schemas: string[], targets: IObjectPrivilegeEditorTarget[], privileges: IObjectPrivilegeMaps,
    ): string {
        const grantedTarget = targets.find((target) => {
            return Object.entries(this.targetPrivilegeMap(privileges, target)).some(([key, targetPrivileges]) => {
                return key === this.objectTargetMapKey(target) && targetPrivileges.length > 0;
            });
        });
        if (grantedTarget) {
            return grantedTarget.id;
        }

        for (const target of targets) {
            if (target.kind === "schema" && target.schema === schemas[0]) {
                return target.id;
            }
        }

        return targets[0]?.id ?? "";
    }

    private targetPrivilegeMap(
        privileges: IObjectPrivilegeMaps, target: IObjectPrivilegeEditorTarget,
    ): Record<string, string[]> {
        return privileges[target.kind];
    }

    private objectTargetMapKey(target: IObjectPrivilegeEditorTarget): string {
        if (target.kind === "schema") {
            return target.schema;
        }

        if (target.kind === "routine") {
            return JSON.stringify([target.kind, target.schema, target.routine, target.routineType]);
        }

        return JSON.stringify([target.kind, target.schema, target.table, target.routine, target.column]);
    }

    private isObjectPrivilegeSystemSchema(schema: string): boolean {
        return objectPrivilegeSystemSchemas.has(schema.toLowerCase());
    }

    private schemaTarget(
        schema: string, available: boolean, hasChildren = true,
    ): IObjectPrivilegeEditorTarget {
        return {
            id: this.objectTargetId("schema", schema),
            kind: "schema",
            schema,
            label: schema,
            available,
            hasChildren,
        };
    }

    private tableTarget(
        schema: string, table: string, available: boolean, hasChildren = true,
    ): IObjectPrivilegeEditorTarget {
        return {
            id: this.objectTargetId("table", schema, table),
            kind: "table",
            schema,
            table,
            label: `${schema}.${table}`,
            available,
            hasChildren,
        };
    }

    private routineTarget(
        schema: string, routine: string, available: boolean, routineType: "FUNCTION" | "PROCEDURE",
    ): IObjectPrivilegeEditorTarget {
        return {
            id: this.objectTargetId("routine", schema, routine, undefined, routineType),
            kind: "routine",
            schema,
            routine,
            routineType,
            label: `${schema}.${routine}`,
            available,
        };
    }

    private columnTarget(
        schema: string, table: string, column: string, available: boolean,
    ): IObjectPrivilegeEditorTarget {
        return {
            id: this.objectTargetId("column", schema, table, column),
            kind: "column",
            schema,
            table,
            column,
            label: `${schema}.${table}.${column}`,
            available,
        };
    }

    private objectTargetId(
        kind: ObjectPrivilegeTargetKind,
        schema: string,
        table?: string,
        column?: string,
        routineType?: "FUNCTION" | "PROCEDURE",
    ): string {
        return kind === "routine"
            ? JSON.stringify([kind, schema, table, routineType])
            : JSON.stringify([kind, schema, table, column]);
    }

    private grantedObjectsForSchema(
        privileges: IMySQLUserListItem["tablePrivileges"], schema: string,
    ): string[] {
        return privileges.filter((entry) => {
            return entry.schema === schema;
        }).map((entry) => {
            return entry.table;
        });
    }

    private grantedRoutinesForSchema(
        privileges: IMySQLUserListItem["routinePrivileges"], schema: string,
    ): Array<{ routine: string; routineType: "FUNCTION" | "PROCEDURE" }> {
        return privileges.filter((entry) => {
            return entry.schema === schema;
        }).map(({ routine, routineType }) => {
            return { routine, routineType: routineType as "FUNCTION" | "PROCEDURE" };
        });
    }

    private grantedColumnsForSchema(
        privileges: IMySQLUserListItem["columnPrivileges"], schema: string,
    ): Array<{ table: string; column: string }> {
        return privileges.filter((entry) => {
            return entry.schema === schema;
        }).map(({ table, column }) => {
            return { table, column };
        });
    }

    private normalizedSchemaPrivileges(schemaPrivileges: Record<string, string[]>): Record<string, string[]> {
        return Object.fromEntries(Object.entries(schemaPrivileges).map(([schema, privileges]) => {
            const normalizedPrivileges = [...new Set(privileges.map((privilege) => {
                return this.normalizePrivilegeName(privilege);
            }))].sort((left, right) => {
                return this.compareStrings(left, right);
            });

            return [schema, normalizedPrivileges];
        }));
    }

    private inheritedRoleSchemaPrivileges(row: IMySQLUserListItem): Record<string, string[]> {
        const rowsByAccount = new Map(this.state.rows.map((account) => {
            return [this.accountIdentifier(account), account];
        }));
        const inheritedPrivileges: Record<string, Set<string>> = {};
        const visitedRoles = new Set<string>([this.accountIdentifier(row)]);
        const visitRole = (role: string): void => {
            if (visitedRoles.has(role)) {
                return;
            }

            visitedRoles.add(role);
            const roleRow = rowsByAccount.get(role);
            if (!roleRow) {
                return;
            }

            Object.entries(this.normalizedSchemaPrivileges(roleRow.schemaPrivileges)).forEach(
                ([schema, privileges]) => {
                    const schemaPrivileges = inheritedPrivileges[schema] ?? new Set<string>();
                    privileges.forEach((privilege) => {
                        schemaPrivileges.add(privilege);
                    });
                    inheritedPrivileges[schema] = schemaPrivileges;
                },
            );
            roleRow.roles.forEach(visitRole);
        };

        row.roles.forEach(visitRole);

        return Object.fromEntries(Object.entries(inheritedPrivileges).map(([schema, privileges]) => {
            return [
                schema,
                [...privileges].sort((left, right) => {
                    return this.compareStrings(left, right);
                }),
            ];
        }));
    }

    private filteredUserRows = (rows: IMySQLUserListItem[]): IMySQLUserListItem[] => {
        const terms = this.parseSearchTerms(this.state.searchValues.value ?? "");
        if (terms.length === 0) {
            return rows;
        }

        return rows.filter((row) => {
            return terms.every((term) => {
                return this.searchableValuesForCategory(row, term.category).some((value) => {
                    return value.includes(term.value);
                });
            });
        });
    };

    private parseSearchTerms = (query: string): IUserAccountSearchTerm[] => {
        const terms: IUserAccountSearchTerm[] = [];
        const tagExpression = /(?:^|\s)(user|host|auth|role|privilege):\s*/gi;
        let match: RegExpExecArray | null;
        let lastEnd = 0;
        let taggedCategory: UserAccountSearchCategory | undefined;

        const appendTerms = (category: UserAccountSearchCategory, value: string): void => {
            const normalized = this.normalizeSearchValue(value);
            if (!normalized) {
                return;
            }

            if (category === "all") {
                normalized.split(/\s+/).forEach((term) => {
                    terms.push({ category, value: term });
                });
            } else {
                terms.push({ category, value: normalized });
            }
        };

        while ((match = tagExpression.exec(query)) !== null) {
            appendTerms(taggedCategory ?? "all", query.slice(lastEnd, match.index));
            taggedCategory = match[1].toLowerCase() as UserAccountSearchCategory;
            lastEnd = tagExpression.lastIndex;
        }

        appendTerms(taggedCategory ?? "all", query.slice(lastEnd));

        return terms;
    };

    private searchableValuesForCategory = (
        row: IMySQLUserListItem, category: UserAccountSearchCategory,
    ): string[] => {
        const values: Record<Exclude<UserAccountSearchCategory, "all">, string[]> = {
            user: [row.user],
            host: [row.host],
            auth: [row.plugin],
            role: row.roles,
            privilege: [
                ...row.globalPrivileges,
                ...this.objectPrivilegeSearchValues(row),
            ],
        };

        const selectedValues = category === "all"
            ? Object.values(values).flat()
            : values[category];

        return selectedValues.map((value) => {
            return this.normalizeSearchValue(value);
        });
    };

    private normalizeSearchValue = (value: string): string => {
        return value.trim().toLocaleLowerCase();
    };

    private createTlsRequirements = (
        tlsMode: UserAccountTlsMode,
        tlsCipher: string,
        tlsIssuer: string,
        tlsSubject: string,
        explicitNone = false,
    ): Pick<IMySQLUser, "sslType" | "sslCipher" | "x509Issuer" | "x509Subject"> => {
        if (tlsMode === "None") {
            return {
                sslType: explicitNone ? "NONE" : null,
                sslCipher: null,
                x509Issuer: null,
                x509Subject: null,
            };
        }

        const requiresCertificate = tlsMode === "Require Certificate";
        const hasIdentityRequirement = tlsIssuer !== "" || tlsSubject !== "";

        return {
            sslType: requiresCertificate
                ? hasIdentityRequirement ? "SPECIFIED" : "X509"
                : tlsCipher ? "SPECIFIED" : "ANY",
            sslCipher: tlsCipher || null,
            x509Issuer: requiresCertificate ? tlsIssuer || null : null,
            x509Subject: requiresCertificate ? tlsSubject || null : null,
        };
    };

    private normalizePrivilegeName = (value: string): string => {
        return value.trim().toLocaleUpperCase().replace(/\s+/g, " ");
    };

    private inheritedGlobalPrivileges(row: IMySQLUserListItem): string[] {
        const rowsByAccount = new Map(this.state.rows.map((account) => {
            return [this.accountIdentifier(account), account];
        }));
        const inheritedPrivileges = new Set<string>();
        const visitedRoles = new Set<string>([this.accountIdentifier(row)]);
        const visitRole = (role: string): void => {
            if (visitedRoles.has(role)) {
                return;
            }

            visitedRoles.add(role);
            const roleRow = rowsByAccount.get(role);
            if (!roleRow) {
                return;
            }

            roleRow.globalPrivileges.forEach((privilege) => {
                inheritedPrivileges.add(this.normalizePrivilegeName(privilege));
            });
            roleRow.roles.forEach(visitRole);
        };

        row.roles.forEach(visitRole);

        return [...inheritedPrivileges].sort((left, right) => {
            return this.compareStrings(left, right);
        });
    }

    private handleCreateUser = (): void => {
        void this.showCreateUserDialog();
    };

    private showCreateUserDialog = async (): Promise<void> => {
        this.editingAccountDetails = undefined;
        this.editingAccountRow = undefined;
        this.setState({ editingAccount: null });
        const defaults = await this.loadCreateUserDefaults();
        this.createUserDialogRef.current?.show(
            CreateUserDialog.createDialogValues(this.state.authenticationPlugins, defaults),
            { title: "Create User Account" },
        );
    };

    private showGeneratedPasswordDialog = (generatedPassword: string): void => {
        this.setState({ generatedPassword, generatedPasswordVisible: false }, () => {
            this.generatedPasswordDialogRef.current?.open();
        });
    };

    private copyGeneratedPassword = (): void => {
        requisitions.writeToClipboard(this.state.generatedPassword);
    };

    private toggleGeneratedPasswordVisibility = (): void => {
        this.setState(({ generatedPasswordVisible }) => {
            return { generatedPasswordVisible: !generatedPasswordVisible };
        });
    };

    private closeGeneratedPasswordDialog = (): void => {
        this.generatedPasswordDialogRef.current?.close(false);
    };

    private handleGeneratedPasswordDialogClose = (): void => {
        this.setState({ generatedPassword: "", generatedPasswordVisible: false });
    };

    private handleCreateUserDialogClose = async (
        closure: DialogResponseClosure, values: IDialogValues,
    ): Promise<boolean> => {
        if (closure !== DialogResponseClosure.Accept) {
            return false;
        }

        const account = this.state.editingAccount;
        if (!account && !await this.confirmEmptyPassword(values)) {
            return false;
        }

        return account ? this.updateUser(values, account) : this.createUser(values);
    };

    private async confirmEmptyPassword(values: IDialogValues): Promise<boolean> {
        const { generalSection, authenticationSection } = this.getValuesBySection(values);
        if (this.ignoreEmptyPasswordConfirmationForSession || !generalSection || !authenticationSection
            || authenticationSection.randomPassword.value
            || authenticationSection.password.value !== "") {
            return true;
        }

        const user = (generalSection.userName.value ?? "").trim();
        const host = (generalSection.hostName.value ?? "").trim();
        const response = await DialogHost.showDialog({
            id: "emptyPasswordConfirmDialog",
            type: DialogType.Confirm,
            parameters: {
                title: "Confirmation",
                prompt: "Create '" + user + "'@'" + host + "' without a password?\n\n"
                    + "Unless another authentication method is configured,"
                    + " this account may be accessible without a password.\n\n"
                    + "Do you want to continue?",
                accept: "Yes",
                refuse: "No",
                default: "No",
                checkboxId: "doNotAskAgain",
                checkboxCaption: "Do not ask again for this session",
            },
        });

        if (response.closure !== DialogResponseClosure.Accept) {
            return false;
        }

        this.ignoreEmptyPasswordConfirmationForSession = response.data?.doNotAskAgain === true;

        return true;
    }

    private getValuesBySection = (values: IDialogValues): IDialogSections => {
        const generalSection = values.sections.get("general")?.values as
            IUserAccountDialogGeneralSection | undefined;
        const authenticationSection = values.sections.get("authentication")?.values as
            IUserAccountDialogAuthenticationSection | undefined;
        const tlsSection = values.sections.get("tls")?.values as
            IUserAccountDialogTlsSection | undefined;
        const resourceLimitsSection = values.sections.get("resourceLimits")?.values as
            IUserAccountDialogResourceLimitsSection | undefined;

        return { generalSection, authenticationSection, tlsSection, resourceLimitsSection };
    };

    private async createUser(values: IDialogValues): Promise<boolean> {
        const { backend } = this.props;
        if (!backend) {
            return false;
        }

        const { generalSection, authenticationSection, tlsSection, resourceLimitsSection } =
            this.getValuesBySection(values);

        if (!generalSection || !authenticationSection || !tlsSection || !resourceLimitsSection) {
            return false;
        }

        const user = (generalSection.userName.value ?? "").trim();
        const host = (generalSection.hostName.value ?? "").trim();
        const plugin = (authenticationSection.authenticationPlugin.value ?? "").trim();
        const password = authenticationSection.password.value ?? "";
        const randomPassword = authenticationSection.randomPassword.value ?? false;
        const lockAccount = generalSection.lockAccount.value ?? false;
        const comment = generalSection.comment.value ?? "";
        const tlsMode = tlsSection.tlsMode.value?.tlsMode ?? "None";
        const tlsCipher = tlsSection.tlsCipher.value?.trim() ?? "";
        const tlsIssuer = tlsSection.tlsIssuer.value?.trim() ?? "";
        const tlsSubject = tlsSection.tlsSubject.value?.trim() ?? "";
        const tlsRequirements = this.createTlsRequirements(tlsMode, tlsCipher, tlsIssuer, tlsSubject);

        const resourceLimits = {
            maxQuestions: resourceLimitsSection.maxQueriesPerHour.value ?? 0,
            maxUpdates: resourceLimitsSection.maxUpdatesPerHour.value ?? 0,
            maxConnections: resourceLimitsSection.maxConnectionsPerHour.value ?? 0,
            maxUserConnections: resourceLimitsSection.maxUserConnections.value ?? 0,
        };

        const passwordOptions = {
            passwordExpire: authenticationSection.passwordExpire.value ?? false,
            passwordLifetime: authenticationSection.passwordExpiration.value ?? 0,
            passwordReuseHistory: authenticationSection.passwordHistory.value ?? 0,
            passwordReuseInterval: authenticationSection.passwordReuseInterval.value ?? 0,
            passwordRequireCurrent: authenticationSection.lockAccount.value ?? false,
            failedLoginAttempts: authenticationSection.failedPasswordAttempts.value ?? 0,
            passwordLockTime: authenticationSection.passwordLockTime.value ?? 0,
        };

        const options: IMySQLUser = {
            user,
            host,
            plugin,
            passwordLastChanged: null,
            authString: randomPassword ? null : password,
            randomPassword,
            ...tlsRequirements,
            ...resourceLimits,
            ...passwordOptions,
            accountLocked: lockAccount,
            comment: comment || null,
        };

        try {
            const userInfo = await backend.createMySQLUser(options);
            try {
                await this.addUserAccountToGrid(user, host);
            } catch (err) {
                void ui.showErrorMessage("User account was created, but the account list could not be updated: " +
                    convertErrorToString(err), {});
            }
            if (randomPassword && userInfo?.generatedPassword) {
                this.showGeneratedPasswordDialog(userInfo.generatedPassword);
            }

            return true;
        } catch (err) {
            const message = convertErrorToString(err);
            void ui.showErrorMessage("Cannot create user account: " + message, {});

            return false;
        }
    }

    private async addUserAccountToGrid(user: string, host: string): Promise<void> {
        const account = await this.loadUserAccountListItem(user, host);
        if (!account) {
            return;
        }

        this.state.rows.push(account);
        await this.userAccountsGridRef.current?.setData([account], SetDataAction.Add);
        this.setState({ rows: this.state.rows });
    }

    private async refreshEditedUserAccountRow(user: string, host: string): Promise<void> {
        const account = await this.loadUserAccountListItem(user, host);
        if (!account) {
            return;
        }

        const row = this.editingAccountRow;
        if (!row) {
            return;
        }

        const rowData = row.getData() as IUserAccountsState["rows"][number];
        const stateAccount = this.state.rows.find((item) => {
            return item.user === rowData.user && item.host === rowData.host;
        });
        if (stateAccount) {
            Object.assign(stateAccount, account);
        }
        Object.assign(rowData, account);
        await row.update(account);
    }

    private async loadUserAccountListItem(user: string, host: string): Promise<IMySQLUserListItem | undefined> {
        const { backend } = this.props;
        if (!backend) {
            return undefined;
        }

        const accounts = await backend.listMySQLUsers() ?? [];

        return accounts.find((account) => {
            return account.user === user && account.host === host;
        });
    }

    private async showEditUserDialog(row: RowComponent, clone = false): Promise<void> {
        const { backend } = this.props;
        if (!backend) {
            return;
        }

        const rowData = row.getData() as IUserAccountsState["rows"][number];
        const { user, host } = rowData;

        try {
            const details = await backend.getMySQLUser(user, host);
            if (!details) {
                return;
            }

            const dialogValues = this.createDialogValuesFromUser(details);
            if (clone) {
                const { generalSection } = this.getValuesBySection(dialogValues);
                if (generalSection) {
                    generalSection.userName.value = `${details.user}_copy`;
                    generalSection.userName.options = generalSection.userName.options?.filter((option) => {
                        return option !== CommonDialogValueOption.ReadOnly;
                    });
                }

                this.editingAccountDetails = undefined;
                this.editingAccountRow = undefined;
                this.setState({ editingAccount: null });
                this.createUserDialogRef.current?.show(dialogValues, { title: "Clone User Account" });
            } else {
                this.editingAccountDetails = details;
                this.editingAccountRow = row;
                this.setState({ editingAccount: { user, host, comment: details.comment } });
                this.createUserDialogRef.current?.show(dialogValues, { title: "Edit User Account" });
            }
        } catch (err) {
            const message = convertErrorToString(err);
            void ui.showErrorMessage("Cannot load user account details: " + message, {});
        }
    }

    private async showUserAccountSqlDialog(row: RowComponent): Promise<void> {
        const { backend } = this.props;
        if (!backend) {
            return;
        }

        const rowData = row.getData() as IUserAccountsState["rows"][number];
        const { user, host } = rowData;
        const account = `${this.sqlStringLiteral(user)}@${this.sqlStringLiteral(host)}`;

        try {
            const createUserResult = await backend.execute(`SHOW CREATE USER ${account}`);
            const grantsResult = await backend.execute(`SHOW GRANTS FOR ${account}`);
            const createUserStatement = ((createUserResult?.rows?.[0] as string[] | undefined)?.[0] ?? "");
            const grantsStatements = (grantsResult?.rows ?? []).map((row) => {
                return (row as string[])[0];
            }).join("\n");

            const statements = [
                `-- SHOW CREATE USER ${account}\n${createUserStatement}`,
                `-- SHOW GRANTS FOR ${account}\n${grantsStatements}`,
            ].join("\n\n");
            this.viewAccountSqlDialogRef.current?.show(
                this.createUserAccountSqlDialogValues(statements),
                { title: "User Account SQL" },
            );
        } catch (err) {
            const message = convertErrorToString(err);
            void ui.showErrorMessage("Cannot load user account SQL: " + message, {});
        }
    }

    private createUserAccountSqlDialogValues(statements: string): IDialogValues {
        return {
            id: "viewUserAccountSql",
            sections: new Map<string, IDialogSection>([
                ["statements", {
                    values: {
                        statements: {
                            type: "custom",
                            component: <UserAccountSqlViewer />,
                            value: { statements },
                            horizontalSpan: 8,
                        },
                    },
                }],
            ]),
        };
    }

    private sqlStringLiteral(value: string): string {
        return `'${value.replaceAll("'", "''")}'`;
    }

    private async setUserAccountLock(row: RowComponent, lockAccount: boolean): Promise<void> {
        const { backend } = this.props;
        if (!backend) {
            return;
        }

        const rowData = row.getData() as IUserAccountsState["rows"][number];
        const { user, host } = rowData;
        const options: IMySQLUser = {
            user,
            host,
            sslType: null,
            sslCipher: null,
            x509Issuer: null,
            x509Subject: null,
            plugin: null,
            passwordExpire: null,
            passwordLastChanged: null,
            passwordLifetime: null,
            authString: null,
            randomPassword: false,
            maxQuestions: null,
            maxUpdates: null,
            maxConnections: null,
            maxUserConnections: null,
            passwordReuseHistory: null,
            passwordReuseInterval: null,
            passwordRequireCurrent: null,
            failedLoginAttempts: null,
            passwordLockTime: null,
            accountLocked: lockAccount,
            comment: null,
        };

        try {
            await backend.updateMySQLUser(options);
            const account = this.state.rows.find((item) => {
                return item.user === rowData.user && item.host === rowData.host;
            });
            if (account) {
                account.accountLocked = lockAccount;
            }
            rowData.accountLocked = lockAccount;
            await row.update({ accountLocked: lockAccount });
        } catch (err) {
            const message = convertErrorToString(err);
            void ui.showErrorMessage(`Cannot ${lockAccount ? "lock" : "unlock"} user account: ${message}`, {});
        }
    }

    private async confirmDeleteUserAccount(row: RowComponent): Promise<void> {
        const { backend } = this.props;
        if (!backend) {
            return;
        }

        const rowData = row.getData() as IUserAccountsState["rows"][number];
        const response = await ui.confirm(
            `Are you sure the user account "${this.accountIdentifier(rowData)}" should be deleted?`
            + " This operation cannot be reverted.",
            "Delete",
            "Cancel",
        );

        if (response !== "Delete") {
            return;
        }

        const { user, host } = rowData;
        try {
            await backend.deleteMySQLUser(user, host);
            await this.loadUsers();
        } catch (err) {
            const message = convertErrorToString(err);
            void ui.showErrorMessage("Cannot delete user account: " + message, {});
        }
    }

    private validateCreateUserValues = (closing: boolean, values: IDialogValues):
    Promise<IDialogValidations> => {
        const result: IDialogValidations = {
            requiredContexts: [],
            messages: {},
        };

        const { generalSection, authenticationSection, tlsSection } =
            this.getValuesBySection(values);

        if (!generalSection || !authenticationSection || !tlsSection) {
            return Promise.resolve(result);
        }

        const userName = generalSection.userName.value?.trim();
        const hostName = generalSection.hostName.value?.trim();
        const plugin = authenticationSection.authenticationPlugin.value?.trim();
        const password = authenticationSection.password.value;
        const passwordConfirmation = authenticationSection.passwordConfirmation.value;

        if (closing) {
            if (!userName) {
                result.messages.userName = "The user name must not be empty";
            }

            if (!hostName) {
                result.messages.hostName = "The host must not be empty";
            }

            if (!plugin) {
                result.messages.authenticationPlugin = "Select an authentication plugin";
            }

            if (!authenticationSection.randomPassword.value && password && passwordConfirmation !== undefined
                && password !== passwordConfirmation) {
                result.messages.passwordConfirmation = "The password confirmation does not match";
            }
        }

        return Promise.resolve(result);
    };

    private async updateUser(values: IDialogValues, account: NonNullable<IUserAccountsState["editingAccount"]>):
    Promise<boolean> {
        const { backend } = this.props;
        if (!backend) {
            return false;
        }

        const { generalSection, authenticationSection, tlsSection, resourceLimitsSection } =
            this.getValuesBySection(values);

        if (!generalSection || !authenticationSection || !tlsSection || !resourceLimitsSection) {
            return false;
        }

        if (this.editingAccountDetails && !this.hasUserUpdateChanges(values, this.editingAccountDetails)) {
            this.editingAccountDetails = undefined;
            this.setState({ editingAccount: null });

            return true;
        }

        const user = account.user;
        const host = account.host;
        const plugin = (authenticationSection.authenticationPlugin.value ?? "").trim();
        const password = authenticationSection.password.value;
        const randomPassword = authenticationSection.randomPassword.value ?? false;
        const lockAccount = generalSection.lockAccount.value ?? false;
        const comment = generalSection.comment.value ?? "";
        const tlsMode = tlsSection.tlsMode.value?.tlsMode ?? "None";
        const tlsCipherValue = tlsSection.tlsCipher.value ?? "";
        const tlsIssuerValue = tlsSection.tlsIssuer.value ?? "";
        const tlsSubjectValue = tlsSection.tlsSubject.value ?? "";
        const tlsCipher = tlsCipherValue.trim();
        const tlsIssuer = tlsIssuerValue.trim();
        const tlsSubject = tlsSubjectValue.trim();
        const tlsRequirements = this.createTlsRequirements(tlsMode, tlsCipher, tlsIssuer, tlsSubject, true);
        const originalValues = this.editingAccountDetails
            ? this.createDialogValuesFromUser(this.editingAccountDetails)
            : undefined;
        const original = originalValues ? this.getValuesBySection(originalValues) : undefined;
        const updateValue = <T,>(value: T, originalValue: T | undefined): T | null => {
            return original && value === originalValue ? null : value;
        };
        const tlsChanged = !original
            || tlsMode !== original.tlsSection?.tlsMode.value?.tlsMode
            || tlsCipherValue !== original.tlsSection.tlsCipher.value
            || tlsIssuerValue !== original.tlsSection.tlsIssuer.value
            || tlsSubjectValue !== original.tlsSection.tlsSubject.value;
        const updatedTlsRequirements = tlsChanged ? tlsRequirements : {
            sslType: null,
            sslCipher: null,
            x509Issuer: null,
            x509Subject: null,
        };

        const resourceLimits = {
            maxQuestions: updateValue(
                resourceLimitsSection.maxQueriesPerHour.value ?? 0,
                original?.resourceLimitsSection?.maxQueriesPerHour.value,
            ),
            maxUpdates: updateValue(
                resourceLimitsSection.maxUpdatesPerHour.value ?? 0,
                original?.resourceLimitsSection?.maxUpdatesPerHour.value,
            ),
            maxConnections: updateValue(
                resourceLimitsSection.maxConnectionsPerHour.value ?? 0,
                original?.resourceLimitsSection?.maxConnectionsPerHour.value,
            ),
            maxUserConnections: updateValue(
                resourceLimitsSection.maxUserConnections.value ?? 0,
                original?.resourceLimitsSection?.maxUserConnections.value,
            ),
        };

        const passwordExpiryChanged = !original
            || (authenticationSection.passwordExpire.value ?? false)
                !== original.authenticationSection?.passwordExpire.value
            || (authenticationSection.passwordExpiration.value ?? 0)
                !== original.authenticationSection.passwordExpiration.value;
        const passwordOptions = {
            passwordExpire: passwordExpiryChanged ? authenticationSection.passwordExpire.value ?? false : null,
            passwordLifetime: passwordExpiryChanged ? authenticationSection.passwordExpiration.value ?? 0 : null,
            passwordReuseHistory: updateValue(
                authenticationSection.passwordHistory.value ?? 0,
                original?.authenticationSection?.passwordHistory.value,
            ),
            passwordReuseInterval: updateValue(
                authenticationSection.passwordReuseInterval.value ?? 0,
                original?.authenticationSection?.passwordReuseInterval.value,
            ),
            passwordRequireCurrent: updateValue(
                authenticationSection.lockAccount.value ?? false,
                original?.authenticationSection?.lockAccount.value,
            ),
            failedLoginAttempts: updateValue(
                authenticationSection.failedPasswordAttempts.value ?? 0,
                original?.authenticationSection?.failedPasswordAttempts.value,
            ),
            passwordLockTime: updateValue(
                authenticationSection.passwordLockTime.value ?? 0,
                original?.authenticationSection?.passwordLockTime.value,
            ),
        };

        const authString = randomPassword ? null : (password && password.length > 0 ? password : null);
        const passwordChanged = randomPassword || authString !== null;

        const options: IMySQLUser = {
            user,
            host,
            plugin: passwordChanged || !original ? plugin : null,
            passwordLastChanged: null,
            authString,
            randomPassword: passwordChanged ? randomPassword : null,
            ...updatedTlsRequirements,
            ...resourceLimits,
            ...passwordOptions,
            accountLocked: updateValue(lockAccount, original?.generalSection?.lockAccount.value),
            // A null comment omits COMMENT from ALTER USER. Preserve an explicit
            // empty string so clearing an existing comment continues to work.
            comment: original
                ? updateValue(comment, original.generalSection?.comment.value)
                : comment === (account.comment ?? "") ? null : comment,
        };

        try {
            const userInfo = await backend.updateMySQLUser(options);
            try {
                await this.refreshEditedUserAccountRow(user, host);
            } catch (err) {
                void ui.showErrorMessage("User account was updated, but the account list could not be updated: " +
                    convertErrorToString(err), {});
            }
            this.editingAccountDetails = undefined;
            this.editingAccountRow = undefined;
            this.setState({ editingAccount: null });
            if (randomPassword && userInfo?.generatedPassword) {
                this.showGeneratedPasswordDialog(userInfo.generatedPassword);
            }

            return true;
        } catch (err) {
            const message = convertErrorToString(err);
            void ui.showErrorMessage("Cannot update user account: " + message, {});

            return false;
        }
    }

    private hasUserUpdateChanges(values: IDialogValues, original: IMySQLUser): boolean {
        const originalValues = this.createDialogValuesFromUser(original);
        const current = this.getValuesBySection(values);
        const baseline = this.getValuesBySection(originalValues);

        if (!current.generalSection || !current.authenticationSection || !current.tlsSection
            || !current.resourceLimitsSection || !baseline.generalSection || !baseline.authenticationSection
            || !baseline.tlsSection || !baseline.resourceLimitsSection) {
            return true;
        }

        const { generalSection, authenticationSection, tlsSection, resourceLimitsSection } = current;
        const {
            generalSection: originalGeneral,
            authenticationSection: originalAuthentication,
            tlsSection: originalTls,
            resourceLimitsSection: originalResourceLimits,
        } = baseline;

        return generalSection.lockAccount.value !== originalGeneral.lockAccount.value
            || generalSection.comment.value !== originalGeneral.comment.value
            || authenticationSection.randomPassword.value !== originalAuthentication.randomPassword.value
            || (authenticationSection.password.value ?? "") !== ""
            || authenticationSection.passwordExpire.value !== originalAuthentication.passwordExpire.value
            || authenticationSection.passwordExpiration.value !== originalAuthentication.passwordExpiration.value
            || authenticationSection.passwordHistory.value !== originalAuthentication.passwordHistory.value
            || authenticationSection.passwordReuseInterval.value !== originalAuthentication.passwordReuseInterval.value
            || authenticationSection.lockAccount.value !== originalAuthentication.lockAccount.value
            || authenticationSection.failedPasswordAttempts.value
                !== originalAuthentication.failedPasswordAttempts.value
            || authenticationSection.passwordLockTime.value !== originalAuthentication.passwordLockTime.value
            || tlsSection.tlsMode.value?.tlsMode !== originalTls.tlsMode.value?.tlsMode
            || tlsSection.tlsCipher.value !== originalTls.tlsCipher.value
            || tlsSection.tlsIssuer.value !== originalTls.tlsIssuer.value
            || tlsSection.tlsSubject.value !== originalTls.tlsSubject.value
            || resourceLimitsSection.maxQueriesPerHour.value !== originalResourceLimits.maxQueriesPerHour.value
            || resourceLimitsSection.maxUpdatesPerHour.value !== originalResourceLimits.maxUpdatesPerHour.value
            || resourceLimitsSection.maxConnectionsPerHour.value !== originalResourceLimits.maxConnectionsPerHour.value
            || resourceLimitsSection.maxUserConnections.value
                !== originalResourceLimits.maxUserConnections.value;
    }

    private handleRefresh = (): void => {
        void this.loadUsers();
    };

    private loadUsers = async (): Promise<void> => {
        const { backend } = this.props;

        if (!backend) {
            return;
        }

        try {
            const rows = await backend.listMySQLUsers() ?? [];
            this.setState({ rows });

            const authenticationPlugins = await this.loadAuthenticationPlugins();
            this.setState({ authenticationPlugins });

            const partialRevokesEnabled = rows.some((row) => {
                return row.globalPrivileges.length > 0;
            }) ? await backend.isPartialRevokesEnabled() : false;
            // The object privilege formatter depends on this flag. Give TreeGrid a new data reference so Tabulator
            // reformats the existing rows after the capability check completes.
            this.setState({ rows: [...rows], partialRevokesEnabled });

            const passwordValidationInstalled = await this.loadPasswordValidationInstalled();
            this.setState({ passwordValidationInstalled });
        } catch (err) {
            this.setState({
                rows: [],
                passwordValidationInstalled: false,
                partialRevokesEnabled: false,
                authenticationPlugins: [],
            });
            const message = convertErrorToString(err);
            void ui.showErrorMessage("Cannot display user accounts: " + message, {});
        }
    };

    private loadAuthenticationPlugins = async (): Promise<string[]> => {
        const { backend } = this.props;
        if (!backend) {
            return [];
        }

        try {
            return await backend.listMySQLAuthenticationPlugins() ?? [];
        } catch {
            return [];
        }
    };

    private loadCreateUserDefaults = async (): Promise<IMySQLDefaultUserOptions | undefined> => {
        const { backend } = this.props;
        if (!backend) {
            return undefined;
        }

        try {
            return await backend.getMySQLCreateUserDefaults();
        } catch {
            return undefined;
        }
    };

    private loadPasswordValidationInstalled = async (): Promise<boolean> => {
        const { backend } = this.props;
        if (!backend) {
            return false;
        }

        try {
            const result = await backend.execute("SHOW VARIABLES LIKE 'validate_password.%'");

            return (result?.rows?.length ?? 0) > 0;
        } catch {
            return false;
        }
    };

    private catalogPrivilegeSets(catalogs: IObjectPrivilegeCatalogs): Record<ObjectPrivilegeTargetKind, Set<string>> {
        return {
            schema: this.catalogPrivilegeSet(catalogs.schema),
            table: this.catalogPrivilegeSet(catalogs.table),
            routine: this.catalogPrivilegeSet(catalogs.routine),
            column: this.catalogPrivilegeSet(catalogs.column),
        };
    }

    private catalogPrivilegeSet(catalog: IMySQLGlobalPrivilegeCatalogItem[]): Set<string> {
        return new Set(catalog.map((entry) => {
            return this.normalizePrivilegeName(entry.privilege);
        }));
    }

    private rowHasObjectApplicableGlobalPrivileges(
        row: IMySQLUserListItem, catalogPrivilegeSets: Record<ObjectPrivilegeTargetKind, Set<string>>,
    ): boolean {
        return [...row.globalPrivileges, ...this.inheritedGlobalPrivileges(row)].some((privilege) => {
            const normalized = this.normalizePrivilegeName(privilege);

            return Object.values(catalogPrivilegeSets).some((catalogPrivileges) => {
                return catalogPrivileges.has(normalized);
            });
        });
    }

    private derivedObjectPrivilegeState(
        row: IMySQLUserListItem,
        targets: IObjectPrivilegeEditorTarget[],
        catalogPrivilegeSets: Record<ObjectPrivilegeTargetKind, Set<string>>,
    ): IObjectPrivilegeState {
        const direct = this.normalizedObjectPrivileges(row);
        const inherited = this.emptyObjectPrivilegeMaps();
        const roleInherited = this.emptyObjectPrivilegeMaps();
        const restricted = this.emptyObjectPrivilegeMaps();
        const readonly = this.emptyObjectPrivilegeMaps();
        const effective = this.cloneObjectPrivilegeMaps(direct);
        const partialRevokes = this.normalizedSchemaPrivileges(row.partialRevokes);
        const directGlobalPrivileges = new Set(row.globalPrivileges.map((privilege) => {
            return this.normalizePrivilegeName(privilege);
        }));
        const roleInheritedGlobalPrivileges = new Set(this.inheritedGlobalPrivileges(row));
        const roleInheritedSchemaPrivileges = this.inheritedRoleSchemaPrivileges(row);
        const globalPrivileges = new Set([...directGlobalPrivileges, ...roleInheritedGlobalPrivileges]);

        targets.forEach((target) => {
            const kind = target.kind;
            const key = this.objectTargetMapKey(target);
            const restrictedPrivilegeSet = new Set(partialRevokes[target.schema] ?? []);
            const inheritedPrivileges = [...globalPrivileges].filter((privilege) => {
                return catalogPrivilegeSets[kind].has(privilege) && !restrictedPrivilegeSet.has(privilege);
            }).sort((left, right) => {
                return this.compareStrings(left, right);
            });
            const restrictedPrivileges = [...globalPrivileges].filter((privilege) => {
                return catalogPrivilegeSets[kind].has(privilege) && restrictedPrivilegeSet.has(privilege);
            }).sort((left, right) => {
                return this.compareStrings(left, right);
            });
            const roleInheritedPrivileges = [...roleInheritedGlobalPrivileges].filter((privilege) => {
                return catalogPrivilegeSets[kind].has(privilege) && !restrictedPrivilegeSet.has(privilege);
            }).sort((left, right) => {
                return this.compareStrings(left, right);
            });
            const roleInheritedSchemaTargetPrivileges = kind === "schema"
                ? roleInheritedSchemaPrivileges[key] ?? []
                : [];
            const effectiveInheritedPrivileges = this.uniqueSortedPrivileges([
                ...inheritedPrivileges,
                ...roleInheritedSchemaTargetPrivileges,
            ]);
            const effectiveRoleInheritedPrivileges = this.uniqueSortedPrivileges([
                ...roleInheritedPrivileges,
                ...roleInheritedSchemaTargetPrivileges,
            ]);

            if (effectiveInheritedPrivileges.length > 0) {
                inherited[kind][key] = effectiveInheritedPrivileges;
                if (kind !== "schema") {
                    readonly[kind][key] = effectiveInheritedPrivileges;
                }
            }
            if (effectiveRoleInheritedPrivileges.length > 0) {
                roleInherited[kind][key] = effectiveRoleInheritedPrivileges;
            }
            if (restrictedPrivileges.length > 0) {
                restricted[kind][key] = restrictedPrivileges;
            }

            const effectivePrivileges = this.uniqueSortedPrivileges([
                ...(effective[kind][key] ?? []),
                ...effectiveInheritedPrivileges,
            ]);
            if (effectivePrivileges.length > 0) {
                effective[kind][key] = effectivePrivileges;
            }
        });

        return { direct, inherited, roleInherited, restricted, readonly, effective };
    }

    private uniqueSortedPrivileges(privileges: string[]): string[] {
        return [...new Set(privileges.map((privilege) => {
            return this.normalizePrivilegeName(privilege);
        }))].sort((left, right) => {
            return this.compareStrings(left, right);
        });
    }

    private createDialogValuesFromUser = (details: IMySQLUser): IDialogValues => {
        const authenticationPlugins = details.plugin
            ? [...this.state.authenticationPlugins, details.plugin]
            : this.state.authenticationPlugins;
        const values = CreateUserDialog.createDialogValues(authenticationPlugins);
        const { generalSection, authenticationSection, tlsSection, resourceLimitsSection } =
            this.getValuesBySection(values);

        if (!generalSection || !authenticationSection || !tlsSection || !resourceLimitsSection) {
            return values;
        }

        generalSection.userName.value = details.user;
        generalSection.hostName.value = details.host;
        authenticationSection.authenticationPlugin.value = details.plugin ?? "";
        generalSection.lockAccount.value = details.accountLocked ?? false;
        generalSection.comment.value = details.comment ?? "";

        const setValueOption = (key: string, option: CommonDialogValueOption): void => {
            const value = values.sections.get("general")?.values[key];
            if (value) {
                value.options = [...(value.options ?? []), option];
            }
        };

        setValueOption("userName", CommonDialogValueOption.ReadOnly);
        setValueOption("hostName", CommonDialogValueOption.ReadOnly);
        authenticationSection.authenticationPlugin.options = [
            ...(authenticationSection.authenticationPlugin.options ?? []),
            CommonDialogValueOption.Disabled,
        ];

        authenticationSection.passwordExpiration.value = details.passwordLifetime ?? 0;
        authenticationSection.passwordExpire.value = details.passwordExpire ?? false;
        authenticationSection.passwordHistory.value = details.passwordReuseHistory ?? 0;
        authenticationSection.passwordReuseInterval.value = details.passwordReuseInterval ?? 0;
        authenticationSection.lockAccount.value = details.passwordRequireCurrent ?? false;
        authenticationSection.failedPasswordAttempts.value = details.failedLoginAttempts ?? 0;
        authenticationSection.passwordLockTime.value = details.passwordLockTime ?? 0;

        const hasCertificateRequirement = details.sslType === "X509"
            || (details.x509Issuer ?? "").trim() !== ""
            || (details.x509Subject ?? "").trim() !== "";
        const tlsMode = hasCertificateRequirement
            ? "Require Certificate"
            : details.sslType && details.sslType !== ""
                ? "Required"
                : "None";
        tlsSection.tlsMode.value = { tlsMode };
        tlsSection.tlsCipher.value = details.sslCipher ?? "";
        tlsSection.tlsIssuer.value = details.x509Issuer ?? "";
        tlsSection.tlsSubject.value = details.x509Subject ?? "";

        resourceLimitsSection.maxQueriesPerHour.value = details.maxQuestions ?? 0;
        resourceLimitsSection.maxUpdatesPerHour.value = details.maxUpdates ?? 0;
        resourceLimitsSection.maxConnectionsPerHour.value = details.maxConnections ?? 0;
        resourceLimitsSection.maxUserConnections.value = details.maxUserConnections ?? 0;

        return values;
    };

    private accountIdentifier(account: Pick<IMySQLUserListItem, "user" | "host">): string {
        return `${account.user}@${account.host}`;
    }

    private statusSorter: UserAccountSorter = (_a, _b, aRow, bRow): number => {
        return this.compareStrings(this.statusSortText(aRow), this.statusSortText(bRow));
    };

    private userNameSorter: UserAccountSorter = (_a, _b, aRow, bRow): number => {
        return this.compareStrings(
            this.userNameSortText(aRow),
            this.userNameSortText(bRow),
        );
    };

    private hostMatcherSorter: UserAccountSorter = (_a, _b, aRow, bRow): number => {
        return this.compareStrings(
            this.hostMatcherSortText(aRow),
            this.hostMatcherSortText(bRow),
        );
    };

    private sslSorter: UserAccountSorter = (_a, _b, aRow, bRow): number => {
        return this.compareNumbers(this.sslSortValue(aRow), this.sslSortValue(bRow));
    };

    private rolesSorter: UserAccountSorter = (_a, _b, aRow, bRow): number => {
        return this.compareStringLists(this.userAccountRow(aRow).roles, this.userAccountRow(bRow).roles);
    };

    private globalPrivilegesSorter: UserAccountSorter = (_a, _b, aRow, bRow): number => {
        return this.compareStringLists(
            this.userAccountRow(aRow).globalPrivileges,
            this.userAccountRow(bRow).globalPrivileges,
        );
    };

    private objectPrivilegesSorter: UserAccountSorter = (_a, _b, aRow, bRow): number => {
        const left = this.objectPrivilegeSortValue(this.userAccountRow(aRow));
        const right = this.objectPrivilegeSortValue(this.userAccountRow(bRow));
        const countComparison = this.compareNumbers(left.count, right.count);

        return countComparison === 0 ? this.compareStrings(left.text, right.text) : countComparison;
    };

    private userAccountRow(row: RowComponent): IMySQLUserListItem {
        return row.getData() as IMySQLUserListItem;
    }

    private statusSortText(row: RowComponent): string {
        return this.userAccountRow(row).accountLocked ? "Locked" : "Unlocked";
    }

    private userNameSortText(row: RowComponent): string {
        return this.userAccountRow(row).user;
    }

    private hostMatcherSortText(row: RowComponent): string {
        return this.userAccountRow(row).host;
    }

    private sslSortValue(row: RowComponent): number {
        const sslOptions = this.userAccountRow(row).sslOptions;
        if (!sslOptions) {
            return 0;
        }

        return sslOptions.requiresCertificate ? 2 : 1;
    }

    private objectPrivilegeSortValue(row: IMySQLUserListItem): IUserAccountScopedPrivilegeSortValue {
        const entries = this.directObjectPrivilegeEntries(row);
        const text = entries.reduce((value, [identifier, privileges]) => {
            const sortedPrivileges = [...privileges].sort((left, right) => {
                return this.compareStrings(left, right);
            });

            return value + `${identifier}:${sortedPrivileges.join(",")}\n`;
        }, "");

        return { count: this.directObjectPrivilegeCount(entries), text };
    }

    private directObjectPrivilegeEntries(row: IMySQLUserListItem): Array<[string, string[]]> {
        return this.scopedPrivilegeEntries(this.objectPrivilegeState(row).direct,
            this.objectPrivilegeTargetLabels(row));
    }

    private objectPrivilegeTargetLabels(row: IMySQLUserListItem): Map<string, string> {
        const labels = new Map<string, string>();

        Object.keys(row.schemaPrivileges).forEach((schema) => {
            labels.set(schema, schema);
        });
        row.tablePrivileges.forEach(({ schema, table }) => {
            const target = this.tableTarget(schema, table, true);
            labels.set(this.objectTargetMapKey(target), target.label);
        });
        row.routinePrivileges.forEach(({ schema, routine, routineType }) => {
            const target = this.routineTarget(schema, routine, true, routineType as "FUNCTION" | "PROCEDURE");
            labels.set(this.objectTargetMapKey(target), target.label);
        });
        row.columnPrivileges.forEach(({ schema, table, column }) => {
            const target = this.columnTarget(schema, table, column, true);
            labels.set(this.objectTargetMapKey(target), target.label);
        });

        return labels;
    }

    private directObjectPrivilegeCount(entries: Array<[string, string[]]>): number {
        return entries.reduce((count, [, privileges]) => {
            return count + privileges.length;
        }, 0);
    }

    private objectPrivilegeEntries(row: IMySQLUserListItem): Array<[string, string[]]> {
        return this.scopedPrivilegeEntries(this.effectiveObjectPrivileges(row));
    }

    private scopedPrivilegeEntries(
        privilegeMaps: IObjectPrivilegeMaps, targetLabels?: Map<string, string>,
    ): Array<[string, string[]]> {
        return this.scopedPrivilegeMaps(privilegeMaps).flatMap((privileges) => {
            return Object.entries(privileges).map<[string, string[]]>(([identifier, values]) => {
                return [targetLabels?.get(identifier) ?? identifier, values];
            });
        }).sort(([left], [right]) => {
            return this.compareStrings(left, right);
        });
    }

    private scopedPrivilegeMaps(privilegeMaps: IObjectPrivilegeMaps): UserAccountScopedPrivileges[] {
        return [
            privilegeMaps.schema,
            privilegeMaps.table,
            privilegeMaps.column,
            privilegeMaps.routine,
        ];
    }

    private objectPrivilegeSearchValues(row: IMySQLUserListItem): string[] {
        const directValues = this.objectPrivilegeEntries(row).flatMap(([identifier, privileges]) => {
            return [
                identifier,
                ...privileges,
                `${identifier}: ${privileges.join(", ")}`,
            ];
        });

        return [
            ...directValues,
            ...this.partialRevokeSearchValues(row),
        ];
    }

    private partialRevokeSearchValues(row: IMySQLUserListItem): string[] {
        return Object.entries(row.partialRevokes).flatMap(([schema, privileges]) => {
            return [
                schema,
                ...privileges,
                `${schema}: ${privileges.join(", ")}`,
            ];
        });
    }

    private passwordExpirationDaysLeft(value: string | null | undefined): number | undefined {
        if (!value) {
            return undefined;
        }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dt = new Date(value);
        if (isNaN(dt.getTime())) {
            return undefined;
        }

        const exp = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
        const msPerDay = 24 * 60 * 60 * 1000;

        return Math.ceil((exp.getTime() - today.getTime()) / msPerDay);
    }

    private isPasswordExpired(row: IMySQLUserListItem): boolean {
        if (row.passwordExpired) {
            return true;
        }

        const daysLeft = this.passwordExpirationDaysLeft(row.passwordExpiration);

        return daysLeft !== undefined && daysLeft < 0;
    }

    private compareStringLists(left: string[], right: string[]): number {
        const lengthComparison = this.compareNumbers(left.length, right.length);

        return lengthComparison === 0
            ? this.compareStrings([...left].sort().join("\n"), [...right].sort().join("\n"))
            : lengthComparison;
    }

    private compareStrings(left: string | null | undefined, right: string | null | undefined): number {
        return (left ?? "").localeCompare(right ?? "", undefined, { sensitivity: "base", numeric: true });
    }

    private compareNumbers(left: number, right: number): number {
        return left - right;
    }

    private statusFormatter = (cell: CellComponent): HTMLElement => {
        type IUserRow = IUserAccountsState["rows"][number];
        const data = cell.getRow().getData() as IUserRow;

        if (data.accountLocked || data.temporarilyLocked) {
            return this.renderIntoHost(this.renderStatusPill("LOCKED", "off", Codicon.Lock));
        }

        if (this.isPasswordExpired(data)) {
            return this.renderIntoHost(this.renderStatusPill("EXPIRED", "off", Codicon.Warning));
        }

        const daysLeft = this.passwordExpirationDaysLeft(data.passwordExpiration);
        if (daysLeft !== undefined && daysLeft <= 30) {
            const tooltip = `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;

            return this.renderIntoHost(this.renderStatusPill("EXPIRING", "warning", Codicon.Warning, tooltip));
        }

        return this.renderIntoHost(this.renderStatusPill("UNLOCKED", "on", Codicon.Unlock));
    };

    private userNameFormatter = (cell: CellComponent): string => {
        type IUserRow = IUserAccountsState["rows"][number];
        const data = cell.getRow().getData() as IUserRow;

        return data.user;
    };

    private hostMatcherFormatter = (cell: CellComponent): string => {
        type IUserRow = IUserAccountsState["rows"][number];
        const data = cell.getRow().getData() as IUserRow;

        return data.host;
    };

    private sslFormatter = (cell: CellComponent): HTMLElement | string => {
        type IUserRow = IUserAccountsState["rows"][number];
        const data = cell.getRow().getData() as IUserRow;

        if (data.sslOptions === null) {
            return this.renderIntoHost(this.renderStatusPill("Not required", "none"));
        }

        const { requiresCertificate, x509Issuer, x509Subject, sslCipher } = data.sslOptions;

        const details: string[] = [];
        if (x509Issuer) {
            // TODO: i18n?
            details.push(`issuer: ${x509Issuer}`);
        }
        if (x509Subject) {
            // TODO: i18n?
            details.push(`subject: ${x509Subject}`);
        }
        if (sslCipher) {
            // TODO: i18n?
            details.push(`cipher: ${sslCipher}`);
        }

        return this.renderIntoHost(this.renderStatusPill(requiresCertificate ? "CERT REQUIRED" : "REQUIRED",
            requiresCertificate ? "info" : "on", undefined, details.length > 0 ? details.join("\n") : undefined));
    };

    private rolesFormatter = (cell: CellComponent): HTMLElement => {
        type IUserRow = IUserAccountsState["rows"][number];
        const data = cell.getRow().getData() as IUserRow;
        const list = data.roles;

        return this.renderIntoHost(this.renderStatusPill(String(list.length),
            list.length > 0 ? "on" : "none", undefined, this.tooltipList(list)));
    };

    private globalPrivilegesFormatter = (cell: CellComponent): HTMLElement => {
        type IUserRow = IUserAccountsState["rows"][number];
        const data = cell.getRow().getData() as IUserRow;
        const list = data.globalPrivileges;

        return this.renderIntoHost(this.renderStatusPill(String(list.length),
            list.length > 0 ? "on" : "none", undefined, this.tooltipList(list)));
    };

    private objectPrivilegesFormatter = (cell: CellComponent): HTMLElement => {
        type IUserRow = IUserAccountsState["rows"][number];
        const data = cell.getRow().getData() as IUserRow;
        const entries = this.directObjectPrivilegeEntries(data);
        const total = this.directObjectPrivilegeCount(entries);
        const inheritedGlobalPrivileges = this.compactInheritedGlobalPrivileges(data);
        const tooltipLines = entries.flatMap(([identifier, privileges]) => {
            const sortedPrivileges = [...privileges].sort((left, right) => {
                return this.compareStrings(left, right);
            });

            return sortedPrivileges.map((privilege) => {
                return `${identifier}: ${privilege}`;
            });
        });
        if (inheritedGlobalPrivileges.length > 0) {
            const globalPrivilegesTooltipItems = inheritedGlobalPrivileges.slice(0, 10);
            if (inheritedGlobalPrivileges.length > globalPrivilegesTooltipItems.length) {
                globalPrivilegesTooltipItems.push("...");
            }
            tooltipLines.push(`Inherited from global privileges: ${globalPrivilegesTooltipItems.join(", ")}`);
        }
        const partialRevokeLines = this.partialRevokeTooltipLines(data);
        if (partialRevokeLines.length > 0) {
            tooltipLines.push(...partialRevokeLines);
        }
        const hasPrivileges = total > 0 || inheritedGlobalPrivileges.length > 0;
        const text = inheritedGlobalPrivileges.length > 0
            ? total > 0 ? `${total}+global` : "global"
            : String(total);

        return this.renderIntoHost(this.renderStatusPill(text,
            hasPrivileges ? "on" : "none", undefined, this.tooltipList(tooltipLines)));
    };

    private compactInheritedGlobalPrivileges(row: IMySQLUserListItem): string[] {
        if (!this.state.partialRevokesEnabled) {
            return [];
        }

        return [...new Set(row.globalPrivileges.map((privilege) => {
            return this.normalizePrivilegeName(privilege);
        }))].sort((left, right) => {
            return this.compareStrings(left, right);
        });
    }

    private partialRevokeTooltipLines(row: IMySQLUserListItem): string[] {
        if (!this.state.partialRevokesEnabled) {
            return [];
        }

        return Object.entries(row.partialRevokes).sort(([left], [right]) => {
            return this.compareStrings(left, right);
        }).map(([schema, privileges]) => {
            const sortedPrivileges = [...privileges].sort((left, right) => {
                return this.compareStrings(left, right);
            });

            return `Partially revoked on ${schema}: ${sortedPrivileges.join(", ")}`;
        });
    }
}
