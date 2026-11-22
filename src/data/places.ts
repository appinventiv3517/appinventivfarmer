/**
 * Reference data for the address step. Real names only: Indian states and
 * union territories, the 36 districts of Maharashtra (current official names)
 * and the 13 talukas of Buldhana district, where the prototype's sample farmer
 * lives. Anything not listed is typed in by the farmer.
 */
export const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
] as const;

export const DISTRICTS: Record<string, readonly string[]> = {
  Maharashtra: [
    'Ahilyanagar', 'Akola', 'Amravati', 'Beed', 'Bhandara', 'Buldhana', 'Chandrapur', 'Chhatrapati Sambhajinagar', 'Dharashiv', 'Dhule',
    'Gadchiroli', 'Gondia', 'Hingoli', 'Jalgaon', 'Jalna', 'Kolhapur', 'Latur', 'Mumbai City', 'Mumbai Suburban', 'Nagpur',
    'Nanded', 'Nandurbar', 'Nashik', 'Palghar', 'Parbhani', 'Pune', 'Raigad', 'Ratnagiri', 'Sangli', 'Satara',
    'Sindhudurg', 'Solapur', 'Thane', 'Wardha', 'Washim', 'Yavatmal',
  ],
};

/** Mandals (talukas in Maharashtra), by district. */
export const MANDALS: Record<string, readonly string[]> = {
  Buldhana: ['Buldhana', 'Chikhli', 'Deulgaon Raja', 'Jalgaon Jamod', 'Khamgaon', 'Lonar', 'Malkapur', 'Mehkar', 'Motala', 'Nandura', 'Sangrampur', 'Shegaon', 'Sindkhed Raja'],
};

/*
 * India Post PIN codes: the first two digits identify the postal circle.
 * Only prefixes that map to exactly one state are listed; for the rest the
 * farmer picks the state.
 */
const PIN_PREFIX: [string, string][] = [
  ['11', 'Delhi'], ['14', 'Punjab'], ['15', 'Punjab'], ['17', 'Himachal Pradesh'],
  ['30', 'Rajasthan'], ['31', 'Rajasthan'], ['32', 'Rajasthan'], ['33', 'Rajasthan'], ['34', 'Rajasthan'],
  ['36', 'Gujarat'], ['37', 'Gujarat'], ['38', 'Gujarat'], ['39', 'Gujarat'],
  ['41', 'Maharashtra'], ['42', 'Maharashtra'], ['43', 'Maharashtra'], ['44', 'Maharashtra'],
  ['45', 'Madhya Pradesh'], ['46', 'Madhya Pradesh'], ['47', 'Madhya Pradesh'], ['48', 'Madhya Pradesh'], ['49', 'Chhattisgarh'],
  ['50', 'Telangana'], ['51', 'Andhra Pradesh'], ['52', 'Andhra Pradesh'], ['53', 'Andhra Pradesh'],
  ['56', 'Karnataka'], ['57', 'Karnataka'], ['58', 'Karnataka'], ['59', 'Karnataka'],
  ['60', 'Tamil Nadu'], ['61', 'Tamil Nadu'], ['62', 'Tamil Nadu'], ['63', 'Tamil Nadu'], ['64', 'Tamil Nadu'],
  ['67', 'Kerala'], ['68', 'Kerala'], ['69', 'Kerala'],
  ['70', 'West Bengal'], ['71', 'West Bengal'], ['72', 'West Bengal'], ['73', 'West Bengal'], ['74', 'West Bengal'],
  ['75', 'Odisha'], ['76', 'Odisha'], ['77', 'Odisha'], ['78', 'Assam'],
];

/** The state a 6-digit PIN code belongs to, when the prefix alone settles it. */
export function stateForPincode(pin: string): string | null {
  if (!/^[1-9]\d{5}$/.test(pin)) return null;
  // 400xxx–403xxx: 400–402 are Maharashtra (Mumbai, Thane, Raigad), 403 is Goa.
  if (pin.startsWith('403')) return 'Goa';
  if (pin.startsWith('40')) return 'Maharashtra';
  return PIN_PREFIX.find(([p]) => pin.startsWith(p))?.[1] ?? null;
}
