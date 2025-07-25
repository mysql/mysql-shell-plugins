/*
 * Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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

import "./FileSelector.css";

import { ComponentChild } from "preact";

import { appParameters } from "../../../supplement/AppParameters.js";
import { IOpenDialogFilters, IOpenFileDialogResult } from "../../../supplement/RequisitionTypes.js";
import { requisitions } from "../../../supplement/Requisitions.js";
import { selectFileInBrowser } from "../../../utilities/helpers.js";
import { Button } from "../Button/Button.js";
import { ComponentBase, IComponentProperties } from "../Component/ComponentBase.js";
import { Container, Orientation } from "../Container/Container.js";
import { IInputChangeProperties, Input } from "../Input/Input.js";

enum FileSelectorEntryType {
    File,
    Folder,
    Link,
}

interface IFileSelectorEntry {
    type: FileSelectorEntryType;
    name: string;
    children?: IFileSelectorEntry[]; // For folder entry types.
}

export interface IFileSelectorProperties extends IComponentProperties {
    // Must represent a file system object. Other schemes are not supported.
    path: string;

    // If true, actually read the file. In that case, its path cannot be
    // specified manually, but the file must be selected from a separate dialog.
    doRead?: boolean;

    // Text to show in the input, if nothing is selected yet.
    placeholder?: string;

    // A title for the open dialog. Not shown on all platforms.
    title?: string;

    // The text to be used for the open button in the open dialog. Only used in embedded scenarios.
    openLabel?: string;

    // A collection of file extensions (w/o leading dot or wildcard) under a descriptive name, like
    //  "Images": ["png", "jpg"]
    //  "TypeScript": ["ts", "tsx"].
    // Additionally mime types are supported (only used in browser mode). For example:
    //   "mime": ["audio/*", "image/png"].
    filters?: IOpenDialogFilters;

    // The user can select/create files (default: true). Only used in embedded mode.
    canSelectFiles?: boolean;

    // The user can select/create folders (default: false). Only used in embedded mode.
    canSelectFolders?: boolean;

    // The user can select a non-existing file/folder, which will then be created by the caller (default: false).
    // Only used in embedded mode.
    canCreateNew?: boolean;

    // Multiple objects can be selected (default: false).
    multiSelection?: boolean;

    // If not specified then a platform open dialog is presented to the user.
    // Otherwise the tree from this field is rendered in a custom panel.
    content?: IFileSelectorEntry[];

    // Triggered for any change in the file/path edit
    onChange?: (newValues: File[], props: IFileSelectorProperties) => void;
    onConfirm?: (e: KeyboardEvent, props: IFileSelectorProperties) => void;
    onCancel?: (e: KeyboardEvent, props: IFileSelectorProperties) => void;
}

/**
 * An input field with a button to show/select files and folders. It uses the HTML open dialog in browser mode,
 * otherwise the host provides a native open dialog.
 */
export class FileSelector extends ComponentBase<IFileSelectorProperties> {

    public static override readonly defaultProps = {
        canSelectFiles: true,
        canSelectFolder: false,
        canCreateNew: false,
        multiSelection: false,
    };

    public constructor(props: IFileSelectorProperties) {
        super(props);

        this.addHandledProperties("value", "placeholder", "title", "openLabel", "filters", "canSelectFiles",
            "canSelectFolder", "canCreateNew", "multiSelection", "content",
            "onChange", "onConfirm", "onSelect");
    }

    public override componentDidMount(): void {
        requisitions.register("selectFile", this.selectFile);
    }

    public override componentWillUnmount(): void {
        requisitions.unregister("selectFile", this.selectFile);
    }

    public render(): ComponentChild {
        const { path, placeholder, id, canSelectFolders, doRead } = this.props;

        const className = this.getEffectiveClassNames(["fileSelector"]);

        // XXX: render custom content tree.
        return (
            <Container
                className={className}
                orientation={Orientation.LeftToRight}
            >
                <Input
                    id={id}
                    value={path}
                    placeholder={placeholder}
                    onChange={this.handleInputChange}
                    onConfirm={this.handleInputConfirm}
                    onCancel={this.handleInputCancel}
                    readOnly={doRead === true} // disable input field when actual File reading is necessary
                />
                {(!canSelectFolders || appParameters.embedded) && <Button
                    id={id && `${id}Btn`}
                    caption="..."
                    onClick={this.handleButtonClick}
                />}
            </Container>
        );
    }

    private selectFile = (openFileResult: IOpenFileDialogResult): Promise<boolean> => {
        const { id, onChange } = this.props;

        if (id !== openFileResult.resourceId) {
            return Promise.resolve(false);
        }
        // Only called in single user mode, from a native wrapper or VS Code.
        const result = openFileResult.file.map((value) => {
            const uint8Array = new Uint8Array(value.content);

            return new File([uint8Array], value.path);
        });
        onChange?.(result, this.props);

        return Promise.resolve(true);
    };

    private handleButtonClick = (): void => {
        const {
            path, title, openLabel, canSelectFiles = true, canSelectFolders, filters, multiSelection = false, onChange,
            id, doRead,
        } = this.props;

        if (appParameters.embedded) {
            // called when native file dialog is shown
            const options = {
                id,
                default: path,
                title,
                canSelectFiles,
                canSelectFolders,
                canSelectMany: multiSelection,
                filters,
                openLabel,
            };
            if(doRead === true){
                requisitions.executeRemote("showOpenDialogWithRead", options);
            } else {
                requisitions.executeRemote("showOpenDialog", options);
            }
        } else {
            // called if it's opening a browser file dialog
            const contentType: string[] = [];
            if (filters) {
                Object.values(filters).forEach((extensions: string[]) => {
                    contentType.push(...extensions.map((value) => { return `.${value}`; }));
                });
            }

            void selectFileInBrowser(contentType, multiSelection).then((result) => {
                if (result) {
                    onChange?.(result, this.props);
                } else {
                    onChange?.([], this.props);
                }
            });
        }
    };

    private handleInputChange = (e: InputEvent, props: IInputChangeProperties): void => {
        const { onChange } = this.props;
        const inputElement = e.target as HTMLInputElement;
        const files = inputElement.files;
        if (files) {
            onChange?.(Array.from(files), this.props);
        } else {
            // Create a File object from the input value
            const filePath = inputElement.value;
            // You can't directly create a File object from a file path due to security restrictions
            // Instead, you can create a new File object with the given path, but this won't actually read the file
            const file = new File([], filePath, { type: "application/octet-stream" });
            onChange?.([file], this.props);
        }
    };

    private handleInputConfirm = (e: KeyboardEvent): void => {
        const { onConfirm } = this.props;

        onConfirm?.(e, this.props);
    };

    private handleInputCancel = (e: KeyboardEvent): void => {
        const { onCancel } = this.props;

        onCancel?.(e, this.props);
    };
}
