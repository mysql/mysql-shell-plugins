// Testing the print callback, it is expected that something printed on the
// plugin gets reported as a PENDING response to the FE
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "guitest.do_print",
    "args": { "data": "Testing print callback" }
}, [
    {
        "request_state":
        {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": ws.lastGeneratedRequestId,
        "result": {
            "info": "Testing print callback\n"
        }
    },
    {
        "request_state":
        {
            "type": "OK",
            "msg": ""
        },
        "done": true,
        "request_id": ws.lastGeneratedRequestId,
    }
])


// Testing plugin exceptions using mysqlsh.Error do not contain any
// traceback, standard python exceptions should not really be used in
// plugins
await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "guitest.do_fail",
    "args": {}
}, [
    {
        "request_state":
        {
            "type": "ERROR",
            "msg": "guitest.do_fail: Something failed\n",
            "source": "MSG",
            "code": 1
        },
        "request_id": ws.lastGeneratedRequestId
    }
])

// POSITIVE Testing the prompt callback, the prompt should be sent to the FE
// so it provides the response
originalRequestId = ws.generateRequestId()
await ws.sendAndValidate({
    "request": "execute",
    "request_id": originalRequestId,
    "command": "guitest.do_prompt",
    "args": { "prompt": "Gimme some data:" }
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": originalRequestId,
        "result": {
            "prompt": "Gimme some data:",
            "type": "text"
        }
    }
])

await ws.sendAndValidate({
    "request": "prompt_reply",
    "request_id": originalRequestId,
    "type": "OK",
    "reply": "This is the FE Response",
}, [
    {
        "request_state":
        {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": originalRequestId,
        "result": {
            "info": "This is the FE Response\n"
        }
    },
    {
        "request_state":
        {
            "type": "OK",
            "msg": ""
        },
        "done": true,
        "request_id": originalRequestId,
    }
])


// NEGATIVE Testing the prompt callback, the prompt should be sent to the FE
// so it provides the response
originalRequestId = ws.generateRequestId()
await ws.sendAndValidate({
    "request": "execute",
    "request_id": originalRequestId,
    "command": "guitest.do_prompt",
    "args": { "prompt": "Gimme some data:" }
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": originalRequestId,
        "result": {
            "prompt": "Gimme some data:",
            "type": "text"
        }
    }
])

await ws.sendAndValidate({
    "request": "prompt_reply",
    "request_id": originalRequestId,
    "type": "CANCEL",
    "reply": "",
}, [
    {
        "request_state": {
            "type": "ERROR",
            "msg": ws.matchRegexp("RuntimeError: Shell.prompt: Cancelled"),
            "source": "MSG",
            "code": 1
        },
        "request_id": originalRequestId
    }
])


// POSITIVE Testing the prompt password callback, the prompt should be sent to
// the FE so it provides the response
originalRequestId = ws.generateRequestId()
await ws.sendAndValidate({
    "request": "execute",
    "request_id": originalRequestId,
    "command": "guitest.do_prompt_password",
    "args": { "prompt": "Gimme a password:" }
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": originalRequestId,
        "result":
        {
            'prompt': 'Gimme a password:',
            'type': 'password'
        }
    }
])

await ws.sendAndValidate({
    "request": "prompt_reply",
    "request_id": originalRequestId,
    "type": "OK",
    "reply": "dummypassword",
}, [
    {
        "request_state":
        {
            "type": "PENDING",
            "msg": ""
        },
        "request_id": originalRequestId,
        "result": {
            "info": "dummypassword\n"
        }
    },
    {
        "request_state":
        {
            "type": "OK",
            "msg": ""
        },
        "done": true,
        "request_id": originalRequestId,
    }
])


// NEGATIVE Testing the prompt callback, the prompt should be sent to the FE
// so it provides the response
originalRequestId = ws.generateRequestId()
await ws.sendAndValidate({
    "request": "execute",
    "request_id": originalRequestId,
    "command": "guitest.do_prompt_password",
    "args": { "prompt": "Gimme a password:" }
}, [
    {
        "request_state": {
            "type": "PENDING",
            "msg": "Executing..."
        },
        "request_id": originalRequestId,
        "result":
        {
            'prompt': 'Gimme a password:',
            'type': 'password'
        }
    }
])

await ws.sendAndValidate({
    "request": "prompt_reply",
    "request_id": originalRequestId,
    "type": "CANCEL",
    "reply": "",
}, [
    {
        "request_state": {
            "type": "ERROR",
            "msg": ws.matchRegexp("Shell.prompt: Cancelled"),
            "source": "MSG",
            "code": 1
        },
        "request_id": originalRequestId
    }
])
