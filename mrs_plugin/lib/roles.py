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

from mrs_plugin.lib import core, schemas, db_objects
from mrs_plugin.lib.MrsDdlExecutor import MrsDdlExecutor

FULL_ACCESS_ROLE_ID = bytes.fromhex("31000000000000000000000000000000")

k_role_query = """
    SELECT r.id, r.derived_from_role_id, pr.caption derived_from_role_caption,
            r.specific_to_service_id,
            CONCAT(h.name, s.url_context_root) AS specific_to_service_request_path,
            r.caption, r.description, r.options
        FROM `mysql_rest_service_metadata`.mrs_role r
        LEFT JOIN `mysql_rest_service_metadata`.mrs_role pr
            ON r.derived_from_role_id = pr.id
        LEFT JOIN `mysql_rest_service_metadata`.service s
            ON r.specific_to_service_id = s.id
        LEFT JOIN `mysql_rest_service_metadata`.url_host h
            ON s.url_host_id = h.id"""

k_privilege_query = """
    SELECT p.id, p.role_id, r.caption as role_name, p.crud_operations,
        p.service_id, CONCAT(h.name, svc.url_context_root) AS full_service_path,
        p.db_schema_id, s.request_path as schema_path,
        p.db_object_id, o.request_path as object_path
        FROM `mysql_rest_service_metadata`.mrs_privilege p
        JOIN `mysql_rest_service_metadata`.mrs_role r ON p.role_id = r.id
        LEFT JOIN `mysql_rest_service_metadata`.service svc ON p.service_id = svc.id
        LEFT JOIN `mysql_rest_service_metadata`.url_host h ON svc.url_host_id = h.id
        LEFT JOIN `mysql_rest_service_metadata`.db_schema s ON p.db_schema_id = s.id
        LEFT JOIN `mysql_rest_service_metadata`.db_object o ON p.db_object_id = o.id
    """

k_privilege_query_3_0_1 = """
    SELECT p.id, p.role_id, r.caption as role_name, p.crud_operations,
        p.service_id,
        CONCAT(h.name, p.service_path) AS full_service_path,
        p.schema_path as schema_path,
        p.object_path as object_path
        FROM `mysql_rest_service_metadata`.mrs_privilege p
        JOIN `mysql_rest_service_metadata`.mrs_role r ON p.role_id = r.id
        LEFT JOIN `mysql_rest_service_metadata`.service svc ON p.service_id = svc.id
        LEFT JOIN `mysql_rest_service_metadata`.url_host h ON svc.url_host_id = h.id
    """

k_granted_roles_query = """
    SELECT r.id, r.derived_from_role_id, pr.caption derived_from_role_caption,
            r.specific_to_service_id,
            CONCAT(h.name, s.url_context_root) AS specific_to_service_request_path,
            r.caption, r.description, r.options/*end_columns*/
        FROM `mysql_rest_service_metadata`.mrs_role r
        JOIN `mysql_rest_service_metadata`.`mrs_user_has_role` ur
            ON ur.role_id = r.id
        LEFT JOIN `mysql_rest_service_metadata`.`mrs_user` u
            ON u.id = ur.user_id
        LEFT JOIN `mysql_rest_service_metadata`.`auth_app` a
            ON a.id = u.auth_app_id
        LEFT JOIN `mysql_rest_service_metadata`.service s
            ON r.specific_to_service_id = s.id
        LEFT JOIN `mysql_rest_service_metadata`.url_host h
            ON s.url_host_id = h.id
        LEFT JOIN `mysql_rest_service_metadata`.mrs_role pr
            ON r.derived_from_role_id = pr.id
    """


def get_roles(session, specific_to_service_id=None):
    sql = k_role_query
    params = []
    if specific_to_service_id:
        sql += " WHERE r.specific_to_service_id IS NULL OR r.specific_to_service_id = ?"
        params.append(specific_to_service_id)
    return core.MrsDbExec(sql, params).exec(session).items


def get_granted_roles(
    session,
    specific_to_service_id=None,
    user_name=None,
    auth_app_name=None,
    include_users=False,
):
    sql = k_granted_roles_query
    if include_users:
        sql = sql.replace(
            "/*end_columns*/", ", group_concat(concat(u.name, '@', a.name)) as users"
        )
    params = []
    where = []
    if specific_to_service_id:
        where.append(
            "(r.specific_to_service_id IS NULL OR r.specific_to_service_id = ?)"
        )
        params.append(specific_to_service_id)
    if user_name:
        where.append("u.name = ?")
        params.append(user_name)
    if auth_app_name:
        where.append("a.name = ?")
        params.append(auth_app_name)
    if where:
        sql += " WHERE " + " AND ".join(where)
    if include_users:
        sql += " GROUP BY r.id"
    return core.MrsDbExec(sql, params).exec(session).items


def get_role(session, role_id=None, specific_to_service_id=None, caption=None):
    # If a role_id is given, look that one up
    if role_id is not None:
        sql = k_role_query + " WHERE r.id = ?"

        return core.MrsDbExec(sql, [role_id]).exec(session).first

    if caption is not None:
        sql = k_role_query + " WHERE r.caption = ?"
        params = [caption]
        if specific_to_service_id:
            sql += " AND (r.specific_to_service_id IS NULL OR r.specific_to_service_id = ?)"
            params.append(specific_to_service_id)

        return core.MrsDbExec(sql, params).exec(session).first

    return None


def add_role(
    session,
    derived_from_role_id,
    specific_to_service_id,
    caption,
    description,
    options={},
):
    sql = """
    INSERT INTO `mysql_rest_service_metadata`.mrs_role
        (id, derived_from_role_id, specific_to_service_id, caption, description, options)
    VALUES
        (?, ?, ?, ?, ?, ?)
    """

    id = core.get_sequence_id(session)

    params = [
        id,
        derived_from_role_id,
        specific_to_service_id,
        caption,
        description,
        options,
    ]

    try:
        core.MrsDbExec(sql, params).exec(session)
    except Exception as e:
        if str(e).startswith("MySQL Error (1062)"):
            raise Exception(
                f"DUPLICATION ERROR: The REST role `{caption}` has already been defined for the given service. "
                "Use the SHOW REST ROLES; command to display all existing roles.")
        raise

    return id


def delete_role(session, role_id):
    sql = """
    DELETE FROM `mysql_rest_service_metadata`.mrs_role
    WHERE id = ?
    """

    try:
        core.MrsDbExec(sql, [role_id]).exec(session)
    except Exception as e:
        if str(e).startswith("MySQL Error (1451)"):
            raise Exception(
                "REFERENCE ERROR: This role is referenced by other roles. Please drop those roles first. "
                "Use the SHOW REST ROLES; command to display all existing roles.")
        raise


def get_role_privileges(session,
                        role_id=None,
                        service_path=core.NotSet,
                        schema_path=core.NotSet,
                        object_path=core.NotSet):
    md_version = core.get_mrs_schema_version_int(session)
    if md_version and md_version < 30001:
        sql = k_privilege_query + " WHERE p.role_id=?"
    else:
        sql = k_privilege_query_3_0_1 + " WHERE p.role_id=?"
    conds = []
    args = [role_id]
    if service_path is not core.NotSet:
        conds.append(f" AND service_path {'=' if service_path else 'IS'} ?")
        args.append(service_path)
    if schema_path is not core.NotSet:
        conds.append(f" AND schema_path {'=' if schema_path else 'IS'} ?")
        args.append(schema_path)
    if object_path is not core.NotSet:
        conds.append(f" AND object_path {'=' if object_path else 'IS'} ?")
        args.append(object_path)
    sql += "".join(conds)
    return core.MrsDbExec(sql, args).exec(session).items


def get_role_privilege(session, privilege_id=None):
    md_version = core.get_mrs_schema_version_int(session)
    if md_version and md_version < 30001:
        sql = k_privilege_query + " WHERE p.id=?"
    else:
        sql = k_privilege_query_3_0_1 + " WHERE p.id=?"
    return core.MrsDbExec(sql, [privilege_id]).exec(session).first

def add_role_privilege(
    session,
    role_id,
    privileges,
    service_id=None,
    service_path=None,
    schema_path=None,
    object_path=None,
):
    md_version = core.get_mrs_schema_version_int(session)

    wildcards_allowed = md_version >= 30001

    privs = get_role_privileges(session,
        role_id=role_id,
        service_path=service_path,
        schema_path=schema_path,
        object_path=object_path)
    if privs:
        priv = privs[0]
        # add grants to existing privilege
        new_privileges = ",".join(set(priv["crud_operations"]) | set(privileges))

        sql = """
        UPDATE `mysql_rest_service_metadata`.mrs_privilege
            SET crud_operations=? WHERE id=?
        """
        params = [new_privileges, priv["id"]]
        core.MrsDbExec(sql, params).exec(session)
        return priv["id"]

    # NOTE: eventually service_id, db_schema_id and db_object_id will be removed from the DB,
    # but for now we must set them for backwards compatibility
    schema_id = None
    if schema_path:
        if not wildcards_allowed or not core.contains_wildcards(schema_path):
            assert service_id
            schema = schemas.get_schema(
                service_id=service_id,
                request_path=schema_path,
                session=session,
            )
            if schema:
                schema_id = schema.get("id")
            else:
                raise Exception(f"Schema `{schema_path}` was not found.")

    object_id = None
    if object_path:
        if not wildcards_allowed or not core.contains_wildcards(object_path):
            if not schema_id:
                raise Exception(f"The schema for `{object_path}` must be specified")

            object = db_objects.get_db_object(
                session=session,
                schema_id=schema_id,
                request_path=object_path,
            )
            if object:
                object_id = object.get("id")
            else:
                raise Exception(f"Object `{object_path}` was not found.")

    id = core.get_sequence_id(session)

    if md_version < 30001:
        sql = """
        INSERT INTO `mysql_rest_service_metadata`.mrs_privilege
            (id, role_id, crud_operations, service_id, db_schema_id, db_object_id)
        VALUES
            (?, ?, ?, ?, ?, ?)
        """
        params = [
            id,
            role_id,
            ",".join(privileges),
            service_id,
            schema_id,
            object_id,
        ]
    else:
        sql = """
        INSERT INTO `mysql_rest_service_metadata`.mrs_privilege
            (id, role_id, crud_operations, service_id, db_schema_id, db_object_id,
                service_path, schema_path, object_path)
        VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        params = [
            id,
            role_id,
            ",".join(privileges),
            service_id,
            schema_id,
            object_id,
            service_path,
            schema_path,
            object_path,
        ]

    core.MrsDbExec(sql, params).exec(session)

    return id


def delete_role_privilege(
    session,
    role_id,
    privileges,
    service_path=None,
    service_id=None,
    schema_path=None,
    db_schema_id=None,
    object_path=None,
    db_object_id=None,
):
    assert role_id and privileges

    md_version = core.get_mrs_schema_version_int(session)

    found = False
    privs = get_role_privileges(session, role_id=role_id)
    for priv in privs:
        if md_version >= 30001 and (not db_schema_id and not db_object_id):
            if not (
                (
                    priv.get("full_service_path") == service_path
                    or priv.get("service_id") == service_id
                )
                and priv.get("schema_path") == schema_path
                and priv.get("object_path") == object_path
            ):
                continue
        else:
            if not (
                priv.get("service_id") == service_id
                and priv.get("db_schema_id") == db_schema_id
                and priv.get("db_object_id") == db_object_id
            ):
                continue

        found = True

        needs_update = False
        operations = priv.get("crud_operations")
        for p in privileges:
            p = p.upper()
            if p in operations:
                operations.remove(p)
                needs_update = True

        if needs_update:
            params = []
            if not operations:
                sql = """
                DELETE FROM `mysql_rest_service_metadata`.mrs_privilege
                WHERE id = ?
                """
                params.append(priv.get("id"))
            else:
                sql = """
                UPDATE `mysql_rest_service_metadata`.mrs_privilege
                SET crud_operations = ?
                WHERE id = ?
                """
                params.append(",".join(operations))
                params.append(priv.get("id"))
            core.MrsDbExec(sql, params).exec(session)

    return found


def format_role_grant_statement(grant: dict) -> str:
    service = grant.get("full_service_path")
    schema = grant.get("schema_path")
    object = grant.get("object_path")

    where = []
    if service:
        if core.contains_wildcards(service):
            service = core.quote_str(service)
        where.append(f"SERVICE {service}")
    if schema:
        if core.contains_wildcards(schema):
            schema = core.quote_str(schema)
        where.append(f"SCHEMA {schema}")
    if object:
        if core.contains_wildcards(object):
            object = core.quote_str(object)
        where.append(f"OBJECT {object}")

    return f"""GRANT REST {",".join(grant.get("crud_operations"))} ON {" ".join(where)} TO {core.quote_str(grant.get('role_name'))}"""


def get_create_statement(session, role) -> str:
    executor = MrsDdlExecutor(
        session=session
    )

    executor.showCreateRestRole({
        "current_operation": "SHOW CREATE REST ROLE",
        **role
    })

    if executor.results[0]["type"] == "error":
        raise Exception(executor.results[0]['message'])

    return executor.results[0]["result"][0]["CREATE REST ROLE "]