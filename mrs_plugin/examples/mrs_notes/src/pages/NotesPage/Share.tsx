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
import type { IMyServiceMrsNotesNote, MyService } from "../../myService.mrs.sdk/myService";

interface IShareProps {
    showPage: (page: string) => Promise<void>;
    showError: (error: unknown) => void;
    activeNote?: IMyServiceMrsNotesNote;
    myService: MyService;
}

interface IShareState {
    email: string,
    viewOnly: boolean,
    canShare: boolean,
    success: boolean,
    error?: string,
    invitationKey?: string,
}

/**
 * The Share page Component that allows to share a note with others
 */
export default class Share extends Component<IShareProps, IShareState> {
    public constructor(props: IShareProps) {
        super(props);

        this.state = {
            success: false,
            email: "",
            viewOnly: false,
            canShare: false,
        };
    }

    private readonly shareNote = async (): Promise<void> => {
        const { activeNote, myService } = this.props;
        const { email, viewOnly, canShare } = this.state;

        try {
            // Share the note with the given user
            if (email !== "") {
                const response = await myService.mrsNotes.noteShare.call(
                    { noteId: activeNote?.id, email, viewOnly, canShare });

                if (response.items?.length > 0) {
                    // Indicate that the note has been shared
                    this.setState({
                        success: true,
                        // This is weird. Do we really need the extra response wrapper?
                        invitationKey: response.items[0].items[0].invitationKey as string,
                        error: undefined,
                    });
                }
            }
        } catch (e) {
            this.setState({ success: false, invitationKey: undefined, error: String(e) });
        }
    };

    public render = (
        { showPage }: IShareProps,
        { success, error, email, viewOnly, canShare, invitationKey }: IShareState): ComponentChild => {
        const appUrl = window.location.href.replace(window.location.hash, "")
            .replace(window.location.search, "");
        const invitationLink = `mailto:${email}?subject=` +
            encodeURI("Invitation to Work on Shared Note") + "&body=" +
            encodeURI("Dear User,\n\nYou have been invited to work on a shared note.\n\n" +
                `Please go to:\n    ${appUrl}?invitationKey=${invitationKey ?? "?"}#notes\n` +
                `to accept the invitation.\n\nYour invitation key is:\n    ${invitationKey ?? "?"}\n\nThanks.`);
        const successContent = (<>
            The user has been invited to share the key successfully.<br /><br />
            Please share the following invitation key with the user:<br />
            {invitationKey}<br />
            <a href={invitationLink}>Send Email</a>
        </>);

        return (
            <InputForm headerIcon="shareIcon" headerTitle="Share Note"
                headerSubtitle="Please enter the email of the user you want to share the note with."
                successContent={successContent} back={() => { void showPage("notes"); }}
                submit={() => { void this.shareNote(); }}
                success={success} error={error}
            >
                <div className={style.formField}>
                    <p>Email</p>
                    <input id="email" type="text" value={email} autoFocus
                        onInput={(e) => { this.setState({ email: (e.target as HTMLInputElement).value }); }} />
                </div>
                <div className={style.formField}>
                    <div className={style.formCheckbox}>
                        <input id="viewOnly" type="checkbox" value="1" defaultChecked={viewOnly}
                            onInput={(e) => {
                                this.setState({ viewOnly: (e.target as HTMLInputElement).value === "1" });
                            }} />
                        <label htmlFor="viewOnly">Prevent the user from editing the note</label>
                    </div>
                    <div className={style.formCheckbox}>
                        <input id="canShare" type="checkbox" value="1" defaultChecked={canShare}
                            onInput={(e) => {
                                this.setState({ canShare: (e.target as HTMLInputElement).value === "1" });
                            }} />
                        <label htmlFor="canShare">Allow the user to share the note with other users</label>
                    </div>
                </div>
            </InputForm>
        );
    };
}
