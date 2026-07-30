import { describe, expect, it } from 'vitest'
import { decodeSequenceText } from '../parser'

describe('decodeSequenceText', () => {
  it('decodes hexadecimal entity codes in either spelling of the x', () => {
    expect(decodeSequenceText('&#x23; and &#X2665;')).toBe('# and ♥')
  })

  it('leaves a named entity it does not know exactly as it was written', () => {
    expect(decodeSequenceText('half is &frac12; of it')).toBe(
      'half is &frac12; of it'
    )
  })

  it('decodes the named entities regardless of the case they are written in', () => {
    expect(decodeSequenceText('&LT;tag&gt; said &QUOT;hi&apos;')).toBe(
      '<tag> said "hi\''
    )
  })

  it('treats a non-breaking space as a space rather than as unknown text', () => {
    expect(decodeSequenceText('Order&nbsp;42')).toBe('Order 42')
  })

  it('breaks the line on every spelling of the break tag', () => {
    expect(decodeSequenceText('one<br>two<br />three<BR/>four')).toBe(
      'one\ntwo\nthree\nfour'
    )
  })

  it('trims the decoded text so a padded label measures as its content', () => {
    expect(decodeSequenceText('   Confirm payment   ')).toBe('Confirm payment')
  })

  it('does not decode a second time what an earlier replacement produced', () => {
    expect(decodeSequenceText('&amp;lt;')).toBe('&lt;')
  })
})
