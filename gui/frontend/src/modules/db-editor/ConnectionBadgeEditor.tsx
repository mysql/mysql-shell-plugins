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

import "./ConnectionBadgeEditor.css";

import { ComponentChild } from "preact";

import { IDictionary } from "../../app-logic/general-types.js";
import {
    IValueEditCustomProperties, ValueEditCustom,
} from "../../components/Dialogs/ValueEditCustom.js";
import { Button } from "../../components/ui/Button/Button.js";
import { Codicon } from "../../components/ui/Codicon.js";
import { IComponentState } from "../../components/ui/Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../../components/ui/Container/Container.js";
import { Dropdown } from "../../components/ui/Dropdown/Dropdown.js";
import { DropdownItem } from "../../components/ui/Dropdown/DropdownItem.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import { Input, IInputChangeProperties } from "../../components/ui/Input/Input.js";

interface IConnectionBadgeEditorValues extends IDictionary {
    badges?: IDictionary;
}

interface IConnectionBadgeEditorState extends IComponentState {
    newBadgeText: string;
    newBadgeColor: string;
}

export class ConnectionBadgeEditor extends ValueEditCustom<IValueEditCustomProperties, IConnectionBadgeEditorState> {
    public static readonly colors = [
        "#ff2d55", "#ff9f0a", "#ffd60a", "#32d74b",
        "#c7c7c7", "#0a84ff", "#bf5af2", "#ff4fd8",
        "#7f1d1d", "#7c2d12", "#713f12", "#14532d",
        "#3f3f46", "#1e3a8a", "#4c1d95", "#831843",
    ];

    public constructor(props: IValueEditCustomProperties) {
        super(props);

        this.state = {
            newBadgeText: "",
            newBadgeColor: ConnectionBadgeEditor.colors[0],
        };
    }

    public override render(): ComponentChild {
        return (
            <Container
                className="connectionBadgeEditor"
                orientation={Orientation.TopDown}
                crossAlignment={ContentAlignment.Stretch}
            >
                <Container className="badgeList" orientation={Orientation.LeftToRight}>
                    {Object.entries(this.badges).map(([text, color]) => {
                        const foreground = this.badgeForeground(String(color));

                        return (
                            <span
                                key={text}
                                className="badgeChip"
                                style={{ backgroundColor: String(color), color: foreground }}
                            >
                                <span className="badgeChipText">{text}</span>
                                <Button
                                    className="badgeDeleteButton"
                                    style={{ color: foreground }}
                                    data-tooltip="Delete badge"
                                    imageOnly={true}
                                    onClick={() => {
                                        this.removeBadge(text);
                                    }}
                                >
                                    <Icon src={Codicon.Close} data-tooltip="inherit" />
                                </Button>
                            </span>
                        );
                    })}
                </Container>
                <Container
                    className="badgeAddRow"
                    orientation={Orientation.LeftToRight}
                    crossAlignment={ContentAlignment.Center}
                >
                    <Input
                        className="badgeTextInput"
                        placeholder="Badge text"
                        value={this.state.newBadgeText}
                        onChange={this.handleBadgeTextChange}
                        onConfirm={this.handleAddBadge}
                    />
                    <Dropdown
                        className="badgeColorDropdown"
                        selection={this.state.newBadgeColor}
                        onSelect={this.handleColorSelect}
                    >
                        {ConnectionBadgeEditor.colors.map((color) => {
                            return (
                                <DropdownItem
                                    id={color}
                                    key={color}
                                    className="badgeColorDropdownItem"
                                    picture={<span className="badgeColorSwatch" style={{ backgroundColor: color }} />}
                                />
                            );
                        })}
                    </Dropdown>
                    <Button
                        className="badgeAddButton"
                        data-tooltip="Add badge"
                        onClick={this.handleAddBadge}
                    >
                        Add
                    </Button>
                </Container>
            </Container>
        );
    }

    private get badges(): IDictionary {
        return (this.props.values as IConnectionBadgeEditorValues | undefined)?.badges ?? {};
    }

    private handleBadgeTextChange = (_e: InputEvent, props: IInputChangeProperties): void => {
        this.setState({ newBadgeText: props.value.slice(0, 16) });
    };

    private handleColorSelect = (_accept: boolean, selection: Set<string>): void => {
        const [color] = [...selection];
        if (color) {
            this.setState({ newBadgeColor: color });
        }
    };

    private handleAddBadge = (): void => {
        const text = this.state.newBadgeText.trim();
        if (text.length === 0) {
            return;
        }

        const badges = { ...this.badges, [text]: this.state.newBadgeColor };
        this.props.onDataChange?.({ badges });
        this.setState({ newBadgeText: "" });
    };

    private removeBadge(text: string): void {
        const badges = { ...this.badges };
        delete badges[text];
        this.props.onDataChange?.({ badges });
    }

    private badgeForeground(color: string): string {
        return ConnectionBadgeEditor.colors.slice(0, 8).includes(color.toLocaleLowerCase()) ? "#303030" : "#ffffff";
    }
}
