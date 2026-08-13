import { useState } from 'react';
import {
  BookOpen, ChevronDown, ChevronRight, Plane, Hotel, Car,
  IndianRupee, Clock, Building2, Shield, Syringe, GraduationCap, Award, MapPin,
} from 'lucide-react';

interface Section {
  id: string;
  icon: React.ReactNode;
  title: string;
  content: React.ReactNode;
}

function Accordion({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
          {section.icon}
        </span>
        <span className="flex-1 font-semibold text-gray-800 text-sm">{section.title}</span>
        {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-100 text-sm text-gray-600 leading-relaxed space-y-3">
          {section.content}
        </div>
      )}
    </div>
  );
}

// Country DA rates (uniform across all trainer levels)
const COUNTRY_DA: [string, string][] = [
  ['Afghanistan', 'USD 20'], ['Albania', 'USD 40'], ['Algeria', 'USD 25'], ['Amsterdam', 'USD 50'],
  ['Andorra', 'USD 40'], ['Angola', 'USD 30'], ['Antigua and Barbuda', 'USD 30'], ['Argentina', 'USD 30'],
  ['Armenia', 'USD 30'], ['Australia', 'USD 50'], ['Austria', 'USD 50'], ['Azerbaijan', 'USD 30'],
  ['Bahamas', 'USD 30'], ['Bahrain', 'USD 30'], ['Barbados', 'USD 30'], ['Belarus', 'USD 40'],
  ['Belgium', 'USD 50'], ['Belize', 'USD 30'], ['Benin', 'USD 20'], ['Bolivia', 'USD 30'],
  ['Bosnia and Herzegovina', 'USD 40'], ['Botswana', 'USD 25'], ['Brazil', 'USD 30'], ['Brunei', 'USD 30'],
  ['Bulgaria', 'USD 40'], ['Burkina Faso', 'USD 20'], ['Burundi', 'USD 20'], ['Cabo Verde', 'USD 20'],
  ['Cambodia', 'USD 20'], ['Cameroon', 'USD 20'], ['Canada', 'USD 50'], ['Central African Republic', 'USD 20'],
  ['Chad', 'USD 20'], ['Chile', 'USD 30'], ['China', 'USD 40'], ['Colombia', 'USD 30'],
  ['Comoros', 'USD 20'], ['Costa Rica', 'USD 30'], ['Croatia', 'USD 40'], ['Cuba', 'USD 30'],
  ['Cyprus', 'USD 50'], ['Czech Republic', 'USD 40'], ['Democratic Republic of the Congo', 'USD 25'],
  ['Denmark', 'USD 50'], ['Dijbouti', 'USD 20'], ['Dominica', 'USD 30'], ['Dominican Republic', 'USD 30'],
  ['East Timor', 'USD 20'], ['Ecuador', 'USD 30'], ['Egypt', 'USD 25'], ['El Salvador', 'USD 30'],
  ['Equatorial Guinea', 'USD 20'], ['Eritrea', 'USD 20'], ['Estonia', 'USD 40'], ['Eswatini', 'USD 25'],
  ['Ethiopia', 'USD 30'], ['Fiji', 'USD 30'], ['Finland', 'USD 50'], ['France', 'USD 50'],
  ['Gabon', 'USD 30'], ['Gambia', 'USD 30'], ['Georgia', 'USD 40'], ['Germany', 'USD 50'],
  ['Ghana', 'USD 30'], ['Gibralter', 'USD 40'], ['Greece', 'USD 50'], ['Grenada', 'USD 30'],
  ['Guatemala', 'USD 30'], ['Guinea', 'USD 20'], ['Guinea-Bissau', 'USD 20'], ['Guyana', 'USD 30'],
  ['Haiti', 'USD 30'], ['Honduras', 'USD 30'], ['Hong Kong', 'USD 40'], ['Hungary', 'USD 40'],
  ['Iceland', 'USD 50'], ['Indonesia', 'USD 30'], ['Iran', 'USD 30'], ['Iraq', 'USD 40'],
  ['Ireland', 'USD 40'], ['Israel', 'USD 50'], ['Italy', 'USD 50'], ['Ivory Coast', 'USD 25'],
  ['Jamaica', 'USD 30'], ['Japan', 'USD 40'], ['Jordan', 'USD 30'], ['Kazakhstan', 'USD 30'],
  ['Kenya', 'USD 25'], ['Kiribati', 'USD 30'], ['Kosovo', 'USD 40'], ['Kuwait', 'USD 30'],
  ['Kyrgyzstan (Asia)', 'USD 30'], ['Laos', 'USD 20'], ['Latvia', 'USD 50'], ['Lebanon', 'USD 20'],
  ['Lesotho', 'USD 20'], ['Liberia', 'USD 20'], ['Libya', 'USD 20'], ['Liechtenstein', 'USD 50'],
  ['Lithuania', 'USD 50'], ['Luxembourg', 'USD 50'], ['Madagascar', 'USD 20'], ['Malawi', 'USD 20'],
  ['Malaysia', 'USD 30'], ['Maldives', 'USD 40'], ['Mali', 'USD 20'], ['Marshall Islands', 'USD 30'],
  ['Mauritania', 'USD 20'], ['Mauritius', 'USD 30'], ['Mexico', 'USD 20'], ['Micronesia', 'USD 30'],
  ['Moldova', 'USD 40'], ['Monaco', 'USD 50'], ['Mongolia', 'USD 20'], ['Montenegro', 'USD 40'],
  ['Mozambique', 'USD 25'], ['Namibia', 'USD 30'], ['Nauru', 'USD 30'], ['Netherlands', 'USD 50'],
  ['New Caledonia', 'USD 30'], ['New Zealand', 'USD 40'], ['Nicaragua', 'USD 30'], ['Niger', 'USD 20'],
  ['Nigeria', 'USD 20'], ['North Korea', 'USD 40'], ['North Macedonia', 'USD 40'], ['Oman', 'USD 40'],
  ['Pakistan', 'USD 20'], ['Palau', 'USD 30'], ['Palestine', 'USD 30'], ['Palestinian Territory', 'USD 20'],
  ['Panama', 'USD 30'], ['Papua New Guinea', 'USD 20'], ['Paraguay', 'USD 30'], ['Peru', 'USD 30'],
  ['Philippines', 'USD 30'], ['Poland', 'USD 40'], ['Portugal', 'USD 40'], ['Qatar', 'USD 30'],
  ['Republic of Congo', 'USD 20'], ['Romania', 'USD 40'], ['Russia', 'USD 40'], ['Rwanda', 'USD 25'],
  ['Saint Kitts and Nevis', 'USD 30'], ['Saint Lucia', 'USD 30'], ['Saint Vincent and the Grenadines', 'USD 30'],
  ['Samoa', 'USD 30'], ['San Marino', 'USD 50'], ['Sao Tome and Principe', 'USD 20'], ['Saudi Arabia', 'USD 30'],
  ['Senegal', 'USD 25'], ['Serbia', 'USD 40'], ['Seychelles', 'USD 30'], ['Sierra Leone', 'USD 50'],
  ['Singapore', 'USD 50'], ['Slovakia', 'USD 40'], ['Slovenia', 'USD 40'], ['Solomon Islands', 'USD 30'],
  ['Somalia', 'USD 20'], ['South Africa', 'USD 40'], ['South Korea', 'USD 40'], ['Spain', 'USD 50'],
  ['Sudan', 'USD 25'], ['Suriname', 'USD 30'], ['Sweden', 'USD 50'], ['Switzerland', 'USD 50'],
  ['Syria', 'USD 30'], ['Taiwan', 'USD 40'], ['Tajikistan', 'USD 30'], ['Tanzania', 'USD 25'],
  ['Thailand', 'USD 30'], ['Togo', 'USD 20'], ['Tonga', 'USD 30'], ['Trinidad and Tobago', 'USD 30'],
  ['Tunisia', 'USD 20'], ['Turkey', 'USD 30'], ['Turkmenistan', 'USD 30'], ['Tuvalu', 'USD 30'],
  ['Uganda', 'USD 25'], ['UK', 'USD 50'], ['Ukraine', 'USD 40'], ['Uruguay', 'USD 30'],
  ['USA', 'USD 50'], ['Uzbekistan', 'USD 30'], ['Vanuatu', 'USD 30'], ['Vatican City', 'USD 50'],
  ['Venezuela', 'USD 30'], ['Vietnam', 'USD 20'], ['Yemen', 'USD 20'], ['Zambia', 'USD 25'],
  ['Zimbabwe', 'USD 30'],
];

function CountryDaTable() {
  const [q, setQ] = useState('');
  const filtered = COUNTRY_DA.filter(([c]) => c.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div>
      <input
        type="text"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search country…"
        className="w-full mb-2 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
      <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-gray-500 font-semibold">Country</th>
              <th className="px-3 py-2 text-left text-gray-500 font-semibold">DA (all levels)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(([c, r]) => (
              <tr key={c}>
                <td className="px-3 py-1.5 text-gray-700">{c}</td>
                <td className="px-3 py-1.5 font-semibold text-green-700">{r}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={2} className="px-3 py-3 text-center text-gray-400">No matching country.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const SECTIONS: Section[] = [
  {
    id: 'general',
    icon: <Plane size={16} />,
    title: 'General Guidelines',
    content: (
      <div className="space-y-2.5">
        <p>Koenig will do the flight bookings — employees should not book on their own. Kites will have access to their unutilized Frequent Flyer points (if any) via Travel Desk, which should bring peace of mind to future Koenig travelers.</p>
        <p>Travel Desk will book your stay as per company guidelines. It is mandatory for trainers to utilize Metro/Tube systems in cities like Dubai, London, Singapore, and Australia whenever possible for commuting.</p>
        <p>All travel-related approvals go through payroll. Koenig provides medical insurance for international travel and follows a policy of double occupancy (twin beds); single-room accommodation is provided only for ILO batches.</p>
        <p>Telephonic calls while traveling will not be borne by Koenig. No separate claims for meals or miscellaneous expenses (snacks, laundry, water, SIM, travel adapters, tips, etc.) will be entertained — these are part of DA. Laundry expenses are not reimbursed.</p>
        <p>In case of a no-show (for any reason), the total flight cost will be borne by the employee.</p>
        <p><strong>Return flight — male trainers:</strong> booked for the same day or the next day as per availability/travel policy, allowing ample spare time to reach the airport per the flight schedule.</p>
        <p><strong>Return flight — female trainers:</strong> scheduled for the day after the batch concludes.</p>
        <p>Travelers may manage their frequent flier points and use them for personal travel.</p>
      </div>
    ),
  },
  {
    id: 'travel-locations',
    icon: <MapPin size={16} />,
    title: 'Travel to Koenig Locations',
    content: (
      <div className="space-y-2.5">
        <p className="text-xs text-gray-500 italic">Applicable for both Delhi and non-Delhi based Koenig-ites. Koenig-ites are recommended to commute via public transport/own conveyance wherever possible. Submission of bills is mandatory.</p>
        <p><strong>Dubai</strong> and <strong>Goa</strong> — as per standard rates.</p>
        <p>Within 400 kms, road/train travel will be booked by Travel Desk, or the trainer can book with eligibility of Chair Car (Shatabdi or similar train) or 3AC for a Sleeper-class train, and AC Volvo Sitter/Sleeper for bus. If traveling by own conveyance, reimbursement is per KM: <strong>₹3/km</strong> for two-wheeler, <strong>₹8/km</strong> for four-wheeler.</p>
        <p>It is the trainer's responsibility to keep their passport and vaccination records valid and updated on the RMS Employee Self Service panel. Trainers must carry their passports (old and new) when traveling for any domestic or international batch, as batches can be assigned at any time and location. Yellow Fever and Polio vaccination certificates must also be carried during travel, along with a government ID proof (Aadhaar card, or Emirates ID for UAE resident visa holders).</p>
        <p>No DA and no taxi for travel within Delhi-NCR.</p>
      </div>
    ),
  },
  {
    id: 'da',
    icon: <IndianRupee size={16} />,
    title: 'DA for Travel',
    content: (
      <div className="space-y-3">
        <p>DA rates are now uniform across all trainer levels. Search the full country list below:</p>
        <CountryDaTable />
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Breakfast is included in hotel bookings if the breakfast cost is below ₹800 in India or ₹1,500 outside India (does not apply to Koenig Apartment stays). Flights are usually without meal.
        </p>
        <div className="pt-1">
          <p className="font-semibold text-gray-700">Other Countries</p>
          <p>India: <strong>₹950</strong> (effective 10th April 2026). Dubai: <strong>AED 75</strong>.</p>
        </div>
        <div className="pt-1">
          <p className="font-semibold text-gray-700">DA for Travel Day (as per base country of traveler)</p>
          <p>Travel Day = the day of the flight, if the scheduled departure is before 5:00 PM, or arrival is after 12:00 PM at the base location. Delays are not considered for this rule.</p>
          <p>For stays longer than 30 days, TA/DA will be settled monthly. This policy is not applicable for long-term stay (30 days or more), and not applicable for OBs. DA and travel reimbursement are not applicable on leave days. Conveyance is paid on actuals.</p>
          <p className="text-xs text-gray-500 italic">Example: A 5-day batch starts 31st Aug (Monday) in USA. Flight leaves Saturday 29th Aug at 8 PM; return is 7:00 AM on 6th Sep (Sunday). DA is payable for 30th, 31st, 1st, 2nd, 3rd, 4th, and 5th.</p>
        </div>
        <div className="pt-1">
          <p className="font-semibold text-gray-700">Neighboring Countries</p>
          <p>Nepal, Bangladesh, Burma/Myanmar, Bhutan, and Sri Lanka: <strong>₹1,100</strong> DA. This DA policy is also applicable for non-trainers traveling to these countries.</p>
        </div>
      </div>
    ),
  },
  {
    id: 'ess',
    icon: <BookOpen size={16} />,
    title: 'Update ESS',
    content: (
      <div className="space-y-2.5">
        <p>While booking travel for your batches, discrepancies are sometimes found in the origin city. The travel-booking panel shows the city entered under "Nearest City" on your Employee Self Service (ESS) panel.</p>
        <p>Kindly update your "Preferred City of Work" and "Nearest City" on ESS accordingly so travel bookings are done properly. It is also mandatory for all trainers to keep their ESS updated with all information — e.g. previous employment, education, passport, Aadhaar card, etc.</p>
        <p className="text-xs text-gray-500 italic">If your city is not available in the list, write to hr@ to get it added.</p>
      </div>
    ),
  },
  {
    id: 'insurance',
    icon: <Shield size={16} />,
    title: 'Travel Insurance — ICICI Lombard',
    content: (
      <div className="space-y-2.5">
        <p>Employees (except residence-visa holders traveling to Dubai) receive travel insurance from the company. In case of a claim directly with the insurance company, the ICICI Lombard process below can be followed.</p>
        <p><strong>Checked-in baggage delay</strong> (not in home country): report a PIR (Property Irregularity Report) to the baggage-missing counter and take a copy. If delayed more than 6 hours, emergency items (clothes/toiletries) up to USD 100 can be purchased if needed, with receipt. When baggage is returned, take a delivery receipt from the airline with proof of time/date, and raise a claim intimation to the insurance company. In case of complete loss, report as untraced by the airline in addition to the above.</p>
        <p>Note: you can only claim from the airline or the insurance company — not both — if you have accepted an airline coupon or cash from one of them.</p>
        <p className="font-semibold text-gray-700 pt-1">Claims Procedure</p>
        <p>In the event of an accident, sudden illness, or any other covered contingency (cashless or reimbursement), contact the helpline immediately with the necessary details.</p>
        <p>ICICI Lombard 24hr Helpline — From USA/Canada: <strong>+1 844 871 1200</strong> (Toll Free). Rest of the World: <strong>+91 124 449 8778</strong> (call-back facility). In India: <strong>1800 102 5721</strong> (toll-free, Mon–Fri 9am–6pm). Fax: +91 124 400 6674. Email: icicilombard@falck.com. Website: www.falck.com.</p>
      </div>
    ),
  },
  {
    id: 'vaccination',
    icon: <Syringe size={16} />,
    title: 'Yellow Fever & Polio Vaccination',
    content: (
      <div className="space-y-2.5">
        <p>A trainer, with manager's permission, can go for Yellow Fever vaccination during office hours with no deduction. Travel expense will be borne by the company only if the vaccination is not available in town; the cost of vaccination itself will be borne by the company.</p>
        <p>Reimbursement of the vaccination cost is capped at a maximum of <strong>₹5,000</strong>; any request above this needs prior approval from Travel Desk. Travel reimbursement for this purpose is capped at <strong>₹1,000 both ways</strong>. Employees are encouraged to use public transport for the vaccination trip.</p>
      </div>
    ),
  },
  {
    id: 'base-location',
    icon: <Building2 size={16} />,
    title: 'Base Location',
    content: (
      <div className="space-y-2.5">
        <p>Based on the growth of the company's business model and classroom training (ILT) demands, a few norms apply to changing your base location:</p>
        <p>(1) The base location must not be changed in less than 6 months. (2) A separate request must be submitted to HR with approval from your reporting manager.</p>
        <p>Open communication and discussion with your manager regarding feasibility and potential impact is encouraged. Please follow the established procedure for base location changes.</p>
      </div>
    ),
  },
  {
    id: 'physical-classroom',
    icon: <Hotel size={16} />,
    title: 'Physical Classroom Training',
    content: (
      <div className="space-y-2.5">
        <p className="font-semibold text-gray-700">Conveyance Policy — ILT (Delhi/NCR and Bangalore)</p>
        <p>A trainer can opt to stay in a Koenig Apartment; in this case, DA and a one-time travel conveyance to the apartment will be paid by Koenig. If a trainer opts to deliver training while traveling from home, only the following are reimbursed (subject to receipts): toll on actuals, and parking charges on actuals. No reimbursement for fuel or cab.</p>
        <p className="font-semibold text-gray-700 pt-1">Dubai</p>
        <p>Dubai-based trainers can seek reimbursement of parking charges at <strong>AED 6 per hour</strong> on submission of receipts/bills, if company parking is not available. Reference: parkin.ae/general-information. This policy is applicable to trainers only.</p>
        <p className="font-semibold text-gray-700 pt-1">FAQs</p>
        <p><strong>Q: Is "One Side Travel Conveyance to Koenig Apartment" for one side only (Home → Apartment) or both sides?</strong><br />One-time, both sides, for external batch delivery when it is a multi-day travel.</p>
        <p><strong>Q: Trainers present in cities where Koenig has offices are required to come to office to deliver training — since many trainers are based in Delhi or nearby cities, are they still eligible for DA and stay when the batch is in Gurgaon (a different city)?</strong><br />Yes.</p>
        <p><strong>Q: How is the stay arrangement made?</strong><br />Email Travel Desk and they will make the necessary arrangements.</p>
      </div>
    ),
  },
  {
    id: 'transportation',
    icon: <Car size={16} />,
    title: 'Transportation Guide for Various Locations',
    content: (
      <div className="space-y-2.5">
        <p>Use <a href="https://www.rome2rio.com/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">rome2rio.com</a> for finding local transport options easily in any city. Key city-specific routes:</p>
        <p><strong>Chennai:</strong> Metro from Chennai International Airport (board at Chennai Central) to Ekkathutangal station, then follow the mapped walking route to the Koenig center. Metro runs 4:30 AM – 11:00 PM daily.</p>
        <p><strong>Goa:</strong> Taxi is the only mode of transport from both Goa International Airport (GOI) and Manohar International Airport (GOX) to the Koenig Training Center; use Uber/Ola or Goa Miles for airport-to-apartment travel.</p>
        <p><strong>Gurgaon:</strong> Cab from airport to Koenig Apartment; a short walk (~7 min) from apartment to center. IGI Airport to center is by cab only.</p>
        <p><strong>Bangalore:</strong> Ola/Uber/Rapido for airport ↔ apartment, apartment ↔ center, and center ↔ airport routes.</p>
        <p><strong>Dubai:</strong> Metro is the primary mode (Mon–Thu 5am–12am, Fri 5am–1am next day, Sat 5am–12am, Sun 8am–12am); when the metro is off-hours, cabs are allowed. Airport-to-apartment routes (Preatoni JLT, Centrium) combine metro + Careem taxi (~AED 30–40). Daily transfers from Centrium are handled by Koenig transport (Driver Fazal, +971 52 156 4724), pickup by 7:45 am.</p>
        <p><strong>Accra, Ghana:</strong> Taxi for hotel ↔ training venue and airport ↔ hotel.</p>
        <p><strong>Cape Town, South Africa:</strong> Taxi/cab for airport ↔ hotel and hotel ↔ training venue.</p>
        <p><strong>Johannesburg, South Africa:</strong> Train (Rivonia Road → Sandton) for hotel ↔ venue; cab/taxi for airport ↔ hotel.</p>
        <p><strong>Riyadh, KSA:</strong> Taxi/cab for airport ↔ hotel and hotel ↔ training venue.</p>
        <p className="text-xs text-gray-500 italic">Full turn-by-turn map links for each route are available from Travel Desk on request.</p>
      </div>
    ),
  },
  {
    id: 'exam',
    icon: <Award size={16} />,
    title: 'Exam Sponsorship',
    content: (
      <div className="space-y-2.5">
        <p className="font-semibold text-gray-700">Cost Recovery — Exam Cost</p>
        <p>The cost of the first attempt is reimbursed regardless of result, provided the trainer delivers at least one assignment related to the certification. If the assignment is not delivered, the exam cost is recoverable (even if passed) and deducted during Full & Final settlement. Second-attempt costs are not reimbursed; any available discounts are passed on to the trainer.</p>
        <p className="font-semibold text-gray-700 pt-1">Courseware</p>
        <p>If courseware is issued, its cost is recovered from the specific trainer, even if used by the team — unless the trainer delivers a related assignment, in which case the cost is waived.</p>
        <p className="font-semibold text-gray-700 pt-1">OEM Certification Renewals</p>
        <p>If renewed via exam: the trainer must deliver at least two related assignments post-renewal. If renewed by paying a fee only (no exam): the trainer must deliver at least 10 related batches for the cost to be waived. If these conditions are not met, the cost is recoverable.</p>
      </div>
    ),
  },
  {
    id: 'mtm',
    icon: <Clock size={16} />,
    title: 'MTM Feedbacks',
    content: (
      <div className="space-y-2.5">
        <p>Only feedback received via the Koenig Feedback form or MTM is considered. Chat feedback is not eligible for outstanding-feedback purposes — chat screenshots need not be shared with Mr. Sujan.</p>
        <p>You may continue to send the MTM score report to Ms. Tamanna if it falls into the outstanding category. Students are encouraged to fill the feedback forms.</p>
      </div>
    ),
  },
  {
    id: 'overseas',
    icon: <Plane size={16} />,
    title: 'Overseas Trainer Policy — Visa Commitment',
    content: (
      <div className="space-y-2.5">
        <p>No separate (stamp paper) commitment is required for visa processing going forward. Once a trainer agrees to a visa commitment, an entry is made in RMS and a confirmation email outlining terms and conditions is sent to the trainer.</p>
        <p>The commitment is valid for one year from the date of entry in RMS, regardless of when the visa is applied for. In case of visa rejection or non-application within a reasonable time, the commitment becomes null and void. If the trainer leaves within 1 year of the commitment date, <strong>₹1 lac</strong> will be recovered.</p>
        <p>This policy is a critical component of Koenig's strategy for leadership in ILT and FMAT, designed for simplification, transparency, and to protect the interests of both Kites and the Kompany. It is effective immediately.</p>
        <p className="font-semibold text-gray-700 pt-1">FAQ</p>
        <p><strong>Q: When does the one-year commitment period start?</strong><br />From the date of entry in RMS, regardless of when the visa is applied for.</p>
        <p><strong>Q: What happens if my visa is rejected?</strong><br />The commitment becomes null and void, unless another visa is applied for during the same commitment period.</p>
        <p><strong>Q: Will I be charged if I leave within 1 year but the visa hasn't been received yet?</strong><br />No. Travel Desk applies for the visa as soon as the RMS entry is made; in case of inordinate delay, Travel Desk will cancel the visa commitment.</p>
      </div>
    ),
  },
  {
    id: 'metro-gold',
    icon: <Car size={16} />,
    title: 'Metro Gold Class Ticket (Dubai)',
    content: (
      <div className="space-y-2.5">
        <p>Trainers can use the Metro Gold Class ticket for travel within Dubai. Reimbursement for travel to designated apartments:</p>
        <p><strong>JLT (Pretoni Tower / Lake View Tower):</strong> AED 35–37 (includes Metro + cab from airport to apartment).</p>
        <p><strong>Centrium (Tower 1 / Tower 4):</strong> AED 20–22 for Metro (original cab bill from metro to apartment must be submitted separately).</p>
        <p>When the metro is not operational, trainers can book a Careem taxi with the "Yala" option and submit the original bill for reimbursement. Cab sharing is mandatory where applicable.</p>
      </div>
    ),
  },
  {
    id: 'kpi-sot',
    icon: <GraduationCap size={16} />,
    title: 'KPIs of Trainer & Science of Teaching',
    content: (
      <div className="space-y-2.5">
        <p><strong>TrainerIndex</strong> — the KPI framework used to evaluate trainer performance.</p>
        <p><strong>SOT (Science of Teaching)</strong> — Koenig's teaching methodology framework.</p>
      </div>
    ),
  },
];

export default function HelpPolicy() {
  return (
    <div className="max-w-3xl mx-auto py-6 px-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
          <BookOpen size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Help & Policy Guidelines</h1>
          <p className="text-sm text-gray-500">Koenig Solutions — Travel Policy</p>
        </div>
      </div>

      <div className="mt-2 mb-6 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
        Click any section below to expand and read the policy details.
      </div>

      <div className="space-y-3">
        {SECTIONS.map(s => <Accordion key={s.id} section={s} />)}
      </div>

      <p className="text-xs text-gray-400 text-center mt-8">
        For queries contact <a href="mailto:hr@koenig-solutions.com" className="text-blue-500 hover:underline">hr@koenig-solutions.com</a>
      </p>
    </div>
  );
}
