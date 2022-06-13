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

import "./ValueEditDialog.css";
import addProperty from "../../assets/images/add.svg";
import removeProperty from "../../assets/images/remove.svg";

import React from "react";
import { isNil } from "lodash";

import {
    Dialog, IComponentProperties, Component, Label, Button, IComponentState, Icon, Codicon, GridCell, Grid, Input,
    Checkbox, UpDown, CheckState, IInputChangeProperties, Message, Orientation, ICheckboxProperties, Dropdown,
    ContentAlignment, IDropdownProperties, Container, Tabview, ITabviewPage, DynamicList, IFileSelectorProperties,
    FileSelector, IUpDownProperties, TreeGrid, ITreeGridOptions, SelectionType, IPortalOptions, ProgressIndicator,
    IInputProperties, Tabulator, IButtonProperties,
} from "../ui";
import { DialogResponseClosure, IDictionary, MessageType } from "../../app-logic/Types";
import { ParamDialog } from "./ParamDialog";
import { IOpenDialogFilters } from "../../supplement/Requisitions";
import { IConnectionDetails } from "../../supplement/ShellInterface";

export interface IContextUpdateData {
    add?: string[];
    remove?: string[];
}

export enum DialogValueOption {
    ReadOnly,    // If set then the value is not editable.
    Disabled,

    AutoFocus,   // When set focus an element and select all content. Can only be set once and only for input fields.
    Description, // If set then the value is just a description label (regardless of its type).
    Resource,    // Set to denote the value references a resource (URI, file).
    MultiLine,   // The value is a multi line string and needs a larger input control.
    Password,    // If set then the actual value must be a string interpreted as password.

    ShowLoading, // If set a progress indicator is displayed (only for input fields).

    Grouped,     // If set then this value is grouped with all following using the same flag, into a single grid cell.
    NewGroup,    // Set to break two consecutive groups apart (set on first member).
}

// Lists in the dialog use templated data.
export interface IDialogListEntry {
    [key: string]: IComponentProperties;
}

export type DialogValueType = number | string | boolean;

// A single editable value, with its description.
export interface IDialogValue {
    caption?: string;
    value?: DialogValueType;
    placeholder?: string;

    // These members indicate special sources that limit the possible input value.
    choices?: string[]; // Only one of the list of choices is possible.

    action?: string;    // Action name for button
    matrix?: DialogValueType[][];
    tags?: string[];    // Any combination of the tags is possible. The value field must be a comma-separated list.

    list?: IDialogListEntry[];

    options?: DialogValueOption[];

    // A value between 1 and 8 for the grid cells to span horizontally (default: 4).
    span?: number;

    // Used with the Resource value option, to limit user selectable files.
    filters?: IOpenDialogFilters;

    // Called for certain value types (checkbox, choice) when the value was changed.
    onChange?: (value: DialogValueType) => void;

    // Called for certain value types (checkbox, choice) when the value was changed.
    onClick?: (id: string, values: IDialogValues) => void;

    // Called for certain value types (input) when they lose focus.
    onFocusLost?: (value: string) => void;
}

// A set of keys and their associated values, which can be edited in this dialog.
export interface IDialogSection {
    caption?: string;    // The caption of the context.
    contexts?: string[]; // All contexts in this list must be currently active to make the section visible.
    groupName?: string;  // Place all sections with the same group name into a tabview.
    active?: boolean;    // If this section is grouped and the currently visible page, this value is true.
    values: {
        [key: string]: IDialogValue;
    };
}

// A collection of settings grouped into sections, each with an own optional caption.
// The same interface is used for validation and return values.
export interface IDialogValues {
    id?: string; // An identification for the dialog invocation.
    sections: Map<string, IDialogSection>;
}

// Contains a set of validation messages for dialog value keys that did not validate ok.
// These messages are shown below the input field for that dialog value.
export interface IDialogValidations {
    requiredContexts?: string[];
    messages: { [key: string]: string };
}

interface IDialogValuePair {
    key: string;
    value: IDialogValue;
}

export interface ICallbackData {
    onAddConnection?: (vale: IConnectionDetails) => void;
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
}

export interface IValueEditDialogProperties extends IComponentProperties {
    container?: HTMLElement; // A node where to mount the dialog to.

    advancedActionCaption?: string;
    customFooter?: React.ReactNode;

    advancedAction?: (values: IDialogValues, props: IButtonProperties) => void;
    onValidate?: (closing: boolean, values: IDialogValues, data?: IDictionary) => IDialogValidations;
    onClose?: (closure: DialogResponseClosure, values: IDialogValues, data?: IDictionary,
        callbackData?: ICallbackData) => void;
    onToggleAdvanced?: (checked: boolean) => void;
    onSelectTab?: (id: string) => void;
}

interface IValueEditDialogState extends IComponentState {
    title?: string;
    heading?: string;
    description?: string[];
    values: IDialogValues;
    validations: IDialogValidations;
    preventConfirm: boolean;
    actionText?: string;

    activeContexts: Set<string>; // A list of ids that allow conditional rendering of sections and values.

    // Additional data directly passed through from the caller to the receiver.
    data?: IDictionary;
}

// A dialog to let the user enter values and to validate them.
export class ValueEditDialog extends Component<IValueEditDialogProperties, IValueEditDialogState> {

    private dialogRef = React.createRef<Dialog>();
    private paramDialogRef = React.createRef<ParamDialog>();

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

    /**
     * Makes the dialog visible with the given dialog values set.
     *
     * @param values The values to use to layout and initially fill the dialog.
     * @param dialogOptions Details for the appearance of the dialog.
     * @param data Anything that should be passed to the validation and close functions.
     */
    public show = (values: IDialogValues, dialogOptions?: IValueEditDialogShowOptions, data?: IDictionary): void => {
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
            if (!isNil(entry)) {
                entry.value = value;
                const index = entry.options?.indexOf(DialogValueOption.ShowLoading) ?? -1;
                if (index > -1) {
                    entry.options?.splice(index, 1);
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
            if (!isNil(entry)) {
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
            if (!isNil(entry)) {
                entry.value = value;
                if (entry.options === undefined) {
                    entry.options = [DialogValueOption.ShowLoading];
                } else {
                    entry.options?.push(DialogValueOption.ShowLoading);
                }

                const { onValidate } = this.props;
                const validations = onValidate?.(false, values, data) || { messages: {} };
                this.setState({ values, validations });
            }
        });
    };

    public preventConfirm = (preventConfirm: boolean): void => {
        this.setState({ preventConfirm });
    };

    public render(): React.ReactNode {
        const { container, advancedActionCaption, advancedAction, customFooter } = this.props;
        const {
            title, heading, actionText, description, validations, activeContexts, values, preventConfirm,
        } = this.state;

        // Take over any context that is now required to show up due to validation issues.
        if (validations.requiredContexts && validations.requiredContexts.length > 0) {
            validations.requiredContexts.forEach((context) => {
                activeContexts.add(context);
            });
            validations.requiredContexts = undefined;
        }

        const className = this.getEffectiveClassNames(["valueEditDialog"]);
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

        const descriptionLabels: React.ReactNode[] = [];
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
                    >
                        {descriptionContent && <GridCell columnSpan={8}>{descriptionContent}</GridCell>}
                        {groups}
                    </Grid>
                }
                onClose={this.handleClose}

                {...this.unhandledProperties}
            >
            </Dialog>
        );
    }

    /**
     * Renders all defined sections into groups. A section without a group name renders as single entry into a group.
     *
     * @returns The generated list of groups.
     */
    private renderGroups = (): React.ReactNode[] => {
        const { onSelectTab } = this.props;
        const { values, activeContexts } = this.state;

        interface ISectionNodePair { caption?: string; node: React.ReactNode; section: IDialogSection }
        interface ISectionGroup { nodes: ISectionNodePair[]; active?: string }

        const sectionGroups: ISectionGroup[] = [];
        let currentGroup = "";
        values.sections.forEach((section: IDialogSection) => {
            const missingContexts = (section.contexts || []).filter((value: string) => {
                return !activeContexts.has(value);
            });

            // Ignore this section if any of its contexts does not exist in the active context list.
            if (missingContexts.length > 0) {
                return;
            }

            const node = this.renderSection(activeContexts, section);

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

        const groups = sectionGroups.map((group: ISectionGroup, index: number): React.ReactNode => {
            if (group.nodes.length === 1) {
                // Render single sections directly.
                return group.nodes[0].node;
            }

            // Otherwise place the sections on a tabview.
            const active = (group.active?.length ?? 0) > 0 ? group.active : "page0";
            const pages = group.nodes.map((pair: ISectionNodePair, pageIndex: number): ITabviewPage => {
                return {
                    id: `page${pageIndex}`,
                    caption: pair.caption || "No Title",
                    content:
                        <Grid
                            columns={8}
                            rowGap={16}
                            columnGap={16}
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

    private renderSection = (contexts: Set<string>, section: IDialogSection): React.ReactNode => {
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
        let i = 0;

        while (i < keys.length) {
            const group: IDialogValuePair[] = [];
            let key = keys[i++];
            let value = section.values[key];

            group.push({ key, value });

            // Collect grouped values.
            if (value.options?.includes(DialogValueOption.Grouped)) {
                while (i < keys.length) {
                    key = keys[i];
                    value = section.values[key];
                    if (!value.options?.includes(DialogValueOption.Grouped)
                        || value.options?.includes(DialogValueOption.NewGroup)) {
                        break;
                    }

                    ++i;
                    group.push({ key, value });
                }

            }

            result.push(this.renderDialogValueGroup(i, group));
        }

        return result;
    };

    /**
     * Renders a list of values into a single grid cell, including a potential caption.
     *
     * @param index The group/value index.
     * @param group The list of elements in the group.
     * @returns The rendered node.
     */
    private renderDialogValueGroup = (index: number, group: IDialogValuePair[]): React.ReactNode => {

        const { validations } = this.state;

        const result = [];

        // Search for the largest span in the group.
        let groupSpan: number | undefined;
        group.forEach((pair: IDialogValuePair) => {
            if (!groupSpan) {
                groupSpan = pair.value.span;
            } else if (pair.value.span && pair.value.span > groupSpan) {
                groupSpan = pair.value.span;
            }
        });
        groupSpan = groupSpan || 4; // Apply the default if no span value was found.

        // If the group consists of more than one value and the first value is pure description,
        // use that as the group's caption.
        const caption = (group.length === 1 && (typeof group[0].value.value !== "boolean"))
            || group[0].value.options?.includes(DialogValueOption.Description)
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

        result.push(
            <GridCell
                key={`valueCell${index}`}
                orientation={Orientation.TopDown}
                mainAlignment={ContentAlignment.Start}
                crossAlignment={ContentAlignment.Stretch}
                columnSpan={groupSpan}
            >
                {caption && <Label className="valueTitle" caption={caption} />}
                {this.renderEdits(group)}
                {errors.map((value: string, errorIndex: number) => {
                    return (
                        <Message
                            key={`leftError${index}${errorIndex}`}
                            as={Label}
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
     * @returns An array with react nodes.
     */
    private renderEdits = (edits: IDialogValuePair[]): React.ReactNode => {
        const result: React.ReactNode[] = [];

        edits.forEach((entry: IDialogValuePair): void => {
            const options = entry.value.options;

            if (options?.includes(DialogValueOption.Description)) {
                const text = entry.value.value ?? entry.value.caption;
                result.push(
                    <Label
                        key={entry.key + "Description"}
                        className="description"
                        caption={text?.toLocaleString()}
                    />,
                );
            } else if (typeof entry.value.value === "boolean") {
                result.push(<Checkbox
                    id={entry.key}
                    key={entry.key}
                    caption={entry.value.caption}
                    className="valueEditor"
                    checkState={entry.value.value ? CheckState.Checked : CheckState.Unchecked}
                    onChange={this.checkboxChange}
                />);
            } else if (options?.includes(DialogValueOption.Resource)) {
                result.push(<FileSelector
                    className="valueEditor"
                    id={entry.key}
                    key={entry.key}
                    path={entry.value.value as string}
                    filters={entry.value.filters}
                    multiSelection={false}
                    onChange={this.fileChange}
                    onConfirm={this.acceptOnConfirm}
                />);
            } else if (Array.isArray(entry.value.choices)) {
                // A list of string values -> represented as dropdown.
                const items = entry.value.choices.map((item: string, itemIndex: number) => {
                    return <Dropdown.Item
                        caption={item}
                        key={itemIndex}
                        id={item}
                    />;
                });

                result.push(<Dropdown
                    id={entry.key}
                    key={entry.key}
                    className="valueEditor"
                    initialSelection={entry.value.value as (string | undefined)}
                    onSelect={this.dropdownChange}
                    disabled={options?.includes(DialogValueOption.Disabled)}
                    autoFocus={options?.includes(DialogValueOption.AutoFocus)}
                >
                    {items}
                </Dropdown>);
            } else if (entry.value.onClick !== undefined) {
                const text = entry.value.value ?? entry.value.caption;
                result.push(
                    <Button
                        className="valueEditor"
                        caption={text?.toLocaleString()}
                        id={entry.key}
                        key={entry.key}
                        onClick={this.btnClick}
                    />);
            } else if (entry.value.list) {
                const containerListEntry = (
                    <Container
                        id="listContainer"
                        className="verticalCenterContent"
                    >
                        <Checkbox
                            // The id field will be set from the template data.
                            dataId="data"
                            className="stretch"
                            checkState={CheckState.Unchecked}
                            onChange={this.listCheckboxChange.bind(this, entry.key)}>
                        </Checkbox>
                    </Container>
                );

                result.push(<DynamicList
                    id={entry.key}
                    key={entry.key}
                    height={150}
                    rowHeight={29}
                    template={containerListEntry}
                    elements={entry.value.list}
                />);
            } else if (entry.value.matrix) {
                const settingsListColumns: Tabulator.ColumnDefinition[] = [
                    { title: "Option", field: "field1", resizable: true },
                    { title: "Value", field: "field2", resizable: true },
                ];

                const options: ITreeGridOptions = {
                    showHeader: true,
                    selectionType: SelectionType.Multi,
                    verticalGridLines: true,
                    horizontalGridLines: false,
                    layout: "fitColumns",
                };

                const containerGridEntry = (
                    <Container id="matrixContainer" orientation={Orientation.LeftToRight}>
                        <ParamDialog
                            ref={this.paramDialogRef}
                            id="paramDialog"
                            caption="Add connection parameters"
                        />
                        <TreeGrid
                            id="valueGrid"
                            columns={settingsListColumns}
                            tableData={entry.value.matrix}
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
            } else if (typeof entry.value.value === "number") {
                result.push(<UpDown
                    id={entry.key}
                    key={entry.key}
                    className="valueEditor"
                    value={entry.value.value}
                    step={1}
                    min={0}
                    max={65535}
                    onChange={this.upDownChange}
                />);
            } else {
                const className = this.getEffectiveClassNames(["inputWithProgress"]);
                let progress;
                if (options?.includes(DialogValueOption.ShowLoading)) {
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
                            id={entry.key}
                            key={entry.key}
                            className="valueEditor"
                            value={entry.value.value}
                            onChange={this.inputChange}
                            onConfirm={this.acceptOnConfirm}
                            onBlur={this.onBlur}
                            placeholder={entry.value.placeholder}
                            disabled={options?.includes(DialogValueOption.Disabled)}
                            multiLine={options?.includes(DialogValueOption.MultiLine)}
                            password={options?.includes(DialogValueOption.Password)}
                            autoFocus={options?.includes(DialogValueOption.AutoFocus)}
                        />
                        {progress}
                    </Container>,
                );
            }
        });

        return result;
    };

    private handleAddProperty = (): void => {
        if (this.paramDialogRef.current) {
            this.paramDialogRef.current.show();
        }
    };

    private handleRemoveProperty = (): void => {
        return;
    };

    private handleActionClick = (_e: React.SyntheticEvent, props: Readonly<IComponentProperties>): void => {
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

    private inputChange = (_e: React.ChangeEvent, props: IInputChangeProperties): void => {
        const { onValidate } = this.props;
        const { values, data } = this.state;

        values.sections.forEach((section) => {
            if (props.id) {
                const entry = section.values[props.id];
                if (!isNil(entry)) {
                    entry.value = props.value;

                    const validations = onValidate?.(false, values, data) || { messages: {} };
                    this.setState({ values, validations });
                }
            }
        });
    };

    private fileChange = (newValue: string[], props: IFileSelectorProperties): void => {
        const { onValidate } = this.props;
        const { values, data } = this.state;

        if (newValue.length > 0) {
            values.sections.forEach((section) => {
                if (props.id) {
                    const entry = section.values[props.id];
                    if (!isNil(entry)) {
                        entry.value = newValue[0];

                        const validations = onValidate?.(false, values, data) || { messages: {} };
                        this.setState({ values, validations });
                    }
                }
            });
        }
    };

    /**
     * Change handler for standalone check box components.
     *
     * @param checkState The new check state to be set.
     * @param props The checkbox' properties.
     */
    private checkboxChange = (checkState: CheckState, props: ICheckboxProperties): void => {
        const { onValidate } = this.props;
        const { values, data } = this.state;

        const id = props.id;

        // The id is always assigned (in the edit construction code), so it's impossible to test a missing one.
        /* istanbul ignore next */
        if (!id) {
            return;
        }

        values.sections.forEach((section) => {
            const entry = section.values[id];
            if (entry) {
                entry.value = (checkState === CheckState.Checked) ? true : false;
                const validations = onValidate?.(false, values, data) || { messages: {} };
                this.setState({ values, validations });

                entry.onChange?.(checkState === CheckState.Checked);
            }
        });
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
    private listCheckboxChange = (valueId: string, checkState: CheckState, props: ICheckboxProperties): void => {
        const { onValidate } = this.props;
        const { values, data } = this.state;

        const id = props.id;
        const templateData = props.data && props.dataId ? props.data[props.dataId] : undefined;

        if (!id) {
            return;
        }

        values.sections.forEach((section) => {
            const entry = section.values[valueId];
            if (entry) {
                if (templateData) {
                    const found = entry.list?.find((item) => {
                        return item.data.id === templateData.id;
                    });

                    if (found) {
                        (found.data as ICheckboxProperties).checkState = checkState;
                    }
                }


                const validations = onValidate?.(false, values, data) || { messages: {} };
                this.setState({ values, validations });

                entry.onChange?.(checkState === CheckState.Checked);
            }
        });
    };

    private btnClick = (_e: React.SyntheticEvent, props: IButtonProperties): void => {
        const { values } = this.state;

        values.sections.forEach((section) => {
            if (props.id) {
                const entry = section.values[props.id];
                if (!isNil(entry)) {
                    entry.onClick?.(props.id, values);
                }
            }
        });
    };

    private advancedBtnClick = (_e: React.SyntheticEvent, props: IButtonProperties): void => {
        const { advancedAction } = this.props;
        const { values } = this.state;

        advancedAction?.(values, props);
    };

    private upDownChange = (item: string | number, props: IUpDownProperties): void => {
        const { onValidate } = this.props;
        const { values, data } = this.state;

        values.sections.forEach((section) => {
            if (props.id) {
                const entry = section.values[props.id];
                if (!isNil(entry)) {
                    entry.value = item;

                    const validations = onValidate?.(false, values, data) || { messages: {} };
                    this.setState({ values, validations });
                }
            }
        });
    };

    private dropdownChange = (selectedId: string | number, props: IDropdownProperties): void => {
        const { onValidate } = this.props;
        const { values, data } = this.state;

        values.sections.forEach((section) => {
            if (props.id) {
                const entry = section.values[props.id];
                if (!isNil(entry)) {
                    entry.value = selectedId;

                    const validations = onValidate?.(false, values, data) || { messages: {} };
                    this.setState({ values, validations });

                    entry.onChange?.(selectedId);
                }
            }
        });
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

    private onBlur = (_e: React.SyntheticEvent, props: IInputProperties): void => {
        const { values } = this.state;

        values.sections.forEach((section) => {
            if (props.id) {
                const entry = section.values[props.id];
                if (!isNil(entry)) {
                    entry.onFocusLost?.(props.value ?? "");
                }
            }
        });
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
}
