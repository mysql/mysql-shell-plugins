# Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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

import threading
import time
import uuid

import pytest

import config
import gui_plugin.core.Logger as logger
from gui_plugin import db_connections, sql_editor
from gui_plugin.core.Error import MSGException
from tests.lib.MockWebSession import MockWebSession
from tests.lib.utils import backend_callback, backend_callback_with_pending


class MockContext:
    pass


class Parameters:
    _connection_id = None
    _web_session = None
    _module_session = None
    _module_session_id = None
    _db_connection_id = None


@pytest.fixture(scope="module")
def params():
    parameters = Parameters()
    parameters._connection_id = None
    parameters._web_session = MockWebSession()

    @backend_callback(1)
    def open_connection_cb(msg_type, msg, request_id, values):
        if values['request_state']['type'] != "PENDING"\
                or values['request_state']['msg'] != "Connection was successfully opened.":
            raise Exception('Failed opening connection.')

    parameters._web_session.register_callback(
        open_connection_cb.request_id, open_connection_cb)

    _thread = threading.current_thread()

    _context = MockContext()
    setattr(_context, "web_handler", parameters._web_session)
    setattr(_context, "request_id", None)
    setattr(_thread, "get_context", lambda: _context)

    result = sql_editor.start_session()
    parameters._module_session_id = result['module_session_id']
    parameters._module_session = parameters._web_session.module_sessions[
        parameters._module_session_id]
    connection_options = config.Config.get_instance(
    ).database_connections[0]['options'].copy()
    del connection_options['portStr']

    result = db_connections.add_db_connection(1, {
        "db_type": "MySQL",
        "caption": "This is a test MySQL database",
        "description": "This is a test MySQL database description",
        "options": connection_options
    }, '', parameters._web_session.db)

    parameters._web_session.request_id = open_connection_cb.request_id
    parameters._db_connection_id = result[0]
    sql_editor.open_connection(
        parameters._db_connection_id, parameters._module_session)

    open_connection_cb.join_and_validate()

    parameters._web_session.request_id = None

    yield parameters

    parameters._web_session.db.close()
    result = sql_editor.close_session(parameters._module_session)
    # del parameters._web_session.module_sessions[parameters._module_session_id]


class Test_sql_editor:

    def test_service_connection(self, params):
        @backend_callback_with_pending()
        def callback_request1(msg_type, msg, request_id, values):
            logger.debug("callback_request1")

        @backend_callback_with_pending()
        def callback_schemas(msg_type, msg, request_id, values):
            logger.debug("callback_schemas")

        params._web_session.register_callback(
            callback_request1.request_id, callback_request1)
        params._web_session.register_callback(
            callback_schemas.request_id, callback_schemas)

        params._web_session.request_id = callback_schemas.request_id
        sql_editor.execute(sql="SELECT SLEEP(3)",
                          session=params._module_session._db_user_session)
        callback_schemas.join_and_validate()
        params._web_session.request_id = callback_request1.request_id
        sql_editor.get_current_schema(
            session=params._module_session._db_user_session)
        callback_request1.join_and_validate()

        params._web_session.request_id = None

    def test_close_session(self, params):
        request_id1 = str(uuid.uuid1())
        sql_editor.close_session(params._module_session)

        with pytest.raises(MSGException) as e:
            sql_editor.execute(
                session=params._module_session._db_user_session, sql="SELECT SLEEP(1)")
        assert e.value.args[0] == "Error[MSG-1012]: Session required for this operation."

        @backend_callback(1)
        def open_connection_cb(msg_type, msg, request_id, values):
            if values['request_state']['type'] != "PENDING"\
                    or values['request_state']['msg'] != "Connection was successfully opened.":
                raise Exception('Failed opening connection.')

        params._web_session.register_callback(
            open_connection_cb.request_id, open_connection_cb)

        params._web_session.request_id = open_connection_cb.request_id
        sql_editor.open_connection(
            params._db_connection_id, params._module_session)

        open_connection_cb.join_and_validate()
        params._web_session.request_id = None

    def test_execute_query_with_params(self, params):
        @backend_callback_with_pending()
        def callback_execute(msg_type, msg, request_id=None, values=None):
            assert 'columns' in values
            assert 'rows' in values

        params._web_session.register_callback(
            callback_execute.request_id, callback_execute)

        params._web_session.request_id = callback_execute.request_id
        result = sql_editor.execute(
            session=params._module_session._db_user_session,
            sql="SHOW DATABASES LIKE ?", params=['mysql'])

        callback_execute.join_and_validate()
        params._web_session.request_id = None
