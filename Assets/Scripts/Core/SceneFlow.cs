using System.Collections;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace VantaEclipse.Core
{
    /// <summary>
    /// All scene changes go through here.
    ///
    /// Fades to black, loads the next scene asynchronously so the game never
    /// freezes during a switch — important once scenes grow heavy with art on
    /// low-end Android devices — then fades back in.
    ///
    /// Usage from anywhere:  Game.Flow.ChangeScene(Scenes.Gameplay);
    ///
    /// Named SceneFlow rather than SceneManager because UnityEngine.SceneManagement
    /// already owns that name, and a type that shadows it inside files that use
    /// both is a permanent papercut.
    /// </summary>
    public sealed class SceneFlow : MonoBehaviour
    {
        public const float FadeDuration = 0.25f;

        /// <summary>The base black, not a violet-tinted one — the transition
        /// should read as the screen going out, not as a colour washing over
        /// it.</summary>
        public static readonly Color FadeColor = new(0.016f, 0.016f, 0.02f);

        bool _isTransitioning;
        Image _fadeImage;
        CanvasGroup _fadeGroup;

        /// <summary>
        /// True while the screen is behind the fade overlay.
        ///
        /// Read by the screenshot harness, which otherwise photographs the
        /// black quarter-second between two screens and reports it as a blank
        /// screen — which is exactly what MinigameHost looked like when it
        /// bounced straight back to Arcade with no board chosen.
        /// </summary>
        public static bool IsTransitioning => Game.IsBooted && Game.Flow != null
                                              && Game.Flow._isTransitioning;

        internal static SceneFlow Spawn()
        {
            var go = new GameObject("[SceneFlow]");
            DontDestroyOnLoad(go);
            var flow = go.AddComponent<SceneFlow>();
            flow.BuildFadeOverlay();
            return flow;
        }

        /// <summary>Switch to another scene with a fade. Safe to call
        /// repeatedly — calls made while a transition is running are
        /// ignored.</summary>
        public void ChangeScene(string sceneName)
        {
            if (_isTransitioning) return;
            StartCoroutine(ChangeSceneRoutine(sceneName));
        }

        IEnumerator ChangeSceneRoutine(string sceneName)
        {
            _isTransitioning = true;
            Game.Events.RaiseSceneTransitionStarted(sceneName);

            // Block all taps while the screen is covered.
            _fadeGroup.blocksRaycasts = true;
            yield return Fade(0f, 1f);

            if (Application.CanStreamedLevelBeLoaded(sceneName))
            {
                var load = SceneManager.LoadSceneAsync(sceneName);
                while (!load.isDone) yield return null;

                // One frame for the new scene's objects to run Awake/Start
                // before it is revealed.
                yield return null;

                yield return Fade(1f, 0f);
                _fadeGroup.blocksRaycasts = false;
                _isTransitioning = false;
                Game.Events.RaiseSceneTransitionFinished(sceneName);
                yield break;
            }

            Debug.LogError($"SceneFlow: scene not in Build Settings: {sceneName}");
            yield return Fade(1f, 0f);
            _fadeGroup.blocksRaycasts = false;
            _isTransitioning = false;

            // Listeners parked their state on SceneTransitionStarted and are
            // waiting for the matching finish. Without this CombatManager
            // leaves _gameplayCurrent false forever, CheckHeldEntry can never
            // fire, and enemies silently stop spawning with no visible cause.
            // The scene never actually changed, so report the one we are still
            // on — not the one that failed to load.
            Game.Events.RaiseSceneTransitionFinished(SceneManager.GetActiveScene().name);
        }

        IEnumerator Fade(float from, float to)
        {
            float elapsed = 0f;
            _fadeGroup.alpha = from;
            while (elapsed < FadeDuration)
            {
                // Unscaled: a transition must work even while the game is
                // paused, or a pause menu can never be left.
                elapsed += Time.unscaledDeltaTime;
                _fadeGroup.alpha = Mathf.Lerp(from, to, elapsed / FadeDuration);
                yield return null;
            }
            _fadeGroup.alpha = to;
        }

        void BuildFadeOverlay()
        {
            var canvasGo = new GameObject("FadeCanvas");
            canvasGo.transform.SetParent(transform, false);

            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            // Above every screen's own canvas.
            canvas.sortingOrder = 32000;
            canvasGo.AddComponent<GraphicRaycaster>();

            _fadeGroup = canvasGo.AddComponent<CanvasGroup>();
            _fadeGroup.alpha = 0f;
            _fadeGroup.blocksRaycasts = false;

            var imageGo = new GameObject("FadeRect");
            imageGo.transform.SetParent(canvasGo.transform, false);
            _fadeImage = imageGo.AddComponent<Image>();
            _fadeImage.color = FadeColor;
            // The fade must cover the physical display, not the safe area —
            // it is the screen going out, so it covers the cutout too.
            var rect = _fadeImage.rectTransform;
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
        }
    }
}
