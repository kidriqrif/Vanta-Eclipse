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
# Signing: the release keystore password is read from a gitignored file and
# passed to Unity through the documented CLI arguments. It is never written
# into ProjectSettings, which is tracked — the previous engine had exactly the
# same rule for exactly the same reason.
set -uo pipefail

UNITY="${UNITY:-/c/Program Files/Unity/Hub/Editor/6000.5.7f1/Editor/Unity.exe}"
export JAVA_HOME="${JAVA_HOME:-C:/Users/kidri/dev-tools/jdk-17}"
export ANDROID_HOME="${ANDROID_HOME:-C:/Users/kidri/Android/Sdk}"
export PATH="/c/Users/kidri/dev-tools/jdk-17/bin:$PATH"

KEYSTORE="${KEYSTORE:-C:/Users/kidri/keystores/vanta-eclipse-upload.jks}"
KEYSTORE_PW_FILE="${KEYSTORE_PW_FILE:-/c/Users/kidri/keystores/vanta-eclipse-upload.password.txt}"
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
	PW="$(cat "$KEYSTORE_PW_FILE")"
	METHOD="VantaEclipse.EditorTools.BuildAndroid.BuildAab"
	OUT="build/vanta-eclipse.aab"
	# Unity reads these four off the command line and never persists them.
	SIGN_ARGS=(
		-keystorePath "$KEYSTORE"
		-keystorePass "$PW"
		-keyaliasName "$KEY_ALIAS"
		-keyaliasPass "$PW"
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
BT="$ANDROID_HOME/build-tools/36.0.0"
if [ "$MODE" = "debug" ] && [ -x "$BT/apksigner.bat" ]; then
	"$BT/apksigner.bat" verify --verbose "$OUT" | head -4
	"$BT/aapt2.exe" dump badging "$OUT" 2>/dev/null \
		| grep -E "^package|targetSdkVersion|uses-permission|native-code"
fi
