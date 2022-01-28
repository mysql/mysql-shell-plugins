/*
 * Copyright (c) 2021, Oracle and/or its affiliates.
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

import "./FileSelector.css";

import React from "react";

import { Button, Component, IComponentProperties, IInputChangeProperties, Input } from "../";
import { Container, Orientation } from "../Container/Container";
import { selectFile } from "../../../utilities/helpers";
import { requisitions } from "../../../supplement/Requisitions";

export enum FileSelectorEntryType {
    File,
    Folder,
    Link,
}

export interface IFileSelectorEntry {
    type: FileSelectorEntryType;
    name: string;
    children?: []; // For folder entry types.
}

export interface IFileSelectorProperties extends IComponentProperties {
    path: string;          // Must represent a file system URL. Other schemes are not supported.
    placeholder?: string;
    contentType?: string;  // A file extension (with leading dot) or mime type.

    canSelectFolder?: boolean; // The user can select/create a folder (default: false).
    canCreateNew?: boolean;    // The user can select a non-existing file/folder, which will then be created
    // by the caller (default: false).

    // If not specified then a platform file selector is presented to the user, to select a file/folder.
    // Otherwise the tree from this field is rendered in a custom panel.
    content?: IFileSelectorEntry[];

    // Triggered for any change in the file/path edit
    onChange?: (newValue: string, props: IFileSelectorProperties) => void;
    onConfirm?: (e: React.KeyboardEvent, props: IFileSelectorProperties) => void;
    onCancel?: (e: React.KeyboardEvent, props: IFileSelectorProperties) => void;

}

export class FileSelector extends Component<IFileSelectorProperties> {

    public static readonly defaultProps = {
        canCreateNew: false,
    };

    public constructor(props: IFileSelectorProperties) {
        super(props);

        this.addHandledProperties("value", "placeholder", "contentType", "canCreateNew", "content", "onChange",
            "onSelect");
    }

    public componentDidMount(): void {
        requisitions.register("selectFile", this.selectFile);
    }

    public componentWillUnmount(): void {
        requisitions.unregister("selectFile", this.selectFile);
    }

    public render(): React.ReactNode {
        const { path, placeholder } = this.mergedProps;

        const className = this.getEffectiveClassNames(["fileSelector"]);

        return (
            <Container
                className={className}
                orientation={Orientation.LeftToRight}
            >
                <Input
                    value={path}
                    placeholder={placeholder}
                    onChange={this.handleInputChange}
                    onConfirm={this.handleInputConfirm}
                    onCancel={this.handleInputCancel}
                />
                <Button
                    caption="..."
                    onClick={this.handleButtonClick}
                />
            </Container>
        );
    }

    private selectFile = (path: string): Promise<boolean> => {
        const { onChange } = this.mergedProps;

        // Only called in single user mode, from a native wrapper.
        const pathName = new URL(path).pathname;
        onChange?.(decodeURI(pathName), this.mergedProps);

        return Promise.resolve(true);
    };

    private handleButtonClick = async (): Promise<void> => {
        const { contentType, onChange } = this.mergedProps;

        const file = await selectFile(contentType || "", false);
        if (file && !Array.isArray(file)) {
            // Only called for remote/multi user mode.
            onChange?.(file.name, this.mergedProps);
        }
    };

    private handleInputChange = (e: React.ChangeEvent<Element>, props: IInputChangeProperties): void => {
        const { onChange } = this.mergedProps;

        onChange?.(props.value, this.mergedProps);
    };

    private handleInputConfirm = (e: React.KeyboardEvent): void => {
        const { onConfirm } = this.mergedProps;

        onConfirm?.(e, this.mergedProps);
    };

    private handleInputCancel = (e: React.KeyboardEvent): void => {
        const { onCancel } = this.mergedProps;

        onCancel?.(e, this.mergedProps);
    };
}
