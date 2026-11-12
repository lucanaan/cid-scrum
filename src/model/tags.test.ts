import { describe, expect, it } from 'vitest';
import { parseTags, updateTags, writeTags } from './tags';

describe('tags', () => {
  it('lê pontos e sprint e preserva o texto', () => {
    const { tags, body } = parseTags('[pts:5] [sprint:12]\nCorrigir login\ncom SSO');
    expect(tags).toEqual({ points: 5, sprint: 12 });
    expect(body).toBe('Corrigir login\ncom SSO');
  });

  it('descrição sem tags fica intacta', () => {
    expect(parseTags('Só texto [link]').body).toBe('Só texto [link]');
    expect(writeTags('Só texto', {})).toBe('Só texto');
  });

  it('escreve tags na primeira linha', () => {
    expect(writeTags('Texto', { points: 3 })).toBe('[pts:3]\nTexto');
    expect(writeTags('', { points: 3, sprint: 2 })).toBe('[pts:3] [sprint:2]');
  });

  it('atualiza e remove tags sem duplicar', () => {
    let d = updateTags('Texto', { points: 3 });
    d = updateTags(d, { points: 8, sprint: 4 });
    expect(d).toBe('[pts:8] [sprint:4]\nTexto');
    d = updateTags(d, { sprint: undefined });
    expect(d).toBe('[pts:8]\nTexto');
    d = updateTags(d, { points: undefined });
    expect(d).toBe('Texto');
  });

  it('ida e volta do poker', () => {
    const d = updateTags('', { poker: { revealed: false, votes: { a1: '5', b2: '?' } } });
    expect(d).toBe('[poker:r=0;a1=5;b2=?]');
    expect(parseTags(d).tags.poker).toEqual({ revealed: false, votes: { a1: '5', b2: '?' } });
  });

  it('ignora valores inválidos', () => {
    expect(parseTags('[pts:abc] [poker:r=1;x=99]').tags).toEqual({
      poker: { revealed: true, votes: {} },
    });
  });
});
