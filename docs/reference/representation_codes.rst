Representation Codes
====================

RP66 V1 defines 27 **representation codes** that specify how a value is
encoded in the binary stream.  The ``RC`` object exported by the library maps
each mnemonic to its numeric code.

.. code-block:: javascript

   import { RC, RC_SIZE } from '@geoharkat/dlis-parser';

   console.log(RC.FSINGL);   // 2
   console.log(RC.SNORM);    // 13
   console.log(RC_SIZE[RC.FDOUBL]); // 8  (bytes per value)

Complete table
--------------

.. list-table::
   :header-rows: 1
   :widths: 8 14 8 70

   * - Code
     - Mnemonic
     - Bytes
     - Description
   * - 1
     - ``FSHORT``
     - 2
     - RP66 proprietary 16-bit float (not IEEE half-float).
       Exponent in bits 14-11, mantissa in bits 10-0.
   * - 2
     - ``FSINGL``
     - 4
     - IEEE 754 single-precision float (most common scalar type).
   * - 3
     - ``FSING1``
     - 8
     - IEEE single + 4-byte validity/exponent field.
       Only the float is returned; the extra field is skipped.
   * - 4
     - ``FSING2``
     - 12
     - IEEE single + 8-byte lower/upper bounds.
       Only the float is returned.
   * - 5
     - ``ISINGL``
     - 4
     - IBM base-16 single-precision float.
   * - 6
     - ``VSINGL``
     - 4
     - VAX F-float (word-swapped byte pairs).
   * - 7
     - ``FDOUBL``
     - 8
     - IEEE 754 double-precision float (common for depth/time index channels).
   * - 8
     - ``FDOUB1``
     - 12
     - IEEE double + 4-byte exponent field.
   * - 9
     - ``FDOUB2``
     - 16
     - IEEE double + 8-byte bounds.
   * - 10
     - ``CSINGL``
     - 8
     - Complex single: real (4 B) + imaginary (4 B).
       Returned as ``{ re, im }``.
   * - 11
     - ``CDOUBL``
     - 16
     - Complex double: real (8 B) + imaginary (8 B).
       Returned as ``{ re, im }``.
   * - 12
     - ``SSHORT``
     - 1
     - Signed 8-bit integer.
   * - 13
     - ``SNORM``
     - 2
     - Signed 16-bit integer (big-endian).
       Used by waveform/array channels (VDL, sonic, FMI).
   * - 14
     - ``SLONG``
     - 4
     - Signed 32-bit integer (big-endian).
   * - 15
     - ``USHORT``
     - 1
     - Unsigned 8-bit integer.
       Used internally in EFLR templates to store representation codes.
   * - 16
     - ``UNORM``
     - 2
     - Unsigned 16-bit integer (big-endian).
   * - 17
     - ``ULONG``
     - 4
     - Unsigned 32-bit integer (big-endian).
   * - 18
     - ``UVARI``
     - 1–4
     - Variable-length unsigned integer.
       1 byte if value < 128, 2 bytes if < 16384, otherwise 4 bytes.
   * - 19
     - ``IDENT``
     - 1+N
     - Short ASCII string: 1-byte length prefix + N bytes of text.
   * - 20
     - ``ASCII``
     - 4+N
     - Long ASCII string: 4-byte (ULONG) length prefix + N bytes.
   * - 21
     - ``DTIME``
     - 8
     - Date and time: year (1B) + month (1B) + day (1B) + hour (1B) +
       minute (1B) + second (1B) + milliseconds (2B BE).
       Year is offset from 1900.  Parsed into a JavaScript ``Date``.
   * - 22
     - ``ORIGIN``
     - 1–4
     - Origin reference.  Encoded as UVARI.
   * - 23
     - ``OBNAME``
     - variable
     - Object name triplet: UVARI origin + USHORT copy + IDENT name.
   * - 24
     - ``OBJREF``
     - variable
     - Object reference: IDENT type + OBNAME name.
   * - 25
     - ``ATTREF``
     - variable
     - Attribute reference: IDENT label + OBNAME name.
   * - 26
     - ``STATUS``
     - 1
     - Boolean status byte.  Returned as JavaScript ``boolean``.
   * - 27
     - ``UNITS``
     - 1+N
     - Unit expression.  Same encoding as IDENT.

Variable-size codes
-------------------

Codes with variable byte size (``UVARI``, ``IDENT``, ``ASCII``, ``OBNAME``,
``OBJREF``, ``ATTREF``, ``UNITS``) return ``0`` from ``RC_SIZE`` since their
length is not known without reading the data.

.. code-block:: javascript

   import { RC, RC_SIZE } from '@geoharkat/dlis-parser';

   RC_SIZE[RC.SNORM]  // 2
   RC_SIZE[RC.FDOUBL] // 8
   RC_SIZE[RC.IDENT]  // 0  (variable)
   RC_SIZE[RC.UVARI]  // 0  (variable)

Checking a channel's type
--------------------------

.. code-block:: javascript

   import { RC } from '@geoharkat/dlis-parser';

   const ch = lf.getChannel('VDL');

   if (ch.repcode === RC.SNORM) {
     // 16-bit signed waveform — stride = ch.dimension[0] samples per row
     console.log('VDL is a signed-16 waveform,', ch.dimension[0], 'samples/row');
   }

   if (ch.repcode === RC.FSINGL) {
     console.log('Scalar IEEE float channel');
   }
