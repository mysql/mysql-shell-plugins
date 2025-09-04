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

import Color from "color";
import { describe, expect, it } from "vitest";

import { ColorManipulator } from "../../../utilities/ColorManipulator.js";

describe("ColorManipulator tests", () => {
    const colorManipulator = new ColorManipulator();

    describe("Should increase and decrease separate HSL values", () => {
        describe("Hue tests", () => {
            it("Should increase hue", () => {
                const color = colorManipulator.adjustHueAbsolute(new Color("red"), 60); // hsl(0deg 100% 50%)
                expect(color.hue()).toEqual(60);
                expect(color.saturationv()).toEqual(100);
                expect(color.lightness()).toEqual(50);
                expect(color.hex()).toEqual("#FFFF00"); // hsl(60 100% 50% / 1), yellow
            });

            it("Should decrease hue", () => {
                const color = colorManipulator.adjustHueAbsolute(new Color("yellow"), -60); // hsl(60deg 100% 50%)
                expect(color.hue()).toEqual(0);
                expect(color.saturationv()).toEqual(100);
                expect(color.lightness()).toEqual(50);
                expect(color.hex()).toEqual("#FF0000"); // hsl(0 100% 50% / 1), red
            });
        });

        describe("Saturation tests", () => {
            it("Should relatively increase saturation", () => {
                const color = colorManipulator.adjustSaturationRelative(
                    new Color("#bf4040"), 0.5,
                ); // hsl(0deg 49.8% 50%)
                expect(color.hue()).toEqual(0);
                expect(color.saturationl()).toBeCloseTo(74.7, 1);
                expect(color.lightness()).toEqual(50);
                expect(color.hex()).toEqual("#DF2020"); // hsl(0deg 75% 50%)
            });

            it("Should relatively decrease saturation", () => {
                const color = colorManipulator.adjustSaturationRelative(new Color("red"), -0.25); // hsl(0deg 100% 50%)
                expect(color.hue()).toEqual(0);
                expect(color.saturationl()).toBeCloseTo(75);
                expect(color.lightness()).toEqual(50);
                expect(color.hex()).toEqual("#DF2020"); // hsl(0deg 75% 50%)
            });

            it("Does nothing when relatively adjusting zero saturation", () => {
                const color = colorManipulator.adjustSaturationRelative(new Color("#404040"), 1); // hsl(0deg 0% 25.1%)
                expect(color.hue()).toEqual(0);
                expect(color.saturationl()).toEqual(0);
                expect(color.lightness()).toBeCloseTo(25.1, 1);
                expect(color.hex()).toEqual("#404040"); // hsl(0deg 75% 50%)
            });

            it("Absolutely adjusting zero saturation", () => {
                const color = colorManipulator.adjustSaturationAbsolute(new Color("#404040"), 50); // hsl(0deg 0% 25.1%)
                expect(color.hue()).toEqual(0);
                expect(color.saturationl()).toEqual(50);
                expect(color.lightness()).toBeCloseTo(25.1, 1);
                expect(color.hex()).toEqual("#602020"); // hsl(0deg 50% 25.1%)
            });
        });

        describe("Lightness tests", () => {
            it("Should relatively increase lightness", () => {
                const color = colorManipulator.adjustLightnessRelative(new Color("red"), 0.5); // hsl(0deg 100% 50%)
                expect(color.hue()).toEqual(0);
                expect(color.saturationl()).toEqual(100);
                expect(color.lightness()).toBeCloseTo(75);
                expect(color.hex()).toEqual("#FF8080"); // hsl(0deg 100% 75%)
            });

            it("Should relatively decrease lightness", () => {
                const color = colorManipulator.adjustLightnessRelative(new Color("white"), -0.5); // hsl(0deg 0% 100%)
                expect(color.hue()).toEqual(0);
                expect(color.saturationl()).toEqual(0);
                expect(color.lightness()).toBeCloseTo(50);
                expect(color.hex()).toEqual("#808080"); // hsl(0deg 0% 50.2%), grey
            });

            it("Does nothing when relatively adjusting zero lightness", () => {
                const color = colorManipulator.adjustLightnessRelative(new Color("black"), 1); // hsl(0deg 0% 0%)
                expect(color.hue()).toEqual(0);
                expect(color.saturationl()).toEqual(0);
                expect(color.lightness()).toEqual(0);
                expect(color.hex()).toEqual("#000000"); // hsl(0deg 0% 0%)
            });

            it("Absolutely adjusting zero lightness", () => {
                const color = colorManipulator.adjustLightnessAbsolute(new Color("black"), 50); // hsl(0deg 0% 0%)
                expect(color.hue()).toEqual(0);
                expect(color.saturationl()).toEqual(0);
                expect(color.lightness()).toEqual(50);
                expect(color.hex()).toEqual("#808080"); // hsl(0deg 0% 50.2%)
            });

            it("Should absolutely change lightness", () => {
                const color = colorManipulator.adjustLightnessAbsolute(
                    new Color("#008000"), 50,
                ); // hsl(120deg 100% 25.1%)
                expect(color.hue()).toEqual(120);
                expect(color.saturationl()).toEqual(100);
                expect(color.lightness()).toBeCloseTo(75.1, 1);
                expect(color.hex()).toEqual("#80FF80"); // hsl(120deg 100% 75.1%)
            });
        });

        describe("Alpha tests", () => {
            it("Should relatively increase alpha", () => {
                const color = colorManipulator.adjustAlphaRelative(
                    new Color("#FFFFFF80"), 0.5,
                ); // hsl(0deg 0% 100% / 50%)
                expect(color.hue()).toEqual(0);
                expect(color.saturationv()).toEqual(0);
                expect(color.lightness()).toEqual(100);
                expect(color.alpha()).toBeCloseTo(0.75);
                expect(color.hexa()).toEqual("#FFFFFFC0"); // hsl(0deg 0% 100% / 75%)
            });

            it("Should relatively decrease alpha", () => {
                const color = colorManipulator.adjustAlphaRelative(new Color("white"), -0.5); // hsl(0deg 0% 100%)
                expect(color.hue()).toEqual(0);
                expect(color.saturationv()).toEqual(0);
                expect(color.lightness()).toEqual(100);
                expect(color.alpha()).toBeCloseTo(0.5);
                expect(color.hexa()).toEqual("#FFFFFF80"); // hsl(0deg 0% 100% / 50%)
            });

            it("Does nothing when relatively adjusting zero alpha", () => {
                const color = colorManipulator.adjustAlphaRelative(new Color("#00000000"), 1); // hsl(0deg 0% 0% / 0%)
                expect(color.hue()).toEqual(0);
                expect(color.saturationv()).toEqual(0);
                expect(color.lightness()).toEqual(0);
                expect(color.alpha()).toEqual(0);
                expect(color.hexa()).toEqual("#00000000"); // hsl(0deg 0% 0% / 0%)
            });

            it("Absolutely adjusting zero alpha", () => {
                const color = colorManipulator.adjustAlphaAbsolute(
                    new Color("#00000000"), 0.75,
                ); // hsl(0deg 0% 0% / 0%)
                expect(color.hue()).toEqual(0);
                expect(color.saturationv()).toEqual(0);
                expect(color.lightness()).toEqual(0);
                expect(color.alpha()).toEqual(0.75);
                expect(color.hexa()).toEqual("#000000BF"); // hsl(0deg 0% 0% / 75%)
            });

            it("Should absolutely change alpha", () => {
                const color = colorManipulator.adjustAlphaAbsolute(
                    new Color("#ff000080"), 0.2,
                ); // hsl(0deg 100% 50% / 50.2%)
                expect(color.hue()).toEqual(0);
                expect(color.saturationv()).toEqual(100);
                expect(color.lightness()).toEqual(50);
                expect(color.alpha()).toBeCloseTo(0.7);
                expect(color.hexa()).toEqual("#FF0000B3"); // hsl(0deg 100% 50% / 70%)
            });

            it("Should not change alpha if not set initially", () => {
                const color = colorManipulator.adjustAlphaAbsolute(
                    new Color("red"), 0, // #FF0000
                );
                expect(color.alpha()).toEqual(1);
                expect(color.hexa()).toEqual("#FF0000FF");
            });
        });
    });

    describe("Test getAdjustedColors HSL", () => {
        it("Should adjust colors based on the theme", () => {
            const baseColors = {
                primary: "#ff0000", // hsl(0deg 100% 50%), red
                secondary: "#0000ff", // hsl(240deg 100% 50%), blue
            };

            const colorAdjustments = {
                primaryAdjusted: {
                    baseColorKey: "primary",
                    colorAdjustment: {
                        dark: {
                            hue: { absolute: -30 },
                            saturation: { relative: -0.25 },
                            lightness: { relative: -0.1 },
                            alpha: { relative: -0.3 },
                        },
                    },
                },
                secondaryAdjusted: {
                    baseColorKey: "secondary",
                    colorAdjustment: {
                        light: {
                            hue: { absolute: 80 },
                            saturation: { absolute: -10 },
                            lightness: { absolute: 5 },
                            alpha: { absolute: -0.4 },
                        },
                    },
                },
            };

            // Test for the "dark" theme
            const adjustedColorsDark = colorManipulator.getAdjustedColors(baseColors, colorAdjustments, "dark");
            expect(adjustedColorsDark).toEqual({
                primaryAdjusted: "#c91d73b3", // hsl(330deg 75% 45% / 70%)
            });

            // Test for the "light" theme
            const adjustedColorsLight = colorManipulator.getAdjustedColors(baseColors, colorAdjustments, "light");
            expect(adjustedColorsLight).toEqual({
                secondaryAdjusted: "#f425af99", // hsl(320deg 90.39% 55.1% / 60%)
            });
        });

        it("Should not return alpha hex if not set initially", () => {
            const baseColors = {
                primary: "#ff0000", // hsl(0deg 100% 50%), red
            };

            const colorAdjustments = {
                primaryAdjusted: {
                    baseColorKey: "primary",
                    colorAdjustment: {
                        dark: {
                            hue: { absolute: 180 },
                        },
                    },
                },
            };

            // Test for the "dark" theme
            const adjustedColorsDark = colorManipulator.getAdjustedColors(baseColors, colorAdjustments, "dark");
            expect(adjustedColorsDark).toEqual({
                primaryAdjusted: "#00ffff", // hsl(180deg 100% 50%), cyan
            });
        });

        it("Should apply nested and alias variables", () => {
            const baseColors = {
                primary: "#ff0000ff", // hsl(0deg 100% 50%), red
            };

            const colorAdjustments = {
                primaryAdjusted: {
                    baseColorKey: "primary",
                    colorAdjustment: {
                        dark: {
                            hue: { absolute: -30 },
                            saturation: { relative: -0.25 },
                            lightness: { relative: -0.1 },
                            alpha: { relative: -0.3 },
                        },
                    },
                },
                foo: "$primaryAdjusted",
                bar: "$foo",
                primaryAlias: "$primary",
            };

            const adjustedColorsDark = colorManipulator.getAdjustedColors(baseColors, colorAdjustments, "dark");
            expect(adjustedColorsDark).toEqual({
                primaryAdjusted: "#c91d73b3", // hsl(330deg 75% 45% / 70%)
                foo: "#c91d73b3",
                bar: "#c91d73b3",
                primaryAlias: "#ff0000ff",
            });
        });

        it("Should return base colors when no adjustments were applied", () => {
            const baseColors = {
                primary: "#123456",
                secondary: "#abcdef",
            };

            const colorAdjustments = {
                primaryAdjusted: {
                    baseColorKey: "primary",
                    colorAdjustment: {
                        dark: {
                            hue: { absolute: 0 },
                            saturation: { absolute: 0 },
                            lightness: { absolute: 0 },
                            alpha: { absolute: 0 },
                        },
                    },
                },
                secondaryAdjusted: {
                    baseColorKey: "secondary",
                    colorAdjustment: {
                        dark: {
                            hue: { absolute: 0 },
                            saturation: { relative: 0 },
                            lightness: { relative: 0 },
                            alpha: { relative: 0 },
                        },
                    },
                },
            };

            const adjustedColors = colorManipulator.getAdjustedColors(baseColors, colorAdjustments, "dark");
            expect(adjustedColors).toEqual({
                primaryAdjusted: "#123456",
                secondaryAdjusted: "#abcdef",
            });
        });

        it("Should skip adjustment if base color is missing", () => {
            const baseColors = {
                primary: "#123456",
                // secondary is missing
            };

            const colorAdjustments = {
                secondaryAdjusted: {
                    baseColorKey: "secondary",
                    colorAdjustment: {
                        light: {
                            hue: { absolute: 120 },
                        },
                    },
                },
            };

            const adjustedColors = colorManipulator.getAdjustedColors(baseColors, colorAdjustments, "dark");
            expect(adjustedColors).toEqual({});  // No adjustments applied since base color is missing
        });

        it("Should not add adjustment for non existing base variable", () => {
            const baseColors = {};

            const colorAdjustments = {
                primaryAdjusted: "$base",
            };

            const adjustedColors = colorManipulator.getAdjustedColors(baseColors, colorAdjustments, "dark");
            expect(adjustedColors).toEqual({});
        });

        it("Should apply base color variable", () => {
            const baseColors = {
                primary: "#123456",
            };

            const colorAdjustments = {
                primaryAdjusted: "$primary",
            };

            const adjustedColors = colorManipulator.getAdjustedColors(baseColors, colorAdjustments, "dark");
            expect(adjustedColors).toEqual({
                primaryAdjusted: "#123456",
            });
        });

        it("Should throw error for baseColorKey variable", () => {
            const baseColors = {
                primary: "#123456",
            };

            const colorAdjustments = {
                primaryAdjusted: {
                    baseColorKey: "$primary",
                    colorAdjustment: {
                        light: {
                            hue: { absolute: 120 },
                        },
                    },
                },
            };

            expect(() => {
                colorManipulator.getAdjustedColors(baseColors, colorAdjustments, "light");
            }).toThrow(`Variables as a baseColorKey are not supported, "$primary" provided`);
        });
    });

    describe("Test resolveColorAdjustment", () => {
        it("Should return undefined if color ID does not exist", () => {
            const baseColors = {};
            const colorAdjustments = {};
            const result = colorManipulator.resolveColorAdjustment(
                baseColors,
                colorAdjustments,
                "foo",
            );

            expect(result).toEqual(undefined);
        });

        it("Should return undefined if variable cannot be resolved", () => {
            const baseColors = {};
            const colorAdjustments = {
                foo: "$bar",
            };
            const result = colorManipulator.resolveColorAdjustment(
                baseColors,
                colorAdjustments,
                "foo",
            );

            expect(result).toEqual(undefined);
        });

        it("Should throw error if config is neither object or variable", () => {
            const baseColors = {};
            const colorAdjustments = {
                foo: "some string",
            };

            expect(() => {
                colorManipulator.resolveColorAdjustment(
                    baseColors,
                    colorAdjustments,
                    "foo",
                );
            }).toThrow(`Color adjustment config has to be either object or variable, "some string" provided`);
        });

        it("Should return existing base color from variable", () => {
            const baseColors = {
                existing: "#000",
            };
            const colorAdjustments = {
                foo: "$existing",
            };
            const result = colorManipulator.resolveColorAdjustment(
                baseColors,
                colorAdjustments,
                "foo",
            );

            expect(result).toEqual("#000");
        });

        it("Should return color adjustment", () => {
            const baseColors = {};
            const colorAdjustments = {
                foo: {
                    baseColorKey: "base.foo",
                    colorAdjustment: {
                        light: {
                            hue: { absolute: 0 },
                        },
                    },
                },
            };
            const result = colorManipulator.resolveColorAdjustment(
                baseColors,
                colorAdjustments,
                "foo",
            );

            expect(result).toEqual({
                baseColorKey: "base.foo",
                colorAdjustment: {
                    light: {
                        hue: { absolute: 0 },
                    },
                },
            });
        });

        it("Should return previously set color adjustment", () => {
            const baseColors = {};
            const colorAdjustments = {
                foo: {
                    baseColorKey: "base.foo",
                    colorAdjustment: {
                        light: {
                            hue: { absolute: 0 },
                        },
                    },
                },
                bar: "$foo",
            };
            const result = colorManipulator.resolveColorAdjustment(
                baseColors,
                colorAdjustments,
                "bar",
            );

            expect(result).toEqual({
                baseColorKey: "base.foo",
                colorAdjustment: {
                    light: {
                        hue: { absolute: 0 },
                    },
                },
            });
        });

        it("Should return nested color adjustment", () => {
            const baseColors = {};
            const colorAdjustments = {
                foo: {
                    baseColorKey: "base.foo",
                    colorAdjustment: {
                        light: {
                            hue: { absolute: 0 },
                        },
                    },
                },
                bar: "$foo",
                nested: "$bar",
            };
            const result = colorManipulator.resolveColorAdjustment(
                baseColors,
                colorAdjustments,
                "nested",
            );

            expect(result).toEqual({
                baseColorKey: "base.foo",
                colorAdjustment: {
                    light: {
                        hue: { absolute: 0 },
                    },
                },
            });
        });

        it("Should return nested base color", () => {
            const baseColors = {
                existing: "#000",
            };
            const colorAdjustments = {
                foo: "$existing",
                nested: "$foo",
            };
            const result = colorManipulator.resolveColorAdjustment(
                baseColors,
                colorAdjustments,
                "nested",
            );

            expect(result).toEqual("#000");
        });
    });
});
