/*
 * Copyright (c) 2022, 2026, Oracle and/or its affiliates.
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

import { fireEvent, render } from "@testing-library/preact";
import { describe, expect, it, vi } from "vitest";

import {
    ConnectionTile, ConnectionTileType, type IConnectionTileProperties, type ITileActionOptions,
} from "../../../../../components/ui/ConnectionTile/ConnectionTile.js";
import { Assets } from "../../../../../supplement/Assets.js";
import { DBType, IConnectionDetails } from "../../../../../supplement/ShellInterface/index.js";

describe("ConnectionTile component tests", (): void => {

    const details: IConnectionDetails = {
        id: 1,
        index: -1,
        dbType: DBType.MySQL,
        caption: "Tile 1",
        description: "A description",
        options: {},
    };

    type ConnectionTileAction = (
        action: string,
        props: IConnectionTileProperties,
        options: ITileActionOptions,
    ) => void;

    it("Test ConnectionTile output (Snapshot)", () => {
        const { container, unmount } = render(
            <ConnectionTile
                id="tile1"
                tileId={"1"}
                caption={details.caption}
                description={details.description}
                type={ConnectionTileType.Open}
                icon={Assets.file.mysqlIcon}

            />,
        );
        expect(container).toMatchSnapshot();

        unmount();
    });

    it("renders only the menu action for folder tiles", () => {
        const { container, unmount } = render(
            <ConnectionTile
                id="tile2"
                tileId={"2"}
                caption={"Folder"}
                description={"Connection Group"}
                type={ConnectionTileType.Group}
                icon={Assets.file.folderIcon}
            />,
        );

        expect(container.querySelector("#tileMoreActionsAction")).toBeTruthy();
        expect(container.querySelector("#tileNewNotebookAction")).toBeNull();
        expect(container.querySelector("#tileMigrationAssistantAction")).toBeNull();

        unmount();
    });

    it("opens the migration assistant from the connection tile quick action", () => {
        const onAction = vi.fn<ConnectionTileAction>();
        const { container, unmount } = render(
            <ConnectionTile
                id="tile3"
                tileId={"3"}
                caption={details.caption}
                description={details.description}
                type={ConnectionTileType.Open}
                icon={Assets.file.mysqlIcon}
                onAction={onAction}
            />,
        );

        const button = container.querySelector<HTMLElement>("#tileMigrationAssistantAction")!;
        fireEvent.click(button);

        expect(onAction).toHaveBeenCalledTimes(1);
        const [action, props, options] = onAction.mock.calls[0];
        expect(action).toBe("msg.startMySQLCloudMigrationAssistant");
        expect(props.tileId).toBe("3");
        expect(options).toStrictEqual({});

        unmount();
    });

    it("passes a point anchor when opening the menu with a mouse click", () => {
        const onAction = vi.fn<ConnectionTileAction>();
        const { container, unmount } = render(
            <ConnectionTile
                id="tile3"
                tileId={"3"}
                caption={details.caption}
                description={details.description}
                type={ConnectionTileType.Open}
                icon={Assets.file.mysqlIcon}
                onAction={onAction}
            />,
        );

        const button = container.querySelector<HTMLElement>("#tileMoreActionsAction")!;
        fireEvent.click(button, { clientX: 123, clientY: 456 });

        expect(onAction).toHaveBeenCalledTimes(1);
        const [action, props, options] = onAction.mock.calls[0];
        expect(action).toBe("menu");
        expect(props.tileId).toBe("3");
        expect(options.target).toBe(button);
        expect(options.anchorRect?.x).toBe(123);
        expect(options.anchorRect?.y).toBe(456);
        expect(options.anchorRect?.width).toBe(2);
        expect(options.anchorRect?.height).toBe(2);

        unmount();
    });
});
