import { printer } from './equipment';
const sample = document.querySelector<HTMLElement>('#sample')!;
const status = document.querySelector<HTMLElement>('#status')!;
const button = (id: string) => document.querySelector<HTMLButtonElement>('#' + id)!;
let step = 0;
function preview(tab = 0, feedback = '') {
  sample.hidden = false;
  sample.replaceChildren();
  const title = document.createElement('h2');
  title.textContent = printer.name;
  sample.append(title);
  function control(label: string, action: () => void) {
    const el = document.createElement('button');
    el.textContent = label;
    el.onclick = action;
    sample.append(el);
  }
  ['Informações', 'Diagnóstico', 'Manutenção'].forEach((label,i) => control(label, () => preview(i)));
  const paragraph = document.createElement('p');
  paragraph.textContent = [printer.description, feedback || printer.scenario, (step+1) + '/3 · ' + printer.steps[step]][tab];
  sample.append(paragraph);
  if (tab === 1) printer.choices.forEach((label,i) => control(label, () => preview(1,printer.feedback[i])));
  if (tab === 2 && step > 0) control('Anterior', () => { step--; preview(2); });
  if (tab === 2 && step < printer.steps.length-1) control('Próximo', () => { step++; preview(2); });
  control('Fechar', () => { sample.hidden = true; });
}
button('preview').onclick = () => preview();
async function start() {
  if (!navigator.xr || !await navigator.xr.isSessionSupported('immersive-ar')) {
    status.textContent = 'Realidade mista indisponível. Explore as três abas na prévia desktop.';
    return;
  }
  const { setup } = await import('./xr');
  const launch = await setup();
  for (const id of ['admin','visitor']) {
    button(id).disabled = false;
    button(id).onclick = () => {
      status.textContent = 'Autorize a sessão no navegador. Se a sala não abrir, confira a permissão e tente novamente.';
      launch(id === 'admin');
    };
  }
  status.textContent = 'Administrador: aponte o controle direito e aperte o gatilho para fixar. Entregue o visor ao visitante na mesma sessão. O acesso direto de visitante abre um marcador de exemplo.';
}
start().catch(() => { status.textContent = 'Não foi possível iniciar a cena. Verifique HTTPS e o acesso à rede ou use a prévia desktop.'; });

