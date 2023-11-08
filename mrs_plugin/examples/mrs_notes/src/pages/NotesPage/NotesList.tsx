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
import Icon from "../../components/Icon";
import styles from "./NotesList.module.css";
import { IMyServiceMrsNotesNote, IMyServiceMrsNotesNotesAll } from "../../myService.mrs.sdk/myService";

interface INotesListProps {
    style?: {};
    notes: IMyServiceMrsNotesNotesAll[];
    activeNote?: IMyServiceMrsNotesNote;
    noteSearchText?: string;
    searchNotes: (noteSearchText: string) => void;
    setActiveNoteById: (noteId?: number, setFocus?: boolean) => Promise<void>;
}

/**
 * The NoteList Component displays the list of user notes with a search field on top
 */
export default class NoteList extends Component<INotesListProps> {
    public render = (props: INotesListProps): ComponentChild => {
        const { style, notes, activeNote, noteSearchText, searchNotes, setActiveNoteById } = props;

        return (
            <div className={styles.notesSidebar} style={style}>
                <div className={styles.notesListSearch}>
                    <Icon name="searchIcon" styleClass={styles.searchIconStyle} />
                    <div className={styles.notesListSearchField}>
                        <input onInput={(e) => { searchNotes((e.target as HTMLInputElement).value); }}
                            placeholder="Search" value={noteSearchText} />
                    </div>
                </div>
                <div className={styles.notesList}>
                    {notes?.map((note) => {
                        const noteStyle =
                            `${styles.notesListItem} ` +
                            // Only display active note if there isn't a style set
                            `${style === undefined && activeNote !== undefined && activeNote.id === note.id
                                ? styles.selected
                                : ""}`;
                        const noteDate = (new Date(note.lastUpdate as string)).toLocaleDateString(
                            undefined, { dateStyle: "short" });

                        return (
                            <div className={noteStyle}
                                key={note.id} onClick={() => { void setActiveNoteById(note.id, true); }}
                                onKeyPress={ () => { /** */ }} role="button" tabIndex={0}>
                                <div className={styles.notesListItemGutter}>
                                    {note.shared === true &&
                                        <Icon name="userIcon" styleClass={styles.userIconStyle} />
                                    }
                                </div>
                                <div className={styles.notesListItemContent}>
                                    <h3>{note.title}</h3>
                                    <div className={styles.notesListItemSummary}>
                                        <h4>{noteDate}</h4>
                                        <p>{note?.contentBeginning}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                    }
                </div>
            </div>
        );
    };
}
