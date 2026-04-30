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

import "./UIExplainer.css";

import { ComponentChild, createRef, RefObject } from "preact";

import { Button } from "../Button/Button.js";
import { Codicon } from "../Codicon.js";
import {
    ComponentBase, ComponentPlacement, IComponentProperties, IComponentState,
} from "../Component/ComponentBase.js";
import { Icon } from "../Icon/Icon.js";
import { Popup } from "../Popup/Popup.js";
import { KeyboardKeys } from "../../../utilities/helpers.js";

export interface IUIExplainerStep {
    id: string;
    target: RefObject<HTMLElement>;
    title?: ComponentChild;
    content: ComponentChild;
    placement?: ComponentPlacement;
}

export interface IUIExplainerProperties extends IComponentProperties {
    steps: IUIExplainerStep[];
    onClose?: (completed: boolean) => void;
}

interface IUIExplainerState extends IComponentState {
    stepIndex: number;
}

const spotlightPadding = 6;

export class UIExplainer extends ComponentBase<IUIExplainerProperties, IUIExplainerState> {

    private popupRef = createRef<Popup>();
    private balloonRef = createRef<HTMLDivElement>();
    private previouslyFocused?: HTMLElement;
    private resizeObserver?: ResizeObserver;
    private positionAnimationFrame?: number;
    private completed = false;

    public constructor(props: IUIExplainerProperties) {
        super(props);

        this.state = {
            stepIndex: 0,
        };

        this.addHandledProperties("steps", "onClose");
    }

    public override componentDidUpdate(previousProps: IUIExplainerProperties): void {
        if (previousProps.steps !== this.props.steps && this.isOpen) {
            const step = this.props.steps.at(this.state.stepIndex);
            const target = step?.target.current;
            if (!target?.isConnected) {
                this.close();
            } else {
                this.observeTarget(target);
                this.schedulePositionUpdate();
            }
        }
    }

    public override componentWillUnmount(): void {
        this.stopTrackingPosition();
        this.restoreFocus();
    }

    public render(): ComponentChild {
        const { steps } = this.props;
        const { stepIndex } = this.state;
        const step = steps.at(stepIndex);
        const titleId = step ? `uiExplainer-${step.id}-title` : undefined;
        const contentId = step ? `uiExplainer-${step.id}-content` : undefined;
        const isLastStep = stepIndex === steps.length - 1;

        return <Popup
            ref={this.popupRef}
            className="uiExplainerPopup"
            placement={step?.placement ?? ComponentPlacement.BottomLeft}
            showArrow
            onClose={this.handlePopupClose}
            onOpen={this.handlePopupOpen}
        >
            {step && <div
                ref={this.balloonRef}
                className="uiExplainer"
                role="dialog"
                aria-modal="true"
                aria-label={step.title ? undefined : "User interface explanation"}
                aria-labelledby={step.title ? titleId : undefined}
                aria-describedby={contentId}
                tabIndex={-1}
            >
                <Button
                    aria-label="Close"
                    className="close"
                    data-tooltip="Close"
                    imageOnly
                    onClick={this.close}
                >
                    <Icon src={Codicon.Close} data-tooltip="inherit" />
                </Button>
                {step.title && <div id={titleId} className="title">{step.title}</div>}
                <div id={contentId} className="content">{step.content}</div>
                <div className="footer">
                    <span className="progress">{stepIndex + 1} of {steps.length}</span>
                    <div className="actions">
                        <Button
                            className="back"
                            caption="Back"
                            disabled={stepIndex === 0}
                            onClick={this.back}
                        />
                        <Button
                            className="next"
                            caption={isLastStep ? "Finish" : "Next"}
                            isDefault
                            onClick={this.next}
                        />
                    </div>
                </div>
            </div>}
        </Popup>;
    }

    public get isOpen(): boolean {
        return this.popupRef.current?.isOpen ?? false;
    }

    public start(stepIndex = 0): boolean {
        const step = this.props.steps.at(stepIndex);
        if (!this.availableTarget(step)) {
            return false;
        }

        if (!this.isOpen) {
            this.previouslyFocused = document.activeElement instanceof HTMLElement
                ? document.activeElement
                : undefined;
        }

        this.completed = false;
        this.setState({ stepIndex }, () => {
            this.showCurrentStep();
        });

        return true;
    }

    public close = (): void => {
        this.completed = false;
        this.popupRef.current?.close(true);
    };

    private back = (): void => {
        const previousIndex = Math.max(0, this.state.stepIndex - 1);
        if (previousIndex !== this.state.stepIndex) {
            this.moveToStep(previousIndex);
        }
    };

    private next = (): void => {
        const nextIndex = this.state.stepIndex + 1;
        if (nextIndex === this.props.steps.length) {
            this.completed = true;
            this.popupRef.current?.close(false);
        } else {
            this.moveToStep(nextIndex);
        }
    };

    private moveToStep(stepIndex: number): void {
        const step = this.props.steps.at(stepIndex);
        if (this.availableTarget(step)) {
            this.setState({ stepIndex }, () => {
                this.showCurrentStep();
                this.balloonRef.current?.focus();
            });
        }
    }

    private showCurrentStep(): void {
        const step = this.props.steps.at(this.state.stepIndex);
        const target = step?.target.current;
        if (!target) {
            return;
        }

        target.scrollIntoView({
            block: "nearest",
            inline: "nearest",
        });

        const targetRect = target.getBoundingClientRect();
        const options = {
            backgroundOpacity: 0.45,
            blockMouseEvents: true,
            closeOnEscape: true,
            closeOnPortalClick: false,
            spotlight: this.paddedRect(targetRect),
        };

        if (this.popupRef.current?.isOpen) {
            this.popupRef.current.updatePosition(targetRect, options);
        } else {
            this.popupRef.current?.open(targetRect, options);
        }

        this.observeTarget(target);
        this.schedulePositionUpdate();
    }

    private handlePopupOpen = (): void => {
        window.addEventListener("resize", this.schedulePositionUpdate);
        window.addEventListener("scroll", this.schedulePositionUpdate, true);
        document.addEventListener("keydown", this.handleKeyDown, true);
        this.balloonRef.current?.focus();
    };

    private handlePopupClose = (): void => {
        const completed = this.completed;
        this.completed = false;
        this.stopTrackingPosition();
        this.restoreFocus();
        this.props.onClose?.(completed);
    };

    private handleKeyDown = (event: KeyboardEvent): void => {
        if (event.key !== KeyboardKeys.Tab || !this.balloonRef.current) {
            return;
        }

        const focusableElements = [...this.balloonRef.current.querySelectorAll<HTMLElement>(
            "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
        )].filter((element) => {
            return !element.hasAttribute("disabled") && !element.classList.contains("disabled");
        });
        const first = focusableElements.at(0);
        const last = focusableElements.at(-1);
        const activeElement = document.activeElement;
        const moveTo = activeElement === this.balloonRef.current
            ? event.shiftKey ? last : first
            : event.shiftKey && activeElement === first
                ? last
                : !event.shiftKey && activeElement === last
                    ? first
                    : undefined;

        if (moveTo) {
            event.preventDefault();
            event.stopImmediatePropagation();
            moveTo.focus();
        }
    };

    private schedulePositionUpdate = (): void => {
        this.positionAnimationFrame ??= requestAnimationFrame(() => {
            this.positionAnimationFrame = undefined;
            this.updatePosition();
        });
    };

    private updatePosition(): void {
        const step = this.props.steps.at(this.state.stepIndex);
        const target = step?.target.current;
        if (this.isOpen && target?.isConnected) {
            const targetRect = target.getBoundingClientRect();
            this.popupRef.current?.updatePosition(targetRect, {
                spotlight: this.paddedRect(targetRect),
            });
        }
    }

    private observeTarget(target: HTMLElement): void {
        this.resizeObserver?.disconnect();
        if (typeof ResizeObserver !== "undefined") {
            this.resizeObserver = new ResizeObserver(this.schedulePositionUpdate);
            this.resizeObserver.observe(target);
        }
    }

    private stopTrackingPosition(): void {
        window.removeEventListener("resize", this.schedulePositionUpdate);
        window.removeEventListener("scroll", this.schedulePositionUpdate, true);
        document.removeEventListener("keydown", this.handleKeyDown, true);
        this.resizeObserver?.disconnect();
        this.resizeObserver = undefined;

        if (this.positionAnimationFrame !== undefined) {
            cancelAnimationFrame(this.positionAnimationFrame);
            this.positionAnimationFrame = undefined;
        }
    }

    private restoreFocus(): void {
        const element = this.previouslyFocused;
        this.previouslyFocused = undefined;
        if (element?.isConnected) {
            element.focus();
        }
    }

    private paddedRect(rect: DOMRect): DOMRect {
        return new DOMRect(
            Math.max(0, rect.left - spotlightPadding),
            Math.max(0, rect.top - spotlightPadding),
            rect.width + (2 * spotlightPadding),
            rect.height + (2 * spotlightPadding),
        );
    }

    private availableTarget(step?: IUIExplainerStep): boolean {
        return Boolean(step?.target.current?.isConnected);
    }
}
