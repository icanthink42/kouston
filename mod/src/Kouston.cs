using KSP.UI.Screens;
using Kouston.Network;
using Kouston.UI;
using UnityEngine;

namespace Kouston
{
    [KSPAddon(KSPAddon.Startup.AllGameScenes, false)]
    public class Kouston : MonoBehaviour
    {
        public static Kouston Instance { get; private set; }
        public static Client Client { get; private set; }
        public static bool IsViewLocked { get; private set; } = false;

        private ConnectWindow connectWindow;
        private ApplicationLauncherButton toolbarButton;
        private Texture2D buttonTexture;
        private float telemetryInterval = 0.5f;
        private float lastTelemetryTime;

        // EVA first-person camera
        private float evaPitch = 0f;
        private float evaYaw = 0f;
        private bool wasInEva = false;
        private bool wasRagdoll = false;
        private bool flightCameraWasEnabled = true;
        private bool evaMenuOpen = false;
        private const float MouseSensitivity = 2f;

        public void Start()
        {
            Instance = this;
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

            // Track EVA state transitions
            bool isInEva = IsViewLocked && HighLogic.LoadedSceneIsFlight && FlightGlobals.ActiveVessel != null && FlightGlobals.ActiveVessel.isEVA;

            if (isInEva && !wasInEva)
            {
                // Just entered EVA mode - initialize
                EnterEvaFirstPerson();
            }
            else if (!isInEva && wasInEva)
            {
                // Just left EVA mode - cleanup
                ExitEvaFirstPerson();
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
        private const string EvaLockID = "KoustonEvaLock";

        private void EnterEvaFirstPerson()
        {
            var kerbal = FlightGlobals.ActiveVessel?.evaController;
            if (kerbal == null)
                return;

            wasInEva = true;
            evaMenuOpen = false;

            // Get initial yaw from kerbal's forward direction projected onto horizontal plane
            Vector3 localUp = (kerbal.transform.position - FlightGlobals.ActiveVessel.mainBody.position).normalized;
            Vector3 forward = kerbal.transform.forward;
            Vector3 flatForward = Vector3.ProjectOnPlane(forward, localUp).normalized;
            evaYaw = Mathf.Atan2(flatForward.x, flatForward.z) * Mathf.Rad2Deg;
            evaPitch = 0f;

            // Disable FlightCamera's automatic updates
            var flightCamera = FlightCamera.fetch;
            if (flightCamera != null)
            {
                flightCameraWasEnabled = flightCamera.enabled;
                flightCamera.enabled = false;
            }

            // Remove the IVA lock and set EVA lock (block camera modes and pause menu)
            InputLockManager.RemoveControlLock(ViewLockID);
            InputLockManager.SetControlLock(ControlTypes.CAMERAMODES | ControlTypes.PAUSE, EvaLockID);

            // Lock and hide cursor for FPS-style mouse look
            Cursor.lockState = CursorLockMode.Locked;
            Cursor.visible = false;

            // Show UI for EVA prompts (ladder, hatch, etc.)
            GameEvents.onShowUI.Fire();

            Debug.Log("[Kouston] Entered EVA first-person mode");
        }

        private void ExitEvaFirstPerson()
        {
            wasInEva = false;
            evaMenuOpen = false;

            // Re-enable FlightCamera
            var flightCamera = FlightCamera.fetch;
            if (flightCamera != null)
            {
                flightCamera.enabled = flightCameraWasEnabled;
            }

            // Remove EVA lock, restore IVA lock if still in locked mode
            InputLockManager.RemoveControlLock(EvaLockID);
            if (IsViewLocked)
            {
                InputLockManager.SetControlLock(
                    ControlTypes.CAMERACONTROLS | ControlTypes.CAMERAMODES | ControlTypes.PAUSE,
                    ViewLockID
                );
                // Hide UI again for IVA
                GameEvents.onHideUI.Fire();
            }

            // Unlock cursor
            Cursor.lockState = CursorLockMode.None;
            Cursor.visible = true;

            Debug.Log("[Kouston] Exited EVA first-person mode");
        }

        public void LateUpdate()
        {
            // Update EVA camera in LateUpdate to override FlightCamera
            if (wasInEva && FlightGlobals.ActiveVessel != null && FlightGlobals.ActiveVessel.isEVA)
            {
                UpdateEvaFirstPerson();
            }
        }

        private void UpdateEvaFirstPerson()
        {
            var kerbal = FlightGlobals.ActiveVessel.evaController;
            if (kerbal == null)
                return;

            // Right-click to toggle EVA actions menu
            if (Input.GetMouseButtonDown(1))
            {
                evaMenuOpen = !evaMenuOpen;
                Cursor.lockState = evaMenuOpen ? CursorLockMode.None : CursorLockMode.Locked;
                Cursor.visible = evaMenuOpen;
            }

            // Don't process mouse look if menu is open
            if (evaMenuOpen)
                return;

            // Don't override rotation if kerbal is ragdolling - let it recover naturally
            if (kerbal.isRagdoll)
            {
                wasRagdoll = true;
                return;
            }

            // Resync yaw after recovering from ragdoll
            if (wasRagdoll)
            {
                wasRagdoll = false;
                Vector3 up = (kerbal.transform.position - FlightGlobals.ActiveVessel.mainBody.position).normalized;
                Vector3 flatForward = Vector3.ProjectOnPlane(kerbal.transform.forward, up).normalized;
                evaYaw = Mathf.Atan2(flatForward.x, flatForward.z) * Mathf.Rad2Deg;
                evaPitch = 0f;
            }

            // Get mouse input
            float mouseX = Input.GetAxis("Mouse X") * MouseSensitivity;
            float mouseY = Input.GetAxis("Mouse Y") * MouseSensitivity;

            // Update rotation angles
            evaYaw += mouseX;
            evaPitch -= mouseY;
            evaPitch = Mathf.Clamp(evaPitch, -80f, 80f);

            // Get the local "up" direction (away from planet center)
            Vector3 localUp = (kerbal.transform.position - FlightGlobals.ActiveVessel.mainBody.position).normalized;

            // Build rotation relative to local up (gravity)
            Quaternion upRotation = Quaternion.FromToRotation(Vector3.up, localUp);
            Quaternion yawRotation = Quaternion.AngleAxis(evaYaw, Vector3.up);
            kerbal.transform.rotation = upRotation * yawRotation;

            // Position camera at kerbal's head for first-person view
            var cam = FlightCamera.fetch;
            if (cam != null)
            {
                // Get head position (offset up from kerbal center)
                Vector3 headPos = kerbal.transform.position + localUp * 0.5f;

                // Calculate look direction with pitch relative to local orientation
                Quaternion pitchRotation = Quaternion.AngleAxis(evaPitch, Vector3.right);
                Quaternion lookRotation = upRotation * yawRotation * pitchRotation;

                // Set camera position and rotation
                cam.transform.position = headPos;
                cam.transform.rotation = lookRotation;
            }
        }

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

            // Clean up EVA mode if active
            if (Instance != null && Instance.wasInEva)
            {
                Instance.ExitEvaFirstPerson();
            }

            // Remove input locks
            InputLockManager.RemoveControlLock(ViewLockID);
            InputLockManager.RemoveControlLock(EvaLockID);

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
                if (wasInEva)
                {
                    ExitEvaFirstPerson();
                }
                InputLockManager.RemoveControlLock(ViewLockID);
                InputLockManager.RemoveControlLock(EvaLockID);
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
            else if (evaMenuOpen && wasInEva)
            {
                DrawEvaMenu();
            }
        }

        private Rect evaMenuRect = new Rect(Screen.width / 2 - 100, Screen.height / 2 - 150, 200, 300);

        private void DrawEvaMenu()
        {
            var kerbal = FlightGlobals.ActiveVessel?.evaController;
            if (kerbal == null)
                return;

            evaMenuRect = GUILayout.Window(9999, evaMenuRect, DrawEvaMenuWindow, "EVA Actions");
        }

        private void DrawEvaMenuWindow(int windowID)
        {
            var kerbal = FlightGlobals.ActiveVessel?.evaController;
            if (kerbal == null)
                return;

            GUILayout.BeginVertical();

            // Get all events from the KerbalEVA module and other part modules
            foreach (var module in kerbal.part.Modules)
            {
                foreach (var evt in module.Events)
                {
                    if (evt.guiActive && evt.active)
                    {
                        if (GUILayout.Button(evt.guiName))
                        {
                            evt.Invoke();
                            evaMenuOpen = false;
                            Cursor.lockState = CursorLockMode.Locked;
                            Cursor.visible = false;
                        }
                    }
                }
            }

            GUILayout.Space(10);
            if (GUILayout.Button("Close"))
            {
                evaMenuOpen = false;
                Cursor.lockState = CursorLockMode.Locked;
                Cursor.visible = false;
            }

            GUILayout.EndVertical();
            GUI.DragWindow();
        }
    }
}
