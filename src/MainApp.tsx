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
import { loadAndParseMidiFromUrl, parseMidiFile } from './controller/MidiImport';
import { TrackEventType } from './core/Events';
import { AiChat } from './ui/AiChat';
import { InstrumentTrack } from './core/InstrumentTrack';
import { Analog } from './instruments/Analog';
import { MidiRegion } from './core/MidiRegion';
import { Duration, Location } from './core/Common';
import { MidiDataType, NoteMidiData } from './core/MidiData';
import { COLORS } from './ui/Config';
import { Instrument } from './core/Instrument';
import { AbstractTrack } from './core/Track';
import { AudioTrack } from './core/AudioTrack';
import { createInstrument } from './utils/instruments';

const LICENSE =
  'MIT License\n\nCopyright (c) 2023, 2024 Hans-Martin Will\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.';

function openDocumentation() {
  window.open('https://ai-music.github.io/webdaw-doc/', 'Documentation', 'width=800, height=600');
  return false;
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

  async function appendTrack(trackType: string) {
    if (!project) return;
    let newTrack: AbstractTrack | null = null;
    let instrument: Instrument | null = null;

    console.log(`Attempting to append track of type: ${trackType}`);

    if (trackType === 'audio') {
      newTrack = new AudioTrack();
      console.log('Created new AudioTrack:', newTrack);
    } else {
      // All other track types are instrument tracks
      instrument = createInstrument(trackType);
      console.log(`Created instrument: ${instrument.name} for track type: ${trackType}`);
      newTrack = new InstrumentTrack(instrument.name, COLORS[Math.floor(Math.random() * COLORS.length)], false, instrument);
      console.log('Created new InstrumentTrack:', newTrack);
    }

    if (newTrack) {
      // Initialize instrument if it's an instrument track
      if (instrument) {
        try {
          console.log(`Initializing instrument: ${instrument.name}`);
          await instrument.initialize(audioContext);
          console.log(`Instrument ${instrument.name} initialized successfully.`);
        } catch (initError) {
          console.error(`Failed to initialize instrument ${instrument.name}:`, initError);
          // If instrument initialization fails, we should not add the track.
          return;
        }
      }

      project.appendTrack(newTrack);
      console.log('Track appended to project:', newTrack);

      engine.handleTrackEvent({
        type: TrackEventType.Added,
        track: newTrack,
      });
      console.log('Engine notified of new track.');

      setTracks([...project.tracks]);
      console.log('Tracks state updated.');
    } else {
      console.warn(`No track created for type: ${trackType}`);
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

  const createNewTracksFromMidi = async (url: string) => {
    if (!project) return;

    setLoading(true);
    setLoadingProgress(0);

    try {
      const newMidiTracks = await loadAndParseMidiFromUrl(url, project);

      if (newMidiTracks.length > 0) {
        for (const track of newMidiTracks) {
          await track.instrument.initialize(audioContext);
        }

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
      console.error('Failed to import MIDI file from URL:', error);
    } finally {
      setLoading(false);
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

    const instrument = createInstrument(pattern.instrument || 'analog');
    
    // Await instrument initialization here
    try {
      await instrument.initialize(audioContext);
    } catch (initError) {
      console.error(`Failed to initialize instrument ${instrument.name}:`, initError);
      // If instrument initialization fails, we should not add the track.
      return;
    }

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
    // No Music Prism/WAM editor logic needed
    // If you want to open a piano roll for instrument tracks, you can keep that logic here
    if (track.type === 'instrument' && region) {
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
                createNewTracksFromMidi={createNewTracksFromMidi}
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