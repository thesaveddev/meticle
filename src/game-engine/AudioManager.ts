type AudioCategory = 'music' | 'narration' | 'effects';

interface SoundInstance {
  category: AudioCategory;
  soundObject: any;
  source: string;
}

class AudioManager {
  private static instance: AudioManager;
  private initialized = false;
  private muted = false;
  private volumes: Record<AudioCategory, number> = {
    music: 0.5,
    narration: 0.8,
    effects: 0.7,
  };
  private activeSounds: Map<AudioCategory, SoundInstance> = new Map();
  private narrationResolve: (() => void) | null = null;
  private AudioModule: any = null;

  private constructor() {}

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const { Audio } = require('expo-av');
      this.AudioModule = Audio;
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      this.initialized = true;
    } catch (error) {
      console.warn('AudioManager: Failed to initialize expo-av. Audio features unavailable.', error);
    }
  }

  private ensureInitialized(): boolean {
    if (!this.initialized || !this.AudioModule) {
      console.warn('AudioManager: Not initialized. Call init() first.');
      return false;
    }
    return true;
  }

  async playSound(category: AudioCategory, source: string): Promise<void> {
    if (!this.ensureInitialized()) return;
    if (this.muted && category !== 'narration') return;

    await this.stopSound(category);

    try {
      const { sound: soundObject } = await this.AudioModule.Sound.createAsync(
        typeof source === 'string' && source.startsWith('http')
          ? { uri: source }
          : typeof source === 'number'
          ? source
          : { uri: source },
        {
          shouldPlay: true,
          volume: this.muted ? 0 : this.volumes[category],
          isLooping: category === 'music',
        }
      );

      const instance: SoundInstance = { category, soundObject, source };
      this.activeSounds.set(category, instance);

      if (category === 'narration') {
        soundObject.setOnPlaybackStatusUpdate(
          (status: any) => {
            if (status.didJustFinish && this.narrationResolve) {
              this.narrationResolve();
              this.narrationResolve = null;
              this.activeSounds.delete('narration');
            }
          }
        );
      }
    } catch (error) {
      console.warn(`AudioManager: Failed to play ${category} sound.`, error);
    }
  }

  async stopSound(category: AudioCategory): Promise<void> {
    const instance = this.activeSounds.get(category);
    if (instance) {
      try {
        await instance.soundObject.stopAsync();
        await instance.soundObject.unloadAsync();
      } catch (error) {
        console.warn(`AudioManager: Failed to stop ${category} sound.`, error);
      }
      this.activeSounds.delete(category);

      if (category === 'narration' && this.narrationResolve) {
        this.narrationResolve();
        this.narrationResolve = null;
      }
    }
  }

  setVolume(category: AudioCategory, volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.volumes[category] = clamped;

    const instance = this.activeSounds.get(category);
    if (instance) {
      try {
        instance.soundObject.setVolumeAsync(this.muted ? 0 : clamped);
      } catch {
        // ignore
      }
    }
  }

  setMuted(value: boolean): void {
    this.muted = value;

    this.activeSounds.forEach((instance, category) => {
      try {
        instance.soundObject.setVolumeAsync(
          value ? 0 : this.volumes[category]
        );
      } catch {
        // ignore
      }
    });
  }

  isMuted(): boolean {
    return this.muted;
  }

  async playNarration(source: string): Promise<void> {
    if (!this.ensureInitialized()) return;

    return new Promise<void>(async (resolve) => {
      this.narrationResolve = resolve;
      await this.playSound('narration', source);
    });
  }

  async stopNarration(): Promise<void> {
    await this.stopSound('narration');
  }

  getVolume(category: AudioCategory): number {
    return this.volumes[category];
  }

  async cleanup(): Promise<void> {
    const stopPromises: Promise<void>[] = [];
    this.activeSounds.forEach((instance) => {
      stopPromises.push(
        (async () => {
          try {
            await instance.soundObject.stopAsync();
            await instance.soundObject.unloadAsync();
          } catch {
            // ignore
          }
        })()
      );
    });

    await Promise.allSettled(stopPromises);
    this.activeSounds.clear();
    this.narrationResolve = null;
  }
}

export default AudioManager;
