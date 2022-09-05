# Copyright (c) 2022, Oracle and/or its affiliates.
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
from tests.lib.utils import *
import signal


port, nossl = config.Config.get_instance().get_server_params()
server_params = [(port, nossl)]


@pytest.fixture(scope="package", params=server_params)
def shell_start_server(request):
    p = start_server(request)

    yield p

    logger.info("sending sigint to the shell subprocess")
    os.kill(p.pid,
            signal.CTRL_BREAK_EVENT if hasattr(signal, 'CTRL_BREAK_EVENT') else signal.SIGINT)

    logger.info(f"Waiting for server to shutdown")
    p.wait()
    logger.info(f"Done waiting for server shutdown")
