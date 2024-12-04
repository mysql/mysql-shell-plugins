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

import type { IDisposable } from "monaco-editor"; // Only a type import. Does not import the module.
import { ComponentChild, createRef } from "preact";

import { requisitions } from "../../../supplement/Requisitions.js";
import { ThemeColor } from "../../Theming/ThemeColor.js";
import { Button } from "../Button/Button.js";
import { ComponentBase, IComponentProperties, IComponentState } from "../Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../Container/Container.js";
import { ProxyStatusBarItem } from "./ProxyStatusBarItem.js";
import { StatusBarAlignment, StatusBarItem, type IStatusBarItem, type IStatusBarItemOptions } from "./StatusBarItem.js";

const singleton = createRef<StatusBar>();

interface IStatusBarState extends IComponentState {
    items: IStatusBarItem[];
}

/**
 * This is the web application status bar, used when running the application standalone or in certain hosts.
 * If vscode is the host then the status bar is provided by the host and this component is not used.
 *
 * This implementation is based on predefined status bar items, which are defined in the properties.
 * Statusbar updates are matched using the item id.
 */
export class StatusBar extends ComponentBase<{}, IStatusBarState> {

    #scheduledTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

    public constructor() {
        super({});

        this.state = {
            items: [],
        };
    }

    /**
     * Creates a status bar {@link StatusBarItem item}.
     *
     * @param options The initial values for the new status bar item.
     *
     * @returns A new status bar item.
     */
    public static createStatusBarItem(options: IStatusBarItemOptions): IStatusBarItem {
        if (singleton.current) {
            const { items } = singleton.current.state;

            items.push(new StatusBarItem(singleton.current.update, options));
            singleton.current.setState({ items });

            return items[items.length - 1];
        }

        // If the status bar is not mounted we are in an embedded environment and have to return proxy items.
        return new ProxyStatusBarItem(options);
    }

    /**
     * Set a message to the status bar.
     *
     * @param text The message to show, supports icon substitution as in status bar {@link StatusBarItem.text items}.
     * @param hideAfterTimeout Timeout in milliseconds after which the message will be disposed.
     *
     * @returns A disposable which hides the status bar message.
     */
    public static setStatusBarMessage(text: string, hideAfterTimeout?: number): IDisposable;
    /**
     * Set a message to the status bar.
     *
     * @param text The message to show, supports icon substitution as in status bar {@link StatusBarItem.text items}.
     * @param hideWhenDone Thenable on which completion (resolve or reject) the message will be disposed.
     *
     * @returns A disposable which hides the status bar message.
     */
    public static setStatusBarMessage(text: string, hideWhenDone: Promise<unknown>): IDisposable;
    public static setStatusBarMessage(text: string, timeoutOrPromise?: Promise<unknown> | number): IDisposable {
        const details: IStatusBarItemOptions = {
            id: "msg.fe.statusBarMessage",
            text,
            alignment: StatusBarAlignment.Left,
            priority: -1000, // Show as last entry.
        };

        if (singleton.current) {
            const { items } = singleton.current.state;

            let item = items.find((item) => { return item.id === details.id; });
            if (!item) {
                item = new StatusBarItem(singleton.current.update, details);
                items.push(item);
            } else {
                item.text = text;

                // Is there a timer for this item? If so, remove it and set a new timer.
                const timer = singleton.current.#scheduledTimers.get(item.id);
                if (timer) {
                    clearTimeout(timer);
                    singleton.current.#scheduledTimers.delete(item.id);
                }
            }

            if (timeoutOrPromise === undefined || typeof timeoutOrPromise === "number") {
                item.timeout = timeoutOrPromise ?? 5000;
                if (item.timeout !== undefined) {
                    const timer = setTimeout(() => {
                        item.hide();
                    }, item.timeout);
                    singleton.current.#scheduledTimers.set(item.id, timer);
                }
            } else {
                timeoutOrPromise.then(() => {
                    item.hide();
                }).catch(() => {
                    item.hide();
                });
            }
            singleton.current.setState({ items });

            return {
                dispose: () => {
                    // Once created we keep the message item until the app is closed.
                    item.hide();
                },
            };
        }

        // The embedded scenario: promises are not supported, only timeout values.
        if (typeof timeoutOrPromise === "number") {
            details.timeout = timeoutOrPromise;
        }

        const item = new ProxyStatusBarItem(details);

        return {
            dispose: () => {
                item.dispose();
            },
        };
    }

    public override componentWillUnmount(): void {
        // Clear the timers before unmounting
        if (this.#scheduledTimers.size > 0) {
            for (const [_, timer] of this.#scheduledTimers) {
                clearTimeout(timer);
            }
            this.#scheduledTimers = new Map();
        }
    }

    public render(): ComponentChild {
        const { items } = this.state;

        const className = this.getEffectiveClassNames([
            "statusbar",
            "verticalCenterContent",
        ]);

        const leftChildren: ComponentChild[] = [];
        const rightChildren: ComponentChild[] = [];

        // Separate the items by their alignment and sort each list by priority.
        const leftItems = items.filter((item) => {
            return item.alignment === StatusBarAlignment.Left && item.visible;
        });

        const rightItems = items.filter((item) => {
            return item.alignment === StatusBarAlignment.Right && item.visible;
        });

        leftItems.sort((a, b) => {
            return (b.priority ?? -1e6) - (a.priority ?? -1e6);
        });

        rightItems.sort((a, b) => {
            return (b.priority ?? -1e6) - (a.priority ?? -1e6);
        });

        leftItems.forEach((item: IStatusBarItem, index: number) => {
            const control = this.renderItemButton(index, item);
            leftChildren.push(control);
        });

        rightItems.forEach((item: IStatusBarItem, index: number) => {
            const control = this.renderItemButton(index, item);
            rightChildren.push(control);
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
                    fixedScrollbars={false}
                >
                    {leftChildren}
                </Container>
                <Container
                    className="rightItems"
                    orientation={Orientation.LeftToRight}
                    crossAlignment={ContentAlignment.Stretch}
                    fixedScrollbars={false}
                >
                    {rightChildren}
                </Container>
            </Container >
        );
    }

    /**
     * Creates a component from the given text. Embedded icons are converted to icon components.
     *
     * @param index The index of the item used for the preact key.
     * @param item The status bar item details for rendering.
     *
     * @returns A preact component for the status bar item.
     */
    private renderItemButton(index: number, item: IStatusBarItem): ComponentChild {
        // Remove any line break.
        const text = item.text.replace(/[\n\r]/g, "");
        const elements: ComponentChild[] = [];
        let lastIndex = 0;
        const matches = [...text.matchAll(/\$\([a-z-~]+\)/g)];

        matches.forEach((match, i) => {
            // Add text before icon.
            if (match.index > lastIndex) {
                elements.push(text.substring(lastIndex, match.index));
            }

            // Convert icon to component. When the icon has the ~spin suffix, add the spin class.
            let icon = match[0].slice(2, -1);
            let className = "";
            if (icon.endsWith("~spin")) {
                className += "codicon-modifier-spin ";
                icon = icon.slice(0, -5);
            }
            className += `codicon codicon-${icon}`;

            elements.push(<span key={`icon-${index}-${i}`} className={className} />);

            lastIndex = match.index + match[0].length;
        });

        // Add text after last icon.
        if (lastIndex < text.length) {
            elements.push(text.substring(lastIndex));
        }

        const color = (item.color instanceof ThemeColor ? "var(" + item.color.variableName + ")" : item.color);
        const backgroundColor = (item.backgroundColor instanceof ThemeColor
            ? "var(" + item.backgroundColor.variableName + ")"
            : item.backgroundColor);

        return (
            <Button
                key={`statusbarItem${index}`}
                id={item.id}
                className="statusbarItem"
                data-command={item.command}
                title={item.tooltip}
                disabled={!item.command}
                imageOnly={item.text?.length === 0}
                style={{
                    color,
                    backgroundColor,
                }}
                onClick={this.handleItemClick}
            >
                {elements}
            </Button>
        );
    }

    private handleItemClick = (e: MouseEvent | KeyboardEvent, props: IComponentProperties): void => {
        void requisitions.execute("statusBarButtonClick", {
            type: "data-command" in props ? props["data-command"] as string : "", event: e,
        });
    };

    private update = (removeItem?: StatusBarItem): void => {
        const { items } = this.state;

        if (removeItem) {
            const index = items.findIndex((item) => {
                return item.id === removeItem.id;
            });

            if (index >= 0) {
                items.splice(index, 1);
            }
        }

        this.setState({ items });
    };
}

export const renderStatusBar = (): ComponentChild => {
    return <StatusBar ref={singleton} />;
};
