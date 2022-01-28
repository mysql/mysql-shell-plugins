/*
 * Copyright (c) 2020, 2021, Oracle and/or its affiliates.
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

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { MysqlServerInstance } from "./MysqlServerInstance";
import { MySQLServerInstanceState } from "./MysqlStates";

export class MysqlServerInstanceOnPremise extends MysqlServerInstance {

    protected menuBtnClick = (): void => {
        this.showPopupMenu([
            {
                id: "mnuLiftShift",
                icon: "mnu-lift-and-shift.png",
                caption: "Lift and Shift",
                eventHandler: this.handleLiftAndShiftClick,
            },
            {
                id: "mnuRemoveInstance",
                icon: "mnu-remove.png",
                caption: "Remove Instance",
                eventHandler: this.handleRemoveInstanceClick,
            },
        ]);
    };

    protected showPopupMenu(
        arg0: Array<{
            id: string;
            icon: string;
            caption: string;
            eventHandler: (event: any) => void;
        }>,
    ): void {
        throw new Error("Method not implemented.");
    }

    protected handleClick = (event: any): void => {
        if (this.options.state === MySQLServerInstanceState.AddInstance) {
            void this.showAddInstanceDlg();
        }
    };

    protected handleClosePopupMenu = (event: any): void => {
        throw new Error("Method not implemented.");
    };

    private async fetchHtmlAsText(url: string): Promise<string> {
        return (await fetch(url)).text();
    }

    private async showAddInstanceDlg(): Promise<void> {
    // Load dialog content
        const content = document.getElementById("overlayDialog");
        if (content != null) {
            content.innerHTML = await this.fetchHtmlAsText(
                "./inc/mysqlaas/dlg.addInstance.html",
            );
        }
        // Show the dialog
        const overlayDialogBg = document.getElementById("overlayDialogBg");
        if (overlayDialogBg != null) {
            overlayDialogBg.style.display = "inherit";
        }
        // Register Button event listener
        this.addAndCacheEventHandler(
            document.getElementById("overlayDialogOKBtn"),
            "click",
            this.handleAddInstanceDlgOk,
            null,
        );

        this.addAndCacheEventHandler(
            document.getElementById("overlayDialogCancelBtn"),
            "click",
            this.handleAddInstanceDlgCancel,
            null,
        );
        this.addAndCacheEventHandler(
            document,
            "keydown",
            this.handleAddInstanceDlgKey,
            null,
        );
    }

    private handleAddInstanceDlgCancel = (event: any): void => {
        const dlgContainer = document.getElementById("overlayDialogBg");
        // Hide dialog
        if (dlgContainer != null) {
            dlgContainer.style.display = "none";
        }
        this.removeCachedEventHandlers(null);
    };

    private handleAddInstanceDlgOk = (event: any): void => {
        const dlgContainer = document.getElementById("overlayDialogBg");
        // Hide dialog
        if (dlgContainer != null) {
            dlgContainer.style.display = "none";
        }
        this.removeCachedEventHandlers(null);
        // Change state of instance
        const form = document.getElementById("addInstanceForm") as HTMLFormElement;
        if (form != null) {
            this.changeState({
                state: MySQLServerInstanceState.Configured,
                //caption: form.elements.namedItem("displayName")
                //hostname: form.elements.namedItem("displayName").hostname.value, //FIXMEE@@
                status: "Available",
            });
        }
        // Add a first MySQL Server Instance in ADD_INSTANCE mode
        const instance = new MysqlServerInstanceOnPremise(this.resources, {
            state: MySQLServerInstanceState.AddInstance,
            caption: "Add Instance",
            subCaption: "Add MySQL Server Instance",
            onPremRegion: this.options.onPremRegion,
        });
        instance.x = 325;
        instance.y = 35;
        //this.options.onPremRegion.addChild(instance);
    // this.options.project.addEventLogItem({
    //     type: logEvent.EVENT_LOG_ITEM_TYPE.INFO,
    //     caption: "Added on-premise instance",
    //     message: "Added a new on-premise instance to the project.\n",
    //     status: logEvent.EVENT_LOG_ITEM_STATE.OK
    // });
    };

    private handleAddInstanceDlgKey = (event: any): void => {
        if (event.key === "Enter") {
            this.handleAddInstanceDlgOk(event);
        } else if (event.key === "Escape") {
            this.handleAddInstanceDlgCancel(event);
        }
    };

    private handleLiftAndShiftClick = (event: any): void => {
        this.handleClosePopupMenu(event);
    };

    private handleRemoveInstanceClick = (event: any): void => {
        this.handleClosePopupMenu(event);
        this.changeState({ state: MySQLServerInstanceState.AddInstance });
    };
}
