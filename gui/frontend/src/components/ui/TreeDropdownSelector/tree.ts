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

/**
 * A minimal "flat" node that can be transformed into a nested tree structure.
 */
export interface ITreeFlatNode {
    id: string;
    parent?: string | null;
}

/**
 * A nested tree node.
 */
export type ITreeNode<T extends ITreeFlatNode> = T & { children: Array<ITreeNode<T>> };

/**
 * Builds a nested tree from a flat list.
 *
 * @param flat - The input list of nodes in parent-before/after-any-order form. Each node may reference its parent
 * via `parent`. If `parent` is `null`/`undefined` or points to a missing node, the node will be treated as a root.
 * @returns The root nodes of the generated tree. Each returned node is a shallow clone of the corresponding `flat`
 * item, augmented with a `children` array.
 *
 * Notes:
 * - If `parent` is `null`/`undefined` or points to a missing node, the item becomes a root.
 * - Children are attached in the original `flat` iteration order.
 */
export const buildTree = <T extends ITreeFlatNode>(flat: T[]): Array<ITreeNode<T>> => {
    const nodes: Record<string, ITreeNode<T>> = {};

    for (const item of flat) {
        nodes[item.id] = { ...item, children: [] };
    }

    const tree: Array<ITreeNode<T>> = [];
    for (const item of flat) {
        const parentId = item.parent;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (parentId != null && nodes[parentId] !== undefined) {
            nodes[parentId].children.push(nodes[item.id]);
        } else {
            tree.push(nodes[item.id]);
        }
    }

    return tree;
};
