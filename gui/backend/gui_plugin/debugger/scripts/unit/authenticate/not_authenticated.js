await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.users.list_users",
    "args": {}
})

ws.validateLastResponse({
    'request_id': ws.lastGeneratedRequestId,
    'request_state': {
        'msg': 'This session is not yet authenticated.',
        'type': 'ERROR'
    }
})
