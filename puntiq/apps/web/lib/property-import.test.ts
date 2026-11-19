import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseCsv, parseNumber } from './csv'
import { parsePropertyCsv } from './property-import'

const types = ['Zelfstandig', 'Onzelfstandig', 'Bedrijfsruimte']
const statuses = ['Beschikbaar', 'Verhuurd', 'In onderhoud']

test('parseCsv herkent puntkomma, BOM, aanhalingstekens en meerregelige cellen', () => {
  const rows = parseCsv('﻿naam;adres\r\n"A; B";"straat ""1""\nboven"\r\nC;D')
  assert.deepEqual(rows, [['naam', 'adres'], ['A; B', 'straat "1"\nboven'], ['C', 'D']])
})

test('parseNumber leest Nederlandse en Engelse notatie', () => {
  assert.equal(parseNumber('1.234,50'), 1234.5)
  assert.equal(parseNumber('€ 52,5'), 52.5)
  assert.equal(parseNumber('52.5'), 52.5)
  assert.equal(parseNumber(''), undefined)
  assert.equal(parseNumber('abc'), undefined)
})

test('parsePropertyCsv koppelt kolommen, normaliseert type/status en meldt fouten per regel', () => {
  const result = parsePropertyCsv(
    'Naam;Adres;Type;Status;m²;Huur\nA;Straat 1;zelfstandig;verhuurd;52,5;925,50\n;Straat 2;;;;\nB;Straat 3;kasteel;;;\nC;Straat 4;;;x;',
    types, statuses,
  )
  assert.equal(result.rows.length, 1)
  assert.deepEqual(result.rows[0], { name: 'A', address: 'Straat 1', type: 'Zelfstandig', status: 'Verhuurd', area: 52.5, rent: 925.5 })
  assert.deepEqual(result.errors.map(error => error.line), [3, 4, 5])
})

test('parsePropertyCsv vereist de kolommen naam en adres', () => {
  const result = parsePropertyCsv('Type;Status\nZelfstandig;Verhuurd', types, statuses)
  assert.equal(result.rows.length, 0)
  assert.equal(result.errors.length, 1)
})
