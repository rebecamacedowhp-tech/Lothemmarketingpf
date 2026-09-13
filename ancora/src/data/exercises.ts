export type ExerciseId =
  | 'tipp'
  | 'grounding'
  | 'breathing'
  | 'stop'
  | 'soothe'
  | 'distract'

export type ExerciseMeta = {
  id: ExerciseId
  title: string
  subtitle: string
  duration: string
  when: string
  accent: string
}

export const exercises: ExerciseMeta[] = [
  {
    id: 'tipp',
    title: 'TIPP',
    subtitle: 'Mude o corpo para acalmar a mente',
    duration: '3–5 min',
    when: 'Quando a emoção está no máximo',
    accent: '#2d6a62',
  },
  {
    id: 'grounding',
    title: 'Aterramento 5-4-3-2-1',
    subtitle: 'Volte ao presente com os sentidos',
    duration: '4–6 min',
    when: 'Quando pensamentos aceleram',
    accent: '#3d6b4f',
  },
  {
    id: 'breathing',
    title: 'Respiração guiada',
    subtitle: 'Ritmo lento para o sistema nervoso',
    duration: '2–4 min',
    when: 'Em qualquer momento da crise',
    accent: '#2f5f7a',
  },
  {
    id: 'stop',
    title: 'STOP',
    subtitle: 'Pause antes de agir no impulso',
    duration: '1–2 min',
    when: 'Antes de uma ação impulsiva',
    accent: '#6a4f2d',
  },
  {
    id: 'soothe',
    title: 'Autocuidado sensorial',
    subtitle: 'Conforte o corpo com os 5 sentidos',
    duration: '3–8 min',
    when: 'Quando precisa de gentileza',
    accent: '#5a3d5c',
  },
  {
    id: 'distract',
    title: 'Distração ACCEPTS',
    subtitle: 'Desvie o foco até a onda baixar',
    duration: '5–15 min',
    when: 'Quando não dá para resolver agora',
    accent: '#3d4f6a',
  },
]

export const tippSteps = [
  {
    letter: 'T',
    name: 'Temperatura',
    detail:
      'Mude a temperatura do corpo: lave o rosto com água fria, segure um gelo ou tome um banho fresco. O choque térmico ajuda a interromper a espiral.',
  },
  {
    letter: 'I',
    name: 'Exercício intenso',
    detail:
      'Movimente o corpo por 1–2 minutos: agache, dançe, suba e desça escadas ou faça polichinelos. Gaste a energia da emoção.',
  },
  {
    letter: 'P',
    name: 'Respiração ritmada',
    detail:
      'Expire mais longo que inspire. Inspire em 4, expire em 6 ou 8. Isso ativa o freio do sistema nervoso.',
  },
  {
    letter: 'P',
    name: 'Relaxamento progressivo',
    detail:
      'Contrai um grupo muscular por 5 segundos e solte. Vá dos pés até o rosto. Sinta o contraste entre tensão e alívio.',
  },
]

export const groundingPrompts = [
  { count: 5, sense: 'veja', prompt: 'Nomeie 5 coisas que você consegue ver agora.' },
  { count: 4, sense: 'toque', prompt: 'Nomeie 4 coisas que você consegue tocar.' },
  { count: 3, sense: 'ouça', prompt: 'Nomeie 3 sons que você consegue ouvir.' },
  { count: 2, sense: 'cheire', prompt: 'Nomeie 2 cheiros (ou imagine 2 cheiros calmantes).' },
  { count: 1, sense: 'prove', prompt: 'Nomeie 1 sabor — ou tome um gole de água e descreva.' },
]

export const stopSteps = [
  {
    letter: 'S',
    title: 'Pare',
    body: 'Conggele. Não diga, não envie, não saia correndo. Só pause o movimento por alguns segundos.',
  },
  {
    letter: 'T',
    title: 'Dê um passo atrás',
    body: 'Respire. Saia um pouco da situação — mentalmente ou fisicamente. Crie espaço entre você e o impulso.',
  },
  {
    letter: 'O',
    title: 'Observe',
    body: 'O que estou sentindo? Onde está no corpo? Que pensamento está gritando? Observe sem julgar.',
  },
  {
    letter: 'P',
    title: 'Prossiga com consciência',
    body: 'O que a versão sábia de mim faria agora? Escolha a próxima ação pequena e segura.',
  },
]

export const sootheSenses = [
  {
    sense: 'Visão',
    ideas: ['Olhe uma foto que te acalma', 'Observe o céu ou uma planta', 'Luz suave, sem telas fortes'],
  },
  {
    sense: 'Audição',
    ideas: ['Música lenta', 'Som de chuva ou natureza', 'Ouça a própria respiração'],
  },
  {
    sense: 'Toque',
    ideas: ['Cobertor macio', 'Água morna nas mãos', 'Aperte um objeto firme'],
  },
  {
    sense: 'Olfato',
    ideas: ['Chá, café ou sabonete', 'Perfume leve', 'Ar fresco pela janela'],
  },
  {
    sense: 'Paladar',
    ideas: ['Chá quente', 'Hortelã ou limão', 'Algo crocante e consciente'],
  },
]

export const acceptsIdeas = [
  {
    letter: 'A',
    name: 'Atividades',
    examples: ['Organizar uma gaveta', 'Desenhar rabiscos', 'Caminhar sem destino'],
  },
  {
    letter: 'C',
    name: 'Contribuir',
    examples: ['Mandar um áudio gentil', 'Ajudar alguém em algo pequeno', 'Doar algo que não usa'],
  },
  {
    letter: 'C',
    name: 'Comparações',
    examples: ['Lembre de uma crise que você já superou', 'Compare com um momento mais difícil do passado'],
  },
  {
    letter: 'E',
    name: 'Emoções opostas',
    examples: ['Assista algo leve', 'Ouça uma música alegre', 'Leia uma cena engraçada'],
  },
  {
    letter: 'P',
    name: 'Empurrar embora',
    examples: ['Imagine a emoção como uma onda que sobe e desce', 'Repita: “isso vai passar”'],
  },
  {
    letter: 'T',
    name: 'Pensamentos',
    examples: ['Conte de 100 a 0 de 7 em 7', 'Nomeie objetos azuis na sala', 'Recite uma letra de música'],
  },
  {
    letter: 'S',
    name: 'Sensações',
    examples: ['Gelo na mão', 'Alongar o pescoço', 'Mascar chiclete com força'],
  },
]

export const crisisHelpline = {
  label: 'CVV — 188',
  note: 'Se estiver em risco imediato, ligue para serviços de emergência locais.',
}
