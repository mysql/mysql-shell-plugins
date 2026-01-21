/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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
 * separately licensed software that they have included with
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

import * as types from "./types.js";

export const notification = {
    exists: ".notificationCenter [id*='toast-']",
    type: ".codicon",
    message: "label",
    close: ".closeButton"
};

export const passwordDialog = {
    exists: ".passwordDialog",
    title: ".title .label",
    cancel: "#cancel",
    ok: "#ok",
    items: "div.grid > div",
    itemsText: ".resultText span",
    password: "input", // role
};

export const confirmDialog = {
    exists: ".confirmDialog",
    ok: "#ok",
    accept: "#accept",
    refuse: "#refuse",
    alternative: "#alternative",
    title: ".title label",
    message: "#dialogMessage",
    cancel: "#alternative",
};

export const mainPage = {
    content: ".migration-sub-app",
    sourceInfoItem: ".source-info > div",
    back: `div[caption="Back"]`,
    next: `div[caption="Next"]`,
    startMigration: `div[caption="Start Migration Process"]`,
    abortMigration: `div[caption="Abort"]`,
    loadingIcon: "#backend-request-overlay .progressIndicatorHost, .target-selection .progressIndicatorHost",
    tile: {
        root: ".tile",
        name: "h4",
        subSteps: {
            item: {
                name: ".sub-steps .sub-step",
                status: "span, svg"
            }
        }
    },
    currentHeader: "#steps .header",
};

export const steps = {
    section: {
        root: "#steps .section",
        toggle: ".sub-header > .icon",
        caption: ".caption",
        status: ".caption .icon",
        description: ".content p",
    },
    targetSelection: {
        signUp: `[caption="Sign Up to OCI"]`,
        signIn: `[caption="OCI Sign In"]`,
        copySignInLink: ".oci-sign-in span",
        ociProfile: {
            box: "#profile",
            selectList: {
                exists: "#profilePopup",
                getItem: (id: string) => {
                    return `#${id}`;
                },
            },
        },
        ociCompartment: {
            box: "#hosting\\.compartmentId",
            selectList: {
                exists: "#hosting\\.compartmentIdPopup",
                item: "label"
            },
        },
        ociNetwork: {
            box: "#oci-networking",
            selectList: {
                exists: "#oci-networkingPopup",
                getItem: (id: string) => {
                    return `#${id}`;
                },
            }
        },
        networkCompartment: {
            box: "#hosting\\.networkCompartmentId",
            selectList: {
                exists: "#hosting\\.networkCompartmentIdPopup",
                item: "label",
            }
        },
        vcn: {
            box: "#hosting\\.vcnId",
            selectList: {
                exists: "#hosting\\.vcnIdPopup",
                item: "label",
            }
        },
        privateSubnet: {
            box: "#hosting\\.privateSubnet\\.id",
            selectList: {
                exists: "#hosting\\.privateSubnet\\.idPopup",
                item: "label",
            }
        },
        publicSubnet: {
            box: "#hosting\\.publicSubnet\\.id",
            selectList: {
                exists: "#hosting\\.publicSubnet\\.idPopup",
                item: "label",
            }
        },
        configTemplate: {
            box: "#hosting\\.configTemplate",
            selectList: {
                exists: "#hosting\\.configTemplatePopup",
                item: "label",
            }
        },
        dbSystemShape: "database\\.shapeName",
        jumpHostShape: ".hosting\\.shapeName .dropdown",
        diskSize: "#database\\.storageSizeGB",
        setupType: {
            box: ".database\\.enableHA .dropdown",
            selectList: {
                exists: "#Popup",
                item: "label",
            }
        },
        heatWaveShape: {
            box: ".database\\.heatWaveShapeName",
            selectList: {
                exists: "#database\\.heatWaveShapeNamePopup",
                getItem: (id: string) => {
                    return `#${id}`;
                },
            }
        },
        heatWaveNodes: "#database\\.heatWaveClusterSize",
        displayName: "#database\\.name",
        contactEmails: "#database\\.contactEmails",
        adminUsername: "#database\\.adminUsername",
        password: "#database\\.adminPassword",
        confirmPassword: "#database\\.adminPasswordConfirm",
    },
    migrationType: {
        type: ".migration-type-radios .radioButton",
        networkConnectivity: {
            box: "#connectivity",
            selectList: {
                exists: "#connectivityPopup",
                getItem: (item: types.NetworkConnectivity) => {
                    return `#${item}`;
                }
            }
        }
    },
    schemaCompatibilityChecks: {
        issue: {
            exists: ".issues > li",
            title: ".title",
            icon: ".icon",
            showDetails: `[data-tooltip="Show details"]`,
            description: ".description",
            resolution: {
                box: ".choice",
                boxValue: ".choice > label",
                issueResolution: ".issue-resolution",
                selectList: {
                    exists: ".popupPortal",
                    getItem: (item: string) => {
                        return `#${item}`;
                    }
                }
            }
        }
    },
    previewMigrationPlan: {
        readyNotice: ".ready-notice",
        explanation: ".explanation",
    },
    databaseReady: {
        explanation: {
            title: ".explanation > h3",
            details: ".explanation p"
        },
        code: ".finalize-info > code",
        copyButton: ".finalize-info .button",
        link: "p a",
        checkbox: ".checkbox",
        deleteOciResources: `[caption="Delete Selected OCI Resources"]`
    }
};

export const finalize = {
    checkBox: ".checkbox",
    link: "a",
    deleteOciResources: "[caption='Delete Selected OCI Resources']"
};