### Copyright (c) 2020, 2022, Oracle and/or its affiliates.

# MySQL Shell GUI Frontend

This folder contains all the code for the MySQL Shell GUI (short: MSG) frontend, but requires first some setup, before you can run the web application.

It is being developed using Node.js and React. React Scripts (with all their dependencies like Babel, Webpack etc.) take care to provide the environment needed for that. The final application, however, runs as pure web app, without any dependency on Node.js.

## Environment Setup

First call

```bash
npm install
```

in the `frontend/` folder, to download all dependencies. This prepares the Shell GUI frontend for both debugging and deployment.

# Deployment

The MySQL Shell GUI app consists of two parts: a client (running in a web environment) and a server. The server has here two tasks:

- Serve the web application files to the client.
- Connect the client to the MySQL shell backend using a web socket.

You can read more details about the backend setup in the [backend readme](../backend/readme.md). The normal setup is a MySQL Shell instance, running the webserver as a plugin and serving the bundles from the production build. To create such a production build of the app run:

```bash
npm run build
```

in the `frontend/` folder. This will create a new folder `build` with all the files the web server needs. Copy this folder to your server, configure the Shell to use it and start the Shell. You can now connect to it using your favorite browser.

# Development

During development the setup is however more complex, mostly due to the requirement to be able to debug both, the backend and the frontend code. Additionally, we have to decouple the MSG development from the Shell development, to avoid deadlocks while waiting for a specific feature.

For this reason is it possible to run the webserver also standalone, instead of as Shell plugin. More of that can be read in the already mentioned [backend readme](../backend/readme.md).

And because we cannot debug the React application while it is being served from our python web server, we have to use a different setup. Instead we launch 2 different servers. One of them is the standalone python web server for the Shell, which also handles the websocket connections. The other one is the Node.js development server, which will take care to run the process to produce the debug build as well as serve the debug files to any connected browser. Since both webservers have to run, we still need the production build (even though it is not further used other than to start the python web server) and we have to use a different port for the development webserver. The start scripts (see below) set 3001, which is what you must use in your web browser then.

Keep in mind that the connection to the web server runs over a secure channel (https). That means for development you need a dev certificate or your browser will refuse to connect. The backend readme also contains instructions for setting that up. If all fails then you can also use an insecure connection, however (see below).

# Visual Studio Code

It is strongly recommended to use Visual Studio code for development on all platforms, also because of the excellent support for React development. All the instructions below focus on this IDE.

Use the `frontend/` folder as the root folder in your VS Code project. It contains all necessary files for frontend development.

## Recommended extensions

- Jest
- Code Spell Checker
- ESLint

There's already an ESLint configuration file in the `frontend/` folder, which should automatically be picked up by the ESLint extension.

For Jest use this configuration:

```json
	"jest.coverageFormatter": "GutterFormatter",
    "jest.testExplorer": {
        "enabled": true
    },
    "jest.autoRun": "off",
    "jest.jestCommandLine": "npm run test --",
    "jest.showCoverageOnLoad": true,
```

## Debugging

There's no ready-to-use launch configuration for MSG in the repository, so you first need to create that with the content below (or copy the relevant parts into your existing config):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "name": "Run Tests",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/jest/bin/jest",
      "args": ["--config ${workspaceFolder}/jest.config.js"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "disableOptimisticBPs": true
    },
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Shell GUI",
      "url": "https://localhost:3001",
      "webRoot": "${workspaceFolder}/src",
      "userDataDir": "${workspaceRoot}/.vscode/chrome",
      "sourceMaps": true,
      "sourceMapPathOverrides": {
        "webpack:///build/*": "${webRoot}/*"
      }
    }
  ]
}
```

## Debugging JEST

There's no ready-to-use launch configuration in the repository, so you first need to create that with the content below (or copy the relevant parts into your existing config):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "firefox",
      "request": "launch",
      "name": "Launch MSG on FF",
      "url": "http://localhost:3001",
      "webRoot": "${workspaceFolder}/src",
      "clearConsoleOnReload": true,
      "preLaunchTask": "tsc: watch",
      "keepProfileChanges": true,
      "reAttach": true,
      "profile": "dev",
      "firefoxArgs": [
        //"-devtools",
      ]
    },
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch MSG on Chrome",
      "url": "http://localhost:3001",
      "webRoot": "${workspaceFolder}/src",
      "userDataDir": "${workspaceRoot}/.vscode/chrome",
      "sourceMaps": true,
      "preLaunchTask": "tsc: watch",
      "sourceMapPathOverrides": {
        "webpack:///build/*": "${webRoot}/*"
      }
    },
    {
      "name": "Debug CRA Tests",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "${workspaceRoot}/node_modules/.bin/react-scripts",
      "args": ["test", "--runInBand", "--no-cache", "--watchAll=false"],
      "cwd": "${workspaceRoot}",
      "protocol": "inspector",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "env": { "CI": "true" },
      "disableOptimisticBPs": true
    }
  ]
}
```

If not yet done start the Node.js development (express) server by calling:

```bash
npm run starts
```

for a https connection or

```bash
npm run start
```

for a standard (insecure) one. The development server accepts both, while the production server only accepts secure connections. During development the client connection class will still access the server on port 3000, but only via web sockets, to talk with the MySQL Shell mockup.

That's it. You can now either run the included tests or launch the web browser (Chrome is preselected here) and start debugging.

# Running Specs

Update your Chrome browser to the latest available version.

Open a new terminal and run the following:

```bash
$ npm install
$ npm run e2e-tests-update
$ npm run e2e-tests-start
```

Under the covers, the project uses `webdriver-manager` to manage the Selenium server. The first script uses it to download the latest Selenium package and drivers for your browsers. The second starts up a new local Selenium server which you'll need to leave running otherwise, the tests won't have a Selenium server to connect to.
Open a new terminal and start the app -

```bash
$ npm run start
```

This will build the app and open it in a browser as normal.

End to end tests need a MySQL database with some data. Please setup one and run the scripts under src/tests/e2e/sql

Enable SSL on your server to use the ssl certificates in frontend/src/tests/e2e/ssl_certificates

Some environment variables need to be setup as well:

- DBHOSTNAME
- DBUSERNAME
- DBPASSWORD
- DBPORT
- HEADLESS (optional) (1 - headless mode enabled / 0 - headless mode disabled)

Finally let's fire up another new terminal and call Jest to run the tests for us -

```bash
$ npm run e2e-test-run
```
Be aware that the tests run in headless mode by default. If you want to see the browser opening and see the tests running just set the HEADLESS var to 0.

## Automatically running the tests

As well as running the tests once, you can also start Jest in watch mode to automatically run your tests whenever they change by running -

```bash
$ npm run e2e-test-run -- --watch
```

## Running the tests sequentially

You can also pass any other arguments through to Jest in this fashion.

```bash
$ npm run e2e-test-run -- --runInBand
```

## Using environment specific values

Values can be injected in to the tests by specifying them as globals when running Jest -

```bash
$ npm run e2e-test-run --globals "{\"baseUrl\": \"https://example.com\"}
```

There's no ready-to-use launch configuration for MSG in the repository, so you first need to create that with the content below (or copy the relevant parts into your existing config):

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest e2e tests",
  "program": "${workspaceRoot}/node_modules/jest/bin/jest.js",
  "args": [
    "--verbose",
    "-i",
    "-c",
    "${workspaceRoot}/e2e/jest.config.js",
    "--no-cache"
  ],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```
