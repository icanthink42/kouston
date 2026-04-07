package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"kouston-server/telemetry"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for now
	},
}

var state = telemetry.NewState()

func handleKSPClient(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	clientID := uuid.New().String()
	log.Printf("KSP client connected: %s", clientID)

	defer func() {
		state.RemoveVessel(clientID)
		log.Printf("KSP client disconnected: %s", clientID)
	}()

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		var vessel telemetry.Vessel
		if err := json.Unmarshal(message, &vessel); err != nil {
			log.Printf("Failed to parse telemetry: %v", err)
			continue
		}

		state.UpdateVessel(clientID, &vessel)
		log.Printf("Telemetry from %s: %s alt=%.0f vel=%.0f", clientID[:8], vessel.Name, vessel.Altitude, vessel.Velocity)
	}
}

func handleWebClient(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	log.Println("Web client connected")

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}

		vessels := state.GetAllVessels()
		data, _ := json.Marshal(vessels)
		if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
			break
		}
	}
}

func main() {
	http.HandleFunc("/ksp", handleKSPClient)
	http.HandleFunc("/web", handleWebClient)

	port := os.Getenv("PORT")
	if port == "" {
		port = "7777"
	}
	addr := ":" + port
	log.Printf("Kouston server starting on %s", addr)
	log.Println("  /ksp - KSP game clients")
	log.Println("  /web - Web viewer clients")

	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
