/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

import { IThenableCallback } from "./index.js";
import { IDictionary } from "../app-logic/general-types.js";
import { requisitions } from "./Requisitions.js";
import { Settings } from "./Settings/Settings.js";
import { WorkerCallback } from "./WorkerCallback.js";

export type IdentifiedWorker = Worker & {
    id: string;
};

const debug = false;

interface IWorkerTask<WorkerTaskType, WorkerResultType> {
    assignedWorker?: IdentifiedWorker; // Assigned as soon as the task is actually scheduled.
    taskId: number;                 // A running number to find the task in the running list.
    refCount: number;

    // Callback functions.
    onResult?: (taskId: number, data: WorkerResultType) => void;
    onError?: (taskId: number, reason?: unknown) => void;

    // This field takes task specific data.
    data: WorkerTaskType;
}

/**
 * A class to distribute time consuming tasks over a number of web workers.
 * Parameter `WorkerDataType` specifies the type of data handled by a task and returned in the callback.
 */
export abstract class WorkerPool<WorkerTaskType, WorkerResultType> {

    protected nextTaskId = 0;

    private idleWorkers: IdentifiedWorker[] = [];

    // Running tasks.
    private readonly runningTasks = new Map<number, IWorkerTask<WorkerTaskType, WorkerResultType>>();

    // Tasks waiting for a free worker.
    private pendingTasks: Array<IWorkerTask<WorkerTaskType, WorkerResultType>> = [];

    private timer: ReturnType<typeof setTimeout> | null = null;

    private minWorkerCount = 0;
    private maxWorkerCount = 0;
    private maxPendingTaskCount = 0;
    private removeIdleTime = 0;

    private settingsKeys = new Set<string>([
        "workers.minWorkerCount",
        "workers.maxWorkerCount",
        "workers.maxPendingTaskCount",
        "workers.removeIdleTime",
    ]);

    public constructor() {
        this.setup();

        requisitions.register("settingsChanged", this.settingsChanged);
    }

    /**
     * Ensures all workers are terminated to avoid leaking resources.
     */
    public dispose(): void {
        if (this.timer) {
            clearInterval(this.timer);
        }

        requisitions.unregister("settingsChanged", this.settingsChanged);

        this.idleWorkers.forEach((worker) => { return worker.terminate(); });
        this.idleWorkers = [];
        this.runningTasks.forEach((task) => { return task.assignedWorker?.terminate(); });
        this.runningTasks.clear();
    }

    /**
     * Assigns a new task to a free worker in this pool. If no free worker is available, create a new one.
     * If the maximum number of workers has been reached, keep the task in the pending task list until a worker
     * becomes available.
     *
     * @param data The data to send to the worker for execution.
     *
     * @returns A callback for multiple invocations when a worker processed the data and sent a result back.
     */
    public runTask(data: WorkerTaskType): IThenableCallback<WorkerResultType> {
        return new WorkerCallback((onResult, onError): void => {
            this.scheduleTask({
                refCount: 1,
                taskId: this.nextTaskId++,
                onResult,
                onError,
                data,
            });
        });
    }

    /**
     * Like `runTask` but doesn't create a new task. Instead the given task is used to process the new request.
     * New results are again sent to the same callback as specified by the original `runTask` call.
     *
     * @param taskId The ID of a task to use for this request. The task must currently be in executing state.
     * @param data The data for the new request.
     */
    public continueTask(taskId: number, data: WorkerTaskType): void {
        const task = this.runningTasks.get(taskId);
        if (task) {
            if (debug) {
                console.log("Worker pool: added request to task " + String(task.taskId));
            }

            task.data = data;
            task.assignedWorker!.postMessage({ taskId, data });
        }
    }

    /**
     * Increases the reference count of the given task to avoid re-scheduling it until releaseTask is called.
     * The task must currently be executing or this call has no effect.
     *
     * @param taskId The ID of the task to retain.
     *
     * @returns True if the task was found, otherwise false.
     */
    public retainTask(taskId: number): boolean {
        const task = this.runningTasks.get(taskId);
        if (task) {
            ++task.refCount;

            return true;
        }

        return false;
    }

    /**
     * Decrease the reference count of the given task. If the ref count reaches zero, a new task is assigned to the
     * worker that was bound to the given task, provided there's any pending task. Otherwise the task is destroyed
     * and its worker is moved to the idle workers list.
     *
     * The task must currently be executing or this call has no effect.
     *
     * @param taskId The ID of the task to release.
     *
     * @returns True if the task was found, otherwise false.
     */
    public releaseTask(taskId: number): boolean {
        const task = this.runningTasks.get(taskId);
        if (task) {
            --task.refCount;
            if (task.refCount <= 0) {
                task.assignedWorker?.postMessage({ taskId, data: { api: "cleanup" } });

                this.runningTasks.delete(taskId);

                // Schedule the next task, if one is pending.
                const nextTask = this.pendingTasks.shift();
                if (nextTask) {
                    nextTask.assignedWorker = task.assignedWorker;
                    this.runningTasks.set(nextTask.taskId, nextTask);
                    nextTask.assignedWorker!.postMessage({ taskId: nextTask.taskId, data: nextTask.data });

                    if (debug) {
                        console.log("Worker pool: started pending task " + String(nextTask.taskId) + " on worker "
                            + nextTask.assignedWorker!.id);
                    }
                } else {
                    if (debug) {
                        console.log("Worker pool: worker going idle: " + task.assignedWorker!.id);
                    }

                    // Move the worker over to the idle workers list.
                    this.idleWorkers.push(task.assignedWorker!);
                }
            }

            return true;
        }

        return false;
    }

    /**
     * Takes a task and assigns it to a new or idle worker.
     *
     * @param task The task to schedule.
     */
    protected scheduleTask(task: IWorkerTask<WorkerTaskType, WorkerResultType>): void {
        let worker = this.idleWorkers.shift();
        if (!worker) {
            if (this.runningTasks.size >= this.maxWorkerCount) {
                // Cannot create a new worker. Cache the task for now.
                // Do a sanity check first, however, to avoid adding tasks endlessly.
                if (this.pendingTasks.length >= this.maxPendingTaskCount) {
                    throw new Error("Reached maximum number of pending tasks in worker pool");
                }

                this.pendingTasks.push(task);
            } else {
                worker = this.setupNewWorker();
            }
        } else if (debug) {
            console.log("Worker pool: reuse worker " + worker.id);
        }

        if (worker) {
            task.assignedWorker = worker;
            this.runningTasks.set(task.taskId, task);
            worker.postMessage({ taskId: task.taskId, data: task.data });

            if (debug) {
                console.log("Worker pool: started task " + String(task.taskId));
            }
        }
    }

    private settingsChanged = (entry?: { key: string; value: unknown; }): Promise<boolean> => {
        if (entry) {
            if (this.settingsKeys.has(entry.key)) {
                this.setup();

                return Promise.resolve(true);
            }
        }

        return Promise.resolve(false);
    };

    /**
     * Dispatches the returned data to the individual promises/callbacks.
     * The worker running the task for the received data might be idle now. See if tasks are waiting and
     * schedule the next one with that task, if so.
     *
     * @param event Event data.
     */
    private handleWorkerMessage = (event: MessageEvent): void => {
        const { taskId, data }: { taskId: number; data: IDictionary; } = event.data;
        const task = this.runningTasks.get(taskId);

        if (debug) {
            console.log("Worker pool: received data from task " + String(taskId));
        }

        // If there's no task entry for the given id then the task has been cancelled and we ignore this message.
        // Otherwise run the callback and schedule the next waiting task, if there's any.
        if (task) {
            if (data.error) {
                task.onError?.(taskId, (data).error);
            } else {
                task.onResult?.(taskId, data as unknown as WorkerResultType);
            }

            if (data.final) {
                this.releaseTask(taskId);
            }
        }
    };

    /**
     * Creates and sets up a new worker.
     *
     * @returns The fully set up worker.
     */
    private setupNewWorker(): IdentifiedWorker {
        const worker = this.createNewWorker();

        if (debug) {
            console.log("Worker pool: created new worker " + worker.id);
        }

        worker.addEventListener("message", this.handleWorkerMessage);
        worker.addEventListener("error", (event) => {
            // TODO: better worker error handling.
            console.log("Worker error encountered:");
            console.log(event);
        });

        return worker;
    }

    private setup(): void {
        this.minWorkerCount = Settings.get("workers.minWorkerCount", 3);
        this.maxWorkerCount = Settings.get("workers.maxWorkerCount", 10);
        this.maxPendingTaskCount = Settings.get("workers.maxPendingTaskCount", 1000);
        this.removeIdleTime = Settings.get("workers.removeIdleTime", 60);

        // There will always be at least one worker ready for accepting tasks.
        if (this.maxWorkerCount < 1) {
            this.maxWorkerCount = 1;
        }

        if (this.minWorkerCount > this.maxWorkerCount) {
            this.minWorkerCount = this.maxWorkerCount;
        }

        if (this.minWorkerCount < 1) {
            this.minWorkerCount = 1;
        }

        while (this.idleWorkers.length < this.minWorkerCount) {
            const worker = this.setupNewWorker();
            this.idleWorkers.push(worker);
        }

        // Set up a "garbage collector" for idle tasks. Every `removeIdleTime` seconds one of the idle workers is
        // terminated, unless only the minimal number of workers remain, which are always kept alive.
        if (this.timer) {
            clearInterval(this.timer);
        }

        if (this.removeIdleTime > 0) {
            this.timer = setInterval(() => {
                if (this.idleWorkers.length > this.minWorkerCount) {
                    const worker = this.idleWorkers.shift();
                    if (worker) {
                        if (debug) {
                            console.log("Worker pool: terminated worker " + worker.id);
                        }
                        worker.terminate();
                    }
                }
            }, this.removeIdleTime * 1000);
        }
    }

    /**
     * Overridden by descendants to return an instance of the worker used in this pool.
     *
     * @returns A new worker instance.
     */
    protected abstract createNewWorker(): IdentifiedWorker;
}
