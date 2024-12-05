/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

import "./LoginPage.css";
import logo from "../../assets/images/modules/module-shell.svg";
import chevronRight from "../../assets/images/chevron-right.svg";

import { ComponentChild } from "preact";

import { MessageType } from "../../app-logic/general-types.js";
import { appParameters, requisitions } from "../../supplement/Requisitions.js";
import { ResponseError } from "../../communication/ResponseError.js";
import { ShellInterface } from "../../supplement/ShellInterface/ShellInterface.js";
import { IComponentState, ComponentBase } from "../ui/Component/ComponentBase.js";
import { Container, Orientation, ContentAlignment, ContentWrap } from "../ui/Container/Container.js";
import { Grid } from "../ui/Grid/Grid.js";
import { GridCell } from "../ui/Grid/GridCell.js";
import { Icon } from "../ui/Icon/Icon.js";
import { Input, IInputChangeProperties } from "../ui/Input/Input.js";
import { Label } from "../ui/Label/Label.js";
import { Message } from "../ui/Message/Message.js";
import { Button } from "../ui/Button/Button.js";
import { HelpLinkList } from "../ui/HelpLinkList/HelpLinkList.js";
import { helpUrlMap } from "../../supplement/index.js";

interface ILoginPageState extends IComponentState {
    userName: string;
    password: string;
    errorMessage: string;
}

// Implements the main login page for the application.
export class LoginPage extends ComponentBase<{}, ILoginPageState> {
    public constructor(props: {}) {
        super(props);

        this.state = {
            userName: "",
            password: "",
            errorMessage: "",
        };
    }

    public render(): ComponentChild {
        const { userName, password, errorMessage } = this.state;

        const title = appParameters.embedded ? "MySQL Shell GUI" : "MySQL Shell Workbench";

        return (
            <Container id="loginDialog" orientation={Orientation.TopDown}>
                <Icon src={logo} id="loginDialogSakilaLogo" />
                <Container id="heading" orientation={Orientation.TopDown}>
                    <Label id="headingLabel">
                        MySQL Shell
                    </Label>
                    <Label id="headingSubLabel">
                        Welcome to the {title}.
                        <br />Please provide your {title} credentials to log into the shell interface.
                    </Label>
                </Container>
                <Container
                    id="loginDialogLinks"
                    orientation={Orientation.LeftToRight}
                    mainAlignment={ContentAlignment.Center}
                    wrap={ContentWrap.Wrap}
                >
                    <HelpLinkList helpUrlMap={helpUrlMap} />
                </Container>

                <Grid
                    id="loginDialogControls"
                    columns={[220, 40]}
                    columnGap={8}
                >
                    <GridCell orientation={Orientation.TopDown}>
                        <Input
                            id="loginUsername"
                            placeholder="Username"
                            spellCheck={false}
                            value={userName}
                            onChange={this.handleInput}
                            onConfirm={this.login}
                        />
                    </GridCell>
                    <GridCell />
                    <GridCell orientation={Orientation.TopDown}>
                        <Input
                            password={true}
                            id="loginPassword"
                            placeholder="Password"
                            value={password}
                            onChange={this.handleInput}
                            onConfirm={this.login}
                        />
                    </GridCell>
                    <GridCell orientation={Orientation.TopDown} mainAlignment={ContentAlignment.Center}>
                        <Button id="loginButton" round onClick={this.login}>
                            <Icon src={chevronRight} />
                        </Button>
                    </GridCell>
                </Grid>

                {errorMessage && (
                    <Message type={MessageType.Error}>{errorMessage}</Message>
                )}

                <Label id="loginDialogSubtext">
                    If you do not have a ${title} account yet, please<br />
                    ask your administrator to have one created for you.
                </Label>
                <div className="copyright" />
            </Container>
        );
    }

    private login = (): void => {
        const { userName, password } = this.state;

        ShellInterface.users.authenticate(userName, password).then((profile) => {
            this.setState({ errorMessage: "" });
            if (profile) {
                void requisitions.execute("userAuthenticated", profile);
            }
        }).catch((reason) => {
            if (reason instanceof ResponseError) {
                this.setState({ errorMessage: reason.message });
            } else {
                this.setState({ errorMessage: reason });
            }
        });
    };

    private handleInput = (_: InputEvent, props: IInputChangeProperties): void => {
        if (props.id === "loginUsername") {
            this.setState({ userName: props.value });
        } else {
            this.setState({ password: props.value });
        }
    };
}
