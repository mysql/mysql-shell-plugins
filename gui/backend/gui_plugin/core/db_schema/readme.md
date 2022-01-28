### Copyright (c) 2020, 2021, Oracle and/or its affiliates.

# Converting SQL Create Script from MySQL Workbench to SQLite

Call the following shell command to convert all .mysql.sql files

```bash
mysqlsh --py --execute="gui.core.convert_all_gui_mysql_sql_files_to_sqlite()"
```

## Convert CREATE files

1. Copy only the part that contains the CREATE TABLE and CREATE INDEX commands
2. Copy only the part that contains the inserts
3. Perform the follow substitutions

### Remove ENGINE, VISIBLE, exchange INT, START

```sql
(\nENGINE = INNODB;) with ""
```

```sql
(\sVISIBLE) with ""
```

```sql
" INT " with " INTEGER "
```

```sql
"START " with "BEGIN "
```

### Exchange FKs

```sql
SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

with

PRAGMA foreign_keys = OFF;
```

```sql
SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;

with

PRAGMA foreign_keys = ON;
```

## Update ALTER files

```sql
" AFTER `*`" with ""
```

### Exchange

Exchange FKs like in `Convert CREATE files`
