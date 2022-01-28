await ws.execute("unit/authenticate/success_admin.js")

await ws.send({
  "request": "execute",
  "request_id": ws.generateRequestId(),
  "command": "users",
  "args": {}
})

ws.validateLastResponse({
  "request_id": ws.lastGeneratedRequestId,
  "request_state": {
    "type": "ERROR",
    "msg": "The command 'users' is using wrong format. Use <global>[.<object>]*.<function>"
  }
})
