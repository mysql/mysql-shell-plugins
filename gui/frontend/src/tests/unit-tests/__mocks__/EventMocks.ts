/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable max-classes-per-file */

export class EventTargetMock implements EventTarget {
    public getBoundingClientRect = jest.fn();
    public parentElement = {
        getElementsByTagName: (_name: string): unknown[] => {
            return [];
        },
    };

    public addEventListener = jest.fn();
    public dispatchEvent = jest.fn();
    public removeEventListener = jest.fn();
}

export class EventMock implements Event {
    public readonly AT_TARGET = 2;
    public readonly BUBBLING_PHASE = 3;
    public readonly CAPTURING_PHASE = 1;
    public readonly NONE = 0;

    public bubbles = false;
    public cancelBubble = false;
    public cancelable = true;
    public readonly composed: boolean = false;
    public defaultPrevented = false;
    public readonly eventPhase = -1;
    public readonly isTrusted = true;
    public returnValue = false;
    public readonly srcElement: EventTarget | null = null;
    public readonly target: EventTarget | null;
    public readonly timeStamp: DOMHighResTimeStamp = 0;
    public type: string;

    public currentTarget: EventTargetMock | null;

    public constructor(type: string, eventInitDict?: EventInit) {
        this.type = type;

        this.bubbles = eventInitDict?.bubbles ?? false;
        this.cancelable = eventInitDict?.cancelable ?? false;
        this.composed = eventInitDict?.composed ?? false;

        this.currentTarget = new EventTargetMock();
        this.target = this.currentTarget;
    }

    public composedPath(): EventTarget[] { return []; }
    public initEvent(type: string, bubbles?: boolean, cancelable?: boolean): void {
        this.type = type;
        this.bubbles = bubbles ?? false;
        this.cancelable = cancelable ?? false;
    }
    public preventDefault(): void { this.defaultPrevented = true; }
    public stopImmediatePropagation(): void { /**/ }
    public stopPropagation(): void { /**/ }
}

export const genericEventMock = new EventMock("genericMock");
export const mouseEventMock = new EventMock("mouseEventMock") as MouseEvent;
export const keyboardEventMock = new EventMock("keyboardEventMock") as KeyboardEvent;
export const inputEventMock = new EventMock("inputEventMock") as InputEvent;
