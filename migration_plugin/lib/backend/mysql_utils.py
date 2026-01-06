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

from typing import Optional

from dataclasses import dataclass

from . import checks
from .. import logging
from ..dbsession import Session
from .model import MigrationMessage
from ..core import quote_ident, unquote_str


@dataclass
class InstanceContents(MigrationMessage):
    schemas: list[str]
    accounts: list[str]


def _fetch(session: Session, sql: str, args=[], *, field_fn=None) -> list[str]:
    try:
        if field_fn:
            return [field_fn(row) for row in session.run_sql(sql, args).fetch_all()]
        else:
            return [row[0] for row in session.run_sql(sql, args).fetch_all()]
    except:
        logging.exception(f"{sql}; args={args}")
        raise


def fetch_instance_contents(session: Session) -> InstanceContents:
    schemas = _fetch(session, "SHOW DATABASES")

    try:
        accounts = _fetch(
            session, "SELECT CONCAT(QUOTE(User), '@', QUOTE(Host)), user FROM mysql.user",
            field_fn= lambda row: (row[0], row[1]))
    except:
        accounts = _fetch(
            session, "SELECT DISTINCT grantee FROM information_schema.user_privileges",
            field_fn= lambda row: (row[0], unquote_str(row[0].rsplit('@', 1)[0])))  # grantee is in form 'user'@'host'

    return InstanceContents(
        schemas=[schema for schema in schemas
                 if schema not in checks.k_excluded_schemas + checks.k_mhs_excluded_schemas],
        accounts=[account for account, user in accounts
                  if user not in checks.k_excluded_users + checks.k_mhs_excluded_users]
    )

@dataclass
class SchemaObjects(MigrationMessage):
    schema: str
    objects: list[str]

@dataclass
class SchemaTriggers(MigrationMessage):
    schema: str
    objects: list[tuple[str,str]]  # (table_name, trigger_name)

@dataclass
class SchemaTables(MigrationMessage):
    schema: str
    tables: list[str]
    views: list[str]


class InstanceCache:
    def get_tables(self, session: Session, schema: str) -> SchemaTables:
        session.use(schema)
        # Tables/Views
        tables, views = [], []
        results = session.run_sql("SHOW FULL TABLES").fetch_all()
        for row in results:
            name = row[0]
            ttype = row[1]
            if ttype == "VIEW":
                views.append(quote_ident(name))
            else:
                tables.append(quote_ident(name))

        return SchemaTables(schema=schema, tables=tables, views=views)

    def _do_fetch(self, fetch_fn, schema: str, what: str) -> SchemaObjects:
        try:
            res = fetch_fn()
        except Exception:
            res = []

        return SchemaObjects(schema=schema, objects=res)

    def get_routines(self, session: Session, schema: str) -> SchemaObjects:
        try:
            res = (_fetch(session, "SHOW PROCEDURE STATUS WHERE Db=?", [
                schema], field_fn=lambda row: quote_ident(row[1])) +
                _fetch(session, "SHOW FUNCTION STATUS WHERE Db=?", [
                    schema], field_fn=lambda row: quote_ident(row[1])))
        except Exception:
            res = []

        return SchemaObjects(schema=schema, objects=res)

    def get_events(self, session: Session, schema: str) -> SchemaObjects:
        return self._do_fetch(
            lambda:  _fetch(session, "SHOW EVENTS FROM !", [schema], 
                            field_fn=lambda row: quote_ident(row[1])),
            schema, "events")

    def get_triggers(self, session: Session, schema: str) -> SchemaObjects:
        return self._do_fetch(
            lambda: _fetch(
                session, "SHOW TRIGGERS FROM !", [schema],
                field_fn=lambda row: f"{quote_ident(row[2])}.{quote_ident(row[0])}"),
            schema, "triggers")

    def get_libraries(self, session: Session, schema: str) -> SchemaObjects:
        return self._do_fetch(
            lambda: _fetch(
                session, "SHOW LIBRARY STATUS WHERE Db=?", [schema],
                field_fn=lambda row: quote_ident(row[1])),
            schema, "libraries")
