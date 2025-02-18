/*
 * Copyright (c) 2021, 2025, Oracle and/or its affiliates.
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

import { ComponentChild, createRef } from "preact";
import { Children } from "preact/compat";

import { IShellProfile } from "../communication/ProtocolGui.js";
import { ConfirmDialog } from "../components/Dialogs/ConfirmDialog.js";
import {
    CommonDialogValueOption, ICheckListDialogValue, IDialogSection, IDialogValidations, IDialogValues,
    ValueEditDialog,
} from "../components/Dialogs/ValueEditDialog.js";
import { CheckState, ICheckboxProperties } from "../components/ui/Checkbox/Checkbox.js";
import { ComponentBase, ComponentPlacement, IComponentState } from "../components/ui/Component/ComponentBase.js";
import { Container, Orientation } from "../components/ui/Container/Container.js";
import { Label } from "../components/ui/Label/Label.js";
import { Menu } from "../components/ui/Menu/Menu.js";
import { IMenuItemProperties, MenuItem } from "../components/ui/Menu/MenuItem.js";
import type { IStatusBarItem } from "../components/ui/Statusbar/StatusBarItem.js";
import { Assets } from "../supplement/Assets.js";
import { requisitions } from "../supplement/Requisitions.js";
import { ShellInterface } from "../supplement/ShellInterface/ShellInterface.js";
import { webSession } from "../supplement/WebSession.js";
import { DialogResponseClosure } from "./general-types.js";

interface IProfileSelectorState extends IComponentState {
    menuItems: ComponentChild[];
}

export class ProfileSelector extends ComponentBase<{}, IProfileSelectorState> {

    private profileDialogRef = createRef<ValueEditDialog>();
    private confirmDialogRef = createRef<ConfirmDialog>();

    private actionMenuRef = createRef<Menu>();
    private profileName = "";

    private deleteList: IShellProfile[] = [];
    private activeProfiles: IShellProfile[] = [];
    private defaultProfile?: IShellProfile;

    #profileSbEntry?: IStatusBarItem;

    public constructor(props: {}) {
        super(props);

        this.state = { menuItems: [] };
    }

    public override componentDidMount(): void {
        requisitions.register("profileLoaded", this.profileLoaded);

        /*this.#profileSbEntry = StatusBar.createStatusBarItem({
            id: "profileItem",
            text: "Profile:",
            priority: 999, // Most left item.
        });*/
    }

    public override componentWillMount(): void {
        this.#profileSbEntry?.dispose();
    }

    public open(currentTarget: DOMRect): void {
        this.actionMenuRef?.current?.open(currentTarget, false);
    }

    public render(): ComponentChild {
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
                    <MenuItem id="-" key="separator1" command={{ title: "-", command: "" }} />
                    <MenuItem
                        key="add"
                        command={{ title: "Add Profile", command: "add" }}
                        icon={Assets.misc.addIcon}
                    />
                    <MenuItem
                        key="edit"
                        command={{ title: "Edit Profile", command: "edit" }}
                        icon={Assets.misc.editIcon}
                    />
                    <MenuItem
                        key="delete"
                        command={{ title: "Delete Profile", command: "delete" }}
                        icon={Assets.misc.close2Icon}
                    />
                </Menu>
            </>
        );
    }

    private handleProfileAction = (action: string, profileId: string): void => {
        switch (action) {
            case "current": {
                void ShellInterface.users.getProfile(parseInt(profileId, 10)).then((profile) => {
                    if (profile) {
                        webSession.loadProfile(profile);
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

    private profileLoaded = async (): Promise<boolean> => {
        this.defaultProfile = (await ShellInterface.users.getDefaultProfile(webSession.userId)) ?? webSession.profile;
        await this.getProfileList(webSession.userId);

        this.generatePopupMenuEntries();
        this.sendUpdateProfileInfoMsg();

        return Promise.resolve(true);
    };

    private getProfileList = async (userId: number): Promise<void> => {
        const profiles = await ShellInterface.users.listProfiles(userId);
        this.activeProfiles = profiles.map((profile) => {
            return {
                id: profile.id,
                userId,
                name: profile.name,
                description: "",
                options: {},
            };
        });
    };

    private generatePopupMenuEntries = (): void => {
        const menuItems: ComponentChild[] = [];
        this.activeProfiles?.forEach(
            (value: IShellProfile, index: number) => {
                let icon;
                if (value.id === webSession.currentProfileId) {
                    icon = Assets.documents.overviewPageIcon;
                }

                if (value.id === this.defaultProfile?.id) {
                    icon = Assets.file.defaultIcon;
                }
                const menuItem = (
                    <MenuItem
                        key={`profile${index}`}
                        id={value.id.toString()}
                        command={{ title: value.name, command: "" }}
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

        const details = payload as { saveProfile: boolean; section: string; };
        const sectionId = details.section ?? "add";
        const sectionValues = values.sections.get(sectionId)!.values;
        switch (sectionId) {
            case "add": {
                const useExistingProfile = sectionValues.copyProfile.value;
                sectionValues.definedProfiles.options = !useExistingProfile ? [CommonDialogValueOption.ReadOnly] : [];
                if (useExistingProfile && (sectionValues.definedProfiles.value == null)) {
                    result.messages.databaseType = "Select one of the existing profile";
                }

                if (!sectionValues.profileName.value) {
                    if (closing) {
                        result.messages.profileName = "The profile name cannot be empty";
                    }
                } else {
                    const profileName = this.activeProfiles.find(
                        (element: IShellProfile): boolean => {
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
                    (item: IShellProfile) => {
                        return item.name === sectionValues.definedProfilesToEdit.value;
                    },
                );
                if (this.profileName !== profile?.name) {
                    this.profileName = profile?.name ?? "";
                    sectionValues.profileNewName.value = profile?.name;
                }

                if (this.defaultProfile?.id === profile?.id) {
                    sectionValues.setAsDefaultProfile.options = [CommonDialogValueOption.ReadOnly];
                    sectionValues.setAsDefaultProfile.value = true;
                } else {
                    sectionValues.setAsDefaultProfile.options = [];
                }

                if (!sectionValues.profileNewName.value) {
                    if (closing) {
                        result.messages.profileNewName = "The profile name cannot be empty";
                    }
                } else {
                    const profileNewName = this.activeProfiles.find((element: IShellProfile): boolean => {
                        return element.name === sectionValues.profileNewName.value && element.id !== profile?.id;
                    });

                    if (profileNewName && details.saveProfile) {
                        result.messages.profileNewName = "A profile with that name exists already";
                    }
                }
                break;
            }

            case "delete": {
                const value = sectionValues.profileActivateDeactivate as ICheckListDialogValue;
                const list = value.checkList;
                list?.forEach((item) => {
                    const data = item.data as ICheckboxProperties;
                    if (String(this.defaultProfile?.id) === data.id && data.checkState === CheckState.Checked) {
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
            const details = payload as { saveProfile: boolean; section: string; };

            if (details.saveProfile) {
                const sectionId = details.section;
                const sectionValues = values.sections.get(sectionId)!.values;
                switch (sectionId) {
                    case "add": {
                        const profileName = sectionValues.profileName
                            .value as string;
                        const useExistingProfile =
                            sectionValues.copyProfile.value;
                        let baseProfile: IShellProfile | undefined;
                        if (useExistingProfile) {
                            const baseProfileName = sectionValues
                                .definedProfiles.value as string;
                            baseProfile = this.activeProfiles.find(
                                (item: IShellProfile) => { return item.name === baseProfileName; },
                            );
                        }
                        this.insertProfile(profileName, baseProfile);

                        break;
                    }

                    case "edit": {
                        const profile = this.activeProfiles.find(
                            (item: IShellProfile) => {
                                return item.name ===
                                    sectionValues.definedProfilesToEdit.value;
                            },
                        );
                        const tmpProfile = Object.assign({}, profile);
                        tmpProfile.name = sectionValues.profileNewName
                            .value as string;
                        const setDefault = sectionValues.setAsDefaultProfile.value as boolean;
                        void this.updateProfile(tmpProfile, setDefault);

                        break;
                    }

                    case "delete": {
                        const value = sectionValues.profileActivateDeactivate as ICheckListDialogValue;
                        const list = value.checkList;
                        this.deleteList = [];
                        list?.forEach((item) => {
                            const data = item.data as ICheckboxProperties;
                            if (data.checkState === CheckState.Checked) {
                                const profile = this.activeProfiles.find(
                                    (profile: IShellProfile) => {
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

    private updateProfile = async (profileToEdit: IShellProfile, setDefault: boolean): Promise<void> => {
        const profile = await ShellInterface.users.updateProfile(profileToEdit);
        if (profile) {
            const index = this.activeProfiles.findIndex((item: IShellProfile) => {
                return item.id === profile.id;
            },
            );

            if (index > -1) {
                Object.assign(this.activeProfiles[index], profileToEdit);
            }

            if (setDefault) {
                await ShellInterface.users.setDefaultProfile(webSession.userId, profile.id);
                this.defaultProfile = this.activeProfiles.find((p) => {
                    return p.id === profile.id;
                }) ?? this.defaultProfile;
            }

            this.sendUpdateProfileInfoMsg();
            this.generatePopupMenuEntries();
        }
    };

    private deleteProfileConfirm = (): void => {
        const listElements = this.deleteList.map((item: IShellProfile, index) => {
            const id = `list${index}`;

            return <Label caption={item.name} id={id} key={id} />;
        });

        const caption = "Are you sure you want to delete the selected profile" +
            (this.deleteList.length > 1 ? "s" : "");
        const content = (
            <Container orientation={Orientation.TopDown}>
                <Label caption={caption} />
                <ul className={this.getEffectiveClassNames(["list"])}>
                    {listElements}
                </ul>
            </Container>
        );

        if (this.confirmDialogRef.current) {
            this.confirmDialogRef.current.show(content, { refuse: "No", accept: "Yes" }, "Delete Profile");
        }
    };

    private handleProfileDelete = (closure: DialogResponseClosure): void => {
        if (closure === DialogResponseClosure.Accept) {
            void this.doProfileDelete();
        }
    };

    private doProfileDelete = async (): Promise<void> => {
        for (const profile of this.deleteList) {
            await ShellInterface.users.deleteProfile(profile);
            const index = this.activeProfiles.findIndex(
                (item: IShellProfile) => { return item.id === profile.id; },
            );

            if (index > -1) {
                this.activeProfiles.splice(index, 1);
            }
        }

        this.sendUpdateProfileInfoMsg();
        this.generatePopupMenuEntries();
    };

    private insertProfile = (profileName: string, baseProfile?: IShellProfile): void => {
        if (baseProfile) {
            void ShellInterface.users.getProfile(baseProfile.id).then((profile) => {
                if (profile) {
                    // Make a copy for the insertion.
                    const newProfile: IShellProfile = {
                        ...profile,
                        name: profileName,
                        id: -1,
                    };

                    void ShellInterface.users.addProfile(newProfile).then((profileId) => {
                        if (profileId) {
                            newProfile.id = profileId;
                            this.activeProfiles.push(newProfile);
                            webSession.loadProfile(newProfile);
                            //this.sendUpdateProfileInfoMsg();
                            //this.generatePopupMenuEntries();
                        }
                    });
                }
            });
        } else {
            const newProfile: IShellProfile = {
                id: -1,
                userId: webSession.userId,
                name: profileName,
                description: "",
                options: webSession.profile.options,
            };

            void ShellInterface.users.addProfile(newProfile).then((profileId) => {
                if (profileId) {
                    newProfile.id = profileId;
                    this.activeProfiles.push(newProfile);
                    this.sendUpdateProfileInfoMsg();
                    this.generatePopupMenuEntries();
                }
            });
        }
    };

    private generateEditorConfig = (): IDialogValues => {
        const section1: IDialogSection = {
            caption: "Profile editor",
            contexts: ["add"],
            values: {
                profileName: {
                    type: "text",
                    caption: "New profile name:",
                    value: "",
                    placeholder: "<enter a unique profile name>",
                    horizontalSpan: 8,
                },
                copyProfile: {
                    type: "boolean",
                    caption: "Copy values from exiting profile",
                    value: false,
                    horizontalSpan: 8,
                },
                definedProfiles: {
                    type: "choice",
                    caption: "Existing profiles",
                    value:
                        this.activeProfiles.length > 0
                            ? this.activeProfiles[0].name
                            : "",
                    choices: this.activeProfiles.map((item) => { return item.name; }),
                    options: [CommonDialogValueOption.Disabled],
                    horizontalSpan: 8,
                },
            },
        };

        const section2: IDialogSection = {
            caption: "Profile editor",
            contexts: ["edit"],
            values: {
                profileNewName: {
                    type: "text",
                    caption: "Profile name:",
                    placeholder:
                        this.activeProfiles.find(
                            (p) => { return p.id === webSession.currentProfileId; },
                        )?.name ?? this.activeProfiles[0].name,
                    horizontalSpan: 8,
                },
                setAsDefaultProfile: {
                    type: "boolean",
                    caption: "default profile",
                    value:
                        this.activeProfiles.find(
                            (p) => { return p.id === webSession.currentProfileId; },
                        )?.id === this.defaultProfile?.id,
                    horizontalSpan: 8,
                },
            },
        };

        const section3: IDialogSection = {
            caption: "Profile editor",
            contexts: ["delete"],
            values: {
                profileActivateDeactivate: {
                    type: "checkList",
                    caption: "Select profile from the list to activate or deactivate",
                    checkList: this.activeProfiles.map((item) => {
                        const result: ICheckboxProperties = {
                            id: item.id.toString(),
                            caption: item.name,
                            checkState: CheckState.Unchecked,
                        };

                        return { data: result };
                    }),
                    horizontalSpan: 8,
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

        // TODO: update statusbar entry.
    };

    private handleMenuItemClick = (props: IMenuItemProperties): boolean => {
        if (!props.children || Children.count(props.children) === 0) {
            const command = props.command.command;
            const value = parseInt(command, 10);
            const action = isNaN(value) ? command : "current";
            this.handleProfileAction(action, command);

            return true;
        }

        return false;
    };
}
