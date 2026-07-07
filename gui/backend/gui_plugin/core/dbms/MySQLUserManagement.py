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
# separately licensed software that they have either included with the
# program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Iterable


_GRANT_TARGET_PATTERN = re.compile(
    r"^(?:\*\.\*|`(?:``|[^`])+`\.(?:\*|`(?:``|[^`])+`))$"
)
_PRIVILEGE_PATTERN = re.compile(r"^[A-Z][A-Z0-9_ ]*$")
_GRANT_PATTERN = re.compile(r"^GRANT (?P<privileges>.+) ON (?P<target>.+) TO ", re.IGNORECASE)
_DYNAMIC_PRIVILEGES = {"BACKUP_ADMIN", "SYSTEM_VARIABLES_ADMIN"}
_ROLE_ACCOUNT_PATTERN = re.compile(
    r"^\s*(?P<user>(?:`(?:``|[^`])+`|'(?:\\.|[^'])+'|[^@,\s]+))"
    r"(?:\s*@\s*(?P<host>(?:`(?:``|[^`])+`|'(?:\\.|[^'])+'|[^,\s]+)))?\s*$"
)


@dataclass(frozen=True)
class MySQLGrantRequirement:
    target_quoted: str
    privileges: tuple[str, ...]


@dataclass(frozen=True)
class MySQLUserGrantValidation:
    missing_requirements: tuple[MySQLGrantRequirement, ...]

    @property
    def valid(self) -> bool:
        return not self.missing_requirements


def _normalize_privilege(privilege: str) -> str:
    return " ".join(privilege.strip().upper().split())


def _validate_requirements(requirements: Iterable[MySQLGrantRequirement]) -> None:
    for requirement in requirements:
        if _GRANT_TARGET_PATTERN.fullmatch(requirement.target_quoted) is None:
            raise ValueError(f"Invalid MySQL grant target: {requirement.target_quoted}")
        for privilege in requirement.privileges:
            normalized = _normalize_privilege(privilege)
            if _PRIVILEGE_PATTERN.fullmatch(normalized) is None:
                raise ValueError(f"Invalid MySQL privilege: {privilege}")


def available_mysql_privileges(session: Any) -> set[str]:
    result = session.run_sql("SHOW PRIVILEGES")
    rows = result.fetch_all()

    return {
        _normalize_privilege(str(row[0]))
        for row in rows
        if row and str(row[0]).strip()
    }


def _grant_target_covers(granted_target: str, required_target: str) -> bool:
    if granted_target == required_target or granted_target == "*.*":
        return True

    if not granted_target.endswith(".*") or not required_target.startswith("`"):
        return False

    return required_target.startswith(f"{granted_target[:-1]}`")


def _role_accounts(rows: Iterable[tuple[Any, ...]]) -> list[tuple[str, str]]:
    return [
        (str(row[0]), str(row[1]))
        for row in rows
        if len(row) >= 2 and row[0] is not None and row[1] is not None
    ]


def _unquote_role_account_part(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] == "`":
        return value[1:-1].replace("``", "`")
    if len(value) >= 2 and value[0] == value[-1] == "'":
        return value[1:-1].replace("\\'", "'").replace("\\\\", "\\").replace("''", "'")
    return value


def _split_mandatory_role_accounts(value: str) -> list[str]:
    roles: list[str] = []
    start = 0
    quote: str | None = None
    index = 0
    while index < len(value):
        character = value[index]
        if quote == "`" and character == "`":
            if index + 1 < len(value) and value[index + 1] == "`":
                index += 2
                continue
            quote = None
        elif quote == "'" and character == "'":
            if index + 1 < len(value) and value[index + 1] == "'":
                index += 2
                continue
            quote = None
        elif quote == "'" and character == "\\":
            index += 2
            continue
        elif quote is None:
            if character in {"`", "'"}:
                quote = character
            elif character == ",":
                roles.append(value[start:index])
                start = index + 1
        index += 1

    if quote is not None:
        raise ValueError("The mandatory_roles system variable contains an unterminated quoted role account")
    roles.append(value[start:])
    return roles


def _mandatory_role_accounts(value: Any) -> list[tuple[str, str]]:
    if not isinstance(value, str) or not value.strip() or value.strip().upper() == "NONE":
        return []

    roles: list[tuple[str, str]] = []
    for role in _split_mandatory_role_accounts(value):
        role_match = _ROLE_ACCOUNT_PATTERN.fullmatch(role)
        if role_match is None:
            raise ValueError("The mandatory_roles system variable contains an invalid role account")
        roles.append((
            _unquote_role_account_part(role_match.group("user")),
            _unquote_role_account_part(role_match.group("host") or "%"),
        ))
    return roles


def _system_variable_enabled(value: Any) -> bool:
    if isinstance(value, str):
        return value.strip().upper() in {"1", "ON"}
    return isinstance(value, int) and not isinstance(value, bool) and value != 0


def _effective_mysql_grants(session: Any, user: str, host: str) -> list[str]:
    variables_result = session.run_sql(
        "SHOW GLOBAL VARIABLES WHERE Variable_name IN "
        "('activate_all_roles_on_login', 'activate_mandatory_roles', 'mandatory_roles')"
    )
    variables = {
        str(row[0]).lower(): row[1]
        for row in variables_result.fetch_all()
        if len(row) >= 2 and row[0] is not None
    }
    activate_all_roles = _system_variable_enabled(variables.get("activate_all_roles_on_login"))
    activate_mandatory_roles = _system_variable_enabled(variables.get("activate_mandatory_roles"))
    if activate_all_roles:
        role_edges_result = session.run_sql(
            "SELECT FROM_USER, FROM_HOST FROM mysql.role_edges WHERE TO_USER = ? AND TO_HOST = ?",
            [user, host],
        )
        roles = _role_accounts(role_edges_result.fetch_all())
    else:
        roles_result = session.run_sql(
            "SELECT DEFAULT_ROLE_USER, DEFAULT_ROLE_HOST FROM mysql.default_roles WHERE USER = ? AND HOST = ?",
            [user, host],
        )
        roles = _role_accounts(roles_result.fetch_all())
    if activate_all_roles or activate_mandatory_roles:
        roles.extend(_mandatory_role_accounts(variables.get("mandatory_roles")))

    roles = list(dict.fromkeys(roles))
    statement = "SHOW GRANTS FOR !@!"
    params = [user, host]
    if roles:
        statement += " USING " + ", ".join("!@!" for _ in roles)
        params.extend(part for role in roles for part in role)
    result = session.run_sql(statement, params)

    return [str(row[0]) for row in result.fetch_all() if row and row[0] is not None]


def validate_mysql_user_grants(
    session: Any,
    user: str,
    host: str,
    requirements: Iterable[MySQLGrantRequirement],
) -> MySQLUserGrantValidation:
    """Validates required supported privileges against an account's effective grants."""
    requested = list(requirements)
    _validate_requirements(requested)
    available = available_mysql_privileges(session)
    granted: dict[str, set[str]] = {}
    all_privileges: set[str] = set()
    for grant in _effective_mysql_grants(session, user, host):
        grant_match = _GRANT_PATTERN.match(grant.strip())
        if grant_match is None:
            continue
        target = grant_match.group("target").strip()
        privileges = {
            _normalize_privilege(privilege)
            for privilege in grant_match.group("privileges").split(",")
        }
        if "ALL" in privileges or "ALL PRIVILEGES" in privileges:
            all_privileges.add(target)
        granted.setdefault(target, set()).update(privileges)

    missing: list[MySQLGrantRequirement] = []
    for requirement in requested:
        matching_targets = [
            target for target in granted
            if _grant_target_covers(target, requirement.target_quoted)
        ]
        required = tuple(
            privilege for privilege in (_normalize_privilege(value) for value in requirement.privileges)
            if privilege in available
        )
        missing_privileges = tuple(
            privilege for privilege in required
            if not any(privilege in granted[target] for target in matching_targets)
            and not (
                any(target in all_privileges for target in matching_targets)
                and privilege not in _DYNAMIC_PRIVILEGES
            )
        )
        if missing_privileges:
            missing.append(MySQLGrantRequirement(requirement.target_quoted, missing_privileges))

    return MySQLUserGrantValidation(tuple(missing))


def missing_mysql_user_privileges(
    session: Any,
    user: str,
    host: str,
    requirements: Iterable[MySQLGrantRequirement],
) -> list[MySQLGrantRequirement]:
    """Returns required supported privileges missing from an account's effective grants."""
    return list(validate_mysql_user_grants(session, user, host, requirements).missing_requirements)


def create_mysql_user(
    session: Any,
    user: str,
    host: str,
    password: str,
) -> None:
    session.run_sql(
        "CREATE USER ?@? IDENTIFIED BY ?",
        [user, host, password],
    )


def reset_mysql_user_password(
    session: Any,
    user: str,
    host: str,
    password: str,
) -> None:
    session.run_sql(
        "ALTER USER ?@? IDENTIFIED BY ?",
        [user, host, password],
    )


def reset_mysql_user_query_limit(session: Any, user: str, host: str) -> None:
    session.run_sql(
        "ALTER USER ?@? WITH MAX_QUERIES_PER_HOUR 0",
        [user, host],
    )


def grant_mysql_user_privileges(
    session: Any,
    user: str,
    host: str,
    requirements: Iterable[MySQLGrantRequirement],
) -> list[MySQLGrantRequirement]:
    requested = list(requirements)
    _validate_requirements(requested)
    available = available_mysql_privileges(session)
    granted: list[MySQLGrantRequirement] = []

    for requirement in requested:
        requested_privileges = tuple(
            _normalize_privilege(privilege) for privilege in requirement.privileges
        )
        privileges = tuple(
            privilege for privilege in requested_privileges if privilege in available
        )
        if not privileges:
            continue

        session.run_sql(
            "GRANT %s ON %s TO ?@?"
            % (", ".join(privileges), requirement.target_quoted),
            [user, host],
        )
        granted.append(MySQLGrantRequirement(requirement.target_quoted, privileges))

    return granted
