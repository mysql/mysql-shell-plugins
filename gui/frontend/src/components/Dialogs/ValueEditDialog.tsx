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

import addProperty from "../../assets/images/add.svg";
import removeProperty from "../../assets/images/remove.svg";
import "./ValueEditDialog.css";

import { cloneElement, ComponentChild, createRef, render, VNode } from "preact";
import { Children } from "preact/compat";
import { ColumnDefinition, RowComponent, type CellComponent } from "tabulator-tables";

import { DialogResponseClosure, MessageType, type IDictionary } from "../../app-logic/general-types.js";
import { type IOpenDialogFilters } from "../../supplement/RequisitionTypes.js";
import { Button, type IButtonProperties } from "../ui/Button/Button.js";
import { Checkbox, CheckState, type ICheckboxProperties } from "../ui/Checkbox/Checkbox.js";
import { Codicon } from "../ui/Codicon.js";
import {
    ComponentBase, SelectionType, type IComponentProperties, type IComponentState,
} from "../ui/Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../ui/Container/Container.js";
import { Dialog } from "../ui/Dialog/Dialog.js";
import { Dropdown } from "../ui/Dropdown/Dropdown.js";
import { DropdownItem } from "../ui/Dropdown/DropdownItem.js";
import { FileSelector, type IFileSelectorProperties } from "../ui/FileSelector/FileSelector.js";
import { Grid } from "../ui/Grid/Grid.js";
import { GridCell } from "../ui/Grid/GridCell.js";
import { Icon } from "../ui/Icon/Icon.js";
import { Input, type IInputChangeProperties, type IInputProperties } from "../ui/Input/Input.js";
import { Label } from "../ui/Label/Label.js";
import { Menu } from "../ui/Menu/Menu.js";
import { MenuItem, type IMenuItemProperties } from "../ui/Menu/MenuItem.js";
import { Message } from "../ui/Message/Message.js";
import type { IPortalOptions } from "../ui/Portal/Portal.js";
import { ProgressIndicator } from "../ui/ProgressIndicator/ProgressIndicator.js";
import { Tabview, type ITabviewPage } from "../ui/Tabview/Tabview.js";
import { TreeGrid, type ITreeGridOptions } from "../ui/TreeGrid/TreeGrid.js";
import { UpDown, type IUpDownProperties } from "../ui/UpDown/UpDown.js";
import { ParamDialog } from "./ParamDialog.js";
import { ValueEditCustom, type IValueEditCustomProperties } from "./ValueEditCustom.js";

interface IContextUpdateData {
    add?: string[];
    remove?: string[];
}

/** Lists in the dialog use templated data. */
interface IDialogListEntry {
    [key: string]: IComponentProperties;
}

export type DialogValueType = number | bigint | string | boolean | string[] | IDictionary;

/** A collection of flags that influence the way a value is displayed or modifies its behavior. */
export enum CommonDialogValueOption {
    /** The value is currently not editable. */
    ReadOnly,

    /** The value shows up in a dimmed fashion. */
    Disabled,

    /** When set focus an element and select all content. This flag can only be used in one value definition. */
    AutoFocus,

    /** If set then this value is grouped with all following using the same flag, into a single grid cell. */
    Grouped,

    /** Set to break two consecutive groups apart (set on first member). */
    NewGroup,

    /** If the control should be hidden. */
    Hidden,
}

/** Contains fields that are common to all dialog values. */
interface IBaseDialogValue {
    /** The discriminator for the different value types. */
    type: string;

    caption?: string;
    options?: CommonDialogValueOption[];

    /** Provides a description specific to this value, which will be rendered as part of the value. */
    description?: string;

    /** A value between 1 and 8 for the grid cells to span horizontally (default: 4). */
    horizontalSpan?: number;

    /** Determines how many grid rows a value should take. Must be greater than 0 and an integer (default: 1). */
    verticalSpan?: number;
}

/**
 * This dialog value is the only one which supports no interaction. Instead it represents a description text, which
 * takes the same place like any other dialog value (can span cells, flows with the cells etc.).
 */
interface IDescriptionDialogValue extends IBaseDialogValue {
    type: "description";

    value?: string;
}

/**
 * This value represents a button for triggering additional functionality, outside of the current dialog
 * (e.g. to store a password or open a sub dialog).
 */
interface IButtonDialogValue extends IBaseDialogValue {
    type: "button";

    value?: string;

    /** Called when the button is clicked. The passed in id is what was used to define the button value entry. */
    onClick?: (id: string, values: IDialogValues, dialog: ValueEditDialog) => void;
}

/** Represents a single string input value (including obfuscated input). */
export interface IStringInputDialogValue extends IBaseDialogValue {
    type: "text";

    value?: string;

    /** Text to be shown in the input field, if no value is set yet. */
    placeholder?: string;

    /** The value is a multi line string and needs a larger input control. */
    multiLine?: boolean;
    multiLineCount?: number;

    /** The value is security sensitive and must be obfuscated (e.g. passwords or PINs). */
    obfuscated?: boolean;

    /**
     * A special feature for text fields: set this to true to show an indeterminate progress indicator
     * to denote a long lasting operation to get the actual value.
     */
    showLoading?: boolean;

    /** Called when the value was changed. */
    onChange?: (value: string, dialog: ValueEditDialog) => void;

    /** Called when the input field lost focus. */
    onFocusLost?: (value: string, dialog: ValueEditDialog) => void;
}

/** Represents a single numeric input value, which is rendered as an up-down spinner control. */
interface INumberInputDialogValue extends IBaseDialogValue {
    type: "number";

    value?: number | bigint;

    /** The minimum number possible in this field. */
    min?: number | bigint;

    /** The maximum number possible in this field. */
    max?: number | bigint;

    /** Called when the value was changed. */
    onChange?: (value: number | bigint, dialog: ValueEditDialog) => void;

    /** Called when the input field lost focus. */
    onFocusLost?: (value: number | bigint, dialog: ValueEditDialog) => void;
}

/** Represents a single boolean input value, which is rendered as a checkbox control. */
interface IBooleanInputDialogValue extends IBaseDialogValue {
    type: "boolean";

    value?: boolean;

    label?: string;

    /** Called when the value was changed. */
    onChange?: (value: boolean, dialog: ValueEditDialog) => void;
}

/** A dialog value which represents a single entry out of a list of possible values. */
export interface IChoiceDialogValue extends IBaseDialogValue {
    type: "choice";

    value?: string;

    /** Only one of the list of choices is possible. */
    choices: string[];

    /** If set also no choice is a viable result. */
    optional?: boolean;

    /** Called when the selection was changed. */
    onChange?: (value: string, dialog: ValueEditDialog) => void;
}

/** A dialog value which represents a set of (string) values out of a set of possible values. */
interface ISetDialogValue extends IBaseDialogValue {
    type: "set";

    value?: string[];

    /** Any combination of entries in the list, represented as tags. */
    tagSet: string[];

    /** Called when the selection was changed. */
    onChange?: (values: string[], dialog: ValueEditDialog) => void;
}

/** A dialog value which represents a simple key/value store. Both, keys and values must be strings. */
interface IKeyValueDialogValue extends IBaseDialogValue {
    type: "matrix";

    value?: IDictionary[];

    /** Called when the selection was changed. */
    onChange?: (value: string, dialog: ValueEditDialog) => void;
}

/** A dialog value which represents a file/folder selection. */
interface IResourceDialogValue extends IBaseDialogValue {
    type: "resource";

    value?: string;

    /** Text to be shown in the input field, if no value is set yet. */
    placeholder?: string;

    /**Used to limit user selectable files. */
    filters?: IOpenDialogFilters;

    multiSelection?: boolean;
    canSelectFiles?: boolean;
    canSelectFolders?: boolean;

    /** Called when the selection was changed. */
    onChange?: (value: string, dialog: ValueEditDialog) => void;
}

/**
 * Similar to "set" this value represents a selection from a list of available values. However, with this type
 * no tag set is used but a list of check boxes.
 *
 * TODO: the list of available values consists currently of component properties, which describe how the checkboxes
 * have to be render. Change that to avoid the need for explicit component details in the dialog definition.
 */
export interface ICheckListDialogValue extends IBaseDialogValue {
    type: "checkList";

    value?: string[];

    /** Any combination of entries in the list, represented as a list of checkboxes. */
    checkList: IDialogListEntry[];

    /** Called when one of the value was changed. */
    onChange?: (value: boolean, dialog: ValueEditDialog) => void;
}

/**
 * A dialog value which represents an object to be edited, which relates the object keys to other dialog values
 * in the same section, with a simpler type. This value type is shown as overview list, from which the current
 * set of values that are to be edited is selected.
 */
export interface IRelationDialogValue extends IBaseDialogValue {
    type: "relation";

    value?: IDictionary[];

    /**
     * Maps the keys of each entry to another dialog value in the same section, creating so a relation between
     * a sub value to an editor somewhere else.
     */
    relations: { [key: string]: string; };

    /** The id of the current entry in the relations object. Only one set of values can be edited at a time. */
    active?: string | number;

    /** The fields shown in the overview list as individual columns. Default is ["title"]. */
    listItemCaptionFields?: string[];

    /** The name of the item in the relations objects that denotes the `id` field (default is "id"). */
    listItemId?: string;

    /** Called when the selection was changed. */
    onChange?: (value: string, dialog: ValueEditDialog) => void;
}

/**
 * This dialog value serves as placeholder for additional content, which either just visualizes something based on other
 * content or is a complex editor with own functionality.
 *
 * This value type does not participate in the automatic validation handling.
 */
export interface ICustomDialogValue extends IBaseDialogValue {
    type: "custom",
    value?: IDictionary,
    component: (
        VNode<ValueEditCustom<IValueEditCustomProperties, IComponentState>>
        | (() => VNode<ValueEditCustom<IValueEditCustomProperties, IComponentState>>)
    );
}

type IDialogValue =
    IDescriptionDialogValue
    | IChoiceDialogValue
    | IResourceDialogValue
    | IRelationDialogValue
    | IStringInputDialogValue
    | INumberInputDialogValue
    | IBooleanInputDialogValue
    | IButtonDialogValue
    | ICheckListDialogValue
    | ISetDialogValue
    | IKeyValueDialogValue
    | ICustomDialogValue
    ;

/** A set of keys and their associated values, which can be edited in this dialog. */
export interface IDialogSection {
    /** The caption of the context. */
    caption?: string;

    /** All contexts in this list must be currently active to make the section visible. */
    contexts?: string[];

    /** Place all sections with the same group name into a tabview. */
    groupName?: string;

    /** If this section is grouped and the currently visible page, this value is true. */
    active?: boolean;

    /** If this section is grouped and current visible, make its content grid fill the entire page. */
    expand?: boolean;

    values: {
        [key: string]: IDialogValue;
    };
}

/**
 * A collection of settings grouped into sections, each with an own optional caption.
 * The same interface is used for validation and return values.
 */
export interface IDialogValues {
    /** An identification for the dialog invocation. */
    id?: string;
    sections: Map<string, IDialogSection>;
}

/**
 * Contains a set of validation messages for dialog value keys that did not proof ok.
 * These messages are shown below the input field for that dialog value.
 */
export interface IDialogValidations {
    requiredContexts?: string[];
    messages: { [key: string]: string; };
}

interface IDialogValuePair {
    key: string;
    value: IDialogValue;
}

/** Holds the relations for data keys bound to a relational list. */
interface IRelatedValues {
    /** The name of the relational list entry in the data definition. */
    source: string;

    /**
     * Mappings from value keys in the data definition to their actual values in the relational list
     * and the name of the member in the relational list.
     */
    relations: Map<string, [DialogValueType, string]>;
}

/** A collection of values to configure the invocation of the value editor. */
export interface IValueEditDialogShowOptions {
    /** The dialog contexts that should be active initially. */
    contexts?: string[];

    /** Options to send to the underlying dialog portal. */
    options?: IPortalOptions;

    /** The title of the dialog. */
    title?: string;

    /** A main caption. */
    heading?: string;

    /** A list of strings to describe the information that must be entered. */
    description?: string[];

    /** If set to true the dialog will auto resize based on the window size */
    autoResize?: boolean;
}

interface IValueEditDialogProperties extends IComponentProperties {
    /** A node where to mount the dialog to (default: <body>). */
    container?: HTMLElement;

    advancedActionCaption?: string;
    customFooter?: ComponentChild;

    advancedAction?: (values: IDialogValues, props: IButtonProperties) => void;
    onValidate?: (closing: boolean, values: IDialogValues, data?: IDictionary) => IDialogValidations;
    onClose?: (closure: DialogResponseClosure, values: IDialogValues, data?: IDictionary) => void;
    onToggleAdvanced?: (checked: boolean) => void;
    onSelectTab?: (id: string) => void;
}

export interface IValueEditDialogState extends IComponentState {
    title?: string;
    heading?: string;
    description?: string[];
    values: IDialogValues;
    validations: IDialogValidations;
    preventConfirm: boolean;
    actionText?: string;
    autoResize?: boolean;

    /** A list of ids that allow conditional rendering of sections and values. */
    activeContexts: Set<string>;

    /** Additional data directly passed through from the caller to the receiver. */
    data?: IDictionary;
}

/** A dialog to let the user enter values and to validate them. */
export class ValueEditDialog extends ComponentBase<IValueEditDialogProperties, IValueEditDialogState> {

    private dialogRef = createRef<Dialog>();
    private paramDialogRef = createRef<ParamDialog>();
    private relationListContextMenuRef = createRef<Menu>();

    // Counts to negative infinity, to produce unique IDs for new relation list entries.
    private relationListCounter = -1;

    public constructor(props: IValueEditDialogProperties) {
        super(props);

        this.state = {
            validations: { messages: {} },
            values: {
                id: "",
                sections: new Map(),
            },
            activeContexts: new Set(),
            preventConfirm: false,
        };

        this.addHandledProperties("container", "advancedAction", "advancedActionCaption",
            "customFooter", "onClose", "onValidate", "onToggleAdvanced");
    }

    public render(): ComponentChild {
        const { container, advancedActionCaption, advancedAction, customFooter } = this.props;
        const {
            title, heading, actionText, description, validations, activeContexts, values, preventConfirm, autoResize,
        } = this.state;

        // Take over any context that is now required to show up due to validation issues.
        if (validations.requiredContexts && validations.requiredContexts.length > 0) {
            validations.requiredContexts.forEach((context) => {
                activeContexts.add(context);
            });
            validations.requiredContexts = undefined;
        }

        const className = this.getEffectiveClassNames(["valueEditDialog", autoResize ? "autoResize" : undefined]);
        const groups = this.renderGroups();

        const customActions = [];
        if (advancedActionCaption && advancedActionCaption.length > 0) {
            if (advancedAction) {
                customActions.push(
                    <Button
                        caption={actionText ?? advancedActionCaption}
                        id="advanced-btn"
                        onClick={this.advancedBtnClick}
                    />);
            } else {
                customActions.push(
                    <Checkbox
                        id="show-advanced"
                        caption={advancedActionCaption}
                        checkState={activeContexts.has("advanced") ? CheckState.Checked : CheckState.Unchecked}
                        onChange={this.advancedCheckboxChange}
                    />,
                );
            }
        }

        if (customFooter) {
            customActions.push(customFooter);
        }

        const descriptionLabels: ComponentChild[] = [];
        description?.forEach((value, index) => {
            descriptionLabels.push(
                <Label
                    id={`caption${index}`}
                    language="text"
                    caption={value}
                />,
            );
        });

        const descriptionContent = description ?
            <Container orientation={Orientation.TopDown}>
                <Container
                    orientation={Orientation.TopDown}
                    className="dialogDescription">
                    {descriptionLabels}
                </Container>
            </Container> : undefined;


        let header;
        if (heading) {
            header = <Container orientation={Orientation.TopDown}>
                <Label id="dialogHeading" caption={heading} />
            </Container>;
        }

        return (
            <>
                <Dialog
                    ref={this.dialogRef}
                    container={container}
                    id={values.id}
                    className={className}
                    caption={
                        <>
                            <Icon src={Codicon.Terminal} />
                            <Label>{title}</Label>
                        </>
                    }
                    header={header}
                    actions={{
                        begin: customActions,
                        end: [
                            <Button
                                caption="OK"
                                id="ok"
                                key="ok"
                                disabled={Object.keys(validations.messages).length > 0 || preventConfirm}
                                onClick={this.handleActionClick}
                            />,
                            <Button
                                caption="Cancel"
                                id="cancel"
                                key="cancel"
                                onClick={this.handleActionClick}
                            />,
                        ],
                    }}
                    content={
                        <Grid
                            columns={8}
                            rowGap={16}
                            columnGap={16}
                            id="contentGrid"
                        >
                            {descriptionContent && <GridCell columnSpan={8} className="dialogDescriptionCell">
                                {descriptionContent}</GridCell>}
                            {groups}
                        </Grid>
                    }
                    onClose={this.handleClose}

                    {...this.unhandledProperties}
                >
                </Dialog>
                <Menu
                    ref={this.relationListContextMenuRef}
                    onItemClick={this.handleRelationListContextMenuItemClick}
                >
                    <MenuItem command={{ title: "Remove Selected Entry", command: "removeEntry" }} />
                </Menu>
            </>
        );
    }

    /**
     * Makes the dialog visible with the given dialog values set.
     *
     * @param values The values to use to layout and initially fill the dialog.
     * @param dialogOptions Details for the appearance of the dialog.
     * @param data Anything that should be passed to the validation and close functions.
     */
    public show = (values?: IDialogValues, dialogOptions?: IValueEditDialogShowOptions, data?: IDictionary): void => {
        const activeContexts = new Set(dialogOptions?.contexts);

        // Keep the advanced state/context if it was set before.
        if (this.state.activeContexts.has("advanced")) {
            activeContexts.add("advanced");
        }

        this.setState({
            title: dialogOptions?.title,
            heading: dialogOptions?.heading,
            description: dialogOptions?.description,
            values,
            activeContexts,
            validations: { messages: {} },
            data,
            autoResize: dialogOptions?.autoResize,
        }, () => {
            return this.dialogRef.current?.open(dialogOptions?.options);
        });
    };

    /**
     * Updates the active contexts that are used during dialog rendering.
     *
     * @param contexts A structure to specify which contexts must be added and/or removed.
     */
    public updateActiveContexts = (contexts: IContextUpdateData): void => {
        const { activeContexts } = this.state;

        contexts.add?.forEach((context) => {
            activeContexts.add(context);
        });

        contexts.remove?.forEach((context) => {
            activeContexts.delete(context);
        });

        this.setState({ activeContexts });
    };

    public updateInputValue = (value: string, id: string): void => {
        const { values, data } = this.state;

        values.sections.forEach((section) => {
            const entry = section.values[id];
            if (entry && (entry.type === "text" || entry.type === "choice")) {
                entry.value = value;
                if (entry.type === "text") {
                    entry.showLoading = false;
                }

                const { onValidate } = this.props;
                const validations = onValidate?.(false, values, data) || { messages: {} };
                this.setState({ values, validations });

                return;
            }
        });
    };

    public changeAdvActionText = (actionText?: string): void => {
        this.setState({ actionText });
    };

    public updateDropdownValue = (items: string[], active: string, id: string): void => {
        const { values, data } = this.state;

        values.sections.forEach((section) => {
            const entry = section.values[id];
            if (entry?.type === "choice") {
                entry.choices = items;
                entry.value = active;

                const { onValidate } = this.props;
                const validations = onValidate?.(false, values, data) || { messages: {} };
                this.setState({ values, validations });

                return;
            }
        });
    };

    public beginValueUpdating = (value: string, id: string): void => {
        const { values, data } = this.state;

        values.sections.forEach((section) => {
            const entry = section.values[id];
            if (entry?.type === "text") {
                entry.value = value;
                entry.showLoading = true;

                const { onValidate } = this.props;
                const validations = onValidate?.(false, values, data) || { messages: {} };
                this.setState({ values, validations });
            }
        });
    };

    public preventConfirm = (preventConfirm: boolean): void => {
        this.setState({ preventConfirm });
    };

    public getDialogValues = (): IDialogValues => {
        const { values } = this.state;

        return values;
    };

    public setDialogValues = (values: IDialogValues): void => {
        this.setState({ values });
    };

    /**
     * Renders all defined sections into groups. A section without a group name renders as single entry into a group.
     *
     * @returns The generated list of groups.
     */
    private renderGroups = (): ComponentChild[] => {
        const { onSelectTab } = this.props;
        const { values, activeContexts } = this.state;

        interface ISectionNodePair { caption?: string; node: ComponentChild; section: IDialogSection; }
        interface ISectionGroup { nodes: ISectionNodePair[]; active?: string; expand?: boolean; }

        const sectionGroups: ISectionGroup[] = [];
        let currentGroup = "";
        values.sections.forEach((section: IDialogSection, sectionId: string) => {
            const missingContexts = (section.contexts || []).filter((value: string) => {
                return !activeContexts.has(value);
            });

            // Ignore this section if any of its contexts does not exist in the active context list.
            if (missingContexts.length > 0) {
                return;
            }

            const node = this.renderSection(sectionId, section);

            // Is this section grouped?
            if (!section.groupName || section.groupName.length === 0) {
                // No group used for this section.
                sectionGroups.push({ nodes: [{ caption: section.caption, node, section }] });
                currentGroup = ""; // Also stop any ongoing group.
            } else {
                // Section is a group. Does it belong to the current group?
                if (section.groupName === currentGroup) {
                    // Yes, same group - add it.
                    const group = sectionGroups[sectionGroups.length - 1];
                    group.nodes.push({ caption: section.caption, node, section });
                    if (section.active) {
                        group.active = `page${(group.nodes.length - 1)}`;
                    }
                    if (section.expand) {
                        group.expand = true;
                    }
                } else {
                    // No, start a new group.
                    let active;
                    if (section.active) {
                        active = "page0";
                    }
                    sectionGroups.push({ nodes: [{ caption: section.caption, node, section }], active });
                    currentGroup = section.groupName;
                }
            }
        });

        const groups = sectionGroups.map((group: ISectionGroup, index: number): ComponentChild => {
            if (group.nodes.length === 1) {
                // Render single sections directly.
                return group.nodes[0].node;
            }

            // Otherwise place the sections on a tabview.
            const active = (group.active?.length ?? 0) > 0 ? group.active : "page0";
            const pages = group.nodes.map((pair: ISectionNodePair, pageIndex: number): ITabviewPage => {
                return {
                    id: `page${pageIndex}`,
                    caption: pair.caption ?? "No Title",
                    content:
                        <Grid
                            columns={8}
                            rowGap={16}
                            columnGap={16}
                            className={this.classFromProperty(pair.section.expand, "expand")}
                        >
                            {pair.node}
                        </Grid>,
                };
            });

            return (
                <GridCell
                    key={`group${index}`}
                    columnSpan={8}
                >
                    <Tabview
                        pages={pages}
                        selectedId={active}
                        onSelectTab={(id: string): void => {
                            let selected = "";
                            group.nodes.forEach((node, nodeIndex) => {
                                if ((`page${nodeIndex}`) === id) {
                                    node.section.active = true;
                                    selected = node.caption ?? "";
                                } else {
                                    node.section.active = false;
                                }
                            });
                            onSelectTab?.(selected);
                            this.forceUpdate();
                        }}
                    >
                    </Tabview>
                </GridCell>
            );
        });

        return groups;
    };

    /**
     * Renders all entries of the given dialog section as a list of grid cells.
     *
     * @param sectionId The name/id of the section.
     * @param section The section definition.
     *
     * @returns The list of grid cells.
     */
    private renderSection = (sectionId: string, section: IDialogSection): ComponentChild => {
        const result = [];

        // Render caption only if this section is not grouped.
        if (section.caption && (!section.groupName || section.groupName.length === 0)) {
            result.push(
                <GridCell key={section.caption} columnSpan={8}>
                    <Label className="sectionTitle" caption={section.caption} />
                </GridCell>,
            );
        }

        const keys = Object.keys(section.values);

        // Collect values from relational definitions, which is used to set values of the related edits.
        const relatedValues: IRelatedValues = {
            source: "",
            relations: new Map<string, [DialogValueType, string]>(),
        };

        keys.forEach((key) => {
            const value = section.values[key];
            if (value.type === "relation" && value.value && value.value.length > 0) {
                const entries = value.value;
                const active = value.active ?? entries[0].id;
                const activeData = entries.find((entry) => {
                    return entry.id === active;
                });

                if (activeData) {
                    relatedValues.source = key;
                    for (const entry of Object.entries(value.relations)) {
                        relatedValues.relations.set(entry[1], [activeData[entry[0]] as DialogValueType, entry[0]]);
                    }
                }
            }
        });

        let i = 0;

        while (i < keys.length) {
            const group: IDialogValuePair[] = [];
            let key = keys[i++];
            let value = section.values[key];

            group.push({ key, value });

            // Collect grouped values.
            if (value.options?.includes(CommonDialogValueOption.Grouped)) {
                while (i < keys.length) {
                    key = keys[i];
                    value = section.values[key];
                    if (!value.options?.includes(CommonDialogValueOption.Grouped)
                        || value.options?.includes(CommonDialogValueOption.NewGroup)) {
                        break;
                    }

                    ++i;
                    group.push({ key, value });
                }

            }

            result.push(this.renderDialogValueGroup(i, group, sectionId, relatedValues));
        }

        return result;
    };

    /**
     * Renders a list of values into a single grid cell, including a potential caption.
     *
     * @param index The group/value index.
     * @param group The list of elements in the group.
     * @param sectionId The name/id of the section which is currently being rendered.
     * @param relatedValues A map with dialog value names and values that are taken from a relational value.
     *
     * @returns The rendered node.
     */
    private renderDialogValueGroup = (index: number, group: IDialogValuePair[], sectionId: string,
        relatedValues: IRelatedValues): ComponentChild => {

        const { validations } = this.state;

        const result = [];

        // Search for the largest spans in the group, which is then used for the entire cell.
        let groupHorizontalSpan: number | undefined;
        let groupVerticalSpan: number | undefined;
        group.forEach((pair: IDialogValuePair) => {
            if (!groupHorizontalSpan) {
                groupHorizontalSpan = pair.value.horizontalSpan;
            } else if (pair.value.horizontalSpan && pair.value.horizontalSpan > groupHorizontalSpan) {
                groupHorizontalSpan = pair.value.horizontalSpan;
            }

            if (!groupVerticalSpan) {
                groupVerticalSpan = pair.value.verticalSpan;
            } else if (pair.value.verticalSpan && pair.value.verticalSpan > groupVerticalSpan) {
                groupVerticalSpan = pair.value.verticalSpan;
            }
        });

        // Apply the default if no horizontal span value was found. The vertical span can stay undefined.
        groupHorizontalSpan = Math.max(Math.round(groupHorizontalSpan ?? 4), 1);

        // If the group consists of more than one value and the first value is pure description,
        // use that as the group's caption.
        const caption = (group.length === 1 && (typeof group[0].value.type !== "boolean"))
            || group[0].value.type === "description"
            ? group[0].value.caption
            : undefined;
        if (caption && group.length > 1) {
            group.shift();
        }

        // Collect a list of validation errors for this cell.
        const errors: string[] = [];
        group.forEach((entry: IDialogValuePair) => {
            const error = validations.messages[entry.key];
            if (error) {
                errors.push(error);
            }
        });

        const edits = this.renderEdits(group, sectionId, relatedValues);
        const contentCount = Children.count(edits);

        let mainAlignment = ContentAlignment.Start;
        const labelCaption = caption?.trim();
        if (!labelCaption) {
            mainAlignment = ContentAlignment.End; // Aligns to the bottom if there is no label.
        }

        result.push(
            <GridCell
                key={`valueCell${index}`}
                orientation={Orientation.TopDown}
                mainAlignment={mainAlignment}
                crossAlignment={ContentAlignment.Stretch}
                columnSpan={groupHorizontalSpan}
                rowSpan={groupVerticalSpan}
            >
                {labelCaption && <Label className="valueTitle" caption={labelCaption} />}
                {contentCount > 0 && edits}
                {errors.map((value: string, errorIndex: number) => {
                    return (
                        <Message
                            key={`leftError${index}${errorIndex}`}
                            type={MessageType.Error}
                        >
                            {value}
                        </Message>
                    );
                })}
            </GridCell>,
        );

        return result;
    };

    /**
     * Renders a list of edit values for a single grid cell.
     *
     * @param edits The list of values to render.
     * @param sectionId The name/id of the section which is currently being rendered.
     * @param relatedValues A map with dialog value names and values that are taken from a relational value.
     *
     * @returns An array with react nodes.
     */
    private renderEdits = (edits: IDialogValuePair[], sectionId: string,
        relatedValues: IRelatedValues): ComponentChild => {
        const result: ComponentChild[] = [];

        for (const entry of edits) {
            const options = entry.value.options;

            // If the option CommonDialogValueOption.Hidden is set, do not render the control
            if (options?.includes(CommonDialogValueOption.Hidden)) {
                continue;
            }

            if (entry.value.type === "description") {
                const text = entry.value.value ?? entry.value.caption;
                result.push(
                    <Label
                        key={entry.key}
                        className="description"
                        caption={text?.toLocaleString()}
                    />,
                );
            } else {
                // If the entry is part of a relation take its value from there or do not render it,
                // if there's no valid value for it there.
                let value = entry.value.value;

                // If the entry is used modify the used key to point to the relational value, instead of the original
                // data entry.
                let key = entry.key;
                if (relatedValues.relations.has(key)) {
                    const tuple = relatedValues.relations.get(key)!;
                    if (tuple === undefined || tuple[0] === undefined) {
                        continue;
                    }
                    value = tuple[0] as typeof entry.value.type;
                    key = relatedValues.source + "." + tuple[1];
                }

                switch (entry.value.type) {
                    case "button": {
                        const text = value ?? entry.value.caption;
                        result.push(
                            <Button
                                className="valueEditor"
                                caption={text?.toLocaleString()}
                                id={key}
                                key={key}
                                onClick={this.btnClick.bind(this, sectionId)}
                            />);

                        break;
                    }

                    case "boolean": {
                        result.push(<Checkbox
                            id={key}
                            key={key}
                            caption={entry.value.label ?? entry.value.caption}
                            className="valueEditor"
                            checkState={value ? CheckState.Checked : CheckState.Unchecked}
                            onChange={this.checkboxChange.bind(this, sectionId)}
                            disabled={options?.includes(CommonDialogValueOption.Disabled)}
                        />);

                        break;
                    }

                    case "number": {
                        result.push(<UpDown<number | bigint>
                            id={key}
                            key={key}
                            className="valueEditor"
                            value={value as (number | bigint)}
                            step={1}
                            min={entry.value.min}
                            max={entry.value.max}
                            onChange={this.upDownChange.bind(this, sectionId)}
                        />);

                        break;
                    }

                    case "resource": {
                        result.push(<FileSelector
                            className="valueEditor"
                            id={key}
                            key={key}
                            path={value as string}
                            filters={entry.value.filters}
                            multiSelection={entry.value.multiSelection ?? false}
                            canSelectFiles={entry.value.canSelectFiles ?? true}
                            canSelectFolders={entry.value.canSelectFolders ?? false}
                            placeholder={entry.value.placeholder}
                            onChange={this.fileChange.bind(this, sectionId)}
                            onConfirm={this.acceptOnConfirm}
                        />);

                        break;
                    }

                    case "choice": {
                        // A list of string values -> represented as dropdown.
                        // If an empty string is given, the value is optional.
                        const items = entry.value?.choices?.map((item: string, itemIndex: number) => {
                            return <DropdownItem
                                caption={item}
                                key={itemIndex}
                                id={item}
                                payload={key}
                            />;
                        });

                        result.push(<Dropdown
                            id={key}
                            key={key}
                            className="valueEditor"
                            selection={value as string}
                            optional={entry.value.optional}
                            onSelect={this.handleChoiceChange.bind(this, sectionId)}
                            disabled={options?.includes(CommonDialogValueOption.Disabled)}
                            autoFocus={options?.includes(CommonDialogValueOption.AutoFocus)}
                        >
                            {items}
                        </Dropdown>);

                        break;
                    }

                    case "checkList": {
                        const columns: ColumnDefinition[] = [{
                            title: "",
                            field: "data",
                            formatter: this.checklistCellFormatter(sectionId, key),
                        }];

                        const options: ITreeGridOptions = {
                            layout: "fitColumns",
                            verticalGridLines: false,
                            horizontalGridLines: false,
                            alternatingRowBackgrounds: false,
                            selectionType: SelectionType.Highlight,
                            showHeader: false,
                        };

                        const tableData = entry.value.checkList ?? [];
                        const className = this.getEffectiveClassNames(["checkList"]);

                        result.push(<TreeGrid
                            id={key}
                            key={key}
                            height="150"
                            className={className}
                            tableData={tableData}
                            columns={columns}
                            options={options}
                        />);

                        break;
                    }

                    case "set": {
                        // A set of string values -> represented as tag input.
                        const items = entry.value.tagSet?.map((item: string, itemIndex: number) => {
                            return <DropdownItem
                                caption={item}
                                key={itemIndex}
                                id={item}
                                payload={key}
                            />;
                        });

                        const selection = new Set(value as string[]);
                        result.push(<Dropdown
                            id={key}
                            key={key}
                            multiSelect={true}
                            selection={selection}
                            onSelect={this.handleSetChange.bind(this, sectionId)}
                            disabled={options?.includes(CommonDialogValueOption.Disabled)}
                            autoFocus={options?.includes(CommonDialogValueOption.AutoFocus)}
                        >
                            {items}
                        </Dropdown>);

                        break;
                    }

                    case "relation": {
                        // Here we render only the list of titles from each entry.
                        const settingsListColumns = entry.value.listItemCaptionFields?.map((value) => {
                            return { title: "", field: value, resizable: false };
                        }) ?? [{ title: "", field: "caption", resizable: false }];

                        const options: ITreeGridOptions = {
                            showHeader: false,
                            selectionType: SelectionType.Single,
                            verticalGridLines: true,
                            horizontalGridLines: false,
                            layout: "fitDataStretch",
                            autoScrollOnSelect: true,
                        };

                        const containerGridEntry = (<TreeGrid
                            className="relationalList"
                            columns={settingsListColumns}
                            tableData={entry.value.value}
                            options={options}
                            selectedRows={[String(entry.value.active) ?? ""]}
                            height="12em"
                            onRowSelected={this.handleRelationalListRowSelection.bind(this, sectionId, entry.value)}
                            onRowContext={
                                this.handleRelationListRowContext.bind(this, sectionId, entry.value)}
                        />);

                        result.push(containerGridEntry);

                        break;
                    }

                    case "matrix": {
                        const settingsListColumns: ColumnDefinition[] = [
                            { title: "Option", field: "key", resizable: true },
                            { title: "Value", field: "value", resizable: true },
                        ];

                        const options: ITreeGridOptions = {
                            showHeader: true,
                            selectionType: SelectionType.Multi,
                            verticalGridLines: true,
                            horizontalGridLines: false,
                            layout: "fitColumns",
                        };

                        const containerGridEntry = (
                            <Container className="matrixContainer" orientation={Orientation.LeftToRight}>
                                <ParamDialog
                                    ref={this.paramDialogRef}
                                    id="paramDialog"
                                    caption="Add parameters"
                                />
                                <TreeGrid
                                    id="valueGrid"
                                    columns={settingsListColumns}
                                    tableData={value as IDictionary[]}
                                    options={options}
                                />

                                <Container id="matrixActions">
                                    <Button
                                        id="buttonAddEntry"
                                        data-tooltip="Add new property entry"
                                        onClick={this.handleAddProperty}
                                    >
                                        <Icon src={addProperty} data-tooltip="inherit" />
                                    </Button>
                                    <Button
                                        id="buttonRemoveEntry"
                                        data-tooltip="Remove selected entries"
                                        onClick={this.handleRemoveProperty}
                                    >
                                        <Icon src={removeProperty} data-tooltip="inherit" />
                                    </Button>
                                </Container>
                            </Container>
                        );

                        result.push(containerGridEntry);
                        break;
                    }

                    case "custom": {
                        let component;
                        if (typeof entry.value.component === "function") {
                            component = entry.value.component();
                        } else {
                            component = entry.value.component;
                        }

                        const clone = cloneElement(component, {
                            key: "customControl",
                            values: entry.value.value,
                            onDataChange: this.handleCustomControlChange.bind(this, sectionId, key),
                        });
                        result.push(clone);

                        break;
                    }

                    default: { // Text input.
                        const className = this.getEffectiveClassNames(["inputWithProgress"]);
                        let progress;
                        if (entry.value.showLoading) {
                            progress = (<ProgressIndicator
                                backgroundOpacity={0.95}
                                indicatorWidth={40}
                                indicatorHeight={7}
                                linear={true}
                            />);
                        }

                        result.push(
                            <Container
                                className={className}
                                orientation={Orientation.LeftToRight}
                            >
                                <Input
                                    id={key}
                                    key={key}
                                    className="valueEditor"
                                    value={value as string}
                                    onChange={this.handleInputChange.bind(this, sectionId)}
                                    onConfirm={this.acceptOnConfirm}
                                    onBlur={this.onBlur.bind(this, sectionId)}
                                    placeholder={entry.value.placeholder}
                                    disabled={options?.includes(CommonDialogValueOption.Disabled)}
                                    multiLine={entry.value.multiLine}
                                    multiLineCount={entry.value.multiLineCount}
                                    password={entry.value.obfuscated}
                                    autoFocus={options?.includes(CommonDialogValueOption.AutoFocus)}
                                    readOnly={options?.includes(CommonDialogValueOption.ReadOnly)}
                                />
                                {progress}
                            </Container>,
                        );

                        break;
                    }
                }
            }

            // Add cell specific description if given.
            if (entry.value.description) {
                result.push(
                    <Label
                        key={entry.key + "CellDescription"}
                        className="cellDescription"
                        caption={entry.value.description}
                    />,
                );
            }
        }

        return result;
    };

    private checklistCellFormatter = (sectionId: string, key: string) => {
        return (cell: CellComponent): string | HTMLElement => {
            const { checkState, caption, id } = cell.getValue();

            const host = document.createElement("div");
            host.classList.add("checkListEntry");
            host.style.height = "29px";

            const element = (
                <Container
                    id="listContainer"
                    className="verticalCenterContent"
                >
                    <Checkbox
                        className="stretch"
                        checkState={checkState ? CheckState.Checked : CheckState.Unchecked}
                        caption={caption}
                        id={id}
                        onChange={this.checkListCheckboxChange.bind(this, sectionId, key)}
                    />
                </Container>
            );

            render(element, host);

            return host;
        };
    };

    private handleAddProperty = (): void => {
        if (this.paramDialogRef.current) {
            this.paramDialogRef.current.show();
        }
    };

    private handleRemoveProperty = (): void => {
        return;
    };

    private handleActionClick = (_e: MouseEvent | KeyboardEvent, props: Readonly<IComponentProperties>): void => {
        const { onClose } = this.props;
        const { values, data } = this.state;
        let accepted = false;

        if (props.id === "ok") {
            if (!this.inputIsValid()) {
                return;
            } else {
                accepted = true;
            }

            // Only send success close events here. Closed on cancel are handled in `handleClose`.
            onClose?.(DialogResponseClosure.Accept, values, data);
        }

        this.dialogRef.current?.close(!accepted);
    };

    private handleInputChange = (sectionId: string, _e: InputEvent, props: IInputChangeProperties): void => {
        const { onValidate } = this.props;
        const { values, data } = this.state;

        const section = values.sections.get(sectionId);
        if (section && props.id) {
            const value = this.setValue(props.id, props.value, section) as IStringInputDialogValue;
            if (value) {
                const validations = onValidate?.(false, values, data) || { messages: {} };
                this.setState({ values, validations });

                value.onChange?.(props.value, this);
            }
        }
    };

    private handleCustomControlChange = (sectionId: string, key: string,
        customControlData: IDictionary, callback?: () => void): void => {
        const { onValidate } = this.props;
        const { values, data } = this.state;

        const section = values.sections.get(sectionId);
        if (section && key) {
            const value = this.setValue(key, customControlData, section) as ICustomDialogValue;
            if (value) {
                const validations = onValidate?.(false, values, data) || { messages: {} };
                this.setState({ values, validations }, callback);
            }
        }
    };

    private fileChange = (sectionId: string, newValue: string[], props: IFileSelectorProperties): void => {
        const { onValidate } = this.props;
        const { values, data } = this.state;

        if (newValue.length > 0) {
            const section = values.sections.get(sectionId);
            if (section && props.id) {
                const value = this.setValue(props.id, newValue[0], section) as IResourceDialogValue;
                if (value) {
                    const validations = onValidate?.(false, values, data) || { messages: {} };
                    this.setState({ values, validations });

                    value.onChange?.(newValue[0], this);
                }
            }
        }
    };

    /**
     * Change handler for standalone check box components.
     *
     * @param sectionId The name/id of the section in which the sending control is defined.
     * @param checkState The new check state to be set.
     * @param props The checkbox' properties.
     */
    private checkboxChange = (sectionId: string, checkState: CheckState, props: ICheckboxProperties): void => {
        const { onValidate } = this.props;
        const { values, data } = this.state;

        const section = values.sections.get(sectionId);
        if (section && props.id) {
            const newValue = (checkState === CheckState.Checked) ? true : false;
            const value = this.setValue(props.id, newValue, section) as IBooleanInputDialogValue;
            if (value) {
                const validations = onValidate?.(false, values, data) || { messages: {} };
                this.setState({ values, validations });

                value.onChange?.(newValue, this);
            }
        }
    };

    /**
     * Change handler for check boxes in a dynamic list.
     * Testing note: because enzyme does no layout computation, all DOM elements just have a size of 0.
     *               This is usually no problem, except for tabulator-tables based components (TreeGrid, DynamicList).
     *               With a height of 0 they don't render their content, which makes it's impossible to test code
     *               attached to such content. So we have to exclude that from test coverage determination.
     *
     * @param valueId The ID of the value list to change.
     * @param checkState The new check state to be set.
     * @param props The checkbox' properties.
     */
    /* istanbul ignore next */
    private checkListCheckboxChange = (sectionId: string, valueId: string, checkState: CheckState,
        props: ICheckboxProperties): void => {
        const { onValidate } = this.props;
        const { values, data } = this.state;

        const id = props.id;

        if (!id) {
            return;
        }

        const section = values.sections.get(sectionId);
        if (section) {
            const entry = section.values[valueId] as ICheckListDialogValue;
            if (entry) {
                const found = entry.checkList?.find((item) => {
                    return item.data.id === id;
                });

                if (found) {
                    (found.data as ICheckboxProperties).checkState = checkState;
                }


                const validations = onValidate?.(false, values, data) || { messages: {} };
                this.setState({ values, validations });

                entry.onChange?.(checkState === CheckState.Checked, this);
            }
        }
    };

    private btnClick = (sectionId: string, _e: MouseEvent | KeyboardEvent, props: IButtonProperties): void => {
        const { values } = this.state;

        const section = values.sections.get(sectionId);
        if (section && props.id) {
            const entry = section.values[props.id] as IButtonDialogValue;
            if (entry) {
                entry.onClick?.(props.id, values, this);
            }
        }
    };

    private advancedBtnClick = (_e: MouseEvent | KeyboardEvent, props: IButtonProperties): void => {
        const { advancedAction } = this.props;
        const { values } = this.state;

        advancedAction?.(values, props);
    };

    private upDownChange = (sectionId: string, item: number | bigint,
        props: IUpDownProperties<number | bigint>): void => {
        const { onValidate } = this.props;
        const { values, data } = this.state;

        const section = values.sections.get(sectionId);
        if (section && props.id) {
            const value = this.setValue(props.id, item, section) as INumberInputDialogValue;
            if (value) {
                const validations = onValidate?.(false, values, data) || { messages: {} };
                this.setState({ values, validations });

                value.onChange?.(item, this);
            }
        }
    };

    private handleChoiceChange = (sectionId: string, accept: boolean, selectedIds: Set<string>,
        payload: unknown): void => {
        const { onValidate } = this.props;
        const { values, data } = this.state;

        const id = payload as string;
        const newValue = selectedIds.size > 0 ? [...selectedIds][0] : "";
        const section = values.sections.get(sectionId);
        if (section && id) {
            const value = this.setValue(id, newValue, section) as IChoiceDialogValue;
            if (value) {
                const validations = onValidate?.(false, values, data) || { messages: {} };
                this.setState({ values, validations });

                value.onChange?.(newValue, this);
            }
        }
    };

    private handleSetChange = (sectionId: string, accept: boolean, selectedIds: Set<string>,
        payload: unknown): void => {
        const { onValidate } = this.props;
        const { values, data } = this.state;

        const id = payload as string;
        const newValue = [...selectedIds];
        const section = values.sections.get(sectionId);
        if (section && id) {
            const value = this.setValue(id, newValue, section) as ISetDialogValue;
            if (value) {
                const validations = onValidate?.(false, values, data) || { messages: {} };
                this.setState({ values, validations });

                value.onChange?.(newValue, this);
            }
        }
    };

    private handleRelationalListRowSelection = (sectionId: string, value: IRelationDialogValue,
        row: RowComponent): void => {
        const { onValidate } = this.props;
        const { values, data } = this.state;

        const entry = row.getData() as IDictionary;
        const section = values.sections.get(sectionId);
        if (section && value.active !== entry.id) {
            const validations = onValidate?.(false, values, data) || { messages: {} };
            if (Object.keys(validations.messages).length === 0) {
                value.active = entry[value.listItemId ?? "id"] as string;
            }

            this.setState({ values, validations });
        }
    };

    private advancedCheckboxChange = (checkState: CheckState): void => {
        const { activeContexts } = this.state;
        const { onToggleAdvanced } = this.props;

        if (checkState === CheckState.Checked) {
            activeContexts.add("advanced");
        } else {
            activeContexts.delete("advanced");
        }

        onToggleAdvanced?.(checkState === CheckState.Checked);
        this.setState({ activeContexts });
    };

    /**
     * Triggers an alternative acceptance path, instead of clicking OK.
     */
    private acceptOnConfirm = (): void => {
        if (this.inputIsValid()) {
            const { onClose } = this.props;
            const { values, data } = this.state;

            this.dialogRef.current?.close(false);
            onClose?.(DialogResponseClosure.Accept, values, data);
        }
    };

    private onBlur = (sectionId: string, _e: FocusEvent, props: IInputProperties): void => {
        const { values } = this.state;

        const section = values.sections.get(sectionId);
        if (section && props.id) {
            const entry = section.values[props.id];
            if (entry?.type === "text") {
                entry.onFocusLost?.(props.value ?? "", this);
            } else if (entry?.type === "number") {
                if (typeof entry.value === "number") {
                    entry.onFocusLost?.(Number(props.value ?? ""), this);
                } else {
                    entry.onFocusLost?.(BigInt(props.value ?? ""), this);
                }
            }
        }
    };

    /**
     * This method is called in different situations: click outside, pressing <escape> or when the dialog
     * is closed programmatically (clicking on OK or Cancel). In order to avoid calling the close callback 2 times
     * we handle cancel actions here and the OK action in the OK button click.
     *
     * @param cancelled True if the dialog was closed by clicking outside, pressing <escape> or clicking the cancel
     *                  button.
     */
    private handleClose = (cancelled: boolean): void => {
        if (cancelled) {
            const { onClose } = this.props;
            const { values, data } = this.state;

            onClose?.(DialogResponseClosure.Decline, values, data);
        }
    };

    /**
     * Triggers validation for all input values.
     *
     * @returns True if all values are correct (or not validated at all).
     */
    private inputIsValid(): boolean {
        const { onValidate } = this.props;
        const { values, data } = this.state;

        const validations = onValidate?.(true, values, data) ?? { messages: {} };
        this.setState({ validations });

        return Object.keys(validations.messages).length === 0;
    }

    /**
     * Takes an id of a data entry and a new value and assigns that to the data entry.
     *
     * @param id The id of the data entry. Can have a qualified form (id.id).
     * @param value The value to set.
     * @param section The section which contains the data entries given by the id.
     *
     * @returns the dialog value that was changed (if found).
     */
    private setValue(id: string, value: DialogValueType, section: IDialogSection): IDialogValue | undefined {
        // See if the id is actually a path.
        const parts = id.split(".");
        let dialogValue: IDialogValue | undefined;

        if (parts.length === 1) {
            dialogValue = section.values[id];
            if (dialogValue) {
                dialogValue.value = value;
            }
        } else {
            // Currently we only support a path with 2 elements. Both must point into the given section,
            // where the first part must represent a relational list.
            if (parts.length < 2) {
                return undefined;
            }

            dialogValue = section.values[parts[0]];
            if (!dialogValue || dialogValue.type !== "relation" || dialogValue.active === undefined) {
                return undefined;
            }

            const activeData = dialogValue.value?.find((candidate) => {
                return candidate.id === (dialogValue as IRelationDialogValue).active!;
            });

            if (!activeData) {
                return undefined;
            }

            activeData[parts[1]] = value;
        }

        return dialogValue;
    }

    private handleRelationListRowContext = (sectionId: string, value: IRelationDialogValue, event: Event,
        row: RowComponent): void => {
        const e = event as MouseEvent;
        const targetRect = new DOMRect(e.clientX, e.clientY, 2, 2);

        const entry = row.getData() as IDictionary;
        if (entry && entry.id) {
            value.active = String(entry.id);
        }

        this.relationListContextMenuRef.current?.open(targetRect, false, {}, { sectionId, value });
    };

    private handleRelationListContextMenuItemClick = (props: IMenuItemProperties, altActive: boolean,
        payload: unknown): boolean => {

        const itemData = payload as { sectionId: string; value: IRelationDialogValue; };
        const idName = itemData.value.listItemId ?? "id";
        const command = props.command.command;
        if (command === "addEntry") {
            const titleName = (itemData.value.listItemCaptionFields ?? ["title"])[0];
            itemData.value.value?.push({
                [idName]: this.relationListCounter,
                [titleName]: `New Item ${-this.relationListCounter}`,
            });
            itemData.value.active = String(this.relationListCounter--);

            this.forceUpdate();
        } else if ((itemData.value.value ?? []).length > 1) {
            // Don't allow to remove the last element or we will no longer get row context menu events.
            const index = itemData.value.value?.findIndex((candidate) => {
                return String(candidate[idName]) === String(itemData.value.active);
            }) ?? -1;

            // Don't delete the <new> entry if there
            if (index > -1 && index < (itemData.value.value ?? []).length - 1) {
                const { onValidate } = this.props;
                const { values, data } = this.state;

                const validations = onValidate?.(false, values, data) || { messages: {} };
                if (Object.keys(validations.messages).length === 0) {
                    // Remove item
                    itemData.value.value?.splice(index, 1);

                    // Make the new item in the same position active or the one before that
                    // if the last item as already selected
                    const entry = itemData.value.value?.[
                        (index === (itemData.value.value ?? []).length - 1) ? index - 1 : index];
                    itemData.value.active = (entry) ? String(entry[idName]) : undefined;

                    this.setState({ values, validations });
                }
            }
        }

        return true;
    };
}
