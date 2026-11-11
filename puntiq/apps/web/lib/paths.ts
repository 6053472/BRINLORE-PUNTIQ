import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const workingDirectory = process.cwd()
const appDirectory =
  [
    path.join(workingDirectory, 'apps', 'web'),
    path.join(workingDirectory, 'puntiq', 'apps', 'web'),
    workingDirectory,
  ].find(directory => existsSync(path.join(directory, 'package.json'))) ?? workingDirectory

export const dataDirectory = path.join(appDirectory, 'data')
mkdirSync(dataDirectory, { recursive: true })
