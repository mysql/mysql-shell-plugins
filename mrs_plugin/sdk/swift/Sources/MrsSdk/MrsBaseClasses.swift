/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

import Foundation

public class MrsBaseService {
    public init(baseUrl: String) {

    }
}

public class MrsBaseSchema {
    public var service: MrsBaseService?

    public init(requestPath: String) {

    }
}

public class MrsBaseObject {
    public var schema: MrsBaseSchema?

    public init(requestPath: String) {

    }
}

open class MrsDocument: Codable {
    public func getPrimaryKeyName() -> String? {
        return nil
    }
}

public protocol Creatable {
    associatedtype NewDocumentType where NewDocumentType : Encodable
    associatedtype DocumentType where DocumentType : MrsDocument

    // create(data: ...) and createMany(data: [...])
}

public protocol UniquelyReadable {
    associatedtype UniqueFilterType

    // findUnique(...) and findUniqueOrThrow(...)
}

public protocol Readable {
    associatedtype FilterType

    // findFirst(...), findFirstOrThrow(...), findMany(...) and findAll(...)
}

public protocol Updatable {
    associatedtype DocumentType : MrsDocument

    // update(...) and updateMany(...)
}

public protocol SelfUpdatable {
    // update()
}

public protocol UniquelyDeletable {
    associatedtype UniqueFilterType

    // delete(where: ...)
}

public protocol Deletable {
    associatedtype FilterType

    // deleteMany(where: ...)
}

public protocol SelfDeletable {
    // delete()
}
