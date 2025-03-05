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

# Application Metadata

Application-specific metadata can be attached to any MRS Resource (REST Service, Schema and/or Object).

## REST Services

Consider a REST Service, with custom metadata, created as follows:

```sql
    CREATE OR REPLACE REST SERVICE /myService
        METADATA {
          "type": "service"
        };
```

After generating the TypeScript SDK for this service, the custom metadata can be obtained as follows:

```TypeScript
    import { MyService } from "/path/to/sdk/myService"

    const myService = new MyService()

    const metadata = await myService.getMetadata()
    console.log(metadata) // { type: "service" }
```

If the REST Service does not contain custom metadata:

```sql
    CREATE OR REPLACE REST SERVICE /myService
```

The command returns an empty object:

```TypeScript
    import { MyService } from "/path/to/sdk/myService"

    const myService = new MyService()

    const metadata = await myService.getMetadata()
    console.log(metadata) // {}
```

## REST Schemas

Consider a MySQL database created as follows:

```sql
    CREATE DATABASE IF NOT EXISTS my_db;
```

and a corresponding REST Schema, with custom metadata, created as follows:

```sql
    CREATE OR REPLACE REST SCHEMA /myDb ON SERVICE /myService
        FROM `my_db`
        METADATA {
          "type": "schema"
        };
```

The custom metadata can be obtained as follows:

```TypeScript
    import { MyService } from "/path/to/sdk/myService"

    const myService = new MyService()

    const metadata = await myService.myDb.getMetadata()
    console.log(metadata) // { type: "schema" }
```

Just like for a REST Service, if a REST Schema does not specify custom metadata:

```sql
    CREATE OR REPLACE REST SCHEMA /myDb ON SERVICE /myService
        FROM `my_db`
```

The command returns an empty object:

```TypeScript
    import { MyService } from "/path/to/sdk/myService"

    const myService = new MyService()

    const metadata = await myService.myDb.getMetadata()
    console.log(metadata) // {}
```

If the REST Schema requires authentication:

```sql
    CREATE OR REPLACE REST SCHEMA /myDb ON SERVICE /myService
        FROM `my_db`
        AUTHENTICATION REQUIRED
        METADATA {
          "type": "schema"
        };

    CREATE USER foo IDENTIFIED BY 'bar';

    ALTER REST SERVICE /myService ADD AUTH APP "MySQL";
```

The command only succeeds if the client authenticates beforehand:

```TypeScript
    import { MyService } from "/path/to/sdk/myService"

    const myService = new MyService()

    await myService.authenticate({ username: "foo", password: "bar", app: "MySQL" })
    const metadata = await myService.myDb.getMetadata()
```

Otherwise, the command yields an authentication error:

```TypeScript
    import { MyService } from "/path/to/sdk/myService"

    const myService = new MyService()

    try {
        const metadata = await myService.myDb.getMetadata()
    } catch (err) {
        console.log(err) // Not authenticated. Please authenticate first before accessing the path /myService/myDb/_metadata.
    }
```

## REST Objects

Custom metadata can be specified for any kind of REST object, be it a `VIEW`, `FUNCTION`, `PROCEDURE` or `SCRIPT`.

As an example, consider any MySQL Table, such as one created as follows:

```sql
    CREATE TABLE IF NOT EXISTS my_table (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(3), PRIMARY KEY (id));
```

and a corresponding REST View, with custom metadata, created as follows:

```sql
    CREATE OR REPLACE REST VIEW /myTable ON SERVICE /myService SCHEMA /myDb
        AS `my_db`.`my_table` CLASS MyServiceMyDbMyTable {
            id: id @SORTABLE @KEY,
            name: name
        }
        METADATA {
            "type": "table"
        };
```

The custom metadata can be obtained as follows:

```TypeScript
    import { MyService } from "/path/to/sdk/myService"

    const myService = new MyService()

    const metadata = await myService.myDb.myTable.getMetadata()
    console.log(metadata) // { type: "table" }
```

Just like for a REST Service and Schema, if the REST View does not specify custom metadata:

```sql
    CREATE OR REPLACE REST VIEW /myTable ON SERVICE /myService SCHEMA /myDb
        AS `my_db`.`my_table` CLASS MyServiceMyDbMyTable {
            id: id @SORTABLE @KEY,
            name: name
        };
```

The command returns an empty object:

```TypeScript
    import { MyService } from "/path/to/sdk/myService"

    const myService = new MyService()

    const metadata = await myService.myDb.myTable.getMetadata()
    console.log(metadata) // {}
```

If the REST View requires authentication:

```sql
    CREATE OR REPLACE REST VIEW /myTable ON SERVICE /myService SCHEMA /myDb
        AS `my_db`.`my_table` CLASS MyServiceMyDbMyTable {
            id: id @SORTABLE @KEY,
            name: name
        }
        AUTHENTICATION REQUIRED
        METADATA {
            "type": "table"
        };
```

Just like for a REST Schema, the command only succeeds if the client authenticates beforehand:

```TypeScript
    import { MyService } from "/path/to/sdk/myService"

    const myService = new MyService()

    await myService.authenticate({ username: "foo", password: "bar", app: "MySQL" })
    const metadata = await myService.myDb.myTable.getMetadata()
    console.log(metadata) // { type: "table" }
```

Otherwise, the command yields an authentication error:

```TypeScript
    import { MyService } from "/path/to/sdk/myService"

    const myService = new MyService()

    try {
        const metadata = await myService.myDb.myTable.getMetadata()
    } catch (err) {
        console.log(err) // Not authenticated. Please authenticate first before accessing the path /myService/myDb/myTable/_metadata.
    }
```

