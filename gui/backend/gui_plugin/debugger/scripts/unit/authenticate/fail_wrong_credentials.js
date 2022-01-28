await ws.send({
    "request": "authenticate",
    "username": "fake_user",
    "password": "fail",
    "request_id": ws.generateRequestId()
})

ws.validateLastResponse({
    'request_id': ws.lastGeneratedRequestId,
    'request_state': {
        'msg': 'User could not be authenticated. Incorrect username or password.',
        'type': 'ERROR'
    }
})


