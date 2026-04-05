using Kouston.Network;
using UnityEngine;

namespace Kouston.UI
{
    public class ConnectWindow
    {
        private bool showWindow = false;
        private Rect windowRect = new Rect(100, 100, 300, 150);
        private string serverIP = "127.0.0.1";
        private string serverPort = "7777";

        private Client client;

        public ConnectWindow()
        {
            client = new Client();
        }

        public void Show()
        {
            showWindow = true;
        }

        public void Hide()
        {
            showWindow = false;
        }

        public void Draw()
        {
            if (showWindow)
            {
                windowRect = GUI.Window(0, windowRect, DrawWindow, "Kouston - Connect to Server");
            }
        }

        private void DrawWindow(int windowID)
        {
            GUILayout.BeginVertical();

            GUILayout.Label("Server IP:");
            serverIP = GUILayout.TextField(serverIP);

            GUILayout.Label("Port:");
            serverPort = GUILayout.TextField(serverPort);

            GUILayout.Space(10);

            if (GUILayout.Button("Connect"))
            {
                if (int.TryParse(serverPort, out int port))
                {
                    client.Connect(serverIP, port);
                }
                else
                {
                    Debug.LogError("[Kouston] Invalid port number");
                }
            }

            GUILayout.EndVertical();

            GUI.DragWindow();
        }
    }
}
