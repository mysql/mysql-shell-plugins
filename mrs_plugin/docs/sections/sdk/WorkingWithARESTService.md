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

# Working with a REST Service

The MRS SDK exposes a client API for a given REST Service in the scope of an MRS installation and supports the following programming languages:

  - TypeScript
  - Python

An constructor/initializer for the client-side REST service instance is generated based on the conventions established for the selected programming language. It allows to optionally specify the base URL of that REST service, has deployed in the MySQL Router instance used by the MRS installation. This would override the base URL specified when the SDK is generated in the first place, using the MySQL Shell.

```sh
mysqlsh -uroot --py --execute='mrs.dump.sdk_service_files(directory="/path/to/project/sdk", options={"service_url":"https://example.com/myService"})'
```

The initializer returns an objects that implements the interface described in the [API reference docs](#client-api-reference).

For a REST service available under the root path `/myService`, the corresponding client-side object can be created, on TypeScript, as follows:

```TypeScript
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService();
```

or, using a custom base URL:

```TypeScript
import { MyService } from './myService.mrs.sdk/myService';

const myService = new MyService("https://localhost:8443/myService");
```

Similarly, on Python, the client-side object can be created as follows:

```py
from sdk.my_service import *

my_service = MyService()
```

or, using a custom base URL:

```py
from sdk.my_service import *

my_service = MyService(base_url="https://localhost:8443/myService")
# or just
my_service = MyService("https://localhost:8443/myService")
```
