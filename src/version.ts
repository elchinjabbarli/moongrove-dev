/**
 * Single source of truth for product identity and version.
 * Everything else (package.json, manifest.webmanifest, README, git tags) must
 * stay in sync with these values. Checked by tools/build.mjs.
 */
export const VERSION = '1.0.0';
export const APP_NAME = 'Moongrove';
export const APP_TITLE = 'Moongrove — Evolution Match Puzzle';
export const RELEASE_DATE = '2027-01-01';
export const AUTHOR = 'Elchin Jabbarli';
export const BUNDLE_ID = 'com.elchinjabbarli.moongrove';
export const SITE_URL = 'https://elchinjabbarli.github.io/moongrove/';
