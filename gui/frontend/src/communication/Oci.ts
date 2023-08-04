/*
 * Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

import { models as coreModels } from "../oci-typings/oci-core";
import * as  common from "../oci-typings/oci-common/index";
import { models as bastionModels } from "../oci-typings/oci-bastion";
import { models as mySQLModels } from "../oci-typings/oci-mysql";
import { models as identityModels } from "../oci-typings/oci-identity";
import { models as loadBalancerModels } from "../oci-typings/oci-loadbalancer";

export type IAuthenticationDetails = common.AuthenticationDetailsProvider;

export type IComputeInstance = coreModels.Instance;
export type ICompartment = identityModels.Compartment & {
    isCurrent: boolean;
};

export type IComputeShape = coreModels.Shape;

export type IBastionSession = bastionModels.Session;
export type IBastionSummary = bastionModels.BastionSummary & {
    isCurrent: boolean;
    sessions: bastionModels.SessionSummary;
};

export type IBastion = bastionModels.Bastion;
export type IMySQLDbSystem = mySQLModels.DbSystem & {
    isSupportedForHwCluster?: boolean;
    isSupportedForAnalyticsCluster?: boolean;
};
export type IMySQLDbSystemShapeSummary = mySQLModels.ShapeSummary;
export type ILoadBalancer = loadBalancerModels.LoadBalancer;

export type IPortForwardingSessionTargetResourceDetails = bastionModels.PortForwardingSessionTargetResourceDetails;
