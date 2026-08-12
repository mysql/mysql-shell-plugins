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

import json
from typing import Optional

import mysqlsh  # pyright: ignore[reportMissingImports] pylint: disable=import-error
from mysqlsh.mysql import (  # pyright: ignore[reportMissingImports] pylint: disable=import-error
    quote_identifier,
    split_account,
)
from gui_plugin.mysql.backend.model import (
    AuthenticationFactor,
    MySQLUserListItem,
    MySQLGlobalPrivilegeCatalogItem,
    MySQLDefaultUserOptions,
    MySQLUser,
    MySQLObjectPrivilegeSchemaTarget,
    ObjectPrivilegeTarget,
)
from gui_plugin.mysql.PasswordResetInfo import INTERNAL_PASSWORD_PLUGINS
from gui_plugin.core.dbms.DbSession import DbSession


def _append_tls_options(
    query_parts: list[str], params: list, options: MySQLUser
) -> None:
    """Append TLS requirement clauses from structured user attributes."""
    if all(
        value is None
        for value in (
            options.sslType,
            options.sslCipher,
            options.x509Issuer,
            options.x509Subject,
        )
    ):
        return

    if options.sslType not in ("NONE", "ANY", "X509", "SPECIFIED"):
        raise ValueError("Invalid TLS type")

    if options.sslType == "NONE":
        if any(
            value is not None
            for value in (
                options.sslCipher,
                options.x509Issuer,
                options.x509Subject,
            )
        ):
            raise ValueError("TLS NONE cannot include TLS attributes")
        query_parts.append("REQUIRE NONE")
        return

    clauses: list[str] = []
    if options.sslType == "ANY":
        clauses.append("SSL")
    elif options.sslType == "X509":
        clauses.append("X509")

    for keyword, value in (
        ("CIPHER", options.sslCipher),
        ("ISSUER", options.x509Issuer),
        ("SUBJECT", options.x509Subject),
    ):
        if value is not None:
            if not isinstance(value, str):
                raise ValueError(f"Invalid TLS {keyword.lower()}")
            clauses.append(f"{keyword} ?")
            params.append(value)

    if not clauses:
        raise ValueError("TLS SPECIFIED requires a TLS attribute")

    query_parts.append("REQUIRE " + " AND ".join(clauses))


def _append_parameter_clause(
    clauses: list[str], params: list, keyword: str, value: Optional[object]
) -> None:
    """Append an optional clause and its corresponding parameter."""
    if value is None:
        return

    clauses.append(f"{keyword} ?")
    params.append(value)


def _append_resource_options(
    query_parts: list[str], params: list, options: MySQLUser
) -> None:
    clauses: list[str] = []
    _append_parameter_clause(
        clauses, params, "MAX_QUERIES_PER_HOUR", options.maxQuestions
    )
    _append_parameter_clause(
        clauses, params, "MAX_UPDATES_PER_HOUR", options.maxUpdates
    )
    _append_parameter_clause(
        clauses, params, "MAX_CONNECTIONS_PER_HOUR", options.maxConnections
    )
    _append_parameter_clause(
        clauses, params, "MAX_USER_CONNECTIONS", options.maxUserConnections
    )
    if clauses:
        query_parts.append("WITH " + " ".join(clauses))


def _append_password_options(
    query_parts: list[str],
    params: list,
    options: MySQLUser,
    include_password_require_current_optional: bool = False,
    include_password_expire: bool = True,
) -> None:
    if all(
        value is None
        for value in (
            options.passwordExpire,
            options.passwordLifetime,
            options.passwordReuseHistory,
            options.passwordReuseInterval,
            options.passwordRequireCurrent,
            options.failedLoginAttempts,
            options.passwordLockTime,
        )
    ):
        return

    if options.passwordExpire:
        if include_password_expire:
            query_parts.append("PASSWORD EXPIRE")
    elif options.passwordLifetime:
        _append_parameter_clause(
            query_parts, params, "PASSWORD EXPIRE INTERVAL", options.passwordLifetime
        )
        query_parts[-1] += " DAY"
    elif options.passwordLifetime == 0:
        query_parts.append("PASSWORD EXPIRE NEVER")

    _append_parameter_clause(
        query_parts, params, "PASSWORD HISTORY", options.passwordReuseHistory
    )
    _append_parameter_clause(
        query_parts,
        params,
        "PASSWORD REUSE INTERVAL",
        options.passwordReuseInterval,
    )
    if options.passwordReuseInterval is not None:
        query_parts[-1] += " DAY"
    if options.passwordRequireCurrent:
        query_parts.append("PASSWORD REQUIRE CURRENT")
    elif (
        include_password_require_current_optional
        and options.passwordRequireCurrent is False
    ):
        query_parts.append("PASSWORD REQUIRE CURRENT OPTIONAL")
    _append_parameter_clause(
        query_parts, params, "FAILED_LOGIN_ATTEMPTS", options.failedLoginAttempts
    )
    _append_parameter_clause(
        query_parts, params, "PASSWORD_LOCK_TIME", options.passwordLockTime
    )


def _require_authentication_plugin(plugin: str) -> str:
    if (
        not isinstance(plugin, str)
        or not plugin
        or not plugin.isascii()
        or not plugin.replace("_", "").isalnum()
    ):
        raise ValueError("Invalid authentication plugin")
    return plugin


LIST_USERS_QUERY = """
WITH
roles_agg AS (
  SELECT
    r0.`to_user`,
    r0.`to_host`,
    JSON_ARRAYAGG(r0.role) AS roles_json
  FROM (
    SELECT DISTINCT
      re.`to_user`,
      re.`to_host`,
      CONCAT(re.`from_user`, '@', re.`from_host`) AS role
    FROM mysql.`role_edges` re
  ) AS r0
  GROUP BY r0.`to_user`, r0.`to_host`
),

default_roles_agg AS (
  SELECT
    dr0.`USER`,
    dr0.`HOST`,
    JSON_ARRAYAGG(dr0.role) AS default_roles_json
  FROM (
    SELECT DISTINCT
      dr.`USER`,
      dr.`HOST`,
      CONCAT(dr.`DEFAULT_ROLE_USER`, '@', dr.`DEFAULT_ROLE_HOST`) AS role
    FROM mysql.`default_roles` dr
  ) AS dr0
  GROUP BY dr0.`USER`, dr0.`HOST`
),

schema_agg AS (
  SELECT
    s2.`GRANTEE`,
    JSON_OBJECTAGG(s2.schema_name, s2.privs_json) AS schema_privileges_json
  FROM (
    SELECT
      s1.`GRANTEE`,
      s1.schema_name,
      JSON_ARRAYAGG(s1.privilege_type) AS privs_json
    FROM (
      SELECT DISTINCT
        sp.`GRANTEE`,
        sp.`TABLE_SCHEMA`   AS schema_name,
        sp.`PRIVILEGE_TYPE` AS privilege_type
      FROM information_schema.`SCHEMA_PRIVILEGES` sp
    ) AS s1
    GROUP BY s1.`GRANTEE`, s1.schema_name
  ) AS s2
  GROUP BY s2.`GRANTEE`
),

table_agg AS (
  SELECT
    t2.`GRANTEE`,
    JSON_ARRAYAGG(JSON_OBJECT(
      'schema', t2.schema_name,
      'table', t2.table_name,
      'privileges', t2.privs_json
    )) AS table_privileges_json
  FROM (
    SELECT
      t1.`GRANTEE`,
      t1.schema_name,
      t1.table_name,
      JSON_ARRAYAGG(t1.privilege_type) AS privs_json
    FROM (
      SELECT DISTINCT
        tp.`GRANTEE`,
        tp.`TABLE_SCHEMA` AS schema_name,
        tp.`TABLE_NAME` AS table_name,
        tp.`PRIVILEGE_TYPE` AS privilege_type
      FROM information_schema.`TABLE_PRIVILEGES` tp
    ) AS t1
    GROUP BY t1.`GRANTEE`, t1.schema_name, t1.table_name
  ) AS t2
  GROUP BY t2.`GRANTEE`
),

column_agg AS (
  SELECT
    c2.`GRANTEE`,
    JSON_ARRAYAGG(JSON_OBJECT(
      'schema', c2.schema_name,
      'table', c2.table_name,
      'column', c2.column_name,
      'privileges', c2.privs_json
    )) AS column_privileges_json
  FROM (
    SELECT
      c1.`GRANTEE`,
      c1.schema_name,
      c1.table_name,
      c1.column_name,
      JSON_ARRAYAGG(c1.privilege_type) AS privs_json
    FROM (
      SELECT DISTINCT
        cp.`GRANTEE`,
        cp.`TABLE_SCHEMA` AS schema_name,
        cp.`TABLE_NAME` AS table_name,
        cp.`COLUMN_NAME` AS column_name,
        cp.`PRIVILEGE_TYPE` AS privilege_type
      FROM information_schema.`COLUMN_PRIVILEGES` cp
    ) AS c1
    GROUP BY c1.`GRANTEE`, c1.schema_name, c1.table_name, c1.column_name
  ) AS c2
  GROUP BY c2.`GRANTEE`
),

routine_privs_rows AS (
  SELECT
    pp.`User` AS usr,
    pp.`Host` AS hst,
    pp.`Db` AS schema_name,
    pp.`Routine_name` AS routine_name,
    pp.`Routine_type` AS routine_type,
    'EXECUTE' AS privilege_type
  FROM mysql.`procs_priv` pp
  WHERE FIND_IN_SET('Execute', pp.`Proc_priv`) > 0
  UNION ALL
  SELECT
    pp.`User`,
    pp.`Host`,
    pp.`Db`,
    pp.`Routine_name`,
    pp.`Routine_type`,
    'ALTER ROUTINE'
  FROM mysql.`procs_priv` pp
  WHERE FIND_IN_SET('Alter Routine', pp.`Proc_priv`) > 0
  UNION ALL
  SELECT
    pp.`User`,
    pp.`Host`,
    pp.`Db`,
    pp.`Routine_name`,
    pp.`Routine_type`,
    'GRANT OPTION'
  FROM mysql.`procs_priv` pp
  WHERE FIND_IN_SET('Grant', pp.`Proc_priv`) > 0
),

routine_agg AS (
  SELECT
    r2.usr,
    r2.hst,
    JSON_ARRAYAGG(JSON_OBJECT(
      'schema', r2.schema_name,
      'routine', r2.routine_name,
      'routineType', r2.routine_type,
      'privileges', r2.privs_json
    )) AS routine_privileges_json
  FROM (
    SELECT
      r1.usr,
      r1.hst,
      r1.schema_name,
      r1.routine_name,
      r1.routine_type,
      JSON_ARRAYAGG(r1.privilege_type) AS privs_json
    FROM (
      SELECT DISTINCT usr, hst, schema_name, routine_name, routine_type, privilege_type
      FROM routine_privs_rows
    ) AS r1
    GROUP BY r1.usr, r1.hst, r1.schema_name, r1.routine_name, r1.routine_type
  ) AS r2
  GROUP BY r2.usr, r2.hst
),

global_agg AS (
  SELECT
    d.`GRANTEE`,
    JSON_ARRAYAGG(d.privilege_type) AS global_privileges_json
  FROM (
    SELECT DISTINCT
      up.`GRANTEE`,
      up.`PRIVILEGE_TYPE` AS privilege_type
    FROM information_schema.`USER_PRIVILEGES` up
    WHERE up.`PRIVILEGE_TYPE` <> 'USAGE'
  ) AS d
  GROUP BY d.`GRANTEE`
)

SELECT
  u.`User` AS `user`,
  u.`Host` AS `host`,
  u.`account_locked` as accountLocked,
  COALESCE(
    /*!90600 tal.`LOCKED` = 'YES', */
    FALSE
  ) AS temporarilyLocked,
  JSON_MERGE_PRESERVE(
    JSON_ARRAY(u.`plugin`),
    COALESCE(JSON_EXTRACT(u.`User_attributes`, '$.multi_factor_authentication[*].plugin'), JSON_ARRAY())
  ) AS authenticationPlugins,
  u.`Host` = '%' AND u.`account_locked` = 'Y' AND COALESCE(u.`authentication_string`, '') = '' AS isRole,
  u.`password_expired` as passwordExpired,
  /* Password expiration timestamp (NULL if it never expires) */
  CASE
    WHEN COALESCE(u.`password_lifetime`, @@GLOBAL.default_password_lifetime) = 0 THEN NULL
    ELSE TIMESTAMPADD(DAY, COALESCE(u.`password_lifetime`, @@GLOBAL.default_password_lifetime), u.`password_last_changed`)
  END AS passwordExpiration,
  /* Empty lists not NULLs */
  IFNULL(ra.roles_json, JSON_ARRAY()) AS roles,
  IFNULL(dra.default_roles_json, JSON_ARRAY()) AS defaultRoles,
  IFNULL(ga.global_privileges_json, JSON_ARRAY()) AS globalPrivileges,
  /* Scoped privileges retain their identifier fields, and can be empty as well */
  IFNULL(sa.schema_privileges_json, JSON_OBJECT()) AS schemaPrivileges,
  IFNULL(ta.table_privileges_json, JSON_ARRAY()) AS tablePrivileges,
  IFNULL(ca.column_privileges_json, JSON_ARRAY()) AS columnPrivileges,
  IFNULL(rta.routine_privileges_json, JSON_ARRAY()) AS routinePrivileges,
  COALESCE(JSON_EXTRACT(u.`User_attributes`, '$.Restrictions'), JSON_ARRAY()) AS partialRevokes,

  CASE
    WHEN u.`ssl_type` IS NULL OR u.`ssl_type` = '' THEN NULL
    ELSE JSON_OBJECT(
      'requires_certificate',
        CASE
          WHEN u.`ssl_type` = 'X509'
            OR NULLIF(CONVERT(u.`x509_issuer` USING utf8mb4), '') IS NOT NULL
            OR NULLIF(CONVERT(u.`x509_subject` USING utf8mb4), '') IS NOT NULL
          THEN CAST('true' AS JSON)
          ELSE CAST('false' AS JSON)
        END,
      'ssl_cipher',   NULLIF(CONVERT(u.`ssl_cipher` USING utf8mb4),  ''),
      'x509_issuer',  NULLIF(CONVERT(u.`x509_issuer` USING utf8mb4), ''),
      'x509_subject', NULLIF(CONVERT(u.`x509_subject` USING utf8mb4),'')
    )
  END AS `sslOptions`

FROM mysql.`user` u
/*!90600
LEFT JOIN performance_schema.`temporary_account_locks` tal
  ON tal.`USER` = u.`User` AND tal.`HOST` = u.`Host`
*/
LEFT JOIN roles_agg  ra ON ra.`to_user` = u.`User` AND ra.`to_host` = u.`Host`
LEFT JOIN default_roles_agg dra ON dra.`USER` = u.`User` AND dra.`HOST` = u.`Host`
LEFT JOIN schema_agg sa ON sa.`GRANTEE`   = CONCAT('''', u.`User`, '''@''', u.`Host`, '''')
LEFT JOIN table_agg ta ON ta.`GRANTEE`     = CONCAT('''', u.`User`, '''@''', u.`Host`, '''')
LEFT JOIN column_agg ca ON ca.`GRANTEE`    = CONCAT('''', u.`User`, '''@''', u.`Host`, '''')
LEFT JOIN routine_agg rta ON rta.`usr`     = u.`User` AND rta.`hst` = u.`Host`
LEFT JOIN global_agg ga ON ga.`GRANTEE`    = CONCAT('''', u.`User`, '''@''', u.`Host`, '''')
ORDER BY u.`User`, u.`Host`;
"""

GET_USER_QUERY = """
SELECT
    Host as host,
    User as user,
    ssl_type as sslType,
    NULLIF(CONVERT(ssl_cipher USING utf8mb4),  '') as sslCipher,
    NULLIF(CONVERT(x509_issuer USING utf8mb4),  '') as x509Issuer,
    NULLIF(CONVERT(x509_subject USING utf8mb4),  '') as x509Subject,
    max_questions as maxQuestions,
    max_updates as maxUpdates,
    max_connections as maxConnections,
    max_user_connections as maxUserConnections,
    plugin,
    authentication_string AS firstAuthenticationString,
    JSON_UNQUOTE(
        JSON_EXTRACT(User_attributes, '$.multi_factor_authentication[0].plugin')
    ) AS secondAuthenticationPlugin,
    JSON_UNQUOTE(
        JSON_EXTRACT(User_attributes, '$.multi_factor_authentication[0].authentication_string')
    ) AS secondAuthenticationString,
    JSON_UNQUOTE(
        JSON_EXTRACT(User_attributes, '$.multi_factor_authentication[1].plugin')
    ) AS thirdAuthenticationPlugin,
    JSON_UNQUOTE(
        JSON_EXTRACT(User_attributes, '$.multi_factor_authentication[1].authentication_string')
    ) AS thirdAuthenticationString,
    password_expired as passwordExpire,
    password_last_changed as passwordLastChanged,
    password_lifetime as passwordLifetime,
    account_locked as accountLocked,
    Password_reuse_history as passwordReuseHistory,
    Password_reuse_time as passwordReuseInterval,
    Password_require_current as passwordRequireCurrent,
    JSON_UNQUOTE(JSON_EXTRACT(User_attributes, '$.metadata.comment')) AS comment,
    CAST(
        JSON_UNQUOTE(
            JSON_EXTRACT(User_attributes, '$.Password_locking.failed_login_attempts')
        ) AS UNSIGNED
    ) AS failedLoginAttempts,
    CAST(
        JSON_UNQUOTE(
            JSON_EXTRACT(User_attributes, '$.Password_locking.password_lock_time_days')
        ) AS UNSIGNED
    ) AS passwordLockTime
FROM mysql.user
WHERE `User` = ? AND `Host` = ?
"""

USER_GLOBAL_PRIVILEGES_QUERY = """
SELECT DISTINCT up.`PRIVILEGE_TYPE` AS privilege
FROM information_schema.`USER_PRIVILEGES` up
WHERE up.`GRANTEE` = ?
AND up.`PRIVILEGE_TYPE` <> 'USAGE'
ORDER BY up.`PRIVILEGE_TYPE`
"""

PARTIAL_REVOKES_QUERY = (
    "SELECT COALESCE(/*!80016 @@GLOBAL.partial_revokes, */ FALSE) AS partialRevokes"
)

UNMANAGED_GLOBAL_PRIVILEGES = {
    "ALL",
    "ALL PRIVILEGES",
    # TODO: GRANT OPTION requires special handling.
    "GRANT OPTION",
    "PROXY",
    "USAGE",
}
COLUMN_PRIVILEGES = {"SELECT", "INSERT", "UPDATE", "REFERENCES"}
OBJECT_PRIVILEGE_KINDS = {"schema", "table", "routine", "column"}
ROUTINE_TYPES = {"FUNCTION", "PROCEDURE"}


def _show_privilege_identifier(value: object) -> str:
    if not isinstance(value, str):
        return ""

    return " ".join(value.split()).upper()


def _is_backend_true(value: object) -> bool:
    if value is True or value == 1:
        return True

    if isinstance(value, str):
        return value.strip().upper() in {"1", "ON", "TRUE", "YES"}

    return False


def _partial_revokes_from_user_attributes(value: object) -> dict[str, list[str]]:
    if value is None:
        return {}

    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return {}

    if not isinstance(value, list):
        return {}

    restrictions: dict[str, list[str]] = {}
    for entry in value:
        if not isinstance(entry, dict):
            continue

        schema = entry.get("Database")
        privileges = entry.get("Privileges")
        if not isinstance(schema, str) or not isinstance(privileges, list):
            continue

        restrictions[schema] = privileges

    return restrictions


def _convert_row_values(row: dict, cols: list):
    for col in cols:
        col_name = col.get_column_label()
        col_type = col.get_type().data

        if col_name in ("isRole", "temporarilyLocked"):
            row[col_name] = row.get(col_name) == 1
        elif col_type == "JSON" and row.get(col_name) is not None:
            row[col_name] = json.loads(row[col_name])
        elif col_type == "BIT":
            row[col_name] = row[col_name] == 1
        elif col_type == "SET" and row.get(col_name) is not None:
            row[col_name] = row[col_name].split(",")
        elif col_type == "ENUM" and row.get(col_name) == "Y":
            row[col_name] = True
        elif col_type == "ENUM" and row.get(col_name) == "N":
            row[col_name] = False

    return row


def list_mysql_users(session: DbSession) -> list[MySQLUserListItem]:
    """List all MySQL users"""

    result = []
    res = session.run_sql(LIST_USERS_QUERY)

    for row in iter(res.fetch_one_object, None):
        converted = _convert_row_values(row, res.get_columns())
        converted["partialRevokes"] = _partial_revokes_from_user_attributes(
            converted.get("partialRevokes")
        )
        result.append(MySQLUserListItem(**converted))

    return result


def is_partial_revokes_enabled(session: DbSession) -> bool:
    """Return whether the connected MySQL server has partial revokes enabled."""

    try:
        res = session.run_sql(PARTIAL_REVOKES_QUERY, [])
        row = res.fetch_one_object()
    except Exception:
        return False

    if row is None:
        return False

    return _is_backend_true(row.get("partialRevokes"))


def list_authentication_plugins(session: DbSession) -> list[str]:
    """List authentication plugins supported by the connected MySQL server."""

    res = session.run_sql(
        """
SELECT p.`PLUGIN_NAME` AS pluginName
FROM information_schema.`PLUGINS` p
WHERE p.`PLUGIN_TYPE` = 'AUTHENTICATION'
  AND p.`PLUGIN_STATUS` = 'ACTIVE'
  AND p.`PLUGIN_NAME` <> 'sha256_password'
ORDER BY p.`PLUGIN_NAME`
""",
        [],
    )

    return [row.get("pluginName") for row in iter(res.fetch_one_object, None)]


def get_create_user_defaults(session: DbSession) -> MySQLDefaultUserOptions:
    """Return server default values for a new MySQL user account."""

    res = session.run_sql(
        """
SHOW GLOBAL VARIABLES
WHERE Variable_name IN (
    'default_password_lifetime',
    'password_history',
    'password_reuse_interval',
    'password_require_current',
    'max_user_connections',
    'authentication_policy',
    'default_authentication_plugin',
    'require_secure_transport'
)
   OR Variable_name LIKE 'validate_password.%'
   OR Variable_name LIKE 'validate_password_%'
""", [])

    variables = {
        str(variable.get("Variable_name")): str(variable.get("Value"))
        for variable in iter(res.fetch_one_object, None)
    }
    defaults = MySQLDefaultUserOptions()
    password_validation_length = variables.get("validate_password.length") \
        or variables.get("validate_password_length")
    defaults.passwordLifetime = int(variables.get("default_password_lifetime", 0))
    defaults.passwordReuseHistory = int(variables.get("password_history", 0))
    defaults.passwordReuseInterval = int(variables.get("password_reuse_interval", 0))
    defaults.passwordRequireCurrent = _is_backend_true(variables.get("password_require_current"))
    defaults.maxUserConnections = int(variables.get("max_user_connections", 0))
    defaults.authenticationPolicy = variables.get("authentication_policy")
    defaults.defaultAuthenticationPlugin = variables.get("default_authentication_plugin")
    defaults.passwordValidationInstalled = any(
        name.startswith(("validate_password.", "validate_password_")) for name in variables
    )
    defaults.passwordValidationPolicy = (
        variables.get("validate_password.policy") or variables.get("validate_password_policy")
    )
    defaults.passwordValidationLength = int(password_validation_length) \
        if password_validation_length and password_validation_length.isdigit() else None
    defaults.requireSecureTransport = _is_backend_true(variables.get("require_secure_transport")) \
        if "require_secure_transport" in variables else None

    return defaults


def _require_non_empty_value(value: object, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} is required")

    return value.strip()


def _routine_type_from_value(routine_type: object) -> Optional[str]:
    if routine_type is None:
        return None

    if not isinstance(routine_type, str) or routine_type not in ROUTINE_TYPES:
        raise ValueError("Routine type must be FUNCTION or PROCEDURE")

    return routine_type


def list_global_privilege_catalog(
    session: DbSession,
) -> list[MySQLGlobalPrivilegeCatalogItem]:
    """List global privileges supported by the connected MySQL server."""

    if "global_privilege_catalog" in session.data:
        return session.data["global_privilege_catalog"]

    result = []
    res = session.run_sql("SHOW PRIVILEGES", [])

    for row in iter(res.fetch_one_object, None):  # type: ignore
        privilege = _show_privilege_identifier(row.get("Privilege"))
        if not privilege or privilege in UNMANAGED_GLOBAL_PRIVILEGES:
            continue

        result.append(
            MySQLGlobalPrivilegeCatalogItem(
                privilege=privilege,
                category=row.get("Context") or "",
                description=row.get("Comment") or "",
            )
        )

    result.sort(key=lambda item: item.privilege)

    session.set_data("global_privilege_catalog", result)

    return result


def list_schema_privilege_catalog(
    session: DbSession,
) -> list[MySQLGlobalPrivilegeCatalogItem]:
    """List cached server privileges that can be granted at schema scope."""

    result = []
    for item in list_global_privilege_catalog(session):
        contexts = {context.strip().lower() for context in item.category.split(",")}
        if not contexts.isdisjoint(
            {"databases", "tables", "functions", "procedures"}
        ):
            result.append(item)

    return result


def list_object_privilege_schema_targets(
    session: DbSession, schema: str
) -> list[MySQLObjectPrivilegeSchemaTarget]:
    """List tables and routines in a schema that can receive object privileges."""

    res = session.run_sql(
        """
SELECT 'table' AS kind, t.`TABLE_NAME` AS objectName, NULL AS routineType
FROM information_schema.`TABLES` t
WHERE t.`TABLE_SCHEMA` = ?
  AND t.`TABLE_TYPE` = 'BASE TABLE'
UNION ALL
SELECT 'routine' AS kind, r.`ROUTINE_NAME` AS objectName, r.`ROUTINE_TYPE` AS routineType
FROM information_schema.`ROUTINES` r
WHERE r.`ROUTINE_SCHEMA` = ?
ORDER BY kind, objectName
""",
        [schema, schema],
    )

    return [
        MySQLObjectPrivilegeSchemaTarget(**row)
        for row in iter(res.fetch_one_object, None)
    ]


def list_user_global_privileges(session: DbSession, user: str, host: str) -> list[str]:
    """List direct global privileges granted to a MySQL user account."""

    res = session.run_sql(USER_GLOBAL_PRIVILEGES_QUERY, [f"'{user}'@'{host}'"])

    return [row.get("privilege") for row in iter(res.fetch_one_object, None)]


def list_user_role_global_privileges(
    session: DbSession, user: str, host: str
) -> list[str]:
    """List global privileges inherited through assigned roles, including nested roles."""

    res = session.run_sql(
        """
WITH RECURSIVE role_graph (`user`, `host`) AS (
  SELECT re.`from_user`, re.`from_host`
  FROM mysql.`role_edges` re
  WHERE re.`to_user` = ? AND re.`to_host` = ?

  UNION DISTINCT

  SELECT re.`from_user`, re.`from_host`
  FROM mysql.`role_edges` re
  INNER JOIN role_graph rg
    ON rg.`user` = re.`to_user` AND rg.`host` = re.`to_host`
)
SELECT DISTINCT up.`PRIVILEGE_TYPE` AS privilege
FROM role_graph rg
INNER JOIN information_schema.`USER_PRIVILEGES` up
  ON up.`GRANTEE` = CONCAT(CHAR(39), rg.`user`, CHAR(39), '@', CHAR(39), rg.`host`, CHAR(39))
WHERE up.`PRIVILEGE_TYPE` <> 'USAGE'
ORDER BY up.`PRIVILEGE_TYPE`
""",
        [user, host],
    )

    return [row.get("privilege") for row in iter(res.fetch_one_object, None)]


def list_user_schema_privileges(
    session: DbSession, user: str, host: str, schema: str
) -> list[str]:
    """List direct privileges granted to a MySQL user account for one schema."""

    res = session.run_sql(
        """
SELECT sp.`PRIVILEGE_TYPE` AS privilege
FROM information_schema.`SCHEMA_PRIVILEGES` sp
WHERE sp.`GRANTEE` = ?
  AND sp.`TABLE_SCHEMA` = ?
ORDER BY sp.`PRIVILEGE_TYPE`
""",
        [f"'{user}'@'{host}'", schema],
    )

    return [row.get("privilege") for row in iter(res.fetch_one_object, None)]


def list_user_partial_revokes(
    session: DbSession, user: str, host: str
) -> dict[str, list[str]]:
    """List partial revoke restrictions for a MySQL user account by schema."""

    res = session.run_sql(
        """
SELECT COALESCE(JSON_EXTRACT(u.`User_attributes`, '$.Restrictions'), JSON_ARRAY()) AS partialRevokes
FROM mysql.`user` u
WHERE u.`User` = ? AND u.`Host` = ?
LIMIT 1
""",
        [user, host],
    )
    row = res.fetch_one_object()
    if row is None:
        return {}

    return _partial_revokes_from_user_attributes(row.get("partialRevokes"))


def _list_user_table_privileges(
    session: DbSession, user: str, host: str, schema: str, table: str
) -> list[str]:
    res = session.run_sql(
        """
SELECT tp.`PRIVILEGE_TYPE` AS privilege
FROM information_schema.`TABLE_PRIVILEGES` tp
WHERE tp.`GRANTEE` = ?
  AND tp.`TABLE_SCHEMA` = ?
  AND tp.`TABLE_NAME` = ?
ORDER BY tp.`PRIVILEGE_TYPE`
""",
        [f"'{user}'@'{host}'", schema, table],
    )

    return [row.get("privilege") for row in iter(res.fetch_one_object, None)]


def _list_user_column_privileges(
    session: DbSession, user: str, host: str, schema: str, table: str, column: str
) -> list[str]:
    res = session.run_sql(
        """
SELECT cp.`PRIVILEGE_TYPE` AS privilege
FROM information_schema.`COLUMN_PRIVILEGES` cp
WHERE cp.`GRANTEE` = ?
  AND cp.`TABLE_SCHEMA` = ?
  AND cp.`TABLE_NAME` = ?
  AND cp.`COLUMN_NAME` = ?
ORDER BY cp.`PRIVILEGE_TYPE`
""",
        [f"'{user}'@'{host}'", schema, table, column],
    )

    return [row.get("privilege") for row in iter(res.fetch_one_object, None)]


def _list_user_routine_privileges(
    session: DbSession,
    user: str,
    host: str,
    schema: str,
    routine: str,
    routine_type: str,
) -> list[str]:
    res = session.run_sql(
        """
SELECT 'EXECUTE' AS privilege
FROM mysql.`procs_priv` pp
WHERE pp.`User` = ? AND pp.`Host` = ? AND pp.`Db` = ? AND pp.`Routine_name` = ?
  AND pp.`Routine_type` = ?
  AND FIND_IN_SET('Execute', pp.`Proc_priv`) > 0
UNION
SELECT 'ALTER ROUTINE'
FROM mysql.`procs_priv` pp
WHERE pp.`User` = ? AND pp.`Host` = ? AND pp.`Db` = ? AND pp.`Routine_name` = ?
  AND pp.`Routine_type` = ?
  AND FIND_IN_SET('Alter Routine', pp.`Proc_priv`) > 0
UNION
SELECT 'GRANT OPTION'
FROM mysql.`procs_priv` pp
WHERE pp.`User` = ? AND pp.`Host` = ? AND pp.`Db` = ? AND pp.`Routine_name` = ?
  AND pp.`Routine_type` = ?
  AND FIND_IN_SET('Grant', pp.`Proc_priv`) > 0
ORDER BY privilege
""",
        [user, host, schema, routine, routine_type] * 3,
    )

    return [row.get("privilege") for row in iter(res.fetch_one_object, None)]


def _get_routine_type_from_grants(
    session: DbSession, user: str, host: str, schema: str, routine: str
) -> Optional[str]:
    res = session.run_sql(
        """
SELECT pp.`Routine_type` AS routineType
FROM mysql.`procs_priv` pp
WHERE pp.`User` = ? AND pp.`Host` = ? AND pp.`Db` = ? AND pp.`Routine_name` = ?
LIMIT 1
""",
        [user, host, schema, routine],
    )
    row = res.fetch_one_object()
    if row is None:
        return None

    return _routine_type_from_value(row.get("routineType"))


def _get_routine_type_from_metadata(
    session: DbSession, schema: str, routine: str
) -> Optional[str]:
    res = session.run_sql(
        """
SELECT r.`ROUTINE_TYPE` AS routineType
FROM information_schema.`ROUTINES` r
WHERE r.`ROUTINE_SCHEMA` = ? AND r.`ROUTINE_NAME` = ?
LIMIT 1
""",
        [schema, routine],
    )
    row = res.fetch_one_object()
    if row is None:
        return None

    return _routine_type_from_value(row.get("routineType"))


def _valid_object_privileges(
    session: DbSession,
    kind: str,
    current_privileges: list[str],
    routine_type: Optional[str],
) -> set[str]:
    valid = set(current_privileges)
    for item in list_schema_privilege_catalog(session):
        privilege = item.privilege
        contexts = {context.strip().lower() for context in item.category.split(",")}

        if privilege == "GRANT OPTION" and kind != "column":
            valid.add(privilege)
        elif kind == "schema" and not contexts.isdisjoint({"databases", "tables"}):
            valid.add(privilege)
        elif kind == "table" and "tables" in contexts:
            valid.add(privilege)
        elif kind == "routine":
            if routine_type == "FUNCTION" and "functions" in contexts:
                valid.add(privilege)
            elif routine_type == "PROCEDURE" and "procedures" in contexts:
                valid.add(privilege)
            elif routine_type is None and not contexts.isdisjoint(
                {"functions", "procedures"}
            ):
                valid.add(privilege)
        elif (
            kind == "column" and privilege in COLUMN_PRIVILEGES and "tables" in contexts
        ):
            valid.add(privilege)

    return valid


def _object_scope(target: ObjectPrivilegeTarget, routine_type: Optional[str]) -> str:
    kind = _require_non_empty_value(target.kind, "Object privilege target kind").lower()
    schema = _require_non_empty_value(target.schema, "Schema name")
    quoted_schema = quote_identifier(schema)

    if kind == "schema":
        return f"{quoted_schema}.*"

    object_name = _require_non_empty_value(target.objectName, "Object name")
    if kind == "table" or kind == "column":
        return f"{quoted_schema}.{quote_identifier(object_name)}"

    if kind == "routine":
        if routine_type is None:
            raise ValueError("Routine type is required")

        return f"{routine_type} {quoted_schema}.{quote_identifier(object_name)}"

    raise ValueError(f"Unknown object privilege target kind: {kind}")


def _grant_privilege_sql(
    privilege: str, scope: str, target: ObjectPrivilegeTarget
) -> str:
    if privilege == "GRANT OPTION":
        return f"GRANT USAGE ON {scope} TO ?@? WITH GRANT OPTION"

    if str(target.kind).lower() == "column":
        column = quote_identifier(
            _require_non_empty_value(target.column, "Column name")
        )
        return f"GRANT {privilege} ({column}) ON {scope} TO ?@?"

    return f"GRANT {privilege} ON {scope} TO ?@?"


def _revoke_privilege_sql(
    privilege: str, scope: str, target: ObjectPrivilegeTarget
) -> str:
    if privilege == "GRANT OPTION":
        return f"REVOKE GRANT OPTION ON {scope} FROM ?@?"

    if str(target.kind).lower() == "column":
        column = quote_identifier(
            _require_non_empty_value(target.column, "Column name")
        )
        return f"REVOKE {privilege} ({column}) ON {scope} FROM ?@?"

    return f"REVOKE {privilege} ON {scope} FROM ?@?"


def _object_privilege_clause(
    privileges: list[str], target: ObjectPrivilegeTarget
) -> str:
    if str(target.kind).lower() != "column":
        return ", ".join(privileges)

    column = quote_identifier(_require_non_empty_value(target.column, "Column name"))
    return ", ".join(f"{privilege} ({column})" for privilege in privileges)


def _grant_privileges_sql(
    privileges: list[str], scope: str, target: ObjectPrivilegeTarget
) -> str:
    with_grant_option = "GRANT OPTION" in privileges
    grant_privileges = [
        privilege for privilege in privileges if privilege != "GRANT OPTION"
    ]

    if grant_privileges:
        sql = (
            f"GRANT {_object_privilege_clause(grant_privileges, target)} "
            f"ON {scope} TO ?@?"
        )
    else:
        sql = f"GRANT USAGE ON {scope} TO ?@?"

    if with_grant_option:
        sql += " WITH GRANT OPTION"

    return sql


def _revoke_privileges_sql(
    privileges: list[str], scope: str, target: ObjectPrivilegeTarget
) -> str:
    return (
        f"REVOKE {_object_privilege_clause(privileges, target)} " f"ON {scope} FROM ?@?"
    )


def _routine_type(
    session: DbSession,
    user: str,
    host: str,
    schema: str,
    routine: str,
    target: ObjectPrivilegeTarget,
) -> Optional[str]:
    return (
        _routine_type_from_value(target.routineType)
        or _get_routine_type_from_metadata(session, schema, routine)
        or _get_routine_type_from_grants(session, user, host, schema, routine)
    )


def _object_privilege_context(
    session: DbSession, user: str, host: str, target: ObjectPrivilegeTarget
) -> tuple[str, Optional[str], list[str]]:
    kind = _require_non_empty_value(target.kind, "Object privilege target kind").lower()
    if kind not in OBJECT_PRIVILEGE_KINDS:
        raise ValueError(f"Unknown object privilege target kind: {kind}")

    schema = _require_non_empty_value(target.schema, "Schema name")
    routine_type = None

    if kind == "schema":
        current_privileges = list_user_schema_privileges(session, user, host, schema)
    elif kind == "table":
        table = _require_non_empty_value(target.objectName, "Object name")
        current_privileges = _list_user_table_privileges(
            session, user, host, schema, table
        )
    elif kind == "column":
        table = _require_non_empty_value(target.objectName, "Object name")
        column = _require_non_empty_value(target.column, "Column name")
        current_privileges = _list_user_column_privileges(
            session, user, host, schema, table, column
        )
    else:
        routine = _require_non_empty_value(target.objectName, "Object name")
        routine_type = _routine_type(session, user, host, schema, routine, target)
        if routine_type is None:
            raise ValueError("Routine type is required")
        current_privileges = _list_user_routine_privileges(
            session, user, host, schema, routine, routine_type
        )

    return kind, routine_type, current_privileges


def _schema_catalog_privileges(
    session: DbSession, current_privileges: list[str]
) -> set[str]:
    valid = set(current_privileges)
    for item in list_schema_privilege_catalog(session):
        contexts = {context.strip().lower() for context in item.category.split(",")}
        if item.privilege == "GRANT OPTION" or not contexts.isdisjoint(
            {"databases", "tables"}
        ):
            valid.add(item.privilege)

    return valid


def _unique_privileges(privileges: list[str]) -> list[str]:
    return list(dict.fromkeys(privileges))


def _set_user_schema_privileges_with_partial_revokes(
    session: DbSession,
    user: str,
    host: str,
    target: ObjectPrivilegeTarget,
    current_privileges: list[str],
    privileges: list[str],
) -> None:
    current_privilege_set = set(current_privileges)
    valid_privileges = _schema_catalog_privileges(session, current_privileges)
    global_privilege_set = set(list_user_global_privileges(session, user, host))
    global_privilege_set.update(list_user_role_global_privileges(session, user, host))
    schema = _require_non_empty_value(target.schema, "Schema name")
    global_privilege_set.intersection_update(valid_privileges)
    restrictions = list_user_partial_revokes(session, user, host)
    restricted_privilege_set = set(restrictions.get(schema, []))
    inherited_privilege_set = global_privilege_set - restricted_privilege_set
    valid_privileges = valid_privileges | global_privilege_set
    selected_privileges = privileges
    selected_privilege_set = set(selected_privileges)
    unknown_privileges = selected_privilege_set - valid_privileges

    if unknown_privileges:
        unknown = ", ".join(sorted(unknown_privileges))
        raise ValueError(f"Unknown schema privilege(s): {unknown}")

    privileges_to_grant = [
        privilege
        for privilege in selected_privileges
        if privilege not in current_privilege_set
        and privilege not in inherited_privilege_set
    ]
    privileges_to_revoke = [
        privilege
        for privilege in current_privileges
        if privilege not in selected_privilege_set
    ]
    privileges_to_partially_revoke = [
        privilege
        for privilege in sorted(global_privilege_set)
        if privilege not in selected_privilege_set
        and privilege not in restricted_privilege_set
    ]
    if (
        not privileges_to_grant
        and not privileges_to_revoke
        and not privileges_to_partially_revoke
    ):
        return

    scope = _object_scope(target, None)
    privileges_to_grant_without_grant_option = [
        privilege for privilege in privileges_to_grant if privilege != "GRANT OPTION"
    ]
    if privileges_to_grant_without_grant_option:
        session.run_sql(
            f"GRANT {', '.join(privileges_to_grant_without_grant_option)} "
            f"ON {scope} TO ?@?",
            [user, host],
        )

    if "GRANT OPTION" in privileges_to_grant:
        session.run_sql(
            _grant_privilege_sql("GRANT OPTION", scope, target), [user, host]
        )

    privileges_to_revoke_without_grant_option = _unique_privileges(
        [
            privilege
            for privilege in privileges_to_revoke + privileges_to_partially_revoke
            if privilege != "GRANT OPTION"
        ]
    )
    if privileges_to_revoke_without_grant_option:
        session.run_sql(
            f"REVOKE {', '.join(privileges_to_revoke_without_grant_option)} "
            f"ON {scope} FROM ?@?",
            [user, host],
        )

    if (
        "GRANT OPTION" in privileges_to_revoke
        or "GRANT OPTION" in privileges_to_partially_revoke
    ):
        session.run_sql(
            _revoke_privilege_sql("GRANT OPTION", scope, target), [user, host]
        )


def set_user_global_privileges(
    session: DbSession, user: str, host: str, privileges: list[str]
) -> None:
    """Replace the direct global privilege set for the given MySQL user account."""

    current_privileges = list_user_global_privileges(session, user, host)
    current_privilege_set = set(current_privileges)
    catalog_privileges = {
        item.privilege for item in list_global_privilege_catalog(session)
    }
    valid_privileges = catalog_privileges | current_privilege_set
    selected_privileges = privileges
    selected_privilege_set = set(selected_privileges)
    unknown_privileges = selected_privilege_set - valid_privileges

    if unknown_privileges:
        unknown = ", ".join(sorted(unknown_privileges))
        raise ValueError(f"Unknown global privilege(s): {unknown}")

    privileges_to_grant = [
        privilege
        for privilege in selected_privileges
        if privilege not in current_privilege_set and privilege != "GRANT OPTION"
    ]
    if privileges_to_grant:
        session.run_sql(
            f"GRANT {', '.join(privileges_to_grant)} ON *.* TO ?@?", [user, host]
        )

    if (
        "GRANT OPTION" in selected_privilege_set
        and "GRANT OPTION" not in current_privilege_set
    ):
        session.run_sql("GRANT USAGE ON *.* TO ?@? WITH GRANT OPTION", [user, host])

    privileges_to_revoke = [
        privilege
        for privilege in current_privileges
        if privilege not in selected_privilege_set and privilege != "GRANT OPTION"
    ]
    if privileges_to_revoke:
        session.run_sql(
            f"REVOKE {', '.join(privileges_to_revoke)} ON *.* FROM ?@?", [user, host]
        )

    if (
        "GRANT OPTION" in current_privilege_set
        and "GRANT OPTION" not in selected_privilege_set
    ):
        session.run_sql("REVOKE GRANT OPTION ON *.* FROM ?@?", [user, host])


def set_user_object_privileges(
    session: DbSession,
    user: str,
    host: str,
    target: ObjectPrivilegeTarget,
    privileges: list[str],
) -> None:
    """Replace the direct privilege set for a user account on an object target."""

    if not isinstance(target, ObjectPrivilegeTarget):
        raise ValueError("Object privilege target is required")

    kind, routine_type, current_privileges = _object_privilege_context(
        session, user, host, target
    )
    if kind == "schema" and is_partial_revokes_enabled(session):
        _set_user_schema_privileges_with_partial_revokes(
            session, user, host, target, current_privileges, privileges
        )

        return

    current_privilege_set = set(current_privileges)
    valid_privileges = _valid_object_privileges(
        session, kind, current_privileges, routine_type
    )
    selected_privileges = privileges
    selected_privilege_set = set(selected_privileges)
    unknown_privileges = selected_privilege_set - valid_privileges

    if unknown_privileges:
        unknown = ", ".join(sorted(unknown_privileges))
        raise ValueError(f"Unknown {kind} privilege(s): {unknown}")

    privileges_to_grant = [
        privilege
        for privilege in selected_privileges
        if privilege not in current_privilege_set
    ]
    privileges_to_revoke = [
        privilege
        for privilege in current_privileges
        if privilege not in selected_privilege_set
    ]
    if not privileges_to_grant and not privileges_to_revoke:
        return

    scope = _object_scope(target, routine_type)
    if privileges_to_grant:
        session.run_sql(
            _grant_privileges_sql(
                _unique_privileges(privileges_to_grant), scope, target
            ),
            [user, host],
        )

    privileges_to_revoke_without_grant_option = _unique_privileges(
        [privilege for privilege in privileges_to_revoke if privilege != "GRANT OPTION"]
    )
    if privileges_to_revoke_without_grant_option:
        session.run_sql(
            _revoke_privileges_sql(
                privileges_to_revoke_without_grant_option, scope, target
            ),
            [user, host],
        )

    if "GRANT OPTION" in privileges_to_revoke:
        session.run_sql(
            _revoke_privilege_sql("GRANT OPTION", scope, target), [user, host]
        )


def list_user_roles(session: DbSession, user: str, host: str) -> list[str]:
    """List roles granted to the given MySQL user account."""

    res = session.run_sql(
        """
SELECT CONCAT(re.`from_user`, '@', re.`from_host`) AS role
FROM mysql.`role_edges` re
WHERE re.`to_user` = ? AND re.`to_host` = ?
ORDER BY re.`from_user`, re.`from_host`
""",
        [user, host],
    )

    return [row.get("role") for row in iter(res.fetch_one_object, None)]


def set_granted_roles(
    session: DbSession,
    user: str,
    host: str,
    roles: list[str],
    default_roles: Optional[list[str]] = None,
) -> None:
    """Replace the granted/default role set for the given MySQL user account."""

    selected_roles = roles
    selected_role_set = set(selected_roles)
    default_role_source = selected_roles if default_roles is None else default_roles
    selected_default_roles = default_role_source
    current_roles = list_user_roles(session, user, host)
    current_role_set = set(current_roles)

    additional_roles = selected_role_set.difference(current_role_set)

    for role in additional_roles:
        role_account = split_account(role)
        session.run_sql(
            "GRANT ?@? TO ?@?", [role_account["user"], role_account["host"], user, host]
        )

    if selected_default_roles:
        role_placeholders = ", ".join(["?@?"] * len(selected_default_roles))
        params = []
        for role in selected_default_roles:
            role_account = split_account(role)
            params.extend([role_account["user"], role_account["host"]])
        params.extend([user, host])
        session.run_sql(f"SET DEFAULT ROLE {role_placeholders} TO ?@?", params)
    else:
        session.run_sql("SET DEFAULT ROLE NONE TO ?@?", [user, host])

    outdated_roles = current_role_set.difference(selected_role_set)

    for role in outdated_roles:
        role_account = split_account(role)
        session.run_sql(
            "REVOKE ?@? FROM ?@?",
            [role_account["user"], role_account["host"], user, host],
        )


def get_mysql_user(session: DbSession, user: str, host: str) -> Optional[MySQLUser]:
    """Get a MySQL user by username"""

    res = session.run_sql(GET_USER_QUERY, [user, host])
    row = res.fetch_one_object()

    if row is None:
        return None

    values = _convert_row_values(row, res.get_columns())
    authentication_factors = []
    missing_factor = False
    for plugin_field, authentication_string_field in (
        ("plugin", "firstAuthenticationString"),
        ("secondAuthenticationPlugin", "secondAuthenticationString"),
        ("thirdAuthenticationPlugin", "thirdAuthenticationString"),
    ):
        plugin = values.pop(plugin_field, None)
        authentication_string = values.pop(authentication_string_field, None)
        if not plugin:
            missing_factor = True
            continue

        assert not missing_factor
        authentication_factors.append(AuthenticationFactor(
            plugin=plugin,
            authenticationString=None if plugin.endswith("_password") else authentication_string,
        ))

    return MySQLUser(authenticationFactors=authentication_factors, **values)


def create_mysql_user(session: DbSession, options: MySQLUser) -> Optional[str]:
    """Create a MySQL user with the specified username, host, password and options"""
    query_parts = ["CREATE USER ?@?"]

    params = [options.user, options.host]
    if not 1 <= len(options.authenticationFactors) <= 3:
        raise ValueError("A user must have between one and three authentication factors")

    used_plugins = set()
    for index, factor in enumerate(options.authenticationFactors):
        if not isinstance(factor, AuthenticationFactor):
            raise ValueError("Invalid authentication factor")
        plugin = _require_authentication_plugin(factor.plugin)
        if plugin in used_plugins:
            raise ValueError("Cannot use same method for more than one factor")
        used_plugins.add(plugin)

        if index > 0:
            if factor.password is not None:
                raise ValueError("Only the first authentication factor can use a password")
            if plugin in INTERNAL_PASSWORD_PLUGINS:
                raise ValueError("Only the first authentication factor can use a password plugin")
        has_random_password = index == 0 and options.randomPassword
        is_passwordless_webauthn = (
            index == 0
            and len(options.authenticationFactors) == 1
            and plugin == "authentication_webauthn"
        )
        if (
            index == 0
            and (factor.password is not None or has_random_password)
            and plugin not in INTERNAL_PASSWORD_PLUGINS
            and not is_passwordless_webauthn
        ):
            raise ValueError(
                f"Authentication plugin {plugin} does not support password credentials"
            )
        if sum((factor.password is not None, factor.authenticationString is not None, has_random_password)) > 1:
            raise ValueError("An authentication factor can have only one credential")

        clause = f"{'AND ' if index else ''}IDENTIFIED WITH {plugin}"
        if is_passwordless_webauthn:
            if factor.password:
                clause = f"{clause} INITIAL AUTHENTICATION IDENTIFIED BY /*((*/ ? /*))*/"
                params.append(factor.password)
            elif has_random_password:
                clause = f"{clause} INITIAL AUTHENTICATION IDENTIFIED BY RANDOM PASSWORD"
            else:
                raise ValueError(
                    "Passwordless WebAuthn requires an initial authentication password"
                )
        elif factor.password is not None:
            clause = f"{clause} BY /*((*/ ? /*))*/"
            params.append(factor.password)
        elif factor.authenticationString is not None:
            clause = f"{clause} AS ?"
            params.append(factor.authenticationString)
        elif has_random_password:
            clause = f"{clause} BY RANDOM PASSWORD"
        query_parts.append(clause)

    _append_tls_options(query_parts, params, options)
    _append_resource_options(query_parts, params, options)
    _append_password_options(query_parts, params, options)

    if options.accountLocked is not None:
        query_parts.append(
            "ACCOUNT LOCK" if options.accountLocked else "ACCOUNT UNLOCK"
        )

    if options.comment is not None:
        query_parts.append("COMMENT ?")
        params.append(options.comment)

    full_sql = "\n    ".join(query_parts)

    result = session.run_sql(full_sql, params)
    if result is None:
        return None

    row = result.fetch_one_object()
    return row.get("generated password") if row is not None else None


def delete_mysql_user(session: DbSession, user: str, host: str) -> None:
    """Delete a MySQL user with the specified username and host"""
    session.run_sql("DROP USER ?@?", [user, host])


def update_mysql_user(session: DbSession, options: MySQLUser) -> Optional[str]:
    """Update user details"""
    if options.randomPassword and not options.authenticationFactors:
        raise ValueError("Random password generation requires authentication factors")

    query_parts = ["ALTER USER ?@?"]

    params = [options.user, options.host]
    modified_factors = []
    added_factors = []
    dropped_factors = []
    current_factors = []
    shifted_factor_removal = False
    random_password_clause = None
    deferred_password_clause = None
    pre_first_factor_modifications = []
    if options.authenticationFactors:
        if len(options.authenticationFactors) > 3:
            raise ValueError("A user cannot have more than three authentication factors")

        used_plugins = set()
        for index, factor in enumerate(options.authenticationFactors):
            if not isinstance(factor, AuthenticationFactor):
                raise ValueError("Invalid authentication factor")
            plugin = _require_authentication_plugin(factor.plugin)
            if plugin in used_plugins:
                raise ValueError("Cannot use same method for more than one factor")
            used_plugins.add(plugin)
            if index > 0:
                if factor.password is not None:
                    raise ValueError("Only the first authentication factor can use a password")
                if plugin in INTERNAL_PASSWORD_PLUGINS:
                    raise ValueError("Only the first authentication factor can use a password plugin")
            has_random_password = index == 0 and bool(options.randomPassword)
            if (
                index == 0
                and (factor.password is not None or has_random_password)
                and plugin not in INTERNAL_PASSWORD_PLUGINS
            ):
                raise ValueError(
                    f"Authentication plugin {plugin} does not support password credentials"
                )
            if sum((factor.password is not None, factor.authenticationString is not None, has_random_password)) > 1:
                raise ValueError("An authentication factor can have only one credential")

        if (
            len(options.authenticationFactors) == 1
            and options.authenticationFactors[0].plugin == "authentication_webauthn"
        ):
            raise ValueError("A passwordless WebAuthn account can only be created")

        current_user = get_mysql_user(session, options.user, options.host)
        if current_user is None:
            raise ValueError("The user account does not exist")
        current_factors = current_user.authenticationFactors
        current_factor_plugins = [factor.plugin for factor in current_factors]

        for index, factor in enumerate(options.authenticationFactors):
            if factor.plugin == "mysql_no_login" and (
                index >= len(current_factors)
                or current_factors[index].plugin != "mysql_no_login"
            ):
                raise ValueError("mysql_no_login can only be selected when creating an account")

        first_factor = options.authenticationFactors[0]
        current_first_factor = current_factors[0] if current_factors else None
        first_factor_changed = (
            current_first_factor is None
            or first_factor.plugin != current_first_factor.plugin
            or first_factor.password is not None
            or options.randomPassword
            or (
                not first_factor.plugin.endswith("_password")
                and not (
                    first_factor.plugin == "authentication_webauthn"
                    and first_factor.authenticationString is None
                )
                and first_factor.authenticationString != current_first_factor.authenticationString
            )
        )
        if (
            current_first_factor is not None
            and first_factor.plugin != current_first_factor.plugin
            and first_factor.plugin in INTERNAL_PASSWORD_PLUGINS
            and not first_factor.password
            and not options.randomPassword
        ):
            raise ValueError(
                "Changing to a password authentication plugin requires a password or random password"
            )
        shifted_factor_removal = (
            len(current_factors) == 3
            and len(options.authenticationFactors) == 2
            and options.authenticationFactors[1].plugin == current_factors[2].plugin
        )
        comparison_factors = current_factors
        comparison_factor_indexes = list(range(len(current_factors)))
        if shifted_factor_removal:
            comparison_factors = [current_factors[0], current_factors[2]]
            comparison_factor_indexes = [0, 2]

        common_factor_count = min(len(comparison_factors), len(options.authenticationFactors))
        for index in range(1, common_factor_count):
            current_factor = comparison_factors[index]
            desired_factor = options.authenticationFactors[index]
            if (
                desired_factor.plugin != current_factor.plugin
                or (
                    not desired_factor.plugin.endswith("_password")
                    and not (
                        desired_factor.plugin == "authentication_webauthn"
                        and desired_factor.authenticationString is None
                    )
                    and desired_factor.authenticationString != current_factor.authenticationString
                )
            ):
                modified_factors.append((comparison_factor_indexes[index], desired_factor))

        added_factors = list(range(max(len(comparison_factors), 1), len(options.authenticationFactors)))
        dropped_factors = list(range(len(options.authenticationFactors), len(comparison_factors)))

        # These changes require separate ALTER USER statements. A rejected password
        # must not leave the account with fewer authentication factors.
        if (dropped_factors or shifted_factor_removal) and (
            first_factor.password is not None or options.randomPassword
        ):
            raise ValueError(
                "Change and apply the password before removing authentication factors."
            )

        if first_factor_changed:
            occupied_factor = next(
                (
                    index
                    for index, plugin in enumerate(current_factor_plugins[1:], 1)
                    if plugin == first_factor.plugin
                ),
                None,
            )
            if occupied_factor is not None:
                modified_factor = next(
                    (
                        factor
                        for factor in modified_factors
                        if factor[0] == occupied_factor
                    ),
                    None,
                )
                if modified_factor is None:
                    raise ValueError(
                        "Cannot promote an authentication factor that is being removed. "
                        "Change the later factor first."
                    )
                modified_factors.remove(modified_factor)
                pre_first_factor_modifications.append(
                    (*modified_factor, current_factors[occupied_factor])
                )

        if first_factor_changed:
            auth_option_clause = f"IDENTIFIED WITH {_require_authentication_plugin(first_factor.plugin)}"
            if first_factor.password is not None:
                auth_option_clause += " BY /*((*/ ? /*))*/"
                if modified_factors or added_factors or dropped_factors or shifted_factor_removal:
                    deferred_password_clause = auth_option_clause
                else:
                    query_parts.append(auth_option_clause)
                    params.append(first_factor.password)
            elif options.randomPassword:
                auth_option_clause += " BY RANDOM PASSWORD"
                random_password_clause = auth_option_clause
            else:
                if first_factor.authenticationString is not None:
                    auth_option_clause += " AS ?"
                    params.append(first_factor.authenticationString)
                query_parts.append(auth_option_clause)

    _append_tls_options(query_parts, params, options)
    _append_resource_options(query_parts, params, options)
    _append_password_options(
        query_parts,
        params,
        options,
        include_password_require_current_optional=True,
        include_password_expire=(
            random_password_clause is None and deferred_password_clause is None
        ),
    )

    if options.accountLocked is not None:
        query_parts.append(
            "ACCOUNT LOCK" if options.accountLocked else "ACCOUNT UNLOCK"
        )

    if options.comment is not None:
        query_parts.append("COMMENT ?")
        params.append(options.comment)

    full_sql = "\n    ".join(query_parts)

    if pre_first_factor_modifications:
        clause = "ALTER USER ?@?"
        factor_params = [options.user, options.host]
        for index, factor, _ in pre_first_factor_modifications:
            clause += f" MODIFY {index + 1} FACTOR IDENTIFIED WITH {_require_authentication_plugin(factor.plugin)}"
            if factor.authenticationString is not None:
                clause += " AS ?"
                factor_params.append(factor.authenticationString)
        session.run_sql(clause, factor_params)

    try:
        result = session.run_sql(full_sql, params)
    except Exception:
        if pre_first_factor_modifications:
            clause = "ALTER USER ?@?"
            factor_params = [options.user, options.host]
            for index, _, previous_factor in pre_first_factor_modifications:
                clause += (
                    f" MODIFY {index + 1} FACTOR IDENTIFIED WITH "
                    f"{_require_authentication_plugin(previous_factor.plugin)}"
                )
                if previous_factor.authenticationString is not None:
                    clause += " AS ?"
                    factor_params.append(previous_factor.authenticationString)
            session.run_sql(clause, factor_params)
        raise

    if modified_factors:
        clause = "ALTER USER ?@?"
        factor_params = [options.user, options.host]
        for index, factor in modified_factors:
            clause += f" MODIFY {index + 1} FACTOR IDENTIFIED WITH {_require_authentication_plugin(factor.plugin)}"
            if factor.authenticationString is not None:
                clause += " AS ?"
                factor_params.append(factor.authenticationString)
        session.run_sql(clause, factor_params)

    if shifted_factor_removal:
        session.run_sql("ALTER USER ?@? DROP 2 FACTOR", [options.user, options.host])

    if added_factors:
        clause = "ALTER USER ?@?"
        factor_params = [options.user, options.host]
        for index in added_factors:
            factor = options.authenticationFactors[index]
            clause += f" ADD {index + 1} FACTOR IDENTIFIED WITH {_require_authentication_plugin(factor.plugin)}"
            if factor.authenticationString is not None:
                clause += " AS ?"
                factor_params.append(factor.authenticationString)
        session.run_sql(clause, factor_params)

    if dropped_factors:
        clause = "ALTER USER ?@?" + "".join(
            f" DROP {index + 1} FACTOR" for index in dropped_factors
        )
        session.run_sql(clause, [options.user, options.host])

    if deferred_password_clause is not None:
        if options.passwordExpire:
            deferred_password_clause += " PASSWORD EXPIRE"
        session.run_sql(
            f"ALTER USER ?@? {deferred_password_clause}",
            [options.user, options.host, first_factor.password],
        )
    elif random_password_clause is not None:
        if options.passwordExpire:
            random_password_clause += " PASSWORD EXPIRE"
        result = session.run_sql(
            f"ALTER USER ?@? {random_password_clause}",
            [options.user, options.host],
        )

    if result is None:
        return None

    row = result.fetch_one_object()
    return row.get("generated password") if row is not None else None
