using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using VantaEclipse.Core;
using VantaEclipse.Data;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Renders the current enemy and plays its animations. Pure presentation:
    /// it reads combat state and reacts to EventBus signals, but never modifies
    /// combat state itself.
    ///
    /// Animation layers (kept on separate objects so the coroutines never
    /// fight over one transform):
    ///   GroundGlow   — the ground pool, counter-animated against the hover
    ///   SpriteHolder — spawn pop-in, idle hover, death collapse
    ///   EnemySprite  — hit squash, flash, and crit wiggle
    ///
    /// The sprite wears the PixelRim shader. Two things here feed it: the rim is
    /// retinted per enemy from EnemyDefinition.glowColor, and the ground glow
    /// below grounds the result — without it a lit sprite reads as a sticker
    /// floating on the backdrop, however good the shading is.
    ///
    /// It is a GLOW, not a shadow, and that is not a stylistic choice: the void
    /// backdrop is already near-black, so a dark contact shadow was invisible on
    /// it (confirmed by screenshotting a real run). These creatures emit light —
    /// pooling their own glowColor on the ground reads correctly AND is visible.
    /// </summary>
    public sealed class EnemyView : UIScreen
    {
        /// <summary>Over-1.0 on purpose: this multiplies the sprite's tint, so
        /// it blows the sprite out rather than tinting it. Red-dominant since
        /// the palette overhaul — the old value led on blue, which a saturation
        /// scan cannot catch because every channel clamps to white on the way
        /// out.</summary>
        public static readonly Color FlashColor = new(3f, 2f, 1.9f, 1f);

        // Ground-glow rest state, and how far it thins at the top of the hover.
        // Light falls off with distance, so a rising creature pools a smaller,
        // fainter glow; animating that against the bob is what turns a vertical
        // slide into an object leaving the ground.
        public const float GlowAlpha = 0.38f;
        public const float GlowLiftAlpha = 0.20f;
        public const float GlowLiftScale = 0.84f;

        public const float HoverHeight = 16f;
        public const float HoverSeconds = 1.4f;

        RectTransform _spriteHolder;
        CanvasGroup _spriteHolderGroup;
        RectTransform _sprite;
        Image _spriteImage;
        RectTransform _groundGlow;
        Image _groundGlowImage;

        Coroutine _idle;
        Coroutine _hit;

        /// <summary>What the definition asked for. Bosses render larger.</summary>
        float _wantedScale = 1f;

        /// <summary>
        /// The scale actually used, recomputed on every read.
        ///
        /// It cannot be resolved once and stored: the rects are still zero when
        /// the first enemy spawns, so a value computed then is the UNCAPPED one
        /// and the cap silently never applies. Every animation already reads
        /// this per frame, so a property costs nothing and is always current.
        /// </summary>
        float _baseScale => FitScale(_wantedScale);

        /// <summary>
        /// The largest multiple of the authored sprite box that still fits the
        /// canvas, never above the requested one.
        ///
        /// Measured against the CANVAS and not this view's own rect, because
        /// the sprite holder is free to scale past its parent — nothing clips
        /// it — so the parent's size says nothing about what will be visible.
        /// </summary>
        float FitScale(float wanted)
        {
            if (wanted <= 0f) return 1f;
            if (_spriteHolder == null) return wanted;

            var canvas = GetComponentInParent<Canvas>();
            if (canvas == null) return wanted;
            var frame = ((RectTransform)canvas.rootCanvas.transform).rect.size;

            var box = _spriteHolder.rect.size;
            if (box.x <= 0f || box.y <= 0f) return wanted;

            return Mathf.Min(wanted, frame.x / box.x, frame.y / box.y);
        }
        /// <summary>The glow tracks the same scale, so a boss pools a
        /// boss-sized light.</summary>
        float _glowScale => _baseScale;
        Color _glowColor = Color.white;

        /// <summary>One material instance per view, so retinting the rim for
        /// this enemy cannot leak into any other user of the shader. Without
        /// the instance, every enemy on screen shares one material and the last
        /// retint wins.</summary>
        Material _rimMaterial;

        void Start()
        {
            _spriteHolder = FindObject("SpriteHolder")?.transform as RectTransform;
            _sprite = FindObject("EnemySprite")?.transform as RectTransform;
            _groundGlow = FindObject("GroundGlow")?.transform as RectTransform;
            if (_spriteHolder == null || _sprite == null)
            {
                Debug.LogError("EnemyView: needs both SpriteHolder and EnemySprite.");
                enabled = false;
                return;
            }

            _spriteHolderGroup = _spriteHolder.GetComponent<CanvasGroup>()
                                 ?? _spriteHolder.gameObject.AddComponent<CanvasGroup>();
            _spriteImage = _sprite.GetComponent<Image>() ?? _sprite.gameObject.AddComponent<Image>();
            _spriteImage.preserveAspect = true;
            _spriteImage.raycastTarget = false;

            var shader = Resources.Load<Shader>("Shaders/PixelRim");
            if (shader != null)
            {
                _rimMaterial = new Material(shader);
                _spriteImage.material = _rimMaterial;
            }

            if (_groundGlow != null)
            {
                _groundGlowImage = _groundGlow.GetComponent<Image>()
                                   ?? _groundGlow.gameObject.AddComponent<Image>();
                _groundGlowImage.raycastTarget = false;
                if (_groundGlowImage.sprite == null)
                    _groundGlowImage.sprite = UISprites.Get("ui/ground_glow");
            }

            Game.Events.EnemySpawned += OnEnemySpawned;
            Game.Events.EnemyDamaged += OnEnemyDamaged;
            Game.Events.EnemyDied += OnEnemyDied;
            Game.Events.EnemyWithdrawn += OnEnemyWithdrawn;

            // The screen may open mid-fight (returning from the menu), so render
            // whatever CombatManager currently has.
            if (Game.Combat.IsEnemyAlive())
            {
                ShowEnemy(Game.Combat.GetEnemyDefinition());
                StartIdle();
            }
            else
            {
                _spriteHolderGroup.alpha = 0f;
                SetGlowAlpha(0f);
            }
        }

        void OnDestroy()
        {
            if (Game.IsBooted)
            {
                Game.Events.EnemySpawned -= OnEnemySpawned;
                Game.Events.EnemyDamaged -= OnEnemyDamaged;
                Game.Events.EnemyDied -= OnEnemyDied;
                Game.Events.EnemyWithdrawn -= OnEnemyWithdrawn;
            }
            // A material created with `new` is not owned by the AssetDatabase
            // and is not collected with the GameObject.
            if (_rimMaterial != null) Destroy(_rimMaterial);
        }

        // --- Signal handlers ---------------------------------------------------

        void OnEnemySpawned(EnemyDefinition definition, int level, float maxHp)
        {
            StopAnimations();
            ShowEnemy(definition);
            StartCoroutine(PlaySpawn());
        }

        IEnumerator PlaySpawn()
        {
            _spriteHolder.localScale = Vector3.one * (_baseScale * 0.5f);
            _spriteHolderGroup.alpha = 0f;
            SetGlowAlpha(0f);

            const float seconds = 0.3f;
            float elapsed = 0f;
            while (elapsed < seconds)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / seconds);
                _spriteHolder.localScale =
                    Vector3.one * Mathf.LerpUnclamped(_baseScale * 0.5f, _baseScale, BackOut(t));
                _spriteHolderGroup.alpha = Mathf.Clamp01(elapsed / 0.2f);
                // The pool arrives with the enemy; the idle hover then takes it over.
                SetGlowAlpha(Mathf.Lerp(0f, GlowAlpha, t));
                yield return null;
            }
            _spriteHolder.localScale = Vector3.one * _baseScale;
            _spriteHolderGroup.alpha = 1f;
            SetGlowAlpha(GlowAlpha);
            StartIdle();
        }

        void OnEnemyDamaged(float amount, bool isCrit, float hp, float maxHp)
        {
            if (_hit != null) StopCoroutine(_hit);
            _hit = StartCoroutine(PlayHit(isCrit));
        }

        IEnumerator PlayHit(bool isCrit)
        {
            _sprite.localScale = Vector3.one;
            _sprite.localRotation = Quaternion.identity;

            var squash = isCrit ? new Vector2(1.16f, 0.82f) : new Vector2(1.1f, 0.88f);
            const float squashIn = 0.05f;
            const float settle = 0.16f;
            const float flash = 0.2f;
            float critFrom = -0.06f * Mathf.Rad2Deg;
            float critTo = 0.09f * Mathf.Rad2Deg;

            float elapsed = 0f;
            while (elapsed < squashIn)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / squashIn);
                _sprite.localScale = Vector3.Lerp(Vector3.one, new Vector3(squash.x, squash.y, 1f), t);
                _spriteImage.color = Color.Lerp(FlashColor, Color.white,
                    Mathf.Clamp01(elapsed / flash));
                if (isCrit)
                    _sprite.localRotation = Quaternion.Euler(0f, 0f,
                        Mathf.Lerp(critFrom, critTo, Mathf.Clamp01(elapsed / 0.06f)));
                yield return null;
            }

            float squashElapsed = elapsed;
            elapsed = 0f;
            while (elapsed < settle)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / settle);
                float eased = BackOut(t);
                _sprite.localScale = new Vector3(
                    Mathf.LerpUnclamped(squash.x, 1f, eased),
                    Mathf.LerpUnclamped(squash.y, 1f, eased), 1f);
                _spriteImage.color = Color.Lerp(FlashColor, Color.white,
                    Mathf.Clamp01((squashElapsed + elapsed) / flash));
                if (isCrit)
                    _sprite.localRotation = Quaternion.Euler(0f, 0f, Mathf.Lerp(critTo, 0f, t));
                yield return null;
            }

            _sprite.localScale = Vector3.one;
            _sprite.localRotation = Quaternion.identity;
            _spriteImage.color = Color.white;
            _hit = null;
        }

        void OnEnemyDied(int level, int totalKills)
        {
            StopAnimations();
            _sprite.localScale = Vector3.one;
            _sprite.localRotation = Quaternion.identity;
            _spriteImage.color = Color.white;

            PixelBurst.Spawn(_spriteHolder.parent, _spriteHolder.anchoredPosition,
                _glowColor, PixelBurst.Death);
            StartCoroutine(PlayExit(0.3f, _baseScale * 0.05f, rotateTo: 0.3f * Mathf.Rad2Deg,
                glowSeconds: 0.22f));
        }

        /// <summary>The withdraw micro-state (M5 UX spec §4B): the enemy LEAVES
        /// — no particles, no rotation, pointedly not the death animation.</summary>
        void OnEnemyWithdrawn()
        {
            StopAnimations();
            _sprite.localScale = Vector3.one;
            _sprite.localRotation = Quaternion.identity;
            StartCoroutine(PlayExit(0.4f, _baseScale * 0.7f, rotateTo: 0f, glowSeconds: 0.4f));
        }

        IEnumerator PlayExit(float seconds, float targetScale, float rotateTo, float glowSeconds)
        {
            float fromScale = _spriteHolder.localScale.x;
            float fromAlpha = _spriteHolderGroup.alpha;
            float fromGlow = GlowCurrentAlpha();
            float elapsed = 0f;

            while (elapsed < seconds)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / seconds);
                // TRANS_QUAD / EASE_IN.
                float eased = t * t;
                _spriteHolder.localScale = Vector3.one * Mathf.Lerp(fromScale, targetScale, eased);
                _spriteHolderGroup.alpha = Mathf.Lerp(fromAlpha, 0f, t);
                _spriteHolder.localRotation = Quaternion.Euler(0f, 0f, Mathf.Lerp(0f, rotateTo, t));
                // The pool dies with the body — light outliving its source is
                // the one thing that would break the grounding this exists to
                // sell.
                SetGlowAlpha(Mathf.Lerp(fromGlow, 0f, Mathf.Clamp01(elapsed / glowSeconds)));
                yield return null;
            }
            _spriteHolderGroup.alpha = 0f;
            SetGlowAlpha(0f);
        }

        // --- Internals ---------------------------------------------------------

        void ShowEnemy(EnemyDefinition definition)
        {
            if (definition == null) return;

            _spriteImage.sprite = definition.texture;
            _spriteImage.color = Color.white;
            _glowColor = definition.glowColor;
            // viewScale is what the creature WANTS; the screen is what it gets.
            //
            // A boss at viewScale 2 is a 1000-unit sprite in a 500-unit view,
            // and that is fine at the reference shape because the canvas is
            // 1080 wide. It is not fine anywhere else: the CanvasScaler matches
            // on HEIGHT, so a taller display makes the canvas NARROWER in
            // reference units — 864 at 20:9 — and the same creature hung 68px
            // off both sides of the display. Capping here rather than in the
            // definitions keeps every enemy's authored size honest and lets the
            // shape decide, which is the only thing that actually knows.
            _wantedScale = definition.viewScale;

            _spriteHolder.localScale = Vector3.one * _baseScale;
            _spriteHolder.localRotation = Quaternion.identity;
            _spriteHolder.anchoredPosition = Vector2.zero;
            _spriteHolderGroup.alpha = 1f;

            // The silhouette catches the creature's own light rather than a
            // single global accent, so a frost enemy rims cold and a shade rims
            // violet off the same shader.
            if (_rimMaterial != null) _rimMaterial.SetColor("_RimColor", definition.glowColor);

            // Same source as the rim: the pool is this creature's own light on
            // the ground, so it is tinted rather than darkened.
            if (_groundGlow != null)
            {
                _groundGlow.localScale = Vector3.one * _glowScale;
                SetGlowAlpha(GlowAlpha);
            }
        }

        void StartIdle()
        {
            if (_idle != null) StopCoroutine(_idle);
            _idle = StartCoroutine(Hover());
        }

        /// <summary>Rise and fall. The pool tightens and dims on the same curve
        /// over the same 1.4s, so the two never drift apart and the enemy reads
        /// as leaving the ground rather than sliding up a wall.</summary>
        IEnumerator Hover()
        {
            while (true)
            {
                // Rise: the pool tightens and dims as the creature leaves it.
                yield return HoverLeg(0f, HoverHeight,
                    _glowScale, _glowScale * GlowLiftScale, GlowAlpha, GlowLiftAlpha);
                // Fall: exactly the reverse, same curve, same duration.
                yield return HoverLeg(HoverHeight, 0f,
                    _glowScale * GlowLiftScale, _glowScale, GlowLiftAlpha, GlowAlpha);
            }
        }

        IEnumerator HoverLeg(float fromY, float toY,
                             float fromGlowScale, float toGlowScale,
                             float fromAlpha, float toAlpha)
        {
            float elapsed = 0f;
            while (elapsed < HoverSeconds)
            {
                elapsed += Time.deltaTime;
                // TRANS_SINE / EASE_IN_OUT.
                float t = 0.5f - 0.5f * Mathf.Cos(Mathf.Clamp01(elapsed / HoverSeconds) * Mathf.PI);
                _spriteHolder.anchoredPosition = new Vector2(
                    _spriteHolder.anchoredPosition.x, Mathf.Lerp(fromY, toY, t));
                if (_groundGlow != null)
                {
                    _groundGlow.localScale =
                        Vector3.one * Mathf.Lerp(fromGlowScale, toGlowScale, t);
                    SetGlowAlpha(Mathf.Lerp(fromAlpha, toAlpha, t));
                }
                yield return null;
            }
        }

        void StopAnimations()
        {
            if (_idle != null) { StopCoroutine(_idle); _idle = null; }
            if (_hit != null) { StopCoroutine(_hit); _hit = null; }
        }

        void SetGlowAlpha(float alpha)
        {
            if (_groundGlowImage == null) return;
            _groundGlowImage.color = VantaTheme.Fade(_glowColor, alpha);
        }

        float GlowCurrentAlpha() => _groundGlowImage != null ? _groundGlowImage.color.a : 0f;

        /// <summary>A Back ease-out.</summary>
        static float BackOut(float t)
        {
            const float c1 = 1.70158f;
            const float c3 = c1 + 1f;
            float inv = t - 1f;
            return 1f + c3 * inv * inv * inv + c1 * inv * inv;
        }
    }
}
