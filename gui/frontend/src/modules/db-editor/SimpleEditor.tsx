/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have either included with
 * the program or referenced in the documentation.
 *
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { ComponentChild, createRef } from "preact";

import { ui } from "../../app-logic/UILayer.js";
import { Button } from "../../components/ui/Button/Button.js";
import { CodeEditor, type IEditorPersistentState } from "../../components/ui/CodeEditor/CodeEditor.js";
import type { IPosition } from "../../components/ui/CodeEditor/index.js";
import { ComponentBase, type IComponentProperties } from "../../components/ui/Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../../components/ui/Container/Container.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import { StatusBarAlignment, type IStatusBarItem } from "../../components/ui/Statusbar/StatusBarItem.js";
import { Toolbar } from "../../components/ui/Toolbar/Toolbar.js";
import type { ConnectionDataModelEntry } from "../../data-models/ConnectionDataModel.js";
import { Assets } from "../../supplement/Assets.js";
import { requisitions } from "../../supplement/Requisitions.js";
import type { EditorLanguage } from "../../supplement/index.js";
import { saveTextAsFile } from "../../utilities/helpers.js";
import type { IToolbarItems } from "./index.js";

interface ISimpleEditorProperties extends IComponentProperties {
    /** Persistent state for the editor. */
    savedState: IEditorPersistentState;

    /** The name to be used if the user saves the content to a file. */
    fileName: string;

    /** The toolbar items to show. We only use the navigation entry. */
    toolbarItemsTemplate: IToolbarItems;
}

/**
 * A simplified script editor component that allows the user to edit and save scripts, generated from
 * various sources (like OCI configuration files).
 */
export class SimpleEditor extends ComponentBase<ISimpleEditorProperties> {

    private editorRef = createRef<CodeEditor>();

    #editorLanguageSbEntry!: IStatusBarItem;
    #editorEolSbEntry!: IStatusBarItem;
    #editorIndentSbEntry!: IStatusBarItem;
    #editorPositionSbEntry!: IStatusBarItem;

    public constructor(props: ISimpleEditorProperties) {
        super(props);

        this.addHandledProperties("savedState", "fileName");
    }

    public override componentDidMount(): void {
        requisitions.register("editorInsertText", this.doInsertText);
        requisitions.register("editorCaretMoved", this.handleCaretMove);

        this.#editorPositionSbEntry = ui.createStatusBarItem("editorPosition", StatusBarAlignment.Right, 990);
        this.#editorIndentSbEntry = ui.createStatusBarItem("editorIndent", StatusBarAlignment.Right, 985);
        this.#editorEolSbEntry = ui.createStatusBarItem("editorEOL", StatusBarAlignment.Right, 980);
        this.#editorLanguageSbEntry = ui.createStatusBarItem("editorLanguage", StatusBarAlignment.Right, 975);

        this.updateStatusItems();
    }

    public override componentDidUpdate(): void {
        this.updateStatusItems();
    }

    public override componentWillUnmount(): void {
        this.#editorLanguageSbEntry.dispose();
        this.#editorIndentSbEntry.dispose();
        this.#editorPositionSbEntry.dispose();
        this.#editorEolSbEntry.dispose();

        requisitions.unregister("connectionItemDefaultAction", this.doConnectionEntryDefaultAction);
        requisitions.unregister("editorInsertText", this.doInsertText);
        requisitions.unregister("editorCaretMoved", this.handleCaretMove);
    }

    public render(): ComponentChild {
        const { savedState, toolbarItemsTemplate } = this.props;

        const toolbarItems = {
            navigation: toolbarItemsTemplate.navigation.slice(),
            execution: toolbarItemsTemplate.execution,
            editor: toolbarItemsTemplate.editor,
            auxillary: toolbarItemsTemplate.auxillary,
        };

        toolbarItems.navigation.push(<Button
            id="itemSaveButton"
            key="itemSaveButton"
            imageOnly={true}
            data-tooltip="Save To File"
            style={{ marginLeft: "4px" }}
            onClick={this.handleEditorSave}
        >
            <Icon src={Assets.toolbar.saveIcon} data-tooltip="inherit" />
        </Button>);

        return (
            <Container
                orientation={Orientation.TopDown}
                style={{
                    flex: "1 1 auto",
                }}
                mainAlignment={ContentAlignment.Stretch}
            >
                <Toolbar id="simpleEditorToolbar">
                    {toolbarItems.navigation}
                </Toolbar>
                <CodeEditor
                    ref={this.editorRef}
                    minimap={{
                        enabled: true,
                    }}
                    allowSoftWrap={true}
                    autoFocus={true}
                    font={{
                        fontFamily: "var(--msg-monospace-font-family)",
                        lineHeight: 24,
                    }}
                    scrollbar={{
                        useShadows: true,
                        verticalHasArrows: false,
                        horizontalHasArrows: false,
                        vertical: "auto",
                        horizontal: "auto",

                        verticalScrollbarSize: 16,
                        horizontalScrollbarSize: 16,
                    }}
                    savedState={savedState}
                    onModelChange={this.handleModelChange}
                />
            </Container>
        );
    }

    /**
     * Inserts the given script into the current editor block, if that has the same language as that of the script
     * and if that block is empty.
     *
     * @param language The language of the script text.
     * @param script The text to insert.
     */
    public insertScriptText(language: EditorLanguage, script: string): void {
        if (this.editorRef.current) {
            const lastBlock = this.editorRef.current.lastExecutionBlock;
            if (!lastBlock || lastBlock.codeLength > 0 || lastBlock.language !== language) {
                this.editorRef.current.prepareNextExecutionBlock(-1, language);
            }

            this.editorRef.current.appendText(script);
            this.editorRef.current.focus();
        }
    }

    private handleCaretMove = (position: IPosition): Promise<boolean> => {
        if (this.#editorPositionSbEntry) {
            this.#editorPositionSbEntry.text = `Ln ${position.lineNumber || 1}, Col ${position.column || 1}`;
        }

        return Promise.resolve(true);
    };

    private handleModelChange = (): void => {
        /*const { id, onEdit } = this.props;

        onEdit?.(id);*/
    };

    private doConnectionEntryDefaultAction = (entry: ConnectionDataModelEntry): Promise<boolean> => {
        this.editorRef.current?.insertText(entry.caption);
        this.editorRef.current?.focus();

        return Promise.resolve(true);
    };

    private doInsertText = (text: string): Promise<boolean> => {
        this.editorRef.current?.insertText(text);

        return Promise.resolve(true);
    };

    private updateStatusItems = (): void => {
        if (this.editorRef.current) {
            const { savedState } = this.props;
            const position = savedState.viewState?.cursorState[0].position;
            const language = savedState.model.getLanguageId() as EditorLanguage;

            this.#editorLanguageSbEntry.text = language;
            this.#editorEolSbEntry.text = savedState.options.defaultEOL || "LF";

            if (savedState.options.insertSpaces) {
                this.#editorIndentSbEntry.text = `Spaces: ${savedState.options.indentSize ?? 4}`;
            } else {
                this.#editorIndentSbEntry.text = `Tab Size: ${savedState.options.tabSize ?? 4}`;
            }

            this.#editorPositionSbEntry.text = `Ln ${position?.lineNumber ?? 1}, Col ${position?.column ?? 1}`;
        }
    };

    private handleEditorSave = (): void => {
        const { savedState, fileName } = this.props;
        const text = savedState.model.getValue();
        saveTextAsFile(text, fileName);
    };

}
