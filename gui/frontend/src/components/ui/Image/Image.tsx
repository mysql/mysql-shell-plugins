/*
 * Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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

import "./Image.css";

import { ComponentChild } from "preact";

import { ComponentBase, IComponentProperties, IComponentState } from "../Component/ComponentBase";

export interface IImageProperties extends IComponentProperties {
    disabled?: boolean;
    src?: string;
    alt?: string;
    width?: string | number;
    height?: string | number;

    innerRef?: preact.RefObject<HTMLImageElement>;
}

interface IImageState extends IComponentState {
    width: number;
    height: number;
}

export class Image extends ComponentBase<IImageProperties, IImageState> {

    public static defaultProps = {
        disabled: false,
    };

    public constructor(props: IImageProperties) {
        super(props);

        this.addHandledProperties("disabled", "src", "alt", "width", "height", "innerRef");
    }

    public render(): ComponentChild {
        const { disabled, src, alt, width, height, innerRef } = this.mergedProps;
        const className = this.getEffectiveClassNames([
            "image",
            this.classFromProperty(disabled, "disabled"),
        ]);

        return (
            <img
                ref={innerRef}
                className={className}
                src={src}
                alt={alt}
                width={width}
                height={height}

                {...this.unhandledProperties}
            />
        );
    }

}
