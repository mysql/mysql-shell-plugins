/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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

import "./ChatOptions.css";

import { ComponentChild, createRef, render } from "preact";
import { ComponentBase, IComponentProperties, IComponentState } from "../ui/Component/ComponentBase.js";
import { Container, ContentAlignment, Orientation } from "../ui/Container/Container.js";
import { Label } from "../ui/Label/Label.js";
import { Button } from "../ui/Button/Button.js";
import { ITag, ITagInputProperties, TagInput } from "../ui/TagInput/TagInput.js";
import { TreeGrid } from "../ui/TreeGrid/TreeGrid.js";
import { CellComponent, RowComponent } from "tabulator-tables";
import { Dropdown, IDropdownProperties } from "../ui/Dropdown/Dropdown.js";
import { DropdownItem } from "../ui/Dropdown/DropdownItem.js";
import { IInputChangeProperties, Input } from "../ui/Input/Input.js";
import { IMdsChatData, IMdsChatStatus } from "../../communication/ProtocolMds.js";
import { Accordion, IAccordionProperties } from "../ui/Accordion/Accordion.js";
import chatOptionsIcon from "../../assets/images/chatOptions.svg";
import { Icon } from "../ui/Icon/Icon.js";
import { Toggle } from "../ui/Toggle/Toggle.js";
import { CheckState } from "../ui/Checkbox/Checkbox.js";
import { Codicon } from "../ui/Codicon.js";
import { Dialog } from "../ui/Dialog/Dialog.js";

export enum ChatOptionAction {
    SaveChatOptions,
    LoadChatOptions,
    StartNewChat,
}

export interface IChatOptionsSectionState {
    expanded?: boolean;
    size?: number;
}

export interface IHistoryEntry {
    chatQueryId: string;
    historyEntryType: string;
    originalText: string;
    updatedText: string;
}

export interface IChatOptionsState extends IComponentState {
    chatOptionsExpanded: boolean,
    chatOptionsWidth: number,
    options?: IMdsChatData,
    sectionStates?: Map<string, IChatOptionsSectionState>,
    chatQueryHistory?: IHistoryEntry,
}

export interface IChatOptionsProperties extends IComponentProperties {
    savedState: IChatOptionsState;
    currentSchema?: string;
    genAiStatus?: IMdsChatStatus;

    onAction: (action: ChatOptionAction, options?: IMdsChatData) => void,
    onChatOptionsStateChange: (data: Partial<IChatOptionsState>) => void;
    onClose?: (accepted: boolean, payload?: unknown) => void;
}

export class ChatOptions extends ComponentBase<IChatOptionsProperties, IChatOptionsState> {

    #dialogRef = createRef<Dialog>();

    public constructor(props: IChatOptionsProperties) {
        super(props);

        this.addHandledProperties("savedState");
    }

    public static override getDerivedStateFromProps(props: IChatOptionsProperties,
        state: IChatOptionsState): Partial<IChatOptionsState> {

        // If no state is yet set, use the saved state as passed in by the props if available
        if (state.chatOptionsExpanded === undefined) {
            return props.savedState;
        }

        return {};
    }

    public render(): ComponentChild {
        const { savedState, currentSchema, genAiStatus } = this.props;
        const { options, sectionStates, chatQueryHistory } = savedState;

        const tables: ITag[] = [];
        if (options?.tables) {
            options.tables.forEach((table) => {
                const fullyQualifiedTableName = `${table.schemaName}.${table.tableName}`;
                tables.push({ id: fullyQualifiedTableName, caption: fullyQualifiedTableName });
            });
        }

        const documents: IDictionary[] = [];
        if (options?.documents) {
            options.documents.forEach((doc) => {
                documents.push({ title: doc.title, segment: doc.segment });
            });
        }

        const schemaSection = sectionStates?.get("schemaSection") ?? {};
        const historySection = sectionStates?.get("historySection") ?? {};
        const tablesSection = sectionStates?.get("tablesSection") ?? {};
        //const metadataSection = sectionStates?.get("metadataSection") ?? {};
        const docsSection = sectionStates?.get("docsSection") ?? {};
        const modelSection = sectionStates?.get("modelSection") ?? {};
        const advancedModelSection = sectionStates?.get("advancedModelSection") ?? {};
        const promptSection = sectionStates?.get("promptSection") ?? {};
        const languageSection = sectionStates?.get("languageSection") ?? {};

        const modelOptions = options?.modelOptions;

        const languageSupportEnabled = genAiStatus?.languageSupport;

        return (
            <Container className={this.getEffectiveClassNames(["chatOptionsPanel"])} orientation={Orientation.TopDown}>
                <Container className="header"
                    orientation={Orientation.TopDown}
                    mainAlignment={ContentAlignment.Start}
                    crossAlignment={ContentAlignment.Center}>
                    <Container className="title"
                        orientation={Orientation.LeftToRight}
                        mainAlignment={ContentAlignment.Stretch}
                        crossAlignment={ContentAlignment.Center}
                    >
                        <Icon src={chatOptionsIcon} />
                        <Label>HeatWave Chat</Label>
                    </Container>
                    <Label>AI Profile Editor</Label>
                </Container>
                <Accordion
                    sectionClosedSize={16}
                    sections={[
                        {
                            id: "schemaSection",
                            caption: "Schema Scope",
                            stretch: false,
                            minSize: 44,
                            maxSize: 44,
                            expanded: schemaSection.expanded ?? true,
                            initialSize: schemaSection.size ?? 54,
                            dimmed: false,
                            content: [
                                <Container className="scopeMultiItemRow" orientation={Orientation.LeftToRight}>
                                    <Dropdown className="scopeSchema"
                                        selection={options?.schemaName ?? "schemaDropdownAllSchemas"}
                                        onSelect={this.handleSchemaChange}>
                                        <DropdownItem id="schemaDropdownAllSchemas" caption="All Database Schemas" />
                                        {options?.schemaName !== undefined &&
                                            <DropdownItem id={options?.schemaName} caption={options?.schemaName} />}
                                        {currentSchema !== undefined && currentSchema !== ""
                                            && (options?.schemaName === undefined
                                                || currentSchema !== options?.schemaName) &&
                                            <DropdownItem id={currentSchema} caption={currentSchema} />}
                                    </Dropdown>
                                </Container>,
                            ],
                        },
                        /*{
                            id: "preambleSection",
                            caption: "Preamble",
                            stretch: false,
                            minSize: 54,
                            maxSize: 120,
                            expanded: preambleSection.expanded ?? false,
                            initialSize: preambleSection.size ?? 54,
                            dimmed: false,
                            content: [
                                <Container className="scopeMultiItemRow" orientation={Orientation.LeftToRight}>
                                    <Input className="scopePreamble" multiLine={true} multiLineCount={3}
                                        value={options?.preamble ?? ""}
                                        spellCheck={false}
                                        onChange={this.handlePreambleChange} />
                                </Container>,
                            ],
                        },*/
                        {
                            id: "historySection",
                            caption: "History",
                            stretch: false,
                            minSize: 125,
                            maxSize: 126,
                            expanded: historySection.expanded ?? true,
                            initialSize: historySection.size ?? 125,
                            dimmed: false,
                            content: [
                                <Container className="scopeMultiItemRow" orientation={Orientation.LeftToRight}>
                                    <TreeGrid
                                        options={{
                                            index: "param",
                                            layout: "fitDataStretch",
                                            showHeader: true,
                                            rowHeight: 20,
                                        }}
                                        columns={[{
                                            title: "User",
                                            field: "userMessage",
                                            editable: false,
                                            tooltip: true,
                                            formatter: this.historyMessageColumnFormatter,
                                        }, {
                                            title: "Chatbot",
                                            field: "chatBotMessage",
                                            editable: false,
                                            tooltip: true,
                                            formatter: this.historyMessageColumnFormatter,
                                        }, {
                                            title: "ChatQueryId",
                                            field: "chatQueryId",
                                            editable: false,
                                            visible: false,
                                        }]}
                                        tableData={options?.chatHistory ?? []}
                                    />
                                    <Dialog
                                        ref={this.#dialogRef}
                                        id="historyEditDialog"
                                        className="historyEditDialog"
                                        onClose={this.closeEditTextDialog}
                                        caption={
                                            <>
                                                <Icon src={Codicon.EditorLayout} />
                                                <Label>Edit chat history</Label>
                                            </>
                                        }
                                        content={
                                            <Input ref={this.#dialogRef}
                                                id="historyEdit"
                                                multiLine={true}
                                                autoFocus={true}
                                                multiLineCount={5}
                                                className="historyEdit"
                                                value={chatQueryHistory?.updatedText}
                                                onChange={this.handleHistoryValueChange}
                                            />
                                        }
                                        actions={{
                                            end: [
                                                <Button
                                                    caption="Save"
                                                    id="ok"
                                                    key="ok"
                                                    onClick={this.handleDlgEditActionClick}
                                                />,
                                                <Button
                                                    caption="Cancel"
                                                    id="cancel"
                                                    key="cancel"
                                                    onClick={this.handleDlgEditActionClick}
                                                />,
                                            ],
                                        }}
                                        {...this.unhandledProperties}
                                    >
                                    </Dialog>
                                </Container>,
                            ],
                        },
                        {
                            id: "tablesSection",
                            caption: "Database Tables",
                            stretch: false,
                            minSize: 106,
                            maxSize: 136,
                            expanded: tablesSection.expanded ?? true,
                            initialSize: tablesSection.size ?? 40,
                            dimmed: false,
                            content: [
                                <Container className="scopeMultiItemRow" orientation={Orientation.TopDown}>
                                    <TagInput className="scopeTables" removable={true} tags={tables}
                                        onRemove={this.removeVectorTable} />
                                    <Toggle id="lockTableListToggle"
                                        caption="Lock table list" checkState={options?.lockTableList ?? false
                                            ? CheckState.Checked : CheckState.Unchecked}
                                        onChange={this.toggleLockTableList} />
                                </Container>,
                            ],
                        },
                        /*{
                            id: "metadataSection",
                            caption: "Limit by Metadata",
                            stretch: false,
                            minSize: 96,
                            maxSize: 120,
                            expanded: metadataSection.expanded ?? false,
                            initialSize: metadataSection.size ?? 96,
                            dimmed: false,
                            content: [
                                <Container className="scopeMultiItemRow" orientation={Orientation.LeftToRight}>
                                    <TreeGrid
                                        options={{
                                            index: "param",
                                            layout: "fitDataStretch",
                                            showHeader: true,
                                            rowHeight: 20,
                                        }}
                                        columns={[{
                                            title: "Param",
                                            field: "param",
                                            editable: false,
                                        }, {
                                            title: "Value",
                                            field: "value",
                                            editable: true,
                                        }]}
                                        tableData={[
                                            { param: "title", value: "" },
                                            { param: "creationDate", value: "" },
                                        ]}
                                    />
                                </Container>,
                            ],
                        },*/
                        {
                            id: "docsSection",
                            caption: "Matched Documents",
                            stretch: false,
                            minSize: 80,
                            maxSize: 180,
                            expanded: docsSection.expanded ?? true,
                            initialSize: docsSection.size ?? 120,
                            dimmed: false,
                            content: [
                                <Container className="scopeMultiItemRow" orientation={Orientation.LeftToRight}>
                                    <TreeGrid
                                        options={{
                                            index: "title",
                                            layout: "fitDataStretch",
                                            showHeader: true,
                                        }}
                                        columns={[{
                                            title: "Title",
                                            field: "title",
                                            editable: false,
                                            tooltip: true,
                                        }, {
                                            title: "Segment",
                                            field: "segment",
                                            editable: false,
                                            tooltip: true,
                                        }]}
                                        tableData={documents}
                                        onFormatRow={(row: RowComponent): void => {
                                            row.getElement().style.height = "20px";
                                        }} />
                                </Container>,
                            ],
                        },
                        {
                            id: "modelSection",
                            caption: "Model Options",
                            stretch: false,
                            minSize: 76,
                            maxSize: 76,
                            expanded: modelSection.expanded ?? true,
                            initialSize: modelSection.size ?? 76,
                            dimmed: false,
                            content: [
                                <Container className="scopeMultiItemColumn" orientation={Orientation.TopDown}
                                    mainAlignment={ContentAlignment.Start} crossAlignment={ContentAlignment.Stretch}>
                                    <Container className="scopeLabeledItem" orientation={Orientation.LeftToRight}>
                                        <Label className="scopeLabel" caption="Model:" />
                                        <Dropdown className="scopeModel"
                                            selection={savedState.options?.modelOptions?.modelId ?? "default"}
                                            onSelect={this.handleModelIdChange}>
                                            <DropdownItem id="default" caption="Default" />
                                            <DropdownItem id="llama3-8b-instruct-v1" caption="Llama 3" />
                                            <DropdownItem id="mistral-7b-instruct-v1" caption="Mistral" />
                                            <DropdownItem id="cohere.command-r-plus"
                                                caption="OCI GenAI - Cohere+ (added cost)" />
                                            <DropdownItem id="cohere.command-r-16k"
                                                caption="OCI GenAI - Cohere (added cost)" />
                                            <DropdownItem id="meta.llama-3-70b-instruct"
                                                caption="OCI GenAI - Llama 3 Large (added cost)" />
                                        </Dropdown>
                                    </Container>
                                    {languageSupportEnabled &&
                                        <Container className="scopeLabeledItem" orientation={Orientation.LeftToRight}>
                                            <Label className="scopeLabel" caption="Language:" />
                                            <Dropdown className="scopeModel"
                                                selection={savedState.options?.modelOptions?.language ?? "en"}
                                                onSelect={this.handleModelLanguageChange}>
                                                <DropdownItem caption="English" id="en" />
                                                <DropdownItem caption="German" id="de" />
                                                <DropdownItem caption="French" id="fr" />
                                                <DropdownItem caption="Spanish" id="es" />
                                                <DropdownItem caption="Portuguese" id="pt" />
                                                <DropdownItem caption="Italian" id="it" />
                                                <DropdownItem caption="Dutch" id="nl" />
                                                <DropdownItem caption="Czech" id="cs" />
                                                <DropdownItem caption="Polish" id="pl" />
                                                <DropdownItem caption="Persian" id="fa" />
                                                <DropdownItem caption="Hindi" id="hi" />
                                                <DropdownItem caption="Bengali" id="bn" />
                                                <DropdownItem caption="Urdu" id="ur" />
                                                <DropdownItem caption="Brazilian Portuguese" id="pt-BR" />
                                                <DropdownItem caption="Chinese" id="zh" />
                                                <DropdownItem caption="Arabic" id="ar" />
                                                <DropdownItem caption="Hebrew" id="he" />
                                                <DropdownItem caption="Tibetan" id="bo" />
                                                <DropdownItem caption="Turkish" id="tr" />
                                                <DropdownItem caption="Japanese" id="ja" />
                                                <DropdownItem caption="Korean" id="ko" />
                                                <DropdownItem caption="Vietnamese" id="vi" />
                                                <DropdownItem caption="Khmer" id="km" />
                                                <DropdownItem caption="Thai" id="th" />
                                                <DropdownItem caption="Lao" id="lo" />
                                                <DropdownItem caption="Indonesian" id="id" />
                                                <DropdownItem caption="Malay" id="ms" />
                                                <DropdownItem caption="Tagalog" id="tl" />
                                            </Dropdown>
                                        </Container>}
                                </Container>,
                            ],
                        },
                        {
                            id: "advancedModelSection",
                            caption: "Advanced Model Options",
                            stretch: false,
                            minSize: 190,
                            maxSize: 190,
                            expanded: advancedModelSection.expanded ?? false,
                            initialSize: modelSection.size ?? 190,
                            dimmed: false,
                            content: [
                                <Container className="scopeMultiItemColumn" orientation={Orientation.TopDown}
                                    mainAlignment={ContentAlignment.Start} crossAlignment={ContentAlignment.Stretch}>
                                    <Container className="scopeLabeledItem" orientation={Orientation.LeftToRight}>
                                        <Label className="scopeLabel" caption="Temperature:" />
                                        <Input id="temperature"
                                            value={String(modelOptions?.temperature !== undefined
                                                ? modelOptions.temperature : "")}
                                            onBlur={this.handleModelOptionChange} />
                                        <Label className="infoLbl" caption="(0.0 - 5.0)" />
                                    </Container>
                                    <Container className="scopeLabeledItem" orientation={Orientation.LeftToRight}>
                                        <Label className="scopeLabel" caption="Max Tokens:" />
                                        <Input id="maxTokens"
                                            value={String(modelOptions?.maxTokens !== undefined
                                                ? modelOptions.maxTokens : "")}
                                            onBlur={this.handleModelOptionChange} />
                                        <Label className="infoLbl" caption="(1 - 4096)" />
                                    </Container>
                                    <Container className="scopeLabeledItem" orientation={Orientation.LeftToRight}>
                                        <Label className="scopeLabel" caption="Top k:" />
                                        <Input id="topK"
                                            value={String(modelOptions?.topK !== undefined
                                                ? modelOptions?.topK : "")}
                                            onBlur={this.handleModelOptionChange} />
                                        <Label className="infoLbl" caption="(0 - 500)" />
                                    </Container>
                                    <Container className="scopeLabeledItem" orientation={Orientation.LeftToRight}>
                                        <Label className="scopeLabel" caption="Top p:" />
                                        <Input id="topP"
                                            value={String(modelOptions?.topP !== undefined
                                                ? modelOptions.topP : "")}
                                            onBlur={this.handleModelOptionChange} />
                                        <Label className="infoLbl" caption="(0.0 - 1.0)" />
                                    </Container>
                                    <Container className="scopeLabeledItem" orientation={Orientation.LeftToRight}>
                                        <Label className="scopeLabel" caption="Repeat Penalty:" />
                                        <Input id="repeatPenalty"
                                            value={String(modelOptions?.repeatPenalty !== undefined
                                                ? modelOptions.repeatPenalty : "")}
                                            onBlur={this.handleModelOptionChange} />
                                        <Label className="infoLbl" caption="(0.0 - 1.0)" />
                                    </Container>
                                    <Container className="scopeLabeledItem" orientation={Orientation.LeftToRight}>
                                        <Label className="scopeLabel" caption="Stop Sequences:" />
                                        <Input id="stopSequences"
                                            value={String(modelOptions?.stopSequences || "")}
                                            multiLine={true} multiLineCount={2}
                                            onBlur={this.handleModelOptionChange} />
                                    </Container>
                                </Container>,
                            ],
                        },
                        {
                            id: "promptSection",
                            caption: "Review Generated Prompt",
                            stretch: false,
                            minSize: 120,
                            maxSize: 200,
                            expanded: promptSection.expanded ?? false,
                            initialSize: promptSection.size ?? 54,
                            dimmed: false,
                            content: [
                                <Container className="scopeMultiItemColumn" orientation={Orientation.TopDown}>
                                    <Input className="generatedPrompt" multiLine={true} multiLineCount={5}
                                        value={options?.prompt ?? ""}
                                        spellCheck={false}
                                        onChange={this.handlePreambleChange} />
                                    <Toggle id="returnPromptToggle"
                                        caption="Capture generated prompt" checkState={options?.returnPrompt ?? false
                                            ? CheckState.Checked : CheckState.Unchecked}
                                        onChange={this.toggleReturnPrompt} />
                                </Container>,
                            ],
                        },
                        {
                            id: "languageSection",
                            caption: "Language Settings",
                            stretch: false,
                            minSize: 94,
                            maxSize: 94,
                            expanded: languageSection.expanded ?? false,
                            initialSize: languageSection.size ?? 94,
                            dimmed: false,
                            content: [
                                <Container className="scopeMultiItemColumn" orientation={Orientation.TopDown}
                                    mainAlignment={ContentAlignment.Start} crossAlignment={ContentAlignment.Stretch}>
                                    <Container className="scopeLabeledItem" orientation={Orientation.LeftToRight}>
                                        <Label className="scopeLabel" caption="Translation:" />
                                        <Dropdown className="scopeLanguage"
                                            selection={savedState.options?.languageOptions?.language ?? "noTranslation"}
                                            onSelect={this.handleTranslationLanguageChange}
                                            disabled={savedState.options?.modelOptions?.language !== "en" &&
                                                savedState.options?.modelOptions?.language !== undefined
                                            }>
                                            <DropdownItem id={"noTranslation"} caption={"No translation"} />
                                            <DropdownItem id={"English"} caption={"English"} />
                                            <DropdownItem id={"German"} caption={"German"} />
                                            <DropdownItem id={"Spanish"} caption={"Spanish"} />
                                            <DropdownItem id={"Portuguese"} caption={"Portuguese"} />
                                            <DropdownItem id={"Japanese"} caption={"Japanese"} />
                                            <DropdownItem id={"Italian"} caption={"Italian"} />
                                        </Dropdown>
                                    </Container>
                                    <Container className="scopeLabeledItem" orientation={Orientation.LeftToRight}>
                                        <Label className="scopeLabel" caption="Translation Model:" />
                                        <Dropdown className="scopeModel"
                                            selection={savedState.options?.languageOptions?.modelId ??
                                                "mistral-7b-instruct-v1"}
                                            onSelect={this.handleLanguageModelIdChange}>
                                            <DropdownItem id={"mistral-7b-instruct-v1"} caption={"Mistral"} />
                                        </Dropdown>
                                    </Container>
                                    <Toggle id="translateUserPromptToggle"
                                        caption="Only translate answers" checkState={
                                            options?.languageOptions?.translateUserPrompt ?? true
                                                ? CheckState.Unchecked : CheckState.Checked}
                                        onChange={this.toggleTranslateUserPrompt} />
                                </Container>,
                            ],
                        },
                    ]}
                    onSectionExpand={this.handleSectionExpand}
                />

                <Container className="scopeControls" orientation={Orientation.LeftToRight}
                    mainAlignment={ContentAlignment.End}>
                    <Button
                        caption="Save"
                        className="saveChatOptionsBtn"
                        onClick={this.handleSaveOptionsBtnClick}
                    />
                    <Button
                        caption="Load"
                        className="loadChatOptionsBtn"
                        onClick={this.handleLoadOptionsBtnClick}
                    />
                    <Button
                        caption="Start New Chat"
                        className="startNewChatBtn"
                        onClick={this.handleStartNewChatClick}
                    />
                </Container>
            </Container>

        );
    }

    private handleSectionExpand = (props: IAccordionProperties, sectionId: string, expanded: boolean): void => {
        const { savedState, onChatOptionsStateChange } = this.props;
        const sectionStates = savedState.sectionStates;

        const newMap = sectionStates ? new Map(sectionStates) : new Map<string, IChatOptionsSectionState>();
        const sectionState = newMap.get(sectionId) ?? {};
        sectionState.expanded = expanded;

        newMap.set(sectionId, sectionState);

        if (sectionId === "promptSection" && expanded === true && (
            savedState.options === undefined || savedState.options.returnPrompt === undefined ||
            savedState.options.returnPrompt === false)) {
            onChatOptionsStateChange({
                options: {
                    ...savedState.options,
                    returnPrompt: true,
                },
            });
        }

        onChatOptionsStateChange({ sectionStates: newMap });
    };

    private handleStartNewChatClick = (_e: MouseEvent | KeyboardEvent,
        _props: Readonly<IComponentProperties>): void => {
        const { onAction } = this.props;

        onAction(ChatOptionAction.StartNewChat);
    };

    private handleSaveOptionsBtnClick = (_e: MouseEvent | KeyboardEvent,
        _props: Readonly<IComponentProperties>): void => {
        const { onAction } = this.props;

        onAction(ChatOptionAction.SaveChatOptions);
    };

    private handleLoadOptionsBtnClick = (_e: MouseEvent | KeyboardEvent,
        _props: Readonly<IComponentProperties>): void => {
        const { onAction } = this.props;

        onAction(ChatOptionAction.LoadChatOptions);
    };

    private handleSchemaChange = (_accept: boolean, ids: Set<string>, _props: IDropdownProperties): void => {
        const { onChatOptionsStateChange, savedState } = this.props;
        const id = [...ids][0];

        onChatOptionsStateChange({
            options: {
                ...savedState.options,
                schemaName: id === "schemaDropdownAllSchemas" ? undefined : id,
            },
        });
    };

    private handleModelIdChange = (_accept: boolean, ids: Set<string>, _props: IDropdownProperties): void => {
        const { onChatOptionsStateChange, savedState } = this.props;
        const id = [...ids][0];

        const modelOptions = savedState.options?.modelOptions ?? {};
        modelOptions.modelId = id;

        onChatOptionsStateChange({
            options: {
                ...savedState.options,
                modelOptions,
            },
        });
    };

    private handleModelLanguageChange = (_accept: boolean, ids: Set<string>, _props: IDropdownProperties): void => {
        const { onChatOptionsStateChange, savedState } = this.props;
        const id = [...ids][0];

        const modelOptions = savedState.options?.modelOptions ?? {};
        modelOptions.language = id;

        // Disable translation for all languages other than english
        const languageOptions = savedState.options?.languageOptions;
        if (id !== "en" && languageOptions) {
            languageOptions.language = undefined;
        }

        onChatOptionsStateChange({
            options: {
                ...savedState.options,
                modelOptions,
                languageOptions,
            },
        });
    };

    private handleLanguageModelIdChange = (_accept: boolean, ids: Set<string>, _props: IDropdownProperties): void => {
        const { onChatOptionsStateChange, savedState } = this.props;
        const id = [...ids][0];

        const languageOptions = savedState.options?.languageOptions ?? {};
        languageOptions.modelId = id;

        onChatOptionsStateChange({
            options: {
                ...savedState.options,
                languageOptions,
            },
        });
    };

    private handlePreambleChange = (e: InputEvent, _props: IInputChangeProperties): void => {
        const { onChatOptionsStateChange, savedState } = this.props;

        onChatOptionsStateChange({
            options: {
                ...savedState.options,
                preamble: (e.target as HTMLInputElement).value,
            },
        });
    };

    private handleTranslationLanguageChange = (_accept: boolean, ids: Set<string>,
        _props: IDropdownProperties): void => {
        const { onChatOptionsStateChange, savedState } = this.props;
        const id = [...ids][0];

        const languageOptions = savedState.options?.languageOptions ?? {};
        languageOptions.language = id !== "noTranslation" ? id : undefined;

        onChatOptionsStateChange({
            options: {
                ...savedState.options,
                languageOptions,
            },
        });
    };

    private handleModelOptionChange = (e: FocusEvent, _props: Readonly<IComponentProperties>): void => {
        const { onChatOptionsStateChange, savedState } = this.props;

        const id = (e.target as HTMLInputElement).id;
        const modelOptions = savedState.options?.modelOptions ?? {};
        const value = (e.target as HTMLInputElement).value;

        // Ensure the id string is a valid key of the modelOptions
        if (!id || !(["temperature", "maxTokens", "topK", "topP", "repeatPenalty", "stopSequences"].includes(id))) {
            return;
        }

        let doUpdate = false;
        if (value === "") {
            (modelOptions as IDictionary)[id] = undefined;
        } else {
            // Explicit handling for stopSequences
            if (id === "stopSequences") {
                modelOptions.stopSequences = value.split("\n");
                doUpdate = true;
            } else {
                // All other modelOptions are numbers
                const val = parseFloat(value);
                if (!Number.isNaN(val)) {
                    (modelOptions as IDictionary)[id] = val;
                    doUpdate = true;
                }
            }
        }

        if (doUpdate) {
            onChatOptionsStateChange({
                options: {
                    ...savedState.options,
                    modelOptions,
                },
            });
        }
    };

    private removeVectorTable = (id: string, _props: ITagInputProperties): void => {
        const { onChatOptionsStateChange, savedState } = this.props;
        const newTables = savedState.options?.tables?.filter((table) => {
            return `${table.schemaName}.${table.tableName}` !== id;
        });

        onChatOptionsStateChange({
            options: {
                ...savedState.options,
                tables: newTables,
            },
        });
    };

    private toggleLockTableList = (_e: InputEvent, _checkState: CheckState): void => {
        const { onChatOptionsStateChange, savedState } = this.props;

        onChatOptionsStateChange({
            options: {
                ...savedState.options,
                lockTableList: !(savedState.options?.lockTableList ?? false),
            },
        });
    };

    private toggleReturnPrompt = (_e: InputEvent, _checkState: CheckState): void => {
        const { onChatOptionsStateChange, savedState } = this.props;

        onChatOptionsStateChange({
            options: {
                ...savedState.options,
                returnPrompt: !(savedState.options?.returnPrompt ?? false),
            },
        });
    };

    private toggleTranslateUserPrompt = (_e: InputEvent, _checkState: CheckState): void => {
        const { onChatOptionsStateChange, savedState } = this.props;

        const languageOptions = savedState.options?.languageOptions ?? {};
        languageOptions.translateUserPrompt = !(languageOptions.translateUserPrompt ?? true);

        onChatOptionsStateChange({
            options: {
                ...savedState.options,
                languageOptions,
            },
        });
    };

    private historyMessageColumnFormatter = (cell: CellComponent): string | HTMLElement => {
        const value = cell.getValue();

        const host = document.createElement("div");
        host.classList.add("itemField");

        const content = (<>
            <Label caption={value} />
            {/*<Icon className="iconOnMouseOver" src={Codicon.Edit}
                onClick={(e) => {
                    void this.handleHistoryTreeEdit(e, cell);
                }} />*/}
            <Icon className="iconOnMouseOver" src={Codicon.Close}
                onClick={(e) => {
                    void this.handleHistoryTreeDelete(e, cell);
                }} />

        </>);

        render(content, host);

        return host;
    };

    private handleDlgEditActionClick = (_e: MouseEvent | KeyboardEvent,
        props: Readonly<IComponentProperties>): void => {
        const { onChatOptionsStateChange, savedState } = this.props;

        const chatQueryHistory = savedState.chatQueryHistory;

        if (props.id === "ok" && chatQueryHistory) {
            const chatHistory = savedState.options?.chatHistory?.find((item) => {
                return item.chatQueryId === chatQueryHistory.chatQueryId;
            });
            if (chatHistory) {
                switch (chatQueryHistory.historyEntryType) {
                    case "userMessage":
                        chatHistory.userMessage = chatQueryHistory.updatedText;
                        break;
                    case "chatBotMessage":
                        chatHistory.chatBotMessage = chatQueryHistory.updatedText;
                        break;
                    default:
                        break;
                }
            }
            onChatOptionsStateChange({
                options: {
                    ...savedState.options,
                },
            });
        }
        this.#dialogRef.current?.close(props.id !== "ok");
    };

    private closeEditTextDialog = (cancelled: boolean): void => {
        const { onChatOptionsStateChange, savedState } = this.props;

        if (cancelled) {
            savedState.chatQueryHistory = undefined;
            onChatOptionsStateChange({
                chatQueryHistory: savedState.chatQueryHistory,
            });
        }
    };

    private handleHistoryValueChange = (e: InputEvent, props: IInputChangeProperties): void => {
        const { savedState, onChatOptionsStateChange } = this.props;

        const chatQueryHistory = savedState.chatQueryHistory;

        if (chatQueryHistory) {
            chatQueryHistory.updatedText = props.value;

            onChatOptionsStateChange({ chatQueryHistory });
        }
    };

    private handleHistoryTreeEdit = (_e: MouseEvent | KeyboardEvent, cell: CellComponent): void => {
        const { onChatOptionsStateChange, savedState } = this.props;

        const row = cell.getRow();
        const fieldId = cell.getField();
        const chatQueryId = row.getCell("chatQueryId").getValue();

        const chatEntry = savedState.options?.chatHistory?.find((item) => {
            return item.chatQueryId === chatQueryId;
        });
        const textToEdit = fieldId === "userMessage" ? chatEntry?.userMessage ?? ""
            : chatEntry?.chatBotMessage ?? "";

        const chatQueryHistory: IHistoryEntry = {
            chatQueryId,
            historyEntryType: fieldId,
            originalText: textToEdit,
            updatedText: textToEdit,
        };

        if (this.#dialogRef.current) {
            this.#dialogRef.current.open();
        }
        onChatOptionsStateChange({
            chatQueryHistory,
        });
    };

    private handleHistoryTreeDelete = (_e: MouseEvent | KeyboardEvent, cell: CellComponent): void => {
        const { onChatOptionsStateChange, savedState } = this.props;

        // Get chatQueryId
        const row = cell.getRow();
        const chatQueryId = row.getCell("chatQueryId").getValue();

        // Filter it out
        const chatHistory = savedState.options?.chatHistory?.filter((item) => {
            return item.chatQueryId !== chatQueryId;
        });

        onChatOptionsStateChange({
            options: {
                ...savedState.options,
                chatHistory,
            },
        });
    };
}
