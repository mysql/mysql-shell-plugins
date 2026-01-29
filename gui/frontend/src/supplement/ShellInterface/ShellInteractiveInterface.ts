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

import { MessageScheduler, ISendRequestParameters, ResponsePromise} from "../../communication/MessageScheduler.js";
import type { IProtocolResults } from "../../communication/ProtocolResultMapper.js";
import { type IPromptReplyBackend, ShellPromptResponseType, Protocol } from "../../communication/Protocol.js";
import { isShellPromptResult } from "../../utilities/helpers.js"
import { ShellPromptHandler } from "../../modules/common/ShellPromptHandler.js";
import { IShellInteractiveBackend } from "./ShellInteractiveBackend.js";


export class ShellInteractiveInterface implements IPromptReplyBackend, IShellInteractiveBackend {
    public async sendReply(requestId: string, type: ShellPromptResponseType, reply: string): Promise<void> {
        await MessageScheduler.get.sendRequest({
            requestType: Protocol.PromptReply,
            parameters: { requestId, type, reply },
        }, false);
    }

    public async sendInteractiveRequest<K extends keyof IProtocolResults>(
        details: ISendRequestParameters<K>, useExecute = true): Promise<ResponsePromise<K>> {

        const callerOnData = details.onData;


        details.onData = async (response: any, requestId: string) => {
            if ("result" in response && isShellPromptResult(response.result)) {
                return ShellPromptHandler.handleShellPrompt(response.result, requestId, this);
            } else {
                if (callerOnData) {
                    return await callerOnData(response, requestId);
                }

                return Promise.resolve(false);
            }
        };


        const response = await MessageScheduler.get.sendRequest(details, useExecute);
        
        return response;
    }
}