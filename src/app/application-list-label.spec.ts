import { applicationListLabel } from './application-list-label';

describe('applicationListLabel', () => {
  it('uses title when it is non-blank', () => {
    expect(applicationListLabel({ title: 'Viewer title', name: 'code' })).toBe('Viewer title');
  });

  it('falls back to name when title is null', () => {
    expect(applicationListLabel({ title: null, name: 'SITMUN - Provincial' })).toBe(
      'SITMUN - Provincial'
    );
  });

  it('falls back to name when title is missing or blank', () => {
    expect(applicationListLabel({ name: 'Edition' })).toBe('Edition');
    expect(applicationListLabel({ title: '', name: 'Edition' })).toBe('Edition');
    expect(applicationListLabel({ title: '   ', name: 'Edition' })).toBe('Edition');
  });

  it('returns an empty string when both fields are blank', () => {
    expect(applicationListLabel({})).toBe('');
    expect(applicationListLabel({ title: null, name: null })).toBe('');
  });
});
