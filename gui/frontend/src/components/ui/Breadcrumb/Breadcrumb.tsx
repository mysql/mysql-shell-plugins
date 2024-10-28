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

import "./Breadcrumb.css";

import { ComponentChild } from "preact";

import { Button } from "../Button/Button.js";
import { ComponentBase, IComponentProperties } from "../Component/ComponentBase.js";
import { Container, Orientation } from "../Container/Container.js";
import { Label } from "../Label/Label.js";

// TODO: breadcrumb picker popup for a breadcrumb item.
export interface IBreadcrumbProperties extends IComponentProperties {
    path?: string[];
    separator?: string | ComponentChild;
    selected?: number;

    onSelect?: (path: string[]) => void;
}

export class Breadcrumb extends ComponentBase<IBreadcrumbProperties> {

    public static override defaultProps = {
        path: [""],
        separator: "❯",
    };

    public constructor(props: IBreadcrumbProperties) {
        super(props);

        this.addHandledProperties("path", "separator", "selected", "onSelect");
    }

    public render(): ComponentChild {
        const { id, children, path, separator, selected } = this.props;
        const className = this.getEffectiveClassNames([
            "breadcrumb",
            "verticalCenterContent",
        ]);

        const baseId = id as string || "breadcrumb";
        let content;

        if (children != null) {
            content = children;
        } else {
            const separatorItem = typeof separator === "string"
                ? <Label className="separator" caption={separator} />
                : separator;
            content = path?.map((element: string, index: number): ComponentChild => {
                const elementId = `${baseId}${index}`;

                return (
                    <>
                        <Button
                            key={elementId}
                            id={element}
                            className={"breadcrumbItem" + (index === selected ? " selected" : "")}
                            onClick={this.handleButtonClick}
                        >
                            {element}
                        </Button>
                        {separatorItem}
                    </>
                );
            });

            if (content) {
                content.push(
                    <Button key="picker" className="picker" caption="..." />,
                );
            }
        }

        return (
            <Container
                orientation={Orientation.LeftToRight}
                className={className}
                {...this.unhandledProperties}
            >
                {content}
            </Container>
        );
    }

    private handleButtonClick = (e: MouseEvent | KeyboardEvent, props: IComponentProperties): void => {
        const parent = (e.currentTarget as HTMLElement).parentElement;
        if (parent) {
            const path: string[] = [];
            const buttons = Array.from(parent.getElementsByTagName("button"));
            for (const button of buttons) {
                path.push(button.id);
                if (button.id === props.id) {
                    break;
                }
            }

            const { onSelect } = this.props;
            onSelect?.(path);
        }
    };
}
