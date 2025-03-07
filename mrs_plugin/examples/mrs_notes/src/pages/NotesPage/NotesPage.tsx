/*
 * Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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

import { Component, ComponentChild, createRef } from "preact";
import Icon from "../../components/Icon";
import AcceptShare from "./AcceptShare";
import NoteList from "./NotesList";
import Share from "./Share";
import styles from "./NotesPage.module.css";
import type { IMyServiceMrsNotesNotesAll, MyService } from "../../myService.mrs.sdk/myService";

interface INotesPageProps {
    showPage: (page: string, forcedUpdate?: boolean) => void;
    showError: (error: unknown) => void;
    myService: MyService;
}

interface INotesPageState {
    notes: IMyServiceMrsNotesNotesAll[];
    noteSearchText?: string;
    activeNote?: IMyServiceMrsNotesNotesAll;
    pendingInvitation: boolean;
    infoMessage?: string;
    forceNoteListDisplay?: boolean;
}

/**
 * The Notes page Component with a NoteList on the left hand side and the active note content
 */
export default class Notes extends Component<INotesPageProps, INotesPageState> {
    private searchTimer: ReturnType<typeof setTimeout> | null = null;
    private noteContentChangeTimer: ReturnType<typeof setTimeout> | null = null;
    private checkPendingInvitationTimer: ReturnType<typeof setTimeout> | null = null;
    private infoMessageResetTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly noteInputRef = createRef();
    private addingNote = false;
    private addingNoteTextBuffer: string | null = null;

    public constructor(props: INotesPageProps) {
        super(props);

        this.state = {
            notes: [],
            pendingInvitation: false,
            forceNoteListDisplay: window.innerWidth < 600 ? true : undefined,
        };

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

        if (this.infoMessageResetTimer !== null) {
            clearTimeout(this.infoMessageResetTimer);
            this.infoMessageResetTimer = null;
        }
    };


    /**
     * Refreshes and updates the notes state
     *
     * The notes fetched exclude the content column since it can contain a lot of data. The full note data is
     * fetched separately when the activeNote changes
     *
     * @param activeNoteId The id of the note that should be selected after the refresh
     * @param selectText If true, the full note text is selected
     */
    public refreshNotes = async (activeNoteId?: number, selectText?: boolean): Promise<void> => {
        const { showError, myService } = this.props;
        const { notes, activeNote, noteSearchText } = this.state;

        try {
            const newNotes: IMyServiceMrsNotesNotesAll[] = [];

            // If an activeNoteId was given and there was non before, set it right away to prevent flickering
            // when loading the notes list
            if (activeNoteId !== undefined && activeNote === undefined) {
                await this.setActiveNoteById(activeNoteId);
            }

            const take = 5;
            let iterator = 0;
            let sliceOfNotes;

            const options = {
                take,
                skip: 0,
                select: {
                    content: false,
                },
                where: {
                    title: {
                        $like: `${noteSearchText ?? ""}%`,
                    },
                },
            };

            while ((sliceOfNotes = await myService.mrsNotes.notesAll.findMany(options)).length) {
                newNotes.push(...sliceOfNotes);
                // Set a new state of the newNotes to trigger a re-render
                this.setState({ notes: newNotes });
                iterator += 1;
                options.skip = iterator * take;
            }

            if (newNotes.length === 0) {
                this.setState({ forceNoteListDisplay: undefined });
            } else {
                // If a new activeNodeId was given or there was an active note, select that note again
                const noteId = (activeNoteId !== undefined) ? activeNoteId : activeNote?.id;
                const newIndex = (noteId !== undefined)
                    ? newNotes.findIndex((note) => { return note.id === noteId; })
                    : -1;
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
                    void this.setActiveNoteById(newActiveNote?.id, selectText, selectText);
                } else if (activeNoteId !== undefined) {
                    this.setTextAreaFocus(selectText);
                }
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
        const { showError, myService } = this.props;

        this.addingNote = true;
        this.setInfoMessage("Adding note...");

        try {
            const newNote = await myService.mrsNotes.note.create({
                data: { title: content.split("\n")[0], content, pinned: false, lockedDown: false },
            });

            this.setInfoMessage("Note added.");

            // Refresh the notes and set the new note as new active note and select all the text
            // of the active note so the user can overwrite the default text easily
            await this.refreshNotes(newNote?.id, selectText);
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
    private readonly deleteNote = async (note: IMyServiceMrsNotesNotesAll): Promise<void> => {
        const { myService } = this.props;

        this.setInfoMessage("Deleting note...");

        await myService.mrsNotes.note.delete({ where: { id: note.id } });

        this.setInfoMessage("Note deleted.");
    };

    /**
     * Updates a note
     *
     * @param note The note to update
     */
    private readonly updateNote = async (note: IMyServiceMrsNotesNotesAll): Promise<void> => {
        const { myService } = this.props;

        this.setInfoMessage("Updating note...");

        await myService.mrsNotes.noteUpdate.call({
            noteId: note.id,
            title: note.title,
            pinned: note.pinned,
            lockedDown: note.lockedDown,
            content: note.content as string,
            tags: note.tags,
        });

        this.setInfoMessage("Note updated.");
    };

    /**
     * Sets a given note as active note
     *
     * @param noteId The id of the note to set as active note
     * @param setFocus If true, the focus will be set to the notes text
     * @param selectText If true, the full note text is selected
     */
    private readonly setActiveNoteById = async (noteId?: number, setFocus?: boolean,
        selectText?: boolean): Promise<void> => {
        const { activeNote, forceNoteListDisplay } = this.state;
        const { showError, myService } = this.props;

        if (noteId !== undefined) {
            try {
                // Before changing to a new active note store changes to the current one first
                if (activeNote !== undefined && this.noteContentChangeTimer !== null) {
                    clearTimeout(this.noteContentChangeTimer);
                    this.noteContentChangeTimer = null;

                    await this.updateNote(activeNote);
                }

                const note = await myService.mrsNotes.notesAll.findFirst({ where: { id: noteId } });

                // If the note was found, set it as new note
                this.setState({
                    activeNote: note,
                    forceNoteListDisplay: (setFocus !== undefined && setFocus) ? undefined : forceNoteListDisplay,
                }, () => {
                    // If there was text entered while the activeNote was being set, update the textArea with
                    // that text
                    if (this.addingNoteTextBuffer !== null && this.state.activeNote !== undefined) {
                        this.onActiveNoteContentInput(this.addingNoteTextBuffer);
                        this.addingNoteTextBuffer = null;
                    }

                    // After the activeNote was set, set focus and if requested, select all text
                    if (setFocus !== undefined) {
                        this.setTextAreaFocus(selectText);
                    }
                });
            } catch (e) {
                showError(e);
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
    private readonly setTextAreaFocus = (selectAll?: boolean): void => {
        (this.noteInputRef.current as HTMLInputElement).focus();

        if (selectAll !== undefined && selectAll) {
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
                if (window.confirm(`Are you sure you want to delete the note "${activeNote.title ?? ""}"?`)) {
                    await this.deleteNote(activeNote);

                    this.setState({ activeNote: undefined });
                }
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
        const { showError, myService } = this.props;

        try {
            const pendingInvitation = await myService.mrsNotes.userHasNote.findFirst({
                where: {
                    invitationAccepted: false,
                    invitationKey: { not: null },
                },
            });

            this.setState({ pendingInvitation: typeof pendingInvitation === "undefined" ? false : true });
        } catch (e) {
            showError(e as Error);
        }

        // Start a 10s timer to check if new invitations have been created
        this.checkPendingInvitationTimer = setTimeout(() => {
            void this.checkPendingInvitation();
        }, 10000);
    };

    /**
     * Triggers the display of an information message
     *
     * @param infoMessage The message to display
     */
    private readonly setInfoMessage = (infoMessage: string): void => {
        if (this.infoMessageResetTimer !== null) {
            clearTimeout(this.infoMessageResetTimer);
        }

        this.setState({ infoMessage });

        // Start a 5s timer to reset the infoMessage
        this.infoMessageResetTimer = setTimeout(() => {
            this.infoMessageResetTimer = null;

            this.setState({ infoMessage: undefined });
        }, 5000);
    };

    private readonly forceNoteListDisplay = (): void => {
        this.setState({ forceNoteListDisplay: true });
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
        const { showError, showPage, myService } = props;
        const { notes, activeNote, noteSearchText, pendingInvitation, infoMessage, forceNoteListDisplay } = state;
        const page = window.location.hash;

        return (
            <>
                {page === "#notes" &&
                    <div className={styles.notes}>
                        <NoteList notes={notes} activeNote={activeNote}
                            noteSearchText={noteSearchText} searchNotes={this.searchNotes}
                            setActiveNoteById={this.setActiveNoteById}
                            style={forceNoteListDisplay !== undefined
                                // eslint-disable-next-line @typescript-eslint/naming-convention
                                ? { "--force-display": "flex", "--force-100p": "100%" }
                                : undefined} />
                        <div className={styles.splitter}></div>
                        <div className={styles.note} style={forceNoteListDisplay !== undefined
                            // eslint-disable-next-line @typescript-eslint/naming-convention
                            ? { "--force-display": "none" }
                            : {}}>
                            <div className={styles.toolbar}>
                                {notes.length > 0 &&
                                    <Icon name="backIcon" styleClass={styles.backIconStyle}
                                        onClick={() => { void this.forceNoteListDisplay(); }} />
                                }
                                {activeNote !== undefined &&
                                    <Icon name="deleteIcon" styleClass={styles.deleteIconStyle}
                                        onClick={() => { void this.deleteActiveNote(); }} />}
                                <div className={styles.spacer}></div>
                                {infoMessage !== undefined &&
                                    <div className={styles.info}>{infoMessage}</div>
                                }
                                {pendingInvitation &&
                                    <Icon name="pendingInvitationIcon" styleClass={styles.pendingInvitationIconStyle}
                                        onClick={() => { showPage("notesAcceptShare"); }} />}
                                <Icon name="shareIcon" styleClass={styles.shareIconStyle}
                                    onClick={() => { showPage("notesShare"); }} />
                                <Icon name="addIcon" styleClass={styles.addIconStyle}
                                    onClick={() => { void this.addNote(undefined, true); }} />
                            </div>
                            <div className={styles.noteContent}>
                                <div className={styles.noteDate}
                                    onClick={() => { this.setTextAreaFocus(); }}
                                    onKeyPress={() => {/** */ }} role="button" tabIndex={0}>
                                    {activeNote !== undefined
                                        ? (new Date(String(activeNote.lastUpdate))).toLocaleString(
                                            undefined, { dateStyle: "long", timeStyle: "short" })
                                        : ""}</div>
                                <textarea ref={this.noteInputRef}
                                    value={activeNote !== undefined
                                        ? String(activeNote.content)
                                        : (this.addingNote ? undefined : "")}
                                    onInput={(e) => {
                                        void this.onActiveNoteContentInput((e.target as HTMLInputElement).value);
                                    }} />
                            </div>
                        </div>
                    </div>
                }
                {page === "#notesShare" &&
                    <Share showError={showError} activeNote={activeNote}
                        showPage={async (page: string) => {
                            await this.refreshNotes(); showPage(page);
                        }}
                        myService={myService} />
                }
                {page === "#notesAcceptShare" &&
                    <AcceptShare showError={showError}
                        showPage={async (page: string) => {
                            await this.refreshNotes(); showPage(page);
                        }}
                        myService={myService} />
                }
            </>);
    };
}
