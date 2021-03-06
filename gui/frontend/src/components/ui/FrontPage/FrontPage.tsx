/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

import "./FrontPage.css";
import closeButton from "../../../assets/images/close2.svg";

import React from "react";

import {
    Component, IComponentProperties, Icon, Label, TextAlignment, ContentAlignment, Container, ContentWrap, Orientation,
    Button,
} from "..";
import { appParameters } from "../../../supplement/Requisitions";

export interface IFrontPageProperties extends IComponentProperties {
    showGreeting: boolean;
    caption: string;
    description: string;
    helpUrls: Map<string, string>;
    logo?: Icon;

    onCloseGreeting: () => void;
}

export class FrontPage extends Component<IFrontPageProperties> {

    public constructor(props: IFrontPageProperties) {
        super(props);

        this.state = {
            showGreeting: props.showGreeting,
        };
    }

    public render(): React.ReactNode {
        const { showGreeting, caption, description, helpUrls, children, logo } = this.mergedProps;

        const className = this.getEffectiveClassNames([
            "frontPage",
            this.classFromProperty(appParameters.get("module"), "embedded"),
        ]);

        const links = [];
        for (const url of helpUrls) {
            links.push(<a
                key={url[0]}
                href={url[1]}
                tabIndex={0}
                target="_blank"
                rel="noopener noreferrer"
                onClick={this.handleHelpClick}
            >
                {url[0]}
            </a>);
        }

        return (
            <Container
                orientation={Orientation.TopDown}
                className={className}
            >
                {showGreeting &&
                    <>
                        {logo}
                        <Label
                            id="title"
                            as="h2"
                            textAlignment={TextAlignment.Center}
                        >
                            {caption}
                        </Label>
                        <Label
                            id="description"
                            textAlignment={TextAlignment.Center}
                        >
                            {description}
                        </Label>
                        <Container
                            id="linksHost"
                            orientation={Orientation.LeftToRight}
                            mainAlignment={ContentAlignment.Center}
                            wrap={ContentWrap.Wrap}
                        >
                            {links}
                        </Container>
                        <Button
                            round
                            id="closeButton"
                            data-tooltip="Close Greeting"
                            onClick={this.handleCloseClick}
                        >
                            <Icon src={closeButton} data-tooltip="inherit" />
                        </Button>
                    </>
                }

                <Container
                    orientation={Orientation.TopDown}
                >
                    {children}
                </Container>
            </Container >
        );
    }

    private handleCloseClick = (): void => {
        const { onCloseGreeting } = this.props;

        onCloseGreeting();
    };

    private handleHelpClick = (e: React.SyntheticEvent): void => {
        //const url = (e.target as Element).attributes[0].value;
        const embedded = appParameters.get("module");
        if (embedded) {
            e.stopPropagation();
            e.preventDefault();

            // TODO: open the web page in the systems standard browser.
            // sendOutboundMessage({ source: "app", command: "openWebPage", data: url });
        }
    };
}
