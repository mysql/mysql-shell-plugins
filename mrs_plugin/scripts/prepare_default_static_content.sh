#!/bin/bash
# Copyright (c) 2024, 2025, Oracle and/or its affiliates.

# Requires html-minifier-terser to be installed
# sudo npm install html-minifier-terser -g

if [ $# -eq 0 ]
then
    ROOTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )/.."
else
    ROOTPATH=$1
fi

cd $ROOTPATH/db_schema/mysql_rest_service_metadata.msm.project/development/default_static_content

echo "Preparing default static content ..."

echo "Minify and convert to Base64 ..."

# Minify HTML, CSS and JS code
html-minifier-terser --remove-comments --collapse-whitespace --minify-css --minify-js -o index.min.html index.html
# Remove double spaces in html`` strings
sed -i '' 's/  */ /g' index.min.html
# Remove all linebreaks
tr -d '\n' < index.min.html > index.min.nr.html
# Endcode to base64
base64 -i index.min.nr.html -o index.html.b64

base64 -i favicon.ico -o favicon.ico.b64
base64 -i favicon.svg -o favicon.svg.b64
base64 -i sakila.svg -o sakila.svg.b64
base64 -i standalone-preact.js -o standalone-preact.js.b64

echo "Building insert.sql and config.data.json ..."

export indexHtmlB64=$(cat index.html.b64)
export faviconIcoB64=$(cat favicon.ico.b64)
export faviconSvgB64=$(cat favicon.svg.b64)
export sakilaSvgB64=$(cat sakila.svg.b64)
export standalonePreactJsB64=$(cat standalone-preact.js.b64)

envsubst < insert.template.sql > ../sections/140-40_default_static_content.sql
envsubst < config.data.template.json > config.data.json

echo "Perform cleanup ..."

# Cleanup
rm index.min.html
rm index.min.nr.html
rm index.html.b64

rm favicon.ico.b64
rm favicon.svg.b64
rm sakila.svg.b64
rm standalone-preact.js.b64

echo "Files generated."
