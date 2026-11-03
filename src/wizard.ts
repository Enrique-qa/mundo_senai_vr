import { saveCatalog, proceduresFor, type Equipment, type Procedure } from './equipment';

type Pair = [string, string];
const metrics = ['Temperatura', 'Velocidade', 'Pressão', 'Tensão', 'Corrente', 'Potência', 'Vibração', 'Status', 'Problema'];
const hints = ['Ex.: 42 °C', 'Ex.: 800 rpm', 'Ex.: 6 bar', 'Ex.: 220 V', 'Ex.: 2 A', 'Ex.: 500 W', 'Ex.: 3 mm/s'];

function legacyPairs(raw: string, readings: boolean): Pair[] {
  return raw.split(readings ? /\n| \| / : /\n/).filter(Boolean).map(line => {
    const colon = line.indexOf(':');
    return colon < 0 ? ['', line] : [line.slice(0,colon).trim(), line.slice(colon+1).trim()];
  });
}

function makeButton(text: string, action: () => void) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.onclick = action;
  return button;
}

function labeled(row: HTMLElement, text: string, control: HTMLElement) {
  const label = document.createElement('label');
  label.textContent = text;
  label.append(control);
  row.append(label);
}

export function setupWizard(catalog: Equipment[]) {
  const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const form = get<HTMLFormElement>('editor');
  const selector = get<HTMLSelectElement>('edit-machine');
  const name = get<HTMLInputElement>('machine-name');
  const procedures = get('procedures');
  const specs = get('spec-list'), readings = get('metric-list');
  const pages = [...form.querySelectorAll<HTMLElement>('.wizard-page')];
  const navigation = [...form.querySelectorAll<HTMLButtonElement>('.wizard-progress button')];
  navigation.forEach((button,i) => { button.onclick = () => show(i); });
  let page = 0;
  let current: Equipment | undefined;
  let dirty = false;
  for (const item of catalog) selector.add(new Option(item.name, item.id));
  form.oninput = () => { dirty = true; };
  const discard = () => !dirty || confirm('Descartar as alterações desta ficha?');

  function show(index: number, focus = true) {
    page = index;
    pages.forEach((section, i) => { section.hidden = i !== page; });
    navigation.forEach((button,i) => {
      if (i === page) button.setAttribute('aria-current','step');
      else button.removeAttribute('aria-current');
    });
    get('back').hidden = page === 0;
    get('advance').textContent = page === 2 ? 'Salvar máquina' : 'Continuar';
    if (focus) pages[page].querySelector('h3')?.focus();
  }

  function addPair(list: HTMLElement, pair: Pair = ['', ''], focus = false) {
    const isMetric = list === readings;
    const row = document.createElement('div');
    row.className = 'pair-row';
    if (!pair[0] && pair[1]) row.dataset.note = 'true';
    const key = document.createElement('input');
    key.className = 'pair-key';
    key.value = pair[0];
    key.placeholder = isMetric ? 'Ex.: Fluxo de ar' : 'Ex.: Série ou voltagem';
    const value = document.createElement('input');
    value.className = 'pair-value';
    value.value = pair[1];
    value.placeholder = isMetric ? 'Valor e unidade' : 'Ex.: Plus ou 220 V';
    if (isMetric) {
      const choice = document.createElement('select');
      choice.add(new Option('Escolha uma leitura', ''));
      for (const metric of metrics) choice.add(new Option(metric,metric));
      choice.add(new Option('Outra leitura…','custom'));
      choice.value = metrics.includes(pair[0]) ? pair[0] : pair[0] || pair[1] ? 'custom' : '';
      labeled(row, 'Leitura', choice);
      labeled(row, 'Nome da leitura', key);
      const update = () => {
        key.parentElement!.hidden = choice.value !== 'custom';
        value.placeholder = hints[metrics.indexOf(choice.value)] ?? 'Valor e unidade';
      };
      choice.onchange = () => { dirty = true; update(); if (choice.value === 'custom') key.focus(); };
      update();
    } else labeled(row,'Especificação', key);
    labeled(row,isMetric ? 'Valor simulado' : 'Valor',value);
    row.append(makeButton('Remover', () => { row.remove(); dirty = true; }));
    list.append(row);
    if (focus) row.querySelector<HTMLElement>('input,select')?.focus();
  }
  function refreshSteps(steps: HTMLElement) {
    [...steps.children].forEach((row,i) => {
      row.querySelector('span')!.textContent = 'Etapa ' + (i+1);
      const buttons = row.querySelectorAll('button');
      buttons[0].disabled = i===0;
      buttons[1].disabled = i===steps.children.length-1;
    });
  }
  function addStep(steps: HTMLElement, text = '', focus = false) {
    const row = document.createElement('div');
    row.className = 'step-row';
    const label = document.createElement('label');
    const input = document.createElement('textarea');
    input.value = text;
    input.placeholder = 'Descreva uma ação do roteiro simulado';
    label.append(document.createElement('span'),input);
    const move = (down: boolean) => {
      const other = down ? row.nextElementSibling : row.previousElementSibling;
      if (!other) return;
      if (down) other.after(row); else other.before(row);
      dirty = true;
      refreshSteps(steps);
      input.focus();
    };
    row.append(label,makeButton('Subir',()=>move(false)),makeButton('Descer',()=>move(true)),
      makeButton('Remover',()=>{ row.remove(); dirty = true; refreshSteps(steps); }));
    steps.append(row);
    refreshSteps(steps);
    if (focus) input.focus();
  }

  function addProcedure(item: Procedure = {title:'', steps:[]}) {
    const box = document.createElement('fieldset');
    const title = document.createElement('input');
    title.value = item.title;
    title.placeholder = 'Ex.: inspeção da mesa';
    labeled(box,'Nome do procedimento',title);
    const entries = document.createElement('div');
    entries.className = 'steps';
    box.append(entries,makeButton('＋ Adicionar etapa',()=>{ addStep(entries,'',true); dirty = true; }),
      makeButton('Remover procedimento',()=>{ if (!title.value || confirm('Remover este procedimento da ficha?')) { box.remove(); dirty = true; } }));
    for (const step of item.steps.length ? item.steps : ['']) addStep(entries,step);
    procedures.append(box);
    return title;
  }
  let photo = '';
  const file = get<HTMLInputElement>('photo-file');
  const thumbnail = get<HTMLImageElement>('photo-preview');
  let revision = 0;
  function setPhoto(src: string) {
    revision++;
    photo = src; file.value = ''; file.setCustomValidity('');
    if (src) thumbnail.src = src; else thumbnail.removeAttribute('src');
    thumbnail.hidden = get('clear-photo').hidden = !src;
    get<HTMLButtonElement>('advance').disabled = false;
  }
  file.onchange = async () => {
    const selected = file.files?.[0]; if (!selected) return;
    const token = ++revision;
    get<HTMLButtonElement>('advance').disabled = true;
    try {
      const bitmap = await createImageBitmap(selected);
      const ratio = Math.min(1,640/Math.max(bitmap.width,bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1,Math.round(bitmap.width*ratio)); canvas.height = Math.max(1,Math.round(bitmap.height*ratio));
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#111725'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(bitmap,0,0,canvas.width,canvas.height); bitmap.close();
      if (token === revision) { setPhoto(canvas.toDataURL('image/jpeg',0.78)); dirty = true; }
    } catch {
      if (token === revision) { file.value = ''; get('edit-status').textContent = 'Não foi possível abrir a imagem. Selecione um arquivo JPG, PNG ou WebP.'; }
    } finally { if (token === revision) get<HTMLButtonElement>('advance').disabled = false; }
  };
  get('clear-photo').onclick = () => { setPhoto(''); dirty = true; };
  function load() {
    current = catalog.find(item => item.id === selector.value);
    name.value = current?.name ?? '';
    procedures.replaceChildren(); specs.replaceChildren(); readings.replaceChildren();
    for (const p of current ? proceduresFor(current) : []) addProcedure(p);
    if (!procedures.childElementCount) addProcedure();
    setPhoto(current?.photo ?? '');
    get<HTMLInputElement>('question').value = current?.quiz?.question ?? '';
    for (let i=0;i<2;i++) {
      get<HTMLInputElement>('choice'+i).value = current?.quiz?.choices[i] ?? '';
      get<HTMLInputElement>('reply'+i).value = current?.quiz?.feedback[i] ?? '';
    }
    get<HTMLDetailsElement>('quiz-editor').open = !!current?.quiz;
    for (const pair of legacyPairs(current?.info ?? '',false)) addPair(specs,pair);
    for (const pair of legacyPairs(current?.readings ?? '',true)) addPair(readings,pair);
    if (!specs.childElementCount) addPair(specs);
    if (!readings.childElementCount) addPair(readings);
    get('remove').hidden = !current;
    get('edit-status').textContent = '';
    dirty = false;
    show(0,false);
  }
  function pairs(list: HTMLElement) {
    return [...list.children].map(row => {
      const choice = row.querySelector('select')?.value;
      const key = choice === 'custom' || choice === undefined ? row.querySelector<HTMLInputElement>('.pair-key')!.value.trim() : choice;
      const value = row.querySelector<HTMLInputElement>('.pair-value')!.value.trim();
      return {row,key,value};
    });
  }
  function valid() {
    let target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null = null;
    let message = '';
    if (page === 0 && !name.value.trim()) { target = name; message = 'Informe o nome da máquina.'; }
    if (!target && page < 2) {
      const list = page === 0 ? specs : readings;
      for (const {row,key,value} of pairs(list)) {
        // Legacy notes without a label remain editable and round-trip verbatim.
        const legacyNote = row.hasAttribute('data-note');
        if (key && !value) { target = row.querySelector('.pair-value'); message = 'Informe o valor ou remova esta linha.'; break; }
        if (!key && value && !legacyNote) {
          const select = row.querySelector('select');
          target = select && !select.value ? select : row.querySelector('.pair-key');
          message = 'Informe o nome desta informação.'; break;
        }
      }
    }
    if (page===1 && !target) {
      const inputs = ['question','choice0','reply0','choice1','reply1'].map(id=>get<HTMLInputElement>(id));
      if (inputs.some(input=>input.value.trim())) {
        target = inputs.find(input=>!input.value.trim()) ?? null;
        if (target) { get<HTMLDetailsElement>('quiz-editor').open = true; message = 'Complete a pergunta, as alternativas e os comentários, ou deixe todos vazios.'; }
      }
    }
    if (page === 2) for (const block of procedures.querySelectorAll('fieldset')) {
      const title = block.querySelector('input')!;
      const entries = [...block.querySelectorAll('textarea')];
      if (entries.some(input=>input.value.trim()) && !title.value.trim()) {
        target = title; message = 'Dê um nome ao procedimento.'; break;
      }
      if (title.value.trim() && !entries.some(input=>input.value.trim())) {
        if (!entries.length) addStep(block.querySelector('.steps')!);
        target = block.querySelector('textarea'); message = 'Adicione uma etapa ao procedimento.'; break;
      }
    }
    if (target) {
      target.setCustomValidity(message); target.reportValidity(); target.setCustomValidity('');
      return false;
    }
    return true;
  }
  function lines(list: HTMLElement) {
    return pairs(list).filter(p=>p.value).map(p=>p.key ? p.key + ': ' + p.value : p.value).join('\n');
  }
  function persist(items: Equipment[]) {
    try { saveCatalog(items); location.reload(); }
    catch { get('edit-status').textContent = 'O navegador não permitiu salvar. Sua ficha continua aberta.'; }
  }
  get('manage').onclick = () => { if (form.hidden) { form.hidden = false; load(); } selector.focus(); };
  selector.oninput = event => event.stopPropagation();
  selector.onchange = () => { if (discard()) load(); else selector.value = current?.id ?? ''; };
  get('add-spec').onclick = () => { addPair(specs,undefined,true); dirty = true; };
  get('add-metric').onclick = () => { addPair(readings,undefined,true); dirty = true; };
  get('add-procedure').onclick = () => { addProcedure().focus(); dirty = true; };
  get('back').onclick = () => show(page-1);
  get('cancel').onclick = () => {
    if (!discard()) return;
    form.hidden = true; selector.value = ''; get('manage').focus();
  };
  get('remove').onclick = () => {
    if (current && confirm('Excluir a ficha de ' + current.name + '?')) persist(catalog.filter(m=>m.id!==current!.id));
  };
  form.onsubmit = event => {
    event.preventDefault();
    // Direct navigation allows incomplete drafts. Validate all steps before saving.
    if (page === 2) {
      for (let i = 0; i < pages.length; i++) {
        show(i, false);
        if (!valid()) return;
      }
    } else if (!valid()) return;
    if (page < 2) { show(page+1); return; }
    const routes = [...procedures.querySelectorAll('fieldset')].map(block=>({
      title:block.querySelector('input')!.value.trim(),
      steps:[...block.querySelectorAll('textarea')].map(input=>input.value.trim()).filter(Boolean)
    })).filter(p=>p.steps.length);
    const question = get<HTMLInputElement>('question').value.trim();
    const quiz = question ? { question,
      choices:[0,1].map(i=>get<HTMLInputElement>('choice'+i).value.trim()),
      feedback:[0,1].map(i=>get<HTMLInputElement>('reply'+i).value.trim()) } : undefined;
    const machine: Equipment = { ...current, id: current?.id ?? crypto.randomUUID(), name: name.value.trim(),
      quiz, info: lines(specs), readings: lines(readings), photo, procedures: routes, procedure: routes[0]?.title ?? '',
      steps: routes[0]?.steps ?? [] };
    persist(current ? catalog.map(item=>item.id===machine.id ? machine : item) : [...catalog,machine]);
  };
}
