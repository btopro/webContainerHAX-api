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
            /*
            if (this.lastCommand.startsWith('cd ')) {
              // Extract the new directory from pwd command output
              const pwdMatch = this.currentOutput.match(/\/.*?\n/);
              if (pwdMatch) {
                this.currentDirectory = pwdMatch[0].trim();
                console.log('Updated working directory:', this.currentDirectory);
              }
            }
            */
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

  // Removed writeRecipeFile method as it's no longer needed

  async sendCommand(terminal, command) {
    if (!this.persistentShell) {
        throw new Error('Shell not initialized');
    }
    
    command = command.trim();
    console.log('Command to execute:', command);
        
    try {
        // Check current directory first
        /*
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
        */

        // Execute the command
        this.currentOutput = '';
        console.log(`Executing command: ${command}`);
        terminal.write(`\n\n> ${command}\n`);
        
        this.lastCommand = command;
        await this.shellInput.write(`${command}\n`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
        
        terminal.write(`\n📝 Output:\n${this.currentOutput.trim()}\n`);
        terminal.write(`\n✅ Completed: ${command}\n`);
        terminal.write('\n' + '-'.repeat(50) + '\n');
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
  cmdTextArea.value = 'CMD';

  // Fit the terminal size
  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  fitAddon.fit();

  // Boot the WebContainer
  WebContainersInstance = await WebContainer.boot();

  // Mount project files
  await WebContainersInstance.mount(files);

  // Create and initialize the shell
  const shellManager = new ShellManager();
  await shellManager.initialize(WebContainersInstance, terminal);

  // "Ask Claude" button => fetch AI response => write to recipe file and run play command
  submitButtonAI.addEventListener('click', async () => {
    const query = 'I already have a site called mysite and ' + aiTextArea.value;

    // Show spinner and disable button
    aiSpinner.style.display = 'block';
    submitButtonAI.disabled = true;
    
    try {
      // Get the commands from Claude
      const commands = await askClaudeRemote(query);
      
      // Write the commands directly to the recipe file
      const recipeContent = Array.isArray(commands) ? commands.join('\n') : commands;
      await WebContainersInstance.fs.writeFile('/mysite/newsite.recipe', recipeContent);
      console.log('Recipe file written successfully');
      
      // Create and execute the play command
      //const playCommand = 'hax site recipe:play --recipe newsite.recipe --y';   //orig
      //cmdTextArea.value = playCommand;    //remove this for demo
      
      // Check current directory and build the appropriate command
      let playCommand = 'hax site recipe:play --recipe newsite.recipe --y';
      if (!shellManager.currentOutput.includes('mysite')) {
          console.log('Not in mysite directory, will prepend cd command');
          playCommand = 'cd mysite && ' + playCommand;
      } else {
          console.log('Already in mysite directory, running play command directly');
      }
      
      // Execute the play command directly (single command, no need for array handling)
      if (!shellManager.persistentShell) {
          throw new Error('Shell not initialized');
      }
      
      try {
          // Ensure we're in the mysite directory
          /*
          if (!shellManager.currentDirectory.endsWith('mysite')) {
              await shellManager.shellInput.write('cd mysite\n');
              await new Promise(resolve => setTimeout(resolve, 500));
          }
          */

          // Execute the play command
          terminal.write(`\n\n> ${playCommand}\n`);
          await shellManager.shellInput.write(`${playCommand}\n`);
          await new Promise((resolve) => setTimeout(resolve, 3000));
          
          terminal.write(`\n✅ Recipe playback initiated\n`);
          terminal.write('\n' + '-'.repeat(50) + '\n');
          
          // Refresh the iframe
          await new Promise(resolve => setTimeout(resolve, 5000));
          iframe.src = iframe.src;
      } catch (error) {
          console.error('Error executing play command:', error);
          terminal.write(`\n❌ Error: ${error.message}\n`);
      }
      
    } catch (error) {
      console.error('Failed to process commands:', error);
      cmdTextArea.value = `Error: ${error.message}`;
    } finally {
      // Hide spinner and re-enable button
      aiSpinner.style.display = 'none';
      submitButtonAI.disabled = false;
    }
  });

  // "Send Command" button => run whatever is in cmdTextArea
  submitButtonCMD.addEventListener('click', async () => {
    const textValue = cmdTextArea.value;
    await shellManager.sendCommand(terminal, textValue);
  });

  // Install deps and start dev server
  await installDependencies(terminal);
  await startDevServer(terminal);

  console.log('Window loaded');
});