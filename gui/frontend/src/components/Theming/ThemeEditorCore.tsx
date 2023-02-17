/*
 * Copyright (c) 2020, 2023, Oracle and/or its affiliates.
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

import addTheme from "../../assets/images/add.svg";
import removeTheme from "../../assets/images/remove.svg";
import importTheme from "../../assets/images/import.svg";
import exportTheme from "../../assets/images/export.svg";

import { ComponentChild, createRef } from "preact";
import Color from "color";

import { IThemeObject, ThemeManager } from "./ThemeManager";
import { ValueEditDialog, IDialogValues, IDialogValidations, IDialogSection } from "../Dialogs/ValueEditDialog";
import { selectFile, saveTextAsFile } from "../../utilities/helpers";
import { Settings } from "../../supplement/Settings/Settings";
import { ThemeEditorLists } from "./ThemeEditorLists";
import { requisitions } from "../../supplement/Requisitions";
import { DialogResponseClosure } from "../../app-logic/Types";
import { Checkbox, CheckState } from "../ui/Checkbox/Checkbox";
import { ColorField, IColorFieldProperties } from "../ui/ColorPicker/ColorField";
import { IComponentProperties, IComponentState, ComponentBase } from "../ui/Component/ComponentBase";
import { Container, Orientation, ContentAlignment } from "../ui/Container/Container";
import { Dropdown } from "../ui/Dropdown/Dropdown";
import { Grid } from "../ui/Grid/Grid";
import { GridCell } from "../ui/Grid/GridCell";
import { Icon } from "../ui/Icon/Icon";
import { Label } from "../ui/Label/Label";
import { Button } from "../ui/Button/Button";

interface IThemeEditorCoreProperties extends IComponentProperties {
    onThemeChange: () => void;
}

interface IThemeEditorCoreState extends IComponentState {
    showUnusedColors: boolean;
    themes: string[];
}

export class ThemeEditorCore extends ComponentBase<IThemeEditorCoreProperties, IThemeEditorCoreState> {
    private colorPadColors: string[] = [];

    private themeDropdownRef = createRef<Dropdown>();
    private themeNameDialogRef = createRef<ValueEditDialog>();

    private themeManager: ThemeManager;

    public constructor(props: IThemeEditorCoreProperties) {
        super(props);

        this.themeManager = ThemeManager.get;

        this.state = {
            showUnusedColors: false,
            themes: this.themeManager.installedThemes,
        };

        this.initializeColorPad();
    }

    public componentDidMount(): void {
        requisitions.register("settingsChanged", this.settingsChanged);
        requisitions.register("themeChanged", this.handleThemeChange);
    }

    public componentWillUnmount(): void {
        requisitions.unregister("settingsChanged", this.settingsChanged);
        requisitions.unregister("themeChanged", this.handleThemeChange);
    }

    public render(): ComponentChild {
        const { showUnusedColors, themes } = this.state;

        const className = this.getEffectiveClassNames(["themeEditor"]);
        const themeList = themes.map((theme: string) => {
            return <Dropdown.Item caption={theme} key={theme} id={theme} />;
        },
        );

        return (
            <Container
                className={className}
                orientation={Orientation.TopDown}
            >
                <Label className="title" data-tooltip="">THEME EDITOR</Label>
                <Label className="description">
                    Here you can modify any visually related aspects of your application. Define complex color
                    themes for the user interface and set your preferred colors for editor syntax highlighting.
                    <br /><br />
                    <b>Note:</b> You can import and export Visual Studio Code color themes, but keep in mind that
                    some of the colors needed here may not be defined in the theme.
                </Label>
                <Grid
                    id="themeSelectorContainer"
                    className="verticalCenterContent"
                    columns={[120, "auto", 64]}
                    rowGap={10}
                >
                    <GridCell>
                        <Label>Theme</Label>
                    </GridCell>
                    <GridCell
                        orientation={Orientation.LeftToRight}
                        crossAlignment={ContentAlignment.Center}
                    >
                        <Dropdown
                            ref={this.themeDropdownRef}
                            className="themeSelector"
                            selection={this.themeManager.activeTheme}
                            onSelect={this.handleThemeSwitch}
                        >
                            {themeList}
                        </Dropdown>
                    </GridCell>

                    {this.renderThemeActionsCell()}
                    {this.renderColorPad()}

                    <GridCell />

                    <GridCell columnSpan={3}>
                        <Checkbox
                            caption="Show theme colors not used in the application"
                            id="showUnusedColors"
                            checkState={showUnusedColors ? CheckState.Checked : CheckState.Unchecked}
                            onChange={(checkState: CheckState): void => {
                                this.setState({ showUnusedColors: checkState === CheckState.Checked });
                            }}
                        />
                    </GridCell>
                </Grid>

                <ThemeEditorLists
                    showUnusedColors={showUnusedColors}
                    onThemeChange={
                        (): void => { this.props.onThemeChange(); }
                    }
                />
            </Container>
        );
    }

    /**
     * Renders the action buttons for the theme selector row.
     *
     * @returns The React element for the action buttons.
     */
    private renderThemeActionsCell(): ComponentChild {
        const isDefaultTheme = this.themeManager.activeTheme === "Default Dark"
            || this.themeManager.activeTheme === "Default Light";

        return <GridCell
            id="themeActions"
        >
            <Grid
                columns={2}
                rowGap={2}
                columnGap={2}
            >
                <GridCell>
                    <Button
                        id="button1"
                        data-tooltip="Import Visual Studio Code theme file"
                        onClick={this.importTheme}
                    >
                        <Icon src={importTheme} data-tooltip="inherit" />
                    </Button>
                </GridCell>
                <GridCell>
                    <Button
                        id="button2"
                        data-tooltip="Export current theme as Visual Studio Code theme file"
                        onClick={this.exportCurrentTheme}
                    >
                        <Icon src={exportTheme} data-tooltip="inherit" />
                    </Button>
                </GridCell>
                <GridCell>
                    <ValueEditDialog
                        ref={this.themeNameDialogRef}
                        onValidate={this.validateThemeName}
                        onClose={this.executeThemeDuplication}
                    />
                    <Button
                        id="button3"
                        data-tooltip="Duplicate current theme"
                        onClick={this.handleThemeDuplication}
                    >
                        <Icon src={addTheme} data-tooltip="inherit" />
                    </Button>
                </GridCell>
                <GridCell>
                    <Button
                        id="button4"
                        data-tooltip="Delete current theme"
                        onClick={this.removeCurrentTheme}
                        disabled={isDefaultTheme}
                    >
                        <Icon src={removeTheme} data-tooltip="inherit" />
                    </Button>
                </GridCell>
            </Grid>
        </GridCell>;
    }

    private handleThemeChange = (): Promise<boolean> => {
        setTimeout(() => {
            // Re-render delayed
            this.setState({ themes: this.themeManager.installedThemes });
        }, 500);

        // No need to wait for the re-render here.
        return Promise.resolve(true);
    };

    private settingsChanged = (entry?: { key: string; value: unknown; }): Promise<boolean> => {
        if (!entry || entry.key === "" || entry.key.startsWith("theming.")) {
            this.initializeColorPad();

            return Promise.resolve(true);
        }

        return Promise.resolve(false);
    };

    private renderColorPad(): ComponentChild {
        const fields = this.colorPadColors.map((color: string, index: number) => {
            return <ColorField
                key={`field${index}`}
                id={index.toString()}
                initialColor={color.length > 0 ? new Color(color) : undefined}
                onChange={this.handleColorPadChange}
            />;
        });

        return (
            <>
                <GridCell><Label>Color Pad</Label></GridCell>
                <GridCell
                    id="colorPadCell"
                    orientation={Orientation.LeftToRight}
                >
                    {fields}
                </GridCell>
            </>
        );
    }

    private handleColorPadChange = (color: Color | undefined, props: IColorFieldProperties): void => {
        const index = props.id ? parseInt(props.id, 10) : 0;
        this.colorPadColors[index] = color?.hexa() ?? "";

        Settings.set("theming.colorPadColors", this.colorPadColors);
        Settings.saveSettings();
    };

    private handleThemeSwitch = (ids: Set<string>): void => {
        const html = document.getElementsByTagName("html");
        html[0].classList.add("themeSwitch");
        setTimeout(() => { html[0].classList.remove("themeSwitch"); }, 500);

        this.themeManager.activeTheme = [...ids][0];
    };

    private importTheme = (): void => {
        void selectFile("application/json", false).then((file: File | File[] | null): void => {
            const reader = new FileReader();
            reader.onload = (): void => {
                const text = reader.result as string;
                if (text) {
                    try {
                        // Remove possible single line comments first.
                        const json = text.replace(/\/\/\s*[^"\n\r]*$/gm, "");
                        const theme = JSON.parse(json) as IThemeObject;
                        const themeId = this.themeManager.loadThemeDetails(theme, true);
                        this.themeManager.activeTheme = themeId;
                        this.forceUpdate();
                    } catch (e) {
                        if (e instanceof Error) {
                            const message: string = e.toString() || "";
                            alert(`Error while parsing JSON data: \n${message}`);
                        }
                    }
                } else {
                    alert("Cannot read theme file");
                }
            };
            if (file instanceof File) {
                reader.readAsText(file, "utf-8");
            }
        });
    };

    private exportCurrentTheme = (): void => {
        this.themeManager.saveTheme();

        const text = this.themeManager.currentThemeAsText;
        saveTextAsFile(text, this.themeManager.activeTheme + ".json");
    };

    private removeCurrentTheme = (): void => {
        this.themeManager.removeCurrentTheme();
        this.handleThemeSwitch(new Set(this.themeManager.activeTheme));
    };

    /**
     * Triggered from the theme duplication button to start the theme duplication process.
     */
    private handleThemeDuplication = (): void => {
        const nameSection: IDialogSection = {
            values: {
                themeName: {
                    type: "text",
                    caption: "Enter a new theme name",
                    value: this.themeManager.activeTheme + "X",
                    horizontalSpan: 8,
                },
            },
        };


        this.themeNameDialogRef.current?.show(
            {
                id: "themeNameDialog",
                sections: new Map<string, IDialogSection>([
                    ["name", nameSection],
                ]),
            },
            {
                title: "Enter a name for the new theme",
            },
        );
    };

    /**
     * Called by the value dialog when a theme duplication is in progress.
     *
     * @param closing True if this validation runs for the entire editing process, otherwise false.
     * @param values The value currently shown in the dialog.
     *
     * @returns An evaluation result for the input values.
     */
    private validateThemeName = (closing: boolean, values: IDialogValues): IDialogValidations => {
        const result: IDialogValidations = { messages: {} };
        const sectionValues = values.sections.get("name")!.values;

        const newName = (sectionValues.themeName.value as string).trim();
        const existing = this.themeManager.installedThemes;
        if (newName.length === 0) {
            result.messages.themeName = "The new theme name cannot be empty.";
        } if (existing.includes(newName)) {
            result.messages.themeName = "A theme with this name exists already.";
        }

        return result;
    };

    /**
     * This method is called when the user closed the value dialog for theme duplication.
     * Here we can actually do the action.
     *
     * @param closure The selected action.
     * @param values The object with new theme name.
     */
    private executeThemeDuplication = (closure: DialogResponseClosure, values: IDialogValues): void => {
        const sectionValues = values.sections.get("name")!.values;
        const newName = (sectionValues.themeName.value as string).trim();
        if (closure === DialogResponseClosure.Accept) {
            this.themeManager.saveTheme();

            this.themeManager.duplicateCurrentTheme(newName);
            this.handleThemeSwitch(new Set(newName));
        }
    };

    /**
     * Used to load the color pad values from the settings or set an initial collection of colors
     * if the settings aren't ready yet or the user hadn't change a color pad color.
     */
    private initializeColorPad(): void {
        const colors = Settings.get("theming.colorPadColors");
        if (Array.isArray(colors)) {
            this.colorPadColors = colors;
        } else {
            this.colorPadColors = [
                "#E91E63", "#9C27B0", "#3F51B5", "#2196F3", "#009688", "#4CAF50",
                "", "", "", "", "", "",
                "#8BC34A", "#CDDC39", "#FFC107", "#FF9800", "#FF5722", "#607D8B",
            ];
        }
    }

}
