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

import closeButton from "../../assets/images/close2.svg";
import cloneButton from "../../assets/images/clone.svg";

import React from "react";
import Color from "color";

import {
    Component, IComponentProperties, Container, ITag, CheckState, Orientation, Button, Icon, Grid, GridCell, Label,
    Input, TagInput, Checkbox, ICheckboxProperties, IInputChangeProperties, ColorField, IColorFieldProperties,
} from "../ui";
import { ITokenEntry } from "./ThemeManager";

export interface ITokenEditorProperties extends IComponentProperties {
    token: ITokenEntry;

    onScopeListClick: (e: React.SyntheticEvent) => void;
    onChange: (id: string, token: ITokenEntry) => void;
    onRemove: (id: string, token: ITokenEntry) => void;
    onDuplicate: (id: string, token: ITokenEntry) => void;
}

export class TokenEditor extends Component<ITokenEditorProperties> {

    public constructor(props: ITokenEditorProperties) {
        super(props);

        this.addHandledProperties("onScopeListClick", "onRemove");
    }

    public render(): React.ReactNode {
        const { id, token, onScopeListClick } = this.props;

        const fontStyles = token.settings.fontStyle?.split(" ") || [];
        const name = token.name || "";
        const scopes = Array.isArray(token.scope) ? token.scope : [token.scope];
        const bold = fontStyles.includes("bold") ? CheckState.Checked : CheckState.Unchecked;
        const italic = fontStyles.includes("italic") ? CheckState.Checked : CheckState.Unchecked;
        const underline = fontStyles.includes("underline") ? CheckState.Checked : CheckState.Unchecked;
        const foreground = token.settings.foreground ? new Color(token.settings.foreground) : undefined;
        const background = token.settings.background ? new Color(token.settings.background) : undefined;

        const elementTags: ITag[] = scopes.map((tag: string) => {
            return {
                id: tag,
                caption: tag,
            };
        });

        return (
            <Container
                className="syntaxStyleEntry"
                orientation={Orientation.TopDown}
            >
                <Button
                    round
                    id={id}
                    className="styleEntryDeleteButton"
                    data-tooltip="Delete this syntax entry"
                    onClick={this.handleDeleteTokenClick}
                >
                    <Icon src={closeButton} data-tooltip="inherit" />
                </Button>

                <Button
                    round
                    id={id}
                    className="styleEntryCloneButton"
                    data-tooltip="Clone this syntax entry"
                    onClick={this.handleCloneTokenClick}
                >
                    <Icon src={cloneButton} data-tooltip="inherit" />
                </Button>

                <Grid columns={2} rowGap={4} columnGap={16}>
                    <GridCell>
                        <Label caption="Name:" />
                    </GridCell>
                    <GridCell
                    >
                        <Input
                            id={id}
                            placeholder="<no name assigned>"
                            value={name}
                            onChange={this.handleNameChange}
                        />
                    </GridCell>
                    <GridCell columnSpan={2}>
                        <TagInput
                            id={id}
                            tags={elementTags}
                            orientation={Orientation.LeftToRight}
                            removable
                            className="scopeList"
                            data-tooltip="Click here to add more tags"
                            style={{ flex: "1 1 auto" }}
                            onClick={onScopeListClick}
                            onAdd={this.addScopeToTokenEntry}
                            onRemove={this.removeScopeFromTokenEntry}
                        />
                    </GridCell>
                    <GridCell
                        orientation={Orientation.TopDown}
                        style={{ overflow: "visible" }}
                    >
                        <Container className="syntaxColor">
                            <Label caption="Foreground" style={{ flexGrow: 1 }} />
                            <ColorField
                                id="foreground"
                                initialColor={foreground}
                                onChange={this.handleColorChange}
                            />
                        </Container>
                        <Container className="syntaxColor">
                            <Label caption="Background" style={{ flexGrow: 1 }} />
                            <ColorField id="background" initialColor={background} onChange={this.handleColorChange} />
                        </Container>
                    </GridCell>
                    <GridCell orientation={Orientation.TopDown}>
                        <Checkbox id="bold" caption="bold" checkState={bold} onChange={this.handleCheckChange} />
                        <Checkbox id="italic" caption="italic" checkState={italic} onChange={this.handleCheckChange} />
                        <Checkbox
                            id="underline"
                            caption="underline"
                            checkState={underline}
                            onChange={this.handleCheckChange}
                        />
                    </GridCell>
                </Grid>
            </Container>
        );
    }

    private handleDeleteTokenClick = (): void => {
        const { id, token, onRemove } = this.props;

        onRemove(id!, token);
    };

    private handleCloneTokenClick = (): void => {
        const { id, token, onDuplicate } = this.props;

        onDuplicate(id!, token);
    };

    private addScopeToTokenEntry = (id: string): void => {
        const { onChange, token } = this.props;
        const scopes = Array.isArray(token.scope) ? token.scope : [token.scope];

        token.scope = [...new Set(scopes).add(id)].sort();
        this.forceUpdate();
        onChange(id, token);
    };

    /**
     * Called when the user wants to remove a tag from a token entry.
     *
     * @param id The id of the tag to remove.
     */
    private removeScopeFromTokenEntry = (id: string): void => {
        const { onChange, token } = this.props;
        const scopes = Array.isArray(token.scope) ? token.scope : [token.scope];

        const set = new Set(scopes);
        set.delete(id);
        token.scope = [...set].sort();
        this.forceUpdate();
        onChange(id, token);
    };

    private handleCheckChange = (checkState: CheckState, props: ICheckboxProperties): void => {
        const { onChange, token } = this.props;
        const fontStyles = new Set(token.settings.fontStyle?.split(" ") || []);

        switch (props.id) {
            case "bold": {
                if (checkState === CheckState.Checked) {
                    fontStyles.add("bold");
                } else {
                    fontStyles.delete("bold");
                }

                break;
            }

            case "italic": {
                if (checkState === CheckState.Checked) {
                    fontStyles.add("italic");
                } else {
                    fontStyles.delete("italic");
                }

                break;
            }

            case "underline": {
                if (checkState === CheckState.Checked) {
                    fontStyles.add("underline");
                } else {
                    fontStyles.delete("underline");
                }

                break;
            }

            default: {
                break;
            }
        }

        token.settings.fontStyle = Array.from(fontStyles).join(" ");

        this.forceUpdate();
        onChange(props.id!, token);
    };

    private handleColorChange = (color: Color | undefined, props: IColorFieldProperties): void => {
        const { onChange, token } = this.props;

        const foreground = props.id === "foreground";
        const colorString = color?.hexa();
        if (foreground) {
            token.settings.foreground = colorString;
        } else {
            token.settings.background = colorString;
        }

        this.forceUpdate();
        onChange(props.id!, token);
    };

    private handleNameChange = (e: React.ChangeEvent, props: IInputChangeProperties): void => {
        const { onChange, token } = this.props;
        token.name = props.value;
        this.forceUpdate();

        onChange(props.id!, token);
    };
}
