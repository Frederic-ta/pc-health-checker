// Parser Registry — imports all parsers, provides auto-detection

import battery from './battery.js';
import energy from './energy.js';
import sleep from './sleep.js';
import msinfo from './msinfo.js';
import dxdiag from './dxdiag.js';
import sysinfo from './sysinfo.js';
import drivers from './drivers.js';
import disk from './disk.js';
import wifi from './wifi.js';
import network from './network.js';
import updates from './updates.js';
import events from './events.js';
import startup from './startup.js';
import processes from './processes.js';

export const parsers = [
  battery,
  energy,
  sleep,
  msinfo,
  dxdiag,
  sysinfo,
  drivers,
  disk,
  wifi,
  network,
  updates,
  events,
  startup,
  processes
];

/**
 * Auto-detect file type and parse content.
 * Tries each parser's detect() method and returns the first match.
 * @param {string} filename - The name of the file
 * @param {string} content - The file content as text
 * @returns {{ parser: object, result: object } | null} - Parsed result or null if no parser matched
 */
export function detectAndParse(filename, content) {
  for (const parser of parsers) {
    try {
      if (parser.detect(content, filename)) {
        const result = parser.parse(content);
        return {
          parser: {
            name: parser.name,
            category: parser.category
          },
          result
        };
      }
    } catch (err) {
      console.warn(`Parser "${parser.name}" threw during detect/parse:`, err);
      continue;
    }
  }
  return null;
}

/**
 * Parse content with a specific parser by name.
 * @param {string} parserName - The parser name to use
 * @param {string} content - The file content
 * @returns {{ parser: object, result: object } | null}
 */
export function parseWith(parserName, content) {
  const parser = parsers.find(p => p.name === parserName);
  if (!parser) return null;
  try {
    const result = parser.parse(content);
    return {
      parser: { name: parser.name, category: parser.category },
      result
    };
  } catch (err) {
    console.error(`Parser "${parserName}" threw during parse:`, err);
    return null;
  }
}

/**
 * Get all available parser names grouped by category.
 * @returns {Object<string, string[]>}
 */
export function getParsersByCategory() {
  const grouped = {};
  for (const parser of parsers) {
    if (!grouped[parser.category]) grouped[parser.category] = [];
    grouped[parser.category].push(parser.name);
  }
  return grouped;
}

export default { parsers, detectAndParse, parseWith, getParsersByCategory };
