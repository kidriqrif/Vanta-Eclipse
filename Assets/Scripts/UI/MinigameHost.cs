using UnityEngine;
using UnityEngine.UI;
using VantaEclipse.Core;
using VantaEclipse.Data;
using VantaEclipse.Managers;

namespace VantaEclipse.UI
{
    /// <summary>
    /// The frame around whatever minigame is loaded. It owns everything that is
    /// NOT the game: the header, the forfeit flow, the payout, the record, the
    /// save, and the exit.
    ///
    /// This is why a new minigame is a prefab plus a definition and never a
    /// framework change: the game only plays and reports, the host does the rest.
    /// </summary>
    public sealed class MinigameHost : UIScreen
    {
        /// <summary>How long the armed QUIT confirm stays hot before
        /// disarming.</summary>
        public const float ArmSeconds = 2.5f;

        MinigameDefinition _definition;
        Minigame _game;
        bool _quitArmed;
        bool _resolved;

        Button _quitButton;
        Text _quitLabel;
        Image _quitFill;
        Text _titleLabel;
        GameObject _headerSpacer;
        Transform _gameBody;

        void Start()
        {
            _quitButton = Find<Button>("QuitButton");
            _quitLabel = _quitButton != null
                ? _quitButton.GetComponentInChildren<Text>(true) : null;
            _quitFill = _quitButton != null ? _quitButton.GetComponent<Image>() : null;
            _titleLabel = Find<Text>("TitleLabel");
            _headerSpacer = FindObject("HeaderSpacer");
            _gameBody = FindObject("GameBody")?.transform ?? transform;

            _quitButton?.onClick.AddListener(OnQuitPressed);

            // The hub hands the choice over through the manager, since a scene
            // change takes only a name. Read-and-clear so a stale id cannot leak
            // into a later entry.
            string id = Game.Arcade.PendingId;
            Game.Arcade.PendingId = "";
            _definition = Game.Arcade.GetDefinition(id);
            if (_definition == null)
            {
                Debug.LogError("MinigameHost: no pending minigame — returning to the Arcade.");
                Game.Flow.ChangeScene(Scenes.Arcade);
                return;
            }
            if (_titleLabel != null)
                _titleLabel.text = _definition.displayName.ToUpperInvariant();
            LoadGame();
        }

        void LoadGame()
        {
            string prefabName = _definition.PrefabName;
            var instance = UIPrefabs.Spawn(prefabName, _gameBody);
            if (instance == null)
            {
                Debug.LogError($"MinigameHost: could not load prefab '{prefabName}'.");
                Game.Flow.ChangeScene(Scenes.Arcade);
                return;
            }

            _game = instance.GetComponent<Minigame>();
            if (_game == null)
            {
                Debug.LogError($"MinigameHost: '{prefabName}' has no Minigame behaviour.");
                Destroy(instance);
                Game.Flow.ChangeScene(Scenes.Arcade);
                return;
            }

            // Setup before the first frame, so the board build can rely on its
            // context. The context is data, from the definition — tuning never
            // lives in code.
            _game.Setup(_definition.ParseContext());
            _game.Finished += OnGameFinished;

            var rect = (RectTransform)instance.transform;
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
        }

        // --- Quit (Two-Tap Arm: the token is already spent, so this forfeits) ---

        void OnQuitPressed()
        {
            if (_resolved) return;
            if (!_quitArmed)
            {
                _quitArmed = true;
                if (_quitLabel != null) _quitLabel.text = "TAP AGAIN: FORFEIT";
                StyleQuit(true);
                Scheduler.After(ArmSeconds, DisarmQuit);
                return;
            }
            if (_game != null) _game.ForceQuit();
            else Game.Flow.ChangeScene(Scenes.Arcade);
        }

        void DisarmQuit()
        {
            if (this == null || _quitButton == null) return;
            _quitArmed = false;
            if (_quitLabel != null) _quitLabel.text = "QUIT";
            StyleQuit(false);
        }

        /// <summary>The armed face is much wider than "QUIT", so it takes the
        /// header to itself for the 2.5s arm window rather than shoving the
        /// title off centre. (Reserving space for it instead would clip longer
        /// game titles.)</summary>
        void StyleQuit(bool armed)
        {
            if (_titleLabel != null) _titleLabel.gameObject.SetActive(!armed);
            if (_headerSpacer != null) _headerSpacer.SetActive(!armed);
            if (_quitFill != null)
                _quitFill.color = armed ? VantaTheme.Accent : VantaTheme.Surface;
            if (_quitLabel != null)
                _quitLabel.color = armed ? Color.white : VantaTheme.Ink;
        }

        // --- Result -------------------------------------------------------------

        void OnGameFinished(Minigame.Result result)
        {
            if (_resolved) return;
            _resolved = true;

            if (_game != null)
            {
                // The contract says raise-once, but unsubscribing makes the host
                // safe even against a misbehaving game.
                _game.Finished -= OnGameFinished;
                // Freeze the board: the banner does not block input, so without
                // this a forfeited game keeps ticking and accepting taps
                // underneath it.
                _game.Teardown();
            }
            if (_quitButton != null) _quitButton.interactable = false;
            // Never leave the armed face on a button that can no longer be
            // tapped.
            if (_quitArmed)
            {
                _quitArmed = false;
                if (_quitLabel != null) _quitLabel.text = "QUIT";
                StyleQuit(false);
            }

            bool won = result.Outcome == Minigame.Outcome.WIN;
            float performance = result.Performance;
            // A loss or forfeit still pays a fraction — attempting is never
            // punished.
            if (!won) performance *= MinigameManager.LossFloor;
            float payout = Game.Arcade.ComputePayout(_definition, performance);

            Game.Currency.Add(CurrencyManager.Essence, payout);
            Game.Events.RaiseEssenceEarned(payout, "minigame");

            // Records are for COMPLETED runs only. A loss or forfeit did not
            // achieve the objective, so its score is not comparable to one that
            // did — and for a lower-is-better game a loss scores the worst
            // possible value, which would otherwise be written in as the first
            // "best".
            bool isBest = won && Game.Arcade.RecordResult(_definition.id, result.Score);

            Game.Save.SaveGame();
            Game.Events.RaiseMinigameFinished(_definition.id, (int)result.Outcome, payout);
            Game.Settings.Vibrate(won ? 40 : 15);

            string headline = won ? "VICTORY"
                : result.Outcome == Minigame.Outcome.QUIT ? "FORFEIT" : "RUN COMPLETE";
            string body = $"+{NumberFormat.Format(payout)} Essence";
            if (!string.IsNullOrEmpty(result.Detail)) body = $"{result.Detail} · {body}";
            if (isBest) body += "  ★ BEST";

            var banner = UIPrefabs.Spawn<ResultBanner>(transform);
            if (banner == null)
            {
                Game.Flow.ChangeScene(Scenes.Arcade);
                return;
            }
            banner.Setup(_definition.icon, headline, body, won);
            banner.Finished += () => Game.Flow.ChangeScene(Scenes.Arcade);
            banner.Play();
        }
    }
}
