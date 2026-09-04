/**
 * set-version — set the user-visible version name in app.config.ts.
 *
 * This script used to bump three fields: `version`, `android.versionCode` and
 * `ios.buildNumber`. The last two are no longer stored — they are derived from
 * the clock at config-evaluation time (scripts/build-number.js), so there is
 * nothing to increment and nothing to forget to commit.
 *
 * What remains is the marketing version, which SHOULD be a deliberate decision:
 * it is the string users read in the store, and it should change when the
 * product changes, not once per upload.
 *
 * Usage:
 *   node scripts/bump-version.mjs 1.1.0          set the version
 *   node scripts/bump-version.mjs 1.1.0 --dry-run
 *   node scripts/bump-version.mjs                print the current state
 *   node scripts/bump-version.mjs --config path  (testing)
 *
 * Commit the change: `version` is tracked, unlike the build number.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { resolveBuildNumber } = createRequire(import.meta.url)('./build-number.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG = resolve(__dirname, '..', 'app.config.ts');

/**
 * The one field this script rewrites. Quote style is captured either way so a
 * Prettier run cannot break the release tooling.
 */
const FIELDS = {
  version: {
    // e.g. `  version: "1.0.0",` at the top level of the ExpoConfig object.
    pattern: /^(\s*version:\s*['"])(\d+\.\d+\.\d+)(['"]\s*,)$/gm,
    label: 'version (store version name)',
  },
};

function fail(message) {
  console.error(`set-version: ${message}`);
  process.exit(1);
}

/** Find the single occurrence of a field, or fail loudly. */
function readField(source, key) {
  const { pattern, label } = FIELDS[key];
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags))];
  if (matches.length === 0) {
    fail(
      `could not find ${label} in the config. Expected a line like "${key}: ...,". ` +
        'app.config.ts was restructured - update scripts/bump-version.mjs before releasing.'
    );
  }
  if (matches.length > 1) {
    fail(
      `found ${matches.length} candidates for ${label} in the config; refusing to guess. ` +
        'Update scripts/bump-version.mjs so the match is unambiguous.'
    );
  }
  return { match: matches[0], value: matches[0][2] };
}

function replaceField(source, key, nextValue) {
  const { pattern } = FIELDS[key];
  return source.replace(
    new RegExp(pattern.source, pattern.flags),
    (_full, prefix, _old, suffix) => `${prefix}${nextValue}${suffix}`
  );
}

function main(argv) {
  const args = argv.slice(2);
  const dryRun = args.includes('--dry-run');

  const configIndex = args.indexOf('--config');
  if (configIndex !== -1 && !args[configIndex + 1]) {
    fail('--config needs a path argument.');
  }
  const configPath =
    configIndex === -1 ? DEFAULT_CONFIG : resolve(process.cwd(), args[configIndex + 1]);

  // Anything left over that is not a flag or the --config value is the version.
  //
  // NOTE the `configIndex !== -1` guard. Without it, `indexOf` returning -1 for
  // an absent `--config` made this skip index `-1 + 1 === 0`, i.e. the FIRST
  // positional argument - so `bump-version.mjs 1.1.0` silently dropped the
  // version, bumped only the codes, and exited 0. It also let a malformed or
  // duplicated version through unvalidated.
  const configValueIndex = configIndex === -1 ? -1 : configIndex + 1;
  const positional = args.filter(
    (arg, i) => !arg.startsWith('--') && i !== configValueIndex
  );
  if (positional.length > 1) {
    fail(`expected at most one version argument, got: ${positional.join(', ')}`);
  }
  const requestedVersion = positional[0];

  if (requestedVersion && !/^\d+\.\d+\.\d+$/.test(requestedVersion)) {
    fail(
      `"${requestedVersion}" is not a three-part version (MAJOR.MINOR.PATCH). ` +
        'Play shows this string to users; keep it numeric, e.g. 1.1.0.'
    );
  }

  let source;
  try {
    source = readFileSync(configPath, 'utf8');
  } catch (error) {
    fail(`could not read ${configPath}: ${error.message}`);
  }

  const current = { version: readField(source, 'version').value };
  const next = { version: requestedVersion ?? current.version };

  // Called with no version: report, change nothing. Useful for checking what a
  // build is about to ship as.
  if (!requestedVersion) {
    console.log(`version            ${current.version}`);
    console.log(`build number       ${resolveBuildNumber()}  (derived now; every build gets a fresh one)`);
    console.log('\nPass a version to change it, e.g. `npm run bump 1.1.0`.');
    return;
  }

  if (requestedVersion) {
    const asTuple = (v) => v.split('.').map(Number);
    const [curMajor, curMinor, curPatch] = asTuple(current.version);
    const [nxtMajor, nxtMinor, nxtPatch] = asTuple(next.version);
    const curRank = curMajor * 1e6 + curMinor * 1e3 + curPatch;
    const nxtRank = nxtMajor * 1e6 + nxtMinor * 1e3 + nxtPatch;
    if (nxtRank < curRank) {
      fail(
        `refusing to move version backwards: ${current.version} -> ${next.version}. ` +
          'Play shows version names in order and users read a downgrade as a mistake.'
      );
    }
  }

  let updated = source;
  for (const key of Object.keys(FIELDS)) {
    updated = replaceField(updated, key, next[key]);
  }

  // Self-check: re-read the rewritten text and confirm every field landed.
  for (const key of Object.keys(FIELDS)) {
    const written = readField(updated, key).value;
    if (written !== next[key]) {
      fail(`internal error: ${FIELDS[key].label} did not update (still "${written}").`);
    }
  }

  const line = `  version  ${current.version}  ->  ${next.version}`;

  if (dryRun) {
    console.log(`set-version: DRY RUN, nothing written to ${configPath}`);
    console.log(line);
    return;
  }

  writeFileSync(configPath, updated, 'utf8');
  console.log(`set-version: updated ${configPath}`);
  console.log(line);
  console.log(
    '\nCommit app.config.ts — the version name is tracked.\n' +
      'The build number is not: it is derived at build time and needs nothing from you.\n' +
      '\nThen build:\n' +
      '  npm run prebuild                  # android\n' +
      '  cd android && ./gradlew :app:bundleRelease'
  );
}

main(process.argv);
