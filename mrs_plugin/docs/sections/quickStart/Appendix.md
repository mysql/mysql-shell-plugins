<!-- Copyright (c) 2022, 2025, Oracle and/or its affiliates.

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

# Quickstart Appendix

## Enabling MS Marketplace on VSCodium

In order to use extensions from the MS Marketplace on [VSCodium](https://vscodium.com/), a configuration file has to be created.

1. Open an editor of your choice and paste the following content.

    ```json
    {
        "nameShort": "Visual Studio Code",
        "nameLong": "Visual Studio Code",
        "extensionsGallery": {
            "serviceUrl": "https://marketplace.visualstudio.com/_apis/public/gallery",
            "cacheUrl": "https://vscode.blob.core.windows.net/gallery/index",
            "itemUrl": "https://marketplace.visualstudio.com/items"
        }
    }
    ```

2. Save the file at the following location.
   - MacOS: `$HOME/Library/Application Support/VSCodium/product.json`
   - Windows: `$HOME\AppData\Roaming\VSCodium\product.json`
3. Restart VSCodium.

> To revert to using VSCodium's default marketplace, simply delete the project.json file and restart VSCodium.
