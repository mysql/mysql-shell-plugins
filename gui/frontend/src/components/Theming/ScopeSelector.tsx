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

import React from "react";
import {
    Component, IComponentState, IComponentProperties, Popup, ComponentPlacement, Label, TagInput,
    Orientation, Button, ITag,
} from "../ui";
import { ValueEditDialog, IDialogValues, IDialogValidations, IDialogSection } from "../Dialogs/ValueEditDialog";
import { ThemeEditorLists } from "./ThemeEditorLists";
import { DialogResponseClosure } from "../../app-logic/Types";

export interface IScopeSelectorProperties extends IComponentProperties {
    defaultScopes: string[];
    customScopes: string[];
}

interface IScopeSelectorState extends IComponentState {
    defaultTags: ITag[];           // Tags derived from props.defaultScopes.
    currentCustomScopes: string[]; // Custom tags including user-added entries.
}

// A popup that shows lists of standard and custom scopes as tags, which can be used to assign any of them
// to a syntax color token entry in the theme editor.
export class ScopeSelector extends Component<IScopeSelectorProperties, IScopeSelectorState> {

    private newScopeDialogRef = React.createRef<ValueEditDialog>();
    private popupRef = React.createRef<Popup>();

    public constructor(props: IScopeSelectorProperties) {
        super(props);

        this.state = {
            defaultTags: props.defaultScopes.map((tag: string) => {
                return { id: tag, caption: tag };
            }),
            currentCustomScopes: props.customScopes,
        };
    }

    public componentDidUpdate(prevProps: IScopeSelectorProperties): void {
        const { customScopes } = this.props;
        if (customScopes !== prevProps.customScopes) {
            this.setState({ currentCustomScopes: customScopes });
        }
    }

    public render(): React.ReactNode {
        const { defaultTags, currentCustomScopes } = this.state;

        const customTags: ITag[] = [];
        currentCustomScopes.forEach((tag: string) => {
            if (!ThemeEditorLists.defaultScopes.includes(tag)) {
                customTags.push({
                    id: tag,
                    caption: tag,
                });
            }
        });


        return (
            <Popup
                ref={this.popupRef}
                placement={ComponentPlacement.RightCenter}
                className="scopeSelector"
            >
                <Label caption="Scope Selector" id="title" />
                <Label
                    caption={
                        "Use the collections to assign scopes to each color entry, by dragging a scope tag" +
                        " with the mouse into the associated scope field."
                    }
                    id="description"
                />
                <Label caption="Default Scopes" id="subTitle" />
                <TagInput
                    tags={defaultTags}
                    orientation={Orientation.TopDown}
                />
                <Label caption="Defined Scopes" id="subTitle" />
                <Label
                    caption={
                        "Unused scopes are automatically removed on next load of the theme, so make sure you" +
                        " use a scope at least once to keep it in this list."
                    }
                    id="description"
                />
                <TagInput
                    tags={customTags}
                    orientation={Orientation.TopDown}
                />
                <div className="footer verticalCenterContent unselectable">
                    <ValueEditDialog
                        ref={this.newScopeDialogRef}
                        caption="Enter a name for the new scope"
                        onValidate={this.validateScopeName}
                        onClose={this.defineNewScope}
                    />
                    <Button
                        caption="Define New Scope"
                        onClick={this.triggerNewScope}
                    />
                </div>
            </Popup>

        );
    }

    public open = (currentElement: HTMLElement): void => {
        this.popupRef.current?.open(currentElement.getBoundingClientRect());
    };

    /**
     * Called by the scope dialog when a new scope addition is in progress.
     *
     * @param closing True if this validation runs for the entire editing process, otherwise false.
     * @param values The value currently shown in the dialog.
     *
     * @returns An evaluation result for the input values.
     */
    private validateScopeName = (closing: boolean, values: IDialogValues): IDialogValidations => {
        const { currentCustomScopes } = this.state;

        const result: IDialogValidations = { messages: {} };
        const sectionValues = values.sections[0].values;

        let newName = sectionValues.scopeName.value as string || "";
        if (typeof newName === "string") {
            newName = newName.trim();
            if (newName.length === 0) {
                result.messages.scopeName = "The new scope name cannot be empty.";
            } else if (currentCustomScopes.includes(newName)) {
                result.messages.scopeName = "A scope with this name exists already.";
            }
        }

        return result;
    };

    /**
     * Triggered by the user to add a new syntax color scope.
     *
     * @param closure The selected action.
     * @param values The object with new theme name.
     */
    private defineNewScope = (closure: DialogResponseClosure, values: IDialogValues): void => {
        if (closure === DialogResponseClosure.Accept) {
            const { currentCustomScopes } = this.state;
            const sectionValues = values.sections[0].values;

            this.setState({
                currentCustomScopes: [sectionValues.scopeName.value as string, ...currentCustomScopes].sort(),
            });
        }
    };

    private triggerNewScope = (): void => {
        this.newScopeDialogRef.current?.show(
            {
                id: "",
                sections: new Map<string, IDialogSection>([
                    ["", {
                        values: {
                            scopeName: {
                                caption: "Name",
                                value: "",
                            },
                        },
                    }]]),
            },
            [],
        );
    };
}
