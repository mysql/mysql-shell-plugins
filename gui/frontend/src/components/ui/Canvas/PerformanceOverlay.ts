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

import * as pixi from "pixi.js";

export class PerformanceOverlay extends pixi.Container {
    private app: pixi.Application;
    private style: pixi.TextStyle;
    private background: pixi.Graphics;
    private fpsText: pixi.Text;

    private history: number[] = [];
    private maxHistory = 30;

    public constructor(app: pixi.Application) {
        super();
        this.app = app;
        this.style = new pixi.TextStyle({
            fontFamily: "Arial",
            fontSize: 14,
            fill: "#00ff00",
        });

        this.background = this.addChild(new pixi.Graphics());
        this.background.alpha = 0.5;
        this.background.roundRect(0, 0, 100, 50, 8).fill(0x000000);
        this.addChild(this.background);

        this.fpsText = new pixi.Text({ text: "", style: this.style });
        this.fpsText.position.set(10, 10);
        this.addChild(this.fpsText);

        this.x = 30;
        this.y = this.app.renderer.height - 60;
        this.app.stage.addChild(this);
    }

    public dispose() {
        this.app.stage.removeChild(this);
        this.destroy({ children: true });
    }

    public update() {
        const fps = this.app.ticker.started ? Math.round(this.app.ticker.FPS) : 0;
        this.history.push(fps);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }

        this.fpsText.text = `FPS: ${fps}`;

        this.background.clear();
        this.background.alpha = 0.5;
        this.background.roundRect(0, 0, 100, 50, 8).fill(0x000000);

        // Draw FPS history graph
        const graphHeight = 20;
        const graphWidth = 80;
        const graphX = 10;
        const graphY = 30;

        this.background.setStrokeStyle({ width: 1, color: 0x00ff00 });

        const startY = graphY + graphHeight - ((this.history[0] / 60) * graphHeight);
        this.background.moveTo(graphX, startY);
        for (let i = 0; i < this.history.length; i++) {
            const x = graphX + ((i / this.maxHistory) * graphWidth);
            const y = graphY + graphHeight - ((this.history[i] / 60) * graphHeight);
            this.background.lineTo(x, y);
        }
        this.background.stroke();
    }
}
