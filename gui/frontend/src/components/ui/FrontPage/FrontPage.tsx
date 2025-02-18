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

import "./FrontPage.css";

import { ComponentChild } from "preact";

import { Assets } from "../../../supplement/Assets.js";
import { appParameters } from "../../../supplement/Requisitions.js";
import { helpUrlMap } from "../../../supplement/index.js";
import { Button } from "../Button/Button.js";
import { ComponentBase, IComponentProperties } from "../Component/ComponentBase.js";
import { Container, ContentAlignment, ContentWrap, Orientation } from "../Container/Container.js";
import { HelpLinkList } from "../HelpLinkList/HelpLinkList.js";
import { Icon } from "../Icon/Icon.js";
import { Label, TextAlignment } from "../Label/Label.js";

interface IFrontPageProperties extends IComponentProperties {
    showGreeting: boolean;
    caption: string;
    description: string;
    logo?: Icon;

    onCloseGreeting: () => void;
}

export class FrontPage extends ComponentBase<IFrontPageProperties> {

    public constructor(props: IFrontPageProperties) {
        super(props);

        this.state = {
            showGreeting: props.showGreeting,
        };
    }

    public render(): ComponentChild {
        const { showGreeting, caption, description, children, logo } = this.props;

        const className = this.getEffectiveClassNames([
            "frontPage",
            this.classFromProperty(appParameters.get("module"), "embedded"),
        ]);

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
                            <HelpLinkList helpUrlMap={helpUrlMap} />
                        </Container>
                        <Button
                            round
                            id="closeButton"
                            data-tooltip="Close Greeting"
                            onClick={this.handleCloseClick}
                        >
                            <Icon src={Assets.misc.close2Icon} data-tooltip="inherit" />
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
}
