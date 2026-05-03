// ─── API Key management ───────────────────────────────────────────────────────
function getApiKey() { return localStorage.getItem('anthropic_api_key') || ''; }
function saveApiKey(key) { localStorage.setItem('anthropic_api_key', key.trim()); }

function checkApiKey() {
  const key = getApiKey();
  document.getElementById('api-key-banner').style.display = key ? 'none' : '';
  document.getElementById('main-content').style.display   = key ? ''     : 'none';
}

function submitApiKey() {
  const val = document.getElementById('api-key-input').value.trim();
  if (!val.startsWith('sk-ant-')) {
    document.getElementById('api-key-error').textContent =
      "That doesn't look like an Anthropic key (should start with sk-ant-).";
    return;
  }
  saveApiKey(val);
  checkApiKey();
}

function clearApiKey() { localStorage.removeItem('anthropic_api_key'); checkApiKey(); }
window.addEventListener('DOMContentLoaded', checkApiKey);

// ─── Chip state ───────────────────────────────────────────────────────────────
const chipState = {};
function toggleChip(el, group) {
  if (!chipState[group]) chipState[group] = new Set();
  el.classList.contains('on')
    ? (el.classList.remove('on'), chipState[group].delete(el.textContent))
    : (el.classList.add('on'),    chipState[group].add(el.textContent));
}
function getChips(group) { return chipState[group] ? [...chipState[group]].join(', ') : ''; }

// ─── Tab switching ────────────────────────────────────────────────────────────
function switchTab(name, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  ['diet','workout','bmi'].forEach(t =>
    document.getElementById('tab-'+t).style.display = t === name ? '' : 'none');
}

// ─── Loading state ────────────────────────────────────────────────────────────
function setLoading(btnId, loading, label) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.innerHTML = loading ? '<span class="spinner"></span>Generating...' : label;
}

// ─── Claude API call ──────────────────────────────────────────────────────────
async function callClaude(system, userPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getApiKey(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.find(b => b.type === 'text')?.text || '';
}

// ─── Diet plan ────────────────────────────────────────────────────────────────
async function generateDiet() {
  const age      = document.getElementById('d-age').value;
  const weight   = document.getElementById('d-weight').value;
  const height   = document.getElementById('d-height').value;
  const gender   = document.getElementById('d-gender').value;
  const activity = document.getElementById('d-activity').value;
  const goal     = getChips('d-goal');
  const pref     = getChips('d-pref');
  const allergies = document.getElementById('d-allergies').value;

  const out = document.getElementById('diet-output');
  out.classList.remove('empty');
  out.textContent = 'Building your meal plan...';
  setLoading('diet-btn', true);

  try {
    const sys = `You are a certified nutritionist. Create practical 7-day diet plans.
Use Indian-friendly foods. Format with clear meal sections per day.`;
    const prompt = `Create a 7-day diet plan for:
- Age: ${age||'N/A'}, Weight: ${weight||'N/A'} kg, Height: ${height||'N/A'} cm, Gender: ${gender||'N/A'}
- Activity: ${activity||'moderate'}, Goal: ${goal||'general health'}
- Preferences: ${pref||'none'}, Avoid: ${allergies||'none'}
Include breakfast, lunch, dinner, snacks per day with calories. Add 3 tips at end.`;
    const text = await callClaude(sys, prompt);
    out.textContent = text;
  } catch(e) {
    out.textContent = 'Error: ' + e.message;
  }
  setLoading('diet-btn', false, 'Generate my diet plan');
}

// ─── Workout plan — JSON from Claude → table render ───────────────────────────
async function generateWorkout() {
  const age    = document.getElementById('w-age').value;
  const weight = document.getElementById('w-weight').value;
  const level  = document.getElementById('w-level').value;
  const days   = document.getElementById('w-days').value;
  const goal   = getChips('w-goal');
  const equip  = getChips('w-equip');
  const injury = document.getElementById('w-injury').value;

  const planEl = document.getElementById('workout-plan');
  planEl.style.display = 'none';
  planEl.innerHTML = '';
  setLoading('workout-btn', true);

  const sys = `You are a certified personal trainer. Always respond with ONLY valid JSON — no markdown, no explanation.`;

  const schema = `{
  "split": "e.g. Push/Pull/Legs",
  "goal": "...",
  "days": [
    {
      "day": "Day 1",
      "title": "Push — Chest & Shoulders",
      "focus": "Chest, Shoulders, Triceps",
      "warmup": "5 min light cardio + arm circles",
      "exercises": [
        { "name": "Bench Press", "sets": 4, "reps": "8-10", "rest": "90s", "tip": "Keep shoulder blades retracted" }
      ],
      "cooldown": "5 min static stretching"
    }
  ],
  "form_tips": [
    { "exercise": "Squat", "tip": "Keep chest tall, knees tracking over toes" }
  ],
  "overload_tip": "Add 2.5kg or 1 extra rep each week on main lifts."
}`;

  const prompt = `Create a ${days||4}-day/week workout plan for:
- Age: ${age||'N/A'}, Weight: ${weight||'N/A'} kg
- Level: ${level||'intermediate'}, Goal: ${goal||'general fitness'}
- Equipment: ${equip||'full gym'}, Injuries: ${injury||'none'}

Respond ONLY with JSON matching this schema (no extra fields, no markdown):
${schema}`;

  try {
    const raw  = await callClaude(sys, prompt);
    const json = JSON.parse(raw.replace(/```json|```/g, '').trim());
    renderWorkoutPlan(json);
    planEl.style.display = '';
  } catch(e) {
    planEl.style.display = '';
    planEl.innerHTML = `<div class="output">${e.message}<br><br>Raw: ${e.raw||''}</div>`;
  }
  setLoading('workout-btn', false, 'Generate my workout plan');
}

// ─── Render workout plan as tables ───────────────────────────────────────────
function renderWorkoutPlan(plan) {
  const el = document.getElementById('workout-plan');

  // Header row
  let html = `<div class="plan-header">
    <div>
      <div class="plan-title">${plan.split || 'Weekly Plan'}</div>
      <div class="plan-meta">Goal: ${plan.goal || '—'}</div>
    </div>
    <button class="btn-secondary" onclick="downloadPDF()">Download PDF</button>
  </div>`;

  // Day cards
  (plan.days || []).forEach((d, i) => {
    html += `<div class="day-card">
      <div class="day-header">
        <span class="day-badge">${d.day || 'Day '+(i+1)}</span>
        <span class="day-title">${d.title || ''}</span>
        <span class="day-focus">${d.focus || ''}</span>
      </div>
      <div class="day-body">`;

    if (d.warmup) html += `<div class="warmup-row"><span>Warm-up</span><span>${d.warmup}</span></div>`;

    // Exercise table
    html += `<table class="ex-table">
      <thead><tr>
        <th style="width:30%">Exercise</th>
        <th style="width:10%">Sets</th>
        <th style="width:14%">Reps</th>
        <th style="width:12%">Rest</th>
        <th>Coach tip</th>
      </tr></thead>
      <tbody>`;

    (d.exercises || []).forEach(ex => {
      html += `<tr>
        <td class="ex-name">${ex.name}</td>
        <td class="ex-sets">${ex.sets}</td>
        <td class="ex-reps">${ex.reps}</td>
        <td class="ex-rest">${ex.rest}</td>
        <td class="ex-tip">${ex.tip || ''}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
    if (d.cooldown) html += `<div class="cooldown-row"><span>Cool-down</span><span>${d.cooldown}</span></div>`;
    html += `</div></div>`; // close day-body + day-card
  });

  // Progressive overload tip
  if (plan.overload_tip) {
    html += `<div class="overload-box"><strong>Progressive overload tip</strong>${plan.overload_tip}</div>`;
  }

  // Form tips grid
  if (plan.form_tips && plan.form_tips.length) {
    html += `<div class="section-label" style="margin-top:1.25rem;">Form tips</div>
      <div class="tips-grid">`;
    plan.form_tips.forEach(t => {
      html += `<div class="tip-card">
        <div class="tip-ex">${t.exercise}</div>
        <div class="tip-text">${t.tip}</div>
      </div>`;
    });
    html += `</div>`;
  }

  el.innerHTML = html;
}

// ─── PDF download via browser print ──────────────────────────────────────────
function downloadPDF() {
  window.print();
}

// ─── BMI calculator ───────────────────────────────────────────────────────────
function calcBMI() {
  const w       = parseFloat(document.getElementById('b-weight').value);
  const hCm     = parseFloat(document.getElementById('b-height').value);
  const age     = parseFloat(document.getElementById('b-age').value);
  const gender  = document.getElementById('b-gender').value;
  const actMult = parseFloat(document.getElementById('b-activity').value);
  if (!w || !hCm) return;

  const h   = hCm / 100;
  const bmi = w / (h * h);
  let bmr   = 10*w + 6.25*hCm - 5*(age||25) + (gender === 'Male' ? 5 : gender === 'Female' ? -161 : -78);
  const tdee = actMult ? bmr * actMult : 0;

  document.getElementById('bmi-val').textContent  = bmi.toFixed(1);
  document.getElementById('bmr-val').textContent  = Math.round(bmr);
  document.getElementById('tdee-val').textContent = tdee ? Math.round(tdee) : '—';

  const detail  = document.getElementById('bmi-detail');
  const explain = document.getElementById('bmi-explain');
  detail.style.display = '';

  let cat, advice;
  if      (bmi < 18.5) { cat='Underweight'; advice='Focus on a calorie surplus with nutrient-dense foods and strength training to build lean mass.'; }
  else if (bmi < 25)   { cat='Normal weight'; advice='You are in a healthy range. Keep up balanced nutrition and consistent training.'; }
  else if (bmi < 30)   { cat='Overweight'; advice='A moderate calorie deficit (300–500 kcal/day) with cardio and strength training will help.'; }
  else                  { cat='Obese'; advice='Consult a doctor before starting. Low-impact exercise (walking, swimming) and structured nutrition is a solid starting point.'; }

  explain.textContent = `BMI category: ${cat}. ${advice}${tdee ? ` Your TDEE is ${Math.round(tdee)} kcal/day — eat below this to lose weight, above to gain.` : ''}`;
}
