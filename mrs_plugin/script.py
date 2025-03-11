# Copyright (c) 2023, 2025, Oracle and/or its affiliates.
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

from mysqlsh.plugin_manager import plugin_function, sql_handler
import mrs_plugin.lib as lib
import mysqlsh


@plugin_function("mrs.run.script", shell=True, cli=True, web=True)
def run_mrs_script(mrs_script=None, **kwargs):
    """Run the given MRS script

    Args:
        mrs_script (str): The script to execute
        **kwargs: Additional options

    Keyword Args:
        path (str): The path of the script to run
        current_service_id (str): The id of the current service
        current_service (str): The url_context_root of the current service
        current_service_host (str): The url_context_root of the current service URL
        current_schema_id (str): The id of the current schema
        current_schema (str): The full path of the current schema
        session (object): The database session to use.

    Returns:
        A list of results as defined in /gui/tools/src/protocol/results_mrs.txt
    """

    interactive = lib.core.get_interactive_default()

    try:
        results = lib.script.run_mrs_script(mrs_script=mrs_script, **kwargs)

        if interactive is True:
            for res in results:
                if res.get("type") == "success":
                    result = res.get("result")
                    if result and len(result) > 0:
                        print(lib.core.format_result(result))
                    if (
                        res.get("affectedItemsCount") is None
                        and res.get("message") is not None
                    ):
                        print(res.get("message"))
                    elif res.get("affectedItemsCount") is not None:
                        print(
                            f'{res.get("affectedItemsCount")} row{"s" if res.get("affectedItemsCount") > 1 else ""} affected.'
                        )
                else:
                    print(f'ERROR: {res.get("message")}')

            if len(results) == 0:
                print("No statements executed.")
        else:
            return results

    except Exception as e:
        if interactive is True:
            print(f"{e}")
            # For debugging, re-raise the exception
            raise
        else:
            raise


MRS_PREFIXES = [
    "CONFIGURE REST ",
    "CREATE REST ",
    "CREATE OR REPLACE REST ",
    "ALTER REST ",
    "DROP REST ",
    "USE REST ",
    "SHOW REST ",
    "SHOW CREATE REST ",
    "GRANT REST ",
    "REVOKE REST ",
    "CLONE REST ",
]


def get_shell_result(mrs_result):
    shell_result = {}

    def set_data(item, target_item=None):
        if target_item is None:
            target_item = item

        if item in mrs_result:
            shell_result[target_item] = mrs_result[item]

    if mrs_result["type"] == "success":
        set_data("message", "info")
        set_data("result", "data")
        set_data("affectedItemsCount")
        set_data("executionTime")
        set_data("autoIncrementValue")
        set_data("warnings")
        set_data("columns")
    else:
        set_data("message", "error")
        set_data("code")
        set_data("sqlstate")

    return shell_result


@sql_handler("MRS", prefixes=MRS_PREFIXES)
def mrs_sql_handler(session, sql):
    "MySQL REST Service SQL Extension"
    try:
        if not session.connection_id in mrs_sql_handler.state:
            mrs_sql_handler.state[session.connection_id] = {}

        state_data = mrs_sql_handler.state[session.connection_id]
        # TODO(alfredo) sql_mode should come from the shell session object or the caller
        sql_mode = session.run_sql("select @@session.sql_mode").fetch_one()[0]

        results = lib.script.run_mrs_script(
            sql, **{"session": session, "sql_mode": sql_mode, "state_data": state_data}
        )

        shell_results = [get_shell_result(result) for result in results]

        return mysqlsh.globals.shell.create_result(shell_results)
    except Exception as e:
        # Suppress traceback information to have the shell only print the relevant exception
        if mysqlsh.globals.shell.options.logLevel <= 5:
            e.with_traceback(None)
        raise


# The sql handler will hold state data across calls
mrs_sql_handler.state = {}
