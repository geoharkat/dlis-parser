Installation
============

npm
---

.. code-block:: bash

   npm install @geoharkat/dlis-parser

The package ships with full TypeScript declarations — no ``@types/`` package needed.

CDN (browser)
-------------

Import directly from jsDelivr without any build step:

.. code-block:: html

   <script type="module">
     import { DLISFile } from
       'https://cdn.jsdelivr.net/npm/@geoharkat/dlis-parser/src/index.js';
   </script>

Or from unpkg:

.. code-block:: html

   <script type="module">
     import { DLISFile } from
       'https://unpkg.com/@geoharkat/dlis-parser/src/index.js';
   </script>

Requirements
------------

* **Node.js** ≥ 16 (ESM, ``import`` syntax)
* **Browser** — any modern browser with ``ArrayBuffer``, ``DataView``, and
  ``TextDecoder`` support (Chrome 49+, Firefox 48+, Safari 10.1+)

The library has **zero runtime dependencies**.

TypeScript
----------

TypeScript declarations are included at ``types/index.d.ts`` and registered in
``package.json``. No extra configuration is needed:

.. code-block:: typescript

   import { DLISFile, RC, ChannelInfo, DecodeResult } from '@geoharkat/dlis-parser';
