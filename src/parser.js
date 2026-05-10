/**
 * Core DLIS / RP66 V1 parser.
 *
 * Exported classes:
 *   DLISFile    – top-level entry point
 *   LogicalFile – one logical file within a DLIS
 *   Frame       – one recording frame (wraps FRAME EFLR + FDATA IFLRs)
 */

import {
  RC, RC_SIZE, NULL_VALUES,
  LRS_EFLR, LRS_PREDECESSOR, LRS_SUCCESSOR, LRS_CHECKSUM, LRS_TRAILING, LRS_PADDING,
} from './constants.js';
import { BinaryReader } from './BinaryReader.js';
import { parseEFLR, getAttr, normalizeRC, scanChannelOBNAMEs } from './eflr.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Canonical string key for an OBNAME triplet. */
function obnameKey(o) { return `${o.origin}/${o.copy}/${o.name}`; }

function isNullVal(v) {
  return !Number.isFinite(v) || NULL_VALUES.has(v);
}

// ── SUL ─────────────────────────────────────────────────────────────────────

function parseSUL(bytes) {
  if (bytes.length < 80) throw new Error('File too short for Storage Unit Label (need 80 bytes)');
  const td  = new TextDecoder('ascii', { fatal: false });
  const raw = td.decode(bytes.subarray(0, 80));
  const maxLenStr = raw.substring(15, 20).trim();
  return {
    sequenceNumber:  raw.substring(0, 4).trim(),
    version:         raw.substring(4, 9).trim(),
    structure:       raw.substring(9, 15).trim(),
    maxRecordLength: maxLenStr ? parseInt(maxLenStr, 10) : 8192,
    storageSetId:    raw.substring(20, 80).trim(),
  };
}

// ── VR / LRS scanner ────────────────────────────────────────────────────────

/**
 * Walk the binary data, assemble all Logical Records, and split into
 * EFLR records and FDATA IFLR blocks.
 *
 * @param {Uint8Array} bytes
 * @param {string[]}   warnings  mutable array for diagnostic messages
 * @returns {{ eflrRecords: Array, iflrBlocks: Map }}
 *   eflrRecords: [ { data: Uint8Array, lrsType: number } ]
 *   iflrBlocks:  Map< frameKey:string, [ { data: Uint8Array, bodyOffset: number } ] >
 */
function scanRecords(bytes, warnings) {
  const view      = new DataView(bytes.buffer, bytes.byteOffset);
  const fileSize  = bytes.length;
  const eflrRecords = [];
  const iflrMap   = new Map();

  let pos    = 80; // skip SUL
  let curLR  = null;

  while (pos + 4 <= fileSize) {
    const vrLen  = view.getUint16(pos, false);
    const vrMark = bytes[pos + 2]; // version byte — always 0xFF per RP66V1 §2.3.6

    // 0xFF is the only valid version marker; type byte (pos+3) is 0x01 standard or 0x00 Schlumberger
    if (vrMark !== 0xFF) {
      // Scan forward for next valid VR header
      let found = false;
      const limit = Math.min(pos + 65536, fileSize - 4);
      for (let s = pos + 1; s <= limit; s++) {
        if (bytes[s + 2] === 0xFF) { pos = s; found = true; break; }
      }
      if (!found) break;
      continue;
    }

    if (vrLen < 4) { pos += 4; continue; }
    const vrEnd = Math.min(pos + vrLen, fileSize);
    let   lrsPos = pos + 4;
    pos = vrEnd; // advance now, before inner loop may break

    while (lrsPos + 4 <= vrEnd) {
      const lrsLen  = view.getUint16(lrsPos,     false);
      const lrsAttr = bytes[lrsPos + 2];
      const lrsType = bytes[lrsPos + 3];

      if (lrsLen < 4 || lrsPos + lrsLen > vrEnd) {
        warnings.push(`LRS at 0x${lrsPos.toString(16)}: bad length ${lrsLen}`);
        break;
      }

      const isEFLR  =  !!(lrsAttr & LRS_EFLR);
      // Predecessor/Successor bits: SET means the segment is NOT first/last.
      // A standalone segment (e.g. attr=0x80) has both bits CLEAR → isFirst=true, isLast=true.
      const isFirst = !(lrsAttr & LRS_PREDECESSOR);
      const isLast  = !(lrsAttr & LRS_SUCCESSOR);
      const hasTL   =  !!(lrsAttr & LRS_TRAILING);
      const hasCRC  =  !!(lrsAttr & LRS_CHECKSUM);
      const hasPad  =  !!(lrsAttr & LRS_PADDING);

      let bodyStart = lrsPos + 4;
      let bodyEnd   = lrsPos + lrsLen;

      // Strip trailers (spec §2.2.2.4): Trailing Length (2B) → Checksum (2B) → Padding
      if (hasTL && bodyEnd - bodyStart >= 2)  bodyEnd -= 2;
      if (hasCRC && bodyEnd - bodyStart >= 2) bodyEnd -= 2;
      if (hasPad && bodyEnd > bodyStart) {
        const nPad = bytes[bodyEnd - 1];
        bodyEnd = Math.max(bodyStart, bodyEnd - nPad - 1);
      }

      const body = bodyEnd > bodyStart
        ? bytes.slice(bodyStart, bodyEnd)
        : new Uint8Array(0);

      if (isFirst) {
        if (curLR) warnings.push('Incomplete logical record discarded');
        curLR = { isEFLR, lrsType, chunks: [] };
      }
      if (curLR) curLR.chunks.push(body);

      if (isLast && curLR) {
        const totalLen = curLR.chunks.reduce((s, c) => s + c.length, 0);
        if (totalLen > 0) {
          const assembled = new Uint8Array(totalLen);
          let off = 0;
          for (const c of curLR.chunks) { assembled.set(c, off); off += c.length; }

          if (curLR.isEFLR) {
            eflrRecords.push({ data: assembled, lrsType: curLR.lrsType });
          } else if (curLR.lrsType === 0x00) {
            // FDATA: read frame OBNAME + first frame-number, then store body offset
            try {
              const r = new BinaryReader(assembled);
              const frameRef   = r.obname();
              const bodyOffset = r.pos;       // past OBNAME; frame numbers follow
              const key        = obnameKey(frameRef);
              if (!iflrMap.has(key)) iflrMap.set(key, []);
              iflrMap.get(key).push({ data: assembled, bodyOffset });
            } catch (e) {
              warnings.push(`FDATA IFLR skipped: ${e.message}`);
            }
          }
          // NOFORMAT (0x01) IFLRs are intentionally ignored
        }
        curLR = null;
      }

      lrsPos += lrsLen;
    }
  }
  return { eflrRecords, iflrMap };
}

// ── EFLR processors ─────────────────────────────────────────────────────────

function processFileHeader(eflr, out) {
  for (const obj of eflr.objects) {
    out.fileHeaders.push({
      id:    getAttr(obj, 'ID') || '',
      seqNo: getAttr(obj, 'SEQUENCE-NUMBER') || '',
    });
  }
}

function processOrigin(eflr, out) {
  for (const obj of eflr.objects) {
    out.origins.push({
      key:          obj.name ? obnameKey(obj.name) : '',
      fileId:       getAttr(obj, 'FILE-ID') || '',
      fileSetName:  getAttr(obj, 'FILE-SET-NAME') || '',
      fileSetNumber:getAttr(obj, 'FILE-SET-NUMBER') ?? 0,
      fileNumber:   getAttr(obj, 'FILE-NUMBER') ?? 1,
      fileType:     getAttr(obj, 'FILE-TYPE') || '',
      product:      getAttr(obj, 'PRODUCT') || '',
      version:      getAttr(obj, 'VERSION') || '',
      creationTime: getAttr(obj, 'CREATION-TIME'),   // Date | null
      orderNumber:  getAttr(obj, 'ORDER-NUMBER') || '',
      descentNumber:getAttr(obj, 'DESCENT-NUMBER') ?? 1,
      runNumber:    getAttr(obj, 'RUN-NUMBER') ?? 1,
      wellId:       getAttr(obj, 'WELL-ID') || '',
      wellName:     getAttr(obj, 'WELL-NAME') || '',
      fieldName:    getAttr(obj, 'FIELD-NAME') || '',
      producerCode: getAttr(obj, 'PRODUCER-CODE') ?? 0,
      producerName: getAttr(obj, 'PRODUCER-NAME') || '',
      company:      getAttr(obj, 'COMPANY') || '',
    });
  }
}

function processChannels(eflr, channels) {
  for (const obj of eflr.objects) {
    if (!obj.name) continue;
    const key      = obnameKey(obj.name);
    const prev     = channels.get(key);
    const rc_raw   = getAttr(obj, 'REPRESENTATION-CODE');
    const dimRaw   = getAttr(obj, 'DIMENSION');
    const dim      = dimRaw
      ? (Array.isArray(dimRaw) ? dimRaw.map(Number) : [Number(dimRaw)])
      : null;
    // Preserve existing repcode/dimension if this EFLR doesn't carry them
    // (Baker Hughes writes both a standard CHANNEL EFLR and a vendor 440-CHANNEL EFLR;
    // the vendor one lacks REPRESENTATION-CODE and DIMENSION but would otherwise
    // overwrite the correct values from the standard EFLR with defaults)
    const repcode   = rc_raw  != null ? normalizeRC(rc_raw)  : (prev?.repcode   ?? RC.FSINGL);
    const dimension = dim     != null ? dim                   : (prev?.dimension ?? [1]);
    const props = (() => {
      const p = getAttr(obj, 'PROPERTIES');
      return p ? (Array.isArray(p) ? p : [p]) : (prev?.properties ?? []);
    })();
    channels.set(key, {
      key,
      name:      obj.name.name,
      obname:    obj.name,
      longName:  getAttr(obj, 'LONG-NAME') || prev?.longName || '',
      units:     getAttr(obj, 'UNITS') || getAttr(obj, 'UNIT') || prev?.units || '',
      repcode,
      dimension,
      properties: props,
      minValue: getAttr(obj, 'MINIMUM-VALUE') ?? prev?.minValue ?? null,
      maxValue: getAttr(obj, 'MAXIMUM-VALUE') ?? prev?.maxValue ?? null,
    });
  }
}

function extractChanRefs(obj, rawData) {
  const raw = getAttr(obj, 'CHANNELS');
  if (!raw) return scanChannelOBNAMEs(rawData);
  const arr = Array.isArray(raw) ? raw : [raw];
  const refs = arr.filter(Boolean).map(r => {
    if (r && typeof r === 'object' && r.type !== undefined && r.name) return r.name;
    return r;
  });
  return refs.length > 0 ? refs : scanChannelOBNAMEs(rawData);
}

function processFrames(eflr, rawData, frames) {
  let inheritedRefs = []; // carry chanRefs from empty-name "header" objects (Baker Hughes Atlas)
  for (const obj of eflr.objects) {
    if (!obj.name) continue;

    if (!obj.name.name) {
      // Empty-name object: Baker Hughes puts CHANNELS values here; the next named object
      // references this frame in FDATA but has no CHANNELS override of its own.
      const refs = extractChanRefs(obj, rawData);
      if (refs.length > 0) inheritedRefs = refs;
      continue; // no FDATA for empty-name key — do not add to frames
    }

    const key = obnameKey(obj.name);
    let chanRefs = extractChanRefs(obj, rawData);
    if (chanRefs.length === 0 && inheritedRefs.length > 0) chanRefs = inheritedRefs;
    inheritedRefs = [];

    frames.set(key, {
      key,
      name:        obj.name.name,
      obname:      obj.name,
      description: getAttr(obj, 'DESCRIPTION') || '',
      channelRefs: chanRefs,
      indexType:   getAttr(obj, 'INDEX-TYPE') || '',
      direction:   getAttr(obj, 'DIRECTION') || 'INCREASING',
      spacing:     getAttr(obj, 'SPACING'),
    });
  }
}

function processParameters(eflr, parameters) {
  for (const obj of eflr.objects) {
    if (!obj.name) continue;
    const vals  = getAttr(obj, 'VALUES');
    const zones = getAttr(obj, 'ZONES');
    parameters.push({
      name:      obj.name.name,
      longName:  getAttr(obj, 'LONG-NAME') || '',
      values:    vals ? (Array.isArray(vals) ? vals : [vals]) : [],
      units:     getAttr(obj, 'UNITS') || '',
      zones:     zones ? (Array.isArray(zones) ? zones : [zones]) : [],
    });
  }
}

// ── Frame decoder ────────────────────────────────────────────────────────────

const DEPTH_RE    = /^(DEPTH|TDEP|TIME|ETIM|DBTM|MD|TVD|DEPT)$/i;
const WAVEFORM_RE = /WAVE|WVFM|VDL|WVFT|WVLT|WVFR|DTCO|WF/i;

/**
 * Decode all FDATA blocks for one frame and return typed arrays.
 *
 * @param {Object}        frameMeta   – parsed FRAME EFLR metadata
 * @param {Map}           channels    – channel registry from processChannels
 * @param {Array}         iflrBlocks  – [ { data: Uint8Array, bodyOffset: number } ]
 * @returns {DecodeResult|null}
 */
function decodeFrame(frameMeta, channels, iflrBlocks) {
  if (!iflrBlocks || iflrBlocks.length === 0) return null;

  // ── Resolve channel list ─────────────────────────────────────
  const chanList = [];
  for (const ref of frameMeta.channelRefs) {
    const key = obnameKey(ref);
    let ch = channels.get(key);
    if (!ch) {
      // Fallback: match by channel name only (origin/copy may differ across EFLRs)
      const nm = ref.name || '';
      for (const c of channels.values()) {
        if (c.name === nm) { ch = c; break; }
      }
    }
    if (ch) {
      chanList.push({ ...ch });
    } else {
      const nm     = ref.name || '';
      const isWave = WAVEFORM_RE.test(nm);
      const rc     = DEPTH_RE.test(nm) ? RC.FDOUBL : RC.FSINGL;
      chanList.push({
        key, name: nm, obname: ref, longName: nm, units: '',
        repcode: rc, dimension: [isWave ? 0 : 1], properties: [],
        _synthetic: true, _isWave: isWave,
      });
    }
  }
  if (chanList.length === 0) return null;

  // ── Handle waveform channels with unknown dimension ──────────
  const firstBodySize = iflrBlocks[0].data.length - iflrBlocks[0].bodyOffset;
  // subtract one UVARI frame number (assume 1-byte = smallest case)
  const knownBytes = chanList.reduce((s, ch) => {
    if (ch._isWave) return s;
    const n = ch.dimension.reduce((a, b) => a * b, 1) || 1;
    return s + n * (RC_SIZE[ch.repcode] || 4);
  }, 0);
  const waveChans = chanList.filter(c => c._isWave);
  if (waveChans.length > 0) {
    const leftover = firstBodySize - knownBytes - 1; // -1 for frame number UVARI
    if (leftover > 0) {
      const samplesPerWave = Math.floor(leftover / (4 * waveChans.length));
      const perWave = samplesPerWave > 0 ? samplesPerWave : 1;
      for (const ch of waveChans) ch.dimension = [perWave];
    } else {
      for (const ch of waveChans) ch.dimension = [1];
    }
  }

  // ── Build decode plan ────────────────────────────────────────
  const plan = chanList.map(ch => {
    const n  = ch.dimension.reduce((a, b) => a * b, 1) || 1;
    const sz = RC_SIZE[ch.repcode] || 4;
    return { ch, n, sz, totalBytes: n * sz };
  });
  const bytesPerFrame = plan.reduce((s, p) => s + p.totalBytes, 0);
  if (bytesPerFrame === 0) return null;

  // ── Count total frames across all IFLR blocks ────────────────
  // Each IFLR body: [UVARI frame_no][samples per channel]* (repeating)
  // We approximate: body / (1 + bytesPerFrame) — frame number is at least 1 byte
  let totalFrames = 0;
  for (const blk of iflrBlocks) {
    const bodyLen = blk.data.length - blk.bodyOffset;
    // UVARI frame number takes 1-4 bytes; use 1 for count estimation
    if (bytesPerFrame > 0) totalFrames += Math.max(0, Math.floor(bodyLen / (1 + bytesPerFrame)));
  }
  if (totalFrames === 0) totalFrames = 256; // safe initial allocation

  // ── Allocate output arrays ────────────────────────────────────
  const buffers = {};
  for (const { ch, n } of plan) {
    buffers[ch.name] = new Float64Array(totalFrames * n);
  }
  let frameNumbers = new Int32Array(totalFrames);

  // ── Decode ────────────────────────────────────────────────────
  let fi = 0;
  for (const blk of iflrBlocks) {
    const r = new BinaryReader(blk.data, blk.bodyOffset);

    while (!r.eof()) {
      // Grow buffers if we underestimated
      if (fi >= frameNumbers.length) {
        const newSize = fi * 2;
        const newFN   = new Int32Array(newSize);
        newFN.set(frameNumbers);
        frameNumbers = newFN;
        for (const { ch, n } of plan) {
          const old = buffers[ch.name];
          const neo = new Float64Array(newSize * n);
          neo.set(old);
          buffers[ch.name] = neo;
        }
      }

      // Read frame number (UVARI)
      if (r.rem < 1) break;
      let frameNo;
      try { frameNo = r.uvari(); }
      catch { break; }

      // Decode all channels in order
      let ok = true;
      for (const { ch, n, sz } of plan) {
        if (r.rem < sz * n) { ok = false; break; }
        const arr = buffers[ch.name];
        for (let d = 0; d < n; d++) {
          try {
            const v = r.val(ch.repcode);
            arr[fi * n + d] = typeof v === 'number' ? v : NaN;
          } catch { ok = false; break; }
        }
        if (!ok) break;
      }
      if (!ok) break;

      frameNumbers[fi] = frameNo;
      fi++;
    }
  }

  // ── Trim to actual decoded count ─────────────────────────────
  const frameCount = fi;
  const data = {};
  const strides = {};
  for (const { ch, n } of plan) {
    data[ch.name]    = buffers[ch.name].slice(0, frameCount * n);
    strides[ch.name] = n;
  }

  return {
    frameCount,
    frameNumbers: frameNumbers.slice(0, frameCount),
    channels: plan.map(p => ({
      name:      p.ch.name,
      longName:  p.ch.longName,
      units:     p.ch.units,
      repcode:   p.ch.repcode,
      dimension: p.ch.dimension,
    })),
    data,
    strides,
  };
}

// ── Frame class ──────────────────────────────────────────────────────────────

export class Frame {
  /** @internal */
  constructor(meta, logicalFile) {
    this._meta = meta;
    this._lf   = logicalFile;
  }

  get key()         { return this._meta.key; }
  get name()        { return this._meta.name; }
  get description() { return this._meta.description; }
  get indexType()   { return this._meta.indexType; }
  get direction()   { return this._meta.direction; }
  get spacing()     { return this._meta.spacing; }

  /** Names of channels in this frame (in recording order). */
  get channelNames() {
    return this._meta.channelRefs.map(r => r.name);
  }

  /** Fully resolved Channel objects for this frame. */
  get channels() {
    return this._meta.channelRefs
      .map(r => this._lf.channels.get(obnameKey(r)))
      .filter(Boolean);
  }

  /**
   * Decode all FDATA records for this frame.
   *
   * @returns {DecodeResult}
   *   {
   *     frameCount  : number,
   *     frameNumbers: Int32Array,
   *     channels    : { name, longName, units, repcode, dimension }[],
   *     data        : { [channelName]: Float64Array },
   *     strides     : { [channelName]: number }  // 1 for scalar, N for array
   *   }
   */
  decode() {
    const blocks = this._lf._iflrMap.get(this._meta.key) || [];
    return decodeFrame(this._meta, this._lf.channels, blocks);
  }

  /**
   * Export scalar channels to CSV.
   * @param {{ channels?: string[], nullStr?: string }} [opts]
   * @returns {string}
   */
  toCSV(opts = {}) {
    const result = this.decode();
    if (!result) return '';
    const { nullStr = '' } = opts;
    const cols = opts.channels
      ? result.channels.filter(c => opts.channels.includes(c.name))
      : result.channels.filter(c => result.strides[c.name] === 1);

    const lines = [cols.map(c => c.name).join(',')];
    for (let i = 0; i < result.frameCount; i++) {
      lines.push(cols.map(c => {
        const v = result.data[c.name][i];
        return isNullVal(v) ? nullStr : v.toPrecision(8);
      }).join(','));
    }
    return lines.join('\n');
  }

  /**
   * Export scalar channels to LAS 2.0.
   * @param {{ metadata?: Object, nullValue?: number }} [opts]
   * @returns {string}
   */
  toLAS(opts = {}) {
    const result = this.decode();
    if (!result) return '';

    const origin     = this._lf.origin || {};
    const nullOut    = opts.nullValue ?? -9999.25;
    const allCols    = result.channels.filter(c => result.strides[c.name] === 1);
    const depthCh    = allCols[0];
    const dataCols   = opts.channels
      ? allCols.filter(c => opts.channels.includes(c.name))
      : allCols;

    if (!depthCh || dataCols.length === 0) return '';

    const depthArr = result.data[depthCh.name];
    let strt = null, stop = null;
    for (let i = 0; i < result.frameCount; i++) {
      if (!isNullVal(depthArr[i])) { if (strt == null) strt = depthArr[i]; stop = depthArr[i]; }
    }

    const now = new Date().toISOString().slice(0, 10);
    const lines = [
      '~VERSION -------------------------------------------',
      ' VERS. 2.0               : LAS FORMAT VERSION 2.0',
      ' WRAP. NO                : ONE LINE PER DEPTH STEP',
      '~WELL ----------------------------------------------',
      ` WELL. ${(origin.wellName || 'UNKNOWN').padEnd(20)}: WELL NAME`,
      ` FLD . ${(origin.fieldName || 'UNKNOWN').padEnd(20)}: FIELD`,
      ` COMP. ${(origin.company || 'UNKNOWN').padEnd(20)}: COMPANY`,
      ` STRT. ${depthCh.units.padEnd(6)} ${strt != null ? strt.toFixed(4) : '0'}: START DEPTH`,
      ` STOP. ${depthCh.units.padEnd(6)} ${stop != null ? stop.toFixed(4) : '0'}: STOP DEPTH`,
      ` STEP. ${depthCh.units.padEnd(6)} ${this._meta.spacing != null ? this._meta.spacing.toFixed(4) : '0'}: STEP`,
      ` NULL. -9999.25              : NULL VALUE`,
      ` DATE. ${now.padEnd(20)}: DATE`,
      '~CURVE ---------------------------------------------',
    ];

    for (const c of dataCols) {
      lines.push(` ${c.name.padEnd(6)}. ${(c.units || '').padEnd(10)}: ${c.longName || c.name}`);
    }

    lines.push('~A         ' + dataCols.map(c => c.name).join('  '));

    for (let i = 0; i < result.frameCount; i++) {
      lines.push(dataCols.map(c => {
        const v = result.data[c.name][i];
        return isNullVal(v) ? nullOut.toFixed(4).padStart(12) : v.toFixed(4).padStart(12);
      }).join(''));
    }
    return lines.join('\n');
  }
}

// ── LogicalFile class ────────────────────────────────────────────────────────

export class LogicalFile {
  /** @internal */
  constructor({ id, origin, channels, frames, parameters, iflrMap }) {
    this.id         = id;
    this.origin     = origin || null;
    this._channels  = channels;  // Map<key, ChannelInfo>
    this._frameMeta = frames;    // Map<key, frameMeta>
    this._iflrMap   = iflrMap;   // Map<key, [{data, bodyOffset}]>
    this.parameters = parameters;

    // Build Frame objects
    this._frames = new Map();
    for (const [key, meta] of frames) {
      this._frames.set(key, new Frame(meta, this));
    }
  }

  /**
   * All channels keyed by 'origin/copy/name'.
   * @type {Map<string, ChannelInfo>}
   */
  get channels() { return this._channels; }

  /**
   * All frames keyed by 'origin/copy/name'.
   * @type {Map<string, Frame>}
   */
  get frames() { return this._frames; }

  /**
   * Find a Frame by channel name (case-insensitive).
   * @param {string} name
   * @returns {Frame|undefined}
   */
  getFrame(name) {
    const lower = name.toLowerCase();
    for (const f of this._frames.values()) {
      if (f.name.toLowerCase() === lower) return f;
    }
    // Also search by any part of the key
    for (const [k, f] of this._frames) {
      if (k.toLowerCase().endsWith('/' + lower)) return f;
    }
    return undefined;
  }

  /**
   * Find a Channel by name (case-insensitive).
   * @param {string} name
   * @returns {ChannelInfo|undefined}
   */
  getChannel(name) {
    const lower = name.toLowerCase();
    for (const ch of this._channels.values()) {
      if (ch.name.toLowerCase() === lower) return ch;
    }
    return undefined;
  }
}

// ── DLISFile class ───────────────────────────────────────────────────────────

export class DLISFile {
  /** @internal */
  constructor({ sul, logicalFiles, warnings }) {
    this.sul          = sul;
    this.logicalFiles = logicalFiles;
    this.warnings     = warnings;
  }

  /**
   * Parse a DLIS file from an ArrayBuffer (works in browser and Node.js).
   * @param {ArrayBuffer} buffer
   * @returns {DLISFile}
   */
  static fromBuffer(buffer) {
    const ab    = buffer instanceof ArrayBuffer ? buffer : buffer.buffer;
    const bytes = new Uint8Array(ab);
    const warnings = [];

    // 1. Storage Unit Label
    const sul = parseSUL(bytes);
    if (sul.version !== 'V1.00') warnings.push(`Unexpected DLIS version: ${sul.version}`);
    if (sul.structure !== 'RECORD') warnings.push(`Unexpected storage structure: ${sul.structure}`);

    // 2. Scan VRs → collect EFLRs + FDATA blocks
    const { eflrRecords, iflrMap } = scanRecords(bytes, warnings);

    // 3. Parse EFLRs
    const allChannels   = new Map();
    const allFrameMeta  = new Map();
    const fileHeaders   = [];
    const origins       = [];
    const parameters    = [];

    for (const rec of eflrRecords) {
      try {
        let eflr = parseEFLR(rec.data);
        let st   = eflr.type.toUpperCase();

        // Baker Hughes ATLAS: bare SET wrapping another EFLR
        if (!st && eflr.objects.length === 0 && rec.data.length > 1) {
          try {
            const e2 = parseEFLR(rec.data.slice(1));
            if (e2.objects.length > 0 || e2.type) { eflr = e2; st = e2.type.toUpperCase(); }
          } catch { /* ignore */ }
        }

        // Fallback by LRS type byte
        if (!st) {
          if (rec.lrsType === 0x83) st = 'CHANNEL';
          else if (rec.lrsType === 0x84) st = 'FRAME';
        }

        // Handle proprietary prefixes (e.g. "440-CHANNEL")
        if (st && st !== 'CHANNEL' && st.endsWith('CHANNEL')) st = 'CHANNEL';
        if (st && st !== 'FRAME'   && st.endsWith('FRAME'))   st = 'FRAME';

        switch (st) {
          case 'FILE-HEADER': processFileHeader(eflr, { fileHeaders }); break;
          case 'ORIGIN':      processOrigin(eflr, { origins });         break;
          case 'CHANNEL':     processChannels(eflr, allChannels);       break;
          case 'FRAME':       processFrames(eflr, rec.data, allFrameMeta); break;
          case 'PARAMETER':   processParameters(eflr, parameters);      break;
        }
      } catch (e) {
        warnings.push(`EFLR parse error (lrsType=0x${rec.lrsType.toString(16)}): ${e.message}`);
      }
    }

    // 4. Reconcile FDATA iflrMap keys with FRAME EFLR keys.
    //    FDATA IFLRs use the frame OBNAME as written by the recording device (authoritative).
    //    FRAME EFLR objects use a parsed OBNAME that may be garbled by vendor encoding quirks.
    //    Strategy: for each FRAME key not in iflrMap, try name-suffix match, then
    //    single-unmatched-pair fallback.
    {
      const unmatchedFrameKeys = [...allFrameMeta.keys()].filter(k => !iflrMap.has(k));
      const claimedIFLRKeys    = new Set(allFrameMeta.keys());

      for (const frameKey of unmatchedFrameKeys) {
        const frameName = (allFrameMeta.get(frameKey)?.name || '').toLowerCase();
        let matchedIFLRKey = null;

        // Try name-based match
        for (const iflrKey of iflrMap.keys()) {
          if (claimedIFLRKeys.has(iflrKey)) continue;
          const iflrName = iflrKey.split('/').pop()?.toLowerCase() ?? '';
          if (iflrName && iflrName === frameName) { matchedIFLRKey = iflrKey; break; }
        }

        if (!matchedIFLRKey) {
          // Last resort: only one unmatched IFLR key left
          const unclaimed = [...iflrMap.keys()].filter(k => !claimedIFLRKeys.has(k));
          if (unclaimed.length === 1) matchedIFLRKey = unclaimed[0];
        }

        if (matchedIFLRKey) {
          iflrMap.set(frameKey, iflrMap.get(matchedIFLRKey));
          claimedIFLRKeys.add(matchedIFLRKey);
          warnings.push(`Frame key reconciled: "${frameKey}" → "${matchedIFLRKey}"`);
        }
      }
    }

    // 5. Build logical files
    // Simple model: group everything into one logical file per FILE-HEADER (or one if absent)
    const lfCount = Math.max(1, fileHeaders.length);
    const logicalFiles = [];

    for (let i = 0; i < lfCount; i++) {
      logicalFiles.push(new LogicalFile({
        id:         fileHeaders[i]?.id || `LF-${i + 1}`,
        origin:     origins[i] || origins[0] || null,
        channels:   allChannels,
        frames:     allFrameMeta,
        parameters,
        iflrMap,
      }));
    }

    // 6. PARAMETER fallback for well metadata.
    //    Baker Hughes Atlas stores WN/CN/FN/etc. in PARAMETER EFLRs because their
    //    ORIGIN EFLR uses a non-standard DEFINING_ORIGIN encoding that many parsers
    //    cannot read.
    if (parameters.length > 0) {
      const pMap = {};
      for (const p of parameters) pMap[p.name] = p.values?.[0] ?? '';
      const get = (...names) => {
        for (const n of names) { const v = pMap[n]; if (v && typeof v === 'string' && v.trim()) return v.trim(); }
        return '';
      };
      for (const lf of logicalFiles) {
        const o = lf.origin;
        if (!o || (!o.wellName && !o.company && !o.fieldName)) {
          lf.origin = {
            ...(o || { key:'', fileId:'', fileSetName:'', fileSetNumber:0, fileNumber:1,
                        fileType:'', product:'', version:'', creationTime:null,
                        orderNumber:'', descentNumber:1, runNumber:1, wellId:'',
                        wellName:'', fieldName:'', producerCode:0, producerName:'', company:'' }),
            wellName:     o?.wellName     || get('WN'),
            fieldName:    o?.fieldName    || get('FN'),
            company:      o?.company      || get('CN'),
            wellId:       o?.wellId       || get('WI', 'UWI'),
            runNumber:    o?.runNumber    || Number(get('RUN')) || 1,
            producerName: o?.producerName || get('SON'),
          };
        }
      }
    }

    return new DLISFile({ sul, logicalFiles, warnings });
  }

  /**
   * Parse a DLIS file from a filesystem path (Node.js only).
   * @param {string} filePath
   * @returns {Promise<DLISFile>}
   */
  static async fromFile(filePath) {
    if (typeof process === 'undefined' || !process.versions?.node) {
      throw new Error('DLISFile.fromFile() is only available in Node.js');
    }
    const { readFile } = await import('fs/promises');
    const buf = await readFile(filePath);
    const ab  = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return DLISFile.fromBuffer(ab);
  }

  /**
   * Shortcut to channels of the first logical file.
   * @type {Map<string, ChannelInfo>}
   */
  get channels() { return this.logicalFiles[0]?.channels ?? new Map(); }

  /**
   * Shortcut to frames of the first logical file.
   * @type {Map<string, Frame>}
   */
  get frames() { return this.logicalFiles[0]?.frames ?? new Map(); }

  /**
   * Shortcut to origin metadata of the first logical file.
   */
  get origin() { return this.logicalFiles[0]?.origin ?? null; }
}
