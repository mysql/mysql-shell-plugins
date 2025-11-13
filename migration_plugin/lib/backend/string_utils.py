# Copyright (c) 2025, Oracle and/or its affiliates.
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


def _is_quote(c: str) -> bool:
    assert 1 == len(c)
    return '"' == c[0] or "'" == c[0] or "`" == c[0]


def _span_quoted_string(s: str, p: int = 0) -> tuple[str, int]:
    assert s

    length = len(s)

    if p >= length:
        return ("", p)

    quote = s[p]

    assert _is_quote(quote)

    p += 1
    esc = False
    done = False
    unquoted = ""

    while not done and p < length:
        if quote == s[p]:
            if esc:
                unquoted += s[p]
                esc = False
            else:
                esc = True
        else:
            if esc:
                done = True
                break
            else:
                unquoted += s[p]

        p += 1

    # was the last character a quote?
    if not done and esc:
        done = True

    if not done:
        raise Exception(f"Invalid syntax in identifier: {s}")

    return (unquoted, p)


class Account:
    def __init__(self, user: str, host: str) -> None:
        self.user: str = user
        self.host: str = host


def split_account(account: str) -> Account:
    length = len(account)

    if _is_quote(account[0]):
        user, p = _span_quoted_string(account)
    else:
        p = account.find("@")

        if -1 == p:
            p = length
            user = account
        else:
            user = account[0:p]

    if p >= length:
        host = ""
    else:
        p += 1

        if _is_quote(account[p]):
            host, p = _span_quoted_string(account, p)
            assert length == p
        else:
            host = account[p:]

    return Account(user, host)


def unquote_db_object(obj: str) -> tuple[str, ...]:
    result: list[str] = []
    p = 0
    length = len(obj)

    while p < length:
        if _is_quote(obj[p]):
            o, p = _span_quoted_string(obj, p)
        else:
            s = p
            p = obj.find(".", p)

            if -1 == p:
                p = length

            o = obj[s:p]

        result.append(o)
        p += 1

    return tuple(result)


def quote_db_object(schema: str, table: Optional[str] = None, object: Optional[str] = None) -> str:
    def q(o: str):
        return f"`{o.replace('`', '``')}`"

    result = q(schema)

    if table:
        result += "."
        result += q(table)

    if object:
        assert table
        result += "."
        result += q(object)

    return result
