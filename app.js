// ── API Key ──────────────────────────────────────────────────────────────────
function getApiKey() { return localStorage.getItem('anthropic_api_key') || ''; }
function saveApiKey(k) { localStorage.setItem('anthropic_api_key', k.trim()); }
function checkApiKey() {
  const ok = !!getApiKey();
  document.getElementById('api-key-banner').style.display = ok ? 'none' : '';
  document.getElementById('main-content').style.display   = ok ? ''     : 'none';
}
function submitApiKey() {
  const v = document.getElementById('api-key-input').value.trim();
  if (!v.startsWith('sk-ant-')) {
    document.getElementById('api-key-error').textContent = "Doesn't look right — key should start with sk-ant-";
    return;
  }
  saveApiKey(v); checkApiKey();
}
function clearApiKey() { localStorage.removeItem('anthropic_api_key'); checkApiKey(); }
window.addEventListener('DOMContentLoaded', checkApiKey);

// ── Chips ────────────────────────────────────────────────────────────────────
const chipState = {};
function toggleChip(el, g) {
  if (!chipState[g]) chipState[g] = new Set();
  el.classList.contains('on')
    ? (el.classList.remove('on'), chipState[g].delete(el.textContent))
    : (el.classList.add('on'),    chipState[g].add(el.textContent));
}
function getChips(g) { return chipState[g] ? [...chipState[g]].join(', ') : ''; }

// ── Tabs ─────────────────────────────────────────────────────────────────────
function switchTab(name, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  ['diet','workout','bmi'].forEach(t =>
    document.getElementById('tab-'+t).style.display = t === name ? '' : 'none');
}

// ── Claude call ──────────────────────────────────────────────────────────────
async function callClaude(system, prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getApiKey(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 4096, system, messages: [{ role: 'user', content: prompt }] }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content?.find(b => b.type === 'text')?.text || '';
}

// Robust JSON extractor — strips fences, finds outermost { }, handles truncation
function parseJSON(raw) {
  // Strip markdown fences
  let s = raw.replace(/^```json\s*/,'').replace(/^```\s*/,'').replace(/```\s*$/,'').trim();
  // Find the outermost JSON object
  const start = s.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in response');
  // Walk to find matching closing brace, tolerating truncation
  let depth = 0, end = -1;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  // If truncated, attempt to close open braces/brackets
  if (end === -1) {
    let fragment = s.slice(start);
    // Count unclosed braces and brackets
    let braces = 0, brackets = 0;
    let inStr = false, escape = false;
    for (const ch of fragment) {
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{') braces++;
      else if (ch === '}') braces--;
      else if (ch === '[') brackets++;
      else if (ch === ']') brackets--;
    }
    // Remove trailing incomplete key/value then close structures
    fragment = fragment.replace(/,\s*"[^"]*"\s*:\s*[^,}\]]*$/, '');
    fragment = fragment.replace(/,\s*"[^"]*"\s*$/, '');
    fragment += ']'.repeat(Math.max(0, brackets)) + '}'.repeat(Math.max(0, braces));
    s = fragment;
  } else {
    s = s.slice(start, end + 1);
  }
  return JSON.parse(s);
}

// ── Generate Diet Plan ───────────────────────────────────────────────────────
async function generateDiet() {
  const btn = document.getElementById('diet-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Generating…';
  document.getElementById('diet-plan').style.display  = 'none';
  document.getElementById('diet-empty').style.display = '';
  document.getElementById('diet-empty').textContent   = 'Building your 7-day meal plan…';

  const schema = `{"goal":"...","daily_calories":1800,"protein_g":140,"carbs_g":180,"fat_g":60,"days":[{"day":"Day 1","title":"Monday","meals":[{"meal":"Breakfast","time":"8:00 AM","items":"...","calories":380},{"meal":"Mid-morning","time":"11:00 AM","items":"...","calories":150},{"meal":"Lunch","time":"1:00 PM","items":"...","calories":500},{"meal":"Snack","time":"4:30 PM","items":"...","calories":180},{"meal":"Dinner","time":"7:30 PM","items":"...","calories":450}],"total_calories":1660,"water":"10 glasses"}],"tips":["tip 1","tip 2","tip 3"]}`;

  try {
    const text = await callClaude(
      'You are a certified nutritionist. Respond ONLY with valid JSON matching the schema. No markdown fences, no extra text. Use Indian-friendly foods.',
      `Create a 7-day diet plan for:
Age: ${document.getElementById('d-age').value||'N/A'}, Weight: ${document.getElementById('d-weight').value||'N/A'}kg,
Height: ${document.getElementById('d-height').value||'N/A'}cm, Gender: ${document.getElementById('d-gender').value||'N/A'},
Activity: ${document.getElementById('d-activity').value||'moderate'}, Goal: ${getChips('d-goal')||'general health'},
Preferences: ${getChips('d-pref')||'none'}, Avoid: ${document.getElementById('d-allergies').value||'none'}.
Schema: ${schema}`
    );
    const plan = parseJSON(text);
    renderDietPlan(plan);
    document.getElementById('diet-empty').style.display = 'none';
    document.getElementById('diet-plan').style.display  = '';
  } catch(e) {
    document.getElementById('diet-empty').textContent = 'Error: ' + e.message;
  }
  btn.disabled = false;
  btn.textContent = 'Generate Diet Plan';
}

// ── Render Diet Plan ─────────────────────────────────────────────────────────
function renderDietPlan(plan) {
  const wrap = document.getElementById('diet-pdf-content');

  let html = `<div class="plan-summary">
    <div class="sum-card"><div class="sum-val">${plan.daily_calories||'—'}</div><div class="sum-lbl">Target kcal/day</div></div>
    <div class="sum-card"><div class="sum-val">${plan.protein_g||'—'}g</div><div class="sum-lbl">Protein</div></div>
    <div class="sum-card"><div class="sum-val">${plan.carbs_g||'—'}g</div><div class="sum-lbl">Carbs</div></div>
  </div>`;

  (plan.days||[]).forEach(d => {
    html += `<div class="day-card">
      <div class="day-hdr">
        <span class="day-badge">${d.day}</span>
        <span class="day-title">${d.title||''}</span>
        <span class="day-sub">Water: ${d.water||'8 glasses'}</span>
      </div>
      <div class="day-body">
        <table class="plan-table">
          <thead><tr>
            <th style="width:20%">Meal</th>
            <th style="width:65%">What to eat</th>
            <th style="width:15%">Kcal</th>
          </tr></thead>
          <tbody>`;

    (d.meals||[]).forEach(m => {
      html += `<tr>
        <td><span class="meal-name">${m.meal}</span><span class="meal-time">${m.time||''}</span></td>
        <td class="meal-items">${m.items}</td>
        <td class="meal-cal">${m.calories||'—'}</td>
      </tr>`;
    });

    html += `</tbody>
          <tfoot><tr class="total-row">
            <td colspan="5">Total</td>
            <td>${d.total_calories||'—'} kcal</td>
          </tr></tfoot>
        </table>
      </div>
    </div>`;
  });

  if (plan.tips?.length) {
    html += `<div class="tips-section"><div class="tips-heading">Nutrition tips</div><div class="tips-grid">`;
    plan.tips.forEach((t,i) => {
      html += `<div class="tip-card"><div class="tip-num">Tip ${i+1}</div><p>${t}</p></div>`;
    });
    html += `</div></div>`;
  }

  wrap.innerHTML = html;
}

// ── Generate Workout Plan ────────────────────────────────────────────────────
async function generateWorkout() {
  const btn = document.getElementById('workout-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Generating…';
  document.getElementById('workout-plan-pdf').style.display = 'none';
  document.getElementById('workout-empty').style.display    = '';
  document.getElementById('workout-empty').textContent      = 'Building your workout split…';

  const schema = `{"split":"Push/Pull/Legs","goal":"...","days_per_week":4,"days":[{"day":"Day 1","title":"Push — Chest & Shoulders","focus":"Chest, Shoulders, Triceps","warmup":"5 min light cardio","exercises":[{"name":"Bench Press","sets":4,"reps":"8-10","rest":"90s","tip":"Retract shoulder blades"}],"cooldown":"5 min stretching"}],"form_tips":[{"exercise":"Squat","tip":"Chest tall, knees over toes"}],"overload_tip":"Add 2.5kg or 1 rep each week."}`;

  try {
    const text = await callClaude(
      'You are a certified personal trainer. Respond ONLY with valid JSON matching the schema. No markdown, no extra text.',
      `Create a ${document.getElementById('w-days').value||4}-day/week workout plan for:
Age: ${document.getElementById('w-age').value||'N/A'}, Weight: ${document.getElementById('w-weight').value||'N/A'}kg,
Level: ${document.getElementById('w-level').value||'intermediate'}, Goal: ${getChips('w-goal')||'general fitness'},
Equipment: ${getChips('w-equip')||'full gym'}, Injuries: ${document.getElementById('w-injury').value||'none'}.
Schema: ${schema}`
    );
    const plan = parseJSON(text);
    renderWorkoutPlan(plan);
    document.getElementById('workout-empty').style.display    = 'none';
    document.getElementById('workout-plan-pdf').style.display = '';
  } catch(e) {
    document.getElementById('workout-empty').textContent = 'Error: ' + e.message;
  }
  btn.disabled = false;
  btn.textContent = 'Generate Workout Plan';
}

// ── Render Workout Plan ──────────────────────────────────────────────────────
function renderWorkoutPlan(plan) {
  const wrap = document.getElementById('workout-pdf-content');

  let html = `<div class="plan-summary">
    <div class="sum-card"><div class="sum-val">${plan.days_per_week||'—'}</div><div class="sum-lbl">Days / week</div></div>
    <div class="sum-card"><div class="sum-val">${plan.split||'—'}</div><div class="sum-lbl">Split type</div></div>
    <div class="sum-card"><div class="sum-val">${plan.goal||'—'}</div><div class="sum-lbl">Goal</div></div>
  </div>`;

  (plan.days||[]).forEach(d => {
    html += `<div class="day-card">
      <div class="day-hdr">
        <span class="day-badge">${d.day}</span>
        <span class="day-title">${d.title||''}</span>
        <span class="day-sub">${d.focus||''}</span>
      </div>
      <div class="day-body">
        ${d.warmup ? `<div class="warmup-bar"><span class="bar-label">Warm-up</span><span>${d.warmup}</span></div>` : ''}
        <table class="plan-table">
          <thead><tr>
            <th style="width:32%">Exercise</th>
            <th style="width:10%">Sets</th>
            <th style="width:14%">Reps</th>
            <th style="width:12%">Rest</th>
            <th>Coach tip</th>
          </tr></thead>
          <tbody>`;

    (d.exercises||[]).forEach(ex => {
      html += `<tr>
        <td class="ex-name">${ex.name}</td>
        <td class="ex-sets">${ex.sets}</td>
        <td class="ex-reps">${ex.reps}</td>
        <td class="ex-rest">${ex.rest}</td>
        <td class="ex-tip">${ex.tip||''}</td>
      </tr>`;
    });

    html += `</tbody></table>
        ${d.cooldown ? `<div class="cooldown-bar"><span class="bar-label">Cool-down</span><span>${d.cooldown}</span></div>` : ''}
      </div>
    </div>`;
  });

  if (plan.overload_tip) {
    html += `<div class="overload-box"><div class="ob-label">Progressive overload tip</div>${plan.overload_tip}</div>`;
  }

  if (plan.form_tips?.length) {
    html += `<div class="form-tips-grid">`;
    plan.form_tips.forEach(t => {
      html += `<div class="ftip-card"><div class="ftip-ex">${t.exercise}</div><div class="ftip-text">${t.tip}</div></div>`;
    });
    html += `</div>`;
  }

  wrap.innerHTML = html;
}

// ── BMI Calculator ───────────────────────────────────────────────────────────
function calcBMI() {
  const w = parseFloat(document.getElementById('b-weight').value);
  const h = parseFloat(document.getElementById('b-height').value);
  const age = parseFloat(document.getElementById('b-age').value);
  const gender = document.getElementById('b-gender').value;
  const act = parseFloat(document.getElementById('b-activity').value);
  if (!w || !h) return;

  const bmi = w / ((h/100) ** 2);
  const bmr = 10*w + 6.25*h - 5*(age||25) + (gender==='Male' ? 5 : gender==='Female' ? -161 : -78);
  const tdee = act ? bmr * act : 0;

  document.getElementById('bmi-val').textContent  = bmi.toFixed(1);
  document.getElementById('bmr-val').textContent  = Math.round(bmr);
  document.getElementById('tdee-val').textContent = tdee ? Math.round(tdee) : '—';

  document.getElementById('bmi-detail').style.display = '';
  const cats = bmi < 18.5 ? ['Underweight','Focus on a calorie surplus with nutrient-dense foods and strength training to build lean mass.']
             : bmi < 25   ? ['Normal weight','You\'re in a healthy range. Keep up balanced nutrition and consistent training.']
             : bmi < 30   ? ['Overweight','A moderate deficit (300–500 kcal/day) with cardio and strength training will help.']
             :               ['Obese','Consult a doctor before starting. Low-impact exercise and structured nutrition is a great start.'];
  document.getElementById('bmi-explain').textContent =
    `BMI category: ${cats[0]}. ${cats[1]}${tdee ? ` Your TDEE is ${Math.round(tdee)} kcal/day — eat below this to lose weight, above to gain.` : ''}`;
}

// ── PDF Download ─────────────────────────────────────────────────────────────
function downloadPDF(wrapId, contentId, btnEl) {
  const content = document.getElementById(contentId);
  if (!content || !content.innerHTML.trim()) { alert('Generate a plan first.'); return; }

  const btn = event.currentTarget;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner" style="border-top-color:var(--brand);border-color:rgba(232,80,10,0.2);"></span> Exporting…`;

  // Build self-contained clone with all styles inlined
  const clone = content.cloneNode(true);
  const styles = `
    <style>
      *{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
      body{color:#1a1a1a;font-size:13px;}
      .plan-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;}
      .sum-card{border:1px solid #e5e3df;border-radius:8px;padding:12px;text-align:center;}
      .sum-val{font-size:18px;font-weight:700;color:#E8500A;}
      .sum-lbl{font-size:10px;color:#999;margin-top:3px;text-transform:uppercase;letter-spacing:.04em;}
      .day-card{border:1px solid #e5e3df;border-radius:10px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid;}
      .day-hdr{background:#0F172A;color:#fff;padding:10px 14px;display:flex;align-items:center;gap:10px;}
      .day-badge{background:#E8500A;color:#fff;font-size:10px;font-weight:700;padding:3px 9px;border-radius:99px;text-transform:uppercase;}
      .day-title{font-size:13px;font-weight:600;color:#fff;}
      .day-sub{font-size:11px;color:#94a3b8;margin-left:auto;}
      .plan-table{width:100%;border-collapse:collapse;font-size:12px;}
      .plan-table thead tr{background:#f8f7f5;border-bottom:2px solid #E8500A;}
      .plan-table thead th{padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.05em;}
      .plan-table tbody tr{border-bottom:1px solid #e5e3df;}
      .plan-table tbody tr:last-child{border-bottom:none;}
      .plan-table td{padding:9px 12px;vertical-align:top;line-height:1.5;}
      .meal-name{font-weight:700;color:#C13E06;display:block;}
      .meal-time{font-size:10px;color:#999;}
      .meal-macro{text-align:center;font-size:11px;color:#555;}
      .meal-cal{text-align:right;font-weight:700;color:#0F172A;}
      .total-row{background:#0F172A!important;}
      .total-row td{color:#fff!important;font-weight:700;padding:8px 12px;}
      .total-row td:first-child{color:#94a3b8!important;}
      .ex-name{font-weight:700;color:#0F172A;}
      .ex-sets{text-align:center;font-weight:700;color:#E8500A;}
      .ex-reps,.ex-rest{text-align:center;}
      .ex-tip{font-size:11px;color:#777;font-style:italic;}
      .warmup-bar,.cooldown-bar{display:flex;gap:8px;padding:7px 12px;border-bottom:1px solid #e5e3df;font-size:11px;color:#555;}
      .bar-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;}
      .warmup-bar .bar-label{color:#16A34A;}
      .cooldown-bar .bar-label{color:#0369A1;}
      .cooldown-bar{border-top:1px solid #e5e3df;border-bottom:none;}
      .overload-box{background:#FDF0EB;border:1px solid #f5c0a4;border-radius:8px;padding:12px 14px;font-size:12px;color:#C13E06;margin-top:12px;}
      .ob-label{font-size:10px;font-weight:700;color:#E8500A;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;}
      .form-tips-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;}
      .ftip-card{background:#E0F2FE;border:1px solid #bae6fd;border-radius:8px;padding:10px 12px;}
      .ftip-ex{font-size:10px;font-weight:700;color:#0369A1;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;}
      .ftip-text{font-size:12px;color:#075985;line-height:1.5;}
      .tips-section{margin-top:12px;}
      .tips-heading{font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;}
      .tips-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
      .tip-card{background:#DCFCE7;border:1px solid #bbf7d0;border-radius:8px;padding:10px 12px;}
      .tip-num{font-size:9px;font-weight:700;color:#16A34A;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px;}
      .tip-card p{font-size:12px;color:#166534;line-height:1.5;}
    </style>`;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = styles;
  wrapper.appendChild(clone);

  const isWorkout = contentId.includes('workout');
  html2pdf().set({
    margin: [12, 12, 12, 12],
    filename: isWorkout ? 'workout-plan.pdf' : 'diet-plan.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'avoid-all'] },
  }).from(wrapper).save().then(() => {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> PDF`;
  });
}
