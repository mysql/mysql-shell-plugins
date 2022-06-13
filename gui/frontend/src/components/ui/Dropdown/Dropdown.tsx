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

import "./Dropdown.css";

import React from "react";
import keyboardKey from "keyboard-key";
import _ from "lodash";

import {
    Container, Label, IComponentProperties, IComponentState, Popup, ComponentPlacement, Divider,
    Component, TagInput, ITag, Orientation, ContentAlignment,
} from "..";

import { DropdownItem, IDropdownItemProperties } from "./DropdownItem";
import { convertPropValue } from "../../../utilities/string-helpers";

export interface IDropdownProperties extends IComponentProperties {
    initialSelection?: string | Set<string>;
    defaultId?: string;
    optional?: boolean;
    showDescription?: boolean;
    multiSelect?: boolean;
    withoutArrow?: boolean;

    autoFocus?: boolean;

    onSelect?: (selectedId: string, props: IDropdownProperties) => void;
}

interface IDropdownState extends IComponentState {
    currentSelection: Set<string>;
    hotId?: string;

    childArray: Array<Exclude<React.ReactNode, boolean | null | undefined>>;
}

export class Dropdown extends Component<IDropdownProperties, IDropdownState> {

    // eslint-disable-next-line @typescript-eslint/naming-convention
    public static Item = DropdownItem;

    public static defaultProps = {
        optional: false,
        showDescription: false,
        multiSelect: false,
        withoutArrow: false,
    };

    private containerRef = React.createRef<HTMLElement>();
    private listRef = React.createRef<HTMLElement>();
    private popupRef = React.createRef<Popup>();

    private currentSelectionIndex = -1; // Tracks the currently selected item index for keyboard based selection.
    private selectionIndexBackup = -1;
    private selectionBackup = new Set<string>();

    public constructor(props: IDropdownProperties) {
        super(props);

        let initialValue;
        if (props.initialSelection instanceof Set) {
            initialValue = props.initialSelection;
        } else {
            initialValue = new Set<string>();
            if (props.initialSelection) {
                initialValue.add(props.initialSelection);
            }
        }

        this.state = {
            currentSelection: initialValue,
            childArray: React.Children.toArray(props.children),
        };

        this.addHandledProperties("initialSelection", "defaultId", "optional", "showDescription", "multiSelect",
            "withoutArrow", "autoFocus", "onSelect");
    }

    /**
     * Allows to set the current selection programmatically.
     *
     * @param id The id of the entry to select. If there's no such entry then nothing will be selected.
     * @param replace If true (or props.multiSelect is false) replace the entire current selection. Otherwise
     *                the id is added to the current selection list.
     */
    public selectEntry(id: string, replace: boolean): void {
        const { multiSelect, onSelect } = this.mergedProps;
        const { currentSelection } = this.state;

        if (!multiSelect || replace) {
            this.setState({ currentSelection: new Set([id]) });
        } else {
            const newSelection = currentSelection.add(id);
            this.setState({ currentSelection: newSelection });
        }

        // When selecting an entry while the drop down is closed means to activate it, while with an open
        // dropdown it's only temporary, until the box is closed.
        if (!this.popupRef.current?.isOpen) {
            onSelect?.(id, this.mergedProps);
        }
    }

    public componentDidMount(): void {
        const { autoFocus } = this.mergedProps;

        if (this.containerRef.current && autoFocus) {
            this.containerRef.current.focus();
        }
    }

    public componentDidUpdate(prevProps: IDropdownProperties): void {
        const { children, initialSelection, defaultId } = this.mergedProps;

        if (!this.popupRef.current?.isOpen && this.containerRef.current) {
            // Set back the focus to the drop down, once the popup was closed.
            // This is independent of the auto focus property, because for the popup to show
            // the dropdown had to have the focus anyway.
            this.containerRef.current.focus();
        }

        const previousSelection = prevProps.initialSelection || prevProps.defaultId || "";

        if (initialSelection instanceof Set) {
            this.setState({
                currentSelection: initialSelection,
                childArray: React.Children.toArray(children),
            });
        } else {
            const newSelection = initialSelection || defaultId || "";
            if (newSelection !== previousSelection) {
                this.setState({
                    currentSelection: new Set([newSelection]),
                    childArray: React.Children.toArray(children),
                });
            }
        }
    }

    public render(): React.ReactNode {
        const { id, children, defaultId, optional, showDescription, withoutArrow, multiSelect } = this.mergedProps;
        const { currentSelection, hotId } = this.state;

        const currentDescription = this.descriptionFromId(hotId || currentSelection.values().next().value as string);

        const className = this.getEffectiveClassNames([
            "dropdown",
            withoutArrow ? "withoutArrow" : "",
            this.classFromProperty(multiSelect, "multiSelect"),
        ]);

        const tags: ITag[] = [];
        const content = React.Children.map(children, (child): React.ReactNode => {
            if (React.isValidElement(child)) {
                let itemClassName = "";
                let checked = false;

                const { id: childId, caption: childCaption, picture } = child.props;
                if (currentSelection.has(childId as string)) {
                    tags.push({ id: childId, caption: childCaption, picture });
                    checked = true;
                }

                if (defaultId && childId === defaultId) {
                    itemClassName = "default";
                }

                return React.cloneElement(child, {
                    key: childId,
                    onMouseEnter: this.handleItemMouseEnter,
                    onMouseLeave: this.handleItemMouseLeave,
                    onClick: this.handleItemClick,
                    className: itemClassName,
                    selected: !multiSelect && currentSelection.has(childId as string),
                    checked: multiSelect ? checked : undefined,
                });
            }

            return undefined;
        });

        if (optional) {
            // Being optional means we have an entry with no value.
            content?.splice(0, 0,
                <DropdownItem
                    id="empty"
                    caption="empty"
                    key="empty"
                    selected={currentSelection.has("empty")}

                    onMouseEnter={this.handleItemMouseEnter}
                    onMouseLeave={this.handleItemMouseLeave}
                    onClick={this.handleItemClick}
                />,
            );
        }

        let inputControl;
        if (multiSelect) {
            inputControl =
                <TagInput
                    innerRef={this.containerRef}
                    className={className}
                    tags={tags}
                    removable={true}
                    tabIndex={0}
                    onAdd={this.handleTagAdd}
                    onRemove={this.handleTagRemove}
                    onClick={this.handleClick}
                    onKeyDown={this.handleKeydown}
                    {...this.unhandledProperties}
                />;
        } else {
            let inputContent;
            if (tags.length > 0) {
                if (tags[0].picture) {
                    inputContent = <Container
                        orientation={Orientation.LeftToRight}
                        crossAlignment={ContentAlignment.Center}
                    >
                        {tags[0].picture}
                        {tags[0].caption && <Label>{tags[0].caption}</Label>}
                    </Container>;
                } else {
                    inputContent = <Label className="ellipsis">{tags[0].caption}</Label>;
                }
            }

            inputControl =
                <Container
                    innerRef={this.containerRef}
                    className={className}
                    tabIndex={0}
                    onClick={this.handleClick}
                    onKeyDown={this.handleKeydown}
                    crossAlignment={ContentAlignment.Center}
                    {...this.unhandledProperties}
                >
                    {inputContent}
                </Container>;

        }

        return (
            <>
                {inputControl}
                <Popup
                    ref={this.popupRef}
                    innerRef={this.listRef}
                    id={`${id || ""}Popup`}
                    showArrow={false}
                    placement={ComponentPlacement.BottomRight}
                    onOpen={this.handleOpen}
                    onClose={this.handleClose}
                    className="dropdownList"
                >
                    {content}
                    {showDescription &&
                        <>
                            <Divider className="dropdownDivider" thickness={1} />
                            <Label className="dropdownDescription">{currentDescription}</Label>
                        </>
                    }
                </Popup>
            </>
        );
    }

    private handleClick = (e: React.SyntheticEvent): void => {
        this.popupRef.current?.open(e.currentTarget.getBoundingClientRect(), { backgroundOpacity: 0 });
    };

    private handleKeydown = (e: React.KeyboardEvent): void => {
        const code = keyboardKey.getCode(e);
        switch (code) {
            case keyboardKey.Enter:
            case keyboardKey.Spacebar: {
                if (this.popupRef.current?.isOpen) {
                    // The dropdown is already open, which means the user accepts the current selection.
                    const { onSelect } = this.mergedProps;
                    const { childArray } = this.state;

                    this.saveSelection();
                    this.popupRef.current.close();

                    const current = childArray[this.currentSelectionIndex];
                    if (React.isValidElement(current)) {
                        const id = current.props.id;
                        if (id) {
                            onSelect?.(id as string ?? "", this.mergedProps);
                        }
                    }
                } else {
                    this.popupRef.current?.open(e.currentTarget.getBoundingClientRect(), { backgroundOpacity: 0 });
                }
                e.stopPropagation();
                e.preventDefault();

                break;
            }

            case keyboardKey.ArrowDown: {
                const { childArray } = this.state;

                if (this.currentSelectionIndex === -1) {
                    this.currentSelectionIndex = this.indexOfFirstSelectedEntry + 1;
                } else {
                    ++this.currentSelectionIndex;
                }

                if (this.currentSelectionIndex === childArray.length) {
                    this.currentSelectionIndex = 0;
                }

                const current = childArray[this.currentSelectionIndex];
                if (React.isValidElement(current)) {
                    const id = current.props.id;
                    if (id) {
                        this.selectEntry(id as string ?? "", true);
                    }
                }
                e.stopPropagation();
                e.preventDefault();

                break;
            }

            case keyboardKey.ArrowUp: {
                const { children } = this.mergedProps;
                const childArray = React.Children.toArray(children);

                if (this.currentSelectionIndex === -1) {
                    this.currentSelectionIndex = this.indexOfFirstSelectedEntry - 1;
                } else {
                    --this.currentSelectionIndex;
                }

                if (this.currentSelectionIndex < 0) {
                    this.currentSelectionIndex = childArray.length - 1;
                }

                const current = childArray[this.currentSelectionIndex];
                if (React.isValidElement(current)) {
                    const id = current.props.id;
                    if (id) {
                        this.selectEntry(id as string ?? "", true);
                    }
                }

                e.stopPropagation();
                e.preventDefault();

                break;
            }

            case keyboardKey.Tab: {
                this.saveSelection();
                this.popupRef.current?.close();

                break;
            }

            default: {
                break;
            }
        }
    };

    private handleItemMouseEnter = (e: React.MouseEvent, props: IDropdownItemProperties): void => {
        const { showDescription } = this.mergedProps;

        if (showDescription) {
            this.setState({ hotId: props.id });
        }

        // First remove the selection from the currently selected item. Can be the one initially set.
        // Then set it to the element the mouse enters.
        const children: HTMLCollection | undefined = (e.currentTarget as HTMLElement).parentElement?.children;
        [].forEach.call(children, (child: HTMLElement): void => {
            child.classList.remove("selected");
        });

        e.currentTarget.classList.add("selected");
    };

    private handleItemMouseLeave = (e: React.MouseEvent, props: IDropdownItemProperties): void => {
        const { showDescription } = this.mergedProps;
        if (showDescription) {
            this.setState({ hotId: props.id });
        }
        e.currentTarget.classList.remove("selected");
    };

    private handleItemClick = (e: React.SyntheticEvent, props: IDropdownItemProperties): void => {
        const { multiSelect, onSelect } = this.mergedProps;
        const { currentSelection } = this.state;

        const id = (props.id || "");
        if (multiSelect) {
            if (currentSelection.has(id)) {
                currentSelection.delete(id);
            } else {
                currentSelection.add(id);
            }
            this.setState({ currentSelection });
        } else {
            this.setState({ currentSelection: new Set([id]) });
        }

        if (!multiSelect) {
            this.popupRef.current?.close();
        }

        onSelect?.(id === "empty" ? "" : id, this.mergedProps);
    };

    private handleOpen = (): void => {
        this.saveSelection();

        if (this.containerRef.current && this.listRef.current) {
            const bounds = this.containerRef.current.getBoundingClientRect();
            this.listRef.current.style.width = convertPropValue(bounds.width - 2)!;

            this.containerRef.current.classList.add("manualFocus");
            this.listRef.current.classList.add("manualFocus");
        }
    };

    private handleClose = (cancelled: boolean): void => {
        const { multiSelect } = this.mergedProps;

        // In multi selection mode changes are already saved and cannot be restored here.
        if (!multiSelect && cancelled) {
            this.restoreSelection();
        }

        if (this.containerRef.current) {
            this.containerRef.current.classList.remove("manualFocus");
        }
    };

    private handleTagAdd = (value: string): void => {
        const { children } = this.mergedProps;
        const { currentSelection } = this.state;

        // See if we have a child with the value as caption and add its id to the current selection, if so.
        let id;
        React.Children.forEach(children, (child): void => {
            if (React.isValidElement(child)) {
                const { caption: childCaption, id: childId } = child.props;
                if (childCaption === value) {
                    id = childId;
                }
            }
        });

        if (id) {
            currentSelection.add(id);
            this.setState({ currentSelection });
        }
    };

    private handleTagRemove = (id: string): void => {
        const { currentSelection } = this.state;
        currentSelection.delete(id);

        this.setState({ currentSelection });
    };

    private descriptionFromId(id?: string): string {
        let result = "";
        if (id) {
            const { children } = this.mergedProps;
            React.Children.forEach(children, (child): void => {
                if (React.isValidElement(child)) {
                    if (child.props.id === id) {
                        result = child.props.description || "";
                    }
                }
            });
        }

        return result;
    }

    /**
     * @returns The index of the first selected entry or -1 if there's none.
     */
    private get indexOfFirstSelectedEntry(): number {
        const { childArray, currentSelection } = this.state;

        if (currentSelection.size > 0) {
            const selectedId = currentSelection.keys().next().value;

            return childArray.findIndex((element) => {
                if (React.isValidElement(element)) {
                    return element.props.id === selectedId;
                }

                return false;
            });
        } else {
            return -1;
        }
    }

    /**
     * Keep a copy of the current selection state for later restoration.
     */
    private saveSelection = (): void => {
        this.selectionIndexBackup = this.currentSelectionIndex;

        const { currentSelection } = this.state;
        this.selectionBackup = _.cloneDeep(currentSelection);
    };

    /**
     * Restores the previously saved selection values.
     */
    private restoreSelection = (): void => {
        this.currentSelectionIndex = this.selectionIndexBackup;
        this.setState({ currentSelection: this.selectionBackup });
    };
}
