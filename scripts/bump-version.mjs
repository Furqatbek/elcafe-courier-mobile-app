#!/usr/bin/env node
/**
 * bump-version.mjs - keep app.config.ts's three version fields in lockstep.
 *
 * Without EAS there is no `autoIncrement`, so `version`, `android.versionCode`
 * and `ios.buildNumber` are edited by hand before every upload. Forgetting
 * `android.versionCode` is the single most common local-release mistake:
 * Google Play rejects an AAB whose versionCode has already been used, and the
 * only fix is to bump and rebuild.
 *
 * Usage:
 *   node scripts/bump-version.mjs                # build bump: versionCode +1, buildNumber +1
 *   node scripts/bump-version.mjs 1.1.0          # release bump: set version, then +1 both codes
 *   node scripts/bump-version.mjs --dry-run      # print the diff, write nothing
 *   node scripts/bump-version.mjs 1.1.0 --dry-run
 *   node scripts/bump-version.mjs --config /path/to/app.config.ts   # (testing)
 *
 * `version` is the user-visible version name in Play Console. `versionCode` is
 * the integer Play orders releases by; it must strictly increase and is never
 * reusable. `ios.buildNumber` is bumped alongside it purely to keep the two
 * platforms from drifting apart.
 *
 * The script edits the literals in place with anchored regexes and refuses to
 * run if any field is missing or matches more than once, so it can never
 * silently half-apply a bump.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CONFIG = resolve(__dirname, '..', 'app.config.ts');

/** Fields we rewrite, each with a regex that must match exactly once. */
const FIELDS = {
  version: {
    // e.g. "  version: '1.0.0'," at the top level of the ExpoConfig object.
    pattern: /^(\s*version:\s*')(\d+\.\d+\.\d+)('\s*,)$/gm,
    label: 'version (Play version name)',
  },
  versionCode: {
    // e.g. "    versionCode: 1," inside android: { ... }
    pattern: /^(\s*versionCode:\s*)(\d+)(\s*,)$/gm,
    label: 'android.versionCode',
  },
  buildNumber: {
    // e.g. "    buildNumber: '1'," inside ios: { ... }
    pattern: /^(\s*buildNumber:\s*')(\d+)('\s*,)$/gm,
    label: 'ios.buildNumber',
  },
};

function fail(message) {
  console.error(`bump-version: ${message}`);
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
  const positional = args.filter(
    (arg, i) => !arg.startsWith('--') && i !== configIndex + 1
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

  const current = {
    version: readField(source, 'version').value,
    versionCode: readField(source, 'versionCode').value,
    buildNumber: readField(source, 'buildNumber').value,
  };

  const next = {
    version: requestedVersion ?? current.version,
    versionCode: String(Number(current.versionCode) + 1),
    buildNumber: String(Number(current.buildNumber) + 1),
  };

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

  const lines = [
    `  version           ${current.version}  ->  ${next.version}`,
    `  android.versionCode ${current.versionCode}  ->  ${next.versionCode}`,
    `  ios.buildNumber     ${current.buildNumber}  ->  ${next.buildNumber}`,
  ];

  if (dryRun) {
    console.log(`bump-version: DRY RUN, nothing written to ${configPath}`);
    console.log(lines.join('\n'));
    return;
  }

  writeFileSync(configPath, updated, 'utf8');
  console.log(`bump-version: updated ${configPath}`);
  console.log(lines.join('\n'));
  console.log(
    '\nNext: confirm the resolved config, then rebuild.\n' +
      '  npx expo config --type prebuild --json | node -e "const c=JSON.parse(require(\'fs\').readFileSync(0,\'utf8\'));console.log(c.version, c.android.versionCode, c.ios.buildNumber)"\n' +
      '  npx expo prebuild --platform android --clean\n' +
      '  cd android && ./gradlew :app:bundleRelease'
  );
}

main(process.argv);
