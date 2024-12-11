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

// import { IStandaloneThemeService } from "monaco-editor/esm/vs/editor/standalone/common/standaloneTheme.js";

declare module "monaco-editor/esm/vs/editor/standalone/browser/standaloneServices.js" {
  export type StandaloneServicesType = {
    get<T>(service: new (...args: unknown[]) => T): T;
    get<T>(service: { identifier: symbol }): T;
  };

  // eslint-disable-next-line @typescript-eslint/naming-convention
  export const StandaloneServices: StandaloneServicesType;
}

declare module "monaco-editor/esm/vs/editor/standalone/common/standaloneTheme.js" {
  import type { IDisposable } from "monaco-editor";

  export interface IStandaloneThemeService {
    registerEditorContainer(domNode: HTMLElement): IDisposable;
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  export const IStandaloneThemeService: {
    identifier: symbol;
    new (): IStandaloneThemeService;
  };
}
