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

import { TreeDataProvider, TreeItem, EventEmitter, ProviderResult, Event, window } from "vscode";

import { requisitions } from "../../../../frontend/src/supplement/Requisitions";

import {
    ICommOciBastionsEvent, ICommOciCompartmentEvent, ICommOciComputeInstanceEvent,
    ICommMdsConfigProfileEvent, ICommOciMySQLDbSystemListEvent, IMdsProfileData, ICompartment,
    ICommOciLoadBalancersEvent,
    MessageScheduler,
} from "../../../../frontend/src/communication";

import { EventType } from "../../../../frontend/src/supplement/Dispatch";

import { ShellInterfaceShellSession } from "../../../../frontend/src/supplement/ShellInterface";
import {
    OciConfigProfileTreeItem, OciCompartmentTreeItem, OciDbSystemTreeItem, OciComputeInstanceTreeItem,
    OciBastionTreeItem, OciLoadBalancerTreeItem,
} from ".";
import { OciDbSystemHWTreeItem } from "./OciDbSystemHWTreeItem";
import { OciDbSystemStandaloneTreeItem } from "./OciDbSystemStandaloneTreeItem";
import { OciHWClusterTreeItem } from "./OciHWClusterTreeItem";

// An interface for the compartment cache
interface IConfigProfileCompartments {
    [key: string]: ICompartment[];
}

// A class to provide the entire tree structure for Oracle Cloud Infrastructure connections.
export class OciTreeDataProvider implements TreeDataProvider<TreeItem> {
    private changeEvent = new EventEmitter<TreeItem | undefined>();

    private shellSession = new ShellInterfaceShellSession();

    // The cache of compartments for each config profile
    private compartmentCache: IConfigProfileCompartments = {};

    public constructor() {
        requisitions.register("refreshOciTree", this.refreshOciTree);
    }

    public dispose(): void {
        requisitions.unregister("refreshOciTree", this.refreshOciTree);
    }

    public get onDidChangeTreeData(): Event<TreeItem | undefined> {
        return this.changeEvent.event;
    }

    public refresh(item?: TreeItem): void {
        // Reset compartments cache
        this.compartmentCache = {};
        void this.listConfigProfiles().then(() => {
            this.changeEvent.fire(item);
        });
    }

    public getTreeItem(element: TreeItem): TreeItem {
        return element;
    }

    public getChildren(element?: TreeItem): ProviderResult<TreeItem[]> {
        if (MessageScheduler.get.isConnected) {
            if (!element) {
                return this.listConfigProfiles();
            }

            if (element instanceof OciConfigProfileTreeItem) {
                return this.listCompartments(element.profile, true, element.profile.tenancy);
            }

            if (element instanceof OciCompartmentTreeItem) {
                return new Promise((resolve, reject) => {
                    Promise.all([
                        this.listCompartments(element.profile, false, element.compartment.id),
                        this.listDatabases(element.profile, element.compartment),
                        this.listComputeInstances(element.profile, element.compartment),
                        this.listBastionHosts(element.profile, element.compartment),
                        this.listLoadBalancers(element.profile, element.compartment),
                    ]).then(([compartmentItems, databaseItems, computeInstanceItems,
                        bastionHostItems, loadBalancerItems]) => {
                        resolve([
                            ...compartmentItems, ...databaseItems, ...computeInstanceItems,
                            ...bastionHostItems, ...loadBalancerItems,
                        ]);
                    }).catch((reason) => {
                        reject(reason);
                    });
                });
            }

            if (element instanceof OciDbSystemHWTreeItem) {
                if (element.dbSystem.heatWaveCluster
                    && element.dbSystem.heatWaveCluster.lifecycleState !== "DELETED" ) {
                    return [new OciHWClusterTreeItem(element.profile, element.compartment, element.dbSystem)];
                } else {
                    return [];
                }
            }
        }
    }

    private listConfigProfiles(): Promise<TreeItem[]> {
        return new Promise((resolve, reject) => {
            this.shellSession.mds.getMdsConfigProfiles().then((event: ICommMdsConfigProfileEvent) => {
                if (event.eventType === EventType.FinalResponse) {
                    if (event.data) {
                        const items = event.data.result.map((profile) => {
                            return new OciConfigProfileTreeItem(profile);
                        });

                        resolve(items);
                    }

                    resolve([]);
                }
            }).catch((reason) => {
                reject(reason);
            });
        });
    }

    private addOciCompartmentTreeItem(items: OciCompartmentTreeItem[], profile: IMdsProfileData,
        compartment: ICompartment, startWithCurrent?: boolean, parentId?: string) {
        if (startWithCurrent && compartment.isCurrent) {
            items.unshift(new OciCompartmentTreeItem(profile, compartment/*, TreeItemCollapsibleState.Expanded*/));
        } else if ((startWithCurrent && compartment.id === parentId) ||
            (!startWithCurrent && parentId && compartment.compartmentId === parentId) ||
            (!startWithCurrent && !parentId)) {
            items.push(new OciCompartmentTreeItem(profile, compartment));
        }
    }

    private listCompartments(profile: IMdsProfileData,
        startWithCurrent?: boolean, compartmentId?: string): Promise<TreeItem[]> {
        return new Promise((resolve) => {
            const items: OciCompartmentTreeItem[] = [];

            // If the compartments for the given profile are already cached, use the cache.
            if (this.compartmentCache[profile.profile]) {
                this.compartmentCache[profile.profile].forEach((subCompartment) => {
                    this.addOciCompartmentTreeItem(
                        items, profile, subCompartment, startWithCurrent, compartmentId);
                });

                resolve(items);
            } else {
                // If the compartments have not been cached yet, fetch them.
                this.shellSession.mds.getMdsCompartments(profile.profile).then((event: ICommOciCompartmentEvent) => {
                    if (event.eventType === EventType.FinalResponse) {
                        if (event.data) {
                            this.compartmentCache[profile.profile] = event.data.result;

                            this.compartmentCache[profile.profile].forEach((subCompartment) => {
                                this.addOciCompartmentTreeItem(
                                    items, profile, subCompartment, startWithCurrent, compartmentId);
                            });
                        }

                        resolve(items);
                    }
                }).catch((reason) => {
                    const msg: string = reason?.data?.requestState?.msg;
                    if (msg && msg.includes("NotAuthorizedOrNotFound")) {
                        window.setStatusBarMessage(
                            "Not authorized to list the sub-compartment of this compartment.", 5000);
                    }
                    resolve(items);
                });
            }
        });
    }

    private listDatabases(profile: IMdsProfileData, compartment: ICompartment): Promise<TreeItem[]> {
        return new Promise((resolve) => {
            const items: OciDbSystemTreeItem[] = [];

            this.shellSession.mds.getMdsMySQLDbSystems(profile.profile, compartment.id)
                .then((event: ICommOciMySQLDbSystemListEvent) => {
                    if (event.eventType === EventType.FinalResponse) {
                        if (event.data) {
                            event.data.result.forEach((dbSystem) => {
                                if (dbSystem.heatWaveCluster === null) {
                                    items.push(new OciDbSystemStandaloneTreeItem(profile, compartment, dbSystem));
                                } else {
                                    items.push(new OciDbSystemHWTreeItem(profile, compartment, dbSystem));
                                }
                            });
                        }

                        resolve(items);
                    }
                }).catch((reason) => {
                    const msg: string = reason?.data?.requestState?.msg;
                    if (msg && msg.includes("NotAuthorizedOrNotFound")) {
                        window.setStatusBarMessage(
                            "Not authorized to list the MySQL DB Systems in this compartment.", 5000);
                    }
                    resolve(items);
                });
        });

    }

    private listComputeInstances(profile: IMdsProfileData, compartment: ICompartment): Promise<TreeItem[]> {
        return new Promise((resolve) => {
            const items: OciComputeInstanceTreeItem[] = [];

            this.shellSession.mds.getMdsComputeInstances(
                profile.profile, compartment.id)
                .then((event: ICommOciComputeInstanceEvent) => {
                    if (event.eventType === EventType.FinalResponse) {
                        if (event.data) {
                            event.data.result.forEach((compute) => {
                                items.push(new OciComputeInstanceTreeItem(
                                    profile, compartment, compute, this.shellSession));
                            });
                        }

                        resolve(items);
                    }
                }).catch((reason) => {
                    const msg: string = reason?.data?.requestState?.msg;
                    if (msg && msg.includes("NotAuthorizedOrNotFound")) {
                        window.setStatusBarMessage(
                            "Not authorized to list the compute instances in this compartment.", 5000);
                    }
                    resolve(items);
                });
        });
    }

    private listBastionHosts(profile: IMdsProfileData, compartment: ICompartment): Promise<TreeItem[]> {
        return new Promise((resolve) => {
            const items: OciBastionTreeItem[] = [];

            this.shellSession.mds.getMdsBastions(
                profile.profile, compartment.id)
                .then((event: ICommOciBastionsEvent) => {
                    if (event.eventType === EventType.FinalResponse) {
                        if (event.data) {
                            event.data.result.forEach((bastion) => {
                                items.push(new OciBastionTreeItem(profile, compartment, bastion));
                            });
                        }

                        resolve(items);
                    }
                }).catch((reason) => {
                    const msg: string = reason?.data?.requestState?.msg;
                    if (msg && msg.includes("NotAuthorizedOrNotFound")) {
                        window.setStatusBarMessage(
                            "Not authorized to list the bastions in this compartment.", 5000);
                    }
                    resolve(items);
                });
        });
    }

    private listLoadBalancers(profile: IMdsProfileData, compartment: ICompartment): Promise<TreeItem[]> {
        return new Promise((resolve) => {
            const items: OciLoadBalancerTreeItem[] = [];

            this.shellSession.mds.listLoadBalancers(
                profile.profile, compartment.id)
                .then((event: ICommOciLoadBalancersEvent) => {
                    if (event.eventType === EventType.FinalResponse) {
                        if (event.data) {
                            event.data.result.forEach((loadBalancer) => {
                                items.push(new OciLoadBalancerTreeItem(profile, compartment, loadBalancer));
                            });
                        }

                        resolve(items);
                    }
                }).catch((reason) => {
                    const msg: string = reason?.data?.requestState?.msg;
                    if (msg && msg.includes("NotAuthorizedOrNotFound")) {
                        window.setStatusBarMessage(
                            "Not authorized to list the load balancers in this compartment.", 5000);
                    }
                    resolve(items);
                });
        });
    }

    private refreshOciTree = (): Promise<boolean> => {
        this.refresh();

        return Promise.resolve(true);
    };

}
