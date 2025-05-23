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

from mrs_plugin.lib import core, services

FULL_ACCESS_ROLE_ID = bytes.fromhex("31000000000000000000000000000000")

k_role_query = """
    SELECT r.id, r.derived_from_role_id, pr.caption derived_from_role_caption,
            r.specific_to_service_id,
            CONCAT(h.name, s.url_context_root) AS specific_to_service_request_path,
            s.url_context_root specific_to_service,
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
        p.service_path, p.schema_path, p.object_path
        FROM `mysql_rest_service_metadata`.mrs_privilege p
        JOIN `mysql_rest_service_metadata`.mrs_role r ON p.role_id = r.id
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


def get_roles(session, specific_to_service_id=None, include_global=True):
    sql = k_role_query
    params = []
    if specific_to_service_id and include_global:
        sql += " WHERE r.specific_to_service_id = ? OR r.specific_to_service_id is NULL"
        params.append(specific_to_service_id)
    elif specific_to_service_id and not include_global:
        sql += " WHERE r.specific_to_service_id = ?"
        params.append(specific_to_service_id)
    else:
        if include_global:
            pass
        else:
            sql += " WHERE r.specific_to_service_id IS NOT NULL"

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


def get_role(
    session,
    role_id=None,
    specific_to_service_id=None,
    caption=None,
):
    # If a role_id is given, look that one up
    if role_id is not None:
        sql = k_role_query + " WHERE r.id = ?"

        return core.MrsDbExec(sql, [role_id]).exec(session).first

    if caption is not None:
        sql = k_role_query + " WHERE r.caption = ?"
        params = [caption]
        if specific_to_service_id is not None:
            sql += " AND r.specific_to_service_id = ?"
            params.append(specific_to_service_id)
        else:
            sql += " AND r.specific_to_service_id IS NULL"

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

    # workaround for no check on duplicate roles for any service
    if specific_to_service_id is None:
        role = get_role(caption=caption, session=session)
        if role:
            raise Exception(
                f"DUPLICATION ERROR: The REST role `{caption}` has already been defined for the given service. "
                "Use the SHOW REST ROLES; command to display all existing roles."
            )

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
                "Use the SHOW REST ROLES; command to display all existing roles."
            )
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
                "Use the SHOW REST ROLES; command to display all existing roles."
            )
        raise


def get_role_privileges(
    session,
    role_id=None,
    service_path=core.NotSet,
    schema_path=core.NotSet,
    object_path=core.NotSet,
):
    md_version = core.get_mrs_schema_version_int(session)
    if md_version < 40000:
        raise Exception("MRS metadata version must be 4.0.0 or newer")

    sql = k_privilege_query + " WHERE p.role_id=?"
    conds = []
    args = [role_id]
    if service_path is not core.NotSet:
        conds.append(f" AND service_path = ?")
        args.append(service_path)
    if schema_path is not core.NotSet:
        conds.append(f" AND schema_path = ?")
        args.append(schema_path)
    if object_path is not core.NotSet:
        conds.append(f" AND object_path = ?")
        args.append(object_path)
    sql += "".join(conds)
    return core.MrsDbExec(sql, args).exec(session).items


def get_role_privilege(session, privilege_id=None):
    sql = k_privilege_query + " WHERE p.id=?"
    return core.MrsDbExec(sql, [privilege_id]).exec(session).first


def add_role_privilege(
    session, role_id, privileges, service_path=None, schema_path=None, object_path=None
):
    md_version = core.get_mrs_schema_version_int(session)
    if md_version < 40000:
        raise Exception("MRS metadata version must be 4.0.0 or newer")

    privs = get_role_privileges(
        session,
        role_id=role_id,
        service_path=service_path,
        schema_path=schema_path,
        object_path=object_path,
    )
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

    id = core.get_sequence_id(session)

    sql = """
    INSERT INTO `mysql_rest_service_metadata`.mrs_privilege
        (id, role_id, crud_operations,
            service_path, schema_path, object_path)
    VALUES
        (?, ?, ?, ?, ?, ?)
    """
    params = [
        id,
        role_id,
        ",".join(privileges),
        service_path or "",
        schema_path or "",
        object_path or "",
    ]

    core.MrsDbExec(sql, params).exec(session)

    return id


def delete_role_privilege(
    session,
    role_id,
    privileges,
    service_path=None,
    schema_path=None,
    object_path=None,
):
    assert role_id and privileges

    md_version = core.get_mrs_schema_version_int(session)
    if md_version < 40000:
        raise Exception("MRS metadata version must be 4.0.0 or newer")

    found = False
    privs = get_role_privileges(session, role_id=role_id)
    for priv in privs:
        if (
            priv.get("service_path") != service_path
            or priv.get("schema_path") != schema_path
            or priv.get("object_path") != object_path
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


def format_role_grant_statement(grant: dict, role: dict) -> str:
    service = grant.get("service_path")
    schema = grant.get("schema_path")
    object = grant.get("object_path")

    where = []
    if service is not None:
        # need to break the full service path to host/service
        if service.startswith("/") or service == "*":
            url_host_name = ""
            url_context_root = service
        else:
            url_host_name, sep, url_context_root = service.partition("/")
            url_context_root = sep + url_context_root
        url_context_root = core.quote_rpath(url_context_root)
        if url_host_name:
            url_host_name = core.quote_str(url_host_name)
            where.append(f"SERVICE {url_host_name} {url_context_root}")
        else:
            where.append(f"SERVICE {url_context_root}")
    if schema is not None:
        schema = core.quote_rpath(schema)
        where.append(f"SCHEMA {schema}")
    if object is not None:
        object = core.quote_rpath(object)
        where.append(f"OBJECT {object}")

    if role["specific_to_service"] is not None:
        role_service = f"ON SERVICE {core.quote_rpath(role['specific_to_service'])}"
    else:
        role_service = f"ON ANY SERVICE"

    return f"""GRANT REST {",".join(grant.get("crud_operations"))} ON {" ".join(where)} TO {core.quote_role(grant.get('role_name'))} {role_service}"""


def get_role_create_statement(session, role) -> str:
    output = []
    stmt = f'CREATE REST ROLE {core.quote_role(role["caption"])}'
    if role["derived_from_role_caption"] is not None:
        stmt += f' EXTENDS {core.quote_role(role["derived_from_role_caption"])}'

    if role["specific_to_service_id"] is not None:
        service = services.get_service(
            session, service_id=role["specific_to_service_id"]
        )

        # if service is None:
        #     raise Exception(
        #         "The service, which this role is specific to, does not exist.")

        stmt += f" ON SERVICE {service['full_service_path']}"
    else:
        stmt += f" ON ANY SERVICE"

    output.append(stmt)

    if role.get("description") is not None:
        output.append(f'    COMMENT {core.quote_text(role["description"])}')

    if role.get("options"):
        output.append(core.format_json_entry("OPTIONS", role["options"]))

    return "\n".join(output) + ";"
