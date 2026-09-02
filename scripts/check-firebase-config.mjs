#!/usr/bin/env node
/**
 * Validate google-services.json against this app before you build.
 *
 * The failure this exists to catch: a file downloaded from the WRONG Firebase
 * project, or registered under the wrong package name. Both produce an app that
 * builds and runs perfectly, obtains an FCM token happily, and never receives a
 * single push — because the token belongs to a project the backend does not
 * send from. Nothing in the build warns you.
 *
 *   node scripts/check-firebase-config.mjs
 *
 * Optionally pass the project id the backend sends from, and it will assert
 * they match:
 *
 *   node scripts/check-firebase-config.mjs --expect-project zbr-prod
 */

import { readFileSync, existsSync } from 'fs';

const EXPECTED_PACKAGE = 'app.zbr.courier';
const FILE = process.env.GOOGLE_SERVICES_JSON ?? './google-services.json';

const args = process.argv.slice(2);
const expectIdx = args.indexOf('--expect-project');
const expectedProject = expectIdx !== -1 ? args[expectIdx + 1] : null;

const fail = (msg) => {
  console.error(`\x1b[31m✖ ${msg}\x1b[0m`);
  process.exitCode = 1;
};
const ok = (msg) => console.log(`\x1b[32m✔\x1b[0m ${msg}`);

if (!existsSync(FILE)) {
  fail(`${FILE} not found.`);
  console.error(
    '\n  Download it from the Firebase console: Project settings → Your apps →\n' +
    `  the Android app registered as "${EXPECTED_PACKAGE}" → google-services.json,\n` +
    '  and save it at the repo root. It must come from the SAME Firebase project\n' +
    '  the backend sends push from.\n'
  );
  process.exit(1);
}

let cfg;
try {
  cfg = JSON.parse(readFileSync(FILE, 'utf8'));
} catch (err) {
  fail(`${FILE} is not valid JSON: ${err.message}`);
  process.exit(1);
}

const projectId = cfg?.project_info?.project_id;
const projectNumber = cfg?.project_info?.project_number;
if (!projectId) {
  fail('project_info.project_id is missing — this does not look like a google-services.json.');
  process.exit(1);
}
ok(`Firebase project: ${projectId} (number ${projectNumber ?? '?'})`);

// Every Android app registered in this file
const clients = Array.isArray(cfg.client) ? cfg.client : [];
const packages = clients
  .map((c) => c?.client_info?.android_client_info?.package_name)
  .filter(Boolean);

if (packages.length === 0) {
  fail('No Android client entries found in the file.');
} else if (packages.includes(EXPECTED_PACKAGE)) {
  ok(`Contains an Android client for ${EXPECTED_PACKAGE}`);
} else {
  fail(
    `No Android client for "${EXPECTED_PACKAGE}". Found: ${packages.join(', ')}\n` +
    '  Add an Android app with that exact package name in the Firebase console,\n' +
    '  then download the file again. FCM tokens are issued per (project, package):\n' +
    '  a mismatch means the app can never receive a push.'
  );
}

// An API key must be present or the Google Services Gradle plugin fails the build
const hasApiKey = clients.some((c) => Array.isArray(c?.api_key) && c.api_key.length > 0);
if (hasApiKey) {
  ok('API key present');
} else {
  fail('No api_key entry — the Google Services Gradle plugin will reject this file.');
}

if (expectedProject) {
  if (projectId === expectedProject) {
    ok(`Project matches the expected "${expectedProject}"`);
  } else {
    fail(
      `Project is "${projectId}" but the backend sends from "${expectedProject}".\n` +
      '  Push will be silently dead: tokens issued by one project cannot be\n' +
      '  delivered to by another. Get the file from the backend\'s project.'
    );
  }
} else {
  console.log(
    '\n  Confirm with the backend team that "' + projectId + '" is the project their\n' +
    '  Firebase Admin credentials belong to. Re-run with --expect-project <id> to\n' +
    '  assert it. This is the one mismatch that fails silently at runtime.\n'
  );
}

if (process.exitCode === 1) {
  console.error('\nDo not build for release until the above is fixed.\n');
} else {
  ok('google-services.json looks correct for this app.');
}
