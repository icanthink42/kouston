using UnityEngine;

namespace Kouston.Network
{
    public class Client
    {
        public bool IsConnected { get; private set; }

        public void Connect(string ip, int port)
        {
            Debug.Log($"[Kouston] Connecting to {ip}:{port}...");
            // TODO: Implement connection logic
        }

        public void Disconnect()
        {
            Debug.Log("[Kouston] Disconnecting...");
            IsConnected = false;
            // TODO: Implement disconnect logic
        }
    }
}
