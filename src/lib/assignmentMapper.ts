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
  // Comprehensive world city→country map, merged and kept in sync across CreateTADABill.tsx
  // and assignmentMapper.ts on 2026-08-10 — both files must use the IDENTICAL list.
  "aalborg": "Denmark", "aarhus": "Denmark", "aba": "Nigeria", "aberdeen": "UK", "abha": "Saudi Arabia",
  "abidjan": "Ivory Coast", "abu dhabi": "United Arab Emirates", "abuja": "Nigeria", "acapulco": "Mexico",
  "accra": "Ghana", "adana": "Turkey", "addis": "Ethiopia", "addis ababa": "Ethiopia", "addu": "Maldives",
  "addu city": "Maldives", "adelaide": "Australia", "aden": "Yemen", "aden'a": "Yemen", "afghanistan": "Afghanistan",
  "agra": "India", "aguascalientes": "Mexico", "ahmedabad": "India", "ahvaz": "Iran",
  "ajman": "United Arab Emirates", "aktobe": "Kazakhstan", "akyab": "Myanmar", "al ain": "United Arab Emirates",
  "al khobar": "Saudi Arabia", "albuquerque": "USA", "aleppo": "Syria", "alexandria": "Egypt", "algeria": "Algeria",
  "algiers": "Algeria", "ali sabieh": "Djibouti", "alicante": "Spain", "almaty": "Kazakhstan", "america": "USA",
  "amman": "Jordan", "ampang": "Malaysia", "ampara": "Sri Lanka", "amritsar": "India", "amsterdam": "Netherlands",
  "andijan": "Uzbekistan", "andorra la vella": "Andorra", "angeles": "Philippines", "angola": "Angola",
  "ankara": "Turkey", "annaba": "Algeria", "antalya": "Turkey", "antananarivo": "Madagascar",
  "antipolo": "Philippines", "antofagasta": "Chile", "antsirabe": "Madagascar", "antwerp": "Belgium",
  "anuradhapura": "Sri Lanka", "apia": "Samoa", "aqaba": "Jordan", "arequipa": "Peru", "argentina": "Argentina",
  "arugam bay": "Sri Lanka", "arusha": "Tanzania", "ashdod": "Israel", "ashgabat": "Turkmenistan",
  "asmara": "Eritrea", "asmera": "Eritrea", "astana": "Kazakhstan", "asuncion": "Paraguay", "asunción": "Paraguay",
  "aswan": "Egypt", "athens": "Greece", "atlanta": "USA", "auckland": "New Zealand", "aurangabad": "India",
  "austin": "USA", "australia": "Australia", "austria": "Austria", "bacolod": "Philippines", "badulla": "Sri Lanka",
  "bafoussam": "Cameroon", "bagerhat": "Bangladesh", "baghdad": "Iraq", "bago": "Myanmar", "baguio": "Philippines",
  "bahrain": "Bahrain", "baku": "Azerbaijan", "bali": "Indonesia", "balikpapan": "Indonesia", "balti": "Moldova",
  "baltimore": "USA", "bamako": "Mali", "bambari": "Central African Republic", "bamenda": "Cameroon",
  "bandar abbas": "Iran", "bandar seri begawan": "Brunei", "bandung": "Indonesia", "banepa": "Nepal",
  "bangalore": "India", "bangkok": "Thailand", "bangladesh": "Bangladesh", "bangui": "Central African Republic",
  "banja luka": "Bosnia and Herzegovina", "barcelona": "Spain", "bari": "Italy", "barisal": "Bangladesh",
  "barishal": "Bangladesh", "baroda": "India", "barquisimeto": "Venezuela", "barranquilla": "Colombia",
  "basel": "Switzerland", "basra": "Iraq", "bassein": "Myanmar", "basseterre": "Saint Kitts and Nevis",
  "bata": "Equatorial Guinea", "batam": "Indonesia", "battambang": "Cambodia", "batticaloa": "Sri Lanka",
  "batumi": "Georgia", "baucau": "East Timor", "beer sheva": "Israel", "beijing": "China", "beira": "Mozambique",
  "beirut": "Lebanon", "bekasi": "Indonesia", "belem": "Brazil", "belfast": "UK", "belgium": "Belgium",
  "belgrade": "Serbia", "belize city": "Belize", "belmopan": "Belize", "belo horizonte": "Brazil", "belém": "Brazil",
  "bengaluru": "India", "benghazi": "Libya", "benguela": "Angola", "benin city": "Nigeria", "bentota": "Sri Lanka",
  "berbera": "Somalia", "bergen": "Norway", "berlin": "Germany", "bern": "Switzerland", "beruwala": "Sri Lanka",
  "bethlehem": "Palestine", "bgc": "Philippines", "bhadgaon": "Nepal", "bhairahawa": "Nepal", "bhaktapur": "Nepal",
  "bharatpur": "Nepal", "bhola": "Bangladesh", "bhopal": "India", "bhubaneswar": "India", "bhutan": "Bhutan",
  "bien hoa": "Vietnam", "bilbao": "Spain", "biratnagar": "Nepal", "birendranagar": "Nepal", "birgunj": "Nepal",
  "birmingham": "UK", "bishkek": "Kyrgyzstan", "bissau": "Guinea-Bissau", "bitola": "North Macedonia",
  "bizerte": "Tunisia", "blantyre": "Malawi", "blida": "Algeria", "bloemfontein": "South Africa",
  "bo": "Sierra Leone", "bobo-dioulasso": "Burkina Faso", "bogor": "Indonesia", "bogota": "Colombia",
  "bogotá": "Colombia", "bogra": "Bangladesh", "bogura": "Bangladesh", "bolivia": "Bolivia", "bologna": "Italy",
  "bombay": "India", "bonifacio global city": "Philippines", "bordeaux": "France", "bosaso": "Somalia",
  "boston": "USA", "bouake": "Ivory Coast", "bradford": "UK", "braga": "Portugal", "brahmanbaria": "Bangladesh",
  "brampton": "Canada", "brasilia": "Brazil", "brasília": "Brazil", "bratislava": "Slovakia", "brazil": "Brazil",
  "brazzaville": "Republic of Congo", "breda": "Netherlands", "bremen": "Germany", "bridgetown": "Barbados",
  "brikama": "Gambia", "brisbane": "Australia", "bristol": "UK", "britain": "UK", "brno": "Czech Republic",
  "bruges": "Belgium", "brunei": "Brunei", "brussels": "Belgium", "bsb": "Brunei", "bucaramanga": "Colombia",
  "bucharest": "Romania", "budapest": "Hungary", "buenos aires": "Argentina", "bujumbura": "Burundi",
  "bukavu": "Democratic Republic of the Congo", "bukhara": "Uzbekistan", "bulawayo": "Zimbabwe",
  "bumthang": "Bhutan", "bunia": "Democratic Republic of the Congo", "buon ma thuot": "Vietnam",
  "buraidah": "Saudi Arabia", "burgas": "Bulgaria", "burma": "Myanmar", "bursa": "Turkey", "burundi": "Burundi",
  "busan": "South Korea", "butare": "Rwanda", "butuan": "Philippines", "butwal": "Nepal",
  "cagayan de oro": "Philippines", "cairns": "Australia", "cairo": "Egypt", "calcutta": "India", "calgary": "Canada",
  "cali": "Colombia", "caloocan": "Philippines", "cambodia": "Cambodia", "cambridge": "UK", "cameroon": "Cameroon",
  "campo grande": "Brazil", "can tho": "Vietnam", "canada": "Canada", "canberra": "Australia", "cancun": "Mexico",
  "cape town": "South Africa", "caracas": "Venezuela", "cardiff": "UK", "cartagena": "Colombia",
  "casablanca": "Morocco", "castries": "Saint Lucia", "catania": "Italy", "cebu": "Philippines", "chad": "Chad",
  "chandigarh": "India", "changsha": "China", "chapainawabganj": "Bangladesh", "charlotte": "USA",
  "chattogram": "Bangladesh", "chelyabinsk": "Russia", "chengdu": "China", "chennai": "India", "chhukha": "Bhutan",
  "chiang mai": "Thailand", "chiang rai": "Thailand", "chiba": "Japan", "chicago": "USA", "chiclayo": "Peru",
  "chilaw": "Sri Lanka", "chile": "Chile", "china": "China", "chipata": "Zambia", "chisinau": "Moldova",
  "chittagong": "Bangladesh", "chitungwiza": "Zimbabwe", "chișinău": "Moldova", "chongqing": "China",
  "christchurch": "New Zealand", "chukha": "Bhutan", "ciudad juarez": "Mexico", "clark": "Philippines",
  "cluj": "Romania", "cluj-napoca": "Romania", "cochabamba": "Bolivia", "cochin": "India", "coimbatore": "India",
  "coimbra": "Portugal", "cologne": "Germany", "colombia": "Colombia", "colombo": "Sri Lanka", "columbus": "USA",
  "comilla": "Bangladesh", "conakry": "Guinea", "concepcion": "Chile", "concepción": "Chile", "constanta": "Romania",
  "constantine": "Algeria", "copenhagen": "Denmark", "cordoba": "Argentina", "cork": "Ireland",
  "cotabato": "Philippines", "cotonou": "Benin", "coventry": "UK", "cox's bazar": "Bangladesh",
  "coxs bazar": "Bangladesh", "cuba": "Cuba", "cuenca": "Ecuador", "culiacan": "Mexico", "cumilla": "Bangladesh",
  "curitiba": "Brazil", "cusco": "Peru", "cuzco": "Peru", "cyberjaya": "Malaysia", "córdoba": "Argentina",
  "córdoba es": "Spain", "da nang": "Vietnam", "daegu": "South Korea", "daejeon": "South Korea", "dagana": "Bhutan",
  "dagupan": "Philippines", "dakar": "Senegal", "dalat": "Vietnam", "dalian": "China", "dallas": "USA",
  "daloa": "Ivory Coast", "damak": "Nepal", "damascus": "Syria", "dambulla": "Sri Lanka", "dammam": "Saudi Arabia",
  "dar es salaam": "Tanzania", "darkhan": "Mongolia", "darwin": "Australia", "daugavpils": "Latvia",
  "davao": "Philippines", "dawei": "Myanmar", "debrecen": "Hungary", "dehradun": "India", "deir ez-zor": "Syria",
  "delhi": "India", "denmark": "Denmark", "denver": "USA", "depok": "Indonesia", "detroit": "USA",
  "dhahran": "Saudi Arabia", "dhaka": "Bangladesh", "dhaka north": "Bangladesh", "dhaka south": "Bangladesh",
  "dhangadhi": "Nepal", "dharan": "Nepal", "dharwad": "India", "dhulikhel": "Nepal", "dili": "East Timor",
  "dinajpur": "Bangladesh", "dire dawa": "Ethiopia", "djibouti": "Djibouti", "djibouti city": "Djibouti",
  "dnipro": "Ukraine", "dodoma": "Tanzania", "doha": "Qatar", "dongguan": "China", "dortmund": "Germany",
  "douala": "Cameroon", "drammen": "Norway", "dresden": "Germany", "dubai": "United Arab Emirates",
  "dublin": "Ireland", "dubrovnik": "Croatia", "dunedin": "New Zealand", "durban": "South Africa",
  "durres": "Albania", "durrës": "Albania", "dushanbe": "Tajikistan", "dusseldorf": "Germany",
  "düsseldorf": "Germany", "east london": "South Africa", "ecuador": "Ecuador", "edinburgh": "UK",
  "edmonton": "Canada", "egypt": "Egypt", "eindhoven": "Netherlands", "eldoret": "Kenya", "ella": "Sri Lanka",
  "emirates": "United Arab Emirates", "england": "UK", "entebbe": "Uganda", "erbil": "Iraq", "erdenet": "Mongolia",
  "ermita": "Philippines", "esbjerg": "Denmark", "espoo": "Finland", "essen": "Germany", "ethiopia": "Ethiopia",
  "faisalabad": "Pakistan", "fallujah": "Iraq", "famagusta": "Cyprus", "faridabad": "India",
  "faridpur": "Bangladesh", "faro": "Portugal", "feni": "Bangladesh", "fergana": "Uzbekistan", "fez": "Morocco",
  "fianarantsoa": "Madagascar", "finland": "Finland", "florence": "Italy", "florianopolis": "Brazil",
  "fortaleza": "Brazil", "foshan": "China", "france": "France", "francistown": "Botswana", "frankfurt": "Germany",
  "freetown": "Sierra Leone", "fresno": "USA", "fujairah": "United Arab Emirates", "fukuoka": "Japan",
  "funafuti": "Tuvalu", "funchal": "Portugal", "fuvahmulah": "Maldives", "fuzhou": "China", "gaborone": "Botswana",
  "galle": "Sri Lanka", "galway": "Ireland", "gampaha": "Sri Lanka", "ganja": "Azerbaijan", "gao": "Mali",
  "garoua": "Cameroon", "gasa": "Bhutan", "gatwick": "UK", "gaza": "Palestine", "gaziantep": "Turkey",
  "gazipur": "Bangladesh", "gbarnga": "Liberia", "gdansk": "Poland", "geelong": "Australia", "gelephu": "Bhutan",
  "general santos": "Philippines", "geneva": "Switzerland", "genoa": "Italy", "genova": "Italy",
  "georgetown": "Guyana", "germany": "Germany", "ghana": "Ghana", "ghent": "Belgium", "ghorahi": "Nepal",
  "gibraltar": "Gibraltar", "gitarama": "Rwanda", "gitega": "Burundi", "giza": "Egypt", "glasgow": "UK",
  "goa": "India", "goiania": "Brazil", "gold coast": "Australia", "goma": "Democratic Republic of the Congo",
  "gomel": "Belarus", "gondar": "Ethiopia", "gopalganj": "Bangladesh", "gothenburg": "Sweden", "granada": "Spain",
  "graz": "Austria", "greensboro": "USA", "greenwood": "USA", "grenoble": "France", "grodno": "Belarus",
  "groningen": "Netherlands", "guadalajara": "Mexico",
  "guangzhou": "China", "guatemala city": "Guatemala", "guayaquil": "Ecuador", "gujranwala": "Pakistan",
  "gurgaon": "India", "gurugram": "India", "guwahati": "India", "guyana": "Guyana", "gwangju": "South Korea",
  "gweru": "Zimbabwe", "gyumri": "Armenia", "haa": "Bhutan", "habana": "Cuba", "haifa": "Israel",
  "haiphong": "Vietnam", "hakha": "Myanmar", "hama": "Syria", "hamadan": "Iran", "hambantota": "Sri Lanka",
  "hamburg": "Germany", "hamilton": "New Zealand", "hamilton on": "Canada", "hangzhou": "China",
  "hannover": "Germany", "hanoi": "Vietnam", "harare": "Zimbabwe", "harbin": "China", "hargeisa": "Somalia",
  "hat yai": "Thailand", "havana": "Cuba", "hawassa": "Ethiopia", "heathrow": "UK", "hebron": "Palestine",
  "hefei": "China", "helsinki": "Finland", "heraklion": "Greece", "herat": "Afghanistan", "hermosillo": "Mexico",
  "hetauda": "Nepal", "hikkaduwa": "Sri Lanka", "hinthada": "Myanmar", "hiroshima": "Japan",
  "ho chi minh": "Vietnam", "ho chi minh city": "Vietnam", "hobart": "Australia", "homs": "Syria",
  "hong kong": "Hong Kong", "honiara": "Solomon Islands", "houston": "USA", "hpa an": "Myanmar", "hpa-an": "Myanmar",
  "hsinchu": "Taiwan", "hua hin": "Thailand", "huambo": "Angola", "hubli": "India", "hudaydah": "Yemen",
  "hue": "Vietnam", "hurghada": "Egypt", "hyderabad": "India", "hyderabad pk": "Pakistan", "iasi": "Romania",
  "iași": "Romania", "ibadan": "Nigeria", "iligan": "Philippines", "iloilo": "Philippines", "inaruwa": "Nepal",
  "incheon": "South Korea", "indianapolis": "USA", "indonesia": "Indonesia", "indore": "India",
  "innsbruck": "Austria", "ipoh": "Malaysia", "iquique": "Chile", "iquitos": "Peru", "iran": "Iran", "iraq": "Iraq",
  "irbid": "Jordan", "isfahan": "Iran", "islamabad": "Pakistan", "ismailia": "Egypt", "israel": "Israel",
  "istanbul": "Turkey", "itahari": "Nepal", "italy": "Italy", "izmir": "Turkey", "jabalpur": "India",
  "jacksonville": "USA", "jaffna": "Sri Lanka", "jaipur": "India", "jakarta": "Indonesia",
  "jalal-abad": "Kyrgyzstan", "jalalabad": "Afghanistan", "jamaica": "Jamaica", "jamalpur": "Bangladesh",
  "janakpur": "Nepal", "janakpurdham": "Nepal", "japan": "Japan", "jashore": "Bangladesh",
  "jebel ali": "United Arab Emirates", "jeddah": "Saudi Arabia", "jenin": "Palestine", "jericho": "Palestine",
  "jerusalem": "Israel", "jessore": "Bangladesh", "jhalokathi": "Bangladesh", "jinan": "China", "jinja": "Uganda",
  "joao pessoa": "Brazil", "jodhpur": "India", "johannesburg": "South Africa", "johor bahru": "Malaysia",
  "jordan": "Jordan", "jos": "Nigeria", "jounieh": "Lebanon", "juarez": "Mexico", "jubail": "Saudi Arabia",
  "jyväskylä": "Finland", "kabul": "Afghanistan", "kabwe": "Zambia", "kaduna": "Nigeria", "kairouan": "Tunisia",
  "kalay": "Myanmar", "kalmunai": "Sri Lanka", "kalutara": "Sri Lanka", "kampala": "Uganda",
  "kandahar": "Afghanistan", "kandy": "Sri Lanka", "kankan": "Guinea", "kano": "Nigeria", "kansas city": "USA",
  "kaohsiung": "Taiwan", "karachi": "Pakistan", "karaganda": "Kazakhstan", "karaj": "Iran", "karakol": "Kyrgyzstan",
  "karbala": "Iraq", "kassala": "Sudan", "kathmandu": "Nepal", "katowice": "Poland", "kaunas": "Lithuania",
  "kawasaki": "Japan", "kawkareik": "Myanmar", "kayseri": "Turkey", "kazan": "Russia", "keelung": "Taiwan",
  "kegalle": "Sri Lanka", "kenema": "Sierra Leone", "kengtung": "Myanmar", "kenya": "Kenya", "keren": "Eritrea",
  "kharkiv": "Ukraine", "khartoum": "Sudan", "khobar": "Saudi Arabia", "khon kaen": "Thailand",
  "khujand": "Tajikistan", "khulna": "Bangladesh", "kiev": "Ukraine", "kigali": "Rwanda", "kilinochchi": "Sri Lanka",
  "kimberley": "South Africa", "kingston": "Jamaica", "kingstown": "Saint Vincent and the Grenadines",
  "kinshasa": "Democratic Republic of the Congo", "kirkuk": "Iraq", "kirtipur": "Nepal",
  "kisangani": "Democratic Republic of the Congo", "kishorganj": "Bangladesh", "kismayo": "Somalia",
  "kisumu": "Kenya", "kitakyushu": "Japan", "kitwe": "Zambia", "kl": "Malaysia", "klagenfurt": "Austria",
  "klaipeda": "Lithuania", "klaipėda": "Lithuania", "klang": "Malaysia", "kobe": "Japan", "kochi": "India",
  "kolkata": "India", "konya": "Turkey", "korat": "Thailand", "koror": "Palau", "kota kinabalu": "Malaysia",
  "kotte": "Sri Lanka", "koudougou": "Burkina Faso", "kragujevac": "Serbia", "krakow": "Poland",
  "kuala belait": "Brunei", "kuala lampur": "Malaysia", "kuala lumpur": "Malaysia", "kuching": "Malaysia",
  "kulob": "Tajikistan", "kumamoto": "Japan", "kumasi": "Ghana", "kunduz": "Afghanistan", "kunming": "China",
  "kurunegala": "Sri Lanka", "kushtia": "Bangladesh", "kutaisi": "Georgia", "kuwait": "Kuwait",
  "kuwait city": "Kuwait", "kyaingtong": "Myanmar", "kyaukpyu": "Myanmar", "kyiv": "Ukraine", "kyoto": "Japan",
  "la": "USA", "la ceiba": "Honduras", "la paz": "Bolivia", "la plata": "Argentina", "lae": "Papua New Guinea",
  "lagos": "Nigeria", "lahore": "Pakistan", "lalitpur": "Nepal", "laoag": "Philippines", "laos": "Laos",
  "larissa": "Greece", "larnaca": "Cyprus", "las pinas": "Philippines", "las piñas": "Philippines",
  "las vegas": "USA", "lashio": "Myanmar", "latakia": "Syria", "lausanne": "Switzerland", "lebanon": "Lebanon",
  "leeds": "UK", "legazpi": "Philippines", "leicester": "UK", "leipzig": "Germany", "lekhnath": "Nepal",
  "leon": "Mexico", "lhuntse": "Bhutan", "libreville": "Gabon", "libya": "Libya", "liege": "Belgium",
  "lille": "France", "lilongwe": "Malawi", "lima": "Peru", "limassol": "Cyprus", "limerick": "Ireland",
  "linkoping": "Sweden", "linköping": "Sweden", "linz": "Austria", "lisbon": "Portugal", "liverpool": "UK",
  "livingstone": "Zambia", "liège": "Belgium", "ljubljana": "Slovenia", "lobamba": "Eswatini", "lobito": "Angola",
  "lodz": "Poland", "loikaw": "Myanmar", "lombok": "Indonesia", "lome": "Togo", "lomé": "Togo", "london": "UK",
  "london city": "UK", "los angeles": "USA", "louisville": "USA", "luanda": "Angola", "luang prabang": "Laos",
  "lubango": "Angola", "lublin": "Poland", "lubumbashi": "Democratic Republic of the Congo", "lucknow": "India",
  "lusaka": "Zambia", "luxembourg": "Luxembourg", "luxembourg city": "Luxembourg", "luxor": "Egypt",
  "lviv": "Ukraine", "lyon": "France", "macao": "China", "macau": "China", "maceio": "Brazil",
  "madang": "Papua New Guinea", "madaripur": "Bangladesh", "madhyapur thimi": "Nepal", "madras": "India",
  "madrid": "Spain", "madurai": "India", "magway": "Myanmar", "magwe": "Myanmar", "mahajanga": "Madagascar",
  "maiduguri": "Nigeria", "majuro": "Marshall Islands", "makassar": "Indonesia", "makati": "Philippines",
  "malabo": "Equatorial Guinea", "malabon": "Philippines", "malaga": "Spain", "malawi": "Malawi",
  "malaysia": "Malaysia", "maldives": "Maldives", "male": "Maldives", "mali": "Mali", "malindi": "Kenya",
  "malmo": "Sweden", "malmö": "Sweden", "malé": "Maldives", "manado": "Indonesia", "managua": "Nicaragua",
  "manama": "Bahrain", "manaus": "Brazil", "manchester": "UK", "mandalay": "Myanmar", "mandaluyong": "Philippines",
  "mangalore": "India", "mangaluru": "India", "manikganj": "Bangladesh", "manila": "Philippines",
  "mannar": "Sri Lanka", "maputo": "Mozambique", "mar del plata": "Argentina", "maracaibo": "Venezuela",
  "maradi": "Niger", "marikina": "Philippines", "marrakech": "Morocco", "marseille": "France",
  "mary": "Turkmenistan", "maseru": "Lesotho", "mashhad": "Iran", "massawa": "Eritrea", "matale": "Sri Lanka",
  "matara": "Sri Lanka", "maun": "Botswana", "mawlamyine": "Myanmar", "maymyo": "Myanmar",
  "mazar-e-sharif": "Afghanistan", "mazar-i-sharif": "Afghanistan", "mbabane": "Eswatini",
  "mbuji-mayi": "Democratic Republic of the Congo", "mecca": "Saudi Arabia", "mechinagar": "Nepal",
  "medan": "Indonesia", "medellin": "Colombia", "medellín": "Colombia", "medina": "Saudi Arabia", "meerut": "India",
  "meherpur": "Bangladesh", "meiktila": "Myanmar", "mekelle": "Ethiopia", "melbourne": "Australia", "memphis": "USA",
  "mendoza": "Argentina", "mergui": "Myanmar", "merida": "Mexico", "mersin": "Turkey", "mesa": "USA",
  "mexicali": "Mexico", "mexico": "Mexico", "mexico city": "Mexico", "miami": "USA", "milan": "Italy",
  "milan city": "Italy", "milwaukee": "USA", "mindelo": "Cabo Verde", "minneapolis": "USA", "minsk": "Belarus",
  "mirissa": "Sri Lanka", "mirpur": "Bangladesh", "miskolc": "Hungary", "misrata": "Libya", "mississauga": "Canada",
  "mogadishu": "Somalia", "mogilev": "Belarus", "mombasa": "Kenya", "monaragala": "Sri Lanka", "monastir": "Tunisia",
  "mongar": "Bhutan", "monrovia": "Liberia", "monte carlo": "Monaco", "monterrey": "Mexico", "montevideo": "Uruguay",
  "montpellier": "France", "montreal": "Canada", "monywa": "Myanmar", "mopti": "Mali", "morocco": "Morocco",
  "moroni": "Comoros", "moscow": "Russia", "moshi": "Tanzania", "mostar": "Bosnia and Herzegovina", "mosul": "Iraq",
  "moulmein": "Myanmar", "moundou": "Chad", "mozambique": "Mozambique", "mukalla": "Yemen",
  "mullaitivu": "Sri Lanka", "multan": "Pakistan", "mumbai": "India", "munich": "Germany",
  "munshiganj": "Bangladesh", "muntinlupa": "Philippines", "murcia": "Spain", "muscat": "Oman", "mutare": "Zimbabwe",
  "mutsamudu": "Comoros", "mwanza": "Tanzania", "myanmar": "Myanmar", "myeik": "Myanmar", "myingyan": "Myanmar",
  "myitkyina": "Myanmar", "mymensingh": "Bangladesh", "mysore": "India", "mysuru": "India", "mzuzu": "Malawi",
  "málaga": "Spain", "n'djamena": "Chad", "nablus": "Palestine", "nacala": "Mozambique", "nadi": "Fiji",
  "naga": "Philippines", "nagoya": "Japan", "nagpur": "India", "nairobi": "Kenya", "najaf": "Iraq",
  "nakhon ratchasima": "Thailand", "nakuru": "Kenya", "namangan": "Uzbekistan", "nampula": "Mozambique",
  "namur": "Belgium", "nanjing": "China", "nantes": "France", "naples": "Italy", "narayanganj": "Bangladesh",
  "narayanghat": "Nepal", "narsingdi": "Bangladesh", "nashik": "India", "nashville": "USA", "nassau": "Bahamas",
  "natal": "Brazil", "natore": "Bangladesh", "navotas": "Philippines", "nawabganj": "Bangladesh",
  "nay pyi taw": "Myanmar", "naypyidaw": "Myanmar", "ndjamena": "Chad", "ndola": "Zambia", "negombo": "Sri Lanka",
  "nelspruit": "South Africa", "nepal": "Nepal", "nepalgunj": "Nepal", "netanya": "Israel",
  "netherlands": "Netherlands", "netrokona": "Bangladesh", "new delhi": "India", "new jersey": "USA",
  "new york": "USA", "new york city": "USA", "new zealand": "New Zealand", "newcastle": "UK",
  "newcastle au": "Australia", "ngerulmud": "Palau", "ngozi": "Burundi", "nha trang": "Vietnam", "niamey": "Niger",
  "nice": "France", "nicosia": "Cyprus", "niger": "Niger", "nigeria": "Nigeria", "niksic": "Montenegro",
  "north carolina": "USA",
  "nikšić": "Montenegro", "ningbo": "China", "nis": "Serbia", "nizhny novgorod": "Russia", "niš": "Serbia",
  "noakhali": "Bangladesh", "noida": "India", "norway": "Norway", "nottingham": "UK", "nouakchott": "Mauritania",
  "noumea": "New Caledonia", "nouméa": "New Caledonia", "novi sad": "Serbia", "novosibirsk": "Russia",
  "nuku'alofa": "Tonga", "nukualofa": "Tonga", "nukus": "Uzbekistan", "nur-sultan": "Kazakhstan",
  "nuremberg": "Germany", "nuwara": "Sri Lanka", "nuwara eliya": "Sri Lanka", "nyc": "USA", "nzerekore": "Guinea",
  "nürnberg": "Germany", "odense": "Denmark", "odesa": "Ukraine", "odessa": "Ukraine", "okayama": "Japan",
  "olongapo": "Philippines", "omaha": "USA", "oman": "Oman", "omdurman": "Sudan", "omsk": "Russia",
  "oran": "Algeria", "orebro": "Sweden", "oruro": "Bolivia", "osaka": "Japan", "osh": "Kyrgyzstan",
  "osijek": "Croatia", "oslo": "Norway", "ostrava": "Czech Republic", "ottawa": "Canada",
  "ouagadougou": "Burkina Faso", "oulu": "Finland", "oxford": "UK", "pabna": "Bangladesh", "padova": "Italy",
  "padua": "Italy", "pakistan": "Pakistan", "pakokku": "Myanmar", "pakse": "Laos", "palembang": "Indonesia",
  "palermo": "Italy", "palikir": "Micronesia", "palm jumeirah": "United Arab Emirates", "palma": "Spain",
  "palmerston north": "New Zealand", "panaji": "India", "panama city": "Panama", "paphos": "Cyprus",
  "paraguay": "Paraguay", "parakou": "Benin", "paramaribo": "Suriname", "paranaque": "Philippines",
  "parañaque": "Philippines", "paris": "France", "paro": "Bhutan", "pasay": "Philippines", "pasig": "Philippines",
  "patan": "Nepal", "pathein": "Myanmar", "patna": "India", "patras": "Greece", "pattaya": "Thailand",
  "patuakhali": "Bangladesh", "pavlodar": "Kazakhstan", "pecs": "Hungary", "pegu": "Myanmar",
  "pemagatshel": "Bhutan", "penang": "Malaysia", "perth": "Australia", "peru": "Peru", "peshawar": "Pakistan",
  "petaling jaya": "Malaysia", "petra": "Jordan", "philadelphia": "USA", "philippines": "Philippines",
  "phnom penh": "Cambodia", "phoenix": "USA", "phuentsholing": "Bhutan", "phuket": "Thailand",
  "phuntsholing": "Bhutan", "pilipinas": "Philippines", "pisa": "Italy", "piura": "Peru", "plovdiv": "Bulgaria",
  "plzen": "Czech Republic", "plzeň": "Czech Republic", "podgorica": "Montenegro",
  "pointe-noire": "Republic of Congo", "pokhara": "Nepal", "poland": "Poland", "polokwane": "South Africa",
  "polonnaruwa": "Sri Lanka", "port elizabeth": "South Africa", "port harcourt": "Nigeria",
  "port louis": "Mauritius", "port moresby": "Papua New Guinea", "port of spain": "Trinidad and Tobago",
  "port said": "Egypt", "port sudan": "Sudan", "port vila": "Vanuatu", "port-au-prince": "Haiti",
  "port-gentil": "Gabon", "portland": "USA", "porto": "Portugal", "porto alegre": "Brazil", "porto-novo": "Benin",
  "poznan": "Poland", "poznań": "Poland", "prague": "Czech Republic", "praia": "Cabo Verde", "praslin": "Seychelles",
  "pretoria": "South Africa", "prishtina": "Kosovo", "pristina": "Kosovo", "prizren": "Kosovo", "prome": "Myanmar",
  "puchong": "Malaysia", "puebla": "Mexico", "punakha": "Bhutan", "pune": "India", "putrajaya": "Malaysia",
  "puttalam": "Sri Lanka", "puttaparthi": "Sri Lanka", "pyay": "Myanmar", "pyin oo lwin": "Myanmar",
  "pyongyang": "North Korea", "pécs": "Hungary", "qalqilya": "Palestine", "qatar": "Qatar", "qingdao": "China",
  "qom": "Iran", "quatre bornes": "Mauritius", "quebec city": "Canada", "quelimane": "Mozambique",
  "quetta": "Pakistan", "quezon city": "Philippines", "quito": "Ecuador", "rabat": "Morocco", "raipur": "India",
  "rajkot": "India", "rajshahi": "Bangladesh", "raleigh": "USA", "ramallah": "Palestine", "ranchi": "India",
  "randers": "Denmark", "rangoon": "Myanmar", "rangpur": "Bangladesh", "raqqa": "Syria",
  "ras al khaimah": "United Arab Emirates", "rasht": "Iran", "ratnapura": "Sri Lanka", "rawalpindi": "Pakistan",
  "reading": "UK", "recife": "Brazil", "regina": "Canada", "rennes": "France", "reykjavik": "Iceland",
  "rhodes": "Greece", "riga": "Latvia", "rijeka": "Croatia", "rio": "Brazil", "rio de janeiro": "Brazil",
  "rishon lezion": "Israel", "riyadh": "Saudi Arabia", "rome": "Italy", "rosario": "Argentina",
  "rose hill": "Mauritius", "roseau": "Dominica", "rostov": "Russia", "rotterdam": "Netherlands", "rundu": "Namibia",
  "russia": "Russia", "rustavi": "Georgia", "rwanda": "Rwanda", "sacramento": "USA", "sagaing": "Myanmar",
  "saidpur": "Bangladesh", "saint georges": "Grenada", "saint johns": "Antigua and Barbuda",
  "saint petersburg": "Russia", "saint-louis": "Senegal", "sakai": "Japan", "salalah": "Oman", "salvador": "Brazil",
  "salzburg": "Austria", "samara": "Russia", "samarinda": "Indonesia", "samarkand": "Uzbekistan",
  "samdrup jongkhar": "Bhutan", "san diego": "USA", "san francisco": "USA", "san jose": "Costa Rica",
  "san jose ca": "USA", "san josé": "Costa Rica", "san marino": "San Marino", "san pedro ic": "Ivory Coast",
  "san pedro sula": "Honduras", "san salvador": "El Salvador", "sana'a": "Yemen", "sanaa": "Yemen",
  "sandton": "South Africa", "santa cruz": "Bolivia", "santiago": "Chile", "santo domingo": "Dominican Republic",
  "sao paulo": "Brazil", "sao tome": "Sao Tome and Principe", "sao tome city": "Sao Tome and Principe",
  "sapporo": "Japan", "sarajevo": "Bosnia and Herzegovina", "sarh": "Chad", "sarpang": "Bhutan",
  "saskatoon": "Canada", "satkhira": "Bangladesh", "saudi arabia": "Saudi Arabia", "savannakhet": "Laos",
  "seattle": "USA", "sekondi": "Ghana", "semarang": "Indonesia", "sendai": "Japan", "senegal": "Senegal",
  "seoul": "South Korea", "serekunda": "Gambia", "seria": "Brunei", "seville": "Spain", "sf": "USA",
  "south carolina": "USA",
  "sfax": "Tunisia", "shah alam": "Malaysia", "shanghai": "China", "shariatpur": "Bangladesh",
  "sharjah": "United Arab Emirates", "sharm el sheikh": "Egypt", "sheffield": "UK", "shenzhen": "China",
  "shiraz": "Iran", "shwebo": "Myanmar", "shymkent": "Kazakhstan", "sialkot": "Pakistan", "siddharthanagar": "Nepal",
  "sidon": "Lebanon", "siem reap": "Cambodia", "siena": "Italy", "sigiriya": "Sri Lanka",
  "sihanoukville": "Cambodia", "silicon valley": "USA", "sing": "Singapore", "singapore": "Singapore",
  "singapur": "Singapore", "sirajganj": "Bangladesh", "sirte": "Libya", "sittwe": "Myanmar",
  "skopje": "North Macedonia", "sofia": "Bulgaria", "sohar": "Oman", "sokode": "Togo", "somalia": "Somalia",
  "sousse": "Tunisia", "south africa": "South Africa", "south korea": "South Korea", "southampton": "UK",
  "soweto": "South Africa", "spain": "Spain", "split": "Croatia", "sri jayawardenepura kotte": "Sri Lanka",
  "sri lanka": "Sri Lanka", "srinagar": "India", "st. george's": "Grenada", "st. john's": "Antigua and Barbuda",
  "st. petersburg": "Russia", "st. pölten": "Austria", "stara zagora": "Bulgaria", "stavanger": "Norway",
  "stockholm": "Sweden", "stoke-on-trent": "UK", "strasbourg": "France", "stuttgart": "Germany",
  "subang jaya": "Malaysia", "sucre": "Bolivia", "sudan": "Sudan", "sulaymaniyah": "Iraq", "sumgayit": "Azerbaijan",
  "sunshine coast": "Australia", "surabaya": "Indonesia", "surat": "India", "suriname": "Suriname",
  "surrey": "Canada", "suva": "Fiji", "suwon": "South Korea", "suzhou": "China", "swakopmund": "Namibia",
  "swansea": "UK", "sweden": "Sweden", "switzerland": "Switzerland", "sydney": "Australia", "sylhet": "Bangladesh",
  "syria": "Syria", "szczecin": "Poland", "são paulo": "Brazil", "são tomé": "Sao Tome and Principe",
  "tabriz": "Iran", "tabuk": "Saudi Arabia", "tacloban": "Philippines", "taguig": "Philippines",
  "taichung": "Taiwan", "taif": "Saudi Arabia", "tainan": "Taiwan", "taipei": "Taiwan", "taiwan": "Taiwan",
  "taiz": "Yemen", "takoradi": "Ghana", "tallinn": "Estonia", "tamale": "Ghana", "tampere": "Finland",
  "tangail": "Bangladesh", "tangerang": "Indonesia", "tansen": "Nepal", "tanzania": "Tanzania", "tarawa": "Kiribati",
  "tartu": "Estonia", "tashigang": "Bhutan", "tashkent": "Uzbekistan", "taunggyi": "Myanmar", "taungoo": "Myanmar",
  "tauranga": "New Zealand", "tavoy": "Myanmar", "tbilisi": "Georgia", "tegucigalpa": "Honduras", "tehran": "Iran",
  "tel aviv": "Israel", "tel-aviv": "Israel", "temuco": "Chile", "tete": "Mozambique", "teyateyaneng": "Lesotho",
  "thailand": "Thailand", "thaton": "Myanmar", "the hague": "Netherlands", "thessaloniki": "Greece",
  "thies": "Senegal", "thika": "Kenya", "thimphu": "Bhutan", "thimpu": "Bhutan", "thiruvananthapuram": "India",
  "tianjin": "China", "tijuana": "Mexico", "tilburg": "Netherlands", "timbuktu": "Mali", "timisoara": "Romania",
  "tirana": "Albania", "tiranë": "Albania", "tiraspol": "Moldova", "tlemcen": "Algeria", "toamasina": "Madagascar",
  "tobruk": "Libya", "tokyo": "Japan", "toliara": "Madagascar", "tombouctou": "Mali", "tondo": "Philippines",
  "tongi": "Bangladesh", "toronto": "Canada", "toulouse": "France", "toungoo": "Myanmar", "townsville": "Australia",
  "trabzon": "Turkey", "trashigang": "Bhutan", "trashiyangtse": "Bhutan", "trieste": "Italy", "trinco": "Sri Lanka",
  "trincomalee": "Sri Lanka", "tripoli": "Libya", "tripoli lb": "Lebanon", "tripoli lb2": "Lebanon",
  "trivandrum": "India", "trondheim": "Norway", "trongsa": "Bhutan", "trujillo": "Peru", "tsirang": "Bhutan",
  "tucson": "USA", "tucuman": "Argentina", "tucumán": "Argentina", "tulkarm": "Palestine", "tulsipur": "Nepal",
  "tunis": "Tunisia", "tunisia": "Tunisia", "turin": "Italy", "turkey": "Turkey", "turkmenabat": "Turkmenistan",
  "turkmenbashi": "Turkmenistan", "turku": "Finland", "tuxtla": "Mexico", "tuzla": "Bosnia and Herzegovina",
  "tyre": "Lebanon", "uae": "United Arab Emirates", "udon thani": "Thailand", "ufa": "Russia", "uganda": "Uganda",
  "uk": "UK", "ukraine": "Ukraine", "ulaanbaatar": "Mongolia", "ulan bator": "Mongolia", "ulsan": "South Korea",
  "umm al quwain": "United Arab Emirates", "unawatuna": "Sri Lanka", "united kingdom": "UK", "united states": "USA",
  "uppsala": "Sweden", "uruguay": "Uruguay", "us": "USA", "usa": "USA", "utrecht": "Netherlands",
  "vadodara": "India", "vaduz": "Liechtenstein", "valencia": "Spain", "valencia ve": "Venezuela",
  "valenzuela": "Philippines", "valladolid": "Spain", "valletta": "Malta", "valparaiso": "Chile",
  "vanadzor": "Armenia", "vancouver": "Canada", "varanasi": "India", "varna": "Bulgaria", "vatican": "Vatican City",
  "vatican city": "Vatican City", "vavuniya": "Sri Lanka", "venezuela": "Venezuela", "venice": "Italy",
  "veracruz": "Mexico", "verona": "Italy", "victoria": "Seychelles", "victoria bc": "Canada", "vienna": "Austria",
  "vientiane": "Laos", "viet nam": "Vietnam", "vietnam": "Vietnam", "vijayawada": "India", "vilnius": "Lithuania",
  "virginia beach": "USA", "visakhapatnam": "India", "vladivostok": "Russia", "vlorë": "Albania", "volos": "Greece",
  "vung tau": "Vietnam", "wad madani": "Sudan", "waling": "Nepal", "walvis bay": "Namibia", "wangdi": "Bhutan",
  "wangdue phodrang": "Bhutan", "warsaw": "Poland", "washington": "USA", "waterford": "Ireland",
  "weligama": "Sri Lanka", "wellington": "New Zealand", "wenzhou": "China", "windhoek": "Namibia",
  "winnipeg": "Canada", "winterthur": "Switzerland", "wollongong": "Australia", "wolverhampton": "UK",
  "wroclaw": "Poland", "wuhan": "China", "wuxi": "China", "xi'an": "China", "xiamen": "China", "xian": "China",
  "yamoussoukro": "Ivory Coast", "yanbu": "Saudi Arabia", "yangon": "Myanmar", "yaounde": "Cameroon",
  "yaoundé": "Cameroon", "yaren": "Nauru", "yazd": "Iran", "yekaterinburg": "Russia", "yerevan": "Armenia",
  "yogyakarta": "Indonesia", "yokohama": "Japan", "zagreb": "Croatia", "zahedan": "Iran", "zambia": "Zambia",
  "zamboanga": "Philippines", "zanzibar": "Tanzania", "zanzibar city": "Tanzania", "zaporizhzhia": "Ukraine",
  "zaragoza": "Spain", "zaria": "Nigeria", "zarqa": "Jordan", "zhemgang": "Bhutan", "zhengzhou": "China",
  "ziguinchor": "Senegal", "zimbabwe": "Zimbabwe", "zinder": "Niger", "zomba": "Malawi", "zurich": "Switzerland",
  "örebro": "Sweden", "łódź": "Poland",
};

// Small edit-distance helper — catches PMS typos/misspellings (e.g. "Kuala Lampur" for
// "Kuala Lumpur") that exact and substring matching miss. Only used as a last-resort
// fallback, after exact and substring matches have already failed.
function levenshteinDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function fuzzyMatchCityCountry(lower: string): string {
  let best: { dist: number; country: string } | null = null;
  for (const [key, c] of Object.entries(CITY_COUNTRY_MAP)) {
    // Skip very short keys (e.g. "kl") — fuzzy-matching short strings produces false positives
    if (key.length < 4) continue;
    const dist = levenshteinDistance(lower, key);
    const threshold = Math.max(1, Math.floor(Math.min(lower.length, key.length) * 0.2));
    if (dist <= threshold && (!best || dist < best.dist)) best = { dist, country: c };
  }
  return best ? best.country : '';
}

export function inferCountryFromCity(city: string): string {
  if (!city) return 'India';
  const lower = city.toLowerCase().trim();
  if (lower && CITY_COUNTRY_MAP[lower]) return CITY_COUNTRY_MAP[lower];
  for (const [key, c] of Object.entries(CITY_COUNTRY_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return c;
  }
  const fuzzy = fuzzyMatchCityCountry(lower);
  if (fuzzy) return fuzzy;
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
    // Fuzzy match — catches PMS typos/misspellings (e.g. "Kuala Lampur" for "Kuala Lumpur")
    const fuzzy = fuzzyMatchCityCountry(lower);
    if (fuzzy) return fuzzy;
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
