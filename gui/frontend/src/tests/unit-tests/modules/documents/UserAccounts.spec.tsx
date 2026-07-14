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

import { render, fireEvent, waitFor, screen, within } from "@testing-library/preact";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cloneElement, createRef, type VNode } from "preact";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

import { UserAccounts } from "../../../../modules/db-editor/UserAccounts.js";
import type { IUserAccountsState } from "../../../../modules/db-editor/UserAccounts.js";
import { CreateUserDialog } from "../../../../modules/db-editor/CreateUserDialog.js";
import { registerUiLayer } from "../../../../app-logic/UILayer.js";
import { DialogHost } from "../../../../app-logic/DialogHost.js";
import { ShellInterfaceSqlEditor } from "../../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import type {
    IMySQLGlobalPrivilegeCatalogItem,
    IMySQLUser,
    IMySQLUserListItem,
    IMySQLUserListItemSSLOptions,
    IObjectPrivilegeTarget,
} from "../../../../communication/ProtocolGui.js";

import {
    CommonDialogValueOption,
    type IDialogValues,
    ValueEditDialog,
} from "../../../../components/Dialogs/ValueEditDialog.js";
import { DialogResponseClosure, DialogType } from "../../../../app-logic/general-types.js";
import { requisitions } from "../../../../supplement/Requisitions.js";
import type { IToolbarItems } from "../../../../modules/db-editor/index.js";
import type { IMenuItemProperties } from "../../../../components/ui/Menu/MenuItem.js";
import type { CellComponent, RowComponent } from "tabulator-tables";
import { uiLayerMock } from "../../__mocks__/UILayerMock.js";

const readFrontendSourceFile = (path: string): string => {
    // eslint-disable-next-line no-restricted-syntax
    let directory = process.cwd();

    for (let i = 0; i < 8; i++) {
        const candidate = join(directory, path);

        if (existsSync(candidate)) {
            return readFileSync(candidate, "utf-8");
        }

        directory = join(directory, "..");
    }

    throw new Error(`Could not find frontend source file: ${path}`);
};

// Minimal helper to build a CellComponent-like stub for formatter testing.
const makeCell = (row: Partial<IMySQLUserListItem>, value?: unknown, field = "") => {
    return {
        getRow: () => {
            return {
                getData: () => {
                    return row;
                },
            } as unknown as RowComponent;
        },
        getColumn: () => {
            return {
                getField: () => {
                    return field;
                },
            };
        },
        getValue: () => {
            return value;
        },
    } as unknown as CellComponent;
};

type ITestUserRow = IMySQLUserListItem & {
    id: string;
    account: string;
    ssl?: string | null;
};

const baseRow = (overrides: Partial<ITestUserRow> = {}): ITestUserRow => {
    const account = overrides.user ?? "root@localhost";
    const separator = account.lastIndexOf("@");

    return {
        id: overrides.id ?? "u-1",
        account: overrides.account ?? "u-1",
        user: separator === -1 ? account : account.slice(0, separator),
        host: overrides.host ?? (separator === -1 ? "%" : account.slice(separator + 1)),
        accountLocked: overrides.accountLocked ?? false,
        temporarilyLocked: overrides.temporarilyLocked ?? false,
        plugin: overrides.plugin ?? "mysql_native_password",
        isRole: overrides.isRole ?? false,
        ssl: overrides.ssl ?? "",
        sslOptions: overrides.sslOptions ?? null,
        roles: overrides.roles ?? [],
        defaultRoles: overrides.defaultRoles ?? [],
        globalPrivileges: overrides.globalPrivileges ?? [],
        passwordExpired: overrides.passwordExpired ?? false,
        schemaPrivileges: overrides.schemaPrivileges ?? {},
        tablePrivileges: overrides.tablePrivileges ?? [],
        columnPrivileges: overrides.columnPrivileges ?? [],
        routinePrivileges: overrides.routinePrivileges ?? [],
        partialRevokes: overrides.partialRevokes ?? {},
        passwordExpiration: overrides.passwordExpiration ?? null,
    };
};

const baseUserDetails = (overrides: Partial<IMySQLUser> = {}): IMySQLUser => {
    return {
        host: overrides.host ?? "localhost",
        user: overrides.user ?? "root",
        sslType: overrides.sslType ?? "",
        sslCipher: overrides.sslCipher ?? "",
        x509Issuer: overrides.x509Issuer ?? "",
        x509Subject: overrides.x509Subject ?? "",
        maxQuestions: overrides.maxQuestions ?? 0,
        maxUpdates: overrides.maxUpdates ?? 0,
        maxConnections: overrides.maxConnections ?? 0,
        maxUserConnections: overrides.maxUserConnections ?? 0,
        plugin: overrides.plugin ?? "mysql_native_password",
        passwordExpire: overrides.passwordExpire ?? false,
        passwordLastChanged: overrides.passwordLastChanged ?? "2100-10-01T00:00:00Z",
        passwordLifetime: overrides.passwordLifetime ?? 0,
        accountLocked: overrides.accountLocked ?? false,
        passwordReuseHistory: overrides.passwordReuseHistory ?? 0,
        passwordReuseInterval: overrides.passwordReuseInterval ?? 0,
        passwordRequireCurrent: overrides.passwordRequireCurrent ?? false,
        comment: overrides.comment ?? null,
        failedLoginAttempts: overrides.failedLoginAttempts ?? 0,
        passwordLockTime: overrides.passwordLockTime ?? null,
    };
};

// Helper to access private methods in a type-safe way without using `any`.
const getPrivate = <T,>(obj: unknown, key: string): T => {
    return (obj as Record<string, unknown>)[key] as T;
};

interface ObjectPrivilegeFixtureTarget {
    id: string;
    kind: "schema" | "table" | "routine" | "column";
    schema: string;
    table?: string;
    routine?: string;
    routineType?: "FUNCTION" | "PROCEDURE";
    column?: string;
}

const currentObjectTargetId = (target: ObjectPrivilegeFixtureTarget): string => {
    return target.kind === "routine"
        ? JSON.stringify([target.kind, target.schema, target.routine, target.routineType])
        : JSON.stringify([target.kind, target.schema, target.table, target.column]);
};

const currentObjectPrivilegeMapKey = (target: ObjectPrivilegeFixtureTarget): string => {
    if (target.kind === "schema") {
        return target.schema;
    }

    return target.kind === "routine"
        ? JSON.stringify([target.kind, target.schema, target.routine, target.routineType])
        : JSON.stringify([target.kind, target.schema, target.table, target.routine, target.column]);
};

const legacyObjectPrivilegeMapKey = (target: ObjectPrivilegeFixtureTarget): string => {
    if (target.kind === "schema") {
        return target.schema;
    }
    if (target.kind === "column") {
        return `${target.schema}.${target.table}(${target.column})`;
    }

    return `${target.schema}.${target.table ?? target.routine}`;
};

const normalizeObjectPrivilegeFixture = (data: Record<string, unknown>): Record<string, unknown> => {
    const targets = (data.targets as ObjectPrivilegeFixtureTarget[]).map((target) => {
        return { ...target, id: currentObjectTargetId(target) };
    });
    const maps = new Map(targets.map((target) => {
        return [legacyObjectPrivilegeMapKey(target), currentObjectPrivilegeMapKey(target)];
    }));
    const normalizePrivileges = (privileges: Record<string, Record<string, string[]>>) => {
        return Object.fromEntries(["schema", "table", "routine", "column"].map((kind) => {
            const entries = privileges[kind] ?? {};
            const normalizedEntries = Object.fromEntries(Object.entries(entries).map(([key, value]) => {
                return [maps.get(key) ?? key, value];
            }));
            targets.filter((target) => {
                return target.kind === kind;
            }).forEach((target) => {
                normalizedEntries[currentObjectPrivilegeMapKey(target)] ??= [];
            });

            return [kind, normalizedEntries];
        }));
    };
    const selectedTarget = (data.selectedTargetId as string | undefined);
    const legacyIds = new Map((data.targets as ObjectPrivilegeFixtureTarget[]).map((target) => {
        return [target.id, currentObjectTargetId(target)];
    }));
    const normalized: Record<string, unknown> = { ...data, targets };
    ["privileges", "originalPrivileges", "directPrivileges", "inheritedPrivileges", "roleInheritedPrivileges",
        "restrictedPrivileges", "readonlyPrivileges"].forEach((key) => {
        const privileges = data[key] as Record<string, Record<string, string[]>> | undefined;
        normalized[key] = normalizePrivileges(privileges ?? { schema: {}, table: {}, routine: {}, column: {} });
    });
    if (selectedTarget) {
        normalized.selectedTargetId = legacyIds.get(selectedTarget) ?? selectedTarget;
    }

    return normalized;
};

const ensureElement = (node: HTMLElement | string): HTMLElement => {
    if (typeof node === "string") {
        throw new Error("Expected HTMLElement, got string");
    }

    return node;
};

const setDialogValue = (values: IDialogValues, section: string, key: string, value: unknown): void => {
    const entry = values.sections.get(section);
    if (!entry) {
        throw new Error(`Missing dialog section: ${section}`);
    }

    const target = entry.values[key] as { value?: unknown } | undefined;
    if (!target) {
        throw new Error(`Missing dialog value: ${section}.${key}`);
    }

    target.value = value;
};

const makeRow = (row: Partial<IMySQLUserListItem>): RowComponent => {
    return {
        getData: () => {
            return row;
        },
    } as unknown as RowComponent;
};

type TestEvent = Event & {
    preventDefault: ReturnType<typeof vi.fn>;
    stopPropagation: ReturnType<typeof vi.fn>;
};

const makeEvent = (target?: EventTarget): TestEvent => {
    return {
        target,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
    } as unknown as TestEvent;
};

const uiLayerMockFunctions = uiLayerMock as typeof uiLayerMock & {
    confirm: ReturnType<typeof vi.fn>;
    showErrorMessage: ReturnType<typeof vi.fn>;
};

const makeUserAccountPill = (): HTMLElement => {
    const target = document.createElement("span");
    target.className = "userAccountPill";

    return target;
};

type TestSorter = (
    a: unknown,
    b: unknown,
    aRow: RowComponent,
    bRow: RowComponent,
    column: unknown,
    dir: "asc" | "desc",
    sorterParams: {},
) => number;

describe("UserAccounts module", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        registerUiLayer(uiLayerMock);
        vi.clearAllMocks();
        uiLayerMockFunctions.confirm.mockImplementation((_message: string, yes: string) => {
            return Promise.resolve(yes);
        });
        vi.spyOn(DialogHost, "showDialog").mockResolvedValue({ closure: DialogResponseClosure.Accept });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("renders and loads users on mount", async ({ expect }) => {
        const rows: IMySQLUserListItem[] = [
            baseRow({ id: "1", user: "alice@%", roles: ["reader"] }),
            baseRow({
                id: "2",
                user: "bob@localhost",
                accountLocked: true,
                sslOptions: { requiresCertificate: true } as IMySQLUserListItemSSLOptions,
                globalPrivileges: ["SELECT"],
                passwordExpiration: "2100-10-01T00:00:00Z",
            }),
        ];

        const backend1 = new ShellInterfaceSqlEditor();
        const listSpy = vi.spyOn(backend1, "listMySQLUsers").mockResolvedValue(rows);
        const authenticationPluginsSpy = vi.spyOn(backend1, "listMySQLAuthenticationPlugins")
            .mockResolvedValue(["caching_sha2_password", "auth_socket"]);
        vi.spyOn(backend1, "isPartialRevokesEnabled").mockResolvedValue(false);
        vi.spyOn(backend1, "execute").mockResolvedValue({
            rows: [["validate_password.length", "8"]],
        });
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const { container, unmount } = render(
            <UserAccounts
                backend={backend1}
                toolbarItems={toolbarItems}
            />,
        );

        // Wait until listMySQLUsers was called once
        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
        });
        expect(authenticationPluginsSpy).toHaveBeenCalledTimes(1);

        // Basic structural checks
        expect(container.querySelector("#userAccountsToolbar")).toBeTruthy();
        expect(container.querySelector("#userAccountsGrid")).toBeTruthy();
        // Title label
        expect(screen.getByText("User Accounts")).toBeTruthy();
        await waitFor(() => {
            expect(screen.getByTestId("userAccountsTotal").textContent).toBe("2 accounts");
            expect(screen.getByTestId("summaryTotal").textContent).toBe("2");
            expect(screen.getByTestId("summaryExpiredPasswords").textContent).toBe("1");
            expect(screen.getByTestId("summaryPasswordValidation").textContent).toBe("On");
        });
        expect(screen.queryByTestId("summaryLocked")).toBeNull();
        expect(screen.queryByTestId("summarySslRequired")).toBeNull();
        expect(screen.queryByTestId("summaryPrivileged")).toBeNull();

        unmount();
    });

    it("stores authentication plugins loaded with the user account page", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        vi.spyOn(backend, "listMySQLAuthenticationPlugins").mockResolvedValue(["auth_socket"]);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        const { unmount } = render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);

        await waitFor(() => {
            expect(getPrivate<IUserAccountsState>(ref.current, "state").authenticationPlugins)
                .toEqual(["auth_socket"]);
        });

        unmount();
    });

    it("renders users before password validation probe completes", async ({ expect }) => {
        const rows: IMySQLUserListItem[] = [
            baseRow({ id: "1", user: "delayed@localhost" }),
        ];

        const backend = new ShellInterfaceSqlEditor();
        vi.spyOn(backend, "listMySQLUsers").mockResolvedValue(rows);
        vi.spyOn(backend, "execute").mockReturnValue(new Promise<never>(() => {
            return undefined;
        }));
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const { unmount } = render(
            <UserAccounts backend={backend} toolbarItems={toolbarItems} />,
        );

        await waitFor(() => {
            expect(screen.getByTestId("summaryTotal").textContent).toBe("1");
        });

        expect(screen.getByTestId("userAccountsTotal").textContent).toBe("1 account");
        expect(screen.getByTestId("summaryPasswordValidation").textContent).toBe("Off");

        unmount();
    });

    it("matches snapshot after initial load", async ({ expect }) => {
        const rows: IMySQLUserListItem[] = [
            baseRow({ id: "1", user: "snapshot@localhost" }),
        ];

        const backend = new ShellInterfaceSqlEditor();
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue(rows);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const { container, unmount } = render(
            <UserAccounts backend={backend} toolbarItems={toolbarItems} />,
        );

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
        });

        expect(container).toMatchSnapshot("UserAccounts1");

        unmount();
    });

    it("refresh button triggers reload", async ({ expect }) => {
        const rows: IMySQLUserListItem[] = [baseRow({ id: "1" })];
        const backend = new ShellInterfaceSqlEditor();
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue(rows);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const { container, unmount } = render(
            <UserAccounts backend={backend} toolbarItems={toolbarItems} />,
        );

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
        });

        const refresh = container.querySelector("#userAccountsToolbar .button")!;
        fireEvent.click(refresh);

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(2);
        });

        unmount();
    });

    it("filters users with free text and tagged search terms", async ({ expect }) => {
        const rows: IMySQLUserListItem[] = [
            baseRow({
                id: "1",
                user: "alice@%",
                plugin: "mysql_native_password",
                roles: ["reader"],
                globalPrivileges: ["SELECT"],
                schemaPrivileges: {
                    app: ["INSERT"],
                },
                tablePrivileges: [{ schema: "app", table: "orders", privileges: ["SELECT"] }],
            }),
            baseRow({
                id: "2",
                user: "bob@localhost",
                plugin: "caching_sha2_password",
                roles: ["app_admin"],
                globalPrivileges: ["CREATE USER"],
                schemaPrivileges: {
                    sales: ["UPDATE"],
                },
                columnPrivileges: [{
                    schema: "sales", table: "orders", column: "customer_id", privileges: ["SELECT"],
                }],
                routinePrivileges: [{
                    schema: "sales", routine: "recalculate_totals", routineType: "PROCEDURE", privileges: ["EXECUTE"],
                }],
            }),
        ];

        const backend = new ShellInterfaceSqlEditor();
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue(rows);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const { container, unmount } = render(
            <UserAccounts backend={backend} toolbarItems={toolbarItems} />,
        );

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
        });

        const searchInput = container.querySelector("#userAccountsSearch input")!;
        const expectFilteredTotal = async (query: string, text: string): Promise<void> => {
            fireEvent.input(searchInput, { target: { value: query } });

            await waitFor(() => {
                expect(within(container).getByTestId("userAccountsTotal").textContent).toBe(text);
            });
        };

        await expectFilteredTotal("alice", "1 of 2 accounts");
        await expectFilteredTotal("host: localhost", "1 of 2 accounts");
        await expectFilteredTotal("auth: caching", "1 of 2 accounts");
        await expectFilteredTotal("role: app_admin", "1 of 2 accounts");
        await expectFilteredTotal("privilege: create user", "1 of 2 accounts");
        await expectFilteredTotal("user: bob privilege: update", "1 of 2 accounts");
        await expectFilteredTotal("privilege: app.orders", "0 of 2 accounts");
        await expectFilteredTotal("privilege: sales.orders(customer_id)", "0 of 2 accounts");
        await expectFilteredTotal("privilege: sales.recalculate_totals", "0 of 2 accounts");
        await expectFilteredTotal("privilege: missing", "0 of 2 accounts");

        unmount();
    });

    it("loads again when backend prop changes", async ({ expect }) => {
        const rows1: IMySQLUserListItem[] = [baseRow({ id: "1" })];
        const rows2: IMySQLUserListItem[] = [baseRow({ id: "2" })];
        const be1 = new ShellInterfaceSqlEditor();
        const be2 = new ShellInterfaceSqlEditor();
        const list1 = vi.spyOn(be1, "listMySQLUsers").mockResolvedValue(rows1);
        const list2 = vi.spyOn(be2, "listMySQLUsers").mockResolvedValue(rows2);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const { rerender, unmount } = render(
            <UserAccounts backend={be1} toolbarItems={toolbarItems} />,
        );

        await waitFor(() => {
            expect(list1).toHaveBeenCalledTimes(1);
        });

        rerender(<UserAccounts backend={be2} toolbarItems={toolbarItems} />);

        await waitFor(() => {
            expect(list2).toHaveBeenCalledTimes(1);
        });

        unmount();
    });

    it("statusFormatter shows lock and password-expiration states", ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        // Locked
        const locked = baseRow({ accountLocked: true });
        const cellLocked = makeCell(locked);
        const statusFormatter = getPrivate<(cell: CellComponent) => HTMLElement>(instance, "statusFormatter");
        const hostLocked = statusFormatter(cellLocked);
        expect(hostLocked.querySelector(".userAccountPill")?.textContent).toBe("LOCKED");
        expect(hostLocked.querySelector(".userAccountPill")?.classList.contains("off")).toBe(true);
        expect(hostLocked.querySelector(".codicon-lock")).toBeTruthy();

        // A failed-login lock is also shown as locked, without changing the
        // administrative accountLocked value.
        const temporarilyLocked = baseRow({ temporarilyLocked: true });
        const hostTemporarilyLocked = statusFormatter(makeCell(temporarilyLocked));
        expect(hostTemporarilyLocked.querySelector(".userAccountPill")?.textContent).toBe("LOCKED");

        // Locked takes precedence over an expired password.
        const lockedExpired = statusFormatter(makeCell(baseRow({ accountLocked: true, passwordExpired: true })));
        expect(lockedExpired.querySelector(".userAccountPill")?.textContent).toBe("LOCKED");

        // Password expiration
        const expiresIn29Days = new Date();
        expiresIn29Days.setDate(expiresIn29Days.getDate() + 29);
        const expiring = statusFormatter(makeCell(baseRow({ passwordExpiration: expiresIn29Days.toISOString() })));
        const expiringPill = expiring.querySelector(".userAccountPill");
        expect(expiringPill?.textContent).toBe("EXPIRING");
        expect(expiringPill?.classList.contains("warning")).toBe(true);
        expect(expiringPill?.getAttribute("data-tooltip")).toMatch(/^\d+ days left$/);

        const expiresIn31Days = new Date();
        expiresIn31Days.setDate(expiresIn31Days.getDate() + 31);
        const notYetExpiring = statusFormatter(
            makeCell(baseRow({ passwordExpiration: expiresIn31Days.toISOString() })),
        );
        expect(notYetExpiring.querySelector(".userAccountPill")?.textContent).toBe("UNLOCKED");

        const expired = statusFormatter(makeCell(baseRow({ passwordExpired: true })));
        expect(expired.querySelector(".userAccountPill")?.textContent).toBe("EXPIRED");
        expect(expired.querySelector(".userAccountPill")?.classList.contains("off")).toBe(true);

        // Unlocked without an expiration.
        const open = baseRow({ accountLocked: false });
        const cellOpen = makeCell(open);
        const hostOpen = statusFormatter(cellOpen);
        expect(hostOpen.querySelector(".userAccountPill")?.textContent).toBe("UNLOCKED");
        expect(hostOpen.querySelector(".userAccountPill")?.classList.contains("on")).toBe(true);
        expect(hostOpen.querySelector(".codicon-unlock")).toBeTruthy();
    });

    it("account formatters split user name and host matcher", ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const row = baseRow({ user: "myuser", host: "%" });
        const cell = makeCell(row);
        const userNameFormatter = getPrivate<(cell: CellComponent) => string>(instance, "userNameFormatter");
        const hostMatcherFormatter = getPrivate<(cell: CellComponent) => string>(instance, "hostMatcherFormatter");

        expect(userNameFormatter(cell)).toBe("myuser");
        expect(hostMatcherFormatter(cell)).toBe("%");
    });

    it("sslFormatter handles not required, required and certificate with details", ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        // Not required
        const row1 = baseRow({ sslOptions: null });
        const cell1 = makeCell(row1);
        const sslFormatter = getPrivate<(cell: CellComponent) => HTMLElement | string>(instance, "sslFormatter");
        const host1 = ensureElement(sslFormatter(cell1));
        const pill1 = host1.querySelector(".userAccountPill");
        expect(pill1?.textContent).toBe("Not required");
        expect(pill1?.classList.contains("none")).toBe(true);

        // Required (no details)
        const row2 = baseRow({
            sslOptions: {
                requiresCertificate: false,
                sslCipher: "TLSv1.3",
            } as IMySQLUserListItemSSLOptions,
        });
        const cell2 = makeCell(row2);
        const host2 = ensureElement(sslFormatter(cell2));
        const pill2 = host2.querySelector(".userAccountPill");
        expect(pill2?.textContent).toBe("REQUIRED");
        expect(pill2?.classList.contains("on")).toBe(true);
        expect(pill2?.getAttribute("data-tooltip")).toBe("cipher: TLSv1.3");

        // Certificate with details
        const row3 = baseRow({
            sslOptions: {
                requiresCertificate: true,
                x509Issuer: "CA",
                x509Subject: "CN=user",
                sslCipher: "TLSv1.3",
            } as IMySQLUserListItemSSLOptions,
        });
        const cell3 = makeCell(row3);
        const host3 = ensureElement(sslFormatter(cell3));
        const pill3 = host3.querySelector(".userAccountPill");
        expect(pill3?.textContent).toBe("CERT REQUIRED");
        expect(pill3?.classList.contains("info")).toBe(true);
        const tooltip = pill3?.getAttribute("data-tooltip") ?? "";
        expect(tooltip).toContain("issuer: CA");
        expect(tooltip).toContain("subject: CN=user");
        expect(tooltip).toContain("cipher: TLSv1.3");
    });

    it("roles/globalPrivileges formatters show counts and expected tooltips", ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        const row = baseRow({ roles: ["r1", "r2"], globalPrivileges: ["SELECT"] });
        const cellRoles = makeCell(row);
        const rolesFormatter = getPrivate<(cell: CellComponent) => HTMLElement>(instance, "rolesFormatter");
        const hostRoles = rolesFormatter(cellRoles);
        const pillRoles = hostRoles.querySelector(".userAccountPill");
        expect(pillRoles?.textContent).toBe("2");
        expect(pillRoles?.classList.contains("on")).toBe(true);
        expect(pillRoles?.getAttribute("data-tooltip")).toContain("r1\nr2");

        const cellPrivs = makeCell(row);
        const globalPrivilegesFormatter = getPrivate<(cell: CellComponent) => HTMLElement>(instance,
            "globalPrivilegesFormatter");
        const hostPrivs = globalPrivilegesFormatter(cellPrivs);
        const pillPrivs = hostPrivs.querySelector(".userAccountPill");
        expect(pillPrivs?.textContent).toBe("1");
        expect(pillPrivs?.classList.contains("on")).toBe(true);
        expect(pillPrivs?.getAttribute("data-tooltip")).toBe("SELECT");
    });

    it("objectPrivileges formatter counts all direct privileges and shows tooltip lines", ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        const row = baseRow({
            schemaPrivileges: { "db.1": ["SELECT", "INSERT"] },
            tablePrivileges: [{ schema: "db.1", table: "t(1)", privileges: ["UPDATE"] }],
            columnPrivileges: [{ schema: "db.1", table: "t(1)", column: "c.1", privileges: ["SELECT"] }],
            routinePrivileges: [{
                schema: "db.1", routine: "p(1)", routineType: "PROCEDURE", privileges: ["EXECUTE"],
            }],
        });
        const cell = makeCell(row);
        const objectPrivilegesFormatter = getPrivate<(cell: CellComponent) => HTMLElement>(instance,
            "objectPrivilegesFormatter");
        const host = objectPrivilegesFormatter(cell);
        const pill = host.querySelector(".userAccountPill");

        expect(pill?.textContent).toBe("5");
        expect(pill?.classList.contains("on")).toBe(true);
        expect(pill?.getAttribute("data-tooltip")).toBe([
            "db.1: INSERT",
            "db.1: SELECT",
            "db.1.p(1): EXECUTE",
            "db.1.t(1): UPDATE",
            "db.1.t(1).c.1: SELECT",
        ].join("\n"));
    });

    it("objectPrivileges formatter sums direct privileges across targets", ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        const row = baseRow({
            schemaPrivileges: { app: ["SELECT", "INSERT", "UPDATE"] },
            tablePrivileges: [{ schema: "app", table: "orders", privileges: ["DELETE"] }],
        });
        const cell = makeCell(row);
        const objectPrivilegesFormatter = getPrivate<(cell: CellComponent) => HTMLElement>(instance,
            "objectPrivilegesFormatter");
        const host = objectPrivilegesFormatter(cell);
        const pill = host.querySelector(".userAccountPill");

        expect(pill?.textContent).toBe("4");
        expect(pill?.getAttribute("data-tooltip")).toBe([
            "app: INSERT",
            "app: SELECT",
            "app: UPDATE",
            "app.orders: DELETE",
        ].join("\n"));
    });

    it("limits role and privilege count tooltips to 15 items plus ellipsis", ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        const roles = Array.from({ length: 16 }, (_value, index) => {
            return `role${index + 1}`;
        });
        const globalPrivileges = Array.from({ length: 16 }, (_value, index) => {
            return `PRIV_${index + 1}`;
        });
        const schemaPrivileges = Object.fromEntries(Array.from({ length: 16 }, (_value, index) => {
            const identifier = `db${String(index + 1).padStart(2, "0")}`;

            return [identifier, ["SELECT"]];
        }));
        const row = baseRow({ roles, globalPrivileges, schemaPrivileges });

        const rolesFormatter = getPrivate<(cell: CellComponent) => HTMLElement>(instance, "rolesFormatter");
        const rolesTooltip = rolesFormatter(makeCell(row))
            .querySelector(".userAccountPill")
            ?.getAttribute("data-tooltip");
        expect(rolesTooltip).toBe([...roles.slice(0, 15), "..."].join("\n"));

        const globalPrivilegesFormatter = getPrivate<(cell: CellComponent) => HTMLElement>(instance,
            "globalPrivilegesFormatter");
        const globalPrivilegesTooltip = globalPrivilegesFormatter(makeCell(row))
            .querySelector(".userAccountPill")
            ?.getAttribute("data-tooltip");
        expect(globalPrivilegesTooltip).toBe([...globalPrivileges.slice(0, 15), "..."].join("\n"));

        const objectPrivilegesFormatter = getPrivate<(cell: CellComponent) => HTMLElement>(instance,
            "objectPrivilegesFormatter");
        const objectPrivilegesTooltip = objectPrivilegesFormatter(makeCell(row))
            .querySelector(".userAccountPill")
            ?.getAttribute("data-tooltip");
        const expectedObjectPrivilegeLines = Array.from({ length: 15 }, (_value, index) => {
            return `db${String(index + 1).padStart(2, "0")}: SELECT`;
        });
        expect(objectPrivilegesTooltip).toBe([...expectedObjectPrivilegeLines, "..."].join("\n"));
    });

    it("objectPrivileges formatter counts direct object privileges, not effective inherited privileges", async ({
        expect,
    }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        instance.setState({ partialRevokesEnabled: true });
        await waitFor(() => {
            expect(getPrivate<IUserAccountsState>(instance, "state").partialRevokesEnabled).toBe(true);
        });

        const row = baseRow({
            globalPrivileges: ["SELECT"],
            schemaPrivileges: { app: ["INSERT", "UPDATE"] },
        }) as IMySQLUserListItem & { objectPrivilegeState: unknown };
        row.objectPrivilegeState = {
            direct: {
                schema: { app: ["INSERT", "UPDATE"] },
                table: { "app.orders": ["SELECT"] },
                routine: { "app.calculate": ["EXECUTE"] },
                column: { "app.orders.id": ["REFERENCES"] },
            },
            inherited: {
                schema: { app: ["SELECT"] },
                table: {},
                routine: {},
                column: {},
            },
            roleInherited: {
                schema: {},
                table: {},
                routine: {},
                column: {},
            },
            restricted: {
                schema: {},
                table: {},
                routine: {},
                column: {},
            },
            readonly: {
                schema: {},
                table: {},
                routine: {},
                column: {},
            },
            effective: {
                schema: { app: ["INSERT", "UPDATE", "SELECT"] },
                table: { "app.orders": ["SELECT"] },
                routine: { "app.calculate": ["EXECUTE"] },
                column: { "app.orders.id": ["REFERENCES"] },
            },
        };
        const cell = makeCell(row);
        const objectPrivilegesFormatter = getPrivate<(cell: CellComponent) => HTMLElement>(instance,
            "objectPrivilegesFormatter");
        const host = objectPrivilegesFormatter(cell);
        const pill = host.querySelector(".userAccountPill");

        expect(pill?.textContent).toBe("5+global");
        expect(pill?.getAttribute("data-tooltip")).toBe([
            "app: INSERT",
            "app: UPDATE",
            "app.calculate: EXECUTE",
            "app.orders: SELECT",
            "app.orders.id: REFERENCES",
            "Inherited from global privileges: SELECT",
        ].join("\n"));
    });

    it("objectPrivileges formatter limits inherited global privileges in its tooltip", async ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        instance.setState({ partialRevokesEnabled: true });
        await waitFor(() => {
            expect(getPrivate<IUserAccountsState>(instance, "state").partialRevokesEnabled).toBe(true);
        });
        const globalPrivileges = Array.from({ length: 11 }, (_value, index) => {
            return `PRIV_${String(index + 1).padStart(2, "0")}`;
        });
        const row = baseRow({ globalPrivileges });
        const objectPrivilegesFormatter = getPrivate<(cell: CellComponent) => HTMLElement>(instance,
            "objectPrivilegesFormatter");

        expect(objectPrivilegesFormatter(makeCell(row)).querySelector(".userAccountPill")
            ?.getAttribute("data-tooltip")).toBe(`Inherited from global privileges: ${[
            ...globalPrivileges.slice(0, 10), "...",
        ].join(", ")}`);
    });

    it("reformats object privilege counts after loading partial revokes availability", async ({ expect }) => {
        const rows = [baseRow({
            user: "alice@localhost",
            globalPrivileges: ["SELECT"],
            schemaPrivileges: { app: ["INSERT"] },
        })];
        const backend = new ShellInterfaceSqlEditor();
        vi.spyOn(backend, "listMySQLUsers").mockResolvedValue(rows);
        vi.spyOn(backend, "listMySQLAuthenticationPlugins").mockResolvedValue([]);
        vi.spyOn(backend, "isPartialRevokesEnabled").mockResolvedValue(true);
        vi.spyOn(backend, "execute").mockResolvedValue({ rows: [] });
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        await waitFor(() => {
            expect(getPrivate<IUserAccountsState>(instance, "state").partialRevokesEnabled).toBe(true);
        });

        const state = getPrivate<IUserAccountsState>(instance, "state");
        expect(state.rows).not.toBe(rows);
        const objectPrivilegesFormatter = getPrivate<(cell: CellComponent) => HTMLElement>(instance,
            "objectPrivilegesFormatter");
        expect(objectPrivilegesFormatter(makeCell(state.rows[0])).querySelector(".userAccountPill")?.textContent)
            .toBe("1+global");
    });

    it("does not enumerate object metadata while loading the user list", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([
            baseRow({ user: "alice@localhost", globalPrivileges: ["SELECT"] }),
        ]);
        const partialRevokesSpy = vi.spyOn(backend, "isPartialRevokesEnabled").mockResolvedValue(true);
        const listCatalogSpy = vi.spyOn(backend, "listMySQLSchemaPrivilegeCatalog").mockResolvedValue([
            { privilege: "SELECT", category: "Tables", description: "To retrieve rows" },
        ]);
        const listSchemasSpy = vi.spyOn(backend, "getCatalogObjects").mockResolvedValue(["app"]);
        const listSchemaTargetsSpy = vi.spyOn(backend, "listMySQLObjectPrivilegeSchemaTargets").mockResolvedValue([
            { kind: "table", objectName: "orders", routineType: null },
        ]);
        const listColumnsSpy = vi.spyOn(backend, "getTableObjectNames").mockResolvedValue(["id", "total"]);
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
            expect(partialRevokesSpy).toHaveBeenCalledTimes(1);
        });
        expect(listCatalogSpy).not.toHaveBeenCalled();
        expect(listSchemasSpy).not.toHaveBeenCalled();
        expect(listSchemaTargetsSpy).not.toHaveBeenCalled();
        expect(listColumnsSpy).not.toHaveBeenCalled();
    });

    it("objectPrivileges formatter shows inherited globals compactly without object names", async ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        instance.setState({ partialRevokesEnabled: true });
        await waitFor(() => {
            expect(getPrivate<IUserAccountsState>(instance, "state").partialRevokesEnabled).toBe(true);
        });

        const row = baseRow({
            user: "alice@localhost",
            globalPrivileges: ["SELECT"],
            partialRevokes: { app: ["SELECT"] },
        });
        const cell = makeCell(row);
        const objectPrivilegesFormatter = getPrivate<(cell: CellComponent) => HTMLElement>(instance,
            "objectPrivilegesFormatter");
        const host = objectPrivilegesFormatter(cell);
        const pill = host.querySelector(".userAccountPill");

        expect(pill?.textContent).toBe("global");
        expect(pill?.classList.contains("on")).toBe(true);
        const tt = pill?.getAttribute("data-tooltip") ?? "";
        expect(tt).toContain("Inherited from global privileges: SELECT");
        expect(tt).toContain("Partially revoked on app: SELECT");
        expect(tt).not.toContain("app.orders");
    });

    it("object privilege dialog does not select object privileges inherited from globals", async ({
        expect,
    }) => {
        const backend = new ShellInterfaceSqlEditor();
        vi.spyOn(backend, "isPartialRevokesEnabled").mockResolvedValue(true);
        vi.spyOn(backend, "listMySQLSchemaPrivilegeCatalog").mockResolvedValue([
            { privilege: "SELECT", category: "Tables", description: "To retrieve rows" },
        ]);
        vi.spyOn(backend, "getCatalogObjects").mockResolvedValue(["app"]);
        vi.spyOn(backend, "listMySQLObjectPrivilegeSchemaTargets").mockResolvedValue([
            { kind: "table", objectName: "orders", routineType: null },
            { kind: "routine", objectName: "refresh_orders", routineType: "PROCEDURE" },
        ]);
        vi.spyOn(backend, "getTableObjectNames").mockResolvedValue(["id", "total"]);
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const createObjectPrivilegeEditorData = getPrivate<(
        backend: ShellInterfaceSqlEditor,
        rowData: IMySQLUserListItem,
        ) => Promise<{
            privileges: Record<string, Record<string, string[]>>;
            targets: Array<{ id: string; label: string }>;
        }>>(instance, "createObjectPrivilegeEditorData");

        const data = await createObjectPrivilegeEditorData.call(instance, backend,
            baseRow({ user: "alice@localhost", globalPrivileges: ["SELECT"] }));

        expect(data.privileges.schema.app).toBeUndefined();
        expect(data.privileges.table[JSON.stringify(["table", "app", "orders", undefined, undefined])]).toBeUndefined();
        expect(data.privileges.column[JSON.stringify(["column", "app", "orders", undefined, "id"])]).toBeUndefined();
        expect(data.privileges.column[JSON.stringify(["column", "app", "orders", undefined, "total"])]).toBeUndefined();
        expect(data.targets).toEqual([
            expect.objectContaining({ id: JSON.stringify(["schema", "app", undefined, undefined]), label: "app" }),
        ]);
    });

    it("keeps same-name functions and procedures as separate privilege targets", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        vi.spyOn(backend, "isPartialRevokesEnabled").mockResolvedValue(false);
        vi.spyOn(backend, "listMySQLSchemaPrivilegeCatalog").mockResolvedValue([
            { privilege: "EXECUTE", category: "Functions,Procedures", description: "To execute routines" },
        ]);
        vi.spyOn(backend, "getCatalogObjects").mockResolvedValue(["app"]);
        vi.spyOn(backend, "listMySQLObjectPrivilegeSchemaTargets").mockResolvedValue([
            { kind: "routine", objectName: "refresh", routineType: "FUNCTION" },
            { kind: "routine", objectName: "refresh", routineType: "PROCEDURE" },
        ]);
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={{
            navigation: [], execution: [], editor: [], auxiliary: [],
        }} />);
        const instance = ref.current!;
        const createObjectPrivilegeEditorData = getPrivate<(
        backend: ShellInterfaceSqlEditor,
        rowData: IMySQLUserListItem,
        ) => Promise<{
            loadSchemaTargets: (schema: string) => Promise<{
                targets: Array<{ routine?: string; routineType?: string }>;
                privilegeState: { direct: { routine: Record<string, string[]> } };
            }>;
        }>>(instance, "createObjectPrivilegeEditorData");

        const data = await createObjectPrivilegeEditorData.call(instance, backend, baseRow({
            routinePrivileges: [
                { schema: "app", routine: "refresh", routineType: "FUNCTION", privileges: ["EXECUTE"] },
                { schema: "app", routine: "refresh", routineType: "PROCEDURE", privileges: ["ALTER ROUTINE"] },
            ],
        }));
        const loaded = await data.loadSchemaTargets("app");

        expect(loaded.targets).toEqual([
            expect.objectContaining({ routine: "refresh", routineType: "FUNCTION" }),
            expect.objectContaining({ routine: "refresh", routineType: "PROCEDURE" }),
        ]);
        expect(loaded.privilegeState.direct.routine).toEqual({
            [JSON.stringify(["routine", "app", "refresh", "FUNCTION"])]: ["EXECUTE"],
            [JSON.stringify(["routine", "app", "refresh", "PROCEDURE"])]: ["ALTER ROUTINE"],
        });
    });

    it("object privilege dialog filters system schemas from available and merged schema names", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        vi.spyOn(backend, "listMySQLSchemaPrivilegeCatalog").mockResolvedValue([
            { privilege: "SELECT", category: "Databases,Tables", description: "To retrieve rows" },
        ]);
        vi.spyOn(backend, "getCatalogObjects").mockResolvedValue([
            "app",
            "information_schema",
            "mysql",
            "performance_schema",
            "sys",
        ]);
        const listObjectsSpy = vi.spyOn(backend, "listMySQLObjectPrivilegeSchemaTargets").mockResolvedValue([]);
        vi.spyOn(backend, "getTableObjectNames").mockResolvedValue([]);
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const createObjectPrivilegeEditorData = getPrivate<(
        backend: ShellInterfaceSqlEditor,
        rowData: IMySQLUserListItem,
        ) => Promise<{
            schemas: string[];
        }>>(instance, "createObjectPrivilegeEditorData");

        const data = await createObjectPrivilegeEditorData.call(instance, backend, baseRow({
            user: "alice@localhost",
            schemaPrivileges: {
                app: ["SELECT"],
                information_schema: ["SELECT"],
                custom: ["SELECT"],
            },
            tablePrivileges: [
                { schema: "mysql", table: "user", privileges: ["SELECT"] },
                { schema: "custom", table: "orders", privileges: ["SELECT"] },
                { schema: "performance_schema", table: "events_statements_current", privileges: ["SELECT"] },
            ],
            routinePrivileges: [{
                schema: "sys", routine: "ps_setup_enable_thread", routineType: "PROCEDURE", privileges: ["EXECUTE"],
            }],
            columnPrivileges: [
                { schema: "other", table: "orders", column: "id", privileges: ["SELECT"] },
                { schema: "information_schema", table: "tables", column: "TABLE_NAME", privileges: ["SELECT"] },
            ],
            partialRevokes: {
                performance_schema: ["SELECT"],
                sys: ["SELECT"],
                other: ["SELECT"],
            },
        }));

        expect(data.schemas).toEqual(["app", "custom", "other"]);
        const schemaObjectLookups = listObjectsSpy.mock.calls.map(([schema]) => {
            return schema;
        });
        expect(schemaObjectLookups).not.toEqual(expect.arrayContaining([
            "information_schema",
            "mysql",
            "performance_schema",
            "sys",
        ]));
    });

    it("object privilege dialog gets schemas from the catalog", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const catalogSchemasSpy = vi.spyOn(backend, "getCatalogObjects").mockResolvedValue([
            "app", "empty",
        ]);
        vi.spyOn(backend, "listMySQLSchemaPrivilegeCatalog").mockResolvedValue([]);
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const createObjectPrivilegeEditorData = getPrivate<(
        backend: ShellInterfaceSqlEditor,
        rowData: IMySQLUserListItem,
        ) => Promise<{
            targets: Array<{ schema: string; hasChildren?: boolean }>;
        }>>(instance, "createObjectPrivilegeEditorData");

        const data = await createObjectPrivilegeEditorData.call(instance, backend, baseRow());

        expect(catalogSchemasSpy).toHaveBeenCalledWith("Schema");
        expect(data.targets).toEqual(expect.arrayContaining([
            expect.objectContaining({ schema: "app", hasChildren: true }),
            expect.objectContaining({ schema: "empty", hasChildren: true }),
        ]));
    });

    it("sorters compare the values displayed by derived columns", ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const column = {};
        const sorterParams = {};

        const statusSorter = getPrivate<TestSorter>(instance, "statusSorter");
        expect(statusSorter(undefined, undefined,
            makeRow(baseRow({ accountLocked: true })),
            makeRow(baseRow({ accountLocked: false })),
            column, "asc", sorterParams)).toBeLessThan(0);

        const userNameSorter = getPrivate<TestSorter>(instance, "userNameSorter");
        expect(userNameSorter(undefined, undefined,
            makeRow(baseRow({ user: "alice@%" })),
            makeRow(baseRow({ user: "bob@%" })),
            column, "asc", sorterParams)).toBeLessThan(0);

        const hostMatcherSorter = getPrivate<TestSorter>(instance, "hostMatcherSorter");
        expect(hostMatcherSorter(undefined, undefined,
            makeRow(baseRow({ user: "alice@%" })),
            makeRow(baseRow({ user: "alice@localhost" })),
            column, "asc", sorterParams)).toBeLessThan(0);

        const sslSorter = getPrivate<TestSorter>(instance, "sslSorter");
        expect(sslSorter(undefined, undefined,
            makeRow(baseRow({ sslOptions: null })),
            makeRow(baseRow({
                sslOptions: { requiresCertificate: true } as IMySQLUserListItemSSLOptions,
            })),
            column, "asc", sorterParams)).toBeLessThan(0);

        const rolesSorter = getPrivate<TestSorter>(instance, "rolesSorter");
        expect(rolesSorter(undefined, undefined,
            makeRow(baseRow({ roles: ["r1"] })),
            makeRow(baseRow({ roles: ["r1", "r2"] })),
            column, "asc", sorterParams)).toBeLessThan(0);

        const globalPrivilegesSorter = getPrivate<TestSorter>(instance, "globalPrivilegesSorter");
        expect(globalPrivilegesSorter(undefined, undefined,
            makeRow(baseRow({ globalPrivileges: ["SELECT"] })),
            makeRow(baseRow({ globalPrivileges: ["SELECT", "UPDATE"] })),
            column, "asc", sorterParams)).toBeLessThan(0);

        const objectPrivilegesSorter = getPrivate<TestSorter>(instance, "objectPrivilegesSorter");
        expect(objectPrivilegesSorter(undefined, undefined,
            makeRow(baseRow({ schemaPrivileges: { db1: ["SELECT"] } })),
            makeRow(baseRow({ tablePrivileges: [{ schema: "db1", table: "t1", privileges: ["SELECT", "UPDATE"] }] })),
            column, "asc", sorterParams)).toBeLessThan(0);

    });

    it("double-clicking a non-roles cell loads details and opens edit dialog", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([baseRow({ user: "alice@localhost" })]);
        vi.spyOn(backend, "listMySQLAuthenticationPlugins").mockResolvedValue(["caching_sha2_password"]);
        const defaultsSpy = vi.spyOn(backend, "getMySQLCreateUserDefaults").mockResolvedValue({
            passwordLifetime: 90,
            passwordReuseHistory: 5,
            passwordReuseInterval: 30,
            passwordRequireCurrent: true,
            maxUserConnections: 12,
        });
        const getUserSpy = vi.spyOn(backend, "getMySQLUser").mockResolvedValue(baseUserDetails({
            user: "alice",
            host: "localhost",
            plugin: "auth_socket",
            sslType: "SPECIFIED",
            sslCipher: "cipher-1",
            x509Issuer: "issuer-1",
            x509Subject: "",
            maxQuestions: 10,
            maxConnections: 20,
            maxUpdates: 30,
            maxUserConnections: 40,
            passwordLifetime: 60,
            passwordExpire: true,
            passwordReuseHistory: 2,
            passwordReuseInterval: 7,
            passwordRequireCurrent: true,
            failedLoginAttempts: 2,
            passwordLockTime: 4,
            accountLocked: true,
            comment: "existing comment",
        }));
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        const dialogRef = getPrivate<{ current: { show: (values: IDialogValues, opts: { title: string }) => void } }>(
            instance, "createUserDialogRef");
        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
            expect(dialogRef.current).toBeTruthy();
        });
        const showSpy = vi.spyOn(dialogRef.current, "show");

        const cell = makeCell(baseRow({ user: "alice@localhost" }), undefined, "passwordExpiration");

        const handleUserAccountsCellDoubleClick = getPrivate<(event: Event, cell: CellComponent) => void>(
            instance, "handleUserAccountsCellDoubleClick");
        handleUserAccountsCellDoubleClick(makeEvent(), cell);

        await waitFor(() => {
            expect(getUserSpy).toHaveBeenCalledWith("alice", "localhost");
            expect(showSpy).toHaveBeenCalledTimes(1);
        });

        const [values, options] = showSpy.mock.calls[0] as [IDialogValues, { title: string }];
        expect(options).toEqual({ title: "Edit User Account" });
        expect(values.sections.get("general")?.values.userName.value).toBe("alice");
        expect(values.sections.get("general")?.values.hostName.value).toBe("localhost");
        expect(values.sections.get("general")?.values.comment.value).toBe("existing comment");
        expect(values.sections.get("authentication")?.values.authenticationPlugin.value).toBe("auth_socket");
        expect(values.sections.get("authentication")?.values.authenticationPlugin.choices)
            .toEqual(["caching_sha2_password", "auth_socket"]);
        expect(values.sections.get("authentication")?.values.authenticationPlugin.options)
            .toContain(CommonDialogValueOption.Disabled);
        expect(values.sections.get("authentication")?.values.passwordExpire.value).toBe(true);
        expect(values.sections.get("authentication")?.values.passwordExpiration.value).toBe(60);
        expect(values.sections.get("authentication")?.values.passwordHistory.value).toBe(2);
        expect(values.sections.get("authentication")?.values.passwordReuseInterval.value).toBe(7);
        expect(values.sections.get("authentication")?.values.failedPasswordAttempts.value).toBe(2);
        expect(values.sections.get("authentication")?.values.passwordLockTime.value).toBe(4);
        expect(values.sections.get("authentication")?.values.lockAccount.value).toBe(true);
        expect(values.sections.get("resourceLimits")?.values.maxUserConnections.value).toBe(40);
        expect(values.sections.get("tls")?.values.tlsMode.value).toEqual({ tlsMode: "Require Certificate" });
        expect(values.sections.get("tls")?.values.tlsIssuer.value).toBe("issuer-1");
        expect(defaultsSpy).not.toHaveBeenCalled();

        await waitFor(() => {
            expect(getPrivate<IUserAccountsState>(instance, "state").editingAccount)
                .toEqual({ user: "alice", host: "localhost", comment: "existing comment" });
        });
    });

    it("row context menu exposes account actions and routes them to existing handlers", ({ expect }) => {
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        const setLockSpy = vi.spyOn(instance as unknown as {
            setUserAccountLock: (row: RowComponent, lockAccount: boolean) => Promise<void>;
        }, "setUserAccountLock").mockResolvedValue(undefined);
        const editSpy = vi.spyOn(instance as unknown as {
            showEditUserDialog: (row: RowComponent, clone?: boolean) => Promise<void>;
        }, "showEditUserDialog").mockResolvedValue(undefined);
        const viewSqlSpy = vi.spyOn(instance as unknown as {
            showUserAccountSqlDialog: (row: RowComponent) => Promise<void>;
        }, "showUserAccountSqlDialog").mockResolvedValue(undefined);
        const resetPasswordSpy = vi.spyOn(instance as unknown as {
            showResetPasswordDialog: (row: RowComponent) => void;
        }, "showResetPasswordDialog").mockImplementation(() => { /**/ });
        const deleteSpy = vi.spyOn(instance as unknown as {
            confirmDeleteUserAccount: (row: RowComponent) => Promise<void>;
        }, "confirmDeleteUserAccount").mockResolvedValue(undefined);
        const rolesSpy = vi.spyOn(instance as unknown as {
            showManageRolesDialog: (row: RowComponent) => void;
        }, "showManageRolesDialog").mockImplementation(() => { /**/ });
        const globalSpy = vi.spyOn(instance as unknown as {
            showManageGlobalPrivilegesDialog: (row: RowComponent) => Promise<void>;
        }, "showManageGlobalPrivilegesDialog").mockResolvedValue(undefined);
        const objectSpy = vi.spyOn(instance as unknown as {
            showManageObjectPrivilegesDialog: (row: RowComponent) => Promise<void>;
        }, "showManageObjectPrivilegesDialog").mockResolvedValue(undefined);

        const unlockedRow = makeRow(baseRow({ accountLocked: false }));
        const lockedRow = makeRow(baseRow({ accountLocked: true }));

        const menuItem = (command: string, id?: string): IMenuItemProperties => {
            return {
                id,
                command: { title: command, command },
            } as IMenuItemProperties;
        };

        const customCommand = getPrivate<(props: IMenuItemProperties, payload: unknown) => {
            title: string;
            command: string;
        } | undefined>(instance, "handleUserAccountContextMenuCustomCommand");
        expect(customCommand(menuItem("toggleAccountLock", "toggleAccountLock"), unlockedRow)?.title)
            .toBe("Lock Account");
        expect(customCommand(menuItem("toggleAccountLock", "toggleAccountLock"), lockedRow)?.title)
            .toBe("Unlock Account");

        const handleItemClick = getPrivate<(props: IMenuItemProperties,
        altActive: boolean, payload: unknown) => boolean>(
            instance, "handleUserAccountContextMenuItemClick");

        handleItemClick(menuItem("toggleAccountLock", "toggleAccountLock"), false, unlockedRow);
        expect(setLockSpy).toHaveBeenCalledWith(unlockedRow, true);

        handleItemClick(menuItem("editAccount"), false, unlockedRow);
        expect(editSpy).toHaveBeenCalledWith(unlockedRow);

        handleItemClick(menuItem("cloneAccount"), false, unlockedRow);
        expect(editSpy).toHaveBeenCalledWith(unlockedRow, true);

        handleItemClick(menuItem("viewAccountSql"), false, unlockedRow);
        expect(viewSqlSpy).toHaveBeenCalledWith(unlockedRow);

        handleItemClick(menuItem("resetPassword"), false, unlockedRow);
        expect(resetPasswordSpy).toHaveBeenCalledWith(unlockedRow);

        handleItemClick(menuItem("deleteAccount"), false, unlockedRow);
        expect(deleteSpy).toHaveBeenCalledWith(unlockedRow);

        handleItemClick(menuItem("manageRoles"), false, unlockedRow);
        expect(rolesSpy).toHaveBeenCalledWith(unlockedRow);

        handleItemClick(menuItem("manageGlobalPrivileges"), false, unlockedRow);
        expect(globalSpy).toHaveBeenCalledWith(unlockedRow);

        handleItemClick(menuItem("manageObjectPrivileges"), false, unlockedRow);
        expect(objectSpy).toHaveBeenCalledWith(unlockedRow);
    });

    it("shows combined, copyable user account SQL", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([baseRow({ user: "alice@localhost" })]);
        vi.spyOn(backend, "listMySQLAuthenticationPlugins").mockResolvedValue([]);
        const executeSpy = vi.spyOn(backend, "execute").mockImplementation((sql) => {
            if (sql === "SHOW CREATE USER 'alice'@'localhost'") {
                return { rows: [["CREATE USER 'alice'@'localhost' IDENTIFIED WITH 'auth_socket'"]] };
            }

            if (sql === "SHOW GRANTS FOR 'alice'@'localhost'") {
                return {
                    rows: [
                        ["GRANT USAGE ON *.* TO 'alice'@'localhost'"],
                        ["GRANT SELECT ON `db`.* TO 'alice'@'localhost'"]
                    ]
                };
            }

            return { rows: [] };
        });
        const clipboardSpy = vi.spyOn(requisitions, "writeToClipboard").mockImplementation(() => { /**/ });
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const dialogRef = getPrivate<{ current: ValueEditDialog }>(instance, "viewAccountSqlDialogRef");

        await waitFor(() => {
            expect(dialogRef.current).toBeTruthy();
        });
        const showSpy = vi.spyOn(dialogRef.current, "show");

        const handleItemClick = getPrivate<(props: IMenuItemProperties, altActive: boolean,
        payload: unknown) => boolean>(
            instance, "handleUserAccountContextMenuItemClick");
        handleItemClick({ command: { title: "View as SQL...", command: "viewAccountSql" } } as IMenuItemProperties,
            false, makeRow(baseRow({ user: "alice@localhost" })));

        await waitFor(() => {
            expect(executeSpy).toHaveBeenCalledWith("SHOW CREATE USER 'alice'@'localhost'");
            expect(executeSpy).toHaveBeenCalledWith("SHOW GRANTS FOR 'alice'@'localhost'");
            expect(showSpy).toHaveBeenCalledTimes(1);
        });

        const [values, options] = showSpy.mock.calls[0] as [IDialogValues, { title: string }];
        const statements = values.sections.get("statements")!.values as Record<string, {
            type?: string;
            value?: { statements: string };
        }>;
        expect(options).toEqual({ title: "User Account SQL" });
        expect(statements.statements.type).toBe("custom");
        expect(statements.statements.value?.statements).toBe(
            "-- SHOW CREATE USER 'alice'@'localhost'\n"
            + "CREATE USER 'alice'@'localhost' IDENTIFIED WITH 'auth_socket'\n\n"
            + "-- SHOW GRANTS FOR 'alice'@'localhost'\n"
            + "GRANT USAGE ON *.* TO 'alice'@'localhost'\nGRANT SELECT ON `db`.* TO 'alice'@'localhost'",
        );
        const copyButton = document.querySelector<HTMLButtonElement>("#userAccountSqlCopyButton");
        expect(copyButton).not.toBeNull();
        expect(copyButton?.getAttribute("data-tooltip")).toBe("Copy SQL to Clipboard");
        const output = document.querySelector<HTMLTextAreaElement>("#userAccountSqlOutput");
        expect(output?.getAttribute("data-tooltip")).toBe("Copy SQL to Clipboard");
        fireEvent.click(copyButton!);
        expect(clipboardSpy).toHaveBeenCalledOnce();
        expect(clipboardSpy).toHaveBeenCalledWith(statements.statements.value?.statements);
    });

    it("cloning an account opens a create dialog with a copied, editable user name", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([baseRow({ user: "alice@localhost" })]);
        vi.spyOn(backend, "listMySQLAuthenticationPlugins").mockResolvedValue(["caching_sha2_password"]);
        const getUserSpy = vi.spyOn(backend, "getMySQLUser").mockResolvedValue(baseUserDetails({
            user: "alice",
            host: "localhost",
            plugin: "auth_socket",
        }));
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const dialogRef = getPrivate<{ current: { show: (values: IDialogValues, opts: { title: string }) => void } }>(
            instance, "createUserDialogRef");

        await waitFor(() => {
            expect(dialogRef.current).toBeTruthy();
        });
        const showSpy = vi.spyOn(dialogRef.current, "show");

        const handleItemClick = getPrivate<(props: IMenuItemProperties, altActive: boolean,
        payload: unknown) => boolean>(
            instance, "handleUserAccountContextMenuItemClick");
        handleItemClick({ command: { title: "Clone Account...", command: "cloneAccount" } } as IMenuItemProperties,
            false, makeRow(baseRow({ user: "alice@localhost" })));

        await waitFor(() => {
            expect(getUserSpy).toHaveBeenCalledWith("alice", "localhost");
            expect(showSpy).toHaveBeenCalledTimes(1);
        });

        const [values, options] = showSpy.mock.calls[0] as [IDialogValues, { title: string }];
        expect(options).toEqual({ title: "Clone User Account" });
        expect(values.sections.get("general")?.values.userName.value).toBe("alice_copy");
        expect(values.sections.get("general")?.values.userName.options)
            .not.toContain(CommonDialogValueOption.ReadOnly);
        expect(getPrivate<IUserAccountsState>(instance, "state").editingAccount).toBeNull();
    });

    it("formats rows with an ellipsis action that opens the context menu", async ({ expect }) => {
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const rowElement = document.createElement("div");
        const staleButton = document.createElement("button");
        staleButton.className = "userAccountRowActions";
        rowElement.appendChild(staleButton);
        const selectSpy = vi.fn();
        const row = {
            getElement: () => {
                return rowElement;
            },
            getData: () => {
                return baseRow();
            },
            select: selectSpy,
        } as unknown as RowComponent;

        const handleFormatUserAccountRow = getPrivate<(row: RowComponent) => void>(
            instance, "handleFormatUserAccountRow");
        const handleUserAccountsRowContextSpy = vi.spyOn(
            instance as unknown as { handleUserAccountsRowContext: (event: Event, row: RowComponent) => void },
            "handleUserAccountsRowContext");
        handleFormatUserAccountRow(row);

        const actionButton = rowElement.querySelector<HTMLButtonElement>(".userAccountRowActions");
        expect(actionButton).toBeTruthy();
        expect(actionButton).not.toBe(staleButton);
        expect(rowElement.querySelectorAll(".userAccountRowActions")).toHaveLength(1);
        expect(actionButton?.textContent).toBe("...");
        expect(actionButton?.getAttribute("aria-label")).toBe("More Actions");
        expect(actionButton?.getAttribute("data-tooltip")).toBe("More Actions");

        fireEvent.click(actionButton!);

        expect(selectSpy).toHaveBeenCalledTimes(1);
        expect(handleUserAccountsRowContextSpy).toHaveBeenCalledWith(expect.any(MouseEvent), row);
        const [event] = handleUserAccountsRowContextSpy.mock.calls[0];
        expect(event.type).toBe("contextmenu");
        expect(event.bubbles).toBe(true);
        expect(event.cancelable).toBe(true);
        await waitFor(() => {
            expect(document.querySelector("#userAccountContextMenu")).not.toBeNull();
        });
    });

    it("locks or unlocks an account without changing unrelated account settings", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const updateSpy = vi.spyOn(backend, "updateMySQLUser").mockResolvedValue({ generatedPassword: null });
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        vi.spyOn(backend, "isPartialRevokesEnabled").mockResolvedValue(false);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
        });

        const setUserAccountLock = getPrivate<(row: RowComponent, lockAccount: boolean) => Promise<void>>(
            instance, "setUserAccountLock");
        await setUserAccountLock.call(instance, makeRow(baseRow({ user: "alice@localhost" })), true);

        const expected: IMySQLUser = {
            user: "alice",
            host: "localhost",
            sslType: null, sslCipher: null, x509Issuer: null, x509Subject: null,
            plugin: null, passwordExpire: null, passwordLastChanged: null, passwordLifetime: null,
            authString: null,
            randomPassword: false,
            maxQuestions: null, maxUpdates: null,
            maxConnections: null, maxUserConnections: null,
            passwordReuseHistory: null,
            passwordReuseInterval: null, passwordRequireCurrent: null,
            failedLoginAttempts: null, passwordLockTime: null,
            accountLocked: true,
            comment: null,
        };
        expect(updateSpy).toHaveBeenCalledWith(expected);

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
        });
    });

    it("confirms before deleting an account", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const deleteMySQLUserSpy = vi.spyOn(backend, "deleteMySQLUser").mockResolvedValue(undefined);
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        vi.spyOn(backend, "isPartialRevokesEnabled").mockResolvedValue(false);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
        });

        const confirmDeleteUserAccount = getPrivate<(row: RowComponent) => Promise<void>>(
            instance, "confirmDeleteUserAccount");
        const row = makeRow(baseRow({ user: "alice@localhost" }));

        uiLayerMockFunctions.confirm.mockResolvedValueOnce("Cancel");
        await confirmDeleteUserAccount.call(instance, row);
        expect(uiLayerMockFunctions.confirm).toHaveBeenCalledWith(
            `Are you sure the user account "alice@localhost" should be deleted? This operation cannot be reverted.`,
            "Delete",
            "Cancel",
        );
        expect(deleteMySQLUserSpy).not.toHaveBeenCalled();

        uiLayerMockFunctions.confirm.mockResolvedValueOnce("Delete");
        await confirmDeleteUserAccount.call(instance, row);
        expect(deleteMySQLUserSpy).toHaveBeenCalledWith("alice", "localhost");

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(2);
        });
    });

    it("opens the password-change dialog and updates only the password", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const updateSpy = vi.spyOn(backend, "updateMySQLUser").mockResolvedValue({ generatedPassword: null });
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        vi.spyOn(backend, "isPartialRevokesEnabled").mockResolvedValue(false);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
        });

        const passwordChangeDialogRef = getPrivate<{ current: { show: (
        request: { account: string; onAccept: (values: { password: string }) => Promise<string | void> },
        ) => Promise<void> } }>(instance, "passwordChangeDialogRef");
        await waitFor(() => {
            expect(passwordChangeDialogRef.current).toBeTruthy();
        });
        const showSpy = vi.spyOn(passwordChangeDialogRef.current, "show").mockResolvedValue(undefined);
        const showResetPasswordDialog = getPrivate<(row: RowComponent) => Promise<void>>(
            instance, "showResetPasswordDialog");
        await showResetPasswordDialog.call(instance, makeRow(baseRow({ user: "alice@localhost" })));

        expect(showSpy).toHaveBeenCalledWith(expect.objectContaining({
            requestId: "userAccountResetPassword", caption: "Reset Password", account: "alice@localhost",
        }));
        const request = showSpy.mock.calls[0][0];
        await request.onAccept({ password: "secret" });

        const expected: IMySQLUser = {
            user: "alice",
            host: "localhost",
            sslType: null, sslCipher: null, x509Issuer: null, x509Subject: null,
            plugin: null, passwordExpire: null, passwordLastChanged: null, passwordLifetime: null,
            authString: "secret",
            randomPassword: false,
            maxQuestions: null, maxUpdates: null,
            maxConnections: null, maxUserConnections: null,
            passwordReuseHistory: null,
            passwordReuseInterval: null, passwordRequireCurrent: null,
            failedLoginAttempts: null, passwordLockTime: null,
            accountLocked: null,
            comment: null,
        };
        expect(updateSpy).toHaveBeenCalledWith(expected);

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(2);
        });
    });

    it("clicking the roles cell opens the role dialog without opening the edit dialog", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([
            baseRow({ user: "alice@localhost", roles: ["reader@%"], defaultRoles: ["reader@%"] }),
            baseRow({ user: "reader@%", isRole: true }),
            baseRow({ user: "writer@%", isRole: true }),
            baseRow({ user: "carol@%", isRole: false }),
            baseRow({ user: "host_role@localhost", isRole: true }),
        ]);
        const getUserSpy = vi.spyOn(backend, "getMySQLUser").mockResolvedValue(baseUserDetails());
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        const roleDialogRef = getPrivate<{ current: { show: (
        values: IDialogValues,
        opts: { title: string },
        data: Record<string, unknown>,
        ) => void } }>(instance, "manageRolesAndPrivilegesDialogRef");
        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
            expect(roleDialogRef.current).toBeTruthy();
        });
        const showSpy = vi.spyOn(roleDialogRef.current, "show");

        const event = makeEvent(makeUserAccountPill());
        const cell = makeCell(
            baseRow({ user: "alice@localhost", roles: ["reader@%"], defaultRoles: ["reader@%"] }),
            undefined,
            "roles",
        );
        const handleUserAccountsCellClick = getPrivate<(event: Event, cell: CellComponent) => void>(
            instance, "handleUserAccountsCellClick");
        handleUserAccountsCellClick(event, cell);

        await waitFor(() => {
            expect(showSpy).toHaveBeenCalledTimes(1);
        });

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(event.stopPropagation).toHaveBeenCalledTimes(1);
        expect(getUserSpy).not.toHaveBeenCalled();

        const [values, options, data] = showSpy.mock.calls[0] as [
            IDialogValues,
            { title: string },
            { user: string; host: string },
        ];
        const rolesValue = values.sections.get("roles")?.values.roles as {
            type: "custom";
            value: { availableRoles: string[]; selectedRoles: string[]; defaultRoles: string[] };
            component: VNode;
        };
        expect(options).toEqual({ title: "Roles and Privileges for alice@localhost" });
        expect(data).toEqual({
            user: "alice",
            host: "localhost",
            initialRoles: ["reader@%"],
            initialDefaultRoles: ["reader@%"],
            initialGlobalPrivileges: [],
        });
        expect([...values.sections.keys()]).toEqual(["roles", "globalPrivileges", "objectPrivileges"]);
        expect(values.sections.get("roles")?.caption).toBe("Roles");
        expect(values.sections.get("roles")?.active).toBe(true);
        expect(values.sections.get("globalPrivileges")?.caption).toBe("Global Privileges");
        expect(values.sections.get("objectPrivileges")?.caption).toBe("Object Privileges");
        expect(rolesValue.type).toBe("custom");
        expect(rolesValue.value.selectedRoles).toEqual(["reader@%"]);
        expect(rolesValue.value.defaultRoles).toEqual(["reader@%"]);
        expect(rolesValue.value.availableRoles).toEqual(["reader@%", "writer@%"]);
    });

    it("clicking outside the roles value container does not open the role dialog", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([
            baseRow({ user: "alice@localhost", roles: ["reader@%"], defaultRoles: ["reader@%"] }),
        ]);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        const roleDialogRef = getPrivate<{ current: { show: (
        values: IDialogValues,
        opts: { title: string },
        data: Record<string, unknown>,
        ) => void } }>(instance, "manageRolesAndPrivilegesDialogRef");
        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
            expect(roleDialogRef.current).toBeTruthy();
        });
        const showSpy = vi.spyOn(roleDialogRef.current, "show");

        const event = makeEvent(document.createElement("div"));
        const cell = makeCell(
            baseRow({ user: "alice@localhost", roles: ["reader@%"], defaultRoles: ["reader@%"] }),
            undefined,
            "roles",
        );
        const handleUserAccountsCellClick = getPrivate<(event: Event, cell: CellComponent) => void>(
            instance, "handleUserAccountsCellClick");
        handleUserAccountsCellClick(event, cell);

        expect(showSpy).not.toHaveBeenCalled();
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(event.stopPropagation).not.toHaveBeenCalled();
    });

    it("clicking the global privileges cell opens the privilege dialog without opening the edit dialog", async ({
        expect,
    }) => {
        const backend = new ShellInterfaceSqlEditor();
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([
            baseRow({ user: "alice@localhost", globalPrivileges: ["SELECT", "UNKNOWN_DYNAMIC"] }),
        ]);
        const catalog: IMySQLGlobalPrivilegeCatalogItem[] = [
            { privilege: "SELECT", category: "Tables", description: "To retrieve rows" },
            { privilege: "INSERT", category: "Tables", description: "To insert rows" },
        ];
        const listCatalogSpy = vi.spyOn(backend, "listMySQLGlobalPrivilegeCatalog").mockResolvedValue(catalog);
        const getUserSpy = vi.spyOn(backend, "getMySQLUser").mockResolvedValue(baseUserDetails());
        vi.spyOn(backend, "isPartialRevokesEnabled").mockResolvedValue(false);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        const globalPrivilegeDialogRef = getPrivate<{ current: { show: (
        values: IDialogValues,
        opts: { title: string },
        data: Record<string, unknown>,
        ) => void } }>(instance, "manageRolesAndPrivilegesDialogRef");
        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
            expect(globalPrivilegeDialogRef.current).toBeTruthy();
        });
        const showSpy = vi.spyOn(globalPrivilegeDialogRef.current, "show");

        const event = makeEvent(makeUserAccountPill());
        const cell = makeCell(
            baseRow({ user: "alice@localhost", globalPrivileges: ["SELECT", "UNKNOWN_DYNAMIC"] }),
            undefined,
            "globalPrivileges",
        );
        const handleUserAccountsCellClick = getPrivate<(event: Event, cell: CellComponent) => void>(
            instance, "handleUserAccountsCellClick");
        handleUserAccountsCellClick(event, cell);

        await waitFor(() => {
            expect(listCatalogSpy).toHaveBeenCalledTimes(1);
            expect(showSpy).toHaveBeenCalledTimes(1);
        });

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(event.stopPropagation).toHaveBeenCalledTimes(1);
        expect(getUserSpy).not.toHaveBeenCalled();

        const [values, options, data] = showSpy.mock.calls[0] as [
            IDialogValues,
            { title: string },
            { user: string; host: string },
        ];
        const privilegeValue = values.sections.get("globalPrivileges")?.values.privileges as {
            type: "custom";
            value: {
                catalog: IMySQLGlobalPrivilegeCatalogItem[];
                selectedPrivileges: string[];
                inheritedPrivileges: string[];
            };
            component: VNode;
        };
        expect(options).toEqual({ title: "Roles and Privileges for alice@localhost" });
        expect(data).toEqual({
            user: "alice",
            host: "localhost",
            initialRoles: [],
            initialDefaultRoles: [],
            initialGlobalPrivileges: ["SELECT", "UNKNOWN_DYNAMIC"],
        });
        expect(values.sections.get("globalPrivileges")?.active).toBe(true);
        expect(privilegeValue.type).toBe("custom");
        expect(privilegeValue.value.selectedPrivileges).toEqual(["SELECT", "UNKNOWN_DYNAMIC"]);
        expect(privilegeValue.value.inheritedPrivileges).toEqual([]);
        expect(privilegeValue.value.catalog).toEqual([
            { privilege: "INSERT", category: "Tables", description: "To insert rows" },
            { privilege: "SELECT", category: "Tables", description: "To retrieve rows" },
            {
                privilege: "UNKNOWN_DYNAMIC",
                category: "",
                description: "Currently granted but not reported by SHOW PRIVILEGES.",
            },
        ]);
    });

    it("loads unified privilege tab data serially on the shared connection", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        let globalCatalogLoaded = false;
        vi.spyOn(backend, "listMySQLGlobalPrivilegeCatalog").mockImplementation(async () => {
            await Promise.resolve();
            globalCatalogLoaded = true;

            return [{ privilege: "SELECT", category: "Tables", description: "To retrieve rows" }];
        });
        vi.spyOn(backend, "getCatalogObjects").mockImplementation(() => {
            if (!globalCatalogLoaded) {
                throw new Error("Global privilege catalog must load before object metadata.");
            }

            return Promise.resolve(["app"]);
        });
        vi.spyOn(backend, "listMySQLObjectPrivilegeSchemaTargets").mockResolvedValue([]);
        vi.spyOn(backend, "listMySQLSchemaPrivilegeCatalog").mockResolvedValue([]);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const manageDialogRef = getPrivate<{ current: { show: (
        values: IDialogValues,
        opts: { title: string },
        data: Record<string, unknown>,
        ) => void } }>(instance, "manageRolesAndPrivilegesDialogRef");
        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
            expect(manageDialogRef.current).toBeTruthy();
        });
        const showSpy = vi.spyOn(manageDialogRef.current, "show");
        const showManageRolesAndPrivilegesDialog = getPrivate<(
        row: RowComponent,
        tab: "roles" | "globalPrivileges" | "objectPrivileges",
        ) => Promise<void>>(instance, "showManageRolesAndPrivilegesDialog");

        await showManageRolesAndPrivilegesDialog.call(
            instance, makeRow(baseRow({ user: "alice@localhost" })), "roles",
        );

        expect(showSpy).toHaveBeenCalledTimes(1);
        const [values] = showSpy.mock.calls[0] as [IDialogValues];
        const globalPrivileges = values.sections.get("globalPrivileges")?.values.privileges as {
            value: { catalog: IMySQLGlobalPrivilegeCatalogItem[] };
        };
        const objectPrivileges = values.sections.get("objectPrivileges")?.values.privileges as {
            value: { schemas: string[] };
        };
        expect(globalPrivileges.value.catalog).toEqual([
            { privilege: "SELECT", category: "Tables", description: "To retrieve rows" },
        ]);
        expect(objectPrivileges.value.schemas).toEqual(["app"]);
    });

    it("global privilege dialog includes inherited privileges from assigned roles", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const alice = baseRow({ user: "alice@localhost", roles: ["reader@%"], globalPrivileges: ["SELECT"] });
        const rows = [
            alice,
            baseRow({ user: "reader@%", isRole: true, roles: ["writer@%"], globalPrivileges: ["INSERT"] }),
            baseRow({
                user: "writer@%",
                isRole: true,
                globalPrivileges: ["UPDATE", "UNKNOWN_INHERITED"],
            }),
        ];
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue(rows);
        const catalog: IMySQLGlobalPrivilegeCatalogItem[] = [
            { privilege: "SELECT", category: "Tables", description: "To retrieve rows" },
            { privilege: "INSERT", category: "Tables", description: "To insert rows" },
            { privilege: "UPDATE", category: "Tables", description: "To update rows" },
        ];
        const listCatalogSpy = vi.spyOn(backend, "listMySQLGlobalPrivilegeCatalog").mockResolvedValue(catalog);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        const globalPrivilegeDialogRef = getPrivate<{ current: { show: (
        values: IDialogValues,
        opts: { title: string },
        data: Record<string, unknown>,
        ) => void } }>(instance, "manageRolesAndPrivilegesDialogRef");
        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
            expect(globalPrivilegeDialogRef.current).toBeTruthy();
        });
        const showSpy = vi.spyOn(globalPrivilegeDialogRef.current, "show");

        const event = makeEvent(makeUserAccountPill());
        const cell = makeCell(alice, undefined, "globalPrivileges");
        const handleUserAccountsCellClick = getPrivate<(event: Event, cell: CellComponent) => void>(
            instance, "handleUserAccountsCellClick");
        handleUserAccountsCellClick(event, cell);

        await waitFor(() => {
            expect(listCatalogSpy).toHaveBeenCalledTimes(1);
            expect(showSpy).toHaveBeenCalledTimes(1);
        });

        const [values] = showSpy.mock.calls[0] as [IDialogValues];
        const privilegeValue = values.sections.get("globalPrivileges")?.values.privileges as {
            value: {
                catalog: IMySQLGlobalPrivilegeCatalogItem[];
                selectedPrivileges: string[];
                inheritedPrivileges: string[];
            };
        };
        expect(privilegeValue.value.selectedPrivileges).toEqual(["SELECT"]);
        expect(privilegeValue.value.inheritedPrivileges).toEqual(["INSERT", "UNKNOWN_INHERITED", "UPDATE"]);
        expect(privilegeValue.value.catalog).toEqual([
            { privilege: "INSERT", category: "Tables", description: "To insert rows" },
            { privilege: "SELECT", category: "Tables", description: "To retrieve rows" },
            {
                privilege: "UNKNOWN_INHERITED",
                category: "",
                description: "Currently inherited but not reported by SHOW PRIVILEGES.",
            },
            { privilege: "UPDATE", category: "Tables", description: "To update rows" },
        ]);
    });

    it("clicking outside the global privileges value container does not open the privilege dialog", async ({
        expect,
    }) => {
        const backend = new ShellInterfaceSqlEditor();
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([
            baseRow({ user: "alice@localhost", globalPrivileges: ["SELECT"] }),
        ]);
        const listCatalogSpy = vi.spyOn(backend, "listMySQLGlobalPrivilegeCatalog").mockResolvedValue([]);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        const globalPrivilegeDialogRef = getPrivate<{ current: { show: (
        values: IDialogValues,
        opts: { title: string },
        data: Record<string, unknown>,
        ) => void } }>(instance, "manageRolesAndPrivilegesDialogRef");
        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
            expect(globalPrivilegeDialogRef.current).toBeTruthy();
        });
        const showSpy = vi.spyOn(globalPrivilegeDialogRef.current, "show");

        const event = makeEvent(document.createElement("div"));
        const cell = makeCell(
            baseRow({ user: "alice@localhost", globalPrivileges: ["SELECT"] }),
            undefined,
            "globalPrivileges",
        );
        const handleUserAccountsCellClick = getPrivate<(event: Event, cell: CellComponent) => void>(
            instance, "handleUserAccountsCellClick");
        handleUserAccountsCellClick(event, cell);

        expect(listCatalogSpy).not.toHaveBeenCalled();
        expect(showSpy).not.toHaveBeenCalled();
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(event.stopPropagation).not.toHaveBeenCalled();
    });

    it("clicking the object privileges cell opens the object privilege dialog", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([
            baseRow({
                user: "alice@localhost",
                schemaPrivileges: { sakila: ["SELECT"], app: ["INSERT"] },
                tablePrivileges: [{ schema: "sakila", table: "actor", privileges: ["UPDATE"] }],
                columnPrivileges: [{
                    schema: "sakila", table: "actor", column: "first_name", privileges: ["SELECT"],
                }],
                routinePrivileges: [{
                    schema: "sakila", routine: "missing_routine", routineType: "PROCEDURE", privileges: ["EXECUTE"],
                }],
            }),
        ]);
        const catalog: IMySQLGlobalPrivilegeCatalogItem[] = [
            { privilege: "SELECT", category: "Databases,Tables", description: "To retrieve rows" },
            { privilege: "UPDATE", category: "Databases,Tables", description: "To update rows" },
            { privilege: "EXECUTE", category: "Functions,Procedures", description: "To execute routines" },
        ];
        const listSchemasSpy = vi.spyOn(backend, "getCatalogObjects").mockResolvedValue(["sakila", "app"]);
        const listSchemaTargetsSpy = vi.spyOn(backend, "listMySQLObjectPrivilegeSchemaTargets").mockImplementation(
            (schema: string) => {
                if (schema === "sakila") {
                    return Promise.resolve([
                        { kind: "table", objectName: "actor", routineType: null },
                        { kind: "routine", objectName: "film_in_stock", routineType: "PROCEDURE" },
                    ]);
                }

                return Promise.resolve([]);
            });
        const listColumnsSpy = vi.spyOn(backend, "getTableObjectNames").mockResolvedValue(["first_name", "last_name"]);
        const listCatalogSpy = vi.spyOn(backend, "listMySQLSchemaPrivilegeCatalog").mockResolvedValue(catalog);
        const getUserSpy = vi.spyOn(backend, "getMySQLUser").mockResolvedValue(baseUserDetails());
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        const objectPrivilegeDialogRef = getPrivate<{ current: { show: (
        values: IDialogValues,
        opts: { title: string },
        data: Record<string, unknown>,
        ) => void } }>(instance, "manageRolesAndPrivilegesDialogRef");
        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
            expect(objectPrivilegeDialogRef.current).toBeTruthy();
        });
        const showSpy = vi.spyOn(objectPrivilegeDialogRef.current, "show");

        const event = makeEvent(makeUserAccountPill());
        const cell = makeCell(
            baseRow({
                user: "alice@localhost",
                schemaPrivileges: { sakila: ["SELECT"], app: ["INSERT"] },
                tablePrivileges: [{ schema: "sakila", table: "actor", privileges: ["UPDATE"] }],
                columnPrivileges: [{
                    schema: "sakila", table: "actor", column: "first_name", privileges: ["SELECT"],
                }],
                routinePrivileges: [{
                    schema: "sakila", routine: "missing_routine", routineType: "PROCEDURE", privileges: ["EXECUTE"],
                }],
            }),
            undefined,
            "objectPrivileges",
        );
        const handleUserAccountsCellClick = getPrivate<(event: Event, cell: CellComponent) => void>(
            instance, "handleUserAccountsCellClick");
        handleUserAccountsCellClick(event, cell);

        await waitFor(() => {
            expect(listSchemasSpy).toHaveBeenCalledTimes(1);
            expect(listSchemasSpy).toHaveBeenCalledWith("Schema");
            expect(listCatalogSpy).toHaveBeenCalledTimes(1);
            expect(showSpy).toHaveBeenCalledTimes(1);
        });
        expect(listSchemaTargetsSpy).not.toHaveBeenCalled();
        expect(listColumnsSpy).not.toHaveBeenCalled();

        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(event.stopPropagation).toHaveBeenCalledTimes(1);
        expect(getUserSpy).not.toHaveBeenCalled();

        const [values, options, data] = showSpy.mock.calls[0] as [
            IDialogValues,
            { title: string },
            { user: string; host: string },
        ];
        const privilegeValue = values.sections.get("objectPrivileges")?.values.privileges as {
            type: "custom";
            value: {
                catalogs: Record<string, IMySQLGlobalPrivilegeCatalogItem[]>;
                schemas: string[];
                targets: Array<{ id: string; kind: string; available: boolean }>;
                privileges: Record<string, Record<string, string[]>>;
                originalPrivileges: Record<string, Record<string, string[]>>;
                selectedTargetId: string;
                loadSchemaTargets: (schema: string) => Promise<{
                    targets: Array<{ id: string; kind: string; available: boolean }>;
                }>;
                loadTableColumns: (schema: string, table: string) => Promise<{
                    targets: Array<{ id: string; kind: string; available: boolean }>;
                }>;
            };
            component: VNode;
        };
        expect(options).toEqual({ title: "Roles and Privileges for alice@localhost" });
        expect(data).toEqual({
            user: "alice",
            host: "localhost",
            initialRoles: [],
            initialDefaultRoles: [],
            initialGlobalPrivileges: [],
        });
        expect(values.sections.get("objectPrivileges")?.active).toBe(true);
        expect(privilegeValue.value.schemas).toEqual(["app", "sakila"]);
        expect(privilegeValue.value.selectedTargetId).toBe(JSON.stringify(["schema", "app", undefined, undefined]));
        expect(privilegeValue.value.targets).toEqual([
            expect.objectContaining({ id: JSON.stringify(["schema", "app", undefined, undefined]), kind: "schema",
                available: true }),
            expect.objectContaining({ id: JSON.stringify(["schema", "sakila", undefined, undefined]), kind: "schema",
                available: true }),
        ]);
        const schemaTargets = await privilegeValue.value.loadSchemaTargets("sakila");
        expect(listSchemaTargetsSpy).toHaveBeenCalledWith("sakila");
        expect(schemaTargets.targets).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: JSON.stringify(["table", "sakila", "actor", undefined]), kind: "table",
                available: true }),
            expect.objectContaining({
                id: JSON.stringify(["routine", "sakila", "film_in_stock", "PROCEDURE"]),
                kind: "routine", available: true,
            }),
            expect.objectContaining({ id: JSON.stringify(["routine", "sakila", "missing_routine", "PROCEDURE"]),
                kind: "routine", available: false }),
        ]));
        const columnTargets = await privilegeValue.value.loadTableColumns("sakila", "actor");
        expect(listColumnsSpy).toHaveBeenCalledWith("sakila", "actor", "Column");
        expect(columnTargets.targets).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: JSON.stringify(["column", "sakila", "actor", "first_name"]), kind: "column",
                available: true }),
        ]));
        expect(privilegeValue.value.privileges).toEqual({
            schema: { sakila: ["SELECT"], app: ["INSERT"] },
            table: { [JSON.stringify(["table", "sakila", "actor", undefined, undefined])]: ["UPDATE"] },
            column: { [JSON.stringify(["column", "sakila", "actor", undefined, "first_name"])]: ["SELECT"] },
            routine: { [JSON.stringify(["routine", "sakila", "missing_routine", "PROCEDURE"])]: ["EXECUTE"] },
        });
        expect(privilegeValue.value.catalogs.schema).toEqual([
            {
                privilege: "INSERT",
                category: "",
                description: "Currently granted but not reported by SHOW PRIVILEGES.",
            },
            { privilege: "SELECT", category: "Databases,Tables", description: "To retrieve rows" },
            { privilege: "UPDATE", category: "Databases,Tables", description: "To update rows" },
        ]);
        expect(privilegeValue.value.catalogs.routine).toEqual([
            { privilege: "EXECUTE", category: "Functions,Procedures", description: "To execute routines" },
        ]);
    });

    it("clicking outside the object privileges value container does not open the object privilege dialog", async ({
        expect,
    }) => {
        const backend = new ShellInterfaceSqlEditor();
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([
            baseRow({ user: "alice@localhost", schemaPrivileges: { sakila: ["SELECT"] } }),
        ]);
        const listSchemasSpy = vi.spyOn(backend, "getCatalogObjects").mockResolvedValue(["sakila"]);
        const listCatalogSpy = vi.spyOn(backend, "listMySQLSchemaPrivilegeCatalog").mockResolvedValue([]);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        const objectPrivilegeDialogRef = getPrivate<{ current: { show: (
        values: IDialogValues,
        opts: { title: string },
        data: Record<string, unknown>,
        ) => void } }>(instance, "manageRolesAndPrivilegesDialogRef");
        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
            expect(objectPrivilegeDialogRef.current).toBeTruthy();
        });
        const showSpy = vi.spyOn(objectPrivilegeDialogRef.current, "show");

        const event = makeEvent(document.createElement("div"));
        const cell = makeCell(
            baseRow({ user: "alice@localhost", schemaPrivileges: { sakila: ["SELECT"] } }),
            undefined,
            "objectPrivileges",
        );
        const handleUserAccountsCellClick = getPrivate<(event: Event, cell: CellComponent) => void>(
            instance, "handleUserAccountsCellClick");
        handleUserAccountsCellClick(event, cell);

        expect(listSchemasSpy).not.toHaveBeenCalled();
        expect(listCatalogSpy).not.toHaveBeenCalled();
        expect(showSpy).not.toHaveBeenCalled();
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(event.stopPropagation).not.toHaveBeenCalled();
    });

    it("object privilege dialog leaves inherited globals unselected and marks non-schema targets read-only", async ({
        expect,
    }) => {
        const backend = new ShellInterfaceSqlEditor();
        vi.spyOn(backend, "isPartialRevokesEnabled").mockResolvedValue(true);
        vi.spyOn(backend, "listMySQLSchemaPrivilegeCatalog").mockResolvedValue([
            { privilege: "SELECT", category: "Databases,Tables", description: "To retrieve rows" },
        ]);
        vi.spyOn(backend, "getCatalogObjects").mockResolvedValue(["app"]);
        vi.spyOn(backend, "listMySQLObjectPrivilegeSchemaTargets").mockResolvedValue([
            { kind: "table", objectName: "orders", routineType: null },
        ]);
        vi.spyOn(backend, "getTableObjectNames").mockResolvedValue(["id"]);
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const createObjectPrivilegeEditorData = getPrivate<(
        backend: ShellInterfaceSqlEditor,
        rowData: IMySQLUserListItem,
        ) => Promise<{
            privileges: Record<string, Record<string, string[]>>;
            inheritedPrivileges: Record<string, Record<string, string[]>>;
            roleInheritedPrivileges: Record<string, Record<string, string[]>>;
            partialRevokePrivileges: Record<string, Record<string, string[]>>;
            readonlyPrivileges: Record<string, Record<string, string[]>>;
        }>>(instance, "createObjectPrivilegeEditorData");

        const data = await createObjectPrivilegeEditorData.call(instance, backend,
            baseRow({ user: "alice@localhost", globalPrivileges: ["SELECT"] }));

        expect(data.privileges.schema.app).toBeUndefined();
        const tableKey = JSON.stringify(["table", "app", "orders", undefined, undefined]);
        const columnKey = JSON.stringify(["column", "app", "orders", undefined, "id"]);
        expect(data.privileges.table[tableKey]).toBeUndefined();
        expect(data.privileges.column[columnKey]).toBeUndefined();
        const schemaTargets = await (data as typeof data & {
            loadSchemaTargets: (schema: string) => Promise<{
                privilegeState: {
                    inherited: Record<string, Record<string, string[]>>;
                    readonly: Record<string, Record<string, string[]>>;
                };
            }>;
            loadTableColumns: (schema: string, table: string) => Promise<{
                privilegeState: {
                    inherited: Record<string, Record<string, string[]>>;
                    readonly: Record<string, Record<string, string[]>>;
                };
            }>;
        }).loadSchemaTargets("app");
        const columnTargets = await (data as typeof data & {
            loadTableColumns: (schema: string, table: string) => Promise<{
                privilegeState: {
                    inherited: Record<string, Record<string, string[]>>;
                    readonly: Record<string, Record<string, string[]>>;
                };
            }>;
        }).loadTableColumns("app", "orders");
        expect(schemaTargets.privilegeState.inherited.table[tableKey]).toEqual(["SELECT"]);
        expect(data.roleInheritedPrivileges.schema.app).toBeUndefined();
        expect(schemaTargets.privilegeState.readonly.table[tableKey]).toEqual(["SELECT"]);
        expect(columnTargets.privilegeState.readonly.column[columnKey]).toEqual(["SELECT"]);
        expect(data.readonlyPrivileges.schema.app).toBeUndefined();
    });

    it("object privilege dialog keeps role-inherited schema privilege markers non-revocable", async ({
        expect,
    }) => {
        const backend = new ShellInterfaceSqlEditor();
        vi.spyOn(backend, "isPartialRevokesEnabled").mockResolvedValue(true);
        vi.spyOn(backend, "listMySQLSchemaPrivilegeCatalog").mockResolvedValue([
            { privilege: "SELECT", category: "Databases,Tables", description: "To retrieve rows" },
        ]);
        vi.spyOn(backend, "getCatalogObjects").mockResolvedValue(["app"]);
        vi.spyOn(backend, "listMySQLObjectPrivilegeSchemaTargets").mockResolvedValue([]);
        vi.spyOn(backend, "getTableObjectNames").mockResolvedValue([]);
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const alice = baseRow({ user: "alice@localhost", roles: ["reader@%"], globalPrivileges: [] });
        const reader = baseRow({ user: "reader@%", isRole: true, schemaPrivileges: { app: ["SELECT"] } });
        instance.setState({ rows: [alice, reader] });
        const createObjectPrivilegeEditorData = getPrivate<(
        backend: ShellInterfaceSqlEditor,
        rowData: IMySQLUserListItem,
        ) => Promise<{
            privileges: Record<string, Record<string, string[]>>;
            inheritedPrivileges: Record<string, Record<string, string[]>>;
            roleInheritedPrivileges: Record<string, Record<string, string[]>>;
            partialRevokePrivileges: Record<string, Record<string, string[]>>;
        }>>(instance, "createObjectPrivilegeEditorData");

        const data = await createObjectPrivilegeEditorData.call(instance, backend, alice);

        expect(data.privileges.schema.app).toBeUndefined();
        expect(data.inheritedPrivileges.schema.app).toEqual(["SELECT"]);
        expect(data.roleInheritedPrivileges.schema.app).toEqual(["SELECT"]);
        expect(data.partialRevokePrivileges.schema.app).toBeUndefined();
    });

    it("object privilege dialog makes role-global privileges eligible for partial revokes", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        vi.spyOn(backend, "isPartialRevokesEnabled").mockResolvedValue(true);
        vi.spyOn(backend, "listMySQLSchemaPrivilegeCatalog").mockResolvedValue([
            { privilege: "SELECT", category: "Databases,Tables", description: "To retrieve rows" },
        ]);
        vi.spyOn(backend, "getCatalogObjects").mockResolvedValue(["app"]);
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const alice = baseRow({ user: "alice@localhost", roles: ["reader@%"] });
        const reader = baseRow({ user: "reader@%", isRole: true, globalPrivileges: ["SELECT"] });
        instance.setState({ rows: [alice, reader], partialRevokesEnabled: true });
        const createObjectPrivilegeEditorData = getPrivate<(
        backend: ShellInterfaceSqlEditor,
        rowData: IMySQLUserListItem,
        ) => Promise<{
            inheritedPrivileges: Record<string, Record<string, string[]>>;
            partialRevokePrivileges: Record<string, Record<string, string[]>>;
        }>>(instance, "createObjectPrivilegeEditorData");

        const data = await createObjectPrivilegeEditorData.call(instance, backend, alice);

        expect(data.inheritedPrivileges.schema.app).toEqual(["SELECT"]);
        expect(data.partialRevokePrivileges.schema.app).toEqual(["SELECT"]);
    });

    it("role dialog editor filters available roles and removes assigned roles", ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        const createRoleDialogValues = getPrivate<(
        availableRoles: string[],
        selectedRoles: string[],
        defaultRoles: string[],
        ) => IDialogValues>(instance, "createRoleDialogValues");
        const values = createRoleDialogValues(
            ["auditor@%", "mysql_rest_service@%", "reader@%", "writer@%"],
            ["reader@%"],
            [],
        );
        const rolesValue = values.sections.get("roles")?.values.roles as {
            value: { availableRoles: string[]; selectedRoles: string[]; defaultRoles: string[] };
            component: VNode;
        };
        const onDataChange = vi.fn<(value: Record<string, unknown>) => void>();
        const { container, rerender } = render(cloneElement(rolesValue.component, {
            values: rolesValue.value,
            onDataChange,
        }));

        const descriptions = container.querySelectorAll(".userAccountRoleDescription");
        expect(descriptions[0].textContent).toBe("0 default roles will be automatically activated at login.");
        expect(descriptions[1].textContent).toBe(
            "Select assigned roles to set them as default roles for this account.",
        );
        expect(container.querySelector(".userAccountAssignedRoles")?.nextElementSibling).toBe(descriptions[1]);

        const availableRoleTable = container.querySelector(".userAccountRoleTable")!;
        expect(within(availableRoleTable).getByText("Roles")).toBeTruthy();
        expect(within(availableRoleTable).queryByText("reader@%")).toBeNull();
        expect(within(availableRoleTable).getByText("auditor@%")).toBeTruthy();
        expect(within(availableRoleTable).getByText("writer@%")).toBeTruthy();
        expect(within(availableRoleTable).getByText("mysql_rest_service@%").nextElementSibling?.classList
            .contains("codicon-add")).toBe(true);
        fireEvent.click(within(availableRoleTable).getByText("Roles"));
        expect(availableRoleTable.querySelectorAll(".userAccountRoleResult")[0].textContent).toContain("writer@%");

        const input = container.querySelector(".userAccountRoleFilter")!;
        fireEvent.input(input, { target: { value: "mysql_rest" } });
        expect(availableRoleTable.querySelector("input[type='checkbox']")).toBeNull();
        expect(within(availableRoleTable).getByText("mysql_rest_service@%")).toBeTruthy();

        fireEvent.input(input, { target: { value: "wri" } });
        expect(within(availableRoleTable).queryByText("reader@%")).toBeNull();
        expect(within(availableRoleTable).queryByText("auditor@%")).toBeNull();
        expect(within(availableRoleTable).getByText("writer@%")).toBeTruthy();

        fireEvent.click(within(availableRoleTable).getByText("writer@%").nextElementSibling!);
        expect(onDataChange).toHaveBeenLastCalledWith({
            availableRoles: ["auditor@%", "mysql_rest_service@%", "reader@%", "writer@%"],
            selectedRoles: ["reader@%", "writer@%"],
            defaultRoles: [],
        });

        rerender(cloneElement(rolesValue.component, {
            values: {
                availableRoles: ["auditor@%", "mysql_rest_service@%", "reader@%", "writer@%"],
                selectedRoles: ["reader@%", "writer@%"],
                defaultRoles: [],
            },
            onDataChange,
        }));
        expect(within(availableRoleTable).queryByText("writer@%")).toBeNull();
        fireEvent.click(within(container).getByText("writer@%"));
        expect(onDataChange).toHaveBeenLastCalledWith({
            availableRoles: ["auditor@%", "mysql_rest_service@%", "reader@%", "writer@%"],
            selectedRoles: ["reader@%", "writer@%"],
            defaultRoles: ["writer@%"],
        });

        rerender(cloneElement(rolesValue.component, {
            values: {
                availableRoles: ["auditor@%", "mysql_rest_service@%", "reader@%", "writer@%"],
                selectedRoles: ["reader@%", "writer@%"],
                defaultRoles: ["writer@%"],
            },
            onDataChange,
        }));
        expect(container.querySelector(".userAccountRoleChip.defaultRole")).toBeTruthy();
        expect(descriptions[0].textContent).toBe("1 default role will be automatically activated at login.");

        const removeButton = container.querySelector("[data-tooltip='Remove writer@%']")!;
        fireEvent.click(removeButton);
        expect(onDataChange).toHaveBeenLastCalledWith({
            availableRoles: ["auditor@%", "mysql_rest_service@%", "reader@%", "writer@%"],
            selectedRoles: ["reader@%"],
            defaultRoles: [],
        });
    });

    it("global privilege dialog editor filters available privileges and updates assignments", ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        const createGlobalPrivilegesDialogValues = getPrivate<(
        catalog: IMySQLGlobalPrivilegeCatalogItem[],
        selectedPrivileges: string[],
        inheritedPrivileges?: string[],
        ) => IDialogValues>(instance, "createGlobalPrivilegesDialogValues");
        const catalog: IMySQLGlobalPrivilegeCatalogItem[] = [
            { privilege: "SELECT", category: "Tables", description: "To retrieve rows" },
            { privilege: "INSERT", category: "Tables", description: "To insert rows" },
            { privilege: "BACKUP_ADMIN", category: "Server Admin", description: "Backup operations" },
            { privilege: "CREATE", category: "Databases,Tables,Indexes", description: "To create objects" },
        ];
        const values = createGlobalPrivilegesDialogValues(catalog, ["SELECT", "BACKUP_ADMIN"]);
        const privilegeValue = values.sections.get("privileges")?.values.privileges as {
            value: {
                catalog: IMySQLGlobalPrivilegeCatalogItem[];
                selectedPrivileges: string[];
                inheritedPrivileges: string[];
            };
            component: VNode;
        };
        const onDataChange = vi.fn<(value: Record<string, unknown>) => void>();
        const { container, rerender } = render(cloneElement(privilegeValue.component, {
            values: privilegeValue.value,
            onDataChange,
        }));
        const availablePrivilegeTable = container.querySelector(".userAccountGlobalPrivilegeTable")!;
        expect(within(availablePrivilegeTable).getByText("CREATE")).toBeTruthy();
        expect(within(availablePrivilegeTable).getByText("INSERT")).toBeTruthy();
        expect(within(availablePrivilegeTable).queryByText("SELECT")).toBeNull();
        expect(within(availablePrivilegeTable).getByText("CREATE").closest(".userAccountPrivilegeResult")?.textContent)
            .toBe("CREATEDatabases, Tables, Indexes");
        expect(within(availablePrivilegeTable).getByText("INSERT").closest(".userAccountPrivilegeResult")?.textContent)
            .toBe("INSERTTables");
        expect(within(container).getByText("Assigned privileges")).toBeTruthy();
        expect(within(container).getByText("Available privileges")).toBeTruthy();
        expect(within(availablePrivilegeTable).getByText("Privilege")).toBeTruthy();
        expect(within(availablePrivilegeTable).getByText("Category")).toBeTruthy();
        expect(container.querySelector(".userAccountPrivilegeChip")).toBeTruthy();
        expect(within(availablePrivilegeTable).getByText("INSERT").closest(".userAccountPrivilegeResult")!
            .querySelector(".codicon-add")).toBeTruthy();
        expect(within(availablePrivilegeTable).getByText("INSERT").closest(".userAccountPrivilegeResult")!
            .lastElementChild?.classList.contains("codicon-add")).toBe(true);
        fireEvent.click(within(availablePrivilegeTable).getByText("Category"));
        fireEvent.click(within(availablePrivilegeTable).getByText("Category"));
        expect(container.querySelectorAll(".userAccountPrivilegeResult")[0].textContent)
            .toContain("INSERT");

        fireEvent.click(within(availablePrivilegeTable).getByText("Privilege"));
        expect(container.querySelectorAll(".userAccountPrivilegeResult")[0].textContent)
            .toContain("CREATE");

        const input = container.querySelector(".userAccountPrivilegeFilter")!;
        fireEvent.input(input, { target: { value: "insert" } });
        expect(within(availablePrivilegeTable).getByText("INSERT")).toBeTruthy();
        expect(within(availablePrivilegeTable).queryByText("CREATE")).toBeNull();

        fireEvent.click(within(availablePrivilegeTable).getByText("INSERT").closest(
            ".userAccountPrivilegeResult",
        )!);
        expect(onDataChange).toHaveBeenLastCalledWith({
            catalog,
            selectedPrivileges: ["BACKUP_ADMIN", "INSERT", "SELECT"],
            inheritedPrivileges: [],
        });

        rerender(cloneElement(privilegeValue.component, {
            values: {
                catalog,
                selectedPrivileges: ["BACKUP_ADMIN", "INSERT", "SELECT"],
                inheritedPrivileges: [],
            },
            onDataChange,
        }));
        expect(within(availablePrivilegeTable).queryByText("INSERT")).toBeNull();
        fireEvent.click(container.querySelector("[data-tooltip='Remove INSERT']")!);
        expect(onDataChange).toHaveBeenLastCalledWith({
            catalog,
            selectedPrivileges: ["BACKUP_ADMIN", "SELECT"],
            inheritedPrivileges: [],
        });
    });

    it("global privilege dialog editor marks inherited privileges without selecting them", ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        const createGlobalPrivilegesDialogValues = getPrivate<(
        catalog: IMySQLGlobalPrivilegeCatalogItem[],
        selectedPrivileges: string[],
        inheritedPrivileges?: string[],
        ) => IDialogValues>(instance, "createGlobalPrivilegesDialogValues");
        const catalog: IMySQLGlobalPrivilegeCatalogItem[] = [
            { privilege: "SELECT", category: "Tables", description: "To retrieve rows" },
            { privilege: "INSERT", category: "Tables", description: "To insert rows" },
        ];
        const values = createGlobalPrivilegesDialogValues(catalog, ["SELECT"], ["INSERT"]);
        const privilegeValue = values.sections.get("privileges")?.values.privileges as {
            value: {
                catalog: IMySQLGlobalPrivilegeCatalogItem[];
                selectedPrivileges: string[];
                inheritedPrivileges: string[];
            };
            component: VNode;
        };
        const onDataChange = vi.fn();
        const { container } = render(cloneElement(privilegeValue.component, {
            values: privilegeValue.value,
            onDataChange,
        }));
        const availablePrivilegeTable = container.querySelector(".userAccountGlobalPrivilegeTable")!;
        expect(within(container).getByText("INHERITED")).toBeTruthy();
        fireEvent.click(within(availablePrivilegeTable).getByText("INSERT").closest(
            ".userAccountPrivilegeResult",
        )!);
        expect(onDataChange).toHaveBeenLastCalledWith({
            catalog,
            selectedPrivileges: ["INSERT", "SELECT"],
            inheritedPrivileges: ["INSERT"],
        });
    });

    it("global privilege dialog editor can deselect directly granted inherited privileges", ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        const createGlobalPrivilegesDialogValues = getPrivate<(
        catalog: IMySQLGlobalPrivilegeCatalogItem[],
        selectedPrivileges: string[],
        inheritedPrivileges?: string[],
        ) => IDialogValues>(instance, "createGlobalPrivilegesDialogValues");
        const catalog: IMySQLGlobalPrivilegeCatalogItem[] = [
            { privilege: "SELECT", category: "Tables", description: "To retrieve rows" },
            { privilege: "INSERT", category: "Tables", description: "To insert rows" },
        ];
        const values = createGlobalPrivilegesDialogValues(catalog, ["INSERT", "SELECT"], ["INSERT"]);
        const privilegeValue = values.sections.get("privileges")?.values.privileges as {
            value: {
                catalog: IMySQLGlobalPrivilegeCatalogItem[];
                selectedPrivileges: string[];
                inheritedPrivileges: string[];
            };
            component: VNode;
        };
        const onDataChange = vi.fn();
        const { container } = render(cloneElement(privilegeValue.component, {
            values: privilegeValue.value,
            onDataChange,
        }));
        expect(within(container).queryByText("INHERITED")).toBeNull();
        fireEvent.click(container.querySelector("[data-tooltip='Remove INSERT']")!);
        expect(onDataChange).toHaveBeenLastCalledWith({
            catalog,
            selectedPrivileges: ["SELECT"],
            inheritedPrivileges: ["INSERT"],
        });
    });

    it("object privilege dialog editor selects targets and updates object privileges", async ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        const createObjectPrivilegesDialogValuesPrivate = getPrivate<(
        data: Record<string, unknown>,
        ) => IDialogValues>(instance, "createObjectPrivilegesDialogValues");
        const createObjectPrivilegesDialogValues = (data: Record<string, unknown>): IDialogValues => {
            return createObjectPrivilegesDialogValuesPrivate(normalizeObjectPrivilegeFixture(data));
        };
        const schemaCatalog: IMySQLGlobalPrivilegeCatalogItem[] = [
            { privilege: "DELETE", category: "Databases,Tables", description: "To delete rows" },
            { privilege: "SELECT", category: "Databases,Tables", description: "To retrieve rows" },
            { privilege: "INSERT", category: "Databases,Tables", description: "To insert rows" },
        ];
        const emptyPrivilegeMaps = { schema: {}, table: {}, routine: {}, column: {} };
        const emptyPrivilegeState = {
            direct: emptyPrivilegeMaps,
            inherited: emptyPrivilegeMaps,
            roleInherited: emptyPrivilegeMaps,
            restricted: emptyPrivilegeMaps,
            readonly: emptyPrivilegeMaps,
            effective: emptyPrivilegeMaps,
        };
        let resolveSchemaTargets: (value: {
            targets: [];
            privilegeState: typeof emptyPrivilegeState;
        }) => void = () => { /* Assigned by loadSchemaTargets. */ };
        const values = createObjectPrivilegesDialogValues({
            catalogs: {
                schema: schemaCatalog,
                table: [{ privilege: "UPDATE", category: "Tables", description: "To update rows" }],
                routine: [{ privilege: "EXECUTE", category: "Functions,Procedures", description: "" }],
                column: [{ privilege: "SELECT", category: "Tables", description: "" }],
            },
            schemas: ["app", "sakila"],
            targets: [
                { id: "schema:app", kind: "schema", schema: "app", label: "app", available: true },
                { id: "schema:sakila", kind: "schema", schema: "sakila", label: "sakila", available: true },
                { id: "table:app.orders", kind: "table", schema: "app", table: "orders", label: "app.orders",
                    available: true },
                { id: "column:app.orders(id)", kind: "column", schema: "app", table: "orders", column: "id",
                    label: "app.orders.id", available: true },
                { id: "routine:app.refresh", kind: "routine", schema: "app", routine: "refresh",
                    routineType: "PROCEDURE", label: "app.refresh", available: false },
            ],
            privileges: {
                schema: { app: ["SELECT"], sakila: ["INSERT"] },
                table: { "app.orders": ["UPDATE"] },
                routine: { "app.refresh": ["EXECUTE"] },
                column: { "app.orders(id)": ["SELECT"] },
            },
            originalPrivileges: {
                schema: { app: ["SELECT"], sakila: ["INSERT"] },
                table: { "app.orders": ["UPDATE"] },
                routine: { "app.refresh": ["EXECUTE"] },
                column: { "app.orders(id)": ["SELECT"] },
            },
            directPrivileges: {
                schema: { app: ["SELECT"], sakila: ["INSERT"] },
                table: { "app.orders": ["UPDATE"] },
                routine: { "app.refresh": ["EXECUTE"] },
                column: { "app.orders(id)": ["SELECT"] },
            },
            inheritedPrivileges: {
                schema: {},
                table: {},
                routine: {},
                column: {},
            },
            roleInheritedPrivileges: {
                schema: {},
                table: {},
                routine: {},
                column: {},
            },
            restrictedPrivileges: {
                schema: {},
                table: {},
                routine: {},
                column: {},
            },
            readonlyPrivileges: {
                schema: {},
                table: {},
                routine: {},
                column: {},
            },
            selectedTargetId: "schema:app",
            loadSchemaTargets: () => {
                return new Promise<{
                    targets: [];
                    privilegeState: typeof emptyPrivilegeState;
                }>((resolve) => {
                    resolveSchemaTargets = resolve;
                });
            },
        });
        const privilegeValue = values.sections.get("privileges")?.values.privileges as {
            value: {
                catalogs: Record<string, IMySQLGlobalPrivilegeCatalogItem[]>;
                schemas: string[];
                targets: unknown[];
                privileges: Record<string, Record<string, string[]>>;
                originalPrivileges: Record<string, Record<string, string[]>>;
                directPrivileges: Record<string, Record<string, string[]>>;
                inheritedPrivileges: Record<string, Record<string, string[]>>;
                restrictedPrivileges: Record<string, Record<string, string[]>>;
                readonlyPrivileges: Record<string, Record<string, string[]>>;
                selectedTargetId: string;
            };
            component: VNode;
        };
        const onDataChange = vi.fn();
        const { container, rerender } = render(cloneElement(privilegeValue.component, {
            values: privilegeValue.value,
            onDataChange,
        }));

        expect(container.querySelector(".userAccountObjectTarget.selected")?.textContent).toContain("app");
        expect(within(container).getByText("Assigned privileges")).toBeTruthy();
        expect(within(container).getByText("Available privileges")).toBeTruthy();
        const availablePrivilegeTable = container.querySelector(".userAccountObjectPrivilegeTable")!;
        expect(within(availablePrivilegeTable).getByText("Privileges")).toBeTruthy();
        fireEvent.click(within(availablePrivilegeTable).getByText("Privileges"));
        expect(availablePrivilegeTable.querySelectorAll(".userAccountPrivilegeResult")[0].textContent)
            .toContain("INSERT");
        expect(within(container).queryByText("orders")).toBeNull();
        expect(within(container).queryByText("id")).toBeNull();
        expect(within(container).queryByText("refresh")).toBeNull();
        expect(within(container).getByText("5 targets with grants")).toBeTruthy();

        fireEvent.click(container.querySelector(".userAccountObjectTreeChevron")!);
        const schemaTarget = container.querySelector(".userAccountObjectTarget.selected")!;
        expect(schemaTarget.querySelector(".userAccountObjectLoading")).toBeTruthy();
        expect(schemaTarget.querySelector(".userAccountObjectLoading + .userAccountObjectGrantCount"))
            .toBeTruthy();
        expect(within(container).queryByText("Loading objects...")).toBeNull();
        resolveSchemaTargets({ targets: [], privilegeState: emptyPrivilegeState });
        await waitFor(() => {
            expect(within(container).getByText("orders")).toBeTruthy();
            expect(schemaTarget.querySelector(".userAccountObjectLoading")).toBeNull();
        });
        expect(within(container).queryByText("id")).toBeNull();
        expect(within(container).getByText("refresh")).toBeTruthy();
        expect(within(container).queryByText("app.orders")).toBeNull();
        expect(within(container).queryByText("app.refresh")).toBeNull();
        expect(within(container).getByText("orders").closest(".userAccountObjectTarget")?.classList
            .contains("hasPrivileges")).toBe(true);
        expect(container.querySelectorAll(".userAccountObjectTargetIcon")).toHaveLength(4);
        expect(container.querySelectorAll(".userAccountObjectPrivilegeTitleIcon")).toHaveLength(1);

        fireEvent.click(within(container).getByText("refresh"));
        expect(onDataChange).toHaveBeenLastCalledWith(expect.objectContaining({
            catalogs: privilegeValue.value.catalogs,
            schemas: ["app", "sakila"],
            targets: privilegeValue.value.targets,
            privileges: privilegeValue.value.privileges,
            originalPrivileges: privilegeValue.value.originalPrivileges,
            selectedTargetId: JSON.stringify(["routine", "app", "refresh", "PROCEDURE"]),
        }));

        rerender(cloneElement(privilegeValue.component, {
            values: {
                ...privilegeValue.value,
                selectedTargetId: JSON.stringify(["routine", "app", "refresh", "PROCEDURE"]),
            },
            onDataChange,
        }));
        expect(within(container).getByText("Currently granted, unavailable")).toBeTruthy();
        fireEvent.click(container.querySelector("[data-tooltip='Remove EXECUTE']")!);
        expect(onDataChange).toHaveBeenLastCalledWith(expect.objectContaining({
            selectedTargetId: JSON.stringify(["routine", "app", "refresh", "PROCEDURE"]),
            privileges: {
                ...privilegeValue.value.privileges,
                routine: {
                    [JSON.stringify(["routine", "app", "refresh", "PROCEDURE"])]: [],
                },
            },
            directPrivileges: {
                ...privilegeValue.value.directPrivileges,
                routine: {
                    [JSON.stringify(["routine", "app", "refresh", "PROCEDURE"])]: [],
                },
            },
        }));

        fireEvent.click(within(container).getByText("orders"));
        expect(onDataChange).toHaveBeenLastCalledWith(expect.objectContaining({
            catalogs: privilegeValue.value.catalogs,
            schemas: ["app", "sakila"],
            targets: privilegeValue.value.targets,
            privileges: privilegeValue.value.privileges,
            originalPrivileges: privilegeValue.value.originalPrivileges,
            selectedTargetId: JSON.stringify(["table", "app", "orders", undefined]),
        }));

        rerender(cloneElement(privilegeValue.component, {
            values: {
                ...privilegeValue.value,
                selectedTargetId: JSON.stringify(["table", "app", "orders", undefined]),
            },
            onDataChange,
        }));
        fireEvent.click(container.querySelector("[data-tooltip='Remove UPDATE']")!);
        expect(onDataChange).toHaveBeenLastCalledWith(expect.objectContaining({
            selectedTargetId: JSON.stringify(["table", "app", "orders", undefined]),
            privileges: {
                ...privilegeValue.value.privileges,
                table: {
                    [JSON.stringify(["table", "app", "orders", undefined, undefined])]: [],
                },
            },
            directPrivileges: {
                ...privilegeValue.value.directPrivileges,
                table: {
                    [JSON.stringify(["table", "app", "orders", undefined, undefined])]: [],
                },
            },
        }));

        const orderNode = [...container.querySelectorAll(".userAccountObjectTreeNode")].find((node) => {
            return node.textContent?.includes("orders");
        });
        fireEvent.click(orderNode!.querySelector(".userAccountObjectTreeChevron")!);
        expect(within(container).getByText("id")).toBeTruthy();
        expect(container.querySelectorAll(".userAccountObjectTargetIcon")).toHaveLength(5);

        fireEvent.click(within(container).getByText("id"));
        expect(onDataChange).toHaveBeenLastCalledWith(expect.objectContaining({
            catalogs: privilegeValue.value.catalogs,
            schemas: ["app", "sakila"],
            targets: privilegeValue.value.targets,
            privileges: privilegeValue.value.privileges,
            originalPrivileges: privilegeValue.value.originalPrivileges,
            selectedTargetId: JSON.stringify(["column", "app", "orders", "id"]),
        }));

        rerender(cloneElement(privilegeValue.component, {
            values: {
                ...privilegeValue.value,
                selectedTargetId: JSON.stringify(["column", "app", "orders", "id"]),
            },
            onDataChange,
        }));
        fireEvent.click(container.querySelector("[data-tooltip='Remove SELECT']")!);
        expect(onDataChange).toHaveBeenLastCalledWith(expect.objectContaining({
            selectedTargetId: JSON.stringify(["column", "app", "orders", "id"]),
            privileges: {
                ...privilegeValue.value.privileges,
                column: {
                    [JSON.stringify(["column", "app", "orders", undefined, "id"])]: [],
                },
            },
            directPrivileges: {
                ...privilegeValue.value.directPrivileges,
                column: {
                    [JSON.stringify(["column", "app", "orders", undefined, "id"])]: [],
                },
            },
        }));

        rerender(cloneElement(privilegeValue.component, {
            values: {
                ...privilegeValue.value,
                selectedTargetId: JSON.stringify(["schema", "sakila", undefined, undefined]),
            },
            onDataChange,
        }));
        fireEvent.input(container.querySelector(".userAccountPrivilegeFilter")!, {
            target: { value: "select" },
        });
        fireEvent.click(container.querySelector(".userAccountPrivilegeResult")!);
        expect(onDataChange).toHaveBeenLastCalledWith(expect.objectContaining({
            selectedTargetId: JSON.stringify(["schema", "sakila", undefined, undefined]),
            privileges: {
                ...privilegeValue.value.privileges,
                schema: {
                    app: ["SELECT"],
                    sakila: ["INSERT", "SELECT"],
                },
            },
            directPrivileges: {
                ...privilegeValue.value.directPrivileges,
                schema: {
                    app: ["SELECT"],
                    sakila: ["INSERT", "SELECT"],
                },
            },
        }));

    });

    it("keeps the available object privileges list within the panel and scrollable", ({ expect }) => {
        const documentCss = readFrontendSourceFile("src/modules/db-editor/assets/document.css");

        expect(documentCss).toMatch(
            /\.userAccountObjectPrivilegePanel\s*{[^}]*box-sizing: border-box;[^}]*min-height: 0;/s,
        );
        const availableSectionRule = documentCss.match(
            /\.userAccountObjectPrivilegePanel \.userAccountPrivilegeEditorSection:last-child\s*{[^}]*}/s,
        )?.[0];

        expect(availableSectionRule).toContain("flex: 1 1 auto;");
        expect(availableSectionRule).toContain("min-height: 0;");
        expect(documentCss).toMatch(/\.userAccountObjectPrivilegeTable\s*{\s*max-height: none;/s);
    });

    it("object privilege dialog editor handles schemas without existing grants", ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        const createObjectPrivilegesDialogValuesPrivate = getPrivate<(
        data: Record<string, unknown>,
        ) => IDialogValues>(instance, "createObjectPrivilegesDialogValues");
        const createObjectPrivilegesDialogValues = (data: Record<string, unknown>): IDialogValues => {
            return createObjectPrivilegesDialogValuesPrivate(normalizeObjectPrivilegeFixture(data));
        };
        const values = createObjectPrivilegesDialogValues({
            catalogs: {
                schema: [{ privilege: "SELECT", category: "Databases,Tables", description: "To retrieve rows" }],
                table: [],
                routine: [],
                column: [],
            },
            schemas: ["app", "empty"],
            targets: [
                { id: "schema:app", kind: "schema", schema: "app", label: "app", available: true },
                { id: "schema:empty", kind: "schema", schema: "empty", label: "empty", available: true },
            ],
            privileges: {
                schema: { app: ["SELECT"] },
                table: {},
                routine: {},
                column: {},
            },
            originalPrivileges: {
                schema: { app: ["SELECT"] },
                table: {},
                routine: {},
                column: {},
            },
            selectedTargetId: "schema:app",
        });
        const privilegeValue = values.sections.get("privileges")?.values.privileges as {
            value: {
                catalogs: Record<string, IMySQLGlobalPrivilegeCatalogItem[]>;
                schemas: string[];
                targets: unknown[];
                privileges: Record<string, Record<string, string[]>>;
                originalPrivileges: Record<string, Record<string, string[]>>;
                selectedTargetId: string;
            };
            component: VNode;
        };
        const onDataChange = vi.fn();
        const { container } = render(cloneElement(privilegeValue.component, {
            values: privilegeValue.value,
            onDataChange,
        }));

        expect(within(container).getAllByText("app").length).toBeGreaterThan(0);
        expect(within(container).getByText("empty")).toBeTruthy();
        expect(within(container).getByText("1 target with grants")).toBeTruthy();
    });

    it("object privilege dialog removes an empty schema chevron after expanding it", async ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const createObjectPrivilegesDialogValuesPrivate = getPrivate<(
        data: Record<string, unknown>,
        ) => IDialogValues>(instance, "createObjectPrivilegesDialogValues");
        const emptyPrivilegeMaps = { schema: {}, table: {}, routine: {}, column: {} };
        const values = createObjectPrivilegesDialogValuesPrivate(normalizeObjectPrivilegeFixture({
            catalogs: { schema: [], table: [], routine: [], column: [] },
            schemas: ["empty"],
            targets: [{ id: "schema:empty", kind: "schema", schema: "empty", label: "empty", available: true }],
            privileges: emptyPrivilegeMaps,
            originalPrivileges: emptyPrivilegeMaps,
            selectedTargetId: "schema:empty",
            loadSchemaTargets: () => {
                return Promise.resolve({
                    targets: [],
                    privilegeState: {
                        direct: emptyPrivilegeMaps,
                        inherited: emptyPrivilegeMaps,
                        roleInherited: emptyPrivilegeMaps,
                        restricted: emptyPrivilegeMaps,
                        readonly: emptyPrivilegeMaps,
                        effective: emptyPrivilegeMaps,
                    },
                });
            },
        }));
        const privilegeValue = values.sections.get("privileges")?.values.privileges as {
            value: Record<string, unknown>;
            component: VNode;
        };
        const onDataChange = vi.fn<(value: Record<string, unknown>) => void>();
        const { container, rerender } = render(cloneElement(privilegeValue.component, {
            values: privilegeValue.value,
            onDataChange,
        }));
        const initialChevron = container.querySelector(".userAccountObjectTreeChevron")!;

        fireEvent.click(initialChevron);
        await waitFor(() => {
            expect(onDataChange).toHaveBeenCalledWith(expect.objectContaining({
                targets: [expect.objectContaining({ schema: "empty", hasChildren: false })],
            }));
        });
        const [updatedValues] = onDataChange.mock.lastCall!;
        rerender(cloneElement(privilegeValue.component, { values: updatedValues, onDataChange }));

        const leaf = container.querySelector(".userAccountObjectTreeLeaf")!;
        expect(leaf.textContent).toBe("");
        expect(leaf.nextElementSibling?.classList.contains("userAccountObjectTarget")).toBe(true);
    });

    it("object privilege dialog marks inherited schema privileges without making them read-only", ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const createObjectPrivilegesDialogValuesPrivate = getPrivate<(
        data: Record<string, unknown>,
        ) => IDialogValues>(instance, "createObjectPrivilegesDialogValues");
        const createObjectPrivilegesDialogValues = (data: Record<string, unknown>): IDialogValues => {
            return createObjectPrivilegesDialogValuesPrivate(normalizeObjectPrivilegeFixture(data));
        };
        const values = createObjectPrivilegesDialogValues({
            catalogs: {
                schema: [{ privilege: "SELECT", category: "Databases,Tables", description: "" }],
                table: [],
                routine: [],
                column: [],
            },
            schemas: ["app"],
            targets: [
                { id: "schema:app", kind: "schema", schema: "app", label: "app", available: true },
            ],
            privileges: {
                schema: {},
                table: {},
                routine: {},
                column: {},
            },
            originalPrivileges: {
                schema: {},
                table: {},
                routine: {},
                column: {},
            },
            directPrivileges: {
                schema: {},
                table: {},
                routine: {},
                column: {},
            },
            inheritedPrivileges: {
                schema: { app: ["SELECT"] },
                table: {},
                routine: {},
                column: {},
            },
            roleInheritedPrivileges: {
                schema: { app: ["SELECT"] },
                table: {},
                routine: {},
                column: {},
            },
            restrictedPrivileges: {
                schema: {},
                table: {},
                routine: {},
                column: {},
            },
            readonlyPrivileges: {
                schema: {},
                table: {},
                routine: {},
                column: {},
            },
            selectedTargetId: "schema:app",
        });
        const privilegeValue = values.sections.get("privileges")?.values.privileges as {
            value: Record<string, unknown>;
            component: VNode;
        };
        const onDataChange = vi.fn<(value: Record<string, unknown>) => void>();
        const { container, rerender } = render(cloneElement(privilegeValue.component, {
            values: privilegeValue.value,
            onDataChange,
        }));
        const availablePrivilege = container.querySelector(".userAccountPrivilegeResult")!;

        expect(within(container).getByText("INHERITED")).toBeTruthy();
        expect(availablePrivilege.classList.contains("disabled")).toBe(false);
        fireEvent.click(availablePrivilege);
        expect(onDataChange).toHaveBeenLastCalledWith(expect.objectContaining({
            privileges: {
                schema: { app: ["SELECT"] },
                table: {},
                routine: {},
                column: {},
            },
            directPrivileges: {
                schema: { app: ["SELECT"] },
                table: {},
                routine: {},
                column: {},
            },
        }));
        const [updatedValues] = onDataChange.mock.lastCall!;
        rerender(cloneElement(privilegeValue.component, {
            values: updatedValues,
            onDataChange,
        }));
        expect(within(container).queryByText("INHERITED")).toBeNull();
        expect(container.querySelector(".userAccountPrivilegeResult")).toBeNull();
        expect(container.querySelector("[data-tooltip='Remove SELECT']")?.classList.contains("disabled")).toBe(false);
    });

    it("object privilege dialog marks direct global schema privileges as inherited", ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const createObjectPrivilegesDialogValuesPrivate = getPrivate<(
        data: Record<string, unknown>,
        ) => IDialogValues>(instance, "createObjectPrivilegesDialogValues");
        const createObjectPrivilegesDialogValues = (data: Record<string, unknown>): IDialogValues => {
            return createObjectPrivilegesDialogValuesPrivate(normalizeObjectPrivilegeFixture(data));
        };
        const values = createObjectPrivilegesDialogValues({
            catalogs: {
                schema: [{ privilege: "SELECT", category: "Databases,Tables", description: "" }],
                table: [],
                routine: [],
                column: [],
            },
            schemas: ["app"],
            targets: [
                { id: "schema:app", kind: "schema", schema: "app", label: "app", available: true },
            ],
            privileges: {
                schema: {},
                table: {},
                routine: {},
                column: {},
            },
            originalPrivileges: {
                schema: {},
                table: {},
                routine: {},
                column: {},
            },
            directPrivileges: {
                schema: {},
                table: {},
                routine: {},
                column: {},
            },
            inheritedPrivileges: {
                schema: { app: ["SELECT"] },
                table: {},
                routine: {},
                column: {},
            },
            roleInheritedPrivileges: {
                schema: {},
                table: {},
                routine: {},
                column: {},
            },
            restrictedPrivileges: {
                schema: {},
                table: {},
                routine: {},
                column: {},
            },
            partialRevokePrivileges: {
                schema: { app: ["SELECT"] },
                table: {},
                routine: {},
                column: {},
            },
            originalPartialRevokePrivileges: {
                schema: { app: ["SELECT"] },
                table: {},
                routine: {},
                column: {},
            },
            readonlyPrivileges: {
                schema: {},
                table: {},
                routine: {},
                column: {},
            },
            partialRevokesEnabled: true,
            selectedTargetId: "schema:app",
        });
        const privilegeValue = values.sections.get("privileges")?.values.privileges as {
            value: Record<string, unknown>;
            component: VNode;
        };
        const onDataChange = vi.fn<(value: Record<string, unknown>) => void>();
        const { container } = render(cloneElement(privilegeValue.component, {
            values: privilegeValue.value,
            onDataChange,
        }));
        expect(within(container).getByText("INHERITED")).toBeTruthy();
        const partialRevokeDescription = within(container).getByText(
            "Inherited global privileges can be partially revoked.",
        );
        expect(container.querySelector(".userAccountPrivilegeFilter")?.compareDocumentPosition(
            partialRevokeDescription,
        )).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(partialRevokeDescription.compareDocumentPosition(
            container.querySelector(".userAccountObjectPrivilegeTable")!,
        )).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(container.querySelector(".userAccountPrivilegeResult")?.classList.contains("disabled")).toBe(false);
        fireEvent.click(container.querySelector("[data-tooltip='Revoke SELECT']")!);
        const updatedValues = onDataChange.mock.lastCall?.[0] as {
            inheritedPrivileges: { schema: Record<string, string[]> };
            partialRevokePrivileges: { schema: Record<string, string[]> };
            restrictedPrivileges: { schema: Record<string, string[]> };
        };
        expect(updatedValues.inheritedPrivileges.schema.app).toEqual([]);
        expect(updatedValues.partialRevokePrivileges.schema.app).toEqual([]);
        expect(updatedValues.restrictedPrivileges.schema.app).toEqual(["SELECT"]);
    });

    it("object privilege dialog renders inherited non-schema privileges as read-only", ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const createObjectPrivilegesDialogValuesPrivate = getPrivate<(
        data: Record<string, unknown>,
        ) => IDialogValues>(instance, "createObjectPrivilegesDialogValues");
        const createObjectPrivilegesDialogValues = (data: Record<string, unknown>): IDialogValues => {
            return createObjectPrivilegesDialogValuesPrivate(normalizeObjectPrivilegeFixture(data));
        };
        const values = createObjectPrivilegesDialogValues({
            catalogs: {
                schema: [],
                table: [{ privilege: "SELECT", category: "Tables", description: "" }],
                routine: [],
                column: [],
            },
            schemas: ["app"],
            targets: [
                { id: "schema:app", kind: "schema", schema: "app", label: "app", available: true },
                { id: "table:app.orders", kind: "table", schema: "app", table: "orders", label: "orders",
                    available: true },
            ],
            privileges: {
                schema: {},
                table: { "app.orders": ["SELECT"] },
                routine: {},
                column: {},
            },
            originalPrivileges: {
                schema: {},
                table: { "app.orders": ["SELECT"] },
                routine: {},
                column: {},
            },
            directPrivileges: {
                schema: {},
                table: {},
                routine: {},
                column: {},
            },
            inheritedPrivileges: {
                schema: {},
                table: { "app.orders": ["SELECT"] },
                routine: {},
                column: {},
            },
            roleInheritedPrivileges: {
                schema: {},
                table: { "app.orders": ["SELECT"] },
                routine: {},
                column: {},
            },
            restrictedPrivileges: {
                schema: {},
                table: {},
                routine: {},
                column: {},
            },
            readonlyPrivileges: {
                schema: {},
                table: { "app.orders": ["SELECT"] },
                routine: {},
                column: {},
            },
            selectedTargetId: "table:app.orders",
        });
        const privilegeValue = values.sections.get("privileges")?.values.privileges as {
            value: Record<string, unknown>;
            component: VNode;
        };
        const { container } = render(cloneElement(privilegeValue.component, {
            values: privilegeValue.value,
            onDataChange: vi.fn(),
        }));
        const removeButton = container.querySelector(".userAccountPrivilegeRemoveButton")!;
        const schemaTarget = [...container.querySelectorAll(".userAccountObjectTarget")].find((target) => {
            return target.textContent === "app";
        });

        expect(schemaTarget?.classList.contains("hasPrivileges")).toBe(false);
        fireEvent.click(container.querySelector(".userAccountObjectTreeChevron")!);
        const tableTarget = [...container.querySelectorAll(".userAccountObjectTarget")].find((target) => {
            return target.textContent?.startsWith("orders");
        });

        expect(removeButton.classList.contains("disabled")).toBe(true);
        expect(removeButton.getAttribute("data-tooltip")).toContain("schema scope");
        expect(within(container).queryByText("INHERITED")).toBeNull();
        expect(tableTarget?.classList.contains("hasPrivileges")).toBe(false);
    });

    it("accepting the role dialog saves assignments and refreshes the list", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const setRolesSpy = vi.spyOn(backend, "setMySQLUserRoles").mockResolvedValue(undefined);
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
        });

        const values: IDialogValues = {
            id: "userAccountRoles",
            sections: new Map([
                ["roles", {
                    values: {
                        roles: {
                            type: "custom",
                            value: {
                                availableRoles: ["reader@%", "writer@%"],
                                selectedRoles: ["reader@%", "writer@%"],
                                defaultRoles: ["writer@%"],
                            },
                        },
                    },
                }],
            ]),
        };
        const handleRoleDialogClose = getPrivate<(
        closure: DialogResponseClosure,
        values: IDialogValues,
        data: Record<string, unknown>,
        ) => Promise<void>>(instance, "handleRoleDialogClose");
        await handleRoleDialogClose(DialogResponseClosure.Accept, values, {
            user: "alice",
            host: "localhost",
        });

        expect(setRolesSpy).toHaveBeenCalledWith("alice", "localhost", ["reader@%", "writer@%"], ["writer@%"]);
        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(2);
        });
    });

    it("accepting the global privilege dialog saves privileges and refreshes the list", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const setPrivilegesSpy = vi.spyOn(backend, "setMySQLUserGlobalPrivileges").mockResolvedValue(undefined);
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
        });

        const values: IDialogValues = {
            id: "userAccountGlobalPrivileges",
            sections: new Map([
                ["privileges", {
                    values: {
                        privileges: {
                            type: "custom",
                            value: {
                                catalog: [
                                    { privilege: "SELECT", category: "Tables", description: "To retrieve rows" },
                                    { privilege: "INSERT", category: "Tables", description: "To insert rows" },
                                ],
                                selectedPrivileges: ["SELECT", "INSERT"],
                            },
                        },
                    },
                }],
            ]),
        };
        const handleGlobalPrivilegesDialogClose = getPrivate<(
        closure: DialogResponseClosure,
        values: IDialogValues,
        data: Record<string, unknown>,
        ) => Promise<void>>(instance, "handleGlobalPrivilegesDialogClose");
        await handleGlobalPrivilegesDialogClose(DialogResponseClosure.Accept, values, {
            user: "alice",
            host: "localhost",
        });

        expect(setPrivilegesSpy).toHaveBeenCalledWith("alice", "localhost", ["SELECT", "INSERT"]);
        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(2);
        });
    });

    it("accepting a global privilege change does not write unchanged roles", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const setRolesSpy = vi.spyOn(backend, "setMySQLUserRoles").mockRejectedValue(
            new Error("Roles must not be updated for a global privilege change."),
        );
        const setGlobalPrivilegesSpy = vi.spyOn(backend, "setMySQLUserGlobalPrivileges").mockResolvedValue(undefined);
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
        });

        const values: IDialogValues = {
            id: "manageRolesAndPrivileges",
            sections: new Map([
                ["roles", {
                    values: {
                        roles: {
                            type: "custom",
                            value: {
                                availableRoles: ["reader@%"],
                                selectedRoles: ["reader@%"],
                                defaultRoles: ["reader@%"],
                            },
                        },
                    },
                }],
                ["globalPrivileges", {
                    values: {
                        privileges: {
                            type: "custom",
                            value: {
                                catalog: [],
                                selectedPrivileges: ["SELECT"],
                                inheritedPrivileges: [],
                            },
                        },
                    },
                }],
                ["objectPrivileges", {
                    values: {
                        privileges: {
                            type: "custom",
                            value: {
                                catalogs: { schema: [], table: [], routine: [], column: [] },
                                schemas: [],
                                targets: [],
                                privileges: { schema: {}, table: {}, routine: {}, column: {} },
                                originalPrivileges: { schema: {}, table: {}, routine: {}, column: {} },
                            },
                        },
                    },
                }],
            ]),
        };
        const handleManageRolesAndPrivilegesDialogClose = getPrivate<(
        closure: DialogResponseClosure,
        values: IDialogValues,
        data: Record<string, unknown>,
        ) => Promise<boolean>>(instance, "handleManageRolesAndPrivilegesDialogClose");
        await handleManageRolesAndPrivilegesDialogClose.call(instance, DialogResponseClosure.Accept, values, {
            user: "alice",
            host: "localhost",
            initialRoles: ["reader@%"],
            initialDefaultRoles: ["reader@%"],
            initialGlobalPrivileges: [],
        });

        expect(setRolesSpy).not.toHaveBeenCalled();
        expect(setGlobalPrivilegesSpy).toHaveBeenCalledWith("alice", "localhost", ["SELECT"]);
        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(2);
        });
    });

    it("keeps the roles and privileges dialog open when saving roles fails", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const setRolesSpy = vi.spyOn(backend, "setMySQLUserRoles").mockRejectedValue(new Error("Denied"));
        const setGlobalPrivilegesSpy = vi.spyOn(backend, "setMySQLUserGlobalPrivileges").mockResolvedValue(undefined);
        const setObjectPrivilegesSpy = vi.spyOn(backend, "setMySQLUserObjectPrivileges").mockResolvedValue(undefined);
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
        });

        const values: IDialogValues = {
            id: "manageRolesAndPrivileges",
            sections: new Map([
                ["roles", {
                    values: {
                        roles: {
                            type: "custom",
                            value: {
                                availableRoles: ["reader@%"],
                                selectedRoles: ["reader@%"],
                                defaultRoles: ["reader@%"],
                            },
                        },
                    },
                }],
                ["globalPrivileges", {
                    values: {
                        privileges: {
                            type: "custom",
                            value: { catalog: [], selectedPrivileges: ["SELECT"], inheritedPrivileges: [] },
                        },
                    },
                }],
                ["objectPrivileges", {
                    values: {
                        privileges: {
                            type: "custom",
                            value: {
                                catalogs: { schema: [], table: [], routine: [], column: [] },
                                schemas: ["app"],
                                targets: [{ id: "schema:app", kind: "schema", schema: "app", label: "app",
                                    available: true }],
                                privileges: { schema: { app: ["SELECT"] }, table: {}, routine: {}, column: {} },
                                originalPrivileges: { schema: {}, table: {}, routine: {}, column: {} },
                                inheritedPrivileges: { schema: {}, table: {}, routine: {}, column: {} },
                            },
                        },
                    },
                }],
            ]),
        };
        const handleManageRolesAndPrivilegesDialogClose = getPrivate<(
        closure: DialogResponseClosure,
        values: IDialogValues,
        data: Record<string, unknown>,
        ) => Promise<boolean>>(instance, "handleManageRolesAndPrivilegesDialogClose");
        const result = await handleManageRolesAndPrivilegesDialogClose.call(
            instance, DialogResponseClosure.Accept, values, {
                user: "alice",
                host: "localhost",
                initialRoles: [],
                initialDefaultRoles: [],
                initialGlobalPrivileges: [],
            },
        );

        expect(result).toBe(false);
        expect(setRolesSpy).toHaveBeenCalledWith("alice", "localhost", ["reader@%"], ["reader@%"]);
        expect(setGlobalPrivilegesSpy).not.toHaveBeenCalled();
        expect(setObjectPrivilegesSpy).not.toHaveBeenCalled();
        expect(uiLayerMockFunctions.showErrorMessage).toHaveBeenCalledWith(
            "Cannot update account roles: Denied", {},
        );
        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(2);
        });
    });

    it("accepting the object privilege dialog saves changed object privileges and refreshes the list", async ({
        expect,
    }) => {
        const backend = new ShellInterfaceSqlEditor();
        const setPrivilegesSpy = vi.spyOn(backend, "setMySQLUserObjectPrivileges").mockResolvedValue(undefined);
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
        });

        const values: IDialogValues = {
            id: "userAccountObjectPrivileges",
            sections: new Map([
                ["privileges", {
                    values: {
                        privileges: {
                            type: "custom",
                            value: {
                                catalogs: {
                                    schema: [
                                        { privilege: "SELECT", category: "Databases,Tables", description: "" },
                                        { privilege: "INSERT", category: "Databases,Tables", description: "" },
                                    ],
                                    table: [],
                                    routine: [],
                                    column: [],
                                },
                                schemas: ["app", "sakila"],
                                targets: [
                                    { id: "schema:app", kind: "schema", schema: "app", label: "app",
                                        available: true },
                                    { id: "table:app.orders", kind: "table", schema: "app", table: "orders",
                                        label: "orders", available: true },
                                    { id: "routine:app.refresh", kind: "routine", schema: "app", routine: "refresh",
                                        routineType: "FUNCTION", label: "refresh", available: true },
                                    { id: "column:app.orders(id)", kind: "column", schema: "app", table: "orders",
                                        column: "id", label: "id", available: true },
                                ],
                                privileges: {
                                    schema: {
                                        app: ["SELECT", "INSERT"],
                                        sakila: ["INSERT"],
                                    },
                                    table: {
                                        "app.orders": ["UPDATE"],
                                    },
                                    routine: {
                                        "app.refresh": ["EXECUTE"],
                                    },
                                    column: {
                                        "app.orders(id)": ["SELECT"],
                                    },
                                },
                                originalPrivileges: {
                                    schema: {
                                        app: ["SELECT"],
                                        sakila: ["INSERT"],
                                    },
                                    table: {
                                        "app.orders": [],
                                    },
                                    routine: {
                                        "app.refresh": [],
                                    },
                                    column: {
                                        "app.orders(id)": [],
                                    },
                                },
                                selectedTargetId: "schema:app",
                            },
                        },
                    },
                }],
            ]),
        };
        const handleObjectPrivilegesDialogClose = getPrivate<(
        closure: DialogResponseClosure,
        values: IDialogValues,
        data: Record<string, unknown>,
        ) => Promise<void>>(instance, "handleObjectPrivilegesDialogClose");
        const objectPrivilegeValue = values.sections.get("privileges")?.values.privileges as {
            value: Record<string, unknown>;
        };
        objectPrivilegeValue.value = normalizeObjectPrivilegeFixture(objectPrivilegeValue.value);
        await handleObjectPrivilegesDialogClose(DialogResponseClosure.Accept, values, {
            user: "alice",
            host: "localhost",
        });

        expect(setPrivilegesSpy).toHaveBeenCalledTimes(4);
        expect(setPrivilegesSpy).toHaveBeenNthCalledWith(1, "alice", "localhost", {
            kind: "schema",
            schema: "app",
            objectName: null,
            routineType: null,
            column: null,
        }, ["SELECT", "INSERT"]);
        expect(setPrivilegesSpy).toHaveBeenNthCalledWith(2, "alice", "localhost", {
            kind: "table",
            schema: "app",
            objectName: "orders",
            routineType: null,
            column: null,
        }, ["UPDATE"]);
        expect(setPrivilegesSpy).toHaveBeenNthCalledWith(3, "alice", "localhost", {
            kind: "routine",
            schema: "app",
            objectName: "refresh",
            routineType: "FUNCTION",
            column: null,
        }, ["EXECUTE"]);
        expect(setPrivilegesSpy).toHaveBeenNthCalledWith(4, "alice", "localhost", {
            kind: "column",
            schema: "app",
            objectName: "orders",
            routineType: null,
            column: "id",
        }, ["SELECT"]);
        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(2);
        });
    });

    it("keeps dotted schema and parenthesized column names structured when saving object privileges", ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const target = {
            id: "structured-column",
            kind: "column" as const,
            schema: "app.v1",
            table: "orders(archive)",
            column: "line)item",
            label: "app.v1.orders(archive).line)item",
            available: true,
        };
        const key = JSON.stringify(["column", target.schema, target.table, undefined, target.column]);
        const objectPrivilegeApiTarget = getPrivate<(data: {
            targets: Array<typeof target>;
        }, kind: "column", key: string) => IObjectPrivilegeTarget | undefined>(instance, "objectPrivilegeApiTarget");

        expect(objectPrivilegeApiTarget.call(instance, { targets: [target] }, "column", key)).toEqual({
            kind: "column",
            schema: "app.v1",
            objectName: "orders(archive)",
            routineType: null,
            column: "line)item",
        });
    });

    it("accepting object privilege dialog saves schema partial-revoke changes", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const setPrivilegesSpy = vi.spyOn(backend, "setMySQLUserObjectPrivileges").mockResolvedValue(undefined);
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
        });

        const values: IDialogValues = {
            id: "userAccountObjectPrivileges",
            sections: new Map([
                ["privileges", {
                    values: {
                        privileges: {
                            type: "custom",
                            value: {
                                catalogs: { schema: [], table: [], routine: [], column: [] },
                                schemas: ["app"],
                                targets: [
                                    { id: "schema:app", kind: "schema", schema: "app", label: "app",
                                        available: true },
                                ],
                                privileges: {
                                    schema: { app: [] },
                                    table: {},
                                    routine: {},
                                    column: {},
                                },
                                originalPrivileges: {
                                    schema: {},
                                    table: {},
                                    routine: {},
                                    column: {},
                                },
                                directPrivileges: {
                                    schema: {},
                                    table: {},
                                    routine: {},
                                    column: {},
                                },
                                inheritedPrivileges: {
                                    schema: { app: ["SELECT"] },
                                    table: {},
                                    routine: {},
                                    column: {},
                                },
                                restrictedPrivileges: {
                                    schema: {},
                                    table: {},
                                    routine: {},
                                    column: {},
                                },
                                partialRevokePrivileges: {
                                    schema: { app: [] },
                                    table: {},
                                    routine: {},
                                    column: {},
                                },
                                originalPartialRevokePrivileges: {
                                    schema: { app: ["SELECT"] },
                                    table: {},
                                    routine: {},
                                    column: {},
                                },
                                readonlyPrivileges: {
                                    schema: {},
                                    table: {},
                                    routine: {},
                                    column: {},
                                },
                                selectedTargetId: "schema:app",
                            },
                        },
                    },
                }],
            ]),
        };
        const handleObjectPrivilegesDialogClose = getPrivate<(
        closure: DialogResponseClosure,
        values: IDialogValues,
        data: Record<string, unknown>,
        ) => Promise<void>>(instance, "handleObjectPrivilegesDialogClose");
        await handleObjectPrivilegesDialogClose(DialogResponseClosure.Accept, values, {
            user: "alice",
            host: "localhost",
        });

        expect(setPrivilegesSpy).toHaveBeenCalledTimes(1);
        expect(setPrivilegesSpy).toHaveBeenCalledWith("alice", "localhost", {
            kind: "schema",
            schema: "app",
            objectName: null,
            routineType: null,
            column: null,
        }, []);
    });

    it("accepting unchanged effective object privileges does not save inherited privileges as direct grants", async ({
        expect,
    }) => {
        const backend = new ShellInterfaceSqlEditor();
        const setPrivilegesSpy = vi.spyOn(backend, "setMySQLUserObjectPrivileges").mockResolvedValue(undefined);
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
        });

        const values: IDialogValues = {
            id: "userAccountObjectPrivileges",
            sections: new Map([
                ["privileges", {
                    values: {
                        privileges: {
                            type: "custom",
                            value: {
                                catalogs: { schema: [], table: [], routine: [], column: [] },
                                schemas: ["app"],
                                targets: [
                                    { id: "table:app.orders", kind: "table", schema: "app", table: "orders",
                                        label: "orders", available: true },
                                ],
                                privileges: {
                                    schema: {},
                                    table: { "app.orders": ["SELECT"] },
                                    routine: {},
                                    column: {},
                                },
                                originalPrivileges: {
                                    schema: {},
                                    table: { "app.orders": ["SELECT"] },
                                    routine: {},
                                    column: {},
                                },
                                inheritedPrivileges: {
                                    schema: {},
                                    table: { "app.orders": ["SELECT"] },
                                    routine: {},
                                    column: {},
                                },
                                selectedTargetId: "table:app.orders",
                            },
                        },
                    },
                }],
            ]),
        };
        const handleObjectPrivilegesDialogClose = getPrivate<(
        closure: DialogResponseClosure,
        values: IDialogValues,
        data: Record<string, unknown>,
        ) => Promise<void>>(instance, "handleObjectPrivilegesDialogClose");
        await handleObjectPrivilegesDialogClose(DialogResponseClosure.Accept, values, {
            user: "alice",
            host: "localhost",
        });

        expect(setPrivilegesSpy).not.toHaveBeenCalled();
        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(2);
        });
    });

    it("cancelling the object privilege dialog does not save", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const setObjectPrivilegesSpy = vi.spyOn(backend, "setMySQLUserObjectPrivileges").mockResolvedValue(undefined);
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
        });

        const handleObjectPrivilegesDialogClose = getPrivate<(
        closure: DialogResponseClosure,
        values: IDialogValues,
        data: Record<string, unknown>,
        ) => Promise<void>>(instance, "handleObjectPrivilegesDialogClose");
        await handleObjectPrivilegesDialogClose(DialogResponseClosure.Cancel, {
            id: "userAccountObjectPrivileges",
            sections: new Map(),
        }, {
            user: "alice",
            host: "localhost",
        });

        expect(setObjectPrivilegesSpy).not.toHaveBeenCalled();
        expect(listSpy).toHaveBeenCalledTimes(1);
    });

    it("accepting edit dialog calls update backend and refreshes list", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const updateSpy = vi.spyOn(backend, "updateMySQLUser").mockResolvedValue({ generatedPassword: null });
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
        });

        instance.setState({ editingAccount: { user: "alice", host: "localhost" } });
        await waitFor(() => {
            expect(getPrivate<IUserAccountsState>(instance, "state").editingAccount)
                .toEqual({ user: "alice", host: "localhost" });
        });

        const values = CreateUserDialog.createDialogValues();
        setDialogValue(values, "authentication", "authenticationPlugin", "caching_sha2_password");
        setDialogValue(values, "general", "lockAccount", true);
        setDialogValue(values, "general", "comment", " updated comment ");
        setDialogValue(values, "authentication", "password", " newpass ");
        setDialogValue(values, "authentication", "passwordExpire", true);
        setDialogValue(values, "authentication", "passwordExpiration", 12);
        setDialogValue(values, "authentication", "passwordHistory", 3);
        setDialogValue(values, "authentication", "passwordReuseInterval", 9);
        setDialogValue(values, "authentication", "failedPasswordAttempts", 2);
        setDialogValue(values, "authentication", "passwordLockTime", 4);
        setDialogValue(values, "authentication", "lockAccount", true);
        setDialogValue(values, "tls", "tlsMode", { tlsMode: "Require Certificate" });
        setDialogValue(values, "tls", "tlsCipher", "cipher-x");
        setDialogValue(values, "tls", "tlsIssuer", "issuer-x");
        setDialogValue(values, "tls", "tlsSubject", "subject-x");
        setDialogValue(values, "resourceLimits", "maxQueriesPerHour", 1);
        setDialogValue(values, "resourceLimits", "maxConnectionsPerHour", 2);
        setDialogValue(values, "resourceLimits", "maxUpdatesPerHour", 3);
        setDialogValue(values, "resourceLimits", "maxUserConnections", 4);

        const handler = getPrivate<(closure: DialogResponseClosure, v: IDialogValues) => Promise<boolean>>(
            instance, "handleCreateUserDialogClose");
        await handler(DialogResponseClosure.Accept, values);

        await waitFor(() => {
            expect(updateSpy).toHaveBeenCalledTimes(1);
        });

        const expected: IMySQLUser = {
            user: "alice",
            host: "localhost",
            plugin: "caching_sha2_password", passwordExpire: true,
            passwordLastChanged: null, passwordLifetime: 12,
            authString: " newpass ",
            randomPassword: false,
            sslType: "SPECIFIED",
            sslCipher: "cipher-x",
            x509Issuer: "issuer-x",
            x509Subject: "subject-x",
            maxQuestions: 1,
            maxUpdates: 3,
            maxConnections: 2,
            maxUserConnections: 4,
            passwordReuseHistory: 3,
            passwordReuseInterval: 9,
            passwordRequireCurrent: true,
            failedLoginAttempts: 2,
            passwordLockTime: 4,
            accountLocked: true,
            comment: " updated comment ",
        };
        expect(updateSpy).toHaveBeenCalledWith(expected);

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(2);
            expect(getPrivate<IUserAccountsState>(instance, "state").editingAccount).toBeNull();
        });
    });

    it("accepting an unchanged loaded edit dialog does not call the backend", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const updateSpy = vi.spyOn(backend, "updateMySQLUser").mockResolvedValue({ generatedPassword: null });
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const original = baseUserDetails({ user: "alice", host: "localhost", comment: "existing comment" });

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
        });

        instance.setState({ editingAccount: { user: original.user, host: original.host, comment: original.comment } });
        await waitFor(() => {
            expect(getPrivate<IUserAccountsState>(instance, "state").editingAccount)
                .toEqual({ user: original.user, host: original.host, comment: original.comment });
        });
        (instance as unknown as { editingAccountDetails?: IMySQLUser }).editingAccountDetails = original;

        const createDialogValuesFromUser = getPrivate<(details: IMySQLUser) => IDialogValues>(
            instance, "createDialogValuesFromUser");
        const handler = getPrivate<(closure: DialogResponseClosure, v: IDialogValues) => Promise<boolean>>(
            instance, "handleCreateUserDialogClose");
        const values = createDialogValuesFromUser(original);
        const closeDialog = await handler(DialogResponseClosure.Accept, values);

        expect(updateSpy).not.toHaveBeenCalled();
        expect(closeDialog).toBe(true);
    });

    it("updates only the edited comment for a loaded account", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const updateSpy = vi.spyOn(backend, "updateMySQLUser").mockResolvedValue({ generatedPassword: null });
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const original = baseUserDetails({
            user: "alice",
            host: "localhost",
            accountLocked: false,
            comment: "existing comment",
            maxQuestions: 10,
            maxUpdates: 11,
            maxConnections: 12,
            maxUserConnections: 13,
            passwordLifetime: 14,
            passwordReuseHistory: 15,
            passwordReuseInterval: 16,
            passwordRequireCurrent: true,
            failedLoginAttempts: 17,
            passwordLockTime: 18,
        });

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
        });

        instance.setState({ editingAccount: { user: original.user, host: original.host, comment: original.comment } });
        await waitFor(() => {
            expect(getPrivate<IUserAccountsState>(instance, "state").editingAccount)
                .toEqual({ user: original.user, host: original.host, comment: original.comment });
        });
        (instance as unknown as { editingAccountDetails?: IMySQLUser }).editingAccountDetails = original;
        const createDialogValuesFromUser = getPrivate<(details: IMySQLUser) => IDialogValues>(
            instance, "createDialogValuesFromUser");
        const values = createDialogValuesFromUser(original);
        setDialogValue(values, "general", "comment", "updated comment");
        const handler = getPrivate<(closure: DialogResponseClosure, v: IDialogValues) => Promise<boolean>>(
            instance, "handleCreateUserDialogClose");

        expect(await handler(DialogResponseClosure.Accept, values)).toBe(true);

        expect(updateSpy).toHaveBeenCalledWith({
            user: "alice",
            host: "localhost",
            plugin: null,
            passwordLastChanged: null,
            authString: null,
            randomPassword: null,
            sslType: null,
            sslCipher: null,
            x509Issuer: null,
            x509Subject: null,
            maxQuestions: null,
            maxUpdates: null,
            maxConnections: null,
            maxUserConnections: null,
            passwordExpire: null,
            passwordLifetime: null,
            passwordReuseHistory: null,
            passwordReuseInterval: null,
            passwordRequireCurrent: null,
            failedLoginAttempts: null,
            passwordLockTime: null,
            accountLocked: null,
            comment: "updated comment",
        });
    });

    it("accepting edit dialog can disable SSL when None is selected", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const updateSpy = vi.spyOn(backend, "updateMySQLUser").mockResolvedValue({ generatedPassword: null });
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
        });

        instance.setState({ editingAccount: { user: "alice", host: "localhost" } });
        await waitFor(() => {
            expect(getPrivate<IUserAccountsState>(instance, "state").editingAccount)
                .toEqual({ user: "alice", host: "localhost" });
        });

        const values = CreateUserDialog.createDialogValues();
        setDialogValue(values, "authentication", "authenticationPlugin", "caching_sha2_password");
        setDialogValue(values, "tls", "tlsMode", { tlsMode: "None" });
        setDialogValue(values, "tls", "tlsCipher", "stale-cipher");
        setDialogValue(values, "tls", "tlsIssuer", "stale-issuer");
        setDialogValue(values, "tls", "tlsSubject", "stale-subject");

        const handler = getPrivate<(closure: DialogResponseClosure, v: IDialogValues) => Promise<boolean>>(
            instance, "handleCreateUserDialogClose");
        await handler(DialogResponseClosure.Accept, values);

        await waitFor(() => {
            expect(updateSpy).toHaveBeenCalledTimes(1);
        });

        expect(updateSpy.mock.calls[0][0]).toMatchObject({
            sslType: "NONE", sslCipher: null, x509Issuer: null, x509Subject: null,
        });
    });

    it("accepting edit dialog includes REQUIRE CIPHER when the cipher list is not empty", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const updateSpy = vi.spyOn(backend, "updateMySQLUser").mockResolvedValue({ generatedPassword: null });
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
        });

        instance.setState({ editingAccount: { user: "alice", host: "localhost" } });
        await waitFor(() => {
            expect(getPrivate<IUserAccountsState>(instance, "state").editingAccount)
                .toEqual({ user: "alice", host: "localhost" });
        });

        const values = CreateUserDialog.createDialogValues();
        setDialogValue(values, "authentication", "authenticationPlugin", "caching_sha2_password");
        setDialogValue(values, "tls", "tlsMode", { tlsMode: "Required" });
        setDialogValue(values, "tls", "tlsCipher", "cipher-x");

        const handler = getPrivate<(closure: DialogResponseClosure, v: IDialogValues) => void>(
            instance, "handleCreateUserDialogClose");
        handler(DialogResponseClosure.Accept, values);

        await waitFor(() => {
            expect(updateSpy).toHaveBeenCalledTimes(1);
        });

        expect(updateSpy.mock.calls[0][0]).toMatchObject({
            sslType: "SPECIFIED", sslCipher: "cipher-x", x509Issuer: null, x509Subject: null,
        });
    });

    it("createTlsRequirements uses X509 for certificate mode without issuer or subject", ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const createTlsRequirements = getPrivate<
            (tlsMode: "None" | "Required" | "Require Certificate", tlsCipher: string, tlsIssuer: string,
            tlsSubject: string, explicitNone?: boolean) => Pick<IMySQLUser,
                    "sslType" | "sslCipher" | "x509Issuer" | "x509Subject">
        >(instance, "createTlsRequirements");

        expect(createTlsRequirements("Require Certificate", "", "", "")).toEqual({
            sslType: "X509", sslCipher: null, x509Issuer: null, x509Subject: null,
        });
        expect(createTlsRequirements("Require Certificate", "cipher-x", "", "")).toEqual({
            sslType: "X509", sslCipher: "cipher-x", x509Issuer: null, x509Subject: null,
        });
    });

    it("edit update failures keep the dialog state and do not refresh the list", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const updateSpy = vi.spyOn(backend, "updateMySQLUser").mockRejectedValue(new Error("boom"));
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
        });

        instance.setState({ editingAccount: { user: "errUser", host: "%" } });
        await waitFor(() => {
            expect(getPrivate<IUserAccountsState>(instance, "state").editingAccount)
                .toEqual({ user: "errUser", host: "%" });
        });

        const values = CreateUserDialog.createDialogValues();
        setDialogValue(values, "authentication", "authenticationPlugin", "mysql_native_password");
        setDialogValue(values, "authentication", "password", "newpass");

        const handler = getPrivate<(closure: DialogResponseClosure, v: IDialogValues) => Promise<boolean>>(
            instance, "handleCreateUserDialogClose");
        const closeDialog = await handler(DialogResponseClosure.Accept, values);

        await waitFor(() => {
            expect(updateSpy).toHaveBeenCalledTimes(1);
        });

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(uiLayerMock.showErrorMessage).toHaveBeenCalled();
        });

        expect(listSpy).toHaveBeenCalledTimes(1);
        expect(getPrivate<IUserAccountsState>(instance, "state").editingAccount)
            .toEqual({ user: "errUser", host: "%" });
        expect(values.sections.get("authentication")?.values.password.value).toBe("newpass");
        expect(closeDialog).toBe(false);
    });

    it("create user toolbar button opens dialog", async ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const { container } = render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const dialogRef = getPrivate<{ current: { show: (values: IDialogValues, opts: { title: string }) => void } }>(
            instance, "createUserDialogRef");
        await waitFor(() => {
            expect(dialogRef.current).toBeTruthy();
        });
        const dialog = dialogRef.current;
        vi.spyOn(dialog, "show");

        const createButton = container.querySelectorAll("#userAccountsToolbar .button")[1];
        fireEvent.click(createButton);

        await waitFor(() => {
            expect(dialog.show).toHaveBeenCalledTimes(1);
        });
        const [callValues, callOptions] = (dialog.show as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
        expect(callValues).toMatchObject({ id: "createUser" });
        expect(callOptions).toEqual({ title: "Create User Account" });
    });

    it("create user dialog uses server default values for new accounts", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        vi.spyOn(backend, "listMySQLAuthenticationPlugins").mockResolvedValue(["caching_sha2_password"]);
        const defaultsSpy = vi.spyOn(backend, "getMySQLCreateUserDefaults").mockResolvedValue({
            passwordLifetime: 90,
            passwordReuseHistory: 5,
            passwordReuseInterval: 30,
            passwordRequireCurrent: true,
            maxUserConnections: 12,
        });
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const { container, unmount } = render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const dialogRef = getPrivate<{ current: { show: (values: IDialogValues, opts: { title: string }) => void } }>(
            instance, "createUserDialogRef");

        await waitFor(() => {
            expect(dialogRef.current).toBeTruthy();
        });
        const showSpy = vi.spyOn(dialogRef.current, "show");

        const createButton = container.querySelectorAll("#userAccountsToolbar .button")[1];
        fireEvent.click(createButton);

        await waitFor(() => {
            expect(defaultsSpy).toHaveBeenCalledTimes(1);
            expect(showSpy).toHaveBeenCalledTimes(1);
        });

        const [values, options] = showSpy.mock.calls[0] as [IDialogValues, { title: string }];
        expect(options).toEqual({ title: "Create User Account" });
        expect(values.sections.get("authentication")?.values.passwordExpiration.value).toBe(90);
        expect(values.sections.get("authentication")?.values.passwordHistory.value).toBe(5);
        expect(values.sections.get("authentication")?.values.passwordReuseInterval.value).toBe(30);
        expect(values.sections.get("authentication")?.values.lockAccount.value).toBe(true);
        expect(values.sections.get("resourceLimits")?.values.maxUserConnections.value).toBe(12);

        unmount();
    });

    it("create user dialog uses discovered authentication plugin choices", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        vi.spyOn(backend, "listMySQLAuthenticationPlugins")
            .mockResolvedValue(["auth_socket", "caching_sha2_password"]);
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const { container, unmount } = render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const dialogRef = getPrivate<{ current: { show: (values: IDialogValues, opts: { title: string }) => void } }>(
            instance, "createUserDialogRef");

        await waitFor(() => {
            expect(getPrivate<IUserAccountsState>(instance, "state").authenticationPlugins)
                .toEqual(["auth_socket", "caching_sha2_password"]);
            expect(dialogRef.current).toBeTruthy();
        });
        const showSpy = vi.spyOn(dialogRef.current, "show");

        const createButton = container.querySelectorAll("#userAccountsToolbar .button")[1];
        fireEvent.click(createButton);

        await waitFor(() => {
            expect(showSpy).toHaveBeenCalledTimes(1);
        });
        const [values] = showSpy.mock.calls[0] as [IDialogValues, { title: string }];
        expect(values.sections.get("authentication")?.values.authenticationPlugin.value)
            .toBe("caching_sha2_password");
        expect(values.sections.get("authentication")?.values.authenticationPlugin.choices)
            .toEqual(["auth_socket", "caching_sha2_password"]);

        unmount();
    });

    it("create user dialog falls back to legacy authentication plugin choices", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        vi.spyOn(backend, "listMySQLAuthenticationPlugins").mockRejectedValue(new Error("no metadata"));
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const { container, unmount } = render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const dialogRef = getPrivate<{ current: { show: (values: IDialogValues, opts: { title: string }) => void } }>(
            instance, "createUserDialogRef");

        await waitFor(() => {
            expect(dialogRef.current).toBeTruthy();
        });
        const showSpy = vi.spyOn(dialogRef.current, "show");

        const createButton = container.querySelectorAll("#userAccountsToolbar .button")[1];
        fireEvent.click(createButton);

        await waitFor(() => {
            expect(showSpy).toHaveBeenCalledTimes(1);
        });
        const [values] = showSpy.mock.calls[0] as [IDialogValues, { title: string }];
        expect(values.sections.get("authentication")?.values.authenticationPlugin.value)
            .toBe("caching_sha2_password");
        expect(values.sections.get("authentication")?.values.authenticationPlugin.choices)
            .toEqual(["mysql_native_password", "caching_sha2_password"]);

        unmount();
    });

    it("create user dialog defaults to the first discovered plugin without caching_sha2_password", ({ expect }) => {
        const values = CreateUserDialog.createDialogValues(["auth_socket", "mysql_clear_password"]);

        expect(values.sections.get("authentication")?.values.authenticationPlugin.value).toBe("auth_socket");
        expect(values.sections.get("authentication")?.values.authenticationPlugin.choices)
            .toEqual(["auth_socket", "mysql_clear_password"]);
    });

    it("accepting create user dialog calls backend and refreshes list", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const createSpy = vi.spyOn(backend, "createMySQLUser").mockResolvedValue({ generatedPassword: null });
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        const { unmount } = render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
        });

        const values = CreateUserDialog.createDialogValues();
        setDialogValue(values, "general", "userName", "newUser");
        setDialogValue(values, "general", "hostName", "%");
        setDialogValue(values, "authentication", "authenticationPlugin", "caching_sha2_password");
        setDialogValue(values, "general", "lockAccount", true);
        setDialogValue(values, "general", "comment", " test comment ");
        setDialogValue(values, "authentication", "password", "p@ss");
        setDialogValue(values, "authentication", "passwordConfirmation", "p@ss");
        setDialogValue(values, "authentication", "passwordExpire", true);
        setDialogValue(values, "authentication", "passwordExpiration", 10);
        setDialogValue(values, "authentication", "passwordHistory", 5);
        setDialogValue(values, "authentication", "passwordReuseInterval", 30);
        setDialogValue(values, "authentication", "failedPasswordAttempts", 2);
        setDialogValue(values, "authentication", "lockAccount", true);
        setDialogValue(values, "tls", "tlsMode", { tlsMode: "Require Certificate" });
        setDialogValue(values, "tls", "tlsCipher", "cipher1");
        setDialogValue(values, "tls", "tlsIssuer", "issuer1");
        setDialogValue(values, "tls", "tlsSubject", "subject1");
        setDialogValue(values, "resourceLimits", "maxQueriesPerHour", 1);
        setDialogValue(values, "resourceLimits", "maxConnectionsPerHour", 2);
        setDialogValue(values, "resourceLimits", "maxUpdatesPerHour", 3);
        setDialogValue(values, "resourceLimits", "maxUserConnections", 4);

        const handler = getPrivate<(closure: DialogResponseClosure, v: IDialogValues) => void>(
            instance, "handleCreateUserDialogClose");
        handler(DialogResponseClosure.Accept, values);

        await waitFor(() => {
            expect(createSpy).toHaveBeenCalledTimes(1);
        });

        const expected: IMySQLUser = {
            user: "newUser",
            host: "%",
            plugin: "caching_sha2_password", passwordExpire: true,
            passwordLastChanged: null, passwordLifetime: 10,
            authString: "p@ss",
            randomPassword: false,
            sslType: "SPECIFIED",
            sslCipher: "cipher1",
            x509Issuer: "issuer1",
            x509Subject: "subject1",
            maxQuestions: 1,
            maxUpdates: 3,
            maxConnections: 2,
            maxUserConnections: 4,
            passwordReuseHistory: 5,
            passwordReuseInterval: 30,
            passwordRequireCurrent: true,
            failedLoginAttempts: 2,
            passwordLockTime: 0,
            accountLocked: true,
            comment: " test comment ",
        };

        expect(createSpy).toHaveBeenCalledWith(expected);

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(2);
        });

        unmount();
    });

    it("declining create user dialog does not call backend", ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const createSpy = vi.spyOn(backend, "createMySQLUser").mockResolvedValue({ generatedPassword: null });
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        const handler = getPrivate<(closure: DialogResponseClosure, v: IDialogValues) => void>(
            instance, "handleCreateUserDialogClose");
        handler(DialogResponseClosure.Decline, CreateUserDialog.createDialogValues());

        expect(createSpy).not.toHaveBeenCalled();
    });

    it("confirms before creating a user without a password", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const createSpy = vi.spyOn(backend, "createMySQLUser").mockResolvedValue({ generatedPassword: null });
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const values = CreateUserDialog.createDialogValues();
        setDialogValue(values, "general", "userName", "newUser");
        setDialogValue(values, "general", "hostName", "%");

        const showDialogSpy = vi.spyOn(DialogHost, "showDialog").mockResolvedValueOnce({
            closure: DialogResponseClosure.Cancel,
        });
        const handler = getPrivate<(closure: DialogResponseClosure, v: IDialogValues) => Promise<boolean>>(
            instance, "handleCreateUserDialogClose");
        const closeDialog = await handler(DialogResponseClosure.Accept, values);

        expect(showDialogSpy).toHaveBeenCalledWith({
            id: "emptyPasswordConfirmDialog",
            type: DialogType.Confirm,
            parameters: {
                title: "Confirmation",
                prompt: "Create 'newUser'@'%' without a password?\n\n"
                    + "Unless another authentication method is configured, "
                    + "this account may be accessible without a password.\n\n"
                    + "Do you want to continue?",
                accept: "Yes",
                refuse: "No",
                default: "No",
                checkboxId: "doNotAskAgain",
                checkboxCaption: "Do not ask again for this session",
            },
        });
        expect(createSpy).not.toHaveBeenCalled();
        expect(closeDialog).toBe(false);
    });

    it("updates a user without confirming when the password is unchanged", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const updateSpy = vi.spyOn(backend, "updateMySQLUser").mockResolvedValue({ generatedPassword: null });
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        instance.setState({ editingAccount: { user: "alice", host: "localhost" } });
        await waitFor(() => {
            expect(getPrivate<IUserAccountsState>(instance, "state").editingAccount)
                .toEqual({ user: "alice", host: "localhost" });
        });

        const showDialogSpy = vi.spyOn(DialogHost, "showDialog");
        const handler = getPrivate<(closure: DialogResponseClosure, v: IDialogValues) => Promise<boolean>>(
            instance, "handleCreateUserDialogClose");
        const closeDialog = await handler(DialogResponseClosure.Accept, CreateUserDialog.createDialogValues());

        expect(showDialogSpy).not.toHaveBeenCalled();
        expect(updateSpy).toHaveBeenCalledOnce();
        expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
            comment: null,
        }));
        expect(listSpy).toHaveBeenCalledTimes(2);
        expect(closeDialog).toBe(true);
    });

    it("can suppress empty-password confirmation for the current User Accounts session", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const createSpy = vi.spyOn(backend, "createMySQLUser").mockResolvedValue({ generatedPassword: null });
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const values = CreateUserDialog.createDialogValues();
        setDialogValue(values, "general", "userName", "newUser");

        const showDialogSpy = vi.spyOn(DialogHost, "showDialog").mockResolvedValue({
            closure: DialogResponseClosure.Accept,
            data: { doNotAskAgain: true },
        });
        const handler = getPrivate<(closure: DialogResponseClosure, v: IDialogValues) => Promise<boolean>>(
            instance, "handleCreateUserDialogClose");

        expect(await handler(DialogResponseClosure.Accept, values)).toBe(true);
        expect(await handler(DialogResponseClosure.Accept, values)).toBe(true);

        expect(showDialogSpy).toHaveBeenCalledTimes(1);
        expect(createSpy).toHaveBeenCalledTimes(2);
    });

    it("create user failures show error message", async ({ expect }) => {
        const backend = new ShellInterfaceSqlEditor();
        const createSpy = vi.spyOn(backend, "createMySQLUser")
            .mockRejectedValue(new Error("boom"));
        const listSpy = vi.spyOn(backend, "listMySQLUsers").mockResolvedValue([]);
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        const ref = createRef<UserAccounts>();
        render(<UserAccounts ref={ref} backend={backend} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        await waitFor(() => {
            expect(listSpy).toHaveBeenCalledTimes(1);
        });

        const values = CreateUserDialog.createDialogValues();
        setDialogValue(values, "general", "userName", "errUser");
        setDialogValue(values, "general", "hostName", "%");
        setDialogValue(values, "authentication", "authenticationPlugin", "caching_sha2_password");
        setDialogValue(values, "authentication", "password", "pass");

        const handler = getPrivate<(closure: DialogResponseClosure, v: IDialogValues) => Promise<boolean | void>>(
            instance, "handleCreateUserDialogClose");
        const closeDialog = await handler(DialogResponseClosure.Accept, values);

        await waitFor(() => {
            expect(createSpy).toHaveBeenCalledTimes(1);
        });

        await waitFor(() => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(uiLayerMock.showErrorMessage).toHaveBeenCalled();
        });

        expect(closeDialog).toBe(false);
        expect(values.sections.get("general")?.values.userName.value).toBe("errUser");
        expect(listSpy).toHaveBeenCalledTimes(1);
    });

    it("validateCreateUserValues returns errors for required fields", async ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;

        const values = CreateUserDialog.createDialogValues();
        setDialogValue(values, "general", "userName", "");
        setDialogValue(values, "general", "hostName", "");
        setDialogValue(values, "authentication", "authenticationPlugin", "");
        setDialogValue(values, "authentication", "password", "secret");
        setDialogValue(values, "authentication", "passwordConfirmation", "mismatch");
        setDialogValue(values, "tls", "tlsMode", { tlsMode: "Require Certificate" });
        setDialogValue(values, "tls", "tlsIssuer", "");
        setDialogValue(values, "tls", "tlsSubject", "");

        const validate = getPrivate<(closing: boolean, v: IDialogValues) => Promise<Record<string, unknown>>>(
            instance, "validateCreateUserValues");
        const result = await validate(true, values) as { messages: Record<string, string> };

        expect(result.messages).toMatchObject({
            userName: "The user name must not be empty",
            hostName: "The host must not be empty",
            authenticationPlugin: "Select an authentication plugin",
            passwordConfirmation: "The password confirmation does not match",
        });
        expect(result.messages.tlsIssuer).toBeUndefined();
        expect(result.messages.tlsSubject).toBeUndefined();
    });

    it("validateCreateUserValues accepts certificate requirements without issuer or subject", async ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const validate = getPrivate<(closing: boolean, v: IDialogValues) => Promise<Record<string, unknown>>>(
            instance, "validateCreateUserValues");

        const createValidValues = (): IDialogValues => {
            const values = CreateUserDialog.createDialogValues();
            setDialogValue(values, "general", "userName", "alice");
            setDialogValue(values, "general", "hostName", "localhost");
            setDialogValue(values, "authentication", "authenticationPlugin", "caching_sha2_password");
            setDialogValue(values, "authentication", "password", "secret");
            setDialogValue(values, "authentication", "passwordConfirmation", "secret");
            setDialogValue(values, "tls", "tlsMode", { tlsMode: "Require Certificate" });

            return values;
        };

        const issuerValues = createValidValues();
        setDialogValue(issuerValues, "tls", "tlsIssuer", "issuer-x");
        setDialogValue(issuerValues, "tls", "tlsSubject", "");
        const issuerResult = await validate(true, issuerValues) as { messages: Record<string, string> };
        expect(issuerResult.messages.tlsIssuer).toBeUndefined();
        expect(issuerResult.messages.tlsSubject).toBeUndefined();

        const subjectValues = createValidValues();
        setDialogValue(subjectValues, "tls", "tlsIssuer", "");
        setDialogValue(subjectValues, "tls", "tlsSubject", "subject-x");
        const subjectResult = await validate(true, subjectValues) as { messages: Record<string, string> };
        expect(subjectResult.messages.tlsIssuer).toBeUndefined();
        expect(subjectResult.messages.tlsSubject).toBeUndefined();

        const certificateOnlyValues = createValidValues();
        setDialogValue(certificateOnlyValues, "tls", "tlsIssuer", "");
        setDialogValue(certificateOnlyValues, "tls", "tlsSubject", "");
        const certificateOnlyResult = await validate(true, certificateOnlyValues) as {
            messages: Record<string, string>
        };
        expect(certificateOnlyResult.messages.tlsIssuer).toBeUndefined();
        expect(certificateOnlyResult.messages.tlsSubject).toBeUndefined();
    });

    it("validateCreateUserValues allows a passwordless account", async ({ expect }) => {
        const ref = createRef<UserAccounts>();
        const toolbarItems: IToolbarItems = {
            navigation: [], execution: [], editor: [], auxiliary: [],
        };
        render(<UserAccounts ref={ref} toolbarItems={toolbarItems} />);
        const instance = ref.current!;
        const values = CreateUserDialog.createDialogValues();
        setDialogValue(values, "general", "userName", "alice");
        setDialogValue(values, "general", "hostName", "localhost");
        setDialogValue(values, "authentication", "authenticationPlugin", "caching_sha2_password");

        const validate = getPrivate<(closing: boolean, v: IDialogValues) => Promise<Record<string, unknown>>>(
            instance, "validateCreateUserValues");
        const result = await validate(true, values) as { messages: Record<string, string> };

        expect(result.messages.password).toBeUndefined();
    });
});
