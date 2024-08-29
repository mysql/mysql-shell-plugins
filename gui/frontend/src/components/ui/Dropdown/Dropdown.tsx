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

import "./Dropdown.css";

import { cloneElement, ComponentChild, createRef } from "preact";

import { DropdownItem, IDropdownItemProperties } from "./DropdownItem.js";
import { convertPropValue } from "../../../utilities/string-helpers.js";
import { collectVNodes } from "../../../utilities/preact-helpers.js";
import {
    IComponentProperties, IComponentState, ComponentBase, ComponentPlacement, FocusEventType,
} from "../Component/ComponentBase.js";
import { Container, Orientation, ContentAlignment } from "../Container/Container.js";
import { Divider } from "../Divider/Divider.js";
import { Label } from "../Label/Label.js";
import { Popup } from "../Popup/Popup.js";
import { ITag, TagInput } from "../TagInput/TagInput.js";
import { KeyboardKeys } from "../../../utilities/helpers.js";

export interface IDropdownProperties extends IComponentProperties {
    /** A single id or a set of it that identify the items that shall be selected. */
    selection?: string | Set<string>;

    /** The id of the default item, if nothing is selected. */
    defaultId?: string;

    /**
     * If set, no value needs to be picked and the result can be empty.
     * Adds an extra entry to the list with no caption.
     */
    optional?: boolean;

    /**
     * When set an extra description field is show belong the list of items, which shows the description of the
     * currently hovered item.
     */
    showDescription?: boolean;

    /** If set, only the icon of the selected item is shown, not the caption. */
    iconOnly?: boolean;

    /**
     * If set, the dropdown allows multiple items to be selected at once.
     * Each item is prefaced with a checkbox which allows the user to select or deselect it.
     */
    multiSelect?: boolean;

    /**
     * If set, the arrow is not shown.
     */
    withoutArrow?: boolean;

    /** If set this string is shown as placeholder if nothing is selected yet (only useful when optional is true). */
    placeholder?: string;

    autoFocus?: boolean;

    /**
     * Called when the user selects an item.
     *
     * @param accept Set to true selected an item that caused the drop down to close (e.g. an item click).
     * @param selection The new selection.
     * @param props The current properties of the dropdown.
     */
    onSelect?: (accept: boolean, selection: Set<string>, props: IDropdownProperties) => void;
    onCancel?: () => void;
}

interface IDropdownState extends IComponentState {
    hotId?: string;
}

export class Dropdown extends ComponentBase<IDropdownProperties, IDropdownState> {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    public static Item = DropdownItem;

    public static override defaultProps = {
        optional: false,
        showDescription: false,
        multiSelect: false,
        withoutArrow: false,
    };

    private readonly containerRef = createRef<HTMLDivElement>();
    private readonly listRef = createRef<HTMLDivElement>();
    private readonly popupRef = createRef<Popup>();

    private currentSelectionIndex = -1; // Tracks the currently selected item index for keyboard based selection.
    private selectionIndexBackup = -1;
    private selectionBackup?: Set<string>;

    public constructor(props: IDropdownProperties) {
        super(props);

        this.state = {
        };

        this.addHandledProperties("selection", "defaultId", "optional", "showDescription", "iconOnly", "multiSelect",
            "withoutArrow", "autoFocus", "onSelect", "onCancel");

        this.connectEvents("onFocus", "onBlur");
    }

    public override componentDidMount(): void {
        const { autoFocus } = this.mergedProps;

        this.currentSelectionIndex = this.indexOfFirstSelectedEntry;
        if ((this.containerRef.current) && autoFocus) {
            setTimeout(() => {
                this.containerRef.current!.focus();
            }, 0);
        }
    }

    public override componentDidUpdate(): void {
        if ((!this.popupRef.current || !this.popupRef.current.isOpen) && (this.containerRef.current != null)) {
            // Set back the focus to the drop down, once the popup was closed.
            // This is independent of the auto focus property, because for the popup to show
            // the dropdown had to have the focus anyway.
            if (this.containerRef.current.classList.contains("manualFocus")) {
                this.containerRef.current.classList.remove("manualFocus");
                this.containerRef.current.focus();
            }
        } else if (this.containerRef.current) {
            const boundingRect = this.containerRef.current.getBoundingClientRect();
            this.popupRef.current?.updatePosition(boundingRect);
        }

        this.currentSelectionIndex = this.indexOfFirstSelectedEntry;
    }

    public render(): ComponentChild {
        const {
            children, id, defaultId, selection, optional, showDescription, withoutArrow, multiSelect,
            placeholder, iconOnly, disabled,
        } = this.mergedProps;
        const { hotId } = this.state;

        const currentSelection = typeof selection === "string" ? new Set([selection]) : selection;
        const currentDescription = this.descriptionFromId(hotId || currentSelection?.values().next().value as string);

        const className = this.getEffectiveClassNames([
            "dropdown",
            withoutArrow ? "withoutArrow" : "",
            this.classFromProperty(multiSelect, "multiSelect"),
            this.classFromProperty(disabled, "disabled"),
        ]);

        const tags: ITag[] = [];
        let content = null;
        const childArray = collectVNodes<IDropdownItemProperties>(children);
        content = childArray.map((child): ComponentChild => {
            let itemClassName = "";
            let checked = false;

            const { id: childId, caption: childCaption, picture } = child.props;
            if (currentSelection?.has(childId as string)) {
                tags.push({ id: childId ?? "", caption: childCaption, picture });
                checked = true;
            }

            if (defaultId && childId === defaultId) {
                itemClassName = "default";
            }

            return cloneElement(child, {
                onMouseEnter: this.handleItemMouseEnter,
                onMouseLeave: this.handleItemMouseLeave,
                onClick: this.handleItemClick,
                className: itemClassName,
                selected: !multiSelect && currentSelection?.has(childId as string),
                checked: multiSelect ? checked : undefined,
            } as IComponentProperties);
        });

        if (optional) {
            // Being optional means we have an entry with no value.
            content?.splice(0, 0,
                <DropdownItem
                    id="empty"
                    caption="empty"
                    key="empty"
                    selected={currentSelection?.has("empty")}

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
                    removable={false}
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
                        data-tooltip="inherit"
                    >
                        {tags[0].picture}
                        {!iconOnly && tags[0].caption && <Label>{tags[0].caption}</Label>}
                    </Container>;
                } else {
                    inputContent = <Label className="ellipsis">{tags[0].caption}</Label>;
                }
            } else if (placeholder) {
                inputContent = <Label className="placeholder" data-tooltip="inherit">{placeholder}</Label>;
            }

            inputControl =
                <Container
                    innerRef={this.containerRef}
                    className={className}
                    tabIndex={0}
                    onClick={this.handleClick}
                    onKeyDown={this.handleKeydown}
                    crossAlignment={ContentAlignment.Center}
                    data-tooltip="inherit"
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
                    className="dropdownList"
                    innerRef={this.listRef}
                    id={`${id ?? ""}Popup`}
                    showArrow={false}
                    placement={ComponentPlacement.BottomRight}
                    onOpen={this.handleOpen}
                    onClose={this.handleClose}
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

    protected override handleFocusEvent(type: FocusEventType, e: FocusEvent): boolean {
        if (type === FocusEventType.Focus) {
            this.containerRef.current?.classList.add("manualFocus");
        } else {
            this.containerRef.current?.classList.remove("manualFocus");

            // Shifting focus away usually means the user no longer wants the drop down open.
            // This is handled as a cancel event, since any selection by click or keyboard is already accepted.
            // There's one exception, however: If the focus is shifted to the popup itself, the user might want to
            // select an item from the list.
            const element = e.relatedTarget as HTMLElement;
            if (element && !element.classList.contains("dropdownList")) {
                if (this.popupRef.current?.isOpen) {
                    this.popupRef.current?.close(true);
                } else {
                    // If the dropdown isn't shown currently, the close event isn't called by the popup.
                    // So do it manually.
                    this.handleClose(true);
                }
            }
        }

        return true;
    }

    private readonly handleClick = (e: MouseEvent | KeyboardEvent): void => {
        const element = e.currentTarget as HTMLElement;
        this.popupRef.current?.open(element.getBoundingClientRect(), { backgroundOpacity: 0 });
    };

    private readonly handleKeydown = (e: KeyboardEvent): void => {
        const { children } = this.mergedProps;
        const childArray = collectVNodes<IDropdownItemProperties>(children);

        const element = e.currentTarget as HTMLElement;
        switch (e.key) {
            case KeyboardKeys.Enter:
            case KeyboardKeys.Space: {
                if (this.popupRef.current?.isOpen) {
                    // The dropdown is already open, which means the user accepts the current selection.
                    this.saveSelection();
                    this.popupRef.current.close(false);

                    const current = childArray[this.currentSelectionIndex];
                    const id = current.props.id;
                    if (id) {
                        this.toggleSelectedItem(id, false, true);
                    }
                } else {
                    this.popupRef.current?.open(element.getBoundingClientRect(), { backgroundOpacity: 0 });
                }
                e.stopPropagation();
                e.preventDefault();

                break;
            }

            case KeyboardKeys.ArrowDown: {
                if (this.currentSelectionIndex === -1) {
                    this.currentSelectionIndex = this.indexOfFirstSelectedEntry + 1;
                } else {
                    ++this.currentSelectionIndex;
                }

                if (this.currentSelectionIndex === childArray.length) {
                    this.currentSelectionIndex = 0;
                }

                const current = childArray[this.currentSelectionIndex];
                const id = current.props.id;
                if (id) {
                    this.toggleSelectedItem(id, true, false);
                }
                e.stopPropagation();
                e.preventDefault();

                break;
            }

            case KeyboardKeys.ArrowUp: {
                if (this.currentSelectionIndex === -1) {
                    this.currentSelectionIndex = this.indexOfFirstSelectedEntry - 1;
                } else {
                    --this.currentSelectionIndex;
                }

                if (this.currentSelectionIndex < 0) {
                    this.currentSelectionIndex = childArray.length - 1;
                }

                const current = childArray[this.currentSelectionIndex];
                const id = current.props.id;
                if (id) {
                    this.toggleSelectedItem(id, true, false);
                }

                e.stopPropagation();
                e.preventDefault();

                break;
            }

            case KeyboardKeys.Tab: { // Focus out for the dropdown list (not the dropdown itself).
                this.saveSelection();
                this.popupRef.current?.close(true);

                break;
            }

            default: {
                break;
            }
        }
    };

    private readonly handleItemMouseEnter = (e: MouseEvent, props: IDropdownItemProperties): void => {
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

        const element = e.currentTarget as HTMLElement;
        element.classList.add("selected");
    };

    private readonly handleItemMouseLeave = (e: MouseEvent, props: IDropdownItemProperties): void => {
        const { showDescription } = this.mergedProps;
        if (showDescription) {
            this.setState({ hotId: props.id });
        }

        const element = e.currentTarget as HTMLElement;
        element.classList.remove("selected");
    };

    private readonly handleItemClick = (e: MouseEvent | KeyboardEvent, props: IDropdownItemProperties): void => {
        const { multiSelect } = this.mergedProps;

        if (props.id) {
            if (this.containerRef.current) {
                this.containerRef.current.setAttribute("value", props.id);
            }
            this.toggleSelectedItem(props.id, false, true);
        }

        if (!multiSelect) {
            this.popupRef.current?.close(false);
        }
    };

    /**
     * Adds or removes the item with the given id from the current selection.
     * Calls onSelect with the modified selection, which in turn will usually re-render the component.
     *
     * @param id The item to toggle.
     * @param replace If true then the current selection is cleared and the item becomes the only selection entry.
     * @param accept If true then the selection is accepted and the dropdown is closed.
     */
    private readonly toggleSelectedItem = (id: string, replace: boolean, accept: boolean): void => {
        const { selection, multiSelect, optional, onSelect } = this.mergedProps;

        let newSelection: Set<string>;
        if (optional && id === "empty") {
            newSelection = new Set();
        } else {
            newSelection = new Set((replace || !multiSelect) ? new Set<string>() : selection);
            if (newSelection.has(id)) {
                newSelection.delete(id);
            } else {
                newSelection.add(id);
            }
        }

        onSelect?.(accept, newSelection, this.props);
    };

    private readonly handleOpen = (): void => {
        this.saveSelection();

        if ((this.containerRef.current != null) && (this.listRef.current != null)) {
            const bounds = this.containerRef.current.getBoundingClientRect();
            this.listRef.current.style.width = convertPropValue(bounds.width)!;

            this.containerRef.current.classList.add("manualFocus");
            this.listRef.current.classList.add("manualFocus");
        }
    };

    private readonly handleClose = (cancelled: boolean): void => {
        const { multiSelect, onCancel } = this.mergedProps;

        // In multi selection mode changes are already saved and cannot be restored here.
        if (cancelled) {
            if (!multiSelect) {
                // Restore the previous selection.
                this.currentSelectionIndex = this.selectionIndexBackup;
            }

            onCancel?.();
        }

        this.containerRef.current?.classList.remove("manualFocus");
    };

    private readonly handleTagAdd = (value: string): void => {
        const { children } = this.mergedProps;
        const childArray = collectVNodes<IDropdownItemProperties>(children);

        // See if we have a child with the value as caption and add its id to the current selection, if so.
        let id;
        childArray.forEach((child) => {
            const { caption: childCaption, id: childId } = child.props;
            if (childCaption === value) {
                id = childId;
            }
        });

        if (id) {
            this.toggleSelectedItem(id, false, false);
        }
    };

    private readonly handleTagRemove = (id: string): void => {
        this.toggleSelectedItem(id, false, false);
    };

    private descriptionFromId(id?: string): string {
        let result = "";
        if (id) {
            const { children } = this.mergedProps;
            const childArray = collectVNodes<IDropdownItemProperties>(children);

            childArray.forEach((child): void => {
                if (child.props.id === id) {
                    result = child.props.description ?? "";
                }
            });
        }

        return result;
    }

    /**
     * @returns The index of the first selected entry or -1 if there's none.
     */
    private get indexOfFirstSelectedEntry(): number {
        const { selection } = this.mergedProps;
        const { children } = this.mergedProps;
        const childArray = collectVNodes<IDropdownItemProperties>(children);

        const currentSelection = typeof selection === "string" ? new Set<string>([selection]) : selection;
        if ((currentSelection != null) && currentSelection.size > 0) {
            const selectedId = currentSelection.keys().next().value;

            return childArray.findIndex((element) => {
                return element.props.id === selectedId;
            });
        } else {
            return -1;
        }
    }

    /**
     * Keep a copy of the current selection state for later restoration.
     */
    private readonly saveSelection = (): void => {
        const { selection } = this.mergedProps;

        this.selectionIndexBackup = this.currentSelectionIndex;
        this.selectionBackup = typeof selection === "string" ? new Set<string>([selection]) : selection;
    };

}
