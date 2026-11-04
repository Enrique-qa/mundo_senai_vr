import { setupWizard } from './wizard';
import { loadCatalog, fieldsFor, kindLabel, proceduresFor } from './equipment';
const sample = document.querySelector<HTMLElement>('#sample')!;
const status = document.querySelector<HTMLElement>('#status')!;
const button = (id: string) => document.querySelector<HTMLButtonElement>('#' + id)!;
let step = 0;
const catalog = loadCatalog();
const machines = document.querySelector<HTMLSelectElement>('#machines')!;
for (const machine of catalog) machines.add(new Option(kindLabel(machine)+' · '+machine.name, machine.id));
if (!catalog.length) machines.add(new Option('Nenhum item cadastrado',''));
machines.disabled = button('preview').disabled = !catalog.length;
function showPlacement(placed: ReadonlySet<string>) {
  const list = document.querySelector<HTMLUListElement>('#placement-list')!;
  list.replaceChildren();
  for (const machine of catalog) {
    const row = document.createElement('li');
    row.textContent = kindLabel(machine)+' · '+machine.name + ' — ' + (placed.has(machine.id) ? 'Posicionada' : 'A posicionar');
    list.append(row);
  }
  if (!catalog.length) list.textContent = 'Nenhum item cadastrado.';
}
showPlacement(new Set());
setupWizard(catalog);
machines.onchange = () => { step = 0; if (!sample.hidden) preview(); };
function preview(tab = 0, feedback = '', route = -1) {
  const machine = catalog.find(item => item.id === machines.value);
  if (!machine) return;
  sample.hidden = false;
  sample.replaceChildren();
  function text(parent: HTMLElement, tag: string, value: string) {
    const el = document.createElement(tag); el.textContent = value; parent.append(el); return el;
  }
  function control(parent: HTMLElement, title: string, fn: () => void) {
    const el = document.createElement('button'); el.textContent = title; el.onclick = fn; parent.append(el); return el;
  }
  const tabs = machine.kind === 'part' ? ['Informações','Diagnóstico'] : ['Informações','Diagnóstico','Manutenções'];
  const routes = proceduresFor(machine);
  const selected = routes[route];
  text(sample,'small',kindLabel(machine).toUpperCase()+'   /   '+machine.name);
  text(sample,'h2',selected?.title ?? tabs[tab]);
  const body = document.createElement('div'); body.className = 'sheet-body'; sample.append(body);
  const content = document.createElement('div'); body.append(content);
  if (machine.photo) {
    const image = document.createElement('img'); image.src = machine.photo; image.alt = machine.name;
    body.append(image); body.classList.add('with-photo');
  }
  if (tab < 2) {
    if (tab === 1) text(content,'small','CENÁRIO SIMULADO');
    const grid = document.createElement('dl'); content.append(grid);
    const fields = fieldsFor(machine,tab);
    for (const f of fields) {
      const cell = document.createElement('div'); grid.append(cell);
      text(cell,'dt',f.key); text(cell,'dd',f.value);
    }
    if (!fields.length) text(content,'p','Nenhuma informação cadastrada nesta seção.');
    if (tab === 1 && machine.kind !== 'part' && machine.quiz) {
      text(content,'p',feedback || machine.quiz.question);
      machine.quiz.choices.forEach((choice,i)=>control(content,choice,()=>preview(1,machine.quiz!.feedback[i])));
    }
  } else if (selected) {
    text(content,'small','ETAPA '+(step+1)+' DE '+selected.steps.length);
    text(content,'p',selected.steps[step]);
    if (step>0) control(content,'Anterior',()=>{step--;preview(2,'',route);});
    if (step+1<selected.steps.length) control(content,'Próximo',()=>{step++;preview(2,'',route);});
    control(content,'Todos os procedimentos',()=>preview(2));
  } else {
    text(content,'small','ROTEIROS SIMULADOS');
    routes.forEach((r,i)=>control(content,r.title,()=>{step=0;preview(2,'',i);}).className='route-choice');
    if (!routes.length) text(content,'p','Nenhum procedimento cadastrado.');
  }
  const nav = document.createElement('nav'); nav.setAttribute('aria-label','Seções da ficha'); sample.append(nav);
  tabs.forEach((title,i)=>control(nav,title,()=>{preview(i);sample.querySelector<HTMLButtonElement>('[aria-pressed=true]')?.focus();}).setAttribute('aria-pressed',String(i===tab)));
  control(nav,'Fechar',()=>{sample.hidden=true;button('preview').focus();});
}
button('preview').onclick = () => { step = 0; preview(); sample.focus(); };
async function start() {
  if (!catalog.length) { status.textContent = 'Cadastre uma máquina ou peça para começar.'; return; }
  if (!navigator.xr || !await navigator.xr.isSessionSupported('immersive-ar')) {
    status.textContent = 'Realidade mista indisponível. Toque em Explorar em 2D para consultar a ficha.';
    return;
  }
  const { setup } = await import('./xr');
  const launch = await setup(catalog, showPlacement, () => {
    status.textContent = 'Você voltou ao navegador. As fichas estão salvas. Para uma nova visita, posicione as placas novamente.';
    button('admin').focus();
  });
  for (const id of ['admin','visitor']) {
    button(id).disabled = false;
    button(id).onclick = () => {
      status.textContent = 'Autorize a sessão no navegador. Se a sala não abrir, confira a permissão e tente novamente.';
      launch(id === 'admin');
    };
  }
  status.textContent = 'Em Posicionar no ambiente, escolha o item na lista, alinhe a placa e confirme com o gatilho direito. Selecione Iniciar visita para entregar o visor. No administrador, B reabre a lista. No modo visitante direto, B volta ao navegador. O acesso direto de visitante distribui as placas em posições de demonstração.';
}
start().catch(() => { status.textContent = 'Não foi possível iniciar a cena. Verifique HTTPS e o acesso à rede ou use Explorar em 2D.'; });

