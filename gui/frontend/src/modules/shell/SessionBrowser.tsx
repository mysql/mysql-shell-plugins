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

import sessionIcon from "../../assets/images/modules/module-shell.svg";
import plusIcon from "../../assets/images/plus.svg";

import "./Shell.css";

import { ComponentChild, createRef } from "preact";

import { requisitions } from "../../supplement/Requisitions.js";

import { Settings } from "../../supplement/Settings/Settings.js";
import { IShellSessionDetails } from "../../supplement/ShellInterface/index.js";
import { BrowserTileType, IBrowserTileProperties } from "../../components/ui/BrowserTile/BrowserTile.js";
import { IComponentProperties, ComponentBase } from "../../components/ui/Component/ComponentBase.js";
import { Container, Orientation, ContentWrap } from "../../components/ui/Container/Container.js";
import { FrontPage } from "../../components/ui/FrontPage/FrontPage.js";
import { Label } from "../../components/ui/Label/Label.js";
import { SessionTile, ISessionTileProperties } from "../../components/ui/SessionTile/SessionTile.js";

interface ISessionBrowserProperties extends IComponentProperties {
    openSessions: IShellSessionDetails[];
}

export class SessionBrowser extends ComponentBase<ISessionBrowserProperties> {

    private newSessionTileRef = createRef<HTMLDivElement>();

    public componentDidMount(): void {
        requisitions.register("settingsChanged", this.settingsChanged);

        setTimeout(() => {
            this.newSessionTileRef.current?.focus();
        }, 200);
    }

    public componentWillUnmount(): void {
        requisitions.unregister("settingsChanged", this.settingsChanged);
    }

    public render(): ComponentChild {
        const { openSessions } = this.props;

        const className = this.getEffectiveClassNames(["sessionBrowser"]);

        const tiles = [];
        openSessions.forEach((session) => {
            const details: IShellSessionDetails = {
                sessionId: session.sessionId,
                caption: session.caption,
                description: session.description,
            };

            tiles.push(
                <SessionTile
                    tileId={details.sessionId}
                    key={details.caption}
                    caption={details.caption ?? ""}
                    description={details.description ?? ""}
                    details={details}
                    icon={sessionIcon}
                    type={BrowserTileType.Open}
                    onAction={this.handleTileAction}
                />,
            );

        });

        const details: IShellSessionDetails = {
            sessionId: -1,
            caption: "New Shell Session",
            description: "Opens a new Shell instance tab",
        };

        tiles.push(
            <SessionTile
                innerRef={this.newSessionTileRef}
                tileId={details.sessionId}
                key={details.caption}
                caption={details.caption ?? ""}
                description={details.description ?? ""}
                details={details}
                icon={plusIcon}
                type={BrowserTileType.CreateNew}
                onAction={this.handleTileAction}
            />,
        );

        const linkMap = new Map<string, string>();
        linkMap.set("Learn More >", "https://blogs.oracle.com/mysql/post/introducing-mysql-shell-for-vs-code");
        linkMap.set("Browse Tutorial >", "https://www.mysql.com");
        linkMap.set("Read Docs >", "https://www.mysql.com");

        return (
            <Container
                className={className}
                orientation={Orientation.TopDown}
                wrap={ContentWrap.Wrap}
            >
                <FrontPage
                    showGreeting={Settings.get("shellSession.sessionBrowser.showGreeting", true)}
                    caption="MySQL Shell - GUI Console"
                    description={"The GUI Console combines the advantages of MySQL Shell running in a classic " +
                        "terminal with the power of the interactive command editor of the MySQL Shell GUI."
                    }
                    helpUrls={linkMap}
                    onCloseGreeting={this.handleCloseGreeting}
                >
                    <Label id="contentTitle" caption="MySQL Shell Sessions" />
                    <Container
                        id="tilesHost"
                        orientation={Orientation.LeftToRight}
                        wrap={ContentWrap.Wrap}
                    >
                        {tiles}
                    </Container>
                </FrontPage>
            </Container>
        );
    }

    private settingsChanged = (entry?: { key: string; value: unknown; }): Promise<boolean> => {
        if (entry?.key === "shellSession.sessionBrowser.showGreeting") {
            this.forceUpdate();

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

    private handleCloseGreeting = (): void => {
        Settings.set("shellSession.sessionBrowser.showGreeting", false);
    };

    private handleTileAction = (action: string, props: IBrowserTileProperties): void => {
        this.doHandleTileAction(action, (props as ISessionTileProperties)?.details);
    };

    private doHandleTileAction = (action: string, details?: IShellSessionDetails): void => {
        switch (action) {
            case "new": {
                void requisitions.execute("newSession", { sessionId: -1 });

                break;
            }

            case "open": {
                if (details) {
                    void requisitions.execute("openSession", details);
                }

                break;
            }

            case "remove": {
                if (details) {
                    void requisitions.execute("removeSession", details);
                }

                break;
            }

            default: {
                break;
            }
        }
    };

    /**
     * Triggered after the user dragged one tile onto another. This is used to reorder tiles.
     *
     * @param draggedTileId The id of the tile that has been dragged.
     * @param props The properties of the tile onto which the other tile was dropped.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private handleTileReorder = (draggedTileId: number, props: ISessionTileProperties): void => {
        // Note: the "New Connection" tile cannot be dragged, but can be a drag target.
        /*if (draggedTileId !== props.details.id) {
            const { connectionOrder } = this.state;

            const sourceIndex = connectionOrder.findIndex((id: number) => id === draggedTileId);
            let targetIndex = connectionOrder.findIndex((id: number) => id === props.details.id);

            // Now move the dragged tile into the place where the target tile is located, moving the target tile
            // and others following it one place up.
            if (targetIndex === -1) {
                // Dragged onto the "New Connection" tile - move the dragged tile to the end.
                const elements = connectionOrder.splice(sourceIndex, 1);
                connectionOrder.push(...elements);
            } else {
                if (sourceIndex + 1 !== targetIndex) {
                    if (sourceIndex < targetIndex) {
                        --targetIndex; // -1 because after removal of the source connection all indexes are moved down.
                    }
                    const elements = connectionOrder.splice(sourceIndex, 1);
                    connectionOrder.splice(targetIndex, 0, ...elements);
                }
            }

            this.setState({ connectionOrder });
        }*/
    };

}
