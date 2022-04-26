/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

import { IShellInterface } from ".";
import {
    ProtocolGui, ICommAuthenticationEvent, currentConnection, ShellAPIGui, ICommShellProfile,
} from "../../communication";
import { ListenerEntry } from "../Dispatch";
import { webSession } from "../WebSession";

export class ShellInterfaceUser implements IShellInterface {

    public readonly id = "user";

    /**
     * Authenticate a user.
     *
     * @param username The name of the user.
     * @param password The user's password.
     *
     * @returns A listener for the response.
     */
    public authenticate(username: string, password: string): ListenerEntry {
        const request = ProtocolGui.getRequestUsersAuthenticate(username, password);

        const listener = currentConnection.sendRequest(request, { messageClass: "authenticate" });
        listener.then((event: ICommAuthenticationEvent) => {
            webSession.userName = username;
            if (event.data) {
                webSession.userId = event.data.activeProfile.userId;
                webSession.loadProfile(event.data.activeProfile);
            }
        }).catch(() => {
            //  no need to do anything...just catch the error
        });

        return listener;
    }

    /**
     * Creates a new MySQL Shell GUI user account.
     *
     * @param user The name of the user.
     * @param password The user's password.
     * @param role The role that should be assigned to the user.
     *
     * @returns A listener for the response.
     */
    public createUser(user: string, password: string, role: string): ListenerEntry {
        const request = ProtocolGui.getRequestUsersCreateUser(user, password, role);

        return currentConnection.sendRequest(request, { messageClass: "createUser" });
    }

    /**
     * Returns the default profile of the given user.
     *
     * @param userId The id of the user.
     *
     * @returns A listener for the response.
     */
    public getDefaultProfile(userId: number): ListenerEntry {
        const request = ProtocolGui.getRequestUsersGetDefaultProfile(userId);

        return currentConnection.sendRequest(request, { messageClass: "getDefaultProfile" });
    }

    /**
     * Returns the list of modules for the given user.
     *
     * @param userId The id of the user.
     *
     * @returns A listener for the response.
     */
    public getGuiModuleList(userId: number): ListenerEntry {
        const request = ProtocolGui.getRequestUsersGetGuiModuleList(userId);

        return currentConnection.sendRequest(request, { messageClass: "getGuiModuleList" });
    }

    /**
     * Returns the specified profile.
     *
     * @param profileId The id of the profile.
     *
     * @returns A listener for the response.
     */
    public getProfile(profileId: number): ListenerEntry {
        const request = ProtocolGui.getRequestUsersGetProfile(profileId);

        return currentConnection.sendRequest(request, { messageClass: ShellAPIGui.GuiUsersGetProfile });
    }

    /**
     * Updates the user profile.
     *
     * @param profile The profile to update.
     *
     * @returns A listener for the response.
     */
    public updateProfile(profile: ICommShellProfile): ListenerEntry {
        const request = ProtocolGui.getRequestUsersUpdateProfile(profile);

        return currentConnection.sendRequest(request, { messageClass: ShellAPIGui.GuiUsersUpdateProfile });
    }

    /**
     * Adds a new user profile.
     *
     * @param profile The profile.
     *
     * @returns A listener for the response.
     */
    public addProfile(profile: ICommShellProfile): ListenerEntry {
        const request = ProtocolGui.getRequestUsersAddProfile(profile.userId, profile);

        return currentConnection.sendRequest(request, { messageClass: ShellAPIGui.GuiUsersAddProfile });
    }

    /**
     * Grant the given roles to the user.
     *
     * @param username The name of the user.
     * @param role The list of roles that should be assigned to the user. Use listRoles() to list all available roles.
     *
     * @returns A listener for the response.
     */
    public grantRole(username: string, role: string): ListenerEntry {
        const request = ProtocolGui.getRequestUsersGrantRole(username, role);

        return currentConnection.sendRequest(request, { messageClass: "grantRole" });
    }

    /**
     * Returns the list of profile for the given user
     *
     * @param userId The id of the user.
     *
     * @returns A listener for the response.
     */
    public listProfiles(userId: number): ListenerEntry {
        const request = ProtocolGui.getRequestUsersListProfiles(userId);

        return currentConnection.sendRequest(request, { messageClass: "listProfiles" });
    }

    /**
     * Lists all privileges of a role.
     *
     * @param role The name of the role.
     *
     * @returns A listener for the response.
     */
    public listRolePrivileges(role: string): ListenerEntry {
        const request = ProtocolGui.getRequestUsersListRolePrivileges(role);

        return currentConnection.sendRequest(request, { messageClass: "listRoleProfiles" });
    }

    /**
     * Lists all roles that can be assigned to users.
     *
     * @returns A listener for the response.
     */
    public listRoles(): ListenerEntry {
        const request = ProtocolGui.getRequestUsersListRoles();

        return currentConnection.sendRequest(request, { messageClass: "listRoles" });
    }

    /**
     * Lists all privileges assigned to a user.
     *
     * @param username The name of the user.
     *
     * @returns A listener for the response.
     */
    public listUserPrivileges(username: string): ListenerEntry {
        const request = ProtocolGui.getRequestUsersListUserPrivileges(username);

        return currentConnection.sendRequest(request, { messageClass: "listUserPrivileges" });
    }

    /**
     * List the granted roles for a given user.
     *
     * @param username The name of the user.
     *
     * @returns A listener for the response.
     */
    public listUserRoles(username: string): ListenerEntry {
        const request = ProtocolGui.getRequestUsersListUserRoles(username);

        return currentConnection.sendRequest(request, { messageClass: "listUserRoles" });
    }

    /**
     * Lists all user accounts.
     *
     * @returns A listener for the response.
     */
    public listUsers(): ListenerEntry {
        const request = ProtocolGui.getRequestUsersListUsers();

        return currentConnection.sendRequest(request, { messageClass: "listUsers" });
    }

    /**
     * Returns the default profile of the given user.
     *
     * @param userId The id of the user.
     * @param profileId The profile_id that should be come the new default.
     *
     * @returns A listener for the response.
     */
    public setDefaultProfile(userId: number, profileId: number): ListenerEntry {
        const request = ProtocolGui.getRequestUsersSetDefaultProfile(userId, profileId);

        return currentConnection.sendRequest(request, { messageClass: "setDefaultProfile" });
    }

    /**
     * Sets the profile of the user's current web session.
     *
     * @param profileId The id of the profile.
     *
     * @returns A listener for the response.
     */
    public setCurrentProfile(profileId: number): ListenerEntry {
        const request = ProtocolGui.getRequestUsersSetCurrentProfile(profileId);

        return currentConnection.sendRequest(request, { messageClass: "setCurrentProfile" });
    }

    /**
     * set the password of a db_connection url
     *
     * @param url The URL needs to be in the following form user@(host[:port]|socket).
     * @param password The password
     *
     * @returns A listener for the response.
     */
    public storePassword(url: string, password: string): ListenerEntry {
        return currentConnection.sendRequest(ProtocolGui.getRequestDbconnectionsSetCredential(url, password),
            { messageClass: "storePassword" });
    }

    /**
     * deletes the password of a db_connection url
     *
     * @param url The URL needs to be in the following form user@(host[:port]|socket).
     *
     * @returns A listener for the response.
     */
    public clearPassword(url: string): ListenerEntry {
        return currentConnection.sendRequest(ProtocolGui.getRequestDbconnectionsDeleteCredential(url),
            { messageClass: "clearPassword" });
    }

    /**
     * lists the db_connection urls that have a password stored
     *
     * @returns A listener for the response.
     */
    public listCredentials(): ListenerEntry {
        return currentConnection.sendRequest(ProtocolGui.getRequestDbconnectionsListCredentials(),
            { messageClass: "clearPassword" });
    }

}
