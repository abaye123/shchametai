import { Injectable, signal } from '@angular/core';

export type SoundType = 'move' | 'capture' | 'check' | 'checkmate' | 'game-over' | 'game-start';

@Injectable({
  providedIn: 'root'
})
export class SoundService {
  private readonly STORAGE_KEY = 'shchametai_sound_muted';
  
  isMuted = signal<boolean>(this.loadMutedState());

  private sounds: Record<SoundType, HTMLAudioElement> = {
    'move': new Audio('src/assets/move.mp3'),
    'capture': new Audio('src/assets/capture.mp3'),
    'check': new Audio('src/assets/capture.mp3'), // Using capture sound for check - dramatic!
    'checkmate': new Audio('src/assets/we-remove-the-hook-from-the-chessboard-in-order-to-open-it-later.mp3'),
    'game-over': new Audio('src/assets/we-put-the-figures-back-in-the-box-a-handful.mp3'),
    'game-start': new Audio('src/assets/opening-the-chessboard.mp3')
  };

  constructor() {
    // Preload sounds
    Object.values(this.sounds).forEach(audio => {
      audio.load();
      audio.volume = 0.5;
    });
  }

  private loadMutedState(): boolean {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    return saved === 'true';
  }

  private saveMutedState(muted: boolean) {
    localStorage.setItem(this.STORAGE_KEY, muted.toString());
  }

  toggleMute() {
    this.isMuted.update(v => {
      const newValue = !v;
      this.saveMutedState(newValue);
      return newValue;
    });
  }

  play(type: SoundType) {
    if (this.isMuted()) return;

    const audio = this.sounds[type];
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(e => console.warn('Audio play failed', e));
    }
  }
}
