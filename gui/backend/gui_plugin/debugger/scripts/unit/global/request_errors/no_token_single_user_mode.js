ws.connect();

ws.validateLastResponse({
    "exception": ws.matchRegexp("Handshake status 400 Provided token is wrong.*")
})