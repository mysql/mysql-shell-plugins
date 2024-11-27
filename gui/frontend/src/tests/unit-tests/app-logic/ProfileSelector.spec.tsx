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

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable dot-notation */

import { act } from "@testing-library/preact";
import { mount } from "enzyme";
import { createRef } from "preact";

import { ProfileSelector } from "../../../app-logic/ProfileSelector.js";
import { Button } from "../../../components/ui/Button/Button.js";

import { ShellInterface } from "../../../supplement/ShellInterface/ShellInterface.js";
import { webSession } from "../../../supplement/WebSession.js";
import { mouseEventMock } from "../__mocks__/EventMocks.js";
import { nextProcessTick, setupShellForTests } from "../test-helpers.js";
import { IMenuItemProperties } from "../../../components/ui/Menu/MenuItem.js";

let clicked = false;
const buttonClick = (): void => {
    clicked = true;
};

describe("ProfileSelector test", () => {

    beforeEach(() => {
        clicked = false;
    });

    it("Render Profile Selector and check properties", async () => {
        const actionMenuRef = createRef<ProfileSelector>();
        const innerRef = createRef<HTMLDivElement>();
        const component = mount(
            <div>
                <Button innerRef={innerRef} onClick={buttonClick}>
                    Open Profile Selector
                </Button>
                <ProfileSelector ref={actionMenuRef}></ProfileSelector>
            </div>,
        );

        expect(actionMenuRef.current).not.toEqual(document.activeElement);
        expect(component).toBeTruthy();

        expect(clicked).toEqual(false);
        const click = (component.find(Button).props()).onClick;
        await act(() => {
            click?.(mouseEventMock, { id: "1" });
            actionMenuRef.current?.open(component.getDOMNode().getBoundingClientRect());
        });
        expect(clicked).toEqual(true);

        let menuItem = component.find("#add");
        expect(menuItem).toBeTruthy();

        menuItem = component.find("#edit");
        expect(menuItem).toBeTruthy();

        menuItem = component.find("#delete");
        expect(menuItem).toBeTruthy();

        component.unmount();
    });

    it("Standard Rendering (snapshot)", async () => {
        const actionMenuRef = createRef<ProfileSelector>();
        const component = mount(
            <div>
                <Button onClick={buttonClick}>
                    Open Profile Selector
                </Button>
                <ProfileSelector ref={actionMenuRef}></ProfileSelector>
            </div>,
        );

        expect(actionMenuRef.current).not.toEqual(document.activeElement);
        expect(component).toBeTruthy();

        expect(clicked).toEqual(false);
        const click = (component.find(Button).props()).onClick;
        await act(() => {
            click?.(mouseEventMock, { id: "1" });
            actionMenuRef.current?.open(component.getDOMNode().getBoundingClientRect());
        });

        expect(component).toMatchSnapshot();

        component.unmount();
    });

    it("Update on connect", async () => {
        const launchPromise = setupShellForTests(false, true, "DEBUG3");

        const component = mount<ProfileSelector>(
            <ProfileSelector />,
        );

        const launcher = await launchPromise;

        // TODO: add check the profile selector has been updated on connect.

        await launcher.exitProcess();
        component.unmount();
    });

    describe("handleProfileAction tests", () => {
        let profileSelector: ProfileSelector;
        let getProfileSpy: jest.SpyInstance;
        let loadProfileSpy: jest.SpyInstance;

        beforeEach(() => {
            profileSelector = new ProfileSelector({});
            getProfileSpy = jest.spyOn(ShellInterface.users, "getProfile");
            loadProfileSpy = jest.spyOn(webSession, "loadProfile");
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it("should load profile when action is 'current'", async () => {
            const mockProfile = { id: 1, name: "test profile" };
            getProfileSpy.mockResolvedValue(mockProfile);

            profileSelector["handleProfileAction"]("current", "1");
            await nextProcessTick();

            expect(getProfileSpy).toHaveBeenCalledWith(1);
            expect(loadProfileSpy).toHaveBeenCalledWith(mockProfile);
        });

        it("should not load profile when getProfile returns null", async () => {
            getProfileSpy.mockResolvedValue(null);

            profileSelector["handleProfileAction"]("current", "1");
            await nextProcessTick();

            expect(getProfileSpy).toHaveBeenCalledWith(1);
            expect(loadProfileSpy).not.toHaveBeenCalled();
        });

        it("should call editProfile when action is 'edit'", () => {
            const editProfileSpy = jest.spyOn(profileSelector as any, "editProfile");

            profileSelector["handleProfileAction"]("edit", "1");

            expect(editProfileSpy).toHaveBeenCalled();
        });

        it("should call addProfile when action is 'add'", () => {
            const addProfileSpy = jest.spyOn(profileSelector as any, "addProfile");

            profileSelector["handleProfileAction"]("add", "1");

            expect(addProfileSpy).toHaveBeenCalled();
        });

        it("should call deleteProfile when action is 'delete'", () => {
            const deleteProfileSpy = jest.spyOn(profileSelector as any, "deleteProfile");

            profileSelector["handleProfileAction"]("delete", "1");

            expect(deleteProfileSpy).toHaveBeenCalled();
        });

        it("should do nothing for unknown action", () => {
            const editProfileSpy = jest.spyOn(profileSelector as any, "editProfile");
            const addProfileSpy = jest.spyOn(profileSelector as any, "addProfile");
            const deleteProfileSpy = jest.spyOn(profileSelector as any, "deleteProfile");

            profileSelector["handleProfileAction"]("unknown", "1");

            expect(getProfileSpy).not.toHaveBeenCalled();
            expect(editProfileSpy).not.toHaveBeenCalled();
            expect(addProfileSpy).not.toHaveBeenCalled();
            expect(deleteProfileSpy).not.toHaveBeenCalled();
        });
    });

    describe("profileLoaded tests", () => {
        let profileSelector: ProfileSelector;
        let getDefaultProfileSpy: jest.SpyInstance;
        let listProfilesSpy: jest.SpyInstance;
        let generatePopupMenuEntriesSpy: jest.SpyInstance;
        let sendUpdateProfileInfoMsgSpy: jest.SpyInstance;

        beforeEach(() => {
            profileSelector = new ProfileSelector({});
            getDefaultProfileSpy = jest.spyOn(ShellInterface.users, "getDefaultProfile");
            listProfilesSpy = jest.spyOn(ShellInterface.users, "listProfiles");
            generatePopupMenuEntriesSpy = jest.spyOn(profileSelector as any, "generatePopupMenuEntries");
            sendUpdateProfileInfoMsgSpy = jest.spyOn(profileSelector as any, "sendUpdateProfileInfoMsg");
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it("should load default profile and profile list successfully", async () => {
            const mockDefaultProfile = { id: 1, name: "default profile" };
            const mockProfiles = [
                { id: 1, name: "profile1" },
                { id: 2, name: "profile2" },
            ];

            getDefaultProfileSpy.mockResolvedValue(mockDefaultProfile);
            listProfilesSpy.mockResolvedValue(mockProfiles);

            const result = await profileSelector["profileLoaded"]();

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

            await profileSelector["profileLoaded"]();

            expect(profileSelector["defaultProfile"]).toBe(webSession.profile);
            expect(listProfilesSpy).toHaveBeenCalledWith(webSession.userId);
            expect(generatePopupMenuEntriesSpy).toHaveBeenCalled();
            expect(sendUpdateProfileInfoMsgSpy).toHaveBeenCalled();
        });

        it("should handle empty profile list", async () => {
            const mockDefaultProfile = { id: 1, name: "default profile" };

            getDefaultProfileSpy.mockResolvedValue(mockDefaultProfile);
            listProfilesSpy.mockResolvedValue([]);

            await profileSelector["profileLoaded"]();

            expect(profileSelector["defaultProfile"]).toBe(mockDefaultProfile);
            expect(profileSelector["activeProfiles"]).toEqual([]);
            expect(generatePopupMenuEntriesSpy).toHaveBeenCalled();
            expect(sendUpdateProfileInfoMsgSpy).toHaveBeenCalled();
        });
    });

    describe("getProfileList", () => {
        let profileSelector: ProfileSelector;
        let listProfilesSpy: jest.SpyInstance;

        beforeEach(() => {
            profileSelector = new ProfileSelector({});
            listProfilesSpy = jest.spyOn(ShellInterface.users, "listProfiles");
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

            await profileSelector["getProfileList"](1);

            expect(listProfilesSpy).toHaveBeenCalledWith(1);
            expect(profileSelector["activeProfiles"]).toEqual([
                { id: 1, userId: 1, name: "profile1", description: "", options: {} },
                { id: 2, userId: 1, name: "profile2", description: "", options: {} },
            ]);
        });

        it("should handle empty profile list", async () => {
            listProfilesSpy.mockResolvedValue([]);

            await profileSelector["getProfileList"](1);

            expect(listProfilesSpy).toHaveBeenCalledWith(1);
            expect(profileSelector["activeProfiles"]).toEqual([]);
        });

        it("should handle error from listProfiles", async () => {
            listProfilesSpy.mockRejectedValue(new Error("Failed to fetch profiles"));

            await expect(profileSelector["getProfileList"](1)).rejects.toThrow("Failed to fetch profiles");
            expect(listProfilesSpy).toHaveBeenCalledWith(1);
        });
    });

    describe("validateProfileValues tests", () => {
        let actionMenuRef: any;
        let component: any;

        beforeEach( () => {
            actionMenuRef = createRef<ProfileSelector>();
            component = mount(
                <ProfileSelector ref={actionMenuRef}></ProfileSelector>,
            );
        });

        afterEach(() => {
            component.unmount();
        });

        describe("Add section validation", () => {
            const baseValues = {
                sections: new Map([
                    ["add", {
                        values: {
                            profileName: { value: "" },
                            copyProfile: { value: false },
                            definedProfiles: { value: null, options: [] },
                        },
                    }],
                ]),
            };

            it("should validate empty profile name on closing", () => {
                const result = actionMenuRef.current?.validateProfileValues(
                    true,
                    baseValues,
                    { saveProfile: true, section: "add" },
                );

                expect(result.messages.profileName).toBe("The profile name cannot be empty");
            });

            it("should not validate empty profile name when not closing", () => {
                const result = actionMenuRef.current?.validateProfileValues(
                    false,
                    baseValues,
                    { saveProfile: true, section: "add" },
                );

                expect(result.messages.profileName).toBeUndefined();
            });

            it("should validate duplicate profile name", () => {
                const values = {
                    sections: new Map([
                        ["add", {
                            values: {
                                profileName: { value: "existingProfile" },
                                copyProfile: { value: false },
                                definedProfiles: { value: null, options: [] },
                            },
                        }],
                    ]),
                };

                (actionMenuRef.current).activeProfiles = [
                    { name: "existingProfile", id: 1 },
                ];

                const result = actionMenuRef.current?.validateProfileValues(
                    true,
                    values,
                    { saveProfile: true, section: "add" },
                );

                expect(result.messages.profileName).toBe("A profile with that name exists already");
            });

            it("should validate missing profile selection when copying", () => {
                const values = {
                    sections: new Map([
                        ["add", {
                            values: {
                                profileName: { value: "newProfile" },
                                copyProfile: { value: true },
                                definedProfiles: { value: null, options: [] },
                            },
                        }],
                    ]),
                };

                const result = actionMenuRef.current?.validateProfileValues(
                    true,
                    values,
                    { saveProfile: true, section: "add" },
                );

                expect(result.messages.databaseType).toBe("Select one of the existing profile");
            });
        });

        describe("Edit section validation", () => {
            const baseValues = {
                sections: new Map([
                    ["edit", {
                        values: {
                            profileNewName: { value: "" },
                            definedProfilesToEdit: { value: "profile1" },
                            setAsDefaultProfile: { value: false, options: [] },
                        },
                    }],
                ]),
            };

            it("should validate empty profile name on closing", () => {
                const result = actionMenuRef.current?.validateProfileValues(
                    true,
                    baseValues,
                    { saveProfile: true, section: "edit" },
                );

                expect(result.messages.profileNewName).toBe("The profile name cannot be empty");
            });

            it("should allow same name for same profile", () => {
                (actionMenuRef.current).activeProfiles = [
                    { name: "profile1", id: 1 },
                ];

                const values = {
                    sections: new Map([
                        ["edit", {
                            values: {
                                profileNewName: { value: "profile1" },
                                definedProfilesToEdit: { value: "profile1" },
                                setAsDefaultProfile: { value: false, options: [] },
                            },
                        }],
                    ]),
                };

                const result = actionMenuRef.current?.validateProfileValues(
                    true,
                    values,
                    { saveProfile: true, section: "edit" },
                );

                expect(result.messages.profileNewName).toBeUndefined();
            });
        });
    });

    describe("handleMenuItemClick tests", () => {
        let profileSelector: ProfileSelector;
        let handleProfileActionSpy: jest.SpyInstance;

        beforeEach(() => {
            profileSelector = new ProfileSelector({});
            handleProfileActionSpy = jest.spyOn(profileSelector as any, "handleProfileAction");
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it("should handle numeric profile id", () => {
            const mockProps: IMenuItemProperties = {
                id: "1",
                command: { title: "Profile 1", command: "1" },
            };
            const result = profileSelector["handleMenuItemClick"](mockProps);

            expect(result).toBe(true);
            expect(handleProfileActionSpy).toHaveBeenCalledWith("current", "1");
        });

        it("should handle action id", () => {
            const mockProps: IMenuItemProperties = {
                id: "add",
                command: { title: "Add Profile", command: "add" },
            };
            const result = profileSelector["handleMenuItemClick"](mockProps);

            expect(result).toBe(true);
            expect(handleProfileActionSpy).toHaveBeenCalledWith("add", "add");
        });

        it("should handle menu items with children", () => {
            const mockProps: IMenuItemProperties = {
                id: "1",
                command: { title: "Profile 1", command: "1" },
                children: [<div key="1" />],
            };
            const result = profileSelector["handleMenuItemClick"](mockProps);

            expect(result).toBe(false);
            expect(handleProfileActionSpy).not.toHaveBeenCalled();
        });
    });

    describe("updateProfile tests", () => {
        let profileSelector: ProfileSelector;
        let updateProfileSpy: jest.SpyInstance;
        let setDefaultProfileSpy: jest.SpyInstance;

        beforeEach(() => {
            profileSelector = new ProfileSelector({});
            updateProfileSpy = jest.spyOn(ShellInterface.users, "updateProfile");
            setDefaultProfileSpy = jest.spyOn(ShellInterface.users, "setDefaultProfile");
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it("should update profile successfully", async () => {
            const mockProfile = { id: 1, name: "updated", description: "", userId: 1, options: {} };
            updateProfileSpy.mockResolvedValue(mockProfile);
            profileSelector["activeProfiles"] = [{ ...mockProfile, name: "original" }];

            await profileSelector["updateProfile"](mockProfile, false);

            expect(updateProfileSpy).toHaveBeenCalledWith(mockProfile);
            expect(profileSelector["activeProfiles"][0].name).toBe("updated");
            expect(setDefaultProfileSpy).not.toHaveBeenCalled();
        });

        it("should update profile and set as default", async () => {
            const mockProfile = { id: 1, name: "updated", description: "", userId: 1, options: {} };
            updateProfileSpy.mockResolvedValue(mockProfile);
            setDefaultProfileSpy.mockResolvedValue(undefined);
            profileSelector["activeProfiles"] = [{ ...mockProfile, name: "original" }];

            await profileSelector["updateProfile"](mockProfile, true);

            expect(updateProfileSpy).toHaveBeenCalledWith(mockProfile);
            expect(setDefaultProfileSpy).toHaveBeenCalledWith(webSession.userId, mockProfile.id);
            expect(profileSelector["defaultProfile"]).toEqual(mockProfile);
        });

        it("updateProfile - should update profile and handle default profile setting", async () => {
            const actionMenuRef = createRef<ProfileSelector>();
            const component = mount(
                <div>
                    <ProfileSelector ref={actionMenuRef}></ProfileSelector>
                </div>,
            );

            const profileSelector = actionMenuRef.current;
            expect(profileSelector).toBeTruthy();

            profileSelector!["activeProfiles"] = [
                { id: 1, userId: 1, name: "Profile 1", description: "", options: {} },
                { id: 2, userId: 1, name: "Profile 2", description: "", options: {} },
            ];

            const profileToEdit = { id: 1, userId: 1, name: "Updated Profile", description: "", options: {} };
            await profileSelector!["updateProfile"](profileToEdit, true);

            const updatedProfile = profileSelector!["activeProfiles"].find((p) => {return p.id === 1;});
            expect(updatedProfile?.name).toBe("Updated Profile");

            expect(profileSelector!["defaultProfile"]?.id).toBe(1);

            component.unmount();
        });
    });

    describe("updateProfile", () => {
        let component: any;
        const mockProfile = {
            id: 1,
            userId: 123,
            name: "Test Profile",
            description: "",
            options: {},
        };

        beforeEach(() => {
            // Reset component before each test
            component = mount(<ProfileSelector />).instance();
            component.activeProfiles = [{ ...mockProfile }];

            // Mock ShellInterface methods
            (global as any).ShellInterface = {
                users: {
                    updateProfile: jest.fn(),
                    setDefaultProfile: jest.fn(),
                },
            };
        });

        it("should update profile successfully", async () => {
            const updatedProfile = { ...mockProfile, name: "Updated Profile" };
            (ShellInterface.users.updateProfile as jest.MockedFunction<
                typeof ShellInterface.users.updateProfile
            >).mockResolvedValue(updatedProfile);

            await component.updateProfile(updatedProfile, false);

            expect(ShellInterface.users.updateProfile).toHaveBeenCalledWith(updatedProfile);
            expect(component.activeProfiles[0].name).toBe("Updated Profile");
            expect(ShellInterface.users.setDefaultProfile).not.toHaveBeenCalled();
        });

        it("should update profile and set as default", async () => {
            const updatedProfile = { ...mockProfile, name: "Default Profile" };
            (ShellInterface.users.updateProfile as jest.MockedFunction<
                typeof ShellInterface.users.updateProfile
            >).mockResolvedValue(updatedProfile);

            await component.updateProfile(updatedProfile, true);

            expect(ShellInterface.users.updateProfile).toHaveBeenCalledWith(updatedProfile);
            expect(ShellInterface.users.setDefaultProfile).toHaveBeenCalledWith(
                webSession.userId,
                updatedProfile.id,
            );
            expect(component.defaultProfile).toEqual(updatedProfile);
        });

        it("should not update profile when API call fails", async () => {
            const updatedProfile = { ...mockProfile, name: "Failed Profile" };
            (ShellInterface.users.updateProfile as jest.MockedFunction<
                typeof ShellInterface.users.updateProfile
            >).mockResolvedValue(undefined);

            await component.updateProfile(updatedProfile, false);

            expect(ShellInterface.users.updateProfile).toHaveBeenCalledWith(updatedProfile);
            expect(component.activeProfiles[0].name).toBe("Test Profile");
        });

        it("should handle profile not found in activeProfiles", async () => {
            const nonExistentProfile = { ...mockProfile, id: 999 };
            (ShellInterface.users.updateProfile as jest.MockedFunction<
                typeof ShellInterface.users.updateProfile
            >).mockResolvedValue(nonExistentProfile);

            await component.updateProfile(nonExistentProfile, false);

            expect(ShellInterface.users.updateProfile).toHaveBeenCalledWith(nonExistentProfile);
            expect(component.activeProfiles).toHaveLength(1);
            expect(component.activeProfiles[0].id).toBe(1);
        });
    });

    describe("deleteProfileConfirm", () => {
        let component: any;
        const mockProfiles = [
            {
                id: 1,
                userId: 123,
                name: "Profile 1",
                description: "",
                options: {},
            },
            {
                id: 2,
                userId: 123,
                name: "Profile 2",
                description: "",
                options: {},
            },
        ];

        beforeEach(() => {
            component = mount(<ProfileSelector />).instance();
            component.confirmDialogRef = createRef();
            component.confirmDialogRef.current = {
                show: jest.fn(),
            };
        });

        it("should show confirmation dialog with single profile", () => {
            component.deleteList = [mockProfiles[0]];
            component.deleteProfileConfirm();

            expect(component.confirmDialogRef.current.show).toHaveBeenCalled();
            const [content, buttons, title] = component.confirmDialogRef.current.show.mock.calls[0];

            expect(title).toBe("Delete Profile");
            expect(buttons).toEqual({ refuse: "No", accept: "Yes" });

            // Verify dialog content
            const wrapper = mount(content);
            expect(wrapper.find("Label").first().props().caption)
                .toBe("Are you sure you want to delete the selected profile");
            expect(wrapper.find("ul").find("Label").props().caption).toBe("Profile 1");
        });

        it("should show confirmation dialog with multiple profiles", () => {
            component.deleteList = mockProfiles;
            component.deleteProfileConfirm();

            expect(component.confirmDialogRef.current.show).toHaveBeenCalled();
            const [content] = component.confirmDialogRef.current.show.mock.calls[0];

            // Verify dialog content
            const wrapper = mount(content);
            expect(wrapper.find("Label").first().props().caption)
                .toBe("Are you sure you want to delete the selected profiles");
            const listLabels = wrapper.find("ul").find("Label");
            expect(listLabels).toHaveLength(2);
            expect(listLabels.at(0).props().caption).toBe("Profile 1");
            expect(listLabels.at(1).props().caption).toBe("Profile 2");
        });

        it("should not show dialog when deleteList is empty", () => {
            component.deleteList = [];

            component.deleteProfileConfirm();

            expect(component.confirmDialogRef.current.show).toHaveBeenCalled();
            const [content] = component.confirmDialogRef.current.show.mock.calls[0];

            // Verify dialog content
            const wrapper = mount(content);
            expect(wrapper.find("Label").first().props().caption)
                .toBe("Are you sure you want to delete the selected profile");
            expect(wrapper.find("ul").find("Label")).toHaveLength(0);
        });
    });
});
