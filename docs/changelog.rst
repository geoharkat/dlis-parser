Changelog
=========

v1.0.4 (2025-05-10)
--------------------

**Bug fixes**

* **Corrected the RP66 V1 representation code table** (critical fix).
  The numeric values for codes 8–27 were each off by 2 because ``FDOUB1``
  (code 8) and ``FDOUB2`` (code 9) were missing, shifting every subsequent
  code.  Affected codes before this release:

  ============ ========= =========
  Mnemonic     Old code  Correct
  ============ ========= =========
  ``CSINGL``   8         10
  ``CDOUBL``   9         11
  ``SSHORT``   10        12
  ``SNORM``    11        13
  ``SLONG``    12        14
  ``USHORT``   13        15
  ``UNORM``    14        16
  ``ULONG``    15        17
  ``UVARI``    16        18
  ``IDENT``    17        19
  ``ASCII``    18        20
  ``DTIME``    19        21
  ``ORIGIN``   20        22
  ``OBNAME``   21        23
  ``OBJREF``   22        24
  ``ATTREF``   23        25
  ``STATUS``   24        26
  ``UNITS``    25        27
  ============ ========= =========

  Practical impact: files using ``SNORM`` (code 13) channels — such as
  acoustic/CBL waveforms with 16-bit signed samples — were decoded at half
  the correct byte width, causing misalignment for all channels that follow.

* **Added ``FDOUB1`` (code 8) and ``FDOUB2`` (code 9)** to the RC table and
  ``BinaryReader.val()`` dispatcher.

* **``asciiStr()`` safety fallback** — when a 4-byte ASCII length prefix
  encodes an unreasonably large value (> 65 536) the reader automatically
  retries with 1-byte IDENT encoding.  This handles a known Baker Hughes
  Atlas pattern where LONG-NAME attributes are written with ASCII repcodes
  but IDENT-encoded data.

* **PARAMETER fallback for well metadata** — when the ORIGIN EFLR cannot be
  decoded (a Baker Hughes Atlas encoding quirk), the library now extracts well
  metadata from the PARAMETER EFLR using the standard mnemonics ``WN``,
  ``FN``, ``CN``, ``WI``, ``RUN``, and ``SON``.

* **TypeScript declarations updated** to reflect the corrected RC numeric
  values.

v1.0.3 (2025-04-28)
--------------------

* Dual-scan ``scanChannelOBNAMEs`` — fallback OBNAME scanner now tries both
  the standard 2-byte copy encoding and the Baker Hughes 1-byte copy variant,
  returning whichever scan yields the longer channel list.
* ``showMeta()`` overhaul in the companion viewer: all ORIGIN fields, all
  PARAMETER values, and miscellaneous EFLRs (EQUIPMENT, TOOL, CALIBRATION,
  COMMENT) are now displayed.
* ``buildTree()`` always shows the WELL INFO section, PARAMETERS section, and
  OTHER EFLRs section regardless of whether data is present.
* Baker Hughes ORIGIN selection prefers objects that carry actual well data
  over empty-name header objects.

v1.0.2
------

* Baker Hughes ATLAS ``ABSATR`` extension: consume extra bytes that some
  ATLAS encoders write on absent-attribute descriptors.
* Baker Hughes FRAME EFLR carry-forward: channel list from the empty-name
  header object is inherited by the subsequent named FRAME object.
* Schlumberger VR version byte ``0x00`` accepted alongside standard ``0x01``.

v1.0.1
------

* Frame key reconciliation: name-suffix matching and single-unmatched-pair
  fallback for files where the FDATA IFLR OBNAME does not exactly match the
  FRAME EFLR OBNAME.
* Multi-dimensional channel dimension handling (``dim.reduce`` product).

v1.0.0
------

* Initial release: full RP66 V1 / DLIS parsing, FDATA decoding, CSV and
  LAS 2.0 export, TypeScript declarations.
