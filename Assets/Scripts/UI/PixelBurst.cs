using System.Collections;
using UnityEngine;
using UnityEngine.UI;

namespace VantaEclipse.UI
{
    /// <summary>
    /// A one-shot burst of coloured motes, thrown from a point in UI space.
    ///
    /// Replaces the two CPUParticles2D emitters the game used: the cosmetic tap
    /// trail and the enemy death puff. Unity's ParticleSystem does not compose
    /// with a ScreenSpaceOverlay canvas — it renders in the scene, not in the UI
    /// draw order, so it lands either behind everything or in front of
    /// everything and never between two UI layers. A handful of short-lived
    /// Images animated by one coroutine sits in the draw order correctly and is
    /// cheaper than the machinery it replaces.
    ///
    /// Both emitters were one_shot with high explosiveness, which is what makes
    /// this equivalent rather than an approximation: every mote is launched on
    /// the same frame, so there is no emission rate to model.
    /// </summary>
    public sealed class PixelBurst : MonoBehaviour
    {
        /// <summary>The cosmetic tap trail. Deliberately small and short: it
        /// fires once per TAP (never on an auto-attack), so the finger sets the
        /// rate.</summary>
        public static readonly Settings Trail = new()
        {
            Count = 12,
            Lifetime = 0.45f,
            SpeedMin = 90f,
            SpeedMax = 240f,
            Gravity = -320f,
            SizeMin = 4f,
            SizeMax = 10f,
        };

        /// <summary>The death puff: wider, slower, and it drifts rather than
        /// falls — the body is collapsing, not scattering.</summary>
        public static readonly Settings Death = new()
        {
            Count = 18,
            Lifetime = 0.6f,
            SpeedMin = 60f,
            SpeedMax = 200f,
            Gravity = -120f,
            SizeMin = 5f,
            SizeMax = 12f,
        };

        public sealed class Settings
        {
            public int Count = 12;
            public float Lifetime = 0.45f;
            public float SpeedMin = 90f;
            public float SpeedMax = 240f;
            /// <summary>Godot's gravity ran positive down a Y-down axis; Unity's
            /// UI axis points up, so the same fall is negative here.</summary>
            public float Gravity = -320f;
            /// <summary>A mote is a few source pixels across. The art is drawn at
            /// 64px and shown at 8x, so a 2px mote would be invisible — these are
            /// sized in the same screen space as the sprites they fly off.</summary>
            public float SizeMin = 4f;
            public float SizeMax = 10f;
        }

        struct Mote
        {
            public RectTransform Rect;
            public Image Image;
            public Vector2 Velocity;
        }

        Mote[] _motes;
        Color _color;
        Settings _settings;

        /// <summary>Build and launch. The object destroys itself once the last
        /// mote has faded.</summary>
        public static void Spawn(Transform parent, Vector2 anchoredPosition,
                                 Color color, Settings settings = null)
        {
            if (parent == null) return;

            var go = new GameObject("PixelBurst", typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rect = (RectTransform)go.transform;
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.zero;
            rect.anchoredPosition = anchoredPosition;
            rect.sizeDelta = Vector2.zero;

            var burst = go.AddComponent<PixelBurst>();
            burst._color = color;
            burst._settings = settings ?? Trail;
            burst.Launch();
        }

        void Launch()
        {
            // Nothing here may take a tap — the whole point is that the combat
            // area stays live while the burst plays over it.
            var group = gameObject.AddComponent<CanvasGroup>();
            group.blocksRaycasts = false;
            group.interactable = false;

            _motes = new Mote[_settings.Count];
            for (int i = 0; i < _motes.Length; i++)
            {
                var go = new GameObject("Mote", typeof(RectTransform));
                go.transform.SetParent(transform, false);
                var rect = (RectTransform)go.transform;
                float size = Random.Range(_settings.SizeMin, _settings.SizeMax);
                rect.sizeDelta = new Vector2(size, size);

                var image = go.AddComponent<Image>();
                image.color = _color;
                image.raycastTarget = false;

                // Godot's spread of 180 degrees around UP is the whole circle.
                float angle = Random.Range(0f, Mathf.PI * 2f);
                float speed = Random.Range(_settings.SpeedMin, _settings.SpeedMax);
                _motes[i] = new Mote
                {
                    Rect = rect,
                    Image = image,
                    Velocity = new Vector2(Mathf.Cos(angle), Mathf.Sin(angle)) * speed,
                };
            }
            StartCoroutine(Play());
        }

        IEnumerator Play()
        {
            float elapsed = 0f;
            while (elapsed < _settings.Lifetime)
            {
                float delta = Time.deltaTime;
                elapsed += delta;
                float fade = 1f - Mathf.Clamp01(elapsed / _settings.Lifetime);

                for (int i = 0; i < _motes.Length; i++)
                {
                    _motes[i].Velocity += new Vector2(0f, _settings.Gravity * delta);
                    _motes[i].Rect.anchoredPosition += _motes[i].Velocity * delta;
                    // Fade over the mote's life so the burst dissolves rather
                    // than disappearing on a frame boundary.
                    var color = _color;
                    color.a *= fade;
                    _motes[i].Image.color = color;
                }
                yield return null;
            }
            Destroy(gameObject);
        }
    }
}
