/*
 * Copyright (c) 2023, 2025, Oracle and/or its affiliates.
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

import "./MrsAuthDialog.css";

import { ComponentChild, createRef } from "preact";

import { IServicePasswordRequest } from "../../../app-logic/general-types.js";
import { Button, IButtonProperties } from "../../../components/ui/Button/Button.js";
import { Codicon } from "../../../components/ui/Codicon.js";
import { ComponentBase, IComponentState } from "../../../components/ui/Component/ComponentBase.js";
import { ContentAlignment } from "../../../components/ui/Container/Container.js";
import { Dialog } from "../../../components/ui/Dialog/Dialog.js";
import { Dropdown } from "../../../components/ui/Dropdown/Dropdown.js";
import { DropdownItem } from "../../../components/ui/Dropdown/DropdownItem.js";
import { Grid } from "../../../components/ui/Grid/Grid.js";
import { GridCell } from "../../../components/ui/Grid/GridCell.js";
import { Icon } from "../../../components/ui/Icon/Icon.js";
import { IInputChangeProperties, Input } from "../../../components/ui/Input/Input.js";
import { Label } from "../../../components/ui/Label/Label.js";
import { requisitions } from "../../../supplement/Requisitions.js";
import { IMrsAuthApp, IMrsLoginResult, MrsBaseService } from "../sdk/MrsBaseClasses.js";
import { IMrsAuthRequestPayload } from "../types.js";

interface IMrsAuthDialogState extends IComponentState {
    request?: IServicePasswordRequest,
    authAppList?: IMrsAuthApp[],
    userName: string,
    password: string,
    error?: string,
    errorCode?: number,
    authenticating: boolean,
    selectedAuthApp?: string,
}

export class MrsAuthDialog extends ComponentBase<{}, IMrsAuthDialogState> {

    private dialogRef = createRef<Dialog>();
    private loginResult: IMrsLoginResult = {};

    public constructor(props: {}) {
        super(props);

        this.state = {
            userName: "",
            password: "",
            authenticating: false,
        };
    }

    public override componentDidMount(): void {
        requisitions.register("requestMrsAuthentication", this.prefillAndOpenDialog);
    }

    public override componentWillUnmount(): void {
        requisitions.unregister("requestMrsAuthentication", this.prefillAndOpenDialog);
    }

    public render(): ComponentChild {
        const { request, userName = "", password, error, authAppList = [], authenticating, selectedAuthApp }
            = this.state;

        if (!request) {
            return null;
        }

        const className = this.getEffectiveClassNames(["mrsAuthDialog"]);
        const caption = "MySQL REST Service Authentication";

        // Get payload
        const payload: IMrsAuthRequestPayload = request.payload as IMrsAuthRequestPayload;

        const authAppItems = authAppList.map((item: IMrsAuthApp, itemIndex: number) => {
            return <DropdownItem
                caption={item.name}
                key={itemIndex}
                id={item.name}
            />;
        });

        return <Dialog
            ref={this.dialogRef}
            className={className}
            onClose={this.closeDialog}
            caption={
                <>
                    <Icon src={Codicon.Lock} />
                    <Label>{caption}</Label>
                </>
            }
            content={<>
                <Grid columns={["30%", "auto"]} columnGap={8} rowGap={8}>
                    {
                        request.service && <>
                            <GridCell className="left" crossAlignment={ContentAlignment.Center}>Service:</GridCell>
                            <GridCell className="right" crossAlignment={ContentAlignment.Center}>
                                <Label language="ansi" caption={request.service} />
                            </GridCell>
                        </>
                    }
                    {
                        <>
                            <GridCell className="left" crossAlignment={ContentAlignment.Center}>Sign in with:</GridCell>
                            <GridCell className="right" crossAlignment={ContentAlignment.Center}>
                                <Dropdown
                                    id="authAppDropdown"
                                    key="authAppDropdown"
                                    className="authApp loginControl"
                                    selection={selectedAuthApp}
                                    optional={false}
                                    onSelect={this.selectAuthApp}
                                >
                                    {
                                        (!authAppList.length && payload.authApp) &&
                                        <DropdownItem
                                            caption={payload.authApp}
                                            key={payload.authApp}
                                            id={payload.authApp}
                                        />
                                    }
                                    {authAppItems}
                                </Dropdown>
                            </GridCell>
                        </>
                    }

                    <GridCell className="left" crossAlignment={ContentAlignment.Center}>User Name:</GridCell>
                    <GridCell className="right" crossAlignment={ContentAlignment.Center}>
                        <Input
                            autoFocus={(userName === "")}
                            value={userName}
                            onChange={this.handleUserNameChange}
                            onConfirm={this.handleUserNameConfirm}
                            className="loginControl"
                        />
                    </GridCell>

                    <GridCell className="left" crossAlignment={ContentAlignment.Center}>Password:</GridCell>
                    <GridCell className="right" crossAlignment={ContentAlignment.Center}>
                        <Input
                            id="mrsPasswordInput"
                            autoFocus={(userName !== "")}
                            password={true}
                            onChange={this.handlePasswordChange}
                            onConfirm={this.handlePasswordConfirm}
                            className="loginControl"
                        />
                    </GridCell>
                </Grid>
                {
                    authenticating && <>
                        <div className="authenticatingDiv">
                            <Label className="authenticatingLbl" language="ansi" caption="Authenticating ..." />
                            <div className="authenticatingAnim"></div>
                        </div>
                    </>
                }
                {
                    error && <>
                        <div className="errorDiv">
                            <Label className="errorLbl" language="ansi" caption={error} />
                        </div>
                    </>
                }
            </>
            }
            actions={{
                end: [
                    <Button
                        id="ok"
                        key="ok"
                        caption="OK"
                        onClick={this.handleButtonClick}
                        disabled={error !== undefined || userName === "" || password === "" || authenticating}
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

    private prefillAndOpenDialog = (values: IServicePasswordRequest): Promise<boolean> => {
        return new Promise((resolve) => {
            this.setState({ request: values, userName: values.user }, () => {
                // Fetch the AuthApp list
                this.getAuthApps().then((authApps = []) => {
                    const requestAuthApp = values.payload ? String(values.payload.authApp) : "";
                    const selectedAuthApp = !authApps.length ? requestAuthApp : authApps.some((app) => {
                        return app.name === requestAuthApp;
                    }) ? requestAuthApp : authApps[0]?.name;
                    this.setState({ authAppList: authApps, error: undefined, errorCode: undefined, selectedAuthApp });
                }).catch((reason) => {
                    this.setState({ error: String(reason) });
                });

                this.dialogRef.current?.open();
                resolve(true);
            });
        });
    };

    private handleUserNameChange = (_: InputEvent, props: IInputChangeProperties): void => {
        this.setState({ userName: props.value, error: undefined });
    };

    private handleUserNameConfirm = (): void => {
        document.getElementById("mrsPasswordInput")?.focus();
    };

    private handlePasswordChange = (_: InputEvent, props: IInputChangeProperties): void => {
        this.setState({ password: props.value, error: undefined });
    };

    private handlePasswordConfirm = (): void => {
        this.startAuthentication();
    };

    private handleButtonClick = (_: MouseEvent | KeyboardEvent, props: IButtonProperties): void => {
        if (props.id === "ok") {
            this.startAuthentication();
        } else {
            this.dialogRef.current?.close(true);
        }
    };

    private closeDialog = (cancelled: boolean): void => {
        const { request, password } = this.state;

        if (request) {
            if (cancelled) {
                void requisitions.execute("cancelMrsAuthentication", request);
            } else {
                if (request.payload === undefined) {
                    request.payload = {};
                }
                request.payload.loginResult = this.loginResult;
                void requisitions.execute("acceptMrsAuthentication", { request, password });
            }
        }
    };

    private startAuthentication = () => {
        this.doAuthenticate().then((res) => {
            if (res) {
                this.dialogRef.current?.close(false);
            } else {
                this.setState({ error: this.loginResult.errorMessage });
            }
        }).catch((e) => {
            this.setState({ error: String(e) });
        });
    };

    private doAuthenticate = async (): Promise<boolean> => {
        const { authAppList = [], request, userName, password, selectedAuthApp } = this.state;

        if (request && request.service && selectedAuthApp && userName) {
            const mrsService = new MrsBaseService(request.service);

            this.setState({ authenticating: true });
            try {
                const authApp = authAppList.find((app) => {
                    return app.name === selectedAuthApp;
                });

                this.loginResult = await mrsService.authenticate({
                    app: selectedAuthApp,
                    vendor: authApp?.vendorId,
                    username: userName,
                    password,
                });
            } finally {
                this.setState({ authenticating: false });
            }

            request.user = userName;
        } else if (!userName) {
            this.loginResult.errorMessage = "No user name given.";
        }

        return this.loginResult.errorMessage === undefined;
    };

    private getAuthApps = async (): Promise<IMrsAuthApp[] | undefined> => {
        const { request } = this.state;

        if (request && request.service) {
            const mrsService = new MrsBaseService(
                request.service,
                request.payload
                    ? (typeof request.payload.authPath === "string" ? request.payload.authPath : undefined)
                    : undefined);

            let authApps = await mrsService.getAuthApps();

            if (authApps?.length === 0) {
                throw new Error("No Authentication Apps have been defined for this service. Please add an MRS " +
                    "or MySQL Internal Authentication App to the service first.");
            }

            // Filter out all unsupported authApps
            authApps = authApps?.filter((authApp) => {
                return (authApp.vendorId === "0x30000000000000000000000000000000" ||
                    authApp.vendorId === "0x31000000000000000000000000000000");
            });

            if (authApps?.length === 0) {
                throw new Error("The embedded MRS SDK only supports MRS or MySQL Internal Authentication Apps. " +
                    "Please add a MRS or MySQL Internal Authentication App to the service first.");
            }

            return authApps;
        }
    };

    private selectAuthApp = (accept: boolean, ids: Set<string>): void => {
        const { request } = this.state;

        // Get payload
        const payload: IMrsAuthRequestPayload = request?.payload as IMrsAuthRequestPayload;
        payload.authApp = [...ids][0];

        this.setState({ request });
    };
}
