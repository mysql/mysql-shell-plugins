# Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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
import os
import json


def check_dependencies():
    try:
        from . import mockchat

        return True
    except:
        return False


@plugin_function("mds.genai.status", shell=True, cli=True, web=True)
def get_status(session=None):
    """Returns status information about the current GenAI setup

    Args:
        session (object): The database session to use.

    Returns:
        A dict holding the status information
    """

    heatwave_support = False
    local_model_support = False

    rows = session.run_sql("""
        SELECT EXISTS (
            SELECT * FROM information_schema.ROUTINES
            WHERE ROUTINE_SCHEMA = 'sys' AND ROUTINE_NAME = 'heatwave_chat') AS heatwave_chat_available
        """).fetch_all()
    if len(rows) > 0 and rows[0][0] == 1:
        heatwave_support = True
    else:
        local_model_support = check_dependencies()

    return {
        "heatwave_support": heatwave_support,
        "local_model_support": local_model_support,
    }


def pip_install(package):
    import subprocess
    import sys

    r = subprocess.run(
        [sys.executable, "-m", "pip", "install", package],
        text=True,
        stderr=subprocess.PIPE,
        capture_output=False,
    )
    if r.returncode == 0:
        return None
    return r.stderr


@plugin_function("mds.genai.configure", shell=True, cli=True, web=True)
def configure_local_model_support(cohere_api_key: str = "", **kwargs):
    """Configures a local model setup

    Args:
        cohere_api_key (string): Optional cohere API key to use. Taken from the CO_API_KEY environment variable if not given.
        **kwargs: Additional options

    Keyword Args:
        options (dict): The options that store information about the request.
        session (object): The database session to use.
        send_gui_message (object): The function to send a message to he GUI.

    Returns:
        A dict holding the status information
    """

    send_gui_message = kwargs.get("send_gui_message")

    if send_gui_message is not None:
        send_gui_message("info", "Checking dependencies ...")

    while True:
        if check_dependencies():
            if not cohere_api_key:
                api_key_path = os.path.join(
                    get_shell_user_dir(), "plugin_data", "mds_plugin", "cohere_api_key.txt")
                if os.path.exists(api_key_path):
                    cohere_api_key = open(api_key_path).read().strip()

            from . import mockchat

            mockchat.set_api_key(cohere_api_key)

            return {
                "success": True,
                "error": "",
            }
        else:
            for m in ["cohere", "numpy", "sentence-transformers", "transformers"]:
                if send_gui_message is not None:
                    send_gui_message("info", f"Installing {m}...")
                else:
                    print(f"Installing {m}...")
                error = pip_install(m)
                if error:
                    if send_gui_message is not None:
                        send_gui_message(
                            "error", f"Error while installing dependencies. {error}")
                    return {"success": False, "error": error}


def translate_string(session, text, language, model_id=None):
    if model_id is None:
        model_id = "mistral-7b-instruct-v1"
    # Load the mistral language model
    session.run_sql('CALL sys.ml_model_load(?, NULL);', [model_id])

    res = session.run_sql("""
        SELECT sys.ml_generate(CONCAT('translate the following text to ', ?, ': ', ?), JSON_OBJECT("model_id", ?));
    """, [language, text, model_id])
    rows = res.fetch_all()
    if len(rows) > 0:
        translation = json.loads(rows[0][0]).get("text")
        if '"' in translation:
            return translation.split('"')[1].strip()
        elif 'The answer' in translation and ':' in translation:
            return translation.split(':', 1)[1].strip()
        elif 'The translation of' in translation and ':' in translation:
            return translation.split(':', 1)[1].strip()
        else:
            return translation.strip()

    return text


@plugin_function("mds.genai.chat", shell=True, cli=True, web=True)
def chat(prompt, **kwargs):
    """Processes a chat request and return a generated answer

    If no options are passed, they are generated from the prompt

    Args:
        prompt (str): The question of the user
        **kwargs: Additional options

    Keyword Args:
        options (dict): The options that store information about the request.
        session (object): The database session to use.
        send_gui_message (object): The function to send a message to he GUI.

    Returns:
        A dict with the generated answer and the options used
    """
    from mysqlsh import globals

    session = kwargs.get("session")
    options = kwargs.get("options", None)
    send_gui_message = kwargs.get("send_gui_message")

    # Clean up options
    options.pop("documents", None)
    options.pop("request_completed", None)

    # Clear table list if lock_table_list is not set to true
    if options.get("lock_table_list", False) == False:
        options.pop("tables", None)

    if not session:
        session = globals.session
        if not session:
            raise Exception("No database session specified.")

    if send_gui_message is not None:
        send_gui_message("data", {"info": "Checking chat engine status ..."})

    status = get_status(session=session)
    if status.get("heatwave_support") is False and status.get("local_model_support") is False:
        raise Exception("GenAI support is not available.")

    if status.get("heatwave_support") is True:
        lang_opts = options.pop("language_options", {})
        language = lang_opts.get("language")

        # If a language has been selected for translation, do the translation
        if language is not None and lang_opts.get("translate_user_prompt") is not False:
            send_gui_message(
                "data", {"info": f"Translating prompt to English ..."})

            # Translate the prompt
            prompt = translate_string(
                session, prompt, 'English', lang_opts.get("model_id"))

        send_gui_message("data", {"info": "Generating answer ..."})

        session.run_sql("SET @chat_options = ?", [json.dumps(options)])

        res = session.run_sql("CALL sys.heatwave_chat(?)", [prompt])

        send_gui_message("data", {"info": "Processing results ..."})
        next_result = True
        while next_result:
            rows = res.fetch_all()

            if len(rows) == 0:
                next_result = res.next_result()
                continue

            cols = res.get_column_names()

            # Either the first result set column is named "chat_options"
            if len(cols) > 0 and cols[0] == "chat_options" and len(rows[0]) > 0:
                options = json.loads(rows[0][0])
                send_gui_message("data", options)
            # Note: For now the last response is ignored since we fetch the @chat_options session var instead
            # or "response" for the final response that contains all tokens at once
            # elif len(cols) > 0 and cols[0] == "response" and len(rows[0]) > 0:
            #     options = { "token": json.loads(rows[0][0]) }
            #     send_gui_message("data", options)

            next_result = res.next_result()

        res = session.run_sql("SELECT @chat_options")
        rows = res.fetch_all()
        if len(rows) > 0:
            options = json.loads(rows[0][0])

            if language is not None and lang_opts.get("translate_response") is not False:
                send_gui_message(
                    "data", {"info": f"Translating response to {language} ..."})

                # Translate the response
                response = translate_string(session, options.get(
                    "response"), language, lang_opts.get("model_id"))
                options["response"] = response

            send_gui_message("data", options)

    else:
        from . import mockchat

        api_key_path = os.path.join(
            get_shell_user_dir(), "plugin_data", "mds_plugin", "cohere_api_key.txt")
        if os.path.exists(api_key_path):
            cohere_api_key = open(api_key_path).read().strip()
            mockchat.set_api_key(cohere_api_key)

        return mockchat.chat(prompt, options, session, send_gui_message)


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
            if not (memory_used == new_memory_used) or not (memory_total == new_memory_total):
                status["memory_status"] = {
                    "memory_used": new_memory_used,
                    "memory_total": new_memory_total
                }
        except:
            pass

    if schema_name is not None:
        res = session.run_sql("""
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
                              [schema_name])
        rows = res.fetch_all()
        tables = []
        table_hash = 0
        for row in rows:
            tables.append(json.loads(row[0]))
            table_hash = hash(row[1] + str(table_hash))

        if not (lakehouse_tables_hash == str(table_hash)):
            status["table_status"] = {
                "hash": str(table_hash),
                "tables": tables
            }
    else:
        status["table_status"] = {
            "hash": "emptyList",
            "tables": []
        }

    res = session.run_sql("""
        SELECT
            JSON_OBJECT(
                'id', id,
                'title', name,
                'log_time', DATE_FORMAT(log_time, '%Y-%m-%d %H:%i:%s'),
                'status', status,
                'status_message', message,
                'progress', IFNULL(progress, 0),
                'data', data,
                'scheduled_time', DATE_FORMAT(scheduled_time, '%Y-%m-%d %H:%i:%s'),
                'starting_time', DATE_FORMAT(starting_time, '%Y-%m-%d %H:%i:%s'),
                'estimated_completion_time', DATE_FORMAT(estimated_completion_time, '%Y-%m-%d %H:%i:%s'),
                'estimated_remaining_time', estimated_remaining_time
            ) AS task_status,
            MD5(CONCAT_WS(',',
                log_time, status, message, progress, data, scheduled_time, starting_time,
                estimated_completion_time, estimated_remaining_time)) AS col_hash
        FROM `mysql_task_management`.`task_status`
        WHERE task_type='GenAI_Load'
        ORDER BY id DESC
        LIMIT 20""")
    rows = res.fetch_all()
    tasks = []
    task_hash = 0
    for row in rows:
        tasks.append(json.loads(row[0]))
        task_hash = hash(row[1] + str(task_hash))

    if not (lakehouse_tasks_hash == str(task_hash)):
        status["task_status"] = {
            "hash": str(task_hash),
            "tasks": tasks
        }

    return status


@plugin_function("mds.genai.saveChatOptions", shell=True, cli=True, web=True)
def save_chat_options(file_path, **kwargs):
    """Saves chat options to a file

    Args:
        file_path (str): The file to save the options to
        **kwargs: Additional options

    Keyword Args:
        options (dict): The options that store information about the request.

    Returns:
        None
    """

    options = kwargs.get("options")

    with open(file_path, 'w') as file:
        file.write(json.dumps(options, indent=4))


@plugin_function("mds.genai.loadChatOptions", shell=True, cli=True, web=True)
def load_chat_options(file_path):
    """Loads the chat options from a file

    Args:
        file_path (str): The path to load the options from

    Returns:
        A dict representing the options
    """

    if not os.path.isfile(file_path):
        raise Exception(f"The file {file_path} does not exist.")

    with open(file_path, 'r') as file:
        options = file.read()
        return json.loads(options)
