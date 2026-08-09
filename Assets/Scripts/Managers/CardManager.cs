using System.Collections.Generic;
using UnityEngine;
using VantaEclipse.Core;
using VantaEclipse.Data;

namespace VantaEclipse.Managers
{
    /// <summary>
    /// Boss trophy cards: the roll, the collection, and absorption.
    ///
    /// Every boss that dies leaves a card. A card's exit is absorption: feeding
    /// one to the active companion converts it into pet XP (its POWER) and a
    /// permanent addition to that pet's passive (its VIGOR), then destroys it —
    /// the same shape as essence, a resource you hold, spend once, and see
    /// reflected in a number that went up. That is why nothing here is
    /// equippable and there is no card slot: a collection you must curate is a
    /// second inventory, and the game already has one.
    ///
    /// Built last. It reads PetManager and is read by neither.
    /// </summary>
    public sealed class CardManager : ISaveable
    {
        /// <summary>Rolled stats vary this far either side of their tier's
        /// baseline, so two cards off the same boss at the same tier are still
        /// not the same card.</summary>
        public const float RollSpread = 0.15f;

        /// <summary>POWER per boss level, before tier potency. Sets how much a
        /// card is worth as pet food: at level 50 a common is ~400 XP against
        /// the 3 XP a kill gives.</summary>
        public const float PowerPerLevel = 8f;

        /// <summary>VIGOR converts to a permanent bonus fraction at this rate.
        /// A legendary rolls around 18 vigor, so one is worth ~3.6% — real, and
        /// not a substitute for levelling the pet.</summary>
        public const float VigorToBonus = 0.002f;

        /// <summary>Hard cap on stored cards. Bosses are endless, so the
        /// collection has to be.</summary>
        public const int CollectionLimit = 200;

        /// <summary>The boss currently being fought, remembered from
        /// BossFightStarted — BossFightWon carries a level and a payout but not
        /// who died.</summary>
        EnemyDefinition _pendingBoss;

        readonly List<Card> _cards = new();

        public string SaveKey => "cards";

        public CardManager()
        {
            Game.Events.BossFightStarted += OnBossFightStarted;
            Game.Events.BossFightWon += OnBossFightWon;
        }

        IReadOnlyList<CardRarityDefinition> Rarities
            => DefinitionRegistry.All<CardRarityDefinition>();

        // --- Save contract -------------------------------------------------

        public Dictionary<string, object> GetSaveData()
        {
            var stored = new List<object>();
            foreach (var card in _cards) stored.Add(card.ToSaveData());
            return new Dictionary<string, object> { { "cards", stored } };
        }

        public void LoadSaveData(Dictionary<string, object> data)
        {
            _cards.Clear();
            foreach (var raw in SaveRead.Array(data, "cards"))
            {
                var card = Card.FromSaveData(AsDictionary(raw));
                // Drop rather than repair: a card naming a rarity this build
                // does not have cannot be rendered or absorbed correctly.
                if (card == null || !DefinitionRegistry.Has<CardRarityDefinition>(card.Rarity))
                    continue;
                _cards.Add(card);
            }
        }

        static Dictionary<string, object> AsDictionary(object raw)
        {
            if (raw is Dictionary<string, object> already) return already;
            if (raw is Newtonsoft.Json.Linq.JObject jobject)
                return jobject.ToObject<Dictionary<string, object>>();
            return null;
        }

        // --- Public reads --------------------------------------------------

        public IReadOnlyList<Card> GetCards() => _cards;
        public int GetCardCount() => _cards.Count;

        public CardRarityDefinition GetRarity(string id)
            => DefinitionRegistry.Has<CardRarityDefinition>(id)
                ? DefinitionRegistry.Get<CardRarityDefinition>(id)
                : null;

        public IReadOnlyList<CardRarityDefinition> GetRarities() => Rarities;

        // --- Absorption ----------------------------------------------------

        public sealed class AbsorbResult
        {
            public string Pet;
            public float Xp;
            public float Bonus;
            public string Name;
            public string Rarity;
        }

        /// <summary>
        /// Feed one card to the active companion. Returns what it granted so
        /// the UI can say so, or null if the absorb could not happen.
        ///
        /// The pet must be ACTIVE, not merely owned: absorption is the one
        /// place a player chooses which companion gets stronger, and letting it
        /// target a benched pet would make the choice invisible.
        /// </summary>
        public AbsorbResult Absorb(int index)
        {
            if (index < 0 || index >= _cards.Count) return null;

            string active = Game.Pets.GetActiveId();
            if (string.IsNullOrEmpty(active)) return null;

            var card = _cards[index];
            float grantedBonus = Game.Pets.AddAbsorbedBonus(active, card.Vigor * VigorToBonus);
            Game.Pets.GrantXp(active, card.Power);
            _cards.RemoveAt(index);
            Game.Save.SaveGame();

            Game.Events.RaiseCardAbsorbed(active, card.Power, grantedBonus);
            return new AbsorbResult
            {
                Pet = active,
                Xp = card.Power,
                Bonus = grantedBonus,
                Name = card.Name,
                Rarity = card.Rarity,
            };
        }

        // --- The roll ------------------------------------------------------

        void OnBossFightStarted(EnemyDefinition definition, int level, float maxHp, float duration)
            => _pendingBoss = definition;

        void OnBossFightWon(int level, float payout, bool isWorldBoss)
        {
            var card = RollCard(_pendingBoss, level);
            _pendingBoss = null;
            if (card == null) return;

            _cards.Add(card);
            // Oldest first: the collection is a log of what you beat, and the
            // early cards are the ones a player has already absorbed or
            // outgrown.
            while (_cards.Count > CollectionLimit) _cards.RemoveAt(0);

            Game.Save.SaveGame();
            Game.Events.RaiseCardCollected(card);
        }

        Card RollCard(EnemyDefinition boss, int level)
        {
            var rarity = RollRarity(level);
            if (rarity == null) return null;

            float potency = rarity.potencyMultiplier;
            return new Card
            {
                Boss = boss != null ? boss.id : "",
                Name = boss != null ? boss.displayName : "Nameless Boss",
                Rarity = rarity.id,
                Level = level,
                Power = level * PowerPerLevel * potency * Spread(),
                Vigor = (1f + 2f * Random.value) * potency * Spread(),
                Focus = 10f * potency * Spread(),
            };
        }

        /// <summary>
        /// Weighted pick across every tier the boss is high enough level to
        /// roll.
        ///
        /// The level floor is applied by EXCLUDING tiers rather than by
        /// re-rolling: a re-roll loop on a table whose entries are all excluded
        /// never terminates, and the first boss in the game is exactly that
        /// case.
        /// </summary>
        CardRarityDefinition RollRarity(int level)
        {
            var eligible = new List<CardRarityDefinition>();
            float total = 0f;
            foreach (var rarity in Rarities)
            {
                if (level < rarity.minimumBossLevel || rarity.dropWeight <= 0f) continue;
                eligible.Add(rarity);
                total += rarity.dropWeight;
            }
            if (eligible.Count == 0 || total <= 0f) return null;

            float roll = Random.value * total;
            foreach (var rarity in eligible)
            {
                roll -= rarity.dropWeight;
                if (roll <= 0f) return rarity;
            }
            return eligible[eligible.Count - 1];
        }

        static float Spread() => 1f + Random.Range(-RollSpread, RollSpread);
    }
}
