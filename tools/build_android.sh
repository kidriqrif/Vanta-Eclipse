#!/usr/bin/env bash
# Build the Android artifacts.
#
#   bash tools/build_android.sh debug     -> build/vanta-eclipse-debug.apk
#   bash tools/build_android.sh release   -> build/vanta-eclipse.aab   (Play)
#
# The toolchain lives outside the repo and is NOT discoverable from PATH on
# this machine, so every path is stated here rather than assumed. If you move
# any of them, this script is the one place to change.
#
# Signing: the release keystore password is read from a gitignored file and
# passed through Godot's documented CI environment variables. It is never
# written into export_presets.cfg, which is tracked.
set -uo pipefail

GODOT="${GODOT:-/c/Users/kidri/Downloads/Godot_v4.7-stable_win64.exe/Godot_v4.7-stable_win64_console.exe}"
export JAVA_HOME="${JAVA_HOME:-C:/Users/kidri/dev-tools/jdk-17}"
export ANDROID_HOME="${ANDROID_HOME:-C:/Users/kidri/Android/Sdk}"
export PATH="/c/Users/kidri/dev-tools/jdk-17/bin:$PATH"

KEYSTORE="${KEYSTORE:-C:/Users/kidri/keystores/vanta-eclipse-upload.jks}"
KEYSTORE_PW_FILE="${KEYSTORE_PW_FILE:-/c/Users/kidri/keystores/vanta-eclipse-upload.password.txt}"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR" || exit 1
mkdir -p build

MODE="${1:-debug}"

need() {
	[ -e "$1" ] || { printf 'missing: %s\n   %s\n' "$1" "$2" >&2; exit 1; }
}

need "$GODOT" "set GODOT=/path/to/godot"
need "$JAVA_HOME" "JDK 17 — Godot 4.2+ will not build Android without it"
need "$ANDROID_HOME/platform-tools" "run sdkmanager platform-tools"
# The Gradle build refuses without this marker even when android/build exists.
need "$PROJECT_DIR/android/.build_version" \
	"reinstall the Android build template (Project > Install Android Build Template)"

case "$MODE" in
debug)
	# Prebuilt template, no plugins, debug keystore. This is the one to put on
	# a device first — it does not need Gradle and takes seconds, not minutes.
	"$GODOT" --headless --path . \
		--export-debug "Android Debug APK" build/vanta-eclipse-debug.apk
	status=$?
	OUT="build/vanta-eclipse-debug.apk"
	;;
release)
	need "$KEYSTORE" "generate an upload keystore (see design/RELEASE-CHECKLIST.md §2)"
	need "$KEYSTORE_PW_FILE" "the keystore password file"
	export GODOT_ANDROID_KEYSTORE_RELEASE_PATH="$KEYSTORE"
	export GODOT_ANDROID_KEYSTORE_RELEASE_USER="${KEYSTORE_USER:-upload}"
	GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD="$(cat "$KEYSTORE_PW_FILE")"
	export GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD
	# First run downloads the Gradle distribution and the whole dependency
	# tree — expect 10+ minutes and do not assume it has hung.
	"$GODOT" --headless --path . \
		--export-release "Android" build/vanta-eclipse.aab
	status=$?
	OUT="build/vanta-eclipse.aab"
	;;
*)
	echo "usage: $0 [debug|release]" >&2
	exit 2
	;;
esac

if [ "$status" -ne 0 ] || [ ! -f "$OUT" ]; then
	echo "BUILD FAILED ($MODE)" >&2
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
