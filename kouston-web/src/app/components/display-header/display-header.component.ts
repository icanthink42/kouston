import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface PageOption {
  value: string;
  label: string;
  selected?: boolean;
}

@Component({
  selector: 'app-display-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './display-header.component.html',
  styleUrl: './display-header.component.scss'
})
export class DisplayHeaderComponent {
  @Input() title = '';
  @Input() connected = false;
  @Input() showHomeButton = false;
  @Input() showPageDropdown = false;
  @Input() pageOptions: PageOption[] = [];
  @Input() subtitle?: string;

  @Output() navigate = new EventEmitter<string>();
  @Output() homeClick = new EventEmitter<void>();

  onPageChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.navigate.emit(select.value);
  }
}
