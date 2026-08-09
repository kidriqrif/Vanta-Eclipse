using System.Collections.Generic;
using System.Globalization;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace VantaEclipse.EditorTools
{
    /// <summary>
    /// Turns the BMFont pair tools/make_font.py generates into a Unity Font
    /// asset.
    ///
    /// Unity has no BMFont importer, so a bitmap face has to become a
    /// "custom font" — a Font asset carrying a CharacterInfo per
    /// glyph and a material pointing at the atlas. This builds that, so the
    /// generator stays the single source of truth for the face and nothing is
    /// transcribed by hand.
    ///
    /// The atlas is authored as WHITE with an alpha mask, never as a palette
    /// colour, because UI.Text multiplies the glyph by the label's colour — any
    /// tint baked into the atlas would multiply against every colour the UI ever
    /// asks for.
    /// </summary>
    public static class PixelFontImporter
    {
        const string SourceFnt = "Assets/Resources/Fonts/vanta_pixel.fnt";
        const string SourcePng = "Assets/Resources/Fonts/vanta_pixel.png";
        const string MaterialPath = "Assets/Resources/Fonts/VantaPixel.mat";
        const string FontPath = "Assets/Resources/Fonts/VantaPixel.fontsettings";

        [MenuItem("Vanta Eclipse/Build Pixel Font")]
        public static void Build()
        {
            if (!File.Exists(SourceFnt))
            {
                Debug.LogError($"PixelFontImporter: no {SourceFnt}. Run: python tools/make_font.py");
                return;
            }

            var texture = AssetDatabase.LoadAssetAtPath<Texture2D>(SourcePng);
            if (texture == null)
            {
                Debug.LogError($"PixelFontImporter: no atlas at {SourcePng}.");
                return;
            }
            ConfigureAtlas();
            texture = AssetDatabase.LoadAssetAtPath<Texture2D>(SourcePng);

            int lineHeight = 11;
            int baseline = 7;
            int nativeSize = 9;
            float atlasWidth = texture.width;
            float atlasHeight = texture.height;
            var characters = new List<CharacterInfo>();

            foreach (var raw in File.ReadAllLines(SourceFnt))
            {
                var line = raw.Trim();
                if (line.StartsWith("common "))
                {
                    lineHeight = ReadInt(line, "lineHeight", lineHeight);
                    baseline = ReadInt(line, "base", baseline);
                    continue;
                }
                if (line.StartsWith("info "))
                {
                    nativeSize = ReadInt(line, "size", nativeSize);
                    continue;
                }
                if (!line.StartsWith("char ")) continue;

                int id = ReadInt(line, "id", -1);
                if (id < 0) continue;

                int x = ReadInt(line, "x", 0);
                int y = ReadInt(line, "y", 0);
                int width = ReadInt(line, "width", 0);
                int height = ReadInt(line, "height", 0);
                int xOffset = ReadInt(line, "xoffset", 0);
                int yOffset = ReadInt(line, "yoffset", 0);
                int advance = ReadInt(line, "xadvance", 0);

                // BMFont measures from the TOP-LEFT of the atlas and Unity's UVs
                // run from the BOTTOM-LEFT, so the V axis is flipped. Getting
                // this wrong renders every glyph upside down, which is the one
                // failure mode of a bitmap font that is unmistakable on sight.
                float u0 = x / atlasWidth;
                float u1 = (x + width) / atlasWidth;
                float v0 = 1f - (y + height) / atlasHeight;
                float v1 = 1f - y / atlasHeight;

                characters.Add(new CharacterInfo
                {
                    index = id,
                    advance = advance,
                    // Glyph rect in font units, relative to the baseline: Unity
                    // measures Y up from the baseline, BMFont measures yoffset
                    // down from the line top.
                    minX = xOffset,
                    maxX = xOffset + width,
                    maxY = baseline - yOffset,
                    minY = baseline - yOffset - height,
                    glyphWidth = width,
                    glyphHeight = height,
                    uvBottomLeft = new Vector2(u0, v0),
                    uvBottomRight = new Vector2(u1, v0),
                    uvTopLeft = new Vector2(u0, v1),
                    uvTopRight = new Vector2(u1, v1),
                });
            }

            if (characters.Count == 0)
            {
                Debug.LogError("PixelFontImporter: parsed no glyphs — is the .fnt text format?");
                return;
            }

            var material = AssetDatabase.LoadAssetAtPath<Material>(MaterialPath);
            if (material == null)
            {
                // GUI/Text Shader is the one that treats the atlas as an alpha
                // mask and multiplies by the vertex colour. UI/Default would
                // draw the atlas as an image and ignore the label's colour.
                material = new Material(Shader.Find("GUI/Text Shader"));
                AssetDatabase.CreateAsset(material, MaterialPath);
            }
            material.mainTexture = texture;
            EditorUtility.SetDirty(material);

            var font = AssetDatabase.LoadAssetAtPath<Font>(FontPath);
            if (font == null)
            {
                font = new Font("VantaPixel");
                AssetDatabase.CreateAsset(font, FontPath);
            }
            font.material = material;
            font.characterInfo = characters.ToArray();

            // fontSize and lineSpacing are not settable through the public API
            // on a custom font — UI.Text divides the requested size by fontSize
            // to get its scale, so a zero here would render every label at the
            // wrong size or not at all.
            var serialized = new SerializedObject(font);
            serialized.FindProperty("m_FontSize").floatValue = nativeSize;
            serialized.FindProperty("m_LineSpacing").floatValue = lineHeight;
            serialized.FindProperty("m_Ascent").floatValue = baseline;
            serialized.FindProperty("m_CharacterSpacing").intValue = 0;
            serialized.FindProperty("m_CharacterPadding").intValue = 0;
            serialized.ApplyModifiedPropertiesWithoutUndo();

            EditorUtility.SetDirty(font);
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Debug.Log($"Pixel font built: {characters.Count} glyphs, size {nativeSize}, " +
                      $"line height {lineHeight}, atlas {texture.width}x{texture.height}.");
        }

        /// <summary>The atlas must import as an uncompressed, point-filtered,
        /// readable texture. Anything else resamples the glyphs — the exact
        /// failure the bitmap face exists to avoid.</summary>
        static void ConfigureAtlas()
        {
            var importer = AssetImporter.GetAtPath(SourcePng) as TextureImporter;
            if (importer == null) return;

            importer.textureType = TextureImporterType.GUI;
            importer.filterMode = FilterMode.Point;
            importer.mipmapEnabled = false;
            importer.alphaIsTransparency = true;
            importer.npotScale = TextureImporterNPOTScale.None;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.SaveAndReimport();
        }

        static int ReadInt(string line, string key, int fallback)
        {
            int at = line.IndexOf(key + "=", System.StringComparison.Ordinal);
            if (at < 0) return fallback;
            int start = at + key.Length + 1;
            int end = start;
            while (end < line.Length && !char.IsWhiteSpace(line[end])) end++;
            return int.TryParse(line.Substring(start, end - start),
                                NumberStyles.Integer, CultureInfo.InvariantCulture, out int value)
                ? value : fallback;
        }
    }
}
