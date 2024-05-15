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

import "./AboutHost.css";

import { ComponentChild } from "preact";
import { ComponentBase, IComponentProperties, IComponentState } from "../ui/Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../ui/Container/Container.js";
import { Label } from "../ui/Label/Label.js";
import { Codicon } from "../ui/Codicon.js";
import { Icon } from "../ui/Icon/Icon.js";

export interface IAboutHostProperties extends IComponentProperties {
    info?: string,
    title?: string,
}

export interface IAboutHostState extends IComponentState {
    closed?: boolean;
}

export class AboutHost extends ComponentBase<IAboutHostProperties, IAboutHostState> {

    public constructor(props: IAboutHostProperties) {
        super(props);

        this.addHandledProperties("info", "title");

        this.state = {
            closed: false,
        };
    }

    public render(): ComponentChild {
        const { title } = this.props;

        const instructions = `Execute \\chat for natural language chat mode.\n`
            + `Execute \\sql to switch to SQL, \\js to JS and \\ts to TypeScript.\n`
            + `Execute \\help or \\? for help;`;

        const info = `Querying your HeatWave Data using SQL, natural language or TypeScript/JavaScript.`;

        return (
            <Container className="aboutResultPanel"
                orientation={Orientation.TopDown}
                mainAlignment={ContentAlignment.Start}
                crossAlignment={ContentAlignment.Center}
            >
                <Container className="title"
                    orientation={Orientation.LeftToRight}
                    mainAlignment={ContentAlignment.Start}
                    crossAlignment={ContentAlignment.Center}
                >
                    <Icon src={Codicon.CommentDiscussion} />
                    <Label>{title}</Label>
                </Container>
                <Label className="info" caption={info} />
                <Label caption={instructions} className="instructions" />
            </Container>
        );
    }
}
