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

/* eslint-disable @typescript-eslint/unbound-method */

import { act, render } from "@testing-library/preact";
import { createRef, type RefObject } from "preact";
import {
    afterEach, afterAll, beforeEach, describe, expect, it, vi, type MockInstance, type MockedFunction
} from "vitest";

import { ProfileSelector } from "../../../app-logic/ProfileSelector.js";
import { Button } from "../../../components/ui/Button/Button.js";

import type { IShellProfile } from "../../../communication/ProtocolGui.js";
import type { ConfirmDialog } from "../../../components/Dialogs/ConfirmDialog.js";
import type {
    IDialogValidations, IDialogValues, ValueEditDialog
} from "../../../components/Dialogs/ValueEditDialog.js";
import { IMenuItemProperties } from "../../../components/ui/Menu/MenuItem.js";
import { ShellInterface } from "../../../supplement/ShellInterface/ShellInterface.js";
import { webSession } from "../../../supplement/WebSession.js";
import { mockClassMethods, nextProcessTick, nextRunLoop, setupShellForTests } from "../test-helpers.js";
import { ShellInterfaceUser } from "../../../supplement/ShellInterface/ShellInterfaceUser.js";

let clicked = false;
const buttonClick = (): void => {
    clicked = true;
};

mockClassMethods(ShellInterfaceUser, {
    updateProfile: vi.fn().mockReturnValue(
        Promise.resolve({ id: 1, userId: 1, name: "Updated Profile", description: "", options: {} })
    ),
    setDefaultProfile: vi.fn().mockReturnValue(Promise.resolve()),
});

// @ts-expect-error, we are extending a class for testing purposes.
class TestProfileSelector extends ProfileSelector {
    declare public defaultProfile?: IShellProfile;
    declare public activeProfiles: IShellProfile[];
    declare public profileDialogRef: RefObject<ValueEditDialog>;
    declare public confirmDialogRef: RefObject<ConfirmDialog>;

    declare public deleteList: IShellProfile[];

    declare public handleProfileAction: (action: string, profileId: string) => void;
    declare public profileLoaded: () => Promise<boolean>;
    declare public getProfileList: (userId: number) => Promise<void>;
    declare public validateProfileValues: (closing: boolean, values: IDialogValues,
        payload: unknown) => Promise<IDialogValidations>;
    declare public updateProfile: (profileToEdit: IShellProfile, setDefault: boolean) => Promise<void>;

    declare public handleMenuItemClick: (props: IMenuItemProperties) => boolean;
    declare public addProfile: () => void;
    declare public editProfile: () => void;
    declare public deleteProfile: () => void;
    declare public generatePopupMenuEntries: () => void;
    declare public sendUpdateProfileInfoMsg: () => void;
    declare public deleteProfileConfirm: () => void;
}

describe("ProfileSelector test", () => {

    beforeEach(() => {
        clicked = false;
    });

    afterAll(() => {
        vi.restoreAllMocks();
    });

    it("Render Profile Selector and check properties", async () => {
        const actionMenuRef = createRef<TestProfileSelector>();
        const innerRef = createRef<HTMLDivElement>();
        const { unmount } = render(
            <div>
                <Button innerRef={innerRef} onClick={buttonClick}>
                    Open Profile Selector
                </Button>
                <TestProfileSelector ref={actionMenuRef}></TestProfileSelector>
            </div>,
        );

        expect(actionMenuRef.current).not.toEqual(document.activeElement);

        expect(clicked).toEqual(false);
        await act(() => {
            buttonClick();
            actionMenuRef.current?.open(innerRef.current!.getBoundingClientRect());
        });
        expect(clicked).toEqual(true);

        unmount();
    });

    it("Standard Rendering (snapshot)", async () => {
        const actionMenuRef = createRef<ProfileSelector>();
        const innerRef = createRef<HTMLDivElement>();
        const { container, unmount } = render(
            <div>
                <Button onClick={buttonClick} innerRef={innerRef}>
                    Open Profile Selector
                </Button>
                <TestProfileSelector ref={actionMenuRef}></TestProfileSelector>
            </div>,
        );

        expect(actionMenuRef.current).not.toEqual(document.activeElement);

        expect(clicked).toEqual(false);
        await act(() => {
            buttonClick();
            actionMenuRef.current?.open(innerRef.current!.getBoundingClientRect());
        });

        expect(container).toMatchSnapshot();

        unmount();
    });

    it("Update on connect", async () => {
        const launchPromise = setupShellForTests(false, true, "DEBUG3");

        const { unmount } = render(
            <ProfileSelector />,
        );

        const launcher = await launchPromise;

        // TODO: add check the profile selector has been updated on connect.

        await launcher.exitProcess();
        unmount();
    });

    describe("handleProfileAction tests", () => {
        let profileSelector: TestProfileSelector;
        let getProfileSpy: MockInstance;
        let loadProfileSpy: MockInstance;

        beforeEach(() => {
            profileSelector = new TestProfileSelector({});
            getProfileSpy = vi.spyOn(ShellInterface.users, "getProfile");
            loadProfileSpy = vi.spyOn(webSession, "loadProfile");
        });

        afterEach(() => {
            vi.clearAllMocks();
        });

        it("should load profile when action is 'current'", async () => {
            const mockProfile = { id: 1, name: "test profile" };
            getProfileSpy.mockResolvedValue(mockProfile);

            profileSelector.handleProfileAction("current", "1");
            await nextProcessTick();

            expect(getProfileSpy).toHaveBeenCalledWith(1);
            expect(loadProfileSpy).toHaveBeenCalledWith(mockProfile);
        });

        it("should not load profile when getProfile returns null", async () => {
            getProfileSpy.mockResolvedValue(null);

            profileSelector.handleProfileAction("current", "1");
            await nextProcessTick();

            expect(getProfileSpy).toHaveBeenCalledWith(1);
            expect(loadProfileSpy).not.toHaveBeenCalled();
        });

        it("should call editProfile when action is 'edit'", () => {
            const editProfileSpy = vi.spyOn(profileSelector, "editProfile");

            profileSelector.handleProfileAction("edit", "1");

            expect(editProfileSpy).toHaveBeenCalled();
        });

        it("should call addProfile when action is 'add'", () => {
            const addProfileSpy = vi.spyOn(profileSelector, "addProfile");

            profileSelector.handleProfileAction("add", "1");

            expect(addProfileSpy).toHaveBeenCalled();
        });

        it("should call deleteProfile when action is 'delete'", () => {
            const deleteProfileSpy = vi.spyOn(profileSelector, "deleteProfile");

            profileSelector.handleProfileAction("delete", "1");

            expect(deleteProfileSpy).toHaveBeenCalled();
        });

        it("should do nothing for unknown action", () => {
            const editProfileSpy = vi.spyOn(profileSelector, "editProfile");
            const addProfileSpy = vi.spyOn(profileSelector, "addProfile");
            const deleteProfileSpy = vi.spyOn(profileSelector, "deleteProfile");

            profileSelector.handleProfileAction("unknown", "1");

            expect(getProfileSpy).not.toHaveBeenCalled();
            expect(editProfileSpy).not.toHaveBeenCalled();
            expect(addProfileSpy).not.toHaveBeenCalled();
            expect(deleteProfileSpy).not.toHaveBeenCalled();
        });
    });

    describe("profileLoaded tests", () => {
        let profileSelector: TestProfileSelector;
        let getDefaultProfileSpy: MockInstance;
        let listProfilesSpy: MockInstance;
        let generatePopupMenuEntriesSpy: MockInstance;
        let sendUpdateProfileInfoMsgSpy: MockInstance;

        beforeEach(() => {
            profileSelector = new TestProfileSelector({});
            getDefaultProfileSpy = vi.spyOn(ShellInterface.users, "getDefaultProfile");
            listProfilesSpy = vi.spyOn(ShellInterface.users, "listProfiles");
            generatePopupMenuEntriesSpy = vi.spyOn(profileSelector, "generatePopupMenuEntries");
            sendUpdateProfileInfoMsgSpy = vi.spyOn(profileSelector, "sendUpdateProfileInfoMsg");
        });

        afterEach(() => {
            vi.clearAllMocks();
        });

        it("should load default profile and profile list successfully", async () => {
            const mockDefaultProfile = { id: 1, name: "default profile" };
            const mockProfiles = [
                { id: 1, name: "profile1" },
                { id: 2, name: "profile2" },
            ];

            getDefaultProfileSpy.mockResolvedValue(mockDefaultProfile);
            listProfilesSpy.mockResolvedValue(mockProfiles);

            const result = await profileSelector.profileLoaded();

            expect(getDefaultProfileSpy).toHaveBeenCalledWith(webSession.userId);
            expect(listProfilesSpy).toHaveBeenCalledWith(webSession.userId);
            expect(generatePopupMenuEntriesSpy).toHaveBeenCalled();
            expect(sendUpdateProfileInfoMsgSpy).toHaveBeenCalled();
            expect(result).toBe(true);
        });

        it("should use webSession.profile when getDefaultProfile returns null", async () => {
            const mockProfiles = [{ id: 1, name: "profile1" }];

            getDefaultProfileSpy.mockResolvedValue(null);
            listProfilesSpy.mockResolvedValue(mockProfiles);

            await profileSelector.profileLoaded();

            expect(profileSelector.defaultProfile).toBe(webSession.profile);
            expect(listProfilesSpy).toHaveBeenCalledWith(webSession.userId);
            expect(generatePopupMenuEntriesSpy).toHaveBeenCalled();
            expect(sendUpdateProfileInfoMsgSpy).toHaveBeenCalled();
        });

        it("should handle empty profile list", async () => {
            const mockDefaultProfile = { id: 1, name: "default profile" };

            getDefaultProfileSpy.mockResolvedValue(mockDefaultProfile);
            listProfilesSpy.mockResolvedValue([]);

            await profileSelector.profileLoaded();

            expect(profileSelector.defaultProfile).toBe(mockDefaultProfile);
            expect(profileSelector.activeProfiles).toEqual([]);
            expect(generatePopupMenuEntriesSpy).toHaveBeenCalled();
            expect(sendUpdateProfileInfoMsgSpy).toHaveBeenCalled();
        });
    });

    describe("getProfileList", () => {
        let profileSelector: TestProfileSelector;
        let listProfilesSpy: MockInstance;

        beforeEach(() => {
            profileSelector = new TestProfileSelector({});
            listProfilesSpy = vi.spyOn(ShellInterface.users, "listProfiles");
        });

        afterEach(() => {
            listProfilesSpy.mockRestore();
        });

        it("should fetch and map profiles correctly", async () => {
            const mockProfiles = [
                { id: 1, name: "profile1", options: { key: "value" } },
                { id: 2, name: "profile2", options: { key: "value2" } },
            ];

            listProfilesSpy.mockResolvedValue(mockProfiles);

            await profileSelector.getProfileList(1);

            expect(listProfilesSpy).toHaveBeenCalledWith(1);
            expect(profileSelector.activeProfiles).toEqual([
                { id: 1, userId: 1, name: "profile1", description: "", options: {} },
                { id: 2, userId: 1, name: "profile2", description: "", options: {} },
            ]);
        });

        it("should handle empty profile list", async () => {
            listProfilesSpy.mockResolvedValue([]);

            await profileSelector.getProfileList(1);

            expect(listProfilesSpy).toHaveBeenCalledWith(1);
            expect(profileSelector.activeProfiles).toEqual([]);
        });

        it("should handle error from listProfiles", async () => {
            listProfilesSpy.mockRejectedValue(new Error("Failed to fetch profiles"));

            await expect(profileSelector.getProfileList(1)).rejects.toThrow("Failed to fetch profiles");
            expect(listProfilesSpy).toHaveBeenCalledWith(1);
        });
    });

    describe("validateProfileValues tests", () => {
        let selectorRef: RefObject<TestProfileSelector>;
        let unmount: () => boolean;

        beforeEach(() => {
            selectorRef = createRef<TestProfileSelector>();
            const result = render(
                <ProfileSelector ref={selectorRef} />,
            );
            unmount = result.unmount;
        });

        afterEach(() => {
            unmount();
        });

        describe("Add section validation", () => {
            const baseValues: IDialogValues = {
                sections: new Map([
                    ["add", {
                        values: {
                            profileName: { type: "text", value: "" },
                            copyProfile: { type: "boolean", value: false },
                            definedProfiles: { type: "choice", choices: [], options: [] },
                        },
                    }],
                ]),
            };

            it("should validate empty profile name on closing", async () => {
                const result = selectorRef.current?.validateProfileValues(
                    true,
                    baseValues,
                    { saveProfile: true, section: "add" },
                );

                if (result) {
                    expect((await result).messages.profileName).toBe("The profile name cannot be empty");
                }
            });

            it("should not validate empty profile name when not closing", async () => {
                const result = selectorRef.current?.validateProfileValues(
                    false,
                    baseValues,
                    { saveProfile: true, section: "add" },
                );

                if (result) {
                    expect((await result).messages.profileName).toBeUndefined();
                }
            });

            it("should validate duplicate profile name", async () => {
                const values: IDialogValues = {
                    sections: new Map([
                        ["add", {
                            values: {
                                profileName: { type: "text", value: "existingProfile" },
                                copyProfile: { type: "boolean", value: false },
                                definedProfiles: { type: "choice", choices: [], options: [] },
                            },
                        }],
                    ]),
                };

                selectorRef.current!.activeProfiles = [
                    { name: "existingProfile", id: 1, userId: 1, description: "", options: {} },
                ];

                const result = selectorRef.current?.validateProfileValues(
                    true,
                    values,
                    { saveProfile: true, section: "add" },
                );

                if (result) {
                    expect((await result).messages.profileName).toBe("A profile with that name exists already");
                }
            });

            it("should validate missing profile selection when copying", async () => {
                const values: IDialogValues = {
                    sections: new Map([
                        ["add", {
                            values: {
                                profileName: { type: "text", value: "newProfile" },
                                copyProfile: { type: "boolean", value: true },
                                definedProfiles: { type: "choice", choices: [], options: [] },
                            },
                        }],
                    ]),
                };

                const result = selectorRef.current?.validateProfileValues(
                    true,
                    values,
                    { saveProfile: true, section: "add" },
                );

                if (result) {
                    expect((await result).messages.databaseType).toBe("Select one of the existing profile");
                }
            });
        });

        describe("Edit section validation", () => {
            const baseValues: IDialogValues = {
                sections: new Map([
                    ["edit", {
                        values: {
                            profileNewName: { type: "text", value: "" },
                            definedProfilesToEdit: { type: "text", value: "profile1" },
                            setAsDefaultProfile: { type: "separator", value: false, options: [] },
                        },
                    }],
                ]),
            };

            it("should validate empty profile name on closing", async () => {
                const result = selectorRef.current?.validateProfileValues(
                    true,
                    baseValues,
                    { saveProfile: true, section: "edit" },
                );

                if (result) {
                    expect((await result).messages.profileNewName).toBe("The profile name cannot be empty");
                }
            });

            it("should allow same name for same profile", async () => {
                selectorRef.current!.activeProfiles = [
                    { name: "profile1", id: 1, userId: 1, description: "", options: {} },
                ];

                const values: IDialogValues = {
                    sections: new Map([
                        ["edit", {
                            values: {
                                profileNewName: { type: "text", value: "profile1" },
                                definedProfilesToEdit: { type: "text", value: "profile1" },
                                setAsDefaultProfile: { type: "separator", value: false, options: [] },
                            },
                        }],
                    ]),
                };

                const result = selectorRef.current?.validateProfileValues(
                    true,
                    values,
                    { saveProfile: true, section: "edit" },
                );

                if (result) {
                    expect((await result).messages.profileNewName).toBeUndefined();
                }
            });
        });
    });

    describe("handleMenuItemClick tests", () => {
        let profileSelector: TestProfileSelector;
        let handleProfileActionSpy: MockInstance;

        beforeEach(() => {
            profileSelector = new TestProfileSelector({});
            handleProfileActionSpy = vi.spyOn(profileSelector, "handleProfileAction");
        });

        afterEach(() => {
            vi.clearAllMocks();
        });

        it("should handle numeric profile id", () => {
            const mockProps: IMenuItemProperties = {
                id: "1",
                command: { title: "Profile 1", command: "1" },
            };
            const result = profileSelector.handleMenuItemClick(mockProps);

            expect(result).toBe(true);
            expect(handleProfileActionSpy).toHaveBeenCalledWith("current", "1");
        });

        it("should handle action id", () => {
            const mockProps: IMenuItemProperties = {
                id: "add",
                command: { title: "Add Profile", command: "add" },
            };
            const result = profileSelector.handleMenuItemClick(mockProps);

            expect(result).toBe(true);
            expect(handleProfileActionSpy).toHaveBeenCalledWith("add", "add");
        });

        it("should handle menu items with children", () => {
            const mockProps: IMenuItemProperties = {
                id: "1",
                command: { title: "Profile 1", command: "1" },
                children: [<div key="1" />],
            };
            const result = profileSelector.handleMenuItemClick(mockProps);

            expect(result).toBe(false);
            expect(handleProfileActionSpy).not.toHaveBeenCalled();
        });
    });

    describe("updateProfile tests", () => {
        let profileSelector: TestProfileSelector;
        let updateProfileSpy: MockInstance;
        let setDefaultProfileSpy: MockInstance;

        beforeEach(() => {
            profileSelector = new TestProfileSelector({});
            updateProfileSpy = vi.spyOn(ShellInterface.users, "updateProfile");
            setDefaultProfileSpy = vi.spyOn(ShellInterface.users, "setDefaultProfile");
        });

        afterEach(() => {
            vi.clearAllMocks();
        });

        it("should update profile successfully", async () => {
            const mockProfile = { id: 1, name: "updated", description: "", userId: 1, options: {} };
            updateProfileSpy.mockResolvedValue(mockProfile);
            profileSelector.activeProfiles = [{ ...mockProfile, name: "original" }];

            await profileSelector.updateProfile(mockProfile, false);

            expect(updateProfileSpy).toHaveBeenCalledWith(mockProfile);
            expect(profileSelector.activeProfiles[0].name).toBe("updated");
            expect(setDefaultProfileSpy).not.toHaveBeenCalled();
        });

        it("should update profile and set as default", async () => {
            const mockProfile = { id: 1, name: "updated", description: "", userId: 1, options: {} };
            updateProfileSpy.mockResolvedValue(mockProfile);
            setDefaultProfileSpy.mockResolvedValue(undefined);
            profileSelector.activeProfiles = [{ ...mockProfile, name: "original" }];

            await profileSelector.updateProfile(mockProfile, true);

            expect(updateProfileSpy).toHaveBeenCalledWith(mockProfile);
            expect(setDefaultProfileSpy).toHaveBeenCalledWith(webSession.userId, mockProfile.id);
            expect(profileSelector.defaultProfile).toEqual(mockProfile);
        });

        it("updateProfile - should update profile and handle default profile setting", async () => {
            const selectorRef = createRef<TestProfileSelector>();
            const { unmount } = render(
                <div>
                    <TestProfileSelector ref={selectorRef} />
                </div>,
            );

            const profileSelector = selectorRef.current;
            expect(profileSelector).toBeTruthy();

            profileSelector!.activeProfiles = [
                { id: 1, userId: 1, name: "Profile 1", description: "", options: {} },
                { id: 2, userId: 1, name: "Profile 2", description: "", options: {} },
            ];

            const profileToEdit = { id: 1, userId: 1, name: "Updated Profile", description: "", options: {} };
            await profileSelector!.updateProfile(profileToEdit, true);

            const updatedProfile = profileSelector!.activeProfiles.find((p) => {
                return p.id === 1;
            });
            expect(updatedProfile?.name).toBe("Updated Profile");

            expect(profileSelector!.defaultProfile?.id).toBe(1);

            unmount();
        });
    });

    describe("updateProfile", () => {
        const selectorRef = createRef<TestProfileSelector>();
        let unmountFunc: () => boolean;

        const mockProfile = {
            id: 1,
            userId: 123,
            name: "Test Profile",
            description: "",
            options: {},
        };

        beforeEach(async () => {
            // Reset component before each test
            const { unmount } = render(<TestProfileSelector ref={selectorRef} />);
            unmountFunc = unmount;

            await nextRunLoop();
            expect(selectorRef.current).toBeDefined();

            selectorRef.current!.activeProfiles = [{ ...mockProfile }];

            // Mock ShellInterface methods
            (global as Record<string, unknown>).ShellInterface = {
                users: {
                    updateProfile: vi.fn(),
                    setDefaultProfile: vi.fn(),
                },
            };
        });

        afterEach(() => {
            unmountFunc();
        });

        it("should update profile successfully", async () => {
            const updatedProfile = { ...mockProfile, name: "Updated Profile" };
            (ShellInterface.users.updateProfile as MockedFunction<
                typeof ShellInterface.users.updateProfile
            >).mockResolvedValue(updatedProfile);

            await selectorRef.current!.updateProfile(updatedProfile, false);

            expect(ShellInterface.users.updateProfile).toHaveBeenCalledWith(updatedProfile);
            expect(selectorRef.current!.activeProfiles[0].name).toBe("Updated Profile");
            expect(ShellInterface.users.setDefaultProfile).not.toHaveBeenCalled();
        });

        it("should update profile and set as default", async () => {
            const updatedProfile = { ...mockProfile, name: "Default Profile" };
            (ShellInterface.users.updateProfile as MockedFunction<
                typeof ShellInterface.users.updateProfile
            >).mockResolvedValue(updatedProfile);

            await selectorRef.current!.updateProfile(updatedProfile, true);

            expect(ShellInterface.users.updateProfile).toHaveBeenCalledWith(updatedProfile);
            expect(ShellInterface.users.setDefaultProfile).toHaveBeenCalledWith(
                webSession.userId,
                updatedProfile.id,
            );
            expect(selectorRef.current!.defaultProfile).toEqual(updatedProfile);
        });

        it("should not update profile when API call fails", async () => {
            const updatedProfile = { ...mockProfile, name: "Failed Profile" };
            (ShellInterface.users.updateProfile as MockedFunction<
                typeof ShellInterface.users.updateProfile
            >).mockResolvedValue(undefined);

            await selectorRef.current!.updateProfile(updatedProfile, false);

            expect(ShellInterface.users.updateProfile).toHaveBeenCalledWith(updatedProfile);
            expect(selectorRef.current!.activeProfiles[0].name).toBe("Test Profile");
        });

        it("should handle profile not found in activeProfiles", async () => {
            const nonExistentProfile = { ...mockProfile, id: 999 };
            (ShellInterface.users.updateProfile as MockedFunction<
                typeof ShellInterface.users.updateProfile
            >).mockResolvedValue(nonExistentProfile);

            await selectorRef.current!.updateProfile(nonExistentProfile, false);

            expect(ShellInterface.users.updateProfile).toHaveBeenCalledWith(nonExistentProfile);
            expect(selectorRef.current!.activeProfiles).toHaveLength(1);
            expect(selectorRef.current!.activeProfiles[0].id).toBe(1);
        });
    });

});
