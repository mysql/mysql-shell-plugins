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

import { Checkbox, CheckState } from "../../components/ui/Checkbox/Checkbox.js";
import { ClickEventCallback } from "../../components/ui/Component/ComponentBase.js";
import "./UserFilterGrid.css";

import { Component, VNode } from "preact";

interface IAccount {
    caption: string;
    isIncluded: boolean;
    onToggle?: ClickEventCallback;
}
interface IUserFilterGridProps {
    accounts: IAccount[];
}
export class UserFilterGrid extends Component<IUserFilterGridProps> {
    public override render(): VNode {
        const { accounts } = this.props;

        return (
            <div className="account-filter-grid">
                <table className="account-filter-grid-table">
                    <thead>
                        <tr>
                            <th key="account" className="account-filter-grid-account-column">Account</th>
                        </tr>
                    </thead>
                    <tbody>
                        {accounts.map(({ caption, isIncluded, onToggle }) => {
                            return (
                                <tr key={caption}>
                                    <td className="account-filter-grid-account-column">
                                        <Checkbox
                                            className="account-filter-exclude-account"
                                            checkState={isIncluded ? CheckState.Checked : CheckState.Unchecked}
                                            onClick={onToggle}
                                            caption={caption} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    }
}
