/*
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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

import { Component, ComponentChild } from "preact";

interface IHeaderProps {
    name: string,
    styleClass?: string,
    tabIndex?: number,
    onClick?: () => void;
}

/**
 * A simple Icon Component that renders an CSS inline SVG icon based on the given name.
 * For styling purposes a CSS class ${name}Style is made available.
 */
export default class Icon extends Component<IHeaderProps> {
    public render = (props: IHeaderProps): ComponentChild => {
        const { name, styleClass, tabIndex, onClick } = props;
        const styleClassName = styleClass ?? `${name}Style`;

        return (
            <div className={`icon ${styleClassName}`}
                onClick={(onClick !== undefined) ? () => { onClick(); } : undefined}
                onKeyPress={ () => { /** */ }} role="button" tabIndex={tabIndex}>
                <div className={`iconBg ${name}`} ></div >
            </div >
        );
    };
}
