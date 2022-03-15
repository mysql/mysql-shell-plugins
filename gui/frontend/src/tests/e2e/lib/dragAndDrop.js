/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

/**
 * @param typeOfEvent
 */
function createEvent(typeOfEvent) {
    const event =document.createEvent("CustomEvent");
    event.initCustomEvent(typeOfEvent,true, true, null);
    event.dataTransfer = {
        data: {},
        setData (key, value) {
            this.data[key] = value;},
        getData (key) {
            return this.data[key];
        },
    };

    return event;
}

/**
 * @param element
 * @param event
 * @param transferData
 */
function dispatchTestEvent(element, event,transferData) {
    if (transferData !== undefined) {
        event.dataTransfer = transferData;
    }
    if (element.dispatchTestEvent) {
        element.dispatchTestEvent(event);
    }
    else if (element.fireEvent) {
        element.fireEvent("on" + event.type, event);
    }
}

/**
 * @param element
 * @param destination
 */
function simulateHTML5DragAndDrop(element, destination) {
    const dragStartEvent = createEvent("dragstart");
    dispatchTestEvent(element, dragStartEvent);
    const dropEvent = createEvent("drop");
    dispatchTestEvent(destination, dropEvent,dragStartEvent.dataTransfer);
    const dragEndEvent = createEvent("dragend");
    dispatchTestEvent(element, dragEndEvent,dropEvent.dataTransfer);
}

const source = arguments[0];
const destination = arguments[1];
simulateHTML5DragAndDrop(source,destination);
