### Copyright (c) 2020, 2022, Oracle and/or its affiliates.

<!--- cSpell:ignore Keychain mkdir --->

# MySQL Shell GUI Backend
This folder contains all the code for the MySQL Shell GUI (short: MSG) backend.

# Environment Setup
The backend is written as a python plugin for the MySQL Shell and hence needs to be in the usual plugin folder for it to recognize the new functionality. The plugin provides two parts of functionality:

- A web server with websocket support to serve the frontend files and to connect to the MySQL Shell.
- A library with functionality that the frontend can use to do its work. This avoids having to make the entire shell functionality accessible from the web client (which also imposes security risks).

To prepare the shell home directory, we need to have the plugin in place. To do so, execute the following commands:
```bash
mkdir -p ~/.mysqlsh/plugins/
ln -s `<gui plugin>/backend/gui_plugin` ~/.mysqlsh/plugins/gui_plugin
```

This way we can keep all python files in the code repository, while using them as registered plugin.

Since the backend needs to serve the frontend code, we need to symlink the frontend code to a place where the backend can easily access it. This folder is located in `<gui plugin>/backend/gui_plugin/core/webroot`.

```bash
ln -s <gui plugin>/frontend/build <gui plugin>/backend/gui_plugin/core/webroot
```

## Certificate for localhost

Client connection usually use a secure channel via https. In a production scenario the server must have a valid certificate for that to be acceptable by clients.

During development, however, there's usually no real certificate. Instead there's a self-signed cert, which you need to register on your dev machine with the client code, so that browsers accept secure connections. If all fails then you can also use an insecure connection (see also the frontend readme for details), but that's not recommended.

To make secure connections work, the certificate used by the mock web server needs to be added to the local key chain. The repository includes a set of certificate files that can be used for testing purposes. For production usage, a new set of certificates need to be created.

The certificate authority file must be added to the "Authority" section of your browser certificate manager. This file can be found in `<gui plugin>/backend/gui_plugin/core/certificates/rootCA.pem`

Google Chrome:

- Goto "Customize" -> Settings -> Privacy and Security.
in the "Privacy and Security" section select "Manage Certificates" and click - "Import".
Choose the rootCA.pem from the folder specified above.

Firefox:

- Open "Menu" -> "Preferences" -> "Privacy & Security" and click "View Certificates...".
- A popup dialog should show up. Click on "Import" and choose the `rootCA.pem` file from the specified folder.

Example on macOS:

  - Open "Keychain Access", go to the category "Certificates".
  - Use File > Import Items to load the `rootCA.pem` from the specified folder.
  - Double click the imported certificate and change the “When using this certificate:” dropdown to Always Trust in the Trust section.

If SSL/TLS connections don't work (for whatever reason), disable SSL when starting the backend by using

```bash
python main.py --nossl
```

You will also have to disable SSL in the dev server start script in the frontend in such a case.

# Deployment
In a production scenario a MySQL Shell instance is launched and configured to run the python web server to serve frontend files as described in the [frontend readme](../frontend/readme.md). This instance also runs the library code and the websocket layer for direct command execution.

# Development
During development the setup is however different, mostly because we need to debug both, backend and frontend code. Therefore we launch the python web server not as part of a MySQL Shell instance but standalone. It will then not talk with a MySQL Shell instance, but with a mock backend. In this scenario the Shell is not used at all and the library functions are directly used (instead via the plugin layer).

To launch the mock MySQL Shell you need to run

```bash
python main.py
```

If you're having certificate problems, try

```bash
python main.py --nossl
```

If you need to launch it on a different port then the default (port 8000)

```bash
python main.py --port=3000
```

## Visual Studio Code
Like recommended for the frontend code development also for the backend it is probably most effective to use vscode. You can open this `backend/` folder in the IDE (even in parallel to the frontend folder) and launch the python web server from there. To do that create a launch config with this content:

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Mock server (https)",
            "type": "python",
            "request": "launch",
            "program": "${workspaceFolder}/main.py",
            "console": "integratedTerminal",
            "cwd": "${workspaceFolder}",
            "args": [
            ]
        },
        {
            "name": "Mock server (http)",
            "type": "python",
            "request": "launch",
            "program": "${workspaceFolder}/main.py",
            "console": "integratedTerminal",
            "cwd": "${workspaceFolder}",
            "args": [
                "--nossl"
            ]
        }
    ]
}

```

For development select the "Mock Server (http)" configuration and start it. It runs the websocket + web server, which now accepts http requests from the frontend.


## Debugging the tests
To start the tests, you need to run

```bash
./run_tests.sh
```

To allow the tests to wait for a debugger to be attached, the ATTACH_DEBUGGER environment variable needs to be set with 'TESTS' or 'BACKEND'. This enables to debug the tests part or the running backend used in the ser stories.

```bash
ATTACH_DEBUGGER=BACKEND ./run_tests.sh
```

In vscode, you should use the following configurations. These configurations allow to properly debug and set breakpoints.

```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Python: Attach to tests",
            "type": "python",
            "request": "attach",
            "processId": "${command:pickProcess}",
            "pathMappings": [
                {
                    "localRoot": "${workspaceFolder}",
                    "remoteRoot": "${workspaceFolder}"
                }
            ]

        },
        {
            "name": "Python: Attach to BE subprocess",
            "type": "python",
            "request": "attach",
            "processId": "${command:pickProcess}",
            "pathMappings": [
                {
                    "localRoot": "${workspaceFolder}",
                    "remoteRoot": "/tmp/backend_debug/plugins"
                }
            ]

        },
                {
            "name": "Python: Attach to BE subprocess standalone",
            "type": "python",
            "request": "attach",
            "processId": "${command:pickProcess}",
            "logToFile": true,
            "justMyCode": false,
            "pathMappings": [
                {
                    "localRoot": "${workspaceFolder}",
                    "remoteRoot": "/home/<user>/.mysqlsh/plugins"
                }
            ]

        }
    ]
}
```

To debug the backend code in standalone mode, the following command should be issued:

```bash
ATTACH_DEBUGGER=BACKEND mysqlsh --py -e "import gui_plugin.debug_utils; import gui_plugin.start; gui.start.web_server(port=8000, secure={}, single_instance_token=\"<same token used in the browser URL>\")"
```
