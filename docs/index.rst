dlis-parser
===========

**@geoharkat/dlis-parser** is a zero-dependency JavaScript library for parsing
**RP66 V1 (DLIS)** well-log binary files in both the browser and Node.js.

.. code-block:: bash

   npm install @geoharkat/dlis-parser

.. code-block:: javascript

   import { DLISFile } from '@geoharkat/dlis-parser';

   const file = await DLISFile.fromFile('well.dlis');
   const frame = file.logicalFiles[0].getFrame('MAIN');
   const { frameCount, data } = frame.decode();

   console.log(frameCount, 'depth samples');
   console.log('DEPTH[0]:', data.DEPTH[0]);

.. toctree::
   :maxdepth: 2
   :caption: Getting started

   installation
   quickstart

.. toctree::
   :maxdepth: 3
   :caption: API Reference

   api/dlisfile
   api/logicalfile
   api/frame
   api/data_types
   api/binaryreader

.. toctree::
   :maxdepth: 2
   :caption: Reference

   reference/representation_codes
   reference/format_overview
   reference/vendor_quirks
   reference/null_values

.. toctree::
   :maxdepth: 2
   :caption: Guides

   guides/arrays_and_waveforms
   guides/export
   guides/multi_logical_files

.. toctree::
   :maxdepth: 1
   :caption: Project

   changelog
