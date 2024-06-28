# Copyright (c) 2024, Oracle and/or its affiliates.

if (-not (Test-Path "node_modules/regedit/vbs")) {
    Write-Host "ERROR: The vbs in regedit is missing"
    exit 1
}

Write-Host "Copy vbs files for regedit operations"
Copy-Item -Path "node_modules/regedit/vbs" -Destination "out/vbs" -Recurse -Force

