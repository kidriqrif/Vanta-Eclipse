using UnityEditor;
using UnityEngine;

namespace VantaEclipse.EditorTools
{
    /// <summary>
    /// Forces correct import settings on every generated sprite.
    ///
    /// This is not a convenience. Unity's defaults destroy this project's art
    /// on contact: bilinear filtering blurs a 32x32 sprite into mush at any
    /// scale, and DXT compression invents colours — which breaks the hard
    /// invariant the whole pipeline is built on, that every pixel is one of
    /// exactly sixteen palette entries. tools/check_palette.py validates the
    /// PNGs on disk and would still pass while the game rendered off-palette,
    /// because the corruption happens at import, downstream of the file.
    ///
    /// Applying it here rather than through per-file .meta settings means a
    /// regenerated sprite cannot come back wrong: make_sprites.py writes the
    /// PNG, and the correct settings are reapplied on the reimport that
    /// follows.
    /// </summary>
    public sealed class PixelArtImporter : AssetPostprocessor
    {
        const string ArtRoot = "Assets/Resources/Art/";

        /// <summary>The sprites are authored at 1 art pixel = 1 texel, and the
        /// UI scales them in whole multiples. 32 keeps a 32x32 icon exactly one
        /// world unit, so nothing lands on a half-texel.</summary>
        const float PixelsPerUnit = 32f;

        void OnPreprocessTexture()
        {
            if (!assetPath.StartsWith(ArtRoot)) return;

            var importer = (TextureImporter)assetImporter;
            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.spritePixelsPerUnit = PixelsPerUnit;

            // The three that matter for pixel art.
            importer.filterMode = FilterMode.Point;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.mipmapEnabled = false;

            // A 16-colour sprite gains nothing from sRGB correction and can
            // lose exactness through it.
            importer.npotScale = TextureImporterNPOTScale.None;
            importer.alphaIsTransparency = true;
            importer.wrapMode = TextureWrapMode.Clamp;

            // Uncompressed on Android too — the platform override is what
            // actually ships, and leaving it at default reintroduces DXT/ETC on
            // device while the editor looks fine.
            var android = importer.GetPlatformTextureSettings("Android");
            android.overridden = true;
            android.format = TextureImporterFormat.RGBA32;
            android.textureCompression = TextureImporterCompression.Uncompressed;
            importer.SetPlatformTextureSettings(android);
        }
    }
}
