import { WebContainer } from '@webcontainer/api';
import { files } from "./files";
import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';
import { askClaudeRemote } from './src/api.js';
import { FitAddon } from '@xterm/addon-fit';

/** ShellManager: Manages a persistent shell in the WebContainer */
class ShellManager {
  constructor() {
    this.persistentShell = null;
    this.shellInput = null;
    this.currentOutput = '';
    this.currentDirectory = '/';
    this.lastCommand = '';
  }

  /** Initialize the persistent jsh shell and set up piping to the terminal */
  async initialize(WebContainersInstance, terminal) {
    this.persistentShell = await WebContainersInstance.spawn('jsh');
    this.shellInput = this.persistentShell.input.getWriter();

    // Pipe shell output and track directory changes
    this.persistentShell.output
      .pipeTo(
        new WritableStream({
          write: (data) => {
            terminal.write(data);
            this.currentOutput += data;
            console.log('Shell output:', data);
            
            // Update current directory if we detect a cd command completed
            if (this.lastCommand.startsWith('cd ')) {
              // Extract the new directory from pwd command output
              const pwdMatch = this.currentOutput.match(/\/.*?\n/);
              if (pwdMatch) {
                this.currentDirectory = pwdMatch[0].trim();
                console.log('Updated working directory:', this.currentDirectory);
              }
            }
          },
        })
      )
      .catch((err) => {
        console.error('Error piping shell output:', err);
      });

    // Check if shell unexpectedly exits
    this.persistentShell.exit.then((code) => {
      console.log('Shell exited with code:', code);
      this.persistentShell = null;
      this.shellInput = null;
    });
  }

  async sendCommand(terminal, commands) {
    if (!this.persistentShell) {
        throw new Error('Shell not initialized');
    }
    
    let commandsArray;
    if (Array.isArray(commands)) {
        commandsArray = commands
            .filter(cmd => cmd && cmd.trim().length > 0)
            .map(cmd => cmd.trim());
    } else {
        // Handle the command as a single unit
        let command = commands.trim();
        
        // Check if this is a HAX command with content
        if (command.includes('hax site node:add')) {
            // Find the content parameter
            const contentStart = command.indexOf('--content');
            if (contentStart !== -1) {
                // Split the command into pre-content and content parts
                const preContent = command.substring(0, contentStart + 9); // +9 for '--content'
                const remainingContent = command.substring(contentStart + 9).trim();
                
                // Wrap the entire content in quotes if it's not already
                if (!remainingContent.startsWith('"')) {
                    command = `${preContent} "${remainingContent}"`;
                }
            }
        }
        
        // Put the command into an array as a single item
        commandsArray = [command];
    }
    
    console.log('Commands to execute:', commandsArray);
        
    try {
        // Check current directory first
        if (!this.currentDirectory.endsWith('mysite')) {
            // Only attempt cd if not already in mysite
            this.currentOutput = '';
            this.lastCommand = 'pwd';
            await this.shellInput.write('pwd\n');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (!this.currentOutput.includes('mysite')) {
                console.log('Changing to mysite directory first...');
                terminal.write(`\n\n> cd mysite\n`);
                
                this.currentOutput = '';
                this.lastCommand = 'cd mysite';
                await this.shellInput.write('cd mysite\n');
                await new Promise(resolve => setTimeout(resolve, 500));
                await this.shellInput.write('pwd\n');
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                terminal.write(`\n📝 Output:\n${this.currentOutput.trim()}\n`);
                terminal.write(`\n✅ Changed to mysite directory\n`);
                terminal.write('\n' + '-'.repeat(50) + '\n');
            }
        }

        // Execute each command
        for (const command of commandsArray) {
            this.currentOutput = '';
            console.log(`Executing command: ${command}`);
            terminal.write(`\n\n> ${command}\n`);
            
            this.lastCommand = command;
            await this.shellInput.write(`${command}\n`);
            await new Promise((resolve) => setTimeout(resolve, 3000));
            
            terminal.write(`\n📝 Output:\n${this.currentOutput.trim()}\n`);
            terminal.write(`\n✅ Completed: ${command}\n`);
            terminal.write('\n' + '-'.repeat(50) + '\n');
        }
    } catch (error) {
        console.error('Error in command execution:', error);
        terminal.write(`\n❌ Fatal error: ${error.message}\n`);
    }
    
    iframe.src = iframe.src;
  }

  /** Get the current working directory */
  getCurrentDirectory() {
    return this.currentDirectory;
  }

  /** Check if the shell is initialized and ready */
  isReady() {
    return this.persistentShell !== null && this.shellInput !== null;
  }

  /** Clean up resources when done */
  async cleanup() {
    if (this.shellInput) {
      await this.shellInput.close();
    }
    this.persistentShell = null;
    this.shellInput = null;
    this.currentOutput = '';
    this.currentDirectory = '/';
    this.lastCommand = '';
  }
}

// DOM references
const iframe = document.querySelector('iframe');
const aiTextArea = document.querySelector('#aiTextArea');
const submitButtonAI = document.querySelector('#submitButtonAI');
const cmdTextArea = document.querySelector('#cmdTextArea');
const submitButtonCMD = document.querySelector('#submitButtonCMD');
const ansTextArea = document.querySelector('#ansTextArea');
const terminalElement = document.querySelector('.terminal');
const aiSpinner = document.querySelector('#aiSpinner');

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

/** Main entry point */
window.addEventListener('load', async () => {
  // Set up xterm.js
  const terminal = new Terminal({ convertEol: true });
  terminal.open(terminalElement);

  // Initialize text areas
  aiTextArea.value = 'AI';
  ansTextArea.value = 'Answer';
  cmdTextArea.value = 'CMD';

  // Fit the terminal size
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  fitAddon.fit();

  // "Ask Claude" button => fetch AI response => put into cmdTextArea
  submitButtonAI.addEventListener('click', async () => {
    const query = aiTextArea.value;
    
    // Show spinner and disable button
    aiSpinner.style.display = 'block';
    submitButtonAI.disabled = true;
    
    try {
      const answer = await askClaudeRemote(query);
      cmdTextArea.value = answer;
      ansTextArea.value = 'Response received successfully!';
    } catch (error) {
      console.error('Failed to get response:', error);
      cmdTextArea.value = `Error: ${error.message}`;
      ansTextArea.value = 'Error occurred while getting response';
    } finally {
      // Hide spinner and re-enable button
      aiSpinner.style.display = 'none';
      submitButtonAI.disabled = false;
    }
  });

  // Boot the WebContainer
  WebContainersInstance = await WebContainer.boot();

  // Mount project files
  await WebContainersInstance.mount(files);

  // Create and initialize the shell
  const shellManager = new ShellManager();
  await shellManager.initialize(WebContainersInstance, terminal);

  // "Send Command" button => run whatever is in cmdTextArea
  submitButtonCMD.addEventListener('click', async () => {
    const textValue = cmdTextArea.value;
    await shellManager.sendCommand(terminal, textValue);
  });

  // Install deps and start dev server
  await installDependencies(terminal);
  await startDevServer(terminal);

  console.log('Window is loaded and WebContainer is initialized.');
});