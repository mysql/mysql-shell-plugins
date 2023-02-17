/*
 * Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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

import "./assets/ThemeEditor.css";

import { ComponentChild } from "preact";

import { ThemeManager } from "./ThemeManager";
import { ThemePreview } from "./Preview/ThemePreview";
import { ThemeEditorCore } from "./ThemeEditorCore";
import { ComponentBase } from "../ui/Component/ComponentBase";
import { Container, Orientation } from "../ui/Container/Container";

export class ThemeEditor extends ComponentBase {

    private themeHasChanged = false;
    private changeTimer: ReturnType<typeof setTimeout>;

    public render(): ComponentChild {
        const className = {
            host: this.getEffectiveClassNames(["themeEditorHost"]),
            editor: this.getEffectiveClassNames(["themeEditor"]),
        };

        return (
            <Container
                orientation={Orientation.LeftToRight}
                className={className.host}
            >
                <ThemeEditorCore
                    onThemeChange={this.handleThemeChange}
                />
                <ThemePreview />
            </Container>
        );
    }

    private handleThemeChange = (): void => {
        this.themeHasChanged = true;
        clearTimeout(this.changeTimer);
        this.changeTimer = setTimeout((): void => {
            this.themeHasChanged = false;
            ThemeManager.get.saveTheme();
        }, 1000);

    };
}
