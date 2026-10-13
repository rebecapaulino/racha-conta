import { formatBRL } from '../../core/money';

/**
 * Valor com sinal e cor: verde com "+" para quem recebe, vermelho com "−" para quem deve.
 * O "R$" nunca fica separado do número na quebra de linha.
 */
export function Signed({ cents, className = '' }: { cents: number; className?: string }) {
  const kind = cents > 0 ? 'amt-pos' : cents < 0 ? 'amt-neg' : 'amt-zero';
  const sign = cents > 0 ? '+ ' : cents < 0 ? '− ' : '';
  return <b className={`num ${kind} ${className}`.trim()}>{sign}{formatBRL(Math.abs(cents)).replace(' ', ' ')}</b>;
}
