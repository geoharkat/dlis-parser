import { RC, RC_BY_NAME } from './constants.js';
import { BinaryReader } from './BinaryReader.js';

/**
 * Parse an assembled EFLR body (bytes after LRS headers have been stripped).
 *
 * Returns:
 *   { type: string, name: string, objects: Array<{name, attributes}>, template: Array }
 */
export function parseEFLR(data) {
  const r = data instanceof Uint8Array
    ? new BinaryReader(data)
    : new BinaryReader(data);

  // ── SET descriptor ────────────────────────────────────────────
  const sd      = r.u8();
  const hasType = !!(sd & 0x10); // bit 4
  const hasName = !!(sd & 0x08); // bit 3
  const setType = hasType ? r.ident() : '';
  const setName = hasName ? r.ident() : '';

  // ── Template ──────────────────────────────────────────────────
  const template = [];
  while (!r.eof()) {
    const pk   = r.peek();
    if (pk < 0) break;
    const role = (pk >> 5) & 0x07;
    if (role !== 1 && role !== 2) break; // not ATTRIB (1) or INVATR (2)

    const ad = r.u8();
    const attr = {
      label: '', count: 1, repcode: RC.IDENT, units: '', value: null,
    };
    if (ad & 0x10) attr.label   = r.ident();
    if (ad & 0x08) attr.count   = r.uvari();
    if (ad & 0x04) attr.repcode = r.u8();
    if (ad & 0x02) attr.units   = r.ident();
    if (ad & 0x01) {
      attr.value = [];
      for (let i = 0; i < attr.count; i++) {
        try { attr.value.push(r.val(attr.repcode)); }
        catch { attr.value.push(null); break; }
      }
    }
    template.push(attr);
  }

  // ── Objects ───────────────────────────────────────────────────
  const objects = [];
  while (!r.eof()) {
    const pk = r.peek();
    if (pk < 0) break;
    const role = (pk >> 5) & 0x07;
    if (role !== 3) break; // not OBJECT

    r.u8(); // consume OBJECT descriptor byte (always 0x70 per spec)
    const objName = r.obname(); // OBNAME always follows OBJECT

    // Start with deep copy of template defaults
    const attrs = template.map(t => ({
      label:   t.label,
      count:   t.count,
      repcode: t.repcode,
      units:   t.units,
      value:   t.value ? [...t.value] : null,
    }));

    let ai = 0;
    while (!r.eof() && ai < template.length) {
      const pk2  = r.peek();
      if (pk2 < 0) break;
      const role2 = (pk2 >> 5) & 0x07;
      if (role2 === 3 || role2 >= 5) break; // next OBJECT or new SET

      const ad2 = r.u8();

      if (role2 === 0) {
        // ABSATR — attribute is absent; keep template default.
        // Baker Hughes ATLAS may set format bits on ABSATR; consume their extra bytes.
        if (ad2 & 0x08) try { r.uvari(); } catch { /* skip */ }
        if (ad2 & 0x04) try { r.u8();    } catch { /* skip */ }
        if (ad2 & 0x02) try { r.ident(); } catch { /* skip */ }
        if (ad2 & 0x01) {
          const ta = attrs[ai];
          const cnt = ta ? ta.count : 1;
          const rc  = ta ? ta.repcode : RC.IDENT;
          for (let i = 0; i < cnt; i++) { try { r.val(rc); } catch { break; } }
        }
        ai++; continue;
      }

      // ATTRIB override
      const at = { ...attrs[ai] };
      if (ad2 & 0x10) at.label   = r.ident();
      if (ad2 & 0x08) at.count   = r.uvari();
      if (ad2 & 0x04) at.repcode = r.u8();
      if (ad2 & 0x02) at.units   = r.ident();
      if (ad2 & 0x01) {
        at.value = [];
        for (let i = 0; i < at.count; i++) {
          try { at.value.push(r.val(at.repcode)); }
          catch { at.value.push(null); break; }
        }
      }
      attrs[ai] = at;
      ai++;
    }

    objects.push({ name: objName, attributes: attrs });
  }

  return { type: setType, name: setName, objects, template };
}

/**
 * Get a single attribute value from a parsed EFLR object.
 * Returns the value directly for count=1, or an array for count>1.
 * Returns null if attribute is absent.
 */
export function getAttr(obj, label) {
  const a = obj.attributes.find(a => a.label === label);
  if (!a || !a.value || a.value.length === 0) return null;
  return a.value.length === 1 ? a.value[0] : a.value;
}

/**
 * Normalize representation code: accepts numeric code or name string.
 * @param {number|string} rc
 * @returns {number}
 */
export function normalizeRC(rc) {
  if (typeof rc === 'number') return rc;
  if (typeof rc === 'string') {
    const code = RC_BY_NAME[rc.trim().toUpperCase()];
    if (code != null) return code;
  }
  return RC.FSINGL; // fallback
}

/**
 * Fallback OBNAME scanner for FRAME EFLRs where the CHANNELS attribute
 * could not be decoded via the normal path (non-standard vendor formats).
 * Finds the longest consecutive run of valid OBNAMEs in the raw EFLR bytes.
 *
 * OBNAME encoding: UVARI origin (1–4 B) + USHORT copy (2 B BE) + IDENT name (1+N B).
 */
export function scanChannelOBNAMEs(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

  function tryScan(copy2byte) {
    let best = [], bestLen = 0;
    const limit = Math.min(400, bytes.length);
    for (let start = 0; start < limit; start++) {
      const refs = []; let p = start;
      const minPkt = copy2byte ? 5 : 4;
      while (p + minPkt <= bytes.length) {
        let origin, p2;
        const b0 = bytes[p];
        if (!(b0 & 0x80))              { origin = b0;                                   p2 = p + 1; }
        else if ((b0 & 0xC0) === 0x80) { origin = ((b0 & 0x3F) << 8) | bytes[p + 1];  p2 = p + 2; }
        else                           { p2 = p + 4; origin = ((b0 & 0x3F) * 16777216) | (bytes[p+1] << 16) | (bytes[p+2] << 8) | bytes[p+3]; }
        if (origin === 0) break;
        const nlenOff = copy2byte ? 2 : 1;
        if (p2 + nlenOff + 1 > bytes.length) break;
        const copy = copy2byte ? (bytes[p2] << 8) | bytes[p2 + 1] : bytes[p2];
        const nlen = bytes[p2 + nlenOff];
        if (nlen < 1 || nlen > 48 || p2 + nlenOff + 1 + nlen > bytes.length) break;
        let ok = true;
        for (let i = 0; i < nlen; i++) {
          const c = bytes[p2 + nlenOff + 1 + i];
          if (!((c >= 65 && c <= 90) || (c >= 97 && c <= 122) ||
                (c >= 48 && c <= 57) || c === 95 || c === 45 || c === 46)) {
            ok = false; break;
          }
        }
        if (!ok) break;
        refs.push({ origin, copy, name: String.fromCharCode(...bytes.slice(p2 + nlenOff + 1, p2 + nlenOff + 1 + nlen)) });
        p = p2 + nlenOff + 1 + nlen;
      }
      if (refs.length > bestLen) { best = refs; bestLen = refs.length; }
      if (bestLen >= 20) break;
    }
    return best;
  }

  const std = tryScan(true), bh = tryScan(false);
  return bh.length > std.length ? bh : std;
}
