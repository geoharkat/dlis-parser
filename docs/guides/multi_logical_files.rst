Multiple Logical Files
=======================

A single ``.dlis`` physical file can contain more than one **logical file**.
Each logical file is a self-contained recording unit with its own ORIGIN, set
of channels, frames, and parameters.

This is common in:

* Multi-pass acquisitions where each pass is a separate logical file
* Files that combine real-time and memory recordings
* Composite files built by merging several runs

Detecting multiple logical files
---------------------------------

.. code-block:: javascript

   const dlis = await DLISFile.fromFile('multi.dlis');

   console.log('Logical files:', dlis.logicalFiles.length);

   for (const [i, lf] of dlis.logicalFiles.entries()) {
     console.log(`\nLogical file ${i + 1}: id="${lf.id}"`);
     console.log('  Channels:', lf.channels.size);
     console.log('  Frames  :', lf.frames.size);
     console.log('  Well    :', lf.origin?.wellName ?? '(none)');
   }

Iterating all frames across all logical files
---------------------------------------------

.. code-block:: javascript

   for (const lf of dlis.logicalFiles) {
     for (const frame of lf.frames.values()) {
       const result = frame.decode();
       if (!result) continue;
       console.log(
         `LF "${lf.id}"  frame "${frame.name}"`,
         result.frameCount, 'rows,',
         frame.channelNames.join(', ')
       );
     }
   }

Shortcut properties
--------------------

:attr:`DLISFile.origin`, :attr:`DLISFile.channels`, and
:attr:`DLISFile.frames` are shortcuts to ``logicalFiles[0]``.  For files with
only one logical file this is always correct.  For multi-logical-file cases
you should iterate ``logicalFiles`` explicitly.

Same channel name in different logical files
---------------------------------------------

Each logical file has its own channel registry.  A channel named ``GR`` in
logical file 0 and a ``GR`` in logical file 1 are separate objects and may
have different OBNAMEs, repcodes, or units.

.. code-block:: javascript

   const gr0 = dlis.logicalFiles[0].getChannel('GR');
   const gr1 = dlis.logicalFiles[1].getChannel('GR');

   console.log(gr0?.obname);  // { origin: 1, copy: 0, name: 'GR' }
   console.log(gr1?.obname);  // { origin: 2, copy: 0, name: 'GR' }
