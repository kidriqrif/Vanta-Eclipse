using System.Collections.Generic;

namespace VantaEclipse.Core
{
    /// <summary>
    /// The save contract every stateful manager implements.
    ///
    /// In Godot this was duck-typed: SaveManager.register_saveable(key, node)
    /// and a call to get_save_data()/load_save_data() by name. C# makes the
    /// contract explicit, which is a straight gain — a manager that forgets
    /// half the pair now fails to compile instead of silently saving nothing.
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
