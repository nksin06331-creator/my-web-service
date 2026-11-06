const api = (...args) => window.formAPI ? window.formAPI(...args) : fetch(...args);
const $ = id => document.getElementById(id);
let groups = [];
let salonQuestions = null;
let hearingData = null;
let dirty = false;
let selectedRecipient = null;
let recipients = [];
let STORAGE_KEY = 'salon-opening-plan:2026-11:v1';
const itemKey = (group, text) => JSON.stringify([group.month, text]);
function saveDraft() {
  if (hearingData) return saveHearingDraft();
  if (salonQuestions) return saveSalonDraft();
  try {
    const items = {};
    groups.forEach((g, m) => g.items.forEach((text, i) => {
      items[itemKey(g, text)] = {checked: $(`check-${m}-${i}`).checked, memo: $(`memo-${m}-${i}`).value};
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({version: 1, name: $('name').value, overall: $('overall').value, items}));
    dirty = false;
    $('save-status').textContent = 'このブラウザーに保存しました。';
  } catch {
    dirty = true;
    $('save-status').textContent = 'このブラウザーに保存できません。画面を閉じる前に回答をコピーしてください。';
  }
}
function restoreDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { $('save-status').textContent = '入力すると、このブラウザーに自動保存されます。'; return; }
    const draft = JSON.parse(raw);
    if (!draft || draft.version !== 1 || typeof draft.items !== 'object' || !draft.items) throw new Error();
    $('name').value = typeof draft.name === 'string' ? draft.name : '';
    $('overall').value = typeof draft.overall === 'string' ? draft.overall : '';
    groups.forEach((g, m) => g.items.forEach((text, i) => {
      const item = draft.items[itemKey(g, text)];
      if (!item || typeof item !== 'object') return;
      $(`check-${m}-${i}`).checked = item.checked === true;
      $(`memo-${m}-${i}`).value = typeof item.memo === 'string' ? item.memo : '';
    }));
    $('save-status').textContent = 'このブラウザーに保存した回答を復元しました。';
  } catch {
    $('save-status').textContent = '保存済みの回答を読み込めませんでした。入力内容はコピーで控えてください。';
  }
}

const node = (tag, text, cls) => { const el = document.createElement(tag); if (text) el.textContent = text; if (cls) el.className = cls; return el; };
function updateProgress() {
  if (hearingData) return updateHearingProgress();
  if (salonQuestions) return updateSalonProgress();
  const checks = [...document.querySelectorAll('.task-check')];
  const done = checks.filter(el => el.checked).length;
  $('count').textContent = done;
  $('total').textContent = `/ ${checks.length}`;
  $('percent').textContent = `${(checks.length ? Math.round(done / checks.length * 100) : 0)}%`;
  $('progress').style.width = $('percent').textContent;
  updateNavigation();
  groups.forEach((g, m) => {
    const n = document.querySelectorAll(`#month-${m} .task-check:checked`).length;
    $(`month-count-${m}`).textContent = `${n} / ${g.items.length}`;
  });
}
function render() {
  $('sections').replaceChildren(); $('months').replaceChildren();
  groups.forEach((g, m) => {
    const link = node('a', g.month); link.href = `#month-${m}`; $('months').append(link);
    const section = node('section', '', 'card month'); section.id = `month-${m}`;
    const heading = node('div', '', 'month-heading');
    const titles = node('div'); titles.append(node('div', g.month, 'eyebrow'), node('h2', g.title));
    const counter = node('span', '', 'month-count'); counter.id = `month-count-${m}`;
    heading.append(titles, counter); section.append(heading);
    g.items.forEach((text, i) => {
      const row = node('div', '', 'task');
      const label = node('label', '', 'check-label');
      const check = node('input'); check.type = 'checkbox'; check.className = 'task-check'; check.id = `check-${m}-${i}`;
      label.append(check, node('span', text));
      const memoLabel = node('label', `${text} の記入欄`, 'sr-only'); memoLabel.htmlFor = `memo-${m}-${i}`;
      const memo = node('textarea'); memo.id = memoLabel.htmlFor; memo.rows = 2; memo.placeholder = '決まったこと・進み具合・相談したいこと';
      row.append(label, memoLabel, memo); section.append(row);
    });
    $('sections').append(section);
  });
  $('form-title').textContent = selectedRecipient?.title || '開業までの道のり';
  restoreDraft(); updateProgress(); $('login').hidden = true; $('workspace').hidden = false; focusWorkspace();
}
async function load() {
  const response = await api('/api/questions');
  if (response.status === 401) return false;
  if (!response.ok) throw new Error('読み込みに失敗しました。もう一度お試しください。');
  const data = await response.json();
  hearingData = data.schema === 'hearing-v1' ? data : null;
  salonQuestions = selectedRecipient?.id === 'salon' && data.schema === 'salon-status-v2' ? data.questions : null;
  configureRecipientView();
  if (hearingData) renderHearing(); else if (salonQuestions) renderSalon(); else { groups = data; render(); }
  return true;
}
$('show-password').addEventListener('click', () => {
  const show = $('password').type === 'password';
  $('password').type = show ? 'text' : 'password';
  $('show-password').textContent = show ? 'パスワードを隠す' : 'パスワードを表示';
  $('show-password').setAttribute('aria-pressed', String(show));
});
$('login-form').addEventListener('submit', async event => {
  event.preventDefault(); $('login-button').disabled = true; $('login-form').setAttribute('aria-busy', 'true'); $('login-error').textContent = '';
  try {
    const response = await api('/api/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({password: $('password').value.trim()})});
    if (!response.ok) { const result = await response.json(); throw new Error(result.error); }
    $('password').value = ''; $('password').type = 'password'; $('show-password').textContent = 'パスワードを表示'; $('show-password').setAttribute('aria-pressed', 'false');
    if (!await load()) throw new Error('セッションを確認できませんでした。再度ログインしてください。');
  } catch (error) { $('login-error').textContent = error.message || '接続できませんでした。'; }
  finally { $('login-button').disabled = false; $('login-form').removeAttribute('aria-busy'); }
});
$('workspace').addEventListener('input', () => { dirty = true; $('copy-status').textContent = ''; $('fallback').hidden = true; updateProgress(); saveDraft(); });
function answerText() {
  if (hearingData) return hearingAnswerText();
  if (salonQuestions) return salonAnswerText();
  const lines = [selectedRecipient?.title || 'サロン開業準備チェックリスト', ...(selectedRecipient ? [`宛先：${selectedRecipient.label}`] : []), `お名前：${$('name').value.trim() || '未記入'}`, ''];
  groups.forEach((g, m) => {
    lines.push(`${g.month}｜${g.title}`);
    g.items.forEach((text, i) => {
      lines.push(`${$(`check-${m}-${i}`).checked ? '☑' : '☐'} ${text}`);
      const memo = $(`memo-${m}-${i}`).value.trim();
      if (memo) lines.push(`  記入：${memo.replace(/\n/g, '\n  ')}`);
    }); lines.push('');
  });
  lines.push('全体のメモ・相談したいこと', $('overall').value.trim() || '未記入');
  return lines.join('\n');
}
$('copy').addEventListener('click', async () => {
  const text = answerText();
  try {
    await navigator.clipboard.writeText(text); dirty = false;
    $('copy-status').textContent = 'コピーしました。メッセージに貼り付けて送ってください。'; $('fallback').hidden = true;
  } catch {
    $('export-text').value = text; $('fallback').hidden = false; $('export-text').focus(); $('export-text').select();
    $('copy-status').textContent = '自動コピーを利用できません。下のテキストを選択してコピーしてください。';
  }
});
$('logout').addEventListener('click', async () => {
  if (dirty && !confirm('ブラウザーに保存できていない回答があります。画面の回答を消してログアウトしますか？')) return;
  try {
    const response = await api('/api/logout', {method: 'POST'});
    if (!response.ok) throw new Error();
    groups = []; salonQuestions = null; hearingData = null; dirty = false; $('sections').replaceChildren(); $('months').replaceChildren();
    $('name').value = ''; $('overall').value = ''; $('export-text').value = ''; $('fallback').hidden = true; $('copy-status').textContent = '';
    $('workspace').hidden = true; $('login').hidden = false; $('password').focus();
  } catch { $('copy-status').textContent = 'ログアウトできませんでした。接続を確認してください。'; }
});
$('clear-draft').addEventListener('click', () => {
  if (!confirm('このブラウザーに保存した回答と、現在の入力内容を削除しますか？')) return;
  try {
    if (selectedRecipient?.id === 'salon') {
      localStorage.removeItem('salon-opening-plan:2026-11:v1');
    }
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    $('save-status').textContent = '保存データを削除できませんでした。ブラウザーのサイトデータ設定を確認してください。';
    return;
  }
  $('name').value = ''; $('overall').value = '';
  if (hearingData) {
    document.querySelectorAll('.hearing-answer, .hearing-summary').forEach(el => { el.value = ''; });
  } else if (salonQuestions) {
    document.querySelectorAll('.salon-choice').forEach(el => { el.checked = false; });
    salonQuestions.forEach(q => { $(`salon-memo-${q.id}`).value = ''; });
  } else groups.forEach((g, m) => g.items.forEach((text, i) => {
    $(`check-${m}-${i}`).checked = false; $(`memo-${m}-${i}`).value = '';
  }));
  $('export-text').value = ''; $('fallback').hidden = true; $('copy-status').textContent = '';
  dirty = false; updateProgress();
  $('save-status').textContent = '保存した回答を削除しました。';
});
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });

const viewTargets = [
  ['.intro .eyebrow', 'APRIL 2027 · SALON OPENING'],
  ['.intro p', '2027年4月のサロン開業に向けて、今の状況を教えてください。各質問で当てはまるものを選んでください。補足の記入は任意です。'],
  ['.summary .eyebrow', 'YOUR ANSWERS'],
  ['.closing label', '今、決められずにいること・気になっていること（任意）'],
  ['.export p', '選択した回答と記入内容をまとめてコピーできます。コピーしたテキストを、メッセージなどに貼り付けて送ってください。']
].map(([selector, salon]) => ({el: document.querySelector(selector), salon, original: document.querySelector(selector).innerHTML}));
const originalSummary = document.querySelector('.summary p').lastChild.textContent;
const originalPlaceholder = $('overall').placeholder;
function configureRecipientView() {
  viewTargets.forEach(({el, salon, original}) => { if (salonQuestions) el.textContent = salon; else el.innerHTML = original; });
  document.querySelector('.summary p').lastChild.textContent = salonQuestions ? ' 回答済み' : originalSummary;
  $('overall').placeholder = salonQuestions ? '自由にご記入ください（任意）' : originalPlaceholder;
  $('months').hidden = !!salonQuestions;
  document.querySelector('.closing').hidden = !!hearingData;
  if (hearingData) {
    document.querySelector('.intro .eyebrow').textContent = hearingData.eyebrow || 'SUMIRE · WORK IMPROVEMENT';
    document.querySelector('.intro p').textContent = `目的：${hearingData.purpose} 分かる範囲でご記入ください。`;
    document.querySelector('.summary .eyebrow').textContent = 'YOUR ANSWERS';
    document.querySelector('.summary p').lastChild.textContent = ' 回答済み';
    document.querySelector('.export p').textContent = `質問への回答と${hearingData.summaryTitle || 'ヒアリング後の整理'}をまとめてコピーできます。メッセージなどに貼り付けて共有してください。`;
  }
}
function salonValues(q) {
  return [...document.querySelectorAll(`input[name="salon-${q.id}"]:checked`)].map(el => el.value);
}
function updateSalonProgress() {
  const done = salonQuestions.filter(q => salonValues(q).length).length;
  $('count').textContent = done;
  $('total').textContent = `/ ${salonQuestions.length}`;
  $('percent').textContent = `${(salonQuestions.length ? Math.round(done / salonQuestions.length * 100) : 0)}%`;
  $('progress').style.width = $('percent').textContent;
  updateNavigation();
}
function saveSalonDraft() {
  try {
    const answers = {};
    salonQuestions.forEach(q => { answers[q.id] = {values: salonValues(q), memo: $(`salon-memo-${q.id}`).value}; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({version: 2, schema: 'salon-status-v2', name: $('name').value, overall: $('overall').value, answers}));
    dirty = false;
    $('save-status').textContent = 'このブラウザーに保存しました。';
  } catch {
    dirty = true;
    $('save-status').textContent = 'このブラウザーに保存できません。画面を閉じる前に回答をコピーしてください。';
  }
}
function renderSalon() {
  groups = [];
  $('sections').replaceChildren(); $('months').replaceChildren();
  $('name').value = ''; $('overall').value = '';
  salonQuestions.forEach((q, i) => {
    const section = node('fieldset', '', 'card salon-question'); section.id = `question-${i}`;
    section.append(node('legend', `${i + 1}. ${q.title}${q.multiple ? '【複数選択】' : ''}`));
    q.options.forEach((option, j) => {
      const label = node('label', '', 'salon-option');
      const input = node('input'); input.type = q.multiple ? 'checkbox' : 'radio';
      input.name = `salon-${q.id}`; input.id = `salon-${q.id}-${j}`;
      input.value = option; input.className = 'salon-choice';
      label.append(input, node('span', option)); section.append(label);
    });
    const label = node('label', q.id === 'region' ? '地域（任意）' : '補足（任意）');
    label.htmlFor = `salon-memo-${q.id}`;
    const memo = node('textarea'); memo.id = label.htmlFor; memo.rows = 2; memo.placeholder = '任意でご記入ください';
    const clear = node('button', '選択を解除', 'quiet clear-choice'); clear.type = 'button';
    clear.setAttribute('aria-label', `${q.title} の選択を解除`);
    clear.addEventListener('click', () => { section.querySelectorAll('.salon-choice').forEach(el => { el.checked = false; }); section.dispatchEvent(new Event('input', {bubbles: true})); });
    section.append(clear, label, memo); $('sections').append(section);
  });
  $('form-title').textContent = selectedRecipient.title;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const draft = JSON.parse(raw);
      if (draft?.version !== 2 || draft.schema !== 'salon-status-v2' || !draft.answers || typeof draft.answers !== 'object') throw new Error();
      $('name').value = typeof draft.name === 'string' ? draft.name : '';
      $('overall').value = typeof draft.overall === 'string' ? draft.overall : '';
      salonQuestions.forEach(q => {
        const answer = draft.answers[q.id];
        if (!answer || typeof answer !== 'object') return;
        const values = Array.isArray(answer.values) ? answer.values.filter(value => q.options.includes(value)) : [];
        document.querySelectorAll(`input[name="salon-${q.id}"]`).forEach(el => { el.checked = (q.multiple ? values : values.slice(0, 1)).includes(el.value); });
        $(`salon-memo-${q.id}`).value = typeof answer.memo === 'string' ? answer.memo : '';
      });
      $('save-status').textContent = 'このブラウザーに保存した回答を復元しました。';
    } else $('save-status').textContent = '入力すると、このブラウザーに自動保存されます。';
  } catch { $('save-status').textContent = '保存済みの回答を読み込めませんでした。入力内容はコピーで控えてください。'; }
  dirty = false; updateSalonProgress(); $('login').hidden = true; $('workspace').hidden = false; focusWorkspace();
}
function salonAnswerText() {
  const lines = [selectedRecipient.title, `宛先：${selectedRecipient.label}`, `お名前：${$('name').value.trim() || '未記入'}`, ''];
  salonQuestions.forEach((q, i) => {
    lines.push(`${i + 1}. ${q.title}${q.multiple ? '【複数選択】' : ''}`, `回答：${salonValues(q).join('／') || '未回答'}`);
    const memo = $(`salon-memo-${q.id}`).value.trim();
    if (memo) lines.push(`${q.id === 'region' ? '地域' : '補足'}：${memo}`);
    lines.push('');
  });
  lines.push('今、決められずにいること・気になっていること', $('overall').value.trim() || '未記入');
  return lines.join('\n');
}

async function initialize() {
  if (!window.formAPI) return load();
  $('login').hidden = true;
  $('recipient-picker').hidden = false;
  const result = await api('/api/recipients');
  if (!result.ok) throw new Error('宛先を読み込めませんでした。再読み込みしてください。');
  recipients = await result.json();
  for (const recipient of recipients) {
    const button = node('button', `${recipient.label} →`, 'recipient-button');
    button.type = 'button';
    button.addEventListener('click', async () => {
      try {
        const result = await api('/api/select', {body: JSON.stringify({id: recipient.id})});
        if (!result.ok) throw new Error('宛先を選択できませんでした。');
        selectedRecipient = recipient;
        $('login-button').firstChild.textContent = ['salon', 'sumire', 'fukushoji'].includes(recipient.id) ? '質問フォームを開く ' : 'チェックリストを開く ';
        STORAGE_KEY = recipient.storageKey;
        $('login-title').textContent = `${recipient.label}への質問`;
        $('login-error').textContent = ''; $('password').value = '';
        $('recipient-picker').hidden = true; $('login').hidden = false;
        $('back-to-recipients').hidden = false; $('password').focus();
      } catch (error) { $('recipient-error').textContent = error.message; }
    });
    $('recipient-buttons').append(button);
  }
}
$('back-to-recipients').addEventListener('click', async () => {
  await api('/api/logout', {method: 'POST'});
  selectedRecipient = null; $('password').value = ''; $('login-error').textContent = '';
  $('login').hidden = true; $('recipient-picker').hidden = false;
});
initialize().catch(error => {
  (window.formAPI ? $('recipient-error') : $('login-error')).textContent = error.message;
});


function incompleteControls() {
  if (hearingData) return [...document.querySelectorAll('.hearing-answer')].filter(el => !el.value.trim());
  if (salonQuestions) return salonQuestions.filter(q => !salonValues(q).length).map(q => document.querySelector(`input[name="salon-${q.id}"]`));
  return [...document.querySelectorAll('.task-check')].filter(el => !el.checked);
}
function updateNavigation() {
  const remaining = incompleteControls().length;
  const noun = salonQuestions || hearingData ? '未回答' : '未完了';
  $('next-status').textContent = remaining ? `${noun} あと${remaining}件 · 途中で閉じても続きから入力できます` : 'すべて入力できました。回答をコピーして共有できます。';
  $('next-incomplete').textContent = remaining ? `${noun}へ進む ↓` : '回答を確認・共有 ↗';
  document.querySelector('.track').setAttribute('aria-valuenow', String(parseInt($('percent').textContent, 10) || 0));
  document.querySelectorAll('.salon-question').forEach(section => {
    const answered = !!section.querySelector('.salon-choice:checked');
    section.classList.toggle('is-answered', answered);
    section.querySelector('.clear-choice').disabled = !answered;
  });
  document.querySelectorAll('.task').forEach(row => row.classList.toggle('is-answered', row.querySelector('.task-check').checked));
}
function focusWorkspace() {
  $('form-title').tabIndex = -1;
  $('form-title').focus({preventScroll: true});
  window.scrollTo({top: 0, behavior: 'instant'});
}
$('next-incomplete').addEventListener('click', () => {
  const controls = incompleteControls();
  const target = controls.find(el => el.getBoundingClientRect().top > 180) || controls[0] || $('copy');
  target.focus({preventScroll: true});
  target.scrollIntoView({block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
});

function hearingQuestions() { return hearingData.sections.flatMap(section => section.items); }
function saveHearingDraft() {
  try {
    const answers = Object.fromEntries(hearingQuestions().map(q => [q.id, $(`hearing-${q.id}`).value]));
    const summary = hearingData.summary.map((_, i) => $(`hearing-summary-${i}`).value);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({version: 1, schema: 'hearing-v1', name: $('name').value, answers, summary}));
    dirty = false; $('save-status').textContent = 'このブラウザーに保存しました。';
  } catch {
    dirty = true; $('save-status').textContent = 'このブラウザーに保存できません。画面を閉じる前に回答をコピーしてください。';
  }
}
function updateHearingProgress() {
  const questions = hearingQuestions();
  const done = questions.filter(q => $(`hearing-${q.id}`).value.trim()).length;
  $('count').textContent = done; $('total').textContent = `/ ${questions.length}`;
  const percent = questions.length ? Math.round(done / questions.length * 100) : 0;
  $('percent').textContent = `${percent}%`; $('progress').style.width = `${percent}%`;
  document.querySelectorAll('.hearing-item').forEach(row => row.classList.toggle('is-answered', !!row.querySelector('textarea').value.trim()));
  updateNavigation();
}
function renderHearing() {
  groups = []; $('sections').replaceChildren(); $('months').replaceChildren();
  $('name').value = ''; $('overall').value = ''; dirty = false;
  function addSection(title, id) {
    const section = node('section', '', 'card month'); section.id = id;
    const heading = node('h2', title); section.append(heading); $('sections').append(section);
    const link = node('a', title); link.href = `#${id}`; $('months').append(link);
    return section;
  }
  hearingData.sections.forEach((group, i) => {
    const section = addSection(`${i + 1}. ${group.title}`, `hearing-section-${i}`);
    group.items.forEach(q => {
      const row = node('div', '', 'hearing-item');
      const label = node('label', q.title); label.htmlFor = `hearing-${q.id}`;
      const answer = node('textarea'); answer.id = label.htmlFor; answer.className = 'hearing-answer'; answer.rows = 4;
      answer.placeholder = '回答をご記入ください（分かる範囲で構いません）';
      row.append(label);
      if (q.prompts?.length) {
        const prompts = node('ul', '', 'hint'); prompts.id = `hearing-hints-${q.id}`;
        q.prompts.forEach(text => prompts.append(node('li', text)));
        answer.setAttribute('aria-describedby', prompts.id); row.append(prompts);
      }
      row.append(answer); section.append(row);
    });
  });
  const summary = addSection(hearingData.summaryTitle || 'ヒアリング後の整理', 'hearing-summary');
  summary.append(node('p', hearingData.summaryHelp || 'ヒアリング後に記入する欄です。質問の回答数には含まれません。', 'hint'));
  hearingData.summary.forEach((title, i) => {
    const label = node('label', title); label.htmlFor = `hearing-summary-${i}`;
    const answer = node('textarea'); answer.id = label.htmlFor; answer.rows = 3; answer.className = 'hearing-summary'; answer.placeholder = hearingData.summaryPlaceholder || '整理した内容をご記入ください'; summary.append(label, answer);
  });
  if (hearingData.note) summary.append(node('p', `※${hearingData.note}`, 'hint'));
  $('form-title').textContent = selectedRecipient.title;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const draft = JSON.parse(raw);
      if (draft.schema !== 'hearing-v1' || draft.version !== 1 || !draft.answers || typeof draft.answers !== 'object') throw new Error();
      $('name').value = typeof draft.name === 'string' ? draft.name : '';
      hearingQuestions().forEach(q => { $(`hearing-${q.id}`).value = typeof draft.answers[q.id] === 'string' ? draft.answers[q.id] : ''; });
      hearingData.summary.forEach((_, i) => { $(`hearing-summary-${i}`).value = typeof draft.summary?.[i] === 'string' ? draft.summary[i] : ''; });
      $('save-status').textContent = 'このブラウザーに保存した回答を復元しました。';
    } else $('save-status').textContent = '入力すると、このブラウザーに自動保存されます。';
  } catch { $('save-status').textContent = '保存済みの回答を読み込めませんでした。入力内容はコピーで控えてください。'; }
  updateHearingProgress(); $('login').hidden = true; $('workspace').hidden = false; focusWorkspace();
}
function hearingAnswerText() {
  const lines = [selectedRecipient.title, `目的：${hearingData.purpose}`, `お名前：${$('name').value.trim() || '未記入'}`, ''];
  hearingData.sections.forEach((group, i) => {
    lines.push(`${i + 1}. ${group.title}`, '');
    group.items.forEach(q => lines.push(q.title, ...(q.prompts || []).map(text => `・${text}`), `回答：${$(`hearing-${q.id}`).value.trim() || '未回答'}`, ''));
  });
  lines.push(hearingData.summaryTitle || 'ヒアリング後の整理', '');
  hearingData.summary.forEach((title, i) => lines.push(`${title}：`, $(`hearing-summary-${i}`).value.trim() || '未記入', ''));
  if (hearingData.note) lines.push(`※${hearingData.note}`);
  return lines.join('\n');
}
