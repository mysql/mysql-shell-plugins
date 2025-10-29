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

import { createRef, type ComponentChild } from "preact";

import { Button } from "../../../components/ui/Button/Button.js";
import {
    ComponentBase, ComponentPlacement, type IComponentProperties, type IComponentState
} from "../../../components/ui/Component/ComponentBase.js";
import { Divider } from "../../../components/ui/Divider/Divider.js";
import { Dropdown } from "../../../components/ui/Dropdown/Dropdown.js";
import { DropdownItem } from "../../../components/ui/Dropdown/DropdownItem.js";
import { Icon } from "../../../components/ui/Icon/Icon.js";
import { Label } from "../../../components/ui/Label/Label.js";
import { Menu } from "../../../components/ui/Menu/Menu.js";
import { Toolbar } from "../../../components/ui/Toolbar/Toolbar.js";
import { Assets } from "../../../supplement/Assets.js";
import type { IDiagramState } from "./DiagramDataModel.js";
import { MenuItem, type IMenuItemProperties } from "../../../components/ui/Menu/MenuItem.js";

export enum SchemaDiagramToolbarAction {
    ActiveTool,
    GridVisible,
    RulersVisible,
    MarginsVisible,
    PageBordersVisible,
    Locked,
    SelectedTopology,
    ResetView,
    DebugLogging
}

export type ActiveTool = "pointer" | "hand" | "zoom";

export interface ISchemaDiagramToolbarProperties extends IComponentProperties {
    state: IDiagramState;
    onAction: (action: SchemaDiagramToolbarAction, value: string | boolean) => void;
}

interface ISchemaDiagramToolbarState extends IComponentState {
}

export class SchemaDiagramToolbar extends ComponentBase<ISchemaDiagramToolbarProperties, ISchemaDiagramToolbarState> {
    private actionMenuRef = createRef<Menu>();

    public constructor(props: ISchemaDiagramToolbarProperties) {
        super(props);

        this.state = {
            activeTool: "pointer",
            gridVisible: true,
            rulersVisible: true,
            locked: true,
            selectedTopology: "logical",
        };
    }

    public override render(): preact.ComponentChild {
        const { state, onAction } = this.props;

        const toolsToolbarItems: ComponentChild[] = [
            <Label key="title" caption="Tools:" />,
            <Button
                key="pointerButton"
                id="pointerButton"
                className={"diagramViewButton " + (state.activeTool === "pointer" ? "active" : "")}
                data-tooltip="Select Objects"
                imageOnly={true}
                onClick={(): void => {
                    onAction(SchemaDiagramToolbarAction.ActiveTool, "pointer");
                    this.forceUpdate();
                }}
            >
                <Icon src={Assets.msm.toolPointerIcon} data-tooltip="inherit" />
            </Button>,
            <Button
                key="handButton"
                id="handButton"
                className={"diagramViewButton " + (state.activeTool === "hand" ? "active" : "")}
                data-tooltip="Zoom in/out"
                imageOnly={true}
                onClick={(): void => {
                    onAction(SchemaDiagramToolbarAction.ActiveTool, "hand");
                    this.forceUpdate();
                }}
            >
                <Icon src={Assets.msm.toolHandIcon} data-tooltip="inherit" />
            </Button>,
            <Button
                key="zoomButton"
                id="zoomButton"
                className={"diagramViewButton " + (state.activeTool === "zoom" ? "active" : "")}
                data-tooltip="Select Objects"
                imageOnly={true}
                onClick={(): void => {
                    onAction(SchemaDiagramToolbarAction.ActiveTool, "zoom");
                    this.forceUpdate();
                }}
            >
                <Icon src={Assets.msm.toolMagnifyIcon} data-tooltip="inherit" />
            </Button>,
        ];

        const viewToolbarItems: ComponentChild[] = [
            <Label key="title" caption="View:" />,
            <Button
                key="resetViewButton"
                id="resetViewButton"
                className="diagramViewButton"
                data-tooltip="Restore original zoom and position"
                imageOnly={true}
                onClick={(): void => {
                    onAction(SchemaDiagramToolbarAction.ResetView, "reset");
                    this.forceUpdate();
                }}
            >
                <Icon src={Assets.msm.toolViewResetIcon} data-tooltip="inherit" />
            </Button>,
            <Button
                key="viewGridButton"
                id="viewGridButton"
                className={"diagramViewButton" + (state.gridVisible ? " active" : "")}
                data-tooltip={state.gridVisible ? "Click to Hide Grid" : "Click to Show Grid"}
                imageOnly={true}
                onClick={(): void => {
                    onAction(SchemaDiagramToolbarAction.GridVisible, !state.gridVisible);
                    this.forceUpdate();
                }}
            >
                <Icon src={Assets.msm.toolViewGridIcon} data-tooltip="inherit" />
            </Button>,
            <Button
                key="viewRulerButton"
                id="viewRulerButton"
                className={"diagramViewButton" + (state.rulersVisible ? " active" : "")}
                data-tooltip={state.rulersVisible ? "Click to Hide Rulers" : "Click to Show Rulers"}
                imageOnly={true}
                onClick={(): void => {
                    onAction(SchemaDiagramToolbarAction.RulersVisible, !state.rulersVisible);
                    this.forceUpdate();
                }}
            >
                <Icon src={Assets.msm.toolViewRulerIcon} data-tooltip="inherit" />
            </Button>,
            <Button
                key="lockButton"
                id="lockButton"
                className={"diagramViewButton" + (state.locked ? " active" : "")}
                data-tooltip={state.locked ? "Click to Unlock Diagram" : "Click to Lock Diagram"}
                imageOnly={true}
                onClick={(): void => {
                    onAction(SchemaDiagramToolbarAction.Locked, !state.locked);
                    this.forceUpdate();
                }}
            >
                <Icon src={Assets.msm.toolViewLockIcon} data-tooltip="inherit" />
            </Button>,
        ];

        const topologyToolbarItems: ComponentChild[] = [
            <Label key="title" caption="Topology:" />,
            <Dropdown
                key="topologyDropdown"
                id="topologyDropdown"
                className={state.activeTool === "pointer" ? "active" : ""}
                data-tooltip="Select Objects"
                selection={state.selectedTopology}
                onSelect={(accept, selection): void => {
                    if (accept) {
                        const [selectedValue] = selection;
                        onAction(SchemaDiagramToolbarAction.SelectedTopology, selectedValue);
                        this.forceUpdate();
                    }
                }}
            >
                <DropdownItem id="logical" caption="Logical - All Components" />
                <DropdownItem id="pyhsical" caption="Physical" />
            </Dropdown>
        ];

        const actionToolbarItems: ComponentChild[] = [
            <Button
                id="showActionMenu"
                imageOnly={true}
                onClick={this.showActionMenu}
            >
                <Icon src={Assets.toolbar.menuIcon} data-tooltip="inherit" />
            </Button>,
        ];

        return <>
            <Toolbar
                id="schemaDiagramToolbar"
                dropShadow={false}
            >
                {toolsToolbarItems}
                <Divider vertical={true} thickness={1} />
                {viewToolbarItems}
                <Divider vertical={true} thickness={1} />
                {topologyToolbarItems}
                <Divider vertical={true} thickness={1} />
                {actionToolbarItems}
            </Toolbar >
            <Menu
                id="actionMenu"
                ref={this.actionMenuRef}
                placement={ComponentPlacement.BottomLeft}
                onItemClick={this.handleActionMenuItemClick}
            >
                <MenuItem
                    id="diagramShowPageBordersMenuItem"
                    command={{ title: "Toggle Page Borders", command: "diagramShowPageBorders" }}
                />
                <MenuItem
                    id="diagramShowPageMarginsMenuItem"
                    command={{ title: "Toggle Page Margins", command: "diagramShowPageMargins" }}
                />
                <MenuItem
                    id="schemaDiagramToolbarSeparator"
                    command={{ title: "-", command: "" }}
                    disabled
                />
                <MenuItem
                    id="debugMenuItem"
                    command={{ title: "Toggle Logging", command: "toggleDebugLog" }}
                />
            </Menu>

        </>;
    }

    private showActionMenu = (event: MouseEvent | KeyboardEvent): void => {
        event.stopPropagation();

        if (event instanceof MouseEvent) {
            const targetRect = new DOMRect(event.clientX, event.clientY, 2, 2);

            this.actionMenuRef.current?.close();
            this.actionMenuRef.current?.open(targetRect, false);
        }
    };

    private handleActionMenuItemClick = (props: IMenuItemProperties): boolean => {
        const { state, onAction } = this.props;

        const command = props.command.command;
        switch (command) {
            case "diagramShowPageBorders": {
                onAction(SchemaDiagramToolbarAction.PageBordersVisible, !state.pageBordersVisible);
                this.forceUpdate();

                break;
            }

            case "diagramShowPageMargins": {
                onAction(SchemaDiagramToolbarAction.MarginsVisible, !state.marginsVisible);
                this.forceUpdate();

                break;
            }

            case "toggleDebugLog": {
                onAction(SchemaDiagramToolbarAction.DebugLogging, !state.debugLogging);

                break;
            }

            default:
        }

        return true;
    };

}
