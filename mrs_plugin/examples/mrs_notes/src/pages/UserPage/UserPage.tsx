/* eslint-disable jsx-a11y/no-autofocus */
/*
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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

import { Component, ComponentChild } from "preact";
import InputForm from "../../components/InputForm";
import style from "../../components/InputForm.module.css";
import type { IMyServiceMrsNotesUser, MyService } from "../../myService.mrs.sdk/myService";

interface IUserPageProps {
    user?: IMyServiceMrsNotesUser;
    showPage: (page: string, forcedUpdate?: boolean) => void;
    showError: (error: unknown) => void;
    updateUser: (user: IMyServiceMrsNotesUser) => void;
    myService: MyService;
}

interface IUserPageState {
    success: boolean,
    error?: string,
    nickname?: string,
    email?: string,
}

/**
 * The User page Component that allows for the editing of the user information
 */
export default class UserPage extends Component<IUserPageProps, IUserPageState> {
    public constructor(props: IUserPageProps) {
        super(props);

        this.state = {
            success: false,
            nickname: props.user?.nickname,
            email: props.user?.email as string,
        };
    }

    /**
     * Updates the user
     */
    private readonly submitUserUpdate = async (): Promise<void> => {
        const { showError, updateUser, myService } = this.props;
        const { nickname, email } = this.state;

        try {
            // This is weird.
            const user = await myService.mrsNotes.user.findFirst();

            if (typeof user === "undefined" || (nickname === user.nickname && email === user.email)) {
                return;
            }

            // if a user instance exists, it contains an id, so we can safely cast
            await myService.mrsNotes.user.update({ where: { id: user.id as string }, data: { email, nickname } });

            // Update the app user
            user.nickname = nickname ?? "";
            user.email = email ?? "";
            updateUser(user);

            // Indicate that the user info has been updated
            this.setState({ success: true, error: undefined });
        } catch (e) {
            this.setState({
                success: false,
                error: (typeof e === "string") ? e : (e instanceof Error) ? e.message : "unknown",
            });
            showError(e);
        }
    };

    /**
     * The component's render function
     *
     * @param props The component's properties
     * @param state The component's state
     *
     * @returns The rendered ComponentChild
     */
    public render = (props: IUserPageProps, state: IUserPageState): ComponentChild => {
        const { showPage } = props;
        const { success, error, nickname, email } = state;

        const successContent = <>User updated successfully.</>;

        return (
            <InputForm headerIcon="userIcon"
                headerTitle="Edit User Settings"
                headerSubtitle="Please enter your user settings below."
                successContent={successContent}
                back={() => { showPage("notes"); }} submit={() => { void this.submitUserUpdate(); }}
                success={success} error={error}
            >
                <div className={style.formField}>
                    <p>Nickname</p>
                    <input id="nickname" type="text" value={nickname} autoFocus
                        onInput={(e) => { this.setState({ nickname: (e.target as HTMLInputElement).value }); }} />
                </div>
                <div className={style.formField}>
                    <p>Email</p>
                    <input id="email" type="text" value={email}
                        onInput={(e) => { this.setState({ email: (e.target as HTMLInputElement).value }); }} />
                </div>
            </InputForm>
        );
    };
}
