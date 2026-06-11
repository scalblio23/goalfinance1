import { useState, useEffect, useRef } from 'react'

/* ============================================================
   CONFIG — replace these two values
   ============================================================ */
// Your Make.com webhook for this funnel (routes the lead to your Google Sheet)
const WEBHOOK_URL = 'https://hook.eu1.make.com/5ksm3hrj2mvwbpmn49n13uh4kwx2eh6p'

// Optional: Google Maps JS API key to enable address autocomplete.
// Leave blank to fall back to a plain text input (build still works).
const GOOGLE_MAPS_KEY = ''

// Brand parameter used on the Meta Pixel Lead event + sent to the webhook
const BRAND = 'finchecker'

const STORAGE_KEY = 'fincheck_debt_consolidation_v1'

/* ============================================================
   Survey data
   ============================================================ */
const SLIDER_MIN = 5000
const SLIDER_MAX = 200000
const SLIDER_STEP = 5000

const DEBT_TYPE_OPTS = [
  'Credit Cards',
  'Personal Loans',
  'Car Loan',
  'Tax Debt',
  'Buy Now Pay Later',
  'Other',
]
const TIMING_OPTS = ['ASAP', 'Within 2 weeks', 'Within a month', 'Just exploring']
const PRIORITY_OPTS = ['Lower Repayments', 'Single Monthly Payment', 'Lower Interest Rate', 'Pay Off Faster']
const INCOME_OPTS = [
  'Under $2,000',
  '$2,000 – $4,000',
  '$4,000 – $7,000',
  '$7,000 – $10,000',
  '$10,000+',
]
const CREDIT_OPTS = ['Excellent (720+)', 'Good (680-719)', 'Fair (640-679)', 'Poor (<640)']

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1989 }, (_, i) => String(CURRENT_YEAR - i))

const TOTAL_STEPS = 7 // quiz steps (excludes landing + thank-you)

const fmt = (n) => '$' + Number(n).toLocaleString('en-AU')

const emptyData = {
  debtAmount: 20000,
  debtType: '',
  timing: '',
  priority: '',
  startMonth: '',
  startYear: '',
  income: '',
  creditScore: '',
  fullName: '',
  email: '',
  mobile: '',
  employerName: '',
  birthDate: '',
  address: '',
}

/* ============================================================
   Sub-components
   ============================================================ */
function Progress({ step }) {
  const pct = Math.round((step / TOTAL_STEPS) * 100)
  return (
    <div className="progress">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: pct + '%' }} />
      </div>
      <div className="progress-text">
        Step {step} of {TOTAL_STEPS}
      </div>
    </div>
  )
}

function SelectStep({ title, help, options, value, onSelect, cols }) {
  return (
    <div className="card">
      <h2 className="q-title">{title}</h2>
      {help && <p className="q-help">{help}</p>}
      <div className={'options' + (cols ? ' cols' : '')}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={'option' + (value === opt ? ' selected' : '')}
            onClick={() => onSelect(opt)}
          >
            <span>{opt}</span>
            <span className="check" />
          </button>
        ))}
      </div>
    </div>
  )
}

/* ============================================================
   App
   ============================================================ */
export default function App() {
  const [step, setStep] = useState(0) // 0 = landing, 1..7 = quiz, 8 = thanks
  const [data, setData] = useState(emptyData)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const addressRef = useRef(null)

  // Restore from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      if (saved && saved.data) {
        setData({ ...emptyData, ...saved.data })
        if (typeof saved.step === 'number' && saved.step < 8) setStep(saved.step)
      }
    } catch (e) {}
  }, [])

  // Persist progress (don't persist the thank-you state)
  useEffect(() => {
    if (step < 8) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, data }))
      } catch (e) {}
    }
  }, [step, data])

  const set = (key, val) => setData((d) => ({ ...d, [key]: val }))

  const next = () => setStep((s) => Math.min(s + 1, 8))
  const back = () => setStep((s) => Math.max(s - 1, 0))

  // Auto-advance for single-select questions
  const pick = (key, val) => {
    set(key, val)
    setTimeout(() => setStep((s) => Math.min(s + 1, 8)), 220)
  }

  // Google Places autocomplete (graceful fallback if no key)
  useEffect(() => {
    if (step !== 7 || !GOOGLE_MAPS_KEY) return
    const attach = () => {
      if (!addressRef.current || !window.google?.maps?.places) return
      const ac = new window.google.maps.places.Autocomplete(addressRef.current, {
        componentRestrictions: { country: 'au' },
        fields: ['formatted_address'],
        types: ['address'],
      })
      ac.addListener('place_changed', () => {
        const place = ac.getPlace()
        if (place?.formatted_address) set('address', place.formatted_address)
      })
    }
    if (window.google?.maps?.places) {
      attach()
    } else if (!document.getElementById('gmaps-script')) {
      const s = document.createElement('script')
      s.id = 'gmaps-script'
      s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places`
      s.async = true
      s.onload = attach
      document.head.appendChild(s)
    } else {
      document.getElementById('gmaps-script').addEventListener('load', attach)
    }
  }, [step])

  const validateContact = () => {
    const e = {}
    if (!data.fullName.trim()) e.fullName = 'Required'
    if (!/^\S+@\S+\.\S+$/.test(data.email)) e.email = 'Enter a valid email'
    if (data.mobile.replace(/\D/g, '').length < 8) e.mobile = 'Enter a valid number'
    if (!data.employerName.trim()) e.employerName = 'Required'
    if (!data.birthDate) e.birthDate = 'Required'
    if (!data.address.trim()) e.address = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async () => {
    if (!validateContact() || submitting) return
    setSubmitting(true)

    const payload = {
      brand: BRAND,
      debtAmount: data.debtAmount,
      debtAmountFormatted: fmt(data.debtAmount),
      debtType: data.debtType,
      timing: data.timing,
      priority: data.priority,
      debtStartMonth: data.startMonth,
      debtStartYear: data.startYear,
      monthlyIncome: data.income,
      creditScore: data.creditScore,
      fullName: data.fullName.trim(),
      email: data.email.trim(),
      mobile: data.mobile.trim(),
      employerName: data.employerName.trim(),
      birthDate: data.birthDate,
      address: data.address.trim(),
      pageUrl: window.location.href,
      submittedAt: new Date().toISOString(),
    }

    // Meta Pixel Lead event with brand parameter
    try {
      if (window.fbq) window.fbq('track', 'Lead', { brand: BRAND })
    } catch (e) {}

    // Send to Make.com webhook
    try {
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (e) {
      console.error('Webhook error:', e)
    }

    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (e) {}
    setStep(8)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // scroll to top on step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  const sliderPct = ((data.debtAmount - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100
  const sliderBg = `linear-gradient(to right, var(--blue) 0%, var(--blue) ${sliderPct}%, var(--track) ${sliderPct}%, var(--track) 100%)`

  return (
    <div className="page">
      <div className="topbar" />
      <div className="wrap">
        {/* ---------------- LANDING ---------------- */}
        {step === 0 && (
          <>
            <div className="hero">
              <h1>
                Struggling With
                <br />
                Multiple Debts?
              </h1>
              <p className="sub">See If You Could Combine Your Debts Into One Simple Monthly Repayment</p>
            </div>
            <div className="card">
              <h2 className="q-title">How much debt do you want to consolidate?</h2>
              <div className="slider-wrap">
                <input
                  type="range"
                  className="slider"
                  min={SLIDER_MIN}
                  max={SLIDER_MAX}
                  step={SLIDER_STEP}
                  value={data.debtAmount}
                  style={{ background: sliderBg }}
                  onChange={(e) => set('debtAmount', Number(e.target.value))}
                />
                <div className="slider-ends">
                  <span>{fmt(SLIDER_MIN)}</span>
                  <span>{fmt(SLIDER_MAX)}</span>
                </div>
                <div className="slider-value">{fmt(data.debtAmount)}</div>
              </div>
              <button className="btn btn-block" onClick={next}>
                See My Options
              </button>
            </div>
          </>
        )}

        {/* ---------------- QUIZ ---------------- */}
        {step >= 1 && step <= 7 && <Progress step={step} />}

        {step === 1 && (
          <SelectStep
            title="What type of debt are you looking to consolidate?"
            options={DEBT_TYPE_OPTS}
            value={data.debtType}
            onSelect={(v) => pick('debtType', v)}
          />
        )}

        {step === 2 && (
          <SelectStep
            title="How soon are you looking for relief?"
            options={TIMING_OPTS}
            value={data.timing}
            onSelect={(v) => pick('timing', v)}
          />
        )}

        {step === 3 && (
          <SelectStep
            title="What would help you the most right now?"
            options={PRIORITY_OPTS}
            value={data.priority}
            onSelect={(v) => pick('priority', v)}
          />
        )}

        {step === 4 && (
          <div className="card">
            <h2 className="q-title">When did this debt start?</h2>
            <div className="fields">
              <div className="row-2">
                <div className="field">
                  <label>Month</label>
                  <select value={data.startMonth} onChange={(e) => set('startMonth', e.target.value)}>
                    <option value="">Select month</option>
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Year</label>
                  <select value={data.startYear} onChange={(e) => set('startYear', e.target.value)}>
                    <option value="">Select year</option>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <button
              className="btn btn-center"
              disabled={!data.startMonth || !data.startYear}
              onClick={next}
            >
              Continue
            </button>
          </div>
        )}

        {step === 5 && (
          <SelectStep
            title="What's your monthly take-home income?"
            help="This helps us find options that fit your budget"
            options={INCOME_OPTS}
            value={data.income}
            cols
            onSelect={(v) => pick('income', v)}
          />
        )}

        {step === 6 && (
          <SelectStep
            title="What's your estimated credit score?"
            help="Don't worry — all credit types are considered"
            options={CREDIT_OPTS}
            value={data.creditScore}
            onSelect={(v) => pick('creditScore', v)}
          />
        )}

        {step === 7 && (
          <div className="card">
            <h2 className="q-title">Where should we send your relief options?</h2>
            <p className="q-help">Takes 30 seconds — your details are kept private and secure</p>
            <div className="fields">
              <div className="field">
                <label>Full Name</label>
                <input
                  type="text"
                  placeholder="John Smith"
                  value={data.fullName}
                  onChange={(e) => set('fullName', e.target.value)}
                />
                {errors.fullName && <span className="err">{errors.fullName}</span>}
              </div>
              <div className="field">
                <label>Email Address</label>
                <input
                  type="email"
                  inputMode="email"
                  placeholder="john@email.com.au"
                  value={data.email}
                  onChange={(e) => set('email', e.target.value)}
                />
                {errors.email && <span className="err">{errors.email}</span>}
              </div>
              <div className="field">
                <label>Mobile Number</label>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="0400 000 000"
                  value={data.mobile}
                  onChange={(e) => set('mobile', e.target.value)}
                />
                {errors.mobile && <span className="err">{errors.mobile}</span>}
              </div>
              <div className="field">
                <label>Employer Name</label>
                <input
                  type="text"
                  placeholder="Your employer"
                  value={data.employerName}
                  onChange={(e) => set('employerName', e.target.value)}
                />
                {errors.employerName && <span className="err">{errors.employerName}</span>}
              </div>
              <div className="field">
                <label>Date of Birth</label>
                <input
                  type="date"
                  value={data.birthDate}
                  onChange={(e) => set('birthDate', e.target.value)}
                />
                {errors.birthDate && <span className="err">{errors.birthDate}</span>}
              </div>
              <div className="field">
                <label>Home Address</label>
                <input
                  ref={addressRef}
                  type="text"
                  placeholder="Start typing your address"
                  value={data.address}
                  onChange={(e) => set('address', e.target.value)}
                />
                {errors.address && <span className="err">{errors.address}</span>}
              </div>
            </div>
            <button className="btn btn-block btn-center" disabled={submitting} onClick={submit}>
              {submitting ? 'Submitting…' : 'See My Options'}
            </button>
          </div>
        )}

        {step >= 1 && step <= 7 && (
          <button className="back" onClick={back}>
            ← Back
          </button>
        )}

        {/* ---------------- THANK YOU ---------------- */}
        {step === 8 && (
          <div className="thanks">
            <div className="tick">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 13l4 4L19 7"
                  stroke="#2d5bff"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2>You're on your way to relief!</h2>
            <p>
              We're reviewing your details now. A debt relief specialist will be in touch shortly
              to walk you through your options and help simplify your repayments.
            </p>
          </div>
        )}

        {/* ---------------- DISCLAIMER ---------------- */}
        <div className="disclaimer">
          <h4>Disclaimer</h4>
          <p>
            Fincheck provides general information only. We are not a lender, credit provider, or
            finance broker, and we do not hold an Australian Credit Licence. We do not provide credit
            assistance or credit advice, and we do not recommend any product or assess whether a
            product is suitable for you. Any information on this site is general in nature and does
            not take into account your personal objectives, financial situation, or needs. When you
            submit an enquiry, Fincheck collects your contact details and passes them to a licensed
            finance broker who can assist you. We may receive a fee or commission for this referral.
            You are under no obligation to proceed with any product or service.
          </p>
          <p>
            Fincheck is not affiliated with, endorsed by, sponsored by, or associated with Meta
            Platforms, Inc. or its products (including Facebook, Instagram, WhatsApp, and Messenger).
            The Meta and Facebook names and logos are trademarks of Meta Platforms, Inc.
          </p>
        </div>
      </div>
    </div>
  )
}
