import { AudioFile } from './AudioFile';
import { Location, LocationToTime, MutableObject, NamedObject, assert } from './Common';
import { PlaybackScheduling } from './Track';

type AudioState = {
  gain: GainNode;
};

/**
 * The default audio file for the metronome.
 *
 * Eventually, this will be configurable by the user.
 */
export const DEFAULT_METRONOME_AUDIO_FILE: string = `/library/samples/sample-pi/drums/one-shots/electric/elec_ping.flac`;

// Alternative audio files to try if the default fails
export const ALTERNATIVE_METRONOME_AUDIO_FILES: string[] = [
  `/library/samples/sample-pi/drums/one-shots/electric/elec_tick.flac`,
  `/library/samples/sample-pi/drums/one-shots/electric/elec_beep.flac`,
  `/library/samples/sample-pi/drums/one-shots/electric/elec_bell.flac`,
];

/**
 * The metronome is a special track that is used to schedule metronome clicks.
 */
export class Metronome implements PlaybackScheduling, NamedObject, MutableObject {
  /**
   * The audio state of this track. This is used to keep track of the audio nodes that are
   * used for rendering within an audio context.
   */
  private _audioState: AudioState | null = null;
  private _lastClickNode: AudioBufferSourceNode | OscillatorNode | null = null;
  private _lastClickTime: number = 0;
  private _audioFile: AudioFile | null = null;
  private _audioFilesToTry: AudioFile[] = [];
  private _currentFileIndex: number = 0;
  private _useOscillatorFallback: boolean = false;

  constructor(readonly audioFile: AudioFile) {
    this._audioFile = audioFile;
    // Create AudioFile instances for all alternatives
    this._audioFilesToTry = [
      audioFile,
      ...ALTERNATIVE_METRONOME_AUDIO_FILES.map(url => {
        const urlObj = new URL(url, document.baseURI);
        console.log(`Creating alternative metronome audio file URL: ${urlObj}`);
        return AudioFile.create(urlObj);
      })
    ];
  }

  prepareInContext(context: AudioContext, callback: () => void): void {
    if (this._audioState === null) {
      this.initializeAudio(context);
    }

    // Try loading the first file
    this._currentFileIndex = 0;
    this._tryLoadFile(context, callback);
  }

  private _tryLoadFile(context: AudioContext, callback: () => void): void {
    if (this._currentFileIndex >= this._audioFilesToTry.length) {
      console.warn('Failed to load any metronome audio file, using oscillator fallback');
      this._useOscillatorFallback = true;
      // Call callback to prevent hanging
      callback();
      return;
    }

    const file = this._audioFilesToTry[this._currentFileIndex];
    console.log(`Loading metronome audio file (${this._currentFileIndex + 1}/${this._audioFilesToTry.length}):`, file.url.toString());
    
    file.load(context, () => {
      // Success - use this file
      this._audioFile = file;
      console.log(`Successfully loaded metronome audio file: ${file.url.toString()}`);
      callback();
    }, (file, error) => {
      // Failed - try next file
      console.error(`Failed to load metronome audio file ${file.url.toString()}:`, error);
      this._currentFileIndex++;
      this._tryLoadFile(context, callback);
    });
  }

  async initializeAudio(context: AudioContext): Promise<void> {
    if (this._audioState === null) {
      const gain = context.createGain();
      gain.connect(context.destination);
      this._audioState = { gain };
    } else {
      assert(
        this._audioState.gain.context === context,
        'Audio nodes already initialized with a different audio context',
      );
    }
  }

  deinitializeAudio(): void {
    if (this._audioState !== null) {
      this._audioState.gain.disconnect();
      this._audioState = null;
    } else {
      throw new Error('Audio nodes not initialized');
    }
  }

  isAudioInitialized(): boolean {
    return this._audioState !== null;
  }

  private scheduleClickWithOscillator(clickTime: number, bar: boolean): void {
    if (this._audioState === null) {
      throw new Error('Audio nodes not initialized');
    }

    const context = this._audioState.gain.context;
    
    // Create oscillator for fallback sound
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    
    // Set frequency based on whether it's a bar or beat
    oscillator.frequency.value = bar ? 880 : 440; // Higher pitch for bar
    
    // Configure gain envelope
    gainNode.gain.setValueAtTime(0.5, clickTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.1);
    
    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(this._audioState.gain);
    
    // Start and stop oscillator
    oscillator.start(clickTime);
    oscillator.stop(clickTime + 0.1);
    
    this._lastClickNode = oscillator;
    this._lastClickTime = clickTime;
  }

  private scheduleClickWithBuffer(clickTime: number, bar: boolean): void {
    if (this._audioState === null || !this._audioFile || !this._audioFile.ready) {
      throw new Error('Audio nodes not initialized or audio file not ready');
    }

    const context = this._audioState.gain.context;
    const buffer = this._audioFile.buffer;
    
    const node = context.createBufferSource();
    node.detune.value = bar ? 700 : 0;
    node.buffer = buffer;
    node.connect(this._audioState.gain);
    node.start(clickTime);
    
    this._lastClickNode = node;
    this._lastClickTime = clickTime;
  }

  private scheduleClick(clickTime: number, bar: boolean): void {
    if (this._useOscillatorFallback) {
      this.scheduleClickWithOscillator(clickTime, bar);
    } else if (this._audioFile && this._audioFile.ready) {
      this.scheduleClickWithBuffer(clickTime, bar);
    } else {
      // Fallback to oscillator if buffer is not ready
      this.scheduleClickWithOscillator(clickTime, bar);
    }
  }

  scheduleAudioEvents(
    timeOffset: number,
    startTime: number,
    endTime: number,
    converter: LocationToTime,
    loopIteration: number,
    continuationTime?: number | undefined,
    discontinuationTime?: number | undefined,
  ): void {
    // If the metronome is muted, do not schedule any events
    if (this.muted) {
      return;
    }

    // For each beat in the interval, schedule a click
    // There should be at most one beat in any given interval we are presented with here, so
    // we will not attempt to schedule multiple metronome ticks.

    let startLocation = converter.convertTime(startTime);
    let timeSignature = converter.timeSignatureAtLocation(startLocation);

    let nextBar = new Location(startLocation.bar + 1, 1, 1);
    let nextBarTime = converter.convertLocation(nextBar);

    if (nextBarTime <= endTime) {
      // Schedule a bar click at the beginning of the next measure
      this.scheduleClick(timeOffset + nextBarTime, true);
      return;
    }

    let nextBeat = new Location(startLocation.bar, startLocation.beat + 1, 1).normalize(
      timeSignature,
    );
    let nextBeatTime = converter.convertLocation(nextBeat);

    if (nextBeatTime <= endTime) {
      // Schedule a beat click at the beginning of the next beat
      this.scheduleClick(timeOffset + nextBeatTime, false);
      return;
    }
  }

  scheduleMidiEvents(
    timeOffset: number,
    startTime: number,
    endTime: number,
    converter: LocationToTime,
    loopIteration: number,
    continuationTime?: number | undefined,
    discontinuationTime?: number | undefined,
  ): void {
    /* no-op */
  }

  adjustDiscontinuationTime(
    timeOffset: number,
    oldDiscontinuationTime: number,
    newDiscontinuationTime: number,
    converter: LocationToTime,
    loopIteration: number,
  ): void {
    /* no-op; these adjustments should not affect the metronome */
  }

  housekeeping(currentTime: number): void {
    if (this._lastClickNode != null && this._lastClickTime < currentTime - 0.1) {
      this._lastClickNode = null;
    }
  }

  stop(): void {
    if (this._lastClickNode !== null) {
      // Check the type of the node and handle accordingly
      if ('buffer' in this._lastClickNode) {
        // For buffer source nodes, we can't stop them directly, they stop automatically
        this._lastClickNode = null;
      } else if ('frequency' in this._lastClickNode) {
        // For oscillator nodes
        (this._lastClickNode as OscillatorNode).stop();
        this._lastClickNode = null;
      }
    }
  }

  name: string = 'Metronome';
  muted: boolean = true;
}