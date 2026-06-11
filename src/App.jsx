import { useState, useEffect } from 'react'

/* ============================================================
   CONFIG — replace these two values
   ============================================================ */
const WEBHOOK_URL = 'https://hook.eu1.make.com/5ksm3hrj2mvwbpmn49n13uh4kwx2eh6p'
const GOOGLE_MAPS_KEY = ''
const BRAND = 'finchecker'

const STORAGE_KEY = 'fincheck_debt_consolidation_v1'

/* ============================================================
   Survey data
   ============================================================ */
const SLIDER_MIN = 5000
const SLIDER_MAX = 1000000
const SLIDER_STEP = 5000

const PROPERTY_OPTS = ['Yes', 'No']
const MORTGAGE_OPTS = [
  'Under $250k',
  '$250k – $500k',
  '$500k – $750k',
  '$750k – $1M',
  '$1M+',
]
const DEBT_TYPE_OPTS = [
  'Credit Cards',
  'Personal Loans',
  'Car Loan',
  'Tax Debt',
  'Multiple',
  'Other',
]
const TIMING_OPTS = ['ASAP', 'Within 2 weeks', 'Within a month', 'Just exploring']
const INCOME_OPTS = [
  'Under $30,000',
  '$30,000 – $60,000',
  '$60,000 – $100,000',
  '$100,000 – $150,000',
  '$150,000+',
]
const CREDIT_OPTS = ['Excellent (720+)', 'Good (680–719)', 'Fair (640–679)', 'Poor (<640)']

const TOTAL_STEPS = 7

const fmt = (n) => '$' + Number(n).toLocaleString('en-AU')

const emptyData = {
  debtAmount: 20000,
  ownsProperty: '',
  mortgageAmount: '',
  debtType: '',
  timing: '',
  income: '',
  creditScore: '',
  fullName: '',
  email: '',
  mobile: '',
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
  const back = () => {
    // If on debt type (step 3) and user doesn't own property, skip back over mortgage (step 2)
    if (step === 3 && data.ownsProperty === 'No') {
      setStep(1)
    } else {
      setStep((s) => Math.max(s - 1, 0))
    }
  }

  // Auto-advance for single-select questions
  const pick = (key, val) => {
    set(key, val)
    // If user selects "No" to property ownership, skip the mortgage question
    if (key === 'ownsProperty' && val === 'No') {
      setTimeout(() => setStep(3), 220)
    } else {
      setTimeout(() => setStep((s) => Math.min(s + 1, 8)), 220)
    }
  }

  const validateContact = () => {
    const e = {}
    if (!data.fullName.trim()) e.fullName = 'Required'
    if (!/^\S+@\S+\.\S+$/.test(data.email)) e.email = 'Enter a valid email'
    if (data.mobile.replace(/\D/g, '').length < 8) e.mobile = 'Enter a valid number'
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
      ownsProperty: data.ownsProperty,
      mortgageAmount: data.mortgageAmount,
      debtType: data.debtType,
      timing: data.timing,
      annualIncome: data.income,
      creditScore: data.creditScore,
      fullName: data.fullName.trim(),
      email: data.email.trim(),
      mobile: data.mobile.trim(),
      pageUrl: window.location.href,
      submittedAt: new Date().toISOString(),
    }

    try {
      if (window.fbq) window.fbq('track', 'Lead', { brand: BRAND })
    } catch (e) {}

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
              <p className="sub">
                See If You Could Combine Your Debts Into One Simple Monthly Repayment
              </p>
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
                  <span>{fmt(SLIDER_MAX)}+</span>
                </div>
                <div className="slider-value">{fmt(data.debtAmount)}{data.debtAmount === SLIDER_MAX ? '+' : ''}</div>
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
            title="Do you currently own a property?"
            options={PROPERTY_OPTS}
            value={data.ownsProperty}
            onSelect={(v) => pick('ownsProperty', v)}
          />
        )}

        {step === 2 && (
          <SelectStep
            title="Approximately how much is your current mortgage?"
            help="Select your closest estimate"
            options={MORTGAGE_OPTS}
            value={data.mortgageAmount}
            onSelect={(v) => pick('mortgageAmount', v)}
          />
        )}

        {step === 3 && (
          <SelectStep
            title="What types of debt would you like to consolidate?"
            options={DEBT_TYPE_OPTS}
            value={data.debtType}
            onSelect={(v) => pick('debtType', v)}
          />
        )}

        {step === 4 && (
          <SelectStep
            title="How soon are you looking to improve your finances?"
            options={TIMING_OPTS}
            value={data.timing}
            onSelect={(v) => pick('timing', v)}
          />
        )}

        {step === 5 && (
          <SelectStep
            title="What's your annual income?"
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
            <h2 className="q-title">Where should we send your options?</h2>
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
            <h2>You're all set!</h2>
            <p>
              A debt specialist will be in touch shortly to walk you through your options and help
              simplify your repayments.
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
