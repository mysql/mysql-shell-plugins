var responses = ws.tokens["responses"]

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.error.commandNotSupported
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\edit",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.error.commandNotSupported
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\e",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.error.commandNotSupported
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\exit",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.error.commandNotSupported
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\history",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.error.commandNotSupported
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\nopager",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.error.commandNotSupported
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\pager",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.error.commandNotSupported
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\P",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.error.commandNotSupported
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\quit",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.error.commandNotSupported
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\q",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.error.commandNotSupported
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\rehash",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.error.commandNotSupported
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\source",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.error.commandNotSupported
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\.",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.error.commandNotSupported
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\system",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.error.commandNotSupported
])

await ws.sendAndValidate({
    "request": "execute",
    "request_id": ws.generateRequestId(),
    "command": "gui.shell.execute",
    "args": {
        "command": "\\!",
        "module_session_id": ws.lastModuleSessionId,
    }
}, [
    responses.error.commandNotSupported
])
