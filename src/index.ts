import { setupWizard } from './wizard';
import { loadCatalog, stationText } from './equipment';
const sample = document.querySelector<HTMLElement>('#sample')!;
const status = document.querySelector<HTMLElement>('#status')!;
const button = (id: string) => document.querySelector<HTMLButtonElement>('#' + id)!;
let step = 0;
const catalog = loadCatalog();
const machines = document.querySelector<HTMLSelectElement>('#machines')!;
for (const machine of catalog) machines.add(new Option(machine.name, machine.id));
if (!catalog.length) machines.add(new Option('Nenhuma máquina cadastrada',''));
machines.disabled = button('preview').disabled = !catalog.length;
setupWizard(catalog);
machines.onchange = () => { step = 0; if (!sample.hidden) preview(); };
function preview(tab = 0, feedback = '') {
  const machine = catalog.find(item => item.id === machines.value);
  if (!machine) return;
  sample.hidden = false;
  sample.replaceChildren();
  const title = document.createElement('h2');
  title.textContent = machine.name;
  sample.append(title);
  function control(label: string, action: () => void) {
    const el = document.createElement('button');
    el.textContent = label;
    el.onclick = action;
    sample.append(el);
    return el;
  }
  ['Informações', 'Diagnóstico', 'Manutenção'].forEach((label,i) => {
    const tabButton = control(label, () => {
      preview(i);
      sample.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    });
    tabButton.setAttribute('aria-pressed', String(i === tab));
  });
  const paragraph = document.createElement('p');
  paragraph.textContent = stationText(machine, tab, step, feedback);
  sample.append(paragraph);
  if (tab === 1) machine.quiz?.choices.forEach((label,i) => control(label, () => preview(1,machine.quiz!.feedback[i])));
  if (tab === 2 && step > 0) control('Anterior', () => { step--; preview(2); });
  if (tab === 2 && step < machine.steps.length-1) control('Próximo', () => { step++; preview(2); });
  control('Fechar', () => { sample.hidden = true; button('preview').focus(); });
}
button('preview').onclick = () => { step = 0; preview(); sample.focus(); };
async function start() {
  if (!catalog.length) { status.textContent = 'Cadastre a primeira máquina para começar.'; return; }
  if (!navigator.xr || !await navigator.xr.isSessionSupported('immersive-ar')) {
    status.textContent = 'Realidade mista indisponível. Explore as três abas na prévia desktop.';
    return;
  }
  const { setup } = await import('./xr');
  const launch = await setup(catalog);
  for (const id of ['admin','visitor']) {
    button(id).disabled = false;
    button(id).onclick = () => {
      status.textContent = 'Autorize a sessão no navegador. Se a sala não abrir, confira a permissão e tente novamente.';
      launch(id === 'admin');
    };
  }
  status.textContent = 'Em Posicionar no ambiente, fixe cada placa com o gatilho direito, na ordem do catálogo. Depois, entregue o visor ao visitante na mesma sessão. O acesso direto de visitante distribui as placas em posições de demonstração.';
}
start().catch(() => { status.textContent = 'Não foi possível iniciar a cena. Verifique HTTPS e o acesso à rede ou use a prévia desktop.'; });

