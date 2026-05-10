/**
 * dlis-parser — RP66 V1 (DLIS) well-log parser
 *
 * MIT License  © 2025 Ismail Harkat <geoharkat@gmail.com>
 *
 * Quick start (Node.js):
 *   import { DLISFile } from 'dlis-parser';
 *   const file = await DLISFile.fromFile('well.dlis');
 *   const frame = file.logicalFiles[0].getFrame('MAIN');
 *   const { data, frameCount } = frame.decode();
 *   console.log('DEPTH samples:', data.DEPTH.slice(0, 5));
 *
 * Quick start (browser):
 *   const file = DLISFile.fromBuffer(arrayBuffer);
 *   const csv = file.frames.values().next().value.toCSV();
 */

export { DLISFile, LogicalFile, Frame } from './parser.js';
export { RC, RC_SIZE, RC_BY_NAME, NULL_VALUES } from './constants.js';
export { BinaryReader } from './BinaryReader.js';
