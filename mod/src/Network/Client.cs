using System;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

namespace Kouston.Network
{
    public class Client
    {
        public bool IsConnected { get; private set; }

        private ClientWebSocket socket;
        private CancellationTokenSource cts;

        public async void Connect(string ip, int port)
        {
            if (IsConnected)
            {
                Debug.Log("[Kouston] Already connected");
                return;
            }

            try
            {
                socket = new ClientWebSocket();
                cts = new CancellationTokenSource();

                var uri = new Uri($"ws://{ip}:{port}/ksp");
                Debug.Log($"[Kouston] Connecting to {uri}...");

                await socket.ConnectAsync(uri, cts.Token);
                IsConnected = true;
                Debug.Log("[Kouston] Connected!");
            }
            catch (Exception ex)
            {
                Debug.LogError($"[Kouston] Connection failed: {ex.Message}");
                IsConnected = false;
            }
        }

        public async void Disconnect()
        {
            if (!IsConnected || socket == null)
                return;

            Debug.Log("[Kouston] Disconnecting...");

            try
            {
                cts?.Cancel();
                if (socket.State == WebSocketState.Open)
                {
                    await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Disconnecting", CancellationToken.None);
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[Kouston] Disconnect error: {ex.Message}");
            }
            finally
            {
                socket?.Dispose();
                socket = null;
                IsConnected = false;
                Debug.Log("[Kouston] Disconnected");
            }
        }

        public async void SendTelemetry(Telemetry telemetry)
        {
            if (!IsConnected || socket == null || socket.State != WebSocketState.Open)
                return;

            try
            {
                string json = JsonUtility.ToJson(telemetry);
                byte[] bytes = Encoding.UTF8.GetBytes(json);
                await socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, cts.Token);
            }
            catch (Exception ex)
            {
                Debug.LogError($"[Kouston] Send failed: {ex.Message}");
                IsConnected = false;
            }
        }
    }
}
