import { AudioEffect } from './AudioEffect';
import { AudioFileResolver } from './AudioFile';
import { JSONObject, JSONValue, Location, LocationToTime, assert, Duration, TimeSignature } from './Common';
import { Instrument } from './Instrument';
import { MidiDataType, NoteMidiData } from './MidiData';
import { MidiEffect } from './MidiEffect';
import { MidiRegion } from './MidiRegion';
import { AbstractTrack } from './Track';

type AudioState = {
  channelStripInput: GainNode;
  panner: StereoPannerNode;
  gain: GainNode;
};

/**
 * An InstrumentTrack is a track that contains MIDI regions, which represent fragments of MIDI
 * that are to be rendered as audio by a built-in instrument or audio module.
 */
export class InstrumentTrack extends AbstractTrack {
  /**
   * The MIDI regions contained in this track. Regions are sorted by their start time, so that
   * they can be played back in order.
   */
  regions: MidiRegion[] = [];

  /**
   * The MIDI effects that are applied to the MIDI regions in this track. They are ordered by
   * their position in the MIDI chain.
   */
  midiEffects: MidiEffect[] = [];

  /**
   * The instrument that is used to render the MIDI regions in this track to audio.
   * The instrument is receiving the MIDI data from the MIDI regions in this track after
   * processing by the MIDI effects.
   */
  instrument: Instrument;

  /**
   * The audio effects that are applied to the audio regions in this track. They are ordered by
   * their position in the audio chain.
   */
  audioEffects: AudioEffect[] = [];

  /**
   * The audio state of this track. This is used to keep track of the audio nodes that are
   * used for rendering within an audio context.
   */
  audioState: AudioState | null = null;

  private _volume: number = 0;

  set volume(value: number) {
    if (value === undefined) {
      return;
    }
    this._volume = value;
    if (this.audioState !== null) {
      this.audioState.gain.gain.value = this.gainFromVolume;
    }
  }

  get volume(): number {
    return this._volume;
  }

  private _pan: number = 0;

  set pan(value: number) {
    if (value === undefined) {
      return;
    }
    this._pan = value;
    if (this.audioState !== null) {
      this.audioState.panner.pan.value = value;
    }
  }

  get pan(): number {
    return this._pan;
  }

  private _enabled: boolean = true;
  private _scheduleContinuation: boolean = false;

  public get enabled(): boolean {
    return this._enabled;
  }

  public set enabled(value: boolean) {
    if (value === undefined || value === this._enabled) {
      return;
    }
    this._enabled = value;
    if (this.audioState !== null) {
      this.audioState.channelStripInput.gain.value = value ? 1 : 0;
      if (!value) {
        this.stop();
      }
    }
    if (value) {
      this._scheduleContinuation = true;
    }
  }

  constructor(name: string, color: string, muted: boolean, instrument: Instrument) {
    super(name, color, muted);
    this.instrument = instrument;
    this.enabled = !muted;
  }

  async initializeAudio(context: AudioContext): Promise<void> {
    if (this.audioState === null) {
      const channelStripInput = context.createGain();
      const gain = context.createGain();
      const panner = context.createStereoPanner();

      await this.instrument.initialize(context);
      this.instrument.connect(channelStripInput);

      channelStripInput.connect(panner);
      panner.connect(gain);
      gain.connect(context.destination);

      channelStripInput.gain.value = this._enabled ? 1 : 0;
      panner.pan.value = this.pan;
      gain.gain.value = this.gainFromVolume;

      this.audioState = { channelStripInput, gain, panner };
    } else {
      assert(
        this.audioState.gain.context === context,
        'Audio nodes already initialized with a different audio context',
      );
    }
  }

  deinitializeAudio(): void {
    if (this.audioState !== null) {
      this.instrument.disconnect();
      this.audioState.gain.disconnect();
      this.audioState.panner.disconnect();
      this.audioState.channelStripInput.disconnect();
      this.audioState = null;
    } else {
      throw new Error('Audio nodes not initialized');
    }
  }

  isAudioInitialized(): boolean {
    return this.audioState !== null;
  }

  // Support for JSON serialization/deserialization
  public static TYPE_TAG = 'instrument';

  get type(): string {
    return InstrumentTrack.TYPE_TAG;
  }

  static fromJson(file: JSONValue, resolver: AudioFileResolver): InstrumentTrack {
    if (typeof file !== 'object') {
      throw new Error('Invalid JSON value for InstrumentTrack');
    }

    const obj = file as JSONObject;
    return new InstrumentTrack(
      obj['name'] as string,
      obj['color'] as string,
      obj['muted'] as boolean,
      {} as Instrument,
    );
  }

  static registerFactory() {
    AbstractTrack.registerFactory(InstrumentTrack.TYPE_TAG, InstrumentTrack.fromJson);
  }

  public splitRegion(regionIndex: number, splitLocation: Location, timeSignature: TimeSignature): void {
    const originalRegion = this.regions[regionIndex];
    if (!originalRegion) return;

    // Calculate the duration of the first part
    const firstPartDuration = originalRegion.position.diff(splitLocation, timeSignature);

    // Calculate the duration of the second part
    const originalRegionEnd = originalRegion.position.add(originalRegion.length, timeSignature);
    const secondPartDuration = splitLocation.diff(originalRegionEnd, timeSignature);

    // Ensure split point is valid (within the region and not at its start/end)
    if (firstPartDuration.compare(new Duration(0,0,0)) <= 0 || secondPartDuration.compare(new Duration(0,0,0)) <= 0) {
      console.warn("Split location is at or outside region boundaries. No split performed.");
      return;
    }

    // Filter MIDI data for the first part
    const firstPartMidiData = originalRegion.midiData.filter(midiEvent => {
      return midiEvent.start.compare(splitLocation) < 0;
    });

    // Filter MIDI data for the second part
    const secondPartMidiData = originalRegion.midiData.filter(midiEvent => {
      return midiEvent.start.compare(splitLocation) >= 0;
    });

    // Create the first new region
    const firstRegion = new MidiRegion(
      firstPartMidiData,
      originalRegion.name,
      originalRegion.color,
      originalRegion.position,
      firstPartDuration,
      firstPartDuration,
      originalRegion.looping,
      originalRegion.muted,
      originalRegion.soloed,
      originalRegion.startLocation
    );

    // Create the second new region
    const secondRegion = new MidiRegion(
      secondPartMidiData,
      originalRegion.name,
      originalRegion.color,
      splitLocation, // New position
      secondPartDuration,
      secondPartDuration,
      originalRegion.looping,
      originalRegion.muted,
      originalRegion.soloed,
      originalRegion.startLocation // startLocation remains the same as it's an absolute reference
    );

    // Replace the original region with the two new ones
    this.regions.splice(regionIndex, 1, firstRegion, secondRegion);
    this.regions.sort((a, b) => a.position.compare(b.position)); // Re-sort to maintain order
  }

  public duplicateRegion(regionIndex: number, targetLocation: Location, timeSignature: TimeSignature): void {
    const originalRegion = this.regions[regionIndex];
    if (!originalRegion) return;

    const duplicatedRegion = new MidiRegion(
      originalRegion.midiData, // Share MIDI data reference for now, deep copy if needed later
      originalRegion.name,
      originalRegion.color,
      targetLocation, // New position
      originalRegion.size,
      originalRegion.length,
      originalRegion.looping,
      originalRegion.muted,
      originalRegion.soloed,
      originalRegion.startLocation
    );

    this.regions.push(duplicatedRegion);
    this.regions.sort((a, b) => a.position.compare(b.position)); // Re-sort to maintain order
  }

  public deleteRegion(regionIndex: number): void {
    this.regions.splice(regionIndex, 1);
  }

  // Playback support
  scheduleAudioEvents(
    timeOffset: number,
    startTime: number,
    endTime: number,
    converter: LocationToTime,
    loopIteration: number,
    continuationTime?: number,
    discontinuationTime?: number,
  ): void {
    // Instrument tracks schedule MIDI which generates audio, so this is empty.
  }

  scheduleMidiEvents(
    timeOffset: number,
    startTime: number,
    endTime: number,
    converter: LocationToTime,
    loopIteration: number,
    continuationTime?: number,
    discontinuationTime?: number,
  ): void {
    if (!this.enabled || !this.isAudioInitialized()) {
      return;
    }

    this.regions.forEach((region) => {
      region.midiData.forEach((midiEvent) => {
        if (midiEvent.type === MidiDataType.Note) {
          const note = midiEvent as NoteMidiData;
          const noteStartTime = converter.convertLocation(note.start);
          const timeSignature = converter.timeSignatureAtLocation(note.start);
          const noteEndTime = converter.convertLocation(note.start.add(note.duration, timeSignature));

          // Schedule notes that start within the current scheduling window
          if (noteStartTime >= startTime && noteStartTime < endTime) {
            this.instrument.noteOn(note.note, note.velocity, timeOffset + noteStartTime);
            this.instrument.noteOff(note.note, timeOffset + noteEndTime);
          }
        }
      });
    });
  }

  adjustDiscontinuationTime(
    timeOffset: number,
    oldDiscontinuationTime: number,
    newDiscontinuationTime: number,
    converter: LocationToTime,
    loopIteration: number,
  ): void {}

  housekeeping(currentTime: number): void {}

  stop(): void {
    this.instrument.stopAll();
  }
}