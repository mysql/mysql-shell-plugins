/*
 * Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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


/* eslint-disable max-len */


export enum ShellAPIMsm {
    /** Returns basic information about this plugin. */
    MsmInfo = "msm.info",
    /** Returns the version number of the plugin */
    MsmVersion = "msm.version",
    /** Creates a new schema project folder. */
    MsmCreateNewProjectFolder = "msm.create_new_project_folder",
    /** Returns information about the schema project */
    MsmGetProjectSettings = "msm.get.project_settings",
    /** Returns information about the schema project */
    MsmGetProjectInformation = "msm.get.project_information",
    /** Sets the development version inside the development/schema_next.sql file */
    MsmSetDevelopmentVersion = "msm.set.development_version",
    /** Adds a new database schema release */
    MsmGetReleasedVersions = "msm.get.released_versions",
    /** Adds a new database schema release */
    MsmGetLastReleasedVersion = "msm.get.last_released_version",
    /** Adds a new database schema release */
    MsmPrepareRelease = "msm.prepare_release",
    /** Returns the SQL content of a MSM section */
    MsmGetSqlContentFromSection = "msm.get.sql_content_from_section",
    /** Sets the SQL content of a MSM section of a file */
    MsmSetSectionSqlContent = "msm.set.section_sql_content",
    /** Generate the deployment script for a release */
    MsmGenerateDeploymentScript = "msm.generate_deployment_script",
    /** Adds a new database schema release */
    MsmGetDeploymentScriptVersions = "msm.get.deployment_script_versions",
    /** Returns the list of available licenses */
    MsmGetAvailableLicenses = "msm.get.available_licenses",
    /** Checks whether the given schema exists */
    MsmGetSchemaExists = "msm.get.schema_exists",
    /** Checks whether the given schema is managed by MSM */
    MsmGetSchemaIsManaged = "msm.get.schema_is_managed",
    /** Returns the current version of the database schema */
    MsmGetSchemaVersion = "msm.get.schema_version",
    /** Deploys the database schema */
    MsmDeploySchema = "msm.deploy_schema"
}

export interface IShellMsmCreateNewProjectFolderKwargs {
    /** If the project folder already exists, overwrite it. */
    overwriteExisting?: boolean;
    /** If set to True, allows all characters */
    allowSpecialChars?: boolean;
    /** The license to use for the project. */
    license?: string;
    /** If set to true, the target_path is created if it does not yet exist. */
    enforceTargetPath?: boolean;
}

export interface IShellMsmGetProjectSettingsKwargs {
    /** The path to the schema project. */
    schemaProjectPath?: string;
}

export interface IShellMsmGetProjectInformationKwargs {
    /** The path to the schema project. */
    schemaProjectPath?: string;
}

export interface IShellMsmSetDevelopmentVersionKwargs {
    /** The path to the schema project. */
    schemaProjectPath?: string;
    /** The new version to create. */
    version?: string;
}

export interface IShellMsmGetReleasedVersionsKwargs {
    /** The path to the schema project. */
    schemaProjectPath?: string;
}

export interface IShellMsmGetLastReleasedVersionKwargs {
    /** The path to the schema project. */
    schemaProjectPath?: string;
}

export interface IShellMsmPrepareReleaseKwargs {
    /** The path to the schema project. */
    schemaProjectPath?: string;
    /** The new version to create. */
    version?: string;
    /** The next development version. */
    nextVersion?: string;
    /** Whether to allow to stay on the same version for further development work. Defaults to False. */
    allowToStayOnSameVersion?: boolean;
    /** Whether existing files should be overwritten. Defaults to False. */
    overwriteExisting?: boolean;
}

export interface IShellMsmGenerateDeploymentScriptKwargs {
    /** The path to the schema project. */
    schemaProjectPath?: string;
    /** The new version to create the deployment script for. */
    version?: string;
    /** Whether existing files should be overwritten. Defaults to False. */
    overwriteExisting?: boolean;
}

export interface IShellMsmGetDeploymentScriptVersionsKwargs {
    /** The path to the schema project. */
    schemaProjectPath?: string;
}

export interface IShellMsmGetSchemaExistsKwargs {
    /** The path to the schema project. */
    schemaProjectPath?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMsmGetSchemaIsManagedKwargs {
    /** The path to the schema project. */
    schemaProjectPath?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMsmGetSchemaVersionKwargs {
    /** The path to the schema project. */
    schemaProjectPath?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IShellMsmDeploySchemaKwargs {
    /** The path to the schema project. */
    schemaProjectPath?: string;
    /** The version to deploy. */
    version?: string;
    /** The directory to be used for backups */
    backupDirectory?: string;
    /** The string id for the module session object, holding the database session to be used on the operation. */
    moduleSessionId?: string;
}

export interface IProtocolMsmParameters {
    [ShellAPIMsm.MsmInfo]: {};
    [ShellAPIMsm.MsmVersion]: {};
    [ShellAPIMsm.MsmCreateNewProjectFolder]: { args: { schemaName?: string; targetPath?: string; copyrightHolder?: string; }; kwargs?: IShellMsmCreateNewProjectFolderKwargs; };
    [ShellAPIMsm.MsmGetProjectSettings]: { kwargs?: IShellMsmGetProjectSettingsKwargs; };
    [ShellAPIMsm.MsmGetProjectInformation]: { kwargs?: IShellMsmGetProjectInformationKwargs; };
    [ShellAPIMsm.MsmSetDevelopmentVersion]: { kwargs?: IShellMsmSetDevelopmentVersionKwargs; };
    [ShellAPIMsm.MsmGetReleasedVersions]: { kwargs?: IShellMsmGetReleasedVersionsKwargs; };
    [ShellAPIMsm.MsmGetLastReleasedVersion]: { kwargs?: IShellMsmGetLastReleasedVersionKwargs; };
    [ShellAPIMsm.MsmPrepareRelease]: { kwargs?: IShellMsmPrepareReleaseKwargs; };
    [ShellAPIMsm.MsmGetSqlContentFromSection]: { args: { filePath: string; sectionId: string; }; };
    [ShellAPIMsm.MsmSetSectionSqlContent]: { args: { filePath: string; sectionId: string; sqlContent: string; }; };
    [ShellAPIMsm.MsmGenerateDeploymentScript]: { kwargs?: IShellMsmGenerateDeploymentScriptKwargs; };
    [ShellAPIMsm.MsmGetDeploymentScriptVersions]: { kwargs?: IShellMsmGetDeploymentScriptVersionsKwargs; };
    [ShellAPIMsm.MsmGetAvailableLicenses]: {};
    [ShellAPIMsm.MsmGetSchemaExists]: { kwargs?: IShellMsmGetSchemaExistsKwargs; };
    [ShellAPIMsm.MsmGetSchemaIsManaged]: { kwargs?: IShellMsmGetSchemaIsManagedKwargs; };
    [ShellAPIMsm.MsmGetSchemaVersion]: { kwargs?: IShellMsmGetSchemaVersionKwargs; };
    [ShellAPIMsm.MsmDeploySchema]: { kwargs?: IShellMsmDeploySchemaKwargs; };

}

export interface IMsmProjectSettings {
    copyrightHolder: string;
    customLicense: string;
    license: string;
    schemaDependencies: IMsmSchemaDependency[];
    schemaName: string;
    schemaFileName: string;
    yearOfCreation: string;
}

export interface IMsmSchemaDependency {
    schemaName: string;
    schemaProjectPath: string;
}

export interface IMsmProjectInfo extends IMsmProjectSettings{
    currentDevelopmentVersion: string;
    lastReleasedVersion: string;
    schemaDevelopmentFilePath: string;
}

export type MsmVersion = [number, number, number];

export interface IProtocolMsmResults {
    [ShellAPIMsm.MsmInfo]: { result: string; };
    [ShellAPIMsm.MsmVersion]: { result: string; };
    [ShellAPIMsm.MsmCreateNewProjectFolder]: { result: string; };
    [ShellAPIMsm.MsmGetProjectSettings]: { result: IMsmProjectSettings; };
    [ShellAPIMsm.MsmGetProjectInformation]: { result: IMsmProjectInfo; };
    [ShellAPIMsm.MsmSetDevelopmentVersion]: {};
    [ShellAPIMsm.MsmGetReleasedVersions]: { result: MsmVersion[] };
    [ShellAPIMsm.MsmGetDeploymentScriptVersions]: { result: MsmVersion[] };
    [ShellAPIMsm.MsmGetLastReleasedVersion]: { result: string; };
    [ShellAPIMsm.MsmPrepareRelease]: { result: string[] };
    [ShellAPIMsm.MsmGetSqlContentFromSection]: { result: string; };
    [ShellAPIMsm.MsmSetSectionSqlContent]: {};
    [ShellAPIMsm.MsmGenerateDeploymentScript]: { result: string; };
    [ShellAPIMsm.MsmGetAvailableLicenses]: { result: string[]; };
    [ShellAPIMsm.MsmGetSchemaExists]: { result: boolean; };
    [ShellAPIMsm.MsmGetSchemaIsManaged]: { result: boolean; };
    [ShellAPIMsm.MsmGetSchemaVersion]: { result: string | null; };
    [ShellAPIMsm.MsmDeploySchema]: {};
}

