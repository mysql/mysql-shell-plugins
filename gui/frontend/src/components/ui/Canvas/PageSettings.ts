/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

export interface PaperFormat {
    /** The defined name (e.g. A4, Letter...) */
    name: string;

    /** Width in millimeters */
    width: number;

    /** Height in millimeters */
    height: number;

    /** The width of the left edge non-printable area in mm (default: 0). */
    marginLeft?: number;

    /** The height of the top edge non-printable area in mm (default: 0). */
    marginTop?: number;

    /** The width of the right edge non-printable area in mm (default: 0). */
    marginRight?: number;

    /** The height of the bottom edge non-printable area in mm (default: 0). */
    marginBottom?: number;
}

/** Typical paper formats. */
const paperFormats = [
    { name: "A3", width: 297, height: 420 },
    { name: "A4", width: 210, height: 297 },
    { name: "A5", width: 148, height: 210 },
    { name: "A6", width: 105, height: 148 },

    { name: "B4", width: 250, height: 353 },
    { name: "B5", width: 176, height: 250 },
    { name: "B6", width: 125, height: 176 },

    { name: "C4", width: 229, height: 324 },
    { name: "C5", width: 162, height: 229 },
    { name: "C6", width: 114, height: 162 },

    { name: "Letter", width: 216, height: 279 },
    { name: "Legal", width: 216, height: 356 },
    { name: "Tabloid", width: 279, height: 432 },
    { name: "Executive", width: 184, height: 267 },
] as const satisfies PaperFormat[];

export type PaperFormatName = typeof paperFormats[number]["name"];

/**
 * A class to manage page settings such as format, orientation, and zoom level.
 */
export class PageSettings {
    /** Used for mapping millimeters to pixels. */
    private scaleFactor = 2;
    private format: PaperFormat;

    public constructor(formatName: PaperFormatName = "A4", public orientation: "portrait" | "landscape" = "portrait") {
        this.format = paperFormats.find(f => {
            return f.name === formatName;
        }) ?? paperFormats[1]; // Default to A4 if not found.
    }

    public get scale(): number {
        return this.scaleFactor;
    }

    public set scale(zoom: number) {
        if (zoom > 0) {
            this.scaleFactor = zoom;
        } else {
            throw new Error("Scale factor must be greater than zero.");
        }
    }

    public get pageWidth(): number {
        if (this.orientation === "landscape") {
            return this.format.height;
        }

        return this.format.width;
    }

    public get pageHeight(): number {
        if (this.orientation === "landscape") {
            return this.format.width;
        }

        return this.format.height;
    }

    public get name(): string {
        return this.format.name;
    }

    public getMargins(): { left: number; top: number; right: number; bottom: number; } {
        return {
            left: this.format.marginLeft ?? 0,
            top: this.format.marginTop ?? 0,
            right: this.format.marginRight ?? 0,
            bottom: this.format.marginBottom ?? 0,
        };
    }

    public setMargins(left: number, top: number, right: number, bottom: number): void {
        this.format.marginLeft = left;
        this.format.marginTop = top;
        this.format.marginRight = right;
        this.format.marginBottom = bottom;
    }
}
