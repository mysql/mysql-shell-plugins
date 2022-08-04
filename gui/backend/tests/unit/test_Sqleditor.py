# Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

import pytest
import uuid
import config
from gui_plugin import sqleditor
from gui_plugin import dbconnections
from gui_plugin.core.Error import MSGException
from tests.conftest import backend_callback
from .MockWebSession import MockWebSession
from tests import backend_callback_with_pending
import time
import gui_plugin.core.Logger as logger


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
        if values['request_state']['type'] != "OK":
            raise Exception('Failed opening connection.')

    parameters._web_session.register_callback(
        open_connection_cb.request_id, open_connection_cb)

    result = sqleditor.start_session(parameters._web_session)
    parameters._module_session_id = result['module_session_id']
    parameters._module_session = parameters._web_session.module_sessions[
        parameters._module_session_id]
    connection_options = config.Config.get_instance(
    ).database_connections[0]['options'].copy()
    del connection_options['portStr']

    result = dbconnections.add_db_connection(1, {
        "db_type": "MySQL",
        "caption": "This is a test MySQL database",
        "description": "This is a test MySQL database description",
        "options": connection_options
    }, '', parameters._web_session)

    parameters._web_session.request_id = open_connection_cb.request_id
    parameters._db_connection_id = result['result']['db_connection_id']
    sqleditor.open_connection(
        parameters._db_connection_id, parameters._module_session)

    open_connection_cb.join_and_validate()

    parameters._web_session.request_id = None

    yield parameters

    parameters._web_session.db.close()
    result = sqleditor.close_session(parameters._module_session)
    # del parameters._web_session.module_sessions[parameters._module_session_id]


class TestSqleditor:

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

        sqleditor.execute(sql="SELECT SLEEP(3)", module_session=params._module_session,
                          request_id=callback_request1.request_id)
        sqleditor.get_current_schema(module_session=params._module_session,
                                     request_id=callback_schemas.request_id)

        callback_schemas.join_and_validate()
        callback_request1.join_and_validate()

    def test_close_session(self, params):
        request_id1 = str(uuid.uuid1())
        sqleditor.close_session(params._module_session)

        with pytest.raises(MSGException) as e:
            sqleditor.execute("SELECT SLEEP(1)", params._module_session, request_id1)
        assert e.value.args[0] == "Error[MSG-1200]: The database session needs to be opened before SQL can be executed."

        @backend_callback(1)
        def open_connection_cb(msg_type, msg, request_id, values):
            if values['request_state']['type'] != "OK":
                raise Exception('Failed opening connection.')

        params._web_session.register_callback(
            open_connection_cb.request_id, open_connection_cb)

        params._web_session.request_id = open_connection_cb.request_id
        sqleditor.open_connection(
            params._db_connection_id, params._module_session)

        open_connection_cb.join_and_validate()
        params._web_session.request_id = None

    def test_kill_query(self, params):
        @backend_callback_with_pending()
        def callback_sleep(msg_type, msg, request_id=None, values=None):
            assert 'request_state' in values
            assert 'type' in values['request_state']
            assert 'msg' in values['request_state']
            assert values['request_state']['type'] == "ERROR"
            assert values['request_state']['msg'] == "Query killed"

        params._web_session.register_callback(
            callback_sleep.request_id, callback_sleep)

        sqleditor.execute("SELECT SLEEP(3)",
                          params._module_session, callback_sleep.request_id)
        # since kill works in a different session (service session)
        # it might happen that we try to kill a query that is still not running.
        # so avoid that, just wait a bit. there's plenty of time to kill it.
        time.sleep(1)

        sqleditor.kill_query(params._module_session)

        callback_sleep.join_and_validate()

    def test_execute_query_with_params(self, params):
        @backend_callback_with_pending()
        def callback_execute(msg_type, msg, request_id=None, values=None):
            assert 'done' in values
            assert 'columns' in values
            assert 'rows' in values
            assert values['done'] == True

        params._web_session.register_callback(
            callback_execute.request_id, callback_execute)

        result = sqleditor.execute(
            "SHOW DATABASES LIKE ?", params._module_session, callback_execute.request_id, ['mysql'])

        callback_execute.join_and_validate()
