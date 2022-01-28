//
//  Authenticate with the specified user
//  params:
//      user: the user authentication script (ex: 'success_admin')
//  return:
//      the active profile returned during login
//
var lib = ws.tokens.lib
var _this = lib.login.login

//  Authenticate
await ws.execute("unit/authenticate/" + _this.params["user"] + ".js")

//  Collect some result data
_this.result["active_profile"] = ws.lastResponse["active_profile"]
