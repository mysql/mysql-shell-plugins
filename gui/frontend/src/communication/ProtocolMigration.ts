/*
 * Copyright (c) 2020, 2026, Oracle and/or its affiliates.
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

import { IShellDictionary } from "./Protocol.js";

/* eslint-disable max-len */

export enum ShellAPIMigration {
    /** Returns basic information about this plugin. */
    MigrationInfo = "migration.info",
    /** Returns the version number of the plugin */
    MigrationVersion = "migration.version",
    /** Update migration plan sub-step with user input. */
    MigrationPlanUpdate = "migration.plan_update",
    /** Get additional data for frontend use. */
    MigrationPlanGetDataItem = "migration.plan_get_data_item",
    /** Fetch and/or update migration plan sub-step with user input. */
    MigrationPlanUpdateSubStep = "migration.plan_update_sub_step",
    /** Commit changes to the given sub-step and performs checks. Call before switching from a sub-step to the next one. */
    MigrationPlanCommit = "migration.plan_commit",
    /** Call to Sign In to OCI, create a session and bootstrap a OCI profile. If signing-in, region must have been already picked in the OCIProfile sub-step. */
    MigrationOciSignIn = "migration.oci_sign_in",
    /** Starts the work step */
    MigrationWorkStart = "migration.work_start",
    /** Aborts the work step */
    MigrationWorkAbort = "migration.work_abort",
    /** Deletes OCI resources created for the migration. */
    MigrationWorkClean = "migration.work_clean",
    /** Retrieves the status of the work step */
    MigrationWorkStatus = "migration.work_status",
    /** Retries the work step */
    MigrationWorkRetry = "migration.work_retry",
    /** Skips transactions on the work step */
    MigrationSkipTransactions = "migration.skip_transactions",
    /** Fetch logs for the given step or the log file. */
    MigrationFetchLogs = "migration.fetch_logs",
    /** Returns the list of migration steps */
    MigrationGetSteps = "migration.get_steps",
    /** Returns the migration plan status for a new migration project */
    MigrationNewProject = "migration.new_project",
    /** Returns the migration plan status for an existing migration project */
    MigrationOpenProject = "migration.open_project",
    /** Closes an existing migration project */
    MigrationCloseProject = "migration.close_project",
    /** Returns the existing migration projects */
    MigrationListProjects = "migration.list_projects"
}

export enum SubStepId {
    ORCHESTRATION = 0,
    OCI_PROFILE = 1040,
    SOURCE_SELECTION = 1010,
    MIGRATION_TYPE = 1020,
    SCHEMA_SELECTION = 1021,
    MIGRATION_CHECKS = 1030,
    TARGET_OPTIONS = 1050,
    PREVIEW_PLAN = 1100,
    PROVISION_VCN = 2010,
    PROVISION_COMPARTMENT = 2020,
    PROVISION_COMPUTE = 2030,
    PROVISION_BUCKET = 2040,
    PROVISION_HELPER = 2050,
    PROVISION_DBSYSTEM = 2060,
    PROVISION_HEATWAVE_CLUSTER = 2070,
    DUMP = 3010,
    LOAD = 3020,
    CONNECT_DBSYSTEM = 3030,
    ENABLE_CRASH_RECOVERY = 3040,
    ENABLE_HA = 3050,
    CREATE_SSH_TUNNEL = 4010,
    CHECK_DIRECT_NETWORK = 4020,
    CREATE_CHANNEL = 4030,
    CONGRATS = 5010,
    MONITOR_CHANNEL = 5020,
    CLEANUP = 5090,
    FINAL_SUMMARY = 5100
}

export enum MigrationStepStatus {
    NOT_STARTED = 'NOT_STARTED',
    IN_PROGRESS = 'IN_PROGRESS',
    READY_TO_COMMIT = 'READY_TO_COMMIT',
    FINISHED = 'FINISHED',
    ERROR = 'ERROR'
}

export enum MessageLevel {
    ERROR = 'ERROR',
    WARNING = 'WARNING',
    NOTICE = 'NOTICE',
    INFO = 'INFO',
    VERBOSE = 'VERBOSE'
}

export enum ServerType {
    MySQL = 'mysql',
    HeatWave = 'heatwave',
    MariaDB = 'mariadb',
    Percona = 'percona',
    RDS = 'rds',
    Aurora = 'aurora',
    OtherMySQL = 'other'
}

export enum CompatibilityFlags {
    create_invisible_pks = 'create_invisible_pks',
    force_innodb = 'force_innodb',
    force_non_standard_fks = 'force_non_standard_fks',
    ignore_missing_pks = 'ignore_missing_pks',
    ignore_wildcard_grants = 'ignore_wildcard_grants',
    lock_invalid_accounts = 'lock_invalid_accounts',
    skip_invalid_accounts = 'skip_invalid_accounts',
    strip_definers = 'strip_definers',
    strip_invalid_grants = 'strip_invalid_grants',
    strip_restricted_grants = 'strip_restricted_grants',
    strip_tablespaces = 'strip_tablespaces',
    target_has_mysql_native_password = 'target_has_mysql_native_password',
    unescape_wildcard_grants = 'unescape_wildcard_grants',
    IGNORE = 'IGNORE',
    EXCLUDE_OBJECT = 'EXCLUDE_OBJECT'
}

export enum CheckStatus {
    OK = 0,
    CONFIRMATION_REQUIRED = 1,
    ACTION_REQUIRED = 2,
    FATAL_ERROR = 3,
    EXTERNAL_ERROR = 4
}

export enum MigrationType {
    COLD = 'cold',
    HOT = 'hot'
}

export enum CloudConnectivity {
    NOT_SET = '',
    SITE_TO_SITE = 'site-to-site',
    SSH_TUNNEL = 'ssh-tunnel',
    LOCAL_SSH_TUNNEL = 'local-ssh-tunnel'
}

export enum PlanDataItemType {
    SCHEMA_TABLES = 'tables',
    SCHEMA_ROUTINES = 'routines',
    SCHEMA_TRIGGERS = 'triggers',
    SCHEMA_EVENTS = 'events',
    SCHEMA_LIBRARIES = 'libraries'
}

export enum WorkStatus {
    NOT_STARTED = 'not_started',
    IN_PROGRESS = 'in_progress',
    READY = 'ready',
    FINISHED = 'finished',
    ABORTED = 'aborted',
    ERROR = 'error'
}

export interface IMigrationError {
    level: MessageLevel,
    type: string | null,
    message: string,
    title: string | null,
    info: IShellDictionary | null
}

export interface IServerInfo {
    version: string,
    versionComment: string,
    license: string,
    hostname: string,
    serverUuid: string,
    schemaCount: number,
    dataSize: number,
    hasMRS: boolean,
    numAccountsOnMysqlNativePassword: number,
    numAccountsOnOldPassword: number,
    sslSupported: boolean,
    serverType: ServerType,
    gtidMode: string,
    replicationStatus: string
}

export interface ISourceSelectionData {
    serverInfo: IServerInfo | null
}

export interface IMigrationTypeData {
    allowedTypes: string[],
    allowedConnectivity: string[]
}

export interface IInstanceContents {
    schemas: string[],
    accounts: string[]
}

export interface ISchemaSelectionData {
    contents: IInstanceContents
}

export interface ICheckResult {
    checkId: string | null,
    level: MessageLevel,
    title: string,
    result: string,
    description: string,
    objects: string[],
    choices: CompatibilityFlags[],
    status: CheckStatus
}

export interface IMigrationChecksData {
    issues: ICheckResult[]
}

export interface ITargetOptionsData {
    compartmentPath: string,
    networkCompartmentPath: string,
    allowCreateNewVcn: boolean
}

export interface IOCISubnetOptions {
    id: string,
    name: string,
    cidrBlock: string,
    dnsLabel: string
}

export interface IOCIHostingOptions {
    parentCompartmentId: string,
    compartmentId: string,
    compartmentName: string,
    createVcn: boolean,
    networkParentCompartmentId: string,
    networkCompartmentId: string,
    networkCompartmentName: string,
    vcnId: string,
    vcnName: string,
    vcnCidrBlock: string,
    internetGatewayName: string,
    serviceGatewayName: string,
    privateSubnet: IOCISubnetOptions,
    publicSubnet: IOCISubnetOptions,
    onPremisePublicCidrBlock: string,
    computeId: string,
    computeName: string,
    availabilityDomain: string,
    shapeName: string,
    cpuCount: number,
    memorySizeGB: number,
    bucketName: string
}

export interface ITargetMySQLOptions {
    adminUsername: string,
    adminPassword: string,
    adminPasswordConfirm: string,
    mysqlVersion: string
}

export interface IDBSystemOptions extends ITargetMySQLOptions {
    dbSystemId: string,
    name: string,
    description: string,
    contactEmails: string,
    hostnameLabel: string,
    availabilityDomain: string,
    faultDomain: string,
    enableHA: boolean,
    enableRestService: boolean,
    enableBackup: boolean,
    enableHeatWave: boolean,
    heatWaveShapeName: string,
    heatWaveClusterSize: number,
    shapeName: string,
    storageSizeGB: number,
    autoExpandStorage: boolean,
    autoExpandMaximumSizeGB: number
}

export interface IIncludeList {
    include: string[],
    exclude: string[]
}

export interface IMigrationFilters {
    users: IIncludeList,
    schemas: IIncludeList,
    tables: IIncludeList,
    views: IIncludeList,
    routines: IIncludeList,
    events: IIncludeList,
    libraries: IIncludeList,
    triggers: IIncludeList
}

export interface ISchemaSelectionOptions {
    filter: IMigrationFilters,
    migrateSchema: boolean,
    migrateData: boolean,
    migrateRoutines: boolean,
    migrateTriggers: boolean,
    migrateEvents: boolean,
    migrateLibraries: boolean,
    migrateUsers: boolean
}

export interface IMigrationOptions {
    sourceConnectionOptions: IShellDictionary | null,
    region: string,
    targetHostingOptions: IOCIHostingOptions | null,
    targetMySQLOptions: IDBSystemOptions | null,
    mysqlConfiguration: IShellDictionary[],
    migrationType: MigrationType,
    cloudConnectivity: CloudConnectivity,
    compatibilityFlags: CompatibilityFlags[],
    schemaSelection: ISchemaSelectionOptions
}

export interface IReplicationChannelInfo {
    sourceUser: string,
    replicateIgnoreDb: string[],
    replicateIgnoreTable: string[],
    replicateWildIgnoreTable: string[]
}

export interface IPreviewPlanData {
    options: IMigrationOptions,
    computeResolutionNotice: string,
    channelInfo: IReplicationChannelInfo | null
}

export interface IOCIProfileOptions {
    configFile: string,
    profile: string
}

export interface ISourceSelectionOptions {
    sourceUri: string,
    password: string
}

export interface IMigrationTypeOptions {
    type: MigrationType,
    connectivity: CloudConnectivity
}

export interface IMigrationChecksOptions {
    issueResolution: Record<string, CompatibilityFlags>
}

export interface ITargetOptionsOptions {
    hosting: IOCIHostingOptions | null,
    database: IDBSystemOptions | null
}

export interface IMigrationPlanState {
    id: SubStepId,
    status: MigrationStepStatus,
    errors: IMigrationError[],
    data: ISourceSelectionData | IMigrationTypeData | ISchemaSelectionData | IMigrationChecksData | ITargetOptionsData | IPreviewPlanData | null,
    values: IOCIProfileOptions | ISourceSelectionOptions | IMigrationTypeOptions | ISchemaSelectionOptions | IMigrationChecksOptions | ITargetOptionsOptions | null
}

export interface ISchemaObjects {
    schema: string,
    objects: string[]
}

export interface ISchemaTables {
    schema: string,
    tables: string[],
    views: string[]
}

export interface IWorkStageInfo {
    stage: SubStepId,
    caption: string,
    enabled: boolean,
    status: WorkStatus,
    errors: IMigrationError[],
    current: number | null,
    total: number | null,
    eta: number | null,
    message: string,
    info: IShellDictionary,
    logItems: number
}

export interface IMigrationSummaryInfo {
    adminUser: string,
    migrationType: string,
    cloudConnectivity: string,
    compartmentName: string,
    fullCompartmentName: string,
    region: string,
    dbSystemName: string,
    dbSystemId: string,
    dbSystemIP: string,
    dbSystemVersion: string,
    channelId: string,
    jumpHostName: string,
    jumpHostId: string,
    jumpHostPrivateIP: string,
    jumpHostPublicIP: string,
    jumpHostKeyPath: string,
    createdJumpHost: boolean,
    sourceHost: string,
    sourcePort: number,
    sourceVersion: string,
    bucketNamespace: string,
    bucketName: string,
    createdBucket: boolean
}

export interface IWorkStatusInfo {
    status: WorkStatus,
    stages: IWorkStageInfo[],
    summary: IMigrationSummaryInfo
}

export interface ILogInfo {
    data: string,
    lastOffset: number
}

export interface IMigrationStep {
    id: number,
    caption: string,
    help: string,
    type: string
}

export interface IMigrationSteps {
    id: number,
    caption: string,
    items: IMigrationStep[]
}

export interface IProjectData {
    name: string,
    path: string,
    id: string,
    source: string,
    modifyTime: string,
    dataMigrationDidFinish: boolean
}

export interface IProtocolMigrationParameters {
    [ShellAPIMigration.MigrationInfo]: {};
    [ShellAPIMigration.MigrationVersion]: {};
    [ShellAPIMigration.MigrationPlanUpdate]: { args: { configs: IShellDictionary[]; }; };
    [ShellAPIMigration.MigrationPlanGetDataItem]: { args: { what: PlanDataItemType; detail: string; }; };
    [ShellAPIMigration.MigrationPlanUpdateSubStep]: { args: { subStepId: number; configs: { }; }; };
    [ShellAPIMigration.MigrationPlanCommit]: { args: { subStepId: SubStepId; }; };
    [ShellAPIMigration.MigrationOciSignIn]: { args: { signUp?: boolean; }; };
    [ShellAPIMigration.MigrationWorkStart]: {};
    [ShellAPIMigration.MigrationWorkAbort]: {};
    [ShellAPIMigration.MigrationWorkClean]: { args: { options: { }; }; };
    [ShellAPIMigration.MigrationWorkStatus]: {};
    [ShellAPIMigration.MigrationWorkRetry]: {};
    [ShellAPIMigration.MigrationSkipTransactions]: { args: { gtids: string; }; };
    [ShellAPIMigration.MigrationFetchLogs]: { args: { subStepId?: SubStepId | null; offset?: number; }; };
    [ShellAPIMigration.MigrationGetSteps]: {};
    [ShellAPIMigration.MigrationNewProject]: { args: { name: string; sourceUrl?: string; }; };
    [ShellAPIMigration.MigrationOpenProject]: { args: { id: string; }; };
    [ShellAPIMigration.MigrationCloseProject]: { args: { id: string; }; };
    [ShellAPIMigration.MigrationListProjects]: {};

}

// TODO: Define all Interfaces and replace generic IDictionary usage
export type MigrationVersion = [number, number, number];

export interface IProtocolMigrationResults {
    [ShellAPIMigration.MigrationInfo]: { result: string; };
    [ShellAPIMigration.MigrationVersion]: { result: string; };
    [ShellAPIMigration.MigrationPlanUpdate]: { result: IMigrationPlanState[]; };
    [ShellAPIMigration.MigrationPlanGetDataItem]: { result: ISchemaObjects | ISchemaTables; };
    [ShellAPIMigration.MigrationPlanUpdateSubStep]: { result: IMigrationPlanState; };
    [ShellAPIMigration.MigrationPlanCommit]: { result: IMigrationPlanState; };
    [ShellAPIMigration.MigrationOciSignIn]: {};
    [ShellAPIMigration.MigrationWorkStart]: { result: IWorkStatusInfo; };
    [ShellAPIMigration.MigrationWorkAbort]: {};
    [ShellAPIMigration.MigrationWorkClean]: {};
    [ShellAPIMigration.MigrationWorkStatus]: { result: IWorkStatusInfo; };
    [ShellAPIMigration.MigrationWorkRetry]: {};
    [ShellAPIMigration.MigrationSkipTransactions]: {};
    [ShellAPIMigration.MigrationFetchLogs]: { result: ILogInfo; };
    [ShellAPIMigration.MigrationGetSteps]: { result: IMigrationSteps[]; };
    [ShellAPIMigration.MigrationNewProject]: { result: IProjectData; };
    [ShellAPIMigration.MigrationOpenProject]: { result: IProjectData; };
    [ShellAPIMigration.MigrationCloseProject]: {};
    [ShellAPIMigration.MigrationListProjects]: { result: IProjectData[]; };
}
