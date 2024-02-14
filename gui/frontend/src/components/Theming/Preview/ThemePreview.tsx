/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

import "./ThemePreview.css";

import code from "./assets/code-examples.txt?raw";
import exampleBlocks from "./assets/code-block-example.json";
import gearIcon from "../../../assets/images/settings.svg";
import closeIcon from "../../../assets/images/close.svg";
import imageImage from "../Preview/assets/image.svg";

import { ComponentChild } from "preact";

import { TablePreview } from "./TablePreview.js";

import { DialogContent } from "../../ui/Dialog/DialogContent.js";
import { ActivityBar } from "../../ui/ActivityBar/ActivityBar.js";
import { ActivityBarItem } from "../../ui/ActivityBar/ActivityBarItem.js";
import { SymbolGrid } from "./SymbolGrid.js";
import { CodeEditor, ICodeEditorModel, IEditorPersistentState } from "../../ui/CodeEditor/CodeEditor.js";
import { CodeEditorMode, Monaco } from "../../ui/CodeEditor/index.js";
import { Notebook } from "../../../modules/db-editor/Notebook.js";
import { ExecutionContexts } from "../../../script-execution/ExecutionContexts.js";
import { MySQLConnectionScheme } from "../../../communication/MySQL.js";
import { DBType } from "../../../supplement/ShellInterface/index.js";
import { EditorLanguage } from "../../../supplement/index.js";
import { IDictionary } from "../../../app-logic/Types.js";

import { loremIpsum } from "../../../tests/unit-tests/test-helpers.js";
import { Accordion } from "../../ui/Accordion/Accordion.js";
import { Breadcrumb } from "../../ui/Breadcrumb/Breadcrumb.js";
import { BrowserTileType } from "../../ui/BrowserTile/BrowserTile.js";
import { Checkbox, CheckState } from "../../ui/Checkbox/Checkbox.js";
import { IComponentState, ComponentBase, ComponentSize } from "../../ui/Component/ComponentBase.js";
import { ConnectionTile } from "../../ui/ConnectionTile/ConnectionTile.js";
import { Container, Orientation, ContentAlignment, ContentWrap } from "../../ui/Container/Container.js";
import { Divider } from "../../ui/Divider/Divider.js";
import { Dropdown } from "../../ui/Dropdown/Dropdown.js";
import { Grid } from "../../ui/Grid/Grid.js";
import { GridCell } from "../../ui/Grid/GridCell.js";
import { Icon } from "../../ui/Icon/Icon.js";
import { Input } from "../../ui/Input/Input.js";
import { Label } from "../../ui/Label/Label.js";
import { MenuBar } from "../../ui/Menu/MenuBar.js";
import { MenuItem } from "../../ui/Menu/MenuItem.js";
import { ProgressIndicator } from "../../ui/ProgressIndicator/ProgressIndicator.js";
import { Radiobutton } from "../../ui/Radiobutton/Radiobutton.js";
import { Search } from "../../ui/Search/Search.js";
import { Tabview, TabPosition } from "../../ui/Tabview/Tabview.js";
import { TagInput } from "../../ui/TagInput/TagInput.js";
import { Toolbar } from "../../ui/Toolbar/Toolbar.js";
import { Button } from "../../ui/Button/Button.js";
import { ISavedEditorState } from "../../../modules/db-editor/DBConnectionTab.js";
import { EntityType } from "../../../modules/db-editor/index.js";
import { JsonView } from "../../ui/JsonView/JsonView.js";

interface IThemePreviewState extends IComponentState {
    editorLanguage: EditorLanguage;
    codeExamples: IDictionary;
}

/** A component that contains UI elements for preview in the theme editor. */
export class ThemePreview extends ComponentBase<{}, IThemePreviewState> {
    #savedState: ISavedEditorState;

    public constructor(props: {}) {
        super(props);

        const delimiter = /(<< ([a-z]+) >>)+/g;
        let matches = delimiter.exec(code);
        let start = delimiter.lastIndex;
        let currentLanguage = matches ? matches[2] : "";

        const codeExamples: { [key: string]: string; } = {};
        let actualCode = code;
        if (typeof code !== "string") {
            // In Jest the file is imported as a transformer object, not as string.
            actualCode = "";
        }

        do {
            matches = delimiter.exec(actualCode);
            if (matches) {
                codeExamples[currentLanguage] = actualCode.substring(start, delimiter.lastIndex - matches[1].length);
                start = delimiter.lastIndex + 1;
                currentLanguage = matches[2];
            } else {
                // Reached the end of the input. Copy the last part as well.
                codeExamples[currentLanguage] = actualCode.substring(start, actualCode.length - 1);
                break;
            }
        } while (true);

        this.state = {
            editorLanguage: "javascript",
            codeExamples,
        };

        let content = `\nprint("typescript");\n\\js\n`;
        content += `\nprint("javascript");\n\\sql\n`;
        content += `\nselect "(my)sql" from dual;\n\\py\n`;
        content += `\nprint("python");\n`;

        const model: ICodeEditorModel = Object.assign(Monaco.createModel(content, "javascript"), {
            executionContexts: new ExecutionContexts(undefined, 80024, "", ""),
            editorMode: CodeEditorMode.Standard,
        });

        if (model.getEndOfLineSequence() !== Monaco.EndOfLineSequence.LF) {
            model.setEOL(Monaco.EndOfLineSequence.LF);
        } else {
            model.setValue(content);
        }

        model.setValue(content);

        const editorState: IEditorPersistentState = {
            model,
            contextStates: exampleBlocks.map((block) => {
                return {
                    start: block.start,
                    end: block.end,
                    language: block.language as EditorLanguage,
                    defaultHeight: block.defaultHeight ?? 0,
                    statements: [],
                };
            }),
            viewState: null,
            options: {
                tabSize: 4,
                indentSize: 4,
                insertSpaces: true,

                defaultEOL: "LF",
                trimAutoWhitespace: true,
            },
        };

        this.#savedState = {
            editors: [{
                type: EntityType.Notebook,
                id: "1",
                caption: "Test",
                currentVersion: 1,
                state: editorState,
            }],
            activeEntry: "1",
            heatWaveEnabled: false,
            connectionId: -1,
        };
    }

    public render(): ComponentChild {
        const { editorLanguage, codeExamples } = this.state;
        const codeExample = codeExamples[editorLanguage] as string;

        return (
            <Container
                id="previewRoot"
                orientation={Orientation.TopDown}
            >
                <Label id="previewTitle" data-tooltip="">THEME PREVIEW</Label>

                <p>Base Colors</p>
                <Grid columns={2} columnGap="20px" rowGap="20px">
                    <GridCell>
                        <Label className="manualFocus" style={{ padding: "15px", flex: "0 0 300px" }}>
                            Text with manual focus border
                        </Label>
                    </GridCell>
                    <GridCell>
                        <Input placeholder="Select to view real focus border" style={{ flex: "0 0 300px" }} />
                    </GridCell>
                    <GridCell>
                        <div style={{ width: "60px" }} >
                            <Label className="rotated">Description</Label>
                        </div>
                        <Label className="description">
                            {loremIpsum}
                        </Label>
                    </GridCell>
                    <GridCell>
                        <div style={{ width: "30px" }} >
                            <Label className="rotated">Icon</Label>
                        </div>
                        <Icon src={gearIcon} width={64} height={64} style={{ marginLeft: "20px" }} />
                    </GridCell>
                </Grid>

                <p>Window / Dialog</p>
                <Container
                    id="dialogHost"
                >
                    <DialogContent
                        caption={
                            <>
                                <Icon src={gearIcon} />
                                <Label>Window Title</Label>
                            </>
                        }
                        header={
                            <>
                                <Label>A Standalone Modal Window</Label>
                                <Label>The window's sub title goes here and also allows for longer descriptions.</Label>
                            </>
                        }
                        content={
                            <Label>All the main content of the window/dialog goes here.</Label>
                        }
                        actions={{
                            begin: [
                                <Checkbox
                                    caption="Show Advanced Entries"
                                    id="test"
                                    key="text"
                                    checkState={CheckState.Unchecked}
                                />,
                            ],
                            end: [
                                <Button
                                    caption="Cancel"
                                    id="cancel"
                                    key="cancel"
                                />,
                                <Button caption="OK" id="ok" key="ok" />,
                            ],
                        }}
                    />
                </Container>

                <p>Plain Text / Label</p>
                <Grid columns={2} columnGap="20px" rowGap="30px">
                    <GridCell>
                        <div style={{ width: "60px" }} >
                            <Label className="rotated">Block Quote</Label>
                        </div>
                        <Label quoted={true} size={ComponentSize.Big}>
                            Mark this text quote as something important.
                        </Label>
                    </GridCell>
                    <GridCell>
                        <div style={{ width: "60px" }} >
                            <Label className="rotated">Inline Code</Label>
                        </div>
                        <Label code style={{ flex: "1" }}>var a = 1 + 2;</Label>
                    </GridCell>
                    <GridCell>
                        <div style={{ width: "60px" }} >
                            <Label className="rotated">Link</Label>
                        </div>
                        <Label>Text with a <a href="https://www.mysql.com">link</a></Label>
                    </GridCell>
                    <GridCell>
                        <div style={{ width: "60px", height: "60px" }} >
                            <Label className="rotated">Separator</Label>
                        </div>
                        <Container orientation={Orientation.TopDown}>
                            <Label id="separated">{loremIpsum}</Label>
                        </Container>
                    </GridCell>
                    <GridCell>
                        <div style={{ width: "60px" }} >
                            <Label className="rotated">Caption</Label>
                        </div>
                        <Label heading>Lorem ipsum dolor sit amet</Label>
                    </GridCell>
                    <GridCell>
                        <div style={{ width: "60px", height: "60px" }} >
                            <Label className="rotated">Disabled</Label>
                        </div>
                        <Label disabled>Lorem ipsum dolor sit amet</Label>
                    </GridCell>
                </Grid>

                <p>Button</p>
                <Grid columns={2} columnGap="20px" rowGap="30px">
                    <GridCell orientation={Orientation.TopDown}>
                        <div style={{ width: "60px" }} >
                            <Label className="rotated">Normal</Label>
                        </div>
                        <Button id="button1" caption="Enabled Button" />
                        <Checkbox checkState={CheckState.Checked}>
                            Enabled Checkbox&nbsp;&nbsp;&nbsp;
                        </Checkbox>
                        <Radiobutton checkState={CheckState.Checked}>
                            Enabled Radiobutton
                        </Radiobutton>
                    </GridCell>
                    <GridCell orientation={Orientation.TopDown}>
                        <div style={{ width: "60px" }} >
                            <Label className="rotated">Disabled</Label>
                        </div>
                        <Button id="button1" caption="Disabled Button" disabled />
                        <Checkbox checkState={CheckState.Checked} disabled>
                            Disabled Checkbox&nbsp;&nbsp;&nbsp;
                        </Checkbox>
                        <Radiobutton checkState={CheckState.Checked} disabled>
                            Disabled Radiobutton
                        </Radiobutton>
                    </GridCell>

                </Grid>

                <p>Dropdown</p>
                <Dropdown selection="tesla" optional={false} style={{ maxWidth: "300px" }}>
                    <Dropdown.Item id="tesla" caption="Tesla" />
                    <Dropdown.Item id="volvo" caption="Volvo" />
                    <Dropdown.Item id="bmw" caption="BMW" />
                    <Dropdown.Item id="renault" caption="Renault" />
                </Dropdown>

                <p>Input</p>
                <Grid columns={3} columnGap={20}>
                    <GridCell><Input className="fill" placeholder="Enter something" /></GridCell>
                    <GridCell><Input className="fill" disabled placeholder="Disabled input" /></GridCell>
                    <GridCell><Search /></GridCell>
                </Grid>

                <p>Tag List</p>
                <TagInput
                    tags={[
                        { id: "tag1", caption: "Einstein" },
                        { id: "tag2", caption: "Boole" },
                        { id: "tag3", caption: "Aristotle" },
                        { id: "tag4", caption: "Archimedes" },
                        { id: "tag5", caption: "Newton" },
                        { id: "tag6", caption: "Plato" },
                        { id: "tag7", caption: "Bohr" },
                        { id: "tag8", caption: "Curie" },
                        { id: "tag9", caption: "Euclid from Alexandria" },
                    ]}
                    removable={false}
                    style={{ maxWidth: "300px" }}
                />

                <p>Progress Indicator</p>
                <Grid id="progress" columns={2} columnGap={20} rowGap={30}>
                    <GridCell orientation={Orientation.TopDown}>
                        <Label>Linear determinate (75%)</Label>
                        <ProgressIndicator linear={true} position={.75} indicatorWidth={180} />
                    </GridCell>
                    <GridCell orientation={Orientation.TopDown}>
                        <Label>Linear indeterminate</Label>
                        <ProgressIndicator
                            linear={true}
                            indicatorWidth={180} />
                    </GridCell>
                    <GridCell orientation={Orientation.TopDown}>
                        <Label>Circular determinate (33%)</Label>
                        <ProgressIndicator linear={false} position={.33} />
                    </GridCell>
                    <GridCell orientation={Orientation.TopDown}>
                        <Label>Circular indeterminate</Label>
                        <ProgressIndicator linear={false} indicatorWidth={100} indicatorHeight={100} />
                    </GridCell>
                </Grid>

                <p>Grid / Table</p>
                <Container
                    orientation={Orientation.TopDown}
                >
                    <TablePreview />
                </Container>

                <p>Activity Bar + Side Bar</p>
                <Grid columns={["140px", "auto"]} columnGap={20} id="activityBarHost">
                    <ActivityBar id="activityBar" borderWidth={2}>
                        <ActivityBarItem image={gearIcon} caption="Section 1" />
                        <ActivityBarItem image={gearIcon} active caption="Section 2" />
                        <ActivityBarItem image={gearIcon} expand={true} caption="Section 4" />
                    </ActivityBar>
                    <Accordion
                        id="sidebar1"
                        style={{
                            borderWidth: "1px",
                            borderStyle: "solid",
                        }}
                        caption="SIDEBAR TITLE"
                        footer={loremIpsum}
                        singleExpand={true}

                        sections={[
                            {
                                caption: "FIRST SECTION",
                                id: "first",
                                expanded: false,
                                content: [
                                    <Accordion.Item id="item1" key="item1" caption="Item 1" />,
                                    <Accordion.Item id="item2" key="item2" caption="Item 2" />,
                                    <Accordion.Item id="item3" key="item3" caption="Item 3" />,
                                ],
                            },
                            {
                                caption: "SECOND SECTION",
                                id: "second",
                                content: [
                                    <Accordion.Item id="item5" key="item5" caption="Item 5" picture={imageImage} />,
                                    <Accordion.Item id="item6" key="item6" caption="Item 6" picture={imageImage} />,
                                    <Accordion.Item id="item7" key="item7" caption="Item 7" picture={imageImage} />,
                                ],
                            },
                            {
                                caption: "THIRD SECTION",
                                id: "third",
                                content: [
                                    <Accordion.Item id="item9" key="item9" caption="Item 9" />,
                                    <Accordion.Item id="item10" key="item10" caption="Item 10" />,
                                    <Accordion.Item id="item11" key="item11" caption="Item 11" />,
                                ],
                            },
                        ]}
                    />
                </Grid>

                <p>Tabview</p>
                <Container
                    orientation={Orientation.TopDown}
                >
                    <Tabview
                        id="tabview1"
                        tabPosition={TabPosition.Top}
                        tabBorderWidth={1}
                        contentSeparatorWidth={2}
                        pages={[
                            {
                                caption: "Tab 1",
                                id: "page1",
                                content: <Label>{loremIpsum}</Label>,
                                icon: gearIcon,
                                auxillary: <Button id="page1" className="closeButton" round={true}>
                                    <Icon src={closeIcon} />
                                </Button>,
                            },
                            {
                                caption: "Tab 2",
                                id: "page2",
                                content: <Label>Content</Label>,
                                icon: gearIcon,
                                auxillary: <Button id="page2" className="closeButton" round={true}>
                                    <Icon src={closeIcon} />
                                </Button>,
                            },

                        ]}
                        selectedId="page1"
                        stretchTabs={false}
                        canReorderTabs={true}
                    />
                </Container>


                <p>JSON View</p>
                <JsonView
                    json={codeExamples.json as string}
                />

                <p>Code Editor</p>
                <Container
                    orientation={Orientation.TopDown}
                    style={{ height: "500px", marginTop: "10px" }}
                >
                    <Container
                        orientation={Orientation.LeftToRight}
                        crossAlignment={ContentAlignment.Center}
                        id="editorControlHost"
                    >
                        <Label caption="Select Editor Language: " />
                        <Dropdown
                            id="editorLanguagePicker"
                            selection={editorLanguage}
                            onSelect={(selectedIds: Set<string>): void => {
                                this.setState({ editorLanguage: [...selectedIds][0] as EditorLanguage });
                            }}
                        >
                            <Dropdown.Item id="javascript" caption="JavaScript" />
                            <Dropdown.Item id="typescript" caption="TypeScript" />
                            <Dropdown.Item id="mysql" caption="MySQL" />
                            <Dropdown.Item id="json" caption="JSON" />
                            <Dropdown.Item id="markdown" caption="Markdown" />
                            <Dropdown.Item id="ini" caption="Ini" />
                            <Dropdown.Item id="xml" caption="XML" />
                        </Dropdown>
                    </Container>
                    <CodeEditor
                        language={editorLanguage}
                        minimap={{
                            enabled: true,
                        }}
                        font={{
                            fontFamily: "SourceCodePro+Powerline+Awesome+MySQL",
                            fontSize: 15,
                            lineHeight: 24,
                        }}
                        scrollbar={{
                            useShadows: true,
                            verticalHasArrows: false,
                            horizontalHasArrows: false,
                            vertical: "auto",
                            horizontal: "auto",

                            verticalScrollbarSize: 12,
                            horizontalScrollbarSize: 12,
                        }}
                        lineNumbers="on"
                        initialContent={codeExample}
                        showIndentGuides
                    />

                </Container>

                <p>Mixed Language Code Editor with Embedded Results</p>
                <Container
                    orientation={Orientation.TopDown}
                >
                    <Notebook
                        savedState={this.#savedState}
                        dbType={DBType.MySQL}
                        readOnly={true}
                        showAbout={true}
                        standaloneMode={false}
                        toolbarItemsTemplate={{ navigation: [], execution: [], editor: [], auxillary: [] }}
                    />
                </Container>

                <p>Browser Tiles</p>
                <Container>
                    <ConnectionTile
                        tileId={1}
                        details={{
                            id: 1,
                            dbType: DBType.MySQL,
                            version: 0,
                            useSSH: false,
                            useMDS: false,
                            caption: "First Tile",
                            description: loremIpsum,
                            options: {
                                scheme: MySQLConnectionScheme.MySQL,
                                user: "root",
                                host: "localhost",
                            },
                        }}
                        caption="First Tile"
                        description={loremIpsum}
                        type={BrowserTileType.Open}
                        icon={gearIcon}
                    />
                    <ConnectionTile
                        type={BrowserTileType.CreateNew}
                        tileId={2}
                        details={{
                            id: 2,
                            dbType: DBType.MySQL,
                            version: 0,
                            useSSH: false,
                            useMDS: false,
                            caption: "Second Tile",
                            description: "A description for this tile",
                            options: {
                                scheme: MySQLConnectionScheme.MySQL,
                                user: "root",
                                host: "localhost",
                            },
                        }}
                        caption="Second Tile"
                        description="A description for this tile"
                        icon={gearIcon}
                    />
                </Container>

                <p>Title Bar</p>
                <Container
                    orientation={Orientation.TopDown}
                >
                    <Toolbar
                        id="toolbar1"
                        vibrant={true}
                        dropShadow={true}
                    >
                        <Label>Title Bar</Label>
                        <Divider vertical={true} />
                        <Search />
                        <Dropdown selection="English">
                            <Dropdown.Item id="English" caption="English" />
                            <Dropdown.Item id="Polish" caption="Polish" />
                            <Dropdown.Item id="Portuguese" caption="Portuguese" />
                            <Dropdown.Item id="German" caption="German" />
                        </Dropdown>
                        <Button>LOGIN</Button>
                        <Icon src={gearIcon} />
                    </Toolbar>
                </Container>

                <p>Menu + Menubar</p>
                <Container
                    orientation={Orientation.TopDown}
                >
                    <MenuBar>
                        <MenuItem id="fileMenu" caption="File">
                            <MenuItem id="item80" caption="Item 1" />
                            <MenuItem id="item81" caption="Item 2" />
                            <MenuItem id="item82" caption="Item 3" />
                            <MenuItem id="item83" caption="-" />
                            <MenuItem id="item84" caption="Item 4" />
                            <MenuItem id="item65" icon={gearIcon} caption="Sub Menu 2">
                                <MenuItem id="item70" caption="Item 1" />
                                <MenuItem id="item71" caption="Item 2" />
                                <MenuItem id="item72" caption="Item 3" />
                                <MenuItem id="item73" caption="-" />
                                <MenuItem id="item74" caption="Item 4" />
                                <MenuItem id="item75" icon={gearIcon} caption="Sub Menu 2">
                                    <MenuItem id="item80" caption="Item 1" />
                                    <MenuItem id="item81" caption="Item 2" />
                                    <MenuItem id="item82" caption="Item 3" />
                                    <MenuItem id="item83" caption="-" />
                                    <MenuItem id="item84" caption="Item 4" />
                                    <MenuItem id="item85" icon={gearIcon} caption="Item 5" />
                                </MenuItem>
                            </MenuItem>
                        </MenuItem>
                        <MenuItem id="editMenu" caption="Edit">
                            <MenuItem id="item80" caption="Item 1" />
                            <MenuItem id="item81" caption="Item 2" />
                            <MenuItem id="item82" caption="Item 3" />
                            <MenuItem id="item83" caption="-" />
                            <MenuItem id="item84" caption="Item 4" />
                        </MenuItem>
                        <MenuItem id="selectionMenu" caption="Selection">
                            <MenuItem id="item80" caption="Item 1" />
                            <MenuItem id="item81" caption="Item 2" />
                            <MenuItem id="item82" caption="Item 3" />
                            <MenuItem id="item83" caption="-" />
                            <MenuItem id="item84" caption="Item 4" />
                        </MenuItem>
                    </MenuBar>
                </Container>

                <p>Terminal Colors</p>
                <Label caption="Foreground" id="terminalPreviewCaption" />
                <Container
                    id="terminalPreview"
                    orientation={Orientation.LeftToRight}
                    wrap={ContentWrap.Wrap}
                >
                    <span className="ansi-bold">bold</span>
                    <span className="ansi-black-fg">black</span>
                    <span className="ansi-red-fg">red</span>
                    <span className="ansi-green-fg">green</span>
                    <span className="ansi-yellow-fg">yellow</span>
                    <span className="ansi-blue-fg">blue</span>
                    <span className="ansi-magenta-fg">magenta</span>
                    <span className="ansi-cyan-fg">cyan</span>
                    <span className="ansi-white-fg">white</span>
                    <span className="ansi-bright-black-fg">bright-black</span>
                    <span className="ansi-bright-red-fg">bright-red</span>
                    <span className="ansi-bright-green-fg">bright-green</span>
                    <span className="ansi-bright-yellow-fg">bright-yellow</span>
                    <span className="ansi-bright-blue-fg">bright-blue</span>
                    <span className="ansi-bright-magenta-fg">bright-magenta</span>
                    <span className="ansi-bright-cyan-fg">bright-cyan</span>
                    <span className="ansi-bright-white-fg">bright-white</span>
                    <span id="cursor"><span id="inner" /></span>
                </Container>

                <Label caption="Background" id="terminalPreviewCaption" />
                <Container
                    id="terminalPreview"
                    orientation={Orientation.LeftToRight}
                    wrap={ContentWrap.Wrap}
                >
                    <span className="ansi-black-bg">black</span>
                    <span className="ansi-red-bg">red</span>
                    <span className="ansi-green-bg">green</span>
                    <span className="ansi-yellow-bg">yellow</span>
                    <span className="ansi-blue-bg">blue</span>
                    <span className="ansi-magenta-bg">magenta</span>
                    <span className="ansi-cyan-bg">cyan</span>
                    <span className="ansi-white-bg">white</span>
                </Container>

                <p>ANSI Escapes Output Rendering</p>
                <Container
                    id="ansiPreview"
                    orientation={Orientation.LeftToRight}
                    wrap={ContentWrap.Wrap}
                >
                    <Label language="ansi" code>{"\u001b[1mBold\u001b[0m \u001b[38;5;201mHello\u001b[39m" +
                        "\u001b[48;5;214m\u001b[38;5;0mWorld\n" +
                        "\u001b[38;2;55;155;0mRGB Color\u001b[49m, \u001b[9mStrike Through\u001b[29m, " +
                        "\u001b[4m\u001b[38;2;155;55;0mUnderline, \u001b[7mInverse\u001b[27m\u001b[24m, " +
                        "\u001b[38;5;68m\u001b[5mBlinking"
                    }</Label>
                </Container>

                <p>Breadcrumb</p>
                <Container
                    orientation={Orientation.TopDown}
                >
                    <Breadcrumb
                        id="breadcrumb1"
                        path={["base", "folder", "sub-folder", "another folder"]}
                        selected={2}
                    />
                </Container>

                <p>Symbols</p>
                <SymbolGrid />

                <div style={{ width: "100%", minHeight: "100px" }} />
            </Container >
        );
    }
}
