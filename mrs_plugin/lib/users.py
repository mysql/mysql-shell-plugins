# Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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

from mrs_plugin.lib import core, auth_apps, roles
import hashlib
import hmac
import base64
import os
import re

MRS_VENDOR_ID = bytes.fromhex("30000000000000000000000000000000")
STORED_PASSWORD_STRING = "[Stored Password]"


def password_requires_cypher(session, auth_app_id):
    auth_app = auth_apps.get_auth_app(session, auth_app_id)

    if not auth_app:
        raise RuntimeError("The auth_app was not found")

    return auth_app["auth_vendor_id"] == MRS_VENDOR_ID


def cypher_auth_string(auth_string) -> bytes:
    iterations = 5000
    salt = os.urandom(20)
    hash = hashlib.pbkdf2_hmac("sha256", auth_string.encode(), salt, iterations)
    client_key = hmac.HMAC(hash, b"Client Key", digestmod=hashlib.sha256).digest()

    m = hashlib.sha256()
    m.update(client_key)
    stored_key = m.digest()

    parts = [
        "A",
        f"{int(iterations/1000):03}",
        base64.b64encode(salt).decode(),
        base64.b64encode(stored_key).decode(),
    ]

    return "$" + "$".join(parts)


def get_users(
    session,
    service_id=None,
    auth_app_id=None,
    auth_app_name=None,
    user_id=None,
    mask_password=True,
    user_name=None,
):
    # Get current version of metadata schema
    current_version = core.get_mrs_schema_version(session)

    wheres = []
    params = []
    if user_id:
        wheres.append("user.id = ?")
        params.append(user_id)
    # Use different handling for 2.x.x
    if current_version[0] <= 2:
        sql = f"""
            SELECT  user.id, user.auth_app_id, user.name, user.email,
                    user.vendor_user_id, user.login_permitted,
                    user.mapped_user_id, user.app_options,
                    {f'"{STORED_PASSWORD_STRING}" as auth_string' if mask_password else "user.auth_string"},
                    app.name auth_app_name
                FROM `mysql_rest_service_metadata`.`mrs_user` as user
                JOIN `mysql_rest_service_metadata`.`auth_app` as app
                    ON app.id = user.auth_app_id
                JOIN `mysql_rest_service_metadata`.`service` as service
                    ON app.service_id = service.id
        """
        if auth_app_id:
            wheres.append("auth_app_id = ?")
            params.append(auth_app_id)
        if service_id:
            wheres.append("service_id = ?")
            params.append(service_id)
    else:
        sql = f"""
            SELECT  user.id, user.auth_app_id, user.name, user.email,
                    user.vendor_user_id, user.login_permitted,
                    user.mapped_user_id, user.app_options, user.options,
                    {f'"{STORED_PASSWORD_STRING}" as auth_string' if mask_password else "user.auth_string"},
                    app.name auth_app_name
                FROM `mysql_rest_service_metadata`.`mrs_user` as user
                JOIN `mysql_rest_service_metadata`.`auth_app` as app
                    ON app.id = user.auth_app_id
        """
        if auth_app_id:
            wheres.append("user.auth_app_id = ?")
            params.append(auth_app_id)
        if auth_app_name:
            wheres.append("app.name = ?")
            params.append(auth_app_name)

    if user_id:
        wheres.append("user.id = ?")
        params.append(user_id)

    if user_name:
        wheres.append("user.name = ?")
        params.append(user_name)

    sql += core._generate_where(wheres)

    return core.MrsDbExec(sql, params).exec(session).items


def get_users_by_service(session, service_id, mask_password=True):
    return get_users(session, service_id=service_id, mask_password=mask_password)


def get_users_by_auth_app(session, auth_app_id, mask_password=True):
    return get_users(session, auth_app_id=auth_app_id, mask_password=mask_password)


def get_user(
    session,
    user_id=None,
    user_name=None,
    service_id=None,
    auth_app_id=None,
    auth_app_name=None,
    mask_password=True,
):
    if not user_id and not service_id and not auth_app_id and not auth_app_name:
        raise ValueError("One of user_id or service_id or auth_app_id or auth_app_name is required")

    result = get_users(
        session,
        user_id=user_id,
        service_id=service_id,
        user_name=user_name,
        auth_app_id=auth_app_id,
        auth_app_name=auth_app_name,
        mask_password=mask_password,
    )
    if not result:
        return None
    assert len(result)==1
    return result[0]


def password_strength_valid(auth_string: str) -> bool:
    if not any(c.isupper() for c in auth_string):
        return False
    if not any(c.islower() for c in auth_string):
        return False
    if not any(c.isdigit() for c in auth_string):
        return False
    if not any(c in '!#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~' for c in auth_string):
        return False

    return True


def add_user(
    session,
    auth_app_id,
    name,
    email,
    vendor_user_id,
    login_permitted,
    mapped_user_id,
    options,
    app_options,
    auth_string,
):

    if password_requires_cypher(session, auth_app_id):
        if not auth_string:
            raise ValueError("The authentication string is required for this app.")
        if len(auth_string) < 8:
            raise ValueError("The minimum authentication string length is 8 characters.")
        if not password_strength_valid(auth_string):
            raise ValueError(
                "The authentication string needs to contain at least "
                "one uppercase, lowercase, a special and a numeric character.")
        auth_string = cypher_auth_string(auth_string)
    else:
        if auth_string is not None:
            raise ValueError(
                "Password changing not supported for this authentication method"
            )

    sql = """
        INSERT INTO `mysql_rest_service_metadata`.`mrs_user`
            (id, auth_app_id, name, email, vendor_user_id,
            login_permitted, mapped_user_id, options, app_options,
            auth_string)
        VALUES(?,?,?,?,?,?,?,?,?,?)
    """

    id = core.get_sequence_id(session)
    params = [
        id,
        auth_app_id,
        name,
        email,
        vendor_user_id,
        login_permitted,
        mapped_user_id,
        options,
        app_options,
        auth_string,
    ]

    if not core.MrsDbExec(sql, params).exec(session).success:
        raise RuntimeError("Failed to insert the new user.")

    return id


def delete_users(session, user_id=None, auth_app_id=None):
    sql = """
    DELETE
    FROM `mysql_rest_service_metadata`.`mrs_user`
    """

    wheres = []
    params = []

    if user_id:
        wheres.append("id = ?")
        params.append(user_id)
    elif auth_app_id:
        wheres.append("auth_app_id = ?")
        params.append(auth_app_id)
    else:
        raise RuntimeError("The user_id or the auth_app_id must be supplied.")

    sql += core._generate_where(wheres)

    core.MrsDbExec(sql, params).exec(session)


def delete_user_by_id(session, user_id):
    delete_users(session, user_id=user_id)


def delete_users_by_auth_app(session, auth_app_id):
    delete_users(session, auth_app_id=auth_app_id)


def update_user(session, user_id, value: dict):
    if value.get("auth_string"):
        if password_requires_cypher(session, value["auth_app_id"]):
            auth_string = value.get("auth_string")
            if len(auth_string) < 8:
                raise ValueError(
                    "The minimum authentication string length is 8 characters.")
            if not password_strength_valid(auth_string):
                raise ValueError(
                    "The authentication string needs to contain at least "
                    "one uppercase, lowercase, a special and a numeric "
                    "character.")
            value["auth_string"] = cypher_auth_string(value["auth_string"])
        else:
            raise ValueError(
                "Password change not supported for the authentication method"
            )

    sets = []
    params = []

    for key, val in value.items():
        sets.append(f"{key} = ?")
        params.append(val)

    params.append(user_id)

    sql = f"""
        UPDATE `mysql_rest_service_metadata`.`mrs_user`
        SET {",".join(sets)}
        WHERE id = ?
    """

    core.MrsDbExec(sql, params).exec(session)


def get_user_roles(session, user_id):
    sql = """
    SELECT ur.user_id, ur.role_id, ur.comments, ur.options as user_role_options,
        r.derived_from_role_id, pr.caption derived_from_role_caption,
        r.specific_to_service_id,
        r.caption, r.description, r.options,
        s.url_context_root specific_to_service
    FROM `mysql_rest_service_metadata`.`mrs_user_has_role` ur
    JOIN `mysql_rest_service_metadata`.`mrs_role` r ON ur.role_id = r.id
    LEFT JOIN `mysql_rest_service_metadata`.mrs_role pr
            ON r.derived_from_role_id = pr.id
    LEFT JOIN `mysql_rest_service_metadata`.`service` s ON s.id = r.specific_to_service_id
    WHERE ur.user_id = (_binary ?)
    """
    return core.MrsDbExec(sql, [user_id]).exec(session).items


def add_user_role(session, user_id, role_id, comments):
    sql = """
    INSERT INTO `mysql_rest_service_metadata`.`mrs_user_has_role`
        (user_id, role_id, comments)
    VALUES
        (?, ?, ?)"""

    core.MrsDbExec(sql, [user_id, role_id, comments]).exec(session)


def delete_user_roles(session, user_id, role_id=None):
    sql = """
    DELETE FROM `mysql_rest_service_metadata`.`mrs_user_has_role`
    """
    wheres = ["user_id = ?"]
    params = [user_id]

    if role_id:
        wheres.append("role_id = ?")
        params.append(role_id)

    sql += core._generate_where(wheres)

    core.MrsDbExec(sql, params).exec(session)


def format_grant_statement(user: dict, role: dict) -> str:
    full_user_name = f'{core.quote_user(user["name"])}@{core.quote_auth_app(user["auth_app_name"])}'
    if role["specific_to_service_id"] is None:
        role_service = "ON ANY SERVICE"
    else:
        role_service = f"ON SERVICE {core.quote_rpath(role['specific_to_service'])}"
    grant = [f'GRANT REST ROLE {core.quote_role(role["caption"])} {role_service} TO {full_user_name}']

    if role["comments"] is not None:
        grant.append(f'    COMMENT {core.quote_text(role["comments"])}')
    if role["user_role_options"] is not None:
        grant.append(core.format_json_entry("OPTIONS", role.get("user_role_options")))

    return "\n".join(grant) + ";"


def get_user_create_statement(session, user, include_all_objects) -> str:
    auth_app = auth_apps.get_auth_app(session, user["auth_app_id"])
    full_user_name = f'{core.quote_user(user["name"])}@{core.quote_auth_app(auth_app["name"])}'

    output = []
    output.append(f'CREATE OR REPLACE REST USER {full_user_name}')

    if not user["login_permitted"]:
        output.append("    ACCOUNT LOCK")

    if user["auth_string"] is not None and user["auth_app_id"] != core.id_to_binary("0x31000000000000000000000000000000", "MySQL App"):
        output.append(f'    IDENTIFIED BY {core.quote_text(user["auth_string"])}')

    options = user.get("options") or {}
    if user["email"]:
        options["email"] = user["email"]
    if user["vendor_user_id"]:
        options["vendor_user_id"] = user["vendor_user_id"]
    if user["mapped_user_id"]:
        options["mapped_user_id"] = user["mapped_user_id"]
    if options:
        output.append(core.format_json_entry("OPTIONS", options))

    if user["app_options"] is not None:
        output.append(core.format_json_entry("APP OPTIONS",
                                            user.get("app_options")))

    result = ["\n".join(output) + ";"]
    # Taking care of the user roles
    if include_all_objects:
        for role in get_user_roles(session, user_id=user["id"]):
            grant = format_grant_statement(user, role)

            result.append(grant)

    return "\n\n".join(result)

