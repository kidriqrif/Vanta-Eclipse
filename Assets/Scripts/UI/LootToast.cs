using System;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using VantaEclipse.Core;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Loot Toast (pattern §7.2) — a compact, non-blocking pickup pill.
    /// Rarity-coloured and self-freeing. Multiple quick drops collapse into one
    /// pill ("N items") rather than stacking; the gameplay screen manages that
    /// by holding on to the live toast and calling <see cref="AddItem"/>.
    /// Mythic drops use the Result Banner instead (handled by the caller).
    /// </summary>
    public sealed class LootToast : UIScreen
    {
        public const float HoldSeconds = 1.3f;
        /// <summary>Absolute ceiling on lifetime, so a sustained drop storm
        /// cannot keep the pill alive forever by restarting the hold.</summary>
        public const float MaxLifetime = 5f;
        public const float PopSeconds = 0.25f;
        public const float FadeSeconds = 0.25f;

        /// <summary>Raised as the toast leaves, so the screen holding it can
        /// drop its reference.</summary>
        public event Action Finished;

        int _rarity;
        int _count = 1;
        float _spawnedAt;
        Sprite _iconSprite;
        string _labelText = "";

        Coroutine _life;
        RectTransform _panel;
        CanvasGroup _panelGroup;
        Image _icon;
        Transform _pipHolder;
        Text _label;
        Image _border;

        protected override void Awake()
        {
            base.Awake();
            UILayers.Apply(gameObject, UILayers.Toast);
            // Nothing in a loot toast is interactive; taps must reach the combat
            // area underneath it.
            var group = GetComponent<CanvasGroup>() ?? gameObject.AddComponent<CanvasGroup>();
            group.blocksRaycasts = false;
            group.interactable = false;
        }

        /// <summary>Call immediately after spawning, before the first frame.</summary>
        public void Setup(Item item)
        {
            _rarity = item.Rarity;
            var slot = Game.Equipment.GetSlotDefinition(item.Slot);
            if (slot != null) _iconSprite = slot.icon;
            _labelText = $"{RarityStyle.Name(_rarity)} " +
                         $"{(slot != null ? slot.displayName : item.Slot)}";
        }

        void Start()
        {
            _spawnedAt = Time.unscaledTime;

            var panel = FindObject("ToastPanel");
            if (panel == null)
            {
                Destroy(gameObject);
                return;
            }
            _panel = (RectTransform)panel.transform;
            _panelGroup = panel.GetComponent<CanvasGroup>() ?? panel.AddComponent<CanvasGroup>();
            _border = EnsureBorder(panel);

            _icon = Find<Image>("ToastIcon");
            if (_icon != null) _icon.sprite = _iconSprite;
            _pipHolder = FindObject("PipHolder")?.transform;
            _label = Find<Text>("ToastLabel");

            Render();
            _panel.localScale = Vector3.zero;
            StartLife();
        }

        /// <summary>Fold another drop into this still-visible pill instead of
        /// stacking a second one on top of it.</summary>
        public void AddItem(Item item)
        {
            _count++;
            _rarity = Mathf.Max(_rarity, item.Rarity);
            Render();
            StartLife();   // restart the hold so the collapsed pill lingers
        }

        void Render()
        {
            if (_pipHolder != null)
            {
                for (int i = _pipHolder.childCount - 1; i >= 0; i--)
                    Destroy(_pipHolder.GetChild(i).gameObject);
                var pips = RarityStyle.MakePipRow(_rarity);
                pips.transform.SetParent(_pipHolder, false);
            }

            if (_label != null)
            {
                _label.text = _count > 1 ? $"{_count} items" : _labelText;
                _label.color = RarityStyle.Color(_rarity);
            }
            if (_icon != null) _icon.gameObject.SetActive(_count <= 1);
            // The border is the rarity signal; the soft glow that used to sit
            // behind it was the same colour spread over 10px of blur.
            if (_border != null) _border.color = RarityStyle.Color(_rarity);
        }

        /// <summary>
        /// An Image has no border, so the ring is a sibling image sitting one
        /// layer behind the panel fill and two pixels wider on every side —
        /// which is also what makes the border colour scriptable.
        /// </summary>
        static Image EnsureBorder(GameObject panel)
        {
            var existing = panel.transform.Find("RarityBorder");
            if (existing != null) return existing.GetComponent<Image>();

            var border = new GameObject("RarityBorder", typeof(RectTransform));
            border.transform.SetParent(panel.transform, false);
            border.transform.SetAsFirstSibling();
            var rect = (RectTransform)border.transform;
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.offsetMin = new Vector2(-2f, -2f);
            rect.offsetMax = new Vector2(2f, 2f);
            var image = border.AddComponent<Image>();
            image.raycastTarget = false;
            return image;
        }

        void StartLife()
        {
            // Past the absolute ceiling, stop restarting and let the running
            // coroutine reach its Destroy — a drop storm cannot outlast it.
            if (Time.unscaledTime - _spawnedAt > MaxLifetime) return;
            if (_life != null) StopCoroutine(_life);
            _panelGroup.alpha = 1f;
            _life = StartCoroutine(Live());
        }

        IEnumerator Live()
        {
            float elapsed = 0f;
            float from = _panel.localScale.x;
            while (elapsed < PopSeconds)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / PopSeconds);
                _panel.localScale = Vector3.one * Mathf.Lerp(from, 1f, BackOut(t));
                yield return null;
            }
            _panel.localScale = Vector3.one;

            yield return new WaitForSecondsRealtime(HoldSeconds);

            elapsed = 0f;
            while (elapsed < FadeSeconds)
            {
                elapsed += Time.unscaledDeltaTime;
                _panelGroup.alpha = 1f - Mathf.Clamp01(elapsed / FadeSeconds);
                yield return null;
            }

            Finished?.Invoke();
            Destroy(gameObject);
        }

        static float BackOut(float t)
        {
            const float c1 = 1.70158f;
            const float c3 = c1 + 1f;
            float inv = t - 1f;
            return 1f + c3 * inv * inv * inv + c1 * inv * inv;
        }
    }
}
