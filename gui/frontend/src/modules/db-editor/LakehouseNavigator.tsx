/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

import dataLakeIcon from "../../assets/images/dataLake.svg";
import ensurePrivilegesIcon from "../../assets/images/ensurePrivileges.svg";
import onPremiseIcon from "../../assets/images/folder.svg";
import currentFolderIcon from "../../assets/images/folderCurrent.svg";
import lakehouseIcon from "../../assets/images/lakehouseHouse.svg";
import lakehouseNavigatorIcon from "../../assets/images/lakehouseNavigator.svg";
import lakeHouseDiagram from "../../assets/images/lakehouseNavigatorLakeHouse.svg";
import objectStorageDiagram from "../../assets/images/lakehouseNavigatorObjectStorage.svg";
import onPremiseDiagram from "../../assets/images/lakehouseNavigatorOnPremise.svg";
import schemaTableIcon from "../../assets/images/schemaTable.svg";
import shellTaskIcon from "../../assets/images/shellTask.svg";
import "./assets/LakehouseNavigator.css";

import { ComponentChild, createRef, render } from "preact";

import { CellComponent, EmptyCallback, RowComponent } from "tabulator-tables";
import { DialogHost } from "../../app-logic/DialogHost.js";
import { ui } from "../../app-logic/UILayer.js";
import { DialogResponseClosure, DialogType } from "../../app-logic/general-types.js";
import { IBucketObjectSummary, IBucketSummary, ICompartment } from "../../communication/Oci.js";
import { IMdsChatStatus, IMdsProfileData } from "../../communication/ProtocolMds.js";
import { Button } from "../../components/ui/Button/Button.js";
import { CheckState, Checkbox } from "../../components/ui/Checkbox/Checkbox.js";
import { Codicon } from "../../components/ui/Codicon.js";
import {
    ComponentBase, IComponentProperties, IComponentState, SelectionType,
} from "../../components/ui/Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../../components/ui/Container/Container.js";
import { Divider } from "../../components/ui/Divider/Divider.js";
import { Dropdown } from "../../components/ui/Dropdown/Dropdown.js";
import { DropdownItem } from "../../components/ui/Dropdown/DropdownItem.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import { Image } from "../../components/ui/Image/Image.js";
import { Input } from "../../components/ui/Input/Input.js";
import { Label } from "../../components/ui/Label/Label.js";
import { ISplitterPaneSizeInfo, SplitContainer } from "../../components/ui/SplitContainer/SplitContainer.js";
import { StatusBar } from "../../components/ui/Statusbar/Statusbar.js";
import { Tabview } from "../../components/ui/Tabview/Tabview.js";
import { Toggle } from "../../components/ui/Toggle/Toggle.js";
import { Toolbar } from "../../components/ui/Toolbar/Toolbar.js";
import { SetDataAction, TreeGrid } from "../../components/ui/TreeGrid/TreeGrid.js";
import { IOpenFileDialogResult } from "../../supplement/RequisitionTypes.js";
import { appParameters, requisitions } from "../../supplement/Requisitions.js";
import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { selectFile, uuidBinary16Base64 } from "../../utilities/helpers.js";
import { escapeSqlString, formatBytes, formatInteger } from "../../utilities/string-helpers.js";
import { IToolbarItems } from "./index.js";

export enum LakehouseNavigatorTab {
    Overview = "overview",
    Upload = "upload",
    Load = "load",
    Manage = "manage",
}

interface ILakehouseNavigatorProperties extends IComponentProperties {
    backend: ShellInterfaceSqlEditor;
    savedState: ILakehouseNavigatorSavedState;

    /** Top level toolbar items, to be integrated with page specific ones. */
    toolbarItems: IToolbarItems;

    genAiStatus?: IMdsChatStatus;

    onLakehouseNavigatorStateChange: (data: Partial<ILakehouseNavigatorSavedState>) => void;
}

export interface ILakehouseNavigatorState extends IComponentState {
    expandedObjTreeItems?: string[];

    activeSchema?: string;

    activeTabId: LakehouseNavigatorTab;
    activeProfile?: IMdsProfileData;
    profiles?: IMdsProfileData[];
    formats?: ILakehouseFormats[];
    availableDatabaseSchemas?: string[];

    task?: ILakehouseTask;
    lastTaskId?: string;
    lastTaskScheduleError?: string;
    lastTaskListError?: string;

    autoRefreshTablesAndTasks?: boolean;
    taskTableTopRowIndex?: number;
    heatWaveMemoryTotal?: number;
    heatWaveMemoryUsed?: number;

    filesForUpload?: IUploadFileItem[];
    uploadTarget?: IObjectStorageTreeItem;
    fileUploadTargetPath?: string;
    lastFileUploadError?: string;
    uploadRunning?: boolean;
    uploadComplete?: boolean;

    newTaskPanelWidth?: number;
    filesForUploadPanelWidth?: number;
    taskListPanelHeight?: number;
}

interface IUploadFileItem {
    filePath: string;
    uploadComplete: boolean;
    fileSize?: number;
    bytesUploadedTotal?: number;
    error?: string;
}

export interface ILakehouseNavigatorSavedState extends ILakehouseNavigatorState {
    objTreeItems?: IObjectStorageTreeItem[];
    lakehouseTables?: ILakehouseTable[];
    lakehouseTablesHash?: string;
    lakehouseTasks?: ILakehouseTask[];
    lakehouseTasksHash?: string;
}

interface ILakehouseTable {
    id: string;
    schemaName: string;
    tableName: string;
    loaded: boolean;
    progress: number;
    comment: string;
    rows: number;
    dataLength: number;
    lastChange: string;
}

export interface ILakehouseFormats {
    caption: string;
    id: string;
}

export interface ILakehouseTaskItem {
    id: string;
    caption: string;
    uri: string;
    namespace: string;
    tableName?: string;
    type: ObjectStorageTreeItemType;
    iconSrc: Codicon;
    progress?: number;
    expanded?: boolean;
}

export interface ILakehouseTask {
    id?: string;
    title?: string;
    description?: string;
    schemaName?: string;
    tableName?: string;
    userModified?: boolean;
    items?: ILakehouseTaskItem[];
    activeFormat?: string;
    progress?: number;
    status?: string;
    statusMessage?: string;
    startingTime?: string;
    logTime?: string;
    estimatedCompletionTime?: string;
    estimatedRemainingTime?: number;
    languageId?: string;
}

enum ObjectStorageTreeItemType {
    Placeholder,
    Compartment,
    Bucket,
    Prefix,
    File,
    Error,
}

interface IPlaceholderEntry {
    type: ObjectStorageTreeItemType.Placeholder;
    name?: "Placeholder";
}

interface ICompartmentEntry extends ICompartment {
    type: ObjectStorageTreeItemType.Compartment;
    isCurrent: boolean;
}

interface IBucketEntry extends IBucketSummary {
    type: ObjectStorageTreeItemType.Bucket;
}

interface IBucketPrefixEntry {
    type: ObjectStorageTreeItemType.Prefix;
    name: string;
    bucketName: string;
    namespace: string;
    compartmentId: string;
}

interface IBucketFileEntry extends IBucketObjectSummary {
    type: ObjectStorageTreeItemType.File;
    bucketName: string;
}

interface IErrorEntry {
    type: ObjectStorageTreeItemType.Error;
    name: string;
}

export interface IObjectStorageTreeItem {
    id: string;
    expanded?: boolean;     // Currently expanded?
    expandedOnce?: boolean; // Was expanded before?
    firstItem?: boolean;
    lastItem?: boolean;

    data: ICompartmentEntry | IBucketEntry | IBucketPrefixEntry | IBucketFileEntry | IPlaceholderEntry | IErrorEntry;

    parent?: IObjectStorageTreeItem;
    children?: IObjectStorageTreeItem[];
}

const isTask = (data: ILakehouseTask | ILakehouseTaskItem):
    data is ILakehouseTask => {
    return (data as ILakehouseTask).title !== undefined;
};

export class LakehouseNavigator extends ComponentBase<ILakehouseNavigatorProperties, ILakehouseNavigatorState> {

    #objTreeRef = createRef<TreeGrid>();
    #schemaTreeRef = createRef<TreeGrid>();
    #tablesTreeRef = createRef<TreeGrid>();
    #tasksTreeRef = createRef<TreeGrid>();
    #scheduledTasksTimer: ReturnType<typeof setTimeout> | null = null;

    #firstRun = true;

    #objTreeItems: IObjectStorageTreeItem[] | undefined;
    #lakehouseTables: ILakehouseTable[] | undefined;
    #lakehouseTablesHash: string | undefined;
    #lakehouseTasks: ILakehouseTask[] | undefined;
    #lakehouseTasksHash: string | undefined;
    #lakehouseTaskRunning = false;

    public constructor(props: ILakehouseNavigatorProperties) {
        super(props);

        this.state = {
            autoRefreshTablesAndTasks: true,
            activeTabId: LakehouseNavigatorTab.Overview,
        };

        this.#objTreeItems = props.savedState.objTreeItems;
        this.#lakehouseTables = props.savedState.lakehouseTables;
        this.#lakehouseTablesHash = props.savedState.lakehouseTablesHash;
        this.#lakehouseTasks = props.savedState.lakehouseTasks;
        this.#lakehouseTasksHash = props.savedState.lakehouseTasksHash;

        this.addHandledProperties("backend", "toolbarItems", "savedState");
    }

    public static override getDerivedStateFromProps(props: ILakehouseNavigatorProperties,
        state: ILakehouseNavigatorState): Partial<ILakehouseNavigatorState> {

        // If no state is yet set, use the saved state as passed in by the props if available
        if (state.profiles === undefined) {
            return props.savedState;
        }

        return {};
    }

    public override componentDidMount(): void {
        requisitions.register("selectFile", this.selectFile);

        void this.updateValues();

        this.updateObjStorageTreeGrid();
        this.updateLakehouseTablesTreeGrid();
        this.updateLakehouseTasksTreeGrid();
    }

    public override readonly componentWillUnmount = (): void => {
        const { onLakehouseNavigatorStateChange } = this.props;

        requisitions.unregister("selectFile", this.selectFile);

        // Clear the timers before unmounting
        if (this.#scheduledTasksTimer !== null) {
            clearTimeout(this.#scheduledTasksTimer);
            this.#scheduledTasksTimer = null;
        }

        // Save the current state before unmount
        onLakehouseNavigatorStateChange({
            ...this.state,
            objTreeItems: this.#objTreeItems,
            lakehouseTables: this.#lakehouseTables,
            lakehouseTablesHash: this.#lakehouseTablesHash,
            lakehouseTasks: this.#lakehouseTasks,
            lakehouseTasksHash: this.#lakehouseTasksHash,
        });
    };

    public override componentDidUpdate(prevProps: ILakehouseNavigatorProperties,
        prevState: ILakehouseNavigatorState): void {
        const { backend } = this.props;
        const { activeProfile, formats, availableDatabaseSchemas } = this.state;

        // If we reopen a connection, a new backend is created and we need to refresh the page.
        if (backend !== prevProps.backend) {
            void this.updateValues();
        }

        // If the active profile is changed, rebuild the Object Storage Tree
        if (activeProfile?.profile !== prevState.activeProfile?.profile) {
            void this.refreshObjTreeItems();
        }

        if (formats === undefined) {
            // TODO: fetch supported formats via metadata procedure
            this.setState({
                formats: [
                    { caption: "PDF (Portable Document Format Files)", id: "pdf" },
                    { caption: "TXT (Plain Text Files)", id: "txt" },
                    { caption: "HTML (HyperText Markup Language Files)", id: "html" },
                    { caption: "DOC (MS Work Documents)", id: "doc" },
                    { caption: "PPT (MS PowerPoint Documents)", id: "ppt" },
                ],
            });
        }

        if (!availableDatabaseSchemas) {
            this.refreshAvailableDatabaseSchemas();
        }

        this.updateObjStorageTreeGrid();
        this.updateLakehouseTablesTreeGrid();
        this.updateLakehouseTasksTreeGrid();
    }

    public render(): ComponentChild {
        const { toolbarItems } = this.props;
        const { activeTabId } = this.state;

        // If toolbar items are given, render a toolbar with them.
        const toolbar = <Toolbar id="lakehouseNavigatorToolbar" dropShadow={false} >
            {toolbarItems.navigation}
            {this.toolbarContent()}
            <div className="expander" />
            {toolbarItems.auxillary}
        </Toolbar>;

        const pages = [
            {
                id: LakehouseNavigatorTab.Overview,
                caption: "Overview",
                tooltip: "Lakehouse Navigator Overview",

                content: this.getOverviewTabContent(),
            },
            {
                id: LakehouseNavigatorTab.Upload,
                caption: "Upload to Object Storage",
                tooltip: "Upload local files to Object Storage",

                content: this.getUploadTabContent(),
            },
            {
                id: LakehouseNavigatorTab.Load,
                caption: "Load into Lakehouse",
                tooltip: "Load from Object Storage into Lakehouse",

                content: this.getLoadTabContent(),
            },
            {
                id: LakehouseNavigatorTab.Manage,
                caption: "Lakehouse Tables",
                tooltip: "Lakehouse Tables and Loading Tasks",

                content: this.getTablesAndTasksTabContent(),
            },
        ];

        return (
            <Container
                className="lakehouseNavigatorHost"
                orientation={Orientation.TopDown}
            >
                {toolbar}
                <Tabview
                    pages={pages}
                    selectedId={activeTabId}
                    stretchTabs={true}
                    onSelectTab={this.handleSelectTab}
                />
            </Container>
        );
    }

    private toolbarContent = (): ComponentChild[] => {
        return [
            <Divider vertical={true} thickness={1} key="refreshSeparator" />,
            <Button
                id="ensureUserPrivilegesBtn"
                className="toolbarButton"
                key="ensureUserPrivileges"
                data-tooltip="Assign the required privileges to a MySQL user"
                imageOnly={true}
                onClick={() => { void this.handleEnsureUserPrivileges(); }}
            >
                <Icon src={ensurePrivilegesIcon} data-tooltip="inherit" />
            </Button>,
        ];
    };

    private getOverviewTabContent = (): ComponentChild => {
        return (<Container
            className={"overviewTab"}
            orientation={Orientation.TopDown}
            mainAlignment={ContentAlignment.Start}
            crossAlignment={ContentAlignment.Stretch}
        >
            <Container
                className={"overviewDiagram"}
                orientation={Orientation.LeftToRight}
                mainAlignment={ContentAlignment.Start}
                crossAlignment={ContentAlignment.Stretch}
            >
                <Container
                    className="workflowStep onPremise"
                    orientation={Orientation.TopDown}
                    mainAlignment={ContentAlignment.Stretch}
                    crossAlignment={ContentAlignment.Center}
                >
                    <Container className="iconLabel">
                        <Icon src={onPremiseIcon} color="#ffffff" />
                        <Label className="title" caption="On-Premise" />
                    </Container>
                    <Label className="subTitle">Data to be analyzed<br />
                        (on your local storage)</Label>
                    <Image className="diagram onPremiseDiagram" src={onPremiseDiagram} />
                    <Container
                        className={"actionPanel"}
                        orientation={Orientation.TopDown}
                        mainAlignment={ContentAlignment.Center}
                        crossAlignment={ContentAlignment.Stretch}
                    >
                        <Label className="title" caption="Upload Data to Object Storage" />
                        <Label className="info">
                            Select this option to upload files from
                            your local file system or local company
                            network to the Object Storage.
                        </Label>
                        <Button id="overviewUploadFilesBtn"
                            caption="Upload Files >>" onClick={this.onStartUploadClick} />
                    </Container>
                </Container>
                <Container
                    className="workflowStep objectStorage"
                    orientation={Orientation.TopDown}
                    crossAlignment={ContentAlignment.Center}
                >
                    <Container className="iconLabel">
                        <Icon src={dataLakeIcon} color="#ffffff" />
                        <Label className="title" caption="Object Storage" />
                    </Container>
                    <Label className="subTitle">Data to be analyzed<br />
                        (on OCI Object Storage)</Label>
                    <Image className="diagram objectStorageDiagram" src={objectStorageDiagram} />
                    <Container
                        className={"actionPanel"}
                        orientation={Orientation.TopDown}
                        mainAlignment={ContentAlignment.Center}
                        crossAlignment={ContentAlignment.Stretch}
                    >
                        <Label className="title" caption="Load Data into Lakehouse" />
                        <Label className="info">
                            If your files have been uploaded to the
                            OCI Object Storage select this option to
                            load the data into Lakehouse.
                        </Label>
                        <Button id="overviewStartLoadBtn"
                            caption="Start Load >>" onClick={this.onStartLoadClick} />
                    </Container>
                </Container>
                <Container
                    className="workflowStep lakeHouse"
                    orientation={Orientation.TopDown}
                    crossAlignment={ContentAlignment.Center}
                >
                    <Container className="iconLabel">
                        <Icon src={lakehouseIcon} color="#ffffff" />
                        <Label className="title" caption="Lakehouse" />
                    </Container>
                    <Label className="subTitle">Data ready for analysis<br />
                        (held in memory)</Label>
                    <Image className="diagram lakeHouseDiagram" src={lakeHouseDiagram} />
                    <Container
                        className={"actionPanel"}
                        orientation={Orientation.TopDown}
                        mainAlignment={ContentAlignment.Center}
                        crossAlignment={ContentAlignment.Stretch}
                    >
                        <Label className="title" caption="Manage Lakehouse Tables" />
                        <Label className="info">
                            This option allows you to monitor running
                            your data loading task and manage your
                            data inside Lakehouse.
                        </Label>
                        <Button id="overviewManageLakehouse"
                            caption="Manage Lakehouse" onClick={this.onManageClick} />
                    </Container>
                </Container>
                <Container className="stepSeparator step1to2">&gt;&gt;&gt;</Container>
                <Container className="stepSeparator step2to3">&gt;&gt;&gt;</Container>
            </Container>
            <Container className="headerTitle">
                <Label caption="HeatWave Lakehouse Navigator" />
            </Container>
        </Container>);
    };

    private getUploadTabContent = (): ComponentChild => {
        const { filesForUpload, lastFileUploadError, uploadTarget, uploadRunning, uploadComplete,
            filesForUploadPanelWidth, fileUploadTargetPath } = this.state;

        let targetPath = "";
        switch (uploadTarget?.data.type) {
            case (ObjectStorageTreeItemType.Bucket):
                targetPath = uploadTarget.data.name + "/";
                break;

            case (ObjectStorageTreeItemType.Prefix):
                targetPath = uploadTarget.data.bucketName + "/" + uploadTarget.data.name;
                break;

            default:
        }

        const filesForUploadItems = filesForUpload !== undefined && filesForUpload.length > 0
            ? filesForUpload.map((item, index) => {
                const itemProgress = ((item.bytesUploadedTotal ?? 0) / (item.fileSize ?? 1)) * 100;

                return (
                    <Container
                        className="loadingTaskItem"
                        orientation={Orientation.TopDown}
                        mainAlignment={ContentAlignment.Stretch}
                        crossAlignment={ContentAlignment.Stretch}
                        id={`loadingTaskItem${index}`}
                    >
                        <Icon className="remove" src={Codicon.Close}
                            onClick={(e) => {
                                this.handleRemoveFileForUploadItem(e, item.filePath);
                            }} />
                        <Container
                            orientation={Orientation.TopDown}
                            mainAlignment={ContentAlignment.Stretch}
                            crossAlignment={ContentAlignment.Stretch}
                        >
                            <Container className="iconLabel">
                                <Icon src={Codicon.File} />
                                <Label id={`loadingTaskItemLbl${index}`} className="itemCaption"
                                    caption={item.filePath.replace(/^.*[\\/]/, "")} />
                            </Container>
                            <Container>
                                <Label id={`loadingTaskItemStatusLbl${index}`} className="loadingTaskItemStatus"
                                    caption={item.fileSize !== undefined &&
                                        item.bytesUploadedTotal !== undefined
                                        ? `Uploaded: ${formatBytes(item.bytesUploadedTotal)} / `
                                        + `${formatBytes(item.fileSize)}`
                                        : "Uploaded: -"} />
                            </Container>
                            {!item.uploadComplete && item.bytesUploadedTotal !== undefined
                                && item.fileSize !== undefined &&
                                <Container className="progressBar loadingTaskItem stripesLoader"
                                    style={{
                                        backgroundPosition: itemProgress * -1.5,
                                    }} />
                            }
                            {item.error !== undefined &&
                                <Label id={`loadingTaskItemErrorLbl${index}`} className="error"
                                    caption={item.error} />
                            }
                        </Container>
                    </Container>);
            }) : undefined;

        const filesForUploadPanel = <Container
            className="filesForUpload mainPanel"
            orientation={Orientation.TopDown}
            mainAlignment={ContentAlignment.Stretch}
            crossAlignment={ContentAlignment.Stretch}
        >
            <Label className="titleLbl" caption="Files for Upload" />
            <Container
                className={"panelToolbar"}
                orientation={Orientation.LeftToRight}
                mainAlignment={ContentAlignment.Start}
                crossAlignment={ContentAlignment.Center}
            >
                <Label caption="Path:" />
                <Input id="uploadTargetPath" value={targetPath + (fileUploadTargetPath ?? "")}
                    disabled={uploadTarget === undefined}
                    onBlur={(_e, _props) => {
                        if (fileUploadTargetPath && fileUploadTargetPath !== "" &&
                            !fileUploadTargetPath.endsWith("/")) {
                            this.setState({ fileUploadTargetPath: fileUploadTargetPath + "/" });
                        }
                    }}
                    onChange={(_e, props) => {
                        if (props.value.length > targetPath.length) {
                            this.setState({ fileUploadTargetPath: props.value.slice(targetPath.length) });
                        }
                    }} />
                <Button className="clearFilesForUpload" imageOnly={true} id="objBrowserRefreshBtn"
                    onClick={() => {
                        this.setState({ filesForUpload: undefined }, () => {
                            this.forceUpdate();
                        });
                    }}>
                    <Icon src={Codicon.Trash} />
                </Button>
            </Container>
            <Container
                className="loadingTaskItems"
                orientation={Orientation.TopDown}
                mainAlignment={filesForUpload !== undefined && filesForUpload.length > 0
                    ? ContentAlignment.Start : ContentAlignment.Stretch}
                crossAlignment={ContentAlignment.Stretch}
            >
                {filesForUploadItems !== undefined &&
                    filesForUploadItems
                }
                <Container
                    className="uploadFilesInfo"
                    orientation={Orientation.TopDown}
                    mainAlignment={ContentAlignment.Center}
                    crossAlignment={ContentAlignment.Center}
                >
                    {filesForUploadItems === undefined &&
                        <>
                            <Label className="addFilesLbl" caption="• Add files for upload"
                                onClick={this.handleAddFilesForUpload} />
                        </>}
                    {uploadTarget === undefined &&
                        <>
                            <Label caption="• Select a target in the Object Storage Browser" />
                        </>}
                    {uploadRunning !== true && uploadComplete !== true &&
                        <Label caption="• Click the Start File Upload button" />
                    }
                </Container>
            </Container>
            <Container
                className="loadingTaskActions"
                orientation={Orientation.TopDown}
                mainAlignment={ContentAlignment.Stretch}
                crossAlignment={ContentAlignment.Stretch}
            >
                <Container
                    className="loadingTaskActionButtons"
                    orientation={Orientation.LeftToRight}
                    mainAlignment={ContentAlignment.Stretch}
                    crossAlignment={ContentAlignment.Stretch}
                >
                    <Button id="uploadAddFilesBtn"
                        onClick={this.handleAddFilesForUpload}
                        disabled={uploadRunning === true}>
                        <Icon src={Codicon.Add} /><Label caption="Add Files" />
                    </Button>
                    <Button id="uploadStartFileUploadBtn"
                        onClick={(_e, _props) => {
                            void this.onStartFileUploadClick();
                        }}
                        disabled={!(filesForUpload !== undefined && filesForUpload?.length > 0
                            && uploadTarget !== undefined) || uploadRunning === true}>
                        <Label caption="Start File Upload" /><Icon src={Codicon.ArrowRight} />
                    </Button>
                </Container>
                {lastFileUploadError &&
                    <Label id="uploadErrorLbl"
                        className="error" caption={lastFileUploadError} />
                }
            </Container>
        </Container>;

        return <Container
            className={"uploadTab"}
            orientation={Orientation.TopDown}
            mainAlignment={ContentAlignment.Center}
            crossAlignment={ContentAlignment.Stretch}
        >
            <SplitContainer
                className="mainSplitter"
                panes={
                    [
                        {
                            id: "filesForUpload",
                            minSize: 380,
                            initialSize: (filesForUploadPanelWidth ?? -1) > -1 ? filesForUploadPanelWidth : 380,
                            snap: true,
                            collapsed: false,
                            resizable: true,
                            content: filesForUploadPanel,
                        },
                        {
                            id: "objectStoreBrowserForFileUpload",
                            minSize: 300,
                            snap: false,
                            stretch: true,
                            content: <>
                                <Container
                                    className="separator"
                                    orientation={Orientation.TopDown}
                                    mainAlignment={ContentAlignment.Center}
                                    crossAlignment={ContentAlignment.Center}
                                >
                                    <Icon src={Codicon.ArrowRight} className="arrowIcon" />
                                </Container>
                                {this.getObjectStoreBrowserContent()}
                            </>,
                        },
                    ]}
                onPaneResized={this.handlePaneResize}
            />
        </Container>;
    };

    private getObjectStoreBrowserContent = (): ComponentChild => {
        const { activeProfile, profiles } = this.state;

        return <Container
            className="objectStorageBrowser mainPanel"
            orientation={Orientation.TopDown}
            mainAlignment={ContentAlignment.Start}
            crossAlignment={ContentAlignment.Stretch}
        >
            <Label className="titleLbl" caption="Object Storage Browser" />
            <Container
                className={"panelToolbar"}
                orientation={Orientation.LeftToRight}
                mainAlignment={ContentAlignment.Start}
                crossAlignment={ContentAlignment.Center}
            >
                <Label caption="OCI Profile:" />
                <Dropdown id="objBrowserOciProfileDropdown"
                    placeholder="Profile" selection={activeProfile?.profile}
                    onSelect={this.handleProfileSelection}>
                    {profiles?.map((profile) => {
                        return ((
                            <DropdownItem caption={profile.profile} id={profile.profile} />));
                    })}
                </Dropdown>
                <Container className="placeHolder" />
                <Button className="refreshBtn" imageOnly={true} id="objBrowserRefreshBtn"
                    onClick={(_e) => {
                        void this.refreshObjTreeItems().then(() => {
                            this.forceUpdate();
                        });
                    }}>
                    <Icon src={Codicon.Refresh} />
                </Button>
            </Container>
            {profiles !== undefined && profiles.length > 0 ?
                <TreeGrid
                    ref={this.#objTreeRef}
                    options={{
                        index: "ocid",
                        layout: "fitColumns",
                        showHeader: true,
                        rowHeight: 20,
                        treeColumn: "item",
                        treeChildIndent: 10,
                        selectionType: SelectionType.Multi,
                    }}
                    columns={[{
                        title: "Object Storage Item",
                        field: "item",
                        editable: false,
                        formatter: this.objectStoreTreeGridCaptionColumnFormatter,
                    }, {
                        title: "Size",
                        field: "size",
                        minWidth: 80,
                        width: 80,
                        editable: false,
                        formatter: this.objectStoreTreeGridColumnFormatter,
                    }, {
                        title: "Modified",
                        field: "modified",
                        minWidth: 110,
                        width: 110,
                        editable: false,
                        formatter: this.objectStoreTreeGridColumnFormatter,
                    }]}
                    onRowExpanded={this.objTreeHandleRowExpanded}
                    onRowCollapsed={this.objTreeHandleRowCollapsed}
                    isRowExpanded={this.objTreeIsRowExpanded}
                />
                : <Container
                    className="loadingTaskItemInfo"
                    orientation={Orientation.TopDown}
                    mainAlignment={ContentAlignment.Center}
                    crossAlignment={ContentAlignment.Center}
                >
                    <Label caption={"Please add your OCI configuration to the " +
                        "Oracle Cloud Infrastructure sidebar."} />
                </Container>}
        </Container>;
    };

    private getLoadTabContent = (): ComponentChild => {
        const { activeSchema, task, availableDatabaseSchemas,
            formats, lastTaskScheduleError, newTaskPanelWidth } = this.state;
        const { genAiStatus: getAiStatus } = this.props;

        const taskItems = (task?.items !== undefined && task?.items?.length > 0)
            ? task?.items : [];

        const languageSupportEnabled = getAiStatus?.languageSupport;

        const newLoadingTaskPanel = <>
            <Container
                className="loadingTaskPreview mainPanel"
                orientation={Orientation.TopDown}
                mainAlignment={ContentAlignment.Stretch}
                crossAlignment={ContentAlignment.Stretch}
            >
                <Label className="titleLbl" caption="New Loading Task" />
                <Container
                    className="taskProperties"
                    orientation={Orientation.TopDown}
                    mainAlignment={ContentAlignment.Start}
                    crossAlignment={ContentAlignment.Stretch}
                >
                    <Container
                        className="taskPropertyContainer"
                        orientation={Orientation.LeftToRight}
                        mainAlignment={ContentAlignment.Stretch}
                        crossAlignment={ContentAlignment.Stretch}
                    >
                        <Icon src={lakehouseNavigatorIcon} className="loadingTaskPreviewIcon" />
                        <Container className="taskInputLabelContainer" orientation={Orientation.TopDown}>
                            <Label caption="Vector Store Table Name" />
                            <Input id="loadTaskTableName" className="taskTableName" autoFocus={true}
                                placeholder="lakehouse_data_<#>" value={task?.tableName}
                                onChange={this.onTaskPropertyChange}
                            />
                        </Container>
                    </Container>
                    <Container className="taskInputLabelContainer" orientation={Orientation.TopDown}>
                        <Label caption="Table Description"></Label>
                        <Input id="loadTaskDescription" className="taskDescription"
                            placeholder={this.getDefaultTaskDescription(task)} multiLine={true}
                            multiLineCount={2} value={task?.description}
                            onChange={this.onTaskPropertyChange} />
                    </Container>
                    <Container
                        className="taskPropertyContainer"
                        orientation={Orientation.LeftToRight}
                        mainAlignment={ContentAlignment.Stretch}
                        crossAlignment={ContentAlignment.End}
                    >
                        <Container className="taskInputLabelContainer" orientation={Orientation.TopDown}>
                            <Label caption="Target Database Schema" />
                            <Container className="taskInputLabelContainer" orientation={Orientation.LeftToRight}>
                                <Dropdown id="loadTaskTargetSchemaDropdown"
                                    selection={activeSchema}
                                    onSelect={this.handleSchemaSelection}>
                                    {availableDatabaseSchemas?.map((schemaName) => {
                                        return <DropdownItem caption={schemaName} id={schemaName} />;
                                    })}
                                </Dropdown>
                                <Button id="loadTaskAddSchemaBtn" imageOnly={true}
                                    onClick={(_e, _props) => { void this.onAddSchemaBtnClick(); }} >
                                    <Icon src={Codicon.Add} />
                                </Button>
                                <Button id="refreshTaskAddSchemaBtn" imageOnly={true}
                                    onClick={(_e, _props) => { this.refreshAvailableDatabaseSchemas(); }}>
                                    <Icon src={Codicon.Refresh} />
                                </Button>
                            </Container>
                        </Container>
                    </Container>
                    <Container className="taskInputLabelContainer" orientation={Orientation.TopDown}>
                        <Label caption="Formats:" />
                        <Dropdown id="loadTaskFormatsDropdown"
                            selection={task?.activeFormat === undefined
                                ? "all" : task.activeFormat}
                            onSelect={this.handleFormatSelection}>
                            <DropdownItem caption="All Supported Formats" id="all" />
                            {formats?.map((format) => {
                                return ((
                                    <DropdownItem caption={format.caption} id={format.id} />));
                            })}
                        </Dropdown>
                    </Container>
                    {languageSupportEnabled &&
                        <Container className="taskInputLabelContainer" orientation={Orientation.TopDown}>
                            <Label caption="Language:" />
                            <Dropdown id="loadTaskLanguageDropdown"
                                selection={task?.languageId === undefined ? "en" : task.languageId}
                                onSelect={this.handleLanguageSelection}>
                                <DropdownItem caption="English" id="en" />
                                <DropdownItem caption="German" id="de" />
                                <DropdownItem caption="French" id="fr" />
                                <DropdownItem caption="Spanish" id="es" />
                                <DropdownItem caption="Portuguese" id="pt" />
                                <DropdownItem caption="Italian" id="it" />
                                <DropdownItem caption="Dutch" id="nl" />
                                <DropdownItem caption="Czech" id="cs" />
                                <DropdownItem caption="Polish" id="pl" />
                                <DropdownItem caption="Persian" id="fa" />
                                <DropdownItem caption="Hindi" id="hi" />
                                <DropdownItem caption="Bengali" id="bn" />
                                <DropdownItem caption="Urdu" id="ur" />
                                <DropdownItem caption="Brazilian Portuguese" id="pt-BR" />
                                <DropdownItem caption="Chinese" id="zh" />
                                <DropdownItem caption="Arabic" id="ar" />
                                <DropdownItem caption="Hebrew" id="he" />
                                <DropdownItem caption="Tibetan" id="bo" />
                                <DropdownItem caption="Turkish" id="tr" />
                                <DropdownItem caption="Japanese" id="ja" />
                                <DropdownItem caption="Korean" id="ko" />
                                <DropdownItem caption="Vietnamese" id="vi" />
                                <DropdownItem caption="Khmer" id="km" />
                                <DropdownItem caption="Thai" id="th" />
                                <DropdownItem caption="Lao" id="lo" />
                                <DropdownItem caption="Indonesian" id="id" />
                                <DropdownItem caption="Malay" id="ms" />
                                <DropdownItem caption="Tagalog" id="tl" />
                            </Dropdown>
                        </Container>}
                </Container>
                <Container
                    className="loadingTaskItems"
                    orientation={Orientation.TopDown}
                    mainAlignment={taskItems.length > 0
                        ? ContentAlignment.Start : ContentAlignment.Stretch}
                    crossAlignment={ContentAlignment.Stretch}
                >
                    {taskItems.length > 0 ? taskItems.map((item, index) => {
                        return (
                            <Container id={`loadingTaskItemDiv${index}`}
                                className="loadingTaskItem"
                                orientation={Orientation.TopDown}
                                mainAlignment={ContentAlignment.Stretch}
                                crossAlignment={ContentAlignment.Stretch}
                            >
                                <Icon className="remove" src={Codicon.Close}
                                    onClick={(e) => { this.handleRemoveTaskItem(e, item.id); }} />
                                <Container className="iconLabel">
                                    <Icon src={item.iconSrc} />
                                    <Label id={`taskItemLbl${index}`} className="itemCaption"
                                        caption={item.caption} />
                                </Container>
                                <Container className="taskInputLabelContainer"
                                    orientation={Orientation.LeftToRight}
                                    mainAlignment={ContentAlignment.Stretch}
                                    crossAlignment={ContentAlignment.Center}
                                >
                                    <Label className="taskItemUriLbl" caption="URI:" />
                                    <Input value={item.uri} className="taskItemUri" id={`taskItemUri${index}`}
                                        onChange={this.onTaskPropertyChange} />
                                </Container>
                                {item.expanded &&
                                    <Container
                                        className="taskInputLabelContainer"
                                        orientation={Orientation.LeftToRight}
                                        mainAlignment={ContentAlignment.Center}
                                        crossAlignment={ContentAlignment.Center}
                                    >
                                        <Label caption="Table:" />
                                        <Input value={item.tableName} className="taskItemTableName"
                                            id={`taskItemTableName${index}`}
                                            placeholder={"lakehouse_data_<#>"}
                                            onChange={this.onTaskPropertyChange} />
                                    </Container>
                                }
                            </Container>);
                    }) : <Container
                        className="loadingTaskItemInfo"
                        orientation={Orientation.TopDown}
                        mainAlignment={ContentAlignment.Center}
                        crossAlignment={ContentAlignment.Center}
                    >
                        <Label caption="Please select items from the Object Storage Browser." />
                    </Container>}
                </Container>
                <Container
                    className="loadingTaskActions"
                    orientation={Orientation.TopDown}
                    mainAlignment={ContentAlignment.Stretch}
                    crossAlignment={ContentAlignment.Stretch}
                >
                    <Container
                        className="loadingTaskActionButtons"
                        orientation={Orientation.LeftToRight}
                        mainAlignment={ContentAlignment.Stretch}
                        crossAlignment={ContentAlignment.Stretch}
                    >
                        <Button id="loadStartLoadingTaskBtn"
                            onClick={(_e, _props) => { void this.onStartLoadingTaskClick(); }}
                            disabled={taskItems.length === 0 || task?.schemaName === undefined
                                || task?.schemaName === ""}>
                            <Label caption="Start Loading Task" /><Icon src={Codicon.ArrowRight} />
                        </Button>
                    </Container>
                    {lastTaskScheduleError &&
                        <Label id="loadErrorLbl" className="error" caption={lastTaskScheduleError} />
                    }
                </Container>
            </Container>
        </>;

        return <Container
            className={"loadTab"}
            orientation={Orientation.TopDown}
            mainAlignment={ContentAlignment.Start}
            crossAlignment={ContentAlignment.Stretch}
        >
            <SplitContainer
                className="mainSplitter"
                panes={
                    [
                        {
                            id: "objectStoreBrowserForNewLoadTask",
                            minSize: 300,
                            snap: false,
                            stretch: true,
                            resizable: true,
                            content: <>
                                {this.getObjectStoreBrowserContent()}
                                <Container
                                    className="separator"
                                    orientation={Orientation.TopDown}
                                    mainAlignment={ContentAlignment.Center}
                                    crossAlignment={ContentAlignment.Center}
                                >
                                    <Icon src={Codicon.ArrowRight} className="arrowIcon" />
                                </Container>
                            </>,
                        },
                        {
                            id: "newLoadTask",
                            minSize: 380,
                            initialSize: (newTaskPanelWidth ?? -1) > -1 ? newTaskPanelWidth : 380,
                            snap: true,
                            collapsed: false,
                            content: newLoadingTaskPanel,
                        },
                    ]}
                onPaneResized={this.handlePaneResize}
            />
        </Container>;
    };

    private getTablesAndTasksTabContent = (): ComponentChild => {
        const { activeSchema, availableDatabaseSchemas,
            autoRefreshTablesAndTasks, taskTableTopRowIndex,
            heatWaveMemoryTotal, heatWaveMemoryUsed, lastTaskListError,
            taskListPanelHeight,
        } = this.state;

        // Use a minimum memory fill ratio of 0.03 to ensure the visibility of the progress bar
        const heatWaveMemRatio = Math.max((heatWaveMemoryUsed ?? 0) / (heatWaveMemoryTotal ?? 1), 0.03);
        const heatWaveMemFree = (heatWaveMemoryTotal ?? 0) - (heatWaveMemoryUsed ?? 0);

        const lakehouseTablePanel = <Container
            className="lakehouseTablesPanel mainPanel"
            orientation={Orientation.TopDown}
            mainAlignment={ContentAlignment.Start}
            crossAlignment={ContentAlignment.Stretch}
        >
            <Label className="titleLbl" caption="Lakehouse Tables" />
            <Container
                className={"panelToolbar"}
                orientation={Orientation.LeftToRight}
                mainAlignment={ContentAlignment.Start}
                crossAlignment={ContentAlignment.Center}
            >
                <Label caption="HeatWave Memory:" />
                <Container className="heatWaveMemory">
                    <Container className="heatWaveMemoryUsage"
                        style={{ width: `${heatWaveMemRatio * 150}px` }} />
                    <Label id="lakehouseMemLbl" caption={`${formatBytes(heatWaveMemFree)} free`} />
                </Container>
                <Container className="placeHolder" />
                <Button id="lakehouseReloadTablesBtn" caption="Reload Tables"
                    onClick={(_e, _props) => { void this.reloadSelectedTables(); }} />
                <Button id="lakehouseUnloadTablesBtn" caption="Unload Tables"
                    onClick={(_e, _props) => { void this.unloadSelectedTables(); }} />
                <Button id="lakehouseDeleteTablesBtn" imageOnly={true}
                    onClick={(_e, _props) => { void this.deleteSelectedTables(); }}>
                    <Icon src={Codicon.Trash} />
                </Button>
                <Toggle id="lakehouseAutoRefreshToggle"
                    caption="Auto-Refresh" checkState={autoRefreshTablesAndTasks
                        ? CheckState.Checked : CheckState.Unchecked}
                    onChange={this.toggleAutoRefresh} />
                <Button id="lakehouseRefreshBtn"
                    imageOnly={true}
                    onClick={(_e) => {
                        void this.autoRefreshTrees().then(() => {
                            this.forceUpdate();
                        });
                    }}>
                    <Icon src={Codicon.Refresh} />
                </Button>
            </Container>
            <Container
                className="schemaTablesContainer"
                orientation={Orientation.LeftToRight}
                mainAlignment={ContentAlignment.Start}
                crossAlignment={ContentAlignment.Stretch}
            >
                <Container
                    className="schemaList"
                    orientation={Orientation.TopDown}
                    mainAlignment={ContentAlignment.Start}
                    crossAlignment={ContentAlignment.Stretch}
                >
                    {availableDatabaseSchemas !== undefined &&
                        <TreeGrid
                            id="lakehouseSchemaListTreeGrid"
                            ref={this.#schemaTreeRef}
                            selectedRows={activeSchema !== undefined ? [activeSchema] : undefined}
                            options={{
                                index: "schemaName",
                                layout: "fitColumns",
                                showHeader: true,
                                rowHeight: 25,
                                selectionType: SelectionType.Single,
                                scrollToFirstSelected: true,
                            }}
                            columns={[{
                                title: "Database Schemas",
                                field: "schemaName",
                                editable: false,
                                formatter: this.schemasTreeGridColumnFormatter,
                            }]}
                            tableData={availableDatabaseSchemas.map((schemaName) => {
                                return { schemaName };
                            })}
                            onRowSelected={this.schemaSelected}
                        />
                    }
                </Container>
                <Container
                    className="tableList"
                    orientation={Orientation.TopDown}
                    mainAlignment={ContentAlignment.Start}
                    crossAlignment={ContentAlignment.Stretch}
                >
                    {this.#lakehouseTables !== undefined && this.#lakehouseTables.length > 0 &&
                        <TreeGrid
                            id="lakehouseTablesTreeGrid"
                            ref={this.#tablesTreeRef}
                            options={{
                                layout: "fitColumns",
                                showHeader: true,
                                rowHeight: 25,
                                selectionType: SelectionType.Multi,
                            }}
                            columns={[{
                                title: "Lakehouse Table",
                                field: "tableName",
                                editable: false,
                                formatter: this.tablesTreeGridColumnFormatter,
                            }, {
                                title: "Loaded",
                                field: "loaded",
                                width: 76,
                                widthGrow: 0.1,
                                editable: false,
                                formatter: this.tablesTreeGridColumnFormatter,
                            }, {
                                title: "Rows",
                                field: "rows",
                                width: 76,
                                widthGrow: 0.1,
                                editable: false,
                                formatter: this.tablesTreeGridColumnFormatter,
                            }, {
                                title: "Size",
                                field: "dataLength",
                                width: 86,
                                widthGrow: 0.1,
                                editable: false,
                                formatter: this.tablesTreeGridColumnFormatter,
                            }, {
                                title: "Date",
                                field: "lastChange",
                                width: 105,
                                widthGrow: 0.1,
                                editable: false,
                                formatter: this.tablesTreeGridColumnFormatter,
                            }, {
                                title: "Comment",
                                field: "comment",
                                width: 170,
                                widthGrow: 0.2,
                                editable: false,
                                formatter: this.tablesTreeGridColumnFormatter,
                            }]}
                            onFormatRow={this.tablesTreeGridRowFormatter}
                        />
                    }
                    {(this.#lakehouseTables === undefined
                        || this.#lakehouseTables.length === 0) &&
                        <Container
                            className="loadingTaskItemInfo"
                            orientation={Orientation.TopDown}
                            mainAlignment={ContentAlignment.Center}
                            crossAlignment={ContentAlignment.Center}
                        >
                            <Container
                                mainAlignment={ContentAlignment.Center}
                                crossAlignment={ContentAlignment.Center}
                            >
                                {this.#lakehouseTables === undefined
                                    && lastTaskListError === undefined &&
                                    <Icon src={Codicon.Loading} className="loading" />
                                }
                                {lastTaskListError === undefined &&
                                    <Label caption={this.#lakehouseTables?.length === 0
                                        ? "There are no Lakehouse tables in the schema yet."
                                        : "Loading table information..."} />
                                }
                                {lastTaskListError !== undefined &&
                                    <Label caption={lastTaskListError} className="error" />
                                }
                            </Container>
                        </Container>
                    }
                </Container>
            </Container>
        </Container>;

        const taskListPanel = <Container
            className="taskListPanel mainPanel"
            orientation={Orientation.TopDown}
            mainAlignment={ContentAlignment.Start}
            crossAlignment={ContentAlignment.Stretch}
        >
            <Label className="titleLbl" caption="Current Task List" />
            <Container
                className={"panelToolbar"}
                orientation={Orientation.LeftToRight}
                mainAlignment={ContentAlignment.Start}
                crossAlignment={ContentAlignment.Center}
            >
                <Container className="placeHolder" />
                <Button id="lakehouseTaskCancelBtn"
                    caption="Cancel Tasks" onClick={(_e, _props) => { void this.cancelSelectedTasks(); }} />
            </Container>
            <Container
                className="taskListContainer"
                orientation={Orientation.TopDown}
                mainAlignment={ContentAlignment.Start}
                crossAlignment={ContentAlignment.Stretch}
            >
                {this.#lakehouseTasks !== undefined && this.#lakehouseTasks.length > 0 ?
                    <TreeGrid
                        id="lakehouseTaskTreeGrid"
                        ref={this.#tasksTreeRef}
                        options={{
                            layout: "fitColumns",
                            showHeader: true,
                            rowHeight: 25,
                            selectionType: SelectionType.Multi,
                            treeChildIndent: 10,
                            treeColumn: "title",
                            childKey: "items",
                        }}
                        columns={[{
                            title: "Task",
                            field: "title",
                            editable: false,
                            formatter: this.taskTreeGridColumnFormatter,
                        }, {
                            title: "Id",
                            field: "id",
                            editable: false,
                            width: 60,
                        }, {
                            title: "Status",
                            field: "status",
                            width: 105,
                            widthGrow: 0.1,
                            editable: false,
                            formatter: this.taskTreeGridColumnFormatter,
                        }, {
                            title: "Start Time",
                            field: "startingTime",
                            width: 110,
                            widthGrow: 0.1,
                            editable: false,
                            formatter: this.taskTreeGridColumnFormatter,
                        }, {
                            title: "End Time",
                            field: "estimatedCompletionTime",
                            width: 160,
                            widthGrow: 0.1,
                            editable: false,
                            formatter: this.taskTreeGridColumnFormatter,
                        }, {
                            title: "Message",
                            field: "statusMessage",
                            width: 220,
                            widthGrow: 0.4,
                            editable: false,
                            formatter: this.taskTreeGridColumnFormatter,
                        }]}
                        onVerticalScroll={this.handleVerticalScroll}
                        topRowIndex={taskTableTopRowIndex}
                        onFormatRow={this.taskTreeGridRowFormatter}
                    /> : <Container
                        className="loadingTaskItemInfo"
                        orientation={Orientation.TopDown}
                        mainAlignment={ContentAlignment.Center}
                        crossAlignment={ContentAlignment.Center}
                    >
                        <Label caption="No loading tasks scheduled at this time." />
                    </Container>}
            </Container>
        </Container>;

        return <Container
            className={"lakehouseTablesTab"}
            orientation={Orientation.TopDown}
            mainAlignment={ContentAlignment.Start}
            crossAlignment={ContentAlignment.Stretch}
        >
            <SplitContainer
                className="mainSplitter"
                orientation={Orientation.TopDown}
                panes={
                    [
                        {
                            id: "lakehouseTablePanel",
                            minSize: 300,
                            snap: false,
                            stretch: true,
                            resizable: true,
                            content: lakehouseTablePanel,
                        },
                        {
                            id: "taskListPanel",
                            minSize: 200,
                            initialSize: taskListPanelHeight ?? 200,
                            snap: true,
                            collapsed: false,
                            content: taskListPanel,
                        },
                    ]}
                onPaneResized={this.handlePaneResize}
            />
        </Container>;
    };

    private refreshAvailableDatabaseSchemas(): void {
        const { backend } = this.props;

        backend.getCatalogObjects("Schema").then((schemaNames) => {
            this.setState({
                availableDatabaseSchemas: schemaNames.filter((name) => {
                    return name !== "mysql" && !name.startsWith("mysql_") && name !== "sys" &&
                        name !== "information_schema" && name !== "performance_schema" &&
                        name !== "mysql_shell_metadata";
                }),
            });
        }).catch((_reason) => {
            // Ignore for now
        });
    }

    private handleSelectTab = (id: string): void => {
        this.setState({ activeTabId: id as LakehouseNavigatorTab });
    };

    private updateValues = async (): Promise<void> => {
        const { backend, savedState } = this.props;
        const { activeSchema, profiles } = this.state;

        if (activeSchema === undefined) {
            if (savedState.activeSchema !== undefined) {
                this.setActiveDatabaseSchema(savedState.activeSchema);
            } else {
                const currentSchemaRes = await backend.execute("SELECT DATABASE()");
                if (currentSchemaRes?.rows !== undefined && currentSchemaRes.rows.length > 0) {
                    const row = currentSchemaRes.rows[0] as unknown[];
                    if (row[0] !== null) {
                        this.setActiveDatabaseSchema(String(row[0]));
                    }
                }
            }
        }

        // TODO: Lookup the tenancy and region of the current MDS conn. and filter the list of profiles accordingly.

        if (profiles === undefined) {
            const profiles = await backend.mhs.getMdsConfigProfiles();
            this.setState({
                profiles,
                activeProfile: profiles.find((item) => { return item.isCurrent; }),
            });
        }
    };

    private onStartUploadClick = (): void => {
        this.setState({ activeTabId: LakehouseNavigatorTab.Upload });
    };

    private onStartLoadClick = (): void => {
        this.setState({ activeTabId: LakehouseNavigatorTab.Load });
    };

    private onManageClick = (): void => {
        this.setState({ activeTabId: LakehouseNavigatorTab.Manage });
    };

    private handleProfileSelection = (_accept: boolean, ids: Set<string>): void => {
        const { profiles } = this.state;
        const id = [...ids][0];

        this.setState({
            activeProfile: profiles?.find((item) => {
                return item.profile === id;
            }),
        });
    };

    private handleSchemaSelection = (_accept: boolean, ids: Set<string>): void => {
        const { task } = this.state;
        const id = [...ids][0];

        this.setState({ task: { ...task, schemaName: id }, activeSchema: id });
    };

    private handleFormatSelection = (_accept: boolean, ids: Set<string>): void => {
        const { task } = this.state;
        const id = [...ids][0];

        this.setState({ task: { ...task, activeFormat: id === "all" ? undefined : id } });
    };

    private handleLanguageSelection = (_accept: boolean, ids: Set<string>): void => {
        const { task } = this.state;
        const id = [...ids][0];

        this.setState({ task: { ...task, languageId: id === "en" ? undefined : id } });
    };

    private refreshObjTreeItems = async (): Promise<void> => {
        const { backend } = this.props;
        const { activeProfile, expandedObjTreeItems } = this.state;

        if (activeProfile === undefined) {
            return;
        }

        this.#objTreeItems = [{
            id: uuidBinary16Base64(),
            data: { type: ObjectStorageTreeItemType.Placeholder },
        }];

        this.updateObjStorageTreeGrid();

        const treeItems: IObjectStorageTreeItem[] = [];
        let currentCompartment;

        try {
            const currentCompartmentId = await backend.mhs.getCurrentCompartmentId(activeProfile.profile);
            if (currentCompartmentId) {
                currentCompartment = await backend.mhs.getCompartmentById(
                    activeProfile.profile, currentCompartmentId);
            }
        } catch (e) {
            // Ignore
        }

        if (currentCompartment) {
            treeItems.push({
                id: currentCompartment.id,
                data: { ...currentCompartment, type: ObjectStorageTreeItemType.Compartment, isCurrent: true },
                children: await this.getObjectStorageTreeChildren({
                    id: currentCompartment.id,
                    data: {
                        ...currentCompartment,
                        type: ObjectStorageTreeItemType.Compartment,
                    } as ICompartmentEntry,
                }),
                expanded: true,
            });
            treeItems.push({
                id: activeProfile.tenancy,
                data: {
                    name: "Root Compartment",
                    type: ObjectStorageTreeItemType.Compartment,
                    isCurrent: false,
                } as ICompartmentEntry,
                children: [{
                    id: uuidBinary16Base64(),
                    data: { type: ObjectStorageTreeItemType.Placeholder },
                }],
                expanded: expandedObjTreeItems?.includes(activeProfile.tenancy),
            });
        } else {
            treeItems.push(...await this.getObjectStorageTreeChildren({
                id: activeProfile.tenancy,
                data: {
                    id: activeProfile.tenancy,
                    type: ObjectStorageTreeItemType.Compartment,
                    isCurrent: false,
                } as ICompartmentEntry,
                expanded: expandedObjTreeItems?.includes(activeProfile.tenancy),
            }));
        }

        this.#objTreeItems = treeItems;

        this.updateObjStorageTreeGrid();
    };

    private getObjectStorageTreeChildren = async (
        parent: IObjectStorageTreeItem): Promise<IObjectStorageTreeItem[]> => {
        const { backend } = this.props;
        const { activeProfile, expandedObjTreeItems } = this.state;
        const treeItems: IObjectStorageTreeItem[] = [];

        if (!activeProfile) {
            return treeItems;
        }

        if (parent.data.type === ObjectStorageTreeItemType.Compartment) {
            const parentData: ICompartment = parent.data as ICompartment;

            try {
                const compartments = await backend.mhs.getMdsCompartments(
                    activeProfile.profile, parentData.id);

                compartments.forEach((item) => {
                    treeItems.push({
                        id: item.id,
                        data: {
                            ...item,
                            type: ObjectStorageTreeItemType.Compartment,
                        },
                        parent,
                        children: [{
                            id: uuidBinary16Base64(),
                            data: { type: ObjectStorageTreeItemType.Placeholder },
                        }],
                        expanded: expandedObjTreeItems?.includes(item.id),
                    });
                });
            } catch (e) {
                treeItems.push({
                    id: uuidBinary16Base64(),
                    data: {
                        name: String(e),
                        type: ObjectStorageTreeItemType.Error,
                    },
                    parent,
                });
            }

            try {
                const buckets = await backend.mhs.getMdsBuckets(
                    activeProfile.profile, parentData.id);

                buckets.forEach((item) => {
                    const id = item.compartmentId + item.namespace + item.name;

                    treeItems.push({
                        id,
                        data: {
                            ...item,
                            type: ObjectStorageTreeItemType.Bucket,
                        },
                        parent,
                        children: [{
                            id: uuidBinary16Base64(),
                            data: { type: ObjectStorageTreeItemType.Placeholder },
                        }],
                        expanded: expandedObjTreeItems?.includes(id),
                    });
                });
            } catch (e) {
                const msg = String(e);
                if (!msg.includes("'status': 404")) {
                    treeItems.push({
                        id: uuidBinary16Base64(),
                        data: {
                            name: String(e),
                            type: ObjectStorageTreeItemType.Error,
                        },
                        parent,
                    });
                }
            }
        } else if (parent.data.type === ObjectStorageTreeItemType.Bucket ||
            parent.data.type === ObjectStorageTreeItemType.Prefix) {
            try {
                let bucketName = parent.data?.name ?? "<unknown>";
                let namespace: string;
                let compartmentId: string;
                let prefix;
                if (parent.data.type === ObjectStorageTreeItemType.Bucket) {
                    bucketName = (parent.data as IBucketSummary)?.name;
                    namespace = (parent.data as IBucketSummary)?.namespace;
                    compartmentId = (parent.data as IBucketSummary)?.compartmentId;
                } else {
                    const bucketPrefix = parent.data;
                    bucketName = bucketPrefix?.bucketName;
                    namespace = bucketPrefix?.namespace;
                    compartmentId = bucketPrefix?.compartmentId;
                    prefix = bucketPrefix?.name;
                }

                const listObjects = await backend.mhs.getMdsBucketObjects(
                    activeProfile.profile, compartmentId, bucketName,
                    undefined, prefix, "/");

                listObjects.prefixes?.forEach((item) => {
                    const id = compartmentId + bucketName + namespace + item;
                    treeItems.push({
                        id,
                        data: {
                            type: ObjectStorageTreeItemType.Prefix,
                            name: item,
                            bucketName,
                            namespace,
                            compartmentId,
                        },
                        parent,
                        children: [{
                            id: uuidBinary16Base64(),
                            data: { type: ObjectStorageTreeItemType.Placeholder },
                        }],
                        expanded: expandedObjTreeItems?.includes(id),
                    });
                });

                listObjects.objects.forEach((item) => {
                    if (!item.name.endsWith("/")) {
                        treeItems.push({
                            id: compartmentId + bucketName + namespace + item.name,
                            data: {
                                ...item,
                                bucketName,
                                type: ObjectStorageTreeItemType.File,
                            },
                            parent,
                        });
                    }
                });
            } catch (e) {
                // Ignore error
            }
        }

        return treeItems;
    };

    private objectStoreTreeGridCaptionColumnFormatter = (cell: CellComponent): string | HTMLElement => {
        const { activeTabId, task, uploadTarget } = this.state;
        const cellData = cell.getData() as IObjectStorageTreeItem;

        const host = document.createElement("div");
        host.classList.add("itemField");
        if (cellData.data.type === ObjectStorageTreeItemType.File) {
            host.classList.add("file");
        }

        let iconSrc;
        let iconClassName = "";
        let labelClassName = "itemCaption";
        let caption = cellData.data?.name ?? "";
        switch (cellData.data.type) {
            case ObjectStorageTreeItemType.Compartment: {
                iconSrc = cellData.data.isCurrent ? currentFolderIcon : Codicon.Folder;
                break;
            }

            case ObjectStorageTreeItemType.Bucket: {
                iconSrc = Codicon.Inbox;
                break;
            }

            case ObjectStorageTreeItemType.Prefix: {
                const parts = caption.split("/");
                if (parts.length >= 2) {
                    if (parts[parts.length - 2] === "" && parts[parts.length - 1] === "") {
                        caption = "/";
                    } else {
                        caption = parts[parts.length - 2] ?? caption;
                    }
                }
                iconSrc = Codicon.Folder;
                break;
            }

            case ObjectStorageTreeItemType.File: {
                iconSrc = Codicon.File;
                caption = caption.split("/").pop() ?? caption;
                break;
            }

            case ObjectStorageTreeItemType.Placeholder: {
                iconSrc = Codicon.Loading;
                iconClassName = "loading";
                caption = "Loading ...";
                break;
            }

            case ObjectStorageTreeItemType.Error: {
                iconSrc = Codicon.Error;
                labelClassName += " error";
                iconClassName = "error";
                break;
            }

            default:
                iconSrc = Codicon.File;
        }

        let checkState = CheckState.Unchecked;
        if (activeTabId === LakehouseNavigatorTab.Load) {
            if (cellData.id &&
                task?.items?.find((item) => { return item.id === cellData.id; }) !== undefined) {
                checkState = CheckState.Checked;
            } else if (cellData.parent?.id !== undefined &&
                task?.items?.find((item) => { return item.id === cellData.parent?.id; }) !== undefined) {
                checkState = CheckState.Indeterminate;
            }
        } else if (activeTabId === LakehouseNavigatorTab.Upload) {
            if (uploadTarget !== undefined && uploadTarget === cellData) {
                checkState = CheckState.Checked;
            }
        }

        const content = (<>
            {(cellData.data.type === ObjectStorageTreeItemType.Bucket ||
                cellData.data.type === ObjectStorageTreeItemType.Prefix ||
                (activeTabId === LakehouseNavigatorTab.Load &&
                    cellData.data.type === ObjectStorageTreeItemType.File)) &&
                <Checkbox
                    id={cellData.id + "CheckboxIcon"}
                    checkState={checkState}
                    onClick={(e) => { this.objTreeToggleSelectedState(e, cell); }}
                />
            }
            <Icon src={iconSrc} className={iconClassName} />
            <Label className={labelClassName} caption={caption} />
            {(cellData.data.type === ObjectStorageTreeItemType.Prefix
                || cellData.data.type === ObjectStorageTreeItemType.File) &&
                <Icon className="iconOnMouseOver" src={Codicon.Close}
                    id={cellData.id + "DeleteIcon"}
                    onClick={(e) => {
                        void this.handleObjTreeDelete(e, cell);
                    }} />
            }
        </>);

        render(content, host);

        return host;
    };

    private objectStoreTreeGridColumnFormatter = (cell: CellComponent, formatterParams: {},
        onRendered: EmptyCallback): string | HTMLElement => {
        const cellData = cell.getData() as IObjectStorageTreeItem;
        const field = cell.getColumn().getField();

        let caption = "-";
        let className: string;
        switch (field) {
            case "size": {
                className = "sizeField";
                caption = cellData.data.type === ObjectStorageTreeItemType.File ?
                    formatBytes((cellData.data as IBucketObjectSummary).size || 0, true) : "-";
                break;
            }
            case "modified": {
                className = "modifiedField";
                if (cellData.data.type === ObjectStorageTreeItemType.File && cellData.data.timeModified) {
                    const dateStr = String((cellData.data as IBucketObjectSummary).timeModified);
                    const theDate = new Date(dateStr);
                    caption = theDate.toLocaleString([], {
                        year: "2-digit", month: "2-digit", day: "2-digit",
                        hour: "2-digit", minute: "2-digit", hour12: false,
                    });
                }
                break;
            }

            default:
        }

        onRendered(() => {
            if (className !== undefined) {
                const element = cell.getElement();
                element.classList.add(className);
            }
        });

        return caption;
    };

    private schemasTreeGridColumnFormatter = (cell: CellComponent, formatterParams: {},
        onRendered: EmptyCallback): string | HTMLElement => {
        const schemaName = (cell.getData() as { schemaName: string; }).schemaName;

        onRendered(() => {
            const element = cell.getElement();
            element.classList.add("tableField", "schemaNameField");
        });

        return schemaName;
    };

    private tablesTreeGridRowFormatter = (row: RowComponent): void => {
        const rowData = row.getData() as ILakehouseTable;

        if (!rowData.loaded && rowData.progress === 0) {
            row.getElement().classList.add("notLoaded");
        } else if (!rowData.loaded && rowData.progress > 0) {
            row.getElement().classList.add("loading");
        } else {
            row.getElement().classList.add("loaded");
        }
    };

    private tablesTreeGridColumnFormatter = (cell: CellComponent, formatterParams: {},
        onRendered: EmptyCallback): string | HTMLElement => {
        const cellData = cell.getData() as ILakehouseTable;
        const field = cell.getColumn().getField();

        const host = document.createElement("div");
        host.classList.add("tableField");

        let caption = "";
        let iconSrc = null;
        let iconClassName;
        let statusIconClassName;
        let className: string | undefined;
        switch (field) {
            case "tableName": {
                caption = cellData.tableName;
                iconSrc = schemaTableIcon;
                if (!cellData.loaded && cellData.progress > 0) {
                    statusIconClassName = "itemLoading";
                } else if (!cellData.loaded) {
                    statusIconClassName = "itemNotLoaded";
                } else {
                    statusIconClassName = "itemLoaded";
                }
                break;
            }

            case "loaded": {
                caption = cellData.loaded ? "Yes" :
                    cellData.progress === 0 ? "No" : `${cellData.progress.toFixed(0)}%`;
                if (!cellData.loaded && cellData.progress > 0) {
                    iconSrc = Codicon.Loading;
                    iconClassName = "loading";
                }
                break;
            }

            case "rows": {
                className = "sizeField";
                caption = cellData.rows > 0 ? formatInteger(cellData.rows) : "-";
                break;
            }

            case "dataLength": {
                className = "sizeField";
                caption = cellData.dataLength > 0 ? formatBytes(cellData.dataLength) : "-";
                break;
            }

            case "lastChange": {
                className = "dateField";
                caption = cellData.lastChange;
                break;
            }

            case "comment": {
                className = "commentField";
                caption = cellData.comment;
                break;
            }

            default:
        }

        onRendered(() => {
            const element = cell.getElement();
            if (className !== undefined) {
                element.classList.add(className);
            }
        });


        let content;
        const lbl = <Label caption={caption} />;
        if (iconSrc !== null) {
            content = <>
                {statusIconClassName !== undefined &&
                    <Icon src={Codicon.CircleFilled} className={statusIconClassName} />
                }
                <Icon src={iconSrc} className={iconClassName} />
                {lbl}
                {field === "tableName" && !cellData.loaded && cellData.progress > 0 &&
                    <Container className="progressBar stripesLoader"
                        style={{ backgroundPosition: cellData.progress * -1.5 }} />
                }
            </>;
            render(content, host);

            return host;
        } else {
            return caption;
        }
    };

    private taskTreeGridRowFormatter = (row: RowComponent): void => {
        const rowData = row.getData() as ILakehouseTask | ILakehouseTaskItem;

        if (isTask(rowData)) {
            switch (rowData.status) {
                case "ERROR": {
                    row.getElement().classList.add("error");
                    break;
                }
                default:
            }
        }
    };

    private taskTreeGridColumnFormatter = (cell: CellComponent): string | HTMLElement => {
        const cellData = cell.getData() as ILakehouseTask | ILakehouseTaskItem;
        const col = cell.getColumn();
        const field = col.getField();

        const host = document.createElement("div");
        host.classList.add("itemField");

        let caption = "";
        let iconSrc;
        let hint;
        let iconClassName;
        let statusIconClassName;
        if (isTask(cellData)) {
            switch (field) {
                case "title": {
                    iconSrc = shellTaskIcon;
                    caption = cellData.title ?? "Task";
                    statusIconClassName = cellData.status?.toLowerCase();
                    hint = cellData.description;
                    break;
                }

                case "status": {
                    caption = cellData.status ?? "-";
                    break;
                }

                case "startingTime": {
                    host.classList.add("dateField");
                    caption = cellData.startingTime !== null
                        ? (cellData.startingTime?.slice(undefined, -3) ?? "-") : "-";
                    break;
                }

                case "estimatedCompletionTime": {
                    host.classList.add("dateField");
                    if ((cellData.status === "SCHEDULED" || cellData.status === "RUNNING")
                        && cellData.estimatedCompletionTime === null) {
                        caption = "-";
                    } else if (cellData.status === "RUNNING" && cellData.estimatedCompletionTime !== null) {
                        caption = `~ ${cellData.estimatedCompletionTime?.slice(undefined, -3)}`;
                        if (cellData.estimatedRemainingTime !== undefined
                            && !Number.isNaN(cellData.estimatedRemainingTime)) {
                            let estTimeRemaining = cellData.estimatedRemainingTime ?? -1;
                            let unit = "s";
                            if (estTimeRemaining > 60) {
                                estTimeRemaining /= 60;
                                unit = "m";
                            }
                            if (estTimeRemaining > 60) {
                                estTimeRemaining /= 60;
                                unit = "h";
                            }
                            caption += ` (${estTimeRemaining.toFixed(0)}${unit})`;
                        }
                    } else {
                        caption = cellData.estimatedCompletionTime === null
                            ? cellData.logTime?.slice(undefined, -3) ?? "-"
                            : cellData.estimatedCompletionTime?.slice(undefined, -3) ?? "-";
                    }
                    break;
                }
                case "statusMessage": {
                    caption = cellData.statusMessage ?? "";
                    break;
                }

                default:
            }
        } else {
            switch (field) {
                case "title": {
                    const parent = cell.getRow().getTreeParent();
                    let schemaName = "";
                    if (typeof parent !== "boolean") {
                        schemaName = (parent.getData as ILakehouseTask).schemaName + ".";
                    }
                    caption = `${schemaName}${cellData.tableName ?? "table"}`;
                    iconSrc = schemaTableIcon;
                    break;
                }

                case "status": {
                    caption = cellData.progress !== 100 ? `${cellData.progress ?? "-"}%` : "Done";
                    break;
                }

                case "description": {
                    caption = cellData.uri ?? "";
                    break;
                }

                default:
            }
        }

        let content;
        const lbl = <Label caption={caption} />;
        if (iconSrc !== undefined) {
            content = <>
                {statusIconClassName !== undefined &&
                    <Icon src={Codicon.CircleFilled} className={statusIconClassName} />
                }
                <Icon src={iconSrc} data-tooltip={hint} className={iconClassName} />
                {lbl}
                {field === "title" && isTask(cellData) && cellData.status === "RUNNING"
                    && (cellData.progress ?? 0) > 0 &&
                    <Container className="progressBar stripesLoader"
                        style={{ backgroundPosition: (cellData.progress ?? 0) * -1.5 }} />
                }
            </>;
        } else {
            content = lbl;
        }

        render(content, host);

        return host;
    };

    /**
     * -----------------------------------------------------------------------------------------------------------------
     * TreeGrid Row Expanded/Collapsed
     */

    private objTreeHandleRowExpanded = (row: RowComponent): void => {
        const { expandedObjTreeItems } = this.state;
        const treeItem = row.getData() as IObjectStorageTreeItem;

        treeItem.expanded = true;
        const expandedItems = expandedObjTreeItems ?? [];
        // Persist the expansion state of the item
        if (treeItem.id && !expandedItems.includes(treeItem.id)) {
            expandedItems.push(treeItem.id);
            this.setState({ expandedObjTreeItems: expandedItems });
        }

        // If this is the first time the row gets expanded, load data
        if (!treeItem.expandedOnce && (
            treeItem.data.type === ObjectStorageTreeItemType.Compartment ||
            treeItem.data.type === ObjectStorageTreeItemType.Bucket ||
            treeItem.data.type === ObjectStorageTreeItemType.Prefix)) {
            void this.getObjectStorageTreeChildren(treeItem).then((children) => {
                // Update the tree row
                void row.update({ children, expandedOnce: true });
            }).catch();
        }
    };

    private objTreeHandleRowCollapsed = (row: RowComponent): void => {
        const { expandedObjTreeItems } = this.state;
        const item = row.getData() as IObjectStorageTreeItem;

        item.expanded = false;

        if (expandedObjTreeItems) {
            // Persist the expansion state of the item
            this.setState({
                expandedObjTreeItems: expandedObjTreeItems.filter((id) => {
                    return id === item.id;
                }, false),
            });
        }
    };

    private objTreeIsRowExpanded = (row: RowComponent): boolean => {
        const item = row.getData() as IObjectStorageTreeItem;

        const doExpand = item.expanded || false;

        if (doExpand) {
            this.objTreeHandleRowExpanded(row);
        }

        return doExpand;
    };

    private objTreeToggleSelectedState = (_e: Event, cell: CellComponent): void => {
        const { task, activeSchema, activeTabId, uploadTarget } = this.state;
        const cellData = cell.getData() as IObjectStorageTreeItem;

        if (activeTabId === LakehouseNavigatorTab.Upload) {
            if (uploadTarget === cellData) {
                this.setState({ uploadTarget: undefined, fileUploadTargetPath: undefined });
            } else {
                this.setState({ uploadTarget: cellData, fileUploadTargetPath: undefined });
            }
        } else if (activeTabId === LakehouseNavigatorTab.Load) {
            let theTask = task;

            if (theTask === undefined) {
                theTask = {
                    schemaName: activeSchema,
                    items: [],
                };
            } else if (theTask.items === undefined) {
                theTask.items = [];
            }

            if (cellData.id && cellData.data && theTask.items) {
                if (theTask.items.find((item) => {
                    return item.id === cellData.id;
                })) {
                    theTask.items = theTask.items.filter((item) => {
                        return item.id !== cellData.id;
                    });
                } else {
                    let iconSrc;
                    let caption = cellData.data?.name ?? "Object Storage Item";
                    switch (cellData.data.type) {
                        case ObjectStorageTreeItemType.Bucket: {
                            iconSrc = Codicon.Inbox;
                            break;
                        }

                        case ObjectStorageTreeItemType.Prefix: {
                            const parts = caption.split("/");
                            if (parts[parts.length - 2] === "" && parts[parts.length - 1] === "") {
                                caption = "/";
                            } else {
                                caption = parts[parts.length - 2] ?? caption;
                            }
                            iconSrc = Codicon.Folder;
                            break;
                        }

                        case ObjectStorageTreeItemType.File: {
                            iconSrc = Codicon.File;
                            caption = caption.split("/").pop() || caption;
                            break;
                        }

                        default:
                            iconSrc = Codicon.File;
                    }

                    let uri = "oci://";
                    let namespace = "";
                    switch (cellData.data.type) {
                        case ObjectStorageTreeItemType.Bucket: {
                            uri += cellData.data.name + "/";
                            namespace = cellData.data.namespace;
                            break;
                        }

                        case ObjectStorageTreeItemType.Prefix:
                        case ObjectStorageTreeItemType.File: {
                            uri += cellData.data.bucketName + "/" + cellData.data?.name;
                            let parentItem = cellData.parent;
                            while (parentItem !== undefined
                                && parentItem.data.type !== ObjectStorageTreeItemType.Bucket) {
                                parentItem = parentItem.parent;
                            }
                            namespace = parentItem?.data.type === ObjectStorageTreeItemType.Bucket
                                ? parentItem.data.namespace : "";
                            break;
                        }

                        default:
                    }

                    theTask.items.push({
                        id: cellData.id,
                        caption,
                        uri,
                        namespace,
                        type: cellData.data.type,
                        iconSrc,
                    });
                }
            }

            if (theTask.userModified !== true) {
                theTask.tableName = this.generateVectorTableName(theTask.items ?? []);
            } else if (theTask.userModified && theTask.tableName === "") {
                theTask.userModified = false;
                theTask.tableName = this.generateVectorTableName(theTask.items ?? []);
            }
            this.setState({ task: theTask });
        }
    };

    private generateVectorTableName = (items: ILakehouseTaskItem[]): string => {
        let tableName = "vector_table";
        if (items.length === 0) {
            tableName = "";
        } else if (items.length === 1) {
            let value = items[0].uri;
            if (value.endsWith("/")) {
                value = value.slice(0, -1);
            }
            tableName = value.split("/").pop() ?? "vector_table";
            tableName = tableName.split(".").shift() ?? tableName;
        } else {
            const sortItems = items.sort((a, b) => {
                return a.uri.length - b.uri.length;
            });
            const commonPartPosition = this.findFirstDiffPos(sortItems[0].uri, sortItems[1].uri);
            let commonPart = sortItems[0].uri.slice(0, commonPartPosition);
            if (commonPart.endsWith("/")) {
                commonPart = commonPart.slice(0, -1);
            }
            tableName = commonPart.split("/").pop() ?? "vector_table";
            tableName = tableName.split(".").shift() ?? tableName;
        }

        return tableName;
    };

    private findFirstDiffPos = (a: string, b: string): number => {
        let i = 0;
        while (i < a.length && i < b.length && a[i] === b[i]) {
            i++;
        }

        return i;
    };

    private handleObjTreeDelete = async (_e: Event, cell: CellComponent): Promise<void> => {
        const { backend } = this.props;
        const { activeProfile } = this.state;

        const cellData = cell.getData() as IObjectStorageTreeItem;
        const parentRow = cell.getRow().getTreeParent();

        if (!activeProfile) {
            return;
        }

        try {
            switch (cellData.data.type) {
                case ObjectStorageTreeItemType.Prefix: {
                    // First, delete all files with the given Prefix
                    await backend.mhs.getMdsDeleteBucketObjects(activeProfile.profile, cellData.data.compartmentId,
                        cellData.data.bucketName, cellData.data.name + "*");

                    // Then, delete the prefix itself
                    await backend.mhs.getMdsDeleteBucketObjects(activeProfile.profile, cellData.data.compartmentId,
                        cellData.data.bucketName, cellData.data.name);

                    break;
                }

                case ObjectStorageTreeItemType.File: {
                    if (cellData.parent?.data.type === ObjectStorageTreeItemType.Bucket
                        || cellData.parent?.data.type === ObjectStorageTreeItemType.Prefix
                    ) {
                        await backend.mhs.getMdsDeleteBucketObjects(activeProfile.profile,
                            cellData.parent.data.compartmentId,
                            cellData.data.bucketName, cellData.data.name);
                    }
                    break;
                }

                default:
            }

            if (parentRow) {
                const data = parentRow.getData() as IObjectStorageTreeItem;
                void this.refreshObjTreeItem(data.id);
            }
        } catch (reason) {
            const message = reason instanceof Error ? reason.message : String(reason);
            void requisitions.execute("showError", `Failed to delete object: ${message}`);
        }
    };

    private onTaskPropertyChange = (e: Event) => {
        const { task } = this.state;
        const element = (e.target as HTMLInputElement);
        const classNames = element.className.split(" ");
        const className = classNames[classNames.length - 1];

        switch (className) {
            /*case "taskTitle": {
                if (task !== undefined) {
                    task.title = element.value;
                }
                break;
            }*/

            case "taskDescription": {
                if (task !== undefined) {
                    task.description = element.value;
                }
                break;
            }

            case "taskTableName": {
                if (task !== undefined) {
                    task.tableName = element.value;
                    task.userModified = true;
                }
                break;
            }

            case "taskItemUri": {
                const items = task?.items ?? [];
                const id = parseInt(element.id, 10);
                if (!Number.isNaN(id) && id < items.length) {
                    items[id].uri = element.value;
                }
                break;
            }

            case "taskItemTableName": {
                const items = task?.items ?? [];
                const id = parseInt(element.id, 10);
                if (!Number.isNaN(id) && id < items.length) {
                    items[id].tableName = element.value;
                }
                break;
            }

            default:
        }
    };

    private handleRemoveTaskItem = (_e: MouseEvent | KeyboardEvent, taskItemId: string) => {
        const { task } = this.state;

        if (task !== undefined) {
            this.setState({
                task: {
                    ...task,
                    items: task.items?.filter((item) => {
                        return item.id !== taskItemId;
                    }),
                },
            });
        }
    };

    private onStartLoadingTaskClick = async (): Promise<void> => {
        const { backend, genAiStatus } = this.props;
        const { task } = this.state;

        const languageSupportEnabled = genAiStatus?.languageSupport === true;

        this.setState({ lastTaskScheduleError: undefined });

        if (task !== undefined && task.items !== undefined && task.items.length > 0
            && task.schemaName !== undefined) {
            // Build SQL string and parameter list, start by adding the schemaName
            const params = [task.schemaName];

            // Add the description as 2nd parameter
            if (task.description !== undefined) {
                params.push(task.description);
            } else {
                params.push(this.getDefaultTaskDescription(task));
            }

            let languageSql = "";
            if (languageSupportEnabled) {
                languageSql = "'language', ?, ";
                if (task.languageId !== undefined) {
                    params.push(task.languageId);
                } else {
                    params.push("en");
                }
            }

            // Add optional parameters if defined by user
            let taskNameSql = "";
            if (task.title !== undefined || task.tableName !== undefined) {
                taskNameSql = "'task_name', ?, ";
                if (task.title !== undefined) {
                    params.push(task.title);
                } else {
                    params.push(`Loading ${task.tableName}`);
                }
            }

            let taskTableName = "";
            if (task.tableName !== undefined) {
                taskTableName = "'table_name', ?, ";
                params.push(task.tableName);
            }

            let formatsSql = "";
            if (task.activeFormat !== undefined) {
                formatsSql = "'formats', JSON_ARRAY(?), ";
                params.push(task.activeFormat);
            }

            let urisSql = "";
            task.items.forEach((item) => {
                let itemUri = item.uri;
                // Insert namespace
                const namespacePos = itemUri.split("/", 3).join("/").length;
                itemUri = [
                    itemUri.slice(0, namespacePos),
                    "@" + item.namespace,
                    itemUri.slice(namespacePos)].join("");

                if (item.tableName !== undefined) {
                    urisSql += "JSON_OBJECT('uri', ?, 'table_name', ?), ";
                    params.push(itemUri, item.tableName);
                } else {
                    urisSql += "JSON_OBJECT('uri', ?), ";
                    params.push(itemUri);
                }
            });
            urisSql = urisSql.slice(0, -2);

            try {
                let taskId = "";
                const sql = "CALL sys.vector_store_load(NULL, JSON_OBJECT('schema_name', ?, 'description', ?, " +
                    languageSql + taskNameSql + taskTableName + formatsSql +
                    `'uris', JSON_ARRAY(${urisSql})))`;
                await backend.execute(sql, params, undefined, (data) => {
                    if (data.result.rows !== undefined && data.result.rows.length > 0) {
                        taskId = String((data.result.rows[0] as string[])[0]);
                    }
                });

                StatusBar.setStatusBarMessage(`Task scheduled successfully. Task Id: ${taskId}`);

                await this.autoRefreshTrees();

                // Clear row selection
                this.#tasksTreeRef.current?.deselectRow();
                // Select the newly created task
                this.#tasksTreeRef.current?.selectRow([taskId]);

                this.setState({
                    lastTaskId: taskId,
                    activeTabId: LakehouseNavigatorTab.Manage,
                    task: undefined,
                });
            } catch (e) {
                this.setState({ lastTaskScheduleError: String(e) });
            }
        }
    };

    /**
     * Checks if the current MySQL Account has the required privileges
     *
     * @returns true if the required roles have been activated
     */
    private readonly checkMysqlPrivileges = async (): Promise<boolean> => {
        const { backend } = this.props;

        // Check if the user has access to the mysql_task_management VIEWs
        const res = await backend.execute(`
            SELECT * FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = 'mysql_task_management'
            AND (TABLE_NAME = 'task' OR TABLE_NAME = 'task_log' OR TABLE_NAME = 'task_status')
            AND TABLE_TYPE = 'VIEW';`);
        if (res?.rows?.length !== 3) {
            return false;
        }

        return true;
    };

    /**
     * Refreshes the list of scheduled tasks every 2 seconds if autoRefreshTablesAndTasks is true
     */
    private readonly autoRefreshTrees = async (): Promise<void> => {
        const { backend } = this.props;
        const { activeSchema,
            heatWaveMemoryTotal, heatWaveMemoryUsed,
            autoRefreshTablesAndTasks,
        } = this.state;

        if (!backend.moduleSessionId) {
            return;
        }

        // If timer is currently running, rest it so we can restart it again
        if (this.#scheduledTasksTimer !== null) {
            clearTimeout(this.#scheduledTasksTimer);
        }

        let privilegesEnsured = false;
        try {
            // On first run, ensure the required privileges have been assigned and the task management schema has been
            // made available
            if (this.#firstRun) {
                this.#firstRun = false;

                privilegesEnsured = await this.checkMysqlPrivileges();

                await backend.execute("SELECT mysql_task_management_ensure_schema()");
            }

            // Get the lakehouse status. Pass the current mem values and hashes to only get data back when it changed.
            const res = await backend.mhs.getMdsGetLakehouseStatus(backend.moduleSessionId, activeSchema,
                heatWaveMemoryUsed, heatWaveMemoryTotal, this.#lakehouseTablesHash, this.#lakehouseTasksHash);

            if (res.memoryStatus) {
                this.setState({
                    heatWaveMemoryTotal: res.memoryStatus.memoryTotal,
                    heatWaveMemoryUsed: res.memoryStatus.memoryUsed,
                });
            }

            // Only update the LakehouseTables TreeGrid if there was a change.
            if (res.tableStatus) {
                this.#lakehouseTables = res.tableStatus.tables;
                this.#lakehouseTablesHash = res.tableStatus.hash;

                this.updateLakehouseTablesTreeGrid();
            }

            // Only update the LakehouseTasks TreeGrid if there was a change.
            if (res.taskStatus) {
                // Check if one of the tasks is running and calculate the new remaining times
                this.#lakehouseTaskRunning = false;
                res.taskStatus.tasks.forEach((task) => {
                    if (task.status === "RUNNING") {
                        this.#lakehouseTaskRunning = true;
                    }
                });

                this.#lakehouseTasks = res.taskStatus.tasks;
                this.#lakehouseTasksHash = res.taskStatus.hash;

                this.updateLakehouseTasksTreeGrid();
            }
        } catch (e) {
            let msg = String(e);
            if (privilegesEnsured) {
                msg += ".\nPlease ensure your MySQL user account as the required privileges assigned.";
            }
            this.setState({ lastTaskListError: msg });
        }

        // Start a 10s timer to check if new invitations have been created
        if (autoRefreshTablesAndTasks) {
            this.#scheduledTasksTimer = setTimeout(() => {
                void this.autoRefreshTrees();
            }, 5000);
        }
    };

    private setActiveDatabaseSchema = (schemaName: string): void => {
        const { task, activeSchema } = this.state;

        if (activeSchema !== schemaName) {
            this.#lakehouseTables = undefined;
            this.#lakehouseTablesHash = undefined;

            this.setState({
                activeSchema: schemaName,
                task: {
                    ...task,
                    schemaName,
                },
            }, () => {
                void this.autoRefreshTrees().then(() => {
                    this.forceUpdate();
                });
            });
        }

    };

    private schemaSelected = (row: RowComponent): void => {
        const { activeSchema } = this.state;
        const schemaName = (row.getData() as { schemaName: string; }).schemaName;

        if (schemaName !== activeSchema) {
            this.setActiveDatabaseSchema(schemaName);
        }
    };

    private getDefaultTaskDescription = (task?: ILakehouseTask): string => {
        if (task === undefined || task.items === undefined || task.items.length === 0) {
            return "Data from Object Storage";
        } else {
            const bucketName = task.items[0].uri.slice(6).split("/")[0];

            return `Data from Bucket ${bucketName}`;
        }
    };

    private unloadSelectedTables = async (): Promise<void> => {
        const { backend } = this.props;
        const selectedRows = this.#tablesTreeRef.current?.getSelectedRows();

        if (selectedRows === undefined) {
            return;
        }

        if (!await this.showConfirmDlg("Unload Tables", "Are you sure you want to unload the selected tables?")) {
            return;
        }

        const tables: string[] = [];
        selectedRows.forEach((row) => {
            const table = row.getData() as ILakehouseTable;

            if (table.loaded) {
                tables.push(`\`${table.schemaName}\`.\`${table.tableName}\``);
            }
        });

        if (tables.length > 0) {
            let taskId = "";
            try {
                await backend.execute(`CALL mysql_task_management.create_task(?, ?, NULL)`,
                    [`Unload Lakehouse Table${tables.length > 1 ? "s" : ""}`, "GenAI_Load"], undefined, (data) => {
                        if (data.result.rows !== undefined && data.result.rows.length > 0) {
                            taskId = String((data.result.rows[0] as string[])[0]);
                        }
                    });

                if (taskId !== "") {
                    await backend.execute(
                        `CALL mysql_task_management.add_task_log(?, ?, NULL, ?, ?)`,
                        [taskId, "Task starting.", "0", "RUNNING"]);

                    StatusBar.setStatusBarMessage(
                        `${tables.length} Table${tables.length > 1 ? "s are" : " is"} being unloaded. ` +
                        `Task Id: ${taskId}`);

                    try {
                        for (const table of tables) {
                            await backend.execute(`ALTER TABLE ${table} SECONDARY_UNLOAD`);
                        }

                        await backend.execute(
                            `CALL mysql_task_management.add_task_log(?, ?, NULL, ?, ?)`,
                            [taskId, "Task completed.", "0", "COMPLETED"]);
                    } catch (e) {
                        await backend.execute(
                            `CALL mysql_task_management.add_task_log(?, ?, NULL, ?, ?)`,
                            [taskId, String(e), "0", "ERROR"]);
                    }

                    await this.autoRefreshTrees();

                    // Clear row selection
                    this.#tablesTreeRef.current?.deselectRow();
                    this.#tasksTreeRef.current?.deselectRow();
                    // Select the newly created task
                    this.#tasksTreeRef.current?.selectRow([taskId]);
                } else {
                    throw new Error("Failed to create MySQL task.");
                }
            } catch (e) {
                ui.setStatusBarMessage(`Error while unloading tables: ${String(e)}`);
            }

        } else {
            ui.setStatusBarMessage("Please select tables that have already been loaded.");
        }

        void this.autoRefreshTrees();
    };

    private reloadSelectedTables = async (): Promise<void> => {
        const { backend } = this.props;
        const { activeSchema } = this.state;
        const selectedRows = this.#tablesTreeRef.current?.getSelectedRows();

        if (activeSchema === undefined) {
            return;
        }

        const params = [activeSchema];
        const tables: string[] = [];
        let urisSql = "";
        selectedRows?.forEach((row) => {
            const table = row.getData() as ILakehouseTable;
            if (!table.loaded) {
                tables.push(table.tableName);

                urisSql += "JSON_OBJECT('table_name', ?), ";
                params.push(table.tableName);
            }
        });
        urisSql = urisSql.slice(0, -2);

        if (tables.length > 0) {
            try {
                let taskId = "";
                await backend.execute(
                    `CALL sys.vector_store_load(NULL, JSON_OBJECT('schema_name', ?,
                    'task_name', 'Reload Lakehouse Table${tables.length > 1 ? "s" : ""}',
                    'description', 'Reload of table${tables.length > 1 ? "s" : ""} ${tables.join(", ")}',
                    'uris', JSON_ARRAY(${urisSql})))`,
                    params, undefined, (data) => {
                        if (data.result.rows !== undefined && data.result.rows.length > 0) {
                            taskId = String((data.result.rows[0] as string[])[0]);
                        }
                    });
                StatusBar.setStatusBarMessage(
                    `${tables.length} Table${tables.length > 1 ? "s are" : " is"} being reloaded. ` +
                    `Task Id: ${taskId}`);

                await this.autoRefreshTrees();

                // Clear row selection
                this.#tasksTreeRef.current?.deselectRow();
                this.#tablesTreeRef.current?.deselectRow();
                // Select the newly created task
                this.#tasksTreeRef.current?.selectRow([taskId]);
            } catch (e) {
                StatusBar.setStatusBarMessage(`Error: ${String(e)}`);
            }
        } else {
            StatusBar.setStatusBarMessage("Please select tables that are currently not loaded.");
        }
    };

    private deleteSelectedTables = async (): Promise<void> => {
        const { backend } = this.props;
        const { activeSchema } = this.state;
        const selectedRows = this.#tablesTreeRef.current?.getSelectedRows();

        if (activeSchema === undefined || selectedRows === undefined) {
            return;
        }

        if (!await this.showConfirmDlg("Delete Tables", "Are you sure you want to delete the selected tables?")) {
            return;
        }

        const tables: string[] = [];
        selectedRows.forEach((row) => {
            const table = row.getData() as ILakehouseTable;
            tables.push(`\`${table.schemaName}\`.\`${table.tableName}\``);
        });

        try {
            for (const table of tables) {
                await backend.execute(`DROP TABLE ${table}`);
            }

            // Clear row selection
            this.#tablesTreeRef.current?.deselectRow();

            await this.autoRefreshTrees();
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            void requisitions.execute("showError", `Error: ${message}`);
        }
    };

    private cancelSelectedTasks = async (): Promise<void> => {
        const { backend } = this.props;
        const selectedRows = this.#tasksTreeRef.current?.getSelectedRows();

        // Check if running tasks are selected, exit if not
        if (selectedRows === undefined || selectedRows.length === 0
            || selectedRows.filter((t) => {
                return ((t.getData()) as ILakehouseTask).status === "RUNNING";
            }).length === 0) {
            return;
        }

        if (!await this.showConfirmDlg("Cancel Tasks", "Are you sure you want to cancel the selected tasks?")) {
            return;
        }

        let count = 0;
        selectedRows?.forEach((row) => {
            const task = row.getData() as ILakehouseTask;

            if (task.id !== undefined && task.status === "RUNNING") {
                count++;
                void backend.execute("CALL mysql_task_management.kill_task(?)", [task.id]);
            }
        });

        if (count > 0) {
            StatusBar.setStatusBarMessage(`${count} Task${count > 1 ? "s are" : " is"} being cancelled.`);

            await this.autoRefreshTrees();
        } else {
            StatusBar.setStatusBarMessage("Please select tasks with the status RUNNING.");
        }
    };

    private handleVerticalScroll = (rowIndex: number): void => {
        this.setState({ taskTableTopRowIndex: rowIndex });
    };

    private toggleAutoRefresh = (_e: InputEvent, _checkState: CheckState): void => {
        const { autoRefreshTablesAndTasks } = this.state;

        this.setState({ autoRefreshTablesAndTasks: !autoRefreshTablesAndTasks }, () => {
            // If autoRefreshTablesAndTasks was not turned on before, do an autoRefreshTrees
            if (!autoRefreshTablesAndTasks) {
                void this.autoRefreshTrees();
            } else {
                // If it was turned on before, clear the timer
                if (this.#scheduledTasksTimer !== null) {
                    clearTimeout(this.#scheduledTasksTimer);
                }
            }
        });
    };

    private updateObjStorageTreeGrid = (): void => {
        // If the TreeGrid data is visible and there is data, set it
        if (this.#objTreeRef.current !== null && this.#objTreeItems !== undefined) {
            // Remember selected tables
            const selectedRows: string[] = [];
            this.#objTreeRef.current?.getSelectedRows()?.forEach((row) => {
                const obj = row.getData() as IObjectStorageTreeItem;
                if (obj.id !== undefined) {
                    selectedRows.push(obj.id);
                }
            });

            // Do the actual data replace operation
            void this.#objTreeRef.current.setData(this.#objTreeItems, SetDataAction.Replace).then(() => {
                // Restore selected tables
                if (selectedRows.length > 0) {
                    // Clear row selection
                    this.#objTreeRef.current?.deselectRow();
                    this.#objTreeRef.current?.selectRow(selectedRows);
                }
            });
        }
    };

    private updateLakehouseTablesTreeGrid = (): void => {
        // If the TreeGrid data is visible and there is data, set it
        if (this.#tablesTreeRef.current !== null && this.#lakehouseTables !== undefined) {
            // Remember selected tables
            const selectedTables: string[] = [];
            this.#tablesTreeRef.current?.getSelectedRows()?.forEach((row) => {
                const table = row.getData() as ILakehouseTable;
                selectedTables.push(`${table.schemaName}.${table.tableName}`);
            });

            // Do the actual data replace operation
            void this.#tablesTreeRef.current?.setData(this.#lakehouseTables, SetDataAction.Replace).then(() => {
                // Restore selected tables
                if (selectedTables.length > 0) {
                    // Clear row selection
                    this.#tablesTreeRef.current?.deselectRow();
                    this.#tablesTreeRef.current?.selectRow(selectedTables);
                }
            });
        }
    };

    private updateLakehouseTasksTreeGrid = (): void => {
        // If the TreeGrid data is visible and there is data, set it
        if (this.#tasksTreeRef.current !== null && this.#lakehouseTasks !== undefined) {
            // Remember selected tables
            const selectedTasks: string[] = [];
            this.#tasksTreeRef.current?.getSelectedRows()?.forEach((row) => {
                const task: ILakehouseTask = row.getData();
                if (task.id !== undefined) {
                    selectedTasks.push(task.id);
                }
            });

            // Do the actual data replace operation
            void this.#tasksTreeRef.current.setData(this.#lakehouseTasks, SetDataAction.Replace).then(() => {

                // Restore selected tables
                if (selectedTasks.length > 0) {
                    // Clear row selection
                    this.#tasksTreeRef.current?.deselectRow();
                    this.#tasksTreeRef.current?.selectRow(selectedTasks);
                }
            });
        }
    };

    private onStartFileUploadClick = async (): Promise<void> => {
        const { backend } = this.props;
        const { activeProfile, filesForUpload, uploadTarget, fileUploadTargetPath } = this.state;

        if (activeProfile !== undefined && filesForUpload !== undefined && uploadTarget !== undefined) {
            const nodeData = uploadTarget.data;
            let compartmentId;
            let bucketName;
            let prefix;

            switch (nodeData.type) {
                case ObjectStorageTreeItemType.Bucket: {
                    compartmentId = nodeData.compartmentId;
                    bucketName = nodeData.name;
                    prefix = "";
                    break;
                }

                case ObjectStorageTreeItemType.Prefix: {
                    compartmentId = nodeData.compartmentId;
                    bucketName = nodeData.bucketName;
                    prefix = nodeData.name;
                    break;
                }

                default:
            }

            // Reset filesForUpload
            for (const file of filesForUpload) {
                file.bytesUploadedTotal = 0;
                file.error = undefined;
                file.uploadComplete = false;
            }

            if (prefix !== undefined && bucketName !== undefined && compartmentId !== undefined) {
                if (fileUploadTargetPath !== undefined) {
                    prefix += fileUploadTargetPath;
                }

                // Start upload
                this.setState({ uploadRunning: true, uploadComplete: false });
                try {
                    let error = 0;
                    void await backend.mhs.createMdsBucketObjects(
                        activeProfile.profile,
                        filesForUpload.map((file) => { return file.filePath; }),
                        prefix,
                        bucketName,
                        compartmentId,
                        true,
                        (data) => {
                            const res = data.result.data;
                            if (res.filePath !== undefined) {
                                const fileUploadItem = filesForUpload.find((file) => {
                                    return file.filePath === res.filePath;
                                });
                                if (fileUploadItem !== undefined) {
                                    if (res.totalFileSize !== undefined && res.bytesUploaded !== undefined) {
                                        fileUploadItem.fileSize = res.totalFileSize;
                                        fileUploadItem.bytesUploadedTotal =
                                            (fileUploadItem.bytesUploadedTotal ?? 0) + res.bytesUploaded;

                                        if (fileUploadItem.bytesUploadedTotal >= fileUploadItem.fileSize) {
                                            fileUploadItem.uploadComplete = true;
                                            fileUploadItem.bytesUploadedTotal = fileUploadItem.fileSize;
                                        }
                                    } else {
                                        fileUploadItem.error = res.error;
                                        error += 1;
                                    }

                                    // Ensure update
                                    this.forceUpdate();
                                }
                            }
                        },
                    );

                    if (error === 0) {
                        void requisitions.execute("showInfo", "The files have been uploaded successfully.");
                    } else {
                        const message = `${error} error${error > 1 ? "s" : ""} occurred during upload. ` +
                            "Please check the file list.";
                        void requisitions.execute("showError", message);
                    }
                } finally {
                    this.setState({ uploadRunning: false, uploadComplete: true });

                    void this.refreshObjTreeItem(uploadTarget.id);

                    /*if (this.#objTreeRef.current) {
                        const row = this.findObjTreeRowById(uploadTarget.id);

                        if (row) {
                            const children = await this.getObjectStorageTreeChildren(uploadTarget);
                            void row.update({ children });
                        }
                    }*/
                }
            }
        }
    };

    private refreshObjTreeItem = async (targetId: string): Promise<void> => {
        const findObjTreeItemById = (items: IObjectStorageTreeItem[] | undefined,
            targetId: string): IObjectStorageTreeItem | undefined => {
            if (!items) {
                return;
            }

            for (const item of items) {
                if (item.id === targetId) {
                    return item;
                }
                const itemFound = findObjTreeItemById(item.children, targetId);
                if (itemFound) {
                    return itemFound;
                }
            }
        };

        const item = findObjTreeItemById(this.#objTreeItems, targetId);
        if (item) {
            const children = await this.getObjectStorageTreeChildren(item);
            item.children = children;
        }

        this.updateObjStorageTreeGrid();
    };

    private findObjTreeRowById = (targetId: string): RowComponent | undefined => {
        const findObjTreeRow = (rows: RowComponent[], targetId: string): RowComponent | undefined => {
            for (const row of rows) {
                const data = row.getData() as IObjectStorageTreeItem;

                if (data.id === targetId) {
                    return row;
                }

                const children = row.getTreeChildren();

                const foundRow = findObjTreeRow(children, targetId);
                if (foundRow) {
                    return foundRow;
                }
            }
        };

        if (this.#objTreeRef.current) {
            return findObjTreeRow(this.#objTreeRef.current.getRows(), targetId);
        }
    };

    private handleRemoveFileForUploadItem = (_e: MouseEvent | KeyboardEvent, name: string) => {
        const { filesForUpload } = this.state;

        this.setState({
            filesForUpload: filesForUpload?.filter((file) => {
                return file.filePath !== name;
            }),
        });
    };

    private handleAddFilesForUpload = (_e: MouseEvent | KeyboardEvent) => {
        const { formats, filesForUpload } = this.state;

        if (appParameters.embedded) {
            const options = {
                id: "lakehouseFileUpload",
                title: "Add files for upload",
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: true,
                /*filters: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    PDF: ["pdf", "PDF"], HTML: ["html", "HTML"], DOC: ["doc", "docx", "DOC", "DOCX"],
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    PPT: ["ppt", "pptx", "PPT", "PPTX"], TXT: ["txt", "TXT", "md", "MD"],
                },*/
                openLabel: "Add",
            };
            requisitions.executeRemote("showOpenDialog", options);
        } else {
            const contentType: string[] = [];
            if (formats) {
                formats.forEach((format) => {
                    contentType.push(`.${format.id}`);
                });
            }

            void selectFile(contentType, true).then((result) => {
                if (result) {
                    const newFilesForUpload = filesForUpload ?? [];
                    result.forEach((file) => {
                        newFilesForUpload.push(
                            {
                                filePath: "~/Downloads/" + file.name,
                                uploadComplete: false,
                            });
                    });

                    if (newFilesForUpload.length > 0) {
                        this.setState({ filesForUpload: newFilesForUpload });
                    }
                }
            });
        }
    };

    private selectFile = (openFileResult: IOpenFileDialogResult): Promise<boolean> => {
        const { filesForUpload } = this.state;

        if (openFileResult.resourceId !== "lakehouseFileUpload") {
            return Promise.resolve(false);
        }

        // Only called in single user mode, from a native wrapper or VS Code.
        const newFilesForUpload = filesForUpload ?? [];
        openFileResult.path.forEach((value) => {
            newFilesForUpload.push({
                filePath: decodeURI(value.startsWith("file://") ? value.substring("file://".length) : value),
                uploadComplete: false,
            });
        });

        if (newFilesForUpload.length > 0) {
            this.setState({ filesForUpload: newFilesForUpload });
        }

        return Promise.resolve(true);
    };

    private handlePaneResize = (info: ISplitterPaneSizeInfo[]): void => {
        info.forEach((value) => {
            if (value.id === "newLoadTask") {
                this.setState({ newTaskPanelWidth: value.currentSize });
            } else if (value.id === "filesForUpload") {
                this.setState({ filesForUploadPanelWidth: value.currentSize });
            } else if (value.id === "taskListPanel") {
                this.setState({ taskListPanelHeight: value.currentSize });
            }
        });
    };

    private handleEnsureUserPrivileges = async (): Promise<void> => {
        const { backend } = this.props;

        // Prompt the user for a username and an optional host
        const response = await DialogHost.showDialog({
            id: "lakehouseNavigatorDlg",
            type: DialogType.Prompt,
            title: "Ensure MySQL User Privileges",
            values: {
                prompt: "Please enter the name of the user, add @host if needed (e.g. user@localhost):",
            },
            description: ["A specific set of privileges is required to use HeatWave Chat and HeatWave Load.",
                "These will be assigned to the given user."],
        });

        if (response.values?.input) {
            const val = response.values.input as string;
            if (val === "") {
                return;
            }

            let userName: string;
            let hostName = "%";
            if (val.startsWith("`")) {
                if (val.includes("`@`")) {
                    userName = val.slice(1, val.indexOf("`@`"));
                    hostName = val.slice(val.indexOf("`@`") + 3, -1);
                } else if (val.includes("`@")) {
                    userName = val.slice(1, val.indexOf("`@"));
                    hostName = val.slice(val.indexOf("`@") + 2);
                } else {
                    userName = val.slice(1, -1);
                }
            } else if (val.includes("@")) {
                userName = val.slice(0, val.indexOf("@"));
                hostName = val.slice(val.indexOf("@") + 1);
            } else {
                userName = val;
            }

            try {
                await backend.execute(
                    `CALL sys.genai_ensure_privileges(?, ?)`,
                    [userName, hostName], undefined, (data) => {
                        if (data.result.rows !== undefined && data.result.rows.length === 0) {
                            void requisitions.execute("showInfo", `The required privileges where assigned to the ` +
                                `MySQL user ${userName}@${hostName}`);
                        }
                    });
            } catch (reason) {
                const message = reason instanceof Error ? reason.message : String(reason);
                void requisitions.execute("showError", `Failed to assign the required privileges: ${message}`);
            }
        }
    };

    private showConfirmDlg = async (title: string, prompt: string): Promise<boolean> => {
        const response = await DialogHost.showDialog({
            id: "commitOrCancelChanges",
            type: DialogType.Confirm,
            parameters: {
                title,
                prompt,
                accept: "Yes",
                refuse: "No",
                default: "Yes",
            },
        });

        return response.closure === DialogResponseClosure.Accept;
    };

    private onAddSchemaBtnClick = async (): Promise<void> => {
        const { backend } = this.props;

        // Prompt the user for a username and an optional host
        const response = await DialogHost.showDialog({
            id: "lakehouseNavigatorDlg",
            type: DialogType.Prompt,
            title: "Add MySQL Database Schema",
            values: {
                prompt: "Please enter the name of the new MySQL Database Schema:",
            },
            description: ["A new MySQL database schema will be created."],
        });

        if (response.values?.input) {
            const val = response.values.input as string;
            if (val === "") {
                return;
            }

            try {
                void await backend.execute(`CREATE SCHEMA ${escapeSqlString(val)} `);

                this.refreshAvailableDatabaseSchemas();

                this.setState({ activeSchema: val });
            } catch (error) {
                let errStr = String(error);
                if (errStr.includes("run_sql: ")) {
                    errStr = errStr.slice(errStr.indexOf("run_sql: ") + 9);
                }
                void requisitions.execute("showError", `Failed to create the database schema: ${errStr}`);
            }
        }
    };
}
