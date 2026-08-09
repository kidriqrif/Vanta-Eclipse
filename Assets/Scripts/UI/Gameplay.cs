// Ported from scripts/ui/gameplay.gd
using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using VantaEclipse.Core;
using VantaEclipse.Data;
using VantaEclipse.Managers;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Gameplay screen — the combat view.
    ///
    /// A window into CombatManager: taps go in, EventBus signals come out and
    /// are rendered as health-bar changes, damage numbers, and animations. All
    /// combat rules live in CombatManager; this script only displays them.
    /// </summary>
    public sealed class Gameplay : UIScreen
    {
        /// <summary>Pending banners held while one plays. A Frozen-Ruins gate
        /// kill can fire four in a single frame (BOSS FELLED → RELIC RECOVERED →
        /// MYTHIC DROP → pet unlock); at ~2.2s each this caps the chain just
        /// under nine seconds.</summary>
        public const int MaxQueuedBanners = 3;

        /// <summary>How long the death-and-payout beat gets before a live world
        /// unlock takes the screen.</summary>
        public const float UnlockPresentationDelay = 0.6f;

        // --- Nodes ------------------------------------------------------------

        GameObject _autoAttackBadge;
        Text _worldLabel;
        GameObject _bossPlate;
        Text _bossNameLabel;
        Button _challengeBossButton;
        GameObject _essenceDisplay;
        Text _essenceLabel;
        Button _eclipseButton;
        Button _arcadeButton;
        Button _journalButton;
        GameObject _journalPill;
        Text _journalCount;
        GameObject _countPill;
        Text _countLabel;
        UpgradeShopPanel _shopPanel;
        Text _stageLabel;
        Text _enemyNameLabel;
        Slider _healthBar;
        Text _healthLabel;
        RectTransform _combatArea;
        Button _companionButton;
        Image _companionIcon;
        GameObject _companionLevelPill;
        Text _companionLevelLabel;
        GameObject _companionNewPill;
        RectTransform _fxLayer;
        Text _killsLabel;
        Text _playTimeLabel;

        // --- State ------------------------------------------------------------

        /// <summary>Where the last tap landed, so its damage number spawns under
        /// the finger.</summary>
        Vector2 _lastTapPosition;
        bool _hasTapPosition;

        Coroutine _essencePop;
        Coroutine _badgePulse;

        /// <summary>One-at-a-time blocking-modal presentation queue (M5 UX spec
        /// §6).</summary>
        readonly Queue<Func<CenteredModalDialog>> _modalQueue = new();
        bool _modalActive;
        bool _unlockPresentationQueued;

        /// <summary>Banner queue so layer-50 transients never stack — they play
        /// in sequence.</summary>
        ResultBanner _activeBanner;
        readonly List<ResultBanner> _queuedBanners = new();

        /// <summary>Whole seconds of play time currently shown, so Update can
        /// skip the string build on the ~59 frames per second that would not
        /// change it.</summary>
        int _displayedPlaySecond = -1;

        /// <summary>The currently-visible loot toast, so quick drops collapse
        /// into it.</summary>
        LootToast _activeLootToast;

        // --- Lifecycle --------------------------------------------------------

        void Start()
        {
            CacheNodes();
            Subscribe();
            WireButtons();

            SetText("SessionLabel", $"Session #{Game.State.LaunchCount}");
            if (_essenceLabel != null)
                _essenceLabel.text = NumberFormat.Format(
                    Game.Currency.GetBalance(CurrencyManager.Essence));

            UpdateJournalPill();
            UpdateCountPill();
            UpdateCompanion();
            RenderCurrentState();
        }

        void OnDestroy()
        {
            if (Game.IsBooted) Unsubscribe();

            // Queued banners were spawned but never parented into the live
            // hierarchy, so destroying this screen does not reap them.
            foreach (var banner in _queuedBanners)
                if (banner != null) banner.DiscardUnshown();
            _queuedBanners.Clear();
        }

        void CacheNodes()
        {
            _autoAttackBadge = FindObject("AutoAttackBadge");
            _worldLabel = Find<Text>("WorldLabel");
            _bossPlate = FindObject("BossPlate");
            _bossNameLabel = Find<Text>("BossNameLabel");
            _challengeBossButton = Find<Button>("ChallengeBossButton");
            _essenceDisplay = FindObject("EssenceDisplay");
            _essenceLabel = Find<Text>("EssenceLabel");
            _eclipseButton = Find<Button>("EclipseButton");
            _arcadeButton = Find<Button>("ArcadeButton");
            _journalButton = Find<Button>("JournalButton");
            _journalPill = FindObject("JournalPill");
            _journalCount = Find<Text>("JournalCount");
            _countPill = FindObject("CountPill");
            _countLabel = Find<Text>("CountLabel");
            _shopPanel = FindObject("UpgradeShopPanel")?.GetComponent<UpgradeShopPanel>();
            _stageLabel = Find<Text>("StageLabel");
            _enemyNameLabel = Find<Text>("EnemyNameLabel");
            _healthBar = Find<Slider>("HealthBar");
            _healthLabel = Find<Text>("HealthLabel");
            _combatArea = FindObject("CombatArea")?.transform as RectTransform;
            _companionButton = Find<Button>("CompanionButton");
            _companionIcon = _companionButton != null
                ? _companionButton.GetComponent<Image>() : null;
            _companionLevelPill = FindObject("LevelPill");
            _companionLevelLabel = Find<Text>("LevelLabel");
            _companionNewPill = FindObject("NewPill");
            _fxLayer = FindObject("FxLayer")?.transform as RectTransform;
            _killsLabel = Find<Text>("KillsLabel");
            _playTimeLabel = Find<Text>("PlayTimeLabel");

            // Damage numbers and trails are parented here and positioned in its
            // space, so a missing FxLayer would silently drop every one of them.
            if (_fxLayer == null && _combatArea != null) _fxLayer = _combatArea;
        }

        void Subscribe()
        {
            var bus = Game.Events;
            bus.EnemySpawned += OnEnemySpawned;
            bus.EnemyDamaged += OnEnemyDamaged;
            bus.EnemyDied += OnEnemyDied;
            bus.CurrencyChanged += OnCurrencyChanged;
            bus.AutoAttackUnlocked += OnAutoAttackUnlocked;
            bus.OfflineRewardsReady += OnOfflineRewardsReady;
            bus.BossFightStarted += OnBossFightStarted;
            bus.BossFightWon += OnBossFightWon;
            bus.BossFightFailed += OnBossFightFailed;
            bus.WorldUnlocked += OnWorldUnlocked;
            bus.SceneTransitionFinished += OnSceneTransitionFinished;
            bus.ItemDropped += OnItemDropped;
            bus.RelicDropped += OnRelicDropped;
            bus.RelicsAwakened += OnRelicsAwakened;
            bus.PetUnlocked += OnPetUnlocked;
            bus.PetEvolved += OnPetEvolved;
            bus.PetLeveled += OnPetLeveled;
            bus.ActivePetChanged += OnActivePetChanged;
            bus.EclipseAvailable += OnEclipseAvailable;
            bus.ArcadeUnlocked += OnArcadeUnlocked;
            bus.GoalCompleted += OnJournalChanged;
            bus.GoalClaimed += OnJournalClaimed;
        }

        void Unsubscribe()
        {
            var bus = Game.Events;
            bus.EnemySpawned -= OnEnemySpawned;
            bus.EnemyDamaged -= OnEnemyDamaged;
            bus.EnemyDied -= OnEnemyDied;
            bus.CurrencyChanged -= OnCurrencyChanged;
            bus.AutoAttackUnlocked -= OnAutoAttackUnlocked;
            bus.OfflineRewardsReady -= OnOfflineRewardsReady;
            bus.BossFightStarted -= OnBossFightStarted;
            bus.BossFightWon -= OnBossFightWon;
            bus.BossFightFailed -= OnBossFightFailed;
            bus.WorldUnlocked -= OnWorldUnlocked;
            bus.SceneTransitionFinished -= OnSceneTransitionFinished;
            bus.ItemDropped -= OnItemDropped;
            bus.RelicDropped -= OnRelicDropped;
            bus.RelicsAwakened -= OnRelicsAwakened;
            bus.PetUnlocked -= OnPetUnlocked;
            bus.PetEvolved -= OnPetEvolved;
            bus.PetLeveled -= OnPetLeveled;
            bus.ActivePetChanged -= OnActivePetChanged;
            bus.EclipseAvailable -= OnEclipseAvailable;
            bus.ArcadeUnlocked -= OnArcadeUnlocked;
            bus.GoalCompleted -= OnJournalChanged;
            bus.GoalClaimed -= OnJournalClaimed;
        }

        void WireButtons()
        {
            if (_combatArea != null)
            {
                var surface = _combatArea.GetComponent<TapSurface>()
                              ?? _combatArea.gameObject.AddComponent<TapSurface>();
                surface.Tapped += OnCombatAreaTapped;
            }

            Bind("MenuButton", () => Game.Flow.ChangeScene(Scenes.MainMenu));
            Bind("UpgradesButton", () => _shopPanel?.Toggle());
            Bind("GearButton", () => Game.Flow.ChangeScene(Scenes.Gear));
            Bind("ShopButton", () => Game.Flow.ChangeScene(Scenes.Shop));
            _challengeBossButton?.onClick.AddListener(OnChallengeBossPressed);
            _companionButton?.onClick.AddListener(() => Game.Flow.ChangeScene(Scenes.Pets));

            // The three "door" buttons. Each keeps its own icon and label, which
            // is what players navigate by; the per-door accent tints they used
            // to carry are RETIRED — under a one-accent scheme two extra neon
            // hues on the busiest row of the game were the loudest thing on
            // screen and the first thing to break the red-and-black read.
            StyleDoorButton(_eclipseButton, UISprites.Eclipse);
            _eclipseButton?.onClick.AddListener(() => Game.Flow.ChangeScene(Scenes.Eclipse));
            SetActive(_eclipseButton, Game.Prestige.IsUnlocked());

            StyleDoorButton(_arcadeButton, UISprites.ArcadeToken);
            _arcadeButton?.onClick.AddListener(() => Game.Flow.ChangeScene(Scenes.Arcade));
            SetActive(_arcadeButton, Game.Arcade.IsArcadeUnlocked());

            StyleDoorButton(_journalButton, UISprites.Journal);
            _journalButton?.onClick.AddListener(() => Game.Flow.ChangeScene(Scenes.Journal));
        }

        void Update()
        {
            // Only touch the label when the displayed second actually changes.
            // Assigning it every frame allocated a new string and dirtied the
            // label's layout 60 times a second for a value that moves once —
            // the same guard CountdownTimerBar uses.
            int second = (int)Game.State.TotalPlayTime;
            if (second == _displayedPlaySecond) return;
            _displayedPlaySecond = second;
            if (_playTimeLabel != null)
                _playTimeLabel.text = GameManager.FormatTime(Game.State.TotalPlayTime);
        }

        // --- Input ------------------------------------------------------------

        void OnCombatAreaTapped(Vector2 position)
        {
            _lastTapPosition = position;
            _hasTapPosition = true;
            SpawnTapTrail(position);
            Game.Combat.PlayerTapAttack();
            _hasTapPosition = false;
        }

        // --- Combat signal handlers --------------------------------------------

        void OnEnemySpawned(EnemyDefinition definition, int level, float maxHp)
        {
            UpdateHealth(maxHp, maxHp);
            if (definition.isBoss) return;   // the boss handler owns the boss dressing

            if (_enemyNameLabel != null)
            {
                _enemyNameLabel.text = definition.displayName;
                _enemyNameLabel.gameObject.SetActive(true);
            }
            SetStageLabel(Game.Combat.CurrentState == CombatManager.State.FARM_MODE
                ? $"Enemy Lv. {level} · Boss at Lv. {Game.Combat.EnemyLevel}"
                : $"Enemy Lv. {level}");
        }

        void OnEnemyDamaged(float amount, bool isCrit, float hp, float maxHp)
        {
            UpdateHealth(hp, maxHp);
            SpawnDamageNumber(amount, isCrit);
            if (isCrit) Game.Settings.Vibrate(20);
        }

        void OnEnemyDied(int level, int totalKills)
        {
            if (_killsLabel != null)
                _killsLabel.text = $"Void creatures slain: {NumberFormat.Format(totalKills)}";
            // Boss kills get the single stronger buzz from the win handler.
            if (Game.Combat.CurrentState != CombatManager.State.BOSS_FIGHT)
                Game.Settings.Vibrate(35);
        }

        void OnAutoAttackUnlocked()
        {
            UIPrefabs.Spawn<AutoAttackToast>(transform);
            StartCoroutine(PopBadge());
            Game.Settings.Vibrate(50);
        }

        void OnOfflineRewardsReady(float amount, int seconds, bool capped)
        {
            // Pull the authoritative pending state; whoever consumes first wins,
            // so a re-emitted announcement can never double-show.
            var data = Game.Idle.ConsumePendingOfflineRewards();
            if (data == null) return;

            EnqueueModal(() =>
            {
                var modal = UIPrefabs.Spawn<OfflineRewardsModal>(transform);
                modal?.Setup(data.Amount, data.SecondsAway, data.WasCapped);
                Game.Settings.Vibrate(15);
                return modal;
            });
        }

        void OnBossFightStarted(EnemyDefinition definition, int level, float maxHp, float duration)
        {
            if (_bossNameLabel != null)
                _bossNameLabel.text = definition.displayName.ToUpperInvariant();
            SetActive(_bossPlate, true);
            SetActive(_enemyNameLabel, false);
            SetActive(_challengeBossButton, false);

            string prefix = Game.Worlds.IsWorldBossGate(level) ? "World Boss" : "Boss";
            SetStageLabel($"{prefix} · Lv. {level}");
            DressHealthBar(true);
            StartCoroutine(SlamBossPlate());
            Game.Settings.Vibrate(50);
        }

        /// <summary>The plate slams in at higher amplitude than the badge pop
        /// (spec §4A).</summary>
        IEnumerator SlamBossPlate()
        {
            // One frame so the layout has assigned the plate its real size —
            // it has never been laid out while hidden.
            yield return null;
            if (_bossPlate == null || !_bossPlate.activeInHierarchy) yield break;
            yield return PopTo(_bossPlate.transform as RectTransform, 1.4f, 0.3f);
        }

        void OnBossFightWon(int level, float payout, bool isWorldBoss)
        {
            UndressBoss();
            Game.Settings.Vibrate(60);
            // The World Unlock modal is the celebration — never both. (The final
            // world's boss has no next world to unlock, so it falls through to
            // the normal win banner and the moment is never silent.)
            if (isWorldBoss && Game.Worlds.HasPendingUnlockCelebration()) return;

            ShowBanner(UISprites.BossSkull, "BOSS FELLED",
                $"+{NumberFormat.Format(payout)} Essence — the path ahead is open.", true);
        }

        void OnBossFightFailed(int level)
        {
            UndressBoss();
            // No haptic: haptics mark rewards and impacts, never failures.
            ShowBanner(UISprites.BossSkull, "THE BOSS ENDURES",
                "Farm essence, grow stronger — challenge again anytime.", false);

            if (_challengeBossButton != null) _challengeBossButton.interactable = true;
            StartCoroutine(PopChallengeButton());
        }

        /// <summary>Pop-in for the retry path (the badge-pop idiom, spec
        /// §4B).</summary>
        IEnumerator PopChallengeButton()
        {
            SetActive(_challengeBossButton, true);
            yield return null;
            if (_challengeBossButton == null || !_challengeBossButton.gameObject.activeInHierarchy)
                yield break;
            yield return PopTo(_challengeBossButton.transform as RectTransform, 0.9f, 0.24f);
        }

        void OnChallengeBossPressed()
        {
            // Disabled until resolution so double-taps cannot double-enter.
            if (_challengeBossButton != null) _challengeBossButton.interactable = false;
            Game.Combat.RequestBossChallenge();
        }

        void OnWorldUnlocked(WorldDefinition world)
        {
            // Live unlock: give the death-and-payout beat its moment, then queue.
            Scheduler.After(UnlockPresentationDelay, EnqueueUnlockPresentation);
        }

        void OnSceneTransitionFinished(string sceneName)
        {
            // Re-present an unacknowledged unlock on arrival (UX spec §6).
            if (sceneName == Scenes.Gameplay && Game.Worlds.HasPendingUnlockCelebration())
                EnqueueUnlockPresentation();
        }

        void OnCurrencyChanged(string currency, float balance)
        {
            if (currency != CurrencyManager.Essence) return;
            if (_essenceLabel != null) _essenceLabel.text = NumberFormat.Format(balance);
            PopEssenceDisplay();
        }

        // --- Doors --------------------------------------------------------------

        /// <summary>
        /// The theme's button content margins (34/24) would squeeze an icon into
        /// a ~32px box inside a 96px target. A tighter fill and border give it
        /// the room the spec asks for.
        /// </summary>
        static void StyleDoorButton(Button button, Sprite icon)
        {
            if (button == null) return;

            var background = button.GetComponent<Image>();
            if (background != null) background.color = VantaTheme.Surface;

            // The icon is a child image rather than the button's own graphic:
            // the button's graphic is its fill and its raycast target, and
            // swapping the sprite in would replace the fill with the glyph.
            var iconTransform = button.transform.Find("Icon");
            Image iconImage;
            if (iconTransform != null)
            {
                iconImage = iconTransform.GetComponent<Image>();
            }
            else
            {
                var go = new GameObject("Icon", typeof(RectTransform));
                go.transform.SetParent(button.transform, false);
                var rect = (RectTransform)go.transform;
                rect.anchorMin = Vector2.zero;
                rect.anchorMax = Vector2.one;
                rect.offsetMin = new Vector2(12f, 12f);
                rect.offsetMax = new Vector2(-12f, -12f);
                iconImage = go.AddComponent<Image>();
                iconImage.raycastTarget = false;
                iconImage.preserveAspect = true;
            }
            if (iconImage != null && icon != null) iconImage.sprite = icon;

            var label = button.GetComponentInChildren<Text>(true);
            if (label != null) label.color = VantaTheme.Ink;
        }

        // --- Journal / Gear badges ------------------------------------------------

        /// <summary>The Journal badge is a durable record — it reads the
        /// unclaimed count rather than counting fired signals, so a reward can
        /// never be lost to a missed banner (the same rule as the GEAR pill and
        /// the companion NEW badge).</summary>
        void UpdateJournalPill()
        {
            int count = Game.Journal.GetUnclaimedCount();
            SetActive(_journalPill, count > 0);
            if (_journalCount != null) _journalCount.text = count.ToString();
        }

        void OnJournalChanged(string id) => UpdateJournalPill();

        void OnJournalClaimed(string id, string rewardText) => UpdateJournalPill();

        void UpdateCountPill()
        {
            // The GEAR pill is the durable record for everything that lives
            // behind the Gear screen — unseen equipment AND unseen relics
            // (UX §4D). Pets have their own entry (the companion NEW badge), so
            // they are counted there.
            int count = Game.Equipment.GetUnseenCount() + Game.Relics.GetUnseenCount();
            SetActive(_countPill, count > 0);
            // The count alone, not "N NEW". The bottom row carries four buttons
            // on a 1080-wide phone, so each is ~250px and GEAR's label sits
            // centred in it — a pill wide enough for the word covered that label
            // completely.
            if (_countLabel != null) _countLabel.text = count.ToString();
        }

        // --- Unlock announcements -------------------------------------------------

        void OnArcadeUnlocked()
        {
            // One-time live crossing: reveal the door and announce it (M9 UX §5).
            SetActive(_arcadeButton, true);
            Game.Settings.Vibrate(45);
            ShowBanner(UISprites.ArcadeToken, "THE ARCADE OPENS",
                "Spend a token. Win a burst of Essence.", true);
        }

        void OnEclipseAvailable()
        {
            // One-time live crossing: reveal the door and announce it (UX §2).
            SetActive(_eclipseButton, true);
            Game.Settings.Vibrate(45);
            ShowBanner(UISprites.Eclipse, "THE ECLIPSE AWAITS",
                "Collapse your run into permanent power.", true);
            // EclipsePerformed is deliberately NOT handled here: the Eclipse
            // screen is current when it fires, so this one is not loaded. It
            // owns the celebration, and Start re-reads IsUnlocked on return.
        }

        void OnRelicDropped(string id)
        {
            var definition = Game.Relics.GetDefinition(id);
            if (definition == null) return;
            Game.Settings.Vibrate(45);
            UpdateCountPill();   // a relic is now an unseen item behind GEAR (UX §4D)
            ShowBanner(definition.sigil, "RELIC RECOVERED", definition.displayName, true);
        }

        void OnRelicsAwakened()
            => ShowBanner(UISprites.BossSkull, "RELICS AWAKENED",
                "The relic slot stirs — attune one in your Gear.", true);

        // --- Companion --------------------------------------------------------------

        void OnPetUnlocked(string id)
        {
            var definition = Game.Pets.GetDefinition(id);
            Game.Settings.Vibrate(35);
            UpdateCompanion();
            if (definition == null || definition.stageSprites.Length == 0) return;
            ShowBanner(definition.stageSprites[0], "NEW COMPANION",
                definition.stageNames[0], true);
        }

        void OnPetEvolved(string id, int stage)
        {
            var definition = Game.Pets.GetDefinition(id);
            Game.Settings.Vibrate(50);
            UpdateCompanion();
            if (definition == null || stage >= definition.stageSprites.Length) return;
            ShowBanner(definition.stageSprites[stage], "EVOLUTION",
                $"{definition.stageNames[stage]} evolved!", true);
        }

        void OnPetLeveled(string id, int level)
        {
            // Low-ceremony level-up (§2.8): refresh the companion's Lv. pill and
            // give both it and the companion a small pop — a Loot-Toast-kin
            // acknowledgment.
            if (id != Game.Pets.GetActiveId()) return;
            if (_companionButton == null || !_companionButton.gameObject.activeInHierarchy) return;

            if (_companionLevelLabel != null) _companionLevelLabel.text = $"Lv. {level}";
            StartCoroutine(PopTo(_companionButton.transform as RectTransform, 1.18f, 0.2f));
            if (_companionLevelPill != null)
                StartCoroutine(PopTo(_companionLevelPill.transform as RectTransform, 1.35f, 0.2f));
        }

        void OnActivePetChanged(string id) => UpdateCompanion();

        void UpdateCompanion()
        {
            string active = Game.Pets.GetActiveId();
            if (string.IsNullOrEmpty(active))
            {
                SetActive(_companionButton, false);
                return;
            }
            var definition = Game.Pets.GetDefinition(active);
            if (definition == null)
            {
                SetActive(_companionButton, false);
                return;
            }

            int stage = Mathf.Clamp(Game.Pets.GetStage(active), 0,
                                    Mathf.Max(0, definition.stageSprites.Length - 1));
            if (_companionIcon != null && definition.stageSprites.Length > 0)
                _companionIcon.sprite = definition.stageSprites[stage];
            if (_companionLevelLabel != null)
                _companionLevelLabel.text = $"Lv. {Game.Pets.GetLevel(active)}";
            // The companion is the entry to the Pets screen, so it carries the
            // durable NEW badge for any unseen companion (starter grant or a
            // boss drop). It clears when the Pets screen marks all seen (UX §4D).
            SetActive(_companionNewPill, Game.Pets.GetUnseenCount() > 0);
            SetActive(_companionButton, true);
        }

        // --- Loot ---------------------------------------------------------------------

        void OnItemDropped(Item item)
        {
            int rarity = item.Rarity;
            // Haptics mark meaningful drops only — Common/Rare are frequent and
            // silent (UX spec §4D).
            if (rarity >= (int)EquipmentManager.Rarity.EPIC) Game.Settings.Vibrate(15);
            UpdateCountPill();

            var slot = Game.Equipment.GetSlotDefinition(item.Slot);
            string slotName = slot != null ? slot.displayName : item.Slot;

            // Mythic drops get the full Result Banner; everything else a Loot
            // Toast that collapses if one is already showing.
            if (rarity >= (int)EquipmentManager.Rarity.MYTHIC)
            {
                ShowBanner(UISprites.BossSkull, "MYTHIC DROP",
                    $"{RarityStyle.Name(rarity)} {slotName}", true);
                return;
            }

            if (_activeLootToast != null)
            {
                _activeLootToast.AddItem(item);
                return;
            }

            var toast = UIPrefabs.Spawn<LootToast>(transform);
            if (toast == null) return;
            toast.Setup(item);
            _activeLootToast = toast;
            toast.Finished += () => _activeLootToast = null;
        }

        // --- Rendering ------------------------------------------------------------------

        void RenderCurrentState()
        {
            if (_killsLabel != null)
                _killsLabel.text =
                    $"Void creatures slain: {NumberFormat.Format(Game.Combat.TotalKills)}";

            // Steady-state badge on load — no pop, no toast (UX spec §2A branch).
            SetActive(_autoAttackBadge, Game.Idle.AutoAttackUnlocked);
            if (Game.Idle.AutoAttackUnlocked) StartBadgePulse();

            if (_worldLabel != null)
                _worldLabel.text = Game.Worlds.GetWorldForLevel(Game.Combat.EnemyLevel)
                    .displayName.ToUpperInvariant();

            bool inFarmMode = Game.Combat.CurrentState == CombatManager.State.FARM_MODE;
            SetActive(_challengeBossButton, inFarmMode);
            if (_challengeBossButton != null) _challengeBossButton.interactable = true;

            bool midBossFight = Game.Combat.CurrentState == CombatManager.State.BOSS_FIGHT
                                && Game.Combat.IsEnemyAlive();
            SetActive(_bossPlate, midBossFight);
            SetActive(_enemyNameLabel, !midBossFight);
            DressHealthBar(midBossFight);

            if (Game.Combat.IsEnemyAlive())
            {
                var definition = Game.Combat.GetEnemyDefinition();
                if (midBossFight)
                {
                    if (_bossNameLabel != null)
                        _bossNameLabel.text = definition.displayName.ToUpperInvariant();
                }
                else if (_enemyNameLabel != null)
                {
                    _enemyNameLabel.text = definition.displayName;
                }
                UpdateHealth(Game.Combat.EnemyHp, Game.Combat.EnemyMaxHp);
            }
            else
            {
                // Between kill and respawn — the spawn signal fills this in.
                if (_enemyNameLabel != null) _enemyNameLabel.text = "";
                UpdateHealth(0f, 1f);
            }

            // Stage label per state: farm re-entry must keep the wall suffix and
            // show the level actually being fought.
            if (midBossFight)
            {
                string prefix = Game.Worlds.IsWorldBossGate(Game.Combat.EnemyLevel)
                    ? "World Boss" : "Boss";
                SetStageLabel($"{prefix} · Lv. {Game.Combat.EnemyLevel}");
            }
            else if (inFarmMode)
            {
                SetStageLabel($"Enemy Lv. {Game.Combat.GetEffectiveKillLevel()} · " +
                              $"Boss at Lv. {Game.Combat.EnemyLevel}");
            }
            else
            {
                SetStageLabel($"Enemy Lv. {Game.Combat.EnemyLevel}");
            }
        }

        void SetStageLabel(string value)
        {
            if (_stageLabel != null) _stageLabel.text = value;
        }

        void UpdateHealth(float hp, float maxHp)
        {
            if (_healthBar != null)
            {
                _healthBar.maxValue = maxHp;
                _healthBar.value = hp;
            }
            if (_healthLabel != null)
                _healthLabel.text = $"{NumberFormat.Format(hp)} / {NumberFormat.Format(maxHp)}";
        }

        /// <summary>The boss bar is taller and wears the bright accent; the
        /// routine one is shorter and wears the deep accent. Height carries the
        /// difference as well as colour.</summary>
        void DressHealthBar(bool boss)
        {
            if (_healthBar == null) return;

            var rect = (RectTransform)_healthBar.transform;
            rect.sizeDelta = new Vector2(rect.sizeDelta.x, boss ? 60f : 46f);

            var fill = _healthBar.fillRect != null
                ? _healthBar.fillRect.GetComponent<Image>() : null;
            if (fill != null) fill.color = boss ? VantaTheme.Crimson : VantaTheme.Blood;
        }

        void UndressBoss()
        {
            SetActive(_bossPlate, false);
            SetActive(_enemyNameLabel, true);
            DressHealthBar(false);
        }

        // --- Banner queue -------------------------------------------------------------

        void ShowBanner(Sprite icon, string headline, string body, bool positive)
        {
            var banner = UIPrefabs.Spawn<ResultBanner>(transform);
            if (banner == null) return;
            banner.Setup(icon, headline, body, positive);

            // Layer-50 transients never stack, they play back to back
            // (pattern §7.2). A queued banner is parked inactive rather than
            // parented live, so anything dropped from the queue must be
            // destroyed explicitly.
            if (_activeBanner != null)
            {
                if (_queuedBanners.Count >= MaxQueuedBanners)
                {
                    banner.DiscardUnshown();
                    return;
                }
                banner.HoldUnshown();
                _queuedBanners.Add(banner);
                return;
            }

            _activeBanner = banner;
            banner.Finished += OnBannerFinished;
            banner.Play();
        }

        void OnBannerFinished()
        {
            _activeBanner = null;
            while (_queuedBanners.Count > 0)
            {
                var next = _queuedBanners[0];
                _queuedBanners.RemoveAt(0);
                if (next == null) continue;
                _activeBanner = next;
                next.Finished += OnBannerFinished;
                next.Play();
                return;
            }
        }

        // --- Modal queue ---------------------------------------------------------------

        /// <summary>One-at-a-time blocking-modal queue (UX spec §6: offline
        /// first, unlock on its dismissal; generalized for future
        /// must-acknowledge moments).</summary>
        void EnqueueModal(Func<CenteredModalDialog> spawner)
        {
            _modalQueue.Enqueue(spawner);
            if (!_modalActive) PresentNextModal();
        }

        void PresentNextModal()
        {
            if (_modalQueue.Count == 0)
            {
                _modalActive = false;
                return;
            }
            _modalActive = true;
            var modal = _modalQueue.Dequeue().Invoke();
            if (modal == null)
            {
                PresentNextModal();
                return;
            }
            modal.Closed += PresentNextModal;
        }

        void EnqueueUnlockPresentation()
        {
            if (_unlockPresentationQueued || !Game.Worlds.HasPendingUnlockCelebration()) return;
            _unlockPresentationQueued = true;

            EnqueueModal(() =>
            {
                var world = Game.Worlds.GetPendingUnlockWorld();
                if (world == null)
                {
                    _unlockPresentationQueued = false;
                    return null;
                }
                var modal = UIPrefabs.Spawn<WorldUnlockModal>(transform);
                if (modal == null)
                {
                    _unlockPresentationQueued = false;
                    return null;
                }
                modal.Setup(world, Game.Worlds.UnlockCelebrationPayout);
                modal.Confirmed += () => OnUnlockAcknowledged(world);
                // The sky used to recolour behind the scrim once the card
                // settled (§4C). There is no sky any more — the animated nebula
                // is gone and the backdrop is a flat fill — so entering a world
                // is announced by the modal and the haptic alone.
                Game.Settings.Vibrate(50);
                return modal;
            });
        }

        void OnUnlockAcknowledged(WorldDefinition world)
        {
            _unlockPresentationQueued = false;
            Game.Worlds.AcknowledgeUnlockCelebration();
            // The new world's first enemy spawns now, on ENTER (spec §2B/§4C).
            Game.Combat.ResumeSpawning();
            if (_worldLabel != null)
            {
                _worldLabel.text = world.displayName.ToUpperInvariant();
                StartCoroutine(PopTo(_worldLabel.transform as RectTransform, 1.15f, 0.25f));
            }
        }

        // --- Effects -----------------------------------------------------------------------

        IEnumerator PopBadge()
        {
            SetActive(_autoAttackBadge, true);
            // The badge has never been laid out while hidden — wait one frame so
            // the layout assigns its real size before the pop starts.
            yield return null;
            if (_autoAttackBadge == null) yield break;
            yield return PopTo(_autoAttackBadge.transform as RectTransform, 0f, 0.24f);
            StartBadgePulse();
        }

        /// <summary>Decorative 1.2s opacity pulse — the badge's text and icon
        /// alone carry the state, per the Enhanced accessibility tier.</summary>
        void StartBadgePulse()
        {
            if (_badgePulse != null || _autoAttackBadge == null) return;
            _badgePulse = StartCoroutine(PulseBadge());
        }

        IEnumerator PulseBadge()
        {
            var group = _autoAttackBadge.GetComponent<CanvasGroup>()
                        ?? _autoAttackBadge.AddComponent<CanvasGroup>();
            while (true)
            {
                yield return FadeGroup(group, 1f, 0.75f, 0.6f);
                yield return FadeGroup(group, 0.75f, 1f, 0.6f);
            }
        }

        static IEnumerator FadeGroup(CanvasGroup group, float from, float to, float seconds)
        {
            float elapsed = 0f;
            while (elapsed < seconds)
            {
                elapsed += Time.unscaledDeltaTime;
                // TRANS_SINE / EASE_IN_OUT.
                float t = Mathf.Clamp01(elapsed / seconds);
                group.alpha = Mathf.Lerp(from, to, 0.5f - 0.5f * Mathf.Cos(t * Mathf.PI));
                yield return null;
            }
            group.alpha = to;
        }

        /// <summary>Small scale bounce on the essence counter every time it
        /// changes.</summary>
        void PopEssenceDisplay()
        {
            if (_essenceDisplay == null) return;
            if (_essencePop != null) StopCoroutine(_essencePop);
            _essencePop = StartCoroutine(
                PopTo(_essenceDisplay.transform as RectTransform, 1.12f, 0.18f));
        }

        /// <summary>Centre-pivot scale-pop used for every low-ceremony
        /// acknowledgment: start at <paramref name="from"/>, settle on 1 with
        /// Godot's TRANS_BACK/EASE_OUT overshoot.</summary>
        static IEnumerator PopTo(RectTransform rect, float from, float seconds)
        {
            if (rect == null) yield break;
            rect.localScale = Vector3.one * from;
            float elapsed = 0f;
            while (elapsed < seconds)
            {
                elapsed += Time.unscaledDeltaTime;
                float t = Mathf.Clamp01(elapsed / seconds);
                rect.localScale = Vector3.one * Mathf.LerpUnclamped(from, 1f, BackOut(t));
                yield return null;
            }
            rect.localScale = Vector3.one;
        }

        static float BackOut(float t)
        {
            const float c1 = 1.70158f;
            const float c3 = c1 + 1f;
            float inv = t - 1f;
            return 1f + c3 * inv * inv * inv + c1 * inv * inv;
        }

        void SpawnTapTrail(Vector2 at)
        {
            var cosmetic = Game.Shop.GetEquippedCosmetic();
            if (cosmetic == null || _fxLayer == null) return;
            // This is what the six "… Trail" products in the shop actually sell.
            // trailColor reached only the shop swatch before, so a paid cosmetic
            // delivered a tinted damage number and nothing else.
            PixelBurst.Spawn(_fxLayer, at, cosmetic.trailColor, PixelBurst.Trail);
        }

        void SpawnDamageNumber(float amount, bool isCrit)
        {
            if (_fxLayer == null) return;
            var number = UIPrefabs.Spawn<DamageNumber>(_fxLayer);
            if (number == null) return;
            number.Setup(amount, isCrit);

            Vector2 spawn;
            if (_hasTapPosition)
            {
                spawn = _lastTapPosition;
            }
            else
            {
                // Auto attacks have no tap point — rise above the enemy instead.
                var size = _combatArea != null ? _combatArea.rect.size : new Vector2(1080f, 900f);
                spawn = new Vector2(size.x * 0.5f + UnityEngine.Random.Range(-40f, 40f),
                                    size.y * 0.7f);
            }
            var rect = (RectTransform)number.transform;
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.zero;
            rect.anchoredPosition = spawn;
        }

        // --- helpers ---------------------------------------------------------------------------

        static void SetActive(Component component, bool active)
        {
            if (component != null) component.gameObject.SetActive(active);
        }

        static void SetActive(GameObject go, bool active)
        {
            if (go != null) go.SetActive(active);
        }
    }
}
