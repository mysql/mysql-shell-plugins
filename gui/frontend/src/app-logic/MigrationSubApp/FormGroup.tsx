/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

export interface ISelectOption { id: string, label: string };

export interface OciResource { id: string, cidrBlock?: string, displayName: string }

export type FormGroupValues = Record<string, string | undefined>;

export const watchFormChanges = async (
    prevProps: { formGroupValues: Readonly<FormGroupValues> },
    formGroupValues: FormGroupValues,
    watchers?: Watcher[],
) => {
    if (prevProps.formGroupValues === formGroupValues) {
        return;
    }

    const changes: WatcherChanges = { changedValues: {}, prevValues: {} };
    for (const key in formGroupValues) {
        const oldValue = prevProps.formGroupValues[key];
        const newValue = formGroupValues[key];
        if (newValue === oldValue) {
            continue;
        }
        changes.changedValues[key] = newValue;
        changes.prevValues[key] = oldValue;
    }

    if (Object.keys(changes.changedValues).length === 0) {
        return;
    }

    for (const { field, shouldTrigger, getUpdatedState } of watchers ?? []) {
        const value = formGroupValues[field];
        if (prevProps.formGroupValues[field] === value) {
            continue;
        }
        if (!shouldTrigger(value)) {
            // console.log("exiting", field, prevProps.formGroupValues[field], value);

            continue;
        }
        //        console.log("### working", field, prevProps.formGroupValues[field], "=>", value);

        await getUpdatedState(changes, value);
    }
};

export interface WatcherChanges {
    changedValues: FormGroupValues,
    prevValues: FormGroupValues,
}

export interface Watcher {
    field: string;
    shouldTrigger: (value?: string) => boolean;
    getUpdatedState: (changes?: WatcherChanges, newValue?: string) => Promise<void>;
}
