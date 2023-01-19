# Copyright (c) 2021, 2023, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is also distributed with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have included with MySQL.
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
from enum import IntEnum
import ctypes
import struct
import gui_plugin.core.Logger as logger

WEBSOCKET_CLOSED_BY_CLIENT = 963


class Error(Exception):
    pass


class Word0Bits(ctypes.BigEndianStructure):
    _fields_ = [
        ("final_fragment", ctypes.c_uint16, 1),
        ("reserved", ctypes.c_uint16, 3),
        ("opcode", ctypes.c_uint16, 4),
        ("masked", ctypes.c_uint16, 1),
        ("payload", ctypes.c_uint16, 7)
    ]


class Word0(ctypes.Union):
    _fields_ = [("bits", Word0Bits),
                ("bytes", ctypes.c_uint16)]


class Operation(IntEnum):
    ContinuationFrame = 0x0
    TextFrame = 0x1
    BinaryFrame = 0x2
    Close = 0x8
    Ping = 0x9
    Pong = 0xa


class Frame:
    def __init__(self):
        self.word0 = Word0()
        self.mask_key = ""
        self.message = ""
        self.length = 0

    @property
    def opcode(self):
        return Operation(self.word0.bits.opcode)

    @property
    def is_initial_fragment(self):
        return self.opcode in (Operation.BinaryFrame, Operation.TextFrame)

    @property
    def is_final_fragment(self):
        return self.word0.bits.final_fragment

    @property
    def is_control_message(self):
        return self.opcode in (Operation.Close, Operation.Ping, Operation.Pong)

    def __str__(self):
        return f"<WebSocket.Frame>\n\tOpcode: {Operation(self.opcode)}\n\tFinal: {self.is_final_fragment}\n\tlength: {self.length}\n\tmessage: {self.message}"


class FrameReceiver(Frame):
    def __init__(self, buffer=None):
        super().__init__()
        if buffer:
            self.receive(buffer)

    def receive(self, buffer):
        try:
            self.word0.bytes = struct.unpack("<H", buffer.read(2))[0]

            if self.word0.bits.payload == 126:
                self.length = struct.unpack(">H", buffer.read(2))[0]
            elif self.word0.bits.payload == 127:
                self.length = struct.unpack(">q", buffer.read(8))[0]
            else:
                self.length = self.word0.bits.payload
        except struct.error as e:  # pragma: no cover
            raise Error(f"Websocket read aborted while listening. {e}")

        # incomming frames must always be masked
        self.mask_key = buffer.read(4)

        self.encoded_message = buffer.read(self.length)

        # do some validations after consuming all the bytes form the buffer
        if not self.word0.bits.masked:
            raise Error("Frame not masked")

        if self.is_control_message:
            if self.word0.bits.payload > 125:
                raise Error("Invalid payload for control frame")
            if not self.word0.bits.final_fragment:
                raise Error("Control frames must have the final bit set")

        if self.length < 0:
            raise Error("Invalid payload length")

        # decode the message using the masking key
        self.message = ""

        if self.is_control_message:
            for index in range(self.length):
                self.message += chr(self.encoded_message[index]
                                    ^ self.mask_key[index % 4])
        else:
            # Unmasks the received buffer
            unmasked = bytearray(b'')
            for index in range(self.length):
                unmasked.append(
                    self.encoded_message[index] ^ self.mask_key[index % 4])

            self.message = unmasked.decode("utf-8")

        if self.word0.bits.opcode == Operation.Close:
            if len(self.message) > 0:
                self.error = struct.unpack(">H", self.message.encode()[:2])[0]
                self.message = self.message[2:]
                if self.error != WEBSOCKET_CLOSED_BY_CLIENT:
                    logger.error(
                        f"WebSocket closed by peer: Error[{self.error}]: {self.message}")


class FrameSender(Frame):
    def __init__(self, opcode, message="", final=True, buffer=None):
        super().__init__()
        self.word0.bits.final_fragment = final
        self.word0.bits.opcode = opcode
        self.message = message

        length = len(self.message)
        if length <= 125:
            self.word0.bits.payload = length
        elif length >= 126 and length <= 65535:
            self.word0.bits.payload = 126
        else:
            self.word0.bits.payload = 127

        if buffer:
            self.send(buffer)

    def send(self, buffer):
        # put everything in a buffer, so that we can debug it.
        # if we keep sending small pieces, the frontend will perceive it
        # as protocol errors.
        frame_data = bytes()
        frame_data += struct.pack("<H", self.word0.bytes)
        length = len(self.message)

        try:
            if self.word0.bits.payload == 126:
                frame_data += struct.pack(">H", length)
            elif self.word0.bits.payload == 127:
                frame_data += struct.pack(">Q", length)

            if length > 0:
                frame_data += self.message.encode()

            buffer.send(frame_data)
        except Exception as err:  # pragma: no cover
            if self.opcode == Operation.Close:
                return
            else:
                raise Error(f"WebSocket failed to send a frame: {err}.")


class Packet:
    def __init__(self, message=""):
        self.frames = []

        # We can split the message
        # in several frames to optimize the communication.
        while len(message) > 0:
            fragment = message[:5000]
            message = message[5000:]
            self.append_text_message(fragment)

    def append(self, frame):
        # Validate type using the opcode
        self._validate_frame(frame)
        self.frames.append(frame)

    def _validate_frame(self, frame):
        if len(self.frames) == 0:
            return
        if self.frames[0].is_control_message:
            raise Exception("Frame can not be fragment of a control message")
        if not frame.opcode == Operation.ContinuationFrame:
            raise Exception("This is not a continuation frame")

    def append_text_message(self, message):
        if len(self.frames) == 0:
            self.frames.append(FrameSender(Operation.TextFrame, message))
        else:
            self.frames[len(self.frames) - 1].word0.bits.final_fragment = False
            self.frames.append(FrameSender(
                Operation.ContinuationFrame, message))

    @property
    def message(self):
        result = ""
        for frame in self.frames:
            result += frame.message
        return result

    def done(self):
        return self.frames[len(self.frames) - 1].is_final_fragment

    def send(self, buffer):
        for frame in self.frames:
            frame.send(buffer)
