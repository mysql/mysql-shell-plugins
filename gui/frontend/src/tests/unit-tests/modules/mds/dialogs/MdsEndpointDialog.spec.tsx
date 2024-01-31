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

import { mount } from "enzyme";
import { MdsEndpointDialog } from "../../../../../modules/mds/dialogs/MdsEndpointDialog.js";
import { DialogResponseClosure, MdsDialogType } from "../../../../../app-logic/Types.js";
import { IDialogValues } from "../../../../../components/Dialogs/ValueEditDialog.js";
import { DialogHelper, nextProcessTick, sendKeyPress } from "../../../test-helpers.js";
import { KeyboardKeys, sleep } from "../../../../../utilities/helpers.js";

describe("MdsEndpointDialog show tests", () => {
  let dialogHelper: DialogHelper;

  beforeAll(() => {
    dialogHelper = new DialogHelper("mdsEndpointDialog");
  });

  it("Test render MdsEndpointDialog", () => {
    const component = mount<MdsEndpointDialog>(
      <MdsEndpointDialog
        onClose={jest.fn()}
      />,
    );
    expect(component).toMatchSnapshot();
  });


  it("Test close dialog by clicking Ok button", async () => {
    const onCloseMock = jest.fn((closure: DialogResponseClosure, dialogValues: IDialogValues, data?: IDictionary): void => {
        // no-op
    });

    const component = mount<MdsEndpointDialog>(
      <MdsEndpointDialog
        onClose={onCloseMock}
      />,
    );

    let portals = document.getElementsByClassName("portal");
    expect(portals.length).toBe(0);

    const promise = component.instance().show(
      {
        id: "test-id",
        type: MdsDialogType.MdsEndpoint,
        parameters: {
          shapes: ["Test Shape"],
        },
        values: {
          shapeName: ["Test Shape"],
          instanceName: "Test Instance",
          cpuCount: 4,
          memorySize: 8,
          mysqlUserName: "testuser",
          mysqlUserPassword: "testpassword",
          createDbConnection: true,
          portForwarding: true,
          sslCertificate: true,
          publicIp: true,
          mrs: true
        },
      },
      "Test Title"
    );
    await nextProcessTick();
    await sleep(500);

    portals = document.getElementsByClassName("portal");
    expect(portals.length).toBe(1);

    await dialogHelper.setInputText("domainName", "oracle.com")
    await dialogHelper.clickOk();

    await promise;

    expect(onCloseMock).toHaveBeenCalledTimes(1);
    expect(onCloseMock).toHaveBeenCalledWith(DialogResponseClosure.Accept, {
      "cpuCount": 4,
      "createDbConnection": true,
      "domainName": "oracle.com",
      "instanceName": "Test Instance",
      "jwtSecret": "",
      "memorySize": 8,
      "mrs": true,
      "mysqlUserName": "testuser",
      "mysqlUserPassword": "testpassword",
      "portForwarding": true,
      "publicIp": true,
      "shapeName": "Test Shape",
      "sslCertificate": true,
    });

    portals = document.getElementsByClassName("portal");
    expect(portals.length).toBe(0);
  });

  it("Test close dialog by clicking Cancel button", async () => {
    const onCloseMock = jest.fn((closure: DialogResponseClosure, dialogValues: IDialogValues, data?: IDictionary): void => {
      // no-op
    });

    const component = mount<MdsEndpointDialog>(
      <MdsEndpointDialog
        onClose={onCloseMock}
      />,
    );

    const instanceName = "Test Instance";
    const shapeName = "Test Shape";
    const cpuCount = 4;
    const memorySize = 8;
    const mysqlUserName = "testuser";
    const mysqlUserPassword = "testpassword";
    const createDbConnection = true;

    let portals = document.getElementsByClassName("portal");
    expect(portals.length).toBe(0);

    const promise = component.instance().show(
      {
        id: "test-id",
        type: MdsDialogType.MdsEndpoint,
        parameters: {
          shapes: [shapeName],
        },
        values: {
          instanceName,
          shapeName,
          cpuCount,
          memorySize,
          mysqlUserName,
          mysqlUserPassword,
          createDbConnection,
        },
      },
      "Test Title"
    );
    await nextProcessTick();
    await sleep(500);

    portals = document.getElementsByClassName("portal");
    expect(portals.length).toBe(1);

    await dialogHelper.clickCancel();

    await promise;

    expect(onCloseMock).toHaveBeenCalledTimes(1);
    expect(onCloseMock).toHaveBeenCalledWith(DialogResponseClosure.Decline);

    portals = document.getElementsByClassName("portal");
    expect(portals.length).toBe(0);
  });

  it("Test close dialog with Decline closure", async () => {
    const onCloseMock = jest.fn((closure: DialogResponseClosure, dialogValues: IDialogValues, data?: IDictionary): void => {
      // no-op
    });

    const component = mount<MdsEndpointDialog>(
      <MdsEndpointDialog
        onClose={onCloseMock}
      />,
    );

    const instanceName = "Test Instance";
    const shapeName = "Test Shape";
    const cpuCount = 4;
    const memorySize = 8;
    const mysqlUserName = "testuser";
    const mysqlUserPassword = "testpassword";
    const createDbConnection = true;

    let portals = document.getElementsByClassName("portal");
    expect(portals.length).toBe(0);

    const promise = component.instance().show(
      {
        id: "test-id",
        type: MdsDialogType.MdsEndpoint,
        parameters: {
          shapes: [shapeName],
        },
        values: {
          instanceName,
          shapeName,
          cpuCount,
          memorySize,
          mysqlUserName,
          mysqlUserPassword,
          createDbConnection,
        },
      },
      "Test Title"
    );
    await nextProcessTick();
    await sleep(500);

    portals = document.getElementsByClassName("portal");
    expect(portals.length).toBe(1);

    sendKeyPress(KeyboardKeys.Escape);
    await nextProcessTick();

    await promise;

    expect(onCloseMock).toHaveBeenCalledWith(DialogResponseClosure.Decline);

    portals = document.getElementsByClassName("portal");
    expect(portals.length).toBe(0);
  });
});

describe("MdsEndpointDialog validateInput tests", () => {
  let dialog: MdsEndpointDialog;

  beforeEach(() => {
    dialog = new MdsEndpointDialog();
  });

  it("should return empty messages when closing is false", () => {
    const values: IDialogValues = {
      sections: new Map([
        ["mainSection", { values: { instanceName: { value: "" }, cpuCount: { value: 4 }, memorySize: { value: 8 }, mysqlUserName: { value: "" }, mysqlUserPassword: { value: "" } } }],
        ["featuresSection", { values: { portForwarding: { value: false }, mrs: { value: false } } }]
      ])
    };

    const result = dialog.validateInput(false, values);

    expect(result.messages).toEqual({});
  });

  it("should return validation messages when closing is true and required fields are missing", () => {
    const values: IDialogValues = {
      sections: new Map([
        ["mainSection", { values: { instanceName: "", cpuCount: { value: -1 }, memorySize: { value: -1 }, mysqlUserName: { value: "" }, mysqlUserPassword: { value: "" }, sslCertificate: { value: true }, domainName: { value: "" }, publicIp: { value: "" }, createDbConnection: { value: true } } }],
        ["featuresSection", { values: { portForwarding: { value: false }, mrs: { value: false } } }]
      ])
    };

    const result = dialog.validateInput(true, values);

    expect(result.messages).toEqual({
      instanceName: "The instance name must be specified.",
      memorySize: "The memory size must be between 1 and 1024 GB.",
      cpuCount: "The number of CPUs must be between 1 and 512.",
      mysqlUserName: "The MySQL user name must be specified.",
      mysqlUserPassword: "The MySQL password must be specified.",
      portForwarding: "At least one feature needs to be selected.",
      sslCertificate: "A domain name needs to be assigned.",
      domainName: "A valid domain name needs at least one dot.",
      createDbConnection: "The Port Forwarding feature needs to be enabled."
    });
  });

  it("should return empty messages when closing is true and all required fields are provided", () => {
    const values: IDialogValues = {
      sections: new Map([
        ["mainSection", { values: { instanceName: { value: "Test Instance" }, cpuCount: { value: 4 }, memorySize: { value: 8 }, mysqlUserName: { value: "testuser" }, mysqlUserPassword: { value: "testpassword" }, sslCertificate: { value: "" }, domainName: { value: "example.com" }, publicIp: { value: "192.168.0.1" }, createDbConnection: { value: true } } }],
        ["featuresSection", { values: { portForwarding: { value: true }, mrs: { value: true } } }]
      ])
    };

    const result = dialog.validateInput(true, values);

    expect(result.messages).toEqual({});
  });
});