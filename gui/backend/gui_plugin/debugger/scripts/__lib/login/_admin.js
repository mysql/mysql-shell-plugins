//
//  Authenticate with 'success_admin' script
//
var lib = ws.tokens.lib

lib.login.login.params = {
    "user": "success_admin"
}

await ws.execute(lib.login.login.file)
