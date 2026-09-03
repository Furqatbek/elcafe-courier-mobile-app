#!/usr/bin/env bash
#
# verify-aab.sh - inspect a release AAB before uploading it to Google Play.
#
# Everything here is read-only. It answers the five questions that account for
# almost every rejected or wasted upload:
#
#   1. Is it signed with the upload key, or did it fall back to the debug key?
#   2. Is versionCode higher than everything already on Play?
#   3. Does the merged manifest declare only the permissions we intend to ship?
#   4. Are the native libraries 16 KB page aligned?
#   5. Does it actually install and run on a real device?
#
# Usage:
#   scripts/verify-aab.sh [path/to/app-release.aab]
#
# Defaults to android/app/build/outputs/bundle/release/app-release.aab.
#
# Requirements (see docs/ANDROID_RELEASE.md for install instructions):
#   - JDK (jarsigner, keytool)        : always required
#   - bundletool                      : required; set BUNDLETOOL to the command
#   - Android SDK build-tools         : optional, for apksigner on the test APKs
#   - Android NDK llvm-readelf        : optional, for the 16 KB alignment check
#                                       (falls back to a pure-Python ELF reader)
#
# Environment:
#   BUNDLETOOL   command used to run bundletool.
#                Default: "bundletool" if on PATH, else "java -jar $BUNDLETOOL_JAR".
#   BUNDLETOOL_JAR  path to bundletool-all-*.jar.
#   ANDROID_HOME    Android SDK root, used to locate apksigner / llvm-readelf.
#
# Exit code is 0 only if every hard check passed.

set -uo pipefail

AAB="${1:-android/app/build/outputs/bundle/release/app-release.aab}"

RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; BOLD=$'\033[1m'; OFF=$'\033[0m'
if [ ! -t 1 ]; then RED=""; GREEN=""; YELLOW=""; BOLD=""; OFF=""; fi

FAILURES=0
WARNINGS=0

section() { printf '\n%s==> %s%s\n' "$BOLD" "$1" "$OFF"; }
pass()    { printf '%s  PASS%s  %s\n' "$GREEN" "$OFF" "$1"; }
fail()    { printf '%s  FAIL%s  %s\n' "$RED"   "$OFF" "$1"; FAILURES=$((FAILURES + 1)); }
warn()    { printf '%s  WARN%s  %s\n' "$YELLOW" "$OFF" "$1"; WARNINGS=$((WARNINGS + 1)); }
info()    { printf '        %s\n' "$1"; }

# ---------------------------------------------------------------- preflight --

if [ ! -f "$AAB" ]; then
  printf '%serror%s: no bundle at %s\n' "$RED" "$OFF" "$AAB" >&2
  printf 'Build one first:\n' >&2
  printf '  npx expo prebuild --platform android --clean\n' >&2
  printf '  cd android && ./gradlew :app:bundleRelease\n' >&2
  exit 2
fi

AAB_ABS="$(cd "$(dirname "$AAB")" && pwd)/$(basename "$AAB")"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -z "${BUNDLETOOL:-}" ]; then
  if command -v bundletool >/dev/null 2>&1; then
    BUNDLETOOL="bundletool"
  elif [ -n "${BUNDLETOOL_JAR:-}" ]; then
    BUNDLETOOL="java -jar $BUNDLETOOL_JAR"
  else
    BUNDLETOOL=""
  fi
fi

WORKDIR="$(mktemp -d)"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

printf '%sVerifying%s %s\n' "$BOLD" "$OFF" "$AAB_ABS"
info "size: $(du -h "$AAB_ABS" | cut -f1)"

# ------------------------------------------------------------- 1. signature --
#
# An AAB carries a JAR signature (v1), not an APK Signature Scheme v2/v3 block,
# so `apksigner verify` does NOT work on it - jarsigner is the right tool.
# Play re-signs the delivered APKs with the *app signing key* it holds; this
# check only proves the bundle carries a valid *upload* signature.

section "1. Signature (upload key, not the debug key)"

if command -v jarsigner >/dev/null 2>&1; then
  JS_OUT="$WORKDIR/jarsigner.txt"
  jarsigner -verify -verbose:summary -certs "$AAB_ABS" > "$JS_OUT" 2>&1

  if grep -q "jar is unsigned" "$JS_OUT"; then
    fail "the bundle is NOT SIGNED AT ALL"
    info "The release build type did not apply a signingConfig. Check that"
    info "plugins/withAndroidReleaseSigning ran during prebuild."
  elif grep -q "jar verified" "$JS_OUT"; then
    pass "jarsigner reports the bundle is signed and the signature verifies"
  else
    fail "jarsigner could not verify the bundle"
    grep -vE "^\s*$|Picked up JAVA_TOOL_OPTIONS" "$JS_OUT" | sed -n '1,15p' | sed 's/^/        /'
  fi

  # The debug keystore's certificate is always CN=Android Debug. If that string
  # appears, ZBR_UPLOAD_STORE_FILE was not set and the plugin fell back.
  if grep -qi "CN=Android Debug" "$JS_OUT"; then
    fail "signed with the ANDROID DEBUG certificate - Play will reject this bundle"
    info "ZBR_UPLOAD_STORE_FILE was not visible to Gradle. Fix ~/.gradle/gradle.properties and rebuild."
  else
    pass "not signed with the Android debug certificate"
  fi

  # keytool reads the signer certificate straight out of the signed jar.
  CERT_OUT="$WORKDIR/cert.txt"
  if keytool -printcert -jarfile "$AAB_ABS" > "$CERT_OUT" 2>/dev/null &&
     grep -q "SHA256:" "$CERT_OUT"; then
    info "Signer certificate:"
    grep -E "Owner:|Valid from:|SHA1:|SHA256:" "$CERT_OUT" | sed 's/^/          /'
    info "The SHA-256 above must match Play Console > Test and release > Setup >"
    info "App integrity > App signing > Upload key certificate."
  else
    warn "could not print the signer certificate with keytool -printcert -jarfile"
  fi
else
  fail "jarsigner not found - install a JDK (see docs/ANDROID_RELEASE.md section 1)"
fi

# ------------------------------------------------- 2. versionCode / version --

section "2. versionCode and versionName"

if [ -n "$BUNDLETOOL" ]; then
  VC="$($BUNDLETOOL dump manifest --bundle="$AAB_ABS" \
        --xpath=/manifest/@android:versionCode 2>/dev/null | tr -d '[:space:]')"
  VN="$($BUNDLETOOL dump manifest --bundle="$AAB_ABS" \
        --xpath=/manifest/@android:versionName 2>/dev/null | tr -d '[:space:]')"
  PKG="$($BUNDLETOOL dump manifest --bundle="$AAB_ABS" \
        --xpath=/manifest/@package 2>/dev/null | tr -d '[:space:]')"

  if [ -n "$VC" ]; then
    pass "versionCode = $VC   versionName = $VN   package = $PKG"
    info "versionCode must be strictly greater than EVERY code already uploaded"
    info "to ANY track (internal, closed, open, production). Play never lets a"
    info "code be reused, even for a deleted or halted release."
  else
    fail "bundletool could not read the manifest"
  fi

  if [ "$PKG" != "app.zbr.courier" ]; then
    fail "package is '$PKG', expected 'app.zbr.courier'"
  else
    pass "applicationId matches app.zbr.courier"
  fi
else
  warn "bundletool not configured - skipping (set BUNDLETOOL or BUNDLETOOL_JAR)"
fi

# ---------------------------------------------------- 3. merged permissions --
#
# The permission list Play shows on the store listing is a MERGE of three
# sources, and only the first one is written by hand:
#
#   1. `android.permissions` in app.config.ts, plus whatever the config plugins
#      add on top (expo-location adds the location set, expo-audio adds
#      MODIFY_AUDIO_SETTINGS, expo adds INTERNET). Visible in
#      `npx expo config --type prebuild --json`.
#   2. Every dependency's own library AndroidManifest.xml, merged in by the
#      Android Gradle Plugin at build time. These NEVER appear in the resolved
#      config and never appear in android/app/src/main/AndroidManifest.xml -
#      only in the built artifact. expo-notifications alone contributes
#      POST_NOTIFICATIONS and RECEIVE_BOOT_COMPLETED this way, and expo-image
#      contributes ACCESS_NETWORK_STATE.
#   3. Maven AARs that are not in node_modules at all - firebase-messaging
#      (pulled by expo-notifications), play-services-maps/-location and
#      androidx.work (pulled by react-native-maps). Their manifests cannot be
#      read without a full Gradle dependency resolve, so this script cannot
#      predict them; it reports them and explains where they come from.
#
# A hardcoded "expected" list goes stale the moment a dependency is added or
# removed, and then cries wolf about permissions that are legitimately present.
# So nothing below is hardcoded: (1) and (2) are re-derived from the current
# tree on every run, and whatever is left over is reported as a decision to
# make, with its likely source named, rather than as a failure.

section "3. Merged manifest permissions"

DECLARED_F="$WORKDIR/declared.txt"; : > "$DECLARED_F"
BLOCKED_F="$WORKDIR/blocked.txt";   : > "$BLOCKED_F"
LIBRARY_F="$WORKDIR/library.txt";   : > "$LIBRARY_F"
ATTRIB_F="$WORKDIR/attrib.txt";     : > "$ATTRIB_F"
CFG_VC_F="$WORKDIR/config-vc.txt";  : > "$CFG_VC_F"
CONFIG_RESOLVED=0

# --- source 1: the resolved Expo config -------------------------------------
# Derived, not hardcoded, so this stays correct when a dependency that carries
# permissions (e.g. expo-image-picker and its CAMERA) is added or dropped.
if [ -d "$REPO_ROOT/node_modules/expo" ] && command -v node >/dev/null 2>&1; then
  if (cd "$REPO_ROOT" && npx --no-install expo config --type prebuild --json) \
       > "$WORKDIR/expo-config.json" 2>"$WORKDIR/expo-config.err"; then
    if node -e '
      const fs = require("fs");
      const cfg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      const q = (p) => (p.includes(".") ? p : "android.permission." + p);
      const uniq = (a) => [...new Set((a || []).map(q))].sort();
      fs.writeFileSync(process.argv[2], uniq(cfg?.android?.permissions).join("\n") + "\n");
      fs.writeFileSync(process.argv[3], uniq(cfg?.android?.blockedPermissions).join("\n") + "\n");
      fs.writeFileSync(process.argv[4], String(cfg?.android?.versionCode ?? ""));
    ' "$WORKDIR/expo-config.json" "$DECLARED_F" "$BLOCKED_F" "$CFG_VC_F" 2>/dev/null; then
      CONFIG_RESOLVED=1
    fi
  fi
fi

if [ "$CONFIG_RESOLVED" -eq 1 ]; then
  pass "resolved app.config.ts: $(grep -c . "$DECLARED_F") declared, $(grep -c . "$BLOCKED_F") blocked"
else
  warn "could not run 'npx expo config --type prebuild --json' in $REPO_ROOT"
  info "Without it the declared/blocked sets are unknown, so everything in the"
  info "bundle is reported as unclassified below. Run this script from a checkout"
  info "with node_modules installed to get the full comparison."
  [ -s "$WORKDIR/expo-config.err" ] && sed -n '1,5p' "$WORKDIR/expo-config.err" | sed 's/^/        /'
fi

# --- stale-artifact check: does the AAB match the config it claims to be from?
#
# The bump only runs as part of `npm run prebuild`. Running `npx expo prebuild`
# by hand skips it, and so does rebuilding with Gradle after a bump without
# re-running prebuild. Both produce an AAB whose versionCode is behind
# app.config.ts, which Play rejects at upload with "Version code N has already
# been used" - after the 10-40 minute build you just paid for. Catch it here.
CFG_VC="$(tr -d '[:space:]' < "$CFG_VC_F" 2>/dev/null || true)"
if [ "$CONFIG_RESOLVED" -eq 1 ] && [ -n "$CFG_VC" ] && [ -n "${VC:-}" ]; then
  if [ "$VC" = "$CFG_VC" ]; then
    pass "versionCode $VC matches app.config.ts - this AAB was built from the current config"
  elif [ "$VC" -lt "$CFG_VC" ] 2>/dev/null; then
    fail "STALE BUNDLE: AAB has versionCode $VC but app.config.ts says $CFG_VC"
    info "The bundle predates the last version bump, so it carries a code you have"
    info "probably already uploaded. Rebuild from the current config:"
    info "  npm run prebuild:nobump    # regenerate android/ WITHOUT another bump"
    info "  cd android && ./gradlew :app:bundleRelease"
    info "Use 'npm run prebuild' (which bumps) only when starting a NEW build."
  else
    warn "AAB versionCode $VC is AHEAD of app.config.ts ($CFG_VC)"
    info "app.config.ts was reverted, or the bundle came from a different checkout."
    info "Whatever ships must be the code recorded in git - reconcile before upload."
  fi
fi

# --- source 2: library manifests in node_modules ----------------------------
# Every <pkg>/android/src/main/AndroidManifest.xml. This is a slight
# over-approximation (it does not check autolinking), which is the safe
# direction: it can only suppress a false alarm, never hide a blocked
# permission - the blocked check below is exact and independent.
if [ -d "$REPO_ROOT/node_modules" ]; then
  while IFS= read -r m; do
    pkg="${m#"$REPO_ROOT/node_modules/"}"; pkg="${pkg%%/android/*}"
    grep -h 'uses-permission' "$m" 2>/dev/null \
      | grep -oE 'android:name="[^"]+"' | tr -d '"' | sed 's/^android:name=//' \
      | while IFS= read -r p; do printf '%s\t%s\n' "$p" "$pkg"; done
  done < <(find "$REPO_ROOT/node_modules" -maxdepth 5 \
             -path '*/android/src/main/AndroidManifest.xml' 2>/dev/null | sort) \
    | sort -u > "$ATTRIB_F"
  cut -f1 "$ATTRIB_F" | sort -u > "$LIBRARY_F"
  info "$(grep -c . "$LIBRARY_F") permission(s) declared by library manifests in node_modules"
else
  warn "no node_modules/ - cannot derive the library-merged permission set"
fi

# Names the node_modules package(s) that declare a permission, for the report.
attribute() {
  local p="$1" srcs
  srcs="$(awk -F'\t' -v p="$p" '$1==p {printf "%s ", $2}' "$ATTRIB_F")"
  if [ -n "$srcs" ]; then printf 'library manifest: %s' "${srcs% }"; else printf ''; fi
}

if [ -n "$BUNDLETOOL" ]; then
  $BUNDLETOOL dump manifest --bundle="$AAB_ABS" > "$WORKDIR/manifest.xml" 2>/dev/null

  # Match EVERY uses-permission, not just the android.permission.* ones - a
  # vendor permission (com.google.android.c2dm.permission.RECEIVE, an OEM badge
  # permission) shows on the listing exactly like a platform one, and the old
  # android-only regex here could not see them at all.
  grep -hE '<uses-permission(-sdk-23)?[^>]*' "$WORKDIR/manifest.xml" \
    | grep -oE 'android:name="[^"]+"' | tr -d '"' | sed 's/^android:name=//' \
    | sort -u > "$WORKDIR/actual-perms.txt"

  ACTUAL_N="$(grep -c . "$WORKDIR/actual-perms.txt")"

  sort -u "$DECLARED_F" "$LIBRARY_F" | grep . > "$WORKDIR/expected-perms.txt"
  # A blocked permission is never expected, even if a library declares it.
  if [ -s "$BLOCKED_F" ]; then
    comm -23 "$WORKDIR/expected-perms.txt" <(sort -u "$BLOCKED_F" | grep .) \
      > "$WORKDIR/expected-net.txt"
    mv "$WORKDIR/expected-net.txt" "$WORKDIR/expected-perms.txt"
  fi

  # ---- the report: every permission in the bundle, and why it is there ----
  info "$ACTUAL_N permission(s) in the merged manifest:"
  UNCLASSIFIED=""
  while IFS= read -r perm; do
    [ -z "$perm" ] && continue
    if grep -qxF "$perm" "$BLOCKED_F" 2>/dev/null; then
      printf '          %-56s %s\n' "$perm" "BLOCKED - must not be here"
    elif grep -qxF "$perm" "$DECLARED_F" 2>/dev/null; then
      printf '          %-56s %s\n' "$perm" "declared in app.config.ts"
    elif grep -qxF "$perm" "$LIBRARY_F" 2>/dev/null; then
      printf '          %-56s %s\n' "$perm" "$(attribute "$perm")"
    else
      printf '          %-56s %s\n' "$perm" "UNCLASSIFIED - see below"
      UNCLASSIFIED="$UNCLASSIFIED $perm"
    fi
  done < "$WORKDIR/actual-perms.txt"

  # ---- hard check: nothing blocked may survive the merge ----
  LEAKED=""
  while IFS= read -r perm; do
    [ -z "$perm" ] && continue
    grep -qxF "$perm" "$WORKDIR/actual-perms.txt" && LEAKED="$LEAKED $perm"
  done < "$BLOCKED_F"

  if [ -n "$LEAKED" ]; then
    fail "blocked permission(s) leaked into the merged manifest:$LEAKED"
    info "android.blockedPermissions in app.config.ts emits tools:node=\"remove\","
    info "so a leak means the merge directive did not reach the library manifest."
    info "Check that prebuild ran after the last app.config.ts edit."
  elif [ "$CONFIG_RESOLVED" -eq 1 ]; then
    pass "none of the $(grep -c . "$BLOCKED_F") blockedPermissions survived the merge"
  fi

  # ---- hard check: everything we declared actually shipped ----
  MISSING=""
  while IFS= read -r perm; do
    [ -z "$perm" ] && continue
    grep -qxF "$perm" "$WORKDIR/actual-perms.txt" || MISSING="$MISSING $perm"
  done < "$DECLARED_F"

  if [ -n "$MISSING" ]; then
    fail "declared permission(s) missing from the merged manifest:$MISSING"
    info "app.config.ts asks for these but the bundle does not have them, so the"
    info "matching feature will fail at runtime. Usually a stale android/ -"
    info "rerun 'npx expo prebuild --platform android --clean' and rebuild."
  elif [ "$CONFIG_RESOLVED" -eq 1 ]; then
    pass "all $(grep -c . "$DECLARED_F") declared permissions are present"
  fi

  # ---- soft check: explain the leftovers instead of crying wolf ----
  if [ -n "$UNCLASSIFIED" ]; then
    warn "permission(s) not traceable to app.config.ts or a node_modules manifest:"
    for perm in $UNCLASSIFIED; do printf '            %s\n' "$perm"; done
    info "This is NOT automatically a problem. The usual source is a Maven AAR,"
    info "which this script cannot read without a Gradle resolve:"
    info "  WAKE_LOCK, RECEIVE_BOOT_COMPLETED, ACCESS_NETWORK_STATE  androidx.work"
    info "                                            (via react-native-maps)"
    info "  com.google.android.c2dm.permission.RECEIVE  firebase-messaging"
    info "                                            (via expo-notifications)"
    info "  ACCESS_NETWORK_STATE                       play-services-maps"
    info "Find the real source with:"
    info "  cd android && ./gradlew :app:dependencies --configuration releaseRuntimeClasspath"
    info "Then decide, per permission: keep it and cover it in Data safety, or add"
    info "it to android.blockedPermissions in app.config.ts and rebuild."
  elif [ "$CONFIG_RESOLVED" -eq 1 ]; then
    pass "every permission in the bundle traces to app.config.ts or a library manifest"
  fi

  # ---- informational: expected but absent ----
  ABSENT="$(comm -23 "$WORKDIR/expected-perms.txt" "$WORKDIR/actual-perms.txt")"
  if [ -n "$ABSENT" ]; then
    info "declared by a library in node_modules but NOT in the bundle (fine - the"
    info "library is not autolinked into the release variant):"
    printf '%s\n' "$ABSENT" | sed 's/^/            /'
  fi

  # ACCESS_BACKGROUND_LOCATION is the highest-risk declaration on this app.
  if grep -qxF "android.permission.ACCESS_BACKGROUND_LOCATION" "$WORKDIR/actual-perms.txt"; then
    warn "ACCESS_BACKGROUND_LOCATION is declared"
    info "Play requires a background-location declaration form, a prominent"
    info "in-app disclosure shown BEFORE the permission request, and a demo"
    info "video. See docs/PLAY_STORE_SUBMISSION.md. The store listing must also"
    info "carry the disclosure sentence - check with:"
    info "  python3 store-assets/check_copy.py"
  fi
else
  warn "bundletool not configured - skipping (set BUNDLETOOL or BUNDLETOOL_JAR)"
  info "The declared/blocked/library sets above were still derived, so you can"
  info "sanity-check them without a bundle."
fi

# ----------------------------------------------- 4. 16 KB page-size aligned --
#
# Google Play requires apps targeting Android 15+ to support 16 KB memory
# pages. Every LOAD segment in every bundled .so must be aligned to at least
# 0x4000 (16384). RN 0.81 / Expo SDK 54 ship 16 KB-aligned prebuilts, but a
# third-party native module can still drag in a 4 KB-aligned library.

section "4. 16 KB page-size alignment of native libraries"

rm -rf "$WORKDIR/aab" && mkdir -p "$WORKDIR/aab"
unzip -q -o "$AAB_ABS" 'base/lib/*' -d "$WORKDIR/aab" 2>/dev/null

mapfile -t SOFILES < <(find "$WORKDIR/aab" -name '*.so' 2>/dev/null | sort)

if [ "${#SOFILES[@]}" -eq 0 ]; then
  warn "no .so files found under base/lib/ - nothing to check"
else
  info "${#SOFILES[@]} native libraries found"

  # ZBR_ELF_READER=python forces the built-in reader (used to test that path
  # on machines that happen to have llvm-readelf installed).
  READELF=""
  if [ "${ZBR_ELF_READER:-}" != "python" ]; then
  for candidate in \
    "${ANDROID_HOME:-}/ndk"/*/toolchains/llvm/prebuilt/*/bin/llvm-readelf \
    "${ANDROID_NDK_HOME:-}/toolchains/llvm/prebuilt"/*/bin/llvm-readelf; do
    if [ -x "$candidate" ]; then READELF="$candidate"; break; fi
  done
  if [ -z "$READELF" ] && command -v llvm-readelf >/dev/null 2>&1; then
    READELF="llvm-readelf"
  fi
  if [ -z "$READELF" ] && command -v readelf >/dev/null 2>&1; then
    READELF="readelf"
  fi
  fi

  MISALIGNED=0
  CHECKED=0

  if [ -n "$READELF" ]; then
    info "using $READELF"
    for so in "${SOFILES[@]}"; do
      # Every PT_LOAD segment's alignment must be >= 0x4000.
      WORST="$("$READELF" -lW "$so" 2>/dev/null \
        | awk '$1=="LOAD" {print $NF}' \
        | while read -r a; do printf '%d\n' "$a" 2>/dev/null || true; done \
        | sort -n | head -1)"
      CHECKED=$((CHECKED + 1))
      if [ -z "$WORST" ]; then
        warn "could not read LOAD segments of ${so#"$WORKDIR/aab/"}"
      elif [ "$WORST" -lt 16384 ]; then
        fail "${so#"$WORKDIR/aab/"} aligned to $WORST bytes (need >= 16384)"
        MISALIGNED=$((MISALIGNED + 1))
      fi
    done
  else
    # Pure-Python fallback: parse the ELF program headers directly. No NDK
    # needed, and it reads the same p_align field llvm-readelf prints.
    if command -v python3 >/dev/null 2>&1; then
      info "no llvm-readelf found - using the built-in Python ELF reader"
      PY_OUT="$WORKDIR/align.txt"
      python3 - "${SOFILES[@]}" > "$PY_OUT" 2>&1 <<'PYEOF'
import struct, sys

PT_LOAD = 1
for path in sys.argv[1:]:
    try:
        with open(path, 'rb') as fh:
            data = fh.read()
        if data[:4] != b'\x7fELF':
            print(f"SKIP\t{path}\tnot an ELF file")
            continue
        is64 = data[4] == 2
        little = data[5] == 1
        end = '<' if little else '>'
        if is64:
            e_phoff, = struct.unpack_from(end + 'Q', data, 0x20)
            e_phentsize, e_phnum = struct.unpack_from(end + 'HH', data, 0x36)
            align_off, fmt = 0x30, end + 'Q'
        else:
            e_phoff, = struct.unpack_from(end + 'I', data, 0x1C)
            e_phentsize, e_phnum = struct.unpack_from(end + 'HH', data, 0x2A)
            align_off, fmt = 0x1C, end + 'I'
        worst = None
        for i in range(e_phnum):
            base = e_phoff + i * e_phentsize
            p_type, = struct.unpack_from(end + 'I', data, base)
            if p_type != PT_LOAD:
                continue
            p_align, = struct.unpack_from(fmt, data, base + align_off)
            worst = p_align if worst is None else min(worst, p_align)
        if worst is None:
            print(f"SKIP\t{path}\tno PT_LOAD segments")
        else:
            print(f"{'OK' if worst >= 16384 else 'BAD'}\t{path}\t{worst}")
    except Exception as exc:  # noqa: BLE001 - report and keep going
        print(f"SKIP\t{path}\t{exc}")
PYEOF
      while IFS=$'\t' read -r status path value; do
        CHECKED=$((CHECKED + 1))
        case "$status" in
          BAD) fail "${path#"$WORKDIR/aab/"} aligned to $value bytes (need >= 16384)"
               MISALIGNED=$((MISALIGNED + 1)) ;;
          SKIP) warn "${path#"$WORKDIR/aab/"}: $value" ;;
        esac
      done < "$PY_OUT"
    else
      warn "no llvm-readelf and no python3 - cannot check alignment"
    fi
  fi

  if [ "$CHECKED" -gt 0 ] && [ "$MISALIGNED" -eq 0 ]; then
    pass "all $CHECKED native libraries have 16 KB (or larger) aligned LOAD segments"
  fi
fi

# Uncompressed native libs are what make 16 KB alignment work at runtime.
# expo.useLegacyPackaging=false (the SDK 54 default) produces this.
if [ -f "$REPO_ROOT/android/gradle.properties" ]; then
  if grep -q '^expo.useLegacyPackaging=false' "$REPO_ROOT/android/gradle.properties"; then
    pass "expo.useLegacyPackaging=false (native libs stored uncompressed)"
  else
    warn "expo.useLegacyPackaging is not explicitly false in android/gradle.properties"
  fi
fi

# ------------------------------------------------------ 5. install and test --

section "5. Install on a device (manual, not run automatically)"

BT_DISPLAY="${BUNDLETOOL:-bundletool}"
APKS_OUT="$(dirname "$AAB_ABS")/zbr-release.apks"

cat <<EOF
        These steps need a connected device or emulator, so run them yourself:

          $BT_DISPLAY build-apks \\
            --bundle=$AAB_ABS \\
            --output=$APKS_OUT \\
            --ks=\$ZBR_KEYSTORE \\
            --ks-key-alias=zbr-upload \\
            --ks-pass=pass:\$ZBR_STORE_PASSWORD \\
            --key-pass=pass:\$ZBR_KEY_PASSWORD \\
            --connected-device

          $BT_DISPLAY install-apks --apks=$APKS_OUT

        --connected-device builds only the split APKs your attached device
        needs, which is exactly what Play would deliver to it. Drop the flag
        and add --mode=universal for one fat APK you can sideload anywhere.

        NOTE: these APKs are signed with your UPLOAD key. Play re-signs with
        the app signing key it holds, so the installed build's SHA-1/SHA-256
        differs from production. Anything keyed to a certificate fingerprint
        (Google Maps API key restrictions, Firebase SHA registration, App
        Links verification) must have BOTH fingerprints registered.
EOF

# ------------------------------------------------------------------ summary --

section "Summary"
if [ "$FAILURES" -eq 0 ]; then
  printf '%s  %s failure(s), %s warning(s) - safe to upload%s\n' "$GREEN" "$FAILURES" "$WARNINGS" "$OFF"
  exit 0
else
  printf '%s  %s failure(s), %s warning(s) - DO NOT UPLOAD%s\n' "$RED" "$FAILURES" "$WARNINGS" "$OFF"
  exit 1
fi
