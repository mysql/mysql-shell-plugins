/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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
 * separately licensed software that they have included with
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

import { driver } from "../../lib/driver.js";
import * as constants from "../constants.js";
import * as locator from "../locators.js";
import { Overview } from "./E2EOverview.js";
import { E2EUploadToObjectStorage } from "./E2EUploadToObjectStorage.js";
import { E2ELoadIntoLakehouse } from "./E2ELoadIntoLakeHouse.js";
import { E2ELakehouseTables } from "./E2ELakeHouseTables.js";
import { E2EToolbar } from "../E2EToolbar.js";

/**
 * This class represents the LakeHouse Navigator page, and all its related functions
 */
export class E2ELakeHouseNavigator {

    /** The Toolbar for the LakeHouse Navigator page*/
    public toolbar = new E2EToolbar();

    /** The Overview page*/
    public overview = new Overview();

    /** The Upload to Object Storage page*/
    public uploadToObjectStorage = new E2EUploadToObjectStorage();

    /** The Load into Lakehouse page*/
    public loadIntoLakehouse = new E2ELoadIntoLakehouse();

    /** The Lakehouse Tables page*/
    public lakehouseTables = new E2ELakehouseTables();

    /**
     * Selects a tab (Overview/Upload to Object Storage/Load into Lakehouse/Lakehouse Tables)
     * @param tabName The tab name
     * @returns A promise resolving when the tab is selected
     */
    public selectTab = async (tabName: string): Promise<void> => {

        switch (tabName) {
            case constants.overviewTab: {
                await driver.findElement(locator.lakeHouseNavigator.overview.tab).click();
                break;
            }
            case constants.uploadToObjectStorageTab: {
                await driver.findElement(locator.lakeHouseNavigator.uploadToObjectStorage.tab).click();
                break;
            }
            case constants.loadIntoLakeHouseTab: {
                await driver.findElement(locator.lakeHouseNavigator.loadIntoLakeHouse.tab).click();
                break;
            }
            case constants.lakeHouseTablesTab: {
                await driver.findElement(locator.lakeHouseNavigator.lakeHouseTables.tab).click();
                break;
            }
            default: {
                throw new Error(`Unknown tab '${tabName}'`);
            }
        }
    };

}

