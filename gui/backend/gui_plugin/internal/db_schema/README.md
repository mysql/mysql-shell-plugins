# Historical schema test fixtures

These version 0.0.11 schemas are used by `tests/unit/core/test_Db.py` to
exercise MySQL-to-SQLite conversion and upgrade an actual historical database
to the current schema.

They are restored (with the final extra blank line removed from the SQLite file)
from `gui/backend/gui_plugin/core/db_schema`
in upstream commit `b6f810335e4bbb6883cd14c51189156ec8acc64a`. The files were removed
in commit `79a099b9bb8162407a229cc75e9a0af35d149d66`, which changed the tests to
look in this directory. Keep the historical contents intact so the upgrade
test continues to exercise the complete migration chain.
