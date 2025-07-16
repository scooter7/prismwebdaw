import { FunctionComponent, useContext, useEffect, useState } from 'react';
import { Location } from './Location';
import { Time } from './Time';
import { Duration, Location as LocationValue } from '../core/Common';
import { Project as ProjectObj } from '../core/Project';
import { Engine } from '../core/Engine';
import { PlaybackEvent, PlaybackEventType } from '../core/Events';
import { MAX_TIMELINE_SCALE, MIN_TIMELINE_SCALE } from './Timeline';
import { EngineContext } from './Context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FastForward, Rewind, Pause, Play, Repeat, StepBack, StepForward, ZoomIn, ZoomOut, Frame, Mic } from 'lucide-react';

export enum PlaybackState {
  Stopped,
  Playing,
  Recording,
}

export type TransportProps = {
  project: ProjectObj;
  totalWidth: number;
  timelineScale: number;
  setTimelineScale: (scale: number) => void;
  setTimestamp: (timestamp: number) => void;
  timestamp: number;
  setCurrent: (current: LocationValue) => void;
  current: LocationValue;
  setLoopStart: (loopStart: LocationValue) => void;
  loopStart: LocationValue;
  setLoopEnd: (loopEnd: LocationValue) => void;
  loopEnd: LocationValue;
  setEnd: (end: LocationValue) => void;
  end: LocationValue;
  looping: boolean;
  setLooping: (looping: boolean) => void;
};

export const Transport: FunctionComponent<TransportProps> = (props: TransportProps) => {
  const engine = useContext(EngineContext)!;

  const [playback, setPlayback] = useState(PlaybackState.Stopped);
  const [bpm, setBpm] = useState(120);
  const [numerator, setNumerator] = useState(4);
  const [denominator, setDenominator] = useState(4);
  const [metronome, setMetronome] = useState(false);

  const timeSignature = props.project.timeSignature;

  function onPlaybackEvent(event: PlaybackEvent) {
    switch (event.type) {
      case PlaybackEventType.Started: setPlayback(PlaybackState.Playing); break;
      case PlaybackEventType.Stopped:
      case PlaybackEventType.Paused:
        setPlayback(PlaybackState.Stopped);
        props.setCurrent(event.location!);
        break;
      case PlaybackEventType.RecordingStarted: setPlayback(PlaybackState.Recording); break;
    }
  }

  useEffect(() => {
    engine.registerPlaybackEventHandler(onPlaybackEvent);
    return () => {
      engine.unregisterPlaybackEventHandler(onPlaybackEvent);
    };
  }, [engine]);

  function toggleMetronome() {
    setMetronome(!metronome);
    engine.metronome = !metronome;
  }

  function onBegin() {
    if (props.current.compare(props.loopStart) > 0) {
      props.setCurrent(props.loopStart);
    } else {
      props.setCurrent(new LocationValue(1, 1, 1));
    }
  }

  function onEnd() {
    if (props.current.compare(props.loopEnd) < 0) {
      props.setCurrent(props.loopEnd);
    } else {
      props.setCurrent(props.end);
    }
  }

  function onForward() {
    if (props.end.compare(new LocationValue(2, 1, 1)) <= 0) {
      props.setCurrent(props.end);
    } else if (props.current.compare(props.end.sub(new Duration(1, 0, 0), props.project.timeSignature)) < 0) {
      props.setCurrent(props.current.add(new Duration(1, 0, 0), props.project.timeSignature));
    } else {
      props.setCurrent(props.end);
    }
  }

  function onBackward() {
    if (props.current.compare(new LocationValue(2, 1, 1)) > 0) {
      props.setCurrent(props.current.sub(new Duration(1, 0, 0), props.project.timeSignature));
    }
  }

  function play() {
    setPlayback(PlaybackState.Playing);
    engine.start();
  }

  function pause() {
    setPlayback(PlaybackState.Stopped);
    engine.stop();
  }

  function record() {
    setPlayback(PlaybackState.Recording);
    engine.start();
  }

  function zoomIn() {
    props.setTimelineScale(Math.min(props.timelineScale * 2, MAX_TIMELINE_SCALE));
  }

  function zoomOut() {
    props.setTimelineScale(Math.max(props.timelineScale / 2, MIN_TIMELINE_SCALE));
  }

  function zoomToFit() {
    const timelineScroll = document.getElementById('timelineScroll')!;
    if (!timelineScroll) return;
    const timelineWidth = timelineScroll.clientWidth;
    let scale = props.timelineScale;
    let totalWidth = props.totalWidth;

    if (timelineWidth < totalWidth) {
      while (timelineWidth < totalWidth && scale > MIN_TIMELINE_SCALE) {
        scale *= 0.5;
        totalWidth *= 0.5;
      }
    } else {
      while (timelineWidth > totalWidth * 2 && scale < MAX_TIMELINE_SCALE) {
        scale *= 2;
        totalWidth *= 2;
      }
    }
    props.setTimelineScale(Math.min(Math.max(scale, MIN_TIMELINE_SCALE), MAX_TIMELINE_SCALE));
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 p-2 border-b">
      <div className="flex items-center space-x-1">
        <Button variant="ghost" size="icon" onClick={onBegin}><StepBack /></Button>
        <Button variant="ghost" size="icon" onClick={onBackward}><Rewind /></Button>
        <Button variant="ghost" size="icon" onClick={play} disabled={playback !== PlaybackState.Stopped} className={playback === PlaybackState.Playing ? 'text-green-500' : ''}><Play /></Button>
        <Button variant="ghost" size="icon" onClick={pause} disabled={playback === PlaybackState.Stopped}><Pause /></Button>
        <Button variant="ghost" size="icon" onClick={record} disabled={true} className={playback === PlaybackState.Recording ? 'text-red-500' : ''}><Mic /></Button>
        <Button variant="ghost" size="icon" onClick={onForward}><FastForward /></Button>
        <Button variant="ghost" size="icon" onClick={onEnd}><StepForward /></Button>
        <Button variant={props.looping ? "secondary" : "ghost"} size="icon" onClick={() => props.setLooping(!props.looping)}><Repeat /></Button>
      </div>
      <div className="flex items-center space-x-2">
        <Label htmlFor="metronome-switch" className="text-xs">Metronome</Label>
        <Switch id="metronome-switch" checked={metronome} onCheckedChange={toggleMetronome} />
      </div>
      <div className="flex items-center space-x-2">
        <Label className="text-xs">BPM</Label>
        <Input className="w-16 h-8" value={bpm.toFixed(0)} onChange={(e) => setBpm(parseInt(e.target.value))} disabled={playback !== PlaybackState.Stopped} />
      </div>
      <div className="flex items-center space-x-2">
        <Label className="text-xs">Signature</Label>
        <div className="flex items-center">
          <Input className="w-10 h-8" value={numerator.toFixed(0)} onChange={(e) => setNumerator(parseInt(e.target.value))} disabled={playback !== PlaybackState.Stopped} />
          <span className="mx-1">/</span>
          <Input className="w-10 h-8" value={denominator.toFixed(0)} onChange={(e) => setDenominator(parseInt(e.target.value))} disabled={playback !== PlaybackState.Stopped} />
        </div>
      </div>
      <Time label="Time" timestamp={props.timestamp} setTimestamp={props.setTimestamp} />
      <Location label="Current" location={props.current} setLocation={props.setCurrent} timeSignature={timeSignature} />
      <Location label="Loop Start" location={props.loopStart} setLocation={props.setLoopStart} timeSignature={timeSignature} />
      <Location label="Loop End" location={props.loopEnd} setLocation={props.setLoopEnd} timeSignature={timeSignature} />
      <Location label="End" location={props.end} setLocation={props.setEnd} timeSignature={timeSignature} />
      <div className="flex-grow" />
      <div className="flex items-center space-x-1">
        <Button variant="ghost" size="icon" onClick={zoomOut} disabled={props.timelineScale <= MIN_TIMELINE_SCALE}><ZoomOut /></Button>
        <Button variant="ghost" size="icon" onClick={zoomIn} disabled={props.timelineScale >= MAX_TIMELINE_SCALE}><ZoomIn /></Button>
        <Button variant="ghost" size="icon" onClick={zoomToFit}><Frame /></Button>
      </div>
    </div>
  );
};