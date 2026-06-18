/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

const desktopBridgeCommand = "import gui_plugin as gui; gui.start.desktop_bridge()";

const parseMysqlShellExtraArguments = (value) => {
    if (!value || !value.trim()) {
        return [];
    }

    const result = [];
    let current = "";
    let quote;

    const pushCurrent = () => {
        if (current.length > 0) {
            result.push(current);
            current = "";
        }
    };

    for (let i = 0; i < value.length; i++) {
        const character = value[i];

        if (quote) {
            if (character === quote) {
                quote = undefined;
            } else if (character === "\\" && (value[i + 1] === quote || value[i + 1] === "\\")) {
                current += value[++i];
            } else {
                current += character;
            }
        } else if (character === "'" || character === "\"") {
            quote = character;
        } else if (/\s/.test(character)) {
            pushCurrent();
        } else {
            current += character;
        }
    }

    pushCurrent();

    return result;
};

const buildMysqlShellArguments = ({ isRendererDevMode, extraArguments = [] }) => {
    return [
        ...(isRendererDevMode ? ["--disable-builtin-plugins"] : ["--disable-plugins"]),
        ...extraArguments,
        "--py",
        "-e",
        desktopBridgeCommand,
    ];
};

module.exports = {
    buildMysqlShellArguments,
    parseMysqlShellExtraArguments,
};
