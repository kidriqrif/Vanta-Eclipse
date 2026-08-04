#!/usr/bin/env python3
"""Synthesise the game's sound set.

The project shipped three working volume sliders and not one AudioStreamPlayer
— the sliders adjusted the volume of silence. This generates the sounds so
they adjust something.

Synthesised rather than sourced, for three reasons: the palette is one accent
on black and the audio should be as spare, every sound is regenerable from
this file so a tweak is an edit rather than a re-recording, and it keeps the
repo free of licensed assets whose terms would need auditing before release.

Design rules, in order of how much they matter:

  * The tap is played thousands of times per session. It is short, dark, and
    quiet, with no high-frequency spike — anything bright becomes torture by
    minute ten. AudioManager also randomises its pitch slightly per shot, so
    a held finger never produces a machine-gun of identical clicks.
  * Every clip fades in and out over at least 3ms. A waveform that starts or
    ends on a non-zero sample clicks, and that click is the cheapest-sounding
    thing a game can do.
  * Peak normalised to 0.72, not 1.0. Several of these can fire on the same
    frame (a crit that kills and drops loot), and summing three clips that
    each peak at full scale clips the master bus.

Run: python3 tools/make_audio.py
Out: audio/sfx/*.wav, audio/music/*.wav
"""

import math
import pathlib
import random
import struct
import wave

ROOT = pathlib.Path(__file__).resolve().parent.parent
SFX_DIR = ROOT / "audio" / "sfx"
MUSIC_DIR = ROOT / "audio" / "music"

SFX_RATE = 44100
# The drone has nothing above ~4kHz, so half the rate is transparent and
# halves the file. It is the largest audio asset in the build.
MUSIC_RATE = 22050

PEAK = 0.72
FADE_SECONDS = 0.003


# --- primitives ---------------------------------------------------------------


def silence(seconds: float, rate: int = SFX_RATE) -> list[float]:
    return [0.0] * int(seconds * rate)


def sine(buf: list[float], freq: float, amp: float, rate: int = SFX_RATE,
         phase: float = 0.0, sweep: float = 1.0) -> list[float]:
    """Add a sine, optionally sweeping to `freq * sweep` across the buffer."""
    n = len(buf)
    running = phase
    for i in range(n):
        f = freq * (1.0 + (sweep - 1.0) * (i / n))
        running += 2.0 * math.pi * f / rate
        buf[i] += amp * math.sin(running)
    return buf


def noise(buf: list[float], amp: float, rng: random.Random) -> list[float]:
    for i in range(len(buf)):
        buf[i] += amp * (rng.random() * 2.0 - 1.0)
    return buf


def decay(buf: list[float], tau: float, rate: int = SFX_RATE) -> list[float]:
    """Exponential fall — the shape of everything that gets struck."""
    for i in range(len(buf)):
        buf[i] *= math.exp(-(i / rate) / tau)
    return buf


def attack(buf: list[float], seconds: float, rate: int = SFX_RATE) -> list[float]:
    n = max(1, int(seconds * rate))
    for i in range(min(n, len(buf))):
        buf[i] *= i / n
    return buf


def lowpass(buf: list[float], alpha: float, warm: bool = False) -> list[float]:
    """One-pole filter. Takes the edge off raw noise so it reads as air rather
    than as static.

    `warm` runs the filter twice, seeding the second pass with the state the
    first pass ended on. For a looping buffer that matters: starting from zero
    leaves the first samples attenuated relative to the last, which is a step
    at the loop point — a filter can put a seam into a signal that was
    otherwise perfectly continuous.
    """
    last = 0.0
    if warm:
        for sample in buf:
            last += alpha * (sample - last)
    out = []
    for sample in buf:
        last += alpha * (sample - last)
        out.append(last)
    return out


def make_seamless(buf: list[float], loop_len: int, fade: int) -> list[float]:
    """Crossfade the material past the loop point back over the start.

    out[0] becomes buf[loop_len], which by construction is what follows
    out[-1] = buf[loop_len - 1]. That makes the wrap continuous by definition,
    whatever the components happened to be doing — insurance that does not
    depend on every frequency dividing the loop length exactly.

    Verify a loop by comparing the wrap step against the LOCAL steps beside
    it, never against the file's average. This drone sits on a steep part of a
    low-frequency slope at the seam, where neighbouring samples legitimately
    differ by ~512; measured against a whole-file mean of 105 that looks like a
    click, and it is not one.
    """
    out = list(buf[:loop_len])
    for i in range(fade):
        blend = i / fade
        out[i] = buf[i] * blend + buf[loop_len + i] * (1.0 - blend)
    return out


def normalise(buf: list[float], peak: float = PEAK) -> list[float]:
    high = max((abs(s) for s in buf), default=0.0)
    if high == 0.0:
        return buf
    scale = peak / high
    return [s * scale for s in buf]


def write(name: str, buf: list[float], directory: pathlib.Path,
          rate: int = SFX_RATE, loop: bool = False, peak: float = PEAK) -> None:
    buf = normalise(buf, peak)
    if not loop:
        # Edge fades for one-shots: several of these end mid-cycle by
        # construction, and a non-zero final sample clicks.
        #
        # Never for a loop. Fading a looping buffer to silence at both ends
        # does not remove a seam, it MAKES one — the drone would duck out
        # every 24 seconds, forever. A loop is kept continuous by building it
        # from whole cycles instead.
        edge = max(1, int(FADE_SECONDS * rate))
        for i in range(min(edge, len(buf))):
            buf[i] *= i / edge
            buf[-1 - i] *= i / edge
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / name
    with wave.open(str(path), "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(rate)
        out.writeframes(b"".join(
            struct.pack("<h", int(max(-1.0, min(1.0, s)) * 32767)) for s in buf
        ))
    print("  %-22s %5.2fs  %6.1f KB" % (
        name, len(buf) / rate, path.stat().st_size / 1024))


# --- the set ------------------------------------------------------------------


def tap_hit(rng: random.Random) -> list[float]:
    """The core interaction. Dark, 70ms, no top end."""
    buf = silence(0.07)
    sine(buf, 190.0, 0.9, sweep=0.55)      # the body, pitching down as it dies
    sine(buf, 95.0, 0.5, sweep=0.6)        # an octave under, for weight
    click = lowpass(noise(silence(0.012), 0.5, rng), 0.25)
    for i, s in enumerate(click):
        buf[i] += s
    return attack(decay(buf, 0.022), 0.001)


def crit_hit(rng: random.Random) -> list[float]:
    """The same strike with something bright on top — a crit has to be
    audible as a crit without being a different event."""
    buf = silence(0.16)
    sine(buf, 240.0, 0.8, sweep=0.6)
    sine(buf, 660.0, 0.35, sweep=1.35)     # the rising glint
    sine(buf, 990.0, 0.18, sweep=1.4)
    click = lowpass(noise(silence(0.02), 0.45, rng), 0.4)
    for i, s in enumerate(click):
        buf[i] += s
    return attack(decay(buf, 0.05), 0.001)


def enemy_death(rng: random.Random) -> list[float]:
    """A collapse, not an explosion. It fires on every kill, so it sits under
    the tap rather than over it."""
    buf = lowpass(noise(silence(0.3), 0.6, rng), 0.12)
    sine(buf, 150.0, 0.7, sweep=0.35)
    return attack(decay(buf, 0.09), 0.004)


def boss_defeat(rng: random.Random) -> list[float]:
    """Rare and earned: longer, lower, with a tail."""
    buf = silence(0.9)
    sine(buf, 110.0, 0.9, sweep=0.5)
    sine(buf, 55.0, 0.7, sweep=0.5)
    sine(buf, 220.0, 0.3, sweep=0.5)
    rumble = lowpass(noise(silence(0.9), 0.7, rng), 0.06)
    for i, s in enumerate(rumble):
        buf[i] += s * 0.6
    return attack(decay(buf, 0.32), 0.006)


def fanfare() -> list[float]:
    """Unlocks and level-ups. A rising minor triad — the game is not cheerful,
    and a major chord would belong to a different game."""
    buf = silence(0.75)
    for index, freq in enumerate([220.0, 261.63, 329.63, 440.0]):
        voice = silence(0.75)
        sine(voice, freq, 0.6)
        delay = int(index * 0.075 * SFX_RATE)
        voice = decay(attack(voice, 0.01), 0.3)
        for i in range(len(buf) - delay):
            buf[i + delay] += voice[i]
    return decay(buf, 0.55)


def confirm() -> list[float]:
    """Purchases, equips, upgrades. Two tones, up — small and definite."""
    buf = silence(0.12)
    sine(buf, 520.0, 0.5)
    second = silence(0.12)
    sine(second, 780.0, 0.45)
    second = decay(attack(second, 0.002), 0.05)
    offset = int(0.045 * SFX_RATE)
    for i in range(len(buf) - offset):
        buf[i + offset] += second[i]
    return attack(decay(buf, 0.06), 0.002)


def loot(rng: random.Random) -> list[float]:
    """A drop landing. Bright but tiny, so a rare item registers without
    interrupting the fight it dropped from."""
    buf = silence(0.28)
    sine(buf, 880.0, 0.4, sweep=1.5)
    sine(buf, 1320.0, 0.25, sweep=1.5)
    shimmer = lowpass(noise(silence(0.28), 0.25, rng), 0.6)
    for i, s in enumerate(shimmer):
        buf[i] += s * 0.35
    return attack(decay(buf, 0.1), 0.003)


def boss_warn(rng: random.Random) -> list[float]:
    """A boss appearing with a countdown was the tensest moment in the game and
    the only one with no sound at all.

    Deliberately NOT a fanfare: this is the single fail state the game has, and
    it has to read as a warning. A struck low bell, then a second an octave up
    arriving late enough to feel like an answer rather than a chord.
    """
    buf = silence(1.2)
    sine(buf, 98.0, 0.85, sweep=0.98)      # barely detuning — a bell, not a fall
    sine(buf, 147.0, 0.4, sweep=0.98)      # a fifth: hollow, unresolved
    strike = lowpass(noise(silence(0.05), 0.5, rng), 0.18)
    for i, s in enumerate(strike):
        buf[i] += s
    answer = silence(1.2)
    sine(answer, 196.0, 0.45, sweep=0.98)
    answer = decay(attack(answer, 0.004), 0.45)
    offset = int(0.34 * SFX_RATE)
    for i in range(len(buf) - offset):
        buf[i + offset] += answer[i]
    return attack(decay(buf, 0.55), 0.003)


def fail() -> list[float]:
    """The countdown expiring with the boss alive.

    Failure has to sound like something, not like nothing — silence reads as
    the game not having noticed. The fanfare's rising minor triad, inverted and
    slowed: the same intervals falling, so it is recognisably the shape of the
    reward sound going the wrong way.
    """
    buf = silence(0.9)
    for index, freq in enumerate([329.63, 261.63, 220.0]):
        voice = silence(0.9)
        sine(voice, freq, 0.55, sweep=0.97)
        delay = int(index * 0.085 * SFX_RATE)
        voice = decay(attack(voice, 0.008), 0.28)
        for i in range(len(buf) - delay):
            buf[i + delay] += voice[i]
    sine(buf, 82.0, 0.3, sweep=0.85)       # the floor dropping out underneath
    return decay(buf, 0.5)


def whoosh(rng: random.Random) -> list[float]:
    """Screens and modals. Played at three pitches from this one file — opening
    at 1.0, closing at 0.8, a scene change at 0.9 — because three near-identical
    recordings would cost three times the space to say the same thing.

    Filtered noise only, no tone: navigation should be felt and not listened
    to. At 340ms it is over before the transition finishes.
    """
    buf = lowpass(noise(silence(0.34), 0.7, rng), 0.09)
    # Swell and fall rather than a struck decay — a movement, not an impact.
    for i in range(len(buf)):
        phase = i / len(buf)
        buf[i] *= math.sin(math.pi * phase) ** 1.6
    return buf


def goal() -> list[float]:
    """A Journal goal reaching its target. The whole Journal was silent.

    Two rising notes, clean and short. Distinct from `loot` (which is a thing
    arriving) and from `fanfare` (which is permanent): this says progress, and
    a goal completes often enough that it must never be ceremonial.
    """
    buf = silence(0.3)
    sine(buf, 587.33, 0.45)
    second = silence(0.3)
    sine(second, 880.0, 0.4)
    second = decay(attack(second, 0.003), 0.09)
    offset = int(0.07 * SFX_RATE)
    for i in range(len(buf) - offset):
        buf[i + offset] += second[i]
    return attack(decay(buf, 0.1), 0.002)


def claim(rng: random.Random) -> list[float]:
    """Collecting something already earned — a claimed goal, an ad bonus, the
    offline reward waiting at launch.

    Warmer and longer than `loot`, because claiming is a deliberate act with a
    result, where a drop is something that merely happened to you.
    """
    buf = silence(0.45)
    for index, freq in enumerate([440.0, 659.25, 880.0]):
        voice = silence(0.45)
        sine(voice, freq, 0.4, sweep=1.02)
        delay = int(index * 0.035 * SFX_RATE)
        voice = decay(attack(voice, 0.003), 0.14)
        for i in range(len(buf) - delay):
            buf[i + delay] += voice[i]
    shimmer = lowpass(noise(silence(0.45), 0.3, rng), 0.55)
    for i, s in enumerate(shimmer):
        buf[i] += s * 0.2
    return attack(decay(buf, 0.16), 0.002)


def levelup() -> list[float]:
    """A pet gaining a level. Frequent, so it is 140ms and almost nothing — a
    blip that acknowledges without interrupting. The moment it becomes a jingle
    it becomes the reason someone turns the sound off."""
    buf = silence(0.14)
    sine(buf, 660.0, 0.4, sweep=1.5)
    return attack(decay(buf, 0.045), 0.002)


def eclipse() -> list[float]:
    """The Eclipse — a full prestige reset, and the biggest thing a player ever
    chooses to do.

    It was sharing the generic unlock fanfare, which made the game's defining
    act sound like picking up a relic. This is the one sound allowed to be
    slow: a swell inward, then a low struck bloom, so it reads as something
    closing rather than something being won.
    """
    total = 2.2
    buf = silence(total)
    # The swell: rising, quiet, gathering.
    swell = silence(total)
    sine(swell, 110.0, 0.5, sweep=1.5)
    sine(swell, 165.0, 0.3, sweep=1.5)
    for i in range(len(swell)):
        # Grows across the first 45%, then gets out of the way of the bloom.
        phase = min(1.0, (i / len(swell)) / 0.45)
        swell[i] *= phase ** 2.2 * max(0.0, 1.0 - max(0.0, phase - 0.92) * 12.0)
    for i, s in enumerate(swell):
        buf[i] += s
    # The bloom: low, wide, falling — arriving exactly where the swell stops.
    bloom = silence(total)
    sine(bloom, 55.0, 0.9, sweep=0.7)
    sine(bloom, 82.5, 0.5, sweep=0.7)
    sine(bloom, 220.0, 0.22, sweep=0.7)
    bloom = decay(attack(bloom, 0.006), 0.7)
    offset = int(0.42 * total * SFX_RATE)
    for i in range(len(buf) - offset):
        buf[i + offset] += bloom[i]
    return attack(buf, 0.004)


def click(rng: random.Random) -> list[float]:
    """Every button in the game. 45 of them across the screens, and pressing
    one made no sound at all unless it happened to complete a transaction.

    Written at roughly half the level of everything else (see the `peak`
    argument where this is written out), for two reasons. It is the most
    frequent sound in the game after the tap, and on a purchase it lands in the
    same frame as `confirm` — the click is the press being acknowledged and the
    confirm is the result, so the click has to sit underneath rather than
    compete with it.

    A tick, not a tone: 30ms, mostly filtered noise. Deliberately thinner and
    higher than `tap_hit`, because a button must not feel like hitting the
    enemy.
    """
    buf = silence(0.03)
    noise(buf, 0.6, rng)
    buf = lowpass(buf, 0.55)               # takes the hiss off without dulling it
    sine(buf, 1400.0, 0.25, sweep=0.7)     # just enough pitch to read as a surface
    return attack(decay(buf, 0.008), 0.0008)


def ambient_drone() -> list[float]:
    """A 24-second seamless loop for the Music bus.

    Every component completes a whole number of cycles inside the loop, so the
    end sample meets the start sample exactly and the seam is inaudible. That
    is the whole trick: a drone that ALMOST lines up is worse than no music,
    because the click arrives every 24 seconds forever.
    """
    seconds = 24.0
    n = int(seconds * MUSIC_RATE)
    fade = int(0.05 * MUSIC_RATE)
    # Generate past the loop point; make_seamless() folds the overhang back.
    total = n + fade
    buf = [0.0] * total

    def whole_cycles(freq: float) -> float:
        """Nearest frequency that fits a whole number of cycles in the loop."""
        return max(1.0, round(freq * seconds)) / seconds

    # A low drone plus a fifth, each doubled a few cents apart so the pair
    # beats slowly against itself and the pad never sits still.
    for base, amp in ((55.0, 0.55), (82.5, 0.32), (110.0, 0.2), (164.0, 0.1)):
        for detune, level in ((1.0, 1.0), (1.004, 0.85)):
            sine(buf, whole_cycles(base * detune), amp * level, rate=MUSIC_RATE)

    # A very slow swell, also a whole number of cycles, so the loudness drifts
    # instead of holding flat.
    for i in range(total):
        phase = 2.0 * math.pi * 2.0 * i / n   # exactly two swells per loop
        buf[i] *= 0.72 + 0.28 * (0.5 + 0.5 * math.sin(phase))

    return make_seamless(lowpass(buf, 0.22, warm=True), n, fade)


def main() -> int:
    rng = random.Random(0xEC112E)   # fixed, so regenerating gives byte-identical files
    print("sfx:")
    write("tap_hit.wav", tap_hit(rng), SFX_DIR)
    write("crit_hit.wav", crit_hit(rng), SFX_DIR)
    write("enemy_death.wav", enemy_death(rng), SFX_DIR)
    write("boss_defeat.wav", boss_defeat(rng), SFX_DIR)
    write("fanfare.wav", fanfare(), SFX_DIR)
    write("confirm.wav", confirm(), SFX_DIR)
    write("loot.wav", loot(rng), SFX_DIR)
    write("boss_warn.wav", boss_warn(rng), SFX_DIR)
    write("fail.wav", fail(), SFX_DIR)
    write("whoosh.wav", whoosh(rng), SFX_DIR)
    write("goal.wav", goal(), SFX_DIR)
    write("claim.wav", claim(rng), SFX_DIR)
    write("levelup.wav", levelup(), SFX_DIR)
    write("eclipse.wav", eclipse(), SFX_DIR)
    # Last, so every sound above draws the same random numbers it always has
    # and regenerating leaves their files byte-identical.
    write("click.wav", click(rng), SFX_DIR, peak=0.38)
    print("music:")
    write("ambient_void.wav", ambient_drone(), MUSIC_DIR, rate=MUSIC_RATE, loop=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
