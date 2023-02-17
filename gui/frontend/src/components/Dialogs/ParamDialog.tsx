/*
 * Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

import paramIcon from "../../assets/images/parameters.svg";
import "./ParamDialog.css";

import { ComponentChild, createRef } from "preact";
import { Button, IButtonProperties } from "../ui/Button/Button";
import { Codicon } from "../ui/Codicon";
import { IComponentProperties, IComponentState, ComponentBase } from "../ui/Component/ComponentBase";
import { ContentAlignment } from "../ui/Container/Container";
import { Dialog } from "../ui/Dialog/Dialog";
import { Grid } from "../ui/Grid/Grid";
import { GridCell } from "../ui/Grid/GridCell";
import { Icon } from "../ui/Icon/Icon";
import { Input, IInputChangeProperties } from "../ui/Input/Input";
import { Label } from "../ui/Label/Label";

interface IParamDialogProperties extends IComponentProperties {
    caption?: string;
    onClose?: (accepted: boolean, payload?: unknown) => void;
}

interface IParamDialogState extends IComponentState {
    name: string;
    value: string;
}

export class ParamDialog extends ComponentBase<IParamDialogProperties, IParamDialogState> {

    private dialogRef = createRef<Dialog>();

    public constructor(props: IParamDialogProperties) {
        super(props);

        this.state = {
            name: "",
            value: "",
        };

        this.addHandledProperties("caption", "onClose");
    }

    public show = (): void => {
        return this.dialogRef.current?.open();
    };

    public render(): ComponentChild {
        const { caption } = this.props;
        const { name, value } = this.state;

        const className = this.getEffectiveClassNames(["paramDialog"]);
        const dlgCaption = caption ?? "Please enter name/vale pair:";

        return <Dialog
            ref={this.dialogRef}
            className={className}
            onClose={this.closeDialog}
            caption={
                <>
                    <Icon src={Codicon.PassFilled} />
                    <Label>Parameters</Label>
                </>
            }
            content={
                <Grid columns={["128px", "auto", "auto"]} columnGap={8}>
                    <GridCell rowSpan={4}><Icon src={paramIcon} width={128} height={128} /></GridCell>
                    <GridCell columnSpan={2} crossAlignment={ContentAlignment.Center}>
                        <Label id="caption" caption={dlgCaption} />
                    </GridCell>
                    <GridCell className="left" crossAlignment={ContentAlignment.Center}>Parameter name:</GridCell>
                    <GridCell className="right" crossAlignment={ContentAlignment.Center}>
                        <Input id="name" value={name} onChange={this.handleNameChange} />
                    </GridCell>
                    <GridCell className="left" crossAlignment={ContentAlignment.Center}>Parameter value:</GridCell>
                    <GridCell className="right" crossAlignment={ContentAlignment.Center}>
                        <Input id="value" value={value} onChange={this.handleValueChange} />
                    </GridCell>
                </Grid>
            }
            actions={{
                end: [
                    <Button
                        id="ok"
                        key="ok"
                        caption="OK"
                        onClick={this.handleButtonClick}
                    />,
                    <Button
                        id="cancel"
                        key="cancel"
                        caption="Cancel"
                        onClick={this.handleButtonClick}
                    />,
                ],
            }}
        />;
    }

    private handleNameChange = (e: InputEvent, props: IInputChangeProperties): void => {
        this.setState({ name: props.value });
    };

    private handleValueChange = (e: InputEvent, props: IInputChangeProperties): void => {
        this.setState({ value: props.value });
    };

    private handleButtonClick = (e: MouseEvent | KeyboardEvent, props: IButtonProperties): void => {
        this.dialogRef.current?.close(props.id !== "ok");
    };

    private closeDialog = (cancelled: boolean): void => {
        const { onClose } = this.props;
        const { name, value } = this.state;

        onClose?.(cancelled, { name, value });
    };
}
