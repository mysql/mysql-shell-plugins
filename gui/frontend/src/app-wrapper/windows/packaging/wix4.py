 #!/usr/bin/env python
 #
 # Copyright (c) 2025, Oracle and/or its affiliates.
 #
 # This program is free software; you can redistribute it and/or modify
 # it under the terms of the GNU General Public License, version 2.0,
 # as published by the Free Software Foundation.
 #
 # This program is designed to work with certain software (including
 # but not limited to OpenSSL) that is licensed under separate terms,
 # as designated in a particular file or component or in included license
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
 #

import argparse
import hashlib
import glob
import json
import os
import os.path
import shutil
import string
import subprocess
import sys
import uuid
import xml.etree.ElementTree as ET

def log(msg):
    sys.stderr.write(f"WIX4: {msg}\n")
    sys.stderr.flush()

def run_process(*args, cwd=None, ignore_exit_code=False):
    try:
        return subprocess.check_output([*args], stderr=subprocess.STDOUT, cwd=cwd).decode("ascii").strip()
    except subprocess.CalledProcessError as e:
        if ignore_exit_code:
            return ""

        log(f"Failed to execute [{' '.join(args)}]: {e.output.decode('ascii').strip()}")
        raise

def check_preconditions():
    for exe in [ "dotnet", "cmake", "cpack" ]:
        try:
            log(f"{exe}: {run_process(exe, '--version')}")
        except:
            log(f"Could not execute '{exe}'")
            raise

def safe_path(path):
     return path.replace("\\", "/")

def guid():
    return str(uuid.uuid4()).upper()

def execute(l, status, failure, *args):
    try:
        log(status + "...")
        l(*args)
    except:
        log(failure)
        raise

def split_path(path):
    return safe_path(path).split("/")

class Rtf_file():
    def __init__(self, path):
        self.__fh = open(path, "wb")
        self.__start_group()
        self.__write_header()
        self.__write_document_prefix()

    def __del__(self):
        self.__end_group()
        self.__fh.write(b"\r\n\0")
        self.__fh.close()

    def __control_word(self, word):
        self.__fh.write(b"\\")
        self.__fh.write(word)

    def __start_group(self):
        self.__fh.write(b"{")

    def __end_group(self):
        self.__fh.write(b"}")

    def __write_header(self):
        # RTF version 1
        self.__control_word(b"rtf1")
        # character set
        self.__control_word(b"ansi")
        # ANSI code page - Western European
        self.__control_word(b"ansicpg1252")
        # default font - 0
        self.__control_word(b"deff0")
        # default language for default formatting properties - English United States
        self.__control_word(b"deflang1033")

        self.__write_font_table()

    def __write_font_table(self):
        # start font table
        self.__start_group()
        self.__control_word(b"fonttbl")

        # font info
        self.__start_group()
        # font number - 0
        self.__control_word(b"f0")
        # font family - proportionally spaced sans serif fonts
        self.__control_word(b"fswiss")
        # font charset - ANSI, font name - Consolas
        self.__control_word(b"fcharset0 Consolas;")
        self.__end_group()

        # end font table
        self.__end_group()

    def __write_document_prefix(self):
        # view mode - normal view
        self.__control_word(b"viewkind4")
        # number of bytes corresponding to a given \uN Unicode character - 1
        # readers ignore 1 byte after \uN sequence, readers which do not support \uN ignore this sequence and display the next byte
        self.__control_word(b"uc1")
        # reset to default paragraph properties
        self.__control_word(b"pard")
        # use font 0
        self.__control_word(b"f0")
        # font size in half-points - 14
        self.__control_word(b"fs14")

    def append(self, text):
        t = text.encode('utf-8')
        i = 0
        l = len(t)

        while i < l:
            c = t[i]

            if c == ord("\\"):
                self.__fh.write(b"\\\\")
            elif c == ord("{"):
                self.__fh.write(b"\\{")
            elif c == ord("}"):
                self.__fh.write(b"\\}")
            elif c == ord("\n"):
                self.__fh.write(b"\\par\r\n")
            elif c == ord("\r"):
                pass
            else:
                if c <= 0x7F:
                    self.__fh.write(c.to_bytes(1, 'big'))
                else:
                    if c <= 0xC0:
                        # continuation bytes
                        self.__write_invalid_codepoint()
                    elif c < 0xE0 and i + 1 < l:
                        # two byte sequence: 110xxxxx 10xxxxxx
                        self.__write_unicode_codepoint(((c & 0x1F) << 6) | (t[i + 1] & 0x3F))
                        i += 1
                    elif c < 0xF0 and i + 2 < l:
                        # three byte sequence: 1110xxxx 10xxxxxx 10xxxxxx
                        self.__write_unicode_codepoint(((c & 0x0F) << 12) | ((t[i + 1] & 0x3F) << 6) | (t[i + 2] & 0x3F))
                        i += 2
                    elif c < 0xF8 and i + 3 < l:
                        # four byte sequence: 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
                        self.__write_unicode_codepoint(((c & 0x07) << 18) | ((t[i + 1] & 0x3F) << 12) | ((t[i + 2] & 0x3F) << 6) | (t[i + 3] & 0x3F))
                        i += 3
                    else:
                        self.__write_invalid_codepoint()

            i += 1

    def __write_invalid_codepoint(self):
        self.__fh.write(b"?")

    def __write_unicode_codepoint(self, c):
        if c == 0xFEFF:
            # ignore BOM
            return

        if c <= 0xFFFF:
            self.__write_unicode_surrogate(c)
        else:
            # UTF-16 encoding using a surrogate pair
            c -= 0x10000
            self.__write_unicode_surrogate(0xD800 + ((c >> 10) & 0x03FF))
            self.__write_unicode_surrogate(0xDC00 + (c & 0x03FF))

    def __write_unicode_surrogate(self, c):
        # single Unicode character, signed 16-bit number, values greater than 32767 must be expressed as negative numbers
        self.__control_word(b"u")

        if c > 32767:
            c -= 65536

        self.__fh.write(str(c).encode('ascii'))
        # character displayed if reader doesn't support \uN sequence
        self.__fh.write(b"?")

class Wix4():
    extensions = ["WixToolset.UI.wixext", "WixToolset.Util.wixext"]
    version = "4.0.5"

    def __init__(self, src_dir, dst_dir, name=None, version=None, install_root=None):
        self.__folder = None
        self.__install_root = install_root
        if self.__install_root is None:
            if version is None or name is None:
                raise Exception("Missing name and version for MSI generation")
            else:
                self.__install_root = "INSTALL_ROOT"
        else:
            self.__folder = "swb"
        self.__src_dir = src_dir
        self.__dst_dir = dst_dir
        self.__name = name
        self.__version = version
        self.__vars = {}
        self.__vars["PRODUCT_GUID"] = guid()
        # NOTE: The Upgrade GUI should be fixed across versions so a new version
        # always replaces the old version
        self.__vars["UPGRADE_GUID"] = "A25BD1F4-342B-46E3-B459-5B72E319E133"
        self.__vars["PACKAGE_VENDOR"] = "Oracle and/or its affiliates"
        self.__vars["PACKAGE_NAME"] = "MySQL Shell Workbench"
        self.__vars["PRODUCT_ICON"] = os.path.join(os.path.dirname(os.path.dirname(__file__)), "mysql-shell-workbench", "Properties", "MySQLWorkbench.ico")
        self.__vars["PROGRAM_MENU_FOLDER"] = "MySQL"
        self.__vars["MAIN_EXECUTABLE_NAME"] = "MySQLShellWorkbench"
        self.__vars["MAIN_EXECUTABLE_FILE_ID"] = ""

        if self.__folder is None:
            self.__vars["PACKAGE_VERSION"] = self.__version
            self.__vars["INSTALL_DIRECTORY"] = f"MySQL/MySQL Shell Workbench {self.__version}"
            self.__vars["PACKAGE_FILE_NAME"] = f"{self.__name}-{self.__version}"
            self.msi = os.path.join(self.__dst_dir, self.__vars["PACKAGE_FILE_NAME"] + ".msi")

        self.__components = []
        self.__executables = [self.__vars["MAIN_EXECUTABLE_NAME"],self.__vars["PACKAGE_NAME"]]
        self.__shortcuts = []
        # convert list into list of pairs (name, label)
        self.__executables = list(zip(self.__executables[::2], self.__executables[1::2]))
        self.__ids = {}
        self.__id_count = {}
        self.__wix_dir = os.path.join(os.path.normpath(self.__dst_dir), "WIX4")

        self.exclude_dirs = ['__pycache__']
        self.exclude_extensions = ['.pyc']


    def generate(self):
        execute(self.__create_output_dir, "Creating output directory", "Failed to create output directory")

        if self.__folder is None:
            execute(self.__handle_main_file, "Copying the 'main.wxs' file", "Failed to copy the 'main.wxs' file")
            execute(self.__handle_license_file, "Converting license file", "Failed to convert licence file")

        self.__directories, directories = self.__init_xml()
        self.__features, features = self.__init_xml()
        self.__files, files = self.__init_xml()

        if self.__folder is None:
            self.__add_start_menu(directories)
        directories = self.__init_directories(directories)

        main_feature = self.__init_features(features)

        if self.__components:
            for component in self.__components:
                component_id = self.__component_id(component)
                self.__add_files_and_directories(os.path.join(self.__package_dir, component), "INSTALL_ROOT", self.__add_feature_ref(features, component_id), directories, files)
        else:
            # NO Support for shortcuts in this case (yet)
            target_folder = self.__install_root if self.__folder is None else self.__folder
            self.__add_files_and_directories(self.__src_dir, target_folder, main_feature, directories, files)

        if self.__shortcuts:
            self.__add_start_menu_shortcuts(main_feature, files)

        self.__write_wxs("directories", self.__directories)
        self.__write_wxs("features", self.__features)
        self.__write_wxs("files", self.__files)

        execute(self.__create_wix_vars_file, "Creating the 'variables.wxi' file", "Failed to create the 'variables.wxi' file")


    def __create_output_dir(self):
        os.makedirs(self.__dst_dir, exist_ok=True)

        if os.path.isdir(self.__wix_dir):
            shutil.rmtree(self.__wix_dir)

        os.makedirs(self.__wix_dir, exist_ok=True)

    def __handle_main_file(self):
        wix_script = os.path.join(os.path.dirname(__file__), "main.wxs")
        shutil.copy2(wix_script, self.__wix_dir)

    def __handle_license_file(self):
        license_file = os.path.join(self.__src_dir, "LICENSE.txt")

        if not os.path.exists(license_file):
            raise Exception(f"Missing License File At: {license_file}")
        
        rtf_license = os.path.join(self.__wix_dir, os.path.splitext(os.path.basename(license_file))[0] + ".rtf")

        with open(license_file, "r", encoding="utf-8") as input:
            rtf = Rtf_file(rtf_license)

            for line in input:
                rtf.append(line)

        self.__vars["LICENSE_RTF"] = safe_path(rtf_license)

    def __create_wix_vars_file(self):
        with open(os.path.join(self.__wix_dir, "variables.wxi"), "w", encoding="utf-8") as f:
            f.write('<Include xmlns="http://wixtoolset.org/schemas/v4/wxs">\n')

            for var, value in self.__vars.items():
                f.write(f'  <?define {var}="{value}"?>\n')

            f.write("</Include>\n")


    def create_msi(self):
        if self.__folder is not None:
            raise Exception("The MSI can not be created when everything will be a subcomponent.")

        args = [ "wix", "build", "-arch", "x64" ]

        for extension in self.extensions:
            args.append("-ext")
            args.append(extension)

        args.append("-o")
        args.append(self.msi)

        args.append(os.path.join(self.__wix_dir, "*.wxs"))

        log(f"output:\n{run_process(*args)}")

    def __init_xml(self):
        root = ET.Element("Wix", attrib={"xmlns": "http://wixtoolset.org/schemas/v4/wxs"})
        fragment = ET.SubElement(root, "Fragment")
        return (root, fragment)

    def __write_wxs(self, name, xml):
        tree = ET.ElementTree(xml)
        ET.indent(tree, " ")
        tree.write(os.path.join(self.__wix_dir, name + ".wxs"), encoding='utf-8')

    def __add_standard_directory(self, parent, id):
        return ET.SubElement(parent, "StandardDirectory", attrib={"Id": id})

    def __add_directory(self, parent, id, name):
        return ET.SubElement(parent, "Directory", attrib={"Id": id, "Name": name})

    def __add_directory_ref(self, parent, id):
        return ET.SubElement(parent, "DirectoryRef", attrib={"Id": id})

    def __add_start_menu(self, parent):
        sd = self.__add_standard_directory(parent, "ProgramMenuFolder")
        self.__add_directory(sd, "PROGRAM_MENU_FOLDER", self.__vars["PROGRAM_MENU_FOLDER"])

    def __init_directories(self, parent):
        if self.__folder is None:
            d = self.__add_standard_directory(parent, "ProgramFiles64Folder")
            dirs = split_path(self.__vars["INSTALL_DIRECTORY"])

            for i in range(len(dirs) - 1):
                d = self.__add_directory(d, f"INSTALL_PREFIX_{i + 1}", dirs[i])

            return self.__add_directory(d, self.__install_root, dirs[-1])
        else:
            d = self.__add_directory_ref(parent, self.__install_root)
            return self.__add_directory(d, self.__folder, self.__folder)

    def __component_id(self, name):
        return "CM_C_" + name

    def __init_features(self, parent):
        feature_name = "ProductFeature" if self.__folder is None else "MySQLShellWorkbenchFeature"
        main_feature = ET.SubElement(parent, "Feature", attrib={"Id": feature_name,
                                                     "Display": "hidden",
                                                     "ConfigurableDirectory": self.__install_root,
                                                     "Title": self.__vars["PACKAGE_NAME"],
                                                     "Level": "1",
                                                     "AllowAbsent": "no"})

        # If there are components defined, creates a feature for each of them
        if self.__components:
            for component in self.__components:
                ET.SubElement(main_feature, "Feature", attrib={"Id": self.__component_id(component), "Title": component})
        return main_feature

    def __add_feature_ref(self, parent, id):
        return ET.SubElement(parent, "FeatureRef", attrib={"Id": id})

    def __id(self, path):
        path = os.path.relpath(path, self.__src_dir)
        id = self.__ids.get(path)

        if id is None:
            id = self.__create_id(path)
            self.__ids[path] = id

        return id

    def __create_id(self, path):
        segments = split_path(path)
        replaced = 0

        for i in range(len(segments)):
            segments[i], r = self.__normalize_id(segments[i])
            replaced += r

        id = ".".join(segments)

        if replaced * 100 / len(id) > 33 or len(id) > 60:
            prefix = "H"
            id = self.__hash_id(path, segments[-1])
        else:
            prefix = "P"

        id = prefix + "_" + id

        count = self.__id_count[id] = self.__id_count.get(id, 0) + 1
        if count > 1:
            id += "_" + str(count)

        return id

    def __normalize_id(self, id):
        allowed = string.ascii_letters + string.digits + "_."
        replaced = 0
        out = ""

        for i in id:
            if i in allowed:
                out += i
            else:
                out += "_"
                replaced += 1

        return out, replaced

    def __hash_id(self, path, filename):
        max = 52

        id = hashlib.sha1(safe_path(path).encode("utf8")).hexdigest()[0:7] + "_" + filename[0:max]

        if len(filename) > max:
            id += "..."

        return id

    def __add_files_and_directories(self, path, parent_id, feature, directory, files):
        with os.scandir(path) as it:
            for entry in it:
                id = self.__id(entry.path)

                if entry.is_dir():
                    if entry.name in self.exclude_dirs:
                        continue
                    id = "CM_D" + id
                    self.__add_files_and_directories(entry.path, id, feature, self.__add_directory(directory, id, entry.name), files)
                else:
                    is_excluded = any(entry.name.endswith(ext) for ext in self.exclude_extensions)
                    if is_excluded:
                        continue
                    component_id, file_id = self.__add_file(files, parent_id, entry.path, id)
                    if entry.name == f"{self.__vars['MAIN_EXECUTABLE_NAME']}.exe":
                        self.__vars["MAIN_EXECUTABLE_FILE_ID"] = file_id
                    self.__add_component_ref(feature, component_id)

                    # Only add shortcuts on standard MSI
                    if self.__folder is None:
                        for exe in self.__executables:
                            if entry.name.lower() == exe[0].lower() + ".exe":
                                self.__shortcuts.append((id, exe[1], parent_id))

    def __add_file(self, parent, dir_id, file_path, file_id):
        component_id = "CM_C" + file_id
        c = self.__add_component(parent, dir_id, component_id)
        file_id = "CM_F" + file_id
        ET.SubElement(c, "File", attrib={"Id": file_id, "Source": safe_path(file_path), "KeyPath": "yes"})
        return component_id, file_id

    def __add_component(self, parent, dir_id, component_id):
        d = ET.SubElement(parent, "DirectoryRef", attrib={"Id": dir_id})
        return ET.SubElement(d, "Component", attrib={"Id": component_id})

    def __add_component_ref(self, parent, id):
        return ET.SubElement(parent, "ComponentRef", attrib={"Id": id})

    def __add_start_menu_shortcuts(self, feature, files):
        component = self.__vars["MAIN_EXECUTABLE_NAME"]
        component_id = "CM_SHORTCUT_" + component
        c = self.__add_component(files, "PROGRAM_MENU_FOLDER", component_id)
        self.__add_component_ref(feature, component_id)

        for shortcut in self.__shortcuts:
            ET.SubElement(c, "Shortcut", attrib={"Id": "CM_S" + shortcut[0],
                                                 "Name": shortcut[1],
                                                 "Target": f"[#CM_F{shortcut[0]}]",
                                                 "WorkingDirectory": shortcut[2]})

        ET.SubElement(c, "RegistryValue", attrib={"Root": "HKCU",
                                                  "Key": "\\".join(["Software", self.__vars["PACKAGE_VENDOR"], self.__vars["PACKAGE_NAME"]]),
                                                  "Name": component + "_installed",
                                                  "Type": "integer",
                                                  "Value": "1",
                                                  "KeyPath": "yes"})

        ET.SubElement(c, "RemoveFolder", attrib={"Id": "CM_REMOVE_PROGRAM_MENU_FOLDER_" + component, "On": "uninstall"})

    @staticmethod
    def install():
        tools = run_process("dotnet", "tool", "list", "--global")

        # output is: wix             x.y.z        wix
        if "wix " not in tools and " wix" not in tools:
            log("wix not installed, installing...")
            run_process("dotnet", "tool", "install", "--global", "wix", "--version", Wix4.version)

        log(f"wix version: {run_process('wix', '--version')}")

        def wix_extensions():
            # this returns non-zero exit code if list is empty
            return run_process("wix", "extension", "list", "--global", ignore_exit_code=True)

        extensions =  wix_extensions()

        for ext in Wix4.extensions:
            if ext not in extensions:
                log(f"Installing wix extension '{ext}'...")
                run_process("wix", "extension", "add", "--global", f"{ext}/{Wix4.version}")

        log(f"Installed wix extensions:\n{wix_extensions()}")

def main():
    parser = argparse.ArgumentParser(description="Create MSI usin WIX4")
    parser.add_argument("-s", "--src", help="Source (build) directory", required=True)
    parser.add_argument("-d", "--dst", help="Destination directory", required=True)
    parser.add_argument("-n", "--name", help="Package File Name", default=None)
    parser.add_argument("-v", "--version", help="Version", default=None)
    parser.add_argument("-r", "--root", default=None, help="The install root, only when generating bundle configuration")
    args = parser.parse_args()

    # disable telemetry
    os.environ["DOTNET_CLI_TELEMETRY_OPTOUT"] = "1"

    check_preconditions()

    Wix4.install()

    wix = Wix4(args.src, args.dst, args.name, args.version, args.root)
    execute(wix.generate, "Creating WXS files...", "Failed to create WXS files")
    if args.root is None:
        execute(wix.create_msi, "Creating MSI...", "Failed to create MSI")

if __name__ == "__main__":
    main()
