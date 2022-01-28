lib = ws.tokens.lib

ws.execute(lib.init_mysql.file)
//  Make MySQL X specific initializations here

lib.init_mysql_x = lib.noop
