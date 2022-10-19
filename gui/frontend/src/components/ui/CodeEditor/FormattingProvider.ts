/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

import { Monaco, languages, ProviderResult, FormattingOptions, TextEdit } from ".";
import { ScriptingLanguageServices } from "../../../script-execution/ScriptingLanguageServices";
import { ICodeEditorModel } from "./CodeEditor";

// A formatter which can only format entire commands (with their sub models).
export class FormattingProvider implements languages.DocumentFormattingEditProvider {

    public provideDocumentFormattingEdits(model: ICodeEditorModel,
        options: FormattingOptions): ProviderResult<TextEdit[]> {
        const services = ScriptingLanguageServices.instance;
        const block = model.executionContexts.contextFromPosition(model.executionContexts.cursorPosition);

        if (block && block.model && !block.model.isDisposed()) {
            if (block.isInternal) {
                // Not much to format here. Just remove all outer whitespaces and ensure single ws in other places.
                const parts = block.code.split(" ");

                return [{
                    range: block.model.getFullModelRange(),
                    text: parts.join(" "),
                    eol: Monaco.EndOfLineSequence.LF,
                }];
            }

            return services.format(block, block.model.getFullModelRange(), options);
        }

    }

}
