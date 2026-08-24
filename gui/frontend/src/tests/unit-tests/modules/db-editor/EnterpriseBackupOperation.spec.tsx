/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import type { ComponentChild } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "../../../../components/ui/Button/Button.js";
import { useMebOperation } from "../../../../modules/db-editor/EnterpriseBackupOperation.js";

afterEach(() => {
    cleanup();
});

describe("useMebOperation", () => {
    it("runs one operation at a time and releases the guard after completion", async () => {
        let resolveFirst: (() => void) | undefined;
        const firstOperation = vi.fn(() => {
            return new Promise<void>((resolve) => {
                resolveFirst = resolve;
            });
        });
        const secondOperation = vi.fn(async () => {
            await Promise.resolve();
        });

        const OperationHarness = (): ComponentChild => {
            const { activeOperation, runOperation } = useMebOperation();

            return <>
                <span>{activeOperation ?? "idle"}</span>
                <Button onClick={() => {
                    void runOperation("validateBackupHome", firstOperation);
                }}>First</Button>
                <Button onClick={() => {
                    void runOperation("validateBackupAccount", secondOperation);
                }}>Second</Button>
            </>;
        };

        render(<OperationHarness />);
        fireEvent.click(screen.getByText("First"));
        fireEvent.click(screen.getByText("Second"));

        expect(firstOperation).toHaveBeenCalledOnce();
        expect(secondOperation).not.toHaveBeenCalled();
        expect(screen.getByText("validateBackupHome")).toBeTruthy();

        resolveFirst?.();
        await screen.findByText("idle");
        fireEvent.click(screen.getByText("Second"));
        expect(secondOperation).toHaveBeenCalledOnce();
    });

    it("releases the guard when an operation rejects", async () => {
        const failingOperation = vi.fn(() => {
            return Promise.reject(new Error("validation failed"));
        });
        const nextOperation = vi.fn(async () => {
            await Promise.resolve();
        });

        const RejectingHarness = (): ComponentChild => {
            const { activeOperation, runOperation } = useMebOperation();

            return <>
                <span>{activeOperation ?? "idle"}</span>
                <Button onClick={() => {
                    void runOperation("validateBackupHome", failingOperation).catch(() => {
                        return undefined;
                    });
                }}>Fail</Button>
                <Button onClick={() => {
                    void runOperation("validateBackupAccount", nextOperation);
                }}>Next</Button>
            </>;
        };

        render(<RejectingHarness />);
        fireEvent.click(screen.getByText("Fail"));
        await waitFor(() => {
            expect(failingOperation).toHaveBeenCalledOnce();
        });
        await screen.findByText("idle");
        fireEvent.click(screen.getByText("Next"));
        expect(nextOperation).toHaveBeenCalledOnce();
    });

    it("resets validation for a new lifecycle without letting old completion release its operation", async () => {
        let resolveFirst: (() => void) | undefined;
        let resolveSecond: (() => void) | undefined;
        const firstOperation = vi.fn(() => {
            return new Promise<void>((resolve) => {
                resolveFirst = resolve;
            });
        });
        const secondOperation = vi.fn(() => {
            return new Promise<void>((resolve) => {
                resolveSecond = resolve;
            });
        });

        const ResetHarness = (): ComponentChild => {
            const { activeOperation, resetOperation, runOperation } = useMebOperation();

            return <>
                <span>{activeOperation ?? "idle"}</span>
                <Button onClick={() => {
                    void runOperation("validateBackupHome", firstOperation);
                }}>First</Button>
                <Button onClick={resetOperation}>Reset</Button>
                <Button onClick={() => {
                    void runOperation("validateBackupAccount", secondOperation);
                }}>Second</Button>
            </>;
        };

        render(<ResetHarness />);
        fireEvent.click(screen.getByText("First"));
        expect(screen.getByText("validateBackupHome")).toBeTruthy();

        fireEvent.click(screen.getByText("Reset"));
        expect(screen.getByText("idle")).toBeTruthy();
        fireEvent.click(screen.getByText("Second"));
        expect(secondOperation).toHaveBeenCalledOnce();
        expect(screen.getByText("validateBackupAccount")).toBeTruthy();

        await act(async () => {
            resolveFirst?.();
            await Promise.resolve();
        });
        expect(screen.getByText("validateBackupAccount")).toBeTruthy();

        resolveSecond?.();
        await screen.findByText("idle");
    });

    it("preserves a mutation barrier across reset until the mutation settles", async () => {
        let resolveMutation: (() => void) | undefined;
        const mutation = vi.fn(() => {
            return new Promise<void>((resolve) => {
                resolveMutation = resolve;
            });
        });
        const nextOperation = vi.fn(async () => {
            await Promise.resolve();
        });

        const MutationHarness = (): ComponentChild => {
            const { activeOperation, resetOperation, runOperation } = useMebOperation();

            return <>
                <span>{activeOperation ?? "idle"}</span>
                <Button onClick={() => {
                    void runOperation("createBackupAccount", mutation);
                }}>Mutate</Button>
                <Button onClick={resetOperation}>Reset</Button>
                <Button onClick={() => {
                    void runOperation("validateBackupHome", nextOperation);
                }}>Next</Button>
            </>;
        };

        render(<MutationHarness />);
        fireEvent.click(screen.getByText("Mutate"));
        expect(screen.getByText("createBackupAccount")).toBeTruthy();

        fireEvent.click(screen.getByText("Reset"));
        expect(screen.getByText("createBackupAccount")).toBeTruthy();
        fireEvent.click(screen.getByText("Next"));
        expect(nextOperation).not.toHaveBeenCalled();

        resolveMutation?.();
        await screen.findByText("idle");
        fireEvent.click(screen.getByText("Next"));
        expect(nextOperation).toHaveBeenCalledOnce();
    });
});
