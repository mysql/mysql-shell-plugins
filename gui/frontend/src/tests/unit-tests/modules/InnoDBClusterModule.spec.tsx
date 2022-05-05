/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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

import { mount } from "enzyme";
import React from "react";
import { InnoDBClusterModule } from "../../../modules/innodb-cluster/InnoDBClusterModule";
import { IModuleProperties } from "../../../modules/ModuleBase";
import { InnoDBClusterModuleId } from "../../../modules/ModuleInfo";
import { snapshotFromWrapper } from "../test-helpers";
import Icon from "../../../assets/images/modules/module-cluster.svg";


describe("InnoDb cluster module tests", (): void => {

    it("Test InnoDBClusterModule instantiation", () => {
        const innerRef = React.createRef<HTMLButtonElement>();
        const component = mount<IModuleProperties>(
            <InnoDBClusterModule
                innerRef={innerRef}
            />,
        );
        const props = component.props();
        expect(props.innerRef).toEqual(innerRef);
        expect(InnoDBClusterModule.info).toStrictEqual({
            id: InnoDBClusterModuleId,
            caption: "InnoDB",
            icon: Icon,
        });
        expect(snapshotFromWrapper(component)).toMatchSnapshot();
        component.unmount();
    });

});
