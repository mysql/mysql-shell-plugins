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
import fs from "fs/promises";
import { join } from "path";
import { screenSize } from "./Misc";
import { Os } from "./Os";

/**
 * This class aggregates the functions that record the tests execution
 */
export class E2ERecording {

    public videosDir = join(process.cwd(), "videos");

    public videoPath: string | undefined;

    public ffmpegProcess: ChildProcess | undefined;

    public videoName: string | undefined;

    public start = async (videoName: string): Promise<void> => {

        if (!existsSync(this.videosDir)) {
            await fs.mkdir(this.videosDir);
        }

        this.videoName = videoName.replace(/\s+/g, "_");
        this.videoPath = join(process.cwd(), "videos", `${this.videoName}.mp4`);
        const ffmpeg = join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg");
        const inputFormat = Os.isLinux() ? "x11grab" : "avfoundation";
        const screen = Os.isLinux() ? process.env.DISPLAY : "0:0";

        return new Promise((resolve) => {
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

            this.ffmpegProcess.stdout!.on("data", (data: string) => {
                if (data.toString().match(/frame=/) !== null) {
                    console.log(`on: Started recording test '${this.videoName}' with pid ${this.ffmpegProcess!.pid}`);
                    resolve();
                }
            });

            this.ffmpegProcess.stderr!.on("data", (data: string) => {
                if (data.toString().match(/frame=/) !== null) {
                    console.log(`err: Started recording test '${this.videoName}' with pid ${this.ffmpegProcess!.pid}`);
                    resolve();
                }
            });
        });

    };

    public stop = async (): Promise<void> => {
        return new Promise((resolve) => {
            this.ffmpegProcess!.stdin!.write("q");
            this.ffmpegProcess!.stdin!.end();
            console.log(`Finished recording test '${this.videoName}'`);
            resolve();
        });
    };
}

