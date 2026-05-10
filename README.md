# @geoharkat/dlis-parser

Parse **RP66 V1 (DLIS)** well-log binary files — in the browser and Node.js with zero runtime dependencies.

[![npm](https://img.shields.io/npm/v/@geoharkat/dlis-parser)](https://www.npmjs.com/package/@geoharkat/dlis-parser)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## Features

- Full RP66 V1 / DLIS binary parsing (Storage Unit Label, Visible Records, Logical Record Segments)
- Correct EFLR parsing: CHANNEL, FRAME, ORIGIN, PARAMETER, ZONE, EQUIPMENT, TOOL, CALIBRATION families
- FDATA IFLR decoding with proper per-frame UVARI frame-number handling
- All 27 RP66 V1 representation codes (including IBM float, VAX float, FSHORT, complex)
- Multi-dimensional and waveform array channels
- Export to **CSV** and **LAS 2.0**
- Vendor quirks: Baker Hughes ATLAS ABSATR extension, Schlumberger VR version byte variants
- Works in **browser** (`fromBuffer`) and **Node.js** (`fromFile`)
- Full **TypeScript** type declarations included

---

## Install

```bash
npm install @geoharkat/dlis-parser
```

---

## Quick start

### Node.js

```js
import { DLISFile } from '@geoharkat/dlis-parser';

const file = await DLISFile.fromFile('well.dlis');

// Well metadata
const origin = file.origin;
console.log('Well:', origin.wellName, '|', 'Field:', origin.fieldName);
console.log('Company:', origin.company);

// List frames and channels
for (const frame of file.frames.values()) {
  console.log(`Frame "${frame.name}"  index: ${frame.indexType}  channels: ${frame.channelNames.join(', ')}`);
}

// Decode a frame
const frame = file.logicalFiles[0].getFrame('MAIN');
const { frameCount, data, channels } = frame.decode();

console.log(`${frameCount} depth samples`);
console.log('DEPTH[0]:', data.DEPTH[0], channels.find(c => c.name === 'DEPTH').units);
console.log('GR[0]:',    data.GR[0]);

// Export
const csv = frame.toCSV();
const las = frame.toLAS();
```

### Browser

```html
<input type="file" id="fileInput" accept=".dlis">
<script type="module">
import { DLISFile } from 'https://cdn.jsdelivr.net/npm/@geoharkat/dlis-parser/src/index.js';

document.getElementById('fileInput').addEventListener('change', async e => {
  const buf = await e.target.files[0].arrayBuffer();
  const file = DLISFile.fromBuffer(buf);

  for (const frame of file.frames.values()) {
    const result = frame.decode();
    if (result) console.log(frame.name, result.frameCount, 'frames');
  }
});
</script>
```

---

## API

### `DLISFile`

| Member | Description |
|--------|-------------|
| `DLISFile.fromBuffer(buffer: ArrayBuffer)` | Parse from an in-memory buffer (sync) |
| `DLISFile.fromFile(path: string)` | Parse from a file path (async, Node.js only) |
| `.sul` | Storage Unit Label (`{ version, structure, maxRecordLength, storageSetId, … }`) |
| `.logicalFiles` | Array of `LogicalFile` |
| `.origin` | Shortcut → `logicalFiles[0].origin` |
| `.frames` | Shortcut → `logicalFiles[0].frames` |
| `.channels` | Shortcut → `logicalFiles[0].channels` |
| `.warnings` | Non-fatal parse warnings (`string[]`) |

### `LogicalFile`

| Member | Description |
|--------|-------------|
| `.id` | File ID string (from FILE-HEADER) |
| `.origin` | Well/acquisition metadata (`OriginInfo`) |
| `.channels` | `Map<key, ChannelInfo>` keyed by `'origin/copy/name'` |
| `.frames` | `Map<key, Frame>` keyed by `'origin/copy/name'` |
| `.parameters` | `ParameterInfo[]` (KB, TD, BHT, mud weight, …) |
| `.getFrame(name)` | Find `Frame` by name (case-insensitive) |
| `.getChannel(name)` | Find `ChannelInfo` by name (case-insensitive) |

### `Frame`

| Member | Description |
|--------|-------------|
| `.name` | Frame name string |
| `.indexType` | e.g. `'BOREHOLE-DEPTH'`, `'TIME'` |
| `.direction` | `'INCREASING'` or `'DECREASING'` |
| `.spacing` | Nominal depth/time step (number or null) |
| `.channelNames` | `string[]` in recording order |
| `.channels` | `ChannelInfo[]` fully resolved |
| `.decode()` | Returns `DecodeResult` |
| `.toCSV(opts?)` | Export scalar channels to CSV string |
| `.toLAS(opts?)` | Export scalar channels to LAS 2.0 string |

### `DecodeResult`

```ts
{
  frameCount:   number;
  frameNumbers: Int32Array;          // RP66 frame numbers (1-based)
  channels:     { name, longName, units, repcode, dimension }[];
  data:         { [channelName]: Float64Array };  // length = frameCount * stride
  strides:      { [channelName]: number };        // 1 for scalars, N for array channels
}
```

**Reading array channels:**
```js
// DTCO_WAVE has dimension [512] → stride = 512
const wave0 = result.data.DTCO_WAVE.slice(0, 512); // waveform at first depth
const wave1 = result.data.DTCO_WAVE.slice(512, 1024);
```

---

## Representation codes

```js
import { RC } from '@geoharkat/dlis-parser';

// RC.FSINGL = 2  (IEEE 754 single)
// RC.FDOUBL = 7  (IEEE 754 double)
// RC.SNORM  = 13 (signed 16-bit integer)
// RC.IDENT  = 19 (short ASCII string)
// etc.
```

---

## Null values

DLIS has no universal null. Common vendor nulls are detected by `isNullVal()` inside the
library but all values are returned as-is so you can apply your own masking:

```js
import { NULL_VALUES } from '@geoharkat/dlis-parser';

const masked = Array.from(result.data.GR).map(v =>
  !Number.isFinite(v) || NULL_VALUES.has(v) ? NaN : v
);
```

---

## Contact

Ismail Harkat — <geoharkat@gmail.com>

Issues: https://github.com/geoharkat/dlis-parser/issues

---

## License

MIT © 2025 Ismail Harkat
