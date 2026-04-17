# Copyright (c) 2026, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is designed to work with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms,
# as designated in a particular file or component or in included license
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

from __future__ import annotations

from typing import Any

from . import formatter

_MISSING = object()
_SUPPORTED_FORMATTER_OPTIONS = {
    "indentWidth",
    "keywordCase",
    "quoteIdentifiers",
    "maxInlineLength",
    "breakSelectItems",
    "breakFunctionArgs",
    "tableOptionsPerLine",
    "ansiQuotes",
    "noBackslashEscapes",
}

_SUPPORTED_KEYWORD_CASE_OPTIONS = {"upper", "lower", "preserve"}


def _coerce_bool(value: Any, name: str) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and value in (0, 1):
        return bool(value)
    raise ValueError(f"{name} must be a boolean value.")


def _coerce_positive_int(value: Any, name: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        raise ValueError(f"{name} must be a positive integer.")
    return value


def _coerce_keyword_case(value: Any) -> str:
    if not isinstance(value, str):
        raise ValueError(f"keywordCase must be one of: {', '.join(_SUPPORTED_KEYWORD_CASE_OPTIONS)}.")

    normalized = value.strip().lower()
    if normalized not in _SUPPORTED_KEYWORD_CASE_OPTIONS:
        raise ValueError(f"keywordCase must be one of: {', '.join(_SUPPORTED_KEYWORD_CASE_OPTIONS)}.")
    return normalized


def _read_option(
    options: dict[str, Any],
    name: str,
    *,
    coerce,
    default: Any = _MISSING,
) -> Any:
    if name in options:
        return coerce(options.pop(name), name)

    if default is _MISSING:
        return None

    return default


def _build_formatter_options(kwargs: dict[str, Any]) -> tuple[formatter.FormatStyle, formatter.ParserOptions]:
    options = dict(kwargs)
    unknown = set(options) - _SUPPORTED_FORMATTER_OPTIONS
    if unknown:
        names = ", ".join(sorted(unknown))
        raise ValueError(f"Unsupported formatter option(s): {names}")

    keyword_case = _read_option(
        options,
        "keywordCase",
        coerce=lambda value, _name: _coerce_keyword_case(value),
    )
    if keyword_case is None:
        keyword_case = "upper"

    indent_width = _read_option(
        options,
        "indentWidth",
        coerce=_coerce_positive_int,
        default=4,
    )
    quote_identifiers = _read_option(
        options,
        "quoteIdentifiers",
        coerce=_coerce_bool,
        default=False,
    )
    max_inline_length = _read_option(
        options,
        "maxInlineLength",
        coerce=_coerce_positive_int,
        default=80,
    )
    break_select_items = _read_option(
        options,
        "breakSelectItems",
        coerce=_coerce_bool,
    )
    break_function_args = _read_option(
        options,
        "breakFunctionArgs",
        coerce=_coerce_bool,
        default=False,
    )
    table_options_per_line = _read_option(
        options,
        "tableOptionsPerLine",
        coerce=_coerce_bool,
        default=False,
    )
    ansi_quotes = _read_option(
        options,
        "ansiQuotes",
        coerce=_coerce_bool,
    )
    no_backslash_escapes = _read_option(
        options,
        "noBackslashEscapes",
        coerce=_coerce_bool,
    )

    style = formatter.FormatStyle(
        indent_width=indent_width,
        keyword_case=keyword_case,
        quote_identifiers=quote_identifiers,
        max_inline_length=max_inline_length,
        break_select_items=break_select_items,
        break_function_args=break_function_args,
        table_options_per_line=table_options_per_line,
    )
    parser_options = formatter.ParserOptions(
        ansi_quotes=ansi_quotes,
        no_backslash_escapes=no_backslash_escapes,
    )
    return style, parser_options


def reformat_sql(sql: str, **kwargs) -> str:
    """Reformats a SQL statement or script using mysqlsh AST/token APIs."""

    if not isinstance(sql, str):
        raise ValueError("sql must be a string.")

    style, parser_options = _build_formatter_options(kwargs)
    return formatter.format_script(
        sql,
        style=style,
        parser_options=parser_options,
    )
