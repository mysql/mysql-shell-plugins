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

import "./Accordion.css";

import React from "react";

import { AccordionItem } from "./AccordionItem";
import {
    Component, IComponentProperties, Orientation, Container, Label, SplitContainer, ISplitterPane, IComponentState,
    ISplitterPaneSizeInfo,
} from "..";
import { ContentAlignment } from "../Container/Container";
import { Codicon } from "../Codicon";
import { AccordionSection, IAccordionSectionProperties } from "./AccordionSection";

export interface IAccordionActionChoice {
    id: string;
    icon: string | Codicon;
    caption: string;
}

export interface IAccordionAction {
    icon: Codicon;
    tooltip?: string;
    id: string;

    choices?: IAccordionActionChoice[];
}

export interface IAccordionSection {
    id: string;
    caption: string;
    stretch?: boolean;    // If true then the section stretches to take as much space as possible.
    resizable?: boolean;  // if true then the section can manually be resized.
    dimmed?: boolean;     // If true then dim the content to give more visual focus on other elements.
    expanded?: boolean;   // If true then show title + content of the section, otherwise only the title.
    initialSize?: number; // Determines the initial height before any automatic or manual resize.

    // These limits determine the possible dimensions of the section. If the section is not stretchable then
    // the actual size will vary depending on the section content (within these bounds, if given).
    minSize?: number;
    maxSize?: number;

    actions?: IAccordionAction[];

    content: React.ReactNode;
}

export interface IAccordionProperties extends IComponentProperties {
    caption?: string;
    footer?: string;
    singleExpand?: boolean;

    sections: IAccordionSection[];

    onSectionExpand?: (props: IAccordionProperties, sectionId: string, expanded: boolean) => void;
    onSectionResize?: (props: IAccordionProperties, sectionId: string, size: number) => void;
    onSectionAction?: (props: IAccordionProperties, sectionId: string, actionId: string) => void;
}

interface IAccordionState extends IComponentState {
    sectionDetails: ISectionDetails[];
}

interface ISectionState {
    expanded?: boolean;
    sizeBackup?: number;
    minSizeBackup?: number;
    maxSizeBackup?: number;
    resizableBackup?: boolean;
}

type ISectionDetails = ISplitterPane & ISectionState;

export class Accordion extends Component<IAccordionProperties, IAccordionState> {

    // eslint-disable-next-line @typescript-eslint/naming-convention
    public static Item = AccordionItem;

    private containerRef = React.createRef<SplitContainer>();

    public constructor(props: IAccordionProperties) {
        super(props);

        const panes = this.constructSplitterPanes();
        this.state = {
            sectionDetails: panes,
        };

        this.addHandledProperties("caption", "footer", "singleExpand", "sections", "onSectionExpand",
            "onSectionAction", "onSectionResize");
    }

    public componentDidUpdate(prevProps: IAccordionProperties): void {
        const { sections } = this.props;
        if (sections !== prevProps.sections) {
            const panes = this.constructSplitterPanes();

            this.setState({ sectionDetails: panes });
        }
    }

    public render(): React.ReactNode {
        const { caption, footer } = this.mergedProps;
        const { sectionDetails } = this.state;

        const className = this.getEffectiveClassNames(["accordion"]);

        return (
            <Container
                className={className}
                orientation={Orientation.TopDown}
                mainAlignment={ContentAlignment.Start}
                {...this.unhandledProperties}
            >
                {caption && <Label className="title">{caption}</Label>}
                <SplitContainer
                    ref={this.containerRef}
                    className="accordionContent"
                    orientation={Orientation.TopDown}
                    panes={sectionDetails}
                    onPaneResized={this.handleSectionResize}
                />
                {footer && <Label className="footer">{footer}</Label>}
            </Container>
        );
    }

    /**
     * Creates a new set of section panes out of the defined sections + their state.
     *
     * @returns An array of new splitter plane definitions.
     */
    private constructSplitterPanes = (): ISectionDetails[] => {
        const { sections } = this.props;

        return sections.map((section: IAccordionSection): ISectionDetails => {
            const details = {
                id: section.id,
                initialSize: section.initialSize,
                minSize: section.minSize ?? 28,
                minSizeBackup: section.minSize ?? 28,
                maxSize: section.maxSize,
                maxSizeBackup: section.maxSize,
                snap: true,
                stretch: section.stretch ?? false,
                resizable: section.resizable ?? false,
                resizableBackup: section.resizable ?? false,
                expanded: section.expanded ?? true,
                content: (
                    <AccordionSection
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

            if (!details.expanded) {
                details.minSize = 28;
                details.maxSize = 28;
            }

            return details;
        });
    };

    /**
     * Triggered when a section expand state must be toggled.
     *
     * @param props The section that changed.
     */
    private toggleSectionExpandState = (props: IAccordionSectionProperties): void => {
        const { singleExpand, onSectionExpand } = this.mergedProps;
        const { sectionDetails } = this.state;

        const expand = !props.expanded;
        sectionDetails.forEach((section: ISectionDetails) => {
            if (section.id === props.id) {
                if (!expand) {
                    // Save the current size if the pane gets collapsed now.
                    section.sizeBackup = this.containerRef.current?.getPaneSize(section.id);
                    section.resizableBackup = section.resizable;
                    section.minSizeBackup = section.minSize;
                    section.maxSizeBackup = section.maxSize;
                }

                section.expanded = expand;
                if (!expand) {
                    section.minSize = 28;
                    section.maxSize = 28;
                    section.resizable = false;
                } else {
                    section.minSize = section.minSizeBackup;
                    section.maxSize = section.maxSizeBackup;
                    section.resizable = section.resizableBackup;
                    if (!section.stretch) {
                        section.initialSize = section.sizeBackup;
                    }
                }

                if (React.isValidElement(section.content)) {
                    section.content = React.cloneElement(section.content, { expanded: expand } as IComponentProperties);
                }
            } else if (expand && singleExpand) {
                // Collapse all other sections if only one can be expanded.
                if (section.expanded) {
                    section.sizeBackup = this.containerRef.current?.getPaneSize(section.id);
                    section.resizableBackup = section.resizable;
                    section.minSizeBackup = section.minSize;
                    section.maxSizeBackup = section.maxSize;

                    section.expanded = false;
                    section.minSize = 28;
                    section.maxSize = 28;
                    section.resizable = false;

                    if (React.isValidElement(section.content)) {
                        section.content = React.cloneElement(section.content,
                            { expanded: false } as IComponentProperties);
                    }
                }
            }
        });

        this.setState({ sectionDetails });

        onSectionExpand?.(this.mergedProps, props.id || "", expand);
    };

    private handleSectionAction = (actionId: string, props: IAccordionSectionProperties): void => {
        const { onSectionAction } = this.mergedProps;

        onSectionAction?.(this.mergedProps, props.id || "", actionId);
    };

    /**
     * Stores the size last set by the user as new initial size, for the given section.
     * This ensures that after collapsing/expanding we restore the last set size.
     *
     * @param first The id and size of the pane before the splitter that was resized.
     */
    private handleSectionResize = (first: ISplitterPaneSizeInfo): void => {
        const { sectionDetails } = this.state;
        const section = sectionDetails.find((entry: ISectionDetails) => {
            return entry.id === first.paneId;
        });

        if (section) {
            section.initialSize = first.size;

            const { onSectionResize } = this.mergedProps;

            onSectionResize?.(this.mergedProps, first.paneId, first.size);
        }
    };
}
