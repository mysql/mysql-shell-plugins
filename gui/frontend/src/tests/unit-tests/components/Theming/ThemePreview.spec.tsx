/*
 * Copyright (c) 2022, 2024, Oracle and/or its affiliates.
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

import { shallow } from "enzyme";

import { ThemePreview } from "../../../../components/Theming/Preview/ThemePreview.js";

describe("ThemePreview testing", () => {

    // Disabled because it runs into max stack depth.
    it("Render test", () => {
        const component = shallow<ThemePreview>(
            <ThemePreview />,
        );

        // The snapshot is huge (1.1MB, 23K lines), so instead we just check for a few elements to be rendered.
        // expect(component).toMatchSnapshot();

        const e = component.find("TagInput");
        expect(e.length).toBe(1);
        expect(e.props().tags).toEqual([
            { id: "tag1", caption: "Einstein" },
            { id: "tag2", caption: "Boole" },
            { id: "tag3", caption: "Aristotle" },
            { id: "tag4", caption: "Archimedes" },
            { id: "tag5", caption: "Newton" },
            { id: "tag6", caption: "Plato" },
            { id: "tag7", caption: "Bohr" },
            { id: "tag8", caption: "Curie" },
            { id: "tag9", caption: "Euclid from Alexandria" }],
        );

        const ed = component.find("CodeEditor");
        expect(ed.length).toBe(1);
        expect(ed.props().font.fontFamily).toBe("var(--msg-monospace-font-family)");
        expect(ed.props().language).toBe("javascript");
    });
});
