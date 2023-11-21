# Copyright (c) 2020, 2023, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is also distributed with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have included with MySQL.
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

import json
import sqlite3

import mysqlsh

from .Error import SYSTEM_GENERIC_ERROR, MSGException


class Response:
    @staticmethod
    def standard(type, msg, args={}, state={}):
        return {
            **{
                "request_state": {
                    **{
                        "type": type,
                        "msg": msg
                    },
                    **state
                }
            },
            **args
        }

    @staticmethod
    def ok(msg, args={}):
        return Response.standard("OK", msg, args)

    @staticmethod
    def error(msg, args={}, state={}):
        return Response.standard("ERROR", msg, args, state)

    @staticmethod
    def exception(e, args={}):
        if isinstance(e, mysqlsh.DBError):
            return Response.error(e.msg, args, {
                "source": "MYSQL",
                "code": e.code,
                "sqlstate": e.sqlstate
            })
        elif isinstance(e, mysqlsh.Error):
            return Response.error(e.msg, args, {
                "source": "MYSQLSH",
                "code": e.code
            })
        elif isinstance(e, sqlite3.Error):
            return Response.error(str(e), args, {
                "source": "SQLITE"
            })
        elif isinstance(e, MSGException):
            return Response.error(e.msg, args, {
                "source": e.source,
                "code": e.code
            })
        else:
            return Response.error(str(e), args, {
                "source": "MSG",
                "code": SYSTEM_GENERIC_ERROR
            })

    @staticmethod
    def pending(msg=None, args={}):
        if msg is None:
            msg = "Execution started..."
        return Response.standard("PENDING", msg, args)

    @staticmethod
    def fromStatus(status, args={}):
        return Response.standard(status['type'], status['msg'], args)

    @staticmethod
    def cancelled(msg, args={}, state={}):
        return Response.standard("CANCELLED", msg, args, state)


class Protocol(object):
    @staticmethod
    def get_message(msg_type, message, request_id: None):
        request_id_str = request_id if request_id else ''
        response = {
            "request_id": request_id_str,
            "request_state": {
                "type": msg_type,
                "msg": message
            }
        }

        return json.dumps(response, separators=(',', ':'))

    @staticmethod
    def get_response(msg_type, message, request_id=None, values=None):
        msg_text = json.dumps(message) if isinstance(
            message, dict) else message
        request_id_str = request_id if request_id else ''

        response = {
            "response": msg_type,
            "message": msg_text,
            "request_id": request_id_str,
        }

        if values:
            if isinstance(values, dict):
                response.update(values)
            else:
                response.update({"result": str(values)})

        return json.dumps(response, separators=(',', ':'))
