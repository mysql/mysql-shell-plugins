#!/bin/bash
# Copyright (c) 2021, 2026, Oracle and/or its affiliates.

# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is designed to work with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have either included with
# the program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

# Init script for MySQL Shell MDS Plugin Compute Instances

# Update all packages to latest version
# sudo yum -y update

# Get latest repo from https://dev.mysql.com/downloads/repo/yum/ and install it
# wget -nc https://dev.mysql.com/get/mysql80-community-release-el7-3.noarch.rpm
# sudo yum -y localinstall mysql80-community-release-el7-3.noarch.rpm
# rm mysql80-community-release-el7-3.noarch.rpm

# Install MySQL Shell and MySQL Router
# sudo yum -y install mysql-shell mysql-router

sudo systemctl enable --now cockpit.socket

# Download and install current shell package
wget -nc https://dev.mysql.com/get/Downloads/MySQL-Shell/mysql-shell-9.4.0-1.el9.x86_64.rpm
sudo yum -y install mysql-shell-9.4.0-1.el9.x86_64.rpm
rm mysql-shell-9.4.0-1.el9.x86_64.rpm

# Download and install current router package
wget -nc https://dev.mysql.com/get/Downloads/MySQL-Router/mysql-router-community-9.4.0-1.el9.x86_64.rpm
sudo yum -y install mysql-router-community-9.4.0-1.el9.x86_64.rpm
rm mysql-router-community-9.4.0-1.el9.x86_64.rpm

# Get cloud plugin and install manually
mkdir -p /home/opc/.mysqlsh/plugins
cd /home/opc/.mysqlsh/plugins
wget -nc https://github.com/mysql/mysql-shell-plugins/archive/refs/heads/master.zip
unzip master.zip
mv ./mysql-shell-plugins-master/mds_plugin ./mds_plugin
mv ./mysql-shell-plugins-master/mrs_plugin ./mrs_plugin
mv ./mysql-shell-plugins-master/util_plugin ./util_plugin
rm -rf ./mrs_plugin # Remove MRS plugin for now
rm master.zip
rm -rf ./mysql-shell-plugins-master
chown -R opc:opc /home/opc/.mysqlsh

sudo mkdir -p /var/run/mysqlrouter/www/
echo '<!DOCTYPE html><title>.</title>' | sudo tee /var/run/mysqlrouter/www/index.html > /dev/null
sudo chown -R mysqlrouter:mysqlrouter /var/run/mysqlrouter/www/

# Install NGINX as reverse proxy
sudo dnf install nginx -y
sudo firewall-cmd --permanent --add-port={80/tcp,443/tcp}
sudo firewall-cmd --reload
sudo setsebool -P httpd_unified 1
sudo setsebool -P httpd_can_network_connect 1

# # Get the cert, install acme.sh
# sudo curl https://get.acme.sh  | sh -s   -- home /home/opc/.acme.sh
sudo curl -L https://raw.githubusercontent.com/acmesh-official/acme.sh/master/acme.sh | sh -s -- --home /home/opc/.acme.sh --install-online
chown -R opc:opc /home/opc/.acme.sh

# Write the config file /etc/nginx/conf.d/mrs.0bj.space.conf
# server {
#     listen 443 ssl http2;

#     server_name mrs.0bj.space;

#     ssl_certificate /etc/letsencrypt/live/mrs.0bj.space/fullchain.pem;
#     ssl_certificate_key /etc/letsencrypt/live/mrs.0bj.space/privkey.pem;

#     # Allow large attachments
#     client_max_body_size 128M;

#     location / {
#         proxy_pass http://127.0.0.1:8446;
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto $scheme;
#     }
# }

# Restart
# sudo systemctl start nginx

# Disable SSL in router config, restart
# sudo systemctl start mysqlrouter
