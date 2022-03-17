await ws.execute("unit/authenticate/success_admin.js")

var profile = {
    "id":1,
    "user_id":1,
    "name":"Default",
    "description":"Default Profile",
    "options":{
       "theming":{
          "themes":[
             {
                "name":"Default DarkX1",
                "type":"dark",
                "colors":{
                   "hotForeground":"#F2F2F3",
                   "background":"#2C2C30",
                   "window.background":"#212126",
                   "window.headerBackground":"#1B1B1D",
                   "window.footerBackground":"#27272B",
                   "text.captionForeground":"#E2DFDF",
                   "text.dimmedForeground":"#797986",
                   "button.border":"#3D3D42",
                   "button.pressedBackground":"#3B3B40",
                   "dropdown.hoverBackground":"#403B3B",
                   "list.headerBackground":"#38383E",
                   "list.gridColor":"#404040",
                   "list.sortIndicatorForeground":"#0D66A2",
                   "list.columnResizerForeground":"#BFBFBF",
                   "list.emptyBackground":"#383838",
                   "button.dimmedBackground":"#4E4E55",
                   "input.hoverBackground":"#3B3A40",
                   "tag.background":"#606060",
                   "tag.foreground":"#DDDDDD",
                   "tooltip.foreground":"#D7D7DB",
                   "tooltip.background":"#3A3A40",
                   "tooltip.border":"#53535A",
                   "menubar.background":"#262626",
                   "menu.blurredBackground":"#25252680",
                   "tab.dropBackground":"#404040",
                   "resultView.headerBackground":"#0A0A0A",
                   "resultView.headerForeground":"#9F9EA3",
                   "resultView.background":"#161616",
                   "resultView.foreground":"#C0B4C4",
                   "resultView.gridColor":"#080808",
                   "editorZone.background":"#1E1E1E",
                   "editorZone.foreground":"#B1AEB5",
                   "resultStatus.background":"#0A0A0A",
                   "resultStatus.foreground":"#777777",
                   "connectionTile.activeBackground":"#123E54",
                   "connectionTile.activeBorder":"#2D9BD2",
                   "connectionTile.background":"#123F54",
                   "connectionTile.border":"#2A93C6",
                   "connectionTileSecondary.background":"#2E2E33",
                   "connectionTileSecondary.border":"#44444B",
                   "connectionTile.foreground":"#CCCCCC",
                   "connectionTile.activeForeground":"#CCCCCC",
                   "connectionTile.hoverBackground":"#1B5E7F",
                   "connectionTileSecondary.foreground":"#CCCCCC",
                   "connectionTileSecondary.activeBackground":"#2C2C30",
                   "connectionTileSecondary.activeForeground":"#CCCCCC",
                   "connectionTileSecondary.activeBorder":"#3D3D42",
                   "popup.border":"#959597",
                   "popup.background":"#39393D",
                   "popup.foreground":"#D7D7DB",
                   "activityBar.activeBackground":"#3A3A40",
                   "activityBar.activeBorder":"#FFFFFF",
                   "activityBar.activeFocusBorder":"#6D122D",
                   "activityBar.background":"#3A3A40",
                   "activityBar.border":"#3D3D42",
                   "activityBar.dropBackground":"#55555E",
                   "activityBar.foreground":"#B3B2B2",
                   "activityBar.inactiveForeground":"#FFFFFF",
                   "activityBarBadge.background":"#007ACC",
                   "activityBarBadge.foreground":"#FFFFFF",
                   "badge.background":"#4D4D4D",
                   "badge.foreground":"#FFFFFF",
                   "breadcrumb.activeSelectionForeground":"#E0E0E0",
                   "breadcrumb.background":"#1E1E1E",
                   "breadcrumb.focusForeground":"#E0E0E0",
                   "breadcrumb.foreground":"#CCCCCC",
                   "breadcrumbPicker.background":"#252526",
                   "button.background":"#333338",
                   "button.foreground":"#909091",
                   "button.hoverBackground":"#404045",
                   "checkbox.background":"#3C3C3C",
                   "checkbox.border":"#3C3C3C",
                   "checkbox.foreground":"#F0F0F0",
                   "contrastActiveBorder":"#3d3d42",
                   "contrastBorder":"#3d3d42",
                   "debugExceptionWidget.background":"#420B0D",
                   "debugExceptionWidget.border":"#A31515",
                   "debugIcon.breakpointCurrentStackframeForeground":"#FFCC00",
                   "debugIcon.breakpointDisabledForeground":"#848484",
                   "debugIcon.breakpointForeground":"#E51400",
                   "debugIcon.breakpointStackframeForeground":"#89D185",
                   "debugIcon.breakpointUnverifiedForeground":"#848484",
                   "debugIcon.continueForeground":"#75BEFF",
                   "debugIcon.disconnectForeground":"#F48771",
                   "debugIcon.pauseForeground":"#75BEFF",
                   "debugIcon.restartForeground":"#89D185",
                   "debugIcon.startForeground":"#89D185",
                   "debugIcon.stepBackForeground":"#75BEFF",
                   "debugIcon.stepIntoForeground":"#75BEFF",
                   "debugIcon.stepOutForeground":"#75BEFF",
                   "debugIcon.stepOverForeground":"#75BEFF",
                   "debugIcon.stopForeground":"#F48771",
                   "debugToolBar.background":"#333333",
                   "debugToolBar.border":"#3D3D42",
                   "descriptionForeground":"#D6D6DB",
                   "diffEditor.border":"#3D3D42",
                   "diffEditor.insertedTextBackground":"#9BB955",
                   "diffEditor.insertedTextBorder":"#3D3D42",
                   "diffEditor.removedTextBackground":"#FF0000",
                   "diffEditor.removedTextBorder":"#3D3D42",
                   "dropdown.background":"#2A2727",
                   "dropdown.border":"#3E3A3A",
                   "dropdown.foreground":"#F0F0F0",
                   "dropdown.listBackground":"#333338",
                   "editor.background":"#1E1E1E",
                   "editor.findMatchBackground":"#515C6A",
                   "editor.findMatchBorder":"#6C120F",
                   "editor.findMatchHighlightBackground":"#515C6A",
                   "editor.findMatchHighlightBorder":"#3D3D42",
                   "editor.findRangeHighlightBackground":"#6C120F",
                   "editor.findRangeHighlightBorder":"#3D3D42",
                   "editor.focusedStackFrameHighlightBackground":"#7ABD7A",
                   "editor.foldBackground":"#40BE5D33",
                   "editor.foreground":"#D4D4D4",
                   "editor.hoverHighlightBackground":"#264F78",
                   "editor.inactiveSelectionBackground":"#3A3D41",
                   "editor.lineHighlightBackground":"#2C2C30",
                   "editor.lineHighlightBorder":"#282828",
                   "editor.rangeHighlightBackground":"#B9323270",
                   "editor.rangeHighlightBorder":"#B9323270",
                   "editor.selectionBackground":"#264F78",
                   "editor.selectionForeground":"#D7D7DB",
                   "editor.selectionHighlightBackground":"#30985A",
                   "editor.selectionHighlightBorder":"#30985A",
                   "editor.snippetFinalTabstopHighlightBackground":"#2C2C30",
                   "editor.snippetFinalTabstopHighlightBorder":"#525252",
                   "editor.snippetTabstopHighlightBackground":"#7C7C7C",
                   "editor.snippetTabstopHighlightBorder":"#3D3D42",
                   "editor.stackFrameHighlightBackground":"#FFFF00",
                   "editor.symbolHighlightBackground":"#EA5C00",
                   "editor.symbolHighlightBorder":"#3D3D42",
                   "editor.wordHighlightBackground":"#575757",
                   "editor.wordHighlightBorder":"#3D3D42",
                   "editor.wordHighlightStrongBackground":"#004972",
                   "editor.wordHighlightStrongBorder":"#3D3D42",
                   "editorBracketMatch.background":"#006400",
                   "editorBracketMatch.border":"#888888",
                   "editorCodeLens.foreground":"#999999",
                   "editorCursor.background":"#2C2C30",
                   "editorCursor.foreground":"#AEAFAD",
                   "editorError.border":"#3D3D42",
                   "editorError.foreground":"#F48771",
                   "editorGroup.border":"#444444",
                   "editorGroup.dropBackground":"#53595D",
                   "editorGroup.emptyBackground":"#000000",
                   "editorGroup.focusedEmptyBorder":"#3D3D42",
                   "editorGroupHeader.noTabsBackground":"#1E1E1E",
                   "editorGroupHeader.tabsBackground":"#27272B",
                   "editorGroupHeader.tabsBorder":"#222225",
                   "editorGutter.addedBackground":"#587C0C",
                   "editorGutter.background":"#1E1E1E",
                   "editorGutter.commentRangeForeground":"#C5C5C5",
                   "editorGutter.deletedBackground":"#94151B",
                   "editorGutter.modifiedBackground":"#0C7D9D",
                   "editorHint.border":"#3D3D42",
                   "editorHint.foreground":"#EEEEEE",
                   "editorHoverWidget.background":"#252526",
                   "editorHoverWidget.border":"#454545",
                   "editorHoverWidget.foreground":"#CCCCCC",
                   "editorHoverWidget.statusBarBackground":"#2C2C2D",
                   "editorIndentGuide.activeBackground":"#707070",
                   "editorIndentGuide.background":"#404040",
                   "editorInfo.border":"#3D3D42",
                   "editorInfo.foreground":"#75BEFF",
                   "editorLightBulb.foreground":"#ffcc00",
                   "editorLightBulbAutoFix.foreground":"#75beff",
                   "editorLineNumber.activeForeground":"#C6C6C6",
                   "editorLineNumber.foreground":"#858585",
                   "editorLink.activeForeground":"#4E94CE",
                   "editorMarkerNavigation.background":"#2D2D30",
                   "editorMarkerNavigationError.background":"#F48771",
                   "editorMarkerNavigationInfo.background":"#75BEFF",
                   "editorMarkerNavigationWarning.background":"#CCA700",
                   "editorOverviewRuler.addedForeground":"#587C0C",
                   "editorOverviewRuler.border":"#7F7F7F",
                   "editorOverviewRuler.bracketMatchForeground":"#A0A0A0",
                   "editorOverviewRuler.commonContentForeground":"#606060",
                   "editorOverviewRuler.currentContentForeground":"#40C8AE",
                   "editorOverviewRuler.deletedForeground":"#94151B",
                   "editorOverviewRuler.errorForeground":"#FF1212",
                   "editorOverviewRuler.findMatchForeground":"#D18616",
                   "editorOverviewRuler.incomingContentForeground":"#40A6FF",
                   "editorOverviewRuler.infoForeground":"#75BEFF",
                   "editorOverviewRuler.modifiedForeground":"#0C7D9D",
                   "editorOverviewRuler.rangeHighlightForeground":"#007ACC",
                   "editorOverviewRuler.selectionHighlightForeground":"#A0A0A0",
                   "editorOverviewRuler.warningForeground":"#CCA700",
                   "editorOverviewRuler.wordHighlightForeground":"#A0A0A0",
                   "editorOverviewRuler.wordHighlightStrongForeground":"#C0A0C0",
                   "editorPane.background":"#222225",
                   "editorRuler.foreground":"#24903D",
                   "editorSuggestWidget.background":"#252526",
                   "editorSuggestWidget.border":"#454545",
                   "editorSuggestWidget.foreground":"#D4D4D4",
                   "editorSuggestWidget.highlightForeground":"#0097FB",
                   "editorSuggestWidget.selectedBackground":"#062F4A",
                   "editorUnnecessaryCode.border":"#3D3D42",
                   "editorUnnecessaryCode.opacity":"#000000",
                   "editorWarning.border":"#3D3D42",
                   "editorWarning.foreground":"#CCA700",
                   "editorWhitespace.foreground":"#E3E4E2",
                   "editorWidget.background":"#252526",
                   "editorWidget.border":"#454545",
                   "editorWidget.foreground":"#CCCCCC",
                   "editorWidget.resizeBorder":"#3D3D42",
                   "errorForeground":"#E78F7E",
                   "extensionBadge.remoteBackground":"#007ACC",
                   "extensionBadge.remoteForeground":"#FFFFFF",
                   "extensionButton.prominentBackground":"#327E36",
                   "extensionButton.prominentForeground":"#FFFFFF",
                   "extensionButton.prominentHoverBackground":"#28632B",
                   "focusBorder":"#0E639C",
                   "foreground":"#BFBFBF",
                   "gitDecoration.addedResourceForeground":"#81B88B",
                   "gitDecoration.conflictingResourceForeground":"#6C6CC4",
                   "gitDecoration.deletedResourceForeground":"#C74E39",
                   "gitDecoration.ignoredResourceForeground":"#8C8C8C",
                   "gitDecoration.modifiedResourceForeground":"#E2C08D",
                   "gitDecoration.submoduleResourceForeground":"#8DB9E2",
                   "gitDecoration.untrackedResourceForeground":"#73C991",
                   "icon.foreground":"#FFFFFF",
                   "imagePreview.border":"#808080",
                   "input.background":"#28272B",
                   "input.border":"#343338",
                   "input.foreground":"#CCCCCC",
                   "input.placeholderForeground":"#A6A6A6",
                   "inputOption.activeBackground":"#0E639C",
                   "inputOption.activeBorder":"#007ACC",
                   "inputValidation.errorBackground":"#5A1D1D",
                   "inputValidation.errorBorder":"#BE1100",
                   "inputValidation.errorForeground":"#D7D7DB",
                   "inputValidation.infoBackground":"#063B49",
                   "inputValidation.infoBorder":"#007ACC",
                   "inputValidation.infoForeground":"#D7D7DB",
                   "inputValidation.warningBackground":"#352A05",
                   "inputValidation.warningBorder":"#B89500",
                   "inputValidation.warningForeground":"#D7D7DB",
                   "list.activeSelectionBackground":"#094771",
                   "list.activeSelectionForeground":"#FFFFFF",
                   "list.deemphasizedForeground":"#8c8c8c",
                   "list.dropBackground":"#383B3D",
                   "list.errorForeground":"#F88070",
                   "list.filterMatchBackground":"#EA5C00",
                   "list.filterMatchBorder":"#3D3D42",
                   "list.focusBackground":"#062F4A",
                   "list.focusForeground":"#D7D7DB",
                   "list.highlightForeground":"#0097FB",
                   "list.hoverBackground":"#575757",
                   "list.hoverForeground":"#D7D7DB",
                   "list.inactiveFocusBackground":"#2C2C30",
                   "list.inactiveSelectionBackground":"#37373D",
                   "list.inactiveSelectionForeground":"#D7D7DB",
                   "list.invalidItemForeground":"#B89500",
                   "list.warningForeground":"#CCA700",
                   "listFilterWidget.background":"#653723",
                   "listFilterWidget.noMatchesOutline":"#BE1100",
                   "listFilterWidget.outline":"#000000",
                   "menu.background":"#252526",
                   "menu.border":"#3D3D42",
                   "menu.foreground":"#CCCCCC",
                   "menu.selectionBackground":"#094771",
                   "menu.selectionBorder":"#073555",
                   "menu.selectionForeground":"#FFFFFF",
                   "menu.separatorBackground":"#BBBBBB",
                   "menubar.selectionBackground":"#094771",
                   "menubar.selectionBorder":"#3D3D42",
                   "menubar.selectionForeground":"#CCCCCC",
                   "merge.border":"#3D3D42",
                   "merge.commonContentBackground":"#606060",
                   "merge.commonHeaderBackground":"#606060",
                   "merge.currentContentBackground":"#40C8AE",
                   "merge.currentHeaderBackground":"#40C8AE",
                   "merge.incomingContentBackground":"#40A6FF",
                   "merge.incomingHeaderBackground":"#40A6FF",
                   "minimap.background":"#1E1E1E",
                   "minimap.errorHighlight":"#FF1212",
                   "minimap.findMatchHighlight":"#D18616",
                   "minimap.selectionHighlight":"#264F78",
                   "minimap.warningHighlight":"#CCA700",
                   "minimapGutter.addedBackground":"#587C0C",
                   "minimapGutter.deletedBackground":"#94151B",
                   "minimapGutter.modifiedBackground":"#0C7D9D",
                   "minimapSlider.activeBackground":"#BFBFBF66",
                   "minimapSlider.background":"#66666666",
                   "minimapSlider.hoverBackground":"#99999966",
                   "notebook.outputContainerBackgroundColor":"#ffffff0f",
                   "notificationCenter.border":"#3D3D42",
                   "notificationCenterHeader.background":"#303031",
                   "notificationCenterHeader.foreground":"#D7D7DB",
                   "notificationLink.foreground":"#3794FF",
                   "notifications.background":"#252526",
                   "notifications.border":"#303031",
                   "notifications.foreground":"#CCCCCC",
                   "notificationsErrorIcon.foreground":"#F48771",
                   "notificationsInfoIcon.foreground":"#75BEFF",
                   "notificationsWarningIcon.foreground":"#CCA700",
                   "notificationToast.border":"#3D3D42",
                   "panel.background":"#1E1E1E",
                   "panel.border":"#808080",
                   "panel.dropBackground":"#FFFFFF",
                   "panelInput.border":"#3D3D42",
                   "panelTitle.activeBorder":"#E7E7E7",
                   "panelTitle.activeForeground":"#E7E7E7",
                   "panelTitle.inactiveForeground":"#E7E7E7",
                   "peekView.border":"#00568F",
                   "peekViewEditor.background":"#001F33",
                   "peekViewEditor.matchHighlightBackground":"#30985A",
                   "peekViewEditor.matchHighlightBorder":"#30985A",
                   "peekViewEditorGutter.background":"#001F33",
                   "peekViewResult.background":"#252526",
                   "peekViewResult.fileForeground":"#FFFFFF",
                   "peekViewResult.lineForeground":"#BBBBBB",
                   "peekViewResult.matchHighlightBackground":"#30985A",
                   "peekViewResult.selectionBackground":"#0E639C",
                   "peekViewResult.selectionForeground":"#BFBFBF",
                   "peekViewTitle.background":"#001C2E",
                   "peekViewTitleDescription.foreground":"#BFBFBF",
                   "peekViewTitleLabel.foreground":"#BFBFBF",
                   "pickerGroup.border":"#3F3F46",
                   "pickerGroup.foreground":"#3794FF",
                   "problemsErrorIcon.foreground":"#F48771",
                   "problemsInfoIcon.foreground":"#75BEFF",
                   "problemsWarningIcon.foreground":"#CCA700",
                   "progressBar.background":"#0E70C0",
                   "quickInput.background":"#252526",
                   "quickInput.foreground":"#CCCCCC",
                   "quickInputTitle.background":"#FFFFFF",
                   "scrollbar.shadow":"#000000",
                   "scrollbarSlider.activeBackground":"#BFBFBF",
                   "scrollbarSlider.background":"#797979",
                   "scrollbarSlider.hoverBackground":"#646464",
                   "searchEditor.findMatchBackground":"#EA5C00",
                   "searchEditor.textInputBorder":"#3D3D42",
                   "selection.background":"#0C7ED9",
                   "settings.checkboxBackground":"#3C3C3C",
                   "settings.checkboxBorder":"#3C3C3C",
                   "settings.checkboxForeground":"#F0F0F0",
                   "settings.dropdownBackground":"#3C3C3C",
                   "settings.dropdownBorder":"#3C3C3C",
                   "settings.dropdownForeground":"#F0F0F0",
                   "settings.dropdownListBorder":"#454545",
                   "settings.headerForeground":"#E7E7E7",
                   "settings.modifiedItemIndicator":"#0C7D9D",
                   "settings.numberInputBackground":"#292929",
                   "settings.numberInputBorder":"#3D3D42",
                   "settings.numberInputForeground":"#CCCCCC",
                   "settings.textInputBackground":"#292929",
                   "settings.textInputBorder":"#3D3D42",
                   "settings.textInputForeground":"#CCCCCC",
                   "sideBar.background":"#27272A",
                   "sideBar.border":"#3D3D42",
                   "sideBar.dropBackground":"#313135",
                   "sideBar.markerBackground":"#3ABB92",
                   "sideBar.foreground":"#D7D7DB",
                   "sideBarSectionHeader.background":"#424248",
                   "sideBarSectionHeader.border":"#424248",
                   "sideBarSectionHeader.foreground":"#B3B3B3",
                   "sideBarTitle.foreground":"#6E6E77",
                   "statusBar.background":"#007ACC",
                   "statusBar.border":"#000000",
                   "statusBar.debuggingForeground":"#FFFFFF",
                   "statusBar.foreground":"#FFFFFF",
                   "statusBar.noFolderBackground":"#68217A",
                   "statusBar.noFolderBorder":"#3D3D42",
                   "statusBar.noFolderForeground":"#FFFFFF",
                   "statusBarItem.activeBackground":"#0098FD",
                   "statusBarItem.hoverBackground":"#0089E6",
                   "statusBarItem.prominentBackground":"#C0CC0080",
                   "statusBarItem.prominentForeground":"#FFFFFF",
                   "statusBarItem.prominentHoverBackground":"#C0CC0099",
                   "statusBarItem.remoteBackground":"#16825D",
                   "statusBarItem.remoteForeground":"#FFFFFF",
                   "symbolIcon.arrayForeground":"#CCCCCC",
                   "symbolIcon.booleanForeground":"#CCCCCC",
                   "symbolIcon.classForeground":"#EE9D28",
                   "symbolIcon.colorForeground":"#CCCCCC",
                   "symbolIcon.constantForeground":"#CCCCCC",
                   "symbolIcon.constructorForeground":"#B180D7",
                   "symbolIcon.enumeratorForeground":"#EE9D28",
                   "symbolIcon.enumeratorMemberForeground":"#75BEFF",
                   "symbolIcon.eventForeground":"#EE9D28",
                   "symbolIcon.fieldForeground":"#75BEFF",
                   "symbolIcon.fileForeground":"#CCCCCC",
                   "symbolIcon.folderForeground":"#CCCCCC",
                   "symbolIcon.functionForeground":"#B180D7",
                   "symbolIcon.interfaceForeground":"#75BEFF",
                   "symbolIcon.keyForeground":"#CCCCCC",
                   "symbolIcon.keywordForeground":"#CCCCCC",
                   "symbolIcon.methodForeground":"#B180D7",
                   "symbolIcon.moduleForeground":"#CCCCCC",
                   "symbolIcon.namespaceForeground":"#CCCCCC",
                   "symbolIcon.nullForeground":"#CCCCCC",
                   "symbolIcon.numberForeground":"#CCCCCC",
                   "symbolIcon.objectForeground":"#CCCCCC",
                   "symbolIcon.operatorForeground":"#CCCCCC",
                   "symbolIcon.packageForeground":"#CCCCCC",
                   "symbolIcon.propertyForeground":"#CCCCCC",
                   "symbolIcon.referenceForeground":"#CCCCCC",
                   "symbolIcon.snippetForeground":"#CCCCCC",
                   "symbolIcon.stringForeground":"#CCCCCC",
                   "symbolIcon.structForeground":"#CCCCCC",
                   "symbolIcon.textForeground":"#CCCCCC",
                   "symbolIcon.typeParameterForeground":"#CCCCCC",
                   "symbolIcon.unitForeground":"#CCCCCC",
                   "symbolIcon.variableForeground":"#75BEFF",
                   "tab.activeBackground":"#222225",
                   "tab.activeBorder":"#FFFFFF00",
                   "tab.activeBorderTop":"#007ACC",
                   "tab.activeForeground":"#FFFFFF",
                   "tab.activeModifiedBorder":"#3399CC",
                   "tab.border":"#25252600",
                   "tab.hoverBackground":"#404040",
                   "tab.hoverBorder":"#404040",
                   "tab.inactiveBackground":"#2E2E33",
                   "tab.inactiveForeground":"#999999",
                   "tab.inactiveModifiedBorder":"#3399CC",
                   "tab.unfocusedActiveBackground":"#1E1E1E",
                   "tab.unfocusedActiveBorder":"#000000",
                   "tab.unfocusedActiveBorderTop":"#007ACC",
                   "tab.unfocusedActiveForeground":"#FFFFFF",
                   "tab.unfocusedActiveModifiedBorder":"#3399CC",
                   "tab.unfocusedHoverBackground":"#404040",
                   "tab.unfocusedHoverBorder":"#000000",
                   "tab.unfocusedInactiveForeground":"#FFFFFF",
                   "tab.unfocusedInactiveModifiedBorder":"#3399CC",
                   "terminal.ansiBlack":"#000000",
                   "terminal.ansiBlue":"#2472C8",
                   "terminal.ansiBrightBlack":"#666666",
                   "terminal.ansiBrightBlue":"#3B8EEA",
                   "terminal.ansiBrightCyan":"#29B8DB",
                   "terminal.ansiBrightGreen":"#23D18B",
                   "terminal.ansiBrightMagenta":"#D670D6",
                   "terminal.ansiBrightRed":"#F14C4C",
                   "terminal.ansiBrightWhite":"#E5E5E5",
                   "terminal.ansiBrightYellow":"#F5F543",
                   "terminal.ansiCyan":"#11A8CD",
                   "terminal.ansiGreen":"#0DBC79",
                   "terminal.ansiMagenta":"#BC3FBC",
                   "terminal.ansiRed":"#CD3131",
                   "terminal.ansiWhite":"#E5E5E5",
                   "terminal.ansiYellow":"#E5E510",
                   "terminal.background":"#050505",
                   "terminal.border":"#808080",
                   "terminal.foreground":"#CCCCCC",
                   "terminal.selectionBackground":"#FFFFFF",
                   "terminalCursor.background":"#2C2C30",
                   "terminalCursor.foreground":"#D7D7DB",
                   "textBlockQuote.background":"#7F7F7F21",
                   "textBlockQuote.border":"#007ACC",
                   "textCodeBlock.background":"#0A0A0A",
                   "textLink.activeForeground":"#9C27B0",
                   "textLink.foreground":"#3DA2D6",
                   "textPreformat.foreground":"#D7BA7D",
                   "textSeparator.foreground":"#3F3B3B",
                   "titleBar.activeBackground":"#222224",
                   "titleBar.activeForeground":"#BEBEBE",
                   "titleBar.border":"#007ACC",
                   "titleBar.inactiveBackground":"#222224",
                   "titleBar.inactiveForeground":"#BEBEBE",
                   "tree.indentGuidesStroke":"#585858",
                   "walkThrough.embeddedEditorBackground":"#2C2C30",
                   "welcomePage.background":"#333338",
                   "welcomePage.buttonBackground":"#2C2C30",
                   "welcomePage.buttonHoverBackground":"#494950",
                   "widget.shadow":"#0000004d",
                   "window.activeBorder":"#222225",
                   "window.inactiveBorder":"#222225",
                   "activityBar.dropBorder":"#AFAFB6",
                   "editorGroupHeader.border":"#3D3D42",
                   "searchEditor.findMatchBorder":"#3D3D42",
                   "statusBar.debuggingBackground":"#2C2C30",
                   "statusBar.debuggingBorder":"#3D3D42",
                   "editorOverviewRuler.background":"#1E1E1E"
                },
                "tokenColors":[
                   {
                      "scope":[
                         "emphasis"
                      ],
                      "settings":{
                         "fontStyle":"bold"
                      },
                      "name":"Emphasis"
                   },
                   {
                      "scope":[
                         "strong"
                      ],
                      "settings":{
                         "fontStyle":"bold"
                      },
                      "name":"Strong"
                   },
                   {
                      "name":"Line + Block Comment",
                      "scope":[
                         "comment",
                         "comment.block",
                         "comment.line"
                      ],
                      "settings":{
                         "foreground":"#0987CB"
                      }
                   },
                   {
                      "name":"Special line comment",
                      "scope":[
                         "comment.line.double-dash",
                         "comment.line.double-slash",
                         "comment.line.number-sign"
                      ],
                      "settings":{
                         "foreground":"#52a0cb"
                      }
                   },
                   {
                      "name":"Single line comment with char",
                      "scope":"comment.line.character",
                      "settings":{
                         "foreground":"#709dce"
                      }
                   },
                   {
                      "name":"Doc Comment",
                      "scope":"comment.block.documentation",
                      "settings":{
                         "foreground":"#709dce"
                      }
                   },
                   {
                      "name":"Generic constant",
                      "scope":"constant, constant.other",
                      "settings":{
                         "foreground":"#e59337"
                      }
                   },
                   {
                      "name":"Numeric constant",
                      "scope":"constant.numeric",
                      "settings":{
                         "foreground":"#e59337"
                      }
                   },
                   {
                      "name":"Character constant",
                      "scope":"constant.character",
                      "settings":{
                         "foreground":"#e59337"
                      }
                   },
                   {
                      "name":"Escape sequence",
                      "scope":"constant.character.escape",
                      "settings":{
                         "foreground":"#ff6f30"
                      }
                   },
                   {
                      "name":"Language constant",
                      "scope":"constant.language",
                      "settings":{
                         "fontStyle":"bold underline",
                         "foreground":"#c5914c"
                      }
                   },
                   {
                      "name":"Delimiter",
                      "scope":[
                         "delimiter"
                      ],
                      "settings":{
                         "fontStyle":"bold",
                         "foreground":"#A8A8A8"
                      }
                   },
                   {
                      "name":"Generic entity + others default",
                      "scope":[
                         "entity",
                         "entity.other"
                      ],
                      "settings":{
                         "foreground":"#cc666a"
                      }
                   },
                   {
                      "name":"Generic entity name",
                      "scope":"entity.name",
                      "settings":{
                         "foreground":"#cc4e52"
                      }
                   },
                   {
                      "name":"Function name",
                      "scope":"entity.name.function",
                      "settings":{
                         "foreground":"#c2c299"
                      }
                   },
                   {
                      "name":"Type name",
                      "scope":"entity.name.type",
                      "settings":{
                         "foreground":"#ebd8b7",
                         "fontStyle":""
                      }
                   },
                   {
                      "name":"Tag name",
                      "scope":"entity.name.tag",
                      "settings":{
                         "foreground":"#cc833b"
                      }
                   },
                   {
                      "name":"Section name",
                      "scope":"entity.name.section",
                      "settings":{
                         "foreground":"#c2c269"
                      }
                   },
                   {
                      "name":"Inherited class",
                      "scope":"entity.other.inherited-class",
                      "settings":{
                         "fontStyle":"italic underline",
                         "foreground":"#cf85be"
                      }
                   },
                   {
                      "name":"Attribute name",
                      "scope":"entity.other.attribute-name",
                      "settings":{
                         "foreground":"#eb9195"
                      }
                   },
                   {
                      "name":"Generic Identifier",
                      "scope":[
                         "identifier"
                      ],
                      "settings":{
                         "foreground":"#CDCDCD"
                      }
                   },
                   {
                      "name":"Generic invalid",
                      "scope":"invalid",
                      "settings":{
                         "background":"#e03e44",
                         "foreground":"#FFFFFF"
                      }
                   },
                   {
                      "name":"Illegal",
                      "scope":"invalid.illegal",
                      "settings":{
                         "background":"#e03e44",
                         "foreground":"#e5e500"
                      }
                   },
                   {
                      "name":"Deprecated",
                      "scope":"invalid.deprecated",
                      "settings":{
                         "background":"#e0a9ab"
                      }
                   },
                   {
                      "name":"Generic keyword",
                      "scope":"keyword",
                      "settings":{
                         "fontStyle":" bold",
                         "foreground":"#2BB074"
                      }
                   },
                   {
                      "name":"Control keyword",
                      "scope":"keyword.control",
                      "settings":{
                         "fontStyle":"bold",
                         "foreground":"#a9b5ad"
                      }
                   },
                   {
                      "name":"Operator keyword + operators",
                      "scope":"keyword.operator",
                      "settings":{
                         "fontStyle":"bold",
                         "foreground":"#FFFF00"
                      }
                   },
                   {
                      "name":"Other keywords",
                      "scope":"keyword.other",
                      "settings":{
                         "fontStyle":"bold",
                         "foreground":"#8f9a9c"
                      }
                   },
                   {
                      "name":"Generic markup",
                      "scope":"markup",
                      "settings":{

                      }
                   },
                   {
                      "name":"Generic meta",
                      "scope":"meta",
                      "settings":{

                      }
                   },
                   {
                      "name":"Meta Tag",
                      "scope":[
                         "metatag"
                      ],
                      "settings":{
                         "foreground":"#EBC8A3"
                      }
                   },
                   {
                      "name":"Number",
                      "scope":[
                         "number"
                      ],
                      "settings":{
                         "foreground":"#FF9800"
                      }
                   },
                   {
                      "name":"Other",
                      "scope":[
                         "other"
                      ],
                      "settings":{
                         "foreground":"#D7D7D7"
                      }
                   },
                   {
                      "name":"Generic storage",
                      "scope":"storage",
                      "settings":{
                         "fontStyle":"bold",
                         "foreground":"#689c9c"
                      }
                   },
                   {
                      "name":"Type",
                      "scope":"storage.type",
                      "settings":{
                         "fontStyle":"bold",
                         "foreground":"#78a6a6"
                      }
                   },
                   {
                      "name":"Storage modifier",
                      "scope":"storage.modifier",
                      "settings":{
                         "fontStyle":"bold",
                         "foreground":"#78a6a6"
                      }
                   },
                   {
                      "name":"Generic string",
                      "scope":[
                         "string"
                      ],
                      "settings":{
                         "foreground":"#e5bd46",
                         "fontStyle":""
                      }
                   },
                   {
                      "name":"Generic quoted string",
                      "scope":"string.quoted",
                      "settings":{
                         "foreground":"#e5bd46"
                      }
                   },
                   {
                      "name":"Singly quoted string",
                      "scope":"string.quoted.single",
                      "settings":{
                         "foreground":"#e5bd46"
                      }
                   },
                   {
                      "name":"Doubly quoted string",
                      "scope":"string.quoted.double",
                      "settings":{
                         "foreground":"#e5bd46"
                      }
                   },
                   {
                      "name":"Triply quoted string",
                      "scope":"string.quoted.triple",
                      "settings":{
                         "foreground":"#e5bd46"
                      }
                   },
                   {
                      "name":"Other quoted string",
                      "scope":[
                         "string.quoted.other",
                         "string.sql"
                      ],
                      "settings":{
                         "foreground":"#e5bd46"
                      }
                   },
                   {
                      "name":"Unquoted string",
                      "scope":"string.unquoted",
                      "settings":{
                         "foreground":"#e5bd46"
                      }
                   },
                   {
                      "name":"Interpolated string",
                      "scope":"string.interpolated",
                      "settings":{
                         "foreground":"#e0d5b3"
                      }
                   },
                   {
                      "name":"Regular expression string",
                      "scope":"string.regexp",
                      "settings":{
                         "foreground":"#FF6f30"
                      }
                   },
                   {
                      "name":"Other string",
                      "scope":"string.other",
                      "settings":{
                         "foreground":"#eccd73"
                      }
                   },
                   {
                      "name":"Generic support",
                      "scope":"support",
                      "settings":{
                         "foreground":"#9b90c3"
                      }
                   },
                   {
                      "name":"Function support",
                      "scope":[
                         "predefined.sql",
                         "support.function"
                      ],
                      "settings":{
                         "foreground":"#78a6a6"
                      }
                   },
                   {
                      "name":"Class support",
                      "scope":"support.class",
                      "settings":{
                         "foreground":"#9b90c3"
                      }
                   },
                   {
                      "name":"Type support",
                      "scope":"support.type",
                      "settings":{
                         "foreground":"#b9b1d5"
                      }
                   },
                   {
                      "name":"Constant support",
                      "scope":"support.constant",
                      "settings":{
                         "foreground":"#9b90c3"
                      }
                   },
                   {
                      "name":"Variable support",
                      "scope":"support.variable",
                      "settings":{
                         "foreground":"#9b90c3"
                      }
                   },
                   {
                      "name":"Other support",
                      "scope":"support.other",
                      "settings":{
                         "foreground":"#9b90c3"
                      }
                   },
                   {
                      "name":"Type",
                      "scope":[
                         "type.identifier"
                      ],
                      "settings":{
                         "foreground":"#EBD7B9"
                      }
                   },
                   {
                      "name":"Generic variable",
                      "scope":"variable",
                      "settings":{
                         "foreground":"#63bf8d"
                      }
                   },
                   {
                      "name":"Parameter variable",
                      "scope":"variable.parameter",
                      "settings":{
                         "foreground":"#63bf8d"
                      }
                   },
                   {
                      "name":"Language variable",
                      "scope":"variable.language",
                      "settings":{
                         "foreground":"#45aa73"
                      }
                   },
                   {
                      "name":"Other variable",
                      "scope":"variable.other",
                      "settings":{
                         "foreground":"#5aaa7f"
                      }
                   },
                   {
                      "name":"Predicate entity",
                      "scope":"entity.other.predicate",
                      "settings":{
                         "foreground":"#a6a6a6"
                      }
                   },
                   {
                      "name":"Any other block",
                      "scope":"entity.other.block",
                      "settings":{
                         "foreground":"#7d7d7d"
                      }
                   },
                   {
                      "name":"Token support",
                      "scope":"support.other.token",
                      "settings":{
                         "foreground":"#d7d7c7"
                      }
                   },
                   {
                      "name":"JSON String",
                      "scope":[
                         "string.value",
                         "string.value.json"
                      ],
                      "settings":{
                         "foreground":"#CFCFC2"
                      }
                   },
                   {
                      "name":"diff.header",
                      "scope":[
                         "meta.diff",
                         "meta.diff.header"
                      ],
                      "settings":{
                         "foreground":"#75715E"
                      }
                   },
                   {
                      "name":"diff.deleted",
                      "scope":"markup.deleted",
                      "settings":{
                         "foreground":"#F92672"
                      }
                   },
                   {
                      "name":"diff.inserted",
                      "scope":"markup.inserted",
                      "settings":{
                         "foreground":"#A6E22E"
                      }
                   },
                   {
                      "name":"diff.changed",
                      "scope":"markup.changed",
                      "settings":{
                         "foreground":"#E6DB74"
                      }
                   },
                   {
                      "scope":"markup.inserted",
                      "settings":{
                         "foreground":"#b5cea8"
                      }
                   },
                   {
                      "scope":"markup.deleted",
                      "settings":{
                         "foreground":"#ce9178"
                      }
                   },
                   {
                      "scope":"markup.changed",
                      "settings":{
                         "foreground":"#569cd6"
                      }
                   },
                   {
                      "scope":"markup.punctuation.quote",
                      "settings":{
                         "foreground":"#608b4e"
                      }
                   },
                   {
                      "scope":"constant.rgb-value",
                      "settings":{
                         "foreground":"#d4d4d4"
                      }
                   },
                   {
                      "scope":"entity.name.selector",
                      "settings":{
                         "foreground":"#d7ba7d"
                      }
                   },
                   {
                      "scope":"entity.other.attribute-name.css",
                      "settings":{
                         "foreground":"#d7ba7d"
                      }
                   },
                   {
                      "scope":"markup.underline",
                      "settings":{
                         "fontStyle":"underline"
                      }
                   },
                   {
                      "scope":"markup.bold",
                      "settings":{
                         "fontStyle":"bold",
                         "foreground":"#569cd6"
                      }
                   },
                   {
                      "scope":"markup.heading",
                      "settings":{
                         "fontStyle":"bold",
                         "foreground":"#569cd6"
                      }
                   },
                   {
                      "scope":"markup.italic",
                      "settings":{
                         "fontStyle":"italic",
                         "foreground":"#569cd6"
                      }
                   }
                ]
             },
             {
                "name":"Noctis Lux",
                "type":"light",
                "colors":{
                   "selection.background":"#169fb155",
                   "descriptionForeground":"#929ea0",
                   "errorForeground":"#ff4000",
                   "widget.shadow":"#00000055",
                   "background":"#fef8ec",
                   "editor.background":"#fef8ec",
                   "editor.foreground":"#005661",
                   "editorLineNumber.foreground":"#a0abac",
                   "editorLineNumber.activeForeground":"#0099ad",
                   "editorCursor.foreground":"#0092a8",
                   "badge.background":"#0099ad",
                   "badge.foreground":"#fef8ec",
                   "activityBar.background":"#fef8ec",
                   "activityBar.dropBackground":"#0099ad65",
                   "activityBar.foreground":"#0099ad",
                   "activityBar.border":"#ece2c600",
                   "activityBarBadge.background":"#0099ad",
                   "activityBarBadge.foreground":"#fef8ec",
                   "activityBar.activeBackground":"#0099ad33",
                   "activityBar.activeBorder":"#0099ad",
                   "sideBar.background":"#f8efdd",
                   "sideBar.foreground":"#888477",
                   "sideBar.border":"#ece2c600",
                   "sideBar.dropBackground":"#f8efdd",
                   "sideBarTitle.foreground":"#888477",
                   "sideBarSectionHeader.background":"#f0e3c2",
                   "sideBarSectionHeader.foreground":"#888477",
                   "statusBar.background":"#ebe4d1",
                   "statusBar.foreground":"#0099ad",
                   "statusBar.border":"#ece2c600",
                   "statusBar.debuggingBackground":"#f8efdd",
                   "statusBar.debuggingForeground":"#e9498150",
                   "statusBar.debuggingBorder":"#e94981af",
                   "statusBar.noFolderForeground":"#87a7ab",
                   "statusBar.noFolderBackground":"#f8efdd",
                   "statusBar.noFolderBorder":"#f8efdd",
                   "statusBarItem.activeBackground":"#dfeff1",
                   "statusBarItem.hoverBackground":"#d1e8eb",
                   "statusBarItem.prominentBackground":"#c1d4d7",
                   "statusBarItem.prominentHoverBackground":"#bfdee3",
                   "button.background":"#099",
                   "button.foreground":"#f1f1f1",
                   "button.hoverBackground":"#0cc",
                   "dropdown.background":"#fef8ec",
                   "dropdown.border":"#fef8ec",
                   "dropdown.foreground":"#005661",
                   "editorMarkerNavigation.background":"#3a3a5e29",
                   "editorMarkerNavigationError.background":"#ff4000",
                   "editorMarkerNavigationWarning.background":"#e69533",
                   "editorError.border":"#fef8ec",
                   "editorError.foreground":"#ff4000",
                   "editorWarning.border":"#fef8ec",
                   "editorWarning.foreground":"#e69533",
                   "editorInfo.border":"#fef8ec",
                   "editorInfo.foreground":"#00c6e0",
                   "editorHint.border":"#58cc6d00",
                   "editorHint.foreground":"#58cc6d",
                   "editorGroup.emptyBackground":"#b8ae9333",
                   "editorGroup.border":"#f0e7d1",
                   "editorGroup.dropBackground":"#b8ae9333",
                   "editorGroupHeader.noTabsBackground":"#ebe4d1",
                   "editorGroupHeader.tabsBackground":"#ebe4d1",
                   "editorGroupHeader.tabsBorder":"#ebe4d100",
                   "tab.activeBackground":"#fef8ec",
                   "tab.unfocusedActiveBackground":"#f7f2e3",
                   "tab.activeForeground":"#0099ad",
                   "tab.border":"#e6d7b2",
                   "tab.inactiveBackground":"#ebe4d1",
                   "tab.inactiveForeground":"#888477",
                   "tab.unfocusedActiveForeground":"#888477",
                   "tab.unfocusedInactiveForeground":"#888477",
                   "tab.activeBorderTop":"#00c6e0",
                   "tab.activeModifiedBorder":"#00b368",
                   "tab.activeBorder":"#fef8ec",
                   "tab.unfocusedActiveBorder":"#fef8ec00",
                   "tab.unfocusedHoverBackground":"#0099ad21",
                   "textBlockQuote.background":"#f8efdd",
                   "textBlockQuote.border":"#00899e",
                   "textCodeBlock.background":"#f8efdd",
                   "textLink.activeForeground":"#00c6e0",
                   "textLink.foreground":"#00c6e0",
                   "textPreformat.foreground":"#e9a149",
                   "textSeparator.foreground":"#f8efdd",
                   "walkThrough.embeddedEditorBackground":"#f8efdd",
                   "welcomePage.buttonBackground":"#f8efdd",
                   "welcomePage.buttonHoverBackground":"#e1e0d0",
                   "input.background":"#fef8ec",
                   "input.border":"#f2edde",
                   "input.foreground":"#6a7a7c",
                   "input.placeholderForeground":"#9fabad",
                   "inputOption.activeBorder":"#0099ad",
                   "inputValidation.errorBackground":"#ff400041",
                   "inputValidation.errorBorder":"#ff4000",
                   "inputValidation.infoBackground":"#00c6e0cc",
                   "inputValidation.infoBorder":"#00c6e0",
                   "inputValidation.warningBackground":"#ffa587cc",
                   "inputValidation.warningBorder":"#ffa487",
                   "editorWidget.background":"#f2edde",
                   "editorWidget.border":"#ece2c600",
                   "editorHoverWidget.background":"#f2edde",
                   "editorHoverWidget.border":"#ece2c600",
                   "editorSuggestWidget.background":"#f2edde",
                   "editorSuggestWidget.border":"#ece2c600",
                   "editorSuggestWidget.foreground":"#6a7a7c",
                   "editorSuggestWidget.highlightForeground":"#0099ad",
                   "editorSuggestWidget.selectedBackground":"#dbfaff",
                   "editorGutter.background":"#fef8ec",
                   "editorGutter.addedBackground":"#8ce99a",
                   "editorGutter.deletedBackground":"#ff4000",
                   "editorGutter.modifiedBackground":"#e9a149",
                   "editor.selectionBackground":"#ade2eb77",
                   "editor.selectionHighlightBackground":"#14a5ff33",
                   "editor.selectionHighlightBorder":"#14a5ff00",
                   "editor.inactiveSelectionBackground":"#ade2eb55",
                   "editor.wordHighlightStrongBackground":"#b5890027",
                   "editor.wordHighlightStrongBorder":"#b5890000",
                   "editor.wordHighlightBackground":"#e9a14922",
                   "editor.wordHighlightBorder":"#e9a14900",
                   "editor.findMatchBackground":"#8ce99a55",
                   "editor.findMatchBorder":"#8ce99a00",
                   "editor.findMatchHighlightBackground":"#148f9f33",
                   "editor.findMatchHighlightBorder":"#148f9f00",
                   "editor.findRangeHighlightBackground":"#99e62a55",
                   "editor.findRangeHighlightBorder":"#58CC6D00",
                   "editor.hoverHighlightBackground":"#0099ad3f",
                   "editor.lineHighlightBackground":"#d1ebefcc",
                   "editor.lineHighlightBorder":"#d1ebef00",
                   "editor.rangeHighlightBackground":"#f1e9d5a1",
                   "editorLink.activeForeground":"#14a5ff",
                   "editorWhitespace.foreground":"#d3cec5bb",
                   "editorIndentGuide.background":"#d3cec5aa",
                   "editorIndentGuide.activeBackground":"#88adc3",
                   "editorBracketMatch.background":"#0099ad20",
                   "editorBracketMatch.border":"#0099ad",
                   "editorRuler.foreground":"#f1e6d0",
                   "editorCodeLens.foreground":"#77aaca",
                   "terminal.ansiBlack":"#003b42",
                   "terminal.ansiRed":"#e34e1c",
                   "terminal.ansiGreen":"#00b368",
                   "terminal.ansiYellow":"#f49725",
                   "terminal.ansiBlue":"#0094f0",
                   "terminal.ansiMagenta":"#ff5792",
                   "terminal.ansiCyan":"#00bdd6",
                   "terminal.ansiWhite":"#8ca6a6",
                   "terminal.ansiBrightBlack":"#004d57",
                   "terminal.ansiBrightRed":"#ff4000",
                   "terminal.ansiBrightGreen":"#00d17a",
                   "terminal.ansiBrightYellow":"#ff8c00",
                   "terminal.ansiBrightBlue":"#0fa3ff",
                   "terminal.ansiBrightMagenta":"#ff6b9f",
                   "terminal.ansiBrightCyan":"#00cbe6",
                   "terminal.ansiBrightWhite":"#bbc3c4",
                   "terminal.background":"#f6ebd5",
                   "terminal.foreground":"#005661",
                   "terminalCursor.background":"#f6ebd5",
                   "terminalCursor.foreground":"#005661",
                   "merge.border":"#fef8ec00",
                   "merge.currentContentBackground":"#33e7ff33",
                   "merge.currentHeaderBackground":"#33e7ff55",
                   "merge.incomingContentBackground":"#9d92f233",
                   "merge.incomingHeaderBackground":"#9d92f255",
                   "merge.commonContentBackground":"#ffc18033",
                   "merge.commonHeaderBackground":"#ffc18055",
                   "editorOverviewRuler.currentContentForeground":"#33e7ff55",
                   "editorOverviewRuler.incomingContentForeground":"#9d92f255",
                   "editorOverviewRuler.commonContentForeground":"#ffc18055",
                   "editorOverviewRuler.border":"#fef8ec",
                   "notificationCenter.border":"#f2edde",
                   "notificationCenterHeader.foreground":"#005661",
                   "notificationCenterHeader.background":"#f2edde",
                   "notificationToast.border":"#f2edde",
                   "notifications.foreground":"#005661",
                   "notifications.background":"#f2edde",
                   "notifications.border":"#f2edde",
                   "notificationLink.foreground":"#005661",
                   "diffEditor.insertedTextBackground":"#14b83230",
                   "diffEditor.removedTextBackground":"#BB1F0522",
                   "debugToolBar.background":"#f8efdd",
                   "debugExceptionWidget.background":"#f8efdd",
                   "debugExceptionWidget.border":"#00899e",
                   "extensionButton.prominentBackground":"#099",
                   "extensionButton.prominentForeground":"#e5f5f5",
                   "extensionButton.prominentHoverBackground":"#0cc",
                   "focusBorder":"#f2edde",
                   "foreground":"#005661",
                   "panel.background":"#f6ebd5",
                   "panel.border":"#00c6e0",
                   "panelTitle.activeBorder":"#00c6e0",
                   "panelTitle.activeForeground":"#0099ad",
                   "panelTitle.inactiveForeground":"#888477",
                   "peekView.border":"#0099ad",
                   "peekViewEditor.background":"#fff7e5",
                   "peekViewEditor.matchHighlightBackground":"#148f9f33",
                   "peekViewEditor.matchHighlightBorder":"#148f9f79",
                   "peekViewEditorGutter.background":"#fff7e5",
                   "peekViewResult.background":"#f8efdd",
                   "peekViewResult.fileForeground":"#e9a149",
                   "peekViewResult.lineForeground":"#87a7ab",
                   "peekViewResult.matchHighlightBackground":"#f2edde",
                   "peekViewResult.selectionBackground":"#f2edde",
                   "peekViewResult.selectionForeground":"#6a7a7c",
                   "peekViewTitle.background":"#f8efdd",
                   "peekViewTitleDescription.foreground":"#87a7ab",
                   "peekViewTitleLabel.foreground":"#e9a149",
                   "progressBar.background":"#00c6e0",
                   "scrollbar.shadow":"#00000055",
                   "scrollbarSlider.activeBackground":"#0099adad",
                   "scrollbarSlider.background":"#6a90955b",
                   "scrollbarSlider.hoverBackground":"#0099ad62",
                   "gitDecoration.addedResourceForeground":"#009456",
                   "gitDecoration.modifiedResourceForeground":"#14b832",
                   "gitDecoration.deletedResourceForeground":"#ff4000",
                   "gitDecoration.untrackedResourceForeground":"#00c6e0",
                   "gitDecoration.ignoredResourceForeground":"#a8a28faa",
                   "gitDecoration.conflictingResourceForeground":"#e9a149",
                   "pickerGroup.border":"#00c6e0",
                   "pickerGroup.foreground":"#0099ad",
                   "list.activeSelectionBackground":"#b6e1e7",
                   "list.activeSelectionForeground":"#005661",
                   "list.dropBackground":"#cdcbb2",
                   "list.focusBackground":"#bee3ea",
                   "list.focusForeground":"#005661",
                   "list.highlightForeground":"#0099ad",
                   "list.hoverBackground":"#d2f3f9",
                   "list.hoverForeground":"#005661",
                   "list.inactiveFocusBackground":"#c9eaed",
                   "list.inactiveSelectionBackground":"#d5eef1",
                   "list.inactiveSelectionForeground":"#949384",
                   "list.errorForeground":"#c9481d",
                   "list.warningForeground":"#e07a52",
                   "listFilterWidget.background":"#d5eef1",
                   "listFilterWidget.outline":"#14b832",
                   "listFilterWidget.noMatchesOutline":"#ff4000",
                   "tree.indentGuidesStroke":"#d3cec5",
                   "settings.headerForeground":"#004d57",
                   "settings.modifiedItemIndicator":"#00bd23",
                   "settings.dropdownListBorder":"#ade2eb88",
                   "settings.dropdownBackground":"#f2edde",
                   "settings.dropdownForeground":"#0bb",
                   "settings.dropdownBorder":"#f2edde",
                   "settings.checkboxBackground":"#f2edde",
                   "settings.checkboxForeground":"#0bb",
                   "settings.checkboxBorder":"#f2edde",
                   "settings.textInputBackground":"#f2edde",
                   "settings.textInputForeground":"#0bb",
                   "settings.textInputBorder":"#f2edde",
                   "settings.numberInputBackground":"#f0e7d1",
                   "settings.numberInputForeground":"#5842ff",
                   "settings.numberInputBorder":"#f0e7d1",
                   "breadcrumb.foreground":"#888477",
                   "breadcrumb.background":"#fef8ec",
                   "breadcrumb.focusForeground":"#0099ad",
                   "breadcrumb.activeSelectionForeground":"#005661",
                   "breadcrumbPicker.background":"#f2edde",
                   "titleBar.activeBackground":"#f8efdd",
                   "titleBar.activeForeground":"#005661",
                   "titleBar.inactiveBackground":"#f8efdd",
                   "titleBar.inactiveForeground":"#888477",
                   "menu.background":"#f2edde",
                   "menu.foreground":"#888477",
                   "menu.selectionBackground":"#d2f3f9",
                   "menu.selectionForeground":"#0099ad",
                   "menu.selectionBorder":"#d2f3f9",
                   "menubar.selectionBackground":"#d2f3f9",
                   "menubar.selectionForeground":"#0099ad",
                   "menubar.selectionBorder":"#d2f3f9",
                   "editor.snippetTabstopHighlightBackground":"#fdefd3",
                   "editor.snippetTabstopHighlightBorder":"#fdf3dd",
                   "editor.snippetFinalTabstopHighlightBackground":"#fdefd3",
                   "editor.snippetFinalTabstopHighlightBorder":"#fdf3dd",
                   "minimap.findMatchHighlight":"#0099adaa",
                   "minimap.errorHighlight":"#ff4000ee",
                   "minimap.warningHighlight":"#e69533ee",
                   "minimapGutter.addedBackground":"#009456",
                   "minimapGutter.modifiedBackground":"#14b832",
                   "minimapGutter.deletedBackground":"#ff4000",
                   "minimap.background":"#fef8ec99",
                   "hotForeground":"#005661",
                   "icon.foreground":"#005661",
                   "window.activeBorder":"orangered",
                   "window.inactiveBorder":"orangered",
                   "window.background":"#fef8ec",
                   "window.headerBackground":"#fef8ec",
                   "window.footerBackground":"#fef8ec",
                   "popup.border":"orangered",
                   "popup.background":"#fef8ec",
                   "popup.foreground":"#005661",
                   "text.captionForeground":"#005661",
                   "text.dimmedForeground":"#005661",
                   "button.dimmedBackground":"#fef8ec",
                   "button.pressedBackground":"#fef8ec",
                   "button.border":"orangered",
                   "checkbox.background":"#fef8ec",
                   "checkbox.foreground":"#005661",
                   "checkbox.border":"orangered",
                   "dropdown.hoverBackground":"#fef8ec",
                   "dropdown.listBackground":"#fef8ec",
                   "input.hoverBackground":"#fef8ec",
                   "inputOption.activeBackground":"#fef8ec",
                   "inputValidation.errorForeground":"#005661",
                   "inputValidation.infoForeground":"#005661",
                   "inputValidation.warningForeground":"#005661",
                   "tag.background":"#fef8ec",
                   "tag.foreground":"#005661",
                   "list.invalidItemForeground":"#005661",
                   "list.filterMatchBackground":"#fef8ec",
                   "list.filterMatchBorder":"orangered",
                   "list.headerBackground":"#fef8ec",
                   "list.gridColor":"#005661",
                   "list.sortIndicatorForeground":"#005661",
                   "list.columnResizerForeground":"#005661",
                   "list.emptyBackground":"#fef8ec",
                   "activityBar.dropBorder":"orangered",
                   "activityBar.inactiveForeground":"#005661",
                   "activityBar.activeFocusBorder":"orangered",
                   "sideBarSectionHeader.border":"orangered",
                   "sideBar.markerBackground":"#fef8ec",
                   "editorGroupHeader.border":"orangered",
                   "editorGroup.focusedEmptyBorder":"orangered",
                   "tab.unfocusedActiveBorderTop":"orangered",
                   "tab.dropBackground":"#fef8ec",
                   "tab.hoverBackground":"#fef8ec",
                   "tab.hoverBorder":"orangered",
                   "tab.unfocusedHoverBorder":"orangered",
                   "tab.inactiveModifiedBorder":"orangered",
                   "tab.unfocusedActiveModifiedBorder":"orangered",
                   "tab.unfocusedInactiveModifiedBorder":"orangered",
                   "editorPane.background":"#fef8ec",
                   "editorCursor.background":"#fef8ec",
                   "editor.selectionForeground":"#005661",
                   "searchEditor.findMatchBackground":"#fef8ec",
                   "searchEditor.findMatchBorder":"orangered",
                   "searchEditor.textInputBorder":"orangered",
                   "editor.rangeHighlightBorder":"orangered",
                   "editor.symbolHighlightBackground":"#fef8ec",
                   "editor.symbolHighlightBorder":"orangered",
                   "editorOverviewRuler.background":"#fef8ec",
                   "editorOverviewRuler.findMatchForeground":"#005661",
                   "editorOverviewRuler.rangeHighlightForeground":"#005661",
                   "editorOverviewRuler.selectionHighlightForeground":"#005661",
                   "editorOverviewRuler.wordHighlightForeground":"#005661",
                   "editorOverviewRuler.wordHighlightStrongForeground":"#005661",
                   "editorOverviewRuler.modifiedForeground":"#005661",
                   "editorOverviewRuler.addedForeground":"#005661",
                   "editorOverviewRuler.deletedForeground":"#005661",
                   "editorOverviewRuler.errorForeground":"#005661",
                   "editorOverviewRuler.warningForeground":"#005661",
                   "editorOverviewRuler.infoForeground":"#005661",
                   "editorOverviewRuler.bracketMatchForeground":"#005661",
                   "problemsErrorIcon.foreground":"#005661",
                   "problemsWarningIcon.foreground":"#005661",
                   "problemsInfoIcon.foreground":"#005661",
                   "editorGutter.commentRangeForeground":"#005661",
                   "editorWidget.foreground":"#005661",
                   "editorWidget.resizeBorder":"orangered",
                   "editorHoverWidget.foreground":"#005661",
                   "editorHoverWidget.statusBarBackground":"#fef8ec",
                   "editorMarkerNavigationInfo.background":"#fef8ec",
                   "quickInput.background":"#fef8ec",
                   "quickInput.foreground":"#005661",
                   "quickInputTitle.background":"#fef8ec",
                   "diffEditor.insertedTextBorder":"orangered",
                   "diffEditor.removedTextBorder":"orangered",
                   "diffEditor.border":"orangered",
                   "minimap.selectionHighlight":"orangered",
                   "minimapSlider.background":"#fef8ec",
                   "minimapSlider.hoverBackground":"#fef8ec",
                   "minimapSlider.activeBackground":"#fef8ec",
                   "editorZone.background":"#fef8ec",
                   "editorZone.foreground":"#005661",
                   "resultView.headerBackground":"#fef8ec",
                   "resultView.headerForeground":"#005661",
                   "resultView.background":"#fef8ec",
                   "resultView.foreground":"#005661",
                   "resultView.gridColor":"orangered",
                   "resultStatus.background":"#fef8ec",
                   "resultStatus.foreground":"#005661",
                   "editorUnnecessaryCode.border":"orangered",
                   "editorUnnecessaryCode.opacity":"orangered",
                   "editor.foldBackground":"#fef8ec",
                   "panel.dropBackground":"#fef8ec",
                   "panelInput.border":"orangered",
                   "imagePreview.border":"orangered",
                   "tooltip.foreground":"#005661",
                   "tooltip.background":"#fef8ec",
                   "tooltip.border":"orangered",
                   "statusBarItem.prominentForeground":"#005661",
                   "statusBarItem.remoteBackground":"#fef8ec",
                   "statusBarItem.remoteForeground":"#005661",
                   "connectionTile.background":"#fef8ec",
                   "connectionTile.foreground":"#005661",
                   "connectionTile.border":"orangered",
                   "connectionTile.activeBackground":"#fef8ec",
                   "connectionTile.activeForeground":"#005661",
                   "connectionTile.activeBorder":"orangered",
                   "connectionTile.hoverBackground":"#fef8ec",
                   "connectionTileSecondary.background":"#fef8ec",
                   "connectionTileSecondary.foreground":"#005661",
                   "connectionTileSecondary.border":"orangered",
                   "connectionTileSecondary.activeBackground":"#fef8ec",
                   "connectionTileSecondary.activeForeground":"#005661",
                   "connectionTileSecondary.activeBorder":"orangered",
                   "titleBar.border":"orangered",
                   "menubar.background":"#fef8ec",
                   "menu.blurredBackground":"#fef8ec",
                   "menu.separatorBackground":"#fef8ec",
                   "menu.border":"orangered",
                   "notificationsErrorIcon.foreground":"#005661",
                   "notificationsWarningIcon.foreground":"#005661",
                   "notificationsInfoIcon.foreground":"#005661",
                   "extensionBadge.remoteBackground":"#fef8ec",
                   "extensionBadge.remoteForeground":"#005661",
                   "terminal.border":"orangered",
                   "terminal.selectionBackground":"#fef8ec",
                   "debugToolBar.border":"orangered",
                   "editor.stackFrameHighlightBackground":"#fef8ec",
                   "editor.focusedStackFrameHighlightBackground":"#fef8ec",
                   "welcomePage.background":"#fef8ec",
                   "gitDecoration.submoduleResourceForeground":"#005661",
                   "symbolIcon.arrayForeground":"#005661",
                   "symbolIcon.booleanForeground":"#005661",
                   "symbolIcon.classForeground":"#005661",
                   "symbolIcon.colorForeground":"#005661",
                   "symbolIcon.constantForeground":"#005661",
                   "symbolIcon.constructorForeground":"#005661",
                   "symbolIcon.enumeratorForeground":"#005661",
                   "symbolIcon.enumeratorMemberForeground":"#005661",
                   "symbolIcon.eventForeground":"#005661",
                   "symbolIcon.fieldForeground":"#005661",
                   "symbolIcon.fileForeground":"#005661",
                   "symbolIcon.folderForeground":"#005661",
                   "symbolIcon.functionForeground":"#005661",
                   "symbolIcon.interfaceForeground":"#005661",
                   "symbolIcon.keyForeground":"#005661",
                   "symbolIcon.keywordForeground":"#005661",
                   "symbolIcon.methodForeground":"#005661",
                   "symbolIcon.moduleForeground":"#005661",
                   "symbolIcon.namespaceForeground":"#005661",
                   "symbolIcon.nullForeground":"#005661",
                   "symbolIcon.numberForeground":"#005661",
                   "symbolIcon.objectForeground":"#005661",
                   "symbolIcon.operatorForeground":"#005661",
                   "symbolIcon.packageForeground":"#005661",
                   "symbolIcon.propertyForeground":"#005661",
                   "symbolIcon.referenceForeground":"#005661",
                   "symbolIcon.snippetForeground":"#005661",
                   "symbolIcon.stringForeground":"#005661",
                   "symbolIcon.structForeground":"#005661",
                   "symbolIcon.textForeground":"#005661",
                   "symbolIcon.typeParameterForeground":"#005661",
                   "symbolIcon.unitForeground":"#005661",
                   "symbolIcon.variableForeground":"#005661",
                   "debugIcon.breakpointForeground":"#005661",
                   "debugIcon.breakpointDisabledForeground":"#005661",
                   "debugIcon.breakpointUnverifiedForeground":"#005661",
                   "debugIcon.breakpointCurrentStackframeForeground":"#005661",
                   "debugIcon.breakpointStackframeForeground":"#005661",
                   "debugIcon.startForeground":"#005661",
                   "debugIcon.pauseForeground":"#005661",
                   "debugIcon.stopForeground":"#005661",
                   "debugIcon.disconnectForeground":"#005661",
                   "debugIcon.restartForeground":"#005661",
                   "debugIcon.stepOverForeground":"#005661",
                   "debugIcon.stepIntoForeground":"#005661",
                   "debugIcon.stepOutForeground":"#005661",
                   "debugIcon.continueForeground":"#005661",
                   "debugIcon.stepBackForeground":"#005661"
                },
                "tokenColors":[
                   {
                      "name":"COMMENT",
                      "scope":[
                         "comment",
                         "punctuation.definition.comment",
                         "punctuation.definition.tag",
                         "comment.block.documentation punctuation.definition.bracket",
                         "source.ocaml comment constant.regexp meta.separator"
                      ],
                      "settings":{
                         "foreground":"#8ca6a6"
                      }
                   },
                   {
                      "name":"TEXT",
                      "scope":[
                         "constant.character",
                         "constant.escape",
                         "text.html.markdown",
                         "punctuation.definition.list_item",
                         "keyword.begin.tag.ejs",
                         "constant.name.attribute.tag.pug",
                         "source.clojure meta.symbol",
                         "constant.other.description.jsdoc",
                         "keyword.other.array.phpdoc.php",
                         "keyword.operator.other.powershell",
                         "meta.link.inline punctuation.definition.string",
                         "source.sql",
                         "source meta.brace",
                         "source punctuation",
                         "text.html punctuation",
                         "markup meta punctuation.definition",
                         "meta.bracket.julia",
                         "meta.array.julia",
                         "punctuation.separator.key-value",
                         "entity.name.footnote",
                         "source.ocaml punctuation.definition.tag",
                         "source.ocaml entity.name.filename",
                         "source.reason entity.name.filename",
                         "entity.other.attribute-name strong",
                         "binding.fsharp keyword.symbol.fsharp",
                         "entity.name.record.field.elm",
                         "entity.name.record.field.accessor.elm",
                         "storage.modifier.array.bracket",
                         "source.css entity.other",
                         "meta.attribute-selector punctuation.definition.entity"
                      ],
                      "settings":{
                         "foreground":"#004d57"
                      }
                   },
                   {
                      "name":"KEYWORD",
                      "scope":[
                         "keyword",
                         "keyword.control",
                         "keyword.other.template",
                         "keyword.other.substitution",
                         "storage.modifier",
                         "meta.tag.sgml",
                         "punctuation.accessor",
                         "constant.other.color",
                         "entity.name.section",
                         "markup.heading",
                         "markup.heading punctuation.definition",
                         "entity.other.attribute-name.pseudo-class",
                         "entity.other.attribute-name.pseudo-element",
                         "tag.decorator.js entity.name.tag.js",
                         "tag.decorator.js punctuation.definition.tag.js",
                         "storage.type.function.pug",
                         "text.pug storage.type",
                         "text.pug meta.tag.other",
                         "source.clojure storage.control",
                         "meta.expression.clojure",
                         "punctuation.separator.slice.python",
                         "punctuation.separator.question-mark.cs",
                         "punctuation.definition.parameters.varargs",
                         "source.go keyword.operator",
                         "punctuation.separator.pointer-access",
                         "punctuation.separator.other.ruby",
                         "keyword.package",
                         "keyword.import",
                         "punctuation.definition.keyword",
                         "punctuation.separator.hash.cs",
                         "variable.parameter.rest.lua",
                         "entity.other.attribute-name.pseudo-class.css punctuation.definition.entity.css",
                         "entity.other.attribute-name.pseudo-element.css punctuation.definition.entity.css",
                         "source.kotlin storage.type.import",
                         "source.kotlin storage.type.package",
                         "constant.string.documentation.powershell",
                         "punctuation.section.directive",
                         "storage.type.rust",
                         "punctuation.definition.attribute",
                         "punctuation.definition.preprocessor",
                         "punctuation.separator.namespace",
                         "punctuation.separator.method",
                         "keyword.control punctuation.definition.function",
                         "source.ocaml variable.interpolation string",
                         "source.reason variable.interpolation",
                         "punctuation.definition.directive",
                         "storage.type.modifier",
                         "keyword.other.class.fileds",
                         "source.toml entity.other.attribute-name",
                         "source.css entity.name.tag.custom",
                         "sharing.modifier",
                         "keyword.control.class.ruby",
                         "keyword.control.def.ruby"
                      ],
                      "settings":{
                         "foreground":"#ff5792"
                      }
                   },
                   {
                      "name":"VARIABLE",
                      "scope":[
                         "variable",
                         "variable.object",
                         "variable.other",
                         "variable.parameter",
                         "support",
                         "entity.name.module",
                         "variable.import.parameter",
                         "variable.other.class",
                         "meta.toc-list.id.html",
                         "source.json meta.structure.dictionary.json support.type.property-name.json",
                         "markup.list",
                         "meta.var.clojure",
                         "entity.name.variable",
                         "source.java meta.class.body.java",
                         "entity.name.package.go",
                         "source.c",
                         "source.cpp",
                         "source.go",
                         "source.python",
                         "meta.function-call.arguments.python",
                         "source.ruby",
                         "source.coffee.embedded.source",
                         "source.coffee",
                         "storage.modifier.import",
                         "storage.modifier.package",
                         "storage.type.annotation",
                         "punctuation.definition.annotation",
                         "source.groovy.embedded.source",
                         "punctuation.definition.variable",
                         "source.powershell",
                         "string.quoted.interpolated.vala constant.character.escape.vala",
                         "source.apacheconf",
                         "source.objc",
                         "source.crystal",
                         "string.quoted.double.kotlin entity.string.template.element.kotlin",
                         "entity.name.package.kotlin",
                         "meta.template.expression.kotlin",
                         "parameter.variable.function",
                         "variable.other.constant.elixir",
                         "source.elixir.embedded.source",
                         "source.sql.embedded",
                         "punctuation.definition.placeholder",
                         "source.swift",
                         "source.julia",
                         "source.shell",
                         "variable.other.normal punctuation.definition.variable.shell",
                         "source.reason variable.language",
                         "source.reason variable.language string.other.link",
                         "source.elm meta.value",
                         "source.elm meta.declaration.module",
                         "meta.embedded.block variable punctuation.definition.variable.php",
                         "string.quoted.double.class.other",
                         "source.toml keyword",
                         "support.type.nim",
                         "source.tf meta.template.expression",
                         "source.scala entity.name.import"
                      ],
                      "settings":{
                         "foreground":"#f49725"
                      }
                   },
                   {
                      "name":"ANNOTATION",
                      "scope":[
                         "support.variable.property",
                         "constant.other.symbol.hashkey.ruby",
                         "constant.other.symbol.hashkey.ruby punctuation.definition.constant.ruby",
                         "entity.other.attribute-name.id",
                         "entity.other.attribute-name.id punctuation.definition.entity",
                         "entity.name.type.annotation.kotlin",
                         "support.type.primitive",
                         "meta.type.parameters entity.name.type",
                         "meta.type.annotation entity.name.type",
                         "punctuation.definition.typeparameters",
                         "source.python support.type.python",
                         "comment.block.documentation.phpdoc.php keyword.other.type.php",
                         "storage.type.php",
                         "keyword.type",
                         "storage.type.cs",
                         "storage.type.c",
                         "storage.type.objc",
                         "punctuation.definition.storage.type.objc",
                         "markup punctuation.definition",
                         "storage.type.powershell",
                         "comment.block.documentation entity.name.type",
                         "source.java storage.type",
                         "storage.type.primitive",
                         "source.groovy storage.type",
                         "storage.type.r",
                         "source.haskell storage.type",
                         "punctuation.separator.clause-head-body",
                         "source.go storage.type",
                         "storage.type.core.rust",
                         "storage.class.std.rust",
                         "storage.modifier.lifetime.rust",
                         "entity.name.lifetime.rust",
                         "support.type.vb",
                         "entity.name.type.kotlin",
                         "support.type.julia",
                         "constant.other.reference",
                         "source.graphql support.type",
                         "source.reason support.type string",
                         "entity.name.type.fsharp",
                         "source.elm storage.type",
                         "storage.type.user-defined",
                         "storage.type.built-in",
                         "support.type.builtin",
                         "source.swift support.type",
                         "support.class.crystal",
                         "storage.type.integral",
                         "source.cpp storage.type.cpp",
                         "source.vala storage.type",
                         "source.hlsl storage.type.basic",
                         "source.hlsl support.type.other",
                         "source.apex storage.type",
                         "source.nim storage.type",
                         "source.cpp entity.name.type",
                         "support.class.builtin",
                         "source.tf meta.keyword.string",
                         "source.tf meta.keyword.number",
                         "source.scala entity.name.class"
                      ],
                      "settings":{
                         "foreground":"#b3694d"
                      }
                   },
                   {
                      "name":"CONSTANT",
                      "scope":[
                         "constant",
                         "variable.other.constant",
                         "support.constant",
                         "punctuation.definition.entity",
                         "constant.character.entity",
                         "support.variable.magic",
                         "markup.quote",
                         "entity.name.type.type-parameter.cs",
                         "punctuation.bracket.angle",
                         "entity.name.function.preprocessor.c",
                         "storage.type.scala",
                         "entity.helper.apacheconf",
                         "variable.language.crystal",
                         "punctuation.definition.constant",
                         "support.constant punctuation.definition.variable",
                         "constant.character.math",
                         "support.class.math",
                         "source.graphql constant.character",
                         "source.reason constant.language.list",
                         "source.cpp variable.other.enummember",
                         "meta.table.lua variable.other",
                         "support.variable.class.hideshow",
                         "entity.other.attribute-name.class",
                         "meta.attribute.id entity.other.attribute-name",
                         "text.html entity.other.attribute-name",
                         "meta.tag.attributes entity.other.attribute-name",
                         "text.xml entity.other.attribute-name",
                         "source.cs entity.other.attribute-name",
                         "constant.character.format.placeholder",
                         "constant.other.placeholder"
                      ],
                      "settings":{
                         "foreground":"#a88c00"
                      }
                   },
                   {
                      "name":"TAG",
                      "scope":[
                         "variable.language",
                         "variable.parameter.function.language.special",
                         "markup.bold",
                         "markup.italic",
                         "punctuation.definition.italic",
                         "punctuation.definition.bold",
                         "entity.name.tag",
                         "variable.language punctuation.definition.variable",
                         "keyword.control.clojure",
                         "support.type.exception.python",
                         "keyword.other.this.cs",
                         "keyword.other.base.cs",
                         "keyword.other.var.cs",
                         "storage.modifier.super",
                         "source.go keyword",
                         "keyword.function.go",
                         "meta.separator",
                         "keyword.other.fn.rust",
                         "storage.modifier.static.rust",
                         "source.r meta.function.r keyword.control.r",
                         "storage.type.def",
                         "meta.class.identifier storage.modifier",
                         "source.scala keyword.declaration",
                         "storage.type",
                         "comment.block.documentation punctuation.definition.block.tag",
                         "comment.block.documentation punctuation.definition.inline.tag",
                         "entity.tag.apacheconf",
                         "keyword.other.julia",
                         "source.julia storage.modifier",
                         "constant.language.empty-list.haskell",
                         "meta.function.powershell storage.type.powershell",
                         "keyword.control.fun",
                         "punctuation.terminator.function",
                         "keyword.other.rust",
                         "keyword.other.declaration-specifier.swift",
                         "keyword.control.function-end.lua",
                         "keyword.control.class",
                         "keyword.control.def",
                         "source.ocaml keyword markup.underline",
                         "source.ocaml storage.type markup.underline",
                         "binding.fsharp keyword",
                         "function.anonymous keyword",
                         "function.anonymous keyword.symbol.fsharp",
                         "meta.embedded.block variable.language punctuation.definition.variable.php",
                         "keyword.declaration.dart",
                         "source.wsd keyword.other.class",
                         "source.wsd keyword.other.linebegin",
                         "keyword.other.skinparam.keyword",
                         "keyword.other.nim",
                         "markup.deleted.diff",
                         "source.tf support.class.variable"
                      ],
                      "settings":{
                         "foreground":"#e64100"
                      }
                   },
                   {
                      "name":"STRING",
                      "scope":[
                         "string",
                         "punctuation.definition.string",
                         "source.css support.constant",
                         "entity.name.import.go",
                         "markup.raw.texttt",
                         "markup.inserted.diff",
                         "source.scala punctuation.definition.character",
                         "constant.character.literal.scala",
                         "source.tf entity.name"
                      ],
                      "settings":{
                         "foreground":"#00b368"
                      }
                   },
                   {
                      "name":"STRINGINTERPOLATED",
                      "scope":[
                         "string.template",
                         "punctuation.definition.string.template",
                         "string.interpolated.python string.quoted.single.python",
                         "string.quoted.double.heredoc",
                         "string.quoted.interpolated.vala",
                         "string.quoted.interpolated.vala punctuation.definition.string",
                         "string.regexp.apacheconf",
                         "markup.inline.raw.string",
                         "markup.inline.raw punctuation.definition.raw",
                         "string.quoted.double.interpolated.crystal",
                         "string.quoted.double.interpolated.crystal punctuation.definition.string",
                         "text.tex markup.raw"
                      ],
                      "settings":{
                         "foreground":"#009456"
                      }
                   },
                   {
                      "name":"NUMBER",
                      "scope":[
                         "constant.numeric",
                         "constant.language",
                         "punctuation.separator.decimal.period.php",
                         "keyword.operator.null-conditional.cs",
                         "punctuation.separator.question-mark.cs",
                         "constant.integer.apacheconf",
                         "keyword.operator.nullable-type",
                         "constant.language punctuation.definition.variable",
                         "constant.others.fsharp",
                         "keyword.other.unit",
                         "string.quoted.double.skinparam.value",
                         "source.toml constant"
                      ],
                      "settings":{
                         "foreground":"#5842ff"
                      }
                   },
                   {
                      "name":"FUNCTION",
                      "scope":[
                         "variable.function",
                         "support.type.property-name",
                         "entity.name.function",
                         "string.other.link",
                         "markup.link",
                         "support.type.vendored",
                         "support.other.variable",
                         "meta.function-call.generic.python",
                         "meta.method-call.groovy meta.method.groovy",
                         "meta.class.body.groovy meta.method.body.java storage.type.groovy",
                         "punctuation.definition.decorator",
                         "support.function.any-method",
                         "text.tex support.function",
                         "text.tex punctuation.definition.function",
                         "entity.name.section.fsharp entity.name.section.fsharp",
                         "support.variable.class.function",
                         "keyword.control.cucumber.table",
                         "punctuation.decorator",
                         "source.tf support.class"
                      ],
                      "settings":{
                         "foreground":"#0095a8"
                      }
                   },
                   {
                      "name":"SUPPORT",
                      "scope":[
                         "entity.name",
                         "entity.other",
                         "support.orther.namespace.use.php",
                         "meta.use.php",
                         "support.other.namespace.php",
                         "support.type",
                         "support.class",
                         "punctuation.definition.parameters",
                         "support.function",
                         "support.function.construct",
                         "markup.changed.git_gutter",
                         "markup.underline.link",
                         "markup.underline.link.image",
                         "markup.underline",
                         "meta.symbol.namespace.clojure",
                         "entity.mime-type.apacheconf",
                         "keyword.operator.function.infix",
                         "entity.name.function.infix",
                         "entity.name.function.call.kotlin",
                         "text.tex support.function.verb",
                         "text.tex support.function.texttt",
                         "source.reason constant.language.unit",
                         "source.ocaml constant.language constant.numeric entity.other.attribute-name.id.css",
                         "source.reason entity.other.attribute-name constant.language constant.numeric",
                         "constant.language.unit.fsharp",
                         "source.wsd support.class.preprocessings",
                         "keyword.language.gherkin.feature.scenario",
                         "source.nim keyword.other.common.function",
                         "entity.name.type.namespace",
                         "entity.name.scope-resolution.function.call"
                      ],
                      "settings":{
                         "foreground":"#00bdd6"
                      }
                   },
                   {
                      "name":"MISC",
                      "scope":[
                         "source.js constant.other.object.key.js string.unquoted.label.js",
                         "source.js punctuation.section.embedded",
                         "punctuation.definition.template-expression",
                         "support.class",
                         "entity.name.type",
                         "storage.type.string.python",
                         "string.interpolated.pug",
                         "support.constant.handlebars",
                         "source.clojure punctuation.section.set",
                         "source.clojure punctuation.section.metadata",
                         "entity.global.clojure",
                         "source.python meta.function-call.python support.type.python",
                         "entity.other.inherited-class.python",
                         "punctuation.definition.interpolation",
                         "punctuation.section.embedded.begin.ruby",
                         "punctuation.section.embedded.end.ruby source.ruby",
                         "support.constant.math",
                         "entity.namespace.r",
                         "meta.method-call.groovy storage.type.groovy",
                         "entity.name.function-table.lua",
                         "source.scala entity.name.class.declaration",
                         "constant.character.escape",
                         "support.function.macro.julia",
                         "string.replacement.apacheconf",
                         "storage.modifier.using.vala",
                         "constant.other.haskell",
                         "source.objc entity.name.tag",
                         "string.quoted.other.literal.upper.crystal punctuation.definition.string",
                         "meta.embedded.line.crystal punctuation.section.embedded",
                         "meta.embedded.line.crystal punctuation.section.embedded source.crystal",
                         "punctuation.section.embedded",
                         "punctuation.section.tag",
                         "punctuation.section.embedded source.swift",
                         "variable.other.bracket punctuation.definition.variable",
                         "string.interpolated.dollar punctuation.definition.string",
                         "constant.character.escape punctuation.definition.keyword",
                         "source.ocaml entity.name.class constant.numeric",
                         "source.reason entity.name.class",
                         "keyword.format.specifier.fsharp",
                         "support.module.elm",
                         "meta.embedded.block.php punctuation.definition.variable.php",
                         "support.variable.lua",
                         "source.vala storage.type",
                         "support.variable.class.group",
                         "entity.name.type.class",
                         "source.tf meta.keyword.list",
                         "source.tf meta.keyword.map"
                      ],
                      "settings":{
                         "foreground":"#0094f0"
                      }
                   },
                   {
                      "name":"INVALID",
                      "scope":[
                         "invalid",
                         "invalid.illegal"
                      ],
                      "settings":{
                         "foreground":"#ff530f"
                      }
                   },
                   {
                      "name":"ITALIC",
                      "scope":[
                         "comment",
                         "storage.modifier",
                         "punctuation.definition.comment",
                         "entity.other",
                         "variable.language",
                         "support.type.vendored",
                         "support.constant.vendored",
                         "markup.quote",
                         "markup.italic",
                         "tag.decorator.js entity.name.tag.js",
                         "tag.decorator.js punctuation.definition.tag.js",
                         "keyword.control.clojure",
                         "source.clojure meta.symbol.dynamic",
                         "keyword.other.this.cs",
                         "keyword.other.base.cs",
                         "variable.other.member.c",
                         "support.type.core.rust",
                         "variable.other.object.property",
                         "variable.other.property",
                         "source.r meta.function.r keyword.control.r",
                         "comment.line.roxygen.r keyword",
                         "comment.line.roxygen.r variable.parameter.r",
                         "keyword.control.inheritance.coffee",
                         "comment.block.documentation.phpdoc.php keyword",
                         "keyword.other.array.phpdoc.php",
                         "storage.type.modifier",
                         "comment.block.javadoc.java keyword",
                         "comment.block.javadoc.java variable.parameter.java",
                         "keyword.operator.documentation.powershell",
                         "variable.other.table.property.lua",
                         "storage.type.scala",
                         "variable.parameter.function.language.special",
                         "comment.block.documentation.scala keyword",
                         "comment.block.documentation.scala variable.parameter",
                         "support.function.builtin.go",
                         "constant.other.symbol.hashkey.ruby",
                         "constant.other.symbol.hashkey.ruby punctuation.definition.constant.ruby",
                         "constant.other.symbol.ruby",
                         "source.vala storage.type.generic",
                         "constant.other.table-name",
                         "constant.other.placeholder",
                         "variable.other.field",
                         "keyword.function.go",
                         "entity.alias.import.go",
                         "source.swift keyword.other.declaration-specifier",
                         "support.variable.swift",
                         "keyword.other.capture-specifier",
                         "text.tex support.function.emph",
                         "constant.other.math",
                         "support.function.textit",
                         "entity.name.footnote",
                         "entity.name.function.directive.graphql",
                         "source.graphql support.type.enum",
                         "source.ocaml entity.name.filename",
                         "source.reason entity.name.filename",
                         "abstract.definition.fsharp keyword",
                         "abstract.definition.fsharp entity",
                         "function.anonymous keyword",
                         "entity.name.record.field.accessor.elm",
                         "support.type.primitive",
                         "support.type.builtin",
                         "keyword.type.cs",
                         "storage.type.built-in",
                         "storage.type.primitive",
                         "source.python support.type.python",
                         "storage.type.core.rust",
                         "source.swift support.type",
                         "source.go storage.type",
                         "storage.type.php",
                         "storage.type.function.kotlin",
                         "entity.name.type.kotlin",
                         "support.type.julia",
                         "variable.other.member",
                         "keyword.other.import",
                         "keyword.package",
                         "keyword.import",
                         "source.wsd keyword.control.diagram",
                         "keyword.language.gherkin.feature.step",
                         "source.hlsl storage.type.basic",
                         "source.apex keyword.type",
                         "sharing.modifier",
                         "source.nim storage.type.concrete",
                         "meta.preprocessor.pragma.nim",
                         "storage.type.integral",
                         "entity.name.scope-resolution.function.call",
                         "support.class.builtin",
                         "comment.block.documentation storage.type.class",
                         "source.tf meta.keyword.string",
                         "source.tf meta.keyword.number",
                         "source.scala entity.name.class",
                         "meta.import keyword.control",
                         "keyword.control.export"
                      ],
                      "settings":{
                         "fontStyle":"italic"
                      }
                   },
                   {
                      "name":"BOLD",
                      "scope":[
                         "keyword",
                         "keyword.control",
                         "keyword.operator",
                         "keyword.other.template",
                         "keyword.other.substitution",
                         "storage.type.function.arrow",
                         "constant.other.color",
                         "punctuation.accessor",
                         "entity.name.section",
                         "markup.bold",
                         "markup.bold string",
                         "markdown.heading",
                         "markup.inline.raw punctuation.definition.raw",
                         "markup.heading",
                         "storage.type.function.pug",
                         "storage.type.function.python",
                         "storage.type.annotation",
                         "punctuation.bracket.angle",
                         "keyword.other.new",
                         "punctuation.separator.question-mark.cs",
                         "storage.type.generic.wildcard",
                         "source.go keyword.operator",
                         "punctuation.separator.namespace",
                         "constant.other.symbol.ruby punctuation.definition.constant.ruby",
                         "variable.parameter",
                         "support.function.builtin.rust",
                         "storage.type.function.coffee",
                         "entity.name.variable.parameter",
                         "punctuation.separator.hash.cs",
                         "constant.other.symbol.ruby punctuation.definition.constant.ruby",
                         "constant.other.symbol.hashkey.ruby punctuation.definition.constant.ruby",
                         "meta.function.parameters variable.other",
                         "entity.name.type.annotation.kotlin",
                         "storage.type.objc",
                         "parameter.variable.function",
                         "markup punctuation.definition",
                         "punctuation.section.directive",
                         "punctuation.definition.preprocessor",
                         "source.ruby punctuation.definition.variable",
                         "punctuation.separator.method",
                         "support.function.textbf",
                         "source.graphql support.type.builtin",
                         "source.ocaml variable.interpolation string",
                         "entity.name.function.definition.special.constructor",
                         "entity.name.function.definition.special.member.destructor.",
                         "meta.function.parameters variable punctuation.definition.variable.php",
                         "source.wsd keyword.other.activity",
                         "keyword.control.class.ruby",
                         "keyword.control.def.ruby"
                      ],
                      "settings":{
                         "fontStyle":"bold"
                      }
                   },
                   {
                      "name":"BOLD-ITALIC",
                      "scope":[
                         "markup.bold markup.italic",
                         "markup.italic markup.bold",
                         "markup.quote markup.bold",
                         "markup.bold markup.italic string",
                         "markup.italic markup.bold string",
                         "markup.quote markup.bold string",
                         "text.html punctuation.section.embedded",
                         "variable.other.c",
                         "storage.modifier.lifetime.rust",
                         "entity.name.lifetime.rust",
                         "source.rust meta.attribute.rust",
                         "meta.attribute.id entity.other.attribute-name",
                         "keyword.other.fn.rust",
                         "source.ocaml punctuation.definition.tag emphasis",
                         "source.tf entity.name"
                      ],
                      "settings":{
                         "fontStyle":"bold italic"
                      }
                   },
                   {
                      "name":"NORMAL",
                      "scope":[
                         "keyword.begin.tag.ejs",
                         "source.python meta.function.decorator.python support.type.python",
                         "source.cs keyword.other",
                         "keyword.other.var.cs",
                         "source.go keyword",
                         "storage.modifier.static.rust",
                         "variable.parameter.r",
                         "variable.parameter.handlebars",
                         "storage.modifier.import",
                         "storage.modifier.package",
                         "meta.class.identifier storage.modifier",
                         "keyword.operator.other.powershell",
                         "source.lua storage.type.function",
                         "source.css variable.parameter",
                         "string.interpolated variable.parameter",
                         "source.apacheconf keyword",
                         "keyword.other.julia",
                         "storage.modifier.using.vala",
                         "source.objc keyword.other.property.attribute",
                         "source.sql keyword.other",
                         "keyword.other.using.vala",
                         "keyword.operator.function.infix",
                         "keyword.control.directive",
                         "keyword.other.rust",
                         "keyword.other.declaration-specifier.swift",
                         "entity.name.function.swift",
                         "keyword.control.function-end.lua",
                         "keyword.control.class",
                         "keyword.control.def",
                         "punctuation.definition.variable",
                         "entity.name.section.latex",
                         "source.ocaml keyword markup.underline",
                         "source.ocaml constant.language constant.numeric entity.other.attribute-name.id.css",
                         "source.reason entity.other.attribute-name constant.language constant.numeric",
                         "keyword.format.specifier.fsharp",
                         "entity.name.section.fsharp",
                         "binding.fsharp keyword",
                         "binding.fsharp keyword.symbol",
                         "record.fsharp keyword",
                         "keyword.symbol.fsharp",
                         "entity.name.section.fsharp keyword",
                         "namespace.open.fsharp keyword",
                         "namespace.open.fsharp entity",
                         "storage.type",
                         "source.cpp keyword.other",
                         "source.c keyword.other",
                         "keyword.other.unit",
                         "storage.modifier.array.bracket",
                         "keyword.control.default",
                         "meta.import.haskell keyword",
                         "keyword.declaration.dart",
                         "source.wsd keyword.other",
                         "keyword.other.skinparam",
                         "source.css keyword.control",
                         "source.css keyword.operator",
                         "keyword.language.gherkin.feature.scenario",
                         "keyword.control.cucumber.table",
                         "source.toml entity.other.attribute-name",
                         "source.toml keyword",
                         "keyword.other.nim",
                         "source.nim keyword.other.common.function",
                         "source.nim keyword.other",
                         "source.scala keyword.declaration",
                         "source.scala entity.name.class.declaration"
                      ],
                      "settings":{
                         "fontStyle":""
                      }
                   }
                ]
             },
             {
                "name":"Winter Is Coming",
                "type":"dark",
                "tokenColors":[
                   {
                      "settings":{
                         "foreground":"#bce7ff"
                      }
                   },
                   {
                      "scope":[
                         "meta.paragraph.markdown",
                         "string.other.link.description.title.markdown"
                      ],
                      "settings":{
                         "foreground":"#EEFFFF"
                      }
                   },
                   {
                      "scope":[
                         "entity.name.section.markdown",
                         "punctuation.definition.heading.markdown"
                      ],
                      "settings":{
                         "foreground":"#5ABEB0"
                      }
                   },
                   {
                      "scope":[
                         "punctuation.definition.string.begin.markdown",
                         "punctuation.definition.string.end.markdown",
                         "markup.quote.markdown"
                      ],
                      "settings":{
                         "foreground":"#82AAFF"
                      }
                   },
                   {
                      "scope":[
                         "markup.quote.markdown"
                      ],
                      "settings":{
                         "fontStyle":"italic",
                         "foreground":"#82AAFF"
                      }
                   },
                   {
                      "scope":[
                         "markup.bold.markdown",
                         "punctuation.definition.bold.markdown"
                      ],
                      "settings":{
                         "fontStyle":"bold",
                         "foreground":"#57cdff"
                      }
                   },
                   {
                      "scope":[
                         "markup.italic.markdown",
                         "punctuation.definition.italic.markdown"
                      ],
                      "settings":{
                         "fontStyle":"italic",
                         "foreground":"#C792EA"
                      }
                   },
                   {
                      "scope":[
                         "markup.inline.raw.string.markdown",
                         "markup.fenced_code.block.markdown"
                      ],
                      "settings":{
                         "fontStyle":"italic",
                         "foreground":"#f7ecb5"
                      }
                   },
                   {
                      "scope":[
                         "punctuation.definition.metadata.markdown"
                      ],
                      "settings":{
                         "foreground":"#f3b8c2"
                      }
                   },
                   {
                      "scope":[
                         "markup.underline.link.image.markdown",
                         "markup.underline.link.markdown"
                      ],
                      "settings":{
                         "foreground":"#6dbdfa"
                      }
                   },
                   {
                      "name":"Comment",
                      "scope":"comment",
                      "settings":{
                         "fontStyle":"italic",
                         "foreground":"#999999"
                      }
                   },
                   {
                      "name":"Quotes",
                      "scope":"punctuation.definition.string",
                      "settings":{
                         "foreground":"#6bff81"
                      }
                   },
                   {
                      "name":"String",
                      "scope":"string",
                      "settings":{
                         "foreground":"#bcf0c0"
                      }
                   },
                   {
                      "name":"String Quoted",
                      "scope":[
                         "string.quoted",
                         "variable.other.readwrite.js"
                      ],
                      "settings":{
                         "fontStyle":"",
                         "foreground":"#bcf0c0"
                      }
                   },
                   {
                      "name":"Number",
                      "scope":"constant.numeric",
                      "settings":{
                         "foreground":"#8dec95"
                      }
                   },
                   {
                      "name":"Boolean",
                      "scope":"constant.language.boolean",
                      "settings":{
                         "foreground":"#8dec95"
                      }
                   },
                   {
                      "name":"Constant",
                      "scope":"constant",
                      "settings":{
                         "foreground":"#A170C6"
                      }
                   },
                   {
                      "name":"Built-in constant",
                      "scope":[
                         "constant.language",
                         "punctuation.definition.constant",
                         "variable.other.constant"
                      ],
                      "settings":{
                         "foreground":"#92b6f4"
                      }
                   },
                   {
                      "name":"User-defined constant",
                      "scope":[
                         "constant.character",
                         "constant.other"
                      ],
                      "settings":{
                         "foreground":"#82AAFF"
                      }
                   },
                   {
                      "name":"Variable",
                      "scope":"variable",
                      "settings":{
                         "fontStyle":"italic",
                         "foreground":"#a4ceee"
                      }
                   },
                   {
                      "name":"JavaScript Other Variable",
                      "scope":"variable.other.object.js",
                      "settings":{
                         "foreground":"#d6deeb",
                         "fontStyle":"italic"
                      }
                   },
                   {
                      "name":"TypeScript[React] Variables and Object Properties",
                      "scope":[
                         "variable.other.readwrite.alias.ts",
                         "variable.other.readwrite.alias.tsx",
                         "variable.other.readwrite.ts",
                         "variable.other.readwrite.tsx",
                         "variable.other.object.ts",
                         "variable.other.object.tsx",
                         "variable.object.property.ts",
                         "variable.object.property.tsx",
                         "variable.other.ts",
                         "variable.other.tsx",
                         "variable.tsx",
                         "variable.ts"
                      ],
                      "settings":{
                         "foreground":"#d6deeb"
                      }
                   },
                   {
                      "name":"TypeScript Classes",
                      "scope":"meta.class entity.name.type.class.tsx",
                      "settings":{
                         "foreground":"#d29ffcff"
                      }
                   },
                   {
                      "name":"TypeScript Entity Name Type",
                      "scope":[
                         "entity.name.type.tsx",
                         "entity.name.type.module.tsx"
                      ],
                      "settings":{
                         "foreground":"#d29ffcff"
                      }
                   },
                   {
                      "name":"TypeScript Method Declaration e.g. `constructor`",
                      "scope":[
                         "meta.method.declaration storage.type.ts",
                         "meta.method.declaration storage.type.tsx"
                      ],
                      "settings":{
                         "foreground":"#a1bde6"
                      }
                   },
                   {
                      "name":"Variable Property Other object property",
                      "scope":[
                         "variable.other.object.property"
                      ],
                      "settings":{
                         "foreground":"#f7ecb5",
                         "fontStyle":"italic"
                      }
                   },
                   {
                      "name":"Variable Instances",
                      "scope":[
                         "variable.instance",
                         "variable.other.instance",
                         "variable.readwrite.instance",
                         "variable.other.readwrite.instance",
                         "variable.other.property"
                      ],
                      "settings":{
                         "foreground":"#7fdbca"
                      }
                   },
                   {
                      "name":"JavaScript Variable Other ReadWrite",
                      "scope":[
                         "variable.other.readwrite.js",
                         "variable.parameter"
                      ],
                      "settings":{
                         "foreground":"#d7dbe0"
                      }
                   },
                   {
                      "name":"Template Strings",
                      "scope":"string.template meta.template.expression",
                      "settings":{
                         "foreground":"#c63ed3"
                      }
                   },
                   {
                      "name":"Backtics(``) in Template Strings",
                      "scope":"string.template punctuation.definition.string",
                      "settings":{
                         "foreground":"#fff"
                      }
                   },
                   {
                      "name":"Storage",
                      "scope":"storage",
                      "settings":{
                         "fontStyle":"",
                         "foreground":"#6dbdfa"
                      }
                   },
                   {
                      "name":"Keywords and Storage types",
                      "scope":[
                         "keyword",
                         "storage.type",
                         "storage.modifier",
                         "variable.language.this"
                      ],
                      "settings":{
                         "foreground":"#00bff9",
                         "fontStyle":"italic"
                      }
                   },
                   {
                      "name":"Keywords operators",
                      "scope":[
                         "keyword.operator"
                      ],
                      "settings":{
                         "foreground":"#00bff9",
                         "fontStyle":"italic"
                      }
                   },
                   {
                      "name":"Storage",
                      "scope":[
                         "storage",
                         "meta.var.expr",
                         "meta.class meta.method.declaration meta.var.expr storage.type.js",
                         "storage.type.property.js",
                         "storage.type.property.ts"
                      ],
                      "settings":{
                         "foreground":"#c792ea",
                         "fontStyle":"italic"
                      }
                   },
                   {
                      "name":"JavaScript module imports and exports",
                      "scope":[
                         "variable.other.meta.import.js",
                         "meta.import.js variable.other",
                         "variable.other.meta.export.js",
                         "meta.export.js variable.other"
                      ],
                      "settings":{
                         "foreground":"#d3eed6"
                      }
                   },
                   {
                      "name":"Class name",
                      "scope":"entity.name.class",
                      "settings":{
                         "foreground":"#f7ecb5"
                      }
                   },
                   {
                      "name":"Inherited class",
                      "scope":"entity.other.inherited-class",
                      "settings":{
                         "fontStyle":"",
                         "foreground":"#4FB4D8"
                      }
                   },
                   {
                      "name":"Variables, Let and Const",
                      "scope":[
                         "variable.other.readwrites",
                         "meta.definition.variable"
                      ],
                      "settings":{
                         "fontStyle":"",
                         "foreground":"#f7ecb5"
                      }
                   },
                   {
                      "name":"Support Variable Property",
                      "scope":"support.variable.property",
                      "settings":{
                         "foreground":"#7fdbca"
                      }
                   },
                   {
                      "name":"Function name",
                      "scope":"entity.name.function",
                      "settings":{
                         "fontStyle":"italic",
                         "foreground":"#87aff4"
                      }
                   },
                   {
                      "name":"Function argument",
                      "scope":"variable.parameter",
                      "settings":{
                         "foreground":"#d7dbe0",
                         "fontStyle":""
                      }
                   },
                   {
                      "name":"Tag name",
                      "scope":"entity.name.tag",
                      "settings":{
                         "fontStyle":"",
                         "foreground":"#6dbdfa"
                      }
                   },
                   {
                      "name":"Entity Name Type",
                      "scope":"entity.name.type",
                      "settings":{
                         "foreground":"#d29ffc"
                      }
                   },
                   {
                      "name":"Tag attribute",
                      "scope":"entity.other.attribute-name",
                      "settings":{
                         "fontStyle":"italic",
                         "foreground":"#f7ecb5"
                      }
                   },
                   {
                      "name":"Meta - Decorator",
                      "scope":[
                         "punctuation.decorator"
                      ],
                      "settings":{
                         "fontStyle":"italic",
                         "foreground":"#f7ecb5"
                      }
                   },
                   {
                      "name":"Punctuation/Brackets/Tags",
                      "scope":[
                         "punctuation.definition.block",
                         "punctuation.definition.tag"
                      ],
                      "settings":{
                         "foreground":"#ffffff"
                      }
                   },
                   {
                      "name":"Library function",
                      "scope":"support.function",
                      "settings":{
                         "fontStyle":"",
                         "foreground":"#f7ecb5"
                      }
                   },
                   {
                      "name":"Library constant",
                      "scope":"support.constant",
                      "settings":{
                         "fontStyle":"",
                         "foreground":"#ec9cd2"
                      }
                   },
                   {
                      "name":"Library class/type",
                      "scope":[
                         "support.type",
                         "support.class"
                      ],
                      "settings":{
                         "foreground":"#7fdbca"
                      }
                   },
                   {
                      "name":"Library variable",
                      "scope":"support.other.variable",
                      "settings":{
                         "foreground":"#CBCDD2"
                      }
                   },
                   {
                      "name":"Invalid",
                      "scope":"invalid",
                      "settings":{
                         "fontStyle":" italic bold underline",
                         "foreground":"#6dbdfa"
                      }
                   },
                   {
                      "name":"Invalid deprecated",
                      "scope":"invalid.deprecated",
                      "settings":{
                         "foreground":"#6dbdfa",
                         "fontStyle":" bold italic underline"
                      }
                   },
                   {
                      "name":"JSON Property Names",
                      "scope":"support.type.property-name.json",
                      "settings":{
                         "foreground":"#91dacd"
                      }
                   },
                   {
                      "name":"JSON Support Constants",
                      "scope":"support.constant.json",
                      "settings":{
                         "foreground":"#addb67"
                      }
                   },
                   {
                      "name":"JSON Property values (string)",
                      "scope":"meta.structure.dictionary.value.json string.quoted.double",
                      "settings":{
                         "foreground":"#e0aff5"
                      }
                   },
                   {
                      "name":"Strings in JSON values",
                      "scope":"string.quoted.double.json punctuation.definition.string.json",
                      "settings":{
                         "foreground":"#80CBC4"
                      }
                   },
                   {
                      "name":"Specific JSON Property values like null",
                      "scope":"meta.structure.dictionary.json meta.structure.dictionary.value constant.language",
                      "settings":{
                         "foreground":"#f29fd8"
                      }
                   },
                   {
                      "name":"[JSON] - Support",
                      "scope":"source.json support",
                      "settings":{
                         "foreground":"#6dbdfa"
                      }
                   },
                   {
                      "name":"[JSON] - String",
                      "scope":[
                         "source.json string",
                         "source.json punctuation.definition.string"
                      ],
                      "settings":{
                         "foreground":"#ece7cd"
                      }
                   },
                   {
                      "name":"Lists",
                      "scope":"markup.list",
                      "settings":{
                         "foreground":"#6dbdfa"
                      }
                   },
                   {
                      "name":"Headings",
                      "scope":[
                         "markup.heading punctuation.definition.heading",
                         "entity.name.section"
                      ],
                      "settings":{
                         "fontStyle":"",
                         "foreground":"#4FB4D8"
                      }
                   },
                   {
                      "name":"Support",
                      "scope":[
                         "text.html.markdown meta.paragraph meta.link.inline",
                         "text.html.markdown meta.paragraph meta.link.inline punctuation.definition.string.begin.markdown",
                         "text.html.markdown meta.paragraph meta.link.inline punctuation.definition.string.end.markdown"
                      ],
                      "settings":{
                         "foreground":"#78bd65"
                      }
                   },
                   {
                      "name":"[Markdown] text ",
                      "scope":[
                         "meta.paragraph.markdown"
                      ],
                      "settings":{
                         "foreground":"#ffffff"
                      }
                   },
                   {
                      "name":"Quotes",
                      "scope":"markup.quote",
                      "settings":{
                         "foreground":"#78bd65",
                         "fontStyle":"italic"
                      }
                   },
                   {
                      "name":"Link Url",
                      "scope":"meta.link",
                      "settings":{
                         "foreground":"#78BD65"
                      }
                   },
                   {
                      "name":"Dockerfile",
                      "scope":"source.dockerfile",
                      "settings":{
                         "foreground":"#99d0f7"
                      }
                   }
                ],
                "colors":{
                   "activityBar.background":"#011627",
                   "activityBar.foreground":"#99d0f7",
                   "activityBar.border":"#219fd544",
                   "activityBarBadge.background":"#219fd5",
                   "activityBarBadge.foreground":"#ffffff",
                   "badge.background":"#219fd5",
                   "badge.foreground":"#ffffff",
                   "button.background":"#03648a",
                   "button.foreground":"#ffffff",
                   "button.hoverBackground":"#219fd5",
                   "contrastActiveBorder":"#122d42",
                   "contrastBorder":"#122d42",
                   "foreground":"#d6deeb",
                   "debugExceptionWidget.background":"#011627",
                   "debugToolBar.background":"#022846",
                   "diffEditor.insertedTextBackground":"#99b76d23",
                   "diffEditor.insertedTextBorder":"#addb6733",
                   "diffEditor.removedTextBackground":"#ef535033",
                   "diffEditor.removedTextBorder":"#ef53504d",
                   "editor.background":"#011627",
                   "editor.foreground":"#a7dbf7",
                   "editor.inactiveSelectionBackground":"#7e57c25a",
                   "editor.hoverHighlightBackground":"#0c4994",
                   "editor.lineHighlightBackground":"#0c499477",
                   "editor.selectionBackground":"#103362",
                   "editor.selectionHighlightBackground":"#103362",
                   "editor.findMatchHighlightBackground":"#103362",
                   "editor.rangeHighlightBackground":"#103362",
                   "editor.wordHighlightBackground":"#103362",
                   "editor.wordHighlightStrongBackground":"#103362",
                   "editorBracketMatch.background":"#219fd54d",
                   "editorOverviewRuler.currentContentForeground":"#7e57c2",
                   "editorOverviewRuler.incomingContentForeground":"#7e57c2",
                   "editorOverviewRuler.commonContentForeground":"#7e57c2",
                   "editorCursor.foreground":"#219fd5",
                   "editorError.foreground":"#ef5350",
                   "editorGroup.border":"#219fd544",
                   "editorGroupHeader.tabsBackground":"#011627",
                   "editorGutter.background":"#011627",
                   "editorHoverWidget.background":"#011627",
                   "editorHoverWidget.border":"#5f7e97",
                   "editorIndentGuide.activeBackground":"#C792EA",
                   "editorIndentGuide.background":"#0e2c45",
                   "editorLineNumber.foreground":"#219fd5",
                   "editorSuggestWidget.background":"#2C3043",
                   "editorSuggestWidget.border":"#2B2F40",
                   "editorSuggestWidget.foreground":"#d6deeb",
                   "editorSuggestWidget.highlightForeground":"#ffffff",
                   "editorSuggestWidget.selectedBackground":"#5f7e97",
                   "editorWarning.foreground":"#ffca28",
                   "editorWhitespace.foreground":"#3B3A32",
                   "editorWidget.background":"#0b2942",
                   "editorWidget.border":"#262A39",
                   "errorForeground":"#EF5350",
                   "gitDecoration.modifiedResourceForeground":"#219fd5",
                   "gitDecoration.untrackedResourceForeground":"#5ABEB0",
                   "input.background":"#0b253a",
                   "input.border":"#5f7e97",
                   "input.foreground":"#ffffffcc",
                   "input.placeholderForeground":"#5f7e97",
                   "inputOption.activeBorder":"#ffffff",
                   "inputValidation.errorBackground":"#ef5350",
                   "inputValidation.errorBorder":"#ef5350",
                   "inputValidation.infoBackground":"#219fd5",
                   "inputValidation.infoBorder":"#219fd5",
                   "inputValidation.warningBackground":"#f7ecb5",
                   "inputValidation.warningBorder":"#f7ecb5",
                   "inputValidation.warningForeground":"#000000",
                   "list.activeSelectionBackground":"#219fd5",
                   "list.inactiveSelectionBackground":"#0e293f",
                   "list.inactiveSelectionForeground":"#5f7e97",
                   "list.invalidItemForeground":"#975f94",
                   "list.dropBackground":"#011627",
                   "list.focusBackground":"#03648a",
                   "list.focusForeground":"#ffffff",
                   "list.highlightForeground":"#ffffff",
                   "list.hoverBackground":"#011627",
                   "list.hoverForeground":"#219fd5",
                   "notifications.background":"#011627",
                   "notifications.foreground":"#ffffffcc",
                   "notificationLink.foreground":"#80CBC4",
                   "notificationToast.border":"#219fd544",
                   "panel.background":"#011627",
                   "panel.border":"#219fd5",
                   "panelTitle.activeBorder":"#5f7e97",
                   "panelTitle.activeForeground":"#219fd5",
                   "panelTitle.inactiveForeground":"#5f7e97",
                   "peekView.border":"#f7ecb5",
                   "peekViewEditor.background":"#011627",
                   "peekViewResult.background":"#011627",
                   "peekViewTitle.background":"#011627",
                   "peekViewEditor.matchHighlightBackground":"#7e57c25a",
                   "peekViewResult.matchHighlightBackground":"#7e57c25a",
                   "peekViewResult.selectionBackground":"#2E3250",
                   "peekViewResult.selectionForeground":"#cecece",
                   "peekViewTitleDescription.foreground":"#697098",
                   "peekViewTitleLabel.foreground":"#cecece",
                   "pickerGroup.border":"#219fd544",
                   "scrollbar.shadow":"#010b14",
                   "scrollbarSlider.activeBackground":"#084d8180",
                   "scrollbarSlider.background":"#084d8180",
                   "scrollbarSlider.hoverBackground":"#084d8180",
                   "selection.background":"#4373c2",
                   "sideBar.background":"#011627",
                   "sideBar.border":"#219fd544",
                   "sideBarSectionHeader.background":"#011627",
                   "sideBar.foreground":"#7799bb",
                   "sideBarTitle.foreground":"#7799bb",
                   "sideBarSectionHeader.foreground":"#7799bb",
                   "statusBar.background":"#219fd5",
                   "statusBar.debuggingBackground":"#b15a91",
                   "statusBar.noFolderBackground":"#011627",
                   "statusBarItem.activeBackground":"#03648a",
                   "statusBarItem.hoverBackground":"#03648a",
                   "statusBarItem.prominentBackground":"#03648a",
                   "statusBarItem.prominentHoverBackground":"#03648a",
                   "tab.activeBackground":"#0b2942",
                   "tab.activeForeground":"#d2dee7",
                   "tab.inactiveBackground":"#010e1a",
                   "tab.inactiveForeground":"#5f7e97",
                   "tab.activeBorderTop":"#219fd5",
                   "terminal.ansiBlack":"#011627",
                   "textLink.foreground":"#219fd5",
                   "textLink.activeForeground":"#98c8ed",
                   "titleBar.activeBackground":"#112233",
                   "titleBar.activeForeground":"#eeefff",
                   "titleBar.border":"#303030",
                   "titleBar.inactiveBackground":"#000a11",
                   "walkThrough.embeddedEditorBackground":"#001111",
                   "welcomePage.buttonBackground":"#011627",
                   "welcomePage.buttonHoverBackground":"#011627",
                   "widget.shadow":"#219fd5",
                   "focusBorder":"orangered",
                   "hotForeground":"#d6deeb",
                   "background":"#03648a",
                   "descriptionForeground":"#d6deeb",
                   "icon.foreground":"#d6deeb",
                   "window.activeBorder":"orangered",
                   "window.inactiveBorder":"orangered",
                   "window.background":"#03648a",
                   "window.headerBackground":"#03648a",
                   "window.footerBackground":"#03648a",
                   "popup.border":"orangered",
                   "popup.background":"#03648a",
                   "popup.foreground":"#d6deeb",
                   "textBlockQuote.background":"#03648a",
                   "textBlockQuote.border":"orangered",
                   "textCodeBlock.background":"#03648a",
                   "textPreformat.foreground":"#d6deeb",
                   "textSeparator.foreground":"#d6deeb",
                   "text.captionForeground":"#d6deeb",
                   "text.dimmedForeground":"#d6deeb",
                   "button.dimmedBackground":"#03648a",
                   "button.pressedBackground":"#03648a",
                   "button.border":"orangered",
                   "checkbox.background":"#03648a",
                   "checkbox.foreground":"#d6deeb",
                   "checkbox.border":"orangered",
                   "dropdown.background":"#03648a",
                   "dropdown.hoverBackground":"#03648a",
                   "dropdown.listBackground":"#03648a",
                   "dropdown.border":"orangered",
                   "dropdown.foreground":"#d6deeb",
                   "input.hoverBackground":"#03648a",
                   "inputOption.activeBackground":"#03648a",
                   "inputValidation.errorForeground":"#d6deeb",
                   "inputValidation.infoForeground":"#d6deeb",
                   "tag.background":"#03648a",
                   "tag.foreground":"#d6deeb",
                   "progressBar.background":"#03648a",
                   "list.activeSelectionForeground":"#d6deeb",
                   "list.inactiveFocusBackground":"#03648a",
                   "list.errorForeground":"#d6deeb",
                   "list.warningForeground":"#d6deeb",
                   "listFilterWidget.background":"#03648a",
                   "listFilterWidget.outline":"orangered",
                   "listFilterWidget.noMatchesOutline":"orangered",
                   "list.filterMatchBackground":"#03648a",
                   "list.filterMatchBorder":"orangered",
                   "tree.indentGuidesStroke":"orangered",
                   "list.headerBackground":"#03648a",
                   "list.gridColor":"#219fd5",
                   "list.sortIndicatorForeground":"#d6deeb",
                   "list.columnResizerForeground":"#219fd5",
                   "list.emptyBackground":"#03648a",
                   "activityBar.dropBackground":"#03648a",
                   "activityBar.dropBorder":"orangered",
                   "activityBar.inactiveForeground":"#d6deeb",
                   "activityBar.activeBorder":"orangered",
                   "activityBar.activeBackground":"#03648a",
                   "activityBar.activeFocusBorder":"orangered",
                   "sideBarSectionHeader.border":"orangered",
                   "sideBar.dropBackground":"#03648a",
                   "sideBar.markerBackground":"#03648a",
                   "editorGroup.dropBackground":"#03648a",
                   "editorGroupHeader.noTabsBackground":"#03648a",
                   "editorGroupHeader.tabsBorder":"orangered",
                   "editorGroupHeader.border":"orangered",
                   "editorGroup.emptyBackground":"#03648a",
                   "editorGroup.focusedEmptyBorder":"orangered",
                   "tab.unfocusedActiveBackground":"#03648a",
                   "tab.border":"orangered",
                   "tab.activeBorder":"orangered",
                   "tab.unfocusedActiveBorder":"orangered",
                   "tab.unfocusedActiveBorderTop":"orangered",
                   "tab.dropBackground":"#03648a",
                   "tab.unfocusedActiveForeground":"#d6deeb",
                   "tab.unfocusedInactiveForeground":"#d6deeb",
                   "tab.hoverBackground":"#03648a",
                   "tab.unfocusedHoverBackground":"#03648a",
                   "tab.hoverBorder":"orangered",
                   "tab.unfocusedHoverBorder":"orangered",
                   "tab.activeModifiedBorder":"orangered",
                   "tab.inactiveModifiedBorder":"orangered",
                   "tab.unfocusedActiveModifiedBorder":"orangered",
                   "tab.unfocusedInactiveModifiedBorder":"orangered",
                   "editorPane.background":"#03648a",
                   "editorLineNumber.activeForeground":"#d6deeb",
                   "editorCursor.background":"#03648a",
                   "editor.selectionForeground":"#d6deeb",
                   "editor.selectionHighlightBorder":"orangered",
                   "editor.wordHighlightBorder":"orangered",
                   "editor.wordHighlightStrongBorder":"orangered",
                   "editor.findMatchBackground":"#03648a",
                   "editor.findRangeHighlightBackground":"#03648a",
                   "editor.findMatchBorder":"orangered",
                   "editor.findMatchHighlightBorder":"orangered",
                   "editor.findRangeHighlightBorder":"orangered",
                   "searchEditor.findMatchBackground":"#03648a",
                   "searchEditor.findMatchBorder":"orangered",
                   "searchEditor.textInputBorder":"orangered",
                   "editor.lineHighlightBorder":"orangered",
                   "editor.rangeHighlightBorder":"orangered",
                   "editor.symbolHighlightBackground":"#03648a",
                   "editor.symbolHighlightBorder":"orangered",
                   "editorRuler.foreground":"#d6deeb",
                   "editorBracketMatch.border":"orangered",
                   "editorOverviewRuler.background":"#03648a",
                   "editorOverviewRuler.border":"orangered",
                   "editorOverviewRuler.findMatchForeground":"#d6deeb",
                   "editorOverviewRuler.rangeHighlightForeground":"#d6deeb",
                   "editorOverviewRuler.selectionHighlightForeground":"#d6deeb",
                   "editorOverviewRuler.wordHighlightForeground":"#d6deeb",
                   "editorOverviewRuler.wordHighlightStrongForeground":"#d6deeb",
                   "editorOverviewRuler.modifiedForeground":"#d6deeb",
                   "editorOverviewRuler.addedForeground":"#d6deeb",
                   "editorOverviewRuler.deletedForeground":"#d6deeb",
                   "editorOverviewRuler.errorForeground":"#d6deeb",
                   "editorOverviewRuler.warningForeground":"#d6deeb",
                   "editorOverviewRuler.infoForeground":"#d6deeb",
                   "editorOverviewRuler.bracketMatchForeground":"#d6deeb",
                   "editorError.border":"orangered",
                   "editorWarning.border":"orangered",
                   "editorInfo.foreground":"#d6deeb",
                   "editorInfo.border":"orangered",
                   "editorHint.foreground":"#d6deeb",
                   "editorHint.border":"orangered",
                   "problemsErrorIcon.foreground":"#d6deeb",
                   "problemsWarningIcon.foreground":"#d6deeb",
                   "problemsInfoIcon.foreground":"#d6deeb",
                   "editorGutter.modifiedBackground":"#03648a",
                   "editorGutter.addedBackground":"#03648a",
                   "editorGutter.deletedBackground":"#03648a",
                   "editorGutter.commentRangeForeground":"#d6deeb",
                   "editorWidget.foreground":"#d6deeb",
                   "editorWidget.resizeBorder":"orangered",
                   "editorHoverWidget.foreground":"#d6deeb",
                   "editorHoverWidget.statusBarBackground":"#03648a",
                   "debugExceptionWidget.border":"orangered",
                   "editorMarkerNavigation.background":"#03648a",
                   "editorMarkerNavigationError.background":"#03648a",
                   "editorMarkerNavigationWarning.background":"#03648a",
                   "editorMarkerNavigationInfo.background":"#03648a",
                   "peekViewEditorGutter.background":"#03648a",
                   "peekViewEditor.matchHighlightBorder":"orangered",
                   "peekViewResult.fileForeground":"#d6deeb",
                   "peekViewResult.lineForeground":"#d6deeb",
                   "pickerGroup.foreground":"#d6deeb",
                   "quickInput.background":"#03648a",
                   "quickInput.foreground":"#d6deeb",
                   "quickInputTitle.background":"#03648a",
                   "diffEditor.border":"orangered",
                   "merge.currentHeaderBackground":"#03648a",
                   "merge.currentContentBackground":"#03648a",
                   "merge.incomingHeaderBackground":"#03648a",
                   "merge.incomingContentBackground":"#03648a",
                   "merge.border":"orangered",
                   "merge.commonContentBackground":"#03648a",
                   "merge.commonHeaderBackground":"#03648a",
                   "minimap.findMatchHighlight":"orangered",
                   "minimap.selectionHighlight":"orangered",
                   "minimap.errorHighlight":"orangered",
                   "minimap.warningHighlight":"orangered",
                   "minimap.background":"#03648a",
                   "minimapSlider.background":"#03648a",
                   "minimapSlider.hoverBackground":"#03648a",
                   "minimapSlider.activeBackground":"#03648a",
                   "minimapGutter.addedBackground":"#03648a",
                   "minimapGutter.modifiedBackground":"#03648a",
                   "minimapGutter.deletedBackground":"#03648a",
                   "editorZone.background":"#03648a",
                   "editorZone.foreground":"#d6deeb",
                   "resultView.headerBackground":"#03648a",
                   "resultView.headerForeground":"#d6deeb",
                   "resultView.background":"#03648a",
                   "resultView.foreground":"#d6deeb",
                   "resultView.gridColor":"orangered",
                   "resultStatus.background":"#03648a",
                   "resultStatus.foreground":"#d6deeb",
                   "editorLink.activeForeground":"#d6deeb",
                   "editorUnnecessaryCode.border":"orangered",
                   "editorUnnecessaryCode.opacity":"orangered",
                   "editor.foldBackground":"#03648a",
                   "panel.dropBackground":"#03648a",
                   "panelInput.border":"orangered",
                   "imagePreview.border":"orangered",
                   "tooltip.foreground":"#d6deeb",
                   "tooltip.background":"#03648a",
                   "tooltip.border":"orangered",
                   "statusBar.foreground":"#d6deeb",
                   "statusBar.border":"orangered",
                   "statusBar.debuggingForeground":"#d6deeb",
                   "statusBar.debuggingBorder":"orangered",
                   "statusBar.noFolderForeground":"#d6deeb",
                   "statusBar.noFolderBorder":"orangered",
                   "statusBarItem.prominentForeground":"#d6deeb",
                   "statusBarItem.remoteBackground":"#03648a",
                   "statusBarItem.remoteForeground":"#d6deeb",
                   "connectionTile.background":"#03648a",
                   "connectionTile.foreground":"#d6deeb",
                   "connectionTile.border":"orangered",
                   "connectionTile.activeBackground":"#03648a",
                   "connectionTile.activeForeground":"#d6deeb",
                   "connectionTile.activeBorder":"orangered",
                   "connectionTile.hoverBackground":"#03648a",
                   "connectionTileSecondary.background":"#03648a",
                   "connectionTileSecondary.foreground":"#d6deeb",
                   "connectionTileSecondary.border":"orangered",
                   "connectionTileSecondary.activeBackground":"#03648a",
                   "connectionTileSecondary.activeForeground":"#d6deeb",
                   "connectionTileSecondary.activeBorder":"orangered",
                   "titleBar.inactiveForeground":"#d6deeb",
                   "menubar.background":"#03648a",
                   "menubar.selectionForeground":"#d6deeb",
                   "menubar.selectionBackground":"#03648a",
                   "menubar.selectionBorder":"orangered",
                   "menu.foreground":"#d6deeb",
                   "menu.background":"#03648a",
                   "menu.blurredBackground":"#03648a",
                   "menu.selectionForeground":"#d6deeb",
                   "menu.selectionBackground":"#03648a",
                   "menu.selectionBorder":"orangered",
                   "menu.separatorBackground":"#03648a",
                   "menu.border":"orangered",
                   "notificationCenter.border":"orangered",
                   "notificationCenterHeader.foreground":"#d6deeb",
                   "notificationCenterHeader.background":"#03648a",
                   "notifications.border":"orangered",
                   "notificationsErrorIcon.foreground":"#d6deeb",
                   "notificationsWarningIcon.foreground":"#d6deeb",
                   "notificationsInfoIcon.foreground":"#d6deeb",
                   "extensionButton.prominentForeground":"#d6deeb",
                   "extensionButton.prominentBackground":"#03648a",
                   "extensionButton.prominentHoverBackground":"#03648a",
                   "extensionBadge.remoteBackground":"#03648a",
                   "extensionBadge.remoteForeground":"#d6deeb",
                   "terminal.background":"#03648a",
                   "terminal.border":"orangered",
                   "terminal.foreground":"#d6deeb",
                   "terminal.ansiBlue":"orangered",
                   "terminal.ansiBrightBlack":"orangered",
                   "terminal.ansiBrightBlue":"orangered",
                   "terminal.ansiBrightCyan":"orangered",
                   "terminal.ansiBrightGreen":"orangered",
                   "terminal.ansiBrightMagenta":"orangered",
                   "terminal.ansiBrightRed":"orangered",
                   "terminal.ansiBrightWhite":"orangered",
                   "terminal.ansiBrightYellow":"orangered",
                   "terminal.ansiCyan":"orangered",
                   "terminal.ansiGreen":"orangered",
                   "terminal.ansiMagenta":"orangered",
                   "terminal.ansiRed":"orangered",
                   "terminal.ansiWhite":"orangered",
                   "terminal.ansiYellow":"orangered",
                   "terminal.selectionBackground":"#03648a",
                   "terminalCursor.background":"#03648a",
                   "terminalCursor.foreground":"#d6deeb",
                   "debugToolBar.border":"orangered",
                   "editor.stackFrameHighlightBackground":"#03648a",
                   "editor.focusedStackFrameHighlightBackground":"#03648a",
                   "welcomePage.background":"#03648a",
                   "gitDecoration.addedResourceForeground":"#d6deeb",
                   "gitDecoration.deletedResourceForeground":"#d6deeb",
                   "gitDecoration.ignoredResourceForeground":"#d6deeb",
                   "gitDecoration.conflictingResourceForeground":"#d6deeb",
                   "gitDecoration.submoduleResourceForeground":"#d6deeb",
                   "settings.headerForeground":"#d6deeb",
                   "settings.modifiedItemIndicator":"orangered",
                   "settings.dropdownBackground":"#03648a",
                   "settings.dropdownForeground":"#d6deeb",
                   "settings.dropdownBorder":"orangered",
                   "settings.dropdownListBorder":"orangered",
                   "settings.checkboxBackground":"#03648a",
                   "settings.checkboxForeground":"#d6deeb",
                   "settings.checkboxBorder":"orangered",
                   "settings.textInputBackground":"#03648a",
                   "settings.textInputForeground":"#d6deeb",
                   "settings.textInputBorder":"orangered",
                   "settings.numberInputBackground":"#03648a",
                   "settings.numberInputForeground":"#d6deeb",
                   "settings.numberInputBorder":"orangered",
                   "breadcrumb.foreground":"#d6deeb",
                   "breadcrumb.background":"#03648a",
                   "breadcrumb.focusForeground":"#d6deeb",
                   "breadcrumb.activeSelectionForeground":"#d6deeb",
                   "breadcrumbPicker.background":"#03648a",
                   "editor.snippetTabstopHighlightBackground":"#03648a",
                   "editor.snippetTabstopHighlightBorder":"orangered",
                   "editor.snippetFinalTabstopHighlightBackground":"#03648a",
                   "editor.snippetFinalTabstopHighlightBorder":"orangered",
                   "symbolIcon.arrayForeground":"#d6deeb",
                   "symbolIcon.booleanForeground":"#d6deeb",
                   "symbolIcon.classForeground":"#d6deeb",
                   "symbolIcon.colorForeground":"#d6deeb",
                   "symbolIcon.constantForeground":"#d6deeb",
                   "symbolIcon.constructorForeground":"#d6deeb",
                   "symbolIcon.enumeratorForeground":"#d6deeb",
                   "symbolIcon.enumeratorMemberForeground":"#d6deeb",
                   "symbolIcon.eventForeground":"#d6deeb",
                   "symbolIcon.fieldForeground":"#d6deeb",
                   "symbolIcon.fileForeground":"#d6deeb",
                   "symbolIcon.folderForeground":"#d6deeb",
                   "symbolIcon.functionForeground":"#d6deeb",
                   "symbolIcon.interfaceForeground":"#d6deeb",
                   "symbolIcon.keyForeground":"#d6deeb",
                   "symbolIcon.keywordForeground":"#d6deeb",
                   "symbolIcon.methodForeground":"#d6deeb",
                   "symbolIcon.moduleForeground":"#d6deeb",
                   "symbolIcon.namespaceForeground":"#d6deeb",
                   "symbolIcon.nullForeground":"#d6deeb",
                   "symbolIcon.numberForeground":"#d6deeb",
                   "symbolIcon.objectForeground":"#d6deeb",
                   "symbolIcon.operatorForeground":"#d6deeb",
                   "symbolIcon.packageForeground":"#d6deeb",
                   "symbolIcon.propertyForeground":"#d6deeb",
                   "symbolIcon.referenceForeground":"#d6deeb",
                   "symbolIcon.snippetForeground":"#d6deeb",
                   "symbolIcon.stringForeground":"#d6deeb",
                   "symbolIcon.structForeground":"#d6deeb",
                   "symbolIcon.textForeground":"#d6deeb",
                   "symbolIcon.typeParameterForeground":"#d6deeb",
                   "symbolIcon.unitForeground":"#d6deeb",
                   "symbolIcon.variableForeground":"#d6deeb",
                   "debugIcon.breakpointForeground":"#d6deeb",
                   "debugIcon.breakpointDisabledForeground":"#d6deeb",
                   "debugIcon.breakpointUnverifiedForeground":"#d6deeb",
                   "debugIcon.breakpointCurrentStackframeForeground":"#d6deeb",
                   "debugIcon.breakpointStackframeForeground":"#d6deeb",
                   "debugIcon.startForeground":"#d6deeb",
                   "debugIcon.pauseForeground":"#d6deeb",
                   "debugIcon.stopForeground":"#d6deeb",
                   "debugIcon.disconnectForeground":"#d6deeb",
                   "debugIcon.restartForeground":"#d6deeb",
                   "debugIcon.stepOverForeground":"#d6deeb",
                   "debugIcon.stepIntoForeground":"#d6deeb",
                   "debugIcon.stepOutForeground":"#d6deeb",
                   "debugIcon.continueForeground":"#d6deeb",
                   "debugIcon.stepBackForeground":"#d6deeb"
                }
             },
             {
                "name":"Complete Dark",
                "uuid":"F6793D62-3C50-42D0-9119-D417074F691C",
                "tokenColors":[
                   {
                      "scope":"emphasis",
                      "settings":{
                         "fontStyle":"italic"
                      }
                   },
                   {
                      "scope":"strong",
                      "settings":{
                         "fontStyle":"bold"
                      }
                   },
                   {
                      "scope":"header",
                      "settings":{
                         "foreground":"#000080"
                      }
                   },
                   {
                      "name":"Generic comment + line/block defaults",
                      "scope":"comment, comment.line, comment.block",
                      "settings":{
                         "foreground":"#0987cb"
                      }
                   },
                   {
                      "name":"Single line comment (//, --, #)",
                      "scope":"comment.line.double-slash, comment.line.double-dash, comment.line.number-sign",
                      "settings":{
                         "foreground":"#52a0cb"
                      }
                   },
                   {
                      "name":"Single line comment with char",
                      "scope":"comment.line.character",
                      "settings":{
                         "foreground":"#709dce"
                      }
                   },
                   {
                      "name":"Multi line comment (doc type)",
                      "scope":"comment.block.documentation",
                      "settings":{
                         "foreground":"#709dce"
                      }
                   },
                   {
                      "name":"Generic constant + others default",
                      "scope":"constant, constant.other",
                      "settings":{
                         "foreground":"#e59337"
                      }
                   },
                   {
                      "name":"Numeric constant",
                      "scope":"constant.numeric",
                      "settings":{
                         "foreground":"#e59337"
                      }
                   },
                   {
                      "name":"Character constant",
                      "scope":"constant.character",
                      "settings":{
                         "foreground":"#e59337"
                      }
                   },
                   {
                      "name":"Escape sequence",
                      "scope":"constant.character.escape",
                      "settings":{
                         "foreground":"#ff6f30"
                      }
                   },
                   {
                      "name":"Language constant",
                      "scope":"constant.language",
                      "settings":{
                         "fontStyle":"bold",
                         "foreground":"#c5914c"
                      }
                   },
                   {
                      "name":"Generic entity + others default",
                      "scope":"entity, entity.other",
                      "settings":{
                         "foreground":"#cc666a"
                      }
                   },
                   {
                      "name":"Generic entity name",
                      "scope":"entity.name",
                      "settings":{
                         "foreground":"#cc4e52"
                      }
                   },
                   {
                      "name":"Function name",
                      "scope":"entity.name.function",
                      "settings":{
                         "foreground":"#c2c299"
                      }
                   },
                   {
                      "name":"Type name",
                      "scope":"entity.name.type",
                      "settings":{
                         "foreground":"#ebd8b7"
                      }
                   },
                   {
                      "name":"Tag name",
                      "scope":"entity.name.tag",
                      "settings":{
                         "foreground":"#cc833b"
                      }
                   },
                   {
                      "name":"Section name",
                      "scope":"entity.name.section",
                      "settings":{
                         "foreground":"#c2c269"
                      }
                   },
                   {
                      "name":"Inherited class",
                      "scope":"entity.other.inherited-class",
                      "settings":{
                         "fontStyle":"italic underline",
                         "foreground":"#cf85be"
                      }
                   },
                   {
                      "name":"Attribute name",
                      "scope":"entity.other.attribute-name",
                      "settings":{
                         "foreground":"#eb9195"
                      }
                   },
                   {
                      "name":"Generic invalid",
                      "scope":"invalid",
                      "settings":{
                         "background":"#e03e44",
                         "foreground":"#FFFFFF"
                      }
                   },
                   {
                      "name":"Illegal",
                      "scope":"invalid.illegal",
                      "settings":{
                         "background":"#e03e44",
                         "foreground":"#e5e500"
                      }
                   },
                   {
                      "name":"Deprecated",
                      "scope":"invalid.deprecated",
                      "settings":{
                         "background":"#e0a9ab"
                      }
                   },
                   {
                      "name":"Generic keyword",
                      "scope":"keyword",
                      "settings":{
                         "fontStyle":"bold",
                         "foreground":"#aaaaaa"
                      }
                   },
                   {
                      "name":"Control keyword",
                      "scope":"keyword.control",
                      "settings":{
                         "fontStyle":"bold",
                         "foreground":"#a9b5ad"
                      }
                   },
                   {
                      "name":"Operator keyword + operators",
                      "scope":"keyword.operator",
                      "settings":{
                         "fontStyle":"bold",
                         "foreground":"#aaa9b5"
                      }
                   },
                   {
                      "name":"Other keywords",
                      "scope":"keyword.other",
                      "settings":{
                         "fontStyle":"bold",
                         "foreground":"#8f9a9c"
                      }
                   },
                   {
                      "name":"Generic markup",
                      "scope":"markup",
                      "settings":{

                      }
                   },
                   {
                      "name":"Generic meta",
                      "scope":"meta",
                      "settings":{

                      }
                   },
                   {
                      "name":"Generic storage",
                      "scope":"storage",
                      "settings":{
                         "fontStyle":"bold",
                         "foreground":"#689c9c"
                      }
                   },
                   {
                      "name":"Type",
                      "scope":"storage.type",
                      "settings":{
                         "fontStyle":"bold",
                         "foreground":"#78a6a6"
                      }
                   },
                   {
                      "name":"Storage modifier",
                      "scope":"storage.modifier",
                      "settings":{
                         "fontStyle":"bold",
                         "foreground":"#78a6a6"
                      }
                   },
                   {
                      "name":"Generic string",
                      "scope":"string",
                      "settings":{
                         "foreground":"#e5bd46"
                      }
                   },
                   {
                      "name":"Generic quoted string",
                      "scope":"string.quoted",
                      "settings":{
                         "foreground":"#e5bd46"
                      }
                   },
                   {
                      "name":"Singly quoted string",
                      "scope":"string.quoted.single",
                      "settings":{
                         "foreground":"#e5bd46"
                      }
                   },
                   {
                      "name":"Doubly quoted string",
                      "scope":"string.quoted.double",
                      "settings":{
                         "foreground":"#e5bd46"
                      }
                   },
                   {
                      "name":"Triply quoted string",
                      "scope":"string.quoted.triple",
                      "settings":{
                         "foreground":"#e5bd46"
                      }
                   },
                   {
                      "name":"Other quoted string",
                      "scope":"string.quoted.other",
                      "settings":{
                         "foreground":"#e5bd46"
                      }
                   },
                   {
                      "name":"Unquoted string",
                      "scope":"string.unquoted",
                      "settings":{
                         "foreground":"#e5bd46"
                      }
                   },
                   {
                      "name":"Interpolated string",
                      "scope":"string.interpolated",
                      "settings":{
                         "foreground":"#e0d5b3"
                      }
                   },
                   {
                      "name":"Regular expression string",
                      "scope":"string.regexp",
                      "settings":{
                         "foreground":"#FF6f30"
                      }
                   },
                   {
                      "name":"Other string",
                      "scope":"string.other",
                      "settings":{
                         "foreground":"#eccd73"
                      }
                   },
                   {
                      "name":"Generic support",
                      "scope":"support",
                      "settings":{
                         "foreground":"#9b90c3"
                      }
                   },
                   {
                      "name":"Function support",
                      "scope":"support.function",
                      "settings":{
                         "foreground":"#78a6a6"
                      }
                   },
                   {
                      "name":"Class support",
                      "scope":"support.class",
                      "settings":{
                         "foreground":"#9b90c3"
                      }
                   },
                   {
                      "name":"Type support",
                      "scope":"support.type",
                      "settings":{
                         "foreground":"#b9b1d5"
                      }
                   },
                   {
                      "name":"Constant support",
                      "scope":"support.constant",
                      "settings":{
                         "foreground":"#9b90c3"
                      }
                   },
                   {
                      "name":"Variable support",
                      "scope":"support.variable",
                      "settings":{
                         "foreground":"#9b90c3"
                      }
                   },
                   {
                      "name":"Other support",
                      "scope":"support.other",
                      "settings":{
                         "foreground":"#9b90c3"
                      }
                   },
                   {
                      "name":"Generic variable",
                      "scope":"variable",
                      "settings":{
                         "foreground":"#63bf8d"
                      }
                   },
                   {
                      "name":"Parameter variable",
                      "scope":"variable.parameter",
                      "settings":{
                         "foreground":"#63bf8d"
                      }
                   },
                   {
                      "name":"Language variable",
                      "scope":"variable.language",
                      "settings":{
                         "foreground":"#45aa73"
                      }
                   },
                   {
                      "name":"Other variable",
                      "scope":"variable.other",
                      "settings":{
                         "foreground":"#5aaa7f"
                      }
                   },
                   {
                      "name":"Predicate entity",
                      "scope":"entity.other.predicate",
                      "settings":{
                         "foreground":"#a6a6a6"
                      }
                   },
                   {
                      "name":"Any other block",
                      "scope":"entity.other.block",
                      "settings":{
                         "foreground":"#7d7d7d"
                      }
                   },
                   {
                      "name":"Token support",
                      "scope":"support.other.token",
                      "settings":{
                         "foreground":"#d7d7c7"
                      }
                   },
                   {
                      "name":"JSON String",
                      "scope":"meta.structure.dictionary.json string.quoted.double.json",
                      "settings":{
                         "foreground":"#CFCFC2"
                      }
                   },
                   {
                      "name":"diff.header",
                      "scope":"meta.diff, meta.diff.header",
                      "settings":{
                         "foreground":"#75715E"
                      }
                   },
                   {
                      "name":"diff.deleted",
                      "scope":"markup.deleted",
                      "settings":{
                         "foreground":"#F92672"
                      }
                   },
                   {
                      "name":"diff.inserted",
                      "scope":"markup.inserted",
                      "settings":{
                         "foreground":"#A6E22E"
                      }
                   },
                   {
                      "name":"diff.changed",
                      "scope":"markup.changed",
                      "settings":{
                         "foreground":"#E6DB74"
                      }
                   },
                   {
                      "scope":"markup.inserted",
                      "settings":{
                         "foreground":"#b5cea8"
                      }
                   },
                   {
                      "scope":"markup.deleted",
                      "settings":{
                         "foreground":"#ce9178"
                      }
                   },
                   {
                      "scope":"markup.changed",
                      "settings":{
                         "foreground":"#569cd6"
                      }
                   },
                   {
                      "scope":"markup.punctuation.quote",
                      "settings":{
                         "foreground":"#608b4e"
                      }
                   },
                   {
                      "scope":"constant.rgb-value",
                      "settings":{
                         "foreground":"#d4d4d4"
                      }
                   },
                   {
                      "scope":"entity.name.selector",
                      "settings":{
                         "foreground":"#d7ba7d"
                      }
                   },
                   {
                      "scope":"entity.other.attribute-name.css",
                      "settings":{
                         "foreground":"#d7ba7d"
                      }
                   },
                   {
                      "scope":"markup.underline",
                      "settings":{
                         "fontStyle":"underline"
                      }
                   },
                   {
                      "scope":"markup.bold",
                      "settings":{
                         "fontStyle":"bold",
                         "foreground":"#569cd6"
                      }
                   },
                   {
                      "scope":"markup.heading",
                      "settings":{
                         "fontStyle":"bold",
                         "foreground":"#569cd6"
                      }
                   },
                   {
                      "scope":"markup.italic",
                      "settings":{
                         "fontStyle":"italic",
                         "foreground":"#569cd6"
                      }
                   }
                ],
                "colors":{
                   "hotForeground":"#F2F2F3",
                   "background":"#2C2C30",
                   "window.background":"#212126",
                   "window.headerBackground":"#1B1B1D",
                   "window.footerBackground":"#27272B",
                   "text.captionForeground":"#E2DFDF",
                   "text.dimmedForeground":"#797986",
                   "button.border":"#3D3D42",
                   "button.pressedBackground":"#3B3B40",
                   "dropdown.hoverBackground":"#403B3B",
                   "list.headerBackground":"#38383E",
                   "list.gridColor":"#404040",
                   "list.sortIndicatorForeground":"#0D66A2",
                   "list.columnResizerForeground":"#BFBFBF",
                   "list.emptyBackground":"#383838",
                   "button.dimmedBackground":"#4E4E55",
                   "input.hoverBackground":"#3B3A40",
                   "tag.background":"#606060",
                   "tag.foreground":"#DDDDDD",
                   "tooltip.foreground":"#D7D7DB",
                   "tooltip.background":"#3A3A40",
                   "tooltip.border":"#53535A",
                   "menubar.background":"#262626",
                   "menu.blurredBackground":"#25252680",
                   "tab.dropBackground":"#404040",
                   "resultView.headerBackground":"#0A0A0A",
                   "resultView.headerForeground":"#9F9EA3",
                   "resultView.background":"#161616",
                   "resultView.foreground":"#C0B4C4",
                   "resultView.gridColor":"#080808",
                   "editorZone.background":"#1E1E1E",
                   "editorZone.foreground":"#B1AEB5",
                   "resultStatus.background":"#0A0A0A",
                   "resultStatus.foreground":"#777777",
                   "connectionTile.activeBackground":"#123E54",
                   "connectionTile.activeBorder":"#2D9BD2",
                   "connectionTile.background":"#123F54",
                   "connectionTile.border":"#2A93C6",
                   "connectionTileSecondary.background":"#2E2E33",
                   "connectionTileSecondary.border":"#44444B",
                   "connectionTile.foreground":"#CCCCCC",
                   "connectionTile.activeForeground":"#CCCCCC",
                   "connectionTile.hoverBackground":"#1B5E7F",
                   "connectionTileSecondary.foreground":"#CCCCCC",
                   "connectionTileSecondary.activeBackground":"#2C2C30",
                   "connectionTileSecondary.activeForeground":"#CCCCCC",
                   "connectionTileSecondary.activeBorder":"#3D3D42",
                   "popup.border":"#959597",
                   "popup.background":"#39393D",
                   "popup.foreground":"#D7D7DB",
                   "activityBar.activeBackground":"#3A3A40",
                   "activityBar.activeBorder":"#FFFFFF",
                   "activityBar.activeFocusBorder":"#6D122D",
                   "activityBar.background":"#3A3A40",
                   "activityBar.border":"#3D3D42",
                   "activityBar.dropBackground":"#55555E",
                   "activityBar.foreground":"#B3B2B2",
                   "activityBar.inactiveForeground":"#FFFFFF",
                   "activityBarBadge.background":"#007ACC",
                   "activityBarBadge.foreground":"#FFFFFF",
                   "badge.background":"#4D4D4D",
                   "badge.foreground":"#FFFFFF",
                   "breadcrumb.activeSelectionForeground":"#E0E0E0",
                   "breadcrumb.background":"#1E1E1E",
                   "breadcrumb.focusForeground":"#E0E0E0",
                   "breadcrumb.foreground":"#CCCCCC",
                   "breadcrumbPicker.background":"#252526",
                   "button.background":"#333338",
                   "button.foreground":"#909091",
                   "button.hoverBackground":"#404045",
                   "checkbox.background":"#3C3C3C",
                   "checkbox.border":"#3C3C3C",
                   "checkbox.foreground":"#F0F0F0",
                   "contrastActiveBorder":"#3d3d42",
                   "contrastBorder":"#3d3d42",
                   "debugExceptionWidget.background":"#420B0D",
                   "debugExceptionWidget.border":"#A31515",
                   "debugIcon.breakpointCurrentStackframeForeground":"#FFCC00",
                   "debugIcon.breakpointDisabledForeground":"#848484",
                   "debugIcon.breakpointForeground":"#E51400",
                   "debugIcon.breakpointStackframeForeground":"#89D185",
                   "debugIcon.breakpointUnverifiedForeground":"#848484",
                   "debugIcon.continueForeground":"#75BEFF",
                   "debugIcon.disconnectForeground":"#F48771",
                   "debugIcon.pauseForeground":"#75BEFF",
                   "debugIcon.restartForeground":"#89D185",
                   "debugIcon.startForeground":"#89D185",
                   "debugIcon.stepBackForeground":"#75BEFF",
                   "debugIcon.stepIntoForeground":"#75BEFF",
                   "debugIcon.stepOutForeground":"#75BEFF",
                   "debugIcon.stepOverForeground":"#75BEFF",
                   "debugIcon.stopForeground":"#F48771",
                   "debugToolBar.background":"#333333",
                   "debugToolBar.border":"#3D3D42",
                   "descriptionForeground":"#D6D6DB",
                   "diffEditor.border":"#3D3D42",
                   "diffEditor.insertedTextBackground":"#9BB955",
                   "diffEditor.insertedTextBorder":"#3D3D42",
                   "diffEditor.removedTextBackground":"#FF0000",
                   "diffEditor.removedTextBorder":"#3D3D42",
                   "dropdown.background":"#2A2727",
                   "dropdown.border":"#3E3A3A",
                   "dropdown.foreground":"#F0F0F0",
                   "dropdown.listBackground":"#333338",
                   "editor.background":"#1E1E1E",
                   "editor.findMatchBackground":"#515C6A",
                   "editor.findMatchBorder":"#6C120F",
                   "editor.findMatchHighlightBackground":"#515C6A",
                   "editor.findMatchHighlightBorder":"#3D3D42",
                   "editor.findRangeHighlightBackground":"#6C120F",
                   "editor.findRangeHighlightBorder":"#3D3D42",
                   "editor.focusedStackFrameHighlightBackground":"#7ABD7A",
                   "editor.foldBackground":"#40BE5D33",
                   "editor.foreground":"#D4D4D4",
                   "editor.hoverHighlightBackground":"#264F78",
                   "editor.inactiveSelectionBackground":"#3A3D41",
                   "editor.lineHighlightBackground":"#2C2C30",
                   "editor.lineHighlightBorder":"#282828",
                   "editor.rangeHighlightBackground":"#B9323270",
                   "editor.rangeHighlightBorder":"#B9323270",
                   "editor.selectionBackground":"#264F78",
                   "editor.selectionForeground":"#D7D7DB",
                   "editor.selectionHighlightBackground":"#30985A",
                   "editor.selectionHighlightBorder":"#30985A",
                   "editor.snippetFinalTabstopHighlightBackground":"#2C2C30",
                   "editor.snippetFinalTabstopHighlightBorder":"#525252",
                   "editor.snippetTabstopHighlightBackground":"#7C7C7C",
                   "editor.snippetTabstopHighlightBorder":"#3D3D42",
                   "editor.stackFrameHighlightBackground":"#FFFF00",
                   "editor.symbolHighlightBackground":"#EA5C00",
                   "editor.symbolHighlightBorder":"#3D3D42",
                   "editor.wordHighlightBackground":"#575757",
                   "editor.wordHighlightBorder":"#3D3D42",
                   "editor.wordHighlightStrongBackground":"#004972",
                   "editor.wordHighlightStrongBorder":"#3D3D42",
                   "editorBracketMatch.background":"#006400",
                   "editorBracketMatch.border":"#888888",
                   "editorCodeLens.foreground":"#999999",
                   "editorCursor.background":"#2C2C30",
                   "editorCursor.foreground":"#AEAFAD",
                   "editorError.border":"#3D3D42",
                   "editorError.foreground":"#F48771",
                   "editorGroup.border":"#444444",
                   "editorGroup.dropBackground":"#53595D",
                   "editorGroup.emptyBackground":"#000000",
                   "editorGroup.focusedEmptyBorder":"#3D3D42",
                   "editorGroupHeader.noTabsBackground":"#1E1E1E",
                   "editorGroupHeader.tabsBackground":"#27272B",
                   "editorGroupHeader.tabsBorder":"#222225",
                   "editorGutter.addedBackground":"#587C0C",
                   "editorGutter.background":"#1E1E1E",
                   "editorGutter.commentRangeForeground":"#C5C5C5",
                   "editorGutter.deletedBackground":"#94151B",
                   "editorGutter.modifiedBackground":"#0C7D9D",
                   "editorHint.border":"#3D3D42",
                   "editorHint.foreground":"#EEEEEE",
                   "editorHoverWidget.background":"#252526",
                   "editorHoverWidget.border":"#454545",
                   "editorHoverWidget.foreground":"#CCCCCC",
                   "editorHoverWidget.statusBarBackground":"#2C2C2D",
                   "editorIndentGuide.activeBackground":"#707070",
                   "editorIndentGuide.background":"#404040",
                   "editorInfo.border":"#3D3D42",
                   "editorInfo.foreground":"#75BEFF",
                   "editorLightBulb.foreground":"#ffcc00",
                   "editorLightBulbAutoFix.foreground":"#75beff",
                   "editorLineNumber.activeForeground":"#C6C6C6",
                   "editorLineNumber.foreground":"#858585",
                   "editorLink.activeForeground":"#4E94CE",
                   "editorMarkerNavigation.background":"#2D2D30",
                   "editorMarkerNavigationError.background":"#F48771",
                   "editorMarkerNavigationInfo.background":"#75BEFF",
                   "editorMarkerNavigationWarning.background":"#CCA700",
                   "editorOverviewRuler.addedForeground":"#587C0C",
                   "editorOverviewRuler.border":"#7F7F7F",
                   "editorOverviewRuler.bracketMatchForeground":"#A0A0A0",
                   "editorOverviewRuler.commonContentForeground":"#606060",
                   "editorOverviewRuler.currentContentForeground":"#40C8AE",
                   "editorOverviewRuler.deletedForeground":"#94151B",
                   "editorOverviewRuler.errorForeground":"#FF1212",
                   "editorOverviewRuler.findMatchForeground":"#D18616",
                   "editorOverviewRuler.incomingContentForeground":"#40A6FF",
                   "editorOverviewRuler.infoForeground":"#75BEFF",
                   "editorOverviewRuler.modifiedForeground":"#0C7D9D",
                   "editorOverviewRuler.rangeHighlightForeground":"#007ACC",
                   "editorOverviewRuler.selectionHighlightForeground":"#A0A0A0",
                   "editorOverviewRuler.warningForeground":"#CCA700",
                   "editorOverviewRuler.wordHighlightForeground":"#A0A0A0",
                   "editorOverviewRuler.wordHighlightStrongForeground":"#C0A0C0",
                   "editorPane.background":"#222225",
                   "editorRuler.foreground":"#24903D",
                   "editorSuggestWidget.background":"#252526",
                   "editorSuggestWidget.border":"#454545",
                   "editorSuggestWidget.foreground":"#D4D4D4",
                   "editorSuggestWidget.highlightForeground":"#0097FB",
                   "editorSuggestWidget.selectedBackground":"#062F4A",
                   "editorUnnecessaryCode.border":"#3D3D42",
                   "editorUnnecessaryCode.opacity":"#000000",
                   "editorWarning.border":"#3D3D42",
                   "editorWarning.foreground":"#CCA700",
                   "editorWhitespace.foreground":"#E3E4E2",
                   "editorWidget.background":"#252526",
                   "editorWidget.border":"#454545",
                   "editorWidget.foreground":"#CCCCCC",
                   "editorWidget.resizeBorder":"#3D3D42",
                   "errorForeground":"#E78F7E",
                   "extensionBadge.remoteBackground":"#007ACC",
                   "extensionBadge.remoteForeground":"#FFFFFF",
                   "extensionButton.prominentBackground":"#327E36",
                   "extensionButton.prominentForeground":"#FFFFFF",
                   "extensionButton.prominentHoverBackground":"#28632B",
                   "focusBorder":"#0E639C",
                   "foreground":"#BFBFBF",
                   "gitDecoration.addedResourceForeground":"#81B88B",
                   "gitDecoration.conflictingResourceForeground":"#6C6CC4",
                   "gitDecoration.deletedResourceForeground":"#C74E39",
                   "gitDecoration.ignoredResourceForeground":"#8C8C8C",
                   "gitDecoration.modifiedResourceForeground":"#E2C08D",
                   "gitDecoration.submoduleResourceForeground":"#8DB9E2",
                   "gitDecoration.untrackedResourceForeground":"#73C991",
                   "icon.foreground":"#FFFFFF",
                   "imagePreview.border":"#808080",
                   "input.background":"#28272B",
                   "input.border":"#343338",
                   "input.foreground":"#CCCCCC",
                   "input.placeholderForeground":"#A6A6A6",
                   "inputOption.activeBackground":"#0E639C",
                   "inputOption.activeBorder":"#007ACC",
                   "inputValidation.errorBackground":"#5A1D1D",
                   "inputValidation.errorBorder":"#BE1100",
                   "inputValidation.errorForeground":"#D7D7DB",
                   "inputValidation.infoBackground":"#063B49",
                   "inputValidation.infoBorder":"#007ACC",
                   "inputValidation.infoForeground":"#D7D7DB",
                   "inputValidation.warningBackground":"#352A05",
                   "inputValidation.warningBorder":"#B89500",
                   "inputValidation.warningForeground":"#D7D7DB",
                   "list.activeSelectionBackground":"#094771",
                   "list.activeSelectionForeground":"#FFFFFF",
                   "list.deemphasizedForeground":"#8c8c8c",
                   "list.dropBackground":"#383B3D",
                   "list.errorForeground":"#F88070",
                   "list.filterMatchBackground":"#EA5C00",
                   "list.filterMatchBorder":"#3D3D42",
                   "list.focusBackground":"#062F4A",
                   "list.focusForeground":"#D7D7DB",
                   "list.highlightForeground":"#0097FB",
                   "list.hoverBackground":"#575757",
                   "list.hoverForeground":"#D7D7DB",
                   "list.inactiveFocusBackground":"#2C2C30",
                   "list.inactiveSelectionBackground":"#37373D",
                   "list.inactiveSelectionForeground":"#D7D7DB",
                   "list.invalidItemForeground":"#B89500",
                   "list.warningForeground":"#CCA700",
                   "listFilterWidget.background":"#653723",
                   "listFilterWidget.noMatchesOutline":"#BE1100",
                   "listFilterWidget.outline":"#000000",
                   "menu.background":"#252526",
                   "menu.border":"#3D3D42",
                   "menu.foreground":"#CCCCCC",
                   "menu.selectionBackground":"#094771",
                   "menu.selectionBorder":"#073555",
                   "menu.selectionForeground":"#FFFFFF",
                   "menu.separatorBackground":"#BBBBBB",
                   "menubar.selectionBackground":"#094771",
                   "menubar.selectionBorder":"#3D3D42",
                   "menubar.selectionForeground":"#CCCCCC",
                   "merge.border":"#3D3D42",
                   "merge.commonContentBackground":"#606060",
                   "merge.commonHeaderBackground":"#606060",
                   "merge.currentContentBackground":"#40C8AE",
                   "merge.currentHeaderBackground":"#40C8AE",
                   "merge.incomingContentBackground":"#40A6FF",
                   "merge.incomingHeaderBackground":"#40A6FF",
                   "minimap.background":"#1E1E1E",
                   "minimap.errorHighlight":"#FF1212",
                   "minimap.findMatchHighlight":"#D18616",
                   "minimap.selectionHighlight":"#264F78",
                   "minimap.warningHighlight":"#CCA700",
                   "minimapGutter.addedBackground":"#587C0C",
                   "minimapGutter.deletedBackground":"#94151B",
                   "minimapGutter.modifiedBackground":"#0C7D9D",
                   "minimapSlider.activeBackground":"#BFBFBF66",
                   "minimapSlider.background":"#66666666",
                   "minimapSlider.hoverBackground":"#99999966",
                   "notebook.outputContainerBackgroundColor":"#ffffff0f",
                   "notificationCenter.border":"#3D3D42",
                   "notificationCenterHeader.background":"#303031",
                   "notificationCenterHeader.foreground":"#D7D7DB",
                   "notificationLink.foreground":"#3794FF",
                   "notifications.background":"#252526",
                   "notifications.border":"#303031",
                   "notifications.foreground":"#CCCCCC",
                   "notificationsErrorIcon.foreground":"#F48771",
                   "notificationsInfoIcon.foreground":"#75BEFF",
                   "notificationsWarningIcon.foreground":"#CCA700",
                   "notificationToast.border":"#3D3D42",
                   "panel.background":"#1E1E1E",
                   "panel.border":"#808080",
                   "panel.dropBackground":"#FFFFFF",
                   "panelInput.border":"#3D3D42",
                   "panelTitle.activeBorder":"#E7E7E7",
                   "panelTitle.activeForeground":"#E7E7E7",
                   "panelTitle.inactiveForeground":"#E7E7E7",
                   "peekView.border":"#00568F",
                   "peekViewEditor.background":"#001F33",
                   "peekViewEditor.matchHighlightBackground":"#30985A",
                   "peekViewEditor.matchHighlightBorder":"#30985A",
                   "peekViewEditorGutter.background":"#001F33",
                   "peekViewResult.background":"#252526",
                   "peekViewResult.fileForeground":"#FFFFFF",
                   "peekViewResult.lineForeground":"#BBBBBB",
                   "peekViewResult.matchHighlightBackground":"#30985A",
                   "peekViewResult.selectionBackground":"#0E639C",
                   "peekViewResult.selectionForeground":"#BFBFBF",
                   "peekViewTitle.background":"#001C2E",
                   "peekViewTitleDescription.foreground":"#BFBFBF",
                   "peekViewTitleLabel.foreground":"#BFBFBF",
                   "pickerGroup.border":"#3F3F46",
                   "pickerGroup.foreground":"#3794FF",
                   "problemsErrorIcon.foreground":"#F48771",
                   "problemsInfoIcon.foreground":"#75BEFF",
                   "problemsWarningIcon.foreground":"#CCA700",
                   "progressBar.background":"#0E70C0",
                   "quickInput.background":"#252526",
                   "quickInput.foreground":"#CCCCCC",
                   "quickInputTitle.background":"#FFFFFF",
                   "scrollbar.shadow":"#000000",
                   "scrollbarSlider.activeBackground":"#BFBFBF",
                   "scrollbarSlider.background":"#797979",
                   "scrollbarSlider.hoverBackground":"#646464",
                   "searchEditor.findMatchBackground":"#EA5C00",
                   "searchEditor.textInputBorder":"#3D3D42",
                   "selection.background":"#0C7ED9",
                   "settings.checkboxBackground":"#3C3C3C",
                   "settings.checkboxBorder":"#3C3C3C",
                   "settings.checkboxForeground":"#F0F0F0",
                   "settings.dropdownBackground":"#3C3C3C",
                   "settings.dropdownBorder":"#3C3C3C",
                   "settings.dropdownForeground":"#F0F0F0",
                   "settings.dropdownListBorder":"#454545",
                   "settings.headerForeground":"#E7E7E7",
                   "settings.modifiedItemIndicator":"#0C7D9D",
                   "settings.numberInputBackground":"#292929",
                   "settings.numberInputBorder":"#3D3D42",
                   "settings.numberInputForeground":"#CCCCCC",
                   "settings.textInputBackground":"#292929",
                   "settings.textInputBorder":"#3D3D42",
                   "settings.textInputForeground":"#CCCCCC",
                   "sideBar.background":"#27272A",
                   "sideBar.border":"#3D3D42",
                   "sideBar.dropBackground":"#313135",
                   "sideBar.markerBackground":"#3ABB92",
                   "sideBar.foreground":"#D7D7DB",
                   "sideBarSectionHeader.background":"#424248",
                   "sideBarSectionHeader.border":"#424248",
                   "sideBarSectionHeader.foreground":"#B3B3B3",
                   "sideBarTitle.foreground":"#6E6E77",
                   "statusBar.background":"#007ACC",
                   "statusBar.border":"#000000",
                   "statusBar.debuggingForeground":"#FFFFFF",
                   "statusBar.foreground":"#FFFFFF",
                   "statusBar.noFolderBackground":"#68217A",
                   "statusBar.noFolderBorder":"#3D3D42",
                   "statusBar.noFolderForeground":"#FFFFFF",
                   "statusBarItem.activeBackground":"#0098FD",
                   "statusBarItem.hoverBackground":"#0089E6",
                   "statusBarItem.prominentBackground":"#C0CC0080",
                   "statusBarItem.prominentForeground":"#FFFFFF",
                   "statusBarItem.prominentHoverBackground":"#C0CC0099",
                   "statusBarItem.remoteBackground":"#16825D",
                   "statusBarItem.remoteForeground":"#FFFFFF",
                   "symbolIcon.arrayForeground":"#CCCCCC",
                   "symbolIcon.booleanForeground":"#CCCCCC",
                   "symbolIcon.classForeground":"#EE9D28",
                   "symbolIcon.colorForeground":"#CCCCCC",
                   "symbolIcon.constantForeground":"#CCCCCC",
                   "symbolIcon.constructorForeground":"#B180D7",
                   "symbolIcon.enumeratorForeground":"#EE9D28",
                   "symbolIcon.enumeratorMemberForeground":"#75BEFF",
                   "symbolIcon.eventForeground":"#EE9D28",
                   "symbolIcon.fieldForeground":"#75BEFF",
                   "symbolIcon.fileForeground":"#CCCCCC",
                   "symbolIcon.folderForeground":"#CCCCCC",
                   "symbolIcon.functionForeground":"#B180D7",
                   "symbolIcon.interfaceForeground":"#75BEFF",
                   "symbolIcon.keyForeground":"#CCCCCC",
                   "symbolIcon.keywordForeground":"#CCCCCC",
                   "symbolIcon.methodForeground":"#B180D7",
                   "symbolIcon.moduleForeground":"#CCCCCC",
                   "symbolIcon.namespaceForeground":"#CCCCCC",
                   "symbolIcon.nullForeground":"#CCCCCC",
                   "symbolIcon.numberForeground":"#CCCCCC",
                   "symbolIcon.objectForeground":"#CCCCCC",
                   "symbolIcon.operatorForeground":"#CCCCCC",
                   "symbolIcon.packageForeground":"#CCCCCC",
                   "symbolIcon.propertyForeground":"#CCCCCC",
                   "symbolIcon.referenceForeground":"#CCCCCC",
                   "symbolIcon.snippetForeground":"#CCCCCC",
                   "symbolIcon.stringForeground":"#CCCCCC",
                   "symbolIcon.structForeground":"#CCCCCC",
                   "symbolIcon.textForeground":"#CCCCCC",
                   "symbolIcon.typeParameterForeground":"#CCCCCC",
                   "symbolIcon.unitForeground":"#CCCCCC",
                   "symbolIcon.variableForeground":"#75BEFF",
                   "tab.activeBackground":"#222225",
                   "tab.activeBorder":"#FFFFFF00",
                   "tab.activeBorderTop":"#007ACC",
                   "tab.activeForeground":"#FFFFFF",
                   "tab.activeModifiedBorder":"#3399CC",
                   "tab.border":"#25252600",
                   "tab.hoverBackground":"#404040",
                   "tab.hoverBorder":"#404040",
                   "tab.inactiveBackground":"#2E2E33",
                   "tab.inactiveForeground":"#999999",
                   "tab.inactiveModifiedBorder":"#3399CC",
                   "tab.unfocusedActiveBackground":"#1E1E1E",
                   "tab.unfocusedActiveBorder":"#000000",
                   "tab.unfocusedActiveBorderTop":"#007ACC",
                   "tab.unfocusedActiveForeground":"#FFFFFF",
                   "tab.unfocusedActiveModifiedBorder":"#3399CC",
                   "tab.unfocusedHoverBackground":"#404040",
                   "tab.unfocusedHoverBorder":"#000000",
                   "tab.unfocusedInactiveForeground":"#FFFFFF",
                   "tab.unfocusedInactiveModifiedBorder":"#3399CC",
                   "terminal.ansiBlack":"#000000",
                   "terminal.ansiBlue":"#2472C8",
                   "terminal.ansiBrightBlack":"#666666",
                   "terminal.ansiBrightBlue":"#3B8EEA",
                   "terminal.ansiBrightCyan":"#29B8DB",
                   "terminal.ansiBrightGreen":"#23D18B",
                   "terminal.ansiBrightMagenta":"#D670D6",
                   "terminal.ansiBrightRed":"#F14C4C",
                   "terminal.ansiBrightWhite":"#E5E5E5",
                   "terminal.ansiBrightYellow":"#F5F543",
                   "terminal.ansiCyan":"#11A8CD",
                   "terminal.ansiGreen":"#0DBC79",
                   "terminal.ansiMagenta":"#BC3FBC",
                   "terminal.ansiRed":"#CD3131",
                   "terminal.ansiWhite":"#E5E5E5",
                   "terminal.ansiYellow":"#E5E510",
                   "terminal.background":"#050505",
                   "terminal.border":"#808080",
                   "terminal.foreground":"#CCCCCC",
                   "terminal.selectionBackground":"#FFFFFF",
                   "terminalCursor.background":"#2C2C30",
                   "terminalCursor.foreground":"#D7D7DB",
                   "textBlockQuote.background":"#7F7F7F21",
                   "textBlockQuote.border":"#007ACC",
                   "textCodeBlock.background":"#0A0A0A",
                   "textLink.activeForeground":"#9C27B0",
                   "textLink.foreground":"#3DA2D6",
                   "textPreformat.foreground":"#D7BA7D",
                   "textSeparator.foreground":"#3F3B3B",
                   "titleBar.activeBackground":"#222224",
                   "titleBar.activeForeground":"#BEBEBE",
                   "titleBar.border":"#007ACC",
                   "titleBar.inactiveBackground":"#222224",
                   "titleBar.inactiveForeground":"#BEBEBE",
                   "tree.indentGuidesStroke":"#585858",
                   "walkThrough.embeddedEditorBackground":"#2C2C30",
                   "welcomePage.background":"#333338",
                   "welcomePage.buttonBackground":"#2C2C30",
                   "welcomePage.buttonHoverBackground":"#494950",
                   "widget.shadow":"#0000004d",
                   "window.activeBorder":"#222225",
                   "window.inactiveBorder":"#222225",
                   "activityBar.dropBorder":"#AFAFB6",
                   "editorGroupHeader.border":"#3D3D42",
                   "searchEditor.findMatchBorder":"#3D3D42",
                   "statusBar.debuggingBackground":"#2C2C30",
                   "statusBar.debuggingBorder":"#3D3D42",
                   "editorOverviewRuler.background":"#1E1E1E"
                }
             }
          ],
          "currentTheme":"Default DarkX1"
       }
    }
}

//  Get the original profile, so that we can put it back
ws.sendAndValidate({
    "request_id": ws.generateRequestId(),
    "request":"execute",
    "command":"gui.users.get_profile",
    "args":{
       "profile_id": 1
    }
 }, [
    {
        "request_state": {
            "type": "OK",
            "msg": ws.ignore
        },
        "result": ws.ignore,
        "request_id": ws.lastGeneratedRequestId
    }
])

var originalProfile = ws.lastResponse["result"]
ws.sendAndValidate({
    "request_id": ws.generateRequestId(),
    "request":"execute",
    "command":"gui.users.update_profile",
    "args":{
        "profile": profile
    }
 }, [
     {
         "request_state": {
             "type": "OK",
             "msg": ws.ignore
            },
            "result": {
                "id": 1
            },
            "request_id": ws.lastGeneratedRequestId
        }
])

ws.sendAndValidate({
    "request_id": ws.generateRequestId(),
    "request":"execute",
    "command":"gui.users.get_profile",
    "args":{
       "profile_id": 1
    }
 }, [
    {
        "request_state": {
            "type": "OK",
            "msg": ws.ignore
        },
        "result": profile,
        "request_id": ws.lastGeneratedRequestId
    }
])


ws.sendAndValidate({
    "request_id": ws.generateRequestId(),
    "request":"execute",
    "command":"gui.users.update_profile",
    "args":{
        "profile": originalProfile
    }
 }, [
     {
         "request_state": {
             "type": "OK",
             "msg": ws.ignore
            },
            "result": {
                "id": 1
            },
            "request_id": ws.lastGeneratedRequestId
        }
])

ws.sendAndValidate({
    "request_id": ws.generateRequestId(),
    "request":"execute",
    "command":"gui.users.get_profile",
    "args":{
       "profile_id": 1
    }
 }, [
    {
        "request_state": {
            "type": "OK",
            "msg": ws.ignore
        },
        "result": originalProfile,
        "request_id": ws.lastGeneratedRequestId
    }
])
