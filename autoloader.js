import * as fs from 'fs';
import * as path from 'path';

//const INPUT = 'appVite'
const INPUT = 'appHAX'
const OUTPUT = 'files.js'
//const files = ['index.js', 'package.json', 'vite.config.js', 'index.html', '.gitignore']
const files = ['index.js', 'package.json']
const exportLine = 'export const files = '
const content = {}

files.forEach(file => {
   const buffer = fs.readFileSync(`./${INPUT}/${file}`)
   content[file] = {
       file: {
           contents: buffer.toString()
       }
   }
})
fs.writeFileSync(OUTPUT, `${exportLine}${JSON.stringify(content, null, 2)}`)














