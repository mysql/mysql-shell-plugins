/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

import "./NotificationCenter.css";

import { createRef, type ComponentChild, type RefObject } from "preact";

import { type Resolver } from "../../../app-logic/general-types.js";
import { appParameters, requisitions } from "../../../supplement/Requisitions.js";
import type { EditorLanguage } from "../../../supplement/index.js";
import { Button } from "../Button/Button.js";
import { Codicon } from "../Codicon.js";
import { ComponentBase, type IComponentProperties, type IComponentState } from "../Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../Container/Container.js";
import { Icon } from "../Icon/Icon.js";
import { Label } from "../Label/Label.js";
import { StatusBarAlignment, type IStatusBarItem } from "../Statusbar/StatusBarItem.js";
import { StatusBar } from "../Statusbar/Statusbar.js";

export enum NotificationType {
    Information,
    Warning,
    Error,
}

/** A collection of values to show as message. */
export interface INotification {
    /** The type of message to show. */
    type: NotificationType;

    /** The text of the message. */
    text: string;

    /** An optional language specifier. */
    language?: EditorLanguage | "ansi";

    /**
     * A value in milliseconds after the message toast has to be removed. Only valid for message types other than
     * error and warning.
     */
    timeout?: number;

    /** Values to show as buttons below the text. */
    items?: string[];
}

/** The base interface for all toasts. There are extended variants for the main list and the history. */
interface INotificationToast {
    /** Used to uniquely identify the toast for rendering and among lists. */
    id: number;

    details: INotification;

    /** Used when removing the toast. First it is hidden and in a second step it is removed from the list. */
    state: "normal" | "adding" | "removing";

    ref: RefObject<HTMLDivElement>;

    /** The resolver to call when the toast is closed. */
    resolve: Resolver<string>;
}

interface IHistoryToast extends INotificationToast {
    /** True if the toast has never been acted upon (no user action and not displayed in the history yet). */
    isNew: boolean;
}

/** Only used in the main list for auto closing a toast. */
interface ITimedToast extends INotificationToast {
    /** Used to auto hide the toast. */
    timer?: ReturnType<typeof setTimeout>;
}

export interface INotificationCenterProps extends IComponentProperties {
}

interface INotificationCenterState extends IComponentState {
    mainList: ITimedToast[];

    /**
     * A list of toasts that were automatically hidden because the user did not act on them. The user can later show
     * missed messages and act on them, if needed.
     *
     * Previous messages remain in this list until the list is cleared or the user took action on them.
     */
    history: IHistoryToast[];

    /** Show the history list instead of the life list. */
    showHistory: boolean;

    /** Don't show notifications other than in the history list and errors. */
    silent: boolean;
}

/**
 * A class for displaying unobtrusive messages to the user. It also allows for the user to dismiss the message
 * and to ask simple yes/no questions. Use this whenever you need to inform the user about something that is not
 * critical to the current task.
 *
 * For critical messages use the (modal) `Dialog` class.
 */
export class NotificationCenter extends ComponentBase<INotificationCenterProps, INotificationCenterState> {
    static #typeToIconMap = new Map<NotificationType, Codicon>([
        [NotificationType.Error, Codicon.Error],
        [NotificationType.Information, Codicon.Info],
        [NotificationType.Warning, Codicon.Warning],
    ]);
    static #nextToastId = 0;

    #autoHideTimeout = 15000; // 15 seconds to hide any unhandled message.
    #containerRef = createRef<HTMLDivElement>();

    #statusBarItem?: IStatusBarItem;

    public constructor(props: INotificationCenterProps) {
        super(props);
        this.state = {
            mainList: [],
            history: [],
            showHistory: false,
            silent: false,
        };
    }

    public override componentDidMount(): void {
        document.addEventListener("keydown", this.handleKeyDown);
        requisitions.register("statusBarButtonClick", this.statusBarButtonClick);
        requisitions.register("showInfo", this.showInfo);
        requisitions.register("showWarning", this.showWarning);
        requisitions.register("showError", this.showError);

        if (!appParameters.embedded) {
            this.#statusBarItem = StatusBar.createStatusBarItem({
                id: "showNotificationHistory",
                command: "notifications:showHistory",
                tooltip: "Show Notifications",
                text: "$(bell)",
                alignment: StatusBarAlignment.Right,
            });
            this.updateStatusBarItem();
        }
    }

    public override componentWillUnmount(): void {
        this.#statusBarItem?.dispose();

        document.removeEventListener("keydown", this.handleKeyDown);
        requisitions.unregister("statusBarButtonClick", this.statusBarButtonClick);
        requisitions.unregister("showInfo", this.showInfo);
        requisitions.unregister("showWarning", this.showWarning);
        requisitions.unregister("showError", this.showError);
    }

    public render(): ComponentChild {
        const { showHistory } = this.state;

        const className = this.getEffectiveClassNames([
            "notificationCenter",
            this.classFromProperty(showHistory, "history"),
        ]);

        let content;
        if (showHistory) {
            content = this.renderHistory();
        } else {
            content = this.renderMainToasts();
        }

        return (
            <Container
                innerRef={this.#containerRef}
                className={className}
                orientation={Orientation.TopDown}
            >
                {content}
            </Container>
        );
    }

    public showNotification(details: INotification): Promise<string | undefined> {
        return new Promise((resolve) => {
            this.addToast(details, resolve);
        });
    }

    public toggleHistory = (): void => {
        const { history, showHistory } = this.state;

        if (!showHistory) {
            history.forEach((toast) => {
                toast.isNew = false;
            });
        }

        this.setState({ history, showHistory: !showHistory }, () => {
            this.updateStatusBarItem();
        });
    };

    /**
     * Resolves and removes all stored messages.
     */
    public clearHistory = (): void => {
        const { history } = this.state;
        history.forEach((toast) => {
            toast.resolve(undefined);
        });

        this.setState({ history: [] }, () => {
            this.updateStatusBarItem();
        });
    };

    private renderMainToasts(): ComponentChild {
        const { mainList } = this.state;

        return mainList.map((toast, index) => {
            const details = toast.details;
            const toastClassName = this.getEffectiveClassNames([
                "toast",
                this.classFromProperty(details.type, [
                    "info", "warning", "error",
                ]),
                toast.state,
            ]);

            let margin: number | undefined;
            if (toast.state === "removing" && toast.ref.current) {
                margin = -toast.ref.current.offsetHeight;
            }

            const buttons = details.items?.map((item, index) => {
                return (
                    <Button
                        key={index}
                        className="itemButton"
                        caption={item}
                        isDefault={index === 0}
                        onClick={this.closeToast.bind(this, toast, item)}
                    />
                );
            }) ?? [];

            return (<Container
                key={toast.id}
                id={"toast-" + toast.id}
                innerRef={toast.ref}
                className={toastClassName}
                orientation={Orientation.TopDown}
                style={{ marginBottom: margin }}
            >
                <Container
                    orientation={Orientation.LeftToRight}
                >
                    <Icon src={NotificationCenter.#typeToIconMap.get(details.type)} />
                    <Label
                        key={index}
                        caption={details.text}
                        language={details.language}
                    />
                    <Button
                        className="closeButton"
                        imageOnly
                        onClick={this.closeToast.bind(this, toast, undefined)}
                    ><Icon src={Codicon.Close} /></Button>

                </Container>
                {buttons.length > 0 && (
                    <Container
                        orientation={Orientation.LeftToRight}
                        mainAlignment={ContentAlignment.End}
                    >
                        {buttons}
                    </Container>
                )}
            </Container>);
        });
    }

    private renderHistory(): ComponentChild {
        const { history } = this.state;

        const newlyAdded = history.filter((toast) => { return toast.isNew; }).length;
        let caption = "";
        if (history.length === 0) {
            caption = "NO NOTIFICATIONS";
        } else if (newlyAdded === 0) {
            caption = "NO NEW NOTIFICATIONS";
        } else {
            caption = `${newlyAdded} NEW NOTIFICATION${newlyAdded > 1 ? "S" : ""}`;
        }

        const header = (
            <Container
                id="historyHeader"
                orientation={Orientation.LeftToRight}
                crossAlignment={ContentAlignment.Center}
            >
                <Label caption={caption} />
                <Button
                    imageOnly
                    data-tooltip="Clear All Notifications"
                    onClick={this.clearHistory}
                >
                    <Icon data-tooltip="inherit" className="actionIcon" src={Codicon.ClearAll} />
                </Button>
                <Button
                    imageOnly
                    data-tooltip="Switch Do Not Disturb Mode"
                    onClick={this.toggleSilentMode}
                >
                    <Icon data-tooltip="inherit" className="actionIcon" src={Codicon.BellSlash} />
                </Button>
                <Button
                    imageOnly
                    onClick={this.toggleHistory}
                    data-tooltip="Hide Notifications (Escape)"
                >
                    <Icon data-tooltip="inherit" className="actionIcon" src={Codicon.ChevronDown} />
                </Button>
            </Container>
        );


        const content = history.map((toast, index) => {
            const details = toast.details;
            const toastClassName = this.getEffectiveClassNames([
                "toast",
                this.classFromProperty(details.type, [
                    "info", "warning", "error",
                ]),
                toast.state,
            ]);

            const buttons = details.items?.map((item, index) => {
                return (
                    <Button
                        key={index}
                        className="itemButton"
                        caption={item}
                        isDefault={index === 0}
                        onClick={this.closeToast.bind(this, toast, item)}
                    />
                );
            }) ?? [];

            return (<Container
                key={toast.id}
                innerRef={toast.ref}
                className={toastClassName}
                orientation={Orientation.TopDown}
            >
                <Container
                    orientation={Orientation.LeftToRight}
                >
                    <Icon src={NotificationCenter.#typeToIconMap.get(details.type)} />
                    <Label
                        key={index}
                        caption={details.text}
                        language={details.language}
                    />
                    <Button
                        className="closeButton"
                        imageOnly
                        onClick={this.closeToast.bind(this, toast, undefined)}
                    ><Icon src={Codicon.Close} /></Button>

                </Container>
                {buttons.length > 0 && (
                    <Container
                        orientation={Orientation.LeftToRight}
                        mainAlignment={ContentAlignment.End}
                    >
                        {buttons}
                    </Container>
                )}
            </Container>);
        });

        return [
            header,
            <Container
                id="historyContainer"
                orientation={Orientation.TopDown}
            >
                {content}
            </Container>,
        ];
    }

    private toggleSilentMode = (): void => {
        const { silent } = this.state;
        this.setState({ silent: !silent }, () => {
            this.updateStatusBarItem();
        });
    };

    /**
     * Adding a toast not only involves adding it to the lists, but also animating it into view.
     *
     * @param details The details of the toast to add.
     * @param resolve The resolver to call when the toast is closed.
     */
    private addToast(details: INotification, resolve: Resolver<string>): void {
        const { mainList, history, showHistory, silent } = this.state;

        // We need two separate toasts, linked by the same id.
        const historyToast: IHistoryToast = {
            id: NotificationCenter.#nextToastId++,
            isNew: true,
            details,
            state: "normal",
            ref: createRef<HTMLDivElement>(),
            resolve,
        };
        history.unshift(historyToast);

        // Error messages are always shown, even in silent mode.
        if (!silent || details.type === NotificationType.Error) {
            const timedToast: ITimedToast = {
                id: historyToast.id,
                details,
                state: "adding",
                ref: createRef<HTMLDivElement>(),
                resolve,
            };

            // Toasts with items or warnings and errors have a longer auto hide timeout.
            if (details.type !== NotificationType.Error && details.type !== NotificationType.Warning
                && details.items === undefined) {
                timedToast.timer = setTimeout(() => {
                    this.closeToast(timedToast, undefined);
                }, details.timeout ?? 5000);
            } else {
                timedToast.timer = setTimeout(() => {
                    this.hideToast(timedToast);
                }, this.#autoHideTimeout);
            }

            mainList.unshift(timedToast);
            if (mainList.length > 3) {
                const toast = mainList.pop();
                if (toast?.timer) {
                    clearTimeout(toast.timer);
                }
            }

            // Add the new toast to the list and trigger a re-render to bring the toast to the screen,
            // but in a hidden state so we can get its height.
            this.setState({ mainList }, () => {
                this.updateStatusBarItem();

                // Rendering of the new toast is done. Now we can animate it.
                const toast = mainList[0];

                // istanbul ignore next
                if (toast.ref.current) {
                    // Make the toast part of the normal rendering flow and set its start position.
                    toast.ref.current.style.marginBottom = `-${toast.ref.current.offsetHeight}px`;
                    toast.ref.current.classList.remove("adding");

                    setTimeout(() => {
                        // Need a timeout to let the browser render the toast in its new position.
                        // Once done remove the manual margin and let it render normally, which will
                        // animate the toast to its final position.
                        if (toast.ref.current) {
                            toast.ref.current.style.marginBottom = "";
                            toast.state = "normal";
                            this.forceUpdate();
                        }
                    }, 0);
                }
            });
        } else {
            this.updateStatusBarItem();
            if (showHistory) {
                this.forceUpdate();
            }
        }
    }

    /**
     * Called when the user did not act on the toast and its timeout has expired. The toasts will be removed
     * from the main list but kept in the history list.
     *
     * @param toast The toast to hide.
     */
    private hideToast(toast: ITimedToast): void {
        clearTimeout(toast.timer);
        toast.timer = undefined;

        toast.state = "removing";
        toast.ref.current?.addEventListener("transitionend", () => {
            const { mainList } = this.state;

            const index = mainList.indexOf(toast);
            mainList.splice(index, 1);

            toast.state = "normal";

            this.setState({ mainList });
        });

        this.forceUpdate();
    }

    /**
     * Resolves the promise of the toast and removes the toast from the main list and the history.
     *
     * @param toast The toast to close.
     * @param value The value to resolve the promise with.
     */
    private closeToast(toast: INotificationToast, value: string | undefined): void {
        const { showHistory, mainList } = this.state;

        const hasTimer = "timer" in toast;
        if (hasTimer) {
            clearTimeout(toast.timer as number);
        }

        // Remove the item from the lists, either directly (if the history is shown) or after the animation.
        const remove = () => {
            const { mainList, history } = this.state;

            let index = history.findIndex((item) => { return item.id === toast.id; });
            if (index > -1) {
                history.splice(index, 1);
            }

            index = mainList.findIndex((item) => { return item.id === toast.id; });
            if (index > -1) {
                mainList.splice(index, 1);
            }

            toast.resolve(value);

            this.setState({ mainList, history }, () => {
                this.updateStatusBarItem();
            });

        };

        toast.state = "removing";

        // istanbul ignore else
        if (showHistory) {
            remove();
        } else {
            // Cannot test this part of the code because of the animation.
            toast.ref.current?.addEventListener("transitionend", () => {
                remove();
            });
            this.setState({ mainList });
        }
    }

    /**
     * A handler for global key down. We are only interested in the escape key to close the first open toast.
     * @param e The keyboard event.
     */
    private handleKeyDown = (e: KeyboardEvent): void => {
        if (e.key === "Escape") {
            const { mainList, showHistory } = this.state;
            if (showHistory) {
                this.setState({ showHistory: false });
            } else if (mainList.length > 0) {
                this.hideToast(mainList[0]);
            }
        }
    };

    private updateStatusBarItem(): void {
        if (this.#statusBarItem) {
            const { history, silent, showHistory } = this.state;

            let tooltip;
            let text;
            if (showHistory) {
                tooltip = "Hide Notifications";
                if (silent) {
                    text = "$(bell-slash)";
                } else {
                    text = "$(bell)";
                }
            } else {
                const newlyAdded = history.filter((toast) => { return toast.isNew; }).length;
                if (silent) {
                    text = newlyAdded === 0 ? "$(bell-slash)" : "$(bell-slash-dot)";
                } else {
                    text = newlyAdded === 0 ? "$(bell)" : "$(bell-dot)";
                }

                tooltip = newlyAdded === 0 ? "No" : newlyAdded.toString();
                if (newlyAdded === 0) {
                    if (history.length > 0) {
                        tooltip += " New Notifications";
                    } else {
                        tooltip += " Notifications";
                    }
                } else {
                    tooltip += " New Notification" + (newlyAdded > 1 ? "s" : "");
                }
            }

            this.#statusBarItem.tooltip = tooltip;
            this.#statusBarItem.text = text;
        }
    }

    private statusBarButtonClick = (values: { type: string; event: MouseEvent | KeyboardEvent; }): Promise<boolean> => {
        if (values.type === "notifications:showHistory") {
            this.toggleHistory();

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

    private showInfo = async (caption: string): Promise<boolean> => {
        // Forward info messages to the hosting application.
        if (appParameters.embedded) {
            const result = requisitions.executeRemote("showInfo", caption);
            if (result) {
                return true;
            }
        }

        await this.showNotification({
            type: NotificationType.Information,
            text: caption,
        });

        return true;
    };

    private showWarning = async (message: string): Promise<boolean> => {
        // Forward info messages to the hosting application.
        if (appParameters.embedded) {
            const result = requisitions.executeRemote("showWarning", message);
            if (result) {
                return true;
            }
        }

        await this.showNotification({
            type: NotificationType.Warning,
            text: message,
        });

        return true;
    };

    private showError = async (message: string): Promise<boolean> => {
        // Forward info messages to the hosting application.
        if (appParameters.embedded) {
            const result = requisitions.executeRemote("showError", message);
            if (result) {
                return true;
            }
        }

        await this.showNotification({
            type: NotificationType.Error,
            text: message,
        });

        return true;
    };

}
