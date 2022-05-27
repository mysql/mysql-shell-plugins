/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

import React from "react";

import { ICodeEditorOptions } from "./CodeEditor";

export const defaultEditorOptions: ICodeEditorOptions = {
    tabSize: 4,
    indentSize: 4,
    insertSpaces: true,

    defaultEOL: "LF",
    trimAutoWhitespace: true,
};

export * from "./Component/Component";
export * from "./Container/Container";

export * from "./ActivityBar/ActivityBar";
export * from "./ActivityBar/ActivityBarItem";

export * from "./Button/Button";
export * from "./Checkbox/Checkbox";
export * from "./Radiobutton/Radiobutton";
export * from "./Dialog/Dialog";
export * from "./Icon/Icon";
export * from "./Codicon";
export * from "./Image/Image";
export * from "./Popup/Popup";
export * from "./Portal/Portal";

export * from "./Grid/Grid";
export * from "./Grid/GridCell";

export * from "./Label/Label";
export * from "./Input/Input";
export * from "./Search/Search";
export * from "./Message/Message";

export * from "./SplitContainer/SplitContainer";

export * from "./Accordion/Accordion";
export * from "./Accordion/AccordionItem";

export * from "./Tabview/Tabview";
export * from "./Toggle/Toggle";
export * from "./Divider/Divider";

export * from "./List/List";
export * from "./List/DynamicList";

export * from "./Selector/Selector";
export * from "./Selector/SelectorItem";

export * from "./Menu/Menu";
export * from "./Menu/MenuBar";
export * from "./Menu/MenuItem";

export * from "./Dropdown/Dropdown";

export * from "./Breadcrumb/Breadcrumb";
export * from "./Statusbar/Statusbar";

export * from "./TreeGrid/TreeGrid";

export * from "./ColorPicker/ColorPopup";
export * from "./ColorPicker/ColorField";

export * from "./Slider/Slider";
export * from "./Toolbar/Toolbar";
export * from "./TagInput/TagInput";
export * from "./UpDown/UpDown";
export * from "./Group/Group";
export * from "./Calendar/Calendar";

export * from "./FrontPage/FrontPage";
export * from "./MessageToast/MessageToast";
export * from "./FileSelector/FileSelector";
export * from "./AboutBox/AboutBox";
export * from "./ProgressIndicator/ProgressIndicator";

export * from "./ConnectionTile/ConnectionTile";
export * from "./SessionTile/SessionTile";
export * from "./BrowserTile/BrowserTile";

export * from "./StatusMark/StatusMark";

/**
 * Creates a synthetic event from a native DOM event, for interaction of DOM events with React components.
 *
 * @param event The DOM event to use.
 *
 * @returns A new synthetic event instance.
 */
export const createSyntheticEvent = <T extends Element, E extends Event>(event: E): React.SyntheticEvent<T, E> => {
    let isDefaultPrevented = false;
    let isPropagationStopped = false;
    const preventDefault = (): void => {
        isDefaultPrevented = true;
        event.preventDefault();
    };
    const stopPropagation = (): void => {
        isPropagationStopped = true;
        event.stopPropagation();
    };

    return {
        nativeEvent: event,
        currentTarget: event.currentTarget as EventTarget & T,
        target: event.target as EventTarget & T,
        bubbles: event.bubbles,
        cancelable: event.cancelable,
        defaultPrevented: event.defaultPrevented,
        eventPhase: event.eventPhase,
        isTrusted: event.isTrusted,
        preventDefault,
        stopPropagation,
        timeStamp: event.timeStamp,
        type: event.type,

        isDefaultPrevented: (): boolean => { return isDefaultPrevented; },
        isPropagationStopped: (): boolean => { return isPropagationStopped; },
        persist: (): void => { /**/ },
    };
};
