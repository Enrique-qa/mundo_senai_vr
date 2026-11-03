export const printer = {
  name: 'Impressora 3D',
  description: 'O extrusor deposita filamento em camadas sobre a mesa. A peça cresce uma camada por vez.',
  scenario: 'Na simulação, a mesa se move, mas o carretel está vazio. Por que a peça parou de crescer?',
  choices: ['Faltou filamento', 'A peça mudou de cor'],
  feedback: ['Correto. Sem material, o movimento continua sem formar novas camadas.', 'Observe o carretel vazio. A cor por si só não explica a falta de camadas.'],
  steps: ['Observe o carretel no cenário simulado.', 'Identifique no esquema mental o caminho do filamento até o extrusor.', 'Registre a hipótese de falta de material para o instrutor.']
};

