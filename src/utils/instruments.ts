import { Analog } from '../instruments/Analog';
import { MusicPrism } from '../instruments/MusicPrism';
import { Instrument } from '../core/Instrument';

export function createInstrument(name: string): Instrument {
  const lowerName = name.toLowerCase();
  
  if (lowerName === 'analog') {
    return new Analog();
  }

  if (lowerName === 'music-prism') {
    return new MusicPrism();
  }
  
  // Default to Music Prism for any other request.
  console.warn(`Instrument '${name}' not found, defaulting to Music Prism.`);
  return new MusicPrism();
}