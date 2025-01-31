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

import mysqlConnectionIcon from "../assets/images/connectionMysql.svg";
import sqliteConnectionIcon from "../assets/images/connectionSqlite.svg";

import schemaIcon from "../assets/images/schema.svg";
import mysqlSchemaIcon from "../assets/images/schemaMySQL.svg";
import sqliteSchemaIcon from "../assets/images/schemaSqlite.svg";
import schemaCurrentIcon from "../assets/images/schemaCurrent.svg";
import mysqlSchemaCurrentIcon from "../assets/images/schemaMySQLCurrent.svg";
import sqliteSchemaCurrentIcon from "../assets/images/schemaSqliteCurrent.svg";

import tableIcon from "../assets/images/schemaTable.svg";
import tablesIcon from "../assets/images/schemaTables.svg";

import columnIconNullable from "../assets/images/schemaTableColumn.svg";
import columnIconNotNull from "../assets/images/schemaTableColumnNN.svg";
import columnIconPK from "../assets/images/schemaTableColumnPK.svg";
import columnsIcon from "../assets/images/schemaTableColumns.svg";

import procedureIcon from "../assets/images/schemaProcedure.svg";
import proceduresIcon from "../assets/images/schemaProcedures.svg";
import functionIcon from "../assets/images/schemaFunction.svg";
import functionsIcon from "../assets/images/schemaFunctions.svg";
import procedureJsIcon from "../assets/images/schemaProcedureJs.svg";
import functionJsIcon from "../assets/images/schemaFunctionJs.svg";

import eventIcon from "../assets/images/schemaEvent.svg";
import eventsIcon from "../assets/images/schemaEvents.svg";

import triggerIcon from "../assets/images/schemaTableTrigger.svg";
import triggersIcon from "../assets/images/schemaTableTriggers.svg";

import viewIcon from "../assets/images/schemaView.svg";
import viewsIcon from "../assets/images/schemaViews.svg";

import indexIcon from "../assets/images/schemaTableIndex.svg";
import indexesIcon from "../assets/images/schemaTableIndexes.svg";

import foreignKeyIcon from "../assets/images/schemaTableForeignKey.svg";
import foreignKeysIcon from "../assets/images/schemaTableForeignKeys.svg";

import runNotebookIcon from "../assets/images/runNotebook.svg";
import runScriptIcon from "../assets/images/runScript.svg";

import schemaTableForeignKey11Icon from "../assets/images/schemaTableForeignKey11.svg";
import schemaTableForeignKey11TopToRightIcon from "../assets/images/schemaTableForeignKey11TopToRight.svg";
import schemaTableForeignKey1NIcon from "../assets/images/schemaTableForeignKey1N.svg";
import schemaTableForeignKey1NTopToRightIcon from "../assets/images/schemaTableForeignKey1NTopToRight.svg";
import schemaTableForeignKeyN1Icon from "../assets/images/schemaTableForeignKeyN1.svg";
import schemaTableForeignKeyN1TopToRightIcon from "../assets/images/schemaTableForeignKeyN1TopToRight.svg";
import schemasIcon from "../assets/images/schemas.svg";
import databaseIcon from "../assets/images/database.svg";
import databaseEngineIcon from "../assets/images/databaseEngine.svg";
import vectorDbIcon from "../assets/images/vectorDb.svg";

import overviewPageIcon from "../assets/images/overviewPage.svg";
import sessionIcon from "../assets/images/terminal.svg";
import adminDashboardIcon from "../assets/images/admin/adminDashboard.svg";
import adminPerformanceDashboardIcon from "../assets/images/admin/adminPerformanceDashboard.svg";
import adminServerStatusIcon from "../assets/images/admin/adminServerStatus.svg";
import clientConnectionsIcon from "../assets/images/admin/clientConnections.svg";
import lakehouseNavigatorIcon from "../assets/images/lakehouseNavigator.svg";
import notebookIcon from "../assets/images/notebook.svg";

import docsIcon from "../assets/images/docs.svg";

import mrsIcon from "../assets/images/mrs/mrs.svg";
import mrsDbObjectIcon from "../assets/images/mrs/mrsDbObject.svg";
import mrsDbObjectFunctionIcon from "../assets/images/mrs/mrsDbObjectFunction.svg";
import mrsDbObjectProcedureIcon from "../assets/images/mrs/mrsDbObjectProcedure.svg";
import mrsDbObjectTableIcon from "../assets/images/mrs/mrsDbObjectTable.svg";
import mrsDbObjectViewIcon from "../assets/images/mrs/mrsDbObjectView.svg";
import mrsContentFileIcon from "../assets/images/mrs/mrsContentFile.svg";
import mrsContentSetIcon from "../assets/images/mrs/mrsContentSet.svg";
import mrsSchemaIcon from "../assets/images/mrs/mrsSchema.svg";
import mrsServiceIcon from "../assets/images/mrs/mrsService.svg";
import mrsServiceDefaultIcon from "../assets/images/mrs/mrsServiceDefault.svg";

import mrsAuthAppIcon from "../assets/images/mrs/mrsAuthApp.svg";
import mrsAuthAppsIcon from "../assets/images/mrs/mrsAuthApps.svg";

import ociBastionIcon from "../assets/images/oci/ociBastion.svg";
import ociBastionCurrentIcon from "../assets/images/oci/ociBastionCurrent.svg";
import ociComputeIcon from "../assets/images/oci/ociCompute.svg";
import ociComputeCurrentIcon from "../assets/images/oci/ociComputeCurrent.svg";
import ociDbSystemIcon from "../assets/images/oci/ociDbSystem.svg";
import ociDbSystemHWIcon from "../assets/images/oci/ociDbSystemHW.svg";
import ociLoadBalancerIcon from "../assets/images/oci/ociLoadBalancer.svg";
import ociProfileIcon from "../assets/images/oci/ociProfile.svg";
import ociProfileCurrentIcon from "../assets/images/oci/ociProfileCurrent.svg";

import routerIcon from "../assets/images/router/router.svg";
import routersIcon from "../assets/images/router/routers.svg";

import defaultIcon from "../assets/images/file-icons/default.svg";
import javascriptIcon from "../assets/images/file-icons/scriptJs.svg";
import mysqlIcon from "../assets/images/file-icons/scriptMysql.svg";
import pythonIcon from "../assets/images/file-icons/scriptPy.svg";
import sqliteIcon from "../assets/images/file-icons/scriptSqlite.svg";
import typescriptIcon from "../assets/images/file-icons/scriptTs.svg";
import folderIcon from "../assets/images/folder.svg";
import folderCurrentIcon from "../assets/images/folderCurrent.svg";

import closeIcon from "../assets/images/close.svg";
import closeIcon2 from "../assets/images/close2.svg";

import newNotebookIcon from "../assets/images/newNotebook.svg";
import newScriptIcon from "../assets/images/newScript.svg";
import scriptIcon from "../assets/images/script.svg";
import scriptingIcon from "../assets/images/scripting.svg";

// Toolbars.
import autoCommitActiveIcon from "../assets/images/toolbar/toolbar-auto_commit-active.svg";
import autoCommitInactiveIcon from "../assets/images/toolbar/toolbar-auto_commit-inactive.svg";
import backgroundThreadsActiveIcon from "../assets/images/toolbar/toolbar-background-threads-active.svg";
import backgroundThreadsInactiveIcon from "../assets/images/toolbar/toolbar-background-threads-inactive.svg";
import closeIcon3 from "../assets/images/toolbar/toolbar-close.svg";
import commitIcon from "../assets/images/toolbar/toolbar-commit.svg";
import editIcon2 from "../assets/images/toolbar/toolbar-edit.svg";
import executeIcon from "../assets/images/toolbar/toolbar-execute.svg";
import executeAndNewCmdIcon from "../assets/images/toolbar/toolbar-execute_and_new_cmd.svg";
import executeCaretIcon from "../assets/images/toolbar/toolbar-execute_caret.svg";
import executeCaretHeatwaveIcon from "../assets/images/toolbar/toolbar-execute_caret_heatwave.svg";
import executeExplainIcon from "../assets/images/toolbar/toolbar-execute_explain.svg";
import executeHeatwaveIcon from "../assets/images/toolbar/toolbar-execute_heatwave.svg";
import executePrintTextIcon from "../assets/images/toolbar/toolbar-execute_print_text.svg";
import expandIcon from "../assets/images/toolbar/toolbar-expand.svg";
import exportIcon from "../assets/images/export.svg";
import formatIcon from "../assets/images/toolbar/toolbar-format.svg";
import formatCaretIcon from "../assets/images/toolbar/toolbar-format_caret.svg";
import gridIcon from "../assets/images/toolbar/toolbar-grid.svg";
import importIcon from "../assets/images/import.svg";
import infoActiveIcon from "../assets/images/toolbar/toolbar-info-active.svg";
import infoInactiveIcon from "../assets/images/toolbar/toolbar-info-inactive.svg";
import killConnectionIcon from "../assets/images/toolbar/toolbar-kill_connection.svg";
import killQueryIcon from "../assets/images/toolbar/toolbar-kill_query.svg";
import loadEditorIcon from "../assets/images/toolbar/toolbar-load-editor.svg";
import loadIcon from "../assets/images/toolbar/toolbar-load.svg";
import loadScriptIcon from "../assets/images/toolbar/toolbar-load-script.svg";
import maximizeIcon from "../assets/images/toolbar/toolbar-maximize.svg";
import menuIcon from "../assets/images/toolbar/toolbar-menu.svg";
import newFileSelectorIcon from "../assets/images/toolbar/toolbar-new-file-selector.svg";
import newFileIcon from "../assets/images/toolbar/toolbar-new-file.svg";
import newShellConsoleIcon from "../assets/images/toolbar/toolbar-new-shell-console.svg";
import normalizeIcon from "../assets/images/toolbar/toolbar-normalize.svg";
import pageNextIcon from "../assets/images/toolbar/toolbar-page_next.svg";
import pagePreviousIcon from "../assets/images/toolbar/toolbar-page_previous.svg";
import previewIcon from "../assets/images/toolbar/toolbar-preview.svg";
import refreshIcon2 from "../assets/images/toolbar/toolbar-refresh.svg";
import rollbackIcon from "../assets/images/toolbar/toolbar-rollback.svg";
import saveEditorIcon from "../assets/images/toolbar/toolbar-save-editor.svg";
import saveIcon from "../assets/images/toolbar/toolbar-save.svg";
import saveScriptIcon from "../assets/images/toolbar/toolbar-save-script.svg";
import searchIcon from "../assets/images/toolbar/toolbar-search.svg";
import showDetailsActiveIcon from "../assets/images/toolbar/toolbar-show-details-active.svg";
import showDetailsInactiveIcon from "../assets/images/toolbar/toolbar-show-details-inactive.svg";
import showCtrlCarsActiveIcon from "../assets/images/toolbar/toolbar-show_ctrl_cars-active.svg";
import showCtrlCharsInactiveIcon from "../assets/images/toolbar/toolbar-show_ctrl_chars-inactive.svg";
import showHiddenActiveIcon from "../assets/images/toolbar/toolbar-show_hidden-active.svg";
import showHiddenInactiveIcon from "../assets/images/toolbar/toolbar-show_hidden-inactive.svg";
import sleepingConnsActiveIcon from "../assets/images/toolbar/toolbar-sleeping_conns-active.svg";
import sleepingConnsInactiveIcon from "../assets/images/toolbar/toolbar-sleeping_conns-inactive.svg";
import sqlPreviewActiveIcon from "../assets/images/toolbar/toolbar-sql_preview-active.svg";
import sqlPreviewInactiveIcon from "../assets/images/toolbar/toolbar-sql_preview-inactive.svg";
import sqlPreviewIcon from "../assets/images/toolbar/toolbar-sql_preview.svg";
import stopExecutionIcon from "../assets/images/toolbar/toolbar-stop_execution.svg";
import stopOnErrorActiveIcon from "../assets/images/toolbar/toolbar-stop_on_error-active.svg";
import stopOnErrorInactiveIcon from "../assets/images/toolbar/toolbar-stop_on_error-inactive.svg";
import wordWrapActiveIcon from "../assets/images/toolbar/toolbar-word_wrap-active.svg";
import wordWrapInactiveIcon from "../assets/images/toolbar/toolbar-word_wrap-inactive.svg";

// Overlays.
import overlayDisabled from "../assets/images/overlays/disabled.svg";
import overlayDisabledMask from "../assets/images/overlays/disabledMask.svg";
import overlayError from "../assets/images/overlays/error.svg";
import overlayErrorMask from "../assets/images/overlays/errorMask.svg";
import overlayInDevelopment from "../assets/images/overlays/inDevelopment.svg";
import overlayInDevelopmentMask from "../assets/images/overlays/inDevelopmentMask.svg";
import overlayLink from "../assets/images/overlays/link.svg";
import overlayLinkMask from "../assets/images/overlays/linkMask.svg";
import overlayLive from "../assets/images/overlays/live.svg";
import overlayLiveMask from "../assets/images/overlays/liveMask.svg";
import overlayLock from "../assets/images/overlays/lock.svg";
import overlayLockMask from "../assets/images/overlays/lockMask.svg";
import overlayPrivate from "../assets/images/overlays/private.svg";

import overlayStatusDotRed from "../assets/images/overlays/statusDotRed.svg";
import overlayStatusDotGreen from "../assets/images/overlays/statusDotGreen.svg";
import overlayStatusDotOrange from "../assets/images/overlays/statusDotOrange.svg";
import overlayStatusDotBlue from "../assets/images/overlays/statusDotBlue.svg";
import overlayStatusDotMask from "../assets/images/overlays/statusDotMask.svg";

// Lakehouse.
import chatOptionsIcon from "../assets/images/chatOptions.svg";
import dataLakeIcon from "../assets/images/dataLake.svg";
import lakehouseHouseIcon from "../assets/images/lakehouseHouse.svg";
import lakehouseNavigatorLakeHouseIcon from "../assets/images/lakehouseNavigatorLakeHouse.svg";
import lakehouseNavigatorObjectStorageIcon from "../assets/images/lakehouseNavigatorObjectStorage.svg";
import lakehouseNavigatorOnPremiseIcon from "../assets/images/lakehouseNavigatorOnPremise.svg";
import workflowSeparatorIcon from "../assets/images/workflowSeparator.svg";
import workflowTopLineIcon from "../assets/images/workflowTopLine.png";

import addIcon from "../assets/images/add.svg";
import allowSortingIcon from "../assets/images/allowSorting.svg";
import arrowIcon from "../assets/images/arrow.svg";
import checkAllIcon from "../assets/images/checkAll.svg";
import checkNoneIcon from "../assets/images/checkNone.svg";
import chevronIcon from "../assets/images/chevron-right.svg";
import cloneIcon from "../assets/images/clone.svg";
import connectedIcon from "../assets/images/connected.svg";
import debuggerIcon from "../assets/images/debugger.svg";
import disconnectedIcon from "../assets/images/disconnected.svg";
import editIcon from "../assets/images/edit.svg";
import editorIconSideLineStraightIcon from "../assets/images/editor-side-line-straight.svg";
import editorSideLineIcon from "../assets/images/editor-side-line.svg";
import ensurePrivilegesIcon from "../assets/images/ensurePrivileges.svg";
import inIcon from "../assets/images/in.svg";
import inOutIcon from "../assets/images/inOut.svg";
import noIcon from "../assets/images/no-preview.svg";
import noCheckIcon from "../assets/images/noCheck.svg";
import noFilterIcon from "../assets/images/noFilter.svg";
import noUpdateIcon from "../assets/images/noUpdate.svg";
import outIcon from "../assets/images/out.svg";
import parametersIcon from "../assets/images/parameters.svg";
import passwordIcon from "../assets/images/password.svg";
import plusIcon from "../assets/images/plus.svg";
import refreshIcon from "../assets/images/refresh.svg";
import removeIcon from "../assets/images/remove.svg";
import rowOwnershipIcon from "../assets/images/rowOwnership.svg";
import settingsIcon from "../assets/images/settings.svg";
import shellTaskIcon from "../assets/images/shellTask.svg";
import squiggleIcon from "../assets/images/squiggle.svg";
import unnestIcon from "../assets/images/unnest.svg";

/** A module which imports application assets and provides access to them application-wide. */
export class Assets {
    public static db = {
        mysqlConnectionIcon,
        sqliteConnectionIcon,
        schemaIcon,
        schemaCurrentIcon,
        mysqlSchemaIcon,
        mysqlSchemaCurrentIcon,
        sqliteSchemaIcon,
        sqliteSchemaCurrentIcon,
        tableIcon,
        tablesIcon,
        columnIconNullable,
        columnIconNotNull,
        columnIconPK,
        columnsIcon,
        procedureIcon,
        proceduresIcon,
        functionIcon,
        functionsIcon,
        procedureJsIcon,
        functionJsIcon,
        eventIcon,
        eventsIcon,
        triggerIcon,
        triggersIcon,
        viewIcon,
        viewsIcon,
        indexIcon,
        indexesIcon,
        foreignKeyIcon,
        foreignKeysIcon,
        schemaTableForeignKey11Icon,
        schemaTableForeignKey11TopToRightIcon,
        schemaTableForeignKey1NIcon,
        schemaTableForeignKey1NTopToRightIcon,
        schemaTableForeignKeyN1Icon,
        schemaTableForeignKeyN1TopToRightIcon,
        schemasIcon,
        databaseIcon,
        databaseEngineIcon,
        vectorDbIcon,
        runNotebookIcon,
        runScriptIcon,
    };

    public static documents = {
        overviewPageIcon,
        sessionIcon,
        adminDashboardIcon,
        adminPerformanceDashboardIcon,
        adminServerStatusIcon,
        clientConnectionsIcon,
        notebookIcon,
        lakehouseNavigatorIcon,
    };

    public static mrs = {
        mainIcon: mrsIcon,
        schemaIcon: mrsSchemaIcon,
        contentFileIcon: mrsContentFileIcon,
        contentSetIcon: mrsContentSetIcon,
        dbObjectIcon: mrsDbObjectIcon,
        dbObjectFunctionIcon: mrsDbObjectFunctionIcon,
        dbObjectProcedureIcon: mrsDbObjectProcedureIcon,
        dbObjectTableIcon: mrsDbObjectTableIcon,
        dbObjectViewIcon: mrsDbObjectViewIcon,
        serviceIcon: mrsServiceIcon,
        serviceDefaultIcon: mrsServiceDefaultIcon,
        authAppIcon: mrsAuthAppIcon,
        authAppsIcon: mrsAuthAppsIcon,
    };

    public static oci = {
        bastionIcon: ociBastionIcon,
        bastionCurrentIcon: ociBastionCurrentIcon,
        computeIcon: ociComputeIcon,
        computeCurrentIcon: ociComputeCurrentIcon,
        dbSystemIcon: ociDbSystemIcon,
        dbSystemHWIcon: ociDbSystemHWIcon,
        loadBalancerIcon: ociLoadBalancerIcon,
        profileIcon: ociProfileIcon,
        profileCurrentIcon: ociProfileCurrentIcon,
    };

    public static file = {
        defaultIcon,
        javascriptIcon,
        mysqlIcon,
        pythonIcon,
        sqliteIcon,
        typescriptIcon,
        folderIcon,
        folderCurrentIcon,
    };

    public static router = {
        routerIcon,
        routersIcon,
    };

    public static misc = {
        docsIcon,
        closeIcon,
        closeIcon2,
        newNotebookIcon,
        newScriptIcon,
        scriptIcon,
        scriptingIcon,

        addIcon,
        allowSortingIcon,
        arrowIcon,
        checkAllIcon,
        checkNoneIcon,
        chevronIcon,
        cloneIcon,
        connectedIcon,
        debuggerIcon,
        disconnectedIcon,
        editIcon,
        editorIconSideLineStraightIcon,
        editorSideLineIcon,
        ensurePrivilegesIcon,
        inIcon,
        inOutIcon,
        noIcon,
        noCheckIcon,
        noFilterIcon,
        noUpdateIcon,
        outIcon,
        parametersIcon,
        passwordIcon,
        plusIcon,
        refreshIcon,
        removeIcon,
        rowOwnershipIcon,
        settingsIcon,
        shellTaskIcon,
        squiggleIcon,
        unnestIcon,
    };

    public static overlay = {
        disabled: overlayDisabled,
        disabledMask: overlayDisabledMask,
        error: overlayError,
        errorMask: overlayErrorMask,
        inDevelopment: overlayInDevelopment,
        inDevelopmentMask: overlayInDevelopmentMask,
        link: overlayLink,
        linkMask: overlayLinkMask,
        live: overlayLive,
        liveMask: overlayLiveMask,
        lock: overlayLock,
        lockMask: overlayLockMask,
        private: overlayPrivate,
        statusDotBlue: overlayStatusDotBlue,
        statusDotGreen: overlayStatusDotGreen,
        statusDotMask: overlayStatusDotMask,
        statusDotOrange: overlayStatusDotOrange,
        statusDotRed: overlayStatusDotRed,
    };

    public static toolbar = {
        autoCommitActiveIcon,
        autoCommitInactiveIcon,
        backgroundThreadsActiveIcon,
        backgroundThreadsInactiveIcon,
        closeIcon3,
        commitIcon,
        editIcon2,
        executeIcon,
        executeAndNewCmdIcon,
        executeCaretIcon,
        executeCaretHeatwaveIcon,
        executeExplainIcon,
        executeHeatwaveIcon,
        executePrintTextIcon,
        expandIcon,
        exportIcon,
        formatIcon,
        formatCaretIcon,
        gridIcon,
        importIcon,
        infoActiveIcon,
        infoInactiveIcon,
        killConnectionIcon,
        killQueryIcon,
        loadEditorIcon,
        loadIcon,
        loadScriptIcon,
        maximizeIcon,
        menuIcon,
        newFileSelectorIcon,
        newFileIcon,
        newShellConsoleIcon,
        normalizeIcon,
        pageNextIcon,
        pagePreviousIcon,
        previewIcon,
        refreshIcon2,
        rollbackIcon,
        saveEditorIcon,
        saveIcon,
        saveScriptIcon,
        searchIcon,
        showDetailsActiveIcon,
        showDetailsInactiveIcon,
        showCtrlCarsActiveIcon,
        showCtrlCharsInactiveIcon,
        showHiddenActiveIcon,
        showHiddenInactiveIcon,
        sleepingConnsActiveIcon,
        sleepingConnsInactiveIcon,
        sqlPreviewActiveIcon,
        sqlPreviewInactiveIcon,
        sqlPreviewIcon,
        stopExecutionIcon,
        stopOnErrorActiveIcon,
        stopOnErrorInactiveIcon,
        wordWrapActiveIcon,
        wordWrapInactiveIcon,
    };

    public static lakehouse = {
        chatOptionsIcon,
        dataLakeIcon,
        lakehouseHouseIcon,
        lakehouseNavigatorLakeHouseIcon,
        lakehouseNavigatorObjectStorageIcon,
        lakehouseNavigatorOnPremiseIcon,
        workflowSeparatorIcon,
        workflowTopLineIcon,
    };
}
