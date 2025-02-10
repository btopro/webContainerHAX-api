import { WebContainer } from '@webcontainer/api';
import { files } from "./files";
import { Terminal } from 'xterm';
import 'xterm/css/xterm.css';
import { askClaudeRemote, askICDSRemote } from './src/api.js';
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


  //NEW
  async getRecipeURL(terminal, urlToGet) {
    try {
      // Fetch content from URL
      const response = await fetch(urlToGet);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const recipeContent = await response.text();
      // Write content to file
      await WebContainersInstance.fs.writeFile('/mysite/urlsite.recipe', recipeContent);
      console.log('Recipe file written successfully');
      recipeTextArea.value = recipeContent;
    } catch (error) {
      console.error('Error fetching or writing recipe:', error);
      throw error;
    }
  }

  async runRecipeURL(terminal, shellManager) {
    try {
      // Check current directory and build the appropriate command
      let playCommandRecipe = 'hax site recipe:play --recipe urlsite.recipe --y';

      if (!shellManager.currentOutput.includes('mysite')) {
          console.log('Not in mysite directory, will prepend cd command');
          playCommandRecipe = 'cd mysite && ' + playCommandRecipe;
      } else {
          console.log('Already in mysite directory, running play command directly');
      }
      
      if (!shellManager.persistentShell) {
          throw new Error('Shell not initialized');
      }
      
      try {
          terminal.write(`\n\n> ${playCommandRecipe}\n`);
          await shellManager.shellInput.write(`${playCommandRecipe}\n`);
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
  }


  async runRecipeDownload(terminal, shellManager) {
    try {
      console.log('Starting download process...');
  
      const filePath = '/mysite/newsite.recipe';
      console.log('File path:', filePath);
      
      console.log('Attempting to read file from WebContainer...');
      const fileContent = await WebContainersInstance.fs.readFile(filePath);
      console.log('File content read:', fileContent);
      
      // Check if file content exists and has length
      if (!fileContent || !fileContent.length) {
        throw new Error('File content is empty or invalid');
      }
      console.log('File content validation passed');
      
      const contentArray = new Uint8Array(fileContent);
      console.log('Content converted to Uint8Array:', contentArray);
      
      const blob = new Blob([contentArray], { type: 'application/octet-stream' });
      console.log('Blob created:', blob);
      
      const url = window.URL.createObjectURL(blob);
      console.log('Blob URL created:', url);
      
      const a = document.createElement('a');
      a.href = url;
      const fileName = filePath.split('/').pop();
      a.download = fileName;
      console.log('Download filename set to:', fileName);
      
      // Make anchor invisible
      a.style.display = 'none';
      document.body.appendChild(a);
      console.log('Anchor element added to document');
      
      // Small delay to ensure the element is in the DOM
      console.log('Waiting for DOM update...');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('Triggering click event...');
      a.click();
      
      // Cleanup
      console.log('Starting cleanup...');
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      console.log('Cleanup completed');
      
      console.log('Download process completed successfully');
      
    } catch (error) {
      console.error('Error in download process:');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      console.error('Full error object:', error);
      
      // Log WebContainer instance state if possible
      try {
        console.log('WebContainer state:', WebContainersInstance);
      } catch (e) {
        console.error('Could not log WebContainer state:', e);
      }
      
      // You might want to show this error to the user
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

//END
}

// DOM references
const iframe = document.querySelector('iframe');
const aiTextArea = document.querySelector('#aiTextArea');
const submitButtonAI = document.querySelector('#submitButtonAI');
const cmdTextArea = document.querySelector('#cmdTextArea');
const submitButtonCMD = document.querySelector('#submitButtonCMD');
const terminalElement = document.querySelector('.terminal');
const aiSpinner = document.querySelector('#aiSpinner');

const recipeurlTextArea = document.querySelector('#recipeURLArea');
const submitButtonURL = document.querySelector('#recipeButtonURL');
const recipeTextArea = document.querySelector('#recipeTextArea');
const submitButtonRecipe = document.querySelector('#recipeButtonCMD');
const submitButtonRecipeDownload = document.querySelector('#recipeDownload');


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
      const psuCheckbox = document.getElementById('psuCheckbox');

      //const commands = await askClaudeRemote(query);  //orig
      const commands = await (psuCheckbox.checked ? askICDSRemote(query) : askClaudeRemote(query));

      // Write the commands directly to the recipe file
      const recipeContent = Array.isArray(commands) ? commands.join('\n') : commands;
      await WebContainersInstance.fs.writeFile('/mysite/newsite.recipe', recipeContent);
      console.log('Recipe file written successfully');
      
      recipeTextArea.value = recipeContent;

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


  // get content for recipe from url
  submitButtonURL.addEventListener('click', async () => {
    const recipeURL = recipeurlTextArea.value
    await shellManager.getRecipeURL(terminal, recipeURL);
  });

  // run recipe retrieved from
  submitButtonRecipe.addEventListener('click', async () => {
    await shellManager.runRecipeURL(terminal,shellManager);
  });
  
  // run recipe retrieved from
  submitButtonRecipeDownload.addEventListener('click', async () => {
    await shellManager.runRecipeDownload(terminal,shellManager);
  });
  


  // Install deps and start dev server
  await installDependencies(terminal);
  await startDevServer(terminal);

  console.log('Window loaded');
});