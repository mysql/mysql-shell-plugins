# Copyright (c) 2022, 2023 Oracle and/or its affiliates.
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

from mrs_plugin.lib import core, auth_apps
import hashlib
import hmac
import base64
import os

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
        hash = hashlib.pbkdf2_hmac('sha256', auth_string.encode(), salt, iterations)
        client_key = hmac.HMAC(hash, b"Client Key", digestmod=hashlib.sha256).digest()

        m = hashlib.sha256()
        m.update(client_key)
        stored_key = m.digest()

        parts = [
            "A",
            f"{int(iterations/1000):03}",
            base64.b64encode(salt).decode(),
            base64.b64encode(stored_key).decode()
        ]

        return '$' + '$'.join(parts)

def get_users(session, service_id=None, auth_app_id=None, user_id=None, mask_password=True, user_name=None):
    sql = f"""
        SELECT  user.id, user.auth_app_id, user.name, user.email,
                user.vendor_user_id, user.login_permitted,
                user.mapped_user_id, user.app_options,
                {f'"{STORED_PASSWORD_STRING}" as auth_string' if mask_password else "user.auth_string"}
            FROM `mysql_rest_service_metadata`.`mrs_user` as user
            JOIN `mysql_rest_service_metadata`.`auth_app` as app
                ON app.id = user.auth_app_id
            JOIN `mysql_rest_service_metadata`.`service` as service
                ON app.service_id = service.id
    """
    wheres = []
    params = []

    if user_id:
        wheres.append("user.id = ?")
        params.append(user_id)
    if auth_app_id:
        wheres.append("auth_app_id = ?")
        params.append(auth_app_id)
    if service_id:
        wheres.append("service_id = ?")
        params.append(service_id)
    if user_name:
        wheres.append("user.name = ?")
        params.append(user_name)
    if len(wheres) == 0:
        return []

    sql += core._generate_where(wheres)

    return core.MrsDbExec(sql, params).exec(session).items


def get_users_by_service(session, service_id, mask_password=True):
    return get_users(session, service_id=service_id)


def get_users_by_auth_app(session, auth_app_id, mask_password=True):
    return get_users(session, auth_app_id=auth_app_id)


def get_user(session, user_id, mask_password=True):
    result = get_users(session, user_id=user_id)
    if not result:
        return None
    return result[0]


def add_user(session, auth_app_id, name, email, vendor_user_id, login_permitted,
    mapped_user_id, app_options, auth_string):

    if password_requires_cypher(session, auth_app_id):
        if not auth_string:
            raise RuntimeError("The authentication string is required for this app")
        auth_string = cypher_auth_string(auth_string)

    sql = """
        INSERT INTO `mysql_rest_service_metadata`.`mrs_user`
            (id, auth_app_id, name, email, vendor_user_id,
            login_permitted, mapped_user_id, app_options,
            auth_string)
        VALUES(?,?,?,?,?,?,?,?,?)
    """

    id = core.get_sequence_id(session)
    params = [id, auth_app_id, name, email, vendor_user_id,
        login_permitted, mapped_user_id, app_options, auth_string]

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
            value["auth_string"] = cypher_auth_string(value["auth_string"])

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
    SELECT *
    FROM `mysql_rest_service_metadata`.`mrs_user_has_role`
    WHERE user_id = ?
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
