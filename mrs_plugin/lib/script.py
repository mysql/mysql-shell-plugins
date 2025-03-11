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

import mrs_plugin.lib as lib
import os.path
import antlr4
from antlr4.error.Errors import ParseCancellationException
from antlr4.error.ErrorStrategy import DefaultErrorStrategy
from mrs_plugin.lib.mrs_parser import MRSLexer
from mrs_plugin.lib.mrs_parser import MRSParser
from mrs_plugin.lib.MrsDdlListener import MrsDdlListener, MrsDdlErrorListener
from mrs_plugin.lib.MrsDdlExecutor import MrsDdlExecutor


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
        sql_mode (str): SQL_MODE variable for the session.

    Returns:
        The schema_id of the created schema when not in interactive mode
    """
    path = kwargs.get("path")
    session = kwargs.get("session")
    current_service_id = kwargs.get("current_service_id")
    current_service = kwargs.get("current_service")
    current_service_host = kwargs.get("current_service_host")
    current_schema_id = kwargs.get("current_schema_id")
    current_schema = kwargs.get("current_schema")
    state_data = kwargs.get("state_data", {})
    sql_mode = kwargs.get("sql_mode") or ""

    if mrs_script is None and path is None:
        raise Exception("No script give.")

    sql_mode = sql_mode.upper().split(",")

    # If a path to a file was specified, read that
    if mrs_script is None and path is not None:
        path = os.path.expanduser(path)
        try:
            with open(path) as f:
                mrs_script = f.read()
        except Exception as e:
            raise Exception(f"Error while loading file '{path}'. Error: {e}")

    lexer = MRSLexer(antlr4.InputStream(mrs_script))
    lexer.isSqlModeActive = lambda mode: mode.upper() in sql_mode
    tokens = antlr4.CommonTokenStream(lexer)

    parser = MRSParser(tokens)
    parser.isSqlModeActive = lambda mode: mode.upper() in sql_mode
    parser.removeErrorListeners()
    # First try with the faster SLL parsing strategy
    parser._interp.predictionMode = antlr4.PredictionMode.SLL
    parser._errHandler = antlr4.BailErrorStrategy()

    syntax_errors = []

    try:
        tree = parser.mrsScript()
    except ParseCancellationException as e:
        # If the SLL strategy was not strong enough
        # perform a Stage 2 parse with the default LL prediction mode
        # cspell:ignore interp
        tokens.reset()
        parser.reset()
        parser.addErrorListener(MrsDdlErrorListener(syntax_errors))
        parser._errHandler = DefaultErrorStrategy()
        parser._interp.predictionMode = antlr4.PredictionMode.LL
        tree = parser.mrsScript()

    if len(syntax_errors) > 0:
        errors = []
        for e in syntax_errors:
            errors.append(e.get("fullMessage"))

        if len(errors) > 0:
            raise Exception("\n".join(errors))

    else:
        with lib.core.MrsDbSession(**kwargs) as session:
            executor = MrsDdlExecutor(
                session=session,
                current_service_id=current_service_id,
                current_service=current_service,
                current_service_host=current_service_host,
                current_schema_id=current_schema_id,
                current_schema=current_schema,
                state_data=state_data,
            )
            listener = MrsDdlListener(mrs_ddl_executor=executor, session=session)
            walker = antlr4.ParseTreeWalker()
            try:
                walker.walk(listener, tree)
            except Exception as e:
                # The error will be in executor.results
                executor.results.append(
                    {
                        "statementIndex": len(executor.results) + 1,
                        "type": "error",
                        "message": f"{e}",
                        "operation": executor.current_operation,
                    }
                )
                # For debugging, re-raise the exception
                raise
            return executor.results

    return []
