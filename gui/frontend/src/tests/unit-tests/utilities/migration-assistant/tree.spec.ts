/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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

import { describe, expect, it } from "vitest";

import { buildTree, type ITreeFlatNode, type ITreeNode } from "../../../../components/ui/TreeDropdownSelector/tree.js";

interface TestNode extends ITreeFlatNode {
    label: string;
}

const ids = <T extends ITreeFlatNode>(nodes: Array<ITreeNode<T>>): string[] => {
    return nodes.map((n) => {
        return n.id;
    });
};

describe("Migration Assistant: tree utilities", () => {
    describe("buildTree", () => {
        it("returns empty array for empty input", () => {
            expect(buildTree<TestNode>([])).toEqual([]);
        });

        it("creates a single root node when parent is undefined", () => {
            const flat: TestNode[] = [{ id: "a", label: "A" }];
            const tree = buildTree(flat);

            expect(tree).toHaveLength(1);
            expect(tree[0]).toMatchObject({ id: "a", label: "A" });
            expect(tree[0].children).toEqual([]);
        });

        it("creates a single root node when parent is null", () => {
            const flat: TestNode[] = [{ id: "a", parent: null, label: "A" }];
            const tree = buildTree(flat);

            expect(tree).toHaveLength(1);
            expect(tree[0]).toMatchObject({ id: "a", parent: null, label: "A" });
            expect(tree[0].children).toEqual([]);
        });

        it("treats nodes with missing parent as roots", () => {
            const flat: TestNode[] = [
                { id: "a", parent: "missing", label: "A" },
                { id: "b", parent: undefined, label: "B" },
            ];
            const tree = buildTree(flat);

            expect(ids(tree)).toEqual(["a", "b"]);
        });

        it("builds a nested structure and preserves child order based on flat iteration", () => {
            const flat: TestNode[] = [
                { id: "root", parent: null, label: "Root" },
                { id: "c1", parent: "root", label: "Child1" },
                { id: "c2", parent: "root", label: "Child2" },
                { id: "gc", parent: "c1", label: "GrandChild" },
            ];

            const tree = buildTree(flat);
            expect(ids(tree)).toEqual(["root"]);
            expect(ids(tree[0].children)).toEqual(["c1", "c2"]);
            expect(ids(tree[0].children[0].children)).toEqual(["gc"]);
        });

        it("does not mutate the original flat nodes", () => {
            const flat: TestNode[] = [
                { id: "root", parent: null, label: "Root" },
                { id: "child", parent: "root", label: "Child" },
            ];

            const before = structuredClone(flat);
            buildTree(flat);
            expect(flat).toEqual(before);
            // Ensure `buildTree` adds `children` only to its cloned output nodes.
            expect("children" in flat[0]).toBe(false);
            expect("children" in flat[1]).toBe(false);
        });
    });
});
