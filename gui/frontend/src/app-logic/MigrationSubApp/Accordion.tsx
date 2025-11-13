/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

import { Component, JSX, VNode } from "preact";

import { Codicon } from "../../components/ui/Codicon.js";
import { Icon } from "../../components/ui/Icon/Icon.js";

export interface ISection {
    key: string;
    caption: VNode | string;
    content?: JSX.Element | null;
    expanded?: boolean;
}

export interface ISetHeight { key: string, expanded: boolean };

interface IAccordionProps {
    id: string;
    header?: VNode | string;
    sections: ISection[];
    disableSections?: boolean;

    onSectionExpand?: (key: string, expanded: boolean) => void;
}

interface IAccordionState {
    expandedSections: Set<string>;
}

export class Accordion extends Component<IAccordionProps, IAccordionState> {
    public constructor(props: IAccordionProps) {
        super(props);

        const expandedSections = new Set<string>();
        props.sections.forEach((s) => {
            if (s.expanded) {
                expandedSections.add(s.key);
            }
        });

        this.state = {
            expandedSections,
        };
    }

    public override render(): VNode {
        const { id, header, sections, disableSections, onSectionExpand } = this.props;
        const { expandedSections } = this.state;

        return (
            <div id={id} className="accordion">
                {header && <div className="header">{header}</div>}

                {sections.map(({ key, caption, content, expanded }) => {
                    let isExpanded = expanded;
                    const manuallyExpanded = expandedSections.has(key);
                    if (!onSectionExpand) {
                        isExpanded = manuallyExpanded;
                    }

                    let subHeaderClassName = `sub-header`;
                    if (disableSections) {
                        subHeaderClassName += " disabled";
                    } else {
                        subHeaderClassName += ` ${isExpanded ? "collapsible" : "expandable"}`;
                    }

                    return (
                        <div key={key} className="section" data-key={key}>
                            <div
                                className={subHeaderClassName}
                                onClick={this.onSectionCaptionClick.bind(this, key, !!isExpanded)}
                            >
                                <Icon src={isExpanded ? Codicon.ChevronDown : Codicon.ChevronRight} />
                                <div className="caption">
                                    {caption}
                                </div>
                            </div>
                            <div
                                className={`content ${isExpanded ? "expanded" : "collapsed"}`}
                            >
                                {content}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    private onSectionCaptionClick = (key: string, expanded: boolean) => {
        const { onSectionExpand: onSectionCaptionClick } = this.props;
        const { expandedSections } = this.state;

        let newExpanded: boolean;
        if (!onSectionCaptionClick) {
            if (expandedSections.has(key)) {
                newExpanded = false;
                expandedSections.delete(key);
            } else {
                newExpanded = true;
                expandedSections.add(key);
            }

            this.setState({ expandedSections });
        } else {
            newExpanded = !expanded;
            onSectionCaptionClick(key, newExpanded);
        }
    };
}
