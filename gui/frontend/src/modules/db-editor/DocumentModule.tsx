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

import { Component, ComponentChild, createRef } from "preact";
import { lazy, Suspense } from "preact/compat";

import { ICodeEditorModel, type IEditorPersistentState } from "../../components/ui/CodeEditor/CodeEditor.js";
import { CodeEditorMode, Monaco } from "../../components/ui/CodeEditor/index.js";
import { ExecutionContexts } from "../../script-execution/ExecutionContexts.js";
import { appParameters } from "../../supplement/AppParameters.js";
import {
    type DesktopCommandId, desktopCommandRegistry, type IDesktopCommandDescriptor, type IDesktopCommandProvider,
} from "../../supplement/DesktopCommandRegistry.js";
import { hasElectronHostBridge } from "../../supplement/ElectronDesktop.js";
import { requisitions } from "../../supplement/Requisitions.js";
import {
    IConnectionInfo, IJdvEditRequest,
    IMrsAuthAppEditRequest, IMrsContentSetEditRequest, IMrsDbObjectEditRequest, IMrsSchemaEditRequest,
    IMrsSdkExportRequest, IMrsUserEditRequest, InitialEditor, type IDocumentOpenData, type IOpenFileDialogResult,
} from "../../supplement/RequisitionTypes.js";
import { Settings } from "../../supplement/Settings/Settings.js";
import {
    ConnectionEditorType, DBType, IConnectionDetails, type IShellSessionDetails,
} from "../../supplement/ShellInterface/index.js";
import { ConnectionBrowser } from "./ConnectionBrowser.js";
import {
    ConnectionWorkspace, IOpenDocumentState, ISelectItemDetails, type IConnectionPresentationState,
} from "./ConnectionWorkspace.js";
import type { IClientConnectionsSavedState } from "./ClientConnections.js";
import type { IEnterpriseBackupSavedState } from "./EnterpriseBackup.js";
import { getDocumentFileName, getOpenDocumentDisplayCaption, getUntitledFileIndex } from "./DocumentCaptionHelpers.js";
import {
    DocumentContext, ISavedGraphData, IToolbarItems, type ISideBarCommandResult, type QualifiedName,
} from "./index.js";

import { ApplicationDB, StoreType } from "../../app-logic/ApplicationDB.js";
import {
    IMySQLConnectionOptions,
} from "../../communication/MySQL.js";
import { IMrsServiceData } from "../../communication/ProtocolMrs.js";
import { Button } from "../../components/ui/Button/Button.js";
import { ComponentPlacement } from "../../components/ui/Component/ComponentBase.js";
import { Divider } from "../../components/ui/Divider/Divider.js";
import { Dropdown, DropdownVariant } from "../../components/ui/Dropdown/Dropdown.js";
import { Codicon } from "../../components/ui/Codicon.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import { defaultEditorOptions } from "../../components/ui/index.js";
import { Label } from "../../components/ui/Label/Label.js";
import { Menu } from "../../components/ui/Menu/Menu.js";
import { IMenuItemProperties, MenuItem } from "../../components/ui/Menu/MenuItem.js";
import { ProgressIndicator } from "../../components/ui/ProgressIndicator/ProgressIndicator.js";
import { SplitButton } from "../../components/ui/SplitButton/SplitButton.js";
import { ITabviewPage, TabPosition, Tabview } from "../../components/ui/Tabview/Tabview.js";
import type { ExecutionContext } from "../../script-execution/ExecutionContext.js";
import { DynamicSymbolTable } from "../../script-execution/DynamicSymbolTable.js";
import { LoadingState } from "../../script-execution/index.js";
import { EditorLanguage, IExecutionContext, INewEditorRequest } from "../../supplement/index.js";
import { ShellInterface } from "../../supplement/ShellInterface/ShellInterface.js";
import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { RunMode, webSession } from "../../supplement/WebSession.js";
import {
    convertErrorToString, getConnectionInfoFromDetails, isShellPromptResult, loadFileAsText, selectFileInBrowser, uuid,
} from "../../utilities/helpers.js";
import { formatTime } from "../../utilities/string-helpers.js";
import { MrsHub } from "../mrs/MrsHub.js";
import { ExecutionWorkerPool } from "./execution/ExecutionWorkerPool.js";
import { ConnectionTags, connectionTagsChangedKey } from "./ConnectionTags.js";

import {
    DialogResponseClosure, IDialogRequest, type ISqlUpdateResult, type Mutable,
} from "../../app-logic/general-types.js";
import { Container, ContentAlignment, Orientation } from "../../components/ui/Container/Container.js";
import {
    SplitContainer, type ISplitterPane, type ISplitterPaneSizeInfo,
} from "../../components/ui/SplitContainer/SplitContainer.js";
import scriptingRuntime from "../../typings/scripting-runtime.d.ts?raw";
import {
    DocumentSideBar, pageTypeToDocumentIcon, type DocumentSideBarMode,
    type IDocumentSideBarSectionState,
} from "./DocumentSideBar/DocumentSideBar.js";

import { ui } from "../../app-logic/UILayer.js";
import {
    CdmEntityType, ConnectionDataModel, type ConnectionDataModelEntry, type ICdmConnectionEntry,
    type ICdmConnectionGroupEntry,
} from "../../data-models/ConnectionDataModel.js";
import { adminPageDefinitions } from "../../data-models/AdminPageDefinitions.js";
import type { AdminPageType, Command } from "../../data-models/data-model-types.js";
import {
    OciDataModel, type IOciDmBastion, type IOciDmCompartment, type IOciDmComputeInstance, type IOciDmDbSystem,
    type IOciDmProfile, type OciDataModelEntry,
} from "../../data-models/OciDataModel.js";
import {
    IOdmSchemaDiagramEntry,
    OdmEntityType, OpenDocumentDataModel, type IOdmAdminEntry, type IOdmConnectionPageEntry, type IOdmScriptEntry,
    type IOdmShellSessionEntry,
    type IOdmStandaloneDocumentEntry, type LeafDocumentEntry, type LeafDocumentType, type OpenDocumentDataModelEntry,
} from "../../data-models/OpenDocumentDataModel.js";

import type { IChatOptionsState } from "../../components/Chat/ChatOptions.js";
import { CreateLibraryDialog } from "../../components/Dialogs/CreateLibraryDialog.js";
import { DropdownItem } from "../../components/ui/Dropdown/DropdownItem.js";
import { ShellTaskDataModel } from "../../data-models/ShellTaskDataModel.js";
import { parseVersion } from "../../parsing/mysql/mysql-helpers.js";
import { Assets } from "../../supplement/Assets.js";
import { ShellInterfaceShellSession } from "../../supplement/ShellInterface/ShellInterfaceShellSession.js";
import { ConnectionProcessor } from "../common/ConnectionProcessor.js";
import { ShellPromptHandler } from "../common/ShellPromptHandler.js";
import { JdvHub } from "../jdv/JdvHub.js";
import type { IShellEditorModel } from "../shell/index.js";
import { ShellTab, type IShellTabPersistentState } from "../shell/ShellTab.js";
import { ConnectionDataModelListener } from "./ConnectionDataModelListener.js";
import type { IDesktopRunState } from "./DocumentToolbar.js";
import { ISchemaDiagramPersistentState, SchemaDiagramDesigner } from "./DiagramDesigner/SchemaDiagramDesigner.js";
import { LakehouseNavigatorTab } from "./LakehouseNavigator.js";
import {
    isClientConnectionError, isLocalOfflineConnectionCandidate, localServerProbeFromBackend,
} from "./OfflineAdministration.js";
import { SidebarCommandHandler } from "./SidebarCommandHandler.js";
import { SimpleEditor } from "./SimpleEditor.js";
import { sendSqlUpdatesFromModel } from "./SqlQueryExecutor.js";
import { resolveNewSqlScript } from "../../utilities/mysql-helpers.js";

const CommunicationDebugger = lazy(async () => {
    return import("../../components/CommunicationDebugger/CommunicationDebugger.js");
});

const desktopRunAccelerators = {
    execute: "CmdOrCtrl+Enter",
    executeCurrent: "Shift+CmdOrCtrl+Enter",
    executeAsText: "Alt+Enter",
} as const;

/**
 * Details generated while adding a new connection workspace. These are used in the render method to fill the
 * workspace page details.
 */
export interface IConnectionWorkspacePage {
    /** The corresponding open document data model entry with further details. */
    dataModelEntry: IOdmConnectionPageEntry;

    /**
     * The corresponding connection data model entry. This is either the shared user connection or the shared
     * service/admin connection for the connection workspace.
     */
    connection: ICdmConnectionEntry;

    /**
     * A flag indicating if the about text that is normally shown on first display of a tab should not be
     * shown.
     */
    suppressAbout: boolean;
}

/**
 * Details for a temporary standalone document tab. Used to show text without a connection, e.g. OCI
 * object configurations.
 */
export interface IDocumentTab {
    /** The corresponding open document data model entry with further details. */
    dataModelEntry: IOdmStandaloneDocumentEntry;

    /** The editor state. */
    savedState: IEditorPersistentState;

    /** The editor model version that was current when the document was last saved. */
    currentVersion: number;
}

/**
 * Details for a shell session tab.
 */
export interface IShellSessionTab {
    /** The corresponding open document data model entry with further details. */
    dataModelEntry: IOdmShellSessionEntry;

    savedState: IShellTabPersistentState;

    /** The workspace that owned this shell session when it was opened. */
    workspaceId?: string;
}

/**
 * Details for a standalone diagram tab. Displays a Entity Relationship Diagram.
 */
export interface ISchemaDiagramTab {
    /** The corresponding open document data model entry with further details. */
    dataModelEntry: IOdmSchemaDiagramEntry;

    /** The diagram state. */
    savedState: ISchemaDiagramPersistentState;

    /** The workspace that owned this diagram when it was opened. */
    workspaceId?: string;
}

type WorkspaceKind = "home" | "general" | "connection" | "debugger";
type WorkspacePageKind = "overview" | "connection" | "connectionDocument" | "document" | "diagram" | "shell"
    | "debugger";

interface IWorkspaceBase {
    id: string;
    kind: WorkspaceKind;
    caption: string;
    pageIds: string[];
}

interface IHomeWorkspace extends IWorkspaceBase {
    kind: "home";
}

interface IGeneralWorkspace extends IWorkspaceBase {
    kind: "general";
}

interface IConnectionWorkspace extends IWorkspaceBase {
    kind: "connection";
    connectionId: number;
    connectionWorkspace?: IConnectionWorkspacePage;
    connectionDetails?: IConnectionDetails;
}

interface IDebuggerWorkspace extends IWorkspaceBase {
    kind: "debugger";
}

type Workspace = IHomeWorkspace | IGeneralWorkspace | IConnectionWorkspace | IDebuggerWorkspace;

interface IWorkspaceTabPage extends ITabviewPage {
    workspaceId: string;
    pageKind: WorkspacePageKind;
    connectionId?: number;
}

interface IConnectionDocumentLocation {
    workspace: IConnectionWorkspacePage;
    connectionState: IConnectionPresentationState;
    documentState: IOpenDocumentState;
}

const homeWorkspaceId = "__workspace_home__";
const generalWorkspaceId = "__workspace_general__";
const debuggerWorkspaceId = "__workspace_debugger__";
const debuggerWorkspacePageId = "__workspace_debugger_page__";

export interface IDocumentModuleState {
    /** All currently open connection workspaces. */
    connectionWorkspaces: IConnectionWorkspacePage[];

    /**
     * All currently open temporary document tabs. Not used when embedded in VS Code as the host app will manage
     * such documents.
     */
    documentTabs: IDocumentTab[];

    /** All currently open Entity-Relationship Diagram tabs */
    schemaDiagramTabs: ISchemaDiagramTab[];

    /** All currently open shell session tabs. */
    shellSessionTabs: IShellSessionTab[];

    sidebarState: Map<string, IDocumentSideBarSectionState>;

    /** The unique id of the active page. */
    selectedPage: string;

    /** The id of the selected top-level workspace in Electron desktop mode. */
    selectedWorkspace: string;

    /** True while the Communication Debugger workspace is visible in Electron desktop mode. */
    debuggerWorkspaceVisible?: boolean;

    /** Set when we need to restore a page selection that was temporarily disabled. */
    lastSelectedPage?: string;

    showSidebar: boolean;
    showTabs: boolean;

    /** Progress indicator support. */
    loading: boolean;

    desktopStoppingWorkspaces: string[];

    progressMessage: string;

    overviewId: string;
}

interface IDocumentModuleProperties {
    contentReplacement?: ComponentChild;
}

export class DocumentModule extends Component<IDocumentModuleProperties, IDocumentModuleState> {
    // The current UI presentation state of the connection.
    private connectionPresentation = new Map<IOdmConnectionPageEntry, IConnectionPresentationState>();

    private workerPool: ExecutionWorkerPool;
    private connectionsDataModel: ConnectionDataModel;

    private latestPagesByConnection = new Map<number, string>();
    private servicePagesByConnection = new Map<number, string>();
    private serviceOnlyConnectionPages = new Set<string>();
    private latestPagesByWorkspace = new Map<string, string>();
    private maxConnectionDocumentSuffix = new Map<number, number>();

    // For unique naming of editors.
    private documentCounter = 0;

    // For unique naming of shell sessions.
    private sessionCounter = 0;

    private pendingProgress: ReturnType<typeof setTimeout> | null = null;

    private containerRef = createRef<HTMLDivElement>();
    private actionMenuRef = createRef<Menu>();
    private desktopTitlebarAddMenuRef = createRef<Menu>();
    private workspaceSelectorRef = createRef<Dropdown>();
    private mrsHubRef = createRef<MrsHub>();
    private jdvHubRef = createRef<JdvHub>();
    private currentConnectionWorkspaceRef = createRef<ConnectionWorkspace>();
    private sideBarRef = createRef<DocumentSideBar>();
    private connectionWorkspaceRefs = new Map<string, ConnectionWorkspace>();
    private createLibraryDialogRef = createRef<CreateLibraryDialog>();
    private sidebarWidth = 250;
    private desktopStatusTimer?: ReturnType<typeof setInterval>;
    private desktopWorkspaceRunStartTimes = new Map<string, number>();
    private pendingVersionCommentLookups = new WeakSet<ICdmConnectionEntry>();

    private documentDataModel: OpenDocumentDataModel;
    private ociDataModel: OciDataModel;
    private shellTaskDataModel: ShellTaskDataModel;

    private dataModelListener: ConnectionDataModelListener;

    private sidebarCommandHandler: SidebarCommandHandler;
    private desktopCommandProvider: IDesktopCommandProvider;

    public constructor(props: {}) {
        super(props);

        this.workerPool = new ExecutionWorkerPool();

        this.connectionsDataModel = new ConnectionDataModel();
        this.connectionsDataModel.autoRouterRefresh = false;
        this.dataModelListener = new ConnectionDataModelListener(this.connectionsDataModel);

        // The document data model does not need to be initialized. It's built dynamically.
        this.documentDataModel = new OpenDocumentDataModel();

        // Ditto for the shell task data model.
        this.shellTaskDataModel = new ShellTaskDataModel();

        this.ociDataModel = new OciDataModel();

        const promises: Array<Promise<void>> = [
            this.connectionsDataModel.initialize(),
            this.ociDataModel.initialize(),
        ];

        void Promise.all(promises).then(() => {
            this.setState({ loading: false });
        });

        this.sidebarCommandHandler = new SidebarCommandHandler(
            this.connectionsDataModel, this.mrsHubRef, this.createLibraryDialogRef, this.jdvHubRef);
        this.desktopCommandProvider = {
            getCommands: this.getDesktopCommandState,
            execute: this.executeDesktopCommand,
        };

        this.state = {
            selectedPage: "",
            selectedWorkspace: homeWorkspaceId,
            debuggerWorkspaceVisible: false,
            connectionWorkspaces: [],
            documentTabs: [],
            schemaDiagramTabs: [],
            shellSessionTabs: [],
            sidebarState: new Map<string, IDocumentSideBarSectionState>(),
            showSidebar: true,
            showTabs: true,
            loading: true,
            desktopStoppingWorkspaces: [],
            progressMessage: "",
            overviewId: this.documentDataModel.overview.id,
        };
    }

    public static override getDerivedStateFromProps(props: {},
        state: IDocumentModuleState): Partial<IDocumentModuleState> {

        const { selectedPage, loading } = state;

        let newSelection = selectedPage;
        if (!newSelection && !loading) {
            newSelection = state.overviewId;
        }

        const newState = {
            selectedPage: newSelection,
        };

        return newState;
    }

    public override componentDidMount(): void {
        desktopCommandRegistry.registerProvider(this.desktopCommandProvider);
        requisitions.register("showPage", this.showPage);
        requisitions.register("openDocument", this.handleOpenDocument);
        requisitions.register("openConnectionWorkspace", this.openConnectionWorkspace);
        requisitions.register("sqlSetCurrentSchema", this.setCurrentSchema);
        requisitions.register("editorRunCommand", this.runCommand);
        requisitions.register("editorSaved", this.editorSaved);
        requisitions.register("closeDocument", this.handleCloseDocument);
        requisitions.register("selectDocument", this.handleSelectDocument);
        requisitions.register("createNewEditor", this.createNewEditor);
        requisitions.register("profileLoaded", this.profileLoaded);
        requisitions.register("webSessionStarted", this.webSessionStarted);
        requisitions.register("desktopWindowCloseRequested", this.handleDesktopWindowCloseRequested);
        requisitions.register("selectFile", this.selectFile);

        requisitions.register("connectionAdded", this.dataModelListener.handleConnectionAdded);
        requisitions.register("connectionUpdated", this.dataModelListener.handleConnectionUpdated);
        requisitions.register("connectionRemoved", this.dataModelListener.handleConnectionRemoved);
        requisitions.register("refreshConnection", this.dataModelListener.handleRefreshConnection);
        requisitions.register("removeSession", this.removeSession);

        requisitions.register("showMrsDbObjectDialog", this.showMrsDbObjectDialog);
        requisitions.register("showMrsServiceDialog", this.showMrsServiceDialog);
        requisitions.register("showMrsSchemaDialog", this.showMrsSchemaDialog);
        requisitions.register("showMrsContentSetDialog", this.showMrsContentSetDialog);
        requisitions.register("showMrsAuthAppDialog", this.showMrsAuthAppDialog);
        requisitions.register("showMrsUserDialog", this.showMrsUserDialog);
        requisitions.register("showMrsSdkExportDialog", this.showMrsSdkExportDialog);
        requisitions.register("showMrsConfigurationDialog", this.showMrsConfigurationDialog);
        requisitions.register("showCreateLibraryDialog", this.showCreateLibraryDialog);

        requisitions.register("openSession", this.openSession);
        requisitions.register("socketStateChanged", this.connectionStateChanged);

        requisitions.register("showJdvObjectDialog", this.showJdvObjectDialog);
        requisitions.register("settingsChanged", this.handleSettingsChanged);

        void ConnectionTags.load().then(() => {
            this.forceUpdate();
        });

        if (this.containerRef.current) {
            this.containerRef.current.addEventListener("keydown", this.handleKeyPress);
        }

        this.syncDesktopStatusTimer();
        this.syncDesktopDirtyState();
        void this.ensureActiveWorkspaceVersionComment();
    }

    public override componentWillUnmount(): void {
        this.stopDesktopStatusTimer();
        this.desktopWorkspaceRunStartTimes.clear();

        desktopCommandRegistry.unregisterProvider(this.desktopCommandProvider);

        if (this.containerRef.current) {
            this.containerRef.current.removeEventListener("keydown", this.handleKeyPress);
        }

        requisitions.unregister("showPage", this.showPage);
        requisitions.unregister("openDocument", this.handleOpenDocument);
        requisitions.unregister("openConnectionWorkspace", this.openConnectionWorkspace);
        requisitions.unregister("sqlSetCurrentSchema", this.setCurrentSchema);
        requisitions.unregister("editorRunCommand", this.runCommand);
        requisitions.unregister("editorSaved", this.editorSaved);
        requisitions.unregister("closeDocument", this.handleCloseDocument);
        requisitions.unregister("selectDocument", this.handleSelectDocument);
        requisitions.unregister("createNewEditor", this.createNewEditor);
        requisitions.unregister("profileLoaded", this.profileLoaded);
        requisitions.unregister("webSessionStarted", this.webSessionStarted);
        requisitions.unregister("desktopWindowCloseRequested", this.handleDesktopWindowCloseRequested);
        requisitions.unregister("selectFile", this.selectFile);

        requisitions.unregister("connectionAdded", this.dataModelListener.handleConnectionAdded);
        requisitions.unregister("connectionUpdated", this.dataModelListener.handleConnectionUpdated);
        requisitions.unregister("connectionRemoved", this.dataModelListener.handleConnectionRemoved);
        requisitions.unregister("refreshConnection", this.dataModelListener.handleRefreshConnection);
        requisitions.unregister("removeSession", this.removeSession);

        requisitions.unregister("showMrsDbObjectDialog", this.showMrsDbObjectDialog);
        requisitions.unregister("showMrsServiceDialog", this.showMrsServiceDialog);
        requisitions.unregister("showMrsSchemaDialog", this.showMrsSchemaDialog);
        requisitions.unregister("showMrsContentSetDialog", this.showMrsContentSetDialog);
        requisitions.unregister("showMrsAuthAppDialog", this.showMrsAuthAppDialog);
        requisitions.unregister("showMrsUserDialog", this.showMrsUserDialog);
        requisitions.unregister("showMrsSdkExportDialog", this.showMrsSdkExportDialog);
        requisitions.unregister("showMrsConfigurationDialog", this.showMrsConfigurationDialog);
        requisitions.unregister("showCreateLibraryDialog", this.showCreateLibraryDialog);

        requisitions.unregister("openSession", this.openSession);
        requisitions.unregister("socketStateChanged", this.connectionStateChanged);

        requisitions.unregister("showJdvObjectDialog", this.showJdvObjectDialog);
        requisitions.unregister("settingsChanged", this.handleSettingsChanged);
    }

    public override componentDidUpdate(_previousProps: {}, previousState: IDocumentModuleState): void {
        if (previousState.selectedPage !== this.state.selectedPage) {
            this.rememberWorkspaceSelection(this.state.selectedPage);
        }

        if (previousState.selectedPage !== this.state.selectedPage
            || previousState.selectedWorkspace !== this.state.selectedWorkspace
            || previousState.connectionWorkspaces !== this.state.connectionWorkspaces
            || previousState.desktopStoppingWorkspaces !== this.state.desktopStoppingWorkspaces
            || previousState.debuggerWorkspaceVisible !== this.state.debuggerWorkspaceVisible
            || previousState.loading !== this.state.loading) {
            desktopCommandRegistry.notifyHostStateChanged();
        }

        this.syncDesktopWorkspaceStoppingState();
        this.syncDesktopStatusTimer();

        if (previousState.selectedPage !== this.state.selectedPage
            || previousState.selectedWorkspace !== this.state.selectedWorkspace
            || previousState.connectionWorkspaces !== this.state.connectionWorkspaces
            || previousState.loading !== this.state.loading) {
            void this.ensureActiveWorkspaceVersionComment();
        }

        this.syncDesktopDirtyState();
    }

    private isElectronWorkspaceLayout = (): boolean => {
        return hasElectronHostBridge();
    };

    private stopDesktopStatusTimer = (): void => {
        if (this.desktopStatusTimer) {
            clearInterval(this.desktopStatusTimer);
            this.desktopStatusTimer = undefined;
        }
    };

    private syncDesktopDirtyState = (): void => {
        if (!hasElectronHostBridge()) {
            return;
        }

        window.electronHost?.postMessage({
            source: "app",
            command: "desktopWindowDirtyStateChanged",
            data: {
                dirty: this.hasUnsavedDocuments(),
            },
        });
    };

    private isDesktopWorkspaceBusy = (
        workspaceId = this.getResolvedSelectedWorkspaceId(),
        executionContext = this.getActiveDesktopExecutionContext(),
    ): boolean => {
        return this.isDesktopWorkspaceStopping(workspaceId) || executionContext?.desktopRunState?.canStop === true;
    };

    private syncDesktopStatusTimer = (): void => {
        if (!this.isElectronWorkspaceLayout() || !this.isDesktopWorkspaceBusy()) {
            this.stopDesktopStatusTimer();

            return;
        }

        if (!this.desktopStatusTimer) {
            this.desktopStatusTimer = setInterval(() => {
                if (!this.isDesktopWorkspaceBusy()) {
                    this.stopDesktopStatusTimer();

                    return;
                }

                this.forceUpdate();
            }, 1000);
        }
    };

    private getDesktopStatusTimerCaption = (workspaceId: string, isBusy: boolean): string | undefined => {
        if (!isBusy) {
            this.desktopWorkspaceRunStartTimes.delete(workspaceId);

            return undefined;
        }

        let startTime = this.desktopWorkspaceRunStartTimes.get(workspaceId);
        if (startTime === undefined) {
            startTime = Date.now();
            this.desktopWorkspaceRunStartTimes.set(workspaceId, startTime);
        }

        return formatTime(Math.round((Date.now() - startTime) / 1000));
    };

    private getConnectionWorkspaceId = (connectionId: number, pageId?: string): string => {
        return pageId ? `connection:${connectionId}:${pageId}` : `connection:${connectionId}`;
    };

    private isDesktopWorkspaceStopping = (workspaceId?: string): boolean => {
        return workspaceId !== undefined && this.state.desktopStoppingWorkspaces.includes(workspaceId);
    };

    private setDesktopWorkspaceStopping = (workspaceId: string | undefined, stopping: boolean): void => {
        if (!workspaceId || !this.isElectronWorkspaceLayout()) {
            return;
        }

        const isStopping = this.state.desktopStoppingWorkspaces.includes(workspaceId);
        if (isStopping === stopping) {
            return;
        }

        this.setState((previousState) => {
            const desktopStoppingWorkspaces = stopping
                ? [...previousState.desktopStoppingWorkspaces, workspaceId]
                : previousState.desktopStoppingWorkspaces.filter((entry) => {
                    return entry !== workspaceId;
                });

            return { desktopStoppingWorkspaces };
        });
    };

    private syncDesktopWorkspaceStoppingState = (
        workspaceId = this.getResolvedSelectedWorkspaceId(),
        executionContext = this.getActiveDesktopExecutionContext(),
    ): void => {
        if (!workspaceId || !this.isDesktopWorkspaceStopping(workspaceId)) {
            return;
        }

        if (executionContext?.desktopRunState?.canStop === true) {
            return;
        }

        this.setDesktopWorkspaceStopping(workspaceId, false);
    };

    private getActiveEditorExecutionContext = (activeDocumentState?: IOpenDocumentState): ExecutionContext | undefined => {
        const executionContexts = activeDocumentState?.state?.model.executionContexts;
        if (!executionContexts) {
            return undefined;
        }

        return executionContexts.contextFromPosition(executionContexts.cursorPosition);
    };

    private getDesktopFlag = (value: unknown, fallback = false): boolean => {
        return value === undefined ? fallback : value === true || value === 1;
    };

    private canCurrentTabClose = async (): Promise<boolean> => {
        return typeof this.currentConnectionWorkspaceRef.current?.canClose === "function"
            ? await this.currentConnectionWorkspaceRef.current.canClose()
            : true;
    };

    private getEffectiveDesktopRunState = (
        activeDocumentState?: IOpenDocumentState,
        fallbackRunState?: IDesktopRunState,
        workspaceId = this.getResolvedSelectedWorkspaceId(),
    ): IDesktopRunState | undefined => {
        const activeEditorExecutionContext = this.getActiveEditorExecutionContext(activeDocumentState);
        const desktopRunState = activeEditorExecutionContext
            ? {
                canExecute: activeEditorExecutionContext.loadingState === LoadingState.Idle,
                canExecuteSubparts: activeEditorExecutionContext.isSQLLike,
                canStop: activeEditorExecutionContext.loadingState !== LoadingState.Idle,
                autoCommit: fallbackRunState?.autoCommit ?? true,
                transactionOpen: fallbackRunState?.transactionOpen ?? false,
                stopOnErrors: fallbackRunState?.stopOnErrors ?? Settings.get("editor.stopOnErrors", true),
            }
            : fallbackRunState;

        if (!desktopRunState) {
            return undefined;
        }

        const normalizedRunState = {
            ...desktopRunState,
            autoCommit: this.getDesktopFlag(desktopRunState.autoCommit, true),
            transactionOpen: this.getDesktopFlag(desktopRunState.transactionOpen),
        };

        if (this.isDesktopWorkspaceStopping(workspaceId)) {
            return {
                ...normalizedRunState,
                canExecute: false,
                canStop: false,
            };
        }

        return normalizedRunState;
    };

    private rememberWorkspaceSelection = (pageId: string | undefined, state: IDocumentModuleState = this.state): void => {
        const workspaceId = this.getWorkspaceIdForPageId(pageId, state);
        if (pageId && workspaceId) {
            this.latestPagesByWorkspace.set(workspaceId, pageId);
        }
    };

    private getWorkspaces = (state: IDocumentModuleState = this.state): Workspace[] => {
        const workspaces: Workspace[] = [
            {
                id: homeWorkspaceId,
                kind: "home",
                caption: "Home",
                pageIds: [this.documentDataModel.overview.id],
            },
        ];

        const generalPageIds = state.documentTabs.map((info) => {
            return info.dataModelEntry.id;
        });
        state.schemaDiagramTabs.forEach((info) => {
            if (!info.dataModelEntry.connection?.id) {
                generalPageIds.push(info.dataModelEntry.id);
            }
        });
        state.shellSessionTabs.forEach((info) => {
            if (!info.dataModelEntry.details.dbConnectionId) {
                generalPageIds.push(info.dataModelEntry.id);
            }
        });

        if (generalPageIds.length > 0) {
            workspaces.push({
                id: generalWorkspaceId,
                kind: "general",
                caption: "General",
                pageIds: generalPageIds,
            });
        }

        if (state.debuggerWorkspaceVisible === true) {
            workspaces.push({
                id: debuggerWorkspaceId,
                kind: "debugger",
                caption: "Communication Debugger",
                pageIds: [debuggerWorkspacePageId],
            });
        }

        const connectionWorkspacesById = new Map<string, IConnectionWorkspace>();
        const latestConnectionWorkspaces = new Map<number, IConnectionWorkspace>();
        state.connectionWorkspaces.forEach((info) => {
            const connectionId = info.connection.details.id;
            const pageId = info.dataModelEntry.id;
            const workspace: IConnectionWorkspace = {
                id: this.getConnectionWorkspaceId(connectionId, pageId),
                kind: "connection",
                caption: info.dataModelEntry.caption,
                connectionId,
                connectionWorkspace: info,
                connectionDetails: info.connection.details,
                pageIds: [pageId],
            };

            connectionWorkspacesById.set(workspace.id, workspace);
            latestConnectionWorkspaces.set(connectionId, workspace);
            workspaces.push(workspace);
        });

        const addConnectionPage = (connectionId: number, pageId: string, caption: string,
            connectionDetails?: IConnectionDetails, workspaceId?: string): void => {
            let workspace = workspaceId ? connectionWorkspacesById.get(workspaceId) : undefined;
            workspace ??= latestConnectionWorkspaces.get(connectionId);
            if (!workspace) {
                workspace = {
                    id: this.getConnectionWorkspaceId(connectionId),
                    kind: "connection",
                    caption,
                    connectionId,
                    connectionDetails,
                    pageIds: [],
                };
                connectionWorkspacesById.set(workspace.id, workspace);
                latestConnectionWorkspaces.set(connectionId, workspace);
                workspaces.push(workspace);
            } else {
                const shouldRefreshCaption = (workspace.connectionDetails === undefined
                    && connectionDetails !== undefined)
                    || workspace.caption.startsWith("Connection ");
                workspace.connectionDetails ??= connectionDetails;
                if (shouldRefreshCaption && caption.length > 0) {
                    workspace.caption = caption;
                }
            }

            if (!workspace.pageIds.includes(pageId)) {
                workspace.pageIds.push(pageId);
            }
        };

        state.schemaDiagramTabs.forEach((info) => {
            const connectionDetails = info.dataModelEntry.connection;
            if (connectionDetails) {
                addConnectionPage(
                    connectionDetails.id,
                    info.dataModelEntry.id,
                    connectionDetails.caption,
                    connectionDetails,
                    info.workspaceId,
                );
            }
        });

        state.shellSessionTabs.forEach((info) => {
            const connectionId = info.dataModelEntry.details.dbConnectionId;
            if (!connectionId) {
                return;
            }

            const caption = info.dataModelEntry.caption.replace(/^Session to /, "") || `Connection ${connectionId}`;
            addConnectionPage(connectionId, info.dataModelEntry.id, caption, undefined, info.workspaceId);
        });

        return workspaces;
    };

    private getWorkspaceById = (
        workspaceId: string | undefined,
        state: IDocumentModuleState = this.state,
        workspaces: Workspace[] = this.getWorkspaces(state),
    ): Workspace | undefined => {
        if (!workspaceId) {
            return undefined;
        }

        return workspaces.find((workspace) => {
            return workspace.id === workspaceId;
        });
    };

    private getWorkspaceForPageId = (
        pageId: string | undefined,
        state: IDocumentModuleState = this.state,
        workspaces: Workspace[] = this.getWorkspaces(state),
    ): Workspace | undefined => {
        if (!pageId) {
            return undefined;
        }

        return workspaces.find((workspace) => {
            return workspace.pageIds.includes(pageId);
        });
    };

    private getWorkspaceIdForPageId = (pageId: string | undefined, state: IDocumentModuleState = this.state):
        string | undefined => {
        return this.getWorkspaceForPageId(pageId, state)?.id;
    };

    private getWorkspacePageIds = (
        workspaceId: string,
        state: IDocumentModuleState = this.state,
        workspaces: Workspace[] = this.getWorkspaces(state),
    ): string[] => {
        return this.getWorkspaceById(workspaceId, state, workspaces)?.pageIds ?? [];
    };

    private getResolvedSelectedWorkspace = (
        state: IDocumentModuleState = this.state,
        workspaces: Workspace[] = this.getWorkspaces(state),
    ): Workspace => {
        const pageWorkspace = this.getWorkspaceForPageId(state.selectedPage, state, workspaces);
        if (!this.isElectronWorkspaceLayout()) {
            return pageWorkspace ?? workspaces[0]!;
        }

        if (pageWorkspace && pageWorkspace.kind !== "home" && pageWorkspace.id !== state.selectedWorkspace) {
            return pageWorkspace;
        }

        return this.getWorkspaceById(state.selectedWorkspace, state, workspaces) ?? pageWorkspace ?? workspaces[0]!;
    };

    private getResolvedSelectedWorkspaceId = (
        state: IDocumentModuleState = this.state,
        workspaces: Workspace[] = this.getWorkspaces(state),
    ): string => {
        return this.getResolvedSelectedWorkspace(state, workspaces).id;
    };

    private getVisiblePageIdForWorkspace = (workspaceId: string, state: IDocumentModuleState = this.state):
        string | undefined => {
        const workspace = this.getWorkspaceById(workspaceId, state);
        if (!workspace) {
            return undefined;
        }

        if (workspace.kind === "home") {
            return this.documentDataModel.overview.id;
        }

        const { pageIds } = workspace;
        if (pageIds.length === 0) {
            return undefined;
        }

        if (pageIds.includes(state.selectedPage)) {
            return state.selectedPage;
        }

        const rememberedPageId = this.latestPagesByWorkspace.get(workspaceId);
        if (rememberedPageId && pageIds.includes(rememberedPageId)) {
            return rememberedPageId;
        }

        if (workspace.kind === "connection") {
            const latestConnectionPageId = this.latestPagesByConnection.get(workspace.connectionId);
            if (latestConnectionPageId && pageIds.includes(latestConnectionPageId)) {
                return latestConnectionPageId;
            }

            if (workspace.connectionWorkspace) {
                return workspace.connectionWorkspace.dataModelEntry.id;
            }
        }

        return pageIds[pageIds.length - 1];
    };

    private getVisiblePageId = (state: IDocumentModuleState = this.state): string | undefined => {
        if (!this.isElectronWorkspaceLayout()) {
            return state.selectedPage || undefined;
        }

        const workspaceId = this.getResolvedSelectedWorkspaceId(state);

        return this.getVisiblePageIdForWorkspace(workspaceId, state);
    };

    private getWorkspaceConnectionDetails = (workspace?: Workspace): IConnectionDetails | undefined => {
        return workspace?.kind === "connection"
            ? workspace.connectionWorkspace?.connection.details ?? workspace.connectionDetails
            : undefined;
    };

    private getConnectionWorkspaceTags = (connectionDetails?: IConnectionDetails): Array<{
        caption: string;
        backgroundColor: string;
        foregroundColor: string;
    }> => {
        const tags = connectionDetails?.tags
            ?? (connectionDetails?.settings?.badge ? [connectionDetails.settings.badge] : []);
        if (tags.length === 0) {
            return [];
        }

        const badges = ConnectionTags.getCached();

        return tags.flatMap((tag) => {
            const color = badges[tag];
            if (typeof color !== "string" || color.length === 0) {
                return [];
            }

            return [{
                caption: tag,
                backgroundColor: color,
                foregroundColor: ConnectionTags.foreground(color),
            }];
        });
    };

    private handleSettingsChanged = (entry?: { key: string; value: unknown; }): boolean => {
        if (entry?.key !== connectionTagsChangedKey) {
            return false;
        }

        ConnectionTags.updateCache(entry.value);
        this.forceUpdate();

        return true;
    };

    private getDocumentSidebarMode = (workspace?: Workspace): DocumentSideBarMode => {
        if (!this.isElectronWorkspaceLayout() || !workspace) {
            return "classic";
        }

        switch (workspace.kind) {
            case "home": {
                return "electronHome";
            }

            case "general": {
                return "electronGeneral";
            }

            case "debugger": {
                return "electronGeneral";
            }

            case "connection": {
                return "electronConnection";
            }
        }
    };

    private getClosablePageId = (state: IDocumentModuleState = this.state): string | undefined => {
        const pageId = this.getVisiblePageId(state);

        return pageId && pageId !== this.documentDataModel.overview.id ? pageId : undefined;
    };

    private getClosableDocumentId = (state: IDocumentModuleState = this.state): string | undefined => {
        const pageId = this.getVisiblePageId(state);
        if (!pageId || pageId === this.documentDataModel.overview.id) {
            return undefined;
        }

        const connectionWorkspace = state.connectionWorkspaces.find((candidate) => {
            return candidate.dataModelEntry.id === pageId;
        });
        if (!connectionWorkspace) {
            return pageId;
        }

        const connectionState = this.connectionPresentation.get(connectionWorkspace.dataModelEntry);

        return connectionState?.activeEntry ?? connectionState?.documentStates[0]?.document.id;
    };

    private openConsoleForCurrentWorkspace = async (): Promise<void> => {
        const workspace = this.getResolvedSelectedWorkspace();
        const connectionId = workspace.kind === "connection" ? workspace.connectionId : undefined;
        const caption = workspace.caption;

        await this.activateShellTab(uuid(), connectionId, connectionId !== undefined ? caption : undefined);
    };

    private getActiveConnectionWorkspace = (state: IDocumentModuleState = this.state): IConnectionWorkspacePage | undefined => {
        const visiblePageId = this.getVisiblePageId(state);
        const selectedConnectionWorkspace = state.connectionWorkspaces.find((candidate) => {
            return candidate.dataModelEntry.id === visiblePageId;
        });
        if (selectedConnectionWorkspace) {
            return selectedConnectionWorkspace;
        }

        const workspace = this.getResolvedSelectedWorkspace(state);
        if (workspace.kind !== "connection") {
            return undefined;
        }

        const latestConnectionPageId = this.latestPagesByConnection.get(workspace.connectionId);

        return state.connectionWorkspaces.find((candidate) => {
            return candidate.dataModelEntry.id === latestConnectionPageId
                && candidate.connection.details.id === workspace.connectionId;
        }) ?? state.connectionWorkspaces.find((candidate) => {
            return candidate.connection.details.id === workspace.connectionId;
        });
    };

    private getActiveWorkspaceConnectionEntry = (
        state: IDocumentModuleState = this.state,
    ): ICdmConnectionEntry | undefined => {
        const activeConnectionWorkspace = this.getActiveConnectionWorkspace(state);
        if (activeConnectionWorkspace) {
            return activeConnectionWorkspace.connection;
        }

        const workspace = this.getResolvedSelectedWorkspace(state);
        if (workspace.kind !== "connection") {
            return undefined;
        }

        const findConnection = (
            entries: ReadonlyArray<ICdmConnectionEntry | ICdmConnectionGroupEntry>,
        ): ICdmConnectionEntry | undefined => {
            for (const entry of entries) {
                if (entry.type === CdmEntityType.ConnectionGroup) {
                    const match = findConnection(entry.entries);
                    if (match) {
                        return match;
                    }
                } else if (entry.details.id === workspace.connectionId) {
                    return entry;
                }
            }

            return undefined;
        };

        return findConnection(this.connectionsDataModel.roots);
    };

    private getSidebarWorkspaceConnectionEntry = (
        state: IDocumentModuleState = this.state,
    ): ICdmConnectionEntry | undefined => {
        const activeConnectionWorkspace = this.getActiveConnectionWorkspace(state);
        if (activeConnectionWorkspace
            && !this.isServiceConnectionPage(activeConnectionWorkspace.dataModelEntry.id)) {
            return activeConnectionWorkspace.connection;
        }

        const activeConnection = this.getActiveWorkspaceConnectionEntry(state);
        const userConnectionPageId = activeConnection
            ? this.resolveLatestPageId(activeConnection)
            : undefined;
        const userConnectionWorkspace = state.connectionWorkspaces.find((candidate) => {
            return candidate.dataModelEntry.id === userConnectionPageId;
        });

        return userConnectionWorkspace?.connection ?? activeConnection;
    };

    private handleConnectionWorkspaceRef = (pageId: string, workspaceRef: ConnectionWorkspace | null): void => {
        if (workspaceRef) {
            this.connectionWorkspaceRefs.set(pageId, workspaceRef);
        } else {
            this.connectionWorkspaceRefs.delete(pageId);
        }

        if (this.state.selectedPage === pageId) {
            this.currentConnectionWorkspaceRef.current = workspaceRef;
        } else if (!workspaceRef && this.currentConnectionWorkspaceRef.current?.props?.id === pageId) {
            this.currentConnectionWorkspaceRef.current = null;
        }
    };

    private getSelectedConnectionWorkspaceRef = (state: IDocumentModuleState = this.state): ConnectionWorkspace | null => {
        const selectedConnectionWorkspace = state.connectionWorkspaces.find((candidate) => {
            return candidate.dataModelEntry.id === state.selectedPage;
        });

        if (!selectedConnectionWorkspace) {
            return null;
        }

        const selectedPageId = selectedConnectionWorkspace.dataModelEntry.id;
        const currentWorkspaceRef = this.currentConnectionWorkspaceRef.current;

        return this.connectionWorkspaceRefs.get(selectedPageId)
            ?? (currentWorkspaceRef && (!currentWorkspaceRef.props || currentWorkspaceRef.props.id === selectedPageId)
                ? currentWorkspaceRef
                : null);
    };

    private findConnectionDocumentLocation = (
        documentId: string,
        state: IDocumentModuleState = this.state,
    ): IConnectionDocumentLocation | undefined => {
        for (const workspace of state.connectionWorkspaces) {
            const connectionState = this.connectionPresentation.get(workspace.dataModelEntry);
            if (!connectionState) {
                continue;
            }

            const documentState = connectionState.documentStates.find((entry) => {
                return entry.document.id === documentId;
            });
            if (documentState) {
                return {
                    workspace,
                    connectionState,
                    documentState,
                };
            }
        }

        return undefined;
    };

    private buildConnectionWorkspacePages = (
        page: IWorkspaceTabPage,
        info: IConnectionWorkspacePage,
        connectionState: IConnectionPresentationState,
    ): IWorkspaceTabPage[] => {
        if (connectionState.documentStates.length === 0) {
            return [page];
        }

        return connectionState.documentStates.map((documentState) => {
            const pageCaption = this.getWorkspaceDocumentPageCaption(info, connectionState, documentState);
            const tooltip = `${getOpenDocumentDisplayCaption(documentState, {
                connectionCaption: info.connection.details.caption,
                pageCaption,
            })} - ${info.connection.details.caption}`;

            return {
                ...page,
                id: documentState.document.id,
                icon: this.getConnectionWorkspaceIcon(documentState),
                caption: this.getConnectionWorkspaceCaption(
                    documentState,
                    info.connection.details.caption,
                    pageCaption,
                ),
                tooltip,
                auxiliary: (
                    <Button
                        id={documentState.document.id}
                        className={this.getTabCloseButtonClassName(documentState)}
                        round={true}
                        onClick={this.handleCloseTab}
                    >
                        {this.renderTabCloseButtonContent(documentState)}
                    </Button>
                ),
                pageKind: "connectionDocument",
            };
        });
    };

    private getWorkspaceDocumentPageCaption = (
        info: IConnectionWorkspacePage,
        connectionState: IConnectionPresentationState,
        documentState: IOpenDocumentState,
    ): string => {
        const connectionCaption = info.connection.details.caption;
        const pageOffset = getUntitledFileIndex(connectionCaption, info.dataModelEntry.caption);
        const documentIndex = connectionState.documentStates.findIndex((entry) => {
            return entry.document.id === documentState.document.id;
        });
        const captionIndex = Math.max(pageOffset + Math.max(documentIndex, 0), 0);

        return captionIndex === 0
            ? connectionCaption
            : `${connectionCaption} (${captionIndex + 1})`;
    };

    private formatConnectionWorkspaceTarget = (details: IConnectionDetails): string | undefined => {
        if (details.dbType === DBType.MySQL) {
            const options = details.options as IMySQLConnectionOptions;
            const host = options.host;
            const user = options.user;
            const port = options.socket ? undefined : options.port;
            const hostAndPort = host && Number.isFinite(port) ? `${host}:${port}` : host;
            const tunnelLabel = details.useSSH || options.ssh
                ? " (SSH)"
                : details.useMHS || options["mysql-db-system-id"] ? " (Bastion)" : "";

            if (user && hostAndPort) {
                return `${user}@${hostAndPort}${tunnelLabel}`;
            }

            return (user ?? hostAndPort) + tunnelLabel;
        }

        return details.caption;
    };

    private formatConnectionWorkspaceVersion = (details: IConnectionDetails): string | undefined => {
        const versionComment = details.versionComment?.trim();
        if (details.version === undefined || !Number.isFinite(details.version)) {
            if (details.dbType === DBType.MySQL && versionComment) {
                return versionComment;
            }

            return undefined;
        }

        const major = Math.floor(details.version / 10000);
        const minor = Math.floor(details.version / 100) % 100;
        const patch = details.version % 100;
        const version = `${major}.${minor}.${patch}`;

        if (details.dbType === DBType.MySQL && versionComment) {
            return versionComment === "MySQL"
                ? `${versionComment} ${version}`
                : `${versionComment} (${version})`;
        }

        const prefix = details.dbType === DBType.Sqlite ? "SQLite" : "MySQL";

        return `${prefix} ${version}`;
    };

    private formatConnectionInfo = (connection?: ICdmConnectionEntry): string | undefined => {
        const parts: string[] = [];
        if (connection?.userConnectionId !== undefined) {
            parts.push(`User connection ID: ${connection.userConnectionId}`);
        }
        if (connection?.serviceConnectionId !== undefined) {
            parts.push(`Service connection ID: ${connection.serviceConnectionId}`);
        }

        return parts.length > 0 ? parts.join("\n") : undefined;
    };

    private formatConnectionInfoBadge = (connection?: ICdmConnectionEntry): string | undefined => {
        const parts: string[] = [];
        if (connection?.userConnectionId !== undefined) {
            parts.push(`U:${connection.userConnectionId}`);
        }
        if (connection?.serviceConnectionId !== undefined) {
            parts.push(`S:${connection.serviceConnectionId}`);
        }

        return parts.length > 0 ? `Conn: ${parts.join(" ")}` : undefined;
    };

    private formatConnectionWorkspaceStatus = (connectionWorkspace?: IConnectionWorkspacePage, isExecuting = false): string | undefined => {
        if (!connectionWorkspace) {
            return undefined;
        }

        if (connectionWorkspace.connection.isOpen === false) {
            return "Disconnected";
        }

        if (isExecuting) {
            return "Executing SQL";
        }

        return "Connected";
    };

    private ensureActiveWorkspaceVersionComment = async (): Promise<void> => {
        if (!this.isElectronWorkspaceLayout() || this.state.loading) {
            return;
        }

        const connection = this.getActiveConnectionWorkspace()?.connection;
        const details = connection?.details;
        if (!connection || !details || details.dbType !== DBType.MySQL || !connection.isOpen
            || details.versionComment?.trim()) {
            return;
        }

        if (this.pendingVersionCommentLookups.has(connection)
            || typeof connection.backend?.executeService !== "function") {
            return;
        }

        this.pendingVersionCommentLookups.add(connection);

        try {
            const result = await connection.backend.executeService("SELECT @@version_comment");
            const firstRow = result?.rows?.[0];
            const versionCommentValue = Array.isArray(firstRow) ? firstRow[0] : undefined;
            const versionComment = String(versionCommentValue ?? "").trim();

            if (!versionComment) {
                return;
            }

            connection.details.versionComment = versionComment;

            const stillOpen = this.state.connectionWorkspaces.some((workspace) => {
                return workspace.connection === connection;
            });
            if (stillOpen) {
                this.forceUpdate();
            }
        } catch {
            // Ignore missing version_comment fallback failures and keep the numeric version label.
        } finally {
            this.pendingVersionCommentLookups.delete(connection);
        }
    };

    private activateWorkspace = async (workspaceId: string): Promise<void> => {
        const canClose = await this.canCurrentTabClose();
        if (!canClose) {
            return;
        }

        if (workspaceId === homeWorkspaceId) {
            this.setState({ selectedWorkspace: homeWorkspaceId }, this.showOverview);

            return;
        }

        const visiblePageId = this.getVisiblePageIdForWorkspace(workspaceId);

        if (visiblePageId) {
            if (visiblePageId === this.state.selectedPage) {
                this.setState({ selectedWorkspace: workspaceId });
            } else {
                this.setState({ selectedWorkspace: workspaceId }, () => {
                    this.doSwitchTab(visiblePageId);
                });
            }
        } else {
            this.setState({
                selectedWorkspace: workspaceId,
                selectedPage: this.documentDataModel.overview.id,
            });
        }
    };

    private handleWorkspaceSelection = async (_accept: boolean, ids: Set<string>): Promise<void> => {
        const workspaceId = ids.values().next().value as string | undefined;
        if (!workspaceId) {
            return;
        }

        await this.activateWorkspace(workspaceId);
    };

    private toggleCommunicationDebuggerWorkspace = async (): Promise<boolean> => {
        if (!this.isElectronWorkspaceLayout() || webSession.runMode !== RunMode.LocalUser) {
            return false;
        }

        if (this.state.debuggerWorkspaceVisible === true) {
            const leavingDebuggerWorkspace = this.getResolvedSelectedWorkspaceId() === debuggerWorkspaceId;
            this.setState({
                debuggerWorkspaceVisible: false,
                selectedWorkspace: leavingDebuggerWorkspace ? homeWorkspaceId : this.state.selectedWorkspace,
                selectedPage: leavingDebuggerWorkspace ? this.documentDataModel.overview.id : this.state.selectedPage,
            });

            return true;
        }

        if (!await this.canCurrentTabClose()) {
            return true;
        }

        this.setState({
            debuggerWorkspaceVisible: true,
            selectedWorkspace: debuggerWorkspaceId,
            selectedPage: debuggerWorkspacePageId,
        });

        return true;
    };

    public override render(): ComponentChild {
        const {
            selectedPage, connectionWorkspaces, documentTabs, schemaDiagramTabs, shellSessionTabs, sidebarState, showSidebar,
            showTabs, loading, progressMessage,
        } = this.state;
        const electronWorkspaceLayout = this.isElectronWorkspaceLayout();

        let sqlIcon = Assets.file.mysqlIcon;
        const isEmbedded = appParameters.embedded;

        // Generate the main toolbar items based on the current display mode.
        const toolbarItems: IToolbarItems = { navigation: [], execution: [], editor: [], auxiliary: [] };
        connectionWorkspaces.forEach((info: IConnectionWorkspacePage) => {
            const page = info.dataModelEntry;
            const connectionState = this.connectionPresentation.get(page)!;

            // TODO(rennox): unexpected that the state is undefined,
            // even so it happens, requires investigation
            if (!connectionState) {
                return;
            }
            connectionState.documentStates.forEach((entry) => {
                if (selectedPage === page.id && entry.document.id === connectionState.activeEntry) {
                    if (page.details.dbType === DBType.Sqlite) {
                        sqlIcon = Assets.file.sqliteIcon;
                    }
                }
            });
        });

        if (selectedPage === this.documentDataModel.overview.id) {
            toolbarItems.navigation.push(
                <Button
                    key="button1"
                    id="newConsoleMenuButton"
                    data-tooltip="Open New Shell Console"
                    style={{ marginLeft: "4px" }}
                    onClick={this.addNewConsole}
                >
                    <Icon key="newIcon" src={Assets.toolbar.newShellConsoleIcon} data-tooltip="inherit" />
                </Button>,
            );
        }

        const pages: IWorkspaceTabPage[] = [];
        const connectionWorkspacePages = new Map<string, IWorkspaceTabPage[]>();

        let actualSelection = selectedPage;
        const overview = (
            <Container
                id="overviewHost"
                orientation={Orientation.TopDown}
            >
                <ConnectionBrowser
                    toolbarItems={toolbarItems}
                    showToolbar={!electronWorkspaceLayout}
                    onAddConnection={this.handleAddConnection}
                    onUpdateConnection={this.handleUpdateConnection}
                    onRemoveConnection={this.handleRemoveConnection}
                />
            </Container>
        );

        pages.push({
            icon: Codicon.Home,
            caption: "Connections",
            id: this.documentDataModel.overview.id,
            content: overview,
            workspaceId: homeWorkspaceId,
            pageKind: "overview",
        });
        connectionWorkspaces.forEach((info: IConnectionWorkspacePage) => {
            const page = info.dataModelEntry;
            const connectionState = this.connectionPresentation.get(page)!;

            // TODO(rennox): unexpected that the state is undefined,
            // even so it happens, requires investigation
            if (!connectionState) {
                return;
            }

            const content = (<ConnectionWorkspace
                id={page.id}
                ref={(tab) => {
                    this.handleConnectionWorkspaceRef(page.id, tab);
                }}
                caption={page.caption}
                showAbout={!info.suppressAbout}
                workerPool={this.workerPool}
                connection={info.connection}
                toolbarItems={toolbarItems}
                extraLibs={[{ code: scriptingRuntime, path: "runtime" }]}
                savedState={connectionState}
                onHelpCommand={this.handleHelpCommand}
                onAddEditor={this.handleAddNotebook}
                onLoadScript={this.handleLoadScript}
                onSelectItem={this.handleSelectItem}
                onEditorRename={this.handleEditorRename}
                onEditorChange={this.handleEditorChange}
                onGraphDataChange={this.handleGraphDataChange}
                onSaveAdminClientConnectionsState={this.handleClientConnectionsStateChange}
                onSaveAdminEnterpriseBackupState={this.handleEnterpriseBackupStateChange}
                onChatOptionsChange={this.onChatOptionsChange}
                onDesktopRunStateChanged={this.handleDesktopRunStateChanged}
            />);

            const activeDocumentState = connectionState.documentStates.find((entry) => {
                return entry.document.id === connectionState.activeEntry;
            });
            const pageCaption = activeDocumentState
                ? this.getConnectionWorkspaceCaption(activeDocumentState, info.connection.details.caption, page.caption)
                : page.caption;
            const tooltip = activeDocumentState
                ? `${getOpenDocumentDisplayCaption(activeDocumentState, {
                    connectionCaption: info.connection.details.caption,
                    pageCaption: page.caption,
                })} - `
                + info.connection.details.caption
                : page.caption;

            const pageEntry: IWorkspaceTabPage = {
                icon: this.getConnectionWorkspaceIcon(activeDocumentState),
                caption: pageCaption,
                tooltip,
                id: page.id,
                content,
                auxiliary: (
                    <Button
                        id={page.id}
                        className={this.getTabCloseButtonClassName(activeDocumentState)}
                        round={true}
                        onClick={this.handleCloseTab}>
                        {this.renderTabCloseButtonContent(activeDocumentState)}
                    </Button>
                ),
                canClose: !appParameters.embedded,
                workspaceId: this.getConnectionWorkspaceId(info.connection.details.id, page.id),
                pageKind: "connection",
                connectionId: info.connection.details.id,
            };

            pages.push(pageEntry);
            connectionWorkspacePages.set(page.id, this.buildConnectionWorkspacePages(pageEntry, info, connectionState));
        });

        documentTabs.forEach((info: IDocumentTab) => {
            const document = info.dataModelEntry;
            const content = (<SimpleEditor
                key={document.id}
                id={document.id}
                savedState={info.savedState}
                fileName={document.caption}
                onSave={() => {
                    this.handleStandaloneDocumentSaved(document.id);
                }}
                toolbarItemsTemplate={toolbarItems}
            />);

            pages.push({
                icon: Assets.misc.scriptingIcon,
                caption: document.caption,
                id: document.id,
                content,
                auxiliary: (
                    <Button
                        id={document.id}
                        className="closeButton"
                        round={true}
                        onClick={this.handleCloseTab}>
                        <Icon src={Assets.misc.close2Icon} />
                    </Button>
                ),
                canClose: !appParameters.embedded,
                workspaceId: generalWorkspaceId,
                pageKind: "document",
            });
        });

        schemaDiagramTabs.forEach((info) => {
            const document = info.dataModelEntry;
            const content = (<SchemaDiagramDesigner
                key={document.id}
                id={document.id}
                savedState={info.savedState}
                dataModelEntry={info.dataModelEntry}
            />);
            const connectionId = document.connection?.id;

            pages.push({
                icon: Assets.file.defaultIcon,
                caption: document.caption,
                id: document.id,
                content,
                auxiliary: (
                    <Button
                        id={document.id}
                        className="closeButton"
                        round={true}
                        onClick={this.handleCloseTab}>
                        <Icon src={Assets.misc.close2Icon} />
                    </Button>
                ),
                canClose: !appParameters.embedded,
                workspaceId: this.getWorkspaceIdForPageId(document.id)
                    ?? (connectionId ? this.getConnectionWorkspaceId(connectionId) : generalWorkspaceId),
                pageKind: "diagram",
                connectionId,
            });
        });

        shellSessionTabs.forEach((info) => {
            const document = info.dataModelEntry;
            const content = (<ShellTab
                key={document.id}
                id={document.id}
                savedState={info.savedState}
                toolbarItemsTemplate={toolbarItems}
                onQuit={(id) => {
                    void this.removeShellTab(id);
                }}
            />);
            const connectionId = document.details.dbConnectionId;

            pages.push({
                icon: Assets.misc.scriptingIcon,
                caption: document.caption,
                id: document.id,
                content,
                auxiliary: (
                    <Button
                        id={document.id}
                        className="closeButton"
                        round={true}
                        onClick={this.handleCloseTab}>
                        <Icon src={Assets.misc.close2Icon} />
                    </Button>
                ),
                canClose: !appParameters.embedded,
                workspaceId: this.getWorkspaceIdForPageId(document.id)
                    ?? (connectionId ? this.getConnectionWorkspaceId(connectionId) : generalWorkspaceId),
                pageKind: "shell",
                connectionId,
            });
        });

        if (electronWorkspaceLayout && this.state.debuggerWorkspaceVisible === true) {
            pages.push({
                icon: Codicon.Debug,
                caption: "Communication Debugger",
                id: debuggerWorkspacePageId,
                content: (
                    <Container
                        id="communicationDebuggerWorkspacePage"
                        orientation={Orientation.TopDown}
                        style={{ position: "relative", flex: "1 1 auto" }}
                    >
                        <Container
                            id="communicationDebuggerContentHost"
                            orientation={Orientation.TopDown}
                            style={{ position: "relative", flex: "1 1 auto" }}
                        />
                    </Container>
                ),
                workspaceId: debuggerWorkspaceId,
                pageKind: "debugger",
                canClose: false,
            });
        }

        if (!actualSelection && pages.length > 0) {
            actualSelection = pages[0].id;
        }

        const visiblePageId = this.getVisiblePageId();
        const activeConnectionWorkspace = this.getActiveConnectionWorkspace();
        const activeConnectionState = activeConnectionWorkspace
            ? this.connectionPresentation.get(activeConnectionWorkspace.dataModelEntry)
            : undefined;
        const activeConnectionDocumentState = activeConnectionState?.documentStates.find((entry) => {
            return entry.document.id === activeConnectionState.activeEntry;
        }) ?? activeConnectionState?.documentStates[0];
        const selectedDocument = visiblePageId === this.documentDataModel.overview.id
            ? this.documentDataModel.overview.id
            : activeConnectionWorkspace && activeConnectionWorkspace.dataModelEntry.id === visiblePageId
                ? activeConnectionState?.activeEntry ?? visiblePageId ?? ""
                : visiblePageId ?? "";
        const activeSidebarWorkspace = this.getResolvedSelectedWorkspace();
        const documentSidebarMode = this.getDocumentSidebarMode(activeSidebarWorkspace);
        const activeWorkspaceConnection = documentSidebarMode === "electronConnection"
            ? this.getSidebarWorkspaceConnectionEntry()
            : undefined;
        const activeWorkspaceConnectionId = activeSidebarWorkspace.kind === "connection"
            ? activeSidebarWorkspace.connectionId
            : undefined;

        const className = "dbModuleTabview";
        const loadingOverlay = loading
            ? [
                <ProgressIndicator
                    key="loadingProgressIndicator"
                    id="loadingProgressIndicator"
                    backgroundOpacity={0.95}
                    linear={false}
                />,
                progressMessage
                    ? (
                        <Label
                            key="progressMessage"
                            id="progressMessageId"
                            caption={progressMessage}
                        />
                    )
                    : null,
            ]
            : undefined;
        const auxiliaryContent = <>
            {electronWorkspaceLayout && this.state.debuggerWorkspaceVisible === true &&
                <Suspense fallback={null}>
                    <CommunicationDebugger
                        contentPortalTargetId="communicationDebuggerContentHost"
                        sidebarPortalTargetId="communicationDebuggerSidebarHost"
                    />
                </Suspense>
            }
            {isEmbedded &&
                <Menu
                    key="actionMenu"
                    id="editorToolbarActionMenu"
                    ref={this.actionMenuRef}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleNewScriptClick}
                >
                    <MenuItem
                        key="item1"
                        command={{ title: "New DB Notebook", command: "addEditor" }}
                        icon={Assets.misc.newNotebookIcon}
                    />
                    <MenuItem
                        key="item2"
                        command={{ title: "New SQL Script", command: "addSQLScript" }}
                        icon={sqlIcon}
                    />
                    <MenuItem
                        key="item3"
                        command={{ title: "New TS Script", command: "addTSScript" }}
                        icon={Assets.file.typescriptIcon}
                    />
                    <MenuItem
                        key="item4"
                        command={{ title: "New JS Script", command: "addJSScript" }}
                        icon={Assets.file.javascriptIcon}
                    />
                </Menu>
            }
            <MrsHub ref={this.mrsHubRef} />
            <CreateLibraryDialog ref={this.createLibraryDialogRef} />
            <JdvHub ref={this.jdvHubRef} />
        </>;

        let content: ComponentChild = <>
            <Container id="dbModuleTabHost" orientation={Orientation.TopDown}>
                <Tabview
                    className={className}
                    tabPosition={TabPosition.Top}
                    selectedId={actualSelection}
                    stretchTabs={false}
                    showTabs={showTabs}
                    canReorderTabs
                    pages={pages}
                    onSelectTab={this.handleSelectTab}
                    closeTabs={this.removeTabs}
                    canCloseTab={this.canCloseTab}
                />
                {loadingOverlay}
            </Container>
            {auxiliaryContent}
        </>;

        if (electronWorkspaceLayout) {
            const workspaces = this.getWorkspaces();
            const activeWorkspace = this.getResolvedSelectedWorkspace(this.state, workspaces);
            const pageById = new Map<string, IWorkspaceTabPage>();
            pages.forEach((page) => {
                pageById.set(page.id, page);
            });
            const workspacePages = activeWorkspace.pageIds.flatMap((pageId) => {
                const workspaceDocumentPages = connectionWorkspacePages.get(pageId);
                if (workspaceDocumentPages) {
                    return workspaceDocumentPages;
                }

                const page = pageById.get(pageId);

                return page ? [page] : [];
            });
            const workspaceVisiblePageId = this.getVisiblePageIdForWorkspace(activeWorkspace.id)
                ?? workspacePages[0]?.id;
            const workspaceSelectedPageId = workspacePages.some((page) => {
                return page.id === selectedDocument;
            })
                ? selectedDocument
                : workspaceVisiblePageId;
            const activeWorkspaceConnectionDetails = activeConnectionWorkspace?.connection.details
                ?? this.getWorkspaceConnectionDetails(activeWorkspace);
            const activeWorkspaceTags = this.getConnectionWorkspaceTags(activeWorkspaceConnectionDetails);
            const titlebarClassName = [
                activeWorkspace.kind === "connection" ? "withMetadata" : "",
                showSidebar ? "sidebarVisible" : "sidebarHidden",
            ].filter((entry) => {
                return entry.length > 0;
            }).join(" ") || undefined;

            let workspaceMainContent: ComponentChild;
            if (this.props.contentReplacement) {
                workspaceMainContent = (
                    <Container id="dbModuleTabHost" orientation={Orientation.TopDown}>
                        {this.props.contentReplacement}
                    </Container>
                );
            } else if (activeWorkspace.kind === "home") {
                const overviewPage = pages.find((page) => {
                    return page.id === this.documentDataModel.overview.id;
                });
                workspaceMainContent = (
                    <Container id="dbModuleTabHost" orientation={Orientation.TopDown}>
                        {overviewPage?.content}
                        {loadingOverlay}
                    </Container>
                );
            } else if (activeWorkspace.kind === "debugger") {
                const debuggerPage = pageById.get(debuggerWorkspacePageId);
                workspaceMainContent = (
                    <Container id="dbModuleTabHost" orientation={Orientation.TopDown}>
                        {debuggerPage?.content}
                        {loadingOverlay}
                    </Container>
                );
            } else if (workspacePages.length === 0) {
                workspaceMainContent = (
                    <Container id="dbModuleTabHost" orientation={Orientation.TopDown}>
                        <Container id="desktopWorkspaceEmptyState" orientation={Orientation.TopDown}>
                            <Label
                                caption={activeWorkspace.kind === "general"
                                    ? "General workspace is empty."
                                    : "No content is currently available for this workspace."}
                            />
                        </Container>
                        {loadingOverlay}
                    </Container>
                );
            } else {
                workspaceMainContent = (
                    <Container id="dbModuleTabHost" orientation={Orientation.TopDown}>
                        <Tabview
                            className={className}
                            tabPosition={TabPosition.Top}
                            selectedId={workspaceSelectedPageId}
                            stretchTabs={false}
                            showTabs={true}
                            canReorderTabs
                            pages={workspacePages}
                            onSelectTab={this.handleWorkspaceTabSelection}
                            closeTabs={this.removeTabs}
                            canCloseTab={this.canCloseTab}
                        />
                        {loadingOverlay}
                    </Container>
                );
            }

            const statusArea = this.renderDesktopStatusArea(
                activeWorkspaceConnectionDetails,
                activeConnectionWorkspace,
                activeConnectionState,
                activeConnectionDocumentState,
            );
            const titlebarActions = activeWorkspace.kind === "connection"
                ? this.renderDesktopTitlebarConnectionActions(
                    activeWorkspace,
                    activeConnectionState,
                    activeConnectionDocumentState,
                )
                : null;
            const workspaceDropdownItems = workspaces.map((entry) => {
                const connectionDetails = this.getWorkspaceConnectionDetails(entry);
                let picture = <Icon src={Codicon.Home} />;
                if (entry.kind === "general") {
                    picture = <Icon src={Assets.misc.scriptingIcon} />;
                } else if (entry.kind === "debugger") {
                    picture = <Icon src={Codicon.Debug} />;
                } else if (connectionDetails) {
                    picture = <Icon
                        src={connectionDetails.dbType === DBType.MySQL
                            ? Assets.db.mysqlConnectionIcon
                            : Assets.db.sqliteConnectionIcon}
                    />;
                }
                const closeButton = entry.kind === "connection"
                    ? <Button
                        id={`closeWorkspace-${entry.id}`}
                        className="workspaceSelectorCloseButton"
                        data-tooltip="Close Workspace"
                        imageOnly
                        onClick={(e) => {
                            this.handleCloseWorkspace(e, entry.id);
                        }}
                    >
                        <Icon src={Codicon.Close} data-tooltip="inherit" />
                    </Button>
                    : undefined;

                return (
                    <DropdownItem
                        id={entry.id}
                        key={entry.id}
                        caption={entry.caption}
                        picture={picture}
                    >
                        <div className="workspaceSelectorItem">
                            <Container
                                className="workspaceSelectorItemLabel"
                                orientation={Orientation.LeftToRight}
                                crossAlignment={ContentAlignment.Center}
                            >
                                {picture}
                                <Label caption={entry.caption} />
                            </Container>
                            {closeButton}
                        </div>
                    </DropdownItem>
                );
            });

            content = <>
                <Container id="desktopWorkspaceHost" orientation={Orientation.TopDown}>
                    <Container
                        id="desktopWorkspaceTitlebar"
                        className={titlebarClassName}
                        orientation={Orientation.TopDown}
                    >
                        <div className="desktopWorkspaceTitlebarGrid">
                            <Container className="desktopWorkspaceTitlebarLeft" orientation={Orientation.LeftToRight}>
                                {!showSidebar && this.renderDesktopSidebarToggle(showSidebar)}
                                <Container className="desktopWorkspaceSelectorHost" orientation={Orientation.TopDown}>
                                    <Dropdown
                                        ref={this.workspaceSelectorRef}
                                        id="workspaceSelector"
                                        selection={activeWorkspace.id}
                                        variant={DropdownVariant.AiryDropdown}
                                        onSelect={this.handleWorkspaceSelection}
                                    >
                                        {workspaceDropdownItems}
                                    </Dropdown>
                                    {activeWorkspaceTags.length > 0 &&
                                        <div className="desktopWorkspaceSelectorTags">
                                            {activeWorkspaceTags.map((tag) => {
                                                return <span
                                                    key={tag.caption}
                                                    className="desktopWorkspaceSelectorTag"
                                                    style={{
                                                        backgroundColor: tag.backgroundColor,
                                                        color: tag.foregroundColor,
                                                    }}
                                                >
                                                    {tag.caption}
                                                </span>;
                                            })}
                                        </div>
                                    }
                                </Container>
                            </Container>
                            <div className="desktopWorkspaceTitlebarCenter">
                                {statusArea}
                            </div>
                            <div className="desktopWorkspaceTitlebarRight">
                                {titlebarActions}
                            </div>
                        </div>
                    </Container>
                    {workspaceMainContent}
                </Container>
                {auxiliaryContent}
            </>;
        }

        const splitterPanes: ISplitterPane[] = [];
        const sideBar = activeSidebarWorkspace.kind === "debugger"
            ? <Container
                id="communicationDebuggerSidebarHost"
                orientation={Orientation.TopDown}
                style={{ position: "relative", flex: "1 1 auto" }}
            />
            : <DocumentSideBar
                ref={this.sideBarRef}
                selectedOpenDocument={selectedDocument}
                markedSchema={activeConnectionWorkspace?.connection.currentSchema ?? ""}
                savedSectionState={sidebarState}
                sidebarMode={documentSidebarMode}
                activeWorkspaceConnection={activeWorkspaceConnection}
                activeWorkspaceConnectionId={activeWorkspaceConnectionId}
                overviewId={this.documentDataModel.overview.id}
                onSaveState={this.handleSaveExplorerState}
                onSelectDocumentItem={this.handleDocumentSelection}
                onSelectConnectionItem={this.handleConnectionEntrySelection}
                onConnectionTreeCommand={this.handleSideBarConnectionCommand}
                onDocumentTreeCommand={this.handleSideBarDocumentCommand}
                onOciTreeCommand={this.handleSideBarOciCommand}
            />;
        splitterPanes.push({
            content: electronWorkspaceLayout
                ? <Container id="desktopSidebarPane" orientation={Orientation.TopDown}>
                    {showSidebar &&
                        <Container id="desktopSidebarHeader" orientation={Orientation.LeftToRight}>
                            {this.renderDesktopSidebarToggle(showSidebar)}
                        </Container>
                    }
                    {sideBar}
                </Container>
                : sideBar,
            minSize: 0,
            initialSize: this.getSidebarInitialSize(),
            resizable: true,
            snap: true,
            collapsed: !showSidebar,
        });

        splitterPanes.push({
            content,
            minSize: 500,
            resizable: true,
            stretch: true,
        });

        return (
            <DocumentContext.Provider
                value={{
                    connectionsDataModel: this.connectionsDataModel,
                    documentDataModel: this.documentDataModel,
                    ociDataModel: this.ociDataModel,
                    shellTaskDataModel: this.shellTaskDataModel,
                }}>

                <SplitContainer
                    id="mainSplitHost"
                    innerRef={this.containerRef}
                    orientation={Orientation.LeftToRight}
                    panes={splitterPanes}
                    onPaneResized={this.handleMainPaneResized}
                />
            </DocumentContext.Provider >
        );
    }

    public handlePushConnection = async (entry: ICdmConnectionEntry): Promise<void> => {
        await this.connectionsDataModel.addConnectionEntry(entry);
    };

    private renderDesktopSidebarToggle = (showSidebar: boolean): ComponentChild => {
        return (
            <Button
                id="desktopWorkspaceSidebarToggle"
                className="desktopWorkspaceTitlebarButton"
                data-tooltip={showSidebar ? "Hide Sidebar" : "Show Sidebar"}
                imageOnly
                onClick={this.toggleSidebarVisibility}
            >
                <Icon
                    src={showSidebar ? Codicon.LayoutSidebarLeftOff : Codicon.LayoutSidebarLeft}
                    data-tooltip="inherit"
                />
            </Button>
        );
    };

    private renderDesktopTitlebarConnectionActions = (
        activeWorkspace: IConnectionWorkspace,
        activeConnectionState?: IConnectionPresentationState,
        activeDocumentState?: IOpenDocumentState,
    ): ComponentChild => {
        const executionContext = this.getActiveDesktopExecutionContext(activeConnectionState, activeDocumentState);
        const desktopRunState = executionContext?.desktopRunState;
        const offline = activeWorkspace.connectionWorkspace?.connection.isOffline === true;
        const activeConnectionPage = activeWorkspace.connectionWorkspace?.dataModelEntry ?? this.getSelectedConnectionPageEntry();
        const hasActiveConnectionPage = activeConnectionPage !== undefined && !offline;
        const activeConnectionDetails = activeWorkspace.connectionWorkspace?.connection.details ?? activeConnectionPage?.details;
        const activeType = executionContext?.activeType;
        const area = activeType === "notebook" ? "block" : "script";
        const canExecuteSubparts = desktopRunState?.canExecuteSubparts ?? false;
        const selectionText = canExecuteSubparts ? "the selection or " : "";
        const activeConnectionDbType = activeConnectionDetails?.dbType ?? DBType.MySQL;
        const canVisualExplain = (desktopRunState?.canExecute ?? false)
            && (executionContext?.editorExecutionContext?.isSQLLike
                ?? canExecuteSubparts)
            && activeConnectionDbType === DBType.MySQL;
        const hasAlternateRunActions = canExecuteSubparts || canVisualExplain;
        const isStopping = this.isDesktopWorkspaceStopping(activeWorkspace.id);
        const isBusy = isStopping || desktopRunState?.canStop === true;
        const primaryRunTooltip = activeType === "notebook"
            ? `Execute ${selectionText}everything in the current block and create a new block`
            : "Execute full script";
        const stopTooltip = isStopping
            ? "Stopping execution..."
            : "Stop execution of the current statement/script";

        return (
            <Container
                id="desktopWorkspaceTitlebarActions"
                orientation={Orientation.LeftToRight}
            >
                {desktopRunState && isBusy &&
                    <SplitButton
                        id="desktopTitlebarRunButton"
                        key="desktopTitlebarRunButton"
                        className="desktopWorkspaceRunSplitButton desktopWorkspaceRunStopButton"
                        data-tooltip={stopTooltip}
                        disabled={isStopping}
                        onClick={() => {
                            void this.stopActiveDesktopExecution("query");
                        }}
                        menu={
                            <Menu
                                id="desktopTitlebarStopMenu"
                                placement={ComponentPlacement.BottomCenter}
                                onItemClick={this.handleDesktopTitlebarRunMenuItemClick}
                            >
                                <MenuItem
                                    id="desktopTitlebarStopKillQueryItem"
                                    command={{ title: "Kill Query", command: "run.killQuery" }}
                                    title="Kill the currently running query"
                                    icon={Codicon.DebugStop}
                                />
                                <MenuItem
                                    id="desktopTitlebarStopKillSessionItem"
                                    command={{ title: "Kill Session", command: "run.killSession" }}
                                    title="Kill the current database session"
                                    icon={Codicon.DebugDisconnect}
                                />
                            </Menu>
                        }
                    >
                        <Icon src={Codicon.DebugStop} data-tooltip="inherit" />
                        <Label caption="Stop" data-tooltip="inherit" />
                    </SplitButton>
                }
                {desktopRunState && !isBusy &&
                    <SplitButton
                        id="desktopTitlebarRunButton"
                        key="desktopTitlebarRunButton"
                        className="desktopWorkspaceRunSplitButton"
                        data-tooltip={primaryRunTooltip}
                        disabled={!desktopRunState.canExecute}
                        onClick={() => {
                            void this.executeDesktopCommand("run.execute");
                        }}
                        menu={
                            <Menu
                                id="desktopTitlebarRunMenu"
                                placement={ComponentPlacement.BottomCenter}
                                onItemClick={this.handleDesktopTitlebarRunMenuItemClick}
                            >
                                {canExecuteSubparts &&
                                    <MenuItem
                                        id="desktopTitlebarRunExecuteItem"
                                        command={{ title: "Run Script", command: "run.execute" }}
                                        accelerator={desktopRunAccelerators.execute}
                                        title="Execute the selected script"
                                        icon={Assets.toolbar.executeIcon}
                                        disabled={!desktopRunState.canExecute}
                                    />
                                }
                                {hasAlternateRunActions &&
                                    <MenuItem
                                        id="desktopTitlebarRunExecuteCurrentItem"
                                        command={{ title: "Run Current Statement", command: "run.executeCurrent" }}
                                        accelerator={desktopRunAccelerators.executeCurrent}
                                        title="Execute the statement at the caret position"
                                        icon={Assets.toolbar.executeCaretIcon}
                                        disabled={!desktopRunState.canExecute}
                                    />
                                }
                                {canExecuteSubparts &&
                                    <MenuItem
                                        id="desktopTitlebarRunExecuteAsTextItem"
                                        command={{ title: "Run (Results as Text)", command: "run.executeAsText" }}
                                        accelerator={desktopRunAccelerators.executeAsText}
                                        title={`Execute the ${area} and print the result as text`}
                                        icon={Assets.toolbar.executePrintTextIcon}
                                        disabled={!desktopRunState.canExecute}
                                    />
                                }
                                {canExecuteSubparts && canVisualExplain &&
                                    <MenuItem
                                        id="desktopTitlebarRunExplainSeparator"
                                        command={{ title: "-", command: "" }}
                                    />
                                }
                                {canVisualExplain &&
                                    <MenuItem
                                        id="desktopTitlebarRunExplainItem"
                                        command={{ title: "Explain", command: "run.explain" }}
                                        title="Execute the selection or current statement with explain"
                                        icon={Assets.toolbar.executeExplainIcon}
                                        disabled={!desktopRunState.canExecute}
                                    />
                                }
                                {canVisualExplain &&
                                    <MenuItem
                                        id="desktopTitlebarRunExplainAnalyzeItem"
                                        command={{ title: "Explain Analyze", command: "run.explainAnalyze" }}
                                        title="Execute the selection or current statement with explain analyze"
                                        icon={Assets.toolbar.executeExplainIcon}
                                        disabled={!desktopRunState.canExecute}
                                    />
                                }
                                {canVisualExplain &&
                                    <MenuItem
                                        id="desktopTitlebarRunVisualExplainItem"
                                        command={{ title: "Visual Explain", command: "run.visualExplain" }}
                                        title="Generate a visual explain plan for the selection or current statement"
                                        icon={Assets.toolbar.executeExplainIcon}
                                        disabled={!desktopRunState.canExecute}
                                    />
                                }
                                {canVisualExplain &&
                                    <MenuItem
                                        id="desktopTitlebarRunVisualExplainAnalyzeItem"
                                        command={{
                                            title: "Visual Explain Analyze",
                                            command: "run.visualExplainAnalyze",
                                        }}
                                        title="Execute the selection or current statement with visual explain analyze"
                                        icon={Assets.toolbar.executeExplainIcon}
                                        disabled={!desktopRunState.canExecute}
                                    />
                                }
                                {canExecuteSubparts && executionContext?.activeConnectionState?.heatWaveEnabled &&
                                    <MenuItem
                                        id="desktopTitlebarRunExecuteHeatWaveItem"
                                        command={{ title: "Run on HeatWave", command: "run.executeHeatWave" }}
                                        title={`Execute ${selectionText}full ${area} on HeatWave and create a new block`}
                                        icon={Assets.toolbar.executeHeatwaveIcon}
                                        disabled={!desktopRunState.canExecute}
                                    />
                                }
                                {canExecuteSubparts && executionContext?.activeConnectionState?.heatWaveEnabled &&
                                    <MenuItem
                                        id="desktopTitlebarRunExecuteCurrentHeatWaveItem"
                                        command={{ title: "Run Current on HeatWave", command: "run.executeCurrentHeatWave" }}
                                        title="Execute statement at current position on HeatWave"
                                        icon={Assets.toolbar.executeCaretHeatwaveIcon}
                                        disabled={!desktopRunState.canExecute}
                                    />
                                }
                            </Menu>
                        }
                    >
                        <Icon src={Assets.toolbar.executeIcon} data-tooltip="inherit" />
                        <Label caption="Run" data-tooltip="inherit" />
                    </SplitButton>
                }
                <Button
                    id="desktopTitlebarAddButton"
                    className="desktopWorkspaceTitlebarButton desktopWorkspaceCreateButton"
                    imageOnly
                    disabled={!hasActiveConnectionPage}
                    onClick={this.openDesktopTitlebarAddMenu}
                >
                    <Icon src={Codicon.Add} data-tooltip="inherit" />
                </Button>
                <Menu
                    id="desktopTitlebarAddMenu"
                    ref={this.desktopTitlebarAddMenuRef}
                    placement={ComponentPlacement.BottomCenter}
                    onItemClick={this.handleDesktopTitlebarAddMenuItemClick}
                >
                    <MenuItem
                        id="desktopTitlebarAddNewScriptItem"
                        command={{ title: "New Script", command: "desktop.newScriptTab" }}
                        icon={Assets.misc.scriptIcon}
                        disabled={!hasActiveConnectionPage}
                    />
                    <MenuItem
                        id="desktopTitlebarAddNewNotebookItem"
                        command={{ title: "New Notebook", command: "desktop.newNotebookTab" }}
                        icon={Assets.misc.newNotebookIcon}
                        disabled={!hasActiveConnectionPage}
                    />
                    <MenuItem command={{ title: "-", command: "" }} />
                    <MenuItem
                        id="desktopTitlebarAddOpenScriptItem"
                        command={{ title: "Open Script...", command: "desktop.openScriptTab" }}
                        icon={Assets.misc.scriptIcon}
                        disabled={!hasActiveConnectionPage}
                    />
                    <MenuItem
                        id="desktopTitlebarAddOpenNotebookItem"
                        command={{ title: "Open Notebook...", command: "desktop.openNotebookTab" }}
                        icon={Assets.misc.newNotebookIcon}
                        disabled={!hasActiveConnectionPage}
                    />
                </Menu>
            </Container>
        );
    };

    private renderDesktopStatusArea = (
        connectionDetails?: IConnectionDetails,
        activeConnectionWorkspace?: IConnectionWorkspacePage,
        activeConnectionState?: IConnectionPresentationState,
        activeDocumentState?: IOpenDocumentState,
    ): ComponentChild => {
        if (!connectionDetails) {
            return null;
        }

        const workspaceTarget = this.formatConnectionWorkspaceTarget(connectionDetails);
        const showConnectionInfo = Settings.get("editor.showConnectionInfo", false);
        const connectionInfo = showConnectionInfo
            ? this.formatConnectionInfo(activeConnectionWorkspace?.connection)
            : undefined;
        const connectionInfoBadge = showConnectionInfo
            ? this.formatConnectionInfoBadge(activeConnectionWorkspace?.connection)
            : undefined;
        const offline = activeConnectionWorkspace?.connection.isOffline === true;
        const workspaceVersion = offline ? undefined : this.formatConnectionWorkspaceVersion(connectionDetails);
        const executionContext = this.getActiveDesktopExecutionContext(activeConnectionState, activeDocumentState);
        const activeWorkspaceId = this.getResolvedSelectedWorkspaceId();
        const isStopping = this.isDesktopWorkspaceStopping(activeWorkspaceId);
        const autoCommit = this.getDesktopFlag(executionContext?.desktopRunState?.autoCommit);
        const transactionOpen = this.getDesktopFlag(executionContext?.desktopRunState?.transactionOpen);
        const canStop = executionContext?.desktopRunState?.canStop === true;
        const isBusy = isStopping || canStop;
        const statusTimerCaption = this.getDesktopStatusTimerCaption(activeWorkspaceId, isBusy);
        const statusText = isStopping
            ? "Stopping execution..."
            : this.formatConnectionWorkspaceStatus(activeConnectionWorkspace, canStop);
        const transactionStatusCaption = transactionOpen
            ? "TX OPEN"
            : autoCommit ? "AUTO-COMMIT ON" : "AUTO-COMMIT OFF";
        const transactionStatusTooltip = transactionOpen
            ? `A transaction is open. Auto-commit is ${autoCommit ? "enabled" : "disabled"}.`
            : autoCommit ? "No transaction is open. Auto-commit is enabled."
                : "No transaction is open. Auto-commit is disabled.";

        return (
            <Container
                id="desktopStatusArea"
                orientation={Orientation.LeftToRight}
                fixedScrollbars={false}
            >
                <Container
                    className="desktopStatusAreaSection desktopStatusAreaPrimary"
                    orientation={Orientation.LeftToRight}
                    fixedScrollbars={false}
                >
                    <Container
                        className="desktopStatusPrimaryRow"
                        orientation={Orientation.LeftToRight}
                        fixedScrollbars={false}
                    >
                        <Container
                            className="desktopStatusConnectionInfo"
                            orientation={Orientation.TopDown}
                            fixedScrollbars={false}
                            >
                                <Label
                                    className="desktopStatusPrimary"
                                    caption={workspaceTarget ?? connectionDetails.caption}
                                />
                                <Label
                                    className="desktopStatusSecondary"
                                    caption={offline ? "OFFLINE" : workspaceVersion ?? ""}
                                />
                        </Container>
                    </Container>
                </Container>
                <Container
                    className="desktopStatusAreaSection desktopStatusAreaSecondary"
                    orientation={Orientation.TopDown}
                    fixedScrollbars={false}
                >
                    <Container
                        className="desktopStatusActivityRow"
                        orientation={Orientation.LeftToRight}
                        fixedScrollbars={false}
                    >
                        <Container
                            className="desktopStatusActivity"
                            orientation={Orientation.LeftToRight}
                            fixedScrollbars={false}
                        >
                            {isBusy &&
                                <Icon
                                    src={Codicon.Loading}
                                    className="desktopStatusSpinner"
                                />
                            }
                            <Label
                                className="desktopStatusSecondary desktopStatusText"
                                caption={statusText ?? ""}
                            />
                        </Container>
                        {statusTimerCaption &&
                            <Label
                                id="desktopStatusTimer"
                                className="desktopStatusTimer"
                                caption={statusTimerCaption}
                            />
                        }
                    </Container>
                    {!offline &&
                        <Container
                            className="desktopStatusIndicators"
                            orientation={Orientation.LeftToRight}
                            fixedScrollbars={false}
                        >
                            <div
                                id="desktopStatusTransactionIndicator"
                                className={`desktopStatusIndicator ${transactionOpen || autoCommit
                                    ? "desktopStatusIndicatorActive"
                                    : "desktopStatusIndicatorInactive"}`}
                                data-tooltip={transactionStatusTooltip}
                            >
                                {transactionStatusCaption}
                            </div>
                            {connectionInfoBadge &&
                                <div
                                    id="desktopStatusConnectionInfoIndicator"
                                    className="desktopStatusIndicator desktopStatusConnectionInfoIndicator"
                                    data-tooltip={connectionInfo}
                                >
                                    {connectionInfoBadge}
                                </div>
                            }
                        </Container>
                    }
                </Container>
            </Container>
        );
    };

    private stopActiveDesktopExecution = async (mode: "query" | "session" = "query"): Promise<boolean> => {
        const workspaceId = this.getResolvedSelectedWorkspaceId();
        const activeConnection = this.getActiveConnectionWorkspace()?.connection;
        const selectedConnectionWorkspaceRef = this.getSelectedConnectionWorkspaceRef();
        const activeEditorExecutionContext = this.getActiveDesktopExecutionContext()?.editorExecutionContext;
        const stopDisplayFallbackDelay = 1000;
        let stopExecution: (() => Promise<boolean>) | undefined;
        if (mode === "session" && activeConnection?.backend) {
            stopExecution = async () => {
                await activeConnection.backend.killSession();

                return true;
            };
        } else if (selectedConnectionWorkspaceRef?.stopExecution) {
            stopExecution = () => {
                return selectedConnectionWorkspaceRef.stopExecution();
            };
        } else if (activeConnection?.backend) {
            stopExecution = async () => {
                await activeConnection.backend.killQuery();

                return true;
            };
        } else {
            stopExecution = () => {
                return requisitions.execute("editorStopExecution", undefined);
            };
        }

        let finalized = false;
        let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
        const clearStopDisplay = (): void => {
            if (fallbackTimer) {
                clearTimeout(fallbackTimer);
                fallbackTimer = undefined;
            }

            this.setDesktopWorkspaceStopping(workspaceId, false);
            desktopCommandRegistry.notifyHostStateChanged();

            if (this.isElectronWorkspaceLayout()) {
                this.forceUpdate();
            }
        };
        const finalizeStopExecution = (): void => {
            if (finalized) {
                return;
            }

            finalized = true;
            activeEditorExecutionContext?.executionEnded();
            clearStopDisplay();
        };

        this.setDesktopWorkspaceStopping(workspaceId, true);
        fallbackTimer = setTimeout(() => {
            fallbackTimer = undefined;
            clearStopDisplay();
        }, stopDisplayFallbackDelay);
        void stopExecution().then(() => {
            finalizeStopExecution();
        }).catch((reason) => {
            finalizeStopExecution();

            void ui.showErrorMessage(`Cannot stop execution.${convertErrorToString(reason)}`, {});
        });

        return true;
    };

    private handleDesktopTitlebarRunMenuItemClick = (props: IMenuItemProperties): boolean => {
        switch (props.command.command) {
            case "run.executeCurrent": {
                void this.executeDesktopCommand("run.executeCurrent");
                break;
            }

            case "run.executeAsText": {
                void this.executeDesktopCommand("run.executeAsText");
                break;
            }

            case "run.explain": {
                void this.executeDesktopCommand("run.explain");
                break;
            }

            case "run.explainAnalyze": {
                void this.executeDesktopCommand("run.explainAnalyze");
                break;
            }

            case "run.visualExplain": {
                void this.executeDesktopCommand("run.visualExplain");
                break;
            }

            case "run.visualExplainAnalyze": {
                void this.executeDesktopCommand("run.visualExplainAnalyze");
                break;
            }

            case "run.executeHeatWave": {
                void this.runDesktopExecution({
                    advance: true,
                    asText: false,
                    forceSecondaryEngine: true,
                });
                break;
            }

            case "run.executeCurrentHeatWave": {
                void this.runDesktopExecution({
                    atCaret: true,
                    advance: false,
                    asText: false,
                    forceSecondaryEngine: true,
                });
                break;
            }

            case "run.killQuery": {
                void this.stopActiveDesktopExecution("query");
                break;
            }

            case "run.killSession": {
                void this.stopActiveDesktopExecution("session");
                break;
            }

            default:
        }

        return true;
    };

    private openDesktopTitlebarAddMenu = (event: MouseEvent | KeyboardEvent): void => {
        event.stopPropagation();

        const target = event.currentTarget as HTMLElement | null;
        if (!target) {
            return;
        }

        const targetRect = event instanceof KeyboardEvent
            ? target.getBoundingClientRect()
            : this.menuAnchorRect(event.clientX, event.clientY);

        this.desktopTitlebarAddMenuRef.current?.close();
        this.desktopTitlebarAddMenuRef.current?.open(targetRect, event instanceof KeyboardEvent);
    };

    private menuAnchorRect = (x: number, y: number, width = 2, height = 2): DOMRect => {
        return {
            x,
            y,
            width,
            height,
            left: x,
            top: y,
            right: x + width,
            bottom: y + height,
            toJSON: () => {
                return { x, y, width, height };
            },
        } as DOMRect;
    };

    private handleDesktopTitlebarAddMenuItemClick = (props: IMenuItemProperties): boolean => {
        void this.executeDesktopTitlebarAddAction(props.command.command);

        return true;
    };

    private executeDesktopTitlebarAddAction = async (command: string): Promise<boolean> => {
        const pageEntry = await this.getOrCreateSelectedUserConnectionPageEntry();
        if (!pageEntry) {
            return false;
        }

        switch (command) {
            case "desktop.newScriptTab": {
                const result = await this.handleSideBarDocumentCommand({ title: "", command: "msg.addScript" }, pageEntry);

                return result.success;
            }

            case "desktop.newNotebookTab": {
                return this.handleAddNotebook(pageEntry.id) !== undefined;
            }

            case "desktop.openScriptTab": {
                const result = await this.handleSideBarDocumentCommand(
                    { title: "", command: "msg.loadScriptFromDisk" },
                    pageEntry,
                );

                return result.success;
            }

            case "desktop.openNotebookTab": {
                return requisitions.execute("editorLoadNotebook", { createNew: true });
            }

            default: {
                return false;
            }
        }
    };

    private getActiveDesktopExecutionContext = (
        activeConnectionState?: IConnectionPresentationState,
        activeDocumentState?: IOpenDocumentState,
    ): {
        activeType: "script" | "notebook";
        activeConnectionState?: IConnectionPresentationState;
        activeDocumentState?: IOpenDocumentState;
        editorExecutionContext?: ExecutionContext;
        desktopRunState?: IDesktopRunState;
    } | undefined => {
        const selectedConnectionWorkspaceRef = this.getSelectedConnectionWorkspaceRef();
        const activeType = selectedConnectionWorkspaceRef?.getActiveDesktopDocumentType();
        if (!activeType) {
            return undefined;
        }

        const resolvedConnectionState = activeConnectionState ?? (() => {
            const activeConnectionPage = this.getSelectedConnectionPageEntry();
            return activeConnectionPage ? this.connectionPresentation.get(activeConnectionPage) : undefined;
        })();
        const resolvedDocumentState = activeDocumentState ?? resolvedConnectionState?.documentStates.find((entry) => {
            return entry.document.id === resolvedConnectionState.activeEntry;
        }) ?? resolvedConnectionState?.documentStates[0];
        const fallbackRunState = selectedConnectionWorkspaceRef?.getDesktopRunState();
        const editorExecutionContext = this.getActiveEditorExecutionContext(resolvedDocumentState);
        const desktopRunState = this.getEffectiveDesktopRunState(resolvedDocumentState, fallbackRunState)
            ?? this.getInferredDesktopRunState(activeType, resolvedDocumentState, fallbackRunState);

        return {
            activeType,
            activeConnectionState: resolvedConnectionState,
            activeDocumentState: resolvedDocumentState,
            editorExecutionContext,
            desktopRunState,
        };
    };

    private getInferredDesktopRunState = (
        activeType: "script" | "notebook",
        activeDocumentState?: IOpenDocumentState,
        fallbackRunState?: IDesktopRunState,
    ): IDesktopRunState => {
        const documentLanguage = activeDocumentState?.document.type === OdmEntityType.Script
            ? activeDocumentState.document.language
            : undefined;
        const canExecuteSubparts = fallbackRunState?.canExecuteSubparts
            ?? (documentLanguage === "mysql" || documentLanguage === "sql");

        return {
            canExecute: fallbackRunState?.canExecute ?? true,
            canExecuteSubparts: activeType === "script" ? canExecuteSubparts : false,
            canStop: fallbackRunState?.canStop ?? false,
            autoCommit: fallbackRunState?.autoCommit ?? true,
            transactionOpen: fallbackRunState?.transactionOpen ?? false,
            stopOnErrors: fallbackRunState?.stopOnErrors ?? Settings.get("editor.stopOnErrors", true),
        };
    };

    private runDesktopExecution = async (options: {
        advance: boolean;
        asText: boolean;
        forceSecondaryEngine: boolean;
        atCaret?: boolean;
        explain?: boolean;
        explainAnalyze?: boolean;
    }): Promise<boolean> => {
        const executionContext = this.getActiveDesktopExecutionContext();
        if (!executionContext) {
            return false;
        }

        if (options.atCaret && executionContext.desktopRunState?.canExecuteSubparts !== true
            && !options.explain && !options.explainAnalyze) {
            return false;
        }

        this.setDesktopWorkspaceStopping(this.getResolvedSelectedWorkspaceId(), false);

        return requisitions.execute(options.atCaret ? "editorExecute" : "editorExecuteSelectedOrAll", {
            advance: options.advance,
            forceSecondaryEngine: options.forceSecondaryEngine,
            asText: options.asText,
            ...(options.explain ? { explain: true } : {}),
            ...(options.explainAnalyze ? { explainAnalyze: true } : {}),
            is3rdLanguage: executionContext.activeDocumentState?.state?.model.is3rdLanguage,
        });
    };

    private runDesktopVisualExplain = async (analyze = false): Promise<boolean> => {
        const executionContext = this.getActiveDesktopExecutionContext();
        const canVisualExplain = executionContext?.editorExecutionContext?.isSQLLike
            ?? executionContext?.desktopRunState?.canExecuteSubparts ?? false;
        const activeWorkspaceConnection = this.getActiveWorkspaceConnectionEntry();
        const activeConnectionDetails = activeWorkspaceConnection?.details ?? this.getSelectedConnectionPageEntry()?.details;
        const activeConnectionDbType = activeConnectionDetails?.dbType ?? DBType.MySQL;

        if (!executionContext || !canVisualExplain || activeConnectionDbType !== DBType.MySQL) {
            return false;
        }

        this.setDesktopWorkspaceStopping(this.getResolvedSelectedWorkspaceId(), false);

        const options = {
            is3rdLanguage: executionContext.activeDocumentState?.state?.model.is3rdLanguage,
            ...(analyze ? { visualExplainAnalyze: true } : {}),
        };

        return requisitions.execute("editorVisualExplain", options);
    };

    private handleDesktopRunStateChanged = (): void => {
        this.syncDesktopWorkspaceStoppingState();

        if (this.isElectronWorkspaceLayout()) {
            this.forceUpdate();
        }
    };

    private handleKeyPress = (event: KeyboardEvent): void => {
        if (hasElectronHostBridge()) {
            return;
        }

        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
            event.preventDefault();

            this.toggleSidebarVisibility();
        }
    };

    private toggleSidebarVisibility = (): void => {
        this.setState((prevState) => {
            return { showSidebar: !prevState.showSidebar };
        });
    };

    private handleMainPaneResized = (info: ISplitterPaneSizeInfo[]): void => {
        if (info.length > 1) {
            this.sidebarWidth = info[0]!.currentSize;
        }
    };

    private handleAddConnection = (entry: ICdmConnectionEntry): void => {
        void ConnectionProcessor.addConnection(entry, this.connectionsDataModel);
    };

    private handleUpdateConnection = (entry: ICdmConnectionEntry): void => {
        void this.connectionsDataModel.groupFromPath(entry.details.folderPath).then((group) => {
            const currentFolderId = entry.parent?.folderPath.id ?? 1;
            const targetFolderId = group.folderPath.id;
            const folderPathId = currentFolderId === targetFolderId ? undefined : targetFolderId;
            ShellInterface.dbConnections.updateDbConnection(
                webSession.currentProfileId, entry.details, folderPathId,
            ).then(() => {
                // Connection groups may have changed.
                void entry.parent?.refresh?.(); // Old parent.
                requisitions.executeRemote("refreshConnectionGroup", entry.parent?.folderPath);
                if (entry.parent !== group) {
                    void group.refresh?.();     // New parent.
                    requisitions.executeRemote("refreshConnectionGroup", group.parent?.folderPath);
                }
                requisitions.executeRemote("connectionUpdated", entry.details);
            }).catch((reason: unknown) => {
                const message = convertErrorToString(reason);
                void requisitions.execute("showError", "Cannot update DB connection: " + message);
            });
        });
    };

    private handleRemoveConnection = (entry: ICdmConnectionEntry): void => {
        ShellInterface.dbConnections.removeDbConnection(webSession.currentProfileId, entry.details.id).then(() => {
            // Close and remove the connection.
            void this.connectionsDataModel.removeEntry(entry);
            void this.connectionsDataModel.dropItem(entry);

            requisitions.executeRemote("connectionRemoved", entry.details);
        }).catch((reason: unknown) => {
            const message = convertErrorToString(reason);
            void requisitions.execute("showError", "Cannot remove DB connection: " + message);
        });
    };

    private showPage = async (data: {
        connectionId?: number; suppressAbout?: boolean; editor?: InitialEditor; pageId?: string;
        connectionInfo?: IConnectionInfo; serviceOnly?: boolean; createNewWorkspace?: boolean;
    }): Promise<boolean> => {
        const { connectionWorkspaces, selectedPage, selectedWorkspace } = this.state;

        let connection: ICdmConnectionEntry | undefined;

        if (data.pageId) {
            const entry = connectionWorkspaces.find((t) => {
                return t.dataModelEntry.id === data.pageId;
            });
            if (entry) {
                const workspaceId = this.getConnectionWorkspaceId(entry.connection.details.id,
                    entry.dataModelEntry.id);
                if (selectedPage !== data.pageId || selectedWorkspace !== workspaceId) {
                    this.rememberConnectionPage(entry);
                    this.setState({ selectedPage: data.pageId, selectedWorkspace: workspaceId });

                    return Promise.resolve(true);
                }
                connection = entry.connection;
            }
        } else if (data.connectionId) {
            connection = await this.connectionsDataModel.findConnectionEntryById(data.connectionId,
                data.connectionInfo?.folderPath);
        }

        const doShowPage = (): Promise<boolean> => {
            if (connection) {
                return this.activateConnectionWorkspace(connection, data.createNewWorkspace ?? false,
                    data.suppressAbout ?? false,
                    data.editor ?? "default", data.serviceOnly);
            }

            this.showOverview();

            return Promise.resolve(true);
        };

        if (this.currentConnectionWorkspaceRef.current) {
            const canClose = await this.canCurrentTabClose();
            if (canClose) {
                return doShowPage();
            } else {
                // Pretend we handled the requisition in case of a rejection, to avoid
                // multiple attempts to open the new page while the requisition pipeline tries to resolve it.
                return Promise.resolve(true);
            }
        } else {
            return doShowPage();
        }
    };

    private handleOpenDocument = async (data: IDocumentOpenData): Promise<boolean> => {
        if (!data.connection) {
            return false;
        }

        const connection = await this.connectionsDataModel.findConnectionEntryById(data.connection.id,
            data.connection.folderPath);
        if (!connection) {
            return false;
        }

        const canClose = await this.canCurrentTabClose();
        if (!canClose) {
            return true;
        }

        const useUserConnection = this.isUserConnectionDocument(data.documentDetails);

        await this.activateConnectionWorkspace(connection, data.force ?? false, false, "none", !useUserConnection);

        const pageId = useUserConnection
            ? this.resolveLatestPageId(connection)
            : this.resolveServiceConnectionPageId(connection);

        const workspace = this.state.connectionWorkspaces.find((candidate) => {
            return pageId
                ? (candidate.dataModelEntry.id === pageId)
                : (candidate.connection.id === connection.id
                    && (useUserConnection
                        ? this.isUserConnectionPage(candidate.dataModelEntry.id)
                        : this.isServiceConnectionPage(candidate.dataModelEntry.id)));
        });

        if (workspace) {
            // Check if we are about to open a notebook, but a notebook already exists.
            let document;
            if (data.documentDetails.type === OdmEntityType.Notebook) {
                document = workspace.dataModelEntry.documents.find((doc) => {
                    return doc.type === OdmEntityType.Notebook;
                });

                if (!document) {
                    this.handleAddNotebook(workspace.dataModelEntry.id);

                    return true;
                }
            }

            document ??= this.documentDataModel.openDocument(undefined, {
                type: data.documentDetails.type,
                parameters: {
                    pageId: workspace.dataModelEntry.id,
                    id: data.documentDetails.id,
                    caption: data.documentDetails.caption,
                    connection: connection.details,
                    language: data.documentDetails.language,
                    pageType: data.documentDetails.pageType,
                },
            });

            if (document) {
                this.handleSelectItem({
                    document: document as LeafDocumentEntry,
                    pageId: workspace.dataModelEntry.id,
                });
            }
        }

        return true;
    };

    private openConnectionWorkspace = (data: {
        connection: ICdmConnectionEntry; createNewWorkspace: boolean; initialEditor?: InitialEditor;
    }): Promise<boolean> => {
        return this.activateConnectionWorkspace(data.connection, data.createNewWorkspace, false, data.initialEditor);
    };

    private setCurrentSchema = async (
        data: { id: string; connectionInfo: IConnectionInfo; schema: string; }
    ): Promise<boolean> => {
        const { connectionWorkspaces } = this.state;

        const matchingConnections = [...new Set(connectionWorkspaces.filter((workspace) => {
            return workspace.connection.details.id === data.connectionInfo.connectionId
                || data.id === workspace.dataModelEntry.id;
        }).map((workspace) => {
            return workspace.connection;
        }))];

        try {
            for (const connection of matchingConnections) {
                if (connection.setCurrentSchema) {
                    await connection.setCurrentSchema(data.schema);
                } else {
                    connection.currentSchema = data.schema;
                }
            }
        } catch (reason) {
            void ui.showErrorMessage(`Cannot set current database schema: ${convertErrorToString(reason)}`, {});

            return false;
        }

        // Update all editor pages with this connection.
        connectionWorkspaces.forEach((workspace: IConnectionWorkspacePage) => {
            // Either update the current schema only for the given workspace page or for all pages using the same
            // connection id (if no page id is given).
            if (workspace.connection.details.id === data.connectionInfo.connectionId
                || data.id === workspace.dataModelEntry.id) {
                const connectionState = this.connectionPresentation.get(workspace.dataModelEntry);
                if (connectionState) {
                    // Change for chat options
                    this.onChatOptionsChange(data.id.length > 0 ? data.id : workspace.dataModelEntry.id, {
                        options: {
                            ...connectionState.chatOptionsState.options,
                            schemaName: data.schema,
                        },
                    });

                    // Change existing editors.
                    connectionState.documentStates.forEach((state) => {
                        if (state.state) {
                            const contexts = state.state.model.executionContexts;
                            if (contexts) {
                                contexts.currentSchema = data.schema;
                            }
                        }
                    });
                }
            }
        });

        this.setState({ connectionWorkspaces });

        return true;
    };

    /**
     * Activates the overview page (no tab selected).
     */
    private showOverview(): void {
        this.setState({
            selectedPage: this.documentDataModel.overview.id,
            selectedWorkspace: homeWorkspaceId,
        });
        requisitions.executeRemote("selectConnectionWorkspace", { connectionId: -1 });

    }

    private runCommand = (details: { command: string; context: IExecutionContext; }): Promise<boolean> => {
        return new Promise((resolve) => {
            switch (details.command) {
                case "sendBlockUpdates": {
                    // Called when editor changes must be sent back to a host.
                    if (details.context.linkId) {
                        requisitions.executeRemote("codeBlocksUpdate", {
                            linkId: details.context.linkId,
                            code: details.context.code,
                        });
                        resolve(true);
                    }

                    break;
                }

                default: {
                    resolve(false);
                    break;
                }
            }
        });
    };

    /**
     * Called when the profile changes *after* the initial profile load.
     *
     * @returns A promise always fulfilled to true.
     */
    private profileLoaded = async (): Promise<boolean> => {
        await this.connectionsDataModel.reloadConnections();

        return true;
    };

    private webSessionStarted = async (): Promise<boolean> => {
        // A new web session was established while the module is active. That means previous editor sessions
        // are invalid now and we have to reopen new sessions.
        const { connectionWorkspaces } = this.state;

        await this.connectionsDataModel.closeAllConnections();
        for (const workspace of connectionWorkspaces) {
            const state = this.connectionPresentation.get(workspace.dataModelEntry);
            if (state) {
                await workspace.connection.refresh?.();
            }
        }

        return true;
    };

    private removeSession = async (details: IShellSessionDetails): Promise<boolean> => {
        await this.removeShellTab(details.sessionId);

        return true;
    };

    private showMrsDbObjectDialog = async (request: IMrsDbObjectEditRequest): Promise<boolean> => {
        if (this.mrsHubRef.current) {
            const workspace = this.getActiveConnectionWorkspace();
            if (workspace) {
                return this.mrsHubRef.current.showMrsDbObjectDialog(workspace.connection.backend, request);
            }
        }

        return false;
    };

    private showMrsConfigurationDialog = async (): Promise<boolean> => {
        if (this.mrsHubRef.current) {
            const workspace = this.getActiveConnectionWorkspace();
            if (workspace) {
                const result = await this.mrsHubRef.current.showMrsConfigurationDialog(
                    workspace.connection);
                if (result) {
                    const connection = await this.connectionsDataModel.findConnectionEntryById(
                        workspace.connection.details.id,
                        workspace.connection.details.folderPath,
                    );
                    if (connection) {
                        const connectionInfo = getConnectionInfoFromDetails(connection.details);
                        void requisitions.executeRemote("updateMrsRoot", connectionInfo);
                    }
                }

                return result;
            }
        }

        return false;
    };

    private showMrsServiceDialog = async (data?: IMrsServiceData): Promise<boolean> => {
        if (this.mrsHubRef.current) {
            const workspace = this.getActiveConnectionWorkspace();
            if (workspace) {
                const result = await this.mrsHubRef.current.showMrsServiceDialog(workspace.connection.backend, data);
                if (result) {
                    const connection = await this.connectionsDataModel.findConnectionEntryById(
                        workspace.connection.details.id,
                        workspace.connection.details.folderPath,
                    );
                    if (connection) {
                        const connectionInfo = getConnectionInfoFromDetails(connection.details);
                        void requisitions.executeRemote("updateMrsRoot", connectionInfo);
                    }
                }

                return result;
            }
        }

        return false;
    };

    private showMrsSchemaDialog = async (request: IMrsSchemaEditRequest): Promise<boolean> => {
        if (this.mrsHubRef.current) {
            const workspace = this.getActiveConnectionWorkspace();
            if (workspace) {
                await this.mrsHubRef.current.showMrsSchemaDialog(workspace.connection.backend, request.schemaName,
                    request.schema);

                return true;
            }
        }

        return false;
    };

    private showMrsContentSetDialog = async (request: IMrsContentSetEditRequest): Promise<boolean> => {
        if (this.mrsHubRef.current) {
            const workspace = this.getActiveConnectionWorkspace();
            if (workspace) {
                return this.mrsHubRef.current.showMrsContentSetDialog(workspace.connection.backend, request.directory,
                    request.contentSet, request.requestPath);
            }
        }

        return false;
    };

    private showMrsAuthAppDialog = async (request: IMrsAuthAppEditRequest): Promise<boolean> => {
        if (this.mrsHubRef.current) {
            const workspace = this.getActiveConnectionWorkspace();
            if (workspace) {
                return this.mrsHubRef.current.showMrsAuthAppDialog(workspace.connection.backend, request.authApp,
                    request.service);
            }
        }

        return false;
    };

    private showMrsUserDialog = async (request: IMrsUserEditRequest): Promise<boolean> => {
        if (this.mrsHubRef.current) {
            const workspace = this.getActiveConnectionWorkspace();
            if (workspace) {
                return this.mrsHubRef.current.showMrsUserDialog(workspace.connection.backend, request.authApp,
                    request.user);
            }
        }

        return false;
    };

    private showMrsSdkExportDialog = async (request: IMrsSdkExportRequest): Promise<boolean> => {
        if (this.mrsHubRef.current) {
            const workspace = this.getActiveConnectionWorkspace();
            if (workspace) {
                return this.mrsHubRef.current.showMrsSdkExportDialog(workspace.connection.backend, request.serviceId,
                    request.connectionId, request.connectionDetails, request.directory);
            }
        }

        return false;
    };

    private showCreateLibraryDialog = async (request: IDialogRequest): Promise<boolean> => {
        if (this.createLibraryDialogRef.current) {
            try {
                const workspace = this.getActiveConnectionWorkspace();
                if (!workspace) {
                    void ui.showErrorMessage(`Library cannot be created: no connection workspace`, {});

                    return false;
                }

                const element = document.activeElement;
                const response = await this.createLibraryDialogRef.current.show(request);
                if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
                    element.focus();
                }
                // handle response
                if (!response) {
                    await ui.showInformationMessage("Library could NOT be created!", {});

                    return true;
                }
                if (response === DialogResponseClosure.Cancel) {
                    return true;
                }

                const data = response as IDictionary;
                const schemaName = data.schemaName as string;
                const libraryName = data.libraryName as string;
                const language = data.language as string;
                const comment = data.comment as string;
                const body = data.body as string;
                const statusBarItem = ui.createStatusBarItem();
                statusBarItem.text = `$(loading~spin) Creating Library ${libraryName} in the DB...`;

                const created = await this.createLibraryInDb(workspace.connection.backend, schemaName, libraryName,
                    language, comment, body);
                if (!created) {
                    statusBarItem.dispose();

                    return false;
                }
                statusBarItem.dispose();
                await ui.showInformationMessage(
                    `${language} library ${schemaName}.${libraryName} successfully created!`, {});
                await workspace.connection.refresh?.();

                return true;
            } catch (error) {
                const message = convertErrorToString(error);
                void ui.showErrorMessage(`Error while adding the object: ${message}.`, {});

                return false;
            }
        }

        return false;
    };

    private async createLibraryInDb(backend: ShellInterfaceSqlEditor | undefined, schemaName: string,
        libraryName: string, language: string, comment: string, body: string): Promise<boolean> {
        if (!backend) {
            return false;
        }

        let commentPart = "";
        if (comment.length > 0) {
            commentPart = `COMMENT "${comment}"\n`;
        }

        let mleCounter = 1;
        let currentQuote;
        while (true) {
            currentQuote = `$${"mle".repeat(mleCounter)}$`;
            if (!body.includes(currentQuote)) {
                break;
            }
            mleCounter++;
        }

        if (language.toUpperCase() === "WEBASSEMBLY") {
            language = "WASM";
        }

        let completeBody = `CREATE LIBRARY \`${schemaName}\`.\`${libraryName}\`\n`;
        completeBody += `${commentPart}LANGUAGE ${language} AS ${currentQuote}\n${body}\n${currentQuote};`;
        if (!backend.hasSession) {
            void ui.showErrorMessage(`Library cannot be created on the server because NO open session`, {});

            return false;
        }
        try {
            await backend.executeService(completeBody);
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Error while creating library: ${message}`, {});

            return false;
        }

        return true;
    }

    private openSession = async (details: IShellSessionDetails): Promise<boolean> => {
        const canClose = await this.canCurrentTabClose();
        if (!canClose) {
            return true;
        }

        await this.activateShellTab(details.sessionId, details.dbConnectionId, details.caption);

        return true;
    };

    private connectionStateChanged = async (): Promise<boolean> => {
        return true;
    };

    private doLogout = async (): Promise<boolean> => {
        await this.connectionsDataModel.clear();
        this.documentDataModel.clear();
        this.ociDataModel.clear();
        webSession.clearCredentials();

        // No need to manually close any connection. The data models take care to close when they are cleared.
        this.setState({
            connectionWorkspaces: [],
            documentTabs: [],
            schemaDiagramTabs: [],
            shellSessionTabs: [],
            selectedPage: this.documentDataModel.overview.id,
            selectedWorkspace: homeWorkspaceId,
        });

        return requisitions.execute("userLoggedOut", {});
    };

    private handleImportWorkbenchConnections = async (): Promise<boolean> => {
        const files: File[] | null = await selectFileInBrowser([".xml"], false);
        if (files && files.length > 0) {
            const file = files[0];
            const reader = new FileReader();

            reader.onload = (e) => {
                const xmlString = e.target?.result?.toString() ?? "";
                void ConnectionProcessor.importMySQLWorkbenchConnections(xmlString, this.connectionsDataModel);
            };

            reader.readAsText(file);
        }

        return true;
    };

    private handleNewSchemaDiagram = async (): Promise<boolean> => {
        const { schemaDiagramTabs } = this.state;

        try {
            this.setProgressMessage("Creating new EER Diagram ...");

            const diagram = await ShellInterface.msm.getSchemaDiagram();

            const parameters = {
                type: OdmEntityType.SchemaDiagram,
                parameters: {
                    pageId: uuid(),
                    id: uuid(),
                    caption: diagram.caption,
                    diagram,
                },
            };

            const document = this.documentDataModel.openDocument(undefined, parameters) as IOdmSchemaDiagramEntry;

            schemaDiagramTabs.push({
                dataModelEntry: document,
                savedState: {
                    xOffset: 0,
                    yOffset: 0,
                    zoom: 1,
                },
            });

            await this.setStatePromise({
                schemaDiagramTabs,
                selectedPage: document.id,
                selectedWorkspace: generalWorkspaceId,
                loading: false,
            });
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Connection Error: ${message}`, {});

            const { lastSelectedPage } = this.state;
            const selectedPage = lastSelectedPage ?? this.documentDataModel.overview.id;
            await this.setStatePromise({
                selectedPage,
                selectedWorkspace: selectedPage === this.documentDataModel.overview.id
                    ? homeWorkspaceId
                    : this.getWorkspaceIdForPageId(selectedPage) ?? this.state.selectedWorkspace,
            });
            this.hideProgress(true);
        }

        return true;
    };

    private showJdvObjectDialog = async (request: IJdvEditRequest): Promise<boolean> => {
        if (this.jdvHubRef.current) {
            const workspace = this.getActiveConnectionWorkspace();
            if (workspace) {
                return this.jdvHubRef.current.showJdvObjectDialog(workspace.connection.backend, request);
            }
        }

        return false;
    };

    /**
     * Activates the workspace page for the given connection. If the workspace page already exists it is simply
     * activated, otherwise a new workspace page is created.
     *
     * @param entry The connection for which to open/activate the workspace page.
     * @param createNewWorkspace If true then create a new workspace page, even if one for the same connection already
     * exists.
     * @param suppressAbout If true then no about text is show when opening the workspace page.
     * @param initialEditor Indicates what type of editor to open initially.
     * @param serviceOnly If true then create/use a workspace page backed by the service-only connection.
     *
     * @returns A promise fulfilled once the connection workspace page is added.
     */
    private activateConnectionWorkspace = async (entry: ICdmConnectionEntry, createNewWorkspace: boolean,
        suppressAbout: boolean,
        initialEditor?: InitialEditor, serviceOnly = initialEditor === "none"): Promise<boolean> => {
        let selectedPage = createNewWorkspace ? undefined : this.resolveLatestConnectionPageId(entry, serviceOnly);

        if (selectedPage && !createNewWorkspace) {
            await this.setStatePromise({
                selectedPage,
                selectedWorkspace: this.getConnectionWorkspaceId(entry.details.id, selectedPage),
            });
        } else {
            this.showProgress();
            this.setProgressMessage("Starting editor session...");

            // Create a new connection entry for the workspace page. It's open by default.
            try {
                const newEntry = this.connectionsDataModel.createConnectionEntry(entry.details);
                if (serviceOnly) {
                    await newEntry.initializeServiceOnly();
                } else {
                    await newEntry.initialize();
                }

                const pageId = uuid();
                if (serviceOnly) {
                    this.serviceOnlyConnectionPages.add(pageId);
                }
                await this.addConnectionWorkspace(newEntry, suppressAbout, initialEditor, pageId);
                if (this.state.connectionWorkspaces.some((candidate) => {
                    return candidate.dataModelEntry.id === pageId;
                })) {
                    selectedPage = pageId;
                } else {
                    this.serviceOnlyConnectionPages.delete(pageId);
                }
            } catch (error) {
                if (!serviceOnly && this.shouldOpenOfflineAdministrationWorkspace(entry, error)) {
                    const probe = await localServerProbeFromBackend(entry.details, (kind, target, port) => {
                        return ShellInterface.core.probeLocalConnectionEndpoint(kind, target, port);
                    });
                    const offlineEntry = this.connectionsDataModel.createConnectionEntry(entry.details);
                    offlineEntry.initializeOffline(probe);
                    const pageId = uuid();

                    this.serviceOnlyConnectionPages.add(pageId);
                    await this.addConnectionWorkspace(offlineEntry, suppressAbout, "none", pageId);
                    selectedPage = this.openOfflineServerStatusPage(offlineEntry, pageId);
                } else {
                    void ui.showErrorMessage(convertErrorToString(error), {});
                }
            } finally {
                this.hideProgress(true);
            }
        }
        if (selectedPage) {
            const workspace = this.state.connectionWorkspaces.find((candidate) => {
                return candidate.dataModelEntry.id === selectedPage;
            });
            if (workspace) {
                this.rememberConnectionPage(workspace);
            }
        }

        // Always return true to indicated we handled the request.
        return true;
    };

    private shouldOpenOfflineAdministrationWorkspace(entry: ICdmConnectionEntry, error: unknown): boolean {
        return this.isElectronWorkspaceLayout()
            && this.getResolvedSelectedWorkspaceId() === homeWorkspaceId
            && isLocalOfflineConnectionCandidate(entry.details)
            && isClientConnectionError(error);
    }

    private openOfflineServerStatusPage(connection: ICdmConnectionEntry, pageId: string): string | undefined {
        const page = connection.adminEntry?.pages.find((candidate) => {
            return candidate.pageType === "serverStatus";
        });

        if (!page) {
            this.serviceOnlyConnectionPages.delete(pageId);

            return undefined;
        }

        const workspace = this.state.connectionWorkspaces.find((candidate) => {
            return candidate.dataModelEntry.id === pageId;
        });

        if (!workspace) {
            this.serviceOnlyConnectionPages.delete(pageId);

            return undefined;
        }

        const document = this.documentDataModel.openDocument(undefined, {
            type: OdmEntityType.AdminPage,
            parameters: {
                id: `${page.id}__${pageId}`,
                pageId,
                connection: connection.details,
                caption: page.caption,
                pageType: page.pageType,
            },
        });

        if (!document) {
            this.serviceOnlyConnectionPages.delete(pageId);

            return undefined;
        }

        this.handleSelectItem({ pageId: workspace.dataModelEntry.id, document });
        this.servicePagesByConnection.set(connection.details.id, workspace.dataModelEntry.id);

        return pageId;
    }

    /**
     * Creates a new connection workspace page and initializes the saved state for it.
     *
     * @param connection The new connection for which to add the workspace page.
     * @param suppressAbout If true then no about text is shown.
     * @param initialEditor Determines what type of editor to open initially.
     * @param pageId The id of the page.
     *
     * @returns A promise which fulfills once the connection is open.
     */
    private async addConnectionWorkspace(connection: ICdmConnectionEntry,
        suppressAbout: boolean, initialEditor: InitialEditor = "default", pageId: string): Promise<boolean> {

        const { connectionWorkspaces } = this.state;

        try {
            this.setProgressMessage("Connection opened, creating the editor...");

            const caption = this.resolveTabCaption(connection);
            const tab = this.documentDataModel.addConnectionWorkspace(undefined, connection.details, pageId, caption);

            // Once the connection is open we can create the editor.
            let currentSchema = "";
            if (connection.currentSchema) {
                currentSchema = connection.currentSchema;
            } else if (connection.details.dbType === DBType.MySQL) {
                currentSchema = (connection.details.options as IMySQLConnectionOptions).schema ?? "";
            }

            const details = connection.details;
            const sqlMode = details.sqlMode ?? Settings.get("editor.sqlMode", "");
            const serverVersion = details.version ?? Settings.get("editor.dbVersion", 80024);
            const heatWaveEnabled = details.heatWaveAvailable ?? false;
            const mleEnabled = details.mleAvailable ?? false;
            const hasExplainError = details.hasExplainError ?? false;
            const isCloudInstance = details.isCloudInstance ?? false;

            const entryId = uuid();
            let useNotebook;
            if (connection.details.settings?.defaultEditor) {
                useNotebook = connection.details.settings.defaultEditor === ConnectionEditorType.DbNotebook;
            } else {
                useNotebook = Settings.get("dbEditor.defaultEditor", "script") === "notebook";
            }

            // Get the execution history entries for this connection, but only fetch the first 30 chars of the code
            // for preview purposes
            const executionHistory = connection.isOffline
                ? []
                : await connection.backend.getExecutionHistoryEntries(connection.details.id, 30);

            let type: LeafDocumentType;
            if (initialEditor === "default") {
                type = useNotebook ? OdmEntityType.Notebook : OdmEntityType.Script;
            } else {
                type = initialEditor === "notebook" ? OdmEntityType.Notebook : OdmEntityType.Script;
            }

            const language: EditorLanguage = type === OdmEntityType.Notebook ? "msg" : "mysql";

            const documentStates: IOpenDocumentState[] = [];

            let newState: Mutable<Partial<IOpenDocumentState>> | undefined;
            const editorCaption = type === OdmEntityType.Script ? "Script" : "DB Notebook";

            if (initialEditor !== "none") {
                const model = this.createEditorModel(connection.backend, "", language, serverVersion, sqlMode,
                    currentSchema);

                newState = {
                    state: {
                        model,
                        viewState: null,
                        options: defaultEditorOptions,
                    },
                    autoExecuteAbout: type === OdmEntityType.Notebook,
                    currentVersion: model.getVersionId(),
                };
                documentStates.push(newState as IOpenDocumentState);
            }

            const connectionState: IConnectionPresentationState = {
                activeEntry: entryId,
                documents: [],
                documentStates,
                heatWaveEnabled,
                mleEnabled,
                isCloudInstance,
                adminPageStates: {
                    lakehouseNavigatorState: {
                        activeTabId: LakehouseNavigatorTab.Overview,
                    },
                    clientConnectionsState: {},
                    enterpriseBackupState: {},
                },
                graphData: {
                    timestamp: 0,
                    activeColorScheme: "classic",
                    displayInterval: 50,
                    currentValues: new Map(),
                    computedValues: {},
                    series: new Map(),
                },

                // Chat option defaults
                chatOptionsState: {
                    chatOptionsExpanded: false,
                    chatOptionsWidth: -1,
                    options: {
                        schemaName: currentSchema !== "" ? currentSchema : undefined,
                        modelOptions: {
                            modelId: "default",
                        },
                    },
                },

                executionHistory,
                currentExecutionHistoryIndex: 0,
                hasExplainError,
            };

            this.connectionPresentation.set(tab, connectionState);

            connectionWorkspaces.push({
                dataModelEntry: tab,
                connection,
                suppressAbout,
            });

            if (newState) {
                const parameters = {
                    type,
                    parameters: {
                        pageId,
                        id: entryId,
                        caption: editorCaption,
                        connection: connection.details,
                        language,
                    },
                };

                const document = this.documentDataModel.openDocument(undefined, parameters);
                if (document) {
                    connectionState.documents.push(document);
                    newState.document = document;

                    this.notifyRemoteEditorOpen(tab.id, document, connection.details);
                }

            }

            this.hideProgress(false);
            await this.setStatePromise({
                connectionWorkspaces,
                selectedPage: tab.id,
                selectedWorkspace: this.getConnectionWorkspaceId(connection.details.id, tab.id),
                loading: false,
            });
        } catch (reason) {
            const message = convertErrorToString(reason);
            void ui.showErrorMessage(`Connection Error: ${message}`, {});

            const { lastSelectedPage } = this.state;
            const selectedPage = lastSelectedPage ?? this.documentDataModel.overview.id;
            await this.setStatePromise({
                selectedPage,
                selectedWorkspace: selectedPage === this.documentDataModel.overview.id
                    ? homeWorkspaceId
                    : this.getWorkspaceIdForPageId(selectedPage) ?? this.state.selectedWorkspace,
            });
            this.hideProgress(true);
        }

        return true;
    }

    private canCloseTab = async (id: string): Promise<boolean> => {
        const { selectedPage } = this.state;
        const connectionDocument = this.findConnectionDocumentLocation(id);
        if (connectionDocument) {
            const { connectionState, documentState, workspace } = connectionDocument;
            const isActiveDocument = connectionState.activeEntry === id && workspace.dataModelEntry.id === selectedPage;
            if (isActiveDocument && this.currentConnectionWorkspaceRef.current) {
                return this.currentConnectionWorkspaceRef.current.confirmClose();
            }

            if (!this.isDocumentDirty(documentState)) {
                return true;
            }

            return (await ui.confirm(
                "This tab has unsaved changes. Do you want to discard them and close the tab?",
                "Discard",
                "Cancel",
            )) === "Discard";
        }

        const connectionWorkspace = this.state.connectionWorkspaces.find((candidate) => {
            return candidate.dataModelEntry.id === id;
        });

        if (connectionWorkspace) {
            return this.confirmCloseConnectionWorkspace(connectionWorkspace);
        }

        return true;
    };

    private confirmCloseConnectionWorkspace = async (connectionWorkspace: IConnectionWorkspacePage): Promise<boolean> => {
        const workspacePageId = connectionWorkspace.dataModelEntry.id;
        const connectionWorkspaceRef = this.connectionWorkspaceRefs.get(workspacePageId)
            ?? (this.currentConnectionWorkspaceRef.current?.props?.id === workspacePageId ? this.currentConnectionWorkspaceRef.current : null);
        if (connectionWorkspaceRef) {
            return connectionWorkspaceRef.confirmCloseAll();
        }

        const connectionState = this.connectionPresentation.get(connectionWorkspace.dataModelEntry);
        if (!connectionState) {
            return true;
        }

        for (const editorState of connectionState.documentStates) {
            if (editorState.document.type === OdmEntityType.Notebook
                && !await (editorState.state?.model.executionContexts?.canClose() ?? true)) {
                return false;
            }
        }

        const hasDirtyEditor = connectionState.documentStates.some((editorState) => {
            return this.isDocumentDirty(editorState);
        });
        if (!hasDirtyEditor) {
            return true;
        }

        return (await ui.confirm(
            "This tab has unsaved changes. Do you want to discard them and close the tab?",
            "Discard",
            "Cancel",
        )) === "Discard";
    };

    private handleWorkspaceTabSelection = (pageId: string): void => {
        const connectionDocument = this.findConnectionDocumentLocation(pageId);
        if (connectionDocument) {
            void this.handleDocumentSelection(connectionDocument.documentState.document);

            return;
        }

        this.handleSelectTab(pageId);
    };

    /**
     * Handles closing of a single tab (via its close button).
     *
     * @param e The mouse event.
     */
    private handleCloseTab = (e: MouseEvent | KeyboardEvent): void => {
        e.stopPropagation();
        const id = (e.currentTarget as HTMLElement).id;

        void this.canCloseTab(id).then((canClose) => {
            if (canClose) {
                void this.removeTabs([id]);
            }
        });
    };

    private handleCloseWorkspace = (e: MouseEvent | KeyboardEvent, workspaceId: string): void => {
        e.stopPropagation();
        e.preventDefault();
        this.workspaceSelectorRef.current?.close(false);

        void this.closeWorkspace(workspaceId);
    };

    private closeWorkspace = async (workspaceId: string): Promise<boolean> => {
        const workspace = this.getWorkspaceById(workspaceId);
        if (workspace?.kind !== "connection") {
            return false;
        }

        for (const pageId of workspace.pageIds) {
            if (!await this.canCloseTab(pageId)) {
                return true;
            }
        }

        return this.removeTabs(workspace.pageIds);
    };

    private updateAppTabsState = (state: Partial<IDocumentModuleState>, closingIds: string[]): void => {
        const connectionWorkspaces = state.connectionWorkspaces ?? this.state.connectionWorkspaces;
        const documentTabs = state.documentTabs ?? this.state.documentTabs;
        const schemaDiagramTabs = state.schemaDiagramTabs ?? this.state.schemaDiagramTabs;
        const shellSessionTabs = state.shellSessionTabs ?? this.state.shellSessionTabs;
        const nextState: Partial<IDocumentModuleState> = {
            ...state,
            connectionWorkspaces,
            documentTabs,
            schemaDiagramTabs,
            shellSessionTabs,
        };

        if (this.isElectronWorkspaceLayout()) {
            const mergedState = {
                ...this.state,
                ...nextState,
            } as IDocumentModuleState;
            const activeWorkspaceId = this.getResolvedSelectedWorkspaceId();
            const activeWorkspacePageIds = this.getWorkspacePageIds(activeWorkspaceId, mergedState);

            if (activeWorkspaceId === homeWorkspaceId) {
                nextState.selectedWorkspace = homeWorkspaceId;
                nextState.selectedPage = this.documentDataModel.overview.id;
            } else if (activeWorkspacePageIds.length > 0) {
                nextState.selectedWorkspace = activeWorkspaceId;
                nextState.selectedPage = Tabview.getSelectedPageId(
                    activeWorkspacePageIds,
                    this.getVisiblePageId() ?? "",
                    closingIds,
                    activeWorkspacePageIds[activeWorkspacePageIds.length - 1]!,
                );
            } else if (activeWorkspaceId === generalWorkspaceId) {
                nextState.selectedWorkspace = generalWorkspaceId;
                nextState.selectedPage = this.documentDataModel.overview.id;
            } else {
                nextState.selectedWorkspace = homeWorkspaceId;
                nextState.selectedPage = this.documentDataModel.overview.id;
            }

            this.setState(nextState);

            return;
        }

        const remainingPageIds: string[] = [];
        shellSessionTabs.forEach((info) => {
            remainingPageIds.push(info.dataModelEntry.id);
        });

        connectionWorkspaces.forEach((info) => {
            remainingPageIds.push(info.dataModelEntry.id);
        });

        documentTabs.forEach((info) => {
            remainingPageIds.push(info.dataModelEntry.id);
        });

        schemaDiagramTabs.forEach((info) => {
            remainingPageIds.push(info.dataModelEntry.id);
        });

        const newSelection = Tabview.getSelectedPageId(remainingPageIds, this.state.selectedPage, closingIds,
            this.documentDataModel.overview.id);
        nextState.selectedPage = newSelection;

        this.setState(nextState);
    };

    private resetConnectionSuffixes(state: Partial<IDocumentModuleState>): void {
        if (!state.connectionWorkspaces) {
            this.maxConnectionDocumentSuffix = new Map();

            return;
        }

        const activeConnectionIds = new Set<number>();
        state.connectionWorkspaces.forEach((connectionWorkspace) => {
            activeConnectionIds.add(connectionWorkspace.dataModelEntry.details.id);
        });

        const obsoleteConnectionIds: number[] = [];
        this.maxConnectionDocumentSuffix.forEach((_, connectionId) => {
            if (!activeConnectionIds.has(connectionId)) {
                obsoleteConnectionIds.push(connectionId);
            }
        });

        obsoleteConnectionIds.forEach((connectionId) => {
            this.maxConnectionDocumentSuffix.delete(connectionId);
        });
    }

    /**
     * Completely removes a page, with all its editors (if the page is a connection workspace).
     *
     * @param pageIds The list of page IDs to remove. For standalone documents this is equal to the document ID.
     * @returns A promise resolving to true, when the page removal is finished.
     */
    private removeTabs = async (pageIds: string[]): Promise<boolean> => {
        if (!pageIds.length) {
            return true;
        }
        const { connectionWorkspaces, documentTabs, schemaDiagramTabs, shellSessionTabs } = this.state;
        const connectionDocumentIds = pageIds.filter((id) => {
            return this.findConnectionDocumentLocation(id) !== undefined;
        });
        const actualTabIds = pageIds.filter((id) => {
            return !connectionDocumentIds.includes(id);
        });

        if (connectionDocumentIds.length > 0) {
            await Promise.all(connectionDocumentIds.map(async (id) => {
                await ApplicationDB.removeDataByTabId(StoreType.Document, id);
                const connectionDocument = this.findConnectionDocumentLocation(id);
                if (connectionDocument) {
                    await this.closeConnectionDocument(connectionDocument, false);
                }
            }));
        }

        if (actualTabIds.length === 0) {
            return true;
        }

        const closingTabs: Pick<IDocumentModuleState, "shellSessionTabs" | "connectionWorkspaces" | "documentTabs" |
            "schemaDiagramTabs"> = {
            shellSessionTabs: [],
            connectionWorkspaces: [],
            documentTabs: [],
            schemaDiagramTabs: [],
        };
        const remainingTabsState: Pick<IDocumentModuleState, "shellSessionTabs" | "connectionWorkspaces" | "documentTabs" |
            "schemaDiagramTabs"> = {
            shellSessionTabs: [],
            connectionWorkspaces: [],
            documentTabs: [],
            schemaDiagramTabs: [],
        };

        shellSessionTabs.forEach((info) => {
            if (actualTabIds.includes(info.dataModelEntry.id)) {
                closingTabs.shellSessionTabs.push(info);
            } else {
                remainingTabsState.shellSessionTabs.push(info);
            }
        });

        connectionWorkspaces.forEach((info) => {
            if (actualTabIds.includes(info.dataModelEntry.id)) {
                closingTabs.connectionWorkspaces.push(info);
            } else {
                remainingTabsState.connectionWorkspaces.push(info);
            }
        });

        documentTabs.forEach((info) => {
            if (actualTabIds.includes(info.dataModelEntry.id)) {
                closingTabs.documentTabs.push(info);
            } else {
                remainingTabsState.documentTabs.push(info);
            }
        });

        schemaDiagramTabs.forEach((info) => {
            if (actualTabIds.includes(info.dataModelEntry.id)) {
                closingTabs.schemaDiagramTabs.push(info);
            } else {
                remainingTabsState.schemaDiagramTabs.push(info);
            }
        });

        await Promise.all(actualTabIds.map(async (id) => {
            // Remove all result data from the application DB.
            await ApplicationDB.removeDataByTabId(StoreType.Document, id);
        }));

        await Promise.all(closingTabs.shellSessionTabs.map(async (info) => {
            await this.removeShellTab(info.dataModelEntry.id, false);
        }));

        await Promise.all(closingTabs.connectionWorkspaces.map(async (info) => {
            await this.removeConnectionWorkspace(info);
        }));

        closingTabs.documentTabs.forEach((info) => {
            this.removeDocument(info.dataModelEntry.id, info.dataModelEntry.id);
        });

        closingTabs.schemaDiagramTabs.forEach((info) => {
            this.removeDocument(info.dataModelEntry.id, info.dataModelEntry.id);
        });

        this.updateAppTabsState(remainingTabsState, actualTabIds);
        this.resetConnectionSuffixes(remainingTabsState);

        return true;
    };

    /**
     * Similar to `removeTabs`, but for connection workspaces.
     *
     * @param info Connection workspace information
     *
     * @returns A promise resolving to true, when the workspace page removal is finished.
     */
    private removeConnectionWorkspace = async (info: IConnectionWorkspacePage): Promise<boolean> => {
        const { connectionWorkspaces } = this.state;

        const pageId = info.dataModelEntry.id;
        const page = info.dataModelEntry;
        const connectionState = this.connectionPresentation.get(page);

        this.forgetConnectionPage(info);

        // Render is based on the connectionWorkspaces content, it is needed to delete the
        // connection workspace to avoid race conditions if the connectionPresentation is
        // deleted first
        const index = connectionWorkspaces.findIndex((tab) => {
            return tab === info;
        });

        if (index > -1) {
            connectionWorkspaces.splice(index, 1);
        }

        if (connectionState) {
            this.notifyRemoteEditorClose(pageId);

            this.removeDocument(pageId, undefined, page.details);

            // Release all editor models.
            connectionState.documentStates.forEach((editor) => {
                const model = editor.state?.model;
                if (model) {
                    model.executionContexts?.dispose();
                    model.dispose();
                }
            });

            this.connectionPresentation.delete(page);

            // Note: this connection is not part of the data model, so we don't have to remove it from there.
            // Instead it was cloned when the tab was created.
            await info.connection.close();
        }

        return true;
    };

    /**
     * Similar to `removeTabs`, but for document tabs.
     *
     * @param pageId The id of the page to remove.
     * @param documentId The id of the document to remove, optional.
     * @param details The connection details.
     */
    private removeDocument = (pageId: string, documentId?: string, details?: IConnectionDetails): void => {
        this.documentDataModel.closeDocument(undefined, {
            pageId,
            connectionInfo: details ? getConnectionInfoFromDetails(details) : undefined,
            id: documentId,
        });
    };

    /**
     * Similar to `removeTab`, but for shell session tabs.
     *
     * @param id The session (tab) id to remove.
     * @param updateAppState Whether application state and tabs have to be updated, defaults to true.
     *
     * @returns A promise resolving to true, when the tab removal is finished.
     */
    private removeShellTab = async (id: string, updateAppState = true): Promise<boolean> => {
        const { shellSessionTabs } = this.state;

        if (updateAppState) {
            // Remove all result data from the application DB.
            void ApplicationDB.removeDataByTabId(StoreType.Shell, id);
        }

        const index = shellSessionTabs.findIndex((info) => {
            return info.dataModelEntry.id === id;
        });

        if (index > -1) {
            this.documentDataModel.removeShellSession(undefined, id);

            const session = shellSessionTabs[index];
            await session.savedState.backend.closeShellSession();

            shellSessionTabs.splice(index, 1);
            requisitions.executeRemote("sessionRemoved", session.dataModelEntry.details);
        }

        if (updateAppState) {
            this.updateAppTabsState({ shellSessionTabs: [...shellSessionTabs] }, [id]);
        }

        return true;
    };

    private addNewConsole = (e: MouseEvent | KeyboardEvent): void => {
        e.stopPropagation();

        if (this.currentConnectionWorkspaceRef.current) {
            void this.currentConnectionWorkspaceRef.current.canClose().then((canClose) => {
                if (!canClose) {
                    return;
                }
            });
        }

        void this.openConsoleForCurrentWorkspace();
    };

    /**
     * This menu click handler is only used in the VS Code extension to offer a quick way to add new script files
     * or to open another notebook. Scripts created here are not stored in the user's script tree.
     *
     * @param props The properties of the item which was clicked.
     *
     * @returns Always true (to close the menu after the click).
     */
    private handleNewScriptClick = (props: IMenuItemProperties): boolean => {
        void this.getOrCreateSelectedUserConnectionWorkspace().then((page) => {
            const connectionId = page?.connection.details.id;
            if (!page) {
                return;
            }

            switch (props.id) {
                case "addEditor": {
                    this.handleAddNotebook(page.dataModelEntry.id);

                    break;
                }

                case "addSQLScript": {
                    requisitions.executeRemote("createNewEditor", {
                        connectionId,
                        language: page.connection.details.dbType === DBType.MySQL ? "mysql" : "sql",
                    });

                    break;
                }

                case "addTSScript": {
                    requisitions.executeRemote("createNewEditor", {
                        connectionId,
                        language: "typescript",
                    });

                    break;
                }

                case "addJSScript": {
                    requisitions.executeRemote("createNewEditor", {
                        connectionId,
                        language: "javascript",
                    });

                    break;
                }

                default:
            }
        });

        return true;
    };

    private editorSaved = (_details: { id: string, newName: string, saved: boolean; }): Promise<boolean> => {
        // TODO: this is called when the host saves a document, to notify us about a name change. Handle that.
        return Promise.resolve(false);
    };

    private handleDesktopWindowCloseRequested = async (
        details?: { requestId?: string; },
    ): Promise<boolean> => {
        const requestId = details?.requestId;
        if (typeof requestId !== "string" || requestId.length === 0) {
            return false;
        }

        const allow = await this.confirmWindowClose();
        requisitions.executeRemote("desktopWindowCloseResponse", { requestId, allow });

        return true;
    };

    private handleCloseDocument = async (
        details: { connectionId?: number, documentId: string, pageId?: string; }): Promise<boolean> => {
        const connectionDocument = this.findConnectionDocumentLocation(details.documentId);
        if (connectionDocument) {
            return this.closeConnectionDocument(connectionDocument);
        }

        return this.removeTabs([details.documentId]);
    };

    private closeConnectionDocument = async (
        location: IConnectionDocumentLocation,
        confirmActiveClose = true,
    ): Promise<boolean> => {
        const { workspace, connectionState, documentState } = location;

        if (confirmActiveClose && connectionState.activeEntry === documentState.document.id) {
            const canClose = this.currentConnectionWorkspaceRef.current ? (await this.currentConnectionWorkspaceRef.current.confirmClose()) : true;
            if (!canClose) {
                return true;
            }
        }

        const index = connectionState.documentStates.findIndex((state: IOpenDocumentState) => {
            return state.document.id === documentState.document.id;
        });

        if (index === -1) {
            return false;
        }

        if (connectionState.activeEntry === documentState.document.id) {
            if (index > 0) {
                connectionState.activeEntry = connectionState.documentStates[index - 1]!.document.id;
            } else if (index < connectionState.documentStates.length - 1) {
                connectionState.activeEntry = connectionState.documentStates[index + 1]!.document.id;
            }
        }

        connectionState.documentStates.splice(index, 1);

        if (connectionState.documentStates.length === 0) {
            this.maxConnectionDocumentSuffix = new Map();
            this.forgetConnectionPage(workspace);

            return this.removeTabs([workspace.dataModelEntry.id]);
        }

        this.notifyRemoteEditorClose(workspace.dataModelEntry.id, documentState.document.id,
            workspace.connection.details.id, workspace.connection.details);
        this.removeDocument(workspace.dataModelEntry.id, documentState.document.id, workspace.connection.details);

        this.forceUpdate();

        return true;
    };

    private handleSelectDocument = async (details: {
        connectionId?: number, documentId: string;
        pageId?: string;
    }): Promise<boolean> => {
        let document;
        if (!details.connectionId) {
            document = this.documentDataModel.findDocument(undefined, details.documentId, details.pageId);
        } else {
            document = this.documentDataModel.findConnectionDocument(undefined, details.documentId,
                details.connectionId, details.pageId);
        }

        if (document) {
            await this.handleDocumentSelection(document);

            return true;
        } else {
            return this.showPage({});
        }
    };

    private createNewEditor = async (details: INewEditorRequest): Promise<boolean> => {
        const pageId = (await this.getOrCreateSelectedUserConnectionPageEntry())?.id;

        // Currently this is only used to create a new notebook.
        if (details.language === "msg" && pageId) {
            this.handleAddNotebook(pageId);
        }

        return Promise.resolve(true);
    };

    /**
     * Activate the page with the given id. Before switching the page is checked if it can be closed,
     * that is, there are no pending changes in the editors.
     *
     * @param pageId The id of the page to activate.
     */
    private handleSelectTab = (pageId: string): void => {
        const { selectedPage } = this.state;

        if (selectedPage !== pageId) {
            if (this.currentConnectionWorkspaceRef.current) {
                // The current tab ref is only set for connection workspaces.
                void this.currentConnectionWorkspaceRef.current.canClose().then((canClose) => {
                    if (canClose) {
                        this.doSwitchTab(pageId);
                    }
                });
            } else {
                this.doSwitchTab(pageId);
            }
        }
    };

    /**
     * Here we know a new page can be activated. This method does the actual switch.
     *
     * @param pageId The id of the page to activate.
     */
    private doSwitchTab(pageId: string): void {
        const { connectionWorkspaces, documentTabs, schemaDiagramTabs, shellSessionTabs } = this.state;

        if (pageId === this.documentDataModel.overview.id) {
            this.showOverview();

            return;
        }

        if (pageId === debuggerWorkspacePageId && this.state.debuggerWorkspaceVisible === true) {
            this.setState({
                selectedPage: debuggerWorkspacePageId,
                selectedWorkspace: debuggerWorkspaceId,
            });

            return;
        }

        // Now get the tab we want to switch to.
        const tab = connectionWorkspaces.find((entry) => {
            return entry.dataModelEntry.id === pageId;
        });

        if (tab) {
            this.rememberConnectionPage(tab);
            this.setState({
                selectedPage: pageId,
                selectedWorkspace: this.getConnectionWorkspaceId(tab.connection.details.id, tab.dataModelEntry.id),
            });

            requisitions.executeRemote("selectConnectionWorkspace", {
                connectionId: tab.connection.details.id,
                pageId: tab.dataModelEntry.id,
            });
        } else {
            const docTab = documentTabs.find((entry) => {
                return entry.dataModelEntry.id === pageId;
            });

            if (docTab) {
                this.setState({
                    selectedPage: docTab.dataModelEntry.id,
                    selectedWorkspace: generalWorkspaceId,
                });
            } else {
                const schemaDiagramTab = schemaDiagramTabs.find((entry) => {
                    return entry.dataModelEntry.id === pageId;
                });

                if (schemaDiagramTab) {
                    this.setState({
                        selectedPage: schemaDiagramTab.dataModelEntry.id,
                        selectedWorkspace: this.getWorkspaceIdForPageId(schemaDiagramTab.dataModelEntry.id)
                            ?? generalWorkspaceId,
                    });
                } else {
                    const shellTab = shellSessionTabs.find((entry) => {
                        return entry.dataModelEntry.id === pageId;
                    });

                    if (shellTab) {
                        this.setState({
                            selectedPage: shellTab.dataModelEntry.id,
                            selectedWorkspace: this.getWorkspaceIdForPageId(shellTab.dataModelEntry.id)
                                ?? generalWorkspaceId,
                        });
                    }
                }
            }
        }
    }

    /**
     * This method creates a notebook and notifies the host about it.
     *
     * @param pageId The id of the page to add the notebook to.
     *
     * @returns A unique id for the new editor, if one was created.
     */
    private handleAddNotebook = (pageId: string): string | undefined => {
        const { connectionWorkspaces } = this.state;

        const tab = connectionWorkspaces.find((entry) => {
            return entry.dataModelEntry.id === pageId;
        });

        if (tab) { // Sanity check. Should always succeed.
            const connectionState = this.connectionPresentation.get(tab.dataModelEntry);
            if (connectionState) {
                const connection = tab.connection;
                const model = this.createEditorModel(connection.backend, "", "msg", connection.details.version ?? 0,
                    connection.details.sqlMode ?? "", connection.currentSchema);

                const autoExecuteAbout = !connectionState.documentStates.some((state) => {
                    return state.document.type === OdmEntityType.Notebook;
                });

                const editorId = uuid();
                const caption = `DB Notebook ${++this.documentCounter}`;
                const newState: Mutable<Partial<IOpenDocumentState>> = {
                    state: {
                        model,
                        viewState: null,
                        options: defaultEditorOptions,
                    },
                    autoExecuteAbout,
                    currentVersion: model.getVersionId(),
                };
                connectionState.documentStates.push(newState as IOpenDocumentState);
                connectionState.activeEntry = editorId;

                const document = this.documentDataModel.openDocument(undefined, {
                    type: OdmEntityType.Notebook,
                    parameters: {
                        pageId: pageId,
                        id: editorId,
                        connection: connection.details,
                        caption,
                    },
                });

                if (document) {
                    newState.document = document;
                }

                this.notifyRemoteEditorOpen(pageId, document as LeafDocumentEntry, connection.details);
                this.forceUpdate();

                return editorId;
            }
        }
    };

    private handleLoadScript = (pageId: string, editorId: string, content: string): void => {
        const { connectionWorkspaces } = this.state;
        const tab = connectionWorkspaces.find((entry) => {
            return entry.dataModelEntry.id === pageId;
        });

        if (tab) {
            const connectionState = this.connectionPresentation.get(tab.dataModelEntry);
            if (connectionState) {
                const editor = connectionState.documentStates.find((candidate: IOpenDocumentState) => {
                    return candidate.document.id === editorId;
                });

                editor?.state?.model.setValue(content);
            }
        }
    };

    /**
     * Activates a specific editor on a connection workspace or creates new pages for special pages, like
     * admin pages or external scripts.
     *
     * @param details The details of the selected entry.
     */
    private handleSelectItem = (details: ISelectItemDetails): void => {
        const { connectionWorkspaces } = this.state;

        if (details.document.type === OdmEntityType.StandaloneDocument) {
            this.doSwitchTab(details.document.id);

            return;
        }

        const tab = connectionWorkspaces.find((entry) => {
            return entry.dataModelEntry.id === details.pageId;
        });

        const connectionState = tab ? this.connectionPresentation.get(tab.dataModelEntry) : undefined;
        if (connectionState) {
            this.rememberConnectionPage(tab!);

            // Check if we have an open document with the new id
            // (administration pages like server status count here too).
            const newEditor = connectionState.documentStates.find((candidate: IOpenDocumentState) => {
                return candidate.document.id === details.document.id;
            });

            let documentId = "";
            if (newEditor) {
                documentId = newEditor.document.id;
            } else {
                documentId = details.document.id;

                // Must be an administration page or an external script then.
                if (details.document.type === OdmEntityType.Script) {
                    // External scripts come with their full content.
                    if (details.content !== undefined) {
                        const newState = this.addEditorFromScript(details.pageId, tab!.connection,
                            details.document, details.content, details.spName, details.schemaName,
                            details.is3rdLanguage, details.fileName);
                        connectionState.documentStates.push(newState);
                    }
                } else {
                    const document = details.document as IOdmAdminEntry;
                    const newState: IOpenDocumentState = {
                        document: details.document,
                        currentVersion: 0,
                    };

                    connectionState.documentStates.push(newState);

                    this.notifyRemoteEditorOpen(details.pageId, document, document.parent?.details);
                }
            }

            if (tab?.dataModelEntry) {
                connectionState.activeEntry = documentId;
                this.rememberConnectionPage(tab);
                requisitions.executeRemote("selectDocument", {
                    connectionId: tab.connection.details.id, documentId,
                    pageId: tab.dataModelEntry.id,
                });

                this.forceUpdate();
            }
        } else if (tab) {
            // Even if the active page does not change, we have to notify the remote side.
            // Otherwise there's no notification when the user switches between multiple tabs.
            requisitions.executeRemote("selectDocument",
                {
                    connectionId: tab.connection.details.id, documentId: details.document.id,
                    pageId: tab.dataModelEntry.id,
                });
        }
    };

    /**
     * Helper method to create a new editor entry from a script entry.
     *
     * @param pageId The id of the connection workspace page.
     * @param connection The data model entry for the connection in which to add the editor.
     * @param script The script from which we create the editor.
     * @param content The script's content.
     * @param spName The stored program's name if available
     * @param schemaName The schema where is the stored program will be added
     * @param is3rdLanguage Whether the script involves non-SQL language
     * @param fileName The optional file name/path associated with the script.
     *
     * @returns The new editor state.
     */
    private addEditorFromScript(pageId: string, connection: ICdmConnectionEntry, script: IOdmScriptEntry,
        content: string, spName?: string, schemaName?: string, is3rdLanguage?: boolean,
        fileName?: string): IOpenDocumentState {
        const model = this.createEditorModel(connection.backend, content, script.language,
            connection.details.version!, connection.details.sqlMode!, schemaName ?? "", spName,
            is3rdLanguage);

        const newState: IOpenDocumentState = {
            document: script,
            state: {
                model,
                viewState: null,
                options: defaultEditorOptions,
            },
            currentVersion: model.getVersionId(),
            fileName,
        };

        this.notifyRemoteEditorOpen(pageId, script, connection.details);

        return newState;
    }

    private handleEditorRename = (pageId: string, editorId: string, newCaption: string): void => {
        const { connectionWorkspaces } = this.state;
        const tab = connectionWorkspaces.find((entry) => {
            return entry.dataModelEntry.id === pageId;
        });

        if (!tab) {
            return;
        }

        const connectionState = this.connectionPresentation.get(tab.dataModelEntry);
        if (newCaption && connectionState) {
            let needsUpdate = false;
            const state = connectionState.documentStates.find((candidate: IOpenDocumentState) => {
                return candidate.document.id === editorId;
            });

            if (state) {
                state.document.caption = newCaption;
                needsUpdate = true;
            }

            if (needsUpdate) {
                this.forceUpdate();
            }
        }
    };

    private handleEditorChange = (pageId: string, editorId: string): void => {
        const tab = this.state.connectionWorkspaces.find((entry) => {
            return entry.dataModelEntry.id === pageId;
        });

        const connectionState = tab ? this.connectionPresentation.get(tab.dataModelEntry) : undefined;
        const editorState = connectionState?.documentStates.find((entry) => {
            return entry.document.id === editorId;
        });

        if (editorState) {
            this.forceUpdate();
        }
    };

    /**
     * Handles sidebar menu actions for the document tree.
     *
     * @param command The command to execute.
     * @param entry The data model entry for which to execute the command.
     *
     * @returns A promise which resolves to true, except when the user cancels the operation.
     */
    private handleSideBarDocumentCommand = async (command: Command,
        entry: OpenDocumentDataModelEntry): Promise<ISideBarCommandResult> => {

        const canClose = await this.canCurrentTabClose();
        if (!canClose) {
            return { success: false };
        }

        const pageEntry = entry as IOdmConnectionPageEntry;
        switch (command.command) {
            case "msg.loadScriptFromDisk": {
                await this.loadScriptFromDisk(pageEntry.details, pageEntry.id);

                break;
            }

            case "msg.addScript":
            case "msg.newScriptMysql":
            case "msg.newScriptSqlite": {
                await this.createAndSelectScriptDocument(pageEntry.details, `Script ${++this.documentCounter}`,
                    pageEntry.details.dbType === DBType.MySQL ? "mysql" : "sql", "", pageEntry.id);

                break;
            }

            case "msg.newScriptJs":
            case "msg.newScriptTs": {
                await this.createAndSelectScriptDocument(pageEntry.details, `Script ${++this.documentCounter}`,
                    command.command === "msg.newScriptTs" ? "typescript" : "javascript", "", pageEntry.id);

                break;
            }

            case "msg.newSessionUsingConnection": {
                if (entry.type === OdmEntityType.ConnectionPage) {
                    await this.activateShellTab(uuid(), entry.details.id, entry.details.caption);
                }

                break;
            }

            default: {
                return this.sidebarCommandHandler.handleDocumentCommand(command, entry);
            }
        }

        return { success: true };
    };

    /**
     * Handles sidebar menu actions for the connection tree.
     *
     * @param command The command to execute.
     * @param entry The data model entry for which to execute the command.
     * @param qualifiedName Optionally, the qualified name of the entry. Used for DB object related actions.
     *
     * @returns A promise which resolves to true, except when the user cancels the operation.
     */
    private handleSideBarConnectionCommand = async (command: Command, entry?: ConnectionDataModelEntry,
        qualifiedName?: QualifiedName): Promise<ISideBarCommandResult> => {
        const { connectionWorkspaces } = this.state;

        // First handle commands which need no entry.
        if (!entry) {
            switch (command.command) {
                case "addConsole": {
                    void this.activateShellTab(uuid());

                    return { success: true };
                }

                case "msg.logOut": {
                    await this.doLogout();

                    return { success: true };
                }

                case "msg.importWorkbenchConnections": {
                    await this.handleImportWorkbenchConnections();

                    return { success: true };
                }

                case "msg.newSchemaDiagram": {
                    await this.handleNewSchemaDiagram();

                    return { success: true };
                }

                default: {
                    return this.sidebarCommandHandler.handleConnectionTreeCommand(command, entry, qualifiedName);
                }
            }
        }

        const canClose = await this.canCurrentTabClose();
        if (!canClose) {
            return { success: false };
        }

        if (entry.type === CdmEntityType.ConnectionGroup) {
            switch (command.command) {
                default: {
                    return this.sidebarCommandHandler.handleConnectionTreeCommand(command, entry, qualifiedName);
                }
            }
        } else {
            const connection = entry.connection ?? (entry as ICdmConnectionEntry);
            const connectionId = connection.details.id;
            const pageId = this.resolveLatestPageId(connection);

            switch (command.command) {
                case "msg.openConnection": {
                    const initialEditor = (command.arguments && command.arguments.length > 0)
                        ? command.arguments[0]
                        : undefined;
                    await this.showPage({
                        connectionId,
                        pageId,
                        createNewWorkspace: true,
                        editor: initialEditor as InitialEditor,
                    });

                    break;
                }

                case "msg.loadScriptFromDisk": {
                    await this.loadScriptFromDisk(connection.details, pageId);

                    break;
                }

                case "setCurrentSchemaMenuItem": {
                    const tab = connectionWorkspaces.find((tab) => {
                        return tab.connection.details.id === connection.details.id;
                    });

                    if (tab && qualifiedName) {
                        const connectionInfo = getConnectionInfoFromDetails(connection.details);
                        await this.setCurrentSchema({
                            id: tab.dataModelEntry.id, connectionInfo, schema: qualifiedName.name!,
                        });
                    }

                    break;
                }

                case "msg.newSessionUsingConnection": {
                    await this.activateShellTab(uuid(), connection.details.id, connection.details.caption);

                    break;
                }

                case "addConsole": {
                    void this.activateShellTab(uuid());

                    break;
                }

                case "msg.logOut": {
                    await this.doLogout();

                    break;
                }

                case "msg.editRoutine": {
                    const sql = await this.connectionsDataModel.getCreateSqlScript(entry, true, true, true, true);

                    await this.createAndSelectScriptDocument(connection.details, entry.caption, "mysql", sql, pageId);

                    break;
                }

                case "msg.createProcedure":
                case "msg.createProcedureJs":
                case "msg.createFunction":
                case "msg.createFunctionJs":
                case "msg.createLibraryJs": {
                    await this.addNewSqlScript(connection.details, command.command, qualifiedName?.schema!, "");
                    break;
                }

                default: {
                    return this.sidebarCommandHandler.handleConnectionTreeCommand(command, entry, qualifiedName,
                        pageId);
                }
            }
        }

        return { success: true };
    };

    private handleSideBarOciCommand = async (command: Command,
        entry: OciDataModelEntry): Promise<ISideBarCommandResult> => {
        const { documentTabs } = this.state;

        const showNewSimpleEditor = (name: string, text: string, language: EditorLanguage): void => {
            const model: ICodeEditorModel = Object.assign(Monaco.createModel(text, "json"), {
                executionContexts: new ExecutionContexts(),
                editorMode: CodeEditorMode.Standard,
            });

            const id = uuid();
            const document = this.documentDataModel.openDocument(undefined, {
                type: OdmEntityType.StandaloneDocument,
                parameters: { id, caption: name, language },
            });

            if (document) {
                documentTabs.push({
                    dataModelEntry: document,
                    savedState: {
                        model,
                        viewState: null,
                        options: defaultEditorOptions,
                    },
                    currentVersion: model.getVersionId(),
                });

                this.setState({
                    documentTabs,
                    selectedPage: document.id,
                    selectedWorkspace: generalWorkspaceId,
                });

                this.notifyRemoteEditorOpen(document.id, document);
            }
        };

        let success = false;
        switch (command.command) {
            case "msg.mds.getProfileInfo": {
                const profile = entry as IOciDmProfile;
                const text = JSON.stringify(profile.profileData, null, 4);
                const name = `${profile.profileData.profile.toString()} Info.json`;
                showNewSimpleEditor(name, text, "json");
                success = true;

                break;
            }

            case "msg.mds.getCompartmentInfo": {
                const compartment = entry as IOciDmCompartment;
                const text = JSON.stringify(compartment.compartmentDetails, null, 4);
                const name = `${compartment.compartmentDetails.name} Info.json`;
                showNewSimpleEditor(name, text, "json");
                success = true;

                break;
            }

            case "msg.mds.getDbSystemInfo": {
                const dbSystem = entry as IOciDmDbSystem;
                const text = JSON.stringify(dbSystem.details, null, 4);
                const name = `${dbSystem.details.displayName} Info.json`;
                showNewSimpleEditor(name, text, "json");

                break;
            }

            case "msg.mds.getComputeInstance": {
                const computeInstance = entry as IOciDmComputeInstance;
                const text = JSON.stringify(computeInstance.instance, null, 4);
                const name = `${computeInstance.instance.displayName} Info.json`;
                showNewSimpleEditor(name, text, "json");

                break;
            }

            case "msg.mds.getBastion": {
                const bastion = entry as IOciDmBastion;
                const text = JSON.stringify(bastion.summary, null, 4);
                const name = `${bastion.summary.name} Info.json`;
                showNewSimpleEditor(name, text, "json");

                break;
            }

            default: {
                return this.sidebarCommandHandler.handleOciCommand(command, entry);
            }
        }

        return { success };
    };

    private readonly desktopOpenSupportedFileResourceId = "desktopOpenSupportedFile";

    private getDesktopOpenSupportedFileFilters = (): Record<string, string[]> => {
        return {
            "Supported Files": ["sql", "mysql", "js", "ts", "mysql-notebook"],
        };
    };

    private readSelectedFile = (file: IOpenFileDialogResult["file"][number]): string => {
        return new TextDecoder().decode(file.content);
    };

    private getLanguageForOpenedScript = (fileName: string, connection: IConnectionDetails): EditorLanguage | undefined => {
        const normalized = fileName.toLowerCase();
        if (normalized.endsWith(".js")) {
            return "javascript";
        }

        if (normalized.endsWith(".ts")) {
            return "typescript";
        }

        if (normalized.endsWith(".sql") || normalized.endsWith(".mysql")) {
            return connection.dbType === DBType.MySQL ? "mysql" : "sql";
        }

        return undefined;
    };

    private openSupportedFile = async (
        pageEntry: IOdmConnectionPageEntry,
        fileName: string,
        content: string,
    ): Promise<boolean> => {
        if (fileName.toLowerCase().endsWith(".mysql-notebook")) {
            return requisitions.execute("editorLoadNotebook", {
                fileName,
                content,
                createNew: true,
            });
        }

        const language = this.getLanguageForOpenedScript(fileName, pageEntry.details);
        if (!language) {
            void ui.showErrorMessage(`Unsupported file type: ${fileName}`, {});

            return false;
        }

        await this.createAndSelectScriptDocument(
            pageEntry.details,
            getDocumentFileName(fileName),
            language,
            content,
            pageEntry.id,
            fileName,
        );

        return true;
    };

    private openDesktopSupportedFileFromDisk = async (): Promise<boolean> => {
        const pageEntry = await this.getOrCreateSelectedUserConnectionPageEntry();
        if (!pageEntry) {
            return false;
        }

        if (appParameters.embedded) {
            requisitions.executeRemote("showOpenDialogWithRead", {
                id: this.desktopOpenSupportedFileResourceId,
                title: "Open File",
                openLabel: "Open",
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: this.getDesktopOpenSupportedFileFilters(),
            });

            return true;
        }

        const files = await selectFileInBrowser([".sql", ".mysql", ".js", ".ts", ".mysql-notebook"], false);
        if (!files?.length) {
            return true;
        }

        const file = files[0];
        const fileName = (file as File & { path?: string }).path ?? file.name;
        const content = await loadFileAsText(file);

        return this.openSupportedFile(pageEntry, fileName, content);
    };

    private selectFile = async (fileResult: IOpenFileDialogResult): Promise<boolean> => {
        if (fileResult.resourceId !== this.desktopOpenSupportedFileResourceId) {
            return false;
        }

        const pageEntry = await this.getOrCreateSelectedUserConnectionPageEntry();
        const file = fileResult.file[0];
        if (!pageEntry || !file) {
            return false;
        }

        return this.openSupportedFile(pageEntry, file.path, this.readSelectedFile(file));
    };

    private async loadScriptFromDisk(connection: IConnectionDetails, pageId?: string): Promise<void> {
        const files = await selectFileInBrowser([".sql"], false);
        if (files && files.length > 0) {
            const file = files[0];
            const fileName = (file as File & { path?: string }).path ?? file.name;
            const content = await loadFileAsText(file);

            await this.createAndSelectScriptDocument(connection, getDocumentFileName(fileName),
                connection.dbType === DBType.MySQL ? "mysql" : "sql", content, pageId, fileName);
        }
    }

    /**
     * Creates a new script document and selects it.
     *
     * @param connection The connection to use for the new document. There might already be a connection workspace for it.
     * @param caption The caption in the document tree.
     * @param language The language of the script.
     * @param content The initial content of the script.
     * @param pageId The id of the page.
     * @param fileName The optional file name/path associated with the script.
     */
    private async createAndSelectScriptDocument(connection: IConnectionDetails, caption: string,
        language: EditorLanguage, content: string, pageId?: string, fileName?: string): Promise<void> {
        const requestedPageId = pageId && this.isUserConnectionPage(pageId) ? pageId : undefined;

        // Make sure we have a workspace page open for the connection.
        await this.showPage({
            connectionId: connection.id,
            pageId: requestedPageId,
            editor: "none",
            serviceOnly: false,
        });

        const targetPageId = requestedPageId ?? this.latestPagesByConnection.get(connection.id);

        // At this point we should always find the tab.
        const tab = this.state.connectionWorkspaces.find((tab) => {
            return targetPageId
                ? (tab.dataModelEntry.id === targetPageId)
                : (tab.connection.details.id === connection.id && this.isUserConnectionPage(tab.dataModelEntry.id));
        });

        if (tab) {
            const document = this.documentDataModel.openDocument(undefined, {
                type: OdmEntityType.Script,
                parameters: {
                    pageId: tab.dataModelEntry.id,
                    id: uuid(),
                    connection,
                    caption,
                    language,
                },
            });

            if (document) {
                this.handleSelectItem({
                    document,
                    pageId: tab.dataModelEntry.id,
                    content,
                    fileName,
                });
            }
        }
    }

    /**
     * Creates a new snippet for a script based on the given command, resolving the name 
     * prompting to the user.
     *
     * @param connection The connection to use for the new document. There might already be a connection workspace for it.
     * @param command The command being executed.
     * @param schemaName The name of the schema where the script will be created.
     * @param placeHolder An initial name for the script
     */
    private async addNewSqlScript(details: IConnectionDetails, command: string, schemaName: string,
        placeHolder: string): Promise<void> {

        let name: string | undefined = "";
        let sql = placeHolder;

        // If the commands is a create command, get the name of the new routine
        if (command.startsWith("msg.create")) {
            const result = await resolveNewSqlScript(command.substring(10), schemaName, placeHolder);

            if (result) {
                name = result.name;
                sql = result.sql;
            } else {
                return;
            }
        }

        this.createAndSelectScriptDocument(details, name, "mysql", sql);
    }

    /**
     * Selects the shell tab with the given session id. If none exists, a new tab is created.
     *
     * @param sessionId The id of the session to open.
     * @param connectionId if given open this connection on start of the session, if we have to create a new one.
     * @param caption The caption of the tab.
     */
    private async activateShellTab(sessionId: string, connectionId?: number, caption?: string): Promise<void> {
        const { shellSessionTabs } = this.state;

        const existing = shellSessionTabs.find((info) => {
            return info.dataModelEntry.details.sessionId === sessionId;
        });

        if (existing) {
            const existingConnectionId = existing.dataModelEntry.details.dbConnectionId;
            this.setState({
                selectedPage: existing.dataModelEntry.id,
                selectedWorkspace: this.getWorkspaceIdForPageId(existing.dataModelEntry.id)
                    ?? (existingConnectionId
                        ? this.getConnectionWorkspaceId(existingConnectionId)
                        : generalWorkspaceId),
            });
            requisitions.executeRemote("selectDocument", {
                connectionId: existingConnectionId,
                documentId: sessionId,
            });
        } else {
            const selectedWorkspace = this.getResolvedSelectedWorkspace();
            const workspaceId = connectionId !== undefined
                && selectedWorkspace.kind === "connection"
                && selectedWorkspace.connectionId === connectionId
                ? selectedWorkspace.id
                : undefined;
            this.showProgress();
            const backend = new ShellInterfaceShellSession();

            this.setProgressMessage("Starting shell session...");
            const requestId = uuid();
            try {
                await backend.startShellSession(sessionId, connectionId, undefined, requestId,
                    (response) => {
                        if (!isShellPromptResult(response.result) || !ShellPromptHandler.handleShellPrompt(response.result, requestId, backend.interactive)) {
                            this.setProgressMessage("Loading ...");
                        }

                        return Promise.resolve(true);
                    });

                // TODO: get current schema, if a connection is given.
                const currentSchema = "";

                // TODO: we need server information for code completion.
                const versionString = Settings.get("editor.dbVersion", "8.0.24");
                const serverVersion = parseVersion(versionString);
                const serverEdition = "";
                const sqlMode = Settings.get("editor.sqlMode", "");

                const model = this.createSessionEditorModel(backend, "", "msg", serverVersion, sqlMode, currentSchema);

                caption = caption ? `Session to ${caption}` : `Session ${++this.sessionCounter}`;
                const document = this.documentDataModel.addShellSession(undefined, {
                    sessionId,
                    caption,
                    dbConnectionId: connectionId,
                });

                const sessionState: IShellTabPersistentState = {
                    dataModelEntry: document,
                    state: {
                        model,
                        viewState: null,
                        options: defaultEditorOptions,
                    },
                    backend,
                    serverVersion,
                    serverEdition,
                    sqlMode,
                };

                shellSessionTabs.push({ dataModelEntry: document, savedState: sessionState, workspaceId });

                this.hideProgress(false);
                this.setState({
                    shellSessionTabs,
                    selectedPage: document.id,
                    selectedWorkspace: workspaceId ?? this.getWorkspaceIdForPageId(document.id)
                        ?? (connectionId
                            ? this.getConnectionWorkspaceId(connectionId)
                            : generalWorkspaceId),
                    loading: false,
                });

                requisitions.executeRemote("sessionAdded", document.details);
            } catch (error) {
                const message = convertErrorToString(error);
                void ui.showErrorMessage("Shell Session Error: " + message, {});
            }

            this.hideProgress(true);
        }
    }

    private handleGraphDataChange = (pageId: string, data: ISavedGraphData) => {
        const { connectionWorkspaces } = this.state;

        const tab = connectionWorkspaces.find((entry) => {
            return entry.dataModelEntry.id === pageId;
        });

        if (!tab) {
            return;
        }

        const connectionState = this.connectionPresentation.get(tab.dataModelEntry);
        if (connectionState) {
            connectionState.graphData = data;
        }

        this.forceUpdate();
    };

    private handleClientConnectionsStateChange = (pageId: string, data: Partial<IClientConnectionsSavedState>): void => {
        const { connectionWorkspaces } = this.state;

        const tab = connectionWorkspaces.find((entry) => {
            return entry.dataModelEntry.id === pageId;
        });

        if (!tab) {
            return;
        }

        const connectionState = this.connectionPresentation.get(tab.dataModelEntry);
        if (connectionState) {
            connectionState.adminPageStates.clientConnectionsState = {
                ...connectionState.adminPageStates.clientConnectionsState,
                ...data,
            };
        }
    };

    private handleEnterpriseBackupStateChange = (pageId: string, data: Partial<IEnterpriseBackupSavedState>): void => {
        const { connectionWorkspaces } = this.state;

        const tab = connectionWorkspaces.find((entry) => {
            return entry.dataModelEntry.id === pageId;
        });

        if (!tab) {
            return;
        }

        const connectionState = this.connectionPresentation.get(tab.dataModelEntry);
        if (connectionState) {
            connectionState.adminPageStates.enterpriseBackupState = {
                ...connectionState.adminPageStates.enterpriseBackupState,
                ...data,
            };
        }
    };

    private onChatOptionsChange = (pageId: string, data: Partial<IChatOptionsState>): void => {
        const { connectionWorkspaces } = this.state;

        const tab = connectionWorkspaces.find((entry) => {
            return entry.dataModelEntry.id === pageId;
        });

        if (!tab) {
            return;
        }

        const connectionState = this.connectionPresentation.get(tab.dataModelEntry);
        if (connectionState) {
            connectionState.chatOptionsState = {
                ...connectionState.chatOptionsState,
                ...data,
            };
        }

        this.forceUpdate();
    };

    private afterCommit = () => {
        void ui.showInformationMessage("Changes committed successfully.", {});
    };

    /**
     * Creates the standard model used by DB code editors. Each editor has an own model, which carries additional
     * information required by the editors.
     *
     * @param backend The interface for the current shell module session, used for running code and editor assistance.
     * @param text The initial content of the model.
     * @param language The code language used in the model.
     * @param serverVersion The version of the connected server (relevant only for SQL languages).
     * @param sqlMode The current SQL mode of the server (relevant only for MySQL).
     * @param currentSchema The current default schema.
     * @param spName The stored program name
     * @param is3rdLanguage Whether the model involves non-SQL language
     *
     * @returns The new model.
     */
    private createEditorModel(backend: ShellInterfaceSqlEditor, text: string, language: string,
        serverVersion: number, sqlMode: string, currentSchema: string,
        spName?: string, is3rdLanguage?: boolean): ICodeEditorModel {
        const model: ICodeEditorModel = Object.assign(Monaco.createModel(text, language), {
            executionContexts: new ExecutionContexts({
                store: StoreType.Document,
                dbVersion: serverVersion,
                sqlMode,
                currentSchema,
                spName,
                runUpdates: sendSqlUpdatesFromModel.bind(this, this.afterCommit, backend),
            }),
            symbols: new DynamicSymbolTable(backend, "db symbols", { allowDuplicateSymbols: true }),
            editorMode: CodeEditorMode.Standard,
            is3rdLanguage,
        });

        if (model.getEndOfLineSequence() !== Monaco.EndOfLineSequence.LF) {
            model.setEOL(Monaco.EndOfLineSequence.LF);
        } else {
            model.setValue(text);
        }

        return model;
    }

    /**
     * Creates the shell editor model which differs from standard editor models.
     *
     * @param session The interface to interact with the shell (e.g. for code completion).
     * @param text The initial content of the model.
     * @param language The initial code language used in the model.
     * @param serverVersion The version of the connected server (relevant only for SQL languages).
     * @param sqlMode The current SQL mode of the server (relevant only for MySQL).
     * @param currentSchema The current default schema.
     *
     * @returns The new model.
     */
    private createSessionEditorModel(session: ShellInterfaceShellSession, text: string, language: string,
        serverVersion: number, sqlMode: string, currentSchema: string): IShellEditorModel {
        const model: IShellEditorModel = Object.assign(Monaco.createModel(text, language), {
            executionContexts: new ExecutionContexts({
                store: StoreType.Shell,
                dbVersion: serverVersion,
                sqlMode,
                currentSchema,
                runUpdates: this.sendSessionSqlUpdatesFromModel.bind(this, session),
            }),

            // Create a default symbol table with no DB connection. This will be replaced in ShellTab, depending
            // on the connection the user opens.
            symbols: new DynamicSymbolTable(undefined, "db symbols", { allowDuplicateSymbols: true }),
            editorMode: CodeEditorMode.Terminal,
            session,
        });

        if (model.getEndOfLineSequence() !== Monaco.EndOfLineSequence.LF) {
            model.setEOL(Monaco.EndOfLineSequence.LF);
        } else {
            model.setValue(text);
        }

        return model;
    }

    private setProgressMessage = (message: string): void => {
        this.setState({ progressMessage: message });
    };

    private showProgress = (): void => {
        this.pendingProgress = setTimeout(() => {
            const { selectedPage } = this.state;

            this.setState({ loading: true, lastSelectedPage: selectedPage });
        }, 500);
    };

    private hideProgress = (reRender: boolean): void => {
        if (this.pendingProgress) {
            clearTimeout(this.pendingProgress);
            this.pendingProgress = null;

            if (reRender) {
                this.setState({ loading: false });
            }
        }
    };

    private handleSaveExplorerState = (state: Map<string, IDocumentSideBarSectionState>): void => {
        this.setState({ sidebarState: state });
    };

    private handleDocumentSelection = async (entry: OpenDocumentDataModelEntry): Promise<void> => {
        const canClose = await this.canCurrentTabClose();
        if (!canClose) {
            return;
        }

        switch (entry.type) {
            case OdmEntityType.Overview: {
                this.showOverview();

                break;
            }

            case OdmEntityType.AdminPage:
            case OdmEntityType.Notebook:
            case OdmEntityType.Script: {
                if (entry.parent) {
                    const page = entry.parent;
                    this.handleSelectTab(page.id);
                    this.handleSelectItem({
                        pageId: page.id,
                        document: entry,
                    });
                }

                break;
            }

            case OdmEntityType.ShellSession: {
                void this.activateShellTab(entry.id);

                break;
            }

            case OdmEntityType.StandaloneDocument: {
                const { documentTabs } = this.state;

                const tab = documentTabs.find((info) => {
                    return info.dataModelEntry.id === entry.id;
                });

                if (tab) {
                    this.doSwitchTab(entry.id);
                }

                break;
            }

            case OdmEntityType.SchemaDiagram: {
                const { schemaDiagramTabs } = this.state;

                const tab = schemaDiagramTabs.find((info) => {
                    return info.dataModelEntry.id === entry.id;
                });

                if (tab) {
                    this.doSwitchTab(entry.id);
                }

                break;
            }

            default:
        }
    };

    /**
     * Triggered when an item in the connection tree is selected by the user.
     *
     * @param entry The entry that was selected.
     */
    private handleConnectionEntrySelection = async (entry: ConnectionDataModelEntry): Promise<void> => {
        switch (entry.type) {
            case CdmEntityType.AdminPage: {
                const connectionId = entry.connection.details.id;

                const canClose = await this.canCurrentTabClose();
                if (!canClose) {
                    return;
                }

                let pageId: string | undefined;

                if (entry.connection.isOffline) {
                    pageId = this.resolveServiceConnectionPageId(entry.connection);
                    pageId ??= this.state.connectionWorkspaces.find((candidate) => {
                        return candidate.connection.details.id === connectionId
                            && this.isServiceConnectionPage(candidate.dataModelEntry.id);
                    })?.dataModelEntry.id;
                } else {
                    pageId = this.state.connectionWorkspaces.find((candidate) => {
                        return candidate.dataModelEntry.id === this.state.selectedPage
                            && candidate.connection.details.id === connectionId;
                    })?.dataModelEntry.id;

                    if (!pageId) {
                        const activeWorkspace = this.getResolvedSelectedWorkspace();
                        if (activeWorkspace.kind === "connection"
                            && activeWorkspace.connectionId === connectionId) {
                            pageId = activeWorkspace.connectionWorkspace?.dataModelEntry.id;
                        }
                    }

                    if (!pageId) {
                        pageId = this.resolveLatestPageId(entry.connection);
                        await this.showPage({
                            connectionId,
                            pageId,
                            editor: "none",
                            createNewWorkspace: false,
                            serviceOnly: false,
                        });
                        pageId = this.resolveLatestPageId(entry.connection);
                    }
                }

                const tab = this.state.connectionWorkspaces.find((tab) => {
                    return pageId ? (tab.dataModelEntry.id === pageId) : (tab.connection.details.id === connectionId);
                });

                if (!tab || !pageId) {
                    return;
                }

                const document = this.documentDataModel.openDocument(undefined, {
                    type: OdmEntityType.AdminPage,
                    parameters: {
                        id: `${entry.id}__${pageId}`,
                        pageId,
                        connection: entry.parent.connection.details,
                        caption: entry.caption,
                        pageType: entry.pageType,
                    },
                });

                if (document) {
                    this.handleSelectItem({ pageId: tab.dataModelEntry.id, document });
                    if (this.isServiceConnectionPage(tab.dataModelEntry.id)) {
                        this.servicePagesByConnection.set(connectionId, tab.dataModelEntry.id);
                    }
                }

                break;
            }

            default:
        }
    };

    /**
     * Sends a notification to the host (if any) that an editor has been opened.
     *
     * @param pageId The id of the page in which the editor is located.
     * @param document The document that was opened.
     * @param connection The connection for which the document was opened. Can be unassigned for standalone documents.
     */
    private notifyRemoteEditorOpen(pageId: string, document: OpenDocumentDataModelEntry,
        connection?: IConnectionDetails) {
        const language = document.type === OdmEntityType.Script ? document.language : undefined;
        const pageType = document.type === OdmEntityType.AdminPage ? document.pageType : undefined;

        requisitions.executeRemote("documentOpened", {
            pageId,
            connection,
            documentDetails: {
                id: document.id,
                caption: document.caption,
                type: document.type,
                language,
                pageType,
            },
        });
    }

    /**
     * Sends a notification to the host (if any) that an editor has been closed.
     *
     * @param pageId The id of the page in which the editor was located.
     * @param documentId The id of the editor to close. If not given, the tab itself is closed.
     * @param connectionId If set this is the id of the connection used by the document.
     * @param details The connection details.
     */
    private notifyRemoteEditorClose(pageId: string, documentId?: string, connectionId?: number,
        details?: IConnectionDetails) {
        requisitions.executeRemote("documentClosed", {
            pageId,
            id: documentId,
            connectionInfo: details ? getConnectionInfoFromDetails(details) : undefined,
        });
    }

    private sendSessionSqlUpdatesFromModel = async (session: ShellInterfaceShellSession,
        updates: string[]): Promise<ISqlUpdateResult> => {

        let lastIndex = 0;
        const rowCount = 0;
        try {
            await session.execute("start transaction");
            for (; lastIndex < updates.length; ++lastIndex) {
                const update = updates[lastIndex];
                await session.execute(update);

                // TODO: we need to get the number of affected rows from the result.
                // rowCount += result?.rowsAffected ?? 0;
            }
            await session.execute("commit");

            return { affectedRows: rowCount, errors: [] };
        } catch (reason) {
            await session.execute("rollback");
            if (reason instanceof Error) {
                const errors: string[] = [];
                errors[lastIndex] = reason.message; // Set the error for the query that was last executed.

                return { affectedRows: rowCount, errors };
            }

            throw reason;
        }
    };

    /**
     * Promisified version of `setState`. This is the same code as in ComponentBase, but we need it here to avoid
     * having to derive from that component.
     *
     * @param state The new state to set.
     *
     * @returns A promise which resolves when the `setState` action finished.
     */
    private setStatePromise<K extends keyof IDocumentModuleState>(
        state: ((prevState: Readonly<IDocumentModuleState>, props: Readonly<{}>)
            // eslint-disable-next-line @stylistic/indent
            => (Pick<IDocumentModuleState, K> | IDocumentModuleState | null))
            | (Pick<IDocumentModuleState, K> | IDocumentModuleState | null),
    ): Promise<void> {
        return new Promise((resolve) => {
            super.setState(state, resolve);
        });
    }

    private handleHelpCommand = (command: string, language: EditorLanguage): string | undefined => {
        switch (language) {
            case "javascript": {
                return `The DB Notebook's interactive prompt is currently running in JavaScript mode.
Execute "\\sql" to switch to SQL mode, "\\ts" to switch to TypeScript mode.

GLOBAL FUNCTIONS
    - \`print(value)\`
      Send a value to the output area.
    - \`async runSql(code, params?), params?)\`
      Run the given query and wait for the returned promise to resolve when done.
    - \`runSqlWithCallback(sql, callback?, params?)\`
      Run the query and process the rows in the given callback, once all are received.
    - \`runSqlIterative(sql: string, callback?: (res: unknown) => void, params?: unknown): void\`
      Run the given query and process the rows iteratively as they arrive.
`;
            }

            case "typescript": {
                return `The DB Notebook's interactive prompt is currently running in TypeScript mode.
Execute "\\sql" to switch to SQL mode, "\\js" to switch to JavaScript mode.

GLOBAL FUNCTIONS
    - \`print(value: unknown): void\`
      Send a value to the output area.
    - \`async runSql(code: string, params?: unknown), params?: unknown[]): Promise<unknown>\`
      Run the given query and wait for the returned promise to resolve when done.
    - \`runSqlWithCallback(sql: string, callback?: (res: unknown) => void, params?: unknown): void\`
    Run the query and process the rows in the given callback, once all are received.
    - \`runSqlIterative(sql: string, callback?: (res: unknown) => void, params?: unknown): void\`
      Run the given query and process the rows iteratively as they arrive.
`;
            }

            case "mysql": {
                return `The DB Notebook's interactive prompt is currently running in SQL mode.
Execute "\\js" to switch to JavaScript mode, "\\ts" to switch to TypeScript mode.

Use ? as placeholders, provide values in comments.
EXAMPLES
    SELECT * FROM user
    WHERE name = ? /*=mike*/
`;
            }

            default:
        }
    };

    private openActiveAdministrationPage = async (pageType: AdminPageType): Promise<boolean> => {
        const activeConnection = this.getActiveWorkspaceConnectionEntry();
        const connection = activeConnection?.adminEntry
            ? activeConnection
            : this.getSelectedUserConnectionWorkspace()?.connection;
        const page = connection?.adminEntry?.pages.find((candidate) => {
            return candidate.pageType === pageType;
        });

        if (!page) {
            return false;
        }

        await this.handleConnectionEntrySelection(page);

        return true;
    };

    private toggleActiveWorkspaceSystemSchemas = async (): Promise<boolean> => {
        return this.sideBarRef.current?.toggleActiveWorkspaceSystemSchemas() ?? false;
    };

    private getNumberOfOpenedConnectionPages(entry: ICdmConnectionEntry): number {
        return this.state.connectionWorkspaces.filter(
            (info) => {
                return info.connection.details.id === entry.details.id;
            }).length + 1;
    }

    private resolveLatestPageId(entry: ICdmConnectionEntry): string | undefined {
        let pageId = this.latestPagesByConnection.get(entry.details.id);
        if (pageId && !this.isUserConnectionPage(pageId)) {
            // pageUuid does not exist anymore, invalidating.
            this.latestPagesByConnection.delete(entry.details.id);
            pageId = undefined;
        }

        this.state.connectionWorkspaces.some((info: IConnectionWorkspacePage) => {
            if (!pageId && info.connection.details.id === entry.details.id
                && this.isUserConnectionPage(info.dataModelEntry.id)) {
                // Fallback: searching pageUuid by connectionId if it's not yet set after validation.
                pageId = info.dataModelEntry.id;

                return true;
            }

            return false;
        });

        return pageId;
    }

    private resolveServiceConnectionPageId(entry: ICdmConnectionEntry): string | undefined {
        let pageId = this.servicePagesByConnection.get(entry.details.id);
        if (pageId && !this.isServiceConnectionPage(pageId)) {
            this.servicePagesByConnection.delete(entry.details.id);
            pageId = undefined;
        }

        this.state.connectionWorkspaces.some((info: IConnectionWorkspacePage) => {
            if (pageId) {
                return true;
            }

            if (info.connection.details.id === entry.details.id
                && this.isServiceConnectionPage(info.dataModelEntry.id)) {
                pageId = info.dataModelEntry.id;

                return true;
            }

            return false;
        });

        return pageId;
    }

    private resolveLatestConnectionPageId(entry: ICdmConnectionEntry, serviceOnly: boolean): string | undefined {
        return serviceOnly
            ? this.resolveServiceConnectionPageId(entry)
            : this.resolveLatestPageId(entry);
    }

    private findConnectionWorkspaceByPageId(id: string): IConnectionWorkspacePage | undefined {
        return this.state.connectionWorkspaces.find((info: IConnectionWorkspacePage) => {
            return info.dataModelEntry.id === id;
        });
    }

    private isUserConnectionDocument(document: { type: OdmEntityType; }): boolean {
        return document.type === OdmEntityType.Script || document.type === OdmEntityType.Notebook;
    }

    private isUserConnectionPage(id: string): boolean {
        const tab = this.findConnectionWorkspaceByPageId(id);
        if (!tab) {
            return false;
        }

        return !this.serviceOnlyConnectionPages.has(id);
    }

    private isServiceConnectionPage(id: string): boolean {
        const tab = this.findConnectionWorkspaceByPageId(id);
        if (!tab) {
            return false;
        }

        return this.serviceOnlyConnectionPages.has(id);
    }

    private rememberConnectionPage(tab: IConnectionWorkspacePage): void {
        const connectionId = tab.connection.details.id;
        const pageId = tab.dataModelEntry.id;

        if (this.isServiceConnectionPage(pageId)) {
            this.servicePagesByConnection.set(connectionId, pageId);
            if (this.latestPagesByConnection.get(connectionId) === pageId) {
                this.latestPagesByConnection.delete(connectionId);
            }
        } else if (this.isUserConnectionPage(pageId)) {
            this.latestPagesByConnection.set(connectionId, pageId);
            if (this.servicePagesByConnection.get(connectionId) === pageId) {
                this.servicePagesByConnection.delete(connectionId);
            }
        }
    }

    private forgetConnectionPage(tab: IConnectionWorkspacePage): void {
        const connectionId = tab.connection.details.id;
        const pageId = tab.dataModelEntry.id;

        if (this.latestPagesByConnection.get(connectionId) === pageId) {
            this.latestPagesByConnection.delete(connectionId);
        }
        if (this.servicePagesByConnection.get(connectionId) === pageId) {
            this.servicePagesByConnection.delete(connectionId);
        }
        this.serviceOnlyConnectionPages.delete(pageId);
    }

    private resolveTabCaption(connection: ICdmConnectionEntry): string {
        const connectionId = connection.details.id;
        const numberOfConnections = this.documentDataModel.roots.filter((item) => {
            return item.type === OdmEntityType.ConnectionPage && item.details.id === connectionId;
        }).length;

        let caption = connection.caption;
        let maxSuffix = this.maxConnectionDocumentSuffix.get(connectionId) ?? 1;
        if (numberOfConnections > 0 || maxSuffix > 1) {
            maxSuffix++;
            caption = `${caption} (${maxSuffix})`;
            this.maxConnectionDocumentSuffix.set(connectionId, maxSuffix);
        }

        return caption;
    }

    private getDesktopCommandState = (): IDesktopCommandDescriptor[] => {
        const selectedConnectionWorkspaceRef = this.getSelectedConnectionWorkspaceRef();
        const activeConnectionWorkspace = this.getActiveConnectionWorkspace();
        const isOfflineWorkspace = activeConnectionWorkspace?.connection.isOffline === true;
        const hasActiveConnectionPage = this.getSelectedConnectionPageEntry() !== undefined && !isOfflineWorkspace;
        const activeDesktopDocumentType = selectedConnectionWorkspaceRef?.getActiveDesktopDocumentType();
        const canUseEditorViewCommands = activeDesktopDocumentType !== undefined && !isOfflineWorkspace;
        const activeDesktopExecutionContext = this.getActiveDesktopExecutionContext();
        const desktopRunState = activeDesktopExecutionContext?.desktopRunState;
        const canRecallPreviousCommand = activeDesktopDocumentType === "notebook"
            && (selectedConnectionWorkspaceRef?.canNavigateHistory(true) ?? false);
        const canRecallNextCommand = activeDesktopDocumentType === "notebook"
            && (selectedConnectionWorkspaceRef?.canNavigateHistory(false) ?? false);
        const showHiddenCharacters = Settings.get("editor.showHidden", false);
        const showConnectionInfo = Settings.get("editor.showConnectionInfo", false);
        const softWrapEnabled = Settings.get("editor.wordWrap", "off") === "on";
        const isMac = navigator.userAgent.includes("Macintosh");
        const activeWorkspaceConnection = this.getActiveWorkspaceConnectionEntry();
        const activeConnectionDetails = activeWorkspaceConnection?.details ?? this.getSelectedConnectionPageEntry()?.details;
        const activeConnectionDbType = activeConnectionDetails?.dbType ?? DBType.MySQL;
        const canVisualExplain = (desktopRunState?.canExecute ?? false)
            && (activeDesktopExecutionContext?.editorExecutionContext?.isSQLLike
                ?? desktopRunState?.canExecuteSubparts ?? false)
            && activeConnectionDbType === DBType.MySQL;
        const sidebarShowSystemSchemas = this.sideBarRef.current?.getActiveWorkspaceSystemSchemasState();
        const canUseActiveMySQLConnection = !isOfflineWorkspace && (sidebarShowSystemSchemas !== undefined
            || activeWorkspaceConnection?.details.dbType === DBType.MySQL);
        const showSystemSchemas = sidebarShowSystemSchemas
            ?? (activeWorkspaceConnection?.state?.payload?.showSystemSchemas === true);
        const administrationConnection = activeWorkspaceConnection?.adminEntry
            ? activeWorkspaceConnection
            : this.getSelectedUserConnectionWorkspace()?.connection;
        const availableAdministrationPages = administrationConnection?.adminEntry?.pages ?? [];
        const communicationDebuggerAvailable = this.isElectronWorkspaceLayout() && webSession.runMode === RunMode.LocalUser;
        const administrationCommands = adminPageDefinitions.map(({ pageType, desktopCommandId, label }) => {
            const page = availableAdministrationPages.find((candidate) => {
                return candidate.pageType === pageType;
            });

            return {
                id: desktopCommandId,
                label: page?.caption ?? label,
                enabled: page !== undefined,
            };
        });

        return [{
            id: "desktop.newScriptTab",
            label: "New SQL Script",
            enabled: hasActiveConnectionPage,
            accelerator: "CmdOrCtrl+N",
        }, {
            id: "desktop.newNotebookTab",
            label: "New Notebook",
            enabled: hasActiveConnectionPage,
        }, {
            id: "file.open",
            label: "Open...",
            enabled: hasActiveConnectionPage,
            accelerator: "CmdOrCtrl+O",
        }, {
            id: "file.save",
            label: "Save",
            enabled: selectedConnectionWorkspaceRef?.getActiveDesktopDocumentType() !== undefined,
            accelerator: "CmdOrCtrl+S",
        }, {
            id: "file.saveAs",
            label: "Save As...",
            enabled: selectedConnectionWorkspaceRef?.getActiveDesktopDocumentType() !== undefined,
            accelerator: "CmdOrCtrl+Shift+S",
        }, {
            id: "file.closeDocument",
            label: "Close Tab",
            enabled: this.getClosableDocumentId() !== undefined,
            accelerator: "CmdOrCtrl+W",
        }, {
            id: "file.close",
            label: "Close Connection",
            enabled: this.getClosablePageId() !== undefined,
            accelerator: "CmdOrCtrl+Shift+W",
        }, {
            id: "edit.previousCommand",
            label: "Previous Command",
            enabled: canRecallPreviousCommand,
            accelerator: isMac ? "Cmd+Up" : undefined,
        }, {
            id: "edit.nextCommand",
            label: "Next Command",
            enabled: canRecallNextCommand,
            accelerator: isMac ? "Cmd+Down" : undefined,
        }, {
            id: "edit.reformat",
            label: "Reformat",
            enabled: canUseEditorViewCommands,
            accelerator: "Shift+Alt+F",
        }, {
            id: "view.find",
            label: "Find",
            enabled: canUseEditorViewCommands,
            accelerator: "CmdOrCtrl+F",
        }, {
            id: "view.toggleSidebar",
            label: "Toggle Sidebar",
            enabled: true,
            accelerator: "CmdOrCtrl+B",
        }, {
            id: "view.showHiddenCharacters",
            label: "Show Hidden Characters",
            enabled: canUseEditorViewCommands,
            checked: showHiddenCharacters,
        }, {
            id: "view.showConnectionInfo",
            label: "Show Connection Info",
            enabled: true,
            checked: showConnectionInfo,
        }, {
            id: "view.softWrap",
            label: "Soft Wrap Lines",
            enabled: canUseEditorViewCommands,
            checked: softWrapEnabled,
            accelerator: "Alt+Z",
        }, {
            id: "dev.toggleDebugger",
            label: "Toggle Communication Debugger",
            enabled: communicationDebuggerAvailable,
            checked: this.state.debuggerWorkspaceVisible === true,
        }, {
            id: "view.schemas.showSystemSchemas",
            label: "Show System Schemas",
            enabled: canUseActiveMySQLConnection,
            checked: showSystemSchemas,
        }, {
            id: "run.execute",
            label: "Execute",
            enabled: !isOfflineWorkspace && (desktopRunState?.canExecute ?? false),
            accelerator: desktopRunAccelerators.execute,
        }, {
            id: "run.executeCurrent",
            label: "Execute One",
            enabled: !isOfflineWorkspace
                && (desktopRunState?.canExecute ?? false)
                && (desktopRunState?.canExecuteSubparts ?? false),
            accelerator: desktopRunAccelerators.executeCurrent,
        }, {
            id: "run.executeAsText",
            label: "Execute with Results as Text",
            enabled: !isOfflineWorkspace
                && (desktopRunState?.canExecute ?? false)
                && (desktopRunState?.canExecuteSubparts ?? false),
            accelerator: desktopRunAccelerators.executeAsText,
        }, {
            id: "run.explain",
            label: "Explain",
            enabled: canVisualExplain,
        }, {
            id: "run.explainAnalyze",
            label: "Explain Analyze",
            enabled: canVisualExplain,
        }, {
            id: "run.visualExplain",
            label: "Visual Explain",
            enabled: canVisualExplain,
        }, {
            id: "run.visualExplainAnalyze",
            label: "Visual Explain Analyze",
            enabled: canVisualExplain,
        }, {
            id: "run.stop",
            label: "Stop",
            enabled: desktopRunState?.canStop ?? false,
            accelerator: isMac ? "Cmd+." : undefined,
        }, {
            id: "run.stopOnError",
            label: "Stop on Error",
            enabled: desktopRunState?.canExecuteSubparts ?? false,
            checked: desktopRunState?.stopOnErrors ?? false,
        }, {
            id: "run.autoCommit",
            label: "Auto-commit",
            enabled: desktopRunState?.canExecuteSubparts ?? false,
            checked: desktopRunState?.autoCommit ?? false,
        }, ...administrationCommands, {
            id: "database.migrationAssistant.start",
            label: "Start MySQL HeatWave Cloud Migration Assistant",
            enabled: canUseActiveMySQLConnection,
        }, {
            id: "database.mrs.configure",
            label: "Configure MySQL REST Service",
            enabled: canUseActiveMySQLConnection,
        }, {
            id: "database.mrs.browseDocs",
            label: "Browse MySQL REST Service Documentation",
            enabled: true,
        }];
    };

    private executeDesktopCommand = async (id: DesktopCommandId): Promise<boolean> => {
        const administrationCommand = adminPageDefinitions.find((definition) => {
            return definition.desktopCommandId === id;
        });
        if (administrationCommand) {
            return this.openActiveAdministrationPage(administrationCommand.pageType);
        }

        switch (id) {
            case "file.open": {
                return this.openDesktopSupportedFileFromDisk();
            }

            case "file.save": {
                return this.currentConnectionWorkspaceRef.current?.saveActiveDocument(false) ?? false;
            }

            case "file.saveAs": {
                return this.currentConnectionWorkspaceRef.current?.saveActiveDocument(true) ?? false;
            }

            case "file.closeDocument": {
                const documentId = this.getClosableDocumentId();
                if (!documentId) {
                    return false;
                }

                if (!await this.canCloseTab(documentId)) {
                    return true;
                }

                const connectionDocument = this.findConnectionDocumentLocation(documentId);
                if (connectionDocument) {
                    return this.closeConnectionDocument(connectionDocument, false);
                }

                return this.removeTabs([documentId]);
            }

            case "file.close": {
                const pageId = this.getClosablePageId();
                if (!pageId) {
                    return false;
                }

                if (!await this.canCloseTab(pageId)) {
                    return true;
                }

                return this.removeTabs([pageId]);
            }

            case "edit.previousCommand": {
                return this.currentConnectionWorkspaceRef.current?.navigateHistory?.(true) ?? false;
            }

            case "edit.nextCommand": {
                return this.currentConnectionWorkspaceRef.current?.navigateHistory?.(false) ?? false;
            }

            case "edit.reformat": {
                if (!this.getActiveDesktopExecutionContext()) {
                    return false;
                }

                return requisitions.execute("editorFormat", undefined);
            }

            case "view.find": {
                if (this.currentConnectionWorkspaceRef.current?.getActiveDesktopDocumentType() === undefined) {
                    return false;
                }

                return requisitions.execute("editorFind", undefined);
            }

            case "view.toggleSidebar": {
                this.toggleSidebarVisibility();

                return true;
            }

            case "view.showHiddenCharacters": {
                if (this.currentConnectionWorkspaceRef.current?.getActiveDesktopDocumentType() === undefined) {
                    return false;
                }

                Settings.set("editor.showHidden", !Settings.get("editor.showHidden", false));

                return true;
            }

            case "view.showConnectionInfo": {
                Settings.set("editor.showConnectionInfo", !Settings.get("editor.showConnectionInfo", false));
                this.forceUpdate();

                return true;
            }

            case "view.softWrap": {
                if (this.currentConnectionWorkspaceRef.current?.getActiveDesktopDocumentType() === undefined) {
                    return false;
                }

                const wordWrap = Settings.get("editor.wordWrap", "off");
                Settings.set("editor.wordWrap", wordWrap === "on" ? "off" : "on");

                return true;
            }

            case "dev.toggleDebugger": {
                return this.toggleCommunicationDebuggerWorkspace();
            }

            case "view.schemas.showSystemSchemas": {
                return this.toggleActiveWorkspaceSystemSchemas();
            }

            case "run.execute": {
                const executionContext = this.getActiveDesktopExecutionContext();
                if (!executionContext) {
                    return false;
                }

                return this.runDesktopExecution({
                    advance: executionContext.activeType === "notebook",
                    forceSecondaryEngine: false,
                    asText: false,
                });
            }

            case "run.executeCurrent": {
                return this.runDesktopExecution({
                    atCaret: true,
                    advance: false,
                    forceSecondaryEngine: false,
                    asText: false,
                });
            }

            case "run.executeAsText": {
                const executionContext = this.getActiveDesktopExecutionContext();
                if (!executionContext) {
                    return false;
                }

                return this.runDesktopExecution({
                    advance: executionContext.activeType === "notebook"
                        || executionContext.desktopRunState?.canExecuteSubparts === true,
                    asText: true,
                    forceSecondaryEngine: false,
                });
            }

            case "run.explain": {
                const executionContext = this.getActiveDesktopExecutionContext();
                if (!executionContext) {
                    return false;
                }

                return this.runDesktopExecution({
                    atCaret: true,
                    advance: false,
                    asText: true,
                    forceSecondaryEngine: false,
                    explain: true,
                });
            }

            case "run.explainAnalyze": {
                const executionContext = this.getActiveDesktopExecutionContext();
                if (!executionContext) {
                    return false;
                }

                return this.runDesktopExecution({
                    atCaret: true,
                    advance: false,
                    asText: true,
                    forceSecondaryEngine: false,
                    explainAnalyze: true,
                });
            }

            case "run.visualExplain": {
                return this.runDesktopVisualExplain();
            }

            case "run.visualExplainAnalyze": {
                return this.runDesktopVisualExplain(true);
            }

            case "run.stop": {
                return this.stopActiveDesktopExecution();
            }

            case "run.stopOnError": {
                return requisitions.execute("editorToggleStopExecutionOnError",
                    Settings.get("editor.stopOnErrors", true));
            }

            case "run.autoCommit": {
                return requisitions.execute("editorToggleAutoCommit", undefined);
            }

            case "database.mrs.configure": {
                const connection = this.getActiveWorkspaceConnectionEntry();
                if (!connection) {
                    return false;
                }

                const result = await this.handleSideBarConnectionCommand({
                    title: "Configure MRS",
                    command: "msg.mrs.configureMySQLRestService",
                }, connection);

                return result.success;
            }

            case "database.migrationAssistant.start": {
                const connection = this.getActiveWorkspaceConnectionEntry();
                if (!connection) {
                    return false;
                }

                const result = await this.handleSideBarConnectionCommand({
                    title: "Start MySQL HeatWave Cloud Migration Assistant",
                    command: "msg.startMySQLCloudMigrationAssistant",
                }, connection);

                return result.success;
            }

            case "database.mrs.browseDocs": {
                const result = await this.handleSideBarConnectionCommand({
                    title: "Browse MRS Docs",
                    command: "msg.mrs.docs",
                });

                return result.success;
            }

            case "desktop.newScriptTab":
            case "desktop.newNotebookTab": {
                return this.executeDesktopTitlebarAddAction(id);
            }

            default: {
                return false;
            }
        }
    };

    private getSelectedConnectionPageEntry = (): IOdmConnectionPageEntry | undefined => {
        return this.getActiveConnectionWorkspace()?.dataModelEntry;
    };

    private getSelectedUserConnectionWorkspace = (): IConnectionWorkspacePage | undefined => {
        const activeConnectionWorkspace = this.getActiveConnectionWorkspace();
        if (activeConnectionWorkspace && this.isUserConnectionPage(activeConnectionWorkspace.dataModelEntry.id)) {
            return activeConnectionWorkspace;
        }

        const connection = this.getActiveWorkspaceConnectionEntry();
        const pageId = connection ? this.resolveLatestPageId(connection) : undefined;

        return this.state.connectionWorkspaces.find((candidate) => {
            return candidate.dataModelEntry.id === pageId && this.isUserConnectionPage(candidate.dataModelEntry.id);
        });
    };

    private getOrCreateSelectedUserConnectionWorkspace = async (): Promise<IConnectionWorkspacePage | undefined> => {
        const selectedUserTab = this.getSelectedUserConnectionWorkspace();
        if (selectedUserTab) {
            return selectedUserTab;
        }

        const connection = this.getActiveWorkspaceConnectionEntry();
        if (!connection) {
            return undefined;
        }

        await this.showPage({
            connectionId: connection.details.id,
            editor: "none",
            serviceOnly: false,
        });

        return this.getSelectedUserConnectionWorkspace();
    };

    private getOrCreateSelectedUserConnectionPageEntry = async (): Promise<IOdmConnectionPageEntry | undefined> => {
        return (await this.getOrCreateSelectedUserConnectionWorkspace())?.dataModelEntry;
    };

    private isDocumentDirty = (entry?: IOpenDocumentState): boolean => {
        return entry?.state !== undefined && entry.currentVersion !== entry.state.model.getVersionId();
    };

    private isStandaloneDocumentDirty = (entry?: IDocumentTab): boolean => {
        return entry !== undefined && entry.currentVersion !== entry.savedState.model.getVersionId();
    };

    private hasUnsavedDocuments = (): boolean => {
        for (const connectionState of this.connectionPresentation.values()) {
            for (const entry of connectionState.documentStates) {
                if (this.isDocumentDirty(entry)) {
                    return true;
                }
            }
        }

        return this.state.documentTabs.some((entry) => {
            return this.isStandaloneDocumentDirty(entry);
        });
    };

    private confirmWindowClose = async (): Promise<boolean> => {
        if (!this.hasUnsavedDocuments()) {
            return true;
        }

        return (await ui.confirm(
            "There are unsaved documents. Do you want to discard them and close the window?",
            "Discard",
            "Cancel",
        )) === "Discard";
    };

    private handleStandaloneDocumentSaved = (id: string): void => {
        const { documentTabs } = this.state;
        const index = documentTabs.findIndex((entry) => {
            return entry.dataModelEntry.id === id;
        });

        if (index === -1) {
            return;
        }

        const entry = documentTabs[index]!;
        const currentVersion = entry.savedState.model.getVersionId();
        if (entry.currentVersion === currentVersion) {
            return;
        }

        const nextTabs = [...documentTabs];
        nextTabs[index] = {
            ...entry,
            currentVersion,
        };

        this.setState({ documentTabs: nextTabs });
    };

    private isDocumentExecutingSql = (entry?: IOpenDocumentState): boolean => {
        const executionContexts = entry?.state?.model.executionContexts;
        if (!executionContexts) {
            return false;
        }

        if (Symbol.iterator in executionContexts && typeof executionContexts[Symbol.iterator] === "function") {
            for (const context of executionContexts as Iterable<ExecutionContext>) {
                if (context.isSQLLike && context.loadingState !== LoadingState.Idle) {
                    return true;
                }
            }

            return false;
        }

        const activeContext = executionContexts.contextFromPosition?.(executionContexts.cursorPosition);

        return activeContext?.isSQLLike === true && activeContext.loadingState !== LoadingState.Idle;
    };

    private getTabCloseButtonClassName = (entry?: IOpenDocumentState): string => {
        const classNames = ["closeButton"];
        if (this.isDocumentDirty(entry)) {
            classNames.push("dirty");
        }
        if (this.isDocumentExecutingSql(entry)) {
            classNames.push("executing");
        }

        return classNames.join(" ");
    };

    private getSidebarInitialSize = (): number => {
        return this.state.showSidebar ? this.sidebarWidth : 0;
    };

    private getTabCloseIcon = (entry?: IOpenDocumentState): string | Codicon => {
        if (this.isDocumentExecutingSql(entry)) {
            return Codicon.Loading;
        }

        return this.isDocumentDirty(entry) ? Codicon.PrimitiveDot : Assets.misc.close2Icon;
    };

    private renderTabCloseButtonContent = (entry?: IOpenDocumentState): ComponentChild => {
        if (this.isDocumentExecutingSql(entry)) {
            return <Icon className="closeSpinner" src={Codicon.Loading} />;
        }

        if (!this.isDocumentDirty(entry)) {
            return <Icon src={Assets.misc.close2Icon} />;
        }

        return (
            <span className="closeIconStack">
                <Icon className="dirtyIndicator" src={Codicon.PrimitiveDot} />
                <Icon className="closeIcon" src={Assets.misc.close2Icon} />
            </span>
        );
    };

    private getConnectionWorkspaceIcon(entry?: IOpenDocumentState): string {
        if (entry?.document.type === OdmEntityType.AdminPage) {
            return pageTypeToDocumentIcon.get(entry.document.pageType) ?? Assets.file.defaultIcon;
        }

        if (entry?.document.type === OdmEntityType.Notebook) {
            return Assets.documents.notebookIcon;
        }

        return Assets.misc.scriptIcon;
    }

    private getConnectionWorkspaceCaption(entry: IOpenDocumentState, connectionCaption: string, pageCaption: string): ComponentChild {
        return (
            <span className="tabCaptionMain">
                {getOpenDocumentDisplayCaption(entry, {
                    connectionCaption,
                    pageCaption,
                })}
            </span>
        );
    }

}
