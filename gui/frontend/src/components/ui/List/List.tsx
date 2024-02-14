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

import "./List.css";

import { cloneElement, ComponentChild, VNode } from "preact";

import { ComponentBase, IComponentProperties } from "../Component/ComponentBase.js";

interface IListProperties extends IComponentProperties {
    /** The UI structure to render for each element. */
    template: VNode;

    /** A list of objects with data to fill in. */
    elements: object[];
}

/**
 * This list class renders all items upfront and can hence be used to show complex entries and standard
 * ordered and unordered lists.
 * For a virtual list component see DynamicList.
 */
export class List extends ComponentBase<IListProperties> {

    public constructor(props: IListProperties) {
        super(props);

        this.addHandledProperties("template", "elements");
    }

    public render(): ComponentChild {
        const { id, template, elements } = this.props;

        const content: ComponentChild[] = [];
        const baseId = (id as string) ?? "list";
        let index = 0;
        elements.forEach((element): void => {
            const elementId = `${baseId}${index++}`;
            const child = cloneElement(template, {
                id: elementId,
                key: elementId,
                data: element,
            });

            content.push(<li key={elementId}>{child}</li>);
        });

        const className = this.getEffectiveClassNames(["list"]);

        return (
            <ul
                className={className}
                {...this.unhandledProperties}
            >
                {content}
            </ul>
        );
    }

}
