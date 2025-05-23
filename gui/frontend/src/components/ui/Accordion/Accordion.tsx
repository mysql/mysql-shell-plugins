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

import "./Accordion.css";

import { ComponentChild, createRef, type RefObject } from "preact";

import type { Command } from "../../../data-models/data-model-types.js";
import { KeyboardKeys } from "../../../utilities/helpers.js";
import { Codicon } from "../Codicon.js";
import { ComponentBase, IComponentProperties } from "../Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../Container/Container.js";
import { Icon } from "../Icon/Icon.js";
import { Label } from "../Label/Label.js";
import { MenuItem, type IMenuItemProperties } from "../Menu/MenuItem.js";
import { ISplitterPane, ISplitterPaneSizeInfo, SplitContainer } from "../SplitContainer/SplitContainer.js";
import { AccordionItem } from "./AccordionItem.js";
import { AccordionSection, IAccordionSectionProperties } from "./AccordionSection.js";

export interface IAccordionActionChoice {
    icon: string | Codicon;
    command: Command;
}

export type IAccordionAction =
    | IAccordionActionWithCommand
    | IAccordionActionWithChoices;

interface IAccordionActionBase {
    /** The icon to show in the section title, for this command  */
    icon: Codicon;
}

interface IAccordionActionWithCommand extends IAccordionActionBase {
    /** The command to execute if this action has no other choices.  */
    command: Command;

    choices?: never;
    tooltip?: never;
}

interface IAccordionActionWithChoices extends IAccordionActionBase {
    /** Used to show a menu that opens on click of the action, for a list of additional actions. */
    choices: IAccordionActionChoice[];

    /** The tooltip for the action menu button. */
    tooltip?: string;

    command?: never;
}

export interface IAccordionSection {
    /** A reference to the accordion section created for this specification. */
    ref?: RefObject<AccordionSection>;

    /** A unique id for the section. This must be a valid DOM identifier. */
    id: string;

    /** The caption to show as section title. */
    caption: string;

    /** If true then the section stretches to take as much space as possible. */
    stretch?: boolean;

    /** if true then the section can manually be resized. */
    resizable?: boolean;

    /** If true then dim the content to give more visual focus on other elements. */
    dimmed?: boolean;

    /** If true then show title + content of the section, otherwise only the title. */
    expanded?: boolean;

    /** Determines the initial height before any automatic or manual resize. */
    initialSize?: number;

    // These limits determine the possible dimensions of the section. If the section is not stretchable then
    // the actual size will vary depending on the section content (within these bounds, if given).
    minSize?: number;
    maxSize?: number;

    actions?: IAccordionAction[];

    content: ComponentChild;
}

export interface IAccordionProperties extends IComponentProperties {
    caption?: string;
    footer?: string;
    singleExpand?: boolean;
    sectionClosedSize?: number;

    /** Icons shown in the title bar, beside the main caption. */
    actions?: IAccordionAction[];

    sections: IAccordionSection[];

    onSectionExpand?: (props: IAccordionProperties, sectionId: string, expanded: boolean) => void;
    onSectionResize?: (props: IAccordionProperties, info: ISplitterPaneSizeInfo[]) => void;
    onSectionAction?: (command?: Command) => void;
}

export class Accordion extends ComponentBase<IAccordionProperties> {

    // eslint-disable-next-line @typescript-eslint/naming-convention
    public static Item = AccordionItem;

    private containerRef = createRef<SplitContainer>();

    /** The standard height of an accordion item. If you change this value, make sure to update the CSS as well. */
    static #standardItemHeight = 22;

    public constructor(props: IAccordionProperties) {
        super(props);

        this.addHandledProperties("caption", "footer", "singleExpand", "sections", "actions", "onSectionExpand",
            "sectionClosedSize", "onSectionAction", "onSectionResize");
    }

    public render(): ComponentChild {
        const { actions, caption, footer, sections, sectionClosedSize } = this.props;

        const className = this.getEffectiveClassNames(["accordion"]);

        const panes = sections.map((section: IAccordionSection): ISplitterPane => {
            const pane: ISplitterPane = {
                id: section.id,
                initialSize: section.initialSize,
                minSize: section.minSize ?? sectionClosedSize ?? Accordion.#standardItemHeight,
                maxSize: section.maxSize,
                snap: true,
                stretch: section.stretch ?? false,
                resizable: section.resizable ?? false,
                collapsed: !(section.expanded ?? true),
                content: (
                    <AccordionSection
                        ref={section.ref}
                        id={section.id}
                        caption={section.caption}
                        dimmed={section.dimmed ?? false}
                        expanded={section.expanded ?? true}
                        actions={section.actions}

                        onToggleExpandState={this.toggleSectionExpandState}
                        onAction={this.handleSectionAction}
                    >
                        {section.content}
                    </AccordionSection>
                ),
            };

            if (pane.collapsed) {
                pane.minSize = sectionClosedSize ?? Accordion.#standardItemHeight;
                pane.maxSize = sectionClosedSize ?? Accordion.#standardItemHeight;
                pane.initialSize = sectionClosedSize ?? Accordion.#standardItemHeight;
            }

            return pane;
        });

        return (
            <Container
                className={className}
                orientation={Orientation.TopDown}
                mainAlignment={ContentAlignment.Start}
                {...this.unhandledProperties}
            >
                <Container
                    className="actions"
                    mainAlignment={ContentAlignment.End}
                    crossAlignment={ContentAlignment.Center}
                >
                    {caption && <Label className="title">{caption}</Label>}
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

                <SplitContainer
                    ref={this.containerRef}
                    className="accordionContent"
                    orientation={Orientation.TopDown}
                    panes={panes}
                    onPaneResized={this.handleSectionResize}
                />
                {footer && <Label className="footer">{footer}</Label>}
            </Container>
        );
    }

    /**
     * Triggered when a section expand state must be toggled.
     *
     * @param props The section that changed.
     */
    private toggleSectionExpandState = (props: IAccordionSectionProperties): void => {
        const { onSectionExpand } = this.props;

        onSectionExpand?.(this.props, props.id || "", !props.expanded);
    };

    private handleSectionAction = (command?: Command): void => {
        const { onSectionAction } = this.props;

        onSectionAction?.(command);
    };

    /**
     * Stores the size last set by the user as new initial size, for the given section.
     * This ensures that after collapsing/expanding we restore the last set size.
     *
     * @param info The ids and current sizes of all panes.
     */
    private handleSectionResize = (info: ISplitterPaneSizeInfo[]): void => {
        const { onSectionResize } = this.props;

        onSectionResize?.(this.props, info);
    };

    private handleActionClick = (command: Command | undefined, e: MouseEvent | KeyboardEvent): void => {
        e.stopPropagation();

        const { onSectionAction } = this.props;
        onSectionAction?.(command);
    };

    private handleActionKeyPress = (command: Command | undefined, e: KeyboardEvent): void => {
        if (e.key === KeyboardKeys.Space || e.key === KeyboardKeys.Enter) {
            e.stopPropagation();

            const { onSectionAction } = this.props;
            onSectionAction?.(command);
        }
    };

    private handleActionMenuClick = (props: Readonly<IMenuItemProperties>): void => {
        const { onSectionAction } = this.props;

        onSectionAction?.(props.command);
    };

    private handleActionMenuOpen = (): void => {
        /*
        // Clicking on a sub menu item removes the focus from the section title with the actions from which the menu
        // was triggered. This in turn hides the action bar (because this is how actions work).
        // Without that item the submenu has no anchor anymore and moves to the top/left corner.
        // We use a dedicated CSS class to prevent this behavior when the submenu is visible.
        if (this.sectionRef?.current) {
            this.sectionRef.current.classList.add("nohide");
        }*/
    };

    private handleActionMenuClose = (): void => {
        /*if (this.sectionRef?.current) {
            this.sectionRef.current.classList.remove("nohide");
        }*/
    };
}
