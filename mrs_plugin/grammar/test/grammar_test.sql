/* MRS Grammar Test
Copyright (c) 2023, 2025, Oracle and/or its affiliates.*/

# cSpell:ignore gtid
CONFIGURE REST METADATA
    ENABLED
    UPDATE IF AVAILABLE;

CREATE OR REPLACE REST SERVICE localhost/myTestService;

CREATE OR REPLACE REST SERVICE mike@/myTestService;

CREATE OR REPLACE REST SERVICE mike@localhost/myTestService;

SHOW REST SERVICES;

DROP REST SERVICE mike@/myTestService;

DROP REST SERVICE mike@localhost/myTestService;

CREATE OR REPLACE REST SERVICE localhost/myTestService
    ENABLED
    COMMENTS "A simple REST service"
    AUTHENTICATION
        PATH "/authentication"
        REDIRECTION DEFAULT
        VALIDATION DEFAULT
        PAGE CONTENT DEFAULT
    OPTIONS {
        "headers": {
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Origin, X-Auth-Token",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS"
        },
        "http": {
            "allowedOrigin": "auto"
        },
        "logging": {
            "exceptions": true,
            "request": {
                "body": true,
                "headers": true
            },
            "response": {
                "body": true,
                "headers": true
            }
        },
        "returnInternalErrorDetails": true
    }
    METADATA {
        "position": 1
    };

CREATE OR REPLACE REST SERVICE localhost/myService;


SHOW CREATE REST SERVICE localhost/myTestService;

ALTER REST SERVICE localhost/myTestService
    NEW REQUEST PATH localhost/myAlteredTestService
    DISABLED
    COMMENTS "A real simple REST service"
    AUTHENTICATION
        PATH "/authentication2"
        REDIRECTION "/authReDir"
        VALIDATION "/authVal"
    OPTIONS {
        "logging": {
            "exceptions": true
        },
        "returnInternalErrorDetails": false
    }
    METADATA {
        "position": 2
    };

SHOW CREATE REST SERVICE localhost/myAlteredTestService;

ALTER REST SERVICE localhost/myAlteredTestService
    NEW REQUEST PATH localhost/myTestService;

CREATE REST SCHEMA ON SERVICE localhost/myTestService FROM `sakila`
    ENABLED
    AUTHENTICATION REQUIRED
    ITEMS PER PAGE 25
    COMMENTS "The sakila schema"
    METADATA { "position": 1};

USE REST SERVICE localhost/myTestService;

CREATE OR REPLACE REST SCHEMA /sakila FROM `sakila`
    DISABLED
    OPTIONS {
        "logging": {
            "exceptions": true
        },
        "returnInternalErrorDetails": false
    };

ALTER REST SCHEMA /sakila
    NEW REQUEST PATH /sakila2
    DISABLED;

ALTER REST SCHEMA /sakila2
    NEW REQUEST PATH /sakila;

USE REST SCHEMA /sakila;

CREATE OR REPLACE REST DATA MAPPING VIEW /city
AS `sakila`.`city`;

SHOW CREATE REST VIEW /city;

ALTER REST VIEW /city CLASS MyServiceSakilaCity2;

SHOW CREATE REST VIEW /city;

CREATE OR REPLACE REST DATA MAPPING VIEW /city
    AS sakila.city
    CLASS MyServiceSakilaCity {
        cityId: city_id,
        city: city,
        countryId: country_id,
        lastUpdate: last_update,
        address: sakila.address @UNNEST {
            address: address
        },
        country: sakila.country {
            countryId: country_id @SORTABLE,
            country: country
        }
    };

CREATE OR REPLACE REST DATA MAPPING VIEW /country
ON SERVICE localhost/myTestService SCHEMA /sakila
AS sakila.country CLASS MyServiceSakilaCountry @INSERT @UPDATE @DELETE @NOCHECK {
    countryId: country_id @SORTABLE,
    country: country,
    lastUpdate: last_update,
    cities: sakila.city {
        city: city
    }
}
ENABLED
AUTHENTICATION REQUIRED
ITEMS PER PAGE 25
COMMENTS "The sakila.country table"
MEDIA TYPE "Test"
FORMAT FEED
AUTHENTICATION PROCEDURE sakila.auth_proc;

CREATE OR REPLACE REST DATA MAPPING VIEW /actor
AS `sakila`.`actor` CLASS MyServiceSakilaActor {
    actorId: actor_id @SORTABLE,
    firstName: first_name,
    lastName: last_name,
    lastUpdate: last_update,
    filmActor: sakila.film_actor @UNNEST {
        film: sakila.film @UNNEST {
            title: title
        }
    }
};

CREATE REST DATA MAPPING VIEW /actorInfo
AS `sakila`.`actor_info` CLASS MyServiceSakilaActorInfo {
    actorId: actor_id @SORTABLE,
    firstName: first_name,
    lastName: last_name,
    filmInfo: film_info
};

ALTER REST DATA MAPPING VIEW /actorInfo
ON SERVICE localhost/myTestService SCHEMA /sakila
DISABLED
OPTIONS {
    "option1": "this is option 1",
    "option2": {
        "option11": "this is option 1.1"
    }
}
FORMAT ITEM;

ALTER REST DATA MAPPING VIEW /actorInfo
NEW REQUEST PATH /actorInfo2
CLASS MyServiceSakilaActorInfoTest;

ALTER REST DATA MAPPING VIEW /actorInfo2
NEW REQUEST PATH /actorInfo;

SHOW CREATE REST VIEW /actorInfo;

ALTER REST DATA MAPPING VIEW /actorInfo
CLASS MyServiceSakilaActorInfoTest2 @UPDATE @INSERT @DELETE {
    actorId: actor_id @SORTABLE,
    firstName: first_name
}
DISABLED;

SHOW CREATE REST VIEW /actorInfo;

ALTER REST DATA MAPPING VIEW /actorInfo
CLASS MyServiceSakilaActorInfoTest5 {
    actorId: actor_id @SORTABLE,
    firstName: first_name
};

SHOW CREATE REST VIEW /actorInfo;

CREATE OR REPLACE REST PROCEDURE /filmInStock
AS sakila.film_in_stock
PARAMETERS MyServiceSakilaFilmInStockParams {
    pFilmId: p_film_id @IN,
    pStoreId: p_store_id @IN,
    pFilmCount: p_film_count @OUT
}
RESULT MyServiceSakilaFilmInStock {
    inventoryId: inventory_id @DATATYPE("int")
};

SHOW CREATE REST PROCEDURE /filmInStock;

ALTER REST PROCEDURE /filmInStock
ON SERVICE localhost/myTestService SCHEMA /sakila
PARAMETERS {
    pFilmId: p_film_id @IN,
    pStoreId: p_store_id @IN,
    pFilmCount: p_film_count @OUT
}
RESULT {
    inventoryId: inventory_id @DATATYPE("int")
}
RESULT {
    inventoryId2: inventory_id @DATATYPE("int")
};

SHOW CREATE REST PROCEDURE /filmInStock;

ALTER REST PROCEDURE /filmInStock
ON SERVICE localhost/myTestService SCHEMA /sakila
NEW REQUEST PATH /filmInStockUpdated
PARAMETERS MyServiceSakilaFilmInStockUpdated {
    pFilmId: p_film_id @IN,
    pStoreId: p_store_id @IN,
    pFilmCount: p_film_count @OUT
}
RESULT MyServiceSakilaFilmInStock {
    inventoryId: inventory_id @DATATYPE("int")
}
RESULT MyServiceSakilaFilmInStock2 {
    inventoryId2: inventory_id @DATATYPE("int")
};

SHOW CREATE REST PROCEDURE /filmInStockUpdated;

ALTER REST PROCEDURE /filmInStockUpdated
ON SERVICE localhost/myTestService SCHEMA /sakila
NEW REQUEST PATH /filmInStock
PARAMETERS MyServiceSakilaFilmInStockParams {
    pFilmId: p_film_id @IN,
    pStoreId: p_store_id @IN,
    pFilmCount: p_film_count @OUT
}
RESULT MyServiceSakilaFilmInStock {
    inventoryId: inventory_id @DATATYPE("int")
}
RESULT MyServiceSakilaFilmInStock2 {
    inventoryId2: inventory_id @DATATYPE("int")
};

SHOW CREATE REST PROCEDURE /filmInStock;

SHOW CREATE REST VIEW /country;
SHOW CREATE REST PROCEDURE /filmInStock;

CREATE REST CONTENT SET /testContent
ON SERVICE localhost/myTestService
FROM "./grammar/test"
IGNORE "*.txt";

SHOW REST CONTENT SETS;

SHOW REST METADATA STATUS;

SHOW REST SERVICES;

SHOW REST SCHEMAS;

SHOW REST DATA MAPPING VIEWS
    FROM SERVICE localhost/myTestService SCHEMA /sakila;

SHOW REST PROCEDURES;

SHOW CREATE REST SERVICE localhost/myTestService;

SHOW CREATE REST SCHEMA /sakila;

SHOW CREATE REST DATA MAPPING VIEW /actorInfo;

ALTER REST SCHEMA /sakila
ON SERVICE localhost/myTestService
NEW REQUEST PATH /sakila123;

SHOW REST SCHEMAS;

ALTER REST SCHEMA /sakila123
ON SERVICE localhost/myTestService
NEW REQUEST PATH /sakila;

SHOW REST SCHEMAS;

CREATE OR REPLACE REST AUTH APP "MRS" VENDOR MRS;

ALTER REST SERVICE localhost/myTestService
ADD AUTH APP "MRS";

CREATE REST USER "mike"@"MRS" IDENTIFIED BY "1234";
CREATE REST USER "mike2"@"MRS" IDENTIFIED BY "543243";
CREATE REST USER "boss"@"MRS" IDENTIFIED BY "secret" ACCOUNT LOCK OPTIONS {
    "email": "boss@example.com",
    "vendor_user_id": "vendor",
    "mapped_user_id": "vendorboss123",
    "other_option": false
} APP OPTIONS {"myoption": 12345};

ALTER REST USER "mike"@"MRS" IDENTIFIED BY "5678";

ALTER REST USER "mike"@"MRS" OPTIONS {
    "email": "mike@example.com",
    "vendor_user_id": "vendor2",
    "mapped_user_id": "vendormike123"
} APP OPTIONS {
    "anything": [32]
};

select * from mysql_rest_service_metadata.mrs_user;

CREATE OR REPLACE REST ROLE "role1";
CREATE OR REPLACE REST ROLE "role2" EXTENDS "role1";
-- should cascade and drop role1 and role2
-- DROP REST ROLE "role1";

-- CREATE REST ROLE "role1";
-- CREATE REST ROLE "role2" EXTENDS "role1";

CREATE REST ROLE "role3" EXTENDS "role1" ON SERVICE localhost/myTestService COMMENTS "A comment here" OPTIONS {"option1":1, "option2": false, "option3": [1, "bla", null]};

CREATE REST ROLE "myrole" ON SERVICE localhost/myService;

GRANT REST CREATE, READ, UPDATE, DELETE ON SERVICE localhost/myTestService SCHEMA /sakila TO "role1";
GRANT REST CREATE, READ, UPDATE, DELETE ON SERVICE localhost/myTestService SCHEMA /sakila OBJECT /country TO "role2";
GRANT REST UPDATE ON SERVICE localhost/myTestService SCHEMA /sakila OBJECT /filmInStock TO "role1";
GRANT REST READ ON SCHEMA /sakila OBJECT /actor TO "role2";

GRANT REST ROLE "role1" TO "mike"@"MRS" COMMENTS "Hello World!?";

SHOW REST GRANTS FOR "role1";
SHOW REST GRANTS FOR "role2";

SHOW REST ROLES FOR "mike"@"MRS";

REVOKE REST ROLE "role1" FROM "mike"@"MRS";

SHOW REST ROLES FOR "mike"@"MRS";

REVOKE REST CREATE ON SERVICE localhost/myTestService SCHEMA /sakila FROM "role1";

SHOW REST GRANTS FOR "role1";

SHOW REST ROLES;
SHOW REST ROLES ON SERVICE localhost/myTestService;

DROP REST ROLE "role3";
DROP REST ROLE "role2";
DROP REST ROLE "role1";

DROP REST USER "mike"@"MRS";

CREATE OR REPLACE REST AUTH APP "MySQL" VENDOR MySQL
ALLOW NEW USERS TO REGISTER
DEFAULT ROLE "Full Access";

ALTER REST SERVICE localhost/myTestService
ADD AUTH APP "MySQL";

SHOW REST AUTH APPS FROM SERVICE localhost/myTestService;

SHOW CREATE REST AUTH APP "MRS";

SHOW CREATE REST AUTH APP "MySQL";

ALTER REST SERVICE localhost/myTestService DISABLED;

DROP REST AUTH APP "MRS";

DROP REST AUTH APP "MySQL";

DROP REST DATA MAPPING VIEW /country
FROM SERVICE localhost/myTestService SCHEMA /sakila;

DROP REST DATA MAPPING VIEW /actor;

DROP REST DATA MAPPING VIEW /actorInfo;

DROP REST PROCEDURE /filmInStock;

DROP REST CONTENT SET /testContent;

CREATE OR REPLACE REST DATA MAPPING VIEW /moviesByLanguage
ON SERVICE localhost/myTestService SCHEMA /sakila
AS `sakila`.`language` {
    id: language_id,
    name: name,
    films: film {
        title: title
    }
};

DROP REST DATA MAPPING VIEW /moviesByLanguage;

CREATE REST FUNCTION /actorFunc
ON SERVICE localhost/myTestService SCHEMA /sakila
AS `sakila`.`actor`;

SHOW CREATE REST FUNCTION /actorFunc
ON SERVICE localhost/myTestService SCHEMA /sakila;

ALTER REST FUNCTION /actorFunc
ON SERVICE localhost/myTestService SCHEMA /sakila
NEW REQUEST PATH /actorFuncNew;

SHOW CREATE REST FUNCTION /actorFuncNew
ON SERVICE localhost/myTestService SCHEMA /sakila;

DROP REST FUNCTION /actorFuncNew;

CREATE OR REPLACE REST FUNCTION /actorFunc
    ON SERVICE localhost/myTestService SCHEMA /sakila
    AS sakila.actor
    PARAMETERS LocalhostMyServiceSakilaActorFuncParams {
        s: s @IN
    }
    RESULT LocalhostMyServiceSakilaActorFunc {
        result: result @DATATYPE("char")
    };

DROP REST FUNCTION /actorFunc;

DROP REST SCHEMA /sakila FROM localhost/myTestService;

DROP REST SERVICE localhost/myTestService;

SHOW REST SERVICES;




CREATE OR REPLACE REST SERVICE mike@/myTestService;

SHOW REST SERVICES;

CREATE OR REPLACE REST SERVICE mike@localhost:80/myTestService;

SHOW REST SERVICES;



CREATE OR REPLACE REST SERVICE miguel,'alfredo@oracle.com'@localhost:80/myTestService;

SHOW REST SERVICES;

ALTER REST SERVICE mike@/myTestService
    NEW REQUEST PATH mike,alfredo@/myTestService;

SHOW REST SERVICES;

ALTER REST SERVICE mike,alfredo@/myTestService
    NEW REQUEST PATH mike@/myTestService;

CLONE REST SERVICE mike@/myTestService
    NEW REQUEST PATH /myClonedService;

SHOW REST SERVICES;

DROP REST SERVICE /myClonedService;

DROP REST SERVICE mike@/myTestService;

DROP REST SERVICE mike@localhost:80/myTestService;


CREATE REST SCHEMA /sakila
ON SERVICE miguel,'alfredo@oracle.com'@localhost:80/myTestService
FROM `sakila`
    ENABLED
    AUTHENTICATION REQUIRED
    ITEMS PER PAGE 25
    COMMENTS "The sakila schema"
    METADATA { "position": 1};

CREATE OR REPLACE REST DATA MAPPING VIEW /actor
ON SERVICE miguel,'alfredo@oracle.com'@localhost:80/myTestService SCHEMA /sakila
AS `sakila`.`actor` CLASS MyServiceSakilaActor {
    actorId: actor_id @SORTABLE,
    firstName: first_name,
    lastName: last_name,
    lastUpdate: last_update,
    filmActor: sakila.film_actor @UNNEST {
        film: sakila.film @UNNEST {
            title: title
        }
    }
};

ALTER REST DATA MAPPING VIEW /actor
ON SERVICE miguel,'alfredo@oracle.com'@localhost:80/myTestService SCHEMA /sakila
OPTIONS {
    "option1": "this is option 1",
    "option2": {
        "option11": "this is option 1.1"
    }
};

CREATE REST CONTENT SET /mySet
ON SERVICE miguel,'alfredo@oracle.com'@localhost:80/myTestService;

CREATE REST CONTENT FILE "/textFile"
ON SERVICE miguel,'alfredo@oracle.com'@localhost:80/myTestService CONTENT SET /mySet
CONTENT "normal string";

CREATE REST CONTENT FILE "/binaryFile1"
ON SERVICE miguel,'alfredo@oracle.com'@localhost:80/myTestService CONTENT SET /mySet
BINARY CONTENT "aHR0cHM6Ly93d3cuYmFzZTY0ZW5jb2RlLm9yZy8gVGVzdA==";

CREATE REST CONTENT FILE "/binaryFile2"
ON SERVICE miguel,'alfredo@oracle.com'@localhost:80/myTestService CONTENT SET /mySet
BINARY CONTENT "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";

CREATE REST CONTENT FILE "/binaryFile3"
ON SERVICE miguel,'alfredo@oracle.com'@localhost:80/myTestService CONTENT SET /mySet
BINARY CONTENT "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";

CREATE REST CONTENT FILE "/binaryFile4"
ON SERVICE miguel,'alfredo@oracle.com'@localhost:80/myTestService CONTENT SET /mySet
FROM "grammar/test/binary_test_file";

CREATE REST CONTENT FILE "/binaryFile5"
ON SERVICE miguel,'alfredo@oracle.com'@localhost:80/myTestService CONTENT SET /mySet
FROM "grammar/test/text_test_file.sql";


DROP REST CONTENT FILE "/textFile"
FROM SERVICE miguel,'alfredo@oracle.com'@localhost:80/myTestService CONTENT SET /mySet;

DROP REST CONTENT FILE "/binaryFile1"
FROM SERVICE miguel,'alfredo@oracle.com'@localhost:80/myTestService CONTENT SET /mySet;

DROP REST CONTENT SET /mySet
FROM SERVICE miguel,'alfredo@oracle.com'@localhost:80/myTestService;

ALTER REST SERVICE miguel,'alfredo@oracle.com'@localhost:80/myTestService
    PUBLISHED;

DROP REST SERVICE miguel,'alfredo@oracle.com'@localhost:80/myTestService;



CREATE OR REPLACE REST SERVICE /myTest;

CREATE OR REPLACE REST SCHEMA /test ON SERVICE /myTest FROM `test`;

CREATE OR REPLACE REST DATA MAPPING VIEW /t1
ON SERVICE /myTest SCHEMA /test
AS `test`.`t1` {
    c1: c1,
    c2: c2,
    c3: c3,
    info: info JSON SCHEMA {
        "id": "https://dev.mysql.com/mrs/test/test.t1/info",
        "type": "object",
        "properties": {
            "friends": {
                "type": "array",
                "items": {
                    "type": "string"
                },
                "minItems": 1,
                "uniqueItems": true
            },
            "nickName": {
            "type": "string"
            }
        },
        "required": [ "friends" ]
    },
    data: data JSON SCHEMA {
        "id": "https://dev.mysql.com/mrs/test/test.t1/data",
        "type": "object",
        "properties": {
            "hobbies": {
                "type": "array",
                "items": {
                    "type": "string"
                },
                "minItems": 0,
                "uniqueItems": true
            },
            "height": {
                "type": "number"
            }
        },
        "required": [ "height" ]
    }
};

DROP REST SERVICE /myTest;