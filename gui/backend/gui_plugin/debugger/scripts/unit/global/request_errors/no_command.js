await ws.send({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "args": {}
})

ws.validateLastResponse({
    'request_id': ws.lastGeneratedRequestId,
    'request_state': {
        'msg': 'No command given. Please provide the command.',
        'type': 'ERROR'
    }
})
