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

import os
import pathlib
import subprocess
from textwrap import dedent

import mysqlsh
import pytest
from mysqlsh import mysql

from util_plugin.sql.exported import reformat_sql


WHITESPACE_TOKEN_TYPES = {"WHITESPACE"}


def sql_block(text: str) -> str:
    return dedent(text).strip("\n")


def mysql_parser_options(
    *,
    ansi_quotes: bool | None = None,
    no_backslash_escapes: bool | None = None,
) -> dict[str, bool]:
    options: dict[str, bool] = {}
    if ansi_quotes is not None:
        options["ansiQuotes"] = ansi_quotes
    if no_backslash_escapes is not None:
        options["noBackslashEscapes"] = no_backslash_escapes
    return options


def mysql_tokenizer_options(
    *,
    ansi_quotes: bool | None = None,
    no_backslash_escapes: bool | None = None,
) -> dict[str, bool]:
    del ansi_quotes
    options: dict[str, bool] = {}
    if no_backslash_escapes is not None:
        options["noBackslashEscapes"] = no_backslash_escapes
    return options


def parser_kwargs_from_reformat_kwargs(kwargs: dict[str, object]) -> dict[str, bool | None]:
    return {
        "ansi_quotes": kwargs.get("ansiQuotes"),
        "no_backslash_escapes": kwargs.get("noBackslashEscapes"),
    }


def statement_chunks(
    sql: str,
    *,
    ansi_quotes: bool | None = None,
    no_backslash_escapes: bool | None = None,
) -> list[str]:
    options = mysql_parser_options(
        ansi_quotes=ansi_quotes,
        no_backslash_escapes=no_backslash_escapes,
    )
    chunks = mysql.split_script(sql, options) if options else mysql.split_script(sql)
    if chunks:
        return list(chunks)
    return [sql] if sql.strip() else []


def simple_token_list(
    sql: str,
    *,
    ansi_quotes: bool | None = None,
    no_backslash_escapes: bool | None = None,
) -> list[tuple[str, str]]:
    tokens: list[tuple[str, str]] = []
    options = mysql_tokenizer_options(
        ansi_quotes=ansi_quotes,
        no_backslash_escapes=no_backslash_escapes,
    )
    for chunk in statement_chunks(
        sql,
        ansi_quotes=ansi_quotes,
        no_backslash_escapes=no_backslash_escapes,
    ):
        token_stream = (
            mysql.tokenize_statement(chunk, options)
            if options
            else mysql.tokenize_statement(chunk)
        )
        for token in token_stream:
            token_type = token["type"]
            if token_type in WHITESPACE_TOKEN_TYPES:
                continue

            token_text = token["token"]
            if token_type.endswith("_SYMBOL"):
                token_text = token_text.lower()

            tokens.append((token_type, token_text))

    return tokens


def assert_parseable_sql(
    sql: str,
    *,
    ansi_quotes: bool | None = None,
    no_backslash_escapes: bool | None = None,
) -> None:
    options = mysql_parser_options(
        ansi_quotes=ansi_quotes,
        no_backslash_escapes=no_backslash_escapes,
    )
    for chunk in statement_chunks(
        sql,
        ansi_quotes=ansi_quotes,
        no_backslash_escapes=no_backslash_escapes,
    ):
        if options:
            mysql.parse_statement_ast(chunk, options)
        else:
            mysql.parse_statement_ast(chunk)


def is_parseable_sql(
    sql: str,
    *,
    ansi_quotes: bool | None = None,
    no_backslash_escapes: bool | None = None,
) -> bool:
    try:
        assert_parseable_sql(
            sql,
            ansi_quotes=ansi_quotes,
            no_backslash_escapes=no_backslash_escapes,
        )
    except Exception:
        return False
    return True


def assert_reformatted_sql(
    source: str,
    expected: str,
    *,
    expect_parseable: bool = True,
    expect_same_tokens: bool = True,
    **reformat_kwargs,
) -> None:
    actual = reformat_sql(source, **reformat_kwargs)
    parser_kwargs = parser_kwargs_from_reformat_kwargs(reformat_kwargs)
    assert actual == expected
    if expect_parseable:
        assert_parseable_sql(actual, **parser_kwargs)
    else:
        assert not is_parseable_sql(source, **parser_kwargs)
        assert not is_parseable_sql(actual, **parser_kwargs)

    if expect_same_tokens:
        assert simple_token_list(source, **parser_kwargs) == simple_token_list(
            actual,
            **parser_kwargs,
        )


PARSER_MODE_COMBINATIONS = [
    pytest.param(
        {"ansiQuotes": False, "noBackslashEscapes": False},
        id="ansiQuotes_off__noBackslashEscapes_off",
    ),
    pytest.param(
        {"ansiQuotes": False, "noBackslashEscapes": True},
        id="ansiQuotes_off__noBackslashEscapes_on",
    ),
    pytest.param(
        {"ansiQuotes": True, "noBackslashEscapes": False},
        id="ansiQuotes_on__noBackslashEscapes_off",
    ),
    pytest.param(
        {"ansiQuotes": True, "noBackslashEscapes": True},
        id="ansiQuotes_on__noBackslashEscapes_on",
    ),
]


WORKBENCH_CORPUS_CASES = [
    pytest.param(
        sql_block(
            """
            SELECT
                DomainID, Domains.Domain
            FROM
                Domains
                    LEFT OUTER JOIN
                Ping_Test_Results USING (DomainID)
                    LEFT OUTER JOIN
                Sites USING (SiteID)
            WHERE
                Ping_Test_Results.DomainID IS NULL
                    AND Domains.Ping_Test_Is_Active = TRUE
                    AND Sites.Ping_Test_Is_Active = TRUE
            """
        ),
        sql_block(
            """
            SELECT
                DomainID,
                Domains.Domain
            FROM
                Domains
                LEFT OUTER JOIN Ping_Test_Results
                    USING (DomainID)
                LEFT OUTER JOIN Sites
                    USING (SiteID)
            WHERE
                Ping_Test_Results.DomainID IS NULL
                AND Domains.Ping_Test_Is_Active = TRUE
                AND Sites.Ping_Test_Is_Active = TRUE
            """
        ),
        id="bug11765385",
    ),
    pytest.param(
        sql_block(
            """
            SELECT
                CASE
                    WHEN @@server_id > 1 THEN 1
                    ELSE 0
                END
            FROM
                t1
            """
        ),
        sql_block(
            """
            SELECT
                CASE
                    WHEN @@server_id > 1 THEN 1
                    ELSE 0
                END
            FROM
                t1
            """
        ),
        id="bug11765397",
    ),
    pytest.param(
        sql_block(
            """
            SELECT
                `Table`.`Field1`, `Table`.`Field2`, `Table`.`Field3`
            FROM
                `DB`.`Table`
            """
        ),
        sql_block(
            """
            SELECT
                `Table`.`Field1`,
                `Table`.`Field2`,
                `Table`.`Field3`
            FROM
                `DB`.`Table`
            """
        ),
        id="bug11926859",
    ),
    pytest.param(
        sql_block(
            """
            SELECT
                `field1`, `field2`
            FROM
                `table_name` `t`
            """
        ),
        sql_block(
            """
            SELECT
                `field1`,
                `field2`
            FROM
                `table_name` `t`
            """
        ),
        id="bug12327013",
    ),
    pytest.param(
        "SELECT 1 UNION SELECT 2",
        sql_block(
            """
            SELECT 1
            UNION
            SELECT 2
            """
        ),
        id="bug13629967",
    ),
    pytest.param(
        sql_block(
            """
            SELECT
                *
            FROM
                `table1`
            UNION SELECT
                *
            FROM
                `table2`
            """
        ),
        sql_block(
            """
            SELECT *
            FROM
                `table1`
            UNION
            SELECT *
            FROM
                `table2`
            """
        ),
        id="bug13629967_65619",
    ),
    pytest.param(
        sql_block(
            """
            SELECT
                z.zquarter nquarter,
                z.zmonth nmonth,
                MONTH(z.zdate) ydate,
                DATE_FORMAT(z.zdate, '%M, %Y') zmonth,
                FORMAT(z.amntD, 2, 'en_IN') amntD,
                FORMAT(z.amntC, 2, 'en_IN') amntC,
                FORMAT(z.amntD - z.amntC, 2, 'en_IN') balance,
                FORMAT(@balancerunning:=@balancerunning + (z.amntD - z.amntC),
                    2,
                    'en_IN') balancerunning
            FROM
                (SELECT @balancerunning:=0) r,
                (SELECT
                    IF(QUARTER(STR_TO_DATE(trdt, '%d/%m/%Y')) - 1 = 0, 4, QUARTER(STR_TO_DATE(trdt, '%d/%m/%Y')) - 1) zquarter,
                        MONTH(STR_TO_DATE(trdt, '%d/%m/%Y')) zmonth,
                        STR_TO_DATE(trdt, '%d/%m/%Y') zdate,
                        SUM(IF(a.crdr = 'D', a.amnt, 0)) amntD,
                        SUM(IF(a.crdr = 'C', a.amnt, 0)) amntC
                FROM
                    mcsca.mntra a
                WHERE
                    a.bkcd = 'SALET'
                        AND (a.cocd , a.coyr) = (SELECT
                            lstcocd, lstcoyr
                        FROM
                            mcsca.mnusr
                        WHERE
                            user = 'admin')
                GROUP BY zquarter , zmonth WITH ROLLUP) z
            """
        ),
        sql_block(
            """
            SELECT
                z.zquarter nquarter,
                z.zmonth nmonth,
                MONTH(z.zdate) ydate,
                DATE_FORMAT(z.zdate, '%M, %Y') zmonth,
                FORMAT(z.amntD, 2, 'en_IN') amntD,
                FORMAT(z.amntC, 2, 'en_IN') amntC,
                FORMAT(z.amntD - z.amntC, 2, 'en_IN') balance,
                FORMAT(@balancerunning:=@balancerunning + (z.amntD - z.amntC),
                    2,
                    'en_IN') balancerunning
            FROM
                (SELECT @balancerunning:=0) r,
                (SELECT
                    IF(QUARTER(STR_TO_DATE(trdt, '%d/%m/%Y')) - 1 = 0, 4, QUARTER(STR_TO_DATE(trdt, '%d/%m/%Y')) - 1) zquarter,
                        MONTH(STR_TO_DATE(trdt, '%d/%m/%Y')) zmonth,
                        STR_TO_DATE(trdt, '%d/%m/%Y') zdate,
                        SUM(IF(a.crdr = 'D', a.amnt, 0)) amntD,
                        SUM(IF(a.crdr = 'C', a.amnt, 0)) amntC
                FROM
                    mcsca.mntra a
                WHERE
                    a.bkcd = 'SALET'
                        AND (a.cocd , a.coyr) = (SELECT
                            lstcocd, lstcoyr
                        FROM
                            mcsca.mnusr
                        WHERE
                            user = 'admin')
                GROUP BY zquarter , zmonth WITH ROLLUP) z
            """
        ),
        id="bug13919924_passthrough",
    ),
    pytest.param(
        sql_block(
            """
            SELECT
                ti.idTipoInstrumento,
                ti.nombre,
                ti.descripcion,
                ti.idVariableQueMide
            FROM
                tiposinstrumentos ti
                    LEFT OUTER JOIN
                (SELECT DISTINCT
                    (idTipoInstrumento)
                FROM
                    estadosinstrumentos
                WHERE
                    idEstacion = 3) AS tiposInstrumentosEstacion ON ti.idTipoInstrumento = tiposInstrumentosEstacion.idTipoInstrumento
            WHERE
                tiposInstrumentosEstacion.idTipoInstrumento IS NULL
            ORDER BY ti.nombr
            """
        ),
        sql_block(
            """
            SELECT
                ti.idTipoInstrumento,
                ti.nombre,
                ti.descripcion,
                ti.idVariableQueMide
            FROM
                tiposinstrumentos ti
                LEFT OUTER JOIN (
                    SELECT DISTINCT (idTipoInstrumento)
                    FROM
                        estadosinstrumentos
                    WHERE
                        idEstacion = 3
                ) AS tiposInstrumentosEstacion
                    ON ti.idTipoInstrumento = tiposInstrumentosEstacion.idTipoInstrumento
            WHERE
                tiposInstrumentosEstacion.idTipoInstrumento IS NULL
            ORDER BY
                ti.nombr
            """
        ),
        id="bug13970596",
    ),
    pytest.param(
        sql_block(
            """
            SELECT
                MIN(idImage), MAX(idImage)
            INTO @min , @max FROM
                tblimage
            """
        ),
        sql_block(
            """
            SELECT
                MIN(idImage),
                MAX(idImage)
            INTO
                @min,
                @max
            FROM
                tblimage
            """
        ),
        id="bug18502104",
    ),
    pytest.param("SELECT NOW()", "SELECT NOW()", id="bug19477485"),
    pytest.param("SELECT sch.func(123)", "SELECT sch.func(123)", id="qualified_function"),
    pytest.param(
        sql_block(
            """
            SELECT
                st.*
            FROM
                st
            """
        ),
        sql_block(
            """
            SELECT st.*
            FROM
                st
            """
        ),
        id="select_table_dot_star",
    ),
]

SQL_BEAUTIFY_BUG_CASES = [
    pytest.param(
        sql_block(
            r"""
            SELECT id, pdflocation
            FROM my_db.some_table
            WHERE pdflocation NOT REGEXP '\\[(\"[12][019][0-9]{2}\\\\/(jan|jul)\\\\/gg[0-9]{5}\_nn[0-9]{1,4}[a-z]{0,1}
            \.pdf\"[,]{0,1})*\\]'
            """
        ),
        sql_block(
            r"""
            SELECT id, pdflocation
            FROM my_db.some_table
            WHERE pdflocation NOT REGEXP '\\[(\"[12][019][0-9]{2}\\\\/(jan|jul)\\\\/gg[0-9]{5}\_nn[0-9]{1,4}[a-z]{0,1}
            \.pdf\"[,]{0,1})*\\]'
            """
        ),
        id="bug20573899_regexp_literal_preserved",
    ),
    pytest.param(
        r"select '\\\\server\\share\\path' as unc_path",
        r"SELECT '\\\\server\\share\\path' AS unc_path",
        id="bug25407678_double_backslash_literal_preserved",
    ),
    pytest.param(
        "CREATE VIEW `v_test` AS select cast(`ra`.`hours` as double) AS `hours_raw` "
        "from `v_resource_allocation_compact` `ra`",
        sql_block(
            """
            CREATE VIEW `v_test` AS
                SELECT CAST(`ra`.`hours` AS DOUBLE) AS `hours_raw`
                FROM
                    `v_resource_allocation_compact` `ra`
            """
        ),
        id="bug31826437_create_view_cast_as_double",
    ),
    pytest.param(
        "CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER "
        "VIEW `sakila`.`nicer_but_slower_film_list` AS select "
        "`sakila`.`film`.`film_id` AS `FID`,"
        "`sakila`.`film`.`title` AS `title`,"
        "`sakila`.`film`.`description` AS `description`,"
        "`sakila`.`category`.`name` AS `category`,"
        "`sakila`.`film`.`rental_rate` AS `price`,"
        "`sakila`.`film`.`length` AS `length`,"
        "`sakila`.`film`.`rating` AS `rating`,"
        "group_concat(concat(concat(upper(substr(`sakila`.`actor`.`first_name`,1,1)),"
        "lower(substr(`sakila`.`actor`.`first_name`,2,length(`sakila`.`actor`.`first_name`))),"
        "_utf8mb4' ',concat(upper(substr(`sakila`.`actor`.`last_name`,1,1)),"
        "lower(substr(`sakila`.`actor`.`last_name`,2,length(`sakila`.`actor`.`last_name`)))))) "
        "separator ', ') AS `actors` from ((((`sakila`.`category` left join "
        "`sakila`.`film_category` on((`sakila`.`category`.`category_id` = "
        "`sakila`.`film_category`.`category_id`))) left join `sakila`.`film` "
        "on((`sakila`.`film_category`.`film_id` = `sakila`.`film`.`film_id`))) "
        "join `sakila`.`film_actor` on((`sakila`.`film`.`film_id` = "
        "`sakila`.`film_actor`.`film_id`))) join `sakila`.`actor` "
        "on((`sakila`.`film_actor`.`actor_id` = `sakila`.`actor`.`actor_id`))) "
        "group by `sakila`.`film`.`film_id`,`sakila`.`category`.`name`",
        sql_block(
            """
            CREATE ALGORITHM = UNDEFINED DEFINER = `root`@`localhost` SQL SECURITY DEFINER VIEW `sakila`.`nicer_but_slower_film_list` AS
                SELECT
                    `sakila`.`film`.`film_id` AS `FID`,
                    `sakila`.`film`.`title` AS `title`,
                    `sakila`.`film`.`description` AS `description`,
                    `sakila`.`category`.`name` AS `category`,
                    `sakila`.`film`.`rental_rate` AS `price`,
                    `sakila`.`film`.`length` AS `length`,
                    `sakila`.`film`.`rating` AS `rating`,
                    GROUP_CONCAT(concat(
                        concat(
                            upper(SUBSTR(`sakila`.`actor`.`first_name`, 1, 1)), lower(
                                SUBSTR(`sakila`.`actor`.`first_name`, 2, length(`sakila`.`actor`.`first_name`))
                            ), _utf8mb4 ' ', concat(
                                upper(SUBSTR(`sakila`.`actor`.`last_name`, 1, 1)), lower(
                                    SUBSTR(`sakila`.`actor`.`last_name`, 2, length(`sakila`.`actor`.`last_name`))
                                )
                            )
                        )
                    ) SEPARATOR ', ') AS `actors`
                FROM
                    ((((`sakila`.`category`
                    LEFT JOIN `sakila`.`film_category`
                        ON ((`sakila`.`category`.`category_id` = `sakila`.`film_category`.`category_id`)))
                    LEFT JOIN `sakila`.`film`
                        ON ((`sakila`.`film_category`.`film_id` = `sakila`.`film`.`film_id`)))
                    JOIN `sakila`.`film_actor`
                        ON ((`sakila`.`film`.`film_id` = `sakila`.`film_actor`.`film_id`)))
                    JOIN `sakila`.`actor`
                        ON ((`sakila`.`film_actor`.`actor_id` = `sakila`.`actor`.`actor_id`)))
                GROUP BY
                    `sakila`.`film`.`film_id`,
                    `sakila`.`category`.`name`
            """
        ),
        id="create_view_sakila_nicer_but_slower_film_list",
    ),
    pytest.param(
        sql_block(
            """
            select host, User from mysql.db
            where
            -- host = '%' and
            Select_priv in ('Y' , 'N');
            """
        ),
        sql_block(
            """
            select host, User from mysql.db
            where
            -- host = '%' and
            Select_priv in ('Y' , 'N');
            """
        ),
        id="bug14171804_sql_comment_preserved",
    ),
    pytest.param(
        "update mysql.db set User = User where Select_priv in ('Y','N');",
        sql_block(
            """
            UPDATE mysql.db
            SET
                User = User
            WHERE
                Select_priv IN ('Y', 'N');
            """
        ),
        id="bug14171804_update_statement_formats",
    ),
    pytest.param(
        "INSERT INTO `my_table` (`column_1`,`column_2`,`column_3`) VALUES "
        "('value_1','value_2','value_3'),('value_1','value_2','value_3'),('value_1','value_2','value_3');",
        sql_block(
            """
            INSERT INTO `my_table` (`column_1`, `column_2`, `column_3`)
            VALUES
                ('value_1', 'value_2', 'value_3'),
                ('value_1', 'value_2', 'value_3'),
                ('value_1', 'value_2', 'value_3');
            """
        ),
        id="bug11889187_extended_insert_values_wrapped",
    ),
]

SUPPORTED_CASES = [
    pytest.param(
        "select * from t where x in (select 1)",
        sql_block(
            """
            SELECT *
            FROM
                t
            WHERE
                x IN (SELECT 1)
            """
        ),
        id="nested_subquery",
    ),
    pytest.param(
        "select distinct a, count(*) from t group by a having count(*)>1 order by a limit 10 offset 5",
        sql_block(
            """
            SELECT DISTINCT
                a,
                COUNT(*)
            FROM
                t
            GROUP BY
                a
            HAVING
                COUNT(*) > 1
            ORDER BY
                a
            LIMIT 10 OFFSET 5
            """
        ),
        id="select_having_limit_offset",
    ),
    pytest.param(
        "select extract(year from d), trim(x), position(a in b), char(65 using utf8mb4)",
        sql_block(
            """
            SELECT
                EXTRACT(YEAR FROM d),
                TRIM(x),
                POSITION(a IN b),
                CHAR(65 USING utf8mb4)
            """
        ),
        id="keyword_function_calls_without_space_before_parenthesis",
    ),
    pytest.param(
        "select * from t limit 5, 10",
        sql_block(
            """
            SELECT *
            FROM
                t
            LIMIT 5, 10
            """
        ),
        id="select_limit_comma",
    ),
    pytest.param(
        "with recursive c(x) as (select 1 union all select 2) select x from c",
        sql_block(
            """
            WITH RECURSIVE
                c (x) AS (
                    SELECT 1
                    UNION ALL
                    SELECT 2
                )
            SELECT x
            FROM
                c
            """
        ),
        id="select_recursive_cte",
    ),
    pytest.param(
        "WITH recent_orders AS (SELECT o.customer_id,o.id,o.total,o.created_at FROM orders o WHERE o.created_at >= CURRENT_DATE - INTERVAL 30 DAY), ranked_orders AS (SELECT ro.customer_id,ro.id,ro.total,ROW_NUMBER() OVER (PARTITION BY ro.customer_id ORDER BY ro.total DESC,ro.id) AS rn FROM recent_orders ro), customer_metrics AS (SELECT c.id AS customer_id,c.region,(SELECT COUNT(*) FROM support_tickets st WHERE st.customer_id=c.id AND st.status IN ('open','pending') AND EXISTS (SELECT 1 FROM ticket_comments tc WHERE tc.ticket_id=st.id AND tc.created_at >= CURRENT_DATE - INTERVAL 7 DAY)) AS active_ticket_count FROM customers c WHERE c.status='active') SELECT cm.customer_id,cm.region,CASE WHEN EXISTS (SELECT 1 FROM ranked_orders r1 WHERE r1.customer_id=cm.customer_id AND r1.rn <= 3 AND r1.total > (SELECT AVG(r2.total) FROM ranked_orders r2 WHERE r2.customer_id=r1.customer_id)) THEN JSON_OBJECT('tier','priority','reason','top_recent_orders_above_avg') ELSE JSON_OBJECT('tier','standard','reason','no_high_value_pattern') END AS profile FROM customer_metrics cm WHERE cm.active_ticket_count > 0 ORDER BY cm.region,cm.customer_id;",
        sql_block(
            """
            WITH
                recent_orders AS (
                    SELECT
                        o.customer_id,
                        o.id,
                        o.total,
                        o.created_at
                    FROM
                        orders o
                    WHERE
                        o.created_at >= CURRENT_DATE - INTERVAL 30 DAY
                ),
                ranked_orders AS (
                    SELECT
                        ro.customer_id,
                        ro.id,
                        ro.total,
                        ROW_NUMBER () OVER (PARTITION BY ro.customer_id ORDER BY
                            ro.total DESC,
                            ro.id) AS rn
                    FROM
                        recent_orders ro
                ),
                customer_metrics AS (
                    SELECT
                        c.id AS customer_id,
                        c.region,
                        (
                            SELECT COUNT(*)
                            FROM
                                support_tickets st
                            WHERE
                                st.customer_id = c.id
                                AND st.status IN ('open', 'pending')
                                AND EXISTS (
                                        SELECT 1
                                        FROM
                                            ticket_comments tc
                                        WHERE
                                            tc.ticket_id = st.id
                                            AND tc.created_at >= CURRENT_DATE - INTERVAL 7 DAY
                                    )
                        ) AS active_ticket_count
                    FROM
                        customers c
                    WHERE
                        c.status = 'active'
                )
            SELECT
                cm.customer_id,
                cm.region,
                CASE
                    WHEN
                        EXISTS (
                            SELECT 1
                            FROM
                                ranked_orders r1
                            WHERE
                                r1.customer_id = cm.customer_id
                                AND r1.rn <= 3
                                AND r1.total > (
                                        SELECT AVG(r2.total)
                                        FROM
                                            ranked_orders r2
                                        WHERE
                                            r2.customer_id = r1.customer_id
                                    )
                        )
                    THEN
                        JSON_OBJECT('tier', 'priority', 'reason', 'top_recent_orders_above_avg')
                    ELSE JSON_OBJECT('tier', 'standard', 'reason', 'no_high_value_pattern')
                END AS profile
            FROM
                customer_metrics cm
            WHERE
                cm.active_ticket_count > 0
            ORDER BY
                cm.region,
                cm.customer_id;
            """
        ),
        id="select_deeply_nested_long_clauses",
    ),
    pytest.param(
        "insert into t values (1)",
        "INSERT INTO t VALUES (1)",
        id="insert_values",
    ),
    pytest.param(
        "insert into t(a,b) values (1,2),(3,4)",
        sql_block(
            """
            INSERT INTO t (a, b)
            VALUES
                (1, 2),
                (3, 4)
            """
        ),
        id="insert_multi_values",
    ),
    pytest.param(
        "insert into t(a) select a from s where x=1",
        sql_block(
            """
            INSERT INTO t (a)
            SELECT a
            FROM
                s
            WHERE
                x = 1
            """
        ),
        id="insert_select",
    ),
    pytest.param(
        "insert into t set a=1,b=2",
        sql_block(
            """
            INSERT INTO t
            SET
                a = 1,
                b = 2
            """
        ),
        id="insert_set",
    ),
    pytest.param(
        "insert into t(a,b) values (1,2) on duplicate key update a=values(a), b=2",
        sql_block(
            """
            INSERT INTO t (a, b) VALUES (1, 2)
            ON DUPLICATE KEY UPDATE
                a = VALUES(a),
                b = 2
            """
        ),
        id="insert_on_duplicate_key_update",
    ),
    pytest.param(
        "insert ignore into t(a) values (1)",
        "INSERT IGNORE INTO t (a) VALUES (1)",
        id="insert_ignore",
    ),
    pytest.param(
        "replace into t values (1)",
        "REPLACE INTO t VALUES (1)",
        id="replace_values",
    ),
    pytest.param(
        "replace into t set a=1,b=2",
        sql_block(
            """
            REPLACE INTO t
            SET
                a = 1,
                b = 2
            """
        ),
        id="replace_set",
    ),
    pytest.param(
        "replace into t(a) select a from s where x=1",
        sql_block(
            """
            REPLACE INTO t (a)
            SELECT a
            FROM
                s
            WHERE
                x = 1
            """
        ),
        id="replace_select",
    ),
    pytest.param(
        "update t set a = 1, b = now() where x = 1 and y = 2",
        sql_block(
            """
            UPDATE t
            SET
                a = 1,
                b = NOW()
            WHERE
                x = 1
                AND y = 2
            """
        ),
        id="update",
    ),
    pytest.param(
        "update ignore t join u on t.id=u.id set t.a=u.a, t.b=1 where u.x=1 order by t.id limit 5",
        sql_block(
            """
            UPDATE IGNORE t
            JOIN u
                ON t.id = u.id
            SET
                t.a = u.a,
                t.b = 1
            WHERE
                u.x = 1
            ORDER BY
                t.id
            LIMIT 5
            """
        ),
        id="update_join_order_limit",
    ),
    pytest.param(
        "UPDATE account_balances ab SET ab.risk_bucket=CASE WHEN EXISTS (SELECT 1 FROM fraud_signals fs WHERE fs.account_id=ab.account_id AND fs.score >= 90 AND EXISTS (SELECT 1 FROM fraud_signal_events fse WHERE fse.signal_id=fs.id AND fse.event_type IN ('ip_change','device_change','geo_velocity'))) THEN 'high' WHEN (SELECT COALESCE(SUM(t.amount),0) FROM transactions t WHERE t.account_id=ab.account_id AND t.posted_at >= CURRENT_DATE - INTERVAL 14 DAY AND t.kind='chargeback') > 1000 THEN 'medium' ELSE 'low' END, ab.review_note=CONCAT('review=',CASE WHEN ab.last_reviewed_at IS NULL THEN 'never' ELSE DATE_FORMAT(ab.last_reviewed_at,'%Y-%m-%d') END,', owner=',COALESCE((SELECT u.username FROM users u WHERE u.id=ab.owner_user_id),'unassigned')) WHERE ab.status='open' AND (ab.region IN ('US','CA') OR EXISTS (SELECT 1 FROM region_overrides ro WHERE ro.account_id=ab.account_id AND ro.override_type='manual_review'));",
        sql_block(
            """
            UPDATE account_balances ab
            SET
                ab.risk_bucket = CASE
                    WHEN
                        EXISTS (
                            SELECT 1
                            FROM
                                fraud_signals fs
                            WHERE
                                fs.account_id = ab.account_id
                                AND fs.score >= 90
                                AND EXISTS (
                                        SELECT 1
                                        FROM
                                            fraud_signal_events fse
                                        WHERE
                                            fse.signal_id = fs.id
                                            AND fse.event_type IN ('ip_change', 'device_change', 'geo_velocity')
                                    )
                        )
                    THEN
                        'high'
                    WHEN
                        (
                            SELECT COALESCE(SUM(t.amount), 0)
                            FROM
                                transactions t
                            WHERE
                                t.account_id = ab.account_id
                                AND t.posted_at >= CURRENT_DATE - INTERVAL 14 DAY
                                AND t.kind = 'chargeback'
                        ) > 1000
                    THEN
                        'medium'
                    ELSE 'low'
                END,
                ab.review_note = CONCAT(
                    'review=', CASE
                        WHEN ab.last_reviewed_at IS NULL THEN 'never'
                        ELSE DATE_FORMAT(ab.last_reviewed_at, '%Y-%m-%d')
                    END, ', owner=', COALESCE((
                        SELECT u.username
                        FROM
                            users u
                        WHERE
                            u.id = ab.owner_user_id
                    ), 'unassigned')
                )
            WHERE
                ab.status = 'open'
                AND (ab.region IN ('US', 'CA') OR EXISTS (
                        SELECT 1
                        FROM
                            region_overrides ro
                        WHERE
                            ro.account_id = ab.account_id
                            AND ro.override_type = 'manual_review'
                    ));
            """
        ),
        id="update_deeply_nested_long_clauses",
    ),
    pytest.param(
        "delete from t where x = 1 and y = 2",
        sql_block(
            """
            DELETE FROM t
            WHERE
                x = 1
                AND y = 2
            """
        ),
        id="delete",
    ),
    pytest.param(
        "delete quick t1 from t1 join t2 on t1.id=t2.id where t2.x=1",
        sql_block(
            """
            DELETE QUICK t1
            FROM
                t1
                JOIN t2
                    ON t1.id = t2.id
            WHERE
                t2.x = 1
            """
        ),
        id="delete_alias_from_with_option",
    ),
    pytest.param(
        "delete from t1 using t1 join t2 on t1.id=t2.id where t2.x=1",
        sql_block(
            """
            DELETE FROM t1
            USING
                t1
                JOIN t2
                    ON t1.id = t2.id
            WHERE
                t2.x = 1
            """
        ),
        id="delete_using",
    ),
    pytest.param(
        "delete from t where x=1 order by id limit 2",
        sql_block(
            """
            DELETE FROM t
            WHERE
                x = 1
            ORDER BY
                id
            LIMIT 2
            """
        ),
        id="delete_order_limit",
    ),
    pytest.param(
        "create view v as select a, b from t",
        sql_block(
            """
            CREATE VIEW v AS
                SELECT
                    a,
                    b
                FROM
                    t
            """
        ),
        id="create_view",
    ),
    pytest.param(
        "create or replace view v as select a from t with local check option",
        sql_block(
            """
            CREATE OR REPLACE VIEW v AS
                SELECT a
                FROM
                    t
                WITH LOCAL CHECK OPTION
            """
        ),
        id="create_view_or_replace_local_check",
    ),
    pytest.param(
        "create table t (id int primary key, c int, constraint fk foreign key (c) references p (id)) engine=innodb default charset=utf8mb4",
        sql_block(
            """
            CREATE TABLE t (
                id INT PRIMARY KEY,
                c INT,
                CONSTRAINT fk FOREIGN KEY (c)
                    REFERENCES p (id)
            )
            ENGINE = innodb
            DEFAULT CHARSET = utf8mb4
            """
        ),
        id="create_table",
    ),
    pytest.param(
        "create table count (a int)",
        sql_block(
            """
            CREATE TABLE count (
                a INT
            )
            """
        ),
        id="create_table_function_keyword_identifier",
    ),
    pytest.param(
        "create table current_date (a int)",
        sql_block(
            """
            CREATE TABLE current_date (
                a INT
            )
            """
        ),
        id="create_table_date_function_keyword_identifier",
    ),
    pytest.param(
        "create table t like u",
        "CREATE TABLE t LIKE u",
        id="create_table_like",
    ),
    pytest.param(
        "create table t (like u)",
        "CREATE TABLE t (LIKE u)",
        id="create_table_parenthesized_like",
    ),
    pytest.param(
        "create table t as select 1",
        "CREATE TABLE t AS SELECT 1",
        id="create_table_as_select",
    ),
    pytest.param(
        "create table t (id int) engine=innodb as select a from s",
        sql_block(
            """
            CREATE TABLE t (
                id INT
            )
            ENGINE = innodb
            AS
                SELECT a
                FROM
                    s
            """
        ),
        id="create_table_options_as_select",
    ),
    pytest.param(
        "create trigger trg before insert on t for each row set new.c = now()",
        sql_block(
            """
            CREATE TRIGGER trg
            BEFORE INSERT ON t
            FOR EACH ROW
                SET new.c = NOW()
            """
        ),
        id="create_trigger",
    ),
    pytest.param(
        "create procedure p() select 1",
        sql_block(
            """
            CREATE PROCEDURE p()
                SELECT 1
            """
        ),
        id="create_procedure",
    ),
    pytest.param(
        "create function f() returns int return 1",
        sql_block(
            """
            CREATE FUNCTION f() RETURNS INT
                RETURN 1
            """
        ),
        id="create_function",
    ),
    pytest.param(
        "create event e on schedule at current_timestamp do select 1",
        sql_block(
            """
            CREATE EVENT e ON SCHEDULE AT CURRENT_TIMESTAMP DO
                SELECT 1
            """
        ),
        id="create_event",
    ),
    pytest.param(
        "CREATE EVENT ev_rollup_customer_health ON SCHEDULE EVERY 1 DAY STARTS CURRENT_TIMESTAMP + INTERVAL 5 MINUTE DO INSERT INTO customer_health_snapshot(customer_id,snapshot_ts,health_score,health_label,details_json) SELECT c.id,NOW(),(CASE WHEN EXISTS (SELECT 1 FROM invoices i WHERE i.customer_id=c.id AND i.status='overdue' AND i.due_date < CURRENT_DATE - INTERVAL 15 DAY) THEN 20 ELSE 80 END) + (CASE WHEN EXISTS (SELECT 1 FROM support_tickets st WHERE st.customer_id=c.id AND st.priority='critical' AND st.status NOT IN ('closed','resolved')) THEN -40 ELSE 0 END),CASE WHEN EXISTS (SELECT 1 FROM subscriptions s WHERE s.customer_id=c.id AND s.state='cancelled' AND s.updated_at >= CURRENT_DATE - INTERVAL 30 DAY) THEN 'churn_risk' ELSE 'stable' END,JSON_OBJECT('openCriticalTickets',(SELECT COUNT(*) FROM support_tickets st2 WHERE st2.customer_id=c.id AND st2.priority='critical' AND st2.status NOT IN ('closed','resolved')),'recentOverdueInvoices',(SELECT COUNT(*) FROM invoices i2 WHERE i2.customer_id=c.id AND i2.status='overdue' AND i2.due_date >= CURRENT_DATE - INTERVAL 30 DAY)) FROM customers c WHERE c.lifecycle_stage IN ('active','trial');",
        sql_block(
            """
            CREATE EVENT ev_rollup_customer_health ON SCHEDULE EVERY 1 DAY STARTS CURRENT_TIMESTAMP + INTERVAL 5 MINUTE DO
                INSERT INTO customer_health_snapshot (customer_id, snapshot_ts, health_score, health_label, details_json)
                SELECT
                    c.id,
                    NOW(),
                    (CASE
                        WHEN
                            EXISTS (
                                SELECT 1
                                FROM
                                    invoices i
                                WHERE
                                    i.customer_id = c.id
                                    AND i.status = 'overdue'
                                    AND i.due_date < CURRENT_DATE - INTERVAL 15 DAY
                            )
                        THEN
                            20
                        ELSE 80
                    END) + (CASE
                        WHEN
                            EXISTS (
                                SELECT 1
                                FROM
                                    support_tickets st
                                WHERE
                                    st.customer_id = c.id
                                    AND st.priority = 'critical'
                                    AND st.status NOT IN ('closed', 'resolved')
                            )
                        THEN
                            - 40
                        ELSE 0
                    END),
                    CASE
                        WHEN
                            EXISTS (
                                SELECT 1
                                FROM
                                    subscriptions s
                                WHERE
                                    s.customer_id = c.id
                                    AND s.state = 'cancelled'
                                    AND s.updated_at >= CURRENT_DATE - INTERVAL 30 DAY
                            )
                        THEN
                            'churn_risk'
                        ELSE 'stable'
                    END,
                    JSON_OBJECT(
                        'openCriticalTickets', (
                            SELECT COUNT(*)
                            FROM
                                support_tickets st2
                            WHERE
                                st2.customer_id = c.id
                                AND st2.priority = 'critical'
                                AND st2.status NOT IN ('closed', 'resolved')
                        ), 'recentOverdueInvoices', (
                            SELECT COUNT(*)
                            FROM
                                invoices i2
                            WHERE
                                i2.customer_id = c.id
                                AND i2.status = 'overdue'
                                AND i2.due_date >= CURRENT_DATE - INTERVAL 30 DAY
                        )
                    )
                FROM
                    customers c
                WHERE
                    c.lifecycle_stage IN ('active', 'trial');
            """
        ),
        id="create_event_deeply_nested_long_clauses",
    ),
    pytest.param(
        "create library lib1 language JAVASCRIPT as $$ export function f() {return 42;} $$",
        "CREATE LIBRARY lib1 LANGUAGE JAVASCRIPT AS $$ export function f() {return 42;} $$",
        id="create_library",
    ),
    pytest.param(
        "create spatial reference system 4326 name text 'wgs84' definition text 'def'",
        "CREATE SPATIAL REFERENCE SYSTEM 4326 NAME TEXT 'wgs84' DEFINITION TEXT 'def'",
        id="create_spatial_reference_system",
    ),
    pytest.param(
        "create or replace spatial reference system 4326 name text 'wgs84'",
        "CREATE OR REPLACE SPATIAL REFERENCE SYSTEM 4326 NAME TEXT 'wgs84'",
        id="create_or_replace_spatial_reference_system",
    ),
    pytest.param(
        "create unique index idx_t_a on t(a desc)",
        sql_block(
            """
            CREATE UNIQUE INDEX idx_t_a
            ON t (a DESC)
            """
        ),
        id="create_index",
    ),
    pytest.param(
        "create database if not exists db1 default character set utf8mb4",
        sql_block(
            """
            CREATE DATABASE IF NOT EXISTS db1
            DEFAULT CHARACTER SET utf8mb4
            """
        ),
        id="create_database",
    ),
    pytest.param(
        "create role if not exists r1, r2",
        "CREATE ROLE IF NOT EXISTS r1, r2",
        id="create_role",
    ),
    pytest.param(
        "create server s foreign data wrapper mysql options (host 'h', database 'd')",
        "CREATE SERVER s FOREIGN DATA WRAPPER mysql OPTIONS (HOST 'h', DATABASE 'd')",
        id="create_server",
    ),
    pytest.param(
        "create tablespace ts add datafile 'x.ibd'",
        "CREATE TABLESPACE ts ADD DATAFILE 'x.ibd'",
        id="create_tablespace",
    ),
    pytest.param(
        "create undo tablespace uts add datafile 'u.ibu'",
        "CREATE UNDO TABLESPACE uts ADD DATAFILE 'u.ibu'",
        id="create_undo_tablespace",
    ),
    pytest.param(
        "create logfile group lg add undofile 'u.ibu'",
        "CREATE LOGFILE GROUP lg ADD UNDOFILE 'u.ibu'",
        id="create_logfile_group",
    ),
    pytest.param(
        "create user u@localhost identified by 'x'",
        "CREATE USER u@localhost IDENTIFIED BY 'x'",
        id="create_user",
    ),
    pytest.param(
        "alter user u@localhost identified by 'y'",
        "ALTER USER u@localhost IDENTIFIED BY 'y'",
        id="alter_user",
    ),
    pytest.param(
        "drop user if exists u@localhost",
        "DROP USER IF EXISTS u@localhost",
        id="drop_user",
    ),
    pytest.param(
        "rename user u1@localhost to u2@localhost",
        "RENAME USER u1@localhost TO u2@localhost",
        id="rename_user",
    ),
    pytest.param(
        "create resource group rg1 type = user vcpu = 0 thread_priority = 5",
        "CREATE RESOURCE GROUP rg1 TYPE = USER VCPU = 0 THREAD_PRIORITY = 5",
        id="create_resource_group",
    ),
    pytest.param(
        "alter resource group rg1 thread_priority = 10",
        "ALTER RESOURCE GROUP rg1 THREAD_PRIORITY = 10",
        id="alter_resource_group",
    ),
    pytest.param(
        "drop resource group rg1",
        "DROP RESOURCE GROUP rg1",
        id="drop_resource_group",
    ),
    pytest.param(
        "show databases",
        "SHOW DATABASES",
        id="show_databases",
    ),
    pytest.param(
        "show create table t",
        "SHOW CREATE TABLE t",
        id="show_create_table",
    ),
    pytest.param(
        "use db1",
        "USE db1",
        id="use_database",
    ),
    pytest.param(
        "call p()",
        "CALL p()",
        id="call_procedure",
    ),
    pytest.param(
        "begin",
        "BEGIN",
        id="begin",
    ),
    pytest.param(
        "begin work",
        "BEGIN WORK",
        id="begin_work",
    ),
    pytest.param(
        "commit",
        "COMMIT",
        id="commit",
    ),
    pytest.param(
        "rollback",
        "ROLLBACK",
        id="rollback",
    ),
    pytest.param(
        "start transaction",
        "START TRANSACTION",
        id="start_transaction",
    ),
    pytest.param(
        "xa start 'x'",
        "XA START 'x'",
        id="xa_start",
    ),
    pytest.param(
        "explain select 1",
        "EXPLAIN SELECT 1",
        id="explain_select",
    ),
    pytest.param(
        "prepare s from 'select 1'",
        "PREPARE s FROM 'select 1'",
        id="prepare_statement",
    ),
    pytest.param(
        "execute s",
        "EXECUTE s",
        id="execute_prepared_statement",
    ),
    pytest.param(
        "deallocate prepare s",
        "DEALLOCATE PREPARE s",
        id="deallocate_prepare",
    ),
    pytest.param(
        "set sql_mode = 'ANSI_QUOTES'",
        "SET sql_mode = 'ANSI_QUOTES'",
        id="set_option",
    ),
    pytest.param(
        "set @a := 1",
        "SET @a := 1",
        id="set_user_variable_assign",
    ),
    pytest.param(
        "flush tables",
        "FLUSH TABLES",
        id="flush_tables",
    ),
    pytest.param(
        "unlock tables",
        "UNLOCK TABLES",
        id="unlock_tables",
    ),
    pytest.param(
        "analyze table t",
        "ANALYZE TABLE t",
        id="analyze_table",
    ),
    pytest.param(
        "alter table t add column c int, add index idx_c (c)",
        sql_block(
            """
            ALTER TABLE t
                ADD COLUMN c INT,
                ADD INDEX idx_c (c)
            """
        ),
        id="alter_table_add_actions",
    ),
    pytest.param(
        "alter table t modify column c varchar(10) not null, drop column d",
        sql_block(
            """
            ALTER TABLE t
                MODIFY COLUMN c VARCHAR(10) NOT NULL,
                DROP COLUMN d
            """
        ),
        id="alter_table_modify_and_drop",
    ),
    pytest.param(
        "alter database db1 default character set utf8mb4",
        sql_block(
            """
            ALTER DATABASE db1
            DEFAULT CHARACTER SET utf8mb4
            """
        ),
        id="alter_database",
    ),
    pytest.param(
        "alter procedure `sp` comment 'x' language sql modifies sql data sql security invoker",
        sql_block(
            """
            ALTER PROCEDURE `sp`
                COMMENT 'x'
                LANGUAGE SQL
                MODIFIES SQL DATA
                SQL SECURITY INVOKER
            """
        ),
        id="alter_procedure",
    ),
    pytest.param(
        "alter function `fn` comment 'x' language sql modifies sql data sql security invoker",
        sql_block(
            """
            ALTER FUNCTION `fn`
                COMMENT 'x'
                LANGUAGE SQL
                MODIFIES SQL DATA
                SQL SECURITY INVOKER
            """
        ),
        id="alter_function",
    ),
    pytest.param(
        "drop temporary table if exists t1, t2",
        sql_block(
            """
            DROP TEMPORARY TABLE IF EXISTS
                t1,
                t2
            """
        ),
        id="drop_table",
    ),
    pytest.param(
        "drop view if exists v1, v2",
        sql_block(
            """
            DROP VIEW IF EXISTS
                v1,
                v2
            """
        ),
        id="drop_view",
    ),
    pytest.param(
        "drop index idx_t_a on t",
        "DROP INDEX idx_t_a ON t",
        id="drop_index",
    ),
    pytest.param(
        "drop database if exists db1",
        "DROP DATABASE IF EXISTS db1",
        id="drop_database",
    ),
    pytest.param(
        "truncate table t",
        "TRUNCATE TABLE t",
        id="truncate_table",
    ),
    pytest.param(
        "rename table t to t_old, u to u_old",
        sql_block(
            """
            RENAME TABLE
                t TO t_old,
                u TO u_old
            """
        ),
        id="rename_table",
    ),
]

OPTIONAL_GRAMMAR_REGRESSION_CASES = [
    pytest.param(
        "select * from t for update",
        sql_block(
            """
            SELECT *
            FROM
                t
            FOR UPDATE
            """
        ),
        id="select_locking_clause",
    ),
    pytest.param(
        "select * from t lock in share mode",
        sql_block(
            """
            SELECT *
            FROM
                t
            LOCK IN SHARE MODE
            """
        ),
        id="select_lock_in_share_mode",
    ),
    pytest.param(
        "create table if not exists t (id int)",
        sql_block(
            """
            CREATE TABLE IF NOT EXISTS t (
                id INT
            )
            """
        ),
        id="create_table_if_not_exists",
    ),
    pytest.param(
        "create view v(c1) as select a from t",
        sql_block(
            """
            CREATE VIEW v(c1) AS
                SELECT a
                FROM
                    t
            """
        ),
        id="create_view_column_list",
    ),
    pytest.param(
        "create view v as select a from t with check option",
        sql_block(
            """
            CREATE VIEW v AS
                SELECT a
                FROM
                    t
                WITH CHECK OPTION
            """
        ),
        id="create_view_check_option",
    ),
]

ADDITIONAL_GRAMMAR_FAMILY_CASES = [
    pytest.param(
        "grant select, insert on db.* to u@localhost",
        "GRANT SELECT, INSERT ON db.* TO u@localhost",
        id="grant_privileges",
    ),
    pytest.param(
        "revoke update on db.t from u@localhost",
        "REVOKE UPDATE ON db.t FROM u@localhost",
        id="revoke_privileges",
    ),
    pytest.param(
        "set role all",
        "SET ROLE ALL",
        id="set_role",
    ),
    pytest.param(
        "savepoint s1",
        "SAVEPOINT s1",
        id="savepoint",
    ),
    pytest.param(
        "rollback to savepoint s1",
        "ROLLBACK TO SAVEPOINT s1",
        id="rollback_to_savepoint",
    ),
    pytest.param(
        "release savepoint s1",
        "RELEASE SAVEPOINT s1",
        id="release_savepoint",
    ),
    pytest.param(
        "lock tables t read local",
        "LOCK TABLES t READ LOCAL",
        id="lock_tables",
    ),
    pytest.param(
        "show full columns from t from db1 like 'x%'",
        "SHOW FULL COLUMNS FROM t FROM db1 LIKE 'x%'",
        id="show_full_columns",
    ),
    pytest.param(
        "show create procedure p",
        "SHOW CREATE PROCEDURE p",
        id="show_create_procedure",
    ),
    pytest.param(
        "show create library lib1",
        "SHOW CREATE LIBRARY lib1",
        id="show_create_library",
    ),
    pytest.param(
        "show replica status",
        "SHOW REPLICA STATUS",
        id="show_replica_status",
    ),
    pytest.param(
        "describe t",
        "DESCRIBE t",
        id="describe_table",
    ),
    pytest.param(
        "help contents",
        "HELP contents",
        id="help_contents",
    ),
    pytest.param(
        "kill connection 7",
        "KILL CONNECTION 7",
        id="kill_connection",
    ),
    pytest.param(
        "start replica",
        "START REPLICA",
        id="start_replica",
    ),
    pytest.param(
        "reset replica all",
        "RESET REPLICA ALL",
        id="reset_replica_all",
    ),
    pytest.param(
        "change replication source to source_host='h', source_port=3306",
        "CHANGE REPLICATION SOURCE TO SOURCE_HOST = 'h', SOURCE_PORT = 3306",
        id="change_replication_source",
    ),
    pytest.param(
        "load data infile '/tmp/t.txt' into table t",
        "LOAD DATA INFILE '/tmp/t.txt' INTO TABLE t",
        id="load_data_infile",
    ),
    pytest.param(
        "clone local data directory = '/tmp/clone'",
        "CLONE LOCAL DATA DIRECTORY = '/tmp/clone'",
        id="clone_local_data_directory",
    ),
    pytest.param(
        "drop spatial reference system 4326",
        "DROP SPATIAL REFERENCE SYSTEM 4326",
        id="drop_spatial_reference_system",
    ),
    pytest.param(
        "handler t read first",
        "HANDLER t READ FIRST",
        id="handler_read_first",
    ),
    pytest.param(
        "install component 'file://component_test'",
        "INSTALL COMPONENT 'file://component_test'",
        id="install_component",
    ),
    pytest.param(
        "signal sqlstate '45000' set message_text='x'",
        "SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'x'",
        id="signal_sqlstate",
    ),
    pytest.param(
        "get diagnostics @n = number",
        "GET DIAGNOSTICS @n = NUMBER",
        id="get_diagnostics_number",
    ),
]

PARSER_GAP_STATEMENT_CASES = [
    pytest.param(
        "alter library lib1 comment 'x'",
        sql_block(
            """
            ALTER LIBRARY lib1
                COMMENT 'x'
            """
        ),
        id="alter_library",
    ),
    pytest.param(
        "drop library if exists lib1",
        "DROP LIBRARY IF EXISTS lib1",
        id="drop_library",
    ),
    pytest.param(
        "show library status like 'lib%'",
        "SHOW LIBRARY STATUS LIKE 'lib%'",
        id="show_library_status",
    ),
    pytest.param(
        "SHOW CREATE MASKING POLICY mask_ssn",
        "SHOW CREATE MASKING POLICY mask_ssn",
        id="show_create_masking_policy",
    ),
    pytest.param(
        "DROP MASKING POLICY IF EXISTS mask_ssn",
        "DROP MASKING POLICY IF EXISTS mask_ssn",
        id="drop_masking_policy",
    ),
    pytest.param(
        "CREATE MASKING POLICY mask_ssn(ssn) CASE WHEN CURRENT_ROLE_IN('admin') THEN ssn ELSE ssn % 1000 END",
        sql_block(
            """
            CREATE MASKING POLICY mask_ssn(ssn)
                CASE WHEN CURRENT_ROLE_IN('admin') THEN ssn ELSE ssn % 1000 END
            """
        ),
        id="create_masking_policy",
    ),
]

PARSER_GAP_IDEMPOTENT_OUTPUTS = [
    expected
    for _, expected in [(case.values[0], case.values[1]) for case in PARSER_GAP_STATEMENT_CASES]
]

SCRIPT_INPUT = sql_block(
    """
    -- lead comment

    select 1;

    # spacer
    DELIMITER //
    create trigger trg before insert on t for each row set new.c = now()//
    DELIMITER ;

    insert into t values (1);
    """
)

SCRIPT_EXPECTED = sql_block(
    """
    -- lead comment

    SELECT 1;

    # spacer
    DELIMITER //
    CREATE TRIGGER trg
    BEFORE INSERT ON t
    FOR EACH ROW
        SET new.c = NOW()//
    DELIMITER ;

    INSERT INTO t VALUES (1);
    """
)

INLINE_COMMENT_SQL = "select 1 /* inline */ + 2"
UNSUPPORTED_SQL = "select @a:=1"

IDEMPOTENT_DEFAULT_OUTPUTS = [
    expected for _, expected in [(case.values[0], case.values[1]) for case in WORKBENCH_CORPUS_CASES]
] + [
    expected for _, expected in [(case.values[0], case.values[1]) for case in SQL_BEAUTIFY_BUG_CASES]
] + [
    expected for _, expected in [(case.values[0], case.values[1]) for case in SUPPORTED_CASES]
] + [
    expected
    for _, expected in [(case.values[0], case.values[1]) for case in OPTIONAL_GRAMMAR_REGRESSION_CASES]
] + [
    expected
    for _, expected in [(case.values[0], case.values[1]) for case in ADDITIONAL_GRAMMAR_FAMILY_CASES]
] + [
    SCRIPT_EXPECTED,
    INLINE_COMMENT_SQL,
    UNSUPPORTED_SQL,
]


@pytest.mark.parametrize(("source", "expected"), WORKBENCH_CORPUS_CASES)
def test_reformat_workbench_corpus(source: str, expected: str):
    assert_reformatted_sql(source, expected)


@pytest.mark.parametrize(("source", "expected"), SQL_BEAUTIFY_BUG_CASES)
def test_reformat_sql_beautify_bug_corpus(source: str, expected: str):
    assert_reformatted_sql(source, expected)


@pytest.mark.parametrize(("source", "expected"), SUPPORTED_CASES)
def test_reformat_supported_statements(source: str, expected: str):
    assert_reformatted_sql(source, expected)


@pytest.mark.parametrize(("source", "expected"), OPTIONAL_GRAMMAR_REGRESSION_CASES)
def test_reformat_optional_grammar_regressions(source: str, expected: str):
    assert_reformatted_sql(source, expected)


@pytest.mark.parametrize(("source", "expected"), ADDITIONAL_GRAMMAR_FAMILY_CASES)
def test_reformat_additional_grammar_families(source: str, expected: str):
    assert_reformatted_sql(source, expected)


@pytest.mark.parametrize(("source", "expected"), PARSER_GAP_STATEMENT_CASES)
def test_reformat_parser_gap_statements(source: str, expected: str):
    assert_reformatted_sql(source, expected, expect_parseable=False)


MODE_INVARIANT_CASES = [
    pytest.param(
        "select distinct a, count(*) from t group by a having count(*)>1 order by a limit 10 offset 5",
        sql_block(
            """
            SELECT DISTINCT
                a,
                COUNT(*)
            FROM
                t
            GROUP BY
                a
            HAVING
                COUNT(*) > 1
            ORDER BY
                a
            LIMIT 10 OFFSET 5
            """
        ),
        id="select",
    ),
    pytest.param(
        "insert into t(a,b) values (1,2),(3,4)",
        sql_block(
            """
            INSERT INTO t (a, b)
            VALUES
                (1, 2),
                (3, 4)
            """
        ),
        id="insert",
    ),
    pytest.param(
        "replace into t values (1)",
        "REPLACE INTO t VALUES (1)",
        id="replace",
    ),
    pytest.param(
        "update ignore t join u on t.id=u.id set t.a=u.a, t.b=1 where u.x=1 order by t.id limit 5",
        sql_block(
            """
            UPDATE IGNORE t
            JOIN u
                ON t.id = u.id
            SET
                t.a = u.a,
                t.b = 1
            WHERE
                u.x = 1
            ORDER BY
                t.id
            LIMIT 5
            """
        ),
        id="update",
    ),
    pytest.param(
        "delete from t1 using t1 join t2 on t1.id=t2.id where t2.x=1",
        sql_block(
            """
            DELETE FROM t1
            USING
                t1
                JOIN t2
                    ON t1.id = t2.id
            WHERE
                t2.x = 1
            """
        ),
        id="delete",
    ),
    pytest.param(
        "create table t like u",
        "CREATE TABLE t LIKE u",
        id="ddl_create_table_like",
    ),
    pytest.param(
        "alter table t add column c int, add index idx_c (c)",
        sql_block(
            """
            ALTER TABLE t
                ADD COLUMN c INT,
                ADD INDEX idx_c (c)
            """
        ),
        id="alter",
    ),
    pytest.param(
        "create user u@localhost identified by 'x'",
        "CREATE USER u@localhost IDENTIFIED BY 'x'",
        id="account_management_create_user",
    ),
    pytest.param(
        "create unique index idx_t_a on t(a desc)",
        sql_block(
            """
            CREATE UNIQUE INDEX idx_t_a
            ON t (a DESC)
            """
        ),
        id="ddl_create_index",
    ),
]


def test_format_script_preserves_delimiters_comments_and_formats_supported_chunks():
    assert_reformatted_sql(SCRIPT_INPUT, SCRIPT_EXPECTED)


def test_passes_through_inline_comment_statement():
    assert_reformatted_sql(INLINE_COMMENT_SQL, INLINE_COMMENT_SQL)


def test_passes_through_unsupported_statement():
    assert_reformatted_sql(UNSUPPORTED_SQL, UNSUPPORTED_SQL)


def test_reformat_respects_ansi_quotes_on_for_double_quoted_identifiers():
    source = 'select "a" from "t"'
    expected = sql_block(
        """
        SELECT "a"
        FROM
            "t"
        """
    )
    assert_reformatted_sql(source, expected, ansiQuotes=True)


def test_reformat_accepts_explicit_ansi_quotes_off_for_regular_queries():
    source = "select 1"
    expected = "SELECT 1"
    assert_reformatted_sql(source, expected, ansiQuotes=False)


def test_reformat_respects_ansi_quotes_off_when_double_quoted_identifiers_are_invalid():
    source = 'select "a" from "t"'
    assert reformat_sql(source, ansiQuotes=False) == source


def test_reformat_respects_no_backslash_escapes_off_for_backslash_escaped_quotes():
    source = r"select 'a\'b'"
    expected = r"SELECT 'a\'b'"
    assert_reformatted_sql(source, expected, noBackslashEscapes=False)


def test_reformat_respects_no_backslash_escapes_on_for_doubled_quotes():
    source = "select 'a''b'"
    expected = "SELECT 'a''b'"
    assert_reformatted_sql(source, expected, noBackslashEscapes=True)


def test_reformat_respects_no_backslash_escapes_on_when_backslash_escapes_are_invalid():
    source = r"select 'a\'b'"
    assert reformat_sql(source, noBackslashEscapes=True) == source


@pytest.mark.parametrize("operator", ["->", "->>"])
def test_reformat_preserves_json_column_operators(operator: str) -> None:
    source = f"select document{operator}'$.name' from t"
    expected = sql_block(
        f"""
        SELECT document{operator}'$.name'
        FROM
            t
        """
    )

    assert_reformatted_sql(source, expected)


def test_reformat_preserves_time_function_fractional_precision() -> None:
    source = "select current_timestamp(3), utc_timestamp(6)"
    expected = sql_block(
        """
        SELECT
            CURRENT_TIMESTAMP(3),
            UTC_TIMESTAMP(6)
        """
    )

    assert_reformatted_sql(source, expected)


@pytest.mark.parametrize("formatted_sql", IDEMPOTENT_DEFAULT_OUTPUTS)
def test_default_formatting_is_idempotent(formatted_sql: str):
    assert_reformatted_sql(formatted_sql, formatted_sql)


@pytest.mark.parametrize("formatted_sql", PARSER_GAP_IDEMPOTENT_OUTPUTS)
def test_parser_gap_formatting_is_idempotent(formatted_sql: str):
    assert_reformatted_sql(formatted_sql, formatted_sql, expect_parseable=False)


@pytest.mark.parametrize(("source", "expected"), MODE_INVARIANT_CASES)
@pytest.mark.parametrize("parser_mode_kwargs", PARSER_MODE_COMBINATIONS)
def test_supported_statements_are_mode_invariant(
    source: str, expected: str, parser_mode_kwargs: dict[str, bool]
):
    assert_reformatted_sql(source, expected, **parser_mode_kwargs)



def test_style_options_allow_lowercase_indent_and_identifier_quoting():
    source = "select sch.func(123), t.* from t"
    expected = sql_block(
        """
        select
          `sch`.`func`(123),
          `t`.*
        from
          `t`
        """
    )
    actual = reformat_sql(
        source,
        keywordCase="lower",
        indentWidth=2,
        quoteIdentifiers=True,
    )
    assert actual == expected
    assert_parseable_sql(actual)


def test_break_select_items_option():
    source = "select customer_id, first_name, last_name, email from customer where active = 1"
    compact_expected = sql_block(
        """
        SELECT customer_id, first_name, last_name, email
        FROM
            customer
        WHERE
            active = 1
        """
    )
    broken_expected = sql_block(
        """
        SELECT
            customer_id,
            first_name,
            last_name,
            email
        FROM
            customer
        WHERE
            active = 1
        """
    )

    assert_reformatted_sql(
        source,
        compact_expected,
        breakSelectItems=False,
    )
    assert_reformatted_sql(
        source,
        broken_expected,
        breakSelectItems=True,
    )


def test_break_function_args_option():
    source = "select concat(a, b, c) from t"
    expected = sql_block(
        """
        SELECT
            concat(
                a,
                b,
                c
            )
        FROM
            t
        """
    )
    actual = reformat_sql(source, breakFunctionArgs=True)
    assert actual == expected
    assert_parseable_sql(actual)
    assert simple_token_list(source) == simple_token_list(actual)


def test_init_wrapper_bootstraps_package_path_when_loaded_from_file(tmp_path):
    repo_root = pathlib.Path(__file__).resolve().parents[2]
    init_path = repo_root / "util_plugin" / "init.py"
    config_home = tmp_path / "mysqlsh-home"
    config_home.mkdir()

    env = dict(os.environ)
    env["HOME"] = str(config_home)
    env["MYSQLSH_USER_CONFIG_HOME"] = str(config_home)

    script = (
        "import importlib.util, sys; "
        f"root={str(repo_root)!r}; "
        "sys.path=[p for p in sys.path if p != root]; "
        f"spec=importlib.util.spec_from_file_location('util_init_direct_test', {str(init_path)!r}); "
        "mod=importlib.util.module_from_spec(spec); "
        "spec.loader.exec_module(mod); "
        "print(mod.reformat_sql('select 1')); "
        "print(mod.reformat_sql('select 1', keywordCase='preserve'))"
    )

    result = subprocess.run(
        [mysqlsh.executable, "--disable-builtin-plugins", "--py", "-e", script],
        cwd=repo_root,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout
    assert result.stdout.splitlines() == ["SELECT 1", "select 1"]
