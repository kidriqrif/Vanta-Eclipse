using UnityEngine;
using UnityEngine.UI;
using VantaEclipse.Core;
using VantaEclipse.Data;
using VantaEclipse.Managers;

namespace VantaEclipse.UI
{
    /// <summary>
    /// Drives the bootstrap scene.
    ///
    /// The point of this script is that it is boring: it subscribes to the
    /// EventBus and renders what arrives, and it never reaches into a manager
    /// to ask how things are going. That is the same contract every real screen
    /// will have, so if the port broke the event flow, this is where it shows.
    /// </summary>
    public sealed class BootstrapScreen : MonoBehaviour
    {
        public Text EssenceLabel;
        public Text EnemyLabel;
        public Text HpLabel;
        public Button TapButton;

        void Start()
        {
            if (TapButton != null) TapButton.onClick.AddListener(OnTap);

            var bus = Game.Events;
            bus.CurrencyChanged += OnCurrencyChanged;
            bus.EnemySpawned += OnEnemySpawned;
            bus.EnemyDamaged += OnEnemyDamaged;
            bus.EnemyDied += OnEnemyDied;

            // Paint the current state once: the first enemy spawned during
            // Boot(), before this screen existed, so waiting for the next event
            // would leave the screen blank until something happened.
            OnCurrencyChanged(CurrencyManager.Essence,
                Game.Currency.GetBalance(CurrencyManager.Essence));
            var definition = Game.Combat.GetEnemyDefinition();
            if (definition != null)
                OnEnemySpawned(definition, Game.Combat.EnemyLevel, Game.Combat.EnemyMaxHp);
        }

        void OnDestroy()
        {
            if (!Game.IsBooted) return;
            var bus = Game.Events;
            bus.CurrencyChanged -= OnCurrencyChanged;
            bus.EnemySpawned -= OnEnemySpawned;
            bus.EnemyDamaged -= OnEnemyDamaged;
            bus.EnemyDied -= OnEnemyDied;
        }

        void OnTap() => Game.Combat.PlayerTapAttack();

        void OnCurrencyChanged(string currency, float balance)
        {
            if (currency != CurrencyManager.Essence || EssenceLabel == null) return;
            EssenceLabel.text = $"ESSENCE {NumberFormat.Format(balance)}";
        }

        void OnEnemySpawned(EnemyDefinition definition, int level, float maxHp)
        {
            if (EnemyLabel != null)
                EnemyLabel.text = $"{definition.displayName}  ·  LV {level}";
            SetHp(maxHp, maxHp);
        }

        void OnEnemyDamaged(float amount, bool isCrit, float hpRemaining, float maxHp)
            => SetHp(hpRemaining, maxHp);

        void OnEnemyDied(int level, int totalKills)
        {
            if (HpLabel != null) HpLabel.text = $"DEFEATED  ·  {totalKills} KILLS";
        }

        void SetHp(float current, float max)
        {
            if (HpLabel == null) return;
            HpLabel.text = $"{NumberFormat.Format(current)} / {NumberFormat.Format(max)}";
        }
    }
}
