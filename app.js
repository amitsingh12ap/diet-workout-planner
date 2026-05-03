// ─── API Key management ───────────────────────────────────────────────────────
function getApiKey() {
  return localStorage.getItem('anthropic_api_key') || '';
}

function saveApiKey(key) {
  localStorage.setItem('anthropic_api_key', key.trim());
}

function checkApiKey() {
  const key = getApiKey();
  const banner = document.getElementById('api-key-banner');
  const mainContent = document.getElementById('main-content');
  if (!key) {
    banner.style.display = '';
    mainContent.style.display = 'none';
  } else {
    banner.style.display = 'none';
    mainContent.style.display = '';
  }
}

function submitApiKey() {
  const val = document.getElementById('api-key-input').value.trim();
  if (!val.startsWith('sk-ant-')) {
    document.getElementById('api-key-error').textContent = 'That doesn\'t look like an Anthropic key (should start with sk-ant-).';
    return;
  }
  saveApiKey(val);
  checkApiKey();
}

function clearApiKey() {
  localStorage.removeItem('anthropic_api_key');
  checkApiKey();
}

window.addEventListener('DOMContentLoaded', checkApiKey);

// ─── Chip state ───────────────────────────────────────────────────────────────
const chipState = {};

function toggleChip(el, group) {
  if (!chipState[group]) chipState[group] = new Set();
  if (el.classList.contains('on')) {
    el.classList.remove('on');
    chipState[group].delete(el.textContent);
  } else {
    el.classList.add('on');
    chipState[group].add(el.textContent);
  }
}

function getChips(group) {
  return chipState[group] ? [...chipState[group]].join(', ') : '';
}

// ─── Tab switching ────────────────────────────────────────────────────────────
function switchTab(name, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  ['diet', 'workout', 'bmi'].forEach(t => {
    document.getElementById('tab-' + t).style.display = t === name ? '' : 'none';
  });
}

// ─── Loading state ────────────────────────────────────────────────────────────
function setLoading(btnId, outId, loading, label) {
  const btn = document.getElementById(btnId);
  const out = document.getElementById(outId);
  if (loading) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Generating...';
    out.classList.remove('empty');
    out.textContent = 'Thinking...';
  } else {
    btn.disabled = false;
    btn.textContent = label;
  }
}

// ─── Claude API call ──────────────────────────────────────────────────────────
async function callClaude(systemPrompt, userPrompt, outId) {
  const out = document.getElementById(outId);
  try {
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
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const text = data.content?.find(b => b.type === 'text')?.text || 'No response.';
    out.classList.remove('empty');
    out.textContent = text;
  } catch (e) {
    out.classList.remove('empty');
    out.textContent = 'Error: ' + e.message;
  }
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

  setLoading('diet-btn', 'diet-output', true);

  const sys = `You are a certified nutritionist and diet planner. Create practical, detailed, day-by-day diet plans.
Format clearly with meal timing, quantities, and macros. Be concise but thorough. Use Indian-friendly foods where appropriate.`;

  const prompt = `Create a 7-day diet plan for:
- Age: ${age || 'not specified'}, Weight: ${weight || 'not specified'} kg, Height: ${height || 'not specified'} cm, Gender: ${gender || 'not specified'}
- Activity level: ${activity || 'moderate'}
- Goal: ${goal || 'general health'}
- Dietary preferences: ${pref || 'no specific preference'}
- Allergies/avoid: ${allergies || 'none'}

Provide a structured plan with breakfast, lunch, dinner, and snacks for each day.
Include estimated calories and key macros per day. Add 3–4 practical tips at the end.`;

  await callClaude(sys, prompt, 'diet-output');
  setLoading('diet-btn', 'diet-output', false, 'Generate my diet plan');
}

// ─── Workout plan ─────────────────────────────────────────────────────────────
async function generateWorkout() {
  const age    = document.getElementById('w-age').value;
  const weight = document.getElementById('w-weight').value;
  const level  = document.getElementById('w-level').value;
  const days   = document.getElementById('w-days').value;
  const goal   = getChips('w-goal');
  const equip  = getChips('w-equip');
  const injury = document.getElementById('w-injury').value;

  setLoading('workout-btn', 'workout-output', true);

  const sys = `You are a certified personal trainer and strength coach. Create structured, progressive workout plans.
Use clear formatting with sets, reps, rest times, and weekly splits. Be specific and practical.`;

  const prompt = `Create a ${days || 4}-day/week workout plan for:
- Age: ${age || 'not specified'}, Weight: ${weight || 'not specified'} kg
- Fitness level: ${level || 'intermediate'}
- Goal: ${goal || 'general fitness'}
- Equipment: ${equip || 'full gym'}
- Injuries/limitations: ${injury || 'none'}

Provide a weekly split with day-by-day exercises, sets, reps, and rest periods.
Include warm-up and cool-down. Add form tips for 2–3 key exercises.
End with a progressive overload tip.`;

  await callClaude(sys, prompt, 'workout-output');
  setLoading('workout-btn', 'workout-output', false, 'Generate my workout plan');
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

  let bmr = 0;
  if (gender === 'Male')        bmr = 10 * w + 6.25 * hCm - 5 * (age || 25) + 5;
  else if (gender === 'Female') bmr = 10 * w + 6.25 * hCm - 5 * (age || 25) - 161;
  else                          bmr = 10 * w + 6.25 * hCm - 5 * (age || 25) - 78;

  const tdee = actMult ? bmr * actMult : 0;

  document.getElementById('bmi-val').textContent  = bmi.toFixed(1);
  document.getElementById('bmr-val').textContent  = Math.round(bmr);
  document.getElementById('tdee-val').textContent = tdee ? Math.round(tdee) : '—';

  const detail  = document.getElementById('bmi-detail');
  const explain = document.getElementById('bmi-explain');
  detail.style.display = '';

  let cat, advice;
  if (bmi < 18.5)      { cat = 'Underweight'; advice = 'Focus on a calorie surplus with nutrient-dense foods. Aim for high-protein meals and strength training to build lean mass.'; }
  else if (bmi < 25)   { cat = 'Normal weight'; advice = 'Great — you are in a healthy range. Focus on balanced nutrition and consistent training to stay here.'; }
  else if (bmi < 30)   { cat = 'Overweight'; advice = 'A moderate calorie deficit (300–500 kcal/day) combined with cardio and strength training will help you reach a healthy range.'; }
  else                  { cat = 'Obese'; advice = 'Consult a doctor before starting. A structured calorie-controlled diet and low-impact exercise (walking, swimming) is a solid starting point.'; }

  explain.textContent = `BMI category: ${cat}. ${advice}${tdee ? ` Your TDEE of ${Math.round(tdee)} kcal/day is your maintenance — eat below this to lose weight, above to gain.` : ''}`;
}
