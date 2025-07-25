lexer grammar MySQLMRSLexer;

/*
 * Copyright (c) 2020, 2025, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation. The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have either included with
 * the program or referenced in the documentation.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

/*
 * I've merged in all changes up to mysql-trunk git revision [8107c1e] (tagged mysql-9.2.0)  (15. Dec 2024).
 *
 * This is a MySQL grammar for ANTLR 4.5+ with language features from MySQL 8.0 and up.
 * The server version in the generated parser can be switched at runtime, making it so possible
 * to switch the supported feature set dynamically.
 *
 * The coverage of the MySQL language should be 100%, but there might still be some bugs or omissions.
 *
 * To use this grammar you'll need a few support classes (which should be close to where you found this grammar).
 * These classes implement the target-specific action code, so we don't clutter up the grammar with that
 * and make it simpler to adjust it for other targets. See the demo/test project for further details.
 *
 * Written by Mike Lischke. Please email mike.lischke@oracle.com if you spot any bugs or omissions.
 */

//-------------------------------------------------------------------------------------------------

// $antlr-format alignTrailingComments on, columnLimit 150, maxEmptyLinesToKeep 1, reflowComments off, useTab off
// $antlr-format allowShortRulesOnASingleLine on, minEmptyLines 0, alignSemicolons none

options {
    superClass = MySQLBaseLexer;
}

tokens {
    NOT2_SYMBOL,
    CONCAT_PIPES_SYMBOL,

    // Tokens assigned in NUMBER rule.
    INT_NUMBER, // NUM in sql_yacc.yy
    LONG_NUMBER,
    ULONGLONG_NUMBER
}

//-------------------------------------------------------------------------------------------------

@header {/*
 * Copyright (c) 2020, 2025, Oracle and/or its affiliates.
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

/* eslint-disable @typescript-eslint/no-unused-vars, no-useless-escape */

import { MySQLBaseLexer } from "../MySQLBaseLexer.js";
import { SqlMode } from "../MySQLRecognizerCommon.js";
}

//-------------------------------------------------------------------------------------------------

// Operators
EQUAL_OPERATOR:            '='; // Also assign.
ASSIGN_OPERATOR:           ':=';
NULL_SAFE_EQUAL_OPERATOR:  '<=>';
GREATER_OR_EQUAL_OPERATOR: '>=';
GREATER_THAN_OPERATOR:     '>';
LESS_OR_EQUAL_OPERATOR:    '<=';
LESS_THAN_OPERATOR:        '<';
NOT_EQUAL_OPERATOR:        '!=';
NOT_EQUAL2_OPERATOR:       '<>' -> type(NOT_EQUAL_OPERATOR);

PLUS_OPERATOR:  '+';
MINUS_OPERATOR: '-';
MULT_OPERATOR:  '*';
DIV_OPERATOR:   '/';

MOD_OPERATOR: '%';

LOGICAL_NOT_OPERATOR: '!';
BITWISE_NOT_OPERATOR: '~';

SHIFT_LEFT_OPERATOR:  '<<';
SHIFT_RIGHT_OPERATOR: '>>';

LOGICAL_AND_OPERATOR: '&&';
BITWISE_AND_OPERATOR: '&';

BITWISE_XOR_OPERATOR: '^';

LOGICAL_OR_OPERATOR:
    '||' { this.type = this.isSqlModeActive(SqlMode.PipesAsConcat) ? MySQLMRSLexer.CONCAT_PIPES_SYMBOL : MySQLMRSLexer.LOGICAL_OR_OPERATOR; };
BITWISE_OR_OPERATOR: '|';

DOT_SYMBOL:         '.';
COMMA_SYMBOL:       ',';
SEMICOLON_SYMBOL:   ';';
COLON_SYMBOL:       ':';
OPEN_PAR_SYMBOL:    '(';
CLOSE_PAR_SYMBOL:   ')';
OPEN_CURLY_SYMBOL:  '{';
CLOSE_CURLY_SYMBOL: '}';
UNDERLINE_SYMBOL:   '_';

JSON_SEPARATOR_SYMBOL:          '->';  // MYSQL
JSON_UNQUOTED_SEPARATOR_SYMBOL: '->>'; // MYSQL

OPEN_SQUARE_SYMBOL:  '[';
CLOSE_SQUARE_SYMBOL: ']'; 

// The MySQL server parser uses custom code in its lexer to allow base alphanum chars (and ._$) as variable name.
// For this it handles user variables in 2 different ways and we have to model this to match that behavior.
AT_SIGN_SYMBOL: '@';


AT_AT_SIGN_SYMBOL: '@@';

NULL2_SYMBOL: '\\N';
PARAM_MARKER: '?';

fragment A: [aA];
fragment B: [bB];
fragment C: [cC];
fragment D: [dD];
fragment E: [eE];
fragment F: [fF];
fragment G: [gG];
fragment H: [hH];
fragment I: [iI];
fragment J: [jJ];
fragment K: [kK];
fragment L: [lL];
fragment M: [mM];
fragment N: [nN];
fragment O: [oO];
fragment P: [pP];
fragment Q: [qQ];
fragment R: [rR];
fragment S: [sS];
fragment T: [tT];
fragment U: [uU];
fragment V: [vV];
fragment W: [wW];
fragment X: [xX];
fragment Y: [yY];
fragment Z: [zZ];

fragment DIGIT:    [0-9];
fragment DIGITS:   DIGIT+;
fragment HEXDIGIT: [0-9a-fA-F];

// Only lower case 'x' and 'b' count for hex + bin numbers. Otherwise it's an identifier.
HEX_NUMBER: ('0x' HEXDIGIT+) | ('x\'' HEXDIGIT+ '\'');
BIN_NUMBER: ('0b' [01]+) | ('b\'' [01]+ '\'');

INT_NUMBER: DIGITS { this.type = this.determineNumericType(this.text); };

// Float types must be handled first or the DOT_IDENTIIFER rule will make them to identifiers
// (if there is no leading digit before the dot).
DECIMAL_NUMBER: DIGITS? DOT_SYMBOL DIGITS;
FLOAT_NUMBER:   (DIGITS? DOT_SYMBOL)? DIGITS [eE] (MINUS_OPERATOR | PLUS_OPERATOR)? DIGITS;

// Special rule that should also match all keywords if they are directly preceded by a dot.
// Hence it's defined before all keywords.
// Here we make use of the ability in our base lexer to emit multiple tokens with a single rule.
DOT_IDENTIFIER:
    DOT_SYMBOL LETTER_WHEN_UNQUOTED_NO_DIGIT LETTER_WHEN_UNQUOTED* { this.emitDot(); } -> type(IDENTIFIER);

// $antlr-format groupedAlignments off, alignTrailers on

// Version information for keywords was taken from https://dev.mysql.com/doc/mysqld-version-reference/en/keywords.html.

ACCESSIBLE_SYMBOL:                  A C C E S S I B L E;
ACCOUNT_SYMBOL:                     A C C O U N T;
ACTION_SYMBOL:                      A C T I O N;                                        // SQL-2003-N
ADD_SYMBOL:                         A D D;                                              // SQL-2003-R
ADDDATE_SYMBOL:
    A D D D A T E                                                                       { this.type = this.determineFunction(MySQLMRSLexer.ADDDATE_SYMBOL); }; // MYSQL-FUNC
AFTER_SYMBOL:                       A F T E R;                                          // SQL-2003-N
AGAINST_SYMBOL:                     A G A I N S T;
AGGREGATE_SYMBOL:                   A G G R E G A T E;
ALGORITHM_SYMBOL:                   A L G O R I T H M;
ALL_SYMBOL:                         A L L;                                              // SQL-2003-R
ALTER_SYMBOL:                       A L T E R;                                          // SQL-2003-R
ALWAYS_SYMBOL:                      A L W A Y S;
ANALYZE_SYMBOL:                     A N A L Y Z E;
AND_SYMBOL:                         A N D;                                              // SQL-2003-R
ANY_SYMBOL:                         A N Y;                                              // SQL-2003-R
AS_SYMBOL:                          A S;                                                // SQL-2003-R
ASC_SYMBOL:                         A S C;                                              // SQL-2003-N
ASCII_SYMBOL:                       A S C I I;                                          // MYSQL-FUNC
ASENSITIVE_SYMBOL:                  A S E N S I T I V E;                                // FUTURE-USE
AT_SYMBOL:                          A T;
AUTOEXTEND_SIZE_SYMBOL:             A U T O E X T E N D '_' S I Z E;
AUTO_INCREMENT_SYMBOL:              A U T O '_' I N C R E M E N T;
AVG_ROW_LENGTH_SYMBOL:              A V G '_' R O W '_' L E N G T H;
AVG_SYMBOL:                         A V G;                                              // SQL-2003-N
BACKUP_SYMBOL:                      B A C K U P;
BEFORE_SYMBOL:                      B E F O R E;                                        // SQL-2003-N
BEGIN_SYMBOL:                       B E G I N;                                          // SQL-2003-R
BETWEEN_SYMBOL:                     B E T W E E N;                                      // SQL-2003-R
BIGINT_SYMBOL:                      B I G I N T;                                        // SQL-2003-R
BINARY_SYMBOL:                      B I N A R Y;                                        // SQL-2003-R
BINLOG_SYMBOL:                      B I N L O G;
BIT_AND_SYMBOL:
    B I T '_' A N D                                                                     { this.type = this.determineFunction(MySQLMRSLexer.BIT_AND_SYMBOL); }; // MYSQL-FUNC
BIT_OR_SYMBOL:
    B I T '_' O R                                                                       { this.type = this.determineFunction(MySQLMRSLexer.BIT_OR_SYMBOL); }; // MYSQL-FUNC
BIT_SYMBOL:                         B I T;                                              // MYSQL-FUNC
BIT_XOR_SYMBOL:
    B I T '_' X O R                                                                     { this.type = this.determineFunction(MySQLMRSLexer.BIT_XOR_SYMBOL); }; // MYSQL-FUNC
BLOB_SYMBOL:                        B L O B;                                            // SQL-2003-R
BLOCK_SYMBOL:                       B L O C K;
BOOLEAN_SYMBOL:                     B O O L E A N;                                      // SQL-2003-R
BOOL_SYMBOL:                        B O O L;
BOTH_SYMBOL:                        B O T H;                                            // SQL-2003-R
BTREE_SYMBOL:                       B T R E E;
BY_SYMBOL:                          B Y;                                                // SQL-2003-R
BYTE_SYMBOL:                        B Y T E;
CACHE_SYMBOL:                       C A C H E;
CALL_SYMBOL:                        C A L L;                                            // SQL-2003-R
CASCADE_SYMBOL:                     C A S C A D E;                                      // SQL-2003-N
CASCADED_SYMBOL:                    C A S C A D E D;                                    // SQL-2003-R
CASE_SYMBOL:                        C A S E;                                            // SQL-2003-R
CAST_SYMBOL:                        C A S T                                             { this.type = this.determineFunction(MySQLMRSLexer.CAST_SYMBOL); }; // SQL-2003-R
CATALOG_NAME_SYMBOL:                C A T A L O G '_' N A M E;                          // SQL-2003-N
CHAIN_SYMBOL:                       C H A I N;                                          // SQL-2003-N
CHANGE_SYMBOL:                      C H A N G E;
CHANGED_SYMBOL:                     C H A N G E D;
CHANNEL_SYMBOL:                     C H A N N E L;
CHARSET_SYMBOL:                     C H A R S E T;
CHARACTER_SYMBOL:                   C H A R A C T E R                                   -> type(CHAR_SYMBOL); // Synonym
CHAR_SYMBOL:                        C H A R;                                            // SQL-2003-R
CHECKSUM_SYMBOL:                    C H E C K S U M;
CHECK_SYMBOL:                       C H E C K;                                          // SQL-2003-R
CIPHER_SYMBOL:                      C I P H E R;
CLASS_ORIGIN_SYMBOL:                C L A S S '_' O R I G I N;                          // SQL-2003-N
CLIENT_SYMBOL:                      C L I E N T;
CLOSE_SYMBOL:                       C L O S E;                                          // SQL-2003-R
COALESCE_SYMBOL:                    C O A L E S C E;                                    // SQL-2003-N
CODE_SYMBOL:                        C O D E;
COLLATE_SYMBOL:                     C O L L A T E;                                      // SQL-2003-R
COLLATION_SYMBOL:                   C O L L A T I O N;                                  // SQL-2003-N
COLUMNS_SYMBOL:                     C O L U M N S;
COLUMN_SYMBOL:                      C O L U M N;                                        // SQL-2003-R
COLUMN_NAME_SYMBOL:                 C O L U M N '_' N A M E;                            // SQL-2003-N
COLUMN_FORMAT_SYMBOL:               C O L U M N '_' F O R M A T;
COMMENT_SYMBOL:                     C O M M E N T;
COMMITTED_SYMBOL:                   C O M M I T T E D;                                  // SQL-2003-N
COMMIT_SYMBOL:                      C O M M I T;                                        // SQL-2003-R
COMPACT_SYMBOL:                     C O M P A C T;
COMPLETION_SYMBOL:                  C O M P L E T I O N;
COMPRESSED_SYMBOL:                  C O M P R E S S E D;
COMPRESSION_SYMBOL:                 C O M P R E S S I O N;
CONCURRENT_SYMBOL:                  C O N C U R R E N T;
CONDITION_SYMBOL:                   C O N D I T I O N;                                  // SQL-2003-R, SQL-2008-R
CONNECTION_SYMBOL:                  C O N N E C T I O N;
CONSISTENT_SYMBOL:                  C O N S I S T E N T;
CONSTRAINT_SYMBOL:                  C O N S T R A I N T;                                // SQL-2003-R
CONSTRAINT_CATALOG_SYMBOL:          C O N S T R A I N T '_' C A T A L O G;              // SQL-2003-N
CONSTRAINT_NAME_SYMBOL:             C O N S T R A I N T '_' N A M E;                    // SQL-2003-N
CONSTRAINT_SCHEMA_SYMBOL:           C O N S T R A I N T '_' S C H E M A;                // SQL-2003-N
CONTAINS_SYMBOL:                    C O N T A I N S;                                    // SQL-2003-N
CONTEXT_SYMBOL:                     C O N T E X T;
CONTINUE_SYMBOL:                    C O N T I N U E;                                    // SQL-2003-R
CONVERT_SYMBOL:                     C O N V E R T;                                      // SQL-2003-N
COUNT_SYMBOL:
    C O U N T                                                                           { this.type = this.determineFunction(MySQLMRSLexer.COUNT_SYMBOL); }; // SQL-2003-N
CPU_SYMBOL:                         C P U;
CREATE_SYMBOL:                      C R E A T E;                                        // SQL-2003-R
CROSS_SYMBOL:                       C R O S S;                                          // SQL-2003-R
CUBE_SYMBOL:                        C U B E;                                            // SQL-2003-R
CURDATE_SYMBOL:
    C U R D A T E                                                                       { this.type = this.determineFunction(MySQLMRSLexer.CURDATE_SYMBOL); }; // MYSQL-FUNC
CURRENT_SYMBOL:                     C U R R E N T;
CURRENT_DATE_SYMBOL:
    C U R R E N T '_' D A T E                                                           { this.type = this.determineFunction(MySQLMRSLexer.CURDATE_SYMBOL); }; // Synonym, MYSQL-FUNC
CURRENT_TIME_SYMBOL:
    C U R R E N T '_' T I M E                                                           { this.type = this.determineFunction(MySQLMRSLexer.CURTIME_SYMBOL); }; // Synonym, MYSQL-FUNC
CURRENT_TIMESTAMP_SYMBOL:           C U R R E N T '_' T I M E S T A M P                 -> type(NOW_SYMBOL); // Synonym
CURRENT_USER_SYMBOL:                C U R R E N T '_' U S E R;                          // SQL-2003-R
CURSOR_SYMBOL:                      C U R S O R;                                        // SQL-2003-R
CURSOR_NAME_SYMBOL:                 C U R S O R '_' N A M E;                            // SQL-2003-N
CURTIME_SYMBOL:
    C U R T I M E                                                                       { this.type = this.determineFunction(MySQLMRSLexer.CURTIME_SYMBOL); }; // MYSQL-FUNC
DATABASE_SYMBOL:                    D A T A B A S E;
DATABASES_SYMBOL:                   D A T A B A S E S;
DATAFILE_SYMBOL:                    D A T A F I L E;
DATA_SYMBOL:                        D A T A;                                            // SQL-2003-N
DATETIME_SYMBOL:                    D A T E T I M E;                                    // MYSQL
DATE_ADD_SYMBOL:
    D A T E '_' A D D                                                                   { this.type = this.determineFunction(MySQLMRSLexer.DATE_ADD_SYMBOL); };
DATE_SUB_SYMBOL:
    D A T E '_' S U B                                                                   { this.type = this.determineFunction(MySQLMRSLexer.DATE_SUB_SYMBOL); };
DATE_SYMBOL:                        D A T E;                                            // SQL-2003-R
DAYOFMONTH_SYMBOL:                  D A Y O F M O N T H                                 -> type(DAY_SYMBOL); // Synonym
DAY_HOUR_SYMBOL:                    D A Y '_' H O U R;
DAY_MICROSECOND_SYMBOL:             D A Y '_' M I C R O S E C O N D;
DAY_MINUTE_SYMBOL:                  D A Y '_' M I N U T E;
DAY_SECOND_SYMBOL:                  D A Y '_' S E C O N D;
DAY_SYMBOL:                         D A Y;                                              // SQL-2003-R
DEALLOCATE_SYMBOL:                  D E A L L O C A T E;                                // SQL-2003-R
DEC_SYMBOL:                         D E C                                               -> type(DECIMAL_SYMBOL); // Synonym
DECIMAL_SYMBOL:                     D E C I M A L;                                      // SQL-2003-R
DECLARE_SYMBOL:                     D E C L A R E;                                      // SQL-2003-R
DEFAULT_SYMBOL:                     D E F A U L T;                                      // SQL-2003-R
DEFAULT_AUTH_SYMBOL:                D E F A U L T '_' A U T H;                          // Internal
DEFINER_SYMBOL:                     D E F I N E R;
DELAYED_SYMBOL:                     D E L A Y E D;
DELAY_KEY_WRITE_SYMBOL:             D E L A Y '_' K E Y '_' W R I T E;
DELETE_SYMBOL:                      D E L E T E;                                        // SQL-2003-R
DESC_SYMBOL:                        D E S C;                                            // SQL-2003-N
DESCRIBE_SYMBOL:                    D E S C R I B E;                                    // SQL-2003-R
DETERMINISTIC_SYMBOL:               D E T E R M I N I S T I C;                          // SQL-2003-R
DIAGNOSTICS_SYMBOL:                 D I A G N O S T I C S;
DIRECTORY_SYMBOL:                   D I R E C T O R Y;
DISABLE_SYMBOL:                     D I S A B L E;
DISCARD_SYMBOL:                     D I S C A R D;
DISK_SYMBOL:                        D I S K;
DISTINCT_SYMBOL:                    D I S T I N C T;                                    // SQL-2003-R
DISTINCTROW_SYMBOL:                 D I S T I N C T R O W                               -> type(DISTINCT_SYMBOL); // Synonym
DIV_SYMBOL:                         D I V;
DOUBLE_SYMBOL:                      D O U B L E;                                        // SQL-2003-R
DO_SYMBOL:                          D O;
DROP_SYMBOL:                        D R O P;                                            // SQL-2003-R
DUAL_SYMBOL:                        D U A L;
DUMPFILE_SYMBOL:                    D U M P F I L E;
DUPLICATE_SYMBOL:                   D U P L I C A T E;
DYNAMIC_SYMBOL:                     D Y N A M I C;                                      // SQL-2003-R
EACH_SYMBOL:                        E A C H;                                            // SQL-2003-R
ELSE_SYMBOL:                        E L S E;                                            // SQL-2003-R
ELSEIF_SYMBOL:                      E L S E I F;
ENABLE_SYMBOL:                      E N A B L E;
ENCLOSED_SYMBOL:                    E N C L O S E D;
ENCRYPTION_SYMBOL:                  E N C R Y P T I O N;
END_SYMBOL:                         E N D;                                              // SQL-2003-R
ENDS_SYMBOL:                        E N D S;
ENGINES_SYMBOL:                     E N G I N E S;
ENGINE_SYMBOL:                      E N G I N E;
ENUM_SYMBOL:                        E N U M;                                            // MYSQL
ERROR_SYMBOL:                       E R R O R;
ERRORS_SYMBOL:                      E R R O R S;
ESCAPED_SYMBOL:                     E S C A P E D;
ESCAPE_SYMBOL:                      E S C A P E;                                        // SQL-2003-R
EVENTS_SYMBOL:                      E V E N T S;
EVENT_SYMBOL:                       E V E N T;
EVERY_SYMBOL:                       E V E R Y;                                          // SQL-2003-N
EXCHANGE_SYMBOL:                    E X C H A N G E;
EXECUTE_SYMBOL:                     E X E C U T E;                                      // SQL-2003-R
EXISTS_SYMBOL:                      E X I S T S;                                        // SQL-2003-R
EXIT_SYMBOL:                        E X I T;
EXPANSION_SYMBOL:                   E X P A N S I O N;
EXPIRE_SYMBOL:                      E X P I R E;
EXPLAIN_SYMBOL:                     E X P L A I N;                                      // SQL-2003-R
EXPORT_SYMBOL:                      E X P O R T;
EXTENDED_SYMBOL:                    E X T E N D E D;
EXTENT_SIZE_SYMBOL:                 E X T E N T '_' S I Z E;
EXTRACT_SYMBOL:
    E X T R A C T                                                                       { this.type = this.determineFunction(MySQLMRSLexer.EXTRACT_SYMBOL); }; // SQL-2003-N
FALSE_SYMBOL:                       F A L S E;                                          // SQL-2003-R
FAST_SYMBOL:                        F A S T;
FAULTS_SYMBOL:                      F A U L T S;
FETCH_SYMBOL:                       F E T C H;                                          // SQL-2003-R
FIELDS_SYMBOL:                      F I E L D S                                         -> type(COLUMNS_SYMBOL); // Synonym
FILE_SYMBOL:                        F I L E;
FILE_BLOCK_SIZE_SYMBOL:             F I L E '_' B L O C K '_' S I Z E;
FILTER_SYMBOL:                      F I L T E R;
FIRST_SYMBOL:                       F I R S T;                                          // SQL-2003-N
FIXED_SYMBOL:                       F I X E D;
FLOAT4_SYMBOL:                      F L O A T '4'                                       -> type(FLOAT_SYMBOL); // Synonym
FLOAT8_SYMBOL:                      F L O A T '8'                                       -> type(DOUBLE_SYMBOL); // Synonym
FLOAT_SYMBOL:                       F L O A T;                                          // SQL-2003-R
FLUSH_SYMBOL:                       F L U S H;
FOLLOWS_SYMBOL:                     F O L L O W S;
FORCE_SYMBOL:                       F O R C E;
FOREIGN_SYMBOL:                     F O R E I G N;                                      // SQL-2003-R
FOR_SYMBOL:                         F O R;                                              // SQL-2003-R
FORMAT_SYMBOL:                      F O R M A T;
FOUND_SYMBOL:                       F O U N D;                                          // SQL-2003-R
FROM_SYMBOL:                        F R O M;
FULL_SYMBOL:                        F U L L;                                            // SQL-2003-R
FULLTEXT_SYMBOL:                    F U L L T E X T;
FUNCTION_SYMBOL:                    F U N C T I O N;                                    // SQL-2003-R
GET_SYMBOL:                         G E T;
GENERAL_SYMBOL:                     G E N E R A L;
GENERATED_SYMBOL:                   G E N E R A T E D;
GROUP_REPLICATION_SYMBOL:           G R O U P '_' R E P L I C A T I O N;
GEOMETRYCOLLECTION_SYMBOL:          G E O M E T R Y C O L L E C T I O N;                // MYSQL
GEOMETRY_SYMBOL:                    G E O M E T R Y;
GET_FORMAT_SYMBOL:                  G E T '_' F O R M A T;                              // MYSQL-FUNC
GLOBAL_SYMBOL:                      G L O B A L;                                        // SQL-2003-R
GRANT_SYMBOL:                       G R A N T;                                          // SQL-2003-R
GRANTS_SYMBOL:                      G R A N T S;
GROUP_SYMBOL:                       G R O U P;                                          // SQL-2003-R
GROUP_CONCAT_SYMBOL:
    G R O U P '_' C O N C A T                                                           { this.type = this.determineFunction(MySQLMRSLexer.GROUP_CONCAT_SYMBOL); };
HANDLER_SYMBOL:                     H A N D L E R;
HASH_SYMBOL:                        H A S H;
HAVING_SYMBOL:                      H A V I N G;                                        // SQL-2003-R
HELP_SYMBOL:                        H E L P;
HIGH_PRIORITY_SYMBOL:               H I G H '_' P R I O R I T Y;
HOST_SYMBOL:                        H O S T;
HOSTS_SYMBOL:                       H O S T S;
HOUR_MICROSECOND_SYMBOL:            H O U R '_' M I C R O S E C O N D;
HOUR_MINUTE_SYMBOL:                 H O U R '_' M I N U T E;
HOUR_SECOND_SYMBOL:                 H O U R '_' S E C O N D;
HOUR_SYMBOL:                        H O U R;                                            // SQL-2003-R
IDENTIFIED_SYMBOL:                  I D E N T I F I E D;
IF_SYMBOL:                          I F;
IGNORE_SYMBOL:                      I G N O R E;
IGNORE_SERVER_IDS_SYMBOL:           I G N O R E '_' S E R V E R '_' I D S;
IMPORT_SYMBOL:                      I M P O R T;
INDEXES_SYMBOL:                     I N D E X E S;
INDEX_SYMBOL:                       I N D E X;
INFILE_SYMBOL:                      I N F I L E;
INITIAL_SIZE_SYMBOL:                I N I T I A L '_' S I Z E;
INNER_SYMBOL:                       I N N E R;                                          // SQL-2003-R
INOUT_SYMBOL:                       I N O U T;                                          // SQL-2003-R
INSENSITIVE_SYMBOL:                 I N S E N S I T I V E;                              // SQL-2003-R
INSERT_SYMBOL:                      I N S E R T;                                        // SQL-2003-R
INSERT_METHOD_SYMBOL:               I N S E R T '_' M E T H O D;
INSTANCE_SYMBOL:                    I N S T A N C E;
INSTALL_SYMBOL:                     I N S T A L L;
INTEGER_SYMBOL:                     I N T E G E R                                       -> type(INT_SYMBOL); // Synonym
INTERVAL_SYMBOL:                    I N T E R V A L;                                    // SQL-2003-R
INTO_SYMBOL:                        I N T O;                                            // SQL-2003-R
INT_SYMBOL:                         I N T;                                              // SQL-2003-R
INVOKER_SYMBOL:                     I N V O K E R;
IN_SYMBOL:                          I N;                                                // SQL-2003-R
IO_AFTER_GTIDS_SYMBOL:              I O '_' A F T E R '_' G T I D S;                    // MYSQL, FUTURE-USE
IO_BEFORE_GTIDS_SYMBOL:             I O '_' B E F O R E '_' G T I D S;                  // MYSQL, FUTURE-USE
IO_THREAD_SYMBOL:                   I O '_' T H R E A D                                 -> type(RELAY_THREAD_SYMBOL); // Synonym
IO_SYMBOL:                          I O;
IPC_SYMBOL:                         I P C;
IS_SYMBOL:                          I S;                                                // SQL-2003-R
ISOLATION_SYMBOL:                   I S O L A T I O N;                                  // SQL-2003-R
ISSUER_SYMBOL:                      I S S U E R;
ITERATE_SYMBOL:                     I T E R A T E;
JOIN_SYMBOL:                        J O I N;                                            // SQL-2003-R
JSON_SYMBOL:                        J S O N;                                            // MYSQL
KEYS_SYMBOL:                        K E Y S;
KEY_BLOCK_SIZE_SYMBOL:              K E Y '_' B L O C K '_' S I Z E;
KEY_SYMBOL:                         K E Y;                                              // SQL-2003-N
KILL_SYMBOL:                        K I L L;
LANGUAGE_SYMBOL:                    L A N G U A G E;                                    // SQL-2003-R
LAST_SYMBOL:                        L A S T;                                            // SQL-2003-N
LEADING_SYMBOL:                     L E A D I N G;                                      // SQL-2003-R
LEAVES_SYMBOL:                      L E A V E S;
LEAVE_SYMBOL:                       L E A V E;
LEFT_SYMBOL:                        L E F T;                                            // SQL-2003-R
LESS_SYMBOL:                        L E S S;
LEVEL_SYMBOL:                       L E V E L;
LIKE_SYMBOL:                        L I K E;                                            // SQL-2003-R
LIMIT_SYMBOL:                       L I M I T;
LINEAR_SYMBOL:                      L I N E A R;
LINES_SYMBOL:                       L I N E S;
LINESTRING_SYMBOL:                  L I N E S T R I N G;                                // MYSQL
LIST_SYMBOL:                        L I S T;
LOAD_SYMBOL:                        L O A D;
LOCALTIME_SYMBOL:                   L O C A L T I M E                                   -> type(NOW_SYMBOL); // Synonym
LOCALTIMESTAMP_SYMBOL:              L O C A L T I M E S T A M P                         -> type(NOW_SYMBOL); // Synonym
LOCAL_SYMBOL:                       L O C A L;                                          // SQL-2003-R
LOCKS_SYMBOL:                       L O C K S;
LOCK_SYMBOL:                        L O C K;
LOGFILE_SYMBOL:                     L O G F I L E;
LOGS_SYMBOL:                        L O G S;
LONGBLOB_SYMBOL:                    L O N G B L O B;                                    // MYSQL
LONGTEXT_SYMBOL:                    L O N G T E X T;                                    // MYSQL
LONG_SYMBOL:                        L O N G;
LOOP_SYMBOL:                        L O O P;
LOW_PRIORITY_SYMBOL:                L O W '_' P R I O R I T Y;
MASTER_AUTO_POSITION_SYMBOL:
    M A S T E R '_' A U T O '_' P O S I T I O N                                         {this.serverVersion < 80024}?;
MASTER_BIND_SYMBOL:                 M A S T E R '_' B I N D                             {this.serverVersion < 80024}?;
MASTER_CONNECT_RETRY_SYMBOL:
    M A S T E R '_' C O N N E C T '_' R E T R Y                                         {this.serverVersion < 80024}?;
MASTER_DELAY_SYMBOL:                M A S T E R '_' D E L A Y                           {this.serverVersion < 80024}?;
MASTER_HOST_SYMBOL:                 M A S T E R '_' H O S T                             {this.serverVersion < 80024}?;
MASTER_LOG_FILE_SYMBOL:             M A S T E R '_' L O G '_' F I L E                   {this.serverVersion < 80024}?;
MASTER_LOG_POS_SYMBOL:              M A S T E R '_' L O G '_' P O S                     {this.serverVersion < 80024}?;
MASTER_PASSWORD_SYMBOL:             M A S T E R '_' P A S S W O R D                     {this.serverVersion < 80024}?;
MASTER_PORT_SYMBOL:                 M A S T E R '_' P O R T                             {this.serverVersion < 80024}?;
MASTER_RETRY_COUNT_SYMBOL:          M A S T E R '_' R E T R Y '_' C O U N T             {this.serverVersion < 80024}?;
MASTER_SSL_CAPATH_SYMBOL:           M A S T E R '_' S S L '_' C A P A T H               {this.serverVersion < 80024}?;
MASTER_SSL_CA_SYMBOL:               M A S T E R '_' S S L '_' C A                       {this.serverVersion < 80024}?;
MASTER_SSL_CERT_SYMBOL:             M A S T E R '_' S S L '_' C E R T                   {this.serverVersion < 80024}?;
MASTER_SSL_CIPHER_SYMBOL:           M A S T E R '_' S S L '_' C I P H E R               {this.serverVersion < 80024}?;
MASTER_SSL_CRL_SYMBOL:              M A S T E R '_' S S L '_' C R L                     {this.serverVersion < 80024}?;
MASTER_SSL_CRLPATH_SYMBOL:          M A S T E R '_' S S L '_' C R L P A T H             {this.serverVersion < 80024}?;
MASTER_SSL_KEY_SYMBOL:              M A S T E R '_' S S L '_' K E Y                     {this.serverVersion < 80024}?;
MASTER_SSL_SYMBOL:                  M A S T E R '_' S S L                               {this.serverVersion < 80024}?;
MASTER_SSL_VERIFY_SERVER_CERT_SYMBOL:
    M A S T E R '_' S S L '_' V E R I F Y '_' S E R V E R '_' C E R T                   {this.serverVersion < 80024}?;
MASTER_SYMBOL:                      M A S T E R                                         {this.serverVersion < 80024}?;
MASTER_TLS_VERSION_SYMBOL:          M A S T E R '_' T L S '_' V E R S I O N             {this.serverVersion < 80024}?;
MASTER_USER_SYMBOL:                 M A S T E R '_' U S E R                             {this.serverVersion < 80024}?;
MASTER_HEARTBEAT_PERIOD_SYMBOL:
    M A S T E R '_' H E A R T B E A T '_' P E R I O D                                   {this.serverVersion < 80024}?;
MATCH_SYMBOL:                       M A T C H;                                          // SQL-2003-R
MAX_CONNECTIONS_PER_HOUR_SYMBOL:    M A X '_' C O N N E C T I O N S '_' P E R '_' H O U R;
MAX_QUERIES_PER_HOUR_SYMBOL:        M A X '_' Q U E R I E S '_' P E R '_' H O U R;
MAX_ROWS_SYMBOL:                    M A X '_' R O W S;
MAX_SIZE_SYMBOL:                    M A X '_' S I Z E;
MAX_SYMBOL:                         M A X                                               { this.type = this.determineFunction(MySQLMRSLexer.MAX_SYMBOL); }; // SQL-2003-N
MAX_UPDATES_PER_HOUR_SYMBOL:        M A X '_' U P D A T E S '_' P E R '_' H O U R;
MAX_USER_CONNECTIONS_SYMBOL:        M A X '_' U S E R '_' C O N N E C T I O N S;
MAXVALUE_SYMBOL:                    M A X V A L U E;                                    // SQL-2003-N
MEDIUMBLOB_SYMBOL:                  M E D I U M B L O B;                                // MYSQL
MEDIUMINT_SYMBOL:                   M E D I U M I N T;                                  // MYSQL
MEDIUMTEXT_SYMBOL:                  M E D I U M T E X T;                                // MYSQL
MEDIUM_SYMBOL:                      M E D I U M;
MEMORY_SYMBOL:                      M E M O R Y;
MERGE_SYMBOL:                       M E R G E;                                          // SQL-2003-R
MESSAGE_TEXT_SYMBOL:                M E S S A G E '_' T E X T;                          // SQL-2003-N
MICROSECOND_SYMBOL:                 M I C R O S E C O N D;                              // MYSQL-FUNC
MID_SYMBOL:                         M I D                                               { this.type = this.determineFunction(MySQLMRSLexer.SUBSTRING_SYMBOL); }; // Synonym
MIDDLEINT_SYMBOL:                   M I D D L E I N T                                   -> type(MEDIUMINT_SYMBOL); // Synonym (for Powerbuilder)
MIGRATE_SYMBOL:                     M I G R A T E;
MINUTE_MICROSECOND_SYMBOL:          M I N U T E '_' M I C R O S E C O N D;
MINUTE_SECOND_SYMBOL:               M I N U T E '_' S E C O N D;
MINUTE_SYMBOL:                      M I N U T E;                                        // SQL-2003-R
MIN_ROWS_SYMBOL:                    M I N '_' R O W S;
MIN_SYMBOL:                         M I N                                               { this.type = this.determineFunction(MySQLMRSLexer.MIN_SYMBOL); }; // SQL-2003-N
MODE_SYMBOL:                        M O D E;
MODIFIES_SYMBOL:                    M O D I F I E S;                                    // SQL-2003-R
MODIFY_SYMBOL:                      M O D I F Y;
MOD_SYMBOL:                         M O D;                                              // SQL-2003-N
MONTH_SYMBOL:                       M O N T H;                                          // SQL-2003-R
MULTILINESTRING_SYMBOL:             M U L T I L I N E S T R I N G;                      // MYSQL
MULTIPOINT_SYMBOL:                  M U L T I P O I N T;                                // MYSQL
MULTIPOLYGON_SYMBOL:                M U L T I P O L Y G O N;                            // MYSQL
MUTEX_SYMBOL:                       M U T E X;
MYSQL_ERRNO_SYMBOL:                 M Y S Q L '_' E R R N O;
NAMES_SYMBOL:                       N A M E S;                                          // SQL-2003-N
NAME_SYMBOL:                        N A M E;                                            // SQL-2003-N
NATIONAL_SYMBOL:                    N A T I O N A L;                                    // SQL-2003-R
NATURAL_SYMBOL:                     N A T U R A L;                                      // SQL-2003-R
NCHAR_SYMBOL:                       N C H A R;                                          // SQL-2003-R
NDB_SYMBOL:                         N D B                                               -> type(NDBCLUSTER_SYMBOL); //Synonym
NDBCLUSTER_SYMBOL:                  N D B C L U S T E R;
NEVER_SYMBOL:                       N E V E R;
NEW_SYMBOL:                         N E W;                                              // SQL-2003-R
NEXT_SYMBOL:                        N E X T;                                            // SQL-2003-N
NODEGROUP_SYMBOL:                   N O D E G R O U P;
NONE_SYMBOL:                        N O N E;                                            // SQL-2003-R
NOT_SYMBOL:
    N O T                                                                               { this.type = this.isSqlModeActive(SqlMode.HighNotPrecedence) ? MySQLMRSLexer.NOT2_SYMBOL: MySQLMRSLexer.NOT_SYMBOL; }; // SQL-2003-R
NOW_SYMBOL:                         N O W                                               { this.type = this.determineFunction(MySQLMRSLexer.NOW_SYMBOL); };
NO_SYMBOL:                          N O;                                                // SQL-2003-R
NO_WAIT_SYMBOL:                     N O '_' W A I T;
NO_WRITE_TO_BINLOG_SYMBOL:          N O '_' W R I T E '_' T O '_' B I N L O G;
NULL_SYMBOL:                        N U L L;                                            // SQL-2003-R
NUMBER_SYMBOL:                      N U M B E R;
NUMERIC_SYMBOL:                     N U M E R I C;                                      // SQL-2003-R
NVARCHAR_SYMBOL:                    N V A R C H A R;
OFFLINE_SYMBOL:                     O F F L I N E;
OFFSET_SYMBOL:                      O F F S E T;
ON_SYMBOL:                          O N;                                                // SQL-2003-R
ONE_SYMBOL:                         O N E;
ONLINE_SYMBOL:                      O N L I N E;
ONLY_SYMBOL:                        O N L Y;
OPEN_SYMBOL:                        O P E N;                                            // SQL-2003-R
OPTIMIZE_SYMBOL:                    O P T I M I Z E;
OPTIMIZER_COSTS_SYMBOL:             O P T I M I Z E R '_' C O S T S;
OPTIONS_SYMBOL:                     O P T I O N S;
OPTION_SYMBOL:                      O P T I O N;                                        // SQL-2003-N
OPTIONALLY_SYMBOL:                  O P T I O N A L L Y;
ORDER_SYMBOL:                       O R D E R;                                          // SQL-2003-R
OR_SYMBOL:                          O R;                                                // SQL-2003-R
OUTER_SYMBOL:                       O U T E R;
OUTFILE_SYMBOL:                     O U T F I L E;
OUT_SYMBOL:                         O U T;                                              // SQL-2003-R
OWNER_SYMBOL:                       O W N E R;
PACK_KEYS_SYMBOL:                   P A C K '_' K E Y S;
PAGE_SYMBOL:                        P A G E;
PARSER_SYMBOL:                      P A R S E R;
PARTIAL_SYMBOL:                     P A R T I A L;                                      // SQL-2003-N
PARTITIONING_SYMBOL:                P A R T I T I O N I N G;
PARTITIONS_SYMBOL:                  P A R T I T I O N S;
PARTITION_SYMBOL:                   P A R T I T I O N;                                  // SQL-2003-R
PASSWORD_SYMBOL:                    P A S S W O R D;
PHASE_SYMBOL:                       P H A S E;
PLUGINS_SYMBOL:                     P L U G I N S;
PLUGIN_DIR_SYMBOL:                  P L U G I N '_' D I R;                              // Internal
PLUGIN_SYMBOL:                      P L U G I N;
POINT_SYMBOL:                       P O I N T;
POLYGON_SYMBOL:                     P O L Y G O N;                                      // MYSQL
PORT_SYMBOL:                        P O R T;
POSITION_SYMBOL:
    P O S I T I O N                                                                     { this.type = this.determineFunction(MySQLMRSLexer.POSITION_SYMBOL); }; // SQL-2003-N
PRECEDES_SYMBOL:                    P R E C E D E S;
PRECISION_SYMBOL:                   P R E C I S I O N;                                  // SQL-2003-R
PREPARE_SYMBOL:                     P R E P A R E;                                      // SQL-2003-R
PRESERVE_SYMBOL:                    P R E S E R V E;
PREV_SYMBOL:                        P R E V;
PRIMARY_SYMBOL:                     P R I M A R Y;                                      // SQL-2003-R
PRIVILEGES_SYMBOL:                  P R I V I L E G E S;                                // SQL-2003-N
PROCEDURE_SYMBOL:                   P R O C E D U R E;                                  // SQL-2003-R
PROCESS_SYMBOL:                     P R O C E S S;
PROCESSLIST_SYMBOL:                 P R O C E S S L I S T;
PROFILE_SYMBOL:                     P R O F I L E;
PROFILES_SYMBOL:                    P R O F I L E S;
PROXY_SYMBOL:                       P R O X Y;
PURGE_SYMBOL:                       P U R G E;
QUARTER_SYMBOL:                     Q U A R T E R;
QUERY_SYMBOL:                       Q U E R Y;
QUICK_SYMBOL:                       Q U I C K;
RANGE_SYMBOL:                       R A N G E;                                          // SQL-2003-R
READS_SYMBOL:                       R E A D S;                                          // SQL-2003-R
READ_ONLY_SYMBOL:                   R E A D '_' O N L Y;
READ_SYMBOL:                        R E A D;                                            // SQL-2003-N
READ_WRITE_SYMBOL:                  R E A D '_' W R I T E;
REAL_SYMBOL:                        R E A L;                                            // SQL-2003-R
REBUILD_SYMBOL:                     R E B U I L D;
RECOVER_SYMBOL:                     R E C O V E R;
REDO_BUFFER_SIZE_SYMBOL:            R E D O '_' B U F F E R '_' S I Z E;
REDUNDANT_SYMBOL:                   R E D U N D A N T;
REFERENCES_SYMBOL:                  R E F E R E N C E S;                                // SQL-2003-R
REGEXP_SYMBOL:                      R E G E X P;
RELAY_SYMBOL:                       R E L A Y;
RELAYLOG_SYMBOL:                    R E L A Y L O G;
RELAY_LOG_FILE_SYMBOL:              R E L A Y '_' L O G '_' F I L E;
RELAY_LOG_POS_SYMBOL:               R E L A Y '_' L O G '_' P O S;
RELAY_THREAD_SYMBOL:                R E L A Y '_' T H R E A D;
RELEASE_SYMBOL:                     R E L E A S E;                                      // SQL-2003-R
RELOAD_SYMBOL:                      R E L O A D;
REMOVE_SYMBOL:                      R E M O V E;
RENAME_SYMBOL:                      R E N A M E;
REORGANIZE_SYMBOL:                  R E O R G A N I Z E;
REPAIR_SYMBOL:                      R E P A I R;
REPEATABLE_SYMBOL:                  R E P E A T A B L E;                                // SQL-2003-N
REPEAT_SYMBOL:                      R E P E A T;                                        // MYSQL-FUNC
REPLACE_SYMBOL:                     R E P L A C E;                                      // MYSQL-FUNC
REPLICATION_SYMBOL:                 R E P L I C A T I O N;
REPLICATE_DO_DB_SYMBOL:             R E P L I C A T E '_' D O '_' D B;
REPLICATE_IGNORE_DB_SYMBOL:         R E P L I C A T E '_' I G N O R E '_' D B;
REPLICATE_DO_TABLE_SYMBOL:          R E P L I C A T E '_' D O '_' T A B L E;
REPLICATE_IGNORE_TABLE_SYMBOL:      R E P L I C A T E '_' I G N O R E '_' T A B L E?;
REPLICATE_WILD_DO_TABLE_SYMBOL:     R E P L I C A T E '_' W I L D '_' D O '_' T A B L E?;
REPLICATE_WILD_IGNORE_TABLE_SYMBOL: R E P L I C A T E '_' W I L D '_' I G N O R E '_' T A B L E?;
REPLICATE_REWRITE_DB_SYMBOL:        R E P L I C A T E '_' R E W R I T E '_' D B?;
REQUIRE_SYMBOL:                     R E Q U I R E;
RESET_SYMBOL:                       R E S E T;
RESIGNAL_SYMBOL:                    R E S I G N A L;                                    // SQL-2003-R
RESTORE_SYMBOL:                     R E S T O R E;
RESTRICT_SYMBOL:                    R E S T R I C T;
RESUME_SYMBOL:                      R E S U M E;
RETURNED_SQLSTATE_SYMBOL:           R E T U R N E D '_' S Q L S T A T E;
RETURNS_SYMBOL:                     R E T U R N S;                                      // SQL-2003-R
RETURN_SYMBOL:                      R E T U R N?;                                       // SQL-2003-R
REVERSE_SYMBOL:                     R E V E R S E;
REVOKE_SYMBOL:                      R E V O K E;                                        // SQL-2003-R
RIGHT_SYMBOL:                       R I G H T;                                          // SQL-2003-R
RLIKE_SYMBOL:                       R L I K E                                           -> type(REGEXP_SYMBOL); // Synonym (like in mSQL2)
ROLLBACK_SYMBOL:                    R O L L B A C K;                                    // SQL-2003-R
ROLLUP_SYMBOL:                      R O L L U P;                                        // SQL-2003-R
ROTATE_SYMBOL:                      R O T A T E;
ROUTINE_SYMBOL:                     R O U T I N E;                                      // SQL-2003-N
ROWS_SYMBOL:                        R O W S;                                            // SQL-2003-R
ROW_COUNT_SYMBOL:                   R O W '_' C O U N T;
ROW_FORMAT_SYMBOL:                  R O W '_' F O R M A T;
ROW_SYMBOL:                         R O W;                                              // SQL-2003-R
RTREE_SYMBOL:                       R T R E E;
SAVEPOINT_SYMBOL:                   S A V E P O I N T;                                  // SQL-2003-R
SCHEDULE_SYMBOL:                    S C H E D U L E;
SCHEMA_SYMBOL:                      S C H E M A                                         -> type(DATABASE_SYMBOL); // Synonym
SCHEMA_NAME_SYMBOL:                 S C H E M A '_' N A M E;                            // SQL-2003-N
SCHEMAS_SYMBOL:                     S C H E M A S                                       -> type(DATABASES_SYMBOL); // Synonym
SECOND_MICROSECOND_SYMBOL:          S E C O N D '_' M I C R O S E C O N D;
SECOND_SYMBOL:                      S E C O N D;                                        // SQL-2003-R
SECURITY_SYMBOL:                    S E C U R I T Y;                                    // SQL-2003-N
SELECT_SYMBOL:                      S E L E C T;                                        // SQL-2003-R
SENSITIVE_SYMBOL:                   S E N S I T I V E;                                  // FUTURE-USE
SEPARATOR_SYMBOL:                   S E P A R A T O R;
SERIALIZABLE_SYMBOL:                S E R I A L I Z A B L E;                            // SQL-2003-N
SERIAL_SYMBOL:                      S E R I A L;
SESSION_SYMBOL:                     S E S S I O N;                                      // SQL-2003-N
SERVER_SYMBOL:                      S E R V E R;
SESSION_USER_SYMBOL:
    S E S S I O N '_' U S E R                                                           { this.type = this.determineFunction(MySQLMRSLexer.USER_SYMBOL); }; // Synonym
SET_SYMBOL:                         S E T;                                              // SQL-2003-R
SHARE_SYMBOL:                       S H A R E;
SHOW_SYMBOL:                        S H O W;
SHUTDOWN_SYMBOL:                    S H U T D O W N;
SIGNAL_SYMBOL:                      S I G N A L;                                        // SQL-2003-R
SIGNED_SYMBOL:                      S I G N E D;
SIMPLE_SYMBOL:                      S I M P L E;                                        // SQL-2003-N
SLAVE_SYMBOL:                       S L A V E;
SLOW_SYMBOL:                        S L O W;
SMALLINT_SYMBOL:                    S M A L L I N T;                                    // SQL-2003-R
SNAPSHOT_SYMBOL:                    S N A P S H O T;
SOME_SYMBOL:                        S O M E                                             -> type(ANY_SYMBOL); // Synonym
SOCKET_SYMBOL:                      S O C K E T;
SONAME_SYMBOL:                      S O N A M E;
SOUNDS_SYMBOL:                      S O U N D S;
SOURCE_SYMBOL:                      S O U R C E;
SPATIAL_SYMBOL:                     S P A T I A L;
SPECIFIC_SYMBOL:                    S P E C I F I C;                                    // SQL-2003-R
SQLEXCEPTION_SYMBOL:                S Q L E X C E P T I O N;                            // SQL-2003-R
SQLSTATE_SYMBOL:                    S Q L S T A T E;                                    // SQL-2003-R
SQLWARNING_SYMBOL:                  S Q L W A R N I N G;                                // SQL-2003-R
SQL_AFTER_GTIDS_SYMBOL:             S Q L '_' A F T E R '_' G T I D S;                  // MYSQL
SQL_AFTER_MTS_GAPS_SYMBOL:          S Q L '_' A F T E R '_' M T S '_' G A P S;          // MYSQL
SQL_BEFORE_GTIDS_SYMBOL:            S Q L '_' B E F O R E '_' G T I D S;                // MYSQL
SQL_BIG_RESULT_SYMBOL:              S Q L '_' B I G '_' R E S U L T;
SQL_BUFFER_RESULT_SYMBOL:           S Q L '_' B U F F E R '_' R E S U L T;
SQL_CALC_FOUND_ROWS_SYMBOL:         S Q L '_' C A L C '_' F O U N D '_' R O W S;
SQL_NO_CACHE_SYMBOL:                S Q L '_' N O '_' C A C H E;
SQL_SMALL_RESULT_SYMBOL:            S Q L '_' S M A L L '_' R E S U L T;
SQL_SYMBOL:                         S Q L;                                              // SQL-2003-R
SQL_THREAD_SYMBOL:                  S Q L '_' T H R E A D;
SSL_SYMBOL:                         S S L;
STACKED_SYMBOL:                     S T A C K E D;
STARTING_SYMBOL:                    S T A R T I N G;
STARTS_SYMBOL:                      S T A R T S;
START_SYMBOL:                       S T A R T;                                          // SQL-2003-R
STATS_AUTO_RECALC_SYMBOL:           S T A T S '_' A U T O '_' R E C A L C;
STATS_PERSISTENT_SYMBOL:            S T A T S '_' P E R S I S T E N T;
STATS_SAMPLE_PAGES_SYMBOL:          S T A T S '_' S A M P L E '_' P A G E S;
STATUS_SYMBOL:                      S T A T U S;
STDDEV_SAMP_SYMBOL:
    S T D D E V '_' S A M P                                                             { this.type = this.determineFunction(MySQLMRSLexer.STDDEV_SAMP_SYMBOL); }; // SQL-2003-N
STDDEV_SYMBOL:
    S T D D E V                                                                         { this.type = this.determineFunction(MySQLMRSLexer.STD_SYMBOL); }; // Synonym
STDDEV_POP_SYMBOL:
    S T D D E V '_' P O P                                                               { this.type = this.determineFunction(MySQLMRSLexer.STD_SYMBOL); }; // Synonym
STD_SYMBOL:                         S T D                                               { this.type = this.determineFunction(MySQLMRSLexer.STD_SYMBOL); };
STOP_SYMBOL:                        S T O P;
STORAGE_SYMBOL:                     S T O R A G E;
STORED_SYMBOL:                      S T O R E D;
STRAIGHT_JOIN_SYMBOL:               S T R A I G H T '_' J O I N;
STRING_SYMBOL:                      S T R I N G;
SUBCLASS_ORIGIN_SYMBOL:             S U B C L A S S '_' O R I G I N;                    // SQL-2003-N
SUBDATE_SYMBOL:                     S U B D A T E                                       { this.type = this.determineFunction(MySQLMRSLexer.SUBDATE_SYMBOL); };
SUBJECT_SYMBOL:                     S U B J E C T;
SUBPARTITIONS_SYMBOL:               S U B P A R T I T I O N S;
SUBPARTITION_SYMBOL:                S U B P A R T I T I O N;
SUBSTR_SYMBOL:
    S U B S T R                                                                         { this.type = this.determineFunction(MySQLMRSLexer.SUBSTRING_SYMBOL); }; // Synonym
SUBSTRING_SYMBOL:
    S U B S T R I N G                                                                   { this.type = this.determineFunction(MySQLMRSLexer.SUBSTRING_SYMBOL); }; // SQL-2003-N
SUM_SYMBOL:                         S U M                                               { this.type = this.determineFunction(MySQLMRSLexer.SUM_SYMBOL); }; // SQL-2003-N
SUPER_SYMBOL:                       S U P E R;
SUSPEND_SYMBOL:                     S U S P E N D;
SWAPS_SYMBOL:                       S W A P S;
SWITCHES_SYMBOL:                    S W I T C H E S;
SYSDATE_SYMBOL:                     S Y S D A T E                                       { this.type = this.determineFunction(MySQLMRSLexer.SYSDATE_SYMBOL); };
SYSTEM_USER_SYMBOL:
    S Y S T E M '_' U S E R                                                             { this.type = this.determineFunction(MySQLMRSLexer.USER_SYMBOL); };
TABLES_SYMBOL:                      T A B L E S;
TABLESPACE_SYMBOL:                  T A B L E S P A C E;
TABLE_SYMBOL:                       T A B L E;                                          // SQL-2003-R
TABLE_CHECKSUM_SYMBOL:              T A B L E '_' C H E C K S U M;
TABLE_NAME_SYMBOL:                  T A B L E '_' N A M E;                              // SQL-2003-N
TEMPORARY_SYMBOL:                   T E M P O R A R Y;                                  // SQL-2003-N
TEMPTABLE_SYMBOL:                   T E M P T A B L E;
TERMINATED_SYMBOL:                  T E R M I N A T E D;
TEXT_SYMBOL:                        T E X T;
THAN_SYMBOL:                        T H A N;
THEN_SYMBOL:                        T H E N;                                            // SQL-2003-R
TIMESTAMP_SYMBOL:                   T I M E S T A M P;                                  // SQL-2003-R
TIMESTAMPADD_SYMBOL:                T I M E S T A M P A D D;
TIMESTAMPDIFF_SYMBOL:               T I M E S T A M P D I F F;
TIME_SYMBOL:                        T I M E;                                            // SQL-2003-R
TINYBLOB_SYMBOL:                    T I N Y B L O B;                                    // MYSQL
TINYINT_SYMBOL:                     T I N Y I N T;                                      // MYSQL
TINYTEXT_SYMBOL:                    T I N Y T E X T;                                    // MYSQL
TO_SYMBOL:                          T O;                                                // SQL-2003-R
TRAILING_SYMBOL:                    T R A I L I N G;                                    // SQL-2003-R
TRANSACTION_SYMBOL:                 T R A N S A C T I O N;
TRIGGERS_SYMBOL:                    T R I G G E R S;
TRIGGER_SYMBOL:                     T R I G G E R;                                      // SQL-2003-R
TRIM_SYMBOL:                        T R I M                                             { this.type = this.determineFunction(MySQLMRSLexer.TRIM_SYMBOL); }; // SQL-2003-N
TRUE_SYMBOL:                        T R U E;                                            // SQL-2003-R
TRUNCATE_SYMBOL:                    T R U N C A T E;
TYPES_SYMBOL:                       T Y P E S;
TYPE_SYMBOL:                        T Y P E;                                            // SQL-2003-N
UDF_RETURNS_SYMBOL:                 U D F '_' R E T U R N S                             {this.serverVersion < 80031}?;
UNCOMMITTED_SYMBOL:                 U N C O M M I T T E D;                              // SQL-2003-N
UNDEFINED_SYMBOL:                   U N D E F I N E D;
UNDOFILE_SYMBOL:                    U N D O F I L E;
UNDO_BUFFER_SIZE_SYMBOL:            U N D O '_' B U F F E R '_' S I Z E;
UNDO_SYMBOL:                        U N D O;                                            // FUTURE-USE
UNICODE_SYMBOL:                     U N I C O D E;
UNINSTALL_SYMBOL:                   U N I N S T A L L;
UNION_SYMBOL:                       U N I O N;                                          // SQL-2003-R
UNIQUE_SYMBOL:                      U N I Q U E;
UNKNOWN_SYMBOL:                     U N K N O W N;                                      // SQL-2003-R
UNLOCK_SYMBOL:                      U N L O C K;
UNSIGNED_SYMBOL:                    U N S I G N E D;                                    // MYSQL
UNTIL_SYMBOL:                       U N T I L;
UPDATE_SYMBOL:                      U P D A T E;                                        // SQL-2003-R
UPGRADE_SYMBOL:                     U P G R A D E;
USAGE_SYMBOL:                       U S A G E;                                          // SQL-2003-N
USER_RESOURCES_SYMBOL:
    U S E R '_' R E S O U R C E S;                                                      // Represented only as RESOURCES in server grammar.
USER_SYMBOL:                        U S E R;                                            // SQL-2003-R
USE_FRM_SYMBOL:                     U S E '_' F R M;
USE_SYMBOL:                         U S E;
USING_SYMBOL:                       U S I N G;                                          // SQL-2003-R
UTC_DATE_SYMBOL:                    U T C '_' D A T E;
UTC_TIMESTAMP_SYMBOL:               U T C '_' T I M E S T A M P;
UTC_TIME_SYMBOL:                    U T C '_' T I M E;
VALIDATION_SYMBOL:                  V A L I D A T I O N;
VALUES_SYMBOL:                      V A L U E S;                                        // SQL-2003-R
VALUE_SYMBOL:                       V A L U E;                                          // SQL-2003-R
VARBINARY_SYMBOL:                   V A R B I N A R Y;                                  // SQL-2008-R
VARCHAR_SYMBOL:                     V A R C H A R;                                      // SQL-2003-R
VARCHARACTER_SYMBOL:                V A R C H A R A C T E R                             -> type(VARCHAR_SYMBOL); // Synonym
VARIABLES_SYMBOL:                   V A R I A B L E S;
VARIANCE_SYMBOL:
    V A R I A N C E                                                                     { this.type = this.determineFunction(MySQLMRSLexer.VARIANCE_SYMBOL); };
VARYING_SYMBOL:                     V A R Y I N G;                                      // SQL-2003-R
VAR_POP_SYMBOL:
    V A R '_' P O P                                                                     { this.type = this.determineFunction(MySQLMRSLexer.VARIANCE_SYMBOL); }; // Synonym
VAR_SAMP_SYMBOL:
    V A R '_' S A M P                                                                   { this.type = this.determineFunction(MySQLMRSLexer.VAR_SAMP_SYMBOL); };
VIEW_SYMBOL:                        V I E W;                                            // SQL-2003-N
VIRTUAL_SYMBOL:                     V I R T U A L;
WAIT_SYMBOL:                        W A I T;
WARNINGS_SYMBOL:                    W A R N I N G S;
WEEK_SYMBOL:                        W E E K;
WEIGHT_STRING_SYMBOL:               W E I G H T '_' S T R I N G;
WHEN_SYMBOL:                        W H E N;                                            // SQL-2003-R
WHERE_SYMBOL:                       W H E R E;                                          // SQL-2003-R
WHILE_SYMBOL:                       W H I L E;
WITH_SYMBOL:                        W I T H;                                            // SQL-2003-R
WITHOUT_SYMBOL:                     W I T H O U T;                                      // SQL-2003-R
WORK_SYMBOL:                        W O R K;                                            // SQL-2003-N
WRAPPER_SYMBOL:                     W R A P P E R;
WRITE_SYMBOL:                       W R I T E;                                          // SQL-2003-N
X509_SYMBOL:                        X '509';
XA_SYMBOL:                          X A;
XID_SYMBOL:                         X I D;
XML_SYMBOL:                         X M L;
XOR_SYMBOL:                         X O R;
YEAR_MONTH_SYMBOL:                  Y E A R '_' M O N T H;
YEAR_SYMBOL:                        Y E A R;                                            // SQL-2003-R
ZEROFILL_SYMBOL:                    Z E R O F I L L;                                    // MYSQL

/*
   Tokens from MySQL 8.0
*/
PERSIST_SYMBOL:                     P E R S I S T;
ROLE_SYMBOL:                        R O L E;                                            // SQL-1999-R
ADMIN_SYMBOL:                       A D M I N;                                          // SQL-1999-R
INVISIBLE_SYMBOL:                   I N V I S I B L E;
VISIBLE_SYMBOL:                     V I S I B L E;
EXCEPT_SYMBOL:                      E X C E P T;                                        // SQL-1999-R
COMPONENT_SYMBOL:                   C O M P O N E N T;                                  // MYSQL
RECURSIVE_SYMBOL:                   R E C U R S I V E;                                  // SQL-1999-R
JSON_OBJECTAGG_SYMBOL:              J S O N '_' O B J E C T A G G;                      // SQL-2015-R
JSON_ARRAYAGG_SYMBOL:               J S O N '_' A R R A Y A G G;                        // SQL-2015-R
OF_SYMBOL:                          O F;                                                // SQL-1999-R
SKIP_SYMBOL:                        S K I P;                                            // MYSQL
LOCKED_SYMBOL:                      L O C K E D;                                        // MYSQL
NOWAIT_SYMBOL:                      N O W A I T;                                        // MYSQL
GROUPING_SYMBOL:                    G R O U P I N G;                                    // SQL-2011-R
PERSIST_ONLY_SYMBOL:                P E R S I S T '_' O N L Y;                          // MYSQL
HISTOGRAM_SYMBOL:                   H I S T O G R A M;                                  // MYSQL
BUCKETS_SYMBOL:                     B U C K E T S;                                      // MYSQL
REMOTE_SYMBOL:                      R E M O T E                                         {this.serverVersion < 80014}?; // MYSQL
CLONE_SYMBOL:                       C L O N E;                                          // MYSQL
CUME_DIST_SYMBOL:                   C U M E '_' D I S T;                                // SQL-2003-R
DENSE_RANK_SYMBOL:                  D E N S E '_' R A N K;                              // SQL-2003-R
EXCLUDE_SYMBOL:                     E X C L U D E;                                      // SQL-2003-N
FIRST_VALUE_SYMBOL:                 F I R S T '_' V A L U E;                            // SQL-2011-R
FOLLOWING_SYMBOL:                   F O L L O W I N G;                                  // SQL-2003-N
GROUPS_SYMBOL:                      G R O U P S;                                        // SQL-2011-R
LAG_SYMBOL:                         L A G;                                              // SQL-2011-R
LAST_VALUE_SYMBOL:                  L A S T '_' V A L U E;                              // SQL-2011-R
LEAD_SYMBOL:                        L E A D;                                            // SQL-2011-R
NTH_VALUE_SYMBOL:                   N T H '_' V A L U E;                                // SQL-2011-R
NTILE_SYMBOL:                       N T I L E;                                          // SQL-2011-R
NULLS_SYMBOL:                       N U L L S;                                          // SQL-2003-N
OTHERS_SYMBOL:                      O T H E R S;                                        // SQL-2003-N
OVER_SYMBOL:                        O V E R;                                            // SQL-2003-R
PERCENT_RANK_SYMBOL:                P E R C E N T '_' R A N K;                          // SQL-2003-R
PRECEDING_SYMBOL:                   P R E C E D I N G;                                  // SQL-2003-N
RANK_SYMBOL:                        R A N K;                                            // SQL-2003-R
RESPECT_SYMBOL:                     R E S P E C T;                                      // SQL_2011-N
ROW_NUMBER_SYMBOL:                  R O W '_' N U M B E R;                              // SQL-2003-R
TIES_SYMBOL:                        T I E S;                                            // SQL-2003-N
UNBOUNDED_SYMBOL:                   U N B O U N D E D;                                  // SQL-2003-N
WINDOW_SYMBOL:                      W I N D O W;                                        // SQL-2003-R
EMPTY_SYMBOL:                       E M P T Y;                                          // SQL-2016-R
JSON_TABLE_SYMBOL:                  J S O N '_' T A B L E;                              // SQL-2016-R
NESTED_SYMBOL:                      N E S T E D;                                        // SQL-2016-N
ORDINALITY_SYMBOL:                  O R D I N A L I T Y;                                // SQL-2003-N
PATH_SYMBOL:                        P A T H;                                            // SQL-2003-N
HISTORY_SYMBOL:                     H I S T O R Y;                                      // MYSQL
REUSE_SYMBOL:                       R E U S E;                                          // MYSQL
SRID_SYMBOL:                        S R I D;                                            // MYSQL
THREAD_PRIORITY_SYMBOL:             T H R E A D '_' P R I O R I T Y;                    // MYSQL
RESOURCE_SYMBOL:                    R E S O U R C E;                                    // MYSQL
SYSTEM_SYMBOL:                      S Y S T E M;                                        // SQL-2003-R
VCPU_SYMBOL:                        V C P U;                                            // MYSQL
MASTER_PUBLIC_KEY_PATH_SYMBOL:      M A S T E R '_' P U B L I C '_' K E Y '_' P A T H;  // MYSQL
GET_MASTER_PUBLIC_KEY_SYMBOL:
    G E T '_' M A S T E R '_' P U B L I C '_' K E Y '_' S Y M                           {this.serverVersion < 80024}?; // MYSQL
RESTART_SYMBOL:                     R E S T A R T                                       {this.serverVersion >= 80011}?; // SQL-2003-N
DEFINITION_SYMBOL:                  D E F I N I T I O N                                 {this.serverVersion >= 80011}?; // MYSQL
DESCRIPTION_SYMBOL:                 D E S C R I P T I O N                               {this.serverVersion >= 80011}?; // MYSQL
ORGANIZATION_SYMBOL:                O R G A N I Z A T I O N                             {this.serverVersion >= 80011}?; // MYSQL
REFERENCE_SYMBOL:                   R E F E R E N C E                                   {this.serverVersion >= 80011}?; // MYSQL

OPTIONAL_SYMBOL:                    O P T I O N A L                                     {this.serverVersion >= 80013}?; // MYSQL
SECONDARY_SYMBOL:                   S E C O N D A R Y                                   {this.serverVersion >= 80016}?; // MYSQL
SECONDARY_ENGINE_SYMBOL:            S E C O N D A R Y '_' E N G I N E                   {this.serverVersion >= 80013}?; // MYSQL
SECONDARY_LOAD_SYMBOL:              S E C O N D A R Y '_' L O A D                       {this.serverVersion >= 80013}?; // MYSQL
SECONDARY_UNLOAD_SYMBOL:            S E C O N D A R Y '_' U N L O A D                   {this.serverVersion >= 80013}?; // MYSQL

ACTIVE_SYMBOL:                      A C T I V E                                         {this.serverVersion >= 80014}?; // MYSQL
INACTIVE_SYMBOL:                    I N A C T I V E                                     {this.serverVersion >= 80014}?; // MYSQL
LATERAL_SYMBOL:                     L A T E R A L                                       {this.serverVersion >= 80014}?; // SQL-2003-R
RETAIN_SYMBOL:                      R E T A I N                                         {this.serverVersion >= 80014}?; // MYSQL
OLD_SYMBOL:                         O L D                                               {this.serverVersion >= 80014}?; // SQL-2003-R

NETWORK_NAMESPACE_SYMBOL:
    N E T W O R K '_' N A M E S P A C E                                                 {this.serverVersion >= 80017}?; // MYSQL
ENFORCED_SYMBOL:                    E N F O R C E D                                     {this.serverVersion >= 80017}?; // SQL-2003-N
ARRAY_SYMBOL:                       A R R A Y                                           {this.serverVersion >= 80017}?; // SQL-2003-R
OJ_SYMBOL:                          O J                                                 {this.serverVersion >= 80017}?; // ODBC
MEMBER_SYMBOL:                      M E M B E R                                         {this.serverVersion >= 80017}?; // SQL-2003-R

RANDOM_SYMBOL:                      R A N D O M                                         {this.serverVersion >= 80018}?; // MYSQL
MASTER_COMPRESSION_ALGORITHM_SYMBOL:
    M A S T E R '_' C O M P R E S S I O N '_' A L G O R I T H M                         {this.serverVersion >= 80018 && this.serverVersion < 80024}?; // MYSQL
MASTER_ZSTD_COMPRESSION_LEVEL_SYMBOL:
    M A S T E R '_' Z S T D '_' C O M P R E S S I O N '_' L E V E L                     {this.serverVersion >= 80018}?; // MYSQL
PRIVILEGE_CHECKS_USER_SYMBOL:
    P R I V I L E G E '_' C H E C K S '_' U S E R                                       {this.serverVersion >= 80018}?; // MYSQL
MASTER_TLS_CIPHERSUITES_SYMBOL:
    M A S T E R '_' T L S '_' C I P H E R S U I T E S                                   {this.serverVersion >= 80018}?; // MYSQL

REQUIRE_ROW_FORMAT_SYMBOL:
    R E Q U I R E '_' R O W '_' F O R M A T                                             {this.serverVersion >= 80019}?; // MYSQL
PASSWORD_LOCK_TIME_SYMBOL:
    P A S S W O R D '_' L O C K '_' T I M E                                             {this.serverVersion >= 80019}?; // MYSQL
FAILED_LOGIN_ATTEMPTS_SYMBOL:
    F A I L E D '_' L O G I N '_' A T T E M P T S                                       {this.serverVersion >= 80019}?; // MYSQL
REQUIRE_TABLE_PRIMARY_KEY_CHECK_SYMBOL:
    R E Q U I R E '_' T A B L E '_' P R I M A R Y '_' K E Y '_' C H E C K               {this.serverVersion >= 80019}?; // MYSQL
STREAM_SYMBOL:                      S T R E A M                                         {this.serverVersion >= 80020}?; // MYSQL
OFF_SYMBOL:                         O F F                                               {this.serverVersion >= 80019}?; // SQL-1999-R

RETURNING_SYMBOL:                   R E T U R N I N G                                   {this.serverVersion >= 80021}?; // SQL-2016-N
JSON_VALUE_SYMBOL:                  J S O N '_' V A L U E                               {this.serverVersion >= 80024}?; // SQL-2016-R
TLS_SYMBOL:                         T L S                                               {this.serverVersion >= 80021}?; // MYSQL
ATTRIBUTE_SYMBOL:                   A T T R I B U T E                                   {this.serverVersion >= 80024}?; // SQL-2003-N
ENGINE_ATTRIBUTE_SYMBOL:            E N G I N E '_' A T T R I B U T E                   {this.serverVersion >= 80024}?; // MYSQL
SECONDARY_ENGINE_ATTRIBUTE_SYMBOL:
    S E C O N D A R Y '_' E N G I N E '_' A T T R I B U T E                             {this.serverVersion >= 80024}?; // MYSQL
SOURCE_CONNECTION_AUTO_FAILOVER_SYMBOL:
    S O U R C E '_' C O N N E C T I O N '_' A U T O '_' F A I L O V E R                 {this.serverVersion >= 80024}?; // MYSQL
ZONE_SYMBOL:                        Z O N E                                             {this.serverVersion >= 80022}?; // SQL-2003-N
GRAMMAR_SELECTOR_DERIVED_EXPR:
    G R A M M A R '_' S E L E C T O R '_' D E R I V E D                                 {this.serverVersion >= 80024}?; // synthetic token: starts derived table expressions.
REPLICA_SYMBOL:                     R E P L I C A                                       {this.serverVersion >= 80022}?;
REPLICAS_SYMBOL:                    R E P L I C A S                                     {this.serverVersion >= 80022}?;
ASSIGN_GTIDS_TO_ANONYMOUS_TRANSACTIONS_SYMBOL:
    A S S I G N '_' G T I D S '_' T O '_' A N O N Y M O U S '_' T R A N S A C T I O N S {this.serverVersion >= 80024}?; // MYSQL
GET_SOURCE_PUBLIC_KEY_SYMBOL:
    G E T '_' S O U R C E '_' P U B L I C '_' K E Y                                     {this.serverVersion >= 80024}?; // MYSQL
SOURCE_AUTO_POSITION_SYMBOL:
    S O U R C E '_' A U T O '_' P O S I T I O N                                         {this.serverVersion >= 80023}?; // MYSQL
SOURCE_BIND_SYMBOL:                 S O U R C E '_' B I N D                             {this.serverVersion >= 80023}?; // MYSQL
SOURCE_COMPRESSION_ALGORITHM_SYMBOL:
    S O U R C E '_' C O M P R E S S I O N '_' A L G O R I T H M                         {this.serverVersion >= 80023}?; // MYSQL
SOURCE_CONNECT_RETRY_SYMBOL:
    S O U R C E '_' C O N N E C T '_' R E T R Y                                         {this.serverVersion >= 80023}?; // MYSQL
SOURCE_DELAY_SYMBOL:                S O U R C E '_' D E L A Y                           {this.serverVersion >= 80023}?; // MYSQL
SOURCE_HEARTBEAT_PERIOD_SYMBOL:
    S O U R C E '_' H E A R T B E A T '_' P E R I O D                                   {this.serverVersion >= 80023}?; // MYSQL
SOURCE_HOST_SYMBOL:                 S O U R C E '_' H O S T                             {this.serverVersion >= 80023}?; // MYSQL
SOURCE_LOG_FILE_SYMBOL:             S O U R C E '_' L O G '_' F I L E                   {this.serverVersion >= 80023}?; // MYSQL
SOURCE_LOG_POS_SYMBOL:              S O U R C E '_' L O G '_' P O S                     {this.serverVersion >= 80023}?; // MYSQL
SOURCE_PASSWORD_SYMBOL:             S O U R C E '_' P A S S W O R D                     {this.serverVersion >= 80023}?; // MYSQL
SOURCE_PORT_SYMBOL:                 S O U R C E '_' P O R T                             {this.serverVersion >= 80023}?; // MYSQL
SOURCE_PUBLIC_KEY_PATH_SYMBOL:
    S O U R C E '_' P U B L I C '_' K E Y '_' P A T H                                   {this.serverVersion >= 80023}?; // MYSQL
SOURCE_RETRY_COUNT_SYMBOL:
    S O U R C E '_' R E T R Y '_' C O U N T                                             {this.serverVersion >= 80023}?; // MYSQL
SOURCE_SSL_SYMBOL:                  S O U R C E '_' S S L                               {this.serverVersion >= 80023}?; // MYSQL
SOURCE_SSL_CA_SYMBOL:               S O U R C E '_' S S L '_' C A                       {this.serverVersion >= 80023}?; // MYSQL
SOURCE_SSL_CAPATH_SYMBOL:
    S O U R C E '_' S S L '_' C A P A T H                                               {this.serverVersion >= 80023}?; // MYSQL
SOURCE_SSL_CERT_SYMBOL:             S O U R C E '_' S S L '_' C E R T                   {this.serverVersion >= 80023}?; // MYSQL
SOURCE_SSL_CIPHER_SYMBOL:
    S O U R C E '_' S S L '_' C I P H E R                                               {this.serverVersion >= 80023}?; // MYSQL
SOURCE_SSL_CRL_SYMBOL:              S O U R C E '_' S S L '_' C R L                     {this.serverVersion >= 80023}?; // MYSQL
SOURCE_SSL_CRLPATH_SYMBOL:
    S O U R C E '_' S S L '_' C R L P A T H                                             {this.serverVersion >= 80023}?; // MYSQL
SOURCE_SSL_KEY_SYMBOL:
    S O U R C E '_' S S L '_' C R L P A T H                                             {this.serverVersion >= 80023}?; // MYSQL
SOURCE_SSL_VERIFY_SERVER_CERT_SYMBOL:
    S O U R C E '_' S S L '_' V E R I F Y '_' S E R V E R '_' C E R T                   {this.serverVersion >= 80023}?; // MYSQL
SOURCE_TLS_CIPHERSUITES_SYMBOL:
    S O U R C E '_' T L S '_' C I P H E R S U I T E S                                   {this.serverVersion >= 80023}?; // MYSQL
SOURCE_TLS_VERSION_SYMBOL:
    S O U R C E '_' T L S '_' V E R S I O N                                             {this.serverVersion >= 80023}?; // MYSQL
SOURCE_USER_SYMBOL:                 S O U R C E '_' U S E R                             {this.serverVersion >= 80023}?; // MYSQL
SOURCE_ZSTD_COMPRESSION_LEVEL_SYMBOL:
    S O U R C E '_' Z S T D '_' C O M P R E S S I O N '_' L E V E L                     {this.serverVersion >= 80023}?; // MYSQL

ST_COLLECT_SYMBOL:                  S T '_' C O L L E C T                               {this.serverVersion >= 80025}?; // MYSQL
KEYRING_SYMBOL:                     K E Y R I N G                                       {this.serverVersion >= 80025}?; // MYSQL

AUTHENTICATION_SYMBOL:              A U T H E N T I C A T I O N                         {this.serverVersion >= 80027}?; // MYSQL
FACTOR_SYMBOL:                      F A C T O R                                         {this.serverVersion >= 80027}?; // MYSQL
FINISH_SYMBOL:                      F I N I S H                                         {this.serverVersion >= 80027}?; // SQL-2016-N
INITIATE_SYMBOL:                    I N I T I A T E                                     {this.serverVersion >= 80027}?; // MYSQL
REGISTRATION_SYMBOL:                R E G I S T R A T I O N                             {this.serverVersion >= 80027}?; // MYSQL
UNREGISTER_SYMBOL:                  U N R E G I S T E R                                 {this.serverVersion >= 80027}?; // MYSQL
INITIAL_SYMBOL:                     I N I T I A L                                       {this.serverVersion >= 80027}?; // SQL-2016-R
CHALLENGE_RESPONSE_SYMBOL:
    C H A L L E N G E '_' R E S P O N S E                                               {this.serverVersion >= 80027}?; // MYSQL
GTID_ONLY_SYMBOL:                   G T I D '_' O N L Y                                 {this.serverVersion >= 80027}?; // MYSQL

INTERSECT_SYMBOL:                   I N T E R S E C T '_' S Y M B O L                   {this.serverVersion >= 80031}?; // SQL-1992-R

BULK_SYMBOL:                        B U L K                                             {this.serverVersion >= 80032}?; // MYSQL
URL_SYMBOL:                         U R L                                               {this.serverVersion >= 80032}?; // MYSQL
GENERATE_SYMBOL:                    G E N E R A T E                                     {this.serverVersion >= 80032}?; // MYSQL
PARSE_TREE_SYMBOL:                  P A R S E '_' T R E E                               {this.serverVersion >= 80100}?; // MYSQL
LOG_SYMBOL:                         L O G                                               {this.serverVersion >= 80032}?; // MYSQL
GTIDS_SYMBOL:                       G T I D S                                           {this.serverVersion >= 80032}?; // MYSQL

PARALLEL_SYMBOL:                    P A R A L L E L                                     {this.serverVersion >= 80200}?; // MYSQL
S3_SYMBOL:                          S '3'                                               {this.serverVersion >= 80200}?; // MYSQL
QUALIFY_SYMBOL:                     Q U A L I F Y                                       {this.serverVersion >= 80200}?; // MYSQL
AUTO_SYMBOL:                        A U T O                                             {this.serverVersion >= 80200}?; // MYSQL
MANUAL_SYMBOL:                      M A N U A L                                         {this.serverVersion >= 80200}?; // MYSQL
BERNOULLI_SYMBOL:                   B E R N O U L L I                                   {this.serverVersion >= 80200}?; // MYSQL
TABLESAMPLE_SYMBOL:                 T A B L E S A M P L E                               {this.serverVersion >= 80200}?; // MYSQL

VECTOR_SYMBOL:                      V E C T O R                                         {this.serverVersion >= 80300}?; // MYSQL

PARAMETERS_SYMBOL:                  P A R A M E T E R S                                 {this.serverVersion >= 90100}?; // MYSQL
HEADER_SYMBOL:                      H E A D E R                                         {this.serverVersion >= 90100}?; // MYSQL

LIBRARY_SYMBOL:                     L I B R A R Y                                       {this.serverVersion >= 90200}?; // MYSQL

// $antlr-format groupedAlignments on, alignTrailers off, alignLexerCommands on

// Additional tokens which are mapped to existing tokens.
INT1_SYMBOL: I N T '1' -> type(TINYINT_SYMBOL);   // Synonym
INT2_SYMBOL: I N T '2' -> type(SMALLINT_SYMBOL);  // Synonym
INT3_SYMBOL: I N T '3' -> type(MEDIUMINT_SYMBOL); // Synonym
INT4_SYMBOL: I N T '4' -> type(INT_SYMBOL);       // Synonym
INT8_SYMBOL: I N T '8' -> type(BIGINT_SYMBOL);    // Synonym

SQL_TSI_SECOND_SYMBOL:  S Q L '_' T S I '_' S E C O N D   -> type(SECOND_SYMBOL);  // Synonym
SQL_TSI_MINUTE_SYMBOL:  S Q L '_' T S I '_' M I N U T E   -> type(MINUTE_SYMBOL);  // Synonym
SQL_TSI_HOUR_SYMBOL:    S Q L '_' T S I '_' H O U R       -> type(HOUR_SYMBOL);    // Synonym
SQL_TSI_DAY_SYMBOL:     S Q L '_' T S I '_' D A Y         -> type(DAY_SYMBOL);     // Synonym
SQL_TSI_WEEK_SYMBOL:    S Q L '_' T S I '_' W E E K       -> type(WEEK_SYMBOL);    // Synonym
SQL_TSI_MONTH_SYMBOL:   S Q L '_' T S I '_' M O N T H     -> type(MONTH_SYMBOL);   // Synonym
SQL_TSI_QUARTER_SYMBOL: S Q L '_' T S I '_' Q U A R T E R -> type(QUARTER_SYMBOL); // Synonym
SQL_TSI_YEAR_SYMBOL:    S Q L '_' T S I '_' Y E A R       -> type(YEAR_SYMBOL);    // Synonym



CONFIGURE_SYMBOL:   C O N F I G U R E;
REST_SYMBOL:        R E S T;
METADATA_SYMBOL:    M E T A D A T A;
SERVICES_SYMBOL:    S E R V I C E S;
SERVICE_SYMBOL:     S E R V I C E;
VIEWS_SYMBOL:       V I E W S;
PROCEDURES_SYMBOL:  P R O C E D U R E S;
FUNCTIONS_SYMBOL:   F U N C T I O N S;
RESULT_SYMBOL:      R E S U L T;
ENABLED_SYMBOL:     E N A B L E D;
PUBLISHED_SYMBOL:   P U B L I S H E D;
DISABLED_SYMBOL:    D I S A B L E D;
PRIVATE_SYMBOL:     P R I V A T E;
UNPUBLISHED_SYMBOL: U N P U B L I S H E D;
PROTOCOL_SYMBOL:    P R O T O C O L;
HTTP_SYMBOL:        H T T P;
HTTPS_SYMBOL:       H T T P S;
REQUEST_SYMBOL:     R E Q U E S T;
REDIRECTION_SYMBOL: R E D I R E C T I O N;
MANAGEMENT_SYMBOL:  M A N A G E M E N T;
AVAILABLE_SYMBOL:   A V A I L A B L E;
REQUIRED_SYMBOL:    R E Q U I R E D;
ITEMS_SYMBOL:       I T E M S;
PER_SYMBOL:         P E R;
CONTENT_SYMBOL:     C O N T E N T;
MEDIA_SYMBOL:       M E D I A;
AUTODETECT_SYMBOL:  A U T O D E T E C T;
FEED_SYMBOL:        F E E D;
ITEM_SYMBOL:        I T E M;
SETS_SYMBOL:        S E T S;
FILES_SYMBOL:       F I L E S;
AUTH_SYMBOL:        A U T H;
APPS_SYMBOL:        A P P S;
APP_SYMBOL:         A P P;
ID_SYMBOL:          I D;
SECRET_SYMBOL:      S E C R E T;
VENDOR_SYMBOL:      V E N D O R;
MRS_SYMBOL:         M R S;
MYSQL_SYMBOL:       M Y S Q L;
USERS_SYMBOL:       U S E R S;
ALLOW_SYMBOL:       A L L O W;
REGISTER_SYMBOL:    R E G I S T E R;
CLASS_SYMBOL:       C L A S S;
DEVELOPMENT_SYMBOL: D E V E L O P M E N T;
SCRIPTS_SYMBOL:     S C R I P T S;
MAPPING_SYMBOL:     M A P P I N G;
TYPESCRIPT_SYMBOL:  T Y P E S C R I P T;
ROLES_SYMBOL:       R O L E S;
EXTENDS_SYMBOL:     E X T E N D S;
OBJECT_SYMBOL:      O B J E C T;
HIERARCHY_SYMBOL:   H I E R A R C H Y;
INCLUDE_SYMBOL:     I N C L U D E;
INCLUDING_SYMBOL:   I N C L U D I N G;
ENDPOINTS_SYMBOL:   E N D P O I N T S;
OBJECTS_SYMBOL:     O B J E C T S;
DUMP_SYMBOL:        D U M P;
ZIP_SYMBOL:         Z I P;
SCRIPT_SYMBOL:      S C R I P T;
STATIC_SYMBOL:      S T A T I C;
PROJECT_SYMBOL:     P R O J E C T;
VERSION_SYMBOL:     V E R S I O N;
ICON_SYMBOL:        I C O N;
PUBLISHER_SYMBOL:   P U B L I S H E R;

//----------------- GraphQL --------------------------------------------------------------------------------------------

AT_INOUT_SYMBOL:        AT_SIGN_SYMBOL I N O U T;
AT_IN_SYMBOL:           AT_SIGN_SYMBOL I N;
AT_OUT_SYMBOL:          AT_SIGN_SYMBOL O U T;
AT_CHECK_SYMBOL:        AT_SIGN_SYMBOL C H E C K;
AT_NOCHECK_SYMBOL:      AT_SIGN_SYMBOL N O C H E C K;
AT_NOUPDATE_SYMBOL:     AT_SIGN_SYMBOL N O U P D A T E;
AT_SORTABLE_SYMBOL:     AT_SIGN_SYMBOL S O R T A B L E;
AT_NOFILTERING_SYMBOL:  AT_SIGN_SYMBOL N O F I L T E R I N G;
AT_ROWOWNERSHIP_SYMBOL: AT_SIGN_SYMBOL R O W O W N E R S H I P;
AT_UNNEST_SYMBOL:       AT_SIGN_SYMBOL U N N E S T;
AT_DATATYPE_SYMBOL:     AT_SIGN_SYMBOL D A T A T Y P E;
AT_SELECT_SYMBOL:       AT_SIGN_SYMBOL S E L E C T;
AT_NOSELECT_SYMBOL:     AT_SIGN_SYMBOL N O S E L E C T;
AT_INSERT_SYMBOL:       AT_SIGN_SYMBOL I N S E R T;
AT_NOINSERT_SYMBOL:     AT_SIGN_SYMBOL N O I N S E R T;
AT_UPDATE_SYMBOL:       AT_SIGN_SYMBOL U P D A T E;
AT_DELETE_SYMBOL:       AT_SIGN_SYMBOL D E L E T E;
AT_NODELETE_SYMBOL:     AT_SIGN_SYMBOL N O D E L E T E;
AT_KEY_SYMBOL:          AT_SIGN_SYMBOL K E Y;

REST_REQUEST_PATH:
    (DIV_OPERATOR IDENTIFIER)+;

AT_TEXT_SUFFIX: '@' SIMPLE_IDENTIFIER;

// White space handling
WHITESPACE: [ \t\f\r\n]+ -> channel(HIDDEN); // Ignore whitespaces.

// Input not covered elsewhere (unless quoted).
INVALID_INPUT:
    [\u0001-\u0008]   // Control codes.
    | '\u000B'        // Line tabulation.
    | '\u000C'        // Form feed.
    | [\u000E-\u001F] // More control codes.
    
    ;

// String and text types.

// The underscore charset token is used to defined the repertoire of a string, though it conflicts
// with normal identifiers, which also can start with an underscore.
UNDERSCORE_CHARSET: UNDERLINE_SYMBOL [a-z0-9]+ { this.type = this.checkCharset(this.text); };

// TODO: check in the semantic phase that starting and ending tags are the same.
DOLLAR_QUOTED_STRING_TEXT:
    '$' DOLLAR_QUOTE_TAG_CHAR* '$' .*? '$' DOLLAR_QUOTE_TAG_CHAR* '$' {this.serverVersion >= 80034 && this.supportMle}?;

// Identifiers might start with a digit, even though it is discouraged, and may not consist entirely of digits only.
// All keywords above are automatically excluded.
IDENTIFIER:
    DIGITS+ [eE] (LETTER_WHEN_UNQUOTED_NO_DIGIT LETTER_WHEN_UNQUOTED*)? // Have to exclude float pattern, as this rule matches more.
    | DIGITS+ LETTER_WITHOUT_FLOAT_PART LETTER_WHEN_UNQUOTED*
    | LETTER_WHEN_UNQUOTED_NO_DIGIT LETTER_WHEN_UNQUOTED*; // INT_NUMBER matches first if there are only digits.

NCHAR_TEXT: [nN] SINGLE_QUOTED_TEXT;

// MySQL supports automatic concatenation of multiple single and double quoted strings if they follow each other as separate
// tokens. This is reflected in the `textLiteral` parser rule.
// Here we handle duplication of quotation chars only (which must be replaced by a single char in the target code).

fragment BACK_TICK:    '`';
fragment SINGLE_QUOTE: '\'';
fragment DOUBLE_QUOTE: '"';

BACK_TICK_QUOTED_ID:
    BACK_TICK (({!this.isSqlModeActive(SqlMode.NoBackslashEscapes)}? '\\')? .)*? BACK_TICK;

DOUBLE_QUOTED_TEXT: (
        DOUBLE_QUOTE (({!this.isSqlModeActive(SqlMode.NoBackslashEscapes)}? '\\')? .)*? DOUBLE_QUOTE
    )+;

SINGLE_QUOTED_TEXT: (
        SINGLE_QUOTE (({!this.isSqlModeActive(SqlMode.NoBackslashEscapes)}? '\\')? .)*? SINGLE_QUOTE
    )+;

// There are 3 types of block comments:
// /* ... */ - The standard multi line comment.
// /*! ... */ - A comment used to mask code for other clients. In MySQL the content is handled as normal code.
// /*!12345 ... */ - Same as the previous one except code is only used when the given number is lower than or equal to
//                   the current server version (specifying so the minimum server version the code can run with).
VERSION_COMMENT_START: ('/*!' DIGITS) (
        {this.checkMySQLVersion(this.text)}? // Will set this.inVersionComment if the number matches.
        | .*? '*/'
    ) -> channel(HIDDEN);

// this.inVersionComment is a variable in the base lexer.
// TODO: use a lexer mode instead of a member variable.
MYSQL_COMMENT_START: '/*!' { this.inVersionComment = true; } -> channel(HIDDEN);
VERSION_COMMENT_END:
    '*/' {this.inVersionComment}? { this.inVersionComment = false; } -> channel(HIDDEN);
BLOCK_COMMENT: ( '/**/' | '/*' ~[!] .*? '*/')                        -> channel(HIDDEN);

INVALID_BLOCK_COMMENT: '/*' ~[*/]* EOF -> channel(HIDDEN); // Not 100% perfect but good enough.

POUND_COMMENT:    '#' ~([\n\r])*                                   -> channel(HIDDEN);
DASHDASH_COMMENT: DOUBLE_DASH ([ \t] (~[\n\r])* | LINEBREAK | EOF) -> channel(HIDDEN);

fragment DOUBLE_DASH: '--';
fragment LINEBREAK:   [\n\r];

fragment SIMPLE_IDENTIFIER: (DIGIT | [a-zA-Z_$] | DOT_SYMBOL)+;

fragment ML_COMMENT_HEAD: '/*';
fragment ML_COMMENT_END:  '*/';

// As defined in https://dev.mysql.com/doc/refman/8.0/en/identifiers.html.
fragment LETTER_WHEN_UNQUOTED: DIGIT | LETTER_WHEN_UNQUOTED_NO_DIGIT;

fragment LETTER_WHEN_UNQUOTED_NO_DIGIT: [a-zA-Z_$\u0080-\uffff];
fragment DOLLAR_QUOTE_TAG_CHAR:         [0-9a-zA-Z_\u0080-\uffff];

// Any letter but without e/E and digits (which are used to match a decimal number).
fragment LETTER_WITHOUT_FLOAT_PART: [a-df-zA-DF-Z_$\u0080-\uffff];
