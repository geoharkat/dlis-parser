Data Types
==========

.. _data-types-origin:

OriginInfo
----------

Acquisition and well metadata sourced from the ORIGIN EFLR.  When the ORIGIN
EFLR is unreadable, the library falls back to the PARAMETER EFLR using the
standard mnemonics ``WN``, ``FN``, ``CN``, ``WI``, ``RUN``, and ``SON``.

.. list-table::
   :header-rows: 1
   :widths: 25 15 60

   * - Field
     - Type
     - Description
   * - ``key``
     - string
     - OBNAME triplet string of the ORIGIN object
   * - ``fileId``
     - string
     - FILE-ID attribute (file identifier)
   * - ``fileSetName``
     - string
     - File set name
   * - ``fileSetNumber``
     - number
     - File set number
   * - ``fileNumber``
     - number
     - File number within the file set
   * - ``fileType``
     - string
     - File type (e.g. ``"PLAYBACK"``)
   * - ``product``
     - string
     - Acquisition software product name
   * - ``version``
     - string
     - Acquisition software version
   * - ``creationTime``
     - Date | null
     - Date and time the file was created
   * - ``orderNumber``
     - string
     - Service order number
   * - ``descentNumber``
     - number
     - Well descent (run) counter
   * - ``runNumber``
     - number
     - Logging run number
   * - ``wellId``
     - string
     - Well API / UWI identifier
   * - ``wellName``
     - string
     - Well name
   * - ``fieldName``
     - string
     - Field name
   * - ``producerCode``
     - number
     - Logging company code (API standard)
   * - ``producerName``
     - string
     - Logging company name
   * - ``company``
     - string
     - Operating company name

.. _data-types-channel:

ChannelInfo
-----------

Metadata for one channel as parsed from the CHANNEL EFLR.

.. list-table::
   :header-rows: 1
   :widths: 25 15 60

   * - Field
     - Type
     - Description
   * - ``key``
     - string
     - OBNAME triplet ``"origin/copy/name"``
   * - ``name``
     - string
     - Short mnemonic (e.g. ``"GR"``, ``"DEPTH"``)
   * - ``obname``
     - OBName
     - Full OBNAME triplet ``{ origin, copy, name }``
   * - ``longName``
     - string
     - Descriptive name (e.g. ``"Gamma Ray"``)
   * - ``units``
     - string
     - Unit symbol (e.g. ``"gAPI"``, ``"m"``, ``"us/ft"``)
   * - ``repcode``
     - number
     - RP66 V1 representation code (see :doc:`../reference/representation_codes`)
   * - ``dimension``
     - number[]
     - ``[1]`` for scalars; ``[N]`` for 1-D arrays; ``[M, N]`` for 2-D
   * - ``properties``
     - string[]
     - Channel property flags (e.g. ``"AVERAGED"``, ``"DERIVED"``)
   * - ``minValue``
     - number | null
     - Minimum value hint (may be absent)
   * - ``maxValue``
     - number | null
     - Maximum value hint (may be absent)

.. _data-types-decode:

DecodeResult
------------

Returned by :js:func:`Frame.decode`.

.. list-table::
   :header-rows: 1
   :widths: 25 15 60

   * - Field
     - Type
     - Description
   * - ``frameCount``
     - number
     - Number of decoded depth/time samples
   * - ``frameNumbers``
     - Int32Array
     - RP66 V1 frame numbers (1-based, one per row)
   * - ``channels``
     - DecodeChannelMeta[]
     - Ordered channel metadata (name, longName, units, repcode, dimension)
   * - ``data``
     - Record<string, Float64Array>
     - Decoded values. Length = ``frameCount × strides[name]``
   * - ``strides``
     - Record<string, number>
     - 1 for scalar channels; product of ``dimension`` for array channels

**Example — accessing data:**

.. code-block:: javascript

   const result = frame.decode();

   // Scalar channel (stride = 1)
   const depth = result.data['DEPTH'];      // length == frameCount
   console.log('Start depth:', depth[0]);
   console.log('Stop  depth:', depth[result.frameCount - 1]);

   // Array channel (stride = 500 for a 500-sample waveform)
   const stride = result.strides['VDL'];    // 500
   const vdl    = result.data['VDL'];       // length == frameCount * 500

   for (let i = 0; i < result.frameCount; i++) {
     const waveform = vdl.subarray(i * stride, (i + 1) * stride);
     // waveform is a Float64Array view of 500 samples at depth[i]
   }

ParameterInfo
-------------

One entry from the PARAMETER EFLR.

.. list-table::
   :header-rows: 1
   :widths: 25 15 60

   * - Field
     - Type
     - Description
   * - ``name``
     - string
     - Mnemonic (e.g. ``"WN"``, ``"TD"``, ``"BHT"``)
   * - ``longName``
     - string
     - Descriptive name
   * - ``values``
     - unknown[]
     - Parsed values (strings, numbers, or Date objects)
   * - ``units``
     - string
     - Unit symbol
   * - ``zones``
     - OBName[]
     - Zone references (empty for global parameters)

OBName
------

The RP66 V1 Object Name triplet used to uniquely identify every object.

.. list-table::
   :header-rows: 1
   :widths: 20 15 65

   * - Field
     - Type
     - Description
   * - ``origin``
     - number
     - Origin reference — links the object to its creating logical file
   * - ``copy``
     - number
     - Copy number — distinguishes multiple copies of the same-named object
   * - ``name``
     - string
     - Human-readable identifier (the mnemonic)

.. code-block:: javascript

   // OBNAME key format used by channel/frame Maps
   const key = `${obname.origin}/${obname.copy}/${obname.name}`;
   // e.g. "1/0/GR"  or  "16/0/TDEP"
