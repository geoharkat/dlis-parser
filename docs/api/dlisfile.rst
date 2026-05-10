DLISFile
========

The top-level entry point. Represents one physical ``.dlis`` file on disk,
which may contain one or more :doc:`logical files <logicalfile>`.

.. code-block:: javascript

   import { DLISFile } from '@geoharkat/dlis-parser';

Static methods
--------------

.. js:function:: DLISFile.fromBuffer(buffer)

   Parse a DLIS file from an in-memory ``ArrayBuffer``. Works in both the
   browser and Node.js. **Synchronous.**

   :param ArrayBuffer buffer: Raw file bytes.
   :returns: A fully parsed ``DLISFile`` instance.
   :rtype: DLISFile

   .. code-block:: javascript

      // Browser
      const buf  = await file.arrayBuffer();
      const dlis = DLISFile.fromBuffer(buf);

      // Node.js
      import { readFileSync } from 'fs';
      const buf  = readFileSync('well.dlis').buffer;
      const dlis = DLISFile.fromBuffer(buf);

.. js:function:: DLISFile.fromFile(filePath)

   Parse a DLIS file from the filesystem. **Node.js only** — throws in browser
   environments. **Asynchronous.**

   :param string filePath: Absolute or relative path to the ``.dlis`` file.
   :returns: Promise that resolves to a ``DLISFile``.
   :rtype: Promise<DLISFile>

   .. code-block:: javascript

      const dlis = await DLISFile.fromFile('./data/well.dlis');

Properties
----------

.. js:attribute:: DLISFile.sul

   The **Storage Unit Label** parsed from the first 80 bytes of the file.

   :type: StorageUnitLabel

   .. code-block:: javascript

      console.log(dlis.sul.version);         // "V1.00"
      console.log(dlis.sul.maxRecordLength); // 8192
      console.log(dlis.sul.storageSetId);    // e.g. "Default Storage Set"

   Fields:

   ===================== ======= ==============================================
   Field                 Type    Description
   ===================== ======= ==============================================
   ``sequenceNumber``    string  Storage unit sequence number
   ``version``           string  Always ``"V1.00"`` for RP66 V1
   ``structure``         string  Always ``"RECORD"``
   ``maxRecordLength``   number  Maximum Visible Record length (bytes)
   ``storageSetId``      string  Free-form storage set identifier (60 chars)
   ===================== ======= ==============================================

.. js:attribute:: DLISFile.logicalFiles

   Array of all :doc:`LogicalFile <logicalfile>` objects found in the file.
   Most DLIS files contain exactly one logical file, but multi-logical-file
   configurations are supported.

   :type: LogicalFile[]

.. js:attribute:: DLISFile.warnings

   Non-fatal parsing warnings accumulated during ``fromBuffer`` /
   ``fromFile``. Inspect these to diagnose files that load but produce
   unexpected results.

   :type: string[]

   .. code-block:: javascript

      if (dlis.warnings.length) {
        dlis.warnings.forEach(w => console.warn('[DLIS]', w));
      }

Shortcuts (first logical file)
--------------------------------

These properties forward to ``logicalFiles[0]`` for convenience when working
with the common single-logical-file case.

.. js:attribute:: DLISFile.origin

   Acquisition/well metadata from the first logical file.

   :type: OriginInfo | null

.. js:attribute:: DLISFile.frames

   Frame registry of the first logical file.

   :type: Map<string, Frame>

.. js:attribute:: DLISFile.channels

   Channel registry of the first logical file.

   :type: Map<string, ChannelInfo>
