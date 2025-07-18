import {
  File,
  Settings,
  Pencil,
  Eye,
  HelpCircle,
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
} from 'lucide-react';
import { Project } from './ui/Project';
import { Project as ProjectObj } from './core/Project';
import { createProject, loadProject, saveAsProject, saveProject } from './controller/Projects';
import { copy, cut, doDelete, paste, redo, undo } from './controller/Edit';
import { useRef, useState } from 'react';
import { Engine } from './core/Engine';
import { BUFFER_SIZE, SAMPLE_RATE } from './core/Config';
import { AudioFileManager } from './core/AudioFileManager';
import { AudioFileManagerContext, EngineContext } from './ui/Context';
import { Button } from './components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu';
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
import { TrackEventType } from './core/Events';
import { AiChat } from './ui/AiChat';
import { InstrumentTrack } from './core/InstrumentTrack';
import { Analog } from './instruments/Analog';
import { MidiRegion } from './core/MidiRegion';
import { Duration, Location } from './core/Common';
import { MidiDataType, NoteMidiData } from './core/MidiData';
import { COLORS } from './ui/Config';
import { SoundFontInstrument } from './instruments/SoundFontInstrument';
import { Instrument } from './core/Instrument';

const audioContext = new AudioContext();

const LICENSE =
  'MIT License\n\nCopyright (c) 2023, 2024 Hans-Martin Will\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.';

function openDocumentation() {
  window.open('https://ai-music.github.io/webdaw-doc/', 'Documentation', 'width=800, height=600');
  return false;
}

function createInstrument(name: string): Instrument {
  const lowerName = name.toLowerCase();
  if (lowerName === 'analog') {
    return new Analog();
  }
  if (lowerName === 'drums') {
    return new SoundFontInstrument('drums');
  }
  // Default to piano
  return new SoundFontInstrument('acoustic_grand_piano');
}

function App() {
  const initialProject = new ProjectObj();
  const engine = useRef<Engine>(
    new Engine(audioContext, { bufferSize: BUFFER_SIZE, sampleRate: SAMPLE_RATE }, initialProject),
  );
  const audioFileManager = useRef<AudioFileManager>(new AudioFileManager());
  const midiFileInputRef = useRef<HTMLInputElement>(null);

  const [project, setProject] = useState(initialProject);
  const [tracks, setTracks] = useState(initialProject.tracks);

  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [confirmStopAudio, setConfirmStopAudio] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [mixerVisible, setMixerVisible] = useState(false);
  const [browserVisible, setBrowserVisible] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [editingRegion, setEditingRegion] = useState<{
    trackIndex: number;
    regionIndex: number;
  } | null>(null);

  const continueChangeProject = useRef<() => void>();

  const resumeAudio = () => {
    const initialize = () => {
      if (!initialized) {
        initializeEngine(engine.current);
        setInitialized(true);
      }
    };

    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        console.log('AudioContext resumed successfully');
        initialize();
      });
    } else {
      initialize();
    }
  };

  function initializeEngine(engine: Engine) {
    setLoading(true);
    engine.initialize(() => {
      setLoading(false);
    });
  }

  function loadFiles(project: ProjectObj) {
    setLoading(true);
    project.loadFiles(
      engine.current.context,
      (project) => {
        engine.current.project = project;
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
    if (engine.current.isPlaying) {
      setConfirmStopAudio(true);
    } else {
      action();
    }
  }

  const handleMidiFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
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
          await engine.current.handleTrackEvent({
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

    await engine.current.handleTrackEvent({
      type: TrackEventType.Added,
      track: newTrack,
    });

    setTracks([...project.tracks]);
  };

  const handleRegionDoubleClick = (trackIndex: number, regionIndex: number) => {
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
    <EngineContext.Provider value={engine.current}>
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
        className="h-screen max-h-screen w-screen flex flex-col bg-background text-foreground"
        onClick={resumeAudio}
      >
        <header className="flex items-center px-4 py-2 border-b shrink-0">
          <h1 className="text-xl font-bold mr-4">WebDAW</h1>
          <div className="flex items-center space-x-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <File className="h-4 w-4 mr-2" />
                  Project
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => {
                    changeProject(() => {
                      engine.current.stop();
                      project.audioFiles.forEach((audioFile) => {
                        audioFileManager.current.unregisterAudioFile(audioFile);
                      });
                      createProject(audioFileManager.current, loadFiles);
                    });
                  }}
                >
                  <FilePlus className="h-4 w-4 mr-2" />
                  New Project
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    changeProject(() => {
                      engine.current.stop();
                      loadProject(audioFileManager.current);
                    });
                  }}
                >
                  <FolderDown className="h-4 w-4 mr-2" />
                  Load...
                </DropdownMenuItem>
                <DropdownMenuItem onClick={saveProject}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </DropdownMenuItem>
                <DropdownMenuItem onClick={saveAsProject}>
                  <Copy className="h-4 w-4 mr-2" />
                  Save As...
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => midiFileInputRef.current?.click()}>
                  <Music2 className="h-4 w-4 mr-2" />
                  Import MIDI File...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={undo}>
                  <Undo className="h-4 w-4 mr-2" />
                  Undo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={redo}>
                  <Redo className="h-4 w-4 mr-2" />
                  Redo
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={cut}>
                  <Scissors className="h-4 w-4 mr-2" />
                  Cut
                </DropdownMenuItem>
                <DropdownMenuItem onClick={copy}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </DropdownMenuItem>
                <DropdownMenuItem onClick={paste}>
                  <ClipboardPaste className="h-4 w-4 mr-2" />
                  Paste
                </DropdownMenuItem>
                <DropdownMenuItem onClick={doDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  View
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setBrowserVisible(!browserVisible)}>
                  <Library className="h-4 w-4 mr-2" />
                  {browserVisible ? 'Hide Library' : 'Show Library'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMixerVisible(!mixerVisible)}>
                  <Music className="h-4 w-4 mr-2" />
                  {mixerVisible ? 'Hide Mixer' : 'Show Mixer'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowSettings(!showSettings)}>
                  <Cog className="h-4 w-4 mr-2" />
                  {showSettings ? 'Hide Settings' : 'Show Setting'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <HelpCircle className="h-4 w-4 mr-2" />
                  Help
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={openDocumentation}>
                  <Book className="h-4 w-4 mr-2" />
                  Documentation
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="https://github.com/ai-music/webdaw" target="_blank" rel="noreferrer">
                    <Github className="h-4 w-4 mr-2" />
                    Github
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a
                    href="https://github.com/ai-music/webdaw/issues"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Bug className="h-4 w-4 mr-2" />
                    Report an issue
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowAbout(true)}>
                  <Info className="h-4 w-4 mr-2" />
                  About
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-grow flex overflow-hidden">
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
            />
          </AudioFileManagerContext.Provider>
          <aside className="w-80 flex-shrink-0 border-l border-border bg-background/50 flex flex-col">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold flex items-center">
                <Sparkles className="h-5 w-5 mr-2 text-yellow-400" />
                AI Music Assistant
              </h2>
            </div>
            <div className="flex-grow p-4 overflow-y-auto">
              <AiChat onMidiPatternGenerated={handleMidiPatternGenerated} />
            </div>
          </aside>
        </main>
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
    </EngineContext.Provider>
  );
}

export default App;