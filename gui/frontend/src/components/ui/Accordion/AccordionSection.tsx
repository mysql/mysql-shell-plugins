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

import React from "react";
import cx from "classnames";

import { isNil } from "lodash";
import keyboardKey from "keyboard-key";

import {
    Component, IComponentProperties, Container, Label, Orientation, IAccordionAction, Icon, MenuItem,
    IAccordionActionChoice, IMenuItemProperties,
} from "..";
import { ContentAlignment } from "../Container/Container";

export interface IAccordionSectionProperties extends IComponentProperties {
    caption: string;
    dimmed: boolean;       // If true then dim the content to give more visual focus on other elements.
    expanded: boolean;     // If true then show title + content of the section, otherwise only the title.

    actions?: IAccordionAction[];

    onToggleExpandState?: (props: IAccordionSectionProperties) => void;
    onAction?: (actionId: string, props: IAccordionSectionProperties) => void;
}

export class AccordionSection extends Component<IAccordionSectionProperties> {

    private sectionRef = React.createRef<HTMLElement>();

    public constructor(props: IAccordionSectionProperties) {
        super(props);

        this.addHandledProperties("caption", "dimmed", "expanded", "actions", "onToggleExpandState", "onAction");
    }

    public render(): React.ReactNode {
        const { children, caption, actions, dimmed, expanded } = this.props;

        const className = this.getEffectiveClassNames([
            "section",
            this.classFromProperty(expanded, "expanded"),
        ]);
        const contentClassName = cx([
            "content",
            this.classFromProperty(dimmed, "dimmed")],
        );

        return (
            <Container
                orientation={Orientation.TopDown}
                className={className}
                innerRef={this.sectionRef}
            >
                <Container
                    orientation={Orientation.LeftToRight}
                    className="title"
                    onClick={this.handleClick}
                    onKeyPress={this.handleKeyPress}
                    tabIndex={0}
                    crossAlignment={ContentAlignment.Center}
                >
                    <Label caption={caption} />
                    <Container
                        className="actions"
                        mainAlignment={ContentAlignment.End}
                        crossAlignment={ContentAlignment.Center}
                    >
                        {
                            actions?.map((action: IAccordionAction) => {
                                if (isNil(action.choices)) {
                                    return <Icon
                                        src={action.icon}
                                        id={action.id}
                                        key={action.id}
                                        data-tooltip={action.tooltip}
                                        tabIndex={0}
                                        onKeyPress={this.handleActionKeyPress}
                                        onClick={this.handleActionClick}
                                    />;
                                } else {
                                    return (
                                        <MenuItem
                                            id={action.id}
                                            key={action.id}
                                            icon={action.icon}
                                            subMenuShowOnClick={true}
                                            onSubMenuOpen={this.handleActionMenuOpen}
                                            onSubMenuClose={this.handleActionMenuClose}
                                        >
                                            {
                                                action.choices?.map((value: IAccordionActionChoice) => {
                                                    return <MenuItem
                                                        key={value.id}
                                                        id={value.id}
                                                        caption={value.caption}
                                                        icon={value.icon}
                                                        onClick={this.handleActionMenuClick}
                                                    />;
                                                })
                                            }
                                        </MenuItem>
                                    );
                                }
                            })
                        }
                    </Container>
                </Container>

                <Container
                    className={contentClassName}
                    orientation={Orientation.TopDown}
                    tabIndex={0}
                >
                    {children}
                </Container>
            </Container>
        );
    }

    private handleClick = (): void => {
        this.toggleExpandState();
    };

    private handleKeyPress = (e: React.KeyboardEvent): void => {
        const key = keyboardKey.getCode(e);
        if (key === keyboardKey.Spacebar || key === keyboardKey.Enter) {
            this.toggleExpandState();
        }
    };

    private toggleExpandState = (): void => {
        const { onToggleExpandState } = this.props;
        onToggleExpandState?.(this.props);
    };

    private handleActionClick = (e: React.SyntheticEvent, props: IComponentProperties): void => {
        e.stopPropagation();

        const { onAction } = this.props;
        onAction?.(props.id || "", this.props);
    };

    private handleActionKeyPress = (e: React.KeyboardEvent, props: IComponentProperties): void => {
        const key = keyboardKey.getCode(e);
        if (key === keyboardKey.Spacebar || key === keyboardKey.Enter) {
            e.stopPropagation();

            const { onAction } = this.props;
            onAction?.(props.id || "", this.props);
        }
    };

    private handleActionMenuClick = (e: React.SyntheticEvent, props: IMenuItemProperties): void => {
        const { onAction } = this.props;
        onAction?.(props.id || "", this.props);
    };

    private handleActionMenuOpen = (): void => {
        // Clicking on a sub menu item removes the focus from the section title with the actions from which the menu
        // was triggered. This in turn hides the action bar (because this is how actions work).
        // Without that item the submenu has no anchor anymore and moves to the top/left corner.
        // We use a dedicated CSS class to prevent this behavior when the submenu is visible.
        if (this.sectionRef?.current) {
            this.sectionRef.current.classList.add("nohide");
        }
    };

    private handleActionMenuClose = (): void => {
        if (this.sectionRef?.current) {
            this.sectionRef.current.classList.remove("nohide");
        }
    };

}
