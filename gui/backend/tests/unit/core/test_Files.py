# Copyright (c) 2026, Oracle and/or its affiliates.
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

from contextlib import contextmanager

import gui_plugin.core.Files as Files


@contextmanager
def fake_connection():
    yield


def test_probe_local_connection_endpoint_tcp_available(monkeypatch):
    calls = []

    def create_connection(address, timeout):
        calls.append((address, timeout))
        return fake_connection()

    monkeypatch.setattr(Files.socket, "create_connection", create_connection)

    result = Files.probe_local_connection_endpoint("tcp", "localhost", 3306)

    assert result == {
        "kind": "tcp",
        "status": "available",
        "target": "localhost:3306",
    }
    assert calls == [(("localhost", 3306), 0.5)]


def test_probe_local_connection_endpoint_tcp_unavailable(monkeypatch):
    def create_connection(_address, timeout):
        assert timeout == 0.5
        raise ConnectionRefusedError("refused")

    monkeypatch.setattr(Files.socket, "create_connection", create_connection)

    result = Files.probe_local_connection_endpoint("tcp", "localhost", 3306)

    assert result["kind"] == "tcp"
    assert result["status"] == "unavailable"
    assert result["target"] == "localhost:3306"
    assert "refused" in result["message"]


def test_probe_local_connection_endpoint_tcp_exception_is_unknown(monkeypatch):
    def create_connection(_address, timeout):
        assert timeout == 0.5
        raise RuntimeError("unexpected")

    monkeypatch.setattr(Files.socket, "create_connection", create_connection)

    result = Files.probe_local_connection_endpoint("tcp", "localhost", 3306)

    assert result["kind"] == "tcp"
    assert result["status"] == "unknown"
    assert result["target"] == "localhost:3306"
    assert result["message"] == "unexpected"


def test_probe_local_connection_endpoint_socket_available(tmp_path):
    socket_path = tmp_path / "mysql.sock"
    socket_path.write_text("")

    result = Files.probe_local_connection_endpoint("socket", str(socket_path))

    assert result == {
        "kind": "socket",
        "status": "available",
        "target": str(socket_path),
    }


def test_probe_local_connection_endpoint_socket_unavailable(tmp_path):
    socket_path = tmp_path / "mysql.sock"

    result = Files.probe_local_connection_endpoint("socket", str(socket_path))

    assert result == {
        "kind": "socket",
        "status": "unavailable",
        "target": str(socket_path),
    }


def test_probe_local_connection_endpoint_unsupported_kind():
    result = Files.probe_local_connection_endpoint("other", "localhost")

    assert result["kind"] == "other"
    assert result["status"] == "unknown"
    assert result["target"] == "localhost"
