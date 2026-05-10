import { RC } from './constants.js';

/**
 * Reads RP66V1 primitive types from an ArrayBuffer.
 * All multi-byte integers and floats are big-endian per spec.
 */
export class BinaryReader {
  /**
   * @param {ArrayBuffer|Uint8Array} source
   * @param {number} [start=0]  byte offset to begin reading
   * @param {number} [end]      exclusive end offset (defaults to source length)
   */
  constructor(source, start = 0, end) {
    if (source instanceof Uint8Array) {
      this._ab    = source.buffer;
      this._base  = source.byteOffset;
    } else {
      this._ab    = source;
      this._base  = 0;
    }
    this._view  = new DataView(this._ab);
    this._bytes = new Uint8Array(this._ab);
    this._pos   = this._base + start;
    this._end   = end != null ? this._base + end : this._ab.byteLength;
  }

  get pos()  { return this._pos - this._base; }
  set pos(v) { this._pos = this._base + v; }
  get rem()  { return this._end - this._pos; }
  eof()      { return this._pos >= this._end; }
  peek()     { return this._pos < this._end ? this._bytes[this._pos] : -1; }

  u8()  { return this._bytes[this._pos++]; }
  u16() { const v = this._view.getUint16(this._pos, false); this._pos += 2; return v; }
  u32() { const v = this._view.getUint32(this._pos, false); this._pos += 4; return v; }
  i8()  { const v = this._view.getInt8(this._pos);          this._pos++;    return v; }
  i16() { const v = this._view.getInt16(this._pos, false);  this._pos += 2; return v; }
  i32() { const v = this._view.getInt32(this._pos, false);  this._pos += 4; return v; }
  f32() { const v = this._view.getFloat32(this._pos, false); this._pos += 4; return v; }
  f64() { const v = this._view.getFloat64(this._pos, false); this._pos += 8; return v; }

  skip(n) { this._pos += n; }

  /** Read n bytes as a Uint8Array (zero-copy slice). */
  slice(n) {
    const s = this._bytes.subarray(this._pos, this._pos + n);
    this._pos += n;
    return s;
  }

  /** Read n bytes as UTF-8 string. */
  text(n) {
    const s = new TextDecoder('utf-8', { fatal: false }).decode(
      this._bytes.subarray(this._pos, this._pos + n)
    );
    this._pos += n;
    return s;
  }

  // ── RP66V1 non-standard floats ──────────────────────────────

  /** Code 1 — FSHORT: 16-bit RP66 float (NOT IEEE half-float). */
  fshort() {
    const raw  = this._view.getUint16(this._pos, false); this._pos += 2;
    const sign = (raw >> 15) ? -1.0 : 1.0;
    const exp  = (raw >> 11) & 0x0F;
    const mant = raw & 0x07FF;
    return exp === 0
      ? sign * 0.5 * (mant / 2048.0)
      : sign * Math.pow(2, exp - 2) * (1.0 + mant / 2048.0);
  }

  /** Code 5 — ISINGL: IBM base-16 single precision float. */
  isingl() {
    const n    = this._view.getUint32(this._pos, false); this._pos += 4;
    const sign = (n >>> 31) ? -1.0 : 1.0;
    const exp  = ((n >> 24) & 0x7F) - 64;
    const frac = (n & 0xFFFFFF) / 16777216.0;
    return frac === 0 ? 0 : sign * frac * Math.pow(16, exp);
  }

  /** Code 6 — VSINGL: VAX F-float (word-swapped pairs). */
  vsingl() {
    const p = this._pos; this._pos += 4;
    const raw = (this._bytes[p+1] << 24) | (this._bytes[p] << 16) |
                (this._bytes[p+3] << 8)  |  this._bytes[p+2];
    const sign = (raw >>> 31) & 1;
    const exp  = (raw >> 23) & 0xFF;
    const mant = raw & 0x7FFFFF;
    return exp === 0 ? 0.0
      : (sign ? -1.0 : 1.0) * Math.pow(2, exp - 128) * (0.5 + mant / 16777216.0);
  }

  // ── RP66V1 structured types ──────────────────────────────────

  /**
   * UVARI — variable-length unsigned integer (1, 2, or 4 bytes).
   * @returns {number}
   */
  uvari() {
    const b0 = this._bytes[this._pos++];
    if (!(b0 & 0x80)) return b0;
    const b1 = this._bytes[this._pos++];
    if ((b0 & 0xC0) === 0x80) return ((b0 & 0x3F) << 8) | b1;
    const b2 = this._bytes[this._pos++];
    const b3 = this._bytes[this._pos++];
    return ((b0 & 0x3F) * 16777216) + (b1 << 16) + (b2 << 8) + b3;
  }

  /**
   * IDENT — 1-byte length-prefixed ASCII string (max 255 chars).
   * @returns {string}
   */
  ident() {
    const n = this._bytes[this._pos++];
    return this.text(n).trim();
  }

  /**
   * ASCII — 4-byte ULONG length-prefixed string.
   * Falls back to IDENT (1-byte prefix) when the 4-byte length is unreasonably
   * large — Baker Hughes Atlas writes IDENT-encoded strings with ASCII repcode.
   * @returns {string}
   */
  asciiStr() {
    const saved = this._pos;
    const n = this._view.getUint32(this._pos, false); this._pos += 4;
    if (n > 65536 || this._pos + n > this._end) {
      this._pos = saved;
      return this.ident();
    }
    return this.text(n).trimEnd();
  }

  /**
   * OBNAME — object name triplet: { origin, copy, name }.
   *
   * Standard encoding: UVARI origin + USHORT (2B BE) copy + IDENT name.
   * Baker Hughes Atlas variant: UVARI origin + u8 (1B) copy + IDENT name.
   *
   * Auto-detects by checking whether the 2-byte-copy interpretation gives a
   * valid printable-ASCII name (length ≤ 64).  If not, tries 1-byte copy.
   * Uses only direct byte reads (no DataView) to avoid out-of-bounds throws.
   *
   * @returns {{ origin: number, copy: number, name: string }}
   */
  obname() {
    const origin      = this.uvari();
    const afterOrigin = this._pos;
    const rem         = this._end - afterOrigin;

    // ── Standard: 2-byte copy ─────────────────────────────────
    if (rem >= 3) {
      const copy2 = (this._bytes[afterOrigin] << 8) | this._bytes[afterOrigin + 1];
      const nlen2 = this._bytes[afterOrigin + 2];
      if (nlen2 <= 64 && rem >= 3 + nlen2 && this._nameOk(afterOrigin + 3, nlen2)) {
        this._pos = afterOrigin + 3 + nlen2;
        return {
          origin, copy: copy2,
          name: new TextDecoder('utf-8', { fatal: false })
            .decode(this._bytes.subarray(afterOrigin + 3, afterOrigin + 3 + nlen2))
            .trim(),
        };
      }
    }

    // ── Fallback: 1-byte copy (Baker Hughes Atlas) ────────────
    if (rem >= 2) {
      const copy1 = this._bytes[afterOrigin];
      const nlen1 = this._bytes[afterOrigin + 1];
      if (nlen1 <= 64 && rem >= 2 + nlen1 && this._nameOk(afterOrigin + 2, nlen1)) {
        this._pos = afterOrigin + 2 + nlen1;
        return {
          origin, copy: copy1,
          name: new TextDecoder('utf-8', { fatal: false })
            .decode(this._bytes.subarray(afterOrigin + 2, afterOrigin + 2 + nlen1))
            .trim(),
        };
      }
    }

    // ── Last resort: standard with whatever data remains ──────
    if (rem >= 2) {
      const copy2 = (this._bytes[afterOrigin] << 8) | this._bytes[afterOrigin + 1];
      this._pos   = afterOrigin + 2;
      return { origin, copy: copy2, name: this.ident() };
    }
    return { origin, copy: 0, name: '' };
  }

  /** @private Returns true if `len` bytes starting at absolute `pos` are all printable ASCII. */
  _nameOk(pos, len) {
    if (len === 0) return true;
    for (let i = 0; i < len; i++) {
      const c = this._bytes[pos + i];
      if (c === undefined || c < 0x20 || c > 0x7E) return false;
    }
    return true;
  }

  /**
   * OBJREF — type + OBNAME: { type, name }.
   * @returns {{ type: string, name: { origin, copy, name } }}
   */
  objref() {
    return { type: this.ident(), name: this.obname() };
  }

  /**
   * DTIME — 8-byte date-time.
   * Year offset is +1900; upper nibble of month byte may encode timezone (ignored).
   * @returns {Date}
   */
  dtime() {
    const yr = this.u8();
    const mo = this.u8() & 0x0F; // lower nibble = month 1-12
    const dy = this.u8();
    const h  = this.u8(), mi = this.u8(), s  = this.u8();
    const ms = this._view.getUint16(this._pos, false); this._pos += 2;
    return new Date(Date.UTC(1900 + yr, mo - 1, dy, h, mi, s, ms));
  }

  /**
   * Dispatch to the correct reader method for a given representation code.
   * @param {number} rc  Representation code (use RC enum).
   * @returns {*}
   */
  val(rc) {
    switch (rc) {
      case RC.FSHORT: return this.fshort();
      case RC.FSINGL: return this.f32();
      case RC.FSING1: { const v = this.f32(); this.skip(4);  return v; }
      case RC.FSING2: { const v = this.f32(); this.skip(8);  return v; }
      case RC.ISINGL: return this.isingl();
      case RC.VSINGL: return this.vsingl();
      case RC.FDOUBL: return this.f64();
      case RC.FDOUB1: { const v = this.f64(); this.skip(4);  return v; }
      case RC.FDOUB2: { const v = this.f64(); this.skip(8);  return v; }
      case RC.CSINGL: { const re = this.f32(), im = this.f32(); return { re, im }; }
      case RC.CDOUBL: { const re = this.f64(), im = this.f64(); return { re, im }; }
      case RC.SSHORT: return this.i8();
      case RC.SNORM:  return this.i16();
      case RC.SLONG:  return this.i32();
      case RC.USHORT: return this.u8();
      case RC.UNORM:  return this.u16();
      case RC.ULONG:  return this.u32();
      case RC.UVARI:  return this.uvari();
      case RC.IDENT:  return this.ident();
      case RC.ASCII:  return this.asciiStr();
      case RC.DTIME:  return this.dtime();
      case RC.ORIGIN: return this.uvari();
      case RC.OBNAME: return this.obname();
      case RC.OBJREF: return this.objref();
      case RC.ATTREF: return { label: this.ident(), name: this.obname() };
      case RC.STATUS: return Boolean(this.u8());
      case RC.UNITS:  return this.ident();
      default: throw new Error(`Unknown representation code: ${rc}`);
    }
  }
}
