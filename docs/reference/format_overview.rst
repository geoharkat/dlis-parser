RP66 V1 / DLIS Format Overview
==============================

This page provides a concise technical overview of the RP66 Version 1 binary
format (also called DLIS — Digital Log Interchange Standard) to help users
understand what the parser reads and why.

File structure
--------------

A ``.dlis`` file is organised in three nested layers:

::

  ┌──────────────────────────────────────────────────┐
  │  Storage Unit Label (SUL)  — 80 bytes, ASCII     │
  ├──────────────────────────────────────────────────┤
  │  Visible Record (VR)                             │
  │    ├─ VR header (4 B): length + 0xFF 0x01        │
  │    └─ Logical Record Segments (LRS) ...          │
  │         ├─ LRS header (4 B): length + attr + type│
  │         └─ LRS body                              │
  ├──────────────────────────────────────────────────┤
  │  Visible Record ...                              │
  └──────────────────────────────────────────────────┘

Storage Unit Label (SUL)
^^^^^^^^^^^^^^^^^^^^^^^^

The first 80 bytes of the file form a fixed-width ASCII header containing the
RP66 version (always ``V1.00``), the storage structure (always ``RECORD``), the
maximum Visible Record length, and a free-form storage set identifier.

Visible Records (VR)
^^^^^^^^^^^^^^^^^^^^

After the SUL, the file is divided into Visible Records.  Each VR starts with
a 4-byte header:

* **Bytes 0-1**: VR length (includes the 4-byte header itself)
* **Byte 2**: version marker — always ``0xFF``
* **Byte 3**: VR version type — ``0x01`` (standard) or ``0x00`` (Schlumberger)

Logical Record Segments (LRS)
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Each VR body contains one or more LRS segments packed end-to-end.  The 4-byte
LRS header contains:

* **Bytes 0-1**: LRS length (includes the 4-byte header)
* **Byte 2**: attributes byte

  .. list-table::
     :header-rows: 1
     :widths: 10 15 75

     * - Bit
       - Mask
       - Meaning
     * - 7
       - ``0x80``
       - 1 = EFLR, 0 = IFLR
     * - 6
       - ``0x40``
       - 1 = has predecessor (not the first segment of this LR)
     * - 5
       - ``0x20``
       - 1 = has successor (not the last segment of this LR)
     * - 2
       - ``0x04``
       - Has checksum (2 bytes appended before trailing length)
     * - 1
       - ``0x02``
       - Has trailing length (2 bytes appended at end)
     * - 0
       - ``0x01``
       - Has padding (N pad bytes; last byte gives count)

* **Byte 3**: LRS type (0 = FILE-HEADER, 1 = ORIGIN, 3 = CHANNEL, 4 = FRAME,
  0x00 for FDATA IFLRs, etc.)

Long logical records can be split across multiple LRS segments (and VR
boundaries).  The parser assembles all segments into a single contiguous body
before processing.

Logical Records
---------------

EFLR — Explicitly Formatted Logical Record
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

EFLRs carry structured metadata.  Each EFLR is a *SET* of *objects*, where
every object has the same attribute schema (the *template*).  The SET
descriptor declares the set type (e.g. ``"CHANNEL"``), the template defines
attribute labels and default values, and each object provides its own
attribute values.

The EFLR types parsed by this library:

============= =========================================================
Type          Contents
============= =========================================================
FILE-HEADER   File sequence number and ID
ORIGIN        Well, field, company, and acquisition metadata
CHANNEL       Channel mnemonic, units, representation code, dimension
FRAME         Frame channel list, index type, direction, spacing
PARAMETER     Scalar well parameters (KB, TD, BHT, bit size, …)
EQUIPMENT     Tool string equipment items
TOOL          Tool descriptions
CALIBRATION   Calibration coefficients and references
COMPUTATION   Derived computation definitions
COMMENT       Free-text comments
============= =========================================================

IFLR — Implicitly Formatted Logical Record
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

IFLRs carry the actual curve data (FDATA).  Each FDATA record references a
frame OBNAME, then stores rows of samples packed in the order and with the
representation codes declared by the CHANNEL EFLR.

Each row starts with a UVARI **frame number** (1-based), followed by one value
per channel element (scalars contribute 1 value; an ``N``-element array
contributes ``N`` values packed consecutively).

OBNAME — Object Name
---------------------

Every object in an EFLR, and every FDATA record, is identified by an **OBNAME
triplet**:

* **origin** (UVARI): links the object to the ORIGIN that created it
* **copy** (USHORT/u8): distinguishes multiple copies of the same name
* **name** (IDENT): the human-readable identifier

The library represents OBNAME keys as ``"origin/copy/name"`` strings, which
are used as the keys of the ``channels`` and ``frames`` Maps.
