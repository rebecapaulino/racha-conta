// Ícone de cada item, só para enfeitar a lista (como nos apps de referência).
// Procura palavras-chave no nome; se não achar, usa o prato genérico.

export type ItemKind =
  | 'beer' | 'cocktail' | 'wine' | 'spirit' | 'soft' | 'water' | 'coffee'
  | 'pizza' | 'burger' | 'snack' | 'meat' | 'chicken' | 'seafood' | 'salad'
  | 'pasta' | 'pudding' | 'cake' | 'candy' | 'icecream' | 'bread' | 'cheese' | 'ticket' | 'dish';

const RULES: [RegExp, ItemKind][] = [
  [/chop+|cerveja|breja|long ?neck|heineken|brahma|skol|stella/, 'beer'],
  [/caipi|drink|gin|mojito|margarita|aperol|batida/, 'cocktail'],
  [/vinho|espumante|champ/, 'wine'],
  [/whisk|dose|cacha[cç]a|vodka|tequila|rum\b/, 'spirit'],
  [/refri|coca|guaran|soda|suco|ch[aá] gelado|limonada/, 'soft'],
  [/[aá]gua/, 'water'],
  [/caf[eé]|cappuc|expresso|espresso/, 'coffee'],
  [/pizza/, 'pizza'],
  [/hamb|burger|lanche|x-/, 'burger'],
  [/frita|batata|por[cç][aã]o|petisco|mandioca|aipim/, 'snack'],
  [/picanha|carne|bife|costela|churras|maminha|fraldinha|alcatra/, 'meat'],
  [/frango|asa|coxinha|galeto/, 'chicken'],
  [/peixe|camar[aã]o|sushi|temaki|sashimi|salm[aã]o|frutos do mar/, 'seafood'],
  [/salada|verde|vegano|vegetariano/, 'salad'],
  [/massa|macarr|espaguete|lasanha|nhoque|risoto|talharim/, 'pasta'],
  [/pudim|flan/, 'pudding'],
  [/sorvete|a[cç]a[ií]|gelato|picol[eé]|casquinha|sundae/, 'icecream'],
  [/bolo|torta|cheesecake|petit gat|cupcake/, 'cake'],
  [/doce|sobremesa|brigadeiro|bala\b|balas|bombom|chocolate|brownie|mousse|trufa|beijinho|cocada|pa[cç]oca|churros|petit/, 'candy'],
  [/taxa|entrada|ingresso|couvert art/, 'ticket'],
  [/p[aã]o|couvert|torrada|bruschetta/, 'bread'],
  [/queijo|t[aá]bua|frios/, 'cheese'],
];

const EMOJI: Record<ItemKind, string> = {
  beer: '🍺', cocktail: '🍹', wine: '🍷', spirit: '🥃', soft: '🥤', water: '💧', coffee: '☕',
  pizza: '🍕', burger: '🍔', snack: '🍟', meat: '🥩', chicken: '🍗', seafood: '🍣', salad: '🥗',
  pasta: '🍝', pudding: '🍮', cake: '🍰', candy: '🍬', icecream: '🍨', bread: '🥖', cheese: '🧀', ticket: '🎟️', dish: '🍽️',
};

export function itemKind(name: string): ItemKind {
  const n = name.toLowerCase();
  for (const [re, kind] of RULES) if (re.test(n)) return kind;
  return 'dish';
}

export function itemEmoji(name: string): string {
  return EMOJI[itemKind(name)];
}
