/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
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

import Color, { type ColorInstance } from "color";

import { IColors, ThemeType } from "../components/Theming/ThemeManager.js";
import colorAdjustments from "../components/Theming/assets/color-adjustments.json";

type SingleHslAdjustment = { relative: number; } | { absolute: number; };

interface IHSL {
    hue?: { absolute: number; };
    saturation?: SingleHslAdjustment;
    lightness?: SingleHslAdjustment;
    alpha?: SingleHslAdjustment;
}

interface IColorAdjustmentConfig {
    baseColorKey: string;
    colorAdjustment: Partial<Record<ThemeType, IHSL>>;
}

type IColorAdjustments = Record<string, IColorAdjustmentConfig | string | undefined>;

export class ColorManipulator {
    public get colorAdjustments(): IColorAdjustments {
        return colorAdjustments;
    }

    public resolveColorAdjustment(baseColors: IColors, colorAdjustments: IColorAdjustments,
        colorKey: string): IColorAdjustmentConfig | string | undefined {
        if (colorAdjustments[colorKey] === undefined) {
            return undefined;
        }

        const colorAdjustmentValue = colorAdjustments[colorKey];
        if (typeof colorAdjustmentValue === "object") {
            const baseColorKey = colorAdjustmentValue.baseColorKey;
            if (baseColorKey.startsWith("$")) {
                throw new Error(
                    `Variables as a baseColorKey are not supported, "${baseColorKey}" provided`,
                );
            }

            return colorAdjustmentValue;
        }

        if (!colorAdjustmentValue.startsWith("$")) {
            throw new Error(
                `Color adjustment config has to be either object or variable, "${colorAdjustmentValue}" provided`,
            );
        }

        const variableName = colorAdjustmentValue.slice(1);
        if (colorAdjustments[variableName] === undefined) {
            return baseColors[variableName];
        }

        return this.resolveColorAdjustment(baseColors, colorAdjustments, variableName);
    }

    public getAdjustedColors(baseColors: IColors, colorAdjustments: IColorAdjustments, type: ThemeType): IColors {
        const adjustedColors: IColors = {};
        for (const [colorKey] of Object.entries(colorAdjustments)) {
            const resolvedColorAdjustment = this.resolveColorAdjustment(
                baseColors,
                colorAdjustments,
                colorKey,
            );

            if (resolvedColorAdjustment === undefined) {
                continue;
            }

            if (typeof resolvedColorAdjustment === "string") {
                adjustedColors[colorKey] = resolvedColorAdjustment;

                continue;
            }

            const { baseColorKey, colorAdjustment } = resolvedColorAdjustment;
            const baseColor = baseColors[baseColorKey];
            if (!baseColor) {
                continue;
            }

            const hslColorAdjustment = colorAdjustment[type];
            if (!hslColorAdjustment) {
                continue;
            }

            const adjustedColor = this.calculateHsl(baseColor, hslColorAdjustment);
            adjustedColors[colorKey] = adjustedColor;
        }

        return adjustedColors;
    }

    public calculateHsl(baseColor: string, hsl: IHSL): string {
        let color = new Color(baseColor);
        const { hue, saturation, lightness, alpha } = hsl;

        if (hue?.absolute !== undefined) {
            color = this.adjustHueAbsolute(color, hue.absolute);
        }

        if (saturation && "relative" in saturation) {
            color = this.adjustSaturationRelative(color, saturation.relative);
        } else if (saturation && "absolute" in saturation) {
            color = this.adjustSaturationAbsolute(color, saturation.absolute);
        }

        if (lightness && "relative" in lightness) {
            color = this.adjustLightnessRelative(color, lightness.relative);
        } else if (lightness && "absolute" in lightness) {
            color = this.adjustLightnessAbsolute(color, lightness.absolute);
        }

        if (alpha && "relative" in alpha) {
            color = this.adjustAlphaRelative(color, alpha.relative);
        } else if (alpha && "absolute" in alpha) {
            color = this.adjustAlphaAbsolute(color, alpha.absolute);
        }

        if (color.alpha() !== 1) {
            return color.hexa().toLowerCase();
        }

        return color.hex().toLowerCase();
    }

    public adjustHueAbsolute(color: ColorInstance, hue: number): ColorInstance {
        return color.rotate(hue);
    }

    public adjustSaturationRelative(color: ColorInstance, saturation: number): ColorInstance {
        return saturation > 0
            ? color.saturate(saturation)
            : color.desaturate(-saturation);
    }

    public adjustSaturationAbsolute(color: ColorInstance, saturation: number): ColorInstance {
        return color.saturationl(color.saturationl() + saturation);
    }

    public adjustLightnessRelative(color: ColorInstance, lightness: number): ColorInstance {
        return lightness > 0
            ? color.lighten(lightness)
            : color.darken(-lightness);
    }

    public adjustLightnessAbsolute(color: ColorInstance, lightness: number): ColorInstance {
        return color.lightness(color.lightness() + lightness);
    }

    public adjustAlphaRelative(color: ColorInstance, alpha: number): ColorInstance {
        return alpha > 0 ?
            color.opaquer(alpha) :
            color.fade(-alpha);
    }

    public adjustAlphaAbsolute(color: ColorInstance, alpha: number): ColorInstance {
        return color.alpha(color.alpha() + alpha);
    }
}
