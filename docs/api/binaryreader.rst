BinaryReader (advanced)
=======================

``BinaryReader`` is the low-level byte-stream reader used internally by the
parser.  It is exported for advanced use cases such as building custom EFLR
processors or inspecting raw record bodies.

.. code-block:: javascript

   import { BinaryReader } from '@geoharkat/dlis-parser';

   const r = new BinaryReader(myUint8Array);
   const origin = r.uvari();
   const name   = r.ident();

Constructor
-----------

.. js:function:: new BinaryReader(source[, start[, end]])

   :param ArrayBuffer|Uint8Array source: The raw byte data to read from.
   :param number start: Byte offset to begin reading at (default ``0``).
   :param number end: Exclusive end offset (default: length of ``source``).

Position
--------

.. js:attribute:: BinaryReader.pos

   Current read position relative to ``start``.  Writable — you can seek by
   assigning a new value.

   :type: number

.. js:attribute:: BinaryReader.rem

   Remaining bytes from the current position to ``end``.

   :type: number

.. js:function:: BinaryReader.eof()

   :returns: ``true`` when the read position has reached ``end``.
   :rtype: boolean

.. js:function:: BinaryReader.peek()

   Return the next byte without advancing the position, or ``-1`` at EOF.

   :rtype: number

Primitive readers
-----------------

All multi-byte integers and floats are **big-endian** per the RP66 V1
specification.

.. list-table::
   :header-rows: 1
   :widths: 20 15 65

   * - Method
     - Returns
     - Description
   * - ``u8()``
     - number
     - 1-byte unsigned integer
   * - ``u16()``
     - number
     - 2-byte unsigned integer (big-endian)
   * - ``u32()``
     - number
     - 4-byte unsigned integer (big-endian)
   * - ``i8()``
     - number
     - 1-byte signed integer
   * - ``i16()``
     - number
     - 2-byte signed integer (big-endian)
   * - ``i32()``
     - number
     - 4-byte signed integer (big-endian)
   * - ``f32()``
     - number
     - 4-byte IEEE 754 float (big-endian)
   * - ``f64()``
     - number
     - 8-byte IEEE 754 double (big-endian)
   * - ``skip(n)``
     - void
     - Advance position by ``n`` bytes
   * - ``slice(n)``
     - Uint8Array
     - Return zero-copy view of next ``n`` bytes and advance
   * - ``text(n)``
     - string
     - Decode next ``n`` bytes as UTF-8

RP66 V1 structured types
-------------------------

.. js:function:: BinaryReader.fshort()

   Read a 16-bit RP66 short float (not IEEE half-float).

   :rtype: number

.. js:function:: BinaryReader.isingl()

   Read a 4-byte IBM base-16 single-precision float.

   :rtype: number

.. js:function:: BinaryReader.vsingl()

   Read a 4-byte VAX F-float (word-swapped pairs).

   :rtype: number

.. js:function:: BinaryReader.uvari()

   Read a variable-length unsigned integer: 1 byte if ``b0 < 0x80``, 2 bytes
   if ``b0 & 0xC0 == 0x80``, otherwise 4 bytes.

   :rtype: number

.. js:function:: BinaryReader.ident()

   Read a 1-byte length-prefixed ASCII string (max 255 bytes).

   :rtype: string

.. js:function:: BinaryReader.asciiStr()

   Read a 4-byte length-prefixed ASCII string.  Automatically falls back to
   ``ident()`` when the 4-byte length field is unreasonably large (> 65536),
   which handles vendors that write IDENT-encoded strings with ASCII repcodes.

   :rtype: string

.. js:function:: BinaryReader.obname()

   Read an OBNAME triplet ``{ origin, copy, name }``.  Auto-detects the
   standard 2-byte copy field and the Baker Hughes 1-byte variant.

   :rtype: OBName

.. js:function:: BinaryReader.objref()

   Read an OBJREF: ``{ type: string, name: OBName }``.

   :rtype: object

.. js:function:: BinaryReader.dtime()

   Read an 8-byte RP66 V1 date-time value.

   :rtype: Date

.. js:function:: BinaryReader.val(rc)

   Dispatch to the correct reader for representation code ``rc``.  Covers all
   27 RP66 V1 codes.  Throws ``Error`` for unknown codes.

   :param number rc: Representation code (use the :data:`RC` enum).
   :rtype: number | string | boolean | Date | OBName | object
