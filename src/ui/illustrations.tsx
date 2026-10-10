// Ilustrações do visual "fluent": formas simples sobrepostas, em três tons
// da mesma cor (a = escuro, b = médio, c = claro), com transparência onde se cruzam.
// As cores vêm do CSS (.art-berry, .art-coral, .art-amber, .art-teal).

import type { ItemKind } from './itemEmoji';

type Family = 'berry' | 'coral' | 'amber' | 'teal';

export type ArtKind =
  | 'beer' | 'glass' | 'soft' | 'coffee' | 'pizza' | 'burger' | 'snack' | 'meat'
  | 'fish' | 'pudding' | 'cake' | 'candy' | 'icecream' | 'salad' | 'ticket' | 'dish'
  | 'people' | 'receipt' | 'pie' | 'money';

const FAMILY: Record<ArtKind, Family> = {
  beer: 'amber', glass: 'coral', soft: 'berry', coffee: 'amber', pizza: 'coral',
  burger: 'amber', snack: 'amber', meat: 'berry', fish: 'coral', pudding: 'amber', cake: 'amber', candy: 'berry', icecream: 'berry',
  salad: 'teal', ticket: 'berry', dish: 'coral',
  people: 'berry', receipt: 'coral', pie: 'amber', money: 'amber',
};

const FROM_ITEM: Record<ItemKind, ArtKind> = {
  beer: 'beer', cocktail: 'glass', wine: 'glass', spirit: 'glass', soft: 'soft', water: 'soft',
  coffee: 'coffee', pizza: 'pizza', burger: 'burger', snack: 'snack', meat: 'meat', chicken: 'meat',
  seafood: 'fish', salad: 'salad', pasta: 'dish', pudding: 'pudding', cake: 'cake', candy: 'candy', icecream: 'icecream',
  bread: 'dish', cheese: 'dish', ticket: 'ticket', dish: 'dish',
};

export const artForItem = (kind: ItemKind): ArtKind => FROM_ITEM[kind];

const O = 0.88; // transparência das formas da frente

const SHAPES: Record<ArtKind, React.ReactNode> = {
  beer: (
    <>
      <rect className="a" x="25" y="19" width="12" height="14" rx="6" />
      <rect className="b" x="11" y="15" width="19" height="25" rx="4" />
      <circle className="c" cx="15" cy="15" r="5" opacity={O} />
      <circle className="c" cx="21.5" cy="12.5" r="6" opacity={O} />
      <circle className="c" cx="27" cy="15.5" r="4.5" opacity={O} />
    </>
  ),
  glass: (
    <>
      <circle className="a" cx="32" cy="12" r="6" />
      <path className="b" d="M11 13h26a13 13 0 0 1-26 0z" opacity={O} />
      <rect className="c" x="22.5" y="24" width="3" height="12" rx="1.5" />
      <rect className="a" x="15" y="35" width="18" height="5" rx="2.5" />
    </>
  ),
  soft: (
    <>
      <rect className="a" x="24" y="5" width="4" height="18" rx="2" transform="rotate(18 26 14)" />
      <path className="b" d="M13 14h22l-2.4 23.2a3 3 0 0 1-3 2.8H18.4a3 3 0 0 1-3-2.8z" opacity={O} />
      <rect className="c" x="17" y="21" width="8" height="8" rx="2.5" opacity={O} />
      <rect className="c" x="23" y="27" width="7" height="7" rx="2.5" opacity={O} />
    </>
  ),
  coffee: (
    <>
      <circle className="a" cx="33" cy="25" r="6" />
      <path className="b" d="M10 19h24v9a12 12 0 0 1-24 0z" opacity={O} />
      <rect className="c" x="7" y="37" width="30" height="5" rx="2.5" opacity={O} />
      <rect className="c" x="17" y="6" width="4" height="9" rx="2" />
      <rect className="c" x="24" y="8" width="4" height="7" rx="2" />
    </>
  ),
  pizza: (
    <>
      <path className="b" d="M24 42L9 13c9.5-5 20.5-5 30 0z" />
      <path className="a" d="M8 11.5c10-5.6 22-5.6 32 0l-2 5c-9-4.6-19-4.6-28 0z" opacity={O} />
      <circle className="c" cx="21" cy="21" r="4" opacity={O} />
      <circle className="c" cx="28.5" cy="27" r="3.2" opacity={O} />
      <circle className="c" cx="22.5" cy="31.5" r="2.4" opacity={O} />
    </>
  ),
  burger: (
    <>
      <path className="b" d="M10 22a14 11 0 0 1 28 0z" />
      <rect className="c" x="8" y="21" width="32" height="5" rx="2.5" opacity={O} />
      <rect className="a" x="10" y="25" width="28" height="7" rx="3.5" opacity={O} />
      <rect className="b" x="11" y="31" width="26" height="7" rx="3.5" opacity={O} />
    </>
  ),
  snack: (
    <>
      {/* batatas amarelas saindo do saquinho vermelho */}
      <rect className="fry-d" x="14" y="9" width="4.5" height="19" rx="2.25" transform="rotate(-12 16 18)" />
      <rect className="fry" x="20" y="5" width="4.5" height="21" rx="2.25" />
      <rect className="fry-d" x="26" y="7" width="4.5" height="20" rx="2.25" transform="rotate(8 28 17)" />
      <rect className="fry" x="31" y="11" width="4.5" height="16" rx="2.25" transform="rotate(18 33 19)" />
      <path className="box" d="M10 21h28l-3.6 17.5a2 2 0 0 1-2 1.5H15.6a2 2 0 0 1-2-1.5z" />
      <path className="box-d" d="M10 21h28l-.8 4H10.8z" />
    </>
  ),
  meat: (
    <>
      {/* bife: carne vermelha, capa de gordura em cima e marcas da chapa */}
      <path className="meat" d="M7 27c0-8.3 7.6-14 17.5-14S42 18.7 42 26.5 34.4 40 24.5 40 7 35.3 7 27z" />
      <path className="fat" d="M8 23.5C10 16.4 16.6 12 24.5 12S39.4 16 41.6 22.6c-3.8-4.4-9.8-6.6-17.1-6.6S12 18.6 8 23.5z" opacity={O} />
      <rect className="meat-d" x="14" y="21" width="3.5" height="16" rx="1.75" transform="rotate(35 15.75 29)" opacity={0.55} />
      <rect className="meat-d" x="22" y="20" width="3.5" height="18" rx="1.75" transform="rotate(35 23.75 29)" opacity={0.55} />
      <rect className="meat-d" x="30" y="20" width="3.5" height="16" rx="1.75" transform="rotate(35 31.75 28)" opacity={0.55} />
    </>
  ),
  fish: (
    <>
      <path className="a" d="M30 24l12-9v18z" />
      <ellipse className="b" cx="21" cy="24" rx="14" ry="10" opacity={O} />
      <circle className="c" cx="14" cy="21.5" r="3" />
    </>
  ),
  pudding: (
    <>
      {/* pudim: corpo dourado, calda de caramelo escorrendo e o pratinho */}
      <rect className="c" x="5" y="36" width="38" height="5" rx="2.5" />
      <path className="b" d="M15 18h18l5 18.5H10z" />
      <path className="a" d="M15 18h18l1.6 5.6c-1.6 1.6-3.2 1.6-4.4.2-1.4 2.6-3.6 3-5.4.4-1.8 2.4-4.2 2.2-5.6-.2-1.4 1.6-3 1.4-4.6-.6z" opacity={O} />
      <ellipse className="a" cx="24" cy="18" rx="9" ry="2.2" />
      <ellipse className="c" cx="24" cy="18" rx="3.2" ry="1" opacity={0.85} />
    </>
  ),
  candy: (
    <>
      {/* bombom embrulhado: papel torcido dos dois lados */}
      <path className="c" d="M5 14.5 18 24 5 33.5c-1.8-6.2-1.8-12.8 0-19z" />
      <path className="c" d="M43 14.5 30 24l13 9.5c1.8-6.2 1.8-12.8 0-19z" />
      <circle className="b" cx="24" cy="24" r="11.5" opacity={O} />
      <path className="fat" d="M16.5 19.5c3-4.6 9.4-6.1 14-3.2-4.2-.6-9.6 1-14 3.2z" opacity={0.9} />
      <path className="a" d="M17 28.6c3.6 1.8 9.4 1.6 13.6-1.8-1.6 4.4-9.8 6.6-13.6 1.8z" opacity={0.45} />
    </>
  ),
  cake: (
    <>
      {/* fatia de bolo: massa, recheio, cobertura e morango */}
      <path className="b" d="M7 25.5 41 18v20H7z" />
      <path className="a" d="M7 31.5 41 26v4L7 35.5z" opacity={O} />
      <path className="c" d="M5.5 24.2 41 16.4c1.6.3 2.4 1.6 1.8 3.2L7.6 27.6c-1.8.2-3-1.8-2.1-3.4z" />
      <circle className="box" cx="33" cy="13" r="4.6" />
      <path className="fat" d="M33 8.2c.4-1.6 1.6-2.6 3-2.8-.2 1.6-1.2 2.6-3 2.8z" />
    </>
  ),
  icecream: (
    <>
      {/* casquinha com duas bolas */}
      <path className="fry-d" d="M14.5 25h19L25.6 42.4a1.8 1.8 0 0 1-3.2 0z" />
      <path className="fry" d="M17 25h4.5l-2 4.4zM25 25h5l-2.4 5.2z" opacity={0.7} />
      <circle className="b" cx="19.5" cy="20" r="8" />
      <circle className="c" cx="28.5" cy="19" r="8" opacity={O} />
      <circle className="box" cx="24" cy="11.5" r="4" />
    </>
  ),
  salad: (
    <>
      <path className="a" d="M12 26c-1-9 4-15 12-16-1 8-5 14-12 16z" />
      <path className="b" d="M36 26c1-10-5-16-13-17 0 9 5 15 13 17z" opacity={O} />
      <path className="c" d="M8 25h32a16 14 0 0 1-32 0z" opacity={O} />
    </>
  ),
  ticket: (
    <>
      <rect className="a" x="6" y="12" width="28" height="20" rx="3" transform="rotate(-12 20 22)" />
      <rect className="b" x="12" y="16" width="30" height="20" rx="3" opacity={O} />
      <circle className="c" cx="31" cy="26" r="5" opacity={O} />
    </>
  ),
  dish: (
    <>
      <circle className="c" cx="24" cy="27" r="15" />
      <circle className="b" cx="22" cy="26" r="9" opacity={O} />
      <circle className="a" cx="30" cy="20" r="5" opacity={O} />
    </>
  ),
  people: (
    <>
      <circle className="a" cx="17" cy="19" r="10" />
      <circle className="b" cx="31" cy="19" r="10" opacity={O} />
      <circle className="c" cx="24" cy="31" r="10" opacity={O} />
    </>
  ),
  receipt: (
    <>
      <rect className="a" x="10" y="6" width="22" height="32" rx="3" />
      <rect className="c" x="14" y="12" width="12" height="3.5" rx="1.75" opacity={0.75} />
      <rect className="c" x="14" y="19" width="8" height="3.5" rx="1.75" opacity={0.75} />
      <circle className="b" cx="32" cy="34" r="9" opacity={O} />
    </>
  ),
  pie: (
    <>
      <circle className="a" cx="22" cy="26" r="15" />
      <path className="b" d="M22 7a19 19 0 0 1 19 19H22z" opacity={O} />
      <circle className="c" cx="22" cy="26" r="3.5" opacity={O} />
    </>
  ),
  money: (
    <>
      <rect className="a" x="4" y="13" width="30" height="19" rx="3" transform="rotate(-10 19 22)" />
      <rect className="b" x="10" y="15" width="30" height="19" rx="3" opacity={O} />
      <rect className="c" x="14" y="18" width="30" height="19" rx="3" transform="rotate(6 29 27)" opacity={O} />
    </>
  ),
};

export function Art({ kind, size = 28, className = '' }: { kind: ArtKind; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={`art art-${FAMILY[kind]} ${className}`.trim()}
      aria-hidden="true"
      focusable="false"
    >
      {SHAPES[kind]}
    </svg>
  );
}
