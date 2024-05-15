# Copyright (c) 2024, Oracle and/or its affiliates.
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

import numpy as np
import pickle
import json
from typing import Callable, Tuple

from sentence_transformers import SentenceTransformer
from transformers import pipeline

import cohere

import threading
import mysqlsh

DATA_TYPE_INFO = "info"
DATA_TYPE_TOKEN = "token"
DATA_TYPE_OPTIONS = "options"


def interactive_mode_set():
    """Checks the current status of interactive mode

    Returns:
        True if the MySQL Shell is running in interactive mode
    """
    if mysqlsh.globals.shell.options.useWizards:
        ct = threading.current_thread()
        if ct.__class__.__name__ == '_MainThread':
            return True
    return False


g_cohere_api_key = None
g_chat = None
g_embedding_model = None

# template types:
#  - find documents
#       - with filter
#       - with join
#  - apply task to each
#       - summarize
#       - q&a
#
#  - find documents
#
#

# Practical questions:
#   - max size of context?
#   - limit size of context for queries?
#       - huge context (even if accidental) -> huge $$$
#
#


class DBInterface:
    def __init__(self, session) -> None:
        self.session = session


class Template:
    source_tables = []
    maximum_distance: float
    default_limit: int
    context_table = "mysqlsh.context"
    template_params = []

    def __init__(self) -> None:
        pass

    def _query_topk(self, session, k, max_dist):
        raise NotImplemented()

    def make_create_context_table(self) -> Tuple[str, list]:
        raise NotImplemented()

    def get_search_queries(self, query: str, options: dict) -> list:
        raise NotImplemented()

    def make_select(self, text: str, params: dict) -> Tuple[str, list, str]:
        raise NotImplemented()

    def make_inserter(self, query_emb) -> Callable:
        raise NotImplemented()

    def make_generator(self, text: str, options: dict) -> Callable:
        raise NotImplemented()

    def format_result(self, result) -> str:
        return result


class GenericDocumentTableTemplate(Template):
    def __init__(self) -> None:
        super().__init__()
        self.query = ""
        self.template_params = [""]
        self.table_columns = [
            "document_name",
            "segment",
            "metadata",
            "segment_embedding",
        ]
        self._model = g_embedding_model

    def make_create_context_table(self):
        return f"create temporary table {self.context_table} (id varchar(256), dist double, metadata json, segment longtext)"

    def _query_topk(self, session, k, max_dist):
        return session.run_sql(
            f"select id, dist, segment from {self.context_table} order by dist asc limit ?",
            [k],
        )

    def make_select(self, text: str, params: dict) -> Tuple[str, list, str]:
        columns = ", ".join(self.table_columns)
        query = " UNION ".join(
            [f"""SELECT {columns} FROM `{table.schema_name}`.`{table.table_name}`""" for table in self.source_tables]
        )
        return (
            query,
            [],
            # NOTE: in the real version, query_emb should be kept as a uservar and doesn't need to be fetched and passed around
            self._model.encode(text),
        )

    def make_inserter(self, query_emb):
        def insert_one(session, row):
            row_embedding = pickle.loads(row[-1])

            distance = np.linalg.norm(query_emb - row_embedding)
            session.run_sql(
                f"""INSERT INTO {self.context_table} (id, dist, segment) VALUES (?, ?, ?)""",
                [row[0], float(distance), row[1]],
            )

        return insert_one


class CohereTemplate(GenericDocumentTableTemplate):
    def __init__(self, api_key):
        super().__init__()

        self.co = cohere.Client(api_key)

    def get_search_queries(self, query: str, options: dict):
        return self.co.chat(
            message=query,
            model="command",
            preamble_override=options.get("preamble") if options is not None else "",
            search_queries_only=True,
        ).search_queries

    def make_generator(self, query: str):
        def generate(session, hint: str, context: list, options: dict):
            return self.co.chat(
                message=query, model="command", documents=context,
                preamble_override=options.get("preamble") if options is not None else "",
                stream=True
            )

        return generate

    def format_result(self, result) -> str:
        return result.text


class ContextManager:
    def __init__(self, session, template: Template):
        self.session = session
        self.template = template

    def __build_context_table(self, query: str, args: list, query_emb):
        self.session.run_sql(self.template.make_create_context_table())

        res = self.session.run_sql(query, args).fetch_all()
        inserter = self.template.make_inserter(query_emb)
        for row in res:
            inserter(self.session, row)

    def search(self, text: str, params: dict = {}):
        self.reset()
        query, args, query_emb = self.template.make_select(text, params)

        self.__build_context_table(query, args, query_emb)

        return self.template._query_topk(
            self.session, self.template.default_limit, self.template.maximum_distance
        )

    def refine(self, text: str):
        pass

    def reset(self):
        self.session.run_sql(
            f"drop table if exists {self.template.context_table}")
        self.session.run_sql(
            f'create schema if not exists {self.template.context_table.split(".")[0]}',
        )


class TaskManager:
    def __init__(self, session, template) -> None:
        self.session = session
        self.template = template
        self._query_embedding = None

    def generate(self, query: str, hint: str, context: list, options: dict):
        gen = self.template.make_generator(query)
        return gen(self.session, hint, context, options)

    def format(self, result):
        return self.template.format_result(result)


class Chat:
    debug = 0
    report_status = 0
    streaming = 0
    re_run = 0

    def __init__(self, session, templ: Template, send_gui_message) -> None:
        # assert session.uri.startswith(
        #     "mysql://"
        # ), "Connection must use classic protocol"
        self.templ = templ
        self.session = session
        self.send_gui_message = send_gui_message
        self.context = ContextManager(session, templ)
        self.task = TaskManager(session, templ)

    def dump(self, query: str):
        return self.context.search(query)

    def send_data(self, data, type, end="\n"):
        if interactive_mode_set() or self.send_gui_message is None:
            print(data, end=end)
        else:
            if type == DATA_TYPE_INFO:
                data_to_send = {"info": data}
            elif type == DATA_TYPE_TOKEN:
                data_to_send = {"token": data}
            else:
                data_to_send = data
            self.send_gui_message("data", data_to_send)

    def run(self, query: str, options: dict):
        self._apply_options(options)
        if self.debug:
            print("Query: ", query, f"({self.templ.__class__.__name__})")
        r = self.run_(query, options)
        if self.debug:
            print("Result:", r)
            print()
        return r

    def run_(self, query: str, options: dict):
        if self.debug or self.report_status:
            self.send_data("Decomposing prompt ...", DATA_TYPE_INFO)
        search_queries = self.templ.get_search_queries(query, options)
        if self.debug:
            print("\tqueries=", search_queries)
        if not search_queries:
            queries = [query]
        else:
            queries = [q["text"] for q in search_queries]
        context = []
        for q in queries:
            if self.debug:
                print("* searching matches for:", q)
            context += self.context.search(q).fetch_all()
        docs = [{"id": row[0], "snippet": row[2]} for row in context]
        if self.debug:
            print("* context:")
            for row in context:
                print("\t", row[0], row[1], row[2]
                      [:80].replace("\n", "\n\t") + "...")
        options["documents"] = [
            {"id": row[0], "title": row[0], "snippet": row[2][:80], "pinned": False} for row in context]
        # Send the documents as soon as available, when streaming is enabled
        if self.streaming:
            if self.debug or self.report_status:
                self.send_data({"documents": options["documents"], "info": "Generating answer ..."}, DATA_TYPE_OPTIONS)
            else:
                self.send_data({"documents": options["documents"]}, DATA_TYPE_OPTIONS)

        result = ""
        if not self.skip_generate:
            response = self.task.generate(query, "", docs, options)
            for event in response:
                if event.event_type == "text-generation":
                    result += event.text
                    self.send_data(event.text, DATA_TYPE_TOKEN, end="")

            if self.streaming:
                response.text = ""
        else:
            response = None

        options["request_completed"] = True

        return { "data": self._make_response(response, options) }

    def _apply_options(self, options: dict):
        self.templ.default_limit = options.get(
            "maximum_document_segment_count", 3)
        self.templ.maximum_distance = options.get("maximum_distance", 0.3)
        options["tables"] = options.get("tables", None) or self._scan_tables()
        self.templ.source_tables = options["tables"]
        # Send the tables as soon as available, when streaming is used
        if self.streaming:
            self.send_data({
                "tables": options["tables"],
                "info": f'{"No " if len(options["tables"]) == 0 else ""}Vector tables found.'
                }, DATA_TYPE_OPTIONS)

        self.debug = options.get("debug", False)
        self.report_status = options.get("report_status", False)
        self.skip_generate = options.get("skip_generate", False)
        self.streaming = options.get("stream", False)
        self.re_run = options.get("re_run", False)

    def _make_response(self, result, options: dict):
        if result:
            options["response"] = self.task.format(result)
            options["cohere_meta"] = result.meta
            options["cohere_citations"] = result.citations
        else:
            options["response"] = None
            options["cohere_meta"] = None
            options["cohere_citations"] = None

        return options

    def _scan_tables(self):
        rows = self.session.run_sql(
            """
            SELECT concat(sys.quote_identifier(table_schema), '.', sys.quote_identifier(table_name)),
                table_schema as schema_name,
                table_name as table_name,
                create_options
            FROM information_schema.tables WHERE CREATE_OPTIONS LIKE '%SECONDARY_ENGINE%'
            """
        ).fetch_all()
        tables = []
        for row in rows:
            tables.append({
                "schema_name": row[1],
                "table_name": row[2],
                "vector_embeddings": True
                })
        if not tables:
            raise Exception("No LakeHouse tables found")
        if self.debug:
            print("* tables to be scanned:", tables)
        return tables


def set_api_key(key: str):
    global g_cohere_api_key
    global g_chat
    global g_embedding_model
    g_cohere_api_key = key
    g_chat = None
    if not g_embedding_model:
        g_embedding_model = SentenceTransformer(
            "sentence-transformers/all-MiniLM-L12-v2"
        )


def chat(prompt, options: dict = {}, session=None, send_gui_message=None):
    global g_chat
    global g_cohere_api_key
    global g_embedding_model
    if not g_embedding_model:
        g_embedding_model = SentenceTransformer(
            "sentence-transformers/all-MiniLM-L12-v2"
        )
    if not g_chat:
        g_chat = Chat(session, CohereTemplate(
            g_cohere_api_key), send_gui_message)
    return g_chat.run(prompt, options or {})


# import mysqlsh

# options = {"debug": 1}
# print(chat("how to disable redo log", options, session=mysqlsh.globals.session))
