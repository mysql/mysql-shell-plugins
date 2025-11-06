/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

import { existsSync } from "fs";
import { ChildProcess, spawn } from "child_process";
import fsPromises from "fs/promises";
import fs from "fs";
import { join } from "path";
import { screenSize } from "./Misc";
import { Os } from "./Os";
import { wait1second } from "./constants";
import { driver } from "./Misc";
import { error } from "vscode-extension-tester";

const log = join(process.cwd(), `recording_${process.env.TEST_SUITE}.log`);

/**
 * This class aggregates the functions that record the tests execution
 */
export class E2ERecording {

    /** The videos directory storage */
    public videosDir = join(process.cwd(), "videos");

    /** The video path */
    public videoPath: string | undefined;

    /** The ffmpeg process */
    public ffmpegProcess: ChildProcess | undefined;

    /** The video name */
    public videoName: string;

    public constructor(videoName: string) {
        this.videoName = videoName;
    }

    /**
     * Starts to record a video
     */
    public start = async (): Promise<void> => {

        if (Os.isWindows()) {
            return;
        }

        if (!existsSync(this.videosDir)) {
            await fsPromises.mkdir(this.videosDir);
        }

        if (!existsSync(log)) {
            await fsPromises.writeFile(log, "");
        }

        await fsPromises.appendFile(log, `------------${this.videoName}----------\r\n`);

        this.videoName = this.videoName.replace(/\s+/g, "_");
        this.videoPath = join(process.cwd(), "videos", `${this.videoName}.mp4`);
        const ffmpeg = join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg");
        let inputFormat: string;
        let screen: string;

        if (Os.isLinux()) {
            inputFormat = "x11grab";
            screen = String(process.env.DISPLAY);
        } else if (Os.isMacOs()) {
            inputFormat = "avfoundation";
            screen = "2";
        } else {
            inputFormat = "gdigrab";
            screen = "desktop";
        }

        return new Promise((resolve, reject) => {
            this.ffmpegProcess = spawn(ffmpeg, [
                "-y",
                "-f", inputFormat,
                "-video_size", screenSize,
                "-framerate", "30",
                "-i", screen!,
                "-r", "30",
                "-c:v", "libx264",
                this.videoPath!,
            ], {
                env: {
                    ...process.env,
                    DISPLAY: process.env.DISPLAY
                }
            });

            let isRecording = false;

            this.ffmpegProcess.stdout!.on("data", (data: string) => {
                fs.appendFileSync(log, `${data.toString()}\r\n`);
                if (data.toString().match(/frame=/) !== null) {
                    isRecording = true;
                }
            });

            this.ffmpegProcess.stderr!.on("data", (data: string) => {
                fs.appendFileSync(log, `${data.toString()}\r\n`);
                if (data.toString().match(/frame=/) !== null) {
                    isRecording = true;
                }
            });

            const timeout = new Promise<void>((_, reject) => {
                setTimeout(() => {
                    if (!isRecording) {
                        reject(new Error(`Failed to start recording after ${wait1second * 10} seconds`));
                    }
                }, wait1second * 10);
            });

            Promise.race([
                new Promise<void>((resolve) => {
                    const interval = setInterval(() => {
                        if (isRecording) {
                            clearInterval(interval);
                            fs.appendFileSync(log, `Started recording test '${this.videoName}'\r\n`);
                            resolve();
                        }
                    }, 100);
                }),
                timeout
            ])
                .then(() => {
                    resolve();
                })
                .catch((err: unknown) => {
                    this.ffmpegProcess!.kill();
                    reject(new Error(err!.toString()));
                });
        });

    };

    /**
     * Stops recording the video and waits until the video file exists
     * 
     */
    public stop = async (): Promise<void> => {

        if (this.ffmpegProcess) {
            const stopRecording = new Promise((resolve, reject): void => {
                this.ffmpegProcess!.stdin!.write("q");

                this.ffmpegProcess!.on("close", (code) => {
                    if (code === 0) {
                        fs.appendFileSync(log, `Stopped recording test '${this.videoName}'\r\n`);
                        resolve(true);
                    } else {
                        this.ffmpegProcess!.kill();
                        reject(new Error(`Error closing ffmpeg: ${code}`));
                    }
                });
            });

            await stopRecording;

            try {
                await driver.wait(() => {
                    return existsSync(this.videoPath!);
                }, wait1second * 10, `The video '${this.videoPath}' was not found`);
            } catch (e) {
                if (!(e instanceof error.TimeoutError)) {
                    throw e;
                }
            }

            this.ffmpegProcess.kill();
        }
    };
}

