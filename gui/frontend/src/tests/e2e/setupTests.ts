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

/* cspell: disable */

import { error } from "console";
import { exit } from "process";
import Enzyme from "enzyme";
import Adapter from "enzyme-adapter-preact-pure";

// @ts-ignore, because TS does not infer the correct use of the `Adapter` type.
Enzyme.configure({ adapter: new Adapter() });

jest.useRealTimers();
// Check required environment variables before any test starts.
if (process.env.SHELL_UI_HOSTNAME!.includes("docker")) {
    process.env.HOSTNAME_PORT = "8000";
    process.env.TOKEN = "1234test";
    process.env.DBHOSTNAME = "db1";
    process.env.DBUSERNAME = "root";
    process.env.DBPASSWORD = "root";
    process.env.DBPORT = "3306";
    process.env.DBPORTX = "33060";
    process.env.DBUSERNAMESHELL = "clientqa";
    process.env.DBPASSWORDSHELL = "clientqa";
    process.env.DBUSERNAME1 = "dbuser1";
    process.env.DBUSERNAME2 = "dbuser2";
    process.env.DBUSERNAME3 = "dbuser3";
    process.env.SSL_ROOT_FOLDER = "/home/clientqa/ssl/db1";
    process.env.SQLITE_PATH_FILE = "/home/clientqa/.mysqlsh/plugin_data/gui_plugin/mysqlsh_gui_backend.sqlite3";
} else {
    if (!process.env.SHELL_UI_HOSTNAME) {
        error("No value for environment var SHELL_UI_HOSTNAME was provided");
        exit(1);
    }
    if (!process.env.MAX_WORKERS) {
        if (!process.env.HOSTNAME_PORT) {
            error("No value for environment var HOSTNAME_PORT was provided");
            exit(1);
        }
    }
    if (!process.env.TOKEN) {
        error("No value for environment var TOKEN was provided");
        exit(1);
    }
    if (!process.env.DBHOSTNAME) {
        error("No value for environment var DBHOSTNAME was provided");
        exit(1);
    }
    if (!process.env.DBUSERNAME) {
        error("No value for environment var DBUSERNAME was provided");
        exit(1);
    }
    if (!("DBPASSWORD" in process.env)) {
        error("No value for environment var DBPASSWORD was provided");
        exit(1);
    }
    if (!process.env.DBUSERNAMESHELL) {
        error("No value for environment var DBUSERNAME1 (another user beyond root) was provided");
        exit(1);
    }
    if (!process.env.DBPASSWORDSHELL) {
        error("No value for environment var DBPASSWORD1 (another password beyond root's password) was provided");
        exit(1);
    }
    if (!process.env.MYSQL_PORT) {
        error("No value for environment var MYSQL_PORT was provided");
        exit(1);
    }
    if (!process.env.SSL_ROOT_FOLDER) {
        error("No value for environment var SSL_ROOT_FOLDER was provided (path to folder with SSL certificates)");
        exit(1);
    }
    if (!process.env.SQLITE_PATH_FILE) {
        error("No value for environment var SQLITE_PATH_FILE was provided (path to a sqlite3 database file)");
        exit(1);
    }
}

if (!process.env.SHELL_UI_MU_HOSTNAME) {
    error("No value for environment var SHELL_UI_MU_HOSTNAME was provided");
    exit(1);
} else {
    if (process.env.SHELL_UI_MU_HOSTNAME.indexOf("docker") !== -1) {
        process.env.MU_USERNAME = "client";
        process.env.MU_PASSWORD = "client";
    }
}

if (!process.env.MU_USERNAME) {
    error("No value for environment var MU_USERNAME was provided (Multi-user mode)");
    exit(1);
}

if (!process.env.MU_PASSWORD) {
    error("No value for environment var MU_PASSWORD was provided (Multi-user mode)");
    exit(1);
}
