export const STATE_GEO_CENTERS: Record<string, { center: [number, number] }> = {
  "Andhra Pradesh": { center: [79.74, 15.91] },
  "Arunachal Pradesh": { center: [94.73, 28.22] },
  "Assam": { center: [92.94, 26.20] },
  "Bihar": { center: [85.31, 25.60] },
  "Chhattisgarh": { center: [81.87, 21.27] },
  "Goa": { center: [74.12, 15.30] },
  "Gujarat": { center: [71.19, 22.26] },
  "Haryana": { center: [76.09, 29.06] },
  "Himachal Pradesh": { center: [77.17, 31.10] },
  "Jharkhand": { center: [85.28, 23.61] },
  "Karnataka": { center: [75.71, 15.32] },
  "Kerala": { center: [76.27, 10.85] },
  "Madhya Pradesh": { center: [78.66, 23.47] },
  "Maharashtra": { center: [75.71, 19.75] },
  "Manipur": { center: [93.91, 24.66] },
  "Meghalaya": { center: [91.37, 25.47] },
  "Mizoram": { center: [92.94, 23.16] },
  "Nagaland": { center: [94.56, 26.16] },
  "Odisha": { center: [83.91, 20.94] },
  "Punjab": { center: [75.34, 31.15] },
  "Rajasthan": { center: [74.22, 27.02] },
  "Sikkim": { center: [88.51, 27.53] },
  "Tamil Nadu": { center: [78.66, 11.13] },
  "Telangana": { center: [79.02, 18.11] },
  "Tripura": { center: [91.99, 23.94] },
  "Uttar Pradesh": { center: [80.95, 26.85] },
  "Uttarakhand": { center: [79.07, 30.07] },
  "West Bengal": { center: [87.86, 22.99] },
  "Delhi": { center: [77.10, 28.70] },
  "NCT of Delhi": { center: [77.10, 28.70] },
  "Jammu & Kashmir": { center: [74.80, 33.78] },
  "Ladakh": { center: [77.58, 34.15] },
  "Chandigarh": { center: [76.77, 30.73] },
  "Puducherry": { center: [79.81, 11.94] },
  "Andaman & Nicobar Island": { center: [92.72, 11.74] },
  "Dadra and Nagar Haveli and Daman and Diu": { center: [73.01, 20.27] },
  "Lakshadweep": { center: [72.63, 10.57] },
};

const CITY_STATE_MAP: Record<string, string> = {
  bangalore: "Karnataka",
  bengaluru: "Karnataka",
  mumbai: "Maharashtra",
  pune: "Maharashtra",
  nagpur: "Maharashtra",
  delhi: "NCT of Delhi",
  "new delhi": "NCT of Delhi",
  noida: "Uttar Pradesh",
  gurgaon: "Haryana",
  gurugram: "Haryana",
  hyderabad: "Telangana",
  chennai: "Tamil Nadu",
  coimbatore: "Tamil Nadu",
  kolkata: "West Bengal",
  ahmedabad: "Gujarat",
  surat: "Gujarat",
  jaipur: "Rajasthan",
  lucknow: "Uttar Pradesh",
  chandigarh: "Chandigarh",
  bhopal: "Madhya Pradesh",
  indore: "Madhya Pradesh",
  thiruvananthapuram: "Kerala",
  kochi: "Kerala",
  bhubaneswar: "Odisha",
  patna: "Bihar",
  ranchi: "Jharkhand",
  guwahati: "Assam",
  visakhapatnam: "Andhra Pradesh",
  vijayawada: "Andhra Pradesh",
  dehradun: "Uttarakhand",
  shimla: "Himachal Pradesh",
  gangtok: "Sikkim",
  panaji: "Goa",
  raipur: "Chhattisgarh",
};

const STATE_NAME_MAP: Record<string, string> = {
  delhi: "NCT of Delhi",
  "jammu and kashmir": "Jammu & Kashmir",
  "andaman and nicobar islands": "Andaman & Nicobar Island",
};

export function matchStateToGeo(location: string): string | null {
  if (!location) return null;
  const loc = location.toLowerCase().trim();

  for (const state of Object.keys(STATE_GEO_CENTERS)) {
    if (loc === state.toLowerCase()) return state;
  }
  for (const state of Object.keys(STATE_GEO_CENTERS)) {
    if (loc.includes(state.toLowerCase())) return state;
  }
  for (const [city, state] of Object.entries(CITY_STATE_MAP)) {
    if (loc.includes(city)) return state;
  }
  return null;
}

export function normalizeStateName(name: string): string {
  const lower = name.toLowerCase().trim();
  return STATE_NAME_MAP[lower] || name;
}
