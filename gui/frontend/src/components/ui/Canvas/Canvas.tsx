/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

import "./Canvas.css";

import { ComponentChild, createRef } from "preact";
import Color from "color";
import { Application, Container, Ticker } from "pixi.js";
// @ts-expect-error: has no exported member 'Viewport'
import { Viewport, IViewportOptions } from "pixi-viewport";


import {
    ComponentBase,
    IComponentProperties,
    MouseEventType,
} from "../Component/ComponentBase.js";

export interface ICanvasProperties extends IComponentProperties {
    offsetWidth?: number;
    offsetHeight?: number;
    maxFps: number;
    lowFPS: number;
    warmFPS: number;
    fullFPS: number;
    disableTickerOnMouseLeave: boolean;
    background: string;
    objects: Container;
}

export default class Canvas extends ComponentBase<ICanvasProperties> {
    public static override defaultProps = {
        offsetWidth: 1300,
        offsetHeight: 1200,
        maxFps: 60,
        lowFPS: 10,
        warmFPS: 30,
        fullFPS: 60,
        background: Color.hsl(240, 5, 10).rgbNumber(),
        disableTickerOnMouseLeave: false,
    };

    public static viewport: Viewport | null = null;
    private app: Application | undefined;
    private resizeObserver?: ResizeObserver;
    private hostRef = createRef<HTMLDivElement>();

    public constructor(props: ICanvasProperties) {
        super(props);

        this.addHandledProperties(
            "offsetWidth",
            "offsetHeight",
            "maxFps",
            "lowFPS",
            "warmFPS",
            "fullFPS",
            "disableTickerOnMouseLeave",
            "background",
            "objects",
        );

        this.connectEvents(
            "onMouseLeave",
            "onMouseEnter",
            "onMouseUp",
            "onMouseDown",
        );
        if (typeof ResizeObserver !== "undefined") {
            this.resizeObserver = new ResizeObserver(this.handleResize);
        }
    }

    public override componentDidMount(): void {
        if (!this.hostRef.current) {
            return;
        }

        const { objects, background } = this.props;

        this.app = new Application();
        void this.app
            .init({
                antialias: true,
                backgroundColor: background,
                sharedTicker: true,
                width: this.hostRef.current?.offsetWidth || 0,
                height: Math.max(
                    this.hostRef.current?.offsetHeight || 0,
                    window.innerHeight - 20,
                ),
                resizeTo: window,
                autoDensity: true,
                resolution: window.devicePixelRatio || 1,
            })
            .then(() => {
                if (this.app?.canvas) {
                    this.hostRef.current?.appendChild(this.app.canvas);
                }
                this.initPixiApp();
                this.initViewPort();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                Canvas.viewport?.addChild(objects);
            });
        if (this.resizeObserver && this.hostRef.current) {
            this.resizeObserver.observe(this.hostRef.current);
        }
    }

    public override componentWillUnmount(): void {
        Canvas.viewport = null;
        if (this.resizeObserver && this.hostRef.current) {
            this.resizeObserver.unobserve(this.hostRef.current);
        }
    }

    public render(): ComponentChild {
        return (
            <div
                className={this.getEffectiveClassNames(["canvas"])}
                ref={this.hostRef}
                {...this.unhandledProperties}
            />
        );
    }

    protected override handleMouseEvent(type: MouseEventType): boolean {
        switch (type) {
            case MouseEventType.Down: {
                Ticker.shared.maxFPS = this.props.fullFPS;
                break;
            }

            case MouseEventType.Leave: {
                if (this.props.disableTickerOnMouseLeave) {
                    Ticker.shared.stop();
                } else {
                    Ticker.shared.maxFPS = this.props.lowFPS;
                }
                break;
            }

            case MouseEventType.Enter: {
                if (this.props.disableTickerOnMouseLeave) {
                    Ticker.shared.start();
                }
                Ticker.shared.maxFPS = this.props.warmFPS;
                break;
            }

            default: {
                Ticker.shared.maxFPS = this.props.warmFPS;
                break;
            }
        }

        return true;
    }

    private handleResize = (_entries: readonly ResizeObserverEntry[]): void => {
        if (this.app && this.hostRef.current) {
            this.app.renderer?.resize(
                this.hostRef.current.offsetWidth,
                this.hostRef.current.offsetHeight,
            );
        }
    };

    private initPixiApp(): void {
        if (this.props.disableTickerOnMouseLeave) {
            Ticker.shared.stop();
        } else {
            Ticker.shared.maxFPS = this.props.lowFPS;
        }
    }

    private initViewPort(): void {
        const { offsetWidth, offsetHeight } = this.props;
        if (!Canvas.viewport) {
            if (!this.app?.renderer?.events) {
                throw new Error("Renderer events system is not initialized.");
            }
            const options: IViewportOptions = {
                screenWidth: offsetWidth,
                screenHeight: offsetHeight,
                worldWidth: offsetWidth,
                worldHeight: offsetHeight,
                events: this.app.renderer.events,
            };
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            Canvas.viewport = new Viewport(options);
        }
        this.app?.stage.addChild(Canvas.viewport);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        Canvas.viewport.drag().pinch().wheel().decelerate().setZoom(1);
    }
}
