/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 */

import type { ComponentChild } from "preact";

import { Codicon } from "../../components/ui/Codicon.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import type { IMebValidationStatus } from "../../supplement/ShellInterface/ShellInterfaceMeb.js";

export interface IEnterpriseBackupValidationStatusProps {
    children?: ComponentChild;
    status: IMebValidationStatus;
}

export const EnterpriseBackupValidationStatus = (
    { children, status }: IEnterpriseBackupValidationStatusProps,
): ComponentChild => {
    const icon = status.tone === "ok"
        ? Codicon.PassFilled
        : status.tone === "warn" ? Codicon.Warning : Codicon.Info;

    return <div className={`enterpriseBackupValidation ${status.tone}`}>
        <Icon src={icon} />
        <span>{children ?? status.message}</span>
    </div>;
};
