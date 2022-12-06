/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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

import { Component, ComponentChild, createRef } from "preact";
import Icon from "../../components/Icon";
import AcceptShare from "./AcceptShare";
import NoteList from "./NotesList";
import Share from "./Share";
import styles from "./NotesPage.module.css";
import { IFetchInput } from "../../app";

export interface INote {
    contentBeginning: string,
    createDate: string,
    id: number,
    lastUpdate: string,
    lockedDown: number,
    ownNote: number,
    pinned: number,
    shared: number,
    tags?: object
    title: string,
    viewOnly: number,
    content: string,
}

interface INotesPageProps {
    doFetch: (input: string | IFetchInput, errorMsg?: string,
        method?: string, body?: object) => Promise<Response>,
    showPage: (page: string, forcedUpdate?: boolean) => void;
    showError: (error: unknown) => void,
}

interface INotesPageState {
    notes: INote[],
    noteSearchText?: string,
    activeNote?: INote,
    pendingInvitation: boolean,
}

/**
 * The Notes page Component with a NoteList on the left hand side and the active note content
 */
export default class Notes extends Component<INotesPageProps, INotesPageState> {
    private searchTimer: ReturnType<typeof setTimeout> | null;
    private noteContentChangeTimer: ReturnType<typeof setTimeout> | null;
    private checkPendingInvitationTimer: ReturnType<typeof setTimeout> | null;
    private readonly noteInputRef = createRef();
    private addingNote = false;
    private addingNoteTextBuffer: string | null;

    public constructor(props: INotesPageProps) {
        super(props);

        this.state = {
            notes: [],
            pendingInvitation: false,
        };

        this.searchTimer = null;
        this.noteContentChangeTimer = null;
        this.addingNote = false;
        this.addingNoteTextBuffer = null;

        void this.refreshNotes();

        this.checkPendingInvitationTimer = null;
        void this.checkPendingInvitation();
    }

    public readonly componentWillUnmount = (): void => {
        // Clear the timers before unmounting
        if (this.searchTimer !== null) {
            clearTimeout(this.searchTimer);
            this.searchTimer = null;
        }

        if (this.noteContentChangeTimer !== null) {
            clearTimeout(this.noteContentChangeTimer);
            this.noteContentChangeTimer = null;
        }

        if (this.checkPendingInvitationTimer !== null) {
            clearTimeout(this.checkPendingInvitationTimer);
            this.checkPendingInvitationTimer = null;
        }
    };

    /**
     * Refreshes and updates the notes state
     *
     * The notes fetched exclude the content column since it can contain a lot of data. The full note data is
     * fetched separately when the activeNote changes
     *
     * @param activeNoteId The id of the note that should be selected after the refresh
     */
    public refreshNotes = async (activeNoteId?: number): Promise<void> => {
        const { doFetch, showError } = this.props;
        const { notes, activeNote, noteSearchText } = this.state;

        // Build the query string based on the given searchText
        const q = (noteSearchText !== undefined) ? `&q={"title":{"$like":"${noteSearchText}%"}}` : "";

        try {
            const newNotes: INote[] = [];
            let hasMore = true;
            let offset = 0;

            // If an activeNoteId was given and there was non before, set it right away to prevent flickering
            // when loading the notes list
            if (activeNoteId !== undefined && activeNote === undefined) {
                await this.setActiveNoteById(activeNoteId);
            }

            // Fetch pages of 10 notes until all notes have been fetched
            while (hasMore) {
                // Await the fetch call and get back the response object
                const response = await doFetch({
                    input: `/mrsNotes/notesAll?f=!content&offset=${offset}&limit=10${q}`,
                    errorMsg: "Failed to fetch notes.",
                });

                // Await the JSON parsing of the response body
                const responseBody = await response.json();

                // Add items to the newNotes list
                newNotes.push(...responseBody?.items as INote[]);
                hasMore = responseBody?.hasMore;

                // Set a new state of the newNotes to trigger a re-render
                this.setState({ notes: newNotes });

                offset += 10;
            }

            // If a new activeNodeId was given or there was an active note, select that note again
            const noteId = (activeNoteId !== undefined) ? activeNoteId : activeNote?.id;
            const newIndex = (noteId !== undefined) ? newNotes.findIndex((note) => { return note.id === noteId; }) : -1;
            let newActiveNote = newIndex > -1 ? newNotes[newIndex] : null;

            // If it was not found, select the next note in the list as new activeNote. Otherwise select the
            // first list entry.
            if (newActiveNote === null && newNotes.length > 0) {
                const oldIndex = (noteId !== undefined)
                    ? notes.findIndex((note) => { return note.id === noteId; })
                    : -1;

                if (oldIndex > -1) {
                    if (newNotes.length > oldIndex) {
                        newActiveNote = newNotes[oldIndex];
                    } else {
                        newActiveNote = newNotes[newNotes.length - 1];
                    }
                } else {
                    newActiveNote = newNotes[0];
                }
            }

            // If the activeNote has not already been set above, set it now
            if (!(activeNoteId !== undefined && activeNote === undefined)) {
                void this.setActiveNoteById(newActiveNote?.id);
            }
        } catch (e) {
            showError(e as Error);
        }
    };

    /**
     * Adds a new note
     *
     * @param content The content of the new note
     * @param selectText If the full text of the note should be selected so it can be easily overwritten
     */
    private readonly addNote = async (content = "New Note", selectText = true): Promise<void> => {
        const { doFetch, showError } = this.props;

        this.addingNote = true;

        try {
            const newNote: INote = await (await doFetch({
                input: `/mrsNotes/note`,
                errorMsg: "Failed to added a new note.",
                method: "POST",
                body: {
                    title: content.split("\n")[0],
                    content,
                    pinned: 0,
                    lockedDown: 0,
                },
            })).json();

            // Refresh the notes and set the new note as new active note
            await this.refreshNotes(newNote?.id);

            // Select all the text so the user can overwrite the default text easily
            if (selectText) {
                this.setTextAreaFocus(true);
            }
        } catch (e) {
            showError(e as Error);
        } finally {
            this.addingNote = false;
        }
    };

    /**
     * Deletes a note
     *
     * @param note The note to delete
     */
    private readonly deleteNote = async (note: INote): Promise<void> => {
        const { doFetch } = this.props;

        await doFetch({
            input: `/mrsNotes/noteDelete`,
            errorMsg: "Failed to delete the note.",
            method: "PUT",
            body: { noteId: note.id },
        });
    };

    /**
     * Updates a note
     *
     * @param note The note to update
     */
    private readonly updateNote = async (note: INote): Promise<void> => {
        const { doFetch } = this.props;

        // ToDo: Check if update was successfully
        await doFetch({
            input: `/mrsNotes/noteUpdate`,
            errorMsg: "Failed to update the note.",
            method: "PUT",
            body: {
                noteId: note.id,
                title: note.title,
                pinned: note.pinned,
                lockedDown: note.lockedDown,
                content: note.content,
                tags: note.tags,
            },
        });
    };

    /**
     * Sets a given note as active note
     *
     * @param noteId The id of the note to set as active note
     * @param setFocus If true, the focus will be set to the notes text
     */
    private readonly setActiveNoteById = async (noteId?: number, setFocus?: boolean): Promise<void> => {
        const { activeNote } = this.state;
        const { doFetch, showError } = this.props;

        if (noteId !== undefined) {
            try {
                // Before changing to a new active note store changes to the current one first
                if (activeNote !== undefined && this.noteContentChangeTimer !== null) {
                    clearTimeout(this.noteContentChangeTimer);
                    this.noteContentChangeTimer = null;

                    await this.updateNote(activeNote);
                }

                // Try to get the note with the given noteId
                const notes = await (await doFetch({
                    input: `/mrsNotes/notesAll?q={"id": {"$eq": ${noteId}}}`,
                    errorMsg: "Failed to fetch the note.",
                })).json();

                // If the note was found, set it as new note
                this.setState({ activeNote: (notes.items.length > 0) ? notes.items[0] : null },
                    () => {
                        // After the activeNote was set, set focus
                        if (setFocus !== undefined) {
                            this.setTextAreaFocus();
                        }

                        // If there was text entered while the activeNote was being set, update the textArea with
                        // that text
                        if (this.addingNoteTextBuffer !== null) {
                            this.noteInputRef.current.value = this.addingNoteTextBuffer;
                            this.addingNoteTextBuffer = null;

                            // ToDo: Trigger refresh timer
                        }
                    });
            } catch (e) {
                showError(e as Error);
            }
        } else {
            // If no noteId parameter is given, clear the activeNote
            this.setState({ activeNote: undefined });
        }
    };

    /**
     * Sets to focus to the note text
     *
     * @param selectAll If set to true, the whole note text is selected
     */
    private readonly setTextAreaFocus = (selectAll = false): void => {
        (this.noteInputRef.current as HTMLInputElement).focus();

        if (selectAll) {
            (this.noteInputRef.current as HTMLInputElement).select();
        }
    };

    /**
     * Filters the note list
     *
     * @param noteSearchText Note text to search
     */
    private readonly searchNotes = (noteSearchText: string): void => {
        // If timer is currently running, rest it so we can restart it again
        if (this.searchTimer !== null) {
            clearTimeout(this.searchTimer);
        }

        // Update the state of noteSearchText right away
        this.setState({ noteSearchText }, () => {
            // Start a 500ms timer to allow users to type a longer string and not to trigger a fetch for every
            // single key press
            this.searchTimer = setTimeout(() => {
                this.searchTimer = null;
                void this.refreshNotes();
            }, 500);
        });
    };

    /**
     * Deletes the active note
     */
    private readonly deleteActiveNote = async (): Promise<void> => {
        const { activeNote } = this.state;
        const { showError } = this.props;

        try {
            if (activeNote !== undefined) {
                await this.deleteNote(activeNote);
            }

            void this.refreshNotes();
        } catch (e) {
            showError(e);
        }
    };

    /**
     * Handles note text changes of the active note
     *
     * @param content The new content of the active note
     */
    private readonly onActiveNoteContentInput = (content: string): void => {
        const { notes, activeNote } = this.state;
        const { showError } = this.props;

        // If timer is currently running, rest it so we can restart it again
        if (this.noteContentChangeTimer !== null) {
            clearTimeout(this.noteContentChangeTimer);
        }

        // If there is an activeNote, update that note
        if (activeNote !== undefined) {
            // Set the title as the first line from the note
            activeNote.title = content.split("\n")[0];
            activeNote.content = content;

            // Update notes list immediately
            const noteInList = notes.find((note) => { return activeNote.id === note.id; });
            if (noteInList !== undefined) {
                noteInList.title = activeNote.title;
                noteInList.contentBeginning = activeNote.content.substring(
                    activeNote.title.length + 1, 45).replace(/[^a-zA-Z\d]/gm, " ").replace(/\s+/gm, " ");
                this.setState({ notes });
            }

            // Delay the database update for 500ms in case the user continues typing. This helps to reduce
            // traffic and database load since we do not update the database for every single keypress.
            this.noteContentChangeTimer = setTimeout(() => {
                this.noteContentChangeTimer = null;
                try {
                    void this.updateNote(activeNote);
                } catch (e) {
                    showError(e as Error);
                }
            }, 500);
        } else if (!this.addingNote) {
            // If there is no activeNote yet, create a note
            this.noteContentChangeTimer = setTimeout(() => {
                this.noteContentChangeTimer = null;

                try {
                    void this.addNote(content, false);
                } catch (e) {
                    showError(e as Error);
                }
            }, 500);
        } else {
            this.addingNoteTextBuffer = content;
        }
    };

    /**
     * Checks if a new shared note is available for the user every 10 seconds
     */
    private readonly checkPendingInvitation = async (): Promise<void> => {
        const { doFetch, showError } = this.props;

        try {
            // cSpell:ignore notnull
            const pendingNotes = await (await doFetch({
                input: `/mrsNotes/userHasNote?q={"invitationKey":{"$notnull":null},` +
                    `"invitationAccepted":{"$eq": 0}}`,
                errorMsg: "Failed to  query invitations.",
            })).json();

            this.setState({ pendingInvitation: pendingNotes?.items?.length > 0 });
        } catch (e) {
            showError(e as Error);
        }

        // Start a 10s timer to check if new invitations have been created
        this.checkPendingInvitationTimer = setTimeout(() => {
            void this.checkPendingInvitation();
        }, 10000);
    };

    /**
     * The component's render function
     *
     * @param props The component's properties
     * @param state The component's state
     *
     * @returns The rendered ComponentChild
     */
    public render = (props: INotesPageProps, state: INotesPageState): ComponentChild => {
        const { doFetch, showError, showPage } = props;
        const { notes, activeNote, noteSearchText, pendingInvitation } = state;
        // Only display the deleteIcon if there is an activeNote
        const deleteIcon = activeNote !== undefined &&
            <Icon name="deleteIcon" styleClass={styles.deleteIconStyle}
                onClick={() => { void this.deleteActiveNote(); }} />;
        const acceptShareIcon = pendingInvitation &&
            <Icon name="pendingInvitationIcon" styleClass={styles.pendingInvitationIconStyle}
                onClick={() => { showPage("notesAcceptShare"); }} />;
        const page = window.location.hash;

        return (
            <>
                {page === "#notes" &&
                    <div className={styles.notes}>
                        <NoteList notes={notes} activeNote={activeNote}
                            noteSearchText={noteSearchText} searchNotes={this.searchNotes}
                            setActiveNoteById={this.setActiveNoteById} />
                        <div className={styles.splitter}></div>
                        <div className={styles.note}>
                            <div className={styles.toolbar}>
                                {deleteIcon}
                                <div className={styles.spacer}></div>
                                {acceptShareIcon}
                                <Icon name="shareIcon" styleClass={styles.shareIconStyle}
                                    onClick={() => { showPage("notesShare"); }} />
                                <Icon name="addIcon" styleClass={styles.addIconStyle}
                                    onClick={() => { void this.addNote(); }} />
                            </div>
                            <div className={styles.noteContent}>
                                <div className={styles.noteDate} onClick={() => { this.setTextAreaFocus(); }}>
                                    {activeNote !== undefined
                                        ? (new Date(activeNote.lastUpdate)).toLocaleString(
                                            undefined, { dateStyle: "long", timeStyle: "short" })
                                        : ""}</div>
                                <textarea ref={this.noteInputRef}
                                    value={activeNote !== undefined ? activeNote.content : ""}
                                    onInput={(e) => {
                                        void this.onActiveNoteContentInput((e.target as HTMLInputElement).value);
                                    }} />
                            </div>
                        </div>
                    </div>
                }
                {page === "#notesShare" &&
                    <Share doFetch={doFetch} showError={showError} activeNote={activeNote}
                        showPage={async (page: string) => { await this.refreshNotes(); showPage(page); }} />
                }
                {page === "#notesAcceptShare" &&
                    <AcceptShare doFetch={doFetch} showError={showError}
                        showPage={async (page: string) => { await this.refreshNotes(); showPage(page); }} />
                }
            </>);
    };
}
