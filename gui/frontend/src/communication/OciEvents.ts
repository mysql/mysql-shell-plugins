/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

import { IAuthenticationDetails, IComputeInstance, IGenericResponse } from ".";
import { IBastionSession, IBastionSummary, IBastion, ICompartment, IMySQLDbSystem, ILoadBalancer } from "./Oci";

import { IDispatchEvent } from "../supplement/Dispatch";

export interface IOciComputeInstanceData extends IGenericResponse {
    result: IComputeInstance[];
}

export interface IOciBastionSessionData extends IGenericResponse {
    result: IBastionSession;
}

export interface IOciBastionSummaryData extends IGenericResponse {
    result: IBastionSummary;
}

export interface IOciBastionsListData extends IGenericResponse {
    result: IBastionSummary[];
}

export interface IOciBastionData extends IGenericResponse {
    result: IBastion;
}

export interface IOciMySQLDbSystemData extends IGenericResponse {
    result: IMySQLDbSystem;
}

export interface IOciMySQLDbSystemListData extends IGenericResponse {
    result: IMySQLDbSystem[];
}

export interface IOciCompartmentData extends IGenericResponse {
    result: ICompartment[];
}

export interface IOciAuthenticationDetailData extends IGenericResponse {
    result: IAuthenticationDetails[];
}

export interface IOciLoadBalancersListData extends IGenericResponse {
    result: ILoadBalancer[];
}

export type ICommOciComputeInstanceEvent = IDispatchEvent<IOciComputeInstanceData>;

export type ICommOciSessionResultEvent = IDispatchEvent<IOciBastionSessionData>;
export type ICommOciBastionSummaryEvent = IDispatchEvent<IOciBastionSummaryData>;
export type ICommOciBastionsEvent = IDispatchEvent<IOciBastionsListData>;
export type ICommOciBastionEvent = IDispatchEvent<IOciBastionData>;

export type ICommOciMySQLDbSystemEvent = IDispatchEvent<IOciMySQLDbSystemData>;
export type ICommOciMySQLDbSystemListEvent = IDispatchEvent<IOciMySQLDbSystemListData>;

export type ICommOciCompartmentEvent = IDispatchEvent<IOciCompartmentData>;

export type ICommOciAuthenticationDetailsEvent = IDispatchEvent<IOciAuthenticationDetailData>;

export type ICommOciLoadBalancersEvent = IDispatchEvent<IOciLoadBalancersListData>;
