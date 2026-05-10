// TypeScript declarations for dlis-parser

// ── Representation Codes ────────────────────────────────────────────────────

export declare const RC: {
  readonly FSHORT: 1;  readonly FSINGL: 2;  readonly FSING1: 3;  readonly FSING2: 4;
  readonly ISINGL: 5;  readonly VSINGL: 6;  readonly FDOUBL: 7;
  readonly FDOUB1: 8;  readonly FDOUB2: 9;
  readonly CSINGL: 10; readonly CDOUBL: 11;
  readonly SSHORT: 12; readonly SNORM: 13;  readonly SLONG: 14;
  readonly USHORT: 15; readonly UNORM: 16;  readonly ULONG: 17;
  readonly UVARI: 18;  readonly IDENT: 19;  readonly ASCII: 20;
  readonly DTIME: 21;  readonly ORIGIN: 22; readonly OBNAME: 23;
  readonly OBJREF: 24; readonly ATTREF: 25; readonly STATUS: 26;
  readonly UNITS: 27;
};

export declare const RC_SIZE: Uint8Array;
export declare const RC_BY_NAME: Record<string, number>;
export declare const NULL_VALUES: Set<number>;

// ── Data structures ─────────────────────────────────────────────────────────

export interface StorageUnitLabel {
  sequenceNumber:  string;
  version:         string;   // "V1.00"
  structure:       string;   // "RECORD"
  maxRecordLength: number;
  storageSetId:    string;
}

export interface OBName {
  origin: number;
  copy:   number;
  name:   string;
}

export interface ChannelInfo {
  key:        string;      // 'origin/copy/name'
  name:       string;
  obname:     OBName;
  longName:   string;
  units:      string;
  repcode:    number;      // RC constant
  dimension:  number[];    // [1] = scalar, [N] = 1D array, [M,N] = 2D matrix
  properties: string[];
  minValue:   number | null;
  maxValue:   number | null;
}

export interface ParameterInfo {
  name:     string;
  longName: string;
  values:   unknown[];
  units:    string;
  zones:    OBName[];
}

export interface OriginInfo {
  key:           string;
  fileId:        string;
  fileSetName:   string;
  fileSetNumber: number;
  fileNumber:    number;
  fileType:      string;
  product:       string;
  version:       string;
  creationTime:  Date | null;
  orderNumber:   string;
  descentNumber: number;
  runNumber:     number;
  wellId:        string;
  wellName:      string;
  fieldName:     string;
  producerCode:  number;
  producerName:  string;
  company:       string;
}

export interface DecodeChannelMeta {
  name:      string;
  longName:  string;
  units:     string;
  repcode:   number;
  dimension: number[];
}

export interface DecodeResult {
  /** Number of frames decoded. */
  frameCount:   number;
  /** RP66V1 frame numbers (1-based, typically). */
  frameNumbers: Int32Array;
  /** Ordered channel metadata. */
  channels:     DecodeChannelMeta[];
  /**
   * Decoded samples.
   * Scalar channels: Float64Array of length `frameCount`.
   * Array channels:  Float64Array of length `frameCount * stride`.
   */
  data:    Record<string, Float64Array>;
  /**
   * Stride per channel.
   * 1 for scalar channels, N for array channels (product of dimension).
   */
  strides: Record<string, number>;
}

// ── Frame ───────────────────────────────────────────────────────────────────

export interface CSVOptions {
  /** Subset of channel names to include (defaults to all scalar channels). */
  channels?: string[];
  /** String to emit for null/absent values (default: ''). */
  nullStr?: string;
}

export interface LASOptions {
  /** Subset of channel names to include (defaults to all scalar channels). */
  channels?: string[];
  /** Numeric value to write for nulls (default: -9999.25). */
  nullValue?: number;
}

export declare class Frame {
  /** 'origin/copy/name' key */
  readonly key:         string;
  readonly name:        string;
  readonly description: string;
  readonly indexType:   string;
  readonly direction:   string;
  readonly spacing:     number | null;
  /** Channel names in recording order. */
  readonly channelNames: string[];
  /** Fully resolved ChannelInfo objects. */
  readonly channels:    ChannelInfo[];

  /** Decode all FDATA records into typed arrays. */
  decode(): DecodeResult | null;

  /** Export scalar channels to CSV string. */
  toCSV(opts?: CSVOptions): string;

  /** Export scalar channels to LAS 2.0 string. */
  toLAS(opts?: LASOptions): string;
}

// ── LogicalFile ─────────────────────────────────────────────────────────────

export declare class LogicalFile {
  readonly id:         string;
  readonly origin:     OriginInfo | null;
  readonly parameters: ParameterInfo[];

  /** Channel registry keyed by 'origin/copy/name'. */
  readonly channels: Map<string, ChannelInfo>;

  /** Frame registry keyed by 'origin/copy/name'. */
  readonly frames: Map<string, Frame>;

  /** Find a Frame by name (case-insensitive). */
  getFrame(name: string): Frame | undefined;

  /** Find a Channel by name (case-insensitive). */
  getChannel(name: string): ChannelInfo | undefined;
}

// ── DLISFile ────────────────────────────────────────────────────────────────

export declare class DLISFile {
  readonly sul:          StorageUnitLabel;
  readonly logicalFiles: LogicalFile[];
  readonly warnings:     string[];

  /** Shortcut: channels of the first logical file. */
  readonly channels: Map<string, ChannelInfo>;

  /** Shortcut: frames of the first logical file. */
  readonly frames: Map<string, Frame>;

  /** Shortcut: origin of the first logical file. */
  readonly origin: OriginInfo | null;

  /**
   * Parse a DLIS file from an ArrayBuffer.
   * Works in both browser and Node.js.
   */
  static fromBuffer(buffer: ArrayBuffer): DLISFile;

  /**
   * Parse a DLIS file from the filesystem.
   * Node.js only — throws in browser environments.
   */
  static fromFile(filePath: string): Promise<DLISFile>;
}

// ── BinaryReader (advanced use) ─────────────────────────────────────────────

export declare class BinaryReader {
  constructor(source: ArrayBuffer | Uint8Array, start?: number, end?: number);

  readonly pos: number;
  readonly rem: number;
  eof(): boolean;
  peek(): number;

  u8(): number;   u16(): number;  u32(): number;
  i8(): number;   i16(): number;  i32(): number;
  f32(): number;  f64(): number;
  fshort(): number;
  isingl(): number;
  vsingl(): number;
  uvari(): number;
  ident(): string;
  asciiStr(): string;
  obname(): OBName;
  objref(): { type: string; name: OBName };
  dtime(): Date;
  val(rc: number): unknown;
  skip(n: number): void;
  slice(n: number): Uint8Array;
  text(n: number): string;
}
