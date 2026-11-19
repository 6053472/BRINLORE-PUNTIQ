import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { parseNumber } from './csv'
import { isKind, validate } from './records'

describe('parseNumber', () => {
  test('Nederlandse en Engelse notatie', () => {
    assert.equal(parseNumber('1.234,50'), 1234.5)
    assert.equal(parseNumber('1,234.50'), 1234.5)
    assert.equal(parseNumber('52,5'), 52.5)
    assert.equal(parseNumber('€ 900'), 900)
  })
  test('punt als duizendtal of als decimaalteken', () => {
    assert.equal(parseNumber('1.250'), 1250)
    assert.equal(parseNumber('1.250.000'), 1250000)
    assert.equal(parseNumber('52.5'), 52.5)
    assert.equal(parseNumber('0.125'), 0.125)
  })
  test('leeg of onleesbaar', () => {
    assert.equal(parseNumber(''), undefined)
    assert.equal(parseNumber('abc'), undefined)
    assert.equal(parseNumber('1,2,3'), undefined)
  })
})

describe('records-validatie', () => {
  test('onbestaande datums worden afgewezen', () => {
    assert.ok(validate('invoices', { description: 'x', amount: 10, issueDate: '2026-02-31', dueDate: '2026-03-10' }).error)
    assert.ok(!validate('invoices', { description: 'x', amount: 10, issueDate: '2028-02-29', dueDate: '2028-03-10' }).error)
  })
  test('prototype-namen zijn geen record-soort', () => {
    assert.equal(isKind('constructor'), false)
    assert.equal(isKind('toString'), false)
    assert.equal(isKind('invoices'), true)
  })
  test('lege keuzewaarde bij gedeeltelijke update wordt geweigerd', () => {
    assert.ok(validate('contracts', { status: '' }, true).error)
  })
})
