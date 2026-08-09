using UnityEngine;
using VantaEclipse.Core;

namespace VantaEclipse.Managers
{
    /// <summary>
    /// The single source of truth for player combat statistics.
    ///
    /// Every stat is exposed through a Get* method on purpose: each layer of
    /// the game stacks its modifiers inside these methods, and no calling code
    /// ever needs to change. Upgrades, equipment, relics, pets, and Ascendant
    /// Powers all layer here.
    ///
    /// The order of operations inside each getter is load-bearing and was
    /// carried over exactly — flat sources add, then percent sources multiply,
    /// and essence multiplies where the others add. Changing the shape of one
    /// of these expressions silently retunes the whole game.
    /// </summary>
    public sealed class PlayerStats
    {
        public const float BaseTapDamage = 1f;
        public const float BaseCritChance = 0.05f;
        public const float BaseCritMultiplier = 2f;

        /// <summary>Hard cap so crit chance never becomes a guaranteed, boring
        /// 100%.</summary>
        public const float MaxCritChance = 0.5f;

        /// <summary>Fraction of the live essence rate earned while the game is
        /// closed.</summary>
        public const float BaseOfflineEfficiency = 0.5f;

        public float GetTapDamage()
        {
            float flat = BaseTapDamage + Game.Upgrades.GetStatAdditive("tap_damage");
            flat += Game.Equipment.GetAffixSum("tap_flat");
            flat += Game.Relics.GetEffectAdditive("tap_flat");
            flat += Game.Pets.GetActiveBonusAdditive("tap_flat");

            float damage = flat * Game.Upgrades.GetStatMultiplier("tap_damage");
            damage *= 1f + Game.Equipment.GetAffixSum("tap_pct")
                         + Game.Relics.GetEffectAdditive("tap_pct")
                         + Game.Pets.GetActiveBonusAdditive("tap_pct")
                         + Game.Skills.GetStatAdditive("tap_pct");
            return damage;
        }

        public float GetCritChance()
        {
            float chance = BaseCritChance + Game.Upgrades.GetStatAdditive("crit_chance");
            chance += Game.Equipment.GetAffixSum("crit_chance");
            chance += Game.Relics.GetEffectAdditive("crit_chance");
            chance += Game.Pets.GetActiveBonusAdditive("crit_chance");
            return Mathf.Clamp(chance, 0f, MaxCritChance);
        }

        public float GetCritMultiplier()
        {
            float mult = BaseCritMultiplier + Game.Upgrades.GetStatAdditive("crit_damage");
            return mult + Game.Equipment.GetAffixSum("crit_damage")
                        + Game.Relics.GetEffectAdditive("crit_damage")
                        + Game.Pets.GetActiveBonusAdditive("crit_damage")
                        + Game.Skills.GetStatAdditive("crit_damage");
        }

        /// <summary>Multiplier applied to all essence earned from kills.</summary>
        public float GetEssenceGainMultiplier()
        {
            float mult = Game.Upgrades.GetStatMultiplier("essence_gain");
            mult *= 1f + Game.Equipment.GetAffixSum("essence");
            mult *= 1f + Game.Pets.GetActiveBonusAdditive("essence");
            mult *= 1f + Game.Skills.GetStatAdditive("essence");
            mult *= Game.Relics.GetEffectMultiplier("essence");
            return mult;
        }

        /// <summary>Multiplier applied to damage against bosses only
        /// (CombatManager applies it when the target is a boss). 1.0 = no
        /// bonus.</summary>
        public float GetBossDamageMultiplier()
        {
            return 1f + Game.Equipment.GetAffixSum("boss")
                      + Game.Relics.GetEffectAdditive("boss")
                      + Game.Pets.GetActiveBonusAdditive("boss")
                      + Game.Skills.GetStatAdditive("boss");
        }

        /// <summary>Fraction of the live essence rate paid out for time away.
        /// The Eclipse Heart relic multiplies this (x3 -> 1.5), and the Deep
        /// Rest power raises the base. The offline-doubler ad is NOT applied
        /// here: it doubles the amount already granted, at the modal, rather
        /// than the rate that produced it.</summary>
        public float GetOfflineMultiplier()
        {
            float baseEfficiency = BaseOfflineEfficiency
                                   + Game.Skills.GetStatAdditive("offline_efficiency");
            return baseEfficiency * Game.Relics.GetOfflineMultiplier();
        }

        /// <summary>Expected damage of one hit averaged over crit probability —
        /// the basis for offline kill-rate estimates.</summary>
        public float GetAverageDamagePerHit()
            => GetTapDamage() * (1f + GetCritChance() * (GetCritMultiplier() - 1f));

        /// <summary>Roll one tap attack, including the critical-hit check.</summary>
        public (float Amount, bool IsCrit) RollTapDamage()
        {
            float amount = GetTapDamage();
            bool isCrit = Random.value < GetCritChance();
            if (isCrit) amount *= GetCritMultiplier();
            return (amount, isCrit);
        }
    }
}
