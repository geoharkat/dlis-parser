Frame
=====

A ``Frame`` wraps one FRAME EFLR object plus all the FDATA IFLR records that
belong to it.  Each frame defines one continuous depth (or time) track and the
set of channels recorded along it.

Properties
----------

.. js:attribute:: Frame.key

   OBNAME triplet string ``"origin/copy/name"`` that uniquely identifies this
   frame within the logical file.

   :type: string

.. js:attribute:: Frame.name

   The frame name as stored in the FRAME EFLR OBNAME.

   :type: string

.. js:attribute:: Frame.description

   Optional free-text description from the DESCRIPTION attribute.

   :type: string

.. js:attribute:: Frame.indexType

   The type of the index channel — typically ``"BOREHOLE-DEPTH"``,
   ``"TIME"``, or ``"VERTICAL-DEPTH"``.  May be an empty string if the
   attribute is absent.

   :type: string

.. js:attribute:: Frame.direction

   Recording direction of the index channel: ``"INCREASING"`` (tool going
   down / time advancing) or ``"DECREASING"`` (tool pulled up).

   :type: string

.. js:attribute:: Frame.spacing

   Nominal step between consecutive index values (depth increment or sampling
   interval).  ``null`` when not specified.

   :type: number | null

.. js:attribute:: Frame.channelNames

   Channel names in recording order (first channel is the index channel).

   :type: string[]

.. js:attribute:: Frame.channels

   Fully resolved :ref:`ChannelInfo <data-types-channel>` objects in
   recording order.  Channels not found in the registry are omitted.

   :type: ChannelInfo[]

Methods
-------

.. js:function:: Frame.decode()

   Decode all FDATA IFLR records belonging to this frame into typed arrays.

   :returns: A :ref:`DecodeResult <data-types-decode>` object, or ``null`` if
             there are no FDATA records for this frame.
   :rtype: DecodeResult | null

   .. code-block:: javascript

      const result = frame.decode();
      if (!result) { console.log('no data'); return; }

      console.log(result.frameCount, 'rows');

      // Scalar channel
      const depth = result.data['DEPTH'];   // Float64Array, length = frameCount

      // Array channel  (e.g. waveform with 500 samples per row)
      const stride = result.strides['VDL']; // 500
      const vdl    = result.data['VDL'];    // Float64Array, length = frameCount * 500
      const row0   = vdl.slice(0, stride);  // first waveform

   .. note::

      All numeric values are promoted to ``Float64Array`` regardless of the
      original representation code.  Signed 16-bit waveform samples
      (``RC.SNORM``) are faithfully preserved in the double buffer.

.. js:function:: Frame.toCSV([opts])

   Export all **scalar** channels to a CSV string (one row per depth sample,
   header row with channel names).

   :param object opts: Optional export options.
   :param string[] opts.channels: Subset of channel names to include.
                                   Defaults to all scalar channels.
   :param string opts.nullStr: String to emit for null/absent values.
                               Defaults to ``''``.
   :returns: CSV-formatted string.
   :rtype: string

   .. code-block:: javascript

      // All scalar channels
      const csv = frame.toCSV();

      // Only specific channels, NaN shown as '-9999.25'
      const csv2 = frame.toCSV({ channels: ['DEPTH','GR','CALI'], nullStr: '-9999.25' });

      // Save (Node.js)
      import { writeFileSync } from 'fs';
      writeFileSync('well.csv', csv);

.. js:function:: Frame.toLAS([opts])

   Export all **scalar** channels to a LAS 2.0 string.  The ``~WELL`` section
   is populated from :attr:`LogicalFile.origin`.

   :param object opts: Optional export options.
   :param string[] opts.channels: Subset of channel names to include.
   :param number opts.nullValue: Numeric null marker in the output.
                                  Defaults to ``-9999.25``.
   :returns: LAS 2.0-formatted string.
   :rtype: string

   .. code-block:: javascript

      const las = frame.toLAS({ channels: ['DEPTH', 'GR', 'CALI', 'RHOB'] });
      writeFileSync('well.las', las);
