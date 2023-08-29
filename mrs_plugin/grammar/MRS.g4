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

// MySQL REST Service (MRS) Grammar Definition
grammar MRS;

mrsScript:
	EOF
	| (mrsStatement (SEMICOLON_SYMBOL mrsStatement)*) (
		SEMICOLON_SYMBOL EOF?
		| EOF
	);

mrsStatement:
	configureRestMetadataStatement
	| createRestServiceStatement
	| createRestSchemaStatement
	| createRestViewStatement
	| createRestProcedureStatement
	| dropRestServiceStatement
	| dropRestSchemaStatement
	| dropRestDualityViewStatement
	| dropRestProcedureStatement
	| useStatement
	| showRestMetadataStatusStatement
	| showRestServicesStatement
	| showRestSchemasStatement
	| showRestViewsStatement
	| showRestProceduresStatement;

/* Common Definitions ======================================================= */

enabledDisabled: ENABLED_SYMBOL | DISABLED_SYMBOL;

quotedTextOrDefault: (quotedText | DEFAULT_SYMBOL);

jsonOptions: OPTIONS_SYMBOL jsonValue;

comments: COMMENTS_SYMBOL quotedText;

authenticationRequired:
	AUTHENTICATION_SYMBOL NOT_SYMBOL? REQUIRED_SYMBOL;

itemsPerPage:
	ITEMS_SYMBOL PER_SYMBOL PAGE_SYMBOL itemsPerPageNumber;

itemsPerPageNumber: INT_NUMBER;

serviceSchemaSelector:
	ON_SYMBOL (SERVICE_SYMBOL serviceRequestPath)? SCHEMA_SYMBOL schemaRequestPath;

/* CONFIGURE statements ===================================================== */

/* - CONFIGURE REST METADATA ------------------------------------------------ */

configureRestMetadataStatement:
	CONFIGURE_SYMBOL REST_SYMBOL METADATA_SYMBOL restMetadataOptions?;

restMetadataOptions: (
		enabledDisabled
		| jsonOptions
		| updateIfAvailable
	)+;

updateIfAvailable: UPDATE_SYMBOL (IF_SYMBOL AVAILABLE_SYMBOL)?;

/* CREATE statements ======================================================== */

/* - CREATE REST SERVICE ---------------------------------------------------- */

createRestServiceStatement:
	CREATE_SYMBOL (OR_SYMBOL REPLACE_SYMBOL)? REST_SYMBOL SERVICE_SYMBOL serviceRequestPath
		restServiceOptions?;

restServiceOptions: (
		enabledDisabled
/*		| restProtocol -- not enabled yet */
		| restAuthentication
/*		| userManagementSchema -- not enabled yet */
		| jsonOptions
		| comments
	)+;

restProtocol:
	PROTOCOL_SYMBOL (
		HTTP_SYMBOL
		| HTTPS_SYMBOL
		| HTTP_SYMBOL COMMA_SYMBOL HTTPS_SYMBOL
		| HTTPS_SYMBOL COMMA_SYMBOL HTTP_SYMBOL
	);

restAuthentication:
	AUTHENTICATION_SYMBOL (
		authPath
		| authRedirection
		| authValidation
		| authPageContent
	)*;

authPath: PATH_SYMBOL quotedTextOrDefault;

authRedirection: REDIRECTION_SYMBOL quotedTextOrDefault;

authValidation: VALIDATION_SYMBOL quotedTextOrDefault;

authPageContent: PAGE_SYMBOL CONTENT_SYMBOL quotedTextOrDefault;

userManagementSchema:
	USER_SYMBOL MANAGEMENT_SYMBOL SCHEMA_SYMBOL (
		schemaName
		| DEFAULT_SYMBOL
	);

/* - CREATE REST SCHEMA ----------------------------------------------------- */

createRestSchemaStatement:
	CREATE_SYMBOL (OR_SYMBOL REPLACE_SYMBOL)? REST_SYMBOL SCHEMA_SYMBOL schemaRequestPath? (
		ON_SYMBOL SERVICE_SYMBOL? serviceRequestPath
	)? FROM_SYMBOL schemaName restSchemaOptions?;

restSchemaOptions: (
		enabledDisabled
		| authenticationRequired
		| itemsPerPage
		| jsonOptions
		| comments
	)+;

/* - CREATE REST VIEW ------------------------------------------------------- */

createRestViewStatement:
	CREATE_SYMBOL (OR_SYMBOL REPLACE_SYMBOL)? REST_SYMBOL RELATIONAL_SYMBOL? JSON_SYMBOL?
		DUALITY_SYMBOL? VIEW_SYMBOL viewRequestPath serviceSchemaSelector? FROM_SYMBOL
		qualifiedIdentifier restDualityViewOptions? AS_SYMBOL restObjectName graphGlCrudOptions?
		graphGlObj;

restDualityViewOptions: (
		enabledDisabled
		| authenticationRequired
		| itemsPerPage
		| jsonOptions
		| comments
		| restViewMediaType
		| restViewFormat
		| restViewAuthenticationProcedure
	)+;

restViewMediaType:
	MEDIA_SYMBOL TYPE_SYMBOL (quotedText | AUTODETECT_SYMBOL);

restViewFormat:
	FORMAT_SYMBOL (FEED_SYMBOL | ITEM_SYMBOL | MEDIA_SYMBOL);

restViewAuthenticationProcedure:
	AUTHENTICATION_SYMBOL PROCEDURE_SYMBOL qualifiedIdentifier;

/* - CREATE REST PROCEDURE -------------------------------------------------- */

createRestProcedureStatement:
	CREATE_SYMBOL (OR_SYMBOL REPLACE_SYMBOL)? REST_SYMBOL PROCEDURE_SYMBOL procedureRequestPath
		serviceSchemaSelector? FROM_SYMBOL qualifiedIdentifier AS_SYMBOL restObjectName
		PARAMETERS_SYMBOL graphGlObj restProcedureResult*;

restProcedureResult: RESULT_SYMBOL restResultName graphGlObj;

/* DROP statements ========================================================== */

dropRestServiceStatement:
	DROP_SYMBOL REST_SYMBOL SERVICE_SYMBOL serviceRequestPath;

dropRestSchemaStatement:
	DROP_SYMBOL REST_SYMBOL SCHEMA_SYMBOL schemaRequestPath (
		ON_SYMBOL SERVICE_SYMBOL? serviceRequestPath
	)?;

dropRestDualityViewStatement:
	DROP_SYMBOL REST_SYMBOL RELATIONAL_SYMBOL? JSON_SYMBOL? DUALITY_SYMBOL? VIEW_SYMBOL
		viewRequestPath serviceSchemaSelector?;

dropRestProcedureStatement:
	DROP_SYMBOL REST_SYMBOL PROCEDURE_SYMBOL procedureRequestPath serviceSchemaSelector?;

/* USE statements =========================================================== */

useStatement:
	USE_SYMBOL REST_SYMBOL serviceAndSchemaRequestPaths;

serviceAndSchemaRequestPaths:
	SERVICE_SYMBOL serviceRequestPath
	| (SERVICE_SYMBOL serviceRequestPath)? SCHEMA_SYMBOL schemaRequestPath;

/* SHOW statements ========================================================== */

showRestMetadataStatusStatement:
	SHOW_SYMBOL REST_SYMBOL METADATA_SYMBOL? STATUS_SYMBOL;

showRestServicesStatement:
	SHOW_SYMBOL REST_SYMBOL SERVICES_SYMBOL;

showRestSchemasStatement:
	SHOW_SYMBOL REST_SYMBOL SCHEMAS_SYMBOL (
		(IN_SYMBOL | FROM_SYMBOL) SERVICE_SYMBOL? serviceRequestPath
	)?;

showRestViewsStatement:
	SHOW_SYMBOL REST_SYMBOL RELATIONAL_SYMBOL? JSON_SYMBOL? DUALITY_SYMBOL? VIEWS_SYMBOL (
		(IN_SYMBOL | FROM_SYMBOL) serviceAndSchemaRequestPaths
	)?;

showRestProceduresStatement:
	SHOW_SYMBOL REST_SYMBOL PROCEDURES_SYMBOL (
		(IN_SYMBOL | FROM_SYMBOL) serviceAndSchemaRequestPaths
	)?;

/* Named identifiers ======================================================== */

serviceRequestPath:
	hostAndPortIdentifier? requestPathIdentifier;

schemaName: identifier;

schemaRequestPath: requestPathIdentifier;

viewName: identifier;

viewRequestPath: requestPathIdentifier;

restObjectName: identifier;

restResultName: identifier;

procedureName: identifier;

procedureRequestPath: requestPathIdentifier;

//-------------------------------------------------------------------------------------------------

CONFIGURE_SYMBOL: C O N F I G U R E;

CREATE_SYMBOL: C R E A T E;

OR_SYMBOL: O R;

REPLACE_SYMBOL: R E P L A C E;

SHOW_SYMBOL: S H O W;

REST_SYMBOL: R E S T;

METADATA_SYMBOL: M E T A D A T A;

STATUS_SYMBOL: S T A T U S;

SERVICES_SYMBOL: S E R V I C E S;

SERVICE_SYMBOL: S E R V I C E;

ON_SYMBOL: O N;

FROM_SYMBOL: F R O M;

IN_SYMBOL: I N;

SCHEMAS_SYMBOL: S C H E M A S;

SCHEMA_SYMBOL: S C H E M A;

JSON_SYMBOL: J S O N;

RELATIONAL_SYMBOL: R E L A T I O N A L;

DUALITY_SYMBOL: D U A L I T Y;

VIEWS_SYMBOL: V I E W S;

VIEW_SYMBOL: V I E W;

PROCEDURES_SYMBOL: P R O C E D U R E S;

PROCEDURE_SYMBOL: P R O C E D U R E;

PARAMETERS_SYMBOL: P A R A M E T E R S;

RESULT_SYMBOL: R E S U L T;

DROP_SYMBOL: D R O P;

USE_SYMBOL: U S E;

AS_SYMBOL: A S;

ENABLED_SYMBOL: E N A B L E D;

DISABLED_SYMBOL: D I S A B L E D;

PROTOCOL_SYMBOL: P R O T O C O L;

HTTP_SYMBOL: H T T P;

HTTPS_SYMBOL: H T T P S;

FILTER_SYMBOL: F I L T E R;

COMMENTS_SYMBOL: C O M M E N T S;

AUTHENTICATION_SYMBOL: A U T H E N T I C A T I O N;

PATH_SYMBOL: P A T H;

REDIRECTION_SYMBOL: R E D I R E C T I O N;

VALIDATION_SYMBOL: V A L I D A T I O N;

DEFAULT_SYMBOL: D E F A U L T;

USER_SYMBOL: U S E R;

MANAGEMENT_SYMBOL: M A N A G E M E N T;

OPTIONS_SYMBOL: O P T I O N S;

IF_SYMBOL: I F;

AVAILABLE_SYMBOL: A V A I L A B L E;

NOT_SYMBOL: N O T;

EXISTS_SYMBOL: E X I S T S;

REQUIRED_SYMBOL: R E Q U I R E D;

ITEMS_SYMBOL: I T E M S;

PER_SYMBOL: P E R;

PAGE_SYMBOL: P A G E;

CONTENT_SYMBOL: C O N T E N T;

HOST_SYMBOL: H O S T;

MEDIA_SYMBOL: M E D I A;

TYPE_SYMBOL: T Y P E;

AUTODETECT_SYMBOL: A U T O D E T E C T;

FORMAT_SYMBOL: F O R M A T;

FEED_SYMBOL: F E E D;

ITEM_SYMBOL: I T E M;

UPDATE_SYMBOL: U P D A T E;

//----------------- Common basic rules ---------------------------------------------------------------------------------

// Identifiers excluding keywords (except if they are quoted). IDENT_sys in sql_yacc.yy.
pureIdentifier: (IDENTIFIER | BACK_TICK_QUOTED_ID);

// Identifiers including a certain set of keywords, which are allowed also if not quoted. ident in
// sql_yacc.yy
identifier: pureIdentifier;

identifierList: // ident_string_list in sql_yacc.yy.
	identifier (COMMA_SYMBOL identifier)*;

identifierListWithParentheses:
	OPEN_PAR_SYMBOL identifierList CLOSE_PAR_SYMBOL;

qualifiedIdentifier: identifier dotIdentifier?;

simpleIdentifier: // simple_ident + simple_ident_q
	identifier (dotIdentifier dotIdentifier?)?;

// This rule encapsulates the frequently used dot + identifier sequence, which also requires a
// special treatment in the lexer. See there in the DOT_IDENTIFIER rule.
dotIdentifier: DOT_SYMBOL identifier;

dottedIdentifier: simpleIdentifier | identifier dotIdentifier*;

hostAndPortIdentifier: (
		dottedIdentifier (COLON_SYMBOL INT_NUMBER)?
	);

requestPathIdentifier:
	DIV_OPERATOR dottedIdentifier (DIV_OPERATOR dottedIdentifier)?;

quotedText: DOUBLE_QUOTED_TEXT | SINGLE_QUOTED_TEXT;

//----------------- Json -----------------------------------------------------------------------------------------------

jsonObj:
	OPEN_CURLY_SYMBOL jsonPair (COMMA_SYMBOL jsonPair)* CLOSE_CURLY_SYMBOL
	| OPEN_CURLY_SYMBOL CLOSE_CURLY_SYMBOL;

jsonPair: (JSON_STRING | DOUBLE_QUOTED_TEXT) COLON_SYMBOL jsonValue;

jsonArr: '[' jsonValue (COMMA_SYMBOL jsonValue)* ']' | '[' ']';

jsonValue:
	JSON_STRING
	| DOUBLE_QUOTED_TEXT
	| JSON_NUMBER
	| INT_NUMBER
	| jsonObj
	| jsonArr
	| 'true'
	| 'false'
	| 'null';

//----------------- GraphGL --------------------------------------------------------------------------------------------

AT_INOUT_SYMBOL: AT_SIGN_SYMBOL I N O U T;
AT_IN_SYMBOL: AT_SIGN_SYMBOL I N;
AT_OUT_SYMBOL: AT_SIGN_SYMBOL O U T;
AT_NOCHECK_SYMBOL: AT_SIGN_SYMBOL N O C H E C K;
AT_NOUPDATE_SYMBOL: AT_SIGN_SYMBOL N O U P D A T E;
AT_SORTABLE_SYMBOL: AT_SIGN_SYMBOL S O R T A B L E;
AT_NOFILTERING_SYMBOL: AT_SIGN_SYMBOL N O F I L T E R I N G;
AT_ROWOWNERSHIP_SYMBOL: AT_SIGN_SYMBOL R O W O W N E R S H I P;
AT_UNNEST_SYMBOL: AT_SIGN_SYMBOL U N N E S T;
AT_REDUCETO_SYMBOL: AT_SIGN_SYMBOL R E D U C E T O;
AT_DATATYPE_SYMBOL: AT_SIGN_SYMBOL D A T A T Y P E;
AT_SELECT_SYMBOL: AT_SIGN_SYMBOL S E L E C T;
AT_NOSELECT_SYMBOL: AT_SIGN_SYMBOL N O S E L E C T;
AT_INSERT_SYMBOL: AT_SIGN_SYMBOL I N S E R T;
AT_NOINSERT_SYMBOL: AT_SIGN_SYMBOL N O I N S E R T;
AT_UPDATE_SYMBOL: AT_SIGN_SYMBOL U P D A T E;
AT_DELETE_SYMBOL: AT_SIGN_SYMBOL D E L E T E;
AT_NODELETE_SYMBOL: AT_SIGN_SYMBOL N O D E L E T E;

graphGlObj:
	OPEN_CURLY_SYMBOL graphGlPair (COMMA_SYMBOL graphGlPair)* CLOSE_CURLY_SYMBOL
	| OPEN_CURLY_SYMBOL CLOSE_CURLY_SYMBOL;

graphGlCrudOptions: (
		AT_SELECT_SYMBOL
		| AT_NOSELECT_SYMBOL
		| AT_INSERT_SYMBOL
		| AT_NOINSERT_SYMBOL
		| AT_UPDATE_SYMBOL
		| AT_NOUPDATE_SYMBOL
		| AT_DELETE_SYMBOL
		| AT_NODELETE_SYMBOL
	)+;

graphGlPair:
	graphKeyValue COLON_SYMBOL qualifiedIdentifier (
		AT_IN_SYMBOL
		| AT_OUT_SYMBOL
		| AT_INOUT_SYMBOL
		| AT_NOCHECK_SYMBOL
		| AT_SORTABLE_SYMBOL
		| AT_NOFILTERING_SYMBOL
		| AT_ROWOWNERSHIP_SYMBOL
		| AT_UNNEST_SYMBOL
		| AT_REDUCETO_SYMBOL OPEN_PAR_SYMBOL graphGlReduceToValue CLOSE_PAR_SYMBOL
		| AT_DATATYPE_SYMBOL OPEN_PAR_SYMBOL graphGlDatatypeValue CLOSE_PAR_SYMBOL
		| graphGlCrudOptions
	)? graphGlObj?;

graphKeyValue: JSON_STRING | DOUBLE_QUOTED_TEXT | identifier;

graphGlReduceToValue:
	JSON_STRING
	| DOUBLE_QUOTED_TEXT
	| identifier;

graphGlDatatypeValue:
	JSON_STRING
	| DOUBLE_QUOTED_TEXT
	| identifier;

graphGlValue: qualifiedIdentifier | graphGlObj;

//-------------------------------------------------------------------------------------------------

// Operators
EQUAL_OPERATOR: '='; // Also assign.
ASSIGN_OPERATOR: ':=';
NULL_SAFE_EQUAL_OPERATOR: '<=>';
GREATER_OR_EQUAL_OPERATOR: '>=';
GREATER_THAN_OPERATOR: '>';
LESS_OR_EQUAL_OPERATOR: '<=';
LESS_THAN_OPERATOR: '<';
NOT_EQUAL_OPERATOR: '!=';
NOT_EQUAL2_OPERATOR: '<>' -> type(NOT_EQUAL_OPERATOR);

PLUS_OPERATOR: '+';
MINUS_OPERATOR: '-';
MULT_OPERATOR: '*';
DIV_OPERATOR: '/';

MOD_OPERATOR: '%';

LOGICAL_NOT_OPERATOR: '!';
BITWISE_NOT_OPERATOR: '~';

SHIFT_LEFT_OPERATOR: '<<';
SHIFT_RIGHT_OPERATOR: '>>';

LOGICAL_AND_OPERATOR: '&&';
BITWISE_AND_OPERATOR: '&';

BITWISE_XOR_OPERATOR: '^';

LOGICAL_OR_OPERATOR: '||';
BITWISE_OR_OPERATOR: '|';

DOT_SYMBOL: '.';
COMMA_SYMBOL: ',';
SEMICOLON_SYMBOL: ';';
COLON_SYMBOL: ':';
OPEN_PAR_SYMBOL: '(';
CLOSE_PAR_SYMBOL: ')';
OPEN_CURLY_SYMBOL: '{';
CLOSE_CURLY_SYMBOL: '}';
UNDERLINE_SYMBOL: '_';

JSON_SEPARATOR_SYMBOL: '->';
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

fragment DIGIT: [0-9];
fragment DIGITS: DIGIT+;
fragment HEXDIGIT: [0-9a-fA-F];

// Only lower case 'x' and 'b' count for hex + bin numbers. Otherwise it's an identifier.
HEX_NUMBER: ('0x' HEXDIGIT+) | ('x\'' HEXDIGIT+ '\'');
BIN_NUMBER: ('0b' [01]+) | ('b\'' [01]+ '\'');

INT_NUMBER: DIGITS;

// Float types must be handled first or the DOT_IDENTIIFER rule will make them to identifiers (if
// there is no leading digit before the dot).
DECIMAL_NUMBER: DIGITS? DOT_SYMBOL DIGITS;
FLOAT_NUMBER: (DIGITS? DOT_SYMBOL)? DIGITS [eE] (
		MINUS_OPERATOR
		| PLUS_OPERATOR
	)? DIGITS;

// White space handling
WHITESPACE:
	[ \t\f\r\n] -> channel(HIDDEN); // Ignore whitespaces.

// Input not covered elsewhere (unless quoted).
INVALID_INPUT:
	[\u0001-\u0008] // Control codes.
	| '\u000B' // Line tabulation.
	| '\u000C' // Form feed.
	| [\u000E-\u001F] // More control codes.
	| '['
	| ']';

// String and text types.

// Identifiers might start with a digit, even though it is discouraged, and may not consist entirely
// of digits only. All keywords above are automatically excluded.
IDENTIFIER:
	DIGITS+ [eE] (
		LETTER_WHEN_UNQUOTED_NO_DIGIT LETTER_WHEN_UNQUOTED*
	)? // Have to exclude float pattern, as this rule matches more.
	| DIGITS+ LETTER_WITHOUT_FLOAT_PART LETTER_WHEN_UNQUOTED*
	| LETTER_WHEN_UNQUOTED_NO_DIGIT LETTER_WHEN_UNQUOTED*;
// INT_NUMBER matches first if there are only digits.

NCHAR_TEXT: [nN] SINGLE_QUOTED_TEXT;

// MySQL supports automatic concatenation of multiple single and double quoted strings if they
// follow each other as separate tokens. This is reflected in the `textLiteral` parser rule. Here we
// handle duplication of quotation chars only (which must be replaced by a single char in the target
// code).

fragment BACK_TICK: '`';
fragment SINGLE_QUOTE: '\'';
fragment DOUBLE_QUOTE: '"';

BACK_TICK_QUOTED_ID: BACK_TICK (('\\')? .)*? BACK_TICK;

DOUBLE_QUOTED_TEXT: (DOUBLE_QUOTE ( ('\\' .)? .)*? DOUBLE_QUOTE)+;

SINGLE_QUOTED_TEXT: ( SINGLE_QUOTE ( ('\\')? .)*? SINGLE_QUOTE)+;

BLOCK_COMMENT: ('/**/' | '/*' ~[!] .*? '*/') -> channel(HIDDEN);

POUND_COMMENT: '#' ~([\n\r])* -> channel(HIDDEN);
DASHDASH_COMMENT:
	DOUBLE_DASH ([ \t] (~[\n\r])* | LINEBREAK | EOF) -> channel(HIDDEN);

fragment DOUBLE_DASH: '--';
fragment LINEBREAK: [\n\r];

fragment SIMPLE_IDENTIFIER: (DIGIT | [a-zA-Z_$] | DOT_SYMBOL)+;

fragment ML_COMMENT_HEAD: '/*';
fragment ML_COMMENT_END: '*/';

// As defined in https://dev.mysql.com/doc/refman/8.0/en/identifiers.html.
fragment LETTER_WHEN_UNQUOTED:
	DIGIT
	| LETTER_WHEN_UNQUOTED_NO_DIGIT;

fragment LETTER_WHEN_UNQUOTED_NO_DIGIT: [a-zA-Z_$\u0080-\uffff];

// Any letter but without e/E and digits (which are used to match a decimal number).
fragment LETTER_WITHOUT_FLOAT_PART:
	[a-df-zA-DF-Z_$\u0080-\uffff];

//----------------- Json -----------------------------------------------------------------------------------------------

JSON_STRING:
	DOUBLE_QUOTE (JSON_ESC | JSON_SAFECODEPOINT)* DOUBLE_QUOTE;

fragment JSON_ESC: '\\' (["\\/bfnrt] | JSON_UNICODE);

fragment JSON_UNICODE: 'u' JSON_HEX JSON_HEX JSON_HEX JSON_HEX;

fragment JSON_HEX: [0-9a-fA-F];

fragment JSON_SAFECODEPOINT: ~ ["\\\u0000-\u001F];

JSON_NUMBER: '-'? JSON_INT ('.' [0-9]+)? JSON_EXP?;

fragment JSON_INT: // integer part forbis leading 0s (e.g. `01`)
	'0'
	| [1-9] [0-9]*;

// no leading zeros

fragment JSON_EXP: // exponent number permits leading 0s (e.g. `1e01`)
	[Ee] [+\-]? [0-9]+;

// \- since - means "range" inside [...]

WS: [ \t\n\r]+ -> skip;