// Shared assignment-parsing logic extracted from CreateTADABill.tsx
// Used by both CreateTADABill and ClaimDetail to guarantee identical field mapping.

export interface ParsedAssignment {
  assignmentId: string;
  batchId: string;
  courseName: string;
  clientName: string;
  batchType: string;       // raw batch_delivery_mode value (ILT / ILO / FMAT …)
  deliveryMode: string;    // derived: Online / Offline / Hybrid
  startDate: string;       // ISO YYYY-MM-DD
  endDate: string;
  city: string;
  country: string;
  trainingVenue: string;
  trainerName: string;
  trainerEmail: string;
  manager: string;
  totalPax: string;
  scid: string;
  noOfParticipants: string;
  startTime: string;
  endTime: string;
  trainingDates: string | null; // raw string if present, null = inferred
}

const MONTH_MAP: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

function fullYear(y: string): string {
  return /^\d{2}$/.test(y) ? `20${y}` : y;
}
function monToMM(mon: string): string {
  const key = mon.charAt(0).toUpperCase() + mon.slice(1, 3).toLowerCase();
  return MONTH_MAP[key] ?? MONTH_MAP[mon] ?? '';
}

export function parseApiDate(raw: string | null | undefined): string {
  if (!raw) return '';
  const s = String(raw).trim();
  if (!s || s === 'null' || s === 'undefined' || s === '0') return '';

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const dashParts = s.split('-');
  if (dashParts.length === 3) {
    const [dd, mon, yy] = dashParts;
    if (/^\d{1,2}$/.test(dd.trim()) && /^\d{2,4}$/.test(yy.trim())) {
      const mm = monToMM(mon.trim());
      if (mm) return `${fullYear(yy.trim())}-${mm}-${dd.trim().padStart(2, '0')}`;
    }
  }

  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const [, dd, mm, yy] = slashMatch;
    return `${fullYear(yy)}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  const spaceMatch = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})$/);
  if (spaceMatch) {
    const [, dd, mon, yy] = spaceMatch;
    const mm = monToMM(mon);
    if (mm) return `${fullYear(yy)}-${mm}-${dd.padStart(2, '0')}`;
  }

  const monDayMatch = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})$/);
  if (monDayMatch) {
    const [, mon, dd, yy] = monDayMatch;
    const mm = monToMM(mon);
    if (mm) return `${fullYear(yy)}-${mm}-${dd.padStart(2, '0')}`;
  }

  const ymdSlash = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (ymdSlash) {
    const [, yyyy, mm, dd] = ymdSlash;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  // Attempt native parse as last resort
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return '';
}

function parseTrainingDates(raw: string | null): { startDate: string; endDate: string } {
  if (!raw) return { startDate: '', endDate: '' };
  const s = raw.trim();
  for (const sep of [' to ', ' TO ', ' - ', ' / ', ' | ', ' ~ ']) {
    if (s.includes(sep)) {
      const idx = s.indexOf(sep);
      const left  = parseApiDate(s.slice(0, idx).trim());
      const right = parseApiDate(s.slice(idx + sep.length).trim());
      if (left || right) return { startDate: left, endDate: right };
    }
  }
  const single = parseApiDate(s);
  return { startDate: single, endDate: single };
}

function pickStr(r: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== '' && String(v).trim().toLowerCase() !== 'null') {
      return String(v).trim();
    }
  }
  return '';
}

function pickDate(r: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (!v) continue;
    const parsed = parseApiDate(String(v));
    if (parsed) return parsed;
  }
  return '';
}

export function deriveDeliveryMode(bdm: string): string {
  const v = bdm.toUpperCase().trim();
  if (v === 'ILO' || v.startsWith('ILO')) return 'Online';
  if (v === 'FMAT' || v.startsWith('FMAT')) return 'Offline';
  if (v === 'ILT' || v.startsWith('ILT')) return 'Offline';
  if (v.includes('ONLINE') || v.includes('VIRTUAL')) return 'Online';
  if (v.includes('HYBRID')) return 'Hybrid';
  return 'Offline';
}

// Comprehensive world city → country map.
// PMS frequently sends country='India' even for international assignments.
// City-based lookup is authoritative when PMS country is India or blank.
const CITY_COUNTRY_MAP: Record<string, string> = {
  // India
  'delhi': 'India', 'new delhi': 'India', 'noida': 'India', 'gurgaon': 'India',
  'gurugram': 'India', 'mumbai': 'India', 'bombay': 'India', 'bangalore': 'India',
  'bengaluru': 'India', 'hyderabad': 'India', 'chennai': 'India', 'madras': 'India',
  'pune': 'India', 'kolkata': 'India', 'calcutta': 'India', 'ahmedabad': 'India',
  'jaipur': 'India', 'chandigarh': 'India', 'kochi': 'India', 'cochin': 'India',
  'lucknow': 'India', 'bhopal': 'India', 'indore': 'India', 'nagpur': 'India',
  'coimbatore': 'India', 'surat': 'India', 'vadodara': 'India', 'baroda': 'India',
  'agra': 'India', 'varanasi': 'India', 'patna': 'India', 'ranchi': 'India',
  'bhubaneswar': 'India', 'visakhapatnam': 'India', 'vijayawada': 'India',
  'thiruvananthapuram': 'India', 'trivandrum': 'India', 'mysore': 'India',
  'mysuru': 'India', 'srinagar': 'India', 'amritsar': 'India', 'dehradun': 'India',
  'goa': 'India', 'panaji': 'India', 'faridabad': 'India', 'meerut': 'India',
  'nashik': 'India', 'aurangabad': 'India', 'rajkot': 'India', 'jabalpur': 'India',
  'raipur': 'India', 'jodhpur': 'India', 'madurai': 'India', 'mangalore': 'India',
  'mangaluru': 'India', 'hubli': 'India', 'dharwad': 'India', 'guwahati': 'India',
  // UAE
  'dubai': 'United Arab Emirates', 'abu dhabi': 'United Arab Emirates',
  'sharjah': 'United Arab Emirates', 'ajman': 'United Arab Emirates',
  'ras al khaimah': 'United Arab Emirates', 'fujairah': 'United Arab Emirates',
  'umm al quwain': 'United Arab Emirates', 'al ain': 'United Arab Emirates',
  'jebel ali': 'United Arab Emirates', 'uae': 'United Arab Emirates',
  'emirates': 'United Arab Emirates',
  // UK
  'london': 'UK', 'manchester': 'UK', 'birmingham': 'UK', 'edinburgh': 'UK',
  'glasgow': 'UK', 'bristol': 'UK', 'leeds': 'UK', 'liverpool': 'UK',
  'sheffield': 'UK', 'newcastle': 'UK', 'cardiff': 'UK', 'belfast': 'UK',
  'oxford': 'UK', 'cambridge': 'UK', 'reading': 'UK', 'southampton': 'UK',
  'nottingham': 'UK', 'leicester': 'UK', 'coventry': 'UK', 'bradford': 'UK',
  'aberdeen': 'UK', 'swansea': 'UK', 'wolverhampton': 'UK',
  'london city': 'UK', 'heathrow': 'UK', 'gatwick': 'UK',
  'uk': 'UK', 'england': 'UK', 'britain': 'UK', 'united kingdom': 'UK',
  // USA
  'new york': 'USA', 'los angeles': 'USA', 'chicago': 'USA', 'houston': 'USA',
  'san francisco': 'USA', 'seattle': 'USA', 'boston': 'USA', 'dallas': 'USA',
  'austin': 'USA', 'denver': 'USA', 'atlanta': 'USA', 'miami': 'USA',
  'washington': 'USA', 'phoenix': 'USA', 'las vegas': 'USA',
  'san diego': 'USA', 'portland': 'USA', 'detroit': 'USA', 'philadelphia': 'USA',
  'minneapolis': 'USA', 'nashville': 'USA', 'charlotte': 'USA',
  'columbus': 'USA', 'indianapolis': 'USA', 'baltimore': 'USA',
  'new york city': 'USA', 'nyc': 'USA', 'silicon valley': 'USA',
  'usa': 'USA', 'us': 'USA', 'america': 'USA', 'united states': 'USA',
  // Singapore
  'singapore': 'Singapore',
  // Saudi Arabia
  'riyadh': 'Saudi Arabia', 'jeddah': 'Saudi Arabia', 'mecca': 'Saudi Arabia',
  'medina': 'Saudi Arabia', 'dammam': 'Saudi Arabia', 'khobar': 'Saudi Arabia',
  'al khobar': 'Saudi Arabia', 'dhahran': 'Saudi Arabia', 'jubail': 'Saudi Arabia',
  'taif': 'Saudi Arabia', 'tabuk': 'Saudi Arabia', 'abha': 'Saudi Arabia',
  'yanbu': 'Saudi Arabia', 'buraidah': 'Saudi Arabia',
  // Qatar
  'doha': 'Qatar',
  // Bahrain
  'manama': 'Bahrain',
  // Kuwait
  'kuwait city': 'Kuwait', 'kuwait': 'Kuwait',
  // Oman
  'muscat': 'Oman', 'salalah': 'Oman', 'sohar': 'Oman',
  // Australia
  'sydney': 'Australia', 'melbourne': 'Australia', 'brisbane': 'Australia',
  'perth': 'Australia', 'adelaide': 'Australia', 'canberra': 'Australia',
  'gold coast': 'Australia', 'hobart': 'Australia', 'darwin': 'Australia',
  // Canada
  'toronto': 'Canada', 'vancouver': 'Canada', 'calgary': 'Canada',
  'ottawa': 'Canada', 'montreal': 'Canada', 'edmonton': 'Canada',
  'winnipeg': 'Canada', 'mississauga': 'Canada', 'brampton': 'Canada',
  // Germany
  'frankfurt': 'Germany', 'munich': 'Germany', 'berlin': 'Germany',
  'hamburg': 'Germany', 'düsseldorf': 'Germany', 'dusseldorf': 'Germany',
  'cologne': 'Germany', 'stuttgart': 'Germany', 'dresden': 'Germany',
  'nuremberg': 'Germany', 'nürnberg': 'Germany', 'hannover': 'Germany',
  // Netherlands
  'amsterdam': 'Netherlands', 'rotterdam': 'Netherlands', 'the hague': 'Netherlands',
  'utrecht': 'Netherlands', 'eindhoven': 'Netherlands',
  // France
  'paris': 'France', 'lyon': 'France', 'marseille': 'France',
  'nice': 'France', 'bordeaux': 'France', 'toulouse': 'France',
  'strasbourg': 'France', 'lille': 'France', 'nantes': 'France',
  // Switzerland
  'zurich': 'Switzerland', 'geneva': 'Switzerland', 'bern': 'Switzerland',
  'basel': 'Switzerland', 'lausanne': 'Switzerland',
  // Belgium
  'brussels': 'Belgium', 'antwerp': 'Belgium', 'ghent': 'Belgium', 'bruges': 'Belgium',
  // Sweden
  'stockholm': 'Sweden', 'gothenburg': 'Sweden', 'malmö': 'Sweden', 'malmo': 'Sweden',
  // Japan
  'tokyo': 'Japan', 'osaka': 'Japan', 'kyoto': 'Japan', 'nagoya': 'Japan',
  'hiroshima': 'Japan', 'sapporo': 'Japan', 'fukuoka': 'Japan', 'kobe': 'Japan',
  'yokohama': 'Japan',
  // South Korea
  'seoul': 'South Korea', 'busan': 'South Korea', 'incheon': 'South Korea',
  // Hong Kong
  'hong kong': 'Hong Kong',
  // China
  'beijing': 'China', 'shanghai': 'China', 'shenzhen': 'China',
  'guangzhou': 'China', 'chengdu': 'China', 'chongqing': 'China',
  'wuhan': 'China', 'nanjing': 'China', 'hangzhou': 'China', 'tianjin': 'China',
  'macau': 'China', 'macao': 'China',
  // Malaysia
  'kuala lumpur': 'Malaysia', 'penang': 'Malaysia', 'johor bahru': 'Malaysia',
  'kota kinabalu': 'Malaysia', 'kuching': 'Malaysia', 'kl': 'Malaysia',
  // Thailand
  'bangkok': 'Thailand', 'phuket': 'Thailand', 'chiang mai': 'Thailand',
  // Philippines
  'manila': 'Philippines', 'cebu': 'Philippines', 'makati': 'Philippines',
  'quezon city': 'Philippines', 'davao': 'Philippines', 'taguig': 'Philippines',
  'bgc': 'Philippines', 'bonifacio global city': 'Philippines',
  // Indonesia
  'jakarta': 'Indonesia', 'bali': 'Indonesia', 'surabaya': 'Indonesia',
  'bandung': 'Indonesia', 'medan': 'Indonesia',
  // Vietnam
  'hanoi': 'Vietnam', 'ho chi minh': 'Vietnam', 'ho chi minh city': 'Vietnam',
  'da nang': 'Vietnam', 'hue': 'Vietnam',
  // Nepal
  'kathmandu': 'Nepal', 'pokhara': 'Nepal', 'lalitpur': 'Nepal',
  'patan': 'Nepal', 'bhaktapur': 'Nepal', 'bharatpur': 'Nepal',
  'biratnagar': 'Nepal', 'birgunj': 'Nepal', 'janakpur': 'Nepal',
  // Bangladesh
  'dhaka': 'Bangladesh', 'chittagong': 'Bangladesh', 'chattogram': 'Bangladesh',
  'sylhet': 'Bangladesh', 'rajshahi': 'Bangladesh', 'khulna': 'Bangladesh',
  // Myanmar
  'yangon': 'Myanmar', 'rangoon': 'Myanmar', 'naypyidaw': 'Myanmar',
  'mandalay': 'Myanmar',
  // Bhutan
  'thimphu': 'Bhutan', 'thimpu': 'Bhutan', 'paro': 'Bhutan', 'punakha': 'Bhutan',
  'phuntsholing': 'Bhutan',
  // Sri Lanka
  'colombo': 'Sri Lanka', 'kandy': 'Sri Lanka', 'galle': 'Sri Lanka',
  'jaffna': 'Sri Lanka', 'negombo': 'Sri Lanka',
  // Pakistan
  'karachi': 'Pakistan', 'lahore': 'Pakistan', 'islamabad': 'Pakistan',
  'faisalabad': 'Pakistan', 'rawalpindi': 'Pakistan', 'multan': 'Pakistan',
  // Egypt
  'cairo': 'Egypt', 'alexandria': 'Egypt', 'giza': 'Egypt',
  // South Africa
  'johannesburg': 'South Africa', 'cape town': 'South Africa', 'durban': 'South Africa',
  'pretoria': 'South Africa',
  // Kenya
  'nairobi': 'Kenya', 'mombasa': 'Kenya',
  // Nigeria
  'lagos': 'Nigeria', 'abuja': 'Nigeria',
  // Turkey
  'istanbul': 'Turkey', 'ankara': 'Turkey', 'izmir': 'Turkey',
  // Israel
  'tel aviv': 'Israel', 'jerusalem': 'Israel',
  // Jordan
  'amman': 'Jordan',
  // New Zealand
  'auckland': 'New Zealand', 'wellington': 'New Zealand', 'christchurch': 'New Zealand',
  // Russia
  'moscow': 'Russia', 'st. petersburg': 'Russia', 'saint petersburg': 'Russia',
  // Denmark
  'copenhagen': 'Denmark',
  // Spain
  'madrid': 'Spain', 'barcelona': 'Spain', 'seville': 'Spain', 'valencia': 'Spain',
  // Italy
  'rome': 'Italy', 'milan': 'Italy', 'naples': 'Italy', 'turin': 'Italy',
  'florence': 'Italy', 'venice': 'Italy',
  // Portugal
  'lisbon': 'Portugal', 'porto': 'Portugal',
  // Ireland
  'dublin': 'Ireland', 'cork': 'Ireland', 'galway': 'Ireland',
  // Greece
  'athens': 'Greece', 'thessaloniki': 'Greece',
  // Austria
  'vienna': 'Austria', 'salzburg': 'Austria', 'graz': 'Austria',
  // Finland
  'helsinki': 'Finland', 'tampere': 'Finland',
  // Norway
  'oslo': 'Norway', 'bergen': 'Norway',
  // Iceland
  'reykjavik': 'Iceland',
  // Poland
  'warsaw': 'Poland', 'krakow': 'Poland', 'wroclaw': 'Poland',
  // Czech Republic
  'prague': 'Czech Republic', 'brno': 'Czech Republic',
  // Hungary
  'budapest': 'Hungary',
  // Romania
  'bucharest': 'Romania', 'cluj-napoca': 'Romania',
  // Taiwan
  'taipei': 'Taiwan',
  // Kazakhstan
  'almaty': 'Kazakhstan', 'astana': 'Kazakhstan', 'nur-sultan': 'Kazakhstan',
  // Uzbekistan
  'tashkent': 'Uzbekistan', 'samarkand': 'Uzbekistan',
  // Azerbaijan
  'baku': 'Azerbaijan',
  // Georgia (country)
  'tbilisi': 'Georgia', 'batumi': 'Georgia',
  // Armenia
  'yerevan': 'Armenia',
  // Morocco
  'casablanca': 'Morocco', 'rabat': 'Morocco', 'marrakech': 'Morocco',
  // Tanzania
  'dar es salaam': 'Tanzania', 'arusha': 'Tanzania',
  // Uganda
  'kampala': 'Uganda',
  // Ghana
  'accra': 'Ghana',
  // Ethiopia
  'addis ababa': 'Ethiopia',
  // Maldives
  'male': 'Maldives', 'malé': 'Maldives',
  // Mexico
  'mexico city': 'Mexico', 'guadalajara': 'Mexico', 'monterrey': 'Mexico',
  'cancun': 'Mexico',
  // Brazil
  'sao paulo': 'Brazil', 'são paulo': 'Brazil', 'rio de janeiro': 'Brazil',
  'brasilia': 'Brazil', 'brasília': 'Brazil',
  // Argentina
  'buenos aires': 'Argentina',
  // Colombia
  'bogota': 'Colombia', 'bogotá': 'Colombia', 'medellin': 'Colombia',
  // Chile
  'santiago': 'Chile',
  // Cambodia
  'phnom penh': 'Cambodia', 'siem reap': 'Cambodia',
  // Mongolia
  'ulaanbaatar': 'Mongolia',
  // Cyprus
  'nicosia': 'Cyprus', 'limassol': 'Cyprus', 'larnaca': 'Cyprus',
  // Malta
  'valletta': 'Malta',
  // Luxembourg
  'luxembourg': 'Luxembourg', 'luxembourg city': 'Luxembourg',
  // Yemen
  "sana'a": 'Yemen', 'sanaa': 'Yemen', 'aden': 'Yemen',
  // Lebanon
  'beirut': 'Lebanon',
  // Iraq
  'baghdad': 'Iraq', 'basra': 'Iraq', 'erbil': 'Iraq',
  // Iran
  'tehran': 'Iran', 'isfahan': 'Iran', 'mashhad': 'Iran',
  // Afghanistan
  'kabul': 'Afghanistan',
  // Country names typed as city
  'philippines': 'Philippines', 'indonesia': 'Indonesia', 'vietnam': 'Vietnam',
  'viet nam': 'Vietnam', 'thailand': 'Thailand', 'malaysia': 'Malaysia',
  'china': 'China', 'japan': 'Japan', 'south korea': 'South Korea',
  'taiwan': 'Taiwan', 'australia': 'Australia', 'canada': 'Canada',
  'germany': 'Germany', 'france': 'France', 'italy': 'Italy', 'spain': 'Spain',
  'netherlands': 'Netherlands', 'switzerland': 'Switzerland', 'belgium': 'Belgium',
  'sweden': 'Sweden', 'denmark': 'Denmark', 'finland': 'Finland',
  'norway': 'Norway', 'austria': 'Austria', 'poland': 'Poland',
  'russia': 'Russia', 'turkey': 'Turkey', 'ukraine': 'Ukraine',
  'saudi arabia': 'Saudi Arabia', 'qatar': 'Qatar', 'bahrain': 'Bahrain',
  'oman': 'Oman', 'jordan': 'Jordan', 'egypt': 'Egypt', 'nigeria': 'Nigeria',
  'kenya': 'Kenya', 'south africa': 'South Africa', 'ghana': 'Ghana',
  'brazil': 'Brazil', 'argentina': 'Argentina', 'chile': 'Chile',
  'colombia': 'Colombia', 'mexico': 'Mexico', 'iran': 'Iran', 'iraq': 'Iraq',
  'israel': 'Israel', 'myanmar': 'Myanmar', 'burma': 'Myanmar',
  'new zealand': 'New Zealand', 'maldives': 'Maldives', 'sri lanka': 'Sri Lanka',
  'nepal': 'Nepal', 'bhutan': 'Bhutan', 'bangladesh': 'Bangladesh',
};

export function inferCountryFromCity(city: string): string {
  if (!city) return 'India';
  const lower = city.toLowerCase().trim();
  if (lower && CITY_COUNTRY_MAP[lower]) return CITY_COUNTRY_MAP[lower];
  for (const [key, c] of Object.entries(CITY_COUNTRY_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return c;
  }
  return 'India';
}

function inferCountry(city: string, rawCountry: string): string {
  if (!city && !rawCountry) return 'India';
  const lower = city.toLowerCase().trim();
  // Direct match
  if (lower && CITY_COUNTRY_MAP[lower]) return CITY_COUNTRY_MAP[lower];
  // Partial match
  if (lower) {
    for (const [key, c] of Object.entries(CITY_COUNTRY_MAP)) {
      if (lower.includes(key) || key.includes(lower)) return c;
    }
  }
  // City not found — trust PMS country if it's not India/blank; otherwise default India
  const rawNorm = rawCountry.toLowerCase().trim();
  if (rawNorm && rawNorm !== 'india') return rawCountry.trim();
  return 'India';
}

export function mapRawToAssignment(r: Record<string, unknown>): ParsedAssignment {
  const batchType    = pickStr(r, 'batch_delivery_mode', 'BatchDeliveryMode', 'Batch_type', 'batch_type');
  const deliveryMode = batchType ? deriveDeliveryMode(batchType) : '';
  const courseName   = pickStr(r, 'CourseName', 'course_name', 'Course_Name', 'Title', 'title') || 'Assignment';
  const clientName   = pickStr(r, 'ClientName', 'client_name', 'Client_Name', 'Customer', 'customer_name');
  const trainerName  = pickStr(r, 'TrainerName', 'trainer_name', 'Trainer', 'trainer');
  const trainerEmail = pickStr(r, 'TrainerEmail', 'trainer_email');
  const batchId      = pickStr(r, 'BatchId', 'batch_id', 'BatchID', 'Batch_Id');
  const manager      = pickStr(r, 'Manager', 'manager', 'manager_name', 'ManagerName');
  const totalPax     = pickStr(r, 'TotalPax', 'total_pax', 'totalPax', 'pax');
  const city         = pickStr(r, 'city_of_training', 'CityOfTraining', 'City', 'city', 'TrainingCity', 'training_city');
  const rawCountry   = pickStr(r, 'Country', 'country', 'CountryName', 'country_name');
  const country      = inferCountry(city, rawCountry);
  const trainingVenue= pickStr(r, 'training_venue', 'TrainingVenue', 'Venue', 'venue');
  const assignmentId = pickStr(r, 'AssignmentId', 'AssignmentID', 'assignment_id');

  let startDate = pickDate(r,
    'StarDate', 'start_date', 'StartDate',
    'AssignmentStartDate', 'assignment_start_date',
    'BatchStartDate', 'batch_start_date',
    'TrainingStartDate', 'training_start_date',
    'BatchFromDate', 'batch_from_date',
    'From_Date', 'from_date', 'FromDate',
    'DateFrom', 'date_from', 'BatchFrom', 'AssignmentFrom',
  );
  let endDate = pickDate(r,
    'end_date', 'EndDate',
    'AssignmentEndDate', 'assignment_end_date',
    'BatchEndDate', 'batch_end_date',
    'TrainingEndDate', 'training_end_date',
    'BatchToDate', 'batch_to_date',
    'To_Date', 'to_date', 'ToDate',
    'DateTo', 'date_to', 'BatchTo', 'AssignmentTo',
  );

  const rawTrainingDates = pickStr(r, 'training_dates', 'TrainingDates', 'BatchDates', 'batch_dates', 'AssignmentDates', 'assignment_dates');
  if (!startDate || !endDate) {
    const parsed = parseTrainingDates(rawTrainingDates || null);
    if (!startDate && parsed.startDate) startDate = parsed.startDate;
    if (!endDate   && parsed.endDate)   endDate   = parsed.endDate;
  }

  // Last-resort scan: look for any record field whose name contains start/from/end/to
  // and whose value parses as a date in the 2020-2030 window.
  if (!startDate || !endDate) {
    for (const [key, val] of Object.entries(r)) {
      if (!val || typeof val !== 'string') continue;
      const parsed = parseApiDate(val);
      if (!parsed || !/^20[2-3]\d-/.test(parsed)) continue;
      const lk = key.toLowerCase();
      if (!startDate && (lk.includes('start') || lk.includes('from') || lk === 'begindate' || lk === 'begin_date')) startDate = parsed;
      if (!endDate   && (lk.includes('end')   || lk.includes('to')   || lk === 'finishdate' || lk === 'finish_date' || lk === 'close_date')) endDate = parsed;
    }
  }

  const scid           = r.SCID != null ? String(r.SCID) : pickStr(r, 'scid', 'Scid');
  const noOfParticipants = r.NoOfParticipants != null ? String(r.NoOfParticipants) : pickStr(r, 'TotalPax', 'total_pax');
  const startTime      = pickStr(r, 'Start_time', 'start_time', 'StartTime', 'start_Time');
  const endTime        = pickStr(r, 'end_time', 'End_time', 'EndTime', 'End_Time');

  return {
    assignmentId, batchId, courseName, clientName,
    batchType, deliveryMode,
    startDate, endDate,
    city, country, trainingVenue,
    trainerName, trainerEmail, manager, totalPax,
    scid, noOfParticipants, startTime, endTime,
    // trainingDates non-null = suppress "inferred" badge in UI.
    // Use raw string if present; otherwise synthesize from parsed dates so badge
    // only shows when ALL date sources failed and we truly fell back to claim range.
    trainingDates: rawTrainingDates || (startDate ? `${startDate} to ${endDate || startDate}` : null),
  };
}

// ── Leave record parsing (mirrors CreateTADABill normalizeLeaveRecord / parseLeaveDate) ──

export interface ParsedLeave {
  emp_code: string | null;
  emp_name: string | null;
  from_date: string | null;   // ISO YYYY-MM-DD
  from_time: string | null;
  to_date: string | null;     // ISO YYYY-MM-DD
  to_time: string | null;
  leave_status: string | null;
  leave_approval_date: string | null;
  leave_type: string | null;
  half_day: string | null;
  is_half_day: boolean | null;
  duration: string | null;
  no_of_days: number | null;
}

function parseLeaveDate(raw: string | null | undefined): string {
  if (!raw) return '';
  const s = String(raw).trim();
  if (!s || s === 'null') return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  const monMatch = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (monMatch) {
    const [, dd, mon, yyyy] = monMatch;
    const mm = MONTH_MAP[mon] ?? MONTH_MAP[mon.charAt(0).toUpperCase() + mon.slice(1).toLowerCase()] ?? '01';
    return `${yyyy}-${mm}-${dd.padStart(2, '0')}`;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('-');
    return `${yyyy}-${mm}-${dd}`;
  }
  return s.slice(0, 10);
}

export function normalizeLeave(r: Record<string, unknown>): ParsedLeave {
  const g = (a: string, b: string) => (r[a] ?? r[b] ?? null) as string | null;
  return {
    emp_code:            g('emp_code', 'Emp_Code'),
    emp_name:            g('emp_name', 'Emp_Name'),
    from_date:           parseLeaveDate(String(r.from_date ?? r.From_Date ?? '')) || null,
    from_time:           (r.from_time as string | null) ?? null,
    to_date:             parseLeaveDate(String(r.to_date ?? r.To_Date ?? '')) || null,
    to_time:             (r.to_time as string | null) ?? null,
    leave_status:        g('leave_status', 'Leave_Status'),
    leave_approval_date: parseLeaveDate(String(r.leave_approval_date ?? r.Leave_Approval_Date ?? '')) || null,
    leave_type:          g('leave_type', 'Leave_Type'),
    half_day:            (r.half_day as string | null) ?? null,
    is_half_day:         (r.is_half_day as boolean | null) ?? null,
    duration:            (r.duration as string | null) ?? null,
    no_of_days:          r.no_of_days != null ? Number(r.no_of_days) : null,
  };
}

export function isApprovedLeave(s: string | null): boolean {
  if (!s) return false;
  const v = s.toLowerCase().trim();
  return v.includes('approv') || v.includes('sanction') || v.includes('accept') || v.includes('granted');
}
export function isPendingLeave(s: string | null): boolean {
  if (!s) return false;
  const v = s.toLowerCase().trim();
  return v.includes('pending') || v.includes('review') || v.includes('submitted');
}
export function isCancelledLeave(s: string | null): boolean {
  if (!s) return false;
  const v = s.toLowerCase().trim();
  return v.includes('cancel') || v.includes('revok') || v.includes('reject') || v.includes('withdraw') || v.includes('denied');
}

export function fmtAssignmentDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Flight date/time parsers (mirrors CreateTADABill parseDT / parseTM) ──────

export function parseDT(dt: string | null | undefined): string {
  if (!dt) return '';
  const s = String(dt).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const mddyMatch = s.match(/^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})/);
  if (mddyMatch) {
    const [, mon, dd, yyyy] = mddyMatch;
    const key = mon.charAt(0).toUpperCase() + mon.slice(1).toLowerCase();
    const mm = MONTH_MAP[mon] ?? MONTH_MAP[key] ?? '01';
    return `${yyyy}-${mm}-${dd.padStart(2, '0')}`;
  }
  const monMatch = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (monMatch) {
    const [, dd, mon, yyyy] = monMatch;
    const mm = MONTH_MAP[mon] ?? MONTH_MAP[mon.charAt(0).toUpperCase() + mon.slice(1).toLowerCase()] ?? '01';
    return `${yyyy}-${mm}-${dd.padStart(2, '0')}`;
  }
  const slashMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) { const [, dd, mm, yyyy] = slashMatch; return `${yyyy}-${mm}-${dd}`; }
  const dmyMatch = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmyMatch) { const [, dd, mm, yyyy] = dmyMatch; return `${yyyy}-${mm}-${dd}`; }
  return s.slice(0, 10);
}

export function parseTM(t: string | null | undefined): string {
  if (!t) return '';
  return String(t).length >= 5 ? String(t).slice(0, 5) : String(t);
}
