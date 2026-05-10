/**
 * RP66 V1 Representation Codes (Table 25, API RP66 1991).
 * @enum {number}
 */
export const RC = Object.freeze({
  FSHORT: 1,   // 16-bit RP66 float
  FSINGL: 2,   // IEEE 754 single
  FSING1: 3,   // IEEE single + 4-byte validity mask
  FSING2: 4,   // IEEE single + lower/upper bounds (12 bytes total)
  ISINGL: 5,   // IBM single precision
  VSINGL: 6,   // VAX F-float
  FDOUBL: 7,   // IEEE 754 double
  FDOUB1: 8,   // IEEE double + 4-byte exponent (12 bytes total)
  FDOUB2: 9,   // IEEE double + 8-byte bounds (16 bytes total)
  CSINGL: 10,  // Complex single (real 4B + imag 4B)
  CDOUBL: 11,  // Complex double (real 8B + imag 8B)
  SSHORT: 12,  // Signed int8
  SNORM:  13,  // Signed int16 BE
  SLONG:  14,  // Signed int32 BE
  USHORT: 15,  // Unsigned int8
  UNORM:  16,  // Unsigned int16 BE
  ULONG:  17,  // Unsigned int32 BE
  UVARI:  18,  // Variable-length unsigned int (1, 2, or 4 bytes)
  IDENT:  19,  // Short ASCII string (1-byte length prefix)
  ASCII:  20,  // Long ASCII string (4-byte ULONG length prefix)
  DTIME:  21,  // 8-byte date-time
  ORIGIN: 22,  // Origin reference (UVARI alias)
  OBNAME: 23,  // Object name triplet
  OBJREF: 24,  // Object reference (IDENT + OBNAME)
  ATTREF: 25,  // Attribute reference (IDENT + OBNAME)
  STATUS: 26,  // Boolean byte
  UNITS:  27,  // Unit symbol (same encoding as IDENT)
});

/** Fixed byte sizes indexed by RC code; 0 = variable length. */
export const RC_SIZE = new Uint8Array(28);
RC_SIZE[RC.FSHORT]  = 2;
RC_SIZE[RC.FSINGL]  = 4;
RC_SIZE[RC.FSING1]  = 8;
RC_SIZE[RC.FSING2]  = 12;
RC_SIZE[RC.ISINGL]  = 4;
RC_SIZE[RC.VSINGL]  = 4;
RC_SIZE[RC.FDOUBL]  = 8;
RC_SIZE[RC.FDOUB1]  = 12;
RC_SIZE[RC.FDOUB2]  = 16;
RC_SIZE[RC.CSINGL]  = 8;
RC_SIZE[RC.CDOUBL]  = 16;
RC_SIZE[RC.SSHORT]  = 1;
RC_SIZE[RC.SNORM]   = 2;
RC_SIZE[RC.SLONG]   = 4;
RC_SIZE[RC.USHORT]  = 1;
RC_SIZE[RC.UNORM]   = 2;
RC_SIZE[RC.ULONG]   = 4;
RC_SIZE[RC.DTIME]   = 8;
RC_SIZE[RC.STATUS]  = 1;

/** RC name string → code; for vendor files that encode RC as an IDENT string. */
export const RC_BY_NAME = {};
for (const [k, v] of Object.entries(RC)) RC_BY_NAME[k] = v;

/**
 * Common vendor-specific null / absent values.
 * These are not defined by the RP66V1 spec; each service company uses its own.
 */
export const NULL_VALUES = new Set([
  -9999.25, -999.25, -9999.0, -999.0,
   9999.25,  999.25,  9999.0,  999.0,
  1e30, -1e30, 1e32, -1e32,
  9.96921e36, -9.96921e36,
  1.70141e38, -1.70141e38,
  2147483647, -2147483648,
  32767, -32768,
]);

/** LRS attribute byte bit masks (RP66V1 §3.2.3.1). */
export const LRS_EFLR        = 0x80;
export const LRS_PREDECESSOR = 0x40;  // set = has predecessor (= NOT first segment)
export const LRS_SUCCESSOR   = 0x20;  // set = has successor   (= NOT last segment)
export const LRS_CHECKSUM    = 0x04;
export const LRS_TRAILING    = 0x02;
export const LRS_PADDING     = 0x01;
// Aliases kept for back-compat (misnamed in 1.0.x)
export const LRS_FIRST = LRS_PREDECESSOR;
export const LRS_LAST  = LRS_SUCCESSOR;
