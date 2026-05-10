Arrays and Waveform Channels
============================

Many wireline measurements record an entire waveform or an image row at each
depth sample, not just a single scalar value.  Examples include:

* **CBL / VDL** — cement bond / variable density log (500 or 250 samples per row)
* **Sonic full-waveform** — P- and S-wave arrival trains (256–1024 samples)
* **FMI / FMS** — formation micro-imager button traces (dozens of pads × buttons)
* **XMAC** — cross-multipole acoustic waveforms

Understanding dimension and stride
------------------------------------

The ``dimension`` field of a :ref:`ChannelInfo <data-types-channel>` object
gives the shape of one sample:

* ``[1]`` — scalar (one number per depth row)
* ``[N]`` — 1-D array (N numbers per depth row)
* ``[M, N]`` — 2-D array (M × N numbers per depth row)

In ``DecodeResult``, the corresponding **stride** equals the product of all
dimension elements:

.. code-block:: javascript

   const stride = result.strides['VDL'];
   // For dim=[500]:  stride = 500
   // For dim=[8,672]: stride = 5376

All values for a channel are stored flat in a single ``Float64Array``:

* ``data[name][i * stride]`` through ``data[name][(i+1) * stride - 1]``
  = all samples at depth index ``i``.

Reading a 1-D waveform
-----------------------

.. code-block:: javascript

   const result = frame.decode();
   const vdl    = result.data['VDL'];    // Float64Array, length = frameCount * 500
   const stride = result.strides['VDL']; // 500

   // Waveform at the 10th depth sample (zero-based)
   const wave10 = vdl.slice(10 * stride, 11 * stride);

   // All waveforms as a 2-D Float64Array view
   // (frameCount rows × stride columns)
   for (let i = 0; i < result.frameCount; i++) {
     const wave = vdl.subarray(i * stride, (i + 1) * stride);
     // wave is a zero-copy Float64Array view — no allocation
   }

Reading a 2-D channel
---------------------

For channels with ``dim = [M, N]`` the stride equals ``M * N``.  The
convention for row-major vs column-major ordering is tool-dependent, but
typically the first dimension is the slower index (e.g. pass or azimuth bin)
and the second is the faster index (e.g. time sample within a waveform).

.. code-block:: javascript

   const stride = result.strides['TFWV08']; // e.g. 5376 = 8 * 672
   const ch     = result.channels.find(c => c.name === 'TFWV08');
   const [M, N] = ch.dimension;             // [8, 672]

   const data = result.data['TFWV08'];

   // Sample at depth i, row m, column n:
   const sample = data[i * stride + m * N + n];

Representation codes for waveforms
------------------------------------

Waveform channels most commonly use:

* ``RC.SNORM`` (code 13) — signed 16-bit integer, 2 bytes per sample.
  Typical for acoustic and cement bond waveforms.
* ``RC.FSINGL`` (code 2) — IEEE 754 float, 4 bytes per sample.
  Typical for processed waveform outputs.

.. code-block:: javascript

   import { RC } from '@geoharkat/dlis-parser';

   for (const ch of result.channels) {
     if (result.strides[ch.name] > 1) {
       const type = ch.repcode === RC.SNORM  ? 'int16 waveform'
                  : ch.repcode === RC.FSINGL ? 'float32 waveform'
                  : `repcode=${ch.repcode}`;
       console.log(`${ch.name}: dim=${ch.dimension}  ${type}`);
     }
   }

Converting to a 2-D array
--------------------------

.. code-block:: javascript

   function toMatrix(result, name) {
     const data   = result.data[name];
     const stride = result.strides[name];
     const rows   = result.frameCount;
     const matrix = [];
     for (let i = 0; i < rows; i++) {
       matrix.push(data.subarray(i * stride, (i + 1) * stride));
     }
     return matrix; // array of Float64Array views, no copy
   }

   const vdlMatrix = toMatrix(result, 'VDL');
   // vdlMatrix[i] = waveform at depth result.data['DEPTH'][i]
