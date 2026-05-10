Exporting Data
==============

CSV
---

:js:func:`Frame.toCSV` serialises all scalar channels (stride = 1) to a
comma-separated string with a header row.

.. code-block:: javascript

   // All scalar channels
   const csv = frame.toCSV();

   // Specific channels only
   const csv2 = frame.toCSV({ channels: ['DEPTH', 'GR', 'CALI', 'RHOB', 'NPHI'] });

   // Custom null representation
   const csv3 = frame.toCSV({ nullStr: '-9999.25' });

The output format is::

   DEPTH,GR,CALI
   1500.0000,45.23,8.50
   1500.1000,47.11,8.52
   ...

Saving to disk (Node.js):

.. code-block:: javascript

   import { writeFileSync } from 'fs';
   writeFileSync('well.csv', frame.toCSV());

LAS 2.0
-------

:js:func:`Frame.toLAS` serialises scalar channels to a **LAS Version 2.0**
string.  The ``~WELL`` section is populated from the logical file's
:attr:`~LogicalFile.origin`.

.. code-block:: javascript

   const las = frame.toLAS();

   // Specific channels, custom null
   const las2 = frame.toLAS({
     channels:  ['DEPTH', 'GR', 'CALI', 'RHOB', 'NPHI', 'ILD'],
     nullValue: -9999.25,
   });

The generated LAS includes:

* ``~VERSION`` — LAS 2.0, WRAP NO
* ``~WELL`` — well name, field, company, start/stop depth, step, null, date
* ``~CURVE`` — channel names and units
* ``~A`` — numeric data block

Saving to disk (Node.js):

.. code-block:: javascript

   import { writeFileSync } from 'fs';
   writeFileSync('well.las', frame.toLAS({ channels: ['DEPTH', 'GR'] }));

Download in the browser
------------------------

.. code-block:: javascript

   function download(filename, text) {
     const a = document.createElement('a');
     a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
     a.download = filename;
     a.click();
   }

   download('well.csv', frame.toCSV());
   download('well.las', frame.toLAS());

Working with raw decoded data
------------------------------

For workflows that require more control (e.g. exporting to JSON, feeding a
plotting library, or writing other formats), use :js:func:`Frame.decode`
directly:

.. code-block:: javascript

   const result = frame.decode();

   // Build a plain-object array (one object per depth sample)
   const scalarChs = result.channels.filter(c => result.strides[c.name] === 1);
   const rows = [];
   for (let i = 0; i < result.frameCount; i++) {
     const row = {};
     for (const ch of scalarChs) {
       row[ch.name] = result.data[ch.name][i];
     }
     rows.push(row);
   }

   console.log(JSON.stringify(rows[0]));
   // { DEPTH: 1500, GR: 45.23, CALI: 8.5, ... }
