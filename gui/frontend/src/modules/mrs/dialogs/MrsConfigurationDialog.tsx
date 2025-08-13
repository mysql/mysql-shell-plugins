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

import { DialogResponseClosure, IDialogRequest, IDictionary } from "../../../app-logic/general-types.js";
import { IMrsConfigData, IMrsStatusData, IStringDict } from "../../../communication/ProtocolMrs.js";
import { AwaitableValueEditDialog } from "../../../components/Dialogs/AwaitableValueEditDialog.js";
import {
    CommonDialogValueOption, IChoiceDialogValue, IDialogSection, IDialogValidations, IDialogValues,
} from "../../../components/Dialogs/ValueEditDialog.js";

export interface IMrsConfigurationDialogData extends IDictionary {
    version: string;
    enabled: boolean;
    options: IMrsConfigData;
    mrsAdminUser?: string;
    mrsAdminUserPassword?: string;
    performUpdate?: boolean;
}

export class MrsConfigurationDialog extends AwaitableValueEditDialog {
    protected override get id(): string {
        return "mrsConfigurationDialog";
    }

    public override async show(request: IDialogRequest): Promise<IDictionary | DialogResponseClosure> {
        const dialogValues = this.dialogValues(request);
        const result = await this.doShow(() => {
            return dialogValues;
        }, {
            title: "MySQL REST Service",
            contexts: request.parameters?.init ? ["init"] : ["config"],
        });

        if (result.closure === DialogResponseClosure.Accept) {
            return this.processResults(result.values);
        }

        return DialogResponseClosure.Cancel;
    }

    protected override validateInput = (closing: boolean, values: IDialogValues): IDialogValidations => {
        const result: IDialogValidations = {
            messages: {},
            requiredContexts: [],
        };

        if (closing) {
            const authSection = values.sections.get("authSection");
            if (authSection && this.dialog?.activeContexts.has("init")) {
                if (authSection.values.mrsAdminUser.value && !authSection.values.mrsAdminUserPassword.value) {
                    result.messages.mrsAdminUserPassword = "Please specify a password for the MRS Admin User.";
                } else if (authSection.values.mrsAdminUser.value
                    && authSection.values.mrsAdminUserPassword.value) {
                    // Enforce password strength
                    const pwd = (authSection.values.mrsAdminUserPassword.value as string);
                    if (pwd.length < 8) {
                        result.messages.mrsAdminUserPassword = "The minimum authentication string length is "
                            + "8 characters.";
                    } else {
                        const hasUpperCase = /[A-Z]/.test(pwd) ? 1 : 0;
                        const hasLowerCase = /[a-z]/.test(pwd) ? 1 : 0;
                        const hasNumbers = /\d/.test(pwd) ? 1 : 0;
                        const hasNonAlphas = /\W/.test(pwd) ? 1 : 0;
                        if (hasUpperCase + hasLowerCase + hasNumbers + hasNonAlphas < 4) {
                            result.messages.mrsAdminUserPassword = "The authentication string needs to contain at "
                                + "least one uppercase, lowercase, a special and a numeric character.";
                        }
                    }
                }

                if (authSection.values.mrsAdminCreation.value && !authSection.values.mrsAdminUser.value
                    && !authSection.values.mrsAdminUserPassword.value) {
                    result.messages.mrsAdminCreation = "Please specify a REST user name or disable this option to "
                        + "skip the creation of the default REST authentication app.";
                }
            }

            const optionsSection = values.sections.get("optionsSection");
            if (optionsSection) {
                if (optionsSection.values.options.value) {
                    try {
                        JSON.parse(optionsSection.values.options.value as string);
                    } catch {
                        result.messages.options = "Please provide a valid JSON object.";
                    }
                }
            }
        }

        return result;
    };

    private dialogValues(request: IDialogRequest): IDialogValues {
        if (request.values) {
            const values = request.values as IMrsConfigurationDialogData;
            const status = request.parameters?.status as IMrsStatusData;
            const versions = request.parameters?.versionsAvailable as string[] | undefined ?? [values.version];
            const showUpdateSelection = !request.parameters?.init && !request.parameters?.isCloudInstance
                && status.serviceUpgradeable;

            // Ensure that the version is actually in the list of available versions.
            if (!versions.includes(values.version)) {
                versions.push(values.version);
            }

            const mainSection: IDialogSection = {
                caption: request.title,
                values: {
                    enabled: {
                        type: "choice",
                        caption: "MySQL REST Service Status",
                        choices: ["Enabled", "Disabled"],
                        value: values.enabled ? "Enabled" : "Disabled",
                        horizontalSpan: 3,
                        description: "If set to disabled, all MySQL REST Service endpoints will be disabled.",
                    },
                    version: {
                        type: "choice",
                        caption: request.parameters?.init ? "Version" : "Current Version",
                        choices: versions,
                        value: values.version,
                        horizontalSpan: 2,
                        options: request.parameters?.init ? [] : [
                            CommonDialogValueOption.Disabled,
                        ],
                        description: "The version of the MySQL REST Service metadata schema.",
                    },
                },
            };

            // Do not show the upgrade checkbox during initial configuration and
            // do not show it for cloud instances
            if (showUpdateSelection) {
                const updateToVersions = versions.slice();
                const currentVersionIndex = updateToVersions.indexOf(values.version);
                if (currentVersionIndex > -1) {
                    updateToVersions.length = currentVersionIndex;
                }
                updateToVersions.push("No Update");

                mainSection.values.updateToVersion = {
                    type: "choice",
                    caption: "Update to Version",
                    choices: updateToVersions,
                    value: updateToVersions[0],
                    horizontalSpan: 3,
                    description: "The version to update to MySQL REST Service metadata schema to.",
                };
            } else if (request.parameters?.init) {
                mainSection.values.info = {
                    type: "description",
                    caption: "The MySQL REST Service will be configured using the selected version.",
                    horizontalSpan: 3,
                };
            } else if (request.parameters?.isCloudInstance) {
                mainSection.values.info = {
                    type: "description",
                    caption: "Version upgrades for this instance are managed by the cloud vendor.",
                    horizontalSpan: 3,
                };
            } else if (status.serviceUpgradeIgnored) {
                mainSection.values.info = {
                    type: "description",
                    caption: "The current MySQL REST Service update is being skipped.",
                    horizontalSpan: 3,
                };
            } else {
                mainSection.values.info = {
                    type: "description",
                    caption: "The MySQL REST Service metadata schema is up to date.",
                    horizontalSpan: 3,
                };
            }

            const authSection: IDialogSection = {
                contexts: ["init"],
                caption: "Authentication",
                groupName: "group1",
                values: {
                    mrsAdminCreation: {
                        type: "boolean",
                        caption: "Create default REST authentication app",
                        value: true,
                        description: "Select this option to create a REST authentication app using the built-in MRS "
                            + "vendor. REST authentication apps are required to allow end users to login into the "
                            + "MySQL REST Service and access REST endpoints that require authentication.",
                        horizontalSpan: 8,
                    },
                    mrsAdminUser: {
                        type: "text",
                        caption: "REST User Name",
                        value: "",
                        horizontalSpan: 4,
                        description: "The user name of the REST user account. This account will be enabled to login "
                            + "into the MySQL REST Service and access all REST endpoints of the linked REST services.",
                        options: [
                            CommonDialogValueOption.AutoFocus,
                        ],
                    },
                    mrsAdminUserPassword: {
                        type: "text",
                        caption: "REST User Password",
                        obfuscated: true,
                        value: "",
                        horizontalSpan: 4,
                        description: "The password of the REST user account.",
                    },
                },
            };

            const authThrottlingSection: IDialogSection = {
                contexts: ["config"],
                caption: "Authentication Throttling",
                groupName: "group1",
                values: {
                    throttlingPerAccountSep: {
                        type: "separator",
                        caption: "Per-Account Throttling",
                        horizontalSpan: 3,
                    },
                    throttlingPerHostSep: {
                        type: "separator",
                        caption: "Per-Host Throttling",
                        horizontalSpan: 3,
                    },
                    throttlingSep: {
                        type: "separator",
                        caption: "Throttling General",
                        horizontalSpan: 2,
                    },
                    perAccountMinimumTimeBetweenRequestsInMs: {
                        type: "number",
                        caption: "Minimum Time Between Requests",
                        value: values.options.authentication?.throttling?.perAccount?.minimumTimeBetweenRequestsInMs,
                        placeholder: 1500,
                        horizontalSpan: 3,
                        description: "Sets the minimum time between connection attempts. The value is given in "
                            + "milliseconds.",
                    },
                    perHostMinimumTimeBetweenRequestsInMs: {
                        type: "number",
                        caption: "Minimum Time Between Requests",
                        value: values.options.authentication?.throttling?.perHost?.minimumTimeBetweenRequestsInMs,
                        placeholder: 1500,
                        horizontalSpan: 3,
                        description: "Sets the minimum time between connection attempts for a give host. The value is "
                            + "given in ms.",
                    },
                    blockWhenAttemptsExceededInSeconds: {
                        type: "number",
                        caption: "Block Timeout",
                        value: values.options.authentication?.throttling?.blockWhenAttemptsExceededInSeconds,
                        placeholder: 120,
                        horizontalSpan: 2,
                        verticalSpan: 2,
                        description: "Sets the amount of time the account or client host will be blocked from "
                            + "authentication. The value is given in seconds.",
                    },
                    perAccountMaximumAttemptsPerMinute: {
                        type: "number",
                        caption: "Maximum Attempts Per Minute",
                        value: values.options.authentication?.throttling?.perAccount?.maximumAttemptsPerMinute,
                        placeholder: 5,
                        horizontalSpan: 3,
                        description: "Sets the maximum amount of attempts per minute per client. "
                            + "Further attempts will be blocked.",
                    },
                    perHostMaximumAttemptsPerMinute: {
                        type: "number",
                        caption: "Maximum Attempts Per Minute",
                        value: values.options.authentication?.throttling?.perHost?.maximumAttemptsPerMinute,
                        placeholder: 5,
                        horizontalSpan: 3,
                        description: "Sets the maximum amount of attempts per minute for a given host.",
                    },
                },
            };

            delete values.options.authentication;

            const cacheSection: IDialogSection = {
                contexts: ["config"],
                caption: "Caches",
                groupName: "group1",
                values: {
                    responseCacheMaxCacheSize: {
                        type: "text",
                        caption: "Endpoint Response Cache",
                        value: values.options.responseCache?.maxCacheSize ?? "",
                        horizontalSpan: 4,
                        description: "Global options for the REST endpoint response cache, which keeps an in-memory "
                            + "cache of responses to GET requests on tables, views, procedures and functions. To "
                            + "enable caching of an endpoint, you must also set the cacheTimeToLive option for each "
                            + "object to be cached.",
                        placeholder: "1M",
                    },
                    fileCacheMaxCacheSize: {
                        type: "text",
                        caption: "Static File Cache",
                        value: values.options.fileCache?.maxCacheSize ?? "",
                        horizontalSpan: 4,
                        description: "Global options for the static file data cache, which keeps an in-memory cache "
                            + "of responses to GET requests on content set files. Maximum size of the cache. Default "
                            + "is 1M.",
                        placeholder: "1M",
                    },
                    gtidCacheEnable: {
                        type: "boolean",
                        caption: "GTID Cache",
                        value: values.options.gtid?.cache?.enable ?? false,
                        horizontalSpan: 2,
                        description: "Enables the Global Transaction Id (GTID) cache. GTIDs are used to "
                            + "ensure a given commit can be read on secondary instances.",
                    },
                    gtidCacheRefreshRate: {
                        type: "number",
                        caption: "Refresh Rate",
                        value: values.options.gtid?.cache?.refreshRate,
                        horizontalSpan: 3,
                        description: "Defines how often the GTID cache will be refreshed on MySQL Router instances. "
                            + "The value has to be set in seconds, e.g. 5.",
                    },
                    gtidCacheRefreshWhenIncreasesBy: {
                        type: "number",
                        caption: "Refresh When Increased",
                        value: values.options.gtid?.cache?.refreshWhenIncreasesBy,
                        horizontalSpan: 3,
                        description: "In addition to the time based refresh, the GTID cache can also be refreshed "
                            + "based on the number of transactions that happened since the last refresh. Set in number "
                            + "of transactions, e.g. 500.",
                    },
                },
            };

            delete values.options.responseCache;
            delete values.options.fileCache;
            delete values.options.gtid;

            const contentRedirectSection: IDialogSection = {
                contexts: ["config"],
                caption: "Redirects & Static Content",
                groupName: "group1",
                values: {
                    directoryIndexDirective: {
                        type: "set",
                        caption: "Endpoint Response Cache",
                        value: values.options.directoryIndexDirective,
                        tagSet: values.options.directoryIndexDirective ?? ["index.html"],
                        horizontalSpan: 8,
                        description: "Holds an ordered list of files that should be returned when a directory path "
                            + "has been requested. The first matching file that is available will be returned.",
                    },
                    defaultStaticContent: {
                        type: "matrix",
                        caption: "Endpoint Response Cache",
                        value: values.options.defaultStaticContent,
                        horizontalSpan: 4,
                        description: "Allows the definition of static content for the root path / that will be "
                            + "returned for file paths matching the given JSON keys. A JSON key index.html will be "
                            + "served as /index.html by the MySQL Router.",
                    },
                    defaultRedirects: {
                        type: "matrix",
                        caption: "Default Redirects",
                        value: values.options.defaultRedirects,
                        horizontalSpan: 4,
                        description: "Is used to define internal redirects performed by the MySQL Router. This "
                            + "can be used to expose content of a REST service on the root path /. A JSON key "
                            + "index.html holding the value /myService/myContentSet/index.html will exposed the "
                            + "corresponding file from the given path as /index.html.",
                    },
                },
            };

            delete values.options.directoryIndexDirective;
            delete values.options.defaultStaticContent;
            delete values.options.defaultRedirects;

            let optionsStr = JSON.stringify(values.options);
            if (optionsStr === "{}") {
                optionsStr = "";
            }

            const optionsSection: IDialogSection = {
                contexts: ["config"],
                caption: "Options",
                groupName: "group1",
                values: {
                    options: {
                        type: "text",
                        caption: "Options:",
                        value: optionsStr,
                        horizontalSpan: 8,
                        multiLine: true,
                        multiLineCount: 12,
                        description: "Additional options in JSON format",
                    },
                },
            };

            return {
                id: "mainSection",
                sections: new Map<string, IDialogSection>([
                    ["mainSection", mainSection],
                    ["authSection", authSection],
                    ["authThrottlingSection", authThrottlingSection],
                    ["cacheSection", cacheSection],
                    ["contentRedirectSection", contentRedirectSection],
                    ["optionsSection", optionsSection],
                ]),
            };
        } else {
            return { id: "", sections: new Map<string, IDialogSection>([]) };
        }
    }

    private processResults = (dialogValues: IDialogValues): IDictionary => {
        const mainSection = dialogValues.sections.get("mainSection");
        const authSection = dialogValues.sections.get("authSection");
        const authThrottlingSection = dialogValues.sections.get("authThrottlingSection");
        const optionsSection = dialogValues.sections.get("optionsSection");
        const contentRedirectSection = dialogValues.sections.get("contentRedirectSection");
        const cacheSection = dialogValues.sections.get("cacheSection");

        if (mainSection && authThrottlingSection && optionsSection && authSection && contentRedirectSection
            && cacheSection) {
            let options: IMrsConfigData;
            try {
                options = JSON.parse(optionsSection.values.options.value as string) as IMrsConfigData;
            } catch {
                options = {};
            }

            const val = authThrottlingSection.values;

            options = {
                ...options,
                authentication: {
                    throttling: {
                        perAccount: {
                            minimumTimeBetweenRequestsInMs:
                                val.perAccountMinimumTimeBetweenRequestsInMs.value
                                    ? val.perAccountMinimumTimeBetweenRequestsInMs.value as number
                                    : undefined,
                            maximumAttemptsPerMinute:
                                val.perAccountMaximumAttemptsPerMinute.value
                                    ? val.perAccountMaximumAttemptsPerMinute.value as number
                                    : undefined,
                        },
                        perHost: {
                            minimumTimeBetweenRequestsInMs:
                                val.perHostMinimumTimeBetweenRequestsInMs.value
                                    ? val.perHostMinimumTimeBetweenRequestsInMs.value as number
                                    : undefined,
                            maximumAttemptsPerMinute:
                                val.perHostMaximumAttemptsPerMinute.value
                                    ? val.perHostMaximumAttemptsPerMinute.value as number
                                    : undefined,
                        },
                        blockWhenAttemptsExceededInSeconds:
                            val.blockWhenAttemptsExceededInSeconds.value
                                ? val.blockWhenAttemptsExceededInSeconds.value as number
                                : undefined,
                    },
                },
                responseCache: {
                    maxCacheSize: cacheSection.values.responseCacheMaxCacheSize.value
                        ? cacheSection.values.responseCacheMaxCacheSize.value as string
                        : undefined,
                },
                fileCache: {
                    maxCacheSize: cacheSection.values.fileCacheMaxCacheSize.value
                        ? cacheSection.values.fileCacheMaxCacheSize.value as string
                        : undefined,
                },
                gtid: {
                    cache: {
                        enable: cacheSection.values.gtidCacheEnable.value ? true : false,
                        refreshRate: cacheSection.values.gtidCacheRefreshRate.value
                            ? cacheSection.values.gtidCacheRefreshRate.value as number
                            : undefined,
                        refreshWhenIncreasesBy: cacheSection.values.gtidCacheRefreshWhenIncreasesBy.value
                            ? cacheSection.values.gtidCacheRefreshWhenIncreasesBy.value as number
                            : undefined,
                    },
                },
            };

            // Add the defaultStaticContent
            options = {
                ...options,
                defaultStaticContent: contentRedirectSection.values.defaultStaticContent.value as IStringDict,
            };

            // Add the defaultRedirects
            options = {
                ...options,
                defaultRedirects: contentRedirectSection.values.defaultRedirects.value as IStringDict,
            };

            // add the directoryIndexDirective
            options = {
                ...options,
                directoryIndexDirective: contentRedirectSection.values.directoryIndexDirective.value as string[],
            };

            let updateToVersion: IChoiceDialogValue | undefined;
            if ("updateToVersion" in mainSection.values) {
                updateToVersion = mainSection.values.updateToVersion as IChoiceDialogValue;
            }

            const values: IMrsConfigurationDialogData = {
                enabled: mainSection.values.enabled.value === "Enabled",
                version: updateToVersion?.value
                    && updateToVersion.value !== "No Update"
                    ? updateToVersion.value
                    : mainSection.values.version.value as string,
                options,
                mrsAdminUser: authSection.values.mrsAdminCreation.value && authSection.values.mrsAdminUser.value
                    ? authSection.values.mrsAdminUser.value as string
                    : undefined,
                mrsAdminUserPassword: authSection.values.mrsAdminCreation.value
                    && authSection.values.mrsAdminUserPassword.value
                    ? authSection.values.mrsAdminUserPassword.value as string
                    : undefined,
                performUpdate: updateToVersion?.value
                    && updateToVersion.value !== "No Update"
                    ? true
                    : undefined,
            };

            return values;
        }

        return {};
    };
}
