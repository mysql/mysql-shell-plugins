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

CREATE REST SERVICE /chatApp
    COMMENTS ''
    AUTHENTICATION
        REDIRECTION '/chatApp/app/'
    OPTIONS {
        "http": {
            "allowedOrigin": "auto"
        },
        "headers": {
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Origin, X-Auth-Token",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Credentials": "true"
        },
        "logging": {
            "request": {
                "body": true,
                "headers": true
            },
            "response": {
                "body": true,
                "headers": true
            },
            "exceptions": true
        },
        "includeLinksInResults": false,
        "returnInternalErrorDetails": true
    };

USE REST SERVICE /chatApp;

CREATE OR REPLACE REST SCHEMA /chat
    FROM `chat`;

USE REST SCHEMA /chat;

CREATE OR REPLACE REST PROCEDURE /heatwaveChatAsync
    AS chat.heatwave_chat_async
    PARAMETERS ChatAppChatHeatwaveChatAsyncParams {
        prompt: prompt @IN,
        taskId: task_id @OUT,
        options: options @IN
    }
    AUTHENTICATION REQUIRED;

CREATE OR REPLACE REST PROCEDURE /heatwaveChatAsyncResult
    AS chat.heatwave_chat_async_result
    PARAMETERS ChatAppChatHeatwaveChatAsyncResultParams {
        taskId: task_id @IN,
        response: response @OUT,
        progress: progress @OUT,
        chatOptions: chat_options @OUT,
        status: status @OUT
    }
    AUTHENTICATION REQUIRED;

