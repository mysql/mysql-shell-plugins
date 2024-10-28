/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

import cx from "classnames";
import { ComponentChild, createRef } from "preact";

import type { Command } from "../../../data-models/data-model-types.js";
import { KeyboardKeys } from "../../../utilities/helpers.js";
import { Codicon } from "../Codicon.js";
import { ComponentBase, IComponentProperties } from "../Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../Container/Container.js";
import { Icon } from "../Icon/Icon.js";
import { Label } from "../Label/Label.js";
import { IMenuItemProperties, MenuItem } from "../Menu/MenuItem.js";
import { ProgressIndicator } from "../ProgressIndicator/ProgressIndicator.js";
import { IAccordionAction, IAccordionActionChoice } from "./Accordion.js";

export interface IAccordionSectionProperties extends IComponentProperties {
    /** The section title. */
    caption: string;

    /** If true then dim the content to give more visual focus on other elements. */
    dimmed: boolean;

    /** If true then show title + content of the section, otherwise only the title. */
    expanded: boolean;

    actions?: IAccordionAction[];

    onToggleExpandState?: (props: IAccordionSectionProperties) => void;
    onAction?: (command?: Command) => void;
}

export interface IAccordionSectionState {
    showProgress: boolean;
}

export class AccordionSection extends ComponentBase<IAccordionSectionProperties, IAccordionSectionState> {

    private sectionRef = createRef<HTMLDivElement>();

    public constructor(props: IAccordionSectionProperties) {
        super(props);

        this.state = {
            showProgress: false,
        };

        this.addHandledProperties("caption", "dimmed", "expanded", "actions", "onToggleExpandState", "onAction");
    }

    public render(): ComponentChild {
        const { children, caption, actions, dimmed, expanded } = this.props;
        const { showProgress } = this.state;

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
                {...this.unhandledProperties}
            >
                <Container
                    orientation={Orientation.LeftToRight}
                    className="title"
                    onClick={this.handleClick}
                    onKeyPress={this.handleKeyPress}
                    tabIndex={0}
                    crossAlignment={ContentAlignment.Center}
                >
                    <Icon src={expanded ? Codicon.ChevronDown : Codicon.ChevronRight} />
                    <Label caption={caption} />
                    <Container
                        className="actions"
                        mainAlignment={ContentAlignment.End}
                        crossAlignment={ContentAlignment.Center}
                    >
                        {
                            actions?.map((action: IAccordionAction, index) => {
                                if (!action.choices) {
                                    return <Icon
                                        src={action.icon}
                                        id={action.command?.command ?? String(index)}
                                        key={String(index)}
                                        className="accordionAction"
                                        data-tooltip={action.command?.tooltip}
                                        tabIndex={0}
                                        onKeyPress={this.handleActionKeyPress.bind(this, action.command)}
                                        onClick={this.handleActionClick.bind(this, action.command)}
                                    />;
                                } else {
                                    return (
                                        <MenuItem // Render a menu item here, not a menu (to an icon).
                                            key={String(index)}
                                            command={{ title: "", command: "" }}
                                            icon={action.icon}
                                            data-tooltip={action.tooltip}
                                            subMenuShowOnClick={true}
                                            onSubMenuOpen={this.handleActionMenuOpen}
                                            onSubMenuClose={this.handleActionMenuClose}
                                            onItemClick={this.handleActionMenuClick}
                                        >
                                            {
                                                action.choices?.map((value: IAccordionActionChoice) => {
                                                    return <MenuItem
                                                        key={value.command.command}
                                                        command={value.command}
                                                        icon={value.icon}
                                                    />;
                                                })
                                            }
                                        </MenuItem>
                                    );
                                }
                            })
                        }
                    </Container>
                    {showProgress && <ProgressIndicator
                        className="sectionProgress"
                        linear
                        indicatorHeight={2}
                        indicatorWidth={100}
                    />}
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

    public get showProgress(): boolean {
        return this.state.showProgress;
    }

    public set showProgress(value: boolean) {
        this.setState({ showProgress: value });
    }

    private handleClick = (): void => {
        this.toggleExpandState();
    };

    private handleKeyPress = (e: KeyboardEvent): void => {
        if (e.key === KeyboardKeys.Space || e.key === KeyboardKeys.Enter) {
            this.toggleExpandState();
        }
    };

    private toggleExpandState = (): void => {
        const { onToggleExpandState } = this.props;
        onToggleExpandState?.(this.props);
    };

    private handleActionClick = (command: Command | undefined, e: MouseEvent | KeyboardEvent): void => {
        e.stopPropagation();

        const { onAction } = this.props;
        onAction?.(command);
    };

    private handleActionKeyPress = (command: Command | undefined, e: KeyboardEvent): void => {
        if (e.key === KeyboardKeys.Space || e.key === KeyboardKeys.Enter) {
            e.stopPropagation();

            const { onAction } = this.props;
            onAction?.(command);
        }
    };

    private handleActionMenuClick = (props: Readonly<IMenuItemProperties>): void => {
        const { onAction } = this.props;

        onAction?.(props.command);
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
