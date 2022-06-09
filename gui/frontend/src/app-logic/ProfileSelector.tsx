/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

import React from "react";
import { isNil } from "lodash";

import {
    ICommAuthenticationEvent, ICommListProfilesEvent, ICommProfileEvent, ICommShellProfile,
} from "../communication";
import {
    CheckState, ComponentPlacement, Container, ICheckboxProperties, IComponentState, ILabelProperties,
    IMenuItemProperties, Label, List, Menu, MenuItem, Orientation,
} from "../components/ui";
import editIcon from "../assets/images/edit.svg";
import deleteIcon from "../assets/images/close2.svg";
import addIcon from "../assets/images/add.svg";
import defaultIcon from "../assets/images/chevron-right.svg";
import currentIcon from "../assets/images/connections.svg";
import {
    ConfirmDialog, DialogValueOption, IDialogSection, IDialogValidations, IDialogValues, ValueEditDialog,
} from "../components/Dialogs";
import { ShellInterface } from "../supplement/ShellInterface";
import { webSession } from "../supplement/WebSession";
import { requisitions } from "../supplement/Requisitions";
import { eventFilterNoRequests, ListenerEntry } from "../supplement/Dispatch";
import { DialogResponseClosure } from "./Types";

interface IProfileSelectorState extends IComponentState {
    menuItems: React.ReactNode[];
}

export class ProfileSelector extends React.Component<{}, IProfileSelectorState> {

    private profileDialogRef = React.createRef<ValueEditDialog>();
    private confirmDialogRef = React.createRef<ConfirmDialog>();

    private actionMenuRef = React.createRef<Menu>();
    private profileName = "";

    private deleteList: ICommShellProfile[] = [];
    private activeProfiles: ICommShellProfile[] = [];
    private defaultProfile: ICommShellProfile;

    public constructor(props: {}) {
        super(props);

        ListenerEntry.createByClass("authenticate", { filters: [eventFilterNoRequests], persistent: true })
            .then((event: ICommAuthenticationEvent) => {
                this.defaultProfile = event.data.activeProfile;
                this.initProfileList(event.data.activeProfile);
            }).catch(/* istanbul ignore next*/() => { /* Handled elsewhere */ });

        this.state = { menuItems: [] };
    }

    public componentDidMount(): void {
        requisitions.register("profileLoaded", this.profileLoaded);

    }

    public open(currentTarget: DOMRect): void {
        this.actionMenuRef?.current?.open(currentTarget, false);
    }

    public initProfileList(profile: ICommShellProfile): void {
        this.getProfileList(profile.userId);
        void requisitions.execute("updateStatusbar", [{
            id: "message",
            visible: true,
            text: "Login Successful",
        }]);
    }

    public render(): React.ReactNode {
        const { menuItems } = this.state;

        return (
            <>
                <ValueEditDialog
                    ref={this.profileDialogRef}
                    id="profileCreating"
                    onValidate={this.validateProfileValues}
                    onClose={this.handleProfileChanges}
                />
                <ConfirmDialog
                    ref={this.confirmDialogRef}
                    id="confirmDeleteDialog"
                    onClose={this.handleProfileDelete}
                />
                <Menu
                    id="tileActionMenu"
                    ref={this.actionMenuRef}
                    placement={ComponentPlacement.TopLeft}
                    onItemClick={this.handleMenuItemClick}
                >
                    {menuItems}
                    <MenuItem id="-" key="separator1" caption="-" />
                    <MenuItem
                        id="add"
                        key="add"
                        caption="Add Profile"
                        icon={addIcon}
                    />
                    <MenuItem
                        id="edit"
                        key="edit"
                        caption="Edit Profile"
                        icon={editIcon}
                    />
                    <MenuItem
                        id="delete"
                        key="delete"
                        caption="Delete Profile"
                        icon={deleteIcon}
                    />
                </Menu>
            </>
        );
    }

    private handleProfileAction = (action: string, profileId: string): void => {
        switch (action) {
            case "current": {
                ShellInterface.users.getProfile(parseInt(profileId, 10)).then((event: ICommProfileEvent) => {
                    if (event.data?.result) {
                        webSession.loadProfile(event.data.result);
                    }
                });

                break;
            }
            case "edit": {
                this.editProfile();

                break;
            }

            case "add": {
                this.addProfile();

                break;
            }

            case "delete": {
                this.deleteProfile();

                break;
            }

            default: {
                break;
            }
        }
    };

    private profileLoaded = (): Promise<boolean> => {
        this.generatePopupMenuEntries();
        this.sendUpdateProfileInfoMsg();

        return Promise.resolve(true);
    };

    private getProfileList = (userId: number): void => {
        ShellInterface.users.listProfiles(userId).then((event: ICommListProfilesEvent) => {
            // istanbul ignore if
            if (!event.data.rows) {
                return;
            }

            this.activeProfiles = event.data.rows.map((row) => {
                return {
                    id: row.id,
                    userId,
                    name: row.name,
                    description: "",
                    options: {},
                };
            });
            this.sendUpdateProfileInfoMsg();
            this.generatePopupMenuEntries();
        });
    };

    private generatePopupMenuEntries = (): void => {
        const menuItems: React.ReactNode[] = [];
        this.activeProfiles?.forEach(
            (value: ICommShellProfile, index: number) => {
                let icon;
                if (value.id === webSession.currentProfileId) {
                    icon = currentIcon;
                }

                if (value.id === this.defaultProfile.id) {
                    icon = defaultIcon;
                }
                const menuItem = (
                    <MenuItem
                        key={`profile${index}`}
                        id={value.id.toString()}
                        caption={value.name}
                        icon={icon}
                        title={value.description}
                    ></MenuItem>
                );
                menuItems.push(menuItem);
            },
        );
        this.setState({ menuItems });
    };

    private addProfile = (): void => {
        if (this.profileDialogRef.current) {
            this.profileDialogRef.current.show(
                this.generateEditorConfig(),
                {
                    contexts: ["add"],
                    title: "Add New Profile",
                },
                { saveProfile: true, section: "add" },
            );
        }
    };

    private editProfile = (): void => {
        if (this.profileDialogRef.current) {
            this.profileDialogRef.current.show(
                this.generateEditorConfig(),
                {
                    contexts: ["edit"],
                    title: "Edit Profile",
                },
                { saveProfile: true, section: "edit" },
            );
        }
    };

    private deleteProfile = (): void => {
        if (this.profileDialogRef.current) {
            this.profileDialogRef.current.show(
                this.generateEditorConfig(),
                {
                    contexts: ["delete"],
                    title: "Delete Profile",
                },
                { saveProfile: true, section: "delete" },
            );
        }
    };

    private validateProfileValues = (closing: boolean, values: IDialogValues, payload: unknown): IDialogValidations => {
        const result: IDialogValidations = {
            requiredContexts: [],
            messages: {},
        };

        const details = payload as { saveProfile: boolean; section: string };
        const sectionId = details.section ?? "add";
        const sectionValues = values.sections.get(sectionId)!.values;
        switch (sectionId) {
            case "add": {
                const useExistingProfile = sectionValues.copyProfile.value;
                sectionValues.definedProfiles.options = !useExistingProfile ? [DialogValueOption.ReadOnly] : [];
                if (useExistingProfile && isNil(sectionValues.definedProfiles.value)) {
                    result.messages.databaseType = "Select one of the existing profile";
                }

                if (!sectionValues.profileName.value) {
                    if (closing) {
                        result.messages.profileName = "The profile name cannot be empty";
                    }
                } else {
                    const profileName = this.activeProfiles.find(
                        (element: ICommShellProfile): boolean => {
                            return element.name === sectionValues.profileName.value;
                        },
                    );
                    if (profileName && details.saveProfile) {
                        result.messages.profileName = "A profile with that name exists already";
                    }
                }
                break;
            }

            case "edit": {
                const profile = this.activeProfiles.find(
                    (item: ICommShellProfile) => {
                        return item.name === sectionValues.definedProfilesToEdit.value;
                    },
                );
                if (this.profileName !== profile?.name) {
                    this.profileName = profile?.name ?? "";
                    sectionValues.profileNewName.value = profile?.name;
                }

                if (this.defaultProfile.id === profile?.id) {
                    sectionValues.setAsDefaultProfile.options = [DialogValueOption.ReadOnly];
                    sectionValues.setAsDefaultProfile.value = true;
                } else {
                    sectionValues.setAsDefaultProfile.options = [];
                }

                if (!sectionValues.profileNewName.value) {
                    if (closing) {
                        result.messages.profileNewName = "The profile name cannot be empty";
                    }
                } else {
                    const profileNewName = this.activeProfiles.find((element: ICommShellProfile): boolean => {
                        return element.name === sectionValues.profileNewName.value && element.id !== profile?.id;
                    });

                    if (profileNewName && details.saveProfile) {
                        result.messages.profileNewName = "A profile with that name exists already";
                    }
                }
                break;
            }

            case "delete": {
                const list = sectionValues.profileActivateDeactivate?.list;
                list?.forEach((item) => {
                    const data = item.data as ICheckboxProperties;
                    if (String(this.defaultProfile.id) === data.id && data.checkState === CheckState.Checked) {
                        result.messages.profileActivateDeactivate = "Default profile cannot be deleted";
                    }

                    if (String(webSession.currentProfileId) === data.id
                        && data.checkState === CheckState.Checked) {
                        result.messages.profileActivateDeactivate = "Active profile cannot be deleted";
                    }
                });
                break;
            }

            default: {
                break;
            }
        }

        return result;
    };

    private handleProfileChanges = (closure: DialogResponseClosure, values: IDialogValues, payload: unknown): void => {
        if (closure === DialogResponseClosure.Accept) {
            const details = payload as { saveProfile: boolean; section: string };

            if (details.saveProfile) {
                const sectionId = details.section;
                const sectionValues = values.sections.get(sectionId)!.values;
                switch (sectionId) {
                    case "add": {
                        const profileName = sectionValues.profileName
                            .value as string;
                        const useExistingProfile =
                            sectionValues.copyProfile.value;
                        let baseProfile: ICommShellProfile | undefined;
                        if (useExistingProfile) {
                            const baseProfileName = sectionValues
                                .definedProfiles.value as string;
                            baseProfile = this.activeProfiles.find(
                                (item: ICommShellProfile) => { return item.name === baseProfileName; },
                            );
                        }
                        this.insertProfile(profileName, baseProfile);

                        break;
                    }

                    case "edit": {
                        const profile = this.activeProfiles.find(
                            (item: ICommShellProfile) => {
                                return item.name ===
                                    sectionValues.definedProfilesToEdit.value;
                            },
                        );
                        const tmpProfile = Object.assign({}, profile);
                        tmpProfile.name = sectionValues.profileNewName
                            .value as string;
                        const setDefault =
                            sectionValues.setAsDefaultProfile as boolean;
                        this.updateProfile(tmpProfile, setDefault);

                        break;
                    }

                    case "delete": {
                        const list = sectionValues.profileActivateDeactivate?.list;
                        this.deleteList = [];
                        list?.forEach((item) => {
                            const data = item.data as ICheckboxProperties;
                            if (data.checkState === 1) {
                                const profile = this.activeProfiles.find(
                                    (profile: ICommShellProfile) => {
                                        return String(profile.id) === data.id;
                                    },
                                );
                                if (profile) {
                                    this.deleteList.push(profile);
                                }
                            }
                        });
                        this.deleteProfileConfirm();

                        break;
                    }

                    default: {
                        break;
                    }
                }
            }
        }
    };

    private updateProfile = (profileToEdit: ICommShellProfile, setDefault: boolean): void => {
        ShellInterface.users.updateProfile(profileToEdit).then((event: ICommProfileEvent) => {
            if (!event.data?.result) {
                return;
            }

            const index = this.activeProfiles.findIndex(
                (item: ICommShellProfile) => { return item.id === event.data?.result?.id; },
            );

            if (index > -1) {
                Object.assign(this.activeProfiles[index], profileToEdit);
            }

            if (setDefault) {
                const defaultId = event.data.result?.id;
                ShellInterface.users.setDefaultProfile(webSession.userId, defaultId)
                    .then((event: ICommProfileEvent) => {
                        if (!event.data?.requestState || event.data.requestState.type !== "OK") {
                            return;
                        }

                        this.defaultProfile = this.activeProfiles.find((p) => {
                            return p.id === defaultId;
                        }) ?? this.defaultProfile;
                        this.sendUpdateProfileInfoMsg();
                        this.generatePopupMenuEntries();
                    });
            } else {
                this.sendUpdateProfileInfoMsg();
                this.generatePopupMenuEntries();
            }
        });
    };

    private deleteProfileConfirm = (): void => {
        const simpleListEntry = <Label dataId="data" />;
        const listElements = this.deleteList.map((item: ICommShellProfile) => {
            const labelContent: ILabelProperties = {
                caption: item.name,
            };

            return { data: labelContent };
        });

        const caption =
            "Are you sure you want to delete the selected profile" +
            (this.deleteList.length > 1 ? "s" : "");
        const content = (
            <Container orientation={Orientation.TopDown}>
                <Label caption={caption} />
                <List template={simpleListEntry} elements={listElements} />
            </Container>
        );

        if (this.confirmDialogRef.current) {
            this.confirmDialogRef.current.show(content, { refuse: "No", accept: "Yes" }, "Delete Profile");
        }
    };

    private handleProfileDelete = (closure: DialogResponseClosure): void => {
        if (closure === DialogResponseClosure.Accept) {
            this.deleteList.forEach((item: ICommShellProfile) => {
                ShellInterface.users.updateProfile(item).then((event: ICommProfileEvent) => {
                    if (!event.data?.result) {
                        return;
                    }
                    const index = this.activeProfiles.findIndex(
                        (item: ICommShellProfile) => { return item.id === event.data?.result?.id; },
                    );
                    if (index > -1) {
                        this.activeProfiles.splice(index, 1);
                    }
                    this.sendUpdateProfileInfoMsg();
                    this.generatePopupMenuEntries();
                });
            });
        }
    };

    private insertProfile = (profileName: string, baseProfile?: ICommShellProfile): void => {
        if (baseProfile) {
            ShellInterface.users.getProfile(baseProfile.id).then((event: ICommProfileEvent) => {
                if (!event.data?.result) {
                    return;
                }

                // Make a copy for the insertion.
                const newProfile: ICommShellProfile = {
                    ...event.data.result,
                    name: profileName,
                    id: -1,
                };

                ShellInterface.users.addProfile(newProfile).then((addEvent: ICommProfileEvent) => {
                    if (addEvent.data?.result) {
                        newProfile.id = addEvent.data.result.id;
                        this.activeProfiles.push(newProfile);
                        this.sendUpdateProfileInfoMsg();
                        this.generatePopupMenuEntries();
                    }
                });
            });
        } else {
            const newProfile: ICommShellProfile = {
                id: -1,
                userId: webSession.userId,
                name: profileName,
                description: "",
                options: webSession.profile.options,
            };

            ShellInterface.users.addProfile(newProfile).then((addEvent: ICommProfileEvent) => {
                if (!addEvent.data?.result) {
                    return;
                }

                newProfile.id = addEvent.data?.result.id;
                this.activeProfiles.push(newProfile);
                this.sendUpdateProfileInfoMsg();
                this.generatePopupMenuEntries();
            });
        }
    };

    private generateEditorConfig = (): IDialogValues => {
        const section1: IDialogSection = {
            caption: "Profile editor",
            contexts: ["add"],
            values: {
                profileName: {
                    caption: "New profile name:",
                    value: "",
                    placeholder: "<enter a unique profile name>",
                    span: 8,
                },
                copyProfile: {
                    caption: "Copy values from exiting profile",
                    value: false,
                    span: 8,
                },
                definedProfiles: {
                    caption: "Existing profiles",
                    value:
                        this.activeProfiles.length > 0
                            ? this.activeProfiles[0].name
                            : "",
                    choices: this.activeProfiles.map((item) => { return item.name; }),
                    options: [DialogValueOption.Disabled],
                    span: 8,
                },
            },
        };

        const section2: IDialogSection = {
            caption: "Profile editor",
            contexts: ["edit"],
            values: {
                profileNewName: {
                    caption: "Profile name:",
                    placeholder:
                        this.activeProfiles.find(
                            (p) => { return p.id === webSession.currentProfileId; },
                        )?.name ?? this.activeProfiles[0].name,
                    span: 8,
                },
                setAsDefaultProfile: {
                    caption: "default profile",
                    value:
                        this.activeProfiles.find(
                            (p) => { return p.id === webSession.currentProfileId; },
                        )?.id === this.defaultProfile.id,
                    span: 8,
                },
            },
        };

        const section3: IDialogSection = {
            caption: "Profile editor",
            contexts: ["delete"],
            values: {
                profileActivateDeactivate: {
                    caption: "Select profile from the list to activate or deactivate",
                    list: this.activeProfiles.map((item) => {
                        const result: ICheckboxProperties = {
                            id: item.id.toString(),
                            caption: item.name,
                            checkState: CheckState.Unchecked,
                        };

                        return { data: result };
                    }),
                    span: 8,
                },
            },
        };

        return {
            id: "newProfileDialog",
            sections: new Map<string, IDialogSection>([
                ["add", section1],
                ["edit", section2],
                ["delete", section3],
            ]),
        };
    };

    private sendUpdateProfileInfoMsg = (): void => {
        if (this.activeProfiles.length === 0) {
            return;
        }

        let currentProfileName = "";
        if (webSession.currentProfileId < 0) {
            // No session loaded yet. Use the default instead.
            currentProfileName = this.activeProfiles[0].name;
        } else {
            currentProfileName =
                this.activeProfiles.find(
                    (p) => { return p.id === webSession.currentProfileId; },
                )?.name ?? this.activeProfiles[0].name;
        }

        void requisitions.execute("updateStatusbar", [
            {
                id: "profileTitle",
                visible: true,
            },
            {
                id: "profileChoice",
                visible: true,
                text: currentProfileName,
                choices: this.activeProfiles.map((profile) => {
                    return {
                        label: profile.name,
                        data: { ...profile },
                    };
                }),
            },
            {
                id: "profileManage",
                visible: true,
            },
        ]);
    };

    private handleMenuItemClick = (e: React.MouseEvent, props: IMenuItemProperties): boolean => {
        if (!props.children || React.Children.count(props.children) === 0) {
            const value = parseInt(props.id ?? "", 10);
            const action = isNaN(value) ? props.id : "current";
            this.handleProfileAction(action || "", props.id || "");

            return true;
        }

        return false;
    };
}
