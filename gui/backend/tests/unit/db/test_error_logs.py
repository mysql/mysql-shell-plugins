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

import pytest

import gui_plugin.core.Error as Error
from gui_plugin.db_connections import DbConnections
from gui_plugin.core.Error import MSGException
from gui_plugin.mysql import ErrorLog


class FakeResult:
    def __init__(self, rows, on_fetch=None):
        self.rows = iter(rows)
        self.on_fetch = on_fetch

    def fetch_one(self):
        if self.on_fetch is not None:
            self.on_fetch()
        return next(self.rows, None)


class FakeTableRow:
    def __init__(self, values):
        self.values = values

    def __iter__(self):
        return iter(self.values)


class FakeServiceSession:
    database_type = "MySQL"

    def __init__(self, log_path, data_dir, host="localhost",
                 log_error_services="log_filter_internal; log_sink_internal"):
        self.connection_options = {"host": host}
        self.rows = [
            ("log_error", log_path),
            ("datadir", data_dir),
        ]
        if log_error_services is not None:
            self.rows.append(("log_error_services", log_error_services))

    def run_sql(self, sql):
        assert sql.startswith("SHOW GLOBAL VARIABLES WHERE Variable_name IN (")

        return FakeResult(self.rows)

    def lock(self):
        pass

    def release(self):
        pass


class FakeTableSession:
    def __init__(self, rows, host="localhost", log_path="", data_dir=""):
        self.connection_options = {"host": host}
        self.sysvars = [("log_error", log_path), ("datadir", data_dir)]
        self.locked = False
        self.result = FakeResult(rows, self._require_lock)
        self.query = None
        self.lock_count = 0
        self.release_count = 0

    def lock(self):
        self.locked = True
        self.lock_count += 1

    def release(self):
        self.locked = False
        self.release_count += 1

    def _require_lock(self):
        assert self.locked

    def run_sql(self, sql):
        if sql.startswith("SHOW GLOBAL VARIABLES WHERE Variable_name IN ("):
            return FakeResult(self.sysvars, self._require_lock)
        self.query = sql

        return self.result


class FakeModuleSession:
    def __init__(self, service_session):
        self._db_service_session = service_session


class FakeConnectionModuleSession:
    def __init__(self, connection_id):
        self._connection_id = connection_id

    def get_bound_connection_id(self):
        return self._connection_id


@pytest.fixture
def cached_connection():
    connection_ids = []

    def create(log_path, data_dir, host="localhost", settings=None,
               log_error_services="log_filter_internal; log_sink_internal"):
        result = DbConnections.add_db_connection(
            1,
            {
                "db_type": "MySQL",
                "caption": "Cached error log test",
                "description": "Cached error log test connection",
                "options": {"host": host},
                "settings": settings or {},
            },
        )
        connection_id = result[0]
        connection_ids.append(connection_id)
        DbConnections.refresh_server_status_cache(
            connection_id,
            FakeServiceSession(log_path, data_dir, host, log_error_services),
        )

        return FakeConnectionModuleSession(connection_id)

    yield create

    for connection_id in connection_ids:
        DbConnections.remove_db_connection(1, connection_id)


def test_export_error_log_file_copies_the_cached_local_file(tmp_path, cached_connection):
    log_file = tmp_path / "mysqld.err"
    content = b"error log bytes\x00\n"
    log_file.write_bytes(content)
    connection_id = cached_connection(str(log_file), str(tmp_path))
    target_path = tmp_path / "exported.err"

    ErrorLog.export_error_log_file(connection_id, str(target_path))

    assert target_path.read_bytes() == content


def test_export_error_log_file_rejects_remote_web_session(tmp_path, cached_connection):
    log_file = tmp_path / "mysqld.err"
    log_file.write_text("error log\n", encoding="utf-8")
    connection_id = cached_connection(str(log_file), str(tmp_path))
    target_path = tmp_path / "exported.err"

    with pytest.raises(MSGException) as exc_info:
        ErrorLog.export_error_log_file(connection_id, str(target_path), _user_id=3)

    assert exc_info.value.code == Error.CORE_FEATURE_NOT_SUPPORTED
    assert not target_path.exists()


@pytest.mark.parametrize("host", ["localhost", "db.example"])
def test_export_error_logs_writes_all_table_rows(tmp_path, host):
    target_path = tmp_path / "exported.err"
    session = FakeTableSession([
        FakeTableRow(("2026-05-09 12:00:00", 4, "ERROR", "MY-010119", "Server", "startup failed")),
        ("2026-05-09 11:59:00", 4, "Warning", "MY-010931", "InnoDB", "recovered"),
    ], host=host)

    ErrorLog.export_error_logs(str(target_path), FakeModuleSession(session))

    assert session.query == ErrorLog._ERROR_LOG_TABLE_QUERY
    assert session.lock_count == 1
    assert session.release_count == 1
    assert target_path.read_text(encoding="utf-8") == (
        "2026-05-09 12:00:00 4 [ERROR] [MY-010119] [Server] startup failed\n"
        "2026-05-09 11:59:00 4 [Warning] [MY-010931] [InnoDB] recovered\n"
    )


@pytest.mark.parametrize("relative_path", [False, True])
@pytest.mark.parametrize("hard_link", [False, True])
def test_export_error_logs_preserves_the_active_local_log(tmp_path, relative_path, hard_link):
    log_file = tmp_path / "mysqld.err"
    content = "older log history\n"
    log_file.write_text(content, encoding="utf-8")
    export_path = tmp_path / "export.err" if hard_link else log_file
    if hard_link:
        export_path.hardlink_to(log_file)
    session = FakeTableSession(
        [], log_path=log_file.name if relative_path else str(log_file), data_dir=str(tmp_path),
    )

    with pytest.raises(MSGException) as exc_info:
        ErrorLog.export_error_logs(str(export_path), FakeModuleSession(session))

    assert exc_info.value.code == Error.CORE_INVALID_PARAMETER
    assert log_file.read_text(encoding="utf-8") == content
    assert session.release_count == 1


@pytest.mark.parametrize("separator", [";", ","])
def test_export_error_log_file_accepts_supported_sink_separators(tmp_path, cached_connection, separator):
    log_file = tmp_path / "mysqld.err"
    log_file.write_text("error log\n", encoding="utf-8")
    module = cached_connection(
        str(log_file), str(tmp_path),
        log_error_services=f"log_filter_internal{separator} log_sink_internal",
    )
    target_path = tmp_path / "exported.err"

    ErrorLog.export_error_log_file(module, str(target_path))

    assert target_path.read_text(encoding="utf-8") == "error log\n"


def test_export_error_logs_rejects_remote_web_session(tmp_path):
    target_path = tmp_path / "exported.err"
    session = FakeTableSession([])

    with pytest.raises(MSGException) as exc_info:
        ErrorLog.export_error_logs(str(target_path), FakeModuleSession(session), _user_id=3)

    assert exc_info.value.code == Error.CORE_FEATURE_NOT_SUPPORTED
    assert not target_path.exists()


def test_read_error_log_file_page_parses_trusted_cached_path(tmp_path, cached_connection):
    log_file = tmp_path / "mysqld.err"
    log_file.write_text(
        "2026-05-09T12:00:00.000000Z 0 [ERROR] [MY-010119] [Server] first failure\n"
        "2026-05-09T12:01:00.000000Z 0 [System] [MY-010931] [InnoDB] started\n"
        "continuation line\n",
        encoding="utf-8",
    )

    connection_id = cached_connection(
        str(log_file),
        str(tmp_path),
        settings={
            "serverStatusCache": {
                "sysvars": [{"name": "log_error", "value": "/tmp/untrusted"}],
            },
        },
    )

    result = ErrorLog.read_error_log_file_page(connection_id, page=0, page_size=2)

    assert result["page"] == 0
    assert result["page_size"] == 2
    assert result["total_lines"] == 3
    assert result["total_pages"] == 2
    assert result["has_next"] is True
    assert result["error_code_values"] == ["MY-010119", "MY-010931"]
    assert result["subsystem_values"] == ["InnoDB", "Server"]
    assert result["rows"] == [
        {
            "line": 1,
            "logged": "2026-05-09T12:00:00.000000Z",
            "thread_id": "0",
            "prio": "ERROR",
            "error_code": "MY-010119",
            "subsystem": "Server",
            "data": "first failure",
        },
        {
            "line": 2,
            "logged": "2026-05-09T12:01:00.000000Z",
            "thread_id": "0",
            "prio": "System",
            "error_code": "MY-010931",
            "subsystem": "InnoDB",
            "data": "started",
        },
    ]

    second_page = ErrorLog.read_error_log_file_page(connection_id, page=1, page_size=2)
    assert second_page["has_next"] is False
    assert second_page["total_lines"] == 3
    assert second_page["total_pages"] == 2
    assert second_page["error_code_values"] == ["MY-010119", "MY-010931"]
    assert second_page["subsystem_values"] == ["InnoDB", "Server"]
    assert second_page["rows"][0]["line"] == 3
    assert second_page["rows"][0]["data"] == "continuation line"


def test_read_error_log_file_page_applies_filters_before_pagination(
    tmp_path, cached_connection
):
    log_file = tmp_path / "mysqld.err"
    log_file.write_text(
        "2026-05-09T12:00:00Z 0 [Error] [MY-1] [Server] first match\n"
        "2026-05-09T12:01:00Z 0 [Warning] [MY-2] [InnoDB] ignored\n"
        "2026-05-09T12:02:00Z 0 [Error] [MY-3] [Server] second match\n",
        encoding="utf-8",
    )
    connection_id = cached_connection(str(log_file), str(tmp_path))

    result = ErrorLog.read_error_log_file_page(
        connection_id,
        page=1,
        page_size=1,
        filters={"priorities": ["Error"], "message": "match"},
    )

    assert result["total_lines"] == 2
    assert result["total_pages"] == 2
    assert result["rows"] == [{
        "line": 3,
        "logged": "2026-05-09T12:02:00Z",
        "thread_id": "0",
        "prio": "Error",
        "error_code": "MY-3",
        "subsystem": "Server",
        "data": "second match",
    }]


def test_read_error_log_file_page_caches_only_the_active_filter(
    tmp_path, cached_connection, monkeypatch
):
    log_file = tmp_path / "mysqld.err"
    log_file.write_text(
        "2026-05-09T12:00:00Z 0 [Error] [MY-1] [Server] first error\n"
        "2026-05-09T12:01:00Z 0 [Warning] [MY-2] [InnoDB] warning\n",
        encoding="utf-8",
    )
    connection_id = cached_connection(str(log_file), str(tmp_path))
    matches = ErrorLog._matches_error_log_filters
    calls = 0

    def count_matches(row, filters):
        nonlocal calls
        calls += 1
        return matches(row, filters)

    monkeypatch.setattr(ErrorLog, "_matches_error_log_filters", count_matches)

    ErrorLog.read_error_log_file_page(
        connection_id, filters={"priorities": ["Error"]},
    )
    assert calls == 2

    ErrorLog.read_error_log_file_page(
        connection_id, filters={"priorities": ["Error"]},
    )
    assert calls == 2

    ErrorLog.read_error_log_file_page(
        connection_id, filters={"priorities": ["Warning"]},
    )
    assert calls == 4

    ErrorLog.read_error_log_file_page(
        connection_id, filters={"priorities": ["Error"]},
    )
    assert calls == 6


def test_filtered_error_log_file_scan_uses_the_indexed_snapshot(tmp_path, monkeypatch):
    log_file = tmp_path / "mysqld.err"
    log_file.write_text("first match\n", encoding="utf-8")
    index = ErrorLog._get_error_log_file_index(log_file)
    appended = False

    def append_during_filtered_scan(row, filters):
        nonlocal appended
        if not appended:
            with log_file.open("a", encoding="utf-8") as file:
                file.write("second match\n")
            appended = True
        return True

    monkeypatch.setattr(
        ErrorLog, "_matches_error_log_filters", append_during_filtered_scan,
    )

    line_numbers = ErrorLog._get_filtered_error_log_file_line_numbers(
        log_file, index, ErrorLog._normalize_error_log_filters(None),
    )

    assert list(line_numbers) == [1]


def test_error_log_file_index_extends_for_newline_terminated_appends(tmp_path, monkeypatch):
    log_file = tmp_path / "mysqld.err"
    log_file.write_text("first line\n", encoding="utf-8")
    first_index = ErrorLog._get_error_log_file_index(log_file)

    with log_file.open("a", encoding="utf-8") as file:
        file.write("second line\n")

    build_index = ErrorLog._build_error_log_file_index

    def verify_extension(*args, **kwargs):
        assert args[3] == first_index
        return build_index(*args, **kwargs)

    monkeypatch.setattr(ErrorLog, "_build_error_log_file_index", verify_extension)

    extended_index = ErrorLog._get_error_log_file_index(log_file)

    assert extended_index.line_count == 2
    assert extended_index.signature != first_index.signature


def test_error_log_file_index_defers_appends_until_the_next_incremental_build(
    tmp_path, monkeypatch
):
    log_file = tmp_path / "mysqld.err"
    log_file.write_text("first line\n", encoding="utf-8")
    parse_line = ErrorLog._parse_error_log_line
    appended = False

    def append_during_index_build(line_number, line):
        nonlocal appended
        if not appended:
            with log_file.open("a", encoding="utf-8") as file:
                file.write("second line\n")
            appended = True
        return parse_line(line_number, line)

    monkeypatch.setattr(ErrorLog, "_parse_error_log_line", append_during_index_build)

    first_index = ErrorLog._get_error_log_file_index(log_file)
    second_index = ErrorLog._get_error_log_file_index(log_file)

    assert first_index.line_count == 1
    assert second_index.line_count == 2
    assert [row["data"] for row in ErrorLog._read_error_log_file_rows(
        log_file, second_index, 0, second_index.line_count,
    )] == ["first line", "second line"]


def test_error_log_file_index_reads_only_the_final_window(tmp_path, monkeypatch):
    log_file = tmp_path / "mysqld.err"
    log_file.write_text("first\nsecond\nthird\n", encoding="utf-8")
    monkeypatch.setattr(ErrorLog, "_ERROR_LOG_FILE_READ_WINDOW_SIZE", 13)

    index = ErrorLog._get_error_log_file_index(log_file)
    rows = ErrorLog._read_error_log_file_rows(log_file, index, 0, index.line_count)

    assert index.start_offset == len("first\n")
    assert [row["data"] for row in rows] == ["second", "third"]


def test_error_log_file_index_keeps_its_initial_window_after_an_append(tmp_path, monkeypatch):
    log_file = tmp_path / "mysqld.err"
    log_file.write_text("first\nsecond\nthird\n", encoding="utf-8")
    monkeypatch.setattr(ErrorLog, "_ERROR_LOG_FILE_READ_WINDOW_SIZE", 13)
    first_index = ErrorLog._get_error_log_file_index(log_file)

    with log_file.open("a", encoding="utf-8") as file:
        file.write("fourth\n")

    extended_index = ErrorLog._get_error_log_file_index(log_file)

    assert extended_index.start_offset == first_index.start_offset
    assert [row["data"] for row in ErrorLog._read_error_log_file_rows(
        log_file, extended_index, 0, extended_index.line_count,
    )] == ["second", "third", "fourth"]


def test_read_error_log_file_page_filters_only_the_final_window(
    tmp_path, cached_connection, monkeypatch,
):
    log_file = tmp_path / "mysqld.err"
    log_file.write_text("first match\nsecond match\nthird match\n", encoding="utf-8")
    monkeypatch.setattr(
        ErrorLog, "_ERROR_LOG_FILE_READ_WINDOW_SIZE", len("second match\nthird match\n"),
    )
    connection_id = cached_connection(str(log_file), str(tmp_path))

    result = ErrorLog.read_error_log_file_page(
        connection_id, filters={"message": "match"},
    )

    assert result["is_truncated"] is True
    assert result["total_lines"] == 2
    assert [row["line"] for row in result["rows"]] == [1, 2]
    assert [row["data"] for row in result["rows"]] == ["second match", "third match"]


def test_read_error_log_file_page_filters_by_minimum_timestamp_in_seconds(
    tmp_path, cached_connection
):
    log_file = tmp_path / "mysqld.err"
    log_file.write_text(
        "2026-05-09T12:00:00Z 0 [Error] [MY-1] [Server] before cutoff\n"
        "2026-05-09T12:01:00Z 0 [Warning] [MY-2] [InnoDB] at cutoff\n"
        "2026-05-09T12:02:00Z 0 [Error] [MY-3] [Server] after cutoff\n",
        encoding="utf-8",
    )
    connection_id = cached_connection(str(log_file), str(tmp_path))

    result = ErrorLog.read_error_log_file_page(
        connection_id,
        filters={"minTimestamp": 1778328060},
    )

    assert result["total_lines"] == 2
    assert [row["line"] for row in result["rows"]] == [2, 3]


def test_read_error_log_file_page_requires_internal_log_sink(tmp_path, cached_connection):
    log_file = tmp_path / "mysqld.err"
    log_file.write_text("error log\n", encoding="utf-8")
    connection_id = cached_connection(
        str(log_file),
        str(tmp_path),
        log_error_services="log_filter_internal; log_sink_perfschema",
    )

    with pytest.raises(MSGException) as exc_info:
        ErrorLog.read_error_log_file_page(connection_id)

    assert exc_info.value.code == Error.CORE_FEATURE_NOT_SUPPORTED


def test_read_error_log_file_page_supports_legacy_file_sink(
    tmp_path, cached_connection,
):
    log_file = tmp_path / "mysqld.err"
    log_file.write_text("legacy error log\n", encoding="utf-8")
    connection_id = cached_connection(
        str(log_file), str(tmp_path), log_error_services=None,
    )

    result = ErrorLog.read_error_log_file_page(connection_id)

    assert [row["data"] for row in result["rows"]] == ["legacy error log"]


def test_read_error_log_file_page_ignores_standard_error_output(tmp_path, cached_connection):
    stderr_file = tmp_path / "stderr"
    stderr_file.write_text("not an error log file\n", encoding="utf-8")
    connection_id = cached_connection(
        "stderr", str(tmp_path),
    )

    assert ErrorLog.read_error_log_file_page(connection_id) is None


def test_read_error_log_file_page_resolves_cached_relative_path(tmp_path, cached_connection):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    log_file = data_dir / "mysqld.err"
    log_file.write_text(
        '{"time":"2026-05-09T12:00:00.000000Z","thread":"7","prio":"ERROR",'
        '"err_code":"MY-010119","subsystem":"Server","msg":"json failure"}\n',
        encoding="utf-8",
    )

    connection_id = cached_connection("mysqld.err", str(data_dir))

    result = ErrorLog.read_error_log_file_page(connection_id, page=0, page_size=100)

    assert result["path"] == str(log_file)
    assert result["total_lines"] == 1
    assert result["total_pages"] == 1
    assert result["rows"] == [
        {
            "line": 1,
            "logged": "2026-05-09T12:00:00.000000Z",
            "thread_id": "7",
            "prio": "ERROR",
            "error_code": "MY-010119",
            "subsystem": "Server",
            "data": "json failure",
        },
    ]


def test_read_error_log_file_page_requires_local_cached_connection(tmp_path, cached_connection):
    connection_id = cached_connection(
        str(tmp_path / "mysqld.err"),
        str(tmp_path),
        host="db.example.com",
    )

    with pytest.raises(MSGException) as exc_info:
        ErrorLog.read_error_log_file_page(connection_id)

    assert exc_info.value.code == Error.CORE_FEATURE_NOT_SUPPORTED
    assert exc_info.value.msg == "Reading server log files is only supported for local sessions."


def test_read_error_log_file_page_rejects_remote_web_session(tmp_path, cached_connection):
    connection_id = cached_connection(str(tmp_path / "mysqld.err"), str(tmp_path))

    with pytest.raises(MSGException) as exc_info:
        ErrorLog.read_error_log_file_page(connection_id, _user_id=3)

    assert exc_info.value.code == Error.CORE_FEATURE_NOT_SUPPORTED
