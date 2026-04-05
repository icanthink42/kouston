using Kouston.Network;
using UnityEngine;

namespace Kouston.UI
{
    public class ConnectWindow
    {
        private bool showWindow = false;
        private Rect windowRect = new Rect(100, 100, 300, 180);
        private string serverIP = "127.0.0.1";
        private string serverPort = "7777";

        private Client client;

        public ConnectWindow(Client client)
        {
            this.client = client;
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

            string status = client.IsConnected ? "<color=green>Connected</color>" : "<color=red>Disconnected</color>";
            GUILayout.Label($"Status: {status}");

            GUILayout.Space(5);

            GUILayout.Label("Server IP:");
            serverIP = GUILayout.TextField(serverIP);

            GUILayout.Label("Port:");
            serverPort = GUILayout.TextField(serverPort);

            GUILayout.Space(10);

            if (client.IsConnected)
            {
                if (GUILayout.Button("Disconnect"))
                {
                    client.Disconnect();
                }
            }
            else
            {
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
            }

            GUILayout.EndVertical();

            GUI.DragWindow();
        }
    }
}
