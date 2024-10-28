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

import {
    type BastionSummary, type Bastion, type PortForwardingSessionTargetResourceDetails, type Session,
    type SessionSummary,
} from "../oci-typings/oci-bastion/lib/model/index.js";

import { Instance, Shape } from "../oci-typings/oci-core/lib/model/index.js";
import { Compartment } from "../oci-typings/oci-identity/lib/model/index.js";
import { DbSystem } from "../oci-typings/oci-mysql/lib/model/db-system.js";
import { ShapeSummary } from "../oci-typings/oci-mysql/lib/model/shape-summary.js";
import { BucketSummary, ListObjects, type ObjectSummary } from "../oci-typings/oci-objectstorage/lib/model/index.js";

export { BastionLifecycleState } from "../oci-typings/oci-bastion/lib/model/bastion-lifecycle-state.js";
export { LoadBalancer } from "../oci-typings/oci-loadbalancer/lib/model/load-balancer.js";
export { DbSystem };

// Re-export certain types from oci-typings with a leading I for consistency with the rest of the codebase.
export type IComputeInstance = Instance;
export type IComputeShape = Shape;
export type IBastion = Bastion;
export type IMySQLDbSystemShapeSummary = ShapeSummary;
export type IPortForwardingSessionTargetResourceDetails = PortForwardingSessionTargetResourceDetails;
export type IBastionSession = Session;

export interface ICompartment extends Compartment {
    isCurrent: boolean;
}

export type IBucketSummary = BucketSummary;
export type IBucketListObjects = ListObjects;
export type IBucketObjectSummary = ObjectSummary;

export interface IBastionSummary extends BastionSummary {
    isCurrent: boolean;
    sessions: SessionSummary;
}

export interface IMySQLDbSystem extends DbSystem {
    isSupportedForHwCluster?: boolean;
    isSupportedForAnalyticsCluster?: boolean;
}
