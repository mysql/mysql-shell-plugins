# Copyright (c) 2023, 2024, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is designed to work with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have either included with
# the program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

import mysqlsh

# pylint: disable-msg=W0631 for variable ws
from tests.websocket.TestWebSocket import TWebSocket

ws: TWebSocket

execute_request_id = ws.generateRequestId()

ws.sendAndValidate({
    "request": "execute",
    "request_id": execute_request_id,
    "command": "gui.sql_editor.execute",
    "args": {
        "sql": "DROP SCHEMA IF EXISTS `test_affected_rows` ;",
        "module_session_id": ws.tokens["module_session_id"],
        "params": []
    }
}, [
    {
        "request_state": {"type": "PENDING", "msg": "Execution started..."},
        "request_id": execute_request_id
    },
    {
        "request_id": execute_request_id,
        "request_state": {"type": "PENDING", "msg": ""},
        "result": {
            "rows": [],
            "total_row_count": 0,
            "execution_time": ws.ignore,
            "rows_affected": ws.ignore
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
    }
])

ws.sendAndValidate({
    "request": "execute",
    "request_id": execute_request_id,
    "command": "gui.sql_editor.execute",
    "args": {
        "sql": "CREATE SCHEMA `test_affected_rows` ;",
        "module_session_id": ws.tokens["module_session_id"],
        "params": []
    }
}, [
    {
        "request_state": {"type": "PENDING", "msg": "Execution started..."},
        "request_id": execute_request_id
    },
    {
        "request_id": execute_request_id,
        "request_state": {"type": "PENDING", "msg": ""},
        "result": {
            "rows": [],
            "total_row_count": 0,
            "execution_time": ws.ignore,
            "rows_affected": 1
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
    }
])

ws.sendAndValidate({
    "request": "execute",
    "request_id": execute_request_id,
    "command": "gui.sql_editor.execute",
    "args": {
        "sql": "CREATE TABLE `test_affected_rows`.`user` (`id` INT NOT NULL, `name` VARCHAR(45) NULL, PRIMARY KEY (`id`));",
        "module_session_id": ws.tokens["module_session_id"],
        "params": []
    }
}, [
    {
        "request_state": {"type": "PENDING", "msg": "Execution started..."},
        "request_id": execute_request_id
    },
    {
        "request_id": execute_request_id,
        "request_state": {"type": "PENDING", "msg": ""},
        "result": {
            "rows": [],
            "total_row_count": 0,
            "execution_time": ws.ignore,
            "rows_affected": 0
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
    }
])

ws.sendAndValidate({
    "request": "execute",
    "request_id": execute_request_id,
    "command": "gui.sql_editor.execute",
    "args": {
        "sql": "INSERT INTO `test_affected_rows`.`user` (`id`, `name`) VALUES ('1', 'peter');",
        "module_session_id": ws.tokens["module_session_id"],
        "params": []
    }
}, [
    {
        "request_state": {"type": "PENDING", "msg": "Execution started..."},
        "request_id": execute_request_id
    },
    {
        "request_id": execute_request_id,
        "request_state": {"type": "PENDING", "msg": ""},
        "result": {
            "rows": [],
            "total_row_count": 0,
            "execution_time": ws.ignore,
            "rows_affected": 1
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
    }
])

ws.sendAndValidate({
    "request": "execute",
    "request_id": execute_request_id,
    "command": "gui.sql_editor.execute",
    "args": {
        "sql": "UPDATE `test_affected_rows`.`user` SET `name` = 'parker' WHERE (`id` = '1');",
        "module_session_id": ws.tokens["module_session_id"],
        "params": []
    }
}, [
    {
        "request_state": {"type": "PENDING", "msg": "Execution started..."},
        "request_id": execute_request_id
    },
    {
        "request_id": execute_request_id,
        "request_state": {"type": "PENDING", "msg": ""},
        "result": {
            "rows": [],
            "total_row_count": 0,
            "execution_time": ws.ignore,
            "rows_affected": 1
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
    }
])

ws.sendAndValidate({
    "request": "execute",
    "request_id": execute_request_id,
    "command": "gui.sql_editor.execute",
    "args": {
        "sql": "UPDATE `test_affected_rows`.`user` SET `name` = 'parker' WHERE (`id` = '1');",
        "module_session_id": ws.tokens["module_session_id"],
        "params": []
    }
}, [
    {
        "request_state": {"type": "PENDING", "msg": "Execution started..."},
        "request_id": execute_request_id
    },
    {
        "request_id": execute_request_id,
        "request_state": {"type": "PENDING", "msg": ""},
        "result": {
            "rows": [],
            "total_row_count": 0,
            "execution_time": ws.ignore,
            "rows_affected": 0
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
    }
])


ws.sendAndValidate({
    "request": "execute",
    "request_id": execute_request_id,
    "command": "gui.sql_editor.execute",
    "args": {
        "sql": "DROP SCHEMA `test_affected_rows` ;",
        "module_session_id": ws.tokens["module_session_id"],
        "params": []
    }
}, [
    {
        "request_state": {"type": "PENDING", "msg": "Execution started..."},
        "request_id": execute_request_id
    },
    {
        "request_id": execute_request_id,
        "request_state": {"type": "PENDING", "msg": ""},
        "result": {
            "rows": [],
            "total_row_count": 0,
            "execution_time": ws.ignore
        }
    },
    {
        "request_state": {
            "type": "OK",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "done": true
    }
])
