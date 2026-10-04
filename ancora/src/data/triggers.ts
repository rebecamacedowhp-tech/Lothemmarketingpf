export type TriggerCategory =
  | 'relacional'
  | 'interno'
  | 'corpo'
  | 'ambiente'
  | 'rotina'

export type Trigger = {
  id: string
  label: string
  category: TriggerCategory
  note?: string
  createdAt: string
}

export const triggerCategories: {
  id: TriggerCategory
  label: string
  color: string
  hint: string
}[] = [
  {
    id: 'relacional',
    label: 'Relacional',
    color: '#9b4a3c',
    hint: 'Rejeição, abandono, brigas, silêncio de alguém',
  },
  {
    id: 'interno',
    label: 'Interno',
    color: '#5a3d5c',
    hint: 'Pensamentos, memórias, autocrítica, vazio',
  },
  {
    id: 'corpo',
    label: 'Corpo',
    color: '#2f5f7a',
    hint: 'Sono ruim, fome, dor, TPM, remédio esquecido',
  },
  {
    id: 'ambiente',
    label: 'Ambiente',
    color: '#3d6b4f',
    hint: 'Barulho, multidão, lugar específico, redes sociais',
  },
  {
    id: 'rotina',
    label: 'Rotina',
    color: '#6a4f2d',
    hint: 'Trabalho, provas, contas, mudanças de planos',
  },
]

export const triggerSuggestions: { label: string; category: TriggerCategory }[] = [
  { label: 'Mensagem não respondida', category: 'relacional' },
  { label: 'Sentir que fui rejeitada(o)', category: 'relacional' },
  { label: 'Discussão com alguém próximo', category: 'relacional' },
  { label: 'Medo de abandono', category: 'relacional' },
  { label: 'Crítica ou feedback negativo', category: 'relacional' },
  { label: 'Sensação de vazio', category: 'interno' },
  { label: 'Pensamentos de autocrítica', category: 'interno' },
  { label: 'Lembrança de algo difícil', category: 'interno' },
  { label: 'Comparação com outras pessoas', category: 'interno' },
  { label: 'Dormi mal', category: 'corpo' },
  { label: 'Estou sem comer há horas', category: 'corpo' },
  { label: 'Esqueci a medicação', category: 'corpo' },
  { label: 'TPM / alterações hormonais', category: 'corpo' },
  { label: 'Dor física ou cansaço extremo', category: 'corpo' },
  { label: 'Barulho ou ambiente lotado', category: 'ambiente' },
  { label: 'Muito tempo em redes sociais', category: 'ambiente' },
  { label: 'Estar sozinha(o) em casa', category: 'ambiente' },
  { label: 'Sobrecarga de trabalho', category: 'rotina' },
  { label: 'Mudança de planos de última hora', category: 'rotina' },
  { label: 'Problemas com dinheiro', category: 'rotina' },
]

export const emotionOptions = [
  'Raiva',
  'Medo',
  'Tristeza',
  'Vergonha',
  'Culpa',
  'Ansiedade',
  'Vazio',
  'Desespero',
  'Ciúme',
  'Alívio',
]

export const impulseOptions = [
  'Gritar ou brigar',
  'Sumir / me isolar',
  'Mandar mensagem impulsiva',
  'Terminar relação',
  'Me machucar',
  'Beber ou usar algo',
  'Comprar por impulso',
  'Comer compulsivamente',
  'Abandonar compromisso',
]
