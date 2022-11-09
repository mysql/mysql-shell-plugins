/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

export enum ShellAPIMds {
    //  Begin auto generated API names
    MdsGetRegions = "mds.get.regions",
    MdsListConfigProfiles = "mds.list.config_profiles",
    MdsSetDefaultConfigProfile = "mds.set.default_config_profile",
    MdsGetDefaultConfigProfile = "mds.get.default_config_profile",
    MdsSetCurrentCompartment = "mds.set.current_compartment",
    MdsGetCurrentCompartmentId = "mds.get.current_compartment_id",
    MdsSetCurrentBastion = "mds.set.current_bastion",
    MdsGetAvailabilityDomain = "mds.get.availability_domain",
    MdsListCompartments = "mds.list.compartments",
    MdsGetCompartment = "mds.get.compartment",
    MdsListComputeInstances = "mds.list.compute_instances",
    MdsGetComputeInstance = "mds.get.compute_instance",
    MdsListComputeShapes = "mds.list.compute_shapes",
    MdsDeleteComputeInstance = "mds.delete.compute_instance",
    MdsUtilHeatWaveLoadData = "mds.util.heat_wave_load_data",
    MdsUtilCreateMdsEndpoint = "mds.util.create_mds_endpoint",
    MdsGetDbSystemConfiguration = "mds.get.db_system_configuration",
    MdsListDbSystemShapes = "mds.list.db_system_shapes",
    MdsListDbSystems = "mds.list.db_systems",
    MdsGetDbSystem = "mds.get.db_system",
    MdsGetDbSystemId = "mds.get.db_system_id",
    MdsUpdateDbSystem = "mds.update.db_system",
    MdsCreateDbSystem = "mds.create.db_system",
    MdsDeleteDbSystem = "mds.delete.db_system",
    MdsStopDbSystem = "mds.stop.db_system",
    MdsStartDbSystem = "mds.start.db_system",
    MdsRestartDbSystem = "mds.restart.db_system",
    MdsStopHeatWaveCluster = "mds.stop.heat_wave_cluster",
    MdsStartHeatWaveCluster = "mds.start.heat_wave_cluster",
    MdsRestartHeatWaveCluster = "mds.restart.heat_wave_cluster",
    MdsCreateHeatWaveCluster = "mds.create.heat_wave_cluster",
    MdsUpdateHeatWaveCluster = "mds.update.heat_wave_cluster",
    MdsDeleteHeatWaveCluster = "mds.delete.heat_wave_cluster",
    MdsListLoadBalancers = "mds.list.load_balancers",
    MdsListBastions = "mds.list.bastions",
    MdsGetBastion = "mds.get.bastion",
    MdsCreateBastion = "mds.create.bastion",
    MdsDeleteBastion = "mds.delete.bastion",
    MdsListBastionSessions = "mds.list.bastion_sessions",
    MdsGetBastionSession = "mds.get.bastion_session",
    MdsCreateBastionSession = "mds.create.bastion_session",
    MdsDeleteBastionSession = "mds.delete.bastion_session",
    //  End auto generated API names
}
