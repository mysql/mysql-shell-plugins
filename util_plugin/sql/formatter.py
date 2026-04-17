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

from dataclasses import dataclass
from typing import Any, Iterable
try:  # pragma: no cover - only available inside mysqlsh
    from mysqlsh import mysql
except ImportError:  # pragma: no cover
    mysql = None  # type: ignore[assignment]


WHITESPACE_TOKEN_TYPES = {"WHITESPACE"}
BOOLEAN_OPERATOR_SYMBOLS = {"AND_SYMBOL", "OR_SYMBOL"}
IDENTIFIER_LEAF_SYMBOLS = {
    "IDENTIFIER",
    "BACK_TICK_QUOTED_ID",
    "SIMPLE_IDENTIFIER",
    "NAME_SYMBOL",
}
IDENTIFIER_RULES = {
    "columnName",
    "constraintName",
    "identifier",
    "identifierKeyword",
    "identifierKeywordsUnambiguous",
    "pureIdentifier",
    "qualifiedIdentifier",
    "tableAlias",
    "tableName",
    "triggerName",
    "viewName",
}
OPEN_SYMBOLS = {"OPEN_PAR_SYMBOL"}
CLOSE_SYMBOLS = {"CLOSE_PAR_SYMBOL"}
UNSUPPORTED_RULES = {"inExpressionUserVariableAssignment"}
UNSUPPORTED_SYMBOLS: set[str] = set()
SUPPORTED_STATEMENT_RULES = {
    "resourceGroupManagement",
    "beginWork",
}
SUPPORTED_STATEMENT_RULE_SUFFIXES = ("Statement", "Command")


class UnsupportedStatementError(RuntimeError):
    pass


@dataclass(frozen=True)
class FormatStyle:
    indent_width: int = 4
    keyword_case: str = "upper"
    quote_identifiers: bool = False
    max_inline_length: int = 80
    break_select_items: bool | None = None
    break_function_args: bool = False
    table_options_per_line: bool = False

    def indent(self, level: int = 1) -> str:
        return " " * (self.indent_width * level)


@dataclass(frozen=True)
class ParserOptions:
    ansi_quotes: bool | None = None
    no_backslash_escapes: bool | None = None

    def as_mysql_options(self) -> dict[str, bool]:
        options: dict[str, bool] = {}
        if self.ansi_quotes is not None:
            options["ansiQuotes"] = self.ansi_quotes
        if self.no_backslash_escapes is not None:
            options["noBackslashEscapes"] = self.no_backslash_escapes
        return options

    def as_mysql_tokenizer_options(self) -> dict[str, bool]:
        options: dict[str, bool] = {}
        if self.no_backslash_escapes is not None:
            options["noBackslashEscapes"] = self.no_backslash_escapes
        return options


def _ensure_mysql_runtime():
    if mysql is None:  # pragma: no cover
        raise RuntimeError("The SQL formatter requires mysqlsh Python mode.")


def _is_comment_token(token_type: str) -> bool:
    return token_type.endswith("COMMENT")


def _is_multiline_quoted_token(token: dict[str, str]) -> bool:
    return "TEXT" in token["type"] and "\n" in token["token"]


def format_script(
    sql: str,
    style: FormatStyle,
    parser_options: ParserOptions | None = None,
) -> str:
    _ensure_mysql_runtime()
    parser_options = parser_options or ParserOptions()

    chunks = list(mysql.split_script(sql, parser_options.as_mysql_options()))
    if not chunks:
        return sql

    cursor = 0
    output: list[str] = []
    for chunk in chunks:
        position = sql.find(chunk, cursor)
        if position < 0:
            return sql

        output.append(sql[cursor:position])
        output.append(
            _format_script_chunk(
                chunk,
                style=style,
                parser_options=parser_options,
            )
        )
        cursor = position + len(chunk)

    output.append(sql[cursor:])
    return "".join(output)


def _format_script_chunk(
    chunk: str,
    style: FormatStyle,
    parser_options: ParserOptions,
) -> str:
    try:
        tokens = list(mysql.tokenize_statement(chunk, parser_options.as_mysql_tokenizer_options()))

        first_code_index = None
        prefix_length = 0
        for idx, token in enumerate(tokens):
            token_type = token["type"]
            if _is_comment_token(token_type) or token_type in WHITESPACE_TOKEN_TYPES:
                prefix_length += len(token["token"])
                continue
            first_code_index = idx
            break

        if first_code_index is None:
            return chunk

        body_tokens = tokens[first_code_index:]
        if any(_is_comment_token(token["type"]) for token in body_tokens):
            return chunk
        if any(_is_multiline_quoted_token(token) for token in body_tokens):
            return chunk

        body_end = len(chunk)
        while body_tokens and body_tokens[-1]["type"] in WHITESPACE_TOKEN_TYPES:
            body_end -= len(body_tokens[-1]["token"])
            body_tokens.pop()

        prefix = chunk[:prefix_length]
        body = chunk[prefix_length:body_end]
        suffix = chunk[body_end:]

        return prefix + _format_statement_or_fallback(
            body,
            style=style,
            parser_options=parser_options,
            tokens=body_tokens,
        ) + suffix
    except Exception:
        return chunk


def format_statement(
    sql: str,
    style: FormatStyle,
    parser_options: ParserOptions | None = None,
) -> str:
    _ensure_mysql_runtime()
    parser_options = parser_options or ParserOptions()
    ast = dict(mysql.parse_statement_ast(sql, parser_options.as_mysql_options()))
    formatter = _SqlFormatter(style)
    return formatter.format_statement(ast)


def _format_statement_or_fallback(
    sql: str,
    style: FormatStyle,
    parser_options: ParserOptions,
    tokens: list[dict[str, str]] | None = None,
) -> str:
    try:
        return format_statement(sql, style=style, parser_options=parser_options)
    except Exception:
        fallback = _format_statement_fallback(
            style=style,
            parser_options=parser_options,
            sql=sql,
            tokens=tokens,
        )
        if fallback is not None:
            return fallback
        raise


def _format_statement_fallback(
    *,
    style: FormatStyle,
    parser_options: ParserOptions,
    sql: str,
    tokens: list[dict[str, str]] | None = None,
) -> str | None:
    try:
        formatter = _SqlFormatter(style)
        statement_tokens = tokens if tokens is not None else list(mysql.tokenize_statement(
            sql,
            parser_options.as_mysql_tokenizer_options(),
        ))
        return formatter.format_token_fallback(statement_tokens)
    except Exception:
        return None


class _SqlFormatter:
    def __init__(self, style: FormatStyle):
        self.style = style

    def format_statement(self, ast: dict[str, Any]) -> str:
        statement = self._unwrap_statement(ast)
        if not self._is_supported_statement_rule(statement.get("rule", "")):
            raise UnsupportedStatementError(
                f"Unsupported statement family: {statement.get('rule')}"
            )
        self._validate_supported_tree(statement)
        text = self.format_node(statement)
        return text.rstrip()

    def _is_supported_statement_rule(self, rule: str) -> bool:
        return rule in SUPPORTED_STATEMENT_RULES or rule.endswith(
            SUPPORTED_STATEMENT_RULE_SUFFIXES
        )

    def format_node(self, node: dict[str, Any]) -> str:
        rule = node.get("rule")
        if rule:
            handler = getattr(self, f"rule_{rule}", None)
            if handler:
                return handler(node)
            conventional = self._format_node_by_convention(node)
            if conventional is not None:
                return conventional
            return self._inline_children(node)

        symbol = node.get("symbol")
        if symbol and symbol.endswith("_SYMBOL"):
            return self._kw(node.get("text", ""))
        return node.get("text", "")

    def format_token_fallback(self, tokens: list[dict[str, str]]) -> str | None:
        significant_tokens = [
            token
            for token in tokens
            if token["type"] not in WHITESPACE_TOKEN_TYPES
            and not _is_comment_token(token["type"])
        ]
        if not significant_tokens:
            return ""

        for formatter in (
            self._format_alter_routine_token_fallback,
            self._format_alter_library_token_fallback,
            self._format_drop_library_token_fallback,
            self._format_show_library_status_token_fallback,
            self._format_show_create_masking_policy_token_fallback,
            self._format_drop_masking_policy_token_fallback,
            self._format_create_masking_policy_token_fallback,
        ):
            formatted = formatter(significant_tokens)
            if formatted is not None:
                return formatted

        return None

    def _format_token_sequence(
        self,
        tokens: list[dict[str, str]],
        *,
        forced_keyword_indexes: set[int] | None = None,
    ) -> str:
        forced_keyword_indexes = forced_keyword_indexes or set()
        parts: list[tuple[str, dict[str, Any]]] = []

        for index, token in enumerate(tokens):
            if token["type"] in WHITESPACE_TOKEN_TYPES or _is_comment_token(token["type"]):
                continue

            force_keyword = index in forced_keyword_indexes
            symbol = token["type"]
            text = token["token"]
            if force_keyword or symbol.endswith("_SYMBOL"):
                text = self._kw(text)
            if force_keyword:
                symbol = f"{text.upper()}_SYMBOL"

            parts.append((text, {"symbol": symbol, "text": token["token"]}))

        return self._join_parts(parts)

    def _tokens_start_with(
        self, tokens: list[dict[str, str]], expected_texts: list[str]
    ) -> bool:
        if len(tokens) < len(expected_texts):
            return False
        return all(
            tokens[index]["token"].upper() == expected.upper()
            for index, expected in enumerate(expected_texts)
        )

    def _split_token_clauses(
        self,
        tokens: list[dict[str, str]],
        is_clause_start,
    ) -> list[list[dict[str, str]]]:
        clauses: list[list[dict[str, str]]] = []
        current: list[dict[str, str]] = []

        for index, token in enumerate(tokens):
            if current and is_clause_start(index, tokens):
                clauses.append(current)
                current = [token]
                continue
            current.append(token)

        if current:
            clauses.append(current)

        return clauses

    def _is_outer_parenthesized_token_group(
        self, tokens: list[dict[str, str]]
    ) -> bool:
        if len(tokens) < 2:
            return False
        if tokens[0]["type"] != "OPEN_PAR_SYMBOL" or tokens[-1]["type"] != "CLOSE_PAR_SYMBOL":
            return False

        depth = 0
        for index, token in enumerate(tokens):
            if token["type"] == "OPEN_PAR_SYMBOL":
                depth += 1
            elif token["type"] == "CLOSE_PAR_SYMBOL":
                depth -= 1
                if depth == 0 and index != len(tokens) - 1:
                    return False

        return depth == 0

    def _format_alter_routine_token_fallback(
        self, tokens: list[dict[str, str]]
    ) -> str | None:
        if not (
            self._tokens_start_with(tokens, ["ALTER", "PROCEDURE"])
            or self._tokens_start_with(tokens, ["ALTER", "FUNCTION"])
        ):
            return None

        clause_start_types = {
            "COMMENT_SYMBOL",
            "LANGUAGE_SYMBOL",
            "NO_SYMBOL",
            "CONTAINS_SYMBOL",
            "READS_SYMBOL",
            "MODIFIES_SYMBOL",
            "USING_SYMBOL",
        }

        def is_clause_start(index: int, clause_tokens: list[dict[str, str]]) -> bool:
            token_type = clause_tokens[index]["type"]
            if token_type in clause_start_types:
                return True
            return (
                token_type == "SQL_SYMBOL"
                and index + 1 < len(clause_tokens)
                and clause_tokens[index + 1]["type"] == "SECURITY_SYMBOL"
            )

        clause_index = next(
            (
                index
                for index in range(3, len(tokens))
                if is_clause_start(index, tokens)
            ),
            None,
        )
        if clause_index is None:
            return self._format_token_sequence(tokens)

        lines = [self._format_token_sequence(tokens[:clause_index])]
        clause_tokens = tokens[clause_index:]

        for clause in self._split_token_clauses(
            clause_tokens,
            is_clause_start,
        ):
            lines.append(self._indent_block(self._format_token_sequence(clause)))
        return "\n".join(lines)

    def _format_alter_library_token_fallback(
        self, tokens: list[dict[str, str]]
    ) -> str | None:
        if not self._tokens_start_with(tokens, ["ALTER", "LIBRARY"]):
            return None

        clause_index = next(
            (
                index
                for index in range(3, len(tokens))
                if tokens[index]["type"] == "COMMENT_SYMBOL"
            ),
            None,
        )
        if clause_index is None:
            return self._format_token_sequence(tokens)

        return "\n".join(
            [
                self._format_token_sequence(tokens[:clause_index]),
                self._indent_block(self._format_token_sequence(tokens[clause_index:])),
            ]
        )

    def _format_drop_library_token_fallback(
        self, tokens: list[dict[str, str]]
    ) -> str | None:
        if not self._tokens_start_with(tokens, ["DROP", "LIBRARY"]):
            return None
        return self._format_token_sequence(tokens)

    def _format_show_library_status_token_fallback(
        self, tokens: list[dict[str, str]]
    ) -> str | None:
        if not self._tokens_start_with(tokens, ["SHOW", "LIBRARY", "STATUS"]):
            return None
        return self._format_token_sequence(tokens)

    def _format_show_create_masking_policy_token_fallback(
        self, tokens: list[dict[str, str]]
    ) -> str | None:
        if not self._tokens_start_with(tokens, ["SHOW", "CREATE", "MASKING", "POLICY"]):
            return None
        return self._format_token_sequence(tokens, forced_keyword_indexes={2, 3})

    def _format_drop_masking_policy_token_fallback(
        self, tokens: list[dict[str, str]]
    ) -> str | None:
        if not self._tokens_start_with(tokens, ["DROP", "MASKING", "POLICY"]):
            return None
        return self._format_token_sequence(tokens, forced_keyword_indexes={1, 2})

    def _format_create_masking_policy_token_fallback(
        self, tokens: list[dict[str, str]]
    ) -> str | None:
        if not self._tokens_start_with(tokens, ["CREATE", "MASKING", "POLICY"]):
            return None

        header_end = None
        seen_parameter_list = False
        depth = 0
        for index in range(3, len(tokens)):
            token_type = tokens[index]["type"]
            if token_type == "OPEN_PAR_SYMBOL":
                seen_parameter_list = True
                depth += 1
            elif token_type == "CLOSE_PAR_SYMBOL" and depth:
                depth -= 1
                if seen_parameter_list and depth == 0:
                    header_end = index + 1
                    break

        if header_end is None:
            return self._format_token_sequence(tokens, forced_keyword_indexes={1, 2})

        head = self._format_token_sequence(
            tokens[:header_end],
            forced_keyword_indexes={1, 2},
        )
        body_tokens = tokens[header_end:]
        if not body_tokens:
            return head

        body = self._format_masking_policy_body_tokens(body_tokens)
        return "\n".join([head, self._indent_block(body)])

    def _format_masking_policy_body_tokens(
        self, tokens: list[dict[str, str]]
    ) -> str:
        if self._is_outer_parenthesized_token_group(tokens):
            inner = self._format_masking_policy_body_tokens(tokens[1:-1])
            if "\n" not in inner:
                return f"({inner})"
            return "\n".join(["(", self._indent_block(inner), ")"])
        return self._format_token_sequence(tokens)

    def _unwrap_statement(self, ast: dict[str, Any]) -> dict[str, Any]:
        if ast.get("rule") != "query":
            raise UnsupportedStatementError("Unexpected AST root.")

        query_children = ast.get("children", [])
        if not query_children:
            raise UnsupportedStatementError("Missing statement children.")

        statement = query_children[0]
        if statement.get("rule") != "simpleStatement":
            if statement.get("rule"):
                return statement
            raise UnsupportedStatementError("Unsupported statement wrapper.")

        wrapped = statement.get("children", [])
        if not wrapped:
            raise UnsupportedStatementError("Missing inner statement.")
        return wrapped[0]

    def _validate_supported_tree(self, node: dict[str, Any]) -> None:
        stack = [node]
        while stack:
            current = stack.pop()
            if current.get("rule") in UNSUPPORTED_RULES:
                raise UnsupportedStatementError(
                    f"Unsupported SQL construct: {current['rule']}"
                )
            if current.get("symbol") in UNSUPPORTED_SYMBOLS:
                raise UnsupportedStatementError(
                    f"Unsupported SQL token: {current['symbol']}"
                )
            stack.extend(current.get("children", []))

    def _kw(self, text: str) -> str:
        if self.style.keyword_case == "upper":
            return text.upper()
        if self.style.keyword_case == "lower":
            return text.lower()
        return text

    def _kw_leaf(self, node: dict[str, Any]) -> str:
        return self._kw(node.get("text", ""))

    def _quote_identifier(self, text: str) -> str:
        if text.startswith("`") and text.endswith("`"):
            return text
        return f"`{text.replace('`', '``')}`"

    def _format_identifier_text(self, text: str) -> str:
        if self.style.quote_identifiers:
            return self._quote_identifier(text)
        return text

    def _indent_block(self, text: str, level: int = 1) -> str:
        prefix = self.style.indent(level)
        return "\n".join(prefix + line if line else prefix for line in text.splitlines())

    def _formatted_children(self, children: Iterable[dict[str, Any]]) -> list[str]:
        formatted_children: list[str] = []
        for child in children:
            formatted = self.format_node(child)
            if formatted:
                formatted_children.append(formatted)
        return formatted_children

    def _group_children_by_symbol(
        self, children: Iterable[dict[str, Any]], separator_symbol: str
    ) -> list[list[dict[str, Any]]]:
        groups: list[list[dict[str, Any]]] = [[]]
        for child in children:
            if child.get("symbol") == separator_symbol:
                groups.append([])
                continue
            groups[-1].append(child)
        return [group for group in groups if group]

    def _format_segment(self, nodes: list[dict[str, Any]]) -> str:
        if len(nodes) == 1:
            return self.format_node(nodes[0])
        return self._join_parts([(self.format_node(node), node) for node in nodes])

    def _format_comma_list(
        self, children: Iterable[dict[str, Any]], multiline: bool | None = None
    ) -> str:
        groups = self._group_children_by_symbol(children, "COMMA_SYMBOL")
        items = [self._format_segment(group) for group in groups]
        if multiline is None:
            multiline = len(items) > 1 or any("\n" in item for item in items)
        return self._join_comma_items(items, multiline=multiline)

    def _join_comma_items(self, items: list[str], multiline: bool) -> str:
        if not items:
            return ""
        if not multiline:
            return ", ".join(items)

        lines: list[str] = []
        for index, item in enumerate(items):
            item_lines = item.splitlines() or [""]
            if index < len(items) - 1:
                item_lines[-1] += ","
            lines.extend(item_lines)
        return "\n".join(lines)

    def _format_node_by_convention(self, node: dict[str, Any]) -> str | None:
        children = node.get("children", [])
        if not children:
            return None

        if len(children) == 1:
            return self.format_node(children[0])

        if (
            len(children) == 3
            and children[0].get("symbol") in OPEN_SYMBOLS
            and children[2].get("symbol") in CLOSE_SYMBOLS
        ):
            open_text = children[0].get("text", "(")
            close_text = children[2].get("text", ")")
            return f"{open_text}{self.format_node(children[1])}{close_text}"

        if node.get("rule", "").endswith("List") and any(
            child.get("symbol") == "COMMA_SYMBOL" for child in children
        ):
            groups = self._group_children_by_symbol(children, "COMMA_SYMBOL")
            items = [self._format_segment(group) for group in groups]
            multiline = any("\n" in item for item in items)
            return self._join_comma_items(items, multiline=multiline)

        return None

    def _node_kind(self, node: dict[str, Any]) -> str:
        rule = node.get("rule")
        symbol = node.get("symbol")
        if symbol in OPEN_SYMBOLS:
            return "open_par"
        if symbol in CLOSE_SYMBOLS:
            return "close_par"
        if symbol == "COMMA_SYMBOL":
            return "comma"
        if symbol == "DOT_SYMBOL":
            return "dot"
        if symbol == "AT_SIGN_SYMBOL":
            return "at"
        if symbol and (symbol.endswith("_OPERATOR") or symbol == "MULT_OPERATOR"):
            return "operator"
        if rule in {"compOp", "equal"}:
            return "operator"
        if (
            rule in IDENTIFIER_RULES
            or (rule and rule.endswith(("Ref", "Name", "Identifier")))
            or symbol in IDENTIFIER_LEAF_SYMBOLS
        ):
            return "identifier"
        if symbol and symbol.endswith("_SYMBOL"):
            return "keyword"
        return "expr"

    def _needs_space(
        self,
        previous_kind: str | None,
        current_kind: str,
        previous_text: str,
        *,
        suppress_space_before_open_par: bool = False,
    ) -> bool:
        if previous_kind is None:
            return False
        if current_kind in {"comma", "close_par", "dot", "at"}:
            return False
        if previous_kind in {"open_par", "dot", "at"}:
            return False
        if current_kind == "open_par":
            if suppress_space_before_open_par and previous_kind in {"identifier", "keyword"}:
                return False
            if previous_kind == "identifier":
                return False
            return True
        if current_kind == "operator" or previous_kind == "operator":
            return True
        if previous_text.endswith("\n"):
            return False
        return True

    def _join_parts(
        self,
        parts: list[tuple[str, dict[str, Any]]],
        *,
        suppress_space_before_open_par: bool = False,
    ) -> str:
        output: list[str] = []
        previous_kind = None
        previous_text = ""
        for text, node in parts:
            if not text:
                continue
            kind = self._node_kind(node)
            if output and self._needs_space(
                previous_kind,
                kind,
                previous_text,
                suppress_space_before_open_par=suppress_space_before_open_par,
            ):
                output.append(" ")
            output.append(text)
            previous_kind = kind
            previous_text = text
        return "".join(output)

    def _join_function_parts(self, children: list[dict[str, Any]]) -> str:
        return self._join_parts(
            [(self.format_node(child), child) for child in children],
            suppress_space_before_open_par=True,
        )

    def _inline_children(self, node: dict[str, Any]) -> str:
        children = node.get("children", [])
        return self._join_parts([(self.format_node(child), child) for child in children])

    def _raw_inline_children(self, node: dict[str, Any]) -> str:
        children = node.get("children", [])
        return self._join_parts([(child.get("text", ""), child) for child in children])

    def _format_keyword_lines(self, keyword: str, lines: list[str]) -> str:
        if not lines:
            return keyword
        _nl = "\n"
        return f"{keyword}\n{self._indent_block(_nl.join(lines))}"

    def _format_condition_lines(self, node: dict[str, Any]) -> list[str]:
        if node.get("rule") == "expr" and any(
            child.get("symbol") in BOOLEAN_OPERATOR_SYMBOLS
            for child in node.get("children", [])
        ):
            children = node["children"]
            lines = self._format_condition_lines(children[0])
            i = 1
            while i < len(children) - 1:
                operator = self._kw_leaf(children[i])
                rhs_lines = self._format_condition_lines(children[i + 1])
                if not rhs_lines:
                    rhs_lines = [""]
                lines.append(f"{operator} {rhs_lines[0]}")
                continuation = " " * (len(operator) + 1)
                for extra in rhs_lines[1:]:
                    lines.append(f"{continuation}{extra}")
                i += 2
            return lines
        return self.format_node(node).splitlines() or [""]

    def _format_query_body_with_tail(
        self, head: str, tail_nodes: list[dict[str, Any]]
    ) -> str:
        result = head
        for node in tail_nodes:
            suffix = self.format_node(node)
            if suffix:
                result += "\n" + suffix
        return result

    def _prepend_head(self, head: str, body: str) -> str:
        if not body:
            return head
        if "\n" not in body:
            return f"{head} {body}"
        lines = body.splitlines()
        return "\n".join([f"{head} {lines[0]}", *lines[1:]])

    def _format_statement_wrapper(
        self, node: dict[str, Any], *, error_message: str
    ) -> str:
        children = node.get("children", [])
        if not children:
            raise UnsupportedStatementError(error_message)
        return self.format_node(children[0])

    def _format_statement_family(
        self,
        node: dict[str, Any],
        *,
        family_name: str,
        special_formatters: dict[str, str] | None = None,
        generic_rules: set[str] | None = None,
        allow_generic_children: bool = False,
    ) -> str:
        children = node.get("children", [])
        if len(children) < 2:
            raise UnsupportedStatementError(f"Incomplete {family_name} statement.")

        keyword = self._kw_leaf(children[0])
        statement = children[1]
        rule = statement.get("rule", "")

        if special_formatters and rule in special_formatters:
            formatter = getattr(self, special_formatters[rule])
            return formatter(keyword, statement)

        if allow_generic_children or (generic_rules and rule in generic_rules):
            return self._prepend_head(keyword, self.format_node(statement))

        raise UnsupportedStatementError(
            f"Unsupported {family_name} statement: {rule}"
        )

    def _format_statement_with_trailing_body(
        self,
        keyword: str,
        node: dict[str, Any],
        *,
        family_name: str,
        body_rules: set[str],
    ) -> str:
        children = node.get("children", [])
        if len(children) < 2:
            raise UnsupportedStatementError(f"Incomplete {family_name} statement.")

        body_index = next(
            (index for index, child in enumerate(children) if child.get("rule") in body_rules),
            None,
        )
        if body_index is None:
            raise UnsupportedStatementError(
                f"Malformed {family_name} statement: missing statement body."
            )

        head = self._join_parts(
            [(self.format_node(child), child) for child in children[:body_index]]
        )
        if not head:
            raise UnsupportedStatementError(f"Malformed {family_name} statement header.")

        body = self.format_node(children[body_index])
        statement = f"{keyword} {head}"
        if not body:
            return statement
        return "\n".join([statement, self._indent_block(body)])

    def _collect_head_parts(
        self,
        children: list[dict[str, Any]],
        *,
        start: int = 0,
        stop_rules: set[str] | None = None,
        stop_symbols: set[str] | None = None,
        stop_predicate: Any = None,
    ) -> tuple[list[tuple[str, dict[str, Any]]], int]:
        stop_rules = stop_rules or set()
        stop_symbols = stop_symbols or set()
        parts: list[tuple[str, dict[str, Any]]] = []
        index = start

        while index < len(children):
            child = children[index]
            if child.get("rule") in stop_rules or child.get("symbol") in stop_symbols:
                break
            if stop_predicate is not None and stop_predicate(child):
                break
            parts.append((self.format_node(child), child))
            index += 1

        return parts, index

    def _format_clause_body(self, body: str) -> str:
        return body if "\n" not in body else body

    def _format_case(self, node: dict[str, Any]) -> str:
        children = node.get("children", [])
        lines = [self._kw_leaf(children[0])]
        index = 1
        if (
            len(children) > 2
            and children[1].get("rule") not in {"whenExpression", "elseExpression"}
            and children[1].get("symbol") != "END_SYMBOL"
        ):
            lines[0] += f" {self.format_node(children[1])}"
            index = 2
        while index < len(children) - 1:
            current = children[index]
            if current.get("rule") == "whenExpression" and index + 1 < len(children):
                then_node = children[index + 1]
                condition = self.format_node(current["children"][1])
                result = self.format_node(then_node["children"][1])
                if "\n" in condition or "\n" in result:
                    lines.append(self._indent_block(f"{self._kw_leaf(current['children'][0])}", 1))
                    lines.append(self._indent_block(condition, 2))
                    lines.append(
                        self._indent_block(f"{self._kw_leaf(then_node['children'][0])}", 1)
                    )
                    lines.append(self._indent_block(result, 2))
                else:
                    lines.append(
                        self._indent_block(
                            f"{self._kw_leaf(current['children'][0])} {condition} "
                            f"{self._kw_leaf(then_node['children'][0])} {result}",
                            1,
                        )
                    )
                index += 2
                continue
            if current.get("rule") == "elseExpression":
                else_result = self.format_node(current["children"][1])
                if "\n" in else_result:
                    lines.append(self._indent_block(f"{self._kw_leaf(current['children'][0])}", 1))
                    lines.append(self._indent_block(else_result, 2))
                else:
                    lines.append(
                        self._indent_block(
                            f"{self._kw_leaf(current['children'][0])} {else_result}", 1
                        )
                    )
                index += 1
                continue
            index += 1
        lines.append(self._kw_leaf(children[-1]))
        return "\n".join(lines)

    def rule_selectStatement(self, node: dict[str, Any]) -> str:
        return self._format_query_body_with_tail(
            self.format_node(node["children"][0]), node["children"][1:]
        )

    def _format_insert_like_statement(
        self, node: dict[str, Any], statement_keyword: str
    ) -> str:
        children = node["children"]
        head_parts, index = self._collect_head_parts(
            children,
            stop_rules={"insertFromConstructor", "insertQueryExpression"},
            stop_symbols={"SET_SYMBOL"},
        )

        if index >= len(children):
            return self._join_parts(head_parts)

        head = self._join_parts(head_parts)
        current = children[index]
        if current.get("symbol") == "SET_SYMBOL":
            if index + 1 >= len(children):
                raise UnsupportedStatementError(
                    f"Malformed {statement_keyword} ... SET statement."
                )
            lines = [
                head,
                self._format_keyword_lines(
                    self._kw_leaf(current), self.format_node(children[index + 1]).splitlines()
                ),
            ]
            for child in children[index + 2 :]:
                lines.append(self.format_node(child))
            return "\n".join(lines)

        body = self.format_node(current)
        lines = [f"{head} {body}" if "\n" not in body else f"{head} {body.splitlines()[0]}"]
        if "\n" in body:
            body_lines = body.splitlines()
            lines = [f"{head} {body_lines[0]}"]
            lines.extend(body_lines[1:])
        for child in children[index + 1 :]:
            lines.append(self.format_node(child))
        return "\n".join(lines)

    def rule_insertStatement(self, node: dict[str, Any]) -> str:
        return self._format_insert_like_statement(node, "INSERT")

    def rule_replaceStatement(self, node: dict[str, Any]) -> str:
        return self._format_insert_like_statement(node, "REPLACE")

    def rule_updateStatement(self, node: dict[str, Any]) -> str:
        children = node["children"]
        head_parts: list[tuple[str, dict[str, Any]]] = [(self._kw_leaf(children[0]), children[0])]
        extra_head_parts, index = self._collect_head_parts(
            children,
            start=1,
            stop_rules={"tableReferenceList"},
        )
        head_parts.extend(extra_head_parts)

        if index >= len(children) or index + 2 > len(children):
            raise UnsupportedStatementError("Malformed UPDATE statement.")

        head_parts.append((self.format_node(children[index]), children[index]))
        head = self._join_parts(head_parts)
        set_keyword = children[index + 1]
        if set_keyword.get("symbol") != "SET_SYMBOL":
            raise UnsupportedStatementError("Missing UPDATE SET clause.")

        lines = [
            head,
            self._format_keyword_lines(
                self._kw_leaf(set_keyword), self.format_node(children[index + 2]).splitlines()
            ),
        ]
        if len(children) > index + 3:
            lines.extend(self.format_node(child) for child in children[index + 3 :])
        return "\n".join(lines)

    def rule_deleteStatement(self, node: dict[str, Any]) -> str:
        children = node["children"]
        delete_parts: list[tuple[str, dict[str, Any]]] = [(self._kw_leaf(children[0]), children[0])]
        extra_delete_parts, index = self._collect_head_parts(
            children,
            start=1,
            stop_symbols={"FROM_SYMBOL"},
            stop_predicate=lambda child: child.get("rule") == "tableAliasRefList",
        )
        delete_parts.extend(extra_delete_parts)

        lines: list[str] = []
        delete_head = self._join_parts(delete_parts)
        if index >= len(children):
            return delete_head

        current = children[index]
        if current.get("rule") == "tableAliasRefList":
            aliases = self.format_node(current)
            lines.append(f"{delete_head} {aliases}")
            index += 1
            if index >= len(children) or children[index].get("symbol") != "FROM_SYMBOL":
                raise UnsupportedStatementError("Malformed multi-table DELETE statement.")
            from_clause = self._format_keyword_lines(
                self._kw_leaf(children[index]), self.format_node(children[index + 1]).splitlines()
            )
            lines.append(from_clause)
            index += 2
        else:
            if current.get("symbol") != "FROM_SYMBOL" or index + 1 >= len(children):
                raise UnsupportedStatementError("Malformed DELETE statement.")
            target = children[index + 1]
            if target.get("rule") == "tableAliasRefList":
                lines.append(f"{delete_head} {self._kw_leaf(current)} {self.format_node(target)}")
                index += 2
                if index < len(children) and children[index].get("symbol") == "USING_SYMBOL":
                    lines.append(
                        self._format_keyword_lines(
                            self._kw_leaf(children[index]),
                            self.format_node(children[index + 1]).splitlines(),
                        )
                    )
                    index += 2
            else:
                lines.append(
                    f"{delete_head} {self._kw_leaf(current)} {self.format_node(target)}"
                )
                index += 2

        if index < len(children):
            lines.extend(self.format_node(child) for child in children[index:])
        return "\n".join(lines)

    def rule_alterStatement(self, node: dict[str, Any]) -> str:
        children = node.get("children", [])
        if len(children) >= 4 and children[1].get("symbol") in {
            "FUNCTION_SYMBOL",
            "LIBRARY_SYMBOL",
            "PROCEDURE_SYMBOL",
        }:
            head = self._join_parts(
                [(self.format_node(child), child) for child in children[:3]]
            )
            tail = self._formatted_children(children[3:])
            if not tail:
                return head
            return "\n".join([head, self._indent_block("\n".join(tail))])

        return self._format_statement_family(
            node,
            family_name="ALTER",
            special_formatters={
                "alterTable": "_format_alter_table",
                "alterDatabase": "_format_alter_database",
            },
            allow_generic_children=True,
        )

    def _format_alter_table(self, keyword: str, node: dict[str, Any]) -> str:
        children = node["children"]
        if len(children) < 3:
            raise UnsupportedStatementError("Incomplete ALTER TABLE statement.")
        head = f"{keyword} {self._kw_leaf(children[0])} {self.format_node(children[1])}"
        actions = self.format_node(children[2])
        if not actions:
            return head
        return f"{head}\n{self._indent_block(actions)}"

    def _format_alter_database(self, keyword: str, node: dict[str, Any]) -> str:
        children = node["children"]
        if len(children) < 2:
            raise UnsupportedStatementError("Incomplete ALTER DATABASE statement.")
        head = (
            f"{keyword} {self._kw_leaf(children[0])} "
            f"{self.format_node(children[1])}"
        )
        if len(children) == 2:
            return head
        tail = self._formatted_children(children[2:])
        if not tail:
            return head
        return "\n".join([head, *tail])

    def rule_dropStatement(self, node: dict[str, Any]) -> str:
        return self._format_statement_family(
            node,
            family_name="DROP",
            allow_generic_children=True,
        )

    def rule_functionRef(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_libraryName(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_procedureRef(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_routineAlterOptions(self, node: dict[str, Any]) -> str:
        return "\n".join(
            formatted
            for formatted in (self.format_node(child) for child in node["children"])
            if formatted
        )

    def rule_routineOption(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_accountManagementStatement(self, node: dict[str, Any]) -> str:
        return self._format_statement_wrapper(
            node,
            error_message="Missing account management statement.",
        )

    def rule_resourceGroupManagement(self, node: dict[str, Any]) -> str:
        return self._format_statement_wrapper(
            node,
            error_message="Missing resource group statement.",
        )

    def rule_truncateTableStatement(self, node: dict[str, Any]) -> str:
        return self._join_parts([(self.format_node(child), child) for child in node["children"]])

    def rule_renameTableStatement(self, node: dict[str, Any]) -> str:
        children = node["children"]
        head = f"{self._kw_leaf(children[0])} {self._kw_leaf(children[1])}"
        pairs = [
            self._format_segment(group)
            for group in self._group_children_by_symbol(children[2:], "COMMA_SYMBOL")
        ]
        body = self._join_comma_items(pairs, multiline=len(pairs) > 1)
        if "\n" not in body:
            return f"{head} {body}"
        return f"{head}\n{self._indent_block(body)}"

    def rule_renamePair(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_createStatement(self, node: dict[str, Any]) -> str:
        return self._format_statement_family(
            node,
            family_name="CREATE",
            special_formatters={
                "createProcedure": "_format_create_statement_with_body",
                "createFunction": "_format_create_statement_with_body",
                "createEvent": "_format_create_statement_with_body",
                "createView": "_format_create_view",
                "createTable": "_format_create_table",
                "createTrigger": "_format_create_trigger",
                "createIndex": "_format_create_index",
                "createDatabase": "_format_create_database",
            },
            allow_generic_children=True,
        )

    def _format_create_statement_with_body(
        self, create_keyword: str, node: dict[str, Any]
    ) -> str:
        return self._format_statement_with_trailing_body(
            create_keyword,
            node,
            family_name="CREATE",
            body_rules={"storedRoutineBody", "compoundStatement"},
        )

    def _format_create_view(self, create_keyword: str, node: dict[str, Any]) -> str:
        children = node["children"]
        if len(children) < 3:
            raise UnsupportedStatementError("Incomplete CREATE VIEW statement.")

        view_index = next(
            (idx for idx, child in enumerate(children) if child.get("symbol") == "VIEW_SYMBOL"),
            None,
        )
        view_name_index = next(
            (
                idx
                for idx, child in enumerate(children)
                if idx > (view_index or -1) and child.get("rule") == "viewName"
            ),
            None,
        )
        tail_index = next(
            (
                idx
                for idx, child in enumerate(children)
                if idx > (view_name_index or -1) and child.get("rule") == "viewTail"
            ),
            None,
        )
        if view_index is None or view_name_index is None or tail_index is None:
            raise UnsupportedStatementError("Malformed CREATE VIEW statement.")

        prefix_parts: list[str] = []
        for child in children[:view_index]:
            formatted = self.format_node(child)
            if formatted:
                prefix_parts.append(formatted)

        head_parts = [create_keyword]
        head_parts.extend(prefix_parts)
        head_parts.append(self._kw_leaf(children[view_index]))
        head_parts.append(self.format_node(children[view_name_index]))
        head = " ".join(head_parts)

        tail = children[tail_index]
        if tail.get("rule") != "viewTail":
            raise UnsupportedStatementError("Unsupported CREATE VIEW tail.")

        tail_children = tail["children"]
        index = 0
        while index < len(tail_children) and tail_children[index].get("symbol") != "AS_SYMBOL":
            index += 1

        if index >= len(tail_children) or index + 1 >= len(tail_children):
            raise UnsupportedStatementError("Malformed CREATE VIEW tail.")

        if index:
            tail_prefix = self._join_parts(
                [(self.format_node(child), child) for child in tail_children[:index]]
            )
            if tail_prefix:
                if tail_prefix.startswith("("):
                    head += tail_prefix
                else:
                    head += f" {tail_prefix}"

        as_keyword = self._kw_leaf(tail_children[index])
        query_lines = [self.format_node(tail_children[index + 1])]
        for child in tail_children[index + 2 :]:
            formatted = self.format_node(child)
            if formatted:
                query_lines.append(formatted)
        _nl = "\n"
        return f"{head} {as_keyword}\n{self._indent_block(_nl.join(query_lines))}"

    def _format_create_table(self, create_keyword: str, node: dict[str, Any]) -> str:
        children = node["children"]
        if len(children) < 2:
            raise UnsupportedStatementError("Incomplete CREATE TABLE statement.")

        table_keyword = self._kw_leaf(children[0])

        table_index = next(
            (idx for idx, child in enumerate(children) if child.get("rule") == "tableName"),
            None,
        )
        body_index = next(
            (idx for idx, child in enumerate(children) if child.get("rule") == "tableElementList"),
            None,
        )
        if table_index is None:
            raise UnsupportedStatementError("Malformed CREATE TABLE statement.")

        prefix = [create_keyword, table_keyword]
        for child in children[1:table_index]:
            formatted = self.format_node(child)
            if formatted:
                prefix.append(formatted)

        table_name = self.format_node(children[table_index])
        head = f"{' '.join(prefix)} {table_name}"
        tail_children = children[table_index + 1 :]

        if not tail_children:
            return head

        if tail_children[0].get("symbol") == "LIKE_SYMBOL":
            if len(tail_children) < 2:
                raise UnsupportedStatementError("Incomplete CREATE TABLE ... LIKE statement.")
            like_clause = (
                f"{self._kw_leaf(tail_children[0])} {self.format_node(tail_children[1])}"
            )
            tail = self._format_create_table_tail(tail_children[2:])
            if not tail:
                return f"{head} {like_clause}"
            return self._prepend_head(f"{head} {like_clause}", tail)

        if tail_children[0].get("symbol") == "OPEN_PAR_SYMBOL":
            if len(tail_children) >= 4 and tail_children[1].get("symbol") == "LIKE_SYMBOL":
                if tail_children[3].get("symbol") != "CLOSE_PAR_SYMBOL":
                    raise UnsupportedStatementError("Malformed CREATE TABLE ... (LIKE ...) statement.")
                like_clause = (
                    f"({self._kw_leaf(tail_children[1])} {self.format_node(tail_children[2])})"
                )
                tail = self._format_create_table_tail(tail_children[4:])
                if not tail:
                    return f"{head} {like_clause}"
                return self._prepend_head(f"{head} {like_clause}", tail)

            if (
                body_index is not None
                and len(tail_children) >= 3
                and tail_children[1].get("rule") == "tableElementList"
            ):
                if tail_children[2].get("symbol") != "CLOSE_PAR_SYMBOL":
                    raise UnsupportedStatementError("Malformed CREATE TABLE statement.")
                body = self.format_node(tail_children[1])
                lines = [f"{head} ("]
                if body:
                    lines.append(self._indent_block(body))
                lines.append(")")
                tail = self._format_create_table_tail(tail_children[3:])
                if tail:
                    lines.extend(tail.splitlines())
                return "\n".join(lines)

            raise UnsupportedStatementError("Malformed CREATE TABLE statement.")

        if body_index is not None and tail_children[0].get("rule") == "tableElementList":
            body = self.format_node(tail_children[0])
            lines = [f"{head} ("]
            if body:
                lines.append(self._indent_block(body))
            lines.append(")")
            tail = self._format_create_table_tail(tail_children[1:])
            if tail:
                lines.extend(tail.splitlines())
            return "\n".join(lines)

        tail = self._format_create_table_tail(tail_children)
        if tail:
            return self._prepend_head(head, tail)

        raise UnsupportedStatementError("Malformed CREATE TABLE statement.")

    def _format_create_table_tail(self, children: list[dict[str, Any]]) -> str:
        parts: list[str] = []
        for child in children:
            formatted = self.format_node(child).strip()
            if formatted:
                parts.append(formatted)
        return "\n".join(parts)

    def _format_create_index(self, create_keyword: str, node: dict[str, Any]) -> str:
        children = node["children"]
        if len(children) < 4:
            raise UnsupportedStatementError("Incomplete CREATE INDEX statement.")
        head = self._join_parts(
            [(self.format_node(child), child) for child in children[:-1]]
        )
        target = self.format_node(children[-1])
        if "\n" not in target:
            return f"{create_keyword} {head}\n{target}"
        return "\n".join([f"{create_keyword} {head}", target])

    def _format_create_database(self, create_keyword: str, node: dict[str, Any]) -> str:
        children = node["children"]
        if len(children) < 2:
            raise UnsupportedStatementError("Incomplete CREATE DATABASE statement.")

        head_parts = [self._kw_leaf(children[0])]
        extra_head_parts, index = self._collect_head_parts(
            children,
            start=1,
            stop_rules={"schemaName"},
        )
        head_parts.extend(text for text, _ in extra_head_parts)

        if index >= len(children):
            raise UnsupportedStatementError("Missing CREATE DATABASE name.")

        head = f"{create_keyword} {' '.join(head_parts)} {self.format_node(children[index])}"
        options = self._formatted_children(children[index + 1 :])
        if not options:
            return head
        return "\n".join([head, *options])

    def rule_ifNotExists(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_ifExists(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_alterTable(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_alterTableActions(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_alterCommandList(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_alterList(self, node: dict[str, Any]) -> str:
        items = [
            self._format_segment(group)
            for group in self._group_children_by_symbol(node["children"], "COMMA_SYMBOL")
        ]
        return self._join_comma_items(items, multiline=len(items) > 1)

    def rule_alterListItem(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_alterDatabase(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_alterDatabaseOption(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_viewTail(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_viewCheckOption(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_queryExpression(self, node: dict[str, Any]) -> str:
        return self._format_query_body_with_tail(
            self.format_node(node["children"][0]), node["children"][1:]
        )

    def rule_queryExpressionWithOptLockingClauses(self, node: dict[str, Any]) -> str:
        return self._format_query_body_with_tail(
            self.format_node(node["children"][0]), node["children"][1:]
        )

    def rule_withClause(self, node: dict[str, Any]) -> str:
        children = node["children"]
        index = 0
        prefix: list[str] = []
        while index < len(children) and children[index].get("rule") != "commonTableExpression":
            prefix.append(self.format_node(children[index]))
            index += 1

        if index >= len(children):
            return " ".join(part for part in prefix if part)

        items = [
            self._format_segment(group)
            for group in self._group_children_by_symbol(children[index:], "COMMA_SYMBOL")
        ]
        header = " ".join(part for part in prefix if part)
        if len(items) == 1 and "\n" not in items[0]:
            return f"{header} {items[0]}"
        return f"{header}\n{self._indent_block(self._join_comma_items(items, multiline=True))}"

    def rule_commonTableExpression(self, node: dict[str, Any]) -> str:
        children = node["children"]
        subquery_index = next(
            (idx for idx, child in enumerate(children) if child.get("rule") == "subquery"),
            None,
        )
        if subquery_index is None:
            return self._inline_children(node)

        head = self._join_parts(
            [(self.format_node(child), child) for child in children[:subquery_index]]
        )
        subquery = self.format_node(children[subquery_index])
        return f"{head} {subquery}"

    def rule_lockingClauseList(self, node: dict[str, Any]) -> str:
        parts: list[str] = []
        for child in node["children"]:
            formatted = self.format_node(child)
            if formatted:
                parts.append(formatted)
        return "\n".join(parts)

    def rule_lockingClause(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_havingClause(self, node: dict[str, Any]) -> str:
        keyword = self._kw_leaf(node["children"][0])
        lines = self._format_condition_lines(node["children"][1])
        return self._format_keyword_lines(keyword, lines)

    def rule_limitClause(self, node: dict[str, Any]) -> str:
        return f"{self._kw_leaf(node['children'][0])} {self.format_node(node['children'][1])}"

    def rule_limitOptions(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_simpleLimitClause(self, node: dict[str, Any]) -> str:
        return f"{self._kw_leaf(node['children'][0])} {self.format_node(node['children'][1])}"

    def rule_limitOption(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_insertFromConstructor(self, node: dict[str, Any]) -> str:
        children = node["children"]
        if not children:
            return ""
        payload = self.format_node(children[-1])
        if len(children) == 1:
            return payload
        prefix = self._join_parts(
            [(self.format_node(child), child) for child in children[:-1]]
        )
        if "\n" in payload:
            return f"{prefix}\n{payload}"
        return f"{prefix} {payload}"

    def rule_insertQueryExpression(self, node: dict[str, Any]) -> str:
        children = node["children"]
        if not children:
            return ""
        query = self.format_node(children[-1])
        if len(children) == 1:
            return query
        prefix = self._join_parts(
            [(self.format_node(child), child) for child in children[:-1]]
        )
        return f"{prefix}\n{query}"

    def rule_insertValues(self, node: dict[str, Any]) -> str:
        keyword = self._kw_leaf(node["children"][0])
        values = self.format_node(node["children"][1])
        if "\n" in values:
            return f"{keyword}\n{self._indent_block(values)}"
        return f"{keyword} {values}"

    def rule_valueList(self, node: dict[str, Any]) -> str:
        items = [
            self._format_segment(group)
            for group in self._group_children_by_symbol(node["children"], "COMMA_SYMBOL")
        ]
        return self._join_comma_items(items, multiline=len(items) > 1)

    def rule_values(self, node: dict[str, Any]) -> str:
        return self._format_comma_list(node["children"], multiline=False)

    def rule_insertUpdateList(self, node: dict[str, Any]) -> str:
        children = node["children"]
        if len(children) < 5:
            return self._inline_children(node)
        head = " ".join(self._kw_leaf(child) for child in children[:4])
        body = self.format_node(children[4]).splitlines()
        return self._format_keyword_lines(head, body)

    def rule_fields(self, node: dict[str, Any]) -> str:
        return self._format_comma_list(node["children"], multiline=False)

    def rule_insertIdentifier(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_tableAliasRefList(self, node: dict[str, Any]) -> str:
        return self._format_comma_list(node["children"], multiline=False)

    def rule_tableRefList(self, node: dict[str, Any]) -> str:
        return self._format_comma_list(node["children"], multiline=len(node["children"]) > 1)

    def rule_viewRefList(self, node: dict[str, Any]) -> str:
        return self._format_comma_list(node["children"], multiline=len(node["children"]) > 1)

    def rule_viewRef(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_tableRefWithWildcard(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_columnInternalRefList(self, node: dict[str, Any]) -> str:
        children = node["children"]
        if len(children) < 2:
            return self._raw_inline_children(node)
        open_text = children[0].get("text", "(")
        close_text = children[-1].get("text", ")")
        body = self._format_comma_list(children[1:-1], multiline=False)
        return f"{open_text}{body}{close_text}"

    def rule_columnInternalRef(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_dropTable(self, node: dict[str, Any]) -> str:
        return self._format_drop_object_list(node["children"])

    def rule_dropView(self, node: dict[str, Any]) -> str:
        return self._format_drop_object_list(node["children"])

    def _format_drop_object_list(self, children: list[dict[str, Any]]) -> str:
        if not children:
            return ""
        head_parts, index = self._collect_head_parts(
            children,
            stop_rules={"tableRefList", "viewRefList"},
        )

        head = self._join_parts(head_parts)
        if index >= len(children):
            return head

        body = self.format_node(children[index])
        if "\n" not in body:
            return f"{head} {body}"
        return f"{head}\n{self._indent_block(body)}"

    def rule_dropIndex(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_dropDatabase(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_createDatabaseOption(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_createIndexTarget(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_keyListWithExpression(self, node: dict[str, Any]) -> str:
        children = node["children"]
        if len(children) != 3:
            return self._raw_inline_children(node)
        return f"{children[0].get('text', '(')}{self.format_node(children[1])}{children[2].get('text', ')')}"

    def rule_keyPartOrExpression(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_keyPart(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_direction(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_indexName(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_indexRef(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_indexNameAndType(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_schemaName(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_schemaRef(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_defaultCharset(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_charset(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_charsetName(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def _format_create_trigger(self, create_keyword: str, node: dict[str, Any]) -> str:
        children = node["children"]
        if len(children) < 10:
            raise UnsupportedStatementError("Incomplete CREATE TRIGGER statement.")

        compound_statement = children[9]
        if compound_statement.get("rule") != "compoundStatement" or len(
            compound_statement.get("children", [])
        ) != 1:
            raise UnsupportedStatementError("Only simple trigger bodies are supported.")

        header = [
            f"{create_keyword} {self._kw_leaf(children[0])} {self.format_node(children[1])}",
            (
                f"{self._kw_leaf(children[2])} {self._kw_leaf(children[3])} "
                f"{self._kw_leaf(children[4])} {self.format_node(children[5])}"
            ),
            f"{self._kw_leaf(children[6])} {self._kw_leaf(children[7])} {self._kw_leaf(children[8])}",
        ]
        body = self.format_node(compound_statement)
        return "\n".join(header + [self._indent_block(body)])

    def rule_compoundStatement(self, node: dict[str, Any]) -> str:
        children = node.get("children", [])
        if len(children) != 1:
            raise UnsupportedStatementError("Compound statement body is not supported.")
        child = children[0]
        if child.get("rule") == "simpleStatement":
            simple_children = child.get("children", [])
            if len(simple_children) != 1:
                raise UnsupportedStatementError("Malformed simple statement body.")
            return self.format_node(simple_children[0])
        return self.format_node(child)

    def rule_setStatement(self, node: dict[str, Any]) -> str:
        children = node["children"]
        assignments = self.format_node(children[1])
        return f"{self._kw_leaf(children[0])} {assignments}"

    def rule_startOptionValueList(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_optionValueNoOptionType(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_optionValueListContinued(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_queryExpressionBody(self, node: dict[str, Any]) -> str:
        children = node["children"]
        if len(children) == 1:
            return self.format_node(children[0])

        pieces = [self.format_node(children[0])]
        index = 1
        while index < len(children):
            operator_parts = [self._kw_leaf(children[index])]
            index += 1
            while index < len(children) - 1 and children[index].get("rule") == "unionOption":
                option = self.format_node(children[index])
                if option:
                    operator_parts.append(option)
                index += 1
            if index >= len(children):
                raise UnsupportedStatementError("Malformed query expression body.")
            pieces.append(" ".join(operator_parts))
            pieces.append(self.format_node(children[index]))
            index += 1
        return "\n".join(pieces)

    def rule_queryPrimary(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_queryExpressionParens(self, node: dict[str, Any]) -> str:
        inner = self.format_node(node["children"][1])
        if "\n" in inner or len(inner) > self.style.max_inline_length:
            return f"(\n{self._indent_block(inner)}\n)"
        return f"({inner})"

    def rule_querySpecification(self, node: dict[str, Any]) -> str:
        children = node["children"]
        select_keyword = self._kw_leaf(children[0])

        index = 1
        options: list[str] = []
        while index < len(children) and children[index].get("rule") == "selectOption":
            options.append(self.format_node(children[index]))
            index += 1

        if index >= len(children) or children[index].get("rule") != "selectItemList":
            raise UnsupportedStatementError("Missing SELECT item list.")

        select_items = self.format_node(children[index])
        head = select_keyword
        if options:
            head += " " + " ".join(options)

        lines = []
        if (
            self.style.break_select_items
            or "\n" in select_items
            or len(f"{head} {select_items}") > self.style.max_inline_length
        ):
            lines.extend([head, self._indent_block(select_items)])
        else:
            lines.append(f"{head} {select_items}")

        for child in children[index + 1 :]:
            lines.append(self.format_node(child))
        return "\n".join(lines)

    def rule_selectOption(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_selectItemList(self, node: dict[str, Any]) -> str:
        groups = self._group_children_by_symbol(node["children"], "COMMA_SYMBOL")
        items = [self._format_segment(group) for group in groups]
        multiline = (
            len(items) > 1
            if self.style.break_select_items is None
            else self.style.break_select_items
        ) or any("\n" in item for item in items)
        if not multiline and len(", ".join(items)) > self.style.max_inline_length:
            multiline = True
        return self._join_comma_items(items, multiline=multiline)

    def rule_selectItem(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_intoClause(self, node: dict[str, Any]) -> str:
        keyword = self._kw_leaf(node["children"][0])
        body = self._format_comma_list(node["children"][1:], multiline=len(node["children"]) > 2)
        return self._format_keyword_lines(keyword, body.splitlines())

    def rule_fromClause(self, node: dict[str, Any]) -> str:
        keyword = self._kw_leaf(node["children"][0])
        body = self.format_node(node["children"][1])
        return self._format_keyword_lines(keyword, body.splitlines())

    def rule_tableReferenceList(self, node: dict[str, Any]) -> str:
        groups = self._group_children_by_symbol(node["children"], "COMMA_SYMBOL")
        items = [self._format_segment(group) for group in groups]
        return self._join_comma_items(items, multiline=len(items) > 1 or any("\n" in item for item in items))

    def rule_tableReference(self, node: dict[str, Any]) -> str:
        children = node["children"]
        if len(children) == 1:
            return self.format_node(children[0])
        lines = [self.format_node(children[0])]
        lines.extend(self.format_node(child) for child in children[1:])
        return "\n".join(lines)

    def rule_tableFactor(self, node: dict[str, Any]) -> str:
        children = node["children"]
        if len(children) == 1:
            return self.format_node(children[0])
        lines = [self.format_node(children[0])]
        lines.extend(self.format_node(child) for child in children[1:])
        return "\n".join(lines)

    def rule_derivedTable(self, node: dict[str, Any]) -> str:
        children = node["children"]
        if len(children) == 1:
            return self.format_node(children[0])
        tail: list[str] = []
        for child in children[1:]:
            formatted = self.format_node(child)
            if formatted:
                tail.append(formatted)
        return f"{self.format_node(children[0])} {' '.join(tail)}"

    def rule_joinedTable(self, node: dict[str, Any]) -> str:
        children = node["children"]
        if len(children) < 4:
            return self._inline_children(node)

        join_head = f"{self.format_node(children[0])} {self.format_node(children[1])}"
        keyword = self._kw_leaf(children[2])

        if children[2].get("symbol") == "ON_SYMBOL":
            lines = self._format_condition_lines(children[3])
            return (
                f"{join_head}\n"
                f"{self._indent_block(f'{keyword} {lines[0]}')}"
                + (
                    ""
                    if len(lines) == 1
                    else "\n"
                    + self._indent_block("\n".join(lines[1:]), 2)
                )
            )

        return f"{join_head}\n{self._indent_block(f'{keyword} {self.format_node(children[3])}')}"

    def rule_outerJoinType(self, node: dict[str, Any]) -> str:
        return " ".join(self._kw_leaf(child) for child in node["children"])

    def rule_innerJoinType(self, node: dict[str, Any]) -> str:
        return " ".join(self._kw_leaf(child) for child in node["children"])

    def rule_whereClause(self, node: dict[str, Any]) -> str:
        keyword = self._kw_leaf(node["children"][0])
        lines = self._format_condition_lines(node["children"][1])
        return self._format_keyword_lines(keyword, lines)

    def rule_groupByClause(self, node: dict[str, Any]) -> str:
        children = node["children"]
        keyword = f"{self._kw_leaf(children[0])} {self._kw_leaf(children[1])}"
        lines = self.format_node(children[2]).splitlines()
        if len(children) > 3:
            lines.extend(self.format_node(child).splitlines() for child in children[3:])
            flattened: list[str] = []
            for entry in lines:
                if isinstance(entry, list):
                    flattened.extend(entry)
                else:
                    flattened.append(entry)
            lines = flattened
        return self._format_keyword_lines(keyword, lines)

    def rule_orderClause(self, node: dict[str, Any]) -> str:
        keyword = f"{self._kw_leaf(node['children'][0])} {self._kw_leaf(node['children'][1])}"
        body = self.format_node(node["children"][2])
        return self._format_keyword_lines(keyword, body.splitlines())

    def rule_orderList(self, node: dict[str, Any]) -> str:
        return self._format_comma_list(node["children"], multiline=len(node["children"]) > 1)

    def rule_orderExpression(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_olapOption(self, node: dict[str, Any]) -> str:
        return " ".join(self._kw_leaf(child) for child in node["children"])

    def rule_unionOption(self, node: dict[str, Any]) -> str:
        return " ".join(self._kw_leaf(child) for child in node["children"])

    def rule_expr(self, node: dict[str, Any]) -> str:
        return self._format_binary_or_inline(node)

    def rule_boolPri(self, node: dict[str, Any]) -> str:
        return self._format_binary_or_inline(node)

    def rule_predicate(self, node: dict[str, Any]) -> str:
        return self._format_binary_or_inline(node)

    def rule_bitExpr(self, node: dict[str, Any]) -> str:
        return self._format_binary_or_inline(node)

    def _format_binary_or_inline(self, node: dict[str, Any]) -> str:
        children = node.get("children", [])
        if len(children) == 1:
            return self.format_node(children[0])
        if len(children) == 3 and children[1].get("rule") in {"compOp", "equal"}:
            return (
                f"{self.format_node(children[0])} {self.format_node(children[1])} "
                f"{self.format_node(children[2])}"
            )
        return self._inline_children(node)

    def rule_compOp(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_equal(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_simpleExpr(self, node: dict[str, Any]) -> str:
        children = node.get("children", [])
        if children and children[0].get("symbol") == "CASE_SYMBOL":
            return self._format_case(node)
        if len(children) == 2 and children[1].get("rule") == "jsonOperator":
            return "".join(self.format_node(child) for child in children)
        if children and children[0].get("symbol") in {
            "CAST_SYMBOL",
            "CONVERT_SYMBOL",
            "DEFAULT_SYMBOL",
            "VALUES_SYMBOL",
        }:
            return self._join_function_parts(children)
        if children and children[0].get("rule") in {
            "columnRef",
            "functionCall",
            "runtimeFunctionCall",
            "literalOrNull",
            "userVariable",
            "rvalueSystemOrUserVariable",
            "subquery",
            "tableWild",
        }:
            return self.format_node(children[0])
        return self._inline_children(node)

    def rule_sumExpr(self, node: dict[str, Any]) -> str:
        return self._join_function_parts(node["children"])

    def rule_groupingOperation(self, node: dict[str, Any]) -> str:
        return self._join_function_parts(node["children"])

    def rule_windowFunctionCall(self, node: dict[str, Any]) -> str:
        return self._join_function_parts(node["children"])

    def rule_jsonFunction(self, node: dict[str, Any]) -> str:
        return self._join_function_parts(node["children"])

    def rule_jsonOperator(self, node: dict[str, Any]) -> str:
        return "".join(self.format_node(child) for child in node["children"])

    def rule_functionCall(self, node: dict[str, Any]) -> str:
        children = node["children"]
        open_index = next(
            (idx for idx, child in enumerate(children) if child.get("symbol") == "OPEN_PAR_SYMBOL"),
            None,
        )
        close_index = next(
            (idx for idx, child in enumerate(children) if child.get("symbol") == "CLOSE_PAR_SYMBOL"),
            None,
        )
        if open_index is None or close_index is None:
            return self._inline_children(node)

        name = "".join(self.format_node(child) for child in children[:open_index])
        if close_index == open_index + 1:
            return f"{name}()"

        arg_node = children[open_index + 1]
        args = self.format_node(arg_node)
        multiline = (
            self.style.break_function_args
            or "\n" in args
            or len(f"{name}({args})") > self.style.max_inline_length
        )
        if multiline:
            return f"{name}(\n{self._indent_block(args)}\n)"
        return f"{name}({args})"

    def rule_runtimeFunctionCall(self, node: dict[str, Any]) -> str:
        children = node["children"]
        if len(children) == 1:
            if children[0].get("rule"):
                return self._join_function_parts(children[0].get("children", []))
            return self._kw_leaf(children[0])
        if len(children) == 2:
            return f"{self._kw_leaf(children[0])}{self.format_node(children[1])}"
        return self._join_function_parts(children)

    def rule_substringFunction(self, node: dict[str, Any]) -> str:
        return self._join_function_parts(node["children"])

    def rule_trimFunction(self, node: dict[str, Any]) -> str:
        return self._join_function_parts(node["children"])

    def rule_geometryFunction(self, node: dict[str, Any]) -> str:
        return self._join_function_parts(node["children"])

    def rule_timeFunctionParameters(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_updateList(self, node: dict[str, Any]) -> str:
        groups = self._group_children_by_symbol(node["children"], "COMMA_SYMBOL")
        items = [self._format_segment(group) for group in groups]
        return self._join_comma_items(items, multiline=len(items) > 1)

    def rule_updateElement(self, node: dict[str, Any]) -> str:
        if len(node["children"]) != 3:
            return self._inline_children(node)
        return (
            f"{self.format_node(node['children'][0])} {node['children'][1].get('text', '=')} "
            f"{self.format_node(node['children'][2])}"
        )

    def rule_exprList(self, node: dict[str, Any]) -> str:
        return self._format_comma_list(
            node["children"],
            multiline=self.style.break_function_args,
        )

    def rule_udfExprList(self, node: dict[str, Any]) -> str:
        return self.rule_exprList(node)

    def rule_udfExpr(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_columnRef(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_fieldIdentifier(self, node: dict[str, Any]) -> str:
        return "".join(self.format_node(child) for child in node["children"])

    def rule_qualifiedIdentifier(self, node: dict[str, Any]) -> str:
        return "".join(self.format_node(child) for child in node["children"])

    def rule_identifier(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_identifierKeyword(self, node: dict[str, Any]) -> str:
        child = node["children"][0]
        return child.get("text", self.format_node(child))

    def rule_identifierKeywordsUnambiguous(self, node: dict[str, Any]) -> str:
        child = node["children"][0]
        return child.get("text", self.format_node(child))

    def rule_pureIdentifier(self, node: dict[str, Any]) -> str:
        child = node["children"][0]
        return self._format_identifier_text(child.get("text", ""))

    def rule_dotIdentifier(self, node: dict[str, Any]) -> str:
        children = node["children"]
        if len(children) != 2:
            return self._raw_inline_children(node)
        return f"{children[0].get('text', '.')}{self.format_node(children[1])}"

    def rule_tableWild(self, node: dict[str, Any]) -> str:
        children = node["children"]
        if len(children) != 3:
            return self._raw_inline_children(node)
        return f"{self.format_node(children[0])}{children[1].get('text', '.')}{children[2].get('text', '*')}"

    def rule_userVariable(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_userVariableIdentifier(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_lvalueVariable(self, node: dict[str, Any]) -> str:
        return "".join(self.format_node(child) for child in node["children"])

    def rule_rvalueSystemVariable(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_rvalueSystemOrUserVariable(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_textOrIdentifier(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_literal(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_literalOrNull(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_numLiteral(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_int64Literal(self, node: dict[str, Any]) -> str:
        return node["children"][0].get("text", "")

    def rule_real_ulonglong_number(self, node: dict[str, Any]) -> str:
        return self._raw_inline_children(node)

    def rule_tableRef(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_tableName(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_viewName(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_triggerName(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_columnName(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_tableAlias(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_constraintName(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_viewQueryBlock(self, node: dict[str, Any]) -> str:
        return self._format_query_body_with_tail(
            self.format_node(node["children"][0]), node["children"][1:]
        )

    def rule_subquery(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_columnDefinition(self, node: dict[str, Any]) -> str:
        return f"{self.format_node(node['children'][0])} {self.format_node(node['children'][1])}"

    def rule_fieldDefinition(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_dataType(self, node: dict[str, Any]) -> str:
        output: list[str] = []
        previous_kind = None
        previous_text = ""
        for child in node["children"]:
            text = self.format_node(child)
            if not text:
                continue
            kind = self._node_kind(child)
            if output and child.get("rule") not in {"fieldLength", "floatOptions"}:
                if self._needs_space(previous_kind, kind, previous_text):
                    output.append(" ")
            output.append(text)
            previous_kind = kind
            previous_text = text
        return "".join(output)

    def rule_floatOptions(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_precision(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_fieldLength(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_tableElementList(self, node: dict[str, Any]) -> str:
        groups = self._group_children_by_symbol(node["children"], "COMMA_SYMBOL")
        items = [self._format_segment(group) for group in groups]
        return self._join_comma_items(items, multiline=True)

    def rule_tableElement(self, node: dict[str, Any]) -> str:
        return self.format_node(node["children"][0])

    def rule_tableConstraintDef(self, node: dict[str, Any]) -> str:
        children = node["children"]
        references_index = next(
            (idx for idx, child in enumerate(children) if child.get("rule") == "references"),
            None,
        )
        if references_index is None:
            return self._inline_children(node)

        head = self._join_parts(
            [(self.format_node(child), child) for child in children[:references_index]]
        )
        references = self.format_node(children[references_index])
        return f"{head}\n{self._indent_block(references)}"

    def rule_keyList(self, node: dict[str, Any]) -> str:
        children = node["children"]
        if len(children) != 3:
            return self._raw_inline_children(node)
        return f"{children[0].get('text', '(')}{self.format_node(children[1])}{children[2].get('text', ')')}"

    def rule_identifierListWithParentheses(self, node: dict[str, Any]) -> str:
        children = node["children"]
        if len(children) != 3:
            return self._raw_inline_children(node)
        return f"{children[0].get('text', '(')}{self.format_node(children[1])}{children[2].get('text', ')')}"

    def rule_identifierList(self, node: dict[str, Any]) -> str:
        return self._format_comma_list(node["children"], multiline=False)

    def rule_references(self, node: dict[str, Any]) -> str:
        children = node["children"]
        if len(children) < 3:
            return self._inline_children(node)
        head = (
            f"{self._kw_leaf(children[0])} {self.format_node(children[1])} "
            f"{self.format_node(children[2])}"
        )
        if len(children) == 3:
            return head
        tail = [self.format_node(child) for child in children[3:]]
        return "\n".join([head, *tail])

    def rule_createTableOptionsEtc(self, node: dict[str, Any]) -> str:
        parts: list[str] = []
        for child in node["children"]:
            formatted = self.format_node(child).strip()
            if formatted:
                parts.append(formatted)
        return "\n".join(parts)

    def rule_createPartitioningEtc(self, node: dict[str, Any]) -> str:
        parts: list[str] = []
        for child in node["children"]:
            formatted = self.format_node(child).strip()
            if formatted:
                parts.append(formatted)
        return "\n".join(parts)

    def rule_duplicateAsQe(self, node: dict[str, Any]) -> str:
        if not node["children"]:
            return ""
        return self.format_node(node["children"][0])

    def rule_asCreateQueryExpression(self, node: dict[str, Any]) -> str:
        children = node["children"]
        if len(children) != 2:
            return self._inline_children(node)
        keyword = self._kw_leaf(children[0])
        query = self.format_node(children[1])
        if "\n" not in query:
            return f"{keyword} {query}"
        return f"{keyword}\n{self._indent_block(query)}"

    def rule_createTableOptions(self, node: dict[str, Any]) -> str:
        items: list[str] = []
        for child in node["children"]:
            formatted = self.format_node(child)
            if formatted:
                items.append(formatted)
        if not items:
            return ""
        if len(items) == 1 and not self.style.table_options_per_line:
            return items[0]
        return "\n".join(items)

    def rule_createTableOption(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)

    def rule_engineRef(self, node: dict[str, Any]) -> str:
        return self._inline_children(node)
