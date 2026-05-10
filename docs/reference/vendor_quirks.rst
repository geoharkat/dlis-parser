Vendor Quirks
=============

RP66 V1 is a flexible specification and different acquisition vendors
implement it with varying degrees of conformance.  This library detects and
handles several known non-standard patterns automatically.

Baker Hughes ATLAS
------------------

Baker Hughes ATLAS-family tools produce DLIS files with five documented
deviations from the RP66 V1 specification.

1. 1-byte OBNAME copy field
^^^^^^^^^^^^^^^^^^^^^^^^^^^

**Spec**: OBNAME copy is USHORT — 2 bytes, big-endian.

**Baker Hughes**: copy is encoded as a single unsigned byte (u8).

The library auto-detects which encoding is in use by attempting both and
selecting the one that produces a valid printable ASCII name.  This applies
to both ``BinaryReader.obname()`` and the ``scanChannelOBNAMEs`` fallback
scanner.

2. ASCII repcode with IDENT-encoded data
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

**Spec**: LONG-NAME and similar string attributes with repcode 20 (ASCII)
should be stored with a 4-byte length prefix.

**Baker Hughes**: repcode 20 is written in the EFLR template but the value
is stored with a 1-byte length prefix (IDENT encoding).

The library's ``asciiStr()`` reader detects this by checking whether the
4-byte prefix produces a plausible string length.  If the inferred length
exceeds 65 536 bytes or would read past the end of the record, it falls back
to ``ident()`` automatically.

3. CHANNELS attribute on empty-name frame object
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

**Spec**: Each FRAME object carries its own CHANNELS attribute listing the
channels it records.

**Baker Hughes**: The channel list is placed on a leading *empty-name* FRAME
object (``name = ""``), and the named FRAME objects that correspond to actual
FDATA records carry no CHANNELS attribute of their own.

The parser tracks these "header" objects and carries their channel list
forward to the next named FRAME object automatically (``inheritedRefs``
logic in ``processFrames``).

4. ORIGIN EFLR not parseable
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

**Baker Hughes** ORIGIN EFLRs use a non-standard ``DEFINING_ORIGIN``
encoding that causes standard parsers (including dlisio) to fail with an
argument-type error.

As a fallback, the library reads well metadata from the PARAMETER EFLR
using the standard RP66 V1 parameter mnemonics:

==== ===========================
WN   Well name
FN   Field name
CN   Operating company
WI   Well identifier (UWI/API)
RUN  Logging run number
SON  Service company / producer
==== ===========================

5. SNORM (RC 13) waveform channels
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Baker Hughes CBL/VDL channels (and similar acoustic waveforms) use
representation code 13 (``SNORM`` — signed 16-bit integer, 2 bytes per
sample) for multi-sample array channels.

Prior to v1.0.4, the library had an incorrect RC table that mapped code 13
to ``USHORT`` (1 byte), causing waveform channels to read only half the bytes
they should.  This is fixed in v1.0.4 with the corrected RP66 V1 code table.

Schlumberger
------------

1. VR version byte variant
^^^^^^^^^^^^^^^^^^^^^^^^^^^

**Spec**: The VR header version field is ``0xFF 0x01``.

**Schlumberger**: Some tools write ``0xFF 0x00`` (type byte = 0x00 instead
of 0x01).  The parser accepts both.

2. Multiple channel copies
^^^^^^^^^^^^^^^^^^^^^^^^^^^

Schlumberger multi-pass files use the OBNAME *copy* number to distinguish the
same channel name recorded in different frames.  For example ``TDEP`` may
appear as ``1/0/TDEP``, ``1/1/TDEP``, and ``1/2/TDEP``.

Each copy is registered as a separate entry in the ``channels`` Map.  The
FRAME EFLR for each pass references the correct copy via its OBNAME, so
``frame.channels`` always resolves to the right copy.

Frame key reconciliation
-------------------------

FDATA IFLR records identify their frame by OBNAME.  On some vendor files the
OBNAME written in FDATA differs from the OBNAME in the FRAME EFLR (origin or
copy mismatch).  The parser applies a two-step reconciliation:

1. **Name-suffix match**: If no exact key match is found, try matching only
   the ``name`` component.
2. **Single-unmatched-pair fallback**: If exactly one unmatched FDATA key and
   one unmatched FRAME key remain, pair them.

A ``warnings`` entry is emitted for each reconciled pair so you can inspect
the mismatch.
