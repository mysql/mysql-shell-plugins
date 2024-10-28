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

import { Event, EventEmitter, ProviderResult, TreeDataProvider, TreeItem, window } from "vscode";

import { requisitions } from "../../../../frontend/src/supplement/Requisitions.js";
import type {
    IRequestListEntry, IRequestTypeMap, IWebviewProvider,
} from "../../../../frontend/src/supplement/RequisitionTypes.js";

import { ICompartment } from "../../../../frontend/src/communication/index.js";

import { MessageScheduler } from "../../../../frontend/src/communication/MessageScheduler.js";
import { IMdsProfileData } from "../../../../frontend/src/communication/ProtocolMds.js";
import {
    ShellInterfaceShellSession,
} from "../../../../frontend/src/supplement/ShellInterface/ShellInterfaceShellSession.js";
import {
    OciBastionTreeItem, OciCompartmentTreeItem, OciComputeInstanceTreeItem, OciConfigProfileTreeItem,
    OciDbSystemTreeItem, OciLoadBalancerTreeItem,
} from "./index.js";
import { OciDbSystemHWTreeItem } from "./OciDbSystemHWTreeItem.js";
import { OciDbSystemStandaloneTreeItem } from "./OciDbSystemStandaloneTreeItem.js";
import { OciHWClusterTreeItem } from "./OciHWClusterTreeItem.js";

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
        requisitions.register("proxyRequest", this.proxyRequest);
    }

    public dispose(): void {
        requisitions.register("proxyRequest", this.proxyRequest);
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
                    && element.dbSystem.heatWaveCluster.lifecycleState !== "DELETED") {
                    return [new OciHWClusterTreeItem(element.profile, element.compartment, element.dbSystem)];
                } else {
                    return [];
                }
            }
        }
    }

    private async listConfigProfiles(): Promise<TreeItem[]> {
        const profiles = await this.shellSession.mhs.getMdsConfigProfiles();

        return profiles.map((profile) => {
            return new OciConfigProfileTreeItem(profile);
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

    private async listCompartments(profile: IMdsProfileData, startWithCurrent?: boolean,
        compartmentId?: string): Promise<TreeItem[]> {
        const items: OciCompartmentTreeItem[] = [];

        // If the compartments for the given profile are already cached, use the cache.
        if (this.compartmentCache[profile.profile]) {
            this.compartmentCache[profile.profile].forEach((subCompartment) => {
                this.addOciCompartmentTreeItem(
                    items, profile, subCompartment, startWithCurrent, compartmentId);
            });

            return items;
        }

        // If the compartments have not been cached yet, fetch them.
        try {
            const compartments = await this.shellSession.mhs.getMdsCompartments(profile.profile);
            this.compartmentCache[profile.profile] = compartments;
            this.compartmentCache[profile.profile].forEach((subCompartment) => {
                this.addOciCompartmentTreeItem(items, profile, subCompartment, startWithCurrent, compartmentId);
            });
        } catch (reason) {
            const msg: string = reason?.data?.requestState?.msg;
            if (msg && msg.includes("NotAuthorizedOrNotFound")) {
                window.setStatusBarMessage("Not authorized to list the sub-compartment of this compartment.", 5000);
            }
        }

        return items;
    }

    private async listDatabases(profile: IMdsProfileData, compartment: ICompartment): Promise<TreeItem[]> {
        const items: OciDbSystemTreeItem[] = [];

        try {
            const systems = await this.shellSession.mhs.getMdsMySQLDbSystems(profile.profile, compartment.id);
            systems.forEach((dbSystem) => {
                if (dbSystem.isSupportedForHwCluster || dbSystem.isSupportedForAnalyticsCluster) {
                    items.push(new OciDbSystemHWTreeItem(profile, compartment, dbSystem));
                } else {
                    items.push(new OciDbSystemStandaloneTreeItem(profile, compartment, dbSystem));
                }
            });
        } catch (reason) {
            const msg: string = reason?.data?.requestState?.msg;
            if (msg && msg.includes("NotAuthorizedOrNotFound")) {
                window.setStatusBarMessage("Not authorized to list the MySQL DB Systems in this compartment.", 5000);
            }
        }

        return items;
    }

    private async listComputeInstances(profile: IMdsProfileData, compartment: ICompartment): Promise<TreeItem[]> {
        const items: OciComputeInstanceTreeItem[] = [];

        try {
            const instances = await this.shellSession.mhs.getMdsComputeInstances(profile.profile, compartment.id);
            instances.forEach((compute) => {
                items.push(new OciComputeInstanceTreeItem(profile, compartment, compute, this.shellSession));
            });
        } catch (reason) {
            const msg: string = reason?.data?.requestState?.msg;
            if (msg && msg.includes("NotAuthorizedOrNotFound")) {
                window.setStatusBarMessage("Not authorized to list the compute instances in this compartment.", 5000);
            }
        }

        return items;
    }

    private async listBastionHosts(profile: IMdsProfileData, compartment: ICompartment): Promise<TreeItem[]> {
        const items: OciBastionTreeItem[] = [];

        try {
            const bastions = await this.shellSession.mhs.getMdsBastions(profile.profile, compartment.id);
            bastions.forEach((bastion) => {
                items.push(new OciBastionTreeItem(profile, compartment, bastion));
            });
        } catch (reason) {
            const msg: string = reason?.data?.requestState?.msg;
            if (msg && msg.includes("NotAuthorizedOrNotFound")) {
                window.setStatusBarMessage("Not authorized to list the bastions in this compartment.", 5000);
            }
        }

        return items;
    }

    private async listLoadBalancers(profile: IMdsProfileData, compartment: ICompartment): Promise<TreeItem[]> {
        const items: OciLoadBalancerTreeItem[] = [];

        try {
            const loadBalancers = await this.shellSession.mhs.listLoadBalancers(profile.profile, compartment.id);
            loadBalancers.forEach((loadBalancer) => {
                items.push(new OciLoadBalancerTreeItem(profile, compartment, loadBalancer));
            });
        } catch (reason) {
            const msg: string = reason?.data?.requestState?.msg;
            if (msg && msg.includes("NotAuthorizedOrNotFound")) {
                window.setStatusBarMessage("Not authorized to list the load balancers in this compartment.", 5000);
            }
        }

        return items;
    }

    private proxyRequest = (request: {
        provider: IWebviewProvider;
        original: IRequestListEntry<keyof IRequestTypeMap>;
    }): Promise<boolean> => {
        switch (request.original.requestType) {
            case "refreshOciTree": {
                this.refresh();

                return Promise.resolve(true);
            }

            default:
        }

        return Promise.resolve(false);
    };
}
