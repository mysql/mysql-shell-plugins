/*
 * Copyright (c) 2020, 2021, Oracle and/or its affiliates.
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

export default ["1.0"];
export { keyboard, fetchHtmlAsText, loadCss, hslToRgbHex, sleep, parseOciJson,
    focusNextElement };

// Handle keyboard events
function keyboard(value) {
    let key = {};
    key.value = value;
    key.isDown = false;
    key.isUp = true;
    key.press = undefined;
    key.release = undefined;
    //The `downHandler`
    key.downHandler = event => {
        if (event.key === key.value) {
            let doDefaultKeyHandling;
            // The key.press() function needs to return true
            // in order to let the normal key handling take place
            if (key.isUp && key.press)
                doDefaultKeyHandling = key.press();
            key.isDown = true;
            key.isUp = false;

            if (!doDefaultKeyHandling)
                event.preventDefault();
        }
    };

    //The `upHandler`
    key.upHandler = event => {
        if (event.key === key.value) {
            let doDefaultKeyHandling;
            // The key.release() function needs to return true
            // in order to let the normal key handling take place
            if (key.isDown && key.release)
                doDefaultKeyHandling = key.release();
            key.isDown = false;
            key.isUp = true;
            if (!doDefaultKeyHandling)
                event.preventDefault();
        }
    };

    //Attach event listeners
    const downListener = key.downHandler.bind(key);
    const upListener = key.upHandler.bind(key);

    window.addEventListener(
        "keydown", downListener, false
    );
    window.addEventListener(
        "keyup", upListener, false
    );

    // Detach event listeners
    key.unsubscribe = () => {
        window.removeEventListener("keydown", downListener);
        window.removeEventListener("keyup", upListener);
    };

    return key;
}

/**
  * @param {String} url - address for the HTML to fetch
  * @return {String} the resulting HTML string fragment
  */
async function fetchHtmlAsText(url) {
    return await (await fetch(url)).text();
}

function loadCss(cssFilePath) {
    const link = document.createElement('link');
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("type", "text/css");
    //link.onload = function () { cssLoaded(); }
    link.setAttribute("href", cssFilePath);
    document.getElementsByTagName("head")[0].appendChild(link);
}

/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h ist contained on the set [0, 360], s and l are contained in the
 * set [0, 1] and returns r, g, and b in the set [0, 1].
 *
 * @param   {number}  h       The hue
 * @param   {number}  s       The saturation
 * @param   {number}  l       The lightness
 * @return  {Array}           The RGB representation
 */
function hslToRgbHex(h, s, l) {
    let r, g, b;
    h /= 360;
    s /= 100;
    l /= 100;

    if (s == 0) {
        r = g = b = l; // achromatic
    } else {
        var hue2rgb = function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    const toHex = x => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return parseInt(`${toHex(r)}${toHex(g)}${toHex(b)}`, 16);
}

/**
 * Perform a sleep operation
 *
 * @param {String} ms - the time to sleep in ms
 * @return {void}
 */
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parses a text string returned from an OCI command into a regular JSON object
 *
 * @param {String} ociJsonText - the text string returned from an OCI command
 * @return {Object} - the parsed JSON object
 */
function parseOciJson(ociJsonText) {
    return JSON.parse(ociJsonText.replace(/\"{/gm, '{').replace(/}\"/gm, '}')
        .replace(/\\/gm, ''));
}

function focusNextElement(element, rootElement) {
    if (!rootElement) {
        rootElement = document;
    }
    var focusableEls = rootElement.querySelectorAll('a[href]:not([disabled]), button:not([disabled]), textarea:not([disabled]), input[type="text"]:not([disabled]), input[type="radio"]:not([disabled]), input[type="checkbox"]:not([disabled]), select:not([disabled])');

    let i;
    for (i = 0 ; i < focusableEls.length; i++) {
        if (focusableEls[i] === element) {
            if (i === focusableEls.length - 1) {
                focusableEls[0].focus();
                break;
            } else {
                if (focusableEls[i+1].offsetParent === null) {
                    continue;
                }
                focusableEls[i+1].focus();
                break;
            }
        }
    }

    // if no element was found, focus the first one
    if (i === focusableEls.length) {
        for (i = 0 ; i < focusableEls.length; i++) {
            if (focusableEls[i].offsetParent !== null) {
                focusableEls[i].focus();
                break;
            }
        }
    }
}
