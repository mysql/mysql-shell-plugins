/*
 * Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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

import { ComponentPlacement } from "../Component/ComponentBase";

// Helper functions required for direct work with HTML DOM elements.

/**
 * Computes the target coordinates for the content element for a given placement.
 *
 * @param placement The position where to place the given content relative to the reference element.
 * @param content The element for which the position is to be computed.
 * @param reference The area relative to which the content must be placed.
 * @param offset An additional distance between content and reference elements.
 *
 * @returns Left and top values in the coordinate system of the parent of the reference element.
 */
const computePositionForPlacement = (placement: ComponentPlacement, content: HTMLElement, reference: DOMRect,
    offset: number): { left: number; top: number; } => {

    const contentBounds = content.getBoundingClientRect();

    let left = 0;
    let top = 0;

    switch (placement) {
        case ComponentPlacement.TopLeft: {
            left = reference.left;
            top = reference.top - contentBounds.height - offset;

            break;
        }

        case ComponentPlacement.TopCenter: {
            left = (reference.left + reference.right) / 2 - contentBounds.width / 2;
            top = reference.top - contentBounds.height - offset;
            break;
        }

        case ComponentPlacement.TopRight: {
            left = reference.right - contentBounds.width;
            top = reference.top - contentBounds.height - offset;
            break;
        }

        case ComponentPlacement.RightTop: {
            top = reference.top;
            left = reference.left + reference.width + offset;
            break;
        }

        case ComponentPlacement.RightCenter: {
            top = (reference.top + reference.bottom) / 2 - contentBounds.height / 2;
            left = reference.left + reference.width + offset;
            break;
        }

        case ComponentPlacement.RightBottom: {
            top = reference.top + reference.height - contentBounds.height;
            left = reference.left + reference.width + offset;
            break;
        }

        case ComponentPlacement.BottomLeft: {
            left = reference.left;
            top = reference.top + reference.height + offset;
            break;
        }

        case ComponentPlacement.BottomCenter: {
            left = (reference.left + reference.right) / 2 - contentBounds.width / 2;
            top = reference.top + reference.height + offset;
            break;
        }

        case ComponentPlacement.BottomRight: {
            left = reference.right - contentBounds.width;
            top = reference.top + reference.height + offset;
            break;
        }

        case ComponentPlacement.LeftTop: {
            top = reference.top;
            left = reference.left - contentBounds.width - offset;
            break;
        }

        case ComponentPlacement.LeftCenter: {
            top = (reference.top + reference.bottom) / 2 - contentBounds.height / 2;
            left = reference.left - contentBounds.width - offset;
            break;
        }

        case ComponentPlacement.LeftBottom: {
            top = reference.top + reference.height - contentBounds.height;
            left = reference.left - contentBounds.width - offset;
            break;
        }

        default: {
            break;
        }
    }

    return { left, top };
};

/**
 * Determines the top-left position of the content element, depending on the specified placement under consideration
 * of possible overlaps with the bounds of the given outer container.
 *
 * @param placement The position where to place the given content.
 * @param content The element for which the position is to be computed.
 * @param reference The area relative to which the content must be placed.
 * @param offset An additional distance between content and reference elements.
 * @param canFlip A flag to tell if the position can automatically be changed to the opposite if there's not enough
 *                space.
 * @param container Optional element to test against overlaps (default is the body element). Only useful when
 *                  canFlip is true.
 *
 * @returns Left and top values in the coordinate system of the parent of the reference element.
 */
export const computeContentPosition = (placement: ComponentPlacement, content: HTMLElement, reference: DOMRect,
    offset: number, canFlip: boolean,
    container: HTMLElement = document.body): { left: number; top: number; } => {
    let { left, top } = computePositionForPlacement(placement, content, reference, offset);
    const { width, height } = content.getBoundingClientRect();
    const containerBounds = container.getBoundingClientRect();

    const right = left + width;
    const bottom = top + height;

    if (canFlip) {
        // Automatically flip or shift the popup to avoid container overlap.
        // The closures return true if the popup was flipped, which requires to update the placement class.
        const checkTop = (newPlacement: ComponentPlacement): boolean => {
            if (top < 0) {
                const { top: tc } = computePositionForPlacement(newPlacement, content, reference, offset);
                if (tc + height > containerBounds.bottom) {
                    // Would move the popup too far down, so move it to the top of the container.
                    top = 0;
                } else {
                    top = tc;

                    return true;
                }
            }

            return false;
        };

        const checkRight = (newPlacement: ComponentPlacement): boolean => {
            if (right > containerBounds.right) {
                const { left: lc } = computePositionForPlacement(newPlacement, content, reference, offset);
                if (lc < 0) {
                    // Would move the popup too far left, so move it to the right edge of the container.
                    left = containerBounds.right - width;
                } else {
                    left = lc;

                    return true;
                }
            }

            return false;
        };

        const checkBottom = (newPlacement: ComponentPlacement): boolean => {
            if (bottom > containerBounds.bottom) {
                const { top: tc } = computePositionForPlacement(newPlacement, content, reference, offset);
                if (tc < 0) {
                    top = containerBounds.bottom - height;
                } else {
                    top = tc;

                    return true;
                }
            }

            return false;
        };

        const checkLeft = (newPlacement: ComponentPlacement): boolean => {
            if (left < 0) {
                const { left: lc } = computePositionForPlacement(newPlacement, content, reference, offset);
                if (lc + width > containerBounds.right) {
                    left = containerBounds.right - width;
                } else {
                    left = lc;

                    return true;
                }
            }

            return false;
        };

        /**
         * Updates the popup's placement class depending on the previous flip check.
         *
         * @param flipH The popup was horizontally flipped.
         * @param flipV The popup was vertically flipped.
         * @param flippedBoth The new placement if both directions were flipped.
         * @param flippedH Ditto for horizontal only.
         * @param flippedV Ditto for vertical only.
         */
        const handleFlip = (flipH: boolean, flipV: boolean, flippedBoth: ComponentPlacement | null,
            flippedH: ComponentPlacement | null, flippedV: ComponentPlacement | null): void => {
            if (flipH || flipV) {
                let newClass = "";
                if (flipH && flipV) {
                    newClass = flippedBoth!;
                } else {
                    if (flipH) {
                        newClass = flippedH!;

                    } else {
                        newClass = flippedV!;
                    }
                }
                content.classList.remove(placement);
                content.classList.add(newClass);
            }

        };

        switch (placement) {
            case ComponentPlacement.TopLeft: {
                handleFlip(
                    checkRight(ComponentPlacement.TopRight),
                    checkTop(ComponentPlacement.BottomLeft),
                    ComponentPlacement.BottomRight,
                    ComponentPlacement.TopRight,
                    ComponentPlacement.BottomLeft,
                );

                break;
            }

            case ComponentPlacement.TopCenter: {
                handleFlip(
                    false,
                    checkTop(ComponentPlacement.BottomCenter),
                    null,
                    null,
                    ComponentPlacement.BottomCenter,
                );

                break;
            }

            case ComponentPlacement.TopRight: {
                handleFlip(
                    checkLeft(ComponentPlacement.TopLeft),
                    checkTop(ComponentPlacement.BottomRight),
                    ComponentPlacement.BottomLeft,
                    ComponentPlacement.TopLeft,
                    ComponentPlacement.BottomRight,
                );

                break;
            }

            case ComponentPlacement.RightTop: {
                handleFlip(
                    checkRight(ComponentPlacement.LeftTop),
                    checkBottom(ComponentPlacement.RightBottom),
                    ComponentPlacement.LeftBottom,
                    ComponentPlacement.LeftTop,
                    ComponentPlacement.RightBottom,
                );

                break;
            }

            case ComponentPlacement.RightCenter: {
                handleFlip(
                    checkRight(ComponentPlacement.LeftCenter),
                    false,
                    null,
                    ComponentPlacement.LeftCenter,
                    null,
                );

                break;
            }

            case ComponentPlacement.RightBottom: {
                handleFlip(
                    checkRight(ComponentPlacement.LeftBottom),
                    checkTop(ComponentPlacement.RightTop),
                    ComponentPlacement.LeftTop,
                    ComponentPlacement.LeftBottom,
                    ComponentPlacement.RightTop,
                );

                break;
            }

            case ComponentPlacement.BottomLeft: {
                handleFlip(
                    checkRight(ComponentPlacement.BottomRight),
                    checkBottom(ComponentPlacement.TopLeft),
                    ComponentPlacement.TopRight,
                    ComponentPlacement.BottomRight,
                    ComponentPlacement.TopLeft,
                );

                break;
            }

            case ComponentPlacement.BottomCenter: {
                handleFlip(
                    false,
                    checkBottom(ComponentPlacement.TopCenter),
                    null,
                    null,
                    ComponentPlacement.TopCenter,
                );

                break;
            }

            case ComponentPlacement.BottomRight: {
                handleFlip(
                    checkLeft(ComponentPlacement.BottomLeft),
                    checkBottom(ComponentPlacement.TopRight),
                    ComponentPlacement.TopLeft,
                    ComponentPlacement.BottomLeft,
                    ComponentPlacement.TopRight,
                );

                break;
            }

            case ComponentPlacement.LeftTop: {
                handleFlip(
                    checkLeft(ComponentPlacement.RightTop),
                    checkBottom(ComponentPlacement.LeftBottom),
                    ComponentPlacement.RightBottom,
                    ComponentPlacement.RightTop,
                    ComponentPlacement.LeftBottom,
                );

                break;
            }

            case ComponentPlacement.LeftCenter: {
                handleFlip(
                    checkLeft(ComponentPlacement.RightCenter),
                    false,
                    null,
                    ComponentPlacement.RightCenter,
                    null);

                break;
            }

            case ComponentPlacement.LeftBottom: {
                handleFlip(
                    checkLeft(ComponentPlacement.RightBottom),
                    checkTop(ComponentPlacement.LeftTop),
                    ComponentPlacement.RightTop,
                    ComponentPlacement.RightBottom,
                    ComponentPlacement.LeftTop,
                );

                break;
            }

            default: {
                break;
            }
        }
    }

    return { left, top };
};
