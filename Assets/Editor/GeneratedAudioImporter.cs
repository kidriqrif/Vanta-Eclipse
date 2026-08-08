using UnityEditor;
using UnityEngine;

namespace VantaEclipse.EditorTools
{
    /// <summary>
    /// Import settings for the generated WAVs.
    ///
    /// Same reasoning as PixelArtImporter: settings live in code so a
    /// regenerated asset cannot come back wrong, since make_audio.py rewrites
    /// these files whenever the sound design changes.
    ///
    /// The split matters on a phone. The 15 SFX are tiny and fire on taps, so
    /// they decompress once at load and cost nothing to play; the 1 MB drone
    /// streams instead, because loading it into memory uncompressed would cost
    /// more RAM than the rest of the game's audio combined for a track that is
    /// only ever played one way.
    /// </summary>
    public sealed class GeneratedAudioImporter : AssetPostprocessor
    {
        const string AudioRoot = "Assets/Resources/Audio/";

        void OnPreprocessAudio()
        {
            if (!assetPath.StartsWith(AudioRoot)) return;

            var importer = (AudioImporter)assetImporter;
            bool isMusic = assetPath.StartsWith(AudioRoot + "music/");

            var settings = importer.defaultSampleSettings;
            settings.loadType = isMusic
                ? AudioClipLoadType.Streaming
                : AudioClipLoadType.DecompressOnLoad;

            // Vorbis for the drone (24s, and lossy is inaudible on a pad),
            // PCM for the one-shots — they are milliseconds long, so a codec
            // saves nothing and adds decode latency to the tap sound, which is
            // the one sound in the game that must feel instant.
            settings.compressionFormat = isMusic
                ? AudioCompressionFormat.Vorbis
                : AudioCompressionFormat.PCM;
            if (isMusic) settings.quality = 0.7f;

            // Per-platform since Unity 6; the importer-level property of the
            // same name is obsolete and errors as of 6000.5.
            settings.preloadAudioData = !isMusic;

            importer.defaultSampleSettings = settings;
            importer.forceToMono = true;   // every generated file is mono already
        }
    }
}
