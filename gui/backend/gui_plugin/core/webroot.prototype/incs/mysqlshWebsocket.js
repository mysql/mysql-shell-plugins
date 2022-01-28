/*
 * Copyright (c) 2020, 2021, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

// Set the default export
export default ["1.0"];

export { MysqlshWebsocket };

/** @class MysqlshWebsocket representing a websocket connection to a
  * MySQL Shell daemon. */
class MysqlshWebsocket {

    /**
     * Creates an instance of MysqlshWebsocket.
     *
     * @constructor
     * @param {Boolean} useSecureConnection Defines whether a secure
     * connection is used
     */
    constructor(useSecureConnection) {
        this._useSecureConnection = useSecureConnection;
        this._logSendMessageCommands = true;

        this._logFunctions = [];
        this._eventHandlers = {};
        this._requests = {};
        this._requestClasses = {};
        this._isConnected = false;
        this._last_response = null;
        this._last_module_session_id = null;
        this._last_error = null;
    }

    /**
     * getter, returns the last module_session_id that was set
     */
    get last_module_session_id() {
        return this._last_module_session_id;
    }

    /**
     * getter, returns whether the websocket is connected
     */
    get isConnected() {
        return this._isConnected;
    }

    /**
     * getter, returns the last websocket response message
     */
    get last_response() {
        return this._last_response;
    }

    /**
     * getter, returns the last websocket error
     */
    get last_error() {
        return this._last_error;
    }

    /**
     * getter, specifies if the sent message commands are logged as commands
     */
    get logSendMessageCommands() {
        return this._logSendMessageCommands;
    }

    /**
     * setter, specifies if the sent message commands are logged as commands
     */
    set logSendMessageCommands(value) {
        this._logSendMessageCommands = value;
    }

    /**
     * Adds a log function callback. This callback with be called to log
     * events
     *
     * @param {function} logFunction the logFunction that should be called if
     * an event occurs
     */
    addLogFunction(logFunction) {
        this._logFunctions.push(logFunction);
    }

    /**
     * Opens the websocket connection
     */
    doConnect() {
        let websocketUrl;
        if (this._useSecureConnection) {
            websocketUrl = window.location.href.replace('https://', 'wss://') +
                'ws1.ws';
        } else {
            websocketUrl = window.location.href.replace('http://', 'ws://') +
                'ws1.ws';
        }
        this.websocket = new WebSocket(websocketUrl);
        this.websocket.onopen = (event) => this._onOpen(event);
        this.websocket.onclose = (event) => this._onClose(event);
        this.websocket.onmessage = (event) => this._onMessage(event);
        this.websocket.onerror = (event) => this._onError(event);
    }

    /**
     * Closes the websocket connection
     */
    doDisconnect() {
        this.websocket.close();
    }

    /**
     * Adds a callback for the given eventType. Use this to
     * add additional handling to websocket events. The callbacks will be
     * called before the built-in functionality is executed.
     *
     * @param {String} eventType the eventType, either 'onopen', 'onclose',
     * 'onmessage' or 'onerror'
     * @param {function} callback the callback that should be called if
     * the given event occurs
     */
    addEventHandler(eventType, callback) {
        if (eventType in this._eventHandlers) {
            this._eventHandlers[eventType].push(callback);
        } else {
            this._eventHandlers[eventType] = [callback];
        }
    }

    /**
     * Removes a callback for the given eventType.
     *
     * @param  {String} eventType the eventType, either 'onopen',
     * 'onclose', 'onmessage' or 'onerror'
     * @param  {Function} callback the callback that was originally given
     */
    removeEventHandler(eventType, callback) {
        if (eventType in this._eventHandlers) {
            callbacks = this._eventHandlers[eventType];
            let index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Add a callback for a given requestClass. This is useful when one
     * wants to subscribe to response messages of a given requestClass.
     *
     * @param  {String} requestClass the name of a requestClass to subscribe
     * to. The requestClass names have to be explicitly set when sending a
     * message
     * @param {function} requestCallback the callback to be called. It takes
     * the incoming message and the requestCallbackData as parameters
     * @param {Object} requestCallbackData custom data that is passed to the
     * callback
     */
    addRequestClassListener(requestClass, requestCallback,
        requestCallbackData = null) {
        if (requestClass in this._requestClasses) {
            this._requestClasses[requestClass].push({
                "requestCallback": requestCallback,
                "requestCallbackData": requestCallbackData
            })
        } else {
            this._requestClasses[requestClass] = [{
                "requestCallback": requestCallback,
                "requestCallbackData": requestCallbackData
            }]
        }
    }

    /**
     * Calls all registered EventHandlers callback functions for the give
     * eventType.
     *
     * @param  {String} eventType the eventType, either 'onopen',
     * 'onclose', 'onmessage' or 'onerror'
     * @param  {Object} event the event object that should be passed to the
     * callback
     */
    _callEventHandlers(eventType, event) {
        // Check if callbacks are registered for the given eventType
        if (eventType in this._eventHandlers) {
            let callbacks = this._eventHandlers[eventType];
            callbacks.forEach(callback => { callback(event); });
        }
    }

    /**
     * Called when the websocket connection is opened
     *
     * @param  {Object} event the event object
     */
    _onOpen(event) {
        this.log('ws.isConnected = true;\n', false);

        this._callEventHandlers('onopen', event);

        this._isConnected = true;
    }

    /**
     * Called when the websocket connection is closed
     *
     * @param  {Object} event the event object
     */
    _onClose(event) {
        this.log('ws.isConnected = false;\n', false);

        this._callEventHandlers('onclose', event);

        this._isConnected = false;
    }

    /**
     * Called when there is an error on the websocket
     *
     * @param  {Object} event the event object
     */
    _onError(event) {
        this.log('ws.last_error = "' + event.data + '";\n', false);
        this._last_error = event.data;

        this._callEventHandlers('onerror', event);

        this.websocket.close();
    }

    /**
     * Called when a message is received on the websocket
     *
     * @param  {Object} event the event object
     */
    _onMessage(event) {
        try {
            this._callEventHandlers('onmessage', event);

            // convert message string into Javascript object
            let msg = JSON.parse(event.data);
            this._last_response = msg
            this.log('ws.last_response = ' + JSON.stringify(msg, null, 4) +
                ';\n', false);

            // set this.last_module_session_id if module_session_id was in message
            if (msg.module_session_id &&
                msg.module_session_id != this._last_module_session_id) {
                this._last_module_session_id = msg.module_session_id
                this.log('ws.last_module_session_id = "' + msg.module_session_id +
                    '";\n', false);
            }

            // check if a specific request handling for the message's request_id
            // is cached in this._requests
            if (msg.request_id) {
                if (msg.request_id in this._requests) {
                    let request = this._requests[msg.request_id];
                    // The cached request uses the following structure
                    // {
                    //   "requestCallback": requestCallback,
                    //   "requestCompletedCallback": requestCompletedCallback,
                    //   "requestClass": requestClass,
                    //   "requestCallbackData": requestCallbackData
                    // }

                    // if a requestCallback was set, call it and pass along the
                    // response and the original requestCallbackData
                    request.requestCallback(msg, request.requestCallbackData);

                    // if there was a requestCompletedCallback cached and the
                    // response msg has the request_state.type OK, also call
                    // that callback and pass along the response and the original
                    // requestCallbackData
                    if (request.requestCompletedCallback && msg.request_state &&
                        msg.request_state.type === 'OK') {
                        request.requestCompletedCallback(msg,
                            request.requestCallbackData);
                    }

                    // if a requestClass was given, check if there are any callbacks
                    // registered for that specific requestClass. If so, call them
                    // and pass along the response and the original
                    // requestCallbackData
                    if (request.requestClass !== '') {
                        if (request.requestClass in this._requestClasses) {
                            let callbacks = this._requestClasses[request.requestClass];
                            callbacks.forEach(callback => {
                                callback.requestCallback(msg,
                                    callback.requestCallbackData)
                            })
                        }
                    }

                    // remove msg.request_id from cached requests
                    //delete this._requests[msg.request_id];
                }
            }
        } catch (e) {
            this.log(`// Error: ${e}`, false);
            this.log(`// message: ${e}`, false);
            this.log(event.data, false);
        }
    }

    /**
     * Sends a message through the websocket to the server
     *
     * @param  {(String|Object)} message a JSON String or an object that holds
     * the message data. It should include a key named request_id with a UUID
     * string that represents the request
     * @param {function} requestCallback the callback to be called when a
     * response is sent from the server using the provided request_id. It
     * takes the incoming message and the requestCallbackData as parameters
     * @param {Object} requestCallbackData custom data that is passed to the
     * callback
     * @param {function} requestCompletedCallback the callback to be called
     * when a response is sent from the server using the provided request_id
     * and has the request_state.type set to 'OK'. This is useful for
     * requests that trigger multiple responses using the PENDING state types
     * before the final response with state type OK is sent. The callback
     * would then only be called for the final response
     * @param {String} requestClass the requestClass name that should be used
     * for this request. The requestClass name is a freely defined name that
     * can be used in conjunction with self.addRequestClassListener() to
     * notify multiple listeners about responses to this request.
     */
    doSend(message, requestCallback = null, requestCallbackData = null,
        requestCompletedCallback = null, requestClass = '') {
        try {
            let msg = message;

            // if a string was given, convert it into Javascript object
            if (typeof (message) === "string") {
                msg = JSON.parse(message);
            }

            // Automatically fill in a request_id if not specified in the msg
            if (!msg.request_id) {
                msg.request_id = this.generatedRequestId();
            }

            // if the message does not include a request_id, but a
            // requestCallback was provided, error out
            if (requestCallback && !msg.request_id) {
                this.log("//ERROR: A requestCallback can only be given if " +
                    "the message contains a request_id");
                return;
            } else if (msg.request_id && requestCallback) {
                // check if the given request_id is already in this._requests
                if (msg.request_id in this._requests) {
                    this.log("//ERROR: A message with this request_id was " +
                        "already sent");
                    return;
                } else {
                    // cache request handling for the request_id in this._requests
                    this._requests[msg.request_id] = {
                        "requestCallback": requestCallback,
                        "requestCompletedCallback": requestCompletedCallback,
                        "requestClass": requestClass,
                        "requestCallbackData": requestCallbackData
                    };
                }
            }

            let msgStr = JSON.stringify(msg, null, 4);
            if (this.logSendMessageCommands) {
                this.log('ws.doSend(' + msgStr + ');\n', true);
            }

            // send the message
            this.websocket.send(msgStr);
        } catch (e) {
            this.log('// Exception: ' + e);
        }
    }

    /**
     * Generates a UUID that can be passed as request_id to the server
     */
    generatedRequestId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,
            function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
    }

    /**
     * Logs the given message using the log function that was provided to
     * the constructor
     * @param {(String|Object)} message the message to log
     * @param {Boolean} isCommand specifies whether the given message should
     * be logged as a command
     */
    log(message, isCommand = false) {
        if (typeof (message) === 'object' && message !== null) {
            let json_msg = JSON.stringify(message, null, 4)
            if (json_msg === '{}') {
                message = String(message)
            } else {
                message = json_msg
            }
        } else if (typeof (message) !== 'string') {
            message = String(message)
        }
        // Call all registered log functions
        this._logFunctions.forEach(
            logFunction => logFunction(message, isCommand));
    }

    /**
     * Async function that waits till the last_module_session_id is set. It
     * times out after 1 second
     */
    async get_last_module_session_id_async() {
        // If this._last_module_session_id is not set yet, wait for it to be
        // set for 1 second
        let retry = 0;
        while (this._last_module_session_id === null && retry < 10) {
            await new Promise(r => setTimeout(r, 100));
            retry++;
        }

        return this._last_module_session_id;
    }
}
