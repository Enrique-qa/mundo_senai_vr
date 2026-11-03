import { saveCatalog, type Equipment } from './equipment';

type Pair = [string, string];
const metrics = ['Temperatura', 'Velocidade', 'Pressão', 'Tensão', 'Corrente', 'Potência', 'Vibração'];
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
  const procedure = get<HTMLInputElement>('procedure');
  const specs = get('spec-list'), readings = get('metric-list'), steps = get('step-list');
  const pages = [...form.querySelectorAll<HTMLElement>('.wizard-page')];
  let page = 0;
  let current: Equipment | undefined;
  let dirty = false;
  for (const item of catalog) selector.add(new Option(item.name, item.id));
  form.oninput = () => { dirty = true; };
  const discard = () => !dirty || confirm('Descartar as alterações desta ficha?');

  function show(index: number, focus = true) {
    page = index;
    pages.forEach((section, i) => { section.hidden = i !== page; });
    form.querySelectorAll('.wizard-progress li').forEach((li,i) => {
      if (i === page) li.setAttribute('aria-current','step');
      else li.removeAttribute('aria-current');
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
  function refreshSteps() {
    [...steps.children].forEach((row,i) => {
      row.querySelector('span')!.textContent = 'Etapa ' + (i+1);
      const buttons = row.querySelectorAll('button');
      buttons[0].disabled = i===0;
      buttons[1].disabled = i===steps.children.length-1;
    });
  }
  function addStep(text = '', focus = false) {
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
      refreshSteps();
      input.focus();
    };
    row.append(label,makeButton('Subir',()=>move(false)),makeButton('Descer',()=>move(true)),
      makeButton('Remover',()=>{ row.remove(); dirty = true; refreshSteps(); }));
    steps.append(row);
    refreshSteps();
    if (focus) input.focus();
  }

  function load() {
    current = catalog.find(item => item.id === selector.value);
    name.value = current?.name ?? '';
    procedure.value = current?.procedure ?? '';
    specs.replaceChildren(); readings.replaceChildren(); steps.replaceChildren();
    for (const pair of legacyPairs(current?.info ?? '',false)) addPair(specs,pair);
    for (const pair of legacyPairs(current?.readings ?? '',true)) addPair(readings,pair);
    for (const step of current?.steps ?? []) addStep(step);
    if (!specs.childElementCount) addPair(specs);
    if (!readings.childElementCount) addPair(readings);
    if (!steps.childElementCount) addStep();
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
    if (page === 2 && procedure.value.trim() && ![...steps.querySelectorAll('textarea')].some(input=>input.value.trim())) {
      if (!steps.childElementCount) addStep();
      target = steps.querySelector('textarea');
      message = 'Adicione pelo menos uma etapa para este procedimento.';
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
  get('add-step').onclick = () => { addStep('',true); dirty = true; };
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
    if (!valid()) return;
    if (page < 2) { show(page+1); return; }
    const machine: Equipment = { ...current, id: current?.id ?? crypto.randomUUID(), name: name.value.trim(),
      info: lines(specs), readings: lines(readings), procedure: procedure.value.trim(),
      steps: [...steps.querySelectorAll('textarea')].map(input=>input.value.trim()).filter(Boolean) };
    persist(current ? catalog.map(item=>item.id===machine.id ? machine : item) : [...catalog,machine]);
  };
}
