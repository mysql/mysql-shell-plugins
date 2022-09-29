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

import "./Statusbar.css";

import React from "react";
import { isNil } from "lodash";
import * as codicon from "../Codicon";

import { Component, IComponentProperties, Container, Button, Orientation, Dropdown } from "..";
import { ThemeColor } from "../../Theming/ThemeColor";
import { IComponentState } from "../Component/Component";
import { ContentAlignment } from "../Container/Container";
import { requisitions } from "../../../supplement/Requisitions";
import { Icon } from "../Icon/Icon";
import { IDictionary, IStatusbarInfo } from "../../../app-logic/Types";

export enum ControlType {
    TextType,
    ButtonType,
    DropdownType,
}

export interface IStatusbarItem {
    id: string;
    type: ControlType;
    text?: string;
    icon?: string | codicon.Codicon;
    rightAlign?: boolean;        // If true the item is right aligned in the status bar.
    visible?: boolean;
    tooltip?: string;
    choices?: Array<{ label: string; data: IDictionary }>;
    color?: string | ThemeColor; // Dedicated background color for the item.
    commandId?: string;          // If set the item can be clicked to trigger an action.
    standout?: boolean;          // If true then the item gets a slightly lighter background.
}

export interface IStatusbarProperties extends IComponentProperties {
    items: IStatusbarItem[];
}

interface IStatusbarState extends IComponentState {
    // Item ID => [caption, dropdown entries, visible, standout].
    itemDetails: Map<string, IStatusbarInfo>;
}

// The status bar is a collection of buttons that show state and/or can trigger commands.
export class Statusbar extends Component<IStatusbarProperties, IStatusbarState> {

    public constructor(props: IStatusbarProperties) {
        super(props);

        const itemDetails = new Map<string, IStatusbarInfo>();
        this.state = {
            itemDetails,
        };

        props.items.forEach((item: IStatusbarItem) => {
            itemDetails.set(item.id, {
                id: item.id,
                text: item.text || "",
                icon: item.icon,
                choices: item.choices ?? [],
                visible: item.visible ?? false,
                standout: item.standout ?? false,
            });
        });

        this.addHandledProperties("items");
    }

    public componentDidMount(): void {
        requisitions.register("updateStatusbar", this.updateStatusbar);
    }

    public componentWillUnmount(): void {
        requisitions.unregister("updateStatusbar", this.updateStatusbar);
    }

    public render(): React.ReactNode {
        const { items } = this.mergedProps;
        const { itemDetails } = this.state;

        const className = this.getEffectiveClassNames([
            "statusbar",
            "verticalCenterContent",
        ]);

        const leftItems: React.ReactNode[] = [];
        const rightItems: React.ReactNode[] = [];

        items.forEach((item: IStatusbarItem, index: number) => {
            const info = itemDetails.get(item.id);

            if (info && info.visible) {
                const color = (item.color instanceof ThemeColor ? "var(" + item.color.variableName + ")" : item.color);
                let itemClass = "statusbarItem";
                if (info.standout) {
                    itemClass += " prominent";
                }

                let control = null;
                switch (item.type) {
                    case ControlType.DropdownType: {
                        let selectedItem = "0";
                        const dropDownItems: React.ReactNode[] = [];
                        info.choices?.forEach((value, i) => {
                            const dropDownItem = (
                                <Dropdown.Item
                                    id={value.data.id as string}
                                    key={`dropDownItem${i}`}
                                    caption={value.label}
                                />
                            );
                            dropDownItems.push(dropDownItem);
                            if (info.text !== "" && info.text === String(value.data.id)) {
                                selectedItem = value.data.id as string;
                            }
                        });

                        control = (
                            <Dropdown
                                key={`statusbarItem${index}`}
                                className={itemClass}
                                withoutArrow={true}
                                selection={selectedItem}
                                onSelect={this.handleItemChange}
                                optional={false}
                                title={item.tooltip}
                            >
                                {dropDownItems}
                            </Dropdown>
                        );
                        break;
                    }

                    default: {
                        let icon;
                        if (!isNil(item.icon)) {
                            icon = <Icon src={item.icon} />;
                        }

                        control = (
                            <Button
                                key={`statusbarItem${index}`}
                                className={itemClass}
                                caption={info.text}
                                data-command={item.commandId}
                                title={item.tooltip}
                                disabled={!item.commandId || item.commandId.length === 0}
                                imageOnly={info.text?.length === 0}
                                style={{
                                    color,
                                }}
                                onClick={this.handleItemClick}
                            >
                                {icon}
                            </Button>
                        );

                        break;
                    }
                }
                if (item.rightAlign) {
                    rightItems.push(control);
                } else {
                    leftItems.push(control);
                }
            }
        });

        return (
            <Container
                className={className}
                {...this.unhandledProperties}
            >
                <Container
                    className="leftItems"
                    orientation={Orientation.LeftToRight}
                    crossAlignment={ContentAlignment.Stretch}
                >
                    {leftItems}
                </Container>
                <Container
                    className="rightItems"
                    orientation={Orientation.RightToLeft}
                    crossAlignment={ContentAlignment.Stretch}
                >
                    {rightItems}
                </Container>
            </Container>
        );
    }

    private updateStatusbar = (items: IStatusbarInfo[]): Promise<boolean> => {
        this.updateStatusItems(items);

        return Promise.resolve(true);
    };

    private handleItemClick = (e: React.SyntheticEvent, props: IComponentProperties): void => {
        void requisitions.execute("statusBarButtonClick", { type: props["data-command"], event: e });
    };

    private handleItemChange = (selectedIds: Set<string>): void => {
        void requisitions.execute("changeProfile", [...selectedIds][0]);
    };

    private updateStatusItems = (data: IStatusbarInfo[]): void => {
        const { itemDetails } = this.state;

        data.forEach((info: IStatusbarInfo) => {
            const item = itemDetails.get(info.id);
            if (item) {
                Object.assign(item, info);
            }
        });

        this.setState({ itemDetails });
    };

}
