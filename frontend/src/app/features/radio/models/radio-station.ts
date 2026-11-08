
export const RADIO_COUNTRIES = [
  { code: 'PL', labelKey: 'radio.country.pl' },
  { code: 'GB', labelKey: 'radio.country.gb' },
  { code: 'DE', labelKey: 'radio.country.de' },
  { code: 'FR', labelKey: 'radio.country.fr' }
] as const;

export type RadioCountryCode =
  (typeof RADIO_COUNTRIES)[number]['code'];

export interface RadioStation {
  readonly id: string;
  readonly name: string;
  readonly countryCode: RadioCountryCode;
  readonly streamUrl: string | null;
}

// Tymczasowe dane do budowy UI.
// Prawdziwy katalog pobierzemy później przez Spring Boot.
export const RADIO_PREVIEW_STATIONS: readonly RadioStation[] = [
  {
    id: 'pl-rmf',
    name: 'RMF FM',
    countryCode: 'PL',
    streamUrl: null
  },
  {
    id: 'pl-zet',
    name: 'Radio ZET',
    countryCode: 'PL',
    streamUrl: null
  },
  {
    id: 'gb-bbc1',
    name: 'BBC Radio 1',
    countryCode: 'GB',
    streamUrl: null
  },
  {
    id: 'de-dlf',
    name: 'Deutschlandfunk',
    countryCode: 'DE',
    streamUrl: null
  },
  {
    id: 'fr-inter',
    name: 'France Inter',
    countryCode: 'FR',
    streamUrl: null
  }
];
