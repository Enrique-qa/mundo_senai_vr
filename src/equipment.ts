export interface Procedure { title: string; steps: string[] }
export interface Equipment {
  kind?: 'machine' | 'part';
  operatingStatus?: 'Ativo' | 'Inativo';
  diagnosticFields?: {key:string; value:string}[];
  id: string;
  name: string;
  info: string;
  readings: string;
  procedure: string;
  steps: string[];
  procedures?: Procedure[];
  photo?: string;
  quiz?: { question: string; choices: string[]; feedback: string[] };
}

const initialCatalog: Equipment[] = [
  {
    "operatingStatus": "Inativo",
    "readings": "Defeito simulado: Bico parcialmente obstruído, causando extrusão irregular.",
    "procedure": "",
    "steps": [],
    "id": "bambu-a1",
    "kind": "machine",
    "name": "Bambu Lab A1",
    "info": "Tipo: Impressora 3D\nFabricante: Bambu Lab\nModelo: A1",
    "diagnosticFields": [
      {
        "key": "Defeito simulado",
        "value": "Bico parcialmente obstruído, causando extrusão irregular."
      }
    ]
  },
  {
    "operatingStatus": "Inativo",
    "readings": "",
    "procedure": "",
    "steps": [],
    "id": "fonte-kp517",
    "kind": "part",
    "name": "Fonte de computador KP-517",
    "info": "Modelo: KP-517\nPotência informada: 200 W\nTipo: Fonte de computador"
  },
  {
    "operatingStatus": "Inativo",
    "readings": "",
    "procedure": "",
    "steps": [],
    "id": "watercooler-corsair",
    "kind": "part",
    "name": "Watercooler Corsair",
    "info": "Fabricante: Corsair\nModelo: A confirmar\nTipo: Sistema de refrigeração líquida"
  },
  {
    "operatingStatus": "Inativo",
    "readings": "",
    "procedure": "",
    "steps": [],
    "id": "positivo-pih77cm",
    "kind": "part",
    "name": "Placa-mãe Positivo POS-PIH77CM",
    "info": "Fabricante: Positivo\nModelo: POS-PIH77CM\nSoquete: LGA1155\nMemória compatível: DDR3\nChipset: Intel H77"
  },
  {
    "operatingStatus": "Inativo",
    "readings": "",
    "procedure": "",
    "steps": [],
    "id": "ram-4gb-ddr3",
    "kind": "part",
    "name": "Memória RAM 4 GB",
    "info": "Capacidade: 4 GB\nPadrão: DDR3 (confirmar na etiqueta)\nPlaca de referência: Positivo POS-PIH77CM\nFabricante e frequência: A confirmar"
  },
  {
    "operatingStatus": "Inativo",
    "readings": "",
    "procedure": "",
    "steps": [],
    "id": "notebook-la6901p",
    "kind": "part",
    "name": "Placa-mãe de notebook P5WEO LA-6901P",
    "info": "Identificação informada: P5WEO LA-6901P (a confirmar)\nTipo: Placa-mãe de notebook\nSoquete e memória: A confirmar"
  },
  {
    "operatingStatus": "Inativo",
    "readings": "",
    "procedure": "",
    "steps": [],
    "id": "notebook-mv0s",
    "kind": "part",
    "name": "Placa-mãe de notebook TPTS MV-0S",
    "info": "Inscrição informada: TPTS MV-0S 94V-0 (a confirmar)\nModelo: A confirmar\nTipo: Placa-mãe de notebook\nSoquete e memória: A confirmar"
  },
  {
    "operatingStatus": "Inativo",
    "readings": "",
    "procedure": "",
    "steps": [],
    "id": "ams-lite",
    "kind": "part",
    "name": "Bambu Lab AMS lite",
    "info": "Fabricante: Bambu Lab\nModelo: AMS lite\nEquipamento associado: Bambu Lab A1\nTipo: Acessório de alimentação de filamento"
  },
  {
    "operatingStatus": "Inativo",
    "readings": "",
    "procedure": "",
    "steps": [],
    "id": "cooler-notebook",
    "kind": "part",
    "name": "Cooler de processador de notebook",
    "info": "Tipo: Cooler de processador de notebook\nFabricante e modelo: A confirmar\nCompatibilidade: A confirmar"
  }
];

const key = 'senai-xray.catalog.v2';
export function loadCatalog(): Equipment[] {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null) {
      saveCatalog(initialCatalog);
      localStorage.removeItem('senai-xray.catalog.v1');
      return initialCatalog;
    }
    const data = JSON.parse(saved);
    if (Array.isArray(data) && data.every(item => item && ['id','name','info','readings','procedure'].every(k => typeof item[k] === 'string') && Array.isArray(item.steps) && item.steps.every((s: unknown) => typeof s === 'string') && (!item.quiz || (typeof item.quiz.question === 'string' && Array.isArray(item.quiz.choices) && Array.isArray(item.quiz.feedback))))) return data;
  } catch { /* Storage can be unavailable in a private session. */ }
  return initialCatalog;
}
export function saveCatalog(items: Equipment[]) { localStorage.setItem(key, JSON.stringify(items)); }
export function kindLabel(item: Equipment) { return item.kind === 'part' ? 'Peça' : 'Máquina'; }
export function proceduresFor(machine: Equipment): Procedure[] {
  return machine.procedures ?? (machine.steps.length ? [{title: machine.procedure || 'Procedimento', steps: machine.steps}] : []);
}

function savedFields(machine: Equipment, tab: number) {
  if (tab === 1 && machine.diagnosticFields) return machine.diagnosticFields;
  return (tab === 0 ? machine.info.split('\n') : machine.readings.split(/\n| \| /)).filter(Boolean).map(line => {
    const colon = line.indexOf(':');
    return colon < 0 ? {key:'Observação',value:line} : {key:line.slice(0,colon),value:line.slice(colon+1).trim()};
  });
}

export function legacyStatus(field: {key:string; value:string}) {
  return field.key.trim().toLowerCase() === 'status' && /^(ativo|inativo)$/i.test(field.value.trim());
}
export function operatingStatus(machine?: Equipment) {
  if (machine?.operatingStatus) return machine.operatingStatus;
  const previous = machine && savedFields(machine,1).find(legacyStatus);
  return previous?.value.trim().toLowerCase() === 'inativo' ? 'Inativo' : 'Ativo';
}
export function fieldsFor(machine: Equipment, tab: number) {
  if (tab !== 1) return savedFields(machine,tab);
  const status = {key:'Status',value:operatingStatus(machine)};
  if (machine.kind === 'part') return [status];
  const readings = savedFields(machine,1).filter(field=>!legacyStatus(field)).map(field=>
    field.key.trim().toLowerCase() === 'status' ? {...field,key:'Observação de status'} : field);
  return [status,...readings];
}
