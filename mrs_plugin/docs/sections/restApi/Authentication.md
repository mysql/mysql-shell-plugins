<!-- Copyright (c) 2025, Oracle and/or its affiliates.

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License, version 2.0,
as published by the Free Software Foundation.

This program is designed to work with certain software (including
but not limited to OpenSSL) that is licensed under separate terms, as
designated in a particular file or component or in included license
documentation.  The authors of MySQL hereby grant you an additional
permission to link the program and your derivative works with the
separately licensed software that they have either included with
the program or referenced in the documentation.

This program is distributed in the hope that it will be useful,  but
WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
the GNU General Public License, version 2.0, for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software Foundation, Inc.,
51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA -->

# Authenticate a REST User

When executing CRUD operations on a REST object that requires authentication, one must first authenticate a REST user via the corresponding linked authentication app.

## MySQL Internal Authentication

In the case of a MySQL Internal auth app, the workflow is as follows. First the client must send the credentials to the `/login` path at the corresponding authentication endpoint, by omission `/${service}/authentication/login`. The client specifies the auth mechanism to use (cookie or bearer token). By default, the authentication mechanism used is based on a cookie.

Pattern:

    POST http://<HOST>:<PORT>/<ServiceAlias>/<AuthPath>/login
    {
        "username": "...",
        "password": "...",
        "authApp": "...",
        "sessionType": "cookie | bearer"
    }

If the client requests a cookie and the authentication succeeds, the MRS backend server immediately sends back a response containing the corresponding `Set-Cookie` header:

Example:

    curl -i -X POST -d \{\"username\":\"...\",\"password\":\"...\",\"authApp\":\"MySQL\",\"sessionType\":\"cookie\"} https://localhost:8000/mrs/authentication/login
    HTTP/1.1 200 Ok
    ...
    Set-Cookie: session_31000000000000000000000000000000=XXXXXXXXXXXXXXXXXXX; Path=/; SameSite=None; Secure; HttpOnly

If the client requests a bearer token, instead of the `Set-Cookie` header the response includes a JSON object in the body with an `accessToken` property whose value matches the generated JWT.

Example:

    curl -i POST -d \{\"username\":\"...\",\"password\":\"...\",\"authApp\":\"MySQL\",\"sessionType\":\"bearer\"\} "https://localhost:8443/mrs/authentication/login"
    HTTP/1.1 200 Ok
    ...
    Content-Type: application/json
    ...

    {"accessToken":"..."}

## MRS Authentication

In the case of an MRS auth app, the workflow follows a [SCRAM](https://datatracker.ietf.org/doc/html/rfc5802)-style negotiation. First the client must send the credentials to the authentication endpoint. In this case, instead of the original password, the client generates and sends the initial nonce (a random hex string). Similarly, the client also specifies the auth mechanism to use (cookie or bearer token). Then the MRS backend server sends back a response containing a JSON object in the body which includes the value of all variables required to calculate the SCRAM client proof.

Pattern:

    POST http://<HOST>:<PORT>/<ServiceAlias>/<AuthPath>/login
    {
        "username": "...",
        "nonce": "...",
        "authApp": "...",
        "sessionType": "cookie | bearer"
    }

    POST http://<HOST>:<PORT>/<ServiceAlias>/<AuthPath>/login
    {
        "clientProof": [...],
        "nonce": "...",
        "state": "response"
    }

Example:

    curl -i -X POST -d \{\"username\":\"...\",\"nonce\":\"...\",\"authApp\":\"MRS\",\"sessionType\":\"cookie\"} https://localhost:8000/mrs/authentication/login
    ...
    {"session":"...","iterations":5000,"nonce":"...","salt":[...]}

To finish the SCRAM negotiation, the client needs to calculate the corresponding client proof send another request to the same endpoint containing that value, alongside the server-generated nonce and an additional `state` flag set to `response`. If the authentication succeeds, the MRS backend server sends back a response containing the `Set-Cookie` header.

Example:

    curl -i -X POST -d \{\"clientProof\":[...],\"nonce\":\"...\",\"state\":\"response\"\} https://localhost:8000/mrs/authentication/login
    HTTP/1.1 200 Ok
    ...
    Set-Cookie: session_30000000000000000000000000000000=XXXXXXXXXXXXXXXXXXX; Path=/; SameSite=None; Secure; HttpOnly

If the client requests a bearer token instead, the process is exactly the same apart from the last step where, the backend server sends back a response containing JSON object in the body with an `accessToken` property whose value matches the generated JWT.

## OAuth

In the case of an OAuth auth app, an hypermedia client like a web-browser is required, because in the initial step, the client is redirected by the MRS backend server to the authentication web page of the actual auth provider (OCI, Google or Facebook). Currently, only cookie-based authentication is supported.

Example:

    curl -iG https://localhost:8443/mrs/authentication/login --data-urlencode 'authApp=Facebook'
    HTTP/1.1 307 Temporary Redirect
    ...
    Location: https://www.facebook.com/v12.0/dialog/oauth?response_type=code&state=first&client_id=XXXXXXXXXXXXX&redirect_uri=https://localhost:8443/mrs/authentication/login?authApp=Facebook

If the authentication succeeds, the auth provider redirects the client to the corresponding callback url sending the authorization code to the MRS backend server. The MRS backend server redirects the client to a different URL under its control and then sends back a response containing the `Set-Cookie` header.

Example:

    curl -i https://localhost:8443/mrs/authentication/login --data-urlencode 'access_token=YYYYYYYYYYYY' --data-urlencode 'redirect_url=https://localhost:8443/mrs/success'
    HTTP/1.1 307 Temporary Redirect
    ...
    Location: https://www.facebook.com/v12.0/dialog/oauth?response_type=code&state=first&client_id=XXXXXXXXXXXXX&redirect_uri=https://localhost:8443/mrs/authentication/login?authApp=Facebook


    curl -i https://localhost:8443/mrs/success
    HTTP/1.1 200 Ok
    ...
    Set-Cookie: session_32000000000000000000000000000000=XXXXXXXXXXXXXXXXXXX; Path=/; SameSite=None; Secure; HttpOnly

> The examples are for illustrative purposes only, the workflow is entirely handled by the hypermedia client (web browser).

## Executing CRUD Operations on a REST Object

Once the authentication succeeds, one can execute the CRUD operations enabled for a specific REST object that requires authentication, by including an additional header in the corresponding HTTP request. In the case of cookie-based authentication, the value of the `Set-Cookie` response header should be used in the `Cookie` request header.

Pattern:

    Cookie: <Set-Cookie>

Example:

    curl -H "Cookie: session_31000000000000000000000000000000=XXXXXXXXXXXXXXXXXXX; Path=/; SameSite=None; Secure; HttpOnly" https://localhost:8443/mrs/sakila/actor

In the case of token-based authentication, the JWT should be encoded in the `Authorization` request header as follows:

Pattern:

    Authorization: Bearer XXXXXXXXXXXXXXXXX

Example:

    curl -H "Authorization: Bearer XXXXXXXXXXXXXXXXX" https://localhost:8443/mrs/sakila/actor

### Full Workflow Example

In the worst-case scenario, when the user is not yet authenticated, executing a CRUD operation on a protected REST object requires two steps which should share some kind of state, i.e. either the cookie or the bearer token need to be saved somewhere in between.

When requesting a cookie, the value of the `Set-Cookie` header can be extracted using `curl`:

    $ cookie=$(curl -X POST -s -o /dev/null -w '%header{set-cookie}' -d \{\"username\":\"...\",\"password\":\"...\",\"authApp\":\"MySQL\",\"sessionType\":\"cookie\"\} "https://localhost:8443/mrs/authentication/login")
    $ curl -H "Cookie: $cookie" https://localhost:8443/mrs/sakila/actor

When requesting a bearer token, since the JWT is sent in a JSON object in the response body, it can be extracted using a tool like [`jq`](https://jqlang.org/):

    $ jwt=$(curl -X POST -s -d \{\"username\":\"...\",\"password\":\"...\",\"authApp\":\"MySQL\",\"sessionType\":\"bearer\"\} "https://localhost:8443/mrs/authentication/login" | jq -r .accessToken)
    $ curl -H "Authorization: Bearer $jwt" https://localhost:8443/mrs/sakila/actor
