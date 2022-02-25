/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
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

import { IServicePasswordRequest } from "../../app-logic/Types";
import {
    IOpenConnectionData, IOpenMdsConnectionData, IShellFeedbackRequest, IShellResultType, ShellPromptResponseType,
} from "../../communication";
import { requisitions } from "../../supplement/Requisitions";
import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface";

export class PromptUtils {

    public static isShellMdsPromptResult(response?: IOpenConnectionData): response is IOpenMdsConnectionData {
        const candidate = response as IOpenMdsConnectionData;

        return candidate?.result?.prompt !== undefined;
    }

    public static isShellPromptResult(response?: IShellResultType): response is IShellFeedbackRequest {
        const candidate = response as IShellFeedbackRequest;

        return candidate?.prompt !== undefined;
    }

    public static isShellPasswordResult(response?: IShellResultType): response is IShellFeedbackRequest {
        const candidate = response as IShellFeedbackRequest;

        return candidate?.password !== undefined;
    }

    public static acceptPassword = (data: { request: IServicePasswordRequest; password: string }): Promise<boolean> => {
        return new Promise((resolve) => {
            const backend = data.request.payload as ShellInterfaceSqlEditor;
            if (backend) {
                backend.sendReply(data.request.requestId, ShellPromptResponseType.Ok, data.password)
                    .then(() => { resolve(true); })
                    .catch(() => { resolve(false); });
            } else {
                resolve(false);
            }
        });
    };

    public static cancelPassword = (request: IServicePasswordRequest): Promise<boolean> => {
        return new Promise((resolve) => {
            const backend = request.payload as ShellInterfaceSqlEditor;
            if (backend) {
                backend.sendReply(request.requestId, ShellPromptResponseType.Cancel, "")
                    .then(() => { resolve(true); })
                    .catch(() => { resolve(false); });
            } else {
                resolve(false);
            }
        });
    };
}

requisitions.register("acceptPassword", PromptUtils.acceptPassword);
requisitions.register("cancelPassword", PromptUtils.cancelPassword);

