import { Injectable, signal } from '@angular/core';

export type SoundType = 'move' | 'capture' | 'check' | 'game-over' | 'game-start';

@Injectable({
  providedIn: 'root'
})
export class SoundService {
  isMuted = signal<boolean>(false);

  private sounds: Record<SoundType, HTMLAudioElement> = {
    'move': new Audio('src/assets/move.mp3'),
    'capture': new Audio('src/assets/capture.mp3'),
    'check': new Audio('src/assets/capture.mp3'), // Using capture sound for check - dramatic!
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

  toggleMute() {
    this.isMuted.update(v => !v);
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
