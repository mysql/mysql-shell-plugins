/*
 * Copyright (c) 2023, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify it under the terms of the
 * GNU General Public License, version 2.0, as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including but not limited to OpenSSL)
 * that is licensed under separate terms, as designated in a particular file or component or in
 * included license documentation. The authors of MySQL hereby grant you an additional permission to
 * link the program and your derivative works with the separately licensed software that they have
 * included with MySQL. This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
 * PURPOSE. See the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License along with this program; if
 * not, write to the Free Software Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA
 * 02110-1301 USA
 */

lexer grammar MRSLexer; // MySQL REST Service (MRS) Grammar Definition

CONFIGURE_SYMBOL:      C O N F I G U R E;
CREATE_SYMBOL:         C R E A T E;
OR_SYMBOL:             O R;
REPLACE_SYMBOL:        R E P L A C E;
ALTER_SYMBOL:          A L T E R;
SHOW_SYMBOL:           S H O W;
REST_SYMBOL:           R E S T;
METADATA_SYMBOL:       M E T A D A T A;
STATUS_SYMBOL:         S T A T U S;
SERVICES_SYMBOL:       S E R V I C E S;
SERVICE_SYMBOL:        S E R V I C E;
NEW_SYMBOL:            N E W;
ON_SYMBOL:             O N;
FROM_SYMBOL:           F R O M;
IN_SYMBOL:             I N;
SCHEMAS_SYMBOL:        S C H E M A S;
SCHEMA_SYMBOL:         S C H E M A;
JSON_SYMBOL:           J S O N;
RELATIONAL_SYMBOL:     R E L A T I O N A L;
DUALITY_SYMBOL:        D U A L I T Y;
VIEWS_SYMBOL:          V I E W S;
VIEW_SYMBOL:           V I E W;
PROCEDURES_SYMBOL:     P R O C E D U R E S;
PROCEDURE_SYMBOL:      P R O C E D U R E;
PARAMETERS_SYMBOL:     P A R A M E T E R S;
RESULT_SYMBOL:         R E S U L T;
DROP_SYMBOL:           D R O P;
USE_SYMBOL:            U S E;
AS_SYMBOL:             A S;
ENABLED_SYMBOL:        E N A B L E D;
DISABLED_SYMBOL:       D I S A B L E D;
PROTOCOL_SYMBOL:       P R O T O C O L;
HTTP_SYMBOL:           H T T P;
HTTPS_SYMBOL:          H T T P S;
FILTER_SYMBOL:         F I L T E R;
COMMENTS_SYMBOL:       C O M M E N T S;
AUTHENTICATION_SYMBOL: A U T H E N T I C A T I O N;
REQUEST_SYMBOL:        R E Q U E S T;
PATH_SYMBOL:           P A T H;
REDIRECTION_SYMBOL:    R E D I R E C T I O N;
VALIDATION_SYMBOL:     V A L I D A T I O N;
DEFAULT_SYMBOL:        D E F A U L T;
USER_SYMBOL:           U S E R;
MANAGEMENT_SYMBOL:     M A N A G E M E N T;
OPTIONS_SYMBOL:        O P T I O N S;
IF_SYMBOL:             I F;
AVAILABLE_SYMBOL:      A V A I L A B L E;
NOT_SYMBOL:            N O T;
EXISTS_SYMBOL:         E X I S T S;
REQUIRED_SYMBOL:       R E Q U I R E D;
ITEMS_SYMBOL:          I T E M S;
PER_SYMBOL:            P E R;
PAGE_SYMBOL:           P A G E;
CONTENT_SYMBOL:        C O N T E N T;
HOST_SYMBOL:           H O S T;
MEDIA_SYMBOL:          M E D I A;
TYPE_SYMBOL:           T Y P E;
AUTODETECT_SYMBOL:     A U T O D E T E C T;
FORMAT_SYMBOL:         F O R M A T;
FEED_SYMBOL:           F E E D;
ITEM_SYMBOL:           I T E M;
UPDATE_SYMBOL:         U P D A T E;
NULL_SYMBOL:           N U L L;
TRUE_SYMBOL:           T R U E;
FALSE_SYMBOL:          F A L S E;
SET_SYMBOL:            S E T;
SETS_SYMBOL:           S E T S;

//----------------- GraphGL --------------------------------------------------------------------------------------------

AT_INOUT_SYMBOL:        AT_SIGN_SYMBOL I N O U T;
AT_IN_SYMBOL:           AT_SIGN_SYMBOL I N;
AT_OUT_SYMBOL:          AT_SIGN_SYMBOL O U T;
AT_NOCHECK_SYMBOL:      AT_SIGN_SYMBOL N O C H E C K;
AT_NOUPDATE_SYMBOL:     AT_SIGN_SYMBOL N O U P D A T E;
AT_SORTABLE_SYMBOL:     AT_SIGN_SYMBOL S O R T A B L E;
AT_NOFILTERING_SYMBOL:  AT_SIGN_SYMBOL N O F I L T E R I N G;
AT_ROWOWNERSHIP_SYMBOL: AT_SIGN_SYMBOL R O W O W N E R S H I P;
AT_UNNEST_SYMBOL:       AT_SIGN_SYMBOL U N N E S T;
AT_REDUCETO_SYMBOL:     AT_SIGN_SYMBOL R E D U C E T O;
AT_DATATYPE_SYMBOL:     AT_SIGN_SYMBOL D A T A T Y P E;
AT_SELECT_SYMBOL:       AT_SIGN_SYMBOL S E L E C T;
AT_NOSELECT_SYMBOL:     AT_SIGN_SYMBOL N O S E L E C T;
AT_INSERT_SYMBOL:       AT_SIGN_SYMBOL I N S E R T;
AT_NOINSERT_SYMBOL:     AT_SIGN_SYMBOL N O I N S E R T;
AT_UPDATE_SYMBOL:       AT_SIGN_SYMBOL U P D A T E;
AT_DELETE_SYMBOL:       AT_SIGN_SYMBOL D E L E T E;
AT_NODELETE_SYMBOL:     AT_SIGN_SYMBOL N O D E L E T E;

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

LOGICAL_OR_OPERATOR: '||';
BITWISE_OR_OPERATOR: '|';

DOT_SYMBOL:          '.';
COMMA_SYMBOL:        ',';
SEMICOLON_SYMBOL:    ';';
COLON_SYMBOL:        ':';
OPEN_PAR_SYMBOL:     '(';
CLOSE_PAR_SYMBOL:    ')';
OPEN_CURLY_SYMBOL:   '{';
CLOSE_CURLY_SYMBOL:  '}';
UNDERLINE_SYMBOL:    '_';
OPEN_SQUARE_SYMBOL:  '[';
CLOSE_SQUARE_SYMBOL: ']';

JSON_SEPARATOR_SYMBOL:          '->';
JSON_UNQUOTED_SEPARATOR_SYMBOL: '->>';

// The MySQL server parser uses custom code in its lexer to allow base alphanum chars (and ._$) as
// variable name. For this it handles user variables in 2 different ways and we have to model this
// to match that behavior.
AT_SIGN_SYMBOL: '@';
AT_TEXT_SUFFIX: '@' SIMPLE_IDENTIFIER;

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

INT_NUMBER: DIGITS;

// Float types must be handled first or the DOT_IDENTIIFER rule will make them to identifiers (if
// there is no leading digit before the dot).
DECIMAL_NUMBER: DIGITS? DOT_SYMBOL DIGITS;
FLOAT_NUMBER:   (DIGITS? DOT_SYMBOL)? DIGITS [eE] ( MINUS_OPERATOR | PLUS_OPERATOR)? DIGITS;

// White space handling
WHITESPACE: [ \t\f\r\n] -> channel(HIDDEN); // Ignore whitespaces.

// Input not covered elsewhere (unless quoted).
INVALID_INPUT:
    [\u0001-\u0008]   // Control codes.
    | '\u000B'        // Line tabulation.
    | '\u000C'        // Form feed.
    | [\u000E-\u001F] // More control codes.
;

// String and text types.

// Identifiers might start with a digit, even though it is discouraged, and may not consist entirely
// of digits only. All keywords above are automatically excluded.
IDENTIFIER:
    DIGITS+ [eE] (LETTER_WHEN_UNQUOTED_NO_DIGIT LETTER_WHEN_UNQUOTED*)? // Have to exclude float pattern, as this rule matches more.
    | DIGITS+ LETTER_WITHOUT_FLOAT_PART LETTER_WHEN_UNQUOTED*
    | LETTER_WHEN_UNQUOTED_NO_DIGIT LETTER_WHEN_UNQUOTED*
;
// INT_NUMBER matches first if there are only digits.

NCHAR_TEXT: [nN] SINGLE_QUOTED_TEXT;

// MySQL supports automatic concatenation of multiple single and double quoted strings if they
// follow each other as separate tokens. This is reflected in the `textLiteral` parser rule. Here we
// handle duplication of quotation chars only (which must be replaced by a single char in the target
// code).

fragment BACK_TICK:    '`';
fragment SINGLE_QUOTE: '\'';
fragment DOUBLE_QUOTE: '"';

BACK_TICK_QUOTED_ID: BACK_TICK (('\\')? .)*? BACK_TICK;

DOUBLE_QUOTED_TEXT: (DOUBLE_QUOTE ( ('\\' .)? .)*? DOUBLE_QUOTE)+;

SINGLE_QUOTED_TEXT: ( SINGLE_QUOTE ( ('\\')? .)*? SINGLE_QUOTE)+;

BLOCK_COMMENT: ('/**/' | '/*' ~[!] .*? '*/') -> channel(HIDDEN);

POUND_COMMENT:    '#' ~([\n\r])* -> channel(HIDDEN);
DASHDASH_COMMENT: DOUBLE_DASH ([ \t] (~[\n\r])* | LINEBREAK | EOF) -> channel(HIDDEN);

fragment DOUBLE_DASH: '--';
fragment LINEBREAK:   [\n\r];

fragment SIMPLE_IDENTIFIER: (DIGIT | [a-zA-Z_$] | DOT_SYMBOL)+;

fragment ML_COMMENT_HEAD: '/*';
fragment ML_COMMENT_END:  '*/';

// As defined in https://dev.mysql.com/doc/refman/8.0/en/identifiers.html.
fragment LETTER_WHEN_UNQUOTED: DIGIT | LETTER_WHEN_UNQUOTED_NO_DIGIT;

fragment LETTER_WHEN_UNQUOTED_NO_DIGIT: [a-zA-Z_$\u0080-\uffff];

// Any letter but without e/E and digits (which are used to match a decimal number).
fragment LETTER_WITHOUT_FLOAT_PART: [a-df-zA-DF-Z_$\u0080-\uffff];

//----------------- Json -----------------------------------------------------------------------------------------------

JSON_STRING: DOUBLE_QUOTE (JSON_ESC | JSON_SAFECODEPOINT)* DOUBLE_QUOTE;

fragment JSON_ESC: '\\' (["\\/bfnrt] | JSON_UNICODE);

fragment JSON_UNICODE: 'u' JSON_HEX JSON_HEX JSON_HEX JSON_HEX;

fragment JSON_HEX: [0-9a-fA-F];

fragment JSON_SAFECODEPOINT: ~ ["\\\u0000-\u001F];

JSON_NUMBER: '-'? JSON_INT ('.' [0-9]+)? JSON_EXP?;

fragment JSON_INT: // integer part forbis leading 0s (e.g. `01`)
    '0'
    | [1-9] [0-9]*
;

// no leading zeros

fragment JSON_EXP: // exponent number permits leading 0s (e.g. `1e01`)
    [Ee] [+\-]? [0-9]+
;

// \- since - means "range" inside [...]

WS: [ \t\n\r]+ -> skip;
