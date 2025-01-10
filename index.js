import { WebContainer } from '@webcontainer/api';
import { files } from "./files";
import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';
import { askClaudeLocal, readFile} from './src/api.js';
import * as fs from 'fs';
import { FitAddon } from '@xterm/addon-fit';

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

async function writeIndexJS(file, content) {
  await WebContainersInstance.fs.writeFile(`/${file}`, content);
}

/*
async function sendCommand(terminal, commandToSend) {
  const commands = commandToSend.split('&&').map(cmd => cmd.trim());

  for (const command of commands) {
    const commandParts = command.split(' ');
    const cmd = commandParts[0];
    const args = commandParts.slice(1);

    console.log(cmd)
    console.log(args)


    if (cmd === 'cd') {
      // Handle cd command specially
      try {
        await WebContainersInstance.fs.chdir(args[0]);
        terminal.write(`Changed directory to ${args[0]}\n`);
      } catch (error) {
        terminal.write(`Failed to change directory: ${error.message}\n`);
        break;
      }
    } else {
      const commandProcess = await WebContainersInstance.spawn(cmd, args);
      commandProcess.output.pipeTo(new WritableStream({
        write(data) {
          terminal.write(data);
          console.log(data);
        }
      }));

      const exitCode = await commandProcess.exit;
      if (exitCode === 0) {
        iframe.src = iframe.src; 
      } else {
        terminal.write(`\nCommand "${command}" failed with exit code ${exitCode}\n`);
        break; 
      }
  }
  }
}
*/


async function sendCommand(terminal, commandToSend) {
  // Don't split on && - pass the whole command to the shell
  const shellProcess = await WebContainersInstance.spawn('jsh', ['-c', commandToSend]);
  
  shellProcess.output.pipeTo(new WritableStream({
    write(data) {
      terminal.write(data);
      console.log(data);
    }
  }));

  const exitCode = await shellProcess.exit;
  if (exitCode === 0) {
    iframe.src = iframe.src; 
  } else {
    terminal.write(`\nCommand failed with exit code ${exitCode}\n`);
  }
}




async function startShell(terminal) {
  const shellProcess = await WebContainersInstance.spawn('jsh', {
    terminal: {
      cols: terminal.cols,
      rows: terminal.rows,
    },
  });
  shellProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        terminal.write(data);
      },
    })
  );

  const input = shellProcess.input.getWriter();

  terminal.onData((data) => {
    input.write(data);
  });

  return shellProcess;
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

    const jsFiles = await readFile();
    //const commandsToAdd = "The command needed to deploy a site is 'hax site publish --service surge --y'";
    const commandsToAdd = "The command needed to deploy a site is 'hax site surge --domain whatever.com'";
    const combinedText = commandsToAdd + jsFiles;

    //console.log (combinedText);

    //get general ai answer
    const llmPrompt = `Based on the following information, answer the query: ${query}\n\n${combinedText}`;
    
    try {
      const answer = await askClaudeLocal(llmPrompt);
      ansTextArea.value = answer;
    } catch (error) {
      console.error('Failed to get response:', error);
      cmdTextArea.value = `Error: ${error.message}`;
    }

    //get cmd ai answer
    const cmdPrompt = `Based on the following information provide the specific command that would be needed to do this and only respond with the specific command.  Do not add any other text - just tell me the command: ${query}\n\n${combinedText}`;
    
    try {
      const answer = await askClaudeLocal(cmdPrompt);
      cmdTextArea.value = answer;
    } catch (error) {
      console.error('Failed to get response:', error);
      cmdTextArea.value = `Error: ${error.message}`;
    }

  });

  submitButtonCMD.addEventListener('click', () => {
    const textValue = cmdTextArea.value;
    sendCommand(terminal, textValue);    
  });

  WebContainersInstance = await WebContainer.boot();
  await WebContainersInstance.mount(files);


  //swapped these two ^
  await installDependencies(terminal);
  await startDevServer(terminal);

  const shellProcess = await startShell(terminal);
  window.addEventListener('resize', () => {
    fitAddon.fit();
    shellProcess.resize({
      cols: terminal.cols,
      rows: terminal.rows,
    });
  });

  //PRODUCTION send of commands
  ///const sendValue = "npm list && ls -al && npm --help";
  ///await sendCommand(terminal, sendValue);    


  console.log('Window is loaded');
});