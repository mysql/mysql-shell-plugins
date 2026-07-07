@rem Copyright (c) 2026, Oracle and/or its affiliates.
@rem
@rem This program is free software; you can redistribute it and/or modify
@rem it under the terms of the GNU General Public License, version 2.0,
@rem as published by the Free Software Foundation.
@echo off
setlocal
mysqlsh.exe --py -f "%~dp0task-helper" %*
exit /b %ERRORLEVEL%
