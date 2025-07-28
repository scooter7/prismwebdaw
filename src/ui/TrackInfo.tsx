import { FunctionComponent, useEffect, useState } from 'react';
import Compact from '@uiw/react-color-compact';
import { Mic, Settings, Trash2, VolumeX } from 'lucide-react';

import { TrackInterface } from '../core/Track';
import { MAX_VOLUME_DB, MIN_VOLUME_DB } from '../core/Config';
import { COLORS, TRACK_HEIGHT_PX, UX_PAN_SCALE } from './Config';
import { Knob } from './Knob';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Slider } from '../components/ui/slider';
import { cn } from '../lib/utils';

function panRenderer(val: number) {
  if (val === 0) return 'C';
  return val < 0 ? `L ${-val.toFixed(0)}` : `R ${val.toFixed(0)}`;
}

export interface TrackInfoProps {
  delete: () => void;
  index: number;
  track: TrackInterface;
  updateTrackEnablement: () => void;
  colorChange: (color: string) => void;
}

export const TrackInfo: FunctionComponent<TrackInfoProps> = (props: TrackInfoProps) => {
  const [name, setName] = useState(props.track.name);
  const [volume, setVolume] = useState(props.track.volume);
  const [pan, setPan] = useState(props.track.pan * UX_PAN_SCALE);
  const [mute, setMute] = useState(props.track.muted);
  const [solo, setSolo] = useState(props.track.soloed);
  const [record, setRecord] = useState(props.track.recording);
  const [color, setColor] = useState(props.track.color);

  useEffect(() => {
    setMute(props.track.muted);
    setSolo(props.track.soloed);
    setVolume(props.track.volume);
    setPan(props.track.pan * UX_PAN_SCALE);
    setName(props.track.name);
    setColor(props.track.color);
    setRecord(props.track.recording);
  }, [props.track]);

  function changeMute(isMuted: boolean) {
    setMute(isMuted);
    props.track.muted = isMuted;
    props.updateTrackEnablement();
  }

  function changeSolo(isSoloed: boolean) {
    setSolo(isSoloed);
    props.track.soloed = isSoloed;
    props.updateTrackEnablement();
  }

  function changeVolume(newVolume: number[]) {
    setVolume(newVolume[0]);
    props.track.volume = newVolume[0];
  }

  function changePan(newPan: number) {
    setPan(newPan);
    props.track.pan = newPan / UX_PAN_SCALE;
  }

  function changeName(newName: string) {
    setName(newName);
    props.track.name = newName;
  }

  function changeColor(newColor: string) {
    setColor(newColor);
    props.track.color = newColor;
    props.colorChange(newColor);
  }

  return (
    <div
      className="flex flex-col w-full p-1.5 bg-transparent border-b border-border"
      style={{ height: TRACK_HEIGHT_PX }}
    >
      <div className="flex justify-between items-center mb-1">
        <Input
          value={name}
          onChange={(e) => changeName(e.target.value)}
          className="text-sm font-semibold h-6 border-0 bg-transparent focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 px-1 truncate"
          style={{ color: color }}
        />
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-6 w-6 rounded-sm', solo ? 'bg-blue-500 text-white' : '')}
            onClick={() => changeSolo(!solo)}
          >
            <span className="font-bold text-xs">S</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-6 w-6 rounded-sm', mute ? 'bg-yellow-500 text-black' : '')}
            onClick={() => changeMute(!mute)}
          >
            <VolumeX className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-6 w-6 rounded-sm', record ? 'bg-red-600 text-white' : '')}
            disabled={true}
          >
            <Mic className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex items-center space-x-2 flex-grow">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Settings className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 border-border">
            <Card>
              <CardHeader>
                <CardTitle>Track Properties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h5 className="text-sm font-medium mb-2">Track Color</h5>
                  <Compact
                    color={color}
                    colors={COLORS}
                    onChange={(val) => changeColor(val.hex)}
                    style={{ width: '16rem' }}
                  />
                </div>
                <div>
                  <h5 className="text-sm font-medium mb-2 text-destructive">Danger Zone</h5>
                  <Button variant="destructive" onClick={() => props.delete()}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Track
                  </Button>
                </div>
              </CardContent>
            </Card>
          </PopoverContent>
        </Popover>
        <Knob
          label="Pan"
          min={-UX_PAN_SCALE}
          max={UX_PAN_SCALE}
          labelRenderer={panRenderer}
          noLabels={true}
          size={24}
          value={pan}
          onChange={(val) => changePan(val)}
        />
        <div className="text-xs text-muted-foreground w-8 text-center">{panRenderer(pan)}</div>
        <Slider
          min={MIN_VOLUME_DB}
          max={MAX_VOLUME_DB}
          step={0.1}
          value={[volume]}
          onValueChange={changeVolume}
          className="flex-grow"
        />
        <div className="w-12 text-right text-xs text-muted-foreground">
          {volume <= MIN_VOLUME_DB ? '-inf' : volume.toFixed(1)} dB
        </div>
      </div>
    </div>
  );
};