import { FunctionComponent } from 'react';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export type Props = {
  label: string;
  timestamp: number;
  setTimestamp: (timestamp: number) => void;
};

function destructureTime(timestamp: number): [number, number, number, number] {
  const date = new Date(timestamp * 1000); // Convert timestamp to milliseconds
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();
  const milliseconds = date.getUTCMilliseconds();
  return [hours, minutes, seconds, milliseconds];
}

function constructTime(hours: number, minutes: number, seconds: number, milliseconds: number): number {
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

export const Time: FunctionComponent<Props> = (props) => {
  const [hours, minutes, seconds, milliseconds] = destructureTime(props.timestamp);

  const handleInputChange = (field: 'h' | 'm' | 's' | 'ms', value: string) => {
    const numericValue = parseInt(value);
    if (isNaN(numericValue)) return;

    let newHours = hours, newMinutes = minutes, newSeconds = seconds, newMs = milliseconds;

    if (field === 'h' && numericValue >= 0 && numericValue < 24) newHours = numericValue;
    else if (field === 'm' && numericValue >= 0 && numericValue <= 59) newMinutes = numericValue;
    else if (field === 's' && numericValue >= 0 && numericValue <= 59) newSeconds = numericValue;
    else if (field === 'ms' && numericValue >= 0 && numericValue <= 999) newMs = numericValue;
    else return;

    props.setTimestamp(constructTime(newHours, newMinutes, newSeconds, newMs));
  };

  return (
    <div>
      <Label className="text-xs text-muted-foreground">{props.label}</Label>
      <div className="flex items-center space-x-1">
        <Input className="w-10 h-7 text-center bg-transparent border-0 focus-visible:ring-1" value={hours.toString().padStart(2, '0')} onChange={(e) => handleInputChange('h', e.target.value)} maxLength={2} />
        <span className="text-muted-foreground">:</span>
        <Input className="w-10 h-7 text-center bg-transparent border-0 focus-visible:ring-1" value={minutes.toString().padStart(2, '0')} onChange={(e) => handleInputChange('m', e.target.value)} maxLength={2} />
        <span className="text-muted-foreground">:</span>
        <Input className="w-10 h-7 text-center bg-transparent border-0 focus-visible:ring-1" value={seconds.toString().padStart(2, '0')} onChange={(e) => handleInputChange('s', e.target.value)} maxLength={2} />
        <span className="text-muted-foreground">:</span>
        <Input className="w-12 h-7 text-center bg-transparent border-0 focus-visible:ring-1" value={milliseconds.toString().padStart(3, '0')} onChange={(e) => handleInputChange('ms', e.target.value)} maxLength={3} />
      </div>
    </div>
  );
};