rem Copyright (c) 2020, 2022, Oracle and/or its affiliates.

call antlr4ts -no-visitor -Xexact-output-dir -o src/parsing/mysql/generated src/parsing/mysql/*.g4
call antlr4ts -no-visitor -Xexact-output-dir -o src/parsing/SQLite/generated src/parsing/SQLite/*.g4
call antlr4ts -no-visitor -Xexact-output-dir -o src/parsing/python/generated src/parsing/python/*.g4

echo "Fixing node module(s)..."
call powershell.exe -command "(Get-Content node_modules/react-scripts/lib/react-app.d.ts).Replace('/// <reference types=\"react-dom\" />', '') | Set-Content node_modules/react-scripts/lib/react-app.d.ts" 

SET NODE_OPTIONS=--max-old-space-size=8192
SET GENERATE_SOURCEMAP=false
react-app-rewired build

