import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TelemetryState } from '../models/telemetry';

@Injectable({
  providedIn: 'root'
})
export class TelemetryService {
  private socket: WebSocket | null = null;
  private telemetrySubject = new BehaviorSubject<TelemetryState>({});
  private connectedSubject = new BehaviorSubject<boolean>(false);
  private pollInterval: number | null = null;

  public telemetry$: Observable<TelemetryState> = this.telemetrySubject.asObservable();
  public connected$: Observable<boolean> = this.connectedSubject.asObservable();

  connect(host: string = 'localhost', port: number = 7777): void {
    if (this.socket) {
      this.disconnect();
    }

    const url = `ws://${host}:${port}/web`;
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log('Connected to Kouston server');
      this.connectedSubject.next(true);
      this.startPolling();
    };

    this.socket.onmessage = (event) => {
      try {
        const data: TelemetryState = JSON.parse(event.data);
        this.telemetrySubject.next(data);
      } catch (e) {
        console.error('Failed to parse telemetry:', e);
      }
    };

    this.socket.onclose = () => {
      console.log('Disconnected from Kouston server');
      this.connectedSubject.next(false);
      this.stopPolling();
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  disconnect(): void {
    this.stopPolling();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  private startPolling(): void {
    this.pollInterval = window.setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send('poll');
      }
    }, 500);
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}
