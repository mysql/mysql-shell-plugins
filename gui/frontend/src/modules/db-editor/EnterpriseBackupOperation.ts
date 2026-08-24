/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 */

import { useCallback, useRef, useState } from "preact/hooks";

export type MebOperation =
    | "validateLocalAccess"
    | "validateBackupHome"
    | "createBackupHome"
    | "validateBackupAccount"
    | "createBackupAccount"
    | "storeBackupAccountPassword"
    | "fixBackupAccount"
    | "resetBackupAccountPassword"
    | "applyConfiguration";

export type MebOperationRunner = <T>(
    operation: MebOperation,
    callback: () => Promise<T>,
) => Promise<T | undefined>;

const resettableOperations = new Set<MebOperation>([
    "validateLocalAccess",
    "validateBackupHome",
    "validateBackupAccount",
]);

export const useMebOperation = (): {
    activeOperation?: MebOperation;
    resetOperation: () => void;
    runOperation: MebOperationRunner;
} => {
    const activeOperationRef = useRef<MebOperation>();
    const operationGeneration = useRef(0);
    const [activeOperation, setActiveOperation] = useState<MebOperation>();

    const resetOperation = useCallback((): void => {
        if (activeOperationRef.current !== undefined
            && !resettableOperations.has(activeOperationRef.current)) {
            return;
        }

        ++operationGeneration.current;
        activeOperationRef.current = undefined;
        setActiveOperation(undefined);
    }, []);

    const runOperation = useCallback<MebOperationRunner>(async (operation, callback) => {
        if (activeOperationRef.current !== undefined) {
            return undefined;
        }

        const generation = ++operationGeneration.current;
        activeOperationRef.current = operation;
        setActiveOperation(operation);
        try {
            return await callback();
        } finally {
            if (operationGeneration.current === generation) {
                activeOperationRef.current = undefined;
                setActiveOperation(undefined);
            }
        }
    }, []);

    return { activeOperation, resetOperation, runOperation };
};
