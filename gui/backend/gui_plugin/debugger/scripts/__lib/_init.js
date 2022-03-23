
//
//  Bootstrap some of the functionality for the user stories. This
//  script initializes some of the objects that are going to be used
//  during the tests to access facilities.
//
var lib = ws.tokens.lib
lib.init_lib_item = Object({
    "params": {
        "component": lib,
        "name": "init_lib_item"
    }
})

var unit = ws.tokens.unit = Object({"name": "unit"})


var regression = ws.tokens.regression = Object({"name": "regression"})

var user_stories = ws.tokens.user_stories = Object({"name": "user_stories"})

var requests = ws.tokens.requests = Object({
    "sqleditor": {},
    "shell": {}
})

var responses = ws.tokens.responses = Object({
    "ok": {},
    "pending": {},
    "error": {}
})


//  Lib
//  --------------------------------------------

//  Generic
lib.init_lib_item.params.component = lib

lib.init_lib_item.params.name = "init_lib_item"
ws.execute("__lib/_init_lib_item.js")
//  Set the component again, since the lib.init_lib_item was recreated
lib.init_lib_item.params.component = lib

lib.init_lib_item.params.name = "init_lib_component"
ws.execute(lib.init_lib_item.file)
//  Set the component again, since the lib.init_lib_component was recreated
lib.init_lib_component.params["component"] = lib

lib.init_lib_item.params.name = "noop"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "init_mysql"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "init_mysql_x"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "init_sqlite"
ws.execute(lib.init_lib_item.file)

//  Lib::Login
lib.init_lib_component.params.name = "login"
ws.execute(lib.init_lib_component.file)
lib.init_lib_item.params.component = lib.login


lib.init_lib_item.params.name = "login"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "logout"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "admin"
ws.execute(lib.init_lib_item.file)

//  Lib::Connection
lib.init_lib_component.params.name = "connection"
ws.execute(lib.init_lib_component.file)
lib.init_lib_item.params.component = lib.connection


// lib.init_lib_item.params.name = "add_mysql"
// ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "add_mysql_root"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "add_mysql_user1"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "add_mysql_user2"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "add_mysqlx"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "add_sqlite"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "add"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "remove"
ws.execute(lib.init_lib_item.file)


//  Lib::SqlEditor
lib.init_lib_component.params.name = "sqleditor"
ws.execute(lib.init_lib_component.file)
lib.init_lib_item.params.component = lib.sqleditor


lib.init_lib_item.params.name = "open_session"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "close_session"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "create_test_sessions"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "open_connection"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "open_connection_validate_mysql"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "open_connection_validate_mysqlx"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "open_connection_validate_sqlite"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "for_each_connection"
ws.execute("__lib/_init_lib_item.js")

lib.init_lib_item.params.name = "with_new_connection"
ws.execute("__lib/_init_lib_item.js")

lib.init_lib_item.params.name = "with_mysql_connections"
ws.execute("__lib/_init_lib_item.js")


//  Lib::Shell
lib.init_lib_component.params.name = "shell"
ws.execute(lib.init_lib_component.file)
lib.init_lib_item.params.component = lib.shell


lib.init_lib_item.params.name = "open_session"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "close_session"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "connect_database_default"
ws.execute(lib.init_lib_item.file)

//  Lib::DBSession
lib.init_lib_component.params.name = "dbsession"
ws.execute(lib.init_lib_component.file)
lib.init_lib_item.params.component = lib.dbsession

lib.init_lib_item.params.name = "open_db_session"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "close_db_session"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "open_connection_validate_mysql"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "open_connection_validate_sqlite"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "init_db"
ws.execute(lib.init_lib_item.file)

//  Unit
//  --------------------------------------------
lib.init_lib_component.params["component"] = unit

//  Unit::Module
lib.init_lib_component.params.name = "module"
ws.execute(lib.init_lib_component.file)
lib.init_lib_item.params.component = unit.module

lib.init_lib_item.params.name = "data_category_management"
ws.execute(lib.init_lib_item.file)

//  Unit::SqlEditor
lib.init_lib_component.params.name = "sqleditor"
ws.execute(lib.init_lib_component.file)
lib.init_lib_item.params.component = unit.sqleditor

lib.init_lib_item.params.name = "auto_commit_mysql"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "auto_commit_sqlite"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "multiple_resultsets"
ws.execute(lib.init_lib_item.file)

//  Unit::Shell
lib.init_lib_component.params.name = "shell"
ws.execute(lib.init_lib_component.file)
lib.init_lib_item.params.component = unit.shell

lib.init_lib_item.params.name = "fail_command_blacklist"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "fail_incomplete_input"
ws.execute(lib.init_lib_item.file)

//  regression
//  --------------------------------------------
lib.init_lib_component.params["component"] = regression

//  Regression::SqlEditor
lib.init_lib_component.params.name = "sqleditor"
ws.execute(lib.init_lib_component.file)
lib.init_lib_item.params.component = regression.sqleditor

lib.init_lib_item.params.name = "columns_ordered_by_ordinal_position"
ws.execute(lib.init_lib_item.file)


//  Regression::Shell
lib.init_lib_component.params.name = "shell"
ws.execute(lib.init_lib_component.file)
lib.init_lib_item.params.component = regression.shell

lib.init_lib_item.params.name = "some_errors"
ws.execute(lib.init_lib_item.file)

//  User Stories
//  --------------------------------------------
lib.init_lib_component.params["component"] = user_stories

//  User Stories::SqlEditor
lib.init_lib_component.params.name = "sql_editor"
ws.execute(lib.init_lib_component.file)
lib.init_lib_item.params.component = user_stories.sql_editor

lib.init_lib_item.params.name = "execute_with_options"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "cancel_request"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "mysql_connection_classic"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "mysql_connection_x_protocol"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "mysql_connection_with_password_user1"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "mysql_connection_with_password_user2"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "mysql_connection_without_password_user2"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "wrong_query_handling"
ws.execute(lib.init_lib_item.file)



//  User Stories::Metadata
lib.init_lib_component.params.name = "metadata"
ws.execute(lib.init_lib_component.file)
lib.init_lib_item.params.component = user_stories.metadata

lib.init_lib_item.params.name = "get_catalog_objects_mysql"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "get_schema_objects_mysql"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "get_table_objects_mysql"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "get_catalog_objects_sqlite"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "get_schema_objects_sqlite"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "get_table_objects_sqlite"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "get_user_variables"
ws.execute(lib.init_lib_item.file)

//  User Stories::Shell
lib.init_lib_component.params.name = "shell"
ws.execute(lib.init_lib_component.file)
lib.init_lib_item.params.component = user_stories.shell

lib.init_lib_item.params.name = "command_not_supported_error"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "get_collections"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "javascript_command_success"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "mysql_login_password"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "mysql_login_password_cancel"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "mysql_login_passwordless"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "new_session"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "new_session_with_connection"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "new_session_with_connection_no_password"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "new_session_with_connection_wrong_password"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "new_session_with_connection_and_command"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "prompt_for_info"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "python_command_success"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "prompt_for_info_cancel"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "sql_command_success"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "sql_query"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "autocomplete"
ws.execute(lib.init_lib_item.file)


//  User Stories::Module
lib.init_lib_component.params.name = "module"
ws.execute(lib.init_lib_component.file)
lib.init_lib_item.params.component = user_stories.module

lib.init_lib_item.params.name = "module_data_create"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "module_data_fail_share_delete"
ws.execute(lib.init_lib_item.file)

lib.init_lib_item.params.name = "module_data_delete"
ws.execute(lib.init_lib_item.file)


//  Stock Requests
//  --------------------------------------------
requests.sqleditor.execute = Object({
    "request": "execute",
    "request_id": ws.generateRequestId(true),
    "command": "gui.sqleditor.execute",
    "args": {
        "sql": "",
        "module_session_id": ws.lastModuleSessionId,
        "params": []
    }
})
Object.freeze(requests.sqleditor.execute)

requests.shell.execute = Object({
    "request": "execute",
    "request_id": ws.generateRequestId(true),
    "command": "gui.shell.execute",
    "args": {
        "command": "",
        "module_session_id": ws.lastModuleSessionId,
    }
})
Object.freeze(requests.shell.execute)

//  Stock Responses
//  --------------------------------------------
responses.pending.executionStarted = Object({
    "request_id": ws.lastGeneratedRequestId,
    "request_state": {
        "type": "PENDING",
        "msg": "Execution started..."
    }
})
Object.freeze(responses.pending.executionStarted)

responses.pending.executing = Object({
    "request_state": {
        "type": "PENDING",
        "msg": "Executing..."
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": {},
})
Object.freeze(responses.pending.executing)

responses.pending.canceled = Object({
    "request_state": {
        "type": "PENDING",
        "msg": "Executing..."
    },
    "request_id": ws.lastGeneratedRequestId,
    "result": {
        "error": "Cancelled\n"
    }
})
Object.freeze(responses.pending.canceled)

responses.ok.default = Object({
    "request_state": {
        "type": "OK",
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId
})
Object.freeze(responses.ok.default)

responses.ok.sqlZeroRows = Object({
    "request_state": {
        "type": "OK",
        "msg": "Full result set consisting of 0 rows transferred."
    },
    "request_id": ws.lastGeneratedRequestId,
    "rows": ws.ignore,
    "total_row_count": 0,
    "execution_time": ws.ignore
})
Object.freeze(responses.ok.sqlZeroRows)

responses.ok.oneRowTransferred = Object({
    "request_state": {
        "type": "OK",
        "msg": "Full result set consisting of 1 row transferred."
    },
    "request_id": ws.lastGeneratedRequestId,
    "rows": ws.ignore,
    "total_row_count": 1,
    "execution_time": ws.ignore
})
Object.freeze(responses.ok.oneRowTransferred)

responses.error.default = Object({
    "request_state": {
        "type": "ERROR",
        "source": "MSG",
        "code": ws.ignore,
        "msg": ws.ignore
    },
    "request_id": ws.lastGeneratedRequestId,
})

responses.error.commandNotSupported = Object({
    "request_state": {
        "type": "ERROR",
        "msg": "The requested command is not supported.",
        "source":
        "MSG", "code": 1500
    },
    "request_id": ws.lastGeneratedRequestId,
})
Object.freeze(responses.error.commandNotSupported)
