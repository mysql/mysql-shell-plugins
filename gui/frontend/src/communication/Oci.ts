/*
 * Copyright (c) 2021, 2026, Oracle and/or its affiliates.
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

import { type Bastion } from "../oci-typings/oci-bastion/lib/model/bastion.js";
import { type BastionSummary } from "../oci-typings/oci-bastion/lib/model/bastion-summary.js";
import {
    type PortForwardingSessionTargetResourceDetails,
} from "../oci-typings/oci-bastion/lib/model/port-forwarding-session-target-resource-details.js";
import { type Session } from "../oci-typings/oci-bastion/lib/model/session.js";
import { type SessionSummary } from "../oci-typings/oci-bastion/lib/model/session-summary.js";

import { Instance } from "../oci-typings/oci-core/lib/model/instance.js";
import { Shape } from "../oci-typings/oci-core/lib/model/shape.js";
import { Subnet } from "../oci-typings/oci-core/lib/model/subnet.js";
import { Vcn } from "../oci-typings/oci-core/lib/model/vcn.js";

import { AvailabilityDomain } from "../oci-typings/oci-identity/lib/model/availability-domain.js";
import { Compartment } from "../oci-typings/oci-identity/lib/model/compartment.js";
import { DbSystem } from "../oci-typings/oci-mysql/lib/model/db-system.js";
import { ShapeSummary } from "../oci-typings/oci-mysql/lib/model/shape-summary.js";
import { BucketSummary } from "../oci-typings/oci-objectstorage/lib/model/bucket-summary.js";
import { ListObjects } from "../oci-typings/oci-objectstorage/lib/model/list-objects.js";
import { type ObjectSummary } from "../oci-typings/oci-objectstorage/lib/model/object-summary.js";

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
export type IVcn = Vcn
export type ISubnet = Subnet;

export type IAvailabilityDomain = AvailabilityDomain;

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
