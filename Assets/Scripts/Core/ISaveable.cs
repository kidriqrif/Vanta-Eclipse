using System.Collections.Generic;

namespace VantaEclipse.Core
{
    /// <summary>
    /// The save contract every stateful manager implements.
    ///
    /// The contract is an interface rather than a name-based registration on
    /// purpose: a manager that forgets half the pair fails to compile instead
    /// of silently saving nothing.
    /// </summary>
    public interface ISaveable
    {
        /// <summary>The manager's section key in the save document. Never
        /// rename after release: it is the field name in shipped saves.</summary>
        string SaveKey { get; }

        Dictionary<string, object> GetSaveData();

        /// <summary>Restore from a save section. Must tolerate missing and
        /// malformed fields — the document may come from an older build or a
        /// corrupted file.</summary>
        void LoadSaveData(Dictionary<string, object> data);
    }
}
