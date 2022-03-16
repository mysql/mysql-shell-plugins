# Copyright (c) 2022, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is also distributed with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have included with MySQL.
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
import mysqlsh.plugin_manager.general
from pathlib import Path
import os
from .SystemUtils import run_system_command, get_os_name


def create_certificate_installer():
    cert_path = mysqlsh.plugin_manager.general.get_shell_user_dir(
        "plugin_data", "gui_plugin", "web_certs")

    root_ca_path = os.path.join(cert_path, 'rootCA.crt')
    install_cert_path = os.path.join(cert_path, 'install.sh')
    cert_copy_path = "/usr/local/share/ca-certificates/rootCA.crt"
    cert_link_path = "/etc/ssl/certs/rootCA.pem"
    bold = "\\033[1m"
    nobold = "\\033[0m"

    exit_code, output = run_system_command(['which', 'bash'])
    script = f"""#!{output}
echo "The MySQL Shell Web Root Certificate required by the MySQL for VS Code extension will now be installed on your system."
echo -e "\\n"

echo -e "The following script will be executed. Some operations will require the {bold}sudo password{nobold} , please review at your own discretion:"
echo -e "\\n"
echo "    {install_cert_path}"
echo -e "\\n"

read -r -p "Do you want to continue [Y/n] ? " response
response=${{response,,}} # tolower

if [[ $response =~ ^(yes|y| ) ]] || [[ -z $response ]]; then"""

    os_name = get_os_name()

    if os_name in ["OracleLinux", "RedHat", "Fedora"]:
        script += f"""
    # Install the certificate
    sudo trust anchor {root_ca_path}
    
    if [ "$?" != "0" ]; then
        echo "Failed installing the certificate"
        read -r -p "Press any key to continue..." response
        exit 1
    fi
    """
    else:
        cert_util_package = "unknown"
        if os_name in ["Ubuntu", "Debian"]:
            cert_util_package = "libnss3-tools"
        elif os_name == "OpenSUSE":
            cert_util_package = "mozilla-nss-tools"

        exit_code, output = run_system_command(['which', 'certutil'])
        if exit_code != 0:
            script += f"""
    # The certutil is required to install the UI certificate
    echo "Installing the certificate management utility: {cert_util_package}"
"""
            if os_name in ["Ubuntu", "Debian"]:
                script += "    sudo apt install libnss3-tools"
            elif os_name == "OpenSUSE":
                script += "    zypper install mozilla-nss-tools"
            # TODO(rennox): How to handle other platforms??

            script += f"""

    if [ "$?" != "0" ]; then
        echo "Failed installing {cert_util_package}"
        read -r -p "Press any key to continue..." response
        exit 1
    fi
"""
        home_dir = Path.home()
        if not home_dir:
            raise Exception("No home directory set")

        cert_db_path = os.path.join(home_dir, ".pki", "nssdb")

        script += f"""
    # Verifying the user certificate database...
    echo "Verifying existence of the NSS database..."
    certutil -d {cert_db_path} -L &> /dev/null
    if [ "$?" != "0" ]; then
        echo "The NSS database does not exist, creating it..."

        mkdir -p {cert_db_path}
        certutil -d {cert_db_path} -N --empty-password

        if [ "$?" != "0" ]; then
            echo "Failed initializing the NSS database"
            read -r -p "Press any key to continue..." response
            exit 1
        fi
    fi

    echo -e "\\n"
    echo "Registering the certificate on the system includes:"
    echo -e "\\n"
    echo "- Registering the certificate on the NSS database"
    echo "- Copying the certificate to {cert_copy_path}"
    echo "- Updating the system certificates (update-ca-certificates): which will create a symlink at {cert_link_path}"
    echo -e "\\n"

    echo -e "{bold}Registering the certificate on the NSS database...{nobold}"
    certutil -d sql:{cert_db_path} -A -t "C,," -n "MySQL Shell" -i {root_ca_path}

    if [ "$?" != "0" ]; then
        echo "Failed registering the certificate on the NSS database"
        read -r -p "Press any key to continue..." response
        exit 1
    fi

    # Install the UI certificate on the system
    echo -e "{bold}Copying the certificate to: {cert_copy_path}{nobold}"
    sudo cp {root_ca_path} {cert_copy_path}
    if [ "$?" != "0" ]; then
        echo "Failed copying the certificate..."
        read -r -p "Press any key to continue..." response
        exit 1
    fi

    echo -e "{bold}Updating the system certificates (update-ca-certificates)...{nobold}"
    sudo update-ca-certificates
    if [ "$?" != "0" ]; then
        echo "Failed updating the system certificates"
        read -r -p "Press any key to continue..." response
        exit 1
    fi"""

    script += f"""
else
    echo "Cancelled..."
    exit 1
fi
echo -e "{bold}Certificate has been installed successfully!{nobold}"
read -r -p "Press any key to continue..." response
exit 0
"""

    # Save the script
    with open(install_cert_path, 'w') as file:
        file.write(script)
        # file.write('\n'.join(lines))

    # Make the script executable
    run_system_command(['chmod', 'u+x', install_cert_path])

    return install_cert_path


def create_certificate_uninstaller():
    cert_path = mysqlsh.plugin_manager.general.get_shell_user_dir(
        "plugin_data", "gui_plugin", "web_certs")

    uninstall_cert_path = os.path.join(cert_path, 'uninstall.sh')
    root_ca_path = os.path.join(cert_path, 'rootCA.crt')
    bold = "\\033[1m"
    nobold = "\\033[0m"

    exit_code, output = run_system_command(['which', 'bash'])
    script = f"""#!{output}
echo "The MySQL Shell Web Root Certificate required by the MySQL for VS Code extension will now be uninstalled on your system."
echo -e "\\n"

echo -e "The following script will be executed. Some operations will require the {bold}sudo password{nobold}, please review at your own discretion:"
echo -e "\\n"
echo "    {uninstall_cert_path}"
echo -e "\\n"

read -r -p "Do you want to continue [Y/n] ? " response
response=${{response,,}} # tolower

if [[ $response =~ ^(yes|y| ) ]] || [[ -z $response ]]; then"""

    os_name = get_os_name()

    if os_name in ["OracleLinux", "RedHat", "Fedora"]:
        script += f"""
    # Uninstall the certificate
    sudo trust anchor --remove {root_ca_path}
    
    if [ "$?" != "0" ]; then
        echo "Failed removing the certificate"
        read -r -p "Press any key to continue..." response
        exit 1
    fi
    """
    else:
        home_dir = Path.home()
        if not home_dir:
            raise Exception("No home directory set")

        cert_db_path = os.path.join(home_dir, ".pki", "nssdb")

        cert_copy_path = "/usr/local/share/ca-certificates/rootCA.crt"
        cert_link_path = "/etc/ssl/certs/rootCA.pem"

        script += f"""

    echo -e "\\n"
    echo "Removing the certificate from the system includes:"
    echo -e "\\n"
    echo "- Removing the certificate from the NSS database"
    echo "- Removing the copy of the certificate from {cert_copy_path}"
    echo "- Removing the link to the certificate from {cert_link_path}"
    echo "- Updating the system certificates"
    echo -e "\\n"

    # Removing the certificate from the NSS database
    certutil -d {cert_db_path} -L -n "MySQL Shell" &> /dev/null
    if [ "$?" != "0" ]; then
        echo "The certificate does not exist on the NSS database"
    else
        echo -e "{bold}Removing the certificate from the NSS database{nobold}"
        certutil -d sql:{cert_db_path} -D -n "MySQL Shell"

        if [ "$?" != "0" ]; then
            echo "Failed removing the certificate from the NSS database"
            read -r -p "Press any key to continue..." response
            exit 1
        fi
    fi

    # Removing the certificate copy
    if [ -e {cert_copy_path} ]; then
        echo -e "{bold}Removing the certificate copy at {cert_copy_path}{nobold}"
        sudo rm {cert_copy_path}
        if [ "$?" != "0" ]; then
            echo "Failed removing the certificate from the system"
            read -r -p "Press any key to continue..." response
            exit 1
        fi
    else
        echo "The certificate does not exist at {cert_copy_path}"
    fi

    # Removing the certificate link
    if [ -L {cert_link_path} ]; then
        sudo rm {cert_link_path}
        if [ "$?" != "0" ]; then
            echo "Failed removing the certificate from the system"
            read -r -p "Press any key to continue..." response
            exit 1
        fi

        echo -e "{bold}Updating the system certificates...{nobold}"
        sudo update-ca-certificates
        if [ "$?" != "0" ]; then
            echo "Failed updating the system certificates"
            read -r -p "Press any key to continue..." response
            exit 1
        fi
    else
        echo "The certificate link does not exist at {cert_link_path}"
    fi"""

    script += f"""
else
    echo "Cancelled..."
    exit 1
fi

echo -e "{bold}Certificate has been removed successfully!{nobold}"
read -r -p "Press any key to continue..." response
exit 0
"""

    # Save the script
    with open(uninstall_cert_path, 'w') as file:
        file.write(script)

    # Make the script executable
    run_system_command(['chmod', 'u+x', uninstall_cert_path])

    return uninstall_cert_path
