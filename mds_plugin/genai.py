# Copyright (c) 2021, 2026, Oracle and/or its affiliates.
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

"""Sub-Module to work with GenAI features"""

from mysqlsh.plugin_manager import plugin_function
from mysqlsh.plugin_manager.general import get_shell_user_dir
from mds_plugin import languages
import os
import json

# cSpell:ignore mockchat

@plugin_function("mds.genai.lakehouseStatus", shell=True, cli=True, web=True)
def lakehouse_status(**kwargs):
    """Gets lakehouse status information

    Args:
        **kwargs: Additional options

    Keyword Args:
        memory_used (int): The amount of used lakehouse memory
        memory_total (int): The amount of total lakehouse memory
        schema_name (str): The database schema name used to lookup the lakehouse tables
        lakehouse_tables_hash (str): The hash calculated for lakehouse tables of the given schema
        lakehouse_tasks_hash (str): The hash calculated for lakehouse tasks
        session (object): The database session to use.

    Returns:
        A dict with the status information
    """
    from mysqlsh import globals

    session = kwargs.get("session")

    if not session:
        session = globals.session
        if not session:
            raise Exception("No database session specified.")

    memory_used = kwargs.get("memory_used", 0)
    memory_total = kwargs.get("memory_total", 0)
    schema_name = kwargs.get("schema_name")
    lakehouse_tables_hash = kwargs.get("lakehouse_tables_hash", -1)
    lakehouse_tasks_hash = kwargs.get("lakehouse_tasks_hash", -1)

    status = {}
    # cSpell:ignore RNSTATE BASEREL IFNULL
    res = session.run_sql("""
        SELECT SUM(MEMORY_USAGE), SUM(MEMORY_TOTAL), SUM(BASEREL_MEMORY_USAGE)
        FROM performance_schema.rpd_nodes
        WHERE STATUS = 'AVAIL_RNSTATE'""")
    rows = res.fetch_all()
    if len(rows[0]) > 0:
        try:
            new_memory_used = int(rows[0][0])
            new_memory_total = int(rows[0][1])
            if not (memory_used == new_memory_used) or not (
                memory_total == new_memory_total
            ):
                status["memory_status"] = {
                    "memory_used": new_memory_used,
                    "memory_total": new_memory_total,
                }
        except:
            pass

    if schema_name is not None:
        res = session.run_sql(
            """
            SELECT JSON_OBJECT(
                'id', CONCAT(TABLE_SCHEMA, '.', TABLE_NAME),
                'table_name', TABLE_NAME,
                'schema_name', TABLE_SCHEMA,
                'loaded', LOADED,
                'progress', IFNULL(LOAD_PROGRESS, 0),
                'comment', TABLE_COMMENT,
                'rows', TABLE_ROWS,
                'data_length', DATA_LENGTH,
                'last_change', DATE_FORMAT(IFNULL(UPDATE_TIME, CREATE_TIME), '%Y-%m-%d %H:%i')
                ) as table_status,
                MD5(CONCAT_WS('|', TABLE_SCHEMA, TABLE_NAME, LOADED, LOAD_PROGRESS, TABLE_ROWS,
                    DATA_LENGTH, IFNULL(UPDATE_TIME, CREATE_TIME))) AS hash
            FROM sys.vector_store_load_tables
            WHERE TABLE_SCHEMA = ?
            ORDER BY CREATE_TIME DESC, TABLE_NAME""",
            [schema_name],
        )
        rows = res.fetch_all()
        tables = []
        table_hash = 0
        for row in rows:
            tables.append(json.loads(row[0]))
            table_hash = hash(row[1] + str(table_hash))

        if not (lakehouse_tables_hash == str(table_hash)):
            status["table_status"] = {"hash": str(table_hash), "tables": tables}
    else:
        status["table_status"] = {"hash": "emptyList", "tables": []}

    # res = session.run_sql("""
    #     SELECT
    #         JSON_OBJECT(
    #             'id', id,
    #             'title', name,
    #             'log_time', DATE_FORMAT(log_time, '%Y-%m-%d %H:%i:%s'),
    #             'status', status,
    #             'status_message', message,
    #             'progress', IFNULL(progress, 0),
    #             'data', data,
    #             'scheduled_time', DATE_FORMAT(scheduled_time, '%Y-%m-%d %H:%i:%s'),
    #             'starting_time', DATE_FORMAT(starting_time, '%Y-%m-%d %H:%i:%s'),
    #             'estimated_completion_time', DATE_FORMAT(estimated_completion_time, '%Y-%m-%d %H:%i:%s'),
    #             'estimated_remaining_time', estimated_remaining_time
    #         ) AS task_status,
    #         MD5(CONCAT_WS(',',
    #             log_time, status, message, progress, data, scheduled_time, starting_time,
    #             estimated_completion_time, estimated_remaining_time)) AS col_hash
    #     FROM `mysql_tasks`.`task_status`
    #     WHERE task_type='GenAI_Load'
    #     ORDER BY id DESC
    #     LIMIT 20""")
    res = session.run_sql(
        "SELECT `mysql_tasks`.`task_status_list`('GenAI_Load', 0, 20);"
    )
    rows = res.fetch_all()
    tasks = []
    task_hash = 0
    if rows is not None and len(rows) > 0 and rows[0][0] is not None:
        tasks = json.loads(rows[0][0])

    for task in tasks:
        task_hash = hash(task.get("row_hash", 0) + str(task_hash))

    if not (lakehouse_tasks_hash == str(task_hash)):
        status["task_status"] = {"hash": str(task_hash), "tasks": tasks}

    return status
