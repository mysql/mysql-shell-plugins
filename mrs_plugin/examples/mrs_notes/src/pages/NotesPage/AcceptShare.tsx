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
import type { MyService } from "../../myService.mrs.sdk/myService";

interface IAcceptShareProps {
    showPage: (page: string) => Promise<void>;
    showError: (error: unknown) => void;
    myService: MyService;
}

interface IAcceptShareState {
    success: boolean,
    error?: string,
    invitationKey?: string,
}

/**
 * The AcceptShare page Component that allows to accept a shared note
 */
export default class AcceptShare extends Component<IAcceptShareProps, IAcceptShareState> {
    public constructor(props: IAcceptShareProps) {
        super(props);

        this.state = {
            success: false,
        };
    }

    /**
     * Accepts a shared note
     */
    private readonly acceptSharedNote = async (): Promise<void> => {
        const { myService } = this.props;
        const { invitationKey } = this.state;

        try {
            // Share the note with the given user
            if (invitationKey !== undefined) {
                await myService.mrsNotes.noteAcceptShare.call({ invitationKey });

                // Indicate that the note has been shared
                this.setState({ success: true, error: undefined });
            }
        } catch (e) {
            this.setState({ success: false, error: String(e) });
        }
    };

    /**
     * The component"s render function
     *
     * @param props The component's properties
     * @param state The component's state
     *
     * @returns ComponentChild
     */
    public render = (props: IAcceptShareProps, state: IAcceptShareState): ComponentChild => {
        const { showPage } = props;
        const { invitationKey, success, error } = state;
        const successContent = <>The note has been accepted.</>;

        return (
            <InputForm headerIcon="pendingInvitationIcon" headerTitle="Accept Shared Note"
                headerSubtitle="Please enter the invitation key."
                successContent={successContent}
                back={() => { void showPage("notes"); }} submit={() => { void this.acceptSharedNote(); }}
                success={success} error={error}
            >
                <div className={style.formField}>
                    <p>Invitation Key</p>
                    <input id="invitationKey" type="text" value={invitationKey} autoFocus
                        onInput={(e) => { this.setState({ invitationKey: (e.target as HTMLInputElement).value }); }} />
                </div>
            </InputForm>
        );
    };
}
