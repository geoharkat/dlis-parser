LogicalFile
===========

A ``LogicalFile`` groups all channels, frames, and metadata that belong to a
single acquisition sequence within one ``.dlis`` file.  Access via
:attr:`DLISFile.logicalFiles`.

Properties
----------

.. js:attribute:: LogicalFile.id

   File identifier string from the FILE-HEADER EFLR. Typically a run label or
   sequence identifier assigned by the acquisition system.

   :type: string

.. js:attribute:: LogicalFile.origin

   Well and acquisition metadata parsed from the ORIGIN EFLR.  When the
   ORIGIN EFLR is unreadable (a known issue with certain vendor-encoded files),
   the library automatically falls back to the PARAMETER EFLR and looks up the
   standard mnemonics ``WN``, ``FN``, ``CN``, ``WI``, ``RUN``, and ``SON``.

   :type: OriginInfo | null

   See :ref:`OriginInfo <data-types-origin>` for the full list of fields.

.. js:attribute:: LogicalFile.channels

   All channels registered in this logical file, keyed by their OBNAME triplet
   string ``"origin/copy/name"``.

   :type: Map<string, ChannelInfo>

   .. code-block:: javascript

      for (const [key, ch] of lf.channels) {
        console.log(ch.name, ch.units, ch.dimension);
      }

.. js:attribute:: LogicalFile.frames

   All frames registered in this logical file, keyed by ``"origin/copy/name"``.

   :type: Map<string, Frame>

.. js:attribute:: LogicalFile.parameters

   Well parameters from the PARAMETER EFLR — KB elevation, TD, BHT, mud
   weight, bit size, and any other scalar metadata stored in the file.

   :type: ParameterInfo[]

   .. code-block:: javascript

      for (const p of lf.parameters) {
        console.log(p.name, '=', p.values, p.units);
      }

Methods
-------

.. js:function:: LogicalFile.getFrame(name)

   Find a :doc:`Frame <frame>` by name (case-insensitive).  Also matches the
   trailing component of the OBNAME key, so both ``"MAIN"`` and
   ``"1/0/MAIN"`` find the same frame.

   :param string name: Frame name to search for.
   :returns: The matching ``Frame``, or ``undefined`` if not found.
   :rtype: Frame | undefined

   .. code-block:: javascript

      const frame = lf.getFrame('MAIN');
      if (!frame) throw new Error('Frame not found');

.. js:function:: LogicalFile.getChannel(name)

   Find a ``ChannelInfo`` by name (case-insensitive).  Returns the first match
   when multiple copies of the same channel name exist (e.g. from different
   recording passes — use the ``channels`` Map directly for precise lookups).

   :param string name: Channel name to search for.
   :returns: The matching ``ChannelInfo``, or ``undefined`` if not found.
   :rtype: ChannelInfo | undefined

   .. code-block:: javascript

      const gr = lf.getChannel('GR');
      console.log('GR units:', gr?.units);
