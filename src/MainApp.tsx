import {
  Settings,
  FilePlus,
  FolderDown,
  Save,
  Copy,
  Undo,
  Redo,
  Scissors,
  ClipboardPaste,
  Trash2,
  Library,
  Cog,
  Book,
  Github,
  Bug,
  Info,
  Music,
  Music2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Project } from './ui/Project';
import { Project as ProjectObj } from './core/Project';
import { createProject, loadProject, saveAsProject, saveProject } from './controller/Projects';
import { copy, cut, doDelete, paste, redo, undo } from './controller/Edit';
import { useRef, useState } from 'react';
import { Engine } from './core/Engine';
import { BUFFER_SIZE, SAMPLE_RATE } from './core/Config';
import { AudioFileManager } from './core/AudioFileManager';
import { AudioFileManagerContext, EngineContext, AudioContextContext } from './ui/Context';
import { Button } from './components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './components/ui/sheet';
import { parseMidiFile } from './controller/MidiImport';
import { TrackEventType } => './core/Events';
import { AiChat } from './ui/AiChat';
import { InstrumentTrack } from './core/InstrumentTrack';
import { Analog } from './instruments/Analog';
import { MidiRegion } from './core/MidiRegion';
import { Duration, Location } from './core/Common';
import { MidiDataType, NoteMidiData } from './core/MidiData';
import { COLORS } from './ui/Config';
import { SoundFontInstrument } from './instruments/SoundFontInstrument';
import { Instrument } from './core/Instrument';
import { AbstractTrack } from './core/Track';
import { AudioTrack } from './core/AudioTrack';
import { MusicPrism } from './instruments/MusicPrism';

const LICENSE =
  'MIT License\n\nCopyright (c) 2023, 2024 Hans-Martin Will\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.';

function openDocumentation() {
  window.open('https://ai-music.github.io/webdaw-doc/', 'Documentation', 'width=800, height=600');
  return false;
}

// Mapping of common instrument names to WebAudioFont instrument IDs
const instrumentMap: { [key: string]: string } = {
  'acoustic_grand_piano': '_tone_0000_SBLive_sf2',
  'bright_acoustic_piano': '_tone_0001_SBLive_sf2',
  'electric_grand_piano': '_tone_0002_SBLive_sf2',
  'honkytonk_piano': '_tone_0003_SBLive_sf2',
  'electric_piano_1': '_tone_0004_SBLive_sf2',
  'electric_piano_2': '_tone_0005_SBLive_sf2',
  'harpsichord': '_tone_0006_SBLive_sf2',
  'clavinet': '_tone_0007_SBLive_sf2',
  'celesta': '_tone_0008_SBLive_sf2',
  'glockenspiel': '_tone_0009_SBLive_sf2',
  'music_box': '_tone_000A_SBLive_sf2',
  'vibraphone': '_tone_000B_SBLive_sf2',
  'marimba': '_tone_000C_SBLive_sf2',
  'xylophone': '_tone_000D_SBLive_sf2',
  'tubular_bells': '_tone_000E_SBLive_sf2',
  'dulcimer': '_tone_000F_SBLive_sf2',
  'drawbar_organ': '_tone_0010_SBLive_sf2',
  'percussive_organ': '_tone_0011_SBLive_sf2',
  'rock_organ': '_tone_0012_SBLive_sf2',
  'church_organ': '_tone_0013_SBLive_sf2',
  'reed_organ': '_tone_0014_SBLive_sf2',
  'accordion': '_tone_0015_SBLive_sf2',
  'harmonica': '_tone_0016_SBLive_sf2',
  'tango_accordion': '_tone_0017_SBLive_sf2',
  'acoustic_guitar_nylon': '_tone_0018_SBLive_sf2',
  'acoustic_guitar_steel': '_tone_0019_SBLive_sf2',
  'electric_guitar_jazz': '_tone_001A_SBLive_sf2',
  'electric_guitar_clean': '_tone_001B_SBLive_sf2',
  'electric_guitar_muted': '_tone_001C_SBLive_sf2',
  'overdriven_guitar': '_tone_001D_SBLive_sf2',
  'distortion_guitar': '_tone_001E_SBLive_sf2',
  'guitar_harmonics': '_tone_001F_SBLive_sf2',
  'acoustic_bass': '_tone_0020_SBLive_sf2',
  'electric_bass_finger': '_tone_0021_SBLive_sf2',
  'electric_bass_pick': '_tone_0022_SBLive_sf2',
  'fretless_bass': '_tone_0023_SBLive_sf2',
  'slap_bass_1': '_tone_0024_SBLive_sf2',
  'slap_bass_2': '_tone_0025_SBLive_sf2',
  'synth_bass_1': '_tone_0026_SBLive_sf2',
  'synth_bass_2': '_tone_0027_SBLive_sf2',
  'violin': '_tone_0028_SBLive_sf2',
  'viola': '_tone_0029_SBLive_sf2',
  'cello': '_tone_002A_SBLive_sf2',
  'contrabass': '_tone_002B_SBLive_sf2',
  'tremolo_strings': '_tone_002C_SBLive_sf2',
  'pizzicato_strings': '_tone_002D_SBLive_sf2',
  'orchestral_harp': '_tone_002E_SBLive_sf2',
  'timpani': '_tone_002F_SBLive_sf2',
  'string_ensemble_1': '_tone_0030_SBLive_sf2',
  'string_ensemble_2': '_tone_0031_SBLive_sf2',
  'synth_strings_1': '_tone_0032_SBLive_sf2',
  'synth_strings_2': '_tone_0033_SBLive_sf2',
  'choir_aahs': '_tone_0038_SBLive_sf2',
  'voice_oohs': '_tone_0039_SBLive_sf2',
  'synth_voice': '_tone_003A_SBLive_sf2',
  'orchestra_hit': '_tone_003B_SBLive_sf2',
  'trumpet': '_tone_003C_SBLive_sf2',
  'trombone': '_tone_003D_SBLive_sf2',
  'tuba': '_tone_003E_SBLive_sf2',
  'muted_trumpet': '_tone_003F_SBLive_sf2',
  'french_horn': '_tone_0040_SBLive_sf2',
  'brass_section': '_tone_0041_SBLive_sf2',
  'synth_brass_1': '_tone_0042_SBLive_sf2',
  'synth_brass_2': '_tone_0043_SBLive_sf2',
  'soprano_sax': '_tone_0044_SBLive_sf2',
  'alto_sax': '_tone_0045_SBLive_sf2',
  'tenor_sax': '_tone_0046_SBLive_sf2',
  'baritone_sax': '_tone_0047_SBLive_sf2',
  'oboe': '_tone_0048_SBLive_sf2',
  'english_horn': '_tone_0049_SBLive_sf2',
  'bassoon': '_tone_004A_SBLive_sf2',
  'clarinet': '_tone_004B_SBLive_sf2',
  'piccolo': '_tone_004C_SBLive_sf2',
  'flute': '_tone_004D_SBLive_sf2',
  'recorder': '_tone_004E_SBLive_sf2',
  'pan_flute': '_tone_004F_SBLive_sf2',
  'blown_bottle': '_tone_0050_SBLive_sf2',
  'shakuhachi': '_tone_0051_SBLive_sf2',
  'whistle': '_tone_0052_SBLive_sf2',
  'ocarina': '_tone_0053_SBLive_sf2',
  'lead_1_square': '_tone_0054_SBLive_sf2',
  'lead_2_sawtooth': '_tone_0055_SBLive_sf2',
  'lead_3_calliope': '_tone_0056_SBLive_sf2',
  'lead_4_chiff': '_tone_0057_SBLive_sf2',
  'lead_5_charang': '_tone_0058_SBLive_sf2',
  'lead_6_voice': '_tone_0059_SBLive_sf2',
  'lead_7_fifths': '_tone_005A_SBLive_sf2',
  'lead_8_bass_lead': '_tone_005B_SBLive_sf2',
  'pad_1_new_age': '_tone_005C_SBLive_sf2',
  'pad_2_warm': '_tone_005D_SBLive_sf2',
  'pad_3_polysynth': '_tone_005E_SBLive_sf2',
  'pad_4_choir': '_tone_005F_SBLive_sf2',
  'pad_5_bowed': '_tone_0060_SBLive_sf2',
  'pad_6_metallic': '_tone_0061_SBLive_sf2',
  'pad_7_halo': '_tone_0062_SBLive_sf2',
  'pad_8_sweep': '_tone_0063_SBLive_sf2',
  'fx_1_rain': '_tone_0064_SBLive_sf2',
  'fx_2_soundtrack': '_tone_0065_SBLive_sf2',
  'fx_3_crystal': '_tone_0066_SBLive_sf2',
  'fx_4_atmosphere': '_tone_0067_SBLive_sf2',
  'fx_5_brightness': '_tone_0068_SBLive_sf2',
  'fx_6_goblin': '_tone_0069_SBLive_sf2',
  'fx_7_echoes': '_tone_006A_SBLive_sf2',
  'fx_8_sci_fi': '_tone_006B_SBLive_sf2',
  'sitar': '_tone_006C_SBLive_sf2',
  'banjo': '_tone_006D_SBLive_sf2',
  'shamisen': '_tone_006E_SBLive_sf2',
  'koto': '_tone_006F_SBLive_sf2',
  'kalimba': '_tone_0070_SBLive_sf2',
  'bagpipe': '_tone_0071_SBLive_sf2',
  'fiddle': '_tone_0072_SBLive_sf2',
  'shanai': '_tone_0073_SBLive_sf2',
  'tinkle_bell': '_tone_0074_SBLive_sf2',
  'agogo': '_tone_0075_SBLive_sf2',
  'steel_drums': '_tone_0076_SBLive_sf2',
  'woodblock': '_tone_0077_SBLive_sf2',
  'taiko_drum': '_tone_0078_SBLive_sf2',
  'melodic_tom': '_tone_0079_SBLive_sf2',
  'synth_drum': '_tone_007A_SBLive_sf2',
  'reverse_cymbal': '_tone_007B_SBLive_sf2',
  'guitar_fret_noise': '_tone_007C_SBLive_sf2',
  'breath_noise': '_tone_007D_SBLive_sf2',
  'seashore': '_tone_007E_SBLive_sf2',
  'bird_tweet': '_tone_007F_SBLive_sf2',
  'telephone_ring': '_tone_0080_SBLive_sf2',
  'helicopter': '_tone_0081_SBLive_sf2',
  'applause': '_tone_0082_SBLive_sf2',
  'gunshot': '_tone_0083_SBLive_sf2',
  'drums': '_drum_35_51_0_SBLive_sf2', // Special drum kit
  'analog': 'analog', // Custom analog synth
  'music_prism': 'music_prism', // Custom Music Prism WAM
  // Expanded list of instruments from WebAudioFont
  'acoustic_grand_piano': '_tone_0000_SBLive_sf2',
  'bright_acoustic_piano': '_tone_0001_SBLive_sf2',
  'electric_grand_piano': '_tone_0002_SBLive_sf2',
  'honkytonk_piano': '_tone_0003_SBLive_sf2',
  'electric_piano_1': '_tone_0004_SBLive_sf2',
  'electric_piano_2': '_tone_0005_SBLive_sf2',
  'harpsichord': '_tone_0006_SBLive_sf2',
  'clavinet': '_tone_0007_SBLive_sf2',
  'celesta': '_tone_0008_SBLive_sf2',
  'glockenspiel': '_tone_0009_SBLive_sf2',
  'music_box': '_tone_000A_SBLive_sf2',
  'vibraphone': '_tone_000B_SBLive_sf2',
  'marimba': '_tone_000C_SBLive_sf2',
  'xylophone': '_tone_000D_SBLive_sf2',
  'tubular_bells': '_tone_000E_SBLive_sf2',
  'dulcimer': '_tone_000F_SBLive_sf2',
  'drawbar_organ': '_tone_0010_SBLive_sf2',
  'percussive_organ': '_tone_0011_SBLive_sf2',
  'rock_organ': '_tone_0012_SBLive_sf2',
  'church_organ': '_tone_0013_SBLive_sf2',
  'reed_organ': '_tone_0014_SBLive_sf2',
  'accordion': '_tone_0015_SBLive_sf2',
  'harmonica': '_tone_0016_SBLive_sf2',
  'tango_accordion': '_tone_0017_SBLive_sf2',
  'acoustic_guitar_nylon': '_tone_0018_SBLive_sf2',
  'acoustic_guitar_steel': '_tone_0019_SBLive_sf2',
  'electric_guitar_jazz': '_tone_001A_SBLive_sf2',
  'electric_guitar_clean': '_tone_001B_SBLive_sf2',
  'electric_guitar_muted': '_tone_001C_SBLive_sf2',
  'overdriven_guitar': '_tone_001D_SBLive_sf2',
  'distortion_guitar': '_tone_001E_SBLive_sf2',
  'guitar_harmonics': '_tone_001F_SBLive_sf2',
  'acoustic_bass': '_tone_0020_SBLive_sf2',
  'electric_bass_finger': '_tone_0021_SBLive_sf2',
  'electric_bass_pick': '_tone_0022_SBLive_sf2',
  'fretless_bass': '_tone_0023_SBLive_sf2',
  'slap_bass_1': '_tone_0024_SBLive_sf2',
  'slap_bass_2': '_tone_0025_SBLive_sf2',
  'synth_bass_1': '_tone_0026_SBLive_sf2',
  'synth_bass_2': '_tone_0027_SBLive_sf2',
  'violin': '_tone_0028_SBLive_sf2',
  'viola': '_tone_0029_SBLive_sf2',
  'cello': '_tone_002A_SBLive_sf2',
  'contrabass': '_tone_002B_SBLive_sf2',
  'tremolo_strings': '_tone_002C_SBLive_sf2',
  'pizzicato_strings': '_tone_002D_SBLive_sf2',
  'orchestral_harp': '_tone_002E_SBLive_sf2',
  'timpani': '_tone_002F_SBLive_sf2',
  'string_ensemble_1': '_tone_0030_SBLive_sf2',
  'string_ensemble_2': '_tone_0031_SBLive_sf2',
  'synth_strings_1': '_tone_0032_SBLive_sf2',
  'synth_strings_2': '_tone_0033_SBLive_sf2',
  'choir_aahs': '_tone_0038_SBLive_sf2',
  'voice_oohs': '_tone_0039_SBLive_sf2',
  'synth_voice': '_tone_003A_SBLive_sf2',
  'orchestra_hit': '_tone_003B_SBLive_sf2',
  'trumpet': '_tone_003C_SBLive_sf2',
  'trombone': '_tone_003D_SBLive_sf2',
  'tuba': '_tone_003E_SBLive_sf2',
  'muted_trumpet': '_tone_003F_SBLive_sf2',
  'french_horn': '_tone_0040_SBLive_sf2',
  'brass_section': '_tone_0041_SBLive_sf2',
  'synth_brass_1': '_tone_0042_SBLive_sf2',
  'synth_brass_2': '_tone_0043_SBLive_sf2',
  'soprano_sax': '_tone_0044_SBLive_sf2',
  'alto_sax': '_tone_0045_SBLive_sf2',
  'tenor_sax': '_tone_0046_SBLive_sf2',
  'baritone_sax': '_tone_0047_SBLive_sf2',
  'oboe': '_tone_0048_SBLive_sf2',
  'english_horn': '_tone_0049_SBLive_sf2',
  'bassoon': '_tone_004A_SBLive_sf2',
  'clarinet': '_tone_004B_SBLive_sf2',
  'piccolo': '_tone_004C_SBLive_sf2',
  'flute': '_tone_004D_SBLive_sf2',
  'recorder': '_tone_004E_SBLive_sf2',
  'pan_flute': '_tone_004F_SBLive_sf2',
  'blown_bottle': '_tone_0050_SBLive_sf2',
  'shakuhachi': '_tone_0051_SBLive_sf2',
  'whistle': '_tone_0052_SBLive_sf2',
  'ocarina': '_tone_0053_SBLive_sf2',
  'lead_1_square': '_tone_0054_SBLive_sf2',
  'lead_2_sawtooth': '_tone_0055_SBLive_sf2',
  'lead_3_calliope': '_tone_0056_SBLive_sf2',
  'lead_4_chiff': '_tone_0057_SBLive_sf2',
  'lead_5_charang': '_tone_0058_SBLive_sf2',
  'lead_6_voice': '_tone_0059_SBLive_sf2',
  'lead_7_fifths': '_tone_005A_SBLive_sf2',
  'lead_8_bass_lead': '_tone_005B_SBLive_sf2',
  'pad_1_new_age': '_tone_005C_SBLive_sf2',
  'pad_2_warm': '_tone_005D_SBLive_sf2',
  'pad_3_polysynth': '_tone_005E_SBLive_sf2',
  'pad_4_choir': '_tone_005F_SBLive_sf2',
  'pad_5_bowed': '_tone_0060_SBLive_sf2',
  'pad_6_metallic': '_tone_0061_SBLive_sf2',
  'pad_7_halo': '_tone_0062_SBLive_sf2',
  'pad_8_sweep': '_tone_0063_SBLive_sf2',
  'fx_1_rain': '_tone_0064_SBLive_sf2',
  'fx_2_soundtrack': '_tone_0065_SBLive_sf2',
  'fx_3_crystal': '_tone_0066_SBLive_sf2',
  'fx_4_atmosphere': '_tone_0067_SBLive_sf2',
  'fx_5_brightness': '_tone_0068_SBLive_sf2',
  'fx_6_goblin': '_tone_0069_SBLive_sf2',
  'fx_7_echoes': '_tone_006A_SBLive_sf2',
  'fx_8_sci_fi': '_tone_006B_SBLive_sf2',
  'sitar': '_tone_006C_SBLive_sf2',
  'banjo': '_tone_006D_SBLive_sf2',
  'shamisen': '_tone_006E_SBLive_sf2',
  'koto': '_tone_006F_SBLive_sf2',
  'kalimba': '_tone_0070_SBLive_sf2',
  'bagpipe': '_tone_0071_SBLive_sf2',
  'fiddle': '_tone_0072_SBLive_sf2',
  'shanai': '_tone_0073_SBLive_sf2',
  'tinkle_bell': '_tone_0074_SBLive_sf2',
  'agogo': '_tone_0075_SBLive_sf2',
  'steel_drums': '_tone_0076_SBLive_sf2',
  'woodblock': '_tone_0077_SBLive_sf2',
  'taiko_drum': '_tone_0078_SBLive_sf2',
  'melodic_tom': '_tone_0079_SBLive_sf2',
  'synth_drum': '_tone_007A_SBLive_sf2',
  'reverse_cymbal': '_tone_007B_SBLive_sf2',
  'guitar_fret_noise': '_tone_007C_SBLive_sf2',
  'breath_noise': '_tone_007D_SBLive_sf2',
  'seashore': '_tone_007E_SBLive_sf2',
  'bird_tweet': '_tone_007F_SBLive_sf2',
  'telephone_ring': '_tone_0080_SBLive_sf2',
  'helicopter': '_tone_0081_SBLive_sf2',
  'applause': '_tone_0082_SBLive_sf2',
  'gunshot': '_tone_0083_SBLive_sf2',
  'drums': '_drum_35_51_0_SBLive_sf2', // Special drum kit
  'analog': 'analog', // Custom analog synth
  'music_prism': 'music_prism', // Custom Music Prism WAM
};

function createInstrument(name: string): Instrument {
  const lowerName = name.toLowerCase();
  if (lowerName === 'analog') {
    return new Analog();
  }
  if (lowerName === 'music_prism') {
    return new MusicPrism();
  }
  
  const instrumentId = instrumentMap[lowerName];
  if (instrumentId) {
    return new SoundFontInstrument(name, instrumentId);
  }
  
  // Default to acoustic grand piano if not found
  console.warn(`Instrument '${name}' not found in map, defaulting to Acoustic Grand Piano.`);
  return new SoundFontInstrument('acoustic_grand_piano', instrumentMap['acoustic_grand_piano']);
}

function MainApp() {
  const [engineContainer, setEngineContainer] = useState<{
    engine: Engine;
    initialProject: ProjectObj;
    context: AudioContext;
  } | null>(null);

  const [isInitialized, setIsInitialized] = useState(false);

  const audioFileManager = useRef<AudioFileManager>(new AudioFileManager());
  const midiFileInputRef = useRef<HTMLInputElement>(null);

  const [project, setProject] = useState<ProjectObj | null>(null);
  const [tracks, setTracks] = useState<AbstractTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [confirmStopAudio, setConfirmStopAudio] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [mixerVisible, setMixerVisible] = useState(false);
  const [browserVisible, setBrowserVisible] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [editingRegion, setEditingRegion] = useState<{
    trackIndex: number;
    regionIndex: number;
  } | null>(null);

  const continueChangeProject = useRef<() => void>();

  const initializeApp = () => {
    if (isInitialized) return;

    const context = new AudioContext();
    const initialProject = new ProjectObj();
    const engine = new Engine(context, { bufferSize: BUFFER_SIZE, sampleRate: SAMPLE_RATE }, initialProject);

    setEngineContainer({ engine, initialProject, context });
    setProject(initialProject);
    setTracks(initialProject.tracks);

    setLoading(true);
    engine.initialize(() => {
      setLoading(false);
    });

    setIsInitialized(true);
  };

  if (!isInitialized) {
    return (
      <div
        className="flex h-screen w-screen cursor-pointer items-center justify-center bg-background text-foreground"
        onClick={initializeApp}
      >
        <div className="text-center">
          <h1 className="text-3xl font-bold">WebDAW</h1>
          <p className="text-muted-foreground">Click anywhere to start the audio engine</p>
        </div>
      </div>
    );
  }

  if (!engineContainer || !project) {
    // This should not be reached if isInitialized is true, but it's a good safeguard.
    return <div>Loading...</div>;
  }

  const { engine, context: audioContext } = engineContainer;

  function loadFiles(project: ProjectObj) {
    setLoading(true);
    project.loadFiles(
      engine.context,
      (project) => {
        engine.project = project;
        setProject(project);
        setTracks(project.tracks);
        setLoading(false);
      },
      (project, progress) => {
        setLoadingProgress(progress);
      },
    );
  }

  function changeProject(action: () => void) {
    continueChangeProject.current = action;
    if (engine.isPlaying) {
      setConfirmStopAudio(true);
    } else {
      action();
    }
  }

  function appendTrack(trackType: string) {
    if (!project) return;
    let newTrack: AbstractTrack | null = null;
    if (trackType === 'audio') {
      newTrack = new AudioTrack();
    } else if (trackType === 'music-prism') {
      const instrument = new MusicPrism();
      newTrack = new InstrumentTrack('Music Prism', '#DA70D6', false, instrument);
    }

    if (newTrack) {
      project.appendTrack(newTrack);

      engine.handleTrackEvent({
        type: TrackEventType.Added,
        track: newTrack,
      });

      setTracks([...project.tracks]);
    }
  }

  const handleMidiFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !project) {
      return;
    }

    setLoading(true);
    setLoadingProgress(0);

    try {
      const newMidiTracks = await parseMidiFile(file, project);

      if (newMidiTracks.length > 0) {
        const updatedTracks = [...project.tracks, ...newMidiTracks];
        project.tracks = updatedTracks;

        for (const track of newMidiTracks) {
          await engine.handleTrackEvent({
            type: TrackEventType.Added,
            track: track,
          });
        }

        setTracks(updatedTracks);
      }
    } catch (error) {
      console.error('Failed to import MIDI file:', error);
    } finally {
      setLoading(false);
      if (midiFileInputRef.current) {
        midiFileInputRef.current.value = '';
      }
    }
  };

  const handleMidiPatternGenerated = async (pattern: any) => {
    if (!project) return;
    if (!pattern.trackName || !pattern.notes || !Array.isArray(pattern.notes) || pattern.notes.length === 0) {
      console.error('Invalid MIDI pattern object received from AI', pattern);
      return;
    }

    const timeSignature = project.timeSignature;

    const notes: NoteMidiData[] = pattern.notes.map((note: any) => ({
      type: MidiDataType.Note,
      note: note.note,
      velocity: note.velocity,
      start: new Location(note.start.bar, note.start.beat, note.start.tick),
      duration: new Duration(note.duration.bar, note.duration.beat, note.duration.tick),
    }));

    const firstNoteStart = notes.reduce((min, p) => (p.start.compare(min.start) < 0 ? p : min))
      .start;
    const lastNoteEnd = notes.reduce((max, p) => {
      const end = p.start.add(p.duration, timeSignature);
      const maxEnd = max.start.add(max.duration, timeSignature);
      return end.compare(maxEnd) > 0 ? p : max;
    });
    const lastNoteEndLocation = lastNoteEnd.start.add(lastNoteEnd.duration, timeSignature);
    const regionDuration = firstNoteStart.diff(lastNoteEndLocation, timeSignature);

    const trackName = pattern.trackName || 'AI Generated Track';
    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];

    const region = new MidiRegion(notes, trackName, randomColor, firstNoteStart, regionDuration);

    const instrument = createInstrument(pattern.instrument || 'acoustic_grand_piano');
    const newTrack = new InstrumentTrack(trackName, randomColor, false, instrument);
    newTrack.regions.push(region);

    project.appendTrack(newTrack);

    await engine.handleTrackEvent({
      type: TrackEventType.Added,
      track: newTrack,
    });

    setTracks([...project.tracks]);
  };

  const handleRegionDoubleClick = (trackIndex: number, regionIndex: number) => {
    if (!project) return;
    const track = project.tracks[trackIndex];
    const region = track.regions[regionIndex];
    if (track.type === 'instrument' && region) {
      // Toggle editor: if it's the same region, close it. Otherwise, open the new one.
      if (
        editingRegion &&
        editingRegion.trackIndex === trackIndex &&
        editingRegion.regionIndex === regionIndex
      ) {
        setEditingRegion(null);
      } else {
        setEditingRegion({ trackIndex, regionIndex });
      }
    }
  };

  return (
    <EngineContext.Provider value={engine}>
      <AudioContextContext.Provider value={audioContext}>
        <Dialog open={showAbout} onOpenChange={setShowAbout}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>About WebDAW</DialogTitle>
            </DialogHeader>
            <div className="flex items-center space-x-4">
              <img src="logo-192.png" alt="WebDAW Logo" width="96" />
              <div>
                <p>Welcome to</p>
                <h1 className="text-2xl font-bold">WebDAW</h1>
                <p>Copyright &copy; 2023, 2024 Hans-Martin Will</p>
              </div>
            </div>
            <DialogDescription>
              WebDAW is a digital audio workstation (DAW) that runs in the browser.
            </DialogDescription>
            <textarea
              readOnly
              className="mt-4 w-full h-32 p-2 border rounded text-xs bg-muted"
              value={LICENSE}
            />
            <DialogFooter>
              <Button onClick={() => setShowAbout(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={loading}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Loading Project</DialogTitle>
              <DialogDescription>
                Please wait while the project is being loaded...
              </DialogDescription>
            </DialogHeader>
            <div className="w-full bg-muted rounded-full h-2.5 mt-4">
              <div
                className="bg-primary h-2.5 rounded-full"
                style={{ width: `${loadingProgress * 100}%` }}
              ></div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={confirmStopAudio} onOpenChange={setConfirmStopAudio}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Stop Audio?</DialogTitle>
            </DialogHeader>
            <DialogDescription>
              Proceeding with this action will stop all audio. Are you sure you want to continue?
            </DialogDescription>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmStopAudio(false)}>
                No
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmStopAudio(false);
                  continueChangeProject.current?.();
                }}
              >
                Yes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div
          className="h-screen max-h-screen w-screen flex flex-row bg-background text-foreground"
        >
          <main className="flex-grow flex flex-col overflow-hidden bg-background text-foreground">
            <AudioFileManagerContext.Provider value={audioFileManager.current}>
              <Project
                project={project}
                tracks={tracks}
                setTracks={setTracks}
                mixerVisible={mixerVisible}
                setMixerVisible={setMixerVisible}
                browserVisible={browserVisible}
                setBrowserVisible={setBrowserVisible}
                editingRegion={editingRegion}
                setEditingRegion={setEditingRegion}
                onRegionDoubleClick={handleRegionDoubleClick}
                appendTrack={appendTrack}
              />
            </AudioFileManagerContext.Provider>
          </main>
          <aside className="w-96 flex-shrink-0 border-l border-border bg-muted flex flex-col">
              <div className="p-4 border-b border-border">
                <h2 className="text-lg font-semibold flex items-center">
                  <Sparkles className="h-5 w-5 mr-2 text-yellow-400" />
                  AI Music Assistant
                </h2>
              </div>
              <div className="flex-grow p-4 overflow-y-auto">
                <AiChat onMidiPatternGenerated={handleMidiPatternGenerated} />
              </div>
          </aside>
          <input
            type="file"
            ref={midiFileInputRef}
            onChange={handleMidiFileImport}
            accept=".mid,.midi"
            style={{ display: 'none' }}
          />
        </div>

        <Sheet open={showSettings} onOpenChange={setShowSettings}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Settings</SheetTitle>
              <SheetDescription>
                Configure your application settings here.
              </SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      </AudioContextContext.Provider>
    </EngineContext.Provider>
  );
}

export default MainApp;