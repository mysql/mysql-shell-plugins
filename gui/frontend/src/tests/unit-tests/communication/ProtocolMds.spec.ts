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

/* eslint-disable @typescript-eslint/naming-convention */

import { IShellRequest, ProtocolMds, ShellAPIMds } from "../../../communication";
import { uuidPattern } from "../test-helpers";

describe("ProtocolMds tests", (): void => {
    const testStandardFields = (result: IShellRequest, command: unknown, args: unknown): void => {
        expect(result.request_id).toMatch(uuidPattern);
        expect(result.request).toEqual("execute");
        expect(result.args).toEqual(args);
        expect(result.command).toEqual(command);
    };

    const testStandardFieldsWithKwArgs = (result: IShellRequest, command: unknown, kwargs: unknown): void => {
        expect(result.request_id).toMatch(uuidPattern);
        expect(result.request).toEqual("execute");
        expect(result.args).toEqual({});
        expect(result.kwargs).toEqual(kwargs);
        expect(result.command).toEqual(command);
    };

    it("Test Oci profiles requests", () => {
        let result = ProtocolMds.getRequestGetRegions();
        testStandardFields(result, ShellAPIMds.MdsGetRegions, {});

        result = ProtocolMds.getRequestListConfigProfiles();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsListConfigProfiles, undefined);
        result = ProtocolMds.getRequestListConfigProfiles({
            configFilePath: "/home/test", interactive: false,
            raiseExceptions: false, returnFormatted: true,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsListConfigProfiles, {
            config_file_path: "/home/test",
            interactive: false, raise_exceptions: false, return_formatted: true,
        });


        result = ProtocolMds.getRequestSetDefaultConfigProfile();
        testStandardFields(result, ShellAPIMds.MdsSetDefaultConfigProfile, {
            profile_name: undefined,
            config_file_location: "~/.oci/config", cli_rc_file_location: "~/.oci/oci_cli_rc",
        });
        result = ProtocolMds.getRequestSetDefaultConfigProfile("default1", "~/.oci/config", "~/.oci/oci_cli_rc");
        testStandardFields(result, ShellAPIMds.MdsSetDefaultConfigProfile, {
            profile_name: "default1",
            config_file_location: "~/.oci/config", cli_rc_file_location: "~/.oci/oci_cli_rc",
        });

        result = ProtocolMds.getRequestGetDefaultConfigProfile();
        testStandardFields(result, ShellAPIMds.MdsGetDefaultConfigProfile,
            { cli_rc_file_location: "~/.oci/oci_cli_rc" });
        result = ProtocolMds.getRequestGetDefaultConfigProfile("~/.oci/oci_cli_rc");
        testStandardFields(result, ShellAPIMds.MdsGetDefaultConfigProfile, {
            cli_rc_file_location: "~/.oci/oci_cli_rc",
        });
    });

    it("Test compartment requests", () => {

        let result = ProtocolMds.getRequestSetCurrentCompartment();
        testStandardFields(result, ShellAPIMds.MdsSetCurrentCompartment, {});

        result = ProtocolMds.getRequestSetCurrentCompartment();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsSetCurrentCompartment, undefined);
        result = ProtocolMds.getRequestSetCurrentCompartment({
            compartmentPath: "/path",
            compartmentId: "compartmentId1", config: {}, configProfile: "defaultConfigProfile",
            profileName: "default1", cliRcFilePath: "~/.oci/oci_cli_rc",
            interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsSetCurrentCompartment, {
            compartment_path: "/path",
            compartment_id: "compartmentId1", config: {}, config_profile: "defaultConfigProfile",
            profile_name: "default1", cli_rc_file_path: "~/.oci/oci_cli_rc", interactive: false,
            raise_exceptions: false,
        });

        result = ProtocolMds.getRequestGetCurrentCompartmentId();
        testStandardFields(result, ShellAPIMds.MdsGetCurrentCompartmentId,
            {
                compartment_id: undefined, config: undefined, config_profile: undefined,
                cli_rc_file_path: "~/.oci/oci_cli_rc",
            });
        result = ProtocolMds.getRequestGetCurrentCompartmentId("compartmentId1", {}, "default1", "~/.oci/oci_cli_rc");
        testStandardFields(result, ShellAPIMds.MdsGetCurrentCompartmentId, {
            compartment_id: "compartmentId1",
            config: {}, profile_name: "default1", cli_rc_file_path: "~/.oci/oci_cli_rc",
        });


        result = ProtocolMds.getRequestListCompartments();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsListCompartments, undefined);
        result = ProtocolMds.getRequestListCompartments({
            compartmentId: "compartmentId1", includeTenancy: true,
            config: {}, configProfile: "defaultConfigProfile", interactive: false, raiseExceptions: false,
            returnFormatted: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsListCompartments, {
            compartment_id: "compartmentId1",
            include_tenancy: true, config: {}, config_profile: "defaultConfigProfile", interactive: false,
            raise_exceptions: false, return_formatted: false,
        });

        result = ProtocolMds.getRequestGetCompartment();
        testStandardFields(result, ShellAPIMds.MdsGetCompartment, { compartment_path: undefined });
        result = ProtocolMds.getRequestGetCompartment("/home", { parentCompartmentId: "id1", config: {} });
        testStandardFields(result, ShellAPIMds.MdsGetCompartment, { compartment_path: "/home" });
    });

    it("Test domain requests", () => {
        let result = ProtocolMds.getRequestGetAvailabilityDomain();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsGetAvailabilityDomain, undefined);
        result = ProtocolMds.getRequestGetAvailabilityDomain({
            availabilityDomain: "oracle",
            randomSelection: false, compartmentId: "compartmentId1", config: {}, configProfile: "defaultConfigProfile",
            interactive: false, raiseExceptions: false, returnFormatted: false, returnPythonObject: true,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsGetAvailabilityDomain, {
            availability_domain: "oracle",
            random_selection: false, compartment_id: "compartmentId1", config: {},
            config_profile: "defaultConfigProfile", interactive: false, raise_exceptions: false,
            return_formatted: false, return_python_object: true,
        });
    });

    it("Test DbSystem and compute instance requests", () => {
        let result = ProtocolMds.getRequestListComputeInstances();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsListComputeInstances, undefined);
        result = ProtocolMds.getRequestListComputeInstances({
            compartmentId: "compartmentId1",
            config: {}, configProfile: "defaultConfigProfile", interactive: false,
            raiseExceptions: false, returnFormatted: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsListComputeInstances, {
            compartment_id: "compartmentId1",
            config: {}, config_profile: "defaultConfigProfile", interactive: false,
            raise_exceptions: false, return_formatted: false,
        });

        result = ProtocolMds.getRequestGetComputeInstance();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsGetComputeInstance, undefined);
        result = ProtocolMds.getRequestGetComputeInstance({
            instanceName: "myInstance", instanceId: "myInstanceId1",
            ignoreCurrent: false, compartmentId: "compartmentId1", config: {}, configProfile: "defaultConfigProfile",
            interactive: false, raiseExceptions: false, returnFormatted: false, returnPythonObject: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsGetComputeInstance, {
            instance_name: "myInstance",
            instance_id: "myInstanceId1", ignore_current: false, compartment_id: "compartmentId1",
            config: {}, config_profile: "defaultConfigProfile", interactive: false, raise_exceptions: false,
            return_formatted: false, return_python_object: false,
        });

        result = ProtocolMds.getRequestListComputeShapes();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsListComputeShapes, undefined);
        result = ProtocolMds.getRequestListComputeShapes({
            limitShapesTo: [], availabilityDomain: "oracle",
            compartmentId: "compartmentId1", config: {}, configProfile: "defaultConfigProfile",
            interactive: false, raiseExceptions: false, returnFormatted: false, returnPythonObject: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsListComputeShapes, {
            limit_shapes_to: [],
            availability_domain: "oracle", compartment_id: "compartmentId1", config: {},
            config_profile: "defaultConfigProfile", interactive: false, raise_exceptions: false,
            return_formatted: false, return_python_object: false,
        });

        result = ProtocolMds.getRequestDeleteComputeInstance();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsDeleteComputeInstance, undefined);
        result = ProtocolMds.getRequestDeleteComputeInstance({
            instanceName: "myInstance", instanceId: "myInstanceId1",
            awaitDeletion: false, compartmentId: "compartmentId1", config: {}, configProfile: "defaultConfigProfile",
            ignoreCurrent: false, interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsDeleteComputeInstance, {
            instance_name: "myInstance",
            instance_id: "myInstanceId1", await_deletion: false, compartment_id: "compartmentId1",
            config: {}, config_profile: "defaultConfigProfile", ignore_current: false, interactive: false,
            raise_exceptions: false,
        });

        result = ProtocolMds.getRequestUtilCreateMdsEndpoint();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsUtilCreateMdsEndpoint, undefined);
        result = ProtocolMds.getRequestUtilCreateMdsEndpoint({
            instanceName: "myInstance", dbSystemName: "db1",
            dbSystemId: "dbSysId1", privateKeyFilePath: "~/.oci/oci_priv", compartmentId: "compartmentId1", config: {},
            configProfile: "defaultConfigProfile", interactive: false, raiseExceptions: false,
            returnFormatted: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsUtilCreateMdsEndpoint, {
            instance_name: "myInstance",
            db_system_name: "db1", db_system_id: "dbSysId1", private_key_file_path: "~/.oci/oci_priv",
            compartment_id: "compartmentId1", config: {}, config_profile: "defaultConfigProfile", interactive: false,
            raise_exceptions: false, return_formatted: false,
        });

        result = ProtocolMds.getRequestGetDbSystemConfiguration();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsGetDbSystemConfiguration, undefined);
        result = ProtocolMds.getRequestGetDbSystemConfiguration({
            configName: "myConfig", configurationId: "id1",
            shape: "shape", availabilityDomain: "oracle", compartmentId: "compartmentId1", config: {},
            configProfile: "defaultConfigProfile", interactive: false, raiseExceptions: false, returnFormatted: false,
            returnPythonObject: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsGetDbSystemConfiguration, {
            config_name: "myConfig",
            configuration_id: "id1", shape: "shape", availability_domain: "oracle", compartment_id: "compartmentId1",
            config: {}, config_profile: "defaultConfigProfile", interactive: false, raise_exceptions: false,
            return_formatted: false, return_python_object: false,
        });

        result = ProtocolMds.getRequestListDbSystems();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsListDbSystems, undefined);
        result = ProtocolMds.getRequestListDbSystems({
            compartmentId: "compartmentId1",
            config: {}, configProfile: "defaultConfigProfile", interactive: false,
            raiseExceptions: false, returnFormatted: false, returnPythonObject: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsListDbSystems, {
            compartment_id: "compartmentId1",
            config: {}, config_profile: "defaultConfigProfile", interactive: false,
            raise_exceptions: false, return_formatted: false, return_python_object: false,
        });

        result = ProtocolMds.getRequestGetDbSystem();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsGetDbSystem, undefined);
        result = ProtocolMds.getRequestGetDbSystem({
            dbSystemName: "myDbSystem", dbSystemId: "myDbSystemId",
            ignoreCurrent: false, compartmentId: "compartmentId1", config: {}, configProfile: "defaultConfigProfile",
            interactive: false, raiseExceptions: false, returnFormatted: false, returnPythonObject: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsGetDbSystem, {
            db_system_name: "myDbSystem",
            db_system_id: "myDbSystemId", ignore_current: false, compartment_id: "compartmentId1", config: {},
            config_profile: "defaultConfigProfile", interactive: false, raise_exceptions: false,
            return_formatted: false, return_python_object: false,
        });

        result = ProtocolMds.getRequestGetDbSystemId();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsGetDbSystemId, undefined);
        result = ProtocolMds.getRequestGetDbSystemId({
            dbSystemName: "myDbSystem", ignoreCurrent: false,
            compartmentId: "compartmentId1", config: {}, configProfile: "defaultConfigProfile",
            interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsGetDbSystemId, {
            db_system_name: "myDbSystem",
            ignore_current: false, compartment_id: "compartmentId1", config: {},
            config_profile: "defaultConfigProfile", interactive: false, raise_exceptions: false,
        });

        result = ProtocolMds.getRequestUpdateDbSystem();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsUpdateDbSystem, undefined);
        result = ProtocolMds.getRequestUpdateDbSystem({
            dbSystemName: "myDbSystem", dbSystemId: "myDbSystemId",
            ignoreCurrent: false, newName: "myNewName", newDescription: "desc", newFreeformTags: "fts",
            compartmentId: "compartmentId1", config: {}, configProfile: "defaultConfigProfile",
            interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsUpdateDbSystem, {
            db_system_name: "myDbSystem",
            db_system_id: "myDbSystemId", ignore_current: false, new_name: "myNewName",
            new_description: "desc", new_freeform_tags: "fts", compartment_id: "compartmentId1", config: {},
            config_profile: "defaultConfigProfile", interactive: false, raise_exceptions: false,
        });

        result = ProtocolMds.getRequestCreateDbSystem();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsCreateDbSystem, undefined);
        result = ProtocolMds.getRequestCreateDbSystem({
            dbSystemName: "myDbSystem",
            description: "desc", availabilityDomain: "oracle", shape: "shape", subnetId: "netId",
            configurationId: "confId", dataStorageSizeInGbs: 5, mysqlVersion: "1.0.0",
            adminUsername: "root", adminPassword: "pass1", privateKeyFilePath: "~/.oci/oci_priv", parUrl: "/home",
            performCleanupAfterImport: false, sourceMysqlUri: "localhost", sourceMysqlPassword: "pass2",
            sourceLocalDumpDir: "/home", sourceBucket: "bucket1", hostImageId: "imageId1", definedTags: {},
            freeformTags: {}, compartmentId: "compartmentId1", config: {}, interactive: false, returnObject: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsCreateDbSystem, {
            db_system_name: "myDbSystem",
            description: "desc", availability_domain: "oracle", shape: "shape", subnet_id: "netId",
            configuration_id: "confId", data_storage_size_in_gbs: 5, mysql_version: "1.0.0",
            admin_username: "root", admin_password: "pass1", private_key_file_path: "~/.oci/oci_priv", par_url: "/home",
            perform_cleanup_after_import: false, source_mysql_uri: "localhost", source_mysql_password: "pass2",
            source_local_dump_dir: "/home", source_bucket: "bucket1", host_image_id: "imageId1", defined_tags: {},
            freeform_tags: {}, compartment_id: "compartmentId1", config: {}, interactive: false,
            return_object: false,
        });

        result = ProtocolMds.getRequestDeleteDbSystem();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsDeleteDbSystem, undefined);
        result = ProtocolMds.getRequestDeleteDbSystem({
            dbSystemName: "myDbSystem", dbSystemId: "myDbSystemId",
            awaitCompletion: false, ignoreCurrent: false, compartmentId: "compartmentId1", config: {},
            configProfile: "defaultConfigProfile", interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsDeleteDbSystem, {
            db_system_name: "myDbSystem",
            db_system_id: "myDbSystemId", await_completion: false, ignore_current: false,
            compartment_id: "compartmentId1", config: {}, config_profile: "defaultConfigProfile",
            interactive: false, raise_exceptions: false,
        });

        result = ProtocolMds.getRequestStopDbSystem();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsStopDbSystem, undefined);
        result = ProtocolMds.getRequestStopDbSystem({
            dbSystemName: "myDbSystem", dbSystemId: "myDbSystemId",
            awaitCompletion: false, ignoreCurrent: false, compartmentId: "compartmentId1", config: {},
            configProfile: "defaultConfigProfile", interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsStopDbSystem, {
            db_system_name: "myDbSystem",
            db_system_id: "myDbSystemId", await_completion: false, ignore_current: false,
            compartment_id: "compartmentId1", config: {}, config_profile: "defaultConfigProfile",
            interactive: false, raise_exceptions: false,
        });

        result = ProtocolMds.getRequestStartDbSystem();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsStartDbSystem, undefined);
        result = ProtocolMds.getRequestStartDbSystem({
            dbSystemName: "myDbSystem", dbSystemId: "myDbSystemId",
            awaitCompletion: false, ignoreCurrent: false, compartmentId: "compartmentId1", config: {},
            configProfile: "defaultConfigProfile", interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsStartDbSystem, {
            db_system_name: "myDbSystem",
            db_system_id: "myDbSystemId", await_completion: false, ignore_current: false,
            compartment_id: "compartmentId1", config: {}, config_profile: "defaultConfigProfile",
            interactive: false, raise_exceptions: false,
        });

        result = ProtocolMds.getRequestRestartDbSystem();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsRestartDbSystem, undefined);
        result = ProtocolMds.getRequestRestartDbSystem({
            dbSystemName: "myDbSystem", dbSystemId: "myDbSystemId",
            awaitCompletion: false, ignoreCurrent: false, compartmentId: "compartmentId1", config: {},
            configProfile: "defaultConfigProfile", interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsRestartDbSystem, {
            db_system_name: "myDbSystem",
            db_system_id: "myDbSystemId", await_completion: false, ignore_current: false,
            compartment_id: "compartmentId1", config: {}, config_profile: "defaultConfigProfile",
            interactive: false, raise_exceptions: false,
        });

        result = ProtocolMds.getRequestListLoadBalancers();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsListLoadBalancers, undefined);
        result = ProtocolMds.getRequestListLoadBalancers({
            compartmentId: "compartmentId1", config: {},
            configProfile: "defaultConfigProfile", interactive: false, returnType: "number", raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsListLoadBalancers, {
            compartment_id: "compartmentId1",
            config: {}, config_profile: "defaultConfigProfile",
            interactive: false, return_type: "number", raise_exceptions: false,
        });
    });

    it("Test bastion requests", () => {
        let result = ProtocolMds.getRequestListBastions();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsListBastions, undefined);
        result = ProtocolMds.getRequestListBastions({
            compartmentId: "compartmentId1", validForDbSystemId: "validForDbSystemId1", config: {},
            configProfile: "default1", interactive: false, returnType: "number", raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsListBastions, {
            compartment_id: "compartmentId1", valid_for_db_system_id: "validForDbSystemId1", config: {},
            config_profile: "default1", interactive: false, return_type: "number", raise_exceptions: false,
        });

        result = ProtocolMds.getRequestGetBastion();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsGetBastion, undefined);
        result = ProtocolMds.getRequestGetBastion({
            bastionName: "myBastion", bastionId: "myBastionId1", awaitState: "pending", ignoreCurrent: false,
            fallbackToAnyInCompartment: false, compartmentId: "compartmentId1", config: {}, configProfile: "default1",
            interactive: true, returnType: "boolean", raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsGetBastion, {
            bastion_name: "myBastion", bastion_id: "myBastionId1", await_state: "pending", ignore_current: false,
            fallback_to_any_in_compartment: false, compartment_id: "compartmentId1", config: {},
            config_profile: "default1", interactive: true, return_type: "boolean", raise_exceptions: false,
        });

        result = ProtocolMds.getRequestCreateBastion();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsCreateBastion, undefined);
        result = ProtocolMds.getRequestCreateBastion({
            bastionName: "myBastion", dbSystemId: "dbSystemMySqlId1",
            clientCidr: "/home", maxSessionTtlInSeconds: 1000, targetSubnetId: "subnetId1", awaitActiveState: false,
            compartmentId: "compartmentId1", config: {}, configProfile: "default1", ignoreCurrent: false,
            interactive: false, returnType: "any", raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsCreateBastion,
            {
                bastion_name: "myBastion", db_system_id: "dbSystemMySqlId1", client_cidr: "/home",
                max_session_ttl_in_seconds: 1000, target_subnet_id: "subnetId1", await_active_state: false,
                compartment_id: "compartmentId1", config: {}, config_profile: "default1", ignore_current: false,
                interactive: false, return_type: "any", raise_exceptions: false,
            });

        result = ProtocolMds.getRequestDeleteBastion();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsDeleteBastion, undefined);
        result = ProtocolMds.getRequestDeleteBastion({
            bastionName: "myBastion", bastionId: "bastionId1", awaitDeletion: false, compartmentId: "compartmentId1",
            config: {}, configProfile: "default1", ignoreCurrent: false, interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsDeleteBastion, {
            bastion_name: "myBastion", bastion_id: "bastionId1", await_deletion: false,
            compartment_id: "compartmentId1", config: {}, config_profile: "default1", ignore_current: false,
            interactive: false, raise_exceptions: false,
        });

        result = ProtocolMds.getRequestListBastionSessions();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsListBastionSessions, undefined);
        result = ProtocolMds.getRequestListBastionSessions({
            bastionId: "bastionId1", ignoreCurrent: false, compartmentId: "compartmentId1", config: {},
            configProfile: "default1", interactive: false, returnType: "any", raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsListBastionSessions, {
            bastion_id: "bastionId1", ignore_current: false, compartment_id: "compartmentId1", config: {},
            config_profile: "default1", interactive: false, return_type: "any", raise_exceptions: false,
        });


        result = ProtocolMds.getRequestGetBastionSession();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsGetBastionSession, undefined);
        result = ProtocolMds.getRequestGetBastionSession({
            sessionName: "session1", sessionId: "sessionId1", bastionId: "bastionId1",
            compartmentId: "compartmentId1", config: {}, configProfile: "default1", ignoreCurrent: false,
            interactive: false, returnType: "any", raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsGetBastionSession, {
            session_name: "session1", session_id: "sessionId1", bastion_id: "bastionId1",
            compartment_id: "compartmentId1", config: {}, config_profile: "default1", ignore_current: false,
            interactive: false, return_type: "any", raise_exceptions: false,
        });

        result = ProtocolMds.getRequestCreateBastionSession();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsCreateBastionSession, undefined);
        result = ProtocolMds.getRequestCreateBastionSession({
            bastionName: "myBastion", bastionId: "bastionId1",
            fallbackToAnyInCompartment: false, sessionType: "interactive", sessionName: "session1",
            targetId: "target12", targetIp: "192.168.1.1", targetPort: "334", targetUser: "root",
            ttlInSeconds: 20, publicKeyFile: "key.pub", publicKeyContent: "xxxx", awaitCreation: false,
            compartmentId: "compartmentId1", config: {}, configProfile: "default1",
            ignoreCurrent: false, interactive: false, returnType: "any", raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsCreateBastionSession, {
            bastion_name: "myBastion", bastion_id: "bastionId1",
            fallback_to_any_in_compartment: false, session_type: "interactive", session_name: "session1",
            target_id: "target12", target_ip: "192.168.1.1", target_port: "334", target_user: "root",
            ttl_in_seconds: 20, public_key_file: "key.pub", public_key_content: "xxxx", await_creation: false,
            compartment_id: "compartmentId1", config: {}, config_profile: "default1",
            ignore_current: false, interactive: false, return_type: "any", raise_exceptions: false,
        });

        result = ProtocolMds.getRequestDeleteBastionSession();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsDeleteBastionSession, undefined);
        result = ProtocolMds.getRequestDeleteBastionSession({
            sessionName: "my session", sessionId: "mySessionId2", bastionName: "Bastion 1",
            bastionId: "myBastion1", compartmentId: "compartmentId", config: {},
            configProfile: "default1", ignoreCurrent: false, interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsDeleteBastionSession,
            {
                session_name: "my session", session_id: "mySessionId2", bastion_name: "Bastion 1",
                bastion_id: "myBastion1", compartment_id: "compartmentId", config: {},
                config_profile: "default1", ignore_current: false, interactive: false, raise_exceptions: false,
            });

        result = ProtocolMds.getRequestSetCurrentBastion();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsSetCurrentBastion, undefined);
        result = ProtocolMds.getRequestSetCurrentBastion({
            bastionName: "Bastion 1", bastionId: "myBastion1",
            compartmentId: "compartmentId", config: {}, configProfile: "default1", profileName: "default",
            cliRcFilePath: "~/.oci/oci_cli_rc", raiseExceptions: false, interactive: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsSetCurrentBastion, {
            bastion_name: "Bastion 1",
            bastion_id: "myBastion1", compartment_id: "compartmentId", config: {}, config_profile: "default1",
            profile_name: "default", cli_rc_file_path: "~/.oci/oci_cli_rc", raise_exceptions: false,
            interactive: false,
        });
    });

    it("Test HeatWave requests", () => {
        let result = ProtocolMds.getRequestListDbSystemShapes();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsListDbSystemShapes, undefined);
        result = ProtocolMds.getRequestListDbSystemShapes({
            isSupportedFor: "xyz", availabilityDomain: "domain", compartmentId: "12345", config: {},
            configProfile: "myProfile", interactive: true, raiseExceptions: false, returnFormatted: true,
            returnPythonObject: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsListDbSystemShapes, {
            is_supported_for: "xyz", availability_domain: "domain", compartment_id: "12345", config: {},
            config_profile: "myProfile", interactive: true, raise_exceptions: false, return_formatted: true,
            return_python_object: false,
        });

        result = ProtocolMds.getRequestStopHeatWaveCluster();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsStopHeatWaveCluster, undefined);
        result = ProtocolMds.getRequestStopHeatWaveCluster({
            dbSystemName: "name", dbSystemId: "id", awaitCompletion: true, ignoreCurrent: false, compartmentId: "id",
            config: { a: 1, b: 2 }, configProfile: "myProfile", interactive: false, raiseExceptions: true,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsStopHeatWaveCluster, {
            db_system_name: "name", db_system_id: "id", await_completion: true, ignore_current: false,
            compartment_id: "id", config: { a: 1, b: 2 }, config_profile: "myProfile", interactive: false,
            raise_exceptions: true,
        });

        result = ProtocolMds.getRequestStartHeatWaveCluster();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsStartHeatWaveCluster, undefined);
        result = ProtocolMds.getRequestStartHeatWaveCluster({
            dbSystemName: "name", dbSystemId: "id", awaitCompletion: true, ignoreCurrent: true, compartmentId: "id",
            config: { a: 1, b: 2 }, configProfile: "myProfile", interactive: true, raiseExceptions: true,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsStartHeatWaveCluster, {
            db_system_name: "name", db_system_id: "id", await_completion: true, ignore_current: true,
            compartment_id: "id", config: { a: 1, b: 2 }, config_profile: "myProfile", interactive: true,
            raise_exceptions: true,
        });

        result = ProtocolMds.getRequestRestartHeatWaveCluster();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsRestartHeatWaveCluster, undefined);
        result = ProtocolMds.getRequestRestartHeatWaveCluster({
            dbSystemName: "name", dbSystemId: "id", awaitCompletion: true, ignoreCurrent: true, compartmentId: "id",
            config: { a: 1, b: 2 }, configProfile: "myProfile", interactive: true, raiseExceptions: true,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsRestartHeatWaveCluster, {
            db_system_name: "name", db_system_id: "id", await_completion: true, ignore_current: true,
            compartment_id: "id", config: { a: 1, b: 2 }, config_profile: "myProfile", interactive: true,
            raise_exceptions: true,
        });

        result = ProtocolMds.getRequestCreateHeatWaveCluster();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsCreateHeatWaveCluster, undefined);
        result = ProtocolMds.getRequestCreateHeatWaveCluster({
            dbSystemName: "name", dbSystemId: "id", ignoreCurrent: false, clusterSize: 1e2, shapeName: "myShape",
            awaitCompletion: false, compartmentId: "id", interactive: false, raiseExceptions: false,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsCreateHeatWaveCluster, {
            db_system_name: "name", db_system_id: "id", ignore_current: false, cluster_size: 1e2, shape_name: "myShape",
            await_completion: false, compartment_id: "id", interactive: false, raise_exceptions: false,
        });

        result = ProtocolMds.getRequestUpdateHeatWaveCluster();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsUpdateHeatWaveCluster, undefined);
        result = ProtocolMds.getRequestUpdateHeatWaveCluster({
            dbSystemName: "name", dbSystemId: "id", ignoreCurrent: false, clusterSize: 1e2, shapeName: "myShape",
            awaitCompletion: false, compartmentId: "id", config: { a: 1, b: 2 }, configProfile: "myProfile",
            interactive: true, raiseExceptions: true,
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsUpdateHeatWaveCluster, {
            db_system_name: "name", db_system_id: "id", ignore_current: false, cluster_size: 1e2, shape_name: "myShape",
            await_completion: false, compartment_id: "id", config: { a: 1, b: 2 }, config_profile: "myProfile",
            interactive: true, raise_exceptions: true,
        });

        result = ProtocolMds.getRequestDeleteHeatWaveCluster();
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsDeleteHeatWaveCluster, undefined);
        result = ProtocolMds.getRequestDeleteHeatWaveCluster({
            dbSystemName: "name", dbSystemId: "id", awaitCompletion: false, compartmentId: "id", interactive: false,
            raiseExceptions: false, ignoreCurrent: true, config: { c: 3, d: 4 }, configProfile: "myProfile",
        });
        testStandardFieldsWithKwArgs(result, ShellAPIMds.MdsDeleteHeatWaveCluster, {
            db_system_name: "name", db_system_id: "id", await_completion: false, compartment_id: "id",
            interactive: false, raise_exceptions: false, ignore_current: true, config: { c: 3, d: 4 },
            config_profile: "myProfile",
        });
    });
});
