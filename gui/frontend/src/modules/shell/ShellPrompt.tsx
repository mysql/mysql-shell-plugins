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

import { ComponentChild, createRef } from "preact";

import { IShellPromptValues } from "../../communication/ProtocolGui.js";
import { Breadcrumb } from "../../components/ui/Breadcrumb/Breadcrumb.js";
import { IComponentProperties, IComponentState, ComponentBase } from "../../components/ui/Component/ComponentBase.js";
import { Label } from "../../components/ui/Label/Label.js";
import { Menu } from "../../components/ui/Menu/Menu.js";
import { MenuItem, IMenuItemProperties } from "../../components/ui/Menu/MenuItem.js";

import { requisitions } from "../../supplement/Requisitions.js";

interface IShellPromptProperties extends IComponentProperties {
    values: IShellPromptValues;

    getSchemas: () => Promise<string[]>;
    onSelectSchema?: (schema: string) => void;
}

interface IShellPromptState extends IComponentState {
    values: IShellPromptValues;
    schemaNames: string[];
}

/** These values represent a special symbol in the MySQL font. */
enum TypeSymbol {
    Server = "\ue895",
    Schema = "\ue894",
    SSL = "\ue0a2",
}

export class ShellPrompt extends ComponentBase<IShellPromptProperties, IShellPromptState> {

    private schemaMenuRef = createRef<Menu>();

    public constructor(props: IShellPromptProperties) {
        super(props);

        this.state = {
            values: props.values,
            schemaNames: [],
        };
    }

    public static override getDerivedStateFromProps(props: IShellPromptProperties): Partial<IShellPromptState> {
        return {
            values: props.values,
        };
    }

    public override componentDidMount(): void {
        requisitions.register("updateShellPrompt", this.updateShellPrompt);
    }

    public override componentWillUnmount(): void {
        requisitions.unregister("updateShellPrompt", this.updateShellPrompt);
    }

    public render(): ComponentChild {
        const { values, schemaNames } = this.state;

        const className = this.getEffectiveClassNames(["shellPrompt"]);

        const items: ComponentChild[] = [];
        if (values.promptDescriptor) {
            if (!values.promptDescriptor.host) {
                // Not connected yet.
                items.push(
                    <Label
                        key="server"
                        id="server"
                        className="shellPromptItem"
                        caption="not connected"
                        data-tooltip="The session is not connected to a MySQL server"
                    />,
                );
            } else {
                let serverText = values.promptDescriptor.host;
                let tooltip = "Connection to server " + values.promptDescriptor.host;
                if (values.promptDescriptor.socket) {
                    serverText = "localhost";
                }

                if (values.promptDescriptor.port) {
                    serverText += `:${values.promptDescriptor.port}`;
                    tooltip += ` at port ${values.promptDescriptor.port}`;
                }

                if (values.promptDescriptor.session === "x") {
                    serverText += "+";
                    tooltip += ", using the X protocol";
                } else {
                    tooltip += ", using the classic protocol";
                }

                if (values.promptDescriptor.ssl === "SSL") {
                    serverText += ` ${TypeSymbol.SSL}`;
                    tooltip += " (encrypted)";
                }

                items.push(
                    <Label
                        key="server"
                        id="server"
                        className="shellPromptItem"
                        caption={`${TypeSymbol.Server} ${serverText}`}
                        data-tooltip={tooltip}
                    />,
                );

                const schemaText = values.promptDescriptor.schema ?? "no schema selected";
                items.push(
                    <Label
                        key="schema"
                        id="schema"
                        className="shellPromptItem"
                        caption={`${TypeSymbol.Schema} ${schemaText}`}
                        onClick={this.handleSchemaSectionClick}
                    />,
                );
            }
        }

        const menuItems = schemaNames.map((schema) => {
            return <MenuItem key={schema} command={{ title: TypeSymbol.Schema + " " + schema, command: "" }} />;
        });

        return (
            <>
                <Breadcrumb className={className}>
                    {items}
                </Breadcrumb>
                <Menu
                    className="shellPromptSchemaMenu"
                    ref={this.schemaMenuRef}
                    onItemClick={this.handleSchemaItemClick}
                >
                    {menuItems}
                </Menu>
            </>
        );
    }

    private updateShellPrompt = (values: IShellPromptValues): Promise<boolean> => {
        return new Promise((resolve) => {
            this.setState({ values }, () => { resolve(true); });
        });
    };

    private handleSchemaSectionClick = (e: MouseEvent | KeyboardEvent): void => {
        const { getSchemas } = this.props;

        e.stopPropagation();
        void getSchemas?.().then((schemaNames) => {
            this.setState({ schemaNames }, () => {
                const clientRect = (e.target as Element).getBoundingClientRect();
                const targetRect = new DOMRect(clientRect.x, clientRect.y + clientRect.height, 1, 1);
                this.schemaMenuRef.current?.open(targetRect, false);
            });
        });
    };

    private handleSchemaItemClick = (props: IMenuItemProperties): boolean => {
        const { onSelectSchema } = this.props;
        onSelectSchema?.(props.command.title.substring(2) ?? "");

        return true;
    };
}
