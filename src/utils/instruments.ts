import { Analog } from '../instruments/Analog';
import { Drums } from '../instruments/Drums';
import { Instrument } from '../core/Instrument';

export function createInstrument(name: string): Instrument {
  const lowerName = name.toLowerCase();

  if (lowerName === 'analog') {
    return new Analog();
  }
  if (lowerName === 'drums') {
    return new Drums();
  }

  // Default to Analog for any other request.
  console.warn(`Instrument '${name}' not found, defaulting to Analog.`);
  return new Analog();
}