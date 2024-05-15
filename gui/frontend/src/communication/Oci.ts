/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

import { models as coreModels } from "oci-core";
import * as common from "oci-common";
import { models as bastionModels } from "oci-bastion";
import { models as mySQLModels } from "oci-mysql";
import { models as identityModels } from "oci-identity";
import { models as loadBalancerModels } from "oci-loadbalancer";
import { models as objectstorageModels } from "oci-objectstorage";

export type IAuthenticationDetails = common.AuthenticationDetailsProvider;

export type IComputeInstance = coreModels.Instance;
export type ICompartment = identityModels.Compartment & {
    isCurrent: boolean;
};

export type IBucketSummary = objectstorageModels.BucketSummary;
export type IBucketListObjects = objectstorageModels.ListObjects;
export type IBucketObjectSummary = objectstorageModels.ObjectSummary;

export type IComputeShape = coreModels.Shape;

export type IBastionSession = bastionModels.Session;
export type IBastionSummary = bastionModels.BastionSummary & {
    isCurrent: boolean;
    sessions: bastionModels.SessionSummary;
};

export type IBastion = bastionModels.Bastion;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const BastionLifecycleState = bastionModels.BastionLifecycleState;

export type IMySQLDbSystem = mySQLModels.DbSystem & {
    isSupportedForHwCluster?: boolean;
    isSupportedForAnalyticsCluster?: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace DBSystem {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    export const LifecycleState = mySQLModels.DbSystem.LifecycleState;
}

export type IMySQLDbSystemShapeSummary = mySQLModels.ShapeSummary;
export type ILoadBalancer = loadBalancerModels.LoadBalancer;

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace LoadBalancer {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    export const LifecycleState = loadBalancerModels.LoadBalancer.LifecycleState;
}

export type IPortForwardingSessionTargetResourceDetails = bastionModels.PortForwardingSessionTargetResourceDetails;
