Quick Start
===========

Node.js — parse a file
-----------------------

.. code-block:: javascript

   import { DLISFile } from '@geoharkat/dlis-parser';

   const file = await DLISFile.fromFile('well.dlis');

   // Well metadata (from ORIGIN EFLR or PARAMETER fallback)
   const origin = file.origin;
   console.log('Well :', origin.wellName);
   console.log('Field:', origin.fieldName);
   console.log('Co.  :', origin.company);

   // List all frames and their channels
   for (const frame of file.frames.values()) {
     console.log(
       `Frame "${frame.name}"`,
       `index: ${frame.indexType}`,
       `channels: ${frame.channelNames.join(', ')}`
     );
   }

   // Decode the first frame
   const frame = file.logicalFiles[0].getFrame('MAIN');
   if (!frame) throw new Error('Frame not found');

   const result = frame.decode();
   console.log(`${result.frameCount} depth samples`);

   // Scalar channel access
   const depth = result.data['DEPTH'];
   const gr    = result.data['GR'];
   console.log('DEPTH[0]:', depth[0], frame.channels[0].units);
   console.log('GR[0]   :', gr[0]);

Browser — file input
---------------------

.. code-block:: html

   <input type="file" id="pick" accept=".dlis">
   <pre id="out"></pre>

   <script type="module">
   import { DLISFile } from
     'https://cdn.jsdelivr.net/npm/@geoharkat/dlis-parser/src/index.js';

   document.getElementById('pick').addEventListener('change', async e => {
     const buf  = await e.target.files[0].arrayBuffer();
     const file = DLISFile.fromBuffer(buf);            // synchronous
     const lf   = file.logicalFiles[0];

     let out = `Logical files: ${file.logicalFiles.length}\n`;
     out += `Channels: ${lf.channels.size}\n`;

     for (const frame of lf.frames.values()) {
       const result = frame.decode();
       if (!result) continue;
       out += `\nFrame: ${frame.name}  (${result.frameCount} rows)\n`;
       for (const ch of result.channels) {
         out += `  ${ch.name.padEnd(20)} ${ch.units}\n`;
       }
     }
     document.getElementById('out').textContent = out;
   });
   </script>

Exporting to CSV and LAS
------------------------

.. code-block:: javascript

   const frame = file.logicalFiles[0].getFrame('MAIN');

   // All scalar channels → CSV string
   const csv = frame.toCSV();

   // Subset of channels → LAS 2.0 string
   const las = frame.toLAS({ channels: ['DEPTH', 'GR', 'CALI'] });

   // Write to disk (Node.js)
   import { writeFileSync } from 'fs';
   writeFileSync('output.csv', csv);
   writeFileSync('output.las', las);

Reading array / waveform channels
----------------------------------

Array channels (e.g. sonic waveforms) have ``stride > 1``.

.. code-block:: javascript

   const result = frame.decode();

   for (const ch of result.channels) {
     const stride = result.strides[ch.name];
     if (stride === 1) {
       // Scalar — one value per depth sample
       console.log(ch.name, result.data[ch.name][0]);
     } else {
       // Array — stride values per depth sample
       const waveform0 = result.data[ch.name].slice(0, stride);
       console.log(ch.name, `dim=${ch.dimension}  first waveform:`, waveform0);
     }
   }

Parsing warnings
----------------

The parser is lenient by design and collects non-fatal issues in
``file.warnings`` rather than throwing:

.. code-block:: javascript

   const file = DLISFile.fromBuffer(buf);
   if (file.warnings.length) {
     console.warn('Parse warnings:\n', file.warnings.join('\n'));
   }
