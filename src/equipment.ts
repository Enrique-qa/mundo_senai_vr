export interface Equipment {
  id: string;
  name: string;
  info: string;
  readings: string;
  procedure: string;
  steps: string[];
  quiz?: { question: string; choices: string[]; feedback: string[] };
}

const demo: Equipment = {
  id: 'demo-fdm', name: 'Impressora 3D (exemplo)',
  info: 'Modelo: Lab FDM-01\nNº de série: DEMO-3D-001\nVolume útil: 220 x 220 x 250 mm\nBico: 0,4 mm\nFilamento: PLA de 1,75 mm',
  readings: 'Bico: 205 °C | Mesa: 60 °C\nMovimento: 50 mm/s | Filamento: 0 g',
  quiz: {
    question: 'O cabeçote se move, mas a camada parou de crescer. Qual leitura explica a falha?',
    choices: ['Faltou filamento', 'A peça mudou de cor'],
    feedback: ['Correto. O carretel vazio impede a formação de novas camadas.', 'Observe a massa de filamento restante.']
  },
  procedure: 'Reposição simulada de filamento',
  steps: ['Identifique o carretel vazio pela leitura de 0 g.', 'Consulte na ficha o filamento compatível.', 'Após a reposição simulada, confira a massa disponível e a formação da camada de teste.']
};

const key = 'senai-xray.catalog.v1';
export function loadCatalog(): Equipment[] {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null) return [demo];
    const data = JSON.parse(saved);
    if (Array.isArray(data) && data.every(item => item && ['id','name','info','readings','procedure'].every(k => typeof item[k] === 'string') && Array.isArray(item.steps) && item.steps.every((s: unknown) => typeof s === 'string') && (!item.quiz || (typeof item.quiz.question === 'string' && Array.isArray(item.quiz.choices) && Array.isArray(item.quiz.feedback))))) return data;
  } catch { /* Storage can be unavailable in a private session. */ }
  return [demo];
}
export function saveCatalog(items: Equipment[]) { localStorage.setItem(key, JSON.stringify(items)); }
export function stationText(machine: Equipment, tab: number, step: number, feedback: string) {
  if (tab === 0) return machine.info || 'Ficha técnica ainda não cadastrada.';
  if (tab === 1) return ['Leituras simuladas', machine.readings || 'Sem leituras cadastradas.', feedback || machine.quiz?.question].filter(Boolean).join('\n');
  if (!machine.steps.length) return 'Roteiro de manutenção ainda não cadastrado.';
  return [machine.procedure, `Etapa ${step+1} de ${machine.steps.length}`, machine.steps[step]].join('\n');
}
