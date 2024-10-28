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

import { ComponentChild, VNode } from "preact";

import { Container, ContentAlignment } from "../Container/Container.js";
import { IDictionary } from "../../../app-logic/general-types.js";
import { Codicon } from "../Codicon.js";
import { IComponentProperties, ComponentBase } from "../Component/ComponentBase.js";
import { Icon } from "../Icon/Icon.js";
import { Label } from "../Label/Label.js";
import { Image } from "../Image/Image.js";
import { KeyboardKeys } from "../../../utilities/helpers.js";

export interface IAccordionItemProperties extends IComponentProperties {
    caption: string;
    picture?: string | Codicon | VNode<Icon | Image>;
    active?: boolean;
    closable?: boolean;

    payload?: IDictionary;

    onClose?: (e: MouseEvent | KeyboardEvent, itemId?: string) => void;
}

export class AccordionItem extends ComponentBase<IAccordionItemProperties> {

    public constructor(props: IAccordionItemProperties) {
        super(props);

        this.state = {
            active: false,
        };

        this.addHandledProperties("caption", "icon", "active", "closable", "onClose");
    }

    public render(): ComponentChild {
        const { caption, picture, active, closable } = this.props;
        const className = this.getEffectiveClassNames([
            "accordionItem",
            this.classFromProperty(active, "selected"),
            this.classFromProperty(closable, "closable"),
        ]);

        let actualPicture;
        if (picture) {
            if (typeof picture === "string") {
                actualPicture = <Image src={picture} width="20px" height="20px" />;
            } else if (typeof picture === "number") {
                actualPicture = <Icon src={picture} width="20px" height="20px" />;
            } else {
                actualPicture = picture;
            }
        }

        return (
            <Container
                className={className}
                tabIndex={0}
                crossAlignment={ContentAlignment.Center}
                {...this.unhandledProperties}
            >
                {closable &&
                    <span
                        className="codicon codicon-close"
                        role="button"
                        tabIndex={0}
                        data-tooltip="Close Editor"
                        onKeyPress={this.handleCloseKeyPress}
                        onClick={this.handleCloseClick}
                    />
                }
                {actualPicture}
                <Label>{caption}</Label>
            </Container>
        );
    }

    private handleCloseKeyPress = (e: KeyboardEvent): void => {
        const key = e.key;
        if (key === KeyboardKeys.Space || key === KeyboardKeys.Enter) {
            e.stopPropagation();

            const { onClose } = this.props;
            onClose?.(e, this.props.id);
        }
    };

    private handleCloseClick = (e: MouseEvent): void => {
        e.stopPropagation();

        const { onClose } = this.props;
        onClose?.(e, this.props.id);
    };
}
