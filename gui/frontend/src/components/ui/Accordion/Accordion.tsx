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

import "./Accordion.css";

import { ComponentChild, createRef } from "preact";

import { AccordionItem } from "./AccordionItem.js";
import { Container, ContentAlignment, Orientation } from "../Container/Container.js";
import { Codicon } from "../Codicon.js";
import { AccordionSection, IAccordionSectionProperties } from "./AccordionSection.js";
import { IComponentProperties, ComponentBase } from "../Component/ComponentBase.js";
import { Label } from "../Label/Label.js";
import { ISplitterPane, SplitContainer, ISplitterPaneSizeInfo } from "../SplitContainer/SplitContainer.js";

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

interface IAccordionSection {
    id: string;
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

    sections: IAccordionSection[];

    onSectionExpand?: (props: IAccordionProperties, sectionId: string, expanded: boolean) => void;
    onSectionResize?: (props: IAccordionProperties, info: ISplitterPaneSizeInfo[]) => void;
    onSectionAction?: (props: IAccordionProperties, sectionId: string, actionId: string) => void;
}

export class Accordion extends ComponentBase<IAccordionProperties> {

    // eslint-disable-next-line @typescript-eslint/naming-convention
    public static Item = AccordionItem;

    private containerRef = createRef<SplitContainer>();

    public constructor(props: IAccordionProperties) {
        super(props);

        this.addHandledProperties("caption", "footer", "singleExpand", "sections", "onSectionExpand",
            "onSectionAction", "onSectionResize");
    }

    public render(): ComponentChild {
        const { caption, footer, sections } = this.mergedProps;

        const className = this.getEffectiveClassNames(["accordion"]);

        const panes = sections.map((section: IAccordionSection): ISplitterPane => {
            const pane = {
                id: section.id,
                initialSize: section.initialSize,
                minSize: section.minSize ?? 28,
                maxSize: section.maxSize,
                snap: true,
                stretch: section.stretch ?? false,
                resizable: section.resizable ?? false,
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

            if (!pane.expanded) {
                pane.minSize = 28;
                pane.maxSize = 28;
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
                {caption && <Label className="title">{caption}</Label>}
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
        const { onSectionExpand } = this.mergedProps;

        onSectionExpand?.(this.mergedProps, props.id || "", !props.expanded);
    };

    private handleSectionAction = (actionId: string, props: IAccordionSectionProperties): void => {
        const { onSectionAction } = this.mergedProps;

        onSectionAction?.(this.mergedProps, props.id || "", actionId);
    };

    /**
     * Stores the size last set by the user as new initial size, for the given section.
     * This ensures that after collapsing/expanding we restore the last set size.
     *
     * @param info The ids and current sizes of all panes.
     */
    private handleSectionResize = (info: ISplitterPaneSizeInfo[]): void => {
        const { onSectionResize } = this.mergedProps;

        onSectionResize?.(this.mergedProps, info);
    };
}
