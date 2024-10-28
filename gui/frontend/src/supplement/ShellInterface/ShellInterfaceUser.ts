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

import { MessageScheduler } from "../../communication/MessageScheduler.js";
import { Protocol } from "../../communication/Protocol.js";
import { IShellProfile, ShellAPIGui } from "../../communication/ProtocolGui.js";
import { webSession } from "../WebSession.js";

export class ShellInterfaceUser {

    /**
     * Authenticate a user.
     *
     * @param username The name of the user.
     * @param password The user's password.
     *
     * @returns A promise resolving to the user's active profile.
     */
    public async authenticate(username: string, password: string): Promise<IShellProfile | undefined> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: Protocol.UserAuthenticate,
            parameters: { username, password },
        }, false);

        webSession.userName = username;
        webSession.userId = response.activeProfile.userId;
        webSession.loadProfile(response.activeProfile);

        return response.activeProfile;
    }

    /**
     * Creates a new MySQL Shell/Workbench user account.
     *
     * @param username The name of the user.
     * @param password The user's password.
     * @param role The role that should be assigned to the user.
     * @param allowedHosts Allowed hosts that user can connect from.
     *
     * @returns A promise which resolves when the request was finished.
     */
    public async createUser(username: string, password: string, role?: string, allowedHosts?: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiUsersCreateUser,
            parameters: { args: { username, password, role, allowedHosts } },
        });
    }

    /**
     * Returns the default profile of the given user.
     *
     * @param userId The id of the user.
     *
     * @returns A promise which resolves with the profile data when the request was finished.
     */
    public async getDefaultProfile(userId: number): Promise<IShellProfile | undefined> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiUsersGetDefaultProfile,
            parameters: { args: { userId } },
        });

        if (!Array.isArray(response)) {
            return response.result;
        }
    }

    /**
     * Returns the default profile of the given user.
     *
     * @param userId The id of the user.
     * @param profileId The profile_id that should be come the new default.
     *
     * @returns A promise which resolves when the request was finished.
     */
    public async setDefaultProfile(userId: number, profileId: number): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiUsersSetDefaultProfile,
            parameters: { args: { userId, profileId } },
        });
    }

    /**
     * Returns the list of modules for the given user.
     *
     * @param userId The id of the user.
     *
     * @returns A promise resolving to the list of known modules.
     */
    public async getGuiModuleList(userId: number): Promise<string[]> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiUsersGetGuiModuleList,
            parameters: { args: { userId } },
        });

        if (!Array.isArray(response)) {
            return Promise.resolve(response.result);
        }

        return Promise.resolve([]);
    }

    /**
     * Returns the specified profile.
     *
     * @param profileId The id of the profile.
     *
     * @returns A promise resolving to the profile details.
     */
    public async getProfile(profileId: number): Promise<IShellProfile | undefined> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiUsersGetProfile,
            parameters: { args: { profileId } },
        });

        if (!Array.isArray(response)) {
            return Promise.resolve(response.result);
        }
    }

    /**
     * Adds a new user profile.
     *
     * @param profile The profile.
     *
     * @returns A promise resolving to the data of the just added profile.
     */
    public async addProfile(profile: IShellProfile): Promise<number | undefined> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiUsersAddProfile,
            parameters: { args: { userId: profile.userId, profile } },
        });

        return response.result;
    }

    /**
     * Updates the user profile.
     *
     * @param profile The profile to update.
     *
     * @returns A promise resolving to the updated profile data.
     */
    public async updateProfile(profile: IShellProfile): Promise<IShellProfile | undefined> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiUsersUpdateProfile,
            parameters: { args: { profile } },
        });

        if (!Array.isArray(response)) {
            return Promise.resolve(response.result);
        }
    }

    /**
     * Deletes a user profile.
     *
     * @param profile The profile to remove.
     *
     * @returns A promise which resolve when the request was finished.
     */
    public async deleteProfile(profile: IShellProfile): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiUsersDeleteProfile,
            parameters: { args: { userId: profile.userId, profileId: profile.id } },
        });
    }

    /**
     * Grant the given roles to the user.
     *
     * @param username The name of the user.
     * @param role The list of roles that should be assigned to the user. Use listRoles() to list all available roles.
     *
     * @returns A promise which resolve when the request was finished.
     */
    public async grantRole(username: string, role: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiUsersGrantRole,
            parameters: { args: { username, role } },
        });
    }

    /**
     * Returns the list of profile for the given user
     *
     * @param userId The id of the user.
     *
     * @returns A promise resolving to the list of profiles.
     */
    public async listProfiles(userId: number): Promise<Array<{ id: number; name: string; }>> {
        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiUsersListProfiles,
            parameters: { args: { userId } },
        });

        return response.result;
    }

    /**
     * Lists all privileges of a role.
     *
     * @param role The name of the role.
     *
     * @returns A promise which resolve when the request was finished.
     */
    public async listRolePrivileges(role: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiUsersListRolePrivileges,
            parameters: { args: { role } },
        });
    }

    /**
     * Lists all roles that can be assigned to users.
     *
     * @returns A promise which resolve when the request was finished.
     */
    public async listRoles(): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiUsersListRoles,
            parameters: {},
        });
    }

    /**
     * Lists all privileges assigned to a user.
     *
     * @param username The name of the user.
     *
     * @returns A promise which resolve when the request was finished.
     */
    public async listUserPrivileges(username: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiUsersListUserPrivileges,
            parameters: { args: { username } },
        });
    }

    /**
     * List the granted roles for a given user.
     *
     * @param username The name of the user.
     *
     * @returns A promise which resolve when the request was finished.
     */
    public async listUserRoles(username: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiUsersListUserRoles,
            parameters: { args: { username } },
        });
    }

    /**
     * Lists all user accounts.
     *
     * @returns A promise which resolve when the request was finished.
     */
    public async listUsers(): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiUsersListUsers,
            parameters: {},
        });
    }

    /**
     * Sets the profile of the user's current web session.
     *
     * @param profileId The id of the profile.
     *
     * @returns A promise which resolve when the request was finished.
     */
    public async setCurrentProfile(profileId: number): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiUsersSetCurrentProfile,
            parameters: { args: { profileId } },
        });
    }

    /**
     * set the password of a db_connection url
     *
     * @param url The URL needs to be in the following form user@(host[:port]|socket).
     * @param password The password
     *
     * @returns A promise which resolve when the request was finished.
     */
    public async storePassword(url: string, password: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbConnectionsSetCredential,
            parameters: { args: { url, password } },
        });
    }

    /**
     * deletes the password of a db_connection url
     *
     * @param url The URL needs to be in the following form user@(host[:port]|socket).
     *
     * @returns A promise which resolve when the request was finished.
     */
    public async clearPassword(url: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbConnectionsDeleteCredential,
            parameters: { args: { url } },
        });
    }

    /**
     * lists the db_connection urls that have a password stored
     *
     * @returns A promise which resolve when the request was finished.
     */
    public async listCredentials(): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbConnectionsListCredentials,
            parameters: {},
        });
    }
}
