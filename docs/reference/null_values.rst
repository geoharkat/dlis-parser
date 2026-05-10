Null Values
===========

RP66 V1 has no universal null/absent value.  Each logging company uses its
own sentinel values to indicate absent, invalid, or out-of-range samples.

Built-in null set
-----------------

The library exports a ``NULL_VALUES`` ``Set<number>`` containing the most
common vendor sentinels:

.. code-block:: javascript

   import { NULL_VALUES } from '@geoharkat/dlis-parser';

   console.log(NULL_VALUES.has(-9999.25)); // true
   console.log(NULL_VALUES.has(1e30));     // true

The complete built-in set:

============ ============================================
Value        Source / vendor
============ ============================================
``-9999.25`` Most common DLIS null (Schlumberger, et al.)
``-999.25``  Alternate short null
``-9999.0``  Integer variant
``-999.0``   Short integer variant
``9999.25``  Positive sentinel (some tools)
``999.25``   Short positive
``9999.0``   Positive integer variant
``999.0``    Short positive integer
``1e30``     Large-value sentinel
``-1e30``    Negative large
``1e32``     Very large sentinel
``-1e32``    Negative very large
``9.96921e36``  IEEE 32-bit representation of ``0x7F7FFFFF``
``-9.96921e36`` Negative variant
``1.70141e38``  IEEE 32-bit max (``0x7F7FFFFF`` via single)
``-1.70141e38`` Negative max
``2147483647``  ``INT_MAX`` (32-bit)
``-2147483648`` ``INT_MIN`` (32-bit)
``32767``    ``INT16_MAX`` (SNORM waveforms)
``-32768``   ``INT16_MIN``
============ ============================================

Applying null masking
---------------------

The library does **not** replace null values with ``NaN`` automatically —
all values are returned as decoded.  Apply your own mask after decoding:

.. code-block:: javascript

   import { NULL_VALUES } from '@geoharkat/dlis-parser';

   function maskNulls(arr) {
     return arr.map(v =>
       !Number.isFinite(v) || NULL_VALUES.has(v) ? NaN : v
     );
   }

   const result = frame.decode();
   const gr = maskNulls(Array.from(result.data['GR']));

Custom null values
------------------

If your file uses a non-standard null sentinel, add it before decoding:

.. code-block:: javascript

   import { NULL_VALUES } from '@geoharkat/dlis-parser';

   NULL_VALUES.add(-999.0);   // add a custom sentinel
   NULL_VALUES.add(9998.0);

.. note::

   ``NULL_VALUES`` is a module-level singleton.  Changes persist for the
   lifetime of the module instance.  Avoid mutating it in library code that
   might be consumed by other users.
