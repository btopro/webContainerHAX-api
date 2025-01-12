import { WebContainer } from '@webcontainer/api';
import { files } from "./files";
import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';
import { askClaudeLocal, askClaudeRemote, readFile} from './src/api.js';
import * as fs from 'fs';
import { FitAddon } from '@xterm/addon-fit';

class ShellManager {
  constructor() {
      this.persistentShell = null;
      this.shellInput = null;
      this.currentOutput = '';
  }

  async initialize(WebContainersInstance) {
      this.persistentShell = await WebContainersInstance.spawn('jsh');
      this.shellInput = this.persistentShell.input.getWriter();
      
      // Set up output handling
      this.persistentShell.output.pipeTo(new WritableStream({
          write: (data) => {
              terminal.write(data);
              this.currentOutput += data;
              console.log('Shell output:', data);
          }
      }));
  }

  async sendCommand(terminal, commandsString) {
      if (!this.persistentShell) {
          throw new Error('Shell not initialized');
      }

      const commands = commandsString.split(',').map(cmd => cmd.trim()).filter(cmd => cmd);
      console.log('Commands to execute:', commands);

      for (const command of commands) {
          // Reset output buffer for this command
          this.currentOutput = '';
          
          console.log(`Executing command: ${command}`);
          terminal.write(`\n\n> ${command}\n`);
          
          try {
              // Send command to shell
              await this.shellInput.write(`${command}\n`);

              // Wait for command to complete and output to settle
              await new Promise(resolve => setTimeout(resolve, 3000));
              
              // Display command output summary              
              const output = this.currentOutput.trim();
              terminal.write(`\n📝 Output:\n${output}\n`);
              terminal.write(`\n✅ Completed: ${command}\n`);
              terminal.write('\n' + '-'.repeat(50) + '\n'); // Separator line
          } catch (error) {
              console.error(`Error executing command ${command}:`, error);
              terminal.write(`\n❌ Error: ${error.message}\n`);
          }
      }

      iframe.src = iframe.src;
  }
}


const iframe = document.querySelector('iframe');

const aiTextArea = document.querySelector("#aiTextArea");
const submitButtonAI = document.querySelector('#submitButtonAI');

const cmdTextArea = document.querySelector("#cmdTextArea");
const submitButtonCMD = document.querySelector('#submitButtonCMD');

const ansTextArea = document.querySelector("#ansTextArea");

const terminalElement = document.querySelector('.terminal');

let WebContainersInstance;

async function installDependencies(terminal) {
  const installProcess = await WebContainersInstance.spawn('npm', ['install']);
  installProcess.output.pipeTo(new WritableStream({
    write(data) {
      terminal.write(data);
    }
  }));
  return installProcess.exit;
}

async function startDevServer(terminal) {
  const serverProcess = await WebContainersInstance.spawn('npm', ['run', 'start']);
  serverProcess.output.pipeTo(new WritableStream({
    write(data) {
      terminal.write(data);
    }
  }));

  WebContainersInstance.on('server-ready', (port, url) => {
    iframe.src = url;
  });
}

//main
window.addEventListener('load', async () => {
  const terminal = new Terminal({
    convertEol: true,
  });
  terminal.open(terminalElement);
  
  aiTextArea.value = "AI";
  ansTextArea.value = "Answer";
  cmdTextArea.value = "CMD";

  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  fitAddon.fit();

  submitButtonAI.addEventListener('click', async () => {
    const query = aiTextArea.value;
    try {
      const answer = await askClaudeRemote(query);
      cmdTextArea.value = answer;
    } catch (error) {
      console.error('Failed to get response:', error);
      cmdTextArea.value = `Error: ${error.message}`;
    }
  });

  WebContainersInstance = await WebContainer.boot();
  await WebContainersInstance.mount(files);

  const shellManager = new ShellManager();
  await shellManager.initialize(WebContainersInstance);

  submitButtonCMD.addEventListener('click', async () => {
    const textValue = cmdTextArea.value;
    await shellManager.sendCommand(terminal, textValue);    
  });

  await installDependencies(terminal);
  await startDevServer(terminal);

  console.log('Window is loaded');
});