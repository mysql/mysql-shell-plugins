/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
/*
 * Copyright (c) 2025, 2026, Oracle and/or its affiliates.
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

import "./MigrationSubApp.css";
// import issues from "./issues.json";

import { Component, createRef, FunctionalComponent, RefObject, VNode } from "preact";

import { IMdsProfileData } from "../../communication/ProtocolMds.js";
import {
    IMigrationSteps,
    IMigrationError,
    IProjectData,
    MigrationStepStatus,
    SubStepId,
    IWorkStageInfo,
    IWorkStatusInfo,
    WorkStatus,
    MessageLevel,
    IMigrationSummaryInfo,
    IMigrationChecksData,
    IMigrationPlanState,
    MigrationType,
    CloudConnectivity,
    IPreviewPlanData,
    ICheckResult,
    IServerInfo,
    ITargetOptionsOptions,
    ITargetOptionsData,
    IMigrationTypeData,
    ILogInfo
} from "../../communication/ProtocolMigration.js";
import { AboutBox } from "../../components/ui/AboutBox/AboutBox.js";
import { Assets } from "../../supplement/Assets.js";
import { ICompartment as IOriginalCompartment } from "../../communication/index.js";
import { Button } from "../../components/ui/Button/Button.js";
import { Checkbox, CheckState } from "../../components/ui/Checkbox/Checkbox.js";
import { Codicon } from "../../components/ui/Codicon.js";
import { ClickEventCallback, ComponentPlacement } from "../../components/ui/Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../../components/ui/Container/Container.js";
import { Dropdown } from "../../components/ui/Dropdown/Dropdown.js";
import { DropdownItem } from "../../components/ui/Dropdown/DropdownItem.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import { JsonView } from "../../components/ui/JsonView/JsonView.js";
import { Label } from "../../components/ui/Label/Label.js";
import { Popup } from "../../components/ui/Popup/Popup.js";
import { ProgressIndicator } from "../../components/ui/ProgressIndicator/ProgressIndicator.js";
import { Grid } from "../../components/ui/Grid/Grid.js";
import { GridCell } from "../../components/ui/Grid/GridCell.js";
import { appParameters } from "../../supplement/AppParameters.js";
import { requisitions } from "../../supplement/Requisitions.js";
import { formatBytes } from "../../utilities/string-helpers.js";
import { ShellInterfaceMhs } from "../../supplement/ShellInterface/ShellInterfaceMhs.js";
import { ShellInteractiveInterface } from "../../supplement/ShellInterface/ShellInteractiveInterface.js"

import {
    ProjectsData,
    ShellInterfaceMigration
} from "../../supplement/ShellInterface/ShellInterfaceMigration.js";
import { convertErrorToString, sleep, uuid } from "../../utilities/helpers.js";
import { LoadingIndicator } from "../LazyAppRouter.js";
import { ui } from "../UILayer.js";
import { JsonObject, ValueType } from "../general-types.js";
import { Accordion, ISection } from "./Accordion.js";
import {
    FormGroupValues,
    ISelectOption,
    OciResource,
    Watcher,
    WatcherChanges,
    watchFormChanges
} from "./FormGroup.js";
import { MigrationOverview } from "./MigrationOverview.js";
import { MigrationStatus } from "./MigrationStatus.js";
import { Compartment, convertCompartments, IDatabaseSource, generateWbCmdLineArgs, waitForPromise } from "./helpers.js";
import {
    ComputeShapeInfo, ConfigTemplate, configTemplates, customTemplateId, getClusterSizeBoundaries, Shapes,
    shapesByTemplate, standardTemplateId
} from "./shapes.js";
import { UpDown } from "../../components/ui/UpDown/UpDown.js";
import { ShapeSummary } from "../../oci-typings/oci-mysql/lib/model/shape-summary.js";
import { IInputChangeProperties, Input } from "../../components/ui/Input/Input.js";
import { NotFoundShapesFor, ShapesHelper } from "./ShapesHelper.js";
import { BackendRequestHelper, toNumber, toBoolean, toFloat } from "./BackendRequestHelper.js";
import { IRadiobuttonProperties, Radiobutton } from "../../components/ui/Radiobutton/Radiobutton.js";
import { IPortalOptions, Portal } from "../../components/ui/Portal/Portal.js";
import { Dialog } from "../../components/ui/Dialog/Dialog.js";
import { CSSProperties } from "preact/compat";
import { MigrationSubAppLogger } from "./MigrationSubAppLogger.js";
import { WorkProgressView } from "./WorkProgressView.js";

interface ISpinnerProps { size?: number; }

export const Spinner: FunctionalComponent<ISpinnerProps> = ({ size = 12 }) => {
    return (
        <ProgressIndicator
            indicatorWidth={size}
            indicatorHeight={size}
            // backgroundOpacity={1}
            stroke={2}
        />
    );
};

class AbortError extends Error {
    public constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, AbortError.prototype);
    }
}

class SilentError extends Error {
    public constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, SilentError.prototype);
    }
}

// TODO - clicking accordion section should not expand it (unless it was already expanded before)
// - clicking next should try to commit the current step. if the commit fails, it should not go to next

interface ISubStep {
    id: SubStepId;
    caption: string;
    help: string;
    type: string;
    status: MigrationStepStatus;
    workStage?: IWorkStageInfo;
    output?: ILogInfo;
}

interface IStepTile {
    id: number;
    number: number;
    caption: string;
    steps: ISubStep[],
    color: string;
}

const stepsColorMap: Record<number, string> = {
    1: "#405963",
    2: "#769da5",
    3: "#8A4100",
    4: "#472037",
    5: "#2A2320",
};

const minStep = 1;

interface BadUserInput {
    level: MessageLevel;
    title: string;
    message: string;
    option: string;
}

type OciNetworking = "create_new" | "use_existing";

interface ISignInInfo {
    message: string;
    info?: {
        url?: string;
    };
}

type MockStateText = keyof Pick<IMigrationAppState, "fakeWebMessage" | "workStatus" | "mockBackendState">;

type ICompartment = Omit<IOriginalCompartment, "compartmentId"> & {
    compartmentId: string | null;
};

interface IMigrationSubAppProps { }

export interface IMigrationAppState {
    tiles: IStepTile[];
    maxStep: number;
    currentStep: number;
    overrideCurrentStep?: number; // whether user explicitly clicked on a step to view
    expandedSections: Set<string>;
    currentSubStepId?: number;
    lastSubStepId?: number;
    allowedSubSteps: Set<number>;
    migrationInProgress: boolean;
    migrationStatus: WorkStatus; // migration part done but replication might be on

    ociLoginInProgress: boolean;
    hasOciAccess: boolean;
    configProfiles: IMdsProfileData[];

    ociSignInInfo?: ISignInInfo;

    isFetchingCompartments: boolean;
    isFetchingVcns: boolean;
    isFetchingSubnets: boolean;
    isFetchingShapes: boolean;
    aborted?: boolean;
    migrationSource?: string;

    databaseSource: IDatabaseSource;

    projects?: ProjectsData;
    project?: IProjectData;

    formGroupValues: FormGroupValues;
    subStepConfig: Partial<Record<number, string>>;
    requestEditorEnabled: Partial<Record<SubStepId, CheckState | undefined>>;
    backendState: Partial<Record<SubStepId | number, Omit<IMigrationPlanState, "id">>>;
    showFormPreview: boolean;

    planStepData: Partial<Record<string, string>>;

    backendRequestInProgress: boolean;
    issueResolution: Partial<Record<string, string>>;
    expandedIssues: Partial<Record<string, boolean>>;

    // complaints from backend about frontend user input
    targetOptionErrors: BadUserInput[];

    originalCompartments: ICompartment[],
    compartments: ISelectOption[],
    networkCompartments: ISelectOption[],
    vcns: ISelectOption[],
    subnets: ISelectOption[],

    shapes: Partial<Record<string, Shapes>>;

    summaryInfo: Partial<IMigrationSummaryInfo>;

    deleteJumpHost: boolean;
    deleteBucket: boolean;

    // DEV
    fakeWebMessage: string;
    workStatus?: string;
    mockBackendState?: string;
    renderDevHelpers?: boolean;
    showBackendRequest?: boolean;
    showBackendState?: boolean;
    abortMigration?: boolean;

    aboutVisible?: boolean;

    logPath?: string;
    projectsPath?: string;
}

export default class MigrationSubApp extends Component<IMigrationSubAppProps, IMigrationAppState> {
    private portalRef = createRef<Portal>();
    private readonly popups = new Map<MockStateText, RefObject<Popup>>();
    private dialogRef = createRef<Dialog>();
    private interactive = new ShellInteractiveInterface();
    private mhs = new ShellInterfaceMhs(this.interactive);
    private enableLogger = new URLSearchParams(window.location.search).has("enableLogger");
    private migration = new ShellInterfaceMigration(this.enableLogger);
    private logger = new MigrationSubAppLogger(this.enableLogger || !!appParameters.inDevelopment);

    private sh = new ShapesHelper(shapesByTemplate);
    private beReq = new BackendRequestHelper();
    private aboutBoxRef = createRef<AboutBox>();

    private shapesFetched = false;

    private queryParams = new URLSearchParams(window.location.search);

    private get watchers(): Watcher[] {
        return [
            {
                field: "profile",
                shouldTrigger: (value) => {
                    // return configProfiles.length !== 0;
                    return true;
                },
                getUpdatedState: this.watchProfile,
            },
            {
                field: "hosting.parentCompartmentId",
                shouldTrigger: (value) => {
                    return true;
                },
                getUpdatedState: this.addCreateNewMysqlCompartment,
            },
            {
                field: "hosting.networkCompartmentId",
                shouldTrigger: (value) => {
                    return !!this.profile && !!value && value !== "";
                },
                getUpdatedState: this.watchNetworkCompartment,
            },
            {
                field: "hosting.networkCompartmentId",
                shouldTrigger: (value) => {
                    return !value;
                },
                getUpdatedState: this.resetNetworking,
            },
            {
                field: "hosting.vcnId",
                shouldTrigger: (value) => {
                    return value === "";
                },
                getUpdatedState: this.updateSubnets,
            },
            {
                field: "hosting.vcnId",
                shouldTrigger: (value) => {
                    return !!value && value !== "";
                },
                getUpdatedState: this.watchVcn,
            },
            {
                field: "hosting.compartmentId",
                shouldTrigger: (_value) => {
                    return true;
                },
                getUpdatedState: this.updateShapes,
            },
        ];
    }

    private get exportInProgress(): boolean {
        return this.isSubStepInProgress(3, SubStepId.DUMP);
    }

    private get importInProgress(): boolean {
        return this.isSubStepInProgress(3, SubStepId.LOAD);
    }

    private get replicationInProgress(): boolean {
        return this.isSubStepInProgress(4, SubStepId.CREATE_CHANNEL)
            || this.isSubStepInProgress(5, SubStepId.MONITOR_CHANNEL);
    }

    private get getCurrentStep(): number {
        const { currentStep, overrideCurrentStep } = this.state;

        return overrideCurrentStep ?? currentStep;
    }

    private get getNextSubStep() {
        // #TODO: simplify as only first step has navigation
        const { currentSubStepId, lastSubStepId, tiles, currentStep } = this.state;

        const tile = this.getCurrentStepInfo();
        if (!tile || currentSubStepId == SubStepId.PREVIEW_PLAN || currentStep > 1) {
            return undefined;
        }

        if (!currentSubStepId) {
            return {
                stepId: tile.id,
                subStepId: lastSubStepId ?? tile.steps[0].id,
            };
        }

        const { stepIndex, subStepIndex } = this.findStepIndexes(tile.id, currentSubStepId);

        if (subStepIndex + 1 < tiles[stepIndex].steps.length) {
            return {
                stepId: tiles[stepIndex].id,
                subStepId: tiles[stepIndex].steps[subStepIndex + 1].id,
            };
        }

        if (stepIndex + 1 < tiles.length) {
            const nextTile = tiles[stepIndex + 1];

            return {
                stepId: nextTile.id,
                subStepId: nextTile.steps[0].id,
            };
        }
    }

    private get getPrevSubStep() {
        // #TODO: simplify as only first step has navigation
        const { currentSubStepId, tiles } = this.state;

        const tile = this.getCurrentStepInfo();
        if (!tile || !currentSubStepId) {
            return undefined;
        }

        const { stepIndex, subStepIndex } = this.findStepIndexes(tile.id, currentSubStepId);

        if (subStepIndex > 0) {
            return {
                stepId: tiles[stepIndex].id,
                subStepId: tiles[stepIndex].steps[subStepIndex - 1].id,
            };
        }

        if (stepIndex > 0) {
            const prevTile = tiles[stepIndex - 1];
            const lastSubStep = prevTile.steps[prevTile.steps.length - 1];

            return {
                stepId: prevTile.id,
                subStepId: lastSubStep.id,
            };
        }

        return undefined;
    }

    private get uniqueConnectionId() {
        // return this.state.databaseSource.id ?? this.state.databaseSource.name;
        return this.state.databaseSource.name;
    }

    private get connectionString() {
        return `${this.state.databaseSource.host}:${this.state.databaseSource.port}`;
    }

    private get fullConnectionString() {
        return `${this.state.databaseSource.user}@${this.state.databaseSource.host}:${this.state.databaseSource.port}`;
    }

    private get profile(): string | undefined {
        return this.state.formGroupValues.profile;
    }

    private get compartments() {
        return this.state.compartments;
    }

    private get networkCompartments() {
        return this.state.networkCompartments;
    }

    private get vcns() {
        return this.state.vcns;
    }

    private get privateSubnets() {
        return this.state.subnets;
    }

    private get publicSubnets() {
        return this.state.subnets;
    }

    private get configTemplate(): ConfigTemplate {
        return this.state.formGroupValues["hosting.configTemplate"]!;
    }

    private get compartment(): string | undefined {
        return this.state.formGroupValues["hosting.compartmentId"];
    }

    private get compartmentName(): string | undefined {
        return this.state.formGroupValues["hosting.compartmentName"];
    }

    private get networkCompartment(): string | undefined {
        return this.state.formGroupValues["hosting.networkCompartmentId"];
    }

    private get parentCompartment(): string | undefined {
        return this.state.formGroupValues["hosting.parentCompartmentId"];
    }

    private get ociNetworking(): OciNetworking {
        return toBoolean(this.state.formGroupValues["hosting.createVcn"]) ? "create_new" : "use_existing";
    }

    private get vcn(): string | undefined {
        return this.state.formGroupValues["hosting.vcnId"];
    }

    private get privateSubnet(): string | undefined {
        return this.state.formGroupValues["hosting.privateSubnet.id"];
    }

    private get publicSubnet(): string | undefined {
        return this.state.formGroupValues["hosting.publicSubnet.id"];
    }

    private get connectivity() {
        const { type, connectivity } = this.state.formGroupValues;

        if (type === MigrationType.HOT) {
            return connectivity as CloudConnectivity | undefined;
        } else {
            return CloudConnectivity.NOT_SET;
        }
    }

    private get dbSystemShape(): string | undefined {
        return this.state.formGroupValues["database.shapeName"];
    }

    private get heatWaveClusterSize(): number {
        return toNumber(this.state.formGroupValues["database.heatWaveClusterSize"]);
    }

    private get heatWaveShapeName(): string | undefined {
        const heatWaveShapeName = this.state.formGroupValues["database.heatWaveShapeName"];
        if (heatWaveShapeName === "") {
            return "0";
        }

        return heatWaveShapeName;
    }

    public constructor(props: IMigrationSubAppProps) {
        super(props);

        const databaseSource: IDatabaseSource = {
            name: this.queryParams.get("connectionName") ?? "local connection",
            user: this.queryParams.get("user") ?? "root",
            host: this.queryParams.get("host") ?? "localhost",
            port: this.queryParams.get("port") ?? "3306",
            id: uuid(),
        };

        this.state = {
            tiles: [],
            maxStep: 1,
            currentStep: minStep,
            overrideCurrentStep: undefined,
            allowedSubSteps: new Set(),
            expandedSections: new Set(),
            migrationInProgress: false,
            migrationStatus: WorkStatus.NOT_STARTED,

            ociLoginInProgress: false,
            hasOciAccess: false,
            configProfiles: [],

            isFetchingCompartments: false,
            isFetchingVcns: false,
            isFetchingSubnets: false,
            isFetchingShapes: false,
            migrationSource: undefined,

            databaseSource,

            // TODO(this should be initialized to some value that makes sense),
            // possibly a value in MYSQLSH_USER_CONFIG_HOME/migration-assistant/projectname
            // OTOH the if the project_name is the folder, why do we need a directory
            // parameter in newProject? in any case, just adding it here to make the FE match the BE
            formGroupValues: {
                // "type": MigrationType.COLD,
                "hosting.compartmentId": "create_new",
                "hosting.configTemplate": standardTemplateId,

                "database.storageSizeGB": "50",
                "database.enableHeatWave": "database.enableHeatWave",
                "database.heatWaveClusterSize": "1",

                "database.enableHA": "database.enableHA",
                "hosting.cpuCount": "1",

                "hosting.keepCompute": "hosting.keepCompute",
                // "database.name",

                "database.enableRestService": "database.enableRestService",
                "database.adminUsername": "admin",
                // "database.contactEmails",
            },
            subStepConfig: {},
            requestEditorEnabled: {},
            backendState: {},
            backendRequestInProgress: false,
            showFormPreview: true,

            planStepData: {},

            issueResolution: {},
            expandedIssues: {},
            shapes: {},

            targetOptionErrors: [],

            originalCompartments: [],
            compartments: [],
            networkCompartments: [],
            vcns: [],
            subnets: [],

            summaryInfo: {},

            deleteJumpHost: false,
            deleteBucket: true,

            // DEV
            fakeWebMessage: JSON.stringify(databaseSource),
            renderDevHelpers: !!this.queryParams.get("renderDevHelpers"),
            showBackendRequest: !!this.queryParams.get("showBackendRequest"),
            showBackendState: !!this.queryParams.get("showBackendState"),
            abortMigration: !!this.queryParams.get("abortMigration"),

            aboutVisible: false,
            logPath: "",
            projectsPath: ""
        };
    }

    public override componentDidMount(): void {
        // window.mhs = this.mhs;
        requisitions.register("setCommandLineArguments", this.setCommandLineArguments);
        requisitions.register("setApplicationData", this.setApplicationData);
        requisitions.register("showAbout", this.showAbout);
        requisitions.executeRemote("migrationAssistantMounted", undefined);

        void this.onLoad().then(() => {
            requisitions.executeRemote("getCommandLineArguments", undefined);
            requisitions.executeRemote("getApplicationData", undefined);

            if (appParameters.inDevelopment || this.queryParams.has("autoSendWebMessage")) {
                // Emulate receiving from the native Workbench.
                this.onSendWebMessageClick(new MouseEvent(""));
            }
        });
    }

    public override componentDidUpdate(_prevProps: Readonly<IMigrationSubAppProps>,
        prevState: Readonly<IMigrationAppState>): void {
        const { formGroupValues } = this.state;

        this.handleOverlay(prevState);

        void watchFormChanges(prevState, formGroupValues, this.watchers);
    }

    public override componentWillUnmount(): void {
        requisitions.unregister("setCommandLineArguments", this.setCommandLineArguments);
        requisitions.unregister("setApplicationData", this.setApplicationData);
        requisitions.unregister("showAbout", this.showAbout);
    }

    public override render() {
        const { tiles, migrationInProgress, migrationStatus, backendState, project,
            renderDevHelpers, aboutVisible, aborted } = this.state;

        if (aborted) {
            return null;
        }

        const info = this.getServerInfoObject();

        return (
            <div className="migration-sub-app">
                <Portal id="backend-request-overlay" ref={this.portalRef}>
                    {LoadingIndicator}
                </Portal>
                <Container
                    orientation={Orientation.LeftToRight}
                    mainAlignment={ContentAlignment.SpaceBetween}
                    className="header"
                >
                    <h1>MySQL HeatWave Migration Assistant</h1>

                    {this.renderProjects()}
                </Container>

                {renderDevHelpers && this.renderDevHelpers()}

                {aboutVisible && this.renderAboutDialog()}

                {!tiles.length ? LoadingIndicator : (
                    project ? (
                        <div className="content">
                            <Grid columns={["auto", "auto", "auto"]} className="source-info"
                                columnGap={30} rowGap={5}>
                                <GridCell crossAlignment={ContentAlignment.Center}>
                                    {/* TODO replace these icons with proper ones... Assets.stuff isnt working */}
                                    <Icon src={Assets.db.schemaIcon} width={16} height={12}
                                        style={{ marginRight: 8, background: "black" }} />
                                    {project.name}
                                </GridCell>
                                {info && (
                                    <>
                                        <GridCell crossAlignment={ContentAlignment.Center}>
                                            {`${info.serverType} ${info.version} - ${info.versionComment}`}
                                        </GridCell>
                                        <GridCell crossAlignment={ContentAlignment.Center}>
                                            <Icon src={Assets.db.schemaIcon} width={16} height={12}
                                                style={{ marginRight: 8 }} />
                                            {info.schemaCount ? `Schemas: ${info.schemaCount}` : ""}
                                        </GridCell>

                                        <GridCell crossAlignment={ContentAlignment.Center}>
                                            <Icon src={Assets.migration.infoNetwork} width={16} height={12}
                                                style={{ marginRight: 8, background: "black" }} />
                                            {project.source}
                                        </GridCell>
                                        <GridCell crossAlignment={ContentAlignment.Center}>
                                            {info.replicationStatus}
                                        </GridCell>
                                        <GridCell crossAlignment={ContentAlignment.Center}>
                                            <Icon src={Codicon.SymbolRuler} width={16} height={12}
                                                style={{ marginRight: 8, background: "transparent" }} />
                                            {info.dataSize ? `Estimated Size: ~${formatBytes(info.dataSize)}` : ""}
                                        </GridCell>
                                    </>
                                )}

                            </Grid>

                            <h4>Migration Steps</h4>

                            <Container orientation={Orientation.LeftToRight} className="tiles">
                                {tiles.map((tile) => {
                                    const isActive = this.getCurrentStep >= tile.number || migrationInProgress;

                                    return (
                                        <div
                                            key={tile.number}
                                            className={`tile ${isActive ? "active" : ""}`}
                                            style={{ backgroundColor: tile.color }}
                                            onClick={this.onTileClick.bind(this, tile)}
                                        >
                                            <h3>{tile.number}</h3>
                                            <h4>{tile.caption}</h4>
                                            <ul className="sub-steps">
                                                {tile.steps.map((step) => {
                                                    const status = backendState[step.id]?.status ?? step.status;
                                                    const enabled = step.workStage?.enabled;

                                                    return (
                                                        <li
                                                            key={step.id}
                                                            className="sub-step"
                                                            id={`tile-sub-step-${step.id}`}
                                                        >
                                                            {<MigrationStatus status={status} enabled={enabled}
                                                                work={tile.number > 1 && step.id !== SubStepId.CONGRATS}
                                                            />}
                                                            {step.caption}
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    );
                                })}
                            </Container>

                            {this.renderMain()}

                        </div>
                    ) : null
                )}

                {project && (
                    <Container mainAlignment={ContentAlignment.End} className="footer">
                        {this.renderNavigation()}

                        <div className="footer-spacer"></div>

                        {(migrationStatus === WorkStatus.IN_PROGRESS ||
                            migrationStatus === WorkStatus.ABORTED ||
                            migrationStatus === WorkStatus.ERROR) &&
                            <Button
                                caption="Abort"
                                disabled={!migrationInProgress}
                                onClick={() => {
                                    void this.stopMigration();
                                }}
                                className="stop-migration"
                            />}
                        <Button
                            caption="Start Migration Process"
                            isDefault={false}
                            onClick={() => {
                                void this.startMigration();
                            }}
                            disabled={migrationInProgress ||
                                migrationStatus === WorkStatus.FINISHED ||
                                migrationStatus === WorkStatus.READY ||
                                !this.profile}
                            className="start-migration"
                        />
                    </Container>
                )}
            </div>
        );
    }

    private async onLoad() {
        try {
            const tiles = await this.fetchTiles();
            await this.updateState({ tiles, ociLoginInProgress: true });
            await this.ensureOciAccess(false, tiles, 1);

        } catch (e) {
            console.error(e);
            const message = convertErrorToString(e);
            ui.showErrorMessage(message, {});
        } finally {
            this.setState({ ociLoginInProgress: false });
        }
    }

    private passwordNeeded = (stepsState?: IMigrationPlanState[]) => {
        if (stepsState) {
            const step = stepsState.find((subStep) => {
                return subStep.id === SubStepId.SOURCE_SELECTION
                    && subStep.status === MigrationStepStatus.FINISHED;
            });
            if (step) {
                return false;
            }
        }

        return true;
    };

    private async initialLoading(currentProject: IProjectData) {
        const project = await this.migration.openProject(currentProject.id);
        const projects = await this.migration.listProjects();
        this.setState({ project, projects });

        let stepsState: IMigrationPlanState[] | undefined = await this.refreshFromBackend();

        if (this.passwordNeeded(stepsState)) {
            stepsState = await this.requestForPassword();
        }

        this.expandNextUnfinishedSection(stepsState);

        await this.monitorWorkProgress();
    }

    private expandNextUnfinishedSection(stepsState?: IMigrationPlanState[]) {
        const { tiles } = this.state;

        let tile = tiles[0];
        let subStepId = tile.steps[0].id;

        const subStepState = stepsState?.find((s) => {
            return s.status !== MigrationStepStatus.FINISHED;
        });

        if (subStepState) {
            const foundTile = tiles.find((t) => {
                return t.steps.find((s) => {
                    return s.id === subStepState.id;
                }) !== undefined;
            });
            if (foundTile) {
                tile = foundTile;
                subStepId = subStepState.id;
            }
        }

        const sectionKey = this.getSectionKey(tile.id, `${subStepId}`);
        this.setSubStep(sectionKey, true);
    }

    private renderNavigation() {
        const { backendRequestInProgress, currentSubStepId } = this.state;

        // if (currentStep !== 1 || this.isStep1Finished) {
        //     return null;
        // }

        return (
            <Container orientation={Orientation.LeftToRight}>
                <Button
                    caption="Back"
                    disabled={!this.getPrevSubStep}
                    onClick={this.onBack}
                />

                <Button
                    caption="Next"
                    disabled={!this.getNextSubStep || backendRequestInProgress || this.getCurrentStep > 1}
                    isDefault={true}
                    onClick={() => {
                        void this.onNext(currentSubStepId);
                    }}
                />
            </Container>
        );
    }

    private navigateInto(stepInfo: { stepId: number, subStepId: number; } | undefined, forward: boolean) {
        if (stepInfo === undefined) {
            return;
        }

        const { stepId, subStepId } = stepInfo;
        const sectionKey = this.getSectionKey(stepId, `${subStepId}`);
        this.setSubStep(sectionKey, true);

        if (forward) {
            void this.initSubStep(subStepId);
        }
    }

    private onBack = () => {
        this.collapseCurrentSection();
        this.navigateInto(this.getPrevSubStep, false);
    };

    private async commitAll() {
        const { tiles } = this.state;
        for (const tile of tiles) {
            if (tile.number > 1) {
                return;
            }
            for (const subStep of tile.steps) {
                // await this.submitSubStep(subStep.id, true);
                await this.onNext(subStep.id);
            }
        }
    }

    private async submitSubStep(subStepId: SubStepId, commit?: boolean) {
        const stepInfo = await this.updateOne(subStepId);

        const targetOptionErrors = this.filterBadUserInputErrors(stepInfo.errors);
        this.setState({ targetOptionErrors });

        if (commit && stepInfo.status !== MigrationStepStatus.FINISHED) {
            if (stepInfo.status == MigrationStepStatus.READY_TO_COMMIT) {
                return this.commitSubStep(subStepId);
            } else {
                this.displayErrors(stepInfo.errors);
                throw new Error(`Can't commit subStep ${subStepId} yet`);
            }
        }

    }

    private handleError(stepInfo: IMigrationPlanState, type: "Update" | "Commit") {
        const processedErrors = new Set<number>();
        switch (stepInfo.id) {
            case SubStepId.SOURCE_SELECTION: {
                if (type === "Commit") {
                    for (const [index, error] of stepInfo.errors.entries()) {
                        const displayedMessage = this.getDisplayedMessage(error);
                        ui.showErrorMessage(displayedMessage, { modal: true });

                        processedErrors.add(index);
                    }

                    void this.requestForPassword();
                }
                break;
            }
            default: {
                break;
            }
        }

        const remainingErrors = stepInfo.errors.filter((_e, index) => {
            return !processedErrors.has(index);
        });

        const message = `${type} error occurred`;
        if (!remainingErrors.length) {
            throw new SilentError(message);
        }

        this.displayErrors(remainingErrors);

        console.log(`${type} ERROR`, stepInfo);
        throw new Error(message);
    }

    private displayErrors(errors: IMigrationError[], prefix?: string) {
        let focusId: string | undefined;
        for (const error of errors) {
            const { info, level, type } = error;
            if (!focusId && info && "input" in info && typeof info.input === "string" && info.input
                && document.getElementById(info.input)) {
                focusId = info.input;
            }
            if (type !== "BadUserInput" && type != "InvalidParameter") {
                const displayedMessage = this.getDisplayedMessage(error, prefix);
                switch (level) {
                    case MessageLevel.NOTICE:
                        ui.showInformationMessage(displayedMessage, {});
                        break;
                    case MessageLevel.WARNING:
                        ui.showWarningMessage(displayedMessage, {});
                        break;
                    case MessageLevel.ERROR:
                        ui.showErrorMessage(displayedMessage, {});
                        break;
                }
            }
        }

        if (focusId) {
            const element = document.getElementById(focusId);
            element?.scrollIntoView();
            element?.focus();
        }
    }

    private getDisplayedMessage({ level, message, title }: IMigrationError, prefix?: string) {
        return `${prefix ? `${prefix} | ` : ""}${level}: ${message}. ${title}`;
    }

    private async commitSubStep(subStepId: SubStepId) {
        const commitResult = await this.commit(subStepId);
        if (commitResult?.status === MigrationStepStatus.ERROR) {
            this.handleError(commitResult, "Commit");
        } else if (commitResult?.status == MigrationStepStatus.FINISHED) {
            console.log("COMMITTED", subStepId);
            // when a sub-step is committed, the backend will automatically
            // initialize the following ones that depend on it:
            // for SOURCE_SELECTION:
            // - MIGRATION_TYPE
            // - MIGRATION_CHECKS
            // for OCI_PROFILE:
            // - TARGET_OPTIONS
            //
            // OCI_PROFILE is implicitly initialized when project is created

            return this.refreshFromBackend();
        }
    }

    private filterBadUserInputErrors(errors: IMigrationError[]): BadUserInput[] {
        return errors.filter(o => {
            return o.type === "BadUserInput" || o.type === "InvalidParameter";
        }).map(o => {
            if (o.info?.input === "database.shapeName" || o.info?.input == "hosting.shapeName") {
                o.info.input = "hosting.configTemplate";
            }

            return {
                level: o.level,
                title: o.title ?? "",
                message: o.message,
                option: o.info?.input as string
            };
        });
    }

    private renderBadUserInputErrorsFor(option: string) {
        const matches = this.state.targetOptionErrors.filter(o => {
            return o.option === option;
        });

        if (!matches.length) {
            return null;
        }

        return (
            <div class="input-errors">
                {matches.map(item => {
                    let text;
                    if (item.title) {
                        text = `<h4>${item.title}</h4>${item.message}`;
                    } else {
                        text = item.message;
                    }

                    return (
                        <div>
                            <p dangerouslySetInnerHTML={{
                                __html:
                                    item.level === "WARNING" ? "⚠️" + text : text
                            }} className={"input-" + item.level.toLowerCase()} ></p>
                        </div>);
                })
                }
            </div>
        );
    }

    private formGroupElementDetailsFor(option: string) {
        if (option === "hosting.compartmentId") {
            return (
                <p dangerouslySetInnerHTML={{
                    __html: this.state.planStepData.compartmentPath ?? ""
                }} className="form-element-detail" ></p>
            );
        } else if (option === "hosting.networkCompartmentId") {
            return (
                <p dangerouslySetInnerHTML={{
                    __html: this.state.planStepData.networkCompartmentPath ?? ""
                }} className="form-element-detail" ></p>
            );
        }

        return null;
    }

    private async processSubStep(subStepId?: SubStepId) {
        const updateResult = await this.update(subStepId);
        if (updateResult) {
            const stepInfo = updateResult.find((s) => {
                return s.id === subStepId;
            });
            if (stepInfo?.status === MigrationStepStatus.ERROR) {
                this.handleError(stepInfo, "Update");
            }
        }

        const commitResult = await this.commit(subStepId);

        if (commitResult?.status === MigrationStepStatus.ERROR) {
            this.handleError(commitResult, "Commit");
        }
    }

    private async refreshFromBackend() {
        let stepsState: IMigrationPlanState[];

        console.log(`Refreshing from backend state`);

        try {
            this.setState({ backendRequestInProgress: true });
            stepsState = await this.migration.planUpdate([]);
            this.handleSubStepStates(stepsState);
        } finally {
            this.setState({ backendRequestInProgress: false });
        }

        return stepsState;
    }

    private async doPlanUpdate(configs: Array<{ id: SubStepId, values?: object; }>) {
        let stepsState: IMigrationPlanState[] | undefined;

        this.log(`About to call planUpdate with `, configs);

        try {
            this.setState({ backendRequestInProgress: true });
            stepsState = await this.migration.planUpdate(configs);
            this.handleSubStepStates(stepsState);
        } finally {
            this.setState({ backendRequestInProgress: false });
        }

        return stepsState;
    }

    private async doPlanUpdateSubStep(id: SubStepId, configs?: object) {
        let stepsState: IMigrationPlanState;
        const data = configs ? { "values": configs } : {};

        this.log(`About to call planUpdateSubStep ${id} with `, data);

        try {
            this.setState({ backendRequestInProgress: true });
            stepsState = await this.migration.planUpdateSubStep(id, data);
            this.handleSubStepStates([stepsState]);
        } finally {
            this.setState({ backendRequestInProgress: false });
        }

        return stepsState;
    }

    private onNext = async (subStepId?: SubStepId) => {
        if (subStepId === SubStepId.OCI_PROFILE) {
            // the OCI_PROFILE sub-step updated on dropdown change, and TARGET_OPTIONS depend on it
            await this.submitSubStep(SubStepId.TARGET_OPTIONS, true);
        } else {
            if (subStepId) {
                await this.submitSubStep(subStepId, true);
            }
        }

        this.collapseCurrentSection();
        const { stepId } = this.getNextSubStep ?? {};
        if (!stepId || stepId < 1100) {
            this.navigateInto(this.getNextSubStep, true);
        }

        // try {
        //     await this.processSubStep(subStepId, true);
        //     if (subStepId === SubStepId.OCI_PROFILE) {
        //         await this.processSubStep(SubStepId.TARGET_OPTIONS, true);
        //     }

        // } catch (e) {
        //     console.error(e);

        //     return;
        // }

        // this.collapseCurrentSection();
        // this.handleNavigation(this.getNextSubStep);
    };

    private async initSubStep(subStepId: SubStepId) {
        return this.doPlanUpdate([{ id: subStepId }]);
    };

    private async update(subStepId?: SubStepId) {
        const { requestEditorEnabled, subStepConfig } = this.state;
        let stepsState: IMigrationPlanState[] | undefined;

        if (!subStepId) {
            return stepsState;
        }

        const isEditorEnabled = requestEditorEnabled[subStepId];
        let json: string;
        if (isEditorEnabled) {
            json = subStepConfig[subStepId] ?? "";
        } else {
            json = this.beReq.generateBackendRequest(subStepId, this.state);
        }

        const values = JSON.parse(json) as object;
        const configs = [
            {
                id: subStepId,
                values,
            },
        ];

        return this.doPlanUpdate(configs);
    };

    private async updateOne(subStepId: SubStepId) {
        const json = this.beReq.generateBackendRequest(subStepId, this.state);
        const values = JSON.parse(json) as object;

        const stepInfo = await this.doPlanUpdateSubStep(subStepId, values);

        if (stepInfo.status === MigrationStepStatus.ERROR) {
            this.handleError(stepInfo, "Update");
        }
        this.log("Update OK", stepInfo);

        return stepInfo;
    };

    private async commit(subStepId?: SubStepId) {
        const { backendState } = this.state;
        const tile = this.getCurrentStepInfo();
        let subStepState: IMigrationPlanState | undefined;
        if (!tile || !subStepId || backendState[subStepId]?.status !== MigrationStepStatus.READY_TO_COMMIT) {
            return subStepState;
        }

        console.log("About to call planCommit with ",
            subStepId, `info: ${tile.caption}`);

        try {
            this.setState({ backendRequestInProgress: true });

            subStepState = await this.migration.planCommit(subStepId);
            this.handleSubStepState(subStepId, subStepState);
        } finally {
            this.setState({ backendRequestInProgress: false });
        }

        return subStepState;
    }

    private collapseCurrentSection() {
        const tile = this.getCurrentStepInfo();
        const { currentSubStepId } = this.state;
        if (tile && currentSubStepId) {
            const sectionKey = this.getSectionKey(tile.id, `${currentSubStepId}`);
            this.handleSectionExpansion(sectionKey, false);
        }
    }

    private setSubStep(sectionId: string, allowSubStep?: boolean) {
        const { tiles, allowedSubSteps } = this.state;

        const { stepId, subStepId } = this.parseStepInfo(sectionId);
        const { stepIndex } = this.findStepIndexes(stepId, subStepId);

        this.handleSectionExpansion(sectionId, true);

        const state: Partial<IMigrationAppState> = {
            currentStep: tiles[stepIndex].number,
            currentSubStepId: subStepId,
            lastSubStepId: subStepId,
        };
        if (allowSubStep) {
            allowedSubSteps.add(subStepId);
        }

        this.setState(state);
    }

    private handleManualSectionExpansion = (sectionId: string,
        expanded: boolean): void => {
        const { allowedSubSteps } = this.state;
        const { subStepId } = this.parseStepInfo(sectionId);
        if (!allowedSubSteps.has(subStepId)) {
            // return;
        }
        this.handleSectionExpansion(sectionId, expanded);
    };

    private handleSectionExpansion(sectionId: string, expanded: boolean) {
        const { expandedSections } = this.state;

        if (expanded) {
            expandedSections.add(sectionId);
        } else {
            expandedSections.delete(sectionId);
        }

        const { subStepId: currentSubStepId } = this.parseStepInfo(sectionId);
        this.setState({ expandedSections, currentSubStepId });
    }

    private getSectionKey(stepId: number, subStepId: string): string {
        return `${stepId}_${subStepId}`;
    }

    private parseStepInfo(sectionKey: string) {
        const [stepId, subStepId] = sectionKey.split("_");

        return { stepId: parseInt(stepId, 10), subStepId: parseInt(subStepId, 10) };
    }

    private onTileClick(tile: IStepTile) {
        if (tile.number === this.state.overrideCurrentStep) {
            this.setState({ currentStep: tile.number, overrideCurrentStep: undefined });
        } else {
            this.setState({ currentStep: tile.number, overrideCurrentStep: tile.number });
        }
    }

    private async monitorWorkProgress(): Promise<void> {
        const { tiles, project } = this.state;

        try {
            const backendWorkState = await this.fetchWorkStatus();

            await this.updateWorkStatus(tiles, backendWorkState);

            if (backendWorkState.status == WorkStatus.IN_PROGRESS
                || backendWorkState.status == WorkStatus.READY
            ) {
                await sleep(2000);
                await this.monitorWorkProgress();
            } else {
                const stopOnStatus = [
                    WorkStatus.ABORTED,
                    WorkStatus.ERROR,
                    WorkStatus.FINISHED,
                ];
                if (project && stopOnStatus.includes(backendWorkState.status)) {
                    requisitions.executeRemote("migrationStopped", project);
                }
                this.setState({
                    migrationInProgress: false,
                });
            }
        } catch (error) {
            console.error("An error occurred while monitoring progress:", error);
        }
    }

    private async startMigration() {
        let resuming = false;

        {
            const backendWorkState = await this.fetchWorkStatus();

            if (backendWorkState.status === WorkStatus.ABORTED ||
                backendWorkState.status === WorkStatus.ERROR) {
                resuming = true;
            }
        }

        this.setState({ migrationInProgress: true });

        if (!resuming) {
            await this.commitAll();
        }

        const { tiles, abortMigration, project } = this.state;

        if (abortMigration) {
            this.setState({ migrationInProgress: false });
            ui.showInformationMessage("Aborted successfully.", { modal: true });

            return;
        }

        if (project) {
            requisitions.executeRemote("migrationStarted", project);
        }
        this.setState({ backendRequestInProgress: true });
        try {
            const backendWorkState = await this.migration.workStart();

            this.setState({ backendRequestInProgress: false, migrationInProgress: true });

            await this.updateWorkStatus(tiles, backendWorkState);
        } catch (e) {
            console.error(e);
            const message = convertErrorToString(e);
            ui.showErrorMessage(`Failed to start: ${message}`, {});
        } finally {
            this.setState({ backendRequestInProgress: false, migrationInProgress: false });
        }

        await this.monitorWorkProgress();
    }

    private async stopMigration() {
        this.setState({ backendRequestInProgress: true });
        try {
            await this.migration.workAbort();
        } catch (e) {
            console.error(e);
            const message = convertErrorToString(e);
            ui.showErrorMessage(`Failed to abort: ${message}`, {});
        } finally {
            this.setState({ backendRequestInProgress: false });
        }
    }

    private updateWorkStatus(tiles: IStepTile[], workStatus: IWorkStatusInfo): Promise<void> {
        return new Promise((resolve) => {
            const newTiles = [...tiles];
            let currentActiveStep;
            let currentErrorStep;

            workStatus.stages.map((stage) => {
                const stepId = Math.round(stage.stage / 1000) * 1000;
                const { stepIndex, subStepIndex } = this.findStepIndexes(stepId, stage.stage);

                if (stepIndex >= 0 && subStepIndex >= 0) {
                    const step = newTiles[stepIndex].steps[subStepIndex];
                    step.workStage = stage;

                    const status = step.status;

                    switch (stage.status) {
                        case WorkStatus.IN_PROGRESS:
                            if (status == MigrationStepStatus.NOT_STARTED) {
                                step.status = MigrationStepStatus.IN_PROGRESS;
                                currentActiveStep ??= newTiles[stepIndex].number;
                            } else if (status == MigrationStepStatus.IN_PROGRESS) {
                                currentActiveStep ??= newTiles[stepIndex].number;
                            }
                            break;
                        case WorkStatus.FINISHED:
                            if (status != MigrationStepStatus.FINISHED) {
                                step.status = MigrationStepStatus.FINISHED;
                            }
                            break;
                        case WorkStatus.ABORTED:
                            break;
                        case WorkStatus.ERROR:
                            if (status != MigrationStepStatus.ERROR) {
                                step.status = MigrationStepStatus.ERROR;
                                currentErrorStep ??= newTiles[stepIndex].number;
                            }
                            break;
                    }

                    // if there's more output for the subStep, fetch it
                    if ((!step.output?.lastOffset && stage.logItems > 0) ||
                        (step.output?.lastOffset && stage.logItems > step.output.lastOffset)) {
                        void this.migration.fetchLogs(stage.stage, step.output?.lastOffset).then((logs) => {
                            if (step.output) {
                                step.output.lastOffset = logs.lastOffset;
                                step.output.data = step.output.data + "\n" + logs.data;
                            } else {
                                step.output = logs;
                            }
                        });
                    }
                }
            });
            // select the earliest step with activity going on
            let currentStep;

            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (currentErrorStep) {
                currentStep = currentErrorStep;
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            } else if (currentActiveStep) {
                currentStep = currentActiveStep;
            } else {
                currentStep = this.state.currentStep;
            }
            this.setState({
                migrationInProgress: true,
                tiles: newTiles,
                currentStep,
                migrationStatus: workStatus.status,
                summaryInfo: workStatus.summary
            }, () => {
                resolve();
            });
        });
    }

    private changeSubStepStatus(tiles: IStepTile[], stepId: number, subStepId: number,
        status: MigrationStepStatus): Promise<void> {

        return new Promise((resolve) => {
            const { stepIndex, subStepIndex } = this.findStepIndexes(stepId, subStepId);

            const newTiles = [...tiles];

            newTiles[stepIndex].steps[subStepIndex].status = status;

            this.setState({ tiles: newTiles }, () => {
                resolve();
            });
        });
    }

    private async fetchTiles(): Promise<IStepTile[]> {
        // eslint-disable-next-line max-len
        // #TODO: remove after protocol files update https://gerrit.mysql.oraclecorp.com/c/shell-plugins/+/40996/1/gui/frontend/src/communication/ProtocolMigration.ts#129
        const response = (await this.migration.getSteps()) as unknown as IMigrationSteps[];

        this.setState({ maxStep: response.length });

        return response.map((s, index): IStepTile => {
            const number = index + 1;

            return {
                number,
                id: s.id,
                caption: s.caption,
                color: stepsColorMap[number] ?? "",
                steps: s.items.map((i): ISubStep => {
                    return {
                        id: i.id,
                        caption: i.caption,
                        type: i.type,
                        help: i.help,
                        status: MigrationStepStatus.NOT_STARTED,
                    };
                }),
            };
        });
    }

    private async fetchWorkStatus(): Promise<IWorkStatusInfo> {
        const response = (await this.migration.workStatus()) as unknown as IWorkStatusInfo;

        return {
            status: response.status,
            summary: response.summary,
            stages: response.stages.map((s): IWorkStageInfo => {
                return {
                    stage: s.stage,
                    caption: s.caption,
                    enabled: s.enabled,
                    status: s.status,
                    errors: s.errors,
                    current: s.current,
                    total: s.total,
                    eta: s.eta,
                    message: s.message,
                    info: s.info,
                    logItems: s.logItems,
                };
            })
        };
    }

    private findStepIndexes(stepId: number, subStepId: number) {
        const { tiles } = this.state;

        const stepIndex = tiles.findIndex((tile) => {
            return tile.id === stepId;
        });

        const subStepIndex = tiles[stepIndex]?.steps.findIndex((subStep) => {
            return subStep.id === subStepId;
        });

        return { stepIndex, subStepIndex };
    }

    private renderFormControls(stepId: number, subStepId: SubStepId | number) {
        const { hasOciAccess } = this.state;
        const { stepIndex, subStepIndex } = this.findStepIndexes(stepId, subStepId);

        if (stepIndex === -1 || subStepIndex === -1) {
            return null;
        }

        switch (subStepId) {
            // case SubStepId.OCI_PROFILE:
            //     return this.renderOciProfiles();
            // case SubStepId.OCI_SETUP:
            //     return this.renderOciSetup();
            case SubStepId.OCI_PROFILE: {
                return hasOciAccess ? this.renderOciProfiles() : this.renderOciSetup();
            }
            // case SubStepId.SOURCE_SELECTION:
            //     return this.renderSourceSelection(subStepId, formGroups);
            case SubStepId.MIGRATION_TYPE:
                return this.renderMigrationType(subStepId);
            case SubStepId.MIGRATION_CHECKS:
                return this.renderMigrationChecks(subStepId);
            // case SubStepId.TARGET_OPTIONS: {
            //     return this.renderSystemOptions(formGroups, stepId, subStepId);
            // }
            case SubStepId.PREVIEW_PLAN:
                return this.renderMigrationPreview(subStepId);

            case SubStepId.CONGRATS:
                return this.renderMigrationDone();

            case SubStepId.FINAL_SUMMARY:
                return this.renderFinalSummary();

            default:
                return this.renderWorkStep(stepId, subStepId);
        }
    }

    private renderIntro() {
        return (
            <div>
                <p>Lift and shift your existing MySQL instances to
                    the <a href="https://www.oracle.com/heatwave/" target="_blank">MySQL HeatWave service</a>.
                    Take advantage of the <a href="https://www.oracle.com/cloud/free/" target="_blank">Oracle Cloud
                        Free Tier</a> offering and upgrade to powerful shapes for heavy production loads.</p>
                <p><a href="https://www.oracle.com/mysql/migration/" target="_blank">Additional resources for
                    MySQL HeatWave migrations</a></p>
            </div>
        );
    }

    private renderOciSetup() {
        const { hasOciAccess } = this.state;

        if (hasOciAccess) {
            return null;
        }

        return (
            <div>
                <p><b>Access to Oracle Cloud is not configured for this computer.</b></p>

                <p>
                    Before starting, access to Oracle Cloud needs to be prepared.
                    Click <b>OCI Sign In</b> to securely sign in to your OCI account and automatically set up a
                    configuration profile. If you do not have an OCI account yet, sign up for free by
                    clicking <b>Sign Up to OCI</b>.
                </p>

                {this.renderSignUpSignIn()}

            </div >
        );
    }

    private onSignInClick = (_e: MouseEvent | KeyboardEvent) => {
        void this.handleOciLogin();
    };

    private showSignInDialog = (_e: MouseEvent | KeyboardEvent) => {
        this.dialogRef.current?.open();
    };

    private hideSignInDialog = (_e: MouseEvent | KeyboardEvent) => {
        this.dialogRef.current?.close(true);
    };

    private signInAndCloseDialog = (e: MouseEvent | KeyboardEvent) => {
        this.hideSignInDialog(e);
        this.onSignInClick(e);
    };

    private renderSignUpSignIn() {
        const { ociLoginInProgress } = this.state;

        return (
            <div>
                {/* TODO: center the buttons + spinner */}
                <Container orientation={Orientation.LeftToRight}>
                    {this.getSignButtons(ociLoginInProgress, this.onSignInClick)}
                    {ociLoginInProgress && <Spinner />}
                </Container>
                {this.renderSignInInfo()}
            </div>
        );
    }

    private getSignButtons(isSignInDisabled: boolean, onSignInClick?: ClickEventCallback) {
        return [
            <Button
                caption="Sign Up to OCI"
                disabled={isSignInDisabled}
                onClick={() => {
                    void this.migration.signIn(true);
                }}
            />,
            this.getSignInButton(isSignInDisabled, onSignInClick),
        ];
    }

    private getSignInButton(isSignInDisabled: boolean, onSignInClick?: ClickEventCallback) {
        return (
            <Button
                caption="OCI Sign In"
                onClick={onSignInClick}
                disabled={isSignInDisabled}
            />
        );
    }

    private renderOciProfiles() {
        const { hasOciAccess, configProfiles, migrationInProgress } = this.state;

        if (!hasOciAccess) {
            return null;
        }

        const options = configProfiles.map((p) => {
            return p.profile;
        });

        return (
            <div>
                <p className="comment">Specify the properties of the target MySQL instance.
                    Select a configuration template or specify each setting individually in the following sections.</p>

                {this.renderFormGroupDropdown(this.stringToOptions(options),
                    "profile", "OCI Configuration Profile",
                    undefined, migrationInProgress, true,
                    "Choose the OCI configuration profile to use.")}

                <div className="target-selection">

                    {this.renderTargetSelection()}

                </div>
            </div>
        );
    }

    private renderFormGroupDropdown(options: ISelectOption[], name: string, caption: string,
        isFetching?: boolean, disabled?: boolean, optional?: boolean, tooltip?: string,
        onFormGroupSelect?: (accept: boolean, selection: Set<string>, payload: unknown) => Promise<void> | void,
        value?: string) {
        const { formGroupValues } = this.state;
        const selection = value ?? formGroupValues[name];

        const onSelect = onFormGroupSelect ?? this.onFormGroupDropdownChange.bind(this, name);

        // console.log("VALUE OF", name, "IS", formGroupValues[name]);

        return (
            <div className={`form-group ${name}`}>
                {isFetching ? <Spinner size={48} /> : (
                    <>
                        {tooltip ? <Label caption={caption} /> : <Label caption={caption} />}
                        <Dropdown
                            selection={selection}
                            optional={optional}
                            onSelect={onSelect}
                            disabled={disabled}
                            id={name}
                            data-tooltip={tooltip}
                        >
                            {options.map(({ id, label }) => {
                                return (
                                    <DropdownItem
                                        caption={label}
                                        key={id}
                                        id={id}
                                        payload={id}
                                        className="with-min-height"
                                    />
                                );
                            })}
                        </Dropdown>
                        {this.formGroupElementDetailsFor(name)}
                        {this.renderBadUserInputErrorsFor(name)}
                    </>
                )}
            </div>
        );
    }

    private onOciNetworkingChange = (accept: boolean, selection: Set<string>, payload: unknown) => {
        const ociNetworking = payload as OciNetworking;

        let updated: Partial<IMigrationAppState>;
        if (ociNetworking === "create_new") {
            updated = {
                formGroupValues: {
                    "hosting.createVcn": "1"
                }
            };
        } else {
            updated = {
                formGroupValues: {
                    "hosting.createVcn": "0"
                }
            };
        }

        void this.updateState({
            ...updated,
        });
    };

    private renderOciNetworking() {
        const { planStepData } = this.state;

        let options: ISelectOption[];
        if (planStepData.allowCreateNewVcn === "1") {
            options = [
                { id: "create_new", label: "Create New" },
                { id: "use_existing", label: "Use Existing" },
            ];
        } else {
            options = [
                { id: "use_existing", label: "Use Existing" },
            ];
        }

        return (
            <div className="oci-networking">
                <Label caption="OCI Network" />
                <Dropdown
                    selection={this.ociNetworking}
                    onSelect={this.onOciNetworkingChange}
                    id="oci-networking"
                    data-tooltip={`Select "Create New" if you are new to OCI or would like to have a suitable
Virtual Cloud Network automatically created. A VCN will be created in a compartment called "Networks", with a public
subnet for SSH connections and a private subnet for connectivity between applications and the DB System. If you already
have a VCN you would like to use or have specific requirements, please create the VCN beforehand and restart the
Migration Assistant.`}
                >
                    {options.map(({ id, label }) => {
                        return (
                            <DropdownItem
                                caption={label}
                                key={id}
                                id={id}
                                payload={id}
                                className="with-min-height"
                            />
                        );
                    })}
                </Dropdown>
            </div>
        );
    }

    private onFormGroupUpDownChange = (name: string,
        value: ValueType<number | bigint>): void => {
        this.setFormGroupValues({ [name]: `${value}` });
    };

    private renderUpDown(name: string, label: string, tooltip?: string, placeholder?: number, step?: number,
        min?: number, max?: number, disabled?: boolean,
        onFormGroupUpDownChange?: (value: ValueType<number | bigint>) => void, currentValue?: number) {
        const { formGroupValues } = this.state;

        const onChange = onFormGroupUpDownChange ?? this.onFormGroupUpDownChange.bind(this, name);
        const value = currentValue ?? toNumber(formGroupValues[name]);

        return (
            <div className={`form-group ${name}`}>
                <Label caption={label} />
                <UpDown<number | bigint>
                    id={name}
                    disabled={disabled}
                    value={value}
                    placeholder={placeholder}
                    step={step}
                    min={min}
                    max={max}
                    onChange={onChange}
                    data-tooltip={tooltip}
                />
                {this.renderBadUserInputErrorsFor(name)}
            </div>
        );
    }

    private onClusterSizeChange = (heatWaveShapes: ISelectOption[], value: ValueType<number | bigint>): void => {
        const updated: FormGroupValues = {
            "database.heatWaveClusterSize": `${value}`,
            "database.enableHeatWave": value === 0 ? "" : "database.enableHeatWave",
        };
        if (value === 0) {
            updated["database.heatWaveShapeName"] = "0";
        } else if (this.heatWaveClusterSize === 0) {
            updated["database.heatWaveShapeName"] = heatWaveShapes[1]?.id;
        }

        this.setFormGroupValues(updated);
    };

    private renderDiskSize() {
        return this.renderUpDown(
            "database.storageSizeGB",
            "Disk Size (GB)",
            `The size of the data volume for the new DB System, in gigabytes. It must be large
            enough to contain not only your database tables, indexes, and objects, but also the redo log,
            binary logs, and other internal data. The minimum size is 50 GB. The volume will be configured to
            auto-expand.`,
            50,
            5,
            50,
            128 * 1024,
        );
    }

    private onConfigTemplateChange = (_accept: boolean, _selectedIds: Set<string>,
        payload: unknown): void => {
        void this.watchConfigTemplate({ changedValues: {}, prevValues: {} }, payload as ConfigTemplate);
    };

    private onCompartmentChange = async (_accept: boolean, _selection: Set<string>,
        payload: unknown) => {
        try {
            const compartmentId = payload as string | undefined;

            await this.updateState({
                formGroupValues: {
                    "hosting.compartmentId": compartmentId,
                }
            });

            await this.submitSubStep(SubStepId.TARGET_OPTIONS);
        } catch (e) {
            console.error(e);
            const message = convertErrorToString(e);
            ui.showErrorMessage(message, {});
        }
    };

    private onNetworkCompartmentChange = async (_accept: boolean, _selection: Set<string>,
        payload: unknown) => {
        try {
            await this.updateState({
                vcns: [],
                subnets: [],
                formGroupValues: {
                    "hosting.vcnId": "",
                    "hosting.privateSubnet.id": "",
                    "hosting.publicSubnet.id": "",
                    "hosting.networkCompartmentId": payload as string,
                }
            });

            await this.submitSubStep(SubStepId.TARGET_OPTIONS);
        } catch (e) {
            console.error(e);
            const message = convertErrorToString(e);
            ui.showErrorMessage(message, {});
        }
    };

    private renderTargetSelection() {
        if (!this.profile) {
            return null;
        }

        const { migrationInProgress, isFetchingCompartments, isFetchingVcns, isFetchingSubnets,
            isFetchingShapes, formGroupValues } = this.state;

        return (
            <div className="target-options">
                <Container className="compartment-pick" orientation={Orientation.LeftToRight}
                    mainAlignment={ContentAlignment.Start}>

                    {/* TODO show the full compartment path under the dropdown, like in OCI console */}
                    {this.renderFormGroupDropdown(this.compartments, "hosting.compartmentId", "OCI Compartment",
                        isFetchingCompartments, migrationInProgress, undefined,
                        "Choose the compartment within your tenancy where the DB System and other resources required " +
                        "for the migration will be created. Select \"Create New\" if you'd like " +
                        "a new Compartment named \"MySQL\" to be created for that purpose.",
                        this.onCompartmentChange,
                        this.resolveCompartmentId(),
                    )}
                    {this.renderOciNetworking()}

                </Container>

                {this.ociNetworking === "use_existing" ? (
                    <div className="network-options">
                        <Container className="vcn-top-row" orientation={Orientation.LeftToRight}
                            mainAlignment={ContentAlignment.Start}>

                            {this.renderFormGroupDropdown(this.networkCompartments, "hosting.networkCompartmentId",
                                "Network Compartment", undefined, undefined, undefined,
                                "Choose the compartment where the Virtual Cloud Network (VCN) " +
                                "you would like to use is located.",
                                this.onNetworkCompartmentChange,
                            )}
                            {this.renderFormGroupDropdown(this.vcns, "hosting.vcnId",
                                "Virtual Cloud Network", isFetchingVcns, undefined, undefined,
                                // eslint-disable-next-line max-len
                                "Choose the Virtual Cloud Network to which you want to attach the new MySQL DB System.")}

                        </Container>

                        <Container className="vcn-bottom-row" orientation={Orientation.LeftToRight}
                            mainAlignment={ContentAlignment.Start}>

                            {isFetchingSubnets ? <Spinner size={48} /> : (
                                <>
                                    {this.renderFormGroupDropdown(this.privateSubnets, "hosting.privateSubnet.id",
                                        "Private Subnet", undefined, undefined, undefined,
                                        // eslint-disable-next-line max-len
                                        "Choose the subnet of the selected Virtual Cloud Network to which you want to attach the new MySQL DB System. It is strongly recommended that the subnet for the DB System is a private one that does not accept connections from the internet. However, it must be configured to accept connections from your applications and the jump host.")}
                                    {this.renderFormGroupDropdown(this.publicSubnets, "hosting.publicSubnet.id",
                                        "Public Subnet", undefined, undefined, undefined,
                                        // eslint-disable-next-line max-len
                                        "Choose a public subnet of the selected Virtual Cloud Network in which to place the SSH jump host for the DB System. The subnet should be configured to accept SSH connections from your chosen source IP addresses and to allow connections to the private subnet containing the DB System.")}
                                </>
                            )}
                        </Container>
                    </div>
                ) : (
                    <div className="network-options">
                        <Container className="vcn-top-row" orientation={Orientation.LeftToRight}
                            mainAlignment={ContentAlignment.Start}>

                            <div className="new-network-info">
                                <p>
                                    A new Virtual Cloud Network called "{formGroupValues["hosting.vcnName"]}"
                                    will be created in a compartment
                                    called "{formGroupValues["hosting.networkCompartmentName"]}".
                                    It will have a private subnet, where the target DB System will
                                    be placed and a public subnet, where a compute instance will be placed to serve as
                                    a jump host.
                                </p>
                                <p>
                                    If you plan to host your applications in OCI, you may attach your application
                                    compute instances to the private subnet called "MySQLSubnet" in this network.
                                    That will enabled the applications to connect to the newly created MySQL DB System.
                                </p>
                                <p>
                                    If you plan to host your applications outside OCI please configure
                                    a suitable network using Site-to-Site VPN or FastConnect from
                                    the <a href="https://cloud.oracle.com" target="_blank">Oracle
                                        Cloud Console</a> and select it by choosing the "Use Existing" option for
                                    "OCI Network".
                                </p>
                            </div>

                            <Container className="ssh-ingress-source" orientation={Orientation.TopDown}
                                mainAlignment={ContentAlignment.Start}>
                                <Label caption="Source IP Allowed on Jump Host (CIDR)" />
                                <Input
                                    value={formGroupValues["hosting.onPremisePublicCidrBlock"]}
                                    onChange={this.onGroupInputChange}
                                    id="hosting.onPremisePublicCidrBlock"
                                    // eslint-disable-next-line max-len
                                    data-tooltip="SSH connections to the jump host will be limited to the given CIDR block (e.g. 0.0.0.0/0 to allow connections from anywhere). The default is the automatically detected IP address of connections from this host."
                                />
                                <p>
                                    For security, the only outside connections that will be initially allowed in this
                                    VCN are SSH connections to the jump host. You may change the IP block allowed to
                                    connect to the jump host above. The default is the automatically detected source
                                    IP address for connections from the host where this tool is running.
                                    You may change these settings in the VCN page in the OCI Console.
                                </p>
                                {this.renderBadUserInputErrorsFor("hosting.onPremisePublicCidrBlock")}
                            </Container>
                        </Container>
                    </div>
                )}

                <div className="config-template">
                    {this.renderFormGroupDropdown(this.stringToOptions(configTemplates), "hosting.configTemplate",
                        "Configuration Template", undefined, undefined, undefined,
                        "Choose one of the following pre-defined configuration templates for your new DB System.",
                        this.onConfigTemplateChange,
                    )}
                </div>

                {isFetchingShapes ? <Spinner size={48} /> : (
                    <>
                        {this.renderTargetDbSystemShapes(this.shouldValidateShapes())}
                        {this.renderComputeShapes(this.shouldValidateShapes())}
                    </>
                )}

                <Container className="dbsystem-options" orientation={Orientation.LeftToRight}
                    mainAlignment={ContentAlignment.SpaceBetween}>

                    {this.renderDiskSize()}
                    {this.renderHighAvailability()}
                    {this.renderHeatwaveCluster(this.shouldValidateShapes())}

                </Container>

                <Container className="admin-credentials" orientation={Orientation.TopDown}
                    mainAlignment={ContentAlignment.Start}>

                    <Container orientation={Orientation.LeftToRight} mainAlignment={ContentAlignment.Start}
                        className="admin-info">
                        <Container className="dbsystem-name" orientation={Orientation.TopDown}
                            mainAlignment={ContentAlignment.Start}>
                            <Label caption="Display Name" />
                            <Input
                                value={formGroupValues["database.name"]}
                                onChange={this.onGroupInputChange}
                                id="database.name"
                                data-tooltip="Display name for the DB System to be provisioned,
                                to be shown in the OCI console."
                            />
                            {this.renderBadUserInputErrorsFor("database.name")}
                        </Container>

                        <Container className="dbsystem-emails" orientation={Orientation.TopDown}
                            mainAlignment={ContentAlignment.Start}>
                            <Label caption="Contact Emails (optional)" />
                            <Input
                                value={formGroupValues["database.contactEmails"]}
                                onChange={this.onGroupInputChange}
                                id="database.contactEmails"
                                data-tooltip="For receiving admin emails pertaining to the DB System.
                                Separate multiple addresses with a comma (,)"
                            />
                            {this.renderBadUserInputErrorsFor("database.contactEmails")}
                        </Container>
                    </Container>

                    <Container orientation={Orientation.LeftToRight}
                        mainAlignment={ContentAlignment.Start}>
                        <Container className="admin-credential-item-first" orientation={Orientation.TopDown}
                            mainAlignment={ContentAlignment.Start}>
                            <Label caption="MySQL Admin Username" />
                            <Input
                                value={formGroupValues["database.adminUsername"]}
                                onChange={this.onGroupInputChange}
                                id="database.adminUsername"
                                data-tooltip="MySQL username for the administrator account to be created
                                     at the target DB System"
                            />
                            {this.renderBadUserInputErrorsFor("database.adminUsername")}
                        </Container>

                        <Container className="admin-credential-item" orientation={Orientation.TopDown}
                            mainAlignment={ContentAlignment.Start}>
                            <Label caption="Password" />
                            <Input
                                password
                                value={formGroupValues["database.adminPassword"]}
                                onChange={this.onGroupInputChange}
                                id="database.adminPassword"
                                data-tooltip="Password for your MySQL admin account at the target DB System.
                                Passwords must be 8 to 32 characters long and contain at least one each of:
                                uppercase, lowercase, digit and punctuation characters. The same username and password
                                as the one for your source MySQL is used by default, if it is suitable."
                            />
                            {this.renderBadUserInputErrorsFor("database.adminPassword")}
                        </Container>
                        {
                            <Container className="admin-credential-item" orientation={Orientation.TopDown}
                                mainAlignment={ContentAlignment.Start}>
                                <Label caption="Confirm Password" />
                                <Input
                                    password
                                    value={formGroupValues["database.adminPasswordConfirm"]}
                                    onChange={this.onGroupInputChange}
                                    id="database.adminPasswordConfirm"
                                    data-tooltip="Type the admin password again"
                                />
                                {this.renderBadUserInputErrorsFor("database.adminPasswordConfirm")}
                            </Container>}
                    </Container>
                </Container>
            </div>
        );
    }

    private onGroupInputChange = (_e: InputEvent, props: IInputChangeProperties) => {
        const { value } = props;

        this.setFormGroupValues({ [props.id!]: value });
    };
    private onMigrationTypeChange(migrationType: MigrationType, name: string, checkState: CheckState,

        _props: IRadiobuttonProperties) {

        this.setFormGroupValues({ "type": migrationType });
    }

    private onDbSystemShapeChange = async (_accept: boolean, _selectedIds: Set<string>,
        payload: unknown) => {
        try {
            this.clearConfigTemplateError();
            await this.updateState({
                formGroupValues: {
                    "hosting.configTemplate": customTemplateId,

                    "database.shapeName": payload as string,
                },
            });
            await this.submitSubStep(SubStepId.TARGET_OPTIONS);
        } catch (e) {
            console.error(e);
            const message = convertErrorToString(e);
            ui.showErrorMessage(message, {});
        }
    };

    private renderTargetDbSystemShapes(validate?: boolean) {
        const existingShapes = this.getExistingShapes();

        const { options, shapeExists } = this.sh.getDbSystemOptions(this.dbSystemShape, existingShapes, validate);

        if (!this.shapesFetched || (shapeExists && this.configTemplate !== customTemplateId)
            || (!shapeExists && this.configTemplate.includes(" Free "))) {
            return null;
        }

        return this.renderFormGroupDropdown(options, "database.shapeName",
            "Shape for MySQL DB System", undefined, undefined, undefined, undefined,
            this.onDbSystemShapeChange,
            this.dbSystemShape,
        );
    }

    private onComputeShapesChange = async (_accept: boolean, _selectedIds: Set<string>,
        payload: unknown) => {
        const [shapeName, cpuCount, memorySizeGB] = (payload as string).split("|");

        try {
            this.clearConfigTemplateError();
            await this.updateState({
                formGroupValues: {
                    "hosting.configTemplate": customTemplateId,

                    "hosting.shapeName": shapeName,
                    "hosting.cpuCount": cpuCount,
                    "hosting.memorySizeGB": memorySizeGB,
                },
            });
            await this.submitSubStep(SubStepId.TARGET_OPTIONS);
        } catch (e) {
            console.error(e);
            const message = convertErrorToString(e);
            ui.showErrorMessage(message, {});
        }
    };

    private generateComputeShapeInfo(): ComputeShapeInfo {
        const { formGroupValues } = this.state;

        const shapeName = formGroupValues["hosting.shapeName"];
        const cpuCount = formGroupValues["hosting.cpuCount"];
        const memorySizeGB = formGroupValues["hosting.memorySizeGB"];

        return {
            shape: shapeName,
            ocpus: toFloat(cpuCount),
            memoryInGBs: toNumber(memorySizeGB),
        };
    }

    private renderComputeShapes(validate?: boolean) {
        const existingShapes = this.getExistingShapes();

        const computeShapeInfo: ComputeShapeInfo = this.generateComputeShapeInfo();

        const { options, shapeExists } = this.sh.getComputeShapesOptions(computeShapeInfo, existingShapes, validate);

        if (!this.shapesFetched || (shapeExists && this.configTemplate !== customTemplateId)
            || (!shapeExists && this.configTemplate.includes(" Free "))) {
            return null;
        }

        const selection = this.sh.getComputeShapesId(computeShapeInfo);

        return (
            <div className="form-group hosting.shapeName">
                <Label caption="Shape for Jump Host Compute" />
                <Dropdown
                    selection={selection}
                    onSelect={this.onComputeShapesChange}
                // disabled={shapeExists}
                // optional={!shapeExists}
                >
                    {options.map(({ id, label }) => {
                        return (
                            <DropdownItem
                                caption={label}
                                key={id}
                                id={id}
                                payload={id}
                                className="with-min-height"
                            />
                        );
                    })}
                </Dropdown>
                {this.renderBadUserInputErrorsFor("hosting.shapeName")}
            </div>
        );
    }

    private renderBooleanDropdown(name: string, options: ISelectOption[], label: string, tooltip?: string,
        onBooleanDropdownChange?: (accept: boolean, selection: Set<string>, payload: unknown) => Promise<void> | void) {
        const { formGroupValues } = this.state;

        const onSelect = onBooleanDropdownChange ?? this.onFormGroupDropdownChange.bind(this, name);

        const selection = toBoolean(formGroupValues[name]) ? "1" : "0";

        return (
            <div className={`form-group ${name}`}>
                <Label caption={label} />
                <Dropdown
                    selection={selection}
                    onSelect={onSelect}
                    data-tooltip={tooltip}
                >
                    {options.map(({ id, label }) => {
                        return (
                            <DropdownItem
                                caption={label}
                                key={id}
                                id={id}
                                payload={id}
                                className="with-min-height"
                            />
                        );
                    })}
                </Dropdown>
                {this.renderBadUserInputErrorsFor(name)}
            </div>
        );
    }

    private renderHighAvailability() {
        const options = [
            { id: "1", label: "High Availability" },
            { id: "0", label: "Standalone" },
        ];

        return this.renderBooleanDropdown(
            "database.enableHA",
            options,
            "Setup Type",
            `Standalone creates a single MySQL DB System instance
 High Availability creates three instances for automated failover and greater uptime.`,
        );
    }

    private getExistingShapes() {
        const { state, profile } = this;
        const { shapes } = state;
        const compartmentId = this.resolveCompartmentIdForShapes();
        if (!profile || !compartmentId) {
            return undefined;
        }

        return shapes[this.getShapesKey(profile, compartmentId)];
    }

    private onHeatwaveShapeChange = (_accept: boolean, _selectedIds: Set<string>,
        payload: unknown): void => {
        const selection = payload as string;

        const updated: FormGroupValues = {
            "database.heatWaveShapeName": selection,
            "database.enableHeatWave": selection !== "0" ? "database.enableHeatWave" : "",
            "database.heatWaveClusterSize": selection === "0" ? "0" : "1",
        };

        this.setFormGroupValues(updated);
    };

    private renderHeatwaveCluster(validate?: boolean) {
        const { isFetchingShapes } = this.state;

        const existingShapes = this.getExistingShapes();

        const { options } = this.sh.getHeatwaveShapesOptions(this.heatWaveShapeName,
            existingShapes, validate);

        const isClusterSizeDisabled = options.length === 1 && options[0].id === "0";
        const { min, max } = getClusterSizeBoundaries(this.heatWaveShapeName);

        return (
            <>
                {this.renderFormGroupDropdown(
                    options,
                    "database.heatWaveShapeName",
                    "HeatWave Shape",
                    isFetchingShapes,
                    undefined, // shapeExists
                    undefined, // !shapeExists
                    `The size of the MySQL HeatWave cluster to provision and attach to your DB System
 and the shape to be used for its nodes.`,
                    this.onHeatwaveShapeChange,
                    this.heatWaveShapeName,
                )}

                {this.renderUpDown(
                    "database.heatWaveClusterSize",
                    "HeatWave Nodes",
                    ``,
                    1,
                    1,
                    min,
                    max,
                    isClusterSizeDisabled,
                    this.onClusterSizeChange.bind(this, options),
                    this.heatWaveClusterSize,
                )}
            </>
        );
    }

    private resolveMigrationAllowance(): IMigrationTypeData {
        const { backendState } = this.state;

        const subStepId = SubStepId.MIGRATION_TYPE;
        let allowedTypes: IMigrationTypeData["allowedTypes"] = [MigrationType.COLD, MigrationType.HOT];
        let allowedConnectivity: IMigrationTypeData["allowedConnectivity"] = [
            CloudConnectivity.NOT_SET,
            CloudConnectivity.SITE_TO_SITE,
            CloudConnectivity.SSH_TUNNEL,
            CloudConnectivity.LOCAL_SSH_TUNNEL,
        ];

        if (subStepId in backendState
            && backendState[subStepId]?.data
            && "allowedConnectivity" in backendState[subStepId].data
            && "allowedTypes" in backendState[subStepId].data
        ) {
            ({ allowedTypes, allowedConnectivity } = backendState[subStepId].data);
        }

        return { allowedTypes, allowedConnectivity };
    }

    private renderMigrationType(_subStepId: SubStepId) {
        const { formGroupValues } = this.state;
        const { allowedTypes } = this.resolveMigrationAllowance();

        const migrationType = formGroupValues.type;

        return (
            <div>
                <p className="comment">
                    Select the type of migration to perform, considering whether and how will applications be
                    switched to the newly migrated MySQL HeatWave DB System.
                </p>
                <Container className="migration-type-radios" orientation={Orientation.LeftToRight}
                    mainAlignment={ContentAlignment.Start}>
                    {allowedTypes.includes(MigrationType.COLD) && (
                        <div>
                            <Radiobutton
                                name="migration-type"
                                caption={"Cold Migration"}
                                checkState={migrationType === MigrationType.COLD
                                    ? CheckState.Checked : CheckState.Unchecked}
                                onChange={this.onMigrationTypeChange.bind(this, MigrationType.COLD, "type")}
                            // disabled={radio.disabled}
                            />
                            <div className="comment">
                                {"A snapshot of the source database will be created and loaded into the target " +
                                    "DB System. Database updates by applications done during the migration will " +
                                    "be missing from the target database. You must stop applications from writing " +
                                    "during the entire migration process if you don't want to miss any updates."}
                            </div>
                        </div>
                    )}

                    {allowedTypes.includes(MigrationType.HOT) && (
                        <div>
                            <Radiobutton
                                name="migration-type"
                                caption={"Hot Migration"}
                                checkState={migrationType === MigrationType.HOT ?
                                    CheckState.Checked : CheckState.Unchecked}
                                onChange={this.onMigrationTypeChange.bind(this, MigrationType.HOT, "type")}
                            // disabled={radio.disabled}
                            />
                            <div className="comment">
                                {"At the end of the snapshot copy, an inbound replication channel will be created " +
                                    "at the target database. The replication channel will continuously " +
                                    "apply any updates received by the source database to the target. " +
                                    "Required application downtime will be much shorter, but the target database " +
                                    "will need to be able to connect from your Virtual Cloud Network in OCI " +
                                    "to port 3306 of the source database host."}
                            </div>
                            <div className="comment">
                                <Icon src={Codicon.Warning} style={{ color: "#dcb342ff" }} /> Your
                                MySQL credentials will be stored in the MySQL HeatWave service to allow
                                the inbound replication channel to connect to your source database.
                            </div>
                        </div>
                    )}

                </Container>
                {this.renderBadUserInputErrorsFor("type")}
                {this.renderConnectivityOptions()}
            </div>
        );
    }

    private renderMigrationChecks(subStepId: SubStepId) {
        return (
            <div>
                <p className="heading">
                    Compatibility issues were detected in the schema of the source database.
                </p>

                <p className="heading">
                    Please review the issues detected below, and select the action to be applied
                    automatically to resolve them:
                </p>
                {this.renderIssues(subStepId)}
                {/** this.renderCommonForm(subStepId, formGroups) */}
            </div>
        );
    }

    private renderMigrationTypeListItem(migrationType: MigrationType, cloudConnectivity: CloudConnectivity) {
        if (migrationType !== MigrationType.HOT) {
            return null;
        }

        switch (cloudConnectivity) {
            case CloudConnectivity.SSH_TUNNEL:
                return <li>Create SSH tunnel (manual)</li>;
            case CloudConnectivity.LOCAL_SSH_TUNNEL:
                return <li>Create SSH tunnel (automatic)</li>;
            default:
                return null;
        }
    }

    private renderMigrationPreview(subStepId: SubStepId) {
        const { backendState, planStepData } = this.state;
        if (!backendState[subStepId]?.data) {
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        const options = backendState[subStepId]?.data as IPreviewPlanData;

        const { region, targetMySQLOptions, targetHostingOptions, migrationType, cloudConnectivity } = options.options;
        if (!targetMySQLOptions || !targetHostingOptions) {
            return;
        }

        return (
            <div className="explanation migration-plan">
                <div className="ready-notice">
                    Your MySQL database migration
                    to a new Oracle Cloud MySQL HeatWave instance is ready to be
                    executed.
                    Click <em>Start Migration Process</em> to start.
                </div>
                <div>
                    <h3>Migration Plan</h3>

                    The following steps will be executed when you start.
                    Exact execution order may differ as some steps are executed in parallel.

                    <ol>
                        <li>Provision Object Storage bucket</li>
                        <li>Provision a jump host</li>
                        <li>Provision DB System</li>
                        <li>Export Data</li>
                        <li>Import Data (from jump host)</li>
                        {targetMySQLOptions.enableHA ? (<li>Enable High-Availability</li>) : null}
                        {this.renderMigrationTypeListItem(migrationType, cloudConnectivity)}
                        {migrationType === MigrationType.HOT ? <li>Create Inbound Replication Channel</li> : null}
                        {targetMySQLOptions.enableHeatWave ? (<li>Add HeatWave Cluster</li>) : null}
                        {migrationType === MigrationType.HOT ? <li>Wait for DB System to catch up to source</li> : null}
                    </ol>

                    The following Oracle Cloud resources will be created in region <b>{region}</b> and
                    compartment <b>{planStepData.compartmentPath}</b>:

                    <h4>DB System</h4>
                    <table className="migration-preview-table">
                        <tbody>
                            <tr><td>Name</td><td>{targetMySQLOptions.name}</td></tr>
                            <tr>
                                <td>Shape</td><td>{targetMySQLOptions.shapeName}</td>
                                {/* TODO describe shape */}
                            </tr>
                            <tr>
                                <td>Initial Storage Size</td><td>{targetMySQLOptions.storageSizeGB} GB</td>
                                {/* TODO describe block volumes, count, maximum etc */}
                            </tr>
                            <tr>
                                <td>Auto-Expand Storage</td>
                                <td>{targetMySQLOptions.autoExpandStorage ? "Enabled" : "Disabled"}</td>
                            </tr>
                            <tr>
                                <td>MySQL Version</td><td>{targetMySQLOptions.mysqlVersion}</td>
                            </tr>
                            <tr>
                                {
                                    targetMySQLOptions.mysqlVersion.startsWith("8.0") ?
                                        <td>HeatWave</td> :
                                        <td>HeatWave (with LakeHouse)</td>
                                }
                                <td>{targetMySQLOptions.enableHeatWave ? "Enabled" : "Disabled"}</td>
                            </tr>
                            {targetMySQLOptions.enableHeatWave ?
                                (<tr>
                                    <td></td>
                                    <td>Shape: {targetMySQLOptions.heatWaveShapeName},
                                        Nodes: {targetMySQLOptions.heatWaveClusterSize}</td>
                                </tr>) : null}
                            <tr>
                                <td>High Availability</td>
                                <td>{targetMySQLOptions.enableHA ? "Enabled" : "Disabled"}</td>
                            </tr>
                            {/* <tr>
                                <td>Network</td>
                                <td>
                                    {targetHostingOptions.vcnId} in compartment
                                    {targetHostingOptions.networkCompartmentId}
                                </td>
                            </tr>
                            <tr>
                                <td>Subnet</td>
                                <td>{targetHostingOptions.privateSubnet.id}</td>
                            </tr> */}
                        </tbody>
                    </table>
                    {/*
                    {
                        !targetHostingOptions.networkCompartmentId
                            ? (
                                <>
                                    <h4>Network</h4>
                                    <table className="migration-preview-table">
                                    </table>
                                </>)
                            : null
                    } */}

                    <h4>Compute Instance (jump host)<sup>*</sup></h4>

                    <table className="migration-preview-table">
                        <tbody>
                            <tr>
                                <td>Name</td>
                                <td>
                                    {targetHostingOptions.computeName}
                                    {targetHostingOptions.computeId ? (
                                        " (reusing existing compute)"
                                    ) : (
                                        options.computeResolutionNotice === "" ? null :
                                            <>
                                                &nbsp;
                                                <Icon
                                                    src={Codicon.Info}
                                                    style={{ color: "#4287dcff" }}
                                                    data-tooltip={options.computeResolutionNotice}
                                                />
                                            </>
                                    )}
                                </td>
                            </tr>
                            <tr>
                                <td>Shape</td>
                                <td>{targetHostingOptions.shapeName}</td>
                            </tr>
                            <tr>
                                <td>CPUs</td>
                                <td>{targetHostingOptions.cpuCount}</td>
                            </tr>
                            <tr>
                                <td>Memory</td>
                                <td>{targetHostingOptions.memorySizeGB} GB</td>
                            </tr>
                        </tbody>
                    </table>

                    <h4>Object Storage<sup>*</sup></h4>

                    <table className="migration-preview-table">
                        <tbody>
                            <tr>
                                <td>Bucket</td>
                                <td>{targetHostingOptions.bucketName}</td>
                            </tr>
                        </tbody>
                    </table>
                    <p>* Temporary resources necessary for the migration. May be deleted afterwards.</p>
                </div>
            </div>
        );
    }

    private renderMigrationDone() {
        const { summaryInfo, deleteBucket, deleteJumpHost } = this.state;

        if (!summaryInfo.dbSystemId) {
            return;
        }

        const sshCmd =
            `ssh -i"${summaryInfo.jumpHostKeyPath}" -oIdentityAgent=none opc@${summaryInfo.jumpHostPublicIP}`;
        const mysqlshCmd = `mysqlsh -p ${summaryInfo.adminUser}@${summaryInfo.dbSystemIP}`;
        const consoleUrl =
            `https://cloud.oracle.com/mysqlaas/db-systems/${summaryInfo.dbSystemId}?region=${summaryInfo.region}`;
        const jumpHostConsoleUrl =
            `https://cloud.oracle.com/compute/instances/${summaryInfo.jumpHostId}?region=${summaryInfo.region}`;
        const bucketConsoleUrl =
            // eslint-disable-next-line max-len
            `https://cloud.oracle.com/object-storage/buckets/${summaryInfo.bucketNamespace}/${summaryInfo.bucketName}?region=${summaryInfo.region}`;
        /*const channelConsoleUrl =
            `https://cloud.oracle.com/mysqlaas/channels/${summaryInfo.channelId}?region=${summaryInfo.region}`;*/

        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        const showDeleteResources = summaryInfo.createdJumpHost || summaryInfo.createdBucket;

        return (
            <div className="explanation">
                <h3>Congratulations! 🎉</h3>

                <p>Your MySQL database at {this.connectionString} has been migrated
                    to a new MySQL HeatWave DB System in OCI.</p>

                <p>You may now connect your new DB System to try it out, perform tests and switch over applications.</p>

                <p>The new MySQL DB System named <b>"{summaryInfo.dbSystemName}"</b> in
                    compartment {summaryInfo.fullCompartmentName}
                    is located at:</p>

                <Container className="finalize-info" orientation={Orientation.LeftToRight}>
                    <code style={{ width: "100%" }}>{summaryInfo.dbSystemIP}</code>
                    <Button
                        className="finalize-copy-button"
                        data-tooltip="Copy to clipboard"
                        imageOnly
                        focusOnClick={false}
                        tabIndex={-1}
                        onPointerDown={() => {
                            requisitions.writeToClipboard(summaryInfo.dbSystemIP ?? "");
                        }}
                    >
                        <Icon src={Codicon.Copy} data-tooltip="inherit" />
                    </Button>
                </Container>

                <p>
                    Manage DB System in the <a href={consoleUrl} target="_blank">OCI
                        Console <Icon src={Codicon.LinkExternal} className="link-icon" />
                    </a>
                </p>

                <p>If you do not have Site-to-Site VPN, you can use the SSH jump host that was
                    provisioned during migration:</p>

                <Container className="finalize-info" orientation={Orientation.LeftToRight}>
                    <code style={{ width: "100%" }}>{sshCmd}</code>
                    <Button
                        className="finalize-copy-button"
                        data-tooltip="Copy to clipboard"
                        imageOnly
                        focusOnClick={false}
                        tabIndex={-1}
                        onPointerDown={() => {
                            requisitions.writeToClipboard(sshCmd);
                        }}
                    >
                        <Icon src={Codicon.Copy} data-tooltip="inherit" />
                    </Button>
                </Container>
                <p>And use MySQL Shell from there (password is what you provided earlier
                    and defaults to the same as for your source database):</p>
                <Container className="finalize-info" orientation={Orientation.LeftToRight}>
                    <code style={{ width: "100%" }}>{mysqlshCmd}</code>
                    <Button
                        className="finalize-copy-button"
                        data-tooltip="Copy to clipboard"
                        imageOnly
                        focusOnClick={false}
                        tabIndex={-1}
                        onPointerDown={() => {
                            requisitions.writeToClipboard(mysqlshCmd);
                        }}
                    >
                        <Icon src={Codicon.Copy} data-tooltip="inherit" />
                    </Button>
                </Container>
                <p>Tip: you can copy the private key for the jump host to your regular SSH configuration
                    directory to keep it for the future.</p>

                {
                    summaryInfo.migrationType === MigrationType.HOT ? (
                        <div>
                            <p>
                                A replication channel is now active between your source database and the new DB System.
                                The replication state and progress can be monitored from
                                the <em>"Monitor Replication Progress"</em> section below.
                            </p>
                            <p>
                                To switch applications over to the new DB System without data loss, perform the
                                following steps at a time of your convenience (i.e. when database update activity is
                                low):
                            </p>
                            <ol>
                                <li>Wait until the replication backlog is low enough</li>
                                <li>Enable <code>super_read_only</code> mode at the source MySQL instance to stop writes
                                    there</li>
                                <li>Switch your applications to the new DB System</li>
                                <li>Stop the replication channel and decommission the source database</li>
                            </ol>
                        </div>
                    ) : null
                }
                {
                    <p><b>You may now close this Migration Assistant by closing this window.</b></p>
                }
                {
                    (summaryInfo.migrationType === MigrationType.HOT
                        && summaryInfo.cloudConnectivity == "local-ssh-tunnel") && (
                        <p>
                            ⚠️ Please note that the SSH tunnel is maintained by this Migration Assistant.
                            Closing this application will close the SSH tunnel, interrupting the inbound replication
                            channel. If you would like to keep the tunnel open for longer, you can manually
                            start a SSH tunnel to the jump host using any regular SSH client and close this application.
                        </p>
                    )
                }

                {showDeleteResources && (<>
                    <hr className="short-line" />
                    <p>Select below whether you want to keep or delete any of the temporary resources created
                        during the migration. You may also delete any of these resources from the OCI console.</p>

                    {summaryInfo.jumpHostId &&
                        <Container orientation={Orientation.LeftToRight}>
                            <Checkbox checkState={deleteJumpHost ? CheckState.Checked : CheckState.Unchecked}
                                onChange={(checkState: CheckState) => {
                                    this.setState({ deleteJumpHost: checkState === CheckState.Checked });
                                }} />
                            <p>Delete <a href={jumpHostConsoleUrl} target="_blank">jump
                                host <Icon src={Codicon.LinkExternal} className="link-icon" /></a></p>
                        </Container>}
                    {summaryInfo.bucketName &&
                        <Container orientation={Orientation.LeftToRight}>
                            <Checkbox checkState={deleteBucket ? CheckState.Checked : CheckState.Unchecked}
                                onChange={(checkState: CheckState) => {
                                    this.setState({ deleteBucket: checkState === CheckState.Checked });
                                }} />
                            <p>Delete <a href={bucketConsoleUrl} target="_blank">
                                bucket with exported data <Icon src={Codicon.LinkExternal} className="link-icon" /></a>
                            </p>
                        </Container>}

                    <Container orientation={Orientation.LeftToRight}>
                        <Button
                            caption="Delete Selected OCI Resources"
                            onClick={() => {
                                void this.deleteTemporaryResources();
                            }}
                            className="finish-migration"
                        />
                    </Container>
                </>)}
            </div >
        );
    }

    private async deleteTemporaryResources() {
        const { deleteBucket, deleteJumpHost } = this.state;

        try {
            this.setState({ backendRequestInProgress: true });

            await this.migration.workClean({ deleteBucket, deleteJumpHost });
        } finally {
            this.setState({ backendRequestInProgress: false });
        }
    }

    private renderFinalSummary() {
        return null;
    }

    private renderMonitorChannel(subStep: ISubStep) {
        const { help, workStage } = subStep;
        if (!workStage) {
            return;
        }

        const channelStatus: IDictionary = workStage.info;

        return (
            <>
                <p dangerouslySetInnerHTML={{ __html: help }} className="comment"></p>

                <div className="progress-wrapper static">
                    <ProgressIndicator
                        backgroundOpacity={0.95}
                        indicatorWidth={40}
                        indicatorHeight={7}
                        linear={true}
                    ></ProgressIndicator>
                    {workStage.message}

                    <p>
                        Replication Backlog: {
                            channelStatus.gtidBacklogSize as number > 0
                                ? `${channelStatus.gtidBacklogSize} transactions behind`
                                : "caught up"
                        }
                    </p>
                    <p>
                        Channel Status: {channelStatus.status}
                    </p>
                    <p>
                        {channelStatus.details as string}
                    </p>
                </div>
            </>
        );
    }

    private renderSshTunnel(subStep: ISubStep) {
        const { help, workStage } = subStep;
        if (!workStage) {
            return;
        }

        const renderInstructions = (command: string) => {
            return (
                <div>
                    Please start a SSH tunnel by executing the following command on a host that can connect
                    to both the source MySQL server and the jump host:

                    <Container className="finalize-info" orientation={Orientation.LeftToRight}>
                        <code style={{ width: "100%" }}>{command}</code>
                        <Button
                            className="finalize-copy-button"
                            data-tooltip="Copy to clipboard"
                            imageOnly
                            focusOnClick={false}
                            tabIndex={-1}
                            onPointerDown={() => {
                                requisitions.writeToClipboard(command);
                            }}
                        >
                            <Icon src={Codicon.Copy} data-tooltip="inherit" />
                        </Button>
                    </Container>

                    You may have to copy the SSH key if you open the tunnel from a host other than where you are running
                    this tool.

                    The migration process will continue once it can connect to the source MySQL server
                    through the tunnel.
                </div>
            );
        };

        const { command } = workStage.info;

        return (
            <>
                <p dangerouslySetInnerHTML={{ __html: help }} className="comment"></p>

                {command ? renderInstructions(command as string) : null}

                Waiting for SSH tunnel...
                <div className="progress-wrapper static">
                    <ProgressIndicator
                        backgroundOpacity={0.95}
                        indicatorWidth={40}
                        indicatorHeight={7}
                        linear={true}
                    ></ProgressIndicator>
                    {workStage.message}
                </div>
            </>
        );
    }

    private renderWorkStep(stepId: number, subStepId: number) {
        const { stepIndex, subStepIndex } = this.findStepIndexes(stepId, subStepId);
        const subStep = this.state.tiles[stepIndex].steps[subStepIndex];

        const { help, type, workStage, output } = subStep;

        if (type === "progress" || type === "progress-precise") {
            return (<WorkProgressView
                help={help}
                type={type}
                workStage={workStage}
                output={(subStepId === SubStepId.DUMP || subStepId === SubStepId.LOAD)
                    ? (output?.data ?? "") : undefined}
                active={this.state.migrationInProgress} />
            );
        } else {
            if (workStage?.status !== WorkStatus.IN_PROGRESS) {
                return (
                    <div>
                        <p dangerouslySetInnerHTML={{ __html: help }} className="comment"></p>
                        <p>{workStage?.message}</p>
                    </div>
                );
            } else {
                if (type === "monitor_channel") {
                    return this.renderMonitorChannel(subStep);
                } else if (type == "ssh-tunnel") {
                    return this.renderSshTunnel(subStep);
                } else {
                    return (
                        <>
                            <p dangerouslySetInnerHTML={{ __html: help }} className="comment"></p>
                            <div className="progress-wrapper static">
                                <ProgressIndicator
                                    backgroundOpacity={0.95}
                                    indicatorWidth={40}
                                    indicatorHeight={7}
                                    linear={true}
                                ></ProgressIndicator>
                                {workStage.message}
                            </div>
                        </>
                    );
                }
            }
        }
    }

    private handleOciLogin = async () => {
        try {
            this.setState({ ociLoginInProgress: true, ociSignInInfo: undefined });

            // NOTE: When setting up a new profile, after the user successfully logged in
            // it is taking up to 4 mins to get the profile propagated to the BE server
            // where the compartments are going to be queried. But for that, the user
            // should already had to:
            // - Wait for the login web page to open
            // - Enter credentials
            // - Confirm 2nd factor auth
            // For that reason we are configuring a 10 minute timeout
            await waitForPromise(this.ociSignInTimedOut, "ociSignIn", 1, 600000);
            const promise = () => {
                return this.processSubStep(SubStepId.OCI_PROFILE);
            };
            await waitForPromise(promise, "commitOci", 60, 10000);
            await this.ensureOciAccess(true);
            await this.refreshFromBackend(); // For some reason sometimes this takes long.

        } catch (e) {
            console.error(e);
            const message = convertErrorToString(e);
            ui.showErrorMessage(`Failed to setup OCI, please try again: ${message}`, {});
        } finally {
            this.setState({ ociLoginInProgress: false });
        }
    };

    private ociSignInTimedOut = (): Promise<void> => {
        return this.migration.signIn(false, (r) => {
            const response = r as { result: { info: string; }; };
            this.setState(() => {
                return {
                    ociSignInInfo: JSON.parse(response.result.info.trim()) as ISignInInfo,
                };
            });

            if (response.result.info.includes("Completed")) {
                ui.showInformationMessage(response.result.info, {});
            }

            return Promise.resolve(true);
        });
    };

    private onFormGroupDropdownChange = (name: string, _accept: boolean, _selectedIds: Set<string>,
        payload: unknown): void => {

        this.setFormGroupValues({ [name]: payload as string | undefined });
    };

    private clearConfigTemplateError() {
        this.setState(({ targetOptionErrors }) => {
            return {
                targetOptionErrors: targetOptionErrors.filter((e) => {
                    return e.option !== "hosting.configTemplate";
                }),
            };
        });
    }

    private displayNotFoundShapes(notFoundShapesFor?: NotFoundShapesFor[]) {
        if (notFoundShapesFor?.length) {
            console.log({ notFoundShapesFor });
            const noFree = notFoundShapesFor.find((i) => {
                return i.type === "dbSystem" && i.text.includes("MySQL.Free");
            });
            const list = notFoundShapesFor.map((i) => {
                return i.text;
            });

            let message;
            if (noFree) {
                message = "This tenancy does not seem eligible for an Always Free MySQL DB System " +
                    "(note: there is a limit of one per tenancy).";

                this.clearConfigTemplateError();
            } else {
                message = `Shapes defined in the selected template are not available: ${list.join(", ")}. ` +
                    "Please pick from the list below.";

                ui.showErrorMessage(message, {});
            }
            const error: BadUserInput = {
                level: MessageLevel.ERROR,
                title: "",
                message,
                option: "hosting.configTemplate",
            };

            this.setState(({ targetOptionErrors }) => {
                return {
                    targetOptionErrors: [...targetOptionErrors, error],
                };
            });

        } else {
            this.clearConfigTemplateError();
        }
    }

    private watchConfigTemplate = async (_changes?: WatcherChanges, configTemplate?: string) => {
        const updated: FormGroupValues = {};
        if (configTemplate !== this.configTemplate) {
            updated["hosting.configTemplate"] = configTemplate;
        }

        if (configTemplate === customTemplateId) {
            // If a production template was previously selected,
            // and since backup and storage auto-expansion toggles are hidden,
            // we need to reset those corresponding values.
            updated["database.enableBackup"] = "";
            updated["database.autoExpandStorage"] = "";
        }

        if (!configTemplate || configTemplate === customTemplateId || !(configTemplate in this.sh.shapesByTemplate)
            || !this.shapesFetched) {
            if (Object.keys(updated).length) {
                return this.updateState({
                    formGroupValues: updated,
                });
            }

            return Promise.resolve();
        }

        const existingShapes = this.getExistingShapes();
        const shapeInfo = this.sh.getShapeInfoForTemplate(configTemplate, existingShapes, this.shouldValidateShapes());
        const { formGroupValues, notFoundShapesFor } = shapeInfo;

        this.displayNotFoundShapes(notFoundShapesFor);

        const merged: FormGroupValues = { ...updated, ...formGroupValues };

        if (!Object.keys(merged).length) {
            return;
        }

        await this.updateState({
            formGroupValues: merged,
        });
    };

    private async fetchCompartments(profile: string) {
        this.setState({ isFetchingCompartments: true });

        let compartments: ICompartment[] = [];
        try {
            console.log("getMdsCompartments");
            compartments = await this.mhs.getMdsCompartments(profile);
        } catch (e) {
            console.error(e);
            const message = convertErrorToString(e);
            ui.showErrorMessage(`Failed to fetch compartments: ${message}`, {});
        } finally {
            console.log("compartments", compartments);
            this.setState({ isFetchingCompartments: false });
        }

        return compartments;
    }

    private async fetchVcns(profile: string, compartmentId: string) {
        this.setState({ isFetchingVcns: true });

        let vcns: OciResource[] = [];
        try {
            console.log("getMdsNetworks");
            vcns = await this.mhs.getMdsNetworks(profile, compartmentId) as OciResource[];
        } catch (e) {
            console.error(e);
            const message = convertErrorToString(e);
            ui.showErrorMessage(`Failed to fetch VCNs: ${message}`, {});
        } finally {
            console.log("vcns", vcns);
            this.setState({ isFetchingVcns: false });
        }

        return vcns;
    }

    private async fetchSubnets(profile: string, vcn: string) {
        this.setState({ isFetchingSubnets: true });

        let subnets: OciResource[] = [];
        try {
            console.log("getMdsSubnets");
            subnets = await this.mhs.getMdsSubnets(profile, vcn) as OciResource[];
        } catch (e) {
            console.error(e);
            const message = convertErrorToString(e);
            ui.showErrorMessage(`Failed to fetch subnets: ${message}`, {});
        } finally {
            console.log("subnets", subnets);
            this.setState({ isFetchingSubnets: false });
        }

        return subnets;
    }

    private ensureOciAccess = async (setCompartments?: boolean, existingTiles?: IStepTile[],
        maxAttempts = 60, intervalMs = 5000) => {
        let hasOciAccess = false;
        let existingProfiles: IMdsProfileData[] | undefined;
        let compartments: ICompartment[] | undefined;
        try {
            ({ profiles: existingProfiles, compartments } = await waitForPromise(this.ensureCompartments,
                "ensureCompartments", maxAttempts, intervalMs));
            console.log("API key is valid");
            hasOciAccess = true;
        } catch (e) {
            console.info(e);
        }

        try {
            console.log("getMdsConfigProfiles");
            const [configProfiles, tiles] = await Promise.all([
                existingProfiles ? Promise.resolve(existingProfiles) : this.mhs.getMdsConfigProfiles(),
                existingTiles ? Promise.resolve(existingTiles) : this.fetchTiles(),
            ]);

            if (!hasOciAccess) {
                hasOciAccess = configProfiles.length !== 0;
            }

            const state: Partial<IMigrationAppState> = {
                hasOciAccess,
                configProfiles,
                // tiles: this.getOciFilteredTiles(tiles, hasOciAccess),
                tiles,
            };

            if (setCompartments && compartments) {
                state.originalCompartments = compartments;
                const converted = convertCompartments(compartments);
                state.compartments = converted;
                state.networkCompartments = converted;
            }

            this.setState(state);
        } catch {
            // Nothing to do.
        }
    };

    private ensureCompartments = async () => {
        const profiles = await this.mhs.getMdsConfigProfiles();
        console.log("profiles", profiles);
        if (!profiles.length) {
            throw new Error("Profiles list is empty");
        }

        const defaultProfile = profiles.find((p) => {
            return p.profile === "DEFAULT";
        });

        let compartments: ICompartment[] | undefined;
        if (defaultProfile) {
            compartments = await this.mhs.getMdsCompartments(defaultProfile.profile);
            console.log("compartments", compartments);

            if (!compartments.length) {
                throw new Error("Compartments list is empty");
            }
        }

        return { profiles, compartments };
    };

    private renderUpdateSubStep(subStepId: SubStepId) {
        const { subStepConfig, requestEditorEnabled } = this.state;
        const isEditorEnabled = requestEditorEnabled[subStepId];

        let requestContent;
        let json: string;
        if (isEditorEnabled) {
            json = subStepConfig[subStepId] ?? "";
            requestContent = (
                <textarea
                    value={json}
                    onChange={(e) => {
                        const value = (e.target as HTMLTextAreaElement).value;
                        this.setState(({ subStepConfig }) => {
                            return {
                                subStepConfig: {
                                    ...subStepConfig,
                                    [subStepId]: value,
                                }
                            };
                        });
                    }}
                />
            );
        } else {
            json = this.beReq.generateBackendRequest(subStepId, this.state);
            requestContent = <JsonView json={json} />;
        }

        return (
            <div>
                {requestContent}
                <Checkbox
                    caption="Enable Request Editor"
                    checkState={requestEditorEnabled[subStepId]}
                    onChange={this.onEnableEditor.bind(this, subStepId)}
                />
            </div>
        );
    }

    private isSubStepInProgress(stepId: number, subStepId: number) {
        const { tiles } = this.state;
        const { stepIndex, subStepIndex } = this.findStepIndexes(stepId, subStepId);

        if (stepIndex === -1 || subStepIndex === -1) {
            return false;
        }

        const { status } = tiles[stepIndex].steps[subStepIndex];
        if (status === MigrationStepStatus.NOT_STARTED || status === MigrationStepStatus.FINISHED) {
            return false;
        }

        return true;
    }

    private getCurrentStepInfo() {
        const { tiles } = this.state;

        return tiles.find((t) => {
            return t.number === this.getCurrentStep;
        });
    }

    private renderMain() {
        const { tiles, expandedSections } = this.state;
        const { compartmentPath } = this.state.planStepData;

        const stepInfo = this.getCurrentStepInfo();
        const caption = `${stepInfo!.number}. ${stepInfo!.caption}`;

        const makeWorkSectionCaption = (subStep: ISubStep) => {
            const { caption, workStage } = subStep;
            let icon;
            switch (workStage?.status) {
                case WorkStatus.ERROR:
                    icon = <Icon src={Codicon.Error} className="icon-failed" />;
                    break;
                case WorkStatus.ABORTED:
                    icon = <Icon src={Codicon.DebugBreakpoint} className="icon-aborted" />;
                    break;
                case WorkStatus.FINISHED:
                    icon = <Icon src={Codicon.Check} className="icon-finished" />;
                    break;
                case WorkStatus.IN_PROGRESS:
                    icon = <Icon src={Codicon.Gear} className="icon-loading" />;
                    break;
                case WorkStatus.NOT_STARTED:
                    icon = <Icon src={Codicon.Dash} className="icon-waiting" />;
                    break;
            }

            return (<Container orientation={Orientation.LeftToRight}>
                {caption}
                {icon}
            </Container>);
        };

        const accordion = tiles.filter((tile) => {
            return tile.number === this.getCurrentStep;
        }).map((tile) => {

            const sections = tile.steps.map((step): ISection => {
                const sectionKey = this.getSectionKey(tile.id, `${step.id}`);
                const expanded = (expandedSections.has(sectionKey)
                    || this.isSubStepInProgress(tile.id, step.id));

                return {
                    key: sectionKey,
                    caption: tile.number == 1 ? step.caption : makeWorkSectionCaption(step),
                    content: (
                        <div onClick={() => {
                            this.setSubStep(sectionKey);
                        }}>
                            {this.renderFormControls(tile.id, step.id)}
                            {this.renderDevData(tile, step.id)}
                        </div>
                    ),
                    expanded,
                };
            });

            return (
                <Accordion
                    id="steps"
                    header={caption}
                    sections={sections}
                    disableSections={tile.number === 1}
                    onSectionExpand={this.handleManualSectionExpansion}
                />
            );
        });

        const summaryInfo = this.state.summaryInfo;

        return (
            <div className="form">
                <MigrationOverview
                    type={this.connectivity ?? CloudConnectivity.NOT_SET}
                    region={summaryInfo.region ?? ""}
                    connectionCaption={this.state.databaseSource.name}
                    sourceVersion={summaryInfo.sourceVersion ?? ""}
                    sourceIp={`${summaryInfo.sourceHost ?? ""}:${summaryInfo.sourcePort ?? 3306}`}
                    remoteIp={summaryInfo.dbSystemIP ?? ""}
                    compartmentName={compartmentPath?.split("/").pop() ?? ""}
                    heatwaveName={summaryInfo.dbSystemName ?? ""}
                    heatwaveVersion={summaryInfo.dbSystemVersion ?? ""}
                    exportInProgress={this.exportInProgress}
                    importInProgress={this.importInProgress}
                    replicationInProgress={this.replicationInProgress}
                />
                {accordion}
            </div>
        );
    }

    private setCommandLineArguments = (commandLineArgsJson: string): Promise<boolean> => {
        const { databaseSource, formGroupValues } = this.state;

        return new Promise((resolve) => {
            if (commandLineArgsJson) {
                try {
                    const cmdLineArgs = JSON.parse(commandLineArgsJson) as { migrate?: string; };

                    const migrationSourceBase64 = cmdLineArgs.migrate;
                    if (!migrationSourceBase64) {
                        throw new Error("Base64-encoded connection details argument not found");
                    }
                    const migrationSource = atob(migrationSourceBase64);

                    const migrationData = JSON.parse(migrationSource) as Partial<IDatabaseSource>;

                    const state: Pick<IMigrationAppState,
                        "migrationSource" | "databaseSource" | "formGroupValues"> = {
                        migrationSource,
                        databaseSource: { ...databaseSource },
                        formGroupValues: { ...formGroupValues },
                    };
                    if ("name" in migrationData && migrationData.name) {
                        state.databaseSource.name = migrationData.name;
                    }
                    if ("user" in migrationData && migrationData.user) {
                        state.databaseSource.user = migrationData.user;
                    }
                    if ("host" in migrationData && migrationData.host) {
                        state.databaseSource.host = migrationData.host;
                    }
                    if ("port" in migrationData && migrationData.port) {
                        state.databaseSource.port = migrationData.port;
                    }
                    if ("id" in migrationData && migrationData.id) {
                        state.databaseSource.id = migrationData.id;
                    }

                    const sourceUri = this.getSourceUri(state.databaseSource);
                    if (sourceUri) {
                        state.formGroupValues.sourceUri = sourceUri;
                    }

                    if (Object.keys(state).length) {
                        this.setState(state, () => {
                            void this.ensureProject();

                            resolve(true);
                        });
                    }
                } catch (e) {
                    console.error(e);
                    const message = convertErrorToString(e);
                    const displayedMessage = `Error parsing migration source JSON: ${message}`;
                    ui.showErrorMessage(displayedMessage, {});
                    resolve(false);
                }
            } else {
                resolve(false);
            }
        });
    };

    private setApplicationData = (applicationDataJson: string): Promise<boolean> => {
        if (!applicationDataJson) {
            return Promise.resolve(false);
        }

        try {
            const applicationData = JSON.parse(applicationDataJson) as { logPath?: string, projectsPath?: string; };

            this.setState({ logPath: applicationData.logPath, projectsPath: applicationData.projectsPath });

            return Promise.resolve(true);
        } catch (e) {
            console.error(e);
            const message = convertErrorToString(e);
            const displayedMessage = `Error parsing application data JSON: ${message} data ${applicationDataJson}`;
            ui.showErrorMessage(displayedMessage, {});

            return Promise.resolve(false);
        }
    };

    private onSendWebMessageClick = (_e: MouseEvent | KeyboardEvent) => {
        const { fakeWebMessage } = this.state;
        if (fakeWebMessage) {
            void requisitions.execute("setCommandLineArguments", generateWbCmdLineArgs(fakeWebMessage));
        }
    };

    private renderTextareaActionButton(stateKey: MockStateText,
        onClick: (e: MouseEvent | KeyboardEvent) => void) {
        const currentValue = this.state[stateKey];

        return (
            <Button
                caption="Execute"
                isDefault={true}
                onClick={(e: MouseEvent | KeyboardEvent) => {
                    onClick(e);
                    this.popups.get(stateKey)?.current?.close(false);
                }}
                disabled={!currentValue}
            />
        );
    }

    private onUpdateWorkStatus = (_e: MouseEvent | KeyboardEvent) => {
        const { tiles, workStatus } = this.state;
        const status = JSON.parse(workStatus ?? `""`) as IWorkStatusInfo;

        void this.updateWorkStatus(tiles, status);
    };

    private onUpdateBackendState = (_e: MouseEvent | KeyboardEvent) => {
        const { mockBackendState, backendState } = this.state;
        const stepsState = JSON.parse(mockBackendState ?? `""`) as IMigrationPlanState[];

        const result: IMigrationPlanState[] = stepsState.filter((s) => {
            return s.id;
        }).map((s) => {
            if (!backendState[s.id]) {
                return s;
            }

            return {
                ...backendState[s.id],
                ...s,
            };
        });

        this.handleSubStepStates(result);
    };

    private renderActionTextareaInPopup(
        buttonStyle: CSSProperties, caption: string,
        stateKey: MockStateText,
        onClick: (e: MouseEvent | KeyboardEvent) => void,
    ) {
        const currentValue = this.state[stateKey];

        if (!this.popups.has(stateKey)) {
            this.popups.set(stateKey, createRef());
        }
        const popupRef = this.popups.get(stateKey);

        return (
            <>
                <Button
                    caption={caption}
                    isDefault={true}
                    onClick={(e: MouseEvent | KeyboardEvent) => {
                        const element = e.currentTarget as HTMLElement;
                        popupRef?.current?.open(element.getBoundingClientRect());
                    }}
                    style={buttonStyle}
                />
                <Popup
                    ref={popupRef}
                    id="web-message-popup"
                    showArrow={false}
                    placement={ComponentPlacement.BottomRight}
                >
                    <textarea onChange={(e) => {
                        const value = (e.target as HTMLTextAreaElement).value;

                        this.setState({ [stateKey]: value });
                    }} value={currentValue} />
                    {this.renderTextareaActionButton(stateKey, onClick)}
                </Popup>
            </>
        );
    }

    private renderDevHelpers() {
        const { migrationSource } = this.state;

        const buttonStyle = { width: 100, height: 30 };

        return (
            <>
                <Container
                    orientation={Orientation.LeftToRight}
                    className="header"
                >
                    <span>[DEV]</span>
                    <Button
                        caption="New Project"
                        isDefault={true}
                        onClick={() => {
                            void this.migration.newProject(this.state.databaseSource.name, this.fullConnectionString)
                                .then(console.log);
                        }}
                        style={buttonStyle}
                    />
                    <Button
                        caption="List Projects"
                        isDefault={true}
                        onClick={() => {
                            void this.migration.listProjects().then(console.log);
                        }}
                        style={buttonStyle}
                    />
                    <Button
                        caption="Get Plan Status"
                        isDefault={true}
                        onClick={() => {
                            void this.refreshFromBackend();
                        }}
                        style={buttonStyle}
                    />
                    <Button
                        caption="Get Steps"
                        isDefault={true}
                        onClick={() => {
                            void this.migration.getSteps().then(console.log);
                        }}
                        style={buttonStyle}
                    />
                    <Button
                        caption="Show About"
                        isDefault={true}
                        onClick={() => {
                            void this.showAbout();
                        }}
                        style={buttonStyle}
                    />
                    {this.renderActionTextareaInPopup(buttonStyle, "Send web message", "fakeWebMessage",
                        this.onSendWebMessageClick)}
                    {this.renderActionTextareaInPopup(buttonStyle, "Update Work Status", "workStatus",
                        this.onUpdateWorkStatus)}
                    {this.renderActionTextareaInPopup(buttonStyle, "Update BE State", "mockBackendState",
                        this.onUpdateBackendState)}
                </Container>
                <JsonView json={migrationSource ?? `""`} />
            </>
        );
    }

    private renderBackendState(subStepId: number) {
        const { backendState } = this.state;
        if (backendState[subStepId] === undefined) {
            return null;
        }

        return (
            <div className="backend-state">
                <div className="status">{backendState[subStepId].status}</div>
                <div className="values">
                    <JsonView json={backendState[subStepId].values as unknown as JsonObject} />
                </div>
                <div className="data">
                    <JsonView json={backendState[subStepId].data as unknown as JsonObject} />
                </div>

                {this.renderErrors(subStepId)}
            </div>
        );
    }

    private renderErrors(subStepId: number) {
        const { backendState } = this.state;
        const errors = backendState[subStepId]?.errors ?? [];

        return (
            <ul className="errors">
                {errors.map((e, index) => {
                    return (
                        <li key={index} className="error">
                            <span className="level">{e.level}</span>{" "}
                            <span className="type">{e.type}</span>{" "}
                            <div className="title">{e.title}</div>
                            <div className="message">{e.message}</div>
                            <JsonView className="info" json={JSON.stringify(e.info)} />
                        </li>
                    );
                })}
            </ul>
        );
    }

    private handleSubStepStates = (stepsState: IMigrationPlanState[]): void => {
        const { backendState, formGroupValues, planStepData } = this.state;

        const updatedFormGroupValues = { ...formGroupValues };
        const updatedBackendState = { ...backendState };
        const updatedPlanStepData = { ...planStepData };

        const processNestedObject = (prefix: string, obj: IDictionary) => {
            for (const key in obj) {
                const value = obj[key];
                if (typeof value === "object") {
                    processNestedObject(prefix + key + ".", value as IDictionary);
                } else if (typeof value === "string" || typeof value === "number" || typeof value === "bigint"
                    || typeof value == "boolean") {
                    updatedFormGroupValues[prefix + key] = String(value);
                } else {
                    console.warn(`Unexpected type ${typeof value} of value `, value, "key", prefix + key);
                }
            }
        };

        const targetOptionErrors: BadUserInput[] = [];

        stepsState.forEach((item) => {
            updatedBackendState[item.id] = item;

            if (item.status !== "NOT_STARTED") {
                switch (item.id) {
                    case SubStepId.MIGRATION_CHECKS:
                        if (item.values) {
                            processNestedObject("", item.values as unknown as IDictionary);
                        }
                        if (item.data) {
                            this.fillIssueResolution(item.data as IMigrationChecksData);
                        }
                        break;

                    case SubStepId.TARGET_OPTIONS:
                        if (item.data) {
                            const data = item.data as ITargetOptionsData;
                            updatedPlanStepData.compartmentPath = data.compartmentPath;
                            updatedPlanStepData.networkCompartmentPath = data.networkCompartmentPath;
                            updatedPlanStepData.allowCreateNewVcn = data.allowCreateNewVcn ? "1" : "0";
                        }
                        if (item.values) {
                            processNestedObject("", item.values as unknown as IDictionary);
                        }
                        break;

                    default:
                        if (item.values) {
                            processNestedObject("", item.values as unknown as IDictionary);
                        }
                        break;
                }
            }

            targetOptionErrors.push(...this.filterBadUserInputErrors(item.errors));
        });

        const state: Partial<IMigrationAppState> = {
            backendState: updatedBackendState,
            formGroupValues: updatedFormGroupValues,
            planStepData: updatedPlanStepData,
            targetOptionErrors,
        };

        this.setState(state);
    };

    private handleSubStepState = (subStepId: number, subStepState: IMigrationPlanState): void => {
        this.setState(({ backendState }) => {
            return {
                backendState: {
                    ...backendState,
                    [subStepId]: {
                        ...backendState[subStepId],
                        ...subStepState,
                    },
                },
            };
        });
    };

    private onEnableEditor = (subStepId: SubStepId, checkState: CheckState) => {
        const { requestEditorEnabled, formGroupValues, subStepConfig } = this.state;

        const newState: Pick<IMigrationAppState,
            "requestEditorEnabled" | "formGroupValues" | "subStepConfig"> = {
            requestEditorEnabled: {
                ...requestEditorEnabled,
                [subStepId]: checkState,
            },
            formGroupValues: { ...formGroupValues },
            subStepConfig: {
                ...subStepConfig,
                [subStepId]: this.beReq.generateBackendRequest(subStepId, this.state),
            }
        };

        this.setState(newState);
    };

    private renderSignInInfo() {
        const { ociSignInInfo } = this.state;
        if (!ociSignInInfo) {
            return;
        }

        if (ociSignInInfo.info?.url) {
            const url = ociSignInInfo.info.url;

            return (
                <div className="oci-sign-in">
                    <p>{ociSignInInfo.message}</p>

                    <div className="url-message">
                        <p>
                            If the Sign In page is not visible, <span
                                className="copy-url-link"
                                data-tooltip="Copy URL to clipboard"
                                onPointerDown={() => {
                                    requisitions.writeToClipboard(url);
                                }}>
                                click here
                            </span> to copy the URL and paste it into your browser to access it.</p>
                    </div>
                </div>);
        } else {
            return (
                <div className="oci-sign-in">
                    <p>{ociSignInInfo.message}</p>
                    {/*
                {ociSignInInfo.map((info, index) => {
                    const isUrl = info.startsWith("http");

                    return (
                        <div key={index} className="info">
                            {isUrl ? (
                                <>
                                    <a className="url" href={info}>OCI Sign In</a>
                                    <Button
                                        className="copyButton"
                                        data-tooltip="Copy URL to clipboard"
                                        imageOnly
                                        focusOnClick={false}
                                        tabIndex={-1}
                                        onPointerDown={() => {
                                            requisitions.writeToClipboard(info);
                                        }}
                                    >
                                        <Icon src={Codicon.Copy} data-tooltip="inherit" />
                                    </Button>
                                </>
                            ) : <span className="text">{info}</span>}
                        </div>
                    );
                })} */}
                </div>
            );
        }
    }

    private renderIssues(subStepId: number) {
        const { backendState, issueResolution, expandedIssues } = this.state;

        if (!backendState[subStepId]?.data) {
            return;
        }

        const checkData = backendState[subStepId].data as IMigrationChecksData;

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        const issuesItems = checkData?.issues;

        if (!issuesItems.length) {
            return (<div>No compatibility or upgrade issues were detected.</div>);
        }

        const sanitizeLinks = (html: string): string => {
            // This regex matches <a> tags, preserving any existing attributes
            return html.replace(/<a([\s\S]*?)>/gi, (match: string, attrs: string) => {
                // Check if a target attribute is present
                if (/target\s*=/i.test(attrs)) {
                    // If already present, replace its value with _blank
                    return match.replace(/target\s*=\s*(['"])[^'"]*\1/i, 'target="_blank"');
                } else {
                    // If not present, add target="_blank"
                    return `<a${attrs} target="_blank">`;
                }
            });
        };

        return (
            <ul className="issues">
                {issuesItems.map((i) => {
                    if (!i.checkId) {
                        return null;
                    }
                    const checkId = i.checkId;
                    // console.log(expandedIssues, checkId, expandedIssues[checkId]);
                    if (!expandedIssues[checkId]) {
                        return (
                            <li className="issue-collapsed" key={checkId} onClick={() => {
                                expandedIssues[checkId] = true;
                                this.setState({ expandedIssues });
                            }}>
                                <Container orientation={Orientation.LeftToRight}
                                    mainAlignment={ContentAlignment.SpaceBetween}>
                                    <div className="title">
                                        {
                                            i.level === "ERROR" ? (
                                                <Icon src={Codicon.Error} style={{ color: "red" }} />
                                            ) : i.level === "WARNING" ? (
                                                <Icon src={Codicon.Warning} style={{ color: "#dcb342ff" }} />
                                            ) : i.level === "NOTICE" ? (
                                                <Icon src={Codicon.Info} style={{ color: "#4287dcff" }} />
                                            ) : null
                                        }&nbsp;{i.title}
                                    </div>
                                    <Button
                                        imageOnly
                                        data-tooltip="Show details"
                                        onClick={() => {
                                            expandedIssues[checkId] = true;
                                            this.setState({ expandedIssues });
                                        }}>
                                        <Icon src={Codicon.Ellipsis} data-tooltip="inherit" />
                                    </Button>
                                </Container>
                                <div className="issue-collapsed-detail">
                                    Resolve with <span className="issue-resolution">{issueResolution[checkId]}</span>
                                </div>
                            </li>
                        );
                    } else {
                        return (
                            <li className="issue" key={checkId}>
                                <Container orientation={Orientation.LeftToRight}
                                    mainAlignment={ContentAlignment.SpaceBetween}>
                                    <div className="title">
                                        {
                                            i.level === "ERROR" ? (
                                                <Icon src={Codicon.Error} style={{ color: "red" }} />
                                            ) : i.level === "WARNING" ? (
                                                <Icon src={Codicon.Warning} style={{ color: "#dcb342ff" }} />
                                            ) : i.level === "NOTICE" ? (
                                                <Icon src={Codicon.Info} style={{ color: "#4287dcff" }} />
                                            ) : null
                                        } {i.level}: {i.title}</div>
                                </Container>
                                <div dangerouslySetInnerHTML={{ __html: sanitizeLinks(i.description) }}
                                    className="description"></div>

                                {//<div dangerouslySetInnerHTML={{ __html: sanitizeLinks(i.result) }}
                                    // className="result"></div>
                                }

                                {(i.objects.length > 0) &&
                                    <>
                                        <div className="objects-label">Affected objects:</div>
                                        {this.renderIssueObjects(i)}
                                    </>
                                }

                                <div className="objects-label">Resolution:</div>
                                {this.renderIssueChoices(i)}
                            </li>
                        );
                    }
                })}
            </ul>
        );
    }

    private setFormGroupValues = (updated: FormGroupValues) => {
        this.setState(({ formGroupValues }) => {
            return {
                formGroupValues: {
                    ...formGroupValues,
                    ...updated,
                }
            };
        });
    };

    private updateState = (state: Partial<IMigrationAppState>): Promise<void> => {
        return new Promise((resolve) => {
            this.setState(({ formGroupValues }) => {
                if (!("formGroupValues" in state)) {
                    return state;
                }

                return {
                    ...state,
                    formGroupValues: {
                        ...formGroupValues,
                        ...state.formGroupValues,
                    }
                };
            }, resolve);
        });
    };

    private watchProfile = async (changes?: WatcherChanges, profile?: string) => {
        if (!profile) {

            this.setState(({ formGroupValues }) => {
                return {
                    originalCompartments: [],
                    compartments: [],
                    networkCompartments: [],
                    formGroupValues: {
                        ...formGroupValues,
                        profile,

                        // the rest may be taken from backend response after planUpdate?
                        "hosting.compartmentId": "create_new", // or a value from backendState?
                        "hosting.parentCompartmentId": "",
                        // this will cause resetNetworking
                        "hosting.networkCompartmentId": "",

                        "hosting.configTemplate": standardTemplateId,
                    },
                };
            });

            return;
        }

        const prevProfile = changes?.prevValues.profile;

        let state: Partial<IMigrationAppState> = {};
        const isProfileChanged = prevProfile !== changes?.changedValues.profile;
        if (isProfileChanged) {
            // OCI profile changed, reset cached values
            state = {
                originalCompartments: [],
                compartments: [],
                networkCompartments: [],
                vcns: [],
                subnets: []
            };
        }

        await this.updateState({
            formGroupValues: {
                profile,
                "hosting.configTemplate": standardTemplateId,
            },
            ...state,
        });
        let stepsState = await this.submitSubStep(SubStepId.OCI_PROFILE, true);
        stepsState ??= await this.refreshFromBackend();
        // TODO - NEW
        await this.watchConfigTemplate(changes, this.configTemplate);

        const compartments = await this.fetchCompartments(profile);
        const converted = convertCompartments(compartments);

        state = {
            originalCompartments: compartments,
            compartments: converted,
            networkCompartments: converted,
        };

        const targetOptions = stepsState.find((s) => {
            return s.id === SubStepId.TARGET_OPTIONS;
        });
        const hosting = (targetOptions?.values as ITargetOptionsOptions | undefined)?.hosting;

        const parentCompartmentId = hosting?.parentCompartmentId ?? this.parentCompartment;
        const compartmentId = hosting?.compartmentId;
        const compartmentName = hosting?.compartmentName;
        const networkCompartmentId = hosting?.networkCompartmentId;

        if (!prevProfile || isProfileChanged) {
            await this.updateState(state);
            await this.addCreateNewMysqlCompartment(changes, parentCompartmentId, compartmentId, compartmentName);

            return;
        }

        await this.updateState({
            ...state,
            formGroupValues: {
                "hosting.parentCompartmentId": hosting?.parentCompartmentId,
                "hosting.networkCompartmentId": networkCompartmentId,
            }
        });
    };

    private resolveCreateNewMysqlCompartment(actualCompartmentName: string, parentCompartmentId?: string): Compartment {
        let compartmentId: string | null = null;

        const rootCompartment = this.findRootCompartment();
        if (rootCompartment) {
            compartmentId = rootCompartment.id;
        }
        if (parentCompartmentId) { // This can be empty string.
            compartmentId = parentCompartmentId;
        }

        return { id: "create_new", name: `${actualCompartmentName} (create new)`, compartmentId };
    }

    private addCreateNewMysqlCompartment = async (_changes?: WatcherChanges, parentCompartmentId?: string,
        compartmentId?: string, compartmentName?: string) => {
        const { originalCompartments } = this.state;

        const mysqlCompartment = this.findMySqlCompartment(compartmentId, parentCompartmentId);

        const actualCompartmentId = this.resolveCompartmentId(compartmentId, mysqlCompartment);
        const actualCompartmentName = this.resolveCompartmentName(compartmentName, mysqlCompartment);

        let allCompartments: Compartment[] = [...originalCompartments];
        if (!mysqlCompartment) {
            const createNew = this.resolveCreateNewMysqlCompartment(actualCompartmentName, parentCompartmentId);
            allCompartments = [createNew, ...originalCompartments];
        }

        const updates: FormGroupValues = {
            "hosting.compartmentId": actualCompartmentId,
            "hosting.compartmentName": actualCompartmentName,
        };

        this.setState(({ formGroupValues }) => {
            const state: Partial<IMigrationAppState> = {
                formGroupValues: {
                    ...formGroupValues,
                    ...updates,
                },
            };

            if (!mysqlCompartment) {
                state.compartments = convertCompartments(allCompartments);
            }

            return state;
        });

        return Promise.resolve();
    };

    private resolveCompartmentId(compartmentId?: string,
        mysqlCompartment?: ICompartment) {
        if (compartmentId) {
            return compartmentId;
        }

        if (mysqlCompartment) {
            return mysqlCompartment.id;
        }

        if (this.compartment) {
            return this.compartment;
        }

        return "create_new";
    }

    private resolveCompartmentName(compartmentName?: string,
        mysqlCompartment?: ICompartment) {
        if (compartmentName) {
            return compartmentName;
        }

        if (mysqlCompartment) {
            return mysqlCompartment.name;
        }

        if (this.compartmentName) {
            return this.compartmentName;
        }

        return "MySQL";
    }

    private watchCompartmentIdReset = async (changes?: WatcherChanges, compartmentId?: string) => {
        if (compartmentId || !changes?.prevValues["hosting.compartmentId"]) {
            return;
        }

        return this.addCreateNewMysqlCompartment(changes, this.parentCompartment);
    };

    private watchNetworkCompartment = async (changes?: WatcherChanges,
        networkCompartmentId?: string) => {
        let vcns: OciResource[] = [];
        if (this.profile && networkCompartmentId) {
            vcns = await this.fetchVcns(this.profile, networkCompartmentId);
        }

        const state: Partial<IMigrationAppState> = {
            vcns: this.resourceToOptions(vcns),
            subnets: []
        };

        const prevValue = changes?.prevValues["hosting.networkCompartmentId"];
        if (!prevValue) {
            this.setState(state);

            return;
        }

        this.setState(({ formGroupValues }) => {
            return {
                ...state,
                formGroupValues: {
                    ...formGroupValues,
                    "hosting.vcnId": "",
                    "hosting.privateSubnet.id": "",
                    "hosting.publicSubnet.id": "",
                },
            };
        });
    };

    private watchVcn = async (_changes?: WatcherChanges,
        vcn?: string) => {
        // const { backendState } = this.state;

        if (!this.profile || !vcn) {
            return;
        }

        const subnets = await this.fetchSubnets(this.profile, vcn);

        this.setState({ subnets: this.resourceToOptions(subnets) });
    };

    private resetNetworking = async (_changes?: WatcherChanges,
        compartmentId?: string) => {

        this.setState(({ formGroupValues }) => {
            return {
                vcns: [],
                subnets: [],
                formGroupValues: {
                    ...formGroupValues,
                    "hosting.vcnId": "",
                    "hosting.privateSubnet.id": "",
                    "hosting.publicSubnet.id": "",
                }
            };
        });

        return Promise.resolve();
    };

    private updateShapes = async (_changes?: WatcherChanges,
        compartmentId?: string) => {
        const { profile } = this;

        const compartmentOcid = this.resolveCompartmentIdForShapes(compartmentId);
        if (!profile || !compartmentOcid) {
            return;
        }
        const existingShapes = await this.fetchShapes(profile, compartmentOcid);
        console.log("shapes", existingShapes);

        if (this.configTemplate) {
            const { formGroupValues, notFoundShapesFor } = this.sh.getShapeInfoForTemplate(this.configTemplate,
                existingShapes, this.shouldValidateShapes());
            this.displayNotFoundShapes(notFoundShapesFor);
            if (Object.keys(formGroupValues).length) {
                await this.updateState({ formGroupValues });
            }
        }
    };

    private updateSubnets = async (_changes?: WatcherChanges, _vcn?: string) => {
        // const { backendState } = this.state;

        this.setState(({ formGroupValues }) => {
            return {
                // compartments: this.withCreateNew(),
                // vcns: this.withCreateNew(),
                subnets: [],
                formGroupValues: {
                    ...formGroupValues,
                    // "hosting.compartmentId": "",
                    // "hosting.networkCompartmentId": "",
                    // "hosting.vcnId": "",
                    //    "hosting.privateSubnet.id": "",
                    //    "hosting.publicSubnet.id": "",
                }
            };
        });

        return Promise.resolve();
    };

    private renderConnectivityOptions() {
        if (this.state.formGroupValues.type === MigrationType.COLD) {
            return null;
        }

        const { allowedConnectivity } = this.resolveMigrationAllowance();

        const options: Array<{ id: CloudConnectivity, label: string; }> = [
            { id: CloudConnectivity.SITE_TO_SITE, label: "Direct (Site-to-Site VPN)" },
            { id: CloudConnectivity.SSH_TUNNEL, label: "SSH Tunnel" },
            { id: CloudConnectivity.LOCAL_SSH_TUNNEL, label: "SSH Tunnel (automatic)" },
        ].filter(({ id }) => {
            return allowedConnectivity.includes(id);
        });

        const description: Record<CloudConnectivity, string> = {
            "": "",
            [CloudConnectivity.SITE_TO_SITE]: `Assumes direct network connectivity from the
            target DB System to the source database using
            <a href="https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/overviewIPsec.htm"
             target=_blank>Site-to-Site VPN</a> or FastConnect.
            You must select a pre-configured VCN that allows connections to port 3306 of your
            on-premises source database from the subnet where the DB System will be attached to.`,
            // eslint-disable-next-line max-len
            [CloudConnectivity.SSH_TUNNEL]: `The target DB System will replicate from your source database through a SSH tunnel running on the OCI jump host provisioned by this tool. You must manually start a SSH tunnel from your on-premises network to the jump host.`,
            // eslint-disable-next-line max-len
            [CloudConnectivity.LOCAL_SSH_TUNNEL]: `The target DB System will replicate from your source database through a SSH tunnel running on the OCI jump host provisioned by this tool. A SSH tunnel will be automatically started on the host this tool is running on. Note that the tunnel will close when this tool is closed.`,
        };

        return (
            <div className="migration-sub-type">
                <Label caption="Network Connectivity for Inbound Replication" />
                <Dropdown
                    selection={this.connectivity}
                    onSelect={this.onConnectivityChange}
                    id="connectivity"
                >
                    {options.map(({ id, label }) => {
                        return (
                            <DropdownItem
                                caption={label}
                                key={id}
                                id={id}
                                payload={id}
                                className="with-min-height"
                            />
                        );
                    })}
                </Dropdown>
                {this.connectivity && <p dangerouslySetInnerHTML={{ __html: description[this.connectivity] }}></p>}
            </div>
        );
    }

    private onConnectivityChange = (_accept: boolean, _selectedIds: Set<string>,
        payload: unknown): void => {
        const connectivity = payload as CloudConnectivity;

        this.setFormGroupValues({ connectivity });
    };

    private fillIssueResolution(data: IMigrationChecksData) {
        if (!data.issues.length) {
            return;
        }

        //const issueResolution: IMigrationAppState["issueResolution"] = {};
        // TODO- workaround for compatflags/issue resolution being lost after checks are re-executed
        const issueResolution: IMigrationAppState["issueResolution"] = this.state.issueResolution;
        data.issues.forEach((i) => {
            if (!i.choices.length) {
                return;
            }
            issueResolution[i.checkId!] = i.choices[0];
        });

        this.setState({ issueResolution });
    }

    private renderIssueObjects(issue: ICheckResult) {
        const formatObject = (obj: string) => {
            const tokens = obj.split(":");
            const otype = tokens[0];
            const oname = tokens[1];

            if (otype == "table") {
                return (
                    <>
                        <Icon src={Assets.db.tableIcon} width={14} height={14} data-tooltip="Table" /> {oname}
                    </>
                );
            } else if (otype == "view") {
                return (
                    <>
                        <Icon src={Assets.db.viewIcon} width={14} height={14} data-tooltip="Table" /> {oname}
                    </>
                );
            } else if (otype == "procedure" || otype == "routine") {
                return (
                    <>
                        <Icon src={Assets.db.procedureIcon} width={14} height={14} data-tooltip="Procedure" /> {oname}
                    </>
                );
            } else if (otype == "function") {
                return (
                    <>
                        <Icon src={Assets.db.functionIcon} width={14} height={14} data-tooltip="Function" /> {oname}
                    </>
                );
            } else if (otype == "event") {
                return (
                    <>
                        <Icon src={Assets.db.eventIcon} width={14} height={14} data-tooltip="Event" /> {oname}
                    </>
                );
            } else if (otype == "trigger") {
                return (
                    <>
                        <Icon src={Assets.db.triggerIcon} width={14} height={14} data-tooltip="Trigger" /> {oname}
                    </>
                );
            } else if (otype == "user") {
                return (
                    <>
                        <Icon src={Codicon.Account} width={14} height={14} data-tooltip="User"
                            style={{ "background": "transparent" }} />
                        {oname}
                    </>
                );
            } else {
                return (
                    <>
                        {otype} - {oname}
                    </>
                );
            }
        };

        return (
            <div className="objects">
                {issue.objects.map((object, index) => {
                    return (
                        <Container orientation={Orientation.LeftToRight} key={index}>
                            {formatObject(object)}
                        </Container >
                    );
                })}
            </div>
        );
    }

    private renderIssueChoices(issue: ICheckResult) {
        if (issue.choices.length === 0) {
            return null;
        }
        const { issueResolution } = this.state;

        return (
            <Dropdown
                selection={issueResolution[issue.checkId ?? ""]
                }
                onSelect={this.onIssueChoiceChange.bind(this, issue)}
                id={`choice-${issue.checkId}`
                }
                className="choice"
            >
                {
                    issue.choices.map((ch) => {
                        return (
                            <DropdownItem
                                caption={ch === "EXCLUDE_OBJECT" ? "Exclude Objects" :
                                    ch === "IGNORE" ? "Ignore Issue" : ch}
                                key={ch}
                                id={ch}
                                payload={ch}
                                className="with-min-height"
                            />
                        );
                    })
                }
            </Dropdown >
        );
    }

    private onIssueChoiceChange = (issue: ICheckResult,
        _accept: boolean, _selectedIds: Set<string>, payload: unknown): void => {
        this.setState(({ issueResolution }) => {
            return {
                issueResolution: {
                    ...issueResolution,
                    [issue.checkId ?? ""]: payload as string,
                }
            };
        });
    };

    private async ensureProject() {
        try {
            // debugger;
            let currentProject: IProjectData | undefined;
            const openedProject = await this.migration.openProject("");
            if (openedProject.id !== ""
                && this.connectionString === openedProject.source
                && this.uniqueConnectionId === openedProject.name
                && !this.queryParams.has("forceNewProject")
            ) {
                currentProject = openedProject;
            }

            currentProject ??= await this.migration.newProject(this.uniqueConnectionId, this.fullConnectionString);

            await this.initialLoading(currentProject);
        } catch (e) {
            if (!(e instanceof AbortError)) {
                console.error(e);
                if (!(e instanceof SilentError)) {
                    const message = convertErrorToString(e);
                    ui.showErrorMessage(message, {});
                }
            }
        }
    }

    private renderProjects() {
        const { projects, project } = this.state;

        return (
            <Container orientation={Orientation.LeftToRight}>
                <Label className="source" caption="Project:" />
                <Dropdown
                    selection={project?.id}
                    optional={false}
                    onSelect={this.onProjectChange}
                    disabled={true}
                    className="database-source"
                >
                    {projects?.map((p) => {
                        return (
                            <DropdownItem
                                caption={this.getProjectCaption(p)}
                                key={p.id}
                                id={p.id}
                                payload={p.id}
                                className="with-min-height"
                            />
                        );
                    })}
                </Dropdown>
            </Container >
        );
    }

    private onProjectChange = (_accept: boolean, _selectedIds: Set<string>,
        payload: unknown): void => {
        const { projects } = this.state;

        const project = projects?.find((p) => {
            return p.id === payload as string;
        });

        this.setState({ project });
    };

    private getProjectCaption(project: IProjectData) {
        const { projects } = this.state;
        const namesCount = new Map<string, number>();
        projects?.forEach((p) => {
            if (!namesCount.has(p.name)) {
                namesCount.set(p.name, 0);
            }
            namesCount.set(p.name, namesCount.get(p.name)! + 1);
        });

        return namesCount.get(project.name) === 1 ? project.name : project.id;
    }

    private getShapesKey(profile: string, compartmentId: string) {
        return `${profile}_${compartmentId}`;
    }

    private setShapes = async (updatedShapes: Shapes, profile: string, compartmentId: string): Promise<void> => {
        return new Promise((resolve) => {
            const key = this.getShapesKey(profile, compartmentId);

            this.setState(({ shapes }) => {
                return {
                    shapes: {
                        ...shapes,
                        [key]: {
                            ...shapes[key],
                            ...updatedShapes,
                        }
                    }
                };
            }, resolve);
        });
    };

    private resolveCompartmentIdForShapes(compartmentId?: string) {
        const compartmentOcid = compartmentId ?? this.compartment;
        if (!compartmentOcid || compartmentOcid === "create_new") {
            if (this.parentCompartment) {
                return this.parentCompartment;
            }
            const rootCompartment = this.findRootCompartment();

            if (!rootCompartment) {
                return undefined;
            }

            return rootCompartment.id;
        }

        return compartmentOcid;
    }

    private async fetchShapes(profile: string, compartmentOcid: string): Promise<Shapes> {
        const { shapes } = this.state;
        const existingShapes = shapes[this.getShapesKey(profile, compartmentOcid)];

        if (existingShapes?.computeShapes && existingShapes.dbSystemShapes) {
            return existingShapes;
        }

        const updatedShapes: Shapes = {};

        this.setState({ isFetchingShapes: true });

        try {
            const fetchDbShapes = !existingShapes?.dbSystemShapes;
            const fetchComputeShapes = !existingShapes?.computeShapes;

            const ads = fetchDbShapes || fetchComputeShapes
                ? await this.mhs.listAvailabilityDomains(profile, compartmentOcid)
                : [];

            const dbShapePromises = fetchDbShapes
                ? ads.map(ad =>
                    this.mhs.listDbSystemShapes("DBSYSTEM, HEATWAVECLUSTER", profile, compartmentOcid, ad)
                )
                : [];
            const computeShapePromises = fetchComputeShapes
                ? ads.map(ad =>
                    this.mhs.listComputeShapes(profile, compartmentOcid, ad)
                )
                : [];

            const [allDbShapes, allComputeShapes] = await Promise.all([
                Promise.all(dbShapePromises),
                Promise.all(computeShapePromises)
            ]);

            const seen = new Set<string>();

            const dbShapes = allDbShapes.flat().filter(i => {
                if (seen.has(i.name)) return false;
                seen.add(i.name);
                return true;
            });

            seen.clear();

            const computeShapes = allComputeShapes.flat().filter(i => {
                if (seen.has(i.shape)) return false;
                seen.add(i.shape);
                return true;
            });

            if (dbShapes) {
                updatedShapes.dbSystemShapes = dbShapes.filter((s) => {
                    return !s.isSupportedFor?.includes(ShapeSummary.IsSupportedFor.Heatwavecluster);
                });
                updatedShapes.heatwaveClusterShapes = dbShapes.filter((s) => {
                    return s.isSupportedFor?.includes(ShapeSummary.IsSupportedFor.Heatwavecluster);
                });
            }

            if (computeShapes) {
                updatedShapes.computeShapes = computeShapes;
            }
        } catch (e) {
            console.error(e);
            const message = convertErrorToString(e);
            ui.showErrorMessage(`Failed to fetch shapes: ${message}`, {});
        } finally {
            this.setState({ isFetchingShapes: false });
            this.shapesFetched = true;
        }

        await this.setShapes(updatedShapes, profile, compartmentOcid);

        return updatedShapes;
    }

    private resourceToOptions(resources: OciResource[]): ISelectOption[] {
        return resources.map(({ id, displayName }) => {
            return { id, label: displayName };
        });
    }

    private stringToOptions(options: readonly string[]): ISelectOption[] {
        return options.map((id) => {
            return { id, label: id };
        });
    }

    private async requestForPassword() {
        const { databaseSource } = this.state;
        const sourceUri = this.getSourceUri(databaseSource);

        const password = await ui.requestPassword({
            requestId: "1",
            service: sourceUri,
            user: databaseSource.user,
        });

        if (password === undefined) {
            requisitions.executeRemote("closeInstance", undefined);

            // The remaining apply when the frontend isn’t launched by the wrapper.

            await this.updateState({
                aborted: true,
            });

            const message = "Operation has been canceled. You can safely close this window now.";
            ui.showInformationMessage(message, { modal: true });
            throw new AbortError(message);
        }

        await this.updateState({
            formGroupValues: {
                sourceUri,
                password,
            },
        });

        return this.submitSubStep(SubStepId.SOURCE_SELECTION, true);
    }

    private handleOverlay(_prevState: Readonly<IMigrationAppState>) {
        const { backendRequestInProgress } = this.state;

        if (!backendRequestInProgress && this.portalRef.current?.isOpen) {
            this.hideOverlay();

            return;
        }

        if (backendRequestInProgress) {
            setTimeout(() => {
                if (this.state.backendRequestInProgress && !this.portalRef.current?.isOpen) {
                    this.showOverlay({
                        backgroundOpacity: 0.2,
                    });
                }
            }, 500);
        }
    }

    private showOverlay = (options?: IPortalOptions): void => {
        this.portalRef.current?.open(options);
    };

    private hideOverlay(): void {
        this.portalRef.current?.close(false);
    }

    private getServerInfoObject(): IServerInfo | undefined {
        const { backendState } = this.state;

        if (!(SubStepId.SOURCE_SELECTION in backendState) || !("data" in backendState[SubStepId.SOURCE_SELECTION]!)) {
            return;
        }
        if (!backendState[SubStepId.SOURCE_SELECTION].data ||
            !("serverInfo" in backendState[SubStepId.SOURCE_SELECTION].data)) {
            return;
        }

        if (typeof backendState[SubStepId.SOURCE_SELECTION].data.serverInfo === "object"
            && backendState[SubStepId.SOURCE_SELECTION].data.serverInfo !== null) {
            return backendState[SubStepId.SOURCE_SELECTION].data.serverInfo;
        }

        return;
    }

    private getSourceUri(source?: IMigrationAppState["databaseSource"]) {
        const databaseSource = source ?? this.state.databaseSource;

        let sourceUri = "";
        if ("user" in databaseSource && databaseSource.user) {
            sourceUri += `${databaseSource.user}@`;
        }
        if ("host" in databaseSource && databaseSource.host) {
            sourceUri += databaseSource.host;
        }
        if ("port" in databaseSource && databaseSource.port) {
            sourceUri += `:${databaseSource.port}`;
        }

        return sourceUri;
    }

    private findRootCompartment() {
        const { originalCompartments } = this.state;

        return originalCompartments.find((c) => {
            return !c.compartmentId;
        });
    }

    private findMySqlCompartment(compartmentId?: string, parentCompartmentId?: string): ICompartment | undefined {
        const { originalCompartments } = this.state;

        let mysqlCompartment = originalCompartments.find((c) => {
            return compartmentId && compartmentId !== "create_new" && c.id === compartmentId;
        });
        mysqlCompartment ??= originalCompartments.find((c) => {
            return parentCompartmentId && c.compartmentId === parentCompartmentId && c.name === "MySQL";
        });

        return mysqlCompartment;
    }

    private renderDevData(tile: IStepTile, subStepId: SubStepId) {
        if (!appParameters.inDevelopment) {
            return null;
        }

        const { showBackendState, showBackendRequest } = this.state;

        const beState = showBackendState && (
            <div>
                <h3>Backend State</h3>

                <h4>Sub Step {subStepId}</h4>
                {this.renderBackendState(subStepId)}

                {subStepId === SubStepId.OCI_PROFILE && (
                    <>
                        <h4>Sub Step {SubStepId.TARGET_OPTIONS}</h4>
                        {this.renderBackendState(SubStepId.TARGET_OPTIONS)}
                    </>
                )}
            </div>
        );

        const beRequest = tile.number === 1 && showBackendRequest && (
            <div>
                <h3>Backend Request</h3>

                <h4>Sub Step {subStepId}</h4>
                {this.renderUpdateSubStep(subStepId)}

                {subStepId === SubStepId.OCI_PROFILE && (
                    <>
                        <h4>Sub Step {SubStepId.TARGET_OPTIONS}</h4>
                        {this.renderUpdateSubStep(SubStepId.TARGET_OPTIONS)}
                    </>
                )}
            </div>
        );

        return (
            <div>
                {beRequest}
                {beState}
            </div>
        );
    }

    private showAbout = async () => {
        await this.updateState({ aboutVisible: true });

        this.aboutBoxRef.current?.show();

        return true;
    };

    private handleAboutClose = (): void => {
        this.setState({ aboutVisible: false });
    };

    private renderAboutDialog(): VNode {
        return (
            <AboutBox
                ref={this.aboutBoxRef}
                title="About MySQL Heatwave Migration Assistant"
                showLinks={false}
                onClose={this.handleAboutClose}
                additionalInfo={[
                    ["Projects Path:", this.state.projectsPath ?? ""],
                    ["Log Path:", this.state.logPath ?? ""]
                ]}
            />
        );
    }

    private shouldValidateShapes(): boolean {
        return !!this.profile && this.state.originalCompartments.length > 0 && !!this.resolveCompartmentIdForShapes();
    }

    private log(...args: unknown[]): void {
        this.logger.logWithPasswordMask(...args);
    }
}
