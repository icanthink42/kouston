using KSP.UI.Screens;
using Kouston.Network;
using Kouston.UI;
using UnityEngine;

namespace Kouston
{
    [KSPAddon(KSPAddon.Startup.AllGameScenes, false)]
    public class Kouston : MonoBehaviour
    {
        public static Client Client { get; private set; }
        public static bool IsViewLocked { get; private set; } = false;

        private ConnectWindow connectWindow;
        private ApplicationLauncherButton toolbarButton;
        private Texture2D buttonTexture;
        private float telemetryInterval = 0.5f;
        private float lastTelemetryTime;

        public void Start()
        {
            Debug.Log("[Kouston] Mod loaded successfully!");

            if (Client == null)
            {
                Client = new Client();
            }

            connectWindow = new ConnectWindow(Client);

            buttonTexture = CreateButtonTexture();
            GameEvents.onGUIApplicationLauncherReady.Add(OnGUIAppLauncherReady);
            GameEvents.onGUIApplicationLauncherDestroyed.Add(OnGUIAppLauncherDestroyed);

            if (ApplicationLauncher.Ready)
            {
                OnGUIAppLauncherReady();
            }
        }

        public void Update()
        {
            // Check for Ctrl+L to unlock view
            if (IsViewLocked && Input.GetKey(KeyCode.LeftControl) && Input.GetKeyDown(KeyCode.L))
            {
                UnlockView();
            }

            if (!Client.IsConnected)
                return;

            if (Time.time - lastTelemetryTime < telemetryInterval)
                return;

            lastTelemetryTime = Time.time;

            if (FlightGlobals.ActiveVessel != null)
            {
                var telemetry = Telemetry.FromVessel(FlightGlobals.ActiveVessel);
                if (telemetry != null)
                {
                    Client.SendTelemetry(telemetry);
                }
            }
        }

        private const string ViewLockID = "KoustonViewLock";

        public static void LockView()
        {
            if (IsViewLocked)
                return;

            // Only works in flight scene
            if (HighLogic.LoadedSceneIsFlight && FlightGlobals.ActiveVessel != null)
            {
                // Switch to IVA (internal) view
                CameraManager.Instance.SetCameraIVA();

                // Lock camera controls and escape key to prevent leaving IVA
                InputLockManager.SetControlLock(
                    ControlTypes.CAMERACONTROLS | ControlTypes.CAMERAMODES | ControlTypes.PAUSE,
                    ViewLockID
                );

                // Hide the UI
                GameEvents.onHideUI.Fire();

                IsViewLocked = true;
                Debug.Log("[Kouston] View locked. Press Ctrl+L to unlock.");
            }
        }

        public static void UnlockView()
        {
            if (!IsViewLocked)
                return;

            // Remove input lock
            InputLockManager.RemoveControlLock(ViewLockID);

            // Show the UI again
            GameEvents.onShowUI.Fire();

            IsViewLocked = false;
            Debug.Log("[Kouston] View unlocked.");
        }

        public void OnDestroy()
        {
            Debug.Log("[Kouston] Mod unloaded.");

            // Make sure to unlock view if locked
            if (IsViewLocked)
            {
                InputLockManager.RemoveControlLock(ViewLockID);
                IsViewLocked = false;
            }

            GameEvents.onGUIApplicationLauncherReady.Remove(OnGUIAppLauncherReady);
            GameEvents.onGUIApplicationLauncherDestroyed.Remove(OnGUIAppLauncherDestroyed);
            RemoveToolbarButton();
        }

        private void OnGUIAppLauncherReady()
        {
            if (toolbarButton == null)
            {
                toolbarButton = ApplicationLauncher.Instance.AddModApplication(
                    OnToolbarButtonOn,
                    OnToolbarButtonOff,
                    null, null, null, null,
                    ApplicationLauncher.AppScenes.ALWAYS,
                    buttonTexture
                );
            }
        }

        private void OnGUIAppLauncherDestroyed()
        {
            RemoveToolbarButton();
        }

        private void RemoveToolbarButton()
        {
            if (toolbarButton != null)
            {
                ApplicationLauncher.Instance.RemoveModApplication(toolbarButton);
                toolbarButton = null;
            }
        }

        private void OnToolbarButtonOn()
        {
            connectWindow.Show();
        }

        private void OnToolbarButtonOff()
        {
            connectWindow.Hide();
        }

        private Texture2D CreateButtonTexture()
        {
            // Create a simple 38x38 texture (standard toolbar icon size)
            Texture2D tex = new Texture2D(38, 38);
            Color[] pixels = new Color[38 * 38];

            for (int i = 0; i < pixels.Length; i++)
            {
                pixels[i] = new Color(0.2f, 0.6f, 1.0f, 1.0f); // Blue color
            }

            tex.SetPixels(pixels);
            tex.Apply();
            return tex;
        }

        public void OnGUI()
        {
            if (!IsViewLocked)
            {
                connectWindow.Draw();
            }
        }
    }
}
