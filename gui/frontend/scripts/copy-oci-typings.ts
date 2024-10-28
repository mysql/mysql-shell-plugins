/*
 * Copyright (c) 2022, 2024, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import * as fs from "fs";
import * as path from "path";
import ts from "typescript";
import { enumerateFiles } from "../src/utilities/file-utilities.js";


const targetFolder = path.join("./src", "oci-typings");
const printer = ts.createPrinter();

const extractInterfacesAndEnums = (filePath: string): string => {
    const program = ts.createProgram([filePath], {});
    //const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile(filePath);

    if (!sourceFile) {
        throw new Error(`Could not find source file at ${filePath}`);
    }

    let result = "";

    // Go through each node and collect the import statements and enum/interface declarations.
    // Note: printing a node with a doc comment will include the comment in the output.
    const visit = (node: ts.Node) => {
        if (ts.isImportDeclaration(node)) {
            let text = printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);

            // Replace implicit imports of the index file with an explicit import of the index.js file.
            if (text.endsWith("../\";") || text.endsWith("../';") || text.endsWith("../model\";")
                || text.endsWith("../model';")) {
                text = text.replace("';", "/index.js';");
                text = text.replace("\";", "/index.js\";");
            } else {
                // Insert a .js extension to the import path.
                let lastQuote = text.lastIndexOf("\"");
                if (lastQuote === -1) {
                    lastQuote = text.lastIndexOf("'");
                }

                if (lastQuote !== -1) {
                    text = text.substring(0, lastQuote) + ".js" + text.substring(lastQuote);
                }

                // Convert `import * as <type> from` to `export type { <type> } from`, if this is an index file.
                if (filePath.endsWith("index.d.ts")) {
                    text = text.replace("import * as ", "export type { ");
                    text = text.replace("from \"", "} from \"");
                }
            }

            result += text + "\n";
        } else if (ts.isExportAssignment(node) || ts.isExportDeclaration(node) || ts.isNamedExports(node)) {
            result += printer.printNode(ts.EmitHint.Unspecified, node, sourceFile) + "\n";
        } else if (ts.isInterfaceDeclaration(node) || ts.isEnumDeclaration(node)) {
            // Remove the `declare` keyword from the interface/enum declaration.
            // This is kinda hacky, because we are modifying the node modifier list directly.
            // For printing the node this is fine, however.
            if (node.modifiers) {
                const modifiers = ts.factory.createNodeArray(node.modifiers.filter((modifier) => {
                    return modifier.kind !== ts.SyntaxKind.DeclareKeyword;
                }));

                // @ts-ignore, because the modifier list is readonly.
                node.modifiers = modifiers;
            }
            result += printer.printNode(ts.EmitHint.Unspecified, node, sourceFile) + "\n";
        } else if (ts.isModuleDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
            const entries: string[] = [];

            // This is a namespace, visit its children to find enums.
            ts.forEachChild(node, (child) => {
                if (ts.isModuleBlock(child)) {
                    ts.forEachChild(child, (grandChild) => {
                        if (ts.isEnumDeclaration(grandChild)) {
                            const text = printer.printNode(ts.EmitHint.Unspecified, grandChild, sourceFile);
                            entries.push(`export ${text}\n`);
                        }
                    });
                }
            });

            if (entries.length > 0) {
                result += `export namespace ${node.name.text} {\n${entries.join("\n")}}\n`;
            }
        } else {
            ts.forEachChild(node, visit);
        }
    };

    ts.forEachChild(sourceFile, visit);

    return result;
};

const processTypings = (folder: string) => {
    const typings = enumerateFiles(path.join("node_modules", folder), ".d.ts");

    typings.forEach((file) => {
        console.log(`Processing ${file}`);
        const targetName = path.join(targetFolder, file.substring("node_modules".length)).replace(".d.ts", ".ts");

        fs.mkdirSync(path.dirname(targetName), { recursive: true });
        const tsContent = extractInterfacesAndEnums(file);
        if (tsContent.length > 0) {
            fs.writeFileSync(targetName, tsContent);
        }
    });

};

/*if (fs.existsSync(targetFolder)) {
    fs.rmdirSync(targetFolder, { recursive: true });
}*/

if (!fs.existsSync(targetFolder)) {
    console.log("Copying OCI typings...");

    processTypings("oci-core/lib/model");
    processTypings("oci-bastion/lib/model");
    processTypings("oci-mysql/lib/model");
    processTypings("oci-loadbalancer/lib/model");
    processTypings("oci-identity/lib/model");
    processTypings("oci-objectstorage/lib/model");

    console.log("done\n");
} else {
    console.log("OCI Types target folder exists, skipping...");
}
