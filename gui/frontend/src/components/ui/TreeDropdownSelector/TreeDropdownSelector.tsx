/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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

import { Component, createRef, RefObject } from "preact";

import { ComponentPlacement } from "../Component/ComponentBase.js";
import { IInputChangeProperties, Input } from "../Input/Input.js";
import { Label } from "../Label/Label.js";
import { Popup } from "../Popup/Popup.js";
import { buildTree, ITreeFlatNode, ITreeNode } from "./tree.js";
import "./TreeDropdownSelector.css";

interface ISearchableItem extends ITreeFlatNode {
    id: string;
    label: string;
}

interface ISearchableSelectorProps {
    /** Array of items to display in the tree */
    items: ISearchableItem[];
    /** Currently selected item ID (controlled mode) */
    selected?: string | null;
    /** Callback when an item is selected */
    onSelect?: (id: string | null) => void;
    /** Whether the component is disabled */
    disabled?: boolean;
    /** Placeholder text when nothing is selected */
    placeholder?: string;
    tooltip?: string;
    /** Additional CSS class name */
    className?: string;
    /** Whether the selection can be cleared */
    clearable?: boolean;
}

interface ISearchableSelectorState {
    filterString: string;
    expandedIds: Set<string>;
    tree: ISelectorTreeNode[];
    open: boolean;
    selectedId: string | null;
}

type ISelectorTreeNode = ITreeNode<ISearchableItem>;

/**
 * Collects all nodes with children into the expandedSet.
 *
 * @param nodes - Array of tree nodes to process.
 * @param expandedSet - Set to populate with IDs of nodes that have children.
 */
const collectExpandable = (nodes: ISelectorTreeNode[], expandedSet: Set<string>) => {
    for (const node of nodes) {
        if (node.children.length > 0) {
            expandedSet.add(node.id);
            collectExpandable(node.children, expandedSet);
        }
    }
};

/**
 * Filters a tree structure based on a search string.
 *
 * @param nodes - Array of tree nodes to filter.
 * @param filter - Search string to filter by (case-insensitive; compared using a lowercase match).
 * @returns Filtered array of tree nodes.
 */
const filterTree = (nodes: ISelectorTreeNode[], filter: string): ISelectorTreeNode[] => {
    if (!filter) {
        return nodes;
    }
    const filterLower = filter.toLowerCase();

    /**
     * Checks if a label matches the filter string.
     *
     * @param label - Label to check.
     * @returns True if the label contains the filter string, false otherwise.
     */
    const anyLabelMatches = (label: string) => {
        return label.toLowerCase().includes(filterLower);
    };

    /**
     * Filters a single tree node and its children.
     *
     * @param node - Tree node to filter.
     * @returns Filtered tree node if it matches the filter, null otherwise.
     */
    const filterNode = (node: ISelectorTreeNode): ISelectorTreeNode | null => {
        const labelMatch = anyLabelMatches(node.label);
        const filteredChildren = node.children
            .map(filterNode)
            .filter(Boolean) as ISelectorTreeNode[];
        if (labelMatch || filteredChildren.length) {
            return {
                ...node,
                children: filteredChildren,
            };
        }

        return null;
    };

    return nodes
        .map(filterNode)
        .filter(Boolean) as ISelectorTreeNode[];
};

/**
 * Highlights matching text in a label based on a filter string.
 *
 * @param label - Label to highlight.
 * @param filter - Filter string to match.
 * @returns JSX element with highlighted match or original label.
 */
export class TreeDropdownSelector extends Component<ISearchableSelectorProps, ISearchableSelectorState> {
    public static override defaultProps: Partial<ISearchableSelectorProps> = {
        placeholder: "Not selected",
    };

    private dropdownListRef: RefObject<HTMLDivElement>;
    private selectedItemRef: RefObject<HTMLSpanElement>;
    private popupRef: RefObject<Popup>;
    private collapsedRef: RefObject<HTMLDivElement>;

    public constructor(props: ISearchableSelectorProps) {
        super(props);
        const tree = buildTree(props.items);
        const expandedIds = new Set<string>();
        collectExpandable(tree, expandedIds);
        this.state = {
            filterString: "",
            expandedIds,
            tree,
            open: false,
            selectedId: props.selected ?? null,
        };
        this.dropdownListRef = createRef();
        this.selectedItemRef = createRef();
        this.popupRef = createRef();
        this.collapsedRef = createRef();
    }

    public override componentDidUpdate(prevProps: ISearchableSelectorProps, prevState: ISearchableSelectorState) {
        // If opening popup, open the Popup component
        if (!prevState.open && this.state.open && this.popupRef.current && this.collapsedRef.current) {
            const rect = this.collapsedRef.current.getBoundingClientRect();
            this.popupRef.current.open(rect);
        }
        // If closing popup, close the Popup component
        if (prevState.open && !this.state.open && this.popupRef.current) {
            this.popupRef.current.close(false);
        }

        // If items prop changes, rebuild tree and reset expandedIds
        if (this.props.items !== prevProps.items) {
            // Rebuild tree but keep current expandedIds where possible,
            // to preserve user's collapsed/expanded state on data updates.
            const newTree = buildTree(this.props.items);
            // Find all currently-expandable node IDs in the new tree
            const newExpandable = new Set<string>();
            collectExpandable(newTree, newExpandable);
            // Retain expansion state for IDs that still exist after items update
            const preservedExpanded = new Set<string>();
            for (const id of this.state.expandedIds) {
                if (newExpandable.has(id)) {
                    preservedExpanded.add(id);
                }
            }

            // Important UX fix:
            // If the dropdown was opened before data arrived (items empty), expandedIds will be empty.
            // After async items update, we still want roots expanded on the *first* interaction.
            // So if we have no preserved expansion state, default to "expand all".
            const nextExpandedIds = preservedExpanded.size > 0 ? preservedExpanded : newExpandable;
            this.setState({
                tree: newTree,
                expandedIds: nextExpandedIds,
            });
        }

        // If parent controls selection, update internal state accordingly
        if (this.props.selected !== prevProps.selected) {
            this.setState({ selectedId: this.props.selected ?? null });
        }
        // When opening the dropdown, scroll to selected item if needed
        if (!prevState.open && this.state.open) {
            setTimeout(() => { // Delay required to ensure DOM is rendered
                if (
                    this.selectedItemRef.current &&
                    this.dropdownListRef.current &&
                    typeof this.selectedItemRef.current.scrollIntoView === "function"
                ) {
                    this.selectedItemRef.current.scrollIntoView({
                        block: "nearest",
                        behavior: "auto"
                    });
                }
            }, 0);
        }
    }

    public override render() {
        const { filterString, tree, open, selectedId } = this.state;
        const { items, selected, disabled, placeholder, tooltip, className, clearable } = this.props;
        const effectiveSelected = (selected !== undefined ? selected : selectedId);

        const filteredTree = filterTree(tree, filterString);

        let selectedPathLabel = "";
        if (effectiveSelected && items.length) {
            const idToItem = new Map(items.map(i => {
                return [i.id, i];
            }));
            let cursor = idToItem.get(effectiveSelected);
            const path: string[] = [];
            while (cursor) {
                path.unshift(cursor.label);
                cursor = cursor.parent ? idToItem.get(cursor.parent) : undefined;
            }
            // Skip root ancestor in the displayed path when the selected item
            // is not the root itself (e.g. show "Child / Grandchild" instead of
            // "Root / Child / Grandchild").  The root label is only shown when
            // the root item itself is the current selection.
            if (path.length > 1) {
                path.shift();
            }
            selectedPathLabel = path.join(" / ");
        }

        const rootClassName = ["tds-root", className].filter(Boolean).join(" ");
        const labelClassName = selectedPathLabel ? "tds-selected-label" : "tds-placeholder";

        return (
            <div className={rootClassName}>
                <div
                    className={"tds-container tds-collapsed" + (disabled ? " tds-disabled" : "")}
                    ref={this.collapsedRef}
                    onClick={() => {
                        if (!open && !disabled) {
                            this.setState({ open: true });
                        }
                    }}
                    onKeyDown={(e: KeyboardEvent) => {
                        if (disabled) {
                            return;
                        }
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (!open) {
                                this.setState({ open: true });
                            }
                        }
                    }}
                    tabIndex={disabled ? -1 : 0}
                    role="combobox"
                    aria-expanded={open}
                    aria-haspopup="listbox"
                    aria-disabled={disabled}
                    style={open ? { pointerEvents: "none", opacity: 0.5 } : {}}
                >
                    <Label
                        caption={selectedPathLabel ? selectedPathLabel : placeholder}
                        className={labelClassName}
                        data-tooltip={tooltip}
                    />
                    {clearable && selectedPathLabel && !open && (
                        <span
                            className="tds-clear"
                            onClick={(e: MouseEvent) => {
                                e.stopPropagation();
                                this.handleClear();
                            }}
                            title="Clear selection"
                            aria-label="Clear selection"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e: KeyboardEvent) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    this.handleClear();
                                }
                            }}
                        >✕</span>
                    )}
                </div>
                <Popup
                    ref={this.popupRef}
                    showArrow={false}
                    onClose={() => {
                        const expandedIds = new Set<string>();
                        collectExpandable(this.state.tree, expandedIds);
                        this.setState({
                            open: false,
                            filterString: "",
                            expandedIds
                        });
                    }}
                    placement={ComponentPlacement.BottomLeft}
                >
                    {open && (
                        <div className="tds-container tds-expanded">
                            <div className="tds-popup-header">
                                <Input
                                    className="tds-filter tds-filter-row"
                                    // ref={this.filterInputRef}
                                    autoFocus
                                    placeholder="Filter..."
                                    value={filterString}
                                    onChange={this.onFilterChange}
                                    aria-label="Filter items"
                                />
                                <div
                                    className="tds-close"
                                    onClick={() => {
                                        this.setState({open: false});
                                    }}
                                    onKeyDown={(e: KeyboardEvent) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            this.setState({open: false});
                                        }
                                    }}
                                    title="Close"
                                    aria-label="Close"
                                    role="button"
                                    tabIndex={0}
                                >✕</div>
                            </div>
                            <div className="tds-list" ref={this.dropdownListRef} role="listbox">
                                {filteredTree.length > 0
                                    ? this.renderTree(filteredTree, 0, filterString, effectiveSelected)
                                    : <div className="tds-empty-message">No matching items</div>
                                }
                            </div>
                        </div>
                    )}
                </Popup>
            </div>
        );
    }

    private onFilterChange = (_e: InputEvent, props: IInputChangeProperties) => {
        const {value} = props;

        const expandedIds = new Set<string>();
        collectExpandable(this.state.tree, expandedIds);
        this.setState({filterString: value, expandedIds});
    };

    private handleSelect = (id: string) => {
        if (this.props.onSelect) {
            this.props.onSelect(id);
        } else {
            this.setState({selectedId: id});
        }
        this.setState({open: false, filterString: ""});
    };

    private handleClear = () => {
        if (this.props.onSelect) {
            this.props.onSelect(null);
        } else {
            this.setState({selectedId: null });
        }
    };

    private handleToggleExpand = (id: string) => {
        this.setState((prevState) => {
            const expandedIds = new Set(prevState.expandedIds);
            if (expandedIds.has(id)) {
                expandedIds.delete(id);
            } else {
                expandedIds.add(id);
            }

            return { expandedIds };
        });
    };

    private highlightMatch = (label: string, filter: string) => {
        if (!filter) {
            return label;
        }
        const idx = label.toLowerCase().indexOf(filter.toLowerCase());
        if (idx === -1) {
            return label;
        }
        const before = label.slice(0, idx);
        const match = label.slice(idx, idx + filter.length);
        const after = label.slice(idx + filter.length);

        return (
            <>
                {before}
                <b>{match}</b>
                {after}
            </>
        );
    };

    private renderTree(
        nodes: ISelectorTreeNode[],
        level = 0,
        filter = "",
        selectedId: string | null = null
    ) {
        const { expandedIds } = this.state;

        return (
            <ul className="tds-tree" style={{ paddingLeft: level ? 16 : 0 }} role="group">
                {nodes.map((node) => {
                    const hasChildren = node.children.length > 0;
                    const isExpanded = expandedIds.has(node.id);
                    const isSelected = selectedId === node.id;

                    return (
                        <li key={node.id} className="tds-item-row" role="none">
                            {hasChildren && (
                                <span
                                    className={"tds-arrow" + (isExpanded ? " tds-arrow-expanded" : "")}
                                    onClick={() => {
                                        this.handleToggleExpand(node.id);
                                    }}
                                    onKeyDown={(e: KeyboardEvent) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            this.handleToggleExpand(node.id);
                                        }
                                    }}
                                    aria-label={isExpanded ? "Collapse" : "Expand"}
                                    role="button"
                                    tabIndex={0}
                                >
                                    {isExpanded ? "▼" : "▶"}
                                </span>
                            )}
                            {!hasChildren && <span className="tds-arrow-placeholder"></span>}
                            <span
                                className={"tds-item" + (isSelected ? " tds-item-selected" : "")}
                                ref={isSelected ? this.selectedItemRef : undefined}
                                onClick={() => {
                                    this.handleSelect(node.id);
                                }}
                                onKeyDown={(e: KeyboardEvent) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        this.handleSelect(node.id);
                                    }
                                }}
                                tabIndex={0}
                                role="option"
                                aria-selected={isSelected}
                            >
                                {this.highlightMatch(node.label, filter)}
                            </span>
                            {hasChildren && isExpanded && this.renderTree(node.children, level + 1, filter, selectedId)}
                        </li>
                    );
                })}
            </ul>
        );
    }
}
