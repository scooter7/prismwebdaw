import { FunctionComponent } from 'react';
import { Location as LocationObj, TimeSignature } from '../core/Common';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export type Props = {
  timeSignature: TimeSignature;
  label: string;
  location: LocationObj;
  setLocation: (location: LocationObj) => void;
};

export const Location: FunctionComponent<Props> = (props) => {
  const handleInputChange = (field: 'bar' | 'beat' | 'tick', value: string) => {
    const numericValue = parseInt(value);
    if (isNaN(numericValue)) return;

    let { bar, beat, tick } = props.location;
    let isValid = false;

    if (field === 'bar' && numericValue >= 1 && numericValue <= 999) {
      bar = numericValue;
      isValid = true;
    } else if (field === 'beat' && numericValue >= 1 && numericValue <= props.timeSignature.beatsPerBar) {
      beat = numericValue;
      isValid = true;
    } else if (field === 'tick' && numericValue >= 1 && numericValue <= props.timeSignature.ticksPerBeat) {
      tick = numericValue;
      isValid = true;
    }

    if (isValid) {
      props.setLocation(new LocationObj(bar, beat, tick));
    }
  };

  return (
    <div>
      <Label className="text-xs text-muted-foreground">{props.label}</Label>
      <div className="flex items-center space-x-1">
        <Input
          className="w-12 h-7 text-center bg-transparent border-0 focus-visible:ring-1"
          value={props.location.bar.toString()}
          onChange={(e) => handleInputChange('bar', e.target.value)}
          maxLength={3}
        />
        <span className="text-muted-foreground">:</span>
        <Input
          className="w-10 h-7 text-center bg-transparent border-0 focus-visible:ring-1"
          value={props.location.beat.toString()}
          onChange={(e) => handleInputChange('beat', e.target.value)}
          maxLength={2}
        />
        <span className="text-muted-foreground">:</span>
        <Input
          className="w-12 h-7 text-center bg-transparent border-0 focus-visible:ring-1"
          value={props.location.tick.toString()}
          onChange={(e) => handleInputChange('tick', e.target.value)}
          maxLength={4}
        />
      </div>
    </div>
  );
};