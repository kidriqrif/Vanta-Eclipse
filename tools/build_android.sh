#!/usr/bin/env bash
# Build the Android artifacts.
#
#   bash tools/build_android.sh debug     -> build/vanta-eclipse.apk
#   bash tools/build_android.sh release   -> build/vanta-eclipse.aab   (Play)
#
# The toolchain lives outside the repo and is NOT discoverable from PATH on
# this machine, so every path is stated here rather than assumed. If you move
# any of them, this script is the one place to change.
#
# Signing: the release keystore password lives in a gitignored file outside the
# repo and is passed to BuildAndroid.ApplySigning as a PATH, never as a value —
# an argument is readable in the process list for the whole build. It is never
# written into ProjectSettings, which is tracked; BuildAndroid clears the
# fields in a finally so an editor exit cannot persist them.
#
# This used to say Unity read the four keystore arguments itself, "through the
# documented CLI arguments". It does not — no such argument exists in
# 6000.5.7f1 — so they were silently ignored and a release build came out
# signed with the debug key. BuildAndroid.ApplySigning is what reads them now.
set -uo pipefail

UNITY="${UNITY:-/c/Program Files/Unity/Hub/Editor/6000.5.7f1/Editor/Unity.exe}"
export JAVA_HOME="${JAVA_HOME:-C:/Users/kidri/dev-tools/jdk-17}"
export ANDROID_HOME="${ANDROID_HOME:-C:/Users/kidri/Android/Sdk}"
export PATH="/c/Users/kidri/dev-tools/jdk-17/bin:$PATH"

KEYSTORE="${KEYSTORE:-C:/Users/kidri/keystores/vanta-eclipse-upload.jks}"
# Drive-letter form, not /c/... — this path is handed to Unity, which is a
# Windows process and cannot open an MSYS path.
KEYSTORE_PW_FILE="${KEYSTORE_PW_FILE:-C:/Users/kidri/keystores/vanta-eclipse-upload.password.txt}"
KEY_ALIAS="${KEY_ALIAS:-upload}"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR" || exit 1
mkdir -p build

MODE="${1:-debug}"
LOG="build/unity-build-$MODE.log"

need() {
	[ -e "$1" ] || { printf 'missing: %s\n   %s\n' "$1" "$2" >&2; exit 1; }
}

need "$UNITY" "set UNITY=/path/to/Unity.exe"
need "$JAVA_HOME" "JDK 17 — Unity will not build Android without it"
need "$ANDROID_HOME/platform-tools" "run sdkmanager platform-tools"

case "$MODE" in
debug)
	# An APK, unsigned beyond Unity's debug key. This is the one to put on a
	# device first.
	METHOD="VantaEclipse.EditorTools.BuildAndroid.BuildApk"
	OUT="build/vanta-eclipse.apk"
	SIGN_ARGS=()
	;;
release)
	need "$KEYSTORE" "generate an upload keystore (see design/RELEASE-CHECKLIST.md §2)"
	need "$KEYSTORE_PW_FILE" "the keystore password file"
	METHOD="VantaEclipse.EditorTools.BuildAndroid.BuildAab"
	OUT="build/vanta-eclipse.aab"
	SIGN_ARGS=(
		-keystorePath "$KEYSTORE"
		-keystorePassFile "$KEYSTORE_PW_FILE"
		-keyaliasName "$KEY_ALIAS"
	)
	;;
*)
	echo "usage: $0 [debug|release]" >&2
	exit 2
	;;
esac

# IL2CPP takes minutes on a cold cache — expect 10+ on the first run and do not
# assume it has hung.
"$UNITY" -batchmode -quit -nographics \
	-projectPath "$PROJECT_DIR" \
	-buildTarget Android \
	-executeMethod "$METHOD" \
	"${SIGN_ARGS[@]}" \
	-logFile "$PROJECT_DIR/$LOG"
status=$?

if [ "$status" -ne 0 ] || [ ! -f "$OUT" ]; then
	echo "BUILD FAILED ($MODE) — see $LOG" >&2
	grep -E "error CS|BuildFailedException|Error building" "$LOG" | head -20 >&2
	exit 1
fi

printf '\n%s  %s bytes\n' "$OUT" "$(wc -c < "$OUT" | tr -d ' ')"

# Prove the artifact rather than trusting the exit code.
# -f, not -x. A .bat carries no executable bit under MSYS, so `[ -x ]` is false
# for apksigner and this entire block silently did nothing — including the
# launcher-activity guard, which is the one check here that has already caught
# a shipped defect. A skipped check that prints nothing looks exactly like a
# check that passed.
BT="$ANDROID_HOME/build-tools/36.0.0"
if [ "$MODE" = "debug" ] && [ -f "$BT/aapt2.exe" ]; then
	[ -f "$BT/apksigner.bat" ] && "$BT/apksigner.bat" verify --verbose "$OUT" | head -4
	"$BT/aapt2.exe" dump badging "$OUT" 2>/dev/null \
		| grep -E "^package|SdkVersion|uses-permission|native-code|launchable-activity"
	# An APK with no launcher activity installs and cannot be started, and
	# nothing upstream of here fails on it. It has happened once already.
	if ! "$BT/aapt2.exe" dump badging "$OUT" 2>/dev/null | grep -q "^launchable-activity"; then
		echo "NO LAUNCHABLE ACTIVITY in $OUT — see Assets/Plugins/Android/AndroidManifest.xml" >&2
		exit 1
	fi
fi

if [ "$MODE" = "release" ]; then
	KEYTOOL="$JAVA_HOME/bin/keytool"
	JARSIGNER="$JAVA_HOME/bin/jarsigner"
	"$JARSIGNER" -verify "$OUT" | head -2

	# "jar verified" is ALSO true of a debug-signed bundle, which is the exact
	# failure this script shipped for months. The fingerprint comparison is the
	# part that means anything.
	#
	# Both sides come from keytool -printcert / -list -v, because those are the
	# two commands that print a "SHA256:" line. jarsigner -certs does not print
	# a fingerprint at all — an earlier version of this block grepped it for
	# one, got an empty string on both sides, and compared "" to "".
	CERT="build/.signer-cert"
	python -c "import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);n=next(x for x in z.namelist() if x.upper().startswith('META-INF/') and x.upper().endswith(('.RSA','.DSA','.EC')));open(sys.argv[2],'wb').write(z.read(n))" \
		"$OUT" "$CERT" || { echo "no signature block in $OUT" >&2; exit 1; }
	got="$("$KEYTOOL" -printcert -file "$CERT" 2>/dev/null | grep -oE "SHA256: [0-9A-F:]+" | head -1)"
	want="$("$KEYTOOL" -list -v -keystore "$KEYSTORE" -alias "$KEY_ALIAS" \
		-storepass "$(cat "$KEYSTORE_PW_FILE")" 2>/dev/null \
		| grep -oE "SHA256: [0-9A-F:]+" | head -1)"
	rm -f "$CERT"
	printf 'keystore %s\nbundle   %s\n' "${want:-?}" "${got:-?}"
	if [ -z "$want" ] || [ "$want" != "$got" ]; then
		echo "SIGNER MISMATCH — the bundle is not signed with the upload key" >&2
		exit 1
	fi

	# aapt2 cannot read an AAB and bundletool is not installed here, but the
	# bundle's protobuf manifest still carries its strings in the clear, which
	# is enough to answer the only question that matters: is there something to
	# launch? A bundle without it installs and cannot be started.
	if ! python -c "import sys,zipfile;d=zipfile.ZipFile(sys.argv[1]).read('base/manifest/AndroidManifest.xml');sys.exit(0 if (b'UnityPlayerGameActivity' in d and b'android.intent.category.LAUNCHER' in d) else 1)" "$OUT"; then
		echo "NO LAUNCHER ACTIVITY in $OUT — see Assets/Plugins/Android/AndroidManifest.xml" >&2
		exit 1
	fi
	echo "launcher activity present, MAIN/LAUNCHER intent filter present"
fi
