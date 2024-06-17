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

import "./Statusbar.css";

import { ComponentChild } from "preact";

import * as codicon from "../Codicon.js";

import { IDictionary, IStatusbarInfo } from "../../../app-logic/Types.js";
import { requisitions } from "../../../supplement/Requisitions.js";
import { ThemeColor } from "../../Theming/ThemeColor.js";
import { Button } from "../Button/Button.js";
import { ComponentBase, IComponentProperties, IComponentState } from "../Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../Container/Container.js";
import { Dropdown } from "../Dropdown/Dropdown.js";
import { Icon } from "../Icon/Icon.js";

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

    /** If true the item is right aligned in the status bar. */
    rightAlign?: boolean;
    visible?: boolean;
    tooltip?: string;
    choices?: Array<{ label: string; data: IDictionary; }>;

    /** Dedicated background color for the item. */
    color?: string | ThemeColor;

    /** If set the item can be clicked to trigger an action. */
    commandId?: string;

    /** If true then the item gets a slightly lighter background. */
    standout?: boolean;
}

interface IStatusbarProperties extends IComponentProperties {
    items: IStatusbarItem[];
}

interface IStatusbarState extends IComponentState {
    // Item ID => [caption, dropdown entries, visible, standout].
    itemDetails: Map<string, IStatusbarInfo>;
}

/**
 * This is the web application status bar, used when running the application standalone or in certain hosts.
 * If vscode is the host then the status bar is provided by the host and this component is not used.
 *
 * This implementation is based on predefined status bar items, which are defined in the properties.
 * Statusbar updates are matched using the item id.
 */
export class Statusbar extends ComponentBase<IStatusbarProperties, IStatusbarState> {

    #scheduledTimers: Array<{ id: string, timer: ReturnType<typeof setTimeout>; }> = [];

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

        // Clear the timers before unmounting
        if (this.#scheduledTimers.length > 0) {
            this.#scheduledTimers.forEach((timer) => {
                clearTimeout(timer.timer);
            });
            this.#scheduledTimers = [];
        }
    }

    public render(): ComponentChild {
        const { items } = this.mergedProps;
        const { itemDetails } = this.state;

        const className = this.getEffectiveClassNames([
            "statusbar",
            "verticalCenterContent",
        ]);

        const leftItems: ComponentChild[] = [];
        const rightItems: ComponentChild[] = [];

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
                        const dropDownItems: ComponentChild[] = [];
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
                        if (item.icon != null) {
                            icon = <Icon data-tooltip="inherit" src={info.icon} />;
                        }

                        control = (
                            <Button
                                key={`statusbarItem${index}`}
                                className={itemClass}
                                caption={info.text}
                                data-command={item.commandId}
                                title={info.tooltip}
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

    private handleItemClick = (e: MouseEvent | KeyboardEvent, props: IComponentProperties): void => {
        void requisitions.execute("statusBarButtonClick", {
            type: "data-command" in props ? props["data-command"] as string : "", event: e,
        });
    };

    private handleItemChange = (accept: boolean, selectedIds: Set<string>): void => {
        void requisitions.execute("changeProfile", [...selectedIds][0]);
    };

    private updateStatusItems = (data: IStatusbarInfo[]): void => {
        const { itemDetails } = this.state;

        data.forEach((info: IStatusbarInfo) => {
            const item = itemDetails.get(info.id);
            if (item) {
                Object.assign(item, info);

                // Check if there already is a timer for this id, if so clear it and remove it from list
                const timerItem = this.#scheduledTimers.find((timer) => {
                    return timer.id === info.id;
                });
                if (timerItem !== undefined) {
                    clearTimeout(timerItem?.timer);
                }
                this.#scheduledTimers = this.#scheduledTimers.filter((timer) => {
                    return timer.id === info.id;
                });

                // If a new hideAfter value has been set, ensure to clean the text after the hideAfter timeout
                if (info.hideAfter) {
                    this.#scheduledTimers.push({
                        id: info.id, timer: setTimeout(() => {
                            this.updateStatusItems([{ id: info.id, text: "", visible: true }]);
                        }, info.hideAfter),
                    });
                }
            }
        });

        this.setState({ itemDetails });
    };

}
