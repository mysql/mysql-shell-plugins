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
from mysqlsh.plugin_manager import general
from pathlib import Path
import os
from gui_plugin.core.lib import SystemUtils
import gui_plugin.core.Logger as logger
import platform
from cryptography import x509
from cryptography.hazmat import backends
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives.asymmetric import rsa
import datetime
from gui_plugin.core.lib.certs import locations


def get_cert_path():
    return general.get_shell_user_dir("plugin_data", "gui_plugin", "web_certs", "rootCA.crt")


def create_certificate(cert_path):
    """Creates a certificate and related files

    Args:
        cert_path (str): The path the certificate and related files should
            be created in

    Returns:
       The output of the process
    """

    try:
        # ----------------------------------------------------
        # Attributes to be used on the certificate generation
        # ----------------------------------------------------
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, u"US"),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, u"Texas"),
            x509.NameAttribute(NameOID.LOCALITY_NAME, u"Austin"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, u"Oracle"),
            x509.NameAttribute(
                NameOID.ORGANIZATIONAL_UNIT_NAME, u"MySQL"),
            x509.NameAttribute(NameOID.EMAIL_ADDRESS,
                               u"support@mysql.com"),
            x509.NameAttribute(NameOID.COMMON_NAME,
                               u"MySQL Shell Auto Generated CA Certificate"),
        ])

        today = datetime.datetime.today()
        one_day = datetime.timedelta(1, 0, 0)

        # Default validity for the certificates is 10 years
        validity = one_day * 365 * 10

        # In macOS TLS server certificates must have a validity period of 825
        # days or fewer: to be set as today + validity
        if platform.system() == "Darwin":
            validity = one_day * 824

        # ---------------------------------------------
        # Generation of the Private Key for the Root CA
        # ---------------------------------------------
        ca_private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=backends.default_backend())

        # --------------------------------
        # Generation of the CA certificate
        # --------------------------------
        from cryptography.hazmat.primitives import hashes

        ca_public_key = ca_private_key.public_key()
        ca_builder = x509.CertificateBuilder()
        ca_builder = ca_builder.subject_name(subject)
        ca_builder = ca_builder.issuer_name(issuer)
        ca_builder = ca_builder.not_valid_before(today - one_day)
        ca_builder = ca_builder.not_valid_after(today + validity)
        ca_builder = ca_builder.serial_number(x509.random_serial_number())
        ca_builder = ca_builder.public_key(ca_public_key)

        # CA should be True in order enable registration in Firefox
        ca_builder = ca_builder.add_extension(
            x509.BasicConstraints(ca=True, path_length=None), critical=False)

        ca_builder = ca_builder.add_extension(
            x509.SubjectAlternativeName(
                [x509.DNSName(u'localhost')]
            ),
            critical=False
        )

        # Signs the CA certificate and creates the file
        ca_cert = ca_builder.sign(
            private_key=ca_private_key, algorithm=hashes.SHA256(),
            backend=backends.default_backend()
        )

        # Serialization of the root CA certificate
        from cryptography.hazmat.primitives import serialization
        root_ca_path = os.path.join(cert_path, "rootCA.crt")
        with open(root_ca_path, "wb") as f:
            f.write(ca_cert.public_bytes(serialization.Encoding.PEM))

        # --------------------------------
        # Server Key
        # --------------------------------
        server_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=backends.default_backend())

        # cSpell:ignore PKCS
        # Serialization of the Private Key
        pem = server_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )

        server_key_path = os.path.join(cert_path, "server.key")
        with open(server_key_path, 'wb') as pem_out:
            pem_out.write(pem)

        # ------------------
        # Server Certificate
        # ------------------
        cert_subject = x509.Name([
            x509.NameAttribute(NameOID.COUNTRY_NAME, u"US"),
            x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, u"Texas"),
            x509.NameAttribute(NameOID.LOCALITY_NAME, u"Austin"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, u"Oracle"),
            x509.NameAttribute(
                NameOID.ORGANIZATIONAL_UNIT_NAME, u"MySQL"),
            x509.NameAttribute(NameOID.EMAIL_ADDRESS,
                               u"support@mysql.com"),
            x509.NameAttribute(NameOID.COMMON_NAME, u"localhost"),
        ])
        server_public_key = server_key.public_key()
        builder = x509.CertificateBuilder()
        builder = builder.issuer_name(ca_cert.issuer)

        builder = builder.subject_name(cert_subject)
        builder = builder.not_valid_before(today - one_day)
        builder = builder.not_valid_after(today + validity)

        builder = builder.add_extension(
            x509.SubjectAlternativeName(
                [x509.DNSName(u'localhost')]
            ),
            critical=False
        )

        builder = builder.serial_number(x509.random_serial_number())
        builder = builder.public_key(server_public_key)
        builder = builder.add_extension(
            x509.BasicConstraints(
                ca=False, path_length=None), critical=False)

        # Sets the CA Authority for the server cert using the CA Key
        authority_key = x509.AuthorityKeyIdentifier.from_issuer_public_key(
            ca_public_key)
        builder = builder.add_extension(authority_key, critical=False)

        # Defines the use cases for the server certificate
        key_usage = x509.KeyUsage(digital_signature=True, key_encipherment=True, key_cert_sign=False,
                                  key_agreement=False, content_commitment=True, data_encipherment=True,
                                  crl_sign=False, encipher_only=False, decipher_only=False)
        builder = builder.add_extension(key_usage, critical=False)

        builder = builder.add_extension(
            x509.ExtendedKeyUsage([x509.oid.ExtendedKeyUsageOID.SERVER_AUTH]), critical=False
        )

        # Signs the server certificate using the CA private key
        certificate = builder.sign(
            private_key=ca_private_key, algorithm=hashes.SHA256(), backend=backends.default_backend())

        # Serialization of the Server Certificate
        server_crt_path = os.path.join(cert_path, "server.crt")
        with open(server_crt_path, "wb") as f:
            f.write(certificate.public_bytes(serialization.Encoding.PEM))

    except Exception as e:
        logger.exception(e)
        return False

    return True


def delete_certificate(cert_path):
    try:
        os.remove(os.path.join(cert_path, "rootCA.crt"))
        os.remove(os.path.join(cert_path, "server.crt"))
        os.remove(os.path.join(cert_path, "server.key"))
    except Exception as e:
        logger.exception(e)
        return False
    return True


def linux_has_certutil():
    exit_code, output = SystemUtils.run_system_command(['which', 'certutil'])
    return exit_code == 0


BOLD = "\\033[1m"
NOBOLD = "\\033[0m"


def create_certificate_script(type, certs):
    installing = type == "install"
    cert_path = general.get_shell_user_dir(
        "plugin_data", "gui_plugin", "web_certs")

    script_path = os.path.join(cert_path, f'{type}.sh')
    script_sections = []
    script_actions = []

    for r in certs:
        requirements = r.requirements
        if not requirements is None:
            for req in requirements:
                if not req.met:
                    script_actions.append(f'echo "  - {req.desc}"')

    if len(script_actions):
        script_actions.insert(
            0, 'echo "- Install the following requirements:"')

    # Add the required removal operations
    uninstall_message = 'echo "- Remove the MySQL Shell GUI certificate from the following locations:"'
    for r in certs:
        if r.installed and (not installing or not r.valid or r.deprecated):
            if len(uninstall_message):
                script_actions.append(uninstall_message)
                uninstall_message = ""
            script_sections.append(r.get_uninstall_script(4))
            script_actions.append(f'echo "  - {r.desc}"')

    # Add the required install operations
    if installing:
        install_message = 'echo "- Install the MySQL Shell GUI certificate at the following locations:"'
        for i in certs:
            if not i.deprecated and (not i.installed or not i.valid):
                if len(install_message):
                    script_actions.append(install_message)
                    install_message = ""
                script_sections.append(i.get_install_script(4))
                script_actions.append(f'echo "* - {i.desc}"')

    if len(script_sections):
        str_script_actions = "\n".join(script_actions)
        exit_code, output = SystemUtils.run_system_command(['which', 'bash'])
        script_sections.insert(0, f"""#!{output}
echo "The MySQL Shell Web Root Certificate required by the MySQL for VS Code extension will now be {type}ed on your system."
echo -e "\\n"

echo -e "The following script will be executed. Some operations will require the {BOLD}sudo password{NOBOLD} , please review at your own discretion:"
echo -e "\\n"
echo "    {script_path}"
echo -e "\\n"

echo "The script will perform the following operations:"
echo -e "\\n"
{str_script_actions}
echo -e "\\n"

read -r -p "Do you want to continue [Y/n] ? " response
response=${{response,,}} # tolower

if [[ $response =~ ^(yes|y| ) ]] || [[ -z $response ]]; then""")

    if len(script_sections):
        script_sections.append(f"""
else
    echo "Cancelled..."
    exit 1
fi
echo -e "{BOLD}Certificate has been {type}ed successfully!{NOBOLD}"
read -r -p "Press any key to continue..." response
exit 0
""")

    return "\n".join(script_sections)


def get_required_locations(include_keychain):
    user_home_cert = locations.User_home()
    cert_locations = [user_home_cert]

    if include_keychain:
        os_type = SystemUtils.get_os_type()
        if os_type == "darwin":
            cert_locations.append(locations.Macos(user_home_cert))
        elif os_type == "windows" or SystemUtils.is_wsl():
            cert_locations.append(locations.Win(user_home_cert))
        elif os_type in ["debian", "fedora", "suse opensuse"]:
            cert_locations.append(locations.Nss_db_cert(user_home_cert))

            # Add deprecated certificates for a successful uninstall
            if os_type == "fedora":
                cert_locations.append(locations.Trust(
                    user_home_cert, deprecated=True))
            else:
                ca_cert = locations.Ca_cert_folder(
                    user_home_cert, deprecated=True)
                cert_locations.append(ca_cert)
                cert_locations.append(
                    locations.Ssl_cert_folder(ca_cert, deprecated=True))

    return cert_locations


def _log_certificate_operations(context, certs):
    if len(certs):
        log_text = []
        log_text.append(context)
        for c in certs:
            log_text.append(f" - {str(c)}")
        logger.info("\n".join(log_text))


def remove():
    required_certs = get_required_locations(True)
    return reset_deployment(required_certs, "uninstall")


def reset_deployment(certs, type):
    installing = type == "install"
    # Identify if any of the locations is scripted
    scripted = False
    for cert_location in certs:
        if cert_location.scripted:
            deprecated = cert_location.deprecated
            installed = cert_location.installed
            valid = cert_location.valid

            if installing and ((installed and deprecated) or (not deprecated and (not installed or not valid))):
                scripted = True
            elif not installing and installed:
                scripted = True

    # If any of the locations was scripted, all of the install is done through a script
    if scripted:
        script = create_certificate_script(type, certs)
        cert_path = general.get_shell_user_dir(
            "plugin_data", "gui_plugin", "web_certs")

        Path(cert_path).mkdir(parents=True, exist_ok=True)

        script_path = os.path.join(cert_path, f'{type}.sh')

        # Save the script
        with open(script_path, 'w') as file:
            file.write(script)

        # Make the script executable
        SystemUtils.run_system_command(['chmod', 'u+x', script_path])

        terminal_error = None
        cmd = None
        try:
            cmd = SystemUtils.get_terminal_command() + [script_path]

            exit_code, output = SystemUtils.run_shell_cmd(cmd)
            if not exit_code is None:
                raise SystemError(output)
        except Exception as e:
            logger.error(e)
            terminal_error = f"Could not {type} the Shell GUI certificate. Please execute '{script_path}' to install it manually"

            if SystemUtils.in_vs_code():
                terminal_error += ' and restart Visual Studio Code.'
            else:
                terminal_error += '.'

        if not terminal_error is None:
            raise Exception(terminal_error)
    # If none of the locations was scripted, then executes individual operations
    else:
        for cert_location in certs:
            if not cert_location.scripted:
                while cert_location.installed and (not installing or not cert_location.valid or cert_location.deprecated):
                    cert_location.uninstall()

        if installing:
            for cert_location in certs:
                if not cert_location.scripted and not cert_location.deprecated and (not cert_location.installed or not cert_location.valid):
                    cert_location.install()

    return True


def get_availability(check_keychain):
    """
    This function verifies the certificate availability on the places required for each platform.

    Returns:
        A list of tuples (ID, Availability) indicating whether the certificate is installed
    """
    certs = get_required_locations(check_keychain)

    # In the precense of deprecated certificates, returns
    deprecated = sum(c.installed and c.deprecated for c in certs)
    if deprecated > 0:
        return certs

    # Counts number of required certs
    required = sum(not c.deprecated for c in certs)

    # Counts number of installed locations
    count = sum(c.installed and not c.deprecated for c in certs)

    if count == 0:
        return False
    elif count == required:
        count = sum(c.valid and not c.deprecated for c in certs)
        if count == required:
            return True

    return certs
