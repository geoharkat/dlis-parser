/**
 * Smoke test: build a minimal synthetic RP66V1 DLIS buffer and parse it.
 * Tests SUL, VR, LRS, EFLR (CHANNEL + FRAME), FDATA decode, CSV/LAS export.
 */
import { DLISFile, RC } from '../src/index.js';

// ── Minimal binary builder ──────────────────────────────────────────────────

function u8(v)  { return [v & 0xFF]; }
function u16be(v){ return [(v >> 8) & 0xFF, v & 0xFF]; }
function u32be(v){ return [(v >>> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF]; }
function f32be(v){
  const b = new ArrayBuffer(4);
  new DataView(b).setFloat32(0, v, false);
  return [...new Uint8Array(b)];
}
function f64be(v){
  const b = new ArrayBuffer(8);
  new DataView(b).setFloat64(0, v, false);
  return [...new Uint8Array(b)];
}
function ident(s){ const e = new TextEncoder().encode(s); return [e.length, ...e]; }
function asciiPad(s, len){
  const e = new TextEncoder().encode(s);
  const a = new Uint8Array(len).fill(0x20);
  a.set(e.subarray(0, len));
  return [...a];
}
function uvari1(v){ return [v & 0x7F]; }   // 1-byte UVARI

function obname(origin, copy, name){ return [...uvari1(origin), ...u16be(copy), ...ident(name)]; }

// ── 1. Storage Unit Label (80 bytes) ───────────────────────────────────────

const sul = [
  ...asciiPad('0001',  4),   // seq number
  ...asciiPad('V1.00', 5),   // version
  ...asciiPad('RECORD',6),   // structure
  ...asciiPad('8192',  5),   // max record length (including trailing space)
  ...asciiPad('SMOKE-TEST-WELL', 60),
];
assert(sul.length === 80, `SUL length ${sul.length}`);

// ── 2. Helper: wrap body in LRS + VR ───────────────────────────────────────

function makeVR(lrsType, isEFLR, body) {
  const attr     = isEFLR ? 0x80 : 0x00;   // standalone segment: EFLR bit only, no predecessor/successor
  const lrsLen   = 4 + body.length;
  const lrs      = [...u16be(lrsLen), attr, lrsType, ...body];
  const vrLen    = 4 + lrs.length;
  return [...u16be(vrLen), 0xFF, 0x01, ...lrs];  // VR version byte 0xFF, type byte 0x01
}

// ── 3. FILE-HEADER EFLR ────────────────────────────────────────────────────

const fileHeaderBody = [
  0xF0,                            // SET: TYPE only
  ...ident('FILE-HEADER'),
  // template: SEQUENCE-NUMBER (IDENT), ID (IDENT)
  0x3F, ...ident('SEQUENCE-NUMBER'), 0x01, RC.IDENT, 0x00, 0x00,
  0x3F, ...ident('ID'),             0x01, RC.IDENT, 0x00, 0x00,
  // object
  0x70, ...obname(1, 0, ''),
  0x21, ...ident('1'),       // SEQUENCE-NUMBER = "1"
  0x21, ...ident('SMOKE'),   // ID = "SMOKE"
];
const fileHeaderVR = makeVR(0x80, true, fileHeaderBody);

// ── 4. CHANNEL EFLR — two channels: DEPTH (FDOUBL) and GR (FSINGL) ─────────

const channelBody = [
  0xF0,                            // SET: TYPE only
  ...ident('CHANNEL'),
  // template
  0x3F, ...ident('LONG-NAME'),         0x01, RC.IDENT,  0x00, 0x00,
  0x3F, ...ident('REPRESENTATION-CODE'),0x01, RC.USHORT, 0x00, RC.FSINGL,
  0x3F, ...ident('UNITS'),             0x01, RC.IDENT,  0x00, 0x00,
  0x3F, ...ident('DIMENSION'),         0x01, RC.UVARI,  0x00, 0x01, // default dim=1
  // DEPTH channel
  0x70, ...obname(1, 0, 'DEPTH'),
  0x21, ...ident('Measured Depth'),    // LONG-NAME
  0x21, RC.FDOUBL,                     // REPRESENTATION-CODE = 7 (FDOUBL)
  0x21, ...ident('m'),                 // UNITS
  0x20,                                // DIMENSION = template default (1)
  // GR channel
  0x70, ...obname(1, 0, 'GR'),
  0x21, ...ident('Gamma Ray'),
  0x20,                                // REPRESENTATION-CODE = template default (FSINGL)
  0x21, ...ident('gAPI'),
  0x20,
];
const channelVR = makeVR(0x83, true, channelBody);

// ── 5. FRAME EFLR — one frame referencing both channels ────────────────────

const frameBody = [
  0xF0,
  ...ident('FRAME'),
  // template
  0x3F, ...ident('CHANNELS'),   0x00, RC.OBNAME, 0x00,  // count=0 (variable)
  0x3F, ...ident('INDEX-TYPE'), 0x01, RC.IDENT,  0x00, 0x00,
  // object
  0x70, ...obname(1, 0, 'MAIN'),
  // CHANNELS count=2, then two OBNAMEs
  0x29, 0x02,
    ...obname(1, 0, 'DEPTH'),
    ...obname(1, 0, 'GR'),
  0x21, ...ident('BOREHOLE-DEPTH'),   // INDEX-TYPE
];
const frameVR = makeVR(0x84, true, frameBody);

// ── 6. FDATA IFLR — 3 frames: depth 100/100.5/101 m, GR 50/60/70 gAPI ──────

const frameOBNAME = obname(1, 0, 'MAIN');
const fdataBody = [
  ...frameOBNAME,
  // frame 1
  ...uvari1(1), ...f64be(100.0), ...f32be(50.0),
  // frame 2
  ...uvari1(2), ...f64be(100.5), ...f32be(60.0),
  // frame 3
  ...uvari1(3), ...f64be(101.0), ...f32be(70.0),
];
const fdataVR = makeVR(0x00, false, fdataBody);

// ── 7. Assemble full DLIS buffer ────────────────────────────────────────────

const allBytes = [
  ...sul,
  ...fileHeaderVR,
  ...channelVR,
  ...frameVR,
  ...fdataVR,
];
const buffer = new Uint8Array(allBytes).buffer;

// ── 8. Parse and assert ─────────────────────────────────────────────────────

const file = DLISFile.fromBuffer(buffer);

// SUL
assert(file.sul.version === 'V1.00',         `SUL version: ${file.sul.version}`);
assert(file.sul.structure === 'RECORD',       `SUL structure: ${file.sul.structure}`);
assert(file.sul.maxRecordLength === 8192,     `SUL maxLen: ${file.sul.maxRecordLength}`);
assert(file.sul.storageSetId.startsWith('SMOKE'), `SUL setId: ${file.sul.storageSetId}`);

if (file.warnings.length) console.warn('Warnings:', file.warnings);

// Logical files
assert(file.logicalFiles.length >= 1, 'No logical files parsed');
const lf = file.logicalFiles[0];

// Channels
assert(lf.channels.size >= 2, `Channel count: ${lf.channels.size}`);
const depthCh = lf.getChannel('DEPTH');
const grCh    = lf.getChannel('GR');
assert(depthCh != null,               'DEPTH channel not found');
assert(grCh    != null,               'GR channel not found');
assert(depthCh.repcode === RC.FDOUBL, `DEPTH repcode ${depthCh.repcode}`);
assert(grCh.repcode    === RC.FSINGL, `GR repcode ${grCh.repcode}`);
assert(depthCh.units   === 'm',       `DEPTH units: ${depthCh.units}`);
assert(grCh.units      === 'gAPI',    `GR units: ${grCh.units}`);

// Frames
assert(lf.frames.size >= 1, `Frame count: ${lf.frames.size}`);
const frame = lf.getFrame('MAIN');
assert(frame != null,                          'MAIN frame not found');
assert(frame.indexType === 'BOREHOLE-DEPTH',   `indexType: ${frame.indexType}`);
assert(frame.channelNames.includes('DEPTH'),   'DEPTH not in frame');
assert(frame.channelNames.includes('GR'),      'GR not in frame');

// Decode
const result = frame.decode();
assert(result != null,       'decode() returned null');
assert(result.frameCount === 3, `frameCount: ${result.frameCount}`);

// Check depth values
const depth = result.data.DEPTH;
assertClose(depth[0], 100.0, `depth[0]=${depth[0]}`);
assertClose(depth[1], 100.5, `depth[1]=${depth[1]}`);
assertClose(depth[2], 101.0, `depth[2]=${depth[2]}`);

// Check GR values
const gr = result.data.GR;
assertClose(gr[0], 50.0, `gr[0]=${gr[0]}`);
assertClose(gr[1], 60.0, `gr[1]=${gr[1]}`);
assertClose(gr[2], 70.0, `gr[2]=${gr[2]}`);

// Strides
assert(result.strides.DEPTH === 1, `DEPTH stride ${result.strides.DEPTH}`);
assert(result.strides.GR    === 1, `GR stride ${result.strides.GR}`);

// CSV export
const csv = frame.toCSV();
assert(csv.includes('DEPTH'),     'CSV missing DEPTH header');
assert(csv.includes('GR'),        'CSV missing GR header');
assert(csv.includes('100.00000'), 'CSV missing depth value');
assert(csv.includes('50.000000'), 'CSV missing GR value');

// LAS export
const las = frame.toLAS();
assert(las.includes('~VERSION'), 'LAS missing VERSION section');
assert(las.includes('~CURVE'),   'LAS missing CURVE section');
assert(las.includes('~A'),       'LAS missing data section');
assert(las.includes('DEPTH'),    'LAS missing DEPTH');

// ── Done ────────────────────────────────────────────────────────────────────

console.log('\n✓  All smoke tests passed');
console.log(`   SUL version:      ${file.sul.version}`);
console.log(`   Storage set ID:   ${file.sul.storageSetId}`);
console.log(`   Logical files:    ${file.logicalFiles.length}`);
console.log(`   Channels:         ${lf.channels.size}`);
console.log(`   Frames:           ${lf.frames.size}`);
console.log(`   Frame count:      ${result.frameCount}`);
console.log(`   Warnings:         ${file.warnings.length}`);

// ── Helpers ──────────────────────────────────────────────────────────────────

function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exit(1); }
}
function assertClose(a, b, msg, tol = 1e-5) {
  if (Math.abs(a - b) > tol) { console.error(`FAIL: ${msg} (expected ~${b})`); process.exit(1); }
}
