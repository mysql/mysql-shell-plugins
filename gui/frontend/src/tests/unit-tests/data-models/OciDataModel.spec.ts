/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
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

/* eslint-disable @typescript-eslint/unbound-method */ // Don't want to make the UI layer methods properties.

import { registerUiLayer } from "../../../app-logic/UILayer.js";
import type { IMdsProfileData } from "../../../communication/ProtocolMds.js";
import {
    BastionLifecycleState,
    DbSystem, ICompartment, LoadBalancer, type IBastionSummary, type IComputeInstance, type IMySQLDbSystem,
} from "../../../communication/index.js";
import { OciDataModel, OciDmEntityType } from "../../../data-models/OciDataModel.js";
import { BastionDnsProxyStatus } from "../../../oci-typings/oci-bastion/lib/model/bastion-dns-proxy-status.js";
import { SessionLifecycleState } from "../../../oci-typings/oci-bastion/lib/model/session-lifecycle-state.js";
import { Instance } from "../../../oci-typings/oci-core/lib/model/instance.js";
import { Compartment } from "../../../oci-typings/oci-identity/lib/model/compartment.js";
import { DeletionPolicyDetails } from "../../../oci-typings/oci-mysql/lib/model/deletion-policy-details.js";
import { uiLayerMock } from "../__mocks__/UILayerMock.js";
import { checkNoUiWarningsOrErrors } from "../test-helpers.js";

const dataModelChanged = jest.fn();

const profile1: IMdsProfileData = {
    fingerprint: "fingerprint",
    keyFile: "keyFile",
    profile: "DEFAULT",
    region: "us-phoenix-1",
    tenancy: "tenancy",
    user: "user",
    isCurrent: false,
};

const compartment1: ICompartment = {
    id: "root",
    compartmentId: "root",
    name: "compartment1",
    description: "description",
    timeCreated: new Date(),
    isCurrent: true,
    lifecycleState: Compartment.LifecycleState.Active,
};

/** The data model entry created from the profile record. */
const ociProfile1 = {
    id: expect.any(String),
    state: expect.objectContaining({ expanded: false, expandedOnce: false, isLeaf: false, initialized: false }),
    caption: "DEFAULT (us-phoenix-1)",
    type: OciDmEntityType.ConfigurationProfile,
    profileData: expect.objectContaining(profile1),
    compartments: expect.any(Array),
};

const dbSystem1: IMySQLDbSystem = {
    id: "dbSystem1",
    displayName: "dbSystem1",
    compartmentId: "root",
    subnetId: "subnet1",
    mysqlVersion: "8.4",
    dataStorageSizeInGBs: 100,
    lifecycleState: DbSystem.LifecycleState.Active,
    maintenance: {},
    deletionPolicy: {
        automaticBackupRetention: DeletionPolicyDetails.AutomaticBackupRetention.Delete,
        finalBackup: DeletionPolicyDetails.FinalBackup.RequireFinalBackup,
        isDeleteProtected: true,
    },
    timeCreated: new Date("2024-01-01"),
    timeUpdated: new Date("2024-01-01"),
    isSupportedForHwCluster: true,
    heatWaveCluster: {
        shapeName: "HeatWaveClusterShape",
        clusterSize: 1,
        isLakehouseEnabled: true,
        lifecycleState: "ACTIVE",
        timeCreated: new Date("2024-01-01"),
        timeUpdated: new Date("2024-01-01"),
    },
};

const dbSystem2: IMySQLDbSystem = {
    id: "dbSystem1",
    displayName: "dbSystem1",
    compartmentId: "root",
    subnetId: "subnet1",
    mysqlVersion: "8.4",
    dataStorageSizeInGBs: 100,
    lifecycleState: DbSystem.LifecycleState.Active,
    maintenance: {},
    deletionPolicy: {
        automaticBackupRetention: DeletionPolicyDetails.AutomaticBackupRetention.Delete,
        finalBackup: DeletionPolicyDetails.FinalBackup.RequireFinalBackup,
        isDeleteProtected: false,
    },
    timeCreated: new Date("2024-01-01"),
    timeUpdated: new Date("2024-01-01"),
    isSupportedForHwCluster: false,
};

const computeInstance1: IComputeInstance = {
    id: "computeInstance1",
    displayName: "computeInstance1",
    compartmentId: "root",
    shape: "VM.Standard2.1",
    timeCreated: new Date("2024-01-01"),
    availabilityDomain: "availabilityDomain",
    capacityReservationId: "capacityReservationId",
    faultDomain: "faultDomain",
    region: "region1",
    timeMaintenanceRebootDue: new Date("2024-01-01"),
    instanceConfigurationId: "instanceConfigurationId",
    lifecycleState: Instance.LifecycleState.Running,
};

const bastion1: IBastionSummary = {
    bastionType: "Bastion",
    id: "bastion1",
    name: "bastion1",
    compartmentId: "root",
    targetVcnId: "vcn1",
    targetSubnetId: "subnet1",
    dnsProxyStatus: BastionDnsProxyStatus.Enabled,
    timeCreated: new Date("2024-01-01"),
    timeUpdated: new Date("2024-01-01"),
    lifecycleState: BastionLifecycleState.Active,
    isCurrent: true,
    sessions: {
        id: "session1",
        bastionName: "bastion1",
        bastionId: "bastion1",
        targetResourceDetails: {
            sessionType: "DynamicPortForwarding",
        },
        timeCreated: new Date("2024-01-01"),
        lifecycleState: SessionLifecycleState.Active,
        sessionTtlInSeconds: 100,
    },
};

const loadBalancer1: LoadBalancer = {
    id: "loadBalancer1",
    displayName: "loadBalancer1",
    compartmentId: "root",
    lifecycleState: LoadBalancer.LifecycleState.Active,
    shapeName: "shape",
    timeCreated: new Date("2024-01-01"),
    isPrivate: false,
};

jest.mock("../../../supplement/ShellInterface/ShellInterfaceMhs.js", () => {
    return {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        ShellInterfaceMhs: jest.fn().mockImplementation(() => {
            return {
                getMdsConfigProfiles: jest.fn().mockResolvedValue([
                    profile1,
                ]),
                setDefaultConfigProfile: jest.fn(),
                setDefaultConfigCompartment: jest.fn(),
                setCurrentCompartment: jest.fn(),
                getMdsCompartments: jest.fn().mockResolvedValue([compartment1]),
                setCurrentDepartment: jest.fn(),
                getMdsMySQLDbSystems: jest.fn().mockResolvedValue([dbSystem1, dbSystem2]),
                getMdsComputeInstances: jest.fn().mockResolvedValue([computeInstance1]),
                getMdsBastions: jest.fn().mockResolvedValue([bastion1]),
                listLoadBalancers: jest.fn().mockResolvedValue([loadBalancer1]),
                setCurrentBastion: jest.fn(),
            };
        }),
    };
});

describe("OciDataModel", () => {
    const dataModel = new OciDataModel();
    const updateProfileSpy = jest.spyOn(dataModel, "updateProfiles");
    dataModel.subscribe(dataModelChanged);

    beforeAll(async () => {
        registerUiLayer(uiLayerMock);
        await dataModel.initialize();
    });

    afterAll(() => {
        dataModel.unsubscribe(dataModelChanged);

        jest.restoreAllMocks();
        jest.unmock("../../../supplement/ShellInterface/ShellInterfaceMhs.js");
    });

    beforeEach(() => {
        jest.clearAllMocks();
        dataModelChanged.mockClear();
    });

    it("Initialization", async () => {
        expect(dataModel.profiles).toHaveLength(1);
        await dataModel.updateProfiles();
        expect(updateProfileSpy).toHaveBeenCalledTimes(1);
        expect(dataModel.profiles).toEqual(
            expect.arrayContaining([expect.objectContaining(ociProfile1)]),
        );

        checkNoUiWarningsOrErrors();
    });

    it("Basic functionality", async () => {
        await dataModel.profiles[0].makeDefault();
        const kids = dataModel.profiles[0].getChildren?.();
        expect(kids).toHaveLength(0);

        await dataModel.updateProfiles();
        expect(updateProfileSpy).toHaveBeenCalledTimes(1);

        expect(dataModelChanged).toHaveBeenCalledTimes(0);
        await dataModel.profiles[0].refresh?.();
        expect(updateProfileSpy).toHaveBeenCalledTimes(1);
        expect(dataModelChanged).toHaveBeenCalledTimes(1);

        checkNoUiWarningsOrErrors();
    });

    it("Profiles", async () => {
        await dataModel.profiles[0].refresh?.();

        const profile = dataModel.profiles[0];
        expect(profile.profileData).toEqual(profile1);

        expect(profile.compartments).toHaveLength(1);

        const compartment = profile.compartments[0];
        expect(compartment.caption).toBe("compartment1");

        checkNoUiWarningsOrErrors();
    });

    it("Compartments", async () => {
        await dataModel.profiles[0].refresh?.();

        const profile = dataModel.profiles[0];
        const compartment = profile.compartments[0];
        expect(compartment.caption).toBe("compartment1");

        expect(compartment.compartments).toEqual([]);
        expect(compartment.dbSystems).toEqual([]);
        expect(compartment.heatWaveClusters).toEqual([]);
        expect(compartment.computeInstances).toEqual([]);
        expect(compartment.bastions).toEqual([]);
        expect(compartment.loadBalancers).toEqual([]);

        expect(compartment.getChildren?.()).toEqual([]);

        await compartment.makeCurrent();
        expect(dataModelChanged).toHaveBeenCalledTimes(1);
        expect(compartment.compartments).toHaveLength(0);

        let result = await compartment.refresh?.(); // This adds the compartment to itself.
        expect(result).toBe(true);
        expect(dataModelChanged).toHaveBeenCalledTimes(5);
        expect(compartment.compartments).toHaveLength(1);

        result = await compartment.refresh?.();
        expect(result).toBe(true);

        expect(dataModelChanged).toHaveBeenCalledTimes(9); // Same as above.
        expect(compartment.compartments).toHaveLength(1);

        expect(compartment.compartments[0].caption).toBe(compartment1.name);
        expect(compartment.compartments[0].getChildren?.()).toEqual([]);

        await compartment.compartments[0].makeCurrent();
        expect(uiLayerMock.showErrorMessage).toHaveBeenCalledTimes(0);

        result = await compartment.compartments[0].refresh?.();
        expect(result).toBe(true);
        checkNoUiWarningsOrErrors();
    });

    it("DB systems", async () => {
        await dataModel.profiles[0].refresh?.();

        const profile = dataModel.profiles[0];
        const compartment = profile.compartments[0];
        let result = await compartment.refresh?.();
        expect(result).toBe(true);
        expect(compartment.dbSystems).toHaveLength(2);

        result = await compartment.dbSystems[0].refresh?.();
        expect(result).toBe(true);

        expect(dataModelChanged).toHaveBeenCalledTimes(5);
        checkNoUiWarningsOrErrors();
    });

    it("Compute instances", async () => {
        await dataModel.profiles[0].refresh?.();

        const profile = dataModel.profiles[0];
        const compartment = profile.compartments[0];
        let result = await compartment.refresh?.();
        expect(result).toBe(true);
        expect(compartment.computeInstances).toHaveLength(1);

        result = await compartment.computeInstances[0].refresh?.();
        expect(result).toBe(true);

        expect(dataModelChanged).toHaveBeenCalledTimes(5);
        checkNoUiWarningsOrErrors();
    });

    it("Bastions", async () => {
        await dataModel.profiles[0].refresh?.();

        const profile = dataModel.profiles[0];
        const compartment = profile.compartments[0];
        let result = await compartment.refresh?.();
        expect(result).toBe(true);
        expect(compartment.bastions).toHaveLength(1);

        result = await compartment.bastions[0].refresh?.();
        expect(result).toBe(true);

        await compartment.bastions[0].makeCurrent();
        expect(uiLayerMock.showInformationMessage)
            .toHaveBeenNthCalledWith(1, "Setting current bastion to bastion1 ...", {});
        expect(uiLayerMock.showInformationMessage).toHaveBeenNthCalledWith(2,
            "Current bastion set to bastion1.", {});

        expect(dataModelChanged).toHaveBeenCalledTimes(5);
        checkNoUiWarningsOrErrors();
    });


    it("Load balancers", async () => {
        await dataModel.profiles[0].refresh?.();

        const profile = dataModel.profiles[0];
        const compartment = profile.compartments[0];
        let result = await compartment.refresh?.();
        expect(result).toBe(true);
        expect(compartment.loadBalancers).toHaveLength(1);

        result = await compartment.loadBalancers[0].refresh?.();
        expect(result).toBe(undefined); // Load balancers don't have a refresh method.

        expect(dataModelChanged).toHaveBeenCalledTimes(5);
        checkNoUiWarningsOrErrors();
    });
});
